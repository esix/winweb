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

static int lc_(int c) { return (c >= 'A' && c <= 'Z') ? c + 32 : c; }
int strcasecmp(const char *a, const char *b) {
    int ca, cb;
    for (;;) {
        ca = lc_((unsigned char)*a++); cb = lc_((unsigned char)*b++);
        if (ca != cb) return ca - cb;
        if (!ca) return 0;
    }
}
int strncasecmp(const char *a, const char *b, unsigned long n) {
    int ca, cb;
    while (n--) {
        ca = lc_((unsigned char)*a++); cb = lc_((unsigned char)*b++);
        if (ca != cb) return ca - cb;
        if (!ca) return 0;
    }
    return 0;
}
