import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/features/categories";
import messages from "../../../../messages/es.json";
import { ExplainerCategoryWindow } from "../../explainer/components/ExplainerCategoryWindow";
import { usePreparationView } from "../../templates/lib/preparation-view";

function PostView() {
  return <p>Estado de imágenes: {usePreparationView()}</p>;
}

vi.mock("../../sandbox/hooks/useSandbox", () => ({
  useSandbox: () => ({
    data: [
      {
        folder: "nodeeconomy",
        role: "projects",
        categoryId: "node_economy",
        items: [
          {
            id: "dinero-demo",
            folder: "nodeeconomy",
            demo: true,
            design: "dinero",
            kind: "explainer_kit",
            player: "protocol",
            title: "Demo Economía",
          },
          {
            id: "already-shown",
            folder: "nodeeconomy",
            demo: true,
            design: "binary",
            kind: "explainer_kit",
            player: "protocol",
            title: "Demo duplicada",
          },
          {
            id: "normal",
            folder: "nodeeconomy",
            demo: false,
            design: "dinero",
            kind: "explainer_kit",
            player: "protocol",
            title: "Prueba normal",
          },
        ],
      },
    ],
  }),
}));
vi.mock("../../explainer/components/SandboxDesignDemoCard", () => ({
  SandboxDesignDemoCard: ({ item }: { item: { title: string } }) => <p>{item.title} · Sandbox</p>,
}));

vi.mock("../../explainer/hooks/useExplainer", () => ({
  useCategoryDesigns: () => ({ data: null }),
  useExplainerVideos: () => ({
    data: [
      {
        videoId: "pending",
        title: "Video pendiente",
        design: "prototipo",
        designName: "PROTOTIPO",
        ready: true,
        rendered: [],
        demo: false,
      },
      {
        videoId: "done",
        title: "Video renderizado",
        design: "prototipo",
        designName: "PROTOTIPO",
        ready: true,
        rendered: [{ id: "render" }],
        demo: false,
      },
      {
        videoId: "demo",
        title: "Video demo",
        design: "binary",
        designName: "NODEHISTORY",
        ready: true,
        rendered: [],
        demo: true,
      },
    ],
    isLoading: false,
  }),
}));
vi.mock("../hooks/useImagePosts", () => ({
  useImagePosts: () => ({
    data: [
      { status: "draft", slides: [] },
      { status: "ready_for_review", slides: [] },
      { status: "approved", slides: [] },
    ],
    isLoading: false,
  }),
}));
vi.mock("../../explainer/components/ExplainerVideoCard", () => ({
  ExplainerVideoCard: ({ video }: { video: { title: string } }) => <p>{video.title}</p>,
}));
vi.mock("../../explainer/components/ProductionsList", () => ({
  ProductionsList: () => <p>Proceso de videos</p>,
}));
vi.mock("../../explainer/components/CreateExplainerVideoModal", () => ({
  CreateExplainerVideoModal: ({ open, categoryName }: { open: boolean; categoryName: string }) =>
    open ? <div role="dialog" aria-label={`Nuevo video de ${categoryName}`} /> : null,
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
afterEach(cleanup);

it("abre la creación desde la barra compacta sin mostrar la descripción de la categoría", () => {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ExplainerCategoryWindow category={category} posts={<p>Posts</p>} />
    </NextIntlClientProvider>,
  );
  expect(screen.queryByText(category.topic)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Crear video" }));
  expect(screen.getByRole("dialog", { name: "Nuevo video de NodeTech" })).toBeDefined();
});

it("comparte preparación y renderizados entre videos e imágenes sin filtros adicionales", () => {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ExplainerCategoryWindow category={category} posts={<PostView />} />
    </NextIntlClientProvider>,
  );
  const preparation = within(screen.getByRole("region", { name: "Preparación" }));
  expect(preparation.getByText("Video pendiente")).toBeDefined();
  expect(preparation.getByRole("button", { name: "Preparación (2)" })).toBeDefined();
  expect(preparation.getByRole("button", { name: "Renderizados (1)" })).toBeDefined();
  expect(preparation.queryByText("1 video")).toBeNull();
  expect(preparation.queryByText("PROTOTIPO")).toBeNull();
  const video = preparation.getByText("Video pendiente");
  const separator = preparation.getByText("Demos de diseño");
  const demo = preparation.getByText("Video demo");
  expect(video.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(separator.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(preparation.getByRole("button", { name: "Renderizados (1)" }));
  expect(preparation.getByText("Video renderizado")).toBeDefined();
  expect(preparation.queryByText("Video pendiente")).toBeNull();
  expect(preparation.queryByText("Demos de diseño")).toBeNull();
  fireEvent.mouseDown(preparation.getByRole("tab", { name: "Imágenes" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(preparation.getByText("Estado de imágenes: rendered")).toBeDefined();
  expect(preparation.getByRole("button", { name: "Renderizados (2)" })).toBeDefined();
  fireEvent.click(preparation.getByRole("button", { name: "Preparación (1)" }));
  expect(preparation.getByText("Estado de imágenes: preparation")).toBeDefined();
  fireEvent.mouseDown(preparation.getByRole("tab", { name: "Videos" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(preparation.getByText("Video pendiente")).toBeDefined();
});

it("muestra la demo de Sandbox en su categoría sin promoverla ni mezclarla con los videos", () => {
  const economy = {
    ...category,
    id: "node_economy",
    path: "node_economy",
    displayName: "NodeEconomy",
  };
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ExplainerCategoryWindow category={economy} />
    </NextIntlClientProvider>,
  );
  const preparation = within(screen.getByRole("region", { name: "Preparación" }));
  expect(preparation.getByRole("button", { name: "Preparación (3)" })).toBeDefined();
  const separator = preparation.getByText("Demos de diseño");
  expect(preparation.queryByText("Demo duplicada · Sandbox")).toBeNull();
  expect(preparation.queryByText("Prueba normal · Sandbox")).toBeNull();
  const sandboxDemo = preparation.getByText("Demo Economía · Sandbox");
  expect(
    separator.compareDocumentPosition(sandboxDemo) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(preparation.getByRole("button", { name: "Renderizados (1)" }));
  expect(preparation.queryByText("Demo Economía · Sandbox")).toBeNull();
});
