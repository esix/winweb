/* hello.c — крошечный модуль, чтобы доказать сквозную связку
 * emcc -> ES6-модуль -> TypeScript -> Vite -> браузер. */
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE int add(int a, int b) { return a + b; }
