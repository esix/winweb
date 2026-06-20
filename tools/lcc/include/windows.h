/* windows.h — МИНИМАЛЬНЫЙ C89-чистый Win32-сабсет для компилятора lcc-wasm.
 * Это НЕ полный фасадный заголовок из ../../include (там wide-char/stdint/commctrl,
 * которые строгий C89/LCC не переварит). Здесь — ровно консольная поверхность cmd.
 * Функции объявлены без тел -> lcc эмитит (import "env" ...); их даёт TS-рантайм. */
#ifndef WINWEB_LCC_WINDOWS_H
#define WINWEB_LCC_WINDOWS_H

#define WINAPI
#define CALLBACK

typedef int            BOOL;
typedef unsigned int   DWORD;
typedef unsigned int   UINT;
typedef int            HANDLE;        /* у нас дескриптор = просто id консоли (i32) */
typedef void          *HINSTANCE;
typedef char          *LPSTR;
typedef const char    *LPCSTR;
typedef DWORD         *LPDWORD;
typedef void          *LPVOID;

#define TRUE  1
#define FALSE 0
#define STD_INPUT_HANDLE  (-10)
#define STD_OUTPUT_HANDLE (-11)
#define STD_ERROR_HANDLE  (-12)

/* консольный API — реализуется TS-рантаймом winweb (env-импорты) */
BOOL   AllocConsole(void);
BOOL   SetConsoleTitleA(LPCSTR title);
HANDLE GetStdHandle(DWORD which);
BOOL   WriteConsoleA(HANDLE h, LPCSTR buf, DWORD len, LPDWORD written, LPVOID reserved);

#endif
