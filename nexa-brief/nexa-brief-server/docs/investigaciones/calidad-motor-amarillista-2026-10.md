# Por qué el motor generó videos amarillistas blandos y pobres (y cómo arreglarlo en el motor)

Fecha: 2026-10-30 · Alcance: pipeline de producción del explainer (`producer.py` → agente → explainer-kit) con la
narrativa `narrative_amarillista_v1`. Casos: `nodetech/clonan-tu-voz-…` (nivel negro) y
`nodetech/lo-que-le-contas-a-la-ia-…` (nivel alto), producidos por el pipeline con Codex Terra 6.1 xhigh.

**Principio:** no se corrige el video, se corrige el motor. Cada defecto visto debe tener (1) la regla que el agente
recibe y (2) un check que bloquea si no se cumple. Si solo hay regla, un modelo apurado la ignora; si solo hay check, el
agente no sabe qué apuntar. Una vez arreglado, cualquier modelo (Claude, Codex, el que venga) produce el mismo piso de calidad.

## 1. Lo que se vio

| Defecto | Evidencia |
|---|---|
| Gancho y miedo blandos | Golpe nivel negro: «Tu familia **puede** escuchar tu voz… **¿Y si** la próxima llamada…?». Miedo: «Puede que sepan…», «no describe **necesariamente**…». Sin cifra en el golpe. |
| Tono de voz flojo en el miedo | Video voz: golpe/miedo con tonos `urgencia`, `tensión`, `suspenso`; ninguno `alarma`. |
| Visual pobre | Video chats: 140 beats, **60 % `rough.icon`** (84), solo 8 fotos. Video voz: hoja dominada por iconos en negro. Comparación: Amazon (producido por Claude) 23 % iconos, 12 componentes distintos, 3 componentes propios. |
| Componentes propios creados y **no usados** | Chats: `rough-legal-hold.js` y `rough-chat-record.js` existen en `assets/components/` pero ningún beat los usa. |
| Textos cortados en pantalla | `common.lyric` con `at: "pertenece solamente a quienes demandan o"` y `"desactivar la opción de mejorar el"`: la letra muestra la ventana de narración entre dos beats, y el corte cae a mitad de frase. |
| Miniatura sin el 20 % de alerta | Tabloide C correcto en identidad, pero sin `bullet`/strap rojo con dato real. Foto del video voz: teclado de marcado (no comunica «llamada falsa»). |

Los checks (`kit.py check`, `publishing check`) dieron **0 errores**: el motor no mide nada de esto.

## 2. Causas raíz (en el motor, no en el video)

1. **El agente nunca recibe las reglas de cada acto.** `narrative/prompts.py::production_lines` resume los actos como
   «golpe (apertura, intensidad máxima) → miedo (…)», pero **no pasa** `function` ni `rules` de cada acto («una frase
   que da miedo, **con número** y con «tú»», «**ni una frase tranquilizadora**», «Primero… después… y lo peor…»). Solo
   remite al JSON («detalle completo: …json»), que el agente no abre.
2. **La propia estrategia enseña a condicionar.** `hook.allowed_techniques[0]` da como ejemplo «**podría** desaparecer la
   mitad…». El modelo generaliza el condicional a todo el gancho. Falta una lista explícita de palabras de cobertura
   prohibidas en golpe/miedo y ejemplos de golpe correcto por categoría.
3. **Ningún check mira el contenido del guion.** `tools/narrative_check.py` valida solo orden y forma (actos presentes,
   intensidad, pregunta). No detecta condicionales en el golpe, golpe sin cifra, ni tonos que no sean `alarma`.
4. **Instrucciones contradictorias sobre componentes.** `produce/SKILL.md` §3 dice «Componentes propios (**solo si** el
   catálogo no dibuja el objeto)» y «no rehacer componentes»; el prompt del productor pide «criterio ALTO». Como
   `rough.icon` «dibuja» cualquier objeto, el agente toma la vía barata: todo es icono.
5. **La variedad visual es solo un aviso.** `check_storyboard.py` avisa «el icono X se usa N veces» pero no limita la
   proporción de `rough.icon`, ni los iconos seguidos, ni exige fotos/clips, ni que los componentes creados se usen.
   Avisos = el agente los ignora y el pipeline marca `listo`.
6. **`common.lyric` no protege el corte de frase.** Muestra la ventana de narración entre su `at` y el beat siguiente;
   nada verifica que esa ventana termine en fin de frase.
7. **La miniatura no exige el dato rojo.** `thumbnail` de la narrativa dice «rojo/amarillo solo en alertas puntuales»
   pero no exige `bullet` (ni que sea una cifra real del guion), ni revisión de foto «que cuente el tema».
