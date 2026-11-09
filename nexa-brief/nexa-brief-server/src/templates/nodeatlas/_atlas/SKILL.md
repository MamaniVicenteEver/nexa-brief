---
name: atlas-cinematico-produce
description: Producir videos de mapas 3D con el diseño Atlas Cinemático existente. Usar su catálogo JSON, investigar fuentes, preparar guion y voz, componer escenas por datos y validar mapas antes de exportar; no editar el motor para un episodio.
---

# Atlas Cinemático: producir con JSON

Usa este flujo cuando el usuario pida un video con **Atlas Cinemático**, el diseño MapLibre 3D del showcase. Es diferente de los antiguos diseños `atlas` del explainer-kit y `_mapas`.

## Entrada rápida

Desde `nexa-brief-server/`, define la ruta una vez:

```bash
A=src/templates/sandbox/nodehistory/_atlas/produce.mjs
node "$A" catalog
node "$A" example atlas.arrow
node "$A" new mi-video --title "Mi título" --duration 420
```

`new` crea `src/templates/nodehistory/mi-video/` con referencias relativas al único motor compartido. **No copies `_atlas/` ni desarrolles HTML para cada video.** No registres un episodio en `templates.json` (es un video de datos, no una nueva plantilla de NodeMotion).

Lee [PRODUCIR.md](PRODUCIR.md) para ejecutar el trabajo. Para elegir piezas lee [components.json](components.json), preferentemente filtrado por `catalog` y `example`. Los campos `target`, `params` y `demo` explican dónde insertar y qué entradas pasar. El `demo` es JSON listo para adaptar; sus cifras ilustrativas no son evidencia.

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
