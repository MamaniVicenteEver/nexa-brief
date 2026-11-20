# Páginas legales (Privacidad, Términos, Eliminación de datos) para Meta, TikTok y Google

Fecha: 2026-10-13 · Revisado en `ever-server` (rama `feat/nodetech-paquete-publicacion`) y en las URLs públicas.
Estado: **estudio, sin integrar**.

---

## 1. Veredicto

**Sí, hace falta un feature nuevo: `legal`.** Aun así, **no va dentro del dashboard**:

- Meta, TikTok y Google revisan estas URLs con un **crawler y con revisores humanos sin sesión iniciada**. Todo lo que está en `(admin)` redirige a `/login`, así que para ellos sería una página vacía y la revisión se rechaza.
- Deben ser **páginas públicas** dentro del grupo `(public)`, renderizadas en el servidor (HTML completo, sin depender de JS) y en el **mismo dominio** que usa OAuth (`PUBLIC_APP_URL`).
- El dashboard solo las **enlaza**: en el pie público, en el menú de gestión y en el diálogo de conectar un canal. Además, en el flujo de publicación hay que mostrar el consentimiento que TikTok exige para auditar la app (ver §6).

---

## 2. Cómo está hoy (verificado)

### 2.1 Entorno de ejecución
- NEXA corre **directamente en el host, en modo desarrollo**: `uvicorn --reload` en :8000 y `next dev` en :3000, lanzados con un `bash -c ... & wait`. No corre en Docker ni con systemd.
- El dominio público es `PUBLIC_APP_URL=https://nexa-brief.everdev.space`, servido por un **Cloudflare Tunnel con nombre** (`cloudflared tunnel run --token-file ~/.config/cloudflared/nexa-brief-token`).
- Además sigue vivo un **Quick Tunnel** (`cloudflared tunnel --url http://127.0.0.1:3000`, host `*.trycloudflare.com`). Expone la misma app por una URL aleatoria. Si ya no se usa, conviene cerrarlo.
- La web reescribe `/api/v1/*` hacia `127.0.0.1:8000`. Por eso los callbacks OAuth del backend se ven bajo el dominio de la web.

### 2.2 URLs legales registradas vs. lo que responde

| URL | HTTP | Comentario |
|---|---|---|
| `https://nexa-brief.vercel.app/privacy` | **404** | Es la URL puesta en TikTok, así que hoy está rota |
| `https://nexa-brief.vercel.app/terms` | **404** | Es la URL puesta en TikTok, así que hoy está rota |
| `https://nexa-brief.vercel.app/privacy.html` | 200 | Es la que tiene puesta Meta |
| `https://nexa-brief.vercel.app/terms.html` | 200 | |
| `https://nexa-brief.vercel.app/delete-data.html` | 200 | Instrucciones de borrado para Meta |
| `https://nexa-brief.vercel.app/api/v1/publish/auth/tiktok/callback` | **404** | Vercel es un sitio estático: ahí no hay backend |
| `https://nexa-brief.everdev.space/privacy` y `/terms` | **404** | En la app real no existen |
| `https://nexa-brief.everdev.space/api/v1/publish/auth/tiktok/callback` | 400 | Existe (sin `code` devuelve 400, que es lo correcto) |

### 2.3 El problema más urgente: el redirect URI de TikTok no coincide
`publisher.py` construye `redirect_uri = public_url("/api/v1/publish/auth/tiktok/callback")`, es decir
`https://nexa-brief.everdev.space/api/v1/publish/auth/tiktok/callback`.
En el portal de TikTok está registrado `https://nexa-brief.vercel.app/...`. Así, TikTok rechaza el login con un error de `redirect_uri` y, aunque lo aceptara, Vercel devolvería 404. Lo mismo aplica a Facebook (`/api/v1/publish/auth/facebook/callback`) y a YouTube si se registraron con el dominio de Vercel.

