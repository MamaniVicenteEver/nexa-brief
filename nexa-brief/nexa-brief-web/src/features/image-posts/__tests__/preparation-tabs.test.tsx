import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/features/categories";
import messages from "../../../../messages/es.json";
import { ExplainerCategoryWindow } from "../../explainer/components/ExplainerCategoryWindow";

vi.mock("../../explainer/hooks/useExplainer", () => ({
  useCategoryDesigns: () => ({ data: null }),
  useExplainerVideos: () => ({ data: [], isLoading: false }),
}));
vi.mock("../../explainer/components/ProductionsList", () => ({
  ProductionsList: () => <p>Proceso de videos</p>,
}));
vi.mock("../../explainer/components/CreateExplainerVideoModal", () => ({
  CreateExplainerVideoModal: () => null,
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

it("cambia videos y posts en Preparación y conserva el filtro de videos al volver", () => {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ExplainerCategoryWindow
        category={category}
        posts={<button type="button">Abrir portada del post</button>}
      />
    </NextIntlClientProvider>,
  );
  const preparation = within(screen.getByRole("region", { name: "Preparación" }));
  expect(preparation.queryByRole("button", { name: "Abrir portada del post" })).toBeNull();
  fireEvent.click(preparation.getByRole("tab", { name: "Renderizados · 0" }));
  fireEvent.mouseDown(preparation.getByRole("tab", { name: "Posts" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(preparation.getByRole("button", { name: "Abrir portada del post" })).toBeTruthy();
  expect(preparation.queryByRole("tab", { name: "Renderizados · 0" })).toBeNull();
  expect(
    screen.getByText("Proceso de videos").closest('[role="tabpanel"]')?.hasAttribute("hidden"),
  ).toBe(true);
  fireEvent.mouseDown(preparation.getByRole("tab", { name: "Videos" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(
    preparation.getByRole("tab", { name: "Renderizados · 0" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(preparation.queryByRole("button", { name: "Abrir portada del post" })).toBeNull();
});
