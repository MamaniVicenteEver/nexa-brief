(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data, sample = T.ROOT + "samples/nasa-ames.jpg";
  const isVideo = p => p.tipo === "video" || (p.tipo !== "imagen" && /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(p.src || ""));
  K.register({
    name: "titanes.foto", layer: "main", opaque: true, post: 0, tags: ["foto", "video", "archivo", "duotono"],
    summary: "Foto o clip mudo en duotono con grano, marco iluminado, foco configurable y movimiento lento. src acepta imagen y video.",
    example: { src: sample, titulo: "NASA AMES", credito: "NASA · 1963 · dominio público", focus: [.65, .48], bg: "foco" },
    params: {
      ...D.params,
      src: { type: "string", default: sample, doc: "Imagen o video local. Se precarga por prepare antes del primer cuadro." },
      tipo: { type: "enum", default: "auto", options: ["auto", "imagen", "video"], doc: "auto detecta MP4/WebM/MOV/M4V/OGV. Forzar video para URL sin extensión." },
      poster: { type: "image", default: "", doc: "Imagen de respaldo opcional." },
      focus: { type: "array", default: [.5, .5], doc: "Punto de interés normalizado [x,y]." },
      desplazar: { type: "array", default: [.025, -.015], doc: "Desplazamiento total del foco normalizado [dx,dy]." },
      zoom: { type: "number", default: .045, min: 0, max: .15, doc: "Acercamiento lento a lo largo del beat." },
      start: { type: "number", default: 0, min: 0, doc: "Segundo inicial del video." },
      rate: { type: "number", default: 1, min: .1, max: 3, doc: "Velocidad del clip mudo." },
      loop: { type: "bool", default: true, doc: "Repite el clip desde start al llegar a su duración." },
      credito: { type: "string", default: "", doc: "Autor, año y licencia breves. Crédito completo en CREDITS del episodio." },
      sinMedio: { type: "string", default: "MEDIO NO DISPONIBLE", doc: "Estado visible si falla el medio y el poster." },
    },
    async prepare(beats) {
      for (const beat of beats) {
        const p = { src: sample, tipo: "auto", ...beat.params };
        if (isVideo(p)) {
          const video = await K.video(p.src);
          if (video) K.loadedVideos.set(p.src, video);
        } else await D.prepareImages([p.src]);
        await D.prepareImages([p.poster]);
      }
    },
    create(ctx, p) {
      const st = ctx.stage, { H, W, u, portrait } = st, box = D.box(st), P = T.palette(ctx, p), g = ctx.g.main;
      const x = box.x, y = H * .24, width = box.w, height = H * (portrait ? .39 : .49), dpr = ctx.dpr || 1;
      const buffer = T.canvas(width * dpr, height * dpr), bg = buffer.getContext("2d");
      // El búfer se reutiliza para cada cuadro de video, con el mismo tratamiento de _titanes.tone.
      const grainStage = { W: width, H: height };
      return D.scene(ctx, { ...p, src: "", bg: p.bg === "image" ? "foco" : p.bg }, "foco", (t, beat) => {
        const progress = K.clamp(t / Math.max(.1, beat.dur)), focus = [0, 1].map(i => K.clamp(D.finite(p.focus[i], .5) + D.finite(p.desplazar[i]) * progress));
        let medium;
        if (isVideo(p)) {
          medium = K.loadedVideos.get(p.src);
          const duration = medium?.duration || 0, start = K.clamp(p.start, 0, Math.max(0, duration - .05)), span = Math.max(.05, duration - start);
          const seconds = start + (p.loop ? (t * p.rate) % span : t * p.rate);
          medium = ctx.clip(p.src, seconds) || ctx.img(p.poster);
        } else medium = ctx.img(p.src) || ctx.img(p.poster);
        D.heading(g, st, p.titulo, P);
        T.glow(g, x + width * .5, y + height * .5, width * .8, height, P.accent, .55);
        D.panel(g, x - u * 1.2, y - u * 1.2, width + u * 2.4, height + u * 2.4, P);
        if (medium) {
          // Limpiar también el píxel fraccional del borde al redondear el tamaño del búfer.
          bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, buffer.width, buffer.height);
          bg.setTransform(dpr, 0, 0, dpr, 0, 0); bg.globalCompositeOperation = "source-over";
          bg.filter = "grayscale(1) contrast(1.12)";
          K.hook.cover(bg, medium, 0, 0, width, height, focus, 1.02 + p.zoom * progress);
          bg.filter = "none"; bg.globalCompositeOperation = "multiply"; bg.fillStyle = P.accent; bg.fillRect(0, 0, width, height);
          bg.globalCompositeOperation = "source-over"; T.finish(bg, grainStage, t, P);
          const reveal = K.prog(t, .05, .75);
          g.save(); g.beginPath(); g.rect(x, y, width * reveal, height); g.clip(); g.drawImage(buffer, x, y, width, height); g.restore();
          const lightX = x + width * reveal;
          if (reveal < 1) D.line(g, [[lightX, y], [lightX, y + height]], P.rim, u * .45);
        } else D.label(g, p.sinMedio, x + u * 3, y + height * .5, width - u * 6, u * 5, P.ink, { font: "Anton", weight: 400 });
        const creditY = y + height + u * 5;
        D.label(g, p.credito, x, creditY, width, u * 2.6, P.ink, { weight: 400 });
        D.source(g, st, p.fuente, P);
      }, () => { buffer.width = buffer.height = 1; });
    },
  });
})();
