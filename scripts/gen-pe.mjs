/* gen-pe.mjs — минимальный валидный PE (.exe) с одной иконкой в .rsrc, чтобы проверить
 * извлечение иконки из настоящего exe (pe.ts). Не запускаемый — только структура для парсера. */
import { readFileSync, writeFileSync } from 'node:fs';

const ico = readFileSync('apps/minesweeper/mine.ico');
const dib = ico.subarray(22);                 // .ico = ICONDIR(6)+ICONDIRENTRY(16); дальше DIB
const w = ico[6], h = ico[7], bpp = ico.readUInt16LE(12);
const RSRC_RVA = 0x1000;

/* --- .rsrc: дерево ресурсов RT_GROUP_ICON(14) + RT_ICON(3) --- */
const GRP = 160, ICONDIB = 180;               // смещения данных внутри секции
const rsrc = Buffer.alloc(ICONDIB + dib.length);
const dir = (off, nId) => { rsrc.writeUInt16LE(nId, off + 14); };                          // IMAGE_RESOURCE_DIRECTORY: numId
const ent = (off, idOrName, ptr, sub) => { rsrc.writeUInt32LE(idOrName, off); rsrc.writeUInt32LE(sub ? (ptr | 0x80000000) >>> 0 : ptr, off + 4); };
const data = (off, rva, size) => { rsrc.writeUInt32LE(rva, off); rsrc.writeUInt32LE(size, off + 4); };
// root: 2 type-записи (14, 3)
dir(0, 2);   ent(16, 14, 32, true);  ent(24, 3, 80, true);
// RT_GROUP_ICON -> id 1 -> lang 0 -> data@128
dir(32, 1);  ent(48, 1, 56, true);
dir(56, 1);  ent(72, 0, 128, false);
// RT_ICON -> id 1 -> lang 0 -> data@144
dir(80, 1);  ent(96, 1, 104, true);
dir(104, 1); ent(120, 0, 144, false);
// data entries (IMAGE_RESOURCE_DATA_ENTRY: RVA, size, codepage, reserved)
data(128, RSRC_RVA + GRP, 20);
data(144, RSRC_RVA + ICONDIB, dib.length);
// GRPICONDIR (6) + GRPICONDIRENTRY (14)
rsrc.writeUInt16LE(1, GRP + 2); rsrc.writeUInt16LE(1, GRP + 4);
rsrc[GRP + 6] = w; rsrc[GRP + 7] = h; rsrc[GRP + 8] = 0;
rsrc.writeUInt16LE(1, GRP + 6 + 4); rsrc.writeUInt16LE(bpp, GRP + 6 + 6);
rsrc.writeUInt32LE(dib.length, GRP + 6 + 8); rsrc.writeUInt16LE(1, GRP + 6 + 12);
dib.copy(rsrc, ICONDIB);

/* --- заголовки PE --- */
const HDR = 0x200;                            // sizeOfHeaders / file offset of .rsrc (fileAlignment)
const out = Buffer.alloc(HDR + Math.ceil(rsrc.length / 0x200) * 0x200);
out.write('MZ', 0); out.writeUInt32LE(0x40, 0x3c);          // e_lfanew = 0x40
const pe = 0x40;
out.write('PE\0\0', pe);
out.writeUInt16LE(0x14c, pe + 4);             // machine i386
out.writeUInt16LE(1, pe + 6);                 // numSections
out.writeUInt16LE(224, pe + 20);              // sizeOfOptionalHeader (PE32: 96 + 16*8)
out.writeUInt16LE(0x102, pe + 22);            // characteristics: EXECUTABLE|32BIT
const opt = pe + 24;
out.writeUInt16LE(0x10b, opt);                // PE32 magic
out.writeUInt32LE(0x400000, opt + 28);        // imageBase
out.writeUInt32LE(0x1000, opt + 32);          // sectionAlignment
out.writeUInt32LE(0x200, opt + 36);           // fileAlignment
out.writeUInt32LE(RSRC_RVA + 0x1000, opt + 56); // sizeOfImage
out.writeUInt32LE(HDR, opt + 60);             // sizeOfHeaders
out.writeUInt16LE(2, opt + 68);               // subsystem GUI
out.writeUInt32LE(16, opt + 92);              // numberOfRvaAndSizes
out.writeUInt32LE(RSRC_RVA, opt + 96 + 2 * 8);    // data dir[2] (resource) RVA
out.writeUInt32LE(rsrc.length, opt + 96 + 2 * 8 + 4);  // ... size
const sec = opt + 224;                        // section header
out.write('.rsrc', sec);
out.writeUInt32LE(rsrc.length, sec + 8);      // virtualSize
out.writeUInt32LE(RSRC_RVA, sec + 12);        // virtualAddress
out.writeUInt32LE(Math.ceil(rsrc.length / 0x200) * 0x200, sec + 16);   // sizeOfRawData
out.writeUInt32LE(HDR, sec + 20);             // pointerToRawData
out.writeUInt32LE(0x40000040, sec + 36);      // characteristics: INITIALIZED_DATA|READ
rsrc.copy(out, HDR);

writeFileSync('public/cdrive/files/winmine.exe', out);
console.log(`gen-pe: wrote winmine.exe (${out.length}B, icon ${dib.length}B)`);
