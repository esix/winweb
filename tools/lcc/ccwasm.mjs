#!/usr/bin/env node
/* ccwasm.mjs — собрать C -> wasm нашим вендоренным компилятором lcc-wasm (rcc.wasm),
 * целиком на node.js: без emscripten, без нативного тулчейна, БЕЗ wabt.
 *
 *   node tools/lcc/ccwasm.mjs <file.c> [--run] [-I dir]
 *
 * Пайплайн: внешний `clang -E` (препроцессор, т.к. rcc.wasm не умеет #include)
 *           -> rcc.wasm с -target=wasm-bin (C89 -> .wasm БИНАРЬ напрямую).
 * Раньше тут был шаг wabt.js (.wat->.wasm, 691 КБ) — он убран: lcc теперь эмитит
 * бинарь сам (см. lcc/src/wasmbin.c, -target=wasm-bin).
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { execFileSync } from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url));

/* препроцессор: rcc.wasm не умеет #include — под node прогоняем внешний clang -E.
 * -nostdinc + наши C89-заголовки (tools/lcc/include); -P убирает line-маркеры. */
export function preprocess(file, includeDirs = [join(HERE, 'include')]) {
  const args = ['-E', '-P', '-nostdinc', ...includeDirs.flatMap((d) => ['-I', d]), file];
  return execFileSync('clang', args, { encoding: 'utf8' });
}

/* C-исходник (текст) -> .wasm (байты) через rcc.wasm -target=wasm-bin.
 * Хост: 3 «сисколла» (__read/__write/__exit) поверх памяти rcc; stdin=исходник,
 * stdout(fd 1)=бинарь .wasm, stderr(fd 2)=диагностика. */
export function compileToWasm(source) {
  let mem;
  const src = Buffer.from(source), out = [], err = [];
  let pos = 0;
  const env = {
    __read: (fd, ptr, len) => { if (fd !== 0) return 0; const n = Math.min(len, src.length - pos); if (n <= 0) return 0; new Uint8Array(mem.buffer).set(src.subarray(pos, pos + n), ptr); pos += n; return n; },
    __write: (fd, ptr, len) => { (fd === 1 ? out : err).push(Buffer.from(new Uint8Array(mem.buffer, ptr, len))); return len; },
    __exit: (code) => { throw { __exit: code }; },
  };
  const stub = () => 0;
  const rcc = new WebAssembly.Instance(
    new WebAssembly.Module(readFileSync(join(HERE, 'rcc.wasm'))),
    { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : stub) }) });
  mem = rcc.exports.memory;

  const argv = ['rcc', '-target=wasm-bin'];
  const A = 0x1f0000, dv = new DataView(mem.buffer), u8 = new Uint8Array(mem.buffer);
  let strp = A; const ptrs = [];
  for (const s of argv) { ptrs.push(strp); for (let i = 0; i < s.length; i++) u8[strp + i] = s.charCodeAt(i); u8[strp + s.length] = 0; strp += s.length + 1; }
  const argvArr = (strp + 7) & ~7;
  ptrs.forEach((p, i) => dv.setUint32(argvArr + i * 4, p, true));

  let code = 0;
  try { rcc.exports.main(argv.length, argvArr); } catch (e) { if (e.__exit === undefined) throw e; code = e.__exit; }
  return { wasm: new Uint8Array(Buffer.concat(out)), stderr: Buffer.concat(err).toString(), code };
}

/* C-исходник -> { wasm: Uint8Array, stderr } */
export function compile(source) {
  const { wasm, stderr, code } = compileToWasm(source);
  if (code !== 0 || wasm.length === 0) throw new Error('rcc failed (code ' + code + '):\n' + (stderr || '(no output — compile error)'));
  return { wasm, stderr };
}

/* CLI */
if (process.argv[1] && process.argv[1].endsWith('ccwasm.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node ccwasm.mjs <file.c> [--run] [-I dir]'); process.exit(1); }
  const iArg = process.argv.indexOf('-I');
  const incDirs = iArg >= 0 ? [process.argv[iArg + 1]] : [join(HERE, 'include')];
  let source = readFileSync(file, 'utf8');
  if (source.includes('#include')) source = preprocess(file, incDirs);   // прогон через cpp при наличии #include
  const { wasm, stderr } = compile(source);
  const out = file.replace(/\.c$/, '') + '.wasm';
  writeFileSync(out, wasm);
  if (stderr.trim()) console.error('rcc diagnostics:\n' + stderr.trim());
  console.error(`built ${basename(out)} (${wasm.length} bytes) <- ${basename(file)} via lcc-wasm -target=wasm-bin (node only, no wabt)`);
  if (process.argv.includes('--run')) {
    let o = '';
    const inst = new WebAssembly.Instance(new WebAssembly.Module(wasm), { env: new Proxy({ putchar: (c) => { o += String.fromCharCode(c & 255); return c; } }, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
    const rc = inst.exports.main ? inst.exports.main() : 0;
    process.stdout.write(o);
    console.error(`[main() returned ${rc}]`);
  }
}
