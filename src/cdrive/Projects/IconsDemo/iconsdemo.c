/* iconsdemo.c — обычное Win32-приложение БЕЗ правок под web.
 * Иконки/битмап объявлены в iconsdemo.rc и достаются стандартными LoadIcon/LoadBitmap,
 * рисуются через DrawIcon и BitBlt. wc.hIcon кладёт значок в заголовок окна. */
#include <windows.h>
#include <string.h>

#define IDI_DISC    1
#define IDI_DIAMOND 2
#define IDI_RING    3
#define IDB_SMILEY  10

static HICON   g_ic[3];
static HBITMAP g_bmp;

LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc, mem;
            hdc = BeginPaint(h, &ps);
            TextOut(hdc, 16, 12, "3 icons (.ico) + 1 bitmap (.bmp) from iconsdemo.rc,", 51);
            TextOut(hdc, 16, 28, "embedded in the .wasm, loaded by handle:", 40);
            DrawIcon(hdc, 36, 56, g_ic[0]);
            DrawIcon(hdc, 96, 56, g_ic[1]);
            DrawIcon(hdc, 156, 56, g_ic[2]);
            mem = CreateCompatibleDC(hdc);              /* BitBlt битмапа, как в настоящем Win32 */
            SelectObject(mem, g_bmp);
            BitBlt(hdc, 216, 56, 32, 32, mem, 0, 0, SRCCOPY);
            DeleteDC(mem);
            TextOut(hdc, 24, 98, "LoadIcon x3              LoadBitmap", 35);
            EndPaint(h, &ps);
            return 0;
        }
        case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProc(h, m, w, l);
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmd, int show) {
    static TCHAR cls[] = TEXT("IconsDemo");
    WNDCLASS wc;
    HWND h;
    MSG msg;
    (void)hPrev; (void)cmd;

    memset(&wc, 0, sizeof wc);
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInst;
    wc.hbrBackground = (HBRUSH)GetStockObject(WHITE_BRUSH);
    wc.lpszClassName = cls;
    wc.hIcon         = LoadIcon(hInst, MAKEINTRESOURCE(IDI_DISC));   /* значок окна из .rc */
    RegisterClass(&wc);

    g_ic[0] = LoadIcon(hInst, MAKEINTRESOURCE(IDI_DISC));
    g_ic[1] = LoadIcon(hInst, MAKEINTRESOURCE(IDI_DIAMOND));
    g_ic[2] = LoadIcon(hInst, MAKEINTRESOURCE(IDI_RING));
    g_bmp   = LoadBitmap(hInst, MAKEINTRESOURCE(IDB_SMILEY));

    h = CreateWindow(cls, TEXT("Icons Demo (.rc resources)"), WS_OVERLAPPEDWINDOW,
                     CW_USEDEFAULT, CW_USEDEFAULT, 300, 175, NULL, NULL, hInst, NULL);
    ShowWindow(h, show);
    UpdateWindow(h);

    while (GetMessage(&msg, NULL, 0, 0)) { TranslateMessage(&msg); DispatchMessage(&msg); }
    return (int)msg.wParam;
}
