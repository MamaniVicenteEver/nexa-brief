/* Logo editorial acompañado: se coloca dentro de una foto o un video, sin tarjeta. */
(function () {
  "use strict";
  const K = window.Kit;
  const positions = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const logoParams = {
    logo: { type: "image", default: "", doc: "SVG o PNG transparente en assets/media/logos/." },
    logoName: { type: "string", default: "", doc: "Marca; fallback tipográfico si no carga el archivo." },
    logoPos: { type: "enum", options: ["auto", ...positions], default: "auto", doc: "Esquina de la foto/video; auto evita el foco declarado." },
    logoSize: { type: "number", default: 0.22, min: 0.12, max: 0.35, doc: "Ancho relativo al medio; el logo conserva proporciones." },
    logoInvert: { type: "bool", default: false, doc: "Versión blanca para un logo oscuro sobre medio oscuro." },
  };
  function attach(ctx, p, rect, focus = [0.5, 0.5], parent = ctx.layers.dom) {
    if (!p.logo && !p.logoName) return null;
    const { x, y, w, h } = rect;
    const size = Math.min(0.35, Math.max(0.12, Number(p.logoSize) || 0.22));
    const width = Math.min(w * size, h * 0.55), height = Math.min(width * 0.56, h * 0.27);
    const pad = Math.max(ctx.stage.u * 1.3, Math.min(w, h) * 0.035);
    const fx = Number.isFinite(Number(focus[0])) ? Number(focus[0]) : 0.5;
    const fy = Number.isFinite(Number(focus[1])) ? Number(focus[1]) : 0.5;
    const corner = positions.includes(p.logoPos) ? p.logoPos :
      (fy < 0.5 ? "bottom" : "top") + "-" + (fx < 0.5 ? "right" : "left");
    const left = corner.endsWith("left") ? x + pad : x + w - width - pad;
    const top = corner.startsWith("top") ? y + pad : y + h - height - pad;
    const el = K.el("div", null, {
      position: "absolute", left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`,
      display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
      opacity: "0", filter: "drop-shadow(0 2px 5px rgba(0,0,0,.7))",
    }, parent);
    const label = () => {
      el.textContent = String(p.logoName || "");
      Object.assign(el.style, { color: "#fff", font: `800 ${Math.max(12, height * 0.48)}px ${ctx.C.fonts?.main || "Inter"}`, textAlign: "center", textShadow: "0 1px 3px #000" });
    };
    if (p.logo) {
      const img = K.el("img", null, { maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
        filter: p.logoInvert ? "brightness(0) invert(1)" : "none" }, el);
      img.alt = String(p.logoName || "");
      img.onerror = label;
      img.src = p.logo;
    } else label();
    return { render(lt) { el.style.opacity = String(Math.min(1, Math.max(0, (lt - 0.18) / 0.48))); }, dispose() { el.remove(); } };
  }
  K.brandLogo = { params: logoParams, attach };
  K.register({
    name: "common.logo", layer: "main", tags: ["logo", "obsoleto"],
    summary: "Obsoleto: el logo debe acompañar una foto o video con el parámetro logo del componente visual.",
    example: {},
    params: { src: { type: "image", default: "" }, name: { type: "string", default: "" } },
    create() { return { render() {} }; },
  });
})();
