import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PromoReview } from "../components/sandbox/PromoReview";
import { PromoUsage } from "../components/sandbox/PromoUsage";
import { PromoSandbox } from "../components/sandbox/PromoSandbox";
import type { Draft } from "../types";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";
import * as api from "../api/promo-service";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/resources", () => ({
	ResourcePicker: ({ kind, onChange }: { kind: string; onChange: (assetId: string | null) => void }) => (
		<button type="button" data-kind={kind} onClick={() => onChange("replacement-2")}>
			Elegir recurso {kind}
		</button>
	),
}));
vi.mock("../api/promo-service", async (original) => ({
	...(await original<typeof api>()),
	getPromoSession: vi.fn(),
	approvePromo: vi.fn(),
	replacePromoMedia: vi.fn(),
	importPromoDraft: vi.fn(),
	listPromoAgents: vi.fn(),
	sendPromoMessage: vi.fn(),
	retryPromo: vi.fn(),
	getPromoContent: vi.fn().mockRejectedValue(new Error("Sin datos")),
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("shows the prepared demo in ready, plays it and selects the original for recording", () => {
	const studio = {
		template: { id: "promo-dynamic" },
		original: { draft: { draftId: "demo-id", original: true, status: "prepared", previewUrl: "/demo", name: "Nombre interno" } },
		prototypes: [],
		promoSessions: { data: { sessions: [] } },
		previewPrototype: vi.fn(),
		recordPrototype: vi.fn(),
	} as unknown as TemplateStudioController;
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(<QueryClientProvider client={client}><PromoSandbox studio={studio} /></QueryClientProvider>);
	const demo = screen.getByText("Demo").closest("li")!;
	expect(demo.parentElement?.parentElement?.textContent).toContain("Listos para grabar");
	expect(demo.textContent).toContain("Preparado");
	expect(demo.querySelector('[aria-label*="Borrar"]')).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Reproducir Demo" }));
	expect(studio.previewPrototype).toHaveBeenCalledWith("demo-id");
	fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
	expect(studio.recordPrototype).toHaveBeenCalledWith("__original");
});

it("requires a passing review before approval and does not start recording", async () => {
	const draft: api.PromoSession = {
		session_id: "s1",
		template_id: "promo-editorial",
		state: "review",
		stage: null,
		revision: 3,
		draft_id: "d1",
		messages: [],
		error: null,
		usage: null,
		quality: { passed: false },
	};
	vi.mocked(api.getPromoSession).mockResolvedValue(draft);
	const recordPrototype = vi.fn();
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-editorial" },
		prototypes: [],
		promoSessions: { data: { sessions: [draft] } },
		recordPrototype,
		previewPrototype: vi.fn(),
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByText("En revisión"));
	const button = await screen.findByRole("button", {
		name: "Confirmo: listo para grabar",
	});
	expect((button as HTMLButtonElement).disabled).toBe(true);
	client.setQueryData(api.promoSessionKey("s1"), {
		...draft,
		quality: { passed: true },
	});
	await waitFor(() =>
		expect((button as HTMLButtonElement).disabled).toBe(false),
	);
	vi.mocked(api.approvePromo).mockResolvedValue({
		...draft,
		state: "ready",
		quality: { passed: true },
	});
	fireEvent.click(button);
	await waitFor(() => expect(api.approvePromo).toHaveBeenCalledWith("s1", 3));
	expect(recordPrototype).not.toHaveBeenCalled();
});

it("imports an existing draft into review without recording", async () => {
	const session: api.PromoSession = {
		session_id: "legacy-session",
		template_id: "promo-editorial",
		state: "review",
		stage: null,
		revision: 1,
		draft_id: "legacy",
		messages: [],
		error: null,
		usage: null,
		quality: { passed: true },
	};
	vi.mocked(api.importPromoDraft).mockResolvedValue(session);
	vi.mocked(api.getPromoSession).mockResolvedValue(session);
	const recordPrototype = vi.fn();
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-editorial" },
		prototypes: [
			{ draftId: "legacy", name: "Anterior", previewUrl: "/preview" },
		],
		promoSessions: { data: { sessions: [] } },
		recordPrototype,
		previewPrototype: vi.fn(),
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
	await screen.findByText("Revisión del prototipo");
	expect(api.importPromoDraft).toHaveBeenCalledWith("legacy");
	expect(recordPrototype).not.toHaveBeenCalled();
});

it("shows measured zero distinctly from unknown usage and labels provider effort", () => {
	render(
		<PromoUsage
			usage={{
				totals: {
					known_total_tokens: 0,
					total_tokens: null,
					unknown_model_attempts: 1,
				},
				steps: [
					{
						stage: "proposal",
						provider: "codex",
						model: "Terra",
						reasoning_effort: "high",
						input_tokens: 0,
						cached_input_tokens: null,
						output_tokens: 0,
						total_tokens: null,
						seconds: 0,
						cost_usd: 0,
						cost_basis: "list",
					},
				],
			}}
		/>,
	);
	fireEvent.click(screen.getByText("Uso de agentes"));
	expect(screen.getByText(/Tokens de modelos conocidos: 0/)).toBeTruthy();
	expect(screen.getByText(/total completo desconocido/)).toBeTruthy();
	expect(screen.getByText("codex")).toBeTruthy();
	expect(screen.getByText("high")).toBeTruthy();
	expect(screen.getByText("Tarifa de lista")).toBeTruthy();
	expect(screen.getAllByText("Desconocido").length).toBeGreaterThan(0);
});

it("shows provider unavailability reason without claiming quota is known", async () => {
	vi.mocked(api.listPromoAgents).mockResolvedValue({
		default_provider: "codex",
		agents: [
			{
				provider: "codex",
				model: "Terra",
				reasoning_effort: "high",
				available: false,
				quota_status: "unknown",
				authenticated: false,
				unavailable_reason: "La sesión del proveedor no está autenticada.",
			},
		],
	});
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-trendy" },
		prototypes: [],
		promoSessions: { data: { sessions: [] } },
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByText("+ Nuevo prototipo"));
	expect(
		await screen.findByText(/La sesión del proveedor no está autenticada/),
	).toBeTruthy();
	expect(screen.getByText(/La disponibilidad no confirma el saldo o la cuota/)).toBeTruthy();
});

it("selects an available alternative and preserves a safe reason containing a profile version", async () => {
	vi.mocked(api.listPromoAgents).mockResolvedValue({
		default_provider: "codex",
		agents: [
			{ provider: "codex", model: "gpt-6.1-terra", reasoning_effort: "high", available: false, quota_status: "unknown", unavailable_reason: "Los agentes CLI están deshabilitados para perfiles v2/v3: Codex aislado no está verificado para este host." },
			{ provider: "claude", model: "claude-sonnet-5-5", reasoning_effort: "medium", available: true, quota_status: "unknown" },
		],
	});
	const studio = { template: { id: "promo-dynamic" }, prototypes: [], promoSessions: { data: { sessions: [] } } } as unknown as TemplateStudioController;
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(<QueryClientProvider client={client}><PromoSandbox studio={studio} /></QueryClientProvider>);
	fireEvent.click(screen.getByText("+ Nuevo prototipo"));
	expect(await screen.findByText(/perfiles v2\/v3/)).toBeTruthy();
	const codex = screen.getByRole("radio", { name: /Codex/ }) as HTMLInputElement;
	const claude = screen.getByRole("radio", { name: /Claude/ }) as HTMLInputElement;
	expect(codex.disabled).toBe(true);
	await waitFor(() => expect(claude.checked).toBe(true));
	fireEvent.change(screen.getByLabelText("Idea e instrucciones"), {target: {value: "Una promo sobre auroras"}});
	expect((screen.getByRole("button", {name: "Crear prototipo"}) as HTMLButtonElement).disabled).toBe(false);
});

it("does not expose an absolute path in a provider error", async () => {
	vi.mocked(api.listPromoAgents).mockResolvedValue({default_provider: "codex", agents: [{provider: "codex", model: "Terra", reasoning_effort: "high", available: false, quota_status: "unknown", unavailable_reason: "Falta path=/home/user/secret-file"}]});
	const studio = {template: {id: "promo-dynamic"}, prototypes: [], promoSessions: {data: {sessions: []}}} as unknown as TemplateStudioController;
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	render(<QueryClientProvider client={client}><PromoSandbox studio={studio} /></QueryClientProvider>);
	fireEvent.click(screen.getByText("+ Nuevo prototipo"));
	expect(await screen.findByText("No se pudo verificar la disponibilidad del proveedor.")).toBeTruthy();
	expect(screen.queryByText(/home\/user/)).toBeNull();
});

it("offers correction of a ready session without starting a recording", async () => {
	const draft: api.PromoSession = {
		session_id: "s",
		template_id: "promo-trendy",
		state: "ready",
		stage: null,
		revision: 2,
		draft_id: "d",
		messages: [],
		error: null,
		usage: null,
		quality: { passed: true },
	};
	vi.mocked(api.getPromoSession).mockResolvedValue(draft);
	vi.mocked(api.sendPromoMessage).mockResolvedValue({
		...draft,
		state: "queued",
	});
	const recordPrototype = vi.fn();
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-trendy" },
		prototypes: [],
		promoSessions: { data: { sessions: [draft] } },
		recordPrototype,
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByText("Listo para grabar"));
	fireEvent.click(
		await screen.findByRole("button", { name: "Sugerir cambios" }),
	);
	fireEvent.change(screen.getByLabelText("Correcciones"), {
		target: { value: "Mejora el cierre" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Enviar correcciones" }));
	await waitFor(() =>
		expect(api.sendPromoMessage).toHaveBeenCalledWith("s", "Mejora el cierre"),
	);
	expect(recordPrototype).not.toHaveBeenCalled();
});

for (const state of ["failed"] as const) {
	it(`retries ${state} preparation without sending a message or recording`, async () => {
		const draft: api.PromoSession = {
			session_id: "s",
			template_id: "promo-trendy",
			state,
			stage: null,
			revision: 2,
			draft_id: "d",
			messages: [],
			error: null,
			usage: null,
			quality: { passed: true },
		};
		vi.mocked(api.getPromoSession).mockResolvedValue(draft);
		vi.mocked(api.retryPromo).mockResolvedValue({ ...draft, state: "queued" });
		vi.mocked(api.getPromoContent).mockResolvedValue({ session_id: "s", revision: 2, draft_id: "d", can_retry_preparation: true } as api.PromoContent);
		const recordPrototype = vi.fn();
		const studio = {
		clearPrototypePreview: vi.fn(),
			template: { id: "promo-trendy" },
			prototypes: [],
			promoSessions: { data: { sessions: [draft] } },
			recordPrototype,
		} as unknown as TemplateStudioController;
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<PromoSandbox studio={studio} />
			</QueryClientProvider>,
		);
		fireEvent.click(
			screen.getByText(state === "failed" ? "No se pudo preparar" : "En revisión"),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "Reintentar preparación" }),
		);
		await waitFor(() => expect(api.retryPromo).toHaveBeenCalledWith("s"));
		expect(api.sendPromoMessage).not.toHaveBeenCalled();
		expect(api.approvePromo).not.toHaveBeenCalled();
		expect(recordPrototype).not.toHaveBeenCalled();
	});
}

