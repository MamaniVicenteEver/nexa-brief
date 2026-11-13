"""Pure layer resolution and explicit freezing; never generates a localized video."""
from __future__ import annotations
from copy import deepcopy
import hashlib
import math
import os
from pathlib import Path
import re
from src.core.editions.formats import DEFINITIONS_DIR, SRC, load_format, read_json, select_format, validate_duration
from src.core.editions.schemas import Category, DesignFormats, Edition, IdentityMarket, Localizable, Overrides, Persona
from .strategies import merge, resolve_strategy
from .research_context import documents
from src.core.markets import get_market

KIT = SRC / "templates/_tools/explainer-kit"


def _source_file(production: Path, relative: str) -> Path:
    path = production / relative
    if path.absolute() != path.resolve():
        raise ValueError("Production source contains a symlink or escapes its directory")
    return path


def _provenance(value, source, prefix, out):
    if isinstance(value, dict):
        for key, child in value.items():
            _provenance(child, source, f"{prefix}.{key}" if prefix else key, out)
    else:
        out[prefix] = source


def _source_revision(production):
    digest = hashlib.sha256()
    # Include every production document used to prepare the edition. In particular,
    # cue positions depend on lyrics and the writer's context depends on both briefs.
    for relative in ("assets/script.json", "assets/storyboard.json", "assets/config.json",
                     "assets/lyrics.json", "publish.json", "PLAN.md", "BRIEF.md"):
        path = _source_file(production, relative)
        digest.update(relative.encode())
        digest.update(path.read_bytes() if path.exists() else b"missing")
    # Preserve legacy hashes when no additional research documents are used.
    try:
        _, research_files = documents(production)
    except (ValueError, UnicodeError):
        # Invalid/oversized documents must still permit listing an existing
        # edition. Preflight reports the error; include files so fixing them
        # invalidates the old revision. Stream to avoid allocating huge files.
        research_files = [name for name in ("research.json", "research.md", "assets/research.json", "assets/research.md")
                          if _source_file(production, name).is_file()]
    for relative in research_files:
        digest.update(b"\0research-document-v1\0")
        digest.update(relative.encode())
        with _source_file(production, relative).open("rb") as stream:
            while chunk := stream.read(65536):
                digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def _recorded_duration(production: Path, cfg: dict, script: dict) -> tuple[float, str]:
    """Use the duration of the existing audio before editorial target estimates."""
    lyrics = _source_file(production, "assets/lyrics.json")
    metadata = read_json(lyrics).get("metadata", {}) if lyrics.is_file() else {}
    outro = cfg.get("outro") or {}
    candidates = [
        (metadata.get("duration"), "assets/lyrics.json:metadata.duration"),
        ((outro.get("start", 0) or 0) + (outro.get("dur", 0) or 0), "assets/config.json:outro"),
        ((script.get("target_minutes") or 0) * 60, "assets/script.json:target_minutes"),
    ]
    for value, source in candidates:
        if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0:
            return float(value), source
    raise ValueError("No se pudo determinar la duración del original existente")


