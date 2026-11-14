# Revisión adversarial: Imperio cinematográfico

2026-11-14 · Alcance: cambios de identidad, aperturas, paletas, captura de miniaturas y música de este pedido. No se revisaron ni atribuyeron los demás cambios previos del checkout.

## Hallazgos corregidos durante la revisión

1. **C podía pasar el nuevo checker sin imagen.** El checker admitía la foto de B como respaldo mientras `opening_specs` no la usaba si existía un bloque C sin imagen. Se armonizó la validación con el comportamiento real: C explícita necesita su propia foto existente. La regresión del caso rechaza C sin imagen aunque B sea válida.
2. **El agente aislado no conocía IDs de música.** El contrato ahora admite `music_asset_id: "auto"` y `mood`; el host resuelve dentro de la biblioteca del perfil activo. La selección exige instrumental, licencia/procedencia/hash y duración suficiente; no se incorporó un ID privado al motor compartido.
3. **Un stem musical de FFmpeg podía salir truncado con código de éxito.** Se detectó en la prueba de suma real, se añadió la comprobación de duración y se cambió a una salida por proceso: bus musical con ducking/limitador y suma posterior de voz+SFX sin comprimir esas fuentes. Los archivos solo se seleccionan tras comprobar el master y el stem. El motor de mezcla forma parte de la identidad de caché.
4. **Faltaban garantías para remixes concurrentes y archivos dañados.** CLI y host comparten bloqueo por episodio; el caché valida voz, SFX, música y hashes de master, stem, reproducción y créditos. Un cambio o daño obliga a reconstruir; la mezcla anterior no se usa como voz.
5. **Las miniaturas móviles A/B eran sustituidas por una composición genérica.** `thumbnail.py` mantiene ahora las aperturas nativas de Imperio; conserva las rutas de otros diseños. El registro de componentes, sus contratos y QUICK se regeneran desde la misma implementación.

## Comprobaciones independientes

- Pruebas Node de paletas, aperturas y delegación de piezas: 9 aprobadas. La prueba adicional de footage aprobó primer cuadro, bucle y liberación de recursos.
- Regresión de `test_tabloid_layout.py` y `test_tabloid_capture.py`: 13 aprobadas, con una advertencia deprecada de Pillow ajena al comportamiento del cambio.
- Narrativa y audio: suite combinada de 32 pruebas aprobada antes de la última sustitución del bus musical; la validación definitiva del bus y sus repeticiones se registra abajo.
- Se inspeccionaron las imágenes A/B/C en ambas orientaciones y C móvil individual: mapa completo en A, fotografía visible en B/C, carmesí editorial y texto sin cortes ni solapes observados.
- Se revisó el paso de `flagColors` a campaña/archivo y el fallback neutro de país desconocido. Los hex cortos se normalizan y los valores históricos explícitos no se sustituyen por la paleta actual.
- `cmd_manifest` aplica solo el plan declarado de Imperio, antes de finalizar; un fallo de música impide marcarlo listo. El contexto privado recibe QUICK con identidad estable y contrato declarativo; la voz del diseño no cambia.
- Sintaxis Python y JavaScript comprobada. Los navegadores de las pruebas de esta revisión finalizaron; no se reiniciaron servicios ni se grabó/publicó video.

## Límites

Esta revisión técnica no constituye una nueva investigación del episodio ni una escucha humana de todo el audio. Se preservó la voz existente; no se regeneró TTS para este trabajo. Las muestras de recursos son breves y no demuestran ausencia de fugas de larga duración. Consumo de tokens y coste del revisor: sin dato.

## Cierre

Revisión técnica aprobada tras corregir los hallazgos. No quedan bloqueos funcionales abiertos en el alcance revisado.

Validación final de música comunicada por su autor: suite completa 5/5 y dos tandas de cinco repeticiones del test de mezcla (30 renders en total). La segunda tanda comprueba señal al final del cue, además de suma, duración, caché, reparación de salida dañada y cambio de SFX. La selección automática filtra duración suficiente.

La hoja definitiva del episodio (seis miniaturas A/B/C, 16:9 y 9:16) fue inspeccionada: A conserva el mundo, B su fotografía y C muestra 37 DÍAS y GUERRA en carmesí sin cortar al sujeto. El autor de aperturas informa suite final Node 10/10 y captura/thumbnail 5/5. Los resultados de audio no sustituyen una escucha editorial completa.

Evidencia final del audio real comunicada por el autor: `assets/music-design/69950f957295b84bad89/mix.wav`, 384,029833 s, residual máximo de `master − voz − SFX − música` = 1,1920929 × 10⁻⁷, señal al final de los cinco cues y silencio musical entre 277–320 s (pico 0). Informe medido: `work/results/test/music-verification.json` del episodio. Las fuentes originales y sus hashes permanecen intactos. No se ampliaron las pruebas al comenzar una grabación ajena.

Último ajuste revisado por lectura: `style_media_policy.py` trata `imperio.campaign` sin `plates` como lista vacía de apoyos documentales. De ese modo sus alias de banderas `f1/f2` no se confunden con fotografías, y los recursos `p1/v1` solo cuentan cuando una plate los hace visibles. La rama conserva el cálculo y la validación de las plates declaradas; otras piezas mantienen su recorrido. El test `test_campaign_no_cuenta_banderas_como_fotografia_documental` cubre la campaña de 20 s con un SVG de bandera y ninguna foto. El orquestador informa 12 pruebas de apertura/apoyos y `kit check` aprobados. Se mantiene la aprobación; no se ejecutaron nuevas suites ni navegadores durante la grabación ajena.
