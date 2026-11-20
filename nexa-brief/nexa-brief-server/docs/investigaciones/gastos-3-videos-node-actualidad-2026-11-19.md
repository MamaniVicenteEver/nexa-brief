# Gastos de producir 3 videos de Cara a Cara (node_actualidad) solo con Claude

Fecha: 2026-11-19. Trabajo hecho en el chat con Claude Sonnet 5.5, sin Codex ni subagentes. Estado de los tres: listo para grabar, sin grabar ni publicar, sin commit.

## Resumen para decidir
- Lo medido por el servidor fue pequeño: voz de Gemini con 10,161 tokens en total (1,381 de entrada y 8,780 de salida) y unos 10.9 minutos de Whisper local.
- Lo que más costó, y no se puede medir desde dentro: los tokens de Claude (investigación, guion, plan de planos y revisión). Va por suscripción y el servidor no los registra: **sin dato**. No invento cifra.
- Tiempo real: unos 55 minutos de reloj para los tres, con trabajos en paralelo y esperas por límites de Wikimedia (429) y por Whisper.
- Comparativa honesta: no hay medición del flujo con Codex en estos mismos temas, así que no afirmo cuál es más barato.

## Medido en el servidor (logs/videos/<id>/usage-*.jsonl)
| # | Video | Personaje | Duración | TTS entrada | TTS salida | TTS total | TTS seg | Whisper seg |
|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | Voyager 1 y Voyager 2: dos gemelas, una llegó a un día luz | Leo (voz Puck, ritmo 0,9) | 1:57 | 478 | 2606 | 3084 | 17.2 | 277.3 |
| 2 | Nobel de Física 2026: el telescopio hecho con hielo de la Antártida | Nara (voz Sulafat) | 2:01 | 459 | 2998 | 3457 | 28.9 | 194.1 |
| 3 | COP31 en Antalya: qué se negocia y por qué se atasca | Nara (voz Sulafat) | 2:08 | 444 | 3176 | 3620 | 31.8 | 179.9 |
| | **Total** | | | **1381** | **8780** | **10161** | **77.9** | **651.3** |

Notas: la tarifa de gemini-3.8-flash-tts no está en el servidor, así que el dinero queda sin dato. Whisper corre en local: sin coste de API (usa RAM y CPU). El control de calidad de la voz también usa Whisper y no se registra aparte.

## Búsquedas y descargas (conteo aproximado de la sesión)
- Búsqueda de temas y verificación: unas 16 búsquedas web y 17 lecturas de páginas (6 con error 403: nobelprize.org, ENB, Smithsonian).
- Medios: 36 descargas con licencia registrada (10 + 12 + 14), de Wikimedia Commons, biblioteca de imágenes de NASA y Pexels. Wikimedia limitó el ritmo (429) porque otra sesión descargaba a la vez; las banderas se resolvieron con Pexels.
- Modelos de texto de terceros (Codex, DeepSeek, Gemini texto): 0.

## Recursos del servidor
Los tres episodios pesan 89, 62 y 41 MB en el perfil (los clips verticales de Pexels son los más grandes). El servidor tuvo la memoria casi llena (10,4 de 11,3 GB) porque otra sesión corría Whisper al mismo tiempo; no hubo cortes.

## Qué le falta a cada video antes de grabar
Ver INFORME.md dentro de cada carpeta. Lo más importante: COP31 depende del cierre del 20/11; Voyager conviene comprobarlo en la página de NASA por el dato no corroborado del 14/11; Nobel confirmar en nobelprize.org y decidir sobre 3 fotos CC BY-SA.

## Aviso sobre el video ya existente de Voyager
El video "Voyager 1: cuando un mensaje tarda un día en llegar" (c30fdef2f59a46ffaa749abb59739051) dice que el hito "todavía no ha ocurrido". Desde el 18/11/2026 ya ocurrió (comunicado de JPL del 19/11): ese video quedó desactualizado.
