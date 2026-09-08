# Recursos externos en el render

## Objetivo

Permitir que una composición use imágenes, videos, música, fuentes, SVG,
JSON/Lottie, CSS o scripts declarados por URL sin obligar al cliente a subir
cada archivo manualmente, manteniendo un límite de seguridad adecuado para un
servicio que ejecuta HTML/JS de terceros.

## Decisión implementada

Cada job aplica el siguiente flujo antes de invocar Playwright, Remotion o
HyperFrames:

1. Busca URLs `http(s)` estáticas en HTML, CSS, JS, JSX y props, además de
   `audioUrl`.
2. Comprueba que el hostname está autorizado por `NETWORK_ALLOWLIST`, que no
   es una IP directa/privada y que cada redirección sigue cumpliendo esa regla.
3. Descarga el recurso una vez, con timeout, máximo de bytes y máximo de
   redirecciones configurables.
4. Lo guarda bajo el workdir aislado del job y reescribe cada referencia a un
   servidor HTTP loopback temporal.
5. Renderiza usando solo esa copia local; al terminar, el servidor y workdir
   se eliminan.

El navegador sigue necesitando HTTP para los medios: `file://` no es fiable
para CSS, video o fetch en Chromium. El loopback local evita relajar CORS o
desactivar la seguridad web.

## Efecto por motor

| Motor | Imágenes/video/fuentes/animaciones por URL | `audioUrl` remoto |
| --- | --- | --- |
| Playwright | Se reescriben y el guard de red autoriza el origin loopback. | Se descarga y FFmpeg lo mezcla al MP4. |
| Remotion | JSX y props reciben la URL loopback antes de `bundle()` y `renderMedia()`. | Se monta como `<Audio>` en la composición. |
| HyperFrames | HTML/CSS/JS se reescriben antes de ejecutar el CLI. | Se inyecta como `<audio>` temporizado. |

Remotion documenta que su renderer descarga audio y el audio de video para
incorporarlo en el output; materializarlo primero evita que cada proceso de
frames dependa de un CDN. Ver [renderMedia() de Remotion](https://www.remotion.dev/docs/renderer/render-media).

## Configuración

```env
NETWORK_ALLOWLIST=fonts.googleapis.com,fonts.gstatic.com,images.pexels.com,cdn.example.com
REMOTE_ASSET_TIMEOUT_MS=30000
REMOTE_ASSET_MAX_BYTES=262144000
REMOTE_ASSET_MAX_REDIRECTS=3
```

La allowlist usa hostnames exactos. Si un proveedor redirige a otro dominio,
ambos deben estar presentes. No uses `*` ni direcciones IP.

## Límites explícitos

- URLs creadas dinámicamente por código no se pueden detectar ni congelar
  antes del render. Deben declararse de forma estática o pasar en `props`.
- HLS/DASH, DRM, tokens que vencen, cookies/sesiones y recursos que requieren
  cabeceras privadas no forman parte de este contrato. Conviene descargar un
  MP4/MP3 permitido o usar un CDN propio estable.
- La descarga remota se conserva durante el job, no como biblioteca
  permanente. El MP4 y los inputs siguen quedando en `OUT_DIR`.
