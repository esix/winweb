// Types for the H5 Win32-facade app module (sample.c + win32_impl.c).
// Built with ASYNCIFY (blocking GetMessage loop) + MODULARIZE + EXPORT_ES6 + INVOKE_RUN=0.
export interface Win32App {
  _main(): void;                                            // starts WinMain (suspends in GetMessage)
  _wm_post(id: number, msg: number, wParam: number, lParam: number): void;  // DOM event -> queue
  HEAPU8: Uint8Array;
}
declare const createApp: (opts?: Record<string, unknown>) => Promise<Win32App>;
export default createApp;
