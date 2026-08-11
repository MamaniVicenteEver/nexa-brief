# Guía de Publicación Automatizada y Gestión Multi-Cuenta

Esta guía documenta la arquitectura de publicación autónoma en Nexa Brief para **YouTube**, **Facebook** y **TikTok**, detallando cómo organizar múltiples canales/páginas, los formatos admitidos y los flujos de configuración.

> [!IMPORTANT]
> **CONFIGURACIÓN DE UNA SOLA VEZ (ONE-TIME SETUP)**
>
> Tanto para **YouTube** como para **Facebook**, el proceso de autorización y generación de credenciales se realiza **UNA SOLA VEZ**. 
> * **YouTube:** El script obtiene un `refresh_token` permanente. El `TokenManager` del sistema lo utiliza para solicitar un nuevo `access_token` temporal cada hora de forma transparente y automática, sin intervención humana.
> * **Facebook:** El script genera un `Long-Lived Page Access Token` (Token de Acceso de Página de Larga Duración) a partir de tu aplicación de Meta. Por diseño de Meta, estos tokens de página de larga duración **NUNCA EXPIRAN** (salvo revocación manual o cambio de contraseña de la cuenta personal vinculada).

---

## 📊 Tabla Comparativa de Formatos y Plataformas

| Plataforma | Tipo de Contenido | Relación de Aspecto | Duración Soportada | Flujo de Organización | Ejemplo JSON de Petición |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **YouTube** | Shorts | Vertical (9:16) | `< 60 segundos` | Se muestran en la sección "Shorts". | [Ver JSON de Shorts](#1-youtube-shorts) |
| | Estándar (Video largo) | Horizontal (16:9) | `> 60 segundos` | Se organiza a través de Playlists de YouTube. | [Ver JSON de YouTube Estándar](#2-youtube-estándar) |
| **Facebook** | Reels | Vertical (9:16) | `< 90 segundos` | Alta viralidad orgánica en la sección Reels. | [Ver JSON de Facebook Reels](#3-facebook-reels) |
| | Videos Tradicionales | Horizontal (16:9) o 1:1 | Sin límite práctico | Publicación directa al Feed de la Página. | [Ver JSON de Facebook Video](#4-facebook-video-tradicional) |
| **TikTok** | Videos | Vertical (9:16) | `< 10 minutos` | Flujo continuo en perfil. | [Ver JSON de TikTok](#5-tiktok-video) |

---

## 🛠️ Ejemplos de Peticiones JSON (API REST - `POST /api/v1/publish/`)

Si deseas activar la publicación de manera manual mediante peticiones HTTP a la API de Nexa Brief, utiliza las siguientes estructuras JSON en el cuerpo del request:

### 1. YouTube Shorts
Se envía un video vertical de menos de 60 segundos. YouTube detecta automáticamente la relación de aspecto vertical y la duración para catalogarlo como Short.
```json
{
  "video_path": "output/gym_lofi_01/tiktok_video.mp4",
  "title": "Beat Gym Motivación #Shorts",
  "description": "Sesión rápida de motivación. Música generada con IA por Drova Soft.",
  "tags": ["shorts", "gym", "lofi", "motivation"],
  "account_selector": "youtube:canal_1",
  "privacy": "public"
}
```

### 2. YouTube Estándar
Se envía un video horizontal (de cualquier duración).
```json
{
  "video_path": "output/gym_lofi_01/youtube_video.mp4",
  "title": "Gym Lofi Beats for Focus & Power | Deep Workout Session",
  "description": "Una hora completa de los mejores beats generativos para entrenar duro.\n\nProduced by Drova Soft Lab.",
  "tags": ["lofi", "gymbeats", "focus", "workout"],
  "account_selector": "youtube:canal_1",
  "privacy": "public"
}
```

### 3. Facebook Reels
Se envía un video vertical corto (menor a 90 segundos) destinado a la pestaña de Reels de la página vinculada.
```json
{
  "video_path": "output/gym_lofi_01/tiktok_video.mp4",
  "title": "Motivación Diaria 🚀",
  "description": "No te rindas hoy. #gymmotivation #lofi #focus",
  "tags": ["reels", "motivation", "lofi"],
  "account_selector": "facebook:pagina_1",
  "privacy": "public"
}
```

### 4. Facebook Video Tradicional
Se envía un video horizontal destinado al feed de publicaciones e interacciones generales de la página.
```json
{
  "video_path": "output/gym_lofi_01/youtube_video.mp4",
  "title": "Beats de Programación 💻",
  "description": "Colección completa de ritmos lofi para aumentar la concentración mientras programas.",
  "tags": ["facebookvideo", "coding", "relax", "productivity"],
  "account_selector": "facebook:pagina_1",
  "privacy": "public"
}
```

### 5. TikTok Video
TikTok requiere estrictamente videos en formato vertical (9:16).
```json
{
  "video_path": "output/gym_lofi_01/tiktok_video.mp4",
  "title": "Programando a las 3 AM con Lofi Beats 💻☕ #programmer #coding #lofi #foryou",
  "description": "Sesión nocturna de desarrollo.",
  "tags": ["programmer", "coding", "lofi", "foryou"],
  "account_selector": "tiktok:cuenta_1",
  "privacy": "public"
}
```

---

## 👥 Gestión Multi-Cuenta y Multi-Página

El sistema almacena los tokens de acceso y las credenciales encriptadas en `accounts.json`. Esto permite mapear múltiples cuentas por cada plataforma usando alias únicos.

### 🔴 YouTube: Agregar múltiples canales / cuentas personales

En YouTube, un único `client_secret.json` (Desktop App) puede recibir la autorización de cualquier número de canales o cuentas de Google.

1. **Vincular el Canal 1:**
   ```bash
   uv run scripts/youtube_auth_once.py --alias canal_1
   ```
   *Inicia sesión en el navegador con la Cuenta de Google del Canal 1.*

2. **Vincular el Canal 2:**
   ```bash
   uv run scripts/youtube_auth_once.py --alias canal_2
   ```
   *Inicia sesión en el navegador con la Cuenta de Google del Canal 2.*

### 🔵 Facebook: Agregar múltiples páginas y perfiles

Un único App ID y Client Secret de Meta puede gestionar múltiples páginas pertenecientes a diferentes perfiles.

1. **Múltiples páginas en el mismo perfil:**
   Cuando ejecutas el script de configuración, detectará todas las páginas que administra tu perfil y te permitirá seleccionar cuál deseas vincular bajo un alias determinado:
   ```bash
   uv run scripts/facebook_setup.py
   ```
   *El script te preguntará el alias de destino (ej: `pagina_1`, `pagina_2`).*

2. **Diferentes cuentas de Facebook:**
   Si deseas añadir páginas de otro usuario:
   * Inicia sesión en Facebook con el otro perfil en tu navegador.
   * Entra al Meta Graph API Explorer, selecciona la app y genera el User Token.
   * Ejecuta `uv run scripts/facebook_setup.py`, introduce el token y asígnale un alias (ej: `pagina_cliente_1`).

---

## 🚀 Comandos de Prueba y Diagnóstico

Para validar la conexión y subir videos de prueba de manera manual sin correr todo el pipeline de Nexa Brief, utiliza:

```bash
uv run scripts/test_publisher_tokens.py
```

Este script presentará un menú interactivo:
* Selecciona qué plataforma probar (`YouTube`, `Facebook` o `Ambas`).
* Buscará el video más reciente en tu carpeta `output/` y realizará la subida real.
