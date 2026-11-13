import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftThumbnailArtwork } from "../components/record/DraftThumbnailArtwork";
import type { DraftThumbnailManifest } from "../hooks/useDraftThumbnailEditor";

function manifest(text: string): DraftThumbnailManifest {
  return {
    draftId: "one",
    fingerprint: "abc",
    selected: "A",
    urls: {},
    options: { A: { text, design: {} }, B: { text: "B", design: {} } },
  };
}
afterEach(() => {
  cleanup();
  delete window.NexaDraftThumbnailRenderer;
  vi.unstubAllGlobals();
});
describe("thumbnail image replacement", () => {
  it("keeps the decoded image visible while rendering its replacement", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode() {
          return Promise.resolve();
        }
      },
    );
    let resolve: (svg: string) => void = () => {};
    const renderSvgAsync = vi
      .fn()
      .mockResolvedValueOnce('<svg xmlns="http://www.w3.org/2000/svg"><text>first</text></svg>')
      .mockImplementationOnce(
        () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      );
    window.NexaDraftThumbnailRenderer = { version: 11, renderSvg: () => "", renderSvgAsync };
    const view = render(<DraftThumbnailArtwork manifest={manifest("first")} option="A" />);
    await waitFor(() => expect(screen.getByRole("img").getAttribute("src")).toContain("first"));
    const previous = screen.getByRole("img");
    const src = previous.getAttribute("src");
    view.rerender(<DraftThumbnailArtwork manifest={manifest("second")} option="A" />);
    await waitFor(() => expect(renderSvgAsync).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("img")).toBe(previous);
    expect(previous.getAttribute("src")).toBe(src);
    resolve('<svg xmlns="http://www.w3.org/2000/svg"><text>second</text></svg>');
    await waitFor(() => expect(screen.getByRole("img").getAttribute("src")).toContain("second"));
  });
  it("does not redraw A when only B changes", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode() {
          return Promise.resolve();
        }
      },
    );
    const renderSvgAsync = vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>');
    window.NexaDraftThumbnailRenderer = { version: 11, renderSvg: () => "", renderSvgAsync };
    const value = manifest("A");
    const view = render(<DraftThumbnailArtwork manifest={value} option="A" />);
    await waitFor(() => expect(renderSvgAsync).toHaveBeenCalledTimes(1));
    view.rerender(
      <DraftThumbnailArtwork
        manifest={{ ...value, options: { ...value.options, B: { text: "new B", design: {} } } }}
        option="A"
      />,
    );
    expect(renderSvgAsync).toHaveBeenCalledTimes(1);
  });
  it("updates the editorial B word limit when A becomes shorter", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode() {
          return Promise.resolve();
        }
      },
    );
    const renderSvgAsync = vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>');
    window.NexaDraftThumbnailRenderer = { version: 11, renderSvg: () => "", renderSvgAsync };
    const value = manifest("Gran final");
    value.options.B.design = { style: "promo-editorial" };
    const view = render(<DraftThumbnailArtwork manifest={value} option="B" />);
    await waitFor(() => expect(renderSvgAsync).toHaveBeenCalledTimes(1));
    expect(renderSvgAsync.mock.calls[0][0].options.B.design.maxWords).toBe(2);
    view.rerender(
      <DraftThumbnailArtwork
        manifest={{ ...value, options: { ...value.options, A: { text: "Final", design: {} } } }}
        option="B"
      />,
    );
    await waitFor(() => expect(renderSvgAsync).toHaveBeenCalledTimes(2));
    expect(renderSvgAsync.mock.calls[1][0].options.B.design.maxWords).toBe(1);
  });
});
