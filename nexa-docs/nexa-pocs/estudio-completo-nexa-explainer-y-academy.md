# Estudio completo: Nexa Explainer y Nexa Academy

**Fecha del estudio:** 2026-09-19  
**Alcance:** `nexa-docs/`, `nexa-explainer/`, `nexa-academy/` y `nexa-render/`.

## 1. Conclusión ejecutiva

La base técnica es buena, pero la conclusión importante es que todavía no existen los dos productos descritos en el POC. Lo que existe hoy es una plataforma heredada de Nexa Brief con bastante infraestructura reutilizable:

- pipeline de jobs en background, seguimiento de estado, historial y notificaciones;
- biblioteca de assets;
- plantillas config-driven;
- publicación a YouTube, Facebook y TikTok;
- motores Playwright, Remotion y HyperFrames;
- adapters de voz reales en `nexa-academy`.

Lo que todavía falta es el dominio de cada producto:

- **Nexa Explainer:** ingerir un video de una persona, analizar su encuadre durante el video, extraer el audio, transcribirlo, construir una estructura editorial, producir una timeline de gráficos, previsualizar sobre el video original y permitir revisiones incrementales.
- **Nexa Academy:** modelar currículo, fases, lecciones, guiones, fuentes y validación pedagógica; generar un piloto controlado; medir su desempeño; y decidir con evidencia si continuar o ajustar.

Mi opinión: la tesis es correcta, pero el siguiente paso no debe ser agregar más plantillas ni más modelos. Debe ser construir un vertical slice mínimo de cada dominio y convertir los contratos de datos en la fuente de verdad.

## 2. Fuentes y discrepancias encontradas

No existe una carpeta `nexa-explainer/nexa-docs`. La documentación de planificación está en `nexa-docs/nexa-pocs/`, mientras que `nexa-explainer/nexa-explainer-server/docs/` solo contiene el contrato actual del servidor. `nexa-academy/nexa-docs/` contiene el estudio específico de TTS.

Por eso el estado se evaluó con esta prioridad:

1. Código actual y esquemas de API.
2. Pruebas y manifiestos de plantillas.
3. Documentación marcada como vigente.
4. Documentación histórica o archivada, solo como contexto.

Hay una diferencia crítica entre documentación y código:

- `nexa-explainer-server/docs/api-videos-frontend.md` dice correctamente que el servidor es un motor genérico heredado y que todavía no tiene el dominio de video del usuario.
- La interfaz de `nexa-explainer-web` todavía conserva campos y flujos de música (`musicFile`, `musicAssetId`, `songName`, `/library/music`), aunque el backend ya no expone música ni tiene un stage que resuelva audio.
- El POC habla de video del presentador, pero el campo actual `video_source` representa un **video de fondo** para el niche `motion_backdrop_showcase`, no un input de cámara con presentador.

## 3. Qué plataforma existe realmente

### 3.1 Nexa Explainer actual

El pipeline real sigue este patrón:

```text
category_name
  → input_analyzer musical
  → visual_designer o vision extractor de una imagen/video de fondo
  → resource_fetcher
  → prompt_architect
  → html_generator/config mapper
  → video_recorder
  → result_summarizer
  → packager
  → publicación opcional
```

El servidor sí tiene `POST /videos/upload`, jobs asíncronos y preview de plantilla. Sin embargo:

- `input_analyzer.py` todavía usa prompts de contenido musical.
- `prompt_architect.py`, `html_generator.py` y `result_summarizer.py` todavía hablan de música, `song.mp3` y visualizadores musicales.
- `video_recorder.py` falla intencionalmente si `artifacts.audio_path` es `None`.
- `packager.py` exige `song.mp3`, aunque el dominio nuevo todavía no genera ese archivo.
- `FasterWhisperAdapter` existe, pero nadie lo conecta al pipeline nuevo.
- El servidor solo extrae el primer frame de un video cuando el video se usa como fondo para visión; eso no es todavía análisis del presentador.

