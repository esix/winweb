#ifndef _WASM_STDDEF_H
#define _WASM_STDDEF_H
typedef unsigned size_t;
typedef int ptrdiff_t;
#ifndef NULL
#define NULL ((void*)0)
#endif
#define offsetof(t, m) ((size_t)&(((t*)0)->m))
#endif
