# Comparación narrada de personajes

La misma narración se escucha dos veces dentro de una sola pista de 31,6 segundos: 0–15,8 s con el rig 2D de pizarra y 15,8–31,6 s con poses ilustradas. La transcripción `assets/lyrics.json` contiene las dos repeticiones y anclas por palabra.

La hoja `assets/hoja-100-poses.png` es una generación de 10 × 10, de 1254 × 1254 px: no es 4K y sus filas no son uniformes. Cada cuadro tiene una descripción visual en `assets/poses-index.json`, pero no un recorte validado. Para el video se usa `assets/poses-detalle-transparente.png`, con cuatro dibujos grandes y sus recortes y momentos de uso en el mismo índice. La hoja tiene fondo transparente y la pizarra es blanca.

El audio reutiliza un fragmento de `pizarra-olvido` y la transcripción se verificó con faster-whisper. No se generó voz nueva. La composición es una prueba de comparación para escritorio, no una biblioteca terminada ni una plantilla lista para producción.
