// ============================================================================
// js-runner — the composed checker, JavaScript PARITY station.
//
// A STRICT mu that mirrors tools/cs-runner/{Vocabulary,Mu}.cs point for
// point: a selector on an atom throws, a duplicate DEF throws, a comparison
// across atom kinds throws, an out-of-range selection throws. The strictness
// is the whole point — it is exactly what the two LENIENT js runners before
// it lacked, the leniency that once let a selector index a string to the
// character "F" and let ins_asc "sort" stringified arrays. Green under one mu
// is not green; this is the second, independent mu, and agreement between it
// and the C# station is the parity dividend made standing.
//
// This is a PARITY ORACLE, not a runner to iterate on. Both predecessors died
// of accretion (fallback name lists, guards, app-mode logic, comparison logic
// leaking in beside the canon). NOTHING in this file holds law semantics. If
// you ever add a guard or a name list here, delete it — that is precisely how
// the last two died. The canon and carriers arrive AS SOURCE (the one tuple
// literal reads as a CANON(...) call, the rest-parameter wrap) and node just
// EXECs the composed file: nothing is read, eval'd, or interpreted at runtime.
// ============================================================================

// ---- the registration vocabulary: DEF, A, N, K, PHI, S1..S9, CANON --------
// DEF accumulates the composed store (one CELL per registered name) so the
// store reads itself; a duplicate throws by collection semantics, exactly as
// the C# Dictionary.Add does — law:one_name is the law.
const DEFS = new Map();
const CELLS = [];
function DEF(name, body) {
  if (DEFS.has(name)) throw new Error("duplicate DEF: " + name);
  DEFS.set(name, body);
  CELLS.push(["CELL", name, body]);
  return name;
}
function A(s) { return s; }
function N(n) { return n; }
function K(x) { return ["CONST", x]; }
function PHI() { return []; }
// Backus 13.2 rule 4: <x1..xn> is a sequence FOR ANY n. The S1..S9 family
// is notation, not mathematics, and a carrier that exceeds it must NOT
// encode its length as depth — depth already means tenancy here (14.7,
// AREST.tex prop:tenant). S is the arity-free spelling; S1..S9 stay for
// short literals, where the fixed arity reads better.
function S(){return Array.prototype.slice.call(arguments);}
function S1(a){return [a];}
function S2(a,b){return [a,b];}
function S3(a,b,c){return [a,b,c];}
function S4(a,b,c,d){return [a,b,c,d];}
function S5(a,b,c,d,e){return [a,b,c,d,e];}
function S6(a,b,c,d,e,f){return [a,b,c,d,e,f];}
function S7(a,b,c,d,e,f,g){return [a,b,c,d,e,f,g];}
function S8(a,b,c,d,e,f,g,h){return [a,b,c,d,e,f,g,h];}
function S9(a,b,c,d,e,f,g,h,i){return [a,b,c,d,e,f,g,h,i];}
function CANON() { return arguments; }

// ---- helpers: seq / at strictly mirror C# Seq(x) and Seq(x)[i] ------------
function show(x) { return Array.isArray(x) ? "[" + x.map(show).join(",") + "]" : "" + x; }
function seq(x) {
  if (!Array.isArray(x)) throw new Error("expected sequence, got atom: " + show(x));
  return x;
}
function at(x, i) {
  const a = seq(x);
  if (i < 0 || i >= a.length) throw new Error("index " + i + " out of " + a.length);
  return a[i];
}
function bool(b) { return b ? "T" : "F"; }

// deep structural equality; a number and a string are never equal (=== is
// strict, mirroring C# DeepEq's separate int-vs-string cases)
function deepEq(a, b) {
  if (a === b) return true;
  const aa = Array.isArray(a), ba = Array.isArray(b);
  if (!aa || !ba) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
  return true;
}

// CompareAtoms: both numbers -> numeric; both strings -> ordinal (UTF-16
// code unit, which equals C#'s string.CompareOrdinal); anything else THROWS,
// exactly as C# throws casting a non-string to string. This is the strictness
// the lenient js mu lacked.
function cmp(a, b) {
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  throw new Error("compare across atom kinds: " + show(a) + " vs " + show(b));
}

