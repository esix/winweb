/* libc.c - a minimal C library for the lcc-wasm self-hosting target.
 *
 * Compiled to wasm by lcc-wasm itself and amalgamated into rcc.wasm. The only
 * things it cannot do in pure wasm are real I/O and process exit, which it
 * reaches through a tiny host (JS) syscall layer:
 *
 *     long __read (int fd, void *buf, unsigned long n);   // <0 on error, 0 = EOF
 *     long __write(int fd, const void *buf, unsigned long n);
 *     void __exit (int code);
 *
 * Everything else (string/memory/malloc/qsort/stdio glue) is plain C here.
 */
#include <stddef.h>
#include <stdarg.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

extern long __read(int, void *, unsigned long);
extern long __write(int, const void *, unsigned long);
extern void __exit(int);
int errno = 0;

/* ---------------- string / memory ---------------- */
void *memcpy(void *d, const void *s, size_t n) {
	char *dp = d; const char *sp = s;
	while (n--) *dp++ = *sp++;
	return d;
}
void *memmove(void *d, const void *s, size_t n) {
	char *dp = d; const char *sp = s;
	if (dp < sp) while (n--) *dp++ = *sp++;
	else { dp += n; sp += n; while (n--) *--dp = *--sp; }
	return d;
}
void *memset(void *d, int c, size_t n) {
	char *dp = d;
	while (n--) *dp++ = (char)c;
	return d;
}
int memcmp(const void *a, const void *b, size_t n) {
	const unsigned char *x = a, *y = b;
	while (n--) { if (*x != *y) return *x - *y; x++; y++; }
	return 0;
}
size_t strlen(const char *s) { const char *p = s; while (*p) p++; return p - s; }
int strcmp(const char *a, const char *b) {
	while (*a && *a == *b) { a++; b++; }
	return (unsigned char)*a - (unsigned char)*b;
}
int strncmp(const char *a, const char *b, size_t n) {
	while (n && *a && *a == *b) { a++; b++; n--; }
	return n == 0 ? 0 : (unsigned char)*a - (unsigned char)*b;
}
char *strcpy(char *d, const char *s) { char *r = d; while ((*d++ = *s++)) ; return r; }
char *strncpy(char *d, const char *s, size_t n) {
	char *r = d;
	while (n && (*d = *s)) { d++; s++; n--; }
	while (n--) *d++ = 0;
	return r;
}
char *strcat(char *d, const char *s) { char *r = d; while (*d) d++; while ((*d++ = *s++)) ; return r; }
char *strchr(const char *s, int c) {
	for (; *s; s++) if (*s == (char)c) return (char *)s;
	return c == 0 ? (char *)s : NULL;
}
char *strrchr(const char *s, int c) {
	const char *last = NULL;
	for (; *s; s++) if (*s == (char)c) last = s;
	return (char *)(c == 0 ? s : last);
}

/* ---------------- stdlib ---------------- */
/* bump allocator over a fixed heap window in linear memory */
#define HEAP_BASE 0x00200000u    /* 2 MiB: above static data, below the shadow stack */
static unsigned heapp = 0;

void *malloc(size_t n) {
	unsigned p;
	if (heapp == 0) heapp = HEAP_BASE;
	p = (heapp + 7u) & ~7u;        /* 8-byte align */
	heapp = p + (unsigned)n;
	return (void *)p;
}
void free(void *p) { (void)p; }    /* no-op: a single compile run leaks harmlessly */
void *calloc(size_t a, size_t b) { return memset(malloc(a * b), 0, a * b); }
void *realloc(void *p, size_t n) {
	void *q = malloc(n);
	if (p) memcpy(q, p, n);         /* over-copies; fine for a bump allocator */
	return q;
}
void exit(int code) { __exit(code); }
void abort(void) { __exit(134); }
int atoi(const char *s) {
	int n = 0, neg = 0;
	while (*s == ' ' || *s == '\t') s++;
	if (*s == '-') { neg = 1; s++; } else if (*s == '+') s++;
	while (*s >= '0' && *s <= '9') n = n * 10 + (*s++ - '0');
	return neg ? -n : n;
}
int abs(int x) { return x < 0 ? -x : x; }

