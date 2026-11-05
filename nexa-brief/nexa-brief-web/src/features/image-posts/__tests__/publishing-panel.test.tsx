import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChannels } from "@/features/channels/api/channels-service";
import messages from "../../../../messages/es.json";
import { ImagePostPublishingPanel } from "../components/ImagePostPublishingPanel";
import * as api from "../image-posts-service";
import type {
	ImagePost,
	ImagePostFormat,
	PublicationDeliveryDetail,
	PublicationDetail,
} from "../types";

vi.mock("../image-posts-service", () => ({
	getImageCapabilities: vi.fn(),
	getImagePost: vi.fn(),
	getImagePostDetail: vi.fn(),
	getPublicationDetail: vi.fn(),
	publishImageNow: vi.fn(),
	reconcileImagePostDelivery: vi.fn(),
	reviewImagePost: vi.fn(),
	scheduleImagePost: vi.fn(),
	setImagePostFormat: vi.fn(),
	prepareImagePostVariant: vi.fn(),
}));
vi.mock("@/features/channels/api/channels-service", () => ({
	getChannels: vi.fn(),
	buildConnectChannelUrl: (platform: string, alias: string) =>
		`/api/v1/publish/auth/${platform}/start?alias=${alias}`,
}));
vi.mock("@/features/channels", () => ({
	PlatformIcon: () => <span aria-hidden />,
}));

const accounts = [
	{
		platform: "instagram" as const,
		alias: "ig_tech",
		name: "NodeTech",
		canPublish: true,
		canComment: false,
		canInsights: true,
		igAccountSubtype: null,
	},
	{
		platform: "facebook" as const,
		alias: "fb_tech",
		name: "NodeTech",
		canPublish: true,
		canComment: false,
		canInsights: true,
		igAccountSubtype: null,
	},
];
const empty: PublicationDetail = {
	postId: "img_publish",
	revision: 7,
	publicationId: "pub_publish",
	categoryId: "node_tech",
	categoryName: "NodeTech",
	topic: "Tecnología",
	title: "Historia verificada",
	format: "4:5",
	kind: "carousel",
	templateId: "five_slides",
	strategyId: "amarillista",
	status: "ready_for_review",
	createdAt: "2026-11-01T00:00:00Z",
	latestPublishedAt: null,
	coverAssetId: "a1",
	coverUrl: "/clean.jpg",
	slides: [
		{
			slideId: "s1",
			order: 1,
			assetId: "a1",
			roleTag: "Portada",
			previewUrl: "/clean.jpg",
			altTextFacebook: "Contexto",
			altTextInstagram: "Contexto",
		},
	],
	deliveries: [],
	sourceVideoId: "video",
	sourceVideoUrl: null,
	sources: [],
	copy: {
		facebook: { caption: "Texto verificado", firstComment: "" },
		instagram: { caption: "Texto verificado", firstComment: "" },
		hashtags: [],
	},
	technical: {
		renderSeconds: 2,
		rendererVersion: "1",
		planHash: "hash",
		styleId: "rough",
		styleVersion: "1",
		validations: [{ name: "qc", passed: true }],
		slides: [],
		music: { mode: "none" },
		aiUsage: [],
		copySources: {},
		reel: null,
	},
	metricsSnapshots: [],
	reviewRequired: true,
};
const fresh = {
	postId: "img_publish",
	revision: 7,
	kind: "carousel",
	status: "ready_for_review",
	deliveries: [],
	format: "4:5",
	slides: empty.slides,
} as unknown as ImagePost;
const delivery = (
	platform: "instagram" | "facebook",
	status: PublicationDeliveryDetail["status"] = "published",
): PublicationDeliveryDetail => ({
	deliveryId: `del_${platform}`,
	platform,
	accountAlias: platform === "instagram" ? "ig_tech" : "fb_tech",
	placement: "carousel",
	status,
	publishedAt: status === "published" ? "2026-11-01T10:00:00Z" : null,
	permalink: status === "published" ? `https://example.com/${platform}` : null,
	metricValue: null,
	metricName: null,
	window: null,
	scheduledAt: null,
	timezone: "America/La_Paz",
	lastError: null,
	remote: {
		photoIds: [],
		childContainerIds: [],
		parentContainerId: null,
		postId: "remote",
		permalink: null,
		commentId: null,
	},
	targetId: null,
	removedAt: null,
	removalReason: null,
	removalInstruction: null,
	removalGraphResponse: null,
});
const clients: QueryClient[] = [];
let current = empty;
let latest = fresh;
const onFormatChange = vi.fn();
function mount(
	value = empty,
	format: ImagePostFormat = "4:5",
	defaultSelectAll = false,
) {
	current = value;
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	clients.push(client);
	const tree = (selectedFormat: ImagePostFormat) => (
		<QueryClientProvider client={client}>
			<NextIntlClientProvider locale="es" messages={messages}>
				<ImagePostPublishingPanel
					publication={value}
					format={selectedFormat}
					defaultSelectAll={defaultSelectAll}
					onFormatChange={onFormatChange}
				/>
			</NextIntlClientProvider>
		</QueryClientProvider>
	);
	const result = render(tree(format));
	return {
		rerenderFormat: (next: ImagePostFormat) => result.rerender(tree(next)),
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	current = empty;
	latest = fresh;
	vi.mocked(api.getImageCapabilities).mockResolvedValue({
		accounts,
		reviewRequired: true,
	});
	vi.mocked(api.getImagePostDetail).mockImplementation(async () => current);
	vi.mocked(api.getImagePost).mockImplementation(async () => latest);
	vi.mocked(api.setImagePostFormat).mockImplementation(
		async (_id, _revision, format) => {
			latest = { ...latest, format, revision: latest.revision + 1 };
			current = { ...current, format, revision: latest.revision };
			return latest;
		},
	);
	vi.mocked(api.prepareImagePostVariant).mockImplementation(async () => latest);
	vi.mocked(api.reviewImagePost).mockImplementation(async () => ({
		...latest,
		status: "approved",
	}));
	vi.mocked(api.scheduleImagePost).mockImplementation(
		async (_id, _revision, targets) =>
			targets.map((target) => delivery(target.platform, "queued")) as never,
	);
	vi.mocked(api.publishImageNow).mockImplementation(
		async (id) =>
			delivery(id.includes("instagram") ? "instagram" : "facebook") as never,
	);
	vi.mocked(getChannels).mockResolvedValue([
		{ platform: "tiktok", alias: "tt_tech", name: "nodetech", mode: "service" },
	] as never);
});
afterEach(() => {
	cleanup();
	for (const client of clients.splice(0)) client.clear();
});

