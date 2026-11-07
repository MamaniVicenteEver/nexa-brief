import { afterEach, describe, expect, it, vi } from "vitest";
import { getImagePostDetail } from "../image-posts-service";

afterEach(() => vi.unstubAllGlobals());

function record(lastError: unknown) {
  // Shape emitted by GET /api/v1/image-posts/{post_id}; storage_key is omitted.
  return {
    publication_id: "pub_real",
    post_id: "img_real",
    revision: 2,
    record_version: 3,
    status: "published",
    editorial: { category_id: "node_tech", title: "Synthetic", sources: [], slides: [] },
    technical: {
      kind: "image",
      template_id: "daily_fact",
      composition_plan: { format: "4:5", slides: [] },
      slides: [
        {
          slide_id: "slide1",
          order: 1,
          asset_id: "slide-asset",
          preview_url: "/api/image-posts/pub_real/assets/slide-asset",
        },
      ],
      reel: {
        asset_id: "reel-asset",
        mime: "video/mp4",
        duration_sec: 12.5,
        sha256: "a".repeat(64),
      },
    },
    deliveries: [
      {
        delivery_id: "delivery1",
        platform: "instagram",
        account_alias: "sample",
        placement: "reel",
        status: "failed_permanent",
        last_error: lastError,
      },
    ],
  };
}

describe("contrato de detalle de imagen", () => {
  it("resuelve el reel por publication_id y conserva duración y error del backend", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/image-posts/img_real") {
        return Response.json(record({ code: "FAILED", message: "Error sintético" }));
      }
      if (url === "/api/publications/pub_real/assets/reel-asset/url?purpose=preview") {
        return Response.json({
          url: "/media/synthetic-reel",
          mime: "video/mp4",
          sha256: "a".repeat(64),
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await getImagePostDetail("img_real");
    expect(result.postId).toBe("img_real");
    expect(result.publicationId).toBe("pub_real");
    expect(result.technical.reel?.previewUrl).toBe("/media/synthetic-reel");
    expect(result.technical.reel?.durationSec).toBe(12.5);
    expect(result.deliveries[0].lastError).toBe("Error sintético");
    expect(result.slides[0].previewUrl).toBe("/api/image-posts/pub_real/assets/slide-asset");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("conserva last_error de texto heredado sin firmar cuando no hay asset", async () => {
    const data = record("Error heredado");
    const fetcher = vi.fn(async () =>
      Response.json({ ...data, technical: { ...data.technical, reel: null } }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await getImagePostDetail("img_real");
    expect(result.deliveries[0].lastError).toBe("Error heredado");
    expect(result.technical.reel).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
