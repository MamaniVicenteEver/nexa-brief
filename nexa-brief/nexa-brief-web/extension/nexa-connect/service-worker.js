const CHANNEL = "nexa-connect-v1";
const NEXA_ORIGINS = new Set([
  "https://dev-nexa-brief.everdev.space",
  "https://nexa-brief.everdev.space",
  "http://192.168.20.3:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const IMPORT_PATH = "/api/v1/publish/browser/tiktok/import/";

function isTikTokDomain(domain) {
  const normalized = String(domain || "").toLowerCase().replace(/^\./, "");
  return normalized === "tiktok.com" || normalized.endsWith(".tiktok.com");
}

async function getTikTokCookies() {
  const cookies = await chrome.cookies.getAll({ domain: "tiktok.com" });
  return cookies
    .filter((cookie) => isTikTokDomain(cookie.domain))
    .map((cookie) => ({
      ...cookie,
      hostOnly: typeof cookie.hostOnly === "boolean" ? cookie.hostOnly : !String(cookie.domain).startsWith("."),
    }));
}

function findIdentity(value, depth = 0) {
  if (!value || depth > 7) return null;
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findIdentity(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const user = value.user && typeof value.user === "object" ? value.user : value;
  const username = user.uniqueId || user.username || user.unique_id;
  if (username) {
    return {
      username: String(username).replace(/^@/, ""),
      nickname: String(user.nickname || user.displayName || username),
      avatarUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb || user.avatar_url || null,
    };
  }
  for (const child of Object.values(value)) {
    const found = findIdentity(child, depth + 1);
    if (found) return found;
  }
  return null;
}

async function getTikTokIdentity() {
  const cookies = await getTikTokCookies();
  if (!cookies.some((cookie) => cookie.name === "sessionid" && cookie.value)) {
    return { loggedIn: false };
  }

  const response = await fetch("https://www.tiktok.com/api/user/detail/?aid=1988&app_name=tiktok_web", {
    credentials: "include",
    headers: { accept: "application/json, text/plain, */*" },
  });
  if (!response.ok) throw new Error(`TikTok no respondió al consultar la cuenta (${response.status}).`);
  const identity = findIdentity(await response.json());
  if (!identity) throw new Error("TikTok no devolvió el nombre de usuario de esta sesión.");
  return { loggedIn: true, identity };
}

async function exportTikTokSession(payload) {
  const importUrl = new URL(String(payload?.importUrl || ""));
  if (
    !NEXA_ORIGINS.has(importUrl.origin) ||
    !importUrl.pathname.startsWith(IMPORT_PATH) ||
    !importUrl.searchParams.has("k") ||
    importUrl.hash
  ) {
    throw new Error("El enlace firmado de importación no pertenece a Nexa.");
  }
  const expectedUsername = String(payload?.expectedUsername || "").replace(/^@/, "");
  if (!expectedUsername) throw new Error("No se indicó la cuenta TikTok esperada.");

  const cookies = await getTikTokCookies();
  if (!cookies.some((cookie) => cookie.name === "sessionid" && cookie.value)) {
    return { loggedIn: false, error: "No hay una sesión activa de TikTok en este navegador." };
  }
  const response = await fetch(importUrl.href, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cookies, expected_username: expectedUsername }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Nexa rechazó la sesión (${response.status}).`);
  }
  return body;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.channel !== CHANNEL || typeof message?.requestId !== "string") return false;
  const handle = async () => {
    switch (message.action) {
      case "ping":
        return { version: chrome.runtime.getManifest().version };
      case "tiktok-identity":
        return getTikTokIdentity();
      case "tiktok-export":
        return exportTikTokSession(message.payload);
      default:
        throw new Error("Acción de Nexa Connect no reconocida.");
    }
  };

  handle().then(
    (result) => sendResponse({ ok: true, result }),
    (error) => sendResponse({ ok: false, error: error?.message || "Nexa Connect falló." }),
  );
  return true;
});
