/* example.c — реальный C, компилируемый lcc-wasm под node (без emscripten).
 * Хост даёт только putchar(); никакого libc/#include (пока нет cpp).
 * ВАЖНО: LCC = строгий C89 — все объявления в НАЧАЛЕ блока (никаких mixed decls). */
int putchar(int c);

void puts2(char *s) { while (*s) putchar(*s++); }

void putint(int n) {
    char buf[16];
    int i = 0;
    if (n < 0) { putchar('-'); n = -n; }
    if (n == 0) { putchar('0'); return; }
    while (n) { buf[i++] = '0' + n % 10; n /= 10; }
    while (i) putchar(buf[--i]);
}

int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

struct P { int x; int y; };

int main(void) {
    int i;
    struct P p;
    puts2("lcc-wasm running inside winweb!\n");
    puts2("fib: ");
    for (i = 0; i < 12; i++) { putint(fib(i)); putchar(' '); }
    putchar('\n');
    p.x = 3; p.y = 4;
    puts2("struct p.x*p.y = ");
    putint(p.x * p.y);
    putchar('\n');
    return 0;
}
