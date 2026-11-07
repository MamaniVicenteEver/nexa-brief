"""Preflight determinista: contrasta visuales con el texto de SU hecho, sin red."""
from __future__ import annotations

import re
import unicodedata

from .strategies.amarillista_visuals import validate_diagram
from .strategies.base import numbers_in

WORDS = {"cero": 0, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
         "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
         "once": 11, "doce": 12, "trece": 13, "catorce": 14, "quince": 15,
         "dieciseis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19,
         "veinte": 20, "treinta": 30, "cuarenta": 40, "cincuenta": 50,
         "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90, "cien": 100}
NUMBER = r"\d+(?:[.,]\d+|\s\d{3}(?!\d))*"
NUMBER_WORD = r"\b(?:" + "|".join(WORDS) + r")\b"
THRESHOLD = r"\b(?:al menos|mas de|menos de|un maximo de|un minimo de|hasta)\s+(?:" + NUMBER + "|" + NUMBER_WORD + ")|(?:" + NUMBER + "|" + NUMBER_WORD + r")\s+o\s+mas\b"
CONDITION = r"\b(?:sin importar|independientemente de|cualquiera que sea|solo si|siempre que|unicamente cuando)\b[^.;!?]*"


def normalize(value):
    value = unicodedata.normalize('NFKD', value.casefold())
    return ''.join(c for c in value if not unicodedata.combining(c))


def quantities(text):
    values = set(numbers_in(text))
    for match in re.finditer(NUMBER_WORD, normalize(text)):
        # Un/una son artículos: solo se cuentan junto a unidades o umbrales.
        word = match.group()
        if word in ('uno', 'una') and not re.match(r'\s+(?:hora|dia|semana|mes|ano|sintoma|persona)', normalize(text)[match.end():]):
            continue
        values.add(str(WORDS[word]))
    return values


def visible_strings(visual, prefix):
    """Excluye escala técnica y fracción aproximada; no son observaciones nuevas."""
    for key in ('label', 'unit', 'value'):
        value = visual.get(key)
        if isinstance(value, (str, float, int)) and not isinstance(value, bool):
            yield prefix+'.'+key, str(int(value) if isinstance(value,float) and value.is_integer() else value)
    for index, item in enumerate(visual.get('items', [])):
        if isinstance(item, str):
            yield f'{prefix}.items.{index}', item
        elif isinstance(item, dict):
            for key in ('label', 'detail', 'value'):
                if key in item:
                    value=item[key]
                    yield f'{prefix}.items.{index}.{key}', str(int(value) if isinstance(value,float) and value.is_integer() else value)


def visual_errors(visuals, facts):
    """Errores accionables; no pretende sustituir el cotejo semántico del modelo."""
    if not isinstance(visuals, dict):
        return [{'field': 'visuals.json', 'datum': 'objeto inválido', 'fix': 'Usa un objeto con claves claim_N.'}]
    by_id = {f.claim_id: f for f in facts}
    errors = []
    for claim, visual in visuals.items():
        prefix = 'visuals.'+claim
        fact = by_id.get(claim)
        if not fact:
            errors.append({'field': prefix, 'datum': claim, 'fix': 'Usa un claim aprobado del PLAN.'})
            continue

        def reject(path, datum, reason):
            errors.append({'field': path, 'claim_id': claim, 'datum': datum,
                'reason': reason, 'fact_text': fact.text,
                'fix': f'Quita o acota «{datum}» a lo que dice {claim}; si corresponde, documenta y aprueba ese dato en el texto del hecho antes de usarlo.'})

        try:
            validate_diagram(visual, by_id)
        except (ValueError, TypeError, KeyError) as exc:
            reject(prefix, str(exc), 'Estructura del visual inválida')
            continue
        if claim not in visual['claim_ids']:
            reject(prefix+'.claim_ids', str(visual['claim_ids']), 'El visual debe citar su propio hecho')
        # No se permite importar cifras de otros claims para salvar este visual.
        allowed = quantities(fact.text)
        fact_norm = normalize(fact.text)
        for path, value in visible_strings(visual, prefix):
            norm = normalize(value)
            count_label = path == prefix+'.label' and re.search(r'\b(condiciones|pasos|hallazgos|aspectos)\b',norm)
            structural_count = {str(len(visual.get('items',[])))} if count_label else set()
            for match in re.finditer(NUMBER+'|'+NUMBER_WORD, norm):
                literal = match.group()
                if not quantities(literal):
                    continue
                if quantities(literal) - allowed - structural_count:
                    reject(path, value[match.start():match.end()], 'Número o umbral ausente del texto de su hecho')
            for match in re.finditer(THRESHOLD, norm):
                def canonical(text):
                    text = re.sub(NUMBER_WORD, lambda m: str(WORDS[m.group()]), text)
                    return re.sub(r'\b(\d+) o mas\b', r'al menos \1', text)
                if canonical(match.group()) not in canonical(fact_norm):
                    reject(path, value[match.start():match.end()], 'Umbral o límite no documentado en su hecho')
            for match in re.finditer(CONDITION, norm):
                if match.group() not in fact_norm:
                    reject(path, value[match.start():match.end()], 'Condición nueva que su hecho no afirma')
    return errors


def rule_visual(fact):
    from .strategies.amarillista_copy import diagram_for
    diagram = diagram_for(fact)
    if diagram['kind'] == 'evidence':
        return {'kind': 'timeline', 'label': 'El hecho documentado',
                'items': [{'label': 'Evidencia', 'detail': fact.text}], 'claim_ids': [fact.claim_id]}
    return diagram
