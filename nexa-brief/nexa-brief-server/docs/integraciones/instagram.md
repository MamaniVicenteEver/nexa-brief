# Instagram en Nexa Brief

Nexa Brief usa **Instagram API con Facebook Login**. Al conectar Instagram, Meta entrega las Páginas accesibles para la persona que autoriza; el servidor consulta `instagram_business_account` en cada Página, obtiene el usuario profesional asociado y guarda el token de esa Página cifrado. En Canales aparece el Instagram junto con la Página a la que está vinculado.

La publicación implementada en esta etapa es **Reels**. El video se sirve a Meta mediante una URL HTTPS firmada y temporal; Meta descarga el archivo, procesa un contenedor y después Nexa Brief publica el Reel. El archivo tiene que estar dentro de `OUTPUT_DIR` y la URL pública tiene que alcanzar el servidor API.

## Configuración del servidor

En el `.env` del servidor:

```dotenv
FACEBOOK_CLIENT_ID=ID_DE_LA_APP_META
FACEBOOK_CLIENT_SECRET=SECRETO_DE_LA_APP_META
META_GRAPH_API_VERSION=v26.0
PUBLIC_BASE_URL=https://nexa-brief.everdev.space
PUBLISHER_ENCRYPTION_KEY=LA_CLAVE_FERNET_QUE_YA_USA_ACCOUNTS_JSON
```

`PUBLIC_BASE_URL` debe ser solo el origen HTTPS, sin `/api`, sin ruta y sin barra final. El proxy o túnel tiene que enviar `/api/v1/publish/instagram-media/...` al backend. Si cambias de dominio, actualiza esta variable y también el URI de redirección de Meta.

No regeneres `PUBLISHER_ENCRYPTION_KEY` si ya tienes cuentas guardadas: los tokens existentes dejarían de poder descifrarse.

## Configuración de Meta

En la misma app que usa Facebook:

1. Agrega/configura **Facebook Login** y el producto/caso de uso de **Instagram Graph API**.
2. En Facebook Login → Settings, habilita OAuth de cliente y web, y agrega estos URI OAuth válidos:
   - `https://nexa-brief.everdev.space/api/v1/publish/auth/facebook/callback`
   - `https://nexa-brief.everdev.space/api/v1/publish/auth/instagram/callback`
   - Para desarrollo local, si pruebas allí: `http://localhost:8000/api/v1/publish/auth/facebook/callback`
   - Para desarrollo local, si pruebas allí: `http://localhost:8000/api/v1/publish/auth/instagram/callback`
3. Configura el dominio de la app como `nexa-brief.everdev.space` y conserva la URL de privacidad y la URL de eliminación de datos de usuario requeridas por la app.
4. Habilita estos permisos para el inicio de sesión:
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Para cuentas que no sean roles de la app, solicita en App Review el acceso avanzado que Meta requiera para esos permisos y publica la app. En modo desarrollo, la autorización queda limitada a administradores, desarrolladores, evaluadores y cuentas de prueba.

Cada cuenta de Instagram se crea o convierte desde Instagram/Meta; Meta no permite que Nexa Brief cree perfiles. Para que cada Página tenga su propio Instagram, crea o convierte cada perfil a **Empresa** o **Creador** y vincúlalo a su Página correspondiente en Meta Business Suite. La persona que autoriza debe tener acceso suficiente a esas Páginas. Este flujo importa todas las cuentas profesionales enlazadas a las Páginas que Meta devuelve; si una Página no muestra Instagram, revisa primero su vínculo en Meta Business Suite.

## Uso

1. En Canales, elige **Conectar cuenta → Instagram**.
2. Autoriza el acceso en Meta. Nexa descubre las Páginas y los perfiles Instagram vinculados.
3. Revisa en la tarjeta que el `@usuario` y la Página correspondan. Para reconectar y refrescar relaciones o permisos, vuelve a conectar Instagram.
4. Publica Reels usando el selector `instagram:<alias>` o agrega esa cuenta a la publicación/programación.

Para Reels, Meta necesita descargar el video desde Internet. El servidor debe permanecer encendido y accesible por HTTPS durante la publicación. La URL firmada expira después de seis horas; contiene acceso temporal a un único archivo del directorio de salida.

## Referencias

- [Colección oficial de Meta: Instagram API con Facebook Login](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)
- [Colección oficial de Meta: listar Páginas y `instagram_business_account`](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf)
- [Colección oficial de Meta: publicar Reels](https://www.postman.com/meta/instagram/folder/y6xustx/reels-publishing)
