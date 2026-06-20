/* cpp.ts — крошечный C-препроцессор на TS, работающий В БРАУЗЕРЕ.
 * rcc.wasm (lcc) не содержит препроцессора; под node мы зовём внешний `clang -E`,
 * а в браузере внешнего clang нет — поэтому этот модуль.
 *
 * Поддерживает: #include "x"/<x> (рекурсивно, по карте заголовков), #define
 * (object- и function-like), #undef, #if/#ifdef/#ifndef/#elif/#else/#endif (с
 * defined() и целочисленным constexpr), удаление комментариев (// и /* *​/),
 * склейку строк (\ в конце), #pragma/#error/#line — игнор/диагностика.
 * НЕ поддерживает (пока): операторы # (stringize) и ## (paste). Этого хватает
 * для наших C89-заголовков и простого кода приложений.
 */
export interface CppOpts {
  includes?: Map<string, string>;       // имя файла -> содержимое (резолвит и "x", и <x>)
  defines?: Record<string, string>;     // предопределённые макросы
  onError?: (msg: string) => void;
}

interface Macro { params: string[] | null; body: string; }   // params=null => object-like

type Tok = { t: 'id' | 'num' | 'str' | 'chr' | 'ws' | 'op'; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { let j = i; while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++; out.push({ t: 'ws', v: s.slice(i, j) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; out.push({ t: 'id', v: s.slice(i, j) }); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) { let j = i; while (j < s.length && /[0-9a-fA-FxX.uUlL]/.test(s[j])) j++; out.push({ t: 'num', v: s.slice(i, j) }); i = j; continue; }
    if (c === '"') { let j = i + 1; while (j < s.length && s[j] !== '"') { if (s[j] === '\\') j++; j++; } j++; out.push({ t: 'str', v: s.slice(i, j) }); i = j; continue; }
    if (c === "'") { let j = i + 1; while (j < s.length && s[j] !== "'") { if (s[j] === '\\') j++; j++; } j++; out.push({ t: 'chr', v: s.slice(i, j) }); i = j; continue; }
    out.push({ t: 'op', v: c }); i++;
  }
  return out;
}

/* удалить комментарии (сохраняя строковые/символьные литералы и переводы строк) */
function stripComments(src: string): string {
  let out = ''; let i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '"' || c === "'") { const q = c; out += c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; } out += src[i++]; } out += src[i] ?? ''; i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; out += ' '; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}

export function preprocess(src: string, opts: CppOpts = {}): string {
  const includes = opts.includes ?? new Map<string, string>();
  const macros = new Map<string, Macro>();
  if (opts.defines) for (const k of Object.keys(opts.defines)) macros.set(k, { params: null, body: opts.defines[k] });
  const err = opts.onError ?? (() => {});
  const out: string[] = [];

  /* --- раскрытие макросов в потоке токенов --- */
  const expandToks = (toks: Tok[], hide: Set<string>): Tok[] => {
    const res: Tok[] = [];
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (tk.t !== 'id' || !macros.has(tk.v) || hide.has(tk.v)) { res.push(tk); continue; }
      const mac = macros.get(tk.v)!;
      if (mac.params === null) {
        res.push(...expandToks(tokenize(mac.body), new Set([...hide, tk.v])));
      } else {
        let j = i + 1; while (j < toks.length && toks[j].t === 'ws') j++;
        if (toks[j]?.v !== '(') { res.push(tk); continue; }          // имя без вызова -> обычный id
        j++; const args: Tok[][] = []; let cur: Tok[] = []; let depth = 1;
        for (; j < toks.length && depth > 0; j++) {
          const x = toks[j];
          if (x.v === '(') depth++; else if (x.v === ')') { depth--; if (depth === 0) break; } else if (x.v === ',' && depth === 1) { args.push(cur); cur = []; continue; }
          cur.push(x);
        }
        if (cur.length || args.length) args.push(cur);
        const trim = (a: Tok[]): Tok[] => { while (a[0]?.t === 'ws') a.shift(); while (a[a.length - 1]?.t === 'ws') a.pop(); return a; };
        const exArgs = args.map((a) => expandToks(trim(a), hide));
        const body = tokenize(mac.body).flatMap((b) => {
          if (b.t === 'id') { const pi = mac.params!.indexOf(b.v); if (pi >= 0) return exArgs[pi] ?? []; }
          return [b];
        });
        res.push(...expandToks(body, new Set([...hide, tk.v])));
        i = j;
      }
    }
    return res;
  };
  const expandLine = (line: string): string => expandToks(tokenize(line), new Set()).map((t) => t.v).join('');

  /* --- вычисление выражения #if (целочисленный constexpr) --- */
  const evalIf = (expr: string): number => {
    let e = expr.replace(/\bdefined\s*\(\s*(\w+)\s*\)/g, (_m, n) => (macros.has(n) ? '1' : '0'))
                .replace(/\bdefined\s+(\w+)/g, (_m, n) => (macros.has(n) ? '1' : '0'));
    e = expandLine(e);
    const tk = tokenize(e).filter((t) => t.t !== 'ws').map((t) => (t.t === 'id' ? '0' : t.v));   // неопр. id -> 0
    return evalExpr(tk) ? 1 : 0;
  };

  /* --- условная компиляция --- */
  type Cond = { active: boolean; taken: boolean; parent: boolean };
  const cond: Cond[] = [];
  const activeNow = () => cond.length === 0 || cond[cond.length - 1].active;
  const openCond = (test: boolean): Cond => { const p = activeNow(); return { parent: p, active: p && test, taken: p && test }; };

  const run = (text: string, depth: number): void => {
    if (depth > 64) { err('cpp: #include nesting too deep'); return; }
    const spliced = stripComments(text.replace(/\\\r?\n/g, ''));
    for (const raw of spliced.split('\n')) {
      const t = raw.replace(/^[ \t]+/, '');
      if (t[0] === '#') {
        const body = t.slice(1).replace(/^[ \t]+/, '');
        const sp = body.search(/[ \t]/);
        const dir = sp < 0 ? body : body.slice(0, sp);
        const rest = (sp < 0 ? '' : body.slice(sp + 1)).trim();
        switch (dir) {
          case 'ifdef': cond.push(openCond(macros.has(rest.match(/\w+/)?.[0] ?? ''))); break;
          case 'ifndef': cond.push(openCond(!macros.has(rest.match(/\w+/)?.[0] ?? ''))); break;
          case 'if': cond.push(openCond(evalIf(rest) !== 0)); break;
          case 'elif': { const c = cond[cond.length - 1]; if (c) { if (!c.taken && c.parent && evalIf(rest) !== 0) { c.active = true; c.taken = true; } else c.active = false; } break; }
          case 'else': { const c = cond[cond.length - 1]; if (c) { c.active = c.parent && !c.taken; c.taken = true; } break; }
          case 'endif': cond.pop(); break;
          case 'define': if (activeNow()) defineMacro(rest); break;
          case 'undef': if (activeNow()) macros.delete(rest.match(/\w+/)?.[0] ?? ''); break;
          case 'include': if (activeNow()) doInclude(rest, depth); break;
          case 'error': if (activeNow()) err('cpp: #error ' + rest); break;
          default: break;   // pragma / line / unknown -> игнор
        }
      } else if (activeNow()) {
        out.push(expandLine(raw));
      }
    }
  };

  const defineMacro = (rest: string): void => {
    const m = rest.match(/^(\w+)/); if (!m) return;
    const name = m[1];
    if (rest[name.length] === '(') {
      const close = rest.indexOf(')');
      const params = rest.slice(name.length + 1, close).split(',').map((s) => s.trim()).filter(Boolean);
      macros.set(name, { params, body: rest.slice(close + 1).trim() });
    } else {
      macros.set(name, { params: null, body: rest.slice(name.length).trim() });
    }
  };

  const doInclude = (rest: string, depth: number): void => {
    const m = rest.match(/^[<"]([^>"]+)[>"]/); if (!m) { err('cpp: malformed #include ' + rest); return; }
    const name = m[1];
    const content = includes.get(name) ?? includes.get(name.split('/').pop() || name);
    if (content === undefined) { err('cpp: cannot find include ' + name); return; }
    run(content, depth + 1);
  };

  run(src, 0);
  return out.join('\n') + '\n';
}

