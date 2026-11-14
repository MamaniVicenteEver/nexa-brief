import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import extra from "../../../../messages/es/library.json";
import base from "../../../../messages/es.json";
import { BibliotecaView } from "../components/BibliotecaView";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/realtime", () => ({ useRealtimeEvent: () => {} }));
vi.mock("../components/VideoCard", () => ({
  VideoCard: ({ video }: { video: { job: { title: string }; categoryLabel: string } }) => (
    <article>
      <h2>{video.job.title}</h2>
      <p>{video.categoryLabel}</p>
    </article>
  ),
}));
vi.mock("../components/ExplainerRecordingCard", () => ({ ExplainerRecordingCard: () => null }));
vi.mock("@/features/image-posts/components/PublishedPostModal", () => ({
  PublishedPostModal: ({
    postId,
    open,
    onOpenChange,
  }: {
    postId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog">
        Detalle {postId}
        <button type="button" onClick={() => onOpenChange(false)}>
          Cerrar
        </button>
      </div>
    ) : null,
}));

const requests: URL[] = [];
let fail = false;
function row(i: number, media = "videos") {
  const category = i % 2 ? "node_tech" : "node_motion";
  const title = `${media === "images" ? "Imagen" : "Video"} ${String(i).padStart(3, "0")}`;
  return {
    id: `${media}-${i}`,
    kind: media === "images" ? "image" : "video",
    category_id: category,
    category_label: category === "node_tech" ? "NodeTech" : "NodeMotion",
    title,
    status: i % 3 ? "ready" : "published",
    updated_at: "2026-11-01T00:00:00Z",
    duration_seconds: i,
    payload:
      media === "images"
        ? {
            post_id: `post-${i}`,
            publication_id: `pub-${i}`,
            category_id: category,
            title,
            status: "ready_for_review",
            kind: "carousel",
            format: "4:5",
            slide_count: 2,
            cover_asset_id: `asset-${i}`,
            updated_at: "2026-11-01T00:00:00Z",
          }
        : {
            job: {
              job_id: `job-${i}`,
              category: "legacy-design",
              title,
              stage: "packaged",
              is_terminal: true,
              created_at: "2026-11-01T00:00:00Z",
              updated_at: "2026-11-01T00:00:00Z",
              duration_seconds: i,
              generation_seconds: 5,
            },
            published: [],
            scheduled: [],
          },
  };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale="es"
        messages={{
          ...base,
          library: {
            ...base.library,
            ...extra.library,
            pagination: { ...base.library.pagination, ...extra.library.pagination },
          },
        }}
      >
        <BibliotecaView />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  requests.length = 0;
  fail = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(String(input), "http://test");
      requests.push(url);
      if (fail) return Response.json({ detail: "Server unavailable" }, { status: 503 });
      const media = url.searchParams.get("media") ?? "videos";
      let items = Array.from({ length: media === "images" ? 23 : 45 }, (_, i) => row(i, media));
      const unfiltered_total = items.length;
      const q = url.searchParams.get("q") ?? "";
      items = items.filter((item) => item.title.toLowerCase().includes(q.toLowerCase()));
      const categories = ["node_motion", "node_tech"]
        .map((id) => ({
          id,
          label: id === "node_motion" ? "NodeMotion" : "NodeTech",
          count: items.filter((item) => item.category_id === id).length,
        }))
        .filter((c) => c.count);
      const category = url.searchParams.get("category");
      if (category) items = items.filter((item) => item.category_id === category);
      const status_counts = {
        all: items.length,
        pending: items.filter((item) => item.status === "ready").length,
        published: items.filter((item) => item.status === "published").length,
        processing: 0,
        failed: 0,
      };
      const status = url.searchParams.get("status");
      if (status && status !== "all")
        items = items.filter((item) => item.status === (status === "pending" ? "ready" : status));
      if (url.searchParams.get("sort") === "oldest") items.reverse();
      const total = items.length;
      const page = Math.min(
        Number(url.searchParams.get("page") ?? 1),
        Math.max(1, Math.ceil(total / 20)),
      );
      return Response.json({
        items: items.slice((page - 1) * 20, page * 20),
        total,
        page,
        page_size: 20,
        unfiltered_total,
        categories,
        status_counts,
        has_active_jobs: false,
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("muestra 20 por página y conserva totales y categorías reales en todas las páginas", async () => {
  const { container } = mount();
  await screen.findByRole("heading", { name: "Video 000" });
  expect(container.querySelectorAll("article")).toHaveLength(20);
  const nav = screen.getByRole("navigation", { name: "Páginas de Biblioteca" });
  expect(within(nav).getByText("1–20 de 45")).toBeTruthy();
  fireEvent.click(within(nav).getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("heading", { name: "Video 020" });
  expect(container.querySelectorAll("article")).toHaveLength(20);
  expect(screen.getByText("21–40 de 45")).toBeTruthy();
  const categories = screen.getByRole("group", { name: "Categoría" });
  expect(within(categories).getByRole("button", { name: "NodeMotion 23" })).toBeTruthy();
  expect(screen.queryByText("legacy-design")).toBeNull();
  fireEvent.click(within(categories).getByRole("button", { name: "NodeTech 22" }));
  await screen.findByRole("heading", { name: "Video 001" });
  expect(screen.getByText("1–20 de 22")).toBeTruthy();
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  expect(requests.every((url) => url.pathname === "/api/biblioteca")).toBe(true);
});

it("busca en el servidor, ordena y reinicia la página al cambiar de filtro", async () => {
  mount();
  await screen.findByRole("heading", { name: "Video 000" });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Video 044" } });
  await screen.findByRole("heading", { name: "Video 044" });
  expect(screen.getByText("1–1 de 1")).toBeTruthy();
  expect(requests.at(-1)?.searchParams.get("q")).toBe("Video 044");
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  await screen.findByRole("heading", { name: "Video 000" });
  fireEvent.change(screen.getByRole("combobox", { name: "Ordenar" }), {
    target: { value: "oldest" },
  });
  await screen.findByRole("heading", { name: "Video 044" });
  expect(requests.at(-1)?.searchParams.get("sort")).toBe("oldest");
});

it("pagina imágenes y abre el detalle existente sin descargar el resto de páginas", async () => {
  const { container } = mount();
  await screen.findByRole("heading", { name: "Video 000" });
  fireEvent.click(screen.getByRole("button", { name: "Imágenes" }));
  const card = await screen.findByRole("button", { name: "Visualizar Imagen 000" });
  expect(container.querySelectorAll("article")).toHaveLength(20);
  expect(card.querySelector("img")?.getAttribute("src")).toBe(
    "/api/image-posts/pub-0/assets/asset-0",
  );
  expect(within(card).getByText("NodeMotion")).toBeTruthy();
  expect(requests.filter((url) => url.searchParams.get("media") === "images")).toHaveLength(1);
  fireEvent.click(card);
  expect(screen.getByRole("dialog").textContent).toContain("Detalle post-0");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("button", { name: "Visualizar Imagen 020" });
  expect(container.querySelectorAll("article")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Videos" }));
  await screen.findByRole("heading", { name: "Video 000" });
  expect(screen.getByRole("link", { name: "Crear video" }).getAttribute("href")).toBe(
    "/crear-video",
  );
});

it("filtra por estado y muestra una lista vacía sin conservar resultados anteriores", async () => {
  mount();
  await screen.findByRole("heading", { name: "Video 000" });
  fireEvent.click(screen.getByRole("button", { name: "Publicados 15" }));
  await waitFor(() => expect(requests.at(-1)?.searchParams.get("status")).toBe("published"));
  expect(await screen.findByText("1–15 de 15")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fallidos 0" }));
  await screen.findByText("No hay resultados con esos filtros.");
  expect(screen.queryByRole("heading", { name: "Video 000" })).toBeNull();
});
