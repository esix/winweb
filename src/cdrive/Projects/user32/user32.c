/* user32.c — winweb "DLL": ЗДЕСЬ определены функции USER32 (окна/сообщения).
 * Это настоящий C:\Windows\System32\user32.wasm; приложения импортируют эти функции
 * ОТСЮДА (их exports подставляются в env приложения загрузчиком), а реализация —
 * тонкие трамплины в JS-фасад (js_*). Так показан явный DLL-слой: app -> user32.wasm -> JS. */
#include <windows.h>

extern ATOM    js_RegisterClass(const WNDCLASS*);
extern HWND    js_CreateWindowEx(DWORD, LPCTSTR, LPCTSTR, DWORD, int, int, int, int, HWND, HMENU, HINSTANCE, LPVOID);
extern BOOL    js_ShowWindow(HWND, int);
extern BOOL    js_UpdateWindow(HWND);
extern BOOL    js_GetMessage(LPMSG, HWND, UINT, UINT);
extern BOOL    js_TranslateMessage(const MSG*);
extern LRESULT js_DispatchMessage(const MSG*);
extern LRESULT js_DefWindowProc(HWND, UINT, WPARAM, LPARAM);
extern void    js_PostQuitMessage(int);
extern BOOL    js_InvalidateRect(HWND, const RECT*, BOOL);
extern BOOL    js_GetClientRect(HWND, LPRECT);
extern int     js_MessageBox(HWND, LPCTSTR, LPCTSTR, UINT);
extern int     js_GetSystemMetrics(int);
extern BOOL    js_DestroyWindow(HWND);

ATOM    RegisterClass(const WNDCLASS* wc) { return js_RegisterClass(wc); }
HWND    CreateWindowEx(DWORD ex, LPCTSTR cls, LPCTSTR name, DWORD style, int x, int y, int w, int h, HWND parent, HMENU menu, HINSTANCE inst, LPVOID param) {
    return js_CreateWindowEx(ex, cls, name, style, x, y, w, h, parent, menu, inst, param);
}
BOOL    ShowWindow(HWND h, int cmd)            { return js_ShowWindow(h, cmd); }
BOOL    UpdateWindow(HWND h)                   { return js_UpdateWindow(h); }
BOOL    GetMessage(LPMSG m, HWND h, UINT a, UINT b) { return js_GetMessage(m, h, a, b); }
BOOL    TranslateMessage(const MSG* m)         { return js_TranslateMessage(m); }
LRESULT DispatchMessage(const MSG* m)          { return js_DispatchMessage(m); }
LRESULT DefWindowProc(HWND h, UINT m, WPARAM w, LPARAM l) { return js_DefWindowProc(h, m, w, l); }
void    PostQuitMessage(int code)              { js_PostQuitMessage(code); }
BOOL    InvalidateRect(HWND h, const RECT* r, BOOL e) { return js_InvalidateRect(h, r, e); }
BOOL    GetClientRect(HWND h, LPRECT r)        { return js_GetClientRect(h, r); }
int     MessageBox(HWND h, LPCTSTR t, LPCTSTR c, UINT y) { return js_MessageBox(h, t, c, y); }
int     GetSystemMetrics(int i)                { return js_GetSystemMetrics(i); }
BOOL    DestroyWindow(HWND h)                  { return js_DestroyWindow(h); }
