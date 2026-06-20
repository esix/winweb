import './style.css';
import createIconsdemo from './wasm/iconsdemo.js';
import { WindowManager } from './wm/window-manager';
import { makeHost } from './win32/host';
import { Gdi } from './win32/gdi';
import { Taskbar, type MenuNode } from './shell/taskbar';
import { Vfs, type Entry } from './fs/vfs';
import { Explorer } from './shell/explorer';
import { runApp } from './win32/runtime-loader';
import { readShortcuts } from './shell/shortcuts';
import { executableIconUrl } from './win32/exe-icon';
import { launchLccCmd } from './win32/lcc-cmd';

const desktop = document.getElementById('desktop')!;
const wm = new WindowManager(desktop);
const host = makeHost(wm);
(globalThis as unknown as { winwebHost: unknown }).winwebHost = host;

/* --- локальная ФС: открыть + засеять диск C: при первом запуске --- */
const vfs = new Vfs();
await vfs.open();
await vfs.seed('/cdrive/manifest.json');

/* мост к VFS для консоли (cmd): async-операция -> результат забирается опросом (host_vfs_poll) */
{
  let vfsRes: string | null = null;
  const h = host as unknown as { vfsStart: (op: number, p: string) => void; vfsPoll: () => string | null };
  h.vfsStart = (op, path) => {
    vfsRes = null;
    void (async () => {
      try {
        if (op === 0) {                              // dir
          const es = await vfs.readdir(path);
          es.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
          let s = `\r\n Directory of ${path}\r\n\r\n`;
          for (const e of es) s += e.type === 'dir' ? `             <DIR>  ${e.name}\r\n` : `${String(e.size).padStart(18)}  ${e.name}\r\n`;
          vfsRes = s + `${' '.repeat(15)}${es.length} item(s)\r\n`;
        } else {                                     // type
          vfsRes = (await vfs.readText(path)) ?? `The system cannot find the file: ${path}`;
        }
      } catch { vfsRes = `The system cannot find the path specified.`; }
    })();
  };
  h.vfsPoll = () => { if (vfsRes === null) return null; const r = vfsRes; vfsRes = null; return r; };
}

/* запуск программы из cmd: пробуем path и path+.wasm (запускаем), path+.exe (PE — не выполнить) */
{
  let execRes = -1;
  const h = host as unknown as { execStart: (p: string) => void; execPoll: () => number };
  h.execStart = (path) => {
    execRes = -1;
    void (async () => {
      for (const p of [path, `${path}.wasm`]) {
        const st = await vfs.stat(p);
        if (st?.type === 'file' && p.toLowerCase().endsWith('.wasm')) { void launchTarget(p); execRes = 1; return; }
      }
      for (const p of [path, `${path}.exe`]) {
        const st = await vfs.stat(p);
        if (st?.type === 'file' && p.toLowerCase().endsWith('.exe')) { execRes = 2; return; }   // нативный PE
      }
      execRes = 0;
    })();
  };
  h.execPoll = () => execRes;
}

