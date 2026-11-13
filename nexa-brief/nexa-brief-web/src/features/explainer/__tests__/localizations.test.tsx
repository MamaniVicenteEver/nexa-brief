import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { ExplainerVideoCard } from "../components/ExplainerVideoCard";
import type { Localization } from "../hooks/useLocalizations";
import type { ExplainerVideo } from "../types";

vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (url: string) => url,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "es",
}));
vi.mock("@/features/showcase/hooks/useVisualStyles", () => ({ useVisualStyles: () => ({}) }));
vi.mock("@/shared/components/media/MediaPlayerModal", () => ({
  MediaPlayerModal: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leftControls: ReactNode;
    stageContent: ReactNode;
    sidebar: ReactNode;
    source: { url: string } | null;
    actions: ReactNode;
  }) => (
    <div>
      <button type="button" onClick={() => props.onOpenChange(!props.open)}>
        Abrir
      </button>
      {props.open && (
        <>
          {props.leftControls}
          {props.stageContent}
          <div data-testid="source">{props.source?.url}</div>
          {props.actions}
          {props.sidebar}
        </>
      )}
    </div>
  ),
}));
const video = {
  videoId: "video",
  title: "Original",
  previewUrl: "/original",
  posterUrl: "/poster",
  design: "rough",
  categoryName: "Categoría",
  rendered: [],
  qualityIssues: [],
  ready: true,
  youtubeTitle: "Original YouTube",
  youtubeDescription: "Descripción original",
  youtubeTags: [],
  facebookTitle: "",
  facebookDescription: "",
  tiktokCaption: "",
  tiktokHashtags: [],
  thumbnails: { options: [] },
} as unknown as ExplainerVideo;
const original = {
  locale: "es-419",
  label: "ES",
  name: "Español",
  status: "ready",
  is_original: true,
  preview_url: "/original",
  job_id: null,
};

const portugueseReady = {
  locale: "pt-BR",
  label: "PT",
  name: "Português",
  status: "needs_review",
  is_original: false,
  preview_url: "/portugues?edition=pt-BR&revision=rev-001",
  revision: "rev-001",
  job_id: "job-new",
  job_status: "completed",
  title: "Suas conversas no tribunal",
  publish: {
    youtube: {
      title: "Suas conversas no tribunal",
      description: "Descrição em português",
      pinned: "O que você pensa?",
    },
  },
  studio: {
    issues: [
      {
        level: "warning",
        field: "review",
        message: "Revisa el audio y los textos antes de aprobar la edición.",
      },
    ],
    ready: true,
    publish_ready: false,
    approval_token: "sha256:pt-ready",
    title_max_chars: 60,
    opening: null,
    duration_seconds: 274,
    capabilities: { record: true, publish: false },
    thumbnails: {
      chosen: "C",
      options: (["A", "B", "C"] as const).map((option) => ({
        option,
        component: `native.${option}`,
        params: { text: `PT ${option}` },
        url: `/pt-${option}.jpg`,
      })),
    },
    publish_package: {
      issues: [],
      title_max_chars: 60,
      thumbnail_image_url: "/pt-photo.jpg",
      thumbnail_tabloid_image_url: "/pt-photo.jpg",
      hook_strategy_names: { "1": "Curiosidade" },
      package: {
        thumbnail: {
          kicker: "",
          text_only: { lines: ["SUAS CONVERSAS"], highlight: "CONVERSAS", pair_title: "A" },
          with_image: { text: "AINDA SALVAS?", pair_title: "B", image_side: "auto" },
          tabloid: {
            text: "NO TRIBUNAL",
            image: null,
            image_side: "auto",
            mode: "impact",
            strap: "",
            seal: "",
            tape_text: "",
            marker: false,
            target: [0.72, 0.52],
            pair_title: "C",
          },
          chosen: "tabloid",
        },
        titles: {
          youtube: (["A", "B", "C"] as const).map((option) => ({
            option,
            text: `Título português ${option}`,
            strategy: 1,
            emotion: "curiosidade",
          })),
          chosen: "A",
        },
        pinned_comment: "O que você pensa?",
      },
    },
  },
} satisfies Localization;

