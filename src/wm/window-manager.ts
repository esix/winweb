/* window-manager.ts — окна как DOM.
 *
 * Каждое окно: рамка/заголовок (CSS) + клиентская область — контейнер <div>.
 * Рисование (GDI) идёт в <canvas>, создаваемый ЛЕНИВО при первом ctx() и лежащий
 * под контролами (pointer-events:none). Контролы (BUTTON/EDIT/STATIC) — настоящие
 * HTML-элементы поверх. Так одно окно умеет и рисовать, и держать контролы.
 */
interface Win {
  id: number;
  title: string;
  el: HTMLDivElement;
  client: HTMLElement;                 // контейнер
  canvas?: HTMLCanvasElement;          // ленивый, для GDI
  ctx?: CanvasRenderingContext2D;
  dispatch?: Dispatch;                 // приложение-владелец (роутинг сообщений)
}
interface Control {
  id: number;
  el: HTMLElement;
  parentId: number;
  ctrlId: number;
}

const WM_DESTROY = 0x0002;
const WM_SIZE = 0x0005;
const WM_MOUSEMOVE = 0x0200;
const WM_LBUTTONDOWN = 0x0201;
const WM_LBUTTONUP = 0x0202;
const WM_RBUTTONDOWN = 0x0204;
const MK_LBUTTON = 0x0001;
const WM_COMMAND = 0x0111;
const BN_CLICKED = 0;
const EN_CHANGE = 0x0300;
type Dispatch = (id: number, msg: number, wParam: number, lParam: number) => void;

export type MenuLeaf = { type: 'item'; text: string; id?: number; onClick?: () => void } | { type: 'sep' };
export interface MenuBarItem { text: string; items: MenuLeaf[]; }
type MenuEl = HTMLElement & { _ac?: AbortController };   // строка меню с привязанным AbortController

export class WindowManager {
  private wins = new Map<number, Win>();
  private controls = new Map<number, Control>();
  private nextId = 1;
  private zTop = 10;
  private currentDispatch?: Dispatch;   // владелец окон, создаваемых далее (per-app маршрутизация)

  constructor(private desktop: HTMLElement) {}
  /** Задаёт владельца для последующих create() — окна каждого приложения роутятся в его _wm_post. */
  bindDispatch(fn: Dispatch): void { this.currentDispatch = fn; }
  /** Доставить сообщение окну -> приложению-владельцу этого окна (таймеры и т.п.). */
  post(id: number, msg: number, wParam: number, lParam: number): void { this.wins.get(id)?.dispatch?.(id, msg, wParam, lParam); }

  /* --- панель задач --- */
  private changeListeners: Array<() => void> = [];
  onChange(fn: () => void): void { this.changeListeners.push(fn); }
  private notify(): void { for (const f of this.changeListeners) f(); }
  private destroyListeners: Array<(id: number) => void> = [];
  onDestroy(fn: (id: number) => void): void { this.destroyListeners.push(fn); }
  private bringToFront(el: HTMLDivElement): void {
    el.style.zIndex = String(++this.zTop);
    this.desktop.querySelectorAll('.win.active').forEach((w) => w.classList.remove('active'));
    el.classList.add('active');
    this.notify();
  }
  focusWindow(id: number): void { const w = this.wins.get(id); if (w) this.bringToFront(w.el); }
  list(): Array<{ id: number; title: string; active: boolean; icon: string }> {
    return [...this.wins.values()].map((w) => ({
      id: w.id, title: w.title, active: w.el.classList.contains('active'),
      icon: w.el.querySelector<HTMLImageElement>('.win-icon')?.src ?? '',
    }));
  }
  clientEl(id: number): HTMLElement | undefined { return this.wins.get(id)?.client; }

  /** Закрыть окно: сообщить приложению (WM_DESTROY), снять слушатели/контролы/таймеры, убрать DOM. */
  destroy(id: number): void {
    const w = this.wins.get(id); if (!w) return;
    w.dispatch?.(id, WM_DESTROY, 0, 0);   // -> PostQuitMessage -> цикл приложения завершится
    (w.el.querySelector('.menubar') as MenuEl | null)?._ac?.abort();          // снять document-слушатель меню
    for (const [cid, c] of this.controls) if (c.parentId === id) this.controls.delete(cid);   // убрать дочерние контролы
    w.el.remove(); this.wins.delete(id);
    for (const f of this.destroyListeners) f(id);   // напр. host.killWindowTimers
    this.notify();
  }

  /** Сменить заголовок окна (титул + метка в панели задач). */
  setTitle(id: number, title: string): void {
    const w = this.wins.get(id); if (!w) return;
    w.title = title;
    const cap = w.el.querySelector('.caption'); if (cap) cap.textContent = title;
    this.notify();
  }