it("does not list a previous revision as a legacy prototype", () => {
	const draft: api.PromoSession = {
		session_id: "s",
		template_id: "promo-trendy",
		state: "review",
		stage: null,
		revision: 2,
		draft_id: "current",
		draft_history: ["previous"],
		messages: [],
		error: null,
		usage: null,
		quality: { passed: true },
	};
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-trendy" },
		prototypes: [
			{ draftId: "previous", name: "Anterior" },
			{ draftId: "unrelated", name: "Sin sesión" },
		],
		promoSessions: { data: { sessions: [draft] } },
	} as unknown as TemplateStudioController;
	const client = new QueryClient();
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	expect(screen.queryByText("Anterior")).toBeNull();
	expect(screen.getByText("Sin sesión")).toBeTruthy();
});

it("shows the actual review content and opens corrections only on request", async () => {
	const draft: api.PromoSession = {
		session_id: "content",
		template_id: "promo-trendy",
		state: "review",
		stage: null,
		revision: 2,
		draft_id: "draft",
		messages: [
			{ id: "1", role: "user", content: "Idea original", created_at: "2026" },
		],
		error: null,
		usage: null,
		quality: { passed: true },
	};
	vi.mocked(api.getPromoSession).mockResolvedValue(draft);
	vi.mocked(api.getPromoContent).mockResolvedValue({
		session_id: "content",
		revision: 2,
		draft_id: "draft",
		can_retry_preparation: true,
		media_basis: "resolved_plan",
		brief: { topic: "Arrecifes", audience: "Público general", duration_seconds: 60, tone: null, language: null },
		title: "Mi promo",
		copies: {
			youtube: { title: "Título YouTube", description: "Descripción YouTube" },
		},
		guion: {
			segments: [{ n: 1, scene: "title", lines: ["TEXTO EN PANTALLA"] }],
		},
		media: [
			{
				id: "a",
				name: "Fotografía del arrecife",
				type: "image",
				source: "Pexels",
				author: "Autor",
				license: "Pexels",
			},
		],
		music: {
			id: "b",
		type: "audio",
		source: "Archivo",
			name: "Música original",
			author: "Compositor",
			license: "CC",
		},
		availability: {
			draft: "available",
			brief: "available",
			guion: "available",
			media: "available",
			music: "available",
		},
	});
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-trendy" },
		prototypes: [{ draftId: "draft", name: "Mi promo", previewUrl: null, thumbnails: { fingerprint: "v1", selected: "B", urls: { A: "/a.jpg", B: "/b.jpg" }, options: { B: { text: "Corales" } } } }],
		promoSessions: { data: { sessions: [draft] } },
		previewPrototype: vi.fn(),
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByText("En revisión"));
	expect(await screen.findByText("Mi promo")).toBeTruthy();
	expect(screen.getByText("TEXTO EN PANTALLA")).toBeTruthy();
	expect(screen.getByText("Diálogo o narración: no disponible.")).toBeTruthy();
	expect(screen.getByText("Fotografía del arrecife")).toBeTruthy();
	expect(screen.getByText("Música original")).toBeTruthy();
 expect(screen.getByText("Arrecifes")).toBeTruthy();
 expect(screen.getByText("Público general")).toBeTruthy();
 expect(screen.getByText("60 segundos")).toBeTruthy();
 const imageA = screen.getByRole("img", {name: "Miniatura A"});
 expect(imageA.getAttribute("loading")).toBe("lazy");
 expect(screen.getByRole("img", {name: "Miniatura B"}).getAttribute("src")).toBe("/b.jpg");
 expect(screen.getByText("Opción B · Seleccionada · Corales")).toBeTruthy();
 fireEvent.error(imageA);
 expect(screen.getByText("Miniatura A: no disponible.")).toBeTruthy();
	fireEvent.click(screen.getByText("YouTube"));
	expect(screen.getByText("Descripción YouTube")).toBeTruthy();
	expect(screen.queryByText("Idea original")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Sugerir cambios" }));
	expect(screen.getByText("Idea original")).toBeTruthy();
});

