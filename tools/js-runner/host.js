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
// the clock at this line is the time bun spent starting and PARSING the whole
// module (host, canon and carriers) before running any of it; on the support
// store's 50 MB module that is most of an eleven-second load (2026-09-07)
if (process.env.AREST_BOOT_TIMING) console.error("boot: parsed " + Math.round(performance.now()) + " ms");
const DEFS = new Map();
const CELLS = [];
// bumped by every definition, so a form compiled against an older set of
// definitions is compiled again (the compiled form, below Ev)
let DEFSVER = 0;
function DEF(name, body) {
  if (DEFS.has(name)) throw new Error("duplicate DEF: " + name);
  DEFS.set(name, body);
  DEFSVER++;
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
// THE COMPOSITION'S IDENTITY, stamped by build.js from canon and the carriers
// it spliced -- not from this file, because a host edit does not move a
// population. tools/compile-store.js writes this value into the store.db it
// projects and loadStoreDb refuses a database carrying any other, which is the
// same move build.js makes for a stale `compiled` carrier.
let COMPOSITION = null;
function COMPOSED(h) { COMPOSITION = h; }
// A CARRIER IS READ BY THE HOST, NOT PARSED AS CODE. design-state,
// norma-answer and the compiled map are intersection source -- S* a sequence,
// A an atom, N a number, PHI the empty sequence, K a CONST form, DEF a <name,
// body> entry, prose between -- and bun spent 8.6 s of the support store's
// 13.8-second load parsing 45 MB of them as nested JavaScript calls
// (2026-09-07). build.js now splices each carrier's text as ONE literal and
// this reads it: the same value the constructors would have built, registered
// with DEF exactly as the spliced calls were, prose dropped as CANON dropped
// it. The carrier stays the carrier, inside the composition, and nothing is
// read from a path beside the module (Sam, on a JSON sidecar that was here
// for an hour: "Codd says no").
function CANONTEXT(text) {
  let i = 0;
  const n = text.length;
  const fail = (what) => { throw new Error("carrier: " + what + " at " + i + ": " + JSON.stringify(text.slice(i, i + 40))); };
  const ws = () => { for (;;) { const c = text.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else return; } };
  const str = () => {
    // a double-quoted literal as the oracle and compile-rmap.js write it: a
    // backslash escapes the next character (\" and \\), and the JS escapes
    // for a newline, return and tab read as bun read them; the backslash is
    // sought only within the span before the next quote
    i++;
    let out = "";
    for (;;) {
      const q = text.indexOf('"', i);
      if (q < 0) fail("unterminated string");
      const seg = text.slice(i, q);
      const b = seg.indexOf("\\");
      if (b < 0) { out += seg; i = q + 1; return out; }
      out += seg.slice(0, b);
      const d = text[i + b + 1];
      out += d === "n" ? "\n" : d === "r" ? "\r" : d === "t" ? "\t" : d;
      i = i + b + 2;
    }
  };
  const isWord = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
  const expr = () => {
    ws();
    const c = text.charCodeAt(i);
    if (c === 34) return str();
    if (c === 45 || (c >= 48 && c <= 57)) {
      let j = i + 1;
      for (;;) { const d = text.charCodeAt(j); if ((d >= 48 && d <= 57) || d === 46 || d === 101 || d === 69 || d === 43 || d === 45) j++; else break; }
      const v = Number(text.slice(i, j));
      if (Number.isNaN(v)) fail("bad number");
      i = j;
      return v;
    }
    const s = i;
    while (isWord(text.charCodeAt(i))) i++;
    const head = text.slice(s, i);
    if (head.length === 0) fail("expected a constructor");
    ws();
    if (text.charCodeAt(i) !== 40) fail("expected ( after " + head);
    i++;
    const args = [];
    ws();
    if (text.charCodeAt(i) === 41) i++;
    else for (;;) {
      args.push(expr());
      ws();
      const d = text.charCodeAt(i);
      if (d === 44) { i++; continue; }
      if (d === 41) { i++; break; }
      fail("expected , or )");
    }
    if (head === "A" || head === "N") return args[0];
    if (head === "PHI") return [];
    if (head === "K") return ["CONST", args[0]];
    if (head === "DEF") return { def: args[0], body: args[1] };
    if (head === "S" || (head.length === 2 && head.charCodeAt(0) === 83 && head.charCodeAt(1) >= 48 && head.charCodeAt(1) <= 57)) return args;
    fail("unknown constructor " + head);
  };
  ws();
  if (text.charCodeAt(i) !== 40) fail("expected ( to open the carrier");
  i++;
  ws();
  if (text.charCodeAt(i) === 41) { i++; return; }
  for (;;) {
    const e = expr();
    if (e !== null && typeof e === "object" && !Array.isArray(e) && e.def !== undefined) DEF(e.def, e.body);
    ws();
    const d = text.charCodeAt(i);
    if (d === 44) { i++; continue; }
    if (d === 41) { i++; return; }
    fail("expected , or ) between entries");
  }
}

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

// ---- EXACT DECIMAL ARITHMETIC (#109, the decimal cluster) -------------------
//
// THE DEFECT: the mu's arithmetic was not total on a decimal value type's
// declared domain. `*` was binary floating point -- 0.06875 * 100000 answered
// 6875.000000000001, which is not a value of DECIMAL(p, s) for any s a model
// would declare -- and `/` was Math.trunc of a floating quotient, which is
// integer division computed inexactly. Def. 3 admits only a "deterministic,
// side-effect-free total function", Lemma 1 requires the base operations to be
// "total on their declared domains", and Val is "the disjoint union of the
// value-type domains". A decimal IS a declared value type here:
// metamodel/core.md:2083 puts `decimal` in the numeric group, :2189 maps it to
// Abstract SQL Type DECIMAL, and :1803-1806 declare Precision and Scale as the
// facets a value type absorbs ("The data type of Price is decimal with
// precision 10 and scale 2", core.md:2044). So DECIMAL(p, s) is the set of
// m * 10^-s with |m| < 10^p, and 6875.000000000001 is outside every one of them.
//
// THE FIX IS NOT A NEW VALUE REPRESENTATION, and that is the whole reason it
// can be this small. Canon already says what a number IS: system:isnum is
// not.eq<id, implode.<K(''), <id>>> -- an atom is a number exactly when it
// differs from its own string spelling -- and ntoa/system:numtext spell it with
// that same implode. So the mu's number is ALREADY its shortest decimal
// spelling, not the 53-bit binary fraction underneath; `0.06875` means the
// decimal 0.06875 and never 0.068750000000000005551115123125782670974731445.
// These operations therefore do exactly what that reading says: decompose each
// operand into the (mantissa, scale) of its own spelling, do the arithmetic in
// BigInt where it is exact, and hand back the number whose spelling is the
// exact result. Nothing about typeof, ===, cmp, deepEq, implode, N() or any
// carrier changes, because no new kind of value is ever constructed.
//
// AND WHERE THE EXACT RESULT IS NOT A NUMBER OF THIS HOST, IT REFUSES. Two
// DECIMAL(10, 2) operands multiply into DECIMAL(20, 4), and a double holds
// every decimal of 15 significant digits and not every one of 20. The old code
// silently returned the nearest double; 19c1ed00 is the record of what silent
// numeric wrongness costs ("The failure is not even reliably loud, which is
// worse than the throw"). The test is stated in the mu's own terms and needs no
// digit count: the exact decimal is a value of this host iff Number() of its
// spelling spells itself again. That makes the admission condition of Lemma 1
// checkable -- a schema whose decimal columns multiply within 15 significant
// digits is admissible, one that does not is refused at the operation instead
// of being quietly approximated.
//
// THE FAST PATH IS THE WHOLE INTEGER DOMAIN, so nothing existing pays for this.
// If both operands are safe integers and the double answer is a safe integer,
// the double answer IS the exact answer (both operands and the true result are
// exactly representable, so the correctly-rounded result is the true result)
// and it is returned without a BigInt ever being built. `/` takes the same
// path on safe integers: writing a = bq + r, Math.trunc(a/b) can only exceed q
// if the rounding of q + r/b reaches q + 1, which needs ulp(a/b) >= 2/b, i.e.
// |a| >= 2^53. Below that it is already exact.
//
// PARITY IS NOT CLAIMED AND MUST NOT BE. The other certified hosts have no
// decimal in their value domain at all: tools/rust-host/src/lib.rs:1214 is
// `fn N(n: i64) -> V`, tools/cs-runner/Reader.cs:113 is int.Parse and
// tools/java-runner/Reader.java:106 is Integer.parseInt, so N(6.875) does not
// compile in one and throws in the other two. On the INTEGER domain where the
// four hosts do agree this change moves js TOWARDS them, not away: a product
// that i64 gets right and a double got wrong is now either right or refused.
// Decimals below still make js the only host that can hold them, which is why
// nothing here is pinned in engine/shared/expected-cases.tsv -- that golden is
// the cross-host agreement surface and every host asserts every row of it.
function decOf(op, x) {
  if (typeof x !== "number") throw new Error(op + " on non-number");
  if (!Number.isFinite(x)) throw new Error(op + " on a non-finite number: " + show(x));
  // the operand's OWN spelling, the one implode and ntoa give canon
  const t = "" + x;
  const e = t.indexOf("e") < 0 ? t.indexOf("E") : t.indexOf("e");
  let digits = t, exp = 0;
  if (e >= 0) { digits = t.slice(0, e); exp = parseInt(t.slice(e + 1), 10); }
  const dot = digits.indexOf(".");
  let s = 0;
  if (dot >= 0) { s = digits.length - dot - 1; digits = digits.slice(0, dot) + digits.slice(dot + 1); }
  let m = BigInt(digits);
  s -= exp;
  // value is m / 10^s, and s is held non-negative so every pair is comparable
  if (s < 0) { m *= 10n ** BigInt(-s); s = 0; }
  return [m, s];
}
function decStr(m, s) {
  const neg = m < 0n;
  let d = (neg ? -m : m).toString();
  if (s === 0) return (neg ? "-" : "") + d;
  if (d.length <= s) d = "0".repeat(s - d.length + 1) + d;
  return (neg ? "-" : "") + d.slice(0, d.length - s) + "." + d.slice(d.length - s);
}
function decNum(op, m, s) {
  while (s > 0 && m % 10n === 0n) { m /= 10n; s--; }
  const t = decStr(m, s);
  const v = Number(t);
  // a value of this host's number domain is one that spells itself back
  const [m2, s2] = Number.isFinite(v) ? decOf(op, v) : [0n, -1];
  // the exact value NAMES the refusal, elided in the middle when a subtraction
  // of magnitudes has made it six hundred digits long and unreadable
  if (!(m2 === m && s2 === s)) throw new Error(op + " exceeds the exact decimal domain: "
    + (t.length > 48 ? t.slice(0, 24) + "..." + t.slice(-12) + " (" + t.length + " digits)" : t));
  return v;
}
// the two scales brought to a common one, so the mantissas add directly
function decAlign(am, as, bm, bs) {
  if (as < bs) return [am * 10n ** BigInt(bs - as), bm, bs];
  if (bs < as) return [am, bm * 10n ** BigInt(as - bs), as];
  return [am, bm, as];
}

// ---- the base primitives: Backus 11.2.3 plus the registered boundary rows
// of resolution.md (lex, implode, slug, escape_html, strip_prefix, 1r, tlr).
// Each mirrors its Mu.cs form; unary prims take x, pair prims take at(x,0/1). -
// THE DURABLE WRITE IS THE TABLE (Samuel 2026-09-09, arest #108). The paper's
// storage is Backus's FILE, one cell in D, which Rmap structures into Codd's
// tables; tools/compile-store.js writes those tables as <carriers>/store.db and
// serve and mcp boot from them (AREST_STORE_DB, loadStoreDb below). The emit
// leg of a write (Def 6: resolve, lfp, validate, emit) now writes the
// populations the write changed into their tables, so the next boot reads the
// tables and nothing else. A store booted without a database keeps its writes
// in memory, which is what a test wants. The journal -- an append-only file of
// DEF entries spliced into the module and replayed at boot, my own device of
// 2026-07-20 and nowhere in AREST.tex -- is retired.
let STORE_DB = null;
let STORE_TABLES = new Map();            // ft -> the rows the tables held at load
function storeDb() {
  if (STORE_DB !== null) return STORE_DB;
  const path = process.env.AREST_STORE_DB;
  if (!path) { STORE_DB = false; return false; }
  const { Database } = require("bun:sqlite");
  STORE_DB = new Database(path);
  return STORE_DB;
}
// every declared population as text, so a write's diff is its changed fact
// types: 247 fact types and 4,457 rows in a millisecond on the base store
function popSnapshot(cells) {
  const snap = new Map();
  for (const d of Ev("store:fts", cells)) {
    const ft = d[0];
    if (typeof ft !== "string") continue;
    let p;
    try { p = Ev("system:pop_rows", [ft, cells]); } catch (e) { p = []; }
    snap.set(ft, JSON.stringify(Array.isArray(p) ? p : []));
  }
  return snap;
}
// A POPULATION THAT MOVED MEANS ITS TABLES ARE RE-PROJECTED. What emitToDb
// wrote back before was the _meta shape and only ever that shape: a functional
// fact type into a JSON column keyed by k, a non-functional one into a table of
// c0..cn named `r` plus a hash of the fact type, and a fact type populated for
// the FIRST time got a table invented on the spot with an arity guessed from its
// first row. The readings describe none of it. rmap:proj_rows answers a table's
// rows from the cells and rmap:proj_colnames names its columns -- the two the
// DDL and compile.js already use -- so writing back is projecting again, over
// the tables that carry a fact type whose population moved, and nothing here
// decides which those are either: rmap:ctab says which table carries what.
function emitToDb(before, cells) {
  const db = storeDb();
  if (!db) return 0;
  const after = popSnapshot(cells);
  const changed = new Set();
  for (const [ft, text] of after) if (before.get(ft) !== text) changed.add(ft);
  if (!changed.size) return 0;
  // THE SOURCE TAKES THE ROWS FIRST, because the projection reads it. A row
  // derived at boot or written through main:api lives in a per-fact-type cell,
  // and rmap:proj_rows answers from the DESCRIPTORS -- store:fts slot 5 -- so
  // re-projecting without adopting would write the tables back exactly as they
  // were and call it a store. store:src_all is how a row joins the source, and
  // it is the same call the API path already makes before it emits.
  const carried = [...changed].map((ft) => [ft, JSON.parse(after.get(ft))]);
  adoptStore(Ev("store:src_all", [carried, cells]));
  const touched = new Set();
  for (const t of Ev("rmap:ctab", cells)) {
    const table = String(t[1]);
    if (changed.has(String(t[0]))) { touched.add(table); continue; }
    for (const col of t[2]) {
      const carried = String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : []));
      if (changed.has(carried)) { touched.add(table); break; }
    }
  }
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  let written = 0;
  db.transaction(() => {
    for (const table of touched) {
      const cols = Ev("rmap:proj_colnames", [table, cells]).map(String);
      if (!cols.length) continue;
      let ins;
      try {
        db.run('delete from "' + table + '"');
        ins = db.prepare('insert into "' + table + '" ("' + cols.join('","') + '") values ('
          + cols.map(() => "?").join(",") + ")");
      } catch { continue; }          // a table the schema has and this database does not
      for (const row of Ev("rmap:proj_rows", [table, cells])) {
        const vals = cols.map((_, i) => { const v = row[i]; return v === "#" || v === undefined ? null : flat(v); });
        try { ins.run(...vals); written++; } catch { /* refused: the row is not this table's */ }
      }
    }
  })();
  return written;
}
const PRIMS = new Map(Object.entries({
  "id": x => x,
  "tl": x => { const a = seq(x); if (a.length === 0) throw new Error("tl on empty"); return a.slice(1); },
  "atom": x => bool(!Array.isArray(x)),
  "apndl": x => [at(x,0), ...seq(at(x,1))],
  "apndr": x => { const p = seq(at(x,0)), e = at(x,1); const out = [...p, e]; CATPROV.set(out, [p, [e]]); return out; },
  "distl": x => { const h = at(x,0); return seq(at(x,1)).map(e => [h, e]); },
  "distr": x => { const t = at(x,1); return seq(at(x,0)).map(e => [e, t]); },
  "cat": x => { const p = seq(at(x,0)), s = seq(at(x,1)); const out = [...p, ...s]; CATPROV.set(out, [p, s]); return out; },
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
  // the four are EXACT DECIMAL, over the operands' own spellings; see decOf
  // above for why that is what the mu already meant by a number
  "+": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("+ on non-number");
    const r = a + b;
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(r)) return r;
    const [am, as] = decOf("+", a), [bm, bs] = decOf("+", b);
    const [ma, mb, s] = decAlign(am, as, bm, bs);
    return decNum("+", ma + mb, s); },
  "-": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("- on non-number");
    const r = a - b;
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(r)) return r;
    const [am, as] = decOf("-", a), [bm, bs] = decOf("-", b);
    const [ma, mb, s] = decAlign(am, as, bm, bs);
    return decNum("-", ma - mb, s); },
  "*": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("* on non-number");
    const r = a * b;
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(r)) return r;
    const [am, as] = decOf("*", a), [bm, bs] = decOf("*", b);
    return decNum("*", am * bm, as + bs); },
  // `/` KEEPS ITS MEANING AND GAINS ITS EXACTNESS. It is truncation toward
  // zero, as it has always been and as the cs, java and rust hosts' integer
  // division is; what changes is that the quotient is now computed rather than
  // rounded -- BigInt division truncates toward zero, so (-7)/2 is -3 here
  // exactly as Math.trunc gave. Decimal division at a declared scale is NOT
  // this operation and is not total (1/3 is in no DECIMAL(p, s)); it is
  // round . <*, K(10^s)> over this one, which is why `round` is the primitive
  // that had to arrive with the exact arithmetic rather than a third argument.
  "/": x => { const a = at(x,0), b = at(x,1);
    if (typeof a !== "number" || typeof b !== "number") throw new Error("/ on non-number");
    if (b === 0) throw new Error("division by zero");
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b)) return Math.trunc(a / b);
    const [am, as] = decOf("/", a), [bm, bs] = decOf("/", b);
    const [ma, mb] = decAlign(am, as, bm, bs);
    if (mb === 0n) throw new Error("division by zero");
    return decNum("/", ma / mb, 0); },
  // round IS THE OPERATION THAT PUTS A PRODUCT BACK IN ITS COLUMN'S DOMAIN.
  // DECIMAL(p1,s1) x DECIMAL(p2,s2) is DECIMAL(p1+p2, s1+s2), so exact `*`
  // alone leaves the answer outside the declared scale of the column it is
  // written to; round<x, s> is the total function from the wider domain back
  // into DECIMAL(., s), and without it "exact arithmetic" would just move the
  // domain violation one step later. Half AWAY FROM ZERO, which is what
  // Abstract SQL Type DECIMAL means by ROUND in Postgres numeric, MySQL,
  // Oracle and SQL Server, so a store and its projected SQL agree; half-even
  // is a DIFFERENT function and would be a second registered row, never a flag.
  // Total for every finite number and every integer scale, negative included
  // (round<1250, -2> is 1300), and s >= the operand's own scale answers the
  // operand -- which is also what keeps a huge s from building a huge BigInt.
  "round": x => { const v = at(x,0), s = at(x,1);
    if (typeof v !== "number") throw new Error("round on non-number");
    if (typeof s !== "number" || !Number.isInteger(s)) throw new Error("round to a non-integer scale");
    const [m, sc] = decOf("round", v);
    if (sc <= s) return v;
    const pow = 10n ** BigInt(sc - s);
    let q = m / pow;
    const rem = m % pow;
    if (rem < 0n ? -rem * 2n >= pow : rem * 2n >= pow) q += m < 0n ? -1n : 1n;
    return s >= 0 ? decNum("round", q, s) : decNum("round", q * 10n ** BigInt(-s), 0); },
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
  // clock is REGISTERED (resolution.md: accepts sequence, yields text). The
  // journal stamps every submitted event with it (ui:navpe), and the GUI
  // hosts that used to supply it are deleted, so the thin host registers it:
  // ISO 8601 in UTC, the one shape every host can stamp identically.
  "clock": x => new Date().toISOString(),
  // crypt:encrypt / crypt:decrypt are REGISTERED, and until now they were a
  // FALSE ROW IN THE ENUMERABLE BOUNDARY -- declared in resolution.md on the
  // 2026-07-20 hooks ruling ("the core carries the named seam, a host
  // registers real platform crypto only when a domain's data types demand
  // it"), with accepts/yields stated, and implemented by nobody. That is the
  // exact defect the 08-12 note six lines above them diagnoses for
  // store:append: "it claimed a host capability that did not exist", and Cor 6
  // is meant to be the honest list of where unverified computation enters.
  // store:append was deleted because canon already carried ast:Store and
  // nothing needed it. These are the other resolution: Samuel, 2026-09-11, the
  // value type for a secret declares the encrypt/decrypt function it uses, so
  // a domain's data types now demand it and the claim becomes true.
  //
  // AES-256-GCM because the answer must be one TEXT ATOM -- the mu has no byte
  // type -- so the iv and the auth tag ride inside it: base64 of iv(12) ||
  // tag(16) || ciphertext, which decrypt splits back out. The key is any text
  // and is hashed to the 32 bytes the cipher needs, so a passphrase and a
  // generated key are both usable and neither is truncated silently. GCM
  // rather than CBC so a tampered ciphertext FAILS rather than decrypting to
  // rubbish: an unregistered hook refuses loudly through the mu, and a
  // registered one should refuse just as loudly on a bad answer.
  "crypt:encrypt": x => {
    const { createCipheriv, createHash, randomBytes } = require("node:crypto");
    const key = createHash("sha256").update(String(at(x, 0))).digest();
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([c.update(String(at(x, 1)), "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
  },
  "crypt:decrypt": x => {
    const { createDecipheriv, createHash } = require("node:crypto");
    const key = createHash("sha256").update(String(at(x, 0))).digest();
    const all = Buffer.from(String(at(x, 1)), "base64");
    if (all.length < 28) throw new Error("crypt:decrypt on a ciphertext shorter than its iv and tag");
    const d = createDecipheriv("aes-256-gcm", key, all.subarray(0, 12));
    d.setAuthTag(all.subarray(12, 28));
    return Buffer.concat([d.update(all.subarray(28)), d.final()]).toString("utf8");
  },
  // crypt:genkey MINTS THE KEY THE OTHER TWO USE, and it is REGISTERED rather
  // than canon for the reason Def. 3 gives: canon admits only a deterministic,
  // side-effect-free total function, and a key is neither -- it consumes
  // entropy and answers differently every call. Samuel, 2026-09-15, asked
  // whether this should be a canon method; the system already has the category
  // for it, which is the boundary Cor 8 enumerates. The host also already HAS
  // the entropy: randomBytes is four lines up, generating the iv. This only
  // names it, so that HOW A KEY IS MADE becomes a row in the boundary instead
  // of a shell command nobody can enumerate.
  //
  // IT NEVER ANSWERS THE KEY. An answer is transcript -- it reaches an MCP
  // response, a CLI stdout, a log -- and core.md:1223 already rules that the
  // key "cannot live in the store it protects"; the same reasoning forbids it
  // living in the reply. So this WRITES the key and answers a FINGERPRINT,
  // sha256 truncated, which is enough to tell two keys apart and useless for
  // decrypting anything. That is what makes it safe to expose over MCP.
  //
  // IT REFUSES RATHER THAN OVERWRITES. A second key silently makes every
  // existing ciphertext undecryptable, which is the same shape as the rebuild
  // that dropped facts (#108, 49b33b2e): refuse, name what is already there,
  // and leave the repair to someone who can see both sides.
  //
  // 32 BYTES, NOT A PASSPHRASE. crypt:encrypt hashes any text to the 32 bytes
  // the cipher needs, deliberately, "so a passphrase and a generated key are
  // both usable and neither is truncated silently". That sha256 is a
  // NORMALIZER, and it is only a weak step when the input is a low-entropy
  // passphrase -- there is nothing to stretch in 256 random bits. Minting a
  // full-entropy key is therefore the fix for that weakness, rather than
  // changing the derivation and invalidating every ciphertext made under it.
  "crypt:genkey": x => {
    const { randomBytes, createHash } = require("node:crypto");
    const { existsSync, readFileSync, appendFileSync } = require("node:fs");
    const path = String(at(x, 0));
    const NAME = "AREST_MASTER_KEY";
    if (process.env[NAME]) throw new Error("crypt:genkey refuses: " + NAME + " is already set in the environment");
    const had = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (new RegExp("^\\s*" + NAME + "\\s*=", "m").test(had)) {
      throw new Error("crypt:genkey refuses: " + NAME + " is already in " + path);
    }
    const key = randomBytes(32).toString("base64");
    const sep = had === "" || had.endsWith("\n") ? "" : "\n";
    appendFileSync(path, sep + NAME + "=" + key + "\n", "utf8");
    return createHash("sha256").update(key).digest("hex").slice(0, 12);
  },
  // ---- THE COMPILER'S I/O, REGISTERED (#109) -------------------------------
  // Sam, 2026-09-20: "the full framework must be canon with registered DEFS".
  // compile.js read its directories and files, wrote the carrier and executed
  // the DDL in JavaScript -- the last host decisions left in the compile path
  // once read:file_order took the reading order (3360a782). They are REGISTERED
  // functions now, by the rule resolution.md:396 states: a host name canon does
  // NOT define is registered; a host name canon DOES define is a native twin
  // and stays compiled. Canon defines no fs: or sql: cell and must not -- a
  // directory listing and a file's bytes are outside D -- which is exactly what
  // arest:10434 rules for store:append: "a registered definition enters DEFS in
  // the host that registers it, at runtime".
  //
  // AND THE ROW IS ONLY TRUE BECAUSE THIS FILE EXISTS. store:append stood as a
  // FALSE entry in the enumerable boundary for months -- declared registered,
  // implemented by nobody -- and Cor 6 is meant to be the honest list of where
  // unverified computation enters. So these four are declared in
  // resolution.md only because they are registered HERE: delete
  // tools/js-runner and the binding goes with it, never the compiler.
  //
  // THEY ANSWER MU VALUES, NOT HANDLES. sql:exec takes <path, sql> and opens
  // the database itself, because the mu has atoms and sequences and no third
  // thing a handle could be; it runs DDL only, the one db.exec compile.js
  // makes. The row inserts stay prepared statements with bound parameters --
  // #96 was an apostrophe silently truncating a value, and rendering 2,657
  // rows into SQL text to pass them through here would earn that back.
  "fs:dir": x => {
    if (Array.isArray(x)) throw new Error("fs:dir on a sequence");
    return require("node:fs").readdirSync(String(x));
  },
  "fs:read": x => {
    if (Array.isArray(x)) throw new Error("fs:read on a sequence");
    return require("node:fs").readFileSync(String(x), "utf8");
  },
  "sql:exec": x => {
    const { Database } = require("bun:sqlite");
    const db = new Database(String(at(x, 0)), { create: true });
    try { db.exec(String(at(x, 1))); } finally { db.close(true); }
    return String(at(x, 0));
  },
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
// call memoClear() at the mutation point. Bounded: the memo alone is emptied
// past the cap; the identity-keyed indexes below outlive it (memoCall).
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
let FETCHIDX = new WeakMap();
// csdp:matches keys a row list by first column; theta:member keys a list by member
let MATCHIDX = new WeakMap();
let MEMBIDX = new WeakMap();
let PAIRIDX = new WeakMap();
let SOLVEIDX = new WeakMap();
let MPIDX = new WeakMap();
let SLOTIDX = new WeakMap();
function memoClear() { EVMEMO.clear(); EVMEMON = 0; DESCIDX = new WeakMap(); ENTIDX = new WeakMap(); JOINIDX = new WeakMap(); FETCHIDX = new WeakMap(); MATCHIDX = new WeakMap(); MEMBIDX = new WeakMap(); PAIRIDX = new WeakMap(); SOLVEIDX = new WeakMap(); MPIDX = new WeakMap(); SLOTIDX = new WeakMap(); }
// the rows of `rows` whose first column equals `key`, in source order -- the value
// of csdp:matches (INSERT csdp:keep_keyed . theta:append_phi . distl). The fold
// visits every row, so a row that is not a sequence, or is empty, throws the
// selector error whatever the key; the index throws the same way when built.
function atomsOf(x) {
  if (!Array.isArray(x)) return [x];
  const out = [];
  const stack = [x];
  while (stack.length) {
    const v = stack.pop();
    if (!Array.isArray(v)) { out.push(v); continue; }
    for (let i = v.length - 1; i >= 0; i--) stack.push(v[i]);
  }
  return out;
}
// a Map key for a value: a string or number as itself under a kind prefix, so
// the string "[1]" and the sequence <1> never meet; anything else by its JSON
// A ROW'S KEY WITHOUT JSON. theta:dedup stringified 75 million elements on
// the eu-law report (334k calls at a mean of 225, 94% of them cn:dinner and
// cn:dcc naming the metamodel's Function table's columns, 2026-09-06), and
// JSON.stringify was the cost. A row of atoms keys as its atoms tagged and
// joined on a control character; anything nested, and any string that
// carries the separator itself, keys as JSON exactly as before, so two
// values key equal iff they are deepEq -- the same contract, cheaper.
const KSEP = String.fromCharCode(1);
function keyOf(v) {
  if (typeof v === "string") return "s" + v;
  if (typeof v === "number") return "n" + v;
  if (Array.isArray(v)) {
    let k = "r";
    for (let i = 0; i < v.length; i++) {
      const e = v[i];
      if (typeof e === "string") { if (e.indexOf(KSEP) >= 0) return "j" + JSON.stringify(v); k += KSEP + "s" + e; }
      else if (typeof e === "number") k += KSEP + "n" + e;
      else return "j" + JSON.stringify(v);
    }
    return k;
  }
  return "j" + JSON.stringify(v);
}
// ast:pop_exp / ast:pop_sub, row for row -- see the system:pop_in twin
function popIsCell(r) { return Array.isArray(r) && r.length >= 3 && r[0] === "CELL"; }
function popExp(row, out) {
  if (popIsCell(row)) {
    const name = row[1];
    const subs = popSub(row[2]);
    for (let i = 0; i < subs.length; i++) { const s = seq(subs[i]); const r = new Array(s.length + 1); r[0] = name; for (let j = 0; j < s.length; j++) r[j + 1] = s[j]; out.push(r); }
    return;
  }
  if (!Array.isArray(row)) { out.push([row]); return; }
  out.push(row);
}
function popSub(contents) {
  const c = seq(contents);
  if (c.length === 0) return [[]];
  if (popIsCell(c[0])) { const out = []; for (let i = 0; i < c.length; i++) popExp(c[i], out); return out; }
  const out = new Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = Array.isArray(c[i]) ? c[i] : [c[i]];
  return out;
}
// canon's JSON text (render:json, quote_str), one pass -- see the twins
function jsonQuote(s) {
  let out = '"';
  for (const c of s) out += c === "\\" ? "\\\\" : c === '"' ? '\\"' : c === "\n" ? "\\n" : c === "\r" ? "\\r" : c;
  return out + '"';
}
function jsonText(x) {
  if (Array.isArray(x)) {
    if (x.length === 0) return "[]";
    let out = "[";
    for (let i = 0; i < x.length; i++) { if (i > 0) out += ","; out += jsonText(x[i]); }
    return out + "]";
  }
  if (typeof x === "number") return "" + x;
  if (typeof x === "string") return jsonQuote(x);
  return Ev(DEFS.get("render:json_atom"), x);
}
function matchRows(key, rows) {
  let idx = MATCHIDX.get(rows);
  if (idx === undefined) { idx = new Map();
    for (let i = 0; i < rows.length; i++) { const r = rows[i];
      if (!Array.isArray(r)) throw new Error("selector 1 on atom: " + show(r));
      if (r.length < 1) throw new Error("selector 1 out of range 0");
      const k = keyOf(r[0]);
      let a = idx.get(k); if (a === undefined) { a = []; idx.set(k, a); }
      a.push(r); }
    MATCHIDX.set(rows, idx); }
  const hit = idx.get(keyOf(key));
  return hit === undefined ? [] : hit;
}
// the same, on an arbitrary column. csdp:matches indexes column 1 and ONLY
// column 1, which is why the joins that cost the most were invisible to it:
// rmap:uniqs:derive scans rmap:childrenN once per rmap:ucrows row keeping the
// children whose SECOND column matches, 3784 x 2255 pairs on eu-law, and that
// one scan is the whole 44 s the definition costs. Fourteen sites in canon key
// on column 2; forty-six key on column 1 but inside a filter carrying further
// conjuncts, so the bare csdp:matches node never matched them either. Both are
// this shape: index the equality, test the remaining conjuncts only on what the
// index returns. The index is per (rows, column) because one row list is joined
// on different columns in different definitions.
let MATCHATIDX = new WeakMap();
function matchRowsAt(n, key, rows) {
  let byCol = MATCHATIDX.get(rows);
  if (byCol === undefined) { byCol = new Map(); MATCHATIDX.set(rows, byCol); }
  let idx = byCol.get(n);
  if (idx === undefined) { idx = new Map();
    for (let i = 0; i < rows.length; i++) { const r = rows[i];
      if (!Array.isArray(r)) throw new Error("selector " + n + " on atom: " + show(r));
      if (n < 1 || n > r.length) throw new Error("selector " + n + " out of range " + r.length);
      const k = keyOf(r[n - 1]);
      let a = idx.get(k); if (a === undefined) { a = []; idx.set(k, a); }
      a.push(r); }
    byCol.set(n, idx); }
  const hit = idx.get(keyOf(key));
  return hit === undefined ? [] : hit;
}
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
// system:pop_in is the same case at the population level, and it was the
// largest single line of the base law report (402 calls, 1.17 s of ~11 s,
// 2026-09-04). It is COMP(apply, <apply(<CONST ast:FetchPop, name>), cells>) --
// it BUILDS a fetch form and then runs it, and because the built form is
// anonymous the whole walk (FILE, then main:flat . ALPHA(ast:pop_exp) over the
// named cell) is charged to this one frame rather than to a DEF of its own.
// That walk is a pure function of <name, cells>, name ranges over the model's
// fact-type names and cells is the frozen store, so the distinct-input count is
// the schema's size and every ask after the first is a lookup.
const MEMOCN = new Set(["ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor",
  "cn:sfx", "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts",
  "cn:chrank", "lex:lw", "induce:sig_of", "system:pop_in", "store:fts",
  // ui:otpops is the object-type populations of a store, and mcp:tools the
  // fact-type table of one: a write's validation asks each once per mandatory
  // role of every fact type over the store it is validating, and a fresh list
  // per ask meant a fresh index per ask (the profile-and-fix loop, 2026-09-07)
  "ui:otpops", "mcp:tools",
  // derive:sm_marks is the semi-derived markings of a store, asked once per
  // fact type per round of the closure (the profile-and-fix loop, 2026-09-08)
  "derive:sm_marks",
  // main:status_fts is the state-machine fact types of a store and main:cell2
  // a population of one by name: every GET on the API recomputed both,
  // 60% of a request's work in-process (the profile-and-fix loop, 2026-09-08)
  "main:status_fts", "main:cell2",
  // lex:subruns and lex:camel finish the column-name tokenizer lex:parts
  // starts: parts -> run-substitution -> camelCase. lex:parts is memoised on
  // the name atom (stable list out) and rmap:freesubs is memoable, so both
  // arguments of lex:subruns are stable and lex:camel's is stable in turn. The
  // law report transforms the same column names across the schema laws
  // (normacolorder, normaconstraints, rmap_idempotence), the top of the
  // report's self by lex:subruns 22.8% / lex:camel 14.2% inclusive; memoised
  // they answer once per column name, not once per law (the profile-and-fix
  // loop, 2026-09-08)
  "lex:subruns", "lex:camel",
  // read:state_rules is the rules compiler over a carrier's facts, and
  // read:design_state asks for it TWICE: once as the cell `state:rules`, and
  // once inside `state:undelivered`, which subtracts the heads it delivered
  // from the heads state:derived marks. The two are the same call on the same
  // value -- read:design_state applies every cell to one x -- so the second
  // was the first recomputed, arm for arm (the base metamodel, 2026-09-16:
  // read:rule_rows entered under state:rules and again under
  // state:undelivered). Memoised on that argument's identity, the rows are
  // the same rows: canon is pure and the two cells are unchanged.
  "read:state_rules"]);
function memoable(f) { return MEMOCN.has(f) || f.startsWith("rmap:") || f.startsWith("state:"); }
// Compiled forms of hot canon list cells (the lex-primitive precedent:
// the DEF stays the meaning; the head evaluates its extensional equal;
// the unit tests certify identity). Only consulted when the DEF exists.
// DEDUP LESS, WITHOUT CHANGING WHAT DEDUP MEANS. cn:dinner rebuilds its
// accumulator at every step as dedup(apndr(acc, item)) or dedup(cat(acc,
// pairs)), and acc is the previous step's dedup output: 91,800 steps keying
// ~470 elements each on the eu-law report (2026-09-06). theta:dedup keeps
// LAST occurrences, so for a duplicate-free prefix p, dedup(cat(p, s)) is
// exactly "p without the keys of s, then dedup(s)" -- the same rows in the
// same order, keying only s. Two provenances make that recognizable: cat
// and apndr remember what they joined (CATPROV: out -> [p, s]), and dedup
// remembers its output's keys, aligned (DEDUPKEYS: out -> keys). Any array
// without both takes the full path exactly as before.
const CATPROV = new WeakMap();
const DEDUPKEYS = new WeakMap();
// read:super_of asks one rows-array for one name's supertype, and its callers
// ask it per sentence: read:ancestors_of, read:ancestors and read:pop_ctx all
// enter through it. Measured on the reader path, 600/1200/2400 rows: 3130,
// 6730 and 13930 calls over 481, 1081 and 2281 DISTINCT rows arrays -- about
// six questions per array, and nothing about the array changes between them.
// Keyed by that array's identity, so a rebuilt rows array indexes afresh and a
// carried one answers from its own index. The array IS rebuilt once per landed
// sentence, and that rebuild turns out to cost nothing worth measuring: removing
// it entirely changed the stage by less than the run-to-run spread, in both
// directions. This twin is a constant factor for a different reason, and what
// is left quadratic is NOT this. tools/compile-design-state.js carries the
// measurement and the refutation beside its call.
const SUPEROF = new WeakMap();
// AREST_NOTWIN=name,name disables those twins for one run, so a twin can be
// held against its DEF on the same inputs: the law report is the only gate
// that exercises most of them, and a twin that is not the DEF fails it
// with no word about where (cn:nlexlt, 2026-09-06)
const NOTWIN = new Set(String(process.env.AREST_NOTWIN || "").split(",").filter(Boolean));
const FASTPRIMS = new Map(Object.entries({
  // CONS and CONST are canon (Backus 13.3.2, reached through tau clause (c)) and
  // stay so; these are their fast paths, the same value in one pass.
  // Metacomposition hands CONS <<CONS f1..fn>, y> and the answer is
  // <f1:y .. fn:y>; the canon form allocates distr, tl and an ALPHA over apply
  // per application, and the derivation closure over us-law applied CONS 18.6
  // million times for 30 of its 35 seconds (2026-09-04). An atom where the form
  // should be throws as seq does, and a one-element form answers PHI as tl does.
  "CONS": x => { const form = seq(at(x, 0)), y = at(x, 1);
    const out = new Array(form.length - 1);
    for (let i = 1; i < form.length; i++) out[i - 1] = Ev(form[i], y);
    return out; },
  "CONST": x => Ev(2, Ev(1, x)),
  // ast:fetch is the FIRST cell named n (Backus's rule for cells): a scan of the
  // store with eq at every cell per fetch, 9.8 seconds for 2,650 fetches over
  // us-law's store (2026-09-04). Indexed once per store array, keyed by name,
  // cleared with the memo at every mutation as the other indexes are; a cell is
  // any sequence of length 3 whose second element is the name (ast:named), the
  // answer its third element, "#" for none.
  "ast:fetch": x => { const name = at(x, 0), cells = seq(at(x, 1));
    let idx = FETCHIDX.get(cells);
    if (idx === undefined) { idx = new Map();
      for (const c of cells) { if (!Array.isArray(c) || c.length !== 3) continue;
        const k = JSON.stringify(c[1]); if (!idx.has(k)) idx.set(k, c[2]); }
      FETCHIDX.set(cells, idx); }
    const hit = idx.get(JSON.stringify(name));
    return hit === undefined ? "#" : hit; },
  // theta:member over a long list is answered by a set keyed on the list: the
  // law walk asks it once per atom of every form against the store's cell names
  // (43,156 asks over the same list, 13 of the base report's 89 seconds,
  // 2026-09-04). A short list is scanned as the DEF scans it.
  "theta:member": x => { const l = seq(at(x, 1)), e = at(x, 0);
    if (l.length < 16) return bool(l.some(m => deepEq(e, m)));
    let s = MEMBIDX.get(l);
    if (s === undefined) { s = new Set(); for (let i = 0; i < l.length; i++) s.add(keyOf(l[i])); MEMBIDX.set(l, s); }
    return bool(s.has(keyOf(e))); },
  // read:pos1 <x, list> is the 1-based positions of the elements equal to x,
  // in order, and read:memberw is whether there is one; both are written as
  // a WHILE walking the list by tl, which copies the rest of the list at
  // every step. The first screen of the support store asks memberw for every
  // fact type against the group list several times over (ui:sub), and the
  // walks were 40% of the screen's sample with tl at 17% of self (the
  // profile-and-fix loop, 2026-09-07). The VALUE of pos1 is one scan with
  // the strict equality; memberw over a long list is the set theta:member's
  // twin keeps on that list, under the same contract (keyOf equal iff deepEq).
  "read:pos1": x => { const e = at(x, 0), l = seq(at(x, 1));
    const out = [];
    for (let i = 0; i < l.length; i++) if (deepEq(e, l[i])) out.push(i + 1);
    return out; },
  "read:memberw": x => { const e = at(x, 0), l = seq(at(x, 1));
    if (l.length < 16) return bool(l.some(m => deepEq(e, m)));
    let s = MEMBIDX.get(l);
    if (s === undefined) { s = new Set(); for (let i = 0; i < l.length; i++) s.add(keyOf(l[i])); MEMBIDX.set(l, s); }
    return bool(s.has(keyOf(e))); },
  // csdp:matches is the equality filter over a row list's first column, written
  // as a fold: 2.4 million calls and 20 of the base report's 89 seconds
  // (2026-09-04). rmap:lookup0 wants the first match's second column, or PHI.
  "csdp:matches": x => matchRows(at(x, 0), seq(at(x, 1))).slice(),
  // csdp:matches_at is the same filter on a named column: <n, key, rows>.
  "csdp:matches_at": x => matchRowsAt(at(x, 0), at(x, 1), seq(at(x, 2))).slice(),
  // rmap:rows_for is the same first-column filter, <key, rows>, written as the
  // right fold INSERT keep_row_of . append_phi . distl. rmap:nest's twin above
  // took it out of the nesting, but law:l2_key still asks it once PER KEY over
  // the whole table: 8,487 asks, 4.5 million row tests, the first 55 of the
  // support report's 560 profiled seconds (2026-09-07). The rows are the same
  // array across the asks, so the index is built once. Edges mirrored: source
  // order, an atom or empty row throws the selector error the fold's predicate
  // threw at that row, no match is PHI.
  "rmap:rows_for": x => matchRows(at(x, 0), seq(at(x, 1))).slice(),
  "rmap:lookup0": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? [] : [at(hits[0], 1)]; },
  // solve:assoc / solve:assoc3 are the same first-match lookup, over the
  // closure (a head's rows) and the readings or rules (a head's row): explain
  // asks them once per sentence it says and once per leg it un-projects, and
  // at ~1 ms per interpreted scan of 281 readings each sat at 1.6 s inclusive
  // inside the 2.5 s a lawcore justification pass spends outside the fixpoint
  // (AREST_PROFILE, 2026-09-06).
  // assoc answers the second column or PHI; assoc3 the row or the DEF's empty
  // triple.
  "solve:assoc": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? [] : at(hits[0], 1); },
  // cn:fokey is the same first-match lookup with a sentinel: the second
  // column of the first row whose first column is the key, 999999 when none.
  // As a DEF it scanned the table with distr and ALPHA -- 2,814 calls over a
  // ~3,200-row table on the eu-law report, 9M constructor applications,
  // 13 s under the profiler (2026-09-06). The table is cn:keypath's second
  // argument, the same object across the calls, so the index is built once.
  "cn:fokey": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? 999999 : at(hits[0], 1); },
  // the same first-match lookup, three more times, each written in canon as
  // distr and ALPHA over the whole table: cn:rmvt answers the first match's
  // fourth column or "" (2,874 calls), cn:owner its second column as a
  // singleton or PHI (1,632), cn:gmpl the first elements of its second and
  // third columns as a pair, or PHI when there is no match or the third is
  // empty (595 calls at 2.5 ms each on the eu-law report, 2026-09-06)
  "cn:rmvt": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? "" : at(hits[0], 3); },
  "cn:owner": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? [] : [at(hits[0], 1)]; },
  "cn:gmpl": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    if (hits.length === 0) return [];
    const third = at(hits[0], 2);
    if (Array.isArray(third) && third.length === 0) return [];
    return [Ev(1, at(hits[0], 1)), Ev(1, third)]; },
  // cn:entsat is <rows, key>: the second columns of every row whose first
  // column is the key, concatenated (theta:flatten over the matches; a
  // second column that is not a list throws, as it does there); 123,792
  // calls from cn:dinner and cn:decitem
  "cn:entsat": x => { const hits = matchRows(at(x, 1), seq(at(x, 0))); const out = [];
    for (let i = 0; i < hits.length; i++) { const a = seq(at(hits[i], 1)); for (let j = 0; j < a.length; j++) out.push(a[j]); }
    return out; },
  // cn:panc walks a position n downward from its start while the n-th entry
  // of the row (theta:nth, 0-based) has anything but F in its third column,
  // and answers <k, n> where it stops, or PHI when it runs off the front
  // (n == -1). The DEF is a WHILE rebuilding a three-field state per step:
  // 323,008 calls from cn:dinner and cn:decitem on the eu-law report. The
  // same theta:nth answers the entries, so an index past the row fails as
  // it does there.
  "cn:panc": x => { const row = FASTPRIMS.get("theta:nth")([at(x, 0), at(x, 1)]); const k = at(x, 1); let n = at(x, 2);
    while (!deepEq(n, -1) && !deepEq(at(FASTPRIMS.get("theta:nth")([row, n]), 2), "F")) n = n - 1;
    return deepEq(n, -1) ? [] : [k, n]; },
  // cn:xisot: does any row's second column contain the key (theta:member,
  // i.e. deepEq); 708 calls scanning the table per call
  "cn:xisot": x => { const key = at(x, 0), rows = seq(at(x, 1));
    for (let i = 0; i < rows.length; i++) { const l = seq(at(rows[i], 1));
      for (let j = 0; j < l.length; j++) if (deepEq(l[j], key)) return "T"; }
    return "F"; },
  // cn:nlexlt is lexicographic less-than over two key paths: walk both while
  // the heads are eq, decide by gt on the first pair that differs, and a
  // path that runs out first is less. The DEF is a WHILE over <"?", a, b>
  // building a state per element -- 142,518 calls from cn:kplt inside the
  // naming walk's insertion sort on the eu-law report (2026-09-06). The same
  // eq and gt decide here.
  "cn:nlexlt": x => { const a = seq(at(x, 0)), b = seq(at(x, 1)); const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { if (deepEq(a[i], b[i])) continue; return bool(cmp(b[i], a[i]) > 0); }
    return bool(a.length < b.length); },
  // cn:strlt orders two words by the ranks of their lowercased characters in
  // the fixed 37-character alphabet (cn:chrank; a character outside it ranks
  // 37, so all such characters are equal), shorter-on-prefix first, equal is
  // F. The lowering and the ranking stay CANON -- lex:lw and cn:chrank are
  // memoised and evaluated here by name, so the twin cannot mean anything
  // the DEF does not -- and only the per-character WHILE is native: 136,110
  // calls from cn:ordlt on the eu-law report (2026-09-06).
  "cn:strlt": x => { const la = [...String(Ev("lex:lw", at(x, 0)))], lb = [...String(Ev("lex:lw", at(x, 1)))];
    const n = Math.min(la.length, lb.length);
    for (let i = 0; i < n; i++) { const ra = Ev("cn:chrank", la[i]), rb = Ev("cn:chrank", lb[i]);
      if (ra === rb) continue; return bool(rb > ra); }
    return bool(la.length < lb.length); },
  // cn:ordlt orders <rank, name> pairs: equal ranks by cn:strlt on the names,
  // otherwise "a's rank is below b's", which canon writes as `not null
  // (theta:drop [theta:iota b, a])` -- a list of b integers built and cut per
  // comparison. The support report's column sort made 379k comparisons a
  // minute and iota's 190k lists were 18.7 of its 60 s (2026-09-07). The
  // VALUE of that test is arithmetic: iota has max(0, b) elements and drop
  // keeps them all past a (0 keeps all, a negative drops all, as the twins
  // above read the count), so the list is non-empty iff that remainder is.
  // Ranks that are not integers, where the list's length would be a rounding
  // question, are asked of the DEF; the names stay canon's through cn:strlt.
  "cn:ordlt": x => { const a = seq(at(x, 0)), b = seq(at(x, 1)); const a1 = at(a, 0), b1 = at(b, 0);
    if (deepEq(a1, b1)) return Ev("cn:strlt", [at(a, 1), at(b, 1)]);
    if (!Number.isInteger(a1) || !Number.isInteger(b1)) return Ev(DEFS.get("cn:ordlt"), x);
    const L = b1 > 0 ? b1 : 0;
    const k = a1 === 0 ? 0 : (a1 < 0 ? L : Math.min(L, a1));
    return bool(L - k > 0); },
  "solve:assoc3": x => { const hits = matchRows(at(x, 0), seq(at(x, 1)));
    return hits.length === 0 ? ["", [], []] : hits[0]; },
  // solve:cell is the first cell named n, written as a WHILE walk of the
  // store one tail at a time -- tl copies the rest of the store at every
  // step, so one lookup costs the square of the store, and the writable law
  // asks it once per mandatory role of every fact type (ui:ids -> solve:cell
  // [state:otpops, store]): tl alone was 22% of the base report's samples
  // (AREST_SAMPLE, 2026-09-07). The VALUE is the lookup ast:fetch already
  // indexes, with this DEF's edges: a cell is any element whose second field
  // equals the name, the answer is its third field, none is PHI. The walk
  // stops at the first match and never looks past it, so an element it could
  // not select (an atom, or one without a second field) throws only when the
  // walk would have reached it: the index holds the elements before the first
  // such element, and a name not found before it raises that element's error.
  // rmap:member_pairs answers a row's <position, value> pairs from the row
  // alone, and rmap:wide_row asks it for every row of a group once per key
  // the group is walked for (rmap:group_for): 4.5 million times on the support
  // store, each rebuilding the same pairs, 17% of the compiled report's
  // self time in the sample (2026-09-07). The memo of small arguments cannot
  // hold a row, so this remembers the answer against the row itself -- a
  // canon value is never mutated, so the identity is the value -- and
  // evaluates the DEF once per row. Reset with the other indexes.
  "rmap:member_pairs": x => {
    if (!Array.isArray(x)) return Ev(DEFS.get("rmap:member_pairs"), x);
    let v = MPIDX.get(x);
    if (v === undefined) { v = Ev(DEFS.get("rmap:member_pairs"), x); MPIDX.set(x, v); }
    return v; },
  // theta:natjoin <(theta:natjoin keys), <A, B>> is the natural join canon's
  // theta:NatJoin builds: for each a of A in order, for each b of B in order,
  // a followed by the tail of b where keys:a equals the first field of b.
  // Written as distr, distl and a Filter it is the nested loop over both
  // lists, and it was the boot's rule closure: 20 million COMP applications
  // inside derive:form_join in twenty seconds on the support store
  // (AREST_SAMPLE_WHO, 2026-09-07). The VALUE is one pass: B indexed on its
  // first field in its own order, A walked in its order, each hit combined --
  // pair for pair what the loop gives. Edges: a b that is an atom throws the
  // selector error the loop's predicate threw on it, a key of another kind
  // than the field it is compared with matches nothing here where the strict
  // eq would have thrown, and either side empty is nothing.
  "theta:natjoin": x => {
    const form = seq(at(x, 0)), keys = at(form, 1), ab = at(x, 1);
    const A = seq(at(ab, 0)), B = seq(at(ab, 1));
    const out = [];
    if (A.length === 0) return out;
    const idx = new Map();
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!Array.isArray(b)) throw new Error("selector 1 on atom: " + show(b));
      if (b.length < 1) throw new Error("selector 1 out of range 0");
      const k = keyOf(b[0]);
      let bucket = idx.get(k);
      if (bucket === undefined) { bucket = []; idx.set(k, bucket); }
      bucket.push(b);
    }
    for (let i = 0; i < A.length; i++) {
      const a = seq(A[i]);
      const hits = idx.get(keyOf(Ev(keys, a)));
      if (hits === undefined) continue;
      for (let j = 0; j < hits.length; j++) {
        const b = seq(hits[j]);
        const row = a.slice();
        for (let m = 1; m < b.length; m++) row.push(b[m]);
        out.push(row);
      }
    }
    return out; },
  // render:json is canon's renderer of a value as JSON text: the empty
  // sequence is [], a sequence is its elements rendered and joined by a comma
  // between brackets, a number is its text (implode of the atom, "" + n), and
  // a string is quoted with canon's four escapes -- backslash, quote, newline
  // and return -- every other character as it is. Written as ALPHA over
  // chars per atom, it was 55% of a GET on the support store's API (a
  // 3,000-row collection, 341 ms; the profile-and-fix loop, 2026-09-07). The
  // same text, one pass; quote_str is the same quoting on its own.
  // system:pop_in <name, store> is the population named: a top-level cell of
  // that name as it is, else the cell of that name inside FILE with its
  // nested cells unfolded into flat rows (ast:FetchPop, a form built per name
  // over ast:fp_hashp / ast:fp_nested / ast:FetchM, then main:flat over
  // ALPHA(ast:pop_exp)), else PHI. A write validates every fact type's
  // mandatory roles over the store after the leg, and this fetch, several
  // forms per row, was 53% of a POST on the support store that never
  // answered inside the cap (the profile-and-fix loop, 2026-09-07). The
  // unfolding here is ast:pop_exp's, row for row: a cell row <CELL, name,
  // contents> becomes name before each row of its contents unfolded
  // (ast:pop_sub: nothing is one empty row, cells recurse, an atom is a
  // one-atom row, a row is itself); an atom row is a one-atom row; a row is
  // itself. The lookups are ast:fetch's twin, the first cell named.
  "system:pop_in": x => { const name = at(x, 0), store = at(x, 1);
    const fetch = FASTPRIMS.get("ast:fetch");
    const top = fetch([name, store]);
    if (top !== "#") return top;
    const file = fetch(["FILE", store]);
    if (file === "#") return [];
    const cell = fetch([name, file]);
    if (cell === "#") return [];
    const out = [];
    const rows = seq(cell);
    for (let i = 0; i < rows.length; i++) popExp(rows[i], out);
    return out; },
  // store:drop_cell <name, store> is the store without the cells of that
  // name, in order, and store:cl_put <cell, store> is the cell before the
  // store without its namesake; both written as an INSERT fold prepending
  // with apndl, which copies the accumulator at every kept cell, so one drop
  // costs the square of the store. The journal fold runs them once per
  // derived population per entry (store:closed), and the arest-dev hook's
  // boot sampled at apndl 34% and apndr 17% of self inside ui:replay (the
  // profile-and-fix loop, 2026-09-08). The VALUE is one pass; the selector on
  // a cell without a name throws where the fold's predicate threw at it.
  "store:drop_cell": x => { const name = at(x, 0), cells = seq(at(x, 1));
    const out = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!Array.isArray(c)) throw new Error("selector 2 on atom: " + show(c));
      if (c.length < 2) throw new Error("selector 2 out of range " + c.length);
      if (!deepEq(name, c[1])) out.push(c);
    }
    return out; },
  "store:cl_put": x => { const cell = at(x, 0), cells = seq(at(x, 1));
    const name = at(cell, 1);
    const out = [cell];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!Array.isArray(c)) throw new Error("selector 2 on atom: " + show(c));
      if (c.length < 2) throw new Error("selector 2 out of range " + c.length);
      if (!deepEq(name, c[1])) out.push(c);
    }
    return out; },
  "render:json": x => jsonText(x),
  "quote_str": x => { if (typeof x !== "string") throw new Error("chars on non-string"); return jsonQuote(x); },
  "solve:cell": x => { const name = at(x, 0), cells = seq(at(x, 1));
    let idx = SOLVEIDX.get(cells);
    if (idx === undefined) { idx = { at: new Map(), bad: null };
      for (let i = 0; i < cells.length; i++) {
        let k;
        try { k = keyOf(at(cells[i], 1)); } catch (e) { idx.bad = e; break; }
        if (!idx.at.has(k)) idx.at.set(k, i); }
      SOLVEIDX.set(cells, idx); }
    const i = idx.at.get(keyOf(name));
    if (i === undefined) { if (idx.bad !== null) throw idx.bad; return []; }
    return at(cells[i], 2); },
  // theta:append_phi = apndr . [id, CONST PHI]: the list with PHI appended, the
  // fold base every INSERT filter carries; three million calls per report
  "theta:append_phi": x => { const l = seq(x); const out = l.slice(); out.push([]); return out; },
  // derive:jo_rows = INSERT(derive:keep_jo) . append_phi . distl . [1, derive:cross . 2]:
  // the CROSS PRODUCT of the two row lists, then every pair tested on the key
  // columns. That is a nested loop, and once the schema stopped being rebuilt it
  // was the whole us-law closure -- 640,372 derive:jo_check calls over 2009
  // joins, 2.5 of 4.1 seconds (2026-09-04). A hash join answers the same rows.
  //
  // The SEQUENCE is the same too, which is what makes this a twin and not a
  // rewrite. derive:cross is distr then ALPHA(distl) then flatten, so the pairs
  // run left-major and right-minor; INSERT over append_phi folds from the right
  // and prepends, so the survivors keep that order. Indexing the RIGHT list in
  // its own order and walking the LEFT one gives pair for pair what the fold
  // gives. An empty key list is Backus's and-of-nothing -- true -- so it is the
  // full cross product, and either side empty is nothing.
  "derive:jo_rows": x => {
    const keys = seq(at(x, 0)), pair = at(x, 1);
    const A = seq(at(pair, 0)), B = seq(at(pair, 1));
    const out = [];
    if (A.length === 0 || B.length === 0) return out;
    if (keys.length === 0) {
      for (const a of A) for (const b of B) out.push([...seq(a), ...seq(b)]);
      return out;
    }
    const selA = keys.map(k => at(k, 0)), selB = keys.map(k => at(k, 1));
    const idx = new Map();
    for (const b of B) {
      // length-prefixed: plain concatenation lets <"a","sb"> and <"as","b">
      // spell one string, which would join rows that do not match
      let k = "";
      for (let i = 0; i < selB.length; i++) { const v = keyOf(Ev(selB[i], b)); k += v.length + ":" + v; }
      let bucket = idx.get(k);
      if (bucket === undefined) { bucket = []; idx.set(k, bucket); }
      bucket.push(b);
    }
    for (const a of A) {
      let kk = "";
      for (let i = 0; i < selA.length; i++) { const v = keyOf(Ev(selA[i], a)); kk += v.length + ":" + v; }
      const bucket = idx.get(kk);
      if (bucket === undefined) continue;
      const as = seq(a);
      for (const b of bucket) out.push([...as, ...seq(b)]);
    }
    return out; },
  // rmap:member_pairs turns a relation's rows into <key, nonkeys> pairs: for each
  // row of its fifth field, the key column (rmap:keypos) and the other columns
  // (rmap:nonkey_positions), each read by apply. The memo keys on the argument's
  // identity, and law:slot_for hands it a tuple built fresh per call, so the
  // same rows were paired 343,476 times over (12 of the report's 67 seconds,
  // 2026-09-04). The value depends on the rows and the two position answers
  // only; cached on the rows' identity under those. The positions are asked of
  // the DEFs as apply would ask them, and a selector past a row's end throws at
  // that row.
  "rmap:member_pairs": x => {
    // the same descriptor object asks again and again (each relation of a
    // wide row, per row): answered by identity first
    if (Array.isArray(x)) { const byId = PAIRIDX.get(x); if (byId !== undefined && !(byId instanceof Map)) return byId; }
    const rows = seq(at(x, 4));
    // the positions are functions of the descriptor's other fields, so those
    // fields key the cache and the positions are asked once per distinct descriptor
    const ck = JSON.stringify([at(x, 0), at(x, 1), at(x, 2), at(x, 3)]);
    let per = PAIRIDX.get(rows);
    if (per === undefined || !(per instanceof Map)) { per = new Map(); PAIRIDX.set(rows, per); }
    let out = per.get(ck);
    if (out === undefined) {
      const keypos = Ev("rmap:keypos", x), nonkeys = seq(Ev("rmap:nonkey_positions", x));
      out = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) { const r = rows[i];
        const nk = new Array(nonkeys.length);
        for (let j = 0; j < nonkeys.length; j++) nk[j] = Ev(nonkeys[j], r);
        out[i] = [Ev(keypos, r), nk]; }
      per.set(ck, out);
    }
    if (Array.isArray(x) && x !== rows) PAIRIDX.set(x, out);
    return out; },
  "theta:filter_eq": x => seq(x).filter(p => deepEq(at(p, 0), at(p, 1))),
  // access cells - each mirrors its DEF's edges exactly: negative
  // counts drain, last on empty is "?", nth out-of-range throws the
  // selector error, dedup keeps LAST occurrences (the right fold),
  // setminus is a multiset filter of the first argument.
  "theta:drop": x => { const l = seq(at(x, 0)); const n = at(x, 1);
    return l.slice(n === 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n))); },
  "theta:take": x => { const l = seq(at(x, 0)); const n = at(x, 1);
    return l.slice(0, n === 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n))); },
  // read:lines, one pass. The DEF scans the characters of a readings file with
  // a WHILE whose every step takes tl of the rest, which slices, so the scan is
  // quadratic here: 32,000 characters in 1.7 s and core.md in 22 s (2026-09-15)
  // where the paragraphs, the sentences and the markers -- which fold over
  // lines and paragraphs, short things -- take milliseconds. Same contract,
  // step for step: inside a comment everything is dropped until `-->`, which
  // closes it with one space; `<!--` opens one; a newline ends a line; a
  // carriage return is nothing; the last line is pushed even when empty. The
  // DEF is the meaning and the suite holds this against its compiled form.
  "read:lines": x => { const cs = seq(x); const out = []; let line = [], inc = false;
    for (let i = 0; i < cs.length; ) { const c = cs[i];
      if (inc) { if (c === "-" && cs[i + 1] === "-" && cs[i + 2] === ">") { line.push(" "); inc = false; i += 3; } else i++; continue; }
      if (c === "<" && cs[i + 1] === "!" && cs[i + 2] === "-" && cs[i + 3] === "-") { inc = true; i += 4; continue; }
      if (c === "\n") { out.push(line); line = []; i++; continue; }
      if (c === "\r") { i++; continue; }
      line.push(c); i++; }
    out.push(line); return out; },
  // read:spoken, one pass. The DEF is
  //   COMP(apply, CONS(COMP(apply, CONS(K("theta:Filter"), K(not . eq . <id, K"-">))), id))
  // -- it applies theta:Filter to the predicate to BUILD a filter, then applies
  // that to the argument, so the closure is rebuilt on every call. Measured on
  // the base metamodel's reader path (16 files, 1809 rows, 2026-09-18): 411,268
  // calls, 6,475 ms self, 18% of a 35.6 s run, the largest named cost there and
  // the same "rebuild per call and dominate the profile" shape recorded above
  // for cn:keypath. Twelve DEFs call it -- read:row, read:pop_cand, read:pop_ctx,
  // read:type_row_of, the five read:uc_*_at, read:strip_ref, read:deo_unary_at,
  // read:order_rowsubs -- so it is on every sentence.
  // Same contract, probed against the compiled DEF before it was written: drop
  // the elements of the top level that ARE the atom "-", keep everything else
  // untouched. A nested <"-"> is kept because it is not the atom; "--", "-x",
  // "" and " " are kept because they are not it either. The DEF is the meaning
  // and the suite holds this against its compiled form.
  "read:spoken": x => seq(x).filter((e) => e !== "-"),
  // read:super_of, one native pass with an index. The DEF is a COND over
  // theta:flatten(ALPHA(guard)(distr<rows, name>)): it pairs the name with
  // EVERY row, interprets the guard per pair -- read:player_head on the
  // players, read:is_subtyping on slot 5, a length check -- and answers with
  // the SECOND PLAYER OF THE FIRST ROW that passes, or the empty atom when
  // none does. First-wins is the meaning and not an accident of the scan, so
  // the index keeps the first parent it sees for a name and no later row
  // displaces it. read:is_subtyping is reproduced exactly: slot 5 head
  // "subtype", or head "derived" with "subtype" behind it; anything else is
  // not a subtyping. Every shape the DEF RAISES on defers back to it rather
  // than inventing an answer -- a row too short for slot 2 or slot 5, an
  // empty slot 5, a non-sequence where the DEF would index -- as cn:ordlt and
  // rmap:member_pairs do, and the whole rows array is checked BEFORE any
  // index is kept so a later bad row cannot be masked by an earlier good one.
  // The DEF is the meaning and the suite holds this against its compiled form.
  "read:super_of": x => { const rows = at(x, 1), name = at(x, 0);
    const def = () => Ev(DEFS.get("read:super_of"), x);
    if (!Array.isArray(rows)) return def();
    let idx = SUPEROF.get(rows);
    if (idx === undefined) {
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) return def();
        if (!Array.isArray(row[1]) || !Array.isArray(row[4]) || row[4].length < 1) return def();
        if (row[4][0] === "derived" && row[4].length < 2) return def();
      }
      idx = new Map();
      for (const row of rows) {
        const players = row[1], f5 = row[4];
        const sub = f5[0] === "subtype" || (f5[0] === "derived" && f5[1] === "subtype");
        if (!sub || players.length !== 2) continue;
        if (!idx.has(players[0])) idx.set(players[0], players[1]);
      }
      SUPEROF.set(rows, idx);
    }
    const v = idx.get(name);
    return v === undefined ? "" : v; },
  // read:put_row, one native pass. The DEF is COMP(ALPHA(read:row_at), distr):
  // distr pairs EVERY row with the item and read:row_at is interpreted once per
  // pair, so a put costs a full interpreted scan. Measured on the base
  // metamodel's reader path (2026-09-18): 1,354 calls produced 1,274,506
  // read:row_at calls -- 941 per write, which is exactly the row count -- for
  // 5,478 ms inclusive, of which read:is_fact alone is 1,302,099 calls. The
  // scan is inherent (the answer is the whole row list), the INTERPRETATION of
  // it is not.
  // Same contract: a row whose 5th field's first element is a list is a fact
  // row; if its 1st field equals the item's, its 5th field gains the item's 2nd
  // -- unless already present anywhere in it -- into the last chunk while that
  // chunk holds fewer than 9, else into a new one. Every other row is itself.
  // ANY shape the DEF would raise on is handed back to the DEF, whose selector
  // errors are the contract and not this twin's to reproduce: an atom row, a
  // row shorter than 5 (or than 7 once matched), an empty or non-list 5th
  // field, a chunk that is not a list, an item without the field the match
  // needs. cn:ordlt and rmap:member_pairs defer the same way. Probed against
  // the compiled DEF on 21 shapes before it was written, five of which throw.
  "read:put_row": x => { const rows = seq(at(x, 0)), item = at(x, 1);
    const def = () => Ev(DEFS.get("read:put_row"), x);
    if (!Array.isArray(item) || item.length < 1) return def();
    const out = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) { const row = rows[i];
      if (!Array.isArray(row) || row.length < 5) return def();
      const f5 = row[4];
      if (!Array.isArray(f5) || f5.length < 1) return def();
      if (!Array.isArray(f5[0]) || !deepEq(row[0], item[0])) { out[i] = row; continue; }
      if (row.length < 7 || item.length < 2) return def();
      for (const c of f5) if (!Array.isArray(c)) return def();   // catall cats them all, so all are read
      const val = item[1];
      let found = false;
      for (const c of f5) { for (const e of c) if (deepEq(e, val)) { found = true; break; } if (found) break; }
      let nf5 = f5;
      if (!found) { const last = f5[f5.length - 1];
        nf5 = last.length < 9 ? [...f5.slice(0, -1), [...last, val]] : [...f5, [val]]; }
      out[i] = [row[0], row[1], row[2], row[3], nf5, row[5], row[6]]; }
    return out; },
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
  // theta:dedup is 55 s of eu-law's report, and it is NOT re-keying sequences
  // it has already keyed: remembering each element's JSON against the element
  // (a WeakMap, sound because canon values are immutable) was byte-identical
  // and bought nothing, 284 -> 294 s, because rmap:pidchains rebuilds its
  // chains every round rather than carrying the same objects forward. The cost
  // is real stringify work over genuinely new sequences, so reaching it means
  // deduping less or deduping on a cheaper key, not caching.
  "theta:dedup": x => { const l = seq(x);
    const prov = CATPROV.get(l);
    if (prov !== undefined) {
      const p = prov[0], s = prov[1], pk = DEDUPKEYS.get(p);
      if (pk !== undefined && pk.length === p.length) {
        // p is duplicate-free with its keys aligned: drop from p what s
        // re-states (its last occurrence is in s), then dedup(s) in order
        const sk = new Array(s.length), drop = new Set();
        for (let i = 0; i < s.length; i++) { sk[i] = keyOf(s[i]); drop.add(sk[i]); }
        const out = [], ok = [];
        for (let i = 0; i < p.length; i++) if (!drop.has(pk[i])) { out.push(p[i]); ok.push(pk[i]); }
        const seen = new Set(), tail = [], tk = [];
        for (let i = s.length - 1; i >= 0; i--) if (!seen.has(sk[i])) { seen.add(sk[i]); tail.push(s[i]); tk.push(sk[i]); }
        for (let i = tail.length - 1; i >= 0; i--) { out.push(tail[i]); ok.push(tk[i]); }
        DEDUPKEYS.set(out, ok);
        return out;
      }
    }
    const seen = new Set(); const out = [], ok = [];
    for (let i = l.length - 1; i >= 0; i--) { const k = keyOf(l[i]);
      if (!seen.has(k)) { seen.add(k); out.push(l[i]); ok.push(k); } }
    out.reverse(); ok.reverse(); DEDUPKEYS.set(out, ok); return out; },
  "theta:setminus": x => { const a = seq(at(x, 0)), b = seq(at(x, 1));
    const drop = new Set(b.map(keyOf));
    return a.filter(e => !drop.has(keyOf(e))); },
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
  // main:flat = INSERT cat . theta:append_phi, the same fold under another name
  "main:flat": x => { const out = [];
    for (const s of seq(x)) { const a = seq(s);
      for (let i = 0; i < a.length; i++) out.push(a[i]); }
    return out; },
  // rmap:slot = rmap:lookup0 . [2, rmap:member_pairs . 1]: the row of the
  // relation (first field) keyed by the value (second field), or PHI; two
  // million calls per report, each a CONS and two dispatches once its parts
  // are twins. rmap:wide_row = apndl . [1, ALPHA(rmap:slot) . distr . [2, 1]]:
  // the key followed by its slot in each relation of the list.
  "rmap:slot": x => { const pairs = seq(Ev("rmap:member_pairs", at(x, 0)));
    const hits = matchRows(at(x, 1), pairs);
    return hits.length === 0 ? [] : [at(hits[0], 1)]; },
  // The slot is taken inline: a dispatch of rmap:slot by name per relation
  // was 16% of the compiled support report's self time, 4.5 million times
  // (AREST_SAMPLE, 2026-09-07); the pairs come through rmap:member_pairs'
  // twin, remembered against the relation, and the lookup through the index
  // rmap:lookup0 uses -- the same value the slot twin above answers.
  // A slot index per relation: keyOf of the first field of each member pair to
  // the second field of the first such pair (rmap:lookup0's answer), built once
  // per relation and kept against it; the key's keyOf is taken once per row.
  // 13,809 wide rows over a few hundred relations each were half of the
  // support report's first ten seconds at half a millisecond a row with the
  // general index (the profile-and-fix loop, 2026-09-08).
  "rmap:wide_row": x => { const key = at(x, 0), rels = seq(at(x, 1));
    const pairsOf = FASTPRIMS.get("rmap:member_pairs");
    const kk = keyOf(key);
    const out = new Array(rels.length + 1); out[0] = key;
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i];
      let slots = SLOTIDX.get(rel);
      if (slots === undefined) {
        slots = new Map();
        const pairs = seq(pairsOf(rel));
        for (let j = 0; j < pairs.length; j++) {
          const p = pairs[j];
          if (!Array.isArray(p)) throw new Error("selector 1 on atom: " + show(p));
          if (p.length < 1) throw new Error("selector 1 out of range 0");
          const k = keyOf(p[0]);
          if (!slots.has(k)) slots.set(k, p);
        }
        SLOTIDX.set(rel, slots);
      }
      const hit = slots.get(kk);
      out[i + 1] = hit === undefined ? [] : [at(hit, 1)];
    }
    return out; },
  // law:slot_for = rmap:lookup0 . [1, rmap:member_pairs . [1.1.2, 2.1.2, 3.1.2,
  // 4.1.2, rmap:unnest . 2.2]]: the descriptor's four fields with the nested
  // rows unnested make the relation; unnest memoizes on its argument, so the
  // rows keep their identity and member_pairs' cache holds
  "law:slot_for": x => { const d = seq(at(x, 1));
    // the <descriptor, nested rows> pair is the same object for every key asked
    // of it (distl pairs each key with it), so its pairs are cached on it
    let pairs = PAIRIDX.get(d);
    if (pairs === undefined || pairs instanceof Map) {
      const desc = seq(at(d, 0));
      const rel = [at(desc, 0), at(desc, 1), at(desc, 2), at(desc, 3), Ev("rmap:unnest", at(d, 1))];
      pairs = seq(Ev("rmap:member_pairs", rel));
      PAIRIDX.set(d, pairs);
    }
    const hits = matchRows(at(x, 0), pairs);
    return hits.length === 0 ? [] : [at(hits[0], 1)]; },
  // the atoms of a form, in order: an atom is itself, PHI is nothing, a sequence
  // is its elements' atoms flattened. law:atoms_of and manifest:opatoms are this
  // fold under two names, each called half a million times per report and
  // recursing a level per nesting; one walk.
  "law:atoms_of": x => atomsOf(x),
  "manifest:opatoms": x => atomsOf(x),
  // rmap:merge_cells = INSERT rmap:merge_two . theta:append_phi: cells of one
  // name become one cell, in the order the names first appear, its contents the
  // cells' contents in source order (the right fold prepends a new name and
  // concatenates a seen one). A cell that stands alone is kept as itself, as
  // apndl keeps it; a merged one is <CELL, name, contents> as merge_hit makes
  // it. A cell short of three fields, or contents that are no sequence, throw
  // where the fold would.
  "rmap:merge_cells": x => { const cells = seq(x);
    const groups = new Map(); const order = [];
    for (let i = 0; i < cells.length; i++) { const c = cells[i];
      const name = at(c, 1); const k = keyOf(name);
      let g = groups.get(k);
      if (g === undefined) { g = { cell: c, name, parts: [] }; groups.set(k, g); order.push(k); }
      else g.cell = null;
      g.parts.push(c); }
    const out = new Array(order.length);
    for (let i = 0; i < order.length; i++) { const g = groups.get(order[i]);
      if (g.cell !== null) { out[i] = g.cell; continue; }
      const contents = [];
      for (const c of g.parts) { const a = seq(at(c, 2)); for (let j = 0; j < a.length; j++) contents.push(a[j]); }
      out[i] = ["CELL", g.name, contents]; }
    return out; },
  // charisup: a string's first character is an ASCII capital; the empty string is
  // F, as null . chars says. Anything but a string is asked of the DEF.
  "charisup": x => { if (typeof x !== "string") return Ev(DEFS.get("charisup"), x);
    return bool(x.length > 0 && x[0] >= "A" && x[0] <= "Z"); },
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
  // rmap:nest curries an extension into levels: at each level the rows group by
  // their first column and each group nests again with that column dropped, a
  // group of pairs ending in its second columns and a level of single columns
  // in its values. Canon writes the grouping as one filter over every row PER
  // KEY (rmap:rows_for = INSERT keep_row_of . append_phi . distl), quadratic at
  // every level, and the profile charged it 97 million CONS and 162 of the 165
  // seconds the host took to load us-law's FILE (2026-09-04). The VALUE is one
  // pass: group in a Map, then emit. Edges mirrored: keys come in theta:dedup's
  // order (last occurrences), a group's rows keep source order, an atom where a
  // row should be throws the selector error, the empty level is PHI.
  "rmap:nest": function nest(x) {
    const rows = seq(x);
    if (rows.length === 0) return [];
    if (seq(rows[0]).length === 1) return rows.map(r => at(r, 0));
    const groups = new Map();
    for (let i = 0; i < rows.length; i++) { const r = seq(rows[i]); const k = JSON.stringify(r[0]);
      let g = groups.get(k); if (g === undefined) { g = { key: r[0], rows: [] }; groups.set(k, g); }
      g.rows.push(r); }
    const order = []; const seen = new Set();
    for (let i = rows.length - 1; i >= 0; i--) { const k = JSON.stringify(seq(rows[i])[0]);
      if (!seen.has(k)) { seen.add(k); order.push(k); } }
    order.reverse();
    const out = [];
    for (const k of order) { const g = groups.get(k);
      const leaf = seq(g.rows[0]).length === 2;
      out.push(["CELL", g.key, leaf ? g.rows.map(r => at(r, 1)) : nest(g.rows.map(r => r.slice(1)))]); }
    return out; },
  // derive:count_rows is the count form: <selector, rows> to <key, n> for each
  // distinct selector value, keys in theta:dedup's order (last occurrences).
  // Canon takes the keys, then for EACH key scans every row again
  // (derive:count_for = length . derive:filter_sel), quadratic; four count
  // rules of us-law cost the closure 262 seconds in 11,332 scans (2026-09-04).
  // The VALUE is one pass: the selector once per row, a Map of counts, then the
  // keys in the fold's order. The selector is evaluated through Ev exactly as
  // apply would, so a selector that throws still throws at the same row.
  "derive:count_rows": x => { const sel = at(x, 0), rows = seq(at(x, 1));
    const keyOf = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) keyOf[i] = Ev(sel, rows[i]);
    const counts = new Map();
    for (let i = 0; i < rows.length; i++) { const k = JSON.stringify(keyOf[i]);
      const c = counts.get(k);
      if (c === undefined) counts.set(k, { key: keyOf[i], n: 1 }); else c.n++; }
    const order = []; const seen = new Set();
    for (let i = rows.length - 1; i >= 0; i--) { const k = JSON.stringify(keyOf[i]);
      if (!seen.has(k)) { seen.add(k); order.push(k); } }
    order.reverse();
    return order.map(k => { const c = counts.get(k); return [c.key, c.n]; }); },
  // keyed by keyOf, not JSON.stringify: the first screen's sample on the
  // support store put this lookup at 23% of self time, all of it the
  // stringify of a name per ask inside the boot's rule closure (2026-09-07);
  // keyOf keys an atom as its tag and text and a row as its atoms joined, and
  // two values key equal iff they are deepEq, the same contract
  "theta:find_desc": x => { const name = at(x, 0), descs = seq(at(x, 1));
    let idx = DESCIDX.get(descs);
    if (idx === undefined) { idx = new Map();
      if (SAMPLE) SWHOCOUNT.set("theta:find_desc <- (index built, " + descs.length + " descs)", (SWHOCOUNT.get("theta:find_desc <- (index built, " + descs.length + " descs)") || 0) + 1); // @instrument
      for (const d of descs) { if (!Array.isArray(d) || d.length === 0) continue;
        const k = keyOf(d[0]);
        if (!idx.has(k)) idx.set(k, d); }
      DESCIDX.set(descs, idx); }
    const hit = idx.get(keyOf(name));
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
    // distr frames are <element, carrier>; distl frames are <carrier, element>.
    // So the ELEMENT sits at slot 1 under distr and at slot 2 under distl,
    // and the resolution below inverts with it.
    const dl = form[3] === "distl";
    const es = dl ? 2 : 1, cs = dl ? 1 : 2;
    // THE KEY IS THE EQUALITY EVERY EMITTING PATH NEEDS. The first cut matched
    // COND(eq, emit, PHI) alone; the key may sit under an `and`
    // (rmap:pidchains:step: COND(and[eq, q], emit, PHI) over childrenN, 424
    // million CONS applications in nine minutes with no law printed), or
    // below a kind test (cn:mandfor: COND(eq[kind, info], COND(eq[key],
    // COND(.., emit, PHI), PHI), COND(eq[key], .., PHI)) over every chain row,
    // 1,555 calls in the column mapping, 2026-09-06). necKey walks the COND
    // tree: a branch that is PHI never emits, a branch guarded by the eq
    // requires it, and the tree has a key when every branch that can emit
    // requires the same one. The index answers the key; the BODY itself runs
    // on the hits, in list order, so the value and its order are the scan's.
    // What differs is that the body is never evaluated on a row whose key
    // disagrees, which the scan would have done and could only have thrown
    // on, since such a row emits nothing.
    const k = necKey(body, es, cs);
    if (k !== null && k !== "never") pat = { elem: k.elem, carrier: k.carrier, body: body, distl: dl };
  }
  JOINPAT.set(form, pat);
  return pat;
}
function isPhiForm(f) {
  return Array.isArray(f) && f[0] === "CONST" && Array.isArray(f[1]) && f[1].length === 0;
}
function eqKey(p, es, cs) {
  if (!(Array.isArray(p) && p[0] === "COMP" && p.length === 3 && p[1] === "eq"
      && Array.isArray(p[2]) && p[2][0] === "CONS" && p[2].length === 3)) return null;
  const l = p[2][1], r = p[2][2], rl = rootSel(l), rr = rootSel(r);
  // SAFETY: the two sides must be ROOTED at different frame slots -- one
  // reading only the element, one only the carrier -- or the key is not a
  // function of the element alone and no index is valid.
  if (rl === es && rr === cs) return { elem: l, carrier: r, form: p };
  if (rl === cs && rr === es) return { elem: r, carrier: l, form: p };
  return null;
}
// null: no key; "never": this branch emits nothing; else the key.
function necKey(body, es, cs) {
  if (isPhiForm(body)) return "never";
  if (!(Array.isArray(body) && body[0] === "COND" && body.length === 4)) return null;
  const p = body[1];
  let kp = eqKey(p, es, cs);
  if (kp === null && Array.isArray(p) && p[0] === "COMP" && p.length === 3 && p[1] === "and"
      && Array.isArray(p[2]) && p[2][0] === "CONS" && p[2].length === 3)
    kp = eqKey(p[2][1], es, cs) || eqKey(p[2][2], es, cs);
  const kf = necKey(body[2], es, cs), kg = necKey(body[3], es, cs);
  // the then-branch emits only when p holds: it requires p's key if p has
  // one, else whatever the branch itself requires; the else-branch learns
  // nothing from p being false.
  const reqF = kf === "never" ? "never" : (kp !== null ? kp : kf);
  if (kg === "never") return reqF;
  if (reqF === "never") return kg;
  if (reqF !== null && kg !== null && JSON.stringify(reqF.form) === JSON.stringify(kg.form)) return reqF;
  return null;
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
// ---- THE INSTRUMENTS -------------------------------------------------------
// Everything from here to the matching end marker, and every line in the
// evaluator ending in `// @instrument`, is dropped by build.js unless the
// composition is instrumented (AREST_INSTRUMENTED=1): a release module
// carries no profiler, no stamp, no trace (Sam, 2026-09-07: "we don't want
// to leave perf counters in a release build").
// @instrument-begin
// AREST_PROFILE=1 counts every evaluation of a named definition and its self
// time (its own work less its children's), and prints the top of the table on
// stderr at each boot lap and once a minute while a phase runs. A boot that
// takes minutes on a store of a few thousand facts is an interpreter cost with
// a name, and this is how the name is found (us-law, 2026-09-04).
const PROFILE = !!process.env.AREST_PROFILE;
// AREST_PROFILE_EVERY=<ms> is the recording horizon (default a minute): the
// table prints, and the facts file is written, each time that many ms have
// passed since the last report. A run recorded at a fixed horizon is one
// measurement comparable across stores -- "the first 90 s of support's
// report" beside "the first 90 s of eu-law's" -- where the minute cadence
// gives whichever snapshot the kill happened to leave (Sam, 2026-09-07).
const PROFEVERY = parseInt(process.env.AREST_PROFILE_EVERY, 10) > 0 ? parseInt(process.env.AREST_PROFILE_EVERY, 10) : 60000;
// AREST_STACK=1 keeps the canon frame stack without the timing: the stack at
// an uncaught throw costs a push and a pop per call, the profile costs two
// clock reads and a table update, and a report that takes twenty minutes to
// die takes forty under the profile (support, 2026-09-06)
const STACKS = PROFILE || !!process.env.AREST_STACK;
const PROF = new Map();
const PROFSTACK = [];
// caller -> callee -> calls: a callee's count and self time say it is hot;
// only its callers say which rewrite would help (theta:dedup at 334k calls
// is one fix if one join makes them and another if a hundred do, 2026-09-06)
const PROFEDGES = new Map();
let PROFLAST = 0;
let PROFN = 0;
// WHERE IT THREW, NOT JUST WHAT IT SAID. A throw inside the evaluator reaches
// the top as a stack of Ev frames, which names nothing; the profiler's stack
// is the canon's, so under AREST_PROFILE an uncaught throw prints it,
// outermost first (support's law report died with "INSERT on empty" and no
// law printed, 2026-09-06).
if (STACKS) process.on("uncaughtException", (e) => {
  console.error("canon stack at throw: " + ((e && e.canonStack) || "(no canon frame)"));
  console.error(String(e && e.stack || e));
  process.exit(2);
});
function profEnter(name) {
  if (!PROFILE) { PROFSTACK.push([name, 0, 0]); return; }
  // the caller is the nearest DEFINITION on the stack -- a namespaced name --
  // not the CONS or COMP form it sits inside, which is what the top frame
  // usually is and attributes nothing (246k of theta:dedup's 334k calls went
  // to "CONS" on the first try); names carry no spaces, so one separates
  for (let i = PROFSTACK.length - 1; i >= 0; i--) {
    const c = PROFSTACK[i][0];
    if (c.indexOf(":") < 0) continue;
    const k = c + " " + name;
    PROFEDGES.set(k, (PROFEDGES.get(k) || 0) + 1);
    break;
  }
  PROFSTACK.push([name, performance.now(), 0]);
}
// the frames are gone by the time an uncaught throw reaches the top (every
// `finally` has popped its own), so the stack is attached to the error at the
// innermost frame it passes through, and the top prints that
function profThrow(e) {
  if (e && typeof e === "object" && e.canonStack === undefined) e.canonStack = PROFSTACK.map((f) => f[0]).join(" > ");
  throw e;
}
// AREST_PROFILE_TRACE=<prefix,...> prints each exit of a definition whose name
// starts with one of the prefixes, with its inclusive time, as it happens:
// `law:` gives the report law by law, in order, inside whatever cap the run
// has, where the table at a horizon shows only what has already returned and
// the running line only what is running (support's compiled report,
// 2026-09-07: fifty-odd laws of seconds each, none the elephant).
const PROFTRACE = PROFILE && process.env.AREST_PROFILE_TRACE ? String(process.env.AREST_PROFILE_TRACE).split(",").filter((p) => p.length > 0) : [];
function profExit() {
  const fr = PROFSTACK.pop();
  if (!PROFILE) return;
  const incl = performance.now() - fr[1];
  const self = incl - fr[2];
  if (PROFTRACE.length && PROFTRACE.some((p) => String(fr[0]).startsWith(p))) console.error("trace: " + fr[0] + "  " + Math.round(incl) + " ms");
  let row = PROF.get(fr[0]);
  if (row === undefined) { row = [0, 0, 0]; PROF.set(fr[0], row); }
  row[0]++; row[1] += self; row[2] += incl;
  if (PROFSTACK.length) PROFSTACK[PROFSTACK.length - 1][2] += incl;
  if ((++PROFN & 0x3ffff) === 0 && performance.now() - PROFLAST > PROFEVERY) profReport("minute");
}
function profReport(label) {
  PROFLAST = performance.now();
  // AREST_PROFILE=<n> prints n rows; any other value prints 24
  const nRows = parseInt(process.env.AREST_PROFILE, 10) > 1 ? parseInt(process.env.AREST_PROFILE, 10) : 24;
  const rows = [...PROF.entries()].sort((a, b) => b[1][1] - a[1][1]).slice(0, nRows);
  // WHAT IS RUNNING NOW, because the table cannot say: a definition's time is
  // recorded when it EXITS, so the law that has been running since the last
  // report is absent from the table that is supposed to name the cost. The
  // canon stack at the report, outermost first, is the answer (support's
  // report over its compiled carrier, 2026-09-07: no row over 14 s, and the
  // minutes were in a law that had not returned).
  console.error("profile (" + label + ") running: " + PROFSTACK.filter((f) => String(f[0]).indexOf(":") >= 0).map((f) => f[0]).slice(0, 14).join(" > "));
  console.error("profile (" + label + "): name  calls  self ms  incl ms");
  for (const [name, r] of rows) console.error("  " + name + "  " + r[0] + "  " + Math.round(r[1]) + "  " + Math.round(r[2]));
  // AND AS FACTS, because a printed table is read by a person and then lost.
  // Attributing a law report meant reading this table and retyping its numbers
  // into a task, once per session; `Function has Runtime of Milliseconds in JS
  // Package` (apps/arest-dev/readings/build-surface.md) is where they belong, so
  // "what is slow, and does it scale" becomes a query over corpora rather than a
  // measurement repeated by hand. AREST_PROFILE_FACTS names the file and
  // AREST_PROFILE_PACKAGE the store's package; absent, nothing is written and
  // this stays exactly the debug aid it has always been.
  const factPath = process.env.AREST_PROFILE_FACTS;
  if (!factPath) return;
  const pkg = process.env.AREST_PROFILE_PACKAGE || label;
  const esc = (t) => String(t).split("'").join("");
  const L = String.fromCharCode(10);
  let out = "# Profile facts, measured" + L + L
    + "# GENERATED by the js host under AREST_PROFILE_FACTS; regenerate, never edit." + L + L
    + "## Instance Facts" + L + L;
  // All THREE numbers, because self time alone cannot tell a function that is
  // slow from one that is merely called constantly, and that is the difference
  // between fixing a caller and fixing the primitive. Self and inclusive are
  // one measurement on two BASES rather than two fact types -- declaring them
  // as two readings over the same players had the shorter one silently capture
  // the longer one's sentences. Reading inclusive AS self has separately put a
  // wrong figure into a task once, so the basis is now on every row.
  for (const [name, r] of rows) {
    out += "Function '" + esc(name) + "' has Runtime of Milliseconds '"
      + Math.round(r[1]) + "' in JS Package '" + esc(pkg) + "' on Timing Basis 'self'." + L
      + "Function '" + esc(name) + "' has Runtime of Milliseconds '"
      + Math.round(r[2]) + "' in JS Package '" + esc(pkg) + "' on Timing Basis 'inclusive'." + L
      + "Function '" + esc(name) + "' has Call Count '"
      + r[0] + "' in JS Package '" + esc(pkg) + "'." + L;
  }
  // and who calls each reported function, `Function calls Function with Call
  // Count in JS Package` -- edges into the reported rows only, so the file
  // stays the size of the report and not of the whole call graph
  const named = new Set(rows.map(([name]) => name));
  for (const [k, n] of PROFEDGES) {
    const i = k.indexOf(" ");
    const caller = k.slice(0, i), callee = k.slice(i + 1);
    if (!named.has(callee)) continue;
    out += "Function '" + esc(caller) + "' calls Function '" + esc(callee) + "' with Call Count '"
      + n + "' in JS Package '" + esc(pkg) + "'." + L;
  }
  try { require("node:fs").writeFileSync(factPath, out); }
  catch (e) { console.error("profile facts not written: " + e.message); }
}
// THE STAMP (Sam, 2026-09-07: "there's got to be some cheap way to stamp the
// FP/FFP/AST ops so that stack traces aren't the only execution tracker").
// AREST_SAMPLE=<ms> stamps every definition entry with an integer id in a
// shared typed array -- a depth counter and a stack of ids, two stores and a
// map lookup per call, no clock -- and a worker thread samples that stack once
// a millisecond into two histograms: the top id (self) and every id on the
// stack (inclusive). Every <ms> the main thread prints the top of both with
// names, plus the stack as it stands. The clock profiler (AREST_PROFILE)
// costs two clock reads and a table update per call and doubles a run; this
// costs the stores. The two are not meant together: a call under the stamp
// takes this path and not the profiler's.
const SAMPLE = parseInt(process.env.AREST_SAMPLE, 10) > 0 ? parseInt(process.env.AREST_SAMPLE, 10) : 0;
const SDEPTH = 1024, SMAX = 32768;
const STAMP = SAMPLE ? new Int32Array(new SharedArrayBuffer(4 * (2 + SDEPTH + 2 * SMAX))) : null;
const SNAMES = [];
const SIDS = new Map();
let SN = 0, SLAST = 0;
function sid(f) {
  let id = SIDS.get(f);
  if (id === undefined) { id = SNAMES.length; if (id >= SMAX) return SMAX - 1; SNAMES.push(f); SIDS.set(f, id); }
  return id;
}
// AREST_SAMPLE_WHO=<name,...> counts, for each named op, the nearest named
// definition on the stack at each of its entries: a hot primitive (apndr,
// theta:dedup) says only that it is hot; its callers say which walk to fix
const SWHO = SAMPLE && process.env.AREST_SAMPLE_WHO ? new Set(String(process.env.AREST_SAMPLE_WHO).split(",").filter((p) => p.length > 0)) : null;
const SWHOCOUNT = new Map();
function senter(f) {
  const d = STAMP[0];
  if (SWHO !== null && SWHO.has(f)) {
    let caller = "(top)";
    for (let i = Math.min(d, SDEPTH) - 1; i >= 0; i--) { const n = SNAMES[STAMP[2 + i]]; if (typeof n === "string" && n.indexOf(":") >= 0) { caller = n; break; } }
    const k = f + " <- " + caller;
    SWHOCOUNT.set(k, (SWHOCOUNT.get(k) || 0) + 1);
  }
  if (d < SDEPTH) STAMP[2 + d] = sid(f);
  STAMP[0] = d + 1;
  if ((++SN & 0xffff) === 0) { const now = performance.now(); if (now - SLAST >= SAMPLE) { SLAST = now; sreport("sample"); } }
}
function sexit() { STAMP[0]--; }
// AREST_SAMPLE_AFTER_BOOT=1 clears the histograms when the boot laps are done,
// so a report over a container or a cli verb is the sample of the COMMAND and
// not of the load that preceded it (the profile-and-fix loop, 2026-09-07)
function sreset() { if (!SAMPLE) return; STAMP.fill(0, 2 + SDEPTH); STAMP[1] = 0; SWHOCOUNT.clear(); }
function sreport(label) {
  const total = STAMP[1];
  if (total === 0) return;
  const top = (base) => {
    const rows = [];
    for (let i = 0; i < SNAMES.length; i++) { const n = STAMP[base + i]; if (n > 0) rows.push([SNAMES[i], n]); }
    rows.sort((a, b) => b[1] - a[1]);
    // AREST_SAMPLE_TOP=<n> rows per line (16 by default)
    const nTop = parseInt(process.env.AREST_SAMPLE_TOP, 10) > 0 ? parseInt(process.env.AREST_SAMPLE_TOP, 10) : 16;
    return rows.slice(0, nTop).map(([name, n]) => name + " " + Math.round(1000 * n / total) / 10 + "%").join("  ");
  };
  const d = Math.min(STAMP[0], SDEPTH);
  const stack = [];
  for (let i = 0; i < d; i++) stack.push(SNAMES[STAMP[2 + i]]);
  console.error(label + " (" + total + " samples, " + Math.round(performance.now() / 1000) + " s): self: " + top(2 + SDEPTH));
  console.error(label + " inclusive: " + top(2 + SDEPTH + SMAX));
  console.error(label + " running: " + stack.filter((n) => String(n).indexOf(":") >= 0).slice(0, 14).join(" > "));
  if (SWHOCOUNT.size > 0) {
    const rows = [...SWHOCOUNT.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    console.error(label + " who: " + rows.map(([k, n]) => k + " " + n).join("  "));
  }
}
if (SAMPLE) {
  // inclusive counts a name once per sample however many times it is on the
  // stack (CONS is on it at every level), so a name's inclusive share is the
  // share of samples it was on the stack for and never exceeds the whole
  const src = "self.onmessage = (e) => { const S = new Int32Array(e.data.sab), D = e.data.depth, M = e.data.max, W = new Int32Array(new SharedArrayBuffer(4)), seen = new Int32Array(M); let n = 0;"
    + " for (;;) { Atomics.wait(W, 0, 0, 1); n++; const d = Math.min(Atomics.load(S, 0), D); if (d > 0) { S[2 + D + S[2 + d - 1]]++; for (let i = 0; i < d; i++) { const id = S[2 + i]; if (seen[id] !== n) { seen[id] = n; S[2 + D + M + id]++; } } } S[1]++; } };";
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: "application/javascript" })));
  w.postMessage({ sab: STAMP.buffer, depth: SDEPTH, max: SMAX });
  if (typeof w.unref === "function") w.unref();
  process.on("exit", () => sreport("sample at exit"));
}
// @instrument-end
function Ev(f, x) {
  if (typeof f === "number") {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    if (f < 1 || f > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[f - 1];
  }
  if (typeof f === "string") {
    if (DEFS.has(f)) {
      const fp = NOTWIN.has(f) ? undefined : FASTPRIMS.get(f);
      // A native answered here without ever entering the profile, which made
      // the report's own instrument lie by omission: rmap:pidchains:step shows
      // 63 s of "self" time whose real spenders are theta:dedup, theta:member
      // and theta:flatten, none of which could appear. Twice this session a
      // definition was optimised on the strength of what the profile DID show,
      // measured byte-identical, and moved nothing -- the work had never been
      // where the only visible names were. Under AREST_PROFILE a native is now
      // entered like any DEF; with profiling off the dispatch is unchanged.
      if (fp !== undefined) {
        if (SAMPLE) { senter(f); try { return fp(x); } finally { sexit(); } } // @instrument
        if (STACKS) { profEnter(f); try { return fp(x); } catch (e) { profThrow(e); } finally { profExit(); } } // @instrument
        return fp(x);
      }
      if (!memoable(f)) {
        if (SAMPLE) { senter(f); try { return Ev(DEFS.get(f), x); } finally { sexit(); } } // @instrument
        if (STACKS) { profEnter(f); try { return Ev(DEFS.get(f), x); } catch (e) { profThrow(e); } finally { profExit(); } } // @instrument
        return Ev(DEFS.get(f), x);
      }
      return memoCall(f, x, stampedName(f, (y) => Ev(DEFS.get(f), y)));
    }
    if (PRIMS.has(f)) {
      if (SAMPLE) { senter(f); try { return PRIMS.get(f)(x); } finally { sexit(); } } // @instrument
      return PRIMS.get(f)(x);
    }
    throw new Error("unresolved atom: " + f);
  }
  // a form is compiled once into a closure and applied (compileForm, below);
  // the arms described here are the arms it compiles
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
  return compiled(f)(x);
}

// ---- THE COMPILED FORM ----------------------------------------------------
// Sam, 2026-09-07, on the sample that put COMP and CONS at 55 to 65 percent of
// self time on every store: "so a better eval strategy will squeeze out the
// performance?" -- for the constant, yes. Applying a form resolved it every
// time: seq the node, read the head, ask DEFS whether canon shadows it, pick
// the switch arm, look the join pattern up, and for CONS go through the name
// dispatch (four map lookups) into the twin. A form node is now compiled ONCE
// into a closure with all of that resolved, its children compiled the same
// way and bound, and applying the form is applying the closure. Meaning is
// untouched: each arm is the interpreter's arm with its decisions hoisted,
// a name still goes through Ev (twins, memo, profiler and stamp as before), a
// selector is the selector, CONS and CONST compile to what their twins
// answered, a head canon defines is fetched as tau clause (c) says, and a
// definition registered after a node was compiled recompiles it (DEFSVER).
// The 700 cases and the report hashes hold it byte for byte.
const COMPILED = new WeakMap();
function compiled(f) {
  let g = COMPILED.get(f);
  if (g === undefined || g.ver !== DEFSVER) { g = compileForm(f); g.ver = DEFSVER; COMPILED.set(f, g); }
  return g;
}
// a child of a form: a selector inlined, a form compiled and bound, an atom
// through Ev exactly as before (a name's dispatch is Ev's; an atom that is
// neither raises there)
function sub(f) {
  if (typeof f === "number") return (x) => {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    if (f < 1 || f > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[f - 1];
  };
  if (Array.isArray(f)) return compiled(f);
  if (typeof f === "string") return subName(f);
  return (x) => Ev(f, x);
}
// THE MEMO, shared by Ev's name path and the compiled name: the small-argument
// chain of maps, a hit returned before any instrumentation, a miss evaluated
// by `run` (already stamped or profiled as the name) and stored
function memoCall(f, x, run) {
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
  const v = run(x);
  node.set(last, v);
  // THE SIZE BOUND TRIMS THE MEMO, NOT THE INDEXES. The bound existed to
  // keep the memo's maps from growing without limit, and it emptied every
  // identity-keyed index with them; those are WeakMaps on immutable canon
  // values and stay true for as long as the value lives, so wiping them only
  // rebuilt them -- the support report's first ten seconds were rmap:wide_row
  // at 82% of self, most of it re-indexing relations it had indexed before
  // (the profile-and-fix loop, 2026-09-08). The one mutable array is the
  // store, and its mutation points call memoClear, which still clears all.
  if (++EVMEMON > 400000) { EVMEMO.clear(); EVMEMON = 0; }
  return v;
}
// A NAME IN A FORM, resolved once: Ev asked four maps per application (DEFS,
// NOTWIN, FASTPRIMS, the memo's name set and two string prefixes) before it
// did anything, and the sample charged all of it to the enclosing COMP. The
// kind is decided here, at compile time, in Ev's order: a twin, else a
// definition (its body compiled on first application, so a definition that
// names itself compiles), memoised or not, stamped or profiled as the name
// exactly as Ev did; a primitive is looked up at each application because
// the containers register theirs after boot; anything else is left to Ev,
// which raises the unresolved atom as before. The definitions themselves are
// fixed after load (DEF bumps DEFSVER, and compiled forms follow it).
function subName(s) {
  if (DEFS.has(s)) {
    const fp = NOTWIN.has(s) ? undefined : FASTPRIMS.get(s);
    if (fp !== undefined) return stampedName(s, fp);
    let body = null;
    const run = stampedName(s, (x) => { if (body === null) body = sub(DEFS.get(s)); return body(x); });
    if (!memoable(s)) return run;
    return (x) => memoCall(s, x, run);
  }
  if (PRIMS.has(s)) {
    if (SAMPLE) return (x) => { const p = PRIMS.get(s); senter(s); try { return p(x); } finally { sexit(); } }; // @instrument
    return (x) => PRIMS.get(s)(x);
  }
  return (x) => Ev(s, x);
}
// the sample stamps a primitive form by its head; the profiler never entered
// one, so under it a form is applied bare -- both as the interpreter did
function stamped(head, g) {
  if (SAMPLE) return (x) => { senter(head); try { return g(x); } finally { sexit(); } }; // @instrument
  return g;
}
// CONS and CONST were reached by name (Ev(head, [f, x]) into the twin), which
// entered the profiler as that name and the stamp as that name: kept
function stampedName(name, g) {
  if (SAMPLE) return (x) => { senter(name); try { return g(x); } finally { sexit(); } }; // @instrument
  if (STACKS) return (x) => { profEnter(name); try { return g(x); } catch (e) { profThrow(e); } finally { profExit(); } }; // @instrument
  return g;
}
function compileForm(f) {
  const form = seq(f);
  const head = form[0];
  // tau clause (c): a head that is not an atom is fetched (a computed form)
  if (typeof head !== "string") return (x) => Ev(head, [f, x]);
  // a head canon defines is fetched too; CONS and CONST are canon's, and when
  // their twins stand (not NOTWIN) their value is built here directly: CONS is
  // <f1:y .. fn:y> (the twin: seq the form, apply each part), CONST is the
  // form's second element (COMP(2, 1): selector 2 of the form, which raises
  // on a form without one exactly as the selector did)
  if (DEFS.has(head)) {
    const fp = NOTWIN.has(head) ? undefined : FASTPRIMS.get(head);
    if (fp !== undefined && head === "CONS") {
      const parts = [];
      for (let i = 1; i < form.length; i++) parts.push(sub(form[i]));
      const n = parts.length;
      return stampedName("CONS", (y) => { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = parts[i](y); return out; });
    }
    if (fp !== undefined && head === "CONST") {
      if (form.length < 2) return stampedName("CONST", () => { throw new Error("selector 2 out of range " + form.length); });
      const v = form[1];
      return stampedName("CONST", () => v);
    }
    return (x) => Ev(head, [f, x]);
  }
  switch (head) {
    case "COMP": {
      const parts = [];
      for (let i = 1; i < form.length; i++) parts.push(sub(form[i]));
      const n = parts.length;
      const chain = (x) => { let v = x; for (let i = n - 1; i >= 0; i--) v = parts[i](v); return v; };
      // the written strategy only pays to replace once the scan is long
      // enough for the index build to be worth it
      const jp = (form.length === 4 || form.length === 5) ? joinPat(form) : null;
      if (jp === null) return stamped("COMP", chain);
      const je = sub(jp.elem), jb = sub(jp.body), jc = sub(jp.carrier);
      const last = form.length === 5 ? parts[3] : null;
      return stamped("COMP", (x) => {
        const jx = last === null ? x : last(x);
        if (Array.isArray(jx) && jx.length === 2
            && Array.isArray(jx[jp.distl ? 1 : 0]) && jx[jp.distl ? 1 : 0].length > 32) {
          // distl delivers <carrier, list>, distr delivers <list, carrier>
          const list = jp.distl ? jx[1] : jx[0], carrier = jp.distl ? jx[0] : jx[1];
          let idx = JOINIDX.get(list);
          if (idx === undefined) { idx = new Map(); JOINIDX.set(list, idx); }
          let byKey = idx.get(jp.elem);
          if (byKey === undefined) {
            byKey = new Map();
            for (let i = 0; i < list.length; i++) {
              const k = JSON.stringify(je(jp.distl ? [carrier, list[i]] : [list[i], carrier]));
              let a = byKey.get(k); if (a === undefined) { a = []; byKey.set(k, a); }
              a.push(list[i]);
            }
            idx.set(jp.elem, byKey);
          }
          const want = JSON.stringify(jc(jp.distl ? [carrier, []] : [[], carrier]));
          const hits = byKey.get(want);
          if (hits === undefined) return [];
          const out = [];
          for (let i = 0; i < hits.length; i++) {
            const vs = seq(jb(jp.distl ? [carrier, hits[i]] : [hits[i], carrier]));
            for (let j = 0; j < vs.length; j++) out.push(vs[j]);
          }
          return out;
        }
        return chain(x);
      });
    }
    case "COND": {
      const p = sub(form[1]), a = sub(form[2]), b = sub(form[3]);
      return stamped("COND", (x) => p(x) === "T" ? a(x) : b(x));
    }
    case "ALPHA": {
      const g = sub(form[1]);
      return stamped("ALPHA", (x) => seq(x).map(e => g(e)));
    }
    case "INSERT": {
      const g = sub(form[1]);
      // small folds keep the written strategy: the fast path only pays off
      // once the accumulator is long enough for the copying to bite.
      const pat = filterFold(form[1]);
      const pp = pat === null ? null : sub(pat.pred);
      const pv = pat === null || pat.val === null ? null : sub(pat.val);
      return stamped("INSERT", (x) => {
        const xs = seq(x);
        if (xs.length === 0) throw new Error("INSERT on empty");
        const base = xs[xs.length - 1];
        if (pat !== null && xs.length > 32 && Array.isArray(base)) {
          const out = [];
          for (let i = 0; i < xs.length - 1; i++) {
            // the accumulator slot is null: framePure proved it unreachable,
            // so a stray read fails loudly instead of reading stale data.
            const frame = [xs[i], null];
            if (pp(frame) === "T") out.push(pv === null ? xs[i] : pv(frame));
          }
          for (let i = 0; i < base.length; i++) out.push(base[i]);
          return out;
        }
        let acc = base;
        for (let i = xs.length - 2; i >= 0; i--) acc = g([xs[i], acc]);
        return acc;
      });
    }
    case "WHILE": {
      const p = sub(form[1]), b = sub(form[2]);
      return stamped("WHILE", (x) => { let v = x; while (p(v) === "T") v = b(v); return v; });
    }
  }
  return () => { throw new Error("unknown form: " + head); };
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
  if (PROFILE) profReport("main"); // @instrument
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
  // DEFS is exported so a throw can be bisected from outside: the canon
  // stack names the DEFs a throw passed through and nothing finer (the
  // forms inside a DEF are anonymous), so finding WHICH selector met an
  // empty list means re-evaluating the DEF's form piece by piece on the
  // same input, which needs the form.
  // loadStoreDb rides here for the same reason and only here: run_test is the
  // test module's own boot, so a release composition (cli, serve, mcp, ui, sql)
  // exposes no loader. The host's unit test calls it on three databases it
  // writes itself rather than on whatever store.db happens to be on disk --
  // an absent artifact would make an artifact-shaped test pass saying nothing.
  // popSnapshot and emitToDb ride here for the same reason, and as the PAIR the
  // three real callers compose (the serve POST, ui:navpe and the MCP call), so
  // the durability test runs the same three lines they do rather than a wrapper
  // that could drift from them: snapshot, evaluate, emit what changed.
  globalThis.AREST = { Ev: Ev, CELLS: CELLS, DEFS: DEFS, composition: COMPOSITION,
    loadStoreDb: loadStoreDb, popSnapshot: popSnapshot, adoptStore: adoptStore, emitToDb: emitToDb,
    performDeclared: performDeclared };
}
// AND run_test CLOSES HERE, WHICH IS THE WHOLE BUG (2026-09-12). The performer
// was declared INSIDE run_test, so only the test entry point could see it: the
// servers reached the call site and threw ReferenceError, and the form path had
// the same latent fault and had simply never been driven. In-process tests
// passed throughout because importing cases.g.js RUNS run_test, which publishes
// performDeclared on globalThis.AREST -- so the one harness that could see it
// was the one that could not tell me it was unreachable from anywhere else.
// Function declarations hoist, so the line above still binds it.

// THE PERFORMER, and it chooses NOTHING. Canon says what the call is --
// perform:call_for the method and the address, perform:headers_of the headers
// the backing External System declares with their values, perform:auth_header_of
// which of them carries the credential, perform:body_of the JSON paths joined
// from the entity's own facts -- and this makes it. No method, no path, no
// header name and no field is decided here. If the model does not say it, it
// does not go on the wire. That is the whole reason the last four commits were
// metamodel and canon rather than a fetch with a hardcoded URL.
//
// A HOLE IS A REFUSAL, NOT A BLANK. main:performed answers <predicate, entity,
// may-create>; if a declared JSON Path has no fact to fill it for that entity,
// the call is NOT made. A send whose `to` is empty is a bug, and posting it to
// find out is the expensive way to learn that. This is the enforcement half of
// the law that is owed on perform:body_of.
//
// THE CEILING IS NOT ADVISORY. may-create is the set of Event Types the model
// says this Predicate can create. The response is handed back with that set,
// and a caller that asserts outside it is asserting something the model never
// permitted -- which is a hole in Thm 1, not a convenience. This function does
// not assert at all: it answers what was sent and what came back, and the
// ceiling it came with, so the assertion happens where the store is written and
// can be refused there.
async function performDeclared(before, after, opts) {
  const o = opts || {};
  const send = o.send || ((m, a, h, b) => fetch(a, { method: m, headers: h, body: JSON.stringify(b) })
    .then((r) => r.text().then((t) => ({ status: r.status, text: t }))));
  const done = [];
  let rows;
  try { rows = Ev("main:performed", [before, after]); } catch (e) { return done; }
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const predicate = String(row[0]);
    const entity = String(row[1]);
    const ceiling = (Array.isArray(row[2]) ? row[2] : []).map(String);
    // WHETHER THIS CALL GOES OUT IS READ FROM ITS OWN CONNECTION. Absent means
    // the connection is not performed at all, which is the safe default and needs
    // no row; 'dry' resolves the whole call and records what it WOULD send.
    const modeRaw = Ev("perform:send_mode_of", [predicate, after]);
    const mode = Array.isArray(modeRaw) ? "" : String(modeRaw);
    if (!mode) { done.push({ predicate, entity, refused: "this connection declares no Send Mode, so it is not performed" }); continue; }
    const call = Ev("perform:call_for", [predicate, after]);
    const method = Array.isArray(call[0]) ? "" : String(call[0]);
    const address = Array.isArray(call[1]) ? "" : String(call[1]);
    if (!method || !address) { done.push({ predicate, entity, refused: "the model does not fully address this call" }); continue; }
    const headers = {};
    for (const h of Ev("perform:headers_of", [predicate, after])) headers[String(h[0])] = String(h[1]);
    // THE CREDENTIAL COMES FROM THE CONNECTION, DECRYPTED HERE AND NOWHERE ELSE.
    // perform:secret_of answers the ciphertext exactly as stored -- canon never
    // sees the plaintext -- and hook:read applies whatever Function the Object
    // Type is stored through in reverse, given the master key the boundary holds.
    // An unmarked type passes through unchanged, so a store that keeps its
    // credential in the clear still works and simply declares no marking.
    const auth = Ev("perform:auth_header_of", [predicate, after]);
    let secret = "";
    if (!Array.isArray(auth)) {
      const cipher = Ev("perform:secret_of", [predicate, after]);
      if (!Array.isArray(cipher)) {
        const plain = Ev("hook:read", [String(o.master || ""), "Secret Reference", String(cipher), after]);
        secret = Array.isArray(plain) ? "" : String(plain);
      }
    }
    if (!Array.isArray(auth) && secret) headers[String(auth)] = (headers[String(auth)] || "") + (headers[String(auth)] ? " " : "") + secret;
    const body = {};
    let hole = null;
    for (const b of Ev("perform:body_of", [predicate, entity, after])) {
      if (Array.isArray(b[1])) { hole = String(b[0]); break; }
      body[String(b[0])] = String(b[1]);
    }
    if (hole) { done.push({ predicate, entity, refused: "declared path '" + hole + "' has no fact to fill it" }); continue; }
    // A DRY STUB MUST LOOK LIKE THE REAL ANSWER OR IT PROVES HALF THE LOOP. The
    // first version answered plain text, which is not JSON, so the response
    // projection found nothing and reported no asserts -- and "no asserts" would
    // have read as `the model yields nothing here` when it actually meant `my own
    // stub said nothing`. Absence caused by the harness is not evidence. The id is
    // visibly fake so a dry assert can never be mistaken for a real receipt.
    const answer = mode === "live" || o.send
      ? await send(method, address, headers, body)
      : { status: 0, text: JSON.stringify({ id: "dry-run-not-sent" }) };
    // WHAT THE ANSWER PRODUCES IS DECLARED, AND THE CEILING STILL DECIDES.
    // perform:yields_of gives the <JSON Path, Fact Type, Role> triples this
    // Function's response fills and perform:subject_of says WHO they are about
    // -- the entity, or the one declared functional step from it, which on
    // support is the Support Response's Email Message rather than the response
    // that fired the transition. A triple whose Fact Type is outside the
    // may-create ceiling is REFUSED here and reported, never quietly written:
    // the ceiling is the Thm 1 boundary, and a performer that asserted past it
    // would be a hole in it.
    //
    // STILL NOTHING IS WRITTEN. These are ANSWERED, so the write happens where
    // the store is written and can refuse, and so the first exercise of a new
    // write-back is a dry run that SHOWS the facts rather than a commit that
    // explains them afterwards.
    const asserts = [];
    const outside = [];
    let parsed = null;
    try { parsed = JSON.parse(String(answer && answer.text)); } catch (e) { parsed = null; }
    if (parsed && typeof parsed === "object") {
      const subject = Ev("perform:subject_of", [predicate, entity, after]);
      const subj = Array.isArray(subject) ? entity : String(subject);
      for (const t of Ev("perform:yields_of", [predicate, after])) {
        const path = String(t[0]), ft = String(t[1]);
        if (!(path in parsed)) continue;            // the service did not return it
        const row = [ft, subj, String(parsed[path])];
        (ceiling.indexOf(ft) >= 0 ? asserts : outside).push(row);
      }
    }
    done.push({ predicate, entity, method, address, sent: body, ceiling, answer, asserts, outside });
  }
  return done;
}

// AND BOTH WRITE PATHS MUST ASK THE SAME WAY. This was wired into the form path
// only, so the JSON API -- the path an app is actually driven through -- could
// commit a fired transition and perform nothing, with no line either way. Four
// configurations were run against it before the absence was traced to the code
// not being there, which is the cost of a trigger that reports nothing when it
// is not reached. THE PERFORMER STAYS OFF UNLESS ASKED: a write that fires a
// declared transition can make an outbound call, and that must never become
// something a server starts doing because someone deployed it. What ASKS is now
// a fact -- `DomainConnectsToExternalSystem has Send Mode`, read per predicate
// inside performDeclared, absent meaning not performed at all -- and no longer
// AREST_PERFORM, which this comment described until 2026-09-14 and which would
// have gone on describing it. Nothing is asserted back either way: the answer
// and its may-create ceiling are reported, and the assertion belongs where the
// store is written and can refuse.
function maybePerform(prior, after) {
  if (!prior || prior === after) return;
  // THE ARMING IS A FACT, NOT AN ENVIRONMENT KEY (2026-09-14). AREST_PERFORM and
  // AREST_PERFORM_SECRET are gone: `DomainConnectsToExternalSystem has Send Mode`
  // says whether a connection is live, and the connection carries its own
  // credential. The decision is PER PREDICATE and therefore per connection, so it
  // is made inside performDeclared against the store rather than once out here
  // against the process -- a store may connect to two systems and be permitted to
  // call one of them.
  //
  // THE MASTER KEY IS THE ONE THING THAT CANNOT BE A FACT, because it is what
  // decrypts the credential the store holds. It stays in the environment and is
  // passed in, which is the shape hook:read already had before it had a caller.
  performDeclared(prior, after, { master: process.env.AREST_MASTER_KEY })
    .then((r) => {
      for (const one of r) console.log("performed " + JSON.stringify(one));
      writeBack(r);
    })
    .catch((e) => console.log("performer failed: " + String(e)));
}

// AND THE ANSWER COMES BACK AS FACTS (2026-09-14). performDeclared computed
// `asserts` from the day it was written and nothing ever applied them, so the
// call went out, the id came back, and the store never heard: a Support Response
// stayed Approved forever and a restart could not have told you the mail had
// been sent. The ceiling is already enforced upstream -- performDeclared puts a
// yield INSIDE the declared ceiling in `asserts` and anything else in `outside`,
// so what arrives here is exactly what the model permitted this call to write.
//
// It goes through main:api like every other write rather than splicing rows in:
// the yielded fact meets the same alethic check as a POST, and a refusal is
// reported instead of being pushed past. emitToDb then persists it, which is
// what makes the id survive a restart -- the store.db is the durable copy, and
// adoptStore keeps CELLS' array identity so the next read sees it.
function writeBack(done) {
  for (const one of done) {
    for (const a of one.asserts || []) {
      if (!Array.isArray(a) || a.length < 2) continue;
      const ft = String(a[0]);
      const args = a.slice(1).map(String);
      const before = popSnapshot(CELLS);
      let out;
      try { out = Ev("main:api", [CELLS, "POST", ft, "", args]); }
      catch (e) { console.log("write-back threw on " + ft + ": " + String(e)); continue; }
      if (out.length > 2 && Number(out[1]) < 400) {
        adoptStore(out[2]);
        emitToDb(before, CELLS);
        console.log("wrote back " + JSON.stringify([ft].concat(args)));
      } else {
        console.log("write-back REFUSED " + ft + ": " + String(out[0]).slice(0, 200));
      }
    }
  }
}

// A create ANSWERS a store. main:api returns <body, status, D-prime> for a
// transition and <body, status> for a read, because following a nav link makes
// no new store. Adopting it is transport's business -- D is what this file
// holds -- but WHAT the new store contains is canon's: main:create_closed put
// the fact where the derive path reads and closed the store under its rules.
// Mutated in place so the array identity survives, then the memo is dropped:
// Ev keys on the store REFERENCE, so a store whose contents changed under the
// same reference would keep answering from the old one.
// set once the boot's own loading is done; see adoptStore
let BOOTED = false;

function adoptStore(next) {
  if (!Array.isArray(next) || next.length === 0) return false;
  // next may BE CELLS -- canon answers the same array when a step changes nothing,
  // and clearing in place would empty the thing we are about to copy from
  if (next === CELLS) return true;
  const copy = next.slice();
  CELLS.length = 0;
  for (const c of copy) CELLS.push(c);
  memoClear();
  // AND A STORE THAT CHANGED IS REFLECTED AGAIN (2026-09-17). A reflected
  // population is a function of the store, so the store moving is exactly when
  // it has to be recomputed: a Support Request created in a running server had
  // no machine and no status until the next boot, so `actions` offered its
  // Received menu -- computed per call -- while the worklist query could not
  // see it at all, which is the same silence in a smaller window. The CLOSURE
  // is deliberately NOT re-run here: it is seconds, loadDerived's own comment
  // says it belongs at load, and no rule head is what a session asks after a
  // write. This is 120 ms on support.auto.dev against a write that costs two
  // seconds. Not during boot, where the store is half-loaded and the reflection
  // would read a seed that is not there yet; closeStore does it there.
  if (BOOTED) loadReflected();
  return true;
}

// JSON READ INTO THE MU, AND THAT IS ALL IT DECIDES. The mu has two things, an
// atom and a sequence; JSON has four, and the reading between them belongs at
// the transport where the bytes arrive. An array is a sequence, a number stays
// a number (the mu has N(i) and A(x), and a recipe's projection positions are
// numbers), anything scalar is an atom -- and an OBJECT is the sequence of its
// <name, value> pairs, which is the one case that was missing. A JS object is
// neither of the mu's two things, so canon raised `expected sequence, got atom`
// on the first selector that touched one: POST of a JSON object to a collection
// answered 500 from inside main:api before any routing happened (2026-09-16).
// What a pair list MEANS is canon's (main:row reads the entry screen's own
// convention off the names); this only says what a JSON object IS.
function fromJson(x) {
  if (Array.isArray(x)) return x.map(fromJson);
  if (x !== null && typeof x === "object") return Object.keys(x).map((k) => [k, fromJson(x[k])]);
  return typeof x === "number" ? x : String(x);
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
      const fact = fromJson(await req.json().catch(() => []));
      const before = req.method === "GET" ? null : popSnapshot(CELLS);
      // adoptStore mutates CELLS IN PLACE so the array identity survives, which
      // means the pre-write store has to be copied out before the write or it is
      // gone by the time anything can compare against it. A fresh array is also
      // what makes main:performed evaluate: Ev memoises on the store REFERENCE.
      const prior = req.method === "GET" ? null : CELLS.slice();
      const out = Ev("main:api", [CELLS, req.method, resource, caller, fact]);
      if (out.length > 2) {
        adoptStore(out[2]);
        if (before && Number(out[1]) < 400) emitToDb(before, CELLS);   // a refusal made no successor
        if (prior && Number(out[1]) < 400) maybePerform(prior, CELLS);
      }
      return new Response(String(out[0]), {
        status: Number(out[1]) || 500,
        headers: { "content-type": "application/json" },
      });
    },
  });

  console.error("arest serving on :" + PORT);

}
// PAIRING TOTALITY, ASKED OF THIS CONTAINER (#108, 2026-09-15). register(
// control, impl) IS the pairing -- iFactr's IPairable, whose abstract half is
// complete without the native half -- so a container's registration loop IS
// its set of pairs, and law:paired asks the one question no store can answer
// about itself: does every abstract control kind the store declares registered
// HAVE a registration HERE? An unpaired kind is a screen that dies mid-render
// on the first row that names it, so this refuses before the first byte and
// law:unpaired names what is missing. The java container (Gui.java:439) has
// asked since the law took the operand; these two register controls and never
// did, so the only container the test suite runs was the unchecked one.
//
// ONLY THE PAIRING HALF IS FATAL, for the reason Gui.java records: over a
// container's store law:origins_match is the STORE's half, gated by law:report,
// and refusing a screen over a store defect trades a working container for a
// check that belongs elsewhere. Both halves are printed because they are
// measured apart.
//
// THE TEXT CONTAINER PRINTS ONLY ON REFUSAL. Its stdout is a screen read back
// into a conversation by a SessionStart hook, so an unconditional verdict line
// would be noise on every boot; the HTML container already announces its port
// on stderr and the line rides with it.
function pairing_gate(store, verbose) {
  const registered = [...PRIMS.keys()];
  const pair = [store, registered];
  const paired = String(Ev("law:paired", pair));
  if (verbose || paired !== "T") {
    const kinds = Ev("law:ctl_declared", store);
    console.error("law:origin_boundary over <store, " + registered.length
      + " registered>: " + Ev("law:origin_boundary", pair)
      + "  (store halves " + Ev("law:origins_match", store)
      + ", pairing " + paired + " over " + kinds.length + " declared control kinds)");
  }
  if (paired !== "T") {
    for (const m of Ev("law:unpaired", pair)) console.error("  unpaired control kind: " + m);
    process.exit(2);
  }
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
  // AND THE VERBS BESIDE THEM (Sam, 2026-09-10: the shape of the tools). A
  // fact-type tool is the NOUN half -- main:api addresses a resource and a
  // method -- and the verb half was reachable only from the CLI. mcp:verbs
  // answers <name, accepts, yields> for the catalogued Operations the model
  // describes AND the store can run, so a verb joins this list by declaring
  // its shape in the readings. The two surfaces stand together while apply
  // and retract are undeclared: support asserts facts through the fact-type
  // tools today, and taking that door away before its replacement answers
  // would break the running app.
  const VERBS = Ev("mcp:verbs", CELLS);
  const VERB_NAMES = new Set(VERBS.map((v) => String(v[0])));
  // AND THE COLLECTIONS BESIDE BOTH (Sam, 2026-09-11: an entity is like a
  // complex sentence, where the atomic fact is like a simple sentence). The
  // resource surface has taken an entity whole since 09-07 and the MCP had no
  // way to address one, so an entity with three mandatory roles -- a Support
  // Request -- was unwritable here however many single-fact calls you made.
  // mcp:entities answers <tool name, table name, fields> where fields is
  // ui:formfields, the same columns the screen's form shows, so the parameters
  // are the model's and not a shape invented at this boundary.
  const ENTITIES = Ev("mcp:entities", CELLS);
  const ENTITY_OF = new Map(ENTITIES.map((e) => [String(e[0]), e]));
  // the admitted methods are canon's too -- http:method_kinds, not a constant
  const METHODS = Ev("http:method_kinds", []).map((m) => String(m[0]));

  // SOME OPERATIONS ARE JUDGEMENTS, AND AN LLM IS ALREADY ATTACHED (Samuel,
  // 2026-09-17: "what the MCP needs is a way of asking you to do something").
  // resolution.md derives `Operation awaits a driver` for the seams no host has
  // filled and says in as many words that they "have to be driven manually by an
  // llm or a person at those points". Every caller of this server IS an llm, and
  // MCP has the request for exactly this: sampling/createMessage, which a SERVER
  // sends to the CLIENT. The client declares `sampling` in the capabilities it
  // sends at initialize, and this file discarded that object entirely until now.
  //
  // NOTHING BECOMES ASYNC INSIDE THE EVALUATOR. Ev stays synchronous: canon
  // composes the question before the ask (drive:request) and reads the answer
  // after it (drive), and the await sits between them out here, where the
  // transport already lives.
  //
  // THE TWO DIRECTIONS MUST NOT SHARE AN ID SPACE. A client numbers its requests
  // from 1 and so would we; ours carry a string id, which JSON-RPC admits and no
  // client generates, so a reply is unambiguously to a question this server asked.
  let SAMPLING = false;                   // does this connection's client offer it
  let AGENT = "agent-unnamed";             // the Agent this connection is, named at initialize
  const ASKED = new Map();                // our request id -> the promise waiting on it
  let askSeq = 0;
  function askClient(method, params) {
    const id = "arest-ask-" + (++askSeq);
    return new Promise((resolve, reject) => {
      ASKED.set(id, { resolve, reject });
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  // a reply to one of ours, or not ours at all; a notification carries no id
  function answeredOurs(msg) {
    if (msg.method !== undefined || msg.id === undefined) return false;
    const p = ASKED.get(msg.id);
    if (!p) return false;
    ASKED.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else p.resolve(msg.result);
    return true;
  }

  // A VERB WHOSE OPERAND IS A COMPLETION IS A VERB THAT NEEDS ONE FETCHED, and
  // the MODEL says which those are: the accepts row in the resolution catalog,
  // read here off mcp:verbs like every other verb's shape. No name in this file.
  const SAMPLED = new Set(VERBS.filter((v) => String(v[1]) === "completion-and-cells").map((v) => String(v[0])));

  // AND THE SEAM ITSELF IS A VERB, under the name the model gives it. mcp:verb_row
  // blanks the accepts of any verb solve:cell cannot find and mcp:verb_keep drops
  // it, so `csdp:elementarize` -- registrable, with accepts and yields rows of its
  // own and deliberately no canon cell, because it is filled by a driver -- had no
  // door on this surface at all: the only way to reach it was the generic `drive`
  // with its name passed as a string, which is not the operation being called.
  // drive:tools answers <tool name, operation, accepts, yields> for exactly the
  // seams this driver answers, so the names are canon's (drive:driven) and none is
  // written here. The tool name is SLUG of the operation and the operation rides
  // beside it, the same two columns mcp:entity_row carries for the same reason: an
  // MCP name admits no colon any more than it admits a space, and `csdp:elementarize`
  // would be the first tool name in this surface with one. It is read ONCE, at load,
  // before any registration: drive:driven is derived from `Operation awaits a
  // driver`, which stops holding a seam the moment this host registers it. A store
  // that cannot say what awaits a driver offers none.
  let DRIVEN = [];
  try { DRIVEN = Ev("drive:tools", CELLS); } catch (e) { DRIVEN = []; }
  const DRIVEN_OF = new Map(DRIVEN.map((d) => [String(d[0]), String(d[1])]));

  function entityFields(e) {
    return Array.isArray(e[2]) ? e[2].map((f) => String(f[0])) : [];
  }

  function entityTools() {
    return ENTITIES.map((e) => {
      const table = String(e[1]);
      const props = {
        method: { type: "string", enum: METHODS,
                  description: "GET reads the table's rows; POST creates one of these with its facts, whole" },
        caller: { type: "string", description: "who is calling; gates which controls are shown" },
        id: { type: "string", description: "the " + table + " this is about" },
      };
      // one parameter per column, named by the fact type and described by the
      // role it fills -- a caller may send any subset, and the mandatory ones
      // it leaves out are what the refusal will name back to it
      for (const f of (Array.isArray(e[2]) ? e[2] : [])) {
        props[String(f[0])] = { type: "string", description: String(f[1]) };
      }
      return {
        name: String(e[0]),
        description: table + " -- the whole entity in one command, validated once",
        inputSchema: { type: "object", properties: props, required: ["method"] },
      };
    });
  }

  function verbTools() {
    return VERBS.map((v) => ({
      name: String(v[0]),
      description: "takes the " + String(v[1]) + ", answers the " + String(v[2]),
      inputSchema: {
        type: "object",
        properties: {
          args: { type: "array", description: "the verb's arguments, in order; a verb that takes the store takes none" },
        },
      },
    }));
  }

  // A HOST OFFERS WHAT IT CAN FILL, AND IT CAN ALWAYS FILL THIS ONE -- WITH THE
  // CALLER. The tool for a driven seam appeared exactly when the client offered
  // `sampling`, which was right while asking was the only way to get an answer,
  // and it made the seam UNREACHABLE FROM THE CLIENT THAT USES IT.
  // Measured 2026-09-18 against support.auto.dev's store, changing one thing
  // only: a client advertising nothing got 1402 tools with csdp_elementarize
  // ABSENT, a client advertising sampling got 1403 with it OFFERED. Claude Code
  // advertises no sampling (20 tools at the router, no seam tool among them,
  // measured independently in a live session the same day), so the one audience
  // this exists for could not call it.
  //
  // SAMPLING EXISTS SO A SERVER CAN ASK A MODEL A QUESTION, AND HERE THE CALLER
  // IS THE MODEL. So the judgement does not have to be FETCHED; it can be
  // PASSED, as an ordinary second argument to the same tool. The answer lands on
  // the same path either way (drive, below), so the only difference is who
  // initiates -- and a door that needs no capability is a door every client has.
  // The sampling round trip is kept and still preferred where it exists: a
  // client that can be asked is asked, because a server-initiated ask is the
  // better shape when it is possible.
  //
  // ONE TOOL, ONE PARAMETER, AN OPTIONAL SECOND ELEMENT IN THE ARRAY IT ALREADY
  // TAKES. A named `answer` property would also have worked -- the router's
  // isVerb test is `args and no method`, which an extra property does not
  // disturb -- but it would make these the only verb tools on this surface with
  // a shape of their own, and a client holding a cached tools/list would be
  // calling a schema that had changed. The array is unconstrained (no `items`),
  // so a second element is admitted by the schema that is already published:
  // nothing in the served shape moves, and the router forwards it untouched.
  function drivenTools() {
    return DRIVEN.map((d) => ({
      name: String(d[0]),
      description: String(d[1]) + " -- takes the " + String(d[2]) + ", answers the " + String(d[3])
        + " -- a judgement, not a computation: this store declares it registrable and no host computes it,"
        + " so the answer is YOURS and what you answer lands as rows with the completion that produced them."
        + " Call it with the subject alone to be handed the store's question; call it again with your answer"
        + " beside the subject to have that answer written.",
      inputSchema: {
        type: "object",
        properties: {
          args: { type: "array", description: "one or two arguments. [subject] -- the id whose facts are the familiar"
                  + " example -- answers the store's question and writes nothing. [subject, answer] writes the answer,"
                  + " where answer is the JSON array the question asks for: [{\"factType\": \"...\", \"players\": [\"...\"]}]" },
        },
      },
    }));
  }

  function tools() {
    return verbTools().concat(drivenTools()).concat(entityTools()).concat(TOOLS.map((t) => {
      // THE DESCRIPTION IS THE READING (Sam, 2026-09-10). It used to be
      // "fact type " + the id + the player list, on a comment claiming the
      // reading and the signature were the same row; `Message, Plan` is not
      // `Message recommends Plan`, and the reading is what the paper's
      // verbalization answers. mcp:tools carries it now as the row's third
      // element, rendered in canon from state:readings. The NAME stays the id
      // because MCP names admit no spaces and the id is what main:api
      // addresses.
      const players = Array.isArray(t[1]) ? t[1].map(String) : [];
      const reading = t[2] === undefined ? "" : String(t[2]);
      return {
        name: String(t[0]),
        description:
          (reading || String(t[0])) +
          (players.length ? " -- roles played by " + players.join(", ") : ""),
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
    }));
  }

  function call(name, args) {
    const a = args || {};
    // A VERB IS THE OTHER HALF OF THE SURFACE, and it is dispatched by the
    // same canon that dispatches the CLI: main looks the name up in the store
    // (the paper's SYSTEM:x) and main:verb_pair builds the operand the model
    // says the verb takes. The answer is <text, T|F>, a claim rather than a
    // status, so a false answer is an error to the client and nothing is
    // written: no verb here mutates.
    if (VERB_NAMES.has(String(name))) {
      // A JSON ARGUMENT KEEPS ITS SHAPE (2026-09-11). This read `a.args.map(String)`,
      // which stringifies a nested array into one comma-joined atom: `create`'s
      // command -- a list of <fact type, rows> pairs, the shape law:apply has
      // always exercised -- arrived as the atom `ErrorCodeHasHTTPStatus,PROBE_CODE,
      // 429,...` and the verb answered `expected sequence, got atom`. The address
      // route's arguments ARE atoms, because an address is words; the MCP's are
      // JSON, and forcing them through the address shape is what made a verb taking
      // anything structured unreachable here. Mapping String over the LEAVES only
      // leaves a flat argument list of strings byte-identical -- every call that
      // worked before still produces exactly what it did -- and lets a nested one
      // through. A JSON NUMBER STAYS A NUMBER for the same reason the shape is
      // kept: the mu has both, N(i) and A(x), and a recipe's projection positions
      // are numbers. Stringifying them answered `unresolved atom: 1` and made
      // `query` -- declared, served, and taking recipe-and-populations -- as
      // unreachable as the structure did.
      // AND AN OBJECT ARGUMENT KEEPS ITS SHAPE TOO (2026-09-16), which is what
      // lets a verb take an entity WHOLE: `create` takes one argument, the row,
      // and a row is a JSON object naming its fact types. fromJson is the same
      // reading the serving tail gives a request body, so the tool call and the
      // POST carry byte-identical JSON.
      const rest = Array.isArray(a.args) ? a.args.map(fromJson) : [];
      // A VERB THAT WRITES ANSWERS THE STORE IT MADE, and adopting it is the
      // same pair the resource branch below composes -- snapshot, evaluate,
      // emit what changed. A read verb answers two parts and none of this runs;
      // canon decides which is which (main:verb_answer reads the accepts row),
      // not the name and not this file. The snapshot is taken AFTER the
      // evaluation on purpose: canon is pure, so CELLS is still the store the
      // verb was handed until adoptStore replaces it, and a read then pays
      // nothing for a snapshot it would never use.
      const out = Ev("main", [CELLS, [String(name)].concat(rest)]);
      const held = String(out[1]) === "T";
      if (out.length > 2) {
        const was = popSnapshot(CELLS);
        adoptStore(out[2]);
        if (held) emitToDb(was, CELLS);
      }
      return [out[0], held ? 200 : 500];
    }
    const method = String(a.method || METHODS[0]);
    const before = method === "GET" ? null : popSnapshot(CELLS);
    // AN ENTITY TOOL IS THE SAME ROUTE WITH THE COLLECTION'S BODY. The address
    // main:api takes for a word in ui:groups is <id, fact type, value, fact
    // type, value...> -- ui:create0's own, the one the screen's submit carries
    // -- so the only work here is reading the named parameters back into that
    // order. Canon decides the order (ui:formfields), canon decides the
    // resource (the row's second element, the table's real name with its
    // spaces), and a field the caller omitted is simply absent: the mandatory
    // ones it left out come back as the refusal's violations rather than as an
    // empty value the store would have to hold.
    const ent = ENTITY_OF.get(String(name));
    let resource = String(name);
    let fact = Array.isArray(a.fact) ? a.fact : [];
    if (ent) {
      resource = String(ent[1]);
      fact = a.id === undefined ? [] : [String(a.id)];
      for (const ft of entityFields(ent)) {
        if (a[ft] !== undefined) fact.push(ft, String(a[ft]));
      }
    }
    // no dispatch: the resource IS the fact type and the method IS the operation
    const out = Ev("mcp:call", [
      method,
      resource,
      String(a.caller || ""),
      fact,
      CELLS,
    ]);
    // a POST answers a third part, the store it made; adopting it is what
    // makes a tool call persist. It is not part of the reply.
    if (out.length > 2) {
      adoptStore(out[2]);
      // A REFUSED WRITE IS NOT EMITTED. A refusal (status 4xx, canon's decision)
      // made no successor, so the tables stay as they were; the journal that
      // once recorded refusals replayed 22 of them at boot for six minutes and
      // left the store as it was (engineering.auto.dev, 2026-09-04).
      if (before && Number(out[1]) < 400) emitToDb(before, CELLS);
      return [out[0], out[1]];
    }
    return out;
  }

  // THREE STEPS OVER MACHINERY THAT EXISTS: read what awaits, ask the client for
  // it, write the answer back as facts -- and then the store evaluates, because
  // the rows went in through the same POST every fact-type tool takes and were
  // held to the same constraints. The store already knows what it is missing:
  // `Operation awaits a driver` and `Constraint awaits a decider` are derived
  // populations, so the request list is data sitting there, not a list here.
  //
  // RECORDING IS THE HALF THAT MATTERS. A judgement a model made and nobody wrote
  // down cannot be disputed, audited or re-derived; three claim extractions
  // happened on support.auto.dev on 2026-09-17 and not one of them is a fact
  // anywhere. So the completion lands as facts beside what it decided, and WHICH
  // provenance fact types land is the store's business (drive:keep), because the
  // vocabulary is spread across three apps' readings and no closure has all of it.
  //
  // AND THE ANSWER MAY ARRIVE EITHER WAY (2026-09-18). `drive` is a pure
  // function of the row it is handed: measured against support's store with a
  // row nothing sampled -- operation, subject, at, model, definition, agent,
  // completion, claim, prompt, input, output, facts, all supplied -- it answered
  // the same twelve <fact type, fact> pairs it answers after a sampling round
  // trip, ten provenance and two claims. So the CANON END ALREADY EXISTED: the
  // seam's own note, "drive already accepts completion-and-cells, so only the
  // door is missing", is the same diagnosis that was right about the seam
  // itself, and everything below this line is host. The three ways in are one
  // code path: an answer PASSED as the second argument, an answer FETCHED by
  // sampling, or -- when neither -- the store's QUESTION handed back so the
  // caller can answer it on the next call.
  let completions = 0;
  async function drive(args) {
    const a = args || {};
    const list = Array.isArray(a.args) ? a.args : [];
    const given = list.length ? list[0] : null;
    const row = (given && typeof given === "object" && !Array.isArray(given)) ? { ...given } : {};
    const operation = String(row.operation || "");
    const subject = String(row.subject || "");
    // THE SECOND ARGUMENT IS THE ANSWER, and it is admitted in either of the two
    // shapes an answer has ever had here: the JSON array of {factType, players}
    // the question asks for, or the raw text of a completion carrying one, which
    // is what a model that answered in prose around its array hands over.
    const passed = list.length > 1 ? list[1] : undefined;
    const answered = passed !== undefined && passed !== null && passed !== "";
    const awaiting = Ev("drive:awaiting", CELLS).map((r) => "  " + String(r[1]) + " -- " + String(r[0]));
    if (!operation || !subject) {
      return ["drive takes one object argument, {operation, subject}, and optionally the answer beside it."
        + " Awaiting a judgement in this store:\n" + awaiting.join("\n"), 400];
    }
    const input = String(Ev("drive:request", [fromJson(row), CELLS]));
    // the standing prompt is the Agent Definition's, the request is this call's
    // input Text: one is what the driver always is, the other is what it was
    // asked this time, and agents.md declares them as two different fact types
    const prompt = "You are the driver for '" + operation + "', an operation this AREST store declares registrable that no host has registered."
      + " Answer only with what the store can hold, and nothing else.";
    // NOBODY TO ASK IS NOT NOBODY TO TELL. This refused with 424 -- "there is
    // nobody to ask and nothing was written" -- and its premise was wrong: the
    // caller is a model, and it is right here. So the composed request goes back
    // to the caller instead of a refusal, and the caller answers it by calling
    // again with the answer beside the subject. Nothing is written on this call,
    // which is what the refusal got right, and the status is not an error
    // because nothing failed: this IS the question, delivered.
    //
    // AND DELIVERING IT IS WHAT MAKES `Completion has input Text` HONEST for a
    // passed answer. The sampled path records the request it composed, not what
    // the model was shown -- the client "may edit or refuse it, which is the
    // point" -- so both paths record the same thing, the question this store put
    // to its driver, and the passed path additionally handed that text over.
    if (!answered && !SAMPLING) {
      return ["this client offered no `sampling` capability at initialize, so nobody can be asked -- but you are a driver too."
        + " NOTHING WAS WRITTEN. Answer the question below by calling this again with your answer as the SECOND argument"
        + " beside '" + subject + "', and it lands as rows with the Completion that produced them."
        + "\n\n" + input, 200];
    }
    // SAMPLING STAYS PREFERRED WHERE IT IS AVAILABLE: a client that advertised it
    // is still asked, because a server-initiated ask is the better shape when it
    // is possible -- a human can see it, edit it or refuse it, and the client
    // names the model that ran it. The passed form is what makes the seam
    // reachable from a client that cannot be asked, so it is taken only when an
    // answer is actually in hand.
    let res = null, output = "";
    if (!answered) {
      // the request and the result are the protocol's own shapes; the client runs
      // the completion and a human may edit or refuse it, which is the point
      res = await askClient("sampling/createMessage", {
        messages: [{ role: "user", content: { type: "text", text: input } }],
        systemPrompt: prompt,
        includeContext: "none",
        maxTokens: 4096,
        modelPreferences: { hints: [{ name: "claude" }], intelligencePriority: 0.9, speedPriority: 0.3 },
      });
      output = res && res.content && res.content.type === "text" ? String(res.content.text) : "";
    } else {
      // A PASSED ANSWER IS THE COMPLETION'S OUTPUT, and the output Text recorded
      // is the answer as it arrived: a JSON array re-rendered, a text kept whole.
      // Nothing is invented -- this is what the driver said.
      output = typeof passed === "string" ? passed : JSON.stringify(passed);
    }
    // the bytes are read into the mu here, where every other body is read: an
    // array is a sequence and an object is its <name, value> pairs (fromJson),
    // so canon never parses text and Stage-1's boundary stays where it is
    let facts = [];
    if (answered && Array.isArray(passed)) facts = passed;
    else {
      const lb = output.indexOf("["), rb = output.lastIndexOf("]");
      if (lb >= 0 && rb > lb) { try { facts = JSON.parse(output.slice(lb, rb + 1)); } catch (e) { facts = []; } }
    }
    if (!Array.isArray(facts)) facts = [];
    const at = String(Ev("clock", []));
    const completion = "cmp-" + Ev("slug", at) + "-" + (++completions);
    row.operation = operation; row.subject = subject;
    row.at = at;
    // AND THE ONE THING A PASSED ANSWER CANNOT SAY IS WHICH MODEL SAID IT. The
    // sampled path learns it from the client's result; MCP gives a server no way
    // to learn it from a tool call, and a caller naming itself is a claim, not a
    // measurement. So it is `unknown` unless the caller put a `model` in the
    // operand -- which is the same atom the sampled path already writes when the
    // client returns no model -- and it is abstention, not a guess. The AGENT is
    // not affected and is in fact MORE certain here than under sampling: the
    // party that answered is the party that called, named at initialize, where a
    // sampling client may route the ask anywhere.
    row.model = res ? String(res.model || "unknown") : String(row.model || "unknown");
    row.definition = "agentdef-" + Ev("slug", operation);
    row.agent = AGENT;
    row.completion = completion;
    row.claim = "claim-" + completion;
    row.prompt = prompt;
    row.input = input;
    row.output = output;
    row.facts = facts;
    const pairs = Ev("drive", [fromJson(row), CELLS]);
    // AN ENTITY IS A COMPLEX SENTENCE AND IT GOES IN AS ONE. A Completion has
    // four mandatory roles and an Agent Definition three, so asserting them a
    // fact at a time is refused by Theorem 1's gate at every step -- measured
    // 2026-09-17: nine refusals in a row, each naming the roles the next writes
    // were about to fill. mcp:entities already says which fact types are the
    // columns of which table, so canon's pairs are gathered onto their tables
    // here and posted whole, through the same entity door a caller uses. A fact
    // type that is nobody's column -- the spanning ones, `Message asks about
    // Fact Type` among them -- is its own write, as it was.
    const tableOf = new Map();
    for (const e of ENTITIES) for (const f of entityFields(e)) if (!tableOf.has(f)) tableOf.set(f, e);
    const batches = new Map();
    const order = [];
    for (const p of pairs) {
      const ft = String(p[0]), fact = (Array.isArray(p[1]) ? p[1] : [p[1]]).map(String);
      const e = tableOf.get(ft);
      const key = e ? String(e[0]) + "/" + fact[0] : ft + "/" + order.length;
      if (!batches.has(key)) { batches.set(key, e ? { name: String(e[0]), args: { method: "POST", id: fact[0] }, facts: [] } : { name: ft, args: { method: "POST", fact }, facts: [] }); order.push(key); }
      const b = batches.get(key);
      b.facts.push(ft + " " + JSON.stringify(fact));
      if (e) b.args[ft] = fact.length > 1 ? fact[1] : fact[0];
    }
    const wrote = [], refused = [];
    for (const key of order) {
      const b = batches.get(key);
      const out = call(b.name, b.args);
      const status = Number(out && out[1]) || 500;
      for (const f of b.facts) (status < 400 ? wrote : refused).push(f + (status < 400 ? "" : " -- " + status + " " + String(out && out[0]).slice(0, 240)));
    }
    return [(answered ? "took your answer for '" : "asked the client for '") + operation + "' over " + subject
      + " (" + input.length + " characters of request, model " + row.model + ", agent " + row.agent + ")"
      + "\n\nthe completion:\n" + output
      + "\n\nwrote " + wrote.length + " facts:\n  " + wrote.join("\n  ")
      + (refused.length ? "\n\nrefused " + refused.length + ":\n  " + refused.join("\n  ") : ""), refused.length ? 409 : 200];
  }

  function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
  function fail(id, message) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message } };
  }

  function handle(msg) {
    if (msg.method === "initialize") {
      // THE INSTRUCTIONS ORIENT THE MODEL AT SESSION START (Sam, 2026-09-16):
      // the client shows this text to the model on connect, and canon
      // composes it from the store -- the Apps with their navigable Domains,
      // each App's orientation rows, and where the tutoring and the memory
      // live (mcp:instructions). A store that cannot compose it connects
      // without instructions rather than not at all.
      let instructions;
      try { instructions = String(Ev("mcp:instructions", CELLS)); } catch (e) { instructions = undefined; }
      // THE CAPABILITIES THE CLIENT SENDS ARE NOT SPARE BYTES. This read the
      // params and kept nothing from them, so a client that offers to run
      // completions for us was indistinguishable from one that does not, and
      // the seams the store derives as awaiting a driver stayed awaiting with
      // the driver sitting on the other end of the pipe.
      const caps = (msg.params && msg.params.capabilities) || {};
      SAMPLING = !!caps.sampling;
      const who = (msg.params && msg.params.clientInfo && msg.params.clientInfo.name) || "client";
      AGENT = "agent-" + Ev("slug", String(who)) + "-" + Ev("slug", String(Ev("clock", [])));
      // A HOST ASSERTS WHAT IT FILLED, and only for as long as it is filling it.
      // `Operation is registered` is resolution.md's own fact for a seam a host
      // really does answer; a client offering sampling is what makes this host
      // able to answer csdp:elementarize, so the fact is asserted here and NOT
      // emitted to store.db -- it is true of this connection and of nothing else.
      //
      // AND THE DOOR IS NOT THE REGISTRATION (2026-09-18). The seam tool is now
      // offered to every client, sampling or not, and it would have been easy to
      // move this assertion out with it on the grounds that the two should say
      // the same thing. They are two different claims and only looked like one
      // while sampling was the only door. Under sampling the HOST gets the
      // answer -- it asks, within the call, on its own initiative -- and that is
      // what registering an Operation means. Under a PASSED answer the host gets
      // nothing by itself; it can only take what a caller volunteers, so the
      // Operation still awaits a driver and the driver is the caller. The store
      // goes on saying so, which is what makes the awaiting list the question
      // step prints correct, and `drive:request`'s "no host has registered it"
      // true of the connection reading it.
      if (SAMPLING) {
        for (const d of Ev("drive:driven", CELLS)) {
          const out = Ev("mcp:call", ["POST", "OperationIsRegistered", "", [String(d)], CELLS]);
          if (out.length > 2 && Number(out[1]) < 400) adoptStore(out[2]);
        }
      }
      const result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: "arest", version: "1.0.0" },
      };
      if (instructions) result.instructions = instructions;
      return reply(msg.id, result);
    }
    if (msg.method === "tools/list") return reply(msg.id, { tools: tools() });
    // THE PROMPTS ARE THE VERBALIZATION PATTERNS (Sam, 2026-09-16: the MCP
    // must "provide help and tutoring (prompts) for verbalization patterns
    // in FORML2"). Both answers are canon's: mcp:prompts lists the
    // Verbalization Pattern rows of metamodel/verbalization.md as
    // <name, description>, and mcp:prompt is the tutor verb, one line per
    // pattern -- its form, the model's own example, and the note -- or the
    // index of names when the name names no pattern. The host only shapes
    // the protocol's envelope around them.
    if (msg.method === "prompts/list") {
      try {
        const rows = Ev("mcp:prompts", CELLS);
        return reply(msg.id, { prompts: rows.map((r) => ({ name: String(r[0]), description: String(r[1]) })) });
      } catch (e) { return fail(msg.id, String(e.message)); }
    }
    if (msg.method === "prompts/get") {
      const p = msg.params || {};
      try {
        const text = String(Ev("mcp:prompt", [String(p.name || ""), CELLS]));
        return reply(msg.id, { description: "FORML 2 verbalization pattern " + String(p.name || ""),
          messages: [{ role: "user", content: { type: "text", text } }] });
      } catch (e) { return fail(msg.id, String(e.message)); }
    }
    if (msg.method === "tools/call") {
      const p = msg.params || {};
      // the one call that may have to go and ask; it is the same <text, status>
      // answer, arriving later. A driven seam called under its OWN name is the
      // same drive with the operand the model declares: the subject, because
      // which operation is being driven is the name that was called -- and the
      // ANSWER after it, when the caller brought one, which is the whole of what
      // the second element of `args` is for. The capability no longer gates this:
      // a seam tool is offered to every client now, so a client that calls one
      // must reach the driver, or it would be offered a door that answers
      // "unknown tool" and the offer would be the lie.
      const driving = SAMPLED.has(String(p.name)) ? p.arguments
        : (DRIVEN_OF.has(String(p.name))
            ? { args: [{ operation: DRIVEN_OF.get(String(p.name)),
                         subject: (p.arguments && Array.isArray(p.arguments.args) && p.arguments.args.length)
                           ? String(p.arguments.args[0]) : "" }]
                  .concat(p.arguments && Array.isArray(p.arguments.args) && p.arguments.args.length > 1
                    ? [p.arguments.args[1]] : []) }
            : null);
      if (driving) {
        return drive(driving).then(
          (out) => reply(msg.id, { content: [{ type: "text", text: String(out[0]) }], isError: Number(out[1]) >= 400 }),
          (e) => reply(msg.id, { content: [{ type: "text", text: String(e && e.message) }], isError: true }));
      }
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
        const msg = JSON.parse(line);
        // a reply to a question THIS server asked comes back down the same pipe
        // and is not a call to answer; answeredOurs settles its promise instead
        if (answeredOurs(msg)) continue;
        out = handle(msg);
      } catch (e) {
        out = fail(null, String(e.message));
      }
      // an answer that had to go and ask arrives later; the line loop does not
      // wait for it, so a slow judgement is not a stall on every other call
      if (out && typeof out.then === "function") {
        out.then((o) => { if (o) process.stdout.write(JSON.stringify(o) + "\n"); },
                 (e) => process.stdout.write(JSON.stringify(fail(null, String(e && e.message))) + "\n"));
      } else if (out) process.stdout.write(JSON.stringify(out) + "\n");
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
// THE POPULATIONS AS A NORMALIZED DATABASE. Codd, not a blob: the RMAP 3NF
// tables are the store on disk, and a fact type's population is a projection
// (a SELECT) from them -- functional fact types are columns of an entity
// table, m:n fact types are their own relation tables, one _meta row per fact
// type saying which. The closure ran at build, so the stored populations are
// the closed ones; this reconstructs each as the cell ast:FetchPop reads and
// runs none of loadFile/loadReflected/loadDerived. Held byte-identical to a
// text-carrier boot by the case suite and the reports. The host stays thin:
// it runs the projection the build recorded, deciding no schema itself.
function loadStoreDb(path) {
  const { Database } = require("bun:sqlite");
  const db = new Database(path, { readonly: true });
  // AND IT MUST BE A PROJECTION OF THIS COMPOSITION. The tables ARE the durable
  // store (#108), so a database built from an older canon or older carriers is
  // not a slow path to fall back from -- it is the wrong store, and every write
  // made since lives only in it. Measured 2026-09-11: the base store.db of
  // 09-08 booted into the current module and `schema` threw `selector 2 out of
  // range 1` from somewhere inside the answer, naming a selector rather than a
  // database. It differed from a rebuilt one only in lacking four fact types
  // that had since become populated (EntityTypeHasReferenceMode,
  // ObjectTypeIsSubtypeOfObjectType, FactTypeHasDerivationMode,
  // SubtypeFactProvidesPreferredIdentifier) -- no kind, arity or column count
  // had moved, so nothing recoverable from _meta alone could have caught it.
  // Hence the stamp. A database written before the stamp existed carries none
  // and is refused for the same reason: it cannot be shown to match.
  // An ABSENT database is a different answer and not this check's: the readonly
  // open above refuses it with sqlite's own `unable to open database file`, and
  // a store asked for no database at all never reaches here.
  let stamped = null;
  try { stamped = (db.query("select hash from _composition").get() || {}).hash; } catch { /* predates the stamp */ }
  if (stamped !== COMPOSITION) {
    db.close();
    throw new Error("store.db was built from composition " + (stamped || "(none: it predates the stamp)") +
      ", this module is " + (COMPOSITION || "(unstamped)") + " -- " + path +
      "\n  rebuild it: AREST_OUT_DIR=" + path.replace(/[\\/][^\\/]*$/, "") + " bun tools/compile-store.js");
  }
  // WHAT THE ROWS MEAN IS CANON'S, NOT THIS FILE'S. rmap:coltabs names the
  // tables and rmap:proj_colnames their columns -- the same two the DDL and the
  // store writer use -- so the host selects those columns from those tables and
  // hands the rows to rmap:unproj, which answers <fact type, tuple> and decides
  // everything: that a relation table's role columns are its tuple in order,
  // that an entity table's key is the DECLARED primary key, that a unary column
  // is presence, and that the tuple order follows which role the table plays.
  //
  // WHAT THIS REPLACES was seventy lines that inferred all of it from a _meta
  // table: entity tables by subtracting the relation ones, a column's home by
  // assuming a functional column name is unique to one table, and a tuple by
  // unpacking c0..cN to a recorded arity. `_meta` occurs ZERO times in canon and
  // never did -- it was a shape this file invented so that it could read back
  // what it had written. The schema the readings actually describe is the one
  // rmap:ddl emits, and now it is the one that is read.
  const byFt = new Map();
  for (const t of Ev("rmap:coltabs", CELLS)) {
    const table = String(t[0]);
    const cols = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
    if (!cols.length) continue;
    let rows;
    try { rows = db.query("select " + cols.map((c) => '"' + c + '"').join(",") + ' from "' + table + '"').values(); }
    catch { continue; }                       // a table the schema has and this database does not
    if (!rows.length) continue;
    const clean = rows.map((r) => r.map((v) => (v === null ? "#" : String(v))));
    for (const p of Ev("rmap:unproj", [table, clean, CELLS])) {
      const ft = String(p[0]);
      if (!byFt.has(ft)) byFt.set(ft, []);
      byFt.get(ft).push(p[1]);
    }
  }
  const recon = [];
  for (const [ft, rows] of byFt) recon.push(["CELL", ft, rows]);
  // AND THE SOURCE IS ADOPTED WHOLE, because the tables now hold all of it.
  // What stood here read an _asserted ledger to find the rows the RUNTIME wrote
  // and carried only those into the source, since state:fts is spliced at build
  // time and is not a projection of these tables -- so a restart put the store
  // back as the readings left it and `get sr-alpha-1` answered # beside four
  // facts that read back fine through system:pop_rows. The inverse takes the
  // reason away: every populated fact type's rows land in the schema and come
  // back exactly (52 of 52 on the metamodel, 117 of 117 on claude, 49 of 49 on
  // the base corpus), so there is nothing for a ledger to tell apart and the
  // record is simply adopted. What that costs is ORDER: 17 of 49 populations
  // return in the table's key order rather than the readings'. A population is
  // a SET, the DDL stores no order, and FactTypeHasDeclarationOrder is how
  // order is a fact where it is one.
  const OTPOPS_FT = "ObjectTypeInstanceIsInstanceOfObjectType";
  const moved = recon.map((c) => [c[1], c[2]]);
  const runtimeInst = byFt.get(OTPOPS_FT) || [];
  db.close();
  // WHAT THE TABLES THEMSELVES HOLD, in the encoding popSnapshot compares. The
  // cells below are the same rows, but only until something recomputes one --
  // and a reflection is recomputed at every load (loadReflected), so by the
  // time the closure has run the cell no longer says what is on disk. boot()
  // diffs against THIS to find out what the tables are missing.
  STORE_TABLES = new Map(recon.map((c) => [c[1], JSON.stringify(c[2])]));
  const names = new Set(recon.map((c) => c[1]));
  for (let i = CELLS.length - 1; i >= 0; i--) if (Array.isArray(CELLS[i]) && names.has(CELLS[i][1])) CELLS.splice(i, 1);
  for (let i = recon.length - 1; i >= 0; i--) CELLS.unshift(recon[i]);
  memoClear();
  if (moved.length) { adoptStore(Ev("store:src_all", [moved, CELLS])); }
  if (runtimeInst.length) {
    const cell = Ev("store:otpops", [runtimeInst, CELLS]);
    for (let i = CELLS.length - 1; i >= 0; i--) if (Array.isArray(CELLS[i]) && CELLS[i][1] === "state:otpops") CELLS.splice(i, 1);
    CELLS.unshift(["CELL", "state:otpops", cell]);
    memoClear();
  }
}

function loadFile() {
  if (Ev("ast:fetch", ["FILE", CELLS]) !== "#") return;   // already carried
  const built = Ev("ast:File", Ev("store:state", CELLS));
  for (const cell of built) CELLS.unshift(cell);
  memoClear();
}

// THE STORE IS CLOSED UNDER ITS OWN RULES. Figure 1's command is
// resolve -> lfp -> validate -> emit, and a store that has never had its
// fixpoint taken is not at one: derive over the composed order store gains 26
// populations that are derivable and absent, the whole state-machine family
// among them (StatusIsDefinedInStateMachineDefinition, StatusIsTerminal...,
// StatusHasEffectiveTransitionToStatusOnEventType).
//
// A create does NOT fix this and should not: derive:any_reads correctly skips
// when no rule reads the changed cell, and creating a Sale changes nothing the
// metamodel rules read -- the machine facts depend on the transition
// declarations, which did not change. The closure belongs at load, for the same
// reason FILE does: a store that is not closed under its rules is not the store.
//
// Shapes are the ones law:apply's fixture uses, not inferred: store:fts applies
// store:fix_desc so column 5 is the rows themselves, induce:pairs_of then takes
// columns 1 and 5, and rules:metamodel (39) is the set -- rules:model (21)
// cannot derive StatusIsDefinedInStateMachineDefinition, which its own minus
// rules read.

// AND WHICH POPULATIONS THIS PROCESS COMPUTED, which is what lets either
// phase correct itself on a later pass without ever disturbing a cell the
// carriers or the tables supplied. The two are kept apart because canon's
// REFLECTION is the answer where it speaks: a reflected head may also be a
// rule head, and then the rule is the readings' statement of what the
// population means and the reflection is what computes it -- exactly the
// standing the effective-initial cell already has (metamodel/state.md).
const REFLECTED_NAMES = new Set();
const DERIVED_NAMES = new Set();

function loadDerived() {
  const rules = Ev("law:all_rules", CELLS);
  // READ THROUGH THE ACCESSOR THE RULES READ. induce:pairs_of takes slot 5 of
  // each descriptor, which is a FILE projection, so every REFLECTED population
  // -- roles, readings, cells -- arrived here empty and the rules over them
  // derived nothing. derive:store_pairs pairs each declared name with
  // system:pop_rows, which consults top-level cells before FILE.
  const before = Ev("derive:store_pairs", CELLS);
  // CARRIED MEANS HOLDING ROWS, NOT MERELY DECLARED, and the difference is the
  // whole of what this function was doing. Every derived head IS a declared fact
  // type, so a `seen` built from every name in store:fts contained all of them --
  // carried as EMPTY populations -- and the loop below skipped each one as
  // "already carried". derive was running, computing, and having its answers
  // discarded on the way out.
  //
  // It was computing plenty. Over this store the fixpoint fills nine heads,
  // including a transitive closure (StatusReachesStatusInStateMachineDefinition,
  // 45 rows), the effective-transition and terminal/rooted status derivations,
  // ObjectTypeInstanceIsOfFunction at 730, and the Entity Type / Value Type
  // subtypes at 124 and 88 -- which are exactly the entity/value split emitted
  // into ObjectTypeIsOfObjectKind by 111f1df2. Before that emit those two rules
  // derived nothing, because their input was empty; after it they derive, and
  // this line threw the result away.
  //
  // The second check stays as it was and is why the first has to be narrowed
  // rather than deleted: loadDerived may run AGAIN after a store change, and
  // without a guard on the cells it already added it prepends every derived
  // population twice.
  // AND CARRIED IS NOT THE SAME AS COMPLETE. The first narrowing here was from
  // "declared" to "holding rows"; this is the second, and the World Assumption
  // is what forced it. `Object Type has World Assumption` is SEMI-derived, so a
  // model may assert some rows and let the rules supply the rest -- and holding
  // two asserted rows made this loop skip the head entirely, discarding the 279
  // the rules computed and leaving 277 object types with no assumption at all.
  // The closure now merges semi heads itself (derive:closed, which keeps an
  // asserted row over a derived one on the same uniqueness key), so what is
  // carried can be a PREFIX of what is true. Compare lengths, not presence.
  const carried = new Map(before.map((p) => [String(p[0]), Array.isArray(p[1]) ? p[1].length : 0]));
  const seen = new Set();
  for (const c of CELLS) if (Array.isArray(c) && String(c[0]) === "CELL") seen.add(String(c[1]));
  // AND A TABLE IS NOT AN ANSWER FOR A HEAD THE RULE OWNS (2026-09-18). The
  // `seen` line above is PRESENCE, and presence is what the `carried` line
  // before it already had to stop trusting. On a boot from store.db
  // loadStoreDb makes a cell for every _meta row, so the moment a fully
  // derived head is MATERIALISED it has a cell, and `already its own cell`
  // throws the closure away for the one kind of head whose marker says the
  // rule owns the whole population -- the answer is then whatever the last
  // compile-store wrote, frozen against everything the store has learned
  // since. Measured on metamodel/resolution.md's `Operation awaits a driver`
  // the day it was declared `**`: the MCP asserts `Operation is registered`
  // per connection for the seams a sampling client can drive and does not
  // emit it (initialize, above), and with no table that assertion dropped
  // csdp:elementarize out of the awaiting list while with one it stayed in
  // it -- which is the defect resolution.md's own note names, the seams
  // "stayed awaiting with the driver sitting on the other end of the pipe".
  // A `+` head is deliberately NOT here: its rows may be ASSERTED, so what
  // the tables hold for it is a statement and not only a computation, and
  // the merge derive:sm_one performs is the reading of that. Only `*` and
  // `**` say the rule owns the population, and only a name the TABLES
  // supplied is claimed -- a carrier cell is left exactly as it was.
  let owned;
  try {
    owned = new Set(Ev("derive:sm_marks", CELLS)
      .filter((r) => String(r[1]) === "full" || String(r[1]) === "stored")
      .map((r) => String(r[0])).filter((n) => STORE_TABLES.has(n)));
  } catch { owned = new Set(); }

  let added = 0;
  for (const entry of Ev("derive:closed", CELLS)) {
    const name = String(entry[0]);
    // an EMPTY derived population is not worth a cell: closing under the whole
    // program derives the model's rule heads, whose inputs are empty, and
    // carrying those adds names nothing references and nothing can read
    if (!Array.isArray(entry[1]) || entry[1].length === 0) continue;
    if (REFLECTED_NAMES.has(name)) continue;              // canon's own answer, not the closure's
    if (DERIVED_NAMES.has(name) || owned.has(name)) {
      // A CELL THIS BOOT COMPUTED IS REFRESHED, NOT KEPT (2026-09-17). The two
      // guards below are about not disturbing what the CARRIERS or the TABLES
      // say; they were also stopping the closure from correcting its own
      // earlier answer. The state machines are the case: the first pass closed
      // over a store whose machines the reflection had not seeded yet, so
      // `State Machine is instance of State Machine Definition` was derived for
      // one instance out of six and then frozen there while the reflection went
      // on to name all six. Only a name this process computed is replaced, and
      // only when the answer moved, so a carrier cell and a stored population
      // are as untouched as they were.
      const at = CELLS.findIndex((c) => Array.isArray(c) && String(c[0]) === "CELL" && String(c[1]) === name);
      if (at >= 0) {
        if (JSON.stringify(CELLS[at][2]) === JSON.stringify(entry[1])) continue;
        CELLS.splice(at, 1);
      }
    } else {
      if (seen.has(name)) continue;                  // already its own cell
      if ((carried.get(name) || 0) >= entry[1].length) continue;
    }
    CELLS.unshift(["CELL", name, entry[1]]);
    DERIVED_NAMES.add(name);
    added++;
  }
  if (added) memoClear();
  return added;
}

// THE META-TYPES ARE REFLECTED AT LOAD, and canon says which. reflect:cells
// answers <name, population> pairs computed from the schema itself, so adding a
// reflected meta-type later is a canon edit and never a host edit -- this
// function names nothing and decides nothing, exactly as loadDerived does not.
//
// Role was the case that forced it: a declared entity type of this metamodel
// with NO instances anywhere, so `Each Fact Type has some Role` could not be
// satisfied while every role sat in state:declared as a player list. Shipping
// them as carrier data would mean ~467 static facts ABOUT a schema, beside the
// schema, free to drift from it. Computed, the metamodel cannot disagree with
// itself.
//
// BEFORE loadDerived, because a reflected population is an INPUT a rule may
// read -- the same reason loadFile comes before both.
//
// AND A REFLECTION IS RECOMPUTED, NEVER READ BACK (2026-09-17). This skipped a
// name that already had a cell, and a store booted from store.db has a cell for
// every fact type the tables carry -- so a reflected population, once EMITTED,
// was frozen at the value the last compile-store computed. The state machines
// are where that shows: a Support Request created after the build had no
// machine and no status until the store was rebuilt, which is a worklist that
// cannot see today's work. A reflection is a function of the store, so a copy of
// it in the tables is a CACHE and the recomputation is the answer; nothing
// asserts these names, and a cell that already equals the reflection is left
// exactly where it is, so a store with nothing to recompute loads as before.
function loadReflected() {
  let added = 0;
  for (const entry of Ev("reflect:cells", CELLS)) {
    const name = String(entry[0]);
    if (!Array.isArray(entry[1]) || entry[1].length === 0) continue;
    const at = CELLS.findIndex((c) => Array.isArray(c) && String(c[0]) === "CELL" && String(c[1]) === name);
    if (at >= 0) {
      if (JSON.stringify(CELLS[at][2]) === JSON.stringify(entry[1])) continue;
      CELLS.splice(at, 1);
    }
    CELLS.unshift(["CELL", name, entry[1]]);
    REFLECTED_NAMES.add(name);
    added++;
  }
  if (added) memoClear();
  return added;
}

// AND THE TWO PHASES ALTERNATE, because a reflected population may read a
// DERIVED one as well as feed one (2026-09-17). The comment above says why
// reflection comes first: a reflected population is an input a rule may read.
// The state machines are the other direction. `State Machine is for Object Type
// Instance` is one machine per instance of an object type a State Machine
// Definition is for, and the machine sits at its definition's EFFECTIVE INITIAL
// status advanced by the fired-transition fold -- and `Status is effective
// initial in State Machine Definition` is itself a derived head (the rules in
// metamodel/state.md). Reflected once, before the closure, the walk read an
// empty seed and answered NOTHING: measured on support.auto.dev, reflect:machines
// answers 6 rows over the closed store and 0 over the unclosed one, which is
// exactly the silence that left `State Machine is currently in Status` empty in
// every store ever built. So the closure runs between two reflections: the
// first seeds what the rules read, the closure settles the effective initial,
// and the second is the one whose machines are right. The bound is a stop and
// not a policy -- each phase only ever adds a name that has no cell or refreshes
// one this process itself computed, over a store that is otherwise fixed, so it
// settles on the second reflection and the bound has never been reached.
function closeStore() {
  const pass = (r) => {
    const d = loadDerived();
    if (process.env.AREST_BOOT_TIMING) console.error("boot: pass " + r + " reflected, " + d + " derived");
  };
  pass(loadReflected());
  for (let n = 0; n < 8; n++) {
    const r = loadReflected();
    if (!r) return;
    pass(r);
  }
}

function boot(mode) {
  // the reader's host: canon alone, no store to load, nothing to run; the
  // importer (tools/compile-design-state.js) evaluates read:* cells itself,
  // through the same published surface the test tail exposes
  if (mode === "reader") return run_test();
  // a server says where its boot went: the MCP client gives a server thirty
  // seconds to answer initialize, and this boot took two minutes on 2026-09-03
  // without a line to say which step
  const t0 = Date.now();
  const lap = (what) => {
    if (mode === "mcp" || mode === "serve" || process.env.AREST_BOOT_TIMING) console.error("boot: " + what + " " + (Date.now() - t0) + " ms");
    if (PROFILE) profReport(what); // @instrument
  };
  // A STORE WITH NO SCHEMA SURFACE has no FILE to build, nothing to reflect and
  // nothing to close under rules: the regress composition is canon with a run's
  // outcome and its record, and store:state over it has no state:fts to read.
  // Not a decision about the store, only the absence of its schema.
  const fromDb = process.env.AREST_STORE_DB;
  const schemaless = !fromDb && Ev("ast:fetch", ["state:fts", CELLS]) === "#";
  // AND WHAT THE CLOSURE DERIVES OVER A RUNTIME ROW IS STORED, OR THE TABLES
  // AND THE ANSWER DISAGREE (2026-09-18). tools/compile-store.js builds from
  // the CARRIERS -- it deletes AREST_STORE_DB on purpose, so its `_asserted`
  // ledger is what the readings say and nothing else -- and only afterwards
  // carries the rows the runtime wrote back into the tables. Nothing re-derives
  // over them, so every head that reads a runtime row was written from a store
  // that did not contain it. Measured on support.auto.dev's live store, built
  // 2026-09-17 21:37: `State Machine is for Object Type Instance` holds FIVE
  // rows in the tables -- sm.Free, sm.Starter, sm.Growth, sm.Scale,
  // sm.Enterprise, the five Plans the readings declare as VALUES -- while the
  // same store booted through loadStoreDb answers SIX, the sixth being
  // sm.sr-chris-pennington-20260913 for the one Support Request a person
  // created through the MCP, at status Draft, which is what its fired
  // AdminAcceptsSupportRequest implies. `actions` on that request answers its
  // four affordances from the SAME main:status_pop and has always been right.
  // So the stored fact and the menu were two computations after all, and a
  // worklist read off the tables found no live request while the menu beside it
  // offered four buttons on one. loadStoreDb already knows which rows the
  // runtime wrote (the ledger says which it did not) and rebuilds state:otpops
  // from them; closeStore then reflects and derives over a store that has them.
  // This writes that answer back, so the tables hold what the boot computed and
  // the next reader of the tables alone sees what the server sees. It is the
  // same three lines a write takes -- snapshot, evaluate, emit what changed --
  // over the closure instead of over a POST, and on a store with no runtime
  // rows it emits nothing, because nothing changed. A store that cannot be
  // written (locked, read-only, another process mid-write) is not a failed
  // boot: the answer in memory is unaffected and only durability is lost, so
  // the refusal is reported and the boot goes on.
  if (fromDb) {
    loadStoreDb(fromDb); loadFile();
    // AND THE BASELINE IS THE TABLES, NOT THE MEMORY BEFORE THE CLOSURE. A
    // reflected population is a function of the store, so it answers the same
    // before and after the reflection wherever its inputs are already loaded --
    // the diff against the pre-closure memory was EMPTY for the very row that
    // was missing from disk. A fact type the tables do not carry at all is not
    // this loop's business: which fact types get a table, and whether that
    // table is a relation or a column of an entity table, is the relational map
    // compile-store lays out, and a boot inventing one would give a functional
    // fact type a relation table of its own.
    const beforeClosure = popSnapshot(CELLS);
    for (const [ft, text] of STORE_TABLES) if (beforeClosure.has(ft)) beforeClosure.set(ft, text);
    closeStore();
    let closed = 0;
    try { closed = emitToDb(beforeClosure, CELLS); }
    catch (e) { console.error("the closure was computed but not stored in " + fromDb + ": " + e.message); }
    lap("store-db" + (closed ? ", closure stored into " + closed + " fact type(s)" : ""));
  }
  else if (!schemaless) {
    loadFile(); lap("file");
    closeStore(); lap("reflected and derived");
  }
  if (SAMPLE && process.env.AREST_SAMPLE_AFTER_BOOT) sreset(); // @instrument
  BOOTED = true;
  if (mode === "test") return run_test();
  if (mode === "serve") return run_serve();
  if (mode === "mcp") return run_mcp();
  if (mode === "sql") return run_sql();
  return run_cli();
}
