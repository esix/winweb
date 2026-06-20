// iconsdemo.c + facade — демонстрация ресурсов .ico/.bmp из .rc (LoadIcon/LoadBitmap).
export interface IconsdemoApp {
  _main(): void;
  _wm_post(id: number, msg: number, wParam: number, lParam: number): void;
  HEAPU8: Uint8Array;
}
declare const createIconsdemo: (opts?: Record<string, unknown>) => Promise<IconsdemoApp>;
export default createIconsdemo;
