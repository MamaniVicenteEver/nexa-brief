Para crear cualquier contenido empieza por el [índice](../../skills/README.md),
[CALIDAD.md](../../skills/CALIDAD.md) (estándar obligatorio) y
[ORQUESTACION.md](../../skills/ORQUESTACION.md) (roles, delegación, terminado e informe).

# AGENTS.md — Casa de pruebas (sandbox)

> **Ubicación obligatoria (v2/v3):** esta carpeta del repositorio solo admite
> motores compartidos experimentales, herramientas y documentación. Todos los
> proyectos de prueba, prototipos y referencias, incluidos los históricos,
> pertenecen a `$NEXA_PROFILE_DIR/sandbox/`. Una demo principal validada pasa por
> el servicio a `src/templates/<categoría>/<id>/`; los episodios de producción
> pertenecen a `$NEXA_PROFILE_DIR/productions/`. No copies ni traslades por inferencia.
> Resuelve el perfil efectivo y sigue
> [la norma de almacenamiento](../../../docs/ubicacion-demos-pruebas-episodios.md).

**Guía rápida para cualquier agente nuevo:** después del tronco común, leé [`SANDBOX.md`](SANDBOX.md). Después,
abrí solo el `AGENTS.md` de la carpeta en la que vas a trabajar.

> **¿Te pidieron un video con un diseño que ya existe? No es acá:** seguí
> el flujo de video con diseño existente del índice (carpeta de producción). Esta carpeta es solo para
> lo NUEVO: plantillas y diseños nuevos, réplicas de un video de referencia, componentes de diseño.
>
> Las ideas se prueban en el Sandbox del perfil y pueden verse en Plantillas o
> Showcase según su registro y visibilidad. Esta carpeta del repositorio aporta
> las herramientas y motores experimentales; no almacena esos proyectos.
> Las demos validadas y motores de producción viven fuera de `src/templates/sandbox/`.
>
> **Antes de empezar, leé el `AGENTS.md` de la carpeta del tema.** Ahí está todo lo que ya
> aprendimos (qué funcionó, qué no, recetas y checklists): no hace falta investigar de nuevo.

## Contrato vigente de entrega y traslado

Para crear una plantilla, empieza por [PROTOTIPO.md](PROTOTIPO.md) y cumple
[PREPARAR-PRODUCCION.md](PREPARAR-PRODUCCION.md). Este contrato prevalece sobre
las recetas históricas de cada tema para pasar a producción. La demo principal
explícitamente declarada se incorpora al repositorio solo mediante el servicio;
los episodios siguen en el perfil. No copies ni muevas manualmente.
**Preparar para producción** revisa sin IA; **Pasar a producción** traslada sin IA;
**Completar preparación con IA** genera el paquete editorial desde la categoría.

## Mapa

```text
REPOSITORIO/nexa-brief-server/src/templates/
├── <categoría>/<demo-id>/     ← demo principal validada de producción
├── _tools/                   ← herramientas y motores compartidos
└── sandbox/                  ← motores experimentales, herramientas y docs
    └── <categoría>/_<motor>/ ← sin episodios, prototipos ni referencias privadas

$NEXA_PROFILE_DIR/
├── sandbox/<categoría>/<id>/             ← todas las pruebas y prototipos
├── sandbox/referencias/<categoría>/<id>/ ← materiales de referencia
└── productions/<categoría>/<id>/         ← episodios basados en diseños/motores
```

Los `AGENTS.md` temáticos y `referencias/README.md` del repositorio son
instrucciones compartidas; sus ejemplos de proyectos se resuelven en el perfil.
Consulta el catálogo para categorías reales: su ID puede diferir del nombre de carpeta.

## Qué leer según lo que vas a hacer

| Querés… | Leé |
|---|---|
| una plantilla nueva de letras, promo o fondo (música) | `nodemotion/AGENTS.md` |
| un video explicativo de prueba (tech, historia, política, economía) | `EXPLAINER.md` → `<tema>/AGENTS.md` → `_tools/explainer-kit/AGENTS.md` |
| un diseño nuevo para el motor explainer | `EXPLAINER.md` (sección de diseños nuevos) |
| una escena de acción (batalla, enfrentamiento, disturbio…) con personajes | `nodeaction/AGENTS.md` |
| inspiración visual o narrativa previa a una idea | `referencias/README.md` y la subcarpeta de su categoría |
| pasar algo a producción | `PREPARAR-PRODUCCION.md` y `docs/pasar-a-produccion-disenos.md` del servidor; usar los botones/API |

**NodeAction también es distinto**: tiene su propio motor (`nodeaction/_engine/`, personajes articulados
en un mundo 2.5D, director automático); comparte con los demás el contrato de grabación (`__promo`), la voz
y la transcripción del explainer-kit. La compatibilidad para pasar cada diseño a
producción la determina el informe técnico vigente; no se fuerza por editar estado.

**NodeMotion es distinto**: cada plantilla es su propio `index.html` (canción + letra + medios) y
pasa por el pipeline de plantillas. **Tech, History, Politics y Economy usan el mismo motor**
(`_tools/explainer-kit`): cambian el tema, la estrategia y los diseños, no la forma de construir.

## Reglas de la casa (todas las carpetas)

1. **Solo escribís el proyecto en `$NEXA_PROFILE_DIR/sandbox/<tema>/`** en v2/v3. Para pasar a producción, usa el servicio y el destino según demo o episodio.
2. **No se publica nada** ni se usa `data/canales/` desde acá.
3. **No duplicar motores**: los videos de prueba del explainer usan `_tools/explainer-kit` (el mismo
   de producción). Si el motor necesita un cambio, es un cambio de producción: avisar al usuario.
4. **Dejá lo aprendido escrito**: al terminar, sumá a `<tema>/AGENTS.md` lo que funcionó y lo que no
   (en la sección de lecciones), así la próxima vez no se repite la investigación.
5. **Sin `git commit` ni `push`** salvo que el usuario lo pida.

## Cómo se pasa a producción

Usa el informe técnico vigente y el servicio indicado en `PREPARAR-PRODUCCION.md`.
No uses recetas antiguas de mover carpetas o dar altas manuales para omitirlo.
Un motor o categoría que todavía no soporte el servicio queda como pendiente de
integración; no se marca listo ni se fuerza el traslado.


## Promos: instrucciones compartidas, sin copias por video

Para Editorial, Sports, Dynamic, Kinetic, Trendy y Urban, usa [el flujo único de promos](../_tools/nodemotion/promo/production/OPERATE.md). Los prompts versionados viven en `src/templates/_tools/nodemotion/promo/production/prompts/` del servidor y se resuelven con `promo.py prompt --id ID --stage ETAPA`; nunca crees `work/instrucciones/prompts/`, copias de esos Markdown, otro productor ni scripts de campaña para repetir el flujo. Cada proyecto conserva solo la referencia de versión y hashes, sus datos y evidencias. Las reglas específicas del diseño proceden de `templates/<template-id>.json` y `DESIGN.md`; no se copian al proyecto. `CLAUDE.md` incorpora este archivo mediante `@AGENTS.md`. Las recetas de crear o bifurcar una plantilla nueva no aplican a videos basados en una promo existente.