describe("publicar imágenes desde el sidebar", () => {
	it("prepara y publica con un único clic, con progreso y sin duplicar envíos", async () => {
		let finishPreparation!: (post: ImagePost) => void;
		vi.mocked(api.setImagePostFormat).mockImplementationOnce(
			() =>
				new Promise<ImagePost>((resolve) => {
					finishPreparation = resolve;
				}),
		);
		mount(empty, "9:16");
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		expect(screen.queryByRole("button", { name: /Preparar JPEG/ })).toBeNull();
		fireEvent.click(button);
		fireEvent.click(button);
		const progress = await screen.findByRole("progressbar", {
			name: "Progreso de publicación",
		});
		expect(progress.getAttribute("aria-valuenow")).toBeNull();
		expect(progress.getAttribute("aria-valuetext")).toBe(
			"Preparando imágenes…",
		);
		expect(screen.queryByText("Publicar en")).toBeNull();
		expect(
			screen.queryByRole("checkbox", { name: "Seleccionar todas" }),
		).toBeNull();

		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
		latest = { ...fresh, format: "9:16", revision: 8 };
		current = { ...empty, format: "9:16", revision: 8 };
		finishPreparation(latest);
		await screen.findByText("Publicado correctamente en 1 canal.");
		expect(api.setImagePostFormat).toHaveBeenCalledTimes(1);
		expect(api.reviewImagePost).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			8,
			"approve",
		);
		expect(api.publishImageNow).toHaveBeenCalledTimes(1);
	});

	it("solo ofrece cuentas autorizadas y explica la disponibilidad real de TikTok", async () => {
		mount();
		const instagram = await screen.findByRole("checkbox", {
			name: "Instagram · NodeTech",
		});
		expect((instagram as HTMLInputElement).disabled).toBe(false);
		expect(
			screen.getByRole("checkbox", { name: "Facebook · NodeTech" }),
		).toBeTruthy();
		expect(screen.getAllByRole("checkbox")).toHaveLength(3);
		expect(
			screen.getByText(/La conexión actual de TikTok admite videos/),
		).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: /Aprobar y publicar/,
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("selecciona y desmarca todas, reflejando la selección parcial", async () => {
		mount();
		const selectAll = (await screen.findByRole("checkbox", {
			name: "Seleccionar todas",
		})) as HTMLInputElement;
		await waitFor(() => expect(selectAll.disabled).toBe(false));
		const instagram = screen.getByRole("checkbox", {
			name: "Instagram · NodeTech",
		}) as HTMLInputElement;
		const facebook = screen.getByRole("checkbox", {
			name: "Facebook · NodeTech",
		}) as HTMLInputElement;
		fireEvent.click(selectAll);
		expect(instagram.checked).toBe(true);
		expect(facebook.checked).toBe(true);
		expect(selectAll.checked).toBe(true);
		fireEvent.click(instagram);
		expect(selectAll.checked).toBe(false);
		expect(selectAll.indeterminate).toBe(true);
		fireEvent.click(selectAll);
		expect(instagram.checked).toBe(true);
		expect(selectAll.checked).toBe(true);
		fireEvent.click(selectAll);
		expect(instagram.checked).toBe(false);
		expect(facebook.checked).toBe(false);
		expect(selectAll.indeterminate).toBe(false);
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("selecciona solo los destinos compatibles que pueden recibir un envío", async () => {
		vi.mocked(api.getImageCapabilities).mockResolvedValue({
			accounts: [
				...accounts,
				{
					...accounts[1],
					alias: "sin_permiso",
					name: "Sin permiso",
					canPublish: false,
				},
				{ ...accounts[1], alias: "ya_publicada", name: "Ya publicada" },
			],
			reviewRequired: true,
		});
		mount(
			{
				...empty,
				deliveries: [{ ...delivery("facebook"), accountAlias: "ya_publicada" }],
			},
			"9:16",
		);
		const selectAll = (await screen.findByRole("checkbox", {
			name: "Seleccionar todas",
		})) as HTMLInputElement;
		await waitFor(() => expect(selectAll.disabled).toBe(false));
		fireEvent.click(selectAll);
		expect(
			(
				screen.getByRole("checkbox", {
					name: "Facebook · NodeTech",
				}) as HTMLInputElement
			).checked,
		).toBe(true);
		for (const name of [
			"Instagram · NodeTech",
			"Facebook · Sin permiso",
			"Facebook · Ya publicada",
		]) {
			const account = screen.getByRole("checkbox", {
				name,
			}) as HTMLInputElement;
			expect(account.disabled).toBe(true);
			expect(account.checked).toBe(false);
		}
		expect(selectAll.checked).toBe(true);
		expect(
			screen.getByRole("button", { name: "Aprobar y publicar en 1 canal" }),
		).toBeTruthy();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
	});

	it("aprueba la revisión vigente y publica únicamente en los destinos elegidos", async () => {
		mount();
		const selectAll = await screen.findByRole("checkbox", {
			name: "Seleccionar todas",
		});
		await waitFor(() =>
			expect((selectAll as HTMLInputElement).disabled).toBe(false),
		);
		fireEvent.click(selectAll);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 2 canales",
		});
		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		fireEvent.click(button);
		await screen.findByText("Publicado correctamente en 2 canales.");
		expect(api.setImagePostFormat).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			7,
			"4:5",
		);
		expect(api.reviewImagePost).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			8,
			"approve",
		);
		expect(api.scheduleImagePost).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			8,
			[
				{
					platform: "instagram",
					account_alias: "ig_tech",
					placement: "carousel",
					format: "4:5",
				},
				{
					platform: "facebook",
					account_alias: "fb_tech",
					placement: "carousel",
					format: "4:5",
				},
			],
		);
		expect(api.publishImageNow).toHaveBeenCalledTimes(2);
	});

	it("muestra los envíos aceptados por la cola sin afirmar que ya están publicados", async () => {
		vi.mocked(api.publishImageNow).mockImplementation(
			async (id) =>
				delivery(
					id.includes("instagram") ? "instagram" : "facebook",
					"queued",
				) as never,
		);
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText(/Envío iniciado en 1 canal/);
		expect(screen.queryByText(/Publicado correctamente/)).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("no vuelve a enviar un destino que ya se publicó después de abrir el panel", async () => {
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		vi.mocked(api.getImagePost).mockResolvedValue({
			...latest,
			deliveries: [delivery("instagram")],
		} as never);
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText(
			/Los destinos seleccionados ya tienen un envío registrado/,
		);
		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("muestra fecha y cifras reales por canal y diferencia cero de dato ausente", async () => {
		const value: PublicationDetail = {
			...empty,
			status: "completed",
			deliveries: [delivery("instagram")],
			metricsSnapshots: [
				{
					snapshotId: "m1",
					deliveryId: "del_instagram",
					window: "48h",
					observedAt: "2026-11-01T12:00:00Z",
					status: "ok",
					metrics: {
						impressions: 11000,
						likes: 0,
						comments: 5,
						reach: null,
						shares: 2,
					},
				},
			],
		};
		mount(value);
		await screen.findByRole("link", { name: "Ver publicación" });
		expect(
			screen
				.getByRole("link", { name: "Ver publicación" })
				.getAttribute("href"),
		).toBe("https://example.com/instagram");
		expect(
			screen.getByText(new Intl.NumberFormat("es").format(11000)),
		).toBeTruthy();
		const likes = screen.getByText("Me gusta").parentElement;
		expect(likes?.textContent).toBe("Me gusta0");
		expect(screen.getByText("Alcance").parentElement?.textContent).toBe(
			"Alcance—",
		);
		expect(screen.getByText(/Publicado el/).textContent).toContain("6:00");
		expect(screen.queryByText("Publicar en")).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);

		fireEvent.change(
			screen.getByRole("combobox", { name: "Ventana de métricas" }),
			{
				target: { value: "7d" },
			},
		);
		expect(
			screen.getByText(/La red todavía no ha entregado métricas/),
		).toBeTruthy();
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("informa resultados parciales sin presentar como éxito el canal que falló", async () => {
		vi.mocked(api.publishImageNow).mockImplementation(async (id) => {
			if (id === "del_instagram") throw new Error("Permiso revocado");
			return delivery("facebook") as never;
		});
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 2 canales",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText("Publicado correctamente en 1 canal.");
		expect(screen.getByRole("alert").textContent).toContain(
			"Instagram · ig_tech: Permiso revocado",
		);
		expect(api.publishImageNow).toHaveBeenCalledTimes(2);
	});

	it("bloquea Instagram en 9:16 y permite pedir su composición 4:5", async () => {
		mount(empty, "9:16");
		const instagram = await screen.findByRole("checkbox", {
			name: "Instagram · NodeTech",
		});
		expect((instagram as HTMLInputElement).disabled).toBe(true);
		expect(
			(
				screen.getByRole("checkbox", {
					name: "Facebook · NodeTech",
				}) as HTMLInputElement
			).disabled,
		).toBe(false);
		fireEvent.click(
			screen.getByRole("button", { name: "Ver 4:5 para Instagram" }),
		);
		expect(onFormatChange).toHaveBeenCalledExactlyOnceWith("4:5");
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("prepara automáticamente el último formato elegido en el modal", async () => {
		const view = mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		view.rerenderFormat("9:16");
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText("Publicado correctamente en 1 canal.");
		expect(api.setImagePostFormat).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			7,
			"9:16",
		);
		expect(vi.mocked(api.scheduleImagePost).mock.calls[0][2][0].format).toBe(
			"9:16",
		);
	});

	it("no aprueba ni envía si falla la preparación de las imágenes", async () => {
		vi.mocked(api.setImagePostFormat).mockRejectedValueOnce(
			new Error("La imagen no pudo prepararse"),
		);
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText("La imagen no pudo prepararse");
		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				(
					screen.getByRole("button", {
						name: "Aprobar y publicar en 1 canal",
					}) as HTMLButtonElement
				).disabled,
			).toBe(false),
		);
	});

	it("no aprueba una revisión cambiada por otra sesión mientras prepara", async () => {
		vi.mocked(api.getImagePost).mockImplementation(async () =>
			vi.mocked(api.setImagePostFormat).mock.calls.length
				? { ...latest, revision: latest.revision + 1 }
				: latest,
		);
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText(/El post cambió en otra sesión/);
		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});
});

describe("publicación con permisos reales", () => {
	it("selecciona disponibles al abrir y ofrece reconectar el destino sin permiso", async () => {
		vi.mocked(api.getImageCapabilities).mockResolvedValue({
			accounts: [
				{ ...accounts[0], canComment: true },
				{
					...accounts[1],
					canPublish: false,
					publishBlockReason: "ATTRIBUTION_COMMENT_REQUIRED",
				},
			],
			reviewRequired: true,
		});
		mount(empty, "4:5", true);
		const instagram = (await screen.findByRole("checkbox", {
			name: "Instagram · NodeTech",
		})) as HTMLInputElement;
		await waitFor(() => expect(instagram.checked).toBe(true));
		const facebook = screen.getByRole("checkbox", {
			name: "Facebook · NodeTech",
		}) as HTMLInputElement;
		expect(facebook.disabled).toBe(true);
		expect(facebook.checked).toBe(false);
		expect(
			screen
				.getByRole("link", { name: "Reconectar y autorizar" })
				.getAttribute("href"),
		).toContain("/auth/facebook/start?alias=fb_tech");
		fireEvent.click(instagram);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Actualizar estado y métricas disponibles",
			}),
		);
		await waitFor(() =>
			expect(
				vi.mocked(api.getImageCapabilities).mock.calls.length,
			).toBeGreaterThanOrEqual(2),
		);
		expect(instagram.checked).toBe(false);
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});
});

