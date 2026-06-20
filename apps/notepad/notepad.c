/* notepad.c — настоящий Win32-Блокнот.
 *
 * Окно + дочерний многострочный EDIT (→ нативный <textarea>) + кнопка Save.
 * Текст файла приходит при запуске (host_launch_text), сохраняется обратно в
 * VFS (host_save_file). Это обычный Win32-код; «вебового» здесь — только
 * три внешних хелпера-моста, предоставляемых рантаймом winweb.
 */
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>

/* мост winweb (реализован в win32_impl.c через EM_JS) */
extern int  host_launch_text(char *buf, int max);
extern int  host_launch_path(char *buf, int max);
extern void host_save_file(const char *path, const char *text);
extern int  host_prompt(const char *title, const char *def, char *buf, int max);
extern void host_load(int edit, const char *path);   /* асинхронно грузит файл в EDIT */

#define ID_EDIT   100
#define ID_NEW    200
#define ID_OPEN   201
#define ID_SAVE   202
#define ID_SAVEAS 203
#define ID_EXIT   204

static HWND g_edit;
static char g_path[300];
static char g_buf[1 << 20];   /* до 1 МБ текста */

LRESULT CALLBACK NotepadProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            RECT rc;
            HMENU bar, file;
            int n;
            GetClientRect(hwnd, &rc);
            bar  = CreateMenu();
            file = CreatePopupMenu();
            AppendMenu(file, MF_STRING, ID_NEW,    "New");
            AppendMenu(file, MF_STRING, ID_OPEN,   "Open...");
            AppendMenu(file, MF_STRING, ID_SAVE,   "Save");
            AppendMenu(file, MF_STRING, ID_SAVEAS, "Save As...");
            AppendMenu(file, MF_SEPARATOR, 0, NULL);
            AppendMenu(file, MF_STRING, ID_EXIT,   "Exit");
            AppendMenu(bar, MF_POPUP, (UINT_PTR)file, "File");
            SetMenu(hwnd, bar);
            g_edit = CreateWindow("EDIT", "",
                         WS_CHILD | WS_VISIBLE | WS_VSCROLL | ES_MULTILINE | ES_AUTOVSCROLL,
                         0, 0, rc.right, rc.bottom, hwnd, (HMENU)ID_EDIT, NULL, NULL);
            n = host_launch_text(g_buf, sizeof g_buf);
            g_buf[n] = 0;
            SetWindowText(g_edit, g_buf);
            host_launch_path(g_path, sizeof g_path);
            return 0;
        }
        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case ID_NEW:
                    g_path[0] = 0;
                    SetWindowText(g_edit, "");
                    break;
                case ID_OPEN:
                    if (host_prompt("Open file:", "C:\\Projects\\", g_path, sizeof g_path) > 0)
                        host_load((int)(intptr_t)g_edit, g_path);   /* g_path задан -> Save потом верный */
                    break;
                case ID_SAVE:
                    GetWindowText(g_edit, g_buf, sizeof g_buf);
                    host_save_file(g_path, g_buf);
                    break;
                case ID_SAVEAS:
                    if (host_prompt("Save as:", g_path, g_path, sizeof g_path) > 0) {
                        GetWindowText(g_edit, g_buf, sizeof g_buf);
                        host_save_file(g_path, g_buf);
                    }
                    break;
                case ID_EXIT:
                    DestroyWindow(hwnd);
                    break;
            }
            return 0;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmdLine, int cmdShow) {
    static TCHAR szClass[] = TEXT("WinwebNotepad");
    WNDCLASS wc;
    HWND hwnd;
    MSG msg;
    char path[300], title[340];
    (void)hPrev; (void)cmdLine;

    host_launch_path(path, sizeof path);
    snprintf(title, sizeof title, "Notepad - %s", path[0] ? path : "untitled");

    memset(&wc, 0, sizeof wc);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = NotepadProc;
    wc.hInstance     = hInst;
    wc.hbrBackground = (HBRUSH)GetStockObject(LTGRAY_BRUSH);
    wc.lpszClassName = szClass;
    RegisterClass(&wc);

    hwnd = CreateWindow(szClass, title, WS_OVERLAPPEDWINDOW,
                        CW_USEDEFAULT, CW_USEDEFAULT, 500, 380, NULL, NULL, hInst, NULL);
    ShowWindow(hwnd, cmdShow);
    UpdateWindow(hwnd);

    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return (int)msg.wParam;
}
