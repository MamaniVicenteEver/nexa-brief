> Informe histórico de la primera etapa. La configuración vigente comparte **todos los datos** mediante el [perfil Profesional externo](perfil-profesional-compartido-2026-11.md).

# Conexiones compartidas entre Docker y desarrollo

Fecha: 2 de noviembre de 2026. Instalación: `alfred-server`.

Docker y desarrollo usan las mismas autorizaciones y metadatos de canales. Conservan separados sus trabajos, colas, producciones, archivos de salida y usuarios de la web. Al reconectar o desconectar una cuenta, el cambio afecta a ambos entornos y aparece en su siguiente consulta del panel.

## Distribución

| Recurso | Docker | Desarrollo |
| --- | --- | --- |
| Web | `https://nexa-brief.everdev.space` | `https://dev-nexa-brief.everdev.space` |
| Puerto web / API | `127.0.0.1:3002` / `127.0.0.1:8002` | `3000` / `8000` |
| Autorizaciones cifradas | `.runtime/connections/accounts.json`, montado en `/app/accounts` | El mismo archivo mediante `ACCOUNTS_JSON_PATH` |
| Verificación, estadísticas y capacidad de miniaturas | `.runtime/connections/channels.json` | El mismo archivo mediante `SHARED_CONNECTIONS_DIR` |
| Trabajos y colas | Volumen `nexa-brief-data` | `nexa-brief-server/data` |
| Archivos de salida | Volumen `nexa-brief-output` | Directorio de salida del servidor de desarrollo |
| Sesiones de TikTok | Servicio único del host | El mismo servicio del host |

Los historiales de publicaciones permanecen en cada entorno; por eso el contador de videos publicados puede ser diferente aunque las cuentas coincidan. Las carpetas de plantillas siguen compartidas como antes de esta intervención.

La pantalla de desarrollo muestra **Desarrollo · cuentas reales**. Su inicio fuerza `ENABLE_AUTO_PUBLISHING=false`; las publicaciones manuales usan las cuentas reales seleccionadas. No es un entorno de prueba proporcionado por YouTube o TikTok.

## Arranque habitual

Desde `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief`:

```bash
./scripts/start-docker.sh
./scripts/start-dev.sh
```

`make dev` inicia API y web. `Ctrl+C` detiene esos procesos y deja TikTok disponible para Docker. `make docker-up` también inicia el servicio compartido antes de levantar los contenedores. `make docker-build` solo construye las imágenes.

El servicio independiente quedó instalado y habilitado:

```bash
systemctl --user status nexa-tiktok-connections.service
systemctl --user restart nexa-tiktok-connections.service
```

Solo reiniciar TikTok cuando no tenga trabajos activos. La instalación conserva el directorio de datos y los perfiles existentes, con Playwright 1.64.1. No se copiaron ni migraron perfiles del navegador. El usuario del servidor tiene `Linger=yes`, de modo que el servicio no depende de una sesión SSH abierta.

Para reinstalar exclusivamente su supervisor, con el puerto 8100 disponible y sus dependencias ya instaladas:

```bash
./scripts/install-connections-service.sh
```

El servicio escucha en el puerto 8100 con autenticación obligatoria. Docker accede por `host.docker.internal`, y desarrollo por la dirección local. No se añadió una ruta pública al túnel.

## Configuración y concurrencia

`start-connections.sh` comprueba la clave del puente contra el servicio y ejecuta `sync-connection-config.py`. Este último exporta **solo** `TIKTOK_SERVICE_KEY` a `.runtime/connections/tiktok-service.env`, con permisos 0600. Compose importa ese archivo al ejecutar la API. No se incorpora el `.env` raíz completo al contenedor. La carpeta `.runtime` está excluida de Git y del contexto de construcción de Docker.

Ambas API conservan la misma clave de cifrado de las autorizaciones; se comprobó su compatibilidad sin mostrarla. Las escrituras de credenciales usan bloqueo entre procesos, combinación de cambios y reemplazo atómico. La renovación OAuth usa un bloqueo por cuenta. La colección compartida de canales también bloquea las escrituras entre procesos. Los lectores consultan el archivo vigente.

Los archivos para TikTok se transfieren al servicio mediante una petición autenticada en bloques, con comprobación SHA-256 y límite de 1 GiB. El servicio devuelve una ruta de su propio disco, evitando enviarle rutas que solo existen dentro del contenedor. Las claves de idempotencia tienen espacios separados `production` y `development`.

Esto evita colisiones de trabajos entre entornos. No impide que una persona solicite publicar deliberadamente el mismo video dos veces; cada solicitud manual debe revisar la cuenta y el contenido.

## Migración aplicada y recuperación

Se detuvieron los escritores después de comprobar que no había trabajos activos. Las entradas de Docker tuvieron prioridad para los alias ya existentes y se conservaron las conexiones exclusivas de desarrollo. Resultado: **7 YouTube, 3 TikTok, 8 Facebook y 6 Instagram**, iguales en ambas API.

Los originales se conservaron en `.runtime/backups/connections-20261102T151242Z/`. Los cambios de código anteriores están respaldados en `.runtime/backups/source-before-shared-connections/`. El volumen antiguo `nexa-brief-accounts` sigue disponible. Las imágenes anteriores se etiquetaron con `before-shared-connections-20261102` para API y web.

Una recuperación debe detener las API y comprobar los trabajos de TikTok antes de restaurar archivos o configuración. No eliminar volúmenes ni restablecer automáticamente el respaldo antiguo después de nuevas reconexiones, porque perdería autorizaciones posteriores a la migración. Los respaldos contienen credenciales cifradas y deben permanecer privados.

## Verificación

- 110 pruebas del backend aprobadas: almacenamiento, renovación, seguridad, API de publicación, capacidades de YouTube, puente TikTok y concurrencia. Se añadieron 8 pruebas para conexiones compartidas.
- 19 pruebas del servicio TikTok aprobadas, incluidas 2 nuevas sobre transferencia autenticada de archivos, integridad y limpieza.
- TypeScript, lint Python de los archivos modificados, construcción de ambas imágenes y configuración de Compose aprobados.
- API y web de ambos entornos respondieron correctamente; ambos registros devuelven las mismas 24 conexiones. Desarrollo conserva 4 producciones y Docker 1, confirmando que no se mezclaron.
- Se transfirió una imagen temporal desde la API del contenedor al servicio TikTok, se verificó su integridad y se eliminó. La lista de trabajos de publicación permaneció idéntica.
- TikTok quedó saludable, sin trabajos activos; se conservó un trabajo anterior pendiente de revisión.
- El panel de desarrollo se comprobó en el navegador. Producción conserva su pantalla de acceso habitual.

No se publicó contenido real durante esta verificación. La vigencia efectiva de cada permiso se comprueba con la operación correspondiente; un estado guardado no sustituye la respuesta de la plataforma.

La conexión individual de canales de marca, las miniaturas y la preparación de pruebas A/B se documentan en [el estudio de YouTube](youtube-canales-miniaturas-ab-2026-11.md).
