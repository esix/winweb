/* exe-icon.ts — достать иконку из ИСПОЛНЯЕМОГО файла БЕЗ запуска, для показа в оболочке
 * (рабочий стол / Проводник / Пуск). .wasm: кастомная секция "winweb.ico" (кладёт build-шаг);
 * .exe/.dll: ресурсы PE; .ico/.bmp: как есть. Возвращает object-URL для <img> (браузер декодирует). */
import { peExtractIco } from './pe';

/** LEB128 (unsigned) из bytes[p], возвращает [value, nextPos]. */
function leb(bytes: Uint8Array, p: number): [number, number] {
  let val = 0, shift = 0, b: number;
  do { b = bytes[p++]; val |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
  return [val >>> 0, p];
}

/** Полезная нагрузка кастомной секции "winweb.ico" из .wasm, или null. */
export function wasmIconSection(bytes: Uint8Array): Uint8Array | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, true) !== 0x6d736100) return null;        // '\0asm'
  let p = 8;
  while (p < bytes.length) {
    const id = bytes[p++];
    let size: number; [size, p] = leb(bytes, p);
    const end = p + size;
    if (id === 0) {                                            // custom section: namelen + name + payload
      let nameLen: number, np: number; [nameLen, np] = leb(bytes, p);
      const name = new TextDecoder().decode(bytes.subarray(np, np + nameLen));
      if (name === 'winweb.ico') return bytes.subarray(np + nameLen, end);
    }
    p = end;
  }
  return null;
}

/** object-URL иконки исполняемого файла (или null, если иконки нет). */
export function executableIconUrl(bytes: Uint8Array, name: string): string | null {
  const n = name.toLowerCase();
  let ico: Uint8Array | null = null;
  let mime = 'image/x-icon';
  if (n.endsWith('.wasm')) ico = wasmIconSection(bytes);
  else if (n.endsWith('.exe') || n.endsWith('.dll')) ico = peExtractIco(bytes);
  else if (n.endsWith('.ico')) ico = bytes;
  else if (n.endsWith('.bmp')) { ico = bytes; mime = 'image/bmp'; }
  if (!ico || !ico.length) return null;
  return URL.createObjectURL(new Blob([ico.slice()], { type: mime }));
}
