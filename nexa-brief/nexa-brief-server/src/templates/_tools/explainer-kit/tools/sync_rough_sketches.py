#!/usr/bin/env python3
"""Publish the shared rough sketch dictionary as searchable Showcase resources.

Run after catalog.py; entries are generated from catalog.json rather than copied
into individual videos. Existing components and hand-authored examples remain intact.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlencode

KIT = Path(__file__).resolve().parents[1]
CATALOG = KIT / 'catalog.json'
SHOWCASE = KIT.parent / 'design-definitions' / 'rough' / 'catalog.json'

# Spanish labels and categories are presentation metadata; keys are stable runtime IDs.
_GROUPS = {
    'tecnología': 'laptop=Computadora portátil;linux=Linux;homelab=Laboratorio doméstico;browser=Navegador;database=Base de datos;terminal=Terminal;ai=Inteligencia artificial;camera=Cámara;cloud=Nube;bot=Robot;mouse=Ratón;lock=Candado;code=Código;phone=Teléfono;server=Servidor;chip=Chip;dsky=Computadora DSKY;keyboard=Teclado;battery=Batería;cursor=Cursor;nextcube=Computadora NeXT;notebook=Cuaderno;tv=Televisor;headset=Auriculares',
    'ideas y trabajo': 'understand=Comprender;design=Diseño;build=Construir;measure=Medir;work=Trabajo;spark=Chispa;cup=Taza;hook=Gancho;star=Estrella;bulb=Bombilla;pencil=Lápiz;question=Pregunta;gradcap=Graduación;book=Libro;paper=Papel;papers=Documentos',
    'formas y señales': 'waves=Ondas;swipe=Deslizar;scribble=Garabato;up=Arriba;ring=Anillo;cube=Cubo;pin=Ubicación;circle=Círculo;underline=Subrayado;arrow=Flecha;link=Enlace;plus=Más;close=Cerrar;alarm=Alarma;switch=Interruptor;warning=Advertencia;check=Confirmación;loop=Bucle;target=Objetivo',
    'espacio y ciencia': 'ship=Nave;flight=Vuelo;rocket=Cohete;lm=Módulo lunar;moon=Luna;earth=Tierra;radar=Radar;flag=Bandera;astronaut=Astronauta;fuel=Combustible;crater=Cráter;rocks=Rocas;footprint=Huella',
    'personas y vida': 'scales=Balanza;car=Automóvil;drop=Gota;megaphone=Megáfono;plate=Plato;dumbbell=Mancuerna;calendar=Calendario;bag=Bolsa;heart=Corazón;sun=Sol;woman=Mujer;person=Persona;eye=Ojo;clock=Reloj;gear=Engranaje;stopwatch=Cronómetro;coin=Moneda;gift=Regalo',
}


def labels():
    result = {}
    for group, values in _GROUPS.items():
        for pair in values.split(';'):
            key, label = pair.split('=', 1)
            if key in result:
                raise ValueError(f'Boceto repetido: {key}')
            result[key] = (label, group)
    return result


def sync():
    source = json.loads(CATALOG.read_text(encoding='utf-8'))
    names = source.get('sketches')
    if not isinstance(names, list) or not names or any(not isinstance(n, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', n) for n in names) or len(names) != len(set(names)):
        raise ValueError('Lista de bocetos inválida; no se modificó Showcase')
    definition = json.loads(SHOWCASE.read_text(encoding='utf-8'))
    entries = definition['entries']
    existing = [e for e in entries if not (isinstance(e.get('data'), dict) and e['data'].get('resource_type') == 'sketch' and e['data'].get('managed_by') == 'sync_rough_sketches')]
    occupied = {e['id'] for e in existing}
    meta = labels()
    generated = []
    for name in names:
        slug = re.sub(r'[^a-z0-9-]', '-', name.lower())
        ident = f'rough.example-sketch-{slug}'
        if ident in occupied:
            raise ValueError(f'ID de boceto duplicado: {ident}')
        occupied.add(ident)
        label, category = meta.get(name, (name, 'otros'))
        qualified_name = f'rough.sketch.{name}'
        example = {'icon': name, 'accent': True}
        generated.append({
            'id': ident, 'name': qualified_name, 'label': label, 'kind': 'component',
            'summary': f'Úsalo con rough.icon, rough.flow o rough.tally. Clave del boceto: {name}.',
            'tags': [category],
            'params': {'icon': {'type': 'icon', 'required': True, 'default': name,
                                'doc': 'Nombre del boceto en el diccionario compartido de PROTOTIPO.'}},
            'example': example, 'preview_kind': 'iframe',
            'preview_url': '/api/v1/explainer/files/_tools/explainer-kit/showcase/stage.html?' + urlencode({'d': 'rough', 'c': ident}),
            'data': {'native_name': 'rough.icon', 'example_variant': f'sketch-{slug}',
                     'resource_type': 'sketch', 'sketch_id': name, 'qualified_name': qualified_name,
                     'components': ['rough.icon', 'rough.flow', 'rough.tally'],
                     'managed_by': 'sync_rough_sketches'},
        })
    for entry in existing:
        if entry.get('id') in ('rough.icon', 'rough.tally'):
            entry.get('params', {}).get('icon', {})['options'] = list(names)
    definition['entries'] = existing + generated
    fd, temporary = tempfile.mkstemp(prefix='.rough-catalog-', dir=SHOWCASE.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            json.dump(definition, out, ensure_ascii=False, indent=2)
            out.write('\n')
        os.chmod(temporary, SHOWCASE.stat().st_mode & 0o777)
        os.replace(temporary, SHOWCASE)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return len(generated)


if __name__ == '__main__':
    print(f'Bocetos disponibles en Showcase: {sync()}')
