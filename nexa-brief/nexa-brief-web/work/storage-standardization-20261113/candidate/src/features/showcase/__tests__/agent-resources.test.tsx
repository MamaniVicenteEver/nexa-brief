import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentResources } from "../components/AgentResources";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("muestra documentos reales en tarjetas y solo descarga su contenido al abrirlos", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("agent-resources.json"))
      return {
        ok: true,
        json: async () => ({
          "production/rough": [
            "_tools/explainer-kit/designs/rough/QUICK.md",
            "_tools/explainer-kit/designs/rough/design.json",
          ],
        }),
      };
    return {
      ok: true,
      text: async () => (url.endsWith(".json") ? '{"id":"rough"}' : "# Instrucciones"),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<AgentResources resourceKey="production/rough" />);
  const markdown = await screen.findByRole("heading", { name: "QUICK.md" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(
    within(markdown.closest("article") as HTMLElement).getByRole("button", { name: "Ver archivo" }),
  );
  expect(await screen.findByText("# Instrucciones")).toBeTruthy();
  const json = screen.getByRole("heading", { name: "design.json" });
  fireEvent.click(
    within(json.closest("article") as HTMLElement).getByRole("button", { name: "Ver archivo" }),
  );
  expect(await screen.findByText(/"id": "rough"/)).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar recursos para agentes" }), {
    target: { value: "QUICK" },
  });
  expect(screen.queryByRole("heading", { name: "design.json" })).toBeNull();
});