  /** Значок окна (wc.hIcon) -> <img> в заголовке. */
  setIcon(id: number, url: string): void {
    const w = this.wins.get(id); if (!w || !url) return;
    const tb = w.el.querySelector('.titlebar'); if (!tb) return;
    let img = tb.querySelector<HTMLImageElement>('.win-icon');
    if (!img) { img = document.createElement('img'); img.className = 'win-icon'; tb.prepend(img); }
    img.src = url;
    this.notify();   // обновить кнопку панели задач (значок ставится после создания окна)
  }

  /** SetMenu(hwnd, menu): строка меню под заголовком + выпадающие списки -> WM_COMMAND(id). */
  setMenu(id: number, bar: MenuBarItem[]): void {
    const w = this.wins.get(id); if (!w) return;
    const old = w.el.querySelector('.menubar') as MenuEl | null;
    old?._ac?.abort(); old?.remove();                    // снять старый слушатель (повторный SetMenu не копит)
    if (!bar.length) return;
    const mb = document.createElement('div') as MenuEl;
    mb.className = 'menubar';
    const ac = new AbortController(); mb._ac = ac;
    const closeAll = (): void => mb.querySelectorAll('.menubar-item.open').forEach((x) => x.classList.remove('open'));
    for (const top of bar) {
      const ti = document.createElement('div'); ti.className = 'menubar-item'; ti.textContent = top.text;
      const drop = document.createElement('div'); drop.className = 'menu-dropdown';
      for (const leaf of top.items) {
        if (leaf.type === 'sep') { const s = document.createElement('div'); s.className = 'menu-sep'; drop.append(s); continue; }
        const mi = document.createElement('div'); mi.className = 'dropdown-item'; mi.textContent = leaf.text;
        const onClick = leaf.onClick; const cmd = leaf.id ?? 0;   // shell-меню: onClick; wasm-меню: WM_COMMAND(id)
        mi.addEventListener('click', (e) => { e.stopPropagation(); closeAll(); if (onClick) onClick(); else w.dispatch?.(id, WM_COMMAND, cmd & 0xffff, 0); });
        drop.append(mi);
      }
      ti.append(drop);
      ti.addEventListener('click', (e) => { e.stopPropagation(); const wasOpen = ti.classList.contains('open'); closeAll(); if (!wasOpen) ti.classList.add('open'); });
      ti.addEventListener('pointerenter', () => { if (mb.querySelector('.menubar-item.open') && !ti.classList.contains('open')) { closeAll(); ti.classList.add('open'); } });
      mb.append(ti);
    }
    document.addEventListener('pointerdown', (e) => { if (!mb.contains(e.target as Node)) closeAll(); }, { signal: ac.signal });
    w.el.insertBefore(mb, w.client);
  }

