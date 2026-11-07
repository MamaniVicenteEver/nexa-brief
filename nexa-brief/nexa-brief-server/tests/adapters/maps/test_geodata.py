import json

import pytest
from shapely.geometry import Point, shape

from src.adapters.maps.geodata import AmbiguousRegion, GeoData


@pytest.fixture(scope='module')
def geo():
    return GeoData()


@pytest.mark.parametrize(('query', 'expected'), [
    ('US-TX', 'US-TX'), ('Texas', 'US-TX'), ('Cataluña', 'ES-CT'), ('Estados Unidos', 'US'),
    ('RD Congo', 'CD'), ('Brasil', 'BR'), ('Rusia', 'RU'),
    ('Travis County TX', 'US-48453'),
    ({'name': 'Travis', 'level': 2, 'country': 'US', 'state': 'TX'}, 'US-48453'),
])
def test_resolve(geo, query, expected):
    assert geo.resolve(query)['properties']['id'] == expected


def test_ambiguous(geo):
    with pytest.raises(AmbiguousRegion) as exc:
        geo.resolve('Washington')
    assert {'US-WA', 'US-DC'} <= {p['id'] for p in exc.value.candidates}


def test_texas_inside_united_states(geo):
    texas, usa = (geo.resolve(q) for q in ('US-TX', 'US'))
    a, b = texas['properties']['bbox'], usa['properties']['bbox']
    assert b[0] <= a[0] <= a[2] <= b[2] and b[1] <= a[1] <= a[3] <= b[3]
    assert shape(usa['geometry']).covers(Point(texas['properties']['label']))


def test_polygons_and_labels_valid(geo):
    for feature in geo._load():
        geom = shape(feature['geometry'])
        assert geom.is_valid, feature['properties']['id']
        assert geom.contains(Point(feature['properties']['label'])), feature['properties']['id']


def test_scene_uses_offline_geometries_and_detail(geo, tmp_path):
    scene = tmp_path / 'scene.json'
    scene.write_text(json.dumps({'layers': [{'region': 'US', 'detail': 'low'}, {'regions': ['Texas', {'name': 'Travis', 'state': 'TX', 'level': 2, 'detail': 'high'}]}]}))
    output = json.loads(geo.resolve_scene(scene).read_text())
    assert output['needs'] == ['admin1', 'admin2-US']
    assert [x['id'] for x in output['regions']] == ['US', 'US-TX', 'US-48453']
    for item in output['regions']:
        assert shape(item['geometry']).contains(Point(item['label']))


def test_missing_and_invalid_detail(geo, tmp_path):
    with pytest.raises(LookupError):
        geo.resolve('not a real region at all')
    path = tmp_path / 'scene.json'
    path.write_text(json.dumps({'layers': [{'region': 'Texas', 'detail': 'extreme'}]}))
    with pytest.raises(ValueError, match='detail'):
        geo.resolve_scene(path)


def test_geoboundaries_build_with_mocked_api(geo, tmp_path, monkeypatch):
    from src.adapters.maps import geodata

    # The metadata call and geometry download are independent network responses.
    data = GeoData(tmp_path)
    monkeypatch.setattr(data, 'resolve', lambda query: {'properties': {'iso3': 'BRA'}})
    meta = {'simplifiedGeometryGeoJSON': 'https://example.test/geometry', 'boundaryID': 'BRA-ADM2-v1', 'boundaryLicense': 'CC BY 4.0'}
    polygon = {'type': 'Polygon', 'coordinates': [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}
    content = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'shapeID': '123', 'shapeName': 'Example'}, 'geometry': polygon}]}
    monkeypatch.setattr(geodata, '_get', lambda url: json.dumps(content if url.endswith('geometry') else meta).encode())
    data.build(country='BR', level=2)
    assert GeoData(tmp_path).resolve('BR-123')['properties']['name'] == 'Example'
    assert 'geoBoundaries (Runfola et al. 2020)' in (tmp_path / 'SOURCES.md').read_text()
    assert (tmp_path / 'labels-admin2-BR.geojson').exists()
