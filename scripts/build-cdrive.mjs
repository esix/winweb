#!/usr/bin/env node
/* build-cdrive.mjs — собирает проекты из src/cdrive/Projects/<App>/<App>.vcxproj
 * компилятором lcc-wasm под node (без emscripten) в public/cdrive/Program Files/<App>/<App>.wasm.
 * Vite копирует public/ -> dist/, поэтому это и есть dist/cdrive/Program Files/...
 *
 * .vcxproj читаем подмножеством: ProjectName, ConfigurationType, ClCompile, ResourceCompile.
 *   node scripts/build-cdrive.mjs [appName]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { buildApp } from '../tools/lcc/build-app.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PROJECTS = join(ROOT, 'src', 'cdrive', 'Projects');

function parseVcxproj(xml) {
  const pick = (re) => (xml.match(re) || [])[1];
  return {
    name: pick(/<ProjectName>([^<]+)<\/ProjectName>/),
    type: pick(/<ConfigurationType>([^<]+)<\/ConfigurationType>/) || 'Application',
    sources: [...xml.matchAll(/<ClCompile\s+Include="([^"]+)"/g)].map((m) => m[1].replace(/\\/g, '/')),
    rc: [...xml.matchAll(/<ResourceCompile\s+Include="([^"]+)"/g)].map((m) => m[1].replace(/\\/g, '/')),
  };
}

if (!existsSync(PROJECTS)) { console.error('no src/cdrive/Projects'); process.exit(0); }
const only = process.argv[2];
for (const dir of readdirSync(PROJECTS)) {
  const pdir = join(PROJECTS, dir);
  const vcx = readdirSync(pdir).find((f) => f.endsWith('.vcxproj'));
  if (!vcx) continue;
  const proj = parseVcxproj(readFileSync(join(pdir, vcx), 'utf8'));
  const name = proj.name || basename(vcx, '.vcxproj');
  if (only && only !== name && only !== dir) continue;
  const sources = proj.sources.map((s) => `src/cdrive/Projects/${dir}/${s}`);
  const out = `public/cdrive/Program Files/${name}/${name}.wasm`;
  mkdirSync(join(ROOT, dirname(out)), { recursive: true });
  try {
    const { wasm } = buildApp(name, { sources, libc: true, out });
    console.log(`${name}: ${wasm.length} bytes -> Program Files/${name}/${name}.wasm (valid: ${WebAssembly.validate(wasm)})`);
  } catch (e) { console.error(`${name}: ${e.message.split('\n').slice(0, 6).join('\n')}`); process.exit(1); }
}
