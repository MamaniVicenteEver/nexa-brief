import { describe, expect, it } from "vitest";
import type { ExplainerVideo } from "@/features/explainer/types";
import type { SandboxFolder } from "@/features/sandbox/types";
import { sandboxDesignDemos } from "./sandbox-design-demos";

const folders = [{ folder: "nodehistory", role: "projects", categoryId: "node_history", items: [{
  id: "atlas-en-movimiento", title: "atlas-en-movimiento", kind: "proto", demo: false,
  player: "protocol", path: "sandbox/nodehistory/atlas-en-movimiento", thumbnailUrl: "/cached.jpg",
}] }] as SandboxFolder[];
const designs = [{ id: "atlas-en-movimiento", name: "Atlas en Movimiento" }];

describe("sandboxDesignDemos", () => {
  it("shows the existing playable demo in the category of its registered design", () => {
    const result = sandboxDesignDemos(folders, "node_atlas", [], designs);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Atlas en Movimiento", design: "atlas-en-movimiento", thumbnailUrl: "/cached.jpg" });
    expect(sandboxDesignDemos(folders, "node_history", [], [])).toHaveLength(0);
  });
  it("does not duplicate a design with a production demo", () => {
    const videos = [{ demo: true, design: "atlas-en-movimiento" }] as ExplainerVideo[];
    expect(sandboxDesignDemos(folders, "node_atlas", videos, designs)).toHaveLength(0);
  });
});
