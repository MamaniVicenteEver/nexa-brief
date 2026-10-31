export const PROTOTYPE_CATEGORIES = [
  "nodetech",
  "nodehistory",
  "nodepolitics",
  "nodeeconomy",
  "nodeaction",
  "nodemotion",
  "otros",
] as const;

export type PrototypeCategory = (typeof PROTOTYPE_CATEGORIES)[number];

export interface CreatePrototypeIdeaInput {
  category: PrototypeCategory;
  title: string;
  notes: string;
  files: File[];
}

export interface PrototypeIdea {
  category: PrototypeCategory;
  slug: string;
  title: string;
  path: string;
  files: string[];
}

export interface PrototypeLink {
  url: string;
  prompt: string;
  ssh_path: string;
  local_path: string;
}

export type PrototypeRunState = "queued" | "running" | "done" | "failed" | "cancelled";
export type PrototypeRunMode = "full" | "smoke";

export interface PrototypeRunTokens {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  turns: number;
  cost_usd: number | null;
  provider: "claude" | "codex";
  model: string;
}

export interface PrototypeRun {
  run_id: string;
  category: PrototypeCategory;
  idea_id: string;
  template_id: string;
  agent: "claude" | "codex";
  model: string;
  reasoning_effort: string;
  mode: PrototypeRunMode;
  state: PrototypeRunState;
  error: string | null;
  claude_usage: Record<string, unknown> | null;
  codex_usage: Record<string, unknown> | null;
  tokens: PrototypeRunTokens | null;
  usage_recorded: boolean;
  template_url: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  log_tail?: string;
}

export interface CreatePrototypeRunInput {
  category: PrototypeCategory;
  slug: string;
  agent: "claude" | "codex";
  template_id: string;
  mode: PrototypeRunMode;
}
