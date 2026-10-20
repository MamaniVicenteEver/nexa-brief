# EL REY SIN REFUGIO

Video documental de NodeHistory sobre la partida final de Deep Blue contra Garry Kasparov, Nueva York, 11 de mayo de 1997.

## Archivo final

- `deep-blue-sacrificio-1997-16x9.mp4` — 1920×1080, 30 fps, H.264/AAC mono, 330.489 s (5:30), 387,402,378 bytes.
- Render completo en el servidor: 526 s (8 min 46 s). No se publicó ni se encoló para publicación.
- El archivo local coincide con el del servidor por SHA-256 y pasó una decodificación completa sin errores.
- La narración se conservó sin cambios; el MP3 local y el del servidor tienen el mismo SHA-256.

## Componentes añadidos en esta revisión

- `binary.chessboard` muestra posiciones FEN y anima jugadas UCI.
- `binary.chesspiece` dibuja piezas vectoriales grandes; el caballo reemplaza la foto genérica de esa escena.
- `binary.searchtree` muestra ramas y una ruta destacada como esquema conceptual.
- El storyboard ya no usa `binary.bubble` ni `binary.rays` en modo `x`. Las escenas de tablero siguen el PGN de la partida.
- Código fuente compartido en `src/templates/_tools/explainer-kit/designs/binary/components/extra.js`; el catálogo del kit incluye los tres componentes.

## Flujo realizado

1. Revisé la estructura y las instrucciones del explainer-kit, NodeHistory, el preset `binary` y el flujo de render.
2. Elegí NodeHistory + binary y el enfoque **“El caballo que Deep Blue sacrificó”**. Investigué la historia del match, la máquina y la partida con fuentes de IBM, IBM Research, Computer History Museum, análisis contemporáneo y el PGN de la partida.
3. Escribí `PLAN.md` con hechos y fuentes, tesis, arco narrativo, riesgos y mapa visual. El guion final tiene 697 palabras en 18 segmentos.
4. Seleccioné cinco imágenes de Wikimedia/Met Museum y documenté sus licencias en `assets/media/CREDITS.md`. No compré material de stock.
5. Generé la narración con Gemini 3.8 Flash TTS, voz Charon; ajusté velocidad y niveles, y conservé voz sola. El audio final dura 5:30.
6. Transcribí la voz con tiempos de palabra y armé 73 planos sincronizados en `assets/storyboard.json`.
7. Validé el storyboard: 73 planos, 330.5 s, 685 palabras reconocidas y cero errores. Generé y revisé hojas de captura 16:9 y 9:16, además de diez fotogramas del MP4 final.
8. Actualicé el manifiesto y rendericé el video completo 16:9 directamente con `kit.py render` en el servidor. Verifiqué el MP4, sus pistas, duración y decodificación; copié el paquete a esta carpeta.

Dos intentos de generación automatizada no arrancaron hasta el final: Codex no tenía el lector de archivos esperado y Claude tenía OAuth vencido. Continué a mano con el proceso oficial del kit y terminé el video.

## Tiempo y uso de modelos

- Tiempo total observado desde la primera llamada automatizada de producción (14:53:59 UTC) hasta la copia verificada (15:46:41 UTC): **52 min 42 s**.
- Esta revisión visual reutilizó el audio; el render completo tomó **8 min 46 s**. No se generó voz nueva.
- En el render, la CPU del servidor llegó a 100% ocupada durante la codificación final, con carga media máxima observada de 6.75; al terminar volvió a 95.6% ociosa. No hubo espera de disco.
- Tokens de Codex que aparecen en los registros del backend: **aprox. 107,476** (60,435 + 11,873 + 35,168). Incluye el intento fallido de producción; no incluye el uso de esta conversación, que el backend no registra.
- TTS: 313.6 s de voz generada, unas **7,840 fichas de audio** a 25 fichas/s. La tarifa estándar publicada para Gemini 3.8 Flash TTS es US$9 por millón de fichas de audio hasta el 31-12-2026: estimación aproximada **US$0.07** por la salida de audio, más una cantidad pequeña por texto. Puede ser US$0 con la capa gratuita; el cargo real de la cuenta no es visible desde el proyecto.
- No hay costo de publicación ni licencia de stock. El render usó el servidor existente; no quedó registrado un cargo monetario separado.

## Materiales

- `PLAN.md` — investigación y dirección.
- `assets/script.json` — guion.
- `assets/storyboard.json` — planos, tiempos y componentes.
- `assets/lyrics.json` — transcripción sincronizada.
- `assets/song.mp3` — narración final.
- `assets/media/` — imágenes y créditos.
- `publish.json` — textos y fuentes preparados; nada fue publicado.
- `manifest.json`, `poster.jpg`, `sheet-16x9.png`, `sheet-9x16.png`, `review-keyframes.png` — estado y revisión visual.

## Fuentes principales

- IBM, [Deep Blue](https://www.ibm.com/history/deep-blue).
- IBM Research, [Deep Blue](https://research.ibm.com/publications/deep-blue) y [Deep Blue chess chips](https://research.ibm.com/publications/ibms-deep-blue-chess-grandmaster-chips).
- [Computer History Museum: Defeating the World Chess Champion](https://www.computerhistory.org/chess/defeating-the-world-chess-champion/).
- [The Washington Post, análisis contemporáneo de la partida final](https://www.washingtonpost.com/archive/politics/1997/05/12/blue-victory-thanks-to-the-memory/6830b30d-cfb9-4af9-8280-286596fc9d54/).
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing).
