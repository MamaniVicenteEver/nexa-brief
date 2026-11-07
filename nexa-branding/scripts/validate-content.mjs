import { readFileSync, existsSync } from 'node:fs';
import { validateCatalog } from './catalog.mjs';
const root = new URL('../', import.meta.url);
const channels = JSON.parse(
  readFileSync(new URL('src/features/channels/data/channels.json', root), 'utf8'),
);
const networks = JSON.parse(
  readFileSync(new URL('src/features/network/data/networks.json', root), 'utf8'),
);
const errors = validateCatalog(channels, networks, {
  assetExists: (path) => existsSync(new URL(`public${path}`, root)),
});
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `Catalog valid: ${channels.length} channels, ${networks.length} network, verified asset paths and social URLs.`,
);
