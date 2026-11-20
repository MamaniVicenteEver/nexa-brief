# Búsqueda y registro de medios

Aplica `CALIDAD.md` §3. Antes de descargar, verifica el perfil efectivo con bash y
`source scripts/profile-env.sh`, la ruta real y `profile.json`. Busca por categoría y
consulta en `GET /api/v1/library/images?q=...` o `/videos?q=...`; revisa también
`$NEXA_PROFILE_DIR/resources/<tipo>/` y las fichas existentes. Reutiliza el ID si
el sujeto, licencia y calidad sirven. No presupongas que ambas bibliotecas coinciden.

Para Commons, desde `nexa-brief-server/`, busca el sujeto y variantes en inglés:

```sh
M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python "$M" search 'memory module RAM' --source commons --type image
```

Abre la página `File:` de cada candidato en Commons y el original a tamaño completo;
verifica sujeto, fecha, autor, licencia específica, condiciones de derivados y derechos
adicionales. Guarda URL de la página, URL de descarga, fecha de consulta y atribución.
La herramienta también busca video con `--type video`; los resultados son candidatos,
no una certificación. Sin material real adecuado busca archivos públicos y después stock.
La prioridad, marcas permitidas y restricciones están en `CALIDAD.md` §3.

Para promos, `promo.py fetch --id ID` busca, descarga y crea fichas por su plan; valida
cada ficha y archivo antes de usarlos. Para un recurso ya descargado, su ficha del perfil
va en `resources/<tipo>/<id>/resource.json`, junto al original, usando los campos y tipos
de `nodemotion/promo/schemas/resource.json`: `id`, `type`, `category`, `name`, `tags`,
`description`, `source`, `source_url`, `download_url`, `author`, `license`, `license_url`,
`attribution`, `hash` SHA-256, dimensiones o duración, `fps`, `orientation`, `query`,
`fetched_at`, `used_by`, `file` y `ready_file`. Los valores desconocidos solo pueden ser
`null` donde el esquema lo admite; no inventes créditos, fechas o derechos. Incluye el
ID del contenido en `used_by`; valida JSON y comprueba archivo, hash y licencia al reusar.
Para una foto animada registra el derivado y `derived_from`, y acredita la transformación.

La biblioteca general admite `POST /api/v1/library/images` o `/videos` con multipart
`file`, `category`, `label`, `description`, `tags` y opcional `template_id`; responde
con `asset_id`. Su `PATCH /api/v1/library/{images|videos}/{asset_id}` admite, entre otros,
`photographer`, `license_note`, descripción y etiquetas. La carga general no garantiza
la ficha completa anterior ni el registro cruzado en `resources/`. `media.py get` baja
al episodio y escribe créditos, pero tampoco garantiza esa ficha única. Si no puedes
verificar la correspondencia entre ID, original y ficha, conserva evidencia y reporta el
bloqueo: no declares cumplido el registro único ni dupliques silenciosamente archivos.
