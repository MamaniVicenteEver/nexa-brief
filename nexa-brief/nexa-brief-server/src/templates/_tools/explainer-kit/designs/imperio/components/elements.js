/* Piezas del video original: comparten los renderizadores de campaña/mapa, no sus dibujos. */
(function () {
  "use strict";
  const K = Kit, IM = K.imperio, C = IM.campaign, campaign = C.definition;
  const defaults = def => Object.fromEntries(Object.entries(def.params).map(([k, s]) => [k, s.default]));
  const pick = (defs, names) => Object.fromEntries(names.map(k => [k, defs[k]]));
  const camera = { ...C.camParams, zoom: { ...C.camParams.zoom, default: 1 }, tilt: { ...C.camParams.tilt, default: 0 } };
  const targetParams = {
    ...camera,
    country: C.mapParams.country,
    target: { type: "array", default: "Taiwan", doc: "País o punto [longitud, latitud] del destino; nunca píxeles." },
    region: { type: "object", default: null, doc: "Territorio: nombre de país, lista de países, {poly:[[lon,lat]…],within:'País'} o {dots:[[lon,lat]…]}. Vacío = el país de target." },
    label: { type: "string", default: "TAIWÁN", doc: "Nombre mostrado en la chapa del país o la ciudad." },
    year: { type: "string", default: "1895", doc: "Fecha del sello (puede incluir un rango)." },
    flag: { type: "image", default: "", doc: "Archivo SVG/PNG de bandera con licencia, relativo al episodio; no se deduce ni se inventa la bandera histórica." },
    time: { type: "number", default: 0.5, min: 0, doc: "Segundo local de llegada. Acepta @palabra de la narración." },
    hold: campaign.params.hold,
    size: { type: "number", default: 1, min: 0.5, max: 2, doc: "Escala de la bandera circular." },
    origin: { type: "array", default: null, doc: "Origen de la flecha [lon,lat]; vacío = centro de country." },
    bow: { type: "number", default: 0.16, min: -1, max: 1, doc: "Curvatura de la flecha. 0 = recta; el signo cambia el lado del arco." },
    travel: campaign.params.travel,
    beam: campaign.params.beam,
    side: { type: "enum", options: ["auto", "left", "right"], default: "auto", doc: "Lado del rótulo de ciudad." },
  };
  function targetPiece(name, summary, parts, kind, example) {
    const raw = p => {
      p = { ...Object.fromEntries(Object.entries(targetParams).map(([k,s])=>[k,s.default])), ...p };
      return ({ ...defaults(campaign), ...pick(p, Object.keys(camera)), country: p.country, sunAt: p.origin, hatch: [], enter: 0,
      parts, stamp: parts.includes("dates"), cameras: [], targets: [{ at: p.target, region: p.region ?? (typeof p.target === "string" ? p.target : null), label: p.label, year: p.year,
        flag: "f1", time: p.time, kind, from: p.origin, bow: p.bow, size: p.size, hold: p.hold, side: p.side === "auto" ? undefined : p.side }],
      f1: p.flag, travel: p.travel, hold: p.hold, beam: p.beam });
    };
    const fields = {
      'imperio.country': ['target','region','label','year','flag','time','hold','size'],
      'imperio.flag': ['target','label','flag','time','hold','size'],
      'imperio.city': ['target','label','time','hold','side'],
      'imperio.arrow': ['target','time','origin','bow','travel','beam'],
      'imperio.territory': ['target','region','time'],
    }[name];
    const params = pick(targetParams, [...Object.keys(camera), 'country', ...fields]);
    K.register({ name, summary, tags: ["imperio", "pieza", ...parts], layer: "main", opaque: true, post: 0.6,
      params, example: { from: [132, 32, 55, 0], to: [132, 32, 55, 0], time: 0.5, ...(fields.includes("hold") ? {hold:8} : {}), ...example },
      mapCam: (p, st) => campaign.mapCam(raw(p), st), mapLook: p => campaign.mapLook(raw(p)), mapWarm: (p, ctx) => campaign.mapWarm(raw(p), ctx),
      create(ctx, p) { return campaign.create(ctx, raw(p)); },
    });
  }
  targetPiece("imperio.country", "País del video: territorio marcado, bandera circular, nombre y fecha. Entradas geográficas y llegada sincronizable; comparte el dibujo de imperio.campaign.", ["territories", "badges", "dates"], "badge", { target: "Taiwan", label: "TAIWÁN", year: "1895", flag: "assets/flags/qing.svg", size: 1.6 });
  targetPiece("imperio.flag", "Bandera circular con aro, rebote y chapa con el nombre del país; se retira después de hold segundos. Es la misma bandera de la campaña.", ["badges"], "badge", { target: "Taiwan", label: "TAIWÁN", flag: "assets/flags/qing.svg", size: 1.8 });
  targetPiece("imperio.city", "Punto de ciudad con pulso y nombre en chapa carmesí, como Pekín, Shanghái o Singapur en el video. Se ubica por [longitud,latitud].", ["badges"], "city", { target: [116.4, 39.9], label: "PEKÍN", from: [120, 36, 35, 0], to: [120, 36, 35, 0] });
  targetPiece("imperio.arrow", "Flecha gruesa de avance con degradado y borde blanco. Admite origen, destino, curvatura, grosor y llegada por voz; reutiliza la flecha del video.", ["arrows"], "city", { country: "Japan", origin: [139, 36], target: [121, 24], time: 2.5 });
  targetPiece("imperio.territory", "Territorio que aparece en carmesí con borde y pulso. Admite países, varios países, polígonos recortados dentro de un país o islas mediante puntos.", ["territories"], "badge", { target: [127.6, 36.6], region: ["South Korea", "North Korea"], from: [128, 37.5, 40, 0], to: [128, 37.5, 40, 0] });

  const textParams = {
    text: { type: "string", required: true, doc: "Texto de la fecha o del pie de archivo; puede ser un rango de años." },
    at: { type: "number", default: 0.2, min: 0, doc: "Segundo de entrada, relativo al beat; acepta @palabra." },
    size: { type: "number", default: 1, min: 0.5, max: 2, doc: "Escala respecto al tamaño del video original." },
    x: { type: "number", default: null, min: 0, max: 1, doc: "Posición horizontal normalizada; vacío = la posición original del diseño." },
    y: { type: "number", default: null, min: 0, max: 1, doc: "Posición vertical normalizada; vacío = la posición original del diseño." },
  };
  for (const [name, summary, fn, example] of [
    ["date", "Fecha o rango de años blanco con subrayado carmesí; es el sello de la esquina del video, ahora reutilizable por JSON.", C.dateStamp, { text: "1940–41" }],
    ["caption", "Pie de archivo en Montserrat itálica con fundido; mismo rótulo de lugar y año de las fotografías y clips del video.", C.archiveCaption, { text: "ARCHIVO · 1931", x: 0.1, y: 0.55, size: 2 }],
  ]) K.register({ name: "imperio." + name, summary, tags: ["imperio", "texto", name], layer: "overlay", params: textParams, example,
    create(ctx, p) { return { render(lt) { fn(ctx.g.main, ctx.stage, p.text, K.prog(lt, p.at, 0.6, "out"), p); } }; },
  });

  const map = K.registry.get("imperio.map");
  for (const [name, summary, settings, example] of [
    ["sun", "Sol carmesí que late sobre el país o las coordenadas elegidas; comparte el sol y los colores de bandera de imperio.map.", { sun: true, rays: 0, ships: 0, compass: false }, { country: "Japan", sunSize: 5 }],
    ["rays", "Abanico de rayos sobre el mar: rumbo, apertura, cantidad, longitud y entrada por voz. Mismo efecto de la apertura original.", { sun: false, rays: 28, ships: 0, compass: false }, { country: "Japan", rays: 28, rayFloor: 0.02, raysAt: 0.2 }],
    ["ships", "Barcos pequeños que avanzan sobre las rutas del abanico. Reutiliza los barcos del mapa; la ruta conserva sus coordenadas geográficas.", { sun: false, rays: 12, rayAlpha: 0, ships: 5, compass: false }, { country: "Japan", ships: 5, rayLen: 0.35, raysAt: 0.1 }],
    ["compass", "Rosa de los vientos de línea fina que acompaña el giro del mapa; es la del archivo original.", { sun: false, rays: 0, ships: 0, compass: true }, { country: "Japan" }],
  ]) {
    const params = { ...map.params };
    for (const [key, value] of Object.entries(settings)) params[key] = { ...params[key], default: value };
    const resolve = p => ({ ...defaults(map), ...p });
    K.register({ name: "imperio." + name, summary, tags: ["imperio", "pieza", name], layer: "main", opaque: true, post: 0.6, params,
      example: { from: [139, 33, 50, 0], to: [139, 33, 50, 0], hatch: [], ...example },
      mapCam: p => map.mapCam(resolve(p)), mapLook: p => map.mapLook(resolve(p)), mapWarm: map.mapWarm,
      create(ctx, p) { return map.create(ctx, resolve(p)); },
    });
  }
})();
