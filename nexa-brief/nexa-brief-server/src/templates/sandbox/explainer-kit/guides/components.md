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

- `showcase/index.html` (servir `sandbox/` por HTTP): elegir diseño, ver cada componente animado
  con su nombre, para qué sirve, parámetros y ejemplo.
- `CATALOG.md`: lo mismo en texto (generado: `kit.py catalog`).

## 3. Cuándo crear uno nuevo

Solo si un concepto CENTRAL del video (no decorativo) no se puede contar bien con los existentes.
Antes de crear, revisar si alcanza con un parámetro nuevo en uno existente (mejor que duplicar).

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