// ---- the base primitives: Backus 11.2.3 plus the registered boundary rows
// of resolution.md (lex, implode, slug, escape_html, strip_prefix, 1r, tlr).
// Each mirrors its Mu.cs form; unary prims take x, pair prims take at(x,0/1). -
const PRIMS = new Map(Object.entries({
  "id": x => x,
  "tl": x => { const a = seq(x); if (a.length === 0) throw new Error("tl on empty"); return a.slice(1); },
  "atom": x => bool(!Array.isArray(x)),
  "apndl": x => [at(x,0), ...seq(at(x,1))],
  "apndr": x => [...seq(at(x,0)), at(x,1)],
  "distl": x => { const h = at(x,0); return seq(at(x,1)).map(e => [h, e]); },
  "distr": x => { const t = at(x,1); return seq(at(x,0)).map(e => [e, t]); },
  "cat": x => [...seq(at(x,0)), ...seq(at(x,1))],
  "null": x => bool(Array.isArray(x) && x.length === 0),
  "eq": x => bool(deepEq(at(x,0), at(x,1))),
  "not": x => bool(!(x === "T")),
  "and": x => bool(at(x,0) === "T" && at(x,1) === "T"),
  "length": x => seq(x).length,
  "le": x => bool(cmp(at(x,0), at(x,1)) <= 0),
  "ge": x => bool(cmp(at(x,0), at(x,1)) >= 0),
  "gt": x => bool(cmp(at(x,0), at(x,1)) > 0),
  "+": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("+ on non-number");
    return a + b; },
  "-": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("- on non-number");
    return a - b; },
  "*": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("* on non-number");
    return a * b; },
  "/": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("/ on non-number");
    if (b === 0) throw new Error("division by zero");
    return Math.trunc(a / b); },
  "apply": x => Ev(at(x,0), at(x,1)),
  "lex": x => { if (typeof x !== "string") throw new Error("lex on non-string");
    return x.split(/\s+/).filter(w => w.length > 0); },
  "implode": x => seq(at(x,1)).map(w => {
    if (typeof w !== "string") throw new Error("implode on non-string");
    return w; }).join(at(x,0)),
  "slug": x => { if (typeof x !== "string") throw new Error("slug on non-string");
    return [...x.toLowerCase()].filter(c => /[\p{L}\p{Nd}]/u.test(c)).join(""); },
  // char-level lex boundary (invariant ASCII on every station, so the
  // naming lex is byte-identical regardless of host culture)
  "chars": x => { if (typeof x !== "string") throw new Error("chars on non-string");
    return [...x]; },
  "charup": x => (x >= "a" && x <= "z") ? String.fromCharCode(x.charCodeAt(0) - 32) : x,
  "chardown": x => (x >= "A" && x <= "Z") ? String.fromCharCode(x.charCodeAt(0) + 32) : x,
  "charisup": x => (x >= "A" && x <= "Z") ? "T" : "F",
  "charislow": x => (x >= "a" && x <= "z") ? "T" : "F",
  "charisdigit": x => (x >= "0" && x <= "9") ? "T" : "F",
  "escape_html": x => x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),
  "strip_prefix": x => { const pre = at(x,0), t = at(x,1);
    return (t.length > pre.length && t.startsWith(pre)) ? t.slice(pre.length) : t; },
  "ntoa": x => { if (typeof x !== "number") throw new Error("ntoa on non-number"); return "" + x; },
  "quote_str": x => { if (typeof x !== "string") throw new Error("quote_str on non-string");
    return "\"" + x.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + "\""; },
  "1r": x => { const a = seq(x); if (a.length === 0) throw new Error("1r on empty"); return a[a.length - 1]; },
  "tlr": x => { const a = seq(x); if (a.length === 0) throw new Error("tlr on empty"); return a.slice(0, a.length - 1); },
}));

