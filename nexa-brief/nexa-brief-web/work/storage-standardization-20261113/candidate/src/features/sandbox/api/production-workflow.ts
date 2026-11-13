import { httpClient } from "@/infrastructure/api/http-client";

export type ProductionDraft = {
	category: string;
	shared_categories: string[];
	title: string;
	description: string;
	demo: boolean;
	publication: Record<string, unknown>;
	poster_styles?: string[];
};
export type ProductionStatus = {
	folder: string;
	project_id: string;
	design_id: string;
	state: "draft" | "queued" | "validating" | "failed" | "ready" | "production";
	draft: ProductionDraft;
	issues: string[];
	warnings: string[];
	error: string | null;
	can_pass: boolean;
	component_count: number;
	report?: { files_checked: number; resources_checked: number; issues: string[]; warnings: string[]; posters: { entry: string; style: string; exists: boolean }[] };
	styles?: { id: string; name: string }[];
	destination: string;
};

export function productionEndpoint(folder: string, id: string) {
	return `/api/explainer/sandbox/${encodeURIComponent(folder)}/${encodeURIComponent(id)}/production`;
}

export const productionWorkflow = {
	get: (folder: string, id: string, signal?: AbortSignal) =>
		httpClient<ProductionStatus>(productionEndpoint(folder, id), {
			signal,
			sameOrigin: true,
		}),
	save: (folder: string, id: string, draft: ProductionDraft) =>
		httpClient<ProductionStatus>(productionEndpoint(folder, id), {
			method: "PUT",
			body: draft,
			sameOrigin: true,
		}),
	discard: (folder: string, id: string) =>
		httpClient<ProductionStatus>(productionEndpoint(folder, id), {
			method: "DELETE",
			sameOrigin: true,
		}),
	validate: (folder: string, id: string) =>
		httpClient<ProductionStatus>(`${productionEndpoint(folder, id)}/validate`, {
			method: "POST",
			sameOrigin: true,
		}),
	pass: (folder: string, id: string, draft: ProductionDraft) =>
		httpClient<ProductionStatus>(`${productionEndpoint(folder, id)}/pass`, {
			method: "POST",
			sameOrigin: true,
			timeoutMs: 30000,
			body: {
				category: draft.category,
				shared_categories: draft.shared_categories,
			},
		}),
};
