# Vida en Escena — historias cotidianas con personajes de tinta

Referencias: 5 MP4 de Klickpin (los nombres de archivo no describen el contenido) e `image.png`
(ficha de personaje). Análisis con marcas de tiempo en `NOTAS.md`.

Objetivo: línea nueva del Sandbox (`nodeaction/vida-en-escena`) con motor propio y compartido
(`nodeaction/_vida/`) para producir miles de historias de 2–5 min, 9:16 1080×1920 30 fps, a partir
de datos (episode.json) y componentes aprobados. Personajes articulados que caminan, hablan,
escuchan, reaccionan, se sientan y manipulan objetos dentro de escenarios.

Muestra: episodio de ~2 min (escuela → amigo → parque → pareja → casa, cena) + variante breve
hecha solo con datos. Voces con los adaptadores existentes (Gemini TTS vía explainer-kit),
transcripción real (Whisper) y boca por visemas + energía del audio.

Restricciones: no tocar Cara a Cara ni el perfil de Leo; no reiniciar servicios; no publicar;
herramientas nuevas en Node (`.mjs`) porque uvicorn recarga con cualquier `.py` bajo `src/`.
