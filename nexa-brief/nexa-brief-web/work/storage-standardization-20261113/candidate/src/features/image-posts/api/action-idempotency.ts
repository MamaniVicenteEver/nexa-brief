const STORAGE_PREFIX = "nexa:image-posts:idempotency:v1";
const memory = new Map<string, string>();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function slotFor(action: string, identity: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(identity));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${STORAGE_PREFIX}:${action}:${fingerprint}`;
}

function storedKey(slot: string): string | null {
  try {
    const value = window.localStorage.getItem(slot);
    if (value) return value;
  } catch {
    // El mapa en memoria cubre sesiones donde el navegador bloquea localStorage.
  }
  return memory.get(slot) ?? null;
}

function saveKey(slot: string, key: string): void {
  memory.set(slot, key);
  try {
    window.localStorage.setItem(slot, key);
  } catch {
    // El reintento sigue estable durante la sesión mediante el mapa en memoria.
  }
}

function clearKey(slot: string, key: string): void {
  if (storedKey(slot) !== key) return;
  memory.delete(slot);
  try {
    window.localStorage.removeItem(slot);
  } catch {
    // La respuesta ya llegó; no conservar una clave vencida en memoria.
  }
}

export async function withActionIdempotency<T>(
  action: string,
  identity: unknown,
  send: (key: string) => Promise<T>,
): Promise<T> {
  const slot = await slotFor(action, identity);
  const key = storedKey(slot) ?? crypto.randomUUID();
  saveKey(slot, key);
  try {
    const result = await send(key);
    clearKey(slot, key);
    return result;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status > 0
    ) {
      clearKey(slot, key);
    }
    throw error;
  }
}
