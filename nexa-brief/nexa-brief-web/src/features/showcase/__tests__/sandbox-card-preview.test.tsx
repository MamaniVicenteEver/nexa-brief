import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SandboxCardPreview } from "../components/SandboxCardPreview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("reproducción de tarjetas Sandbox", () => {
  it("arranca en silencio al recibir ready del iframe y rechaza mensajes ajenos", () => {
    render(<SandboxCardPreview src="/preview?controls=1" title="Episodio" format="9x16" />);
    const frame = screen.getByTitle("Episodio") as HTMLIFrameElement;
    const send = vi.spyOn(frame.contentWindow!, "postMessage");
    const ready = (source: MessageEventSource, origin: string) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source,
          origin,
          data: { type: "nexa-template-ready" },
        }),
      );
    ready(window, window.location.origin);
    ready(frame.contentWindow!, "https://ajeno.example");
    expect(send).not.toHaveBeenCalled();
    ready(frame.contentWindow!, window.location.origin);
    expect(send.mock.calls).toEqual([
      [{ type: "nexa-template-volume", muted: true, volume: 0 }, window.location.origin],
      [{ type: "nexa-template-playback", playing: true }, window.location.origin],
    ]);
  });
});
