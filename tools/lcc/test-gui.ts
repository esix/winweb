import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { preprocess } from '../../src/cc/cpp.ts';
import { compileToWasm } from './ccwasm.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const headers = new Map<string,string>([['windows.h', readFileSync(join(HERE,'include-gui','windows.h'),'utf8')]]);
const src = readFileSync('/tmp/winhello-lcc.c','utf8');
let cppErr=''; const pp = preprocess(src, { includes: headers, onError:(m)=>{cppErr+=m+'\n';} });
if(cppErr){ console.error('CPP:',cppErr); process.exit(1); }
const { wasm, stderr, code } = compileToWasm(pp);
console.log('rcc code',code,'| stderr:', stderr.trim()||'(none)','| bytes', wasm.length, '| valid', WebAssembly.validate(wasm));
