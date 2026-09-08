# Nexa Brief — Docker

## Arquitectura

Se revisaron cuatro proyectos:

| Proyecto | Rol | Despliegue |
| --- | --- | --- |
| `nexa-brief-web` | Panel Next.js | Servicio `web` (3000) |
| `nexa-brief-server` | API FastAPI/orquestador | Servicio `api` (8000) |
| `nexa-brief-remotion` | Motor Node invocado por la API | Incluido en `api` |
| `nexa-hyperframes-test` | Composiciones CLI experimentales | No es servicio persistente |

El código actual no usa Redis, una base de datos ni un worker externo: los jobs se ejecutan en FastAPI y los artefactos quedan en disco. Por ello no se inventan esos servicios. `nexa_private` es una red bridge dedicada; la API conserva salida a Internet para IA, proveedores de medios y OAuth.

## Configuración

```bash
cd nexa-brief
cp .env.example .env
cp nexa-brief-server/.env.example nexa-brief-server/.env
cp nexa-brief-web/.env.example nexa-brief-web/.env.local
```

Completa las claves de `nexa-brief-server/.env` y no subas esos secretos. `NEXT_PUBLIC_API_URL` debe ser la URL que usa el navegador (`http://localhost:8000`), no `http://api:8000`, que solo existe dentro de Docker.

## Operación

```bash
docker compose build
docker compose up -d
```

- Web: http://localhost:3000
- API: http://localhost:8000
- Salud API: http://localhost:8000/health
- OpenAPI: http://localhost:8000/docs

Detener sin borrar datos:

```bash
docker compose down
```

Verificar build, inicio, salud y una operación real (`GET /api/v1/niches`):

```bash
./scripts/verify-docker.sh
```

Cuando cambies código, dependencias o los Dockerfiles, usa el script de
mantenimiento. Nunca borra los volúmenes:

```bash
# Solo actualizar imágenes; conserva los servicios apagados.
./scripts/docker-refresh.sh --build

# Reconstruir cambios y recrear/iniciar web + API.
./scripts/docker-refresh.sh --restart

# Reconstrucción completa sin caché (solo si una capa está dañada).
./scripts/docker-refresh.sh --fresh
```

Los volúmenes `nexa-brief-data`, `nexa-brief-output` y `nexa-brief-accounts` preservan biblioteca, renders y credenciales cifradas. Esto borra esos datos de manera **destructiva**:

```bash
docker compose down -v
```
