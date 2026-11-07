# Leo · perfil de comparaciones

`leo.json` es la única fuente de identidad de la línea `leo-comparaciones-v1`.
El motor `../comparacion.js` lo carga directamente; `cara-a-cara/assets/voice-profile.json`
es un enlace al mismo archivo. No copiar ni editar un perfil distinto por cada tema.

- `voice`: Puck, modelo fijado, español latinoamericano y dirección vocal aprobada.
- `postprocess`: ritmo 0.9 conservando el tono. No fija todos los videos a 60 segundos.
- `reference`: audio aprobado y su SHA-256 para comparar la identidad; no se envía como clon de voz.
- `video`, `layout`, `typography`: diseño móvil aprobado, incluidos títulos, tarjetas y subtítulos.
- `avatar`: Leo por defecto; hoja y poses compartidas. La hoja maestra existente se referencia sin duplicarla.

Por video solo cambian el guion, los sujetos, los cortes, la secuencia de poses, los medios,
los subtítulos y la duración. `scene.json` y `script.json` identifican `profile_id`.
`overlays.json` aporta fuentes y tiempos: el motor calcula su posición dentro de la tarjeta.
La API de voz puede introducir pequeñas variaciones entre generaciones; conservar la muestra
para revisión y mantener el mismo perfil, modelo y voz.

## Narración

Desde `nexa-brief-server`, con su entorno Python:

```bash
.venv/bin/python scripts/narrate_leo.py \
  src/templates/sandbox/nodeaction/MI-VIDEO/assets/script.json \
  src/templates/sandbox/nodeaction/MI-VIDEO/assets/song.mp3 --dry-run
```

Quitar `--dry-run` para generar. El comando fija la voz y el modelo, aplica el ritmo del
perfil, conserva el control de narración en `song.profile.json` y limpia WAV, partes y MP3
intermedios incluso al fallar. Rechaza un guion con otra voz. No sobrescribe un audio existente
salvo con `--replace`. `--pad-to 60` agrega silencio final si alcanza; nunca recorta una frase.
No regenerar el audio aprobado para comprobar este comando: `--dry-run` no llama al proveedor.

Después de generar: transcribir **el MP3 final**, revisar omisiones y ritmo, ajustar `scene.end`
a la duración real y verificar las anclas y las dos modalidades de tarjeta en el navegador.
Los subtítulos existentes no se reutilizan después de cambiar una narración.
No se generan frames ni un video final mediante este comando.

## Fotos y videos dentro de las tarjetas

En `assets/overlays.json`, asignar cada recurso a `subject` con el id de un sujeto del video:

```json
{
  "items": [
    {
      "subject": "nasa",
      "kind": "video",
      "src": "assets/media/apollo-launch.mp4",
      "at": "@Pero Estados Unidos",
      "dur": 7.8,
      "start": 0,
      "opacity": 1
    },
    {
      "subject": "urss",
      "kind": "photo",
      "src": "assets/media/gagarin.gif",
      "at": "@Pero Estados Unidos",
      "until": "@Apolo",
      "opacity": 1
    }
  ]
}
```

`subject` sigue al protagonista, incluso si su tarjeta se amplía o cambia de posición.
También se admite `slot: "left"` o `"right"`; sin destino se usa solo la tarjeta única.
Usar `kind: "photo"` o `"video"`, `at` y `dur` en segundos o `until` como segundo/ancla final.
`start` indica desde qué segundo del clip comenzar. Su duración debe cubrir el tramo usado.
Se pueden reproducir clips en ambas tarjetas al mismo tiempo, siempre silenciados: manda la
voz de Leo. Al pausar o saltar, los clips siguen el mismo reloj de la narración.

Los `shots` de la escena eligen `mode: "duo"` o `"single"` con `focus: "left"` o `"right"`.
El motor adapta cada recurso a la tarjeta visible. Si un clip atraviesa el cambio de modo,
continúa desde el instante correspondiente, sin reiniciarse. No calcular posiciones por video.
El reproductor compartido recibe estas ventanas preparadas en memoria; no se guardan frames.
