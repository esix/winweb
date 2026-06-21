/* cc.c — консольная утилита winweb: компиляция и запуск ОДНОГО C-файла.
 * Настоящий исполняемый файл C:\Windows\System32\cc.wasm; логика — в JS (winweb_cc),
 * который резолвит путь относительно текущего каталога, компилит (cpp.ts+rcc.wasm) и запускает. */
extern int winweb_args(char *buf, int max);            /* аргументы (имя .c-файла) */
extern int winweb_stdout(void);                         /* id консоли */
extern int winweb_cc(const char *args, int con);        /* резолв + компиляция + запуск */

int main(void) {
    char args[512];
    winweb_args(args, sizeof args);
    return winweb_cc(args, winweb_stdout());
}
