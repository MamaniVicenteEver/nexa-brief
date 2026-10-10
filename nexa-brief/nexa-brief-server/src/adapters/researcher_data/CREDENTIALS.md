# Credenciales de `researcher_data`

Esta guía indica qué proveedores necesitan credenciales, dónde obtenerlas y en
qué variable ponerlas. Ejecuta los pasos desde:

```bash
cd /home/university/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server
cp src/adapters/researcher_data/.env.example src/adapters/researcher_data/.env
```

El archivo `.env` ya está ignorado por git. Nunca publiques una key, un token,
una contraseña ni el contenido completo de ese archivo.

## Resumen rápido

| Proveedor | ¿Necesita key/token? | Variable principal |
| --- | --- | --- |
| Wikipedia / MediaWiki | No | ninguna |
| Wikidata / SPARQL | No | ninguna |
| Wikimedia Commons | No | ninguna |
| Wikimedia Enterprise | Sí: cuenta + JWT | `WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN` |
| Openverse | No para empezar; token opcional | `OPENVERSE_API_TOKEN` |
| Library of Congress | No | ninguna |
| Europeana | Sí: API key | `EUROPEANA_API_KEY` |
| NASA APIs | No para probar (`DEMO_KEY`); recomendable una propia | `NASA_API_KEY` |
| NASA Image & Video Library | No | ninguna |
| World Bank | No | ninguna |
| OpenStreetMap | No | `RESEARCHER_USER_AGENT` |
| Overpass | No | `RESEARCHER_USER_AGENT` |
| DPLA | Sí: API key | `DPLA_API_KEY` |

## 1. Wikipedia / MediaWiki — no hay que conseguir key

