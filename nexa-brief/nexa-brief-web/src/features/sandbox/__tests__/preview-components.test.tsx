import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SandboxPreviewModal } from "../components/SandboxPreviewModal";

const mocks = vi.hoisted(() => ({ components: [] as unknown[], request: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/useSandboxInfo", () => ({
  useSandboxInfo: () => ({ data: { info: { components: mocks.components } } }),
}));
vi.mock("../components/SandboxInfoSidebar", () => ({
  SandboxInfoSidebar: () => <div>Información</div>,
}));
vi.mock("@/features/explainer/api/component-preview-service", () => ({
  requestComponentPreviews: mocks.request,
}));
vi.mock("@/infrastructure/api/http-client", () => ({ resolveApiUrl: (url: string) => url }));
vi.mock("@/shared/components/media/MediaPlayerModal", () => ({
  MediaPlayerModal: ({
    open,
    onOpenChange,
    source,
    sidebar,
    trigger,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: { url: string };
    sidebar: ReactNode;
    trigger: ReactNode;
  }) => (
    <div>
      {trigger}
      <button type="button" onClick={() => onOpenChange(true)}>
        Abrir modal
      </button>
      {open && (
        <>
          <iframe title="Vista" src={source.url} />
          {sidebar}
        </>
      )}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  mocks.request.mockReset();
});
function show() {
  render(
    <SandboxPreviewModal
      target={{ kind: "iframe", url: "/original" }}
      title="Atlas"
      folder="nodehistory"
      id="atlas"
    >
      <button type="button">Abrir</button>
    </SandboxPreviewModal>,
  );
  fireEvent.click(screen.getByText("Abrir modal"));
}
it("sin declaración conserva la vista y no hace pedidos", () => {
  mocks.components = [];
  show();
  expect(screen.queryByLabelText("Componentes")).toBeNull();
  expect(mocks.request).not.toHaveBeenCalled();
  expect(screen.getByTitle("Vista").getAttribute("src")).toBe("/original");
});
it("actualiza el iframe con la URL de la API", async () => {
  mocks.components = [
    { name: "atlas.uno", label: "Uno", summary: "Primero", group: "outro", default: true },
    { name: "atlas.dos", label: "Dos", summary: "Segundo", group: "outro" },
  ];
  mocks.request.mockResolvedValue([{ previewUrl: "/otra" }]);
  show();
  fireEvent.click(screen.getByRole("radio", { name: "Dos" }));
  await waitFor(() => expect(screen.getByTitle("Vista").getAttribute("src")).toBe("/otra"));
});
