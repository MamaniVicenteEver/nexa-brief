# Overview de plantillas y plan para un video NODEPOLITICS (diseño imperio)

Fecha: 2026-11-13. Estado: planificación. No hay tema todavía, así que no se creó ninguna carpeta de video.

## 1. Qué muestra la pantalla

- Captura de `/showcase` (nexa-brief-web, en 192.168.20.12:3000). Es el catálogo visual de componentes del explainer-kit.
- La tarjeta NODEPOLITICS corresponde al diseño `imperio`: `src/templates/_tools/explainer-kit/designs/imperio/design.json` (name: NODEPOLITICS).
- «25 entradas» = 23 componentes `imperio.*` + `common.flash` + `common.lyric`.
- «2 videos con este diseño»:
  - `src/templates/sandbox/nodepolitics/imperio-demo` (sandbox): estado «lista para revisar». Usa la narración y los medios de Turing solo para probar el lenguaje visual. No es publicable.
  - `src/templates/nodeatlas/japon-expansion-prueba`: estado «renderizado», título «LA EXPANSIÓN DEL IMPERIO JAPONÉS».

## 2. Familias de plantillas

| Familia | Qué es | Dónde | Volumen |
|---|---|---|---|
| NodeMotion (música) | Videos de letras, promos, imágenes y videos de fondo | `src/templates/templates.json` + `nodemotion/` | 33 plantillas: lyrics 16, testing 7, commercial 6, image 3, video 1. `niches.json`: 36 nichos, 33 activos |
| Explainer-kit (documentales narrados) | Videos NODE* con voz, transcripción, storyboard y componentes SVG/JS por frase | `src/templates/_tools/explainer-kit/` + `nodehistory/`, `nodetech/`, `nodepolitics/`, `nodeeconomy/`, `nodeatlas/`, `nodeactualidad/` | 15 diseños + `common`; 250 componentes en `catalog.json` |
| Atlas (mapas 3D) | Mapas MapLibre con movimiento, satelital, cinemático | `src/templates/nodeatlas/` (motor `_atlas`) | 9 carpetas |
| Sandbox | Casa de pruebas por categoría antes de publicar | `src/templates/sandbox/` | nodepolitics, nodeeconomy, nodetech, nodeaction, nodehistory, nodemotion, _proto, referencias |
| Herramientas | Generadores y utilidades | `src/templates/_tools/` | hyperframes, lyrics-sad, commercial, sandbox, nodemotion-promo, design-definitions, atlas, explainer-kit, player, etc. |

### Diseños del explainer-kit (registro: `designs/index.json`)

| Id | Nombre en el registro | Componentes |
|---|---|---|
| binary | NODEHISTORY | 27 |
| rough | PROTOTIPO | 31 |
| pop | DUOTONO | 25 |
| enmienda | EXPEDIENTE | 24 |
| imperio | NODEPOLITICS | 23 |
| carta | CARTA | 18 |
| collage | HEMEROTECA | 16 |
| dinero | NODECONOMY | 16 |
| grunge | CRUDO | 11 |
| pelicula | ARCHIVO 35 | 11 |
| atlas | NODEPOLITICS (mapas) | 11 |
| periodico | TITULARES | 9 |
| acuarela | TINTA | 7 |
| cronica | CRÓNICA | 7 |
| memorias | MEMORIAS | 5 |
| common | compartidos | 9 |

### Videos NODE* existentes

- nodehistory (11): acuarela-demo, memorias-demo, pelicula-demo, carta-demo, collage-demo, muro-de-berlin, periodico-demo, pop-demo, enmienda-demo, grunge-demo, cronica-demo.
- nodetech (2): muestras, lo-que-le-contas-a-la-ia-no-es-privado-tus-chats.
- nodeeconomy (2): dinero-demo, por-que-los-billetes-de-euro-tienen-puentes-y-ve.
- nodepolitics (1): imperio-demo.
- nodeatlas (9): resumen-geopolitico-demo, mapas-satelitales, _atlas, atlas-en-movimiento, atlas-cinematico, fronteras-demo, japon-expansion-prueba, _mapas, atlas-economias-demo.
- nodeactualidad (1): cara-a-cara.

## 3. Reglas del diseño imperio

- Voz: Charon (alternativas Algenib, Orus, Sadaltager), español latinoamericano neutro. La narración es continua: no se recorta, ralentiza ni se insertan silencios.
- Ventanas de medios: video documental visible 8–16 s; foto documental 6–12 s. Se mide hasta el siguiente `main`, el outro o el final del audio. Mapas, banderas y rótulos no cuentan como medio.
- Sonido: primero biblioteca (`GET /api/v1/sound-design/search`), después SFXMint.
- Mapas: coordenadas WGS84 `[longitud, latitud]`. El showcase omite el mapa base; en producción sí se conserva.
- Cierre: `song-with-outro.mp3`, `common.question` antes del outro, y `imperio.outrov2` como cierre.
- Paleta por defecto: fondo #7f9bab, acento #b3122f, sol #6c001b, tinta #f6f6f8. Fuentes: Fjalla One, Montserrat, Noto Sans JP.
- Guía: `_tools/explainer-kit/guides/imperio-production.md`. Política: `production-policy.json → style_policies.imperio`.

