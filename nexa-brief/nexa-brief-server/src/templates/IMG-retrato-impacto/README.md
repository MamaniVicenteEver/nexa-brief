# 01 — Imagen con fondo (caso #1)

Imagen con fondo de 1 color, 2 (split), 4 (grid) o difuminado + un objeto al
medio (persona, auto...). El HTML crea la ilusión de que solo existe el objeto
(el fondo se funde con la página) y agrega letras cortas según las posiciones
del JSON. La imagen se mueve suave (respiración/deriva). Música acorde.

Esta plantilla es consumida por el pipeline a través de `pipeline_type:
"config_driven_template"` en `niches.json` (ver `NicheConfig.template` en
`src/config/niche_config.py`). A diferencia del flujo por defecto (donde
DeepSeek genera un `index.html` completo desde cero en cada corrida), acá
`index.html` es estático y `Stage 2` (`visual_designer`) + `Stage 5`
(`html_generator`) solo producen `config.json` a partir de dos prompts ya
probados (ver `prompts/`).

## Plantilla

- `index.html` — motor v7, 3 modos en un solo CONFIG: `solid` / `regions`
  (split-grid) / `blur` (difuminado). **Es estática**: nunca se regenera.
  Carga su CONFIG en runtime desde `config.json` (`fetch("config.json")`), en
  la misma carpeta. Incluye `keepOut` (zonas prohibidas para texto ya
  horneado en el arte, recorte "guillotina") y `typography` (4 combinaciones
  de fuente: `default` / `condensed` / `serif-display` / `black-rounded`,
  `default` = look de siempre).
- `manifest.json` — metadata de la plantilla (rutas de los prompts, assets
  requeridos), leída por `NicheConfig.template` a través de las rutas
  configuradas en `niches.json`.

## Prompts (`prompts/`)

- `prompts/vision_extractor.md` — **Prompt 1 (v7.6)**: prompt multimodal que
  analiza la imagen real de fondo y devuelve un JSON grande (orientación,
  calibración de color, topología del fondo, texto ya horneado en el arte,
  zonas seguras para texto nuevo). Ejecutado en `visual_designer.py` vía
  `AIPort.analyze_image_full()` (Gemini).
- `prompts/config_mapper.md` — **Prompt 2 (v8.2)**: mapea 1:1 el JSON del
  Prompt 1 al schema de `config.json`. Ejecutado en `html_generator.py` vía
  `AIPort.complete_json()` (DeepSeek). **Nota**: a diferencia de la versión
  original documentada en `docs/prototypes/01-image-bg-source/Example.md`,
  este prompt YA NO incluye el `STEP 0` de rotación manual del archivo —
  el pipeline rota `bg.jpg` de forma determinística con Pillow
  (`src/modules/image_rotation.py`) antes de que este prompt se ejecute.

El historial completo de versiones (v7.3–v7.6) y los diagnósticos de bugs
encontrados durante el tuning manual de estos prompts están archivados en
`docs/prototypes/01-image-bg-source/Example.md` — no son necesarios para el
runtime, solo como referencia histórica.

## Contenido requerido por video generado

- `bg.jpg` — imagen de fondo (resuelta por `resource_fetcher`: buscada
  automáticamente, provista por URL, o tomada de la librería local en
  `data/image_library/`).
- `song.mp3` — música acorde (misma lógica, vía `data/music_library/`).
- `config.json` — generado por `html_generator.py` a partir del Prompt 2.
- `index.html` — copiado tal cual desde esta carpeta.

## Flujo de armado (automatizado por el pipeline)

```
bg.jpg (real) → Prompt 1 (visión) → vision_analysis (JSON)
  → rotación física si hace falta → Prompt 2 → config.json
  → se coloca junto a index.html, bg.jpg, song.mp3 → video_recorder graba
```

## Estado

- [x] Plantilla estática integrada al pipeline (`pipeline_type: "config_driven_template"`)
- [x] Prompts extraídos y adaptados para ejecución automática
- [ ] Verificado end-to-end en 16:9 y 9:16 con un nicho real