  /** input:false — окно без проводки ввода в wasm (для shell-приложений на TS). */
  create(title: string, x: number, y: number, w: number, h: number, opts: { input?: boolean } = {}): number {
    const id = this.nextId++;
    const dispatch = this.currentDispatch;   // окно принадлежит приложению, активному на момент создания

    const el = document.createElement('div');
    el.className = 'win';
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.width = `${w}px`;

    const tb = document.createElement('div');
    tb.className = 'titlebar';
    const caption = document.createElement('span'); caption.className = 'caption'; caption.textContent = title;
    const close = document.createElement('button'); close.className = 'close'; close.textContent = '✕';
    tb.append(caption, close);

    const client = document.createElement('div');
    client.className = 'client';
    client.style.width = `${w}px`; client.style.height = `${h}px`;

    if (opts.input !== false) {
      const pack = (e: PointerEvent) => ((Math.floor(e.offsetY) & 0xffff) << 16) | (Math.floor(e.offsetX) & 0xffff);
      const mk = (e: PointerEvent) => (e.buttons & 1 ? MK_LBUTTON : 0);
      client.addEventListener('contextmenu', (e) => e.preventDefault());
      client.addEventListener('pointerdown', (e) => {
        if (e.target !== client) return;                  // только фон клиента, не контролы
        try { client.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        if (e.button === 2) dispatch?.(id, WM_RBUTTONDOWN, 0, pack(e));
        else dispatch?.(id, WM_LBUTTONDOWN, MK_LBUTTON, pack(e));
      });
      client.addEventListener('pointermove', (e) => { if (e.target === client) dispatch?.(id, WM_MOUSEMOVE, mk(e), pack(e)); });
      client.addEventListener('pointerup', (e) => { if (e.target === client) dispatch?.(id, WM_LBUTTONUP, 0, pack(e)); });
    }

    el.append(tb, client);
    this.desktop.append(el);
    this.wins.set(id, { id, title, el, client, dispatch });

    el.addEventListener('pointerdown', () => this.bringToFront(el));
    this.bringToFront(el);

    tb.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === close) return;
      const dx = e.clientX - el.offsetLeft, dy = e.clientY - el.offsetTop;
      try { tb.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      const move = (ev: PointerEvent) => { el.style.left = `${ev.clientX - dx}px`; el.style.top = `${ev.clientY - dy}px`; };
      const up = (ev: PointerEvent) => {
        try { tb.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
        tb.removeEventListener('pointermove', move); tb.removeEventListener('pointerup', up);
      };
      tb.addEventListener('pointermove', move); tb.addEventListener('pointerup', up);
    });

    close.addEventListener('click', () => this.destroy(id));

    /* уголок-ресайз (низ-право): меняет размер клиента + WM_SIZE приложению */
    const grip = document.createElement('div');
    grip.className = 'resize-grip';
    el.append(grip);
    grip.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      this.bringToFront(el);
      const sx = e.clientX, sy = e.clientY, sw = client.offsetWidth, sh = client.offsetHeight;
      try { grip.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      const move = (ev: PointerEvent): void => {
        const nw = Math.max(140, sw + (ev.clientX - sx));
        const nh = Math.max(80, sh + (ev.clientY - sy));
        client.style.width = `${nw}px`; client.style.height = `${nh}px`; el.style.width = `${nw}px`;
        dispatch?.(id, WM_SIZE, 0, ((nh & 0xffff) << 16) | (nw & 0xffff));
      };
      const up = (ev: PointerEvent): void => {
        try { grip.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
        grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
    });
    return id;
  }

  /** Ленивый <canvas> для GDI (под контролами). */
  ctx(id: number): CanvasRenderingContext2D | undefined {
    const w = this.wins.get(id);
    if (!w) return undefined;
    if (!w.ctx) {
      const cv = document.createElement('canvas');
      cv.className = 'wcanvas';
      cv.width = parseInt(w.client.style.width) || 1;
      cv.height = parseInt(w.client.style.height) || 1;
      w.client.insertBefore(cv, w.client.firstChild);
      w.canvas = cv;
      w.ctx = cv.getContext('2d')!;
    }
    return w.ctx;
  }

  /** CreateWindow("BUTTON"/"EDIT"/"STATIC", parent, ...) -> настоящий HTML-элемент. */
  createControl(className: string, parentId: number, text: string,
                x: number, y: number, w: number, h: number, ctrlId: number, multiline = false): number {
    const parent = this.wins.get(parentId);
    if (!parent) return 0;
    const id = this.nextId++;
    const kind = className.toUpperCase();

    let el: HTMLElement;
    if (kind === 'BUTTON') {
      const b = document.createElement('button'); b.className = 'ctl ctl-button'; b.textContent = text;
      b.addEventListener('click', () => parent.dispatch?.(parentId, WM_COMMAND, (BN_CLICKED << 16) | ctrlId, id));
      el = b;
    } else if (kind === 'EDIT' && multiline) {
      const t = document.createElement('textarea'); t.className = 'ctl ctl-edit-multi'; t.value = text; t.spellcheck = false;
      t.addEventListener('input', () => parent.dispatch?.(parentId, WM_COMMAND, (EN_CHANGE << 16) | ctrlId, id));
      el = t;
    } else if (kind === 'EDIT') {
      const i = document.createElement('input'); i.className = 'ctl ctl-edit'; i.value = text;
      i.addEventListener('input', () => parent.dispatch?.(parentId, WM_COMMAND, (EN_CHANGE << 16) | ctrlId, id));
      el = i;
    } else {
      const s = document.createElement('span'); s.className = 'ctl ctl-static'; s.textContent = text; el = s;
    }
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.width = `${w}px`; el.style.height = `${h}px`;
    if (kind === 'EDIT' && multiline) { el.style.right = '0'; el.style.bottom = '0'; el.style.width = 'auto'; el.style.height = 'auto'; }   // многострочный EDIT тянется с клиентом (ресайз окна)
    parent.client.appendChild(el);
    this.controls.set(id, { id, el, parentId, ctrlId });
    return id;
  }

  getWindowText(handle: number): string {
    const c = this.controls.get(handle); if (!c) return '';
    const e = c.el;
    if (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) return e.value;
    return e.textContent ?? '';
  }
  setWindowText(handle: number, text: string): void {
    const c = this.controls.get(handle); if (!c) return;
    const e = c.el;
    if (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) e.value = text;
    else e.textContent = text;
  }
}
