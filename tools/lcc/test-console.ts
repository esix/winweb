/* Проверка консольной амальгамы: libc.c + программа -> cpp.ts -> rcc -> запуск.
 *   node --experimental-strip-types tools/lcc/test-console.ts
 */
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { preprocess } from '../../src/cc/cpp.ts';
import { compileToWasm } from './ccwasm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const libcDir = join(HERE, 'wasm-libc');
const headers = new Map<string, string>();
for (const f of readdirSync(libcDir)) if (f.endsWith('.h')) headers.set(f, readFileSync(join(libcDir, f), 'utf8'));
const libc = readFileSync(join(libcDir, 'libc.c'), 'utf8');

const demo = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int fib(int n){ if(n<2) return n; return fib(n-1)+fib(n-2); }
int main(void){
  int i; char *s; int *m;
  printf("Fibonacci:");
  for(i=0;i<12;i++) printf(" %d", fib(i));
  printf("\\n");
  s = (char*)malloc(32);
  strcpy(s, "malloc+strcpy ok");
  printf("%s, len=%d\\n", s, (int)strlen(s));
  m = (int*)malloc(4*sizeof(int));
  for(i=0;i<4;i++) m[i] = i*i;
  printf("squares: %d %d %d %d\\n", m[0], m[1], m[2], m[3]);
  printf("hex ff = %x, char = %c\\n", 255, 65);
  return 0;
}`;

let cppErr = '';
const pp = preprocess(libc + '\n' + demo, { includes: headers, onError: (m) => { cppErr += m + '\n'; } });
if (cppErr) { console.error('CPP ERRORS:\n' + cppErr); process.exit(1); }

const { wasm, stderr, code } = compileToWasm(pp);
console.log('rcc: code', code, '| stderr:', stderr.trim() || '(none)', '| bytes:', wasm.length, '| valid:', WebAssembly.validate(wasm));
if (code !== 0 || !wasm.length) { console.error('compile failed'); process.exit(1); }

let out = '';
const env = {
  __read: () => 0,
  __write: (fd: number, ptr: number, len: number) => { const b = new Uint8Array(mem.buffer, ptr, len); for (let i = 0; i < len; i++) out += String.fromCharCode(b[i]); return len; },
  __exit: (c: number) => { throw { __exit: c }; },
};
let mem: WebAssembly.Memory;
const inst = new WebAssembly.Instance(new WebAssembly.Module(wasm), { env: new Proxy(env, { get: (t, k) => (k in t ? (t as Record<string, unknown>)[k] : () => 0) }) });
mem = (inst.exports as { memory: WebAssembly.Memory }).memory;
let rc: unknown = 0;
try { rc = (inst.exports as { main: CallableFunction }).main(); } catch (e) { if ((e as { __exit?: number }).__exit === undefined) throw e; rc = (e as { __exit: number }).__exit; }
console.log('--- program output ---\n' + out + '--- rc=' + rc + ' ---');
