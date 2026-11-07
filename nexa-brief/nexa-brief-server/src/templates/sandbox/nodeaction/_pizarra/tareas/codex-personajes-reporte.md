# Entrega · personajes intercambiables

- Añadidos `profe`, `nina`, `abuelo`, `nino` y `obrera` en `characters/`, con el trazo de doble línea del rig. El abuelo acepta `look.cane: true`; la coleta de Nina usa `o.t`; el niño declara `scale.height: 0.72` y `scale.head: 1.25`.
- `personajes-test.html`, `personajes-test/scene.json` y `config.json` presentan los seis personajes en fila a través de 11 planos, uno por pose. El config no declara audio. Las expresiones incluidas cubren `smile`, `grin`, `worried`, `shock`, `think` y `talk`.
- `personajes-sheet.png` es una hoja de 6 × 11 generada con el JSON de prueba y las funciones reales de rig/personajes mediante un renderizador SVG local. La revisé y corregí el bastón del abuelo para que nazca en la mano y no quede suspendido al apuntar; se oculta al levantar esa mano sobre la cabeza.
- `node --check` pasó para los cinco archivos JS. La comprobación JSON confirmó 11 poses, seis personajes por plano, las seis expresiones y ausencia de audio.

## Límite de verificación

No pude ejecutar la captura solicitada con Playwright y `window.__promo.seek(t)`: el Chromium de `.venv` se cierra al iniciar por `SandboxHostLinux` (`Operation not permitted`), y el sandbox también deniega abrir un puerto local para servir los archivos. La herramienta Playwright alternativa requiere aprobación, que no está habilitada en este entorno. Por eso el PNG es el render SVG local descrito arriba, no una captura de navegador; el HTML y los JSON quedan listos para repetir esa captura en un entorno con navegador disponible.

## Límite del contrato

El contrato no ofrece una transformación del torso independiente de la pose, así que el abuelo se encorva mediante la silueta dibujada de la chaqueta y una inclinación pequeña de cabeza. Propongo añadir a futuro un `torsoLean` o una transformación local de torso que también mueva hombros y ropa; no cambié el contrato.