/* cc: компилировать C-файл в wasm и сразу запустить, вывод в консоль con */
{
  let ccRes = -1;
  const hc = host as unknown as { ccStart: (path: string, con: number) => void; ccPoll: () => number };
  const con = (id: number, s: string): void => (host as unknown as { conWrite: (i: number, t: string) => void }).conWrite(id, s);
  hc.ccStart = (path, conId) => {
    ccRes = -1;
    void (async () => {
      try {
        const srcTxt = await vfs.readText(path);
        if (srcTxt == null) { con(conId, `cc: cannot open ${path}\r\n`); ccRes = 0; return; }
        const gui = /\b(CreateWindow|RegisterClass)\b/.test(srcTxt);   // Win32-GUI -> lcc + win32rt-фасад
        if (gui) {
          const { compileGui } = await import('./cc/lcc');
          const { makeWin32Lcc } = await import('./cc/win32rt');
          const { wasm } = await compileGui(srcTxt);
          const { env, setInstance } = makeWin32Lcc(wm);
          const { instance } = await WebAssembly.instantiate(wasm, { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
          setInstance(instance);
          (instance.exports.main as CallableFunction)();
          con(conId, 'GUI app started.\r\n'); ccRes = 0; return;
        }
        const { compileConsole, runConsole } = await import('./cc/lcc');   // консоль -> настоящий lcc (C89 + амальгама libc)
        const { wasm } = await compileConsole(srcTxt);
        runConsole(wasm, (s) => con(conId, s));
        ccRes = 0;
      } catch (e) { con(conId, 'cc: ' + (e as Error).message + '\r\n'); ccRes = 0; }
    })();
  };
  hc.ccPoll = () => ccRes;
}

/* настоящий Win32-Блокнот: читаем файл из VFS, текст через мост, запускаем notepad.wasm */
async function launchNotepad(e: Entry): Promise<void> {
  const path = e.path;
  const text = (await vfs.readText(path)) ?? '';
  const bytes = await (await fetch(`/lcc/notepad.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  const { makeWin32Full } = await import('./cc/win32-full');
  const { env, io, setInstance } = makeWin32Full(wm, host);
  Object.assign(env, {   // мосты winweb (host_*), читают/пишут память lcc-модуля + VFS
    host_launch_text: (buf: number, max: number) => io.wrA(buf, text, max),
    host_launch_path: (buf: number, max: number) => io.wrA(buf, path, max),
    host_save_file: (p: number, t: number) => { void vfs.writeFile(io.rdA(p), new TextEncoder().encode(io.rdA(t))); },
    host_prompt: (titleP: number, defP: number, buf: number, max: number) => { const r = window.prompt(io.rdA(titleP), io.rdA(defP)); return r == null ? 0 : io.wrA(buf, r, max); },
    host_load: (edit: number, p: number) => { void (async () => { const t = (await vfs.readText(io.rdA(p))) ?? ''; wm.setWindowText(edit, t); })(); },
  });
  const { instance } = await WebAssembly.instantiate(bytes, { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
  setInstance(instance);
  (instance.exports.WinMain as CallableFunction)(0, 0, 0, 1);
}

/* двойной клик по файлу: .wasm -> запуск из рантайма, иначе -> Блокнот */
function openEntry(e: Entry): void {
  if (e.name.toLowerCase().endsWith('.wasm')) {
    void (async () => {
      const bytes = await vfs.readFile(e.path);
      if (!bytes) return;
      const mod = await WebAssembly.compile(bytes);
      if (WebAssembly.Module.exports(mod).some((x) => x.name === 'WinMain')) await launchLccGui(mod);   // lcc standalone-приложение
      else await runApp(wm, host, e.name, bytes);                                                       // emscripten SIDE_MODULE
    })();
  } else {
    void launchNotepad(e);
  }
}

/* статичный демо-модуль ресурсов (.ico/.bmp из .rc): свой gdi на кучу модуля */
async function launchIconsdemo(): Promise<void> {
  const app = await createIconsdemo();
  (host as unknown as { gdi: Gdi }).gdi = new Gdi(wm, () => app.HEAPU8);
  wm.bindDispatch((id, m, w, l) => { app._wm_post(id, m, w, l); });
  app._main();
}

/* запуск цели ярлыка: app:* -> встроенный, папка -> Проводник, иначе -> openEntry (.wasm/файл) */
/* cmd, скомпилированный lcc-wasm (standalone, без emscripten) */
async function launchCmd(): Promise<void> {
  const bytes = await (await fetch(`/lcc/cmd_lcc.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  await launchLccCmd(wm, host, vfs, bytes, {
    launch: (p) => { void launchTarget(p); },
    cc: (p, con) => (host as unknown as { ccStart: (path: string, c: number) => void }).ccStart(p, con),
  });
}

/* запустить lcc-GUI-приложение (standalone-модуль, экспортирует WinMain) против полного Win32-фасада */
async function launchLccGui(mod: WebAssembly.Module): Promise<void> {
  const { makeWin32Full } = await import('./cc/win32-full');
  const { env, setInstance } = makeWin32Full(wm, host);
  const instance = await WebAssembly.instantiate(mod, { env: new Proxy(env, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
  setInstance(instance);
  (instance.exports.WinMain as CallableFunction)(0, 0, 0, 1);
}
async function launchMinesweeper(): Promise<void> {
  const bytes = await (await fetch(`/lcc/minesweeper.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  await launchLccGui(await WebAssembly.compile(bytes));
}

async function launchTarget(target: string): Promise<void> {
  if (target.startsWith('app:')) {
    if (target === 'app:cmd') void launchCmd();
    else if (target === 'app:minesweeper') void launchMinesweeper();
    else if (target === 'app:iconsdemo') void launchIconsdemo();
    return;
  }
  const st = await vfs.stat(target);
  if (st?.type === 'dir') { new Explorer(wm, vfs, openEntry).open(target); return; }
  const name = target.split('\\').pop() || target;
  openEntry({ path: target, name, type: 'file', size: st?.size ?? 0 });
}

/* иконка из самого исполняемого файла цели (для стола / Пуска / Проводника); null если её нет */
async function targetIconUrl(target: string): Promise<string | null> {
  if (target.startsWith('app:')) return null;
  const st = await vfs.stat(target);
  if (!st || st.type !== 'file') return null;
  const bytes = await vfs.readFile(target);
  return bytes ? executableIconUrl(bytes, target) : null;
}
function setIconImg(host: HTMLElement, url: string, cls: string): void {
  const img = document.createElement('img'); img.className = cls; img.src = url;
  host.replaceChildren(img);
}

/* --- классический экран завершения работы --- */
function shutDown(): void {
  const s = document.createElement('div');
  s.className = 'shutdown';
  s.innerHTML = '<div>It’s now safe to turn off<br>your computer.</div>';
  s.addEventListener('click', () => location.reload());
  document.body.append(s);
}

/* --- меню Пуск: Программы (из C:\Windows\Start Menu\Programs) + Настройки + Завершение --- */
const programs = await readShortcuts(vfs, 'C:\\Windows\\Start Menu\\Programs');
const programItems: MenuNode[] = programs.length
  ? await Promise.all(programs.map(async (sc) => ({
      label: sc.name, icon: sc.icon,
      iconUrl: (await targetIconUrl(sc.target)) ?? undefined,   // значок из самого .wasm/.exe
      onClick: () => { void launchTarget(sc.target); },
    })))
  : [{ label: '(пусто)', onClick: () => {} }];
new Taskbar(desktop, wm, [
  { label: 'Programs', icon: '📁', submenu: programItems },
  { label: 'Settings', icon: '⚙️', onClick: () => new Explorer(wm, vfs, openEntry).open('C:\\Windows') },
  { separator: true },
  { label: 'Shut Down…', icon: '⏻', onClick: shutDown },
]);

/* --- рабочий стол: иконки из папки C:\Windows\Desktop (значок — из самого файла цели) --- */
function addDesktopIcon(emoji: string, label: string, x: number, y: number, target: string): void {
  const el = document.createElement('div');
  el.className = 'desk-icon';
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  const ic = document.createElement('div'); ic.className = 'desk-ico'; ic.textContent = emoji;
  const lb = document.createElement('div'); lb.className = 'desk-lbl'; lb.textContent = label;
  el.append(ic, lb);
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectIcon(el); });   // одиночный клик — выделить
  el.addEventListener('dblclick', () => { void launchTarget(target); });                  // двойной — запуск
  desktop.append(el);
  void targetIconUrl(target).then((url) => { if (url) setIconImg(ic, url, 'desk-img'); });  // заменить эмодзи на иконку файла
}
function selectIcon(el: HTMLElement): void {
  desktop.querySelectorAll('.desk-icon.selected').forEach((x) => x.classList.remove('selected'));
  el.classList.add('selected');
}
desktop.addEventListener('pointerdown', () => {
  desktop.querySelectorAll('.desk-icon.selected').forEach((x) => x.classList.remove('selected'));
});

const deskItems = await readShortcuts(vfs, 'C:\\Windows\\Desktop');
deskItems.forEach((sc, i) => addDesktopIcon(sc.icon, sc.name, 18, 16 + i * 84, sc.target));

(window as unknown as { __wm: WindowManager }).__wm = wm;
(window as unknown as { __vfs: Vfs }).__vfs = vfs;
(window as unknown as { __explorer: () => void }).__explorer = () => new Explorer(wm, vfs, openEntry).open();
(window as unknown as { __open: (e: Entry) => void }).__open = openEntry;
(window as unknown as { __launchTarget: (t: string) => void }).__launchTarget = (t) => { void launchTarget(t); };

(window as unknown as { __launchLccCmd: () => void }).__launchLccCmd = () => { void launchCmd(); };

(window as unknown as { __launchMinesweeper: () => void }).__launchMinesweeper = () => { void launchMinesweeper(); };

/* проверочный хелпер: компиляция настоящего C89 (с #include) В БРАУЗЕРЕ через cpp.ts + rcc.wasm */
(window as unknown as { __lccCompile: (src: string) => Promise<unknown> }).__lccCompile = async (src: string) => {
  try {
    const { compileC } = await import('./cc/lcc');
    const { wasm } = await compileC(src);
    let out = '';
    const inst = new WebAssembly.Instance(new WebAssembly.Module(wasm), { env: new Proxy({ putchar: (c: number) => { out += String.fromCharCode(c & 255); return c; } } as Record<string, unknown>, { get: (t, k) => (k in t ? t[k] : () => 0) }) });
    const rc = (inst.exports as { main?: CallableFunction }).main?.();
    return { out, rc, bytes: wasm.length, valid: WebAssembly.validate(wasm) };
  } catch (e) { return { error: (e as Error).message }; }
};

/* --- C→wasm компилятор (тест): __ccRun(src) компилирует и запускает, ловит вывод --- */
(window as unknown as { __ccRun: (src: string) => Promise<unknown> }).__ccRun = async (src: string) => {
  const { compile, makeEnv } = await import('./cc/cc');
  const r = compile(src);
  if (!r.ok) return { errors: r.errors };
  let out = '';
  const { env } = makeEnv((s) => { out += s; });
  const { instance } = await WebAssembly.instantiate(r.wasm!, { env });
  const ret = (instance.exports.main as CallableFunction)();
  return { out, ret, bytes: r.wasm!.length };
};

/* C→wasm GUI (Win32): компилируем с windows.h-прелюдией и запускаем окно (WndProc через таблицу) */
(window as unknown as { __ccRunWin: (src: string) => Promise<unknown> }).__ccRunWin = async (src: string) => {
  const { compile } = await import('./cc/cc');
  const { makeWin32, WIN32_PRELUDE } = await import('./cc/win32rt');
  const r = compile(WIN32_PRELUDE + '\n' + src);
  if (!r.ok) return { errors: r.errors };
  const { env, setInstance } = makeWin32(wm, () => {});
  const { instance } = await WebAssembly.instantiate(r.wasm!, { env });
  setInstance(instance);
  (instance.exports.main as CallableFunction)();
  return { ok: true, bytes: r.wasm!.length };
};
