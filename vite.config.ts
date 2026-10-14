import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';

// Estampa cada build en sw.js: así el navegador ve un service worker distinto en cada deploy.
function stampServiceWorker(): Plugin {
  return {
    name: 'stamp-sw',
    apply: 'build',
    closeBundle() {
      const f = 'dist/sw.js';
      writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD_ID__', `build ${Date.now()}`));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [stampServiceWorker()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
});
