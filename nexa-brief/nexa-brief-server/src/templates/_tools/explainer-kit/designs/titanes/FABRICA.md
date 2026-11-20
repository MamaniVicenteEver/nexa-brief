# Fábrica TITANES: siguiente video

TITANES es `node_economy`, diseño `titanes`, canal TITANES y voz Alnilam. Antes de producir, leer [CALIDAD](../../../../../skills/CALIDAD.md), [produce](../../../../../skills/explainer/produce/SKILL.md), [QUICK](QUICK.md), [diseño](DESIGN.md) y [capas](../../capas/README.md). Los comandos siguientes parten de `nexa-brief-server/`; `ID` y `TITULO` son valores del nuevo episodio. Nunca trabajar sobre una demo ajena.

```bash
cd /home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief
source scripts/profile-env.sh
printf 'Perfil: %s\n' "$NEXA_PROFILE_DIR"
realpath "$NEXA_PROFILE_DIR"
cat "$NEXA_PROFILE_DIR/profile.json"
cd nexa-brief-server
K=src/templates/_tools/explainer-kit
ID=mi-video
EPISODIO="$NEXA_PROFILE_DIR/productions/nodeeconomy/$ID"
.venv/bin/python "$K/tools/kit.py" new titanes "$ID" --title "TITULO" --minutes 10
.venv/bin/python "$K/tools/kit.py" status "$ID"
```

Confirmar antes la ruta real, ID y `profile.json`; el episodio va en `productions/nodeeconomy/<id>/` del perfil, no en el repositorio. Comprobar el destino efectivo que informa la herramienta. No cambiar el perfil de un proceso ya iniciado.

**Política de producción TITANES:** `production-policy.json → style_policies.titanes`
manda sobre los apoyos generales. `titanes.foto` y `titanes.introv1/introv2` usan
`src` para el medio documental: foto visible 4–10 s, máximo dos usos por archivo,
y `shows`, `query` y `media_review` obligatorios en cada beat. Se mide hasta el
siguiente plano principal, el outro o el fin del audio. Para clips, el intervalo
visible es 8–16 s; no se exigen dos clips largos y las fotos con movimiento pueden
cubrir el material real. Se exige al menos un componente propio usado cuando aplica
el umbral general de duración. `figura` y `common.capas` son gráficos, no fotos;
no colocar fotos documentales en `figura`, pues el check no las contará ni pedirá
su revisión. Cada tercio necesita foto o video real, `common.capas`, o
`titanes.cifra`, `titanes.bolsa` o `titanes.plantilla` con `figura`.

Para evitar diapositivas, el check marca error si más del 12 % de los beats
principales anteriores al outro son solo texto, o si aparecen más de dos seguidos.
Cuenta `titanes.titular` salvo variantes `documento` y `cita`, `titanes.duelo`
sin métricas y `titanes.introv1` sin figura ni foto. El resultado automático no
sustituye la revisión visual de composición, pertinencia y licencias.

1. **Tema e investigación.** Anotar la fecha actual y buscar específicamente los últimos 12 meses. Guardar `research.json` y `research.md`: origen, presente, personas, hitos, contexto y controversias; por cifra dos fuentes independientes, una primaria, con URL, fecha del dato y consulta. Registrar desacuerdos y descartes, fuerza 1–5 y actualidad. Elegir hallazgos fuertes; no usar una cifra no resuelta. `PLAN.md` fija ángulo, punto crítico y mapa visual. Registrar medios originales y licencias según `src/skills/MEDIOS.md`.
2. **Guion y paleta.** En `assets/config.json` establecer `narrative_id: "narrative_titanes_v1"` y `palette.accent` / `palette.rim` del protagonista. Mantener tinta, noche, hueso, oro y sangre del diseño; por ejemplo azul `#1F6BFF` y borde `#66D1FF` para IBM son una elección, no una obligación para otro tema. Escribir `assets/script.json` con el formato del kit, voz `Alnilam`, cifras en palabras y la estructura golpe, origen, ascenso, trono, grieta, caída o metamorfosis, presente y cierre. Cada acto avanza mediante personas, decisiones, riesgos y consecuencias; reenganchar cada 2–3 minutos. Revisar nombres y afirmaciones contra la investigación. Consultar el tamaño objetivo con `status`.
3. **Voz.** En el pipeline el agente entrega `work/phase.json` con `{"phase":"script_ready"}` y termina la corrida: el host genera voz, transcripción y cierre. Si cambia el guion, repetir ese handoff. Fuera del pipeline, tras comprobar que no existe una voz activa ni lock ocupado:

