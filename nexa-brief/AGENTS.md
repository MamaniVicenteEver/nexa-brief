# Nexa Brief — instrucciones para agentes

## Perfil activo: ubicación de proyectos y diseños

- En perfiles v2/v3, `NEXA_PROFILE_DIR` identifica la raíz del perfil activo; la
  selección por defecto se configura una sola vez en el `.env` raíz. Las variables
  de entorno explícitas tienen prioridad. Comprueba la selección efectiva del proceso
  antes de escribir: cambiar `.env` no cambia procesos ya iniciados.
  Para comandos de shell desde la raíz ejecuta `source scripts/profile-env.sh`;
  no leas ni imprimas el `.env` completo. Para cambiar de perfil, actualiza la
  variable y ejecuta `scripts/storage-profile.py activate <id>` para mantener el
  selector heredado alineado; reinicia servicios coordinadamente sin trabajos activos.
- Los prototipos, sus archivos y evidencias van en `"$NEXA_PROFILE_DIR/sandbox/<categoría>/<id>/"`;
  las producciones van en `"$NEXA_PROFILE_DIR/productions/<categoría>/<id>/"`.
  `src/templates/sandbox/` contiene herramientas, motores y documentación compartidos,
  además de contenido histórico; no es el destino de proyectos nuevos del perfil.
- Comprueba `profile.json`, la ruta real y el perfil correcto antes de crear o modificar
  archivos. No copies, muevas, borres ni agregues a Git proyectos del perfil por inferencia.
  Las definiciones y motores compartidos del repositorio se editan solo si la tarea
  requiere cambiar el diseño compartido; un video basado en él no justifica duplicarlos.
- Para CLI antiguas, verifica el destino real antes de ejecutarlas: algunas todavía
  usan rutas históricas de `src/templates/`. Lee la guía de perfil del servidor.


- Un **motor reutilizable** creado o modificado como código compartido puede vivir en
  `nexa-brief-server/src/templates/sandbox/<categoría>/_<motor>/` y registrarse en el
  catálogo de diseños. Los episodios, sus medios, pruebas y evidencias permanecen en
  el sandbox del perfil; no se traslada un proyecto completo al repositorio junto al motor.

## Respaldos y uso del disco

- Los respaldos completos, históricos y de migración van exclusivamente al HDD
  de respaldos, fuera del SSD del sistema. Comprueba el montaje real y el UUID
  configurado en `~/.config/nexa-brief/video-storage.json` antes de escribir.
- Si el HDD no está montado, detén el respaldo. Nunca uses una carpeta del SSD
  como sustituto: ni `~/.local/share/nexa-brief/backups/`, ni el repositorio, ni `/tmp`.
- Antes de retirar un respaldo de datos, crea y verifica su sustituto actualizado
  en el HDD. Excluye dependencias y cachés regenerables; conserva código modificado,
  fuentes y medios originales. No muestres credenciales al copiar un perfil.
- Para limpieza, distingue archivos operativos, duplicados comprobados y cachés.
  No borres `.git`, `.venv`, modelos, medios, sesiones ni imágenes/volúmenes Docker
  como si fueran caché. No arranques contenedores como parte de una limpieza.
- Política e inventario: `nexa-brief-server/docs/almacenamiento-respaldos-limpieza-2026-11.md`.
- Respaldo diario del host: `scripts/profile_backups/README.md`. Usa su servicio
  con guarda de montaje; nunca ejecutes una copia con una ruta local alternativa.
  No leas ni muestres `~/.config/nexa-brief/full-backup-password`.

## Prevención de consumo excesivo y fugas de recursos

Para cambios que afecten renderizado, vistas previas, mapas, cachés, vigilancia de
archivos, sondeos o trabajos en segundo plano:

- Medí CPU y memoria de los procesos relevantes antes y después, en reposo, durante
  el uso y después de cerrar la vista o terminar el trabajo. Considerá la memoria
  disponible y la actividad de intercambio, no solo la RAM libre. Ajustá la duración
  de la prueba al riesgo: una muestra breve no demuestra que no exista una fuga.
- Comprobá que se liberen iframes, navegadores, temporizadores, observadores y tareas
  al dejar de necesitarlos. Evitá sondeos o bucles innecesarios y limitá la concurrencia
  y las cachés; no mantengas motores pesados activos solo para mostrar miniaturas.
- Conservá `watchfiles` para la recarga de desarrollo: sin él Uvicorn puede recorrer
  repetidamente todo `src/`, incluidas las plantillas y cachés de mapas.
- Antes de reiniciar servicios, verificá que no haya producciones, grabaciones o
  capturas activas. No detengas procesos ajenos para reducir el consumo. Informá las
  mediciones, problemas detectados y verificaciones que no se pudieron realizar.

No es necesario hacer un perfilado exhaustivo para cambios que no afecten recursos.

## Desarrollo y túnel

- Para renovar y poner en marcha las imágenes Docker de web y API con cambios de código,
  usa `./scripts/docker-refresh.sh --restart` desde la raíz. Comprueba antes que no
  haya trabajos activos. El script espera que los servicios estén saludables antes
  de limpiar imágenes obsoletas y conserva `latest`, `previous` y los datos del perfil.
  Usa `--build` solo para construir sin recrear servicios y `--fresh` únicamente si
  se necesita reconstruir sin caché. No elimines volúmenes ni perfiles.
- Para levantar la versión local y exponerla en `https://nexa-brief.everdev.space`, ejecuta `make public-up` desde este directorio. El script inicia `make dev` en segundo plano si el puerto 3000 está libre y luego conecta el túnel.
- Para revisar el estado, usa `make public-status`. El conector de Cloudflare también tiene reinicio automático de Docker.
- La ruta actual del token es externa al repositorio: `~/.config/cloudflared/nexa-brief-token` (o `CLOUDFLARE_TUNNEL_TOKEN_FILE`). No leas, muestres, copies ni agregues el token al repositorio.
- El hostname y la ruta de entrada los administra Cloudflare; actualmente `nexa-brief.everdev.space` apunta a `http://localhost:3000`. No inventes ni reemplaces esa configuración con un archivo local.
- Mantén separado el acceso directo de desarrollo y las reglas de autenticación de Docker. No cambies el comportamiento de login para resolver problemas del túnel.
- Para el servidor futuro, revisa `cloudflare-tunnel/README.md`: la topología de red puede requerir que el origen cambie de `localhost:3000` a un servicio de Docker.

## Prototipos nuevos (plantillas desde una referencia)

Si te piden crear una plantilla NUEVA a partir de una referencia (o te pasan una URL `/api/v1/agent/prototipo/...`), leé y seguí `nexa-brief-server/src/templates/sandbox/PROTOTIPO.md`: es el único punto de entrada.

## Preparación por lotes desde chat

Para varios videos o preparación programada, lee `nexa-brief-server/src/skills/explainer/batch/SKILL.md`. Usa la cola persistente con máximo cinco productores y sin grabación automática.
