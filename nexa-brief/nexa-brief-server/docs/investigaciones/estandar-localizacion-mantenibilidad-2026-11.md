# Estándar de localización, mantenibilidad y consumo de tokens

> Antecedente de revisión. La entrada operativa actual para adaptar otros diseños
> es la [guía de implementación compartida](estandar-implementacion-ediciones-multilingues-2026-11.md).
> Sus rutas, APIs y límites comprobados prevalecen sobre las alternativas técnicas
> de este antecedente; no crear módulos o pipelines propuestos aquí por inferencia.

Fecha: 2026-11-11 · Estado: antecedente de revisión, nada implementado.
La propuesta vigente y consolidada está en
[propuesta-localizacion-nodetech-2026-11.md](propuesta-localizacion-nodetech-2026-11.md).
Este texto se conserva como antecedente: sus estimaciones de tokens, llamada única,
offsets proporcionales y sustitución del alineador no son decisiones aprobadas.
Cuando difiera del informe consolidado, se aplica ese informe.

---

## 0. Cómo usar este documento

- **Persona:** secciones 1, 2, 15 y 18 (resumen, reglas, decisiones pendientes).
- **Agente que implementa (Codex, Claude):** lee solo la sección de la fase asignada
  (17) y las reglas que cite. No leas el documento entero por cada tarea.
- Cada regla tiene un identificador (`R-xx`) para citarla en briefs y revisiones sin
  copiar el texto.

---

## 1. Resumen ejecutivo

Objetivo: producir en español y llevar cada video a muchos idiomas, con un sistema
modular donde cada cambio afecte un solo módulo y que gaste el mínimo de tokens.

Idea central: **un video es una estructura fija y el idioma es una tabla de textos
intercambiable.** La IA solo ve y devuelve esa tabla. Los tiempos, rutas, componentes,
medios y validaciones los resuelve código determinista.

Consecuencias:

| Aspecto | Hoy / propuesta de Codex | Con este estándar |
| --- | --- | --- |
| Lo que ve la IA | JSON completos del motor, PLAN, storyboard | Solo textos traducibles con su contexto |
| Llamadas por idioma | 6 fases, varias por bloque | 1 (más reparaciones puntuales) |
| Tokens por idioma (estimado) | 75 000 a 145 000 | 13 000 a 16 000, gran parte en caché |
| Tiempos de escena | Un agente reescribe anclas | Código, por segmento y alineación |
| Añadir un idioma | Revisar herramientas | Una entrada en el registro de idiomas |
| Añadir un motor | Revisar el servicio | Declarar sus campos traducibles |

Las cifras de tokens son estimaciones; el piloto en EN debe medirlas (R-60).

---

## 2. Diagnóstico verificado en el código

Datos comprobados el 2026-11-11 en el workspace, rama `feat/nodetech-paquete-publicacion`:

1. **Español fijo en el kit.** `explainer-kit/tools/transcribe.py` (`language="es"` y
   prompt en español), `tts.py` (`language_boost: "Spanish"`, perfil de narrador
   latinoamericano, 130 palabras por minuto) y `narrate.py` (voz y conversión de
   números a palabras en español).
2. **Rutas fijas.** 37 referencias a `assets/config.json`, `publish.json`, `song.mp3` o
   `lyrics.json` en 7 herramientas (`kit.py`, `transcribe.py`, `transcribe_job.py`,
   `outro.py`, `narrative_check.py`, `fake_timing.py`, `style_media_policy.py`).
3. **Guion bien estructurado.** El ejemplo tiene 45 segmentos con ID (`s01`…),
   `language: es-419`, `act`, `tone` y `chapter`.
4. **Storyboard anclado a frases.** 79 momentos (`beats`) con `t` absoluto o
   `at: "<frase en español>"`; no tienen `scene_id` ni `segment_id`. Mezclan rutas de
   medios absolutas (`/nodetech/<video>/assets/media/...`) y relativas (`assets/media/...`).
