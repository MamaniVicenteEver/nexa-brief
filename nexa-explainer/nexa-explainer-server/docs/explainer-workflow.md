# Nexa Explainer: flujo operativo

Nexa Explainer es un flujo separado del generador musical heredado. Su entrada es
un video horizontal de una persona hablando a cámara; la persona permanece en la
mitad izquierda y la mitad derecha se convierte en una superficie editorial.

## Flujo completo

1. POST /api/v1/explainer/projects/upload recibe video_file, template_id,
   language y use_ai.
2. El servidor valida extensión, codec, duración y relación horizontal con
   ffprobe. Guarda un proyecto aislado con un identificador único.
3. ffmpeg extrae first-frame.jpg y normaliza el audio a audio.wav. Si no hay
   micrófono, crea una pista silenciosa para que la revisión visual y el
   contenedor final sigan siendo válidos.
4. El primer frame se analiza de forma determinista con una región segura
   izquierda/derecha. Si hay GEMINI_API_KEY, se intenta mejorar con Vision y
   se conserva fallback si el proveedor no responde.
5. Faster-Whisper se usa cuando EXPLAINER_WHISPER_MODE=local. El modo auto evita
   descargar o ejecutar large-v3 en CPU durante una petición interactiva; crea
   una transcripción provisional y deja un warning para no bloquear la cola.
6. DeepSeek (preferido) o Gemini generan una planificación JSON de escenas.
   Sin credenciales se usa una planificación determinista de revisión.
7. Se construye una preview HTML reproducible con tres plantillas cerradas:
   editorial-split, data-brief y signal-minimal. La tipografía usa
   Space Grotesk e Inter; los iconos son SVG internos, nunca emojis.
8. El proyecto queda en ready_for_review. POST /feedback permite regenerar
   la composición o cambiar plantilla. POST /approve inicia el render.
9. Playwright captura el layout y FFmpeg mezcla la pista original normalizada.
   El resultado queda en rendered/explainer.mp4 a 1920x1080, con duración
   explícitamente limitada para que video y audio terminen juntos.

## Endpoints

- GET /api/v1/explainer/templates
- POST /api/v1/explainer/projects/upload
- GET /api/v1/explainer/projects
- GET /api/v1/explainer/projects/{id}
- GET /api/v1/explainer/projects/{id}/preview/
- POST /api/v1/explainer/projects/{id}/feedback
- POST /api/v1/explainer/projects/{id}/approve
- GET /api/v1/explainer/projects/{id}/file/explainer.mp4

## Configuración recomendada

~~~dotenv
EXPLAINER_WHISPER_MODE=auto
EXPLAINER_RENDER_ENABLED=true
EXPLAINER_MAX_UPLOAD_MB=512
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...
~~~

Para producción con una máquina que ya tiene el modelo descargado:

~~~dotenv
EXPLAINER_WHISPER_MODE=local
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
~~~

La UI se encuentra en /es/explainer y /en/explainer. La configuración de
locale usa prefijo explícito para evitar bucles de redirección en Next 16.
