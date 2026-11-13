# `researcher_data`

Adaptador independiente para investigar y reunir datos abiertos. Está dentro
de `src/adapters/`, pero todavía no se importa desde `presentation/main.py`,
routers ni desde el pipeline de Nexa Brief.

Las implementaciones HTTP de los 13 proveedores viven en
`infrastructure/`; `factory.py`, `config.py` y los modelos quedan en la raíz
del adaptador para que el futuro wiring no dependa de un proveedor concreto.

## Qué incluye

| Archivo dentro de `infrastructure/` | Proveedor | Acceso preparado |
| --- | --- | --- |
| `wikipedia.py` | Wikipedia / MediaWiki | Público, sin key |
| `wikidata.py` | Wikidata + SPARQL | Público, sin key |
| `commons.py` | Wikimedia Commons | Público, sin key |
| `wikimedia_enterprise.py` | Wikimedia Enterprise | JWT login/refresh |
| `openverse.py` | Openverse | Público; token opcional |
| `library_of_congress.py` | Library of Congress | Público, sin key |
| `europeana.py` | Europeana | `EUROPEANA_API_KEY` |
| `nasa.py` | NASA Open APIs | `DEMO_KEY` o `NASA_API_KEY` |
| `nasa_library.py` | NASA Image & Video Library | Público |
| `world_bank.py` | World Bank Indicators | Público, sin key |
| `openstreetmap.py` | OpenStreetMap API | Público; lectura por bbox |
| `overpass.py` | Overpass API | Público; consultas Overpass QL |
| `dpla.py` | Digital Public Library of America | `DPLA_API_KEY` |

Para conseguir las credenciales y saber cuáles son obligatorias, seguir la
guía [CREDENTIALS.md](CREDENTIALS.md).

Todos devuelven `ResearchResult` y `ResearchResponse`. Los campos particulares
del proveedor se conservan en `metadata`, así no se pierde información útil.

## Configuración

```bash
cd nexa-brief/nexa-brief-server
cp src/adapters/researcher_data/.env.example src/adapters/researcher_data/.env
# Editar el .env y añadir keys/tokens cuando los tengas
```

El `.env` local ya existe con valores vacíos y está ignorado por git. No poner
claves reales en `.env.example`.

## Uso directo

```python
from src.adapters.researcher_data import build_researcher_data

researcher = build_researcher_data()

# Consulta varios proveedores en paralelo. Los que no tengan key aparecen en
# provider_errors y no bloquean los resultados públicos.
response = await researcher.search(
    "Machu Picchu",
    providers=["wikipedia", "wikidata", "commons", "openverse"],
    limit=5,
    language="es",
)

for item in response.results:
    print(item.provider, item.title, item.url)
```

Para conservar la respuesta y paginación de un solo proveedor:

```python
wikipedia = await researcher.search_one("wikipedia", "Ada Lovelace", language="en")
article = await researcher.provider("wikipedia").article("Ada Lovelace", language="en")
entity = await researcher.provider("wikidata").entity("Q7259")
sparql_rows = await researcher.provider("wikidata").sparql(
    "SELECT ?item ?itemLabel WHERE { ?item wdt:P31 wd:Q5. SERVICE wikibase:label { bd:serviceParam wikibase:language 'es'. } }",
    limit=10,
)
```

## Casos que requieren parámetros específicos

- `wikimedia_enterprise.search()` busca el nombre exacto de un artículo. Se
  debe llamar antes a `login()` o colocar `WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN`.
- `openverse.search(..., media_type="image" | "audio")` separa imágenes y audio.
- `nasa.search()` consulta APOD; para colecciones usa `mars_photos()`,
  `neo_feed()` o `earth_imagery()`.
- `world_bank.search()` filtra el catálogo de indicadores localmente. Para
  observaciones use `indicator("SP.POP.TOTL", country="BOL")`.
- `openstreetmap.search()` espera un bbox
  `min_lon,min_lat,max_lon,max_lat`; la API principal no es full-text.
- `overpass.search()` acepta texto simple y construye una consulta segura con
  bbox, o acepta Overpass QL completo si el texto empieza con `[out:`.

## Decisiones de robustez

- timeout y reintentos exponenciales para `429` y errores transitorios `5xx`;
- User-Agent configurable para respetar las políticas de los servicios;
- consultas en paralelo con límite configurable;
- caché en memoria de 15 minutos por consulta, proveedor y filtros;
- deduplicación por URL y tipo de recurso;
- un proveedor sin credencial o caído no interrumpe al resto;
- no descarga archivos ni guarda respuestas en disco todavía;
- los endpoints no quedan expuestos por HTTP hasta una integración posterior.

## Verificación

Desde `nexa-brief-server`:

```bash
uv run pytest tests/unit/test_researcher_data.py -q
uv run ruff check src/adapters/researcher_data tests/unit/test_researcher_data.py
```

Los tests usan `httpx.MockTransport`; no llaman a Internet ni consumen cuotas.