function setup(status: string, supported = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(httpClient).mockImplementation(async (path, options) => {
    if (path.endsWith("/preflight"))
      return { ready: true, issues: [], next_action: "create", job_id: null } as never;
    if (options?.method === "POST")
      return { job_id: "job", locale: "pt-BR", status: "queued" } as never;
    if (path.includes("localization-jobs"))
      return {
        job_id: "job",
        video_id: "video",
        locale: "pt-BR",
        status,
        stage: "Traduciendo",
        percent: 42,
        error: "Error de generación",
      } as never;
    return {
      video_id: "video",
      supported,
      default_locale: "es-419",
      locales: [
        original,
        {
          locale: "pt-BR",
          label: "PT",
          name: "Português",
          status,
          is_original: false,
          preview_url: status === "ready" || status === "needs_review" ? "/portugues" : null,
          job_id: status === "generating" ? "job" : null,
          progress: { stage: "Traduciendo", percent: 42 },
          error: status === "failed" ? "Error de generación" : null,
          title: "Título português",
          publish: {
            youtube: { title: "Título traduzido" },
            thumbnails: { a: { url: "/pt.jpg" } },
          },
        },
      ],
    } as never;
  });
  render(
    <QueryClientProvider client={client}>
      <ExplainerVideoCard video={video} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Abrir"));
  return client;
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("idiomas del video", () => {
  it("carga la vista y datos de la versión lista, identificando los faltantes", async () => {
    const client = setup("ready");
    fireEvent.click(await screen.findByText("PT"));
    expect(screen.getByTestId("source").textContent).toContain("/portugues");
    expect(screen.getAllByText("Título traduzido").length).toBeGreaterThan(0);
    expect(screen.queryByText("Original YouTube")).toBeNull();
    expect(screen.queryByText("Descripción original")).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    client.clear();
  });
  it("crea una versión faltante sin cargar el original", async () => {
    const client = setup("missing");
    fireEvent.click(await screen.findByText("PT"));
    expect(screen.getByTestId("source").textContent).toBe("");
    const create = screen.getByText("Crear versión en portugués") as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);
    await waitFor(() =>
      expect(httpClient).toHaveBeenCalledWith(
        expect.stringContaining("/localizations"),
        expect.objectContaining({ method: "POST", body: { locale: "pt-BR" } }),
      ),
    );
    client.clear();
  });
  it("muestra progreso para trabajos activos", async () => {
    const client = setup("generating");
    fireEvent.click(await screen.findByText("PT"));
    expect((await screen.findAllByText(/Traduciendo · 42%/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Abrir"));
    expect(screen.queryByText(/Traduciendo/)).toBeNull();
    client.clear();
  });
  it("sigue sondeando running y recarga la edición cuando el trabajo termina", async () => {
    const client = setup("generating");
    let polls = 0;
    vi.mocked(httpClient).mockImplementation(async (path) => {
      if (path.includes("localization-jobs")) {
        polls += 1;
        return {
          job_id: "job",
          video_id: "video",
          locale: "pt-BR",
          status: polls === 1 ? "running" : "completed",
          stage: "voice",
          percent: 42,
          error: null,
        } as never;
      }
      return {
        video_id: "video",
        supported: true,
        default_locale: "es-419",
        locales: [
          original,
          {
            locale: "pt-BR",
            label: "PT",
            name: "Português",
            status: polls > 1 ? "ready" : "generating",
            is_original: false,
            preview_url: polls > 1 ? "/nueva" : null,
            job_id: "job",
            title: "Novo",
            publish: { youtube: { chapters: [{ t: 0, title: "Começo" }] } },
          },
        ],
      } as never;
    });
    fireEvent.click(await screen.findByText("PT"));
    expect((await screen.findAllByText(/voice · 42%/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("/nueva"), {
      timeout: 8000,
    });
    expect(polls).toBe(2);
    expect(screen.getByText("Começo")).toBeTruthy();
    expect(screen.queryByText(/Capítulos:.*no disponibles/)).toBeNull();
    client.clear();
  }, 10000);
  it("cancela la petición del trabajo al cerrar el modal", async () => {
    const client = setup("generating");
    let signal: AbortSignal | undefined;
    vi.mocked(httpClient).mockImplementation(async (path, options) => {
      if (path.includes("localization-jobs")) {
        signal = options?.signal ?? undefined;
        return new Promise((_resolve, reject) =>
          signal?.addEventListener("abort", () => reject(new Error("abortado"))),
        );
      }
      return {
        video_id: "video",
        supported: true,
        default_locale: "es-419",
        locales: [
          original,
          {
            locale: "pt-BR",
            label: "PT",
            name: "Português",
            status: "generating",
            is_original: false,
            preview_url: null,
            job_id: "job",
          },
        ],
      } as never;
    });
    await waitFor(() => expect(signal).toBeDefined());
    fireEvent.click(screen.getByText("Abrir"));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    client.clear();
  });
  it("muestra error y reintento", async () => {
    const client = setup("failed");
    fireEvent.click(await screen.findByText("PT"));
    expect(screen.getByText("Error de generación")).toBeTruthy();
    expect(screen.getByText("Reintentar")).toBeTruthy();
    client.clear();
  });
  it("oculta el selector para diseños no soportados", async () => {
    const client = setup("ready", false);
    await waitFor(() => expect(httpClient).toHaveBeenCalled());
    expect(screen.queryByText("PT")).toBeNull();
    expect(screen.getByText("Original YouTube")).toBeTruthy();
    client.clear();
  });
  it("conserva el idioma seleccionado si falla la actualización", async () => {
    const client = setup("ready");
    fireEvent.click(await screen.findByText("PT"));
    vi.mocked(httpClient).mockRejectedValue(new Error("sin conexión"));
    await client.invalidateQueries({ queryKey: ["explainer-localizations", "video"] });
    expect(screen.getByTestId("source").textContent).toContain("/portugues");
    expect(await screen.findByText("No se pudo actualizar el estado del idioma.")).toBeTruthy();
    client.clear();
  });
  it("reanuda el mismo intento cuando la comprobación lo permite", async () => {
    const client = setup("failed");
    await screen.findByText("PT");
    client.setQueryData<{ locales: Record<string, unknown>[] }>(
      ["explainer-localizations", "video"],
      (old) =>
        old && {
          ...old,
          locales: old.locales.map((item) =>
            item.locale === "pt-BR" ? { ...item, resumable: true, job_id: "job" } : item,
          ),
        },
    );
    const existingMock = vi.mocked(httpClient).getMockImplementation();
    vi.mocked(httpClient).mockImplementation(async (path, options) =>
      path.endsWith("/preflight")
        ? ({ ready: true, issues: [], next_action: "resume", job_id: "job" } as never)
        : (existingMock?.(path, options) as never),
    );
    fireEvent.click(screen.getByText("PT"));
    expect(screen.queryByText("Crear nueva versión")).toBeNull();
    fireEvent.click(await screen.findByText("Reanudar versión"));
    await waitFor(() =>
      expect(httpClient).toHaveBeenCalledWith(
        "/api/v1/explainer/localization-jobs/job/resume",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    client.clear();
  });
  it("conserva el preview activo sin controles de regeneración en la barra", async () => {
    const client = setup("ready");
    await screen.findByText("PT");
    client.setQueryData<{ locales: Record<string, unknown>[] }>(
      ["explainer-localizations", "video"],
      (old) =>
        old && {
          ...old,
          locales: old.locales.map((item) =>
            item.locale === "pt-BR" ? { ...item, stale: true } : item,
          ),
        },
    );
    fireEvent.click(screen.getByText("PT"));
    expect(screen.getByTestId("source").textContent).toContain("/portugues");
    expect(screen.queryByText("Crear nueva versión")).toBeNull();
    expect(screen.queryByText(/El último intento falló/)).toBeNull();
    client.clear();
  });
});

describe("crear una edición nativa desde el modal", () => {
  it("pasa de ausente a un solo trabajo, progreso y paquete nativo completo", async () => {
    const client = setup("missing");
    let phase: "missing" | "running" | "done" = "missing";
    let creations = 0;
    vi.mocked(httpClient).mockImplementation(async (path, options) => {
      if (path.endsWith("/preflight"))
        return { ready: true, issues: [], next_action: "create" } as never;
      if (path.endsWith("/localizations") && options?.method === "POST") {
        creations += 1;
        phase = "running";
        return { job_id: "job-new", locale: "pt-BR", status: "queued" } as never;
      }
      if (path.includes("/localization-jobs/"))
        return {
          job_id: "job-new",
          video_id: "video",
          locale: "pt-BR",
          status: phase === "done" ? "completed" : "running",
          stage: "Preparando audio",
          percent: phase === "done" ? 100 : 62,
          error: null,
        } as never;
      if (path.endsWith("/localizations"))
        return {
          video_id: "video",
          supported: true,
          default_locale: "es-419",
          locales: [
            original,
            phase === "done"
              ? portugueseReady
              : {
                  locale: "pt-BR",
                  label: "PT",
                  name: "Português",
                  status: phase === "missing" ? "missing" : "generating",
                  is_original: false,
                  preview_url: null,
                  job_id: phase === "missing" ? null : "job-new",
                  job_status: phase === "missing" ? null : "running",
                },
          ],
        } as never;
      return { previews: [] } as never;
    });
    fireEvent.click(await screen.findByText("PT"));
    expect(screen.getByText("Edición aún no creada")).toBeTruthy();
    expect(screen.queryByText(/Paquete pendiente|Sin título|no hay una apertura/i)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "tab.record" }));
    expect(screen.queryByText(/Falta el título|publish.json/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "tab.texts" }));
    const create = screen.getByRole("button", {
      name: "Crear versión en portugués",
    }) as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(creations).toBe(1));
    expect(await screen.findByText("Creando edición")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText("Preparando audio · 62%").length).toBeGreaterThan(0),
    );
    expect(screen.getByTestId("source").textContent).toBe("");
    expect(screen.queryByText("Descripción original")).toBeNull();
    phase = "done";
    await client.invalidateQueries({
      queryKey: ["explainer-localization-job", "video", "pt-BR", "job-new"],
    });
    await waitFor(() =>
      expect(screen.getByTestId("source").textContent).toContain("edition=pt-BR"),
    );
    expect(screen.getByText("Descrição em português")).toBeTruthy();
    expect(screen.getByText("Título português B")).toBeTruthy();
    expect(document.querySelectorAll('img[src^="/pt-"]')).toHaveLength(3);
    expect(screen.queryByText("Edición aún no creada")).toBeNull();
    expect(screen.queryByText(/Falta el título|publish.json/)).toBeNull();
    expect(creations).toBe(1);
    fireEvent.click(screen.getByText("Abrir"));
    const queries = client
      .getQueryCache()
      .findAll({ queryKey: ["explainer-localization-job", "video"] });
    expect(queries.every((query) => query.getObserversCount() === 0)).toBe(true);
    client.clear();
  });

  it("bloquea la creación por una precondición real y permite volver a comprobar", async () => {
    const client = setup("missing");
    let allowed = false;
    const implementation = vi.mocked(httpClient).getMockImplementation();
    vi.mocked(httpClient).mockImplementation(async (path, options) =>
      path.endsWith("/preflight")
        ? ({
            ready: allowed,
            issues: allowed
              ? []
              : [
                  {
                    level: "error",
                    field: "source_thumbnails",
                    message:
                      "Prepara las tres miniaturas del original antes de crear esta edición.",
                  },
                ],
            next_action: "create",
          } as never)
        : (implementation?.(path, options) as never),
    );
    fireEvent.click(await screen.findByText("PT"));
    expect(
      await screen.findByText(
        "Prepara las tres miniaturas del original antes de crear esta edición.",
      ),
    ).toBeTruthy();
    const button = screen.getByRole("button", {
      name: "Crear versión en portugués",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(httpClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
    allowed = true;
    fireEvent.click(screen.getByRole("button", { name: "Volver a comprobar" }));
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(
      screen.queryByText("Prepara las tres miniaturas del original antes de crear esta edición."),
    ).toBeNull();
    client.clear();
  });

  it("reanuda el mismo job sin conservar su fallo anterior ni crear otro", async () => {
    const client = setup("failed");
    let running = false;
    let resumed = 0;
    vi.mocked(httpClient).mockImplementation(async (path) => {
      if (path.endsWith("/preflight"))
        return { ready: true, issues: [], next_action: "resume", job_id: "job-old" } as never;
      if (path.endsWith("/job-old/resume")) {
        running = true;
        resumed += 1;
        return { job_id: "job-old", locale: "pt-BR", status: "queued" } as never;
      }
      if (path.includes("/localization-jobs/"))
        return {
          job_id: "job-old",
          video_id: "video",
          locale: "pt-BR",
          status: running ? "running" : "failed",
          stage: "Continuando audio",
          percent: 72,
          error: running ? null : "Fallo anterior",
        } as never;
      if (path.endsWith("/localizations"))
        return {
          video_id: "video",
          supported: true,
          default_locale: "es-419",
          locales: [
            original,
            {
              locale: "pt-BR",
              label: "PT",
              name: "Português",
              status: "failed",
              is_original: false,
              preview_url: null,
              job_id: "job-old",
              job_status: "failed",
              resumable: true,
            },
          ],
        } as never;
      return { previews: [] } as never;
    });
    await client.invalidateQueries({ queryKey: ["explainer-localizations", "video"] });
    client.setQueryData(["explainer-localization-job", "video", "pt-BR", "job-old"], {
      job_id: "job-old",
      locale: "pt-BR",
      status: "failed",
      error: "Fallo anterior",
    });
    fireEvent.click(await screen.findByText("PT"));
    fireEvent.click(await screen.findByRole("button", { name: "Reanudar versión" }));
    await waitFor(() => expect(resumed).toBe(1));
    expect(await screen.findByText("Creando edición")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText("Continuando audio · 72%").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Fallo anterior")).toBeNull();
    expect(httpClient).not.toHaveBeenCalledWith(
      "/api/v1/explainer/videos/video/localizations",
      expect.objectContaining({ method: "POST" }),
    );
    client.clear();
  });

  it("adopta un trabajo ya iniciado por otra sesión sin duplicarlo", async () => {
    const client = setup("missing");
    const implementation = vi.mocked(httpClient).getMockImplementation();
    vi.mocked(httpClient).mockImplementation(async (path, options) => {
      if (path.endsWith("/preflight"))
        return { ready: true, issues: [], next_action: "wait", job_id: "job-shared" } as never;
      if (path.endsWith("/localization-jobs/job-shared"))
        return {
          job_id: "job-shared",
          video_id: "video",
          locale: "pt-BR",
          status: "running",
          stage: "Ajustando tiempos",
          percent: 83,
          error: null,
        } as never;
      return implementation?.(path, options) as never;
    });
    fireEvent.click(await screen.findByText("PT"));
    expect(await screen.findByText("Creando edición")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText("Ajustando tiempos · 83%").length).toBeGreaterThan(0),
    );
    expect(httpClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      vi.mocked(httpClient).mock.calls.filter(([path]) => path.endsWith("/preflight")),
    ).toHaveLength(1);
    client.clear();
  });

  it("actualiza la admisión al fallar y ofrece reanudar en lugar de crear otro intento", async () => {
    const client = setup("missing");
    let failed = false;
    vi.mocked(httpClient).mockImplementation(async (path, options) => {
      if (path.endsWith("/preflight"))
        return {
          ready: true,
          issues: [],
          next_action: failed ? "resume" : "create",
          job_id: failed ? "job-recover" : null,
        } as never;
      if (path.endsWith("/localizations") && options?.method === "POST")
        return { job_id: "job-recover", locale: "pt-BR", status: "queued" } as never;
      if (path.endsWith("/localization-jobs/job-recover")) {
        failed = true;
        return {
          job_id: "job-recover",
          video_id: "video",
          locale: "pt-BR",
          status: "failed",
          stage: "voice",
          percent: 55,
          error: "Servicio de voz no disponible",
        } as never;
      }
      if (path.endsWith("/localizations"))
        return {
          video_id: "video",
          supported: true,
          default_locale: "es-419",
          locales: [
            original,
            {
              locale: "pt-BR",
              label: "PT",
              name: "Português",
              status: failed ? "failed" : "missing",
              is_original: false,
              preview_url: null,
              job_id: failed ? "job-recover" : null,
              job_status: failed ? "failed" : null,
              resumable: failed,
              error: failed ? "Servicio de voz no disponible" : null,
            },
          ],
        } as never;
      return { previews: [] } as never;
    });
    fireEvent.click(await screen.findByText("PT"));
    const create = screen.getByRole("button", {
      name: "Crear versión en portugués",
    }) as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);
    expect(await screen.findByRole("button", { name: "Reanudar versión" })).toBeTruthy();
    expect(screen.getByText("Servicio de voz no disponible")).toBeTruthy();
    expect(
      vi.mocked(httpClient).mock.calls.filter(([path]) => path.endsWith("/preflight")).length,
    ).toBeGreaterThan(1);
    expect(
      vi
        .mocked(httpClient)
        .mock.calls.filter(
          ([path, options]) => path.endsWith("/localizations") && options?.method === "POST",
        ),
    ).toHaveLength(1);
    client.clear();
  });

  it.each(["cambiar idioma", "cerrar modal"])("cancela preflight al %s", async (operation) => {
    const client = setup("missing");
    let signal: AbortSignal | undefined;
    const implementation = vi.mocked(httpClient).getMockImplementation();
    vi.mocked(httpClient).mockImplementation(async (path, options) => {
      if (path.endsWith("/preflight")) {
        signal = options?.signal ?? undefined;
        return new Promise((_resolve, reject) =>
          signal?.addEventListener("abort", () => reject(new Error("abortado"))),
        );
      }
      return implementation?.(path, options) as never;
    });
    fireEvent.click(await screen.findByText("PT"));
    await waitFor(() => expect(signal).toBeDefined());
    fireEvent.click(screen.getByText(operation === "cambiar idioma" ? "ES" : "Abrir"));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    client.clear();
  });
});
