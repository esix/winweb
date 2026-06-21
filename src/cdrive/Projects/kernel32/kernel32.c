/* kernel32.c — winweb "DLL": ЗДЕСЬ определены системные функции (консоль/время).
 * Настоящий C:\Windows\System32\kernel32.wasm; приложения зовут эти функции отсюда,
 * а реализация — тонкие трамплины в JS-фасад (js_*). Как user32/gdi32, но для kernel32. */
#include <windows.h>

extern BOOL      js_AllocConsole(void);
extern HANDLE    js_GetStdHandle(DWORD);
extern ULONGLONG js_GetTickCount64(void);
extern BOOL      js_ReadConsoleA(HANDLE, void*, DWORD, DWORD*, void*);
extern BOOL      js_SetConsoleTitleA(LPCSTR);
extern BOOL      js_WriteConsoleA(HANDLE, const void*, DWORD, DWORD*, void*);

BOOL      AllocConsole(void)                     { return js_AllocConsole(); }
HANDLE    GetStdHandle(DWORD n)                  { return js_GetStdHandle(n); }
ULONGLONG GetTickCount64(void)                   { return js_GetTickCount64(); }
BOOL      ReadConsoleA(HANDLE h, void* b, DWORD n, DWORD* r, void* x)  { return js_ReadConsoleA(h, b, n, r, x); }
BOOL      SetConsoleTitleA(LPCSTR s)            { return js_SetConsoleTitleA(s); }
BOOL      WriteConsoleA(HANDLE h, const void* b, DWORD n, DWORD* w, void* x) { return js_WriteConsoleA(h, b, n, w, x); }
