# winweb

A tiny Windows 9x–style desktop that runs **real Win32 C applications** compiled to WebAssembly — by its own small [lcc-wasm](https://github.com/esix/lcc-wasm) toolchain, with **no Emscripten**. The window manager is DOM-based, GDI is a `<canvas>` facade, and you can edit, **compile and run C apps from inside the browser**.

🖥️ **[Live demo](https://esix.github.io/demo/winweb/)** · 📝 **[Write-up](https://esix.github.io/2026/06/21/winweb/)**

## What's inside

Every program is real Win32 C (written with `WinMain` / `RegisterClass` / a message loop / GDI), compiled to standalone wasm:

- **Minesweeper** — the classic, on `WM_PAINT` / `BitBlt` / `DrawEdge`
- **Notepad** — edits files on the virtual `C:`
- **Command Prompt** (`cmd`) — `cd` / `dir` / `type`, runs programs by name
- **cc** / **msbuild** — the C compiler & project builder… in the browser
- **IconsDemo**, **greet** (a console app), **Hello**

System libraries are real files too: `C:\Windows\System32\{user32,gdi32,kernel32}.wasm`. Apps import Win32 functions *from* them; those wasm "DLLs" forward to the JS facade. The call chain is honest: `app.wasm → user32.wasm → JS`.

## Run it

Requires Node 18+ and Yarn.

```bash
yarn install
yarn dev          # dev server at http://localhost:5050 (uses the committed pre-built wasm)
yarn build        # production build -> dist/
```

Recompile the bundled C apps to wasm (needs `clang`, used only as the C preprocessor):

```bash
yarn build:wasm   # compiles src/cdrive/Projects/*.vcxproj via lcc-wasm -> public/cdrive/...
```

Deploy under a sub-path (e.g. a blog at `/demo/winweb/`):

```bash
WINWEB_BASE=/demo/winweb/ yarn build
```

## Add your own app

Create a project under `src/cdrive/Projects/<App>/`:

- `<App>.c` — standard Win32 C (`WinMain` for a GUI app, `main` for a console one)
- `<App>.vcxproj` — a minimal MSBuild-style descriptor (name, console/GUI subsystem, optional icon)

then `yarn build:wasm` — or build it from inside the running desktop with `msbuild <App>` in `cmd`.

## How it works

- **Compiler.** [lcc-wasm](https://github.com/esix/lcc-wasm) — the LCC C compiler retargeted to WebAssembly and then compiled to wasm itself (`rcc.wasm`, ~280 KB). It compiles C89 straight to wasm, both under Node (the build) and in the browser (`cc` / `msbuild`). No Emscripten, no LLVM. See the [companion write-up](https://esix.github.io/2026/06/20/lcc-wasm/).
- **Standalone modules.** Each app exports its own memory + function table, so two instances run fully independently.
- **Windowing.** A DOM window manager (each window is a `<div>` with a title bar, menu and taskbar button). `CreateWindowEx` / `RegisterClass` / `GetMessage` / `DispatchMessage` drive real messages (`WM_PAINT`, `WM_COMMAND`, `WM_TIMER`, `WM_SIZE`).
- **GDI.** `Rectangle`, `TextOut`, `CreateFontW`, `BitBlt`, … rendered onto `<canvas>`.
- **Filesystem.** A virtual `C:` on IndexedDB, seeded from a generated manifest; case-insensitive; persists your edits and in-browser builds.

## Tech

TypeScript · Vite · WebAssembly · [LCC](https://github.com/drh/lcc) (via lcc-wasm)

## License

[MIT](LICENSE)