describe("formatos por cuenta", () => {
	it("hereda el modal y prepara JPEG distintos para Instagram y Facebook", async () => {
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Formato de Facebook · NodeTech" }),
		);
		const selector = screen.getByRole("combobox", {
			name: "Formato de Facebook · NodeTech",
		});
		expect((selector as HTMLSelectElement).value).toBe("modal");
		fireEvent.change(selector, { target: { value: "9:16" } });
		vi.mocked(api.prepareImagePostVariant).mockImplementation(
			async (_id, revision) => ({ ...latest, revision }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Aprobar y publicar en 2 canales" }),
		);
		await screen.findByText("Publicado correctamente en 2 canales.");
		expect(api.prepareImagePostVariant).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			8,
			"9:16",
		);
		expect(vi.mocked(api.scheduleImagePost).mock.calls[0][2]).toEqual([
			{
				platform: "instagram",
				account_alias: "ig_tech",
				placement: "carousel",
				format: "4:5",
			},
			{
				platform: "facebook",
				account_alias: "fb_tech",
				placement: "carousel",
				format: "9:16",
			},
		]);
	});

	it("prepara automáticamente el formato particular de una cuenta", async () => {
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Formato de Facebook · NodeTech" }),
		);
		fireEvent.change(
			screen.getByRole("combobox", { name: "Formato de Facebook · NodeTech" }),
			{ target: { value: "3:5" } },
		);
		expect(api.setImagePostFormat).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 1 canal",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText("Publicado correctamente en 1 canal.");
		expect(api.prepareImagePostVariant).toHaveBeenCalledExactlyOnceWith(
			"img_publish",
			8,
			"3:5",
		);
		expect(vi.mocked(api.scheduleImagePost).mock.calls[0][2][0].format).toBe(
			"3:5",
		);
	});

	it("no envía ningún canal si falla la preparación de una variante", async () => {
		vi.mocked(api.prepareImagePostVariant).mockRejectedValueOnce(
			new Error("Falló la composición vertical"),
		);
		mount();
		fireEvent.click(
			await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("checkbox", { name: "Facebook · NodeTech" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Formato de Facebook · NodeTech" }),
		);
		fireEvent.change(
			screen.getByRole("combobox", { name: "Formato de Facebook · NodeTech" }),
			{ target: { value: "9:16" } },
		);
		const button = screen.getByRole("button", {
			name: "Aprobar y publicar en 2 canales",
		});
		await waitFor(() =>
			expect((button as HTMLButtonElement).disabled).toBe(false),
		);
		fireEvent.click(button);
		await screen.findByText("Falló la composición vertical");
		expect(api.reviewImagePost).not.toHaveBeenCalled();
		expect(api.scheduleImagePost).not.toHaveBeenCalled();
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});
});

