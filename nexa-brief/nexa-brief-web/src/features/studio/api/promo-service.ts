import { httpClient } from "@/infrastructure/api/http-client";

export type PromoProvider = "codex" | "claude";
export interface PromoAgent {
	provider: PromoProvider;
	model: string | null;
	reasoning_effort: string | null;
	available: boolean;
	quota_status: string | null;
	installed?: boolean | null;
	authenticated?: boolean | null;
	unavailable_reason?: string | null;
}
export interface PromoUsageStep {
	stage?: string | null;
	provider?: string | null;
	model?: string | null;
	reasoning_effort?: string | null;
	input_tokens?: number | null;
	cached_input_tokens?: number | null;
	output_tokens?: number | null;
	total_tokens?: number | null;
	seconds?: number | null;
	cost_usd?: number | null;
	cost_basis?: string | null;
}
export interface PromoUsageTotals {
	total_tokens?: number | null;
	known_total_tokens?: number | null;
	unknown_model_attempts?: number | null;
	cost_usd?: number | null;
	known_cost_usd?: number | null;
}
export interface PromoUsageData {
	steps?: PromoUsageStep[] | null;
	totals?: PromoUsageTotals | null;
}
export type PromoContentAvailability =
	| "available"
	| "missing"
	| "stale"
	| "pending";
export interface PromoContent {
	session_id: string | null;
	revision: number;
	draft_id: string | null;
	can_retry_preparation: boolean;
	media_basis: "resolved_plan" | "draft_inputs" | null;
	brief: { topic: string | null; tone: string | null; language: string | null; audience: string | null; duration_seconds: number | null } | null;
	title: string | null;
	copies: Record<
		string,
		{ title: string | null; description: string | null } | null
	> | null;
	guion: { segments: { n: number; scene: string; lines: string[] }[] } | null;
	media:
		| {
				id: string | null;
				name: string | null;
				type: string | null;
				source: string | null;
				author: string | null;
				license: string | null;
		  }[]
		| null;
	music: {
		id: string | null;
		name: string | null;
		type: string | null;
		source: string | null;
		author: string | null;
		license: string | null;
	} | null;
	availability: {
		draft: PromoContentAvailability;
		brief: PromoContentAvailability;
		guion: PromoContentAvailability;
		media: PromoContentAvailability;
		music: PromoContentAvailability;
	};
}
export const getPromoContent = (id: string, signal?: AbortSignal) =>
	httpClient<PromoContent>(
		`/api/v1/promos/sessions/${encodeURIComponent(id)}/content`,
		{ signal },
	);
export interface PromoSession {
	session_id: string;
	template_id: string;
	state: "queued" | "running" | "review" | "ready" | "failed";
	stage: string | null;
	revision: number;
	draft_id: string | null;
	draft_history?: string[] | null;
	messages:
		| {
				id: string;
				role: "user" | "assistant";
				content: string;
				created_at: string;
		  }[]
		| null;
	error: string | null;
	usage: PromoUsageData | null;
	quality: {
		passed: boolean;
		checks?: unknown[] | null;
		errors?: unknown[] | null;
		warnings?: unknown[] | null;
	} | null;
}
export const PROMO_IDS = new Set([
	"promo-editorial",
	"promo-sports",
	"promo-dynamic",
	"promo-kinetic",
	"promo-trendy",
	"promo-urban",
]);
export const promoSessionsKey = (id: string) => ["promo-sessions", id] as const;
export const promoSessionKey = (id: string) => ["promo-session", id] as const;
export const listPromoSessions = (id: string, signal?: AbortSignal) =>
	httpClient<{ sessions: PromoSession[]; archived_draft_ids?: string[] }>(
		`/api/v1/promos/sessions?template_id=${encodeURIComponent(id)}`,
		{ signal },
	);
export const deletePromoSession = (id: string) =>
	httpClient<void>(`/api/v1/promos/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getPromoSession = (id: string, signal?: AbortSignal) =>
	httpClient<PromoSession>(
		`/api/v1/promos/sessions/${encodeURIComponent(id)}`,
		{ signal },
	);
export const listPromoAgents = (signal?: AbortSignal) =>
	httpClient<{ default_provider: PromoProvider; agents: PromoAgent[] }>(
		"/api/v1/promos/agents",
		{ signal },
	);
export const createPromoSession = (
	template_id: string,
	message: string,
	provider: PromoProvider,
) =>
	httpClient<PromoSession>("/api/v1/promos/sessions", {
		method: "POST",
		body: { template_id, message, provider },
		timeoutMs: 60_000,
	});
export const sendPromoMessage = (id: string, message: string) =>
	httpClient<PromoSession>(
		`/api/v1/promos/sessions/${encodeURIComponent(id)}/messages`,
		{ method: "POST", body: { message }, timeoutMs: 60_000 },
	);
export const retryPromo = (id: string) =>
	httpClient<PromoSession>(
		`/api/v1/promos/sessions/${encodeURIComponent(id)}/retry`,
		{
			method: "POST",
			timeoutMs: 60_000,
		},
	);
export const approvePromo = (id: string, revision: number) =>
	httpClient<PromoSession>(
		`/api/v1/promos/sessions/${encodeURIComponent(id)}/approve`,
		{ method: "POST", body: { revision }, timeoutMs: 60_000 },
	);

export const importPromoDraft = (draftId: string) =>
	httpClient<PromoSession>(
		`/api/v1/promos/sessions/from-draft/${encodeURIComponent(draftId)}`,
		{ method: "POST", timeoutMs: 60_000 },
	);