### 2.4 Contenido actual de las páginas de Vercel: qué le falta
Son tres HTML estáticos de 4 párrafos cada uno (fechados el 24-06-2026). Para pasar una revisión estricta les falta:
- **Google/YouTube**: no mencionan la *Google API Services User Data Policy* ni el compromiso de **Limited Use**. Google lo exige porque la app pide `youtube.upload` y `youtube.force-ssl`.
- **Qué datos exactos** se guardan: nombre y avatar del perfil, ID de página o canal, lista de videos publicados, métricas, tokens. También falta decir **cuánto tiempo** se conservan.
- **Identidad y contacto coherentes**: `delete-data.html` habla de "Drova Soft Publishing" y `drovatechgroup@gmail.com`, mientras que la app real firma como "Ever Mamani Vicente" con `evermamanivicente@gmail.com`. Los revisores comparan el nombre de la app, el dominio y el contacto.
- Faltan menores de edad, cambios en la política, jurisdicción, terceros (Cloudflare, proveedores de IA usados para generar metadatos) y derechos del usuario.
- Los términos no tienen limitación de responsabilidad, suspensión ni ley aplicable.
- Solo están en español. Meta y TikTok revisan en inglés, así que conviene tener versión en inglés.

Lo que sí es cierto y se puede afirmar: los tokens **están cifrados** con Fernet (`token_storage.py`, `PUBLISHER_ENCRYPTION_KEY`).

### 2.5 Huecos en el backend que la política de privacidad debería reflejar
- `DELETE /accounts/{platform}/{alias}` **no revoca el token en la plataforma**, solo lo olvida localmente. La política no debe prometer otra cosa, o bien hay que añadir la revocación.
- No hay **callback de borrado de datos de Meta** (`signed_request`). Hoy solo existe la URL de instrucciones, que Meta también acepta.
- Facebook pide `pages_manage_metadata` y `pages_messaging`, que **no se usan para publicar**. En App Review, cada permiso necesita una justificación y un video. Pedir permisos sin uso es causa típica de rechazo, así que conviene quitarlos.

---

## 3. Qué exige cada plataforma (resumen práctico)

> Estos requisitos cambian. Antes de enviar a revisión, comprueba la lista vigente en cada consola.

**Meta (Facebook Pages)**
- Una *Privacy Policy URL* pública es obligatoria para pasar la app a modo Live.
- Para borrar datos hay que dar una *Data Deletion Instructions URL* **o** una *Data Deletion Callback URL*.
- La *Terms of Service URL* es opcional, pero recomendable.
- El dominio de esas URLs y del redirect tiene que figurar en *App Domains* y en *Valid OAuth Redirect URIs*.
- El crawler de Meta debe poder leer la página: nada de login ni de bloqueo por bots. Ojo con *Bot Fight Mode* de Cloudflare.
- Cada permiso `pages_*` pasa por App Review con un screencast. Además se pide Business Verification.

**TikTok (Login Kit + Content Posting API)**
- Hay que dar las URLs de Terms of Service y Privacy Policy y una web que describa la app. Todo debe estar accesible.
- Redirect URIs exactos, con HTTPS.
- Mientras la app no esté **auditada** (`TIKTOK_APP_AUDITED=false`), todo se publica como "Solo yo".
- Para aprobar la auditoría, la **pantalla de publicación** debe mostrar el nombre de la cuenta destino, dejar elegir la privacidad sin valor por defecto, ofrecer los toggles de comentarios/dúo/stitch, mostrar la declaración "Al publicar aceptas la Music Usage Confirmation de TikTok" y avisar de que el video tarda en procesarse. Esto ya es UI del dashboard (§6).

**Google (YouTube)**
- La pantalla de consentimiento OAuth pide una URL de inicio y otra de política de privacidad, en un **dominio verificado en Search Console** y que coincida con el de la app.
- La política debe incluir el texto de **Limited Use**.
- Si la app sigue en "Testing", los refresh tokens caducan a los 7 días.

**Conclusión:** las tres plataformas quieren lo mismo: **un único dominio propio y estable** que sirva la landing, las páginas legales y los callbacks. Hoy está partido entre Vercel (legales) y everdev.space (OAuth).

---

## 4. Decisión de dominio

