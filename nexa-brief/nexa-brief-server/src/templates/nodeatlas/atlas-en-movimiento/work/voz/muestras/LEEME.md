# Muestras Malvinas · perfil B

**Recomendación provisional: Algenib procesada.** Es la que más se acerca al ritmo, tesitura y variación tonal pedidos. La receta añade el color previsto y acerca el volumen a −16 LUFS. La elección queda para tu escucha: las medidas no acreditan edad percibida, aspereza agradable ni emoción. No hice una evaluación auditiva subjetiva.

Se hicieron **exactamente dos peticiones**, una por voz, con `gemini-3.8-flash-tts`; ambas exitosas, sin reintentos, rotación tras errores ni cambio de modelo. Se generaron 15,68 s y 14,44 s, **30,12 s en total**. No se generó la narración completa. [Consumo registrado](consumo.json). El proveedor no devolvió datos de tokens; el coste monetario es desconocido.

## Qué escuchar

Las cuatro comparaciones son MP3 mono de 192 kbps. «Crudo» significa sin la receta de color; el kit ya normaliza su volumen. Los WAV conservan la salida original del TTS, sin esa normalización.

| Archivo | Qué evaluar |
|---|---|
| [Algenib crudo](malvinas-algenib.mp3) | Textura propia, registro grave y claridad de «Vulcan», «Étendard» y «Sheffield». Comprobar que la ronquera no borre consonantes. |
| [Algenib procesado](malvinas-algenib-fx.mp3) | Si la EQ, saturación suave y sala breve dan cuerpo sin sonido metálico ni cola molesta. Mi primera opción para escuchar. |
| [Orus crudo](malvinas-orus.mp3) | Firmeza y dicción; decidir si su variación tonal resulta demasiado amplia para el veterano contenido. |
| [Orus procesado](malvinas-orus-fx.mp3) | Si el color añadido aporta cuerpo o exagera la interpretación; compararlo con Orus crudo. |

Fuentes originales: [Algenib WAV](malvinas-algenib.wav) y [Orus WAV](malvinas-orus.wav), PCM de 24 kHz, 16 bits, mono. Los MP3 crudos están a 44,1 kHz y los procesados a 48 kHz, según sus herramientas de origen.

Escuchá cada pareja al mismo volumen percibido: el procesado está **0,77 LU más alto en Algenib y 0,62 LU en Orus**. Esa diferencia puede favorecerlo. Primero compará textura dentro de una voz; después, las voces entre sí. En la última frase buscá un endurecimiento breve, seguido de descenso en «Exocet», sin arenga. No se añadieron respiraciones externas, música ni efectos de guerra.

## Texto idéntico de las dos peticiones

> Desde Ascensión, un Vulcan bombardea la pista de Stanley. Una bomba daña la pista, sin inutilizarla por completo. Super Étendard argentinos alcanzan al Sheffield con un Exocet.

Son **27 palabras, tres frases**, tomadas de m03 y m04. [Guion de muestra](script.muestra.json) y [texto/dirección enviados](chunks.muestra.json). Las marcas piden pausa larga antes de cada bloque y pausa corta entre las primeras dos frases; no forman parte del texto hablado. Whisper large-v3 local recuperó las 27 palabras de ambas voces sin diferencias normalizadas y sin palabras de duración menor de 20 ms. [Algenib](transcripcion-algenib.json) · [Orus](transcripcion-orus.json). Esto no sustituye la escucha, especialmente en nombres propios.

## Medidas y comparación con B

PPM de narración excluye los márgenes acústicos inicial/final e **incluye las pausas internas**. PPM de archivo incluye todo el audio decodificado. No se aceleró ni ralentizó ningún archivo.

| MP3 | Duración decodificada | PPM archivo / narración | F0 mediana; p10–p90 | Amplitud tonal | LUFS integrados | Pico verdadero |
|---|---:|---:|---:|---:|---:|---:|
| Algenib crudo | 15,68 s | 103,3 / 107,4 | 92,1 Hz; 72,2–116,6 Hz | 8,31 st | −17,12 | −1,71 dBTP |
| Algenib procesado | 15,66 s | 103,4 / 107,3 | 91,9 Hz; 72,6–117,3 Hz | 8,31 st | −16,35 | −1,76 dBTP |
| Orus crudo | 14,44 s | 112,2 / 116,1 | 115,1 Hz; 83,0–161,7 Hz | 11,54 st | −17,05 | −1,75 dBTP |
| Orus procesado | 14,38 s | 112,7 / 116,1 | 114,8 Hz; 82,8–162,2 Hz | 11,64 st | −16,43 | −1,75 dBTP |
| Objetivo B | Muestra ≤20 s | Narración 100–115 | Mediana 90–115 Hz | 6–9 st | −16 | ≤−1,5 dBTP |