it("keeps the actual failure visible and allows suggestions when there is no draft", async () => {
	const draft: api.PromoSession = {
		session_id: "failed",
		template_id: "promo-trendy",
		state: "failed",
		stage: null,
		revision: 1,
		draft_id: null,
		messages: [],
		error: "Faltan medios para preparar",
		usage: null,
		quality: null,
	};
	vi.mocked(api.getPromoSession).mockResolvedValue(draft);
	const studio = {
		clearPrototypePreview: vi.fn(),
		template: { id: "promo-trendy" },
		prototypes: [],
		promoSessions: { data: { sessions: [draft] } },
	} as unknown as TemplateStudioController;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<PromoSandbox studio={studio} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByText("No se pudo preparar"));
	expect(await screen.findByText("Faltan medios para preparar")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Sugerir cambios" }));
	expect(screen.getByLabelText("Correcciones")).toBeTruthy();
});

it("syncs the preview once to the selected session and clears it for a session without a draft", async () => {
 const one: api.PromoSession = { session_id: "one", template_id: "promo-trendy", state: "review", stage: null, revision: 1, draft_id: "d1", messages: [], error: null, usage: null, quality: {passed: true} };
 const two: api.PromoSession = { ...one, session_id: "two", draft_id: null, state: "failed", error: "No hay contenido", messages: [{id: "m", role: "user", content: "Arrecifes vivos https://example.org/fuente", created_at: ""}] };
 vi.mocked(api.getPromoSession).mockImplementation(async (id) => id === "one" ? one : two);
 vi.mocked(api.getPromoContent).mockImplementation(async (id) => ({session_id: id, revision: 1, draft_id: id === "one" ? "d1" : null, can_retry_preparation: false} as api.PromoContent));
 const studio = { template: {id: "promo-trendy"}, prototypes: [{draftId: "d1", name: "Primero", previewUrl: "/one"}], promoSessions: {data: {sessions: [one, two]}}, previewPrototype: vi.fn(), clearPrototypePreview: vi.fn() } as unknown as TemplateStudioController;
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
 render(<QueryClientProvider client={client}><PromoSandbox studio={studio} /></QueryClientProvider>);
 fireEvent.click(screen.getByText("En revisión"));
 await waitFor(() => expect(studio.previewPrototype).toHaveBeenCalledWith("d1"));
 client.setQueryData(api.promoSessionKey("one"), {...one});
 await screen.findByRole("button", {name: "Sugerir cambios"});
 expect(studio.previewPrototype).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button", {name: /Prototipos/}));
 expect(screen.getByText("Arrecifes vivos")).toBeTruthy();
 expect(screen.queryByText(/example.org/)).toBeNull();
 fireEvent.click(screen.getByText("No se pudo preparar"));
 await screen.findByText("No hay contenido");
 expect(studio.clearPrototypePreview).toHaveBeenCalled();
 expect(screen.queryByRole("button", {name: "Reintentar preparación"})).toBeNull();
});


