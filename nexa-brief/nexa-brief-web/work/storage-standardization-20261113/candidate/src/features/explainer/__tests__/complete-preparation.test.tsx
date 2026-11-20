import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { CompletePreparation } from "../components/CompletePreparation";
import { httpClient } from "@/infrastructure/api/http-client";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/infrastructure/api/http-client", () => ({ httpClient: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("opening the category reads state without invoking AI; only the button starts preparation", async () => {
  vi.mocked(httpClient).mockImplementation(async (_url, options) => options?.method === "POST"
    ? { state: "ready", issues: [], run_id: "controlled", model: "verified-test" }
    : { state: "pending", issues: [] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <CompletePreparation videoId="demo" /></QueryClientProvider>);
  await screen.findByText("states.pending");
  await waitFor(() => expect(screen.getByRole("button", { name: "start" }).hasAttribute("disabled")).toBe(false));
  expect(vi.mocked(httpClient).mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "start" }));
  await screen.findByText("states.ready");
  expect(httpClient).toHaveBeenCalledWith("/api/explainer/videos/demo/preparation", expect.objectContaining({ method: "POST", sameOrigin: true, body: { regenerate: false } }));
});
