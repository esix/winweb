#ifndef _WASM_TIME_H
#define _WASM_TIME_H
typedef long time_t;
typedef long clock_t;
#define CLOCKS_PER_SEC 1000
time_t time(time_t *);
clock_t clock(void);
#endif
