import { catalogUrl } from "../lib/kit-urls";
import type { CatalogContext } from "../types";

/** Cada consulta es independiente y libera todos sus recursos al terminar. */
export function loadStageCatalog(
  designId: string,
  context: CatalogContext,
  signal?: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Consulta cancelada", "AbortError"));
      return;
    }
    const url = catalogUrl(designId, context);
    const frame = document.createElement("iframe");
    frame.hidden = true;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      signal?.removeEventListener("abort", abort);
      frame.remove();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Consulta cancelada", "AbortError"));
    };
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow ||
        event.data?.type !== "kit-design-catalog" ||
        event.data?.design !== designId
      )
        return;
      cleanup();
      if (!Array.isArray(event.data.components)) reject(new Error("Catálogo inválido"));
      else resolve(event.data.components);
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Tiempo agotado al cargar el catálogo de ${designId}`));
    }, 30000);
    window.addEventListener("message", receive);
    signal?.addEventListener("abort", abort, { once: true });
    frame.src = url;
    document.body.appendChild(frame);
  });
}
