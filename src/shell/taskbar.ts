/* taskbar.ts — панель задач + меню Пуск (с подменю и разделителями) + часы.
 * Меню как в Windows: сверху пункты (Программы ▸, Настройки, Завершение), снизу — окна. */
import type { WindowManager } from '../wm/window-manager';

export type MenuNode =
  | { label: string; icon?: string; iconUrl?: string; onClick: () => void }
  | { label: string; icon?: string; iconUrl?: string; submenu: MenuNode[] }
  | { separator: true };

function div(cls: string): HTMLDivElement { const e = document.createElement('div'); e.className = cls; return e; }

export class Taskbar {
  private menu: HTMLDivElement;
  private buttons: HTMLDivElement;
  private clock: HTMLDivElement;
  private start: HTMLButtonElement;
  private open = false;

  constructor(root: HTMLElement, private wm: WindowManager, items: MenuNode[]) {
    const bar = div('taskbar');
    this.start = document.createElement('button');
    this.start.className = 'start-btn';
    this.start.innerHTML = '<span class="start-flag"></span>Start';
    this.buttons = div('task-buttons');
    this.clock = div('task-clock');
    bar.append(this.start, this.buttons, this.clock);

    this.menu = div('start-menu');
    const title = div('start-menu-title'); title.textContent = 'winweb';
    const list = div('start-menu-list');
    this.build(list, items);
    this.menu.append(title, list);
    root.append(this.menu, bar);

    this.start.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.toggle(); });
    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.menu.contains(e.target as Node)) this.close();
    });

    this.wm.onChange(() => this.renderButtons());
    this.renderButtons();
    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  private build(container: HTMLElement, items: MenuNode[]): void {
    for (const it of items) {
      if ('separator' in it) { container.append(div('menu-sep')); continue; }
      const mi = div('menu-item');
      const ic = div('menu-ico');
      if (it.iconUrl) { const img = document.createElement('img'); img.className = 'menu-img'; img.src = it.iconUrl; ic.append(img); }
      else ic.textContent = it.icon ?? '';
      const lb = div('menu-label'); lb.textContent = it.label;
      mi.append(ic, lb);
      if ('submenu' in it) {
        mi.classList.add('has-sub');
        const arrow = div('menu-arrow'); arrow.textContent = '▸'; mi.append(arrow);
        const sub = div('start-submenu');
        this.build(sub, it.submenu);
        mi.append(sub);   // вылетает вправо по :hover (CSS); top подгоняем, чтобы не уходило за экран
        mi.addEventListener('pointerenter', () => this.placeSubmenu(mi, sub));
      } else {
        const fn = it.onClick;
        mi.addEventListener('click', () => { this.close(); fn(); });
      }
      container.append(mi);
    }
  }

  /** Подменю вылетает вправо; подгоняем top, чтобы оно не уходило ниже экрана (над панелью задач). */
  private placeSubmenu(mi: HTMLElement, sub: HTMLElement): void {
    sub.style.top = '0px';
    const r = mi.getBoundingClientRect();
    const h = sub.offsetHeight || sub.scrollHeight || sub.children.length * 28;
    const maxBottom = window.innerHeight - 34;            // не залезать под панель задач
    const vTop = Math.max(2, Math.min(r.top, maxBottom - h));
    sub.style.top = `${Math.round(vTop - r.top)}px`;
  }

  private renderButtons(): void {
    this.buttons.replaceChildren();
    for (const w of this.wm.list()) {
      const b = document.createElement('button');
      b.className = 'task-win' + (w.active ? ' active' : '');
      if (w.icon) { const im = document.createElement('img'); im.className = 'task-ico'; im.src = w.icon; b.append(im); }
      b.append(document.createTextNode(w.title));
      b.addEventListener('click', () => this.wm.focusWindow(w.id));
      this.buttons.append(b);
    }
  }

  private tick(): void {
    const d = new Date();
    this.clock.textContent =
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private toggle(): void { this.open ? this.close() : this.openMenu(); }
  private openMenu(): void { this.open = true; this.menu.style.display = 'block'; this.start.classList.add('pressed'); }
  private close(): void { this.open = false; this.menu.style.display = 'none'; this.start.classList.remove('pressed'); }
}