it("does not load thumbnails without a manifest or while content is pending", async () => {
 const session: api.PromoSession = {session_id: "pending-thumbs", template_id: "promo-trendy", state: "review", stage: null, revision: 1, draft_id: "d", messages: [], error: null, usage: null, quality: null};
 const base = {session_id: session.session_id, revision: 1, draft_id: "d", title: null, copies: null, brief: null, guion: null, media: null, music: null, availability: {draft: "available", brief: "missing", guion: "missing", media: "missing", music: "missing"}} as api.PromoContent;
 vi.mocked(api.getPromoContent).mockResolvedValue(base);
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
 const {rerender} = render(<QueryClientProvider client={client}><PromoReview session={session} /></QueryClientProvider>);
 await screen.findByText("Miniaturas no disponibles.");
 expect(screen.queryByRole("img")).toBeNull();
 client.setQueryData(["promo-content", session.session_id, 1, "d"], {...base, availability: {...base.availability, draft: "pending"}});
 rerender(<QueryClientProvider client={client}><PromoReview session={session} draft={{draftId: "d", thumbnails: {fingerprint: "x", selected: "A", urls: {A: "/a", B: "/b"}}} as unknown as Draft} /></QueryClientProvider>);
 await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
});

it("previews both thumbnail manifests before any JPEG has been captured", async () => {
 const session: api.PromoSession = {session_id: "manifest-thumbs", template_id: "promo-breaking", state: "review", stage: null, revision: 1, draft_id: "d", messages: [], error: null, usage: null, quality: null};
 vi.mocked(api.getPromoContent).mockResolvedValue({session_id: session.session_id, revision: 1, draft_id: "d", title: null, copies: null, brief: null, guion: null, media: null, music: null, availability: {draft: "available", brief: "missing", guion: "missing", media: "missing", music: "missing"}} as api.PromoContent);
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
 const draft = {draftId: "d", thumbnails: {fingerprint: "x", selected: "B", urls: {}, options: {A: {text: "VIVIR CUESTA", design: {}}, B: {text: "EL PRECIO", design: {}}}}} as unknown as Draft;
 render(<QueryClientProvider client={client}><PromoReview session={session} draft={draft} /></QueryClientProvider>);
 expect(await screen.findByRole("img", {name: "A · VIVIR CUESTA"})).toBeTruthy();
 expect(screen.getByRole("img", {name: "B · EL PRECIO"})).toBeTruthy();
 expect(screen.getByText("Opción B · Seleccionada · EL PRECIO")).toBeTruthy();
 expect(document.querySelector('img[src*="/thumbnails/"]')).toBeNull();
});

