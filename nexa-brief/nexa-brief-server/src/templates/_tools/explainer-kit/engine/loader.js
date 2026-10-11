/* =============================================================================
   explainer-kit · cargador único
   -----------------------------------------------------------------------------
   Todo video (y la galería) carga el kit así:

     <script src="../../explainer-kit/engine/loader.js" data-design="binary"></script>

   Lee designs/<diseño>/design.json y carga, en orden: fuentes (Google Fonts),
   engine/kit.css, engine/kit.js y los scripts que declare el diseño. Después
   arranca Kit.boot() con los valores por defecto del diseño (salvo data-noboot).
   Así un diseño nuevo = una carpeta designs/<nombre>/ y nada más que tocar.
   ========================================================================== */
(function () {
  const me = document.currentScript;
  const KIT = me.src.replace(/engine\/loader\.js.*$/, "");
  const design = me.dataset.design || "binary";

  const css = href => new Promise(res => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.onload = l.onerror = res; document.head.appendChild(l); });
  const js = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("no carga " + src)); document.body.appendChild(s); });

  window.KitReady = (async () => {
    const D = await (await fetch(KIT + "designs/" + design + "/design.json")).json();
    D.root = KIT;
    document.documentElement.dataset.family = D.family;
    if (document.body) document.body.dataset.family = D.family;
    const styles = [KIT + "engine/kit.css"];
    if (D.fontsCss) styles.unshift(D.fontsCss);
    await Promise.all(styles.map(css));
    /* ?controls=1: control de reproducción de la app (play/pausa/saltar/volumen) */
    if (new URLSearchParams(location.search).get("controls") === "1") await js(KIT + "engine/player.js");
    await js(KIT + "engine/kit.js");
    window.Kit.design = D;
    for (const s of D.scripts) await js(KIT + s);
    if (!me.hasAttribute("data-noboot")) await window.Kit.boot({ design: D });
    return D;
  })();
})();
