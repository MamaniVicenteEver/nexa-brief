#!/usr/bin/env node
/** Build a local index over installed SVGs without duplicating them. */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIconsData, getIconSlug } from 'simple-icons/sdk';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = join(root, 'node_modules');
const output = join(root, 'dist');
const sources = {
  'simple-icons': { package: 'simple-icons', category: 'marcas', packageLicense: 'CC0-1.0', notice: 'La licencia del proyecto no determina los derechos de cada marca.', url: 'https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md' },
  'lucide': { package: 'lucide-static', category: 'iconos', packageLicense: 'ISC', notice: 'Conservar los avisos de licencia incluidos en el paquete.', url: 'https://lucide.dev/license' },
  'devicon': { package: 'devicon', category: 'tecnologia', packageLicense: 'MIT', notice: 'Las marcas pueden tener condiciones propias.', url: 'https://github.com/devicons/devicon' },
};
const aliasesEs = {
  server: ['servidor'], cloud: ['nube'], smartphone: ['telefono', 'movil'], laptop: ['computadora', 'portatil'],
  database: ['base de datos'], lock: ['candado', 'seguridad'], globe: ['globo', 'mundo'],
  wifi: ['red', 'internet'], monitor: ['pantalla', 'computadora'], cpu: ['procesador', 'chip'],
  code: ['codigo', 'programacion'], search: ['buscar', 'busqueda'], link: ['enlace'],
  calendar: ['calendario'], clock: ['reloj', 'tiempo'], file: ['archivo'], folder: ['carpeta'],
  mail: ['correo'], users: ['personas', 'usuarios'], user: ['persona', 'usuario'],
  bot: ['robot', 'inteligencia artificial'], camera: ['camara'], image: ['imagen', 'foto'],
  video: ['video'], rocket: ['cohete'], network: ['red'], shield: ['escudo', 'seguridad'],
};

async function packageVersion(name) {
  return JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8')).version;
}
function flattenAliases(value) {
  if (Array.isArray(value)) return value.filter(x => typeof x === 'string');
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenAliases);
  return [];
}
function unique(values) { return [...new Set(values.filter(v => typeof v === 'string' && v.trim()))]; }
function item({id, label, provider, file, tags = [], source = null, license = null, guidelines = null, color = null}) {
  return { id, label, provider, category: sources[provider].category, file, tags: unique(tags), source, license, guidelines, color };
}
function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

async function build() {
  for (const source of Object.values(sources)) source.version = await packageVersion(source.package);
  const records = [];
  for (const icon of await getIconsData()) {
    const slug = getIconSlug(icon);
    records.push(item({ id: `brand.simple-icons.${slug}`, label: icon.title, provider: 'simple-icons',
      file: `icons/${slug}.svg`, tags: [slug, ...flattenAliases(icon.aliases)], source: icon.source ?? null,
      license: icon.license ?? null, guidelines: icon.guidelines ?? null, color: icon.hex ? `#${icon.hex}` : null }));
  }
  const lucideRoot = join(modules, 'lucide-static');
  const lucideTags = JSON.parse(await readFile(join(lucideRoot, 'tags.json'), 'utf8'));
  for (const filename of await readdir(join(lucideRoot, 'icons'))) {
    if (!filename.endsWith('.svg')) continue;
    const slug = filename.slice(0, -4);
    records.push(item({id: `icon.lucide.${slug}`, label: slug.replaceAll('-', ' '), provider: 'lucide',
      file: `icons/${filename}`, tags: [slug, ...(lucideTags[slug] ?? []), ...(aliasesEs[slug] ?? [])],
      source: `https://lucide.dev/icons/${slug}`, license: {type: 'ISC'} }));
  }
  const deviconRoot = join(modules, 'devicon');
  const metadata = JSON.parse(await readFile(join(deviconRoot, 'devicon.json'), 'utf8'));
  const deviconInfo = new Map(metadata.map(row => [row.name, row]));
  for (const dir of await readdir(join(deviconRoot, 'icons'), {withFileTypes: true})) {
    if (!dir.isDirectory()) continue;
    const data = deviconInfo.get(dir.name) ?? {};
    for (const filename of await readdir(join(deviconRoot, 'icons', dir.name))) {
      if (!filename.endsWith('.svg')) continue;
      const stem = filename.slice(0, -4);
      const variant = stem.startsWith(`${dir.name}-`) ? stem.slice(dir.name.length + 1) : stem;
      records.push(item({id: `tech.devicon.${dir.name}.${variant}`, label: `${dir.name} · ${variant}`, provider: 'devicon',
        file: `icons/${dir.name}/${filename}`, tags: [dir.name, variant, ...(data.tags ?? []), ...(data.altnames ?? [])],
        source: `https://github.com/devicons/devicon/tree/master/icons/${encodeURIComponent(dir.name)}` }));
    }
  }
  records.sort(byId);
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`ID duplicado: ${record.id}`);
    if (!/^[a-z0-9_.-]+$/.test(record.id) || !/^icons\/[a-z0-9_./-]+\.svg$/.test(record.file) || record.file.includes('..')) {
      throw new Error(`Ruta o ID inválido: ${record.id}`);
    }
    ids.add(record.id);
  }
  await mkdir(output, {recursive: true});
  const target = join(output, 'catalog.json');
  const temporary = join(output, `.catalog-${process.pid}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({schemaVersion: 1, sources, resources: records}) + '\n', {encoding: 'utf8', flag: 'wx'});
    await rename(temporary, target);
  } finally { await rm(temporary, {force: true}); }
  const counts = Object.fromEntries(Object.keys(sources).map(provider => [provider, records.filter(row => row.provider === provider).length]));
  console.log(JSON.stringify({total: records.length, providers: counts}));
}

build().catch(error => { console.error(error.message); process.exitCode = 1; });
