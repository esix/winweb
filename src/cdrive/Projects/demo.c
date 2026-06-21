/* demo.c - real C89, compiled in-browser by lcc-wasm:  cc demo.c
   Full libc (printf/malloc/string) is amalgamated in. Strict C89: decls first. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int fib(int n){ if(n<2) return n; return fib(n-1)+fib(n-2); }
void swap(int *a, int *b){ int t; t=*a; *a=*b; *b=t; }
int main(void){
  int a[6]; int i; int j; char *s;
  printf("Fibonacci:");
  for(i=0;i<12;i++) printf(" %d", fib(i));
  printf("\n");
  a[0]=5; a[1]=2; a[2]=8; a[3]=1; a[4]=9; a[5]=3;
  for(i=0;i<6;i++) for(j=0;j<5;j++) if(a[j]>a[j+1]) swap(&a[j], &a[j+1]);
  printf("sorted:");
  for(i=0;i<6;i++) printf(" %d", a[i]);
  printf("\n");
  s = (char*)malloc(32); strcpy(s, "lcc libc");
  printf("compiled by lcc-wasm; %s, strlen=%d\n", s, (int)strlen(s));
  return 0;
}