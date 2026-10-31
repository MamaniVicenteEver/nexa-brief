# Guía · storyboard (qué se dibuja en cada frase)

Resultado: `assets/storyboard.json` validado con `kit.py check <id>` y revisado con `kit.py sheet <id>`.
Catálogo de componentes: `CATALOG.md` (generado del código) y la galería `showcase/index.html`.
Prompt listo para un modelo: `prompts/director.md`.

## 1. Formato

```json
{ "version": 1, "family": "binary", "defaults": { "offset": -0.12 },
  "beats": [
    { "t": 0, "use": "binary.title", "params": { "text": "LA NOCHE\nQUE CAYÓ\nEL MURO", "kicker": "BERLÍN · 1989" }, "until": "Schabowski" },
    { "at": "Günter Schabowski", "use": "binary.portrait", "params": { "src": "assets/media/schabowski.jpg", "caption": "Günter Schabowski" } },
    { "at": "ab sofort", "use": "common.flash", "dur": 0.4, "layer": "overlay" },
    { "at": "de inmediato", "use": "common.lyric", "params": { "accent": ["inmediato"] }, "until": "En minutos" }
  ] }
```

- `at`: 2–4 palabras **tal cual** de `lyrics.json` (números en cifras). Empieza cuando la voz dice la primera.
  Tienen que ser **únicas en lo que sigue** (`check` avisa las ambiguas).
- Duración: hasta el próximo beat de la misma capa, o `dur` (s), o `until` ("ancla").
- Parámetros de tiempo internos con `"@palabra"`: el evento ocurre cuando la voz la dice
  (`"pickAt": "@Go"`, `"dropAt": "@soltar"`, `"dur": "@treinta"`).
- `layer: "overlay"` solo para `common.flash`, `common.tag`, `rough.annotate`.
- **Los beats se listan en ORDEN DE TIEMPO, incluidos los overlays** (las anclas se buscan desde la
  anterior: un flash listado antes de su lugar rompe la búsqueda de los siguientes). Dos beats con el
  mismo instante (letra grande + flash) van uno detrás del otro.
- Si un plano queda en < 1,5 s o > 9 s, no se "estira": se ancla antes (p. ej. un muro que se rompe
  empieza en "A las once…" y se rompe en `"breakAt": "@barrera"`) o se parte en dos.
- **No agregar el cierre**: el motor pone `<familia>.outro` solo (config.outro).

## 2. Reglas de dirección

1. **Gancho**: beat 0 = título gigante en `t: 0` (con `textPortrait` de 3–4 renglones para 9:16),
   hasta que la narración presenta el conflicto (4–7 s).
2. **Ritmo**: un plano nuevo cada **2,5–6 s**; clímax 2–3 s; duelo 5–8 s. Nunca > 9 s quieto ni < 1,5 s
   (salvo flash o un golpe de una palabra).
3. **Sincronía**: anclar al sustantivo/cifra clave ("la Bomba", "159", "Schabowski"), no al
   principio de la oración.
4. **Intensidad → componentes**:
   - ≥ 0.85: `common.lyric` con la frase clave (+ `common.flash` overlay 0.4 s al entrar), componentes
     de acción (convoy, descent, choice, tally, counter);
   - 0.5–0.85: objetos y diagramas (icon, flow, rotors, compare, stack, timeline, cipher, network);
   - < 0.4: planos lentos y vacíos (floor, portrait, icon simple), sin flash.
5. **Letras grandes**: las de PLAN §6, en la cantidad de su duración (`check` avisa: 4–6 en el formato
   corto, 6–10 en 10 min…) + como mucho 1–2 `common.punch`. Si todo es texto gigante, nada es importante.
6. **Variedad**: nunca el mismo componente dos veces seguidas; ninguna foto dos veces (salvo el callback
   final); ningún icono más de 2 veces. Leé el `summary` del icono/boceto: `waves`/`radio` = ondas de
   radio, `water` = agua; si el nombre no deja claro qué es, miralo en la galería.
7. **Fotos**: la primera vez que se nombra a una persona/lugar; máximo una cada ~25 s.
8. **Objetos del tema**: los planos donde la voz nombra un objeto del inventario visual (PLAN §7a)
   usan su componente propio (`assets/components/`), no un icono genérico. En videos largos el
   componente propio vuelve en varios capítulos con params distintos (otra jugada, otra parte del
   motor): es el hilo visual del video.
8. **Acento**: un solo resaltado por plano (`active`, `pick`, `accent`).
9. **Callback**: el último beat narrativo repite el retrato o el título del comienzo.
10. **Textos en params**: ≤ 22 caracteres por rótulo, MAYÚSCULAS en tags/labels; nada que la voz no diga.

## 3. Transiciones (ya resueltas por el motor; cómo aprovecharlas)

- **binary**: todo es UN campo de partículas: al cambiar de componente con forma, los dígitos viajan
  de la forma anterior a la nueva (`morph` en segundos). Pasar de una forma densa (retrato) a una
  liviana (icono) se ve como "disolver"; de texto a forma, como "explotar y rearmar". Las letras
  grandes y el flash dispersan el campo (polvo) → sirven de "corte".
- **rough**: cada plano se dibuja trazo a trazo y sale con un fundido corto (`overlap` 0,6 s): el
  siguiente plano empieza a dibujarse mientras el anterior se borra. Para un corte seco, usar
  `common.flash` o una letra grande.
- Todos: `transition.overlap` en config (default 0,6 s).

## 4. Qué componente para qué idea (atajos)

| idea en la narración | binary | rough |
|---|---|---|
| título / promesa | `binary.title` | `rough.title` |
| persona | `binary.portrait` | `rough.photo` |
| lugar / objeto real | `binary.frame` | `rough.photo` |
| objeto/concepto | `binary.icon` (+ ICONS) | `rough.icon` (+ bocetos) |
| cifra enorme | `binary.word` + `binary.counter` | `common.punch` / `rough.counter` |
| fecha / época | `binary.word`, `binary.timeline` | `rough.timeline` |
| proceso / causa→efecto | `binary.orbit` | `rough.flow` |
| comparación / dilema | `binary.versus` | `rough.compare`, `rough.choice` |
| cantidad / multitud | `binary.grid` | `rough.tally` |
| tendencia | `binary.chart` | `rough.gauge` |
| código / cifrado | `binary.cipher`, `binary.rotors` | `rough.dsky`, `rough.rope` |
| frase clave | `common.lyric` | `common.lyric` |
| vacío / pausa | `binary.floor`, `binary.tunnel` | `rough.icon` simple |

(La lista completa con parámetros está en `CATALOG.md`.)

Plano preferido para los giros: `rough.introv2` o `binary.introv2`, con `text` grande a un lado y
foto `src` grande al otro. `highlight` destaca una frase; `focus` (rough) o `focusX`/`focusY`
(binary) protegen el sujeto. En rough produjo «UNA LLAMADA URGENTE» y «3 SEGUNDOS DE MUESTRA».
Usalo unas 3–5 veces por 10 min, con medios distintos. Cada beat con video dura ≥ 8 s; `common.clip` recomienda 12–18 s y los videos de ≥ 8 min necesitan dos tramos de ≥ 12 s. El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta: agregá `logo` y `logoName` al beat del medio. Distribuí fotos y clips por acto y reservá
`common.question` para el final hablado, hasta el inicio del outro.

## 5. Validar y revisar

```bash
.venv/bin/python $K check <id>     # 0 errores; avisos de duración/ambigüedad: corregir o justificar
.venv/bin/python $K sheet <id>     # MIRAR work/sheet-9x16.png: textos cortados, planos vacíos, fotos mal encuadradas
```
