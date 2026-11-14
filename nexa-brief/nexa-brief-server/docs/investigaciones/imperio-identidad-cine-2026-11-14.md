# Imperio: identidad cinematográfica y dirección reutilizable

2026-11-14 · servidor `alfrred-server` · perfil `profesional` · ejemplo `guerra-1914-julio`

## Alcance y límites

**Último parche pendiente de aplicación:** la comprobación antigua de cifras trata el «0» de la URL de licencia y el «90» del nombre de montaje como cifras que debería decir la voz. El crédito público correcto se conserva. El parche `atribucion-cifras.patch` está preparado y pasó seis pruebas aisladas; no se aplicó porque hay cuatro producciones activas dependientes de la API y editar ese backend la recarga. Se solicitó autorización para esa recarga o esperar su final.

Se mejoraron el generador de guiones, el diseño compartido, sus contratos y el cierre de audio. El ejemplo de 1914 recibió aperturas, paletas históricas y música. **Su narración ya grabada no se reescribió ni se regeneró**: la nueva escritura cinematográfica se aplica a las siguientes generaciones, conservando el locutor del diseño.

No se añadieron nuevos golpes de sonido a las marcas: la biblioteca aprobada contiene orugas, avión y marcha, sin golpes, papel o clics pertinentes. Se conservaron sus ambientes de marcha existentes. La comprobación de audio cubre duración, señal, suma y picos; no sustituye una escucha editorial completa, que no se realizó. No se generó MP4 ni se publicó.

## Cambios entregados

- Identidad central `imperio-narrador-cinematico-v1` en `designs/imperio/design.json → editorial`, incorporada por el generador a `QUICK.md`, que el host entrega al agente aislado. Narrador grave, próximo, curioso y preciso; apartes breves y naturales, acciones y decisiones con consecuencias, sin tono escolar ni pensamientos inventados. Se conserva Charon.
- Nueva estrategia `narrative_cinematica_v1`, predeterminada para `node_atlas`. Otros defaults y las selecciones explícitas permanecen vigentes. El guion avanza por acción, contexto, escalada, giro, clímax, coste humano y pregunta.
- A / `imperio.introv1`: letras sobre el mapa mundial completo, compartido con el outro, sin bandera, sol ni rayos. B / `imperio.introv2`: composición nativa de texto y foto, palabra roja y recorte configurable. C / `common.tabloid`: foto y titular crema sobre tinta oscura, palabra carmesí y dato visible también en móvil. No existe un componente independiente `imperio.introv3`.
- La captura móvil conserva A/B nativas en Imperio. Se eliminó la sustitución por otra composición y la reducción a cuadrado que producía el fallo.
- Campaña y archivo respetan la paleta del país. `map/sun/rays/archive` usan `flag`; `campaign/footage/country/flag` usan `flagColors`. `auto` usa paleta actual, `neutral` una marca sin nacionalidad y una lista hex declara una paleta histórica verificada. Alemania de 1914 toma negro/blanco/rojo de su SVG existente. El rojo editorial del titular es independiente.
- Se corrigieron alias de países, hex cortos y el fallback para país desconocido. Un país desconocido ya no adquiere por defecto el carmesí japonés. Una bandera SVG ausente no se sustituye por una falsa bandera roja.
- B/C sin foto o titular se rechazan. C debe tener su propia foto cuando existe su configuración; no puede aprobarse tomando prestada una foto que solo el render de B usa. Las banderas de campaña no se cuentan como fotografías documentales.
- `imperio.footage` realiza un solo seek de video por cuadro y libera la referencia al cerrar; su poster vuelve a generarse correctamente.

## Música reutilizable

El agente aislado escribe `work/music-plan.json`. El host aplica el plan al ejecutar `kit.py manifest`, con el helper compartido `tools/cinematic_audio.py`. Cuando la música requiere atribución, el host la sincroniza en `credits` y en el comentario fijado estructurado; respeta su límite de 420 caracteres y falla con un mensaje concreto si no cabe, sin truncar enlaces ni sustituir el texto editorial. Puede declarar un recurso real o `music_asset_id: "auto"` y un tono (`cinematic`, `tension`, `suspense`, `drama`, `epic`, `reflective`). La selección automática comprueba biblioteca, procedencia, licencia, carácter instrumental y duración; el reporte conserva el ID resuelto. La ausencia de candidata válida produce un error concreto.

La mezcla parte de voz limpia + stem SFX original + stem musical. No usa el master anterior como voz. Comprueba hashes de entradas y salidas, reutiliza resultados válidos y coordina accesos simultáneos. Se resolvió un corte intermitente de stems de FFmpeg usando una salida por proceso y validando también señal tardía del cue.

En el ejemplo se reutiliza **Undaunted**, Kevin MacLeod, CC BY 4.0, con ficha y licencia existentes en el perfil. Se reparte en cinco tramos: 0–30, 66–143, 145–212, 214–270 y 323–363 s; con ducking, fundidos y silencio musical deliberado en el pasaje de víctimas. El crédito queda en los datos estructurados y en el comentario fijado preparado; la descripción breve del sistema omite bloques y enlaces por su política previa.

- Recurso: `3d83eb32`, biblioteca musical del perfil; no se fija este ID privado en el motor compartido.
- Fuente: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400025
- Licencia: https://creativecommons.org/licenses/by/4.0/
- Resultado seleccionado: `assets/music-design/69950f957295b84bad89/song-with-outro.mp3`.
- Master, stem, plan y créditos se conservan en esa misma carpeta.
- Voz limpia: `assets/song-with-outro.mp3`.
- Duración exacta: **384,029833 s**. Residual máximo `master − voz − SFX − música`: **1,1920929 × 10⁻⁷**. Silencio musical 277–320 s: pico cero.

