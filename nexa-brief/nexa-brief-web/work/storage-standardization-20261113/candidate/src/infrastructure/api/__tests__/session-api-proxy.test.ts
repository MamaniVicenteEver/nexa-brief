import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { forwardSessionApiRequest } from "../session-api-proxy";
import { forwardImagePostsRequest } from "../session-image-posts-proxy";

const mocked = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));
vi.mock("../../../../auth", () => ({ auth: mocked.auth }));

beforeEach(() => {
  vi.stubEnv("NEXA_INTERNAL_TOKEN", "synthetic-internal-key");
  vi.stubEnv("INTERNAL_API_URL", "http://internal.fixture:8000");
  vi.stubGlobal("fetch", mocked.fetch);
  mocked.auth.mockResolvedValue({ user: { email: " Owner@Example.Test ", role: "admin" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

const target = "http://web.fixture/api/showcase/designs/sandbox/projects/nodeaction/pizarra-demo";

it("requiere una sesión y una clave interna sin llamar al backend si faltan", async () => {
  mocked.auth.mockResolvedValue(null);
  expect((await forwardSessionApiRequest(new Request(target), "showcase")).status).toBe(401);
  mocked.auth.mockResolvedValue({ user: { email: "owner@example.test" } });
  vi.stubEnv("NEXA_INTERNAL_TOKEN", undefined);
  expect((await forwardSessionApiRequest(new Request(target), "showcase")).status).toBe(503);
  expect(mocked.fetch).not.toHaveBeenCalled();
});

it("rechaza una ruta que no pertenece al recurso autorizado", async () => {
  const response = await forwardSessionApiRequest(
    new Request("http://web.fixture/api/other"),
    "showcase",
  );
  expect(response.status).toBe(404);
  expect(mocked.fetch).not.toHaveBeenCalled();
});

it("envía la identidad y autorización del servidor y conserva el estado del backend", async () => {
  mocked.fetch.mockResolvedValue(
    new Response(JSON.stringify({ detail: "Proyecto no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "X-Nexa-Internal": "not-for-browser" },
    }),
  );
  const request = new Request(target, {
    method: "PUT",
    body: JSON.stringify({ visible: true }),
    headers: {
      "Content-Type": "application/json",
      "X-Nexa-Internal": "forged",
      "X-Nexa-Session-User": "forged@example.test",
    },
  });
  const response = await forwardSessionApiRequest(request, "showcase");
  expect(response.status).toBe(404);
  expect(response.headers.get("X-Nexa-Internal")).toBeNull();
  const [url, options] = mocked.fetch.mock.calls[0];
  expect(String(url)).toBe(
    "http://internal.fixture:8000/api/v1/showcase/designs/sandbox/projects/nodeaction/pizarra-demo",
  );
  expect(options.method).toBe("PUT");
  expect(options.headers.get("X-Nexa-Internal")).toBe("synthetic-internal-key");
  expect(options.headers.get("X-Nexa-Session-User")).toBe("owner@example.test");
  expect(options.headers.get("X-Nexa-Session-Role")).toBe("admin");
  expect(new TextDecoder().decode(options.body)).toBe('{"visible":true}');
  expect(await response.json()).toEqual({ detail: "Proyecto no encontrado" });
});

it("conserva la reescritura de previews de imágenes y publicaciones", async () => {
  for (const resource of ["image-posts", "publications"] as const) {
    mocked.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ preview_url: "/api/v1/image-posts/post/preview.jpg" }],
        }),
        { headers: { "Content-Type": "application/json", ETag: "fixture" } },
      ),
    );
    const response = await forwardImagePostsRequest(
      new Request(`http://web.fixture/api/${resource}/items`),
      resource,
    );
    expect(await response.json()).toEqual({
      items: [{ preview_url: "/api/image-posts/post/preview.jpg" }],
    });
    expect(response.headers.get("etag")).toBe("fixture");
    expect(mocked.fetch.mock.calls.at(-1)?.[1].body).toBeUndefined();
  }
});

it("conserva las respuestas binarias del proxy existente", async () => {
  mocked.fetch.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private" },
    }),
  );
  const response = await forwardImagePostsRequest(
    new Request("http://web.fixture/api/image-posts/preview"),
    "image-posts",
  );
  expect(response.status).toBe(206);
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  expect(response.headers.get("cache-control")).toBe("private");
});
