/* user32.c — winweb "DLL": ЗДЕСЬ определены функции USER32 (окна/сообщения/меню/курсор/иконки/paint).
 * Это настоящий C:\Windows\System32\user32.wasm; приложения импортируют эти функции
 * ОТСЮДА (их exports подставляются в env приложения загрузчиком), а реализация —
 * тонкие трамплины в JS-фасад (js_*). Так показан явный DLL-слой: app -> user32.wasm -> JS. */
#include <windows.h>

extern ATOM     js_RegisterClass(const WNDCLASS*);
extern HWND     js_CreateWindowEx(DWORD, LPCTSTR, LPCTSTR, DWORD, int, int, int, int, HWND, HMENU, HINSTANCE, LPVOID);
extern BOOL     js_ShowWindow(HWND, int);
extern BOOL     js_UpdateWindow(HWND);
extern BOOL     js_GetMessage(LPMSG, HWND, UINT, UINT);
extern BOOL     js_TranslateMessage(const MSG*);
extern LRESULT  js_DispatchMessage(const MSG*);
extern LRESULT  js_DefWindowProc(HWND, UINT, WPARAM, LPARAM);
extern void     js_PostQuitMessage(int);
extern BOOL     js_InvalidateRect(HWND, const RECT*, BOOL);
extern BOOL     js_GetClientRect(HWND, LPRECT);
extern int      js_MessageBox(HWND, LPCTSTR, LPCTSTR, UINT);
extern int      js_GetSystemMetrics(int);
extern BOOL     js_DestroyWindow(HWND);
extern HDC      js_GetDC(HWND);
extern int      js_ReleaseDC(HWND, HDC);
extern HDC      js_BeginPaint(HWND, LPPAINTSTRUCT);
extern BOOL     js_EndPaint(HWND, const PAINTSTRUCT*);
extern BOOL     js_SetWindowText(HWND, LPCSTR);
extern int      js_GetWindowText(HWND, LPSTR, int);
extern UINT_PTR js_SetTimer(HWND, UINT_PTR, UINT, TIMERPROC);
extern BOOL     js_KillTimer(HWND, UINT_PTR);
extern HICON    js_LoadIcon(HINSTANCE, LPCTSTR);
extern HBITMAP  js_LoadBitmap(HINSTANCE, LPCTSTR);
extern HCURSOR  js_LoadCursor(HINSTANCE, LPCTSTR);
extern HCURSOR  js_SetCursor(HCURSOR);
extern int      js_ShowCursor(BOOL);
extern BOOL     js_DrawIcon(HDC, int, int, HICON);
extern BOOL     js_DrawEdge(HDC, LPRECT, UINT, UINT);
extern HMENU    js_CreateMenu(void);
extern HMENU    js_CreatePopupMenu(void);
extern BOOL     js_AppendMenu(HMENU, UINT, UINT_PTR, LPCSTR);
extern BOOL     js_SetMenu(HWND, HMENU);
extern BOOL     js_CheckMenuItem(HMENU, UINT, UINT);
extern UINT     js_GetDlgItemInt(HWND, int, BOOL*, BOOL);
extern int      js_LoadString(HINSTANCE, UINT, LPSTR, int);
extern void     js_ShellAbout(HWND, LPCSTR, LPCSTR, HICON);

ATOM     RegisterClass(const WNDCLASS* wc)      { return js_RegisterClass(wc); }
HWND     CreateWindowEx(DWORD ex, LPCTSTR cls, LPCTSTR name, DWORD style, int x, int y, int w, int h, HWND parent, HMENU menu, HINSTANCE inst, LPVOID param) {
    return js_CreateWindowEx(ex, cls, name, style, x, y, w, h, parent, menu, inst, param);
}
BOOL     ShowWindow(HWND h, int cmd)            { return js_ShowWindow(h, cmd); }
BOOL     UpdateWindow(HWND h)                   { return js_UpdateWindow(h); }
BOOL     GetMessage(LPMSG m, HWND h, UINT a, UINT b) { return js_GetMessage(m, h, a, b); }
BOOL     TranslateMessage(const MSG* m)         { return js_TranslateMessage(m); }
LRESULT  DispatchMessage(const MSG* m)          { return js_DispatchMessage(m); }
LRESULT  DefWindowProc(HWND h, UINT m, WPARAM w, LPARAM l) { return js_DefWindowProc(h, m, w, l); }
void     PostQuitMessage(int code)              { js_PostQuitMessage(code); }
BOOL     InvalidateRect(HWND h, const RECT* r, BOOL e) { return js_InvalidateRect(h, r, e); }
BOOL     GetClientRect(HWND h, LPRECT r)        { return js_GetClientRect(h, r); }
int      MessageBox(HWND h, LPCTSTR t, LPCTSTR c, UINT y) { return js_MessageBox(h, t, c, y); }
int      GetSystemMetrics(int i)                { return js_GetSystemMetrics(i); }
BOOL     DestroyWindow(HWND h)                  { return js_DestroyWindow(h); }
HDC      GetDC(HWND h)                          { return js_GetDC(h); }
int      ReleaseDC(HWND h, HDC d)               { return js_ReleaseDC(h, d); }
HDC      BeginPaint(HWND h, LPPAINTSTRUCT p)    { return js_BeginPaint(h, p); }
BOOL     EndPaint(HWND h, const PAINTSTRUCT* p) { return js_EndPaint(h, p); }
BOOL     SetWindowText(HWND h, LPCSTR s)        { return js_SetWindowText(h, s); }
int      GetWindowText(HWND h, LPSTR s, int n)  { return js_GetWindowText(h, s, n); }
UINT_PTR SetTimer(HWND h, UINT_PTR id, UINT e, TIMERPROC p) { return js_SetTimer(h, id, e, p); }
BOOL     KillTimer(HWND h, UINT_PTR id)         { return js_KillTimer(h, id); }
HICON    LoadIcon(HINSTANCE i, LPCTSTR n)       { return js_LoadIcon(i, n); }
HBITMAP  LoadBitmap(HINSTANCE i, LPCTSTR n)     { return js_LoadBitmap(i, n); }
HCURSOR  LoadCursor(HINSTANCE i, LPCTSTR n)     { return js_LoadCursor(i, n); }
HCURSOR  SetCursor(HCURSOR c)                   { return js_SetCursor(c); }
int      ShowCursor(BOOL b)                     { return js_ShowCursor(b); }
BOOL     DrawIcon(HDC d, int x, int y, HICON i) { return js_DrawIcon(d, x, y, i); }
BOOL     DrawEdge(HDC d, LPRECT r, UINT e, UINT f) { return js_DrawEdge(d, r, e, f); }
HMENU    CreateMenu(void)                       { return js_CreateMenu(); }
HMENU    CreatePopupMenu(void)                  { return js_CreatePopupMenu(); }
BOOL     AppendMenu(HMENU m, UINT f, UINT_PTR id, LPCSTR s) { return js_AppendMenu(m, f, id, s); }
BOOL     SetMenu(HWND h, HMENU m)               { return js_SetMenu(h, m); }
BOOL     CheckMenuItem(HMENU m, UINT id, UINT c) { return js_CheckMenuItem(m, id, c); }
UINT     GetDlgItemInt(HWND h, int id, BOOL* ok, BOOL sg) { return js_GetDlgItemInt(h, id, ok, sg); }
int      LoadString(HINSTANCE i, UINT id, LPSTR s, int n) { return js_LoadString(i, id, s, n); }
void     ShellAbout(HWND h, LPCSTR a, LPCSTR b, HICON ic) { js_ShellAbout(h, a, b, ic); }
