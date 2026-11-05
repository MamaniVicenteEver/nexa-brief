import io
from PIL import Image
from src.adapters.maps.cache import terrain_land, TileCache
from src.adapters.maps.providers import load_providers


def test_terrarium_clamp_and_land_identity():
    source = Image.new('RGBA', (4, 1))
    pixels = [(0, 0, 0, 255), (127, 255, 255, 200), (128, 0, 0, 255), (140, 123, 45, 255)]
    source.putdata(pixels)
    data = io.BytesIO(); source.save(data, format='PNG')
    result = Image.open(io.BytesIO(terrain_land(data.getvalue()))).convert('RGBA')
    assert list(result.getdata()) == [(128, 0, 0, 255), (128, 0, 0, 200), *pixels[2:]]


def test_derived_provider_reuses_raw_cache(tmp_path):
    providers = load_providers(); cache = TileCache(tmp_path)
    image = Image.new('RGB', (1, 1), (127, 0, 0)); data = io.BytesIO(); image.save(data, format='PNG')
    cache.put(providers['terrain-aws'], 0, 0, 0, data.getvalue())
    derived = cache.get_or_fetch(providers['terrain-land'], 0, 0, 0)
    assert Image.open(io.BytesIO(derived)).getpixel((0, 0))[:3] == (128, 0, 0)
    assert cache.has(providers['terrain-land'], 0, 0, 0)