### 3.2 Nexa Academy actual

Academy es casi una copia del backend heredado con una capa adicional de voz:

- `VoicePort` existe.
- Gemini TTS y Novita TTS fueron probados con audio real.
- La selección de proveedor y motor está encapsulada en una factory.
- `voice_narrator.py` puede convertir `user_context` en audio.

Pero todavía no existe el dominio educativo:

- no hay `Course`, `Curriculum`, `Phase`, `Lesson`, `LessonScript` ni `LearningObjective`;
- no existe la conversación de planificación del temario;
- no existe el roadmap de 55–100 lecciones;
- no existe generación de una lección restringida a su título y descripción;
- no existe verificador de exactitud educativa;
- no existe piloto del 10%;
- no existe ingesta de métricas ni decisión automática de continuar o ajustar.

La narración actual es un **smoke path técnico de TTS**, no una fábrica de clases. El propio módulo reconoce que usa `user_context` como sustituto provisional de `lesson.script`.

## 4. Nexa Explainer: comparación del POC contra el código

| Punto del POC | Estado | Qué falta realmente |
|---|---|---|
| 1. Analizar el encuadre del presentador | No implementado | Input dedicado de video de cámara, validación multimedia, selección de frames representativos, detección de persona/cara/cuerpo, posición, tamaño y zonas seguras. |
| 2. Transcribir en paralelo | Parcial en infraestructura | Existe Faster-Whisper con timestamps por palabra, pero falta extraer el audio del video subido y conectarlo al pipeline. La concurrencia paralela todavía no está modelada como fan-out/fan-in del dominio. |
| 3. Seleccionar identidad visual | Parcial | Hay plantillas config-driven, pero no una librería de plantillas para overlays de presentador ni un contrato de tokens visuales. |
| 4. Estructurar el contenido | No implementado | Falta convertir transcript en título, resumen, ideas clave, afirmaciones, ejemplos, CTA y prioridad editorial. El `input_analyzer` actual no hace esto. |
| 5. Construir guion/timeline | No implementado | Falta un modelo de escenas, elementos, `start`, `end`, ancla, prioridad, zona segura, estilo y relación con palabras del transcript. |
| 6. Generar HTML/CSS | Parcial, pero de otro dominio | Hay generación libre y config mapper, pero ambos están orientados a imagen/música. Para Explainer debe usarse una plantilla cerrada que reciba un `CompositionSpec`. |
| 7. Previsualizar antes de renderizar | Parcial | Hay preview hasta `HTML_GENERATED`, pero no se superpone el panel sobre el video del presentador ni se puede editar/reproducir una timeline de Explainer. |
| 8. Ajustar por feedback | No implementado | Faltan endpoint de revisión, historial de versiones, patch estructurado, chat y re-render parcial. |

### 4.1 El error conceptual más importante

El POC describe un video con **dos capas principales**:

```text
video original del presentador
  + panel de gráficos sincronizado
  + opcionalmente subtítulos
```

El código actual describe esto:

```text
HTML visualizador
  + imagen/video de fondo
  + audio externo
```

No es una diferencia menor de configuración. Es otro modelo de dominio, otro contrato de entrada, otro compositor y otra estrategia de preview.

## 5. Nexa Academy: comparación del POC contra el código

| Punto del POC | Estado | Qué falta realmente |
|---|---|---|
| 1. Planificación conversada | No implementado | Sesión de planificación, objetivos, nivel, idioma, restricciones, duración y aprobación humana. |
| 2. Plantillas por materia | Parcial | Existen plantillas genéricas heredadas, pero no familias de inglés, matemática, historia ni contratos pedagógicos por materia. |
| 3. Roadmap por fases | No implementado | Entidades persistentes para curso/fase/lección, dependencias entre lecciones y versionado del roadmap. |
| 4. Proveedor de voz | Parcial y bien encaminado | TTS real y seleccionable por configuración. Falta exponerlo por lección, estimar presupuesto antes de generar y guardar una decisión reproducible. |
| 5. Generar lección dentro de límites | No implementado | `LessonSpec`, guion, fuentes, objetivos, ejercicios, control de alcance y revisión factual/pedagógica. |
| 6. Piloto + revisión humana + revisión por métricas | No implementado | Definir cohorte piloto, publicación, ventana de evaluación, métricas, umbrales y acción automática. |

