import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup } from "@testing-library/react";
import { useStandardShowcase } from "../hooks/useStandardShowcase";
import { standardShowcaseRepository } from "../api/standard-showcase-repository";

vi.mock("../api/standard-showcase-repository", () => ({ standardShowcaseRepository: {
  designs: vi.fn(), catalog: vi.fn(), promote: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("refreshes production categories, demos, counts and Sandbox after a successful move", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const categories = [
    ["templates", "catalog"], ["categories"], ["explainer-videos", "node_atlas"],
    ["explainer-sandbox"], ["sandbox-showcase-visibility"],
  ];
  for (const key of categories) client.setQueryData(key, { previous: true });
  vi.mocked(standardShowcaseRepository.designs).mockResolvedValue({ schema_version: 1, designs: [] });
  vi.mocked(standardShowcaseRepository.promote).mockResolvedValue({ id: "atlas-cinematico", state: "produccion" } as Awaited<ReturnType<typeof standardShowcaseRepository.promote>>);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useStandardShowcase(""), { wrapper });
  await waitFor(() => expect(hook.result.current.designs.isSuccess).toBe(true));
  await act(async () => { await hook.result.current.promote.mutateAsync("atlas-cinematico"); });
  for (const key of categories) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(standardShowcaseRepository.designs).toHaveBeenCalledTimes(2);
});

it("keeps production caches unchanged when passing to production fails", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(["templates", "catalog"], { previous: true });
  client.setQueryData(["categories"], { previous: true });
  vi.mocked(standardShowcaseRepository.designs).mockResolvedValue({ schema_version: 1, designs: [] });
  vi.mocked(standardShowcaseRepository.promote).mockRejectedValue(new Error("Faltan archivos del motor"));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useStandardShowcase(""), { wrapper });
  await waitFor(() => expect(hook.result.current.designs.isSuccess).toBe(true));
  await act(async () => {
    await expect(hook.result.current.promote.mutateAsync("atlas-cinematico")).rejects.toThrow("Faltan archivos del motor");
  });
  expect(client.getQueryState(["templates", "catalog"])?.isInvalidated).toBe(false);
  expect(client.getQueryState(["categories"])?.isInvalidated).toBe(false);
});
