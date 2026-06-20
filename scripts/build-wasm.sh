#!/usr/bin/env bash
# Build all winweb apps to wasm with the lcc-wasm toolchain — node only, NO emscripten.
# (Препроцессор #include берёт внешний clang -E; сам компилятор — вендоренный rcc.wasm.)
set -euo pipefail
cd "$(dirname "$0")/.."

# iconsdemo resources: сгенерировать .ico/.bmp (build-cdrive сам зовёт build-rc для ResourceCompile)
node scripts/gen-icons.mjs

# проекты из src/cdrive/Projects/*.vcxproj -> public/cdrive/Program Files/<App>/<App>.wasm
node scripts/build-cdrive.mjs                      # Hello, Notepad, IconsDemo (вкл. ресурсы)

# cmd-оболочка
node tools/lcc/ccwasm.mjs apps/cmd/cmd_lcc.c
cp apps/cmd/cmd_lcc.wasm public/lcc/cmd_lcc.wasm

echo "built all apps via lcc-wasm (node only, no emscripten)"
