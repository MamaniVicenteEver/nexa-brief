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
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
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
  // `next dev` abierto desde otra máquina (IP de LAN/Tailscale): ALLOWED_DEV_ORIGINS=100.x.x.x,otra
  // The public tunnel host follows PUBLIC_APP_URL; optional extra local hosts remain supported.
  allowedDevOrigins: [...new Set([...extraDevOrigins, ...(publicAppHost ? [publicAppHost] : [])])],
};

export default withNextIntl(nextConfig);
