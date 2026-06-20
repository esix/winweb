#ifndef _WASM_STDIO_H
#define _WASM_STDIO_H
#include <stddef.h>
#include <stdarg.h>
typedef struct __file FILE;
extern FILE *stdin, *stdout, *stderr;
#define EOF (-1)
#define SEEK_SET 0
FILE *fopen(const char *, const char *);
FILE *freopen(const char *, const char *, FILE *);
int   fclose(FILE *);
size_t fread(void *, size_t, size_t, FILE *);
size_t fwrite(const void *, size_t, size_t, FILE *);
int   fgetc(FILE *);
int   getc(FILE *);
int   fputc(int, FILE *);
int   putc(int, FILE *);
int   putchar(int);
int   fputs(const char *, FILE *);
int   puts(const char *);
int   feof(FILE *);
int   fflush(FILE *);
int   sprintf(char *, const char *, ...);
int   printf(const char *, ...);
int   fprintf(FILE *, const char *, ...);
int   sscanf(const char *, const char *, ...);
char *fgets(char *, int, FILE *);
void  rewind(FILE *);
int   vsnprintf(char *, size_t, const char *, va_list);
int   vsprintf(char *, const char *, va_list);
#endif
