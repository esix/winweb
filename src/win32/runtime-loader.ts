/* runtime-loader.ts — D1 of the dynamic-DLL runtime.
 *
 * Instantiate the MAIN_MODULE Win32 runtime ONCE, then load + run apps as
 * SIDE_MODULEs (dynamic linking). All dynamically-loaded apps share this single
 * runtime → one heap, one GDI, one message queue. The blocking GetMessage loop
 * suspends across the module boundary via JSPI (winweb_run is a promising export).
 */
import createRuntime, { type RuntimeModule } from '../wasm/runtime.js';
import type { WindowManager } from '../wm/window-manager';
import { Gdi } from './gdi';
import type { WinwebHost } from './host';

let rtPromise: Promise<RuntimeModule> | null = null;

/** Instantiate the shared runtime exactly once; wire its heap to GDI + message routing. */
export async function getRuntime(wm: WindowManager, host: WinwebHost): Promise<RuntimeModule> {
  if (rtPromise) return rtPromise;
  rtPromise = (async () => {
    const rt = await createRuntime();
    (host as unknown as { gdi: Gdi }).gdi = new Gdi(wm, () => rt.HEAPU8);
    wm.bindDispatch((id, msg, w, l) => { rt._wm_post(id, msg, w, l); });
    return rt;
  })();
  return rtPromise;
}

/**
 * Load a side-module app from bytes and run it:
 *   - write to MEMFS at an ABSOLUTE path so the dynamic linker's findLibraryFS locates it
 *   - loadDynamicLibrary links it against the runtime (resolves the Win32 imports), global so symbols publish
 *   - winweb_run (C trampoline) dlsym's WinMain and calls it; async (JSPI promising) — fire-and-forget,
 *     the returned Promise resolves only when the app quits (WM_QUIT).
 */
/* ОДНО окно на приложение. Доказано пробами: два экземпляра ОДНОГО side-модуля делят
 * его сегмент данных (g_MainWindow/g_GameGrid по ОДНОМУ адресу в MAIN_MODULE=1, даже под
 * разными путями) -> оба рисуют в одно окно. Поэтому второй запуск того же модуля блокируем.
 * Разные приложения (hello+minesweeper) работают параллельно и независимо (разные модули =
 * разные сегменты). Закрытие окна сбрасывает запись -> можно запустить заново. */
const loaded = new Set<string>();
const running = new Set<string>();

export async function runApp(wm: WindowManager, host: WinwebHost, name: string, bytes: Uint8Array): Promise<void> {
  const fsPath = '/' + name;
  if (running.has(fsPath)) { console.warn(`[winweb] ${name} уже запущен (одно окно на приложение)`); return; }
  running.add(fsPath);
  const rt = await getRuntime(wm, host);
  if (!loaded.has(fsPath)) {
    rt.FS.writeFile(fsPath, bytes);
    await rt.loadDynamicLibrary(fsPath, { loadAsync: true, global: true, nodelete: true });
    loaded.add(fsPath);
  }
  wm.bindDispatch((id, msg, w, l) => { rt._wm_post(id, msg, w, l); });
  const done = rt.ccall('winweb_run', 'number', ['string'], [fsPath], { async: true }) as Promise<unknown>;
  void Promise.resolve(done).finally(() => { running.delete(fsPath); });
}

/** D1 convenience: fetch the hello side module from the web root and run it. */
export async function runHello(wm: WindowManager, host: WinwebHost): Promise<void> {
  const bytes = new Uint8Array(await (await fetch('/hello.wasm')).arrayBuffer());
  await runApp(wm, host, 'hello.wasm', bytes);
}