def build_edition(production: str | Path, locale="es-419", *, revision="rev-001", format_id=None,
                  duration_seconds=None, account: dict | None = None, episode: dict | None = None,
                  preserve_source_format: bool = False) -> Edition:
    production = Path(production).resolve()
    market = get_market(locale)
    if not re.fullmatch(r"rev-[A-Za-z0-9_-]+", revision):
        raise ValueError("Invalid edition revision")
    raw = read_json(_source_file(production, "assets/config.json"))
    configs = raw.get("configs")
    cfg = next((c for c in configs if c.get("id") == raw.get("activeId")), configs[0]) if configs else raw
    script = read_json(_source_file(production, "assets/script.json"))
    design_id = cfg.get("design", script.get("design", "binary"))
    if not isinstance(design_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", design_id):
        raise ValueError("Invalid design id")
    definition = DEFINITIONS_DIR / design_id
    if not (definition / "identity/persona.json").exists():
        raise ValueError(f"Design {design_id} has no edition identity; only its original language is supported")
    persona = Persona.model_validate(read_json(definition / "identity/persona.json"))
    identity = IdentityMarket.model_validate(read_json(definition / f"identity/markets/{market.locale}.json"))
    if identity.persona_id != persona.persona_id or identity.market != market.locale:
        raise ValueError("Identity market/persona mismatch")
    design_formats = DesignFormats.model_validate(read_json(definition / "formats.json"))
    localizable = Localizable.model_validate(read_json(definition / "localizable.json"))
    if design_formats.design_id != design_id or localizable.design_id != design_id:
        raise ValueError("Design layer identity mismatch")
    design = read_json(definition / "design.json")
    visual_outro = read_json(KIT / "designs" / design_id / "design.json").get("defaults", {}).get("outro", {})
    category_candidates = [path for path in (SRC / "skills/explainer/categories").glob("*.json")
                           if path.stem.replace("_", "") == design["category"]]
    category_rules = {}
    category_source = None
    if category_candidates:
        category_source = category_candidates[0]
        category = Category.model_validate(read_json(category_source))
        category_rules = category.model_dump(exclude={"channel", "required_hashtags"})
    duration = (cfg.get("outro") or {}).get("start", 0) + (cfg.get("outro") or {}).get("dur", 0)
    duration = duration or float(script.get("target_minutes", 10)) * 60
    # Apply account and episode duration before choosing a default format.
    effective_duration = duration_seconds
    effective_format = format_id or script.get("format_id")
    duration_source = "episode argument" if duration_seconds is not None else None
    format_source = "episode argument" if format_id else ("assets/script.json:format_id" if script.get("format_id") else None)
    for label, data in (("account", account), ("episode", episode)):
        if data is not None:
            validated = Overrides.model_validate(data)
            if validated.duration_seconds is not None:
                effective_duration, duration_source = validated.duration_seconds, label
            if validated.format_id is not None:
                effective_format, format_source = validated.format_id, label
    explicit_duration = effective_duration is not None
    legacy_source = preserve_source_format and not effective_format and not explicit_duration
    if legacy_source:
        duration, duration_source = _recorded_duration(production, cfg, script)
        selected_format = "documental-existente"
        format_source = "existing source without declared format"
    else:
        selected_format = effective_format or select_format(effective_duration if explicit_duration else duration)
        if preserve_source_format and format_source == "assets/script.json:format_id" and not explicit_duration:
            duration, duration_source = _recorded_duration(production, cfg, script)
    selected_duration = effective_duration if explicit_duration else duration
    if effective_format and not explicit_duration and effective_format != "documental-largo" and (not preserve_source_format or format_source != "assets/script.json:format_id"):
        selected_duration = load_format(effective_format).duration_seconds.default
    result = {"schema": "nexa.edition/1", "production_id": script.get("id", production.name),
              "category": design["category"], "category_rules": category_rules,
              "design_id": design_id, "style_id": cfg.get("style_id"),
              "format_id": selected_format, "duration_seconds": selected_duration,
              "locale": market.locale, "source_locale": "es-419", "source_revision": _source_revision(production),
              "revision": revision, "persona_id": persona.persona_id, "persona": persona.model_dump(by_alias=True),
              "identity_status": identity.status, "expression": identity.expression.model_dump(by_alias=True),
              "channel": identity.channel.model_dump(exclude_none=True), "voice": identity.voice.model_dump(exclude_none=True),
              "transcription": {"language": market.whisper, "tts_language": market.tts, "initial_prompt": market.transcription_prompt},
              "lexicon": {}, "outro": {**identity.texts.outro.model_dump(), "use": visual_outro["use"], "audio": "", "audio_scope": "kit"}}
    provenance = {}
    _provenance(result, "core defaults", "", provenance)
    for key in ("persona", "persona_id"):
        _provenance(result[key], "identity/persona.json", key, provenance)
    identity_source = f"identity/markets/{market.locale}.json"
    for key in ("voice", "channel", "expression", "identity_status", "outro"):
        _provenance(result[key], identity_source, key, provenance)
    provenance["outro.use"] = f"explainer-kit/designs/{design_id}/design.json:defaults.outro.use"
    provenance["outro.audio_scope"] = "core audio convention"
    _provenance(result["transcription"], "core/markets/markets.json", "transcription", provenance)
    provenance["category"] = "design.json"
    if category_source:
        _provenance(category_rules, str(category_source.relative_to(SRC)), "category_rules", provenance)
    provenance["design_id"] = "assets/config.json"
    provenance["format_id"] = format_source or "core default"
    provenance["duration_seconds"] = duration_source or ("format default" if effective_format and effective_format != "documental-largo" else "assets/config.json:outro or assets/script.json:target_minutes")
    if identity.voice.lexicon_ref:
        lexicon_path = (definition / identity.voice.lexicon_ref).resolve()
        if not lexicon_path.is_relative_to(definition.resolve()):
            raise ValueError("Lexicon path escapes design definition")
        result["lexicon"] = read_json(lexicon_path)["terms"]
        _provenance(result["lexicon"], identity.voice.lexicon_ref, "lexicon", provenance)
    # Layer allowlists are closed: account and episode cannot change locale, paths or arbitrary keys.
    for label, data in (("account", account), ("episode", episode)):
        if data is None:
            continue
        overlay = Overrides.model_validate(data).model_dump(exclude_none=True)
        result = merge(result, overlay)
        _provenance(overlay, label, "", provenance)
    if result["channel"]["language"] != market.locale:
        raise ValueError("Account/episode channel must belong to the edition market")
    result["format"] = load_format(result["format_id"]).model_dump(by_alias=True)
    result["duration_seconds"] = validate_duration(result["duration_seconds"], load_format(result["format_id"]))
    if result["format_id"] not in design_formats.supports:
        raise ValueError(f"Design {design_id} does not support format {result['format_id']}")
    result["design_format"] = design_formats.supports[result["format_id"]].model_dump()
    _provenance(result["format"], f"skills/formats/{result['format_id']}.json", "format", provenance)
    _provenance(result["design_format"], "formats.json", "design_format", provenance)
    # Read the recorded original closure text verbatim; other locales never inherit it.
    if market.locale == "es-419":
        for key in type(identity.texts.outro).model_fields:
            if key in (cfg.get("outro") or {}) and not (account or {}).get("outro") and not (episode or {}).get("outro"):
                result["outro"][key] = cfg["outro"][key]
                provenance[f"outro.{key}"] = "assets/config.json:outro"
    result["outro"]["channel"] = result["channel"]["name"].upper()
    result["outro"]["handle"] = result["channel"]["handle"]
    for key in ("channel", "handle"):
        provenance[f"outro.{key}"] = provenance["channel.name" if key == "channel" else "channel.handle"]
    voice = result["voice"]["voice"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", voice):
        raise ValueError("Invalid voice identifier")
    outro_audio = f"outro/voices/{market.locale}/{voice}.mp3"
    # Original ES uses the existing approved audio if a locale-specific version is absent.
    if market.locale == "es-419" and not (KIT / outro_audio).is_file():
        outro_audio = f"outro/voices/{voice.lower()}.mp3"
    result["outro"]["audio"] = outro_audio
    if identity.texts.outro_spoken is not None:
        result["outro_spoken"] = identity.texts.outro_spoken.model_dump()
        _provenance(result["outro_spoken"], f"design-definitions/{design_id}/identity/markets/{market.locale}.json:texts.outro_spoken", "outro_spoken", provenance)
    provenance["outro.audio"] = "core locale/voice audio convention (legacy ES compatibility)"
    prefix = "assets" if market.locale == "es-419" else f"languages/{market.locale}/revisions/{revision}"
    result["paths"] = {key:f"{prefix}/{filename}" for key,filename in {
        "script":"script.json", "storyboard":"storyboard.json", "lyrics":"lyrics.json", "audio":"song.mp3",
        "audio_with_outro":"song-with-outro.mp3", "config":"config.json", "publish":"publish.json"}.items()}
    if market.locale == "es-419":
        result["paths"]["publish"] = "publish.json"
    _provenance(result["paths"], "core original layout" if market.locale == "es-419" else "core edition layout", "paths", provenance)
    strategies = deepcopy(read_json(SRC / "skills/explainer/active.json")["_default"])
    if cfg.get("narrative_id"):
        strategies["narrative"] = cfg["narrative_id"]
    result["strategies"] = {**strategies, "title_level": cfg.get("title_level", "alto")}
    _provenance(strategies, "skills/explainer/active.json:_default", "strategies", provenance)
    if "narrative" in strategies:
        provenance["strategies.narrative"] = "assets/config.json:narrative_id"
    provenance["strategies.title_level"] = "assets/config.json:title_level"
    variant = result["format"].get("narrative", {}).get("strategy_variant")
    result["resolved_strategies"] = {piece:resolve_strategy(piece, id, market.locale, variant=variant) for piece,id in strategies.items()}
    for piece, strategy in result["resolved_strategies"].items():
        _provenance(strategy, strategy["source"], f"resolved_strategies.{piece}", provenance)
    result["localizable"] = localizable.model_dump(by_alias=True)
    _provenance(result["localizable"], "localizable.json", "localizable", provenance)
    result["provenance"] = provenance
    return Edition.model_validate(result)


def write_edition(production, locale="es-419", **kwargs) -> Path:
    edition = build_edition(production, locale, **kwargs)
    root = Path(production).resolve()
    path = root / ("edition.json" if edition.locale == edition.source_locale else f"languages/{edition.locale}/revisions/{edition.revision}/edition.json")
    serialized = edition.model_dump_json(by_alias=True, indent=2) + "\n"
    # Traverse directories by descriptor without following symlinks, including
    # under concurrent changes. Never overwrite an existing frozen revision.
    parts = path.relative_to(root).parts
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            try:
                os.mkdir(part, dir_fd=directory)
            except FileExistsError:
                pass
            try:
                child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            except OSError as exc:
                raise ValueError("Edition path escapes production or contains a symlink") from exc
            os.close(directory)
            directory = child
        try:
            fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644, dir_fd=directory)
        except FileExistsError:
            try:
                fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
                with os.fdopen(fd, "r", encoding="utf-8") as existing:
                    same = existing.read() == serialized
            except OSError as exc:
                raise ValueError("Edition path escapes production or contains a symlink") from exc
            if same:
                return path
            raise FileExistsError(f"Edition is frozen; choose a new revision: {path}")
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            output.write(serialized)
    finally:
        os.close(directory)
    return path


def load_edition(path: str | Path) -> Edition:
    return Edition.model_validate(read_json(path))
