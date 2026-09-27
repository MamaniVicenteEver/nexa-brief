"use client";

import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileVideo,
  Film,
  Focus,
  GitBranch,
  LoaderCircle,
  MessageSquareText,
  PanelRight,
  Pause,
  Play,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Type,
  UploadCloud,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  approveExplainerProject,
  getExplainerApiUrl,
  getExplainerProject,
  getExplainerTemplates,
  sendExplainerFeedback,
  uploadExplainerVideo,
} from "../api/explainer-service";
import type { ExplainerProject, ExplainerResponse, ExplainerTemplate } from "../types";
import { SpatialOrbitPreview } from "./SpatialOrbitPreview";
import { TemplateSystemPanel } from "./TemplateSystemPanel";

const FALLBACK_TEMPLATES: ExplainerTemplate[] = [
  {
    id: "editorial-split",
    name: "Editorial Split",
    description: "Contraste navy y marfil para ideas y liderazgo de opinión.",
    tone: "Editorial, confiable",
    typography: "Space Grotesk + Inter",
    icon_system: "SVG lineal interno",
  },
  {
    id: "data-brief",
    name: "Data Brief",
    description: "Jerarquía clara para datos, educación y contenido de negocio.",
    tone: "Analítico, preciso",
    typography: "Space Grotesk + Inter",
    icon_system: "SVG lineal interno",
  },
  {
    id: "signal-minimal",
    name: "Signal Minimal",
    description: "Negro, blanco y azul eléctrico para mensajes directos.",
    tone: "Directo, moderno",
    typography: "Space Grotesk + Inter",
    icon_system: "SVG lineal interno",
  },
  {
    id: "immersive-overlay",
    name: "Immersive Overlay",
    description: "El plano completo queda visible; titulares y gráficos flotan sobre el video.",
    tone: "Contemporáneo, cinematográfico, humano",
    typography: "Space Grotesk para titulares; Inter para datos",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "centered-rails",
    name: "Centered Rails",
    description: "Presentador centrado con subtítulos y contexto visual dinámico a ambos lados.",
    tone: "Dinámico, editorial, explicativo",
    typography: "Space Grotesk para ideas; Inter para subtítulos y datos",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "kinetic-voice",
    name: "Kinetic Voice",
    description: "Tipografía cinética y subtítulos de alta precisión para ideas con ritmo y voz fuerte.",
    tone: "Enérgico, nítido, contemporáneo",
    typography: "Space Grotesk para énfasis; Inter para subtítulos",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "field-notes",
    name: "Field Notes",
    description: "Anotaciones documentales, referencias y observaciones para explicar desde casos reales.",
    tone: "Observacional, humano, riguroso",
    typography: "Space Grotesk para tesis; Inter para notas y fuentes",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "product-signal",
    name: "Product Signal",
    description: "Demostraciones de producto con foco en una interfaz, beneficio y prueba concreta.",
    tone: "Claro, tecnológico, orientado a producto",
    typography: "Space Grotesk para beneficios; Inter para microcopy",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "systems-map",
    name: "Systems Map",
    description: "Mapas de relaciones, procesos y decisiones para explicar sistemas complejos de forma humana.",
    tone: "Estratégico, estructurado, sereno",
    typography: "Space Grotesk para nodos; Inter para explicación",
    icon_system: "Lucide React; SVG lineal interno",
  },
  {
    id: "spatial-orbit",
    name: "Spatial Orbit",
    description: "Un sistema 3D semántico activa nodos y relaciones sólo cuando la voz los necesita.",
    tone: "Cinematográfico, sistémico",
    typography: "Space Grotesk + Inter",
    icon_system: "Lucide React + Three.js/WebGL",
  },
];

const TEMPLATE_SHOWCASE_COPY: Record<
  ExplainerTemplate["id"],
  {
    headline: string;
    supportingText: string;
    visualLabel: string;
    motion: string;
    elements: string[];
    iconSuggestions: string[];
  }
