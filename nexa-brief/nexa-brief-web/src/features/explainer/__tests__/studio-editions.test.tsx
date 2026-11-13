import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { ExplainerStudioSidebar } from "../components/ExplainerStudioSidebar";
import type { Localization } from "../hooks/useLocalizations";
import { studioVideo } from "../lib/studio-edition";
import type { ExplainerVideo } from "../types";

vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (url: string) => url,
}));
const record = vi.fn();
const capture = vi.fn();
const choose = vi.fn();
const accountOptions = vi.fn();
vi.mock("../hooks/useExplainer", () => ({
  useRecordExplainerVideo: () => ({ mutate: record, isPending: false }),
  usePublishAccounts: (enabled: boolean) => {
    accountOptions(enabled);
    return { data: [], isLoading: false };
  },
  useCaptureThumbnails: () => ({ mutate: capture, isPending: false }),
  useChooseThumbnail: () => ({ mutate: choose, isPending: false }),
  RECORDING_JOBS_QUERY_KEY: ["explainer-recordings"],
}));

const video = {
  videoId: "demo",
  title: "ORIGINAL ES",
  topic: "Tema original",
  ready: true,
  publishReady: true,
  previewUrl: "/spanish",
  posterUrl: "/spanish.jpg",
  lastJob: null,
  rendered: ["original.mp4"],
  youtubeTitle: "TÍTULO ESPAÑOL",
  youtubeDescription: "DESCRIPCIÓN ESPAÑOLA",
  youtubeTags: [],
  facebookTitle: "FACEBOOK ES",
  facebookDescription: "",
  tiktokCaption: "TIKTOK ES",
  tiktokHashtags: [],
  qualityIssues: [],
  demo: false,
  thumbnails: { chosen: null, options: [] },
  publishPackage: { package: null, titleMaxChars: 60, issues: [] },
} as unknown as ExplainerVideo;
const english = {
  locale: "en-US",
  label: "EN",
  name: "English",
  status: "needs_review",
  is_original: false,
  preview_url: "/english",
  job_id: "job",
  revision: "rev-005",
  publish: {
    youtube: {
      title: "YOUR CHATS",
      description: "English description",
      pinned: "Your thoughts?",
      chapters: [{ t: 0, title: "Privacy" }],
    },
  },
  studio: {
    issues: [{ level: "warning", field: "review", message: "Revisión editorial pendiente" }],
    title_max_chars: 60,
    opening: {
      text: "YOUR CHATS",
      image_url: "/photo.jpg",
      preview_url: "/english?t=2",
      component: "common.tabloid",
    },
    duration_seconds: 661,
    capabilities: { record: false, publish: false },
  },
} satisfies Localization;

const readyEnglish = {
  ...english,
  status: "ready",
  studio: {
    ...english.studio,
    issues: [],
    ready: true,
    publish_ready: true,
    capabilities: { record: true, publish: true },
    approval_token: "sha256:approved-artifacts",
    thumbnails: {
      chosen: "C",
      options: (["A", "B", "C"] as const).map((option) => ({
        option,
        component: `native.${option}`,
        params: { text: `EN ${option}` },
        url: `/en-${option}.jpg`,
      })),
    },
    publish_package: {
      issues: [],
      title_max_chars: 60,
      thumbnail_image_url: "/native-photo.jpg",
      thumbnail_tabloid_image_url: "/native-photo.jpg",
      hook_strategy_names: { "1": "Curiosity" },
      package: {
        thumbnail: {
          kicker: "",
          text_only: { lines: ["YOUR CHATS"], highlight: "CHATS", pair_title: "A" },
          with_image: { text: "STILL SAVED?", pair_title: "B", image_side: "auto" },
          tabloid: {
            text: "BEFORE A JUDGE",
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
            text: `English title ${option}`,
            strategy: 1,
            emotion: "curiosity",
          })),
          chosen: "A",
        },
        pinned_comment: "Native pinned comment",
      },
    },
  },
} satisfies Localization;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

function setup(edition?: Localization, jobs?: unknown[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (jobs) client.setQueryData(["explainer-recordings"], jobs);
  const onPreview = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <ExplainerStudioSidebar
        video={video}
        edition={edition}
        thumbnailPreview={null}
        onThumbnailPreview={onPreview}
      />
    </QueryClientProvider>,
  );
  return { client, onPreview, ...view };
}

