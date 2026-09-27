"use client";

import { useEffect, useState } from "react";
import { socketClient } from "../lib/socket-client";

/** Live connection status of the shared realtime socket — true while a
 * WebSocket connection to the backend is open. Useful for a small debug
 * indicator, or to trigger a one-time cache refresh right after reconnecting
 * (covering whatever changed while the connection was down). */
export function useRealtimeStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return socketClient.subscribeStatus(setConnected);
  }, []);

  return connected;
}
