/* greet.c — пример КОНСОЛЬНОГО приложения (экспортит main).
 * Собирается (msbuild greet) и запускается из консоли по имени (greet)
 * или двойным кликом в Проводнике по C:\Windows\System32\greet.wasm (откроется консоль).
 * Демонстрирует printf, чтение строки и выход (exit).
 *
 * Однопоточный wasm не даёт блокирующего gets(), поэтому ввод СОБЫТИЙНЫЙ:
 *   main()       — печатает приветствие и приглашение (один раз);
 *   input_buf()  — адрес буфера, куда хост кладёт введённую строку;
 *   on_line()    — хост зовёт на КАЖДУЮ введённую строку (по Enter).
 * Выход: команда "exit"/"quit" -> exit() закрывает окно консоли (или просто закрыть окно). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char g_line[256];

char *input_buf(void) { return g_line; }   /* хост пишет сюда строку перед on_line() */

int main(void) {
    printf("Hello, World!\n");
    printf("What is your name? ");
    return 0;
}

void on_line(void) {
    char *e = g_line;
    while (*e && *e != '\r' && *e != '\n') e++;
    *e = 0;                                          /* отрезать перевод строки */
    if (!strcasecmp(g_line, "exit") || !strcasecmp(g_line, "quit")) {
        printf("Bye!\n");
        exit(0);                                     /* -> закрывает окно консоли */
    }
    if (g_line[0])
        printf("Nice to meet you, %s!\n", g_line);
    printf("Type a name, or \"exit\" to quit.\n> ");
}
