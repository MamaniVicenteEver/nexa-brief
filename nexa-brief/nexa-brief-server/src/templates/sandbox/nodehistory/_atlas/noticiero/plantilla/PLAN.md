# {{TITULO}}

> Plantilla NOTICIERO (Atlas). Entrada: `_atlas/noticiero/AGENTE.md`. Este archivo se rellena en el paso 0 y se actualiza
> en cada puerta. Id: `{{ID}}` · fecha: {{FECHA}} · período cubierto: {{PERIODO}}.

## 1. Pedido (paso 0)
- Fecha de emisión: {{FECHA}} · ventana de noticias: <desde – hasta, en fechas>
- Duración objetivo: <≈ 2:30 por defecto: 14 segmentos ≈ 470 palabras a ≈180 ppm> · formatos: 9:16 y 16:9 (el mismo JSON)
- Número de noticias: <8–12> · orden: lo más importante primero; «Y para finalizar, otros titulares» al cierre
- Estilo visual: **original** (por defecto) · voz: perfil fijo (Charon · aceleración) · cierre visual: <1 = globo girando (por defecto) | 2 = cintillo + mensaje>
- Preguntas abiertas / supuestos: <...>

## 2. Noticias elegidas (paso 1) — cada una con ≥ 2 fuentes
| # | titular | hechos con cifra (id del ledger) | fuentes (URL + fecha) | personas con foto | lugares |
|---|---|---|---|---|---|

## 3. Guion (paso 2)
`assets/script.json` · palabras: <n> · segmentos: <n> · ritmo esperado ≈180 ppm (150–200)

## 4. Plan visual por noticia (paso 3)
| segmento | pieza | ancla de entrada | ancla de salida | foto / lugar |
|---|---|---|---|---|

## 5. Medios (paso 4)
| archivo | persona / cosa | fuente | licencia | estado |
|---|---|---|---|---|

## 6. Voz y transcripción (paso 5)
voz: Charon (gemini-3.8-flash-tts) · duración: <s> · ppm: <n> · WER: <n> · fallos: <...>

## 7. Resultado de `check.py` (paso 7)
<pegar salida: errores / avisos y qué se hizo con cada aviso>

## 8. Qué falta / no se pudo verificar
<empezar el reporte final por aquí>