5. **Proporción de texto real.** Los archivos del episodio suman unos 91 KB (PLAN 22 KB,
   script 25 KB, storyboard 29 KB, publish 14 KB). El texto traducible es una fracción:
   unos 10 600 caracteres de narración y 2 200 de textos en pantalla, más publicación.
6. **El idioma ya existe en otra parte.** `src/core/metadata` (`SUPPORTED_LANGUAGES`,
   `normalize_language`) y `src/modules/content_language.py` resuelven el idioma de
   publicación en otros flujos. La propuesta de Codex no los menciona.
7. **Los puertos ya existen.** `src/core/ports/voice_port.py`, `lyrics_port.py`,
   `ai_port.py`, `data_port.py`. Hay que extenderlos con idioma, no crear otros paralelos.
8. **Productor monolítico.** `src/core/explainer/producer.py` tiene 1227 líneas y
   `routers/explainer.py` 800. La localización no debe sumarse a ninguno de los dos.
9. **Persistencia.** JSON por secciones mediante `DataPort`; colecciones `content_videos`,
   `explainer_productions`, `jobs` y `execution_logs` ya mapeadas en
   `src/adapters/data/section_names.py`.

---

## 3. Principios rectores

- **R-01 Una sola fuente de verdad por concepto.** Idioma, voz, estado de una variante,
  campos traducibles: cada uno se define en un único lugar.
- **R-02 La IA decide significado, el código decide estructura.** Ningún dato que el
  código pueda calcular (tiempos, rutas, formato de números, validación) se pide a la IA.
- **R-03 La IA nunca edita archivos del motor.** Recibe y devuelve tablas de texto; un
  proceso determinista las aplica.
- **R-04 Dependencias hacia dentro.** Núcleo genérico, sin conocer explainer ni motores.
  Los motores y categorías dependen del núcleo, nunca al revés.
- **R-05 Contratos explícitos con pruebas.** Toda frontera entre módulos es un esquema o
  una interfaz (`Protocol`) con prueba de contrato.
- **R-06 Determinismo y reproducibilidad.** Misma entrada con hash igual da la misma
  salida; las etapas se pueden reanudar y saltar por hash.
- **R-07 Nada se sobrescribe.** Cada resultado es una revisión nueva; activar es mover un
  puntero.
- **R-08 Agregar en lugar de modificar.** Un idioma, motor o categoría nueva se suma con
  configuración o una implementación de interfaz, sin tocar el servicio central.
- **R-09 Español como variante más.** En los registros, `es-419` es una variante cuya
  ubicación apunta a las rutas actuales. El código no tiene ramas `if locale == "es"`.
- **R-10 Medir antes de optimizar.** Cada trabajo registra tokens, modelo, duración y
  costo por idioma.

---

## 4. Arquitectura de módulos

### 4.1 Estructura propuesta

```text
src/core/locales/                 registro único de idiomas (R-01)
  registry.py                     código, nombre, voz, alineador, formato numérico, códigos de proveedor
  locales.json                    datos; añadir un idioma = una entrada
src/core/localization/            genérico: no sabe qué es un video
  strings.py                      tabla de textos: modelo, extracción, hash
  memory.py                       memoria de traducción (caché por hash)
  glossary.py                     glosario por video, categoría y sistema
  translator.py                   orquesta TranslatorPort con caché y reparación
  checks.py                       validaciones deterministas de una tabla traducida
  formatting.py                   números, fechas, monedas, unidades (Babel, num2words)
src/core/pipeline/                genérico: etapas con caché por hash (tipo make)
src/core/ports/
  voice_port.py                   EXTENDER con locale
  alignment_port.py               NUEVO: texto conocido + audio → tiempos por palabra/segmento
  translator_port.py              NUEVO: tabla → tabla, sin conocimiento del motor
src/adapters/
  voice/…                         Gemini TTS y otros, parametrizados por locale
  alignment/…                     alineación forzada CTC/MMS; Whisper como respaldo
  translation/…                   DeepSeek, Gemini, según roles.json
src/core/explainer/localization/  solo integración del explainer
  service.py                      crea variantes, encola, activa revisiones
  segments.py                     anclas por segmento (sección 5.3)
  variant_context.py              resuelve rutas de una variante (sustituye rutas fijas)
src/templates/_tools/design-definitions/<id>/
  localizable.json                campos traducibles del motor (sección 5.2)
```

