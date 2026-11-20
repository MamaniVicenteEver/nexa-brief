import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPlayerModal } from "../MediaPlayerModal";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

function mobileScreen(mobile: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: mobile }));
}

function openPlayer() {
  return render(
    <MediaPlayerModal
      open
      onOpenChange={vi.fn()}
      title="Demo"
      source={{ kind: "iframe", url: "/test-template.html" }}
    />,
  );
}

beforeEach(() => mobileScreen(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MediaPlayerModal", () => {
  it("opens in portrait on phones and keeps controls and close in expanded mode", async () => {
    mobileScreen(true);
    const requestFullscreen = vi.fn();
    vi.stubGlobal("requestFullscreen", requestFullscreen);
    openPlayer();
    expect(screen.getByRole("button", { name: "viewMobile" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "fullscreen" }));
    expect(
      screen.getByRole("button", { name: "exitFullscreen" }).getAttribute("aria-pressed"),
    ).toBe("true");
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(screen.getByRole("button", { name: "Close" }))).toBe(true);
    expect(dialog.contains(screen.getByRole("slider", { name: "progress" }))).toBe(true);
    expect(requestFullscreen).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "fullscreen" })).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("preserves the desktop default and requests fullscreen for the entire dialog", async () => {
    openPlayer();
    const dialog = screen.getByRole("dialog");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(dialog, "requestFullscreen", { value: requestFullscreen });
    expect(screen.getByRole("button", { name: "viewDesktop" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "fullscreen" }));
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
    expect(dialog.contains(screen.getByRole("button", { name: "Close" }))).toBe(true);
  });

  it("keeps an expanded fallback when the browser rejects native fullscreen", async () => {
    openPlayer();
    const dialog = screen.getByRole("dialog");
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("not supported"));
    Object.defineProperty(dialog, "requestFullscreen", { value: requestFullscreen });
    fireEvent.click(screen.getByRole("button", { name: "fullscreen" }));
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "exitFullscreen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "exitFullscreen" }));
    expect(screen.getByRole("button", { name: "fullscreen" })).toBeTruthy();
  });

  it("removes the preview iframe when closed", () => {
    const { rerender } = openPlayer();
    expect(screen.getByTitle("Demo")).toBeTruthy();
    rerender(<MediaPlayerModal open={false} onOpenChange={vi.fn()} title="Demo" source={null} />);
    expect(screen.queryByTitle("Demo")).toBeNull();
  });
});
