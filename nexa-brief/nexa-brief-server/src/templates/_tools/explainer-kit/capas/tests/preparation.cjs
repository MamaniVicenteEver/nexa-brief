/* Regresiones de la barrera de medios: decodificación, duración y error atómico. */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const test = require("node:test");
const kit = path.resolve(__dirname, "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(kit, file), "utf8"));
const source = fs.readFileSync(path.join(kit, "capas/runtime/capas.js"), "utf8");
const flushMicrotasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture({ holdDecode = false, width = 1024, height = 1536 } = {}) {
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
    async decode() { await gate; decoded.push(this.url); }
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