| Opción | Qué implica | Recomendación |
|---|---|---|
| **A. Todo en `nexa-brief.everdev.space`** | Páginas legales en Next (feature `legal`). Actualizar URLs y redirect URIs en Meta, TikTok y Google. Vercel solo redirige (308) al nuevo dominio. | **Recomendada.** Un solo dominio, que además es el que ya usa OAuth. |
| B. Seguir con Vercel estático | Arreglo inmediato: en TikTok poner `.../privacy.html` y `.../terms.html`. Aun así hay que mover los redirect URIs a everdev, y quedan dos dominios para revisar y verificar. | Solo como parche de hoy. |

Sobre la disponibilidad en la opción A: si el servidor de casa se cae, las páginas legales también. Pero en ese caso el login OAuth tampoco funciona, así que no se pierde nada nuevo. Lo que sí importa es **dejar de servir con `next dev`**: la primera visita compila la ruta en caliente y puede tardar varios segundos, lo que provoca timeouts del crawler. Conviene `next build && next start` (o el `Dockerfile` con `output: "standalone"` que ya existe) bajo systemd o Docker con reinicio automático.

**Parche inmediato, sin código:** en el portal de TikTok, cambia Terms y Privacy por las URLs `.html` de Vercel, que sí responden 200. Pon el redirect URI `https://nexa-brief.everdev.space/api/v1/publish/auth/tiktok/callback`, que es el que envía el backend.

---

## 5. Diseño del feature `legal` (cuando se integre)

### 5.1 Rutas (grupo público)
```
src/app/[locale]/(public)/privacy/page.tsx        → /privacy        (/en/privacy)
src/app/[locale]/(public)/terms/page.tsx          → /terms          (/en/terms)
src/app/[locale]/(public)/data-deletion/page.tsx  → /data-deletion  (/en/data-deletion)
```
- Slugs en inglés para que coincidan con lo ya registrado (`/privacy`, `/terms`). Con `localePrefix: "as-needed"`, `/privacy` sirve el español y `/en/privacy` el inglés.
- **No** copiar la redirección de `(public)/page.tsx` (sesión → dashboard): un usuario con sesión también debe poder leerlas.
- `setRequestLocale` + `generateStaticParams` para que se generen de forma estática. HTML completo, sin depender de JS en el cliente.
- `generateMetadata`: título, `alternates` con `es` y `en`, y robots `index`.
- Compatibilidad: en `next.config.ts`, añadir `redirects()` de `/privacy.html` → `/privacy`, `/terms.html` → `/terms` y `/delete-data.html` → `/data-deletion` (308). Hace falta porque el `matcher` del proxy ignora rutas con punto.

### 5.2 Estructura del feature (sigue el patrón de `features/*`)
```
src/features/legal/
  components/LegalDocument.tsx   # layout de lectura: título, "última actualización", índice, secciones
  components/LegalNav.tsx        # pestañas Privacidad · Términos · Eliminación de datos
  content.ts                     # metadatos: fecha de vigencia, email de contacto, plataformas, scopes
  index.ts
messages/es/legal.json, messages/en/legal.json   # textos; añadir "legal" a FEATURE_NAMESPACES
```
`content.ts` debe ser la **única fuente** del email de contacto, el nombre legal y la lista de scopes, para no repetir la incoherencia Drova/Ever. Si se prefiere redactar en prosa larga, se puede usar MDX por idioma en lugar de JSON, aunque hoy el proyecto no tiene MDX.

### 5.3 Contenido mínimo por página
- **Privacidad**: responsable y contacto; qué datos (por plataforma y scope); para qué; dónde y cómo se guardan (cifrado Fernet, servidor propio, Cloudflare); retención; terceros y subprocesadores; **Google Limited Use**; cómo revocar acceso en cada plataforma; derechos del usuario; menores; cambios; fecha.
- **Términos**: descripción del servicio (fase de prueba, acceso por invitación); cuenta y acceso; responsabilidad sobre el contenido y los derechos musicales; cumplimiento de las normas de TikTok, YouTube y Meta; prohibiciones; suspensión; limitación de responsabilidad; ley aplicable (Bolivia); contacto.
- **Eliminación de datos**: pasos en Facebook, TikTok y Google para quitar la app; correo de solicitud con plazo; qué se borra (tokens, `accounts.json`, historial de publicación); y, si se implementa §5.4, la página de estado `/data-deletion/status?code=...`.

