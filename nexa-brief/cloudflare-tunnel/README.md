# Túnel público de Nexa Brief

## Arranque local con un comando

Desde `nexa-brief/nexa-brief` ejecuta:

```bash
make public-up
```

El comando conserva el modo de desarrollo local: si la app ya responde en el puerto 3000, la deja como está; si no hay un servicio escuchando ahí, inicia `make dev` en segundo plano y guarda sus logs en `cloudflare-tunnel/dev.log`. Después inicia o reutiliza el contenedor `nexa-brief-cloudflared` y espera la conexión. El contenedor tiene `restart: unless-stopped`, por lo que Docker vuelve a iniciarlo al encender el equipo.

Para revisar el estado:

```bash
make public-status
```

## Requisitos locales

- Docker Engine activo.
- El token del túnel, fuera del repositorio, en `~/.config/cloudflared/nexa-brief-token`.
- Acceso de lectura al token para el usuario actual. El script comprueba que el archivo exista y no esté vacío, pero nunca imprime su contenido.
- La entrada remota del túnel `nexa-brief.everdev.space` debe apuntar al origen `http://localhost:3000`. El contenedor usa la red del host para que `localhost` sea este equipo.

Si el token se guarda en otra ubicación, define `CLOUDFLARE_TUNNEL_TOKEN_FILE` antes de ejecutar `make public-up`. Para cambiar los valores no secretos, también se pueden definir `CLOUDFLARE_TUNNEL_ID`, `CLOUDFLARE_TUNNEL_CONTAINER`, `CLOUDFLARE_TUNNEL_IMAGE`, `NEXA_BRIEF_ORIGIN_URL` y `NEXA_BRIEF_PUBLIC_URL`.

## Si la app ya está en Docker

Si Docker ya publica la web en el puerto 3000 del host, `make public-up` la reutiliza y no inicia `make dev`. Si el futuro servidor conecta el túnel directamente a una red Docker interna, cambia la regla de ingress remota para usar el nombre del servicio (por ejemplo `http://web:3000`) y conecta el contenedor del túnel a esa misma red; en ese esquema no uses `--network host`.

No guardes el token en este directorio, en `.env`, en Git ni en logs. Para reinstalarlo en otra máquina, créalo mediante Cloudflare y configura `CLOUDFLARE_TUNNEL_TOKEN_FILE` apuntando a un archivo protegido, preferiblemente con permisos `600`.