### 4.2 Reglas de módulo

- **R-11** Cada módulo nuevo tiene un `README.md` de 30 a 80 líneas: propósito,
  entradas, salidas, interfaz pública, qué no hace y cómo probarlo.
- **R-12** Un módulo expone una interfaz pública mínima (`__all__` o un `api.py`). Otros
  módulos no importan sus internos.
- **R-13** Tamaño orientativo: archivos de 400 líneas como máximo; si se supera, dividir
  por responsabilidad.
- **R-14** `core/locales`, `core/localization` y `core/pipeline` no importan nada de
  `explainer`, `templates` ni `adapters`. Una prueba de importaciones lo comprueba
  (por ejemplo `import-linter`).
- **R-15** El kit (`explainer-kit/tools`) recibe idioma y rutas mediante un único
  `VariantContext` (argumentos `--locale` y `--variant-dir`, o variables de entorno). Las
  37 rutas fijas se sustituyen por llamadas a ese contexto.
- **R-16** Lo existente se absorbe, no se duplica: `core/metadata` y
  `modules/content_language.py` pasan a usar `core/locales`.

---

## 5. Estándar de localización

### 5.1 Tabla de textos por video

Cada variante tiene `strings.<locale>.json`, una tabla plana:

```json
{
  "schema": "nexa.strings/1",
  "locale": "es-419",
  "source_hash": "sha256:…",
  "strings": {
    "seg.s01":        { "text": "Una orden judicial puso…", "kind": "narration", "act": "golpe", "tone": "alarma" },
    "beat.018.title": { "text": "Una conversación personal", "kind": "label", "max_chars": 28, "segment": "s12" },
    "pub.yt.title":   { "text": "Tus chats ante un juez", "kind": "title", "max_chars": 70 },
    "pub.yt.chapter.03": { "text": "Qué dijo el juez", "kind": "chapter" }
  }
}
```

- **R-20** Las claves son estables y legibles (`seg.<id>`, `beat.<scene_id>.<campo>`,
  `pub.<plataforma>.<campo>`). Nunca índices de array.
- **R-21** `kind` determina las reglas: `narration` (natural, hablado), `label` (breve,
  cabe en el rótulo), `title`, `chapter`, `cta`, `question`.
- **R-22** Ida y vuelta exacta: `apply(video, extract(video))` debe reproducir los
  archivos byte a byte. Es la primera prueba que se escribe.

### 5.2 Declaración localizable por motor

Cada diseño declara qué parámetros son texto, con qué tipo y límite:

```json
{
  "rough.photo":     { "caption": "label/40", "sub": "label/60", "src": "media" },
  "common.tabloid":  { "text": "label/32", "accent": "substring:text", "bullet": "label/18",
                       "mode": "enum", "imageSide": "enum", "src": "media" }
}
```

- **R-23** Solo los campos declarados como texto entran en la tabla. Ninguna heurística
  decide qué traducir. Una prueba rápida con heurística marcó `layout`, `tone` e `icon`
  como texto: eso es lo que esta regla evita.
- **R-24** `substring:<campo>` cubre casos como `accent`, que debe aparecer dentro de
  `text`; la validación comprueba que siga apareciendo tras traducir.
- **R-25** Interfaz común (`LocalizableEngine`): `extract`, `apply`, `validate`. Añadir un
  motor = declarar `localizable.json` e implementar casos especiales, si los hay.
- **R-26** Un componente con texto fijo en código o en imágenes se marca
  `"fixed_text": true` y aparece en el informe de la variante para revisión humana.

