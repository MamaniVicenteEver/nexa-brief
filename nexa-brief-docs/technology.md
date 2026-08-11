# Stack Tecnologico de Nexa-Brief

## Lenguaje y gestor de paquetes

- **Python 3.10+**: elegido por su ecosistema maduro en IA, asincronia (asyncio) y facilidad para integrar herramientas como Playwright y FFmpeg.
- **uv**: gestor de paquetes rapido que reemplaza a pip y virtualenv, usado para instalar dependencias y gestionar el entorno.

## Backend y API

- **FastAPI**: framework asincrono para construir APIs REST con documentacion automatica (OpenAPI).
- **Pydantic v2**: validacion de datos y definicion de esquemas para requests y configuracion.
- **Uvicorn**: servidor ASGI de alto rendimiento para desplegar la aplicacion.

## Inteligencia artificial

- **Gemini 3.1 Flash-Lite** (Google AI Studio): modelo multimodal ligero y de bajo costo, utilizado en tres roles: analizador de entrada, disenador visual y generador de resumenes. Se accede mediante el SDK google-genai.
- **DeepSeek-V3.2** (Novita AI): modelo de lenguaje optimizado para generacion de codigo, responsable de crear el HTML profesional. Se consume via API compatible con OpenAI, usando el SDK openai.

## Imagenes y multimedia

- **Unsplash API**: fuente principal de imagenes de alta calidad. Requiere una Access Key gratuita.
- **Pexels API**: alternativa a Unsplash con un catalogo diferente.
- **Pixabay API**: tercera opcion para imagenes.
- **Pillow**: biblioteca para generar miniaturas (thumbnail) a partir de la imagen de fondo.

## Musica

- **Biblioteca local**: carpeta `data/music_library/` organizada por genero. Primer nivel de cache.
- **Pixabay Music API**: descarga directa de pistas libres de derechos.
- **Free Music Archive (FMA)**: API para musica Creative Commons.
- **Jamendo API**: extenso catalogo de musica independiente con licencias CC.
- **yt-dlp**: ultimo recurso para descargar pistas CC desde YouTube Audio Library.

## Grabacion y edicion

- **Playwright (Python)**: controla un navegador Chromium headless para grabar la pantalla mientras se reproduce el HTML.
- **FFmpeg**: mezcla el video mudo con la pista de audio, genera el video final para YouTube y recorta el clip para TikTok.

## Logging y utilidades

- **structlog**: logs estructurados en JSON, orientados a auditoria y analisis posterior.
- **httpx**: cliente HTTP asincrono para consumir APIs externas (Gemini, Unsplash, etc.).
- **aiofiles**: operaciones de archivo asincronas para no bloquear el bucle de eventos.
- **orjson**: serializacion JSON de alto rendimiento.
- **rich**: salida colorida en terminal para desarrollo y monitoreo.

## Pruebas y calidad de codigo

- **pytest**: framework de pruebas unitarias e integracion.
- **pytest-asyncio**: soporte para pruebas de funciones asincronas.
- **pytest-cov**: metricas de cobertura de codigo.
- **ruff**: linter y formateador rapido.
- **mypy**: verificador de tipos estatico.