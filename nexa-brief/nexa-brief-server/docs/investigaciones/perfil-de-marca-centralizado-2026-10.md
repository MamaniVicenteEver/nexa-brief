# Perfil de marca centralizado: editar foto, portada, nombre y descripción de todos los canales desde Nexa

Fecha: 2026-10-20 · Estado: estudio (sin implementar)

## 1. La pregunta

¿Se puede cambiar desde `/canales` la foto de perfil, la portada, el nombre y la descripción de una
marca (p. ej. NodeTech) y que se aplique sola en YouTube, Facebook, Instagram y TikTok?

**Respuesta corta: en parte.** Ninguna red deja cambiar todo por API. Descripción y portada se pueden
centralizar en YouTube y Facebook; la foto de perfil solo en Facebook; el nombre en ninguna;
Instagram y TikTok no permiten editar nada del perfil por API. Lo viable es un **perfil de marca
único en Nexa** que aplica solo lo que cada red permite y, para el resto, prepara los archivos a la
medida justa y deja una lista guiada para hacerlo a mano en un minuto.

## 2. Qué permite cada red (verificado en la documentación oficial, 2026-10-20)

| Dato | YouTube (Data API v3) | Facebook (Página, Graph API) | Instagram (Graph API) | TikTok |
|---|---|---|---|---|
| Nombre / título | ❌ `channelTitleUpdateForbidden` | ❌ no está entre los campos editables (además Meta revisa los cambios de nombre) | ❌ solo lectura | ❌ |
| Descripción | ✅ `channels.update` → `brandingSettings.channel.description` (+ traducciones en `localizations`) | ✅ `POST /{page-id}` → `about` (es la «Descripción» de la página) y `description` | ❌ `biography` es solo lectura | ❌ |
| Foto de perfil | ❌ sin endpoint (se cambia en la cuenta de Google / YouTube Studio) | ✅ `POST /{page-id}/picture` (URL o id de foto) | ❌ `profile_picture_url` solo lectura | ❌ |
| Portada / banner | ✅ `channelBanners.insert` (16:9, ≥ 2048×1152, ≤ 6 MB, 50 unidades de cuota) + `channels.update` → `brandingSettings.image.bannerExternalUrl` | ✅ `POST /{page-id}` → `cover` (solo admin/editor con EDIT_PROFILE; puede pedir `business_management`) | — (Instagram no tiene portada) | — |
| Palabras clave | ✅ `brandingSettings.channel.keywords` | — | — | — |
| Sitio web / contacto | (enlaces del canal: no por API) | ✅ `website`, `phone`, `emails` | ❌ | ❌ |

Detalles que importan para implementarlo:
- **YouTube `channels.update` borra lo que no se manda**: si un campo de `brandingSettings` ya tiene
  valor y no se envía, queda vacío. Siempre: leer (`channels.list`), modificar y reenviar todo.
- Permisos: YouTube ya alcanza con `youtube.force-ssl` (lo pedimos). Facebook necesita
  `pages_manage_metadata` (lo pedimos al conectar páginas) y, para la portada, rol de editor con
  EDIT_PROFILE; algunas funciones pueden pedir App Review de Meta.
- Instagram: la Graph API solo permite **leer** `biography`, `name`, `profile_picture_url`. No hay
  forma oficial de editarlos (las herramientas que lo prometen automatizan el navegador, lo que va
  contra los términos de Meta y arriesga la cuenta: descartado).
- TikTok: la API pública (Login Kit / Display / Content Posting) no tiene edición de perfil.

## 3. Propuesta

### 3.1 La marca como entidad del backend
Hoy la «marca» se deduce en el frontend comparando nombres (`brand-groups.ts`: NODECONOMY =
NodeEconomy). Pasa a ser un dato: colección `brands` con

```jsonc
{ "brand_id": "nodetech", "name": "NodeTech",
  "description": "…", "keywords": ["tecnología", "historia de la tecnología"],
  "website": "https://…",
  "avatar": "brands/nodetech/avatar.png",     // master cuadrado ≥ 1080×1080
  "cover": "brands/nodetech/cover.png",       // master ≥ 2560×1440
  "accounts": ["youtube:nodetech", "facebook:pagina_3", "instagram:instagram_2"],
  "updated_at": … }
```
La agrupación por nombre queda solo como sugerencia inicial al crear la marca.

### 3.2 Un puerto más, igual que la sincronización de canales
`ChannelProfilePort` (en `src/core/ports/`), separado de publicar y de leer el catálogo:

