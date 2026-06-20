/* windows.h — GUI-сабсет Win32 для компиляции оконных приложений компилятором lcc-wasm.
 * Раскладка структур СОВПАДАЕТ с шимами в src/cc/win32rt.ts (lpfnWndProc@4, lpszClassName@36,
 * PAINTSTRUCT.hdc@0). Функции объявлены без тел -> lcc эмитит (import "env" ...); их даёт
 * TS-фасад. Дескрипторы (HWND/HDC/...) — это просто i32-id в winweb. Строго C89. */
#ifndef _WINWEB_GUI_WINDOWS_H
#define _WINWEB_GUI_WINDOWS_H

/* сообщения / флаги */
#define WM_DESTROY 2
#define WM_PAINT 15
#define WM_MOUSEMOVE 512
#define WM_LBUTTONDOWN 513
#define WM_LBUTTONUP 514
#define WM_RBUTTONDOWN 516
#define MK_LBUTTON 1
/* стоковые объекты / перья / фон */
#define WHITE_BRUSH 0
#define LTGRAY_BRUSH 1
#define GRAY_BRUSH 2
#define BLACK_BRUSH 4
#define WHITE_PEN 6
#define BLACK_PEN 7
#define PS_SOLID 0
#define TRANSPARENT 1
#define OPAQUE 2

typedef int HWND, HDC, HINSTANCE, HBRUSH, HPEN, HGDIOBJ, HMENU;
typedef char *LPSTR;
typedef int (*WNDPROC)(HWND, int, int, int);

typedef struct WNDCLASS {
    int style; WNDPROC lpfnWndProc; int cbClsExtra; int cbWndExtra;
    HINSTANCE hInstance; int hIcon; int hCursor; HBRUSH hbrBackground;
    LPSTR lpszMenuName; LPSTR lpszClassName;
} WNDCLASS;
typedef struct MSG { HWND hwnd; int message; int wParam; int lParam; int time; int x; int y; } MSG;
typedef struct PAINTSTRUCT { HDC hdc; int fErase; int rcL; int rcT; int rcR; int rcB; int rsv1; int rsv2; } PAINTSTRUCT;
typedef struct RECT { int left; int top; int right; int bottom; } RECT;

/* USER32 */
int  RegisterClass(WNDCLASS *wc);
HWND CreateWindow(LPSTR cls, LPSTR title, int style, int x, int y, int w, int h, HWND parent, HMENU menu, HINSTANCE inst, int param);
int  ShowWindow(HWND hwnd, int cmd);
int  UpdateWindow(HWND hwnd);
int  InvalidateRect(HWND hwnd, int rect, int erase);
int  GetMessage(MSG *m, HWND hwnd, int mn, int mx);
int  TranslateMessage(MSG *m);
int  DispatchMessage(MSG *m);
int  DefWindowProc(HWND hwnd, int msg, int wp, int lp);
int  PostQuitMessage(int code);
int  GetClientRect(HWND hwnd, RECT *r);
HGDIOBJ GetStockObject(int o);
HDC  BeginPaint(HWND hwnd, PAINTSTRUCT *ps);
int  EndPaint(HWND hwnd, PAINTSTRUCT *ps);
HDC  GetDC(HWND hwnd);
int  ReleaseDC(HWND hwnd, HDC hdc);

/* GDI */
int  TextOut(HDC hdc, int x, int y, LPSTR s, int len);
int  Rectangle(HDC hdc, int l, int t, int r, int b);
int  Ellipse(HDC hdc, int l, int t, int r, int b);
int  RGB(int r, int g, int b);
HPEN CreatePen(int style, int width, int color);
HBRUSH CreateSolidBrush(int color);
HGDIOBJ SelectObject(HDC hdc, HGDIOBJ obj);
int  DeleteObject(HGDIOBJ obj);
int  SetTextColor(HDC hdc, int color);
int  SetBkMode(HDC hdc, int mode);
int  FillRect(HDC hdc, RECT *rc, HBRUSH brush);
int  MoveToEx(HDC hdc, int x, int y, int pt);
int  LineTo(HDC hdc, int x, int y);

#endif
