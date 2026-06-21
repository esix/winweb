#!/usr/bin/env bash
# Build all winweb apps to wasm with the lcc-wasm toolchain — node only, NO emscripten.
# (Препроцессор #include берёт внешний clang -E; сам компилятор — вендоренный rcc.wasm.)
set -euo pipefail
cd "$(dirname "$0")/.."

# iconsdemo resources: сгенерировать .ico/.bmp (build-cdrive сам зовёт build-rc для ResourceCompile)
node scripts/gen-icons.mjs

# ВСЕ проекты из src/cdrive/Projects/*.vcxproj -> public/cdrive/Program Files/<App>/<App>.wasm
# (Hello, Notepad, IconsDemo, Minesweeper, cmd) — vite копирует public/ -> dist/
node scripts/build-cdrive.mjs
node scripts/gen-manifest.mjs                      # обход src/cdrive + Program Files -> manifest.json

echo "built all apps via lcc-wasm (node only, no emscripten)"
