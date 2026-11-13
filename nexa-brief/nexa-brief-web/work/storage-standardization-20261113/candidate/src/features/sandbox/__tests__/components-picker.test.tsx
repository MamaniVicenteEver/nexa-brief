import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SandboxComponentsPicker } from "../components/SandboxComponentsPicker";
import type { SandboxComponent } from "../types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/features/explainer/api/component-preview-service", () => ({
  requestComponentPreviews: request,
}));
const components: SandboxComponent[] = [
  {
    name: "atlas.outrov1",
    label: "Outro v1",
    summary: "Primer cierre",
    group: "outro",
    default: true,
  },
  { name: "atlas.outrov2", label: "Outro v2", summary: "Segundo cierre", group: "outro" },
  { name: "atlas.fichas", label: "Fichas", summary: "Mostrar fotos", default: true },
];
const onPreview = vi.fn();
function show(list = components) {
  return render(
    <SandboxComponentsPicker
      folder="nodehistory"
      id="atlas"
      components={list}
      onPreview={onPreview}
    />,
  );
}
beforeEach(() => {
  localStorage.clear();
  request.mockReset().mockResolvedValue([{ previewUrl: "/nueva" }]);
  onPreview.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("sin componentes no muestra controles ni hace pedidos", () => {
  show([]);
  expect(screen.queryByLabelText("Componentes")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
it("cambia el grupo y carga la URL devuelta", async () => {
  show();
  fireEvent.click(screen.getByRole("radio", { name: "Outro v2" }));
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith("/nueva"));
  expect(request.mock.calls[0][0][0]).toEqual({
    key: "sandbox",
    videoId: "atlas",
    component: "atlas.outrov2",
    scope: "sandbox",
    components: ["atlas.fichas", "atlas.outrov2"],
    params: {},
  });
  expect((screen.getByRole("radio", { name: "Outro v2" }) as HTMLInputElement).checked).toBe(true);
});
it("envía la selección explícita al apagar un interruptor", async () => {
  show();
  fireEvent.click(screen.getByRole("switch", { name: /Fichas/ }));
  await waitFor(() => expect(onPreview).toHaveBeenCalled());
  expect(request.mock.calls[0][0][0].components).toEqual(["atlas.outrov1"]);
  expect(screen.getByRole("switch", { name: /Fichas/ }).getAttribute("aria-checked")).toBe("false");
});
it("conserva la vista y la selección anterior si falla la API", async () => {
  request.mockRejectedValueOnce(new Error("fallo"));
  show();
  fireEvent.click(screen.getByRole("radio", { name: "Outro v2" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(onPreview).not.toHaveBeenCalled();
  expect((screen.getByRole("radio", { name: "Outro v1" }) as HTMLInputElement).checked).toBe(true);
});
it("recupera la elección y funciona con almacenamiento bloqueado", async () => {
  localStorage.setItem("sandbox-components:nodehistory:atlas", JSON.stringify(["atlas.outrov2"]));
  const first = show();
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith("/nueva"));
  expect(request.mock.calls[0][0][0].components).toEqual(["atlas.outrov2"]);
  first.unmount();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("bloqueado");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("bloqueado");
  });
  show();
  fireEvent.click(screen.getByRole("radio", { name: "Outro v2" }));
  await waitFor(() =>
    expect((screen.getByRole("radio", { name: "Outro v2" }) as HTMLInputElement).checked).toBe(
      true,
    ),
  );
});
