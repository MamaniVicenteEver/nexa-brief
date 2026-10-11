/* =============================================================================
   pop · título de apertura = la apertura de la referencia encadenada en un solo beat:
   marca + círculo (44,9 s) → objeto / caleidoscopio (46,4 s, opcional) → renglones
   apilados sobre foto con cortina líquida (50,98 s).
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop;
  /** instancia interna de otro componente pop con sus defaults resueltos */
  function sub(ctx, name, raw) {
    const def = K.registry.get(name);
    return def.create({ ...ctx, beat: { ...ctx.beat } }, K.resolveParams(def, raw, ctx.C));
  }
  P0.sub = sub;
  K.register({
    name: "pop.title", tags: ["intro", "título", "gancho"], layer: "main",
    summary: "Título de apertura en 3 tiempos como el comienzo de la referencia: marca del canal con círculo fino que se dibuja (+ kicker), objeto 3D con la foto que se parte en caleidoscopio (opcional, si hay `object`) y el TÍTULO en renglones apilados menta sobre la foto con cortina líquida, cruz y flecha (re-encuadre en `phase2`).",
    example: { text: "LA NOCHE\nQUE CAYÓ\nEL MURO", src: "assets/media/muro-gente.jpg", kicker: "BERLÍN · 9 NOV 1989", object: "assets/media/mauerspecht.jpg", label: "/BERLÍN/1989" },
    params: {
      text: { type: "string", required: true, doc: "Título; '\\n' parte renglones (2–4 renglones cortos)." },
      src: { type: "image", required: true, doc: "Foto de fondo del título." },
      kicker: { type: "string", default: "", doc: "Rótulo chico bajo el círculo de la marca." },
      mark: { type: "string", default: "", doc: "Monograma de la marca (vacío = gota del canal)." },
      object: { type: "image", default: "", doc: "Foto del objeto/caleidoscopio (vacío = se salta esa parte)." },
      label: { type: "string", default: "", doc: "Rótulo '/RUTA/TIPO' del objeto." },
      intro: { type: "number", default: 1.7, doc: "Segundos de la marca con círculo." },
      objectDur: { type: "number", default: 1.5, doc: "Segundos del objeto/caleidoscopio." },
      phase2: { type: "number", default: 1.6, doc: "Segundos (desde que aparece el título) hasta el re-encuadre grande (<0 = nunca)." },
      focus: { type: "array", default: [0.5, 0.5], doc: "Foco de la foto del título [x,y]." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const logo = sub(ctx, "pop.logo", { mark: p.mark, kicker: p.kicker });
      const obj = p.object ? sub(ctx, "pop.kaleido", { src: p.object, label: p.label || "/" + (p.kicker || "").split(" ")[0], split: p.objectDur * 0.45 }) : null;
      const st = sub(ctx, "pop.stack", { text: p.text, src: p.src, phase2: p.phase2, focus: p.focus, fx: "liquid" });
      const a = p.intro, b2 = a + (obj ? p.objectDur : 0);
      return {
        render(lt, b, t) {
          if (lt < a) return logo.render(lt, { ...b, dur: a }, t);
          if (obj && lt < b2) return obj.render(lt - a, { ...b, dur: b2 - a }, t);
          return st.render(lt - b2, { ...b, dur: b.dur - b2 }, t);
        },
        dispose() { logo.dispose?.(); obj?.dispose?.(); st.dispose?.(); },
      };
    },
  });
})();