1. Abre la [documentación oficial de búsqueda MediaWiki](https://www.mediawiki.org/wiki/API%3ASearch/en).
2. No crees una cuenta ni registres una aplicación para las búsquedas públicas
   de lectura.
3. Deja estas variables como están:

   ```dotenv
   WIKIPEDIA_LANGUAGE=es
   WIKIPEDIA_API_URL=https://es.wikipedia.org/w/api.php
   WIKIPEDIA_REST_URL=https://es.wikipedia.org/w/rest.php/v1
   ```

4. Si quieres consultar otro idioma, cambia `es` por `en`, `pt`, `fr`, etc.

## 2. Wikidata / SPARQL — no hay que conseguir key

1. Abre el [Wikidata Query Service](https://query.wikidata.org/).
2. Prueba las consultas en la [guía oficial de SPARQL](https://www.wikidata.org/wiki/Wikidata%3ASPARQL_query_service).
3. No pongas ninguna key. El adaptador usa:

   ```dotenv
   WIKIDATA_API_URL=https://www.wikidata.org/w/api.php
   WIKIDATA_SPARQL_URL=https://query.wikidata.org/sparql
   ```

4. Para usar consultas automatizadas, siempre envía un `User-Agent` descriptivo
   y limita los resultados con `LIMIT`.

## 3. Wikimedia Commons — no hay que conseguir key

1. Revisa la [documentación de Commons API](https://commons.wikimedia.org/wiki/Commons%3AAPI).
2. No registres una aplicación para búsquedas públicas.
3. Deja esta URL en el `.env`:

   ```dotenv
   WIKIMEDIA_COMMONS_API_URL=https://commons.wikimedia.org/w/api.php
   ```

4. Antes de usar una imagen, revisa la licencia del archivo. Commons puede
   devolver archivos con licencias distintas.

## 4. Wikimedia Enterprise — cuenta y token JWT

Enterprise no usa una API key fija; usa un `access_token` JWT y un
`refresh_token`.

1. Crea una cuenta gratuita en el [registro oficial de Wikimedia Enterprise](https://dashboard.enterprise.wikimedia.com/signup/).
2. Confirma tu correo y entra al dashboard.
3. Usa el mismo `username` en minúsculas y la contraseña elegida.
4. Solicita los tokens con este comando. Sustituye los valores localmente y no
   los pegues en un chat:

   ```bash
   curl -X POST https://auth.enterprise.wikimedia.com/v1/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"TU_USUARIO","password":"TU_PASSWORD"}'
   ```

5. La respuesta contiene `access_token`, `refresh_token` y `expires_in`.
6. Copia los valores al `.env`:

   ```dotenv
   WIKIMEDIA_ENTERPRISE_USERNAME=tu_usuario
   WIKIMEDIA_ENTERPRISE_PASSWORD=tu_password
   WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN=el_access_token
   WIKIMEDIA_ENTERPRISE_REFRESH_TOKEN=el_refresh_token
   WIKIMEDIA_ENTERPRISE_PROJECT=enwiki
   ```

7. La documentación oficial está en [Getting Started](https://enterprise.wikimedia.com/docs/)
   y [Authentication](https://enterprise.wikimedia.com/docs/authentication/).

## 5. Openverse — funciona sin key; token opcional

Puedes comenzar sin credenciales. Si necesitas límites más altos o una
identidad de aplicación:

1. Abre la [especificación oficial de Openverse API](https://api.openverse.org/v1/).
2. Registra la aplicación mediante `POST`:

   ```bash
   curl -X POST https://api.openverse.org/v1/auth_tokens/register/ \
     -H 'Content-Type: application/json' \
     -d '{"name":"Nexa Brief","description":"Investigación de imágenes y audio abiertos","email":"TU_EMAIL"}'
   ```

3. Guarda el `client_id` y `client_secret` que devuelve la respuesta.
4. Solicita el token de acceso:

   ```bash
   curl -X POST https://api.openverse.org/v1/auth_tokens/token/ \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'grant_type=client_credentials&client_id=TU_CLIENT_ID&client_secret=TU_CLIENT_SECRET'
   ```

5. Copia el `access_token` recibido en:

   ```dotenv
   OPENVERSE_API_TOKEN=el_access_token
   ```

El token se envía como `Bearer`. Si solo quieres empezar a probar, deja la
variable vacía y el adaptador hará búsquedas anónimas.

## 6. Library of Congress — no hay que conseguir key

1. Lee la [documentación oficial del JSON API](https://www.loc.gov/apis/json-and-yaml/).
2. No registres una cuenta ni una key: el acceso público no requiere
   autenticación.
3. Deja esta variable:

   ```dotenv
   LIBRARY_OF_CONGRESS_API_URL=https://www.loc.gov
   ```

4. Usa filtros y paginación para respetar los límites de servicio.

## 7. Europeana — API key obligatoria

1. Abre la página oficial [Europeana APIs](https://www.europeana.eu/en/apis).
2. Pulsa **Get your free API key**.
3. Crea una cuenta gratuita de Europeana.
4. Confirma el correo electrónico e inicia sesión.
5. En la sección de cuenta/API keys solicita una **personal key** para pruebas.
   Si después necesitamos un límite mayor para un proyecto, se puede pedir una
   **project key**.
6. Copia la key en:

   ```dotenv
   EUROPEANA_API_KEY=tu_wskey
   ```

7. La documentación también está en [Europeana API documentation](https://europeana.atlassian.net/wiki/spaces/WEBAPI/overview).

## 8. NASA APIs — DEMO_KEY o key propia

1. Para empezar puedes dejar:

   ```dotenv
   NASA_API_KEY=DEMO_KEY
   ```

2. Para obtener una key propia abre [NASA Open APIs](https://api.nasa.gov/).
3. Completa el formulario **Generate API Key** con tu nombre, correo y uso.
4. Copia la key recibida en:

   ```dotenv
   NASA_API_KEY=tu_api_key
   ```

5. Mantén estas URLs para los dos servicios NASA:

   ```dotenv
   NASA_API_URL=https://api.nasa.gov
   NASA_IMAGES_API_URL=https://images-api.nasa.gov
   ```

`DEMO_KEY` sirve para explorar, pero tiene límites más bajos que una key
propia. La documentación de límites y autenticación está en la [referencia de
NASA Open APIs](https://api.nasa.gov/index.html).

## 9. NASA Image & Video Library — no hay que conseguir key

1. Abre la [documentación oficial de NASA Image and Video Library](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf).
2. No registres una key para búsquedas públicas.
3. Deja:

   ```dotenv
   NASA_IMAGES_API_URL=https://images-api.nasa.gov
   ```

## 10. World Bank — no hay que conseguir key

1. Abre la [documentación oficial de Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api).
2. No registres una cuenta ni una key para los indicadores públicos.
3. Deja:

   ```dotenv
   WORLD_BANK_API_URL=https://api.worldbank.org/v2
   ```

4. Para datos concretos usa el código del indicador, por ejemplo
   `SP.POP.TOTL`, y un país como `BOL`.

## 11. OpenStreetMap — no hay API key; sí User-Agent

1. No registres una key para la API pública de lectura.
2. Configura un User-Agent identificable con un correo real:

   ```dotenv
   RESEARCHER_USER_AGENT=NexaBriefResearcher/0.1 (contact: TU_EMAIL)
   OPENSTREETMAP_API_URL=https://api.openstreetmap.org/api/0.6
   ```

3. Lee la [política oficial de uso de la API de OSM](https://operations.osmfoundation.org/policies/api/).
4. Para búsquedas por texto o muchas entidades utiliza Overpass; la API base de
   OSM se usa aquí para elementos y mapas por `bbox`.

## 12. Overpass — no hay API key; sí User-Agent y consultas pequeñas

1. No registres una key.
2. Mantén el endpoint principal y el fallback:

   ```dotenv
   OVERPASS_API_URL=https://overpass-api.de/api/interpreter
   OVERPASS_FALLBACK_API_URL=https://overpass.kumi.systems/api/interpreter
   ```

3. Usa un `bbox` siempre que sea posible:

   ```dotenv
   OVERPASS_DEFAULT_BBOX=-68.20,-17.50,-66.90,-16.00
   ```

4. Consulta la [página oficial de Overpass](https://overpass-api.de/) y evita
   consultas globales costosas.

## 13. DPLA — API key obligatoria

1. Lee la [política oficial de API keys de DPLA](https://pro.dp.la/developers/policies).
2. Solicita la key enviando tu correo mediante `POST`:

   ```bash
   curl -X POST https://api.dp.la/v2/api_key/TU_EMAIL
   ```

3. DPLA enviará por correo una key de 32 caracteres.
4. Copia la key en:

   ```dotenv
   DPLA_API_KEY=tu_key_de_32_caracteres
   ```

5. La base de consultas es `https://api.dp.la/v2/items`; la key se envía como
   parámetro `api_key`.

## Orden recomendado para configurarlas

Para probar pronto y sin esperar aprobaciones, rellena primero:

1. `RESEARCHER_USER_AGENT` con tu correo.
2. `NASA_API_KEY=DEMO_KEY`.
3. Ninguna key para Wikipedia, Wikidata, Commons, LOC, NASA Library, World
   Bank, OSM y Overpass.
4. Europeana.
5. DPLA.
6. Wikimedia Enterprise.
7. Openverse solo si necesitas límites autenticados.

Después de guardar el `.env`, no subas el archivo a git. Los valores se cargan
automáticamente desde `src/adapters/researcher_data/.env`.