// ---- the mu: atoms resolve through DEFS then the primitives, numbers are
// selectors, sequences are the seven functional forms (COMP right-to-left,
// CONS, CONST, COND, ALPHA, INSERT as a right fold, WHILE). Booleans are the
// atoms "T" and "F". No law semantics live here. ---------------------------
// ---- pure-application memo. Evaluation is pure and D is frozen during a
// step (Backus 14.6), so a named cell applied to the same input is the same
// value; remembering it is evaluator quality, not semantics. Keys: atoms by
// value, sequences by reference (small frames by element, so ctx-threaded
// references hit). Any harness that mutates CELLS between evaluations MUST
// call memoClear() at the mutation point. Bounded: full clear past the cap.
const EVMEMO = new Map();
let EVMEMON = 0;
// Backus 13.3.4 defines fetch as a linear walk (`↑n∘tl:x`), and canon's
// law:find_desc is that walk: filter the descriptors by name, take the
// first. The MEANING is "the first descriptor named n" — a lookup. The
// walk is the evaluator's business, so the head indexes it: one pass per
// descriptor-list object, cached by reference, then O(1) per name. Keyed
// weakly so a dropped list collects; cleared with the memo at mutations.
let DESCIDX = new WeakMap();
let ENTIDX = new WeakMap();
let JOINIDX = new WeakMap();
function memoClear() { EVMEMO.clear(); EVMEMON = 0; DESCIDX = new WeakMap(); ENTIDX = new WeakMap(); JOINIDX = new WeakMap(); }
// Selective: only cells whose inputs actually repeat (store-applied
// rmap cells and fetches keyed by the frozen CELLS reference; the
// walk's ctx-threaded helpers keyed by element references; lex:parts
// keyed by the name atom). Whole-frame cells like cn:step see fresh
// arrays every call - memoizing them is pure overhead.
// cn:chrank and lex:lw are the SAME "keyed by the name atom" case as lex:parts
// beside them, and were simply missed. Both are pure functions of ONE atom, so
// the memo key is that atom by value and the entry count is bounded by the
// number of distinct inputs, not by the number of calls.
//   cn:chrank is the rank of a character in the FIXED 37-char alphabet
//   "0123456789:abcdefghijklmnopqrstuvwxyz" — a table lookup written as a WHILE
//   walk that rebuilds the alphabet from the string constant on every call. It
//   is the same shape as law:find_desc above ("the MEANING is a lookup; the walk
//   is the evaluator's business"), and it ran 567,148 times inside ONE law with
//   at most ~37 distinct inputs. Its loop is the top four counters in the
//   profile: eq 77.4M, null 20.2M, tl 13.8M, + 11.8M.
//   lex:lw lowercases a word (implode . ALPHA chardown . chars) and ran 544,712
//   times for 7.55M chardown calls — ~13.9 characters per word, i.e. essentially
//   every chardown in the profile.
// Both are memoised, not rewritten: canon keeps the meaning, the head stops
// recomputing it. Correctness needs nothing beyond purity, which is what
// Backus 14.6 already guarantees while D is frozen.
const MEMOCN = new Set(["law:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor",
  "cn:sfx", "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts",
  "cn:chrank", "lex:lw"]);
