# Prueba de fuego · Codex produce 2 videos solo con AGENTS.md (2026-10-07)

**Agente:** Codex CLI 0.162 (`gpt-5.6-luna`, razonamiento xhigh), `codex exec` no interactivo,
sandbox `workspace-write` con red. **Entrada:** "leé `explainer-kit/AGENTS.md` y seguilo" y dos
pedidos en lenguaje natural:
- historia: el Titanic, los minutos entre el iceberg y el choque, y los botes;
- tecnología: Ariane 5 (1996), el número que no cabía.

**Tiempo:** 70 min para los dos videos, sin intervención humana.
**Resultado:** `nodehistory/codex-titanic` (listo) y `codex-ariane-501` (listo después de
que yo corrí la transcripción real; ver abajo).

## 1. ¿Siguió el proceso?

| paso | ¿lo hizo? | cómo |
|---|---|---|
| 1 crear carpeta | ✓ | `kit.py new` con id y título propios |
| 2 investigar + PLAN.md | ✓✓ | **mejor que el mío**: fuentes primarias (informes británico y estadounidense del Titanic, informe de la comisión del Ariane 501, ESA); 15–17 hechos con URL; aclara cifras que no coinciden entre fuentes; lista mitos a evitar |
| 3 guion | ✓ | 17 segmentos, 504–533 palabras, curva de intensidad correcta, clímax en el lugar justo |
| 3b medios | ✓ | `media.py search/get` (9 búsquedas por video), 5 fotos por video, licencias correctas, CREDITS.md completo |
| 3c componentes | — | no creó ninguno (no hacía falta) |
| 4 voz | ✓ | `kit.py voice`: Titanic en 1 pedido con el modelo completo (127 ppm); Ariane en 3 partes (142 ppm) |
| 5 transcripción | ⚠ | se puso un `timeout 180` a Whisper y, al no alcanzar (CPU compartida con mis renders), **usó tiempos sintéticos** en el Ariane; lo declaró honestamente. Al correr yo la transcripción real, su storyboard tuvo **1 sola ancla rota** (eligió anclas sin números: siguió la guía) |
| 6 storyboard | ✓ | 41–43 beats, `check` sin errores, overlays en orden |
| 8 revisión visual | ✓ | generó y "revisó" las hojas 9:16 y 16:9 |
| 9 publish + manifest | ✓ | completo |
| reporte final | ✓ | sigue la sección 6 de AGENTS.md |

**Conclusión del proceso:** el manual alcanza para que otro modelo produzca un video completo sin ayuda.

## 2. Calidad (comparado con los videos hechos por Claude)

| aspecto | Titanic | Ariane 501 |
|---|---|---|
| Gancho | ✓ "37 SEGUNDOS" gigante + pregunta abierta | ✓ "NO CABÍA" en lima; pero **repite la fórmula "37 segundos"** del otro video |
| Narrativa | rigurosa pero con tono de **informe** ("una regla de papel", "antes de que la tabla se volviera una emergencia"); unidades en yardas | técnicamente impecable pero con **jerga** (coma flotante de 64 bits, entero con signo, toberas) y sin protagonista humano; falta el dato que vende (el costo) |
| Errores de contenido | 1 frase con lógica invertida ("un bote vacío parecía más seguro que una cubierta…": era al revés) | ninguno detectado |
| Uso de componentes | coherente; buen uso de contadores (1.178 / 706) y fotos reales; **icono `waves` usado como "agua"** (son ondas de radio); foto del iceberg 2 veces; barco 3 veces | buen uso de `rough.load`, `rough.choice` ("SEGUIR RUMBO / CORREGIR GIRO"); **lima en casi todos los planos** (rompe "un acento por plano") |
| Letras grandes | 7 momentos (la guía dice 4–6) | 8+ momentos; algunos flojos |
| Voz | ✓ | ✓ |

**Nota global estimada:** ~75–80 % del nivel de los videos de referencia. Estructura, rigor y
uso de herramientas: excelentes. Lo que falta es criterio editorial (escribir para personas,
medir el texto gigante, variedad visual, semántica de iconos).

## 3. Carencias del sistema que salieron a la luz (y qué se cambió)

| carencia | arreglo aplicado |
|---|---|
| nada impedía repetir fotos/iconos o abusar del texto gigante | `check_storyboard.py` ahora avisa: >7 momentos de texto gigante, foto repetida, icono >2 veces, 3 componentes iguales seguidos |
| nombre de icono engañoso (`waves`) | icono `water` nuevo, alias `radio`, aviso en `guides/storyboard.md` |
| la guía no pedía "escribir para personas" | `guides/storytelling.md`: protagonista humano, jerga traducida a imágenes, unidades métricas, dato que vende, no repetir fórmulas de gancho, releer causalidades |
| transcripción cortada por timeout → tiempos sintéticos | `guides/voice.md`: cuánto tarda Whisper y prohibición de reemplazarlo por sintéticos |
| `rough.load` cortaba rótulos largos en 9:16 | el rótulo se ajusta al espacio disponible |

## 4. Recomendaciones para la próxima iteración

1. **Revisión editorial por un segundo modelo**: después del guion, un paso "editor" que lo lea en voz
   alta (TTS de prueba barato o lectura) con el checklist de storytelling §6 y proponga cambios.
2. **Revisión visual real**: Codex no "vio" problemas evidentes (lima en todos los planos, foto repetida).
   Si el agente tiene visión, forzar que describa cada fila de la hoja antes de aprobarla; si no, la
   revisión visual queda para una persona.
3. **Variedad entre videos del canal**: mantener un registro de ganchos/títulos usados por canal
   (`designs/<d>/history.json`) y que el plan lo consulte.
4. **Componentes de agua/mar** para historia (barcos, naufragios): hoy `binary.convoy` es lo más cercano.
5. **Clips de video**: sigue pendiente un componente de video con seek determinista.