> = {
  "editorial-split": {
    headline: "La claridad también tiene una dirección.",
    supportingText:
      "Una idea principal, una voz experta y un contraste editorial que guía la lectura.",
    visualLabel: "IDEA PRINCIPAL",
    motion: "Entrada breve del icono → escala de palabra → reposo",
    elements: ["Idea principal de una línea", "SVG contextual único", "Escala tipográfica con intención"],
    iconSuggestions: ["Quote", "ArrowUpRight", "Layers"],
  },
  "data-brief": {
    headline: "El dato que cambia la conversación.",
    supportingText:
      "El contenido se organiza con cifras, barras y una jerarquía precisa para explicar rápido.",
    visualLabel: "DATO DESTACADO",
    motion: "Conteo ascendente + barras que se revelan por prioridad",
    elements: ["Cifra de impacto", "Barras comparativas", "Etiqueta de fuente"],
    iconSuggestions: ["BarChart", "TrendingUp", "Database"],
  },
  "signal-minimal": {
    headline: "Una señal. Una decisión.",
    supportingText:
      "Negro, blanco y azul eléctrico para una pieza corta, directa y de alta retención.",
    visualLabel: "SIGNAL / 01",
    motion: "Cortes secos + línea eléctrica que conecta cada afirmación",
    elements: ["Titular de alto contraste", "Subtítulo por frase", "Indicador de progreso"],
    iconSuggestions: ["Target", "Zap", "Activity"],
  },
  "immersive-overlay": {
    headline: "La persona sigue siendo el centro.",
    supportingText:
      "El plano completo permanece visible mientras los gráficos flotan sobre la escena.",
    visualLabel: "PLANO COMPLETO",
    motion: "Aparición suave de overlays + anclajes que siguen el discurso",
    elements: ["Titular flotante", "Gráfico contextual", "Subtítulos sobre el plano"],
    iconSuggestions: ["ScanLine", "MapPin", "Sparkles"],
  },
  "centered-rails": {
    headline: "Una voz al centro. El contexto a los lados.",
    supportingText:
      "El presentador conserva el protagonismo y los laterales explican, comparan y sostienen la idea.",
    visualLabel: "CONTEXTO / 02",
    motion: "Tarjetas laterales escalonadas + subtítulos sincronizados",
    elements: ["Presentador centrado", "Rails informativos", "Subtítulo de lectura rápida"],
    iconSuggestions: ["PanelRight", "MessageSquare", "BarChart"],
  },
  "kinetic-voice": {
    headline: "La voz marca el ritmo.",
    supportingText: "Una palabra clave se mueve una vez y después deja respirar la idea.",
    visualLabel: "PULSO / 01",
    motion: "Golpe verbal + énfasis tipográfico + reposo",
    elements: ["Palabra cinética", "Subtítulo preciso", "Acento de trazo"],
    iconSuggestions: ["Mic2", "ScanLine", "ArrowRight"],
  },
  "field-notes": {
    headline: "Una observación abre el caso.",
    supportingText: "Notas y referencias ancladas al relato, sin convertirlo en una lámina.",
    visualLabel: "NOTA / 01",
    motion: "Anotación que se fija + línea de conexión + retirada",
    elements: ["Nota documental", "Referencia", "Cita con procedencia"],
    iconSuggestions: ["NotebookTabs", "Paperclip", "MapPin"],
  },
  "product-signal": {
    headline: "El beneficio se ve en contexto.",
    supportingText: "El producto aparece sólo cuando una interfaz autorizada ayuda a explicar.",
    visualLabel: "FLUJO / 01",
    motion: "Marco de interfaz + hotspot + recorrido de acción",
    elements: ["Beneficio", "Interfaz autorizada", "Hotspot"],
    iconSuggestions: ["MousePointer2", "AppWindow", "CircleCheck"],
  },
  "systems-map": {
    headline: "Una relación hace visible el sistema.",
    supportingText: "Los nodos sólo se conectan cuando la voz expresa una relación real.",
    visualLabel: "SISTEMA / 01",
    motion: "Nodo activo + línea dibujada + consecuencia",
    elements: ["Nodo activo", "Conexión", "Etiqueta de relación"],
    iconSuggestions: ["Network", "GitBranch", "Workflow"],
  },
  "spatial-orbit": {
    headline: "Las ideas también tienen profundidad.",
    supportingText: "Three.js convierte relaciones, cambios y cifras en objetos visuales con cámara y movimiento controlado.",
    visualLabel: "ORBITA / 01",
    motion: "entrada orbital → nodo activo → conexión → settle con profundidad",
    elements: ["Escena Three.js", "Nodos semánticos", "Conectores de relación", "Métrica puntual"],
    iconSuggestions: ["Orbit", "Network", "Activity", "Database"],
  },
};

