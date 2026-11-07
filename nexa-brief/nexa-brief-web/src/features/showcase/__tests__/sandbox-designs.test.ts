import { describe, expect, it } from "vitest";
import { groupSandboxDesigns } from "../lib/sandbox-designs";
import type { SandboxPrototype } from "../components/SandboxShowcase";

const episode = (id: string, design?: string, folder = "nodeaction"): SandboxPrototype => ({
  id,
  design,
  folder,
  path: `sandbox/${folder}/${id}`,
  title: id,
  subcategory: null,
  status: "lista",
  has_index: true,
  thumbnail_url: null,
  updated_at: null,
  components: [],
});
describe("diseños compartidos del sandbox", () => {
  it("muestra un diseño y conserva cada episodio, aunque la variante sea más reciente", () => {
    const variant = episode("vida-en-escena-heladeria", "vida-en-escena");
    const primary = episode("vida-en-escena", "vida-en-escena");
    const grouped = groupSandboxDesigns([variant, primary]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].path).toBe(primary.path);
    expect(grouped[0].episodes?.map((item) => item.id)).toEqual([primary.id, variant.id]);
    expect(primary.episodes).toBeUndefined();
  });
  it("no agrupa por prefijo ni mezcla categorías", () => {
    expect(
      groupSandboxDesigns([
        episode("vida"),
        episode("vida-otro"),
        episode("vida", "vida", "otra"),
        episode("vida-demo", "vida"),
      ]),
    ).toHaveLength(4);
  });
});
