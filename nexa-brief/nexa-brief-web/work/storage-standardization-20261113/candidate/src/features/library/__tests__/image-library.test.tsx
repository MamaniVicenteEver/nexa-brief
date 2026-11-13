import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { getImageLibrary } from "../api/image-library-service";
import { BibliotecaView } from "../components/BibliotecaView";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("../hooks/useJobs", () => ({
  useJobs: () => ({
    data: [
      {
        jobId: "video1",
        title: "Video de prueba",
        category: "node_tech",
        stage: "packaged",
        updatedAt: "2026-11-01T00:00:00Z",
        durationSeconds: 30,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/features/explainer/hooks/useExplainer", () => ({
  useExplainerRecordings: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/schedule", () => ({ useQueueEntries: () => ({ data: [] }) }));
vi.mock("../hooks/useCategoryLabels", () => ({ useCategoryLabels: () => (id: string) => id }));
vi.mock("../components/VideoCard", () => ({
  VideoCard: ({ video }: { video: { job: { title: string } } }) => <p>{video.job.title}</p>,
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
        <button onClick={() => onOpenChange(false)} type="button">
          Cerrar
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/categories", () => ({
  useCategories: () => ({
    data: [{ id: "node_tech", path: "nodetech", displayName: "NodeTech", children: [] }],
  }),
}));

const dto = (id: string, title: string) => ({
  post_id: id,
  publication_id: `pub-${id}`,
  status: "ready_for_review",
  updated_at: "2026-11-01T00:00:00Z",
  editorial: { category_id: "node_tech", title },
  technical: {
    kind: "carousel",
    composition_plan: { format: "4:5" },
    slides: [
      { asset_id: `asset-${id}`, order: 1 },
      { asset_id: "second", order: 2 },
    ],
  },
});
function renderLibrary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="es" messages={messages}>
        <BibliotecaView />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("cambia entre videos e imágenes, sigue páginas vacías y abre el detalle existente", async () => {
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const cursor = new URL(String(url), "http://test").searchParams.get("cursor");
    return new Response(
      JSON.stringify(
        cursor === null
          ? { items: [], next_cursor: "next" }
          : { items: [dto("post1", "Carrusel de prueba")], next_cursor: null },
      ),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  renderLibrary();
  expect(screen.getByText("Video de prueba")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Imágenes" }));
  expect(screen.queryByText("Video de prueba")).toBeNull();
  const card = await screen.findByRole("button", { name: "Visualizar Carrusel de prueba" });
  expect(within(card).getByText("NodeTech")).toBeTruthy();
  expect(within(card).getByText("Pendiente de revisión")).toBeTruthy();
  expect(within(card).getByText("2 láminas · 4:5")).toBeTruthy();
  expect(card.querySelector("img")?.getAttribute("src")).toBe(
    "/api/image-posts/pub-post1/assets/asset-post1",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  fireEvent.click(card);
  expect(screen.getByRole("dialog").textContent).toContain("Detalle post1");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar imágenes" }), {
    target: { value: "no existe" },
  });
  expect(screen.getByText("No se encontraron imágenes para esta búsqueda.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Videos" }));
  expect(screen.getByText("Video de prueba")).toBeTruthy();
});

it("si la lista global está restringida permite consultar una categoría autorizada", async () => {
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const category = new URL(String(url), "http://test").searchParams.get("category_id");
    return category
      ? new Response(
          JSON.stringify({ items: [dto("post2", "Imagen autorizada")], next_cursor: null }),
          { status: 200 },
        )
      : new Response(JSON.stringify({ detail: "Elige una categoría" }), { status: 403 });
  });
  vi.stubGlobal("fetch", fetcher);
  renderLibrary();
  fireEvent.click(screen.getByRole("button", { name: "Imágenes" }));
  expect(
    await screen.findByText("Elegí una categoría a la que tengas acceso para ver sus imágenes."),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), {
    target: { value: "node_tech" },
  });
  expect(await screen.findByRole("button", { name: "Visualizar Imagen autorizada" })).toBeTruthy();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
});

it("informa un cursor repetido en vez de quedarse cargando indefinidamente", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [], next_cursor: "repeat" }), { status: 200 }),
    ),
  );
  await expect(getImageLibrary("")).rejects.toThrow("Repeated image library cursor");
});
