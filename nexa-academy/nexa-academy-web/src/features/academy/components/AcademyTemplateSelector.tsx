"use client";

import {
  Archive,
  ArrowRight,
  AudioLines,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleDot,
  CircleHelp,
  CirclePlay,
  Code2,
  FlaskConical,
  Forward,
  GitBranch,
  Lightbulb,
  Map as MapIcon,
  Maximize2,
  MessageCircle,
  Network,
  Orbit,
  Palette,
  Pause,
  PenTool,
  Play,
  Rewind,
  Search,
  TestTube2,
  Type,
  Workflow,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "@/i18n/navigation";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { getAcademyTemplates } from "../api/academy-service";
import styles from "./AcademyTemplateSelector.module.css";

type CategoryId = "english" | "mathematics" | "history" | "science";
type TemplateKind =
  | "board"
  | "workshop"
  | "pythagoras"
  | "story"
  | "phrase"
  | "historySource"
  | "historyTimeline"
  | "scienceInquiry"
  | "scienceSystem";

type TemplateDefinition = {
  id: string;
  categoryId: CategoryId;
  kind: TemplateKind;
  name: string;
  eyebrow: string;
  summary: string;
  learningMode: string;
  palette: { primary: string; secondary: string; tertiary: string; surface: string; ink: string };
  typography: { display: string; body: string; specialist: string };
  components: string[];
  sceneRecipe: string[];
  motion: { entrance: string; transition: string; ambient: string };
  variables: string[];
  tech: string[];
  durationSeconds?: number;
  sourceFiles?: Record<string, string>;
};

const DEFAULT_DURATION_SECONDS = 30;
const ACADEMY_INTRO_DURATION_SECONDS = 4;
const WORKSHOP_TOKENS = [1, 2, 3, 4, 5, 6];
const STORY_MOMENTS = [
  {
    label: "CONTEXT",
    title: "A small plan for today",
    phrase: "Let's meet after class.",
    note: "Escucha la idea completa antes de repetirla.",
  },
  {
    label: "USEFUL PHRASE",
    title: "Let's meet after class.",
    phrase: "Let's + verbo + momento",
    note: "Una invitación breve y natural.",
  },
  {
    label: "YOUR TURN",
    title: "Let's meet at five.",
    phrase: "Elige un momento para completar la frase.",
    note: "Ahora la idea también puede ser tuya.",
  },
  {
    label: "SAY IT",
    title: "Let's meet at five.",
    phrase: "Ready to use in a real conversation.",
    note: "Repite con calma y conserva el ritmo.",
  },
] as const;
const PHRASE_WORDS = [
  { text: "I", role: "who" },
  { text: "am", role: "verb" },
  { text: "ready", role: "idea" },
  { text: "for", role: "bridge" },
  { text: "class", role: "idea" },
] as const;
const HISTORY_SOURCE_STEPS = [
  {
    label: "OBSERVE",
    title: "What do you notice first?",
    detail:
      "Mira el documento sin explicar todavía. Identifica personas, lugar y detalles visibles.",
    prompt: "I see...",
  },
  {
    label: "QUESTION",
    title: "What do you want to know?",
    detail: "Una pregunta convierte la imagen en una investigación concreta.",
    prompt: "I wonder...",
  },
  {
    label: "CONTEXT",
    title: "Who made this, and why?",
    detail: "La fecha, el autor y la audiencia ayudan a leer el pasado con cuidado.",
    prompt: "The source suggests...",
  },
  {
    label: "INTERPRET",
    title: "Build a supported idea.",
    detail: "La conclusión vuelve a la evidencia y separa lo que vemos de lo que inferimos.",
    prompt: "My evidence is...",
  },
] as const;
const HISTORY_TIMELINE_EVENTS = [
  { year: "01", label: "Condición", title: "La situación comienza", kind: "context" },
  { year: "02", label: "Decisión", title: "Una acción cambia el rumbo", kind: "cause" },
  { year: "03", label: "Respuesta", title: "Aparece una consecuencia", kind: "effect" },
  { year: "04", label: "Memoria", title: "La historia deja una pregunta", kind: "legacy" },
] as const;
const SCIENCE_INQUIRY_STEPS = [
  {
    label: "ASK",
    title: "Why did the shadow move?",
    detail: "Una pregunta clara define qué vamos a observar.",
  },
  {
    label: "PREDICT",
    title: "I think the light changed.",
    detail: "La predicción se puede comprobar; no es todavía una conclusión.",
  },
  {
    label: "TEST",
    title: "Change one variable.",
    detail: "Comparamos dos observaciones y mantenemos lo demás estable.",
  },
  {
    label: "EXPLAIN",
    title: "The evidence supports the idea.",
    detail: "La explicación nombra el patrón y vuelve a la evidencia.",
  },
] as const;
const SCIENCE_SYSTEM_NODES = [
  { label: "ENERGY", detail: "entra", angle: "top" },
  { label: "CHANGE", detail: "se transforma", angle: "right" },
  { label: "MATTER", detail: "circula", angle: "bottom" },
  { label: "EVIDENCE", detail: "lo hacemos visible", angle: "left" },
] as const;

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "academy-mathematics-chalkboard-solve-v1",
    categoryId: "mathematics",
    kind: "board",
    name: "Pizarra de resolución",
    eyebrow: "MATEMÁTICA / DEMOSTRACIÓN GUIADA",
    summary:
      "Una clase construida en una pizarra: el problema aparece, la operación se escribe, se explica el porqué y se comprueba la respuesta.",
    learningMode: "Demostración guiada",
    palette: {
      primary: "#123B2D",
      secondary: "#F4E6B5",
      tertiary: "#F47D5B",
      surface: "#0D2C22",
      ink: "#F7F1DD",
    },
    typography: { display: "League Gothic", body: "Montserrat", specialist: "KaTeX para fórmulas" },
    components: [
      "Intro breve con problema y resultado",
      "Teoría del reparto equitativo",
      "Pizarra con cuadrícula tenue",
      "Filas de grupos iguales",
      "Ejemplos de referencia y recomendaciones",
      "Comprobación mediante multiplicación",
      "Subtítulo sincronizado",
    ],
    sceneRecipe: [
      "Intro de la lección",
      "Teoría",
      "Ejemplo base",
      "Reparto en filas",
      "Comprobación",
      "Práctica",
      "Cierre",
    ],
    motion: {
      entrance:
        "La intro fija la pregunta y el resultado; después la pizarra construye cada fila con un golpe de tiza.",
      transition:
        "La teoría se convierte en filas de grupos y termina con una comprobación visible.",
      ambient: "Polvo de tiza y halo suave, finitos y sincronizados con la línea de tiempo.",
    },
    variables: [
      "problem_statement",
      "operation_tex",
      "steps",
      "reasoning",
      "inverse_check",
      "practice_prompt",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "KaTeX", "SVG de tiza"],
    durationSeconds: 90,
  },
  {
    id: "academy-mathematics-number-line-workshop-v1",
    categoryId: "mathematics",
    kind: "workshop",
    name: "Taller de línea numérica",
    eyebrow: "MATEMÁTICA / EXPLORACIÓN VISUAL",
    summary:
      "Una mesa de trabajo para volver visibles cantidades, saltos y agrupaciones antes de formalizar la operación.",
    learningMode: "Exploración visual",
    palette: {
      primary: "#295C8A",
      secondary: "#F5B84E",
      tertiary: "#E9505E",
      surface: "#F3EEE3",
      ink: "#17263A",
    },
    typography: {
      display: "Archivo Black",
      body: "Montserrat",
      specialist: "KaTeX para relaciones",
    },
    components: [
      "Mesa de papel cuadriculado",
      "Línea numérica con saltos",
      "Fichas agrupables",
      "Marcador de equivalencia",
      "Subtítulo sincronizado",
    ],
    sceneRecipe: ["Cantidad", "Grupos", "Saltos", "Relación"],
    motion: {
      entrance: "Las fichas se ordenan en grupos y cada salto de la recta queda marcado.",
      transition: "La recta se desplaza hacia el resultado sin cortar el razonamiento.",
      ambient: "Paralaje corto entre papel, fichas y anotaciones de la mesa.",
    },
    variables: [
      "quantity",
      "group_size",
      "number_line_marks",
      "operation_tex",
      "worked_example",
      "practice_prompt",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "KaTeX", "SVG de fichas"],
  },
  {
    id: "academy-mathematics-pythagoras-triangle-v1",
    categoryId: "mathematics",
    kind: "pythagoras",
    name: "Mapa del triángulo rectángulo",
    eyebrow: "MATEMÁTICA / GEOMETRÍA APLICADA",
    summary:
      "Una demostración visual identifica los catetos, encuentra la hipotenusa y comprueba el resultado con un triángulo rectángulo.",
    learningMode: "Comprender una relación geométrica",
    palette: {
      primary: "#295C8A",
      secondary: "#F5B84E",
      tertiary: "#E9505E",
      surface: "#F3EEE3",
      ink: "#17263A",
    },
    typography: {
      display: "Archivo Black",
      body: "Montserrat",
      specialist: "KaTeX para relaciones",
    },
    components: [
      "Intro de materia con identidad de Nexa Academy",
      "Triángulo rectángulo a escala visual",
      "Catetos a y b identificados",
      "Hipotenusa c frente al ángulo recto",
      "Fórmula con sustitución paso a paso",
      "Subtítulo sincronizado",
      "Cierre con resumen y siguiente paso",
    ],
    sceneRecipe: [
      "Intro de la lección",
      "Concepto",
      "Diagrama",
      "Teoría y ejemplo",
      "Prueba",
      "Comprobación",
      "Cierre",
    ],
    motion: {
      entrance: "El triángulo aparece primero y el ángulo recto fija la relación entre sus lados.",
      transition: "Cada lado se ilumina antes de sustituir sus medidas en la fórmula.",
      ambient:
        "Papel cuadriculado, líneas azules y acentos amarillos para mantener una lectura clara.",
    },
    variables: [
      "triangle_sides",
      "right_angle",
      "pythagorean_formula",
      "worked_example",
      "inverse_check",
      "practice_prompt",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "KaTeX", "SVG geométrico"],
    durationSeconds: 90,
  },
  {
    id: "academy-english-story-journey-v1",
    categoryId: "english",
    kind: "story",
    name: "Historia para hablar",
    eyebrow: "INGLÉS / SITUACIÓN COTIDIANA",
    summary:
      "Una escena cálida que presenta una situación, modela una frase útil y deja un espacio claro para que el estudiante la haga suya.",
    learningMode: "Aprender dentro de una historia",
    palette: {
      primary: "#2E6B67",
      secondary: "#F5C76A",
      tertiary: "#E97961",
      surface: "#FFF8EC",
      ink: "#203A3A",
    },
    typography: {
      display: "Fraunces",
      body: "Montserrat",
      specialist: "IBM Plex Mono para frases",
    },
    components: [
      "Escena ilustrada de situación cotidiana",
      "Personajes con foco suave y expresivo",
      "Frase útil construida en contexto",
      "Espacio de respuesta del estudiante",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Contexto", "Frase útil", "Tu turno", "Dilo en voz alta"],
    motion: {
      entrance:
        "El escenario aparece como una pequeña historia: lugar, personajes y objetivo antes de mostrar la frase.",
      transition:
        "La cámara se acerca al objeto importante y la frase pasa de la historia a una guía reutilizable.",
      ambient:
        "Luz de mañana, papel cálido y movimiento orgánico breve; cada gesto tiene una intención didáctica.",
    },
    variables: [
      "situation",
      "characters",
      "target_phrase",
      "translation",
      "usage_note",
      "student_response",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "Lucide", "SVG ilustrado local"],
  },
  {
    id: "academy-english-phrase-builder-v1",
    categoryId: "english",
    kind: "phrase",
    name: "Mesa de frases",
    eyebrow: "INGLÉS / CONSTRUCCIÓN GUIADA",
    summary:
      "Una mesa de clase donde las palabras se ordenan, se conectan y se leen como una oración que el estudiante puede reutilizar.",
    learningMode: "Construir y decir",
    palette: {
      primary: "#315A87",
      secondary: "#F2B84B",
      tertiary: "#E66B5B",
      surface: "#F5F1E8",
      ink: "#1F3045",
    },
    typography: {
      display: "DM Sans",
      body: "Montserrat",
      specialist: "JetBrains Mono para estructura",
    },
    components: [
      "Mesa de trabajo con textura de papel",
      "Palabras móviles por función gramatical",
      "Conectores y flecha de lectura",
      "Ejemplo positivo y práctica breve",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Intención", "Palabras", "Orden", "Práctica"],
    motion: {
      entrance:
        "La intención aparece primero y las palabras llegan una por una, como piezas que el profesor coloca sobre la mesa.",
      transition:
        "Cada pieza encuentra su lugar con un movimiento corto y la flecha guía la lectura completa de izquierda a derecha.",
      ambient:
        "Papel claro, sombras blandas y pequeños trazos de marcador; la pantalla respira y no se llena de paneles.",
    },
    variables: [
      "learning_intent",
      "word_tiles",
      "grammar_hint",
      "worked_sentence",
      "practice_prompt",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "KaTeX opcional", "SVG de piezas"],
  },
  {
    id: "academy-history-source-inquiry-v1",
    categoryId: "history",
    kind: "historySource",
    name: "Detectives de fuentes",
    eyebrow: "HISTORIA / PENSAR CON EVIDENCIA",
    summary:
      "Una investigación visual que parte de una fotografía o documento y guía al estudiante desde observar hasta interpretar con evidencia.",
    learningMode: "Analizar una fuente primaria",
    palette: {
      primary: "#5C4638",
      secondary: "#D9A441",
      tertiary: "#B85C52",
      surface: "#F4E9D8",
      ink: "#2E2925",
    },
    typography: {
      display: "Fraunces",
      body: "Montserrat",
      specialist: "IBM Plex Mono para archivo",
    },
    components: [
      "Fuente primaria como objeto central",
      "Marcadores de observación y evidencia",
      "Rueda observe / question / context",
      "Separación entre hecho e interpretación",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Observar", "Preguntar", "Contextualizar", "Interpretar"],
    motion: {
      entrance:
        "El documento entra como un objeto de archivo y los detalles importantes se revelan con una lupa visual.",
      transition:
        "Cada pregunta abre una capa de contexto; la evidencia permanece visible mientras cambia la lectura.",
      ambient:
        "Papel, tinta y una línea de registro sobria; el archivo se siente cercano sin convertirse en una presentación rígida.",
    },
    variables: [
      "source_type",
      "source_title",
      "observations",
      "questions",
      "historical_context",
      "evidence_claims",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "Lucide", "SVG de archivo local"],
  },
  {
    id: "academy-history-cause-timeline-v1",
    categoryId: "history",
    kind: "historyTimeline",
    name: "Mapa de causas y cambios",
    eyebrow: "HISTORIA / SECUENCIA Y CONSECUENCIAS",
    summary:
      "Una línea de tiempo viva conecta condiciones, decisiones y consecuencias para explicar procesos sin perder a los protagonistas.",
    learningMode: "Entender un proceso histórico",
    palette: {
      primary: "#254F5C",
      secondary: "#E7B95C",
      tertiary: "#D16B5B",
      surface: "#EEF4F0",
      ink: "#203438",
    },
    typography: {
      display: "DM Sans",
      body: "Montserrat",
      specialist: "JetBrains Mono para fechas",
    },
    components: [
      "Línea de tiempo con cuatro hitos",
      "Flechas de causa y consecuencia",
      "Actores y decisiones destacados",
      "Tarjeta de legado y pregunta abierta",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Condición", "Decisión", "Respuesta", "Legado"],
    motion: {
      entrance:
        "La línea se dibuja de izquierda a derecha y cada hito aparece cuando la narración llega a él.",
      transition:
        "Una flecha conecta el hito activo con su consecuencia para que el cambio se pueda seguir.",
      ambient:
        "Mapa de papel, marcas de archivo y contraste cálido; el movimiento guía la secuencia sin decorarla de más.",
    },
    variables: [
      "period_title",
      "timeline_events",
      "actors",
      "causes",
      "consequences",
      "legacy_question",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "Lucide", "SVG de línea de tiempo"],
  },
  {
    id: "academy-science-inquiry-lab-v1",
    categoryId: "science",
    kind: "scienceInquiry",
    name: "Laboratorio de hipótesis",
    eyebrow: "CIENCIAS / PREGUNTAR Y COMPROBAR",
    summary:
      "Un pequeño laboratorio visual convierte una pregunta en predicción, prueba y explicación apoyada en observaciones.",
    learningMode: "Indagación científica",
    palette: {
      primary: "#176B78",
      secondary: "#F2C14E",
      tertiary: "#E66C5B",
      surface: "#EAF6F4",
      ink: "#19383D",
    },
    typography: { display: "DM Sans", body: "Montserrat", specialist: "JetBrains Mono para datos" },
    components: [
      "Pregunta visible como punto de partida",
      "Predicción diferenciada de conclusión",
      "Diagrama simple de variables",
      "Gráfica de observaciones",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Pregunta", "Predicción", "Prueba", "Evidencia"],
    motion: {
      entrance:
        "La pregunta aparece antes del aparato para que la demostración tenga un propósito claro.",
      transition:
        "Una variable cambia, la observación se registra y la gráfica crece con datos concretos.",
      ambient:
        "Mesa de laboratorio clara, vidrio, tinta y acentos de seguridad; precisión sin estética fría.",
    },
    variables: [
      "question",
      "hypothesis",
      "variables",
      "observation_steps",
      "data_points",
      "conclusion",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "Lucide", "SVG de gráfica"],
  },
  {
    id: "academy-science-system-map-v1",
    categoryId: "science",
    kind: "scienceSystem",
    name: "Mapa de un sistema",
    eyebrow: "CIENCIAS / RELACIONES Y CICLOS",
    summary:
      "Un mapa animado muestra cómo las partes de un sistema se conectan, cambian y vuelven a influirse entre sí.",
    learningMode: "Comprender relaciones",
    palette: {
      primary: "#315D8B",
      secondary: "#6CC5B5",
      tertiary: "#F08A5D",
      surface: "#F1F6F4",
      ink: "#21354B",
    },
    typography: {
      display: "Fraunces",
      body: "Montserrat",
      specialist: "JetBrains Mono para etiquetas",
    },
    components: [
      "Diagrama central de sistema",
      "Nodos con función y estado",
      "Flechas de flujo y transformación",
      "Indicador de entrada y salida",
      "Subtítulo inferior sincronizado",
    ],
    sceneRecipe: ["Entrada", "Transformación", "Circulación", "Sistema completo"],
    motion: {
      entrance:
        "El sistema comienza con una entrada y añade cada parte solo cuando su función es necesaria.",
      transition:
        "Las flechas se iluminan en orden para mostrar flujo, retorno y dependencia entre elementos.",
      ambient:
        "Fondo de cuaderno científico, halos suaves y nodos limpios; las conexiones hacen visible el razonamiento.",
    },
    variables: [
      "system_name",
      "nodes",
      "flows",
      "input_output",
      "transformation_rule",
      "example_case",
      "caption_segments",
    ],
    tech: ["HyperFrames", "GSAP", "Lucide", "SVG de diagrama"],
  },
];

function formatTime(seconds: number, durationSeconds: number) {
  const safeSeconds = Math.floor(Math.max(0, Math.min(durationSeconds, seconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDurationLabel(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (minutes === 0) return `${durationSeconds} segundos`;
  return seconds === 0
    ? `${minutes} minuto${minutes === 1 ? "" : "s"}`
    : `${minutes} min ${seconds} s`;
}

function TemplateThumbnail({ template }: { template: TemplateDefinition }) {
  return (
    <span className={`${styles.thumbnail} ${styles[template.kind]}`} aria-hidden="true">
      {template.kind === "board" && (
        <>
          <i className={styles.boardGrid} />
          <b className={styles.boardThumbFormula}>24 ÷ 6 = 4</b>
          <i className={styles.boardStroke} />
        </>
      )}
      {template.kind === "workshop" && (
        <>
          <i className={styles.paperGrid} />
          <span className={styles.numberLine}>
            <b>0</b>
            <b>2</b>
            <b>4</b>
            <b>6</b>
            <b>8</b>
          </span>
          <i className={styles.tokenOne} />
          <i className={styles.tokenTwo} />
        </>
      )}
      {template.kind === "pythagoras" && (
        <>
          <i className={styles.pythagorasThumbTriangle} />
          <b className={styles.pythagorasThumbFormula}>a² + b² = c²</b>
        </>
      )}
      {template.kind === "story" && (
        <>
          <i className={styles.storyThumbSun} />
          <i className={styles.storyThumbPath} />
          <b className={styles.storyThumbPhrase}>Let's talk</b>
        </>
      )}
      {template.kind === "phrase" && (
        <>
          <span className={styles.phraseThumbTiles}>
            <i>I</i>
            <i>am</i>
            <i>ready</i>
          </span>
          <b className={styles.phraseThumbArrow}>→</b>
        </>
      )}
      {template.kind === "historySource" && (
        <>
          <i className={styles.sourceThumbPaper} />
          <i className={styles.sourceThumbLens} />
          <b className={styles.sourceThumbMark}>?</b>
        </>
      )}
      {template.kind === "historyTimeline" && (
        <>
          <i className={styles.timelineThumbLine} />
          <b className={styles.timelineThumbDotOne} />
          <b className={styles.timelineThumbDotTwo} />
          <b className={styles.timelineThumbDotThree} />
          <span className={styles.timelineThumbArrow}>→</span>
        </>
      )}
      {template.kind === "scienceInquiry" && (
        <>
          <i className={styles.labThumbFlask} />
          <i className={styles.labThumbChart} />
          <b className={styles.labThumbQuestion}>?</b>
        </>
      )}
      {template.kind === "scienceSystem" && (
        <>
          <i className={styles.systemThumbCore} />
          <i className={styles.systemThumbOrbit} />
          <b className={styles.systemThumbNodeOne} />
          <b className={styles.systemThumbNodeTwo} />
          <b className={styles.systemThumbNodeThree} />
        </>
      )}
    </span>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: TemplateDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.templateCard} ${selected ? styles.templateCardSelected : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <TemplateThumbnail template={template} />
      <span className={styles.cardMeta}>{template.learningMode}</span>
      <strong>{template.name}</strong>
      <span className={styles.cardSummary}>{template.summary}</span>
      <span className={styles.cardFooter}>
        {selected ? <CheckCircle2 size={15} /> : <CirclePlay size={15} />}{" "}
        {selected ? "Seleccionada" : "Ver escenario"}
      </span>
    </button>
  );
}

function BoardScene({ phase, progress }: { phase: number; progress: number }) {
  const isIntroPhase = phase === 0;
  const isOutroPhase = phase >= 6;
  const lessonPhase = phase - 1;
  const activeGroups = [0, 2, 4, 6, 6][lessonPhase] ?? 6;
  const groupIds = [
    "group-one",
    "group-two",
    "group-three",
    "group-four",
    "group-five",
    "group-six",
  ];
  const phaseHint =
    [
      "Dividir es repartir una cantidad en partes iguales.",
      "El divisor indica que construiremos 6 grupos del mismo tamaño.",
      "Cada grupo recibe 4 unidades: el reparto queda equilibrado.",
      "Comprobamos el resultado: 6 grupos de 4 vuelven a formar 24.",
      "Prueba otra división y conserva el mismo razonamiento.",
    ][lessonPhase] ?? "Comprueba el resultado con una multiplicación.";

  if (isIntroPhase) {
    return (
      <div className={`${styles.boardScene} ${styles["academyTemplate--division"]}`}>
        <section className={styles["academyTemplate--division--intro"]}>
          <div
            className={styles["academyTemplate--division--intro__content"]}
            style={{
              opacity: Math.min(1, 0.78 + progress * 0.22),
              transform: `translateY(${(1 - Math.min(1, progress * 2)) * 4}px)`,
            }}
          >
            <div className={styles["academyTemplate--division--intro__eyebrow"]}>
              <span>MATEMÁTICA · DIVISIÓN</span>
              <span>EJEMPLO 24 ÷ 6</span>
            </div>
            <h1 className={styles["academyTemplate--division--intro__title"]}>
              <span>Cómo resolver</span>
              <span>una división</span>
            </h1>
            <div className={styles["academyTemplate--division--intro__example"]}>
              <div className={styles["academyTemplate--division--intro__formula"]}>
                <span>REPARTO EQUITATIVO</span>
                <strong>24 ÷ 6 = 4</strong>
                <small>24 unidades repartidas en 6 grupos iguales</small>
              </div>
              <div className={styles["academyTemplate--division--intro__groups"]}>
                {groupIds.map((groupId) => (
                  <span key={groupId}>
                    <b>4</b>
                    <small>unidades</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isOutroPhase) {
    return (
      <div className={`${styles.boardScene} ${styles["academyTemplate--division"]}`}>
        <section className={styles["academyTemplate--division--outro"]}>
          <div className={styles["academyTemplate--division--outro__visual"]}>
            <span>RESULTADO COMPROBADO</span>
            <strong>24 ÷ 6 = 4</strong>
          </div>
          <div
            className={styles["academyTemplate--division--outro__content"]}
            style={{
              opacity: Math.min(1, 0.78 + progress * 0.22),
              transform: `translateY(${(1 - Math.min(1, progress * 2)) * 4}px)`,
            }}
          >
            <h2 className={styles["academyTemplate--division--outro__title"]}>
              Repartir es encontrar partes iguales.
            </h2>
            <p className={styles["academyTemplate--division--outro__message"]}>
              Si puedes formar seis grupos de cuatro, puedes comprobar la división con una
              multiplicación.
            </p>
          </div>
          <div className={styles["academyTemplate--division--outro__footer"]}>
            <span>NEXA ACADEMY · MATEMÁTICA</span>
            <span>SIGUIENTE · FRACCIONES · PROPORCIONES</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.boardScene} ${styles["academyTemplate--division"]}`}>
      <div
        className={`${styles.boardToolbar} ${styles["academyTemplate--division--lesson__header"]}`}
      >
        <span>MATEMÁTICA / DIVISIÓN</span>
        <span>PASO {phase + 1} / 07</span>
      </div>
      <div className={styles.chalkDust} aria-hidden="true" />
      <div className={styles.boardLessonGrid}>
        <section
          className={`${styles.boardExampleArea} ${styles["academyTemplate--division--lesson__example"]}`}
        >
          <div className={styles.boardSectionLabel}>
            <span>EJEMPLO EN DESARROLLO</span>
            <span>REPARTO EQUITATIVO</span>
          </div>
          {lessonPhase === 0 && (
            <div className={styles["academyTemplate--division--lesson__theory"]}>
              <span>TEORÍA</span>
              <strong>Dividir es repartir en partes iguales.</strong>
              <small>El divisor nos dice cuántos grupos construiremos.</small>
            </div>
          )}
          <div className={styles.boardQuestion}>¿Cuánto recibe cada grupo?</div>
          <div className={styles.boardFormula}>
            24 <span>÷</span> 6 <em>=</em> 4
          </div>
          <div
            className={styles.chalkLine}
            style={{ "--draw-progress": `${Math.round(progress * 100)}%` } as CSSProperties}
          />
          <div className={styles.boardGroupLabel}>
            <span>FILAS DE REPARTO · 6 GRUPOS</span>
            <strong>Cada grupo recibe 4</strong>
          </div>
          <div className={styles.boardGroupGrid}>
            {groupIds.map((groupId, index) => (
              <span className={index < activeGroups ? styles.boardGroupActive : ""} key={groupId}>
                <b>4</b>
                <small>unidades</small>
              </span>
            ))}
          </div>
          <p className={styles.boardReasoning}>{phaseHint}</p>
          {lessonPhase >= 2 && (
            <div className={styles["academyTemplate--division--lesson__proof"]}>
              <span>COMPROBACIÓN</span>
              <strong>6 × 4 = 24</strong>
            </div>
          )}
        </section>

        <aside className={styles.boardReferenceColumn}>
          <section className={styles.boardReferenceRow}>
            <span className={styles.boardReferenceLabel}>EJEMPLOS DE REFERENCIA</span>
            <div className={styles.boardExampleItem}>
              <strong>18 ÷ 3 = 6</strong>
              <small>3 grupos iguales</small>
            </div>
            <div className={styles.boardExampleItem}>
              <strong>20 ÷ 5 = 4</strong>
              <small>5 grupos iguales</small>
            </div>
          </section>
          <section className={styles.boardReferenceRow}>
            <span className={styles.boardReferenceLabel}>RECOMENDACIONES</span>
            <p className={styles.boardRecommendation}>
              Busca grupos iguales y comprueba el resultado con una multiplicación.
            </p>
            <div className={styles.boardCheck}>divisor × cociente = dividendo</div>
          </section>
        </aside>
      </div>
      <div
        className={styles.chalkCursor}
        style={{ left: `${26 + Math.min(progress, 0.9) * 41}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function WorkshopScene({ phase }: { phase: number }) {
  const points = [0, 2, 4, 6, 8, 10, 12];
  return (
    <div className={styles.workshopScene}>
      <div className={styles.workshopHeader}>
        <span>LABORATORIO DE CANTIDADES</span>
        <span>GRUPOS DE 2</span>
      </div>
      <div className={styles.workshopStatement}>Construye 3 saltos de dos para llegar a 6.</div>
      <div className={styles.tokens}>
        {WORKSHOP_TOKENS.map((token) => (
          <i className={token <= (phase + 1) * 2 ? styles.tokenActive : ""} key={token}>
            {token}
          </i>
        ))}
      </div>
      <div className={styles.numberLineLarge}>
        {points.map((point, index) => (
          <span className={index <= phase + 2 ? styles.pointActive : ""} key={point}>
            <i />
            <b>{point}</b>
          </span>
        ))}
      </div>
      <div className={styles.workshopEquation}>{phase < 3 ? "2 + 2 + 2" : "3 × 2 = 6"}</div>
    </div>
  );
}

function PythagorasScene({ phase, progress }: { phase: number; progress: number }) {
  const isIntroPhase = phase === 0;
  const isOutroPhase = phase >= 6;
  const lessonPhase = phase - 1;
  const proofPhase = Math.max(0, lessonPhase - 3);
  const phaseCopy =
    [
      "Sustituimos los valores conocidos: 3² + 4² = c².",
      "La hipotenusa mide 5 porque 9 + 16 = 25.",
    ][proofPhase] ?? "Comprueba la relación entre los tres lados.";
  const equation = proofPhase === 0 ? "c² = 3² + 4²" : "c = √25 = 5";
  const traceLength = 980;
  const isTheoryPhase = !isIntroPhase && !isOutroPhase && lessonPhase < 3;
  const showTheoryDiagram = lessonPhase >= 1;
  const showTheoryCards = lessonPhase >= 2;
  const explanationProgress = lessonPhase === 0 ? Math.min(1, progress / 0.24) : 1;

  if (isIntroPhase) {
    return (
      <div className={`${styles.pythagorasScene} ${styles["academyTemplate--pythagoras"]}`}>
        <section className={styles["academyTemplate--pythagoras--intro"]}>
          <div
            className={styles["academyTemplate--pythagoras--intro__content"]}
            style={{
              opacity: Math.min(1, 0.78 + progress * 0.22),
              transform: `translateY(${(1 - Math.min(1, progress * 2)) * 4}px)`,
            }}
          >
            <div className={styles["academyTemplate--pythagoras--intro__eyebrow"]}>
              <span>MATEMÁTICA · GEOMETRÍA</span>
              <span>EJEMPLO 3 · 4 · 5</span>
            </div>
            <h1 className={styles["academyTemplate--pythagoras--intro__title"]}>
              <span>Cómo encontrar</span>
              <span>la hipotenusa</span>
            </h1>
            <div className={styles["academyTemplate--pythagoras--intro__example"]}>
              <svg
                className={styles["academyTemplate--pythagoras--intro__diagram"]}
                viewBox="0 0 660 340"
                role="img"
                aria-labelledby="pythagoras-intro-diagram-title"
              >
                <title id="pythagoras-intro-diagram-title">
                  Triángulo rectángulo con ejemplo de lados tres, cuatro y cinco
                </title>
                <path
                  className={styles["academyTemplate--pythagoras--intro__diagramGuide"]}
                  d="M172 270 H492"
                />
                <path
                  className={styles["academyTemplate--pythagoras--intro__diagramTriangle"]}
                  d="M172 270 V70 L492 270 Z"
                />
                <path
                  className={styles["academyTemplate--pythagoras--intro__diagramRightAngle"]}
                  d="M172 238 H204 V270 H172"
                />
                <circle
                  className={styles["academyTemplate--pythagoras--intro__diagramVertex"]}
                  cx="172"
                  cy="270"
                  r="8"
                />
                <circle
                  className={styles["academyTemplate--pythagoras--intro__diagramVertex"]}
                  cx="492"
                  cy="270"
                  r="8"
                />
                <circle
                  className={styles["academyTemplate--pythagoras--intro__diagramVertex"]}
                  cx="172"
                  cy="70"
                  r="8"
                />
                <text
                  className={styles["academyTemplate--pythagoras--intro__diagramLabel"]}
                  x="132"
                  y="174"
                >
                  3
                </text>
                <text
                  className={styles["academyTemplate--pythagoras--intro__diagramLabel"]}
                  x="320"
                  y="314"
                >
                  4
                </text>
                <text
                  className={styles["academyTemplate--pythagoras--intro__diagramLabelHypotenuse"]}
                  x="354"
                  y="145"
                >
                  5
                </text>
                <text
                  className={styles["academyTemplate--pythagoras--intro__diagramAngle"]}
                  x="214"
                  y="242"
                >
                  90°
                </text>
              </svg>
              <div className={styles["academyTemplate--pythagoras--intro__formula"]}>
                <span>TEOREMA DE PITÁGORAS</span>
                <strong>3² + 4² = 5²</strong>
                <small>9 + 16 = 25</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isOutroPhase) {
    return (
      <div className={`${styles.pythagorasScene} ${styles["academyTemplate--pythagoras"]}`}>
        <section className={styles["academyTemplate--pythagoras--outro"]}>
          <div className={styles["academyTemplate--pythagoras--outro__visual"]}>
            <span>LECCIÓN COMPLETADA · GEOMETRÍA</span>
            <strong>c = 5</strong>
          </div>
          <div
            className={styles["academyTemplate--pythagoras--outro__content"]}
            style={{
              opacity: Math.min(1, 0.78 + progress * 0.22),
              transform: `translateY(${(1 - Math.min(1, progress * 2)) * 4}px)`,
            }}
          >
            <h2 className={styles["academyTemplate--pythagoras--outro__title"]}>
              Gracias por aprender con nosotros.
            </h2>
            <p className={styles["academyTemplate--pythagoras--outro__credit"]}>
              DESARROLLADO POR NEXA ACADEMY
            </p>
            <p className={styles["academyTemplate--pythagoras--outro__message"]}>
              Ya diste un paso importante. Puedes seguir aprendiendo a tu propio ritmo.
            </p>
          </div>
          <div className={styles["academyTemplate--pythagoras--outro__footer"]}>
            <span>NEXA ACADEMY · PLATAFORMA DE APRENDIZAJE</span>
            <span>NUEVOS CURSOS · INGLÉS · HISTORIA · CIENCIAS</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.pythagorasScene} ${styles["academyTemplate--pythagoras"]}`}>
      <div
        className={`${styles.pythagorasHeader} ${styles["academyTemplate--pythagoras--lesson__header"]}`}
      >
        <span>MATEMÁTICA / GEOMETRÍA</span>
        <span>PASO {phase + 1} / 07</span>
      </div>
      {isTheoryPhase ? (
        <section
          className={`${styles.pythagorasTheoryCard} ${styles["academyTemplate--pythagoras--lesson__theory"]}`}
        >
          <div className={styles.pythagorasTheoryLabel}>DE QUÉ TRATA ESTA LECCIÓN</div>
          <h2>Cómo encontrar la hipotenusa</h2>
          <p
            className={styles.pythagorasTheoryDescription}
            style={{
              opacity: explanationProgress,
              transform: `translateY(${(1 - explanationProgress) * 12}px)`,
            }}
          >
            En un triángulo rectángulo, los catetos forman el ángulo de 90 grados y la hipotenusa es
            el lado que queda enfrente. El teorema relaciona sus tres medidas.
          </p>
          {showTheoryDiagram && (
            <svg
              className={styles.pythagorasTheoryDiagram}
              viewBox="0 0 520 220"
              role="img"
              aria-labelledby="pythagoras-theory-diagram-title"
            >
              <title id="pythagoras-theory-diagram-title">
                Diagrama central de un triángulo rectángulo
              </title>
              <path className={styles.pythagorasTheoryTriangle} d="M130 178 V42 L388 178 Z" />
              <path className={styles.pythagorasTheoryAngle} d="M130 154 H154 V178 H130" />
              <text x="105" y="115">
                a
              </text>
              <text x="250" y="201">
                b
              </text>
              <text x="270" y="98">
                c
              </text>
              <text className={styles.pythagorasTheoryNinety} x="164" y="164">
                90°
              </text>
            </svg>
          )}
          {showTheoryCards && (
            <div className={styles.pythagorasTheoryGrid}>
              <div>
                <span>TEORÍA</span>
                <strong>a² + b² = c²</strong>
                <small>
                  La suma de los cuadrados de los catetos es igual al cuadrado de la hipotenusa.
                </small>
              </div>
              <div>
                <span>EJEMPLO BASE</span>
                <strong>3² + 4² = 5²</strong>
                <small>9 + 16 = 25, por eso la hipotenusa mide 5.</small>
              </div>
            </div>
          )}
          <div className={styles.pythagorasTheoryTransition}>
            {lessonPhase === 0
              ? "Primero entendemos la relación."
              : lessonPhase === 1
                ? "La figura nos muestra qué representa cada lado."
                : "Ahora pasamos a las pruebas."}
          </div>
        </section>
      ) : (
        <div
          className={`${styles.pythagorasLayout} ${styles["academyTemplate--pythagoras--lesson__proof"]}`}
        >
          <section
            className={`${styles.pythagorasDiagramPanel} ${styles["academyTemplate--pythagoras--lesson__diagram"]}`}
          >
            <div className={styles.pythagorasPanelLabel}>
              <span>PRUEBA GUIADA</span>
              <span>TRIÁNGULO RECTÁNGULO</span>
            </div>
            <svg
              className={styles.pythagorasDiagram}
              viewBox="0 0 560 360"
              role="img"
              aria-labelledby="pythagoras-diagram-title"
            >
              <title id="pythagoras-diagram-title">Triángulo rectángulo con lados a, b y c</title>
              <path
                className={styles.pythagorasTrace}
                d="M88 294 L88 58 L448 294 Z"
                style={{
                  strokeDasharray: traceLength,
                  strokeDashoffset: traceLength * (1 - progress),
                }}
              />
              <path className={styles.pythagorasFill} d="M88 294 L88 58 L448 294 Z" />
              <path className={styles.pythagorasRightAngle} d="M88 270 H112 V294 H88" />
              <text className={styles.pythagorasAngle} x="120" y="280">
                90°
              </text>
              <text className={styles.pythagorasSideA} x="58" y="182">
                a = 3
              </text>
              <text className={styles.pythagorasSideB} x="242" y="324">
                b = 4
              </text>
              <text className={styles.pythagorasHypotenuse} x="304" y="155">
                c = ?
              </text>
            </svg>
            <p className={styles.pythagorasExplanation}>{phaseCopy}</p>
          </section>

          <aside
            className={`${styles.pythagorasSide} ${styles["academyTemplate--pythagoras--lesson__sidebar"]}`}
          >
            <section
              className={`${styles.pythagorasCard} ${styles["academyTemplate--pythagoras--lesson__card"]}`}
            >
              <span className={styles.pythagorasCardLabel}>DATOS DEL EJEMPLO</span>
              <div className={styles.pythagorasValues}>
                <strong>a = 3</strong>
                <strong>b = 4</strong>
                <strong>c = ?</strong>
              </div>
              <small>Dos catetos conocidos y una hipotenusa por encontrar.</small>
            </section>
            <section
              className={`${styles.pythagorasCard} ${styles["academyTemplate--pythagoras--lesson__card"]}`}
            >
              <span className={styles.pythagorasCardLabel}>RESOLUCIÓN</span>
              <strong className={styles.pythagorasEquation}>{equation}</strong>
              <div className={styles.pythagorasCheck}>3² + 4² = 5²</div>
              <small>La comprobación confirma que el triángulo conserva la relación.</small>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function StoryScene({ phase, progress }: { phase: number; progress: number }) {
  const moment = STORY_MOMENTS[phase];
  return (
    <div className={styles.storyScene}>
      <div className={styles.storyHeader}>
        <span>ENGLISH / A SMALL STORY</span>
        <span>
          {moment.label} · 0{phase + 1} / 04
        </span>
      </div>
      <div className={styles.storySun} aria-hidden="true" />
      <div className={styles.storyWindow} aria-hidden="true">
        <i />
        <i />
      </div>
      <div className={styles.storyTable} aria-hidden="true" />
      <div className={`${styles.storyCharacter} ${styles.storyCharacterA}`} aria-hidden="true">
        <i />
        <b>A</b>
      </div>
      <div className={`${styles.storyCharacter} ${styles.storyCharacterB}`} aria-hidden="true">
        <i />
        <b>B</b>
      </div>
      <div className={styles.storyCard}>
        <span>AT THE END OF CLASS</span>
        <strong>{moment.title}</strong>
        <p>{moment.phrase}</p>
        <small>{moment.note}</small>
      </div>
      <div
        className={styles.storyPath}
        style={{ "--story-progress": `${45 + progress * 55}%` } as CSSProperties}
      />
      <div className={styles.storySubtitle}>
        <span>SUBTÍTULO · IDEA CENTRAL</span>
        <strong>{moment.phrase}</strong>
      </div>
    </div>
  );
}

function PhraseBuilderScene({ phase, progress }: { phase: number; progress: number }) {
  const visibleWords = Math.min(PHRASE_WORDS.length, phase + 2);
  return (
    <div className={styles.phraseScene}>
      <div className={styles.phraseHeader}>
        <span>ENGLISH / BUILD THE SENTENCE</span>
        <span>STEP 0{phase + 1} / 04</span>
      </div>
      <div className={styles.phraseTeacher} aria-hidden="true">
        <i />
        <b />
        <span>
          YOUR
          <em>TURN</em>
        </span>
      </div>
      <div className={styles.phraseBoard}>
        <span className={styles.phraseBoardLabel}>TODAY'S GOAL</span>
        <strong>{phase === 0 ? "Say how you feel" : "I am ready for class."}</strong>
        <p>
          {phase === 0 ? "Una oración para empezar con confianza." : "Lee de izquierda a derecha."}
        </p>
        <div className={styles.phraseTiles}>
          {PHRASE_WORDS.map((word, index) => (
            <span
              className={`${styles.phraseTile} ${styles[`phraseTile${word.role}`]} ${index < visibleWords ? styles.phraseTileVisible : ""}`}
              key={word.text}
            >
              {word.text}
            </span>
          ))}
        </div>
        <div className={styles.phraseArrow} style={{ width: `${35 + progress * 60}%` }} />
      </div>
      <div className={styles.phraseHint}>
        <span>{phase < 2 ? "A CLUE FROM THE TEACHER" : "READ IT TOGETHER"}</span>
        <strong>
          {phase === 0
            ? "Who? + verb + idea"
            : phase === 1
              ? "I goes with am."
              : phase === 2
                ? "I am ready for class."
                : "Now make it yours."}
        </strong>
      </div>
      <div className={styles.phraseSubtitle}>
        <span>SUBTÍTULO · CONSTRUCCIÓN GUIADA</span>
        <strong>
          {phase === 3 ? "I am ready for class." : "Las palabras encuentran su lugar."}
        </strong>
      </div>
    </div>
  );
}

function HistorySourceScene({ phase, progress }: { phase: number; progress: number }) {
  const step = HISTORY_SOURCE_STEPS[phase];
  return (
    <div className={styles.historySourceScene}>
      <div className={styles.historyHeader}>
        <span>
          <Archive size={13} aria-hidden="true" />
          HISTORY / PRIMARY SOURCE LAB
        </span>
        <span>
          {step.label} · 0{phase + 1} / 04
        </span>
      </div>
      <div className={styles.sourceDocument}>
        <div className={styles.sourceDocumentTop}>
          <span>
            <Archive size={12} aria-hidden="true" />
            ARCHIVE / 1942
          </span>
          <b>PHOTO 01</b>
        </div>
        <div className={styles.sourceDocumentImage}>
          <i className={styles.sourceBuilding} />
          <i className={styles.sourceFigureOne} />
          <i className={styles.sourceFigureTwo} />
          <i className={styles.sourceHorizon} />
        </div>
        <div className={styles.sourceDocumentCaption}>
          A source is a trace left by a time and a person.
        </div>
      </div>
      <div className={styles.sourcePrompt}>
        <div className={styles.sourcePromptIcon} aria-hidden="true">
          {phase === 0 ? (
            <Search size={19} />
          ) : phase === 1 ? (
            <CircleHelp size={19} />
          ) : (
            <BookOpenCheck size={19} />
          )}
        </div>
        <span>{step.label}</span>
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
        <b>{step.prompt}</b>
      </div>
      <div className={styles.sourceMarkers}>
        {["DETAIL", "QUESTION", "CONTEXT"].map((marker, index) => (
          <span className={index <= phase ? styles.sourceMarkerActive : ""} key={marker}>
            <i>
              {index === 0 ? (
                <Search size={13} />
              ) : index === 1 ? (
                <CircleHelp size={13} />
              ) : (
                <BookOpenCheck size={13} />
              )}
            </i>
            {marker}
          </span>
        ))}
      </div>
      <div className={styles.historySourceProgress} style={{ width: `${28 + progress * 66}%` }} />
      <div className={styles.historySubtitle}>
        <span>SUBTÍTULO · PREGUNTA HISTÓRICA</span>
        <strong>{step.prompt}</strong>
      </div>
    </div>
  );
}

function HistoryTimelineScene({ phase, progress }: { phase: number; progress: number }) {
  const event = HISTORY_TIMELINE_EVENTS[phase];
  return (
    <div className={styles.historyTimelineScene}>
      <div className={styles.historyHeader}>
        <span>
          <MapIcon size={13} aria-hidden="true" />
          HISTORY / CHANGE MAP
        </span>
        <span>
          {event.label} · 0{phase + 1} / 04
        </span>
      </div>
      <div className={styles.timelineIntro}>
        <span>
          <GitBranch size={13} aria-hidden="true" />
          FOLLOW THE CHANGE
        </span>
        <strong>Una historia se entiende cuando conectamos el antes y el después.</strong>
      </div>
      <div className={styles.timelineTrack}>
        <div
          className={styles.timelineTrackLine}
          style={{ width: `${13 + progress * (phase + 1) * 27}%` }}
        />
        {HISTORY_TIMELINE_EVENTS.map((item, index) => (
          <article
            className={`${styles.timelineEvent} ${index <= phase ? styles.timelineEventActive : ""}`}
            key={item.year}
          >
            <b>{item.year}</b>
            <i>{index === 0 ? <CircleDot size={12} /> : <ArrowRight size={12} />}</i>
            <span>{item.label}</span>
            <strong>{item.title}</strong>
          </article>
        ))}
      </div>
      <div className={`${styles.timelineCause} ${styles[`timelineCause${event.kind}`]}`}>
        <span>
          {phase === 0
            ? "START HERE"
            : phase === 1
              ? "A DECISION"
              : phase === 2
                ? "WHAT CHANGED?"
                : "REMEMBER"}
        </span>
        <strong>{event.title}</strong>
        <p>
          {phase === 0
            ? "Observa la condición que prepara el proceso."
            : phase === 1
              ? "Una acción no aparece aislada: responde a algo anterior."
              : phase === 2
                ? "La consecuencia se observa en personas y lugares concretos."
                : "Cierra con una pregunta que conecte pasado y presente."}
        </p>
      </div>
      <div className={styles.historySubtitle}>
        <span>SUBTÍTULO · RELACIÓN HISTÓRICA</span>
        <strong>
          {phase === 3 ? "¿Qué pregunta deja este cambio?" : "Cada hito prepara el siguiente."}
        </strong>
      </div>
    </div>
  );
}

function ScienceInquiryScene({ phase, progress }: { phase: number; progress: number }) {
  const step = SCIENCE_INQUIRY_STEPS[phase];
  const bars = [28, 42, 58, 72];
  return (
    <div className={styles.scienceInquiryScene}>
      <div className={styles.scienceHeader}>
        <span>
          <FlaskConical size={13} aria-hidden="true" />
          SCIENCE / INQUIRY LAB
        </span>
        <span>
          {step.label} · 0{phase + 1} / 04
        </span>
      </div>
      <div className={styles.inquiryQuestion}>
        <span>
          <Lightbulb size={13} aria-hidden="true" />
          THE QUESTION
        </span>
        <strong>Why did the shadow move?</strong>
        <p>{step.detail}</p>
      </div>
      <div className={styles.inquiryApparatus} aria-hidden="true">
        <i className={styles.inquiryLamp} />
        <i className={styles.inquiryBeam} />
        <i className={styles.inquiryObject} />
        <i className={styles.inquiryShadow} />
      </div>
      <div className={styles.inquiryResult}>
        <span>
          {phase < 2 ? (
            <TestTube2 size={13} aria-hidden="true" />
          ) : (
            <BarChart3 size={13} aria-hidden="true" />
          )}
          {step.label}
        </span>
        <strong>{step.title}</strong>
        <div className={styles.inquiryChart}>
          {bars.map((height, index) => (
            <i
              className={index <= phase ? styles.inquiryBarActive : ""}
              key={height}
              style={{ height: `${height + (index === phase ? progress * 18 : 0)}%` }}
            />
          ))}
        </div>
        <small>
          {phase < 2
            ? "Aún estamos construyendo la evidencia."
            : "La gráfica muestra un patrón, no una opinión."}
        </small>
      </div>
      <div className={styles.scienceSubtitle}>
        <span>SUBTÍTULO · PASO DEL MÉTODO</span>
        <strong>
          {phase === 3
            ? "La evidencia apoya la explicación."
            : "Primero preguntamos; después comprobamos."}
        </strong>
      </div>
    </div>
  );
}

function ScienceSystemScene({ phase, progress }: { phase: number; progress: number }) {
  return (
    <div className={styles.scienceSystemScene}>
      <div className={styles.scienceHeader}>
        <span>
          <Network size={13} aria-hidden="true" />
          SCIENCE / SYSTEM MAP
        </span>
        <span>STEP 0{phase + 1} / 04</span>
      </div>
      <div className={styles.systemIntro}>
        <span>
          <Orbit size={13} aria-hidden="true" />
          ONE SYSTEM · MANY RELATIONS
        </span>
        <strong>Nothing works alone.</strong>
        <p>Lee cada flecha como una relación que transforma o devuelve algo.</p>
      </div>
      <div className={styles.systemMap}>
        <div className={styles.systemCore}>
          <Orbit size={18} aria-hidden="true" />
          <span>
            THE
            <em>SYSTEM</em>
          </span>
        </div>
        {SCIENCE_SYSTEM_NODES.map((node, index) => (
          <div
            className={`${styles.systemNode} ${styles[`systemNode${node.angle}`]} ${index <= phase ? styles.systemNodeActive : ""}`}
            key={node.label}
          >
            <b>
              <CircleDot size={12} aria-hidden="true" />
              {node.label}
            </b>
            <span>{node.detail}</span>
          </div>
        ))}
        <i
          className={styles.systemOrbit}
          style={{ transform: `rotate(${phase * 22 + progress * 22}deg)` }}
        />
      </div>
      <div className={styles.systemLegend}>
        <span>
          <i className={styles.legendInput} /> entrada
        </span>
        <span>
          <i className={styles.legendFlow} /> transformación
        </span>
        <span>
          <i className={styles.legendOutput} /> evidencia
        </span>
      </div>
      <div className={styles.scienceSubtitle}>
        <span>SUBTÍTULO · RELACIÓN DEL SISTEMA</span>
        <strong>
          {phase === 3
            ? "El sistema completo explica el resultado."
            : "Sigue la flecha para descubrir qué cambia."}
        </strong>
      </div>
    </div>
  );
}

function TeachingStage({
  template,
  currentTime,
  stageRef,
  isFullscreen,
  isPlaying,
  onTogglePlaying,
  onSeek,
  onExitFullscreen,
  fullscreenControlsCollapsed,
  onToggleFullscreenControls,
}: {
  template: TemplateDefinition;
  currentTime: number;
  stageRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  isPlaying: boolean;
  onTogglePlaying: () => void;
  onSeek: (time: number) => void;
  onExitFullscreen: () => void;
  fullscreenControlsCollapsed: boolean;
  onToggleFullscreenControls: () => void;
}) {
  const durationSeconds = template.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const phaseCount = template.sceneRecipe.length;
  const hasStructuredIntro = template.kind === "pythagoras" || template.kind === "board";
  const introDuration = hasStructuredIntro ? ACADEMY_INTRO_DURATION_SECONDS : 0;
  const teachingPhaseCount = hasStructuredIntro ? phaseCount - 1 : phaseCount;
  const phaseDuration = hasStructuredIntro
    ? (durationSeconds - introDuration) / teachingPhaseCount
    : durationSeconds / phaseCount;
  let phase = 0;
  let progress = 0;
  if (hasStructuredIntro && currentTime < introDuration) {
    progress = currentTime / introDuration;
  } else if (hasStructuredIntro) {
    const teachingTime = Math.max(0, currentTime - introDuration);
    const teachingPhase = Math.min(
      teachingPhaseCount - 1,
      Math.floor(teachingTime / phaseDuration),
    );
    phase = teachingPhase + 1;
    progress = currentTime >= durationSeconds ? 1 : (teachingTime % phaseDuration) / phaseDuration;
  } else {
    phase = Math.min(phaseCount - 1, Math.floor(currentTime / phaseDuration));
    progress = (currentTime % phaseDuration) / phaseDuration;
  }
  const style = {
    "--primary": template.palette.primary,
    "--secondary": template.palette.secondary,
    "--tertiary": template.palette.tertiary,
    "--surface": template.palette.surface,
    "--ink": template.palette.ink,
  } as CSSProperties;
  return (
    <div
      className={`${styles.teachingStage} ${styles[template.kind]}`}
      style={style}
      aria-live="polite"
    >
      <div
        ref={stageRef}
        className={`${styles.stageFrame} ${isFullscreen ? styles.stageFrameFullscreen : ""}`}
      >
        {template.kind === "board" && <BoardScene phase={phase} progress={progress} />}
        {template.kind === "workshop" && <WorkshopScene phase={phase} />}
        {template.kind === "pythagoras" && <PythagorasScene phase={phase} progress={progress} />}
        {template.kind === "story" && <StoryScene phase={phase} progress={progress} />}
        {template.kind === "phrase" && <PhraseBuilderScene phase={phase} progress={progress} />}
        {template.kind === "historySource" && (
          <HistorySourceScene phase={phase} progress={progress} />
        )}
        {template.kind === "historyTimeline" && (
          <HistoryTimelineScene phase={phase} progress={progress} />
        )}
        {template.kind === "scienceInquiry" && (
          <ScienceInquiryScene phase={phase} progress={progress} />
        )}
        {template.kind === "scienceSystem" && (
          <ScienceSystemScene phase={phase} progress={progress} />
        )}
        <div
          className={`${styles.fullscreenStageControls} ${
            fullscreenControlsCollapsed ? styles.fullscreenStageControlsCollapsed : ""
          }`}
        >
          <div className={styles.fullscreenStageTransport}>
            <button
              type="button"
              onClick={onTogglePlaying}
              aria-label={isPlaying ? "Pausar ejemplo" : "Reproducir ejemplo"}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              <span>{isPlaying ? "Pausar" : "Reproducir"}</span>
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, currentTime - 5))}
              aria-label="Volver atrás 5 segundos"
              title="Volver atrás 5 segundos"
            >
              <Rewind size={18} />
              <span>-5 s</span>
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.min(durationSeconds, currentTime + 5))}
              aria-label="Adelantar 5 segundos"
              title="Adelantar 5 segundos"
            >
              <Forward size={18} />
              <span>+5 s</span>
            </button>
            <input
              className={styles.fullscreenStageProgress}
              type="range"
              min="0"
              max={durationSeconds}
              step="0.1"
              value={currentTime}
              aria-label="Avanzar en la lección"
              onChange={(event) => onSeek(Number(event.target.value))}
            />
          </div>
          <time>
            {formatTime(currentTime, durationSeconds)} /{" "}
            {formatTime(durationSeconds, durationSeconds)}
          </time>
          <button
            className={styles.fullscreenStageCollapse}
            type="button"
            onClick={onToggleFullscreenControls}
            aria-label={fullscreenControlsCollapsed ? "Mostrar controles" : "Contraer controles"}
            title={fullscreenControlsCollapsed ? "Mostrar controles" : "Contraer controles"}
          >
            {fullscreenControlsCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <span>{fullscreenControlsCollapsed ? "Mostrar" : "Contraer"}</span>
          </button>
          <button
            type="button"
            onClick={onExitFullscreen}
            aria-label="Cerrar pantalla completa"
            title="Cerrar pantalla completa"
          >
            <X size={18} />
            <span>Cerrar</span>
          </button>
        </div>
      </div>
      <div className={styles.stageNarration}>
        <span>EXPLICACIÓN EN CONSTRUCCIÓN</span>
        <strong>{template.sceneRecipe[phase]}</strong>
        <p>
          {template.kind === "board"
            ? phase === 0
              ? "La intro presenta el problema y el resultado antes de comenzar el reparto."
              : phase === 1
                ? "La teoría explica que dividir es formar grupos iguales."
                : phase === 3
                  ? "Las filas hacen visible cómo cada grupo recibe la misma cantidad."
                  : phase === 4
                    ? "La multiplicación comprueba que el reparto conserva las 24 unidades."
                    : phase === 6
                      ? "El cierre resume el procedimiento y deja preparado el siguiente ejercicio."
                      : "La pizarra escribe una idea cada vez para que el procedimiento sea visible."
            : template.kind === "workshop"
              ? "La cantidad se organiza antes de mostrar el símbolo matemático."
              : template.kind === "pythagoras"
                ? phase === 0
                  ? "La intro presenta la materia y el objetivo antes de comenzar la demostración."
                  : phase === phaseCount - 1
                    ? "El cierre resume la relación y deja preparado el siguiente ejercicio."
                    : "El triángulo identifica sus lados antes de convertir la figura en una relación matemática."
                : template.kind === "story"
                  ? "La situación aparece antes que la regla para que la frase tenga un motivo real."
                  : template.kind === "phrase"
                    ? "Las palabras se ordenan delante del estudiante y la oración se lee como una acción."
                    : template.kind === "historySource"
                      ? "La fuente se observa, se pregunta y se contextualiza antes de construir una interpretación."
                      : template.kind === "historyTimeline"
                        ? "La línea de tiempo conecta condiciones, decisiones y consecuencias sin perder la secuencia."
                        : template.kind === "scienceInquiry"
                          ? "La pregunta se convierte en predicción, prueba y evidencia observable."
                          : "Cada nodo explica una relación; el sistema aparece cuando las conexiones se completan."}
        </p>
      </div>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.detailSection}>
      <div className={styles.detailTitle}>
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ProductionDetails({ template }: { template: TemplateDefinition }) {
  return (
    <aside className={styles.productionDetails}>
      <div className={styles.detailIntro}>
        <span>ESPECIFICACIÓN DE PRODUCCIÓN</span>
        <h2>{template.name}</h2>
        <p>{template.summary}</p>
      </div>
      <DetailSection icon={<Palette size={15} />} title="Color del escenario">
        <div className={styles.swatches}>
          {Object.entries(template.palette).map(([name, color]) => (
            <span key={name}>
              <i style={{ backgroundColor: color }} />
              <b className={styles.swatchName}>{name}</b>
              <em className={styles.swatchValue}>{color}</em>
            </span>
          ))}
        </div>
      </DetailSection>
      <DetailSection icon={<Type size={15} />} title="Tipografía">
        <dl className={styles.typography}>
          <div>
            <dt>Display</dt>
            <dd>{template.typography.display}</dd>
          </div>
          <div>
            <dt>Lectura</dt>
            <dd>{template.typography.body}</dd>
          </div>
          <div>
            <dt>Especialidad</dt>
            <dd>{template.typography.specialist}</dd>
          </div>
        </dl>
      </DetailSection>
      <DetailSection icon={<Workflow size={15} />} title="Escenas y transiciones">
        <ol className={styles.sceneRecipe}>
          {template.sceneRecipe.map((scene, index) => (
            <li key={scene}>
              <b className={styles.recipeNumber}>{String(index + 1).padStart(2, "0")}</b>
              <span>{scene}</span>
            </li>
          ))}
        </ol>
        <p className={styles.motionCopy}>
          <strong>Entrada</strong>
          {template.motion.entrance}
        </p>
        <p className={styles.motionCopy}>
          <strong>Transición</strong>
          {template.motion.transition}
        </p>
        <p className={styles.motionCopy}>
          <strong>Ambiente</strong>
          {template.motion.ambient}
        </p>
      </DetailSection>
      <DetailSection icon={<PenTool size={15} />} title="Herramientas del profesor">
        <ul className={styles.detailList}>
          {template.components.map((component) => (
            <li key={component}>{component}</li>
          ))}
        </ul>
      </DetailSection>
      <DetailSection icon={<Code2 size={15} />} title="Kit técnico">
        <div className={styles.techTags}>
          {template.tech.map((tech) => (
            <span key={tech}>{tech}</span>
          ))}
        </div>
        <p className={styles.techNote}>
          La composición final usa HTML, CSS y JavaScript bajo HyperFrames. Las dependencias
          obligatorias quedan locales y versionadas.
        </p>
      </DetailSection>
      {template.sourceFiles && (
        <DetailSection icon={<Archive size={15} />} title="Archivos de producción">
          <div className={styles.techTags}>
            {Object.entries(template.sourceFiles).map(([kind, path]) => (
              <a key={kind} href={resolveApiUrl(path)} target="_blank" rel="noreferrer">
                {kind.toUpperCase()}
              </a>
            ))}
          </div>
          <p className={styles.techNote}>
            Archivos entregados por el catálogo físico de Academy en el backend.
          </p>
        </DetailSection>
      )}
      <DetailSection
        icon={<MessageCircle size={15} />}
        title="Variables que puede completar el agente"
      >
        <div className={styles.variableTags}>
          {template.variables.map((variable) => (
            <code key={variable}>{variable}</code>
          ))}
        </div>
      </DetailSection>
    </aside>
  );
}

function PreviewPlayer({ template }: { template: TemplateDefinition }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsCollapsed, setFullscreenControlsCollapsed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const durationSeconds = template.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
      if (document.fullscreenElement !== stageRef.current) {
        setFullscreenControlsCollapsed(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }
    const frame = (timestamp: number) => {
      setCurrentTime((previous) => {
        const elapsed =
          lastFrameRef.current === null ? 0 : (timestamp - lastFrameRef.current) / 1000;
        const next = previous + elapsed;
        if (next >= durationSeconds) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
      lastFrameRef.current = timestamp;
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [durationSeconds, isPlaying]);
  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;

    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    try {
      if (typeof stage.requestFullscreen === "function") {
        await stage.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
    } catch {
      // Algunos navegadores embebidos bloquean la API nativa. Usamos el fallback visual.
    }

    setIsFullscreen(true);
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    setIsFullscreen(false);
    setFullscreenControlsCollapsed(false);
  };
  const seekTo = (time: number) => {
    setCurrentTime(Math.min(durationSeconds, Math.max(0, time)));
    setIsPlaying(false);
  };
  return (
    <div className={styles.previewColumn}>
      <TeachingStage
        template={template}
        currentTime={currentTime}
        stageRef={stageRef}
        isFullscreen={isFullscreen}
        isPlaying={isPlaying}
        onTogglePlaying={() => setIsPlaying((playing) => !playing)}
        onSeek={seekTo}
        onExitFullscreen={exitFullscreen}
        fullscreenControlsCollapsed={fullscreenControlsCollapsed}
        onToggleFullscreenControls={() => setFullscreenControlsCollapsed((collapsed) => !collapsed)}
      />
      <div className={styles.playerControls}>
        <button
          type="button"
          onClick={() => setIsPlaying((playing) => !playing)}
          aria-label={isPlaying ? "Pausar ejemplo" : "Reproducir ejemplo"}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <div>
          <strong>
            {isPlaying ? "Reproduciendo el escenario" : "Previsualización del escenario"}
          </strong>
          <span>
            Sin audio ·{" "}
            {template.kind === "story"
              ? "4 momentos de historia"
              : template.kind === "phrase"
                ? "4 pasos de construcción"
                : template.kind === "board"
                  ? "7 momentos de división"
                  : template.kind === "pythagoras"
                    ? "7 momentos de geometría"
                    : template.kind === "historySource"
                      ? "4 pasos de análisis"
                      : template.kind === "historyTimeline"
                        ? "4 hitos conectados"
                        : template.kind === "scienceInquiry"
                          ? "4 pasos de indagación"
                          : template.kind === "scienceSystem"
                            ? "4 relaciones del sistema"
                            : "4 momentos pedagógicos"}{" "}
            · {formatDurationLabel(durationSeconds)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={durationSeconds}
          step="0.1"
          value={currentTime}
          onChange={(event) => {
            setCurrentTime(Number(event.target.value));
            setIsPlaying(false);
          }}
          aria-label="Avanzar en la previsualización"
        />
        <time>
          {formatTime(currentTime, durationSeconds)} /{" "}
          {formatTime(durationSeconds, durationSeconds)}
        </time>
        <button
          type="button"
          className={styles.fullscreenButton}
          onClick={() => void toggleFullscreen()}
          aria-label={
            isFullscreen ? "Salir de pantalla completa" : "Ver escenario en pantalla completa"
          }
          aria-pressed={isFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          <Maximize2 size={16} />
          <span>{isFullscreen ? "Salir" : "Completa"}</span>
        </button>
      </div>
    </div>
  );
}

export function AcademyTemplateSelector({ categoryId }: { categoryId: CategoryId }) {
  const t = useTranslations("academyTemplates");
  const templates = useMemo(
    () => TEMPLATES.filter((template) => template.categoryId === categoryId),
    [categoryId],
  );
  const [selectedId, setSelectedId] = useState(templates[0].id);
  const [publishedFiles, setPublishedFiles] = useState<Record<string, Record<string, string>>>({});
  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? templates[0];
  const selectedTemplateWithFiles = publishedFiles[selectedTemplate.id]
    ? { ...selectedTemplate, sourceFiles: publishedFiles[selectedTemplate.id] }
    : selectedTemplate;
  const subject =
    categoryId === "mathematics"
      ? "Matemática"
      : categoryId === "history"
        ? "Historia"
        : categoryId === "science"
          ? "Ciencias"
          : "Inglés";
  useEffect(() => setSelectedId(templates[0].id), [templates]);
  useEffect(() => {
    const controller = new AbortController();
    void getAcademyTemplates(categoryId, controller.signal)
      .then((catalog) => {
        setPublishedFiles(
          Object.fromEntries(
            catalog.templates
              .filter((template) => template.file_urls)
              .map((template) => [template.id, template.file_urls ?? {}]),
          ),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setPublishedFiles({});
      });
    return () => controller.abort();
  }, [categoryId]);
  return (
    <main className={styles.page}>
      <Link href="/academy" className={styles.backLink}>
        <ChevronLeft size={16} />
        {t("backToAcademy")}
      </Link>
      <header className={styles.hero}>
        <p>02 / {subject.toUpperCase()} / SISTEMA VISUAL</p>
        <h1>Plantillas que enseñan mientras se construye la explicación.</h1>
        <span>
          No son presentaciones: son escenarios con una acción docente, reglas de producción y
          variables seguras para cada lección.
        </span>
      </header>
      <section className={styles.selectorShell} aria-labelledby="template-selection">
        <div className={styles.selectorHeader}>
          <div>
            <p>02 / DIRECCIÓN PEDAGÓGICA</p>
            <h2 id="template-selection">Elige cómo se dará la clase</h2>
          </div>
          <div className={styles.selectorGuide}>
            <AudioLines size={18} />
            <span>
              {formatDurationLabel(selectedTemplate.durationSeconds ?? DEFAULT_DURATION_SECONDS)}{" "}
              sin audio para revisar composición, ritmo y lectura.
            </span>
          </div>
        </div>
        <div
          className={`${styles.templateGrid} ${templates.length === 3 ? styles.templateGridThree : ""}`}
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={template.id === selectedTemplate.id}
              onSelect={() => setSelectedId(template.id)}
            />
          ))}
        </div>
        <div className={styles.selectionLine}>
          <span>
            Escenario seleccionado: <strong>{selectedTemplate.name}</strong>
          </span>
          <span>{selectedTemplate.eyebrow} · 16:9</span>
        </div>
        <div className={styles.reviewGrid}>
          <PreviewPlayer key={selectedTemplate.id} template={selectedTemplate} />
          <ProductionDetails template={selectedTemplateWithFiles} />
        </div>
      </section>
    </main>
  );
}