### 5.1 Riesgo pedagógico

En Academy un error no es solo un error visual: enseña algo incorrecto. Por eso un único modelo generador no debe ser la única autoridad. La generación necesita:

1. fuentes o material autorizado;
2. restricciones de nivel y alcance;
3. verificación separada;
4. revisión humana en el piloto;
5. registro de qué versión del currículo produjo cada lección.

## 6. Modelo recomendado de IA por tarea

La regla general debe ser: modelo especializado o determinista donde el problema sea acotado; modelo de razonamiento solo donde haya decisión editorial o pedagógica real.

### 6.1 Explainer

| Tarea | Modelo recomendado | Motivo |
|---|---|---|
| Validación de video, duración, codec, fps, resolución | FFprobe + reglas deterministas | No necesita IA. |
| Detección de persona/cara/posición | CV/visión especializada; LLM solo como fallback | Medición repetible, barata y auditable. |
| Seguimiento del presentador | Tracking determinista/CV por frames | El primer frame no representa todo el video. |
| Transcripción | Faster-Whisper con timestamps por palabra | Ya existe adapter; es el tipo correcto de modelo. |
| Resumen y selección de ideas importantes | Modelo de razonamiento alto | Es el punto editorial crítico del POC. Debe responder con JSON estricto y justificar cada punto con rangos del transcript. |
| Timeline | Modelo de razonamiento medio/alto + reglas | El modelo propone; un validador corrige solapamientos, duración y safe zones. |
| Configuración visual | Determinista a partir de plantilla + JSON | La IA no debería inventar HTML ni sistema visual completo. |
| HTML/CSS final | Plantilla cerrada/config mapper | Reduce variabilidad, bugs y superficie de seguridad. |
| Feedback | Modelo de razonamiento medio/alto | Debe traducir lenguaje libre a un patch acotado, nunca regenerar todo. |
| Metadata social | Modelo económico o plantilla | No es parte crítica del valor de Explainer. |

La elección exacta de proveedor debe quedar detrás de `AIPort`, con configuración por rol y con logs de modelo, versión, costo, latencia y esquema de salida. No conviene codificar que Gemini o DeepSeek sea “el cerebro” de todas las etapas.

### 6.2 Academy

| Tarea | Modelo recomendado | Motivo |
|---|---|---|
| Diseñar currículo y roadmap | Modelo de razonamiento alto | Decide secuencia, prerrequisitos y granularidad. Requiere aprobación humana. |
| Generar guion de una lección | Modelo de razonamiento alto | Debe respetar nivel, objetivo y alcance exacto. |
| Investigación y síntesis | LLM con recuperación de fuentes | La respuesta debe conservar citas, fecha y procedencia. |
| Verificación educativa | Segundo modelo o regla especializada + fuentes | Separar generación de evaluación reduce errores sistemáticos. |
| Voz | Gemini/Novita mediante `VoicePort` | Es síntesis de audio, no razonamiento editorial. La investigación de TTS ya dejó una base útil. |
| Escenas y tiempos | Estructurador JSON + reglas | La duración y los cortes deben ser deterministas. |
| Evaluación de métricas | Reglas estadísticas primero; LLM como intérprete | No dejar que un modelo decida solo por intuición si continúa una fase. |

## 7. Contratos de dominio que faltan

El objeto `Job` actual es insuficiente para ambos productos. Puede seguir existiendo como envoltorio de ejecución, pero no debe convertirse en el modelo de negocio.

### 7.1 Explainer

Se necesita, como mínimo:

