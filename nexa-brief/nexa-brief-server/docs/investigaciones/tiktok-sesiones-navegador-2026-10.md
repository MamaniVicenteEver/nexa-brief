# TikTok por navegador: sesiones por cuenta y publicación "como manual"

Fecha: 2026-10-29 · Rama `feat/nodetech-paquete-publicacion`
Estado: **estudio, sin implementar**. Revisado el código del servidor y de la web, el POC `tiktok-session-poc/` y su estado en `alfred-server`.

---

## 1. Veredicto

**Sí se puede, y encaja bien en la arquitectura actual.** La propuesta:

1. **Un perfil de Chromium persistente por cuenta de TikTok** en el servidor. Ese perfil es "la sesión", igual que hoy el token OAuth cifrado es la sesión de YouTube.
2. **Conectar es como con YouTube: eliges la cuenta que ya tienes abierta en tu navegador** (decisión del 29-10, ver §4.2). Una extensión pequeña, "Nexa Connect", se instala una sola vez. En `/canales` → "Conectar TikTok" te muestra el @usuario que tienes abierto en tiktok.com y, con un clic, pasa esa sesión al perfil del servidor. No escribes nada. Como alternativa, también se puede conectar con el QR de la app de TikTok del móvil.
3. **Se publica con un adaptador nuevo, `TikTokWebAdapter`**, que implementa el mismo `PublisherPort`. Abre TikTok Studio con el perfil de la cuenta, sube el archivo, escribe la descripción y pulsa "Publicar". El resto de Nexa (cola, scheduler, borradores, log de publicaciones) no se entera de que no es la API.
4. **Hay una vista remota (noVNC) solo como plan B**, para cuando TikTok pida captcha o verificación. Nexa pausa, te avisa y tú lo resuelves a mano. **Nunca se resuelven captchas de forma automática.**

**El riesgo principal no es técnico.** Los Términos de TikTok prohíben acceder al servicio con medios automatizados. Una cuenta puede recibir captchas, perder alcance o quedar restringida. Por eso el plan arranca con **una cuenta de prueba** y con un ritmo humano: pocas publicaciones al día, una cuenta a la vez y siempre la misma máquina e IP.

---

## 2. Cómo está hoy (verificado)

### 2.1 TikTok por API (lo que ya existe)
- `src/adapters/publishing/tiktok_adapter.py` usa la Content Posting API v2 (Direct Post): init, subida por chunks y polling.
- Como la app **no está auditada** (`settings.tiktok_app_audited = False`), el adaptador fuerza `SELF_ONLY`. Todo lo que se sube queda privado, que es justo el problema que planteas.
- Según la documentación oficial, un cliente sin auditar tiene además estos límites: **5 usuarios cada 24 h**, y la cuenta tiene que ser **privada** en el momento de publicar. Si no lo es, `/publish/video/init/` bloquea el intento.
- El catálogo de TikTok (sync de Canales) sigue pendiente porque falta el scope `video.list` (ver memoria *channel-sync*).

### 2.2 Cómo se conecta YouTube (el modelo a copiar)
- La web llama a `GET /api/v1/publish/auth/{platform}/start` (`channels-service.ts:243`). El callback guarda los tokens cifrados con Fernet en `accounts.json` (`token_storage.py`).
- `PublisherFacade._resolve("tiktok:cuenta_1")` elige el adaptador **solo por plataforma** (`publisher_facade.py:87`).
- Si un token caduca, se marca `requires_reauth` y la web muestra "Reconectar" (`StatusBadge`, `useChannels`).

**Para TikTok por navegador cambia solo una cosa:** la "credencial" es un directorio de perfil en lugar de un token. El resto del flujo (alias, estado, reconectar, avatar) se reutiliza.

