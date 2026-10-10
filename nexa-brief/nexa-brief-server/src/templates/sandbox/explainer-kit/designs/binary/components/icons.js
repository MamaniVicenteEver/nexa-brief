/* =============================================================================
   binary · biblioteca de siluetas (rellenas) para dibujar con glifos 0/1
   -----------------------------------------------------------------------------
   Cada icono es un path SVG en una caja 100×100 (fill-rule evenodd: los
   agujeros se hacen con subtrazos). Círculo completo: "M cx (cy-r) a r r 0 1 0 .01 0Z"
   (el punto inicial es el BORDE superior, no el centro; con flag 1 1 queda corrido). Para agregar uno: una línea más acá.
   Se usan desde binary.icon / binary.grid / binary.orbit con `icon:"nombre"`.
   También acepta "text:?" (un carácter de fuente) y "svg:<path>" (path libre).
   ========================================================================== */
(function () {
  const ICONS = {
    bulb: "M50 6C30 6 16 21 16 39c0 13 7 21 13 28 4 5 6 9 6 14h30c0-5 2-9 6-14 6-7 13-15 13-28C84 21 70 6 50 6Z M36 86h28v5H36Z M40 94h20v4H40Z",
    question: "M28 34C28 15 44 6 52 6c15 0 27 10 27 24 0 13-9 18-15 23-6 4-8 7-8 15v5H42v-7c0-11 5-16 11-21 5-4 10-7 10-14 0-6-5-11-12-11-8 0-12 6-12 14Z M41 82h17v15H41Z",
    key: "M28 30a20 20 0 1 0 .01 0Z M28 42a8 8 0 1 0 .01 0Z M48 45h46v10h-7v12h-9V55h-6v9h-9V55H48Z",
    lock: "M22 44h56v50H22Z M32 44V30c0-11 8-20 18-20s18 9 18 20v14h-9V30c0-6-4-11-9-11s-9 5-9 11v14Z M46 60h8v18h-8Z",
    ship: "M8 62h84l-12 22H20Z M24 62V48h40v14Z M30 48V34h18v14Z M52 48V40h8v8Z M36 34V26h6v8Z",
    submarine: "M10 58c0-9 8-14 18-14h44c10 0 18 5 18 14s-8 14-18 14H28c-10 0-18-5-18-14Z M42 44V32h16v12Z M48 32V20h4v12Z M90 58l8-8v16Z",
    apple: "M50 26c-6-4-14-6-22-2C16 30 12 44 16 60c4 16 14 30 24 30 4 0 6-2 10-2s6 2 10 2c6 0 11-5 15-11-8-5-11-13-9-21-6-2-6-14-2-20-4-6-11-9-18-9-2 0-4 0-6 1Z M50 24c0-8 4-15 12-18 1 8-4 16-12 18Z M78 52a9 9 0 1 1-0.1 0Z",
    gear: "M44 6h12l2 12 9 4 10-7 8 8-7 10 4 9 12 2v12l-12 2-4 9 7 10-8 8-10-7-9 4-2 12H44l-2-12-9-4-10 7-8-8 7-10-4-9-12-2V44l12-2 4-9-7-10 8-8 10 7 9-4Z M50 34a16 16 0 1 0 0.1 0Z",
    envelope: "M8 22h84v56H8Z M14 28l36 26 36-26v11L50 65 14 39Z",
    clock: "M50 6a44 44 0 1 1-0.1 0Z M50 14a36 36 0 1 0 0.1 0Z M47 22h6v28l18 10-3 5-21-12Z",
    globe: "M50 6a44 44 0 1 1-0.1 0Z M50 12a38 38 0 1 0 0.1 0Z M48 8h4v84h-4Z M8 48h84v4H8Z M50 8c-14 12-14 72 0 84-20-10-20-74 0-84Z M50 8c14 12 14 72 0 84 20-10 20-74 0-84Z M16 28h68v3H16Z M16 69h68v3H16Z",
    phone: "M30 4h40c4 0 7 3 7 7v78c0 4-3 7-7 7H30c-4 0-7-3-7-7V11c0-4 3-7 7-7Z M29 14v68h42V14Z M44 88h12v4H44Z",
    gavel: "M20 30 44 6 64 26 40 50Z M47 41 53 35 90 72 84 78Z M8 84h48v9H8Z",
    heart: "M50 90C22 70 6 54 6 34 6 18 18 8 32 8c8 0 14 4 18 10 4-6 10-10 18-10 14 0 26 10 26 26 0 20-16 36-44 56Z",
    bell: "M50 7C30 7 16 23 16 44v16L6 75h88L84 60V44C84 23 70 7 50 7Z M50 18c-11 0-22 10-22 26v19h44V44c0-16-11-26-22-26Z M39 84h22c-1 7-5 11-11 11s-10-4-11-11Z M12 28Q0 45 6 64h8Q7 46 21 35Z M88 28Q100 45 94 64h-8Q93 46 79 35Z",
    chip: "M26 26h48v48H26Z M34 34v32h32V34Z M30 14h6v12h-6Z M47 14h6v12h-6Z M64 14h6v12h-6Z M30 74h6v12h-6Z M47 74h6v12h-6Z M64 74h6v12h-6Z M14 30h12v6H14Z M14 47h12v6H14Z M14 64h12v6H14Z M74 30h12v6H74Z M74 47h12v6H74Z M74 64h12v6H74Z",
    waves: "M46 46h8v48h-8Z M50 30a8 8 0 1 1-0.1 0Z M28 18c-14 16-14 40 0 56l5-5c-11-13-11-33 0-46Z M72 18c14 16 14 40 0 56l-5-5c11-13 11-33 0-46Z M16 8C-4 30-4 64 16 86l5-5C4 62 4 32 21 13Z M84 8c20 22 20 56 0 78l-5-5c17-19 17-49 0-68Z",
    check: "M10 52l10-10 20 20 40-40 10 10-50 50Z",
    cross: "M14 24l10-10 26 26 26-26 10 10-26 26 26 26-10 10-26-26-26 26-10-10 26-26Z",
    hourglass: "M20 6h60v8h-6c0 16-10 26-18 36 8 10 18 20 18 36h6v8H20v-8h6c0-16 10-26 18-36-8-10-18-20-18-36h-6Z M34 14c0 12 8 20 16 28 8-8 16-16 16-28Z M40 84h20c0-8-4-14-10-18-6 4-10 10-10 18Z",
    eye: "M50 24C28 24 12 40 4 50c8 10 24 26 46 26s38-16 46-26C88 40 72 24 50 24Z M50 34a16 16 0 1 0 0.1 0Z M50 42a8 8 0 1 1-0.1 0Z",
    person: "M50 8a18 18 0 1 1-0.1 0Z M14 96c0-24 16-40 36-40s36 16 36 40Z",
    house: "M50 6L4 44h10v50h72V44h10Z M40 64h20v30H40Z M22 50h12v10H22Z M66 50h12v10H66Z",
    book: "M10 14c14-4 28-2 38 6v70c-10-8-24-10-38-6Z M90 14c-14-4-28-2-38 6v70c10-8 24-10 38-6Z",
    moon: "M62 6C40 10 24 28 24 50s16 40 38 44C40 98 10 80 10 50S40 2 62 6Z",
    radar: "M50 6a44 44 0 1 1-0.1 0Z M50 14a36 36 0 1 0 0.1 0Z M50 26a24 24 0 1 1-0.1 0Z M50 32a18 18 0 1 0 0.1 0Z M48 50L84 30l2 4-34 20Z",
    keyboard: "M4 30h92v42H4Z M10 36v8h8v-8Z M22 36v8h8v-8Z M34 36v8h8v-8Z M46 36v8h8v-8Z M58 36v8h8v-8Z M70 36v8h8v-8Z M82 36v8h8v-8Z M14 50v8h8v-8Z M26 50v8h8v-8Z M38 50v8h8v-8Z M50 50v8h8v-8Z M62 50v8h8v-8Z M74 50v8h8v-8Z M24 62v6h52v-6Z",
  };
  /** dibuja la silueta en un canvas: `name` puede ser icono, "text:X" o "svg:<path>" */
  function drawIcon(g, name, w, h, o = {}) {
    const s = Math.min(w, h) / 100, ox = (w - 100 * s) / 2, oy = (h - 100 * s) / 2;
    if (String(name).startsWith("text:")) {
      const ch = name.slice(5); g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `${o.weight || 800} ${h * 0.9}px ${o.font || "'Inter', sans-serif"}`;
      g.fillText(ch, w / 2, h / 2 + h * 0.03); return;
    }
    const d = String(name).startsWith("svg:") ? name.slice(4) : ICONS[name];
    if (!d) { console.warn("[binary.icons] icono desconocido", name); g.fillRect(w * .3, h * .3, w * .4, h * .4); return; }
    g.save(); g.translate(ox, oy); g.scale(s, s); g.fill(new Path2D(d), "evenodd"); g.restore();
  }
  Kit.binary.ICONS = ICONS;
  Kit.binary.drawIcon = drawIcon;
})();
