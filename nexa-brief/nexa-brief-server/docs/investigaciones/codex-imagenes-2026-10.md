# Imágenes con Codex CLI y la suscripción local (25-10-2026)

## Evidencia en esta máquina

- `~/.local/bin/codex --version`: `codex-cli 0.164.0`.
- `codex login status`: `Logged in using ChatGPT`. La configuración visible en `~/.codex/config.toml` no define modelo ni clave; no se leyó ningún archivo de credenciales.
- `codex --help`: no hay subcomando `images`. `codex exec --help`: `-i/--image` adjunta archivos al prompt, `--json` emite eventos JSONL y `-o` guarda el último mensaje. Ninguna opción entrega un PNG directamente.
- `codex features list`: `image_generation stable true`; esto por sí solo no garantiza que la herramienta esté disponible para una sesión.
- Una sesión real (`codex exec --json --ephemeral ... -m gpt-6-luna`, autenticada por ChatGPT y sin `OPENAI_API_KEY`, `CODEX_API_KEY` ni `OPENAI_BASE_URL`) enumeró `image_gen__imagegen` y `view_image`. Uso observado: 13 452 tokens de entrada (11 520 cacheados), 376 de salida.
- Otra sesión invocó la herramienta nativa y produjo un PNG RGB de 1254 × 1254 y 1 641 768 bytes en `$CODEX_HOME/generated_images/<thread_id>/exec-....png`. `turn.completed` informó 44 570 tokens de entrada (38 656 cacheados) y 534 de salida. El JSONL **no** incluyó un evento con bytes de imagen; el agente comunicó la ruta en su mensaje final. La imagen debe recogerse del directorio `generated_images` asociado al `thread_id`, y validarse con PIL.
- El skill local `$imagegen` favorece la herramienta incorporada y documenta que los archivos aparecen en `$CODEX_HOME/generated_images`. Los slash commands documentados controlan la sesión (`/model`, `/status`, etc.); no hay un comando de generación que entregue archivos por sí mismo.

La primera prueba de sesión falló porque este entorno restringido no deja escribir en `~/.codex`. Se repitió con un `CODEX_HOME` temporal y un enlace al archivo de autenticación local, sin imprimir ni copiar su contenido. El comando del agente para leer su skill falló por el socket del sandbox anidado; la generación nativa sí terminó. Este detalle del entorno puede afectar operaciones que dependan de ejecutar código *dentro* de la sesión; no invalida la herramienta de imagen.

## Herramientas locales

| Operación | Disponible | Evidencia / límite |
| --- | --- | --- |
| Imagen nativa nueva o edición | Sí, `image_gen__imagegen` | Herramienta de sesión; archivo en `generated_images`. Para edición de archivo local, `view_image` primero. |
| Recortar, componer texto, recolorear, alpha | Sí, Pillow (`PIL`) y OpenCV (`cv2`) en `nexa-brief-server/.venv` | Determinista; composición y color por código, sin inferencia de imagen. |
| Quitar fondo | Sí, `rembg` + `numpy` + `PIL` en `.venv` | Depende de modelo ONNX local y puede fallar en bordes finos. |
| Video, extracción de fotogramas, filtros | Sí, `ffmpeg 8.0.1` | Herramienta de código/terminal. |
| Vectorizar | Parcial, `cv2`/`skimage` permiten contornos y trazado SVG por código | No está instalado `potrace`, `vtracer` ni Inkscape; la vectorización compleja no es nativa. |
| ImageMagick | No encontrado (`magick`/`convert`) | Se usa Pillow/OpenCV. |

## Conclusión y coste

Codex CLI **sí genera imágenes nativamente mediante una herramienta de la sesión**, aunque su interfaz `exec` solo acepta imágenes como entrada y devuelve eventos/mensajes, no un PNG en stdout. Codex también puede planear transformaciones y escribir código; Pillow, OpenCV, rembg y ffmpeg ejecutan esas transformaciones localmente. El modelo del preset (`gpt-6-luna`, `gpt-6-sol`) dirige al agente; el modelo de imagen interno de la herramienta no se expone en el JSONL y no debe atribuirse falsamente a esos presets.

La autenticación observada fue la suscripción de ChatGPT. No hay precio por imagen ni cargo por token verificable desde `codex exec`; sí hay consumo y límites de uso del plan, no cuantificados aquí. En las nueve pruebas nativas, el tiempo fue de **49,53 a 90,48 s por imagen**, con media **67,19 s**. En total informaron **1.057.545 tokens de entrada** (896.256 cacheados) y **19.348 de salida**. El recorte local con rembg u2netp tardó **3,87 s** después de descargar su modelo de 4,57 MB. Los tokens de `turn.completed` cuentan el trabajo del agente y no desglosan el coste interno de la herramienta de imagen. Detalle por tarea en [RESULT-imggen-codex.md](/home/alfred/codex/nexa-brief/RESULT-imggen-codex.md).

## Fuentes oficiales

- [Referencia de comandos de Codex](https://learn.chatgpt.com/docs/developer-commands?surface=cli): `codex exec`, `--image`, `--json` y slash commands.
- [Autenticación de Codex](https://learn.chatgpt.com/docs/auth): acceso con ChatGPT.
- [OpenAI CLI frente a Codex CLI](https://developers.openai.com/api/reference/cli): distingue el CLI de API (`openai images`, que usa clave) del agente Codex.
- [Generación de imágenes en OpenAI](https://developers.openai.com/api/docs/guides/image-generation): contexto de la capacidad de imagen; sus parámetros de API no son parámetros de `codex exec`.