### 2.3 El POC `tiktok-session-poc/` (28-10, sin commitear, en la raíz del repo)
- `poc.py` abre un perfil persistente por alias (`launch_persistent_context`), con bloqueo `fcntl` por perfil y permisos 700. **No automatiza nada:** tú haces login y subes a mano.
- `web-session.sh` levanta Xvfb, x11vnc y noVNC en loopback para verlo por túnel SSH (`ssh -L 16080:...`).
- Estado real en `alfred-server`: existe `data/profiles/cuenta-01` (22 MB), pero **solo tiene la cookie `msToken`, que es anónima. No tiene `sessionid`**, así que **el login nunca llegó a completarse**. La persistencia de la sesión sigue sin probarse.
- Playwright usa su Chromium empaquetado (`chromium-1248`). **Google Chrome no está instalado.** Esto importa (ver §5.3).

---

## 3. Alternativas comparadas

| Opción | Público sin auditoría | Esfuerzo | Riesgo para la cuenta | Automatización |
|---|---|---|---|---|
| **A. API Direct Post** (actual) | No: privado forzado | Ya hecho | Nulo | Total |
| **B. API "Upload" a la bandeja (borrador)** | **Por verificar** | Bajo: un scope y un endpoint | Nulo | Parcial: terminas de publicar en el móvil |
| **C. Navegador con sesión persistente** (este estudio) | **Sí** | Medio | **Medio** (Términos, captchas) | Total, con pausas manuales |
| D. Pedir la auditoría de la app | Sí | Trámite (páginas legales, video demo) | Nulo | Total |

- **B merece una prueba de 30 min antes de nada.** Con el scope `video.upload`, Nexa manda el video como **borrador a la bandeja de TikTok** de la cuenta. Recibes una notificación en la app y publicas en público con 2 toques. La documentación oficial solo menciona la restricción de "privado" para Direct Post. Una fuente secundaria dice que afecta a todo cliente sin auditar. **Hay que probarlo con una cuenta.** Si funciona en público, B es la vía legal y sin riesgo, a costa de un toque manual por video.
- **C es lo que pides:** cero toques una vez conectada la cuenta.
- **D sigue siendo la solución definitiva.** El estudio `paginas-legales-meta-tiktok-2026-10.md` ya lista lo que falta para la auditoría.

**Recomendación:** hacer C (este plan), probar B en paralelo como respaldo legal y no abandonar D.

---

## 4. Diseño propuesto (opción C)

### 4.1 Piezas nuevas en `nexa-brief-server`

```
src/adapters/publishing/tiktok_web/
  session_manager.py   # perfiles, locks, Xvfb, login por QR, comprobar sesión
  uploader.py          # flujo de TikTok Studio (Playwright async)
  selectors.py         # TODOS los selectores en un solo sitio, con alternativas ES/EN
  adapter.py           # TikTokWebAdapter(PublisherPort)
data/browser_profiles/tiktok/<alias>/   # perfil Chromium (700, gitignored)
data/browser_profiles/_locks/<alias>.lock
data/logs/tiktok_web/<fecha>_<alias>/  # capturas + HTML cuando algo falla
```

- **`accounts.json`**: la entrada de TikTok gana `"mode": "browser"` (por defecto `"api"`), además de `username`, `avatar_url`, `profile_dir` y `last_session_check`. No guarda tokens ni contraseñas.
- **`PublisherFacade._resolve`**: si `platform == "tiktok"` y la cuenta tiene `mode == "browser"`, devuelve `TikTokWebAdapter`. Si no, devuelve el `TikTokAdapter` actual. Así conviven las dos vías.
- **Concurrencia**: se usa un `asyncio.Semaphore(1)` global para todo lo que abre un navegador, y además el lock `fcntl` por perfil (como en el POC). Una sola cuenta a la vez, que también es lo que haría una persona.
- **Xvfb**: se arranca **un solo display** (`Xvfb :99`) de forma perezosa, al primer uso, y se reutiliza. El navegador corre **headful dentro de Xvfb**, no en modo headless. El modo headless es más fácil de detectar y en TikTok falla más.

### 4.2 Conectar una cuenta

**Decisión del usuario (29-10):** todo vive en el servidor. Conectar tiene que funcionar "como YouTube": se elige la cuenta que ya está abierta en el navegador, sin escribir datos y sin el login manual del POC.

