/* cmd_lcc.c — cmd-shell, скомпилированный КОМПИЛЯТОРОМ lcc-wasm (не emscripten).
 *
 * Главное отличие от cmd.c: НЕТ блокирующего цикла. Standalone-wasm без ASYNCIFY/JSPI
 * не может приостановиться и ждать ввод. Поэтому управление инвертировано:
 *   init()          — хост зовёт один раз: AllocConsole + баннер + первый prompt;
 *   process_line()  — хост зовёт на КАЖДУЮ введённую строку (строка лежит в input_buf());
 *   input_buf()     — адрес буфера, куда хост пишет строку перед вызовом process_line().
 * Состояние (g_cwd, g_out) живёт в статиках и сохраняется между вызовами.
 *
 * Строго C89: все объявления — в начале блока. Без libc (string.h здесь инлайновый). */
#include <windows.h>
#include <string.h>

extern int  winweb_vfs(int op, const char *path, char *buf, int max);   /* op: 0=dir, 1=type (РЕЗИДЕНТНЫЙ, синхронно) */
extern void winweb_con_clear(int id);
extern int  winweb_exec(const char *path, const char *args, const char *cwd, int con);   /* найти .wasm (cwd/System32) и запустить с args+cwd */

static char g_cwd[300] = "C:\\";
static char g_buf[1 << 16];
static char g_input[512];
static int  g_out = 0;

char *input_buf(void) { return g_input; }

static int  vfs(int op, const char *path) { return winweb_vfs(op, path, g_buf, sizeof g_buf); }
static void w(int h, const char *s) { DWORD x; WriteConsoleA((HANDLE)h, s, (DWORD)strlen(s), &x, 0); }
static void prompt(void) { w(g_out, g_cwd); w(g_out, ">"); }

/* путь аргумента -> абсолютный (относительно g_cwd) */
static void resolve(const char *arg, char *out) {
    unsigned n;
    if (!arg[0]) { strcpy(out, g_cwd); return; }
    if (arg[1] == ':') { strcpy(out, arg); return; }                    /* C:\... */
    strcpy(out, g_cwd);
    n = strlen(out);
    if (n && out[n - 1] != '\\') strcat(out, "\\");
    strcat(out, arg);
}

void init(void) {
    AllocConsole();
    SetConsoleTitleA("Command Prompt");
    g_out = (int)GetStdHandle(STD_OUTPUT_HANDLE);
    w(g_out, "winweb [Version 1.0]\r\n(c) winweb. Type HELP for commands.\r\n\r\n");
    prompt();
}

void process_line(void) {
    char line[512];
    char p[300];
    char *arg;
    char *e;
    int r;

    strcpy(line, g_input);
    e = line; while (*e && *e != '\r' && *e != '\n') e++; *e = 0;
    while (*line == ' ') memmove(line, line + 1, strlen(line));          /* ltrim */
    if (!line[0]) { prompt(); return; }

    arg = strchr(line, ' ');
    if (arg) { *arg++ = 0; while (*arg == ' ') arg++; } else arg = line + strlen(line);

    if (!strcasecmp(line, "exit")) { w(g_out, "(close the window to exit)\r\n"); }
    else if (!strcasecmp(line, "cls")) { winweb_con_clear(g_out); prompt(); return; }
    else if (!strcasecmp(line, "echo")) { w(g_out, arg); w(g_out, "\r\n"); }
    else if (!strcasecmp(line, "ver")) { w(g_out, "\r\nwinweb Version 1.0 (lcc-wasm)\r\n\r\n"); }
    else if (!strcasecmp(line, "help")) { w(g_out, "DIR CD TYPE ECHO CLS VER HELP EXIT\r\n  <tool> [args]   run a .wasm from the dir or C:\\Windows\\System32  (e.g. cc demo.c, msbuild Hello)\r\n"); }
    else if (!strcasecmp(line, "dir")) { resolve(arg, p); vfs(0, p); w(g_out, g_buf); }
    else if (!strcasecmp(line, "type")) { resolve(arg, p); vfs(1, p); w(g_out, g_buf); w(g_out, "\r\n"); }
    else if (!strcasecmp(line, "cd") || !strcasecmp(line, "chdir")) {
        if (!arg[0] || !strcmp(arg, ".")) { w(g_out, g_cwd); w(g_out, "\r\n"); }
        else if (!strcmp(arg, "..")) { char *s = strrchr(g_cwd, '\\'); if (s && s > g_cwd + 2) *s = 0; else strcpy(g_cwd, "C:\\"); }
        else if (!strcmp(arg, "\\") || !strcmp(arg, "/")) { strcpy(g_cwd, "C:\\"); }   /* в корень диска */
        else { resolve(arg, p); vfs(2, p);                       /* op 2: канонический путь папки (регистронезависимо) или "" */
               if (g_buf[0]) strcpy(g_cwd, g_buf);
               else { w(g_out, "The system cannot find the path specified.\r\n"); } }
    }
    else {                                                              /* не встроенная -> искать .wasm в cwd / C:\Windows\System32 */
        resolve(line, p);
        r = winweb_exec(p, arg, g_cwd, g_out);
        if (r == 2) w(g_out, "Cannot execute native PE (.exe) - no x86 emulation; only .wasm runs.\r\n");
        else if (r != 1) { w(g_out, "'"); w(g_out, line); w(g_out, "' is not recognized as a command or program.\r\n"); }
    }
    prompt();
}
