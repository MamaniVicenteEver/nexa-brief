import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import type { SandboxShowcaseState } from "../api/showcase-visibility";
import { SandboxShowcaseToggle } from "../components/SandboxShowcaseToggle";
import { SandboxWindow } from "../components/SandboxWindow";
import { useSandboxShowcase } from "../hooks/useSandboxShowcase";
import type { SandboxFolder, SandboxItem } from "../types";

const mocked = vi.hoisted(() => ({ folders: [] as SandboxFolder[] }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "es",
}));
vi.mock("@/features/prototypes", () => ({
  NewIdeaDialog: () => null,
  ReferenceChatActions: () => null,
}));
vi.mock("../hooks/useSandbox", () => ({
  SANDBOX_QUERY_KEY: ["explainer-sandbox"],
  useSandbox: () => ({ data: mocked.folders }),
}));
vi.mock("../components/PromoteButton", () => ({ PromoteButton: () => null }));
vi.mock("../components/SandboxPreviewModal", () => ({
  SandboxPreviewModal: ({
    children,
    showComponents,
  }: {
    children: ReactNode;
    showComponents: boolean;
  }) => <div data-show-components={String(showComponents)}>{children}</div>,
}));
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (value: string) => value,
}));

const initial: SandboxShowcaseState = {
  folder: "nodeaction",
  project_id: "pizarra-demo",
  design_id: "sandbox-fixture",
  visible: false,
  managed: true,
  component_count: 0,
};

function QueryState() {
  const result = useSandboxShowcase();
  return result.data?.[0] ? <SandboxShowcaseToggle state={result.data[0]} /> : <p>Cargando</p>;
}

function setup(child: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{child}</QueryClientProvider>);
}

beforeEach(() => {
  mocked.folders = [];
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("mantiene oculto el proyecto hasta pulsar el botón y permite revertirlo", async () => {
  let state = { ...initial };
  vi.mocked(httpClient).mockImplementation(async (_path, options) => {
    if (options?.method === "PUT") state = { ...state, ...(options.body as { visible: boolean }) };
    return (options?.method === "PUT" ? state : [state]) as never;
  });
  setup(<QueryState />);
  const show = await screen.findByRole("button", { name: "show" });
  expect(vi.mocked(httpClient).mock.calls.every(([, options]) => options?.method !== "PUT")).toBe(
    true,
  );
  fireEvent.click(show);
  await screen.findByRole("button", { name: "hide" });
  expect(httpClient).toHaveBeenCalledWith(
    "/api/showcase/designs/sandbox/projects/nodeaction/pizarra-demo",
    {
      method: "PUT",
      body: { visible: true },
      sameOrigin: true,
    },
  );
  expect(screen.getByRole("link", { name: "open" }).getAttribute("href")).toBe(
    "/showcase?section=prueba&design=sandbox-fixture",
  );
  expect(screen.getByText("pending")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "hide" }));
  await screen.findByRole("button", { name: "show" });
  expect(screen.queryByRole("link")).toBeNull();
});

it("no ofrece cambiar la visibilidad de los diseños que ya estaban registrados", async () => {
  vi.mocked(httpClient).mockResolvedValue([{ ...initial, managed: false, visible: true }]);
  setup(<QueryState />);
  await waitFor(() => expect(screen.queryByText("Cargando")).toBeNull());
  expect(screen.queryByRole("button")).toBeNull();
  expect(vi.mocked(httpClient).mock.calls.every(([, options]) => options?.method !== "PUT")).toBe(
    true,
  );
});

it("conserva la selección anterior cuando falla el guardado", async () => {
  vi.mocked(httpClient).mockImplementation(async (_path, options) => {
    if (options?.method === "PUT") throw new Error("fixture failure");
    return [initial] as never;
  });
  setup(<QueryState />);
  fireEvent.click(await screen.findByRole("button", { name: "show" }));
  expect((await screen.findByRole("alert")).textContent).toBe("saveError");
  expect(screen.getByRole("button", { name: "show" }).getAttribute("aria-pressed")).toBe("false");
});

it("Plantillas conserva los 22 proyectos y abre únicamente el principal", async () => {
  const items = Array.from(
    { length: 22 },
    (_, index): SandboxItem => ({
      id: `project-${index}`,
      folder: "nodeaction",
      subcategory: null,
      path: `sandbox/nodeaction/project-${index}`,
      title: `Proyecto ${index}`,
      kind: "nodeaction",
      status: null,
      design: null,
      hasIndex: true,
      hasPoster: false,
      hasInfo: true,
      hasComponents: true,
      totalTokens: null,
      thumbnailUrl: null,
      player: "protocol",
      videos: [],
      notesFile: null,
      updatedAt: null,
      promotable: false,
      promoteBlocker: null,
    }),
  );
  mocked.folders = [
    { folder: "nodeaction", label: "NodeAction", role: "projects", categoryId: null, items },
  ];
  vi.mocked(httpClient).mockResolvedValue([]);
  setup(<SandboxWindow />);
  expect(screen.getAllByRole("article")).toHaveLength(22);
  expect(document.querySelectorAll('[data-show-components="false"]')).toHaveLength(22);
  expect(document.querySelector('[data-show-components="true"]')).toBeNull();
  await waitFor(() => expect(httpClient).toHaveBeenCalled());
});
