// Types for the Emscripten-generated user32.js (MODULARIZE + EXPORT_ES6).
// main() runs on instantiation and builds the windows via globalThis.winwebHost.
export interface WasmModule {
  ccall(name: string, ret: string | null, argTypes: string[], args: unknown[]): any;
  cwrap(name: string, ret: string | null, argTypes: string[]): (...args: any[]) => any;
  _wm_dispatch(id: number, msg: number, wParam: number, lParam: number): number;
  HEAPU8: Uint8Array;
}
declare const createModule: (opts?: Record<string, unknown>) => Promise<WasmModule>;
export default createModule;
