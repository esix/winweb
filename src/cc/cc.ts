/* cc.ts — крошечный компилятор подмножества C прямо в WebAssembly-бинарь.
 * Структурный C (if/while/for) -> структурное управление wasm: relooper не нужен.
 *
 * Subset (M3): int/char/T*, массивы, СТРУКТУРЫ (. -> sizeof, ={0}), УКАЗАТЕЛИ НА ФУНКЦИИ
 * (имя функции = индекс в таблице; вызов через переменную = call_indirect);
 * & * a[i], арифметика указателей, + - * / %, унарные -/!, сравнения, && ||,
 * if/else while for, i++/i--, строковые литералы; builtins putchar/puts/print_int/
 * print_str/getchar/malloc/free + variadic printf.
 *
 * Память: все локалы/параметры/массивы/структуры — в КАДРЕ на shadow-stack (global __sp),
 * всё адресуемо единообразно (а-ля -O0). Куча — bump (malloc на JS).
 */

/* ---------- лексер ---------- */
type Tok = { k: string; v: string };
const KW = new Set(['int', 'char', 'void', 'struct', 'sizeof', 'if', 'else', 'while', 'for', 'return']);
function lex(src: string): Tok[] {
  const t: Tok[] = []; let i = 0;
  const macros = new Map<string, number>();   // объектные #define (целочисленные)
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '#') { let e = src.indexOf('\n', i); if (e < 0) e = src.length; const m = src.slice(i, e).match(/^#\s*define\s+([A-Za-z_]\w*)\s+(0[xX][0-9a-fA-F]+|-?\d+)/); if (m) macros.set(m[1], parseInt(m[2])); i = e; continue; }
    const s = i;
    if (/[A-Za-z_]/.test(c)) { while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++; const w = src.slice(s, i); if (macros.has(w)) t.push({ k: 'num', v: String(macros.get(w)) }); else t.push({ k: KW.has(w) ? w : 'id', v: w }); continue; }
    if (/[0-9]/.test(c)) { if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) { i += 2; const h = i; while (i < src.length && /[0-9a-fA-F]/.test(src[i])) i++; t.push({ k: 'num', v: String(parseInt(src.slice(h, i), 16)) }); continue; } while (i < src.length && /[0-9]/.test(src[i])) i++; t.push({ k: 'num', v: src.slice(s, i) }); continue; }
    if (c === '"') { i++; let z = ''; while (i < src.length && src[i] !== '"') { if (src[i] === '\\') { const e = src[++i]; z += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === '0' ? '\0' : e; i++; } else z += src[i++]; } i++; t.push({ k: 'str', v: z }); continue; }
    if (c === "'") { i++; let ch = src[i]; if (ch === '\\') { const e = src[++i]; ch = e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === '0' ? '\0' : e; } i += 2; t.push({ k: 'num', v: String(ch.charCodeAt(0)) }); continue; }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '->', '<<', '>>'].includes(two)) { t.push({ k: 'op', v: two }); i += 2; continue; }
    if ('+-*/%<>=!&|^~(){}[],;.'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    throw new Error(`cc: unexpected '${c}'`);
  }
  t.push({ k: 'eof', v: '' });
  return t;
}

/* ---------- типы ---------- */
type Ty = { k: 'int' | 'char' | 'ptr' | 'arr' | 'struct'; to?: Ty; n?: number; name?: string };
const TINT: Ty = { k: 'int' }, TCHAR: Ty = { k: 'char' };
const isPtrLike = (t: Ty) => t.k === 'ptr' || t.k === 'arr';
const elem = (t: Ty): Ty => t.to ?? TINT;
const decay = (t: Ty): Ty => t.k === 'arr' ? { k: 'ptr', to: t.to } : t;

/* ---------- AST ---------- */
type Node = any;

