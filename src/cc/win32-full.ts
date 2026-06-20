/* win32-full.ts — ПОЛНЫЙ Win32/GDI-фасад для приложений уровня сапёра, скомпилированных
 * компилятором lcc-wasm (standalone-модуль, экспортирует свою память + таблицу функций).
 *
 * Все 70 импортов сапёра: окно/сообщения, paint/DC, GDI (вкл. wide-char TextOutW/CreateFontW/
 * GetTextExtentPoint32W и двойную буферизацию CreateCompatibleDC/Bitmap/BitBlt), меню, таймер,
 * GetSystemMetrics/GetTickCount64 и т.п. Бóльшая часть — проводка gdi.ts/wm/host.ts.
 *
 * Модель цикла как в makeWin32Lcc: GetMessage возвращает 0 (цикл WinMain выходит),
 * а события (paint/мышь/таймер/меню) гонит фреймворк прямо в WndProc через таблицу.
 */
import type { WindowManager } from '../wm/window-manager';
import type { WinwebHost } from '../win32/host';
import { Gdi } from '../win32/gdi';

const WM_PAINT = 0x000f, WM_CREATE = 0x0001, WS_CHILD = 0x40000000, ES_MULTILINE = 0x0004;
const CW_USEDEFAULT = 0x80000000 | 0;   // -2147483648

interface Win32Io { rdA: (p: number) => string; wrA: (p: number, s: string, max: number) => number; }

