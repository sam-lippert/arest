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
// leaking in beside the lambda). NOTHING in this file holds law semantics. If
// you ever add a guard or a name list here, delete it — that is precisely how
// the last two died. The lambda and carriers arrive AS SOURCE (the one tuple
// literal reads as a LAMBDA(...) call, the rest-parameter wrap) and node just
// EXECs the composed file: nothing is read, eval'd, or interpreted at runtime.
// ============================================================================

// ---- the registration vocabulary: DEF, A, N, K, PHI, S1..S9, LAMBDA --------
// DEF accumulates the composed store (one CELL per registered name) so the
// store reads itself; a duplicate throws by collection semantics, exactly as
// the C# Dictionary.Add does — law:one_name is the law.
// the clock at this line is the time bun spent starting and PARSING the whole
// module (host, lambda and carriers) before running any of it; on the support
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
function LAMBDA() { return arguments; }
// THE COMPOSITION'S IDENTITY, stamped by build.js from lambda and the carriers
// it spliced -- not from this file, because a host edit does not move a
// population. compile.js writes this value into the store.db it projects,
// beside the hash of the SCHEMA it wrote there. loadStoreDb does not refuse a
// database carrying another: what a store is read through is its schema, and
// that is what it is held to; this says which build wrote it.
let COMPOSITION = null;
function COMPOSED(h) { COMPOSITION = h; }
let MODULE_ROOT = null;
function ROOTED(p) { MODULE_ROOT = p; }
// A CARRIER IS READ BY THE HOST, NOT PARSED AS CODE. design-state,
// norma-answer and the compiled map are intersection source -- S* a sequence,
// A an atom, N a number, PHI the empty sequence, K a CONST form, DEF a <name,
// body> entry, prose between -- and bun spent 8.6 s of the support store's
// 13.8-second load parsing 45 MB of them as nested JavaScript calls
// (2026-09-07). build.js now splices each carrier's text as ONE literal and
// this reads it: the same value the constructors would have built, registered
// with DEF exactly as the spliced calls were, prose dropped as LAMBDA dropped
// it. The carrier stays the carrier, inside the composition, and nothing is
// read from a path beside the module (Sam, on a JSON sidecar that was here
// for an hour: "Codd says no").
function LAMBDATEXT(text, onDef = DEF) {
  let i = 0;
  const n = text.length;
  const fail = (what) => { throw new Error("carrier: " + what + " at " + i + ": " + JSON.stringify(text.slice(i, i + 40))); };
  const ws = () => { for (;;) { const c = text.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else return; } };
  const str = () => {
    // a double-quoted literal as the oracle and quote_str write it: a
    // backslash escapes the next character (\" and \\), and the JS escapes
    // for a newline, return, tab, backspace, form feed and \u with four hex
    // digits read as bun read them; the backslash is sought only within the
    // span before the next quote
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
      if (d === "u") { out += String.fromCharCode(parseInt(text.slice(i + b + 2, i + b + 6), 16)); i = i + b + 6; continue; }
      out += d === "n" ? "\n" : d === "r" ? "\r" : d === "t" ? "\t" : d === "b" ? "\b" : d === "f" ? "\f" : d;
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
    if (e !== null && typeof e === "object" && !Array.isArray(e) && e.def !== undefined) onDef(e.def, e.body);
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
// pedantry: lambda's eq does not coerce either (eq<1,"1"> = F, case:eq-nateq),
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
// can be this small. Lambda already says what a number IS: system:isnum is
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
  // the operand's OWN spelling, the one implode and ntoa give lambda
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
// AND WHAT A STORE READ WITHOUT A SCHEMA LEAVES BEHIND: table -> <columns,
// rows>, the bytes as sqlite answered them. A module carrying no schema can
// open a store through its metaschema table (below) but cannot yet say what
// a row MEANS -- rmap:unproj reads state:fts to decide that -- so the rows
// are kept as rows and the decoding is the next step's.
let STORE_RAW = new Map();
// THE STORE'S ALETHIC VERDICT, RECORDED WITH IT (2026-10-03). The entity POST's gate checks only what a write
// touched, which is exact over a store that holds no alethic violation (Thm 1: a committed store holds none), and
// lambda keeps what it knows of that in the cell state:alethic_clean. A store read from its tables has not been
// through the gate, so the compile that wrote it judges it once (AREST_VERDICT, run by build.js after
// compile-store) and records T or F in _verdict; the boot reads it back into the cell; a committed write records
// the cell when it moved; and a compile drops the table, as it rewrites the store outside the gate. A store with
// no verdict recorded is judged at its first write, as lambda does when the cell is absent.
let VERDICT = null;
function readVerdict() {
  if (process.env.AREST_VERDICT) return; // the judge judges the store; it does not read an earlier answer
  const db = storeDb();
  if (!db) return;
  let row;
  try { row = db.query("select value from \"_verdict\" where name = 'alethic_clean'").get(); } catch { return; }
  if (row && (row.value === "T" || row.value === "F")) { CELLS.push(["CELL", "state:alethic_clean", row.value]); VERDICT = row.value; memoClear(); }
}
function writeVerdict(v) {
  const db = storeDb();
  if (!db || (v !== "T" && v !== "F") || v === VERDICT) return;
  db.run('create table if not exists "_verdict" (name text primary key, value text not null)');
  db.query('insert or replace into "_verdict" (name, value) values (?, ?)').run("alethic_clean", v);
  VERDICT = v;
}
function recordVerdict(cells) {
  let v;
  try { v = Ev("solve:cell", ["state:alethic_clean", cells]); } catch { return; }
  writeVerdict(v);
}
function storeDb() {
  if (STORE_DB !== null) return STORE_DB;
  const path = process.env.AREST_STORE_DB;
  if (!path) { STORE_DB = false; return false; }
  const { Database } = require("bun:sqlite");
  STORE_DB = new Database(path);
  return STORE_DB;
}
// A POPULATION IS A SET, SO ITS TEXT IS ORDER-INSENSITIVE (2026-09-21). The
// rows' JSON texts, sorted and made unique, as one JSON array: JSON.parse of
// it is the rows, and two texts are equal exactly when the populations hold
// the same rows. What compared before was JSON.stringify of the rows AS
// ORDERED, and the two sides of the boot's diff do not agree on an order:
// the tables answer in their key order (loadStoreDb's own note, 17 of 49 on
// the base corpus) and the closure answers in the readings'. Measured on a
// copy of qa.auto.dev's store, written back once already: of the 6 fact
// types a boot called changed, FactTypeHasReading (513 rows) and
// FunctionBelongsToDomain (737) were the same set in another order. The
// other four are rows the tables genuinely lack and the projection cannot
// land (FactTypeHasRole and ObjectTypePlaysRole are keyed by their FIRST
// player, so one role per fact type or object type; a ConstraintSpan row
// carries no span id for its position and sequence number to join), which
// is rmap's business and not this diff's: they are re-derived and re-written
// at every boot until the projection holds them.
function popText(rows) {
  const texts = rows.map((r) => JSON.stringify(r));
  texts.sort();
  let n = 0;
  for (let i = 0; i < texts.length; i++) if (i === 0 || texts[i] !== texts[i - 1]) texts[n++] = texts[i];
  texts.length = n;
  return "[" + texts.join(",") + "]";
}
// every declared population as text, so a write's diff is its changed fact
// types: 247 fact types and 4,457 rows in a millisecond on the base store
function popSnapshot(cells) {
  if (LAZY_STORE) LAZY_STORE.readAll();   // every population, each table read once, not one fact type at a time
  const snap = new Map();
  for (const d of Ev("store:fts", cells)) {
    const ft = d[0];
    if (typeof ft !== "string") continue;
    let p;
    try { p = Ev("system:pop_rows", [ft, cells]); } catch (e) { p = []; }
    snap.set(ft, popText(Array.isArray(p) ? p : []));
  }
  return snap;
}
// A WRITE'S DIFF IS THE CELLS IT REPLACED (2026-10-02; Sam: a Worker isolate gets 128 MB, and
// runtime memory must be kept to a viable level). emitToDb compared a snapshot of every declared
// population before the write with another after it, so every write read every table of the store
// twice over, into its rows and their sorted texts -- the 2.2 GB a support write peaked at. But
// lambda is pure and its successor store shares every cell it did not replace: a population is read
// through its own top-level cell, FILE's entry for it or its descriptor in state:fts, and one whose
// three objects are the prior store's objects is the prior store's population. So the fact types
// that can have moved are the ones some object on that path was replaced for, and only those are
// read and compared, each as popSnapshot reads it and with the same test emitToDb applies; on
// support a Contact Submission replaces 16 cells, of which 10 are populations that moved. A
// replaced cell a population reads beside its own (a reference scheme's: state:ucs, state:declared,
// state:refmodes) can move any of them, and then both snapshots are taken whole, as before.
// Answers each fact type that may have moved with its rows before and after, or null when every
// population is to be compared.
function popsMoved(prior, cells) {
  const top = (cs) => { const m = new Map(); for (const c of cs) if (Array.isArray(c) && c[0] === "CELL") m.set(String(c[1]), c); return m; };
  const was = top(prior), now = top(cells);
  const moved = new Set();
  for (const [n, c] of now) if (was.get(n) !== c) moved.add(n);
  for (const n of was.keys()) if (!now.has(n)) moved.add(n);
  for (const n of ["state:ucs", "state:declared", "state:refmodes"]) if (moved.has(n)) return null;
  // the entries replaced inside a container cell, by the name each entry carries
  const inner = (name, at) => {
    const a = was.get(name), b = now.get(name);
    if (a === b) return;
    const entries = (c) => { const m = new Map(); const v = c ? c[2] : null; if (Array.isArray(v)) for (const e of v) if (Array.isArray(e)) m.set(String(e[at]), e); return m; };
    const ea = entries(a), eb = entries(b);
    for (const [n, e] of eb) if (ea.get(n) !== e) moved.add(n);
    for (const n of ea.keys()) if (!eb.has(n)) moved.add(n);
  };
  inner("FILE", 1);
  inner("state:fts", 0);
  const pops = new Map();
  const declared = new Set();
  for (const d of Ev("store:fts", cells)) if (typeof d[0] === "string") declared.add(d[0]);
  for (const ft of moved) {
    if (!declared.has(ft)) continue;
    let p, q;
    try { p = Ev("system:pop_rows", [ft, prior]); } catch (e) { p = []; }
    try { q = Ev("system:pop_rows", [ft, cells]); } catch (e) { q = []; }
    pops.set(ft, [Array.isArray(p) ? p : [], Array.isArray(q) ? q : []]);
  }
  return pops;
}
// <before, after> as popSnapshot's texts, over the fact types that may have moved
function popSnapshotMoved(prior, cells) {
  const pops = popsMoved(prior, cells);
  if (pops === null) return [popSnapshot(prior), popSnapshot(cells)];
  const before = new Map(), after = new Map();
  for (const [ft, [p, q]] of pops) { before.set(ft, popText(p)); after.set(ft, popText(q)); }
  return [before, after];
}
// AND THE NUMBER 1 AND THE TEXT "1" ARE ONE VALUE IN A TABLE (2026-09-25). A
// table cell is text -- emitToDb writes flat(v) -- so a population the closure
// answers with numbers and the tables give back as text read as MOVED at every
// write: `Fact Type has Arity`, all 2,986 rows on support.auto.dev, every create,
// and the Function table re-projected for it. Two texts that differ are compared
// once more as the tables would hold them; the rows adopted are still the
// population's own.
// AND A DECIMAL AND ITS LEXEME ARE ONE VALUE IN A TABLE (2026-10-03, W1b). value:typed_insts files the
// instance of a decimal value type as the decimal it is, <decimal, 0, 0>, and the projection writes it to its
// cell as its lexeme (value:text, dec:text), "0", which a store read from its tables holds. So the first write
// after a start read a row the reflection files with a decimal as moved, though the table holds it: on a copy of
// support's store the planner's delta of Function belongs to Domain held 1,130 rows, 1,089 as a table holds
// them, and the planner refused Function at the key <decimal, 0, 0>, whose row's key column holds "0", and
// rewrote it whole, 71,174 rows. A decimal is compared as its lexeme, as a number is as its text. A row is its
// values: a row is never read as a decimal itself.
function storedText(text) {
  // a text with no number in it is already the text a table would hold: a JSON number
  // follows `[` or `,` and nothing else does
  if (!/[[,]-?[0-9]/.test(text)) return text;
  const asStored = (v) => (decShape(v) ? Ev("dec:text", v) : Array.isArray(v) ? v.map(asStored) : typeof v === "number" ? String(v) : v);
  return popText(JSON.parse(text).map((r) => (Array.isArray(r) ? r.map(asStored) : asStored(r))));
}
// TWO POPULATIONS ARE COMPARED ROW BY ROW, AND ONLY WHAT DOES NOT PAIR IS KEYED (2026-10-03). A write
// compared each population it may have moved as the sorted texts of every row on both sides (popText),
// compared the two again as the tables hold them where they differed (storedText), and the planner keyed
// every row of both sides once more, and a relation table's rows a third time to say which side holds them:
// on support a Contact Submission moves ten populations, 677,200 rows over the two sides, and its emit spent
// 0.55 s on the texts and 0.34 s on the keys to write five rows. The two sides of a moved population are
// mostly the same rows in the same order -- the closure and the reflection answer in an order of their own,
// and a write does not change it -- so they are walked side by side while their rows are equal as a table
// holds them, a run that is not is stepped over to the nearest rows that are, and only the rows left over are
// looked for on the other side. A row paired is on both sides, so the rows left over that the other side
// lacks are the whole difference, the one the keyed comparison finds; when the sides do not line up, or too
// many rows are left over, the keyed comparison is what answers.
// Two values equal as a table holds them: a number as its text, a decimal as its lexeme, and with `rt`, as a
// value read back from JSON is, a number JSON cannot write as null; anything but text, numbers and sequences
// as JSON writes it.
function storedEq(x, y, rt) {
  if (x === y) return true;
  x = storedAtom(x, rt); y = storedAtom(y, rt);
  if (x === y) return true;
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (!storedEq(x[i], y[i], rt)) return false;
    return true;
  }
  if (typeof x === "string" && typeof y === "string") return false;
  return JSON.stringify(x) === JSON.stringify(y);
}
function storedAtom(v, rt) {
  if (typeof v === "number") return rt && !Number.isFinite(v) ? null : String(v);
  if (decShape(v)) return Ev("dec:text", v);
  return v === undefined || typeof v === "function" || typeof v === "symbol" ? null : v;
}
// two rows equal as a table holds them: value by value, as storedEq takes a value; the row itself is never
// read as a decimal
function storedRowEq(r, s, rt) {
  if (r === s) return true;
  if (!Array.isArray(r) || !Array.isArray(s)) return storedEq(r, s, rt);
  if (r.length !== s.length) return false;
  for (let i = 0; i < r.length; i++) if (!storedEq(r[i], s[i], rt)) return false;
  return true;
}
// <the rows of b left over, the rows of a left over> when the two are walked side by side, each in its own
// order, or null when they do not meet again within LOOK rows or leave more than OVER rows over
function pairWalk(b, a, eq) {
  const LOOK = 8, OVER = 32;
  const unB = [], unA = [];
  let i = 0, j = 0;
  while (i < b.length && j < a.length) {
    if (b[i] === a[j] || eq(b[i], a[j])) { i++; j++; continue; }
    let di = -1, dj = -1;
    near: for (let s = 1; s <= 2 * LOOK; s++) {
      for (let x = Math.max(0, s - LOOK); x <= Math.min(s, LOOK); x++) {
        if (i + x < b.length && j + s - x < a.length && eq(b[i + x], a[j + s - x])) { di = x; dj = s - x; break near; }
      }
    }
    if (di < 0) return null;
    for (let e = 0; e < di; e++) unB.push(b[i + e]);
    for (let e = 0; e < dj; e++) unA.push(a[j + e]);
    i += di; j += dj;
    if (unB.length + unA.length > OVER) return null;
  }
  if (unB.length + unA.length + (b.length - i) + (a.length - j) > OVER) return null;
  for (; i < b.length; i++) unB.push(b[i]);
  for (; j < a.length; j++) unA.push(a[j]);
  return [unB, unA];
}
// whether two populations hold different rows as the tables hold them: the test storedText makes on their
// texts, which `textOf` writes as popText does
function popsDiffer(p, q, textOf) {
  if (p === q) return false;
  const eq = (x, y) => storedRowEq(x, y, true);
  const w = pairWalk(p, q, eq);
  if (w === null) { const tp = textOf(p), tq = textOf(q); return tp !== tq && storedText(tp) !== storedText(tq); }
  for (const r of w[0]) if (!q.some((s) => eq(r, s))) return true;
  for (const r of w[1]) if (!p.some((s) => eq(r, s))) return true;
  return false;
}
// A POPULATION'S ROWS IN ITS TEXT'S ORDER, NOT READ BACK FROM IT (2026-10-03). The rows a write carries into
// the source were JSON.parse of popText: each population the write moved written out as text, sorted, joined
// and read back -- a copy of every row, which the descriptors then held beside the cells' own. The rows are put
// in that order and made unique as their texts are, and kept as they are; a population holding a value JSON
// does not read back as itself (a number it cannot write, -0, undefined, an object) is read back from its text,
// as before. <text, rows>: the text popText writes and the rows JSON.parse reads from it.
function popSorted(rows) {
  const pairs = rows.map((r) => [JSON.stringify(r), r]);
  pairs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const texts = [], kept = [];
  let safe = true;
  for (let i = 0; i < pairs.length; i++) {
    if (i > 0 && pairs[i][0] === pairs[i - 1][0]) continue;
    texts.push(pairs[i][0]); kept.push(pairs[i][1]);
    if (safe && !jsonSafe(pairs[i][1])) safe = false;
  }
  const text = "[" + texts.join(",") + "]";
  return [text, safe ? kept : JSON.parse(text)];
}
// a value JSON writes as text that reads back as the same value
function jsonSafe(v) {
  if (typeof v === "string" || typeof v === "boolean" || v === null) return true;
  if (typeof v === "number") return Number.isFinite(v) && !Object.is(v, -0);
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) if (!(i in v) || !jsonSafe(v[i])) return false;
  return true;
}
// <removed, added>: the rows of b that no row of a equals and the rows of a that no row of b equals, as `keyOf`
// keys a row, each once per key, at its first place and as its last row -- the Map comparison at the end,
// which is what answers when the walk does not
function popDelta(b, a, keyOf) {
  if (b === a) return [[], []];
  const eq = (x, y) => storedRowEq(x, y, false);
  const w = pairWalk(b, a, eq);
  if (w !== null) {
    const lacking = (left, other) => {
      const m = new Map();
      for (const r of left) if (!other.some((s) => eq(r, s))) m.set(keyOf(r), r);
      return [...m.values()];
    };
    return [lacking(w[0], a), lacking(w[1], b)];
  }
  const bk = new Map(), ak = new Map();
  for (const r of b) bk.set(keyOf(r), r);
  for (const r of a) ak.set(keyOf(r), r);
  const removed = [], added = [];
  for (const [k, r] of bk) if (!ak.has(k)) removed.push(r);
  for (const [k, r] of ak) if (!bk.has(k)) added.push(r);
  return [removed, added];
}
// A WRITE REWRITES THE ROWS IT MOVED, NOT THE TABLES THEY SIT IN (2026-09-25; Sam:
// "low memory footprint is a requirement"). emitToDb re-projected every table a
// changed fact type touched, whole, and a create on support.auto.dev touches
// Function -- every instance is a Function, with its domain and its type -- so
// every create re-projected 20,159 rows by 301 columns to land two of them:
// rmap:proj_rows 29.8 s and 70,892 rows written, of a 51 s create.
// A ROW IS STILL LAMBDA'S. rmap:proj_rows maps rmap:proj_row <key, table, store>
// over an entity table's keys and rmap:proj_relrow <fact, table, store, relcols>
// over a relation table's facts, and those two write every row here too. What
// this decides is only WHICH rows can have moved, and it reads that off the walks
// the projection takes: a column's value is a walk from the row's source -- its
// key, or a role of its fact -- through the column path's steps, each a lookup of
// the running value at the step's key position in the step's population
// (rmap:proj_carry, rmap:proj_step, rmap:proj_lookup). So a fact that came or went
// at a column's first step moves exactly the row whose key it holds at that
// step's key position, and for a relation, the row of the fact itself. Those rows
// are deleted by their primary key and written again from lambda; no other row is
// touched.
// ONLY THE FIRST STEP, BECAUSE NO STORE HOLDS A FACT PAST IT. The steps after the
// first read a referenced entity's own identifying facts, and in every store
// measured those fact types are EMPTY -- 0 of 1,004 on support.auto.dev, 0 of 205
// on the base -- so every walk passes through them (a step over an empty
// population passes its value on). A fact that moved past the first step would
// move every row whose walk crosses it, and that table is rewritten whole.
// WHERE IT IS NOT EXACT, THE TABLE IS REWRITTEN WHOLE, as before: a fact type past
// a walk's first step moved; a population turned empty or stopped being, which
// changes how every walk through it behaves (except at a column's first step when
// that column is not the identifier: rmap:proj_carry answers # for an empty
// population, and the lookup answers # for a key with no fact, so there only the
// facts that came or went move); an entity table whose key is not one column; a
// row whose key column does not carry its key. And the whole table is what a
// caller with no store-before gets, which is compile.js.
function rowPlanner(cells, prior, changed) {
  // a value as a table holds it -- a number as its text, a decimal as its lexeme (dec:text) -- keys the value
  // (keyOf) and a row by its values (rowKey), and is the text of the cell a key is written to (cellText)
  const asStored = (v) => (decShape(v) ? Ev("dec:text", v) : Array.isArray(v) ? v.map(asStored) : typeof v === "number" ? String(v) : v);
  const keyOf = (v) => JSON.stringify(asStored(v));
  const rowKey = (r) => JSON.stringify(Array.isArray(r) ? r.map(asStored) : asStored(r));
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  const cellOf = (v) => (v === "#" || v === undefined ? null : flat(v));
  const cellText = (v) => (decShape(v) ? Ev("dec:text", v) : flat(v));
  const pops = new Map(), deltas = new Map(), walks = new Map(), keysets = new Map();
  // a path's steps and a step's key position, kept across writes by what they read (planInputs, beside projRow)
  const held = planInputs(cells);
  const popOf = (ft, side) => {
    const k = side + "\u0000" + ft;
    let p = pops.get(k);
    if (!p) {
      let r;
      try { r = Ev("rmap:proj_pop", [ft, side === "after" ? cells : prior]); } catch { r = []; }
      p = Array.isArray(r) ? r : [];
      pops.set(k, p);
    }
    return p;
  };
  const deltaOf = (ft) => {
    let d = deltas.get(ft);
    if (d) return d;
    const b = popOf(ft, "prior"), a = popOf(ft, "after");
    const [removed, added] = popDelta(b, a, rowKey);
    d = { moved: removed.concat(added), removed, added, flip: (b.length === 0) !== (a.length === 0) };
    deltas.set(ft, d);
    return d;
  };
  const stepOf = (st) => {
    const ft = Array.isArray(st) && Array.isArray(st[4]) && st[4].length ? String(st[4][0]) : null;
    let kp = 1;
    if (ft) { try { kp = Number(keyPos(st, cells, held)); } catch { kp = 1; } }
    return { ft, kp, id: Array.isArray(st) && String(st[5]) === "T" };
  };
  const walkOf = (path) => {
    const k = keyOf(path);
    let w = walks.get(k);
    if (!w) {
      let na;
      try { na = nonAssim(Array.isArray(path) ? path : [], held); } catch { na = []; }
      w = (Array.isArray(na) ? na : []).map(stepOf);
      walks.set(k, w);
    }
    return w;
  };
  // the values arriving at a walk's first step whose row a moved fact can change, or
  // null when that cannot be said exactly; `carried` is a column whose first step is
  // rmap:proj_carry's, and not a relation's role walked on from its fact
  const sources = (walk, carried) => {
    const out = new Map();
    for (let j = 0; j < walk.length; j++) {
      if (!walk[j].ft || !changed.has(walk[j].ft)) continue;
      if (j > 0 || !carried) return null;
      const d = deltaOf(walk[0].ft);
      if (d.flip && walk[0].id) return null;
      for (const g of d.moved) { const v = Array.isArray(g) ? g[walk[0].kp - 1] : undefined; if (v !== undefined) out.set(keyOf(v), v); }
    }
    return out;
  };
  // an entity table's keys on one side: every column's first-step population at its key
  // position, which is rmap:proj_keys -- each key as that side holds it, or undefined. A key is
  // compared as a table holds it, so the one a row held before the write can be the text "0" where the
  // store after it holds the decimal the reflection files; a row is projected from the key as the
  // store it is projected from holds it
  const keyAt = (cols, side, v) => {
    const k = keyOf(v);
    for (const c of cols) {
      const w = walkOf(c[2]);
      if (!w.length || !w[0].ft) continue;
      const id = side + "\u0000" + w[0].ft + "\u0000" + w[0].kp;
      let held = keysets.get(id);
      if (!held) {
        held = new Map();
        for (const g of popOf(w[0].ft, side)) {
          if (!Array.isArray(g) || g[w[0].kp - 1] === undefined) continue;
          const x = g[w[0].kp - 1], kx = keyOf(x);
          if (!held.has(kx)) held.set(kx, x);
        }
        keysets.set(id, held);
      }
      const x = held.get(k);
      if (x !== undefined) return x;
    }
    return undefined;
  };
  return (table, colnames, pk) => {
    let cols;
    try { cols = Ev("rmap:proj_cols", [table, cells]); } catch { return null; }
    if (!Array.isArray(cols)) return null;
    const at = pk.map((n) => colnames.indexOf(n));
    if (!pk.length || at.some((i) => i < 0)) return null;
    const dels = [], ins = [];
    let rel = false;
    try { rel = Ev("rmap:proj_hits", [table, Ev("store:fts", cells)]).length > 0; } catch { rel = false; }
    if (!rel) {
      if (pk.length !== 1) return null;
      const dirty = new Map();
      for (const c of cols) {
        const src = sources(walkOf(c[2]), true);
        if (src === null) return null;
        for (const [k, v] of src) dirty.set(k, v);
      }
      for (const [, k] of dirty) {
        // AFTER THE WRITE FIRST: a key the write created is in the first population that carries it after,
        // and was in none before, which only reading every one of them says -- on support 290 populations,
        // 196,129 rows, for a Contact Submission's one key
        const now = keyAt(cols, "after", k);
        if (now !== undefined || keyAt(cols, "prior", k) !== undefined) dels.push([cellText(k)]);
        if (now === undefined) continue;
        const row = Ev("rmap:proj_row", [now, table, cells]);
        const vals = colnames.map((_, i) => cellOf(row[i]));
        if (vals[at[0]] !== cellText(now)) return null;
        ins.push(vals);
      }
      return { dels, ins };
    }
    // a relation table: a row per fact of its own fact type, the role columns walked from
    // the fact's roles and the others read from its objectified key
    let relcols;
    try { relcols = Ev("rmap:proj_relcols", [table, cells]); } catch { return null; }
    const dirty = new Map();
    if (changed.has(table)) for (const g of deltaOf(table).moved) dirty.set(rowKey(g), g);
    const b = popOf(table, "prior"), a = popOf(table, "after");
    for (let ci = 0; ci < relcols.length; ci++) {
      const pos = Number(relcols[ci][0]);
      const src = pos === 0 ? sources(walkOf(cols[ci] ? cols[ci][2] : []), true)
        : sources((Array.isArray(relcols[ci][1]) ? relcols[ci][1] : []).map(stepOf), false);
      if (src === null) return null;
      if (!src.size) continue;
      for (const pop of b === a ? [a] : [b, a]) for (const g of pop) {
        const v = !Array.isArray(g) ? undefined : pos === 0 ? Ev("rmap:proj_objkey", g) : g[pos - 1];
        if (v !== undefined && src.has(keyOf(v))) dirty.set(rowKey(g), g);
      }
    }
    // every row dirtied is a row of b or of a, so it was there unless the write added it and is there
    // unless the write took it away
    const d = b === a ? null : deltaOf(table);
    const gained = new Set(d ? d.added.map(rowKey) : []), lost = new Set(d ? d.removed.map(rowKey) : []);
    let before = null;
    for (const [k, g] of dirty) {
      if (!gained.has(k)) {
        if (!before) before = Ev("rmap:proj_relcols", [table, prior]);
        const old = Ev("rmap:proj_relrow", [g, table, prior, before]);
        dels.push(at.map((i) => cellOf(old[i])));
      }
      if (!lost.has(k)) {
        const row = Ev("rmap:proj_relrow", [g, table, cells, relcols]);
        ins.push(colnames.map((_, i) => cellOf(row[i])));
      }
    }
    return { dels, ins };
  };
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
// whether the last emitToDb stored its rows: false from its start until its transaction commits, so a
// failure before then is a write nothing of which was stored (storeWrite)
let EMIT_STORED = false;
function emitToDb(before, cells, prior, report) {
  EMIT_STORED = false;
  // AND SAYS WHICH TABLES IT WROTE, when handed a report to say it in: the in-place compile keeps its
  // ledger for those tables alone (2026-09-29)
  if (report) report.touched = [];
  // AND WHAT EACH PART OF IT TOOK, for the line a served write logs (storeWrite, 2026-10-03): reading the
  // populations, testing which moved, planning and writing the rows, and what follows the commit; and the
  // rows of each table it rewrote whole
  let lt = performance.now();
  const lap = (part) => { const t = performance.now(); if (report) report[part] = t - lt; lt = t; };
  if (report) { report.start = lt; report.rewrote = []; }
  const db = storeDb();
  if (!db) return 0;
  // a caller with no snapshot of its own hands the prior store, and the diff is the cells the write
  // replaced (popsMoved), a population compared row by row (popsDiffer) and written out as text only
  // when it moved
  const changed = new Set();
  let carried;
  const pops = before === null && prior ? popsMoved(prior, cells) : null;
  if (pops !== null) {
    lap("snapshot");
    const sorted = new Map();
    const sortedOf = (rows) => { let s = sorted.get(rows); if (s === undefined) sorted.set(rows, (s = popSorted(rows))); return s; };
    for (const [ft, [p, q]] of pops) if (popsDiffer(p, q, (rows) => sortedOf(rows)[0])) changed.add(ft);
    if (changed.size) carried = [...changed].map((ft) => [ft, sortedOf(pops.get(ft)[1])[1]]);
  } else {
    if (before === null) before = popSnapshot(prior);
    const after = popSnapshot(cells);
    lap("snapshot");
    for (const [ft, text] of after) {
      const was = before.get(ft);
      if (was === text || (was !== undefined && storedText(was) === storedText(text))) continue;
      changed.add(ft);
    }
    if (changed.size) carried = [...changed].map((ft) => [ft, JSON.parse(after.get(ft))]);
  }
  lap("change");
  if (report) report.moved = changed.size;
  if (!changed.size) return 0;
  // THE SOURCE TAKES THE ROWS FIRST, because the projection reads it. A row
  // derived at boot or written through main:api lives in a per-fact-type cell,
  // and rmap:proj_rows answers from the DESCRIPTORS -- store:fts slot 5 -- so
  // re-projecting without adopting would write the tables back exactly as they
  // were and call it a store. store:src_all is how a row joins the source, and
  // it is the same call the API path already makes before it emits.
  adoptStore(Ev("store:src_all", [carried, cells]));
  // AND WHERE PLAN AND WRITE GOES, PART BY PART (2026-10-05): re-sourcing the moved populations and reflecting the
  // store that makes, saying which tables they touch, planning each table's rows, and writing them -- on a copy of
  // support.auto.dev a sent reply's write spent 1,574 ms here for nine rows, and the line said no more than that
  const wp = { resource: performance.now() - lt, touched: 0, plan: 0 };
  if (report) report.writeParts = wp;
  let wt = performance.now();
  // A TABLE IS TOUCHED BY WHAT ANY STEP OF ITS WALKS READS (2026-09-25), not only
  // the first: a column naming another entity walks to it and reads its identifier
  // there, so a fact that moved at the second step moves this table's column. This
  // tested rmap:proj_carried, the first step's fact type, alone.
  const held = planInputs(cells);
  const reads = (path) => {
    let na;
    try { na = nonAssim(Array.isArray(path) ? path : [], held); } catch { return false; }
    return Array.isArray(na) && na.some((st) => Array.isArray(st) && Array.isArray(st[4]) && st[4].length > 0 && changed.has(String(st[4][0])));
  };
  const touched = new Set();
  // ONLY A TABLE THE DDL CREATED (2026-10-07): rmap:writeback is rmap:ctab's keyed entries, the
  // ones rmap:coltabs is built from; walking rmap:ctab inserted into a table without a key, which
  // no database has (support: `"Response": no such table: Response`). law:writeback_keyed holds it.
  for (const t of Ev("rmap:writeback", cells)) {
    const table = String(t[1]);
    if (changed.has(String(t[0]))) { touched.add(table); continue; }
    for (const col of t[2]) if (reads(col[2])) { touched.add(table); break; }
  }
  wp.touched = performance.now() - wt;
  const plan = prior ? rowPlanner(cells, prior, changed) : null;
  const byRow = new Set();
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  let written = 0;
  // A REFUSED STATEMENT FAILS THE WRITE (2026-10-03). Each row was written in a try of its own and a refusal
  // taken for a row that was not the table's, so a write the closure admitted and the database refused answered
  // committed while the table kept nothing: the process held the row and the next boot did not (a primary key
  // over two roles of a ternary, on a test store). A table the schema has and the database does not is the
  // same loss. So every refusal is kept, with the table and the row's first values, and the first is thrown
  // inside the transaction, which takes back every statement it ran.
  const refused = [];
  const refuse = (table, e, v) => refused.push('"' + table + '": ' + String((e && e.message) || e)
    + (v ? " -- a row beginning " + JSON.stringify(v.slice(0, 2)).slice(0, 120) : ""));
  const counted = new Map();
  db.transaction(() => {
    for (const table of touched) {
      const cols = Ev("rmap:proj_colnames", [table, cells]).map(String);
      if (!cols.length) continue;
      const pk = plan ? db.query("select name from pragma_table_info(?) where pk > 0 order by pk").values(table).map((r) => String(r[0])) : [];
      // AND A CALLER MAY HAVE A TABLE WRITTEN WHOLE where the planner could say which rows moved (2026-09-29):
      // the planner deletes a row by the key its facts project to, and a relation row an older schema's
      // write-back left under another key outlives them
      wt = performance.now();
      const rows = plan && pk.length && !(report && typeof report.whole === "function" && report.whole(table)) ? plan(table, cols, pk) : null;
      wt = performance.now() - wt;
      wp.plan += wt;
      if (wt >= 20) (wp.slow || (wp.slow = [])).push([table, wt]);
      if (rows) {
        let del, put;
        try {
          del = db.prepare('delete from "' + table + '" where ' + pk.map((c) => '"' + c + '" is ?').join(" and ") + " returning *");
          put = db.prepare('insert into "' + table + '" ("' + cols.join('","') + '") values (' + cols.map(() => "?").join(",") + ")");
        } catch (e) { refuse(table, e); continue; }
        // AND WHAT THE ROWS HELD IS COUNTED AS THEY GO (2026-10-03): each column's values the write took away
        // and put back, and the rows, by which the lazy store moves its counts. It counted the table again
        // instead, every column of it -- support's Function is 71,174 rows by 313 columns, 0.2 s of every
        // create -- to find out what the write had just done.
        const held = new Map();
        let n = 0;
        for (const v of rows.dels) for (const old of del.all(...v)) {
          written++; n--;
          for (const c in old) if (old[c] !== null) held.set(c, (held.get(c) || 0) - 1);
        }
        for (const v of rows.ins) {
          try { put.run(...v); written++; n++; for (let i = 0; i < cols.length; i++) if (v[i] !== null) held.set(cols[i], (held.get(cols[i]) || 0) + 1); }
          catch (e) { refuse(table, e, v); }
        }
        counted.set(table, { rows: n, held });
        byRow.add(table);
        continue;
      }
      let ins;
      try {
        db.run('delete from "' + table + '"');
        ins = db.prepare('insert into "' + table + '" ("' + cols.join('","') + '") values ('
          + cols.map(() => "?").join(",") + ")");
      } catch (e) { refuse(table, e); continue; }          // a table the schema has and this database does not
      let n = 0;
      for (const row of Ev("rmap:proj_rows", [table, cells])) {
        const vals = cols.map((_, i) => { const v = row[i]; return v === "#" || v === undefined ? null : flat(v); });
        try { ins.run(...vals); written++; n++; } catch (e) { refuse(table, e, vals); }
      }
      if (report) report.rewrote.push([table, n]);
    }
    if (refused.length) throw new Error("the store refused " + (refused.length === 1 ? "a statement: " : refused.length + " statements, the first: ") + refused[0]);
  })();
  EMIT_STORED = true;
  lap("write");
  // AND WHAT A TABLE WRITTEN ROW BY ROW HELD FOR THE REST IS STILL TRUE. Dropping
  // everything read from a touched table made the NEXT write's snapshot read it all
  // back -- Function whole, 1.7 s and some 190 MB on support.auto.dev, at every write
  // after the first -- though no fact type but the moved ones has a different row in
  // it. So the lazy store keeps those, and takes the moved populations from the write
  // that stored them; a table rewritten whole is read again, as before.
  if (LAZY_STORE) {
    LAZY_STORE.wrote(byRow, new Map(carried), counted);
    LAZY_STORE.invalidate([...touched].filter((t) => !byRow.has(t)));
  }
  // AND WHAT THE ROWS WERE WORKED OUT FROM IS LET GO. The planner asks lambda about
  // the store before the write, and an answer memoised on it holds that whole store
  // -- its FILE and every cell the write replaced -- until the next write clears the
  // memo; measured on support.auto.dev, two creates back to back peaked some 150 MB
  // above the whole-table rewrite for it.
  if (plan) memoClear();
  if (report) report.touched = [...touched];
  recordVerdict(cells);
  lap("tail");
  if (report) { report.byRow = byRow.size; report.written = written; }
  return written;
}
// theta:unfold_rows and theta:unfold_descs by the identity of the array unfolded (see their twins)
// value:is_scalar and law:rowp as their DEFs answer them (see their twins)
function isScalar(x) {
  if (!Array.isArray(x)) return true;
  return x.length === 3 && x[0] === "decimal" && typeof x[1] === "number" && typeof x[2] === "number";
}
function isRow(x) { return Array.isArray(x) && x.length > 0 && x.every(isScalar); }
// derive:filter_sel by an index of the rows, by position and value (see its twin)
const SELIDX = new WeakMap();
// a key for a value, equal for two values exactly when eq holds of them; undefined where a key cannot say that
// (a number that is not finite, which eq does not hold of itself or JSON spells as null, or a value that is no
// lambda value), and the DEF answers there
function selKey(v) {
  if (typeof v === "string") return "s" + v;
  if (typeof v === "number") return Number.isFinite(v) ? "n" + v : undefined;
  if (Array.isArray(v)) return finiteDeep(v) ? "a" + JSON.stringify(v) : undefined;
  return undefined;
}
function finiteDeep(v) {
  for (const e of v) {
    if (typeof e === "number") { if (!Number.isFinite(e)) return false; }
    else if (Array.isArray(e)) { if (!finiteDeep(e)) return false; }
    else if (typeof e !== "string") return false;
  }
  return true;
}
function filterSel(x) {
  const def = () => Ev(DEFS.get("derive:filter_sel"), x);
  if (!Array.isArray(x) || x.length !== 2) return def();
  const sel = x[0], rows = x[1];
  if (!Array.isArray(sel) || sel.length !== 2 || !Array.isArray(rows) || rows === CELLS) return def();
  const pos = sel[0];
  if (typeof pos !== "number") return def();
  let byPos = SELIDX.get(rows);
  if (byPos === undefined || byPos.n !== rows.length) { byPos = { n: rows.length, at: new Map() }; SELIDX.set(rows, byPos); }
  let idx = byPos.at.get(pos);
  if (idx === undefined) {
    idx = new Map();
    try {
      for (const r of rows) {
        const k = selKey(Ev(pos, r));
        if (k === undefined) return def();
        const l = idx.get(k);
        if (l) l.push(r); else idx.set(k, [r]);
      }
    } catch (e) { return def(); }
    byPos.at.set(pos, idx);
  }
  const want = selKey(sel[1]);
  if (want === undefined) return def();
  const hit = idx.get(want);
  return hit ? hit.slice() : [];
}
const UNFOLDROWS = new WeakMap(), UNFOLDDESCS = new WeakMap();
// nav:keep_peer: the keys of a FILE cell's atoms, or null when its contents are no trie, by the contents' identity
const PEERATOMS = new WeakMap();
// system:pop_in: the heads a store computes on read (derive:or_heads) and the rows each one computes to
// (derive:on_read), by the store's identity; memoClear drops both when a write moves the store
let ORHEADS = new WeakMap(), ORROWS = new WeakMap();
// whether rmap:proj_objkey spells the row as the id: its values joined by a period, as an objectified instance is
// keyed (main:re_own). A row whose first value is text spells an id only past that text and a period, so the
// DEF is asked of no other; a row of one text value would hold the id itself, which the callers have ruled out.
function objkeyIs(row, id) {
  if (!Array.isArray(row) || row.length === 0) return false;
  if (typeof row[0] === "string" && (row.length < 2 || !id.startsWith(row[0] + "."))) return false;
  return Ev("rmap:proj_objkey", row) === id;
}
function onReadHeads(store) {
  let s = ORHEADS.get(store);
  if (s === undefined) { s = new Set(seq(orHeadsOf(store)).map(String)); ORHEADS.set(store, s); }
  return s;
}
// derive:or_heads <store> reads the store through its derivation marks (state:derived), its rules (state:rules,
// beside the constant rules:metamodel) and the rows of the three fact types derive:wr_named reads (Event Type
// is classified, the transitions' triggers, the guards' fact types), and through nothing else: so the answer is
// kept by those, the two cells by identity and the rows by value, and every store a write or a law makes over
// one schema computes it once. Under the profiler the law report spent most of its time recomputing it, one
// store at a time (2026-10-04, task #172).
const ORHEADSOF = new Map();
const CELLIDS = new WeakMap(); let CELLIDN = 0;
function cellId(v) {
  if (!Array.isArray(v)) return "a" + String(v);
  let n = CELLIDS.get(v);
  if (n === undefined) { n = ++CELLIDN; CELLIDS.set(v, n); }
  return "c" + n;
}
function orHeadsOf(store) {
  const def = () => Ev(DEFS.get("derive:or_heads"), store);
  if (!Array.isArray(store)) return def();
  const fetch = FASTPRIMS.get("ast:fetch");
  const raw = (n) => Ev(DEFS.get("derive:raw_rows"), [n, store]);
  const key = cellId(fetch(["state:derived", store])) + "|" + cellId(fetch(["state:rules", store])) + "|"
    + JSON.stringify([raw("EventTypeIsClassified"), raw("TransitionIsTriggeredByEventType"), raw("GuardReferencesFactType")]);
  let v = ORHEADSOF.get(key);
  if (v === undefined) {
    v = def();
    if (ORHEADSOF.size >= 64) ORHEADSOF.clear();
    ORHEADSOF.set(key, v);
  }
  return v;
}
function onReadRows(name, store) {
  let m = ORROWS.get(store);
  if (m === undefined) { m = new Map(); ORROWS.set(store, m); }
  let rows = m.get(name);
  if (rows === undefined) { rows = Ev(DEFS.get("derive:on_read"), [name, store]); m.set(name, rows); }
  return rows;
}
// main:or_has: the atoms of a head's computed rows, keyed as theta:member compares them, by the rows' identity
const ORATOMS = new WeakMap();
function onReadAtoms(name, store) {
  const rows = onReadRows(name, store);
  let s = ORATOMS.get(rows);
  if (s === undefined) { s = new Set(); for (const r of seq(rows)) for (const a of seq(r)) s.add(keyOf(a)); ORATOMS.set(rows, s); }
  return s;
}
// solve:readings by the identity of the state:readings cell it reads (see its twin)
const READINGSOF = new WeakMap();
function unfoldOnce(memo, name, x) {
  if (!Array.isArray(x)) return Ev(DEFS.get(name), x);
  const hit = memo.get(x);
  if (hit !== undefined && hit[0] === x.length) return hit[1];
  const v = Ev(DEFS.get(name), x);
  memo.set(x, [x.length, v]);
  return v;
}
const PRIMS = new Map(Object.entries({
  "id": x => x,
  "tl": x => { const a = seq(x); if (a.length === 0) throw new Error("tl on empty"); return a.slice(1); },
  "atom": x => bool(!Array.isArray(x)),
  "apndl": x => [at(x,0), ...seq(at(x,1))],
  "apndr": x => { const p = seq(at(x,0)), e = at(x,1); const out = [...p, e]; if (DEDUPKEYS.has(p)) CATPROV.set(out, [p, [e]]); matchProv(out, p, 1); keyProv(out, p); superProv(out, p); return out; },
  "distl": x => { const h = at(x,0); return seq(at(x,1)).map(e => [h, e]); },
  "distr": x => { const t = at(x,1); return seq(at(x,0)).map(e => [e, t]); },
  "cat": x => { const p = seq(at(x,0)), s = seq(at(x,1)); const out = [...p, ...s]; if (DEDUPKEYS.has(p)) CATPROV.set(out, [p, s]); matchProv(out, p, s.length); keyProv(out, p); superProv(out, p); return out; },
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
  // AND A TWIN SERVES THE DEF WHEREVER THE DEF IS APPLIED (2026-09-25). The verb route
  // resolves a verb to its cell's CONTENTS -- main:verb_value is apply over solve:cell,
  // and solve:cell answers the body -- so a twin, which is found by NAME, was never
  // reached from a served verb: with the get twin in place, support's served `get`
  // still took 2,067 ms and peaked at 1,297 MB resident, because apply evaluated the
  // body it was handed. A twin is its DEF certified, so applying the DEF's own body is
  // applying the DEF, and the twin is the same answer by the same route. Found by the
  // body's identity: DEF puts one body in DEFS and in its cell.
  "apply": x => { const f = at(x, 0); if (Array.isArray(f)) { const tw = twinOfBody(f); if (tw) return tw(at(x, 1)); } return Ev(f, at(x, 1)); },
  // lex yields TOKEN-RECORDS, ten fields per token, exactly as
  // metamodel/resolution.md types it. This head answered a flat word list, as
  // did the java, cs and rust hosts, so lambda's system: family — sqlname
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
  // to stringify for lambda to own a renderer at all: system:isnum is
  // not eq<x, implode<empty,<x>>>, and a base with NO operation total over
  // the atom domain leaves lambda unable to tell 42 from the text 42.
  // Sequences still refuse — only atoms are words.
  "implode": x => seq(at(x,1)).map(w => {
    if (Array.isArray(w)) throw new Error("implode on sequence");
    return "" + w; }).join(at(x,0)),
  // slug yields an IDENTIFIER (resolution.md): every run of non-alphanumerics
  // becomes ONE underscore and the ends are trimmed. Lambda defines the same
  // function as sl:slug; this registration stays only until both carriers are
  // regenerated and slug can leave the boundary manifest.
  // slug is LAMBDA -- DEF("slug") with slug:alnum/step/trimlead. Deleted here.
  // char-level lex boundary (invariant ASCII on every host, so the
  // naming lex is byte-identical regardless of host culture)
  "chars": x => { if (typeof x !== "string") throw new Error("chars on non-string");
    return [...x]; },
  // FIRST CHARACTER. This head used to compare the WHOLE string — x >= "a" &&
  // x <= "z" — which agrees for the single chars `chars` yields but not
  // otherwise: charup("zebra") answered "zebra" here and "Z" on the other
  // seven hosts, since python and the java/cs/rust hosts all take the
  // leading char. One operation, one meaning; this head was the outlier.
  // charup is LAMBDA -- literal alphabet relation (Codd 2.3.5). Deleted here.
  // chardown is LAMBDA -- literal alphabet relation (Codd 2.3.5). Deleted here.
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
  // store:append was deleted because lambda already carried ast:Store and
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
  // than lambda for the reason Def. 3 gives: lambda admits only a deterministic,
  // side-effect-free total function, and a key is neither -- it consumes
  // entropy and answers differently every call. Samuel, 2026-09-15, asked
  // whether this should be a lambda method; the system already has the category
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
  // AND THE KEY IS APPLIED HERE, NEVER HANDED OVER (2026-09-30). The compile seals every value the
  // readings store through a Function before it writes anything (compile:sealed), and sealing is
  // lambda's hook:write under the master key. The key is the platform's to hold -- core.md: it
  // "cannot live in the store it protects" -- so this registration applies hook:write with it and
  // answers only what hook:write made of the value, as the served path applies hook:read; lambda
  // never holds the key as a value it could print. crypt:keyed says whether there is a key at all,
  // which is what a compile needs to refuse by name instead of throwing.
  "hook:seal": x => {
    const key = process.env.AREST_MASTER_KEY;
    if (!key) throw new Error("hook:seal: there is no AREST_MASTER_KEY to store a value through a Function with");
    return Ev("hook:write", [key, at(x, 0), at(x, 1), at(x, 2)]);
  },
  "crypt:keyed": () => (process.env.AREST_MASTER_KEY ? "T" : "F"),
  // ---- THE COMPILER'S I/O, REGISTERED (#109) -------------------------------
  // Sam, 2026-09-20: "the full framework must be canon with registered DEFS".
  // compile.js read its directories and files, wrote the carrier and executed
  // the DDL in JavaScript -- the last host decisions left in the compile path
  // once read:file_order took the reading order (3360a782). They are REGISTERED
  // functions now, by the rule resolution.md:396 states: a host name lambda does
  // NOT define is registered; a host name lambda DOES define is a native twin
  // and stays compiled. Lambda defines no fs: or sql: cell and must not -- a
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
  // A CARRIER READ AS CELLS AND REGISTERED NOWHERE (2026-09-30). LAMBDATEXT is
  // the host's reader of intersection source, and it registers every entry it
  // reads, so reading the last compile's carriers with it would put the old
  // schema over the one this module holds. carrier:cells reads the same text
  // into the <CELL, name, body> list DEF would have pushed, and registers
  // nothing: the in-place compile reads a store through the schema that wrote it.
  "carrier:cells": x => {
    if (Array.isArray(x)) throw new Error("carrier:cells on a sequence");
    const cells = [];
    LAMBDATEXT(String(x), (name, body) => { cells.push(["CELL", name, body]); });
    return cells;
  },
  // AND THE SCRIPT IS ONE TRANSACTION (2026-09-29). db.exec runs each statement in its own, and
  // on Windows each is a sync to disk: support's 655 CREATE TABLEs were 1.3-1.5 s of its compile.
  // A schema script is all or nothing anyway; one that fails part way now leaves no table of it.
  //
  // AND IT IS THE ENGINE'S CALL, NOT LAMBDA'S (2026-09-29). Storage is an interface: lambda calls
  // storage:schema, and storage:resolve applies <storage:engine>:<operation>, so this host says which
  // engine it provides by registering storage:engine, and sqlite:exec is the one call that engine's
  // lambda implementation (sqlite:schema over rmap:ddl) makes. It was sql:exec, a name lambda called
  // directly, which is the coupling the interface removes.
  "storage:engine": () => "sqlite",
  "sqlite:exec": x => {
    const { Database } = require("bun:sqlite");
    const db = new Database(String(at(x, 0)), { create: true });
    try {
      db.exec("begin");
      try { db.exec(String(at(x, 1))); db.exec("commit"); }
      catch (e) { try { db.exec("rollback"); } catch { } throw e; }
    } finally { db.close(true); }
    return String(at(x, 0));
  },
  // AND WHAT THE COMPILE WRITES (2026-09-29). compile.js is deleted and the compile is lambda's
  // address now (compile:run), so the two things it still needs from a platform are registered
  // here beside the reads: a file written whole -- beside itself first and renamed in, so a reader
  // never meets half a carrier -- and the SHA-256 digest build.js checks the compiled carrier's
  // stamp against. <path, text> answers the path; a text answers its digest in hex.
  "fs:write": x => {
    const fs = require("node:fs"), path = String(at(x, 0)), text = at(x, 1);
    if (Array.isArray(text)) throw new Error("fs:write of a sequence");
    fs.writeFileSync(path + ".build", String(text));
    fs.renameSync(path + ".build", path);
    return path;
  },
  "crypt:digest": x => {
    if (Array.isArray(x)) throw new Error("crypt:digest on a sequence");
    return require("node:crypto").createHash("sha256").update(String(x), "utf8").digest("hex");
  },
  // AND THE STORE A COMPILE BUILDS (2026-09-30). storage:put, storage:meta, storage:fresh and
  // storage:install are lambda's interface, resolved to the sqlite engine's definitions, and these
  // are that engine's calls under them. sqlite:run executes one prepared statement per row in one
  // transaction -- bound parameters, never SQL text built from values (#96) -- with the mu's absence
  // marker # bound as NULL. sqlite:fresh clears the build file a failed compile left; sqlite:install
  // renames a fresh build into place and refuses over an existing store, which is changed in place
  // instead (compile:inplace, below) and put back with sqlite:replace.
  "sqlite:run": x => {
    const { Database } = require("bun:sqlite");
    const path = String(at(x, 0)), sql = String(at(x, 1)), rows = seq(at(x, 2));
    const db = new Database(path, { create: true });
    let n = 0;
    try {
      const st = db.prepare(sql);
      db.exec("begin");
      try {
        for (const r of rows) {
          const vals = seq(r).map((v) => {
            if (v === "#") return null;
            if (Array.isArray(v)) throw new Error("sqlite:run: a sequence where a value belongs in " + sql);
            return v;
          });
          // A REFUSED ROW SAYS WHICH ONE (2026-09-30): `UNIQUE constraint failed: Function.functionId`
          // names a table of nineteen thousand rows and no row; the first two values are the key of
          // every table the relational map lays out, so they are what finds it.
          try { st.run(...vals); }
          catch (e) { throw new Error(e.message + " -- row " + (n + 1) + " of " + rows.length + ", beginning " + JSON.stringify(vals.slice(0, 2)).slice(0, 120)); }
          n++;
        }
        db.exec("commit");
      } catch (e) { try { db.exec("rollback"); } catch { } throw e; }
    } finally { db.close(true); }
    return n;
  },
  "sqlite:fresh": x => {
    const fs = require("node:fs"), path = String(x);
    for (const p of [path, path + "-wal", path + "-shm", path + "-journal"]) { try { fs.rmSync(p, { force: true }); } catch { } }
    return path;
  },
  "sqlite:install": x => {
    const fs = require("node:fs"), build = String(at(x, 0)), path = String(at(x, 1));
    if (fs.existsSync(path)) throw new Error("sqlite:install refuses: " + path + " exists; a store that exists is changed in place (sqlite:replace), never overwritten by a fresh build");
    fs.renameSync(build, path);
    return path;
  },
  // AND A STORE CHANGED IN PLACE (2026-09-30). The in-place compile reads the store through
  // sqlite:query (a statement and its bound parameters, answering rows with NULL as #), works on a
  // consistent copy made by sqlite:copy (VACUUM INTO, which SQLite runs outside a transaction), and
  // puts the copy in the store's place with sqlite:replace, which keeps the store it replaces
  // beside it as <store>.prior -- one step back, never a loss.
  //
  // A VALUE IS ANSWERED AS ITS TEXT, which is how a start reads a store (loadStoreDb's String(v))
  // and how the compile spells what it writes (compile:cellval), so a row read here and the row
  // lambda projects for the same facts are one spelling. A column declared INTEGER hands back a
  // number, and answered as one the compile found two of the metamodel's tables moved when
  // nothing had.
  "sqlite:query": x => {
    const { Database } = require("bun:sqlite");
    const path = String(at(x, 0)), sql = String(at(x, 1)), params = seq(at(x, 2));
    const db = new Database(path, { readonly: true });
    try {
      return db.query(sql).values(...params).map((r) => r.map((v) => (v === null || v === undefined ? "#" : String(v))));
    } finally { db.close(true); }
  },
  "sqlite:copy": x => {
    const { Database } = require("bun:sqlite");
    const fs = require("node:fs"), from = String(at(x, 0)), to = String(at(x, 1));
    for (const p of [to, to + "-wal", to + "-shm", to + "-journal"]) { try { fs.rmSync(p, { force: true }); } catch { } }
    const db = new Database(from, { readonly: true });
    try { db.query("vacuum into ?").run(to); } finally { db.close(true); }
    return to;
  },
  "sqlite:replace": x => {
    const fs = require("node:fs"), build = String(at(x, 0)), path = String(at(x, 1));
    if (fs.existsSync(path)) {
      try { fs.rmSync(path + ".prior", { force: true }); } catch { }
      fs.renameSync(path, path + ".prior");
    }
    fs.renameSync(build, path);
    return path;
  },
  // WHERE THIS COMPOSITION'S LAMBDA CAME FROM, which build.js stamps (ROOTED below): a store records
  // the identity of the module that will read it -- its lambda, its scenarios and its carriers, the
  // bytes build.js hashes -- and the compile finds the first two here.
  "module:root": () => {
    if (MODULE_ROOT === null) throw new Error("module:root: this composition was made without its root");
    return MODULE_ROOT;
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
let MEMOW = 0;   // what the memo holds weighs this (memoWeight, below)
// Backus 13.3.4 defines fetch as a linear walk (`↑n∘tl:x`), and lambda's
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
// rmap:proj_row's column plans, by the column list they were made for (see projRow)
let PROJPLAN = new WeakMap();
// A SERVER GIVES ITS MEMO BACK WHEN IT GOES IDLE (2026-09-24; Sam: "low memory
// footprint is a requirement"). The memo earns its keep inside a burst of calls and
// holds most of a server's memory after one: on support.auto.dev a `get` left 19,245
// answers under 44 names (rmap:unnest, rmap:keep_nonkey, rmap:rel_cell and the rest
// of the relational map a GET walks), each name under MEMO_HELD and MEMO_JUDGED, so
// neither bound ever let them go, and the live heap after a full collection was 744
// MB where the same calls without the memo left 130. So every answer written schedules
// a release AREST_MEMO_IDLE_MS (5 s) later, a later answer pushes it back, and the
// release clears the memo -- not the identity-keyed indexes, which stay true while
// their values live and cost most of a report's first ten seconds to rebuild -- and
// collects. MEASURED over a copy of support's store, one server at a time, the same
// five calls (actions, get, a fact GET, get, actions), twice each, alternated, then
// 9 s idle:
//   memo kept           resident 930-976 MB, private 1,307-1,327; second get 254-433 ms
//   released per call   resident 370-392,    private 913-954;     second get 1,257-1,584
//   released when idle  resident 388-473,    private 930-968;     second get 276-410
// so a burst keeps its speed and an idle server gives back about half a gigabyte.
let MEMO_IDLE = null;
function memoReleaseWhenIdle(say) {
  if (MEMO_IDLE) clearTimeout(MEMO_IDLE);
  MEMO_IDLE = setTimeout(() => {
    MEMO_IDLE = null;
    let names = 0, held = 0;
    for (const node of EVMEMO.values()) { names++; held += (node && node.held) || 0; }
    memoEmpty();
    if (typeof Bun !== "undefined" && Bun.gc) Bun.gc(true);
    if (say && names) say("memo released: " + held + " answer(s) under " + names + " name(s)");
  }, Number(process.env.AREST_MEMO_IDLE_MS || 5000));
  if (MEMO_IDLE.unref) MEMO_IDLE.unref();
}
function memoClear() { memoEmpty(); ORHEADS = new WeakMap(); ORROWS = new WeakMap(); DESCIDX = new WeakMap(); ENTIDX = new WeakMap(); JOINIDX = new WeakMap(); FETCHIDX = new WeakMap(); MATCHIDX = new WeakMap(); MATCHPROV = new WeakMap(); KEYIDX = new WeakMap(); KEYPROV = new WeakMap(); MEMBIDX = new WeakMap(); PAIRIDX = new WeakMap(); SOLVEIDX = new WeakMap(); MPIDX = new WeakMap(); SLOTIDX = new WeakMap(); PROJPLAN = new WeakMap(); }
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
// lambda's JSON text (render:json, quote_str), one pass -- see the twins
function jsonQuote(s) {
  let out = '"';
  for (const c of s) out += c === "\\" ? "\\\\" : c === '"' ? '\\"' : c === "\n" ? "\\n" : c === "\r" ? "\\r" : c < " " ? jsonCtl(c) : c;
  return out + '"';
}
// quote_str:ctl's table: a tab, backspace and form feed by their letters, any
// other control character as \u and four lowercase hex digits
function jsonCtl(c) {
  return c === "\t" ? "\\t" : c === "\b" ? "\\b" : c === "\f" ? "\\f" : "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
}
function jsonText(x) {
  if (decShape(x)) return Ev("dec:text", x);
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
// ONE INDEX PER APPEND CHAIN, NOT PER ARRAY (2026-09-28). The reader's fold appends a record per
// landed sentence and asks csdp:matches of the population index after each: a new array, a new
// identity, a new index every time -- on tasks' closure 1,193 rebuilds over lists growing one entry
// at a time from 690 to 1,908 (1,178 of 1,192 consecutive rebuilds exactly +1), 1.55 million rows
// keyed to answer 3,344 asks. apndr and cat remember what they joined (CATPROV) when the left side
// is indexed, so an array made by appending to the newest array of a chain extends that chain's
// index in place, and every array of the chain answers only the positions below its own length --
// an older, shorter array still answers exactly its own rows. A second append to an array that is
// no longer the chain's newest is a branch, and indexes afresh. A row that is an atom or empty
// raises the selector error before anything is indexed, as the full build raised it.
// b begins with a (by code points, as read:isprefix over chars compares them) and the rest of b is all
// digits (charisdigit on each code point, as read:rule_isdigits asks): <the rest, joined>, else PHI
function ruleSuffix(a, b) {
  const ac = [...a], bc = [...b];
  if (ac.length > bc.length) return [];
  for (let k = 0; k < ac.length; k++) if (ac[k] !== bc[k]) return [];
  const rest = bc.slice(ac.length);
  for (const ch of rest) if (!(ch >= "0" && ch <= "9")) return [];
  return [rest.join("")];
}
let PARSEDB = null, PARSEDBPATH = null;
function parseCacheDb() {
  const want = process.env.AREST_PARSE_CACHE || require("node:path").join(require("node:os").tmpdir(), "arest-cache", "parse.db");
  if (PARSEDB && PARSEDBPATH === want) return PARSEDB;
  try {
    require("node:fs").mkdirSync(require("node:path").dirname(want), { recursive: true });
    const { Database } = require("bun:sqlite");
    const db = new Database(want, { create: true });
    db.exec("pragma journal_mode = wal"); db.exec("pragma busy_timeout = 5000");
    db.exec("create table if not exists rows (k text primary key, v text not null)");
    db.exec("create table if not exists folds (k text primary key, v blob not null, t integer not null)");
    PARSEDB = db; PARSEDBPATH = want; return db;
  } catch { return null; }
}
// THE FOLD IS KEPT AT ITS CHECKPOINTS (2026-09-29). read:parse is COMP(post, mid, WHILE, init): init lays the rows
// out in fold order -- the type declarations, the subtypes, the readings and constraints, the instance sentences,
// the objectifications -- and the WHILE lands them one at a time, each step reading the row in front of it and
// the state the rows before it left, and nothing else. So the state after the first b rows is a function of the
// initial state and those b rows, and the WHILE run over the rows a chunk at a time IS the WHILE run over the
// rows. This twin runs it so, and keeps the state at a few chunk boundaries, keyed by the module's composition,
// the strict cell, the initial state and every row folded to there, in the cache the files' rows are kept in; a
// parse starts from the last boundary it finds kept. An app's own instance sentences are the last its fold
// lands, so a readings change that only moves them -- the everyday one -- folds a few hundred rows where it
// folded eleven thousand. MEASURED on support.auto.dev's closure: 10,724 rows in fold order, 5,172 before the
// first instance sentence and 457 of the 5,543 instances its own; the whole fold 4.0 s, the state at its end
// 2.1 MB as JSON. The boundaries kept are spaced wider the further they are from the end (every one of the
// last two, then every second, fourth, eighth ... on multiples, so they stay where they were as the rows grow),
// and each is kept deflated. The DEF is the meaning: an unstamped module, AREST_PARSE_CACHE=off, a read:parse
// of another shape, and a state JSON would not carry back (a value no atom or number) are all the DEF's.
const FOLDCHUNK = 256;
let FOLDLAST = null;
function foldKeptAt(b, B) { const d = B - b; let s = 1; while (s * 2 <= d) s *= 2; return b > 0 && b < B && b % s === 0; }
function jsonCarries(v) {
  if (typeof v === "string") return true;
  if (typeof v === "number") return Number.isFinite(v) && !Object.is(v, -0);
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) if (!jsonCarries(v[i])) return false;
  return true;
}
function parseFoldKept(x) {
  const P = DEFS.get("read:parse");
  const def = () => Ev(P, x);
  FOLDLAST = null;
  if (process.env.AREST_PARSE_CACHE === "off" || !COMPOSITION) return def();
  if (!Array.isArray(P) || P.length !== 5 || P[0] !== "COMP" || !Array.isArray(P[3]) || P[3][0] !== "WHILE") return def();
  const db = parseCacheDb();
  if (db === null) return def();
  const post = P[1], mid = P[2], loop = P[3], init = P[4];
  const s0 = Ev(init, x);
  if (!Array.isArray(s0) || s0.length !== 5 || !Array.isArray(s0[2])) return def();
  const rows = s0[2], B = Math.ceil(rows.length / FOLDCHUNK);
  const crypto = require("node:crypto"), zlib = require("node:zlib");
  const keys = [crypto.createHash("sha256").update(JSON.stringify([COMPOSITION, DEFS.get("read:strict") || null, s0[0], s0[1], s0[3], s0[4]])).digest("hex")];
  for (let b = 1; b <= B; b++) keys.push(crypto.createHash("sha256").update(keys[b - 1]).update(JSON.stringify(rows.slice((b - 1) * FOLDCHUNK, b * FOLDCHUNK))).digest("hex"));
  let s = [s0[0], s0[1], [], s0[3], s0[4]], from = 0;
  try {
    const q = db.query("select v from folds where k = ?");
    for (let b = B - 1; b >= 1; b--) {
      const hit = q.get(keys[b]);
      if (!hit) continue;
      const st = JSON.parse(zlib.inflateSync(hit.v).toString("utf8"));
      if (Array.isArray(st) && st.length === 4) { s = [st[0], st[1], [], st[2], st[3]]; from = b; }
      break;
    }
  } catch { s = [s0[0], s0[1], [], s0[3], s0[4]]; from = 0; }
  const put = [];
  for (let b = from + 1; b <= B; b++) {
    s = Ev(loop, [s[0], s[1], rows.slice((b - 1) * FOLDCHUNK, b * FOLDCHUNK), s[3], s[4]]);
    if (!Array.isArray(s) || s.length !== 5) return def();
    if (foldKeptAt(b, B)) { const st = [s[0], s[1], s[3], s[4]]; if (jsonCarries(st)) put.push([keys[b], JSON.stringify(st)]); }
  }
  const out = Ev(post, Ev(mid, s));
  FOLDLAST = { rows: rows.length, kept: Math.min(from * FOLDCHUNK, rows.length) };
  try {
    const now = Date.now();
    const add = db.query("insert or ignore into folds (k, v, t) values (?, ?, ?)");
    for (const [k, t] of put) add.run(k, zlib.deflateSync(Buffer.from(t, "utf8"), { level: 1 }), now);
    if (from > 0) db.query("update folds set t = ? where k = ?").run(now, keys[from]);
    db.query("delete from folds where t < ?").run(now - 30 * 86400000);   // a month unused
    db.query("delete from folds where k not in (select k from folds order by t desc limit 256)").run();   // and the newest 256 at most
  } catch { }
  return out;
}
function parseCached(x) {
  const def = () => Ev(DEFS.get("compile:text_rows"), x);
  if (process.env.AREST_PARSE_CACHE === "off" || !COMPOSITION) return def();
  if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "string" || typeof x[1] !== "string") return def();
  if (x[0] === ".env" || x[0].endsWith("/.env") || x[0].endsWith(".env")) return def();
  const db = parseCacheDb();
  if (db === null) return def();
  const key = require("node:crypto").createHash("sha256").update(JSON.stringify([COMPOSITION, DEFS.get("read:strict") || null, x[0], x[1]])).digest("hex");
  let hit = null;
  try { hit = db.query("select v from rows where k = ?").get(key); } catch { hit = null; }
  if (hit) return JSON.parse(hit.v);
  const v = def();
  try { db.query("insert or replace into rows (k, v) values (?, ?)").run(key, JSON.stringify(v)); } catch { }
  return v;
}
function matchAdd(ln, rows, from) {
  for (let i = from; i < rows.length; i++) { const r = rows[i];
    if (!Array.isArray(r)) throw new Error("selector 1 on atom: " + show(r));
    if (r.length < 1) throw new Error("selector 1 out of range 0"); }
  for (let i = from; i < rows.length; i++) { const r = rows[i], k = keyOf(r[0]);
    let a = ln.idx.get(k); if (a === undefined) { a = { rows: [], pos: [] }; ln.idx.set(k, a); }
    a.rows.push(r); a.pos.push(i); }
  ln.len = rows.length;
}
// out = p ++ (n elements): the chain out extends is p's own, or the one p was itself about to
// extend, and what is kept is that chain and the length it had reached -- never p, so an append
// chain does not keep every copy it made alive the way a remembered [p, s] would.
let MATCHPROV = new WeakMap();
function matchProv(out, p, n) {
  const ml = MATCHIDX.get(p);
  if (ml !== undefined) { MATCHPROV.set(out, [ml, p.length]); return; }
  const pp = MATCHPROV.get(p);
  if (pp !== undefined) MATCHPROV.set(out, pp);
}
// WHETHER SOME ROW IS KEYED k, kept along the fold (read:has_key, 2026-09-28). Each key keeps its FIRST
// position, and an array answers only positions below its own length, so an older, shorter array still
// answers for itself. It follows what matchRows follows -- an array appended to the newest of its chain --
// and one thing more: read:put_row's twin replaces a record in place and keeps its key where it was, so the
// array it makes shares the index of the array it came from. A row that is an atom or empty is the DEF's.
let KEYIDX = new WeakMap(), KEYPROV = new WeakMap();
function keyProv(out, p) {
  const kl = KEYIDX.get(p);
  if (kl !== undefined) { KEYPROV.set(out, [kl, p.length]); return; }
  const pp = KEYPROV.get(p);
  if (pp !== undefined) KEYPROV.set(out, pp);
}
function keySame(out, p) {
  const kl = KEYIDX.get(p);
  if (kl !== undefined) { KEYIDX.set(out, kl); return; }
  const pp = KEYPROV.get(p);
  if (pp !== undefined) KEYPROV.set(out, pp);
}
function keyAdd(ln, rows, from) {
  for (let i = from; i < rows.length; i++) { const r = rows[i]; if (!Array.isArray(r) || r.length < 1) return false; }
  for (let i = from; i < rows.length; i++) { const k = keyOf(rows[i][0]); if (!ln.first.has(k)) ln.first.set(k, i); }
  ln.len = rows.length;
  return true;
}
function hasKey(key, rows) {
  let ln = KEYIDX.get(rows);
  if (ln === undefined) {
    const prov = KEYPROV.get(rows), pl = prov === undefined ? undefined : prov[0];
    if (pl !== undefined && pl.len === prov[1] && prov[1] <= rows.length) { if (!keyAdd(pl, rows, prov[1])) return undefined; ln = pl; }
    else { const fresh = { first: new Map(), len: 0 }; if (!keyAdd(fresh, rows, 0)) return undefined; ln = fresh; }
    KEYIDX.set(rows, ln);
  }
  const pos = ln.first.get(keyOf(key));
  return pos !== undefined && pos < rows.length;
}
function matchRows(key, rows) {
  let ln = MATCHIDX.get(rows);
  if (ln === undefined) {
    const prov = MATCHPROV.get(rows), pl = prov === undefined ? undefined : prov[0];
    if (pl !== undefined && pl.len === prov[1] && prov[1] <= rows.length) { matchAdd(pl, rows, prov[1]); ln = pl; }
    else { const fresh = { idx: new Map(), len: 0 }; matchAdd(fresh, rows, 0); ln = fresh; }
    MATCHIDX.set(rows, ln);
  }
  const hit = ln.idx.get(keyOf(key));
  if (hit === undefined) return [];
  let n = hit.pos.length;
  if (hit.pos[n - 1] < rows.length) return hit.rows;
  while (n > 0 && hit.pos[n - 1] >= rows.length) n--;
  return hit.rows.slice(0, n);
}
// the same, on an arbitrary column. csdp:matches indexes column 1 and ONLY
// column 1, which is why the joins that cost the most were invisible to it:
// rmap:uniqs:derive scans rmap:childrenN once per rmap:ucrows row keeping the
// children whose SECOND column matches, 3784 x 2255 pairs on eu-law, and that
// one scan is the whole 44 s the definition costs. Fourteen sites in lambda key
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
// THE ROW OF AN ENTITY TABLE, A COLUMN AT A TIME (2026-09-29). rmap:proj_row asks rmap:proj_val of
// every column for one key, and proj_val walks the column's path from that key: the path's first
// non-assim step, the step's fact type, the fact type's population, the key's position in it, then
// the lookup. All of it but the lookup is the COLUMN's, the same for every row -- and support's
// Function table is 34,547 rows by 313 columns, 10.8 million walks for the 141,260 cells that hold
// anything: 17.7 of the 19 seconds its closure's write-back took (2026-09-29). So a column's part is
// asked of lambda once, of the DEFs proj_val asks it of (rmap:proj_nonassim, rmap:proj_pop,
// rmap:proj_keypos), and kept by the column list rmap:proj_cols answered; a row is then one index
// lookup per column (csdp:matches_at's own index), and a value found is walked on through
// rmap:proj_walk as the DEF walks it. A column is one of: # always; the key itself (an info step
// naming no fact type -- a value type's own column); the key unless it is # (an identifying step
// over an empty population); or the other player of the first row holding the key at the key's
// position, T when the row has one player, # when no row does. A shape the DEF raises on or might
// read otherwise -- an atom where a step goes, a step shorter than the selector the DEF applies, a
// row the index cannot key, a key position that is not a number -- is the DEF's, whole row.
// AND WHAT A COLUMN'S PLAN IS MADE OF OUTLIVES THE WRITE THAT DID NOT MOVE IT (2026-10-07, task #143). A plan was
// kept by the column list and the store, and a write makes a new store and memoClear a new column list, so every
// write planned all 313 of Function's columns again to project the one row it moved: 250 to 500 ms of a status
// write on a copy of support's store (2026-10-05). But a column's plan reads three things, and each is kept here by
// exactly what it reads. rmap:proj_nonassim is a function of the column's path alone, kept by the path's text.
// rmap:proj_keypos <step, store> reads the store only through solve:declared, the state:declared cell unfolded, so
// it is kept by the step's text under that cell's value -- the object every store after a write shares while the
// write declares nothing, and a new object, with nothing kept for it, when it does (popsMoved reads the same
// cell the same way). The population is asked of the store each time, and rmap:proj_pop is one index lookup
// (rmap:proj_hits's twin); a population the write did not move is the same array, so the index csdp:matches_at
// keeps of it (MATCHATIDX, by the array's identity) is the one the last write built. Nothing here holds a store
// or a population: what is kept is the schema's own steps and key positions, a few per column, and it goes when
// the declared cell goes. The write's row planner and its touched-table test read the same two through it.
// AREST_NOTWIN=rmap:proj_row gives the DEF's own row.
const PLANOF = new WeakMap();
function planInputs(store) {
  let d;
  try { d = Ev("solve:cell", ["state:declared", store]); } catch { return null; }
  if (!Array.isArray(d) || d.length === 0) return null;
  let held = PLANOF.get(d);
  if (held === undefined) { held = { paths: new Map(), steps: new Map() }; PLANOF.set(d, held); }
  return held;
}
// rmap:proj_nonassim of a path and rmap:proj_keypos of a step, as the DEFs answer them, kept in `held` when there
// is one; a DEF that raises raises here and nothing is kept
function nonAssim(path, held) {
  if (!held) return Ev("rmap:proj_nonassim", path);
  const k = JSON.stringify(path);
  let na = held.paths.get(k);
  if (na === undefined) { na = Ev("rmap:proj_nonassim", path); held.paths.set(k, na); }
  return na;
}
function keyPos(st, store, held) {
  if (!held) return Ev("rmap:proj_keypos", [st, store]);
  const k = JSON.stringify(st);
  let kp = held.steps.get(k);
  if (kp === undefined) { kp = Ev("rmap:proj_keypos", [st, store]); held.steps.set(k, kp); }
  return kp;
}
function projColPlan(path, store, held) {
  const na = nonAssim(path, held);
  if (!Array.isArray(na)) return null;
  if (na.length === 0) return { kind: 0 };
  const s1 = na[0];
  if (!Array.isArray(s1) || s1.length < 5 || !Array.isArray(s1[4])) return null;
  const rest = na.length > 1 ? na.slice(1) : null;
  if (s1[4].length === 0) return { kind: s1[0] === "info" ? 1 : 0 };
  const pop = Ev("rmap:proj_pop", [s1[4][0], store]);
  if (!Array.isArray(pop)) return null;
  if (pop.length === 0) {
    if (s1.length < 6) return null;
    return s1[5] === "T" ? { kind: 2, rest } : { kind: 0 };
  }
  const kp = keyPos(s1, store, held);
  if (typeof kp !== "number") return null;
  matchRowsAt(kp, "", pop);   // the index csdp:matches_at keeps, built here, raising where the DEF raises
  return { kind: 3, idx: MATCHATIDX.get(pop).get(kp), other: kp === 1 ? 1 : 0, rest };
}
function projPlans(cols, store) {
  const kept = PROJPLAN.get(cols);
  if (kept !== undefined && kept.store === store) return kept.plans;
  const plans = [], held = planInputs(store);
  for (const c of cols) {
    if (!Array.isArray(c) || c.length < 3) return null;
    const p = projColPlan(c[2], store, held);
    if (p === null) return null;
    plans.push(p);
  }
  PROJPLAN.set(cols, { store, plans });
  return plans;
}
function projRow(x) {
  const def = () => Ev(DEFS.get("rmap:proj_row"), x);
  if (!Array.isArray(x) || x.length < 3) return def();
  const k = x[0], store = x[2];
  const cols = Ev("rmap:proj_cols", [x[1], store]);
  if (!Array.isArray(cols)) return def();
  let plans;
  try { plans = projPlans(cols, store); } catch { plans = null; }
  if (plans === null) return def();
  const kk = keyOf(k);
  const out = new Array(plans.length);
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    if (p.kind === 0) { out[i] = "#"; continue; }
    // a value type's own column is its key, as value:text gives it in the DEF: a decimal as its lexeme
    if (p.kind === 1) { out[i] = decShape(k) ? Ev("dec:text", k) : k; continue; }
    let v = k;
    if (p.kind === 3) {
      const hit = p.idx.get(kk);
      if (hit === undefined) { out[i] = "#"; continue; }
      v = hit[0].length === 1 ? "T" : hit[0][p.other];
    }
    out[i] = v === "#" ? "#" : p.rest === null ? v : Ev("rmap:proj_walk", [p.rest, v, store]);
    if (decShape(out[i])) out[i] = Ev("dec:text", out[i]);
  }
  return out;
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
// Both are memoised, not rewritten: lambda keeps the meaning, the head stops
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
// system:cellrows is one design-state cell's rows, unfolded, and the empty
// arm of system:pop_rows asks for three of them (state:ucs, state:declared,
// state:refmodes) on every fact type whose population is empty -- 201 of the
// base's 262 descriptors. A fresh list per ask is a fresh solve:assoc index
// per ask, which is the ui:otpops case exactly: the walk over those 262 cost
// 106 ms unmemoised against 4 ms at HEAD, and 4 ms memoised (2026-09-21).
const MEMOCN = new Set(["system:cellrows", "ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor",
  "cn:sfx", "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts",
  "cn:chrank", "lex:lw", "induce:sig_of", "system:pop_in", "store:fts",
  // ui:otpops is the object-type populations of a store, and mcp:tools the
  // fact-type table of one: a write's validation asks each once per mandatory
  // role of every fact type over the store it is validating, and a fresh list
  // per ask meant a fresh index per ask (the profile-and-fix loop, 2026-09-07)
  "ui:otpops", "mcp:tools",
  // ui:cls_rows is the classification population ui:ids is a view of, and
  // ui:typed_types the value types whose instances it holds typed (task #172 f,
  // 2026-10-07): each one list per store, so csdp:matches_at's index, kept by
  // the population list itself, is built once per population and every ui:ids
  // after the first is a lookup
  "ui:cls_rows", "ui:typed_types",
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
  // read:schema asks for it TWICE: once as the cell `state:rules`, and
  // once inside `state:undelivered`, which subtracts the heads it delivered
  // from the heads state:derived marks. The two are the same call on the same
  // value -- read:schema applies every cell to one x -- so the second
  // was the first recomputed, arm for arm (the base metamodel, 2026-09-16:
  // read:rule_rows entered under state:rules and again under
  // state:undelivered). Memoised on that argument's identity, the rows are
  // the same rows: lambda is pure and the two cells are unchanged.
  "read:state_rules",
  // read:rule_pw is the rules compiler's tokenizer -- lex:qparts, whole -- and its
  // seventeen arms call it through nineteen DEFs to tokenize an OBJECT TYPE NAME or a
  // fixed phrase at the moment each arm tries one: read:rule_last_j alone tests every
  // name, longest first, four ways against both clauses of every rule it is handed.
  // Measured on tasks' closure (2,470 sentences, 2026-09-28): 56,945 calls over a few
  // hundred distinct names, 19.3 of the 34.3 s the profiler charged to state:rules,
  // itself 90% of read:schema. A name has one tokenization; the vocabulary is
  // tokenized once and every later arm reads it (Sam, 2026-09-28: "parsing has to
  // work ... objects and object types first"). Keyed on the string, it is the
  // same token list: lambda is pure. lex:qparts itself is NOT memoised, because
  // read:tokens_of hands it every sentence once and none twice.
  "read:rule_pw",
  // read:implied_nests is the objectifications a parse implies, over EVERY record, and
  // read:nested_names asks it three times per fact record -- read:fact_groups once and
  // read:fact_row twice, all on the same parse state -- each time scanning every record
  // against the nest names: 5,933,274 theta:member calls on support's closure, 13% of its
  // parse (sampled, 2026-09-28). The parse state is one value, so its implied nests are one
  // value: memoised on that argument, as read:state_rules is.
  "read:implied_nests",
  // read:nested_names is the nest names beside the implied ones, a cat made afresh at every ask -- and
  // read:fact_groups and read:fact_row ask it per fact record, then test membership in it, so
  // theta:member indexed a new 456-element list 3,545 times on support's closure (2026-09-28). The same
  // parse state has the same nested names: memoised, the list and its index are one.
  "read:nested_names",
  // reflect:eldomain is the design state's <element, domain> pairs unfolded, and reflect:dom_of asks it
  // once per Function id to find that id's domain -- through solve:assoc, whose index is kept by the
  // array's identity. rmap:unfold4 under it is memoable but is judged bare on a compile's other
  // cells, so every ask unfolded a new list and indexed it afresh: solve:assoc was 74% of the
  // closure's reflection on support's store, 44 of its 65 sampled seconds (2026-09-29). The cells
  // are one value between memoClears, so their pairs are one list and its index one index.
  "reflect:eldomain",
  // main:status_pop folds every machine of a noun through its fired transitions, and four reflections ask it
  // on the same <cells, noun>: reflect:machines, reflect:msmd, reflect:mstatus and reflect:otistatus each fold
  // every noun's machines again to read one column of the answer. Measured on support's closed store
  // (2026-09-29), the memo cleared before each: 244, 245, 236 and 221 ms, and reflect:cells 1,534 ms cold,
  // the four folds and not one -- and the closure takes the reflection three times. The cells are one value
  // between memoClears, so a noun's machines are one fold.
  "main:status_pop",
  // and reflect:constraints is every constraint the design state declares with its roles resolved, which
  // reflect:constraint_types and reflect:modalities each read one column of, and reflect:records under
  // reflect:spans, reflect:span_seqs and reflect:span_positions three more: five computations of one list
  // and three of its span records per reflection, 39 to 69 ms each alone on support's closed store.
  "reflect:constraints", "reflect:records"]);
function memoable(f) { return MEMOCN.has(f) || f.startsWith("rmap:") || f.startsWith("state:"); }
// Compiled forms of hot lambda list cells (the lex-primitive precedent:
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
// ...and it is kept along the fold since 2026-09-28, where the rebuild had become 8% of support's parse: each
// name keeps its FIRST supertype and that row's position, an array answers only the positions below its
// length, an appended array extends its chain's index (apndr and cat record SUPERPROV), and read:put_row --
// which only ever replaces a record whose fifth field is a population, never a subtype row -- shares it.
const SUPERPROV = new WeakMap();
function superValid(row) {
  return Array.isArray(row) && row.length >= 5 && Array.isArray(row[1]) && Array.isArray(row[4]) && row[4].length >= 1
    && !(row[4][0] === "derived" && row[4].length < 2);
}
function superAdd(ln, rows, from) {
  for (let i = from; i < rows.length; i++) if (!superValid(rows[i])) return false;
  for (let i = from; i < rows.length; i++) { const row = rows[i], players = row[1], f5 = row[4];
    const sub = f5[0] === "subtype" || (f5[0] === "derived" && f5[1] === "subtype");
    if (!sub || players.length !== 2) continue;
    if (!ln.map.has(players[0])) ln.map.set(players[0], [players[1], i]); }
  ln.len = rows.length;
  return true;
}
function superLine(rows) {
  let ln = SUPEROF.get(rows);
  if (ln !== undefined) return ln;
  const prov = SUPERPROV.get(rows), pl = prov === undefined ? undefined : prov[0];
  if (pl !== undefined && pl.len === prov[1] && prov[1] <= rows.length) { if (!superAdd(pl, rows, prov[1])) return undefined; ln = pl; }
  else { ln = { map: new Map(), len: 0 }; if (!superAdd(ln, rows, 0)) return undefined; }
  SUPEROF.set(rows, ln);
  return ln;
}
function superProv(out, p) {
  const sl = SUPEROF.get(p);
  if (sl !== undefined) { SUPERPROV.set(out, [sl, p.length]); return; }
  const pp = SUPERPROV.get(p);
  if (pp !== undefined) SUPERPROV.set(out, pp);
}
function superSame(out, p) {
  const sl = SUPEROF.get(p);
  if (sl !== undefined) { SUPEROF.set(out, sl); return; }
  const pp = SUPERPROV.get(p);
  if (pp !== undefined) SUPERPROV.set(out, pp);
}
// the paths arrays rmap:unproj_live has checked, by identity (its twin, below)
const LIVEPATHS = new WeakSet();
// A TABLE'S ROWS READ BACK AS FACTS, EACH COLUMN DECIDED ONCE (2026-09-29). rmap:unproj hands every row to
// rmap:unproj_rowpairs and every filled cell of it to rmap:unproj_cell, whose tests -- the fact type the column
// carries (rmap:proj_carried), whether the column is a key column, whether that fact type is a role link
// (IsInvolved), its arity, and the key's position in it -- are all the COLUMN's and none of them the row's. On
// support's Function table, 34,547 rows by 313 columns, lambda was asked them for each of its 141,260 filled
// cells, and that one table was 584 of the store load's 1,256 unproj milliseconds. So a column is decided the
// first time a row fills it, by the same DEFs in the same order, and the decision is kept with the table's ctx;
// a row is then its key's values and, column by column, the fact its column makes of the value: none; the key
// alone when the fact type is unary and the value is T; else the key with the value before it (the key at
// position 2) or after it. A relation table's row is first the relation's own fact, its role columns' values
// as rmap:unproj_relpairs selects them. The DEF is the meaning: a shape it would raise on or read otherwise --
// an argument or a row that is not a sequence, a value that is not an atom, a column whose decision raises, a
// role column that is no position in the row -- is the DEF's, the whole table.
// THE PREFERRED UNIQUENESS THAT HOLDS A FACT, FOUND IN AN INDEX (2026-09-29). cn:ucfacts <fact, ucs> is the first
// uniqueness in ucs that is preferred (its second field T) and holds the fact (the first field of one of its
// fourth field's rows), answered as that uniqueness's rows' first fields, else PHI. The DEF builds every
// uniqueness's list of facts and tests the fact against it, for every uniqueness on every ask, and cn:smeta asks
// it per column step: on support.auto.dev's closure that was 94,620,620 theta:member calls, 93% of rmap:colnames
// and 45 of the relational map's 50 seconds. A ucs list is indexed once, by its identity, from each fact to the
// first preferred uniqueness holding it, keyed as theta:member's own index keys (keyOf equal iff deepEq). A list
// the DEF raises on -- a uniqueness short of four fields, a fourth field that is not a sequence, a row of it that
// is not a sequence with a first field -- is the DEF's.
const UCFACTS = new WeakMap();
function ucFacts(x) {
  const def = () => Ev(DEFS.get("cn:ucfacts"), x);
  if (!Array.isArray(x) || x.length < 2 || !Array.isArray(x[1])) return def();
  const ucs = x[1];
  let ix = UCFACTS.get(ucs);
  if (ix === undefined) {
    ix = new Map();
    for (let i = 0; i < ucs.length && ix !== null; i++) {
      const uc = ucs[i];
      if (!Array.isArray(uc) || uc.length < 4 || !Array.isArray(uc[3])) { ix = null; break; }
      for (const r of uc[3]) if (!Array.isArray(r) || r.length < 1) { ix = null; break; }
      if (ix === null || uc[1] !== "T") continue;
      for (const r of uc[3]) { const k = keyOf(r[0]); if (!ix.has(k)) ix.set(k, i); }
    }
    UCFACTS.set(ucs, ix);
  }
  if (ix === null) return def();
  const i = ix.get(keyOf(x[0]));
  return i === undefined ? [] : ucs[i][3].map((r) => r[0]);
}
// A VALUE ENTERS IN ITS TYPE (2026-09-29): value:typed_pairs, value:typed_insts and value:as_int, for the two
// twins below. The kinds are lambda's, asked once per fact type (value:ft_kinds) or once per call
// (value:int_types); what is done here is only the fold read:kind_number does, digit by digit, for a lexeme
// short enough that no step leaves the safe integers, and the DEF's own answer for any longer one.
function asIntValue(v) {
  if (typeof v !== "string") return v;
  const neg = v.charCodeAt(0) === 45, start = neg ? 1 : 0;
  if (v.length === start) return v;
  if (v.length - start > 15) return Ev("value:as_int", v);
  let acc = 0;
  for (let i = start; i < v.length; i++) { const d = v.charCodeAt(i) - 48; if (d < 0 || d > 9) return v; acc = acc * 10 + d; }
  return neg ? 0 - acc : acc;
}
// dec:is, as the twins ask it: three fields, the tag decimal and two numbers
function decShape(v) {
  return Array.isArray(v) && v.length === 3 && v[0] === "decimal" && typeof v[1] === "number" && typeof v[2] === "number";
}
// value:as_kind: an integer folded here as read:kind_number folds it, a decimal by lambda's own value:as_dec
function asKindValue(kind, v) {
  return kind === "integer" ? asIntValue(v) : kind === "decimal" ? Ev("value:as_dec", v) : v;
}
function typedRowValue(row, kinds) {
  if (!Array.isArray(row) || !Array.isArray(kinds) || row.length === 0 || row.length !== kinds.length) return row;
  return row.map((v, i) => asKindValue(kinds[i], v));
}
function typedPairsValue(pairs, store) {
  const kinds = new Map();
  return pairs.map((p) => {
    const k = JSON.stringify(p[0]);
    let ks = kinds.get(k);
    if (ks === undefined) { ks = Ev("value:ft_kinds", [p[0], store]); kinds.set(k, ks); }
    return [p[0], typedRowValue(p[1], ks)];
  });
}
const UNPROJPLAN = new WeakMap();
function unprojAll(x) {
  const def = () => Ev(DEFS.get("rmap:unproj"), x);
  if (!Array.isArray(x) || x.length < 3 || !Array.isArray(x[1])) return def();
  const rows = x[1];
  let ctx;
  try { ctx = Ev("rmap:unproj_ctx", [x[0], x[2]]); } catch { return def(); }
  if (!Array.isArray(ctx) || ctx.length < 6 || !Array.isArray(ctx[1]) || !Array.isArray(ctx[2]) || !Array.isArray(ctx[5])) return def();
  let plan = UNPROJPLAN.get(ctx);
  if (plan === undefined) {
    const paths = ctx[1], pk = ctx[2], rolecols = ctx[5];
    for (const p of paths) if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== "string") return def();
    for (const k of pk) if (typeof k !== "string") return def();
    const rel = ctx[3] === "T";
    if (rel) for (const rc of rolecols) if (typeof rc !== "number" || !Number.isInteger(rc) || rc < 0) return def();
    const keyAt = [];
    for (let i = 0; i < paths.length; i++) if (pk.includes(paths[i][0])) keyAt.push(i);
    plan = { rel, keyAt, cols: new Array(paths.length) };
    UNPROJPLAN.set(ctx, plan);
  }
  const table = ctx[0], paths = ctx[1], pk = ctx[2], store = ctx[4], rolecols = ctx[5];
  // the columns no cell reads a fact from: the key and a foreign key's components beside its reference (rmap:unproj_skip)
  const skip = Array.isArray(ctx[6]) ? ctx[6] : pk;
  for (const k of skip) if (typeof k !== "string") return def();
  const colOf = (i) => {
    let c = plan.cols[i];
    if (c !== undefined) return c;
    const path = paths[i][1];
    const ft = Ev("rmap:proj_carried", path);
    if (ft === "#" || skip.includes(paths[i][0]) || Ev("cn:contains", [ft, "IsInvolved"]) === "T") c = { kind: 0 };
    else if (Ev("length", Ev(2, Ev(1, Ev("rmap:proj_hits", [ft, Ev("store:fts", store)])))) === 1) c = { kind: 1, ft };
    else c = { kind: Ev("eq", [Ev("rmap:proj_keypos", [Ev(1, Ev("rmap:proj_nonassim", path)), store]), 2]) === "T" ? 2 : 3, ft };
    plan.cols[i] = c;
    return c;
  };
  const out = [];
  try {
    for (const row of rows) {
      if (!Array.isArray(row)) return def();
      const n = Math.min(row.length, paths.length);
      const key = [];
      for (const i of plan.keyAt) { if (i >= n) break; key.push(row[i]); }
      // an objectified instance whose table keys on its roles reads back by its id (rmap:unproj_key)
      const rkey = plan.rel && key.length > 1 ? [Ev("rmap:proj_objkey", key)] : key;
      if (plan.rel) {
        const vals = new Array(rolecols.length);
        for (let j = 0; j < rolecols.length; j++) {
          const rc = rolecols[j];
          if (rc === 0) vals[j] = "#";
          else if (rc > row.length) return def();
          else vals[j] = row[rc - 1];
        }
        out.push([table, vals]);
      }
      for (let i = 0; i < n; i++) {
        const v = row[i];
        if (typeof v !== "string" && typeof v !== "number") return def();
        if (v === "#") continue;
        const c = colOf(i);
        if (c.kind === 0) continue;
        if (c.kind === 1) { if (v === "T") out.push([c.ft, rkey]); continue; }
        out.push([c.ft, c.kind === 2 ? [v, ...rkey] : [...rkey, v]]);
      }
    }
  } catch { return def(); }
  return typedPairsValue(out, x[2]);
}
// rmap:unproj_sp is rmap:unproj over sparse rows: a row of a wide entity table as the cells that hold
// a value, <position, value>, in column order (2026-10-02, U9). The DEF reads an entity row's pairs
// straight from those cells (rmap:sp_live, rmap:sp_key) and builds the full row only for a relation
// table; this is unprojAll's walk over the cells a row holds, the same column kinds, the same key and
// the same pairs in the same order, and a relation table, or any shape it does not expect, is handed
// back to the DEF. Its key is the value at each primary key position, # where the row holds none.
function unprojSparse(x) {
  const def = () => Ev(DEFS.get("rmap:unproj_sp"), x);
  if (!Array.isArray(x) || x.length < 3 || !Array.isArray(x[1])) return def();
  const srows = x[1];
  let ctx;
  try { ctx = Ev("rmap:unproj_ctx", [x[0], x[2]]); } catch { return def(); }
  if (!Array.isArray(ctx) || ctx.length < 6 || !Array.isArray(ctx[1]) || !Array.isArray(ctx[2])) return def();
  if (ctx[3] === "T") return def();
  const paths = ctx[1], pk = ctx[2], store = ctx[4];
  const skip = Array.isArray(ctx[6]) ? ctx[6] : pk;
  for (const p of paths) if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== "string") return def();
  for (const k of pk) if (typeof k !== "string") return def();
  for (const k of skip) if (typeof k !== "string") return def();
  const keyAt = [];
  for (let i = 0; i < paths.length; i++) if (pk.includes(paths[i][0])) keyAt.push(i + 1);
  const cols = new Array(paths.length);
  const colOf = (i) => {
    let c = cols[i];
    if (c !== undefined) return c;
    const path = paths[i][1];
    const ft = Ev("rmap:proj_carried", path);
    if (ft === "#" || skip.includes(paths[i][0]) || Ev("cn:contains", [ft, "IsInvolved"]) === "T") c = { kind: 0 };
    else if (Ev("length", Ev(2, Ev(1, Ev("rmap:proj_hits", [ft, Ev("store:fts", store)])))) === 1) c = { kind: 1, ft };
    else c = { kind: Ev("eq", [Ev("rmap:proj_keypos", [Ev(1, Ev("rmap:proj_nonassim", path)), store]), 2]) === "T" ? 2 : 3, ft };
    cols[i] = c;
    return c;
  };
  const out = [];
  try {
    for (const sr of srows) {
      if (!Array.isArray(sr)) return def();
      for (const c of sr) if (!Array.isArray(c) || c.length < 2 || typeof c[0] !== "number" || !Number.isInteger(c[0]) || c[0] < 1) return def();
      const key = keyAt.map((p) => { for (const c of sr) if (c[0] === p) return c[1]; return "#"; });
      for (const c of sr) {
        const p = c[0], v = c[1];
        if (typeof v !== "string" && typeof v !== "number") return def();
        if (v === "#" || p > paths.length) continue;
        const k = colOf(p - 1);
        if (k.kind === 0) continue;
        if (k.kind === 1) { if (v === "T") out.push([k.ft, key]); continue; }
        out.push([k.ft, k.kind === 2 ? [v, ...key] : [...key, v]]);
      }
    }
  } catch { return def(); }
  return typedPairsValue(out, x[2]);
}
// AREST_NOTWIN=name,name disables those twins for one run, so a twin can be
// held against its DEF on the same inputs: the law report is the only gate
// that exercises most of them, and a twin that is not the DEF fails it
// with no word about where (cn:nlexlt, 2026-09-06)
const NOTWIN = new Set(String(process.env.AREST_NOTWIN || "").split(",").filter(Boolean));
// the twin of a DEF by the DEF's own body, for `apply` (below); rebuilt when DEFS changes
let TWINBODY = null, TWINBODYVER = -1;
function twinOfBody(f) {
  if (TWINBODYVER !== DEFSVER) {
    TWINBODY = new WeakMap();
    for (const [name, fn] of FASTPRIMS) { if (NOTWIN.has(name)) continue; const b = DEFS.get(name); if (Array.isArray(b)) TWINBODY.set(b, fn); }
    TWINBODYVER = DEFSVER;
  }
  return TWINBODY.get(f);
}
// the first cell of a store named n, the cell itself: ast:fetch answers its contents and main:cell_same compares
// cells by identity. Indexed once per store array, keyed by name, cleared with the memo as the other indexes are.
function fetchCell(cells, name) {
  let idx = FETCHIDX.get(cells);
  if (idx === undefined) { idx = new Map();
    for (const c of cells) { if (!Array.isArray(c) || c.length !== 3) continue;
      const k = JSON.stringify(c[1]); if (!idx.has(k)) idx.set(k, c); }
    FETCHIDX.set(cells, idx); }
  return idx.get(JSON.stringify(name));
}
const FASTPRIMS = new Map(Object.entries({
  // CONS and CONST are lambda (Backus 13.3.2, reached through tau clause (c)) and
  // stay so; these are their fast paths, the same value in one pass.
  // Metacomposition hands CONS <<CONS f1..fn>, y> and the answer is
  // <f1:y .. fn:y>; the lambda form allocates distr, tl and an ALPHA over apply
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
  // answer its third element, "#" for none. The index holds the CELL and reads
  // its contents on the hit alone: a store read from its tables on demand keeps
  // each population in a cell whose contents are read the first time anything
  // reaches into them, and indexing every contents up front read every table
  // (2026-09-24).
  "ast:fetch": x => { const hit = fetchCell(seq(at(x, 1)), at(x, 0));
    return hit === undefined ? "#" : hit[2]; },
  // main:cell_same <name, prior, trial> is whether two stores hold the same cell of that name, eq of the two
  // fetches. A writer gives the fact type it writes a cell of its own (main:trial_overlay), so the SAME cell in
  // both, or none in either, is the same population, and it is answered here without reading it: a store read
  // from its tables on demand keeps each population in a cell whose contents are read the first time anything
  // reaches into them, and comparing contents at every write would read every table (2026-09-29). Two
  // different cells are compared as the DEF compares them.
  "main:cell_same": x => { const name = at(x, 0), a = seq(at(x, 1)), b = seq(at(x, 2));
    if (a === b || fetchCell(a, name) === fetchCell(b, name)) return "T";
    return Ev(DEFS.get("main:cell_same"), x); },
  // theta:member over a long list is answered by a set keyed on the list: the
  // law walk asks it once per atom of every form against the store's cell names
  // (43,156 asks over the same list, 13 of the base report's 89 seconds,
  // 2026-09-04). A short list is scanned as the DEF scans it.
  // cn:contains <haystack, needle> is whether the needle's characters occur, in order and together,
  // in the haystack's -- lambda walks the haystack a character at a time and takes the needle's
  // length at each step, which is fine for a name and not for a design state rendered whole, where
  // the compile asks it once per value it sealed (compile:seal_left). Code points, as `chars` splits
  // them: on well-formed text a code-unit search answers the same, and on text holding a lone
  // surrogate this searches the code points themselves. An empty haystack holds nothing, not even
  // the empty needle, because the DEF's walk never starts on one.
  // ONE ENTRY, AND THIS IS IT (2026-10-01). A second `cn:contains` stood further down this literal,
  // from the twin's first version: it sent any string holding a surrogate to the DEF, and the later
  // key wins in an object literal, so it silently replaced this one. An emoji is a surrogate pair, so
  // support's readings, whose Suggested Prompts carry emoji icons, sent compile:seal_left's search of
  // the whole rendered design state through the DEF a character at a time: the compile ran past
  // twenty minutes where the same closure without the icons takes thirty seconds. Well-formed text
  // (pairs included) is searched by code unit, which is exact for it; a lone surrogate is searched
  // by code point; an operand that is not two strings is the DEF's, as the first version had it.
  "cn:contains": x => {
    if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "string" || typeof x[1] !== "string") return Ev(DEFS.get("cn:contains"), x);
    const h = x[0], n = x[1];
    if (h.length === 0) return "F";
    if (typeof h.isWellFormed === "function" && h.isWellFormed() && n.isWellFormed()) return bool(h.includes(n));
    const hs = [...h], ns = [...n];
    for (let i = 0; i < hs.length; i++) { let j = 0; while (j < ns.length && hs[i + j] === ns[j]) j++; if (j === ns.length) return "T"; }
    return "F"; },
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
  // cn:contains <text, part>: T when some non-empty suffix of the text's characters begins with the
  // part's -- so an empty text contains nothing, not even the empty part, and a non-empty one contains
  // the empty part. The DEF slides a WHILE over chars with theta:take and eq at every position:
  // rmap:unproj_isrole asks it of a fact type's name once per stored CELL while a store loads, 40% of
  // support's load, and the reader asks it 70,131 times more (2026-09-29). Its twin is the one entry
  // above, beside theta:member; a second key here replaced it (2026-10-01, the note there).
  // rmap:proj_row <key, table, store>: an entity table's row, a column plan at a time (projRow above)
  "rmap:proj_row": x => projRow(x),
  // rmap:rows_for is the same first-column filter, <key, rows>, written as the
  // right fold INSERT keep_row_of . append_phi . distl. rmap:nest's twin above
  // took it out of the nesting, but law:l2_key still asks it once PER KEY over
  // the whole table: 8,487 asks, 4.5 million row tests, the first 55 of the
  // support report's 560 profiled seconds (2026-09-07). The rows are the same
  // array across the asks, so the index is built once. Edges mirrored: source
  // order, an atom or empty row throws the selector error the fold's predicate
  // threw at that row, no match is PHI.
  "rmap:rows_for": x => matchRows(at(x, 0), seq(at(x, 1))).slice(),
  // rmap:proj_hits <key, rows> is that filter once more, written as ALPHA over distr: the rows whose first element
  // is the key, in source order, an atom or empty row raising the selector error. rmap:proj_pop asks it of a fact
  // type over store:fts, every descriptor of the store, and a projection asks proj_pop once per column per store:
  // a write planning Function's 313 columns, and the planner's first-population search over 290 populations on
  // each side of a create, scanned some 3,000 descriptors each time (2026-10-07, task #143). store:fts is one array
  // per store, so its index is built once and each ask is a lookup. The rows answered are the descriptors
  // themselves, so a population read through them is the same array the DEF reads. AREST_NOTWIN=rmap:proj_hits
  // gives the DEF's own.
  "rmap:proj_hits": x => matchRows(at(x, 0), seq(at(x, 1))).slice(),
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
  // the same first-match lookup, three more times, each written in lambda as
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
  // F. The lowering and the ranking stay LAMBDA -- lex:lw and cn:chrank are
  // memoised and evaluated here by name, so the twin cannot mean anything
  // the DEF does not -- and only the per-character WHILE is native: 136,110
  // calls from cn:ordlt on the eu-law report (2026-09-06).
  "cn:strlt": x => { const la = [...String(Ev("lex:lw", at(x, 0)))], lb = [...String(Ev("lex:lw", at(x, 1)))];
    const n = Math.min(la.length, lb.length);
    for (let i = 0; i < n; i++) { const ra = Ev("cn:chrank", la[i]), rb = Ev("cn:chrank", lb[i]);
      if (ra === rb) continue; return bool(rb > ra); }
    return bool(la.length < lb.length); },
  // cn:ordlt orders <rank, name> pairs: equal ranks by cn:strlt on the names,
  // otherwise "a's rank is below b's", which lambda writes as `not null
  // (theta:drop [theta:iota b, a])` -- a list of b integers built and cut per
  // comparison. The support report's column sort made 379k comparisons a
  // minute and iota's 190k lists were 18.7 of its 60 s (2026-09-07). The
  // VALUE of that test is arithmetic: iota has max(0, b) elements and drop
  // keeps them all past a (0 keeps all, a negative drops all, as the twins
  // above read the count), so the list is non-empty iff that remainder is.
  // Ranks that are not integers, where the list's length would be a rounding
  // question, are asked of the DEF; the names stay lambda's through cn:strlt.
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
  // lambda value is never mutated, so the identity is the value -- and
  // evaluates the DEF once per row. Reset with the other indexes.
  "rmap:member_pairs": x => {
    if (!Array.isArray(x)) return Ev(DEFS.get("rmap:member_pairs"), x);
    let v = MPIDX.get(x);
    if (v === undefined) { v = Ev(DEFS.get("rmap:member_pairs"), x); MPIDX.set(x, v); }
    return v; },
  // theta:natjoin <(theta:natjoin keys), <A, B>> is the natural join lambda's
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
  // render:json is lambda's renderer of a value as JSON text: the empty
  // sequence is [], a sequence is its elements rendered and joined by a comma
  // between brackets, a number is its text (implode of the atom, "" + n), and
  // a string is quoted with lambda's escapes -- backslash, quote, newline,
  // return and every other control character as JSON writes it (quote_str:ctl)
  // -- every other character as it is. Written as ALPHA over
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
  // itself. The lookups are ast:fetch's twin, the first cell named. A head the
  // store computes on read is derive:on_read's rows before any cell is looked
  // at, as ast:FetchPop builds it (2026-10-04, task #172), kept by the store's
  // identity until a write moves it (onReadRows).
  // derive:on_read <head, store> is a head's rows computed over the store, and main:or_has <id, head, store>
  // whether they name the id: kept by the store's identity (onReadRows), and the atoms of the rows by theirs
  // (onReadAtoms), so a store's links compute each head once and then look the id up (2026-10-04, task #172).
  // The memo did not keep derive:on_read's answers -- whole populations, past its weight bound -- and the
  // base law report's links computed it some 40,000 times. A malformed operand gives the DEF's own answer.
  "derive:on_read": x => {
    if (!Array.isArray(x) || x.length !== 2 || !Array.isArray(x[1])) return Ev(DEFS.get("derive:on_read"), x);
    return onReadRows(x[0], x[1]); },
  "derive:or_heads": x => orHeadsOf(x),
  "main:or_has": x => {
    if (!Array.isArray(x) || x.length !== 3 || !Array.isArray(x[2])) return Ev(DEFS.get("main:or_has"), x);
    return onReadAtoms(x[1], x[2]).has(keyOf(x[0])) ? "T" : "F"; },
  "system:pop_in": x => { const name = at(x, 0), store = at(x, 1);
    if (Array.isArray(store) && onReadHeads(store).has(String(name))) return onReadRows(name, store);
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
  // store:fix_desc is a descriptor with its fifth slot unfolded -- CONS 1..4 and
  // theta:unfold_rows o 5 -- and a walk over the descriptors for names, players
  // and keys never looks at that slot: ui:groups under mcp:tools, at every
  // start, is one. The DEF unfolded every descriptor's rows as it passed, so over
  // a store read from its tables on demand the tool list read every population
  // in the store before a server answered anything -- 1,432 of support's, 22 s
  // (2026-09-24). This is the same value with the fifth slot unfolded when it is
  // first read; AREST_NOTWIN=store:fix_desc gives the DEF's own. Only where the
  // store is read on demand: in a compile, the suite or the law report every slot
  // is read anyway, and there the slot is unfolded at once, as the DEF does.
  // `get` <id, store> OVER A STORE READ FROM ITS TABLES READS THE ROWS THAT NAME THE ID
  // (2026-09-25; Sam: "rmap is supposed to be done on compile, not every time you call a
  // column?"). The DEF answered <the id's cell among rmap's, the fact types nav:peers
  // keeps>: rmap over the store builds a cell for every entity of every group and every
  // relation's rows, and ast:fetch then takes one; ast:File nests every population and
  // nav:peers keeps the ones that hold the id. On support.auto.dev that was the whole
  // store projected again at every first `get` -- rmap 2,228 ms and 344 -> 1,417 MB
  // resident, ast:File 74 ms, nav:peers 225 ms -- for one entity's row, which the tables
  // already hold because the check wrote them. Since 2026-10-01 the DEF answers the
  // entity's facts and its links (lambda's note above DEF(get)), and its first step,
  // get:cut, narrows every population to the rows that hold the id, so it reads nothing
  // else of the store. So this is the DEF itself, evaluated over the store with every
  // population cut to the facts that name the id -- the tables' from one scan per table
  // (lazyStore's mentioning), the carriers' filtered -- and it answers what the DEF
  // answers over the whole store, only without reading the rest. A fact type the id
  // NAMES is cut like any other: only the rmap answer merged its whole population in.
  // A fact type the tables carry but yield nothing for falls back to the carriers' rows
  // in a descriptor, and so it does here: support's SourceServiceHasProxyConcurrencyCap
  // is read back from its column as a unary while its fact holds a value, so the
  // store serves it from the carrier -- asked only where the carrier names the id and
  // the tables do not. Any other shape, a store not read from its tables, and
  // AREST_NOTWIN=get give the DEF's own route.
  "get": x => {
    const def = () => Ev(DEFS.get("get"), x);
    if (!LAZY_STORE || !Array.isArray(x) || x.length !== 2) return def();
    const id = x[0], st = x[1];
    if (typeof id !== "string" || !Array.isArray(st) || st.length !== 2 || !Array.isArray(st[0])) return def();
    const has = (f) => Array.isArray(f) && f.some((v) => v === id);
    const tm0 = performance.now(); // @instrument
    const byFt = LAZY_STORE.mentioning(id);
    if (PROFILE) console.error("get: mentioning " + Math.round(performance.now() - tm0) + " ms, " + byFt.size + " fact type(s)"); // @instrument
    // a head the store computes on read keeps no table rows: store:read_state computed the rows of the ones
    // the entity's types play into the descriptor, so those are its rows here, as they are in the DEF
    const orh = onReadHeads(CELLS);
    const fts = [];
    for (const d of st[0]) {
      if (!Array.isArray(d) || d.length < 5) return def();
      const name = String(d[0]);
      let rows;
      if (LAZY_STORE.present(name) && !orh.has(name)) {
        rows = byFt.get(name) || [];
        if (!rows.length) { const c = LAZY_STORE.carrier(name).filter(has); if (c.length && !LAZY_STORE.rowsOf(name).length) rows = c; }
      } else {
        const all = d[4];
        if (!Array.isArray(all)) return def();
        rows = all.filter(has);
      }
      fts.push([d[0], d[1], d[2], d[3], rows]);
    }
    return Ev(DEFS.get("get"), [id, [fts, st[1]]]);
  },
  // nav:keep_peer <<id, cell>, peers> TAKES A CELL'S ATOMS ONCE (2026-10-03, #163). nav:peers asks it of every FILE
  // cell for every id, and the DEF takes the cell's atoms (nav:atoms) and theta:member indexes them, each time: once
  // FILE holds the populations the reflection and the closure put (store:file_put), the law report's 1,530 links
  // took 114 s under the profiler and called nav:atoms 39.5 million times, where they had taken 13.7 s and 5.3
  // million calls. A cell's contents do not change, so whether they are a trie (nav:triep) and the keys of their
  // atoms are taken the first time and kept by the contents' identity, as theta:unfold_rows keeps its answer, and
  // an id is then one lookup: those links take 0.4 s, and nav:atoms runs 26,099 times. A cell that is no cell,
  // contents that are no sequence, peers that are no sequence and AREST_NOTWIN=nav:keep_peer give the DEF's answer.
  "nav:keep_peer": x => {
    const def = () => Ev(DEFS.get("nav:keep_peer"), x);
    if (!Array.isArray(x) || x.length !== 2 || !Array.isArray(x[0]) || x[0].length !== 2 || !Array.isArray(x[1])) return def();
    const id = x[0][0], c = x[0][1];
    if (!Array.isArray(c) || c.length < 3 || !Array.isArray(c[2])) return def();
    const contents = c[2];
    let keys = PEERATOMS.get(contents);
    if (keys === undefined) {
      keys = null;
      if (Ev("nav:triep", contents) === "T") { keys = new Set(); for (const a of Ev("nav:atoms", contents)) keys.add(keyOf(a)); }
      PEERATOMS.set(contents, keys);
    }
    return keys !== null && keys.has(keyOf(id)) ? [[c[1], [id]]].concat(x[1]) : x[1];
  },
  // nav:peers <id, FILE> OVER A STORE READ FROM ITS TABLES READS ONLY THE TABLES THAT NAME THE ID (2026-10-03).
  // The DEF keeps each FILE cell whose population holds the id among its atoms (nav:keep_peer over nav:atoms),
  // so it reads every population: a keyed GET of one Cancel Request on a copy of support read all 1,666 for the 24
  // that hold it, 11 to 15 s cold. A FILE cell the lazy store has not yet read, of a fact type no write has
  // moved (pending), holds once read its fact type's rows as the tables hold them, and those rows hold the id as
  // a value exactly when the scan for the id finds a fact of that type (lazyStore's mentioning, the scan the get
  // twin reads); so such a cell is decided by the scan and left unread. A fact type the tables carry and yield
  // nothing for is read from the carriers' rows instead, as the get twin finds, so a pending cell the scan does
  // not name is still kept when those rows name the id and the tables yield no row of it. A fact type a write
  // moved is not pending: the write refiles its FILE cell with the rows it put (main:refile1 for the written fact
  // type, store:file_put for every head the closure or the reflection put), so that cell is tested by
  // nav:keep_peer over the rows after the write. Every cell but a pending one -- read already, a write's own, of a
  // fact type a write moved or no table holds -- is tested by nav:keep_peer itself, and the links come out in
  // FILE's order, as the DEF's INSERT leaves them. An id that is not text, a store not read from its tables, and
  // AREST_NOTWIN=nav:peers give the DEF's own route.
  "nav:peers": x => {
    const def = () => Ev(DEFS.get("nav:peers"), x);
    if (!LAZY_STORE || typeof LAZY_STORE.pending !== "function" || !Array.isArray(x) || x.length !== 2) return def();
    const id = x[0], file = x[1];
    if (typeof id !== "string" || !Array.isArray(file)) return def();
    const keep = DEFS.get("nav:keep_peer");
    const has = (f) => Array.isArray(f) && f.some((v) => v === id);
    let byFt = null;
    const out = [];
    for (const c of file) {
      if (Array.isArray(c) && c.length === 3 && c[0] === "CELL" && typeof c[1] === "string" && LAZY_STORE.pending(c) && LAZY_STORE.present(c[1])) {
        if (!byFt) byFt = LAZY_STORE.mentioning(id);
        if (byFt.has(c[1]) || (LAZY_STORE.carrier(c[1]).some(has) && !LAZY_STORE.rowsOf(c[1]).length)) out.push([c[1], [id]]);
        continue;
      }
      const r = Ev(keep, [[id, c], []]);
      if (Array.isArray(r) && r.length) out.push(r[0]);
    }
    return out;
  },
  // main:re_gone_rows <rows, players, id, kinds> IS ONE PASS OVER THE ROWS (2026-10-05). The DEF tests each row with
  // main:re_rowp, a trans and a distr per row and a COND, an eq and a theta:member per value: an entity retract on
  // support.auto.dev tested 416,119 rows so, 6.1 s of the 14.9 s it took under the profiler. This is the same test:
  // a row is kept when it has the players' length and holds the id at a position whose player is of kind entity
  // (main:re_hit, the id an atom so a value equal to it is one), in the rows' order. An id that is not text, rows,
  // players or a row that is no sequence, and AREST_NOTWIN=main:re_gone_rows give the DEF's answer.
  "main:re_gone_rows": x => {
    const def = () => Ev(DEFS.get("main:re_gone_rows"), x);
    if (!Array.isArray(x) || x.length !== 4 || !Array.isArray(x[0]) || !Array.isArray(x[1]) || typeof x[2] !== "string") return def();
    const rows = x[0], players = x[1], id = x[2], kinds = x[3];
    if (!rows.every(Array.isArray)) return def();
    const at = [];
    for (let k = 0; k < players.length; k++) if (Ev("theta:member", [[players[k], "entity"], kinds]) === "T") at.push(k);
    const out = [];
    if (at.length) for (const r of rows) if (r.length === players.length && at.some((k) => r[k] === id)) out.push(r);
    return out;
  },
  // main:re_facts <store, id> OVER A STORE READ FROM ITS TABLES READS ONLY THE ROWS THAT NAME THE ID (2026-10-05). The
  // DEF asks main:re_gone of every fact type main:re_names names, which reads its population whole: an entity retract on
  // support.auto.dev read every table it had not read (rmap:unproj 2.7 s under the profiler) to find one id's facts
  // in nine fact types. A top-level cell the lazy store has not yet read, of a fact type no write has moved
  // (pending), holds once read its fact type's rows as the tables hold them, so the rows of it that hold the id are
  // the scan's for that id (lazyStore's mentioning, as the get and nav:peers twins read it), in the population's
  // order, and main:re_gone_rows keeps of them what the DEF keeps; such a cell is left unread. A fact type the
  // tables carry and yield nothing for, whose carriers' rows hold the id, any other cell -- read already, a write's
  // own, a head computed on read -- and a fact type with no top-level cell are asked of main:re_rows, as the DEF
  // asks them. An id that is not text, a store not read from its tables, and AREST_NOTWIN=main:re_facts give the
  // DEF's own route.
  // AND THE ROW AN OBJECTIFIED INSTANCE IS (2026-10-05, task #185). main:re_rows takes, after those rows, the row of
  // a fact type state:nestings objectifies whose key spells the id (main:re_own): a Constraint Span retracted by its
  // id is its pair. The scan reads that row by its key (mentioning's objkeyAt, or the table's own id column) and
  // hands it back apart (mentioning(id, true)'s own), since it holds no value that is the id; it is taken for a
  // fact type the store objectifies, after the rows that hold the id, as the DEF takes it. A carrier row that
  // spells the id where the tables yield none sends the fact type to the DEF, as a carrier row holding it does.
  "main:re_facts": x => {
    const def = () => Ev(DEFS.get("main:re_facts"), x);
    if (!LAZY_STORE || typeof LAZY_STORE.pending !== "function" || !Array.isArray(x) || x.length !== 2) return def();
    const store = x[0], id = x[1];
    if (typeof id !== "string" || !Array.isArray(store)) return def();
    const top = new Map();
    for (const c of store) if (Array.isArray(c) && c.length === 3 && c[0] === "CELL" && typeof c[1] === "string" && !top.has(c[1])) top.set(c[1], c);
    const orh = onReadHeads(store);
    const kinds = Ev("main:re_kinds", store);
    const nested = new Set(seq(Ev("main:re_nested", store)).map(String));
    const has = (f) => Array.isArray(f) && f.some((v) => v === id);
    const spells = (f) => !has(f) && objkeyIs(f, id);
    let byFt = null;
    const out = [];
    for (const ft of seq(Ev("main:re_names", store))) {
      const name = String(ft), c = top.get(name);
      let rows;
      if (c !== undefined && LAZY_STORE.pending(c) && LAZY_STORE.present(name) && !orh.has(name)) {
        if (!byFt) byFt = LAZY_STORE.mentioning(id, true);
        const got = byFt.get(name), own = nested.has(name) ? byFt.own.get(name) : undefined;
        if ((got === undefined && LAZY_STORE.carrier(name).some(has)) || (nested.has(name) && own === undefined && LAZY_STORE.carrier(name).some(spells))) rows = Ev("main:re_rows", [store, ft, id, kinds]);
        else rows = (got === undefined ? [] : seq(Ev("main:re_gone_rows", [got, Ev("main:re_players", [store, ft, id, kinds]), id, kinds]))).concat(own === undefined ? [] : own);
      } else rows = Ev("main:re_rows", [store, ft, id, kinds]);
      if (seq(rows).length) out.push([ft, rows]);
    }
    return out;
  },
  "store:fix_desc": d => {
    if (!Array.isArray(d) || d.length < 5) return Ev(DEFS.get("store:fix_desc"), d);
    if (!LAZY_STORE) return [d[0], d[1], d[2], d[3], Ev("theta:unfold_rows", d[4])];
    const out = [d[0], d[1], d[2], d[3], null];
    let v, done = false;
    Object.defineProperty(out, 4, { get() { if (!done) { v = Ev("theta:unfold_rows", d[4]); done = true; } return v; },
      enumerable: true, configurable: true });
    return out; },
  // store:fp_file <pairs, store> NESTS NOTHING AT THE WRITE (2026-10-03, #163). Every put refiles FILE's cell of each
  // population it puts (store:file_put), and the DEF nests that population's rows into the cell there and then,
  // while a Contact Submission's reflection on support puts the instances' populations, tens of thousands of rows
  // each, twice. So a rebuilt cell's contents are worked out when the cell is first read, as rmap:nest of the rows
  // (which theta:unfold_rows leaves as they are), and kept: a GET's links read them, as before they read the
  // table's rows for a fact type a write moved. Every other cell is the same cell, so the lazy store's pending cells
  // stay pending. A pair whose rows are not rows of scalars all of one length -- which the twin cannot vouch the
  // DEF would nest without raising -- a cell that is no cell, and AREST_NOTWIN=store:fp_file give the DEF's answer.
  "store:fp_file": x => {
    const def = () => Ev(DEFS.get("store:fp_file"), x);
    if (!Array.isArray(x) || x.length !== 2 || !Array.isArray(x[0])) return def();
    const file = Ev("store:file_of", x[1]);
    if (!Array.isArray(file)) return def();
    const rowsOf = new Map();
    for (const p of x[0]) {
      if (!Array.isArray(p) || p.length < 2) return def();
      const k = keyOf(p[0]);
      if (rowsOf.has(k)) continue;           // solve:assoc answers the first pair naming it
      const rows = p[1];
      if (!Array.isArray(rows) || !rows.every((r) => isRow(r) && r.length === rows[0].length)) return def();
      rowsOf.set(k, rows);
    }
    const out = new Array(file.length);
    for (let i = 0; i < file.length; i++) {
      const c = file[i];
      if (!Array.isArray(c) || c.length < 2) return def();
      const rows = rowsOf.get(keyOf(c[1]));
      if (rows === undefined) { out[i] = c; continue; }
      const cell = ["CELL", c[1], null];
      let v, done = false;
      Object.defineProperty(cell, 2, { get() { if (!done) { v = Ev("rmap:nest", Ev("theta:unfold_rows", rows)); done = true; } return v; },
        enumerable: true, configurable: true });
      out[i] = cell;
    }
    return out;
  },
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
  // strdown folds ASCII upper to lower and nothing else. The DEF maps every
  // character through chardown -- charisup, a code-unit comparison against
  // "A" and "Z", so a letter above ASCII is not upper -- and then charmap:pick
  // over the 26 pairs. cn:number folds both sides of every column-name
  // comparison (e33971ab): 109,544 calls and 2.24M chardown calls on the base
  // metamodel, 18.2 s inclusive instrumented, and the ddl phase 4.3-6.2 s ->
  // 16.1 s uninstrumented (2026-09-21). The DEF is the meaning either way and
  // the suite evaluates it beside this (the strdown twin is its DEF). A
  // non-string is chars's refusal, in chars's words.
  "strdown": x => { if (typeof x !== "string") throw new Error("chars on non-string");
    return x.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32)); },
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
  // read:firstn, read:dropn and read:rule_seq_at, native (2026-09-28). The rules compiler finds a
  // word sequence in a clause with read:rule_seq_at, which slices the clause at EVERY position through
  // read:rule_slice -- read:firstn over read:dropn, a WHILE of tlr over a WHILE of tl, each step a
  // copy -- so one search allocated O(n^3) and fifteen rule arms run it for every name they try:
  // sampled on support's closure, rule_slice, firstn and dropn were 27%, 23% and 12% of the whole
  // parse. The DEFs are the meaning. Same contract, read off the DEFs and the prims they use:
  //   read:dropn <n, L>: L itself when n <= 0; else L without its first ceil(n) -- tl raises on the
  //     empty sequence and on an atom, and a non-number n raises in gt
  //   read:firstn <n, L>: L when length(L) <= n; else its first floor(n) -- a negative n empties L
  //     and then raises in tlr, and length raises on an atom
  //   read:rule_seq_at <S, C>: the first 1-based i with C[i..i+|S|-1] eq S element by element
  //     (deepEq, the eq prim), 0 for none; the empty S is at 1
  // and every shape the DEF would raise on is handed to the DEF, so it raises as the DEF does.
  "read:dropn": x => {
    if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "number" || !Number.isFinite(x[0])) return Ev(DEFS.get("read:dropn"), x);
    if (x[0] <= 0) return x[1];
    const k = Math.ceil(x[0]), l = x[1];
    if (!Array.isArray(l) || k > l.length) return Ev(DEFS.get("read:dropn"), x);
    return l.slice(k); },
  "read:firstn": x => {
    if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "number" || !Number.isFinite(x[0]) || x[0] < 0 || !Array.isArray(x[1]))
      return Ev(DEFS.get("read:firstn"), x);
    const n = x[0], l = x[1];
    return l.length > n ? l.slice(0, Math.floor(n)) : l; },
  // compile:text_rows <name, text> is a readings file's rows -- the env filter, the sentences, a row per
  // sentence -- and nothing else goes in: no vocabulary, no other file. So a file whose text has not changed
  // has the rows it had, and they are KEPT ACROSS RUNS (2026-09-28): keyed by the module's composition (lambda
  // itself, so any edit to it misses), the strict cell and the name and text, in a SQLite file under the OS
  // temp directory that every app's check shares -- they all read the same metamodel. Sam: "Is there a way
  // to figure out if the file changed and only compile the changes?" A .env is NEVER kept: its rows carry the
  // plaintext compile.js seals, and nothing may write that anywhere. An unstamped module keeps nothing, and
  // AREST_PARSE_CACHE=off (or a path) turns it off (or moves it). The DEF is the meaning; a miss is the DEF.
  "compile:text_rows": x => parseCached(x),
  // and the fold that lands those rows is kept at its checkpoints (parseFoldKept, above)
  "read:parse": x => parseFoldKept(x),
  // THE PER-TOKEN STRING TESTS, native (2026-09-28). With the files' rows kept, what was left of tasks'
  // parse was string work a character at a time: read:val_zip's read:endswith and read:lastn 106,456 calls
  // each, read:is_numword 19,549 and read:numchar 220,208, cn:pascalw 38,057, and under all of them
  // charisdigit, charislow and charup, which were lambda over chars with no twin. The DEFs are the meaning;
  // each contract below is read off its DEF and the prims it uses (chars raises on a non-string and yields
  // code points; ge and le compare strings ordinally; tl raises on the empty sequence), and a shape the
  // DEF raises on is handed to the DEF, so it raises as the DEF does.
  //   charisdigit / charislow: the FIRST character in 0-9 / a-z; the empty string is F
  //   charup: a first character in a-z answers that character upper-cased, ALONE; anything else answers
  //     the whole argument unchanged
  //   read:numchar: charisdigit, or the character is exactly "."
  //   read:is_numword: non-empty, every character a numchar, at least one a digit
  //   read:lastn <n, L>: L when length(L) <= n, else its last floor(n); read:endswith <S, L>: L's last
  //     length(S) elements eq S (the whole of a shorter L)
  //   cn:pascalw: the characters without the hyphens, the first charup'd, joined
  "charisdigit": x => { if (typeof x !== "string") return Ev(DEFS.get("charisdigit"), x);
    if (x.length === 0) return "F"; const c = String.fromCodePoint(x.codePointAt(0)); return bool(c >= "0" && c <= "9"); },
  "charislow": x => { if (typeof x !== "string") return Ev(DEFS.get("charislow"), x);
    if (x.length === 0) return "F"; const c = String.fromCodePoint(x.codePointAt(0)); return bool(c >= "a" && c <= "z"); },
  "charup": x => { if (typeof x !== "string") return Ev(DEFS.get("charup"), x);
    if (x.length === 0) return x; const c = String.fromCodePoint(x.codePointAt(0));
    return c >= "a" && c <= "z" ? c.toUpperCase() : x; },
  "read:numchar": x => { if (typeof x !== "string") return Ev(DEFS.get("read:numchar"), x);
    if (x === ".") return "T"; if (x.length === 0) return "F"; const c = String.fromCodePoint(x.codePointAt(0)); return bool(c >= "0" && c <= "9"); },
  "read:is_numword": x => { if (typeof x !== "string") return Ev(DEFS.get("read:is_numword"), x);
    const cs = [...x]; if (cs.length === 0) return "F"; let digit = false;
    for (const c of cs) { const d = c >= "0" && c <= "9"; if (!d && c !== ".") return "F"; if (d) digit = true; }
    return bool(digit); },
  "read:lastn": x => {
    if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "number" || !Number.isFinite(x[0]) || x[0] < 0 || !Array.isArray(x[1]))
      return Ev(DEFS.get("read:lastn"), x);
    const n = x[0], l = x[1]; return l.length > n ? l.slice(l.length - Math.floor(n)) : l; },
  "read:endswith": x => {
    if (!Array.isArray(x) || x.length < 2 || !Array.isArray(x[0]) || !Array.isArray(x[1])) return Ev(DEFS.get("read:endswith"), x);
    const w = x[0], l = x[1]; return bool(deepEq(l.length > w.length ? l.slice(l.length - w.length) : l, w)); },
  // read:rule_match_at <P, R> and read:rule_findrun <P, C, i>, native (2026-09-28). The rules compiler's
  // subtype narrowing tries every subtype against every clause, and each try scans the clause for the
  // subtype's words through read:rule_findrun -- a WHILE over positions, a read:rule_slice and a
  // read:rule_match_at at each: 17,089 narrowing tries and 18,130 scans on tasks' closure. Contracts, off
  // the DEFs: match_at is PHI unless P and R agree on all but their last words (eq of tlr), the last word
  // of R starts with the last word of P (read:isprefix over chars), and what follows it is all digits
  // (read:rule_isdigits, charisdigit over each character) -- then <those digits, imploded>. findrun is
  // the first 1-based j >= i at which C[j .. j+|P|-1] matches P, as <j, digits>, or PHI. An empty P
  // (tlr raises), a word that is not a string (chars raises), or a start below 1 goes to the DEF.
  // read:has_key <k, rows>: T when some row's first element eq k (the DEF: not . null . csdp:matches).
  "read:has_key": x => {
    if (!Array.isArray(x) || x.length < 2 || !Array.isArray(x[1])) return Ev(DEFS.get("read:has_key"), x);
    const hit = hasKey(x[0], x[1]);
    return hit === undefined ? Ev(DEFS.get("read:has_key"), x) : bool(hit); },
  "read:rule_match_at": x => {
    if (!Array.isArray(x) || x.length < 2 || !Array.isArray(x[0]) || !Array.isArray(x[1]) || x[0].length === 0 || x[1].length === 0)
      return Ev(DEFS.get("read:rule_match_at"), x);
    const p = x[0], r = x[1];
    if (!deepEq(p.slice(0, p.length - 1), r.slice(0, r.length - 1))) return [];
    const a = p[p.length - 1], b = r[r.length - 1];
    if (typeof a !== "string" || typeof b !== "string") return Ev(DEFS.get("read:rule_match_at"), x);
    return ruleSuffix(a, b); },
  "read:rule_findrun": x => {
    if (!Array.isArray(x) || x.length < 3 || !Array.isArray(x[0]) || !Array.isArray(x[1]) || x[0].length === 0
        || typeof x[2] !== "number" || !Number.isInteger(x[2]) || x[2] < 1) return Ev(DEFS.get("read:rule_findrun"), x);
    const p = x[0], c = x[1], m = p.length, a = p[m - 1];
    if (typeof a !== "string") return Ev(DEFS.get("read:rule_findrun"), x);
    for (let j = x[2]; j + m - 1 <= c.length; j++) {
      let same = true;
      for (let k = 0; k < m - 1; k++) if (!deepEq(p[k], c[j - 1 + k])) { same = false; break; }
      if (!same) continue;
      const b = c[j - 1 + m - 1];
      if (typeof b !== "string") return Ev(DEFS.get("read:rule_findrun"), x);
      const hit = ruleSuffix(a, b);
      if (hit.length) return [j, hit[0]];
    }
    return []; },
  "cn:pascalw": x => { if (typeof x !== "string") return Ev(DEFS.get("cn:pascalw"), x);
    const cs = [...x].filter((c) => c !== "-"); if (cs.length === 0) return "";
    const c = cs[0]; if (c >= "a" && c <= "z") cs[0] = c.toUpperCase(); return cs.join(""); },
  "read:rule_seq_at": x => {
    if (!Array.isArray(x) || x.length < 2 || !Array.isArray(x[0]) || !Array.isArray(x[1])) return Ev(DEFS.get("read:rule_seq_at"), x);
    const w = x[0], c = x[1], m = w.length;
    for (let i = 0; i + m <= c.length; i++) {
      let hit = true;
      for (let k = 0; k < m; k++) if (!deepEq(c[i + k], w[k])) { hit = false; break; }
      if (hit) return i + 1;
    }
    return 0; },
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
  // rmap:unproj_live is rmap:unproj_filled over rmap:unproj_cells: for each column of the
  // row that holds a value, <path head, path second, value>, in column order. The DEF zips
  // every column with its path and builds a triple for each before the empty ones are
  // dropped -- two arrays per column per row, some twelve million for one read of
  // support's Function table -- and this builds the triples it keeps and no others. Every
  // shape the DEF would RAISE on is handed back to it: a path that is not a sequence of
  // two or more, checked for EVERY column since the DEF selects into each path before it
  // filters, and a value that is not an atom, since eq decides those. A paths array that
  // passed is remembered by identity, and a table's ctx keeps one for the whole read.
  // rmap:unproj_key is the row's values in its primary key's columns, in column order,
  // and its DEF gets there through rmap:unproj_cells too: a triple for EVERY column, a
  // pair of each with the key's columns, a list per column for the answer -- some twelve
  // hundred arrays a row on support's Function table, to find the one value in
  // functionId. It keeps the # of an empty key column, since it tests the column and not
  // the value. The same shapes defer to the DEF as rmap:unproj_live's do, and a column
  // head or key column that is not a string does too, since theta:member compares
  // those deeply.
  "rmap:unproj_key": x => {
    const def = () => Ev(DEFS.get("rmap:unproj_key"), x);
    if (!Array.isArray(x) || x.length < 2) return def();
    const row = x[0], ctx = x[1];
    if (!Array.isArray(row) || !Array.isArray(ctx) || ctx.length < 3 || !Array.isArray(ctx[1]) || !Array.isArray(ctx[2])) return def();
    const paths = ctx[1], pk = ctx[2], n = Math.min(row.length, paths.length);
    if (!LIVEPATHS.has(paths)) {
      for (const p of paths) if (!Array.isArray(p) || p.length < 2) return def();
      LIVEPATHS.add(paths);
    }
    for (const k of pk) if (typeof k !== "string") return def();
    const out = [];
    for (let i = 0; i < n; i++) {
      const h = paths[i][0];
      if (typeof h !== "string") return def();
      if (pk.includes(h)) out.push(row[i]);
    }
    // on a relation table a key of more than one column is the objectified instance, as the DEF spells it
    return ctx[3] === "T" && out.length > 1 ? [Ev("rmap:proj_objkey", out)] : out;
  },
  "rmap:unproj": x => unprojAll(x),
  "rmap:unproj_sp": x => unprojSparse(x),
  // rmap:sp_of, a row to the cells that hold a value as <position, value>: the DEF zips the row
  // with its positions and drops the empties, a pair for every column of a 310-column row
  "rmap:sp_of": x => {
    if (!Array.isArray(x)) return Ev(DEFS.get("rmap:sp_of"), x);
    const out = [];
    for (let i = 0; i < x.length; i++) if (x[i] !== "#") out.push([i + 1, x[i]]);
    return out;
  },
  // sqlite:run_sp, sqlite:run over sparse rows at the given positions (U9): the DEF expands every row of
  // a chunk before one is bound; this expands each as it binds it, and refuses a row as sqlite:run does
  "sqlite:run_sp": x => {
    const { Database } = require("bun:sqlite");
    const path = String(at(x, 0)), sql = String(at(x, 1)), rows = seq(at(x, 2)), pos = seq(at(x, 3));
    const db = new Database(path, { create: true });
    let n = 0;
    try {
      const st = db.prepare(sql);
      db.exec("begin");
      try {
        for (const r of rows) {
          const cells = seq(r);
          const vals = pos.map((p) => {
            let v = "#";
            for (const c of cells) { const cc = seq(c); if (cc[0] === p) { v = cc[1]; break; } }
            if (v === "#") return null;
            if (Array.isArray(v)) throw new Error("sqlite:run: a sequence where a value belongs in " + sql);
            return v;
          });
          try { st.run(...vals); }
          catch (e) { throw new Error(e.message + " -- row " + (n + 1) + " of " + rows.length + ", beginning " + JSON.stringify(vals.slice(0, 2)).slice(0, 120)); }
          n++;
        }
        db.exec("commit");
      } catch (e) { try { db.exec("rollback"); } catch { } throw e; }
    } finally { db.close(true); }
    return n;
  },
  "cn:ucfacts": x => ucFacts(x),
  "rmap:unproj_live": x => {
    const def = () => Ev(DEFS.get("rmap:unproj_live"), x);
    if (!Array.isArray(x) || x.length < 2) return def();
    const row = x[0], ctx = x[1];
    if (!Array.isArray(row) || !Array.isArray(ctx) || ctx.length < 2 || !Array.isArray(ctx[1])) return def();
    const paths = ctx[1], n = Math.min(row.length, paths.length);
    if (!LIVEPATHS.has(paths)) {
      for (const p of paths) if (!Array.isArray(p) || p.length < 2) return def();
      LIVEPATHS.add(paths);
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = row[i];
      if (typeof v !== "string" && typeof v !== "number") return def();
      if (v === "#") continue;
      out.push([paths[i][0], paths[i][1], v]);
    }
    return out;
  },
  "read:super_of": x => { const rows = at(x, 1), name = at(x, 0);
    const def = () => Ev(DEFS.get("read:super_of"), x);
    if (!Array.isArray(rows)) return def();
    const ln = superLine(rows);
    if (ln === undefined) return def();
    const e = ln.map.get(name);
    return e !== undefined && e[1] < rows.length ? e[0] : ""; },
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
    keySame(out, rows);   // every row keeps its key where it was: the key index is shared (read:has_key)
    superSame(out, rows);   // and no subtype row is ever put: the supertype index is shared (read:super_of)
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
  // (a WeakMap, sound because lambda values are immutable) was byte-identical
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
  // A POPULATION IS UNFOLDED ONCE, NOT ONCE PER WRITE (2026-10-03). theta:unfold_rows is WHILE not all_rowp:
  // flatten, so even a population already in rows asks law:rowp of every row and value:is_scalar of every value
  // to say so, and theta:unfold_descs does the same over the descriptor list. Every write ran the reflection
  // again (adoptStore -> loadReflected) and the emit's re-sourcing, and each read every population it touched
  // through reflect:src_rows and store:fix_desc: on a copy of support's store one Contact Submission POST asked
  // law:rowp 9.5 million times and value:is_scalar 24.5 million, 118 s of a 223 s profiled write, of
  // populations the write had not touched. Lambda's arrays are values -- a write that changes a population
  // answers a new array for it and leaves every other one the same object -- so the answer for an array is
  // kept by the array's identity, and kept through memoClear, which builds the identity indexes anew and leaves
  // this map as it is: it is true for as long as the array lives, and goes with it. The length is kept beside it
  // and checked, so an array grown in place could never answer for its shorter self. AREST_NOTWIN=theta:unfold_rows
  // gives the DEF's own.
  // THE READINGS ARE READ ONCE, NOT ONCE PER FACT TYPE PER WRITE (2026-10-03). solve:readings is the readings
  // table of a store, a function of its state:readings cell alone, and mcp:tool_reading asks it once per fact
  // type: the tool list a write's validation reads (cmd:mv_pos through mcp:tools) is built again for every new
  // store, so on a copy of support's store one Contact Submission POST asked it 6,751 times, 16.6 s. A write
  // does not change the readings, and the cell it reads is the same object in every store after it, so the
  // answer is kept by that cell's identity. AREST_NOTWIN=solve:readings gives the DEF's own.
  "solve:readings": x => {
    let cell;
    try { cell = Ev("solve:cell", ["state:readings", x]); } catch { return Ev(DEFS.get("solve:readings"), x); }
    if (!Array.isArray(cell)) return Ev(DEFS.get("solve:readings"), x);
    const hit = READINGSOF.get(cell);
    if (hit !== undefined) return hit;
    const v = Ev(DEFS.get("solve:readings"), x);
    READINGSOF.set(cell, v);
    return v; },
  // A SCALAR IS ASKED OF A VALUE NATIVELY (2026-10-03). value:is_scalar is atom or dec:is, and since it learned
  // decimals (2026-09-29) theta:all_atomp, law:rowp and theta:all_rowp ask it of every element of a row or a
  // population through several interpreted calls each: every theta:unfold_atoms over a population (ui:ids, a
  // machine's lookup) and every theta:unfold_rows of a population not yet unfolded is that many calls per value.
  // The twins answer as the DEFs answer: an atom is a scalar; a sequence is one exactly when it is a decimal, three
  // fields, the text decimal and two numbers (value:isint is system:isnum of an atom, and system:isnum holds of a
  // number atom: one that is not eq to its own spelling); fp:and_all answers T of the empty sequence, and law:rowp
  // F of an atom and of the empty sequence. An atom given where a sequence is mapped is the DEF's, which raises as
  // it raises. AREST_NOTWIN=<name> gives the DEF's own.
  "value:is_scalar": x => bool(isScalar(x)),
  "theta:all_atomp": x => (Array.isArray(x) ? bool(x.every(isScalar)) : Ev(DEFS.get("theta:all_atomp"), x)),
  "law:rowp": x => bool(isRow(x)),
  "theta:all_rowp": x => (Array.isArray(x) ? bool(x.every(isRow)) : Ev(DEFS.get("theta:all_rowp"), x)),
  // A SELECTION IS A LOOKUP, NOT A SCAN (2026-10-03). derive:filter_sel <<position, value>, rows> keeps, in their
  // order, the rows whose value at the position is eq to the value (derive:keep_sel), and the closure and the
  // deontic rows ask it of the same populations again and again: on a copy of support's store one Contact
  // Submission POST asked it 33,930 times. A population is a value -- a write that changes it answers a new
  // array -- so the rows are indexed once per position by the value there, kept by the array's identity as
  // theta:unfold_rows keeps its answers, and each ask is a lookup answering a fresh list of the matching rows in
  // the population's order. A position that is not a selector number, the store itself (which the host changes
  // in place), and a row the position cannot be applied to are the DEF's, which answers or raises as it does.
  // AREST_NOTWIN=derive:filter_sel gives the DEF's own.
  "derive:filter_sel": x => filterSel(x),
  "theta:unfold_rows": x => unfoldOnce(UNFOLDROWS, "theta:unfold_rows", x),
  "theta:unfold_descs": x => unfoldOnce(UNFOLDDESCS, "theta:unfold_descs", x),
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
  // in its values. Lambda writes the grouping as one filter over every row PER
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
  // Lambda takes the keys, then for EACH key scans every row again
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
// ---- THE WRITE CLOCK ---------------------------------------------------------
// WHERE A WRITE'S EVALUATION GOES (2026-10-03). The line a served write logs (storeWrite) gave its evaluation
// as one number -- 6.4 s of an 8.8 s assert on support, 9.4 s of a 13.6 s one -- and named nothing inside it.
// So the phases the write paths pass through are clocked by name: each DEF below is entered through
// FASTPRIMS and evaluates its own body, as a DEF with no twin is evaluated, and adds its time to the part it
// names on the clock of the write being served; a part entered again inside itself counts once, and the
// parts that stand at the top are summed apart, so what they did not cover is the rest of the evaluation.
// derive:rule_news adds its time to the head of its rule. A served path starts a clock before its evaluation
// (clockStart) and laps the evaluation and the adoption; with no clock running, a phase is its DEF.
// <DEF, part, the part that holds it>
const WPHASES = [
  ["auth:gate_verb", "gate", null], ["auth:gate_api", "gate", null],
  ["value:typed_in", "typed", null], ["value:typed_row", "typed", null],
  ["main:ab_reg", "register", null], ["main:cr_pre", "register", null],
  ["main:refresh_domains", "domains", "register"], ["main:refresh_domain_of", "domains", "register"],
  ["main:ab_facts", "facts", null], ["ui:factfold", "facts", null],
  ["store:closed_from", "closure", null],
  ["main:delta_of", "delta", "closure"], ["derive:inc_run", "derive", "closure"], ["store:cb_put", "put", "closure"],
  ["derive:rec_put", "record", "closure"], ["store:ev_close", "events", "closure"], ["store:pf_close", "performed", "closure"],
  // AND WHAT A DERIVATION SPENDS OUTSIDE ITS RULES (2026-10-03): on support 1,316 ms of derive, about 150 of it
  // in the three slowest heads' rules; each layer resets its heads, runs its rounds and merges what they found
  ["derive:inc_pairs", "pairs", "derive"], ["derive:inc_layers", "layers", "derive"], ["derive:inc_rset", "reset", "derive"],
  ["derive:inc_loop", "rounds", "derive"], ["derive:inc_after", "merge", "derive"],
  ["ui:violations", "validate", null], ["main:ab_viols", "validate", null],
  ["cmd:validate", "uniqueness", "validate"], ["cmd:mand_viols", "mandatory", "validate"], ["cmd:deo_viols", "deontic", "validate"],
  ["cmd:sub_viols", "subset", "validate"], ["cmd:rec_viols", "recorded", "validate"], ["cmd:dec_viols", "decided", "validate"],
];
// the parts once each, in the order above, with the part that holds each
const WPARTS = [];
for (const [, part, holder] of WPHASES) if (!WPARTS.some((p) => p[0] === part)) WPARTS.push([part, holder]);
// the clock of the write being evaluated, or null
let WCLOCK = null;
function clockStart() {
  const t = performance.now();
  WCLOCK = { t0: t, at: t, parts: new Map(), depth: new Map(), top: 0, covered: 0, keyed: new Map() };
  REFLECTS = [];
  return WCLOCK;
}
// the time since the clock's last lap, as <k>; the evaluation's lap stops the phases' clock
function clockLap(c, k) {
  if (!c) return;
  const t = performance.now();
  c[k] = t - c.at; c.at = t;
  if (k === "lambda" && WCLOCK === c) WCLOCK = null;
}
function clockPart(def, part, top) {
  return (x) => {
    const c = WCLOCK;
    if (c === null) return Ev(DEFS.get(def), x);
    const t = performance.now(), d = c.depth.get(part) || 0;
    c.depth.set(part, d + 1);
    if (top) c.top++;
    try { return Ev(DEFS.get(def), x); }
    finally {
      const dt = performance.now() - t;
      c.depth.set(part, d);
      if (d === 0) c.parts.set(part, (c.parts.get(part) || 0) + dt);
      if (top && --c.top === 0) c.covered += dt;
    }
  };
}
for (const [def, part, holder] of WPHASES) if (!FASTPRIMS.has(def)) FASTPRIMS.set(def, clockPart(def, part, holder === null));
// <DEF, label, what of its operand names the one it is for>: a rule's derivation adds its time to its head, a
// decided constraint's check to its predicate, and a uniqueness check to its fact type (2026-10-03: on support
// a write's validation was 1,060 ms, 561 of it the deciders', and no line said whose)
const WKEYED = [
  ["derive:rule_news", "heads", (x) => x[0][0]],
  ["cmd:dec_one", "deciders", (x) => x[0][1]],
  ["cmd:viol_for", "uniqueness by fact type", (x) => x[0]],
  // and a deontic row's check and a subset row's to the row they check, by its name (2026-10-04: with the
  // deciders at a few ms, a support write's validation is mostly these two arms, and no line said whose)
  ["cmd:dv_row", "deontics", (x) => x[1][0]],
  ["cmd:sc_row", "subsets", (x) => x[1][2][0][0]],
];
for (const [def, label, keyOf] of WKEYED) if (!FASTPRIMS.has(def)) FASTPRIMS.set(def, (x) => {
  const c = WCLOCK;
  if (c === null) return Ev(DEFS.get(def), x);
  const t = performance.now();
  try { return Ev(DEFS.get(def), x); }
  finally {
    let key = "?";
    try { key = String(keyOf(x)); } catch {}
    let m = c.keyed.get(label);
    if (m === undefined) c.keyed.set(label, (m = new Map()));
    m.set(key, (m.get(key) || 0) + performance.now() - t);
  }
});
// `lambda L: <part> <ms> [<the parts it holds>], ..., other <ms>; adopt <ms>; heads <head> <ms>, ...`: the
// clock's laps and parts, and for each keyed label the three it names that took longest
function clockText(c) {
  const ms = (v) => String(Math.round(v));
  const of = (holder) => WPARTS.filter((p) => p[1] === holder && c.parts.has(p[0])).map((p) => {
    const held = of(p[0]);
    return p[0] + " " + ms(c.parts.get(p[0])) + (held.length ? " [" + held.join(", ") + "]" : "");
  });
  const out = [];
  if (c.lambda !== undefined) {
    const top = of(null);
    out.push("lambda " + ms(c.lambda) + (top.length ? ": " + top.join(", ") + ", other " + ms(Math.max(0, c.lambda - c.covered)) : ""));
  }
  if (c.read !== undefined) out.push("read-through " + ms(c.read));
  if (c.adopt !== undefined) out.push("adopt " + ms(c.adopt));
  for (const [, label] of WKEYED) {
    const m = c.keyed.get(label);
    if (m === undefined) continue;
    const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.push(label + " " + top.map((h) => h[0] + " " + ms(h[1])).join(", "));
  }
  return out.join("; ");
}
// ---- INSERT filter fast path ---------------------------------------------
// Lambda filters with a right fold that prepends every survivor:
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
// whose keys agree — a HASH JOIN WRITTEN AS A NESTED LOOP. lambda does this at
// 23 sites over rmap:gmi; on auto.dev the s1p x gmi pair is 1344 x 1344 =
// 1,806,336 iterations, and rmap:childrenN0 re-evaluates a 1085-node COND on
// every one of them.
//   Backus 12.2 I.7: distl o [f, [g1..gn]] == [[f,g1]..[f,gn]], "the analogous
//   law holds for distr" — distr's result is determined by its two arguments,
//   so an equal-keys filter over it may be answered by an index. Meaning is
//   lambda's; this is only strategy.
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
  // length 5: the pair is built by form[4] — lambda usually writes the operand
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
// AREST_STACK=1 keeps the lambda frame stack without the timing: the stack at
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
// is the lambda's, so under AREST_PROFILE an uncaught throw prints it,
// outermost first (support's law report died with "INSERT on empty" and no
// law printed, 2026-09-06).
if (STACKS) process.on("uncaughtException", (e) => {
  console.error("lambda stack at throw: " + ((e && e.lambdaStack) || "(no lambda frame)"));
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
  if (e && typeof e === "object" && e.lambdaStack === undefined) e.lambdaStack = PROFSTACK.map((f) => f[0]).join(" > ");
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
  // lambda stack at the report, outermost first, is the answer (support's
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
  // measurement repeated by hand. That vocabulary went to apps/archive with
  // arest-dev on 2026-09-23, so no served corpus reads these facts until an app
  // composes it again. AREST_PROFILE_FACTS names the file and
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
  // AREST_SAMPLE_GC=1 collects before it says what the heap holds, so the line is what is LIVE at
  // that stack and not what the collector has yet to reclaim: a working set that climbs is garbage
  // or data, and only a forced collection tells which (2026-10-01, support's in-place compile)
  // AREST_SAMPLE_RSS=1 says what the process holds at that stack WITHOUT collecting, so the line
  // follows the curve a release run draws and a forced collection does not flatten it
  if (process.env.AREST_SAMPLE_RSS) {
    const m = process.memoryUsage();
    console.error(label + " held: rss " + Math.round(m.rss / 1048576) + " MB, heap used " + Math.round(m.heapUsed / 1048576) + " MB, external " + Math.round((m.external || 0) / 1048576) + " MB");
  }
  if (process.env.AREST_SAMPLE_GC && typeof Bun !== "undefined" && Bun.gc) {
    const t = performance.now(); Bun.gc(true); const hs = require("bun:jsc").heapStats();
    console.error(label + " live: rss " + Math.round(process.memoryUsage().rss / 1048576) + " MB, heap " + Math.round(hs.heapSize / 1048576) + " MB in " + hs.objectCount + " objects after a " + Math.round(performance.now() - t) + " ms collection");
    // AREST_SAMPLE_GC=2 says what those objects ARE: the eight most numerous types the heap holds
    if (process.env.AREST_SAMPLE_GC === "2" && hs.objectTypeCounts) {
      const kinds = Object.entries(hs.objectTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.error(label + " kinds: " + kinds.map(([k, n]) => k + " " + n).join("  "));
    }
  }
  // AREST_SAMPLE_MEMO=1 says which names hold the memo's answers; =2 then empties it and collects,
  // so the line after says what the memo alone was keeping alive (a diagnostic: it slows the run)
  if (process.env.AREST_SAMPLE_MEMO) {
    const rows = [];
    let total = 0;
    // an answer's weight: its elements, two levels down, a rough measure of what it keeps alive
    const weigh = (v) => { if (!Array.isArray(v)) return 1; let w = 1 + v.length; for (const e of v) if (Array.isArray(e)) w += e.length; return w; };
    const walk = (m, depth) => { let w = 0; for (const v of m.values()) w += (v instanceof Map && depth < 6) ? walk(v, depth + 1) : weigh(v); return w; };
    let wtotal = 0;
    for (const [name, node] of EVMEMO) { const h = (node && node.held) || 0; const w = walk(node, 0); total += h; wtotal += w; rows.push([name, h, w]); }
    rows.sort((a, b) => b[2] - a[2]);
    console.error(label + " memo: " + total + " answers weighing " + wtotal + " under " + EVMEMO.size + " names (" + EVMEMON + " since the bound): " + rows.slice(0, 14).map(([k, n, w]) => { const st = MEMOSTAT.get(k) || [0, 0]; return k + " " + n + "/" + w + " (" + st[1] + " of " + st[0] + ")"; }).join("  "));
    if (process.env.AREST_SAMPLE_MEMO === "2" && typeof Bun !== "undefined" && Bun.gc) {
      memoEmpty(); Bun.gc(true);
      const hs2 = require("bun:jsc").heapStats();
      console.error(label + " without memo: rss " + Math.round(process.memoryUsage().rss / 1048576) + " MB, heap " + Math.round(hs2.heapSize / 1048576) + " MB in " + hs2.objectCount + " objects");
    }
  }
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
// A LONG EVALUATION COLLECTS WHEN IT HAS GROWN, NOT WHEN THE COLLECTOR GETS ROUND TO IT
// (2026-10-01). An app check is one synchronous evaluation, so no timer fires inside it and
// the collector runs when the engine decides to. On a copy of support.auto.dev`s store the
// in-place compile peaked at 4.6 GB working set while its live heap stayed under about 0.9 GB:
// forcing a collection every two seconds (AREST_SAMPLE_GC under the sampler) held the same
// compile at 2.1 GB, so most of the peak was garbage nobody had collected. On a 16 GB machine
// shared with other sessions that peak is what refuses the check. So the evaluator counts
// definition dispatches, and every 2^18 of them asks how big the JS heap is; past
// AREST_GC_MB (768 by default) and past half again what the last collection left live, it
// collects in full. The heap and not the process: the engine keeps freed pages for a while
// after a collection, so the resident size does not fall at once, and a bar set from it
// rose with every collection until none came (measured the same day, 2.76 GB and climbing).
// A large live heap raises the bar with it, so it is not collected over and over.
// AREST_GC_MB=0 turns it off. No answer changes: this is when garbage goes, never what is
// computed.
let GCN = 0, GCNEXT = 0;
const GCBASE = (process.env.AREST_GC_MB === undefined ? 768 : Number(process.env.AREST_GC_MB)) * 1048576;
function gcPressure() {
  if (!(GCBASE > 0) || typeof Bun === "undefined" || !Bun.gc) return;
  if (process.memoryUsage().heapUsed < Math.max(GCBASE, GCNEXT)) return;
  Bun.gc(true);
  GCNEXT = process.memoryUsage().heapUsed * 1.5;
}
function Ev(f, x) {
  if (typeof f === "number") {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    if (f < 1 || f > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[f - 1];
  }
  if (typeof f === "string") {
    if (DEFS.has(f)) {
      if ((++GCN & 0x3ffff) === 0) gcPressure();
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
  // meant the combining forms were host code by construction: a lambda
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
  // fast path taken only when the form atom is NOT shadowed by lambda -- so it
  // is an optimization of the general case, not a separate dispatch. A
  // sequence head (a computed form) goes the general way, which the switch
  // could never express at all.
  return compiled(f)(x);
}

// ---- THE COMPILED FORM ----------------------------------------------------
// Sam, 2026-09-07, on the sample that put COMP and CONS at 55 to 65 percent of
// self time on every store: "so a better eval strategy will squeeze out the
// performance?" -- for the constant, yes. Applying a form resolved it every
// time: seq the node, read the head, ask DEFS whether lambda shadows it, pick
// the switch arm, look the join pattern up, and for CONS go through the name
// dispatch (four map lookups) into the twin. A form node is now compiled ONCE
// into a closure with all of that resolved, its children compiled the same
// way and bound, and applying the form is applying the closure. Meaning is
// untouched: each arm is the interpreter's arm with its decisions hoisted,
// a name still goes through Ev (twins, memo, profiler and stamp as before), a
// selector is the selector, CONS and CONST compile to what their twins
// answered, a head lambda defines is fetched as tau clause (c) says, and a
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
//
// A NAME THAT IS NEVER ASKED THE SAME THING TWICE IS NOT MEMOISED (2026-09-23).
// memoable() admits every rmap: and state: definition, and the projection's
// per-row and per-cell names are among them. On arest-dev's compile rmap:proj_val
// stored 1,213,363 answers and was given back none, rmap:proj_carry 1,121,593 and
// none, and loading the store rmap:unproj_cell stored 2,140,079 and none. Each
// entry is a chain of Maps holding its argument alive, so those names filled
// the memo to its bound 31 times in one compile, and every time the bound
// emptied it, it emptied rmap:unproj_ft (2.15M answers given back) and rmap:mat
// (111k) with them -- the carry's first table then spent 8 s recomputing what
// had just been thrown away. So each name counts what it stored and what it
// was given back, and once it has stored MEMO_JUDGED answers and been given back
// fewer than one in MEMO_EARNS it is applied bare for the rest of the process
// and its entries go. The names that earn the memo answer from it 55 to 99
// percent of the time (rmap:proj_step, rmap:unproj_cells, rmap:unproj_ft,
// rmap:mat) and the ones that do not answer 0 to 3 percent, so the line sits in
// an empty gap; a name asked only a few thousand times is never judged at all.
// The counts outlive memoClear and the bound: they describe how a name is
// CALLED, which a mutation of the store does not change, not what it answered.
//
// AND NO ONE NAME HOLDS MORE THAN MEMO_HELD ANSWERS. Taking the never-asked names
// out took the bound's emptying out with them, and on support.auto.dev that
// emptying had been the only thing letting go of rmap:unproj_cells: a row's
// cells, zipped, asked for twice while that row is read and never again, 80,383
// of them held alive to the end of the load. So a name that has stored
// MEMO_HELD answers since its entries last went loses them -- its own, not the
// memo's, so rmap:mat keeps every answer it earns while rmap:unproj_cells keeps
// the rows it is still reading. The count rides on the name's own map, which
// memoClear and the size bound drop with everything else. Measured booting
// support from a copy of its store, twice each: the module the router ran
// peaked at 1,638 and 1,687 MB private and settled at 980 and 967; the same
// carriers composed with both rules peaked at 1,280 and 1,266 and settled at
// 861 and 848, the boot 24.3-24.9 s to 21.9-22.6. A bound of 1,024 measured
// the same as 4,096, and 16,384 gave back most of the saving.
//
// The memo is evaluator quality and never meaning, so none of this moves an
// answer: the compile's two carriers came out byte-identical and its store row
// for row.
//
// AND NO NAME, AND NOT THE MEMO, KEEPS MORE THAN A BOUNDED WEIGHT OF ANSWERS
// (2026-10-02). Both bounds above count answers, and an answer can be a whole
// table. support's check, on a copy of its store, stored every table's rows
// under rmap:proj_rows and rmap:proj_entrows as it wrote them -- 404 and 207
// answers, none of them asked for again -- and when its write peaked the memo
// held 47.6 million elements, counted two levels down, with a heap of 1,005 MB
// after a full collection; the one time the 400,000-answer bound emptied the
// memo mid-check, the heap after a collection fell from 661 MB to 358. So each
// answer stored is weighed (memoWeight: its elements and theirs, a text a
// sixteenth of its length), a name whose answers since its entries last went
// weigh MEMO_NAME_W loses them, and is applied bare from then on if by then it
// has been given back fewer than one in MEMO_EARNS of its stores, and the memo
// is emptied when what it holds weighs MEMO_ALL_W, as it is past 400,000
// answers. The weighing is a pass over what was just computed.
const MEMO_JUDGED = 4096;
const MEMO_EARNS = 8;
const MEMO_HELD = 4096;
const MEMO_NAME_W = 1 << 20;
const MEMO_ALL_W = 1 << 22;
const MEMOSTAT = new Map();   // name -> [stored, given back, applied bare]
function memoWeight(v) {
  if (typeof v === "string") return 1 + (v.length >> 4);
  if (!Array.isArray(v)) return 1;
  let w = 1 + v.length;
  for (let i = 0; i < v.length; i++) {
    const e = v[i];
    if (Array.isArray(e)) w += e.length;
    else if (typeof e === "string" && e.length > 64) w += e.length >> 4;
  }
  return w;
}
// a name's answers go, and their weight with them
function memoForget(f) {
  const root = EVMEMO.get(f);
  if (root === undefined) return;
  MEMOW -= root.weight || 0;
  EVMEMO.delete(f);
}
function memoEmpty() { EVMEMO.clear(); EVMEMON = 0; MEMOW = 0; }
function memoCall(f, x, run) {
  let st = MEMOSTAT.get(f);
  if (st === undefined) { st = [0, 0, false]; MEMOSTAT.set(f, st); }
  if (st[2]) return run(x);
  let node = EVMEMO.get(f);
  if (node === undefined) { node = new Map(); node.held = 0; node.weight = 0; EVMEMO.set(f, node); }
  const root = node;
  const chain = (Array.isArray(x) && x.length <= 4) ? [x.length, ...x] : [-1, x];
  for (let i = 0; i < chain.length - 1; i++) {
    let nn = node.get(chain[i]);
    if (nn === undefined) { nn = new Map(); node.set(chain[i], nn); }
    node = nn;
  }
  const last = chain[chain.length - 1];
  if (node.has(last)) { st[1]++; return node.get(last); }
  const v = run(x);
  node.set(last, v);
  const w = memoWeight(v);
  root.weight += w; MEMOW += w;
  if (++st[0] % MEMO_JUDGED === 0 && st[1] * MEMO_EARNS < st[0]) { st[2] = true; memoForget(f); }
  else if (++root.held >= MEMO_HELD) memoForget(f);
  else if (root.weight >= MEMO_NAME_W) { if (st[1] * MEMO_EARNS < st[0]) st[2] = true; memoForget(f); }
  // THE SIZE BOUND TRIMS THE MEMO, NOT THE INDEXES. The bound existed to
  // keep the memo's maps from growing without limit, and it emptied every
  // identity-keyed index with them; those are WeakMaps on immutable lambda
  // values and stay true for as long as the value lives, so wiping them only
  // rebuilt them -- the support report's first ten seconds were rmap:wide_row
  // at 82% of self, most of it re-indexing relations it had indexed before
  // (the profile-and-fix loop, 2026-09-08). The one mutable array is the
  // store, and its mutation points call memoClear, which still clears all.
  if (++EVMEMON > 400000 || MEMOW >= MEMO_ALL_W) memoEmpty();
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
  // a head lambda defines is fetched too; CONS and CONST are lambda's, and when
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
// lambda, writes the answer. None of them may branch on a verb, a method or a
// status -- what those MEAN is lambda's business (ui:route routes, render:json
// renders, http:status_of decides the code, auth:links decides which controls
// a caller is shown). If you are about to add such a branch here, that is how
// a thin host stops being thin.
function run_cli() {

  // THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
  // All dispatch and all text live in lambda `main`; a new operation is a
  // lambda edit, never a host edit. Adding a branch here is how runners die.
  // (An instrumented composition prints the lambda stack of a throw here: bun hands a throw raised
  // while the entry module evaluates -- which is where this runs -- to no uncaughtException
  // handler, so AREST_STACK printed nothing for a CLI run. A release module drops the catch line
  // and keeps the try whole with its finally.)
  // AREST_REFLECT_NOW=1 under the profiler takes one whole reflection pass over the store as booted, before the address,
  // and names each cell it would add -- its rows against the store's, as sets, with some of each side's own -- then
  // whether a second pass over its answer adds any: whether a store a start reads is one the reflection leaves as it
  // is, which a server's first write relies on (REFLECTED_AT, 2026-10-04)
  // AREST_EVAL=<DEF> under the profiler answers that DEF over AREST_EVAL_ARG, JSON in which the string "$CELLS" is the
  // store as booted, before the address: its length when it is a sequence, and its first AREST_EVAL_SHOW elements
  // AREST_REFLECT_STEP=<fact type> under the profiler posts the fact AREST_REFLECT_FACT (JSON, its values) over the store
  // as booted, in memory, and adopts what that answers as a served write does, reflected from the booted store, a
  // fixpoint (law:reflect_rows); then the store its emit re-sources (store:src_all). For each it names the arms whose
  // reads moved and what the reflection took: where a write that moves a status spends its adoption (2026-10-05). It runs
  // AREST_REFLECT_RUNS times (default 2), each from the booted store, so the last is a warm server's
  if (PROFILE && process.env.AREST_REFLECT_STEP) for (let run = 1, booted = CELLS.slice(), runs = Number(process.env.AREST_REFLECT_RUNS) || 2; run <= runs; run++) { const ft = process.env.AREST_REFLECT_STEP; if (run > 1) { CELLS.length = 0; for (const c of booted) CELLS.push(c); memoClear(); } console.error("run " + run + ":"); REFLECTED_AT = booted; let t = performance.now(); const out = Ev("main:post_answer", [CELLS, ft, JSON.parse(process.env.AREST_REFLECT_FACT || "[]")]); console.error("post " + ft + ": " + Math.round(performance.now() - t) + " ms, status " + String(out[1])); const arms = (a, b) => seq(Ev("reflect:arms_moved", [a, b])).map((x) => { const r = Ev("reflect:arm_reads", [x, a]); return String(x[0]) + (r === "#" ? " (reads undeclared)" : " [" + seq(r).map(String).filter((n) => Ev("store:same_at", [n, [a, b]]) !== "T").join(" ") + "]"); }).join(", ") || "none"; t = performance.now(); console.error("arms whose reads the write moved: " + arms(out[2], booted) + " (" + Math.round(performance.now() - t) + " ms to say)"); REFLECTS = []; adoptStore(out[2]); console.error("reflected after the write: " + REFLECTS.map((r) => Math.round(r[0]) + " ms in " + r[1] + " pass(es)").join("; ")); const pops = popsMoved(booted, CELLS) || new Map(), changed = []; for (const [f, [p, q]] of pops) if (popsDiffer(p, q, (rows) => popSorted(rows)[0])) changed.push(f); const sourced = Ev("store:src_all", [changed.map((f) => [f, popSorted(pops.get(f)[1])[1]]), CELLS]); console.error("populations the emit re-sources: " + changed.join(", ") + "; arms whose reads that moved: " + arms(sourced, CELLS)); REFLECTS = []; adoptStore(sourced); console.error("reflected after the emit: " + REFLECTS.map((r) => Math.round(r[0]) + " ms in " + r[1] + " pass(es)").join("; ")); } // @instrument
  if (PROFILE && process.env.AREST_EVAL) { const sub = (v) => (v === "$CELLS" ? CELLS : Array.isArray(v) ? v.map(sub) : v); const t = performance.now(); const v = Ev(process.env.AREST_EVAL, sub(JSON.parse(process.env.AREST_EVAL_ARG || '"$CELLS"'))); console.error("eval " + process.env.AREST_EVAL + ": " + Math.round(performance.now() - t) + " ms, " + (Array.isArray(v) ? v.length + " element(s): " + JSON.stringify(v.slice(0, Number(process.env.AREST_EVAL_SHOW) || 5)).slice(0, 4000) : JSON.stringify(v).slice(0, 4000))); } // @instrument
  if (PROFILE && process.env.AREST_REFLECT_NOW) { const t = performance.now(); const nw = seq(Ev("store:refl_new", CELLS)); const rows = (x) => (x === "#" ? null : seq(x)); const key = (rs) => JSON.stringify(rs.map((r) => JSON.stringify(r)).sort()); console.error("whole pass over the booted store: " + Math.round(performance.now() - t) + " ms, " + nw.length + " cell(s) added: " + nw.map((c) => { const had = rows(Ev("store:cell_rows", [c[0], CELLS])), now = seq(c[1]); const hk = new Set((had || []).map((r) => JSON.stringify(r))), nk = new Set(now.map((r) => JSON.stringify(r))); const extra = now.filter((r) => !hk.has(JSON.stringify(r))), gone = (had || []).filter((r) => !nk.has(JSON.stringify(r))); return String(c[0]) + " " + now.length + (had === null ? " (none held)" : " (held " + had.length + (key(had) === key(now) ? ", the same rows in another order" : ", " + extra.length + " not held, e.g. " + JSON.stringify(extra.slice(0, 12)) + "; " + gone.length + " held and not reflected, e.g. " + JSON.stringify(gone.slice(0, 12))) + ")"); }).join("; ")); const r = Ev("store:reflect_pass", [CELLS, [], [], []]); adoptClosed(r[0][0]); const t2 = performance.now(); const nw2 = seq(Ev("store:refl_new", CELLS)); console.error("a second whole pass over its answer: " + Math.round(performance.now() - t2) + " ms, " + nw2.length + " cell(s) added: " + nw2.map((c) => String(c[0])).join(", ")); } // @instrument
  let out;
  try { out = Ev("main", [CELLS, process.argv.slice(2)]); }
  catch (e) { if (STACKS) console.error("lambda stack at throw: " + ((e && e.lambdaStack) || "(no lambda frame)")); throw e; } // @instrument
  finally { /* the throw, if any, goes on */ }
  // AREST_REPEAT=<n> under the profiler asks the same address n times more, each with the DEF memo emptied as an idle
  // server empties it (memoReleaseWhenIdle) and the profile cleared, so the table is a warm call's: what a served read
  // costs once the store is loaded, which a cold CLI run cannot show (2026-10-04)
  if (PROFILE && Number(process.env.AREST_REPEAT) > 0) for (let i = 0; i < Number(process.env.AREST_REPEAT); i++) { memoEmpty(); PROF.clear(); const t = performance.now(); Ev("main", [CELLS, process.argv.slice(2)]); console.error("repeat " + (i + 1) + ": " + Math.round(performance.now() - t) + " ms"); } // @instrument
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
  // the evaluator and the cells and runs nothing, so a test can drive lambda's
  // own `main` the way the CLI does -- Ev("main", [CELLS, ["case", name]]) -- and
  // assert the answer, without a process per case.
  //
  // Nothing is added: no dispatch, no rendering, no branch. A test that needed
  // either would be testing the runner instead of the lambda.
  // DEFS is exported so a throw can be bisected from outside: the lambda
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
  // writeMetaschema rides here for loadStoreDb's reason and compile.js's: the
  // compiler is the reader module (build.js reader -> run_test), and the host's
  // unit test writes its fixture with the same function rather than restating
  // the layout. storeRaw is what a schemaless load leaves behind, and storeRead
  // what a store read on demand has read so far (null when it was read whole at
  // start): the selects it issued, the tables it read whole and the most times
  // it read any one of them, which only a count can show. memoStat is
  // how the suite sees the memo judge a name: an answer applied bare is the same
  // answer, so nothing else can show that the judgement happened.
  globalThis.AREST = { Ev: Ev, CELLS: CELLS, DEFS: DEFS, composition: COMPOSITION,
    loadStoreDb: loadStoreDb, popSnapshot: popSnapshot, popSnapshotMoved: popSnapshotMoved, adoptStore: adoptStore, emitToDb: emitToDb,
    closeStore: closeStore, storeDb: storeDb, foldLast: () => FOLDLAST,
    writeMetaschema: writeMetaschema, readMetaschema: readMetaschema,
    storeRaw: () => STORE_RAW,
    storeRead: () => (LAZY_STORE ? LAZY_STORE.stats() : null),
    memoHeld: () => { let held = 0; for (const node of EVMEMO.values()) held += (node && node.held) || 0; return held; },
    memoStat: (f) => { const st = MEMOSTAT.get(f); const root = EVMEMO.get(f);
      return st ? { stored: st[0], givenBack: st[1], bare: st[2], held: root ? root.held : 0 } : null; },
    performDeclared: performDeclared, answerWrite: answerWrite,
    // A HOST THAT PUTS A CELL INTO CELLS ITSELF SAYS SO (2026-09-29). ast:fetch answers from an index of
    // the cells array kept by the array's identity, and CELLS.unshift keeps the identity: a cell installed
    // after the first fetch was invisible to every fetch after it. compile.js installs the relational
    // map's artifacts that way, and each rmap:X reads its stored:rmap:X cell through ast:fetch -- so none
    // was ever read; what made the map cheap was the memo. This drops the fetch index, and nothing else.
    cellsChanged: () => { FETCHIDX = new WeakMap(); } };
}
// AND run_test CLOSES HERE, WHICH IS THE WHOLE BUG (2026-09-12). The performer
// was declared INSIDE run_test, so only the test entry point could see it: the
// servers reached the call site and threw ReferenceError, and the form path had
// the same latent fault and had simply never been driven. In-process tests
// passed throughout because importing cases.g.js RUNS run_test, which publishes
// performDeclared on globalThis.AREST -- so the one harness that could see it
// was the one that could not tell me it was unreachable from anywhere else.
// Function declarations hoist, so the line above still binds it.

// THE PERFORMER, and it chooses NOTHING. Lambda says what the call is --
// perform:call_for the method and the address, perform:headers_of the headers
// the backing External System declares with their values, perform:auth_header_of
// which of them carries the credential, perform:body_of the JSON paths joined
// from the entity's own facts -- and this makes it. No method, no path, no
// header name and no field is decided here. If the model does not say it, it
// does not go on the wire. That is the whole reason the last four commits were
// metamodel and lambda rather than a fetch with a hardcoded URL.
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
// A CREDENTIAL IS WRITTEN AS ITS SYSTEM SAYS (2026-09-28). perform:credential_encoding_of answers the
// encoding the Function's backing system declares, and this applies it to the decrypted secret -- the one
// place the plaintext exists, which is why it happens here and nowhere else. 'base64' is the Basic
// scheme's (ClickHouse's `Authorization: Basic` over user:password); absent means as stored. An encoding
// this host does not write answers null, and the caller refuses rather than send the credential raw.
// A FETCHER THIS HOST REGISTERS (2026-10-02). federation.md: a Connector reaches its Source by a Fetcher,
// a definition name resolved at fetch time, so that changing how a Source is reached is registering a
// name, not editing the model. Sam, 2026-10-02: "ideally I'd just want to use what's here ... what is
// ideal for scalability is just registering and resolving them as they are and replacing with growth."
// What is here is the gh CLI, logged in as this machine's user, and the sales inbox as Thunderbird keeps
// it, an mbox. Each registration takes the request lambda built for the call (method, address, query
// parameters) and answers the JSON the Function's yields read, or a refusal in its own words. gh reads no
// credential of the store's, bringing its own login; the mbox is handed what its Source's connection
// carries as a Secret Reference, which names the file. Both only read.
async function runLocal(argv, env) {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", env });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { out, err, code };
}
// gh: the address lambda built for api.github.com, read through `gh api`, GET only.
async function fetchWithGh(req) {
  const origin = "https://api.github.com";
  if (req.method !== "GET") return { status: 405, text: "the gh Fetcher reads; it does not " + req.method };
  if (!req.address.startsWith(origin)) return { status: 400, text: "the gh Fetcher reads " + origin + ", not " + req.address };
  const qs = new URLSearchParams();
  for (const pr of req.params) qs.append(pr[0], pr[1]);
  const path = req.address.slice(origin.length) + (qs.toString() ? "?" + qs.toString() : "");
  let r;
  try { r = await runLocal(["gh", "api", path], process.env); }
  catch (e) { return { status: 502, text: "gh did not run: " + String(e && e.message) }; }
  if (r.code !== 0) return { status: 502, text: "gh api answered: " + r.err.trim().slice(0, 300) };
  try { return { status: 200, body: JSON.parse(r.out) }; }
  catch (e) { return { status: 502, text: "gh api answered a body that is not JSON" }; }
}
// mbox: the file its Source's connection carries as a Secret Reference, handed over decrypted as the
// request's access. Sam, 2026-10-02: "We should have the sales box set by variable, but in .env, it's done
// by secrets readings" -- an app's .env gives it as `DomainConnectsToExternalSystem '<domain>/<system>'
// carries Secret Reference '<file>'.`, and the store keeps it sealed like every Secret Reference. Nothing
// else names the file: no environment variable, no search of a mail profile. Parsed by Python's stdlib
// mailbox; a message Thunderbird marks deleted is skipped. Its rows are one per recipient, filtered by the
// from and to parameters. No answer names the file, a failure's included: what python raised is reduced
// to the name of its exception.
const MBOX_PY = [
  'import email.policy, html, json, mailbox, os, re',
  'from datetime import timezone',
  'from email.parser import BytesHeaderParser, BytesParser',
  'from email.utils import getaddresses, parsedate_to_datetime',
  'NL = chr(10)',
  'CR = chr(13)',
  'want_from = os.environ.get("ARE_FROM", "").strip().lower()',
  'want_to = os.environ.get("ARE_TO", "").strip().lower()',
  'hp = BytesHeaderParser(policy=email.policy.compat32)',
  'bp = BytesParser(policy=email.policy.default)',
  'def addrs(values):',
  '    return [a.strip().lower() for _, a in getaddresses([str(v) for v in values if v]) if "@" in a]',
  'def text_of(msg):',
  '    part = msg.get_body(preferencelist=("plain", "html"))',
  '    if part is None:',
  '        return ""',
  '    try:',
  '        s = part.get_content()',
  '    except Exception:',
  '        s = (part.get_payload(decode=True) or b"").decode(part.get_content_charset() or "utf-8", "replace")',
  '    if part.get_content_type() == "text/html":',
  '        s = re.sub("(?is)<(script|style).*?</(script|style)>", " ", s)',
  '        s = re.sub("(?i)<br */?>|</p>|</div>", NL, s)',
  '        s = html.unescape(re.sub("<[^>]+>", "", s))',
  '    s = s.replace(CR + NL, NL).replace(CR, NL).strip()',
  '    return s[:20000]',
  'box = mailbox.mbox(os.environ["ARE_MBOX"], create=False)',
  'rows, scanned, matched, unnamed = [], 0, 0, 0',
  'for key in box.iterkeys():',
  '    scanned += 1',
  '    head = []',
  '    for line in box.get_file(key):',
  '        if not line.strip():',
  '            break',
  '        head.append(line)',
  '    h = hp.parsebytes(b"".join(head))',
  '    try:',
  '        if int(h.get("X-Mozilla-Status", "0") or "0", 16) & 8:',
  '            continue',
  '    except ValueError:',
  '        pass',
  '    frm, to, cc = addrs(h.get_all("From", [])), addrs(h.get_all("To", [])), addrs(h.get_all("Cc", []))',
  '    if want_from and want_from not in frm:',
  '        continue',
  '    if want_to and want_to not in to and want_to not in cc:',
  '        continue',
  '    mid = (h.get("Message-ID") or "").strip().strip("<>").strip()',
  '    if not mid:',
  '        unnamed += 1',
  '        continue',
  '    matched += 1',
  '    msg = bp.parsebytes(box.get_bytes(key))',
  '    row = {"message_id": mid}',
  '    if frm:',
  '        row["from"] = frm[0]',
  '    try:',
  '        d = parsedate_to_datetime(h.get("Date"))',
  '        if d.tzinfo is not None:',
  '            d = d.astimezone(timezone.utc)',
  '        row["date"] = d.strftime("%Y-%m-%dT%H:%M:%SZ")',
  '    except Exception:',
  '        pass',
  '    if msg.get("Subject"):',
  '        row["subject"] = str(msg.get("Subject")).strip()',
  '    body = text_of(msg)',
  '    if body:',
  '        row["body"] = body',
  '    m = re.search("<([^>]+)>", h.get("In-Reply-To") or "")',
  '    if m:',
  '        row["in_reply_to"] = m.group(1).strip()',
  '    recips = [("to", a) for a in to] + [("cc", a) for a in cc]',
  '    for kind, a in recips or [(None, None)]:',
  '        r = dict(row)',
  '        if kind:',
  '            r[kind] = a',
  '        rows.append(r)',
  'print(json.dumps({"messages": rows, "scanned": scanned, "matched": matched, "unnamed": unnamed}))',
].join(String.fromCharCode(10));
async function fetchFromMbox(req) {
  if (req.method !== "GET") return { status: 405, text: "the mbox Fetcher reads; it does not " + req.method };
  const p = new Map(req.params);
  const file = String(req.access || "");
  if (!file) return { status: 404, text: "no mbox: the connection this Source reads through carries no Secret Reference naming one" };
  let here = false;
  try { here = require("fs").statSync(file).isFile(); } catch (e) { here = false; }
  if (!here) return { status: 404, text: "no mbox: the file its connection's Secret Reference names is not on this machine" };
  let r;
  try {
    r = await runLocal([process.env.AREST_PYTHON || "python", "-c", MBOX_PY],
      Object.assign({}, process.env, { ARE_MBOX: file, ARE_FROM: p.get("from") || "", ARE_TO: p.get("to") || "", PYTHONIOENCODING: "utf-8" }));
  } catch (e) { return { status: 502, text: "python did not run: " + String(e && e.message) }; }
  if (r.code !== 0) {
    const last = r.err.trim().split(String.fromCharCode(10)).slice(-1)[0];
    const raised = /^([A-Za-z_][A-Za-z0-9_.]*)(:|$)/.exec(last.trim());
    return { status: 502, text: "the mbox did not parse: python raised " + (raised ? raised[1] : "an error") };
  }
  let body;
  try { body = JSON.parse(r.out); } catch (e) { return { status: 502, text: "the mbox read answered a body that is not JSON" }; }
  return { status: 200, body, text: "the inbox parsed: " + body.scanned + " messages scanned, " + body.matched + " matched"
    + (body.unnamed ? ", " + body.unnamed + " without a Message-ID skipped" : "") };
}

// The Secret Reference the connection of a Function's backing system carries, decrypted under the key, or
// "" where it carries none: the HTTP read writes it into the header lambda names, and a registration
// takes it as its access. One that does not open under the key is refused by name, never read as none.
function connectionSecret(fn, store, key) {
  const cipher = Ev("perform:secret_of", [fn, store]);
  if (Array.isArray(cipher)) return "";
  let plain;
  try { plain = Ev("hook:read", [String(key || ""), "Secret Reference", String(cipher), store]); }
  catch (e) { throw new Error("not read: the Secret Reference of this connection does not open under this host's AREST_MASTER_KEY (" + String(e && e.message) + ")"); }
  return Array.isArray(plain) ? "" : String(plain);
}
function writtenCredential(fn, secret, store) {
  if (!secret) return secret;
  const enc = Ev("perform:credential_encoding_of", [fn, store]);
  if (Array.isArray(enc)) return secret;
  if (String(enc) === "base64") return Buffer.from(secret, "utf8").toString("base64");
  return null;
}

// WHAT CAME OFF THE LINE IS RECORDED AS AN INSTANCE (task #195; Sam: "Events are object instances"): a Response
// answering the Function, from the Url, with its status and time, asserted as a Failure is. Its body is not kept --
// it powered the facts the read yields (Sam: "Let's not keep the body in this instance, it just powers the facts").
function recordResponse(fn, url, status, say) {
  let facts;
  try { facts = Ev("fed:response_facts", [String(fn), String(url), String(status), new Date().toISOString()]); } catch (e) { return; }
  const clock = clockStart();
  const prior = CELLS.slice();
  let out;
  try { out = Ev("main:as", [CELLS, SYSTEM_LOGIN, ["assert", facts]]); }
  catch (e) { if (say) say("response record threw for " + fn + ": " + String((e && e.message) || e)); return; }
  finally { clockLap(clock, "lambda"); }
  if (out.length > 2 && String(out[1]) === "T") {
    adoptStore(out[2]);
    clockLap(clock, "adopt");
    const why = storeWrite(prior, "response " + fn, clock);
    if (why !== null && say) say("response record NOT COMMITTED " + fn + ": " + why.slice(0, 300));
  } else if (say) say("response record REFUSED " + fn + ": " + String(out[0]).slice(0, 300));
}

async function performDeclared(before, after, opts) {
  const o = opts || {};
  const send = o.send || ((m, a, h, b) => fetch(a, { method: m, headers: h, body: JSON.stringify(b) })
    .then((r) => r.text().then((t) => ({ status: r.status, text: t }))));
  const done = [];
  let rows;
  try { rows = Ev("main:performed", [before, after]); } catch (e) { return done; }
  // A WRITE OF A FEDERATED FACT IS A WRITE TO ITS SYSTEM (task #193): fed:ot_writes answers the
  // :set and :unset calls the write's federated facts make, in main:performed's shape. The verb
  // that wrote is passed so a sync, which is the system speaking, is never written back.
  try {
    const fw = Ev("fed:ot_writes", [before, after, String(o.verb || "")]);
    if (Array.isArray(fw) && fw.length) rows = (Array.isArray(rows) ? rows : []).concat(fw);
  } catch (e) { /* no federated object type: nothing to write through */ }
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
    let address = Array.isArray(call[1]) ? "" : String(call[1]);
    if (!method || !address) { done.push({ predicate, entity, refused: "the model does not fully address this call" }); continue; }
    // THE QUERY IS DECLARED AS THE BODY IS (task #193): perform:params_of answers the Function's own
    // Query Parameters and those it fills from the subject; a hole refuses the call naming the
    // parameter, and the pairs are encoded here as a fetch's are.
    const qs = new URLSearchParams();
    let qhole = null;
    for (const q of Ev("perform:params_of", [predicate, entity, after])) {
      if (Array.isArray(q[1])) { qhole = String(q[0]); break; }
      qs.append(String(q[0]), String(q[1]));
    }
    if (qhole) { done.push({ predicate, entity, refused: "declared query parameter '" + qhole + "' has no fact to fill it" }); continue; }
    if (qs.toString()) address += (address.includes("?") ? "&" : "?") + qs.toString();
    const headers = {};
    for (const h of Ev("perform:headers_of", [predicate, after])) headers[String(h[0])] = String(h[1]);
    // THE CREDENTIAL COMES FROM THE CONNECTION, DECRYPTED HERE AND NOWHERE ELSE.
    // perform:secret_of answers the ciphertext exactly as stored -- lambda never
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
        secret = writtenCredential(predicate, Array.isArray(plain) ? "" : String(plain), after);
      }
    }
    if (secret === null) { done.push({ predicate, entity, refused: "the credential encoding this connection declares is not one this host writes" }); continue; }
    if (!Array.isArray(auth) && secret) headers[String(auth)] = (headers[String(auth)] || "") + (headers[String(auth)] ? " " : "") + secret;
    const body = {};
    let hole = null;
    for (const b of Ev("perform:body_of", [predicate, entity, after])) {
      if (Array.isArray(b[1])) { hole = String(b[0]); break; }
      body[String(b[0])] = String(b[1]);
    }
    if (hole) { done.push({ predicate, entity, refused: "declared path '" + hole + "' has no fact to fill it" }); continue; }
    // A UNARY IS A TRUTH, NOT A TEXT (task #193; Sam: "AREST should be able to handle unaries"): the
    // fields a federated unary's write sets are written as the JSON booleans true and false.
    for (const fl of Ev("fed:ot_flags", [predicate, after])) body[String(fl[0])] = String(fl[1]) === "T";
    // A HOSTNAME IS RESOLVED WHERE THE REQUEST IS MADE (2026-10-01, Sam: "keep SSRF check").
    // decide:ssrf judges a URL as written, because a deontic computed on every write must not
    // wait on the network. The send is where the name is looked up anyway, so a live send looks
    // it up first, asks lambda (perform:blocked_address) whether any address it got lies in a
    // CIDR Block the store declares, and is refused if one does. Every address is handed back
    // as `External System resolves to Resolved Address`, refused or not, and decide:ssrf reads
    // those, so a name that resolved inside a blocked range is a violation in the store as well.
    // A stubbed send makes no request and looks nothing up.
    const observed = [];
    if (mode === "live" && !o.send) {
      const hostRaw = Ev("net:host", address);
      const bare = (Array.isArray(hostRaw) ? "" : String(hostRaw)).replace(/^\[/, "").replace(/\]$/, "");
      let addrs;
      if (require("node:net").isIP(bare) || bare === "localhost") addrs = [bare];
      else {
        try { addrs = (await require("node:dns").promises.lookup(bare, { all: true })).map((r) => String(r.address)); }
        catch (e) { done.push({ predicate, entity, refused: "the host " + bare + " does not resolve (" + String((e && e.code) || e) + ")" }); continue; }
      }
      const systemRaw = Ev("perform:system_of", [predicate, after]);
      if (!Array.isArray(systemRaw)) for (const a of addrs) observed.push(["ExternalSystemResolvesToResolvedAddress", String(systemRaw), a]);
      const blocked = Ev("perform:blocked_address", [addrs, after]);
      if (!Array.isArray(blocked) && String(blocked)) {
        done.push({ predicate, entity, refused: "the host " + bare + " resolves to " + String(blocked) + ", inside a blocked range", observed });
        continue;
      }
    }
    // A DRY STUB MUST LOOK LIKE THE REAL ANSWER OR IT PROVES HALF THE LOOP. The
    // first version answered plain text, which is not JSON, so the response
    // projection found nothing and reported no asserts -- and "no asserts" would
    // have read as `the model yields nothing here` when it actually meant `my own
    // stub said nothing`. Absence caused by the harness is not evidence. The id is
    // visibly fake so a dry assert can never be mistaken for a real receipt.
    // A SEND THAT THROWS IS A SEND THAT FAILED (2026-10-04, task #173): a host that does not resolve or a connection
    // refused answers no status, and it is recorded as a failure like a 4xx, not lost with the performer.
    let answer;
    if (mode === "live" || o.send) {
      try { answer = await send(method, address, headers, body); }
      catch (e) { answer = { status: 0, text: "", error: String((e && e.message) || e) }; }
    } else answer = { status: 0, text: JSON.stringify({ id: "dry-run-not-sent" }) };
    if (mode === "live" || o.send) { try { Ev("log:response", [predicate, method, address, String(answer.status), String(answer.text || answer.error || "")]); } catch (e) { } recordResponse(predicate, address, answer.status); }
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
    const subject = Ev("perform:subject_of", [predicate, entity, after]);
    const subj = Array.isArray(subject) ? entity : String(subject);
    if (parsed && typeof parsed === "object") {
      for (const t of Ev("perform:yields_of", [predicate, after])) {
        const path = String(t[0]), ft = String(t[1]);
        if (!(path in parsed)) continue;            // the service did not return it
        const row = [ft, subj, String(parsed[path])];
        (ceiling.indexOf(ft) >= 0 ? asserts : outside).push(row);
      }
    }
    // AND WHAT THE CALL ESTABLISHED BY SUCCEEDING (#131). perform:success_of answers the rows a
    // successful call asserts -- `Email Message is sent via Send Tool` on support, which Resend's
    // answer never states -- and success is a 2xx. A call that failed, or a dry run's stub, reports
    // them as onSuccess and asserts none, so a guard waiting on one of them keeps waiting.
    let succeeded = answer && Number(answer.status) >= 200 && Number(answer.status) < 300;
    // AN UPDATE THAT MATCHED NOTHING DID NOTHING (task #193). Payload answers a PATCH whose query
    // names no document 200 with none in docs, so for a federated write the dialect's matched path
    // must list one, or the call is recorded as the failure it is.
    const matchedRaw = Ev("fed:ot_matched", [predicate, after]);
    if (succeeded && !Array.isArray(matchedRaw) && (mode === "live" || o.send)) {
      const m = parsed && parsed[String(matchedRaw)];
      if (!Array.isArray(m) || m.length === 0) { succeeded = false; answer = Object.assign({}, answer, { status: 404, text: "the update matched no document: " + String(answer.text || "").slice(0, 300) }); }
    }
    const onSuccess = [];
    for (const r of Ev("perform:success_of", [predicate, subj, after])) {
      const row = r.map(String);
      if (!succeeded) { onSuccess.push(row); continue; }
      (ceiling.indexOf(row[0]) >= 0 ? asserts : outside).push(row);
    }
    // AND A CALL THAT WENT OUT AND FAILED IS RECORDED AS A FAILURE (2026-10-04, task #173). perform:failure_rows
    // answers the Failure's facts, which writeBack asserts together; a dry run sent nothing and records none.
    let failures = [];
    if ((mode === "live" || o.send) && !succeeded) {
      const reason = answer && answer.error ? answer.error
        : "HTTP " + String(answer ? answer.status : "?") + ": " + String((answer && answer.text) || "").slice(0, 500);
      failures = Ev("perform:failure_rows", [predicate, entity, reason, new Date().toISOString(), after]).map((r) => r.map(String));
    }
    // AND A FEDERATED WRITE THAT FAILED IS TAKEN BACK (task #195; Sam: "Fail should probably retract"): fed:ot_undo
    // answers the one write that leaves the store as the system holds it, or nothing for any other predicate.
    let undo = [];
    if ((mode === "live" || o.send) && !succeeded) { try { const u = Ev("fed:ot_undo", [predicate, entity, after]); if (Array.isArray(u) && u.length === 2) undo = u; } catch (e) { } }
    done.push({ predicate, entity, method, address, sent: body, ceiling, answer, asserts, outside, onSuccess, observed, failures, undo });
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
// <the store before the write>: the rows the write CELLS holds moved, stored. When the database refuses a
// statement, or anything fails before the rows are stored, nothing is stored, CELLS is the store before the
// write again, and the failure is answered.
// AND EVERY WRITE SAYS WHAT IT TOOK, ON ONE LINE (2026-10-03). No write on a served app could be timed but by
// serving a copy of its store with a clock put in for the day. Each now writes one line to stderr, which the
// router keeps in its log behind the app's name: <what> is the verb, or the method and resource, the write was
// served as, and <clock> the write's clock (clockStart), started when it was asked, so the total takes in the
// evaluation, and the evaluation is given by its parts.
function storeWrite(prior, what, clock) {
  const rep = {};
  try { emitToDb(null, CELLS, prior, rep); }
  catch (e) {
    if (EMIT_STORED) { sayWrite(what, clock, rep, "stored, then failed"); throw e; }        // stored, and what failed came after
    adoptStore(prior);
    sayWrite(what, clock, rep, "NOT COMMITTED, and the write answers why");
    return String((e && e.message) || e);
  }
  sayWrite(what, clock, rep, null);
  return null;
}
// `write <what> <total> ms: evaluation (<its parts>), snapshot, change test, plan and write, tail -- <what it
// wrote>`, the parts in ms as far as the write reached them, the evaluation's as its clock gives them
// (clockText), and a table rewritten whole by name with the rows it took. The reason a write failed is in its
// answer and not here: the router takes a line of an app's stderr that says "error:" as the app's failure,
// and answers every call after it with that line.
function sayWrite(what, clock, rep, failed) {
  const end = performance.now();
  const ms = (v) => String(Math.round(v));
  const of = (n, one) => n + " " + one + (n === 1 ? "" : "s");
  const asked = !!clock && typeof clock.t0 === "number";
  const parts = asked ? clockText(clock) : "";
  const laps = [["evaluation", asked && rep.start !== undefined ? rep.start - clock.t0 : undefined],
    ["snapshot", rep.snapshot], ["change test", rep.change], ["plan and write", rep.write], ["tail", rep.tail]]
    .filter((l) => l[1] !== undefined).map((l) => l[0] + " " + ms(l[1]) + (l[0] === "evaluation" && parts ? " (" + parts + ")" : "")
      + (l[0] === "plan and write" && rep.writeParts ? " [re-source " + ms(rep.writeParts.resource) + ", touched " + ms(rep.writeParts.touched)
        + ", plan " + ms(rep.writeParts.plan) + (rep.writeParts.slow ? " (" + rep.writeParts.slow.map((s) => s[0] + " " + ms(s[1])).join(", ") + ")" : "") + ", rows " + ms(l[1] - rep.writeParts.resource - rep.writeParts.touched - rep.writeParts.plan) + "]" : ""));
  const whole = rep.rewrote || [];
  const wrote = failed ? failed
    : rep.moved === undefined ? "no store to write"
    : !rep.moved ? "nothing moved"
    : of(rep.moved, "population") + " moved, " + of(rep.written - whole.reduce((s, r) => s + r[1], 0), "row")
      + " deleted or inserted in " + of(rep.byRow, "table") + " by row"
      + (whole.length ? ", rewritten whole: " + whole.map((r) => r[0] + " " + r[1]).join(", ") : "");
  const begin = asked ? clock.t0 : rep.start !== undefined ? rep.start : end;
  // and each reflection the write's stores took (loadReflected): its time, its passes, and whether one was whole
  const reflected = REFLECTS.map((r) => ms(r[0]) + " ms in " + r[1] + (r[1] === 1 ? " pass" : " passes") + (r[2] ? ", one whole" : "")).join(", ");
  REFLECTS = [];
  console.error("write " + String(what || "") + " " + ms(end - begin) + " ms" + (laps.length ? ": " + laps.join(", ") : "") + " -- " + wrote
    + (reflected ? "; reflected " + reflected : ""));
  // under the profiler, each served write's own table of definitions, and the table cleared for the next (2026-10-05)
  if (PROFILE) { profReport("write " + String(what || "")); PROF.clear(); } // @instrument
}
const notCommitted = (why) => JSON.stringify(["not_committed", why]);
// <main:api's answer>: the store it made adopted, the rows a write moved stored, and <body, status> to answer.
// <what> and <clock> are the request and its clock, for the line the write logs (storeWrite).
function answerWrite(out, what, clock) {
  let body = String(out[0]), status = Number(out[1]) || 500;
  if (out.length > 2) {
    const wrote = Number(out[1]) < 400;   // a refusal made no successor
    const prior = CELLS.slice();
    adoptStore(out[2]);
    clockLap(clock, "adopt");
    if (wrote) {
      const why = storeWrite(prior, what, clock);
      if (why === null) maybePerform(prior, CELLS, undefined, what);
      else { body = notCommitted(why); status = 500; }
    }
  }
  return [body, status];
}
// A LINE THE PERFORMER WRITES NEVER READS AS THE APP'S FAILURE (2026-10-03). The router takes a line of an
// app's stderr that says "error:" (/error:/i) as the app's failure, and refuses every call after it with that
// line until the app is started again (mcp-router.js). The performer's lines carry text from outside the
// store: an Error's String begins "Error:", a failed JSON parse says "JSON Parse error: ...", a platform's
// answer may say "Validation error: ...", and a fact type whose name ends in Error meets the colon its line
// puts after it. So each line is written with every "error:" as "error --": the colon is the only character
// taken out, and what stands in its place ends in "-", so no "error:" is left and none is made.
function quiet(say) { return (line) => say(String(line).replace(/(error):/gi, "$1 --")); }
function maybePerform(prior, after, log, verb) {
  if (!prior || prior === after) return;
  const say = quiet(log || console.log);
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
  performDeclared(prior, after, { master: process.env.AREST_MASTER_KEY, verb })
    .then((r) => {
      for (const one of r) say("performed " + JSON.stringify(one));
      writeBack(r, say);
    })
    .catch((e) => say("performer failed: " + String((e && e.message) || e)));
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
// EVERY TRANSPORT PASSES A LOGIN (Sam, 2026-10-03). A write asks the app's authorization designation
// who is writing (main:api0's gate, and main:as for the MCP's write verbs), so no path may write as
// nobody: where an app designates one, the empty caller is refused. The HTTP tail passes the
// x-arest-caller header as sent; the MCP passes each call's `caller`, which the router sets to the
// login its client named when it connected (AREST_LOGIN in that session's env, mcp-router.js) and a
// fact tool's own `caller` overrides, with the header's trust; and the host's own writes -- a
// performer's write-back, a registration at the MCP's start -- pass a system login, cicd@repo.do
// unless AREST_SYSTEM_LOGIN names another. An app that designates an authorization fact type grants
// the logins in its own store; one that designates none takes every write, as before.
// It was system@repo.do, a login that exists nowhere (Sam, 2026-10-06: "There is no system@repo.do";
// "use cicd account"): cicd@repo.do is the agent login, a bot account in auth.vin.
const SYSTEM_LOGIN = process.env.AREST_SYSTEM_LOGIN || "cicd@repo.do";
function writeBack(done, log) {
  const say = quiet(log || console.log);
  for (const one of done) {
    // `observed` is what the platform saw at the send -- the addresses the host resolved to --
    // and not a yield of the call, so it is outside the may-create ceiling by kind and is
    // written the same way, through main:api, where an alethic constraint can still refuse it.
    for (const a of (one.asserts || []).concat(one.observed || [])) {
      if (!Array.isArray(a) || a.length < 2) continue;
      const ft = String(a[0]);
      const args = a.slice(1).map(String);
      const clock = clockStart();
      const prior = CELLS.slice();
      let out;
      try { out = Ev("main:api", [CELLS, "POST", ft, SYSTEM_LOGIN, args]); }
      catch (e) { say("write-back threw on " + ft + ": " + String((e && e.message) || e)); continue; }
      finally { clockLap(clock, "lambda"); }
      if (out.length > 2 && Number(out[1]) < 400) {
        adoptStore(out[2]);
        clockLap(clock, "adopt");
        const why = storeWrite(prior, "write-back POST " + ft, clock);
        if (why === null) say("wrote back " + JSON.stringify([ft].concat(args)));
        else say("write-back NOT COMMITTED " + ft + ": " + why.slice(0, 300));
      } else {
        say("write-back REFUSED " + ft + ": " + String(out[0]).slice(0, 200));
      }
    }
    // A FAILED CALL'S FAILURE IS ONE ASSERT (2026-10-04, task #173): four of a Failure's roles are mandatory, so its
    // facts go in together through the assert verb, where a fact POST at a time would be refused at the first.
    if (Array.isArray(one.failures) && one.failures.length) {
      const clock = clockStart();
      const prior = CELLS.slice();
      let out;
      try { out = Ev("main:as", [CELLS, SYSTEM_LOGIN, ["assert", one.failures]]); }
      catch (e) { say("failure record threw for " + one.predicate + ": " + String((e && e.message) || e)); continue; }
      finally { clockLap(clock, "lambda"); }
      if (out.length > 2 && String(out[1]) === "T") {
        adoptStore(out[2]);
        clockLap(clock, "adopt");
        const why = storeWrite(prior, "write-back failure " + one.predicate, clock);
        if (why === null) say("recorded the failure of " + one.predicate + " for " + one.entity);
        else say("failure record NOT COMMITTED " + one.predicate + ": " + why.slice(0, 300));
      } else {
        say("failure record REFUSED " + one.predicate + ": " + String(out[0]).slice(0, 300));
      }
    }
    // the failed write taken back: <method, fact>, through main:api, which writes no call through
    if (Array.isArray(one.undo) && one.undo.length === 2 && Array.isArray(one.undo[1])) {
      const m = String(one.undo[0]), f = one.undo[1].map(String);
      const clock = clockStart();
      const prior = CELLS.slice();
      let out;
      try { out = Ev("main:api", [CELLS, m, f[0], SYSTEM_LOGIN, f.slice(1)]); }
      catch (e) { say("undo threw on " + f[0] + ": " + String((e && e.message) || e)); continue; }
      finally { clockLap(clock, "lambda"); }
      if (out.length > 2 && Number(out[1]) < 400) {
        adoptStore(out[2]);
        clockLap(clock, "adopt");
        const why = storeWrite(prior, "undo " + m + " " + f[0], clock);
        if (why === null) say("took back " + m + " " + JSON.stringify(f));
        else say("undo NOT COMMITTED " + f[0] + ": " + why.slice(0, 300));
      } else say("undo REFUSED " + f[0] + ": " + String(out[0]).slice(0, 200));
    }
  }
}

// A create ANSWERS a store. main:api returns <body, status, D-prime> for a
// transition and <body, status> for a read, because following a nav link makes
// no new store. Adopting it is transport's business -- D is what this file
// holds -- but WHAT the new store contains is lambda's: main:create_closed put
// the fact where the derive path reads and closed the store under its rules.
// Mutated in place so the array identity survives, then the memo is dropped:
// Ev keys on the store REFERENCE, so a store whose contents changed under the
// same reference would keep answering from the old one.
// set once the boot's own loading is done; see adoptStore
let BOOTED = false;

function adoptStore(next) {
  if (!Array.isArray(next) || next.length === 0) return false;
  // next may BE CELLS -- lambda answers the same array when a step changes nothing,
  // and clearing in place would empty the thing we are about to copy from.
  //
  // AND A WRITE THAT MADE NO SUCCESSOR STILL BUILT ONE (2026-09-25). A refused write, or one
  // that changed nothing, hands back the store it was given, so nothing is adopted -- and the
  // memo, which only a new store cleared, kept everything the evaluation computed over its
  // TRIAL store, a store nothing can reach again. pm.auto.dev measured it through the MCP verb
  // route: 170 refused `assert`s of about 380 facts took the module from 521 MB to 10.2 GB
  // private, some 76 MB a call, where the same pages committed peaked at 1.7 GB. Measured
  // in-process over a copy of support's store, eight refused asserts of 394 facts: the heap
  // after a forced collection climbed 159 -> 357 MB with the memo kept and stayed at 120 MB
  // with it dropped, every call as fast either way (2.4-3.1 s). So the memo goes here, as it
  // goes when a server idles; the identity-keyed indexes are weak and stay true for CELLS.
  if (next === CELLS) { memoEmpty(); return true; }
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
  if (BOOTED && !(REFLECTED_AT && sameStore(CELLS, REFLECTED_AT))) loadReflected(REFLECTED_AT);
  return true;
}

// JSON READ INTO THE MU, AND THAT IS ALL IT DECIDES. The mu has two things, an
// atom and a sequence; JSON has four, and the reading between them belongs at
// the transport where the bytes arrive. An array is a sequence, a number stays
// a number (the mu has N(i) and A(x), and a recipe's projection positions are
// numbers), anything scalar is an atom -- and an OBJECT is the sequence of its
// <name, value> pairs, which is the one case that was missing. A JS object is
// neither of the mu's two things, so lambda raised `expected sequence, got atom`
// on the first selector that touched one: POST of a JSON object to a collection
// answered 500 from inside main:api before any routing happened (2026-09-16).
// What a pair list MEANS is lambda's (main:row reads the entry screen's own
// convention off the names); this only says what a JSON object IS.
function fromJson(x) {
  if (Array.isArray(x)) return x.map(fromJson);
  if (x !== null && typeof x === "object") return Object.keys(x).map((k) => [k, fromJson(x[k])]);
  return typeof x === "number" ? x : String(x);
}

// ONE READ OF A SOURCE, WHOEVER ASKS FOR IT (2026-10-03). A sync's pages (run_mcp's fetchPages) and a page
// a navigation reads through (readThrough, below) are the same read: the Connector's Fetcher says who
// reads, the connection's Send Mode whether it may go out, and the connection's credential is the one
// access it carries. readerFor answers that once for a Source's Function and fetchOne makes one request
// lambda built with it. A Fetcher this host registers is performed by its registration and one it does
// not is the caller's (awaits); a connection that is not live answers what it would have done
// (notPerformed); a credential that does not open under this host's key, or that it cannot write,
// refuses before anything is sent (refusal). Lambda says what the request IS; nothing here builds one.
const FETCHERS = new Map([["gh", fetchWithGh], ["mbox", fetchFromMbox]]);
function readerFor(fn) {
  const fetcherRaw = Ev("perform:fetcher_of", [fn, CELLS]);
  const fetcher = Array.isArray(fetcherRaw) ? "" : String(fetcherRaw);
  const local = FETCHERS.get(fetcher);
  if (fetcher && fetcher !== "fetch" && !local) return { fn, fetcher, awaits: true };
  const modeRaw = Ev("perform:send_mode_of", [fn, CELLS]);
  const mode = Array.isArray(modeRaw) ? "" : String(modeRaw);
  const headers = {};
  let access = "";
  try {
    access = local ? connectionSecret(fn, CELLS, process.env.AREST_MASTER_KEY) : "";
    if (!local) {
      for (const hv of Ev("perform:headers_of", [fn, CELLS])) headers[String(hv[0])] = String(hv[1]);
      const auth = Ev("perform:auth_header_of", [fn, CELLS]);
      if (!Array.isArray(auth)) {
        const secret = writtenCredential(fn, connectionSecret(fn, CELLS, process.env.AREST_MASTER_KEY), CELLS);
        if (secret === null) return { fn, fetcher, refusal: "not performed: the credential encoding this connection declares is not one this host writes" };
        if (secret) headers[String(auth)] = (headers[String(auth)] ? headers[String(auth)] + " " : "") + secret;
      }
    }
  } catch (e) { return { fn, fetcher, refusal: String(e && e.message) }; }
  return { fn, fetcher, local, mode, headers, access };
}
async function fetchOne(rd, req, say) {
  const method = String(req[1]), address = String(req[2]);
  const params = (Array.isArray(req[3]) ? req[3] : []).map((pr) => [String(pr[0]), String(pr[1])]);
  // a declared Query Text is the body, sent as written; the service binds its placeholders
  const sendBody = req.length > 4 && !Array.isArray(req[4]) && String(req[4]) !== "" ? String(req[4]) : undefined;
  const qs = new URLSearchParams();
  for (const pr of params) qs.append(pr[0], pr[1]);
  const url = address + (qs.toString() ? "?" + qs.toString() : "");
  if (rd.mode !== "live") return { notPerformed: true, text: (rd.mode ? rd.mode + " -- would " : "not performed: this connection declares no Send Mode -- would ") + method + " " + url
    + (sendBody === undefined ? "" : " with a body of " + sendBody.length + " characters") };
  if (rd.local) {
    const got = await rd.local({ method, address, params, body: sendBody, access: rd.access });
    if (got.status >= 400) return { status: 502, text: method + " " + url + " by Fetcher '" + rd.fetcher + "': " + got.text };
    return { status: 200, body: got.body, text: got.text || "", method, url };
  }
  let res, text;
  try { res = await fetch(url, sendBody === undefined ? { method, headers: rd.headers } : { method, headers: rd.headers, body: sendBody }); text = await res.text(); }
  catch (e) { try { Ev("log:response", [String(rd.fn), method, url, "0", String(e && e.message)]); } catch (e2) { } recordResponse(rd.fn, url, "0", say); return { status: 502, text: method + " " + url + " failed: " + String(e && e.message) }; }
  // WHAT CAME OFF THE LINE GOES TO log:response: a registered log provider writes it, and with none it does not.
  try { Ev("log:response", [String(rd.fn), method, url, String(res.status), text]); } catch (e) { }
  recordResponse(rd.fn, url, res.status, say);
  if (res.status >= 400) return { status: 502, text: method + " " + url + " answered " + res.status + ": " + text.slice(0, 300) };
  try { return { status: 200, body: JSON.parse(text), text: "", method, url }; }
  catch (e) { return { status: 502, text: method + " " + url + " answered a body that is not JSON" }; }
}

// A NAVIGATION THAT HAS TO READ FIRST (2026-10-03; Sam: the full request log should be available for every
// customer via external federation, read through and not stored). navigate answers a read address whose
// request carries no page with 202 and the request lambda built for its Source, the Source after it
// (ui:read_fetch). This makes that read as a sync makes one (readerFor, fetchOne) and asks again with the
// page as the request's eighth element, after the App, or <failed, text> where it could not read, so
// lambda draws the rows. It is I/O, which lambda cannot do, and the one thing added to the serving tail:
// nothing is asserted, and the second answer is a read like the first.
async function readThrough(out, method, resource, caller, raw) {
  if (Number(out && out[1]) !== 202) return out;
  let ask;
  try { ask = JSON.parse(String(out[0])); } catch (e) { return out; }
  if (!Array.isArray(ask) || ask[0] !== "request" || ask.length < 6) return out;
  const source = String(ask[5]);
  const fn = Ev("fed:connector", [source, CELLS]);
  const rd = Array.isArray(fn) ? null : readerFor(fn);
  let page;
  if (!rd) page = ["failed", "the Source '" + source + "' uses no Connector"];
  else if (rd.awaits) page = ["failed", "no host here registers Fetcher '" + rd.fetcher + "', so this read is the caller's"];
  else if (rd.refusal) page = ["failed", rd.refusal];
  else {
    const got = await fetchOne(rd, ask);
    page = got.notPerformed || got.status >= 400 ? ["failed", got.text] : got.body;
  }
  const again = Array.isArray(raw) ? raw.slice(0, 7) : [];
  while (again.length < 7) again.push([]);
  again.push(page);
  return Ev("main:api", [CELLS, method, resource, caller, fromJson(again)]);
}

function run_serve() {
  // AREST_VERDICT=1 judges the store once and records the verdict (see readVerdict above), then exits:
  // what a compile runs over the store it wrote, so that no write after it pays the whole check.
  if (process.env.AREST_VERDICT) {
    const v = Ev("main:w2_clean", CELLS) === "T" ? "T" : "F";
    writeVerdict(v);
    console.log("alethic_clean: " + v);
    process.exit(0);
  }

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

  // THE PORT IS THIS MACHINE'S UNLESS SAID OTHERWISE (2026-10-03). Bun.serve with no hostname listens
  // on every interface, and the caller below is the header as sent: every write asks the app's
  // authorization designation of it (main:api0), but the header is whatever the client says, so a
  // reachable port is a port anyone can claim a login through. It listens on 127.0.0.1, and
  // AREST_HOST names another address for a host that has its own gate.
  Bun.serve({
    hostname: process.env.AREST_HOST || "127.0.0.1",
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      // the caller is transport-level identity; who that caller MAY be is the
      // designated authorization fact type's business, not this file's
      const caller = req.headers.get("x-arest-caller") || "";
      const resource = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const raw = await req.json().catch(() => []);
      const fact = fromJson(raw);
      // A READ TAKES NO SNAPSHOT (2026-10-02; Sam: a Worker isolate gets 128 MB, and
      // runtime memory must be kept to a viable level). The snapshot was taken before
      // every request whose method is not GET, and a platform navigates by POST
      // /navigate, reads included: each read of a screen read every table of the store
      // into its populations and their texts to compare against a write it did not
      // make -- on support 12 to 28 s and 1.6 to 2.3 GB at the peak, where the same
      // read by GET is 0.2 s. Whether a request wrote is main:api's answer, a third
      // part, and main:api leaves CELLS as it found it: adoptStore is the only thing
      // that changes it, so the store before the write is still CELLS until then.
      // adoptStore mutates CELLS IN PLACE so the array identity survives, which
      // means the pre-write store has to be copied out before it adopts, or it is
      // gone by the time anything can compare against it. A fresh array is also
      // what makes main:performed evaluate: Ev memoises on the store REFERENCE.
      // And a write takes no snapshot either: emitToDb compares the cells the write
      // replaced against the copy (popSnapshotMoved).
      const clock = clockStart();
      let answer;
      try { answer = Ev("main:api", [CELLS, req.method, resource, caller, fact]); } finally { clockLap(clock, "lambda"); }
      const out = await readThrough(answer, req.method, resource, caller, raw);
      clockLap(clock, "read");
      const [body, status] = answerWrite(out, req.method + " " + resource, clock);
      memoReleaseWhenIdle(console.log);
      return new Response(body, {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });

  console.error("arest serving on :" + PORT);

}
// THE PAIRING IS ASKED OF LAMBDA BY EACH PLATFORM, NOT BY THIS HOST (2026-10-03). pairing_gate asked
// law:paired over the controls a container registered in PRIMS, for the text and HTML containers
// this file once held; they are gone, and it had no caller. A platform now sends the render names it
// registered in every navigate request, and lambda answers law:unpaired over them in the frame
// (ui:frame_out): ui.do and the Swing container each refuse to draw a frame that names one. This
// host registers no control, so it has nothing of its own to pair.
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
  // that predicate's roles. Both come from the store: lambda's mcp:tools derives
  // the list the same way links(e) is derived, so a fact type added to a model is
  // served without touching lambda or this file.
  //
  // The first version listed eighteen lambda FUNCTION names and dispatched them by
  // apply. They resolve, and eight of eight answered operand errors, because a
  // function wants an operand of its own shape and a predicate wants role
  // players. The second cut to five verbs main dispatches by argv: that works and
  // says nothing about the model. Both were host verb tables; one of them was
  // just living in lambda.
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
  // the admitted methods are lambda's too -- http:method_kinds, not a constant
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
  // NOTHING BECOMES ASYNC INSIDE THE EVALUATOR. Ev stays synchronous: lambda
  // composes the question before the ask (drive:request) and reads the answer
  // after it (drive), and the await sits between them out here, where the
  // transport already lives.
  //
  // THE TWO DIRECTIONS MUST NOT SHARE AN ID SPACE. A client numbers its requests
  // from 1 and so would we; ours carry a string id, which JSON-RPC admits and no
  // client generates, so a reply is unambiguously to a question this server asked.
  let SAMPLING = false;                   // does this connection's client offer it
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

  // AND A VERB WHOSE OPERAND IS A RESPONSE NEEDS ONE FETCHED (2026-09-25), which the model says the
  // same way: the accepts row `response-and-cells`. `sync` handed a page is an ordinary verb call;
  // handed only a Source it answers the REQUEST, and this makes it. The split is performDeclared's:
  // lambda says what the call IS (the request through the verb, perform:headers_of,
  // perform:auth_header_of), the connection says whether it may go out (its Send Mode, absent
  // meaning not at all, 'dry' meaning say what would go) and carries its credential
  // (perform:secret_of, decrypted here and nowhere else), and each page the service answers goes
  // back through the same verb -- asserted in one step, emitted like any other write -- until the
  // answer says there is no more or the cursor stops moving.
  const FETCHED = new Set(VERBS.filter((v) => String(v[1]) === "response-and-cells").map((v) => String(v[0])));
  // what this host performs by name; a Fetcher it does not hold is not a fault, it is someone else's
  async function fetchPages(name, args) {
    // each page is a write of the verb, by the caller who asked for the read
    const who = args && args.caller;
    const list = Array.isArray(args && args.args) ? args.args : [];
    const x = list.length ? fromJson(list[0]) : [];
    // a page passed with the call is the answer already in hand, as drive takes a passed completion; an
    // empty one too, which is a page that yields nothing and not a page withheld (fed:arg)
    if (Array.isArray(x) && x.length > 3) return call(name, args);
    const source = Array.isArray(x) ? (x.length ? x[0] : "") : x;
    const bindings = Array.isArray(x) && x.length > 1 ? x[1] : [];
    const fn = Ev("fed:connector", [source, CELLS]);
    if (Array.isArray(fn)) return call(name, args);             // lambda refuses it, and says why
    // THE CONNECTOR'S FETCHER SAYS WHO READS (2026-10-02). None declared, or 'fetch', is the HTTP read
    // with the connection's credential that every Connector made until now. One this host registers is
    // performed by the registration, handed the connection's Secret Reference, decrypted, as its access:
    // gh brings its own login and takes none, the mbox reads the file it names. One
    // no host here registers is the binding lost and the model kept: the read is answered as the request
    // it is, for the caller who holds the Fetcher -- an agent with its own tools -- to perform and pass
    // back as the page, the way a seam with no registration awaits its driver.
    // the Fetcher, the Send Mode and the credential: readerFor, which a read-through page takes too
    const rd = readerFor(fn);
    if (rd.awaits) {
      const q = call(name, { args: [[source, bindings, []]], caller: who });
      return ["awaits a driver: no host here registers Fetcher '" + rd.fetcher + "', so this read is the caller's -- " + String(q[0])
        + " -- and what it answers comes back as the page: [source, bindings, [], page]", Number(q[1]) >= 400 ? Number(q[1]) : 202];
    }
    if (rd.refusal) return [rd.refusal, 501];
    const lines = [];
    let cursor = [], pages = 0, status = 200;
    for (;;) {
      const q = call(name, { args: [[source, bindings, cursor]], caller: who });
      let req;
      try { req = JSON.parse(String(q[0])); } catch (e) { req = null; }
      if (!Array.isArray(req) || req[0] !== "request") return [String(q[0]), Number(q[1]) >= 400 ? Number(q[1]) : 400];
      const got = await fetchOne(rd, req, (t) => lines.push(t));
      if (got.notPerformed) { lines.push(got.text); break; }
      if (got.status >= 400) { lines.push(got.text); status = 502; break; }
      if (got.text) lines.push(got.text);
      const body = got.body;
      const out = call(name, { args: [[source, bindings, cursor, body]], caller: who });
      pages++;
      lines.push("page " + pages + " (" + got.method + " " + got.url + "): " + String(out[0]).slice(0, 400));
      let ans;
      try { ans = JSON.parse(String(out[0])); } catch (e) { ans = null; }
      if (Number(out[1]) >= 400 || !Array.isArray(ans)) { status = Number(out[1]) || 500; break; }
      const more = ans.find((pr) => Array.isArray(pr) && pr[0] === "more");
      const nx = ans.find((pr) => Array.isArray(pr) && pr[0] === "next");
      const nextCursor = nx && Array.isArray(nx[1]) ? nx[1] : [];
      if (!more || more[1] !== "T" || nextCursor.length < 2) break;
      if (JSON.stringify(nextCursor) === JSON.stringify(cursor)) { lines.push("the cursor did not move; stopped"); status = 508; break; }
      cursor = nextCursor;
    }
    return [lines.join("\n"), status];
  }

  // AND THE SEAM ITSELF IS A VERB, under the name the model gives it. mcp:verb_row
  // blanks the accepts of any verb solve:cell cannot find and mcp:verb_keep drops
  // it, so `csdp:elementarize` -- registrable, with accepts and yields rows of its
  // own and deliberately no lambda cell, because it is filled by a driver -- had no
  // door on this surface at all: the only way to reach it was the generic `drive`
  // with its name passed as a string, which is not the operation being called.
  // drive:tools answers <tool name, operation, accepts, yields, Description> for exactly the
  // seams this driver answers, so the names are lambda's (drive:driven) and none is
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

  // A VERB LEADS WITH WHAT IT IS FOR (2026-10-01). mcp:verbs answers the Function's Description
  // fourth -- resolution.md says there what each served verb does and what goes in its args -- and
  // the empty string where a verb has none, which leaves the shape sentence alone, as it was.
  function said(x) { return x === undefined || Array.isArray(x) ? "" : String(x); }
  function verbTools() {
    return VERBS.map((v) => ({
      name: String(v[0]),
      description: (said(v[3]) ? said(v[3]) + " -- " : "") + "takes the " + String(v[1]) + ", answers the " + String(v[2]),
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
      description: (said(d[4]) ? said(d[4]) + " -- " : "") + String(d[1]) + " -- takes the " + String(d[2]) + ", answers the " + String(d[3])
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
      // element, rendered in lambda from state:readings. The NAME stays the id
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
    // same lambda that dispatches the CLI: main looks the name up in the store
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
      // lambda decides which is which (main:verb_answer reads the yields row),
      // not the name and not this file. The snapshot is taken AFTER the
      // evaluation on purpose: lambda is pure, so CELLS is still the store the
      // verb was handed until adoptStore replaces it, and a read then pays
      // nothing for a snapshot it would never use.
      // AND A VERB THAT FIRES A TRANSITION PERFORMS WHAT THE TRANSITION DECLARES, the
      // same as a POST to the serving tail (2026-09-24). This path and the resource
      // path below committed the write and performed nothing: support.auto.dev drove
      // a response to Approved through the router, `approve` declares sendSupportEmail,
      // and nothing ran -- not the send, not even the dry run that records what it
      // would send -- because only the serving tail ever called maybePerform. The
      // arming is still the connection's Send Mode, so this sends nothing that the
      // serving tail would not. The store is copied BEFORE the evaluation, because
      // adoptStore replaces CELLS in place and main:performed compares the two; and
      // the report goes to stderr, because stdout here is the protocol.
      const clock = clockStart();
      const prior = CELLS.slice();
      let out;
      try { out = Ev("main:as", [CELLS, String(a.caller || ""), [String(name)].concat(rest)]); } finally { clockLap(clock, "lambda"); }
      const held = String(out[1]) === "T";
      if (out.length > 2) {
        adoptStore(out[2]);
        clockLap(clock, "adopt");
        if (held) {
          const why = storeWrite(prior, String(name), clock);
          if (why !== null) return [notCommitted(why), 500];
          maybePerform(prior, CELLS, console.error, String(name));
        }
      } else readLine(String(name), clock);
      return [out[0], held ? 200 : 500];
    }
    const method = String(a.method || METHODS[0]);
    // AN ENTITY TOOL IS THE SAME ROUTE WITH THE COLLECTION'S BODY. The address
    // main:api takes for a word in ui:groups is <id, fact type, value, fact
    // type, value...> -- ui:create0's own, the one the screen's submit carries
    // -- so the only work here is reading the named parameters back into that
    // order. Lambda decides the order (ui:formfields), lambda decides the
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
    const clock = clockStart();
    let out;
    try {
      out = Ev("mcp:call", [
        method,
        resource,
        String(a.caller || ""),
        fact,
        CELLS,
      ]);
    } finally { clockLap(clock, "lambda"); }
    // a POST answers a third part, the store it made; adopting it is what
    // makes a tool call persist. It is not part of the reply. The snapshot is
    // taken here, after the evaluation and before the adoption, as the verb
    // path above takes it: CELLS is still the store the call was handed, and a
    // call that wrote nothing pays nothing for a snapshot it would never use.
    if (out.length > 2) {
      // A REFUSED WRITE IS NOT EMITTED. A refusal (status 4xx, lambda's decision)
      // made no successor, so the tables stay as they were; the journal that
      // once recorded refusals replayed 22 of them at boot for six minutes and
      // left the store as it was (engineering.auto.dev, 2026-09-04).
      const wrote = Number(out[1]) < 400;
      const prior = CELLS.slice();
      adoptStore(out[2]);
      clockLap(clock, "adopt");
      if (wrote) {
        const why = storeWrite(prior, method + " " + resource, clock);
        if (why !== null) return [notCommitted(why), 500];
        maybePerform(prior, CELLS, console.error, method + " " + resource);
      }
      return [out[0], out[1]];
    }
    readLine(method + " " + resource, clock);
    return out;
  }
  // A READ IS TIMED AS A WRITE IS (2026-10-04). A served write logs its clock (storeWrite) and a read
  // logged nothing, so how fast an app browses could only be guessed from outside. `read <verb> <ms> ms`
  // names the verb, or the method and the fact type, and never a value: an id or an address can be a
  // customer's.
  function readLine(what, clock) {
    console.error("read " + what + " " + Math.round(clock.lambda || 0) + " ms");
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
  // trip, ten provenance and two claims. So the LAMBDA END ALREADY EXISTED: the
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
    // so lambda never parses text and Stage-1's boundary stays where it is
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
    // A COMPLETION IS ITS INTERFACE, AND NOTHING IS MINTED BESIDE IT (Sam,
    // 2026-09-30: "I'd rather you skipped initializing an Agent entity, because
    // this session is an initialized agent, and the purpose of the Agent
    // definitions is to power an LLM over api", and "If they're coupled to an
    // Agent rather than just modeling their interfaces, it's not modeled
    // right."). This named the client an Agent at initialize, minted an Agent
    // Definition per operation and an AI Model per answer -- `unknown` whenever
    // the answer was passed, since MCP gives a server no way to learn the model
    // from a tool call -- and tied the Completion to all three. Neither path here
    // is an Agent Definition powering a model over an API: the client answers,
    // by sampling or by passing its answer. So the Completion is written as what
    // went in, what came out and when (drive:prov), and the model is only said
    // in this answer's text.
    const model = res ? String(res.model || "unknown") : String(row.model || "unknown");
    row.completion = completion;
    row.claim = "claim-" + completion;
    row.input = input;
    row.output = output;
    row.facts = facts;
    const pairs = Ev("drive", [fromJson(row), CELLS]);
    // AN ANSWER IS ONE WRITE (2026-09-30). A Completion has mandatory roles and
    // so do the answer's own entities, so a fact at a time is refused at every step
    // (2026-09-17). This then gathered lambda's pairs onto the tables mcp:entities
    // names and posted each entity whole, in the order the answer listed them. But
    // a fact type that is nobody's column went as a POST of its own: claude's
    // `Correction is given by User`, a table of its own while its uniqueness
    // attached to no reading, went for c6 before c6 had the Guidance Text and
    // Timestamp its mandatory roles need, and was refused as the partial entity it
    // was. assert takes the whole answer as one step, validated once, so every
    // entity in it arrives whole whatever the order, and the answer lands whole or
    // not at all. drive keeps only the fact types this store declares.
    const page = pairs.map((p) => [String(p[0])].concat((Array.isArray(p[1]) ? p[1] : [p[1]]).map(String)));
    const out = call("assert", { args: [page], caller: a.caller });
    const ok = Number(out && out[1]) < 400;
    return [(answered ? "took your answer for '" : "asked the client for '") + operation + "' over " + subject
      + " (" + input.length + " characters of request, model " + model + ")"
      + "\n\nthe completion:\n" + output
      + "\n\n" + (ok ? "wrote" : "refused") + " the answer as one step, " + page.length + " facts:\n  "
      + page.map((f) => f[0] + " " + JSON.stringify(f.slice(1))).join("\n  ")
      + "\n\n" + String(out && out[0]).slice(0, 1200), ok ? 200 : 409];
  }

  function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
  function fail(id, message) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message } };
  }

  function handle(msg) {
    if (msg.method === "initialize") {
      // THE INSTRUCTIONS ORIENT THE MODEL AT SESSION START (Sam, 2026-09-16):
      // the client shows this text to the model on connect, and lambda
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
          const out = Ev("mcp:call", ["POST", "OperationIsRegistered", SYSTEM_LOGIN, [String(d)], CELLS]);
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
    // in FORML2"). Both answers are lambda's: mcp:prompts lists the
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
      // a verb whose operand is a response goes out for it (fetchPages), and says what came back
      if (FETCHED.has(String(p.name))) {
        return Promise.resolve(fetchPages(String(p.name), p.arguments)).then(
          (out) => reply(msg.id, { content: [{ type: "text", text: String(out[0]) }], isError: Number(out[1]) >= 400 }),
          (e) => reply(msg.id, { content: [{ type: "text", text: String(e && e.message) }], isError: true }));
      }
      const driving = SAMPLED.has(String(p.name)) ? p.arguments
        : (DRIVEN_OF.has(String(p.name))
            ? { args: [{ operation: DRIVEN_OF.get(String(p.name)),
                         subject: (p.arguments && Array.isArray(p.arguments.args) && p.arguments.args.length)
                           ? String(p.arguments.args[0]) : "" }]
                  .concat(p.arguments && Array.isArray(p.arguments.args) && p.arguments.args.length > 1
                    ? [p.arguments.args[1]] : []),
                caller: p.arguments && p.arguments.caller }
            : null);
      if (driving) {
        return drive(driving).then(
          (out) => reply(msg.id, { content: [{ type: "text", text: String(out[0]) }], isError: Number(out[1]) >= 400 }),
          (e) => reply(msg.id, { content: [{ type: "text", text: String(e && e.message) }], isError: true }));
      }
      try {
        // main:api answers <text, status>; the status is lambda's decision, and a
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
        out.then((o) => { if (o) process.stdout.write(JSON.stringify(o) + "\n"); memoReleaseWhenIdle(console.error); },
                 (e) => { process.stdout.write(JSON.stringify(fail(null, String(e && e.message))) + "\n"); memoReleaseWhenIdle(console.error); });
      } else { if (out) process.stdout.write(JSON.stringify(out) + "\n"); memoReleaseWhenIdle(console.error); }
    }
  });

  console.error("arest mcp: " + TOOLS.length + " fact types, " + METHODS.join("/") + ", all of it derived");

}

// ---- SQL ---------------------------------------------------------------
// A host that supports sql needs no schema knowledge of its own. Lambda derives
// the relational mapping -- 297 rmap defs, checked against NORMA's own answer
// by 13 laws -- and rmap:ddl renders it as the CREATE TABLE script. All this
// does is open a database, run that script, and execute the caller's query.
// Deciding what the tables ARE would be this file taking lambda's job.
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
// composes the store, and a store without FILE is not one. Lambda decides what
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
// ---- THE METASCHEMA TABLE: WHAT A STORE SAYS ABOUT ITS OWN SHAPE ---------
//
// Sam, 2026-09-22: "The metaschema should be prebuilt by us into a table.
// That's how the bootstrap works. The metamodel doesn't change, and it's used
// to bootstrap other apps."
//
// THE CIRCLE IT BREAKS. loadStoreDb below opens a store by asking lambda which
// tables to select from (rmap:coltabs) and which columns (rmap:proj_colnames),
// and both are functions of state:fts -- the schema. Measured 2026-09-22 on a
// module composed from lambda alone over the base store (build.js reader: no
// design-state, no compiled map): ast:fetch of state:fts answers #, and
// rmap:coltabs and loadStoreDb both throw `selector 1 on atom: #` in 2 ms. The
// schema is what reads the tables and the schema is in the tables, so nothing
// starts. A carrier file breaks that circle today by handing the module the
// schema before it opens the store; this is the store breaking it itself.
//
// THE LAYOUT IS THE ONE THING KNOWN BEFORE ANYTHING IS READ, as a system
// catalogue's is: four columns, named here, read with one SELECT and no
// evaluation at all.
//   tab  the table, spelled as the DDL spells it
//   ord  the column's position in rmap:proj_colnames order -- the order the
//        read loop selects in and the order rmap:unproj takes a tuple in
//   col  the column, in the DDL's spelling too (a quote doubled), because that
//        is the spelling `want` holds and the SELECT splices between quotes
//   ft   the fact type rmap:proj_carried says the column carries, NULL where it
//        carries none -- a key column, or a path that only resolves a referent
//
// SO IT IS NOT A CATALOGUE OF ITS OWN. Grouped by tab it is the table list and
// the column order, which is what opening a store needs; grouped by ft it is
// "for each fact type, the table that holds it and the columns that carry it",
// which is the relational map written down. The metamodel's own rows are the
// ones whose ft is a metamodel fact type, and the metamodel does not change, so
// those are the seed: they are what lets a module read the metamodel-shaped
// tables of an app's store, which are where that app's schema is a population.
//
// IT IS NOT ONE ARTIFACT SHARED BY EVERY APP, and that is worth saying where
// the table is declared, because it is the correction the measurement forced.
// The metamodel's map is NOT the same in two stores (2026-09-22): of the base's
// 66 tables support.auto.dev's store has all 66, 9 with different columns;
// claude's has 50, 5 differing; qa's 50, 2 differing. Function -- the FFP root
// every metamodel entity type is absorbed into -- is 243 columns on the base and
// a different 243 in every other store, and DomainConnectsToExternalSystem
// carries domainId here and domain on support, because an app may declare its
// own reference mode for a metamodel object type. What is fixed is this table's
// LAYOUT and the metamodel's fact types; WHERE they land is per store, so each
// store carries its own row set and is opened through it.
const METASCHEMA = "_metaschema";

// THE MAP AS THE STORE WILL RECORD IT. compile.js calls this on the build it
// is about to rename in, and the host's own unit test calls the same function
// on a fixture rather than restating the layout -- one declaration, one writer,
// one reader, all three here.
//
// ONE TRANSACTION. An insert of its own is an autocommit with its own disk sync
// -- 6.5 ms a row on Windows (compile.js's own measurement) -- and this writes a
// row per column: 400-odd on the base, thousands on support.
//
// A COLUMN WHOSE FACT TYPE CANNOT BE READ IS STILL A COLUMN. rmap:ctab is what
// pairs a table's columns with the paths rmap:proj_carried resolves, and a build
// that cannot read it (compile.js guards the same call in its carry, ~505) still
// knows its tables and its column order. So ft goes in as NULL and the table is
// written: what loadStoreDb needs to OPEN a store is tab, ord and col.
function writeMetaschema(db) {
  let ctab = new Map();
  try { ctab = new Map(Ev("rmap:ctab", CELLS).map((ct) => [String(ct[1]), ct[2]])); }
  catch (e) { console.error("  (rmap:ctab could not be read -- " + e.message + " -- the metaschema names no fact types)"); }
  db.exec('create table if not exists "' + METASCHEMA + '" ("tab" text, "ord" integer, "col" text, "ft" text)');
  // AND IT IS THE MAP, NOT A LOG OF MAPS. compile.js writes into a build that is
  // a fresh file, so this is empty there; anywhere else a second call would
  // otherwise leave two answers in one table and no way to tell them apart.
  db.exec('delete from "' + METASCHEMA + '"');
  const ins = db.prepare('insert into "' + METASCHEMA + '" ("tab", "ord", "col", "ft") values (?, ?, ?, ?)');
  let n = 0;
  db.exec("begin");
  for (const t of Ev("rmap:coltabs", CELLS)) {
    const table = String(t[0]);
    const cols = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
    const paths = ctab.get(table) || [];
    for (let i = 0; i < cols.length; i++) {
      const p = paths[i];
      let ft = "#";
      if (p) { try { ft = String(Ev("rmap:proj_carried", Array.isArray(p[2]) ? p[2] : [])); } catch { ft = "#"; } }
      ins.run(table, i + 1, cols[i], ft === "#" ? null : ft);
      n++;
    }
  }
  db.exec("commit");
  return n;
}

// AND THE READ IS ONE SELECT AND NO EVALUATION, which is the whole point: a
// module that cannot evaluate rmap:coltabs can still run this. An ABSENT table
// is not caught, it is asked about -- every store written before this commit has
// none, and a catch around the select would hide a real error in the same
// breath as reporting an expected absence.
function readMetaschema(db) {
  const there = db.query("select name from sqlite_master where type = 'table' and name = ?").get(METASCHEMA);
  if (!there) return null;
  const m = new Map();
  for (const r of db.query('select "tab", "col" from "' + METASCHEMA + '" order by "tab", "ord"').values()) {
    const t = String(r[0]);
    let cols = m.get(t);
    if (!cols) m.set(t, (cols = []));
    cols.push(String(r[1]));
  }
  return m.size ? m : null;
}

// ---- A STORE IS READ FROM ITS TABLES WHEN ASKED, NOT WHOLE AT START -------------
// Sam, 2026-09-24: "it shouldn't read the whole db into memory? It should just
// read from db. That's the point of a database." A server's start read every
// table and unprojected every row back into lambda's populations before it
// answered anything -- support: 596 tables, 80,685 rows, 5.9 million cells, and
// the database itself was a quarter of a second of it. So a server's load reads
// NO rows. Each stored fact type is a cell whose contents are its rows, read
// from the tables the first time anything reaches into them: only the rows
// where a column carrying it is filled, unprojected by lambda's own rmap:unproj
// and nothing else. The source (state:fts) is the carriers' descriptors,
// copied, each fifth slot read the same way when first read, and FILE is
// those descriptors nested one at a time, each when its cell is read.
//
// WHICH TABLES HOLD WHICH FACT TYPE is the store's own _metaschema -- the fact
// type each column carries, which the compile writes from rmap -- plus each
// relation table's own fact type. A fact type whose tables yield no row keeps
// the carriers' cell and rows, exactly as the whole load keeps them: it moves
// only fact types with rows.
//
// AND A FACT TYPE WITH NOTHING STORED IS NO CELL AT ALL, as in the whole load,
// which makes a cell only of what it read rows for. Which ones hold anything is
// one count per table -- the rows, and each carrying column's filled values --
// and no row. A cell standing for an empty population is a different store:
// loadDerived adds a derived fact type only when it is not `already its own
// cell`, and a boot that closed the base store over such cells wrote 9,914
// rows where the whole load's wrote 14,493, ObjectTypeInstanceIsOfFunction
// (4,493) and six Status tables empty, and the store it left refused every
// write (409) that the other committed (201).
//
// MEASURED 2026-09-24 over copies of the six resident apps' stores, this read
// against the whole load (AREST_EAGER_STORE=1) in the same module. The answers
// are byte-identical: on support cells (34.2 million characters), schema, the
// fact-type GETs, get, actions, nav, orient, a POST and the reads after it, and
// the store the POST left; on the other five cells, schema and nav; and a create
// on tasks commits, writes the same store and reads back the same after a
// restart either way. On support the load is 0.8-1.3 s where the whole load is
// 4.2-5.7 (5.6-6.7 before today), but the FIRST ANSWER is not much sooner --
// 5.5-7.8 s against 5.8-7.8 -- because the tool list and the instructions read
// the Function table, 19,080 rows, and the load is no longer what it waits on.
// What is held is less: after the first answer 396-449 MB resident once
// collected, against 568, and after a GET, actions, orient or nav 359-410
// against 560, each of them reading 4 to 7 tables. NOT `get`: it reads 165
// tables and builds some 600 MB that the memo keeps -- 744 MB live against
// 758, the same in both -- and since here those reads happen inside the
// request, its peak is 1,661-1,666 MB against 1,326.
//
// A WRITE STILL SNAPSHOTS EVERY POPULATION to see what it changed (popSnapshot),
// so before it the tables are read once, whole, into the populations -- the
// work the old start did, done at the first write instead of at every start --
// and after it the rows cached for the tables it wrote are dropped. It writes
// the rows it moved now, not the tables (rowPlanner, 2026-09-25).
let LAZY_STORE = null;
function lazyStore(db, want) {
  let meta;
  try { meta = db.query('select "tab", "col", "ft" from "' + METASCHEMA + '"').all(); } catch { return null; }
  if (!meta.length) return null;
  const SCHEMA = CELLS.slice();
  const colsOf = new Map(), carried = new Map(), tablesOf = new Map(), relTables = new Set();
  for (const r of meta) {
    if (r.ft === null || r.ft === undefined || String(r.ft) === "#") continue;
    const tab = String(r.tab), ft = String(r.ft), k = tab + "\u0000" + ft;
    let set = carried.get(tab); if (!set) carried.set(tab, (set = new Set()));
    set.add(ft);
    if (!colsOf.has(k)) colsOf.set(k, []);
    colsOf.get(k).push(String(r.col));
  }
  const addFt = (ft, table) => { let l = tablesOf.get(ft); if (!l) tablesOf.set(ft, (l = [])); if (!l.includes(table)) l.push(table); };
  for (const [table] of want) {
    for (const ft of carried.get(table) || []) addFt(ft, table);
    let rel = "F"; try { rel = Ev("rmap:unproj_isrel", [table, SCHEMA]); } catch { rel = "F"; }
    if (rel === "T") { addFt(table, table); relTables.add(table); }
  }
  // which fact types each table holds anything for, counted and not read, and
  // counted again for a table a write rewrote
  const presentIn = new Map(), filled = new Map(), rowsIn = new Map();
  const count = (table) => {
    const fts = [...(carried.get(table) || [])];
    const cols = [...new Set(fts.flatMap((ft) => colsOf.get(table + "\u0000" + ft) || []))];
    const n = db.query("select count(*)" + cols.map((c) => ', count("' + c + '")').join("") + ' from "' + table + '"').values()[0];
    const got = new Set();
    rowsIn.set(table, n[0]);
    if (n[0] > 0) {
      if (relTables.has(table)) got.add(table);
      for (const ft of fts) {
        const k = table + "\u0000" + ft, fill = (colsOf.get(k) || []).reduce((a, c) => a + n[1 + cols.indexOf(c)], 0);
        filled.set(k, fill);
        if (fill > 0) got.add(ft);
      }
    }
    presentIn.set(table, got);
  };
  for (const [table] of want) if (carried.has(table) || relTables.has(table)) count(table);
  const present = (ft) => (tablesOf.get(ft) || []).some((t) => { const p = presentIn.get(t); return p !== undefined && p.has(ft); });
  let selects = 0;
  const select = (table, where) => {
    selects++;
    const cols = want.get(table);
    // IN ROWID ORDER, SAID (2026-10-04): a population's order was whatever plan SQLite chose for a bare select, and
    // the scan for one id (mentioning) must find its rows in the order the whole read has them, which an index
    // lookup does not; so both say the order, the order a table scan already gave.
    const rows = db.query("select " + cols.map((c) => '"' + c + '"').join(",") + ' from "' + table + '"' + (where || "") + " order by rowid").values();
    const clean = rows.map((r) => r.map((v) => (v === null ? "#" : String(v))));
    const out = clean.length ? Ev("rmap:unproj", [table, clean, SCHEMA]) : [];
    // AND THE READ LEAVES NOTHING IN THE MEMO. The whole load clears the memo
    // when it is done; a store read on demand is never done, so rmap:unproj --
    // keyed on this read's rows, which nothing asks twice -- and the names under
    // it that take a row or a cell held every read's rows and pairs for the life
    // of the server. The inverse's definitions are all rmap:unproj*, and the few
    // of them that take a table are recomputed once a read.
    for (const k of [...EVMEMO.keys()]) if (typeof k === "string" && k.startsWith("rmap:unproj")) memoForget(k);
    return out;
  };
  const ftRows = new Map();
  // A TABLE READ WHOLE IS KEPT, BY TABLE, and serves every fact type in it. Lambda
  // unprojects a row at a price set by the table's width and not by what the row
  // holds -- support's Function table is 19,080 rows across 301 columns, 3.2 s
  // whole, and its identifier's fact type alone, which every row fills, 3.1 s
  // (blanking the columns it does not carry: 2.7; all three measured before
  // rmap:unproj_filled) -- so a request that walks every
  // population read that table once per fact type, 27.9 s where the whole load
  // took 5.5, and the MCP server's first answer read it twice, once for the tools
  // and again when FILE adopted the store. So once ONE_AT_A_TIME of a table's fact
  // types have been read on their own the table is read whole, and a table read
  // whole -- by that, by a write's snapshot or by FILE -- is never read again
  // until a write rewrites it. A fact type spread over several tables takes its
  // rows table by table in the order the whole load reads them.
  const ONE_AT_A_TIME = 4;
  const byTable = new Map(), asked = new Map(), wholeReads = new Map();
  const readTable = (table) => {
    let got = byTable.get(table);
    if (got) return got;
    wholeReads.set(table, (wholeReads.get(table) || 0) + 1);
    got = new Map();
    for (const p of select(table, "")) { const ft = String(p[0]); let l = got.get(ft); if (!l) got.set(ft, (l = [])); l.push(p[1]); }
    byTable.set(table, got);
    return got;
  };
  // one fact type's rows in one table: only the rows a column carrying it fills --
  // unless the table is a relation table, or has been asked often enough, or the
  // fact type fills more than a quarter of its rows (read alone it would cost
  // nearly the whole table, and then the whole table again), and is read whole
  // and kept
  const rowsOf = (ft) => {
    let r = ftRows.get(ft); if (r) return r;
    if (!present(ft)) return [];
    const ts = tablesOf.get(ft) || [];
    const parts = ts.map((t) => {
      let got = byTable.get(t);
      const cols = colsOf.get(t + "\u0000" + ft);
      if (!got) { const n = (asked.get(t) || 0) + 1; asked.set(t, n);
        if (n > ONE_AT_A_TIME || relTables.has(t) || !cols || !cols.length
          || 4 * (filled.get(t + "\u0000" + ft) || 0) > (rowsIn.get(t) || 0)) got = readTable(t); }
      if (got) return got.get(ft) || [];
      const one = [];
      for (const p of select(t, " where " + cols.map((c) => '"' + c + '" is not null').join(" or "))) if (String(p[0]) === ft) one.push(p[1]);
      return one;
    });
    r = parts.length === 1 ? parts[0] : [].concat(...parts);
    ftRows.set(ft, r);
    return r;
  };
  // every population at once, each table read a single time -- what a write's
  // snapshot needs -- and only the tables holding a fact type not already read
  const readAll = () => {
    const tables = new Set();
    for (const [ft, ts] of tablesOf) if (!ftRows.has(ft) && present(ft)) for (const t of ts) tables.add(t);
    for (const [table] of want) if (tables.has(table)) readTable(table);
    for (const ft of tablesOf.keys()) rowsOf(ft);
  };
  const pick = (cells, name) => { for (const c of cells) if (Array.isArray(c) && c[1] === name) return c[2]; return "#"; };
  // A CELL NOT YET READ IS PENDING (2026-10-03) while no write has moved its fact type: read, it holds its fact
  // type's rows as the tables hold them, which are the rows they held when the store was read until a write moves
  // that fact type or rewrites its table whole. The nav:peers twin decides a pending cell from the scan for an id
  // (mentioning) instead of reading it.
  const pendingCells = new WeakSet(), movedFts = new Set();
  const later = (name, get) => {
    const c = ["CELL", name, null];
    let v, done = false;
    pendingCells.add(c);
    Object.defineProperty(c, 2, { get() { if (!done) { v = get(); done = true; pendingCells.delete(c); } return v; }, enumerable: true, configurable: true });
    return c;
  };
  // the carriers' descriptors, copied, each fifth slot that fact type's rows when read
  const descs = (raw) => {
    const isDesc = (d) => Array.isArray(d) && d.length === 5 && !Array.isArray(d[0]);
    const copy = (v) => {
      if (isDesc(v)) {
        const ft = String(v[0]);
        const d = [v[0], v[1], v[2], v[3], null];
        let got, done = false;
        Object.defineProperty(d, 4, { get() { if (!done) { const r = rowsOf(ft); got = r.length ? r : v[4]; done = true; } return got; },
          enumerable: true, configurable: true });
        return d;
      }
      return Array.isArray(v) ? v.map(copy) : v;
    };
    return copy(raw);
  };
  const stored = [...tablesOf.keys()].filter(present);
  const cells = stored.map((ft) => later(ft, () => { const r = rowsOf(ft); return r.length ? r : pick(SCHEMA, ft); }));
  cells.push(later("state:fts", () => descs(pick(SCHEMA, "state:fts"))));
  // FILE IS NESTED A CELL AT A TIME. ast:File is one cell per descriptor, each
  // rmap:rel_cell of it -- the descriptor's rows nested -- and ast:FetchPop reads
  // FILE for every fact type whose own cell is #, which on support is every stored
  // fact type without a row: the MCP server's instructions ask DomainReachesDomain
  // before anything else, and FILE was adopted from every population to answer it
  // with nothing -- every table read, then store:src_all over all of them, 5.5 to
  // 6.5 s. Here FILE's cells are the descriptors' names, each nested when read, so
  // that lookup reads the one fact type it names. Measured on support over a copy
  // of its store: all 1,479 cells built this way are byte-identical to FILE as the
  // whole load and the adoption build it (d9511894db402fa2).
  cells.push(later("FILE", () => Ev("store:fts", CELLS).map((d) => later(d[0], () => Ev("rmap:rel_cell", d)[2]))));
  const replaced = new Set([...stored, "state:fts", "FILE"]);
  // a write rewrote these tables: what was read from them is read again when asked
  const invalidate = (tables) => {
    for (const t of tables) {
      byTable.delete(t); asked.delete(t);
      if (presentIn.has(t)) count(t);
      for (const ft of carried.get(t) || []) { ftRows.delete(ft); movedFts.add(ft); }
      if (relTables.has(t)) { ftRows.delete(t); movedFts.add(t); }
    }
  };
  // the counts a write moved, by what it took away and put back column by column: what counting the table
  // again finds. A table that held no rows held no values, whatever an earlier count left behind.
  const recount = (table, moved) => {
    const was = rowsIn.get(table) || 0, rows = was + moved.rows;
    rowsIn.set(table, rows);
    const got = new Set();
    for (const ft of carried.get(table) || []) {
      const k = table + "\u0000" + ft;
      const fill = (was > 0 ? filled.get(k) || 0 : 0) + (colsOf.get(k) || []).reduce((a, c) => a + (moved.held.get(c) || 0), 0);
      filled.set(k, fill);
      if (rows > 0 && fill > 0) got.add(ft);
    }
    if (rows > 0 && relTables.has(table)) got.add(table);
    presentIn.set(table, got);
  };
  // a table emitToDb wrote row by row: the fact types that moved are what the write
  // stored, and every other one it carries holds the rows it held; its counts move by what the write counted
  const wrote = (tables, moved, counted) => {
    for (const ft of moved.keys()) movedFts.add(ft);
    for (const t of tables) {
      byTable.delete(t); asked.delete(t);
      if (presentIn.has(t)) { const c = counted && counted.get(t); if (c) recount(t, c); else count(t); }
      for (const ft of carried.get(t) || []) if (moved.has(ft)) ftRows.set(ft, moved.get(ft));
      if (relTables.has(t) && moved.has(t)) ftRows.set(t, moved.get(t));
    }
  };
  // EVERY FACT THAT NAMES ONE ID, per fact type, for `get` (its twin, among the
  // FASTPRIMS). The id's own row and every row that refers to it hold it in some
  // column, so a scan per table for the rows where any column is the id finds them all;
  // they are unprojected as any read is, and a fact is kept only when the id is one of
  // its values. The fact types each table carries are read the same way a population
  // is read, in the same table order, so a fact type's facts arrive in the order its
  // population has them.
  let scans = 0;
  // AN OBJECTIFIED INSTANCE WHOSE TABLE KEYS ON ITS ROLES IS HELD IN NO COLUMN (2026-09-29). Its id is its key
  // columns' values joined as rmap:proj_objkey joins them, and the facts of it read back under that id since
  // 912feafd, so a scan for a column equal to the id found none of them: support's `get Starter.vin` answered no
  // price. Such a table is asked for its joined key too, the key columns in the table's order, as
  // rmap:unproj_keycols answers them; any other table is asked as before.
  const objkeyAsk = new Map();
  const objkeyOf = (table, cols) => {
    let sql = objkeyAsk.get(table);
    if (sql !== undefined) return sql;
    sql = "";
    if (relTables.has(table)) {
      try {
        const ctx = Ev("rmap:unproj_ctx", [table, SCHEMA]);
        const paths = Array.isArray(ctx) && Array.isArray(ctx[1]) ? ctx[1] : [];
        const pk = Array.isArray(ctx) && Array.isArray(ctx[2]) ? ctx[2].map(String) : [];
        const keyCols = paths.map((p) => String(Array.isArray(p) ? p[0] : "")).filter((c) => pk.includes(c));
        if (ctx[3] === "T" && keyCols.length > 1 && keyCols.length === pk.length && keyCols.every((c) => cols.includes(c)))
          sql = keyCols;
      } catch { sql = ""; }
    }
    objkeyAsk.set(table, sql);
    return sql;
  };
  // AND THE JOINED KEY IS ASKED BY ITS PARTS (2026-10-04). `(k1 || '.' || k2) = id` is an expression no index
  // answers, so every objectified table keyed on two roles was read whole for every get: the four Object Type
  // Instance tables were 21-34 ms each on support with both their columns indexed. The two columns join to the id
  // exactly when the id splits at one of its dots into the two values, so each split is asked of the key itself,
  // `(k1 = left and k2 = right)`, which the primary key answers; an id with no dot asks none. A key of three or
  // more columns is asked joined, as before. <key columns, id> to <the SQL beside ?1, its parameters after the id>.
  const objkeyAt = (kc, id) => {
    if (!kc) return ["", []];
    if (kc.length !== 2) return [" or (" + kc.map((c) => '"' + c + '"').join(" || '.' || ") + ") = ?1", []];
    let sql = ""; const ps = [];
    for (let i = id.indexOf("."); i >= 0; i = id.indexOf(".", i + 1)) {
      ps.push(id.slice(0, i), id.slice(i + 1));
      sql += ' or ("' + kc[0] + '" = ?' + ps.length + ' and "' + kc[1] + '" = ?' + (ps.length + 1) + ")";
    }
    return [sql, ps];
  };
  // A TABLE IS ASKED ONLY IN THE COLUMNS AN ENTITY CAN STAND IN (2026-10-04, task #175). get keeps a row only
  // where the id fills a role an entity type plays (get:holds_at), so the scan needs no other column. Those are
  // lambda's sqlite:typed_cols, and the compile indexes each of them that is not its table's leading key column
  // (sqlite:index_ddl, `ix:<table>:<column>`), so a table is a lookup and not a scan of every row against every
  // column. The list is read back from the indexes the store has, beside its key columns, in two statements:
  // computing it in lambda for 647 tables took 3 s at a server's first get. A store compiled before the indexes
  // has none, and every column is asked, as before; a table left no column and no joined key is not asked.
  let ixCols = null;
  const typedOf = new Map();
  const askedCols = (table, cols) => {
    if (ixCols === null) {
      ixCols = new Map();
      const add = (t, c) => { let s = ixCols.get(String(t)); if (!s) ixCols.set(String(t), (s = new Set())); s.add(String(c)); };
      try {
        for (const r of db.query("select m.tbl_name t, i.name c from sqlite_master m join pragma_index_info(m.name) i where m.type = 'index' and m.name like 'ix:%'").values()) add(r[0], r[1]);
        if (ixCols.size) for (const r of db.query("select m.name t, c.name c from sqlite_master m join pragma_table_info(m.name) c where m.type = 'table' and c.pk > 0").values()) add(r[0], r[1]);
      } catch { ixCols = new Map(); }
    }
    let at = typedOf.get(table);
    if (at === undefined) {
      const s = ixCols.get(table);
      at = !ixCols.size ? cols : s ? cols.filter((c) => s.has(c)) : [];
      typedOf.set(table, at);
    }
    return at;
  };
  // mentioning(id, true) also answers, as its map's `own`, the facts the scanned rows yield that hold no value that
  // is the id but whose key spells it (objkeyIs): an objectified instance's own fact, by fact type (main:re_facts).
  const mentioning = (id, own) => {
    const byFt = new Map(), owned = new Map();
    const per = []; // @instrument
    for (const [table, cols] of want) {
      if (!carried.has(table) && !relTables.has(table)) continue;
      const at = askedCols(table, cols), [ok, ps] = objkeyAt(objkeyOf(table, cols), id);
      if (!at.length && !ok) continue;
      scans++;
      const tq = performance.now(); // @instrument
      const rows = db.query("select " + cols.map((c) => '"' + c + '"').join(",") + ' from "' + table + '" where '
        + (at.length ? at.map((c) => '"' + c + '" = ?1').join(" or ") + ok : "?1 is null" + ok) + " order by rowid").values(id, ...ps);
      per.push([performance.now() - tq, table, at.length]); // @instrument
      if (!rows.length) continue;
      const clean = rows.map((r) => r.map((v) => (v === null ? "#" : String(v))));
      for (const pr of Ev("rmap:unproj", [table, clean, SCHEMA])) {
        const ft = String(pr[0]), fact = pr[1];
        if (!Array.isArray(fact)) continue;
        if (!fact.some((v) => v === id)) {
          if (own && objkeyIs(fact, id)) { let o = owned.get(ft); if (!o) owned.set(ft, (o = [])); o.push(fact); }
          continue;
        }
        let l = byFt.get(ft); if (!l) byFt.set(ft, (l = [])); l.push(fact);
      }
    }
    byFt.own = owned;
    for (const k of [...EVMEMO.keys()]) if (typeof k === "string" && k.startsWith("rmap:unproj")) memoForget(k);
    if (PROFILE) console.error("mentioning: " + per.length + " table(s), " + Math.round(per.reduce((a, p) => a + p[0], 0)) + " ms in SQL; " + per.sort((a, b) => b[0] - a[0]).slice(0, 8).map((p) => p[1] + " " + Math.round(p[0]) + " ms/" + p[2] + " cols").join(", ")); // @instrument
    if (PROFILE) console.error("mentioning: indexed columns of " + ixCols.size + " table(s); the slowest asks " + per.slice(0, 2).map((p) => p[1] + " [" + [...(ixCols.get(p[1]) || [])].join(",") + "] " + JSON.stringify(db.query("explain query plan select 1 from \"" + p[1] + "\" where " + askedCols(p[1], want.get(p[1]) || []).map((c) => '"' + c + '" = ?1').join(" or ")).all("x").map((r) => r.detail))).join("; ")); // @instrument
    return byFt;
  };
  // the carriers' rows for a fact type, unfolded: what a descriptor's fifth slot answers
  // when the tables yield that fact type nothing
  let rawDescs = null;
  const carrier = (ft) => {
    if (!rawDescs) {
      rawDescs = new Map();
      const walk = (v) => { if (Array.isArray(v) && v.length === 5 && !Array.isArray(v[0])) rawDescs.set(String(v[0]), v); else if (Array.isArray(v)) v.forEach(walk); };
      walk(pick(SCHEMA, "state:fts"));
    }
    const d = rawDescs.get(ft);
    return d ? Ev("theta:unfold_rows", d[4]) : [];
  };
  return { db, tablesOf, rowsOf, readAll, invalidate, wrote, cells, replaced, mentioning, carrier, present,
    pending: (c) => pendingCells.has(c) && !movedFts.has(c[1]),
    hasRows: (n) => present(n) && rowsOf(n).length > 0,
    stats: () => ({ selects, tables: byTable.size, most: Math.max(0, ...wholeReads.values()), scans }) };
}

// AND THE RECORD OF DERIVED ROWS IS READ FROM THE COMPILE'S LEDGER (2026-10-06, task #191). A write tells a
// derived row of a + head from an asserted one by state:derived_rows, which only a write's derive:rec_put
// wrote, so a start held no record and every row the compile's closure derived of such a head was asserted to
// every later write, never taken back when its support went. The compile keeps what its closure added in
// _derived. This reads its rows of the heads the record tracks (derive:rec_heads) and installs the record
// lambda makes of them (derive:rec_seed, derive:rec_cell). A store with no _derived has no record, as before.
function seedDerivedRows(db, have) {
  if (!have.has("_derived")) return;
  const q = db.query('select "row" from "_derived" where "ft" = ?');
  const pairs = [];
  for (const h of seq(Ev("derive:rec_heads", CELLS))) {
    const rows = q.values(String(h)).map((r) => JSON.parse(String(r[0])));
    if (rows.length) pairs.push([String(h), rows]);
  }
  if (!pairs.length) return;
  const rec = seq(Ev("derive:rec_seed", [CELLS, pairs]));
  if (!rec.length) return;
  for (let i = CELLS.length - 1; i >= 0; i--) if (Array.isArray(CELLS[i]) && CELLS[i][1] === "state:derived_rows") CELLS.splice(i, 1);
  CELLS.unshift(Ev("derive:rec_cell", rec));
  memoClear();
}

function loadStoreDb(path, opts) {
  const { Database } = require("bun:sqlite");
  const db = new Database(path, { readonly: true });
  // AND IT MUST HOLD THE SCHEMA IT IS READ THROUGH. The tables ARE the durable
  // store (#108), so a database without the tables and columns the loop below
  // selects is not a slow path to fall back from -- it is the wrong store, and
  // every write made since lives only in it. Measured 2026-09-11: the base
  // store.db of 09-08 booted into the current module and `schema` threw
  // `selector 2 out of range 1` from somewhere inside the answer, naming a
  // selector rather than a database. It lacked four fact types' tables
  // (EntityTypeHasReferenceMode, ObjectTypeIsSubtypeOfObjectType,
  // FactTypeHasDerivationMode, SubtypeFactProvidesPreferredIdentifier) and the
  // loop below skipped each one without a word.
  //
  // WHAT STOOD HERE WAS THE COMPOSITION STAMP, and it answered a different
  // question. build.js hashes the whole lambda file, scenarios.canon and the
  // carriers into sixteen hex digits (IDENTITY), compile.js writes them into
  // _composition, and any other value was refused. Measured 2026-09-21, that is
  // both too strong and too weak. TOO STRONG: three lambda commits that moved no
  // table and no column -- reflect:src_* on the reflection, rmap:unproj_owner
  // deleted from the READ side, the judge's fifteen DEFs -- invalidated every
  // app's store, five were down at once, and support's re-read from its
  // readings is ten minutes and 6-7 GB. TOO WEAK: a database carrying THIS
  // module's stamp and NO TABLES AT ALL loaded in 23 ms without a word, because
  // the stamp was the only thing asked and the read loop skipped every table in
  // silence -- the 09-11 failure exactly, still open.
  //
  // So the SCHEMA is what is checked, which is what the stamp was protecting:
  // every table rmap:coltabs names, with every column rmap:proj_colnames gives
  // it -- the same two the DDL, compile.js and the loop below use -- must be in
  // the database, by name.
  //
  // A TABLE OR COLUMN THE STORE HAS AND THE MODULE DOES NOT NAME IS KEPT, not
  // refused: the loop below selects named columns from named tables, so an
  // extra one cannot reach an answer, and nothing is lost by reading past it.
  // What becomes of its rows is the next compile's question, where the carry
  // already refuses to drop a non-empty orphan without a Migration (compile.js,
  // AREST_MIGRATE=allow-loss). A store written by a LATER lambda therefore still
  // loads here, with the rows this module knows how to read.
  //
  // WHAT THIS DOES NOT CATCH is a column whose MEANING moved while its name
  // stood still: the same column now holding another value type or another
  // reference mode. Column ORDER is not such a case -- the rows are read BY
  // NAME in the order rmap:proj_colnames gives now, and rmap:unproj takes the
  // tuple from that same order, so a permutation reads back as itself. Nor does
  // it catch a store whose ROWS are stale; rows are the compile's business, and
  // compile.js supersedes what a build asserted while carrying what the runtime
  // wrote.
  // An ABSENT database is a different answer and not this check's: the readonly
  // open above refuses it with sqlite's own `unable to open database file`, and
  // a store asked for no database at all never reaches here.
  const raw = (n) => String(n).replace(/""/g, '"');   // the DDL's spelling of a name; sqlite answers it unquoted
  // AND WHERE THE MAP COMES FROM IS THE BOOTSTRAP. A module that CARRIES a
  // schema reads the map out of it, exactly as it always has, and the check below
  // is then what it has always been: does this store hold the tables and columns
  // THIS module is about to select from. A module that carries NONE has nothing
  // to ask -- rmap:coltabs is a function of state:fts -- and reads the map out of
  // the store's own metaschema table instead. The check still runs and still
  // means something: it holds the store to its own record, which is the 09-11
  // failure (tables named and not there) caught without a schema to name them.
  const schemaless = Ev("ast:fetch", ["state:fts", CELLS]) === "#";
  const want = new Map();
  if (!schemaless) {
    for (const t of Ev("rmap:coltabs", CELLS)) {
      const table = String(t[0]);
      const cols = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
      if (cols.length) want.set(table, cols);
    }
  } else {
    const stored = readMetaschema(db);
    if (!stored) {
      db.close();
      throw new Error("this module carries no schema, and " + path + " holds no " + METASCHEMA +
        " table to be read through: nothing says which tables it has" +
        "\n  compose a carrier: no compiler here rebuilds a store" +
        " (compile.js was deleted 2026-09-29)");
    }
    for (const [table, cols] of stored) if (cols.length) want.set(table, cols);
  }
  // ONE STATEMENT, NOT ONE PER TABLE. `pragma table_info` prepared per table is
  // 7 ms over the base's 49 tables and 77 ms over 562 of them (support's count,
  // on a database built to that shape); joining sqlite_master to the pragma
  // table-valued function answers exactly the same names in 0.6 ms and 7 ms
  // (2026-09-21). The base module takes 2.5 s to load and support's 13.8.
  const have = new Map();
  for (const r of db.query("select m.name t, c.name c from sqlite_master m join pragma_table_info(m.name) c where m.type = 'table'").values()) {
    let cols = have.get(String(r[0]));
    if (!cols) have.set(String(r[0]), (cols = new Set()));
    cols.add(String(r[1]));
  }
  const missing = [];
  for (const [table, cols] of want) {
    const there = have.get(raw(table));
    if (!there) { missing.push(raw(table) + " -- no such table"); continue; }
    const gone = cols.filter((c) => !there.has(raw(c)));
    if (gone.length) missing.push(raw(table) + " -- no column " + gone.map(raw).join(", "));
  }
  // AND WHICH BUILD WROTE IT IS STILL WORTH KNOWING -- read for the message,
  // never to decide. (`builtFrom` rather than `stamped`, which is the
  // evaluator's own function two thousand lines up and was shadowed here.)
  let builtFrom = null;
  try { builtFrom = (db.query("select hash from _composition").get() || {}).hash; } catch { /* predates the stamp */ }
  STORE_BUILT_FROM = builtFrom || null;
  if (missing.length) {
    const { createHash } = require("node:crypto");
    const schemaHash = (m) => {
      const h = createHash("sha256");
      for (const t of [...m.keys()].sort()) h.update(raw(t) + "\u0000" + m.get(t).map(raw).sort().join("\u0000") + "\n");
      return h.digest("hex").slice(0, 16);
    };
    let held = null;
    try { held = (db.query("select schema from _composition").get() || {}).schema; } catch { /* predates the schema column */ }
    db.close();
    throw new Error("this store does not hold the schema the module reads: " + missing.length +
      " of " + want.size + " table(s) it selects from -- " + path +
      missing.slice(0, 12).map((m) => "\n  " + m).join("") +
      (missing.length > 12 ? "\n  ... and " + (missing.length - 12) + " more" : "") +
      "\n  the store's schema is " + (held || "(not recorded)") + ", this module's is " + schemaHash(want) +
      "; it was built from composition " + (builtFrom || "(none: it predates the stamp)") +
      ", this module is " + (COMPOSITION || "(unstamped)") +
      "\n  no compiler here rebuilds a store (compile.js was deleted 2026-09-29):" +
      " serve it with the module its own build wrote");
  }
  // AND WHERE THE SCHEMA FITS BUT THE STAMP DIFFERS, SAY SO ONCE. The tables
  // are read, because their shape is what reading them needs; but the ROWS in
  // them were asserted by another build's readings, and until the next
  // apps_check that build is what the store answers where the tables speak.
  // Refusing this is what put five apps down for three lambda commits that moved
  // no table; saying nothing at all is the other error.
  if (builtFrom !== COMPOSITION) {
    console.error("store " + path + ": built from composition " + (builtFrom || "(none: it predates the stamp)") +
      ", this module is " + (COMPOSITION || "(unstamped)") +
      " -- the schema fits, so the tables are read; their rows are that build's until the next apps_check");
  }
  // WHAT THE ROWS MEAN IS LAMBDA'S, NOT THIS FILE'S. rmap:coltabs names the
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
  // unpacking c0..cN to a recorded arity. `_meta` occurs ZERO times in lambda and
  // never did -- it was a shape this file invented so that it could read back
  // what it had written. The schema the readings actually describe is the one
  // rmap:ddl emits, and now it is the one that is read.
  // AND IT READS THE MAP THE CHECK ABOVE ALREADY BUILT: `want` IS rmap:coltabs
  // paired with rmap:proj_colnames, so the check costs no evaluation of its own
  // (5 ms for the base's 49 tables and 382 columns, paid once either way).
  // ---- AND WITH NO SCHEMA THE ROWS ARE ROWS, NOT YET POPULATIONS ----------
  // rmap:unproj is what says what a row MEANS, and it reads state:fts twice over
  // -- rmap:unproj_isrel asks whether the table is named by a fact type, and
  // rmap:unproj_cell asks rmap:proj_hits how many columns the carried fact type
  // has -- so a module with no schema cannot decode a tuple however many tables
  // it can open. That is the SECOND bootstrap and not this one: the metaschema
  // reads the schema, the schema reads the data. What this leaves is the first
  // half done and visible -- every table's columns and rows, as sqlite answered
  // them -- for the step that reconstructs the schema from the metamodel-shaped
  // tables among them. Nothing is installed as a cell, because a cell is a
  // population and these are not populations yet.
  if (schemaless) {
    const rawTables = new Map();
    let rows = 0;
    for (const [table, cols] of want) {
      const got = db.query("select " + cols.map((c) => '"' + c + '"').join(",") + ' from "' + table + '"').values();
      rows += got.length;
      rawTables.set(raw(table), { columns: cols.map(raw), rows: got.map((r) => r.map((v) => (v === null ? "#" : String(v)))) });
    }
    db.close();
    STORE_RAW = rawTables;
    console.error("store " + path + ": opened through its own " + METASCHEMA + " table -- " + want.size +
      " table(s), " + rows + " row(s) read. They are ROWS AND NOT YET POPULATIONS:" +
      " rmap:unproj needs state:fts to say which fact type a column carries, and this module carries none.");
    return;
  }
  // A SERVER READS NOTHING HERE (see lazyStore above); a compile, whose closure
  // reads every population anyway, and a store with no metaschema read it whole.
  if (opts && opts.lazy && !process.env.AREST_EAGER_STORE) {
    const lazy = lazyStore(db, want);
    if (lazy) {
      LAZY_STORE = lazy;
      STORE_TABLES = { has: (n) => lazy.hasRows(n) };
      for (let i = CELLS.length - 1; i >= 0; i--) if (Array.isArray(CELLS[i]) && lazy.replaced.has(CELLS[i][1])) CELLS.splice(i, 1);
      for (let i = lazy.cells.length - 1; i >= 0; i--) CELLS.unshift(lazy.cells[i]);
      // No instance index is rebuilt here: ui:ids is a view of the classification
      // population (lambda's ui:cls_rows), which the cell of its name above
      // answers when it is first read (task #172 f, 2026-10-07).
      memoClear();
      seedDerivedRows(db, have);
      return;
    }
  }
  const byFt = new Map();
  for (const [table, cols] of want) {
    // NOT IN A try. `catch { continue; }` stood here -- "a table the schema has
    // and this database does not" -- and that silence IS the 09-11 defect: four
    // fact types read as empty and the store answering a selector out of range
    // somewhere else entirely. The check above is what makes the select safe,
    // and anything else it throws is a defect to see, not to skip.
    const rows = db.query("select " + cols.map((c) => '"' + c + '"').join(",") + ' from "' + table + '"').values();
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
  const moved = recon.map((c) => [c[1], c[2]]);
  seedDerivedRows(db, have);
  db.close();
  // WHAT THE TABLES THEMSELVES HOLD, in the encoding popSnapshot compares. The
  // cells below are the same rows, but only until something recomputes one --
  // and a reflection is recomputed at every load (loadReflected), so by the
  // time the closure has run the cell no longer says what is on disk. boot()
  // diffs against THIS to find out what the tables are missing.
  STORE_TABLES = new Map(recon.map((c) => [c[1], popText(c[2])]));
  const names = new Set(recon.map((c) => c[1]));
  for (let i = CELLS.length - 1; i >= 0; i--) if (Array.isArray(CELLS[i]) && names.has(CELLS[i][1])) CELLS.splice(i, 1);
  for (let i = recon.length - 1; i >= 0; i--) CELLS.unshift(recon[i]);
  memoClear();
  // ui:ids is a view of the classification population adopted here with the
  // rest (lambda's ui:cls_rows), so no instance index is rebuilt beside it
  // (task #172 f, 2026-10-07).
  if (moved.length) { adoptStore(Ev("store:src_all", [moved, CELLS])); }
}

function loadFile() {
  // carried or not is asked of the cell's NAME: a store read on demand keeps FILE
  // in a cell whose contents are the whole source, and fetching them to see
  // whether they are there read every table at start (2026-09-24)
  if (CELLS.some((c) => Array.isArray(c) && c.length === 3 && c[1] === "FILE")) return;   // already carried
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
// carriers or the tables supplied. The two are kept apart because lambda's
// REFLECTION is the answer where it speaks: a reflected head may also be a
// rule head, and then the rule is the readings' statement of what the
// population means and the reflection is what computes it -- exactly the
// standing the effective-initial cell already has (metamodel/state.md).
const REFLECTED_NAMES = new Set();
const DERIVED_NAMES = new Set();

// THE CLOSURE IS LAMBDA'S, AND THIS ONLY ASKS FOR IT (2026-09-30). loadDerived carried
// the install policy here in JS -- which derived population replaces a cell, which is
// merged, which is left -- and lambda's store:derive_pass is that policy now, with the
// reason for each of its rules in the note above store:cell_rows. What the host still
// knows that lambda cannot is which fact types held rows when the store was READ:
// STORE_TABLES is the storage's answer, and store:dv_ctx asks it of the marked heads.
function storedNames() {
  let marks = [];
  try { marks = Ev("derive:sm_marks", CELLS); } catch { return []; }
  const out = [];
  for (const r of marks) { const n = String(r[0]); if (STORE_TABLES.has(n)) out.push(n); }
  return out;
}
function adoptClosed(next) {
  if (next === CELLS) return;
  const copy = seq(next).slice();
  CELLS.length = 0;
  for (const c of copy) CELLS.push(c);
  memoClear();
}
// THE META-TYPES ARE REFLECTED AT LOAD, and lambda says which. reflect:cells
// answers <name, population> pairs computed from the schema itself, so adding a
// reflected meta-type later is a lambda edit and never a host edit -- this
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
// A STORE THE REFLECTION LEFT AS IT WAS IS NOT REFLECTED AGAIN (2026-10-03). Every store a write adopts is
// reflected again (adoptStore), and on a copy of support's store a pass is 1.7 to 3.4 s. store:reflect_pass is a
// function of the store's content, and it adopts nothing when it adds no cell. So the store a pass added nothing
// to is kept, and a later store equal to it cell for cell -- the same cells in the same order, each the same
// object or eq to it -- is not reflected, because the pass would add nothing to it either: an approval given
// again, a write that is refused, a write that changes nothing. A pass that adds cells leaves no such store, so
// the next write's store is reflected as before.
let REFLECTED_AT = null;
// AND A STORE THIS COMPOSITION BUILT IS ONE ITS REFLECTION LEAVES AS IT IS (2026-10-04). A start computes nothing and
// reads the tables (boot), and the tables hold the closure the check took and every write's reflection since, each
// emitted by this composition's lambda. So the store a start reads is the store the last pass left as it was, and
// it is kept as one (boot): a server's first write is reflected from it, over the arms whose reads it moved, where it
// was reflected whole -- about a second on support.auto.dev, at the first write of every server, since one idle for
// ten minutes stops. That holds of a store whose rows read back as the reflection wrote them, which two defects
// broke (store:same_rows and reflect:fbd_unowned, lambda's notes); MEASURED after them on support's store as
// booted, a whole pass adds no cell. A store another composition built is read too (loadStoreDb: the schema fits,
// so the tables are read), but its reflection is that build's, so it is reflected whole at its first write, as
// every store was. Which composition built the store, from its _composition row:
let STORE_BUILT_FROM = null;
// AND A STORE IS ITS CELLS BY NAME (2026-10-03). The state is a sequence of cells fetched and stored by name
// (AREST.tex, after Backus 13.3.4 and 14.3), and the emit's store:src_all puts the cells it re-sources first, so the
// store after a write's emit is often the store its first reflection left as it was, in another order: on a copy of
// support's store a retracted approval was reflected again after its emit, 2.5 s, and added nothing.
// law:reflect_by_name holds that a reflection of a store whose cells are permuted adds the same cells. So two
// stores whose cells are all CELLs, each name once, are equal when each name holds the same cell or an eq one;
// where a name repeats, the cells are compared in order, as before.
// a store's cells by name, or null when a cell is not a CELL or a name is held twice
function cellsByName(s) {
  const m = new Map();
  for (const c of s) { if (!Array.isArray(c) || c.length !== 3 || c[0] !== "CELL" || typeof c[1] !== "string" || m.has(c[1])) return null; m.set(c[1], c); }
  return m;
}
// AND FILE IS COMPARED LAST (2026-10-03, #163). Every put refiles FILE's cell of each population it puts with a
// cell whose contents are nested when first read (store:fp_file's twin), and comparing FILE reads them. A put also
// moves the population's own cell, so where any other cell differs the stores differ whatever FILE holds: FILE is
// compared after every other cell, and only when all of them are the same.
const isFileCell = (c) => Array.isArray(c) && c[0] === "CELL" && c[1] === "FILE";
function sameStore(a, b) {
  if (a.length !== b.length) return false;
  let i = 0, fa = null, fb = null;
  for (; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (fa === null && isFileCell(a[i]) && isFileCell(b[i])) { fa = a[i]; fb = b[i]; continue; }
    if (!deepEq(a[i], b[i])) break;
  }
  if (i === a.length) return fa === null || deepEq(fa, fb);
  const ma = cellsByName(a), mb = cellsByName(b);
  if (ma === null || mb === null) return false;
  for (const [n, c] of ma) { if (n === "FILE") continue; const d = mb.get(n); if (d === undefined || (c !== d && !deepEq(c, d))) return false; }
  const c = ma.get("FILE"), d = mb.get("FILE");
  return c === d || (c !== undefined && d !== undefined && deepEq(c, d));
}
// AND FROM THE LAST STORE A PASS LEFT AS IT WAS, ONLY THE ARMS WHOSE READS MOVED (2026-10-03). Over a store the
// last pass added nothing to (REFLECTED_AT), an arm whose reads read the same in both answers what it answered
// there, which was its cell, so store:reflect_since computes only the arms whose reads moved: an approval moves
// one population, which only the four machine arms read. reflect:arm_reads says what each arm reads, and
// law:reflect_since holds that the pass adds what store:reflect_pass adds. A store whose names repeat, or
// whose earlier store's do, is reflected whole: a name is read by its first cell, and its rows are all of them.
// AND A PASS THAT ADDS CELLS IS FOLLOWED BY ONE OVER WHAT IT ADDED, UNTIL ONE ADDS NOTHING (2026-10-03). A pass that
// added cells left no store to start from, so the next adoption reflected the whole store: a write that registers
// an instance adds the reflection's rows of it, and the emit's re-sourced store came next -- on support a 15-fact
// assert spent 1,691 ms planning and writing 79 rows, and a whole pass there is 1.7 to 3.4 s. After a pass over a
// store A, every arm's cell answers A: the arms it computed were put, and the others answered A what they had
// answered their cells. So the store it made is reflected from A, which recomputes the arms whose reads the pass
// moved and keeps the rest, and that is repeated until a pass adds nothing; that store is kept, as one a pass
// added nothing to always was. Eight passes that each add something leave no store, as one did before.
// <ms, passes, whether one was a whole pass> for each reflection of the write being served, for its line
let REFLECTS = [];
function loadReflected(since) {
  const t = performance.now();
  let from = since, added = 0, passes = 0, whole = false;
  for (; passes < 8; ) {
    const at = CELLS.slice();
    const incremental = from && cellsByName(from) !== null && cellsByName(CELLS) !== null;
    const r = incremental
      ? Ev("store:reflect_since", [CELLS, [...REFLECTED_NAMES], [...DERIVED_NAMES], [], from])
      : Ev("store:reflect_pass", [CELLS, [...REFLECTED_NAMES], [...DERIVED_NAMES], []]);
    passes++;
    if (!incremental) whole = true;
    const n = Number(r[1]);
    if (!n) { REFLECTED_AT = CELLS.slice(); REFLECTS.push([performance.now() - t, passes, whole]); return added; }
    added += n;
    adoptClosed(r[0][0]);
    for (const nm of seq(r[0][1])) REFLECTED_NAMES.add(String(nm));
    // AND A WHOLE PASS THAT ADDS CELLS IS GONE ON FROM TOO (2026-10-04). It stopped there, as a precaution: its
    // cells were taken for a store's whole reflection -- a compile's first, or a boot's -- where store:reflect_since
    // is built for a write's few. But this reflects only once BOOTED, over a store the boot closed (store:close) or
    // read from its tables, and neither reflects here: a compile closes in lambda, and a start computes nothing. So
    // a whole pass adds a write's cells, and stopping left the store after it unkept, so the emit's re-sourced store
    // was reflected whole again. MEASURED on support.auto.dev before this, a server's first write after a boot
    // reflected whole twice (1,058 and 1,014 ms) and its second write once (992 ms). A whole pass after this is
    // followed by one from the store it was over, as an incremental pass always was (law:reflect_next).
    from = at;
  }
  REFLECTED_AT = null;
  REFLECTS.push([performance.now() - t, passes, whole]);
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
  const r = Ev("store:close", [CELLS, storedNames(), [...REFLECTED_NAMES], [...DERIVED_NAMES]]);
  adoptClosed(r[0]);
  for (const n of seq(r[1])) REFLECTED_NAMES.add(String(n));
  for (const n of seq(r[2])) DERIVED_NAMES.add(String(n));
}

function boot(mode) {
  // THE MODE IS A CELL, AND THE ENVIRONMENT INSTALLS IT. lambda's read:strict
  // answers F: the AREST default is not strict (Sam, 2026-09-22: "I personally
  // want my default configured to strict"). A person who wants strictness sets
  // AREST_STRICT=1 where their checks are spawned: the router's apps_check runs
  // an app's check with its own process.env, and build.js --run starts the
  // module with that env, so the env of one router entry is one person's
  // default and nobody else's. compile.js installed the cell until it was
  // deleted (ed0da6ee), which left AREST_STRICT=1 doing nothing; it is here now,
  // installed where DEF put lambda's -- in DEFS, which every application of
  // the name reads, and over lambda's cell in CELLS, which ast:fetch reads --
  // before the first evaluation, in every mode, the reader's too. compile.js
  // put a second cell in front of lambda's, which the law one-name-one-cell
  // refuses. What strictness refuses is written in lambda beside the arm that
  // refuses it.
  if (process.env.AREST_STRICT === "1") {
    const strict = K("T");
    DEFS.set("read:strict", strict);
    const at = CELLS.findIndex((c) => Array.isArray(c) && c[1] === "read:strict");
    if (at < 0) CELLS.push(["CELL", "read:strict", strict]); else CELLS[at] = ["CELL", "read:strict", strict];
    DEFSVER++;
    FETCHIDX = new WeakMap();
  }
  // the reader's host: lambda alone, no store to load, nothing to run; the
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
    // AND WHERE ITS MEMORY WENT (2026-09-23): a server of a 1,825-sentence app held
    // 514 MB private and five of them with a check beside took the machine to
    // its floor, so the lap that says the time says the resident size too.
    if (process.env.AREST_BOOT_MEMORY) { const m = process.memoryUsage();
      console.error("boot memory: " + what + " rss " + (m.rss >> 20) + " MB, heap " + (m.heapUsed >> 20) + "/" + (m.heapTotal >> 20)
        + " MB, external " + (m.external >> 20) + " MB, cells " + CELLS.length + ", memo " + EVMEMO.size); }
  };
  // A STORE WITH NO SCHEMA SURFACE has no FILE to build, nothing to reflect and
  // nothing to close under rules: the regress composition is lambda with a run's
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
  // runtime wrote (the ledger says which it did not) and adopts them, the
  // classification among them, which ui:ids is a view of; closeStore then reflects and derives over a store that has them.
  // This writes that answer back, so the tables hold what the boot computed and
  // the next reader of the tables alone sees what the server sees. It is the
  // same three lines a write takes -- snapshot, evaluate, emit what changed --
  // over the closure instead of over a POST, and on a store with no runtime
  // rows it emits nothing, because nothing changed. A store that cannot be
  // written (locked, read-only, another process mid-write) is not a failed
  // boot: the answer in memory is unaffected and only durability is lost, so
  // the refusal is reported and the boot goes on.
  if (fromDb) {
    loadStoreDb(fromDb, { lazy: true }); loadFile();
    // AND THE BASELINE IS THE TABLES, NOT THE MEMORY BEFORE THE CLOSURE. A
    // reflected population is a function of the store, so it answers the same
    // before and after the reflection wherever its inputs are already loaded --
    // the diff against the pre-closure memory was EMPTY for the very row that
    // was missing from disk. A fact type the tables do not carry at all is not
    // this loop's business: which fact types get a table, and whether that
    // table is a relation or a column of an entity table, is the relational map
    // compile-store lays out, and a boot inventing one would give a functional
    // fact type a relation table of its own.
    // A START READS THE TABLES AND COMPUTES NOTHING (Sam, 2026-09-21: "An app
    // doesn't need to be booted. It's just a sqlite db with an interface").
    // What stood here reflected and derived the whole closure at every start
    // and re-projected what the tables lacked -- support: 15,504 rows, four to
    // five minutes of one core at ~3 GB, at EVERY boot, because the projection
    // never landed four populations (task #123). The closure is written once,
    // by the check that builds the store (compile.js), and again only by the
    // write that changes it; the tables ARE the state.
    lap("store-db");
    readVerdict();
    // the store this composition built is one its reflection leaves as it is (see REFLECTED_AT)
    if (COMPOSITION && STORE_BUILT_FROM === COMPOSITION) REFLECTED_AT = CELLS.slice();
  }
  else if (!schemaless) {
    loadFile(); lap("file");
    closeStore(); lap("reflected and derived");
  }
  if (SAMPLE && process.env.AREST_SAMPLE_AFTER_BOOT) sreset(); // @instrument
  BOOTED = true;
  if (process.env.AREST_BOOT_MEMORY) {
    // what the resident heap is made of, after a collection, by object type
    Bun.gc(true);
    const hs = require("bun:jsc").heapStats();
    const top = Object.entries(hs.objectTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.error("boot memory: after gc rss " + (process.memoryUsage().rss >> 20) + " MB, heap " + (hs.heapSize >> 20) + " MB in " + hs.objectCount + " objects; "
      + top.map(([k, v]) => k + " " + v).join(", "));
    const cellBytes = CELLS.map((c) => [String(c[1]), JSON.stringify(c[2] === undefined ? null : c[2]).length])
      .sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.error("boot memory: largest cells as JSON: " + cellBytes.map(([n, b]) => n + " " + (b >> 10) + " KB").join(", "));
    // and once the allocator has had time to hand freed pages back (a server only)
    setTimeout(() => { const m2 = process.memoryUsage();
      console.error("boot memory: 5 s later rss " + (m2.rss >> 20) + " MB, heap " + (m2.heapUsed >> 20) + "/" + (m2.heapTotal >> 20) + " MB"); }, 5000).unref();
  }
  if (mode === "test") return run_test();
  // "UI" IS A SERVE TAIL, NOT A CLI ONE (build.js OUT, 2026-09-21). build.js
  // composes `ui` byte-for-byte the way it composes `serve` -- same host, same
  // lambda, same carriers, the mode string is the only thing that differs --
  // and arest-dev's and tasks' package.json both run it as
  // `build.js ui --run -- --serve`, expecting a bound port. With no arm here it
  // fell to run_cli, which reads process.argv as a verb for lambda's `main`
  // instead: `--serve` answered "unknown mode: --serve" on stdout and exit 1,
  // never binding anything, which is the "ran with no address" build.js's own
  // comment on --run records. run_serve reads no argv (only AREST_PORT), so
  // this is the whole fix -- not a new run_ui, which would just be run_serve
  // again under another name.
  if (mode === "serve" || mode === "ui") return run_serve();
  if (mode === "mcp") return run_mcp();
  if (mode === "sql") return run_sql();
  // the page host (page.js, spliced only into a page composition): an artifact page that carries this module
  if (mode === "page") return run_page();
  return run_cli();
}
