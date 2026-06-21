#!/usr/bin/env node
/* gen-manifest.mjs — генерирует public/cdrive/manifest.json ОБХОДОМ дерева src/cdrive
 * (исходный диск C:) + собранных приложений в public/cdrive/Program Files.
 *   - текстовые файлы (.c/.h/.txt/.lnk/.rc/.vcxproj) инлайнятся в манифест;
 *   - бинарные (.exe/.ico/.bmp/.wasm) копируются в public/cdrive и ссылаются по url;
 *   - version растёт ТОЛЬКО при изменении содержимого (иначе VFS не пере-сидит, правки целы).
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src', 'cdrive');
const PUB = join(ROOT, 'public', 'cdrive');
const TEXT = new Set(['.c', '.h', '.txt', '.lnk', '.rc', '.vcxproj', '.md']);
const skip = (name) => name === '.DS_Store' || /_res\.c$/.test(name);   // junk / сгенерированное

const vpath = (rel) => 'C:\\' + rel.replace(/\//g, '\\');
const vurl = (rel) => '/cdrive/' + rel.split('/').map(encodeURIComponent).join('/');
const ext = (n) => { const i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i).toLowerCase(); };

const entries = [{ path: 'C:', type: 'dir' }];
function walk(absDir, relDir) {
  for (const name of readdirSync(absDir).sort()) {
    if (skip(name)) continue;
    const abs = join(absDir, name), rel = relDir ? `${relDir}/${name}` : name;
    if (statSync(abs).isDirectory()) { entries.push({ path: vpath(rel), type: 'dir' }); walk(abs, rel); }
    else if (TEXT.has(ext(name))) entries.push({ path: vpath(rel), type: 'file', text: readFileSync(abs, 'utf8') });
    else {                                                        // бинарь -> копия в public/cdrive + url
      const dest = join(PUB, rel); mkdirSync(dirname(dest), { recursive: true }); copyFileSync(abs, dest);
      entries.push({ path: vpath(rel), type: 'file', url: vurl(rel), exec: ext(name) === '.exe' || ext(name) === '.wasm' });
    }
  }
}
walk(SRC, '');

/* собранные приложения: public/cdrive/Program Files/<App>/*.wasm */
const PF = join(PUB, 'Program Files');
if (existsSync(PF)) {
  entries.push({ path: 'C:\\Program Files', type: 'dir' });
  for (const app of readdirSync(PF).sort()) {
    if (!statSync(join(PF, app)).isDirectory()) continue;
    entries.push({ path: `C:\\Program Files\\${app}`, type: 'dir' });
    for (const f of readdirSync(join(PF, app)).sort()) if (f.endsWith('.wasm'))
      entries.push({ path: `C:\\Program Files\\${app}\\${f}`, type: 'file', url: vurl(`Program Files/${app}/${f}`), exec: true });
  }
}

/* version: +1 только если набор entries изменился (сохраняет правки в VFS между сборками) */
const out = join(PUB, 'manifest.json');
let prev = { version: 0, entries: null };
try { prev = JSON.parse(readFileSync(out, 'utf8')); } catch { /* первый запуск */ }
const changed = JSON.stringify(prev.entries) !== JSON.stringify(entries);
const version = changed ? (prev.version || 0) + 1 : (prev.version || 1);
writeFileSync(out, JSON.stringify({ version, entries }, null, 2) + '\n');
console.log(`gen-manifest: ${entries.length} entries -> public/cdrive/manifest.json (v${version}${changed ? ', changed' : ', unchanged'})`);
