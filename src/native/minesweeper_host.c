/* minesweeper_host.c — тонкий хост вместо minesweeper.c/preferences.c/sound.c.
 * Использует НАСТОЯЩИЕ game.c (логика) и graphics.c (отрисовка) как есть;
 * сам только: создаёт окно, ставит beginner-конфиг, гоняет цикл сообщений,
 * проводит клики в игровой API и WM_PAINT -> PaintWindow.
 */
#include <windows.h>
#include <windowsx.h>
#include <string.h>
#include <emscripten.h>   /* EMSCRIPTEN_KEEPALIVE (SIDE_MODULE: keep WinMain) */
#include "game.h"
#include "graphics.h"
#include "preferences.h"
#include "main.h"

/* глобалы определены в game.c — здесь только ссылаемся и настраиваем */
extern PREF g_GameConfig;
extern INT  g_GridWidth, g_GridHeight, g_WindowWidth, g_WindowHeight;

/* глобалы, которые в оригинале определял minesweeper.c — определяем здесь */
HWND   g_MainWindow;
HANDLE g_AppInstance;
HMENU  g_MenuHandle;
INT    dxpBorder, dypBorder, dypCaption, dypMenu;
INT    g_GameStatus;
BOOL   g_ChordMode;
TCHAR  g_WindowClass[cchNameMax];
TCHAR  szTime[cchNameMax];
TCHAR  szDefaultName[cchNameMax];

/* функции из minesweeper.c / preferences.c / sound.c — заглушки */
VOID PlayGameSound(INT id) { (void)id; }
VOID ResizeGameWindow(INT f) { (void)f; }
VOID ShowNameEntryDialog(VOID) { }
VOID ShowHighScoresDialog(VOID) { }
VOID UpdateMenuStates(VOID) { }

static int g_lbtn = 0;
static int g_facePressed = 0;   /* нажатие пришлось на кнопку-лицо (рестарт) */

/* Хит-тест кнопки-лица: RECT 32×32 по центру сверху — как в RenderControlButton(). */
static BOOL FaceButtonHit(LPARAM lParam) {
    int x = GET_X_LPARAM(lParam);
    int y = GET_Y_LPARAM(lParam);
    int left = (g_WindowWidth - dxButton) / 2;
    return (x >= left && x < left + dxButton &&
            y >= dyTopLed && y < dyTopLed + dyButton);
}

LRESULT CALLBACK MineWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE:
            return 0;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            PaintWindow(hdc);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_LBUTTONDOWN:
            if (FaceButtonHit(lParam)) {            /* кнопка-лицо — ДО конвертации в клетку */
                g_facePressed = 1;
                RefreshControlButton(iButtonDown); /* нажатый вид (рисуется сразу) */
                return 0;
            }
            g_lbtn = 1;
            UpdateCursorPosition(xBoxFromXpos(GET_X_LPARAM(lParam)), yBoxFromYpos(GET_Y_LPARAM(lParam)));
            return 0;
        case WM_MOUSEMOVE:
            if (g_lbtn && (wParam & MK_LBUTTON))
                UpdateCursorPosition(xBoxFromXpos(GET_X_LPARAM(lParam)), yBoxFromYpos(GET_Y_LPARAM(lParam)));
            return 0;
        case WM_LBUTTONUP:
            if (g_facePressed) {                    /* кнопка-лицо — ДО конвертации в клетку */
                g_facePressed = 0;
                if (FaceButtonHit(lParam))
                    InitializeGameBoard();          /* новая игра (сбросит поле + лицо в happy) */
                InvalidateRect(hwnd, NULL, TRUE);   /* перерисовать поле + восстановить лицо */
                return 0;
            }
            g_lbtn = 0;
            HandleLeftButtonRelease();
            UpdateCursorPosition(-2, -2);
            return 0;
        case WM_RBUTTONDOWN:
            ToggleCellMarker(xBoxFromXpos(GET_X_LPARAM(lParam)), yBoxFromYpos(GET_Y_LPARAM(lParam)));
            return 0;
        case WM_TIMER:
            UpdateGameTimer();   /* счётчик идёт; LED-дисплей не обновляется инкрементально — известный баг */
            return 0;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

EMSCRIPTEN_KEEPALIVE
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmd, int show) {
    static TCHAR szClass[] = "Minesweeper";
    WNDCLASS wc;
    HWND hwnd;
    MSG msg;
    (void)hPrev; (void)cmd;

    memset(&wc, 0, sizeof wc);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = MineWndProc;
    wc.hInstance     = hInst;
    wc.hbrBackground = (HBRUSH)GetStockObject(LTGRAY_BRUSH);
    wc.lpszClassName = szClass;
    wc.hIcon         = LoadIcon(hInst, MAKEINTRESOURCE(1));   /* иконка из minesweeper.rc -> заголовок */
    RegisterClass(&wc);

    /* конфигурация Beginner (вместо LoadConfiguration из preferences.c) */
    g_GameConfig.wGameType = wGameBegin;
    g_GameConfig.Width  = 9;
    g_GameConfig.Height = 9;
    g_GameConfig.Mines  = 10;
    g_GameConfig.fMark  = TRUE;
    g_GameConfig.fMenu  = fmenuOff;
    g_GridWidth  = 9;
    g_GridHeight = 9;
    g_WindowWidth  = dxLeftSpace + 9 * dxBlk + dxRightSpace;
    g_WindowHeight = dyGridOff   + 9 * dyBlk + dyBottomSpace;

    hwnd = CreateWindow(szClass, "Minesweeper", WS_OVERLAPPEDWINDOW,
                        CW_USEDEFAULT, CW_USEDEFAULT, g_WindowWidth, g_WindowHeight,
                        NULL, NULL, hInst, NULL);
    g_MainWindow  = hwnd;          /* игра рисует клетки через GetDC(g_MainWindow) */
    g_AppInstance = hInst;

    InitializeGraphics();
    LoadGraphicsFonts();
    InitializeGameBoard();

    ShowWindow(hwnd, show);
    UpdateWindow(hwnd);

    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return (int)msg.wParam;
}
