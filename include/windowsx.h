/* windowsx.h — минимальный стаб (макросы-хелперы). */
#ifndef WINWEB_WINDOWSX_H
#define WINWEB_WINDOWSX_H
#include <windows.h>
#define GET_X_LPARAM(lp) ((int)(short)LOWORD(lp))
#define GET_Y_LPARAM(lp) ((int)(short)HIWORD(lp))
#endif
