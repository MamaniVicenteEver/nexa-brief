# Piloto de Matemática: división explicada en 60 segundos

Fecha: 2026-09-19

## Objetivo

Validar que Academy pueda producir una lección de Matemática con una
estructura pedagógica distinta a Inglés, manteniendo el mismo flujo técnico:

```text
categoría y tema
  -> guion pedagógico
  -> voz TTS
  -> Whisper sobre el audio final
  -> subtítulos medidos
  -> contenido central por etapas
  -> render HyperFrames de 60 segundos
```

La lección piloto explica qué significa dividir, presenta `48 ÷ 6`, resuelve
la operación, comprueba el resultado y propone `35 ÷ 5` como práctica.

## Integración con el catálogo

Se agregó el tema `division` a la categoría `mathematics`, nivel
`primary-2`, con dos blueprints:

- Partes de una división.
- Resolver una división exacta.

El catálogo sigue siendo la fuente JSON del dominio. La plantilla visual y el
proveedor de voz se seleccionan después, desde la especificación de la
lección.

## Guion y voz

Proveedor: Novita AI.

Motor: Fish Audio S1.

Motivo: fue el motor de menor coste en la comparación de voces y es suficiente
para comprobar el flujo educativo.

- Caracteres: `717`.
- Duración real del audio: `53.864 s`.
- Coste estimado: `USD 0.01075`.
- Video final: `60.000 s`.
- Cierre visual sin narración: aproximadamente `6.136 s`.

El audio se encuentra en:

`nexa-academy/nexa-academy-hyperframes/assets/mathematics-division-60s.mp3`

## Timing medido por Whisper

Se utilizó `faster-whisper large-v3`, CPU `int8` y `vad_filter=true`. Whisper
detectó ocho segmentos y 106 palabras. Para mantener la lectura legible, el
último segmento se dividió en cinco grupos de palabras usando sus timestamps,
sin estimar la velocidad.

| Ventana | Inicio | Fin | Contenido |
|---|---:|---:|---|
| 1 | 0.000 | 3.100 | Introducción |
| 2 | 3.580 | 7.940 | Significado de dividir |
| 3 | 7.960 | 12.100 | Dividendo |
| 4 | 12.660 | 16.280 | Divisor |
| 5 | 16.480 | 18.900 | Cociente |
| 6 | 19.500 | 23.520 | Presentación de `48 ÷ 6` |
| 7 | 24.280 | 27.260 | Pregunta del ejemplo |
| 8 | 27.260 | 33.620 | Resolución y residuo |
| 9 | 33.960 | 39.620 | Comprobación |
| 10 | 40.120 | 43.580 | Nueva práctica |
| 11 | 43.940 | 48.960 | Resultado de `35 ÷ 5` |
| 12 | 49.700 | 53.280 | Regla de cierre |

El manifiesto completo con segmentos y palabras está en:

`nexa-academy/nexa-academy-hyperframes/assets/mathematics-division-60s.transcript.json`

## Etapas visuales

La composición `mathematics-division.html` usa cuatro tarjetas centrales:

1. `DIVISIÓN`: repartir en grupos iguales y reconocer sus partes.
2. `48 ÷ 6`: plantear la pregunta del ejemplo.
3. `48 ÷ 6 = 8`: mostrar la resolución y la comprobación `6 × 8 = 48`.
4. `35 ÷ 5 = 7`: dejar una práctica concreta al estudiante.

La banda inferior muestra subtítulos separados en las pausas reales. La tarjeta
central y el subtítulo se actualizan con el mismo reloj de audio medido por
Whisper.

## Validación

HyperFrames confirmó:

- duración de 60 segundos;
- resolución 1920x1080;
- video H.264;
- audio AAC;
- runtime correcto;
- layout sin problemas;
- contraste aprobado en 26 comprobaciones.

El render está en:

`nexa-academy/nexa-academy-hyperframes/renders/mathematics-division-60s.mp4`

## Conclusión

La misma arquitectura permite que Inglés y Matemática tengan familias visuales
y estructuras pedagógicas diferentes sin duplicar el sistema de generación:
ambas usan el catálogo, `VoicePort`, Whisper, el manifiesto de timing y el
renderizador. Lo que cambia es la especificación de la lección y la plantilla
de la categoría.

La siguiente mejora será hacer que `LessonRendererPort` reciba directamente
los `reading_cues` y genere los atributos de tiempo de cualquier plantilla,
para no tener que actualizar manualmente un HTML de piloto.