### 5.4 Backend (opcional, fase 2)
- `POST /api/v1/publish/meta/data-deletion`: valida el `signed_request` con HMAC-SHA256 y `FACEBOOK_CLIENT_SECRET`, borra las cuentas de Facebook ligadas a ese `user_id` y responde `{ "url": ".../data-deletion/status?code=X", "confirmation_code": "X" }`.
- `POST /api/v1/publish/meta/deauthorize`: el mismo `signed_request`; marca la cuenta como desconectada.
- Al desconectar, **revocar de verdad** en cada plataforma: TikTok `oauth/revoke`, Google `oauth2/revoke`, Meta `DELETE /{user-id}/permissions`. Así la política puede prometerlo.
- Quitar `pages_manage_metadata` y `pages_messaging` del scope de Facebook si no se usan.

---

## 6. Cómo se reflejaría en el dashboard (solo enlaces y consentimiento)

| Lugar | Cambio |
|---|---|
| `PublicFooter` | Fila con **Privacidad · Términos · Eliminación de datos**. Meta y TikTok miran que la landing enlace a la política. |
| `AdminHeader` → menú "Gestión" | Entrada "Legal y privacidad" que abre `/privacy` (fuera del panel). |
| `canales` → diálogo de conectar cuenta | Texto "Al conectar aceptas los Términos y la Política de privacidad", con enlaces. Debe ir **antes** de redirigir al OAuth. |
| `/login` y `/acceso` | Enlace pequeño a Términos y Privacidad bajo el formulario. |
| Publicación a TikTok (`crear-video`, `programacion`, estudio explainer) | **Feature aparte, necesario para auditar TikTok:** cuenta destino visible, selector de privacidad sin valor por defecto, toggles de interacción, declaración de *Music Usage Confirmation* y aviso de procesamiento. El backend ya tiene `tiktok_privacy` en `Job`. |

No hace falta ninguna página nueva **dentro** del dashboard. Una página "Privacidad de mis datos" en el panel solo tendría sentido si en el futuro hay usuarios externos que gestionan sus propios datos.

---

## 7. Plan por fases

1. **Hoy, sin código:** en TikTok, cambiar Terms y Privacy a las URLs `.html` de Vercel y los redirect URIs a `everdev.space`. Revisar lo mismo en Meta (*App Domains*, *Valid OAuth Redirect URIs*) y en Google Cloud. Cerrar el Quick Tunnel si no se usa.
2. **Feature `legal` (web):** 3 rutas públicas en es/en, enlaces de §6 (salvo el flujo de TikTok), redirects `.html`, y texto revisado con el contenido de §5.3.
3. **Cambio de URLs en las consolas** a `https://nexa-brief.everdev.space/{privacy,terms,data-deletion}`. En Vercel, dejar solo `vercel.json` con redirects 308 al nuevo dominio. Verificar el dominio en Google Search Console.
4. **Producción:** servir la web con `next start` o la imagen standalone bajo systemd/Docker con reinicio automático. Comprobar con `curl -A "facebookexternalhit/1.1"` que Cloudflare no bloquea al crawler.
5. **Backend fase 2:** callback de borrado y desautorización de Meta, revocación real al desconectar, limpieza de scopes.
6. **UX de publicación en TikTok** para la auditoría. Al aprobarse, poner `TIKTOK_APP_AUDITED=true`.

### Checklist de verificación antes de enviar a revisión
- [ ] `/privacy`, `/terms` y `/data-deletion` responden 200 **sin sesión**, en modo incógnito y con `curl`.
- [ ] El HTML trae el texto completo, sin depender de JS.
- [ ] El nombre de la app, el email y el dominio son los mismos en las 3 consolas y en las 3 páginas.
- [ ] Los redirect URIs de las consolas coinciden carácter a carácter con `public_url(...)`.
- [ ] La landing enlaza las 3 páginas.
- [ ] Hay versión en inglés.
- [ ] El texto de Google Limited Use está presente.
- [ ] Solo se piden los scopes que se usan.
