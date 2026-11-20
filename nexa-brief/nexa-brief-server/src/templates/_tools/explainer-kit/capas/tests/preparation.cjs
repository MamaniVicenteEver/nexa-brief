/* Regresiones de la barrera de medios: decodificación, duración y error atómico. */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const test = require("node:test");
const kit = path.resolve(__dirname, "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(kit, file), "utf8"));
const source = fs.readFileSync(path.join(kit, "capas/runtime/capas.js"), "utf8");
const flushMicrotasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture({ holdDecode = false, holdPattern = null, width = 1024, height = 1536 } = {}) {
  let release;
  const gate = holdDecode ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const requested = [], decoded = [], written = [];
  class Image {
    constructor() { this.width = width; this.height = height; }
    set src(value) {
      this.url = value;
      requested.push(value);
      queueMicrotask(() => this.onload());
    }
    async decode() { if (!holdPattern || this.url.includes(holdPattern)) await gate; decoded.push(this.url); }
  }
  const G = {
    save() {}, restore() {}, fillRect() {},
    fillText(text) { written.push(text); },
    measureText(text) { return { width: text.length * 12 }; },
  };
  const context = { module: { exports: {} }, Image, URL };
  vm.createContext(context); vm.runInContext(source, context);
  const rt = context.module.exports;
  const catalog = read("capas/tests/fixtures/catalog.json");
  for (const asset of catalog.assets) asset.canvas = { w: width, h: height };
  rt.configure({
    catalog,
    sceneSchema: read("capas/schema/escena.schema.json"),
    catalogSchema: read("capas/schema/catalog.schema.json"),
    baseURL: "http://fixture.invalid/",
  });
  return {
    rt, requested, decoded, written, release,
    scene: read("capas/tests/fixtures/scene.json"),
    ctx: { g: { main: G }, stage: { W: 1280, H: 720 } },
  };
}

test("dos preparaciones concurrentes esperan la decodificación completa", async () => {
  const f = fixture({ holdDecode: true });
  let firstDone = false, secondDone = false;
  const first = f.rt.prepare(f.scene, 6).then(data => { firstDone = true; return data; });
  const second = f.rt.prepare(f.scene, 6).then(data => { secondDone = true; return data; });
  await flushMicrotasks();
  try {
    assert.ok(f.requested.length > 0, "la carga debe haber comenzado");
    assert.equal(f.decoded.length, 0, "decode sigue pendiente");
    assert.equal(firstDone, false, "la primera espera decode");
    assert.equal(secondDone, false, "la segunda también debe esperar decode");
    assert.ok(f.requested.length <= 2, "la carga limita la concurrencia a dos imágenes");
  } finally { f.release(); }
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.errors.length, 0);
  assert.equal(b.errors.length, 0);
  assert.equal(a.media.size, f.requested.length);
  assert.equal(b.media.size, f.requested.length);
  assert.equal(f.decoded.length, f.requested.length);
});

test("el mismo objeto se revalida cuando cambia la duración del beat", async () => {
  const f = fixture();
  const longBeat = await f.rt.prepare(f.scene, 6);
  assert.equal(longBeat.errors.length, 0);
  const shortBeat = await f.rt.prepare(f.scene, 1);
  assert.ok(shortBeat.errors.length, "los eventos posteriores al segundo uno son errores");
  const instance = f.rt.create(f.ctx, f.scene, 1);
  assert.ok(instance.errors.length);
  instance.render(0);
  assert.ok(f.written.includes("ESCENA DE CAPAS INVÁLIDA"));
});

test("params primitivos pasan la barrera de boot y producen tarjeta de error", async () => {
  for (const params of ["texto", 7, true, null, undefined]) {
    const f = fixture();
    const data = await f.rt.prepare(params, 6);
    assert.ok(data.errors.length, `estructura inválida: ${String(params)}`);
    const beat = { use: "common.capas", params, dur: 6 };
    await f.rt.prepareBeats([beat]);
    const instance = f.rt.create(f.ctx, beat.params, 6);
    assert.ok(instance.errors.length);
    assert.doesNotThrow(() => instance.render(0));
    assert.ok(f.written.includes("ESCENA DE CAPAS INVÁLIDA"));
    assert.equal(f.requested.length, 0, "una escena inválida no solicita imágenes");
  }
});

test("editar el mismo objeto obliga a volver a validar sus referencias", async () => {
  const f = fixture();
  assert.equal((await f.rt.prepare(f.scene, 6)).errors.length, 0);
  f.scene.elenco[0].asset = "no-existe";
  assert.ok((await f.rt.prepare(f.scene, 6)).errors.length);
  assert.ok(f.rt.create(f.ctx, f.scene, 6).errors.length);
});

test("el presupuesto de medios se comprueba antes de pedir otra imagen", async () => {
  // Cada lienzo RGBA de 4K ocupa 64 MiB. El mock no reserva memoria de píxeles.
  const f = fixture({ width: 4096, height: 4096 });
  const data = await f.rt.prepare(f.scene, 6);
  assert.ok(data.errors.some(error => /presupuesto.*64 MiB/.test(error)), data.errors.join("; "));
  assert.ok(f.requested.length <= 1, "la segunda imagen excede el límite y no se debe pedir");
  assert.ok(f.rt.create(f.ctx, f.scene, 6).errors.length);
});

