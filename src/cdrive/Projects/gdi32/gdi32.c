/* gdi32.c — winweb "DLL": ЗДЕСЬ определены функции GDI (рисование/объекты).
 * Настоящий C:\Windows\System32\gdi32.wasm; приложения импортируют эти функции отсюда,
 * а реализация — тонкие трамплины в JS-фасад (js_*). Как user32.wasm, но для GDI. */
#include <windows.h>

extern HGDIOBJ  js_GetStockObject(int);
extern HBRUSH   js_CreateSolidBrush(COLORREF);
extern int      js_FillRect(HDC, const RECT*, HBRUSH);
extern BOOL     js_Rectangle(HDC, int, int, int, int);
extern BOOL     js_Ellipse(HDC, int, int, int, int);
extern COLORREF js_SetTextColor(HDC, COLORREF);
extern BOOL     js_TextOut(HDC, int, int, LPCTSTR, int);
extern COLORREF js_SetPixel(HDC, int, int, COLORREF);
extern BOOL     js_MoveToEx(HDC, int, int, LPPOINT);
extern BOOL     js_LineTo(HDC, int, int);
extern HDC      js_CreateCompatibleDC(HDC);
extern HBITMAP  js_CreateCompatibleBitmap(HDC, int, int);
extern BOOL     js_BitBlt(HDC, int, int, int, int, HDC, int, int, DWORD);
extern BOOL     js_DeleteDC(HDC);
extern BOOL     js_DeleteObject(HGDIOBJ);
extern HGDIOBJ  js_SelectObject(HDC, HGDIOBJ);
extern HPEN     js_CreatePen(int, int, COLORREF);
extern HFONT    js_CreateFontW(int,int,int,int,int,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,LPCWSTR);
extern BOOL     js_Polygon(HDC, const POINT*, int);
extern BOOL     js_Arc(HDC, int, int, int, int, int, int, int, int);
extern int      js_SetBkMode(HDC, int);
extern COLORREF js_SetBkColor(HDC, COLORREF);
extern DWORD    js_SetLayout(HDC, DWORD);
extern DWORD    js_GetLayout(HDC);
extern BOOL     js_TextOutW(HDC, int, int, LPCWSTR, int);
extern HBRUSH   js_GetSysColorBrush(int);
extern BOOL     js_GetTextExtentPoint32W(HDC, LPCWSTR, int, LPSIZE);

HGDIOBJ  GetStockObject(int o)                          { return js_GetStockObject(o); }
HBRUSH   CreateSolidBrush(COLORREF c)                   { return js_CreateSolidBrush(c); }
int      FillRect(HDC d, const RECT* r, HBRUSH b)       { return js_FillRect(d, r, b); }
BOOL     Rectangle(HDC d, int l, int t, int r, int b)   { return js_Rectangle(d, l, t, r, b); }
BOOL     Ellipse(HDC d, int l, int t, int r, int b)     { return js_Ellipse(d, l, t, r, b); }
COLORREF SetTextColor(HDC d, COLORREF c)                { return js_SetTextColor(d, c); }
BOOL     TextOut(HDC d, int x, int y, LPCTSTR s, int n) { return js_TextOut(d, x, y, s, n); }
COLORREF SetPixel(HDC d, int x, int y, COLORREF c)      { return js_SetPixel(d, x, y, c); }
BOOL     MoveToEx(HDC d, int x, int y, LPPOINT p)       { return js_MoveToEx(d, x, y, p); }
BOOL     LineTo(HDC d, int x, int y)                    { return js_LineTo(d, x, y); }
HDC      CreateCompatibleDC(HDC d)                      { return js_CreateCompatibleDC(d); }
HBITMAP  CreateCompatibleBitmap(HDC d, int w, int h)    { return js_CreateCompatibleBitmap(d, w, h); }
BOOL     BitBlt(HDC d, int x, int y, int w, int h, HDC s, int sx, int sy, DWORD rop) { return js_BitBlt(d, x, y, w, h, s, sx, sy, rop); }
BOOL     DeleteDC(HDC d)                                { return js_DeleteDC(d); }
BOOL     DeleteObject(HGDIOBJ o)                        { return js_DeleteObject(o); }
HGDIOBJ  SelectObject(HDC d, HGDIOBJ o)                 { return js_SelectObject(d, o); }
HPEN     CreatePen(int s, int w, COLORREF c)            { return js_CreatePen(s, w, c); }
HFONT    CreateFontW(int a,int b,int c,int e,int f,DWORD g,DWORD h,DWORD i,DWORD j,DWORD k,DWORD l,DWORD m,DWORD n,LPCWSTR o) {
    return js_CreateFontW(a, b, c, e, f, g, h, i, j, k, l, m, n, o);
}
BOOL     Polygon(HDC d, const POINT* p, int n)          { return js_Polygon(d, p, n); }
BOOL     Arc(HDC d, int a, int b, int c, int e, int f, int g, int h, int i) { return js_Arc(d, a, b, c, e, f, g, h, i); }
int      SetBkMode(HDC d, int m)                        { return js_SetBkMode(d, m); }
COLORREF SetBkColor(HDC d, COLORREF c)                  { return js_SetBkColor(d, c); }
DWORD    SetLayout(HDC d, DWORD l)                      { return js_SetLayout(d, l); }
DWORD    GetLayout(HDC d)                               { return js_GetLayout(d); }
BOOL     TextOutW(HDC d, int x, int y, LPCWSTR s, int n) { return js_TextOutW(d, x, y, s, n); }
HBRUSH   GetSysColorBrush(int i)                        { return js_GetSysColorBrush(i); }
BOOL     GetTextExtentPoint32W(HDC d, LPCWSTR s, int n, LPSIZE z) { return js_GetTextExtentPoint32W(d, s, n, z); }