**Por qué hace falta una extensión.** YouTube lo resuelve con OAuth, porque Google muestra las cuentas abiertas. El OAuth de TikTok solo da la API, que publica en privado. Y una página web (Nexa) **no puede leer la sesión de otro sitio** (tiktok.com): sus cookies son `httpOnly` y de otro origen. Solo una extensión del navegador con permiso `cookies` sobre `tiktok.com` puede hacerlo.

**Vía principal: extensión "Nexa Connect"** (Chrome, Edge o Brave, MV3, cargada como "sin empaquetar")
1. En `/canales` → TikTok → "Desde mi navegador", la web habla con la extensión mediante un content script en los dominios de Nexa y `postMessage`.
2. La extensión lee las cookies de `tiktok.com` y consulta el @usuario, el nombre y el avatar de la cuenta abierta. La web muestra **"Cuenta abierta: @usuario"** y tú pulsas "Conectar".
3. El backend crea un enlace de importación **firmado y de un solo uso** (`sign_link`, 10 min). La extensión envía allí **solo** las cookies de `*.tiktok.com`.
4. El servidor crea `data/browser_profiles/tiktok/<alias>/`, inyecta las cookies (`context.add_cookies`) y abre TikTok Studio dentro de Xvfb para verificar que la sesión funciona y que el @usuario coincide. Después guarda la cuenta (`mode: browser`) y la copia cifrada.
5. **Varias cuentas**: en tiktok.com usas "Cambiar cuenta", vuelves a `/canales` y pulsas "Volver a detectar".

**Advertencia para la interfaz:** la sesión queda **compartida** entre tu navegador y el servidor. **No pulses "Cerrar sesión"** en tiktok.com, porque TikTok invalida la sesión en todas partes; para cambiar de cuenta, usa "Cambiar cuenta". Como el servidor está en la misma red de tu casa, comparten la IP pública, que es el mejor escenario.

**Vía alternativa: QR** (sin extensión, desde otro equipo o el móvil). Es el flujo de abajo.

```
Web /canales  →  "Conectar TikTok (navegador)"  →  pide alias
POST /api/v1/publish/browser/tiktok/connect {alias}      → {session_id}
GET  /api/v1/publish/browser/sessions/{id}               → {state, qr_png_b64?, username?, error?}
     (la web lo consulta cada 2 s; el QR de TikTok rota, se recaptura en cada poll)
POST /api/v1/publish/browser/sessions/{id}/cancel
```

Estados: `starting → waiting_qr → scanned → logged_in → done`, o bien `needs_manual` (captcha o verificación: se ofrece la vista remota), `failed` o `expired` (a los 3 min).

- Se detecta que el login terminó cuando aparece la cookie `sessionid` en `.tiktok.com` **y** la página deja de estar en `/login`.
- Después se lee la identidad **desde la propia sesión**: `@usuario`, nombre y avatar, por ejemplo desde `/tiktokstudio` o la página del perfil. Se guarda como hoy hace `refresh_youtube_profile`. **La web te muestra el @usuario para que confirmes que es la cuenta correcta**, porque el alias local no prueba nada.
- La alternativa al QR es "Continuar con Google" o email + código, pero esa vía requiere la vista remota (§4.5). El QR es lo más simple y lo único que no pide escribir credenciales en el servidor.

### 4.3 Mantener la sesión viva (el equivalente a refrescar el token)
- **Comprobación diaria** (se cuelga del mismo intervalo que `CHANNEL_SYNC_INTERVAL_HOURS`). Abre el perfil, entra en `tiktok.com/tiktokstudio`, verifica `sessionid` y el @usuario, y cierra. Visitar TikTok con el perfil también **renueva la cookie**.
- Si la sesión cayó, se llama a `mark_requires_reauth("tiktok", alias, "session_expired")` y la web ya muestra "Reconectar", que vuelve a abrir el flujo QR.
- La duración real de `sessionid` / `sid_guard` (lo habitual son semanas o meses, y se renueva con uso) **hay que medirla en la fase 0**. No hay que asumirla.
- **Copia de seguridad**: el disco del servidor ya murió una vez (18-10). Por eso, tras cada login y cada comprobación OK, se exporta `context.storage_state()` **cifrado con Fernet** (`PUBLISHER_ENCRYPTION_KEY`, como los tokens) a `data/browser_profiles/tiktok/<alias>.state.enc`. Si se pierde el perfil, se intenta restaurar desde ahí antes de pedir otro QR.

