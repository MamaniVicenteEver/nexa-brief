# Nexa Brief — Scripts de Utilidad y Configuración

Esta carpeta contiene todos los scripts auxiliares de la aplicación Nexa Brief, organizados según su propósito.

---

## 🔑 1. Autenticación y Credenciales (OAuth / API)

Estos scripts se utilizan para realizar el flujo de autorización OAuth 2.0 y guardar los tokens cifrados en `accounts.json` de manera autónoma.

*   ### [`youtube_auth_once.py`](youtube_auth_once.py)
    *   **Propósito:** Inicia el flujo de autenticación local para la YouTube Data API v3 usando credenciales de tipo *Desktop/Installed App*.
    *   **Uso:**
        ```bash
        uv run scripts/youtube_auth_once.py --alias canal_1
        ```
    *   **Salida:** Genera y guarda de manera encriptada el `refresh_token` y el `access_token` en `accounts.json`.

*   ### [`facebook_setup.py`](facebook_setup.py)
    *   **Propósito:** Intercambia un token temporal de usuario de Meta (obtenido en Graph Explorer) por un **Page Access Token permanente** de larga duración que nunca expira.
    *   **Uso:**
        ```bash
        uv run scripts/facebook_setup.py
        ```
    *   **Salida:** Permite seleccionar la página de Facebook a vincular y guarda su token cifrado en `accounts.json` bajo el alias `pagina_1`.

*   ### [`youtube_oauth_setup.py`](youtube_oauth_setup.py)
    *   **Propósito:** Script heredado (Legacy) para configuración de redirección OAuth web. Mantener solo para propósitos de referencia o depuración avanzada.

---

## 🔬 2. Pruebas y Diagnóstico

Herramientas para validar la integridad de los tokens y probar publicaciones individuales sin ejecutar todo el pipeline de producción.

*   ### [`test_publisher_tokens.py`](test_publisher_tokens.py)
    *   **Propósito:** Suite interactiva de verificación de tokens. Permite realizar subidas reales de prueba a tus cuentas configuradas en YouTube y Facebook utilizando el video más reciente que se encuentre en la carpeta `output/`.
    *   **Uso:**
        ```bash
        uv run scripts/test_publisher_tokens.py
        ```

---

## 🌐 3. Scraping y Descargas de Recursos (Assets)

Scripts dedicados a descargar música, videos o imágenes de fondo para alimentar el motor de renderizado de Nexa Brief.

*   ### [`scrape_backgrounds_v3.py`](scrape_backgrounds_v3.py)
    *   **Propósito:** El scraper principal del sistema para obtener imágenes de fondo y música libre de derechos de autor de fuentes como Pexels, Pixabay y Jamendo.
    *   **Uso:**
        ```bash
        uv run scripts/scrape_backgrounds_v3.py
        ```

*   ### [`scrape_backgrounds.py`](scrape_backgrounds.py)
    *   **Propósito:** Versión heredada y simplificada del scraper de fondos.

*   ### [`scrape_anime.py`](scrape_anime.py)
    *   **Propósito:** Scraper especializado para descargar recursos visuales con temática de anime o arte digital para categorías específicas de videos.
    *   **Uso:**
        ```bash
        uv run scripts/scrape_anime.py
        ```

*   ### [`nexa_brief_ds_scraper.py`](nexa_brief_ds_scraper.py)
    *   **Propósito:** Utilidad de raspado de datos y scraping dirigida para recopilación y formateo de datasets de Nexa Brief.