it("shows the real visual resources and soundtrack in the current promo review", async () => {
 const session: api.PromoSession = {session_id: "review-assets", template_id: "promo-mono", state: "review", stage: null, revision: 3, draft_id: "draft-assets", messages: [], error: null, usage: null, quality: null};
 vi.mocked(api.getPromoContent).mockResolvedValue({
  session_id: session.session_id, revision: 3, draft_id: "draft-assets", can_retry_preparation: false,
  media_basis: "resolved_plan", title: "Campaña real", copies: {},
  brief: {topic: "Tema", audience: "Público", tone: "energético", language: "es", duration_seconds: 56},
  guion: {segments: [{n: 1, scene: "footage", lines: ["AREQUIPA"]}]},
  media: [{id: "clip-1", name: "Video real", type: "video", source: "Wikimedia", author: "Autora", license: "CC BY", scene_uses: [{scene: 1, slot: "clip-01"}]},
   {id: "photo-1", name: "Foto real", type: "image", source: "Wikimedia", author: "Autor", license: "CC0"}],
  music: {id: "track-1", name: "Pista real", type: "music", source: "Biblioteca", author: "Compositora", license: "CC BY"},
  availability: {draft: "available", brief: "available", guion: "available", media: "available", music: "available"},
 });
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
 render(<QueryClientProvider client={client}><PromoReview session={session} /></QueryClientProvider>);
 const video = await screen.findByLabelText("Video del recurso: Video real") as HTMLVideoElement;
 expect(video.getAttribute("src")).toContain("/api/v1/library/videos/clip-1/file");
 expect(screen.getByRole("img", {name: "Imagen del recurso: Foto real"})).toBeTruthy();
 expect(screen.getByText("Escena 1 · footage · clip-01")).toBeTruthy();
 const audio = screen.getByLabelText("Audio: Pista real") as HTMLAudioElement;
 expect(audio.getAttribute("src")).toContain("/api/v1/library/music/track-1/file");
 expect(screen.getByRole("note").textContent).toContain("Sugerir cambios");
});

