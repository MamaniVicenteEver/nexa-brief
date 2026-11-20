/* Kit.capas · escenas buscables: cada cuadro depende solo de params, formato y t.
   Las máscaras se convierten una vez; las superficies teñidas se liberan al salir. */
(function (host) {
  "use strict";
  const K = host.Kit || (host.Kit = {});
  const scriptURL = typeof document !== "undefined" ? document.currentScript?.src : null;
  let baseURL = scriptURL ? new URL("../", scriptURL).href : "";
  let catalog, sceneSchema, catalogSchema, loading;
  let prepared = new WeakMap();
  const images = new Map();
  const residents = new Set(), windows = new Set();
  const MAX_MEDIA_PIXELS = 16 * 1024 * 1024, MAX_CANVAS_PIXELS = 32 * 1024 * 1024;
  const MAX_CACHE_PIXELS = 3 * MAX_MEDIA_PIXELS, MAX_CACHE_FILES = 384;
  const WINDOW_ERROR = "La ventana activa de capas supera la caché (192 MiB / 384 archivos). Reduzca escenas simultáneas; cada escena admite 64 MiB / 128 archivos.";
  let mediaPixels = 0, decoding = 0;
  const decodeQueue = [];
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };

  /* Subconjunto explícito de JSON Schema 2020-12 usado por ambos esquemas.
     Python ejecuta los mismos documentos con Draft202012Validator. */
  function schemaErrors(value, schema, root = schema, path = "$", errors = []) {
    if (schema.$ref) return schemaErrors(value, schema.$ref.split("/").slice(1).reduce((o, k) => o[k.replace(/~1/g, "/").replace(/~0/g, "~")], root), root, path, errors);
    const fail = msg => errors.push(`${path}: ${msg}`);
    for (const mode of ["oneOf", "anyOf"]) if (schema[mode]) {
      const count = schema[mode].filter(s => !schemaErrors(value, s, root).length).length;
      if (!(mode === "oneOf" ? count === 1 : count > 0)) fail(mode + ": forma inválida");
    }
    if (schema.allOf) schema.allOf.forEach(s => schemaErrors(value, s, root, path, errors));
    if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) fail("valor no permitido");
    if (schema.enum && !schema.enum.some(v => JSON.stringify(v) === JSON.stringify(value))) fail("valor no permitido");
    const isType = type => type === "null" ? value === null : type === "array" ? Array.isArray(value)
      : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
      : type === "number" ? typeof value === "number" && Number.isFinite(value)
      : type === "integer" ? Number.isInteger(value) : typeof value === type;
    if (schema.type && !(Array.isArray(schema.type) ? schema.type : [schema.type]).some(isType)) { fail("tipo inválido"); return errors; }
    if (typeof value === "string") {
      const n = [...value].length;
      if (schema.minLength != null && n < schema.minLength || schema.maxLength != null && n > schema.maxLength) fail("longitud fuera de rango");
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) fail("texto no permitido");
    }
    if (typeof value === "number") {
      if (schema.minimum != null && value < schema.minimum || schema.maximum != null && value > schema.maximum || schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum || schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) fail("número fuera de rango");
    }
    if (Array.isArray(value)) {
      if (schema.minItems != null && value.length < schema.minItems || schema.maxItems != null && value.length > schema.maxItems) fail("cantidad fuera de rango");
      if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail("elementos duplicados");
      value.forEach((v, i) => {
        const s = schema.prefixItems?.[i] || schema.items;
        if (s === false) fail("elemento no permitido");
        else if (s) schemaErrors(v, s, root, `${path}[${i}]`, errors);
      });
    } else if (value && typeof value === "object") {
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`falta ${key}`);
      if (schema.minProperties != null && Object.keys(value).length < schema.minProperties || schema.maxProperties != null && Object.keys(value).length > schema.maxProperties) fail("cantidad de claves fuera de rango");
      for (const [key, v] of Object.entries(value)) {
        if (schema.propertyNames) schemaErrors(key, schema.propertyNames, root, `${path}.${key}`, errors);
        let matched = false;
        if (Object.hasOwn(schema.properties || {}, key)) { schemaErrors(v, schema.properties[key], root, `${path}.${key}`, errors); matched = true; }
        for (const [pattern, s] of Object.entries(schema.patternProperties || {})) if (new RegExp(pattern).test(key)) { schemaErrors(v, s, root, `${path}.${key}`, errors); matched = true; }
        if (!matched) {
          if (schema.additionalProperties === false) fail(`clave desconocida ${key}`);
          else if (schema.additionalProperties && typeof schema.additionalProperties === "object") schemaErrors(v, schema.additionalProperties, root, `${path}.${key}`, errors);
        }
      }
    }
    return errors;
  }

  function validateCatalog(cat, schema = catalogSchema) {
    if (!schema) return ["Esquema del catálogo no preparado"];
    const errors = schemaErrors(cat, schema);
    if (errors.length) return errors;
    const seen = new Set();
    for (const a of cat.assets) {
      if (seen.has(a.id)) errors.push(`Asset duplicado: ${a.id}`); seen.add(a.id);
      const { w, h } = a.canvas, [x, y] = a.pivot, [lo, hi] = a.limits.scale;
      if (!(x < w && y < h)) errors.push("Pivote fuera del lienzo");
      if (a.height_ref > h) errors.push("height_ref supera el lienzo");
      if (lo > hi || a.defaults.scale < lo || a.defaults.scale > hi) errors.push("Límites de escala inválidos");
      if (!Object.hasOwn(a.poses, a.default_pose)) errors.push("default_pose inexistente");
      for (const anim of a.animations) if (!cat.animations.includes(anim)) errors.push("Animación no declarada en catálogo");
      for (const pose of Object.values(a.poses)) {
        for (const anchor of a.anchors) if (!Object.hasOwn(pose.anchors, anchor)) errors.push("Ancla garantizada ausente");
        if (Object.keys(pose.masks).sort().join(",") !== Object.keys(a.color_zones).sort().join(",")) errors.push("Máscaras no coinciden con zonas");
        for (const [ax, ay] of Object.values(pose.anchors)) if (!(ax < w && ay < h)) errors.push("Ancla fuera del lienzo");
      }
    }
    return errors;
  }
  function validateScene(p, cat = catalog, duration, schema = sceneSchema) {
    if (!cat || !schema) return ["Biblioteca de capas no preparada"];
    const errors = schemaErrors(p, schema);
    if (errors.length) return errors;
    if (!(typeof duration === "number" && Number.isFinite(duration) && duration > 0)) return ["Duración del beat inválida"];
    const catalogErrors = validateCatalog(cat);
    if (catalogErrors.length) return catalogErrors;
    const actors = new Map(), assets = new Map(cat.assets.map(a => [a.id, a]));
    const add = msg => errors.push(msg);
    const animation = (a, name) => {
      if (!cat.animations.includes(name) || !a.animations.includes(name)) add(`Animación incompatible: ${a.id}:${name}`);
    };
    const scale = (a, v) => { if (v < a.limits.scale[0] || v > a.limits.scale[1]) add(`Escala fuera de límites: ${a.id}`); };
    for (const actor of p.elenco) {
      if (actors.has(actor.id)) add(`ID duplicado: ${actor.id}`);
      const a = assets.get(actor.asset);
      actors.set(actor.id, { actor, asset: a, poses: new Set() });
      if (!a) { add(`Asset inexistente: ${actor.asset}`); continue; }
      if (a.status !== "aprobado") add(`Asset no aprobado: ${a.id}`);
      const pose = actor.pose || a.default_pose;
      actors.get(actor.id).poses.add(pose);
      if (!Object.hasOwn(a.poses, pose)) add(`Pose inexistente: ${a.id}:${pose}`);
      scale(a, actor.escala ?? a.defaults.scale);
      for (const zone of Object.keys(actor.estilo?.zonas || {})) if (!Object.hasOwn(a.color_zones, zone)) add(`Zona inexistente: ${a.id}:${zone}`);
      if (actor.anim) animation(a, actor.anim);
      if (actor.entrada) {
        animation(a, actor.entrada.anim);
        if (!actor.entrada.anim.startsWith("entrar-")) add("Entrada debe usar entrar-*");
        if (actor.entrada.dur > duration) add("Entrada fuera del beat");
      }
    }
    for (const e of p.eventos || []) {
      const row = actors.get(e.id);
      if (!row) { add(`Actor inexistente: ${e.id}`); continue; }
      if (e.en > duration || e.en + (typeof e.valor === "object" ? e.valor.dur || 0 : 0) > duration + 1e-9) add("Evento fuera del beat");
      const a = row.asset;
      if (!a) continue;
      if (e.accion === "pose") { row.poses.add(e.valor); if (!Object.hasOwn(a.poses, e.valor)) add(`Pose inexistente: ${a.id}:${e.valor}`); }
      if (e.accion === "color" && !Object.hasOwn(a.color_zones, e.valor.zona)) add(`Zona inexistente: ${a.id}:${e.valor.zona}`);
      if (e.accion === "escala") scale(a, e.valor.valor);
      if (e.accion === "anim" || e.accion === "salir") animation(a, e.valor);
      if (e.accion === "salir" && !e.valor.startsWith("salir-")) add("Salida debe usar salir-*");
    }
    for (const c of p.conexiones || []) for (const end of [c.de, c.a]) {
      const [id, anchor] = end.split(":"), row = actors.get(id);
      if (!row) { add(`Actor de conexión inexistente: ${id}`); continue; }
      if (!row.asset) continue;
      for (const pose of row.poses) if (!Object.hasOwn(row.asset.poses[pose]?.anchors || {}, anchor)) add(`Ancla inexistente: ${id}:${pose}:${anchor}`);
    }
    for (const f of Object.values(p.formato || {})) for (const [id, override] of Object.entries(f.elenco || {})) {
      const row = actors.get(id);
      if (!row) add(`Actor de formato inexistente: ${id}`);
      else if (override.escala != null && row.asset) scale(row.asset, override.escala);
    }
    return errors;
  }

  function configure(options) {
    clear();
    catalog = options.catalog; sceneSchema = options.sceneSchema; catalogSchema = options.catalogSchema;
    if (options.baseURL) baseURL = options.baseURL;
    loading = null;
  }
  async function load() {
    if (catalog && sceneSchema) return;
    if (!loading) loading = Promise.all(["catalog.json", "schema/escena.schema.json", "schema/catalog.schema.json"].map(async path => {
      const response = await fetch(new URL(path, baseURL));
      if (!response.ok) throw new Error(`No carga la biblioteca: ${path} (${response.status})`);
      return response.json();
    })).then(([cat, scene, cs]) => { catalog = cat; sceneSchema = scene; catalogSchema = cs; });
    await loading;
  }
  function drop(entry) {
    residents.delete(entry);
    entry.data.ready = false;
    for (const dispose of [...entry.data.instances]) dispose();
    entry.data.media.clear();
    for (const [file, resource] of images) {
      resource.users.delete(entry);
      if (!resource.users.size) {
        images.delete(file); mediaPixels -= resource.pixels;
        resource.cancel?.();
      }
    }
  }
  function pinned(entry) { return [...windows].some(w => w.params.has(entry.params)); }
  function room(pixels, files) {
    for (const entry of residents) {
      if (mediaPixels + pixels <= MAX_CACHE_PIXELS && images.size + files <= MAX_CACHE_FILES) break;
      if (!pinned(entry)) drop(entry);
    }
    if (mediaPixels + pixels > MAX_CACHE_PIXELS || images.size + files > MAX_CACHE_FILES)
      throw new Error(WINDOW_ERROR);
  }
  function pump() {
    while (decoding < 2 && decodeQueue.length) {
      const job = decodeQueue.shift();
      if (!job.resource.users.size) { job.reject(new Error("Precarga de capas liberada")); continue; }
      decoding++;
      job.run().then(job.resolve, job.reject).finally(() => { decoding--; pump(); });
    }
  }
  async function decodeResource(file, w, h, resource) {
    // Los bitmaps tienen liberación explícita; no dejan sesenta escenas en la
    // caché de imágenes decodificadas del navegador al soltar sus elementos img.
    if (typeof createImageBitmap === "function") {
      const controller = new AbortController(); let bitmap;
      resource.cancel = () => { controller.abort(); bitmap?.close(); };
      const response = await fetch(new URL(file, baseURL), { signal: controller.signal });
      if (!response.ok) throw new Error(`No carga imagen de capas: ${file} (${response.status})`);
      bitmap = await createImageBitmap(await response.blob());
      if (!resource.users.size) { bitmap.close(); throw new Error("Precarga de capas liberada"); }
      if (bitmap.width !== w || bitmap.height !== h) { bitmap.close(); throw new Error(`Tamaño distinto al catálogo: ${file}`); }
      return bitmap;
    }
    // Compatibilidad con consumidores sin ImageBitmap (incluidos los fixtures).
    return new Promise((resolve, reject) => {
      const image = new Image();
      const finish = error => { image.onload = image.onerror = null; error ? reject(error) : resolve(image); };
      resource.cancel = () => { finish(new Error("Precarga de capas liberada")); image.removeAttribute?.("src"); };
      image.onload = async () => {
        try {
          await image.decode();
          if (image.width !== w || image.height !== h) throw new Error("Tamaño distinto al catálogo");
          finish();
        } catch (e) { finish(new Error(`Imagen sin decodificar o inválida: ${file}: ${e.message}`)); }
      };
      image.onerror = () => finish(new Error(`No carga imagen de capas: ${file}`));
      image.src = new URL(file, baseURL).href;
    });
  }
  async function decode(file, w, h, entry) {
    if (!images.has(file)) {
      room(w * h, 1);
      mediaPixels += w * h;
      const resource = { pixels: w * h, users: new Set([entry]) };
      resource.promise = new Promise((resolve, reject) => {
        decodeQueue.push({ resource, resolve, reject, run: () => decodeResource(file, w, h, resource) });
      });
      images.set(file, resource);
      pump();
    }
    const resource = images.get(file);
    resource.users.add(entry);
    const image = await resource.promise;
    if (!residents.has(entry)) throw new Error("Precarga de capas liberada");
    return image;
  }
  async function prepare(p, duration, budgetError) {
    const object = p !== null && typeof p === "object", signature = JSON.stringify(p);
    const previous = object ? prepared.get(p) : null;
    if (previous && residents.has(previous) && previous.duration === duration && previous.signature === signature && previous.budgetError === budgetError) {
      residents.delete(previous); residents.add(previous); return previous.promise;
    }
    if (previous) drop(previous);
    const data = { errors: [], ready: false, media: new Map(), instances: new Set(), scene: object ? JSON.parse(signature) : p };
    const entry = { params: p, duration, signature, data, budgetError };
    // También acotar preparaciones vacías o inválidas que no reservan píxeles.
    for (const old of residents) if (residents.size >= 128 && !pinned(old)) drop(old);
    residents.add(entry);
    /* Publicar la promesa, no un resultado a medio llenar: dos consumidores esperan
       la misma decodificación. Cada duración y revisión se valida por separado. */
    entry.promise = prepareData(entry, duration);
    if (object) prepared.set(p, entry);
    return entry.promise;
  }
  async function prepareData(entry, duration) {
    const data = entry.data;
    try {
      await load();
      if (!residents.has(entry)) return data;
      const p = data.scene;
      const ce = validateCatalog(catalog);
      data.errors = ce.length ? ce : validateScene(p, catalog, duration);
      if (data.errors.length) return data;
      const files = sceneFiles(p);
      if (files.size > 128 || [...files.values()].reduce((n, c) => n + c.w * c.h, 0) > MAX_MEDIA_PIXELS)
        throw new Error("La escena supera el presupuesto de imágenes de capas (64 MiB / 128 archivos). Reduzca los lienzos, poses o máscaras de este beat.");
      if (entry.budgetError) throw new Error(entry.budgetError);
      const queue = [...files]; let next = 0;
      const workers = await Promise.allSettled(Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (next < queue.length) { const [file, { w, h }] = queue[next++]; data.media.set(file, await decode(file, w, h, entry)); }
      }));
      const failed = workers.find(result => result.status === "rejected");
      if (failed) throw failed.reason;
    } catch (e) { const released = !residents.has(entry); drop(entry); data.errors = [e.message]; if (!released) residents.add(entry); }
    finally { data.ready = residents.has(entry); }
    return data;
  }
  function sceneFiles(p) {
    const files = new Map();
    for (const actor of p.elenco) {
      const a = catalog.assets.find(a => a.id === actor.asset);
      const poses = new Set([actor.pose || a.default_pose, ...(p.eventos || []).filter(e => e.id === actor.id && e.accion === "pose").map(e => e.valor)]);
      for (const pose of poses) {
        const pp = a.poses[pose]; files.set(pp.file, a.canvas);
        for (const mask of Object.values(pp.masks)) files.set(mask, a.canvas);
      }
    }
    return files;
  }
  async function prepareBeats(beats, { time = beats[0]?.t0 ?? 0 } = {}) {
    await load();
    beats = [...beats].sort((a, b) => (a.t0 || 0) - (b.t0 || 0));
    for (const b of beats) if (b.params == null) b.params = {};
    let key, pending = Promise.resolve(), work = Promise.resolve(), closed = false;
    const window = { params: new Set(),
      update(t) {
        if (closed) return Promise.resolve();
        const active = beats.filter(b => t >= (b.t0 || 0) && t < (b.t1 ?? (b.t0 || 0) + b.dur));
        const before = beats.filter(b => (b.t1 ?? (b.t0 || 0) + b.dur) <= t).at(-1);
        const after = beats.find(b => (b.t0 || 0) > t);
        const selected = [...active], files = new Map();
        const needed = b => { try { return sceneFiles(b.params); } catch { return new Map(); } };
        for (const b of active) for (const [file, canvas] of needed(b)) files.set(file, canvas);
        const overflow = files.size > MAX_CACHE_FILES || [...files.values()].reduce((n, c) => n + c.w * c.h, 0) > MAX_CACHE_PIXELS;
        // Nunca dejar que una precarga desplace lo visible. La elección depende
        // solo de t y de los lienzos, no de qué se haya visitado anteriormente.
        for (const b of [after, (active.length || after) && before].filter(Boolean)) {
          if (overflow) break;
          const union = new Map([...files, ...needed(b)]);
          if (union.size <= MAX_CACHE_FILES && [...union.values()].reduce((n, c) => n + c.w * c.h, 0) <= MAX_CACHE_PIXELS) {
            selected.push(b); for (const [file, canvas] of union) files.set(file, canvas);
          }
        }
        const nextKey = selected.map(b => beats.indexOf(b)).join(":");
        if (nextKey === key) return pending;
        key = nextKey;
        let ready;
        pending = new Promise(resolve => { ready = resolve; });
        work = work.then(async () => {
          try {
            if (closed || key !== nextKey) return;
            window.params = new Set(selected.map(b => b.params));
            for (const entry of residents) if (!pinned(entry)) drop(entry);
            for (const b of active) { if (closed) return; await prepare(b.params, b.dur, overflow ? WINDOW_ERROR : undefined); }
            ready();
            // Los vecinos usan la misma cola, sin retrasar un cuadro ya listo.
            for (const b of selected.filter(b => !active.includes(b))) {
              if (closed || key !== nextKey) break;
              await prepare(b.params, b.dur);
            }
          } finally { ready(); }
        });
        return pending;
      },
      dispose() { closed = true; windows.delete(window); window.params.clear(); for (const entry of residents) if (!pinned(entry)) drop(entry); },
    };
    windows.add(window);
    await window.update(time);
    return window;
  }

  function surface(w, h) {
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; return canvas;
  }
  function errorCard(G, stage, errors) {
    const { W, H } = stage, unit = Math.min(W, H);
    G.save(); G.fillStyle = "#06080C"; G.fillRect(0, 0, W, H);
    G.fillStyle = "#E3262F"; G.fillRect(W * 0.08, H * 0.24, W * 0.84, unit * 0.012);
    G.textAlign = "left"; G.textBaseline = "top";
    G.font = `700 ${unit * 0.045}px sans-serif`; G.fillStyle = "#EFE9DF";
    G.fillText("ESCENA DE CAPAS INVÁLIDA", W * 0.09, H * 0.29, W * 0.82);
    G.font = `${unit * 0.032}px sans-serif`;
    let y = H * 0.4;
    const words = errors.slice(0, 3).join(" · ").split(/\s+/); let line = "";
    for (const word of words) {
      if (G.measureText(line + word).width > W * 0.8 && line) { G.fillText(line, W * 0.09, y); y += unit * 0.047; line = ""; }
      line += word + " ";
      if (y > H * 0.75) break;
    }
    if (line) G.fillText(line, W * 0.09, y, W * 0.8);
    G.restore();
  }

  /* Una semilla fija produce el mismo grano al buscar adelante y atrás. */
  function grain() {
    const tile = surface(128, 128), G = tile.getContext("2d"), pixels = G.createImageData(128, 128);
    let seed = 87131;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = seed >>> 24; pixels.data[i + 3] = 80;
    }
    G.putImageData(pixels, 0, 0); return tile;
  }
  function background(G, st, p, t, dur, noise) {
    const { W, H } = st, f = p.fondo || {}, preset = f.preset || "foco", color = f.color || "#0B1220", accent = f.acento || "#1F6BFF";
    G.fillStyle = color; G.fillRect(0, 0, W, H);
    if (preset !== "liso") {
      const x = W * (0.48 + 0.025 * Math.sin(t * 0.13));
      const grad = preset === "degradado" ? G.createLinearGradient(0, H, W, 0) : G.createRadialGradient(x, H * 0.3, 0, x, H * 0.5, Math.max(W, H) * 0.8);
      grad.addColorStop(0, accent); grad.addColorStop(1, color);
      G.globalAlpha = 0.4; G.fillStyle = grad; G.fillRect(0, 0, W, H); G.globalAlpha = 1;
    }
    if (preset === "horizonte" || preset === "ciudad") {
      const grad = G.createLinearGradient(0, H * 0.5, 0, H * 0.8);
      grad.addColorStop(0, accent + "00"); grad.addColorStop(0.65, accent + "88"); grad.addColorStop(1, color);
      G.fillStyle = grad; G.fillRect(0, H * 0.5, W, H * 0.5);
    }
    if (preset === "ciudad") {
      for (let layer = 0; layer < 2; layer++) {
        G.fillStyle = layer ? "#06080C" : "#1A212C";
        const drift = camera(p.camara || {}, t, dur, layer ? 0.4 : 0.9, st).dx;
        for (let i = -2; i < 25; i++) {
          const bh = H * (0.06 + ((i * i * 13 + layer * 7) % 17) * 0.009), bw = W / 18;
          G.fillRect(i * bw + drift, H * (layer ? 0.9 : 0.79) - bh, bw * 0.84, bh + H * 0.3);
        }
      }
    }
    if (preset === "sala") {
      G.strokeStyle = accent + "55"; G.lineWidth = Math.max(1, W * 0.0015);
      for (let i = 0; i <= 8; i++) { G.beginPath(); G.moveTo(W * 0.5, H * 0.45); G.lineTo(W * (i / 8), H); G.stroke(); }
      G.strokeRect(W * 0.12, H * 0.17, W * 0.76, H * 0.55);
      for (let i = 1; i < 6; i++) { G.beginPath(); G.moveTo(W * 0.12, H * (0.72 + i * i * 0.008)); G.lineTo(W * 0.88, H * (0.72 + i * i * 0.008)); G.stroke(); }
    }
    if (preset === "rayos" || preset === "foco") {
      G.save(); G.translate(W * 0.5, -H * 0.1); G.fillStyle = accent; G.globalAlpha = preset === "rayos" ? 0.07 : 0.05;
      for (let i = 0; i < (preset === "rayos" ? 9 : 1); i++) { G.save(); G.rotate((i - 4) * 0.18 + Math.sin(t * 0.1) * 0.02); G.beginPath(); G.moveTo(0, 0); G.lineTo(-W * 0.3, H * 1.3); G.lineTo(W * 0.3, H * 1.3); G.fill(); G.restore(); }
      G.restore();
    }
    const vignette = G.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.65);
    vignette.addColorStop(0, "#00000000"); vignette.addColorStop(1, "#000000E8");
    G.globalAlpha = f.vineta ?? 1; G.fillStyle = vignette; G.fillRect(0, 0, W, H); G.globalAlpha = 1;
    if ((f.grano ?? 0.15) > 0) { G.globalAlpha = f.grano ?? 0.15; G.fillStyle = G.createPattern(noise, "repeat"); G.fillRect(0, 0, W, H); G.globalAlpha = 1; }
  }
  function camera(c, t, dur, depth, st) {
    const q = clamp(t / dur), n = c.intensidad ?? 0.04, weight = 1 - depth * 0.72;
    let zoom = 1, dx = 0, dy = 0;
    if (c.mov === "acercar") zoom += q * n * weight;
    if (c.mov === "alejar") zoom += (1 - q) * n * weight;
    if (c.mov === "paneo-izq") dx = -st.W * n * q * weight;
    if (c.mov === "paneo-der") dx = st.W * n * q * weight;
    if (c.mov === "temblor") { dx = Math.sin(t * 43) * st.W * n * 0.15 * weight; dy = Math.sin(t * 57) * st.H * n * 0.1 * weight; }
    return { zoom, dx, dy };
  }
  function motion(name, t, dur, st) {
    const q = clamp(t / Math.max(dur, 0.001)), out = 1 - (1 - q) ** 3;
    const m = { x: 0, y: 0, scale: 1, angle: 0, alpha: 1 };
    if (name === "entrar-sube") { m.y = st.H * 0.25 * (1 - out); m.alpha = out; }
    if (name === "entrar-cae") { m.y = -st.H * 0.8 * (1 - q * q); m.alpha = clamp(q * 4); }
    if (name === "entrar-desliza") { m.x = -st.W * 0.6 * (1 - out); m.alpha = out; }
    if (name === "salir-cae") { m.y = st.H * 1.3 * q * q; m.angle = q * 0.2; m.alpha = 1 - q; }
    if (name === "salir-funde") m.alpha = 1 - smooth(q);
    if (name === "respirar") { m.scale = 1 + 0.006 * Math.sin(t * 2.4); m.y = -st.H * 0.002 * Math.sin(t * 2.4); }
    if (name === "flotar") m.y = st.H * 0.012 * Math.sin(t * 1.7);
    if (name === "temblar") { m.x = st.W * 0.003 * Math.sin(t * 41); m.y = st.H * 0.002 * Math.sin(t * 53); }
    if (name === "girar") m.angle = t * 0.3;
    if (name === "caer") { m.y = st.H * 1.25 * q * q; m.angle = q * 1.35; }
    if (name === "latir") m.scale = 1 + 0.035 * Math.max(0, Math.sin(t * 5)) ** 4;
    return m;
  }
  function addMotion(target, m) { target.x += m.x; target.y += m.y; target.angle += m.angle; target.scale *= m.scale; target.alpha *= m.alpha; }
  /* Las pistas se evalúan desde cero; un evento nuevo parte del valor interpolado
     al comienzo de ese evento, incluso si interrumpe al anterior. */
  function track(initial, events, time, interpolate = mix) {
    let from = initial, to = initial, start = -1, duration = 0;
    const at = t => duration ? interpolate(from, to, smooth((t - start) / duration)) : to;
    for (const e of events) { if (e.en > time) break; const current = at(e.en); from = current; to = e.target; start = e.en; duration = e.duration || 0; }
    return at(time);
  }
  function actorState(actor, asset, p, t, dur, st) {
    const override = p.formato?.[st.portrait ? "9x16" : "16x9"]?.elenco?.[actor.id] || {};
    const a = { ...actor, ...override }, events = (p.eventos || []).filter(e => e.id === a.id).slice().sort((a, b) => a.en - b.en);
    const position = key => track(a[key] ?? (key === "x" ? 0.5 : key === "y" ? 0.9 : asset.defaults.scale), events.filter(e => key === "escala" ? e.accion === "escala" : e.accion === "mover").map(e => ({ en: e.en, target: key === "escala" ? e.valor.valor : e.valor[key], duration: e.valor.dur })), t);
    let pose = a.pose || asset.default_pose, silhouette = a.estilo?.silueta || false, anim = a.anim, animStart = 0;
    for (const e of events) if (e.en <= t) {
      if (e.accion === "pose") pose = e.valor;
      if (e.accion === "silueta") silhouette = e.valor;
      if (e.accion === "anim") { anim = e.valor; animStart = e.en; }
    }
    const depth = a.profundidad ?? 0, cam = camera(p.camara || {}, t, dur, depth, st);
    const m = { x: (position("x") * st.W - st.W / 2) * cam.zoom + st.W / 2 + cam.dx, y: (position("y") * st.H - st.H / 2) * cam.zoom + st.H / 2 + cam.dy, scale: position("escala") * 0.6 * st.H / asset.height_ref * cam.zoom, angle: 0, alpha: 1 };
    if (anim) addMotion(m, motion(anim, t - animStart, anim === "caer" || anim.startsWith("salir-") ? .5 : anim.startsWith("entrar-") ? .6 : dur - animStart, st));
    if (a.entrada) addMotion(m, motion(a.entrada.anim, t, a.entrada.dur, st));
    for (const e of events) if (e.accion === "salir" && e.en <= t) addMotion(m, motion(e.valor, t - e.en, 0.5, st));
    return { ...m, pose, silhouette, depth, mirror: !!a.espejo, style: a.estilo || {}, events };
  }
  function anchorPoint(state, asset, point) {
    let x = (point[0] - asset.pivot[0]) * state.scale * (state.mirror ? -1 : 1), y = (point[1] - asset.pivot[1]) * state.scale;
    return { x: state.x + x * Math.cos(state.angle) - y * Math.sin(state.angle), y: state.y + x * Math.sin(state.angle) + y * Math.cos(state.angle) };
  }

  function create(ctx, p, dur) {
    const entry = prepared.get(p), data = entry?.data;
    const errors = data?.ready && entry?.duration === dur && entry?.signature === JSON.stringify(p) ? data.errors : ["Escena sin preparar para esta duración: espere Kit.capas.prepare antes de capturar"];
    const st = ctx.stage;
    if (errors.length) return { render() { errorCard(ctx.g.main, st, errors); }, dispose() {}, errors };
    p = data.scene;
    const assets = new Map(catalog.assets.map(a => [a.id, a])), tints = new Map(), masks = new Map(), silhouettes = new Map(), soft = new Map(), noise = grain();
    const resolution = new Map();
    for (const actor of p.elenco) {
      const a = assets.get(actor.asset), override = p.formato?.[st.portrait ? "9x16" : "16x9"]?.elenco?.[actor.id];
      const scales = [override?.escala ?? actor.escala ?? a.defaults.scale, ...(p.eventos || []).filter(e => e.id === actor.id && e.accion === "escala").map(e => e.valor.valor)];
      const ratio = Math.min(1, Math.max(.25, Math.max(...scales) * st.H * .6 / a.height_ref * 1.2));
      resolution.set(a.id, Math.max(resolution.get(a.id) || 0, ratio));
    }
    const dimensions = a => [Math.ceil(a.canvas.w * resolution.get(a.id)), Math.ceil(a.canvas.h * resolution.get(a.id))];
    const owned = new Set([noise]); let disposed = false, pixelsOwned = noise.width * noise.height;
    const canvas = (w, h) => {
      if (pixelsOwned + w * h > MAX_CANVAS_PIXELS) throw new Error("La escena supera el presupuesto de composiciones de capas (128 MiB). Reduzca poses, zonas o colores por beat.");
      const c = surface(w, h); owned.add(c); pixelsOwned += w * h; return c;
    };
    const free = () => { for (const c of owned) { c.width = 0; c.height = 0; } owned.clear(); masks.clear(); tints.clear(); silhouettes.clear(); soft.clear(); pixelsOwned = 0; };
    const dispose = () => { if (disposed) return; disposed = true; free(); data.instances.delete(dispose); };
    data.instances.add(dispose);
    function maskAlpha(file, a) {
      if (!masks.has(file)) {
        const image = data.media.get(file), c = canvas(...dimensions(a)), G = c.getContext("2d", { willReadFrequently: true });
        G.drawImage(image, 0, 0, c.width, c.height);
        const pixels = G.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < pixels.data.length; i += 4) { pixels.data[i + 3] = Math.round(pixels.data[i] * pixels.data[i + 3] / 255); pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255; }
        G.putImageData(pixels, 0, 0); masks.set(file, c);
      }
      return masks.get(file);
    }
    function tint(a, pose, zone, color) {
      const key = `${a.id}:${pose}:${zone}:${color}`;
      if (!tints.has(key)) {
        const pp = a.poses[pose], c = canvas(...dimensions(a)), G = c.getContext("2d");
        G.drawImage(maskAlpha(pp.masks[zone], a), 0, 0); G.globalCompositeOperation = "source-in"; G.fillStyle = color; G.fillRect(0, 0, c.width, c.height);
        G.globalCompositeOperation = "destination-in"; G.drawImage(data.media.get(pp.file), 0, 0, c.width, c.height);
        tints.set(key, c);
      }
      return tints.get(key);
    }
    function silhouette(a, pose, color) {
      const key = `${a.id}:${pose}:${color}`;
      if (!silhouettes.has(key)) {
        const c = canvas(...dimensions(a)), G = c.getContext("2d");
        G.drawImage(data.media.get(a.poses[pose].file), 0, 0, c.width, c.height); G.globalCompositeOperation = "source-in"; G.fillStyle = color; G.fillRect(0, 0, c.width, c.height); silhouettes.set(key, c);
      }
      return silhouettes.get(key);
    }
    function softLayer(a, pose, actor) {
      const key = `${actor.id}:${pose}`;
      if (!soft.has(key)) {
        const c = canvas(...dimensions(a)), G = c.getContext("2d"), rim = actor.estilo?.brillo || a.defaults.rim;
        /* El desenfoque del fondo se rasteriza una vez, no en cada drawImage
           de la figura, su borde y sus zonas durante los 150 cuadros. */
        G.filter = "blur(1.5px)";
        const edge = silhouette(a, pose, rim);
        for (const [x, y] of [[-2, 0], [2, 0], [0, -2]]) G.drawImage(edge, x, y);
        G.drawImage(actor.estilo?.silueta ? silhouette(a, pose, "#06080C") : data.media.get(a.poses[pose].file), 0, 0, c.width, c.height);
        if (!actor.estilo?.silueta) for (const [zone, spec] of Object.entries(a.color_zones)) G.drawImage(tint(a, pose, zone, actor.estilo?.zonas?.[zone] || spec.default), 0, 0);
        soft.set(key, c);
      }
      return soft.get(key);
    }
    /* Preparar todos los colores extremos evita nuevas capas por cuadro al interpolar. */
    let blend;
    try { for (const actor of p.elenco) {
      const a = assets.get(actor.asset), poses = new Set([actor.pose || a.default_pose, ...(p.eventos || []).filter(e => e.id === actor.id && e.accion === "pose").map(e => e.valor)]);
      for (const pose of poses) {
        silhouette(a, pose, "#06080C"); silhouette(a, pose, actor.estilo?.brillo || a.defaults.rim);
        for (const [zone, spec] of Object.entries(a.color_zones)) {
          const colors = new Set([actor.estilo?.zonas?.[zone] || spec.default, ...(p.eventos || []).filter(e => e.id === actor.id && e.accion === "color" && e.valor.zona === zone).map(e => e.valor.color)]);
          for (const color of colors) tint(a, pose, zone, color);
        }
        const override = p.formato?.[st.portrait ? "9x16" : "16x9"]?.elenco?.[actor.id];
        if ((override?.profundidad ?? actor.profundidad ?? 0) > .65 && !(p.eventos || []).some(e => e.id === actor.id && ["color", "silueta"].includes(e.accion))) softLayer(a, pose, actor);
      }
    }
      if (p.elenco.length) blend = canvas(Math.max(...p.elenco.map(actor => dimensions(assets.get(actor.asset))[0])), Math.max(...p.elenco.map(actor => dimensions(assets.get(actor.asset))[1])));
    } catch (e) {
      dispose(); const errors = [e.message];
      return { errors, render() { errorCard(ctx.g.main, st, errors); }, dispose() {}, stats() { return { surfaces: 0, tints: 0, masks: 0, pixels: 0 }; } };
    }
    function drawActor(G, actor, a, s, t) {
      const style = s.style, rim = style.brillo || a.defaults.rim, shadow = style.sombra ?? a.defaults.shadow, glow = style.halo ?? a.defaults.glow;
      if (glow) {
        G.save(); G.globalAlpha = s.alpha * glow;
        const center = anchorPoint(s, a, [a.pivot[0], a.pivot[1] - a.height_ref * 0.48]), radius = Math.abs(a.height_ref * s.scale * 0.65);
        const grad = G.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        grad.addColorStop(0, rim + "99"); grad.addColorStop(1, rim + "00"); G.fillStyle = grad; G.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2); G.restore();
      }
      if (shadow) { G.save(); G.globalAlpha = s.alpha * 0.55; G.fillStyle = "#000000"; G.beginPath(); G.ellipse(s.x, s.y + st.H * 0.005, a.height_ref * s.scale * 0.25, Math.max(st.H * 0.004, a.height_ref * s.scale * 0.025), 0, 0, Math.PI * 2); G.fill(); G.restore(); }
      G.save(); G.globalAlpha = s.alpha; G.translate(s.x, s.y); G.rotate(s.angle); G.scale(s.scale * (s.mirror ? -1 : 1), s.scale); G.translate(-a.pivot[0], -a.pivot[1]);
      const cachedSoft = s.depth > .65 && soft.get(`${actor.id}:${s.pose}`);
      if (cachedSoft) { G.drawImage(cachedSoft, 0, 0, a.canvas.w, a.canvas.h); G.restore(); return; }
      if (s.depth > 0.65) G.filter = `blur(${(s.depth - 0.65) * 1.5}px)`;
      if (a.defaults.rim || style.brillo) {
        const border = silhouette(a, s.pose, rim), r = Math.max(1, 1.2 / s.scale);
        for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r]]) G.drawImage(border, dx, dy, a.canvas.w, a.canvas.h);
      }
      G.drawImage(s.silhouette ? silhouette(a, s.pose, "#06080C") : data.media.get(a.poses[s.pose].file), 0, 0, a.canvas.w, a.canvas.h);
      if (!s.silhouette) for (const [zone, spec] of Object.entries(a.color_zones)) {
        const initial = actor.estilo?.zonas?.[zone] || spec.default;
        const events = s.events.filter(e => e.accion === "color" && e.valor.zona === zone);
        /* Una mezcla lineal de las capas de color reproduce transiciones interrumpidas
           sin generar infinitas entradas en la caché. */
        let weights = { [initial]: 1 }, from = weights, to = initial, start = -1, duration = 0;
        const at = time => { if (!duration) return weights; const q = smooth((time - start) / duration), out = {}; for (const [color, w] of Object.entries(from)) out[color] = w * (1 - q); out[to] = (out[to] || 0) + q; return out; };
        for (const e of events) { if (e.en > t) break; from = at(e.en); to = e.valor.color; start = e.en; duration = e.valor.dur; weights = { [to]: 1 }; }
        const weightsAtTime = Object.entries(at(t)).filter(([, weight]) => weight > 0.00001);
        if (weightsAtTime.length === 1) G.drawImage(tint(a, s.pose, zone, weightsAtTime[0][0]), 0, 0, a.canvas.w, a.canvas.h);
        else {
          const B = blend.getContext("2d"); B.clearRect(0, 0, blend.width, blend.height); B.globalCompositeOperation = "lighter";
          for (const [color, weight] of weightsAtTime) { B.globalAlpha = weight; B.drawImage(tint(a, s.pose, zone, color), 0, 0); }
          B.globalAlpha = 1; G.drawImage(blend, 0, 0, ...dimensions(a), 0, 0, a.canvas.w, a.canvas.h);
        }
      }
      G.restore();
    }
    function drawConnection(G, c, states) {
      const point = end => { const [id, anchor] = end.split(":"), row = states.get(id); return anchorPoint(row.s, row.a, row.a.poses[row.s.pose].anchors[anchor]); };
      const de = point(c.de), a = point(c.a), actors = [c.de, c.a].map(end => states.get(end.split(":")[0]));
      G.save(); G.globalAlpha = Math.min(...actors.map(row => row.s.alpha)); G.strokeStyle = c.color || "#EFE9DF"; G.lineWidth = Math.max(1.2, st.u * 0.2);
      if (c.tipo === "linea") { G.shadowColor = G.strokeStyle; G.shadowBlur = st.u * 0.8; }
      if (c.tipo === "cadena") G.setLineDash([st.u * 0.65, st.u * 0.35]);
      G.beginPath(); G.moveTo(de.x, de.y);
      if (c.tipo === "hilo") G.quadraticCurveTo((de.x + a.x) / 2 + (a.y - de.y) * 0.03, (de.y + a.y) / 2 + st.H * 0.02, a.x, a.y);
      else G.lineTo(a.x, a.y);
      G.stroke(); G.restore();
    }
    function texts(G) {
      for (const text of p.textos || []) {
        let size = st.u * (text.estilo === "titulo" ? 6 : text.estilo === "etiqueta" ? 2.6 : 3.8);
        G.save(); G.textAlign = "center"; G.textBaseline = "middle"; G.fillStyle = text.color || "#EFE9DF";
        const font = ctx.C?.fonts?.main || "sans-serif";
        G.font = `800 ${size}px ${font}`;
        const words = text.texto.split(/\s+/), lines = []; let line = "";
        for (const word of words) { if (G.measureText((line + " " + word).trim()).width > st.W * 0.82 && line) { lines.push(line); line = ""; } line = (line + " " + word).trim(); }
        if (line) lines.push(line);
        const maxHeight = st.H * 0.18;
        size = Math.min(size, maxHeight / Math.max(1, lines.length) / 1.15); G.font = `800 ${size}px ${font}`;
        const y = text.pos === "abajo" ? st.H * 0.82 : text.pos === "centro" ? st.H * 0.5 : st.H * 0.13;
        G.shadowColor = "#06080C"; G.shadowBlur = size * 0.2;
        lines.forEach((line, i) => G.fillText(line, st.W / 2, y + (i - (lines.length - 1) / 2) * size * 1.15, st.W * 0.82)); G.restore();
      }
    }
    return {
      errors: [],
      render(time) {
        if (disposed) return;
        const t = clamp(time, 0, dur), G = ctx.g.main;
        G.save();
        background(G, st, p, t, dur, noise);
        const states = new Map(p.elenco.map(actor => { const a = assets.get(actor.asset); return [actor.id, { actor, a, s: actorState(actor, a, p, t, dur, st) }]; }));
        for (const row of [...states.values()].sort((a, b) => b.s.depth - a.s.depth)) drawActor(G, row.actor, row.a, row.s, t);
        for (const c of p.conexiones || []) drawConnection(G, c, states);
        texts(G); G.restore();
      },
      anchors(time) {
        return Object.fromEntries(p.elenco.map(actor => { const a = assets.get(actor.asset), s = actorState(actor, a, p, clamp(time, 0, dur), dur, st); return [actor.id, Object.fromEntries(Object.entries(a.poses[s.pose].anchors).map(([key, point]) => [key, anchorPoint(s, a, point)]))]; }));
      },
      stats() { return { surfaces: owned.size, tints: tints.size, masks: masks.size, pixels: [...owned].reduce((n, c) => n + c.width * c.height, 0) }; },
      dispose,
    };
  }
  function clear() {
    for (const w of [...windows]) w.dispose();
    for (const entry of residents) drop(entry);
    prepared = new WeakMap();
  }
  K.capas = { configure, load, prepare, prepareBeats, validateScene, validateCatalog, schemaErrors, create, errorCard, clear,
    stats() { return { mediaBytes: mediaPixels * 4, mediaFiles: images.size, scenes: residents.size, decoding, queued: decodeQueue.length,
      instances: [...residents].reduce((n, entry) => n + entry.data.instances.size, 0) }; },
    budgets: { mediaBytes: MAX_MEDIA_PIXELS * 4, compositionBytes: MAX_CANVAS_PIXELS * 4, mediaFiles: 128,
      cacheBytes: MAX_CACHE_PIXELS * 4, cacheFiles: MAX_CACHE_FILES }, version: "1.1.0" };
  if (typeof module !== "undefined" && module.exports) module.exports = K.capas;
})(typeof window !== "undefined" ? window : globalThis);
