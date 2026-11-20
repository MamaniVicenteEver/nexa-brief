/* Un único corpus, dos validadores: este test compara también el veredicto Python. */
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const assert = require("node:assert/strict"), { spawnSync } = require("node:child_process");
const kit = path.resolve(__dirname, "../.."), read = file => JSON.parse(fs.readFileSync(path.join(kit, file), "utf8"));
const context = { module: { exports: {} } }; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(kit, "capas/runtime/capas.js"), "utf8"), context);
const rt = context.module.exports, cat = read("capas/tests/fixtures/catalog.json");
rt.configure({ catalog: cat, sceneSchema: read("capas/schema/escena.schema.json"), catalogSchema: read("capas/schema/catalog.schema.json") });
const cases = read("capas/tests/fixtures/cases.json");
const python = process.env.CAPAS_PYTHON || path.resolve(kit, "../../../../.venv/bin/python");
const result = spawnSync(python, ["-c", `import json,sys;sys.path.insert(0,sys.argv[1]);import capas
catalog=capas.load_catalog(sys.argv[2]);cases=json.load(sys.stdin)
print(json.dumps([not capas.validate_scene(c['params'],c.get('catalog',catalog),c['duration']) for c in cases]))`, path.join(kit, "tools"), path.join(kit, "capas/tests/fixtures/catalog.json")], { input: JSON.stringify(cases), encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.error?.message);
const verdicts = JSON.parse(result.stdout);
cases.forEach((c, i) => {
  const errors = rt.validateScene(c.params, c.catalog || cat, c.duration);
  assert.equal(!errors.length, c.valid, `${c.name}: ${errors.join("; ")}`);
  assert.equal(!errors.length, verdicts[i], `Diferencia Python/JS: ${c.name}`);
});
/* El navegador aplica las mismas relaciones del catálogo aunque no lea sus archivos. */
for (const mutate of [c => c.assets.push(c.assets[0]), c => c.assets[0].default_pose = "no-existe", c => c.assets[0].poses.original.masks = {}, c => c.assets[0].pivot = [9999, 0]]) {
  const changed = structuredClone(cat); mutate(changed);
  assert.ok(rt.validateCatalog(changed).length);
  assert.ok(rt.validateScene(cases[0].params, changed, 6).length);
}
console.log(`✓ ${cases.length} escenas: mismo veredicto Python/JS; 4 catálogos inválidos rechazados`);
