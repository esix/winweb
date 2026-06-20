#!/usr/bin/env bash
# Build all winweb apps to wasm with the lcc-wasm toolchain — node only, NO emscripten.
# (Препроцессор #include берёт внешний clang -E; сам компилятор — вендоренный rcc.wasm.)
set -euo pipefail
cd "$(dirname "$0")/.."

# iconsdemo resources: сгенерировать .ico/.bmp, вшить в iconsdemo_res.c (C-массивы + аксессоры)
node scripts/gen-icons.mjs
node scripts/build-rc.mjs apps/iconsdemo/iconsdemo.rc apps/iconsdemo/iconsdemo_res.c

# GUI-приложения как standalone lcc-wasm модули
node tools/lcc/build-app.mjs                       # hello, notepad, iconsdemo
node tools/lcc/build-minesweeper.mjs               # minesweeper (амальгама 4 файлов + libc)

# cmd-оболочка
node tools/lcc/ccwasm.mjs apps/cmd/cmd_lcc.c
cp apps/cmd/cmd_lcc.wasm public/lcc/cmd_lcc.wasm

echo "built all apps via lcc-wasm (node only, no emscripten)"
