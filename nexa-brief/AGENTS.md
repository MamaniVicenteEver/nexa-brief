# Nexa Brief — instrucciones para agentes

- Para levantar la versión local y exponerla en `https://nexa-brief.everdev.space`, ejecuta `make public-up` desde este directorio. El script inicia `make dev` en segundo plano si el puerto 3000 está libre y luego conecta el túnel.
- Para revisar el estado, usa `make public-status`. El conector de Cloudflare también tiene reinicio automático de Docker.
- La ruta actual del token es externa al repositorio: `~/.config/cloudflared/nexa-brief-token` (o `CLOUDFLARE_TUNNEL_TOKEN_FILE`). No leas, muestres, copies ni agregues el token al repositorio.
- El hostname y la ruta de entrada los administra Cloudflare; actualmente `nexa-brief.everdev.space` apunta a `http://localhost:3000`. No inventes ni reemplaces esa configuración con un archivo local.
- Mantén separado el acceso directo de desarrollo y las reglas de autenticación de Docker. No cambies el comportamiento de login para resolver problemas del túnel.
- Para el servidor futuro, revisa `cloudflare-tunnel/README.md`: la topología de red puede requerir que el origen cambie de `localhost:3000` a un servicio de Docker.

## Prototipos nuevos (plantillas desde una referencia)

Si te piden crear una plantilla NUEVA a partir de una referencia (o te pasan una URL `/api/v1/agent/prototipo/...`), leé y seguí `nexa-brief-server/src/templates/sandbox/PROTOTIPO.md`: es el único punto de entrada.
