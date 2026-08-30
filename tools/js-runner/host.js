// ============================================================================
// js-runner — the composed checker, JavaScript PARITY host.
//
// A STRICT mu that mirrors tools/cs-runner/{Vocabulary,Mu}.cs point for
// point: a selector on an atom throws, a duplicate DEF throws, a comparison
// across atom kinds throws, an out-of-range selection throws. The strictness
// is the whole point — it is exactly what the two LENIENT js runners before
// it lacked, the leniency that once let a selector index a string to the
// character "F" and let ins_asc "sort" stringified arrays. Green under one mu
// is not green; this is the second, independent mu, and agreement between it
// and the C# host is the parity dividend made standing.
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
//
// It does NOT coerce a numeric-looking string, and that is mathematics, not
// pedantry: canon's eq does not coerce either (eq<1,"1"> = F, case:eq-nateq),
// and a coercing <= gives le<1,"1"> = T with le<"1",1> = T while eq<1,"1"> is
// F — antisymmetry violated, so <= would not be an order at all. The engine
// kernels DO coerce here and are the ones carrying the drift; the store's
// mixed int/lexical atoms are a READING-BOUNDARY defect (#31), to be fixed
// where text becomes values, not by breaking the order axioms in every host.
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
  // lt / reverse / trans are Backus 11.2.3 base. They were added to the java,
  // cs and rust hosts and MISSED here, so this head alone could not reduce
  // them — invisible to the law report, which never routes through them, and
  // invisible to the host diff until the case table crossed the lineages.
  "lt": x => bool(cmp(at(x,0), at(x,1)) < 0),
  "reverse": x => seq(x).slice().reverse(),
  "trans": x => { const rows = seq(x);
    if (rows.length === 0) return [];
    const w = seq(rows[0]).length;
    const out = [];
    // at() bounds-checks, so a RAGGED input refuses here exactly as it does
    // on the other hosts and in python; indexing raw would answer a row
    // holding undefined, which is not a value in the atom domain at all.
    for (let c = 0; c < w; c++) out.push(rows.map(r => at(r, c)));
    return out; },
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
  // lex yields TOKEN-RECORDS, ten fields per token, exactly as
  // metamodel/resolution.md types it. This head answered a flat word list, as
  // did the java, cs and rust hosts, so canon's system: family — sqlname
  // (5 . 1 . lex . slug, the 5th FIELD of token 1), rp_step (field 8, the
  // hyphen template), cf_dropw (filters on field 1) — was reading characters
  // here and fields in the engine kernels. One name, two functions, split by
  // lineage. Fields: tok, nopunct, base, ordinal-suffix, lower, quoted-text,
  // initial-cap, hyphen-template, is-quoted, quote-index.
  "lex": x => { if (typeof x !== "string") throw new Error("lex on non-string");
    const text = x, spans = [];
    for (const m of text.matchAll(/'[^']*'/g)) spans.push([m.index, m.index + m[0].length]);
    const strip = (s, cs) => { let a = 0, b = s.length;
      while (a < b && cs.includes(s[a])) a++;
      while (b > a && cs.includes(s[b - 1])) b--;
      return s.slice(a, b); };
    const rstrip = (s, cs) => { let b = s.length;
      while (b > 0 && cs.includes(s[b - 1])) b--; return s.slice(0, b); };
    const rows = [];
    for (const m of text.matchAll(/\S+/g)) {
      const tok = m[0], s = m.index, e = s + tok.length;
      let k = 0;
      for (let i = 0; i < spans.length; i++)
        if (s < spans[i][1] && spans[i][0] < e) { k = i + 1; break; }
      let qtext = "";
      if (k) qtext = text.slice(Math.max(s, spans[k - 1][0] + 1),
                                Math.min(e, spans[k - 1][1] - 1));
      const nopunct = strip(tok, ".;:,");
      const base = rstrip(nopunct, "0123456789");
      // field 8 is the NORMA hyphen template (#24): a one-sided touching
      // hyphen is the bind marker and is consumed, a doubled one escapes to
      // a single literal hyphen, anything else is as written.
      let tpl = tok;
      if (tpl.length > 2 && tpl.endsWith("--")) tpl = tpl.slice(0, -1);
      else if (tpl.length > 2 && tpl.startsWith("--")) tpl = tpl.slice(1);
      else if (tpl.length > 1 && tpl.endsWith("-")) tpl = tpl.slice(0, -1);
      else if (tpl.length > 1 && tpl.startsWith("-")) tpl = tpl.slice(1);
      rows.push([tok, nopunct, base, nopunct.slice(base.length), tok.toLowerCase(),
                 qtext, (base.length > 0 && base[0] >= "A" && base[0] <= "Z") ? "T" : "F",
                 tpl, k ? "T" : "F", k]);
    }
    return rows; },
  // ATOMS stringify, numbers included — which is what Arest.java's implode
  // already documents as "js Array.join semantics", what Mu.cs and the rust
  // host do, and what all three engine kernels do. This head was the one
  // that threw, contradicting the sibling it was transliterated into. It has
  // to stringify for canon to own a renderer at all: system:isnum is
  // not eq<x, implode<empty,<x>>>, and a base with NO operation total over
  // the atom domain leaves canon unable to tell 42 from the text 42.
  // Sequences still refuse — only atoms are words.
  "implode": x => seq(at(x,1)).map(w => {
    if (Array.isArray(w)) throw new Error("implode on sequence");
    return "" + w; }).join(at(x,0)),
  // slug yields an IDENTIFIER (resolution.md): every run of non-alphanumerics
  // becomes ONE underscore and the ends are trimmed. Canon defines the same
  // function as sl:slug; this registration stays only until both carriers are
  // regenerated and slug can leave the boundary manifest.
  // slug is CANON -- DEF("slug") with slug:alnum/step/trimlead. Deleted here.
  // char-level lex boundary (invariant ASCII on every host, so the
  // naming lex is byte-identical regardless of host culture)
  "chars": x => { if (typeof x !== "string") throw new Error("chars on non-string");
    return [...x]; },
  // FIRST CHARACTER. This head used to compare the WHOLE string — x >= "a" &&
  // x <= "z" — which agrees for the single chars `chars` yields but not
  // otherwise: charup("zebra") answered "zebra" here and "Z" on the other
  // seven hosts, since python and the java/cs/rust hosts all take the
  // leading char. One operation, one meaning; this head was the outlier.
  // charup is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
  // chardown is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
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
// induce:sig_of is the same case one level up, and it is the single biggest one
// in the unit tests. It is COMP(COND(null, PHI, N(2)), law:find_desc) — a PURE lookup
// of a named descriptor's signature — applied at 80 sites across 8 candidate
// generators, and it fired 28,200,366 times inside law:induce alone, with
// law:find_desc firing 28,203,649 (i.e. once each). Its argument is the pair
// <name, descs>: descs is a stable reference (were it fresh, DESCIDX would
// rebuild per call and dominate the profile) and name ranges over the model's
// fact-type names, so the distinct-input count is in the hundreds.
//   Bancilhon-Ramakrishnan 1986 sec 4.7 ranks this defect FIRST of the three
// that determine recursive-rule performance — "the repeated firing of a rule on
// the same data ... an iterative control strategy that does not remember
// previous firings" — and sizes the class at orders of magnitude. law:induce IS
// rule-firing over derivation candidates, so that is the governing reference,
// not an analogy.
const MEMOCN = new Set(["ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor",
  "cn:sfx", "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts",
  "cn:chrank", "lex:lw", "induce:sig_of"]);
function memoable(f) { return MEMOCN.has(f) || f.startsWith("rmap:") || f.startsWith("state:"); }
// Compiled forms of hot canon list cells (the lex-primitive precedent:
// the DEF stays the meaning; the head evaluates its extensional equal;
// the unit tests certify identity). Only consulted when the DEF exists.
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
  "theta:find_desc": x => { const name = at(x, 0), descs = seq(at(x, 1));
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
      && form[1] === "theta:flatten"
      && (form[3] === "distr" || form[3] === "distl")
      && Array.isArray(form[2]) && form[2][0] === "ALPHA") {
    const body = form[2][1];
    if (Array.isArray(body) && body[0] === "COND" && body.length === 4
        && Array.isArray(body[3]) && body[3][0] === "CONST"
        && Array.isArray(body[3][1]) && body[3][1].length === 0) {
      const p = body[1];
      if (Array.isArray(p) && p[0] === "COMP" && p.length === 3 && p[1] === "eq"
          && Array.isArray(p[2]) && p[2][0] === "CONS" && p[2].length === 3) {
        const l = p[2][1], r = p[2][2], rl = rootSel(l), rr = rootSel(r);
        // distr frames are <element, carrier>; distl frames are <carrier, element>.
        // So the ELEMENT sits at slot 1 under distr and at slot 2 under distl,
        // and the resolution below inverts with it.
        const dl = form[3] === "distl";
        const es = dl ? 2 : 1, cs = dl ? 1 : 2;
        if (rl === es && rr === cs) pat = { elem: l, carrier: r, emit: body[2], distl: dl };
        else if (rl === cs && rr === es) pat = { elem: r, carrier: l, emit: body[2], distl: dl };
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
  // ---- tau clause (c): METACOMPOSITION (Backus 13.3.2, 13.4) --------------
  //     (rho <x1..xn>):y = (rho x1):<<x1..xn>, y>
  // This head used to be MATCHED by the switch below and never FETCHED, which
  // meant the combining forms were host code by construction: a canon
  // DEF("CONS", ...) was unreachable, because the switch intercepted before
  // any lookup. That is the difference between an FP system, whose set of
  // forms "is fixed once and for all, and this set determines the power of
  // the system in a major way" (13.1), and an FFP system, where
  // metacomposition "permits the definition of new functional forms, in
  // effect, merely by defining new functions" (13.3.2). engine/rust had this
  // rule; the js head did not, and java/cs/rust-host were transliterated
  // from the js head, so all four CERTIFIED hosts lacked the only
  // mechanism the whole construction rests on.
  //
  // Fetching the head restores it, and it is the SAME rule already obeyed for
  // atoms in operator position a few lines above: consult DEFS, then fall to
  // the host. The switch below is now the primitive arm of that rule -- the
  // fast path taken only when the form atom is NOT shadowed by canon -- so it
  // is an optimization of the general case, not a separate dispatch. A
  // sequence head (a computed form) goes the general way, which the switch
  // could never express at all.
  if (typeof head !== "string" || DEFS.has(head)) return Ev(head, [f, x]);
  switch (head) {
    case "COMP": {
      // the written strategy only pays to replace once the scan is long
      // enough for the index build to be worth it
      const jp = (form.length === 4 || form.length === 5) ? joinPat(form) : null;
      let jx = jp === null ? null : (form.length === 5 ? Ev(form[4], x) : x);
      if (jp !== null && Array.isArray(jx) && jx.length === 2
          && Array.isArray(jx[jp.distl ? 1 : 0]) && jx[jp.distl ? 1 : 0].length > 32) {
        // distl delivers <carrier, list>, distr delivers <list, carrier>
        const list = jp.distl ? jx[1] : jx[0], carrier = jp.distl ? jx[0] : jx[1];
        let idx = JOINIDX.get(list);
        if (idx === undefined) { idx = new Map(); JOINIDX.set(list, idx); }
        let byKey = idx.get(jp.elem);
        if (byKey === undefined) {
          byKey = new Map();
          for (let i = 0; i < list.length; i++) {
            const k = JSON.stringify(Ev(jp.elem, jp.distl ? [carrier, list[i]] : [list[i], carrier]));
            let a = byKey.get(k); if (a === undefined) { a = []; byKey.set(k, a); }
            a.push(list[i]);
          }
          idx.set(jp.elem, byKey);
        }
        const want = JSON.stringify(Ev(jp.carrier, jp.distl ? [carrier, []] : [[], carrier]));
        const hits = byKey.get(want);
        if (hits === undefined) return [];
        const out = [];
        for (let i = 0; i < hits.length; i++) {
          const vs = seq(Ev(jp.emit, jp.distl ? [carrier, hits[i]] : [hits[i], carrier]));
          for (let j = 0; j < vs.length; j++) out.push(vs[j]);
        }
        return out;
      }
      let v = x;
      for (let i = form.length - 1; i >= 1; i--) v = Ev(form[i], v);
      return v;
    }
    // CONS and CONST are CANON now -- DEF("CONS", COMP(ALPHA(apply), tl, distr))
    // and DEF("CONST", COMP(2,1)), both Backus 13.3.2 verbatim. They are reached
    // through tau clause (c) above, which fetches the head instead of matching
    // it, so these two arms are dead: the switch is only the primitive arm, and
    // canon defines these. Deleting them is the point -- equivalence was already
    // proven (java and cs resolved them through their own switch while js
    // resolved them through canon, byte-identical), but only removal proves
    // REPLACEMENT. Eight copies of two theorems of the base, gone.
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

// ---- THE FOUR WAYS IN ---------------------------------------------------
// One host file. Each of these is transport only: it reads a request, applies
// canon, writes the answer. None of them may branch on a verb, a method or a
// status -- what those MEAN is canon's business (ui:route routes, render:json
// renders, http:status_of decides the code, auth:links decides which controls
// a caller is shown). If you are about to add such a branch here, that is how
// a thin host stops being thin.
function run_cli() {

  // THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
  // All dispatch and all text live in canon `main`; a new operation is a
  // canon edit, never a host edit. Adding a branch here is how runners die.
  const out = Ev("main", [CELLS, process.argv.slice(2)]);
  console.log(out[0]);
  process.exit(out[1] === "T" ? 0 : 1);

}
function run_test() {

  // THE TEST TAIL. tail.part.js holds the host contract -- six lines, argv atoms
  // in, one text atom out, process.exit -- and that contract is exactly what
  // makes it unusable from a test file: it runs on import and then exits.
  //
  // This variant is the same composition with the last step removed. It exposes
  // the evaluator and the cells and runs nothing, so a test can drive canon's
  // own `main` the way the CLI does -- Ev("main", [CELLS, ["case", name]]) -- and
  // assert the answer, without a process per case.
  //
  // Nothing is added: no dispatch, no rendering, no branch. A test that needed
  // either would be testing the runner instead of the canon.
  globalThis.AREST = { Ev: Ev, CELLS: CELLS };

}
function run_serve() {

  // THE SERVING TAIL. Same composition, same evaluator, one different last step:
  // tail.part.js prints a text atom and exits, and this binds a socket instead.
  //
  // Sam: nothing custom should wrangle it into a HATEOAS server besides the
  // native registrations required for serving. That holds here because
  // AREST.tex:260 leaves nothing to compose -- every component of repr(e), the
  // selectors on its facts, the derived facts, the violations and links(e), is
  // (rho f):P for some object f. So this reads a request, applies main:api, and
  // writes the two answers it gets back. There is no dispatch here, no rendering,
  // no status decision, no authorization check: ui:route routes, render:json
  // renders, http:status_of decides the code, and auth:links decides which
  // controls this caller is even shown.
  //
  // If you are about to add a branch to this file, stop -- that is how the last
  // seven hosts died, and it is how the compiler came to be 7,196 lines.
  //
  // THE ONE APPARENT BRANCH IS NOT ONE. The body is read unconditionally and a
  // failure answers the empty sequence, so a GET (no body) and a POST (a fact)
  // take the same path. Testing the method here would be the host deciding what a
  // method MEANS, which is http:method_kinds' job.
  const PORT = Number(process.env.AREST_PORT || 8787);

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      // the caller is transport-level identity; who that caller MAY be is the
      // designated authorization fact type's business, not this file's
      const caller = req.headers.get("x-arest-caller") || "";
      const resource = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const fact = await req.json().catch(() => []);
      const out = Ev("main:api", [CELLS, req.method, resource, caller, fact]);
      return new Response(String(out[0]), {
        status: Number(out[1]) || 500,
        headers: { "content-type": "application/json" },
      });
    },
  });

  console.error("arest serving on :" + PORT);

}
function run_mcp() {

  // THE MCP TAIL. Same composition, same evaluator, one different last step:
  // tail.part.js prints a text atom and exits, serve-tail.part.js binds a socket,
  // and this speaks JSON-RPC over stdio. It is the SAME six lines as the serving
  // tail over a different transport, because a tool call and a POST are the same
  // operation: <cells, method, resource, caller, fact> through main:api.
  //
  // THERE IS NO VERB TABLE HERE, and two earlier versions of this file had one.
  // A verb is a PREDICATE VERBALIZATION -- doing one is creating a fact that uses
  // that verb in its predicate -- so a tool is a FACT TYPE and its parameters are
  // that predicate's roles. Both come from the store: canon's mcp:tools derives
  // the list the same way links(e) is derived, so a fact type added to a model is
  // served without touching canon or this file.
  //
  // The first version listed eighteen canon FUNCTION names and dispatched them by
  // apply. They resolve, and eight of eight answered operand errors, because a
  // function wants an operand of its own shape and a predicate wants role
  // players. The second cut to five verbs main dispatches by argv: that works and
  // says nothing about the model. Both were host verb tables; one of them was
  // just living in canon.
  //
  // RBAC IS NOT A FEATURE HERE. The caller is transport-level identity; which
  // controls that caller may use is auth:links' business, decided by the
  // designated authorization fact type, and it is already decided inside main:api.
  const TOOLS = Ev("mcp:tools", CELLS);
  // the admitted methods are canon's too -- http:method_kinds, not a constant
  const METHODS = Ev("http:method_kinds", []).map((m) => String(m[0]));

  function tools() {
    return TOOLS.map((t) => {
      // state:declared carries each fact type's PLAYER TYPES in role order, so
      // the reading and its signature are the same row
      const players = Array.isArray(t[1]) ? t[1].map(String) : [];
      return {
        name: String(t[0]),
        description:
          "fact type " + t[0] +
          (players.length ? "; roles played by " + players.join(", ") : ""),
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: METHODS,
                      description: "GET reads and returns links; POST asserts a fact" },
            caller: { type: "string", description: "who is calling; gates which controls are shown" },
            fact: { type: "array", description: "the role players, in role order" },
          },
          required: ["method"],
        },
      };
    });
  }

  function call(name, args) {
    const a = args || {};
    // no dispatch: the resource IS the fact type and the method IS the operation
    return Ev("mcp:call", [
      String(a.method || METHODS[0]),
      String(name),
      String(a.caller || ""),
      Array.isArray(a.fact) ? a.fact : [],
      CELLS,
    ]);
  }

  function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
  function fail(id, message) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message } };
  }

  function handle(msg) {
    if (msg.method === "initialize") {
      return reply(msg.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "arest", version: "1.0.0" },
      });
    }
    if (msg.method === "tools/list") return reply(msg.id, { tools: tools() });
    if (msg.method === "tools/call") {
      const p = msg.params || {};
      try {
        // main:api answers <text, status>; the status is canon's decision, and a
        // 4xx is an answer about the model rather than a transport fault
        const out = call(p.name, p.arguments);
        const status = Number(out && out[1]) || 500;
        return reply(msg.id, {
          content: [{ type: "text", text: out && out[0] !== undefined ? String(out[0]) : "" }],
          isError: status >= 400,
        });
      } catch (e) {
        return reply(msg.id, { content: [{ type: "text", text: String(e.message) }], isError: true });
      }
    }
    if (msg.id === undefined) return null;          // a notification wants no reply
    return fail(msg.id, "unknown method: " + msg.method);
  }

  let buf = "";
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    for (;;) {
      const nl = buf.indexOf("\n");
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let out;
      try {
        out = handle(JSON.parse(line));
      } catch (e) {
        out = fail(null, String(e.message));
      }
      if (out) process.stdout.write(JSON.stringify(out) + "\n");
    }
  });

  console.error("arest mcp: " + TOOLS.length + " fact types, " + METHODS.join("/") + ", all of it derived");

}

