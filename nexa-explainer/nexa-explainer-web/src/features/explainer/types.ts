export type ExplainerTemplate = {
  id:
    | "editorial-split"
    | "data-brief"
    | "signal-minimal"
    | "immersive-overlay"
    | "centered-rails"
    | "kinetic-voice"
    | "field-notes"
    | "product-signal"
    | "systems-map"
    | "spatial-orbit";
  name: string;
  description: string;
  tone: string;
  typography: string;
  icon_system: string;
  system?: TemplateSystemManifest;
};

export type TemplatePaletteToken = {
  role: string;
  name: string;
  value: string;
};

export type TemplatePreviewScene = {
  id: string;
  start: number;
  end: number;
  label: string;
  title: string;
  description: string;
  subtitle: string;
  metric_label: string;
  metric: string;
  visual: "action" | "chart" | "change" | "data" | "device" | "line" | "money" | "node" | "note" | "none" | "process" | "quote" | "title" | "word";
};

export type TemplateSystemManifest = {
  palette: TemplatePaletteToken[];
  typography_system: {
    headline: string;
    body: string;
    meta: string;
    order: string;
  };
  layout: {
    presenter: string;
    visual_zone: string;
    caption_zone: string;
    reading_order: string;
  };
  components: string[];
  motion: {
    runtime: string;
    beat: string;
    transitions: string[];
    forbidden: string[];
  };
  captions: {
    max_lines: number;
    max_chars: number;
    style: string;
    highlight: string;
  };
  evidence_policy: {
    show_graph_when: string;
    alternatives: string[];
    source_label: string;
  };
  icons: {
    library: string;
    allowed: string[];
    render: string;
  };
  tools: string[];
  ai_contract: {
    allowed_scene_kinds: string[];
    max_simultaneous_overlays: number;
    must_preserve: string[];
    rule: string;
  };
  extensions?: {
    semantic_overlay?: {
      visual_treatments: string[];
      components: string[];
      motion: {
        beat: string;
        transitions: string[];
      };
      rule: string;
    };
  };
  preview: {
    headline: string;
    supporting_text: string;
    visual_forms: string[];
    scenes: TemplatePreviewScene[];
  };
};

export type ExplainerProject = {
  id: string;
  original_filename: string;
  status:
    | "uploaded"
    | "processing"
    | "ready_for_review"
    | "approved"
    | "rendering"
    | "completed"
    | "failed";
  template_id: ExplainerTemplate["id"];
  duration_seconds: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  frame_analysis: {
    width: number;
    height: number;
    presenter_position: string;
    provider: string;
  } | null;
  transcript: {
    provider: string;
    quality: string;
    warnings: string[];
  } | null;
  warnings: string[];
  error: string | null;
  revision: number;
  ai_used: boolean;
};

export type ExplainerLinks = {
  self: string;
  first_frame: string;
  preview: string;
  transcript: string;
  audio: string;
  approve: string;
  feedback: string;
  final_video: string;
};

export type ExplainerResponse = {
  project: ExplainerProject;
  links: ExplainerLinks;
};
