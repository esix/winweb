/* win32.h — НАСТОЯЩИЙ (минимальный) Win32 API.
 *
 * Это фасад с реальными сигнатурами windows.h: код, написанный под Windows,
 * включает его и компилируется БЕЗ ИЗМЕНЕНИЙ. Реализация (win32_impl.c)
 * проецирует вызовы на DOM-оконный менеджер + Canvas.
 * Сборка ANSI: TCHAR == char.
 */
#ifndef WIN32_SHIM_H
#define WIN32_SHIM_H

#include <stddef.h>
#include <stdint.h>

#define WINAPI
#define CALLBACK
#define CONST const
#ifndef TRUE
#define TRUE 1
#define FALSE 0
#endif

typedef int            BOOL;
typedef unsigned char  BYTE;
typedef unsigned short WORD;
typedef unsigned int   DWORD;
typedef unsigned int   UINT;
typedef long           LONG;
typedef intptr_t       LRESULT;
typedef uintptr_t      WPARAM;
typedef intptr_t       LPARAM;
typedef DWORD          COLORREF;
typedef char           CHAR, TCHAR;
typedef char          *LPSTR, *LPTSTR, *PSTR;
typedef const char    *LPCSTR, *LPCTSTR;
typedef void          *LPVOID;
typedef WORD           ATOM;

typedef void *HANDLE, *HWND, *HINSTANCE, *HDC, *HMENU, *HICON, *HCURSOR, *HBRUSH, *HPEN, *HGDIOBJ;

typedef struct tagPOINT { LONG x, y; } POINT;
typedef struct tagRECT  { LONG left, top, right, bottom; } RECT, *LPRECT;
typedef struct tagMSG {
    HWND hwnd; UINT message; WPARAM wParam; LPARAM lParam; DWORD time; POINT pt;
} MSG, *LPMSG;

typedef LRESULT (CALLBACK *WNDPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagWNDCLASS {
    UINT style; WNDPROC lpfnWndProc; int cbClsExtra, cbWndExtra;
    HINSTANCE hInstance; HICON hIcon; HCURSOR hCursor; HBRUSH hbrBackground;
    LPCTSTR lpszMenuName, lpszClassName;
} WNDCLASS, *LPWNDCLASS;

typedef struct tagPAINTSTRUCT {
    HDC hdc; BOOL fErase; RECT rcPaint; BOOL fRestore, fIncUpdate; BYTE rgbReserved[32];
} PAINTSTRUCT, *LPPAINTSTRUCT;

#define RGB(r,g,b) ((COLORREF)((BYTE)(r) | ((BYTE)(g)<<8) | ((BYTE)(b)<<16)))

#define CS_VREDRAW 0x0001
#define CS_HREDRAW 0x0002
#define WS_OVERLAPPEDWINDOW 0x00CF0000
#define CW_USEDEFAULT ((int)0x80000000)
#define SW_SHOW 5
#define SW_SHOWNORMAL 1

#define WM_CREATE      0x0001
#define WM_DESTROY     0x0002
#define WM_SIZE        0x0005
#define WM_PAINT       0x000F
#define WM_CLOSE       0x0010
#define WM_QUIT        0x0012
#define WM_LBUTTONDOWN 0x0201
#define WM_MOUSEMOVE   0x0200

#define WHITE_BRUSH 0
#define GRAY_BRUSH  2
#define BLACK_BRUSH 4
#define IDI_APPLICATION ((LPCTSTR)32512)
#define IDC_ARROW       ((LPCTSTR)32512)

#define LOWORD(l) ((WORD)((DWORD)(l) & 0xffff))
#define HIWORD(l) ((WORD)(((DWORD)(l) >> 16) & 0xffff))

/* user32 */
ATOM    RegisterClass(const WNDCLASS*);
HWND    CreateWindowEx(DWORD exStyle, LPCTSTR cls, LPCTSTR name, DWORD style,
                       int x, int y, int w, int h, HWND parent, HMENU menu, HINSTANCE inst, LPVOID param);
#define CreateWindow(cls,name,style,x,y,w,h,parent,menu,inst,param) \
        CreateWindowEx(0,cls,name,style,x,y,w,h,parent,menu,inst,param)
BOOL    ShowWindow(HWND, int);
BOOL    UpdateWindow(HWND);
BOOL    GetMessage(LPMSG, HWND, UINT, UINT);
BOOL    TranslateMessage(const MSG*);
LRESULT DispatchMessage(const MSG*);
LRESULT DefWindowProc(HWND, UINT, WPARAM, LPARAM);
void    PostQuitMessage(int);
BOOL    InvalidateRect(HWND, const RECT*, BOOL);
BOOL    GetClientRect(HWND, LPRECT);
HICON   LoadIcon(HINSTANCE, LPCTSTR);
HCURSOR LoadCursor(HINSTANCE, LPCTSTR);

/* gdi32 */
HDC      BeginPaint(HWND, LPPAINTSTRUCT);
BOOL     EndPaint(HWND, const PAINTSTRUCT*);
HGDIOBJ  GetStockObject(int);
HBRUSH   CreateSolidBrush(COLORREF);
int      FillRect(HDC, const RECT*, HBRUSH);
BOOL     Rectangle(HDC, int, int, int, int);
BOOL     Ellipse(HDC, int, int, int, int);
COLORREF SetTextColor(HDC, COLORREF);
BOOL     TextOut(HDC, int x, int y, LPCTSTR, int len);

#endif
