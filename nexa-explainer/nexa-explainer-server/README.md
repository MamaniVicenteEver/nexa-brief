# Nexa Brief Server — Backend Engine & API

Este es el backend de **Nexa Brief**, un servidor REST desarrollado en **FastAPI (Python)** que orquesta el pipeline de análisis, diseño visual, obtención de recursos, generación de HTML (con animaciones y visualizadores reactivos al audio), grabación de video mediante navegadores headless (Playwright) y su posterior publicación en redes sociales (YouTube, TikTok, Facebook).

En la arquitectura definitiva del monorepo, **`nexa-brief-server`** representa el único motor de backend que alimenta la interfaz del panel de control de Next.js (`nexa-brief-web`).

---

## Estructura del Proyecto

El servidor está estructurado siguiendo principios de **Arquitectura Hexagonal (Puertos y Adaptadores)** y un diseño de **Microkernel**:

```text
nexa-brief-server/
├── src/
│   ├── core/               # Reglas del dominio, puertos (interfaces) y el orquestador principal
│   │   ├── ports/          # Interfaces para IAs, imágenes, música y publicación
│   │   └── orchestrator.py # Controla la ejecución paralela y control de concurrencia de los jobs
│   ├── adapters/           # Implementaciones de infraestructura (Unsplash, Playwright, Gemini, etc.)
│   │   ├── ai/             # Adaptadores de modelos (Gemini, DeepSeek via Novita)
│   │   ├── media/          # Proveedores de imágenes (Pexels, Pixabay) y música (Jamendo, Pixabay)
│   │   ├── recorder/       # Motor de grabación (Playwright + FFmpeg)
│   │   └── publishing/     # Adaptadores de carga y renovación de tokens OAuth
│   ├── modules/            # Módulos de lógica procedimental por etapas (Etapas 1 a 7)
│   ├── presentation/       # Capa de API HTTP
│   │   └── api/
│   │       ├── routers/    # Endpoints organizados por dominio (videos, categories, publisher, oauth)
│   │       └── schemas/    # Modelos Pydantic de entrada y salida
│   ├── config/             # Configuración del entorno (.env) y configuración de logs
│   ├── skills/             # Skills en formato Markdown cargadas en runtime por los prompts de las IAs
│   └── categories/         # Archivos JSON de configuración de nichos/categorías
├── tests/                  # Suite de pruebas unitarias y de integración
├── data/                   # Biblioteca local de pistas de música
├── output/                 # Directorio de salida de los videos y logs generados
├── accounts.json           # Almacenamiento local cifrado de tokens OAuth para publicación
├── pyproject.toml / uv.lock# Gestión de dependencias y empaquetamiento (uv)
└── .env                    # Configuración de variables de entorno (API keys, llaves criptográficas)
```

---

## API Reference (Endpoints Activos)

Los endpoints están versionados bajo el prefijo `/api/v1` y documentados automáticamente mediante Swagger UI en `/docs`.

### 1. Categorías (`/api/v1/categories`)
*   **`GET /api/v1/categories`**: Devuelve una lista de los nichos musicales preconfigurados en `default_categories.json` y `user_categories.json`.
*   **`GET /api/v1/categories/{category_id}`**: Obtiene la información detallada de una categoría específica por su ID.

### 2. Pipelines y Videos (`/api/v1/videos`)
*   **`POST /api/v1/videos`**: Recibe una solicitud de generación por lotes (Batch). Retorna un estado `202 Accepted` de manera inmediata junto con el listado de Jobs creados en segundo plano.

### 3. Publicación y Canales (`/api/v1/publish`)
*   **`GET /api/v1/publish/accounts`**: Retorna el listado de canales/cuentas conectadas (YouTube, TikTok, Facebook) indicando si los tokens están vigentes (`ok`) o si requieren reautorización (`requires_reauth`).
*   **`POST /api/v1/publish/`**: Dispara la carga manual de un video local hacia una plataforma específica sin pasar por el pipeline completo.
*   **`GET /api/v1/publish/{platform}/{alias}/{video_id}`**: Lee el estado de publicación y metadatos de un video ya subido.
*   **`PUT /api/v1/publish/{platform}/{alias}/{video_id}`**: Permite modificar el título, descripción o etiquetas de un video en la plataforma (no soportado por TikTok).
*   **`DELETE /api/v1/publish/{platform}/{alias}/{video_id}`**: Elimina el video de la plataforma social indicada.

### 4. Flujos de Autorización OAuth
*   **YouTube**:
    *   `GET /api/oauth/youtube/start?alias=canal_1` -> Redirige al consent screen de Google.
    *   `GET /api/oauth/youtube/callback` -> Recibe el código de autorización y guarda las credenciales en `accounts.json`.
*   **TikTok**:
    *   `GET /api/v1/publish/auth/tiktok/start?alias=cuenta_1` -> Redirige al consent screen de TikTok.
    *   `GET /api/v1/publish/auth/tiktok/callback` -> Recibe el código de TikTok.
*   **Facebook**:
    *   `GET /api/v1/publish/auth/facebook/start?alias=pagina_1` -> Redirige al consent screen de Meta.
    *   `GET /api/v1/publish/auth/facebook/callback` -> Intercambia tokens e identifica las páginas administradas.

---

## Configuración del Entorno (.env)

El archivo `.env` en la raíz del backend controla las integraciones y comportamientos del motor:

```bash
# API Keys para Servicios de IA e Insumos
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
UNSPLASH_API_KEY=your_unsplash_api_key
PEXELS_API_KEY=your_pexels_api_key
PIXABAY_API_KEY=your_pixabay_api_key
JAMENDO_API_KEY=your_jamendo_api_key

# Configuración de Concurrencia
MAX_PARALLEL_JOBS=2

# Habilitación de Publicación Automática (Stage 9 del Pipeline)
ENABLE_AUTO_PUBLISHING=true
ACTIVE_ACCOUNT=youtube:canal_1

# Clave AES-256 para Cifrar tokens en accounts.json (Fernet format)
PUBLISHER_ENCRYPTION_KEY=your_fernet_aes_key

# Credenciales de Aplicación para Integraciones OAuth
YOUTUBE_CLIENT_ID=your_google_client_id
YOUTUBE_CLIENT_SECRET=your_google_client_secret
TIKTOK_CLIENT_ID=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
FACEBOOK_CLIENT_ID=your_facebook_app_id
```

---

## Instalación y Ejecución Local

1.  **Clonar el repositorio e ingresar al backend**:
    ```bash
    cd nexa-brief/nexa-brief-server
    ```
2.  **Instalar dependencias**:
    Utilizando `uv` (el gestor ultrarrápido de paquetes de Python):
    ```bash
    uv sync
    ```
3.  **Instalar el navegador Chromium para Playwright**:
    ```bash
    uv run playwright install chromium
    ```
4.  **Configurar variables**:
    Copia el archivo de plantilla y completa tus llaves:
    ```bash
    cp .env.example .env
    ```
5.  **Iniciar el servidor de desarrollo**:
    ```bash
    uv run uvicorn src.presentation.main:app --reload
    ```
    El servidor se levantará en `http://localhost:8000`. Puedes ingresar a `http://localhost:8000/docs` para interactuar con la consola interactiva de Swagger.
