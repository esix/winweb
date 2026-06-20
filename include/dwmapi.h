/* dwmapi.h — минимальный стаб (оконные украшения Win11 в браузере не нужны). */
#ifndef WINWEB_DWMAPI_H
#define WINWEB_DWMAPI_H
#include <windows.h>
typedef LONG HRESULT;
#define DWMWA_WINDOW_CORNER_PREFERENCE 33
#define DWMWA_SYSTEMBACKDROP_TYPE 38
HRESULT DwmSetWindowAttribute(HWND, DWORD, const void*, DWORD);
#endif
