import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { PostTrace } from "../components/PostTrace";
import { PublishedPostModal } from "../components/PublishedPostModal";
import type { ImagePost, ImagePostTrace, PublicationDetail } from "../types";

const trace: ImagePostTrace = {
  schema_version: 1,
  identity: {
    post_id: "img_review",
    strategy: "amarillista",
    narrative: "hilo",
    level: "alto",
    slides: 5,
  },
  status: "ready_for_review",
  started_at: "2026-11-01T10:00:00Z",
  finished_at: "2026-11-01T10:02:30Z",
  duration_seconds: 150,
  error: null,
  model_calls: [],
  totals: {
    calls: 3,
    writer_rounds: 2,
    repairs: 1,
    corrections: 1,
    unknown_usage_calls: 0,
    tokens: {
      input_tokens: 12000,
      cached_input_tokens: 4000,
      output_tokens: 1800,
      total_tokens: 13800,
    },
    by_model: [
      {
        provider: "codex",
        model: "gpt-6.1-terra",
        calls: 3,
        total_tokens: 13800,
        cost_usd: 0,
        cost_label: "incluido en la suscripción",
      },
    ],
    cost: {
      usd: 0,
      currency: "USD",
      complete: true,
      label: "incluido en la suscripción",
    },
  },
  timeline: [
    {
      at: "2026-11-01T10:00:00Z",
      kind: "model_call",
      step: "copy_draft",
      label: "Redacción",
      model: "gpt-6.1-terra",
      status: "ok",
      seconds: 42,
      attempt: 1,
    },
    {
      at: "2026-11-01T10:00:44Z",
      kind: "event",
      step: "copy",
      label: "Campos rechazados",
      checker: "code",
      rejected_fields: {
        "levels.alto.statement": "Cifra ausente de la evidencia del PLAN",
      },
    },
    {
      at: "2026-11-01T10:01:00Z",
      kind: "event",
      step: "copy_repair",
      label: "Reparación",
      applied_changes: [
        {
          path: "levels.alto.statement",
          before: "Una cifra sin fuente",
          after: "El dato conserva su contexto",
          reason: "Cifra ausente de la evidencia del PLAN",
        },
      ],
    },
    {
      at: "2026-11-01T10:01:20Z",
      kind: "model_call",
      step: "fact_check",
      label: "Cotejo factual",
      model: "gpt-6.1-terra",
      status: "ok",
      seconds: 28,
      reason: "Todos los campos se corresponden con la evidencia verificada.",
    },
    {
      at: "2026-11-01T10:02:30Z",
      kind: "event",
      step: "render_qc",
      label: "Render y QC aprobados",
      status: "ok",
      seconds: 12,
    },
  ],
};

const slides = Array.from({ length: 5 }, (_, i) => ({
  slideId: `slide_${i}`,
  assetId: `asset_${i}`,
  order: i + 1,
  roleTag: i === 0 ? "Portada" : i === 4 ? "Final" : "Desarrollo",
  previewUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#151515"/><rect x="72" y="85" width="240" height="16" fill="#dfbf47"/><text x="72" y="165" fill="#dfbf47" font-size="28" font-family="sans-serif">NODETECH</text><text x="72" y="420" fill="#f4f1e8" font-size="80" font-weight="bold" font-family="sans-serif">El dato conserva</text><text x="72" y="525" fill="#f4f1e8" font-size="80" font-weight="bold" font-family="sans-serif">su contexto.</text><rect x="72" y="660" width="936" height="400" rx="12" fill="#242627"/><text x="118" y="800" fill="#d7d3c8" font-size="38" font-family="sans-serif">Una historia, paso a paso.</text><text x="72" y="1230" fill="#a5a196" font-size="26" font-family="sans-serif">@nodetech_es · Lámina ${i + 1} / 5</text></svg>`)}`,
  altTextFacebook: `Contexto del dato, lámina ${i + 1}`,
  altTextInstagram: `Contexto del dato, lámina ${i + 1}`,
}));

