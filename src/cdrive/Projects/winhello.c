/* winhello.c - a Win32 GUI app compiled in-browser by lcc-wasm:  cc winhello.c
   #include <windows.h> resolves via the in-browser cpp; strict C89 (decls first). */
#include <windows.h>
int WndProc(HWND hwnd, int msg, int wp, int lp){
  PAINTSTRUCT ps;
  HDC hdc;
  if(msg == WM_PAINT){
    hdc = BeginPaint(hwnd, &ps);
    TextOut(hdc, 20, 20, "Hello from compiled C!", 22);
    TextOut(hdc, 20, 48, "Built by lcc-wasm in the browser.", 33);
    EndPaint(hwnd, &ps);
    return 0;
  }
  return DefWindowProc(hwnd, msg, wp, lp);
}
int main(void){
  WNDCLASS wc;
  HWND hwnd;
  MSG msg;
  wc.lpfnWndProc = WndProc;
  wc.lpszClassName = "WinHello";
  RegisterClass(&wc);
  hwnd = CreateWindow("WinHello", "Win32 from lcc", 0, 110, 110, 380, 220, 0, 0, 0, 0);
  ShowWindow(hwnd, 1);
  UpdateWindow(hwnd);
  while(GetMessage(&msg, 0, 0, 0)){ TranslateMessage(&msg); DispatchMessage(&msg); }
  return 0;
}