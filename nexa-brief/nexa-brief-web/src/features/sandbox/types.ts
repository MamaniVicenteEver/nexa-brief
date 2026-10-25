export type SandboxKind =
  | "explainer_kit"
  | "nodeaction"
  | "mapas"
  | "pizarra"
  | "proto"
  | "hyperframes"
  | "reference"
  | "other";

export type SandboxPlayer = "protocol" | "video" | "none";
export type SandboxRole = "projects" | "references";

export interface SandboxItem {
  id: string;
  folder: string;
  subcategory: string | null;
  path: string;
  kind: SandboxKind;
  title: string;
  status: string | null;
  design: string | null;
  hasIndex: boolean;
  hasPoster: boolean;
  hasInfo: boolean;
  totalTokens: number | null;
  thumbnailUrl: string | null;
  player: SandboxPlayer;
  videos: string[];
  notesFile: string | null;
  updatedAt: string | null;
  promotable: boolean;
  promoteBlocker: string | null;
}

export interface SandboxFolder {
  folder: string;
  label: string;
  role: SandboxRole;
  categoryId: string | null;
  items: SandboxItem[];
}

export type SandboxPreviewTarget = { type: "iframe" | "video"; url: string } | null;

export interface SandboxInfoDocument {
  version?: number;
  title?: string;
  summary?: string;
  engine?: string;
  based_on?: string | null;
  is_new_design?: boolean;
  status?: string;
  created_at?: string;
  libraries?: Array<{ name: string; version?: string; purpose?: string }>;
  inputs?: string[];
  notes?: string[];
}

export interface SandboxModelUsage {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  freshInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface SandboxInfo {
  info: SandboxInfoDocument | null;
  totalsByModel: SandboxModelUsage[];
  totalTokens: number;
  cachedTokens: number;
  estimated: boolean;
  baseline: { id: string; totalTokens: number } | null;
  ratioVsBaseline: number | null;
  forecastNext: { min: number; max: number; basis: string } | null;
  verdict: "eficiente" | "aceptable" | "caro" | null;
}
