// MAIN_MODULE Win32 runtime (win32_impl.c). Apps load as SIDE_MODULEs and import its API.
export interface RuntimeModule {
  FS: { writeFile(path: string, data: Uint8Array): void; mkdir(path: string): void };
  loadDynamicLibrary(
    path: string,
    opts: { loadAsync: boolean; global: boolean; nodelete: boolean },
  ): Promise<unknown>;
  ccall(
    name: string, ret: string | null, argT: string[], args: unknown[],
    opts?: { async?: boolean },
  ): unknown;
  HEAPU8: Uint8Array;
  _wm_post(id: number, msg: number, wParam: number, lParam: number): void;
}
declare const createRuntime: (opts?: Record<string, unknown>) => Promise<RuntimeModule>;
export default createRuntime;