/* ---------- парсер ---------- */
function parse(toks: Tok[]): Node {
  let p = 0;
  const peek = (o = 0) => toks[p + o], next = () => toks[p++];
  const isOp = (v: string) => peek().k === 'op' && peek().v === v;
  const eat = (v: string) => { if (!isOp(v)) err(`expected '${v}'`); p++; };
  const eatK = (k: string) => { if (peek().k !== k) err(`expected ${k}`); return next(); };
  const err = (m: string): never => { throw new Error(`cc: ${m}, got '${peek().v || peek().k}'`); };
  const isTypeKw = () => ['int', 'char', 'void', 'struct'].includes(peek().k);

  function baseType(): Ty {
    if (peek().k === 'struct') { next(); const name = eatK('id').v; let t: Ty = { k: 'struct', name }; while (isOp('*')) { eat('*'); t = { k: 'ptr', to: t }; } return t; }
    const k = next().k; let t: Ty = k === 'char' ? TCHAR : TINT; while (isOp('*')) { eat('*'); t = { k: 'ptr', to: t }; } return t;
  }
  function structDef(): Node {
    next(); const name = eatK('id').v; eat('{');
    const members: Node[] = [];
    while (!isOp('}')) { const bt = baseType(); const mn = eatK('id').v; let ty = bt; if (isOp('[')) { eat('['); const n = parseInt(eatK('num').v, 10); eat(']'); ty = { k: 'arr', to: bt, n }; } eat(';'); members.push({ name: mn, type: ty }); }
    eat('}'); eat(';'); return { t: 'structdef', name, members };
  }

  const top: Node[] = [];
  while (peek().k !== 'eof') {
    if (peek().k === 'struct' && peek(2).v === '{') { top.push(structDef()); continue; }
    const bt = baseType(); const name = eatK('id').v;
    if (isOp('(')) {
      eat('('); const params: Node[] = [];
      if (!isOp(')')) { do { const pt = isTypeKw() ? baseType() : TINT; params.push({ name: eatK('id').v, type: pt }); } while (isOp(',') && (eat(','), true)); }
      eat(')');
      if (isOp(';')) { eat(';'); top.push({ t: 'extern', name, ret: bt, params }); continue; }   // прототип -> импорт
      eat('{'); const body: Node[] = []; while (!isOp('}')) body.push(stmt()); eat('}');
      top.push({ t: 'func', name, ret: bt, params, body });
    } else {
      let ty = bt; if (isOp('[')) { eat('['); const n = parseInt(eatK('num').v, 10); eat(']'); ty = { k: 'arr', to: bt, n }; }
      let init = 0; if (isOp('=')) { eat('='); init = parseInt(eatK('num').v, 10); } eat(';');
      top.push({ t: 'global', name, type: ty, init });
    }
  }
  return { t: 'program', top };

  function stmt(): Node {
    if (peek().k === 'struct' && peek(2).v === '{') return structDef();
    if (isTypeKw()) {
      const bt = baseType(); const name = eatK('id').v; let ty = bt;
      if (isOp('[')) { eat('['); const n = parseInt(eatK('num').v, 10); eat(']'); ty = { k: 'arr', to: bt, n }; }
      let init: Node = null; if (isOp('=')) { eat('='); init = isOp('{') ? (eat('{'), isOp('}') ? null : (() => { const v = parseInt(eatK('num').v, 10); return { t: 'num', v }; })(), eat('}'), { t: 'zinit' }) : expr(); }
      eat(';'); return { t: 'decl', name, type: ty, init };
    }
    if (isOp('{')) { eat('{'); const body: Node[] = []; while (!isOp('}')) body.push(stmt()); eat('}'); return { t: 'block', body }; }
    if (peek().k === 'if') { next(); eat('('); const c = expr(); eat(')'); const th = stmt(); let el: Node = null; if (peek().k === 'else') { next(); el = stmt(); } return { t: 'if', c, th, el }; }
    if (peek().k === 'while') { next(); eat('('); const c = expr(); eat(')'); return { t: 'while', c, body: stmt() }; }
    if (peek().k === 'for') { next(); eat('('); const init = isOp(';') ? (eat(';'), null) : (isTypeKw() ? stmt() : (() => { const e = expr(); eat(';'); return { t: 'expr', e }; })()); const cond = isOp(';') ? null : expr(); eat(';'); const step = isOp(')') ? null : expr(); eat(')'); return { t: 'for', init, cond, step, body: stmt() }; }
    if (peek().k === 'return') { next(); const e = isOp(';') ? null : expr(); eat(';'); return { t: 'return', e }; }
    const e = expr(); eat(';'); return { t: 'expr', e };
  }

  function expr(): Node { return assign(); }
  function assign(): Node { const l = or(); if (isOp('=')) { eat('='); return { t: 'assign', lhs: l, e: assign() }; } return l; }
  function or(): Node { let l = and(); while (isOp('||')) { eat('||'); l = { t: 'or', l, r: and() }; } return l; }
  function and(): Node { let l = bor(); while (isOp('&&')) { eat('&&'); l = { t: 'and', l, r: bor() }; } return l; }
  function bor(): Node { let l = bxor(); while (isOp('|')) { next(); l = { t: 'bin', o: '|', l, r: bxor() }; } return l; }
  function bxor(): Node { let l = band(); while (isOp('^')) { next(); l = { t: 'bin', o: '^', l, r: band() }; } return l; }
  function band(): Node { let l = eq(); while (isOp('&')) { next(); l = { t: 'bin', o: '&', l, r: eq() }; } return l; }
  function eq(): Node { let l = rel(); while (isOp('==') || isOp('!=')) { const o = next().v; l = { t: 'bin', o, l, r: rel() }; } return l; }
  function rel(): Node { let l = shift(); while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const o = next().v; l = { t: 'bin', o, l, r: shift() }; } return l; }
  function shift(): Node { let l = add(); while (isOp('<<') || isOp('>>')) { const o = next().v; l = { t: 'bin', o, l, r: add() }; } return l; }
  function add(): Node { let l = mul(); while (isOp('+') || isOp('-')) { const o = next().v; l = { t: 'bin', o, l, r: mul() }; } return l; }
  function mul(): Node { let l = un(); while (isOp('*') || isOp('/') || isOp('%')) { const o = next().v; l = { t: 'bin', o, l, r: un() }; } return l; }
  function un(): Node {
    if (isOp('-')) { eat('-'); return { t: 'neg', e: un() }; }
    if (isOp('!')) { eat('!'); return { t: 'not', e: un() }; }
    if (isOp('*')) { eat('*'); return { t: 'deref', e: un() }; }
    if (isOp('&')) { eat('&'); return { t: 'addr', e: un() }; }
    if (peek().k === 'sizeof') { next(); eat('('); if (isTypeKw()) { const ty = baseType(); eat(')'); return { t: 'sizeofT', ty }; } const e = expr(); eat(')'); return { t: 'sizeofE', e }; }
    return post();
  }
  function post(): Node {
    let n = prim();
    for (;;) {
      if (isOp('(')) { eat('('); const args: Node[] = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && (eat(','), true)); } eat(')'); n = { t: 'call', fn: n, args }; }
      else if (isOp('[')) { eat('['); const idx = expr(); eat(']'); n = { t: 'index', base: n, idx }; }
      else if (isOp('.')) { eat('.'); n = { t: 'member', base: n, field: eatK('id').v, arrow: false }; }
      else if (isOp('->')) { eat('->'); n = { t: 'member', base: n, field: eatK('id').v, arrow: true }; }
      else if (isOp('++') || isOp('--')) { const o = next().v; n = { t: 'postincr', lhs: n, o }; }
      else break;
    }
    return n;
  }
  function prim(): Node {
    if (isOp('(')) { eat('('); const e = expr(); eat(')'); return e; }
    if (peek().k === 'num') return { t: 'num', v: parseInt(next().v, 10) | 0 };
    if (peek().k === 'str') return { t: 'str', v: next().v };
    if (peek().k === 'id') return { t: 'var', name: next().v };
    return err('expected expression');
  }
}

