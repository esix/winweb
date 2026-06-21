/* lcc-cmd.ts — TS-рантайм (фасад) для cmd, СКОМПИЛИРОВАННОГО компилятором lcc-wasm.
 *
 * Модуль cmd_lcc.wasm — standalone (экспортит свою память), без ASYNCIFY. Управление
 * инвертировано: мы зовём init() один раз, и process_line() на каждую введённую строку
 * (строку пишем в input_buf()). Win32-консоль и winweb_* — это env-импорты-шимы здесь.
 *
 * winweb_vfs обязан быть СИНХРОННЫМ (C зовёт и сразу читает буфер), а наш Vfs — async
 * (IndexedDB). Поэтому держим СНИМОК VFS и обновляем его (await) ПЕРЕД каждой командой —
 * поллинг строк идёт в JS setInterval и не блокирует страницу.
 */
import type { WindowManager } from '../wm/window-manager';
import type { WinwebHost } from './host';
import type { Vfs } from '../fs/vfs';
import { stubEnv } from './wasm-env';

interface Snapshot {
  dirs: Map<string, { name: string; path: string; type: 'dir' | 'file'; size: number }[]>;
  texts: Map<string, string>;
  all: Map<string, { type: 'dir' | 'file'; size: number }>;
}

async function loadSnapshot(vfs: Vfs): Promise<Snapshot> {
  const dirs: Snapshot['dirs'] = new Map();
  const texts = new Map<string, string>();
  const all: Snapshot['all'] = new Map();
  async function walk(dir: string): Promise<void> {
    let entries;
    try { entries = await vfs.readdir(dir); } catch { return; }
    dirs.set(dir, entries);
    for (const e of entries) {
      all.set(e.path, { type: e.type, size: e.size });
      if (e.type === 'dir') await walk(e.path);
      else if (e.size < 262144 && !e.path.toLowerCase().endsWith('.wasm')) {
        try { const t = await vfs.readText(e.path); if (t != null) texts.set(e.path, t); } catch { /* ignore */ }
      }
    }
  }
  await walk('C:\\');
  return { dirs, texts, all };
}

/* dir/type над снимком (формат как в эмскриптеновском мосте) */
function vfsLookup(op: number, path: string, snap: Snapshot): string {
  if (op === 0) {
    const es = snap.dirs.get(path);
    if (!es) return `The system cannot find the path specified.`;
    const sorted = [...es].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    let s = `\r\n Directory of ${path}\r\n\r\n`;
    for (const e of sorted) s += e.type === 'dir' ? `             <DIR>  ${e.name}\r\n` : `${String(e.size).padStart(18)}  ${e.name}\r\n`;
    return s + `${' '.repeat(15)}${sorted.length} item(s)\r\n`;
  }
  const t = snap.texts.get(path);
  if (t != null) return t;
  return snap.all.get(path) ? `(binary file)` : `The system cannot find the file: ${path}`;
}

export interface LccCmdHooks {
  launch: (path: string) => void;               // запуск .wasm-цели
  exec: (wasmPath: string, args: string, cwd: string, conId: number) => void;   // запуск найденного .wasm (cwd/System32) с args + cwd
}

export async function launchLccCmd(_wm: WindowManager, host: WinwebHost, vfs: Vfs, wasmBytes: BufferSource, hooks: LccCmdHooks): Promise<void> {
  const conId = host.conOpen();
  let mem!: WebAssembly.Memory;
  let snap: Snapshot = { dirs: new Map(), texts: new Map(), all: new Map() };

  const u8 = () => new Uint8Array(mem.buffer);
  const dv = () => new DataView(mem.buffer);
  const TD = new TextDecoder(), TE = new TextEncoder();   // char* в cmd/инструментах — UTF-8
  const rd = (p: number) => { const b = u8(); let e = p; while (b[e]) e++; return TD.decode(b.subarray(p, e)); };
  const writeStr = (p: number, s: string, max: number) => { const b = u8(), enc = TE.encode(s); let i = 0; for (; i < enc.length && i < max - 1; i++) b[p + i] = enc[i]; b[p + i] = 0; return i; };

  const env: Record<string, unknown> = {
    AllocConsole: () => 1,
    SetConsoleTitleA: (p: number) => { host.conTitle(conId, rd(p)); return 1; },
    GetStdHandle: () => conId,
    WriteConsoleA: (h: number, buf: number, len: number, writtenPtr: number) => {
      host.conWrite(h, TD.decode(u8().subarray(buf, buf + len)));   // UTF-8
      if (writtenPtr) dv().setInt32(writtenPtr, len, true);
      return 1;
    },
    winweb_con_clear: (id: number) => host.conClear(id),
    winweb_vfs: (op: number, pathPtr: number, bufPtr: number, max: number) => writeStr(bufPtr, vfsLookup(op, rd(pathPtr), snap), max),
    winweb_exec: (pathPtr: number, argsPtr: number, cwdPtr: number, con: number) => {
      const path = rd(pathPtr), args = rd(argsPtr), cwd = rd(cwdPtr), base = path.replace(/\\+$/, '').split('\\').pop() || path;
      for (const p of [`${path}.wasm`, path, `C:\\Windows\\System32\\${base}.wasm`]) {   // cwd, затем System32 (PATH позже)
        const e = snap.all.get(p);
        if (e?.type === 'file' && p.toLowerCase().endsWith('.wasm')) { hooks.exec(p, args, cwd, con); return 1; }
      }
      for (const p of [`${path}.exe`, path]) { const e = snap.all.get(p); if (e?.type === 'file' && p.toLowerCase().endsWith('.exe')) return 2; }
      return 0;
    },
  };

  const { instance } = await WebAssembly.instantiate(wasmBytes, { env: stubEnv(env) });
  const ex = instance.exports as Record<string, CallableFunction> & { memory: WebAssembly.Memory };
  mem = ex.memory;

  snap = await loadSnapshot(vfs);
  ex.init();

  const inputAddr = ex.input_buf() as unknown as number;
  let busy = false;
  const poll = setInterval(() => {
    if (busy) return;
    const line = host.conTryLine(conId);
    if (line === false) { clearInterval(poll); return; }   // консоль закрыта
    if (line === null) return;                              // строк пока нет
    busy = true;
    void (async () => {
      snap = await loadSnapshot(vfs);                       // свежий снимок перед командой
      writeStr(inputAddr, line, 512);
      ex.process_line();
      busy = false;
    })();
  }, 30);
}