type PreviewChart = "bars" | "pulse" | "stack";

type PreviewScene = {
  id: string;
  start: number;
  end: number;
  label: string;
  title: string;
  description: string;
  subtitle: string;
  metricLabel: string;
  metric: string;
  chart: PreviewChart;
  visual?: "action" | "chart" | "change" | "data" | "device" | "line" | "money" | "node" | "note" | "none" | "process" | "quote" | "title" | "word";
};

const TEMPLATE_SHOWCASE_SCENES: Record<ExplainerTemplate["id"], PreviewScene[]> = {
  "editorial-split": [
    { id: "editorial-idea", start: 0, end: 10, label: "IDEA PRINCIPAL", title: "La claridad también tiene una dirección.", description: "Una idea principal, una voz experta y una lectura editorial que guía la mirada.", subtitle: "", metricLabel: "TESIS", metric: "01", chart: "stack", visual: "title" },
    { id: "editorial-quote", start: 10, end: 20, label: "VOZ EXPERTA", title: "Una frase puede ordenar todo el argumento.", description: "La cita aparece con jerarquía y deja respirar la imagen del presentador.", subtitle: "", metricLabel: "CITA", metric: "02", chart: "pulse", visual: "quote" },
    { id: "editorial-close", start: 20, end: 30, label: "CIERRE", title: "Una conclusión que permanece.", description: "El último mensaje se sostiene con contraste y una llamada visual discreta.", subtitle: "", metricLabel: "TAKEAWAY", metric: "03", chart: "bars", visual: "none" },
  ],
  "data-brief": [
    { id: "data-question", start: 0, end: 10, label: "PREGUNTA", title: "¿Qué está cambiando realmente?", description: "La pregunta abre el tema y prepara el dato que aparecerá en pantalla.", subtitle: "", metricLabel: "BASE", metric: "18.4", chart: "bars", visual: "title" },
    { id: "data-signal", start: 10, end: 20, label: "DATO DESTACADO", title: "El dato que cambia la conversación.", description: "La cifra principal sube de escala y las barras revelan la comparación.", subtitle: "", metricLabel: "IMPACTO", metric: "+42%", chart: "bars", visual: "data" },
    { id: "data-source", start: 20, end: 30, label: "LECTURA", title: "La tendencia apunta a una decisión.", description: "El cierre conecta el resultado con una acción concreta y verificable.", subtitle: "", metricLabel: "PROYECCIÓN", metric: "76", chart: "pulse", visual: "none" },
  ],
  "signal-minimal": [
    { id: "signal-hook", start: 0, end: 10, label: "SIGNAL / 01", title: "Una señal. Una decisión.", description: "Un mensaje directo, un fondo limpio y un primer golpe visual.", subtitle: "", metricLabel: "FOCUS", metric: "01", chart: "pulse", visual: "title" },
    { id: "signal-proof", start: 10, end: 20, label: "SIGNAL / 02", title: "El momento exige foco.", description: "El azul eléctrico conecta la afirmación con su evidencia.", subtitle: "", metricLabel: "PROOF", metric: "02", chart: "stack", visual: "change" },
    { id: "signal-action", start: 20, end: 30, label: "SIGNAL / 03", title: "Actúa sobre lo importante.", description: "La última pantalla reduce el ruido y deja una instrucción clara.", subtitle: "", metricLabel: "NEXT", metric: "03", chart: "bars", visual: "action" },
  ],
  "immersive-overlay": [
    { id: "immersive-context", start: 0, end: 10, label: "PLANO COMPLETO", title: "La persona sigue siendo el centro.", description: "El plano respira mientras un titular contextual aparece sobre la escena.", subtitle: "", metricLabel: "CONTEXT", metric: "01", chart: "pulse", visual: "title" },
    { id: "immersive-anchor", start: 10, end: 20, label: "ANCLAJE", title: "El gráfico acompaña, no compite.", description: "Una referencia visual se ancla al discurso sin tapar el momento.", subtitle: "", metricLabel: "ANCHOR", metric: "02", chart: "bars", visual: "action" },
    { id: "immersive-takeaway", start: 20, end: 30, label: "TAKEAWAY", title: "El plano permanece en la memoria.", description: "El cierre recupera el rostro y deja un mensaje flotante de baja fricción.", subtitle: "", metricLabel: "MEMORY", metric: "03", chart: "stack", visual: "none" },
  ],
  "centered-rails": [
    { id: "rails-intro", start: 0, end: 10, label: "CONTEXTO / 01", title: "Una voz al centro.", description: "El presentador introduce la idea mientras los laterales preparan el contexto.", subtitle: "", metricLabel: "CAPÍTULO", metric: "01", chart: "stack", visual: "title" },
    { id: "rails-evidence", start: 10, end: 20, label: "CONTEXTO / 02", title: "El contexto aparece a los lados.", description: "Una cifra o relación aparece sólo cuando la frase la necesita.", subtitle: "", metricLabel: "EVIDENCIA", metric: "+42%", chart: "bars", visual: "data" },
    { id: "rails-close", start: 20, end: 30, label: "CONTEXTO / 03", title: "La idea vuelve al centro.", description: "El mensaje final vuelve al presentador y deja respirar el encuadre.", subtitle: "", metricLabel: "CIERRE", metric: "03", chart: "pulse", visual: "none" },
  ],
  "kinetic-voice": [
    { id: "kinetic-hook", start: 0, end: 10, label: "PULSO / 01", title: "La voz marca el ritmo.", description: "Una palabra entra con el golpe exacto de la frase.", subtitle: "", metricLabel: "PULSO", metric: "01", chart: "pulse", visual: "change" },
    { id: "kinetic-build", start: 10, end: 20, label: "PULSO / 02", title: "Cada énfasis tiene un motivo.", description: "La tipografía se mueve una vez y luego deja respirar la voz.", subtitle: "", metricLabel: "ÉNFASIS", metric: "02", chart: "stack", visual: "change" },
    { id: "kinetic-close", start: 20, end: 30, label: "PULSO / 03", title: "El cierre baja el ruido.", description: "La última frase recupera escala humana y una acción clara.", subtitle: "", metricLabel: "CIERRE", metric: "03", chart: "bars", visual: "none" },
  ],
  "field-notes": [
    { id: "notes-observe", start: 0, end: 10, label: "OBSERVACIÓN", title: "Una observación abre el caso.", description: "Una nota breve se fija al plano y deja visible al orador.", subtitle: "", metricLabel: "NOTA", metric: "01", chart: "stack", visual: "quote" },
    { id: "notes-source", start: 10, end: 20, label: "REFERENCIA", title: "La fuente sostiene la lectura.", description: "La referencia aparece como una pieza del relato, no como una tabla.", subtitle: "", metricLabel: "FUENTE", metric: "02", chart: "pulse", visual: "quote" },
    { id: "notes-close", start: 20, end: 30, label: "LECTURA", title: "El caso deja una pregunta.", description: "La nota final abre una interpretación útil y queda en silencio.", subtitle: "", metricLabel: "LECTURA", metric: "03", chart: "bars", visual: "none" },
  ],
  "product-signal": [
    { id: "product-benefit", start: 0, end: 10, label: "BENEFICIO", title: "El beneficio se ve en contexto.", description: "El mensaje abre antes de introducir cualquier interfaz.", subtitle: "", metricLabel: "FLUJO", metric: "01", chart: "stack", visual: "title" },
    { id: "product-proof", start: 10, end: 20, label: "DEMOSTRACIÓN", title: "Un hotspot aclara el paso.", description: "La interfaz aparece sólo si existe una captura autorizada.", subtitle: "", metricLabel: "PASO", metric: "02", chart: "pulse", visual: "action" },
    { id: "product-result", start: 20, end: 30, label: "RESULTADO", title: "La función termina en valor.", description: "El resultado vuelve a la voz y una llamada concreta.", subtitle: "", metricLabel: "VALOR", metric: "03", chart: "bars", visual: "none" },
  ],
  "systems-map": [
    { id: "systems-node", start: 0, end: 10, label: "SISTEMA / 01", title: "Una relación hace visible el sistema.", description: "El primer nodo aparece junto a la idea que representa.", subtitle: "", metricLabel: "NODO", metric: "01", chart: "stack", visual: "process" },
    { id: "systems-link", start: 10, end: 20, label: "SISTEMA / 02", title: "La conexión explica la consecuencia.", description: "Una línea se dibuja sólo cuando la voz explica el vínculo.", subtitle: "", metricLabel: "VÍNCULO", metric: "02", chart: "pulse", visual: "process" },
    { id: "systems-close", start: 20, end: 30, label: "SISTEMA / 03", title: "El mapa termina en una decisión.", description: "Los nodos se retiran y queda la conclusión humana.", subtitle: "", metricLabel: "ACCIÓN", metric: "03", chart: "bars", visual: "none" },
  ],
  "spatial-orbit": [
    { id: "orbit-hook", start: 0, end: 10, label: "ORBITA / 01", title: "La idea entra en el campo.", description: "La cámara abre espacio y activa un único nodo semántico.", subtitle: "", metricLabel: "NODO", metric: "01", chart: "pulse", visual: "process" },
    { id: "orbit-link", start: 10, end: 20, label: "ORBITA / 02", title: "La relación se vuelve visible.", description: "El conector se dibuja cuando la voz expresa causa, flujo o consecuencia.", subtitle: "", metricLabel: "VÍNCULO", metric: "02", chart: "pulse", visual: "node" },
    { id: "orbit-proof", start: 20, end: 30, label: "ORBITA / 03", title: "El dato toma profundidad.", description: "Una métrica breve ocupa el foco y luego devuelve el aire al sistema.", subtitle: "", metricLabel: "PRUEBA", metric: "+42%", chart: "bars", visual: "data" },
  ],
};