```text
ExplainerProject
  source_video
  media_probe
  frame_analysis
  transcript
  content_outline
  visual_plan
  composition_spec
  revisions[]
  render_outputs[]
```

Campos importantes:

- `source_video`: duración, orientación, codec, dimensiones, fps, audio track, hash y permisos.
- `frame_analysis`: persona detectada, bounding box, posición, confianza, zonas libres y si el análisis es estático o temporal.
- `transcript`: idioma, segmentos, palabras, confianza, speaker id opcional y origen del audio.
- `content_outline`: título, resumen, ideas clave, afirmaciones, ejemplos, CTA y referencias al transcript.
- `composition_spec`: escenas y elementos visuales con tiempos, prioridad, posición, estilo, texto y origen semántico.
- `revision`: parent revision, comentario, patch aplicado, modelo, usuario, preview y estado de aprobación.

### 7.2 Academy

Se necesita, como mínimo:

```text
Course
  CurriculumVersion
    Phase[]
      Lesson[]
        LessonSpec
        Sources[]
        ScriptVersion[]
        AudioVersion[]
        VideoVersion[]
        Evaluation[]
        MetricsSnapshot[]
```

Una lección no debe ser solo `title + description`. Debe tener:

- objetivo observable;
- nivel y prerrequisitos;
- conceptos permitidos y conceptos fuera de alcance;
- vocabulario o fórmulas objetivo;
- guion y escenas;
- ejercicios o comprobación de comprensión;
- fuentes y fecha de consulta;
- estado: `draft`, `approved`, `pilot`, `published`, `needs_revision`, `archived`.

## 8. Arquitectura objetivo

### 8.1 Pipeline de Explainer

```text
ingest video
  ├─ media probe + validación
  ├─ extracción de audio ──► ASR con timestamps
  └─ frames representativos ─► análisis de encuadre/tracking
                    \         /
                     fan-in de evidencias
                              │
                    estructura editorial
                              │
                    plan visual/timeline
                              │
                    composición de plantilla
                              │
                    preview sobre video original
                              │
                   feedback → patch de revisión
                              │
                    render final vía recorder
```

La transcripción y el análisis visual sí deben correr en paralelo, pero el estructurador no debería empezar hasta tener ambas evidencias o una política explícita de degradación.

### 8.2 Pipeline de Academy

```text
conversación de planificación
  → curriculum draft
  → aprobación humana
  → roadmap versionado
  → lesson spec
  → research + sources
  → script
  → factual/pedagogical check
  → voice + composition
  → preview
  → piloto
  → publicación
  → métricas
  → regla de continuar / revisar / detener
```

### 8.3 Papel correcto de Nexa Render

`nexa-render` debe ser el motor genérico de composición y grabación, no el dueño del dominio. Explainer y Academy deberían producir un `CompositionSpec` o una composición HTML/React válida y entregar assets mediante un contrato seguro.

Antes de integrarlos hay que decidir:

- cómo se sirve el video original al renderer;
- si los assets se suben a almacenamiento temporal o se sirven por loopback;
- cómo se pasan fuentes, subtítulos y timeline;
- cómo se correlacionan los job ids entre servicios;
- qué motor se usa para preview y cuál para render final;
- cómo se limpian videos originales y outputs.

No conviene duplicar el recorder de Python y el renderer Node indefinidamente. Para el primer vertical slice se puede usar el recorder actual; después se debe consolidar el contrato y elegir un único camino principal.

## 9. Vacíos compartidos que todavía deben resolverse

### Prioridad crítica

1. **Contrato frontend/backend roto.** La web manda campos musicales que el backend no acepta funcionalmente; `/library/music` ya no existe; el backend falla por falta de `audio_path`.
2. **Input de dominio incorrecto.** `video_file` está tratado como video de fondo, no como video principal del presentador.
3. **Audio sin dueño.** Explainer necesita audio extraído del video; Academy necesita texto de lección convertido por TTS. Son dos adapters distintos que deben desembocar en el mismo puerto de audio.
4. **Falta de composición específica.** No existe schema para elementos gráficos, escenas, zonas seguras ni sincronización con transcript.
5. **Falta de revisión/versionado.** No hay revisiones, patches ni trazabilidad de feedback.

