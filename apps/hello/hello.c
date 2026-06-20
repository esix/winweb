/* hello.c — минимальное Win32-приложение. Компилируется lcc-wasm в standalone-модуль
 * (экспортит WinMain + свою память); Win32-символы — импорты, их даёт TS-фасад. */
#include <windows.h>
#include <string.h>      /* memset */

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hwnd, &ps);
        SetTextColor(hdc, RGB(0, 0, 0));
        SetBkMode(hdc, TRANSPARENT);
        TextOut(hdc, 20, 30, "Hello from a WASM DLL!", 22);
        TextOut(hdc, 20, 60, "(loaded at runtime, dynamically linked)", 39);
        EndPaint(hwnd, &ps);
        return 0;
    }
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wp, lp);
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmd, int show) {
    WNDCLASS wc;
    HWND hwnd;
    MSG msg;
    (void)hPrev; (void)cmd;

    memset(&wc, 0, sizeof wc);
    wc.lpfnWndProc   = WndProc;
    wc.lpszClassName = "HelloWin";
    wc.hbrBackground = (HBRUSH)GetStockObject(WHITE_BRUSH);
    wc.hIcon         = LoadIcon(hInst, MAKEINTRESOURCE(1));   /* иконка из hello.rc */
    RegisterClass(&wc);

    hwnd = CreateWindow("HelloWin", "Hello (DLL)", WS_OVERLAPPEDWINDOW,
                        90, 90, 380, 200, NULL, NULL, hInst, NULL);
    ShowWindow(hwnd, show);
    UpdateWindow(hwnd);                       /* ставит WM_PAINT */

    while (GetMessage(&msg, NULL, 0, 0)) {    /* фасад возвращает 0 -> цикл выходит, события идут в WndProc */
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return (int)msg.wParam;
}
