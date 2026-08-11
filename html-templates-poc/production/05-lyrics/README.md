# 05 — Lyrics / letras dinámicas (caso #5)

Fondo completo (imagen o video con filtro) + LETRAS DE TODA LA CANCIÓN
sincronizadas palabra por palabra, como subtítulos con vida. Es el caso con
sub-estilos: la música manda — según el género se elige el estilo, el fondo y
los colores. Todas tienen intro y final propios, y el outro se dispara por el
final real del audio.

## Los 5 estilos

| Archivo | Género | Mecánica |
| --- | --- | --- |
| `estilo-neon.html` | urbano/reggaetón | letreros de tubo que se encienden, grada de columnas, cámara impredecible |
| `estilo-suave.html` | pop suave | columna vertical calma, blanco + rojo marcador, entradas variadas |
| `estilo-romantico.html` | romántica | se escribe a mano carácter a carácter, serif + caligrafía con latido |
| `estilo-triste.html` | triste | frío azul, lluvia, palabras que caen y se hunden, typewriter |
| `estilo-impacto.html` | corrido/urbano duro | frases que SE ARMAN palabra a palabra a estampa, gigante roja + chicas |

## config.json externo (impacto · neon · romantico)

Los 3 estilos principales viven cada uno en su carpeta con su **config.json**
externo: colección de casos con `"id"` (mismo patrón que `../04-video-motion`).
Cada objeto trae audio, lyricsUrl, bg (fondo + filtro), fonts, colores/paleta,
intro/outro, la mecánica del estilo y seed. El HTML es estático: hace
`fetch("config.json")` y elige por `ACTIVE_ID` (en el HTML) o `"activeId"`
(en el JSON). Los defaults del CSS son idénticos al primer caso — sin config
no cambia nada visual. Cada config.json trae 2 casos: el actual y una
variación de tema del mismo audio.

Ver **`Example.md`**: flujo completo + PROMPT que recibe el título completo
de la música (y descripción opcional) y devuelve estilo elegido + objeto de
caso listo para pegar en `configs[]`.

## Contenido requerido para la muestra

- [x] `song.mp3` — 1 canción de muestra por estilo (impacto/neon/romantico)
- [x] `lyrics.json` — transcripción con timestamps por palabra
      (se genera con `../../lyric-videos/transcribe.py` — ver su README)
- [ ] `bg.jpg` o `bg.mp4` — fondo 16:9 acorde al estilo (bg8.jpg referenciado, falta el archivo)
- [x] CONFIG de cada estilo apuntando a los archivos locales (config.json externo)
- [ ] Quitar el DEBUG HUD (3 bloques marcados en cada HTML) al publicar

## Flujo de armado

música → transcribe.py → lyrics.json · título completo (+ descripción) →
PROMPT de `Example.md` → objeto de caso → pegarlo en `configs[]` del
config.json del estilo elegido → apuntar `activeId`. El HTML no se toca.

## Estado

- [x] 5 estilos refinados copiados (responsive 16:9 y 9:16 ya verificado)
- [x] config.json externo con casos por id en impacto/neon/romantico
- [x] Assets de muestra por estilo (falta solo el fondo bg8.jpg)
- [ ] HUD de debug apagado para publicar (`debug.enabled: false`)
- [ ] config.json externo para estilo-suave y estilo-triste (siguen con CONFIG inline)
