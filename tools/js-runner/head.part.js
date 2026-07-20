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
function Ev(f, x) {
  if (typeof f === "number") {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    if (f < 1 || f > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[f - 1];
  }
  if (typeof f === "string") {
    if (DEFS.has(f)) return Ev(DEFS.get(f), x);
    if (PRIMS.has(f)) return PRIMS.get(f)(x);
    throw new Error("unresolved atom: " + f);
  }
  const form = seq(f);
  const head = form[0];
  switch (head) {
    case "COMP": {
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
      let acc = xs[xs.length - 1];
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