const statusLabels: Record<ExplainerProject["status"], string> = {
  uploaded: "Video recibido",
  processing: "Analizando video",
  ready_for_review: "Listo para revisión",
  approved: "Aprobación recibida",
  rendering: "Renderizando resultado",
  completed: "Resultado disponible",
  failed: "Requiere atención",
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function isBusy(status: ExplainerProject["status"] | null): boolean {
  return status === "processing" || status === "approved" || status === "rendering";
}

const PREVIEW_DURATION_SECONDS = 30;

function formatPreviewTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.min(PREVIEW_DURATION_SECONDS, seconds));
  return `00:${String(Math.floor(safeSeconds)).padStart(2, "0")}`;
}

function getPreviewScenes(template: ExplainerTemplate): PreviewScene[] {
  if (template.system?.preview.scenes.length) {
    return template.system.preview.scenes.map((scene, index) => ({
      id: scene.id,
      start: scene.start,
      end: scene.end,
      label: scene.label,
      title: scene.title,
      description: scene.description,
      subtitle: scene.subtitle,
      metricLabel: scene.metric_label,
      metric: scene.metric,
      chart: scene.visual === "chart" ? "bars" : "stack",
      visual: scene.visual === "line" && index === 2 ? "none" : scene.visual,
    }));
  }
  return TEMPLATE_SHOWCASE_SCENES[template.id];
}

