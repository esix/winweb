/* dib.ts — СИНХРОННЫЙ декодер Windows-растров: .bmp, .ico (+ .exe-иконки через pe.ts) -> <canvas>.
 * Поддержка 1/4/8/24/32 bpp, палитра, AND-маска прозрачности, top-down/bottom-up — реальные форматы.
 * Синхронно, чтобы BitBlt/DrawIcon в WM_PAINT рисовали сразу (как Windows), без async-загрузки.
 */
function view(bytes: Uint8Array): DataView { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function isPng(v: DataView, off: number): boolean { return v.getUint32(off, false) === 0x89504e47; }

function readPalette(v: DataView, off: number, count: number): Array<[number, number, number]> {
  const p: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) { const o = off + i * 4; p.push([v.getUint8(o + 2), v.getUint8(o + 1), v.getUint8(o)]); }   // BGRX -> RGB
  return p;
}

/** Декодировать DIB (BITMAPINFOHEADER@infoOff). isIcon -> высота двойная (XOR+AND), есть AND-маска. */
function decodeDib(v: DataView, infoOff: number, pixelOff: number | null, isIcon: boolean): ImageData | null {
  const width = v.getInt32(infoOff + 4, true);
  const rawH = v.getInt32(infoOff + 8, true);
  const bpp = v.getUint16(infoOff + 14, true);
  const comp = v.getUint32(infoOff + 16, true);
  if (comp !== 0 && comp !== 3) return null;                         // только BI_RGB / BI_BITFIELDS (RLE не поддержан)
  const realH = isIcon ? Math.abs(rawH) >> 1 : Math.abs(rawH);
  const topDown = !isIcon && rawH < 0;
  if (width <= 0 || realH <= 0 || width > 1024 || realH > 1024) return null;

  let palCount = 0;
  if (bpp <= 8) palCount = v.getUint32(infoOff + 32, true) || (1 << bpp);
  const palette = bpp <= 8 ? readPalette(v, infoOff + 40, palCount) : null;
  const xorOff = pixelOff ?? infoOff + 40 + palCount * 4;
  const rowSize = (((bpp * width + 31) >> 5) << 2);

  const out = new ImageData(width, realH);
  let anyAlpha = false;
  for (let y = 0; y < realH; y++) {
    const srcY = topDown ? y : realH - 1 - y;
    const row = xorOff + srcY * rowSize;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 255;
      if (bpp === 32) { const p = row + x * 4; b = v.getUint8(p); g = v.getUint8(p + 1); r = v.getUint8(p + 2); a = v.getUint8(p + 3); if (a) anyAlpha = true; }
      else if (bpp === 24) { const p = row + x * 3; b = v.getUint8(p); g = v.getUint8(p + 1); r = v.getUint8(p + 2); }
      else if (bpp === 8) { const c = palette![v.getUint8(row + x)] ?? [0, 0, 0]; r = c[0]; g = c[1]; b = c[2]; }
      else if (bpp === 4) { const byte = v.getUint8(row + (x >> 1)); const idx = (x & 1) ? byte & 0xf : byte >> 4; const c = palette![idx] ?? [0, 0, 0]; r = c[0]; g = c[1]; b = c[2]; }
      else if (bpp === 1) { const byte = v.getUint8(row + (x >> 3)); const idx = (byte >> (7 - (x & 7))) & 1; const c = palette![idx] ?? [0, 0, 0]; r = c[0]; g = c[1]; b = c[2]; }
      else return null;
      const o = (y * width + x) * 4; out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = a;
    }
  }
  // AND-маска (1bpp): прозрачность для <32bpp ИЛИ для 32bpp с пустой альфой (старые иконки)
  if (isIcon && (bpp !== 32 || !anyAlpha)) {
    const andOff = xorOff + rowSize * realH;
    const andRow = (((width + 31) >> 5) << 2);
    for (let y = 0; y < realH; y++) {
      const row = andOff + (realH - 1 - y) * andRow;
      for (let x = 0; x < width; x++) {
        const byte = v.getUint8(row + (x >> 3));
        if ((byte >> (7 - (x & 7))) & 1) out.data[(y * width + x) * 4 + 3] = 0;
        else if (!anyAlpha) out.data[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return out;
}

function toCanvas(img: ImageData): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  cv.getContext('2d')!.putImageData(img, 0, 0);
  return cv;
}

/** .bmp-файл. */
export function decodeBmp(bytes: Uint8Array): HTMLCanvasElement | null {
  const v = view(bytes);
  if (v.getUint16(0, false) !== 0x424d) return null;            // 'BM'
  const img = decodeDib(v, 14, v.getUint32(10, true), false);
  return img ? toCanvas(img) : null;
}

/** .ico — выбираем лучшую запись (наибольшая площадь, затем глубина), пропускаем PNG-записи. */
export function decodeIco(bytes: Uint8Array): HTMLCanvasElement | null {
  const v = view(bytes);
  if (v.getUint16(0, true) !== 0 || v.getUint16(2, true) !== 1) return null;   // reserved=0, type=1(icon)
  const count = v.getUint16(4, true);
  let best = -1, bestScore = -1;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const w = v.getUint8(e) || 256, h = v.getUint8(e + 1) || 256, bpp = v.getUint16(e + 6, true);
    const off = v.getUint32(e + 12, true);
    if (isPng(v, off)) continue;                                 // PNG-запись — синхронно не декодируем (display идёт через <img>)
    const score = w * h * 1000 + bpp;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (best < 0) return null;
  const img = decodeDib(v, v.getUint32(best + 12, true), null, true);
  return img ? toCanvas(img) : null;
}

export function decodeImage(bytes: Uint8Array, mime: string): HTMLCanvasElement | null {
  if (mime.includes('ico') || mime.includes('icon')) return decodeIco(bytes);
  if (mime.includes('bmp')) return decodeBmp(bytes);
  return null;
}
