# Contexto de las IAs en Nexa-Brief

El sistema emplea dos modelos de lenguaje diferentes, cada uno especializado en una fase del proceso. No se utiliza un unico modelo generalista; en su lugar, se asigna a cada tarea el modelo mas adecuado en terminos de costo y capacidad.

## Gemini 3.1 Flash-Lite (Google AI Studio)

Es el cerebro creativo y analitico. Interviene en tres etapas:

1. **Analizador de entrada**: recibe la peticion del usuario (a veces con campos incompletos) y la transforma en una estructura completa con categoria, genero, duracion, etiquetas de ambiente y una frase de busqueda para la imagen de fondo. Su respuesta es un JSON que sirve de base para el resto del pipeline.

2. **Disenador visual**: toma el resultado del analisis y el skill del genero musical correspondiente (archivo .md con un proceso creativo) y produce un plano de diseno en JSON. Este plano define la paleta de colores (maximo 4), la tipografia, el tipo de animacion y el estilo de visualizador de audio. No escribe codigo; describe lo que el HTML debe transmitir visualmente.

3. **Generador de resumen**: al finalizar la grabacion, recibe los datos del video (duracion, genero, colores usados, cancion) y redacta los metadatos para YouTube y TikTok. Proporciona titulos, descripciones, etiquetas y hashtags optimizados para cada plataforma.

## DeepSeek-V3.2 (Novita AI)

Es el responsable de la generacion de codigo. Se le proporciona un prompt construido a partir del plano de diseno, las rutas locales de la imagen y la musica, y el skill universal de HTML (`html_design.md`). Su tarea es producir un archivo HTML autosuficiente que cumpla las directrices visuales, incluya un visualizador de audio con Web Audio API y no dependa de librerias externas.

## Skills como extension del conocimiento

Para evitar prompts demasiado largos y rigidos, el conocimiento especifico se almacena en archivos Markdown (`skills/`). Estos documentos describen procesos y atmosferas, no listas de reglas estrictas. Las IAs los interpretan como un contexto creativo, lo que da lugar a resultados mas naturales y profesionales.

Las skills se dividen en:

- **Generos musicales** (`skills/genres/`): guian la paleta, la tipografia y la ambientacion visual de cada estilo (jazz, lofi, estudio, etc.).
- **HTML** (`skills/html/`): establecen los estandares tecnicos y esteticos del codigo generado, como el uso de maximo 4 colores, la presencia obligatoria del visualizador de audio o la prohibicion de emojis.
- **Metadatos** (`skills/output/`): pautas para redactar titulos y descripciones efectivas en YouTube y TikTok.

Esta separacion permite mejorar o ampliar el sistema sin modificar el codigo: anadir un nuevo genero musical solo requiere crear un nuevo archivo .md en `skills/genres/`.




❯ uv add \
google-genai \
openai \
httpx \
pydantic \
pydantic-settings \
python-dotenv \
playwright \
aiofiles \
orjson \
rich \
structlog
Using CPython 3.10.12 interpreter at: /usr/bin/python3.10
Creating virtual environment at: .venv
Resolved 43 packages in 2.49s
Prepared 24 packages in 25.33s
Installed 41 packages in 58ms
 + aiofiles==25.1.0
 + annotated-types==0.7.0
 + anyio==4.13.0
 + certifi==2026.5.20
 + cffi==2.0.0
 + charset-normalizer==3.4.7
 + cryptography==49.0.0
 + distro==1.9.0
 + exceptiongroup==1.3.1
 + google-auth==2.54.0
 + google-genai==2.8.0
 + greenlet==3.5.1
 + h11==0.16.0
 + httpcore==1.0.9
 + httpx==0.28.1
 + idna==3.18
 + jiter==0.15.0
 + markdown-it-py==4.2.0
 + mdurl==0.1.2
 + openai==2.41.1
 + orjson==3.11.9
 + playwright==1.60.0
 + pyasn1==0.6.3
 + pyasn1-modules==0.4.2
 + pycparser==3.0
 + pydantic==2.13.4
 + pydantic-core==2.46.4
 + pydantic-settings==2.14.1
 + pyee==13.0.1
 + pygments==2.20.0
 + python-dotenv==1.2.2
 + requests==2.34.2
 + rich==15.0.0
 + sniffio==1.3.1
 + structlog==26.1.0
 + tenacity==9.1.4
 + tqdm==4.68.2
 + typing-extensions==4.15.0
 + typing-inspection==0.4.2
 + urllib3==2.7.0
 + websockets==16.0
❯ uv add --dev \
pytest \
pytest-asyncio \
pytest-cov \
ruff \
mypy
Resolved 58 packages in 1.95s
⠴ Preparing packages... (10/12)
⠧ Preparing packages... (10/12)
Prepared 12 packages in 13.61s
Installed 15 packages in 52ms
 + ast-serialize==0.5.0
 + backports-asyncio-runner==1.2.0
 + coverage==7.14.1
 + iniconfig==2.3.0
 + librt==0.11.0
 + mypy==2.1.0
 + mypy-extensions==1.1.0
 + packaging==26.2
 + pathspec==1.1.1
 + pluggy==1.6.0
 + pytest==9.1.0
 + pytest-asyncio==1.4.0
 + pytest-cov==7.1.0
 + ruff==0.15.17
 + tomli==2.4.1
❯ uv run playwright install chromium
Downloading Chrome for Testing 148.0.7778.96 (playwright chromium v1223) from https://cdn.playwright.dev/builds/cft/148.0.7778.96/linux64/chrome-linux64.zip
175.4 MiB [====================] 100% 0.0s
Chrome for Testing 148.0.7778.96 (playwright chromium v1223) downloaded to /home/university/.cache/ms-playwright/chromium-1223
Downloading FFmpeg (playwright ffmpeg v1011) from https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip
2.3 MiB [====================] 100% 0.0s
FFmpeg (playwright ffmpeg v1011) downloaded to /home/university/.cache/ms-playwright/ffmpeg-1011
Downloading Chrome Headless Shell 148.0.7778.96 (playwright chromium-headless-shell v1223) from https://cdn.playwright.dev/builds/cft/148.0.7778.96/linux64/chrome-headless-shell-linux64.zip
113.2 MiB [====================] 100% 0.0s
Chrome Headless Shell 148.0.7778.96 (playwright chromium-headless-shell v1223) downloaded to /home/university/.cache/ms-playwright/chromium_headless_shell-1223
