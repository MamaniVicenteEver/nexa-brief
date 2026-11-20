/* Runtime exclusivo de imágenes: vista previa editable y exportación usan este mismo código. */
(function () {
  window.createImageStage = function ({design, catalog} = {}) {
    const wait = promise => Promise.resolve(promise);
    return {
          ready: true,
          design,
          catalog,
          lastPayload: null,
          async render(payload) {
            this.lastPayload = payload;
            const root = document.getElementById("stage");
            root.replaceChildren();
            root.style.width = payload.width + "px";
            root.style.height = payload.height + "px";
            const fontFaces = (payload.style.fonts.font_assets || []).map(asset => {
              const encoded = payload.fonts[asset.path];
              if (!encoded) throw new Error("Falta la fuente " + asset.path);
              const style = asset.style || "normal";
              const format = payload.font_formats?.[asset.path] === "woff2" ? "woff2" : "truetype";
              const mime = format === "woff2" ? "font/woff2" : "font/ttf";
              return "@font-face{font-family:'" + asset.family.replace(/'/g, "") + "';font-style:" + style +
                ";font-weight:" + asset.weight + ";src:url(data:" + mime + ";base64," + encoded + ") format('" + format + "');font-display:block;}";
            }).join("");
            let fontStyle = document.getElementById("image-fonts");
            if (!fontStyle) {
              fontStyle = document.createElement("style");
              fontStyle.id = "image-fonts";
              document.head.appendChild(fontStyle);
            }
            fontStyle.textContent = fontFaces;
            const fonts = payload.style.fonts;
            const css = document.documentElement.style;
            css.setProperty("--headline", "'" + fonts.headline + "', sans-serif");
            css.setProperty("--body", "'" + fonts.body + "', sans-serif");
            css.setProperty("--mono", "'" + fonts.mono + "', monospace");
            css.setProperty("--decorative", "'" + fonts.decorative + "', serif");
            const slide = payload.plan.slides[payload.slide_index];
            if (!slide) throw new Error("Índice de lámina fuera de rango");
            const component = window.ImagePostComponents && window.ImagePostComponents[payload.style.design_id];
            if (!component || !payload.style.composition.allowed_components.includes(component.nameFor(payload.plan.template_id))) {
              throw new Error("El estilo no permite el componente de salida");
            }
            const stage = component.renderSlide(slide, {
              plan: payload.plan,
              style: payload.style,
              media: payload.media,
              width: payload.width,
              height: payload.height,
              progress: payload.progress || 0,
              slideIndex: payload.slide_index,
              mode: payload.mode || "image"
            });
            root.appendChild(stage);
            await wait(document.fonts.ready);
            await Promise.all(Array.from(root.querySelectorAll("img")).map(image => image.decode()));
            for (const text of root.querySelectorAll(".fit-text")) {
              const minimum = Number(text.dataset.minSize || 18);
              let size = parseFloat(getComputedStyle(text).fontSize);
              while (size > minimum && (text.scrollHeight > text.clientHeight + 2 || text.scrollWidth > text.clientWidth + 2)) {
                size -= 2;
                text.style.fontSize = size + "px";
              }
            }
            component.afterLayout?.(stage);
            return this.qc();
          },
          qc() {
            const root = document.getElementById("stage");
            const text = Array.from(root.querySelectorAll(".fit-text"));
            // Nombre del bloque que no entró (data-block del motor): el error dice dónde mirar.
            const overflowing = text.filter(node =>
              node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2
            ).map(node => node.dataset.block || node.className);
            const frame = root.querySelector(".ie-frame");
            if (frame && window.ImageEngine?.overflowsColumn(frame)) overflowing.push("columna completa");
            const overflow = overflowing.length > 0;
            const tooSmall = text.some(node => Number.parseFloat(getComputedStyle(node).fontSize) < Number(node.dataset.minSize || 18));
            const palette = this.lastPayload.style.palette;
            const required = Number(this.lastPayload.style.composition.contrast_min);
            const ratio = (foreground, background) => {
              const channel = value => {
                const rgb = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
                const linear = rgb.map(item => item <= .04045 ? item / 12.92 : Math.pow((item + .055) / 1.055, 2.4));
                return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
              };
              const a = channel(foreground), b = channel(background);
              return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
            };
            const contrast = ratio(palette.ink, palette.bg) >= required &&
              ratio(palette.ink, palette.bg2) >= required &&
              ratio(palette.accentInk, palette.accent) >= required &&
              ratio(palette.muted, palette.bg2) >= required;
            const readable = !tooSmall && text.every(node => node.textContent.trim().length > 0);
            return {overflow, overflow_blocks: overflowing, contrast, readability: readable, text_blocks: text.length};
          },
          setProgress(progress) {
            const image = document.querySelector("#stage .photo-frame img");
            if (image) image.style.transform = "scale(" + (1 + Math.max(0, Math.min(1, progress)) * .05) + ")";
          }
        };
  };
})();
