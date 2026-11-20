import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "../api/client";
import { fetchImageCodePreview } from "../api/image-post-preview-api";
import { CodeSlideFrame } from "../components/CodeSlideFrame";

vi.mock("../api/client", () => ({ requestJson: vi.fn() }));

afterEach(cleanup);

describe("vista editable de una lámina", () => {
  it("solicita el formato al motor y conserva cancelación de solicitudes", async () => {
    const signal = new AbortController().signal;
    await fetchImageCodePreview("img/source", "slide 2", "3:5", signal);
    expect(requestJson).toHaveBeenCalledWith(
      "/api/image-posts/img%2Fsource/preview?format=3%3A5&slide_id=slide+2",
      { signal },
    );
  });

  it("aísla el documento ejecutable sin acceso al origen y mantiene el lienzo nativo", () => {
    const html = "<!doctype html><html><body>Contenido editable</body></html>";
    render(<CodeSlideFrame html={html} width={1080} height={1920} title="Lámina editable" />);
    const frame = screen.getByTitle("Lámina editable");
    expect(frame.getAttribute("srcdoc")).toBe(html);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("style")).toContain("width: 1080px");
    expect(frame.getAttribute("style")).toContain("height: 1920px");
  });
});
