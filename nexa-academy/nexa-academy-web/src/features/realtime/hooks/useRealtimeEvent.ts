"use client";

import { useEffect, useRef } from "react";
import { socketClient } from "../lib/socket-client";

/** Subscribes to a realtime event `type` for the lifetime of the component.
 * `onEvent` doesn't need to be memoized — the latest reference is always
 * used, without resubscribing on every render. */
export function useRealtimeEvent<T = unknown>(type: string, onEvent: (data: T) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    return socketClient.subscribe(type, (data) => handlerRef.current(data as T));
  }, [type]);
}
