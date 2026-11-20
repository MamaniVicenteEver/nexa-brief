import { expect, it } from "vitest";
import type { SandboxFolder } from "../types";
import { countSandboxItems, hideProductionDesignDemos } from "./sandbox-items";

it("hides only production design demos from project lists and counts", () => {
  const folders = [
    { role: "projects", folder: "nodehistory", items: [{ id: "atlas-en-movimiento" }, { id: "otro" }] },
    { role: "references", folder: "referencias", items: [{ id: "atlas-en-movimiento" }] },
  ] as SandboxFolder[];
  const result = hideProductionDesignDemos(folders, [
    { id: "atlas-en-movimiento", state: "produccion" },
    { id: "otro", state: "prueba" },
  ]);
  expect(result[0].items.map((item) => item.id)).toEqual(["otro"]);
  expect(countSandboxItems(result)).toBe(1);
  expect(result[1].items).toHaveLength(1);
  expect(folders[0].items).toHaveLength(2);
});