Algenib cae dentro de los tres objetivos principales de ritmo y tono. Orus queda apenas por encima del ritmo y tiene mayor excursión tonal. La receta conserva prácticamente esos valores; su aporte es el color y el master. Ambos procesados quedan a menos de 0,5 LU del objetivo, sin alcanzarlo exactamente. Los crudos quedan aproximadamente 1 LU por debajo. Todos los picos cumplen el límite. Los WAV originales miden −19,97 LUFS / −2,71 dBTP en Algenib y −19,22 LUFS / −1,67 dBTP en Orus.

Pausas acústicas internas, umbral −40 dBFS y mínimo 120 ms; se unen fragmentos separados por hasta 40 ms:

| MP3 | Pausas; mediana | Pausas de 700–1100 ms | Articulación aproximada sin silencios |
|---|---:|---:|---:|
| Algenib crudo | 5; 574 ms | 1 de 885 ms; 3,98/min | 132,9 ppm |
| Algenib procesado | 5; 572 ms | 1 de 884 ms; 3,98/min | 132,6 ppm |
| Orus crudo | 4; 508 ms | 1 de 947 ms; 4,30/min | 136,8 ppm |
| Orus procesado | 4; 508 ms | 1 de 947 ms; 4,30/min | 136,6 ppm |

La articulación aproxima el objetivo de 130–150 ppm. La tasa de pausas largas ronda 4/min, pero solo hay **un evento por muestra**: no valida el comportamiento de un minuto completo. La pausa larga aparece después de «Stanley». Antes de «Super Étendard» hay unos **572–574 ms**, menos que los 700–1100 ms solicitados. La marca no garantizó su duración. La coma después de «pista» produce unos 625–635 ms en Algenib y 441–442 ms en Orus: ambas superan los 180–300 ms pedidos. El primer punto deja aproximadamente 884–885 ms y 947 ms, respectivamente: supera los 350–600 ms de un punto ordinario.

Los huecos entre palabras de Whisper dan solo tres pausas por voz: Algenib 540/120/340 ms y Orus 500/200/520 ms. Sus tiempos absorben parte del silencio en la palabra siguiente; por eso se mantienen como evidencia separada y se usa el detector acústico para la comparación anterior. Tampoco ese umbral distingue siempre una pausa de una consonante débil. **No hay conteo confirmado de respiraciones o suspiros**, ni comprobación perceptual del énfasis de +2–4 st / +2–3 dB.

F0: Praat por autocorrelación, 60–400 Hz, paso 10 ms. Se informa el rango robusto p10–p90, sin corregir octavas a mano. Con otra búsqueda de 75–500 Hz, el desacuerdo mayor de nueve semitonos fue 4,69 % / 10,27 % en Algenib crudo/procesado y 1,03 % / 5,20 % en Orus. La aspereza y el procesamiento dificultan el seguimiento: los valores orientan, no son una certificación de tesitura. No se trasladaron tiempos de estas muestras a las anclas de la narración completa.

## Guion completo preparado y pendientes

[script.malvinas.vet.json](../../../assets/script.malvinas.vet.json) conserva las **104 palabras, siete bloques, hechos, fechas y diez anclas originales**. Añade un ancla a la segunda frase de m02: once frases, once anclas. Incluye la dirección B exacta y cuatro marcas largas antes de m03, m04, m06 y m07; separa impacto y hundimiento del Atlantic Conveyor. La selección de voz sigue pendiente.

Estimación del relato: **54,3–62,4 s a 100–115 ppm**. Para 56 s hacen falta 111,4 ppm. Se preparó sin los 1,2 s de apertura y 6 s de cierre del kit: con esos márgenes daría 61,5–69,6 s. No hay duración medida del guion completo.

Queda escuchar y elegir voz/tratamiento. Para una futura narración completa, conviene revisar la ubicación y duración de las pausas, confirmar el carácter maduro y áspero, y resolver el margen visual de cierre. Generar esa narración requiere la decisión posterior prevista en el brief. No quedan peticiones disponibles en este encargo.

Datos completos: [mediciones](mediciones.json), [validación del guion](validacion-guion.json), [consumo](consumo.json) y recetas efectivamente aplicadas [Algenib](malvinas-algenib-fx.mp3.fx.json) / [Orus](malvinas-orus-fx.mp3.fx.json). Los logs de FFmpeg están junto a los audios. [Generador acotado](generar.py.txt) ejecutó `tools/narrate.py` con ajustes solo en memoria: chunks B, un único intento HTTP, `--parts 1 --lead 0 --tail 0 --no-qc`. Su ledger bloquea nuevas peticiones. [Medidor local](medir.py.txt): Whisper CPU int8 con dos hilos y Praat/FFmpeg en secuencia. Dependencia Praat instalada en `/tmp/voz-malvinas-libs`; no se modificó el entorno del servidor.

Toda tarea pesada corrió con `nice -n 15`, una por vez. Se aplicó `work/voz-ref/fx-veterano.sh` sin modificarlo y sin manifest de respiraciones. No se editaron lanzadores, scripts en ejecución, herramientas del kit ni el guion original.
