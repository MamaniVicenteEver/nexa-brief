import type { Page } from "playwright";

/**
 * Instala un allowlist de red en una página de Playwright ANTES de navegar.
 *
 * A diferencia de `playwright_ffmpeg_adapter.py` en nexa-brief-server (que
 * usa `--disable-web-security` porque solo graba HTML generado por la propia
 * IA interna de Nexa Brief), acá el HTML puede venir de un tercero — bloquear
 * la salida de red por default y permitir solo el origen local efímero del
 * job más un allowlist explícito (fuentes de Google por default) es la
 * mitigación mínima antes de ejecutar JS ajeno.
 */
export function installNetworkGuard(page: Page, localOrigins: string[], allowlist: string[]): void {
  const allowedHosts = new Set(allowlist);

  page.route("**/*", (route) => {
    const url = new URL(route.request().url());

    if (localOrigins.includes(url.origin)) {
      route.continue();
      return;
    }

    if (url.protocol === "data:" || url.protocol === "blob:") {
      route.continue();
      return;
    }

    if (allowedHosts.has(url.hostname)) {
      route.continue();
      return;
    }

    route.abort("blockedbyclient");
  });
}