describe("estudio compartido por idioma", () => {
  it("ES predeterminado empieza en Antes de publicar y conserva las tres pestañas", () => {
    const { client } = setup();
    expect(screen.getByText(/Predeterminado/)).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByText("beforePublishing")).toBeTruthy();
    expect(screen.getByText("TÍTULO ESPAÑOL")).toBeTruthy();
    expect(screen.queryByText(/Completar preparación|Capturar|Sin capturar/)).toBeNull();
    client.clear();
  });
  it("EN usa las mismas secciones con sus textos y apertura, sin copiar contenido ES", () => {
    const { client, onPreview, container } = setup(english);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByText("Revisión editorial pendiente")).toBeTruthy();
    expect(screen.queryByText("DESCRIPCIÓN ESPAÑOLA")).toBeNull();
    expect(screen.getByText("English description")).toBeTruthy();
    expect(screen.getByText("Privacy")).toBeTruthy();
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Ver apertura EN" }));
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ componentPreviewUrl: "/english?t=2", text: "YOUR CHATS" }),
    );
    client.clear();
  });
  it("no ejecuta la grabación ES desde el tab de EN", () => {
    const { client } = setup(english);
    fireEvent.click(screen.getByRole("tab", { name: "tab.record" }));
    expect(screen.getByRole("status").textContent).toContain("Revisión editorial pendiente");
    expect(screen.queryByText(/youtube_title|publish.json/)).toBeNull();
    const button = screen.getByRole("button", { name: "prep.record" });
    expect(button.closest("fieldset")?.disabled).toBe(true);
    fireEvent.click(button);
    expect(record).not.toHaveBeenCalled();
    client.clear();
  });
  it("EN aprobado muestra A/B/C y permite elegir sin capturar al abrir", () => {
    const { client, container } = setup(readyEnglish);
    expect(container.querySelectorAll('img[src^="/en-"]')).toHaveLength(3);
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
    expect(screen.getByText("English title B")).toBeTruthy();
    expect(screen.queryByText(/La captura de miniatura aún no está disponible/)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Usar B como apertura" }));
    expect(choose).toHaveBeenCalledWith({
      videoId: "demo",
      option: "B",
      locale: "en-US",
      revision: "rev-005",
    });
    client.clear();
  });
  it("captura las opciones pendientes sólo al pulsar el botón y en ese idioma", () => {
    const { client } = setup({
      ...readyEnglish,
      studio: {
        ...readyEnglish.studio,
        thumbnails: {
          ...readyEnglish.studio.thumbnails,
          options: readyEnglish.studio.thumbnails.options.map((option) => ({
            ...option,
            url: null,
          })),
        },
      },
    });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Capturar miniaturas pendientes" }));
    expect(capture).toHaveBeenCalledWith({ videoId: "demo", locale: "en-US", revision: "rev-005" });
    client.clear();
  });
  it("graba EN con su revisión y consulta canales reales sin aviso falso de título", () => {
    const { client } = setup(readyEnglish);
    fireEvent.click(screen.getByRole("tab", { name: "tab.record" }));
    const button = screen.getByRole("button", { name: "prep.record" });
    expect(button.closest("fieldset")?.disabled).toBe(false);
    expect(accountOptions).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(/youtube_title|publish.json|no están habilitadas/)).toBeNull();
    fireEvent.click(button);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: "demo",
        locale: "en-US",
        revision: "rev-005",
        publish: false,
      }),
    );
    expect(sessionStorage.getItem("explainer-record-options:demo:en-US")).toBeTruthy();
    expect(sessionStorage.getItem("explainer-record-options:demo")).toBeNull();
    client.clear();
  });
  it("la aprobación identifica los artefactos exactos revisados", async () => {
    vi.mocked(httpClient).mockResolvedValue({} as never);
    const { client } = setup({
      ...readyEnglish,
      status: "needs_review",
      studio: { ...readyEnglish.studio, issues: english.studio.issues, publish_ready: false },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar edición" }));
    await waitFor(() =>
      expect(httpClient).toHaveBeenCalledWith(
        "/api/v1/explainer/videos/demo/localizations/en-US/approve",
        expect.objectContaining({
          method: "POST",
          body: { revision: "rev-005", artifact_sha256: "sha256:approved-artifacts" },
        }),
      ),
    );
    client.clear();
  });
  it("ES no hereda un trabajo EN del sondeo global", () => {
    const { client } = setup(undefined, [
      {
        jobId: "en-job",
        videoId: "demo",
        locale: "en-US",
        revision: "rev-005",
        state: "rendering",
      },
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "tab.record" }));
    expect(screen.queryByText("prep.jobState.rendering")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "prep.record" }));
    expect(record).toHaveBeenCalledWith(expect.not.objectContaining({ locale: "en-US" }));
    client.clear();
  });
  it("Uso consulta sólo el idioma seleccionado", async () => {
    vi.mocked(httpClient).mockResolvedValue({
      usage_status: "partial",
      total_tokens: null,
      unmeasured_calls: 0,
      totals_by_model: [],
      voice_usage_unattributed: true,
    } as never);
    const { client } = setup(english);
    fireEvent.click(screen.getByRole("tab", { name: "tab.usage" }));
    await waitFor(() =>
      expect(httpClient).toHaveBeenCalledWith(
        "/api/v1/explainer/videos/demo/localizations/en-US/usage",
        expect.anything(),
      ),
    );
    expect(await screen.findByText("Consumo editorial · EN")).toBeTruthy();
    expect(httpClient).not.toHaveBeenCalledWith(
      expect.stringContaining("/content/usage/video/"),
      expect.anything(),
    );
    client.clear();
  });
  it("un idioma faltante no hereda títulos, trabajos, miniaturas o estado publicable del original", () => {
    const localized = studioVideo(video, {
      ...english,
      publish: null,
      studio: null,
      preview_url: null,
      status: "missing",
    });
    expect(localized.youtubeTitle).toBe("");
    expect(localized.previewUrl).toBe("");
    expect(localized.ready || localized.publishReady).toBe(false);
    expect(localized.lastJob).toBeNull();
    expect(localized.rendered).toHaveLength(0);
    expect(localized.thumbnails.options).toHaveLength(0);
  });
});