### 5.3 Anclas por segmento, no por frase

- **R-27** Migración única sin IA: cada momento del storyboard recibe `scene_id` estable,
  `segment_id` y `offset` relativo (0 a 1) dentro del segmento, calculados con la
  alineación actual del español.
- **R-28** En otro idioma, el tiempo de cada escena = inicio del segmento + `offset` ×
  duración del segmento, a partir de la alineación del audio nuevo. Solo se ajusta con
  IA si un `offset` cae en una zona inválida (marcado por validación).
- **R-29** Se elimina el agente de storyboard de la propuesta de Codex.
- **R-30** La migración no cambia el resultado visual del español; se verifica con
  capturas en 16:9 y 9:16 antes y después.
- **R-31** Las rutas de medios se normalizan a claves relativas al contenido (no
  `/nodetech/...` absolutas) mediante un resolvedor; los medios compartidos no se copian.

### 5.4 Voz y alineación

- **R-32** La voz se elige en el registro de idiomas y, opcionalmente, por canal en el
  perfil (`config/localization.json`). Identidad de voz estable por canal e idioma.
- **R-33** Alineación forzada (el texto exacto ya se conoce): más rápida y precisa que
  transcribir con Whisper large-v3 y disponible para cientos de idiomas. Whisper queda
  como verificación de muestra o respaldo.
- **R-34** Se guarda la salida cruda antes de cualquier corrección y un informe de
  diferencias entre voz y guion (omisiones, cifras, nombres).
- **R-35** Velocidad de lectura por idioma en el registro (palabras por minuto), no fija
  en el prompt de TTS.
- **R-36** El cierre de canal (`outro`) tiene versión por idioma, generada una vez y
  reutilizada.

### 5.5 Memoria de traducción y glosario

- **R-37** Clave de caché: `hash(texto fuente + kind + locale + versión de glosario +
  versión de prompt)`. Si el original cambia en 2 frases, solo esas 2 se traducen.
- **R-38** Tres niveles de glosario: sistema (marca, CTA, etiquetas comunes como
  "IMAGEN ILUSTRATIVA"), categoría (términos de NodeTech) y video (nombres, instituciones).
- **R-39** Los textos de sistema se traducen una vez por idioma y se reutilizan siempre.
- **R-40** Números, fechas, monedas y unidades se formatean con código según el idioma
  (R-02); la IA recibe marcadores como `{n:20000000}` cuando corresponda.

---

## 6. Qué llega a la IA y qué no

Esta es la regla de mayor impacto en costo y calidad.

### 6.1 Sí llega

| Contenido | Forma | Tamaño típico |
| --- | --- | --- |
| Contrato de salida y reglas generales | Prompt fijo versionado | 500 a 800 tokens |
| Reglas de la categoría | Extracto breve | 200 a 400 tokens |
| Ficha editorial del video | Tesis, público, tono, hechos clave, matices, advertencias | 800 a 1 200 tokens |
| Glosario relevante | Solo términos presentes en la tabla | 50 a 300 tokens |
| Tabla de textos fuente | Clave, texto, `kind`, `max_chars`, `act`/`tone` | 4 000 a 5 000 tokens en un video de unos 12 minutos (1 684 palabras) |
| Convenciones del idioma destino | Breves, del registro | 100 a 200 tokens |

### 6.2 No llega nunca

| Contenido | Motivo |
| --- | --- |
| `storyboard.json`, `config.json`, `manifest.json` completos | Estructura; la aplica el código (R-03) |
| Parámetros técnicos: `src`, `layout`, `tone`, `icon`, colores, posiciones, `target`, `focus` | No son texto |
| Tiempos, anclas, duraciones | Los calcula la alineación (R-28) |
| PLAN.md completo, fuentes completas | Se resume una vez en la ficha (6.3) |
| Campos internos de revisión (`shows`, `query`, `media_review`) | Notas de producción, no contenido publicado |
| Transcripciones con tiempos por palabra | Datos del alineador |
| Código del motor o de los componentes | Irrelevante para traducir |
| Rutas del perfil, cuentas, credenciales, IDs de canales | Seguridad y aislamiento |
| Traducciones ya presentes en la memoria (R-37) | Ya están pagadas |
| Textos de sistema ya traducidos (R-39) | Ídem |