function sixtyScenes(f, { width = 1024, height = 1536, simple = false } = {}) {
  const catalog = read("capas/tests/fixtures/catalog.json"), original = catalog.assets[0];
  catalog.assets = Array.from({length:60}, (_, i) => {
    const asset = JSON.parse(JSON.stringify(original)); asset.id = `scene-${i}`;
    asset.canvas = {w:width,h:height};
    asset.default_pose = "original"; asset.poses = {original:asset.poses.original};
    if (simple) { asset.color_zones = {}; asset.poses.original.masks = {}; }
    asset.poses.original.file = `scene-${i}/original.png`;
    for (const zone in asset.poses.original.masks) asset.poses.original.masks[zone] = `scene-${i}/original.${zone}.png`;
    return asset;
  });
  f.rt.configure({catalog, sceneSchema:read("capas/schema/escena.schema.json"), catalogSchema:read("capas/schema/catalog.schema.json"),baseURL:"http://fixture.invalid/"});
  return catalog.assets.map((a, i) => ({params:{elenco:[{id:"jefe",asset:a.id}]},dur:4,t0:i*4,t1:i*4+4}));
}

test("60 escenas y seek desordenado mantienen solo la ventana y liberan al cerrar", async () => {
  const f = fixture(), beats = sixtyScenes(f);
  const window = await f.rt.prepareBeats(beats, {time:0});
  for (const i of [...Array(60).keys(), 59, 2, 37, 0, 58, 12]) {
    await window.update(i*4+1);
    const data = await f.rt.prepare(beats[i].params,4);
    assert.equal(data.errors.length, 0, `escena ${i}: ${data.errors}`);
    assert.ok(f.rt.stats().scenes <= 3);
    assert.ok(f.rt.stats().mediaBytes <= 54*1024*1024);
    assert.ok(f.rt.stats().mediaFiles <= 9);
  }
  await Promise.all([window.update(91),window.update(201),window.update(9)]);
  assert.equal((await f.rt.prepare(beats[2].params,4)).errors.length,0);
  window.dispose();
  assert.equal(f.rt.stats().mediaBytes, 0);
  assert.equal(f.rt.stats().scenes, 0);
});

test("cerrar durante decode no resucita imágenes ni preparaciones", async () => {
  const f = fixture({holdDecode:true});
  const pending = f.rt.prepare(f.scene,6);
  await flushMicrotasks();
  f.rt.clear(); f.release(); await pending; await flushMicrotasks();
  assert.equal(f.rt.stats().mediaBytes,0);
  assert.equal(f.rt.stats().mediaFiles,0);
  assert.equal(f.rt.stats().scenes,0);
  assert.equal(f.rt.stats().decoding,0);
});

test("las escenas simultáneas comparten archivos sin duplicar ni liberar al vecino", async () => {
  const f = fixture(), scene = JSON.parse(JSON.stringify(f.scene));
  const window = await f.rt.prepareBeats([{params:f.scene,t0:0,t1:6,dur:6},{params:scene,t0:4,t1:10,dur:6}], {time:5});
  const size = f.rt.stats().mediaBytes;
  await window.update(8);
  assert.equal((await f.rt.prepare(scene,6)).errors.length,0);
  assert.equal(f.rt.stats().mediaBytes,size);
  window.dispose(); assert.equal(f.rt.stats().mediaBytes,0);
});

test("la precarga no retrasa un cuadro listo, pero el seek espera a su escena", async () => {
  const f = fixture({holdDecode:true,holdPattern:"scene-1/"}), beats = sixtyScenes(f);
  const window = await f.rt.prepareBeats(beats,{time:0});
  await flushMicrotasks();
  assert.ok(f.rt.stats().decoding > 0, "el vecino se está decodificando en segundo plano");
  let done = false;
  const seek = window.update(5).then(()=>{done=true;});
  await flushMicrotasks(); assert.equal(done,false);
  f.release(); await seek;
  assert.equal((await f.rt.prepare(beats[1].params,4)).errors.length,0);
  window.dispose();
});

test("vecinos de escenas de 64 MiB no desplazan escenas simultáneas ni dependen del seek", async () => {
  const f = fixture({width:4096,height:4096}), beats = sixtyScenes(f,{width:4096,height:4096,simple:true});
  for (const b of beats) {b.dur=8;b.t1=b.t0+8;}
  const window = await f.rt.prepareBeats(beats,{time:0});
  for (const t of [9,81,9,1,9]) {
    await window.update(t);
    for (const b of beats.filter(b=>t>=b.t0&&t<b.t1)) assert.equal((await f.rt.prepare(b.params,8)).errors.length,0);
    assert.ok(f.rt.stats().mediaBytes<=192*1024*1024);
  }
  window.dispose();
});

test("una ventana sobredimensionada da el mismo error antes y después de otro seek", async () => {
  const f = fixture({width:4096,height:4096}), beats = sixtyScenes(f,{width:4096,height:4096,simple:true});
  for (const b of beats.slice(0,4)) {b.t0=0;b.t1=8;b.dur=8;}
  const window = await f.rt.prepareBeats(beats,{time:1});
  const errors = () => beats.slice(0,4).map(b=>f.rt.create(f.ctx,b.params,8).errors.join(";"));
  const initial = errors();
  assert.ok(initial.every(error=>error.includes("ventana activa")&&error.includes("192 MiB")));
  await window.update(101); await window.update(1);
  assert.deepEqual(errors(),initial);
  assert.equal(f.rt.stats().mediaBytes,0);
  window.dispose();
});
