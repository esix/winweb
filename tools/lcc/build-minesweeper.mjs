#!/usr/bin/env node
/* build-minesweeper.mjs — амальгамация сапёра (game.c+graphics.c+utilities.c+glue) в ОДНУ TU
 * и компиляция компилятором lcc-wasm под node. Исходники apps/minesweeper НЕ трогаем —
 * в build-каталог кладём guard'ленные копии заголовков, shim'ы системных хедеров и
 * патч C99->C89 для graphics.c.
 *
 *   node tools/lcc/build-minesweeper.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');               // winweb/
const MSW = join(ROOT, 'apps', 'minesweeper');
const BUILD = join(HERE, '.msw-build');            // tools/lcc/.msw-build
const INC = join(BUILD, 'inc'), SHIMS = join(BUILD, 'shims');
mkdirSync(INC, { recursive: true }); mkdirSync(SHIMS, { recursive: true });

/* 1. guard'ленные копии локальных заголовков (оригиналы без guard'ов -> переопределения в одной TU) */
for (const h of readdirSync(MSW).filter((f) => f.endsWith('.h'))) {
  const g = '_MSWG_' + h.replace(/\W/g, '_').toUpperCase();
  writeFileSync(join(INC, h), `#ifndef ${g}\n#define ${g}\n${readFileSync(join(MSW, h), 'utf8')}\n#endif\n`);
}

/* 2. shim'ы системных хедеров (clang -E -nostdinc, чтобы не тянуть macOS SDK / __darwin_va_list) */
writeFileSync(join(SHIMS, 'emscripten.h'), '#ifndef _EMSC_H\n#define _EMSC_H\n#define EMSCRIPTEN_KEEPALIVE\n#define emscripten_sleep(x)\n#endif\n');
writeFileSync(join(SHIMS, 'stdint.h'), `#ifndef _STDINT_H\n#define _STDINT_H
typedef signed char int8_t; typedef unsigned char uint8_t;
typedef short int16_t; typedef unsigned short uint16_t;
typedef int int32_t; typedef unsigned int uint32_t;
typedef long long int64_t; typedef unsigned long long uint64_t;
typedef unsigned long uintptr_t; typedef long intptr_t;
#endif\n`);
writeFileSync(join(SHIMS, 'stddef.h'), `#ifndef _STDDEF_H\n#define _STDDEF_H
typedef unsigned long size_t; typedef long ptrdiff_t;
#ifndef NULL\n#define NULL ((void*)0)\n#endif
typedef unsigned short wchar_t;
#endif\n`);
writeFileSync(join(SHIMS, 'stdarg.h'), `#ifndef _STDARG_H\n#define _STDARG_H
typedef char *va_list;
#define va_start(ap,last) ((ap)=(va_list)&(last)+8)
#define va_arg(ap,t) (*(t*)(((ap)+=8)-8))
#define va_end(ap) ((void)0)
#define va_copy(d,s) ((d)=(s))
#endif\n`);

/* 3. patch C99->C89: graphics.c non-const POINT[] aggregate initializers -> field assignments */
let graphics = readFileSync(join(MSW, 'graphics.c'), 'utf8');
const ptsFix = (name, vals) => `POINT ${name}[4];`;   // decl only; assignments injected below
graphics = graphics.replace(
  /POINT ptsL\[\] = \{\{([^}]*)\}, \{([^}]*)\}, \{([^}]*)\}, \{([^}]*)\}\};\s*\n\s*POINT ptsR\[\] = \{\{([^}]*)\}, \{([^}]*)\}, \{([^}]*)\}, \{([^}]*)\}\};/,
  (_m, l0, l1, l2, l3, r0, r1, r2, r3) => {
    const set = (a, i, pair) => { const [x, y] = pair.split(',').map((s) => s.trim()); return `${a}[${i}].x=${x};${a}[${i}].y=${y};`; };
    return `POINT ptsL[4]; POINT ptsR[4];\n` +
      [l0, l1, l2, l3].map((p, i) => set('ptsL', i, p)).join('') + '\n' +
      [r0, r1, r2, r3].map((p, i) => set('ptsR', i, p)).join('');
  });

/* 4. амальгама: libc.c (memcpy/strlen/... поверх __read/__write/__exit) + три ядра + glue -> одна TU */
const combined =
  readFileSync(join(HERE, 'wasm-libc', 'libc.c'), 'utf8') + '\n' +
  readFileSync(join(MSW, 'game.c'), 'utf8') + '\n' +
  graphics + '\n' +
  readFileSync(join(MSW, 'utilities.c'), 'utf8') + '\n' +
  readFileSync(join(ROOT, 'src', 'native', 'minesweeper_host.c'), 'utf8') + '\n' +
  readFileSync(join(HERE, 'msw-stubs.c'), 'utf8') + '\n';   // закрываем app-стабы + примитивы
const combinedPath = join(BUILD, 'minesweeper.c');
writeFileSync(combinedPath, combined);

/* 5. clang -E (cpp) -> .i */
const WASMLIBC = join(HERE, 'wasm-libc');   // lcc-чистые string.h/stdlib.h/stdio.h/limits.h...
const cppArgs = ['-E', '-fshort-wchar', '-nostdinc', '-Dinline=', '-D__inline=', '-D__forceinline=',
  '-I', INC, '-I', join(ROOT, 'include'), '-I', SHIMS, '-I', WASMLIBC, combinedPath];
let i;
try { i = execFileSync('clang', cppArgs, { encoding: 'utf8', maxBuffer: 64 << 20 }); }
catch (e) { console.error('clang -E FAILED:\n' + (e.stderr || e.message)); process.exit(1); }
const iPath = join(BUILD, 'minesweeper.i'); writeFileSync(iPath, i);
console.log(`cpp ok: ${i.split('\n').length} lines -> ${iPath}`);

/* 6. rcc -target=wasm-bin */
const { compileToWasm } = await import('./ccwasm.mjs');
const { wasm, stderr, code } = compileToWasm(i);
console.log(`rcc code ${code}, wasm ${wasm.length} bytes`);
if (code === 0 && wasm.length) {
  writeFileSync(join(BUILD, 'minesweeper.wasm'), wasm);
  writeFileSync(join(ROOT, 'public', 'lcc', 'minesweeper.wasm'), wasm);   // ship to the browser
  console.log('OK -> public/lcc/minesweeper.wasm (' + wasm.length + ' bytes, valid: ' + WebAssembly.validate(wasm) + ')');
} else {
  // показать первые уникальные ошибки + остаток по строкам исходника
  const lines = stderr.split('\n').filter(Boolean);
  console.log('--- rcc errors (' + lines.length + ' lines), first 30 ---');
  console.log(lines.slice(0, 30).join('\n'));
}
