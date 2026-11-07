# Nexa Brief — instrucciones para agentes

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

## Desarrollo y túnel

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
