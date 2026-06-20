/* windows.h — минимальный Win32 на include-пути.
 * Чужой исходник делает #include <windows.h> и собирается БЕЗ ПРАВОК.
 * Реализация — win32_impl.c (проекция на DOM-WM + Canvas). Сборка ANSI.
 */
#ifndef WINWEB_WINDOWS_H
#define WINWEB_WINDOWS_H

#include <stddef.h>
#include <stdint.h>

#define WINAPI
#define CALLBACK
#define CONST const
#ifndef TRUE
#define TRUE 1
#define FALSE 0
#endif
#define TEXT(x) x

typedef int            BOOL;
typedef unsigned char  BYTE;
typedef unsigned short WORD;
typedef unsigned int   DWORD;
typedef unsigned int   UINT;
typedef long           LONG;
typedef void           VOID;
typedef int            INT;
typedef short          SHORT;
typedef unsigned char  UCHAR;
typedef unsigned short USHORT;
typedef unsigned long  ULONG;
typedef float          FLOAT;
typedef uintptr_t      UINT_PTR;
typedef intptr_t       INT_PTR;
typedef intptr_t       LRESULT;
typedef uintptr_t      WPARAM;
typedef intptr_t       LPARAM;
typedef DWORD          COLORREF;
typedef char           CHAR, TCHAR;
typedef char          *LPSTR, *LPTSTR, *PSTR;
typedef const char    *LPCSTR, *LPCTSTR;
typedef void          *LPVOID;
typedef WORD           ATOM;

typedef void *HANDLE, *HWND, *HINSTANCE, *HDC, *HMENU, *HICON, *HCURSOR, *HBRUSH, *HPEN, *HGDIOBJ, *HBITMAP, *HFONT;
typedef wchar_t WCHAR;
typedef WCHAR *LPWSTR;
typedef const WCHAR *LPCWSTR;
typedef struct tagSIZE { LONG cx, cy; } SIZE, *LPSIZE;

typedef struct tagPOINT { LONG x, y; } POINT, *LPPOINT;
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
#define LOWORD(l) ((WORD)((DWORD)(l) & 0xffff))
#define HIWORD(l) ((WORD)(((DWORD)(l) >> 16) & 0xffff))
#define FAR
#define NEAR
#define PASCAL
#ifndef max
#define max(a,b) (((a) > (b)) ? (a) : (b))
#define min(a,b) (((a) < (b)) ? (a) : (b))
#endif
#define MAKEINTRESOURCE(i) ((LPCTSTR)(uintptr_t)(WORD)(i))

#define CS_VREDRAW 0x0001
#define CS_HREDRAW 0x0002
#define WS_OVERLAPPEDWINDOW 0x00CF0000
#define WS_CHILD       0x40000000
#define WS_VISIBLE     0x10000000
#define WS_VSCROLL     0x00200000
#define WS_HSCROLL     0x00100000
#define WS_BORDER      0x00800000
#define ES_MULTILINE   0x0004
#define ES_AUTOVSCROLL 0x0040
#define ES_AUTOHSCROLL 0x0080
#define ES_READONLY    0x0800
#define BS_PUSHBUTTON  0x0000
#define CW_USEDEFAULT ((int)0x80000000)
#define SW_SHOW 5
#define SW_SHOWNORMAL 1

#define WM_CREATE      0x0001
#define WM_DESTROY     0x0002
#define WM_SIZE        0x0005
#define WM_PAINT       0x000F
#define WM_CLOSE       0x0010
#define WM_COMMAND     0x0111
#define WM_TIMER       0x0113
#define WM_QUIT        0x0012
#define WM_MOUSEMOVE   0x0200
#define WM_LBUTTONDOWN 0x0201
#define WM_LBUTTONUP   0x0202
#define WM_RBUTTONDOWN 0x0204
#define WM_RBUTTONUP   0x0205

#define MK_LBUTTON 0x0001
#define MK_RBUTTON 0x0002

#define WHITE_BRUSH 0
#define GRAY_BRUSH  2
#define BLACK_BRUSH 4
#define IDI_APPLICATION ((LPCTSTR)32512)
#define IDC_ARROW       ((LPCTSTR)32512)
#define IDC_WAIT        ((LPCTSTR)32514)
#define MB_ICONERROR 0x00000010
#define MB_OK        0x00000000

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
HBITMAP LoadBitmap(HINSTANCE, LPCTSTR);
BOOL    DrawIcon(HDC, int, int, HICON);
HCURSOR LoadCursor(HINSTANCE, LPCTSTR);
HCURSOR SetCursor(HCURSOR);
int     ShowCursor(BOOL);
int     MessageBox(HWND, LPCTSTR text, LPCTSTR caption, UINT type);
BOOL    SetWindowText(HWND, LPCSTR);
int     GetWindowText(HWND, LPSTR, int);
HDC     GetDC(HWND);
int     ReleaseDC(HWND, HDC);
typedef VOID (CALLBACK *TIMERPROC)(HWND, UINT, UINT_PTR, DWORD);
UINT_PTR SetTimer(HWND, UINT_PTR, UINT, TIMERPROC);
BOOL     KillTimer(HWND, UINT_PTR);

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
COLORREF SetPixel(HDC, int x, int y, COLORREF);
BOOL     MoveToEx(HDC, int x, int y, LPPOINT old);
BOOL     LineTo(HDC, int x, int y);

