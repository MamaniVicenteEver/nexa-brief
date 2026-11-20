import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Lee el índice y, para una tarea, únicamente las guías seleccionadas.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(root, 'agent-guide/index.json');
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const fail = message => { throw new Error(message); };
function checkIndex(index) {
  if (index.version !== 1 || !Array.isArray(index.tasks) || !index.tasks.length)
    fail('Índice de guía inválido: se requiere version 1 y tareas.');
  const names = new Set();
  for (const task of index.tasks) {
    if (!task || typeof task.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task.id) || names.has(task.id))
      fail(`ID de tarea inválido o duplicado: ${task?.id ?? ''}`);
    if (typeof task.title !== 'string' || !task.title.trim() || !Array.isArray(task.read) || !task.read.length || task.read.some(p => typeof p !== 'string' || !p))
      fail(`Tarea incompleta: ${task.id}`);
    names.add(task.id);
  }
}
async function readGuide(path) {
  if (isAbsolute(path) || path.split(/[\\/]/).some(part => part === '..' || part === '.' || !part))
    fail(`Ruta de guía inválida: ${path}`);
  const candidate = resolve(root, path), actual = await realpath(candidate), location = relative(root, actual);
  if (!location || location === '..' || location.startsWith('..' + sep) || isAbsolute(location))
    fail(`Ruta de guía fuera de _vida: ${path}`);
  if (!(await stat(actual)).isFile()) fail(`La guía no es un archivo: ${path}`);
  const text = await readFile(actual, 'utf8');
  if (!text.trim()) fail(`Guía vacía: ${path}`);
  return { file: path, bytes: Buffer.byteLength(text), content: path.endsWith('.json') ? JSON.parse(text) : text };
}
async function main() {
  const [command = 'list', ...args] = process.argv.slice(2);
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log('Uso: node tools/agent-guide.mjs list | show <tarea> | check');
    return;
  }
  const index = await load(indexPath);
  checkIndex(index);
  if (command === 'list' && args.length === 0) {
    console.log(JSON.stringify({ version: index.version, title: index.title, tasks: index.tasks.map(({id,title,description}) => ({id,title,description})) }, null, 2));
    return;
  }
  if (command === 'show' && args.length === 1) {
    const task = index.tasks.find(item => item.id === args[0]);
    if (!task) fail(`Tarea desconocida: ${args[0]}. Usa list para ver las opciones.`);
    const guides = [];
    for (const path of task.read) guides.push(await readGuide(path));
    console.log(JSON.stringify({ base_path: index.base_path, instructions: index.instructions, task, shared_rules: index.shared_rules, guides }, null, 2));
    return;
  }
  if (command === 'check' && args.length === 0) {
    const paths = [...new Set(index.tasks.flatMap(task => task.read))];
    const guides = [];
    for (const path of paths) { const guide = await readGuide(path); guides.push({file: guide.file, bytes: guide.bytes}); }
    console.log(JSON.stringify({valid: true, tasks: index.tasks.length, guides}, null, 2));
    return;
  }
  fail('Uso: node tools/agent-guide.mjs list | show <tarea> | check');
}
main().catch(error => { console.error(`Guía de Vida: ${error.message}`); process.exitCode = 1; });
