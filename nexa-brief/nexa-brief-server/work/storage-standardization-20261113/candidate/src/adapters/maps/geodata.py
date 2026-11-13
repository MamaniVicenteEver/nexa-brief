"""Offline administrative geometries, built from Natural Earth and geoBoundaries."""
from __future__ import annotations

import io
import json
import math
import re
import unicodedata
import urllib.request
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

import shapefile
from shapely import make_valid, set_precision
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

DATA_DIR = Path(__file__).resolve().parents[2] / 'templates/sandbox/nodehistory/_atlas/data/geo'
NE_BASE = 'https://naturalearth.s3.amazonaws.com/10m_cultural/'
NE_FILES = {'admin0': 'ne_10m_admin_0_countries', 'admin1': 'ne_10m_admin_1_states_provinces', 'admin2-US': 'ne_10m_admin_2_counties'}
DETAIL = {'high': 0, 'mid': 0.01, 'low': 0.05}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'NexaBrief-Atlas/1.0'})
    with urllib.request.urlopen(req, timeout=180) as response:
        return response.read()


def _normalize(value: str) -> str:
    text = unicodedata.normalize('NFKD', value.casefold())
    return ' '.join(re.sub(r'[^\w]+', ' ', ''.join(c for c in text if not unicodedata.combining(c))).split())


def _polygon(geom):
    if not geom.is_valid:
        geom = make_valid(geom)
    if geom.geom_type == 'GeometryCollection':
        geom = unary_union([g for g in geom.geoms if g.geom_type in ('Polygon', 'MultiPolygon')])
    if geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Source contains no polygon geometry')
    return geom


def _feature(props, geom, tolerance=0.005):
    geom = _polygon(geom)
    geom = _polygon(geom.simplify(tolerance, preserve_topology=True))
    geom = _polygon(set_precision(geom, 0.00001))
    point = geom.representative_point()
    props.update(bbox=list(geom.bounds), label=[point.x, point.y])
    return {'type': 'Feature', 'properties': props, 'geometry': mapping(geom)}


def _write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(path)


def _collection(features):
    return {'type': 'FeatureCollection', 'features': features}


def _labels(features):
    ordered = sorted(features, key=lambda f: shape(f['geometry']).area, reverse=True)
    result = []
    for i, f in enumerate(ordered):
        p = f['properties']
        # Área en grados cuadrados: orden orientativo, no una medida geodésica.
        zoom = max(2, min(12, round(8 - math.log2(max(shape(f['geometry']).area, 0.000001)) / 2)))
        result.append({'type': 'Feature', 'properties': {'id': p['id'], 'name': p['name'], 'name_es': p.get('name_es'), 'rank': i + 1, 'minzoom': zoom}, 'geometry': {'type': 'Point', 'coordinates': p['label']}})
    return _collection(result)


class AmbiguousRegion(ValueError):
    def __init__(self, query, candidates):
        self.query, self.candidates = query, candidates
        super().__init__(f'Ambiguous region {query!r}: ' + ', '.join(f"{p['id']} ({p['name']})" for p in candidates))