## Validación

- Motor Imperio: 10 pruebas Node aprobadas, incluidas paletas, aperturas, propagación de parámetros y un seek por cuadro.
- Narrativa, contexto, aperturas y audio de apoyo: 38 pruebas aprobadas; después se añadió el caso de banderas gráficas y se comprobaron 12 pruebas de aperturas/apoyo sin fallos.
- Layout y captura tabloid: 13 pruebas aprobadas; captura nativa móvil y regresiones: 5 aprobadas.
- Helper musical: 6 pruebas completas aprobadas tras añadir crédito público; 30 mezclas sintéticas repetidas sin truncación tras la corrección, con comprobación de señal hasta el final de los cues.
- `kit.py check guerra-1914-julio`: **OK**. Conserva avisos de dirección sobre planos largos, repeticiones y variedad visual del episodio previo; no se presenta como una nueva auditoría editorial completa.
- `kit.py manifest`: **listo**, 384,03 s, 62 beats; segunda ejecución reutiliza la mezcla válida.
- `publishing check`: pasó con **0 errores y 0 avisos** antes de incorporar la atribución pública. Tras incorporarla conserva **un falso positivo de cifras musicales (0/90)**; el parche pendiente lo corrige. No se presenta la validación final como aprobada hasta aplicarlo.
- Se revisaron visualmente seis miniaturas reales A/B/C en 16:9 y 9:16. Se generaron los seis posters afectados, sin una cola permanente ni un motor por tarjeta. También se revisaron paletas de Alemania actual, Alemania de 1914 y Francia en los dos formatos, con movimiento y sin errores de navegador.
- Revisión técnica independiente: `docs/investigaciones/imperio-cinematico-revision-2026-11-14.md` en el servidor.

## Puerta de calidad

1. **Relleno:** la nueva identidad prohíbe fórmulas genéricas y exige avance por segmento. No se ha certificado de nuevo toda la escritura histórica ya grabada.
2. **Cifras:** no se añadieron cifras históricas; se reutilizan el guion y el ledger del episodio para «37 días», «dos disparos» y «cinco potencias». No hubo una nueva investigación histórica completa.
3. **Medios:** B usa el archivo existente de Sarajevo; C, el retrato acreditado de Guillermo II de 1909, sin presentarlo como fotografía del atentado ni como una causa única. Se retiró el cartel cargado de letras de C.
4. **Texto:** A/B/C revisadas en ambos formatos, sin cortes o solapes detectados; palabra roja y dato visibles.
5. **Miniaturas:** revisadas en pequeño y en tamaño completo. La foto de C comunica un sujeto reconocible.
6. **Créditos:** se reutilizan los créditos originales; se añadió la música con autor, fuente, licencia y adaptación por recorte/fundidos.

## Recursos y consumo

Los trabajos ajenos del servidor se conservaron. No se reiniciaron servicios ni se modificó Python del backend fuera de `src/templates/`; el único parche que requiere esa recarga queda separado y revisable. Los navegadores y procesos de prueba propios se cerraron.

Medición final de capturas: 5.151 MiB disponibles, sin navegadores propios abiertos; otras producciones continuaron activas.

Medición inicial: 5.835 MiB disponibles; swap 4.014/4.095 MiB. El helper de audio usó aproximadamente 76 MiB RSS y FFmpeg 54 MiB en la muestra registrada. La disponibilidad varió con otras producciones y una grabación ajena; no se atribuye esa variación a una fuga de este cambio. Las verificaciones fueron acotadas; no se realizó una prueba prolongada de fugas.

| Pasada | Modelo | Trabajo | Tiempo total | Tokens |
|---|---|---|---|---|
| Orquestación | Codex, sesión actual | Criterio editorial, identidad, paletas, validación y entrega | Sin dato | Sin dato |
| Aperturas | Codex, sesión delegada | Implementación, capturas, contratos y posters | Sin dato | Sin dato |
| Audio | Codex, sesión delegada | Plan, helper, integración y medición | Sin dato | Sin dato |
| Revisión | Codex, sesión delegada | Revisión adversarial técnica y visual | Sin dato | Sin dato |

No se realizaron llamadas nuevas a TTS ni a modelos de los servicios del pipeline para producir contenido. No hubo búsquedas ni descargas externas de recursos; se reutilizaron biblioteca e investigación existentes. Coste monetario de esta sesión: sin dato.

## Ubicaciones permanentes en el servidor

Raíz: `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/`.

- Guía: `src/templates/_tools/explainer-kit/guides/imperio-production.md`.
- Identidad y QUICK: `src/templates/_tools/explainer-kit/designs/imperio/`.
- Narrativa: `src/skills/explainer/strategies/narrative/narrative_cinematica_v1.json` y `_active.json`.
- Cierre musical: `src/templates/_tools/explainer-kit/tools/cinematic_audio.py` y `kit.py`.
- Episodio: `/home/alfred/.local/share/nexa-brief/profiles/profesional/productions/nodeatlas/guerra-1914-julio/`.
- Evidencia musical: `work/results/test/music-verification.json` del episodio.
- Miniaturas: `assets/thumbnails/` del episodio.

Las instrucciones reutilizables viven en el motor y sus guías; cada video conserva datos, medios y planes. No se copian prompts editables ni motores por episodio. No se hizo commit ni push.
