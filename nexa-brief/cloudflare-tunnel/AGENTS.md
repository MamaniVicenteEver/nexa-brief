# Cloudflare Tunnel — instrucciones para agentes

Usa los scripts de este directorio; no ejecutes `cloudflared` con el token como argumento ni guardes credenciales en el código.

- `./up.sh`: asegura que el origen local esté listo y levanta `nexa-brief-cloudflared` en Docker.
- `./status.sh`: muestra estado local, público y del contenedor sin revelar credenciales.
- El token debe existir como archivo legible por el usuario que ejecuta Docker. Su ruta se configura con `CLOUDFLARE_TUNNEL_TOKEN_FILE`.
- El ID del túnel y los valores predeterminados están en `up.sh`; son identificadores, no secretos.
- La configuración de ingress es remota en Cloudflare. La regla actual debe seguir apuntando a `http://localhost:3000` mientras el contenedor use `--network host`.
- No subas logs, tokens, archivos `.env` ni otros secretos. No cambies reglas de autenticación de la aplicación para habilitar el túnel.