type PreviewTreatment = "title" | "action" | "money" | "change" | "process" | "quote" | "data" | "none";

function getPreviewTreatment(visual?: PreviewScene["visual"]): PreviewTreatment {
  const treatmentMap: Record<string, PreviewTreatment> = {
    action: "action",
    chart: "data",
    change: "change",
    data: "data",
    device: "action",
    line: "title",
    money: "money",
    node: "process",
    note: "quote",
    none: "none",
    process: "process",
    quote: "quote",
    title: "title",
    word: "change",
  };
  return treatmentMap[visual ?? "line"] ?? "title";
}

function PreviewSemanticIcon({ treatment }: { treatment: PreviewTreatment }) {
  const common = { size: 38, strokeWidth: 1.45 };
  if (treatment === "action") return <ArrowUpRight {...common} />;
  if (treatment === "money") return <CircleDollarSign {...common} />;
  if (treatment === "change") return <TrendingUp {...common} />;
  if (treatment === "process") return <GitBranch {...common} />;
  if (treatment === "quote") return <Quote {...common} />;
  if (treatment === "data") return <TrendingUp {...common} />;
  return <Type {...common} />;
}

function TemplatePreviewPlayer({
  template,
}: {
  template: ExplainerTemplate;
}) {
  const scenes = getPreviewScenes(template);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      const nextTime = timeRef.current + 0.1;
      if (nextTime >= PREVIEW_DURATION_SECONDS) {
        timeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        return;
      }
      timeRef.current = nextTime;
      setCurrentTime(nextTime);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    timeRef.current = nextTime;
    setCurrentTime(nextTime);
    setIsPlaying(false);
  }

  const activeSpatialScene = scenes[Math.min(2, Math.floor(Math.max(0, currentTime) / 10))] ?? scenes[0];

  return (
    <div className="template-showcase-player">
      <div className={["template-showcase-stage", `showcase-${template.id}`].join(" ")} data-playing={isPlaying}>
        {template.id === "spatial-orbit" && activeSpatialScene ? (
          <SpatialOrbitPreview
            scene={{ label: activeSpatialScene.label, title: activeSpatialScene.title, description: activeSpatialScene.description, metric: activeSpatialScene.metric }}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        ) : (
          <>
            <div className="showcase-presenter" aria-hidden="true">
              <span className="showcase-presenter-head" />
              <span className="showcase-presenter-body" />
              <span className="showcase-presenter-light" />
            </div>
            <div className="showcase-semantic-sequence" aria-live="polite">
              {scenes.map((scene, index) => {
                const sceneTreatment = getPreviewTreatment(scene.visual);
                const sceneText = sceneTreatment === "data" || sceneTreatment === "money" ? scene.metric : scene.title;
                return (
                  <div
                    className={["showcase-semantic-visual", `treatment-${sceneTreatment}`, sceneTreatment === "none" ? "is-hidden" : ""].filter(Boolean).join(" ")}
                    key={scene.id}
                    style={{ animationDelay: index === 0 ? "0s" : index === 1 ? "-20s" : "-10s" }}
                  >
                    <span className="showcase-semantic-icon" aria-hidden="true"><PreviewSemanticIcon treatment={sceneTreatment} /></span>
                    <strong>{sceneText}</strong>
                    {sceneTreatment === "quote" && <span>{scene.description}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="template-showcase-controls">
        <button
          type="button"
          className="showcase-play-button"
          onClick={() => setIsPlaying((playing) => !playing)}
          aria-label={isPlaying ? "Pausar previsualización" : "Reproducir previsualización"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="showcase-control-copy">
          <strong>{isPlaying ? "Reproduciendo dirección" : "Ver dirección en movimiento"}</strong>
          <span>Sin audio · 30 segundos</span>
        </div>
        <input
          className="showcase-seek"
          type="range"
          min="0"
          max={PREVIEW_DURATION_SECONDS}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Avanzar o retroceder la previsualización"
        />
        <span className="showcase-timecode">{formatPreviewTime(currentTime)} / 00:30</span>
      </div>
    </div>
  );
}

function TemplateShowcase({ template }: { template: ExplainerTemplate }) {
  const copy = TEMPLATE_SHOWCASE_COPY[template.id];
  const system = template.system;
  const elements = system?.components ?? copy.elements;
  const movement = system?.motion.beat ?? copy.motion;
  const icons = system?.icons.allowed ?? copy.iconSuggestions;

  return (
    <div className="explainer-template-showcase">
      <TemplatePreviewPlayer key={template.id} template={template} />
      <aside className="template-showcase-notes">
        <div>
          <span className="explainer-label">Ejemplo de composición</span>
          <h3>{template.name}</h3>
          <p>{template.description}</p>
        </div>
        <div className="showcase-note-block">
          <strong>Qué puedes definir</strong>
          <ul>
            {elements.map((element) => <li key={element}>{element}</li>)}
          </ul>
        </div>
        <div className="showcase-note-block">
          <strong>Movimiento recomendado</strong>
          <p>{movement}</p>
        </div>
        <div className="showcase-note-block">
          <strong>Íconos profesionales sugeridos</strong>
          <div className="showcase-tags">
            {icons.map((icon) => <span key={icon}>{icon}</span>)}
          </div>
        </div>
        <span className="showcase-hint">Haz clic en otra plantilla para comparar su dirección visual.</span>
      </aside>
      <TemplateSystemPanel template={template} />
    </div>
  );
}

export function ExplainerWorkspace() {
  const [templates, setTemplates] = useState<ExplainerTemplate[]>(FALLBACK_TEMPLATES);
  const [templateId, setTemplateId] = useState<ExplainerTemplate["id"]>("editorial-split");
  const [previewTemplateId, setPreviewTemplateId] = useState<ExplainerTemplate["id"]>("editorial-split");
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("es");
  const [response, setResponse] = useState<ExplainerResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const project = response?.project ?? null;
  const canReview = project?.status === "ready_for_review";
  const canApprove = canReview || project?.status === "approved";
  const previewUrl = response ? getExplainerApiUrl(response.links.preview) : "";

  useEffect(() => {
    getExplainerTemplates()
      .then(setTemplates)
      .catch(() => setTemplates(FALLBACK_TEMPLATES));
  }, []);

  useEffect(() => {
    if (!project || !isBusy(project.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getExplainerProject(project.id);
        setResponse(next);
      } catch {
        setMessage("No se pudo actualizar el estado del proyecto.");
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [project]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId, templates],
  );
  const previewTemplate = useMemo(
    () => templates.find((template) => template.id === previewTemplateId) ?? templates[0],
    [previewTemplateId, templates],
  );

  function handleTemplateSelect(nextTemplateId: ExplainerTemplate["id"]) {
    setTemplateId(nextTemplateId);
    setPreviewTemplateId(nextTemplateId);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Selecciona un video horizontal antes de continuar.");
      return;
    }
    setIsUploading(true);
    setMessage("");
    try {
      const next = await uploadExplainerVideo(file, templateId, language);
      setResponse(next);
      setMessage("Video recibido. El análisis comenzará automáticamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el video.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleApprove() {
    if (!project) return;
    setIsSaving(true);
    setMessage("");
    try {
      const next = await approveExplainerProject(project.id);
      setResponse(next);
      setMessage("Aprobación registrada. El render final está en cola.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aprobar el proyecto.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !feedback.trim()) return;
    setIsSaving(true);
    try {
      const next = await sendExplainerFeedback(project.id, feedback.trim(), templateId);
      setResponse(next);
      setFeedback("");
      setMessage("Cambios aplicados. Revisa la nueva composición.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aplicar el feedback.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="explainer-shell">
      <div className="explainer-hero">
        <div>
          <div className="explainer-kicker">
            <Sparkles size={15} strokeWidth={1.7} />
            Nexa Explainer Studio
          </div>
          <h1>La persona habla. La idea toma forma.</h1>
          <p>
            Sube un video horizontal y convierte su primer frame, su voz y sus
            ideas principales en una pieza explicativa lista para aprobar.
          </p>
        </div>
        <div className="explainer-hero-mark" aria-hidden="true">
          <PanelRight size={76} strokeWidth={1} />
        </div>
      </div>

      <div className="explainer-layout">
        <aside className="explainer-sidebar">
          <div className="explainer-sidebar-title">Flujo de producción</div>
          <ol className="explainer-steps">
            <li className={!project ? "is-active" : "is-done"}>
              <span>01</span><div><strong>Ingesta</strong><small>Video y metadatos</small></div>
              {project ? <Check size={15} /> : <ChevronRight size={15} />}
            </li>
            <li className={project?.status === "ready_for_review" ? "is-active" : project ? "is-done" : ""}>
              <span>02</span><div><strong>Dirección</strong><small>Frame y composición</small></div>
              {project?.status === "ready_for_review" ? <Focus size={15} /> : <ChevronRight size={15} />}
            </li>
            <li className={project?.status === "completed" ? "is-done" : ""}>
              <span>03</span><div><strong>Entrega</strong><small>Aprobación y render</small></div>
              {project?.status === "completed" ? <Check size={15} /> : <ChevronRight size={15} />}
            </li>
          </ol>
          <div className="explainer-trust">
            <ShieldCheck size={17} />
            <span>Tu archivo se procesa dentro del proyecto y cada revisión conserva su versión.</span>
          </div>
        </aside>

        <main className="explainer-main">
          <section className="explainer-card explainer-upload-card">
            <div className="explainer-card-heading">
              <div><span className="explainer-label">01 / Ingesta</span><h2>Comienza con tu video</h2></div>
              <Film size={22} strokeWidth={1.5} />
            </div>
            <form onSubmit={handleUpload}>
              <label className="explainer-dropzone" htmlFor="explainer-video">
                <input id="explainer-video" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <UploadCloud size={27} strokeWidth={1.4} />
                <strong>{file ? file.name : "Selecciona un video horizontal"}</strong>
                <span>MP4, MOV, WebM o MKV. Idealmente 16:9 con la persona a la izquierda.</span>
              </label>
              <div className="explainer-form-row">
                <label><span>Idioma de la voz</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label>
                <button className="explainer-primary-button" type="submit" disabled={isUploading}>
                  {isUploading ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}
                  {isUploading ? "Enviando" : "Analizar video"}
                </button>
              </div>
            </form>
          </section>

          <section className="explainer-card">
            <div className="explainer-card-heading">
              <div><span className="explainer-label">02 / Dirección visual</span><h2>Elige un lenguaje gráfico</h2></div>
              <PanelRight size={22} strokeWidth={1.5} />
            </div>
            <div className="explainer-template-grid">
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={["explainer-template", template.id === templateId ? "is-selected" : "", `template-${template.id}`].filter(Boolean).join(" ")}
                  onClick={() => handleTemplateSelect(template.id)}
                  aria-pressed={template.id === templateId}
                  aria-label={`Seleccionar y previsualizar ${template.name}`}
                >
                  <span className="template-preview"><span className="template-preview-person" /><span className="template-preview-panel"><i /><i /><i /></span></span>
                  <span className="template-copy"><strong>{template.name}</strong><small>{template.description}</small><em>{template.tone}</em></span>
                  {template.id === templateId && <CheckCircle2 className="template-check" size={19} />}
                </button>
              ))}
            </div>
            <div className="explainer-selection-note"><span>Seleccionada: {selectedTemplate?.name}</span><span>{selectedTemplate?.typography}</span></div>
            {previewTemplate && <TemplateShowcase template={previewTemplate} />}
          </section>

          {message && <div className="explainer-message" role="status">{message}</div>}

          {project && (
            <section className="explainer-card explainer-review-card">
              <div className="explainer-card-heading">
                <div><span className="explainer-label">03 / Revisión editorial</span><h2>{statusLabels[project.status]}</h2></div>
                <span className={`explainer-status status-${project.status}`}>{isBusy(project.status) && <LoaderCircle className="spin" size={14} />}{statusLabels[project.status]}</span>
              </div>
              <div className="explainer-meta"><span><FileVideo size={15} /> {project.original_filename}</span><span>{formatDuration(project.duration_seconds)}</span><span>Revisión {String(project.revision).padStart(2, "0")}</span></div>
              {project.error && <div className="explainer-error">{project.error}</div>}
              {project.warnings.map((warning) => <div className="explainer-warning" key={warning}>{warning}</div>)}
              {project.status !== "failed" && project.status !== "processing" && (
                <div className="explainer-preview-frame">
                  <iframe key={`${project.id}-${project.revision}-${project.status}`} title="Vista previa de Nexa Explainer" src={previewUrl} />
                  {project.status === "rendering" && <div className="explainer-preview-overlay"><LoaderCircle className="spin" size={25} /><span>Generando el archivo final</span></div>}
                </div>
              )}
              <div className="explainer-review-actions">
                <form className="explainer-feedback-form" onSubmit={handleFeedback}>
                  <MessageSquareText size={17} />
                  <input value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ej. Haz el título más directo y resalta la cifra principal" aria-label="Feedback de edición" disabled={isSaving || !canReview} />
                  <button type="submit" disabled={isSaving || !canReview || !feedback.trim()}>Aplicar</button>
                </form>
                <button className="explainer-approve-button" type="button" onClick={handleApprove} disabled={isSaving || !canApprove || project.status !== "ready_for_review"}>
                  {isSaving ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}
                  Aprobar y renderizar
                </button>
              </div>
              {project.status === "completed" && (
                <div className="explainer-delivery-links">
                  <a className="explainer-download-button" href={getExplainerApiUrl(response?.links.final_video ?? "")} target="_blank" rel="noreferrer"><Play size={16} /> Abrir video final</a>
                  <a className="explainer-asset-link" href={getExplainerApiUrl(response?.links.transcript ?? "")} target="_blank" rel="noreferrer"><FileVideo size={16} /> Ver transcripción JSON</a>
                  <a className="explainer-asset-link" href={getExplainerApiUrl(response?.links.audio ?? "")} target="_blank" rel="noreferrer"><Volume2 size={16} /> Escuchar audio extraído</a>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
