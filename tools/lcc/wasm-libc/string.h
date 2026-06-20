#ifndef _WASM_STRING_H
#define _WASM_STRING_H
#include <stddef.h>
void *memcpy(void *, const void *, size_t);
void *memmove(void *, const void *, size_t);
void *memset(void *, int, size_t);
int   memcmp(const void *, const void *, size_t);
size_t strlen(const char *);
int   strcmp(const char *, const char *);
int   strncmp(const char *, const char *, size_t);
char *strcpy(char *, const char *);
char *strncpy(char *, const char *, size_t);
char *strcat(char *, const char *);
char *strchr(const char *, int);
char *strrchr(const char *, int);
int   strcasecmp(const char *, const char *);              /* реализованы в libc-extra.c */
int   strncasecmp(const char *, const char *, size_t);
#endif
