# Guía · componentes (usar, crear, organizar)

## 1. Dónde está cada cosa

```text
designs/
├── index.json                 lista de diseños disponibles
├── common/text.js             componentes de TODOS los diseños: common.lyric, common.punch, common.tag, common.flash, common.endcard
├── binary/                    diseño "UNO CERO" (historia)
│   ├── design.json            identidad: nombre/canal, paleta, fuentes, voz, cierre, scripts que carga
│   ├── DESIGN.md              estilo y criterios del diseño
│   └── components/
│       ├── _field.js          runtime: campo de ~11.000 glifos (no registra componentes)
│       ├── icons.js           biblioteca de siluetas (Kit.binary.ICONS)
│       ├── shapes.js          formas: title, word, portrait, icon, orbit, grid, chart, tunnel, rays, frame, bubble, floor
│       ├── ui.js              diagramas: counter, cipher, rotors, timeline, versus, convoy
│       ├── extra.js           componentes revisados que vinieron de IA o de un video concreto
│       └── outro.js           cierre de canal (lo agrega el motor)
└── rough/                     diseño "PROTOTIPO" (tecnología), misma estructura
    └── components/ _rough.js (runtime) · sketches.js (bocetos) · shapes.js · ui.js · extra.js · outro.js
```

**Regla de organización**: un archivo agrupa componentes de la MISMA línea (formas, diagramas,
dispositivos, texto…). Cuando un archivo pasa ~600 líneas, se parte por línea temática
(p. ej. `ui-data.js`, `ui-devices.js`) y se suma a `scripts` del `design.json`.

## 2. Ver los componentes

- `showcase/index.html` (servir `src/templates/` por HTTP): elegir diseño, ver cada componente animado
  con su nombre, para qué sirve, parámetros y ejemplo.
- `CATALOG.md`: lo mismo en texto (generado: `kit.py catalog`).

## 3. Cuándo crear uno nuevo

Cuando un objeto o mecanismo CENTRAL del tema no se puede contar bien con los existentes. La
decisión no es a ojo: sale del **inventario visual** de PLAN §7 (§6.1). Antes de crear, revisar
si alcanza con un parámetro nuevo en uno existente (mejor que duplicar).

Un video sobre ajedrez sin tablero, un video del Titanic sin barco o un video de un motor sin
motor es un video genérico: si el tema tiene objetos propios, el video los dibuja.

## 4. Cómo crearlo (contrato)

Leer `prompts/component-author.md` (contrato completo, con ejemplos y los errores típicos).
Resumen:

```js
Kit.register({
  name: "rough.nombre", tags: [...], layer: "main",
  summary: "Qué dibuja y para qué momento narrativo sirve.",
  example: { …params que se ven bien… },
  params: { clave: { type, default, doc, required?, min?, max?, options? } },
  create(ctx, p) { /* construir */ return { render(lt, b, t) { /* animar desde lt */ }, dispose() {} }; },
  // binary además: points(ctx, p) → B.pack(...), motion?, reveal?, groupAlpha?
});
```

Reglas duras: determinismo (nada de `Math.random`/`Date`/timers), colores solo de `ctx.C.palette`,
medidas en `u` o en `stage.content`, `size` de textos EN u, salida con `R.exitFx` (rough).

## 5. Flujo para agregar un componente

1. Escribirlo en el archivo de su línea dentro de `designs/<diseño>/components/` (o en uno nuevo
   y sumarlo a `scripts` de `design.json`).
2. Probarlo aislado: `showcase/stage.html?d=<diseño>&c=<nombre>&loop` y con capturas:
   `tools/shoot.py hoja.png <nombre> --orient both`.
3. Mirar la hoja (9:16 y 16:9): tamaño ≥ 60% del ancho en 9:16, textos legibles, nada cortado.
4. `kit.py catalog` (actualiza CATALOG.md y la galería).
5. Si lo escribió otro modelo: `tools/ai_loop.py` (valida, repara solo) y revisión visual antes de
   moverlo a `extra.js` (ver `lab/deepseek/NOTAS.md`).

## 6. Componentes propios del video (paso 3c)

El agente que produce un video escribe SOLO dentro de la carpeta del video. Por eso los
componentes que el tema necesita viven ahí:

```text
<video>/assets/components/<tema>.js        ← uno o más componentes (K.register), mismo contrato que §4
<video>/assets/components/catalog.json     ← lo escribe `kit.py components` (no a mano)
<video>/assets/config.json → components    ← lo escribe `kit.py components`: el motor los carga
<video>/work/components/<nombre>.png       ← hoja de control (9:16 y 16:9, 5 instantes)
<video>/work/components/review.md          ← rúbrica que completa quien los revisa (§6.3)
```

Funcionan igual que los del diseño (storyboard, `check`, `sheet`, render). Si un componente propio
sale muy bien, una persona lo puede promover al diseño (`designs/<diseño>/components/extra.js` +
`kit.py catalog`) para que lo usen otros videos.

### 6.1 Inventario visual (PLAN §7): decidir qué crear