// ---- SQL ---------------------------------------------------------------
// A host that supports sql needs no schema knowledge of its own. Canon derives
// the relational mapping -- 297 rmap defs, checked against NORMA's own answer
// by 13 laws -- and rmap:ddl renders it as the CREATE TABLE script. All this
// does is open a database, run that script, and execute the caller's query.
// Deciding what the tables ARE would be this file taking canon's job.
//
// This used to live in engine/python (ddl.project(D, con)) and the rust
// resident's `sql` verb, which is why it went out with the fat hosts. It was
// never fat-host work: it is I/O, exactly like a socket or stdin.
function run_sql() {
  const { Database } = require("bun:sqlite");
  const argv = process.argv.slice(2);
  const path = process.env.AREST_DB || ":memory:";
  const db = new Database(path);
  db.run(String(Ev("rmap:ddl", CELLS)));
  const query = argv[0];
  if (!query) {
    const t = db.query("select name from sqlite_master where type = ?").all("table");
    console.log(t.map((r) => r.name).join("\n"));
    return;
  }
  for (const row of db.query(query).all()) console.log(JSON.stringify(row));
}

// The mode is the only thing the build chooses; everything else is identical,
// which is the point of there being one file.
// D CONTAINS FILE. Definition 1 of the paper: an AREST system is a Backus AST
// system whose FILE cell contains a population P of a schema S -- Backus carries
// a FILE cell and declines to structure it, Codd supplies the structure, Halpin
// the design, and that hole is what AREST fills. ast:File builds it, one
// relational cell per entity (RMAP: the 3NF row of facts depending on its key).
//
// Nothing called it. Its only caller was law:filecells -- a law that builds FILE
// to check it, while the runtime never built one -- so every composed store had
// FILE = "#", every population lookup fell through ast:FetchPop's fallback and
// found nothing, status(e) was unknown, and links(e) was empty for every entity
// that ever had a state machine.
//
// This is the load step, and it belongs beside loading the carriers: the host
// composes the store, and a store without FILE is not one. Canon decides what
// FILE IS; this only puts it there, before the first evaluation, and clears the
// memo at the mutation point as the note above requires.
function loadFile() {
  if (Ev("ast:fetch", ["FILE", CELLS]) !== "#") return;   // already carried
  const built = Ev("ast:File", Ev("store:state", CELLS));
  for (const cell of built) CELLS.unshift(cell);
  memoClear();
}

function boot(mode) {
  loadFile();
  if (mode === "test") return run_test();
  if (mode === "serve") return run_serve();
  if (mode === "mcp") return run_mcp();
  if (mode === "sql") return run_sql();
  return run_cli();
}