### 4.4 Publicar (`TikTokWebAdapter.publish`)

1. Tomar el semáforo y el lock del perfil, y lanzar `launch_persistent_context(profile, headless=False, channel="chrome", locale="es-ES", timezone_id=<la del servidor>, viewport=1440×900)`.
2. Ir a `https://www.tiktok.com/tiktokstudio/upload`. Si redirige a login: `requires_reauth` y se aborta **sin reintentar**.
3. `page.set_input_files('input[type=file]', video_path)`. No hace falta tocar el diálogo del sistema operativo.
4. Esperar a que termine la subida (barra de progreso o texto "Subido"; el selector va en `selectors.py`) y a que aparezca el editor.
5. Descripción: el editor es un `contenteditable`. Se limpia y se escribe con `keyboard.type(delay≈40–90 ms)`. Por cada `#hashtag`, se escribe, se espera el desplegable de sugerencias y se cierra con espacio o Escape para que no inserte otra etiqueta. Máximo 2200 caracteres, como en el adaptador actual.
6. Opciones: visibilidad "Todos" (o la que pida `privacy`), comentarios, dúos y stitch, con los mismos valores que hoy manda la API. La portada se deja por defecto (o se usa `video_cover_timestamp_ms` si se implementa luego).
7. Pulsar **Publicar** y manejar los modales conocidos: "¿Continuar publicando?" por la comprobación de contenido o de copyright, y "Publicar ahora". Lo que no se reconozca se considera fallo y se guardan captura y HTML.
8. Confirmación y **ID del video**: hay que escuchar `page.on("response")` en la petición de publicación de TikTok Studio, que devuelve el id del ítem (**endpoint a identificar en la fase 1**). Si eso falla, se abre `/tiktokstudio/content` y se toma el primer video cuya descripción coincida. Se devuelve `PublishVideoResult(post_id, url="https://www.tiktok.com/@user/video/<id>")`.
9. Cerrar el contexto. Pausa mínima de ~2–5 min antes de abrir otra cuenta.

**Reglas que no se negocian:**
- **No usar `@with_retry` después de pulsar Publicar.** El adaptador de la API lo usa, pero aquí un reintento puede **publicar el video dos veces**. Si falla antes de pulsar: se puede reintentar una vez. Si falla después: el estado queda en `unknown`, se notifica y se revisa (la sync del catálogo de la fase 3 lo resolverá sola).
- **Modo `dry_run`**: hace todo menos pulsar Publicar y después descarta. Sirve como prueba de humo cada vez que TikTok cambie su interfaz, sin publicar nada.
- Ante cualquier fallo se guardan captura, `page.content()` y la URL en `data/logs/tiktok_web/`. Nunca se registran cookies.

### 4.5 Vista remota (plan B para captcha o verificación)
- Es el mismo mecanismo del POC: x11vnc `-localhost` sobre el display `:99`, más websockify y noVNC.
- **No se expone tal cual.** Hay dos opciones:
  - **Fase 2:** solo por túnel SSH, como hoy documenta el README del POC.
  - **Fase 3:** a través del backend, con un endpoint WebSocket que exija sesión de administrador y un token de un solo uso. Así se puede incrustar en `/canales` y funciona por `dev-nexa-brief.everdev.space`, porque Cloudflare Tunnel soporta WebSocket.
- Cuando el uploader detecte un captcha (iframe o contenedor de verificación conocido), queda en `needs_manual`, manda una notificación (`core/notification.py`) con el enlace a la vista remota y espera hasta 10 min antes de abandonar.
- Para la vista remota existe una opción sin VNC: `CDP Page.startScreencast` + `Input.dispatch*`, dibujado en un `<canvas>`. Es más limpio, pero también es más trabajo. noVNC ya está probado en el POC.

