# Conectar Instagram profesional a Nexa Brief

## Qué hace el flujo

En Canales → Instagram → Agregar cuenta, Nexa inicia OAuth con Meta y pide acceso a las páginas que administra la persona que inicia sesión. Después consulta qué páginas tienen un perfil profesional de Instagram enlazado.

- Cada cuenta encontrada se registra en la sección Instagram.
- El nombre, @usuario, biografía y foto se leen desde Instagram.
- En los detalles se muestra la página de Facebook enlazada.
- El alias de Nexa es solo un identificador interno, por ejemplo instagram_1.
- Los tokens de página se cifran con PUBLISHER_ENCRYPTION_KEY; no se envían a la interfaz.
- Actualizar información vuelve a consultar el perfil en Meta.
- Si una página no tiene Instagram profesional enlazado, esa página no genera una cuenta de Instagram.

El mismo flujo habilita la publicación de Reels: Nexa crea un contenedor, expone el MP4 con una URL firmada de corta duración para que Meta lo descargue, espera a que Meta termine de procesarlo y finalmente publica el contenedor. La URL solo permite leer un MP4 dentro de OUTPUT_DIR y vence automáticamente.

## Requisitos de cada cuenta

1. Instagram debe ser una cuenta profesional de tipo Empresa o Creador. Las cuentas personales no están disponibles con este flujo.
2. La cuenta profesional debe estar vinculada a la página correcta de Facebook.
3. La persona que autoriza Nexa debe tener acceso suficiente a esa página desde Meta Business Suite.
4. Debe autorizarse con el Facebook que tiene acceso a esas páginas. Meta solo devuelve activos visibles para ese usuario.

## Configuración de la app de Meta

En la app usada por Nexa, agrega y configura Facebook Login / Instagram Graph API con Facebook Login. Solicita estos permisos:

- pages_show_list: listar las páginas autorizadas.
- pages_read_engagement: consultar los datos de página y su cuenta de Instagram vinculada.
- instagram_basic: leer el identificador y datos básicos del perfil profesional.
- instagram_content_publish: crear y publicar Reels en la cuenta profesional.

Para conectar solo cuentas propias durante pruebas, agrega a los usuarios como administradores, desarrolladores o evaluadores de la app y asegúrate de que tengan acceso a la Página y al Instagram profesional. Para que otras personas conecten sus activos, Meta puede requerir Advanced Access, revisión de permisos y configuración adicional de la app.

### URI de redireccionamiento

Instagram reutiliza el callback OAuth de Facebook configurado por Nexa:

    https://nexa-brief.everdev.space/api/v1/publish/auth/facebook/callback

Debe estar permitido exactamente en Facebook Login → Configuración → URI de redireccionamiento de OAuth válidos. No se agrega /instagram/callback; el flujo diferencia la conexión Instagram mediante state firmado por el servidor. El origen público sale de PUBLIC_APP_URL; si cambia el dominio, actualiza esa variable y el mismo URI en Meta.

El cliente público de OAuth de Meta debe permitir el dominio:

    nexa-brief.everdev.space


## Configuración exacta de Meta, paso a paso

En Meta for Developers abre la misma aplicación que ya usa Facebook en Nexa Brief:

1. En **Configuración de la app → Básica**, agrega `nexa-brief.everdev.space` a **Dominios de la aplicación**. Si pide URL del sitio web, usa `https://nexa-brief.everdev.space/`.
2. Agrega/configura **Facebook Login** para Web y **Instagram Graph API** con el flujo **Facebook Login**. Activa el inicio de sesión OAuth web y conserva la validación estricta de URI.
3. En **Facebook Login → Configuración**, pega este valor completo en **URI de redireccionamiento de OAuth válidos**:

       https://nexa-brief.everdev.space/api/v1/publish/auth/facebook/callback

   Debe coincidir exactamente: HTTPS, host y ruta. No agregues `/instagram/callback`, barra final ni `localhost` para el flujo del dominio público. El flujo local de desarrollo usa otro callback y solo sirve si también se agrega el URI local exacto.
4. En **Casos de uso / Permisos y funciones**, habilita para la app los permisos que solicita el consentimiento de Instagram: `pages_show_list`, `pages_read_engagement`, `instagram_basic` e `instagram_content_publish`. `pages_manage_posts` es para la publicación de Facebook y no reemplaza los permisos de Instagram.
5. Durante pruebas, cada persona debe figurar en un rol de la app (administrador, desarrollador o evaluador) y tener acceso a la Página y a su cuenta profesional de Instagram. Para que usuarios externos conecten sus páginas, solicita **Advanced Access** y completa la revisión de Meta para los permisos que la app use.
6. Guarda los cambios en el panel de Meta. En Nexa, pulsa **Canales → Instagram → Agregar cuenta**, inicia sesión con el Facebook que tiene acceso a la Página y concede todas las páginas solicitadas.