it("exposes all nine promo designs including Mono", () => {
 expect(api.PROMO_IDS.size).toBe(9);
 expect(api.PROMO_IDS.has("promo-mono")).toBe(true);
});

it("replaces a visual at its shared scene slot through a new review revision", async () => {
	const session: api.PromoSession = {
		session_id: "replace-session",
		template_id: "promo-editorial",
		state: "review",
		stage: "review",
		revision: 3,
		draft_id: "draft-3",
		messages: [],
		error: null,
		usage: null,
		quality: { passed: true },
	};
	const updated: api.PromoSession = {
		...session,
		state: "queued",
		stage: "queued",
		revision: 4,
		draft_id: null,
		quality: { passed: false },
	};
	vi.mocked(api.getPromoContent).mockResolvedValue({
		session_id: session.session_id,
		revision: session.revision,
		draft_id: session.draft_id,
		can_retry_preparation: false,
		media_basis: "resolved_plan",
		brief: null,
		title: "Demo",
		copies: {},
		guion: { segments: [{ n: 1, scene: "footage", lines: ["Texto"] }, { n: 3, scene: "detail", lines: ["Otro"] }] },
		media: [{
			id: "current-asset",
			name: "Video actual",
			type: "video",
			source: "Wikimedia",
			author: "Autora",
			license: "CC BY",
			scene_uses: [{ scene: 1, slot: "clip-01" }, { scene: 3, slot: "clip-01" }],
		}],
		music: null,
		availability: { draft: "available", brief: "missing", guion: "available", media: "available", music: "missing" },
	});
	vi.mocked(api.replacePromoMedia).mockResolvedValue(updated);
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(<QueryClientProvider client={client}><PromoReview session={session} /></QueryClientProvider>);

	fireEvent.click(await screen.findByRole("button", { name: "Reemplazar en clip-01" }));
	const picker = screen.getByRole("button", { name: "Elegir recurso video" });
	expect(picker.getAttribute("data-kind")).toBe("video");
	fireEvent.click(picker);
	await waitFor(() => expect(api.replacePromoMedia).toHaveBeenCalledWith(
		session.session_id,
		{ revision: 3, scene: 1, slot: "clip-01", asset_id: "replacement-2" },
	));
	expect(client.getQueryData(api.promoSessionKey(session.session_id))).toEqual(updated);
});