Antes del storyboard, listar en PLAN §7 los **objetos y mecanismos del tema** (lo que alguien que
sabe del tema esperaría VER): el tablero y las piezas en ajedrez; el casco, los compartimentos y el
iceberg en el Titanic; la computadora, la alarma y el módulo lunar en el Apolo 11. Para cada uno:

| objeto / mecanismo | ¿cuántos planos lo necesitan? | ¿está en el clímax? | componente del catálogo que lo dibuja | decisión |
|---|---|---|---|---|
| tablero con piezas que se mueven | 7 | sí | ninguno (binary.grid no es un tablero) | **crear** `binary.chessboard` |

Regla: se **crea** todo objeto que aparece en ≥ 2 planos o en el clímax y que el catálogo no dibuja
de forma reconocible. Mínimo por duración (lengths.json → `domain_components`): 1 en 5 min, 2 en
10, 3 en 15, 4 en 30+. Si el tema no tiene objetos propios (una idea abstracta), escribir en PLAN §7
"sin componentes propios: …" con el motivo.

En `binary` y `rough` el criterio es ALTO: son los diseños dibujados (glifos y trazo a mano) y
todo se puede dibujar. En los diseños de presentación (acuarela, carta, collage, crónica…) se crea
solo lo imprescindible.

### 6.2 Escribir el componente

- Contrato y reglas duras: §4 y `prompts/component-author.md` (determinismo, paleta, unidades).
- Un archivo por tema (`assets/components/ajedrez.js`) con 1–4 componentes; nombre
  `<familia>.<nombre>` que no exista en `CATALOG.md`.
- Pensado para el STORYBOARD, no para la galería: params para los momentos del guion
  (p. ej. `moves`, `highlight`, `label`), `example` que se vea bien solo.
- **Todo texto es un param** (rótulo, pie, cifras): un componente que vuelve en 19 planos con el
  mismo pie fijo repite la misma frase 19 veces (visto en Hubble, 2026-10-12). El pie por defecto
  puede existir, pero el storyboard tiene que poder cambiarlo o apagarlo (`note: ""`).
- **Reconocible primero**: la silueta/forma de un objeto real se dibuja con sus proporciones
  reales (un caballo de ajedrez es la cabeza de caballo del Staunton, no una forma abstracta).
  Si no sale de memoria, dibujar a partir de una foto o un diagrama con licencia (paso 3b) y
  muestrearlo (`B.sampleImage` en binary) en vez de inventar curvas.
- **9:16 no es el 16:9 achicado**: un esquema horizontal (rayos, banco óptico, línea de montaje)
  se reacomoda en vertical (`ctx.stage.portrait`): girar el esquema, apilar las partes o agrandar
  el objeto hasta usar la altura. Visto en la primera prueba (Hubble, 2026-10-12): cuatro
  componentes aprobados con 4/5 ocupaban solo una franja del 15 % del alto en vertical.
- Tiempos (§2 de component-author): algo visible a los 0,3 s, la idea armada antes de 1,5 s,
  después movimiento lento; las acciones internas (mover una pieza, encender una alarma) pueden
  sincronizarse con la voz con params `"@palabra"`.

### 6.3 Control y revisión (ronda = corregir → controlar → mirar)

```bash
.venv/bin/python $K components <video-id>        # [--only binary.chessboard]
```

1. El control automático tiene que dar **0 errores** (sintaxis, determinismo, colores a mano,
   nombre, consola, que dibuje algo). Los avisos (aparece tarde, no sale, chico en 9:16) se corrigen
   o se justifican en la rúbrica.
2. **Mirar la hoja** `work/components/<nombre>.png` (abrirla como imagen) y completar la rúbrica de
   `work/components/review.md`, nota 1–5 por criterio:

   | criterio | 5 = | 1 = |
   |---|---|---|
   | se reconoce en 1 s | cualquiera dice qué objeto es sin el texto | hay que adivinar |
   | tamaño y composición | 9:16: ≥ 60 % del ancho **y usa la altura** (sin media pantalla vacía); nada cortado, zonas sin choques | una franja finita en vertical, chico, cortado o encimado |
   | legibilidad | mirada en el tamaño del celular: rótulos ≥ 1,6 u, en tinta (no en gris) si dicen algo que importa | hay que hacer zoom para leer |
   | estilo del diseño | binary: solo glifos, silueta rellena, blanco sobre negro; rough: trazo a mano dibujándose en orden, lima en UNA cosa | otro estilo, colores sueltos |
   | tiempos | visible 0,3 s, idea 1,5 s, respira, sale limpio | tarde, quieto o no sale |
   | narrativa | dibuja lo que la voz dice en ese plano y sirve para varios | decorativo |

3. **Aprobado** si todos los criterios tienen ≥ 4 y el control no tiene errores. Si no: anotar qué
   cambiar, corregir y volver a 1. **Máximo 3 rondas** por componente (`kit.py components` las
   cuenta): a la tercera sin aprobar, se deja de iterar, sus planos se hacen con componentes del
   catálogo y se anota en PLAN §10. Así nunca se entra en un bucle.
4. Recién con los componentes aprobados se escribe el storyboard (paso 6) y se corre `kit.py check`.

El reporte final (AGENTS.md §6) dice qué componentes propios se crearon, en cuántas rondas y con
qué notas; y cuáles se descartaron y por qué.
