// js-runner -- the vocabulary and the STRICT mu, a peer of tools/java-runner/Arest.java.
//
// A selector on an atom throws, a duplicate DEF throws, a comparison across atom kinds throws, an
// out-of-range selection throws. Booleans are the atoms "T" and "F", a number is a 64-bit integer
// (a BigInt held to 64 bits, as Java's Long is), a text is a string and a sequence an array. No
// meaning lives here and no speed: no memo and no twin, since a strategy a host keeps is one every
// other host must keep too. The laws are lambda's.
//
// Lambda is read as what it is in this language: the file is one parenthesized literal written in
// DEF, A, N, K, PHI and S1..S9, so `LAMBDA` before it makes it a call, and the host's own functions
// bind the vocabulary. Each constructor is held to its name: S3 with four elements is refused, as
// the Java reader refuses it, where a JS call would drop the fourth silently.
"use strict";
const fs = require("fs");

const DEFS = new Map();
const CELLS = [];
const PRIMS = new Map();

// Registration is INTO DEFS' surface (the paper's platform binding): a registered function
// resolves through the one mu by name, after any compiled cell of the same name, and a duplicate
// registration dies loud.
function register(name, impl) {
  if (PRIMS.has(name)) throw new Error("duplicate registration: " + name);
  PRIMS.set(name, impl);
}

const MIN = -(2n ** 63n), MAX = 2n ** 63n - 1n;
function num(n) {
  if (n < MIN || n > MAX) throw new Error("a number past 64 bits: " + n);
  return n;
}

function show(x) {
  if (Array.isArray(x)) return "<" + x.map(show).join(", ") + ">";
  return typeof x === "string" ? x : String(x);
}

function seq(x) {
  if (!Array.isArray(x)) throw new Error("expected sequence, got atom: " + show(x));
  return x;
}

function at(x, i) {
  const a = seq(x);
  if (i < 0 || i >= a.length) throw new Error("index " + i + " out of " + a.length);
  return a[i];
}

function deepEq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
    return true;
  }
  return false;
}

const bool = (b) => (b ? "T" : "F");

// both numbers -> numeric; both texts -> UTF-16 code-unit order; anything else THROWS, so that le
// stays an order (eq<1,"1"> is F, and no coercion makes le<1,"1"> and le<"1",1> both T)
function cmpAtoms(a, b) {
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  throw new Error("compare across atom kinds: " + show(a) + " vs " + show(b));
}

function int(x) {
  if (typeof x !== "bigint") throw new Error("a number expected: " + show(x));
  return x;
}

// Python str.strip(chars) / str.rstrip(chars), which lex needs verbatim
function pyStrip(s, cs) {
  let a = 0, b = s.length;
  while (a < b && cs.indexOf(s[a]) >= 0) a++;
  while (b > a && cs.indexOf(s[b - 1]) >= 0) b--;
  return s.substring(a, b);
}
function pyRstrip(s, cs) {
  let b = s.length;
  while (b > 0 && cs.indexOf(s[b - 1]) >= 0) b--;
  return s.substring(0, b);
}

