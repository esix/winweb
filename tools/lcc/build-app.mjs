#!/usr/bin/env node
/* build-app.mjs — ОБЩИЙ билдер Win32-приложений компилятором lcc-wasm под node (без emscripten).
 * Один движок для всех приложений (hello, minesweeper, ...): препроцессинг внешним clang -E
 * против фасадных заголовков (../../include) + lcc-шных wasm-заголовков, амальгама libc.c и
 * проектных исходников в одну TU, затем rcc -target=wasm-bin.
 *
 * Исходники проектов НЕ модифицируем: для заголовков без include-guard'ов кладём guard'ленные
 * КОПИИ в build-каталог; системные хедеры подменяем shim'ами (-nostdinc, без macOS SDK).
 *
 *   node tools/lcc/build-app.mjs [appName]      // без имени — собрать все
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { execFileSync } from 'child_process';
import { compileToWasm } from './ccwasm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');                 // winweb/
const WASMLIBC = join(HERE, 'wasm-libc');
const BUILD = join(HERE, '.app-build');

/* приложения (descriptor временный — позже перейдём на .vcxproj в src/cdrive/Projects). */
const APPS = {
  notepad: { sources: ['apps/notepad/notepad.c'], libc: true, out: 'public/lcc/notepad.wasm' },
  iconsdemo: { sources: ['apps/iconsdemo/iconsdemo.c', 'apps/iconsdemo/iconsdemo_res.c'], libc: true, out: 'public/lcc/iconsdemo.wasm' },
};

function shims(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'emscripten.h'), '#ifndef _EMSC_H\n#define _EMSC_H\n#define EMSCRIPTEN_KEEPALIVE\n#define emscripten_sleep(x)\n#endif\n');
  writeFileSync(join(dir, 'stdint.h'), `#ifndef _STDINT_H\n#define _STDINT_H\ntypedef signed char int8_t; typedef unsigned char uint8_t;\ntypedef short int16_t; typedef unsigned short uint16_t;\ntypedef int int32_t; typedef unsigned int uint32_t;\ntypedef long long int64_t; typedef unsigned long long uint64_t;\ntypedef unsigned long uintptr_t; typedef long intptr_t;\n#endif\n`);
  writeFileSync(join(dir, 'stddef.h'), `#ifndef _STDDEF_H\n#define _STDDEF_H\ntypedef unsigned long size_t; typedef long ptrdiff_t;\n#ifndef NULL\n#define NULL ((void*)0)\n#endif\ntypedef unsigned short wchar_t;\n#endif\n`);
  writeFileSync(join(dir, 'stdarg.h'), `#ifndef _STDARG_H\n#define _STDARG_H\ntypedef char *va_list;\n#define va_start(ap,last) ((ap)=(va_list)&(last)+8)\n#define va_arg(ap,t) (*(t*)(((ap)+=8)-8))\n#define va_end(ap) ((void)0)\n#define va_copy(d,s) ((d)=(s))\n#endif\n`);
}

/* guard'ленные копии локальных .h из директорий исходников (многие vendored-хедеры без guard'ов) */
function guardLocalHeaders(srcDirs, incDir) {
  mkdirSync(incDir, { recursive: true });
  for (const d of srcDirs) {
    if (!existsSync(d)) continue;
    for (const h of readdirSync(d).filter((f) => f.endsWith('.h'))) {
      const g = '_APPG_' + h.replace(/\W/g, '_').toUpperCase();
      writeFileSync(join(incDir, h), `#ifndef ${g}\n#define ${g}\n${readFileSync(join(d, h), 'utf8')}\n#endif\n`);
    }
  }
}

export function buildApp(name, cfg) {
  const dir = join(BUILD, name);
  const SHIMS = join(dir, 'shims'), INC = join(dir, 'inc');
  shims(SHIMS);
  const srcDirs = [...new Set(cfg.sources.map((s) => dirname(join(ROOT, s))))];
  guardLocalHeaders(srcDirs, INC);

  let combined = '';
  if (cfg.libc) combined += readFileSync(join(WASMLIBC, 'libc.c'), 'utf8') + '\n' + readFileSync(join(HERE, 'libc-extra.c'), 'utf8') + '\n';
  for (const s of cfg.sources) combined += readFileSync(join(ROOT, s), 'utf8') + '\n';
  if (cfg.stubs) combined += readFileSync(join(ROOT, cfg.stubs), 'utf8') + '\n';
  const cPath = join(dir, name + '.c');
  writeFileSync(cPath, combined);

  const args = ['-E', '-fshort-wchar', '-nostdinc', '-Dinline=', '-D__inline=', '-D__forceinline=',
    '-I', INC, '-I', join(ROOT, 'include'), '-I', SHIMS, '-I', WASMLIBC,
    ...(cfg.extraIncludes || []).flatMap((d) => ['-I', join(ROOT, d)]), cPath];
  let i;
  try { i = execFileSync('clang', args, { encoding: 'utf8', maxBuffer: 64 << 20 }); }
  catch (e) { throw new Error('clang -E failed:\n' + (e.stderr || e.message)); }

  const { wasm, stderr, code } = compileToWasm(i);
  if (code !== 0 || !wasm.length) throw new Error(`rcc failed (code ${code}):\n${stderr}`);
  const out = join(ROOT, cfg.out);
  writeFileSync(out, wasm);
  return { wasm, out, stderr };
}

/* CLI */
if (process.argv[1] && process.argv[1].endsWith('build-app.mjs')) {
  const only = process.argv[2];
  const names = only ? [only] : Object.keys(APPS);
  for (const n of names) {
    if (!APPS[n]) { console.error('unknown app:', n); process.exit(1); }
    try { const { wasm, out } = buildApp(n, APPS[n]); console.log(`${n}: ${wasm.length} bytes -> ${basename(out)} (valid: ${WebAssembly.validate(wasm)})`); }
    catch (e) { console.error(`${n}: ${e.message.split('\n').slice(0, 8).join('\n')}`); process.exit(1); }
  }
}
