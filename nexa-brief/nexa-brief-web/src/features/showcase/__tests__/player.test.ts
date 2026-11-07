import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { component, context, playerComponentMessage, videoItem } from "../__fixtures__/contracts";
import type { ShowcaseRepository } from "../api/showcase-repository";
import { ShowcaseModal } from "../components/ShowcaseModal";
import { useShowcaseModal } from "../hooks/useShowcaseModal";
import { useStagePlayer } from "../hooks/useStagePlayer";
import { copyText } from "../lib/clipboard";
import { decodeStageMessage } from "../lib/messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("protocolo del reproductor", () => {
  let frame: HTMLIFrameElement;
  let other: HTMLIFrameElement;
  let send: ReturnType<typeof vi.spyOn>;
  const origin = window.location.origin;
  const dispatch = (
    data: unknown,
    source: MessageEventSource | null = frame.contentWindow,
    messageOrigin = origin,
  ) => {
    act(() =>
      window.dispatchEvent(new MessageEvent("message", { data, origin: messageOrigin, source })),
    );
  };
  beforeEach(() => {
    vi.useFakeTimers();
    frame = document.createElement("iframe");
    other = document.createElement("iframe");
    document.body.append(frame, other);
    if (!frame.contentWindow) throw new Error("No se creó la ventana del iframe");
    send = vi.spyOn(frame.contentWindow, "postMessage").mockImplementation(() => {});
  });
  it("valida mensajes y rechaza cargas incorrectas", () => {
    expect(decodeStageMessage(playerComponentMessage)).toEqual(playerComponentMessage);
    const nullableDoc = {
      type: "kit-stage-component",
      component: { ...component, params: { x: { type: "string", doc: null } } },
    };
    expect(decodeStageMessage(nullableDoc)).toEqual(nullableDoc);
    expect(
      decodeStageMessage({
        type: "kit-stage-component",
        component: { ...component, params: { x: { type: 4 } } },
      }),
    ).toBeNull();
    expect(
      decodeStageMessage({ type: "nexa-template-time", currentTime: 0, duration: Infinity }),
    ).toBeNull();
    expect(decodeStageMessage({ type: "nexa-template-state", playing: 1 })).toBeNull();
    expect(decodeStageMessage(null)).toBeNull();
  });
  it("aísla origen y frame, inicia una sola vez y conserva la metadata", () => {
    const onClose = vi.fn();
    const ref = { current: frame };
    const { result, unmount } = renderHook(() => useStagePlayer(ref, videoItem, onClose));
    dispatch(playerComponentMessage, other.contentWindow);
    dispatch({ type: "nexa-template-ready" }, frame.contentWindow, "https://otro.example");
    expect(result.current.status).toBe("loading");
    dispatch(playerComponentMessage);
    dispatch({ type: "nexa-template-ready" });
    dispatch({ type: "nexa-template-ready" });
    expect(result.current.status).toBe("playing");
    expect(result.current.component).toEqual(component);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "nexa-template-playback", playing: true }, origin);
    act(() => result.current.playPause());
    dispatch(playerComponentMessage);
    expect(result.current.status).toBe("paused");
    dispatch({ type: "kit-stage-close" }, other.contentWindow);
    expect(onClose).not.toHaveBeenCalled();
    dispatch({ type: "kit-stage-close" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    dispatch({ type: "kit-stage-close" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("permite abrir Imperio en pausa y comenzar con su botón sin reproducir al cargar", () => {
    const ref = { current: frame };
    const { result } = renderHook(() => useStagePlayer(ref, videoItem, () => {}, true));
    dispatch(playerComponentMessage);
    dispatch({ type: "nexa-template-ready" });
    expect(result.current.status).toBe("paused");
    expect(send).toHaveBeenCalledWith({ type: "nexa-template-playback", playing: false }, origin);
    expect(send).not.toHaveBeenCalledWith(
      { type: "nexa-template-playback", playing: true },
      origin,
    );
    act(() => result.current.playPause());
    expect(result.current.status).toBe("playing");
    expect(send).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: true },
      origin,
    );
  });
  it("pausa al terminar, usa duración reportada y reinicia desde cero", () => {
    const ref = { current: frame };
    const { result } = renderHook(() => useStagePlayer(ref, videoItem, () => {}));
    dispatch(playerComponentMessage);
    dispatch({ type: "nexa-template-ready" });
    dispatch({ type: "nexa-template-time", currentTime: 8, duration: 8 });
    dispatch({ type: "nexa-template-ended" });
    expect(result.current.status).toBe("ended");
    expect(send).toHaveBeenCalledWith({ type: "nexa-template-seek", time: 7.96 }, origin);
    expect(send).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: false },
      origin,
    );
    dispatch({ type: "nexa-template-state", playing: false });
    expect(result.current.status).toBe("ended");
    act(() => result.current.playPause());
    expect(result.current.status).toBe("playing");
    expect(send).toHaveBeenNthCalledWith(
      send.mock.calls.length - 1,
      { type: "nexa-template-seek", time: 0 },
      origin,
    );
    act(() => result.current.replay());
    expect(send).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: true },
      origin,
    );
  });
  it("sincroniza la línea de tiempo y limita los saltos a la duración", () => {
    const ref = { current: frame };
    const { result } = renderHook(() => useStagePlayer(ref, videoItem, () => {}));
    act(() => result.current.seek(3));
    expect(send).not.toHaveBeenCalled();
    dispatch(playerComponentMessage);
    dispatch({ type: "nexa-template-ready" });
    dispatch({ type: "nexa-template-time", currentTime: 2, duration: 6 });
    expect(result.current.time).toBe(2);
    expect(result.current.totalTime).toBe(6);
    act(() => result.current.playPause());
    act(() => result.current.seek(-5));
    expect(send).toHaveBeenLastCalledWith({ type: "nexa-template-seek", time: 0 }, origin);
    expect(result.current.status).toBe("paused");
    act(() => result.current.seek(50));
    expect(send).toHaveBeenLastCalledWith({ type: "nexa-template-seek", time: 6 }, origin);
    dispatch({ type: "nexa-template-ended" });
    act(() => result.current.seek(3));
    expect(result.current.status).toBe("paused");
    expect(result.current.time).toBe(3);
    const calls = send.mock.calls.length;
    act(() => result.current.seek(Number.NaN));
    expect(send).toHaveBeenCalledTimes(calls);
  });
  it("espera metadata y ready, permite reintento y limpia el timer", () => {
    const ref = { current: frame };
    const { result, unmount } = renderHook(() => useStagePlayer(ref, videoItem, () => {}));
    dispatch({ type: "nexa-template-ready" });
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.status).toBe("error");
    act(() => result.current.retry());
    expect(result.current.frameKey).toBe(1);
    expect(result.current.status).toBe("loading");
    dispatch(playerComponentMessage);
    dispatch({ type: "nexa-template-ready" });
    expect(result.current.status).toBe("playing");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("inicia una sola vez si la metadata llega después de ready", () => {
    const ref = { current: frame };
    const { result } = renderHook(() => useStagePlayer(ref, videoItem, () => {}));
    dispatch({ type: "nexa-template-ready" });
    expect(send).not.toHaveBeenCalled();
    dispatch(playerComponentMessage);
    dispatch(playerComponentMessage);
    expect(result.current.status).toBe("playing");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("ignora mensajes de la sesión anterior desde que se solicita un reintento", () => {
    const ref = { current: frame };
    const onClose = vi.fn();
    const { result } = renderHook(() => useStagePlayer(ref, videoItem, onClose));
    act(() => {
      result.current.retry();
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "kit-stage-close" },
          origin,
          source: frame.contentWindow,
        }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("modal y copia", () => {
  it("reinicia el formato al abrir cada elemento", () => {
    const { result } = renderHook(() => useShowcaseModal());
    act(() => {
      result.current.open(videoItem);
      result.current.setFormat("9x16");
    });
    expect(result.current.format).toBe("9x16");
    act(() => {
      result.current.close();
      result.current.open(videoItem);
    });
    expect(result.current.active).toEqual(videoItem);
    expect(result.current.format).toBe("16x9");
  });
  it("usa fallback y restaura foco, informa si no se puede copiar", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const original = document.execCommand;
    document.execCommand = vi.fn(() => true);
    expect(await copyText("ejemplo")).toBe(true);
    expect(document.activeElement).toBe(button);
    document.execCommand = vi.fn(() => false);
    expect(await copyText("ejemplo")).toBe(false);
    document.execCommand = original;
    expect(document.querySelector("textarea")).toBeNull();
  });
});

it("abre el diálogo, conserva el iframe al cambiar formato y restaura el foco al cerrar", async () => {
  const repo: ShowcaseRepository = {
    getDesigns: vi.fn(),
    getLibrary: vi.fn(),
    getCatalog: vi.fn(),
    previewUrl: () => "about:blank",
  };
  function Harness() {
    const [item, setItem] = useState<typeof videoItem | null>(null);
    const [format, setFormat] = useState("16x9");
    return createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => setItem(videoItem) }, "Abrir"),
      createElement(ShowcaseModal, {
        item,
        context,
        repo,
        format,
        onFormat: setFormat,
        onClose: () => setItem(null),
      }),
    );
  }
  render(createElement(Harness));
  const trigger = screen.getByRole("button", { name: "Abrir" });
  trigger.focus();
  fireEvent.click(trigger);
  const close = await screen.findByRole("button", { name: "Cerrar" });
  expect(document.activeElement).toBe(close);
  const frame = screen.getByTitle(
    `Vista previa de ${videoItem.component.name}`,
  ) as HTMLIFrameElement;
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: playerComponentMessage,
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    ),
  );
  expect(screen.getByText("Una tarjeta de ejemplo")).toBeTruthy();
  expect(screen.getByText("nodetech/ejemplo")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Móvil (9:16)" }));
  expect(screen.getByTitle(`Vista previa de ${component.name}`)).toBe(frame);
  fireEvent.click(close);
  await waitFor(() => expect(screen.queryByTitle(`Vista previa de ${component.name}`)).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
