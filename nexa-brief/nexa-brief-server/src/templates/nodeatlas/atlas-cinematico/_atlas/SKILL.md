---
name: atlas-cinematico-produce
description: Producir videos de mapas 3D con el diseño Atlas Cinemático existente. Usar su catálogo JSON, investigar fuentes, preparar guion y voz, componer escenas por datos y validar mapas antes de exportar; no editar el motor para un episodio.
---

Antes: [CALIDAD.md](../../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../../skills/PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

# Atlas Cinemático: producir con JSON

Usa este flujo cuando el usuario pida un video con **Atlas Cinemático**, el diseño MapLibre 3D del showcase. Es diferente de los antiguos diseños `atlas` del explainer-kit y `_mapas`.

## Si el proyecto es Atlas noticiero

Para el resumen geopolítico y escenas con `hud`, empieza por [noticiero/AGENTE.md](noticiero/AGENTE.md) (proceso completo, voz y estilo fijos, estilo `original` por defecto) y, para el otro estilo, [noticiero/QUICK.md](noticiero/QUICK.md).
Descubre sus estilos con `/api/v1/showcase/designs/<episodio>/styles`; consulta la guía y solo los
contratos elegidos con estilo y orientación. `dynamic-news` unifica la identidad; `original` conserva
el dibujo anterior. Compón `scene.hud` con las piezas del noticiero, además de cámara y capas geográficas.
Revisa `__newsHud.layout().overflow` en ambos formatos; secuencia los mensajes cuando no caben.
La selección en Showcase/modal es una vista previa; guarda `estilo` en los JSON del episodio para fijarla.

## Entrada rápida

Desde `nexa-brief-server/`, define la ruta una vez:

```bash
A=src/templates/nodeatlas/atlas-cinematico/_atlas/produce.mjs
node "$A" catalog
node "$A" example atlas.arrow
```

`produce.mjs new` está deshabilitado. Crea episodios con **Crear video** o el
productor host/API existente (`scripts/atlas_factory.py init`) del perfil activo;
las pruebas van a su `sandbox/` y los episodios de producción a su `productions/`.
Después pasa la ruta explícita del episodio a `check`, `voice`, `transcribe`,
`add` o `prepare`; no se resuelven IDs buscando carpetas del repositorio.
**No copies `_atlas/` ni desarrolles HTML por video.** La demo principal validada
pertenece al repositorio, los episodios al perfil. `engine_id: nodehistory/_atlas`
se conserva: su ruta física de producción es
`src/templates/nodeatlas/atlas-cinematico/_atlas/` según `engine_root`.

Lee [PRODUCIR.md](PRODUCIR.md) para ejecutar el trabajo. Para elegir piezas lee [components.json](components.json), preferentemente filtrado por `catalog` y `example`. Los campos `target`, `params` y `demo` explican dónde insertar y qué entradas pasar. El `demo` es JSON listo para adaptar; sus cifras ilustrativas no son evidencia.

## Orquestación propia de Atlas Cinemático

[orchestration.json](orchestration.json) es el contrato de este diseño para seleccionar
al agente de guion y planificar sus componentes. Prefiere `codex / gpt-6.1-terra / high`;
solo si el proveedor no está disponible en la factoría usa `claude / claude-haiku-5-5 / medium`.
No modifica `src/skills/models/roles.json` ni otros diseños. Una ejecución fallida no
autoriza probar otro proveedor, quitar aislamiento o usar un CLI directo. Reutiliza
el guion válido existente; registra selección solicitada, seleccionada, modelo real
reportado y motivo del fallback. El esfuerzo real permanece desconocido si el adaptador
no lo informa.

La dirección visual bloqueada conserva el Atlas Cinemático original: Mercator,
satélite realista, vista oblicua del país completo, pitch60° (rango58–68°) y bearing4°.
Durante estados o regiones conserva ese encuadre, resalta en rojo y no hace zoom.
La bandera persiste dentro del capítulo con opacidad94% en su presentación,12% durante
país/insight y4% en regiones. El retrato mantiene una foto documental fija en pantalla,
con escala de foto130% y texto120% respecto al layout aprobado previo, adaptada a ambos formatos.

Planifica cada pieza en `work/component-plan.json` con `intent`, `component`, `timeAnchor`,
`location`, `media`, `ref`, `layout` y `reason`, según el contrato JSON. Elige `polePhoto`,
`hexPhoto` o `panel` solo cuando una imagen documental ayude a explicar el fragmento;
no uses todas las piezas por decoración. La flecha visible país→siguiente país muestra
el recorrido narrativo, con curva cuando convenga a trayectos largos; no representa
comercio ni cantidades económicas. Los tiempos se resuelven con palabras reales,
las fotos requieren créditos y el layout debe evitar retrato, PIB, mandato y subtítulos.

## Orden obligatorio

1. Investiga con búsqueda/navegador; guarda fuentes primarias, fecha y evidencia en `research.json`. No inventes porcentajes, miembros, fronteras ni imágenes de archivo.
2. Escribe `assets/script.json` por segmentos `id`, `text`, `tone`, `intensity`. Un objetivo de siete minutos a 130 palabras/minuto ronda 900 palabras; mide el audio final y ajusta el guion. Respeta la duración solicitada, no rellenes con silencio.
3. Genera voz con `voice` (primero `--dry` si conviene), escucha la narración y revisa `song.qc.json`. Corrige omisiones y pronunciación antes de continuar.
4. Ejecuta `transcribe`. Sólo usa tiempos reales de `lyrics.json`; no inventes anclas ni generes una transcripción con tiempos estimados.
5. Compón `assets/scene.json`: cámara, looks, capas, datos citados y medios locales. Repite componentes cambiando entradas. Usa `add` o copia su `demo` al `target`; no leas ni modifiques el motor para el trabajo habitual.
6. Ejecuta `check --ready`, `prepare --fetch` y `prepare --verify` para **cada formato final**. El plan es conservador; el barrido de navegador verifica las teselas reales. El detalle vectorial tiene un paso separado.
7. Revisa visualmente fotogramas y una exportación corta; luego exporta el video completo. Comprueba resolución, audio, duración, legibilidad, correspondencia de cifras y créditos antes de declararlo terminado.

## Archivos y alcance

- Catálogo: [components.json](components.json). Reglas generales: [ESCENA.md](ESCENA.md). Casos especializados: [OVERLAYS.md](OVERLAYS.md).
- Guía y comandos: [PRODUCIR.md](PRODUCIR.md). Voz predeterminada: [voice.json](voice.json).
- Episodio: `index.html`, `info.json`, `research.json`, `PLAN.md`, `assets/{script,scene,config,lyrics}.json`, `assets/song.mp3`, `assets/media/`.
- `voice` usa Gemini TTS y requiere credenciales ya configuradas; nunca leas ni imprimas `.env`, tokens o cuentas. `transcribe` usa faster-whisper large-v3. Si faltan dependencias, informa cuál falta; no sustituyas resultados por datos simulados.
- No publiques en redes, no uses cuentas reales y no hagas commit/push salvo autorización del usuario. Generar o exportar voz/video sólo forma parte del flujo si el usuario pidió producirlo. Una petición de preparación o documentación no autoriza un render de demostración.
- Si sólo faltan datos, busca en las fuentes conectadas o la web. Si hay una decisión editorial sustancial que no puedas resolver con el pedido y las fuentes, consúltala y continúa el trabajo independiente.
