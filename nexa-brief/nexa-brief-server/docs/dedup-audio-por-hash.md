# Dedup de audio por hash de contenido — FASE DE PRUEBAS (opcional)

## Estado

Implementado 2026-08-17. **Opcional / experimental.** Pendiente de decisión: cuando
el proyecto pase a producción, evaluar si se mantiene, se ajusta o se quita.

## Problema que resuelve

`register_music()` genera un `asset_id` random (`uuid.uuid4().hex[:8]`) sin mirar el
contenido del archivo. Si la misma canción se sube o descarga más de una vez con un
nombre de archivo distinto (caso frecuente: cada descarga trae un nombre distinto,
p. ej. `"4:12 Reproduciendo Dalex - Hola Remix..."` vs `"remix hola"`), el dedup
existente por nombre (`find_music_by_name`) no la detecta. Resultado: se duplica el
archivo en `data/music_library/` y se vuelve a pagar la transcripción de letras con
faster-whisper (varios minutos por canción), aunque ya exista una transcripción
cacheada para ese mismo audio.

## Qué se agregó

- `asset_library.hash_file(path)` — sha256 en streaming del contenido de un archivo.
- `MusicLibraryEntry.content_hash` — campo nuevo (default `""`, entradas viejas del
  índice quedan con hash vacío y simplemente nunca matchean por hash, sin romper nada).
- `asset_library.find_music_by_hash(content_hash)` — busca una entrada archivada con
  bytes idénticos.
- `register_music(...)` ahora acepta `content_hash` opcional (si no se pasa, lo
  calcula solo).
- Los tres flujos que registran música (`videos.py` upload, `resource_fetcher.py`
  URL, `resource_fetcher.py` auto) chequean `find_music_by_hash` antes de registrar
  un asset nuevo, y reusan la entrada existente (incluyendo su `_lyrics_cache/`) si
  hay match.

`find_music_by_name` sigue existiendo sin cambios — el hash es un chequeo adicional,
no un reemplazo.

## Costo

Cada registro de música ahora lee el archivo completo una vez (o dos, en el flujo de
upload: una vez para el hash-check, otra dentro de `register_music` si hay que
registrar — se evita el doble cómputo pasando `content_hash` ya calculado). Para
archivos de audio (unos pocos MB) esto es del orden de milisegundos, insignificante
frente a los minutos que tarda una transcripción.

## Qué decidir en producción

- ¿Se mantiene el dedup por hash, o alcanza con el dedup por nombre normalizado?
- Si un mismo audio se re-codifica (mismo contenido audible, bytes distintos), el
  hash no lo detecta — ¿vale la pena un fingerprint de audio (más caro) para ese caso,
  o no compensa?
- Si se descarta este mecanismo, revertir: quitar `content_hash` de
  `MusicLibraryEntry`, `hash_file`, `find_music_by_hash`, y los tres chequeos en
  `videos.py` / `resource_fetcher.py` (buscar el comentario "FASE DE PRUEBAS").
