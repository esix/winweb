/* wasm-env.ts — обёртка import-объекта для lcc-модулей: импорты, которых фасад не
 * реализовал, превращаются в no-op (return 0). Модуль импортит весь объявленный Win32. */
export function stubEnv(env: Record<string, unknown>): WebAssembly.ModuleImports {
  return new Proxy(env, { get: (t, k) => (k in t ? t[k as string] : () => 0) }) as unknown as WebAssembly.ModuleImports;
}
