# Guía para usar `researcher_data`

Este adaptador devuelve datos normalizados para que una IA pueda consultar
varias bibliotecas sin aprender el JSON particular de cada proveedor.

## Entrada y salida común

```python
from src.adapters.researcher_data import build_researcher_data

researcher = build_researcher_data()
response = await researcher.search_one(
    "wikipedia",
    "Alan Turing",
    language="en",
    limit=10,
)
```

Cada proveedor devuelve un `ResearchResponse`:

```python
{
    "provider": "wikipedia",
    "query": "Alan Turing",
    "results": [
        {
            "resource_id": "...",
            "kind": "article|image|video|audio|dataset|map_feature",
            "title": "...",
            "description": "...",
            "url": "...",
            "media_url": "...",
            "thumbnail_url": "...",
            "creator": "...",
            "license": "...",
            "date": "...",
            "language": "...",
            "metadata": {"campos_especificos_del_proveedor": "..."}
        }
    ],
    "total": 10,
    "page": 1,
    "limit": 10,
    "next_page": 2,
    "metadata": {}
}
```

Para consultar varios proveedores en paralelo:

```python
response = await researcher.search(
    "Neil Armstrong",
    providers=["wikipedia", "wikidata", "wikimedia_commons", "dpla"],
    limit=10,
    language="en",
)
```

El agregador devuelve `AggregatedResearchResponse` con `results`,
`providers_queried` y `provider_errors`. Un proveedor sin key o temporalmente
caído no debe bloquear los resultados de los demás.

## Catálogo de proveedores y parámetros

| Proveedor | Método principal | Parámetros importantes | Devuelve |
| --- | --- | --- | --- |
| Wikipedia | `search(query)` / `article(title)` | `language`, `page`, `limit`, `sentences` | Artículos y su imagen principal |
| Wikidata | `search(query)` / `entity(id)` / `sparql(query)` | `language`, `entity_type`, `limit` | Entidades, claims y filas SPARQL |
| Wikimedia Commons | `search(query)` / `file(title)` | `thumbnail_width`, `page`, `limit` | Imágenes, audio y vídeos con licencia |
| Wikimedia Enterprise | `login()` / `search(title)` | `project`, `fields`; título exacto | Artículo Enterprise; requiere token |
| Openverse | `search(query)` | `media_type="image"` o `"audio"`, `license`, `source` | Medios abiertos y atribución |
| Library of Congress | `search(query)` / `item(url)` | `format`, `facet`, `page`, `limit` | Fotos, mapas, documentos y vídeos |
| Europeana | `search(query)` / `record(id)` | `profile`, `media`, `thumbnail`, `qf` | Objetos culturales, imágenes y vídeo |
| NASA | `search(date)` / `apod()` | `date_value`, `count`; `neo_feed`, `mars_photos`, `earth_imagery` | APOD, NEO, Marte e imágenes terrestres |
| NASA Image & Video | `search(query)` / `asset(nasa_id)` | `media_type="image"` o `"video"` | Assets originales de NASA |
| World Bank | `search(query)` / `indicator(code)` | `catalog_limit`, `country`, `start_year`, `end_year` | Indicadores y observaciones |
| OpenStreetMap | `search(bbox)` / `element(type,id)` | `bbox=min_lon,min_lat,max_lon,max_lat` | Objetos cartográficos |
| Overpass | `search(query, bbox)` / `run(ql)` | `bbox`, Overpass QL | Lugares y objetos OSM filtrados |
| DPLA | `search(query)` / `item(id)` | `page`, `limit`, campos `sourceResource.*` | Imágenes, documentos y moving image |
| Internet Archive | `search(query)` | `media_type="video"`, `page`, `limit` | Catálogo y archivos públicos de vídeo; sin API key |

## Credenciales

Las variables se guardan en:

```text
src/adapters/researcher_data/.env
```

Las principales son `WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN`,
`OPENVERSE_API_TOKEN`, `EUROPEANA_API_KEY`, `NASA_API_KEY` y
`DPLA_API_KEY`. Wikipedia, Wikidata, Commons, World Bank, OSM y Overpass
pueden comenzar sin API key. `CREDENTIALS.md` contiene los enlaces para
solicitar las credenciales.

## Prueba de personas

La prueba completa se ejecuta con:

```bash
RESEARCHER_REQUEST_TIMEOUT_SECONDS=60 \
RESEARCHER_REQUEST_MAX_RETRIES=0 \
.venv/bin/python pruebas/run_people_media_test.py
```

Genera:

```text
pruebas/personas/alan_turing/resultados.json
pruebas/personas/alan_turing/imagenes/
pruebas/personas/alan_turing/videos/
pruebas/personas/neil_armstrong/resultados.json
pruebas/personas/neil_armstrong/imagenes/
pruebas/personas/neil_armstrong/videos/
```

En cada `resultados.json`, `videos` contiene únicamente archivos descargados y
validados como `video/*`. `videos_referencias` contiene fichas de catálogo con
enlace público cuando un proveedor reconoce un vídeo pero no entrega un archivo
directo descargable; esas referencias no se cuentan como vídeos descargados.
