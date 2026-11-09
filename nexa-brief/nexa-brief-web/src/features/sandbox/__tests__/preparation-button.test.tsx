import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { PreparationButton } from "../components/PreparationButton";
import type { SandboxItem } from "../types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/infrastructure/api/http-client", () => ({ httpClient: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("inicia la preparación y muestra la propuesta pendiente de revisión", async () => {
  let running = false;
  vi.mocked(httpClient).mockImplementation(async (_url, options) => {
    if (options?.method === "POST") { running = true; return {} as never; }
    return (running ? [{ folder: "nodeaction", project_id: "vida-en-escena", state: "review", proposal: { title: "Título", description: "Borrador", missing: ["Revisar voz"] } }] : []) as never;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><PreparationButton item={{ folder: "nodeaction", id: "vida-en-escena" } as SandboxItem} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "prepareWithAgent" }));
  await waitFor(() => expect(screen.getByText("preparationReview")).toBeDefined());
  fireEvent.click(screen.getByText("preparationReview"));
  expect(screen.getByText("Revisar voz")).toBeDefined();
  expect(httpClient).toHaveBeenCalledWith("/api/v1/explainer/sandbox/nodeaction/vida-en-escena/preparation", expect.objectContaining({ method: "POST", body: { agent: "codex" } }));
});