8. **Modelo vs. piso de calidad.** Con las mismas reglas, Claude produjo Amazon con 23 % de iconos y Codex 60 %: hoy la
   calidad depende de la diligencia del modelo. Los puntos 3, 5, 6 y 7 la convierten en un piso medible.

## 3. Cambios en el motor (para todos los videos futuros)

Todos los umbrales viven en JSON (no en código) para poder ajustarlos sin tocar Python.

**A. Narrativa → agente (`narrative/prompts.py`, `narrative_amarillista_v1.json`)**
- `production_lines` y `brief_context` incluyen, por acto hablado, `function` + `rules` + `tone` sugerido.
- Nuevo bloque `voice` en la narrativa: tonos permitidos por acto (golpe/miedo → `alarma`; pregunta → `cercano`).
- Nuevo bloque `hook.hedge_words` (prohibidas en golpe/miedo): puede, puede que, podría, quizás, tal vez, ¿y si,
  no necesariamente, posiblemente, en algunos casos, a veces. Las atribuciones («según X, podría…») se permiten solo
  entre comillas o con fuente nombrada en la misma oración.
- Ejemplos de golpe/miedo **correctos e incorrectos** por categoría (tech/historia/política), escritos como afirmación.
- Reescribir la técnica 1: «El peor escenario dicho por una fuente con nombre» con ejemplo atribuido, no condicional.

**B. Checks de guion (`tools/narrative_check.py`, errores, no avisos)**
- Golpe/miedo sin `hedge_words` (salvo atribución con fuente/comillas).
- Golpe con al menos una cifra o hecho concreto (dígito, número escrito, fecha) y segunda persona.
- Tonos de golpe/miedo dentro de `voice.allowed_tones`.
- Configurable por narrativa (`checks.script`), así la documental no se ve afectada.

**C. Piso visual (`check_storyboard.py` + `designs/<diseño>/quality.json` o bloque en `catalog.json`)**
- `rough.icon` ≤ 25 % de los beats (umbral por diseño), máximo 2 seguidos → **error**.
- Mínimo de recursos reales por minuto (fotos/clips) y de componentes distintos (p. ej. ≥ 10 en videos ≥ 8 min).
- Todo componente en `assets/components/` debe usarse al menos una vez → **error**.
- Golpe/miedo (primer tramo): sin `rough.icon` aislados; solo foto/clip/componente propio/punch.
- `common.lyric`: la ventana debe terminar en fin de frase (`.`, `?`, `!`, `…`) o declarar `text` explícito ≤ 7
  palabras → **error**. Ídem `common.punch`.

**D. Instrucciones coherentes (`produce/SKILL.md`, prompt del productor)**
- Eliminar «solo si el catálogo no dibuja…»; reemplazar por: «Para videos ≥ 8 min, al menos N componentes propios
  del tema (los objetos/mecanismos que vuelven ≥ 2 veces o el clímax), revisados en su hoja PNG y usados».
- Decir explícitamente que `rough.icon` es relleno, no protagonista, y que los checks lo bloquean.

**E. Miniatura (`narrative.thumbnail` + `publishing/checks.py`)**
- Tabloide C de la narrativa amarillista exige `bullet` con cifra real que aparezca en el guion o en `sources`.
- `image_review` obligatorio: por qué la foto comunica el tema de un vistazo (ya existe en A/B; extender a C).

**F. Tests**: casos que fallan con los dos guiones/storyboards de hoy y pasan con los corregidos; la narrativa
documental sigue pasando igual (aislamiento).

## 4. Validación

1. Implementar A–F (Codex Terra 6.1 xhigh), revisión cruzada Terra xhigh, revisión final de Claude.
2. Volver a producir **desde cero por el pipeline** los dos videos (mismo tema, nivel negro y alto), sin tocarlos a
   mano. Éxito = pasan los checks nuevos a la primera o el propio agente se corrige con los errores, y la hoja muestra:
   gancho afirmativo con cifra, ≤ 25 % iconos, ≥ 4 componentes propios usados, fotos/clips en el primer tramo,
   cero textos cortados, miniatura con dato rojo.
3. Nada se graba ni se renderiza: quedan en preparación para revisión del usuario.

## 5. Métricas para el seguimiento

`icon_share`, `distinct_components`, `custom_components_used`, `media_per_min`, `hedge_hits_hook`, `lyric_cuts`,
calculadas por `kit.py check` y guardadas en `manifest.json` → `quality`, para comparar modelos y videos a lo largo
del tiempo.
