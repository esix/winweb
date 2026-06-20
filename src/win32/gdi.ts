/* gdi.ts — GDI-объектная модель поверх Canvas2D.
 *
 * HDC/HBITMAP/HFONT/HPEN/HBRUSH — целочисленные хендлы (как в Win32 — непрозрачные).
 * DC хранит текущие перо/кисть/шрифт/цвета и привязанный canvas.
 * Memory DC = offscreen <canvas>; SelectObject(dc, bitmap) привязывает его canvas;
 * BitBlt = drawImage между canvas'ами (двойная буферизация «бесплатно»).
 */
import type { WindowManager } from '../wm/window-manager';
import { decodeImage } from './dib';

const col = (c: number) => `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;

interface Pen { kind: 'pen'; color: string; width: number; }
interface Brush { kind: 'brush'; color: string; cref: number; }
interface Font { kind: 'font'; css: string; }
interface Bitmap { kind: 'bitmap'; cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; }
interface DC {
  kind: 'dc';
  ctx: CanvasRenderingContext2D | null;
  cv: HTMLCanvasElement | null;
  penColor: string; penWidth: number; brushColor: string; font: string;
  textColor: string; bkColor: string; bkMode: number;
  hPen: number; hBrush: number; hFont: number; hBitmap: number;
  x: number; y: number;
}
type Obj = Pen | Brush | Font | Bitmap | DC;

export class Gdi {
  private objs = new Map<number, Obj>();
  private next = 1000;
  constructor(private wm: WindowManager, private heap: () => Uint8Array) {}

  private add(o: Obj): number { const h = this.next++; this.objs.set(h, o); return h; }
  private dc(h: number): DC | undefined { const o = this.objs.get(h); return o?.kind === 'dc' ? o : undefined; }

  windowDC(winId: number): number {
    const ctx = this.wm.ctx(winId);
    return this.add({ kind: 'dc', ctx: ctx ?? null, cv: ctx?.canvas ?? null,
      penColor: '#000', penWidth: 1, brushColor: '#000', font: '13px sans-serif',
      textColor: '#000', bkColor: '#fff', bkMode: 2, hPen: 0, hBrush: 0, hFont: 0, hBitmap: 0, x: 0, y: 0 });
  }
  createCompatibleDC(): number {
    return this.add({ kind: 'dc', ctx: null, cv: null,
      penColor: '#000', penWidth: 1, brushColor: '#000', font: '13px sans-serif',
      textColor: '#000', bkColor: '#fff', bkMode: 2, hPen: 0, hBrush: 0, hFont: 0, hBitmap: 0, x: 0, y: 0 });
  }
  createCompatibleBitmap(w: number, h: number): number {
    const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h);
    return this.add({ kind: 'bitmap', cv, ctx: cv.getContext('2d')! });
  }
  /** LoadIcon/LoadBitmap: декодируем .ico/.bmp из кучи (ptr,len) в битмап-объект. */
  loadImageRes(ptr: number, len: number, mime: string): number {
    const cv = decodeImage(this.heap().subarray(ptr, ptr + len), mime);
    if (!cv) return 0;
    return this.add({ kind: 'bitmap', cv, ctx: cv.getContext('2d')! });
  }
  /** DrawIcon(hdc, x, y, hIcon) — рисуем битмап иконки в натуральном размере. */
  drawIcon(dcH: number, x: number, y: number, iconH: number): void {
    const d = this.dc(dcH), o = this.objs.get(iconH);
    if (d?.ctx && o?.kind === 'bitmap') d.ctx.drawImage(o.cv, x, y);
  }
  /** data-URL иконки (для значка в заголовке окна). */
  iconDataUrl(h: number): string { const o = this.objs.get(h); return o?.kind === 'bitmap' ? o.cv.toDataURL() : ''; }
  createPen(_style: number, width: number, c: number): number { return this.add({ kind: 'pen', color: col(c), width: Math.max(1, width) }); }
  createSolidBrush(c: number): number { return this.add({ kind: 'brush', color: col(c), cref: c >>> 0 }); }
  createFont(height: number, weight: number, italic: number): number {
    const px = Math.abs(height) || 13;
    return this.add({ kind: 'font', css: `${italic ? 'italic ' : ''}${weight >= 700 ? 'bold ' : ''}${px}px sans-serif` });
  }
  getStockObject(o: number): number {
    if (o === 6) return this.add({ kind: 'pen', color: '#fff', width: 1 });          // WHITE_PEN
    if (o === 7) return this.add({ kind: 'pen', color: '#000', width: 1 });          // BLACK_PEN
    if (o === 8) return this.add({ kind: 'pen', color: '#000', width: 0 });          // NULL_PEN (no stroke)
    const t: Record<number, number> = { 0: 0xffffff, 1: 0xc0c0c0, 2: 0x808080, 3: 0x404040, 4: 0x000000, 5: -1 };
    const cref = t[o] ?? 0xffffff;
    return this.add({ kind: 'brush', color: cref < 0 ? 'rgba(0,0,0,0)' : col(cref), cref });  // 5=NULL_BRUSH
  }
  getSysColorBrush(idx: number): number {
    const cref = idx === 5 ? 0xffffff : idx === 8 ? 0x000000 : 0xc0c0c0;             // WINDOW / WINDOWTEXT / BTNFACE
    return this.add({ kind: 'brush', color: col(cref), cref });
  }
  brushColorOf(h: number): number { const o = this.objs.get(h); return o?.kind === 'brush' ? o.cref : 0xffffff; }
  textExtent(dcH: number, s: string): [number, number] {
    const d = this.dc(dcH); if (!d?.ctx) return [0, 0];
    d.ctx.font = d.font;
    const m = d.ctx.measureText(s);
    // высота = полная метрика шрифта (≈ Win32 tmHeight), не em-размер — иначе центрирование уезжает вниз
    const h = Math.ceil((m.fontBoundingBoxAscent || 0) + (m.fontBoundingBoxDescent || 0)) || (parseInt(d.font) || 13);
    return [Math.ceil(m.width), h];
  }
  deleteObject(h: number): number { this.objs.delete(h); return 1; }
  deleteDC(h: number): number { this.objs.delete(h); return 1; }

  selectObject(dcH: number, objH: number): number {
    const d = this.dc(dcH); const o = this.objs.get(objH);
    if (!d || !o) return 0;
    let prev = 0;
    if (o.kind === 'bitmap') { prev = d.hBitmap; d.hBitmap = objH; d.cv = o.cv; d.ctx = o.ctx; }
    else if (o.kind === 'pen') { prev = d.hPen; d.hPen = objH; d.penColor = o.color; d.penWidth = o.width; }
    else if (o.kind === 'brush') { prev = d.hBrush; d.hBrush = objH; d.brushColor = o.color; }
    else if (o.kind === 'font') { prev = d.hFont; d.hFont = objH; d.font = o.css; }
    return prev;
  }

  bitBlt(dstH: number, dx: number, dy: number, w: number, h: number, srcH: number, sx: number, sy: number): void {
    const d = this.dc(dstH), s = this.dc(srcH);
    if (d?.ctx && s?.cv) d.ctx.drawImage(s.cv, sx, sy, w, h, dx, dy, w, h);
  }
  fillRect(dcH: number, l: number, t: number, r: number, b: number, brushH: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    const br = this.objs.get(brushH); d.ctx.fillStyle = br?.kind === 'brush' ? br.color : d.brushColor;
    d.ctx.fillRect(l, t, r - l, b - t);
  }
  rectangle(dcH: number, l: number, t: number, r: number, b: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    d.ctx.fillStyle = d.brushColor; d.ctx.fillRect(l, t, r - l, b - t);
    if (d.penWidth > 0) { d.ctx.strokeStyle = d.penColor; d.ctx.lineWidth = d.penWidth; d.ctx.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1); }
  }
  ellipse(dcH: number, l: number, t: number, r: number, b: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    d.ctx.beginPath();
    d.ctx.ellipse((l + r) / 2, (t + b) / 2, Math.abs(r - l) / 2, Math.abs(b - t) / 2, 0, 0, 6.2832);
    d.ctx.fillStyle = d.brushColor; d.ctx.fill();
    this.stroke(d);
  }
  arc(dcH: number, l: number, t: number, r: number, b: number, xs: number, ys: number, xe: number, ye: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = Math.abs(r - l) / 2, ry = Math.abs(b - t) / 2;
    // Win32 Arc рисуется ПРОТИВ часовой от стартового радиуса к конечному.
    const a0 = Math.atan2((ys - cy) * rx, (xs - cx) * ry);
    const a1 = Math.atan2((ye - cy) * rx, (xe - cx) * ry);
    d.ctx.beginPath(); d.ctx.ellipse(cx, cy, rx, ry, 0, a0, a1, true);
    this.stroke(d);
  }
  polygon(dcH: number, ptr: number, n: number): void {
    const d = this.dc(dcH); if (!d?.ctx || n < 2) return;
    const dv = new DataView(this.heap().buffer);
    d.ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = dv.getInt32(ptr + i * 8, true), y = dv.getInt32(ptr + i * 8 + 4, true);
      if (i === 0) d.ctx.moveTo(x, y); else d.ctx.lineTo(x, y);
    }
    d.ctx.closePath();
    d.ctx.fillStyle = d.brushColor; d.ctx.fill();
    this.stroke(d);
  }
  moveTo(dcH: number, x: number, y: number): void { const d = this.dc(dcH); if (d) { d.x = x; d.y = y; } }
  lineTo(dcH: number, x: number, y: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    if (d.penWidth > 0) {
      d.ctx.strokeStyle = d.penColor; d.ctx.lineWidth = d.penWidth;
      d.ctx.beginPath(); d.ctx.moveTo(d.x + 0.5, d.y + 0.5); d.ctx.lineTo(x + 0.5, y + 0.5); d.ctx.stroke();
    }
    d.x = x; d.y = y;
  }
  private stroke(d: DC): void { if (d.penWidth > 0) { d.ctx!.strokeStyle = d.penColor; d.ctx!.lineWidth = d.penWidth; d.ctx!.stroke(); } }
  setPixel(dcH: number, x: number, y: number, c: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return; d.ctx.fillStyle = col(c); d.ctx.fillRect(x, y, 1, 1);
  }
  setTextColor(dcH: number, c: number): void { const d = this.dc(dcH); if (d) d.textColor = col(c); }
  setBkColor(dcH: number, c: number): void { const d = this.dc(dcH); if (d) d.bkColor = col(c); }
  setBkMode(dcH: number, m: number): void { const d = this.dc(dcH); if (d) d.bkMode = m; }
  textOut(dcH: number, x: number, y: number, str: string): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    d.ctx.textBaseline = 'top'; d.ctx.textAlign = 'left'; d.ctx.font = d.font;
    if (d.bkMode !== 1) { const w = d.ctx.measureText(str).width; d.ctx.fillStyle = d.bkColor; d.ctx.fillRect(x, y, w, parseInt(d.font) || 13); }
    d.ctx.fillStyle = d.textColor; d.ctx.fillText(str, x, y);
  }
  /** 3D-фаска: edge = EDGE_RAISED(0x0005)/EDGE_SUNKEN(0x000A) (комбинация BDR_*). */
  drawEdge(dcH: number, l: number, t: number, r: number, b: number, edge: number): void {
    const d = this.dc(dcH); if (!d?.ctx) return;
    const sunken = (edge & 0x000A) !== 0 && (edge & 0x0005) === 0;
    const lt = sunken ? '#808080' : '#ffffff', br = sunken ? '#ffffff' : '#808080';
    const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
      d.ctx!.strokeStyle = c; d.ctx!.lineWidth = 1; d.ctx!.beginPath();
      d.ctx!.moveTo(x0 + 0.5, y0 + 0.5); d.ctx!.lineTo(x1 + 0.5, y1 + 0.5); d.ctx!.stroke();
    };
    for (let i = 0; i < 2; i++) {            // 2px bevel
      line(l + i, t + i, r - 1 - i, t + i, lt); line(l + i, t + i, l + i, b - 1 - i, lt);
      line(l + i, b - 1 - i, r - 1 - i, b - 1 - i, br); line(r - 1 - i, t + i, r - 1 - i, b - 1 - i, br);
    }
  }
  setLayout(): number { return 0; }   // RTL mirroring — noop
}
