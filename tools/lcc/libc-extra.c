/* libc-extra.c — функции libc, которых нет в lcc lib/wasm/libc.c.
 * Амальгамируется СРАЗУ ПОСЛЕ libc.c (vsnprintf, va_list уже в области видимости). */

int snprintf(char *out, unsigned long n, const char *fmt, ...) {
    va_list ap;
    int r;
    va_start(ap, fmt);
    r = vsnprintf(out, n, fmt, ap);
    va_end(ap);
    return r;
}
