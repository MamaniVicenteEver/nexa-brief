// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxAnimationPreview } from "../components/SandboxAnimationPreview";
import { SandboxCard } from "../components/SandboxModal";

const src = "https://preview.example.test/animation.html";
function ready(
  frame: HTMLIFrameElement,
  origin = new URL(src).origin,
  source: MessageEventSource | null = frame.contentWindow,
) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source,
        data: { type: "nexa-animation-ready" },
      }),
    ),
  );
}
beforeEach(() => vi.spyOn(document, "hidden", "get").mockReturnValue(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mount() {
  const result = render(
    <SandboxAnimationPreview
      title="Explosión"
      src={src}
      poster="/first-frame.jpg"
      bg="dark"
      waitForReady
      eager
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de Explosión" }));
  return result;
}
describe("Primer fotograma durante la preparación", () => {
  it("muestra el botón sobre la imagen y no carga el reproductor hasta pulsarlo", () => {
    render(
      <SandboxAnimationPreview
        title="Explosión"
        src={src}
        poster="/first-frame.jpg"
        bg="dark"
        eager
      />,
    );
    const button = screen.getByRole("button", { name: "Reproducir animación de Explosión" });
    expect(button.textContent).toBe("");
    expect(button.className).toContain("bg-white");
    expect(button.parentElement?.className).toContain("bottom-3 right-3");
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByAltText("Miniatura de Explosión").style.opacity).toBe("1");
  });
  it("mantiene el póster después de load y sólo muestra el lienzo cuando el reproductor confirma un fotograma", () => {
    mount();
    const frame = screen.getByTitle("Vista previa de Explosión") as HTMLIFrameElement;
    const poster = screen.getByAltText("Miniatura de Explosión");
    expect(frame.style.opacity).toBe("0");
    expect(poster.style.opacity).toBe("1");
    const stop = screen.getByRole("button", { name: "Detener animación de Explosión" });
    expect(stop.getAttribute("aria-busy")).toBe("true");
    expect((stop as HTMLButtonElement).disabled).toBe(false);
    fireEvent.load(frame);
    expect(frame.style.opacity).toBe("0");
    expect(poster.style.opacity).toBe("1");
    ready(frame);
    expect(frame.style.opacity).toBe("1");
    expect(poster.style.opacity).toBe("0");
    expect(stop.getAttribute("aria-busy")).toBe("false");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
  it("permite repetir y detener sin abrir la ficha de la tarjeta", () => {
    const open = vi.fn();
    render(
      <SandboxCard title="Otra" onOpen={open}>
        <SandboxAnimationPreview
          title="Otra"
          src={src}
          poster="/frame.jpg"
          bg="white"
          eager
          waitForReady
        />
      </SandboxCard>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de Otra" }));
    const frame = screen.getByTitle("Vista previa de Otra") as HTMLIFrameElement;
    ready(frame);
    fireEvent.click(screen.getByRole("button", { name: "Detener animación de Otra" }));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de Otra" }));
    expect(screen.getByTitle("Vista previa de Otra")).not.toBe(frame);
    ready(screen.getByTitle("Vista previa de Otra") as HTMLIFrameElement);
    fireEvent.click(screen.getByRole("button", { name: "Detener animación de Otra" }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByAltText("Miniatura de Otra").style.opacity).toBe("1");
    expect(open).not.toHaveBeenCalled();
  });
  it("ignora mensajes de otra página u origen", () => {
    mount();
    const frame = screen.getByTitle("Vista previa de Explosión") as HTMLIFrameElement;
    ready(frame, "https://other.example.test");
    ready(frame, new URL(src).origin, window);
    expect(frame.style.opacity).toBe("0");
    ready(frame);
    expect(frame.style.opacity).toBe("1");
  });
  it("un cambio de URL vuelve al póster y rechaza la confirmación del iframe anterior", () => {
    const { rerender } = mount();
    const old = screen.getByTitle("Vista previa de Explosión") as HTMLIFrameElement;
    const oldWindow = old.contentWindow;
    ready(old);
    rerender(
      <SandboxAnimationPreview
        title="Explosión"
        src={`${src}?bg=white`}
        poster="/first-frame.jpg"
        bg="white"
        waitForReady
        eager
      />,
    );
    expect(screen.queryByTitle("Vista previa de Explosión")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de Explosión" }));
    const frame = screen.getByTitle("Vista previa de Explosión") as HTMLIFrameElement;
    expect(frame.style.opacity).toBe("0");
    ready(frame, new URL(src).origin, oldWindow);
    expect(frame.style.opacity).toBe("0");
    ready(frame);
    expect(frame.style.opacity).toBe("1");
  });
  it("conserva el fotograma si la animación tarda o falla y permite reintentar", () => {
    vi.useFakeTimers();
    mount();
    const frame = screen.getByTitle("Vista previa de Explosión");
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByAltText("Miniatura de Explosión").style.opacity).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar animación de Explosión" }));
    expect(screen.getByTitle("Vista previa de Explosión")).not.toBe(frame);
    expect(screen.getByAltText("Miniatura de Explosión").style.opacity).toBe("1");
  });
  it("no reanuda una URL anterior al volver a su formato", () => {
    const { rerender } = mount();
    rerender(
      <SandboxAnimationPreview
        title="Explosión"
        src={`${src}?aspect=16x9`}
        poster="/first-frame.jpg"
        bg="dark"
        eager
      />,
    );
    rerender(
      <SandboxAnimationPreview
        title="Explosión"
        src={src}
        poster="/first-frame.jpg"
        bg="dark"
        eager
      />,
    );
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Reproducir animación de Explosión" })).toBeTruthy();
  });
  it("limita el trabajo simultáneo a tres animaciones y deja imágenes en las demás tarjetas", () => {
    const callbacks = new Map<Element, IntersectionObserverCallback>();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private cb: IntersectionObserverCallback) {}
        observe(element: Element) {
          callbacks.set(element, this.cb);
        }
        unobserve(element: Element) {
          callbacks.delete(element);
        }
        disconnect() {
          for (const [e, cb] of callbacks) if (cb === this.cb) callbacks.delete(e);
        }
      },
    );
    render(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((i) => (
        <SandboxAnimationPreview
          key={i}
          title={`Item ${i}`}
          src={`${src}?id=${i}`}
          poster={`/frame-${i}.jpg`}
          bg="white"
          waitForReady
        />
      )),
    );
    act(() => {
      for (const [target, callback] of callbacks)
        callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        );
    });
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    for (const name of ["a", "b", "c", "d"])
      fireEvent.click(screen.getByRole("button", { name: `Reproducir animación de Item ${name}` }));
    expect(document.querySelectorAll("iframe")).toHaveLength(3);
    expect(screen.queryByTitle("Vista previa de Item a")).toBeNull();
    expect(screen.getByRole("button", { name: "Reproducir animación de Item a" })).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(8);
    expect(screen.getAllByRole("img").every((img) => img.style.opacity === "1")).toBe(true);
  });
  it("mantiene una imagen al suspender la cuadrícula detrás de un modal", () => {
    const { rerender } = mount();
    ready(screen.getByTitle("Vista previa de Explosión") as HTMLIFrameElement);
    rerender(
      <SandboxAnimationPreview
        title="Explosión"
        src={src}
        poster="/first-frame.jpg"
        bg="dark"
        waitForReady
        eager
        suspended
      />,
    );
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(screen.getByAltText("Miniatura de Explosión").style.opacity).toBe("1");
  });
});
