(() => {
  const CHANNEL = "nexa-connect-v1";
  const ALLOWED_ORIGINS = new Set([
    "https://dev-nexa-brief.everdev.space",
    "https://nexa-brief.everdev.space",
    "http://192.168.20.3:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      !ALLOWED_ORIGINS.has(event.origin) ||
      event.data?.channel !== CHANNEL ||
      event.data?.direction !== "request" ||
      typeof event.data?.requestId !== "string"
    ) return;

    const { requestId, action, payload } = event.data;
    chrome.runtime.sendMessage({ channel: CHANNEL, requestId, action, payload }).then(
      (response) => window.postMessage({ channel: CHANNEL, direction: "response", requestId, response }, event.origin),
      (error) => window.postMessage({
        channel: CHANNEL,
        direction: "response",
        requestId,
        response: { ok: false, error: error?.message || "Nexa Connect no pudo completar la solicitud." },
      }, event.origin),
    );
  });
})();
