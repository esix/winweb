/* pe.ts — извлечь иконку из настоящего PE (.exe/.dll): разобрать .rsrc, найти RT_GROUP_ICON +
 * RT_ICON и пересобрать самостоятельный .ico (как делает извлечение иконки в Windows-проводнике). */
const RT_ICON = 3, RT_GROUP_ICON = 14;

interface Sec { va: number; vs: number; raw: number; ptr: number; }

function findEntry(v: DataView, dirOff: number, id: number): number | null {
  const n = v.getUint16(dirOff + 12, true) + v.getUint16(dirOff + 14, true);
  for (let i = 0; i < n; i++) {
    const e = dirOff + 16 + i * 8;
    const nameOrId = v.getUint32(e, true);
    if (!(nameOrId & 0x80000000) && nameOrId === id) return v.getUint32(e + 4, true);   // offsetToData
  }
  return null;
}
function firstOff(v: DataView, dirOff: number): number | null {
  if (v.getUint16(dirOff + 12, true) + v.getUint16(dirOff + 14, true) === 0) return null;
  return v.getUint32(dirOff + 16 + 4, true);   // offsetToData первой записи
}

/** Иконку (.ico-байты) из PE, или null если не PE / нет иконки. */
export function peExtractIco(bytes: Uint8Array): Uint8Array | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(0, true) !== 0x5a4d) return null;                       // 'MZ'
  const pe = v.getUint32(0x3c, true);
  if (pe + 24 > bytes.length || v.getUint32(pe, false) !== 0x50450000) return null;   // 'PE\0\0'
  const numSec = v.getUint16(pe + 6, true);
  const optSize = v.getUint16(pe + 20, true);
  const optOff = pe + 24;
  const magic = v.getUint16(optOff, true);
  const resRva = v.getUint32(optOff + (magic === 0x20b ? 112 : 96) + 2 * 8, true);   // data dir[2] = resources
  if (!resRva) return null;

  const secOff = optOff + optSize;
  const secs: Sec[] = [];
  for (let i = 0; i < numSec; i++) { const s = secOff + i * 40; secs.push({ vs: v.getUint32(s + 8, true), va: v.getUint32(s + 12, true), raw: v.getUint32(s + 16, true), ptr: v.getUint32(s + 20, true) }); }
  const rvaToOff = (rva: number): number => {
    for (const s of secs) if (rva >= s.va && rva < s.va + Math.max(s.vs, s.raw)) return s.ptr + (rva - s.va);
    return -1;
  };
  const resBase = rvaToOff(resRva);
  if (resBase < 0) return null;

  // спускаемся тип -> (id или первая) -> язык(первая) -> data entry {rva,size}
  const leaf = (typeId: number, resId: number | null): { rva: number; size: number } | null => {
    const t = findEntry(v, resBase, typeId); if (t == null || !(t & 0x80000000)) return null;
    const nameDir = resBase + (t & 0x7fffffff);
    const nOff = resId != null ? findEntry(v, nameDir, resId) : firstOff(v, nameDir);
    if (nOff == null || !(nOff & 0x80000000)) return null;
    const lOff = firstOff(v, resBase + (nOff & 0x7fffffff));
    if (lOff == null || (lOff & 0x80000000)) return null;                 // должен быть лист
    const de = resBase + lOff;
    return { rva: v.getUint32(de, true), size: v.getUint32(de + 4, true) };
  };

  const grp = leaf(RT_GROUP_ICON, null); if (!grp) return null;
  const g = rvaToOff(grp.rva); if (g < 0) return null;
  const count = v.getUint16(g + 4, true);                                 // GRPICONDIR

  // собираем DIB-блобы по id из RT_ICON
  const dibs: Uint8Array[] = []; const entries: number[][] = [];
  for (let i = 0; i < count; i++) {
    const e = g + 6 + i * 14;                                             // GRPICONDIRENTRY (14 байт)
    const id = v.getUint16(e + 12, true);
    const ic = leaf(RT_ICON, id); if (!ic) continue;
    const off = rvaToOff(ic.rva); if (off < 0) continue;
    dibs.push(bytes.subarray(off, off + ic.size));
    entries.push([v.getUint8(e), v.getUint8(e + 1), v.getUint8(e + 2), 0, v.getUint16(e + 4, true), v.getUint16(e + 6, true), ic.size]);
  }
  if (!dibs.length) return null;

  // пересобираем .ico: ICONDIR + ICONDIRENTRY[] (16 байт, с imageOffset) + DIB-данные
  const headerLen = 6 + entries.length * 16;
  const total = headerLen + dibs.reduce((s, d) => s + d.length, 0);
  const out = new Uint8Array(total); const ov = new DataView(out.buffer);
  ov.setUint16(0, 0, true); ov.setUint16(2, 1, true); ov.setUint16(4, entries.length, true);
  let dataOff = headerLen;
  for (let i = 0; i < entries.length; i++) {
    const e = 6 + i * 16, [w, h, cc, , planes, bpp, size] = entries[i];
    out[e] = w; out[e + 1] = h; out[e + 2] = cc; out[e + 3] = 0;
    ov.setUint16(e + 4, planes, true); ov.setUint16(e + 6, bpp, true);
    ov.setUint32(e + 8, size, true); ov.setUint32(e + 12, dataOff, true);
    out.set(dibs[i], dataOff); dataOff += dibs[i].length;
  }
  return out;
}
