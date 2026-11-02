import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
}));
vi.mock("@/features/channels/api/channels-service", () => ({
  getChannels: vi.fn(),
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
function mount(value = empty, format: ImagePostFormat = "4:5") {
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

async function prepare(format: ImagePostFormat = "4:5") {
  const button = await screen.findByRole("button", {
    name: `Preparar JPEG en ${format}`,
  });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  await screen.findByText("JPEG final preparado para esta revisión.");
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
  vi.mocked(api.setImagePostFormat).mockImplementation(async (_id, _revision, format) => {
    latest = { ...latest, format, revision: latest.revision + 1 };
    current = { ...current, format, revision: latest.revision };
    return latest;
  });
  vi.mocked(api.reviewImagePost).mockImplementation(async () => ({
    ...latest,
    status: "approved",
  }));
  vi.mocked(api.scheduleImagePost).mockImplementation(
    async (_id, _revision, targets) =>
      targets.map((target) => delivery(target.platform, "queued")) as never,
  );
  vi.mocked(api.publishImageNow).mockImplementation(
    async (id) => delivery(id.includes("instagram") ? "instagram" : "facebook") as never,
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
  it("no indica Publicando durante la preparación pendiente del JPEG", async () => {
    let finishPreparation!: (post: ImagePost) => void;
    vi.mocked(api.setImagePostFormat).mockImplementationOnce(
      () =>
        new Promise<ImagePost>((resolve) => {
          finishPreparation = resolve;
        }),
    );
    mount(empty, "9:16");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }));
    const prepareButton = await screen.findByRole("button", { name: "Preparar JPEG en 9:16" });
    await waitFor(() => expect((prepareButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(prepareButton);
    await screen.findByRole("button", { name: "Preparando JPEG…" });
    expect(screen.queryByRole("button", { name: "Publicando…" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Aprobar y publicar en 1 canal" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(api.reviewImagePost).not.toHaveBeenCalled();
    expect(api.scheduleImagePost).not.toHaveBeenCalled();
    expect(api.publishImageNow).not.toHaveBeenCalled();
    await waitFor(() => expect(finishPreparation).toBeTypeOf("function"));
    finishPreparation({ ...fresh, format: "9:16" });
    await screen.findByRole("button", { name: "Actualizar JPEG final" });
  });

  it("solo ofrece cuentas autorizadas y explica la disponibilidad real de TikTok", async () => {
    mount();
    const instagram = await screen.findByRole("checkbox", {
      name: "Instagram · NodeTech",
    });
    expect((instagram as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole("checkbox", { name: "Facebook · NodeTech" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText(/La conexión actual de TikTok admite videos/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /Aprobar y publicar/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.publishImageNow).not.toHaveBeenCalled();
  });

  it("aprueba la revisión vigente y publica únicamente en los destinos elegidos", async () => {
    mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Facebook · NodeTech" }));
    const button = screen.getByRole("button", {
      name: "Aprobar y publicar en 2 canales",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await prepare();
    expect(api.reviewImagePost).not.toHaveBeenCalled();
    expect(api.publishImageNow).not.toHaveBeenCalled();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText("Publicado correctamente en 2 canales.");
    expect(api.setImagePostFormat).toHaveBeenCalledExactlyOnceWith("img_publish", 7, "4:5");
    expect(api.reviewImagePost).toHaveBeenCalledExactlyOnceWith("img_publish", 8, "approve");
    expect(api.scheduleImagePost).toHaveBeenCalledExactlyOnceWith("img_publish", 8, [
      {
        platform: "instagram",
        account_alias: "ig_tech",
        placement: "carousel",
      },
      {
        platform: "facebook",
        account_alias: "fb_tech",
        placement: "carousel",
      },
    ]);
    expect(api.publishImageNow).toHaveBeenCalledTimes(2);
  });

  it("muestra los envíos aceptados por la cola sin afirmar que ya están publicados", async () => {
    vi.mocked(api.publishImageNow).mockImplementation(
      async (id) =>
        delivery(id.includes("instagram") ? "instagram" : "facebook", "queued") as never,
    );
    mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }));
    const button = screen.getByRole("button", {
      name: "Aprobar y publicar en 1 canal",
    });
    await prepare();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await screen.findByText(/Envío iniciado en 1 canal/);
    expect(screen.queryByText(/Publicado correctamente/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("no vuelve a enviar un destino que ya se publicó después de abrir el panel", async () => {
    mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }));
    const button = screen.getByRole("button", {
      name: "Aprobar y publicar en 1 canal",
    });
    await prepare();
    vi.mocked(api.getImagePost).mockResolvedValue({
      ...latest,
      deliveries: [delivery("instagram")],
    } as never);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await screen.findByText(/Los destinos seleccionados ya tienen un envío registrado/);
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
    expect(screen.getByRole("link", { name: "Ver publicación" }).getAttribute("href")).toBe(
      "https://example.com/instagram",
    );
    expect(screen.getByText(new Intl.NumberFormat("es").format(11000))).toBeTruthy();
    const likes = screen.getByText("Me gusta").parentElement;
    expect(likes?.textContent).toBe("Me gusta0");
    expect(screen.getByText("Alcance").parentElement?.textContent).toBe("Alcance—");
    expect(screen.getByText(/Publicado el/).textContent).toContain("6:00");
    expect(
      (
        (await screen.findByRole("checkbox", {
          name: "Instagram · NodeTech",
        })) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Ventana de métricas" }), {
      target: { value: "7d" },
    });
    expect(screen.getByText(/La red todavía no ha entregado métricas/)).toBeTruthy();
    expect(api.publishImageNow).not.toHaveBeenCalled();
  });

  it("informa resultados parciales sin presentar como éxito el canal que falló", async () => {
    vi.mocked(api.publishImageNow).mockImplementation(async (id) => {
      if (id === "del_instagram") throw new Error("Permiso revocado");
      return delivery("facebook") as never;
    });
    mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Instagram · NodeTech" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Facebook · NodeTech" }));
    const button = screen.getByRole("button", {
      name: "Aprobar y publicar en 2 canales",
    });
    await prepare();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
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
    fireEvent.click(screen.getByRole("button", { name: "Ver 4:5 para Instagram" }));
    expect(onFormatChange).toHaveBeenCalledExactlyOnceWith("4:5");
    expect(api.publishImageNow).not.toHaveBeenCalled();
  });

  it("exige preparar otra vez si cambia el formato después de revisar el JPEG", async () => {
    const view = mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Facebook · NodeTech" }));
    await prepare();
    view.rerenderFormat("9:16");
    const button = screen.getByRole("button", {
      name: "Aprobar y publicar en 1 canal",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(api.reviewImagePost).not.toHaveBeenCalled();
    expect(api.publishImageNow).not.toHaveBeenCalled();
    expect(api.setImagePostFormat).toHaveBeenCalledTimes(1);
  });
});
