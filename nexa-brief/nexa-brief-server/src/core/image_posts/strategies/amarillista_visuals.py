"""Contrato mínimo de visuales informativos; los datos viajan en el plan y su hash."""
import json
import math


def validate_diagram(raw, allowed_claims):
    if not isinstance(raw, dict) or raw.get('kind') not in {'percent','quantity','fraction','comparison','timeline','evidence'}:
        raise ValueError('Visual: se requiere gráfico, comparación, línea de tiempo o evidencia')
    refs = raw.get('claim_ids')
    if not isinstance(refs, list) or not refs or not set(refs) <= set(allowed_claims):
        raise ValueError('Visual sin claim_ids válidos')
    if raw['kind'] == 'percent':
        value = raw.get('value')
        if isinstance(value, bool) or not isinstance(value, (float,int)) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError('Porcentaje fuera de rango')
    elif raw['kind'] == 'quantity':
        value = raw.get('value')
        try:
            valid = isinstance(value,str) and math.isfinite(float(value.replace(',','.'))) and float(value.replace(',','.')) > 0
        except ValueError:
            valid = False
        if not valid or not isinstance(raw.get('unit'),str) or not raw['unit'].strip():
            raise ValueError('Cantidad sin valor o unidad')
    elif raw['kind'] == 'fraction':
        numerator, denominator = raw.get('numerator'), raw.get('denominator')
        if not isinstance(numerator,int) or not isinstance(denominator,int) or not 0 < numerator < denominator <= 10 or raw.get('approximate') is not True:
            raise ValueError('Fracción aproximada inválida')
    else:
        items = raw.get('items')
        if not isinstance(items, list) or not 1 <= len(items) <= 4:
            raise ValueError('Visual sin información')
        if raw['kind'] == 'comparison':
            scale = raw.get('scale', 100)
            if not isinstance(scale, (int,float)) or not math.isfinite(scale) or scale <= 0:
                raise ValueError('Escala de comparación inválida')
            for item in items:
                value = item.get('value') if isinstance(item, dict) else None
                if not isinstance(value, (int,float)) or not math.isfinite(value) or not 0 <= value <= scale or not item.get('label'):
                    raise ValueError('Comparación inválida')
        elif raw['kind'] == 'timeline':
            if not all(isinstance(item, dict) and item.get('label') and item.get('detail') for item in items):
                raise ValueError('Línea de tiempo sin fechas o hechos')
        elif not all(isinstance(item, str) and item.strip() for item in items):
            raise ValueError('Evidencia vacía')
    return raw


def diagram_element(diagram):
    return {'type': 'diagram', 'value': json.dumps(diagram, ensure_ascii=False)}


def prominent_numbers(diagram):
    """Cifras que el renderer dibuja como protagonista, excluida escala técnica."""
    from .base import numbers_in
    def values(value):
        if isinstance(value,float) and value.is_integer(): value=int(value)
        return numbers_in(str(value))
    if diagram['kind'] in ('percent','quantity'):
        return values(diagram['value'])
    if diagram['kind'] == 'comparison':
        return set().union(*(values(item['value']) for item in diagram['items']))
    return set()
