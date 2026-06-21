import './style.css';
import { WindowManager } from './wm/window-manager';
import { makeHost } from './win32/host';
import { stubEnv } from './win32/wasm-env';
import { Taskbar, type MenuNode } from './shell/taskbar';
import { Vfs, type Entry } from './fs/vfs';
import { Explorer } from './shell/explorer';
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
          const { instance } = await WebAssembly.instantiate(wasm as BufferSource, { env: stubEnv(env) });
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
/* Блокнот (notepad.wasm): GUI-редактор. path — открываемый файл (пустой -> untitled).
   bytes — уже скачанный/прочитанный notepad.wasm. Мосты host_* дают файл + сохранение в VFS. */
async function launchNotepadWasm(bytes: Uint8Array, path: string): Promise<void> {
  const text = path ? ((await vfs.readText(path)) ?? '') : '';
  const { makeWin32Full } = await import('./cc/win32-full');
  const { env, io, setInstance } = makeWin32Full(wm, host, wasmIconUrl(bytes));
  Object.assign(env, {   // мосты winweb (host_*), читают/пишут память lcc-модуля + VFS
    host_launch_text: (buf: number, max: number) => io.wrA(buf, text, max),
    host_launch_path: (buf: number, max: number) => io.wrA(buf, path, max),
    host_save_file: (p: number, t: number) => { void vfs.writeFile(io.rdA(p), new TextEncoder().encode(io.rdA(t))); },
    host_prompt: (titleP: number, defP: number, buf: number, max: number) => { const r = window.prompt(io.rdA(titleP), io.rdA(defP)); return r == null ? 0 : io.wrA(buf, r, max); },
    host_load: (edit: number, p: number) => { void (async () => { const t = (await vfs.readText(io.rdA(p))) ?? ''; wm.setWindowText(edit, t); })(); },
  });
  const { instance } = await WebAssembly.instantiate(bytes as BufferSource, { env: stubEnv(await linkUser32(env)) });
  setInstance(instance);
  (instance.exports.WinMain as CallableFunction)(0, 0, 0, 1);
}
/* открыть файл в Блокноте (скачиваем notepad.wasm из System32) */
async function launchNotepad(path: string): Promise<void> {
  const bytes = new Uint8Array(await (await fetch(`/cdrive/Windows/System32/notepad.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer());
  await launchNotepadWasm(bytes, path);
}

/* двойной клик по файлу: .wasm -> запуск из рантайма, иначе -> Блокнот */
function openEntry(e: Entry): void {
  if (e.name.toLowerCase().endsWith('.wasm')) void execWasmFile(e.path, '', 'C:\\', null);   // GUI -> окно; консольный -> новая консоль
  else void launchNotepad(e.path);
}

/* статичный демо-модуль ресурсов (.ico/.bmp из .rc): свой gdi на кучу модуля */
async function launchIconsdemo(): Promise<void> {
  const bytes = await (await fetch(`/cdrive/Program%20Files/IconsDemo/IconsDemo.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  await launchLccGui(await WebAssembly.compile(bytes), wasmIconUrl(new Uint8Array(bytes)));   // ресурсы .ico/.bmp — реальный LoadIcon/LoadBitmap
}

/* запуск цели ярлыка: app:* -> встроенный, папка -> Проводник, иначе -> openEntry (.wasm/файл) */
/* cmd, скомпилированный lcc-wasm (standalone, без emscripten) */
async function launchCmd(): Promise<void> {
  const bytes = await (await fetch(`/cdrive/Program%20Files/cmd/cmd.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  await launchLccCmd(wm, host, vfs, bytes, {
    launch: (p) => { void launchTarget(p); },
    exec: (wasmPath, args, cwd, con) => { void execWasmFile(wasmPath, args, cwd, con); },   // cmd нашёл .wasm (cwd/System32) -> запустить
  });
}

/* запустить .wasm из VFS: GUI (экспорт WinMain) -> окно; консольный (экспорт main) -> в консоли con
   (con == null -> открыть НОВУЮ консоль, напр. при двойном клике в Проводнике на консольный инструмент). */
async function execWasmFile(wasmPath: string, args: string, cwd: string, con: number | null): Promise<void> {
  const bytes = await vfs.readFile(wasmPath);
  if (!bytes) return;
  const mod = await WebAssembly.compile(bytes as BufferSource);
  const ex = WebAssembly.Module.exports(mod);
  if (WebAssembly.Module.imports(mod).some((i) => i.name === 'host_launch_text')) {   // редактор (notepad): аргумент = открываемый файл
    await launchNotepadWasm(bytes, args.trim() ? resolveCwd(args, cwd) : '');
    return;
  }
  if (ex.some((e) => e.name === 'WinMain')) { await launchLccGui(mod, wasmIconUrl(bytes)); return; }   // оконное приложение
  if (ex.some((e) => e.name === 'main')) {                                                        // консольный инструмент
    const h = host as unknown as { conOpen: () => number; conTitle: (i: number, t: string) => void };
    let conId = con;
    if (conId == null) { conId = h.conOpen(); h.conTitle(conId, wasmPath.split('\\').pop()?.replace(/\.wasm$/i, '') ?? 'console'); }
    await launchConsoleTool(bytes, args, cwd, conId);
  }
}

/* путь arg относительно cwd (абсолютный C:\... — как есть) */
function resolveCwd(arg: string, cwd: string): string {
  const a = arg.trim();
  if (/^[A-Za-z]:/.test(a)) return a;
  return (cwd.endsWith('\\') ? cwd : cwd + '\\') + a;
}
const conWrite = (con: number, s: string) => (host as unknown as { conWrite: (i: number, t: string) => void }).conWrite(con, s);
const U8D = new TextDecoder(), U8E = new TextEncoder();   // char* в инструментах — UTF-8
const wasmIconUrl = (bytes: Uint8Array): string | undefined => executableIconUrl(bytes, 'a.wasm') ?? undefined;   // иконка из секции "winweb.ico"

/* USER32 как настоящий DLL: эти функции окна/сообщений приложение зовёт ИЗ C:\Windows\System32\user32.wasm
   (его exports подставляются в env приложения), а user32.wasm форвардит их в JS-фасад (js_*). */
const USER32_FUNCS = ['RegisterClass', 'CreateWindowEx', 'ShowWindow', 'UpdateWindow', 'GetMessage', 'TranslateMessage', 'DispatchMessage', 'DefWindowProc', 'PostQuitMessage', 'InvalidateRect', 'GetClientRect', 'MessageBox', 'GetSystemMetrics', 'DestroyWindow'];
let user32Bytes: ArrayBuffer | null = null;
async function linkUser32(env: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    if (!user32Bytes) { user32Bytes = await (await fetch('/cdrive/Windows/System32/user32.wasm', { cache: 'no-store' })).arrayBuffer(); console.info('[user32] DLL loaded from C:\\Windows\\System32\\user32.wasm'); }
    const u32imports: Record<string, unknown> = {};
    for (const f of USER32_FUNCS) u32imports['js_' + f] = env[f];                 // user32.wasm импортит js_<X>
    const exp = (await WebAssembly.instantiate(user32Bytes, { env: stubEnv(u32imports) })).instance.exports;
    const out = { ...env };
    for (const f of USER32_FUNCS) if (typeof exp[f] === 'function') out[f] = exp[f];   // приложение зовёт эти функции ИЗ user32.wasm
    return out;
  } catch { return env; }   // нет/несовместим user32.wasm -> функции напрямую из JS (graceful)
}

/* консольный инструмент C:\Windows\System32\*.wasm (msbuild, cc): тонкий wasm, зовущий winweb_* в JS.
   Получает аргументы (winweb_args), cwd (winweb_cwd), id консоли (winweb_stdout); stdout (__write) -> эта консоль. */
async function launchConsoleTool(bytes: Uint8Array, args: string, cwd: string, con: number): Promise<void> {
  let mem: WebAssembly.Memory;
  const u8 = () => new Uint8Array(mem.buffer);
  const rdA = (p: number) => { const b = u8(); let e = p; while (b[e]) e++; return U8D.decode(b.subarray(p, e)); };
  const wrA = (p: number, s: string, max: number) => { const b = u8(), enc = U8E.encode(s); let i = 0; for (; i < enc.length && i < max - 1; i++) b[p + i] = enc[i]; b[p + i] = 0; return i; };
  const env: Record<string, unknown> = {
    winweb_args: (buf: number, max: number) => wrA(buf, args, max),
    winweb_cwd: (buf: number, max: number) => wrA(buf, cwd, max),
    winweb_stdout: () => con,
    winweb_msbuild: (argsPtr: number, c: number) => { void msbuildTool(rdA(argsPtr), cwd, c); return 0; },
    winweb_cc: (argsPtr: number, c: number) => { void ccTool(rdA(argsPtr), cwd, c); return 0; },
    __read: () => 0,
    __write: (_fd: number, ptr: number, len: number) => { conWrite(con, U8D.decode(u8().subarray(ptr, ptr + len)).replace(/\r?\n/g, '\r\n')); return len; },
    __exit: () => 0,
  };
  const { instance } = await WebAssembly.instantiate(bytes as BufferSource, { env: stubEnv(env) });
  mem = instance.exports.memory as WebAssembly.Memory;
  (instance.exports.main as CallableFunction)();
}

/* cc.wasm -> winweb_cc: КОМПИЛИРУЕТ один C-файл в <name>.wasm (как настоящий cc — не запускает;
   запустить потом отдельно: имя без расширения найдётся в cwd). Путь — относительно cwd. */
async function ccTool(args: string, cwd: string, con: number): Promise<void> {
  const log = (s: string) => conWrite(con, s);
  const a = args.trim();
  if (!a) { log('cc: usage: cc <file.c>   (компилирует в <name>.wasm; запуск потом: <name>)\r\n'); return; }
  const src = resolveCwd(a, cwd);
  const text = await vfs.readText(src);
  if (text == null) { log(`cc: cannot open ${src}\r\n`); return; }
  let wasm: Uint8Array;
  try { ({ wasm } = await (await import('./cc/lcc')).compileProject([text])); }
  catch (e) { log(`cc: ${String((e as Error).message).split('\n').slice(0, 5).join('\r\n  ')}\r\n`); return; }
  const out = src.replace(/\.[cC]$/, '.wasm');
  await vfs.writeFile(out, wasm);
  log(`cc: ${a} -> ${out.split('\\').pop()} (${wasm.length} bytes)\r\n`);
}

/* msbuild.wasm -> winweb_msbuild: собрать проект args (относительно cwd / C:\Projects), вывод в con */
async function msbuildTool(args: string, cwd: string, con: number): Promise<void> {
  const log = (s: string) => conWrite(con, s);
  const a = args.trim();
  if (!a) { log('MSBuild: usage: msbuild <project>   (e.g. msbuild Hello)\r\n'); return; }
  for (const dir of [resolveCwd(a, cwd), a, `C:\\Projects\\${a.replace(/\\+$/, '').split('\\').pop()}`]) {
    const ents = await vfs.readdir(dir).catch(() => [] as Entry[]);
    if (ents.some((e) => e.name.toLowerCase().endsWith('.vcxproj'))) { await msbuildBuild(dir, log); return; }
  }
  log(`MSBuild: project not found: ${a}\r\n`);
}

/* запустить lcc-GUI-приложение (standalone-модуль, экспортирует WinMain) против полного Win32-фасада */
async function launchLccGui(mod: WebAssembly.Module, iconUrl?: string): Promise<void> {
  const { makeWin32Full } = await import('./cc/win32-full');
  const { env, setInstance } = makeWin32Full(wm, host, iconUrl);
  const instance = await WebAssembly.instantiate(mod, { env: stubEnv(await linkUser32(env)) });
  setInstance(instance);
  (instance.exports.WinMain as CallableFunction)(0, 0, 0, 1);
}

/* msbuild: собрать проект из VFS (cpp.ts+rcc.wasm) -> C:\Program Files\<App>\<App>.wasm.
   НЕ запускает (как настоящий msbuild) — собранное приложение запускается отдельно (ярлык/Проводник). */
async function msbuildBuild(dir: string, log: (s: string) => void): Promise<number> {
  const { buildProject } = await import('./cc/msbuild');
  const { code } = await buildProject(vfs, dir, log);
  return code;
}
(window as unknown as { __msbuild: (d: string) => Promise<unknown> }).__msbuild = async (d: string) => {
  let out = ''; const code = await msbuildBuild(d, (s) => { out += s; });
  return { code, log: out };
};
async function launchMinesweeper(): Promise<void> {
  const bytes = await (await fetch(`/cdrive/Program%20Files/Minesweeper/Minesweeper.wasm?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  await launchLccGui(await WebAssembly.compile(bytes), wasmIconUrl(new Uint8Array(bytes)));
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

/* app:-ярлыки -> их .wasm (для иконки) */
const APP_WASM: Record<string, string> = {
  minesweeper: 'C:\\Program Files\\Minesweeper\\Minesweeper.wasm',
  iconsdemo: 'C:\\Program Files\\IconsDemo\\IconsDemo.wasm',
  cmd: 'C:\\Program Files\\cmd\\cmd.wasm',
};
/* иконка из самого исполняемого файла цели (для стола / Пуска / Проводника); null если её нет.
   Фетчим обслуживаемый файл (свежая сборка), а не возможно-устаревший VFS. */
async function targetIconUrl(target: string): Promise<string | null> {
  let path = target;
  if (target.startsWith('app:')) { path = APP_WASM[target.slice(4)] ?? ''; if (!path) return null; }
  const lower = path.toLowerCase();
  if (!lower.endsWith('.wasm') && !lower.endsWith('.exe')) return null;
  const url = '/cdrive/' + path.replace(/^C:\\/, '').split('\\').map(encodeURIComponent).join('/');
  try {
    const bytes = new Uint8Array(await (await fetch(url, { cache: 'no-store' })).arrayBuffer());
    return executableIconUrl(bytes, path);
  } catch { return null; }
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
    const inst = new WebAssembly.Instance(new WebAssembly.Module(wasm as BufferSource), { env: stubEnv({ putchar: (c: number) => { out += String.fromCharCode(c & 255); return c; } }) });
    const rc = (inst.exports as { main?: CallableFunction }).main?.();
    return { out, rc, bytes: wasm.length, valid: WebAssembly.validate(wasm as BufferSource) };
  } catch (e) { return { error: (e as Error).message }; }
};

/* --- C→wasm компилятор (тест): __ccRun(src) компилирует и запускает, ловит вывод --- */
(window as unknown as { __ccRun: (src: string) => Promise<unknown> }).__ccRun = async (src: string) => {
  const { compile, makeEnv } = await import('./cc/cc');
  const r = compile(src);
  if (!r.ok) return { errors: r.errors };
  let out = '';
  const { env } = makeEnv((s) => { out += s; });
  const { instance } = await WebAssembly.instantiate(r.wasm! as BufferSource, { env: stubEnv(env) });
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
  const { instance } = await WebAssembly.instantiate(r.wasm! as BufferSource, { env: stubEnv(env) });
  setInstance(instance);
  (instance.exports.main as CallableFunction)();
  return { ok: true, bytes: r.wasm!.length };
};