class GeoData:
    def __init__(self, data_dir: str | Path = DATA_DIR):
        self.data_dir = Path(data_dir)
        self._features = None

    def _natural_earth(self, key, tolerance):
        stem = NE_FILES[key]
        url = NE_BASE + stem + '.zip'
        with zipfile.ZipFile(io.BytesIO(_get(url))) as z:
            version = z.read(stem + '.VERSION.txt').decode().strip()
            reader = shapefile.Reader(shp=io.BytesIO(z.read(stem + '.shp')), shx=io.BytesIO(z.read(stem + '.shx')), dbf=io.BytesIO(z.read(stem + '.dbf')), encoding='utf-8')
            features = []
            for item in reader.iterShapeRecords():
                p = {k.lower(): v for k, v in item.record.as_dict().items()}
                if key == 'admin0':
                    iso2 = p['iso_a2'] if len(p['iso_a2']) == 2 else (p['iso_a2_eh'] if p['iso_a3_eh'] == p['adm0_a3'] else p['adm0_a3'])
                    iso3 = p['iso_a3'] if len(p['iso_a3']) == 3 and p['iso_a3'].isalpha() else p['adm0_a3']
                    # Some de facto territories lack an ISO code; keep their NE code distinct.
                    iso2 = iso2 if len(iso2) == 2 else p['adm0_a3']
                    props = {'id': iso2, 'iso3': iso3 if len(iso3) == 3 else p['adm0_a3'], 'name': p['name'], 'name_es': p['name_es'], 'level': 0}
                elif key == 'admin1':
                    ident = p['iso_3166_2']
                    if not ident or ident == '-99':
                        ident = p['adm1_code']
                    props = {'id': ident, 'name': p['name'], 'name_es': p['name_es'], 'country': p['iso_a2'], 'level': 1, 'type': p['type_en'] or p['type'], '_ne_id': p['adm1_code']}
                else:
                    if p['iso_a2'] != 'US':
                        continue
                    props = {'id': 'US-' + str(p['code_local']).zfill(5), 'name': p['name'], 'name_es': p['name_es'], 'country': 'US', 'state': 'US-' + p['region'], 'level': 2}
                features.append(_feature(props, shape(item.shape.__geo_interface__), tolerance))
        if key == 'admin1':
            counts = Counter(f['properties']['id'] for f in features)
            for f in features:
                props = f['properties']
                # Natural Earth sometimes reuses a parent ISO code for multiple units.
                if counts[props['id']] > 1:
                    props['id'] = props['_ne_id']
                del props['_ne_id']
            parts = [shape(f['geometry']) for f in features if f['properties']['id'] in {'ES-B', 'ES-GI', 'ES-L', 'ES-T'}]
            if len(parts) == 4:
                features.append(_feature({'id': 'ES-CT', 'name': 'Catalonia', 'name_es': 'Cataluña', 'country': 'ES', 'level': 1, 'type': 'Autonomous community'}, unary_union(parts), 0))
        return features, url, version

    def build(self, country: str | None = None, level: int | None = None, tolerance: float = 0.005):
        if country or level is not None:
            if not country or level != 2 or not re.fullmatch('[A-Za-z]{2}', country):
                raise ValueError('On-demand build requires --country ISO2 --level 2')
            country = country.upper()
            if country != 'US':
                return self._build_geoboundaries(country, tolerance)
            keys = ['admin2-US']
        else:
            keys = list(NE_FILES)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        sources = self._read_sources()
        for key in keys:
            features, url, version = self._natural_earth(key, tolerance)
            _write(self.data_dir / (key + '.geojson'), _collection(features))
            if key in ('admin1', 'admin2-US'):
                _write(self.data_dir / ('labels-' + key + '.geojson'), _labels(features))
            sources[key] = f'Natural Earth, dominio público; versión {version}; descarga {date.today().isoformat()}; {url}; simplificación Shapely {tolerance}° (topología por geometría).'
        self._write_sources(sources)
        self._features = None
        return {k: (self.data_dir / (k + '.geojson')).stat().st_size for k in keys}

    def _read_sources(self):
        path = self.data_dir / 'SOURCES.md'
        if not path.exists():
            return {}
        return {line[2:].split(': ', 1)[0]: line[2:].split(': ', 1)[1] for line in path.read_text().splitlines() if line.startswith('- ') and ': ' in line}

    def _write_sources(self, sources):
        text = '# Fuentes geográficas\n\nNatural Earth representa por defecto límites de facto; véase https://www.naturalearthdata.com/about/disputed-boundaries-policy/. La simplificación independiente no garantiza coincidencia topológica entre regiones vecinas. Admin1: IDs Natural Earth adm1_code cuando se reutiliza un código ISO; Cataluña (ES-CT) es la unión de Barcelona, Gerona, Lérida y Tarragona.\n\n'
        text += ''.join(f'- {k}: {v}\n' for k, v in sorted(sources.items()))
        (self.data_dir / 'SOURCES.md').write_text(text, encoding='utf-8')

    def _build_geoboundaries(self, country, tolerance):
        country_feature = self.resolve(country)
        iso3 = country_feature['properties']['iso3']
        url = f'https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/'
        meta = json.loads(_get(url))
        geo_url = meta['simplifiedGeometryGeoJSON']
        raw = json.loads(_get(geo_url))
        features = []
        for f in raw['features']:
            p = f['properties']
            props = {'id': country + '-' + str(p['shapeID']), 'name': p.get('shapeName') or p['shapeID'], 'name_es': p.get('name_es') or '', 'country': country, 'level': 2}
            features.append(_feature(props, shape(f['geometry']), tolerance))
        key = 'admin2-' + country
        _write(self.data_dir / (key + '.geojson'), _collection(features))
        _write(self.data_dir / ('labels-' + key + '.geojson'), _labels(features))
        sources = self._read_sources()
        sources[key] = f"geoBoundaries (Runfola et al. 2020), gbOpen, CC BY 4.0; versión {meta.get('boundaryID', 'desconocida')}; descarga {date.today().isoformat()}; API {url}; geometría {geo_url}; licencia fuente {meta.get('boundaryLicense', 'desconocida')}; atribución fuente {meta.get('licenseDetail', '')}."
        self._write_sources(sources)
        self._features = None
        return {key: (self.data_dir / (key + '.geojson')).stat().st_size}

    def _load(self):
        if self._features is None:
            paths = sorted(self.data_dir.glob('admin*.geojson'))
            if not paths:
                raise FileNotFoundError(f'No geographic datasets in {self.data_dir}; run geo build')
            self._features = [f for path in paths for f in json.loads(path.read_text(encoding='utf-8'))['features']]
        return self._features

    def list_regions(self, level: int, country: str | None = None):
        return [f['properties'] for f in self._load() if f['properties']['level'] == level and (not country or f['properties'].get('country') == country.upper())]

    def resolve(self, query: str | dict[str, Any]):
        options = {'name': query} if isinstance(query, str) else dict(query)
        term = options.get('admin') or options.get('id') or options.get('name')
        if not isinstance(term, str) or not term.strip():
            raise ValueError('Region requires a name or admin ID')
        norm = _normalize(term)
        alias_path = self.data_dir / 'aliases.json'
        aliases = json.loads(alias_path.read_text(encoding='utf-8')) if alias_path.exists() else {}
        alias_ids = {v for k, values in aliases.items() if _normalize(k) == norm for v in (values if isinstance(values, list) else [values])}
        features = self._load()
        candidates = []
        for f in features:
            p = f['properties']
            if 'level' in options and p['level'] != int(options['level']):
                continue
            if options.get('country') and p.get('country', p['id']) != options['country'].upper():
                continue
            state = options.get('state')
            if state and p.get('state') != (state.upper() if '-' in state else 'US-' + state.upper()):
                continue
            names = [p.get('id', ''), p.get('iso3', ''), p.get('name', ''), p.get('name_es', '')]
            if p['level'] == 2 and p.get('state'):
                suffix = p['state'].split('-')[-1]
                names.extend([f"{p['name']} County {suffix}", f"{p['name']} {suffix}", f"{p['name']} County"])
            if p['id'] in alias_ids or norm in {_normalize(n) for n in names if n}:
                candidates.append(f)
        # Bare US county names omit the word County in Natural Earth; when an
        # admin0/1 shares that bare name, it denotes the higher-level unit.
        if 'level' not in options and not options.get('state') and any(f['properties']['level'] < 2 for f in candidates):
            candidates = [f for f in candidates if not (f['properties']['level'] == 2 and f['properties'].get('country') == 'US' and _normalize(f['properties']['name']) == norm)]
        if not candidates:
            raise LookupError(f'Region not found: {term!r}')
        if len(candidates) > 1:
            raise AmbiguousRegion(term, [f['properties'] for f in candidates])
        return candidates[0]

    def resolve_scene(self, scene_path: str | Path) -> Path:
        scene_path = Path(scene_path)
        scene = json.loads(scene_path.read_text(encoding='utf-8'))
        resolved, needs = [], set()
        for index, layer in enumerate(scene.get('layers', [])):
            for key in ('region', 'regions', 'focus'):
                if key not in layer or layer[key] is None:
                    continue
                values = layer[key] if isinstance(layer[key], list) else [layer[key]]
                for position, query in enumerate(values):
                    detail = query.get('detail', layer.get('detail', scene.get('detail', 'mid'))) if isinstance(query, dict) else layer.get('detail', scene.get('detail', 'mid'))
                    if detail not in DETAIL:
                        raise ValueError(f'Unknown detail: {detail}')
                    f = self.resolve(query)
                    geom = _polygon(shape(f['geometry']).simplify(DETAIL[detail], preserve_topology=True))
                    p = f['properties']
                    point = geom.representative_point()
                    result = {k: p[k] for k in ('id', 'name', 'level')}
                    result.update(bbox=list(geom.bounds), label=[point.x, point.y], geometry=mapping(geom), layer=index, field=key, index=position)
                    resolved.append(result)
                    if p['level'] >= 1:
                        needs.add('admin1')
                    if p['level'] == 2:
                        needs.add('admin2-' + p['country'])
        dest = scene_path.parent / 'geo.resolved.json' if scene_path.parent.name == 'assets' else scene_path.parent / 'assets' / 'geo.resolved.json'
        _write(dest, {'regions': resolved, 'needs': sorted(needs)})
        return dest
