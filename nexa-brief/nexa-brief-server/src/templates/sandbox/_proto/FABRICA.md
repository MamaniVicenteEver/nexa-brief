# Fábrica de videos con los prototipos (mapas y pizarra)

Dos motores, un núcleo compartido. Un video = solo datos (`assets/scene.json`); el motor no se toca.

| prototipo | motor | ejemplo completo | formato | referencia |
|---|---|---|---|---|
| Mapas satelitales (NodeHistory) | `nodehistory/_mapas/` (`ESCENA.md`) | `nodehistory/bolivia-mar/` (8:01) | 9:16 y 16:9 | `nuevos/ejmplo2/` |
| Pizarra con personaje (NodeAction) | `nodeaction/_pizarra/` (`ESCENA.md`, `PERSONAJES.md`) | `nodeaction/pizarra-olvido/` (6:39) | 16:9 | `nuevos/ejmplo1/` |

Núcleo `_proto/proto.js` (igual para los dos): carga, anclas `"@palabra"`, reproductor (el tiempo sale del
audio; ▶ si el navegador bloquea el autoplay; clic/espacio pausa, ←/→ 5 s), contrato de grabación
`window.__promo`, subtítulos, **intro** (`v1` golpe · `v2` pregunta + revelación) y **cierre de canal**
(gracias → canal → LIKE → flecha → SUSCRÍBETE + campana → apoyo → dirección), igual que producción.

## Pipeline de un video nuevo (≈ 1 h de máquina, poca atención humana)

| paso | quién | cómo |
|---|---|---|
| 1. Guion + PLAN con fuentes + inventario visual + publish.json | **Codex** | copiar `work/tarea-codex-guion.md` del ejemplo y cambiar tema/duración |
| 2. Revisión del guion (datos, neutralidad, frases raras) | orquestador (Claude) | leer segmento por segmento; corregir SOLO con lo que diga la fuente |
| 3. Voz | Gemini TTS | `tools/narrate.py assets/script.json work/narration --design binary\|rough --lead 1.2 --tail 6.0` |
| 4. Tiempos por palabra | Whisper | `tools/transcribe.py work/narration.mp3 assets/script.json assets/lyrics.json`; `cp work/narration.mp3 assets/song.mp3` |
| 5. Storyboard (`scene.json`, `index.html`, `config.json`) | **Codex** | copiar `work/tarea-codex-storyboard.md` del ejemplo |
| 6. Revisión visual con hojas de cuadros | orquestador | Playwright + `window.__promo.seek(t)`; `missingAnchors()` = `[]` |
| 7. Render | máquina | `_tools/commercial/render_promo.py <página> <mp4> --size 1080x1920` (mapas) / `1920x1080` |

Lo que cambia entre videos: **mapas** → textos, colores, regiones, cámara (con nombres de lugares: `places.json`);
**pizarra** → el personaje (`"character": "nina"`, `cast`), sus poses/caras y los dibujos (paquetes en `props/`).

## Lecciones (2026-10-23)
- **Codex no puede abrir Chrome en su sandbox** (`-s workspace-write`): no puede capturar hojas. La revisión
  visual la hace el orquestador; en los encargos pedirle verificación por script (JSON, anclas, nombres).
- Codex arma regiones históricas como rectángulos: por eso el motor recorta los `poly` contra la tierra y con
  `within` contra el país actual (el borde sale real).
- Codex encima el texto con el personaje cuando lo pone chico al centro: revisar las hojas y correr el texto.
- Ropa de personajes: orden de capas cuerpo → ropa → brazos (`tubes(..., parts)`), si no la ropa tapa los brazos.
- La voz de `rough` (Sadaltager) salió a 139 ppm: para pizarra conviene pedir ritmo más lento en `voice_direction`.