## 4. Reglas del canal NODEPOLITICS

- Público: adultos hispanohablantes. Tono neutral y firme: explica, no toma partido.
- Solo hechos cerrados y documentados. Nada de política electoral en curso.
- No glorificar conquistas ni conflictos. No afirmar que Japón controló toda China. No convertir un mapa aproximado en una frontera exacta.
- Citas solo textuales y con fuente. Cifras con fecha y fuente oficial.
- Hashtags obligatorios: YouTube #NodePolitics, TikTok #historia, Facebook #Historia.
- Anclas sugeridas del canal: Japón, el Imperio japonés, la expansión al sur, la guerra del Pacífico.
- Temas sugeridos: Enmienda 19, Plan Marshall, caída de la URSS, Watergate. El diseño imperio encaja mejor con expansión territorial, imperios y doctrinas.
- Ojo: el tema «expansión japonesa» ya existe renderizado en nodeatlas/japon-expansion-prueba. Un tema nuevo debe ser otro caso o otro ángulo.

## 5. Datos que necesito del tema

1. Tema: un hecho cerrado o una decisión concreta, con su consecuencia (por ejemplo, una doctrina, una expansión o una guerra ya terminada).
2. Duración: 10 min por defecto (mínimo 5, serio 15, `lengths.json`).
3. Formatos: 16:9 y 9:16 por defecto.
4. Carpeta: `sandbox/nodepolitics` por defecto. Es la regla de la categoría, que no tiene diseños propios.
5. Tesis o ángulo: si no los tienen, los propongo en el PLAN y los confirman.

## 6. Pipeline (10 pasos del kit, adaptado a imperio)

Todos los comandos se corren desde `nexa-brief-server/`, con `K=src/templates/_tools/explainer-kit/tools/kit.py`.

1. Crear carpeta: `.venv/bin/python $K new imperio <video-id> --title "<provisional>" --minutes 10 --folder sandbox/nodepolitics`.
2. Investigar y planificar en `PLAN.md`. Mínimo 2 fuentes por minuto, con URL en §3. Definir el punto crítico, la tesis, el gancho, los momentos de letra grande, el mapa visual (componentes `imperio.*`) y el inventario de medios. Leer `guides/storytelling.md` completo.
3. Guion: `assets/script.json`. Unos 130 ppm, números en palabras, pico de intensidad en el 60–75 %.
4. Medios: `assets/media/` + `CREDITS.md`. Licencias PD, CC0, CC BY/BY-SA, Pexels, Pixabay, Unsplash o Wikimedia Commons. Respetar las ventanas de imperio.
5. Voz (una sola vez, con el guion final): `$K voice <id>`. Luego `$K transcribe <id>` para `lyrics.json`.
6. Storyboard: `assets/storyboard.json`. Gancho `imperio.introv1` o `introv2`; títulos `imperio.title`/`word`/`native`; mapas `imperio.map`/`expansion`/`campaign`; archivo `imperio.archive`/`footage`; cierre `imperio.outrov2`.
7. Validar: `$K check <id>`. Ventanas de medios: `style_media_policy.py`.
8. Revisar con ojos: hoja PNG de revisión (16:9 y 9:16) y vista previa en vivo.
9. Publicación: `publish.json` (textos y hashtags) + `manifest.json`. Revisar miniatura.
10. Render solo si se pide.

Quién hace qué: el trabajo de implementación se delega a Codex con BRIEF (regla de memoria). Claude planifica y revisa. Voz e imágenes en el servidor. Renders y QA en la máquina local si el servidor está saturado. En el neofetch pegado, el swap del servidor estaba al 89 %.

## 7. Hallazgos a revisar

- Dos diseños se llaman NODEPOLITICS en el registro: `imperio` y `atlas`. Hay que confirmar cuál es el de la tarjeta del showcase (el de imperio, según su design.json).
- `sandbox/nodepolitics/AGENTS.md` dice «status: empty, ningún video todavía» (2026-10-10). Ya no es cierto: hay imperio-demo y japon-expansion-prueba.
- `imperio-demo` toma su material de `nodehistory/turing-enigma/assets/`. Esa carpeta no aparece en `nodehistory/` del servidor. El demo ya tiene la copia, así que no se rompe, pero la referencia de `explainer-kit/AGENTS.md` está desactualizada.
- `imperio-demo` no tiene clips de video. La política pide video visible de 8–16 s, así que solo sirve como demo visual.
- El nombre del canal (NODEPOLITICS, handle `@nodepolitics`) es provisional según `design.json`. Falta que el usuario lo confirme.
- `explainer-kit/AGENTS.md` llama UNO CERO y PROTOTIPO a `binary` y `rough`, pero el registro `designs/index.json` usa NODEHISTORY y PROTOTIPO. Revisar cuál manda.