export function makeWin32Full(wm: WindowManager, host: WinwebHost): { env: Record<string, unknown>; setInstance: (i: WebAssembly.Instance) => void; io: Win32Io } {
  let mem: WebAssembly.Memory | null = null;
  let table: WebAssembly.Table | null = null;
  let inst: WebAssembly.Instance | null = null;
  let wndprocSlot = 0, wndprocSet = false, clsName = '';
  const gdi = new Gdi(wm, () => (mem ? new Uint8Array(mem.buffer) : new Uint8Array(0)));
  const dv = () => new DataView(mem!.buffer);
  const u8 = () => new Uint8Array(mem!.buffer);
  const rdA = (p: number) => { const b = u8(); let s = ''; while (b[p]) s += String.fromCharCode(b[p++]); return s; };               // ANSI
  const rdW = (p: number, n: number) => { const v = dv(); let s = ''; for (let i = 0; i < n; i++) { const c = v.getUint16(p + i * 2, true); if (!c) break; s += String.fromCharCode(c); } return s; };   // UTF-16LE (wchar=2)
  const wrA = (p: number, s: string, max: number) => { const b = u8(); let i = 0; for (; i < s.length && i < max - 1; i++) b[p + i] = s.charCodeAt(i) & 255; b[p + i] = 0; return i; };
  const rect = (p: number) => { const v = dv(); return [v.getInt32(p, true), v.getInt32(p + 4, true), v.getInt32(p + 8, true), v.getInt32(p + 12, true)] as const; };
  const callWndProc = (hwnd: number, msg: number, wp: number, lp: number): number => {
    if (!table || !wndprocSet) return 0;
    const f = table.get(wndprocSlot) as ((a: number, b: number, c: number, d: number) => number) | null;
    return f ? f(hwnd, msg, wp, lp) | 0 : 0;
  };
  /* LoadIcon/LoadBitmap: ресурс из таблицы модуля -> gdi.loadImageRes. Индексацию делают
     C-аксессоры winweb_res_*_at (раскладку struct знает компилятор), фасад читает только скаляры. */
  const loadRes = (id: number): number => {
    const ex = inst?.exports as Record<string, CallableFunction> | undefined;
    if (!ex?.winweb_res_n || !ex.winweb_res_id_at) return 0;
    const n = ex.winweb_res_n() as unknown as number;
    for (let i = 0; i < n; i++) {
      if ((ex.winweb_res_id_at(i) as unknown as number) === id)
        return gdi.loadImageRes(ex.winweb_res_data_at(i) as unknown as number, ex.winweb_res_len_at(i) as unknown as number, rdA(ex.winweb_res_mime_at(i) as unknown as number));
    }
    return 0;
  };

  const env: Record<string, unknown> = {
    /* --- окно / сообщения --- */
    RegisterClass: (wc: number) => { wndprocSlot = dv().getInt32(wc + 4, true); wndprocSet = true; clsName = rdA(dv().getInt32(wc + 36, true)); return 1; },
    CreateWindowEx: (_ex: number, clsP: number, titleP: number, style: number, x: number, y: number, w: number, h: number, parent: number, menu: number) => {
      const cls = rdA(clsP);
      if (style & WS_CHILD) return host.createControl(cls, parent, rdA(titleP), x, y, w, h, menu, (style & ES_MULTILINE) !== 0);   // дочерний контрол
      wm.bindDispatch((id, m, a, b) => { callWndProc(id, m, a, b); });
      const px = (x === CW_USEDEFAULT || x < 0) ? 90 : x, py = (y === CW_USEDEFAULT || y < 0) ? 80 : y;
      const id = wm.create(rdA(titleP) || clsName || 'Window', px, py, w > 0 ? w : 320, h > 0 ? h : 240);
      callWndProc(id, WM_CREATE, 0, 0);   // как настоящий CreateWindow -> синхронный WM_CREATE (notepad создаёт EDIT тут)
      return id;
    },
    ShowWindow: () => 1,
    UpdateWindow: (h: number) => { callWndProc(h, WM_PAINT, 0, 0); return 1; },
    InvalidateRect: (h: number) => { callWndProc(h, WM_PAINT, 0, 0); return 1; },
    GetMessage: () => 0, TranslateMessage: () => 0, DispatchMessage: () => 0, DefWindowProc: () => 0, PostQuitMessage: () => 0,
    DestroyWindow: (h: number) => { wm.destroy(h); return 1; },
    GetClientRect: (h: number, r: number) => { const cl = wm.clientEl(h); const w = cl ? parseInt(cl.style.width) : 300, ht = cl ? parseInt(cl.style.height) : 200; const v = dv(); v.setInt32(r, 0, true); v.setInt32(r + 4, 0, true); v.setInt32(r + 8, w, true); v.setInt32(r + 12, ht, true); return 1; },
    GetWindowText: (h: number, buf: number, max: number) => wrA(buf, host.getWindowText(h) || '', max),
    SetWindowText: (h: number, s: number) => { host.setWindowText(h, rdA(s)); return 1; },

    /* --- paint / DC --- */
    BeginPaint: (h: number, ps: number) => { const dc = gdi.windowDC(h); dv().setInt32(ps, dc, true); return dc; },
    EndPaint: () => 1,
    GetDC: (h: number) => gdi.windowDC(h),
    ReleaseDC: (_h: number, dc: number) => { gdi.deleteDC(dc); return 1; },

    /* --- GDI объекты --- */
    GetStockObject: (o: number) => gdi.getStockObject(o),
    GetSysColorBrush: (i: number) => gdi.getSysColorBrush(i),
    CreatePen: (s: number, w: number, c: number) => gdi.createPen(s, w, c),
    CreateSolidBrush: (c: number) => gdi.createSolidBrush(c),
    CreateFontW: (height: number, _w: number, _e: number, _o: number, weight: number, italic: number) => gdi.createFont(height, weight, italic),
    SelectObject: (dc: number, o: number) => gdi.selectObject(dc, o),
    DeleteObject: (o: number) => gdi.deleteObject(o),
    DeleteDC: (dc: number) => gdi.deleteDC(dc),
    CreateCompatibleDC: () => gdi.createCompatibleDC(),
    CreateCompatibleBitmap: (_dc: number, w: number, h: number) => gdi.createCompatibleBitmap(w, h),

    /* --- GDI рисование --- */
    TextOut: (dc: number, x: number, y: number, s: number) => { gdi.textOut(dc, x, y, rdA(s)); return 1; },
    TextOutW: (dc: number, x: number, y: number, s: number, n: number) => { gdi.textOut(dc, x, y, rdW(s, n)); return 1; },
    GetTextExtentPoint32W: (dc: number, s: number, n: number, sz: number) => { const [w, h] = gdi.textExtent(dc, rdW(s, n)); const v = dv(); v.setInt32(sz, w, true); v.setInt32(sz + 4, h, true); return 1; },
    Rectangle: (dc: number, l: number, t: number, r: number, b: number) => { gdi.rectangle(dc, l, t, r, b); return 1; },
    Ellipse: (dc: number, l: number, t: number, r: number, b: number) => { gdi.ellipse(dc, l, t, r, b); return 1; },
    Polygon: (dc: number, p: number, n: number) => { gdi.polygon(dc, p, n); return 1; },
    Arc: (dc: number, l: number, t: number, r: number, b: number, xs: number, ys: number, xe: number, ye: number) => { gdi.arc(dc, l, t, r, b, xs, ys, xe, ye); return 1; },
    MoveToEx: (dc: number, x: number, y: number) => { gdi.moveTo(dc, x, y); return 1; },
    LineTo: (dc: number, x: number, y: number) => { gdi.lineTo(dc, x, y); return 1; },
    FillRect: (dc: number, rc: number, br: number) => { const [l, t, r, b] = rect(rc); gdi.fillRect(dc, l, t, r, b, br); return 1; },
    DrawEdge: (dc: number, rc: number, edge: number) => { const [l, t, r, b] = rect(rc); gdi.drawEdge(dc, l, t, r, b, edge); return 1; },
    SetPixel: (dc: number, x: number, y: number, c: number) => { gdi.setPixel(dc, x, y, c); return c; },
    BitBlt: (dst: number, dx: number, dy: number, w: number, h: number, src: number, sx: number, sy: number) => { gdi.bitBlt(dst, dx, dy, w, h, src, sx, sy); return 1; },
    DrawIcon: (dc: number, x: number, y: number, ic: number) => { gdi.drawIcon(dc, x, y, ic); return 1; },

    /* --- состояние текста / layout --- */
    SetTextColor: (dc: number, c: number) => { gdi.setTextColor(dc, c); return c; },
    SetBkColor: (dc: number, c: number) => { gdi.setBkColor(dc, c); return c; },
    SetBkMode: (dc: number, m: number) => { gdi.setBkMode(dc, m); return m; },
    GetLayout: () => 0, SetLayout: () => 0,

    /* --- меню --- */
    CreateMenu: () => host.menuCreate(),
    CreatePopupMenu: () => host.menuCreate(),
    AppendMenu: (menu: number, flags: number, id: number, text: number) => { host.menuAppend(menu, flags, id, rdA(text)); return 1; },
    SetMenu: (hwnd: number, menu: number) => { host.menuSet(hwnd, menu); return 1; },
    CheckMenuItem: () => 0,

    /* --- таймер --- */
    SetTimer: (hwnd: number, id: number, ms: number) => { host.setTimer(hwnd, id, ms); return id; },
    KillTimer: (hwnd: number, id: number) => { host.killTimer(hwnd, id); return 1; },

    /* --- прочее / значения --- */
    RGB: (r: number, g: number, b: number) => (r & 255) | ((g & 255) << 8) | ((b & 255) << 16),
    GetSystemMetrics: (i: number) => (({ 0: 1280, 1: 800, 4: 20, 5: 1, 6: 1, 15: 20 } as Record<number, number>)[i] ?? 0),
    GetTickCount64: () => BigInt(Date.now()),
    MessageBox: () => 1, ShellAbout: () => 0, GetDlgItemInt: () => 0, LoadString: () => 0,
    LoadIcon: (_h: number, id: number) => loadRes(id), LoadBitmap: (_h: number, id: number) => loadRes(id),
    LoadCursor: () => 0, SetCursor: () => 0, ShowCursor: () => 0,

    /* --- консоль (сапёр GUI; заглушки) --- */
    AllocConsole: () => 1, GetStdHandle: () => 1, SetConsoleTitleA: () => 1, ReadConsoleA: () => 0,
    WriteConsoleA: (_h: number, _buf: number, len: number, written: number) => { if (written) dv().setInt32(written, len, true); return 1; },
  };

  return { env, io: { rdA, wrA }, setInstance: (i) => { inst = i; mem = i.exports.memory as WebAssembly.Memory; table = i.exports.__indirect_function_table as WebAssembly.Table; } };
}