/* simple insertion-style qsort (stable enough, comparator via function pointer) */
void qsort(void *base, size_t n, size_t sz, int (*cmp)(const void *, const void *)) {
	char *a = base; size_t i, j;
	char tmp[256];
	for (i = 1; i < n; i++)
		for (j = i; j > 0 && cmp(a + (j - 1) * sz, a + j * sz) > 0; j--) {
			memcpy(tmp, a + (j - 1) * sz, sz);
			memcpy(a + (j - 1) * sz, a + j * sz, sz);
			memcpy(a + j * sz, tmp, sz);
		}
}

/* ---------------- stdio ---------------- */
struct __file { int fd; int eof; };
static struct __file _streams[3] = { {0, 0}, {1, 0}, {2, 0} };
FILE *stdin  = (FILE *)&_streams[0];
FILE *stdout = (FILE *)&_streams[1];
FILE *stderr = (FILE *)&_streams[2];

int fgetc(FILE *f) {
	struct __file *s = (struct __file *)f;
	unsigned char c;
	if (__read(s->fd, &c, 1) <= 0) { s->eof = 1; return -1; }
	return c;
}
int getc(FILE *f) { return fgetc(f); }
size_t fread(void *buf, size_t sz, size_t n, FILE *f) {
	struct __file *s = (struct __file *)f;
	long got = __read(s->fd, buf, sz * n);
	if (got <= 0) { s->eof = 1; return 0; }
	return (size_t)got / sz;
}
int fputc(int c, FILE *f) {
	struct __file *s = (struct __file *)f;
	char ch = (char)c;
	__write(s->fd, &ch, 1);
	return c;
}
int putc(int c, FILE *f) { return fputc(c, f); }
int putchar(int c) { return fputc(c, stdout); }
int fputs(const char *str, FILE *f) {
	struct __file *s = (struct __file *)f;
	__write(s->fd, str, strlen(str));
	return 0;
}
int puts(const char *str) { fputs(str, stdout); return fputc('\n', stdout); }
size_t fwrite(const void *buf, size_t sz, size_t n, FILE *f) {
	struct __file *s = (struct __file *)f;
	return (size_t)__write(s->fd, buf, sz * n) / sz;
}
int feof(FILE *f) { return ((struct __file *)f)->eof; }
int fflush(FILE *f) { (void)f; return 0; }
int fclose(FILE *f) { (void)f; return 0; }
FILE *fopen(const char *path, const char *mode) { (void)path; (void)mode; return NULL; }
FILE *freopen(const char *path, const char *mode, FILE *f) { (void)path; (void)mode; return f; }

/* ---------------- printf family (minimal: %d %u %x %s %c %f %%) ---------------- */
static char *fmtu(char *p, unsigned v, unsigned base) {
	char t[16]; int i = 0;
	do { int d = v % base; t[i++] = d < 10 ? '0' + d : 'a' + d - 10; v /= base; } while (v);
	while (i) *p++ = t[--i];
	return p;
}
static int vformat(char *out, const char *fmt, va_list ap) {
	char *p = out;
	for (; *fmt; fmt++) {
		char num[24], *body = num;
		int len = 0, width = 0, zero = 0, i;
		if (*fmt != '%') { *p++ = *fmt; continue; }
		fmt++;
		while (*fmt=='-' || *fmt=='+' || *fmt==' ' || *fmt=='#' || *fmt=='0') {  /* flags */
			if (*fmt == '0') zero = 1;
			fmt++;
		}
		while (*fmt >= '0' && *fmt <= '9') width = width * 10 + (*fmt++ - '0');   /* field width */
		while (*fmt == 'l' || *fmt == 'h') fmt++;   /* length modifiers: long==int==32-bit here */
		switch (*fmt) {
		case 'd': { int v = va_arg(ap, int); char *q = num;
			    if (v < 0) { *q++ = '-'; len = fmtu(q, (unsigned)(-(long)v), 10) - num; }
			    else len = fmtu(q, (unsigned)v, 10) - num; break; }
		case 'u': len = fmtu(num, va_arg(ap, unsigned), 10) - num; break;
		case 'x': len = fmtu(num, va_arg(ap, unsigned), 16) - num; break;
		case 'c': num[0] = (char)va_arg(ap, int); len = 1; break;
		case 's': body = va_arg(ap, char *); len = (int)strlen(body); break;
		case '%': num[0] = '%'; len = 1; break;
		default:  num[0] = '%'; num[1] = *fmt; len = 2; break;
		}
		if (width > len) {                          /* left-pad to field width */
			int extra = width - len;
			char pad = zero ? '0' : ' ';
			if (zero && len > 0 && body[0] == '-') { *p++ = '-'; body++; len--; }
			for (i = 0; i < extra; i++) *p++ = pad;
		}
		for (i = 0; i < len; i++) *p++ = body[i];
	}
	*p = 0;
	return p - out;
}
int vsprintf(char *out, const char *fmt, va_list ap) { return vformat(out, fmt, ap); }
int sprintf(char *out, const char *fmt, ...) {
	va_list ap; int n;
	va_start(ap, fmt);
	n = vformat(out, fmt, ap);
	va_end(ap);
	return n;
}
int fprintf(FILE *f, const char *fmt, ...) {
	char buf[1024]; va_list ap; int n;
	va_start(ap, fmt);
	n = vformat(buf, fmt, ap);
	va_end(ap);
	fwrite(buf, 1, n, f);
	return n;
}
int printf(const char *fmt, ...) {
	char buf[1024]; va_list ap; int n;
	va_start(ap, fmt);
	n = vformat(buf, fmt, ap);
	va_end(ap);
	fwrite(buf, 1, n, stdout);
	return n;
}

