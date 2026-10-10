# CRÓNICA (`cronica`) · historia en capas 3D

Réplica del estilo del video de referencia `sandbox/otros/From Klickpin.com- Steal these 31 Dreamy capsule wardrobe ideas … (2).mp4`
(75,5 s · 1280×720 · 29,97 fps): un slideshow histórico oscuro y elegante. Fotos de archivo en B/N con
bordes de pincel rasgados flotan en un espacio 3D junto con rótulos grises pincelados (el año), párrafos
serif blancos y capas tenues; una cámara las mira en perspectiva oblicua con profundidad de campo y corta
en seco de plano a plano con "rack focus". Diseño reutilizable para cualquier tema histórico (biografías,
efemérides, ciudades, guerras, política).

Demo: `sandbox/explainer-videos/cronica-demo/` (Muro de Berlín, mismas anclas que `muro-de-berlin`).

## Análisis de la referencia

Cortes de cámara detectados (`select='gt(scene,0.2)'`): 10,04 · 14,08 · 18,08 · 22,12 · 26,16 · 30,16 ·
34,17 · 38,20 · 44,24 · 49,25 · 55,32 · 61,36 · 65,37 · 69,40 s. **Ritmo: un corte cada ~4 s; cada
diapositiva dura ~8 s = 2 planos** (amplio oblicuo → corte → ángulo cercano sobre el texto).

