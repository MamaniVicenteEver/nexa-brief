/** La selección visible del ejemplo permanece disponible cuando falla la copia. */
export async function copyText(text: string, container: HTMLElement = document.body): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // También intentar el método compatible con contextos HTTP o permisos denegados.
    }
  }
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  container.appendChild(input);
  try {
    input.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    if (previous?.isConnected) previous.focus();
  }
}
