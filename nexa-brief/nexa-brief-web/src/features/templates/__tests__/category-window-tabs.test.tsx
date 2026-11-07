import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/features/categories";
import messages from "../../../../messages/es.json";
import { CategoryWindowTabs } from "../components/CategoryWindowTabs";

vi.mock("@/features/explainer", () => ({
  useCategoryDesigns: () => ({ data: { designs: [] } }),
  useExplainerVideos: () => ({ data: [] }),
}));
vi.mock("../../sandbox/hooks/useSandbox", () => ({ useSandbox: () => ({ data: [] }) }));

const categories: CategoryNode[] = ["NodeTech", "NodeHistory"].map((name) => ({
  id: name.toLowerCase(),
  path: name.toLowerCase(),
  displayName: name,
  topic: "Descripción",
  status: "active",
  engine: "explainer_kit",
  children: [],
  niches: [],
  designs: [],
  strategy: null,
}));
function Harness() {
  const [selected, setSelected] = useState("nodetech");
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      <CategoryWindowTabs
        categories={categories}
        selectedId={selected}
        templateCount={0}
        onSelect={setSelected}
      />
    </NextIntlClientProvider>
  );
}
afterEach(cleanup);
it("navega por las categorías y Sandbox con flechas, Inicio y Fin sin perder el foco", () => {
  render(<Harness />);
  const tabs = within(screen.getByRole("tablist", { name: "Categorías principales" }));
  const tech = tabs.getByRole("tab", { name: /^NodeTech/ });
  const history = tabs.getByRole("tab", { name: /^NodeHistory/ });
  const sandbox = tabs.getByRole("tab", { name: /^Sandbox/ });
  fireEvent.keyDown(tech, { key: "ArrowRight" });
  expect(history.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(history);
  fireEvent.keyDown(history, { key: "End" });
  expect(sandbox.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(sandbox);
  fireEvent.keyDown(sandbox, { key: "ArrowRight" });
  expect(tech.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(tech, { key: "ArrowLeft" });
  expect(sandbox.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(sandbox, { key: "Home" });
  expect(tech.getAttribute("tabindex")).toBe("0");
  expect(history.getAttribute("tabindex")).toBe("-1");
});
