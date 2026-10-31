/* Imágenes locales para pizarra: precarga antes de iniciar el motor y permite recortes de hojas. */
(() => {
  "use strict";
  const script = document.currentScript;
  const cache = new Map();
  Pizarra.props.imagen = (g, width, item) => {
    const image = cache.get(item.src);
    if (!image) return;
    const height = item.height || width * image.naturalHeight / image.naturalWidth;
    const crop = item.crop || [0, 0, 1, 1];
    g.drawImage(image, crop[0]*image.naturalWidth, crop[1]*image.naturalHeight,
      crop[2]*image.naturalWidth, crop[3]*image.naturalHeight, -width/2, -height/2, width, height);
  };
  async function start() {
    const response = await fetch("assets/scene.json");
    if (!response.ok) throw new Error("No se pudo cargar la escena para precargar imágenes");
    const scene = await response.json();
    const sources = [...new Set((scene.shots || []).flatMap(s => s.items || [])
      .filter(i => i.type === "prop" && i.name === "imagen" && i.src).map(i => i.src))];
    await Promise.all(sources.map(src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => { cache.set(src, image); resolve(); };
      image.onerror = () => reject(new Error("No se pudo cargar " + src)); image.src = src;
    })));
    const engine = document.createElement("script"); engine.src = script.dataset.engine;
    document.body.appendChild(engine);
  }
  start().catch(error => console.error("[pizarra/imagenes]", error));
})();
