import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/features/categories";
import messages from "../../../../messages/es.json";
import { PublicationsSection } from "../components/PublicationsSection";

vi.mock("@/features/explainer", () => ({
	useExplainerVideos: () => ({ data: [], isError: false }),
}));
const category: CategoryNode = {
	id: "node_tech",
	path: "nodetech",
	displayName: "NodeTech",
	topic: "tecnología",
	status: "active",
	engine: "explainer_kit",
	niches: [],
	designs: [],
	strategy: null,
	children: [],
};
const ids = [
	"img_ff353931a79b4c6f9b56e03abedfeb2d",
	"img_081987adc5044cbcbc0946b66e303db3",
	"img_b81a2db1977b47a489b0e16d7a97a135",
];
// Optional API snapshots exercise this same flow with the real posts, without secrets.
function record(id: string, index: number) {
	const directory = process.env.IMAGE_REVIEW_DATA_DIR;
	if (directory)
		return JSON.parse(readFileSync(join(directory, `${id}.json`), "utf8"));
	return {
		post_id: id,
		publication_id: `pub_${index}`,
		status: index === 2 ? "failed" : "ready_for_review",
		created_at: "2026-11-01T00:00:00Z",
		updated_at: "2026-11-01T00:01:00Z",
		editorial: {
			category_id: "node_tech",
			title: `Post ${index}`,
			strategy_id: "amarillista",
			slides: [{ slide_id: "s1", alt_text_ig: "Portada verificada" }],
			sources: [],
			copy: {},
			review: { required: true },
		},
		technical: {
			kind: "carousel",
			template_id: "five_slides",
			slides:
				index === 2
					? []
					: Array.from({ length: index === 0 ? 8 : 6 }, (_, i) => ({
							slide_id: `s${i + 1}`,
							asset_id: `asset_${i}`,
							order: i + 1,
							preview_url: `/api/image-posts/${id}/assets/asset_${i}`,
						})),
		},
		deliveries: [],
		trace: {
			schema_version: 1,
			identity: { post_id: id, slides: index === 0 ? 8 : 6 },
			status: index === 2 ? "failed" : "ready_for_review",
			duration_seconds: 42,
			error: index === 2 ? "Falló la generación de prueba" : null,
			totals: {
				calls: 10,
				writer_rounds: 2,
				repairs: 1,
				corrections: 3,
				unknown_usage_calls: 0,
				tokens: {
					input_tokens: 100,
					cached_input_tokens: 0,
					output_tokens: 20,
					total_tokens: 120,
				},
				cost: { usd: 0, complete: true, label: "incluido en la suscripción" },
				by_model: [],
			},
			timeline: [],
		},
	};
}
const records = ids.map(record);
function mount() {
	const requests: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			const url = String(input);
			requests.push(url);
			let data: unknown;
			if (url.startsWith("/api/image-posts?")) {
				data = { items: records.map(({ trace: _trace, ...row }) => row) };
			} else if (url.startsWith("/api/image-posts/styles"))
				data = { styles: [] };
			else if (url.startsWith("/api/image-posts/capabilities"))
				data = { accounts: [] };
			else if (url === "/api/image-posts/strategies") data = [];
			else if (url.startsWith("/api/publications?")) data = { items: [] };
			else if (url.includes("/preview?")) {
				const query = new URL(url, "https://example.test").searchParams;
				const format = query.get("format");
				data = {
					html: `<!doctype html><html><body>Composición ${query.get("slide_id")} · ${format}</body></html>`,
					format,
					width: 1080,
					height: format === "9:16" ? 1920 : format === "3:5" ? 1800 : 1350,
					revision: 1,
					plan_hash: "preview-test",
					slide_id: query.get("slide_id"),
				};
			} else {
				data = records.find((row) => url === `/api/image-posts/${row.post_id}`);
				if (!data) throw new Error(`Unexpected request: ${url}`);
			}
			return new Response(JSON.stringify(data), {
				headers: { "Content-Type": "application/json" },
			});
		}),
	);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<NextIntlClientProvider locale="es" messages={messages}>
				<PublicationsSection category={category} categories={[category]} />
			</NextIntlClientProvider>
		</QueryClientProvider>,
	);
	return requests;
}
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("revisión desde Editor y entregas", () => {
	it.each(records.map((row, index) => [index, row] as const))(
		"abre detalle y traza obtenida por ID (post %i)",
		async (_index, row) => {
			const requests = mount();
			const trigger = await screen.findByRole("button", {
				name: `Ver detalle de ${row.editorial.title}`,
			});
			if (row.technical.slides.length) {
				expect(
					trigger.closest("article")?.querySelector("img")?.getAttribute("src"),
				).toBe(row.technical.slides[0].preview_url);
			}
			fireEvent.click(trigger);
			const dialog = await screen.findByRole("dialog");
			const ui = within(dialog);
			await waitFor(() =>
				expect(ui.getAllByText(row.editorial.title).length).toBeGreaterThan(0),
			);
			expect(ui.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
				"Relevante",
				"Recorrido",
				"Técnica",
				"Publicar",
			]);
			if (row.technical.slides.length) {
				const preview = await ui.findByTitle("Portada verificada");
				expect(preview.getAttribute("srcdoc")).toContain(
					"Composición s1 · 4:5",
				);
				expect(preview.getAttribute("sandbox")).toBe("allow-scripts");
				fireEvent.click(ui.getByRole("button", { name: /lámina 2/i }));
				expect(
					ui
						.getByRole("button", { name: /lámina 2/i })
						.getAttribute("aria-current"),
				).toBe("true");
			} else if (row.status === "failed") {
				expect(
					ui.getByText(/La generación falló antes de guardar las láminas/),
				).toBeTruthy();
			}
			fireEvent.click(ui.getByRole("tab", { name: "Recorrido" }));
			expect(ui.getByText("Recorrido de producción")).toBeTruthy();
			fireEvent.click(ui.getByRole("button", { name: "Ver JSON" }));
			expect(ui.getByRole("tabpanel").textContent).toContain(
				JSON.stringify(row.trace, null, 2),
			);
			expect(requests).toContain(`/api/image-posts/${row.post_id}`);
			expect(requests.some((url) => url.startsWith("/api/publications/"))).toBe(
				false,
			);
			fireEvent.click(ui.getByRole("tab", { name: "Técnica" }));
			expect(
				ui.getByRole("tab", { name: "Técnica" }).getAttribute("aria-selected"),
			).toBe("true");
		},
	);
	it("abre Publicar desde la tarjeta con el formato 4:5", async () => {
		mount();
		const button = await screen.findByRole("button", {
			name: `Publicar ${records[0].editorial.title}`,
		});
		fireEvent.click(button);
		const ui = within(await screen.findByRole("dialog"));
		await waitFor(() =>
			expect(
				ui.getByRole("tab", { name: "Publicar" }).getAttribute("aria-selected"),
			).toBe("true"),
		);
		expect(
			ui.getByRole("button", { name: /Formato 4:5/ }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			screen.queryByRole("button", {
				name: `Publicar ${records[2].editorial.title}`,
			}),
		).toBeNull();
	});

	it("orienta desde la galería vacía y vuelve a los posts pendientes", async () => {
		mount();
		await screen.findByRole("button", {
			name: `Ver detalle de ${records[0].editorial.title}`,
		});
		fireEvent.click(screen.getByRole("tab", { name: "Galería de publicadas" }));
		expect(
			await screen.findByText(
				"Los posts pendientes de revisión están en Editor y entregas.",
			),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Editor y entregas" }));
		expect(
			await screen.findByRole("button", {
				name: `Ver detalle de ${records[0].editorial.title}`,
			}),
		).toBeTruthy();
	});
});
