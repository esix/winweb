#ifndef _WASM_ASSERT_H
#define _WASM_ASSERT_H
extern void __assert(const char *, const char *, int);
#ifdef NDEBUG
#define assert(e) ((void)0)
#else
#define assert(e) ((e) ? (void)0 : __assert(#e, __FILE__, __LINE__))
#endif
#endif
