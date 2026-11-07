# Generar voz nueva y sincronía — tarea mecánica acotada
## Objetivo
Generar narración NUEVA para Cara a Cara y transcripción por palabras. Voz Puck, español latinoamericano amistoso, distinta de Charon/Node. NO crear video ni renderizar MP4. No investigar el repositorio.
## Leer solo
assets/script.json y assets/voice-profile.json; para ejecutar reutiliza narrate.py y transcribe.py del kit, sin modificarlos. Usa las credenciales existentes mediante el adaptador; nunca leer/imprimir .env ni claves.
## Ejecutar
Desde nexa-brief-server (ruta absoluta /home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server):
.venv/bin/python src/templates/_tools/explainer-kit/tools/narrate.py src/templates/sandbox/nodeaction/cara-a-cara/assets/script.json src/templates/sandbox/nodeaction/cara-a-cara/work/narration --design src/templates/sandbox/nodeaction/cara-a-cara/assets/voice-profile.json --voice Puck --lead 0.35 --tail 0.6
Tras éxito, copiar work/narration.mp3 a assets/song.mp3 y ejecutar UNA transcripción:
.venv/bin/python src/templates/_tools/explainer-kit/tools/transcribe.py src/templates/sandbox/nodeaction/cara-a-cara/assets/song.mp3 src/templates/sandbox/nodeaction/cara-a-cara/assets/script.json src/templates/sandbox/nodeaction/cara-a-cara/assets/lyrics.json
## Entrega
work/results/voz.md: duración real (ffprobe), voz/modelo usado, qc, nº palabras con tiempos, problemas. Mantén assets/script.json sin cambios. Escribe solo assets/song.mp3, assets/lyrics.json, work/narration*, usage.jsonl y tu resultado. No edites info.json (el lanzador registrará uso).
## Límites
Si la cuota falla prueba SOLO el fallback ya configurado por la herramienta; no ensayes voces ni modelos adicionales. No cambies herramientas ni reinicies servicios. Si falla, deja explicación concreta en resultado. Guarda logs acotados dentro work/logs; nunca credenciales. No reintentes un comando que sigue ejecutándose. Espera procesos largos (Whisper CPU tarda minutos).
