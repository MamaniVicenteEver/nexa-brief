# Contexto del proyecto nexa-brief (foto del 2026-11-19)

Documento para retomar el trabajo en un chat nuevo sin repetir la revisión. Es una foto del 19/11/2026: antes de afirmar algo, verifícalo con git y con los archivos.

## 1. Dónde está el trabajo

- Fuente de verdad: servidor `alfred-server`, carpeta `~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server`, rama `feat/nodetech-paquete-publicacion`, HEAD `0ec04378`.
- Hay cambios sin commit en todo el repo (919 entradas el 19/11). En NodeMotion: 277 nuevos (A), 46 modificados (M), 5 mixtos (AM) y 13 sin seguimiento (??).
- La copia local `/home/university/Documentos/Proyectos/nexa-brief/nexa-brief` va por detrás: no tiene el refactor de NodeMotion.
- La carpeta local `nexa-brief-IA` es solo de entrada; no contiene código.
- Acceso: `ssh alfred-server` funciona sin contraseña. Los comandos del servidor se ejecutan con bash.

## 2. Estructura

- API FastAPI: `src/presentation`, `src/core`, `src/adapters`, `src/modules`, `src/config`.
- Skills de producción de contenido: `src/skills` (índice `README.md`, `CALIDAD.md`, `ORQUESTACION.md`).
- Catálogo de plantillas: `src/templates/templates.json`. El comportamiento del pipeline está en `niches.json` (raíz del servidor).
- NodeMotion: plantillas en `src/templates/nodemotion/{lyrics,commercial,image,video}/<id>/` (solo código y JSON). Motores en `src/templates/_tools/nodemotion/{lyrics,promo}/designs/<id>/`.
- Perfil de datos (medios, prototipos, producciones): `~/.local/share/nexa-brief/profiles/profesional/` con `sandbox/` y `productions/`.

## 3. Reglas (los AGENTS.md mandan)

- Estándar NodeMotion (AGENTS.md raíz, «Estándar vigente…»): motor y definición en `src/templates/nodemotion/<cat>/<id>/`, solo código y JSON. Medios en el perfil. Prototipos en `productions/nodemotion/<cat>/<id>/`.
- Conexiones obligatorias de una plantilla: nicho en `niches.json`, entrada en `templates.json`, diseño registrado en `_tools/nodemotion`, entrada en `showcase/components.json` y poster.
- No cambiar el diseño de plantillas existentes sin pedido explícito para esa plantilla. No bajar calidad (fps, resolución, efectos).
- Sin `git commit`, `push`, render ni publicación sin autorización explícita. «Solo preparación» significa sin render.
- Antes de mover o borrar: copia verificada y confirmación del usuario.
- No leer `.env`, `accounts.json`, `client_secret*.json`, `users.json` ni tokens.
- Nombres: `lyrics-<plantilla>`; una versión nueva es `lyrics-<plantilla>-<cambio>`, con nombre visible en español y único.
- Trabajo directo con Claude, sin delegar en otros agentes (preferencia del usuario, 17/11).

## 4. Estado de NodeMotion (19/11)

| Familia | En catálogo | Motor registrado | Con nicho | Validada para HyperFrames |
|---|---|---|---|---|
| Letras | 30 | 30 | 28 | 30 de 30 |
| Promos | 9 | 9 | 9 | 8 de 9 (falta promo-mono) |
| Imagen | 3 | no aplica | 3 | no revisado |
| Video | 1 | no aplica | 1 | no revisado |

Categoría «Fase de pruebas»: lyrics-latido, lyrics-suave, lyrics-triste, lyrics-resaltado, lyrics-cristal, lyrics-mirada, lyrics-amor-impredecible.

## 5. Pendientes verificados

1. Corregido el 19/11: lyrics-hologram-worlds y lyrics-grunge-montage sí tienen nicho. La app lee los nichos del perfil (`~/.local/share/nexa-brief/profiles/profesional/config/niches.json`), no el `niches.json` del repo, que va por detrás. Cinético Noir quedó añadido al perfil, inactivo, el 19/11.
2. promo-mono no está en `HF_VALIDATED_LYRICS_TEMPLATE_IDS` (`src/adapters/recorder/infrastructure/hyperframes_adapter.py`, línea 155).
3. Documentación incompleta: 10 plantillas sin README.md (lyrics-grunge-rojo, lyrics-rasgado, lyrics-hologram, lyrics-trazo, lyrics-decadas, lyrics-hologram-worlds, lyrics-grunge-montage, promo-breaking, promo-mono, promo-pulse). lyrics-grunge-montage tampoco tiene DESIGN.md.
4. Validación sin cerrar: focalizados de NodeMotion 287 pasan. La última suite completa registrada tiene 147 fallos (línea base: 137), antes de las últimas correcciones. Faltan capturas visuales adjuntas y un render registrado del motor nuevo. Detalle en `docs/nodemotion-validation.md`.
5. 12 proyectos del perfil siguen en «needs-review» sin tocar: 22484535, 2eb2d236, daaa02cc, 232f0226, d0cde5c7, 35652c87, lyrics-final-cut, promo-fuerza-motivacion, ab8098d6, 73cbf499, 341c6bf3, 8364343a.
6. Recursos compartidos: el código usa todavía `_tools/nodemotion/shared/resources`; el estándar pide `productions/nodemotion/recursos/`. Pendiente documentado.
7. El registro copia el código del motor a `_tools/nodemotion/<familia>/designs/<id>/` y deja una entrada delgada en la plantilla. Falta decidir si el motor debe vivir en un solo lugar.

## 6. Dónde leer antes de tocar algo

1. `AGENTS.md` (raíz del repo y de `nexa-brief-server`).
2. `src/skills/README.md`, `CALIDAD.md`, `ORQUESTACION.md`.
3. `src/templates/AGENTS.md` (completo, 24 KB).
4. `docs/nodemotion-template-authoring.md` (§2 y §5 a §7).
5. `docs/nodemotion-architecture.md` y `docs/nodemotion-validation.md`.
6. `src/templates/_tools/nodemotion/AGENTS.md`.

## 7. Comprobaciones rápidas

- Estado: `git status --short | wc -l` y `git status --short -- src/templates/nodemotion src/templates/_tools/nodemotion | awk '{print $1}' | sort | uniq -c`.
- Nicho de una plantilla: `grep -n '"<id-de-nicho>"' niches.json`.
- Validación HF: `grep -n -A40 HF_VALIDATED_LYRICS_TEMPLATE_IDS src/adapters/recorder/infrastructure/hyperframes_adapter.py`.
