/* explorer.ts — Проводник (browse VFS): меню (File/View/Help) через wm.setMenu,
 * тулбар (Back/Fwd/Up), два вида (крупные значки / список), выделение мышью и
 * клавиатурой, статус-бар. Shell-приложение: рисует свой DOM в клиенте окна.
 */
import type { WindowManager, MenuBarItem } from '../wm/window-manager';
import type { Vfs, Entry } from '../fs/vfs';
import { executableIconUrl } from '../win32/exe-icon';

function parentDir(p: string): string {
  const s = p.replace(/\\+$/, '');
  const i = s.lastIndexOf('\\');
  return i <= 2 ? 'C:' : s.slice(0, i);
}
function iconFor(e: Entry): string {
  if (e.type === 'dir') return '📁';
  const n = e.name.toLowerCase();
  if (n.endsWith('.wasm')) return '⚙️';
  if (n.endsWith('.lnk')) return '🔗';
  return '📄';
}
function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export class Explorer {
  constructor(private wm: WindowManager, private vfs: Vfs, private onOpen: (e: Entry) => void) {}

  open(start = 'C:\\'): void {
    const id = this.wm.create('Explorer', 130, 70, 470, 350, { input: false });
    const client = this.wm.clientEl(id)!;
    client.classList.add('fx');

    const toolbar = document.createElement('div'); toolbar.className = 'fx-toolbar';
    const addr = document.createElement('div'); addr.className = 'fx-addr';
    const view = document.createElement('div'); view.className = 'fx-view'; view.tabIndex = 0;
    const status = document.createElement('div'); status.className = 'fx-status';
    client.append(toolbar, addr, view, status);

    let cwd = start.replace(/\\+$/, '') || 'C:';
    const back: string[] = [];
    const fwd: string[] = [];
    let mode: 'icons' | 'list' = 'icons';
    let gen = 0;                 // поколение render() — устаревшие await-продолжения выходят
    let folderStatus = '';      // сводка папки (для восстановления после снятия выделения)

    const navTo = (path: string, clearFwd = true): void => {
      back.push(cwd); if (clearFwd) fwd.length = 0;
      cwd = path.replace(/\\+$/, '') || 'C:'; void render();
    };
    const goBack = (): void => { const p = back.pop(); if (p != null) { fwd.push(cwd); cwd = p; void render(); } };
    const goFwd = (): void => { const p = fwd.pop(); if (p != null) { back.push(cwd); cwd = p; void render(); } };
    const goUp = (): void => { if (cwd !== 'C:') navTo(parentDir(cwd), false); };   // Up сохраняет forward
    const openSelected = (): void => { view.querySelector<HTMLElement>('.fx-entry.selected')?.dispatchEvent(new MouseEvent('dblclick')); };

    const tbtn = (label: string, title: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button'); b.className = 'fx-tb'; b.textContent = label; b.title = title;
      b.addEventListener('click', fn); return b;
    };
    const backBtn = tbtn('←', 'Back', goBack);
    const fwdBtn = tbtn('→', 'Forward', goFwd);
    const upBtn = tbtn('↑', 'Up One Level', goUp);
    toolbar.append(backBtn, fwdBtn, upBtn);

    const menu: MenuBarItem[] = [
      { text: 'File', items: [
        { type: 'item', text: 'Open', onClick: openSelected },
        { type: 'sep' },
        { type: 'item', text: 'Close', onClick: () => this.wm.destroy(id) },
      ]},
      { text: 'View', items: [
        { type: 'item', text: 'Large Icons', onClick: () => { mode = 'icons'; void render(); } },
        { type: 'item', text: 'List', onClick: () => { mode = 'list'; void render(); } },
      ]},
      { text: 'Help', items: [
        { type: 'item', text: 'About winweb…', onClick: () => alert('winweb Explorer\n\nWin32 → Web. Browsing the IndexedDB-backed C: drive.') },
      ]},
    ];
    this.wm.setMenu(id, menu);   // строка меню — sibling клиента (не обрезается overflow:hidden)

    const render = async (): Promise<void> => {
      const myGen = ++gen;
      const dir = cwd;                                  // снимок: содержимое будет согласовано
      this.wm.setTitle(id, 'Exploring - ' + dir);
      addr.textContent = dir;
      backBtn.disabled = !back.length;
      fwdBtn.disabled = !fwd.length;
      upBtn.disabled = dir === 'C:';
      const entries = await this.vfs.readdir(dir);
      if (myGen !== gen) return;                        // более новая навигация обогнала — выходим
      entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      const bytes = entries.reduce((s, e) => s + (e.type === 'file' ? e.size : 0), 0);
      folderStatus = `${entries.length} object(s)` + (bytes ? `   ${fmtSize(bytes)}` : '');
      view.className = 'fx-view ' + (mode === 'icons' ? 'fx-icons' : 'fx-list');
      view.replaceChildren();                           // чистим ПОСЛЕ await — нет частичного состояния
      if (dir !== 'C:') view.append(this.item(view, '📁', '..', () => goUp(), () => { status.textContent = folderStatus; }));
      for (const e of entries) {
        const el = this.item(view, iconFor(e), e.name,
          () => { if (e.type === 'dir') navTo(e.path); else this.onOpen(e); },
          () => { status.textContent = '1 object(s) selected' + (e.type === 'file' ? `   ${fmtSize(e.size)}` : ''); });
        view.append(el);
        if (e.type === 'file' && /\.(wasm|exe|dll|ico|bmp)$/i.test(e.name)) void this.realIcon(el, e.path);   // значок из самого файла
      }
      status.textContent = folderStatus;
    };

    view.addEventListener('click', (e) => {
      if (e.target === view) { view.querySelectorAll('.selected').forEach((x) => x.classList.remove('selected')); status.textContent = folderStatus; }
    });
    view.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goFwd(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); goUp(); return; }
      if (e.key === 'Enter') { e.preventDefault(); openSelected(); return; }
      const items = [...view.querySelectorAll<HTMLElement>('.fx-entry')];
      if (!items.length) return;
      const cur = view.querySelector<HTMLElement>('.fx-entry.selected');
      let idx = cur ? items.indexOf(cur) : -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') idx = Math.min(items.length - 1, idx + 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') idx = idx <= 0 ? 0 : idx - 1;
      else return;
      e.preventDefault();
      const t = items[idx]; t.dispatchEvent(new MouseEvent('click', { bubbles: true })); t.scrollIntoView({ block: 'nearest' });
    });

    void render();
  }

  private item(view: HTMLElement, icon: string, name: string, onOpen: () => void, onSelect: () => void): HTMLElement {
    const it = document.createElement('div'); it.className = 'fx-entry'; it.tabIndex = -1;
    const ic = document.createElement('span'); ic.className = 'fx-ico'; ic.textContent = icon;
    const lb = document.createElement('span'); lb.className = 'fx-name'; lb.textContent = name;
    it.append(ic, lb);
    it.addEventListener('click', (e) => {
      e.stopPropagation();
      view.querySelectorAll('.selected').forEach((x) => x.classList.remove('selected'));
      it.classList.add('selected'); it.focus(); onSelect();
    });
    it.addEventListener('dblclick', onOpen);
    return it;
  }

  /** Заменить эмодзи на настоящую иконку из самого файла (.wasm-секция / PE / .ico / .bmp). */
  private async realIcon(el: HTMLElement, path: string): Promise<void> {
    const bytes = await this.vfs.readFile(path);
    if (!bytes || !el.isConnected) return;
    const url = executableIconUrl(bytes, path);
    const ic = el.querySelector('.fx-ico');
    if (url && ic) { ic.textContent = ''; const img = document.createElement('img'); img.className = 'fx-img'; img.src = url; ic.append(img); }
  }
}

export async function openNotepad(wm: WindowManager, vfs: Vfs, e: Entry): Promise<void> {
  const text = await vfs.readText(e.path);
  const id = wm.create('Notepad - ' + e.name, 175, 95, 480, 340, { input: false });
  const client = wm.clientEl(id)!;
  const ta = document.createElement('textarea');
  ta.className = 'fx-notepad';
  ta.spellcheck = false;
  ta.value = text ?? '(binary file — ' + e.size + ' bytes)';
  client.append(ta);
}