### Prioridad alta

6. **Análisis visual demasiado estático.** Usar solo el primer frame falla si hay intro, corte, movimiento, zoom, cambio de cámara o el presentador abandona su posición.
7. **Jobs no recuperables tras reinicio.** `asyncio.create_task` y el índice JSON permiten consultar estado, pero no reanudar automáticamente tareas perdidas al reiniciar el proceso.
8. **Persistencia orientada a un operador.** JSON en disco sirve para POC local, pero no para multiusuario, concurrencia distribuida, permisos ni auditoría fuerte.
9. **Autenticación desacoplada.** La web tiene autenticación propia basada en JSON, pero el backend no muestra aislamiento por usuario, proyecto o tenant. Un usuario autenticado no debe poder consultar o descargar jobs ajenos.
10. **Validación de uploads.** Faltan límites claros de tamaño, duración, tipos MIME reales, codecs, resolución mínima, antivirus/escaneo y manejo de archivos incompletos.
11. **Pruebas de dominio ausentes.** Las pruebas actuales validan principalmente infraestructura heredada; no cubren transcript, encuadre, timeline, patch de feedback, currículo ni exactitud educativa.

### Prioridad media

12. **Costos por job.** Academy ya registra costo estimado de TTS, pero falta un ledger consolidado de IA, transcripción, almacenamiento y render.
13. **Calidad medible.** Faltan métricas de cobertura del transcript, errores de solapamiento, legibilidad, safe zones, sincronía, factualidad y tasa de revisiones.
14. **Derechos y procedencia.** Debe quedar registrado el origen del video, música, imágenes, voces, fuentes educativas y licencias.
15. **Accesibilidad.** Subtítulos, contraste, tamaño mínimo, lectura en móvil, control de velocidad y alternativas de audio deben formar parte de los criterios de calidad.
16. **Moderación y seguridad.** Explainer admite contenido arbitrario del usuario y Academy puede dirigirse a menores; hacen falta políticas y filtros antes de publicación.

## 10. Orden de implementación que recomiendo

### Fase 0 — Congelar contratos

- Separar claramente `source_video` de `background_video`.
- Eliminar del contrato de Explainer los campos musicales que ya no aplican.
- Crear schemas Pydantic para `MediaProbe`, `Transcript`, `ContentOutline`, `CompositionSpec` y `Revision`.
- Crear un endpoint de upload de video principal y un endpoint de estado que exponga artefactos intermedios.
- Reemplazar requisitos fijos de `song.mp3` por artefactos condicionales por dominio.

**Criterio de hecho:** un video subido puede validarse, persistirse y consultarse sin entrar todavía al render.

### Fase 1 — Vertical slice de Explainer

Alcance mínimo: video 16:9, una persona a un lado, duración corta para pruebas.

1. ffprobe y validación.
2. extracción de audio.
3. Faster-Whisper con timestamps por palabra.
4. análisis de frame/zonas libres.
5. una única plantilla de overlay: título + idea clave + subtítulo.
6. preview sincronizado.
7. render final con el motor actual.

No incluir todavía chat, múltiples personas, tracking avanzado ni publicación social.

**Criterio de hecho:** subir un MP4 produce una preview y un MP4 final con overlay legible, sincronizado y sin tapar al presentador.

### Fase 2 — Revisión de Explainer

- `POST /projects/{id}/revisions` con comentario.
- El feedback se traduce a un JSON Patch o a un `CompositionPatch` validado.
- Se guarda una nueva revisión sin destruir la anterior.
- La preview se regenera sin repetir ASR ni análisis visual salvo que el usuario lo pida.

### Fase 3 — Dominio mínimo de Academy