```python
class ProfileField(StrEnum): DESCRIPTION, KEYWORDS, AVATAR, COVER, WEBSITE, NAME

class ChannelProfilePort(ABC):
    def editable_fields(self) -> set[ProfileField]: ...          # matriz de la sección 2
    async def read_profile(self, alias) -> RemoteProfile: ...     # lo que hay hoy en la red
    async def apply_profile(self, alias, patch: ProfilePatch) -> list[FieldResult]: ...
# FieldResult: field + status ("applied" | "manual" | "failed") + mensaje
```
- YouTube implementa DESCRIPTION, KEYWORDS, COVER; Facebook DESCRIPTION, AVATAR, COVER, WEBSITE;
  Instagram y TikTok solo `read_profile` (todo lo demás sale como «manual»).
- `src/core/brand_profile.py` (sin saber de redes): recorre las cuentas de la marca, pide a cada
  adaptador lo suyo y junta el resultado. Una red que falla no frena a las demás.

### 3.3 Imágenes: un master, un recorte por red
`src/modules/brand_assets.py` genera desde los dos masters (Pillow):

| Pieza | Medida | Notas |
|---|---|---|
| YouTube banner | 2560×1440, JPEG ≤ 6 MB | zona segura central 1546×423 (lo que se ve en todos los dispositivos) |
| Facebook portada | 1640×624 (se muestra 820×312 / 640×360 en móvil) | |
| Facebook / Instagram / TikTok / YouTube foto | 1080×1080 → 720×720 / 320×320 / 800×800 | se muestra en círculo: vista previa con máscara |

La UI muestra la zona segura para que el texto del banner no se corte.

### 3.4 Lo que no se puede por API: lista guiada
Para cada campo «manual» la pantalla da: el archivo ya recortado para descargar (o el texto para
copiar) + el enlace directo a la pantalla de edición de esa red (YouTube Studio → Personalización,
Instagram → Editar perfil, TikTok → Editar perfil) + un botón «Ya lo hice» que vuelve a leer el
perfil y lo marca como al día.

### 3.5 Desfase (drift)
La sincronización diaria de canales ya lee cada cuenta: se suma `read_profile` y se compara con la
marca. Si alguien cambia la descripción desde la app de YouTube, la tarjeta muestra «distinto de la
marca» con las dos versiones y un botón para aplicar la de Nexa o adoptar la de la red.

### 3.6 Pantalla
`/canales` → pestaña **Marcas**: una tarjeta por marca con su avatar, portada, descripción y las
cuentas vinculadas (con el estado de cada una: al día / manual pendiente / distinto). Editor con
vista previa por red y un único botón **Aplicar en todas**, que responde campo por campo.

### 3.7 API
```
GET    /brands                         marcas + estado por cuenta
POST   /brands  · PATCH /brands/{id}   crear / editar (texto)
PUT    /brands/{id}/avatar|cover       subir master (multipart)
POST   /brands/{id}/apply              aplica en todas sus cuentas → resultado por cuenta y campo
POST   /brands/{id}/check              relee perfiles (desfase / «ya lo hice»)
```

## 4. Plan por fases

1. **Marca como entidad + descripción centralizada** (YouTube + Facebook): la parte con más valor y
   menos riesgo. Incluye la lectura de perfil de Instagram/TikTok para mostrar el estado.
2. **Portada**: banner de YouTube y portada de Facebook, con recortes y zona segura.
3. **Foto de perfil**: Facebook por API; YouTube, Instagram y TikTok como lista guiada con el
   archivo listo.
4. **Desfase** en la sincronización diaria.

Riesgos: la portada de Facebook puede requerir `business_management`/App Review (probar primero con
una página propia); el banner de YouTube falla con `bannerAlbumFull` si el álbum de arte del canal
está lleno; el nombre nunca se automatiza (YouTube lo prohíbe y Meta lo revisa a mano).

## Fuentes
- YouTube `channels.update`: https://developers.google.com/youtube/v3/docs/channels/update
- YouTube `channelBanners.insert`: https://developers.google.com/youtube/v3/docs/channelBanners/insert
- Facebook Page (campos actualizables): https://developers.facebook.com/docs/graph-api/reference/page/
- Facebook Page Picture: https://developers.secure.facebook.com/docs/graph-api/reference/page/picture
- Facebook Pages API: https://developers.facebook.com/documentation/pages-api
- Instagram IG User (campos de solo lectura): https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/