### 4.6 Catálogo, borrado y edición (fase 3)
- **`ChannelCatalogPort` para TikTok** sin el scope `video.list`: abrir `/tiktokstudio/content` con el perfil y leer la lista. Lo más robusto es capturar la respuesta JSON que la propia página carga, en lugar de raspar el DOM. Así se cierra el pendiente de la sync de Canales.
- **`delete_video`**: desde TikTok Studio, con el menú del video → Eliminar → confirmar. Lleva el mismo cuidado con capturas.
- **`update_video`**: TikTok no permite editar la descripción después de publicar. Se lanza `UnsupportedOperationError`, igual que hoy; solo se cambiaría la privacidad, si hace falta.

### 4.7 Web (`features/channels`)
- **`ConnectAccountDialog`**: TikTok ofrece dos opciones, "API oficial (privado hasta auditoría)" y "Navegador (sesión del servidor)". La segunda muestra el QR, el estado en vivo y el @usuario detectado, con un botón "Confirmar".
- **`AccountCard`**: insignia "Sesión de navegador", fecha de la última comprobación, botón "Comprobar ahora" (`POST /publish/accounts/tiktok/{alias}/check-session`) y "Reconectar" si cayó.
- No hace falta tocar la cola ni los borradores: siguen publicando con `account_selector="tiktok:<alias>"`.

---

## 5. Riesgos y cómo se reducen

### 5.1 Términos de servicio
La automatización del navegador va contra los Términos de TikTok. **Puede costar la cuenta.** Medidas:
- Empezar con **una cuenta de prueba** y pasar a las reales solo tras 1–2 semanas sin incidencias.
- Ritmo humano: **1–3 publicaciones al día por cuenta**, una cuenta a la vez, con intervalos irregulares.
- Mantener las cuentas "vivas" también por uso normal desde el móvil.

### 5.2 Huella del dispositivo y la red
- **Misma máquina, mismo perfil y misma IP siempre.** `alfred-server` está en una red doméstica (192.168.20.3, IP residencial), que es lo ideal. **No usar proxies ni rotar IPs**: cambiar de IP entre sesiones es lo que más dispara las verificaciones.
- No compartir un perfil entre máquinas. Si se migra de servidor, hay que esperar que se pida otro QR.
- Este plan **no** incluye plugins de ocultación ni falsificación de huella. Solo comportamiento consistente.

### 5.3 Chromium de Playwright frente a Google Chrome
El Chromium empaquetado de Playwright no trae los códecs propietarios (H.264/AAC) y algunas webs lo tratan distinto. **Recomendación:** instalar Google Chrome estable en el servidor y usar `channel="chrome"`. Requiere `sudo`, así que lo decides tú. En la fase 0 se prueba con los dos.

### 5.4 Cambios en la interfaz de TikTok
Los cambios en la interfaz de TikTok son el costo de mantenimiento de esta vía. Se mitigan así:
- Selectores centralizados con alternativas por rol o texto en ES y EN, forzando el idioma de la interfaz.
- `dry_run` diario o semanal programado, con alerta si falla.
- Capturas y HTML en cada error para arreglar rápido.

### 5.5 Recursos
- Chrome headful con video consume ~0,5–1 GB de RAM y CPU durante la subida.
- En alfred-server (4 núcleos, 11 GB) **no debe coincidir con un render pesado**: la publicación por navegador entra en la cola como un trabajo más, con el semáforo de 1.

### 5.6 Seguridad
- Un perfil equivale a una **sesión abierta de la cuenta**: permisos 700, fuera de git (`data/` ya está ignorado) y copia de seguridad cifrada (§4.3).
- La vista remota nunca se expone sin autenticación. Hoy el `portal.py` del POC escucha en `192.168.20.3:16080` sin autenticación, aunque solo sirve enlaces. Al integrarlo, el portal desaparece.

---

## 6. Plan por fases

