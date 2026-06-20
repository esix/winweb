/* lcc.ts — компиляция настоящего C89 В БРАУЗЕРЕ компилятором lcc-wasm.
 *
 * Пайплайн (всё клиентское, без emscripten/node/clang):
 *   исходник --cpp.ts (#include/#define)--> препроцессированный C
 *           --rcc.wasm -target=wasm-bin--> .wasm бинарь.
 *
 * Это браузерный аналог tools/lcc/ccwasm.mjs: там cpp = внешний clang -E, здесь
 * cpp = наш TS-препроцессор; rcc.wasm запускается тем же MEMFS-хостом.
 */
import { preprocess } from './cpp';
import windowsH from '../../tools/lcc/include/windows.h?raw';
import stringH from '../../tools/lcc/include/string.h?raw';
import guiWindowsH from '../../tools/lcc/include-gui/windows.h?raw';

const HEADERS = new Map<string, string>([['windows.h', windowsH], ['string.h', stringH]]);
const GUI_HEADERS = new Map<string, string>([['windows.h', guiWindowsH]]);   // GUI: Win32-окна/GDI

/* libc от lcc (lib/wasm/libc.c) + её wasm-заголовки — бандлятся Vite через ?raw.
 * libc.c реализует printf/malloc/string/stdio поверх __read/__write/__exit. */
const libcFiles = import.meta.glob('../../tools/lcc/wasm-libc/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const WASM_HEADERS = new Map<string, string>();
let LIBC = '';
for (const path of Object.keys(libcFiles)) {
  const name = path.split('/').pop() || path;
  if (name === 'libc.c') LIBC = libcFiles[path];
  else if (name.endsWith('.h')) WASM_HEADERS.set(name, libcFiles[path]);
}

let rccBytes: ArrayBuffer | null = null;
async function loadRcc(): Promise<ArrayBuffer> {
  if (!rccBytes) rccBytes = await (await fetch(`/lcc/rcc.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  return rccBytes;
}

/* запустить rcc.wasm над препроцессированным текстом -> { wasm, stderr, code } */
function runRcc(bytes: ArrayBuffer, source: string): { wasm: Uint8Array; stderr: string; code: number } {
  let mem: WebAssembly.Memory;
  const src = new TextEncoder().encode(source);
  const out: number[] = [], err: number[] = [];
  let pos = 0;
  const env: Record<string, unknown> = {
    __read: (fd: number, ptr: number, len: number) => { if (fd !== 0) return 0; const n = Math.min(len, src.length - pos); if (n <= 0) return 0; new Uint8Array(mem.buffer).set(src.subarray(pos, pos + n), ptr); pos += n; return n; },
    __write: (fd: number, ptr: number, len: number) => { const b = new Uint8Array(mem.buffer, ptr, len); for (let i = 0; i < len; i++) (fd === 1 ? out : err).push(b[i]); return len; },
    __exit: (code: number) => { throw { __exit: code }; },
  };
  const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
  mem = (inst.exports as { memory: WebAssembly.Memory }).memory;

  const argv = ['rcc', '-target=wasm-bin'];
  const A = 0x1f0000, dv = new DataView(mem.buffer), u8 = new Uint8Array(mem.buffer);
  let sp = A; const ptrs: number[] = [];
  for (const s of argv) { ptrs.push(sp); for (let i = 0; i < s.length; i++) u8[sp + i] = s.charCodeAt(i); u8[sp + s.length] = 0; sp += s.length + 1; }
  const arr = (sp + 7) & ~7; ptrs.forEach((p, i) => dv.setUint32(arr + i * 4, p, true));

  let code = 0;
  try { (inst.exports as { main: CallableFunction }).main(argv.length, arr); }
  catch (e) { if ((e as { __exit?: number }).__exit === undefined) throw e; code = (e as { __exit: number }).__exit; }
  return { wasm: new Uint8Array(out), stderr: new TextDecoder().decode(new Uint8Array(err)), code };
}

/* C89-исходник -> { wasm, stderr }. Бросает при ошибке cpp или rcc. */
export async function compileC(source: string, extraHeaders?: Map<string, string>): Promise<{ wasm: Uint8Array; stderr: string }> {
  const includes = new Map(HEADERS);
  if (extraHeaders) for (const [k, v] of extraHeaders) includes.set(k, v);
  let cppErr = '';
  const pp = preprocess(source, { includes, onError: (m) => { cppErr += m + '\n'; } });
  if (cppErr) throw new Error(cppErr.trim());
  const { wasm, stderr, code } = runRcc(await loadRcc(), pp);
  if (code !== 0 || wasm.length === 0) throw new Error('rcc failed (code ' + code + '):\n' + (stderr || '(no output)'));
  return { wasm, stderr };
}

/* консольная C89-программа -> wasm: амальгама libc.c + исходник (printf/malloc/string).
 * Импортирует только __read/__write/__exit. Бросает при ошибке cpp/rcc. */
export async function compileConsole(source: string): Promise<{ wasm: Uint8Array; stderr: string }> {
  let cppErr = '';
  const pp = preprocess(LIBC + '\n' + source, { includes: WASM_HEADERS, onError: (m) => { cppErr += m + '\n'; } });
  if (cppErr) throw new Error(cppErr.trim());
  const { wasm, stderr, code } = runRcc(await loadRcc(), pp);
  if (code !== 0 || wasm.length === 0) throw new Error('rcc failed (code ' + code + '):\n' + (stderr || '(no output)'));
  return { wasm, stderr };
}

/* Win32-GUI C89-программа -> wasm (только Win32-импорты, без libc — окна/GDI идут в env-фасад) */
export async function compileGui(source: string): Promise<{ wasm: Uint8Array; stderr: string }> {
  let cppErr = '';
  const pp = preprocess(source, { includes: GUI_HEADERS, onError: (m) => { cppErr += m + '\n'; } });
  if (cppErr) throw new Error(cppErr.trim());
  const { wasm, stderr, code } = runRcc(await loadRcc(), pp);
  if (code !== 0 || wasm.length === 0) throw new Error('rcc failed (code ' + code + '):\n' + (stderr || '(no output)'));
  return { wasm, stderr };
}

/* запустить консольный модуль: __write -> write(), __read=EOF, __exit -> возврат кода */
export function runConsole(wasm: Uint8Array, write: (s: string) => void): number {
  let mem: WebAssembly.Memory;
  const env: Record<string, unknown> = {
    __read: () => 0,
    __write: (fd: number, ptr: number, len: number) => { const b = new Uint8Array(mem.buffer, ptr, len); let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(b[i]); write(fd === 2 ? s : s.replace(/\r?\n/g, '\r\n')); return len; },
    __exit: (c: number) => { throw { __exit: c }; },
  };
  const inst = new WebAssembly.Instance(new WebAssembly.Module(wasm), { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
  mem = (inst.exports as { memory: WebAssembly.Memory }).memory;
  try { return ((inst.exports as { main: CallableFunction }).main() as number) | 0; }
  catch (e) { if ((e as { __exit?: number }).__exit === undefined) throw e; return (e as { __exit: number }).__exit; }
}