### 6.3 Ficha editorial (una vez por video)

- **R-41** Se extrae una vez de PLAN, BRIEF y guion, con un modelo económico, y se guarda
  en `research/editorial-brief.json` con procedencia.
- **R-42** Se reutiliza para todos los idiomas y para siempre; se regenera solo si cambia
  el hash de sus fuentes.
- **R-43** Videos nuevos: el productor la escribe al producir, sin costo adicional.

---

## 7. Presupuesto de tokens

### 7.1 Reglas

- **R-44 Una llamada por idioma** cuando la tabla cabe en una petición (el caso normal).
  Bloques solo para videos largos, cortados por acto.
- **R-45 Orden para caché del proveedor.** Primero lo idéntico para todos los idiomas
  (contrato, categoría, ficha, glosario de sistema, tabla fuente) y al final el idioma
  destino. Generar varios idiomas seguidos cobra el prefijo a precio de caché
  (DeepSeek lo hace automáticamente; Gemini con caché de contexto).
- **R-46 Revisión por código primero.** Cifras, nombres propios, URLs, términos de
  glosario, `max_chars`, `substring`, claves faltantes o sobrantes: todo sin IA.
- **R-47 Reparación acotada.** Solo las claves que fallaron vuelven a un modelo, con el
  error concreto. Nunca se reenvía la tabla completa por un fallo.
- **R-48 Modelos por rol en `roles.json`.** `localization_translate` (económico),
  `localization_repair` (fuerte, solo lo marcado), `localization_brief` (económico,
  una vez por video). Sin nombres de modelo en el código.
- **R-49 Salida compacta.** La respuesta devuelve solo `clave → texto` (y notas si las
  hay), no repite `kind` ni contexto.
- **R-50 Sin conversaciones largas.** Cada llamada es independiente y autocontenida; no
  se arrastra historial entre fases.
- **R-51 Retrotraducción de muestra** (opcional, económica): 10 a 15 % de las claves, solo
  para el puntaje de calidad.
- **R-52 Tope por trabajo.** Límite de tokens y de reintentos por variante; al superarlo,
  el trabajo queda en "requiere revisión", nunca en bucle.

### 7.2 Estimación por idioma (video de unos 12 minutos, como el ejemplo)

| Etapa | Llamadas | Entrada | Salida |
| --- | --- | --- | --- |
| Ficha editorial (una vez por video, no por idioma) | 1 | 7 000 a 8 000 | 1 000 |
| Traducción de la tabla | 1 | 6 000 a 8 000 (en caché desde el 2.º idioma) | 5 000 a 6 000 |
| Reparación puntual | 0 a 1 | 500 a 1 500 | 200 a 600 |
| Retrotraducción de muestra (opcional) | 0 a 1 | 800 | 600 |

Comparación con la propuesta de Codex (6 fases, ficha, bloques, vecinos, storyboard y
contratos de componentes reenviados en cada fase): unos 60 000 a 120 000 tokens de entrada
y 15 000 a 25 000 de salida por idioma. Ahorro estimado de 80 a 90 %.

### 7.3 Tokens de los agentes que programan (Codex, Claude)

El sistema también se mantiene con IA; su consumo cuenta.

- **R-53** `AGENTS.md` jerárquicos y cortos: el raíz apunta a cada módulo; cada módulo
  tiene el suyo con lo mínimo. Un agente que cambia la voz lee `core/locales` y
  `adapters/voice`, no el productor ni el kit completo.
- **R-54** Briefs de tarea con: objetivo, archivos permitidos, reglas citadas por ID
  (`R-22`, `R-46`), criterio de aceptación y comando de prueba. Sin copiar este documento.
