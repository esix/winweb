/* win32rt.ts — Win32-окружение для приложений, скомпилированных нашим cc.
 * Модуль cc — standalone wasm: Win32-функции он импортирует из env (эти JS-шимы), окно
 * рисует через gdi/wm, а его WndProc лежит в экспортируемой таблице функций модуля, чтобы
 * фреймворк мог звать его на события. Цикл GetMessage не блокирует: GetMessage возвращает 0
 * (цикл выходит), а WM_PAINT/клики гонит сам фреймворк прямо в WndProc — простой hello.c
 * компилируется без правок.
 */
import type { WindowManager } from '../wm/window-manager';
import { Gdi } from '../win32/gdi';
import { makeEnv } from './cc';

/* мини-windows.h: подмешивается к исходнику в GUI-режиме (layout структур = шимам ниже) */
export const WIN32_PRELUDE = `
#define WM_DESTROY 2
#define WM_PAINT 15
#define WM_MOUSEMOVE 512
#define WM_LBUTTONDOWN 513
#define WM_LBUTTONUP 514
#define WM_RBUTTONDOWN 516
#define MK_LBUTTON 1
#define WHITE_BRUSH 0
#define LTGRAY_BRUSH 1
#define GRAY_BRUSH 2
#define BLACK_BRUSH 4
#define WHITE_PEN 6
#define BLACK_PEN 7
#define PS_SOLID 0
#define TRANSPARENT 1
#define OPAQUE 2
struct WNDCLASS { int style; int lpfnWndProc; int cbClsExtra; int cbWndExtra; int hInstance; int hIcon; int hCursor; int hbrBackground; int lpszMenuName; int lpszClassName; };
struct MSG { int hwnd; int message; int wParam; int lParam; int time; int x; int y; };
struct PAINTSTRUCT { int hdc; int fErase; int rcL; int rcT; int rcR; int rcB; int rsv1; int rsv2; };
struct RECT { int left; int top; int right; int bottom; };
int RegisterClass(struct WNDCLASS *wc);
int CreateWindow(int cls, int title, int style, int x, int y, int w, int h, int parent, int menu, int inst, int param);
int ShowWindow(int hwnd, int cmd);
int UpdateWindow(int hwnd);
int InvalidateRect(int hwnd, int rect, int erase);
int GetMessage(struct MSG *m, int hwnd, int mn, int mx);
int TranslateMessage(struct MSG *m);
int DispatchMessage(struct MSG *m);
int DefWindowProc(int hwnd, int msg, int wp, int lp);
int PostQuitMessage(int code);
int GetStockObject(int o);
int BeginPaint(int hwnd, struct PAINTSTRUCT *ps);
int EndPaint(int hwnd, struct PAINTSTRUCT *ps);
int TextOut(int hdc, int x, int y, int s, int len);
int Rectangle(int hdc, int l, int t, int r, int b);
int Ellipse(int hdc, int l, int t, int r, int b);
int GetClientRect(int hwnd, struct RECT *r);
int RGB(int r, int g, int b);
int CreatePen(int style, int width, int color);
int CreateSolidBrush(int color);
int SelectObject(int hdc, int obj);
int DeleteObject(int obj);
int SetTextColor(int hdc, int color);
int SetBkMode(int hdc, int mode);
int FillRect(int hdc, struct RECT *rc, int brush);
int MoveToEx(int hdc, int x, int y, int pt);
int LineTo(int hdc, int x, int y);
int GetDC(int hwnd);
int ReleaseDC(int hwnd, int hdc);
`;

const WM_PAINT = 0x000f;

interface Win32Core { shims: Record<string, unknown>; setMemory: (m: WebAssembly.Memory) => void; setTable: (t: WebAssembly.Table) => void; }

/* общий слой Win32/GDI-шимов над изменяемой ссылкой на память модуля + его таблицу функций.
 * Используется и cc.ts-путём (модуль ИМПОРТИРУЕТ память), и lcc-путём (ЭКСПОРТИРУЕТ свою). */
