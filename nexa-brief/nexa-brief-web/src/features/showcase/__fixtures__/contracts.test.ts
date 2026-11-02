import { describe, expect, it } from "vitest";
import { catalogMessage, commonItem, component, designItem, designs, unavailableItem, videoItem } from "./contracts";

describe("fixtures contractuales de showcase", () => {
  it("representan claves inequívocas y preservan la procedencia", () => {
    expect(designItem.key).toBe(`design:${JSON.stringify([designItem.designId, component.name])}`);
    expect(videoItem.key).toBe(`video:${JSON.stringify([videoItem.source?.video, videoItem.source?.source, component.name])}`);
    expect(unavailableItem.source?.source).toBeNull();
    expect(unavailableItem.unavailableReason).toBeTruthy();
  });

  it("cubren familia distinta de ID, componentes comunes y opciones heterogéneas", () => {
    expect(designs[1].family).not.toBe(designs[1].id);
    expect(catalogMessage.components).toContain(commonItem.component);
    expect(component.params.variante.options).toEqual(["clara", 2, false, { id: "oscura" }, null]);
  });
});
