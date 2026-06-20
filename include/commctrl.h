/* commctrl.h — минимальный стаб (common controls не нужны: контролы у нас нативные). */
#ifndef WINWEB_COMMCTRL_H
#define WINWEB_COMMCTRL_H
#include <windows.h>
typedef struct { DWORD dwSize; DWORD dwICC; } INITCOMMONCONTROLSEX, *LPINITCOMMONCONTROLSEX;
#define ICC_STANDARD_CLASSES 0x00004000
BOOL InitCommonControlsEx(const INITCOMMONCONTROLSEX*);
#endif
