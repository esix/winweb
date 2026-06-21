/* gen-icons.mjs — генерирует НАСТОЯЩИЕ Windows .ico (32-bit DIB c альфой) и .bmp (24-bit)
 * для src/cdrive/Projects/IconsDemo/res/. Рисует простые фигуры в RGBA-буфер и кодирует в форматы Windows. */
import { writeFileSync, mkdirSync } from 'node:fs';

const SZ = 32;
const blank = () => new Uint8Array(SZ * SZ * 4);            // RGBA, top-down, прозрачный
const setpx = (b, x, y, r, g, bl, a) => { const o = (y * SZ + x) * 4; b[o] = r; b[o + 1] = g; b[o + 2] = bl; b[o + 3] = a; };

function disc(r, g, b) { const buf = blank(); for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const dx = x - 15.5, dy = y - 15.5; if (dx * dx + dy * dy <= 14 * 14) setpx(buf, x, y, r, g, b, 255); } return buf; }
function diamond(r, g, b) { const buf = blank(); for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) if (Math.abs(x - 16) + Math.abs(y - 16) <= 13) setpx(buf, x, y, r, g, b, 255); return buf; }
function ring(r, g, b) { const buf = blank(); for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const dx = x - 15.5, dy = y - 15.5, d = Math.sqrt(dx * dx + dy * dy); if (d >= 8 && d <= 14) setpx(buf, x, y, r, g, b, 255); } return buf; }
function mine() {                                            // мина сапёра: чёрный шар + шипы + блик
  const buf = blank();
  for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; for (let r = 7; r <= 15; r++) { const x = Math.round(15.5 + Math.cos(ang) * r), y = Math.round(15.5 + Math.sin(ang) * r); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && xx < SZ && yy >= 0 && yy < SZ) setpx(buf, xx, yy, 25, 25, 25, 255); } } }
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const dx = x - 15.5, dy = y - 15.5; if (dx * dx + dy * dy <= 9 * 9) setpx(buf, x, y, 25, 25, 25, 255); }
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const dx = x - 12, dy = y - 12; if (dx * dx + dy * dy <= 2.5 * 2.5) setpx(buf, x, y, 210, 210, 210, 255); }
  return buf;
}
function appwin() {                                          // окошко (для Hello)
  const buf = blank();
  for (let y = 6; y < 26; y++) for (let x = 4; x < 28; x++) setpx(buf, x, y, 255, 255, 255, 255);
  for (let y = 6; y < 12; y++) for (let x = 4; x < 28; x++) setpx(buf, x, y, 0, 0, 160, 255);
  for (let x = 4; x < 28; x++) { setpx(buf, x, 6, 40, 40, 40, 255); setpx(buf, x, 25, 40, 40, 40, 255); }
  for (let y = 6; y < 26; y++) { setpx(buf, 4, y, 40, 40, 40, 255); setpx(buf, 27, y, 40, 40, 40, 255); }
  return buf;
}
function term() {                                           // иконка консоли: тёмный экран + зелёный ">_"
  const buf = blank();
  for (let y = 4; y < 28; y++) for (let x = 2; x < 30; x++) setpx(buf, x, y, 25, 25, 30, 255);
  const G = (x, y) => setpx(buf, x, y, 80, 230, 90, 255);
  for (let i = 0; i < 5; i++) { G(8 + i, 11 + i); G(9 + i, 11 + i); }
  for (let i = 0; i < 5; i++) { G(8 + i, 19 - i); G(9 + i, 19 - i); }
  for (let x = 16; x < 24; x++) { G(x, 20); G(x, 21); }
  return buf;
}
function smiley() {                                          // непрозрачный (для BMP)
  const buf = blank();
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) setpx(buf, x, y, 255, 255, 255, 255);          // белый фон
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const dx = x - 15.5, dy = y - 15.5; if (dx * dx + dy * dy <= 14 * 14) setpx(buf, x, y, 245, 205, 40, 255); } // лицо
  for (const ex of [11, 20]) for (let y = 11; y <= 14; y++) for (let x = ex - 1; x <= ex + 1; x++) setpx(buf, x, y, 40, 40, 40, 255);   // глаза
  for (let x = 10; x <= 21; x++) { const y = Math.round(19 + 3 * Math.sin(((x - 10) / 11) * Math.PI)); setpx(buf, x, y, 40, 40, 40, 255); setpx(buf, x, y + 1, 40, 40, 40, 255); }  // улыбка
  return buf;
}