| Tramo (s) | Escena | Qué pasa |
|---|---|---|
| 0–6,0 | Apertura "ENVATO PRESENTS" | Arranca todo desenfocado (bokeh); 0,3–1,0 s el foco tira hacia el título; las letras (serif, mayúsculas, tracking ~.05em) aparecen de izq. a der. desde el desenfoque; detrás: retrato tenue a la izquierda, foto de edificios rasgada a la derecha, marco de líneas finas con nodos, rayitas blancas, bloquecitos de texto con barra. Cámara: ligera rotación (rz ≈ +5°) y deriva lenta. |
| 6,0–10,0 | "1912" plano amplio | Corte a un plano oscuro borroso; la cámara llega deslizándose y frenando (~1,5 s); primero se leen los renglones del párrafo (borrosos → nítidos), a los ~1,0–1,5 s la foto se **pinta a pinceladas** (manchas que crecen). Vista muy oblicua (plano inclinado ~40°, alabeo −10°): lo cercano (abajo) y lo lejano (arriba) desenfocados. |
| 10,0–14,0 | "1912" plano cercano | **Corte seco** a un ángulo cercano sobre el texto, todo muy borroso ~0,3 s y el foco entra en ~0,9 s; dolly lento. |
| 14,0–22,0 | "1917" (texto izq./foto der.) | Igual: entrada con párrafo primero y foto pintada; panel gris claro (#555–#6f6f6f) detrás del texto; letra gigante "W" casi invisible. Corte a cercano en 18,1. |
| 22,0–30,0 | "1923" (foto arriba, texto abajo) | Cámara girada en sentido horario (rz ≈ +10°); corte en 26,2 a un ángulo más alto. |
| 30,0–38,0 | "1927" (foto grande + panel oscuro que la tapa a la derecha con el texto) | Corte en 34,2. |
| 38,0–44,0 | "1932" (foto centrada, año y texto abajo-izq. encima) | Un solo plano con dolly. |
| 44,0–49,0 | "1935" (texto arriba-izq., foto der.) | |
| 49,0–55,0 | "1942" cita en **itálica** | Año en itálica con una rayita "_" al lado, párrafo itálico justificado al centro, retrato grande tenue a la izquierda, foto rasgada a la derecha. |
| 55,0–61,0 | "1947" (foto izq., texto der. justificado) | |
| 61,0–69,0 | "1964" (texto izq., foto der.) | Corte en 65,4. |
| 69,4–75,5 | Cierre "THANK YOU" | Igual que la apertura: arranca borroso, rack focus, letras desde el desenfoque. |

Elementos constantes: polvo blanco que cae (motas de 1–3 px), discos de bokeh, grano de película,
viñeta, rayitas blancas (– y |) sueltas en el espacio, bloquecitos de 2–3 renglones diminutos con una barra
vertical blanca, red de líneas finas (blanco ~35 %) con nodos, letras gigantes tenues, fotos fantasma.
No hay subtítulos ni fundidos: todas las transiciones son **corte seco + desenfoque que se resuelve**.

### Paleta (muestreada con PIL)

| Token | Hex | Dónde |
|---|---|---|
| `bg` | `#161616` | fondo (rincones `#121212`, zonas medias `#1a1a1a`–`#1f1f1f`) |
| `panel` | `#2a2a2a` | paneles oscuros pincelados (`#242424`–`#2f2f2f`) |
| `swatch` | `#5c5c5c` | rótulo del año (`#515151`–`#656565`) |
| panel claro | `rgba(64,64,64,.62)` | panel detrás del texto (`#555`–`#6f6f6f` en la ref.) |
| `ink` | `#f1f1ef` | texto blanco |
| fotos | B/N contrastado, cielos ~`#ebebeb` | grayscale + contrast 1.22 |

### Tipografía

Serif tipo Garamond en toda la pieza → **EB Garamond** (Google Fonts):
año 700 (≈6,2 u), párrafo 600 (≈3,6 u, interlineado 1,18), cita en itálica 600, título 600 en mayúsculas
con tracking .045em, bloquecitos 500 (≈1,1 u). Subtítulos (la referencia no tiene; la narración los
necesita): EB Garamond itálica 500, gris 62 %, palabra actual blanca 600.

## Cómo está hecho

- **Mundo 3D por beat** (`Kit.cronica.Scene`): DOM con `perspective` + `preserve-3d` en `layers.dom`.
  La cámara es `translateZ(P−d) rotateZ(rz) rotateX(rx) rotateY(ry) translate3d(−target)`, calculada
  desde `lt` en cada cuadro (seek determinista, verificado: mismo hash de captura al volver a un `t`).
- **Profundidad de campo**: se proyectan las 4 esquinas de cada plano con la misma matriz que el CSS y se
  calcula el círculo de confusión `A·u·|dist−foco|/foco` (convertido a blur local ×dist/P). Los planos
  grandes (fotos) llevan una **copia más desenfocada con máscara en gradiente** orientada hacia donde el
  plano se aleja → nítido en el centro, borroso en el borde cercano/lejano (tilt-shift real). El foco sigue
  al texto (`fp`).
- **Rack focus**: en cada corte el plano de foco arranca demasiado cerca (×0,42 en el corte a cercano,
  ×0,56 en la entrada) y "tira" hasta el texto (0,12 → 1,07 s).
- **Texturas procedurales** (rng sembrado, cacheadas): rectángulo de pincel con bordes rasgados y pincel
  seco (fotos, rótulos, paneles), pinceladas largas para revelar la foto, grano (6 tiles), polvo y bokeh.
  Nada copiado de la referencia.
- **Fotos**: canvas propio, graduadas a B/N contrastado; recorte `cover` con `focus`/`zoom` → la misma foto
  se reutiliza con encuadres distintos; bordes quemados (viñeta interna).
- `transition.overlap = 0` y `post: 0` en todos los componentes: **corte seco** como la referencia.

## Catálogo de movimientos replicados

| Movimiento / transición | Segundo de la ref. | Implementación |
|---|---|---|
| Arranque borroso + rack focus al título | 0,0–1,0 | `cronica.title` · `camera()` foco 0,56→1 |
| Letras del título desde el desenfoque, izq.→der. | 0,3–1,2 | `revealChars` (0,035 s/letra, blur 7 px→0) |
| Corte seco a plano nuevo + cámara que llega frenando | 6,0 / 14,1 / 22,1 / 30,2 / 38,2 … | `inOff` con expo-out 2,0 s |
| Párrafo que aparece renglón a renglón desde el desenfoque | 6,3–7,0 / 14,4–15,0 | `para()` un plano por renglón, 0,09 s de escalón |
| Foto pintada a pinceladas | 7,0–7,6 / 15,0–15,6 | `photo().draw(q)` 6 pinceladas que crecen |
| Rótulo del año que se barre de izq. a der. | 7,2 | `clip-path inset()` 0,45 s |
| Vista muy oblicua con DOF (cerca/lejos borrosos) | 7,5–10,0 | plano amplio `A` (rx 26–40°) + DOF por esquinas |
| Corte a ángulo cercano + rack focus largo | 10,0 / 18,1 / 26,2 / 34,2 / 65,4 | plano `B`, automático si el beat dura ≥ 6,2 s o `reframe` |
| Deriva/dolly lento durante el plano | todo | `drift` (d −6 %, ry ±3°) |
| Red de líneas que se dibuja, nodos y rayitas | 0–2 / 6–8 | `network().drawIn` |
| Polvo que cae, bokeh, grano, viñeta | todo | runtime `post()` en capa `top` |
| Cita itálica con rayita "_" que parpadea | 49–55 | `cronica.quote` |
| Panel oscuro que tapa media foto (1927) | 30–38 | `layout: "split"` |
| Cierre "THANK YOU" | 69,4–75,5 | `cronica.outro` |

## Componentes

| Componente | Escena de la referencia | Params clave |
|---|---|---|
| `cronica.title` | ENVATO PRESENTS (apertura / portada de capítulo) | `text`, `kicker`, `src`, `src2` |
| `cronica.slide` | diapositivas con año (1912 … 1964) | `src`, `year`, `text`, `layout` (right/left/top/center/split), `italic`, `align`, `focus`, `zoom`, `mirror`, `reframe`, `letter` |
| `cronica.quote` | 1942 (cita en itálica con retrato tenue) | `src`, `side`, `year`, `text`, `focus`, `sideFocus` |
| `cronica.verse` | (párrafo de la ref. llevado a frase narrada) palabras sincronizadas con la voz | `kicker`, `accent`, `src`, `size` |
| `cronica.outro` | THANK YOU | `thanks`, `channel`, `cta`, `support`, `handle` |

Runtime de familia (`_cronica.js`): fondo, polvo/bokeh/grano/viñeta, estilo de subtítulos y utilidades
`Kit.cronica` (Scene, photo, yearTag, para, block, network, decor, camera…).

## Qué quedó igual y qué difiere

Igual: paleta, tipografía serif, composición de las 5 maquetaciones + la cita, fotos B/N con borde de
pincel, rótulo gris del año, bloquecitos con barra, líneas con nodos, letras gigantes, fotos fantasma,
polvo/bokeh/grano, ritmo de ~4 s por plano, cortes secos con rack focus, cámara oblicua con DOF,
armado (párrafo → rótulo → foto pintada).

Difiere (y por qué):
- **DOF aproximado**: CSS no tiene desenfoque por píxel según profundidad; se usa blur por plano + copia
  con máscara en gradiente para los planos grandes. Los renglones de texto se desenfocan por renglón.
- **Bokeh/polvo en espacio de pantalla** (capa `top`), no dentro del mundo 3D: más barato y el resultado
  visual es casi igual.
- **Subtítulos** activos (la referencia no tiene): discretos, en EB Garamond itálica.
- **`cronica.verse`** no existe tal cual en la referencia: es el párrafo de la referencia llevado a los
  momentos de "letra grande" del explainer (palabras que se enfocan cuando la voz las dice).
- Textos de marca ("ENVATO PRESENTS"/"THANK YOU") reemplazados por título propio y "GRACIAS POR VER".
- El `handle` del cierre no puede empezar con "@" (el motor trata los strings "@…" como anclas de palabra):
  por eso el default es `youtube · cronica`.

## Notas de uso

- Beats de 4–8 s; los ≥ 6,2 s (`cronica.autoReframe`) hacen solos el corte a plano cercano a la mitad
  (`reframe: "@palabra"` para sincronizarlo con la voz; `-1` para no cortar).
- Alternar `layout` y `mirror` entre beats seguidos; reutilizar fotos con `focus`/`zoom` distintos.
- `year` corto (≤ 12 caracteres): año, fecha u hora ("1961", "9 NOV", "23:30", "28 AÑOS").
- Ajustes en `config.cronica`: `aperture` (fuerza del desenfoque), `maxBlur` (u), `dust`, `bokeh`, `grain`.
- Costo: ~30 planos DOM con `filter: blur()` por cuadro y 1–3 canvases de foto; el revelado de la foto
  redibuja su canvas sólo durante ~1 s.

## Intros y cierre

Archivos: `components/intros.js` (registra `cronica.introv1`, `cronica.introv2`, los fondos propios y
`Kit.cronica.hook`) y `components/outro.js` (`cronica.outro`). Contrato común: `designs/common/hook.js`.
Orden de capas: el fondo del contrato (`image`, `component` de canvas) va en el canvas `main`; los
fondos propios DOM 3D, la sombra de legibilidad y el texto van en la capa `dom`, en ese orden; el polvo,
el grano y la viñeta del runtime quedan encima (capa `top`). Si el componente de fondo dibuja en DOM
(p. ej. `cronica.slide`), el `dim` se aplica también en DOM. Todo es función de `lt`.

### Fondos propios (`bg`), temáticamente neutros

| Preset | Qué es |
|---|---|
| `archivo` | Papeles rasgados grises flotando a distinta profundidad, fotos fantasma del video (si hay), bloquecitos con barra, red de líneas con nodos y letra gigante; cámara oblicua con deriva y profundidad de campo. Por defecto en `introv1`. |
| `linea` | Línea de tiempo: eje fino con rótulos grises de años (`era: [desde, hasta, paso]`, por defecto 1900–2020 cada 10) que se pierde en profundidad; la cámara la recorre. Por defecto en `introv2`. |
| `letras` | Letras gigantes tenues (tomadas del titular) a distinta profundidad; el foco las recorre (rack focus lento) y una red de líneas se dibuja. |
| `proyector` | (canvas) Haz de proyector con polvo iluminado, cuadro de película que parpadea con rayas y perforaciones que corren por los bordes. Por defecto en el cierre. |
| `image` | Foto en `src` en B/N contrastado con bordes quemados (zoom lento del contrato), `focus`, `dim`. |
| `component` | Otro componente (`use`, `useParams`; recibe `src` si usa foto), oscurecido con `dim`. |
| `none` | Liso `#161616`. |

### `cronica.introv1` · gancho "golpe"

Titular GIGANTE (el renglón más largo ≈ 80 % del ancho, limitado por alto) en EB Garamond 600. Cada
palabra cae desde muy cerca de la cámara (enorme, girada y desenfocada) hasta su lugar y entra en foco
con una sacudida seca. `^palabra^` va en itálica sobre el rótulo gris pincelado que se barre; un signo
pegado (`^MURO^?`) no se separa. **Momento de impacto `cutAt`**: corte seco a otro ángulo con rack focus,
las letras gigantes del fondo (la palabra destacada) se alinean detrás del titular y se barre una
pincelada gris debajo. Salida: se desenfoca y se funde en el solape (`post: 0.6`).

Params: `text` (req.), `kicker` (rótulo gris chico), `sub` (itálica debajo), `wordAt` (0,35),
`stagger` (0,28), `cutAt` (2,3; -1 = sin corte; acepta `@palabra`), `letters` (letras gigantes; vacío = la
destacada), `era`, + `bg`, `src`, `focus`, `use`, `useParams`, `dim`.

### `cronica.introv2` · gancho "pregunta + revelación"

La pregunta (mayúsculas espaciadas) se revela letra a letra desde el desenfoque con la rayita `_` que
avanza; en `stampAt` corte seco a otro ángulo y la respuesta llega en un gran rótulo gris pincelado en
itálica, más cerca de cámara: el foco salta de la pregunta a la respuesta.

Params: `text` (req.), `kicker` (bloquecito con barra), `stamp`, `stampAt` (2,6; acepta `@palabra`),
`typeAt` (0,35), `cps` (16), `era`, + params de fondo.

### `cronica.outro` · cierre del canal (sin recuadro)

GRACIAS POR VER (itálica espaciada, letras desde el desenfoque, filetes que se barren) → nombre del
canal grande: sus letras llegan dispersas desde la profundidad y se **alinean** con rack focus, y se
barre el rótulo gris debajo → rótulo LIKE gris que se **presiona** (pasa a blanco con el texto oscuro y se
hunde) → flecha como línea fina con nodos (`arrow`) → placa SUSCRÍBETE de papel rasgado + campana que
suena (oscilación amortiguada y ondas) → apoyo en itálica → `handle` con barra y filete. Fundido en los
últimos 0,4 s. 16:9 en filas; 9:16 apilado usando toda la altura.

Params: `...Kit.hook.outroParams` (`thanks`, `channel`, `cta`, `support`, `handle`, `arrow`, `likeAt`,
`subscribeAt`, `bellAt`, `supportAt`; tiempos con `Kit.hook.outroTimes`), `bg` (`proyector` | `archivo`
| `letras` | `linea` | `image` | `component` | `none`), `dim` (0,66), `era`.

### Ejemplos

```json
{ "t": 0, "use": "cronica.introv1", "until": "Casi las 7",
  "params": { "text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989",
              "sub": "la noche que nadie vio venir", "cutAt": 2.5,
              "bg": "image", "src": "assets/media/muro-gente.jpg", "focus": [0.5, 0.3] } }

{ "t": 0, "use": "cronica.introv2",
  "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "stampAt": "@nadie",
              "bg": "component", "use": "cronica.slide", "src": "assets/media/leipzig.jpg",
              "useParams": { "year": "1989", "layout": "center" }, "dim": 0.5 } }

{ "use": "cronica.outro", "params": { "bg": "archivo", "likeAt": 5.16, "subscribeAt": 5.54 } }
```
