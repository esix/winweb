#!/usr/bin/env bash
# Compile C natives to ES6 wasm modules consumed by the TS app.
set -euo pipefail
cd "$(dirname "$0")/.."

# H4 demo (custom thin API) — kept as reference
emcc src/native/user32.c -O2 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=_main,_wm_dispatch \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,stringToUTF8,lengthBytesUTF8 \
  -o src/wasm/user32.js

# H5b: REAL downloaded third-party Win32 app (apps/Connect.c, Petzold) compiled
# UNMODIFIED against our windows.h facade (-I include), blocking GetMessage via ASYNCIFY.
emcc apps/Connect.c src/native/win32_impl.c -O2 -I include \
  -sASYNCIFY -sMODULARIZE=1 -sEXPORT_ES6=1 -sINVOKE_RUN=0 \
  -sEXPORTED_FUNCTIONS=_main,_wm_post \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -o src/wasm/win32app.js

# Minesweeper теперь собирается компилятором lcc-wasm под node (амальгама 4 файлов + libc),
# НЕ emscripten:  node tools/lcc/build-minesweeper.mjs  ->  public/lcc/minesweeper.wasm

# Notepad теперь собирается lcc-wasm под node:  node tools/lcc/build-app.mjs notepad -> public/lcc/notepad.wasm

# Icons demo: .ico/.bmp ресурсы (gen-icons.mjs) -> iconsdemo_res.c (build-rc.mjs вместо rc.exe).
# Сам .wasm теперь собирает lcc:  node tools/lcc/build-app.mjs iconsdemo -> public/lcc/iconsdemo.wasm
# (LoadIcon/LoadBitmap в фасаде читают winweb_res_table() из экспортов модуля).
node scripts/gen-icons.mjs
node scripts/build-rc.mjs apps/iconsdemo/iconsdemo.rc apps/iconsdemo/iconsdemo_res.c

# === DLL runtime (D1) =========================================================
# win32_impl.c as a MAIN_MODULE runtime that EXPORTS the Win32 API; apps load as
# SIDE_MODULEs and import it. JSPI (NOT Asyncify — it fails across the dynamic
# boundary) suspends the GetMessage loop; winweb_run must be a JSPI-promising export.
# MAIN_MODULE=1 keeps the WHOLE Win32 API + libc in the dynamic symbol table, so
# ANY side-module app resolves its imports (no per-app export list to maintain).
emcc src/native/win32_impl.c -O2 -I include -fshort-wchar \
  -DWINWEB_DYNAMIC \
  -sMAIN_MODULE=1 \
  -sJSPI=1 -sJSPI_IMPORTS=emscripten_sleep -sJSPI_EXPORTS=winweb_run \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sINVOKE_RUN=0 \
  -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_FUNCTIONS=_main,_winweb_run,_wm_post,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,loadDynamicLibrary,FS,HEAPU8,HEAPU16,HEAP32,stringToUTF8,lengthBytesUTF8 \
  -o src/wasm/runtime.js

# hello, cmd, minesweeper теперь собираются компилятором lcc-wasm под node (см. tools/lcc/), не emscripten:
#   node tools/lcc/build-app.mjs hello       -> public/cdrive/files/hello.wasm
#   node tools/lcc/ccwasm.mjs apps/cmd/cmd_lcc.c && cp apps/cmd/cmd_lcc.wasm public/lcc/cmd_lcc.wasm
#   node tools/lcc/build-minesweeper.mjs     -> public/lcc/minesweeper.wasm

echo "built user32.js, win32app.js, runtime.js (emscripten). hello/notepad/iconsdemo/cmd/minesweeper -> lcc-wasm (tools/lcc/)"
