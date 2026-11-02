import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogMessage,
  component,
  context,
  designDtos,
  designIndexDto,
  designs,
  libraryDto,
  videoItem,
} from "../__fixtures__/contracts";
import { KitShowcaseRepository } from "../api/kit-showcase-repository";
import { loadStageCatalog } from "../api/kit-stage-transport";
import { ShowcasePreviewError } from "../api/showcase-repository";

const repo = new KitShowcaseRepository();
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});
function mockFetch(values: unknown[]) {
  let index = 0;
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(values[index++]), { status: 200 }));
}

describe("repositorio del kit", () => {
  it("conserva el orden del índice y valida las respuestas", async () => {
    const fetcher = mockFetch([designIndexDto, ...designDtos]);
    expect(await repo.getDesigns()).toEqual(designs);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("designs/index.json"),
      expect.objectContaining({ cache: "no-cache" }),
    );
  });
  it("conserva duplicados con claves inequívocas e informa fuentes inválidas", async () => {
    mockFetch([
      {
        components: [libraryDto.components[0], libraryDto.components[0], libraryDto.components[1]],
      },
    ]);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = await repo.getLibrary(designs);
    expect(items[0].key).not.toBe(items[1].key);
    expect(items[0].source).toEqual(videoItem.source);
    expect(items[2].unavailableReason).toBeTruthy();
    expect(warning).toHaveBeenCalled();
  });
  it("construye previews con comunes faltantes y rechaza rutas peligrosas", () => {
    const url = new URL(repo.previewUrl(videoItem, context, "modal"), window.location.origin);
    expect(url.searchParams.getAll("js")).toEqual([
      "../designs/common/clip.js",
      "../../../nodetech/ejemplo/assets/components/tarjeta.js",
    ]);
    expect(url.searchParams.get("clock")).toBe("synthetic");
    expect(() =>
      repo.previewUrl(
        {
          ...videoItem,
          source: {
            video: "nodetech/ejemplo",
            source: "nodetech/ejemplo/assets/components/%2e%2e/a.js",
          },
        },
        context,
        "card",
      ),
    ).toThrow(ShowcasePreviewError);
  });
  it("propaga errores HTTP y abortos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await expect(repo.getDesigns()).rejects.toThrow("503");
    const controller = new AbortController();
    controller.abort();
    await expect(loadStageCatalog("rough", context, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  it("acepta documentación nula en el catálogo de biblioteca", async () => {
    mockFetch([
      {
        components: [
          { ...libraryDto.components[0], params: { campo: { type: "string", doc: null } } },
        ],
      },
    ]);
    const items = await repo.getLibrary(designs);
    expect(items[0].component.params.campo.doc).toBeNull();
  });
});

describe("transporte de catálogo", () => {
  it("ignora mensajes ajenos y limpia iframe y listener tras recibir catálogo", async () => {
    const promise = repo.getCatalog("rough", context);
    const frame = document.querySelector("iframe");
    if (!frame) throw new Error("Falta iframe");
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://other.test",
        source: frame.contentWindow,
        data: catalogMessage,
      }),
    );
    expect(document.querySelector("iframe")).toBe(frame);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: frame.contentWindow,
        data: { ...catalogMessage, design: "nuevo" },
      }),
    );
    expect(document.querySelector("iframe")).toBe(frame);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: frame.contentWindow,
        data: catalogMessage,
      }),
    );
    expect((await promise)[0].component).toEqual(component);
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("libera recursos al cancelar y al agotar el tiempo", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cancelled = loadStageCatalog("rough", context, controller.signal);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    expect(document.querySelector("iframe")).toBeNull();
    const timed = loadStageCatalog("rough", context);
    const assertion = expect(timed).rejects.toThrow("Tiempo agotado");
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(document.querySelector("iframe")).toBeNull();
  });
});