function coreWin32(wm: WindowManager): Win32Core {
  let mem: WebAssembly.Memory | null = null;
  let table: WebAssembly.Table | null = null;
  let wndprocSlot = 0;
  let wndprocSet = false;        // отдельный флаг: lcc кладёт WndProc в слот 0 (валидный!), нельзя проверять на ноль
  let clsName = '';
  const gdi = new Gdi(wm, () => (mem ? new Uint8Array(mem.buffer) : new Uint8Array(0)));
  const dv = () => new DataView(mem!.buffer);
  const rd = (p: number) => { const b = new Uint8Array(mem!.buffer); let s = ''; while (b[p]) s += String.fromCharCode(b[p++]); return s; };
  const callWndProc = (hwnd: number, msg: number, wp: number, lp: number): number => {
    if (!table || !wndprocSet) return 0;
    const f = table.get(wndprocSlot) as ((a: number, b: number, c: number, d: number) => number) | null;
    return f ? f(hwnd, msg, wp, lp) | 0 : 0;
  };
  const shims: Record<string, unknown> = {
    RegisterClass: (wc: number) => { wndprocSlot = dv().getInt32(wc + 4, true); wndprocSet = true; clsName = rd(dv().getInt32(wc + 36, true)); return 1; },
    CreateWindow: (_cls: number, title: number, _st: number, x: number, y: number, w: number, h: number) => {
      wm.bindDispatch((id, msg, wp, lp) => { callWndProc(id, msg, wp, lp); });   // события окна -> WndProc
      return wm.create(rd(title) || clsName || 'Window', x > 0 ? x : 70, y > 0 ? y : 70, w > 0 ? w : 360, h > 0 ? h : 220);
    },
    ShowWindow: () => 1,
    UpdateWindow: (hwnd: number) => { callWndProc(hwnd, WM_PAINT, 0, 0); return 1; },
    InvalidateRect: (hwnd: number) => { callWndProc(hwnd, WM_PAINT, 0, 0); return 1; },
    GetMessage: () => 0,                                     // цикл сразу выходит; события гонит фреймворк
    TranslateMessage: () => 0,
    DispatchMessage: () => 0,
    DefWindowProc: () => 0,
    PostQuitMessage: () => 0,
    GetStockObject: (o: number) => gdi.getStockObject(o),
    BeginPaint: (hwnd: number, ps: number) => { const dc = gdi.windowDC(hwnd); dv().setInt32(ps, dc, true); return dc; },
    EndPaint: () => 1,
    TextOut: (hdc: number, x: number, y: number, s: number) => { gdi.textOut(hdc, x, y, rd(s)); return 1; },
    Rectangle: (hdc: number, l: number, t: number, r: number, b: number) => { gdi.rectangle(hdc, l, t, r, b); return 1; },
    Ellipse: (hdc: number, l: number, t: number, r: number, b: number) => { gdi.ellipse(hdc, l, t, r, b); return 1; },
    GetClientRect: (hwnd: number, r: number) => { const cl = wm.clientEl(hwnd); const w = cl ? parseInt(cl.style.width) : 300, h = cl ? parseInt(cl.style.height) : 200; const v = dv(); v.setInt32(r, 0, true); v.setInt32(r + 4, 0, true); v.setInt32(r + 8, w, true); v.setInt32(r + 12, h, true); return 1; },
    RGB: (r: number, g: number, b: number) => (r & 255) | ((g & 255) << 8) | ((b & 255) << 16),
    CreatePen: (s: number, w: number, c: number) => gdi.createPen(s, w, c),
    CreateSolidBrush: (c: number) => gdi.createSolidBrush(c),
    SelectObject: (hdc: number, o: number) => gdi.selectObject(hdc, o),
    DeleteObject: (o: number) => gdi.deleteObject(o),
    SetTextColor: (hdc: number, c: number) => { gdi.setTextColor(hdc, c); return 0; },
    SetBkMode: (hdc: number, m: number) => { gdi.setBkMode(hdc, m); return 0; },
    FillRect: (hdc: number, rc: number, br: number) => { const v = dv(); gdi.fillRect(hdc, v.getInt32(rc, true), v.getInt32(rc + 4, true), v.getInt32(rc + 8, true), v.getInt32(rc + 12, true), br); return 1; },
    MoveToEx: (hdc: number, x: number, y: number) => { gdi.moveTo(hdc, x, y); return 1; },
    LineTo: (hdc: number, x: number, y: number) => { gdi.lineTo(hdc, x, y); return 1; },
    GetDC: (hwnd: number) => gdi.windowDC(hwnd),
    ReleaseDC: (_hwnd: number, hdc: number) => { gdi.deleteDC(hdc); return 1; },
  };
  return { shims, setMemory: (m) => { mem = m; }, setTable: (t) => { table = t; } };
}

/* cc.ts-приложения: модуль импортирует память+builtins из makeEnv; шимы читают её */
export function makeWin32(wm: WindowManager, out: (s: string) => void): { env: Record<string, unknown>; setInstance: (i: WebAssembly.Instance) => void } {
  const { env, memory } = makeEnv(out);
  const core = coreWin32(wm);
  core.setMemory(memory);
  Object.assign(env, core.shims);
  return { env, setInstance: (i) => core.setTable(i.exports.__indirect_function_table as WebAssembly.Table) };
}

/* lcc-приложения: модуль ЭКСПОРТИРУЕТ свою память+таблицу; забираем их после instantiate */
export function makeWin32Lcc(wm: WindowManager): { env: Record<string, unknown>; setInstance: (i: WebAssembly.Instance) => void } {
  const core = coreWin32(wm);
  return { env: core.shims, setInstance: (i) => { core.setMemory(i.exports.memory as WebAssembly.Memory); core.setTable(i.exports.__indirect_function_table as WebAssembly.Table); } };
}
