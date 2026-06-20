/* sample.c — ОБЫЧНОЕ Win32-приложение (стиль Петцольда).
 *
 * Здесь нет ничего «вебового»: только windows.h. Тот же код собрался бы MSVC/MinGW
 * под настоящую Windows. Наш фасад (win32.h + win32_impl.c) даёт ему работать в браузере
 * без единого изменения: WinMain, RegisterClass, CreateWindow, цикл GetMessage, WndProc.
 */
#include "win32.h"
#include <stdio.h>
#include <string.h>

static int g_clicks = 0;
static int g_cx = -1, g_cy = -1;

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmdLine, int cmdShow) {
    static char szClass[] = "Win32WebSample";
    WNDCLASS wc;
    HWND hwnd;
    MSG msg;
    (void)hPrev; (void)cmdLine;

    memset(&wc, 0, sizeof wc);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInst;
    wc.hIcon         = LoadIcon(NULL, IDI_APPLICATION);
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(WHITE_BRUSH);
    wc.lpszClassName = szClass;
    RegisterClass(&wc);

    hwnd = CreateWindow(szClass, "Win32 \xE2\x86\x92 Web (unmodified source)", WS_OVERLAPPEDWINDOW,
                        CW_USEDEFAULT, CW_USEDEFAULT, 440, 300, NULL, NULL, hInst, NULL);
    ShowWindow(hwnd, cmdShow);
    UpdateWindow(hwnd);

    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return (int)msg.wParam;
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    HDC hdc;
    PAINTSTRUCT ps;
    RECT rc;
    char buf[64];
    (void)wParam;

    switch (msg) {
    case WM_LBUTTONDOWN:
        g_cx = LOWORD(lParam);
        g_cy = HIWORD(lParam);
        g_clicks++;
        InvalidateRect(hwnd, NULL, TRUE);
        return 0;

    case WM_PAINT:
        hdc = BeginPaint(hwnd, &ps);
        GetClientRect(hwnd, &rc);

        SetTextColor(hdc, RGB(0, 0, 128));
        TextOut(hdc, 16, 16, "Hello from unmodified Win32 source!", 35);

        sprintf(buf, "Clicks: %d   (click anywhere)", g_clicks);
        SetTextColor(hdc, RGB(0, 0, 0));
        TextOut(hdc, 16, 40, buf, (int)strlen(buf));

        { RECT r2 = { 16, 70, 210, 120 };
          HBRUSH br = CreateSolidBrush(RGB(0, 128, 128));
          FillRect(hdc, &r2, br); }
        Rectangle(hdc, 16, 70, 210, 120);

        if (g_cx >= 0)
            Ellipse(hdc, g_cx - 14, g_cy - 14, g_cx + 14, g_cy + 14);

        EndPaint(hwnd, &ps);
        return 0;

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}