```bash
.venv/bin/python "$K/tools/kit.py" voice "$ID" --background
.venv/bin/python "$K/tools/kit.py" voice "$ID" --wait --timeout 20
.venv/bin/python "$K/tools/kit.py" transcribe "$ID" --background
.venv/bin/python "$K/tools/kit.py" transcribe "$ID" --wait --timeout 20
```

Esperar si devuelve 2. Escuchar, revisar `work/narration.qc.json` (faltan, sobran y ritmo), contrastar discrepancias mediante recortes antes de regenerar, y comprobar pronunciación y marcas de `assets/lyrics.json`. El reconocimiento no sustituye la escucha. Objetivo de voz: 125–135 palabras/minuto.

**Alternativa manual cuando el guardián de memoria bloquea el trabajo combinado:** no bajar el umbral ni iniciar otra voz si un lock o proceso sigue activo; puede arrancar luego. Si el TTS ya fue autorizado y hay capacidad, `narrate.py --no-qc` genera en el servidor sin cargar Whisper; deja el QC pendiente. Transferir guion, `song.mp3`, `work/narration.wav` y `work/narration.qc.json` a otra máquina autorizada con el mismo kit, dependencias y faster-whisper large-v3, y efectuar allí el QC y la transcripción. No copiar credenciales. En estos ejemplos `EPISODIO` es la ruta real comprobada; la transferencia segura y su destino dependen de las máquinas disponibles.

```bash
.venv/bin/python "$K/tools/narrate.py" "$EPISODIO/assets/script.json" "$EPISODIO/work/narration" --design titanes --voice Alnilam --no-qc
cp "$EPISODIO/work/narration.mp3" "$EPISODIO/assets/song.mp3"
# En la otra máquina, con EPISODIO y K apuntando a las copias verificadas:
.venv/bin/python "$K/tools/transcribe.py" "$EPISODIO/assets/song.mp3" "$EPISODIO/assets/script.json" "$EPISODIO/assets/lyrics.json"
PYTHONPATH="$K/tools" .venv/bin/python - "$EPISODIO" <<'PY'
import json, pathlib, sys
import narrate
p = pathlib.Path(sys.argv[1]); q = p / 'work/narration.qc.json'
d = json.loads(q.read_text()); d.update(narrate.qc(json.loads((p / 'assets/script.json').read_text()), p / 'work/narration.wav'))
q.write_text(json.dumps(d, ensure_ascii=False, indent=2))
PY
```

Transferir `lyrics.json` y el QC de vuelta, cotejar hashes del guion y audio antes de usarlos, y revisar ambos. `transcribe.py` usa tres argumentos posicionales y no implementa `--help`. Esta vía manual no realiza el cierre automáticamente. Con voz y transcripción reales, aplicar una sola vez el cierre y comprobar `metadata.outro.start` respecto de la última palabra y `song-with-outro.mp3` con `ffprobe`:

```bash
.venv/bin/python "$K/tools/kit.py" outro "$ID"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$EPISODIO/assets/song-with-outro.mp3"
```

El cierre compartido Alnilam dura 4,48 s; escucharlo y revisarlo, junto con el intervalo de 1,2 s tras la última palabra. No confundir su existencia con aprobación humana.

4. **Storyboard.** Antes de elegir, ejecutar la lista cerrada y usar solamente IDs, poses, anclas, zonas y animaciones que devuelve. La aprobación técnica no resuelve derechos: muchos recursos tienen licencia desconocida. `common.capas` usa segundos en `eventos[].en`, no `@palabra` anidado. Anclar beats a palabras exactas de lyrics; consultar ejemplos de `QUICK.md` y `GUIA-PRODUCCION.md`, una idea por plano, máximo siete palabras simultáneas y composición en ambos formatos. Las fotos de personas deben ser de la persona nombrada.

