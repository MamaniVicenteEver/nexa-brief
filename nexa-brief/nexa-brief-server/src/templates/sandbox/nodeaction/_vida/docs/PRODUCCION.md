# De un tema a un video con Vida en Escena

Todos los comandos se ejecutan desde `sandbox/nodeaction/_vida/`. Cada video es una carpeta
hermana de `_vida`; usa el mismo motor, personajes y láminas. No se edita el motor ni el HTML.
Se necesita Node ≥24, las dependencias de `_vida`, ffmpeg/ffprobe y, para voz nueva, el entorno
Python de [VOCES.md](VOCES.md#generar). No depende de servicios del frontend: funciona por CLI
en local y en alfred-server, con los mismos archivos y dependencias.

## Seis pasos

### 1. Crear una carpeta

```sh
node tools/new-episode.mjs agua-001 --title "Cómo ahorrar agua en casa" --sets escuela-entrada --cast tomas,nico --aspect-note "Revisar subtítulos en ambas orientaciones"
```

Imprime JSON con las rutas creadas: `../agua-001/index.html`, `info.json`, `assets/config.json`,
`assets/episode.json` y `assets/timing.json`. El HTML es una copia idéntica de la base.
Los defaults son `--sets escuela-entrada --cast tomas,nico`. Las listas usan comas, sin espacios
ni repeticiones. Los personajes y sets deben existir. El id debe ser kebab-case y empezar con letra.
La carpeta no se sobrescribe. `--force` **reemplaza toda la carpeta existente**, incluyendo sus
assets y resultados: usarlo solo para descartar conscientemente ese borrador; no se permite sobre la base.

La plantilla fuente es [episode.skeleton.json](../templates/episode.skeleton.json). Incluye un guion de
ejemplo sin montar, una escena muda de 3 s por set y `camera: {"style":"estable"}`. El timing inicial
está **vacío**, sin audio ni estimaciones. Por eso el esqueleto pasa también el CLI de validación:

```sh
node tools/validate.mjs ../agua-001/assets/episode.json --view both
```

Esto comprueba el montaje inicial, todavía sin diálogo. El comando de producción detectará los
clips pendientes del guion aunque aún no se hayan agregado sus `say`.

### 2. Escribir guion y montaje por datos

Editar `../agua-001/assets/episode.json`. Para 20–30 s, apuntar inicialmente a unas 45–65 palabras
y comprobar la duración estimada. Usar un mensaje concreto, dos personajes y un set ya disponible
cuando sea suficiente. Sustituir los textos de ejemplo y **reemplazar los `wait` por `say`**.
No dejar el guion sin montar al producir el video final.

Plantilla de guion (un id único por línea; voces con el mismo id que los personajes):

```json
"script": [
  {"id":"L01","who":"tomas","emotion":"neutral","text":"En casa podemos ahorrar agua con cambios pequeños todos los días."},
  {"id":"L02","who":"nico","emotion":"neutral","text":"Cerrá la canilla mientras te cepillás y abrila solamente para enjuagarte después."},
  {"id":"L03","who":"tomas","emotion":"neutral","text":"También revisá las pérdidas y juntá agua de lluvia para regar plantas."},
  {"id":"L04","who":"nico","emotion":"neutral","text":"Usá un balde para lavar y elegí duchas cortas. Cada hábito suma."}
]
```

Plantilla de escena para ese guion, con anclas existentes de `escuela-entrada`:

```json
"scenes": [{
  "id":"consejos-para-casa",
  "set":"escuela-entrada",
  "actors": {
    "tomas":{"at":"arrive","view":"3q-right"},
    "nico":{"at":"meet","view":"3q-left"}
  },
  "steps":[
    {"say":"L01","intent":"explain","face":"smile"},
    {"say":"L02","intent":"explain","face":"smile"},
    {"say":"L03","intent":"explain","face":"smile"},
    {"say":"L04","intent":"explain","face":"smile"}
  ]
}]
```

Mantener `cast`, `resources` y la cámara de la plantilla. Planificar poses/objetos iniciales y
dueño único. Usar acciones y anclas del [contrato del episodio](EPISODIO.md) y `catalog.json`.
El generador coloca los cuerpos en coordenadas centrales válidas; revisar mobiliario y anclas de
cada set para la historia elegida. Las acciones no disponibles requieren otro trabajo de motor,
no campos inventados en el episodio.

### 3. Revisar el diseño sin gastar voz

```sh
node tools/produce.mjs agua-001 --dry-run --views portrait,landscape
node tools/produce.mjs agua-001 --provisional-timing --until review
```

El primer comando solo lee archivos e imprime el plan JSON; no ejecuta pasos ni crea informes.
El segundo crea una copia del episodio y un timing **solo en `/tmp`**, marcado `provisional:true`,
estimando 150 palabras/minuto más pausas de borde. Se eliminan al terminar, incluso ante fallos.
No crea WAV ni inventa audio: durante revisión, el campo clip apunta al JSON fuente únicamente
para cumplir la comprobación de existencia del cargador. No se decodifica ni se reproduce.
No escribe en `assets/`. La revisión corre en ambas vistas y guarda:

```text
../agua-001/render/produce.json
../agua-001/render/review-provisional/agua-001-{portrait,landscape}-sheet.jpg
../agua-001/render/review-provisional/agua-001-{portrait,landscape}-metrics.json
```

Corregir hasta `failed: []` en **ambas** vistas y mirar las hojas. El modo provisional solo
admite `--until validate|review` (review por defecto). Rechaza voice/mix/render.
**No sustituye el audio real**, la pronunciación, la prosodia ni las anclas de Whisper.

### 4. Generar solo la voz pendiente y volver a validar

Con guion final y cuota disponible, en la máquina con las claves y dependencias:

```sh
node tools/produce.mjs agua-001 --until voice --resume
```

El orden es validate → review (ambas vistas) → voice. Si faltan clips, los dos primeros pasos
son una revisión provisional en `/tmp`; después de voz se repiten **con timing real**. Si ya está
todo el audio, la revisión usa los archivos reales desde el principio y no llama a TTS.
Los pasos ejecutados, duraciones y hashes quedan en `render/produce.json`.

`produce` invoca `voice.mjs` en staging temporal con solo las líneas pendientes y conserva el
guion original. Integra clips aprobados en `resources.audioBase/audio/lines/` y el timing en
`resources.timing`. Si una tanda falla a mitad, conserva los clips aprobados para continuar.
Acepta también `node tools/produce.mjs ../agua-001/assets/episode.json ...`; una ruta alternativa
usa su propio guion, no otro `assets/episode.json` por accidente. Mantener `resources.dialogue`
con extensión `.mp3`, como en la plantilla.

Una clave ausente, saldo/cuota agotados, dependencias faltantes o QC fallido detienen el flujo con
un mensaje y `status:"blocked"`; no cambian voces, modelos ni inventan audio. Reintentar con
`--resume` cuando la causa se resuelva. Los detalles técnicos de voz están en [VOCES.md](VOCES.md#generar).
Las credenciales se configuran fuera de estos comandos; no se imprimen ni se guardan en el informe.

### 5. Escuchar y mirar

Escuchar **cada voz nueva**: dicción, nombres propios, emoción, silencios y cierres de frase.
Mirar las hojas reales en `render/review/`, además de las métricas: contacto de manos y objetos,
pies, miradas, subtítulos, cortes y encuadres de ambas orientaciones. Ajustar acciones/anclas según
Whisper y repetir:

```sh
node tools/produce.mjs agua-001 --until review --resume
```

El cambio de montaje invalida validate/review, pero una voz que sigue correspondiendo al guion
se reutiliza. Cambiar texto, hablante, emoción/perfil con sidecar, o perder el clip exige voz pendiente.
Si se cambia una capacidad del motor o un recurso compartido, ejecutar sin `--resume` para auditar
de nuevo la imagen: el hash de producción se concentra en episodio, timing, clips y perfiles de voz.

### 6. Mezclar y renderizar

```sh
node tools/produce.mjs agua-001 --resume --views portrait,landscape --nice
```

Portrait es el default si se omite `--views`. Salidas:

```text
../agua-001/assets/dialogue.mp3
../agua-001/assets/dialogue.mix.json
../agua-001/render/agua-001.mp4
../agua-001/render/agua-001.render.json
../agua-001/render/agua-001-16x9.mp4
../agua-001/render/agua-001-16x9.render.json
../agua-001/render/produce.json
```

Antes del render se exige review vigente, con `failed: []` y `passed:true` en ambas vistas,
mezcla con `start_clicks == 0`, LUFS −16 ±0,5 y TP ≤ −1,5 dBTP. Métricas ausentes, nulas o
no finitas también bloquean. Los resultados no aprobados no se reutilizan como aprobados.
`render.mjs` mantiene su comportamiento: vuelve a mezclar internamente con el mismo motor;
la mezcla publicada ya se auditó antes de invocarlo. Los renders corren secuencialmente y un
bloqueo global impide otro render de `produce` simultáneo, incluso de otro episodio.
`--nice` usa `nice -n 10` para el render, sin bajar resolución, fps ni calidad.

## Reanudar y diagnosticar

```sh
node tools/produce.mjs agua-001 --until mix --resume
node tools/produce.mjs agua-001 --from mix --until render --resume
```

`--until` incluye el paso elegido. `--from` requiere resultados anteriores vigentes en el informe;
no permite omitir validación, revisión ni voz. Si faltan, empezar desde validate con `--resume`.
La reanudación compara hash SHA-256 del episodio, timing, bytes de clips, perfiles y ambiente,
y comprueba los hashes de los archivos de salida. Si se pierde o cambia una hoja/mezcla/video,
ese paso se repite. Se conserva caché por vista de render; agregar landscape permite reutilizar
portrait. Una producción fallida conserva lo completado; no hay reintentos automáticos de TTS
fuera de los que ya hace `voice.mjs` con la misma voz/modelo.

El informe guarda `steps` (estado, segundos, hash, resultados), `cache`, `metrics.review` por
vista, `metrics.mix` (LUFS, TP, start_clicks), `missing`, estado y motivo de bloqueo. Conservarlo
junto al video para auditoría. En `--dry-run` se imprime el plan, sin escribir este archivo.

Hay un bloqueo por episodio en `render/.produce.lock/owner.json` y uno global de render en
`/tmp/vida-produce-render.lock/owner.json`. SIGINT/SIGTERM limpia los procesos y temporales;
ante SIGKILL o corte de energía puede quedar el bloqueo. Verificar que su PID ya terminó antes
de retirarlo y reanudar. Un render iniciado directamente con `render.mjs` no participa del bloqueo:
operativamente también debe respetarse un solo render a la vez.

## Producción por lotes y límites

Usar ids `tema-NNN`, una carpeta por video: `agua-001`, `agua-002`, `reciclaje-001`. Escribir y
revisar un JSON por carpeta. Procesar el lote secuencialmente:

```sh
for id in agua-001 agua-002 reciclaje-001; do
  node tools/produce.mjs "$id" --resume --views portrait,landscape --nice || break
done
```

Un fallo detiene el lote para corregirlo; los siguientes no consumen cuota. Los renders y su
informe quedan en `../<id>/render/`. No compartir ids de carpeta ni editar assets mientras se produce.

La biblioteca actual tiene **5 sets** (`aula`, `casa-comedor`, `escuela-entrada`, `heladeria`, `parque`)
y **5 personajes** (`heladero`, `mama`, `nico`, `tomas`, `valeria`). No hay un límite técnico de cinco;
es lo disponible hoy. Las voces de Gemini tienen cuota y requieren saldo y configuración externa.
La automatización no investiga el tema ni escribe miles de guiones por sí misma: cada uno debe
ser coherente, verificarse y montarse con capacidades reales.

Un set nuevo hace falta cuando las láminas existentes no representan el lugar o la acción necesita
anclas/mobiliario distintos. Seguir [SETS.md](SETS.md): una lámina con `image_gen` cuesta aproximadamente
**65 s por imagen**, solo en **alfred-server**; es tiempo de generación, no precio monetario. Después
hay que calibrar suelo, altura, anclas y props, y revisar ambas vistas. Reutilizar esa lámina en
todos los videos posteriores. No regenerarla por episodio.

Un personaje nuevo hace falta cuando el reparto existente no representa el papel requerido: agregar
su ficha de rig y perfil de voz mediante el flujo de la biblioteca, revisar el personaje y escuchar
su voz. Los personajes son articulados por datos; no necesitan una lámina por episodio. Si se
solicita una imagen de referencia, aplica el coste aproximado anterior; la voz consume la cuota
correspondiente de Gemini. Crear sets/personajes o ampliar el motor es un trabajo separado del
scaffold y no lo hace `new-episode`.
