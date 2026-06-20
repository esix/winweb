#ifndef _WASM_STDLIB_H
#define _WASM_STDLIB_H
#include <stddef.h>
#define EXIT_SUCCESS 0
#define EXIT_FAILURE 1
void *malloc(size_t);
void  free(void *);
void *calloc(size_t, size_t);
void *realloc(void *, size_t);
void  exit(int);
void  abort(void);
int   atoi(const char *);
int   abs(int);
void  qsort(void *, size_t, size_t, int (*)(const void *, const void *));
long   strtol(const char *, char **, int);
double strtod(const char *, char **);
#endif
