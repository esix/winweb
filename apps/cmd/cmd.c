/* cmd.c — примитивный, но НАСТОЯЩИЙ Win32-консольный shell. Обычный C: AllocConsole +
 * GetStdHandle + WriteConsoleA + ReadConsoleA (блокирующее чтение строки через JSPI).
 * Команды dir/cd/type ходят в VFS через хост-мост (async -> опрос). Код без веб-правок. */
#include <windows.h>
#include <string.h>
#include <strings.h>     /* strcasecmp */
#include <emscripten.h>  /* EMSCRIPTEN_KEEPALIVE, emscripten_sleep */

extern int  winweb_vfs(int op, const char *path, char *buf, int max);   /* op: 0=dir, 1=type (блок через JSPI) */
extern void winweb_con_clear(int id);
extern int  winweb_exec(const char *path);                              /* 1=запущена .wasm, 2=PE, 0=не найдена */
extern int  winweb_cc(const char *path, int con);                       /* компиляция C->wasm + запуск, вывод в con */

static char g_cwd[300] = "C:\\";
static char g_buf[1 << 16];

static int vfs(int op, const char *path) { return winweb_vfs(op, path, g_buf, sizeof g_buf); }
static void w(HANDLE h, const char *s) { DWORD x; WriteConsoleA(h, s, (DWORD)strlen(s), &x, NULL); }

/* путь аргумента -> абсолютный (относительно g_cwd) */
static void resolve(const char *arg, char *out) {
    if (!arg[0]) { strcpy(out, g_cwd); return; }
    if (arg[1] == ':') { strcpy(out, arg); return; }                      /* C:\... */
    strcpy(out, g_cwd);
    size_t n = strlen(out); if (n && out[n - 1] != '\\') strcat(out, "\\");
    strcat(out, arg);
}

EMSCRIPTEN_KEEPALIVE
int WINAPI WinMain(HINSTANCE hi, HINSTANCE hp, LPSTR cmd, int show) {
    (void)hi; (void)hp; (void)cmd; (void)show;
    AllocConsole();
    SetConsoleTitleA("Command Prompt");
    HANDLE o = GetStdHandle(STD_OUTPUT_HANDLE), in = GetStdHandle(STD_INPUT_HANDLE);
    w(o, "winweb [Version 1.0]\r\n(c) winweb - real Win32 console on WebAssembly.\r\nType HELP for commands.\r\n\r\n");

    char line[512]; DWORD rd;
    for (;;) {
        w(o, g_cwd); w(o, ">");
        if (!ReadConsoleA(in, line, sizeof line - 1, &rd, NULL)) break;   /* консоль закрыта */
        line[rd] = 0;
        char *e = line; while (*e && *e != '\r' && *e != '\n') e++; *e = 0;
        while (*line == ' ') memmove(line, line + 1, strlen(line));       /* ltrim */
        if (!line[0]) continue;
        char *arg = strchr(line, ' ');
        if (arg) { *arg++ = 0; while (*arg == ' ') arg++; } else arg = line + strlen(line);

        if (!strcasecmp(line, "exit")) break;
        else if (!strcasecmp(line, "cls")) winweb_con_clear((int)(intptr_t)o);
        else if (!strcasecmp(line, "echo")) { w(o, arg); w(o, "\r\n"); }
        else if (!strcasecmp(line, "ver")) w(o, "\r\nwinweb Version 1.0\r\n\r\n");
        else if (!strcasecmp(line, "help")) w(o, "DIR  CD  TYPE  ECHO  CLS  VER  CC  HELP  EXIT   (run: name.wasm; compile: cc file.c)\r\n");
        else if (!strcasecmp(line, "cc")) {
            if (!arg[0]) w(o, "usage: cc <file.c>\r\n");
            else { char p[300]; resolve(arg, p); winweb_cc(p, (int)(intptr_t)o); }
        }
        else if (!strcasecmp(line, "dir")) { char p[300]; resolve(arg, p); vfs(0, p); w(o, g_buf); }
        else if (!strcasecmp(line, "type")) { char p[300]; resolve(arg, p); vfs(1, p); w(o, g_buf); w(o, "\r\n"); }
        else if (!strcasecmp(line, "cd") || !strcasecmp(line, "chdir")) {
            if (!arg[0] || !strcmp(arg, ".")) { w(o, g_cwd); w(o, "\r\n"); }
            else if (!strcmp(arg, "..")) { char *s = strrchr(g_cwd, '\\'); if (s && s > g_cwd + 2) *s = 0; else strcpy(g_cwd, "C:\\"); }
            else { char p[300]; resolve(arg, p); strcpy(g_cwd, p); }
        }
        else {                                          /* не встроенная -> пробуем запустить как программу */
            char p[300]; resolve(line, p);
            int r = winweb_exec(p);
            if (r == 2) w(o, "Cannot execute native PE (.exe) - no x86 emulation; only .wasm runs.\r\n");
            else if (r != 1) { w(o, "'"); w(o, line); w(o, "' is not recognized as a command or program.\r\n"); }
        }
    }
    return 0;
}
