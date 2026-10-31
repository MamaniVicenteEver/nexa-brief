# Sandbox: guía rápida

> ¿Plantilla NUEVA desde una referencia? Empezá por [PROTOTIPO.md](PROTOTIPO.md).

El sandbox es el taller para probar videos y plantillas sin tocar producción. El usuario revisa lo que tenga `index.html` o un MP4 en [la web](https://nexa-brief.everdev.space/plantillas?cat=sandbox) o en `http://192.168.20.23:3000/plantillas?cat=sandbox`.

## Mapa

| Carpeta | Motor compartido | Referencia para copiar | Guía detallada |
|---|---|---|---|
| `nodemotion` | HTML propio; puente en `_player/` y, según el caso, HyperFrames | `lyrics-final-cut/`, `promo-fuerza-motivacion/` | `nodemotion/AGENTS.md` |
| `nodetech` | `_tools/explainer-kit/` | `clip-prueba/` | `EXPLAINER.md`, `nodetech/AGENTS.md` |
| `nodehistory` | Explainer-kit; también `_mapas/` + `_proto/` | `memorias-demo/`; mapas: `bolivia-mar/` | `EXPLAINER.md`, `nodehistory/AGENTS.md`, `_mapas/ESCENA.md` |
| `nodepolitics` | `_tools/explainer-kit/` | `atlas-demo/`, `imperio-demo/` | `EXPLAINER.md`, `nodepolitics/AGENTS.md` |
| `nodeeconomy` | `_tools/explainer-kit/` | `dinero-demo/` | `EXPLAINER.md`, `nodeeconomy/AGENTS.md` |
| `nodeaction` | `_engine/`; pizarra: `_pizarra/` + `_proto/` | `paintwick-demo/`; pizarra: `pizarra-olvido/` | `nodeaction/AGENTS.md`, `_pizarra/ESCENA.md` |
| `referencias` | Ninguno: material de inspiración para agentes | `nodeaction/welcome-to-the-eng-pizarra/`, `nodehistory/mapas-con-banderas/` | `referencias/README.md`, `_proto/FABRICA.md` |

Las referencias viven en `referencias/<categoría>/<idea-id>/`, separadas de los proyectos que aparecen en **Todos**. Consultá `referencias/README.md` y las ideas de la categoría correspondiente antes de diseñar algo nuevo.

## Crear una plantilla

1. Leé esta guía y el `AGENTS.md` de tu carpeta. Copiá la referencia más cercana; **no empieces de cero ni dupliques motores**.
2. Asegurá `index.html`, `info.json`, `assets/` y `render/` en `sandbox/<carpeta>/<id>/`; conservá los archivos extra que requiera el motor, como `manifest.json` en explainer-kit.
3. Desde la raíz del repo, creá la ficha y completá resumen, librerías, entradas y notas:

   ```bash
   python3 nexa-brief-server/src/templates/_tools/sandbox/info.py init nodehistory/mi-video --engine explainer-kit:binary --based-on memorias-demo
   ```

   Para un diseño nuevo, agregá `--new-design`; el motor será la línea base de costo.
4. Revisá el preview en navegador. En motores compatibles, `?controls=1` activa gratis el puente y sus controles. La app genera y guarda en caché la miniatura.

## Registrar uso al final de cada sesión

Al final de cada sesión, agregá una línea con los tokens reportados:

```bash
python3 nexa-brief-server/src/templates/_tools/sandbox/info.py add-usage nodehistory/mi-video --provider codex --model gpt-6-luna --role storyboard --in N --out N --cached N --reasoning N --note "sesión de storyboard"
```

`--cached`, `--reasoning` y `--note` son opcionales. Con `~/codex/nexa-brief/run.sh`, pasá `nodehistory/mi-video` como segundo argumento para registrar el log. Consultá totales con `info.py show` y fichas con `info.py validate`.

## Cómo se cuentan los tokens

El ledger conserva los valores originales que informa cada proveedor. Para calcular el consumo,
`info.py`, la API y la ficha normalizan la **entrada nueva** (entrada sin caché): en Codex, OpenAI
y DeepSeek, `fresh_input = max(0, input_tokens - cached_input_tokens)`, porque esos proveedores
incluyen la caché dentro de `input_tokens`. En Claude, `fresh_input = input_tokens`, porque su
caché de lectura se informa aparte. La caché se muestra en su propia fila y no se suma al total:
`total_tokens = fresh_input + output_tokens + reasoning_tokens`. Para proveedores no listados,
`input_tokens` se toma como entrada nueva.

## Visibilidad y producción

Con `index.html` o MP4 aparece en Sandbox. Solo explainer-kit con `manifest.json` en estado `listo` puede pasar a producción. NodeAction, mapas y pizarra requieren graduar sus motores; NodeMotion requiere alta manual en `templates.json`. No muevas solo la carpeta.

## Ahorrar tokens

- Para una tarea normal, leé solo esta guía y el `AGENTS.md` de tu carpeta; abrí otra guía solo si la receta la necesita.
- Reutilizá la plantilla y el motor compartidos. No reescribas piezas existentes.
- Como objetivo, una plantilla nueva del mismo motor debería consumir entre **1/4 y 1/2** de la línea base.

## Checklist

- [ ] Partí de una referencia cercana y reutilicé el motor.
- [ ] Revisé `index.html`, `assets/`, `render/` y completé `info.json`.
- [ ] Probé el preview en navegador y anoté los recursos/librerías usados.
- [ ] Registré el uso de esta sesión al terminar.
- [ ] Confirmé que el usuario puede verla en Sandbox; no moví nada a producción sin cumplir su vía de promoción.