describe("progreso y resultados sin repetir el formulario", () => {
	it("refleja el avance real al actualizarse los canales y oculta los destinos durante el envío", async () => {
		mount({
			...empty,
			status: "approved",
			deliveries: [
				delivery("instagram", "publishing"),
				delivery("facebook", "queued"),
			],
		});
		await waitFor(() => expect(api.getImagePostDetail).toHaveBeenCalled());
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"0",
		);
		expect(screen.getByText("0 de 2 canales completados")).toBeTruthy();
		expect(screen.queryByText("Publicar en")).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
		current = {
			...current,
			deliveries: [delivery("instagram"), delivery("facebook", "publishing")],
		};
		await waitFor(() =>
			expect(
				(
					screen.getByRole("button", {
						name: "Actualizar estado y métricas disponibles",
					}) as HTMLButtonElement
				).disabled,
			).toBe(false),
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Actualizar estado y métricas disponibles",
			}),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("progressbar").getAttribute("aria-valuenow"),
			).toBe("50"),
		);
		expect(screen.getByText("1 de 2 canales completados")).toBeTruthy();
		current = {
			...current,
			status: "completed",
			deliveries: [delivery("instagram"), delivery("facebook")],
		};
		await waitFor(() =>
			expect(
				(
					screen.getByRole("button", {
						name: "Actualizar estado y métricas disponibles",
					}) as HTMLButtonElement
				).disabled,
			).toBe(false),
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Actualizar estado y métricas disponibles",
			}),
		);
		await screen.findByText("Publicación completada");
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);
		expect(screen.queryByText("Publicar en")).toBeNull();
		expect(
			screen.getAllByRole("link", { name: "Ver publicación" }),
		).toHaveLength(2);
		expect(api.publishImageNow).not.toHaveBeenCalled();
	});

	it("no presenta un resultado pendiente de revisión como terminado", async () => {
		mount({
			...empty,
			status: "partial",
			deliveries: [
				delivery("instagram"),
				delivery("facebook", "outcome_unknown"),
			],
		});
		await screen.findByRole("button", {
			name: messages.imagePosts.publishing.reconcile,
		});
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"50",
		);
		expect(screen.getByText("Pendiente de revisión")).toBeTruthy();
		expect(screen.queryByText("Publicación completada")).toBeNull();
		expect(screen.queryByText("Publicar en")).toBeNull();
	});

	it("distingue los errores del éxito al finalizar el procesamiento", async () => {
		mount({
			...empty,
			status: "partial",
			deliveries: [
				delivery("instagram"),
				{
					...delivery("facebook", "failed_permanent"),
					lastError: "Permiso revocado",
				},
			],
		});
		await screen.findByText("Permiso revocado");
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);
		expect(screen.getByText("Proceso terminado con errores")).toBeTruthy();
		expect(screen.queryByText("Publicación completada")).toBeNull();
	});
});
