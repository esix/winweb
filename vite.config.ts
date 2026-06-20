import { defineConfig } from 'vite';

export default defineConfig({
  // Emscripten ES6 modules fetch their .wasm via `new URL('x.wasm', import.meta.url)`,
  // which Vite resolves as an asset. Don't let dep-optimizer touch the glue.
  optimizeDeps: { exclude: ['hello'] },
  server: { host: '0.0.0.0', port: 5050, strictPort: true, fs: { allow: ['..'] }, headers: { 'cache-control': 'no-store' } },
});
