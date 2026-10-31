/* Miniatura editorial: composición medida en píxeles del escenario. */
(function () {
  "use strict";
  const K = window.Kit, { clamp } = K;
  const RED = "#E10600", YELLOW = "#FFD400", BLACK = "#080808";
  const FONT_DIR = new URL("../../vendor/fonts/", document.currentScript.src);
  const FONT_URL = new URL("Anton-Regular.ttf", FONT_DIR).href;
  function fontReady() {
    if (!window.__antonReady) window.__antonReady = new FontFace("Anton", `url(${FONT_URL})`).load().then(f => { document.fonts.add(f); return f; });
    return window.__antonReady;
  }
  // Las mismas fuentes del diseño quedan disponibles también en capturas sin red.
  const LOCAL_FONTS = {"Inter":900,"Archivo":900,"Special Elite":400,"Cutive":400,"Fjalla One":400,
    "Oswald":700,"PT Sans Narrow":700,"Cormorant Garamond":700,"Cinzel":700,"EB Garamond":700,
    "Open Sans":700,"Montserrat":700,"Barlow":700};
  const loadedFonts = new Map();
  function brandFontReady(family) {
    if (!LOCAL_FONTS[family]) return document.fonts.load(`700 40px ${JSON.stringify(family)}`);
    if (!loadedFonts.has(family)) {
      const weight = LOCAL_FONTS[family], filename = `${family.replace(/ /g, "-")}-${weight}.ttf`;
      const url = new URL(filename, FONT_DIR).href;
      loadedFonts.set(family, new FontFace(family, `url(${url})`, {weight: String(weight)}).load().then(f => { document.fonts.add(f); return f; }));
    }
    return loadedFonts.get(family);
  }
  function luminance(color) {
    const m = /^#([\da-f]{6})$/i.exec(color || "");
    if (!m) return null;
    const rgb = [0,2,4].map(i => parseInt(m[1].slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  function contrast(a,b) {
    const x=luminance(a), y=luminance(b);
    return x == null || y == null ? 0 : (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  }
  const upper = s => String(s || "").toLocaleUpperCase("es").trim();
  const box = (x, y, w, h, type, extra = {}) => ({ x, y, w, h, type, ...extra });
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const inside = (a, w, h) => a.x >= 0 && a.y >= 0 && a.x + a.w <= w && a.y + a.h <= h;
  function groups(text, count, accent, measure) {
    const words = upper(text).split(/\s+/).filter(Boolean), full = words.join(" ");
    const start = accent ? full.indexOf(accent) : -1, end = start + accent.length;
    const offsets = []; let offset = 0;
    for (const word of words) { offset += word.length; offsets.push(offset); offset++; }
    const dp = Array.from({length: count + 1}, () => Array(words.length + 1).fill(null));
    dp[0][0] = {cost: 0, lines: []};
    for (let n=1; n<=count; n++) for (let j=n; j<=words.length; j++) for (let i=n-1; i<j; i++) {
      if (!dp[n-1][i] || (i && start >= 0 && offsets[i-1] >= start && offsets[i-1] < end)) continue;
      const line=words.slice(i,j).join(" "), width=measure(line), cost=dp[n-1][i].cost + width*width;
      if (!dp[n][j] || cost < dp[n][j].cost) dp[n][j]={cost,lines:[...dp[n-1][i].lines,line]};
    }
    return dp[count][words.length] ? [dp[count][words.length].lines] : [];
  }
  K.register({
    name: "common.tabloid", tags: ["miniatura", "intro", "alerta", "tabloide", "gancho"], layer: "main",
    summary: "Miniatura e intro tabloide con foto o video mudo; focus protege la zona de interés del medio.",
    example: { text: "TÚ ERES EL SIGUIENTE", accent: "SIGUIENTE", strap: "AMAZON · IA" },
    params: {
      text: { type: "string", required: true, doc: "Titular corto; máximo 6 palabras recomendado." },
      src: { type: "image", default: "", doc: "Foto opcional; también sirve de respaldo del video." }, srcAfter: { type: "image", default: "", doc: "Segunda foto del split." },
      video: { type: "video", default: "", doc: "Clip .mp4 local de assets/media; ocupa el lugar de src." },
      poster: { type: "image", default: "", doc: "Imagen del cuadro elegido para la miniatura y el instante inicial; si falta, usa src." },
      start: { type: "number", default: 0, min: 0, doc: "Segundo inicial del clip." },
      rate: { type: "number", default: 1, min: 0.25, max: 2, doc: "Velocidad del clip." },
      loop: { type: "bool", default: true, doc: "Repite el clip si termina antes que el beat; evita congelar." },
      muted: { type: "bool", default: true, doc: "El clip siempre se reproduce mudo; false se ignora por el contrato del motor." },
      accent: { type: "string", default: "", doc: "Frase destacada con el acento del diseño (rojo en alert)." }, bullet: { type: "string", default: "", doc: "Cifra y leyenda." },
      bulletScale: { type: "number", default: 1, min: 0.5, max: 1.5, doc: "Escala de la cifra y su recuadro." },
      beforeLabel: { type: "string", default: "", doc: "Etiqueta del antes." }, afterLabel: { type: "string", default: "", doc: "Etiqueta del después." },
      imageSide: { type: "enum", options: ["auto", "left", "right"], default: "auto", doc: "Lado de foto horizontal." },
      mode: { type: "enum", options: ["impact", "split"], default: "impact", doc: "Foto única o split." },
      palette: { type: "enum", options: ["brand", "alert"], default: "brand", doc: "Identidad del diseño o estilo clásico de alerta." },
      strap: { type: "string", default: "", doc: "Cintillo superior." }, seal: { type: "string", default: "", doc: "Sello opcional." },
      tapeText: { type: "string", default: "", doc: "Texto de cinta opcional." }, marker: { type: "bool", default: false, doc: "Marca alrededor del foco." },
      focus: { type: "array", default: null, doc: "[x,y,r] normalizados respecto al recorte visible de la foto; obligatorio para marcador o sello con foto." },
      target: { type: "array", default: [0.72, 0.52], doc: "Obsoleto: usar focus con radio." },
      textIn: { type: "enum", options: ["slam", "slide", "typewriter", "none"], default: "slam", doc: "Entrada de cada renglón del titular." },
      stagger: { type: "number", default: 0.16, min: 0, max: 1, doc: "Separación en segundos entre renglones." },
      accentIn: { type: "enum", options: ["slam", "slide", "typewriter", "none"], default: "slide", doc: "Entrada del acento después de su renglón." },
      bulletIn: { type: "enum", options: ["slam", "slide", "typewriter", "none"], default: "slam", doc: "Entrada de la cifra después del titular." },
      inDuration: { type: "number", default: 0.42, min: 0.05, max: 2, doc: "Duración en segundos de cada entrada." },
      ...K.brandLogo.params,
    },
    create(ctx, p) {
      p = { textIn: "slam", accentIn: "slide", bulletIn: "slam", stagger: .16, inDuration: .42, start: 0, rate: 1, loop: true, muted: true, ...p };
      const still = new URLSearchParams(location.search).has("tabloidStill");
      const { W, H, u, portrait } = ctx.stage, photo = Boolean(p.src || p.video || p.poster), side = !portrait && p.imageSide === "left" ? "left" : "right";
      const brand = p.palette !== "alert", config = ctx.C || K.design?.defaults || {}, colors = config.palette || {};
      const bg = brand ? (colors.bg || BLACK) : BLACK;
      const choices = [colors.ink, colors.accent, colors.paperHi, colors.nightInk, colors.accentInk, colors.paper, colors.night, colors.bg2, ...Object.values(colors)].filter(Boolean);
      const readable = choices.filter(color => contrast(color,bg) >= 4.5);
      const ink = brand ? (readable[0] || (contrast("#080808",bg) > contrast("#ffffff",bg) ? "#080808" : "#ffffff")) : YELLOW;
      const highlight = brand ? (contrast(colors.accent,bg) >= 4.5 ? colors.accent : ink) : "white";
      const configuredFont = config.fonts?.main || "Inter";
      const family = brand ? (config.family === "collage" && configuredFont === "Cormorant Garamond" ? "Cinzel" : configuredFont) : "Anton";
      const weight = brand ? (LOCAL_FONTS[family] || 700) : 400;
      const root = K.el("div", null, { position: "absolute", inset: "0", overflow: "hidden", background: bg, opacity: "0" }, ctx.layers.dom);
      root.setAttribute("aria-label", String(p.text || ""));
      if (brand) {
        const texture = config.family === "binary" ? `repeating-linear-gradient(0deg,transparent 0 23px,${ink}12 24px 25px)` :
          config.family === "rough" ? `repeating-linear-gradient(174deg,transparent 0 70px,${ink}10 71px 73px,transparent 74px 92px)` :
          `repeating-linear-gradient(96deg,transparent 0 3px,${ink}08 4px 5px,transparent 6px 11px)`;
        K.el("div", null, { position: "absolute", inset: "0", backgroundImage: texture }, root);
        if (config.family === "rough" || config.family === "binary") {
          const decoration = K.el("canvas", null, { position: "absolute", inset: "0", width: "100%", height: "100%" }, root);
          decoration.width=W; decoration.height=H;
          const d=decoration.getContext("2d"); d.globalAlpha=.18; d.strokeStyle=colors.accent || ink; d.fillStyle=ink;
          if (config.family === "rough") {
            d.lineWidth=Math.max(2,u*.3); d.beginPath(); d.moveTo(W*.025,H*.08); d.lineTo(W*.12,H*.075); d.lineTo(W*.19,H*.083);
            d.moveTo(W*.03,H*.91); d.lineTo(W*.16,H*.915); d.lineTo(W*.22,H*.905); d.stroke();
          } else {
            d.font=`600 ${Math.max(12,u*2.3)}px monospace`;
            for (let y=H*.07;y<H*.97;y+=u*5) d.fillText("0 1 0 0 1 1 0 1 0 1 1 0",W*.025,y);
          }
        }
      }
      if (p.video && p.muted === false) console.warn("[tabloid] el video permanece mudo por el contrato del motor");
      const photoBox = photo ? box(portrait || side === "left" ? 0 : W * .43, 0, portrait ? W : W * .57, portrait ? H * .56 : H, "photo") : null;
      let frame = null, posterImage = null, activeVideo = null;
      if (photo) {
        frame = K.el("div", null, { position: "absolute", overflow: "hidden", left: `${photoBox.x}px`, top: "0", width: `${photoBox.w}px`, height: `${photoBox.h}px` }, root);
        const mono = brand && ["rough", "binary", "cronica"].includes(config.family);
        const mediaStyle = { width: "100%", height: "100%", objectFit: "cover",
          objectPosition: Array.isArray(p.focus) ? `${p.focus[0] * 100}% ${p.focus[1] * 100}%` : "center",
          filter: `${mono ? "grayscale(1) " : ""}contrast(1.1) brightness(.95)` };
        if (p.poster || p.src) {
          posterImage = K.el("img", null, mediaStyle, frame); posterImage.src = p.poster || p.src; posterImage.alt = "";
        }
        if (p.mode === "split") {
          if (p.srcAfter || p.poster || p.src) {
            const img2 = K.el("img", null, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", clipPath: "inset(0 0 0 50%)", filter: p.srcAfter ? "contrast(1.15)" : "grayscale(1) contrast(1.45) brightness(.8)" }, frame); img2.src = p.srcAfter || p.poster || p.src; img2.alt = "";
          }
          if (!p.srcAfter) K.el("div", null, { position: "absolute", inset: "0 0 0 50%", background: brand ? (colors.accent || ink) : "rgba(225,6,0,.42)", opacity: brand ? ".25" : "1", mixBlendMode: "multiply" }, frame);
          K.el("div", null, { position: "absolute", top: "0", bottom: "0", left: "50%", width: `${Math.max(3,u*.35)}px`, background: brand ? highlight : YELLOW }, frame);
        }
        const fade = brand ? (portrait ? `linear-gradient(0deg,${bg},transparent 45%)` : `linear-gradient(${side === "left" ? "270deg" : "90deg"},${bg} 0%,${bg} 12%,transparent 48%)`) :
          (portrait ? "linear-gradient(0deg,rgba(0,0,0,.8),transparent 45%)" : side === "left" ? "linear-gradient(270deg,#000 0%,rgba(0,0,0,.94) 27%,transparent 65%)" : "linear-gradient(90deg,#000 0%,rgba(0,0,0,.94) 27%,transparent 65%)");
        K.el("div", null, { position: "absolute", inset: "0", background: fade }, frame);
      }
      const canvas = K.el("canvas", null, { position: "absolute", inset: "0", width: "100%", height: "100%" }, root); canvas.width = W; canvas.height = H;
      const motionCanvas = K.el("canvas", null, { position: "absolute", inset: "0", width: "100%", height: "100%" }, root); motionCanvas.width = W; motionCanvas.height = H;
      const logo = photo && K.brandLogo.attach(ctx, p, photoBox, Array.isArray(p.focus) ? p.focus : [0.5, 0.5], root);
      const motion = motionCanvas.getContext("2d"), layers = [];
      let c = canvas.getContext("2d");
      const paint = (kind, index, bounds, draw) => {
        const surface = document.createElement("canvas"); surface.width = W; surface.height = H;
        const previous = c; c = surface.getContext("2d");
        try { draw(); } finally { c = previous; }
        layers.push({ kind, index, bounds, surface });
      };
      const layout = { width: W, height: H, boxes: [], warnings: [], photo: photoBox };
      layout.style = { palette: brand ? "brand" : "alert", bg, ink, highlight, family, weight };
      root.__tabloidLayout = layout; window.__tabloidLayout = layout;
      ctx.beat.hideCaptions = true;
      window.__tabloidFontReady = (brand ? brandFontReady(family) : fontReady()).then(() => {
        const occupied = [], margin = W * .025, gap = Math.max(3, W * .006);
        const validFocus = Array.isArray(p.focus) && p.focus.length === 3 && p.focus.every(Number.isFinite) && p.focus[0] >= 0 && p.focus[0] <= 1 && p.focus[1] >= 0 && p.focus[1] <= 1 && p.focus[2] > 0 && p.focus[2] <= .5;
        if (photo && validFocus) {
          const [x,y,r] = p.focus, rx = r * photoBox.w, ry = r * photoBox.h;
          const f = box(photoBox.x + x * photoBox.w - rx, photoBox.y + y * photoBox.h - ry, rx * 2, ry * 2, "focus");
          // Clamp the protected zone to the visible photo.
          const right = Math.min(W, f.x + f.w), bottom = Math.min(H, f.y + f.h); f.x = Math.max(0, f.x); f.y = Math.max(0, f.y); f.w = right - f.x; f.h = bottom - f.y;
          occupied.push(f); layout.boxes.push(f);
        } else if (photo) layout.warnings.push("Sin focus válido: no se puede proteger automáticamente la zona de interés de la foto.");
        const canPlace = b => inside(b,W,H) && occupied.every(o => !overlap(b,o));
        const put = b => { occupied.push(b); layout.boxes.push(b); };
        const font = size => { c.font = `${weight} ${size}px ${JSON.stringify(family)}`; c.textBaseline = "alphabetic"; };
        const metrics = (s, size) => { font(size); const m = c.measureText(s), left=Math.max(0,m.actualBoundingBoxLeft); return { width: Math.max(m.width,m.actualBoundingBoxRight)+left, left, asc: Math.max(0,m.actualBoundingBoxAscent), desc: Math.max(0,m.actualBoundingBoxDescent) }; };
        const title = upper(p.text), accent = upper(p.accent), words = title.split(/\s+/).filter(Boolean);
        const maxRows = Math.min(words.length, portrait ? 6 : 3), limitW = portrait ? W * .94 : W * (photo ? .60 : .95), limitH = photo && portrait ? H * (brand ? .55 : .51) : H * .60;
        let best = null;
        for (let n = 1; n <= maxRows; n++) for (const lines of groups(title,n,accent, line => metrics(line,100).width)) {
          // Keep the accent together whenever it is present in the title.
          if (accent && title.includes(accent) && !lines.some(l => l.includes(accent))) continue;
          const base = lines.map(l => metrics(l,100));
          const widest = Math.max(...base.map(m => m.width),1), sumHeight = base.reduce((s,m) => s + m.asc + m.desc + 25,0);
          const maxFs = Math.min(H * .70, limitW * 100 / (widest + 24) / (portrait || brand ? 1 : .60), limitH * 100 / sumHeight);
          for (const scale of best ? [1] : [1,.7,.4,.2,.1]) {
          const fs = maxFs * scale;
          const lineData = lines.map((l, i) => {
            // In portrait, fit each line independently within an equal share of the title block.
            // Short lines can grow without horizontally distorting the design's display face.
            const rowFs = portrait && brand ? Math.min(H*.70, limitW*100/(base[i].width+24),
              (limitH-gap*(n-1))*100/n/(base[i].asc+base[i].desc+20)) * scale : fs;
            const m=metrics(l,rowFs), pad=Math.max(3,rowFs*.10);
            return { text:l, fs:rowFs, m, pad, w:m.width+pad*2, h:m.asc+m.desc+pad*2 };
          });
          const naturalWidth=Math.max(...lineData.map(l=>l.w));
          const sx=1;
          lineData.forEach(l=>{ l.sx = portrait || brand ? sx : Math.min(2, Math.max(.6, limitW/l.w)); l.w *= l.sx; });
          const totalH = lineData.reduce((s,l)=>s+l.h,0)+gap*(n-1), totalW=Math.max(...lineData.map(l=>l.w));
          // Search offsets around the preferred placement, then the whole frame if focus requires it.
          const preferredX = photo && !portrait && side === "left" ? W-margin-totalW : margin;
          const preferredY = photo && portrait ? H*(brand ? .43 : .47) : (!portrait && !photo && p.bullet ? margin : (H-totalH)/2);
          const xs = [preferredX, margin, W-margin-totalW, (W-totalW)/2];
          const ys = [preferredY, margin, H-margin-totalH, (H-totalH)/2];
          const focusBox=layout.boxes.find(b=>b.type==="focus");
          if (focusBox) { xs.push(focusBox.x-totalW-gap,focusBox.x+focusBox.w+gap); ys.push(focusBox.y-totalH-gap,focusBox.y+focusBox.h+gap); }
          for(let i=0;i<=10;i++) { xs.push(margin+(W-2*margin-totalW)*i/10); ys.push(margin+(H-2*margin-totalH)*i/10); }
          for (const x of xs) for (const y of ys) {
            let yy=y; const rows=lineData.map(l=>{const b=box(x,yy,l.w,l.h,"title",{text:l.text}); yy+=l.h+gap; return b;});
            if (!rows.every(canPlace)) continue;
            const offset = Math.abs(x-preferredX)/W + Math.abs(y-preferredY)/H;
            const crosses = photo && !portrait && (side === "right" ? x+totalW > photoBox.x : x < photoBox.x+photoBox.w);
            const score = portrait && brand ? Math.min(totalH/H,.5)*3 + fs/H*.3 - offset*.09 : portrait ? fs/H - offset*.09 : Math.min(totalH/H,.55)*3 + fs/H*.9 - offset*.09 + (crosses ? .035 : 0) - (n === 1 && words.length > 1 ? .5 : 0);
            if (!best || score > best.score) best={lines:lineData,rows,fs,sx,score};
          }
          }
        }
        if (!best) layout.warnings.push("No hay espacio seguro para el titular; se omitió.");
        else {
          for (let i=0;i<best.rows.length;i++) {
            const b=best.rows[i], l=best.lines[i], rowScale=l.sx; put(b); font(l.fs);
            const baseline=b.y+l.pad+l.m.asc, localX=l.pad+l.m.left, x=b.x+localX*rowScale, at=accent ? l.text.indexOf(accent) : -1;
            let ab = null;
            if (at >= 0) {
              const prefix=l.text.slice(0,at), marked=l.text.slice(at,at+accent.length), prefixW=c.measureText(prefix).width, markedW=c.measureText(marked).width;
              ab=box(x+(prefixW-l.pad/2)*rowScale,b.y,(markedW+l.pad)*rowScale,b.h,"accent",{parent:i});
              layout.boxes.push(ab);
            }
            paint("title",i,b,() => {
              font(l.fs); c.save(); c.translate(b.x,0); c.scale(rowScale,1);
              c.lineJoin="round"; c.lineWidth=Math.max(2,l.fs*.04); c.strokeStyle=brand ? bg : BLACK; c.shadowColor=brand ? bg : RED; c.shadowOffsetX=l.fs*.025; c.shadowOffsetY=l.fs*.025;
              c.strokeText(l.text,localX,baseline); c.fillStyle=ink; c.fillText(l.text,localX,baseline); c.restore();
            });
            if (ab) paint("accent",i,ab,() => {
              if (!brand) { c.fillStyle=RED; c.fillRect(ab.x,ab.y,ab.w,ab.h); }
              font(l.fs); c.save(); c.translate(b.x,0); c.scale(rowScale,1);
              const pre=l.text.slice(0,at), marked=l.text.slice(at,at+accent.length), mx=localX+c.measureText(pre).width;
              c.lineJoin="round"; c.lineWidth=Math.max(2,l.fs*.04); c.strokeStyle=brand ? bg : BLACK;
              c.strokeText(marked,mx,baseline); c.fillStyle=highlight; c.fillText(marked,mx,baseline); c.restore();
            });
          }
        }
        function optional(name, text, size, candidates, draw) {
          if (!text) return;
          const m=metrics(upper(text),size), pad=size*.22, w=m.width+pad*2, h=m.asc+m.desc+pad*2;
          for (const [x,y] of candidates(w,h)) { const b=box(x,y,w,h,name,{text:upper(text)}); if(canPlace(b)) { put(b); draw(b,m,pad); return; } }
          layout.warnings.push(`${name} omitido: no hay espacio seguro o legible.`);
        }
        function label(b,m,pad,bg,fg,size) { c.fillStyle=bg; c.fillRect(b.x,b.y,b.w,b.h); font(size); c.fillStyle=fg; c.fillText(b.text,b.x+pad+m.left,b.y+pad+m.asc); }
        const positions=(w,h)=>[[W-margin-w,margin],[W-margin-w,H-margin-h],[margin,margin],[margin,H-margin-h],[W-margin-w,(H-h)/2],[margin,(H-h)/2]];
        // At 160 px wide, secondary text uses at least 14 px of font size.
        const secondary=Math.max(W*14/160, portrait ? H*.034 : H*.085);
        if (p.strap) optional("strap",p.strap,secondary,(w,h)=>[[margin,margin],[W-margin-w,margin]],(b,m,pad)=>label(b,m,pad,RED,"white",secondary));
        if (p.bullet && !portrait && !photo && best) {
          // Use the remaining strip below the full-width headline for the number and its label.
          const parts=upper(p.bullet).split(/\s+/), number=parts.shift(), caption=parts.join(" ");
          const y=Math.max(...best.rows.map(row=>row.y+row.h))+gap, h=H-margin-y;
          const scale=Number.isFinite(p.bulletScale) ? Math.max(.5,Math.min(1.5,p.bulletScale)) : 1;
          const large=H*.22*scale, small=Math.max(W*14/160,H*.15)*scale, nm=metrics(number,large), cm=caption ? metrics(caption,small) : {width:0,asc:0,desc:0,left:0};
          const textW=nm.width+(caption ? gap*3+cm.width : 0), b=box(margin,y,W-2*margin,h,"bullet",{text:upper(p.bullet)});
          if (canPlace(b) && h >= Math.max(nm.asc+nm.desc,cm.asc+cm.desc)+gap*2 && textW <= b.w-gap*2) {
            put(b);
            paint("bullet",0,b,() => { const x=b.x+(b.w-textW)/2;
            c.fillStyle=RED;
            if (brand) c.fillRect(x-gap,b.y+(h-nm.asc-nm.desc)/2-gap,nm.width+gap*2,nm.asc+nm.desc+gap*2);
            else { c.fillRect(b.x,b.y,b.w,b.h); c.strokeStyle=YELLOW; c.lineWidth=3; c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4); }
            c.fillStyle="white"; font(large); c.fillText(number,x+nm.left,b.y+(h-nm.asc-nm.desc)/2+nm.asc);
            if (caption) { font(small); c.fillStyle=brand ? ink : "white"; c.fillText(caption,x+nm.width+gap*3+cm.left,b.y+(h-cm.asc-cm.desc)/2+cm.asc); } });
          } else layout.warnings.push("bullet omitido: no hay espacio seguro o legible.");
        } else if (p.bullet) {
          const parts=upper(p.bullet).split(/\s+/), number=parts.shift(), caption=parts.join(" ");
          let scale=Number.isFinite(p.bulletScale) ? Math.max(.5,Math.min(1.5,p.bulletScale)) : 1;
          if (portrait && photo && scale !== 1 && validFocus) {
            const f=layout.boxes.find(b=>b.type==="focus");
            const available=f.y-margin-gap;
            const baseLarge=Math.max(W*.095,H*.16), baseSmall=Math.max(W*(brand ? 9 : 14)/160,H*.055);
            const a=metrics(number,baseLarge), d=caption ? metrics(caption,baseSmall) : {asc:0,desc:0};
            scale=Math.min(scale, available/(a.asc+a.desc+d.asc+d.desc+baseSmall*(brand ? .22 : .28)*3));
          }
          const large=Math.max(W*.095,H*.16)*scale, small=Math.max(W*(brand ? 9 : 14)/160,H*.055)*scale, pad=small*(brand ? .22 : .28);
          const nm=metrics(number,large), cm=caption ? metrics(caption,small) : {width:0,asc:0,desc:0};
          const w=Math.max(nm.width,cm.width)+pad*2, h=nm.asc+nm.desc+cm.asc+cm.desc+pad*3;
          const candidates=[[W-margin-w,(H-h)/2],...positions(w,h)];
          let placed=false;
          for (const [x,y] of candidates) {
            const b=box(x,y,w,h,"bullet",{text:upper(p.bullet)});
            if (!canPlace(b)) continue;
            put(b); placed=true; paint("bullet",0,b,() => { c.fillStyle=RED; c.fillRect(x,y,w,h); c.strokeStyle=YELLOW; c.lineWidth=3; c.strokeRect(x+2,y+2,w-4,h-4);
            font(large); c.fillStyle="white"; c.fillText(number,x+(w-nm.width)/2+nm.left,y+pad+nm.asc);
            if(caption) { font(small); c.fillText(caption,x+(w-cm.width)/2+cm.left,y+pad*2+nm.asc+nm.desc+cm.asc); } });
            break;
          }
          if(!placed) layout.warnings.push("bullet omitido: no hay espacio seguro o legible.");
        }
        if (p.seal) {
          if (photo && !validFocus) layout.warnings.push("seal omitido: focus [x,y,r] obligatorio con foto.");
          else optional("seal",p.seal,secondary,positions,(b,m,pad)=>label(b,m,pad,RED,"white",secondary));
        }
        if (p.tapeText) optional("tape",p.tapeText,secondary,positions,(b,m,pad)=>{label(b,m,pad,YELLOW,BLACK,secondary); c.strokeStyle=RED; c.lineWidth=3; c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);});
        if (photo && p.mode === "split") for (const [name,text,half] of [["beforeLabel",p.beforeLabel,0],["afterLabel",p.afterLabel,1]]) {
          if (!text) continue;
          const x=photoBox.x+photoBox.w*(half*.5)+margin;
          optional(name,text,secondary,(w,h)=>[[x,margin],[x,photoBox.h-h-margin]],(b,m,pad)=>label(b,m,pad,brand ? ink : RED,brand ? bg : "white",secondary));
        }
        if (p.marker && photo) {
          if (!validFocus) layout.warnings.push("marker omitido: focus [x,y,r] obligatorio con foto.");
          else {
            // The ellipse encloses the complete rectangular protected zone, including its corners.
            const f=layout.boxes.find(b=>b.type==="focus"), d=Math.max(5,W*.009), cx=f.x+f.w/2, cy=f.y+f.h/2;
            const rx=(f.w/2+d*2)*Math.SQRT2, ry=(f.h/2+d*2)*Math.SQRT2;
            const x=cx-rx-d/2,y=cy-ry-d/2,w=rx*2+d,h=ry*2+d;
            const parts=[box(x,y,w,f.y-y,"marker"),box(x,f.y+f.h,w,y+h-f.y-f.h,"marker"),box(x,f.y,f.x-x,f.h,"marker"),box(f.x+f.w,f.y,x+w-f.x-f.w,f.h,"marker")];
            const arrow=box(cx-d*1.5,y-d*5,d*3,d*5,"marker");
            if([...parts,arrow].every(canPlace)) {
              parts.forEach(put); put(arrow); c.strokeStyle=RED; c.fillStyle=RED; c.lineWidth=d;
              c.beginPath(); c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); c.stroke();
              c.beginPath(); c.moveTo(cx,arrow.y); c.lineTo(cx,arrow.y+arrow.h-d); c.stroke();
              c.beginPath(); c.moveTo(cx,arrow.y+arrow.h); c.lineTo(cx-d*1.5,arrow.y+arrow.h-d*2); c.lineTo(cx+d*1.5,arrow.y+arrow.h-d*2); c.closePath(); c.fill();
            } else layout.warnings.push("marker omitido: no hay espacio seguro alrededor del foco.");
          }
        } else if (p.marker) layout.warnings.push("marker omitido: no hay foto.");
      });
      function drawLayer(layer, lt) {
        const mode = layer.kind === "title" ? p.textIn : layer.kind === "accent" ? p.accentIn : p.bulletIn;
        const delay = layer.kind === "bullet" ? .10 + (layout.boxes.filter(b => b.type === "title").length - 1) * p.stagger + p.inDuration * .7
          : .08 + layer.index * p.stagger + (layer.kind === "accent" ? p.inDuration * .6 : 0);
        const progress = still || mode === "none" ? 1 : clamp((lt - delay) / p.inDuration);
        if (progress <= 0) return;
        const eased = 1 - Math.pow(1 - progress, 3), b = layer.bounds;
        motion.save();
        if (mode === "typewriter") {
          motion.beginPath(); motion.rect(b.x, b.y - 4, b.w * progress, b.h + 8); motion.clip();
        } else if (mode === "slide") {
          motion.translate((1 - eased) * Math.max(14, W * .045) * (side === "left" ? 1 : -1), 0);
          motion.globalAlpha = eased;
        } else if (mode === "slam") {
          const scale = 1 + (1 - eased) * .22;
          motion.translate(b.x + b.w / 2, b.y + b.h / 2);
          motion.scale(scale, scale);
          motion.translate(-b.x - b.w / 2, -b.y - b.h / 2);
          motion.globalAlpha = eased;
        }
        motion.drawImage(layer.surface, 0, 0);
        motion.restore();
      }
      return {
        render(lt) {
          if (p.video) {
            const v = ctx.clip(p.video, p.start + Math.max(0, lt) * p.rate);
            if (v) {
              // ctx.clip registra el segundo solicitado; el motor espera seeked en capturas.
              if (p.loop && Number.isFinite(v.duration) && v.duration > 0) ctx.clip(p.video, (p.start + Math.max(0, lt) * p.rate) % v.duration);
              if (activeVideo !== v) {
                activeVideo = v;
                Object.assign(v.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover",
                  objectPosition: Array.isArray(p.focus) ? `${p.focus[0] * 100}% ${p.focus[1] * 100}%` : "center",
                  filter: brand && ["rough", "binary", "cronica"].includes(config.family) ? "grayscale(1) contrast(1.1) brightness(.95)" : "contrast(1.1) brightness(.95)" });
                v.muted = true;
                v.playbackRate = p.rate;
                frame.insertBefore(v, posterImage ? posterImage.nextSibling : frame.firstChild);
              }
              v.style.visibility = (still || lt <= 0) && posterImage ? "hidden" : "visible";
            }
          }
          motion.clearRect(0, 0, W, H);
          for (const layer of layers) drawLayer(layer, lt);
          if (logo) logo.render(lt);
          root.style.opacity = still || p.video ? "1" : String(1 - Math.pow(1 - clamp(lt / .58), 3));
        },
        dispose() { if (activeVideo) { activeVideo.playbackRate = 1; activeVideo.remove(); } if (logo) logo.dispose(); root.remove(); },
      };
    },
  });
})();
