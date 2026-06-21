/* msbuild.c — консольная утилита winweb. Это НАСТОЯЩИЙ исполняемый файл
 * C:\Windows\System32\msbuild.wasm: вся логика сборки .vcxproj-проекта — в JS
 * (winweb_msbuild), а это лишь тонкая C-обёртка, как и положено exe-инструменту. */
extern int winweb_args(char *buf, int max);            /* аргументы командной строки (от хоста) */
extern int winweb_stdout(void);                         /* id консоли, в которую писать */
extern int winweb_msbuild(const char *args, int con);   /* распарсить .vcxproj, собрать, запустить */

int main(void) {
    char args[512];
    winweb_args(args, sizeof args);
    return winweb_msbuild(args, winweb_stdout());
}