/* assert() failure hook (the header's assert macro calls this) */
void __assert(const char *e, const char *file, int line) {
	char b[256]; char *p = b;
	char *s = "assertion failed: "; while (*s) *p++ = *s++;
	while (*e) *p++ = *e++; *p++ = ' '; *p++ = '(';
	while (*file) *p++ = *file++; *p++ = ')'; *p++ = '\n'; *p = 0;
	fputs(b, stderr);
	__exit(134);
}

/* sscanf stub: the bootstrap passes no -metric= overrides, so reporting "no
   fields matched" makes type_init fall back to the default Interface metrics. */
int sscanf(const char *s, const char *fmt, ...) { (void)s; (void)fmt; return 0; }
int vsnprintf(char *out, size_t n, const char *fmt, va_list ap) { (void)n; return vformat(out, fmt, ap); }

/* ---- a few more libc bits lcc needs ---- */
char *fgets(char *s, int n, FILE *f) {
	int i = 0, c;
	while (i < n - 1 && (c = fgetc(f)) != -1) { s[i++] = (char)c; if (c == '\n') break; }
	if (i == 0) return NULL;
	s[i] = 0;
	return s;
}
void rewind(FILE *f) { (void)f; }   /* seek unused at runtime (only the -g stab path) */

long strtol(const char *s, char **end, int base) {
	long n = 0; int neg = 0;
	while (*s == ' ' || *s == '\t' || *s == '\n') s++;
	if (*s == '-') { neg = 1; s++; } else if (*s == '+') s++;
	if (base == 0) {
		if (*s == '0' && (s[1] == 'x' || s[1] == 'X')) { base = 16; s += 2; }
		else if (*s == '0') { base = 8; s++; } else base = 10;
	} else if (base == 16 && *s == '0' && (s[1] == 'x' || s[1] == 'X')) s += 2;
	for (;;) {
		int d;
		if (*s >= '0' && *s <= '9') d = *s - '0';
		else if (*s >= 'a' && *s <= 'z') d = *s - 'a' + 10;
		else if (*s >= 'A' && *s <= 'Z') d = *s - 'A' + 10;
		else break;
		if (d >= base) break;
		n = n * base + d; s++;
	}
	if (end) *end = (char *)s;
	return neg ? -n : n;
}

double strtod(const char *s, char **end) {
	double r = 0.0; int neg = 0;
	while (*s == ' ' || *s == '\t' || *s == '\n') s++;
	if (*s == '-') { neg = 1; s++; } else if (*s == '+') s++;
	while (*s >= '0' && *s <= '9') { r = r * 10.0 + (*s - '0'); s++; }
	if (*s == '.') { double f = 0.1; s++; while (*s >= '0' && *s <= '9') { r += (*s - '0') * f; f *= 0.1; s++; } }
	if (*s == 'e' || *s == 'E') {
		int es = 0, en = 0; s++;
		if (*s == '-') { es = 1; s++; } else if (*s == '+') s++;
		while (*s >= '0' && *s <= '9') { en = en * 10 + (*s - '0'); s++; }
		while (en--) { if (es) r /= 10.0; else r *= 10.0; }
	}
	if (end) *end = (char *)s;
	return neg ? -r : r;
}