- **R-55** Contratos en esquemas (`schemas/*.json`, modelos Pydantic): el agente lee el
  esquema, no el código que lo usa.
- **R-56** Pruebas rápidas por módulo (`pytest tests/core/localization -q` en segundos)
  para que el agente verifique sin levantar la API ni grabar.
- **R-57** Documentos históricos claramente marcados como obsoletos o movidos a un anexo;
  un documento con dos árboles contradictorios hace implementar el equivocado.

---

## 8. Datos y estado

- **R-58** El registro (`DataPort`) es la fuente de verdad del estado y del puntero a la
  revisión activa. Las carpetas contienen artefactos, no estado editable.
- **R-59** Colecciones nuevas en `videos.json`: `video_localizations` (una fila por video
  e idioma) y `video_localization_revisions`. Trabajos en `jobs` con
  `kind=localization`; consumo en `execution_logs`. Mapearlas en `section_names.py`.
- **R-60** Cada revisión guarda `source_hash`, `strings_hash`, versión de prompts,
  versión de glosario, modelo, voz, alineador, tokens, costo estimado, duración y estado
  de revisión humana.
- **R-61** Idempotencia: un mismo `video + locale + source_hash` no crea dos trabajos
  simultáneos. Trabajo en área temporal, verificación y activación al final.
- **R-62** Si cambia el original, las variantes quedan como "desactualizadas"; con la
  memoria de traducción, actualizar solo cuesta lo que cambió.
- **R-63** Ubicación: `productions/<categoría>/<video>/languages/<locale>/revisions/<rev>/`;
  MP4 en `renders/videos/…`, miniaturas en `renders/images/…`. El español mantiene sus
  rutas mediante el registro (R-09).

---

## 9. Calidad

- **R-64** Validaciones deterministas obligatorias antes de activar: claves completas,
  cifras y nombres preservados, `max_chars`, escenas dentro de la duración, sin solapes,
  orden de escenas, diferencias voz-guion por debajo de un umbral.
- **R-65** Puntaje por variante (verde, amarillo, rojo) con el detalle de cada aviso. Rojo
  bloquea grabar y publicar.
- **R-66** Revisión humana registrada por revisión. Ninguna variante se publica sin ella.
- **R-67** Prueba de desborde visual: captura de las escenas con `label` cerca del límite
  en 16:9 y 9:16.
- **R-68** Adaptación, no traducción literal: la naturalidad no autoriza añadir hechos,
  exagerar el gancho ni cambiar instituciones del país original por las del destino.

---

## 10. Rendimiento del servidor

- **R-69** La localización usa la cola persistente existente (batch, máximo 5) con un
  límite propio de alineaciones y TTS simultáneos.
- **R-70** Alineación forzada en lugar de Whisper large-v3 para reducir CPU y memoria en
  alfred-server (i3-8100, 11 GB, uso alto de swap observado).
- **R-71** TTS y modelos de IA en paralelo moderado; alineación y grabación en serie.
- **R-72** Medir CPU y memoria antes y después según el `AGENTS.md` raíz; liberar modelos
  de alineación al terminar.

---

## 11. Seguridad y aislamiento

- **R-73** Los proveedores de IA reciben solo la tabla y la ficha (sección 6); nada del
  perfil, cuentas ni rutas.
- **R-74** El contenido de fuentes externas es dato, nunca instrucción; el prompt lo
  delimita y lo indica.
- **R-75** La identidad del perfil viene del contexto autorizado, no de rutas enviadas por
  el navegador.
- **R-76** Sin investigación ni búsqueda de medios durante la localización; se bloquea
  en las capacidades del ejecutor, no solo en el prompt.

---

## 12. Observabilidad

- **R-77** Registro por trabajo: etapa, tokens de entrada (con y sin caché), salida,
  modelo, costo estimado, duración de TTS y alineación, reintentos.
