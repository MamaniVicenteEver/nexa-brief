from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TextEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str
    type: str = "label"
    max_chars: int = Field(default=2400, gt=0)
    metadata: dict = Field(default_factory=dict)
    substring_of: str | None = None
    preserve_names: list[str] = Field(default_factory=list)
    check_facts: bool = True


class TextTable(BaseModel):
    schema_version: int = 1
    source_locale: str
    source_revision: str
    entries: dict[str, TextEntry]

    @property
    def content_hash(self) -> str:
        value = json.dumps(self.model_dump(), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def normalized(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


def tokens(text: str) -> list[str]:
    # STT corrections may split "wouldn't" into "wouldn t". Compare those
    # orthographic forms equally without altering the archived words/timestamps.
    return re.findall(r"[\w]+", normalized(text))


# Cardinal values used for factual comparison. Spelling and grouping can change
# across markets; 20 million, vinte milhões and veinte millones denote one fact.
_SMALL = {}
for words in (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
    "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve",
    "zero um dois tres quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete dezoito dezenove",
):
    _SMALL.update({word: i for i, word in enumerate(words.split())})
_SMALL.update(un=1, una=1, uma=1, duas=2, quatorze=14, veintiun=21)
for prefix, words in ((20, "veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve"),):
    _SMALL.update({w: prefix + i for i, w in enumerate(words.split())})
for words in ("twenty thirty forty fifty sixty seventy eighty ninety", "veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa", "vinte trinta quarenta cinquenta sessenta setenta oitenta noventa"):
    _SMALL.update({w: 20 + 10 * i for i, w in enumerate(words.split())})
_SMALL.update(cien=100, ciento=100, cem=100, cento=100, doscientos=200, duzentos=200,
              trescientos=300, trezentos=300, cuatrocientos=400, quatrocentos=400,
              quinientos=500, quinhentos=500, seiscientos=600, seiscentos=600,
              setecientos=700, setecentos=700, ochocientos=800, oitocentos=800,
              novecientos=900, novecentos=900)
_SMALL.update(doscientas=200, trescientas=300, cuatrocientas=400, quinientas=500,
              seiscientas=600, setecientas=700, ochocientas=800, novecientas=900)
# Ordinals used in dates ("May thirteenth", "primeiro de maio", "primero de mayo").
_ORDINALS = {w: i + 1 for i, w in enumerate(
    "first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth "
    "fifteenth sixteenth seventeenth eighteenth nineteenth".split())}
_ORDINALS.update({w: 20 + 10 * i for i, w in enumerate("twentieth thirtieth fortieth fiftieth sixtieth seventieth eightieth ninetieth".split())})
_ORDINALS.update(primero=1, primer=1, primeiro=1)
_SCALES = {"thousand": 1000, "mil": 1000, "million": 1000000, "millions": 1000000,
           "millon": 1000000, "millones": 1000000, "milhao": 1000000, "milhoes": 1000000,
           "billion": 1000000000, "billions": 1000000000, "bilhao": 1000000000, "bilhoes": 1000000000}


_EN_UNITS = "one two three four five six seven eight nine".split()
_EN_TEENS = "ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_EN_TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split()
_EN_TAIL = (r"(?:(?:" + "|".join(_EN_TENS) + r")(?:[ -](?:" + "|".join(_EN_UNITS) + r"))?|"
            + "|".join(_EN_TEENS) + r"|oh[ -](?:" + "|".join(_EN_UNITS) + r"))")


def _en_two(word: str):
    parts = re.split(r"[ -]", word)
    if len(parts) == 1:
        if parts[0] in _EN_TEENS:
            return _EN_TEENS.index(parts[0]) + 10
        if parts[0] in _EN_TENS:
            return _EN_TENS.index(parts[0]) * 10 + 20
        return None
    if parts[0] == "oh" and parts[1] in _EN_UNITS:
        return _EN_UNITS.index(parts[1]) + 1
    if parts[0] in _EN_TENS and parts[1] in _EN_UNITS:
        return _EN_TENS.index(parts[0]) * 10 + 20 + _EN_UNITS.index(parts[1]) + 1
    return None


def _en_years(text: str) -> str:
    """English spoken years: "twenty twenty-five" -> 2025, "nineteen ninety" -> 1990."""
    def repl(m):
        b = _en_two(m[2])
        return str((19 if m[1] == "nineteen" else 20) * 100 + b) if b is not None else m[0]
    return re.sub(r"\b(nineteen|twenty)[ -](" + _EN_TAIL + r")\b", repl, text)


def numbers(text: str, locale: str) -> set[Decimal]:
    text = normalized(text)
    if locale.startswith("en"):
        text = _en_years(text)
    # "por ciento" is a unit, not an additional quantity of 100.
    text = re.sub(r"\bpor\s+(?:ciento|cento)\b", " percent ", text)
    text = re.sub(r"\bmedi[oa]\s+(millon(?:es)?|milhao|milhoes)\b", r"0.5 \1", text)
    # Decimal narration is natural in each market, and must remain a factual value.
    digit_words = {w: n for w, n in _SMALL.items() if n < 10}
    decimal_words = "|".join(map(re.escape, digit_words))
    def spoken_decimal(match):
        tail = match[2].replace("-", " ").split()
        return str(digit_words[match[1]]) + "." + "".join(str(digit_words[w]) for w in tail)
    text = re.sub(r"\b(" + decimal_words + r")\s+(?:point|punto|coma|virgula)\s+((?:" + decimal_words + r")(?:[ -]+(?:" + decimal_words + r"))*)\b",
                  spoken_decimal, text)
    def spoken_integer_decimal(match):
        return str(_SMALL[match[1]]) + "." + "".join(str(digit_words[w]) for w in match[2].replace("-", " ").split())
    text = re.sub(r"\b(" + "|".join(map(re.escape, (w for w, n in _SMALL.items() if 10 <= n < 100)))
                  + r")\s+(?:point|punto|coma|virgula)\s+((?:" + decimal_words
                  + r")(?:[ -]+(?:" + decimal_words + r"))*)\b", spoken_integer_decimal, text)
    # Normalize decimal/group separators before tokenizing cardinal phrases.
    def numeric(match):
        value = match[0]
        decimal, group = (".", ",") if locale.startswith("en") else (",", ".")
        if decimal in value and group in value:
            value = value.replace(group, "").replace(decimal, ".")
        elif group in value:
            parts = value.split(group)
            value = "".join(parts) if all(len(p) == 3 for p in parts[1:]) else value.replace(group, ".")
        else:
            value = value.replace(decimal, ".")
        if value.count(".") > 1:  # Versions and identifiers are not decimal amounts.
            return " ".join(value.split("."))
        return str(Decimal(value))
    text = re.sub(r"\d+(?:[.,]\d+)*", numeric, text)
    words = re.findall(r"-?\d+(?:\.\d+)?|[a-z]+", text)
    result, current, total, active, last_scale, sign = set(), Decimal(0), Decimal(0), False, None, 1
    cardinal_words = False
    def flush():
        nonlocal current, total, active, last_scale, sign, cardinal_words
        if active:
            result.add(sign * (total + current))
        current, total, active, last_scale, sign = Decimal(0), Decimal(0), False, None, 1
        cardinal_words = False
    for i, word in enumerate(words):
        if word in {"un", "una", "um", "uma"} and (i + 1 == len(words) or words[i + 1] not in _SCALES):
            # These words are usually articles. Inside a spoken cardinal they
            # complete the quantity: "vinte e um", "dois mil e um", "treinta
            # y una". A standalone article after a year remains language.
            continuation = (active and cardinal_words and i > 0 and words[i - 1] in {"and", "y", "e"}
                            and current % 10 == 0)
            if not continuation:
                flush()
                continue
        if re.fullmatch(r"-?\d+(?:\.\d+)?", word):
            if active:
                flush()
            current, active = abs(Decimal(word)), True
            if word.startswith("-"):
                sign = -1
        elif word in {"minus", "menos", "negative", "negativo"}:
            flush()
            sign = -1
        elif word in _ORDINALS:
            # An ordinal closes its number: "May thirteenth, two thousand..." are two values.
            if active and _ORDINALS[word] >= 20 and current % 100 >= 20:
                flush()
            current += _ORDINALS[word]
            active = True
            flush()
        elif word in _SMALL:
            if active and _SMALL[word] >= 20 and current % 100 >= 20:
                flush()
            current += _SMALL[word]
            active = True
            cardinal_words = True
        elif word == "hundred" and active:
            current *= 100
            cardinal_words = True
        elif word in _SCALES:
            scale = _SCALES[word]
            if total and scale > total:
                total = (total + current) * scale
            else:
                if last_scale is not None and scale >= last_scale and current:
                    # "78 millones y 10 millones": a same-or-larger scale opens a new quantity
                    result.add(sign * total)
                    total = Decimal(0)
                total += (current or 1) * scale
            current, active, last_scale = Decimal(0), True, scale
            cardinal_words = True
        elif word in {"and", "y", "e"} and active and i + 1 < len(words) and words[i + 1] in _SMALL:
            continue
        else:
            flush()
    flush()
    return result


def facts(text: str, locale: str) -> set[Decimal]:
    """Cifras que deben conservarse: las cantidades desde 10 (en dígitos o palabras). Los números
    pequeños en palabras ("un botón" -> "one share button") son lenguaje, no datos."""
    return {v for v in numbers(text, locale) if abs(v) >= 10 or v != v.to_integral_value()}


def small_digits(text: str) -> set[Decimal]:
    """Cantidades menores que 10 escritas con dígitos ("3 de cada 10"): deben seguir presentes."""
    return {Decimal(d) for d in re.findall(r"(?<![\d.,])\d(?![\d.,])", normalized(text))}


def same_figures(source: str, source_locale: str, target: str, locale: str) -> bool:
    return (facts(source, source_locale) == facts(target, locale)
            and small_digits(source) <= numbers(target, locale)
            and quantity_units(source) == quantity_units(target))


def quantity_units(text: str) -> set[str]:
    """Conservative unit presence check; does not certify semantic attribution."""
    value = normalized(text)
    aliases = {
        "percent": r"%|\bpercent(?:age)?\b|\bpor (?:ciento|cento)\b",
        "usd": r"\$|\b(?:usd|dollars?|dolares?|dolar)\b",
        "eur": r"€|\b(?:eur|euros?)\b",
        "seconds": r"\b(?:seconds?|segundos?)\b",
    }
    result = {unit for unit, pattern in aliases.items() if re.search(pattern, value)} if numbers_present(value) else set()
    if _quantified_users(value):
        result.add("users")
    return result


def _quantified_users(value: str) -> bool:
    """A count of users is a unit; a generic user near an unrelated year is not."""
    articles = {"un", "una", "um", "uma"}
    modifiers = {"active", "monthly", "daily", "unique", "activos", "activas", "ativos", "ativas",
                 "mensuales", "mensais", "diarios", "diarias", "unicos", "unicas",
                 "registered", "paying", "paid", "subscribed", "concurrent", "new", "existing", "online", "simultaneous",
                 "registrados", "registradas", "pagos", "pagadas", "suscritos", "suscritas", "suscriptos", "suscriptas",
                 "concurrentes", "nuevos", "nuevas", "existentes", "simultaneos", "simultaneas",
                 "cadastrados", "cadastradas", "pagantes", "assinantes", "inscritos", "inscritas", "novos", "novas"}
    for match in re.finditer(r"\b(?:users?|usuarios?|usuarias?)\b", value):
        prefix = re.findall(r"\d+(?:[.,]\d+)*|[a-z]+|[^\w\s]", value[:match.start()])
        while prefix and prefix[-1] in modifiers:
            prefix.pop()
        if len(prefix) >= 2 and prefix[-1] in {"the", "los", "las", "os", "as"} and prefix[-2] in {"de", "of"}:
            prefix.pop()
        if prefix and prefix[-1] in {"de", "of", "dos", "das"}:
            prefix.pop()
        # Singular indefinite articles do not by themselves assert a count.
        # They do complete an explicit compound count ("vinte e um usuários").
        if prefix and prefix[-1] in articles:
            prefix.pop()
            if not prefix or prefix.pop() not in {"e", "y", "and"}:
                continue
            if not prefix or (prefix[-1] not in _SMALL and prefix[-1] not in _SCALES and prefix[-1] != "hundred"):
                continue
        if prefix and (re.fullmatch(r"\d+(?:[.,]\d+)*", prefix[-1])
                       or prefix[-1] in _SMALL or prefix[-1] in _SCALES or prefix[-1] == "hundred"):
            return True
        # Compact statistical labels are also quantities: "usuarios: 20 millones".
        suffix = re.match(r"\s*[:=]\s*(\d+(?:[.,]\d+)*|[a-z]+)\b", value[match.end():])
        if suffix and (suffix[1][0].isdigit() or suffix[1] in _SMALL or suffix[1] in _SCALES):
            return True
    return False


def numbers_present(value: str) -> bool:
    return bool(re.search(r"\d", value) or any(_SMALL.get(w, 0) >= 2 or w in _SCALES for w in tokens(value)))


def names(text: str) -> list[str]:
    # Invariant across markets: acronyms and mixed-case brands (OpenAI, ChatGPT, FBI).
    # Multi-word capitalized sequences are not blocking: places translate ("Nueva York" ->
    # "New York") and sentence starts look like names ("Para Business"). Editorial names
    # that must stay identical can be supplied explicitly in preserve_names.
    pattern = r"\b(?:[A-Z][a-z]+[A-Z][\w]*|[A-Z]{2,}[a-z]+\w*|[A-Z]{2,})\b"
    return sorted({m[0] for m in re.finditer(pattern, text) if m[0] not in {"IA", "AI", "ES", "EN", "PT"}})


def validate_table(table: TextTable, translated: dict[str, str], locale: str) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    def fail(key, reason):
        errors.setdefault(key, []).append(reason)
    for key in translated.keys() - table.entries.keys():
        fail(key, "unknown key")
    narration = [k for k, e in table.entries.items() if e.type == "narration" or k.startswith("seg.")]
    source_facts = set().union(*(facts(e.text, table.source_locale) for e in table.entries.values())) if table.entries else set()
    for key, entry in table.entries.items():
        value = translated.get(key)
        if not isinstance(value, str):
            fail(key, "missing text")
            continue
        if entry.text.strip() and not value.strip():
            fail(key, "empty text")
        if len(value) > entry.max_chars:
            fail(key, f"max_chars={entry.max_chars}")
        if entry.substring_of and value and value.casefold() not in translated.get(entry.substring_of, "").casefold():
            fail(key, f"substring of {entry.substring_of}")
        if entry.check_facts and key in narration:
            # Narration may move a figure to a neighbouring segment or recall one already said;
            # it may not lose one (window of +-1 segments) nor invent one absent from the source.
            i = narration.index(key)
            window = [translated.get(k) or "" for k in narration[max(0, i - 1):i + 2]]
            near = set().union(*(numbers(w, locale) for w in window))
            lost = facts(entry.text, table.source_locale) - near
            invented = facts(value, locale) - source_facts
            if lost or invented or not small_digits(entry.text) <= near:
                fail(key, "figures changed")
            source_units = quantity_units(entry.text)
            near_units = set().union(*(quantity_units(w) for w in window))
            if source_units - near_units:
                fail(key, "quantity units changed")
        elif entry.check_facts:
            if not same_figures(entry.text, table.source_locale, value, locale):
                fail(key, "figures changed")
        for name in entry.preserve_names:
            if normalized(name) not in normalized(value):
                fail(key, f"preserve name: {name}")
    return errors


class TextMemory:
    """Fixed channel texts, keyed by source hash; no storage/backend dependency."""
    def __init__(self, values: dict | None = None):
        self.values = dict(values or {})

    @staticmethod
    def key(channel: str, locale: str, source: str) -> str:
        return hashlib.sha256(json.dumps([channel, locale, source], ensure_ascii=False).encode()).hexdigest()

    def remember(self, channel: str, locale: str, source: str, target: str) -> None:
        self.values[self.key(channel, locale, source)] = target

    def lookup(self, channel: str, locale: str, source: str) -> str | None:
        return self.values.get(self.key(channel, locale, source))
