# Brief de trabajo · verificar que la cámara no se mueve

## Objetivo

La plantilla `japon-expansion-prueba` (video de 120,1 s en estilo `imperio`) tenía movimientos de cámara que el usuario
no quería (alejamientos de zoom, giros, vuelos entre destinos, empuje lento sobre el video de archivo). Se acaban de
quitar: la apertura y el plano de archivo tienen cámara fija y el mapa de campaña usa un único encuadre (`cut: true`).
Tu trabajo es **comprobar con medidas, no a ojo**, si queda algún movimiento global del mapa en algún segundo, y
encontrar su causa en el código si lo hay.

## Contexto mínimo a leer

- `assets/storyboard.json` (5 beats) y `assets/components/japon.js` (componentes `imperio.campaign`, `imperio.footage`).
- `../../../_tools/explainer-kit/tools/shoot.py`: cómo abre la página en Chromium headless y busca un instante con
  `window.__promo.seek(t)`. Reutiliza ese mecanismo en tu propio script (Playwright del `.venv` del backend:
  `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python`).
- `../../../_tools/explainer-kit/designs/imperio/components/_imperio.js` solo si necesitas entender la cámara (`IM.camOf`, `IM.mixCam`).

## Qué hacer

1. Escribe `work/camera-check/medir.py`: captura el `index.html` de esta plantilla en 16:9 (1280×720 basta) cada 0,5 s
   entre 0 y 119 s, guardando PNG en `/tmp/camera-check/`.
2. Para cada par de cuadros consecutivos estima el **desplazamiento y el cambio de escala global** del mapa (correlación de
   fase con numpy sobre escala de grises reducida, o lo que prefieras). El texto, las flechas, las banderas, el sol y el
   video de archivo también cambian: elige un método o una región que reaccione al mapa de fondo (costas y relieve) y no a
   esos elementos, y explica cuál usaste. Marca los cortes de escena (cambio brusco total) aparte: un corte no es un movimiento.
3. Repite lo mismo en 9:16 (720×1280) cada 2 s como control rápido.
4. Informa: tabla de intervalos con movimiento global del mapa mayor que el ruido (define y justifica el umbral),
   los cortes detectados, y si hay movimiento, **qué segundos** y **qué línea/parámetro** del código o del storyboard lo causa.
   No modifiques `japon.js` ni `storyboard.json`: solo reporta.

## Archivos que puede tocar

- `work/camera-check/*` y `work/results/verificar-camara.md` de esta plantilla. Temporales en `/tmp`.

## Entregable exacto

- `work/results/verificar-camara.md` con: método, umbral, tabla de intervalos con movimiento (o «ninguno»), cortes
  detectados, causa probable de cada movimiento, y 3 frases de conclusión.

## Cómo verificar

- `ls work/camera-check` muestra tu script y los datos (CSV/JSON) con el desplazamiento por par de cuadros.
- El informe cita números (px de desplazamiento y % de escala) por intervalo.

## Prohibido

- No escribas fuera de `sandbox/nodepolitics/japon-expansion-prueba/`, excepto temporales en `/tmp`.
- No edites `delegate.sh` ni otros lanzadores. No cambies herramientas compartidas ni plantillas publicadas.
- No reinicies la API ni la web. No generes video.
