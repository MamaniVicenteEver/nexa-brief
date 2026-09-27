# Estudio de integración de Obsidian en el ecosistema Nexa

Fecha: 2026-09-26

## 1. Conclusión ejecutiva

Sí es factible aprovechar Obsidian para Nexa Academy, Nexa Explainer y el
trabajo de investigación de Nexa Brief. La mejor decisión no es convertir
Obsidian en el servidor ni en el motor de render. La mejor decisión es usarlo
como una capa de autoría y conocimiento que se coloca antes del pipeline de
producción.

Obsidian puede ayudarnos a:

- investigar una materia y conservar las fuentes;
- construir el mapa de categorías, niveles, temas y lecciones;
- conversar con un agente y guardar cada decisión como Markdown auditable;
- redactar guiones, objetivos, ejemplos y ejercicios;
- diseñar la dirección visual antes de generar HTML, CSS y JavaScript;
- organizar audios, transcripciones, pruebas y revisiones;
- relacionar una lección con su plantilla, voz, fuente y video generado;
- dar acceso a una base documental o wiki si más adelante usamos Publish.

Obsidian no debe encargarse de:

- ejecutar el pipeline de generación de videos;
- administrar la cola de trabajos;
- almacenar API keys;
- reemplazar `nexa-academy-web` como experiencia de aprendizaje;
- reemplazar Whisper para medir los tiempos reales del audio;
- reemplazar HyperFrames, Remotion o Nexa Render;
- decidir por sí solo cuándo una lección está aprobada para producción.

La decisión recomendada es introducirlo como un `KnowledgePort` opcional. El
dominio de Academy seguirá trabajando con `Topic`, `Scheme`, `Level`, `Lesson`,
`LessonSpec`, `SourcePack`, `VisualPlan` y `QualityReport`. Obsidian será un
adaptador de entrada y revisión, no una dependencia obligatoria del render.

## 2. Qué aporta Obsidian

Obsidian trabaja sobre archivos locales y formatos abiertos. La aplicación
puede usarse sin registro y los archivos Markdown permanecen en el equipo del
usuario. Sus propiedades permiten guardar datos estructurados como texto,
listas, números, fechas, etiquetas y casillas; sus notas se pueden relacionar
con enlaces internos, backlinks y vista gráfica.

Canvas permite organizar notas, archivos adjuntos y páginas web en un espacio
visual, guardando el tablero en el formato abierto JSON Canvas. Bases permite
construir vistas tipo tabla sobre los archivos y filtrar por propiedades. Estas
capacidades encajan bien con la planificación curricular y el seguimiento de
lecciones.

Fuentes oficiales:

- [Obsidian Help](https://obsidian.md/help/)
- [Properties](https://obsidian.md/help/properties)
- [Canvas](https://obsidian.md/help/plugins/canvas)
- [Bases](https://obsidian.md/help/bases/create-base)
- [Core plugins](https://obsidian.md/help/plugins)

## 3. Relación con nuestros proyectos actuales

### Nexa Academy

Es el lugar donde Obsidian aporta más valor. Academy ya tiene el flujo de
materias, niveles, agentes, planes, voces, transcripción y plantillas
educativas.

Obsidian puede convertirse en el espacio donde una persona y los agentes
trabajan antes de crear los jobs reales:

```text
investigación
  -> plan de materia
  -> nivel
  -> tema
  -> lección
  -> guion aprobado
  -> dirección visual
  -> voz y modelo
  -> audio medido con Whisper
  -> composición HyperFrames
  -> video
```

Esto complementa el flujo ya documentado en
`nexa-academy/nexa-docs/plan-flujo-academy-completo.md`.

### Nexa Explainer

Explainer puede usar Obsidian para guardar:

- la investigación del video que el usuario grabará;
- el perfil de la audiencia;
- la lista de afirmaciones que deben aparecer;
- la estructura de escenas;
- el texto de los títulos y subtítulos;
- las decisiones sobre plantilla, tipografía, paleta y posición del panel;
- la revisión humana antes de aprobar el MP4.

El video subido, la transcripción y el render deben seguir viviendo en el
almacenamiento de Explainer. Obsidian solo guarda el manifiesto, los enlaces y
las decisiones editoriales, salvo que el usuario decida conservar una copia
local de un asset.

### Nexa Brief

Obsidian puede servir como bandeja de investigación y biblioteca de patrones
reutilizables. No conviene que el Brief lea notas arbitrarias para producir un
video musical. Si se conecta, debe recibir un `ContentSpec` o un JSON validado,
no una carpeta completa con instrucciones ambiguas.

### Nexa Render, HyperFrames y Remotion

Estos sistemas deben seguir siendo responsables de generar el resultado
audiovisual. Obsidian puede guardar:

- el identificador de la plantilla;
- la versión de la plantilla;
- los valores de sus variables;
- el enlace al preview;
- el manifiesto de audio y subtítulos;
- el resultado de QA;
- la ruta o URL del video final.

Obsidian no debe intentar renderizar el video dentro de una nota. La relación
correcta es: Obsidian define y revisa; Academy valida; el motor renderiza.

## 4. Cómo ayudaría a grabar y dar clases

### 4.1 Preparar una clase

Una nota de lección puede reunir en un solo lugar:

- objetivo de aprendizaje;
- conocimientos previos;
- explicación principal;
- ejemplo resuelto;
- errores frecuentes;
- ejercicio guiado;
- ejercicio de práctica;
- respuesta esperada;
- referencias;
- guion de narración;
- palabras o frases que deben resaltarse;
- plantilla visual seleccionada;
- modelo y voz;
- estado de aprobación.

Con enlaces internos, una lección puede apuntar a su materia, nivel, fuente,
plantilla, audio, transcripción y video. Así se evita que el guion quede
separado de la evidencia y de la composición que lo representa.

### 4.2 Grabar una explicación provisional

Obsidian incluye un plugin oficial de grabación de audio que permite grabar y
guardar audio dentro de una nota. Eso sirve para:

- registrar una explicación espontánea del profesor;
- guardar una observación durante la revisión de una lección;
- probar una pronunciación antes de generar TTS;
- dejar feedback de una plantilla;
- capturar una idea cuando no conviene escribirla.

El plugin oficial es un grabador de audio, no un sistema completo de grabación
de video ni de producción de clases. El archivo grabado puede convertirse en
entrada del flujo de Academy, pero todavía debe pasar por normalización,
transcripción, QA y render.

Fuente oficial: [Audio recorder](https://obsidian.md/help/plugins/audio-recorder).

### 4.3 Dar la clase al estudiante

Hay tres opciones distintas:

1. **Nexa Academy web**: opción recomendada para la experiencia final. Permite
   controlar el catálogo, progreso, videos, subtítulos, usuarios y futuras
   evaluaciones.
2. **Obsidian local**: útil para el profesor, el equipo editorial y una
   revisión interna. No requiere publicar contenido.
3. **Obsidian Publish**: puede servir como wiki o documentación pública de una
   materia. Tiene navegación por enlaces, backlinks, búsqueda, previews y
   graph view, pero no reemplaza la experiencia interactiva de Academy.

Publish es un servicio separado y actualmente aparece en la página oficial con
precio de 8 USD por sitio al mes facturado anualmente o 10 USD mensualmente.
Los precios pueden cambiar y deben verificarse antes de contratarlo.

Fuente oficial: [Obsidian Publish](https://obsidian.md/publish).

## 5. Arquitectura propuesta

```text
┌─────────────────────────────────────────────────────────────┐
│ Obsidian vault                                              │
│ Markdown, YAML, Canvas, Bases, audio, fuentes y revisiones  │
└─────────────────────────────┬───────────────────────────────┘
                              │ KnowledgePort
                              v
┌─────────────────────────────────────────────────────────────┐
│ Academy application layer                                   │
│ importación, validación, normalización y aprobación humana  │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
                v                       v
       agentes y planificación     LessonSpec / SourcePack
                │                       │
                └───────────────┬───────┘
                                v
┌─────────────────────────────────────────────────────────────┐
│ Producción audiovisual                                     │
│ VoicePort -> Whisper -> VisualPlan -> HyperFrames/Remotion  │
│ -> Nexa Render -> QA -> publicación                        │
└─────────────────────────────────────────────────────────────┘
```

### Regla de dependencia

El servidor nunca debe importar módulos internos de Obsidian ni depender de
que la aplicación de escritorio esté abierta. El adaptador puede trabajar con
archivos Markdown locales o con una exportación controlada. Si Obsidian no está
instalado, Academy debe seguir funcionando con su repositorio JSON o SQL.

### Puerto sugerido

```python
class KnowledgePort(Protocol):
    async def import_lesson(self, source_path: Path) -> LessonSpec: ...
    async def export_lesson(self, lesson: LessonSpec, destination: Path) -> Path: ...
    async def validate_note(self, source_path: Path) -> ValidationReport: ...
```

Adapters posibles:

1. `MarkdownKnowledgeAdapter`: lee Markdown y YAML desde una carpeta local.
2. `ObsidianCliAdapter`: usa la CLI de Obsidian cuando esté disponible.
3. `ApiKnowledgeAdapter`: futuro adaptador para un servicio documental remoto.
4. `JsonKnowledgeAdapter`: fallback para pruebas, CI y servidores sin Obsidian.

La factory debe seleccionar el adapter por configuración, de la misma forma
que hoy se seleccionan los proveedores de voz y los motores de render. El
dominio no debe saber si una lección vino de Obsidian, de la API o de un JSON.

## 6. Estructura recomendada del vault

Para no mezclar código, credenciales y artefactos pesados con el conocimiento
educativo, recomiendo un vault separado:

```text
nexa-academy/
├── nexa-academy-knowledge/          # vault de Obsidian
│   ├── 00-inbox/
│   ├── 01-research/
│   ├── 02-curriculum/
│   │   ├── english/
│   │   ├── mathematics/
│   │   ├── history/
│   │   └── science/
│   ├── 03-lessons/
│   ├── 04-source-packs/
│   ├── 05-visual-plans/
│   ├── 06-voice-and-audio/
│   ├── 07-transcripts/
│   ├── 08-reviews/
│   ├── 09-published/
│   ├── _templates/
│   ├── _attachments/
│   └── _indexes/
└── nexa-docs/                       # documentación de ingeniería existente
```

Durante el piloto también se puede abrir directamente
`nexa-academy/nexa-docs` como vault, pero no recomiendo usar esa carpeta como
el único espacio de contenido de cursos a largo plazo. `nexa-docs` documenta
cómo se construye el sistema; `nexa-academy-knowledge` documentaría qué se
enseña.

No deben entrar al vault:

- `.env`, `.env.local` ni API keys;
- `node_modules`, `.venv` y `.next`;
- colas internas de producción;
- videos intermedios grandes sin una política de almacenamiento;
- archivos temporales de FFmpeg;
- credenciales OAuth o tokens de publicación.

## 7. Contrato de una nota de lección

El contenido humano puede seguir siendo Markdown, pero el encabezado debe ser
estructurado y validable:

```yaml
---
kind: lesson
schema_version: "1.0.0"
id: english-a1-greetings-01
topic_id: english
scheme_id: cefr
level_id: a1
unit: greetings
status: draft
title: Saludos básicos en inglés
objectives:
  - Reconocer saludos cotidianos.
  - Pronunciar hello y good morning.
template_id: academy-english-story-journey-v1
voice:
  provider: novita
  engine: fish
  voice: Patient_Man
  style: cercano_cotidiano
render:
  engine: hyperframes
  duration_seconds: 900
  pilot_duration_seconds: 15
sources:
  - "[[source-english-greetings]]"
---

## Explicación

## Ejemplo

## Práctica guiada

## Guion de narración

## Criterios de revisión
```

El validador de Academy debe rechazar una nota si falta `id`, `status`,
`objectives`, `template_id`, `voice`, `sources` o el cuerpo pedagógico mínimo.
El Markdown no debe permitir que una nota cambie directamente el proveedor o
publique un video sin pasar por aprobación.

## 8. Integración con la conversación de agentes

El flujo recomendado es:

```text
usuario conversa con planner
  -> Academy crea una nota draft en 00-inbox
  -> researcher agrega SourcePack y dudas
  -> curriculum propone niveles y lecciones
  -> usuario edita o comenta en Obsidian
  -> Academy importa y valida la nota
  -> usuario aprueba explícitamente el plan
  -> se crean jobs en la cola
```

Cada nota generada por un agente debe guardar:

- agente y versión del prompt;
- modelo utilizado;
- fecha y duración de la ejecución;
- fuentes que recibió;
- JSON producido;
- advertencias y campos pendientes;
- relación con la nota humana que la aprobó.

Obsidian ayuda a revisar y conectar el material; la aprobación formal sigue
siendo un estado de Academy como `PENDING_APPROVAL`, `APPROVED` o
`NEEDS_REVISION`.

## 9. Integración con investigación y fuentes

Web Clipper puede guardar páginas, selecciones y resaltados en el vault usando
plantillas y variables. Esto es útil para investigación de historia, ciencias,
matemática e inglés. La fuente capturada debe conservar URL, fecha, autor,
fragmento usado y estado de verificación.

La investigación no debe copiarse directamente al prompt final. El flujo debe
transformarla en un `SourcePack` con:

- fuentes originales;
- afirmaciones extraídas;
- ejemplos aprobados;
- conceptos que deben explicarse;
- nivel de dificultad;
- dudas y datos sin verificar.

Fuente oficial: [Obsidian Web Clipper](https://obsidian.md/help/web-clipper).

## 10. Integración con audio, voz y subtítulos

Obsidian puede conservar la intención editorial y, si se desea, una grabación
provisional. La producción debe continuar en Academy:

```text
guion en nota
  -> VoicePort Gemini o Novita
  -> audio final
  -> FasterWhisperAdapter
  -> segmentos y palabras reales
  -> reading_cues
  -> plantilla HTML/HyperFrames
  -> video con subtítulos sincronizados
```

Esto respeta la decisión ya documentada en
`whisper-timing-para-narracion-y-subtitulos.md`: el audio final es la fuente de
verdad del tiempo. Obsidian no debe calcular la sincronización dividiendo el
texto por caracteres ni sustituir a Whisper.

## 11. Plantillas de Obsidian que deberíamos crear

La función Templates de Obsidian permite insertar fragmentos predefinidos y
variables como título, fecha y hora. Para el piloto serían suficientes estas
plantillas:

| Plantilla | Resultado |
|---|---|
| `topic.md` | Materia, descripción, niveles y responsable |
| `level.md` | Nivel, prerrequisitos, objetivos y temas |
| `lesson.md` | Lección completa con guion, ejemplo y práctica |
| `source-pack.md` | Fuentes, afirmaciones y verificación |
| `visual-plan.md` | Escenas, colores, tipografía y plantilla |
| `voice-plan.md` | Proveedor, modelo, voz, instrucción y costo |
| `review.md` | QA de contenido, audio, timing y diseño |
| `pilot-report.md` | Comparación de videos y decisión de continuar |

La plantilla de Obsidian solo acelera la escritura. La validación oficial debe
vivir en Academy para evitar que una nota incompleta llegue a la cola.

## 12. Vistas para administrar el trabajo

Con Properties y Bases se puede construir una vista de seguimiento:

| Estado | Significado |
|---|---|
| `draft` | Idea o contenido inicial |
| `researching` | Falta completar fuentes |
| `needs_review` | El agente terminó, falta revisión humana |
| `approved` | Puede entrar al lote |
| `generating` | Tiene job en ejecución |
| `ready_for_review` | Video listo para revisión |
| `published` | Video aprobado y entregado |
| `paused` | Se conserva, pero no avanza |

Estas vistas sirven para revisión editorial. No sustituyen la cola persistente
ni el estado de ejecución del backend; el backend debe ser la fuente de verdad
para `queued`, `running`, `completed` y `failed`.

## 13. Automatización con Obsidian URI y CLI

Obsidian URI permite abrir una nota, crear una nota, abrir una búsqueda o
abrir la nota diaria desde otra aplicación. Esto permitiría que la interfaz de
Academy tenga acciones como:

- abrir la nota de una lección;
- abrir el SourcePack asociado;
- crear una nota de revisión para un video;
- abrir la búsqueda de todas las lecciones `needs_review`.

La documentación oficial también incluye una CLI para leer archivos, buscar,
abrir notas y ejecutar acciones de desarrollo. En una primera integración
podemos usar URI/CLI como comodidad local, pero no como requisito del servidor.

Fuentes oficiales:

- [Obsidian URI](https://help.obsidian.md/Extending%2BObsidian/Obsidian%2BURI)
- [Obsidian CLI](https://obsidian.md/help/cli)

## 14. Seguridad y operación

El vault debe considerarse documentación de trabajo, no un almacén de
secretos. Aunque los datos locales son privados por defecto, el riesgo cambia
si se habilitan Sync, Publish o plugins de terceros.

Sync ofrece cifrado de extremo a extremo, historial de versiones y sincroniza
notas, audio, video y otros adjuntos. La página oficial muestra actualmente
Sync Standard a 4 USD por usuario al mes facturado anualmente o 5 USD mensual,
y Sync Plus a 8 USD anual o 10 USD mensual, con límites diferentes de
almacenamiento y tamaño de archivo. Debe verificarse el precio antes de
contratarlo.

Los plugins comunitarios ejecutan código de terceros. Para el primer piloto
recomiendo usar únicamente plugins oficiales: Properties, Templates, Canvas,
Bases, Audio recorder, Backlinks, Graph y Search. Si después se instala un
plugin comunitario, debe pasar por revisión y quedar fijado en la documentación
del vault.

Fuentes oficiales:

- [Obsidian Sync](https://obsidian.md/sync)
- [Security and privacy](https://help.obsidian.md/Obsidian%2BSync/Security%2Band%2Bprivacy)
- [Community plugins](https://obsidian.md/help/community-plugins)

## 15. Qué no conviene hacer

No recomiendo:

1. Hacer que FastAPI dependa de que Obsidian esté abierto.
2. Guardar `NOVITA_IA`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` u OAuth en notas.
3. Permitir que una nota libre ejecute HTML o JavaScript en producción.
4. Usar Obsidian como cola de jobs.
5. Guardar en Markdown el estado mutable de cada worker como única fuente.
6. Duplicar en Obsidian el catálogo completo de plantillas sin un ID estable.
7. Usar Publish como sustituto de la aplicación educativa.
8. Instalar muchos plugins antes de cerrar el contrato de las notas.

## 16. Plan de implementación por etapas

### Etapa 0: piloto manual, sin cambios de producción

1. Abrir `nexa-academy/nexa-docs` como vault para comprobar la experiencia.
2. Crear una carpeta de prueba para una lección de matemática y otra de inglés.
3. Activar Templates, Properties, Canvas y Bases.
4. Crear manualmente una nota de `lesson.md`, un `source-pack.md` y un
   `visual-plan.md`.
5. Añadir enlaces a las plantillas HTML, al audio TTS y al video de prueba.

### Etapa 1: vault educativo separado

1. Crear `nexa-academy/nexa-academy-knowledge/`.
2. Añadir los contratos YAML y las plantillas de notas.
3. Definir las categorías inglés, matemática, historia y ciencias.
4. Versionar Markdown y Canvas con Git.
5. Añadir un `.gitignore` que excluya secretos, builds y assets grandes.

### Etapa 2: importación controlada en Academy

1. Crear `KnowledgePort`.
2. Implementar `MarkdownKnowledgeAdapter`.
3. Validar frontmatter y cuerpo de la lección.
4. Convertir una nota aprobada en `LessonSpec`.
5. Mostrar errores en la interfaz antes de crear un job.

### Etapa 3: flujo audiovisual

1. Generar audio con `VoicePort`.
2. Transcribir el audio final con Whisper.
3. Generar `VisualPlan` y `reading_cues`.
4. Montar variables en la plantilla HyperFrames.
5. Crear video piloto de 15 segundos.
6. Escribir el resultado y el enlace al video en una nota de revisión.

### Etapa 4: conversación y sincronización

1. Crear una nota draft automáticamente desde la sesión del agente.
2. Permitir que el usuario la edite en Obsidian.
3. Importar cambios mediante un botón de validar.
4. Mantener aprobación y cola en Academy.
5. Abrir desde la interfaz la nota relacionada mediante Obsidian URI.

### Etapa 5: publicación y colaboración

Evaluar Sync si se trabaja desde varios equipos y Publish si se necesita una
wiki pública o privada. Para la enseñanza final, mantener Nexa Academy como
producto principal y usar Publish solo para documentación, referencias o
material complementario.

## 17. Decisión recomendada

Adoptar Obsidian en Nexa como herramienta de trabajo editorial y de
conocimiento, con estas reglas:

- el vault contiene Markdown, YAML, Canvas, fuentes, decisiones y enlaces;
- Academy transforma notas validadas en contratos de dominio;
- los agentes escriben borradores, nunca aprueban producción;
- VoicePort genera el audio;
- Whisper mide el audio real;
- HyperFrames, Remotion o Nexa Render generan el video;
- la cola y los jobs permanecen en el backend;
- Nexa Academy Web entrega la experiencia al estudiante.

El beneficio principal no es grabar video dentro de Obsidian. El beneficio es
tener una memoria educativa conectada: cada video puede regresar a su lección,
cada lección a sus fuentes, cada fuente a una decisión de investigación y cada
revisión a una versión del contenido. Esa trazabilidad es la pieza que más
ayudaría a escalar de prototipos aislados a una fábrica de clases.