const publication: PublicationDetail = {
  publicationId: "pub_review",
  categoryId: "node_tech",
  categoryName: "NodeTech",
  topic: "Contexto",
  title: "El dato conserva su contexto",
  kind: "carousel",
  templateId: "five_slides",
  strategyId: "amarillista",
  status: "ready_for_review",
  createdAt: trace.started_at,
  latestPublishedAt: null,
  coverAssetId: "asset_0",
  coverUrl: slides[0].previewUrl,
  slides,
  deliveries: [],
  sourceVideoId: "video_review",
  sourceVideoUrl: null,
  sources: [],
  copy: {
    facebook: {
      caption: "Una historia contada con evidencia.",
      firstComment: "",
    },
    instagram: {
      caption: "Una historia contada con evidencia.",
      firstComment: "",
    },
    hashtags: [],
  },
  technical: {
    renderSeconds: 12,
    rendererVersion: "1.0",
    planHash: null,
    styleId: "node_tech_rough",
    styleVersion: "1",
    validations: [],
    slides: [],
    music: { mode: "none" },
    aiUsage: [],
    copySources: {},
    reel: null,
  },
  metricsSnapshots: [],
  reviewRequired: true,
  trace,
};

vi.mock("../hooks/useImagePosts", () => ({
  PUBLICATIONS_QUERY_KEY: ["publications"],
  usePublicationDetail: () => ({
    data: publication,
    isLoading: false,
    isError: false,
  }),
  useImageStrategies: () => ({
    data: [{ id: "amarillista", name: "Amarillista" }],
  }),
}));

vi.mock("../components/CodeSlidePreview", () => ({
  CodeSlidePreview: ({ format, slideId }: { format: string; slideId: string }) => (
    <div data-testid={`code-${slideId}`} data-format={format} />
  ),
}));