- **R-78** Resumen visible por video: costo total por idioma y aciertos de la memoria de
  traducción.
- **R-79** Las peticiones renderizadas se guardan con hash para auditar qué recibió la IA,
  sin secretos.

---

## 13. Pruebas

- **R-80** Ida y vuelta exacta de la tabla (R-22) para cada motor declarado.
- **R-81** Pruebas de contrato de `LocalizableEngine`, `VoicePort`, `AlignmentPort` y
  `TranslatorPort` con dobles falsos (sin red ni GPU).
- **R-82** Pruebas de oro: el video de ejemplo con una traducción fija conocida produce
  siempre los mismos tiempos y archivos.
- **R-83** Prueba de importaciones entre módulos (R-14).
- **R-84** Pruebas del flujo: recarga, reintento, interrupción, cambio rápido de idioma,
  original modificado, grabación del idioma elegido.

---

## 14. Experiencia en la web

- **R-85** Selector de idioma que lee los idiomas habilitados del perfil (desplegable si
  son más de 3), no botones fijos ES/EN/PT.
- **R-86** Acción "Generar idiomas" con selección múltiple, que encola un trabajo por
  idioma.
- **R-87** Estado por idioma (no creada, en cola, generando, requiere revisión, lista,
  desactualizada, fallida) y puntaje de calidad.
- **R-88** Claves de caché y respuestas asíncronas con perfil, video, idioma y revisión;
  un cambio rápido no muestra datos del idioma anterior.
- **R-89** Subtítulos SRT/VTT por idioma descargables (subproducto de la alineación).

---

## 15. Qué sí tener en cuenta y qué no hacer

### Sí

- Diseñar los videos nuevos preparados para traducirse desde el productor: guion con IDs,
  escenas ligadas a segmentos, tabla de textos y ficha editorial.
- Tratar el español como una variante más en los registros.
- Medir costo real en el piloto antes de ampliar.
- Mantener una voz estable por canal e idioma.
- Revisar imágenes con texto incrustado; no se traducen cambiando parámetros.
- Decidir la estrategia de publicación por idioma antes de modelar las publicaciones.
- Implementar en cortes verticales que produzcan algo visible y verificable.

### No

- No enviar JSON del motor ni PLAN completo a la IA.
- No usar heurísticas para decidir qué campos se traducen.
- No pedir a la IA tiempos, segundos, rutas ni formato de números.
- No traducir dos veces el mismo texto.
- No añadir lógica de idiomas a `producer.py` ni al router existente.
- No crear un segundo registro de idiomas paralelo a `core/metadata`.
- No duplicar motores, `index.html` ni medios por idioma.
- No mover los archivos del español ni sus URLs actuales.
- No multiplicar los tiempos por una proporción global.
- No encadenar fases con historial de conversación.
- No publicar ni grabar automáticamente al terminar una variante.
- No dejar documentos con estructuras contradictorias sin marcar.

---

## 16. Correcciones a la propuesta de Codex

| Punto de la propuesta | Corrección |
| --- | --- |
| `locales/*.json` dentro de `skills/explainer/localize` | Registro único en `core/locales`, absorbiendo `core/metadata` (R-01, R-16) |
| Todo bajo `core/explainer/localization` | Núcleo genérico más integración del explainer (R-04, sección 4) |
| Adaptador por motor como idea | Interfaz `LocalizableEngine` y `localizable.json` obligatorios (R-25) |
| Agente de storyboard que reescribe anclas | Anclas por segmento calculadas por código (R-27 a R-29) |
| 6 fases de prompts | 1 llamada, más reparación acotada (R-44, R-47) |
| Revisión de guion con IA | Validaciones deterministas primero (R-46) |
| Whisper large-v3 por idioma | Alineación forzada (R-33, R-70) |
| Selector fijo `ES / EN / PT` | Selector dinámico desde la configuración (R-85) |
| Sección "Propuesta inicial conservada" con otro árbol | Marcar como obsoleta o retirar (R-57) |
| Sin memoria de traducción | Memoria por hash y glosario de tres niveles (R-37, R-38) |
| Sin estrategia de publicación por idioma | Decisión pendiente (sección 18) |
| SSH fallido, perfil sin verificar | Verificar `NEXA_PROFILE_DIR` y `profile.json` antes de la fase 3 |

