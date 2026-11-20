# Imágenes con Codex CLI

Usa la sesión local de ChatGPT mediante `codex exec`; elimina `OPENAI_API_KEY`, `CODEX_API_KEY` y `OPENAI_BASE_URL` del subproceso. Requiere `codex login status` = `Logged in using ChatGPT`. La salida nativa se recoge de `$CODEX_HOME/generated_images/<thread_id>` y se ajusta al tamaño pedido con Pillow. `remove-bg` usa rembg local, sin tokens.

Desde `nexa-brief-server`:

```bash
.venv/bin/python -m src.adapters.image_gen.cli generate --task portada --model luna-xhigh --size 1920x1080 --prompt 'Portada editorial sobre IA' --out /tmp/portada.png
.venv/bin/python -m src.adapters.image_gen.cli edit --task recolor --model sol-high --image /tmp/portada.png --prompt 'Cambiar el acento a coral' --out /tmp/recolor.png
.venv/bin/python -m src.adapters.image_gen.cli remove-bg --task recorte --image /ruta/foto.jpg --out /tmp/recorte.png
```

Presets: `luna-xhigh`, `sol-high`, `sol-xhigh`. Son modelos de **agente**, no el modelo interno de la herramienta de imagen. Cada generación escribe `usage.jsonl` con el formato del kit; los tokens no desglosan la herramienta interna. `--timeout` controla el máximo del proceso. `--ref` se puede repetir hasta cinco veces.