/* --- extra GDI/system constants --- */
#define SRCCOPY 0x00CC0020
#define PS_SOLID 0
#define TRANSPARENT 1
#define OPAQUE 2
#define BDR_RAISEDOUTER 0x0001
#define BDR_SUNKENOUTER 0x0002
#define BDR_RAISEDINNER 0x0004
#define BDR_SUNKENINNER 0x0008
#define EDGE_RAISED 0x0005
#define EDGE_SUNKEN 0x000A
#define EDGE_ETCHED 0x0006
#define EDGE_BUMP   0x0009
#define BF_LEFT 0x0001
#define BF_TOP 0x0002
#define BF_RIGHT 0x0004
#define BF_BOTTOM 0x0008
#define BF_RECT 0x000F
#define BF_MIDDLE 0x0800
#define BF_ADJUST 0x2000
#define FW_NORMAL 400
#define FW_BOLD 700
#define DEFAULT_CHARSET 1
#define OUT_DEFAULT_PRECIS 0
#define CLIP_DEFAULT_PRECIS 0
#define DEFAULT_QUALITY 0
#define CLEARTYPE_QUALITY 5
#define ANTIALIASED_QUALITY 4
#define DEFAULT_PITCH 0
#define VARIABLE_PITCH 2
#define FF_DONTCARE 0
#define FF_SWISS 0x20
#define SM_CXSCREEN 0
#define SM_CYSCREEN 1
#define SM_CYCAPTION 4
#define SM_CXBORDER 5
#define SM_CYBORDER 6
#define SM_CYMENU 15
#define MB_ICONHAND 0x0010
#define MF_BYCOMMAND 0x0000
#define MF_CHECKED 0x0008
#define MF_UNCHECKED 0x0000
#define MF_STRING 0x0000
#define MF_POPUP 0x0010
#define MF_SEPARATOR 0x0800
#define LAYOUT_RTL 1
/* stock pens (6-8) + extra brushes */
#define WHITE_PEN 6
#define BLACK_PEN 7
#define NULL_PEN  8
#define LTGRAY_BRUSH 1
#define DKGRAY_BRUSH 3
#define NULL_BRUSH 5
#define HOLLOW_BRUSH 5
#define DC_BRUSH 18
#define DC_PEN 19
/* system colors */
#define COLOR_WINDOW 5
#define COLOR_WINDOWTEXT 8
#define COLOR_BTNFACE 15
#define COLOR_3DFACE 15
/* font pitch/family/weight */
#define FIXED_PITCH 1
#define FF_MODERN 0x30
#define FW_SEMIBOLD 600
#define FW_HEAVY 900

typedef unsigned long long ULONGLONG;

/* --- more gdi32 --- */
HDC      CreateCompatibleDC(HDC);
HBITMAP  CreateCompatibleBitmap(HDC, int, int);
BOOL     BitBlt(HDC, int, int, int, int, HDC, int, int, DWORD);
BOOL     DeleteDC(HDC);
BOOL     DeleteObject(HGDIOBJ);
HGDIOBJ  SelectObject(HDC, HGDIOBJ);
HPEN     CreatePen(int, int, COLORREF);
HFONT    CreateFontW(int,int,int,int,int,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,LPCWSTR);
BOOL     DrawEdge(HDC, LPRECT, UINT, UINT);
BOOL     Polygon(HDC, const POINT*, int);
BOOL     Arc(HDC, int, int, int, int, int, int, int, int);
int      SetBkMode(HDC, int);
COLORREF SetBkColor(HDC, COLORREF);
DWORD    SetLayout(HDC, DWORD);
DWORD    GetLayout(HDC);
BOOL     TextOutW(HDC, int, int, LPCWSTR, int);
HBRUSH   GetSysColorBrush(int);
BOOL     GetTextExtentPoint32W(HDC, LPCWSTR, int, LPSIZE);

/* --- user32/system extras (utilities.c stubs) --- */
int       GetSystemMetrics(int);
ULONGLONG GetTickCount64(void);
BOOL      CheckMenuItem(HMENU, UINT, UINT);
BOOL      SetMenu(HWND, HMENU);
HMENU     CreateMenu(void);
HMENU     CreatePopupMenu(void);
BOOL      AppendMenu(HMENU, UINT, UINT_PTR, LPCSTR);
BOOL      DestroyWindow(HWND);

/* --- консоль --- */
#define STD_INPUT_HANDLE  ((DWORD)-10)
#define STD_OUTPUT_HANDLE ((DWORD)-11)
#define STD_ERROR_HANDLE  ((DWORD)-12)
BOOL      AllocConsole(void);
HANDLE    GetStdHandle(DWORD);
BOOL      WriteConsoleA(HANDLE, const void*, DWORD, DWORD*, void*);
BOOL      ReadConsoleA(HANDLE, void*, DWORD, DWORD*, void*);
BOOL      SetConsoleTitleA(LPCSTR);
UINT      GetDlgItemInt(HWND, int, BOOL*, BOOL);
int       LoadString(HINSTANCE, UINT, LPSTR, int);
void      ShellAbout(HWND, LPCSTR, LPCSTR, HICON);

/* --- RECT helpers (inline) --- */
static inline void SetRect(LPRECT r, int l, int t, int rr, int b) { r->left=l; r->top=t; r->right=rr; r->bottom=b; }
static inline void InflateRect(LPRECT r, int dx, int dy) { r->left-=dx; r->top-=dy; r->right+=dx; r->bottom+=dy; }
static inline void OffsetRect(LPRECT r, int dx, int dy) { r->left+=dx; r->right+=dx; r->top+=dy; r->bottom+=dy; }

#endif
