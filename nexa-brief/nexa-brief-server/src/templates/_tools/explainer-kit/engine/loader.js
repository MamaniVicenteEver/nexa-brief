/* =============================================================================
   explainer-kit · cargador único
   -----------------------------------------------------------------------------
   Todo video (y la galería) carga el kit así:

     <script src="../../explainer-kit/engine/loader.js" data-design="binary"></script>

   Lee designs/<diseño>/design.json y carga, en orden: fuentes (Google Fonts),
   engine/kit.css, engine/kit.js y los scripts que declare el diseño. Después
   arranca Kit.boot() con los valores por defecto del diseño (salvo data-noboot).
   Así un diseño nuevo = una carpeta designs/<nombre>/ y nada más que tocar.

   Todo se pide EN PARALELO (los scripts se ejecutan igual en orden, async=false):
   antes eran ~15 pedidos en cadena y, por red (LAN/Tailscale), el video tardaba
   ~5 s en arrancar. Mientras bajan los scripts se adelantan config.json, el audio
   y lyrics/storyboard del video, y se le pasan a Kit.boot() ya cargados.
   ========================================================================== */
(function () {
  const me = document.currentScript;
  const KIT = me.src.replace(/engine\/loader\.js.*$/, "");
  const design = me.dataset.design || "binary";

  const css = href => new Promise(res => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.onload = l.onerror = res; document.head.appendChild(l); });
  /* async=false: se descargan todos a la vez y se ejecutan en el orden en que se agregan */
  const js = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = res; s.onerror = () => rej(new Error("no carga " + src)); document.body.appendChild(s); });
  const getJSON = async (...urls) => {
    for (const u of urls) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} }
    return null;
  };

  window.KitReady = (async () => {
    const noboot = me.hasAttribute("data-noboot");
    const configP = noboot ? Promise.resolve(null) : getJSON("config.json", "assets/config.json");
    const D = await (await fetch(KIT + "designs/" + design + "/design.json")).json();
    D.root = KIT;
    document.documentElement.dataset.family = D.family;
    if (document.body) document.body.dataset.family = D.family;
    const styles = [KIT + "engine/kit.css"];
    if (D.fontsCss) styles.unshift(D.fontsCss);
    /* ?controls=1: control de reproducción de la app (play/pausa/saltar/volumen) */
    const controls = new URLSearchParams(location.search).get("controls") === "1";
    const scripts = [...(controls ? ["engine/player.js"] : []), "engine/kit.js", ...D.scripts];
    const loaded = Promise.all([...styles.map(css), ...scripts.map(s => js(KIT + s))]);

    /* datos del video en paralelo con los scripts (mismas reglas que Kit.boot: el
       config.json del video pisa los defaults del diseño) */
    const dataP = configP.then(async raw => {
      const C0 = raw && raw.configs ? raw.configs[0] : raw;
      if (!C0) return {};
      const defs = D.defaults || {};
      const src = C0.audio?.src ?? defs.audio?.src;
      const audio = document.getElementById("audio");
      if (audio && src && !audio.getAttribute("src")) audio.src = src;
      const lyricsUrl = C0.lyricsUrl ?? defs.lyricsUrl;
      const storyboardUrl = C0.storyboardUrl ?? defs.storyboardUrl;
      const [lyrics, storyboard] = await Promise.all([lyricsUrl ? getJSON(lyricsUrl) : null, storyboardUrl ? getJSON(storyboardUrl) : null]);
      return { config: raw, lyrics: lyrics || undefined, storyboard: storyboard || undefined };
    });

    await loaded;
    window.Kit.design = D;
    if (!noboot) await window.Kit.boot({ design: D, ...(await dataP) });
    return D;
  })();
})();
