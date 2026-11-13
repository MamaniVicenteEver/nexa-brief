import { resolveWsUrl } from "@/infrastructure/api/http-client";

interface RealtimeEventFrame {
  type: string;
  data: unknown;
  ts: number;
}

type EventListener = (data: unknown) => void;
type StatusListener = (connected: boolean) => void;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** Generic, feature-agnostic WebSocket client: connects lazily on the first
 * subscriber, reconnects with backoff, and fans out parsed `{type, data}`
 * frames to whoever asked for that `type`. Has zero knowledge of channels,
 * notifications, or jobs — each feature maps its own payload shape, which
 * keeps this class portable to another project as-is. */
class SocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<EventListener>>();
  private statusListeners = new Set<StatusListener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private hasSubscribers(): boolean {
    if (this.statusListeners.size > 0) return true;
    for (const set of this.listeners.values()) {
      if (set.size > 0) return true;
    }
    return false;
  }

  private notifyStatus(connected: boolean): void {
    for (const callback of this.statusListeners) callback(connected);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.hasSubscribers()) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  private ensureConnected(): void {
    if (this.socket || typeof window === "undefined" || !this.hasSubscribers()) return;

    const socket = new WebSocket(resolveWsUrl("/api/v1/ws/events"));
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.notifyStatus(true);
    };

    socket.onmessage = (event) => {
      let frame: RealtimeEventFrame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      const callbacks = this.listeners.get(frame.type);
      if (!callbacks) return;
      for (const callback of callbacks) callback(frame.data);
    };

    socket.onclose = () => {
      this.socket = null;
      this.notifyStatus(false);
      this.scheduleReconnect();
    };

    socket.onerror = () => socket.close();
  }

  private disconnectIfIdle(): void {
    if (this.hasSubscribers()) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  subscribe(type: string, callback: EventListener): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(callback);
    this.ensureConnected();

    return () => {
      set?.delete(callback);
      this.disconnectIfIdle();
    };
  }

  subscribeStatus(callback: StatusListener): () => void {
    this.statusListeners.add(callback);
    callback(this.socket?.readyState === WebSocket.OPEN);
    this.ensureConnected();

    return () => {
      this.statusListeners.delete(callback);
      this.disconnectIfIdle();
    };
  }
}

// Stashed on `window` (not a plain module-level `const`) so Next.js Fast
// Refresh — which re-evaluates this module on every edit in dev — reuses the
// same socket instead of leaking a new one on each hot reload.
declare global {
  interface Window {
    __nexaRealtimeSocketClient?: SocketClient;
  }
}

function getSocketClient(): SocketClient {
  if (typeof window === "undefined") return new SocketClient();
  window.__nexaRealtimeSocketClient ??= new SocketClient();
  return window.__nexaRealtimeSocketClient;
}

export const socketClient = getSocketClient();
