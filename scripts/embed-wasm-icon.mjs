/* embed-wasm-icon.mjs — добавляет в .wasm кастомную секцию "winweb.ico" с байтами .ico,
 * чтобы оболочка показывала иконку файла БЕЗ его запуска. Секция игнорируется рантаймом.
 * Usage: node scripts/embed-wasm-icon.mjs <file.wasm> <icon.ico>  */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , wasmPath, icoPath] = process.argv;
if (!wasmPath || !icoPath) { console.error('usage: embed-wasm-icon.mjs <wasm> <ico>'); process.exit(1); }

const leb = (n) => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return Buffer.from(o); };

const wasm = readFileSync(wasmPath);
const ico = readFileSync(icoPath);
const name = Buffer.from('winweb.ico');
const body = Buffer.concat([leb(name.length), name, ico]);     // namelen + name + payload
const section = Buffer.concat([Buffer.from([0]), leb(body.length), body]);   // id=0 (custom) + size + body
writeFileSync(wasmPath, Buffer.concat([wasm, section]));
console.log(`embed-wasm-icon: +winweb.ico (${ico.length}B) -> ${wasmPath}`);
