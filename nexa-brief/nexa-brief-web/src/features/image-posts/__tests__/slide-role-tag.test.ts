import { describe, expect, it, vi, afterEach } from "vitest";
import { slideRoleTag } from "../slide-role-tag";
import { getImagePost, getPublicationDetail } from "../image-posts-service";

const plan = {
  slides: [
    {
      slide_id: "s3",
      layout: "amarillista:am_alto_close",
      texts: [{ role: "kicker", value: "NODETECH" }],
    },
    {
      slide_id: "s2",
      layout: "amarillista:am_alto_photo",
      texts: [{ role: "kicker", value: "QUÉ HACER" }],
    },
    {
      slide_id: "s1",
      layout: "amarillista:am_alto_photo",
      texts: [{ role: "kicker", value: "PORTADA" }],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("tags editoriales", () => {
  it("identifica cada lámina por ID y conserva la marca del cierre", () => {
    expect(slideRoleTag(plan, "s1")).toBe("Portada");
    expect(slideRoleTag(plan, "s2")).toBe("Qué hacer");
    expect(slideRoleTag(plan, "s3")).toBe("Final");
    expect(plan.slides[0].texts[0].value).toBe("NODETECH");
  });

  it("no inventa roles para planes anteriores o títulos de otras estrategias", () => {
    expect(slideRoleTag(undefined, "s1")).toBeNull();
    expect(slideRoleTag(plan, "unknown")).toBeNull();
    expect(
      slideRoleTag(
        {
          slides: [
            {
              slide_id: "s1",
              layout: "daily_fact:hero",
              texts: [{ role: "kicker", value: "Empleo" }],
            },
          ],
        },
        "s1",
      ),
    ).toBeNull();
  });

  it("lleva los tags a las vistas del editor y del archivo sin alterar la imagen", async () => {
    const record = {
      publication_id: "pub_tags",
      post_id: "img_tags",
      editorial: { category_id: "node_tech", slides: [] },
      technical: {
        composition_plan: plan,
        slides: [
          { slide_id: "s1", order: 1, asset_id: "a1", preview_url: "/clean.jpg" },
          { slide_id: "s3", order: 2, asset_id: "a3", preview_url: "/final.jpg" },
        ],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(record), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const post = await getImagePost("img_tags");
    const archive = await getPublicationDetail("pub_tags");
    for (const slides of [post.slides, archive.slides]) {
      expect(slides.map((s) => s.roleTag)).toEqual(["Portada", "Final"]);
      expect(slides.map((s) => s.previewUrl)).toEqual(["/clean.jpg", "/final.jpg"]);
    }
  });
});
