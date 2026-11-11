import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { forwardSessionApiRequest } from "../session-api-proxy";

const mocked = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));
vi.mock("../../../../auth", () => ({ auth: mocked.auth }));

beforeEach(() => {
  vi.stubEnv("NEXA_INTERNAL_TOKEN", "synthetic-internal-key");
  vi.stubEnv("INTERNAL_API_URL", "http://internal.fixture:8000");
  vi.stubGlobal("fetch", mocked.fetch);
  mocked.auth.mockResolvedValue({ user: { email: "owner@example.test", role: "admin" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("returns a bodyless 204 after deleting an unused category through the authenticated proxy", async () => {
  mocked.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  const response = await forwardSessionApiRequest(new Request("http://web.fixture/api/categories/test", { method: "DELETE" }), "categories");
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(String(mocked.fetch.mock.calls[0][0])).toBe("http://internal.fixture:8000/api/v1/categories/test");
});

it("forwards design validation to the selected resource with server-owned authorization", async () => {
  mocked.fetch.mockResolvedValue(Response.json({ state: "queued" }, { status: 202 }));
  const response = await forwardSessionApiRequest(new Request("http://web.fixture/api/explainer/sandbox/nodepolitics/demo/production/validate", { method: "POST" }), "explainer");
  expect(response.status).toBe(202);
  expect(mocked.fetch.mock.calls[0][1].headers.get("X-Nexa-Internal")).toBe("synthetic-internal-key");
});