// Backus's primitives (11.2.3), each as Arest.java defines it
PRIMS.set("id", (x) => x);
PRIMS.set("tl", (x) => { const a = seq(x); if (a.length === 0) throw new Error("tl of <>"); return a.slice(1); });
PRIMS.set("atom", (x) => bool(!Array.isArray(x)));
PRIMS.set("apndl", (x) => { const p = seq(x); return [p[0], ...seq(p[1])]; });
PRIMS.set("apndr", (x) => { const p = seq(x); const h = seq(p[0]); const r = h.slice(); r.push(p[1]); return r; });
PRIMS.set("distl", (x) => { const p = seq(x); return seq(p[1]).map((e) => [p[0], e]); });
PRIMS.set("distr", (x) => { const p = seq(x); return seq(p[0]).map((e) => [e, p[1]]); });
PRIMS.set("cat", (x) => { const p = seq(x); return seq(p[0]).concat(seq(p[1])); });
PRIMS.set("null", (x) => bool(Array.isArray(x) && x.length === 0));
PRIMS.set("eq", (x) => { const p = seq(x); return bool(deepEq(p[0], p[1])); });
PRIMS.set("not", (x) => bool(x !== "T"));
PRIMS.set("and", (x) => { const p = seq(x); return bool(p[0] === "T" && p[1] === "T"); });
PRIMS.set("length", (x) => BigInt(seq(x).length));
PRIMS.set("lt", (x) => { const p = seq(x); return bool(cmpAtoms(p[0], p[1]) < 0); });
PRIMS.set("le", (x) => { const p = seq(x); return bool(cmpAtoms(p[0], p[1]) <= 0); });
PRIMS.set("ge", (x) => { const p = seq(x); return bool(cmpAtoms(p[0], p[1]) >= 0); });
PRIMS.set("gt", (x) => { const p = seq(x); return bool(cmpAtoms(p[0], p[1]) > 0); });
PRIMS.set("reverse", (x) => seq(x).slice().reverse());
// trans: transpose a sequence of equal-length sequences
PRIMS.set("trans", (x) => {
  const rows = seq(x);
  if (rows.length === 0) return [];
  const w = seq(rows[0]).length, out = [];
  for (let c = 0; c < w; c++) out.push(rows.map((r) => at(r, c)));
  return out;
});
// defined when both are numbers and the result is one, so a result past 64 bits is bottom
PRIMS.set("+", (x) => { const p = seq(x); return num(int(p[0]) + int(p[1])); });
PRIMS.set("-", (x) => { const p = seq(x); return num(int(p[0]) - int(p[1])); });
PRIMS.set("*", (x) => { const p = seq(x); return num(int(p[0]) * int(p[1])); });
PRIMS.set("/", (x) => { const p = seq(x); return num(int(p[0]) / int(p[1])); });
PRIMS.set("apply", (x) => { const p = seq(x); return Ev(p[0], p[1]); });
// lex yields TOKEN-RECORDS, ten fields per token, as metamodel/resolution.md types it: tok,
// nopunct, base, ordinal-suffix, lower, quoted-text, initial-cap, hyphen-template, is-quoted,
// quote-index. White space is the ASCII set the Java station splits on, not JS's Unicode \s.
PRIMS.set("lex", (x) => {
  const text = x;
  if (typeof text !== "string") throw new Error("lex of a non-text");
  const spans = [];
  for (const m of text.matchAll(/'[^']*'/g)) spans.push([m.index, m.index + m[0].length]);
  const rows = [];
  for (const m of text.matchAll(/[^ \t\n\x0B\f\r]+/g)) {
    const tok = m[0], s = m.index, e = s + tok.length;
    let k = 0;
    for (let i = 0; i < spans.length; i++) if (s < spans[i][1] && spans[i][0] < e) { k = i + 1; break; }
    let qtext = "";
    if (k > 0) qtext = text.substring(Math.max(s, spans[k - 1][0] + 1), Math.min(e, spans[k - 1][1] - 1));
    const nopunct = pyStrip(tok, ".;:,");
    const base = pyRstrip(nopunct, "0123456789");
    // field 8 is the NORMA hyphen template: a one-sided touching hyphen is the bind marker and is
    // consumed, a doubled one escapes to a single literal hyphen
    let tpl = tok;
    if (tpl.length > 2 && tpl.endsWith("--")) tpl = tpl.substring(0, tpl.length - 1);
    else if (tpl.length > 2 && tpl.startsWith("--")) tpl = tpl.substring(1);
    else if (tpl.length > 1 && tpl.endsWith("-")) tpl = tpl.substring(0, tpl.length - 1);
    else if (tpl.length > 1 && tpl.startsWith("-")) tpl = tpl.substring(1);
    const up = base.length > 0 && base[0] >= "A" && base[0] <= "Z" ? "T" : "F";
    rows.push([tok, nopunct, base, nopunct.substring(base.length), tok.toLowerCase(), qtext, up, tpl, k > 0 ? "T" : "F", BigInt(k)]);
  }
  return rows;
});
// atoms stringify, numbers included
PRIMS.set("implode", (x) => { const p = seq(x); return seq(p[1]).map((e) => (typeof e === "string" ? e : String(e))).join(p[0]); });
// the char-level boundary: one atom per UTF-16 unit
PRIMS.set("chars", (x) => { if (typeof x !== "string") throw new Error("chars of a non-text"); return Array.from({ length: x.length }, (_, i) => x[i]); });
// the last of <> is bottom
PRIMS.set("1r", (x) => { const a = seq(x); if (a.length === 0) throw new Error("1r of <>"); return a[a.length - 1]; });
PRIMS.set("tlr", (x) => { const a = seq(x); if (a.length === 0) throw new Error("tlr of <>"); return a.slice(0, -1); });

function Ev(f, x) {
  if (typeof f === "bigint") {
    if (!Array.isArray(x)) throw new Error("selector " + f + " on atom: " + show(x));
    const n = Number(f);
    if (n < 1 || n > x.length) throw new Error("selector " + f + " out of range " + x.length);
    return x[n - 1];
  }
  if (typeof f === "string") {
    const body = DEFS.get(f);
    if (body !== undefined) return Ev(body, x);
    const prim = PRIMS.get(f);
    if (prim !== undefined) return prim(x);
    throw new Error("unresolved atom: " + f);
  }
  const form = seq(f);
  const head = typeof form[0] === "string" ? form[0] : null;
  // tau clause (c), METACOMPOSITION (Backus 13.3.2): the head is FETCHED, so a form lambda defines
  // is lambda's; the forms below are the primitive arm, reached only when lambda defines none
  if (head === null || DEFS.has(head)) return Ev(form[0], [f, x]);
  if (head === "COMP") {
    let v = x;
    for (let i = form.length - 1; i >= 1; i--) v = Ev(form[i], v);
    return v;
  }
  if (head === "COND") return Ev(form[1], x) === "T" ? Ev(form[2], x) : Ev(form[3], x);
  if (head === "ALPHA") return seq(x).map((e) => Ev(form[1], e));
  if (head === "INSERT") {
    const xs = seq(x);
    // /f:<> is bottom (Backus 11.2.4: /f is defined on a sequence of one or more), as Java, C# and Rust answer it
    if (xs.length === 0) throw new Error("INSERT on empty");
    let acc = xs[xs.length - 1];
    for (let i = xs.length - 2; i >= 0; i--) acc = Ev(form[1], [xs[i], acc]);
    return acc;
  }
  if (head === "WHILE") {
    let v = x;
    while (Ev(form[1], v) === "T") v = Ev(form[2], v);
    return v;
  }
  throw new Error("unknown form: " + head);
}

// ---- the reader: the vocabulary bound over the file's literal ----------------------------------

const NAMES = ["DEF", "A", "N", "K", "PHI", "S", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "LAMBDA"];

// a DEF's body is built before DEF runs, so a misshapen constructor is named when its DEF arrives
function vocabulary(def, what) {
  const arity = [];
  let pending = [];
  const sized = (n) => (...a) => { if (a.length !== n) pending.push("S" + n + " with " + a.length + " elements"); return a; };
  const v = {
    DEF: (name, body) => {
      for (const p of pending) arity.push(p + " in " + name);
      pending = [];
      def(name, body);
      return name;
    },
    A: (s) => s,
    N: (n) => num(BigInt(n)),
    K: (...a) => { if (a.length !== 1) pending.push("K with " + a.length + " elements"); return ["CONST", a[0]]; },
    PHI: () => [],
    S: (...a) => a,
    LAMBDA: (...xs) => xs,
  };
  for (let n = 1; n <= 9; n++) v["S" + n] = sized(n);
  return { v, done: () => { if (arity.length) throw new Error("lambda reader: " + what + ": " + arity.length + " constructors whose name is not their length:\n  " + arity.join("\n  ")); } };
}

function each(text, what, def) {
  const { v, done } = vocabulary(def, what);
  let fn;
  try { fn = new Function(...NAMES, "return LAMBDA" + text.trim() + ";"); }
  catch (e) { throw new Error("lambda reader: " + what + " is not the DEF grammar: " + e.message); }
  fn(...NAMES.map((n) => v[n]));
  done();
}

// Read one file and register it, in file order. A file that is missing or does not parse is FATAL.
function load(path) {
  let text;
  try { text = fs.readFileSync(path, "utf8"); }
  catch (e) { throw new Error("lambda reader: cannot read " + path + ": " + e.message); }
  each(text, path, (name, body) => {
    if (DEFS.has(name)) throw new Error("duplicate DEF: " + name);
    DEFS.set(name, body);
    CELLS.push(["CELL", name, body]);
  });
}

// A carrier's text to the <CELL, name, body> list DEF would have made of it, registering nothing.
function cells(text) {
  const out = [];
  each(text, "carrier text", (name, body) => out.push(["CELL", name, body]));
  return out;
}

function path(name, dflt) {
  const v = process.env[name];
  return v === undefined || v === "" ? dflt : v;
}

// A CARRIERS DIRECTORY is read as the Java station reads it: design-state, norma-answer where there
// is one, the compiled relational map only when its stamp is this design-state's hash, then a run's
// outcome and expected.
// the stamp is lambda's (compile:stamped): the hash of the lambda text followed by the design-state text, since the map
// is lambda's answer about a schema; so the loader is handed the lambda it read
// for now the stamp is not checked (Sam, 2026-10-22): the map is loaded whatever it was built from, as the Java
// station loads it; a lambda change that moves the map's body regenerates the carrier itself
function loadCarriers(dir, lambda = path("AREST_LAMBDA", __dirname + "/../../arest")) {
  const ds = dir + "/design-state";
  load(ds);
  if (fs.existsSync(dir + "/norma-answer")) load(dir + "/norma-answer");
  const compiled = dir + "/compiled";
  if (fs.existsSync(compiled)) load(compiled);
  for (const record of ["outcome", "expected"]) if (fs.existsSync(dir + "/" + record)) load(dir + "/" + record);
}

// THE BASE A MODULE COMPOSES IS NAMED, NOT READ (task 8e), as the Java station names it (Reader.loadBase): where dir
// holds store.db (the base a compile-store of the metamodel wrote, tools/base), the cells name it in state:base_db and
// lambda reads it whole at boot (main:boot: store:base_boot), its schema from _defs and its facts from _readings; a
// directory with no store but carriers is read as carriers are; one with neither composes no base, which is how the
// base is built: compile-store of the metamodel into an empty tools/base composes nothing and writes it.
function loadBase(dir, lambda = path("AREST_LAMBDA", __dirname + "/../../arest")) {
  const db = dir + "/store.db";
  if (fs.existsSync(db) && fs.statSync(db).isFile()) {
    CELLS.push(["CELL", "state:base_db", require("path").resolve(db).replace(/\\/g, "/")]);
    return;
  }
  if (fs.existsSync(dir + "/design-state")) return loadCarriers(dir, lambda);
  process.stderr.write("no base at " + dir + ": nothing composed under the readings\n");
}

module.exports = { DEFS, CELLS, PRIMS, register, Ev, seq, at, show, deepEq, load, cells, path, loadCarriers, loadBase, num };
