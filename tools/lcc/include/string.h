/* string.h — крошечные C89-реализации строковых функций для lcc-wasm.
 * static -> вкомпилируются прямо в модуль, никакой линковки с libc не нужно.
 * Покрывает ровно то, что зовёт cmd. strcasecmp здесь же (POSIX, не ISO). */
#ifndef WINWEB_LCC_STRING_H
#define WINWEB_LCC_STRING_H

static unsigned wstrlen_(const char *s) { const char *p = s; while (*p) p++; return (unsigned)(p - s); }
static char *wstrcpy_(char *d, const char *s) { char *r = d; while ((*d++ = *s++) != 0) ; return r; }
static char *wstrcat_(char *d, const char *s) { char *r = d; while (*d) d++; while ((*d++ = *s++) != 0) ; return r; }
static char *wstrchr_(const char *s, int c) { while (*s) { if (*s == (char)c) return (char *)s; s++; } return (c == 0) ? (char *)s : 0; }
static char *wstrrchr_(const char *s, int c) { const char *last = 0; do { if (*s == (char)c) last = s; } while (*s++); return (char *)last; }
static int wstrcmp_(const char *a, const char *b) { while (*a && *a == *b) { a++; b++; } return (unsigned char)*a - (unsigned char)*b; }
static void *wmemmove_(void *d, const void *s, unsigned n) { char *dd = (char *)d; const char *ss = (const char *)s; if (dd < ss) while (n--) *dd++ = *ss++; else { dd += n; ss += n; while (n--) *--dd = *--ss; } return d; }
static int wlower_(int c) { return (c >= 'A' && c <= 'Z') ? c + 32 : c; }
static int wstrcasecmp_(const char *a, const char *b) { while (*a && wlower_((unsigned char)*a) == wlower_((unsigned char)*b)) { a++; b++; } return wlower_((unsigned char)*a) - wlower_((unsigned char)*b); }

/* стандартные имена -> наши реализации */
#define strlen      wstrlen_
#define strcpy      wstrcpy_
#define strcat      wstrcat_
#define strchr      wstrchr_
#define strrchr     wstrrchr_
#define strcmp      wstrcmp_
#define memmove     wmemmove_
#define strcasecmp  wstrcasecmp_

#endif