function bmp24(rgba) {                                       // 24-bit BMP file, снизу вверх
  const rowSize = Math.floor((24 * SZ + 31) / 32) * 4, px = rowSize * SZ;
  const b = Buffer.alloc(14 + 40 + px);
  b.write('BM', 0); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(SZ, 18); b.writeInt32LE(SZ, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  let p = 54;
  for (let y = SZ - 1; y >= 0; y--) { let rp = p; for (let x = 0; x < SZ; x++) { const o = (y * SZ + x) * 4; b[rp++] = rgba[o + 2]; b[rp++] = rgba[o + 1]; b[rp++] = rgba[o]; } p += rowSize; }
  return b;
}
function ico32(rgba) {                                       // одиночная иконка, 32-bit DIB + альфа
  const xor = SZ * SZ * 4, andSize = (Math.floor((SZ + 31) / 32) * 4) * SZ, dib = 40 + xor + andSize;
  const b = Buffer.alloc(6 + 16 + dib);
  b.writeUInt16LE(0, 0); b.writeUInt16LE(1, 2); b.writeUInt16LE(1, 4);                       // ICONDIR
  b.writeUInt8(SZ, 6); b.writeUInt8(SZ, 7); b.writeUInt16LE(1, 10); b.writeUInt16LE(32, 12); // ICONDIRENTRY
  b.writeUInt32LE(dib, 14); b.writeUInt32LE(22, 18);
  b.writeUInt32LE(40, 22); b.writeInt32LE(SZ, 26); b.writeInt32LE(SZ * 2, 30); b.writeUInt16LE(1, 34); b.writeUInt16LE(32, 36); // BITMAPINFOHEADER
  let p = 62;                                                                                 // XOR BGRA, снизу вверх
  for (let y = SZ - 1; y >= 0; y--) for (let x = 0; x < SZ; x++) { const o = (y * SZ + x) * 4; b[p++] = rgba[o + 2]; b[p++] = rgba[o + 1]; b[p++] = rgba[o]; b[p++] = rgba[o + 3]; }
  return b;                                                                                   // AND-маска = нули (используем альфу)
}

function doc() {                                            // документ (Notepad): белый лист + строки
  const buf = blank();
  for (let y = 4; y < 28; y++) for (let x = 7; x < 25; x++) setpx(buf, x, y, 255, 255, 255, 255);
  for (let y = 4; y < 28; y++) { setpx(buf, 7, y, 90, 90, 90, 255); setpx(buf, 24, y, 90, 90, 90, 255); }
  for (let x = 7; x < 25; x++) { setpx(buf, x, 4, 90, 90, 90, 255); setpx(buf, x, 27, 90, 90, 90, 255); }
  for (let i = 0; i < 5; i++) for (let x = 10; x < 22; x++) setpx(buf, x, 9 + i * 4, 60, 90, 200, 255);
  return buf;
}
function gear() {                                           // шестерёнка (msbuild/cc — инструменты)
  const buf = blank();
  for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; for (let r = 9; r <= 14; r++) { const x = Math.round(15.5 + Math.cos(ang) * r), y = Math.round(15.5 + Math.sin(ang) * r); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && xx < SZ && yy >= 0 && yy < SZ) setpx(buf, xx, yy, 120, 120, 130, 255); } } }
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const d = (x - 15.5) ** 2 + (y - 15.5) ** 2; if (d <= 10 * 10) setpx(buf, x, y, 150, 150, 160, 255); if (d <= 4 * 4) setpx(buf, x, y, 60, 60, 70, 255); }
  return buf;
}

mkdirSync('src/cdrive/Projects/IconsDemo/res', { recursive: true });
writeFileSync('src/cdrive/Projects/IconsDemo/res/disc.ico', ico32(disc(245, 200, 30)));
writeFileSync('src/cdrive/Projects/IconsDemo/res/diamond.ico', ico32(diamond(220, 40, 40)));
writeFileSync('src/cdrive/Projects/IconsDemo/res/ring.ico', ico32(ring(40, 170, 70)));
writeFileSync('src/cdrive/Projects/IconsDemo/res/smiley.bmp', bmp24(smiley()));
/* app.ico в каждом проекте -> build-cdrive встраивает её секцией "winweb.ico" (иконка в заголовке/столе/Пуске) */
const appIcons = { Hello: appwin(), Minesweeper: mine(), Cmd: term(), Notepad: doc(), IconsDemo: disc(245, 200, 30), msbuild: gear(), cc: gear() };
for (const [proj, buf] of Object.entries(appIcons)) writeFileSync(`src/cdrive/Projects/${proj}/app.ico`, ico32(buf));
console.log('gen-icons: wrote iconsdemo res + app.ico for ' + Object.keys(appIcons).join('/'));
