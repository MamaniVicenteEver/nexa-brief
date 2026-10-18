# Estrategias de copy (títulos, descripciones, tags)

- `active.json`: qué estrategia usa cada plataforma. **Cambiar de estrategia = cambiar el nombre aquí.** Toma efecto en el siguiente video, sin reiniciar.
- `voice.md`: el tono común a todas (humano, sin emojis, sin relleno, temas sensibles).
- `strategies/<id>.json`: una estrategia. Nunca se editan las ya usadas en producción: se copia a `<nombre>_v2` y se cambia la copia, así siempre se puede volver atrás.

## Qué define una estrategia
- `fields`: las piezas que escribe la IA, cada una con `instruction`, límites (`max_chars` o `min_items`/`max_items`) y ejemplos `examples` / `avoid` por idioma. Los ejemplos deben ser de **otras** canciones.
- `rotating`: frases fijas que rotan entre videos (ej. la invitación a suscribirse).
- `output`: plantillas del título y la descripción por idioma, en orden de preferencia. Se usa la primera que tenga todos sus datos y quepa en `max_chars`. Placeholders disponibles: los `fields`, las claves de `rotating`, `{artist}`, `{song}` y `{hashtags}` (se muestra como `#A #B #C`).
- `output.tags.from`: qué lista va como tags de la plataforma.

## Probar sin generar un video
```
uv run python scripts/preview_copy.py --list
uv run python scripts/preview_copy.py \
  --lyrics src/templates/LYRICS-carta-de-amor/assets/lyrics-bruses-dueles-tan-bien.json \
  --track-name "Bruses Dueles Tan Bien Audio" \
  --strategy youtube=yt_theme_question_v1 --strategy youtube=yt_search_exact_v1
```
Si un JSON tiene un error (placeholder desconocido, idioma faltante), el test `tests/unit/test_copy_strategies.py` y el propio cargador lo rechazan con un mensaje claro.
