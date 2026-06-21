import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.WINWEB_BASE || '/',   // деплой в подпапку (напр. блог /demo/winweb/) -> WINWEB_BASE=/demo/winweb/
  // main.ts bootstrap uses top-level await (lcc.ts тоже) -> нужен target с его поддержкой
  build: { target: 'es2022' },
  server: { host: '0.0.0.0', port: 5050, strictPort: true, fs: { allow: ['..'] }, headers: { 'cache-control': 'no-store' } },
});