vi.mock("../components/ImagePostPublishingPanel", () => ({
  ImagePostPublishingPanel: ({ onPrepared }: { onPrepared?: (post: ImagePost) => void }) => (
    <button
      type="button"
      onClick={() =>
        onPrepared?.({
          postId: "img_review",
          revision: 2,
          format: "4:5",
          slides: slides.map((slide, index) => ({
            ...slide,
            assetId: `final-${index}`,
            previewUrl: `/final-${index}.jpg`,
          })),
        } as ImagePost)
      }
    >
      Simular preparación JPEG
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  publication.postId = undefined;
  publication.deliveries = [];
  publication.latestPublishedAt = null;
});

describe("recorrido de imagen", () => {
  it("muestra los JPEG finales devueltos al preparar y vuelve al diseño al cambiar de formato", () => {
    publication.postId = "img_review";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="es" messages={messages}>
          <PublishedPostModal summary={publication} open onOpenChange={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Publicar" }));
    fireEvent.click(screen.getByRole("button", { name: "Simular preparación JPEG" }));
    expect(
      screen.getByRole("img", { name: "Contexto del dato, lámina 1" }).getAttribute("src"),
    ).toBe("/final-0.jpg");
    expect(screen.queryByTestId("code-slide_0")).toBeNull();
    expect(screen.getByRole("button", { name: "JPEG final" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Diseño editable" }));
    expect(screen.getByTestId("code-slide_0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "JPEG final" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Formato 3:5, 1080 por 1800 píxeles",
      }),
    );
    expect(screen.getByTestId("code-slide_0").getAttribute("data-format")).toBe("3:5");
    expect(screen.queryByRole("button", { name: "JPEG final" })).toBeNull();
  });

  it("previsualiza borradores desde código en 4:5 y cambia de formato sin modificar el post", () => {
    publication.postId = "img_review";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="es" messages={messages}>
          <PublishedPostModal summary={publication} open onOpenChange={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("code-slide_0").getAttribute("data-format")).toBe("4:5");
    expect(screen.getAllByTestId(/^code-slide_/)).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Formato 4:5, 1080 por 1350 píxeles",
      }),
    );
    expect(screen.getByTestId("code-slide_0").getAttribute("data-format")).toBe("4:5");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Formato 3:5, 1080 por 1800 píxeles",
      }),
    );
    expect(screen.getByTestId("code-slide_0").getAttribute("data-format")).toBe("3:5");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar lámina 3" }));
    expect(screen.getAllByTestId(/^code-slide_/)).toHaveLength(1);
    expect(publication.revision).toBeUndefined();
  });

  it("conserva el JPEG publicado y bloquea la conversión de su archivo histórico", () => {
    publication.postId = "img_review";
    publication.latestPublishedAt = "2026-11-01T15:00:00Z";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="es" messages={messages}>
          <PublishedPostModal summary={publication} open onOpenChange={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("code-slide_0")).toBeNull();
    expect(
      screen.getByRole("img", { name: "Contexto del dato, lámina 1" }).getAttribute("src"),
    ).toBe(slides[0].previewUrl);
    expect(screen.getByText("Versión publicada · JPEG original")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Formato 9:16, 1080 por 1920 píxeles" })
        .closest("fieldset")?.disabled,
    ).toBe(true);
  });

  it("muestra motivos exactos, cambios aplicados y JSON completo", () => {
    render(<PostTrace trace={trace} />);
    expect(screen.getAllByText("Incluido en la suscripción").length).toBeGreaterThan(0);
    expect(screen.getByText("Cifra ausente de la evidencia del PLAN")).toBeTruthy();
    expect(screen.getByText("Una cifra sin fuente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver JSON" }));
    expect(screen.getByText(/"post_id": "img_review"/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descargar JSON" })).toBeTruthy();
  });

  it("explica la ausencia de traza en archivos anteriores", () => {
    render(<PostTrace trace={null} />);
    expect(screen.getByText("Este post no tiene recorrido registrado.")).toBeTruthy();
  });

  it("permite recorrer el carrusel con flechas, teclado y las cuatro pestañas", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="es" messages={messages}>
          <PublishedPostModal summary={publication} open onOpenChange={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Portada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lámina anterior" })).toBeNull();
    expect(document.querySelectorAll('figure[data-side="previous"]').length).toBe(0);
    expect(document.querySelectorAll('figure[data-side="next"]').length).toBe(4);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(screen.getByText("Portada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar lámina 5" }));
    expect(screen.queryByRole("button", { name: "Lámina siguiente" })).toBeNull();
    expect(document.querySelectorAll('figure[data-side="next"]').length).toBe(0);
    expect(document.querySelectorAll('figure[data-side="previous"]').length).toBe(4);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByText("Final")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar lámina 1" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByText("Desarrollo")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(screen.getByText("Portada")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(4);
    fireEvent.click(screen.getByRole("tab", { name: "Recorrido" }));
    expect(screen.getByRole("tabpanel").textContent).toContain("Recorrido de producción");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: /lámina 2/i }));
    expect(screen.getByRole("button", { name: /lámina 2/i }).getAttribute("aria-current")).toBe(
      "true",
    );
    expect(screen.getByText("Desarrollo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /lámina 5/i }));
    expect(screen.getByText("Final")).toBeTruthy();
    if (process.env.IMAGE_MODAL_REVIEW_DIR) {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const styles = await import("../components/PublishedPostModal.module.css");
      const directory = process.env.IMAGE_MODAL_REVIEW_DIR;
      fs.mkdirSync(directory, { recursive: true });
      const css = fs
        .readdirSync(path.resolve(".next/static/chunks"))
        .filter((name) => name.endsWith(".css"))
        .map(
          (name) =>
            `<link rel="stylesheet" href="file://${path.resolve(".next/static/chunks", name)}"/>`,
        )
        .join("");
      const custom = fs
        .readFileSync(
          path.resolve("src/features/image-posts/components/PublishedPostModal.module.css"),
          "utf8",
        )
        .replaceAll(".modal", `.${styles.default.modal}`)
        .replaceAll(".scrollbar", `.${styles.default.scrollbar}`)
        .replace(/:global\((.*?)\)/g, "$1");
      for (const theme of ["light", "dark"])
        fs.writeFileSync(
          path.join(directory, `${theme}.html`),
          `<!doctype html><html lang="es" class="${theme}"><head><meta charset="utf-8"/>${css}<style>${custom}</style></head><body>${document.body.innerHTML}</body></html>`,
        );
    }
  });
});