```bash
.venv/bin/python "$K/tools/capas.py" list --json
.venv/bin/python "$K/tools/capas.py" scene-check "$EPISODIO/assets/storyboard.json"
.venv/bin/python "$K/tools/kit.py" check "$ID"
.venv/bin/python "$K/tools/kit.py" sheet "$ID" --orient both
```

Mirar ambas hojas y corregir cortes, solapes, medios y ritmo; completar `shows`, `query` y `media_review` por medio. No declarar listo sin revisión visual, fuentes y miniaturas de CALIDAD §7.

5. **Sonido.** Reutilizar música y efectos registrados con licencia; si se necesitan variantes, el sintetizador produce archivos locales, que deben registrarse y revisarse antes de usarlos:

```bash
.venv/bin/python "$K/tools/sfx_synth.py" /tmp/sfx-titanes
```

Con voz y storyboard definitivos preparar `work/sound-plan.json` y `work/music-plan.json`, elegir cortes musicales por frase, fundidos de 2–3 s y niveles por escucha. El servicio de efectos genera el stem desde la voz limpia; registrar su ruta en `soundDesign.effectsSrc` y conservar la voz en `audio.narrationSrc`. El procedimiento y ejemplos ejecutables están en [SONIDO.md](/home/alfred/codex/nexa-brief/titanes/sonido/SONIDO.md). Luego probar y escuchar la mezcla; solo tras revisarla repetir el comando con `--apply`:

```bash
.venv/bin/python "$K/tools/cinematic_audio.py" "$EPISODIO" --profile "$NEXA_PROFILE_DIR" --plan "$EPISODIO/work/music-plan.json"
```

6. **Licencias, paquete y render.** Ejecutar `check` otra vez tras cambios, y generar inventario y manifiesto:

```bash
.venv/bin/python "$K/tools/kit.py" check "$ID"
.venv/bin/python "$K/tools/kit.py" licencias "$ID"
.venv/bin/python "$K/tools/kit.py" manifest "$ID"
.venv/bin/python "$K/tools/kit.py" usage "$ID"
```

Revisar `LICENCIAS.md` y `licencias.json`, atribuciones, transformaciones y derechos adicionales; copiar créditos a la descripción. Licencia desconocida o bloqueada impide publicar; con CC BY-SA confirmar compatibilidad de todos los elementos y condiciones de la adaptación. El inventario automático no sustituye la decisión humana. Preparar títulos, descripción con capítulos, fuentes, créditos, miniaturas A/B y comentario según la estrategia de categoría y [paquete](../../guides/publish-package.md); comprobar el contrato efectivo de NodeEconomy antes de aplicar el flujo v2. La persona revisa y aprueba. Solo si solicita render:

```bash
.venv/bin/python "$K/tools/kit.py" render "$ID" --formats 16x9,9x16
```

**Catálogo del Showcase.** El Showcase v3 lee `_tools/design-definitions/titanes/`, no `designs/titanes/design.json`: editar el kit no cambia lo que se ve. Tras añadir componentes o poses de capas, regenerar el contrato desde nexa-brief-server y comprobar que `different` lista solo los dos archivos de TITANES:

```bash
.venv/bin/python scripts/export-titanes-showcase.py          # comprueba
.venv/bin/python scripts/export-titanes-showcase.py --write  # escribe design.json y catalog.json
.venv/bin/python scripts/generate_showcase_posters.py --design titanes --only-missing
```

Los personajes y las imágenes salen de `explainer-kit/capas/catalog.json`; los componentes de TITANES y los comunes que el diseño carga (`text.js`, `capas.js`), del registro del kit. `common.flash` y `common.tag` tienen miniaturas casi vacías porque son efectos de instante; el modal muestra la vista animada.

**Reutilización y costo.** El diseño, motor, capas aprobadas, voz de cierre y sonidos registrados son compartidos; investigación, guion, paleta, medios con derechos, voz, storyboard, mezcla y paquete cambian por video. Las ilustraciones de muestra tienen licencia sin acreditar. Un cierre ya generado se reutiliza; su generación inicial documentada consumió 18 tokens de entrada y 120 de audio, costo monetario sin dato. La voz de cada episodio, llamadas editoriales, investigación y recursos nuevos generan costo incremental variable: no hay tarifa ni total medido fiable para prometer por video. Registrar uso conocido y lo desconocido como sin dato.
