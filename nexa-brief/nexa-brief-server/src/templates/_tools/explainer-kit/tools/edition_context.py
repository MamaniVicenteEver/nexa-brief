"""Contexto de edición para las herramientas del kit.

Una edición (`edition.json`, schema `nexa.edition/1`) es la única entrada que necesita una
herramienta para trabajar en otro idioma: idioma, códigos de Whisper/TTS, voz, dirección de voz,
ritmo, léxico de pronunciación, textos y audio del cierre y rutas de la revisión.

Sin edición (ni `--edition` ni `NEXA_EDITION`) las herramientas se comportan como siempre.
Este módulo solo lee JSON: no depende del backend para que el kit siga siendo independiente.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import sys

KIT = pathlib.Path(__file__).resolve().parents[1]

LANGUAGE_NAMES = {"es": "Spanish", "en": "English", "pt": "Portuguese"}


def pop_edition_arg(argv: list[str]) -> tuple[str | None, list[str]]:
    """Quita `--edition X` / `--edition=X` de argv y devuelve (ruta, resto)."""
    out, path, skip = [], None, False
    for i, arg in enumerate(argv):
        if skip:
            skip = False
            continue
        if arg == "--edition":
            if i + 1 >= len(argv):
                raise SystemExit("--edition requiere la ruta de edition.json")
            path, skip = argv[i + 1], True
        elif arg.startswith("--edition="):
            path = arg.split("=", 1)[1]
        else:
            out.append(arg)
    return path, out


def production_of(edition_path: pathlib.Path) -> pathlib.Path:
    """Carpeta de la producción: edition.json vive en la raíz (idioma original) o en
    languages/<locale>/revisions/<rev>/ (otros idiomas). NEXA_PRODUCTION_DIR tiene prioridad."""
    if os.environ.get("NEXA_PRODUCTION_DIR"):
        return pathlib.Path(os.environ["NEXA_PRODUCTION_DIR"]).resolve()
    parent = edition_path.parent
    if parent.parent.name == "revisions" and parent.parents[2].name == "languages":
        return parent.parents[3]
    return parent


class EditionContext:
    def __init__(self, path: str | os.PathLike):
        self.path = pathlib.Path(path).resolve()
        self.data = json.loads(self.path.read_text(encoding="utf-8"))
        if self.data.get("schema") != "nexa.edition/1":
            raise SystemExit(f"{self.path}: no es una edición nexa.edition/1")
        self.production = production_of(self.path)

    # idioma
    @property
    def locale(self) -> str:
        return self.data["locale"]

    @property
    def is_source(self) -> bool:
        return self.locale == self.data.get("source_locale", "es-419")

    @property
    def whisper_language(self) -> str:
        return (self.data.get("transcription") or {}).get("language") or self.locale.split("-")[0]

    @property
    def language_name(self) -> str:
        return LANGUAGE_NAMES.get(self.whisper_language, self.whisper_language)

    def initial_prompt(self, names: str) -> str:
        template = (self.data.get("transcription") or {}).get("initial_prompt") or "{names}"
        return template.replace("{names}", names)

    # voz
    @property
    def voice(self) -> dict:
        return self.data["voice"]

    @property
    def direction(self) -> str:
        v = self.voice
        return v.get("direction") or v.get("base") or ""

    @property
    def target_wpm(self) -> int:
        lo, hi = self.voice.get("target_wpm") or (130, 130)
        return int(round((lo + hi) / 2))

    @property
    def lexicon(self) -> dict[str, str]:
        return self.data.get("lexicon") or {}

    def speakable(self, text: str) -> str:
        """Aplica el léxico de pronunciación solo al texto que va al TTS (palabra completa)."""
        for term in sorted(self.lexicon, key=len, reverse=True):
            text = re.sub(rf"(?<![\w-]){re.escape(term)}(?![\w-])", self.lexicon[term], text)
        return text

    # cierre
    @property
    def outro(self) -> dict:
        return self.data.get("outro") or {}

    @property
    def outro_spoken(self) -> dict | None:
        return self.data.get("outro_spoken")

    def outro_audio(self) -> pathlib.Path | None:
        rel = self.outro.get("audio")
        return (KIT / rel) if rel else None

    # rutas
    def rel(self, key: str) -> str:
        return self.data["paths"][key]

    def path_of(self, key: str) -> pathlib.Path:
        staging = os.environ.get("NEXA_EDITION_STAGING_DIR")
        if staging:
            root = pathlib.Path(staging).absolute()
            prefix = f"languages/{self.locale}/revisions/{self.data['revision']}/"
            relative = self.rel(key)
            if (root != root.resolve() or root != self.path.parent or self.is_source
                    or not relative.startswith(prefix) or "/" in relative[len(prefix):]
                    or "\\" in relative or ".." in pathlib.PurePosixPath(relative).parts):
                raise SystemExit("staging de edición inválido")
            target = root / relative[len(prefix):]
            if target.is_symlink():
                raise SystemExit("el staging no admite enlaces simbólicos")
            return target
        p = (self.production / self.rel(key)).resolve()
        if self.production not in p.parents:
            raise SystemExit(f"ruta fuera de la producción: {key}")
        return p


def load(path: str | os.PathLike | None = None) -> EditionContext | None:
    path = path or os.environ.get("NEXA_EDITION")
    return EditionContext(path) if path else None


def from_argv() -> EditionContext | None:
    """Lee `--edition` de sys.argv (y lo quita) o NEXA_EDITION."""
    path, rest = pop_edition_arg(sys.argv[1:])
    sys.argv[1:] = rest
    return load(path)


# números → palabras (para comparar lo que transcribe Whisper, que usa cifras, con el guion)
_EN_U = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
         "sixteen seventeen eighteen nineteen").split()
_EN_T = {2: "twenty", 3: "thirty", 4: "forty", 5: "fifty", 6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety"}


def en_num(n: int) -> str:
    if n < 20:
        return _EN_U[n]
    if n < 100:
        return _EN_T[n // 10] + ("" if n % 10 == 0 else " " + _EN_U[n % 10])
    if n < 1000:
        return _EN_U[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + en_num(n % 100))
    for size, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand")):
        if n >= size:
            k, r = divmod(n, size)
            return en_num(k) + " " + name + ("" if r == 0 else " " + en_num(r))
    return str(n)


_PT_U = ("zero um dois tres quatro cinco seis sete oito nove dez onze doze treze quatorze quinze "
         "dezesseis dezessete dezoito dezenove").split()
_PT_T = {2: "vinte", 3: "trinta", 4: "quarenta", 5: "cinquenta", 6: "sessenta", 7: "setenta", 8: "oitenta", 9: "noventa"}
_PT_C = {1: "cento", 2: "duzentos", 3: "trezentos", 4: "quatrocentos", 5: "quinhentos", 6: "seiscentos",
         7: "setecentos", 8: "oitocentos", 9: "novecentos"}


def pt_num(n: int) -> str:
    """Sin acentos (la comparación normaliza): 'tres', 'milhoes'."""
    if n < 20:
        return _PT_U[n]
    if n < 100:
        return _PT_T[n // 10] + ("" if n % 10 == 0 else " e " + _PT_U[n % 10])
    if n < 1000:
        if n == 100:
            return "cem"
        return _PT_C[n // 100] + ("" if n % 100 == 0 else " e " + pt_num(n % 100))
    if n < 10**6:
        k, r = divmod(n, 1000)
        head = "mil" if k == 1 else pt_num(k) + " mil"
        return head + ("" if r == 0 else (" e " if r < 100 or r % 100 == 0 else " ") + pt_num(r))
    for size, one, many in ((10**9, "um bilhao", "bilhoes"), (10**6, "um milhao", "milhoes")):
        if n >= size:
            k, r = divmod(n, size)
            head = one if k == 1 else pt_num(k) + " " + many
            return head + ("" if r == 0 else " " + pt_num(r))
    return str(n)


NUMBER_WORDS = {"en": en_num, "pt": pt_num}