function memoable(f) { return MEMOCN.has(f) || f.startsWith("rmap:") || f.startsWith("state:"); }
// Compiled forms of hot canon list cells (the lex-primitive precedent:
// the DEF stays the meaning; the head evaluates its extensional equal;
// the wall certifies identity). Only consulted when the DEF exists.
const FASTPRIMS = new Map(Object.entries({
  "theta:member": x => bool(seq(at(x, 1)).some(e => deepEq(at(x, 0), e))),
  "theta:filter_eq": x => seq(x).filter(p => deepEq(at(p, 0), at(p, 1))),
  // access cells - each mirrors its DEF's edges exactly: negative
  // counts drain, last on empty is "?", nth out-of-range throws the
  // selector error, dedup keeps LAST occurrences (the right fold),
  // setminus is a multiset filter of the first argument.
  "theta:drop": x => { const l = seq(at(x, 0)); const n = at(x, 1);
    return l.slice(n === 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n))); },
  "theta:take": x => { const l = seq(at(x, 0)); const n = at(x, 1);
    return l.slice(0, n === 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n))); },
  "theta:nth": x => { const l = seq(at(x, 0)); const n = at(x, 1);
    const k = n === 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n));
    if (k >= l.length) throw new Error("selector 1 out of range 0");
    return l[k]; },
  "theta:last": x => { const l = seq(x); return l.length ? l[l.length - 1] : "?"; },
  "theta:butlast": x => { const l = seq(x); return l.slice(0, Math.max(0, l.length - 1)); },
  "theta:iota": x => { if (typeof x !== "number") throw new Error("iota on non-number");
    const out = []; for (let i = 1; i <= x; i++) out.push(i); return out; },
  "theta:zip": x => { const a = seq(at(x, 0)), b = seq(at(x, 1));
    const n = Math.min(a.length, b.length); const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = [a[i], b[i]]; return out; },
  "theta:dedup": x => { const l = seq(x); const seen = new Set(); const out = [];
    for (let i = l.length - 1; i >= 0; i--) { const k = JSON.stringify(l[i]);
      if (!seen.has(k)) { seen.add(k); out.push(l[i]); } }
    out.reverse(); return out; },
  "theta:setminus": x => { const a = seq(at(x, 0)), b = seq(at(x, 1));
    const drop = new Set(b.map(e => JSON.stringify(e)));
    return a.filter(e => !drop.has(JSON.stringify(e))); },
  // theta:flatten = INSERT cat, and cat copies BOTH operands, so the right
  // fold recopies every suffix: O(total x sublists) — quadratic in the
  // number of sublists, which is what made the induce candidate crosses
  // (10^5 sublists) cost minutes. The VALUE is just the concatenation, so
  // the head builds it in one linear pass. seq() on each element keeps the
  // DEF's edge: a non-sequence element is an error, exactly as cat throws.
  "theta:flatten": x => { const out = [];
    for (const s of seq(x)) { const a = seq(s);
      for (let i = 0; i < a.length; i++) out.push(a[i]); }
    return out; },
  // the indexed fetch. Mirrors the DEF's edges exactly: distl pairs the
  // name against each descriptor, keep_named survives those whose head
  // equals it, the right fold preserves source order, and the empty
  // survivor list yields PHI. First-named-wins is Backus's own rule for
  // cells ("the FIRST cell named n"), so the index keeps the first.
  // cn:entsat = COMP(theta:flatten, ALPHA(COND(eq(<1,1>,<2>), <2,1>, PHI)), distr)
  // — distribute the key over the list, keep entries whose first field equals
  // it, emit their second, flatten. That is an ASSOC LOOKUP written as a scan,
  // and the profile charges it 5.3M eq. The index keys on the first field only,
  // so an entry whose SECOND field is not a sequence still throws exactly where
  // the fold would have thrown: at the matching entry, never at an unmatched one.
  "cn:entsat": x => { const l = seq(at(x, 0)), k = at(x, 1);
    let idx = ENTIDX.get(l);
    if (idx === undefined) { idx = new Map();
      for (const e of l) { if (!Array.isArray(e) || e.length < 2) continue;
        const kk = JSON.stringify(e[0]);
        let a = idx.get(kk); if (a === undefined) { a = []; idx.set(kk, a); }
        a.push(e[1]); }
      ENTIDX.set(l, idx); }
    const hit = idx.get(JSON.stringify(k));
    if (hit === undefined) return [];
    const out = [];
    for (const v of hit) { const vs = seq(v); for (let i = 0; i < vs.length; i++) out.push(vs[i]); }
    return out; },
  "law:find_desc": x => { const name = at(x, 0), descs = seq(at(x, 1));
    let idx = DESCIDX.get(descs);
    if (idx === undefined) { idx = new Map();
      for (const d of descs) { if (!Array.isArray(d) || d.length === 0) continue;
        const k = JSON.stringify(d[0]);
        if (!idx.has(k)) idx.set(k, d); }
      DESCIDX.set(descs, idx); }
    const hit = idx.get(JSON.stringify(name));
    return hit === undefined ? [] : hit; },
}));
// ---- INSERT filter fast path ---------------------------------------------
// Canon filters with a right fold that prepends every survivor:
//   INSERT (COND p apndl @2)   or   INSERT (COND p (apndl . CONS v @2) @2)
// apndl copies its tail, so each survivor recopies the whole accumulator and
// the fold is quadratic in survivors — measured at 40.8e9 element copies in
// one law:induce. The VALUE is just the survivors in source order followed by
// the fold's base, so when the body is exactly that shape the head builds it
// in one linear pass. Soundness rests on FRAME POSITION: the fold frame is
// <element, accumulator>, and the body may reach it only through selector 1.
// Anything handed the whole frame (a bare name, ALPHA/INSERT/WHILE) could
// read the accumulator, so it is rejected and the fold runs as written.
function framePure(f) {
  if (typeof f === "number") return f === 1;
  if (!Array.isArray(f)) return false;
  switch (f[0]) {
    case "CONST": return true;
    case "COMP": return framePure(f[f.length - 1]);
    case "CONS": case "COND":
      for (let i = 1; i < f.length; i++) if (!framePure(f[i])) return false;
      return true;
    default: return false;
  }
}
// ---- the filter-join fast path -------------------------------------------
// COMP(theta:flatten, ALPHA(COND(eq[a,b], emit, PHI)), distr) applied to
// <list, carrier> distributes the carrier over the list and keeps the pairs
// whose keys agree — a HASH JOIN WRITTEN AS A NESTED LOOP. canon does this at
// 23 sites over rmap:gmi; on auto.dev the s1p x gmi pair is 1344 x 1344 =
// 1,806,336 iterations, and rmap:childrenN0 re-evaluates a 1085-node COND on
// every one of them.
//   Backus 12.2 I.7: distl o [f, [g1..gn]] == [[f,g1]..[f,gn]], "the analogous
//   law holds for distr" — distr's result is determined by its two arguments,
//   so an equal-keys filter over it may be answered by an index. Meaning is
//   canon's; this is only strategy.
// SAFETY: the two sides of the eq must be ROOTED at different frame slots —
// one reading only the element, one only the carrier. Otherwise the key is not
// a function of the element alone and no index is valid.
const JOINPAT = new WeakMap();
function rootSel(f) {
  if (typeof f === "number") return f;
  if (Array.isArray(f) && f[0] === "COMP") return rootSel(f[f.length - 1]);
  return 0;
}
function joinPat(form) {
  if (JOINPAT.has(form)) return JOINPAT.get(form);
  let pat = null;
  // length 4: the <list, carrier> pair arrives as x.
  // length 5: the pair is built by form[4] — canon usually writes the operand
  // inline, e.g. COMP(flatten, ALPHA(..), distr, CONS(rmap:gmi, ..)), and
  // missing that spelling is why the first cut of this path never fired on
  // rmap:childrenN0, which is the whole 1344x1344 case.
  if ((form.length === 4 || form.length === 5)
      && form[1] === "theta:flatten" && form[3] === "distr"
      && Array.isArray(form[2]) && form[2][0] === "ALPHA") {
    const body = form[2][1];
    if (Array.isArray(body) && body[0] === "COND" && body.length === 4
        && Array.isArray(body[3]) && body[3][0] === "CONST"
        && Array.isArray(body[3][1]) && body[3][1].length === 0) {
      const p = body[1];
      if (Array.isArray(p) && p[0] === "COMP" && p.length === 3 && p[1] === "eq"
          && Array.isArray(p[2]) && p[2][0] === "CONS" && p[2].length === 3) {
        const l = p[2][1], r = p[2][2], rl = rootSel(l), rr = rootSel(r);
        if (rl === 1 && rr === 2) pat = { elem: l, carrier: r, emit: body[2] };
        else if (rl === 2 && rr === 1) pat = { elem: r, carrier: l, emit: body[2] };
      }
    }
  }
  JOINPAT.set(form, pat);
  return pat;
}
const FOLDPAT = new WeakMap();
const FOLDPATN = new Map();
// the fold body is usually a NAME (INSERT law:keep_named), so resolve names
// to their DEF before matching — a named cell is applied to the same frame.
function filterFold(body) {
  if (typeof body === "string") {
    if (FASTPRIMS.has(body) || !DEFS.has(body)) return null;
    let p = FOLDPATN.get(body);
    if (p === undefined) {
      FOLDPATN.set(body, null);          // cycle guard while resolving
      p = filterFold(DEFS.get(body));
      FOLDPATN.set(body, p);
    }
    return p;
  }
  if (!Array.isArray(body)) return null;
  let pat = FOLDPAT.get(body);
  if (pat !== undefined) return pat;
  pat = null;
  const then = body[2];
  if (body[0] === "COND" && body.length === 4 && body[3] === 2 && framePure(body[1])) {
    if (then === "apndl") pat = { pred: body[1], val: null };
    else if (Array.isArray(then) && then[0] === "COMP" && then.length === 3
      && then[1] === "apndl" && Array.isArray(then[2]) && then[2][0] === "CONS"
      && then[2].length === 3 && then[2][2] === 2 && framePure(then[2][1]))
      pat = { pred: body[1], val: then[2][1] };
  }
  FOLDPAT.set(body, pat);
  return pat;
}
function Ev(f, x) {
  if (typeof f === "number") {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    if (f < 1 || f > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[f - 1];
  }
  if (typeof f === "string") {
    if (DEFS.has(f)) {
      const fp = FASTPRIMS.get(f);
      if (fp !== undefined) return fp(x);
      if (!memoable(f)) return Ev(DEFS.get(f), x);
      let node = EVMEMO.get(f);
      if (node === undefined) { node = new Map(); EVMEMO.set(f, node); }
      const chain = (Array.isArray(x) && x.length <= 4) ? [x.length, ...x] : [-1, x];
      for (let i = 0; i < chain.length - 1; i++) {
        let nn = node.get(chain[i]);
        if (nn === undefined) { nn = new Map(); node.set(chain[i], nn); }
        node = nn;
      }
      const last = chain[chain.length - 1];
      if (node.has(last)) return node.get(last);
      const v = Ev(DEFS.get(f), x);
      node.set(last, v);
      if (++EVMEMON > 400000) memoClear();
      return v;
    }
    if (PRIMS.has(f)) return PRIMS.get(f)(x);
    throw new Error("unresolved atom: " + f);
  }
  const form = seq(f);
  const head = form[0];
  switch (head) {
    case "COMP": {
      // the written strategy only pays to replace once the scan is long
      // enough for the index build to be worth it
      const jp = (form.length === 4 || form.length === 5) ? joinPat(form) : null;
      let jx = jp === null ? null : (form.length === 5 ? Ev(form[4], x) : x);
      if (jp !== null && Array.isArray(jx) && jx.length === 2
          && Array.isArray(jx[0]) && jx[0].length > 32) {
        const list = jx[0], carrier = jx[1];
        let idx = JOINIDX.get(list);
        if (idx === undefined) { idx = new Map(); JOINIDX.set(list, idx); }
        let byKey = idx.get(jp.elem);
        if (byKey === undefined) {
          byKey = new Map();
          for (let i = 0; i < list.length; i++) {
            const k = JSON.stringify(Ev(jp.elem, [list[i], carrier]));
            let a = byKey.get(k); if (a === undefined) { a = []; byKey.set(k, a); }
            a.push(list[i]);
          }
          idx.set(jp.elem, byKey);
        }
        const want = JSON.stringify(Ev(jp.carrier, [[], carrier]));
        const hits = byKey.get(want);
        if (hits === undefined) return [];
        const out = [];
        for (let i = 0; i < hits.length; i++) {
          const vs = seq(Ev(jp.emit, [hits[i], carrier]));
          for (let j = 0; j < vs.length; j++) out.push(vs[j]);
        }
        return out;
      }
      let v = x;
      for (let i = form.length - 1; i >= 1; i--) v = Ev(form[i], v);
      return v;
    }
    case "CONS": {
      const out = new Array(form.length - 1);
      for (let i = 1; i < form.length; i++) out[i - 1] = Ev(form[i], x);
      return out;
    }
    case "CONST": return form[1];
    case "COND": return Ev(form[1], x) === "T" ? Ev(form[2], x) : Ev(form[3], x);
    case "ALPHA": return seq(x).map(e => Ev(form[1], e));
    case "INSERT": {
      const xs = seq(x);
      if (xs.length === 0) throw new Error("INSERT on empty");
      const base = xs[xs.length - 1];
      // small folds keep the written strategy: the fast path only pays off
      // once the accumulator is long enough for the copying to bite.
      const pat = (xs.length > 32 && Array.isArray(base)) ? filterFold(form[1]) : null;
      if (pat !== null) {
        const out = [];
        for (let i = 0; i < xs.length - 1; i++) {
          // the accumulator slot is null: framePure proved it unreachable,
          // so a stray read fails loudly instead of reading stale data.
          const frame = [xs[i], null];
          if (Ev(pat.pred, frame) === "T")
            out.push(pat.val === null ? xs[i] : Ev(pat.val, frame));
        }
        for (let i = 0; i < base.length; i++) out.push(base[i]);
        return out;
      }
      let acc = base;
      for (let i = xs.length - 2; i >= 0; i--) acc = Ev(form[1], [xs[i], acc]);
      return acc;
    }
    case "WHILE": {
      let v = x;
      while (Ev(form[1], v) === "T") v = Ev(form[2], v);
      return v;
    }
  }
  throw new Error("unknown form: " + head);
}

// the canon's one tuple literal follows, reading as a single CANON(...) call
// whose DEF side effects populate CELLS in registration order:
CANON
