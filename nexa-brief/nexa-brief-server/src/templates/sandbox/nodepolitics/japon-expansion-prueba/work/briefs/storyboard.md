## Objetivo
Crear `assets/storyboard.json` para una vista previa Desktop de la expansión japonesa. Anclar cada entrada al tiempo real de la palabra topónima o fecha en `assets/lyrics.json`; no inventar tiempos sintéticos. Reutilizar componentes existentes del diseño `imperio` y mantener legible el mapa.

## Contexto mínimo a leer
- `PLAN.md`: alcance, fuentes históricas y dirección visual.
- `assets/config.json`: id, audio y diseño.
- `assets/lyrics.json`: transcripción Whisper por palabra con tiempos reales.
- `assets/script.json`: relato.
- `../imperio-demo/assets/storyboard.json`: referencia de parámetros y estilo de los primeros treinta segundos.
- `../../../../_tools/explainer-kit/catalog.json` (si hace falta): firma de componentes.

## Archivos que puede tocar
- Solo `assets/storyboard.json` y `work/results/storyboard.md` dentro de esta plantilla.

## Entregable exacto
- Storyboard corto con atlas centrado primero en Japón y luego en el Sudeste Asiático, título condensado, flechas que se revelan con la narración, etiquetas de fechas/regiones y un rótulo de bandera `🇯🇵` cerca del origen para comprobar el glifo en navegador.
- Representar destinos como puntos aproximados con `conquer: false`; no rayar ni rellenar toda China. Si el componente no permite una bandera legible, anotar la limitación.
- Usar anclas exactas encontradas en `lyrics.json`; probar secuencia temporal por inspección de timestamps.
- No renderizar ni grabar video y no tocar `index.html`, `info.json`, voz, herramientas o componentes.
- Resumen final en `work/results/storyboard.md` con rutas, anclas escogidas y cualquier duda.

## Cómo verificar
- Revisar que el JSON parsea y cada ancla existe como palabra/frase en `assets/lyrics.json`.
- Confirmar que todos los targets de `imperio.expansion` son puntos geográficos con `conquer: false`.

## Prohibido
No escribas fuera de la carpeta de esta plantilla, salvo temporales/cache permitidos por el lanzador. No generes ni publiques video.