### Preparar cada Página e Instagram

En Meta Business Suite / Configuración del negocio, asigna al mismo negocio la Página de Facebook y la cuenta de Instagram; da a la persona que conectará Nexa acceso a ambos activos. En Instagram, el perfil debe ser **Empresa** o **Creador** y quedar vinculado a la Página correcta. Nexa no convierte cuentas personales ni crea cuentas de Instagram: detecta las profesionales enlazadas que Meta expone al usuario que autorizó.

Una autorización puede devolver varias páginas. Nexa guardará cada perfil profesional que encuentre; una página sin Instagram enlazado no aparecerá como cuenta de Instagram. Si Meta muestra una pantalla para elegir páginas, incluye las que se quieran conectar.

### Valores del servidor y seguridad

- `PUBLIC_APP_URL=https://nexa-brief.everdev.space` debe ser el origen público HTTPS. El servidor construye con esa variable el callback anterior.
- `FACEBOOK_CLIENT_ID` y `FACEBOOK_CLIENT_SECRET` deben pertenecer a esa misma app de Meta. El secreto solo vive en el `.env` del servidor; nunca debe copiarse al frontend ni al repositorio.
- `PUBLISHER_ENCRYPTION_KEY` debe estar configurada y estable: Nexa la usa para cifrar los tokens y firmar el estado OAuth y las URLs temporales de video.
- El callback de Meta sigue siendo el callback de Facebook ya instalado; Instagram se distingue con un `state` firmado, aleatorio, con vencimiento y ligado a una cookie segura del navegador que inició el flujo.
- Meta necesita descargar el MP4 mediante HTTPS sin iniciar sesión. Nexa expone únicamente el archivo solicitado con un token HMAC temporal, restringido a MP4 dentro de `OUTPUT_DIR`, y soporta solicitudes HTTP Range.

### Requisitos prácticos del Reel

La publicación se hace como Reel y necesita que Meta alcance la URL temporal del MP4 desde Internet. El render preferido es vertical 9:16. La guía de Meta describe contenedores MOV/MP4, codecs H.264/HEVC y AAC, 23–60 FPS y una duración de 3 segundos a 15 minutos; Meta procesa el contenedor de forma asíncrona, así que Nexa espera el estado `FINISHED` antes de publicarlo. Consulta [la colección oficial de Instagram de Meta en Postman](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00) para los requisitos vigentes.

## Flujo técnico

1. GET /api/v1/publish/auth/instagram/start?alias=instagram_1 construye el consentimiento Meta.
2. El state incluye un alias interno y una firma HMAC. El callback rechaza estados manipulados.
3. Meta vuelve al callback existente /api/v1/publish/auth/facebook/callback.
4. El servidor intercambia el código por un token de usuario de larga duración y enumera /me/accounts con el campo instagram_business_account.
5. Por cada perfil enlazado, guarda el ID de Instagram, el token de acceso de la página y los datos públicos. El archivo de cuentas conserva los tokens cifrados.
6. POST /api/v1/publish/accounts/instagram/{alias}/refresh-profile sincroniza el nombre, usuario, biografía y foto sin cambiar el alias ni la página asociada.
7. La publicación inmediata, programada y desde Crear video usa el archivo vertical cuando está disponible y publica como Reel.
8. Los videos publicados se pueden abrir desde Canales. La API no permite editar o borrar Reels mediante Nexa; esas acciones se hacen en Instagram.

## Diagnóstico

- “No encontramos Instagram profesional vinculado”: confirma que la cuenta sea Empresa/Creador, enlázala a la Página correcta, autoriza otra vez y comprueba que instagram_basic esté permitido en la app.
- Meta no muestra permisos: confirma que Facebook Login e Instagram Graph API estén añadidos a la misma app de Meta.
- Falla la actualización del perfil: vuelve a autorizar para renovar permisos; comprueba el acceso de esa persona a la Página.
- No aparecen todas las páginas: Meta solo devuelve las páginas seleccionadas/autorizadas en esa sesión de OAuth. Reconecta y concede acceso a las demás.
