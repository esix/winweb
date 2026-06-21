/* winpaint.c - drag-to-draw Win32 paint, compiled in-browser by lcc-wasm:  cc winpaint.c
   Hold the left button and drag (WM_MOUSEMOVE + MK_LBUTTON) to paint. Strict C89. */
#include <windows.h>
void dot(HWND hwnd, int x, int y){
  HDC hdc; int c; HBRUSH br; HPEN pen;
  hdc = GetDC(hwnd);
  c = RGB((x*3)&255, (y*3)&255, 170);
  br = CreateSolidBrush(c);
  pen = CreatePen(PS_SOLID, 1, c);
  SelectObject(hdc, br); SelectObject(hdc, pen);
  Ellipse(hdc, x-7, y-7, x+7, y+7);
  DeleteObject(br); DeleteObject(pen);
  ReleaseDC(hwnd, hdc);
}
int WndProc(HWND hwnd, int msg, int wp, int lp){
  PAINTSTRUCT ps;
  HDC hdc;
  if(msg == WM_PAINT){
    hdc = BeginPaint(hwnd, &ps);
    SetBkMode(hdc, TRANSPARENT);
    TextOut(hdc, 12, 8, "Hold and drag to draw! (lcc)", 28);
    EndPaint(hwnd, &ps);
    return 0;
  }
  if(msg == WM_LBUTTONDOWN || (msg == WM_MOUSEMOVE && (wp & MK_LBUTTON))){
    dot(hwnd, lp & 65535, (lp >> 16) & 65535);
    return 0;
  }
  return DefWindowProc(hwnd, msg, wp, lp);
}
int main(void){
  WNDCLASS wc;
  HWND hwnd;
  MSG msg;
  wc.lpfnWndProc = WndProc;
  wc.lpszClassName = "Paint";
  RegisterClass(&wc);
  hwnd = CreateWindow("Paint", "lcc Paint - drag to draw", 0, 120, 90, 440, 320, 0, 0, 0, 0);
  ShowWindow(hwnd, 1); UpdateWindow(hwnd);
  while(GetMessage(&msg, 0, 0, 0)){ TranslateMessage(&msg); DispatchMessage(&msg); }
  return 0;
}