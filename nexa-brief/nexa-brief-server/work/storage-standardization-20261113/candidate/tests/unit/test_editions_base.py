"""Native edition foundations, without network, synthesis or rendering."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys

import pytest
from pydantic import ValidationError

from src.core.explainer.editions.resolver import build_edition, load_edition, write_edition
from src.core.editions.formats import load_format, select_format, targets, validate_storyboard
from src.core.editions.schemas import DesignFormats, Format, IdentityMarket, Localizable, Overrides, Persona
from src.core.explainer.editions.strategies import resolve_strategy, StrategyMarket
from src.core.editions.strings import extract_strings, apply_strings
from src.core.markets import get_market, markets, normalize_locale
from src.core.metadata.language import normalize_language, pick_from_probabilities, SUPPORTED_LANGUAGES
from src.core.explainer import lengths

SERVER = Path(__file__).resolve().parents[2]
SRC = SERVER / "src"
KIT = SRC / "templates/_tools/explainer-kit"
DEFINITION = SRC / "templates/_tools/design-definitions/rough"
DEMO = SRC / "templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize(("alias", "locale", "whisper", "label"), [
    ("es", "es-419", "es", "ES"), ("en", "en-US", "en", "EN"), ("pt", "pt-BR", "pt", "PT"),
    ("EN_us", "en-US", "en", "EN"), ("pt-br", "pt-BR", "pt", "PT"), (None, "es-419", "es", "ES"),
])
def test_market_aliases_and_provider_codes(alias, locale, whisper, label):
    assert normalize_locale(alias) == locale
    market = get_market(alias)
    assert (market.locale, market.whisper, market.label) == (locale, whisper, label)
    assert market.native_name and market.tts == locale


@pytest.mark.parametrize("bad", ["fr", "en-GB", "es-ES", "../en-US"])
def test_unknown_market_is_explicit(bad):
    with pytest.raises(ValueError, match="Unsupported market"):
        get_market(bad)


def test_legacy_song_language_contract_is_unchanged():
    assert [m.locale for m in markets()] == ["es-419", "en-US", "pt-BR"]
    assert SUPPORTED_LANGUAGES == ("es", "en")
    assert normalize_language("pt-BR") is None
    assert normalize_language("es-ES") == "es"
    assert normalize_language("English") == "en"
    assert pick_from_probabilities({"es": .35, "en": .4, "pt": .9}, .6).code == "en"


@pytest.mark.parametrize("seconds", [150, 180, 195, 240])
def test_short_counts_are_duration_density_and_voice_dependent(seconds):
    plan = targets(seconds, "animado-corto", (140, 160))
    m = seconds / 60
    import math
    assert plan["segments"] == [math.floor(m * 5), math.ceil(m * 7)]
    assert plan["beats"] == plan["scenes"] == [math.floor(m * 15), math.ceil(m * 24)]
    assert plan["words"] == [math.floor(m * 140 * .95), math.ceil(m * 160 * 1.08)]
    assert plan["photos"] == plan["clips"] == plan["chapters"] == [0, 0]
    assert targets(seconds, "animado-corto", (120, 138))["words"][1] < plan["words"][1]


@pytest.mark.parametrize("seconds", [0, 149, 241, float("nan"), float("inf")])
def test_short_rejects_out_of_range_duration(seconds):
    with pytest.raises(ValueError, match="requires"):
        targets(seconds, "animado-corto")


def test_default_duration_and_data_driven_threshold():
    assert targets(None, "animado-corto")["minutes"] == 3
    assert select_format(239) == "animado-corto"
    assert select_format(240) == "documental-largo"
    assert lengths.clamp_minutes(2.5, "animado-corto") == 2.5
    assert lengths.default_minutes("animado-corto") == 3
    assert lengths.max_minutes("animado-corto") == 4
    assert lengths.chapters_range(3, "animado-corto") == (0, 0)
    assert lengths.clamp_minutes(2.5) == 5


def kit_lengths():
    spec = importlib.util.spec_from_file_location("edition_test_lengths", KIT / "tools/lengths.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_kit_and_core_formats_agree_without_changing_legacy():
    kit = kit_lengths()
    assert kit.targets(3, (130, 150), "animado-corto") == lengths.targets(3, "animado-corto", (130, 150))
    assert kit.of_script({"format_id":"animado-corto", "target_minutes":3}, wpm=(130, 150)) == targets(180, "animado-corto", (130, 150))
    legacy = read(KIT / "lengths.json")
    long = load_format("documental-largo")
    assert long.words_margin == tuple(legacy["words_margin"])
    assert kit.targets(10, (115, 130))["words"] == [1092, 1404]
    assert kit.targets(None)["legacy"]
    assert kit.of_script({"format":"short_map"})["minutes"] == 2
    assert kit.of_script({"format":"short_preparation", "target_minutes":1})["words"] == [110, 130]
    assert targets(600, "documental-largo", (115, 130))["segments"] == kit.targets(10, (115,130))["segments"]


@pytest.mark.parametrize("component", ["rough.photo", "rough.introv2", "common.clip", "common.logo", "common.tabloid"])
def test_animated_short_rejects_all_media_components(component):
    assert validate_storyboard({"beats":[{"use":component,"params":{}}]}, "animado-corto", "rough")


def test_animated_short_is_closed_and_accepts_audited_components_only():
    assert validate_storyboard({"beats":[{"use":"rough.icon","params":{"icon":"chip","tag":"API"}}]}, "animado-corto", "rough") == []
    assert validate_storyboard({"beats":[{"use":"rough.unknown","params":{}}]}, "animado-corto", "rough")
    raw = read(DEFINITION / "localizable.json")
    raw["components"]["rough.icon"]["fields"]["futureMedia"] = {"type":"media", "translate":False, "max_chars":0}
    loc = Localizable.model_validate(raw)
    assert validate_storyboard({"beats":[{"use":"rough.icon","params":{"futureMedia":"image.png"}}]}, "animado-corto", "rough", localizable=loc)


def test_all_layer_schemas_are_closed():
    for model, path in [(Persona, "identity/persona.json"), (IdentityMarket,"identity/markets/es-419.json"),
                        (DesignFormats,"formats.json"), (Localizable,"localizable.json")]:
        payload = read(DEFINITION / path)
        model.model_validate(payload)
        payload["unexpected_voice"] = {"voice":"wrong"}
        with pytest.raises(ValidationError, match="extra_forbidden"):
            model.model_validate(payload)
    data = read(SRC / "skills/formats/animado-corto.json")
    data["voice"] = {"voice":"not owned by a format"}
    with pytest.raises(ValidationError):
        Format.model_validate(data)
    with pytest.raises(ValidationError):
        Overrides.model_validate({"paths":{"script":"other.json"}})


def test_es_demo_resolves_exact_existing_voice_paths_and_texts():
    original = read(KIT / "designs/rough/design.json")
    cfg = read(DEMO / "assets/config.json")["configs"][0]
    edition = build_edition(DEMO, "es")
    voice = edition.voice.model_dump(mode="json")
    assert {k:voice[k] for k in original["voice"]} == original["voice"]
    assert voice["direction"] == original["voice"]["base"]
    for key in ("thanks","cta","support","handle","channel"):
        assert getattr(edition.outro,key) == cfg["outro"][key]
    assert edition.paths.model_dump() == {
        "script":"assets/script.json", "storyboard":"assets/storyboard.json", "lyrics":"assets/lyrics.json",
        "audio":"assets/song.mp3", "audio_with_outro":"assets/song-with-outro.mp3", "config":"assets/config.json", "publish":"publish.json"}
    assert edition.paths.audio_with_outro == cfg["audio"]["src"]
    assert edition.paths.lyrics == cfg["lyricsUrl"]
    assert edition.paths.storyboard == cfg["storyboardUrl"]
    assert edition.outro.audio == "outro/voices/sadaltager.mp3"
    assert edition.channel.name == "NodeTech" and edition.channel.handle == cfg["outro"]["handle"]
    assert edition.identity_status == "approved"
    assert edition.duration_seconds == pytest.approx(702.22)
    assert edition.strategies["narrative"] == cfg["narrative_id"]
    assert edition.strategies["title_level"] == cfg["title_level"]


@pytest.mark.parametrize(("locale", "voice"), [("en-US","Iapetus"), ("pt-BR","Orus")])
def test_native_edition_paths_identity_and_strategy_layers(locale, voice):
    edition = build_edition(DEMO, locale)
    prefix = f"languages/{locale}/revisions/rev-001/"
    assert all(value.startswith(prefix) for value in edition.paths.model_dump().values())
    assert edition.voice.voice == voice
    assert edition.identity_status == "draft"
    assert edition.transcription["language"] == get_market(locale).whisper
    assert edition.lexicon["OpenAI"]
    assert edition.outro.audio == f"outro/voices/{locale}/{voice}.mp3"
    assert edition.provenance["voice.voice"] == f"identity/markets/{locale}.json"
    assert all(strategy["market"]["locale"] == locale for strategy in edition.resolved_strategies.values())
    assert edition.source_revision == build_edition(DEMO,"es-419").source_revision


def test_override_order_provenance_and_freezing(tmp_path):
    production = tmp_path / DEMO.name
    (production / "assets").mkdir(parents=True)
    for name in ("config.json","script.json","storyboard.json"):
        shutil.copyfile(DEMO / "assets" / name, production / "assets" / name)
    path = write_edition(production,"en",account={"voice":{"target_wpm":[142,158]}},episode={"voice":{"target_wpm":[145,155]}})
    frozen = load_edition(path)
    assert frozen.voice.target_wpm == (145,155)
    assert frozen.provenance["voice.target_wpm"] == "episode"
    assert path == production / "languages/en-US/revisions/rev-001/edition.json"
    original = frozen.source_revision
    script = read(production / "assets/script.json")
    script["title"] = "Modified source"
    (production / "assets/script.json").write_text(json.dumps(script))
    assert build_edition(production,"en").source_revision != original
    assert load_edition(path).source_revision == original
    with pytest.raises(FileExistsError, match="frozen"):
        write_edition(production,"en")


def test_short_resolution_uses_explicit_duration_and_draft_capability():
    edition = build_edition(DEMO,"en",duration_seconds=180)
    assert edition.format_id == "animado-corto"
    assert edition.design_format.status == "draft"
    assert edition.resolved_strategies["narrative"]["effective"]["native_instructions"]["format_variant"]
    assert build_edition(DEMO,"en",format_id="animado-corto").duration_seconds == 180
    with pytest.raises(ValueError, match="requires"):
        build_edition(DEMO,"en",duration_seconds=240)
    assert build_edition(DEMO,"en",format_id="animado-corto",duration_seconds=240).duration_seconds == 240


def test_short_format_selected_from_source_duration(tmp_path):
    production = tmp_path / "example"
    (production / "assets").mkdir(parents=True)
    for name in ("config.json", "script.json"):
        shutil.copyfile(DEMO / "assets" / name, production / "assets" / name)
    path = production / "assets/config.json"
    config = read(path)
    config["configs"][0]["outro"].update(start=170, dur=10)
    path.write_text(json.dumps(config))
    edition = build_edition(production, "en")
    assert (edition.format_id, edition.duration_seconds) == ("animado-corto", 180)


def test_edition_schema_rejects_paths_outside_production_and_foreign_account_market():
    edition = build_edition(DEMO,"en")
    raw = edition.model_dump(by_alias=True)
    raw["paths"]["script"] = "../assets/script.json"
    with pytest.raises(ValidationError, match="relative"):
        type(edition).model_validate(raw)
    with pytest.raises(ValueError, match="edition market"):
        build_edition(DEMO,"en",account={"channel":{"name":"NodeTech", "handle":"example", "language":"pt-BR"}})


def test_provenance_covers_every_effective_leaf_and_category_does_not_change_brand():
    edition = build_edition(DEMO,"en")
    def leaves(value, prefix=""):
        if isinstance(value,dict):
            for key, child in value.items():
                if key != "provenance":
                    yield from leaves(child,f"{prefix}.{key}" if prefix else key)
        else:
            yield prefix
    assert set(leaves(edition.model_dump(by_alias=True,exclude_none=True))) <= edition.provenance.keys()
    assert edition.category_rules["id"] == "node_tech"
    assert "channel" not in edition.category_rules
    assert edition.channel.name == "NodeTech"


def test_other_designs_without_identity_keep_original_contract(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets/config.json").write_text('{"design":"binary"}')
    (tmp_path / "assets/script.json").write_text('{"id":"legacy","design":"binary"}')
    with pytest.raises(ValueError, match="only its original language"):
        build_edition(tmp_path, "en")


def test_cli_is_read_only_and_outputs_the_resolved_edition():
    before = {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in (DEMO / "assets").glob("*.json")}
    result = subprocess.run([sys.executable,"-m","src.core.explainer.editions","show","--production",str(DEMO),"--locale","en-US"], cwd=SERVER, capture_output=True,text=True,check=True)
    resolved = json.loads(result.stdout)
    assert resolved["schema"] == "nexa.edition/1"
    assert resolved["voice"]["voice"] == "Iapetus"
    assert {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in before} == before


def test_demo_string_round_trip_is_identical_and_protects_media():
    script, storyboard = read(DEMO / "assets/script.json"), read(DEMO / "assets/storyboard.json")
    spec = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    strings = extract_strings(script, storyboard, spec)
    assert len(strings) > 200
    assert strings["/storyboard/beats/0/params/accent"]["type"] == "substring:text"
    assert not any(key.endswith("/src") or key.endswith("/mode") for key in strings)
    assert apply_strings(script,storyboard,strings,spec) == (script,storyboard)
    with pytest.raises(ValueError,match="protected"):
        apply_strings(script,storyboard,{"/storyboard/beats/0/params/src":"wrong.png"},spec)
    assert strings["/script/segments/0/text"]["type"] == "narration"


def test_nested_text_union_limits_and_substrings():
    spec = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    script = {"segments":[{"id":"s1","text":"Hello world"}]}
    sb = {"beats":[
        {"use":"rough.notemark","params":{"marks":["security",{"text":"legal","at":"@Hello"}],"seed":"fixed"}},
        {"use":"rough.compare","params":{"small":{"label":"Before","value":"4 KB"},"big":{"label":"Now","value":"8 GB"}}},
        {"use":"rough.introv1","params":{"text":"Hello world","highlight":"world"}}]}
    strings = extract_strings(script,sb,spec)
    assert "/storyboard/beats/0/params/marks/1/text" in strings
    assert "/storyboard/beats/0/params/marks/1" not in strings
    assert "/storyboard/beats/1/params/small/value" in strings
    assert apply_strings(script,sb,strings,spec) == (script,sb)
    changed = {"/storyboard/beats/0/params/marks/1/text":"jurídico"}
    result = apply_strings(script,sb,changed,spec)[1]
    assert result["beats"][0]["params"]["marks"][1] == {"text":"jurídico","at":"@Hello"}
    with pytest.raises(ValueError, match="substring"):
        apply_strings(script,sb,{"/storyboard/beats/2/params/highlight":"missing"},spec)
    with pytest.raises(ValueError, match="exceeds"):
        apply_strings(script,sb,{"/storyboard/beats/0/params/marks/0":"x"*61},spec)


def test_localizable_covers_catalogs_and_each_actual_runtime_registration():
    node = shutil.which("node")
    assert node, "Node is required to verify the actual component registrations"
    files = read(KIT / "designs/rough/design.json")["scripts"]
    code = r'''
const fs=require('fs'), vm=require('vm');
global.window=global; global.document={querySelector:()=>({}),currentScript:{src:'https://example.invalid/design.js'}, createElement:()=>({getContext:()=>({})})};
global.Kit={registry:new Map(),fonts:new Set(),rough:{SKETCHES:{}},family(){},register(spec){this.registry.set(spec.name,spec);}};
for(const path of JSON.parse(process.argv[1])) vm.runInThisContext(fs.readFileSync(path,'utf8'),{filename:path});
console.log(JSON.stringify([...Kit.registry.values()].map(({name,params})=>({name,params}))));
'''
    paths = [str(KIT / f) for f in files if not f.startswith("vendor/")]
    paths += [str(p) for p in (DEMO / "assets/components").glob("*.js")]
    library_names = {"rough.layoffMail", "rough.codeReview", "rough.careerLadder"}
    library = {e["name"]: e for e in read(KIT / "component-library.json")["components"] if e["name"] in library_names}
    paths += [str(KIT / p) for p in ("component-library/sources/rough/rough-layoff-mail.js", "component-library/sources/rough/rough-code-review.js", "component-library/sources/rough/rough-career-ladder.js")]
    result = subprocess.run([node,"-e",code,json.dumps(paths)],capture_output=True,text=True,timeout=10)
    assert result.returncode == 0, result.stderr
    actual = {entry["name"]:entry for entry in json.loads(result.stdout)}
    contract = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    assert set(actual) == set(contract.components)
    defaults = read(DEFINITION / "localizable-defaults.json")["components"]
    # Fail if a new visible text default is added to a real component but not
    # audited: otherwise it could silently reappear in the source language.
    expected = {}
    for name, component in actual.items():
        fields = contract.components[name].fields
        for key, param in component["params"].items():
            value = param.get("default")
            if value and any(rule.translate and (pattern == key or pattern.startswith(key + ".")) for pattern, rule in fields.items()):
                expected.setdefault(name, {})[key] = value
    assert defaults == expected
    catalog = {e["name"]:e for e in read(DEFINITION / "catalog.json")["entries"]}
    catalog.update({e["name"]:e for e in read(DEMO / "assets/components/catalog.json")["comps"]})
    catalog.update(library)
    assert set(catalog) == set(actual)
    for name, component in actual.items():
        declared = contract.components[name]
        assert set(component["params"]) == set(catalog[name]["params"])
        for field, rule in component["params"].items():
            if rule["type"] in ("string","enum","icon","image","video"):
                assert field in declared.fields, (name,field)
            if rule["type"] in ("image","video"):
                assert declared.fields[field].type == "media"
            if rule["type"] in ("enum","icon"):
                assert not declared.fields[field].translate
        source = declared.source
        assert (DEMO / source.removeprefix("episode:") if source.startswith("episode:") else KIT / source).is_file()


@pytest.mark.parametrize("locale", ["en-US","pt-BR"])
def test_native_layers_cover_every_strategy_used_by_demo_and_defaults(locale):
    cfg = read(DEMO / "assets/config.json")["configs"][0]
    chosen = {**read(SRC / "skills/explainer/active.json")["_default"],"narrative":cfg["narrative_id"]}
    for piece, strategy_id in chosen.items():
        resolved = resolve_strategy(piece,strategy_id,locale)
        native = StrategyMarket.model_validate(resolved["market"])
        assert native.status == "draft" and native.templates and native.examples and native.conventions and native.sounds_false
        assert resolved["universal"]["id"] == strategy_id
        assert resolved["effective"]["native_instructions"]["intent"] == native.intent
    assert "alto" in resolve_strategy("narrative",cfg["narrative_id"],locale)["effective"]["title"]["levels"]


def test_missing_strategy_market_never_falls_back_to_spanish(tmp_path):
    folder = tmp_path / "title"
    folder.mkdir()
    (folder / "example.json").write_text('{"id":"example","name":"Texto fuente español"}')
    with pytest.raises(ValueError,match="Missing market strategy layer.*en-US"):
        resolve_strategy("title","example","en-US",root=tmp_path)
    assert resolve_strategy("title","example","es",root=tmp_path)["effective"]["name"] == "Texto fuente español"


def test_identity_migration_preserves_both_historical_outro_variants():
    identity = IdentityMarket.model_validate(read(DEFINITION / "identity/markets/es-419.json"))
    design = read(KIT / "designs/rough/design.json")
    assert identity.texts.visual_outro_defaults.model_dump() == {key:design["defaults"]["outro"][key] for key in type(identity.texts.visual_outro_defaults).model_fields}
    assert identity.texts.outro.model_dump() == read(KIT / "outro/channels.json")["nodetech"]


def test_account_episode_duration_selects_format_and_tracks_source():
    edition = build_edition(DEMO, "en", account={"duration_seconds": 180})
    assert (edition.format_id, edition.duration_seconds) == ("animado-corto", 180)
    assert edition.provenance["duration_seconds"] == "account"
    edition = build_edition(DEMO, "en", account={"duration_seconds": 180}, episode={"duration_seconds": 600})
    assert (edition.format_id, edition.duration_seconds) == ("documental-largo", 600)
    assert edition.provenance["duration_seconds"] == "episode"
    assert build_edition(DEMO, "en", account={"format_id": "animado-corto"}).duration_seconds == 180


def test_write_edition_rejects_symlink_escape(tmp_path):
    production = tmp_path / "production"
    (production / "assets").mkdir(parents=True)
    for name in ("config.json", "script.json", "storyboard.json"):
        shutil.copyfile(DEMO / "assets" / name, production / "assets" / name)
    outside = tmp_path / "outside"
    outside.mkdir()
    (production / "languages").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match="escapes production"):
        write_edition(production, "en")
    assert not list(outside.iterdir())


def test_unsafe_voice_override_is_not_a_path():
    with pytest.raises(ValueError, match="voice identifier"):
        build_edition(DEMO, "en", episode={"voice": {"voice": "../../outside"}})


# narrate.py, transcribe.py y outro.py ya leen la edición (tests/unit/test_kit_editions.py);
# kit.py trabaja por id de video sobre el original y sigue rechazando una edición.
@pytest.mark.parametrize("tool,args", [
    ("kit.py", ["preview", "missing", "--force"]),
])
def test_legacy_tools_fail_closed_when_edition_selected(tool, args, tmp_path):
    import os
    env = {**os.environ, "NEXA_EDITION": str(tmp_path / "edition.json")}
    result = subprocess.run([sys.executable, str(KIT / "tools" / tool), *args], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode != 0
    assert "no admite ediciones" in result.stderr
    assert not list(tmp_path.iterdir())


def test_rejects_traversal_in_design_and_strategy_identifiers(tmp_path):
    with pytest.raises(ValueError, match="strategy identifier"):
        resolve_strategy("..", "example", "es", root=tmp_path)
    with pytest.raises(ValueError, match="design id"):
        validate_storyboard({"beats": []}, "animado-corto", design_id="..")


def test_amazon_components_localize_text_but_keep_technical_fields():
    spec = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    script = {"segments": []}
    original = {"beats": [
        {"use": "rough.layoffMail", "params": {"time": "28 OCT", "from": "RR. HH.", "subject": "Aviso sobre tu puesto", "stamp": "PUESTO ELIMINADO", "stampAt": 2.6, "label": "AMAZON", "badge": "×250"}},
        {"use": "rough.careerLadder", "params": {"rungs": ["PRIMER EMPLEO", "LÍDER"], "dropAt": -1, "title": "JÓVENES", "who": "23 años"}},
        {"use": "rough.codeReview", "params": {"mode": "review", "header": "cobrar.js", "lines": ["function cobrar(p) {", "  return enviar(p)", "}"], "who": "REVISAR", "bad": 1, "reviewAt": 2.6, "note": "persona"}},
    ]}
    values = extract_strings(script, original, spec)
    assert {"/storyboard/beats/0/params/subject", "/storyboard/beats/1/params/rungs/0", "/storyboard/beats/2/params/lines/1", "/storyboard/beats/2/params/header"} <= values.keys()
    assert not any(key.endswith(("/stampAt", "/dropAt", "/bad", "/reviewAt", "/mode")) for key in values)
    changes = {"/storyboard/beats/0/params/subject": "Notice about your role", "/storyboard/beats/1/params/rungs/0": "FIRST JOB", "/storyboard/beats/2/params/lines/1": "  return send(p)"}
    result = apply_strings(script, original, changes, spec)[1]
    assert result["beats"][0]["params"]["stampAt"] == 2.6
    assert result["beats"][1]["params"]["dropAt"] == -1
    assert result["beats"][2]["params"]["lines"] == ["function cobrar(p) {", "  return send(p)", "}"]
    assert result["beats"][2]["params"]["reviewAt"] == 2.6
    assert result["beats"][2]["params"]["mode"] == "review"
    with pytest.raises(ValueError, match="protected"):
        apply_strings(script, original, {"/storyboard/beats/2/params/mode": "ai"}, spec)
    with pytest.raises(ValueError, match="exceeds"):
        apply_strings(script, original, {"/storyboard/beats/0/params/subject": "x" * 61}, spec)


def test_visible_component_defaults_are_materialized_without_changing_source():
    from src.core.explainer.editions.text_defaults import materialize
    spec = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    source = {"beats": [
        {"use": "rough.outrov1", "params": {"likeAt": 4.54}},
        {"use": "rough.layoffMail", "params": {"subject": "Ya no trabajas aquí", "stampAt": 2.6}},
        {"use": "rough.careerLadder", "params": {"rungs": [], "dropAt": -1}},
        {"use": "rough.codeReview", "params": {"mode": "ai"}},
    ]}
    original = deepcopy(source)
    result, inserted = materialize(source, spec, manifest_path=DEFINITION / "localizable-defaults.json")
    strings = extract_strings({"segments": []}, result, spec)
    assert source == original
    assert strings["/storyboard/beats/0/params/thanks"]["text"] == "GRACIAS POR VER"
    assert strings["/storyboard/beats/0/params/cta"]["text"] == "SUSCRÍBETE"
    assert strings["/storyboard/beats/1/params/subject"]["text"] == "Ya no trabajas aquí"
    assert result["beats"][2]["params"]["rungs"] == ["PRIMER EMPLEO", "SENIOR"]
    assert "/storyboard/beats/3/params/lines/0" in strings
    assert (0, "thanks") in inserted and (1, "subject") not in inserted
    assert result["beats"][0]["params"]["likeAt"] == 4.54
    with pytest.raises(ValueError, match="Falta auditar"):
        materialize(source, spec, manifest_path=DEFINITION / "does-not-exist.json")


def test_changed_episode_component_is_rejected_before_generation(tmp_path, monkeypatch):
    from src.core.explainer.editions import text_defaults
    spec = Localizable.model_validate(read(DEFINITION / "localizable.json"))
    monkeypatch.setattr(text_defaults, "_DEFINITIONS", DEFINITION.parent)
    episode = tmp_path / "episode"
    folder = episode / "assets/components"
    folder.mkdir(parents=True)
    audited = KIT / "component-library/sources/rough/rough-layoff-mail.js"
    target = folder / audited.name
    target.write_bytes(audited.read_bytes())
    board = {"beats": [{"use": "rough.layoffMail", "params": {}}]}
    text_defaults.materialize(board, spec, production=episode)
    target.write_bytes(target.read_bytes() + b"\n// changed default")
    with pytest.raises(ValueError, match="difiere de su contrato auditado"):
        text_defaults.materialize(board, spec, production=episode)
