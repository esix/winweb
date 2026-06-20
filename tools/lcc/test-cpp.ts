import { preprocess } from '../../src/cc/cpp.ts';

let pass = 0, fail = 0;
function check(name: string, got: string, mustInclude: string[], mustNot: string[] = []): void {
  const g = got.replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
  const okIn = mustInclude.every((s) => g.includes(s));
  const okOut = mustNot.every((s) => !g.includes(s));
  if (okIn && okOut) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, '\n--- got ---\n' + g + '\n--- wanted all of', mustInclude, 'none of', mustNot); }
}

const headers = new Map<string, string>([
  ['windows.h', `#ifndef WIN_H
#define WIN_H
typedef int BOOL;
#define WM_PAINT 15
#define RGB(r,g,b) ((r)|((g)<<8)|((b)<<16))
int TextOut(int hdc, int x, int y, int s, int len);
#endif`],
  ['string.h', `#ifndef STR_H
#define STR_H
static int slen(const char* s){ int n=0; while(s[n]) n++; return n; }
#endif`],
]);

// 1. #include + header guard: included twice, body emitted once
check('include + guard', preprocess(`#include <windows.h>
#include "windows.h"
int main(void){ return WM_PAINT; }`, { includes: headers }),
  ['typedef int BOOL', 'return 15'],
  ['return WM_PAINT', '#ifndef', '#define']);

// 2. object-like macro in code
check('object macro', preprocess(`#include <windows.h>
int f(void){ switch(0){ case WM_PAINT: return 1; } return 0; }`, { includes: headers }),
  ['case 15:'], ['WM_PAINT']);

// 3. function-like macro
check('function macro', preprocess(`#include <windows.h>
int c = RGB(10, 20, 30);`, { includes: headers }),
  ['((10)|((20)<<8)|((30)<<16))'], ['RGB(']);

// 4. #ifdef / #ifndef / #else
check('ifdef/else', preprocess(`#define DEBUG 1
#ifdef DEBUG
int dbg = 1;
#else
int dbg = 0;
#endif
#ifndef DEBUG
int x = 9;
#else
int x = 8;
#endif`, {}),
  ['int dbg = 1', 'int x = 8'], ['int dbg = 0', 'int x = 9']);

// 5. #if with defined() + || and integer expr
check('if defined/expr', preprocess(`#if defined(FOO) || defined(BAR)
int a;
#endif
#if 2 + 3 * 2 == 8
int b;
#endif
#if 0
int dead;
#endif`, {}),
  ['int b;'], ['int a;', 'int dead;']);

// 6. comments + line continuation
check('comments+continuation', preprocess(`int /* block */ y = 1; // trailing
#define LONG 1 + \\
2
int z = LONG;`, {}),
  ['int y = 1;', 'int z = 1 + 2;'], ['block', 'trailing']);

// 7. nested includes share macros + guard prevents recursion
const nested = new Map<string, string>([
  ['a.h', `#ifndef A_H
#define A_H
#include "b.h"
int from_a = B_VAL;
#endif`],
  ['b.h', `#ifndef B_H
#define B_H
#define B_VAL 42
#endif`],
]);
check('nested include', preprocess(`#include "a.h"`, { includes: nested }),
  ['int from_a = 42'], ['B_VAL', '#ifndef']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
