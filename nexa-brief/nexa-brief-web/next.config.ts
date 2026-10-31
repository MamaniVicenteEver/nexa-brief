import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const publicAppHost = (() => {
  const value = process.env.PUBLIC_APP_URL;
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
})();
const extraDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // The device link carries the secret in its query string; keep Next's dev
  // request logger from copying that URL into the terminal log.
  logging: {
    incomingRequests: {
      ignore: [/\/dev-access/],
    },
  },
  // Las ideas admiten adjuntos de hasta 300 MB por archivo; el límite por
  // defecto de Proxy (10 MB) truncaría los multipart antes de llegar a FastAPI.
  // proxyTimeout: el proxy corta a los 30 s por defecto y los textos de un explainer
  // (brief con Claude/Codex) tardan más; el cliente ya espera hasta 5 min.
  experimental: {
    proxyClientMaxBodySize: "1gb",
    proxyTimeout: 300_000,
  },
  // Mantiene /api/v1 en el origen público y reenvía HTTP + WebSocket al API local.
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
  // Tras entrar por HTTPS, el navegador recordará durante un día que este host
  // debe abrirse de forma segura, incluso si se escribe la URL sin esquema.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=86400" }],
      },
      // En `next dev` detrás de Cloudflare: sin esto Cloudflare fija 4 h de caché en el
      // navegador para los .js/.css y cada cambio se ve recién con Ctrl+Shift+R.
      ...(process.env.NODE_ENV === "development"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
            },
          ]
        : []),
    ];
  },
  output: "standalone",
  reactCompiler: true,
  // Extra LAN/Tailscale hosts can be listed in DEV_ALLOWED_ORIGINS. The default
  // includes localhost and the user's 192.168.20.x LAN.
  allowedDevOrigins: [
    ...new Set([
      "localhost",
      "127.0.0.1",
      "192.168.20.*",
      ...extraDevOrigins,
      ...(publicAppHost ? [publicAppHost] : []),
    ]),
  ],
};

export default withNextIntl(nextConfig);
