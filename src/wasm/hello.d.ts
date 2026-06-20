// Types for the Emscripten-generated hello.js (MODULARIZE + EXPORT_ES6).
// Loose for now; we'll generate precise types per module later.
export interface WasmModule {
  ccall(name: string, ret: string | null, argTypes: string[], args: unknown[]): any;
  cwrap(name: string, ret: string | null, argTypes: string[]): (...args: any[]) => any;
  _add(a: number, b: number): number;
  HEAPU8: Uint8Array;
}
declare const createModule: (opts?: Record<string, unknown>) => Promise<WasmModule>;
export default createModule;
