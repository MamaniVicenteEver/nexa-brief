import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://192.168.20.2:4321',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  server: { host: '0.0.0.0', port: 4321 },
  vite: { build: { cssCodeSplit: true } },
});