/* мини-вычислитель целочисленного выражения препроцессора (C-семантика 0/ненулевое) */
function evalExpr(tokens: string[]): number {
  let p = 0;
  const peek = () => tokens[p];
  const eat = () => tokens[p++];
  const num = (s: string): number => (/^0[xX]/.test(s) ? parseInt(s, 16) : parseInt(s, 10)) | 0;
  // приоритеты (низкий->высокий): || && | ^ & ==/!= rel shift add mul unary primary
  const prim = (): number => { const t = eat(); if (t === '(') { const v = bOr(); eat(); return v; } if (t === '!') return prim() ? 0 : 1; if (t === '~') return ~prim(); if (t === '-') return -prim(); if (t === '+') return +prim(); return num(t || '0'); };
  const bin = (next: () => number, ops: string[], f: (a: number, b: number, o: string) => number): (() => number) => () => { let l = next(); while (ops.includes(peek())) { const o = eat(); l = f(l, next(), o); } return l; };
  const mul = bin(prim, ['*', '/', '%'], (a, b, o) => (o === '*' ? a * b : o === '/' ? (b ? (a / b) | 0 : 0) : (b ? a % b : 0)));
  const add = bin(mul, ['+', '-'], (a, b, o) => (o === '+' ? a + b : a - b));
  const shift = bin(add, ['<<', '>>'], (a, b, o) => (o === '<<' ? a << b : a >> b));
  const rel = bin(shift, ['<', '>', '<=', '>='], (a, b, o) => Number(o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b));
  const eq = bin(rel, ['==', '!='], (a, b, o) => Number(o === '==' ? a === b : a !== b));
  const bAnd = bin(eq, ['&'], (a, b) => a & b);
  const bXor = bin(bAnd, ['^'], (a, b) => a ^ b);
  const bOrLvl = bin(bXor, ['|'], (a, b) => a | b);
  const land = bin(bOrLvl, ['&&'], (a, b) => Number(Boolean(a) && Boolean(b)));
  const bOr = bin(land, ['||'], (a, b) => Number(Boolean(a) || Boolean(b)));
  // объединить многосимвольные операторы, пришедшие как одиночные op-токены
  tokens = joinOps(tokens);
  return bOr() | 0;
}

/* склеить '<','<' -> '<<' и т.п. (tokenize даёт op'ы по одному символу) */
function joinOps(tokens: string[]): string[] {
  const two = new Set(['<<', '>>', '<=', '>=', '==', '!=', '&&', '||']);
  const r: string[] = [];
  for (let i = 0; i < tokens.length; i++) { const a = tokens[i], b = tokens[i + 1]; if (b && two.has(a + b)) { r.push(a + b); i++; } else r.push(a); }
  return r;
}
