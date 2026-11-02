import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { decodeStageMessage, playbackCommand, seekCommand } from "../lib/messages";
import type { Component, Item } from "../types";

export type PlayerStatus = "loading" | "playing" | "paused" | "ended" | "error";
const READY_TIMEOUT_MS = 30_000;

export function useStagePlayer(
  frameRef: RefObject<HTMLIFrameElement | null>,
  item: Item,
  onClose: () => void,
) {
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [component, setComponent] = useState<Component>(item.component);
  const [frameKey, setFrameKey] = useState(0);
  const [time, setTime] = useState(0);
  const [totalTime, setTotalTime] = useState(6);
  const state = useRef<PlayerStatus>("loading");
  const duration = useRef(6);
  const ready = useRef(false);
  const metadata = useRef(false);
  const invalidated = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  const update = useCallback((next: PlayerStatus) => {
    state.current = next;
    setStatus(next);
  }, []);
  const send = useCallback(
    (message: ReturnType<typeof playbackCommand> | ReturnType<typeof seekCommand>) => {
      frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    },
    [frameRef],
  );

  // Un reintento desmonta el iframe y comienza una sesión nueva.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameKey identifica la sesión del iframe.
  useEffect(() => {
    ready.current = false;
    metadata.current = false;
    invalidated.current = false;
    duration.current = 6;
    setTime(0);
    setTotalTime(6);
    state.current = "loading";
    setStatus("loading");
    setComponent(item.component);
    const timer = window.setTimeout(() => update("error"), READY_TIMEOUT_MS);
    const start = () => {
      if (!ready.current || !metadata.current || state.current !== "loading") return;
      window.clearTimeout(timer);
      update("playing");
      send(playbackCommand(true));
    };
    const receive = (event: MessageEvent) => {
      if (
        invalidated.current ||
        event.origin !== window.location.origin ||
        !frameRef.current?.contentWindow ||
        event.source !== frameRef.current.contentWindow
      )
        return;
      const message = decodeStageMessage(event.data);
      if (!message) return;
      if (message.type === "kit-stage-close") {
        close.current();
        return;
      }
      if (state.current === "error") return;
      switch (message.type) {
        case "kit-stage-component":
          if (message.component.name !== item.component.name) break;
          metadata.current = true;
          setComponent((previous) => ({ ...previous, ...message.component }));
          start();
          break;
        case "nexa-template-ready":
          if (ready.current) break;
          ready.current = true;
          start();
          break;
        case "nexa-template-time":
          duration.current = message.duration;
          setTime(message.currentTime);
          setTotalTime(message.duration);
          break;
        case "nexa-template-state":
          if (ready.current && metadata.current && state.current !== "ended")
            update(message.playing ? "playing" : "paused");
          break;
        case "nexa-template-ended":
          if (!ready.current || !metadata.current || state.current === "ended") break;
          update("ended");
          setTime(duration.current);
          send(seekCommand(Math.max(0, duration.current - 0.04)));
          send(playbackCommand(false));
          break;
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
  }, [frameKey, frameRef, item, send, update]);

  const playPause = useCallback(() => {
    if (state.current === "ended") {
      setTime(0);
      send(seekCommand(0));
      update("playing");
      send(playbackCommand(true));
    } else if (state.current === "playing" || state.current === "paused") {
      const playing = state.current === "paused";
      update(playing ? "playing" : "paused");
      send(playbackCommand(playing));
    }
  }, [send, update]);
  const replay = useCallback(() => {
    if (state.current === "loading" || state.current === "error") return;
    setTime(0);
    send(seekCommand(0));
    update("playing");
    send(playbackCommand(true));
  }, [send, update]);
  const retry = useCallback(() => {
    invalidated.current = true;
    update("loading");
    setFrameKey((key) => key + 1);
  }, [update]);
  const seek = useCallback(
    (target: number) => {
      if (!Number.isFinite(target) || state.current === "loading" || state.current === "error")
        return;
      const next = Math.max(0, Math.min(target, duration.current));
      setTime(next);
      if (state.current === "ended") update("paused");
      send(seekCommand(next));
    },
    [send, update],
  );
  return { status, component, playPause, replay, retry, frameKey, time, totalTime, seek };
}