- Crear curso, fase y lección.
- Aprobar un roadmap pequeño, no 100 videos de entrada.
- Definir `LessonSpec` con objetivos y límites.
- Generar una lección con fuentes y evaluación automática.
- Añadir voz como adapter configurable.

### Fase 4 — Piloto de Academy

- Generar una muestra pequeña, por ejemplo 3–5 lecciones representativas.
- Revisión humana antes de publicar.
- Publicación controlada.
- Esperar una ventana definida y recolectar métricas.
- Aplicar reglas explícitas: continuar, ajustar o detener.

### Fase 5 — Consolidar Nexa Render

- Formalizar `CompositionSpec` como contrato entre dominios y renderer.
- Elegir un camino principal de render.
- Añadir storage temporal, limpieza, idempotencia, reintentos y correlación de jobs.
- Recién después ampliar a más motores, formatos y clientes externos.

## 11. Criterios de éxito que faltan definir

### Explainer

- porcentaje de palabras correctamente sincronizadas;
- porcentaje de elementos fuera de safe zone;
- tasa de revisiones por video;
- tiempo desde upload hasta preview;
- tiempo desde aprobación hasta render final;
- legibilidad en móvil;
- tasa de fallos por codec, duración y tamaño.

### Academy

- exactitud factual y pedagógica por lección;
- cumplimiento del objetivo de aprendizaje;
- duración real frente a la planificada;
- porcentaje de alumnos que completa cada lección;
- retención por minuto;
- comentarios y señales de confusión;
- costo por lección y por alumno;
- criterio de promoción de una fase a la siguiente.

## 12. Mi punto de vista sobre el proyecto

La idea tiene valor porque separa tres cosas que normalmente se mezclan:

1. el conocimiento o contenido;
2. la composición visual;
3. el motor de render.

Esa separación permite que lo aprendido en un nicho se reutilice en otros. La arquitectura hexagonal y la idea de plantillas configurables van en la dirección correcta.

El riesgo principal es intentar construir una plataforma universal antes de demostrar un resultado de extremo a extremo. La universalidad no se prueba por tener muchos adapters o muchos niches en JSON; se prueba cuando un caso nuevo puede atravesar el sistema con un contrato pequeño, medible y sin excepciones manuales.

Mi recomendación concreta es:

- hacer de **Nexa Explainer** el primer producto vertical de validación, porque tiene un input, un output y un beneficio fáciles de verificar;
- construir una sola plantilla de presentador muy buena;
- no usar un LLM para generar HTML libremente en ese camino;
- hacer de **Nexa Academy** el segundo vertical, después de tener resueltos composición, preview, revisiones y costos;
- conservar `nexa-render` como infraestructura, pero evitar que la infraestructura marque el roadmap del producto.

La prioridad no es “qué modelo es más potente”. La prioridad es que cada modelo tenga un rol pequeño, un schema validable, una métrica y una salida que pueda ser corregida sin rehacer todo el pipeline.

## 13. Estado de verificación de esta revisión

- Se revisaron los documentos centrales de `nexa-docs/nexa-brief`, `nexa-docs/nexa-render` y `nexa-docs/nexa-pocs`.
- Se revisó el contrato API de `nexa-explainer-server` y los módulos de pipeline, assets, jobs, templates, recorder y transcripción.
- Se revisaron los adapters de TTS y el estudio de modelos de voz de `nexa-academy`.
- Se compararon los contratos del frontend con los endpoints actuales del backend.
- Las suites de pytest no terminaron dentro de 60 segundos en este entorno, por lo que no se presenta “todo verde” como resultado.
- Los typechecks web no pudieron ejecutarse porque `pnpm` intentó abrir su base SQLite global y el entorno la bloqueó; esto es una limitación del entorno, no una prueba de que el código compile o no compile.

Este documento deja completado el estudio y la dirección técnica. La implementación del vertical slice debe comenzar después de congelar los contratos de Fase 0; modificar el pipeline heredado antes de eso mezclaría música, fondos y video de presentador en el mismo modelo y aumentaría la deuda.