---

## 17. Hoja de ruta por fases

Cada fase se entrega por separado, con sus pruebas, y se revisa antes de seguir.

**Fase 1. Registro de idiomas y kit parametrizado.** Sin IA.
- Crear `core/locales` con `es-419`, `en`, `pt-BR`; adaptar `core/metadata`.
- `VariantContext` y `--locale` en `tts.py`, `transcribe.py`, `narrate.py`, `outro.py`;
  sustituir las rutas fijas.
- Aceptación: el español produce lo mismo que hoy; un guion escrito en inglés se narra y
  transcribe en inglés.

**Fase 2. Tabla de textos y declaración de motores.** Sin IA.
- `core/localization/strings.py`; `localizable.json` para los motores usados en NodeTech.
- Aceptación: ida y vuelta exacta byte a byte en el video de ejemplo (R-22).

**Fase 3. Anclas por segmento y medios normalizados.** Sin IA.
- Migración del storyboard (R-27), resolvedor de medios (R-31).
- Aceptación: capturas del español idénticas antes y después en 16:9 y 9:16.

**Fase 4. Alineación forzada.** Sin IA.
- `AlignmentPort` con adaptador CTC/MMS; comparación con la transcripción actual.
- Aceptación: tiempos del español dentro de una tolerancia acordada respecto a Whisper.

**Fase 5. Traducción con memoria y validaciones. Piloto EN.**
- `translator.py`, `memory.py`, `glossary.py`, `checks.py`, ficha editorial, roles nuevos.
- Comando de consola `localize --video <id> --locale en` que genera la revisión en disco.
- Aceptación: video EN completo revisado por la persona; tokens y costo medidos y
  comparados con la sección 7.2.

**Fase 6. Registro, API y web.**
- Colecciones, trabajos, API (`GET/POST /localizations`, estado del trabajo), selector,
  puntaje, grabación por variante.

**Fase 7. PT-BR y siguiente categoría.**
- Validar que añadir un idioma es una entrada en el registro y que añadir un motor es su
  `localizable.json`.

Las fases 1 a 4 no consumen tokens de IA en producción y dejan el sistema preparado para
cualquier idioma.

---

## 18. Decisiones pendientes de la persona

1. **Publicación por idioma:** ¿canales separados por idioma, o un solo canal con varias
   pistas de audio y títulos localizados en YouTube? Define el modelo de publicaciones.
2. **Idiomas tras el piloto:** ¿cuáles y en qué orden (EN, PT-BR, FR, DE…)?
3. **Voces:** ¿una voz por idioma para todo el sistema o una por canal?
4. **Nivel de revisión:** ¿toda variante requiere revisión humana o las verdes con
   puntaje alto pueden pasar a "lista" directamente?
5. **Ejecución:** ¿Codex implementa cada fase y Claude revisa, según el flujo actual?

---

## 19. Lista de comprobación por cambio

Antes de aceptar cualquier entrega relacionada con este estándar:

- [ ] El cambio está en un solo módulo o justifica por qué toca más.
- [ ] Respeta la dirección de dependencias (R-14) y pasa la prueba de importaciones.
- [ ] No envía a la IA nada de la sección 6.2.
- [ ] No pide a la IA nada que el código pueda calcular (R-02).
- [ ] Tiene pruebas de contrato o de ida y vuelta según corresponda.
- [ ] El español sigue produciendo el mismo resultado.
- [ ] Registra tokens, modelo y costo si llama a una IA.
- [ ] El README del módulo está actualizado.
- [ ] No añade ramas `if locale == "es"` ni nombres de modelos en el código.
- [ ] No duplica motores, medios ni registros de idioma.