| Fase | Qué | Resultado / criterio para seguir |
|---|---|---|
| **0. Validar a mano** (½ día) | En el POC de alfred-server: login **por QR** en `cuenta-01` (prueba), con Chromium de Playwright y con Chrome. Cerrar y reabrir a las 24 h, 72 h y tras reiniciar. Una subida manual supervisada en público. | `sessionid` presente y la sesión sobrevive a los reinicios. Anotar si pidió captcha. **Si TikTok bloquea el login desde el navegador automatizado, se para aquí y se va a B/D.** |
| **0b. Probar opción B** (30 min) | Añadir `video.upload` a la app de TikTok y subir un borrador a la bandeja. | Comprobar si deja publicar en **público** desde el móvil. |
| **1. Script CLI** (1–2 días) | En el POC: `tiktok_web.py connect-qr <alias>`, `check <alias>` y `publish <alias> --video --caption [--dry-run]`, con capturas. Sin tocar Nexa. | 5 publicaciones reales en una semana en la cuenta de prueba, sin duplicados, con `post_id` correcto. Selectores e id de publicación identificados. |
| **2. Integración en Nexa** (2–3 días) | `tiktok_web/` + `mode: browser` en `accounts.json` + `_resolve` + endpoints de conexión, estado y check + diálogo QR en `/canales` + comprobación diaria + copia cifrada. | Publicar desde la cola de Nexa en la cuenta de prueba. Reconectar funciona. Tests unitarios con una página falsa (sin TikTok real en CI). |
| **3. Completar** (2–3 días) | Catálogo/sync, borrado, vista remota integrada con autenticación, notificación de captcha, `dry_run` programado. | Las cuentas reales entran poco a poco (una por semana). |

Siguiendo el reparto acordado, cada fase se delega a Codex (Luna) con un `BRIEF-tiktok-web-fN.md` en alfred-server, y Claude revisa.

---

## 7. Decisiones

**Tomadas el 29-10:**
- Todo vive en el servidor (alfred-server).
- La conexión es "como YouTube" mediante la extensión Nexa Connect, con QR como alternativa.
- Se descarta el POC con login manual: solo queda como referencia.
- Se conservan las dos vías por cuenta (`mode: api | browser`).
- Se usa el Chromium de Playwright mientras no haya `sudo` para Chrome.
- Orden de trabajo: primero la conexión (brief `tiktok-conexion`); cuando haya una cuenta conectada, la publicación (brief `tiktok-publicar`). Los selectores de TikTok Studio solo se pueden validar con una sesión real.

**Preguntas que estaban abiertas antes de esas decisiones:**

1. **Cuenta de prueba**: ¿hay una cuenta desechable para las fases 0–1, o usamos `cuenta-01`, que ya es una de las tres?
2. **Servidor**: ¿la publicación vivirá en `alfred-server` (la IP de tu casa)? El perfil queda atado a esa máquina.
3. **Google Chrome**: ¿se puede instalar con `sudo` en alfred-server?
4. **Método de login**: ¿las cuentas tienen la app de TikTok en un móvil para el QR, o algunas solo entran con "Continuar con Google" (entonces hará falta la vista remota desde la fase 2)?
5. **¿Conservar la vía API?** ¿Dejamos las dos (por cuenta, `mode: api | browser`) o TikTok pasa a ser solo por navegador?
6. **El POC está sin trackear** en la raíz del repo (`tiktok-session-poc/`). ¿Se commitea (sin `data/` ni `vendor/`) o se queda fuera hasta la fase 1?

---

## Fuentes
- [TikTok Developers: Content Posting API, Direct Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post): restricción a privado y límites de los clientes sin auditar.
- [TikTok Developers: Get started](https://developers.tiktok.com/doc/content-posting-api-get-started) y [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
- [Vorp Labs: TikTok Content Posting API](https://vorplabs.com/agent-tools/tiktok-content-posting-api): fuente secundaria sobre el flujo "Upload" a la bandeja.
- Proyectos que automatizan TikTok Studio con cookies o sesión (referencia del patrón y de sus riesgos): [tiktok-uploader (Selenium)](https://pypi.org/project/tiktok-uploader/1.0.1/), [auto-tiktok (Playwright)](https://pypistats.org/packages/auto-tiktok), [Apify TikTok Video Uploader](https://apify.com/dami_studio/tiktok-video-uploader), [GenieHelper: TikTok](https://www.mintlify.com/kismetkanceled/geniehelper/integrations/tiktok).
