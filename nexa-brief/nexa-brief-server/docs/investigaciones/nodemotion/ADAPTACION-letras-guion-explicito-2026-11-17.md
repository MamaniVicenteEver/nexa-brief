# Adaptación a la canción: plantillas de letras con guion explícito

Fecha: 2026-11-17. Aplica a `lyrics-hologram-worlds` (Holograma Mundos) y `lyrics-grunge-montage` (Grunge Montaje).
Código: `src/core/nodemotion/lyrics/song_adapter.py`. Pruebas: `tests/test_song_adapter.py`.

## Qué resuelve

Estas dos plantillas nacieron como réplicas de un video: su guion (`assets/config.json` → `timeline`) tiene las palabras y
los tiempos de la referencia. Con una canción nueva, el guion se veía tal cual (Grunge) o solo cambiaba el texto sobre el
ritmo estirado de la referencia (Mundos). Ahora una canción nueva recibe una línea de tiempo generada desde su
transcripción: una escena por frase, cada palabra en su tiempo real, con el diseño de la plantilla.

- **Demo:** no cambia. El borrador «Video original» trae `timed_content` y conserva el guion original.
- **Otras plantillas:** no se tocan. El adaptador solo actúa si la carpeta de la plantilla tiene `adaptacion.json`.
- **Motores:** no se modifican (ni su runtime ni su revisión). El adaptador genera el `timeline` explícito que ya dibujan.

## Archivos (en la carpeta de cada plantilla)

| Archivo | Para qué |
|---|---|
| `adaptacion.json` | Reglas: esquema del guion (`els` o `pieces`), umbrales de calidad, frases, tiempos, entrada de texto, `config` a forzar, `respaldo`. |
| `contenido-static.json` | Recetas de escena sin ninguna palabra de la referencia: geometría, decoración y entradas del guion, con el texto como ranura. Incluye intro y outro. |

`contenido-static.json` se genera del guion de la demo:

```bash
.venv/bin/python src/core/nodemotion/lyrics/song_adapter.py extraer src/templates/nodemotion/lyrics/<id>
```

Hay que regenerarlo si cambia el guion de la demo (la prueba `test_real_templates_have_rules_and_clean_static_content` lo verifica).

## Qué se puede ajustar en `adaptacion.json`

- `umbrales`: `coberturaMin` / `coberturaRehacer`, `idiomaMin` / `idiomaRehacer`, `huecoMaxSec`, `logprobMin` (confianza mínima por segmento; la config de la plantilla solo aporta las expresiones `drop`).
- `frases`: `maxWords`, `maxSec`, `minWords`, `fusionMaxWords`.
- `tiempos`: `leadSec` (anticipo de la escena), `holdSec` (cuánto se sostiene tras la última palabra), `huecoMinSec`, `huecoTrozoSec`, `introMinSec`, `escenaMinSec`, `outroSec`.
- `recetas`: `enfriamiento` (no repetir receta), `fraccionTop`, `mundoBloqueSec` (cuánto dura un «mundo» de color antes de cambiar).
- `entrada`: `porPalabraDesde` (un texto con al menos tantas palabras se revela palabra por palabra), `rotuloMaxPalabras`.
- `config`: valores que se fuerzan en el config del proyecto (p. ej. Grunge: `timeOffsetSec: 0`).
- `respaldo.config`: lo que se aplica si no hay recetas (ver abajo).

## Cómo decide cada escena

1. Se descartan segmentos de baja confianza o que coinciden con `drop` (alucinaciones de Whisper).
2. Se arman frases con las reglas del motor base (`lyricPhrases`); las demasiado breves se fusionan con la siguiente.
3. Cada frase ocupa una escena desde su primera palabra (menos `leadSec`) hasta `holdSec` después de la última o hasta la siguiente frase.
4. Se elige una receta cuya capacidad de palabras acepte la frase (semilla fija: el mismo audio da el mismo video), evitando repetir la reciente y manteniendo el «mundo» de color por bloques.
5. Las ranuras se llenan con las palabras; los tiempos de entrada de cada texto (`at`, `wt`, `until`, `out`, `kf`) se reubican en el tiempo real de sus palabras.
6. Los huecos sin letra se rellenan con escenas decorativas. El outro se acorta (mínimo 1 s) o se omite antes de cortar la letra.

## Calidad de la transcripción

El reporte de cada generación (`logs/05_reporte_cancion.json` del borrador) trae `estado`, `cobertura`, `idioma`, `huecos` y `avisos`:

- `ok`: se genera sin avisos relevantes.
- `revisar`: cobertura baja, idioma dudoso o segmentos excluidos. Se genera igual.
- `rehacer`: cobertura menor del 30 % o idioma poco fiable. Se genera igual; conviene volver a transcribir indicando el idioma.
- `instrumental`: no hay letra; solo intro, decoración y outro.
- `error`: falló el adaptador; se muestra solo la transcripción (nunca queda el guion de la referencia con una canción ajena).

El adaptador nunca bloquea la generación. Lo que no puede arreglar es una mala transcripción.

## Con los JSON vacíos o ausentes

Si `contenido-static.json` no tiene recetas, se quita el `timeline` y el motor muestra solo la transcripción con su mazo
de respaldo (`respaldo.config.layouts`, los del diseño base). Si `adaptacion.json` no existe, la plantilla no se adapta.

## Límites conocidos

- Los proyectos ya generados conservan su config hasta regenerarse.
- La grabación real exige que la plantilla esté en `HF_VALIDATED_LYRICS_TEMPLATE_IDS` (`hyperframes_adapter.py`); estas dos aún no lo están y requieren revisión de un render.
- Grunge: la intro solo existe si el config trae `intro.title` (toma su texto de `config.intro`).
- Tipografías: la plantilla debe cubrir el alfabeto de la canción (el reporte avisa si hay hangul, kana o CJK).
