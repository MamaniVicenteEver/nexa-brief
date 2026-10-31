# AGENTS.md — Casa de pruebas (sandbox)

**Guía rápida para cualquier agente nuevo:** leé primero [`SANDBOX.md`](SANDBOX.md). Después,
abrí solo el `AGENTS.md` de la carpeta en la que vas a trabajar.

> **¿Te pidieron un video con un diseño que ya existe? No es acá:** seguí
> `src/skills/explainer/produce/SKILL.md` (vía rápida, carpeta de producción). Esta carpeta es solo para
> lo NUEVO: plantillas y diseños nuevos, réplicas de un video de referencia, componentes de diseño.
>
> Acá se prueban ideas: plantillas nuevas, videos de prueba, diseños. Nada de esta carpeta sale
> en la app ni se publica. Lo que ya funciona y está en producción vive fuera, en
> `src/templates/` (reglas estrictas en `src/templates/AGENTS.md`).
>
> **Antes de empezar, leé el `AGENTS.md` de la carpeta del tema.** Ahí está todo lo que ya
> aprendimos (qué funcionó, qué no, recetas y checklists): no hace falta investigar de nuevo.

## Mapa

```text
src/templates/
├── nodemotion/{lyrics,commercial,image,video}/<id>/   ← PRODUCCIÓN · música (pipeline de plantillas)
├── nodetech/<video-id>/                              ← PRODUCCIÓN · videos explicativos
├── nodehistory/<video-id>/                           ← PRODUCCIÓN
├── _tools/                                           ← motores y herramientas
│   ├── explainer-kit/        ← motor de videos explicativos (Tech, History, Politics, Economy)
│   ├── commercial/ hyperframes/ lyrics-*/            ← generadores y herramientas de NodeMotion
└── sandbox/                                          ← ESTA CARPETA (pruebas)
    ├── AGENTS.md             ← este índice
    ├── EXPLAINER.md          ← base común de Tech, History, Politics y Economy (mismo motor)
    ├── nodemotion/           ← prototipos de plantillas de música: letras, promos, fondos
    ├── nodetech/             ← ideas de videos de tecnología  (+ _referencias/)
    ├── nodehistory/          ← ideas de videos de historia     (+ _referencias/)
    ├── nodepolitics/         ← ideas de videos de política
    ├── nodeeconomy/          ← ideas de videos de economía
    ├── nodeaction/           ← escenas de acción con personajes (motor propio: _engine/, escenas = datos)
    └── referencias/          ← material de inspiración: <categoría>/<idea-id>/ (no son proyectos)
```

Las referencias están separadas de los proyectos. Para buscar una idea, usá
`referencias/<categoría>/<idea-id>/` y leé `referencias/README.md`; ahí se explica qué guardar y cómo
analizarlo antes de crear un prototipo. Las categorías válidas son `nodetech`, `nodehistory`,
`nodepolitics`, `nodeeconomy`, `nodeaction`, `nodemotion` y `otros`.

## Qué leer según lo que vas a hacer

| Querés… | Leé |
|---|---|
| una plantilla nueva de letras, promo o fondo (música) | `nodemotion/AGENTS.md` |
| un video explicativo de prueba (tech, historia, política, economía) | `EXPLAINER.md` → `<tema>/AGENTS.md` → `_tools/explainer-kit/AGENTS.md` |
| un diseño nuevo para el motor explainer | `EXPLAINER.md` (sección de diseños nuevos) |
| una escena de acción (batalla, enfrentamiento, disturbio…) con personajes | `nodeaction/AGENTS.md` |
| inspiración visual o narrativa previa a una idea | `referencias/README.md` y la subcarpeta de su categoría |
| pasar algo a producción | la sección "promover" del `AGENTS.md` del tema |

**NodeAction también es distinto**: tiene su propio motor (`nodeaction/_engine/`, personajes articulados
en un mundo 2.5D, director automático); comparte con los demás el contrato de grabación (`__promo`), la voz
y la transcripción del explainer-kit. Todavía no se promueve a la app (prototipo).

**NodeMotion es distinto**: cada plantilla es su propio `index.html` (canción + letra + medios) y
pasa por el pipeline de plantillas. **Tech, History, Politics y Economy usan el mismo motor**
(`_tools/explainer-kit`): cambian el tema, la estrategia y los diseños, no la forma de construir.

## Reglas de la casa (todas las carpetas)

1. **Solo escribís dentro de `sandbox/<tema>/`.** Para tocar producción, se promueve (no se edita a mano).
2. **No se publica nada** ni se usa `data/canales/` desde acá.
3. **No duplicar motores**: los videos de prueba del explainer usan `_tools/explainer-kit` (el mismo
   de producción). Si el motor necesita un cambio, es un cambio de producción: avisar al usuario.
4. **Dejá lo aprendido escrito**: al terminar, sumá a `<tema>/AGENTS.md` lo que funcionó y lo que no
   (en la sección de lecciones), así la próxima vez no se repite la investigación.
5. **Sin `git commit` ni `push`** salvo que el usuario lo pida.

## Cómo se promueve

- **Explainer** (tech/history/politics/economy): `kit.py promote <video-id>` mueve
  `sandbox/<tema>/<id>/` a `src/templates/<tema>/<id>/` y corrige la ruta al motor. Desde ese momento
  aparece en `/plantillas` (tarjeta + modal) listo para grabar y publicar.
- **NodeMotion**: se sigue `nodemotion/AGENTS.md` (registro en `templates.json` + `niches.json`,
  reloj HyperFrames, validación y tests).