/* ---------- wasm helpers ---------- */
const uleb = (n: number): number[] => { const o: number[] = []; n >>>= 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const sleb = (n: number): number[] => { const o: number[] = []; let more = true; while (more) { let b = n & 0x7f; n >>= 7; if ((n === 0 && (b & 0x40) === 0) || (n === -1 && (b & 0x40))) more = false; else b |= 0x80; o.push(b); } return o; };
const wstr = (s: string): number[] => { const b = [...new TextEncoder().encode(s)]; return [...uleb(b.length), ...b]; };
const vec = (items: number[][]): number[] => [...uleb(items.length), ...items.flat()];
const section = (id: number, payload: number[]): number[] => [id, ...uleb(payload.length), ...payload];
const I32 = 0x7f, VOID = 0x40, FUNCREF = 0x70;
const OP = {
  block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b, br: 0x0c, br_if: 0x0d, ret: 0x0f, call: 0x10, call_ind: 0x11, drop: 0x1a,
  lget: 0x20, lset: 0x21, ltee: 0x22, gget: 0x23, gset: 0x24,
  load: 0x28, load8s: 0x2c, store: 0x36, store8: 0x3a,
  const: 0x41, eqz: 0x45, eq: 0x46, ne: 0x47, lt: 0x48, gt: 0x4a, le: 0x4c, ge: 0x4e,
  add: 0x6a, sub: 0x6b, mul: 0x6c, div: 0x6d, rem: 0x6f, and: 0x71, or: 0x72, xor: 0x73, shl: 0x74, shr: 0x76,
};

export interface CompileResult { ok: boolean; wasm?: Uint8Array; errors: string[]; }
const ARGBUF = 16, DATA_START = 512, STACK_TOP = 16 * 65536;
const BUILTINS = ['putchar', 'puts', 'print_int', 'print_str', 'getchar', 'malloc', 'free', '__printf'];
const BARITY: Record<string, number> = { putchar: 1, puts: 1, print_int: 1, print_str: 1, getchar: 0, malloc: 1, free: 1, __printf: 3 };

export function compile(source: string): CompileResult {
  const errors: string[] = [];
  try {
    const ast = parse(lex(source));
    const funcs = ast.top.filter((n: Node) => n.t === 'func');
    const externs: Node[] = ast.top.filter((n: Node) => n.t === 'extern');
    const globals: Node[] = ast.top.filter((n: Node) => n.t === 'global');
    const structDefs: Node[] = ast.top.filter((n: Node) => n.t === 'structdef');

    /* раскладка структур: name -> {members:[{name,type,off}], size} */
    const structMap = new Map<string, { members: { name: string; type: Ty; off: number }[]; size: number }>();
    const sizeOf = (t: Ty): number => t.k === 'char' ? 1 : t.k === 'arr' ? t.n! * sizeOf(t.to!) : t.k === 'struct' ? structMap.get(t.name!)!.size : 4;
    const alignOf = (t: Ty): number => t.k === 'char' ? 1 : t.k === 'struct' ? 4 : 4;
    for (const sd of structDefs) {
      let off = 0; const members: { name: string; type: Ty; off: number }[] = [];
      for (const m of sd.members) { const a = alignOf(m.type); off = (off + a - 1) & ~(a - 1); members.push({ name: m.name, type: m.type, off }); off += sizeOf(m.type); }
      structMap.set(sd.name, { members, size: (off + 3) & ~3 });
    }
    const memberOf = (t: Ty, field: string) => structMap.get(t.name!)?.members.find((m) => m.name === field);

    /* строки + глобалы в линейной памяти */
    let dataPtr = DATA_START;
    const strings: { s: string; off: number }[] = []; const strOff = new Map<string, number>();
    const intern = (s: string): number => { if (strOff.has(s)) return strOff.get(s)!; const off = dataPtr; strOff.set(s, off); strings.push({ s, off }); dataPtr += s.length + 1; return off; };
    const gInfo = new Map<string, { off: number; type: Ty }>(); const gInit: { off: number; v: number }[] = [];
    for (const g of globals) { const sz = sizeOf(g.type); const off = (dataPtr + 3) & ~3; dataPtr = off + sz; gInfo.set(g.name, { off, type: g.type }); if (g.init) gInit.push({ off, v: g.init }); }

    const NB = BUILTINS.length, NE = externs.length;
    const funcIndex = new Map<string, number>();            // wasm-индекс: builtins, externs, потом пользовательские
    BUILTINS.forEach((n, i) => funcIndex.set(n, i));
    externs.forEach((e: Node, j: number) => funcIndex.set(e.name, NB + j));
    funcs.forEach((f: Node, i: number) => funcIndex.set(f.name, NB + NE + i));
    const funcSlot = new Map<string, number>();             // указатель на функцию = слот в таблице (1-based, только пользовательские)
    funcs.forEach((f: Node, i: number) => funcSlot.set(f.name, i + 1));
    const funcRet = new Map<string, Ty>([...externs, ...funcs].map((f: Node) => [f.name, f.ret]));

    function genFunc(f: Node): { body: number[] } {
      const vars = new Map<string, { off: number; type: Ty }>();
      let frame = 0;
      const alloc = (name: string, type: Ty) => { const a = alignOf(type); frame = (frame + a - 1) & ~(a - 1); const off = frame; frame += sizeOf(type); vars.set(name, { off, type }); };
      f.params.forEach((pp: Node) => alloc(pp.name, pp.type));
      const collect = (s: Node): void => { if (!s) return; if (s.t === 'decl') alloc(s.name, s.type); else if (s.t === 'block') s.body.forEach(collect); else if (s.t === 'if') { collect(s.th); collect(s.el); } else if (s.t === 'while') collect(s.body); else if (s.t === 'for') { collect(s.init); collect(s.body); } };
      f.body.forEach(collect);

      const FP = f.params.length, SC = f.params.length + 1;
      const code: number[] = [];
      const K = (n: number) => code.push(OP.const, ...sleb(n));
      const loadOp = (t: Ty) => t.k === 'char' ? code.push(OP.load8s, 0, 0) : code.push(OP.load, 2, 0);
      const storeOp = (t: Ty) => t.k === 'char' ? code.push(OP.store8, 0, 0) : code.push(OP.store, 2, 0);

      const peekType = (n: Node): Ty => {
        switch (n.t) {
          case 'var': { const v = vars.get(n.name); if (v) return v.type; const g = gInfo.get(n.name); if (g) return g.type; if (funcSlot.has(n.name)) return { k: 'ptr', to: TINT }; return TINT; }
          case 'num': return TINT; case 'str': return { k: 'ptr', to: TCHAR };
          case 'deref': return elem(peekType(n.e));
          case 'index': return elem(decay(peekType(n.base)));
          case 'addr': return { k: 'ptr', to: peekType(n.e) };
          case 'member': { const st = n.arrow ? elem(peekType(n.base)) : peekType(n.base); return memberOf(st, n.field)?.type ?? TINT; }
          case 'call': return funcRet.get(n.fn?.name) ?? TINT;
          case 'bin': return (n.o === '+' || n.o === '-') && isPtrLike(peekType(n.l)) ? decay(peekType(n.l)) : TINT;
          default: return TINT;
        }
      };

      const lval = (n: Node): Ty => {
        if (n.t === 'var') { const v = vars.get(n.name); if (v) { code.push(OP.lget, ...uleb(FP)); K(v.off); code.push(OP.add); return v.type; } const g = gInfo.get(n.name); if (g) { K(g.off); return g.type; } errors.push(`undefined '${n.name}'`); return TINT; }
        if (n.t === 'deref') return elem(val(n.e));
        if (n.t === 'index') { const bt = val(n.base); const et = elem(decay(bt)); val(n.idx); K(sizeOf(et)); code.push(OP.mul, OP.add); return et; }
        if (n.t === 'member') { const st = n.arrow ? elem(val(n.base)) : lval(n.base); const m = memberOf(st, n.field); if (!m) { errors.push(`no field '${n.field}'`); return TINT; } K(m.off); code.push(OP.add); return m.type; }
        errors.push('not an lvalue'); return TINT;
      };

      const val = (n: Node): Ty => {
        switch (n.t) {
          case 'num': K(n.v); return TINT;
          case 'str': K(intern(n.v)); return { k: 'ptr', to: TCHAR };
          case 'var': {
            if (!vars.has(n.name) && !gInfo.has(n.name) && funcSlot.has(n.name)) { K(funcSlot.get(n.name)!); return { k: 'ptr', to: TINT }; }   // имя функции -> указатель
            const t = peekType(n); if (t.k === 'arr' || t.k === 'struct') { lval(n); return decay(t); } const at = lval(n); loadOp(at); return at;
          }
          case 'deref': case 'index': case 'member': { const t = peekType(n); if (t.k === 'arr' || t.k === 'struct') { lval(n); return decay(t); } const at = lval(n); loadOp(at); return at; }
          case 'addr': { if (n.e.t === 'var' && funcSlot.has(n.e.name) && !vars.has(n.e.name)) { K(funcSlot.get(n.e.name)!); return { k: 'ptr', to: TINT }; } const t = lval(n.e); return { k: 'ptr', to: t }; }
          case 'neg': K(0); val(n.e); code.push(OP.sub); return TINT;
          case 'not': val(n.e); code.push(OP.eqz); return TINT;
          case 'and': { val(n.l); code.push(OP.if, I32); val(n.r); code.push(OP.eqz, OP.eqz, OP.else); K(0); code.push(OP.end); return TINT; }
          case 'or': { val(n.l); code.push(OP.if, I32); K(1); code.push(OP.else); val(n.r); code.push(OP.eqz, OP.eqz, OP.end); return TINT; }
          case 'sizeofT': K(sizeOf(n.ty)); return TINT;
          case 'sizeofE': K(sizeOf(peekType(n.e))); return TINT;
          case 'assign': { const at0 = peekType(n.lhs); if (at0.k === 'struct') return structCopy(n.lhs, n.e, at0); const vt = val(n.e); code.push(OP.lset, ...uleb(SC)); const at = lval(n.lhs); code.push(OP.lget, ...uleb(SC)); storeOp(at); code.push(OP.lget, ...uleb(SC)); void vt; return at; }
          case 'postincr': { const at = lval(n.lhs); code.push(OP.lset, ...uleb(SC)); code.push(OP.lget, ...uleb(SC)); loadOp(at); code.push(OP.lget, ...uleb(SC)); code.push(OP.lget, ...uleb(SC)); loadOp(at); K(isPtrLike(at) ? sizeOf(elem(at)) : 1); code.push(n.o === '++' ? OP.add : OP.sub); storeOp(at); return at; }
          case 'bin': return bin(n);
          case 'call': return call(n);
          default: errors.push(`bad expr ${n.t}`); K(0); return TINT;
        }
      };

      const structCopy = (lhs: Node, rhs: Node, st: Ty): Ty => {        // копия структуры по словам
        const sz = sizeOf(st);
        val(rhs); code.push(OP.lset, ...uleb(SC));                       // SC = адрес источника
        for (let o = 0; o < sz; o += 4) { lval(lhs); K(o); code.push(OP.add); code.push(OP.lget, ...uleb(SC)); K(o); code.push(OP.add); code.push(OP.load, 2, 0); code.push(OP.store, 2, 0); }
        lval(lhs); return st;                                            // результат = адрес назначения
      };

      const bin = (n: Node): Ty => {
        const o = n.o;
        if (o === '+' || o === '-') { const lt = peekType(n.l); if (isPtrLike(lt)) { const pt = val(n.l); val(n.r); K(sizeOf(elem(decay(pt)))); code.push(OP.mul, o === '+' ? OP.add : OP.sub); return decay(pt); } val(n.l); val(n.r); code.push(o === '+' ? OP.add : OP.sub); return TINT; }
        val(n.l); val(n.r); const m: Record<string, number> = { '*': OP.mul, '/': OP.div, '%': OP.rem, '==': OP.eq, '!=': OP.ne, '<': OP.lt, '>': OP.gt, '<=': OP.le, '>=': OP.ge, '&': OP.and, '|': OP.or, '^': OP.xor, '<<': OP.shl, '>>': OP.shr }; code.push(m[o]); return TINT;
      };

      const call = (n: Node): Ty => {
        const name = n.fn?.name;
        if (name === 'printf') { for (let i = 1; i < n.args.length; i++) { K(ARGBUF + (i - 1) * 4); val(n.args[i]); code.push(OP.store, 2, 0); } val(n.args[0]); K(ARGBUF); K(n.args.length - 1); code.push(OP.call, ...uleb(funcIndex.get('__printf')!)); return TINT; }
        if (name && funcIndex.has(name)) { n.args.forEach((a: Node) => val(a)); code.push(OP.call, ...uleb(funcIndex.get(name)!)); return funcRet.get(name) ?? TINT; }
        // вызов через указатель на функцию (переменная/выражение)
        n.args.forEach((a: Node) => val(a)); val(n.fn); code.push(OP.call_ind, ...uleb(getSig(n.args.length)), 0x00); return TINT;
      };

      const epilogue = () => { code.push(OP.gget, 0); K(frame); code.push(OP.add, OP.gset, 0); };
      const S = (n: Node): void => {
        switch (n.t) {
          case 'decl': {
            const v = vars.get(n.name)!;
            if (n.init?.t === 'zinit') { for (let o = 0; o < sizeOf(v.type); o += 4) { code.push(OP.lget, ...uleb(FP)); K(v.off + o); code.push(OP.add); K(0); code.push(OP.store, 2, 0); } }
            else if (n.init) { const vt = val(n.init); code.push(OP.lset, ...uleb(SC)); code.push(OP.lget, ...uleb(FP)); K(v.off); code.push(OP.add, OP.lget, ...uleb(SC)); storeOp(v.type); void vt; }
            break;
          }
          case 'block': n.body.forEach(S); break;
          case 'expr': { val(n.e); code.push(OP.drop); break; }
          case 'return': if (n.e) val(n.e); else K(0); epilogue(); code.push(OP.ret); break;
          case 'if': val(n.c); code.push(OP.if, VOID); S(n.th); if (n.el) { code.push(OP.else); S(n.el); } code.push(OP.end); break;
          case 'while': code.push(OP.block, VOID, OP.loop, VOID); val(n.c); code.push(OP.eqz, OP.br_if, 1); S(n.body); code.push(OP.br, 0, OP.end, OP.end); break;
          case 'for': if (n.init) S(n.init); code.push(OP.block, VOID, OP.loop, VOID); if (n.cond) { val(n.cond); code.push(OP.eqz, OP.br_if, 1); } S(n.body); if (n.step) { val(n.step); code.push(OP.drop); } code.push(OP.br, 0, OP.end, OP.end); break;
          default: val(n); code.push(OP.drop);
        }
      };

      frame = (frame + 15) & ~15;
      code.push(OP.gget, 0); K(frame); code.push(OP.sub, OP.gset, 0);
      code.push(OP.gget, 0, OP.lset, ...uleb(FP));
      f.params.forEach((pp: Node, i: number) => { const v = vars.get(pp.name)!; code.push(OP.lget, ...uleb(FP)); K(v.off); code.push(OP.add, OP.lget, ...uleb(i)); storeOp(v.type); });
      f.body.forEach(S);
      K(0); epilogue(); code.push(OP.ret);
      return { body: code };
    }

    const sigs = new Map<number, number>(); const typeSec: number[][] = [];
    const getSig = (np: number): number => { if (sigs.has(np)) return sigs.get(np)!; const idx = typeSec.length; sigs.set(np, idx); typeSec.push([0x60, ...vec(Array(np).fill(0).map(() => [I32])), ...vec([[I32]])]); return idx; };
    getSig(0); getSig(1); getSig(3);    // заранее: builtins
    const compiled = funcs.map(genFunc);
    if (errors.length) return { ok: false, errors };

    const importSec = BUILTINS.map((n) => [...wstr('env'), ...wstr(n), 0x00, ...uleb(getSig(BARITY[n]))]);
    externs.forEach((e: Node) => importSec.push([...wstr('env'), ...wstr(e.name), 0x00, ...uleb(getSig(e.params.length))]));   // внешние -> импорты
    importSec.push([...wstr('env'), ...wstr('memory'), 0x02, 0x00, ...uleb(16)]);
    importSec.push([...wstr('env'), ...wstr('__sp'), 0x03, I32, 0x01]);
    const funcSecItems = funcs.map((f: Node) => uleb(getSig(f.params.length)));
    const tableSize = funcs.length + 1;
    const tableSec = [[FUNCREF, 0x00, ...uleb(tableSize)]];
    const elemSec = funcs.length ? [[0x00, OP.const, ...sleb(1), OP.end, ...vec(funcs.map((f: Node) => uleb(funcIndex.get(f.name)!)))]] : [];
    const exportSec = funcs.map((f: Node) => [...wstr(f.name), 0x00, ...uleb(funcIndex.get(f.name)!)]);
    exportSec.push([...wstr('__indirect_function_table'), 0x01, 0x00]);
    const codeSec = compiled.map((c) => { const body = [...vec([[2, I32]]), ...c.body, OP.end]; return [...uleb(body.length), ...body]; });
    const dataItems: number[][] = [];
    for (const { s, off } of strings) dataItems.push([0x00, OP.const, ...sleb(off), OP.end, ...uleb(s.length + 1), ...[...new TextEncoder().encode(s)], 0]);
    for (const g of gInit) dataItems.push([0x00, OP.const, ...sleb(g.off), OP.end, ...uleb(4), g.v & 255, (g.v >> 8) & 255, (g.v >> 16) & 255, (g.v >> 24) & 255]);

    const mod = [
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      ...section(1, vec(typeSec)),
      ...section(2, vec(importSec)),
      ...section(3, vec(funcSecItems)),
      ...section(4, vec(tableSec)),
      ...section(7, vec(exportSec)),
      ...(elemSec.length ? section(9, vec(elemSec)) : []),
      ...section(10, vec(codeSec)),
      ...(dataItems.length ? section(11, vec(dataItems)) : []),
    ];
    return { ok: true, wasm: new Uint8Array(mod), errors: [] };
  } catch (e) { return { ok: false, errors: [...errors, (e as Error).message] }; }
}

/* среда исполнения (libc на JS); out(s) — куда писать вывод */
export function makeEnv(out: (s: string) => void): { env: Record<string, unknown>; memory: WebAssembly.Memory } {
  const memory = new WebAssembly.Memory({ initial: 16 });
  const __sp = new WebAssembly.Global({ value: 'i32', mutable: true }, STACK_TOP);
  let heap = 8192;
  const u8 = () => new Uint8Array(memory.buffer); const dv = () => new DataView(memory.buffer);
  const rd = (p: number) => { const b = u8(); let s = ''; while (b[p]) s += String.fromCharCode(b[p++]); return s; };
  const printf = (fmt: number, args: number, n: number): number => {
    const f = rd(fmt); let s = '', ai = 0; const v = dv();
    for (let i = 0; i < f.length; i++) {
      if (f[i] === '%' && i + 1 < f.length) { const c = f[++i]; const a = ai < n ? v.getInt32(args + ai * 4, true) : 0; if ('diuxXcs'.includes(c)) ai++; s += c === 'd' || c === 'i' ? String(a) : c === 'u' ? String(a >>> 0) : c === 'x' ? (a >>> 0).toString(16) : c === 'X' ? (a >>> 0).toString(16).toUpperCase() : c === 'c' ? String.fromCharCode(a & 255) : c === 's' ? rd(a) : c === '%' ? '%' : '%' + c; }
      else s += f[i];
    }
    out(s); return s.length;
  };
  const env: Record<string, unknown> = {
    memory, __sp,
    putchar: (c: number) => { out(String.fromCharCode(c & 255)); return c; },
    puts: (p: number) => { out(rd(p) + '\n'); return 0; },
    print_str: (p: number) => { out(rd(p)); return 0; },
    print_int: (n: number) => { out(String(n | 0)); return 0; },
    getchar: () => -1,
    malloc: (n: number) => { const p = heap; heap = (heap + n + 7) & ~7; return p; },
    free: () => 0,
    __printf: printf,
  };
  return { env, memory };
}
