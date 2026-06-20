/* host.ts — мост, который wasm-шим зовёт через EM_JS (globalThis.winwebHost). */
import type { WindowManager, MenuBarItem, MenuLeaf } from '../wm/window-manager';
import { Gdi } from './gdi';

export interface WinwebHost {
  gdi: Gdi;   // дефолтный (стоковые объекты); рантайм/сапёр переопределяют своим (привязанным к куче)
  createWindow(title: string, x: number, y: number, w: number, h: number, type: number): number;
  createControl(cls: string, parent: number, text: string,
                x: number, y: number, w: number, h: number, ctrlId: number, multiline: number): number;
  ctx(id: number): CanvasRenderingContext2D | undefined;
  getWindowText(hwnd: number): string;
  setWindowText(hwnd: number, text: string): void;
  setTimer(hwnd: number, id: number, ms: number): void;
  killTimer(hwnd: number, id: number): void;
  menuCreate(): number;
  menuAppend(menu: number, flags: number, id: number, text: string): void;
  menuSet(win: number, menu: number): void;
  destroyWindow(win: number): void;
  setWindowIcon(win: number, icon: number): void;
  conOpen(): number;
  conWrite(id: number, text: string): void;
  conTitle(id: number, title: string): void;
  conClear(id: number): void;
  conTryLine(id: number): string | null | false;   // строка / нет / консоль закрыта
}

type MenuEntry =
  | { type: 'item'; text: string; id: number }
  | { type: 'popup'; text: string; submenu: number }
  | { type: 'sep' };

const MF_POPUP = 0x0010, MF_SEPARATOR = 0x0800;

export function makeHost(wm: WindowManager): WinwebHost {
  const timers = new Map<number, ReturnType<typeof setInterval>>();
  const WM_TIMER = 0x0113;
  const menus = new Map<number, MenuEntry[]>();
  let menuSeq = 1;
  const cons = new Map<number, { out: HTMLElement; inp: HTMLInputElement; lines: string[]; closed: boolean }>();
  // при закрытии окна гасим его интервалы (приложение могло не вызвать KillTimer — напр. сапёр)
  wm.onDestroy((winId) => {
    const base = winId * 100000;
    for (const k of [...timers.keys()]) if (k >= base && k < base + 100000) { clearInterval(timers.get(k)); timers.delete(k); }
  });
  const host: WinwebHost = {
    gdi: new Gdi(wm, () => new Uint8Array(0)),   // дефолт: стоковые объекты не читают кучу
    setWindowIcon: (win, icon) => wm.setIcon(win, host.gdi.iconDataUrl(icon)),   // host.gdi = текущий (переопределённый приложением)
    conOpen: () => {
      const id = wm.create('Command Prompt', 180, 110, 600, 380, { input: false });
      const client = wm.clientEl(id)!; client.classList.add('con');
      const out = document.createElement('div'); out.className = 'con-out';
      const inp = document.createElement('input'); inp.className = 'con-in'; inp.spellcheck = false; inp.autocomplete = 'off';
      client.append(out, inp);
      const st = { out, inp, lines: [] as string[], closed: false };
      cons.set(id, st);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const v = inp.value; inp.value = ''; out.textContent += v + '\n'; st.lines.push(v); out.scrollTop = out.scrollHeight; }
      });
      client.addEventListener('pointerdown', () => inp.focus());
      wm.onDestroy((d) => { if (d === id) st.closed = true; });
      setTimeout(() => inp.focus(), 30);
      return id;
    },
    conWrite: (id, text) => { const st = cons.get(id); if (st) { st.out.textContent += text; st.out.scrollTop = st.out.scrollHeight; } },
    conTitle: (id, title) => wm.setTitle(id, title),
    conClear: (id) => { const st = cons.get(id); if (st) st.out.textContent = ''; },
    conTryLine: (id) => { const st = cons.get(id); if (!st || st.closed) return false; return st.lines.length ? st.lines.shift()! : null; },
    menuCreate: () => { const id = menuSeq++; menus.set(id, []); return id; },
    menuAppend: (menu, flags, id, text) => {
      const m = menus.get(menu); if (!m) return;
      if (flags & MF_SEPARATOR) m.push({ type: 'sep' });
      else if (flags & MF_POPUP) m.push({ type: 'popup', text, submenu: id });
      else m.push({ type: 'item', text, id });
    },
    menuSet: (win, menu) => {
      const bar: MenuBarItem[] = (menus.get(menu) ?? []).flatMap((e) =>
        e.type === 'popup'
          ? [{ text: e.text, items: (menus.get(e.submenu) ?? []).filter((x): x is MenuLeaf => x.type !== 'popup') }]
          : []);
      wm.setMenu(win, bar);
    },
    destroyWindow: (win) => wm.destroy(win),
    createWindow: (title, x, y, w, h, _type) => wm.create(title, x, y, w, h),
    createControl: (cls, parent, text, x, y, w, h, ctrlId, multiline) =>
      wm.createControl(cls, parent, text, x, y, w, h, ctrlId, !!multiline),
    ctx: (id) => wm.ctx(id),
    getWindowText: (hwnd) => wm.getWindowText(hwnd),
    setWindowText: (hwnd, text) => wm.setWindowText(hwnd, text),
    setTimer: (hwnd, id, ms) => {
      const k = hwnd * 100000 + id;
      clearInterval(timers.get(k));
      timers.set(k, setInterval(() => wm.post(hwnd, WM_TIMER, id, 0), ms));
    },
    killTimer: (hwnd, id) => {
      const k = hwnd * 100000 + id;
      clearInterval(timers.get(k));
      timers.delete(k);
    },
  };
  return host;
}
