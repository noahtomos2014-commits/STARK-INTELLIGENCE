import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  build: { outDir: path.resolve(root, '../dist'), emptyOutDir: true, sourcemap: true }
});
