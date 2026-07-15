#!/usr/bin/env node
// The thin JS runner: a mu-evaluator over the arest canon (Backus FFP —
// atoms resolve through DEFS, numbers are selectors, sequences are
// functional forms), executing the canon's rmap definition over the design
// state the NORMA oracle emitted, and confirming the resulting schema
// against NORMA's own RMAP output (norma-tables.json).
//
//   node run.js [--state <design-state.json>] [--tables <norma-tables.json>]
//
// Scope of the confirmation (documented, not silent):
// - CLASSIFICATION + GROUPING are compared exactly: every fact type the
//   canon separates (rule 1: no single-role key) must be a NORMA table
//   (matched by generated fact name or objectifying-type name), and every
//   NORMA fact-table must be canon-separated; every absorption key the
//   canon derives (rule 2) must be a NORMA absorbing table, and vice versa.
// - Column NAMING is out of scope: NORMA emits role-qualified names
//   (citationText); the canon emits absorbed fact names. Counts reported.
// - Value-domain-only tables (independent value types with no fact
//   content, e.g. Code(value)) are NORMA data-type artifacts outside
//   rmap's fact-type mapping; they are listed and excluded.
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
}
const root = path.join(__dirname, "..", "..");
const statePath = arg("--state", path.join(root, "tools", "norma-oracle", "design-state.json"));
const tablesPath = arg("--tables", path.join(root, "tools", "norma-oracle", "norma-tables.json"));

// ---- load the canon: representations ARE FFP objects ----
const DEFS = Object.create(null);
const DEF = (n, t) => { DEFS[n] = t; return t; };
const A = x => x;
const N = x => x;
const K = x => ["CONST", x];
const PHI = () => [];
const mk = n => (...a) => {
  if (a.length !== n) throw new Error("S" + n + " got " + a.length);
  return a;
};
const S1 = mk(1), S2 = mk(2), S3 = mk(3), S4 = mk(4), S5 = mk(5),
      S6 = mk(6), S7 = mk(7), S8 = mk(8), S9 = mk(9);
eval(fs.readFileSync(path.join(root, "arest"), "utf8"));

// ---- mu ----
const isSeq = Array.isArray;
function deepEq(a, b) {
  if (a === b) return true;
  if (!isSeq(a) || !isSeq(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
  return true;
}
const prims = {
  "id": x => x,
  "tl": x => x.slice(1),
  "apndl": ([x, ys]) => [x, ...ys],
  "apndr": ([xs, y]) => [...xs, y],
  "distl": ([x, ys]) => ys.map(y => [x, y]),
  "distr": ([xs, y]) => xs.map(x => [x, y]),
  "cat": ([xs, ys]) => [...xs, ...ys],
  "null": x => (isSeq(x) && x.length === 0 ? "T" : "F"),
  "eq": ([a, b]) => (deepEq(a, b) ? "T" : "F"),
  "not": b => (b === "T" ? "F" : "T"),
  "and": ([a, b]) => (a === "T" && b === "T" ? "T" : "F"),
  "length": x => x.length,
  "le": ([a, b]) => (a <= b ? "T" : "F"),
  "ge": ([a, b]) => (a >= b ? "T" : "F"),
  "gt": ([a, b]) => (a > b ? "T" : "F"),
  "+": ([a, b]) => a + b,
  "apply": ([f, x]) => ev(f, x),
};
function ev(f, x) {
  if (typeof f === "number") {
    if (!isSeq(x)) throw new Error("selector " + f + " on non-sequence");
    return x[f - 1];
  }
  if (typeof f === "string") {
    if (Object.prototype.hasOwnProperty.call(prims, f)) return prims[f](x);
    if (f in DEFS) return ev(DEFS[f], x);
    throw new Error("unresolved atom '" + f + "' (registered-only seam?)");
  }
  if (isSeq(f)) {
    switch (f[0]) {
      case "COMP": {
        let v = x;
        for (let i = f.length - 1; i >= 1; i--) v = ev(f[i], v);
        return v;
      }
      case "CONS": return f.slice(1).map(g => ev(g, x));
      case "CONST": return f[1];
      case "COND": return ev(f[1], x) === "T" ? ev(f[2], x) : ev(f[3], x);
      case "ALPHA": return x.map(e => ev(f[1], e));
      case "INSERT": {
        if (!isSeq(x) || x.length === 0) throw new Error("INSERT over empty");
        let acc = x[x.length - 1];
        for (let i = x.length - 2; i >= 0; i--) acc = ev(f[1], [x[i], acc]);
        return acc;
      }
      case "WHILE": {
        let v = x;
        while (ev(f[1], v) === "T") v = ev(f[2], v);
        return v;
      }
      default:
        throw new Error("unhandled functional form head: " + JSON.stringify(f[0]));
    }
  }
  throw new Error("unevaluable representation: " + JSON.stringify(f));
}

// ---- design state -> canon operand ----
const design = JSON.parse(fs.readFileSync(statePath, "utf8"));
const norma = JSON.parse(fs.readFileSync(tablesPath, "utf8"));
const facts = design.facts.map(f => ({
  ...f,
  ucs: f.ucs.length > 0 ? f.ucs : (f.arity === 1 ? [[1]] : [f.players.map((_, i) => i + 1)]),
}));
const fts = facts.map(f => [f.name, f.topPlayers, f.ucs, [], []]);
const state = [fts, []];

// ---- execute the canon ----
// rmap answers a STORE: a sequence of ⟨CELL, name, rows⟩ (Backus 13.3.4/14.3);
// rmap:schema answers the same content as full fact-type descriptors —
// output type = input type, the closure surface for the laws below.
const store = ev("rmap", state);
const schema = ev("rmap:schema", state);
const [groupDescs, projDescs] = schema;
const canonSeparate = projDescs.map(d => d[0]);
const canonKeys = groupDescs.map(d => d[0]);
const canonPairs = ev("rmap:functionals", fts).map(ft => [ev("rmap:keyplayer", ft), ft[0]]);
fs.writeFileSync(path.join(__dirname, "js-schema.json"),
  JSON.stringify({ store, schema }, null, 1));

// ---- laws, canon-evaluated ----
const laws = [];
// L1 (fixpoint): re-classifying the emitted schema reproduces it — the
// group descriptors (single-role key on position 1) re-absorb to their own
// names; the projection descriptors re-separate unchanged.
const schema2 = ev("rmap:schema", [[...groupDescs, ...projDescs], []]);
const keys2 = schema2[0].map(d => d[0]);
const seps2 = schema2[1].map(d => d[0]);
laws.push(["L1 fixpoint: keys", JSON.stringify(keys2.sort()) === JSON.stringify([...canonKeys].sort())]);
laws.push(["L1 fixpoint: separations", JSON.stringify(seps2.sort()) === JSON.stringify([...canonSeparate].sort())]);
laws.push(["L1 fixpoint: projections pass through unchanged",
  schema2[1].every(d2 => projDescs.some(d => deepEq(d, d2)))]);
// L2 (a table IS fetch): Backus's up-arrow-n applied to the emitted store
// returns the cell contents — Codd's restrict-then-project on the name
// component, executed through the canon's own ast:Fetch builder.
let l2 = true, l2note = "";
try {
  for (const probe of [canonSeparate[0], canonKeys[0]]) {
    const fetched = ev(ev("ast:Fetch", probe), store);
    const cell = store.find(c => c[0] === "CELL" && c[1] === probe);
    if (!deepEq(fetched, cell[2])) l2 = false;
  }
} catch (e) { l2 = false; l2note = " (" + e.message + ")"; }
laws.push(["L2 fetch = restrict-project: table access through ast:Fetch" + l2note, l2]);

// ---- compare against NORMA ----
const norm = s => s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const byName = new Map();
for (const f of facts) {
  byName.set(norm(f.name), f);
  if (f.nesting) byName.set(norm(f.nesting), f);
}
const canonSeparateSet = new Set(canonSeparate.map(norm));
const canonKeySet = new Set(canonKeys.map(norm));

const valueTables = [];
const factTables = [];
const absorbingTables = [];
for (const t of norma.tables) {
  if (t.columns.length === 1 && t.columns[0] === "value") valueTables.push(t.name);
  else if (byName.has(norm(t.name))) factTables.push(t.name);
  else absorbingTables.push(t.name);
}

const mismatches = [];
const notes = [];
for (const t of factTables) {
  const f = byName.get(norm(t));
  const sep = canonSeparateSet.has(norm(f.name)) ||
              (f.nesting && canonSeparateSet.has(norm(f.nesting))) ||
              canonSeparate.some(n => norm(n) === norm(f.name));
  if (!sep) mismatches.push("NORMA separates '" + t + "' but the canon absorbed it");
}
for (const name of canonSeparate) {
  const f = byName.get(norm(name));
  const label = f && f.nesting ? f.nesting : name;
  const present = norma.tables.some(t => norm(t.name) === norm(name) ||
                                         (f && f.nesting && norm(t.name) === norm(f.nesting)));
  if (present) continue;
  // documented NORMA tie-break: an explicitly objectified type's identity
  // table is sometimes absorbed into a fact table that already carries its
  // identity columns (see the oracle README). Accept when some table's
  // columns cover every player of the fact.
  const carrier = f && norma.tables.find(t =>
    f.topPlayers.every(p => t.columns.some(c => norm(c).startsWith(norm(p)))) ||
    f.players.every(p => t.columns.some(c => norm(c).startsWith(norm(p)))));
  if (f && f.nesting && carrier) {
    notes.push("canon separates '" + label + "'; NORMA absorbed its identity into '" +
      carrier.name + "' (objectified-identity tie-break, both valid per oracle README)");
  } else {
    mismatches.push("canon separates '" + label + "' but NORMA has no such table");
  }
}
for (const t of absorbingTables) {
  if (!canonKeySet.has(norm(t))) {
    mismatches.push("NORMA absorbing table '" + t + "' is not a canon rule-2 key");
  }
}
for (const k of canonKeys) {
  // a rule-2 key needs a NORMA table carrying its absorbed columns; an
  // objectified type's fact table doubles as its absorbing table
  // (ConstraintSpan carries autofillsFromSuperset)
  if (!norma.tables.some(t => norm(t.name) === norm(k))) {
    mismatches.push("canon rule-2 key '" + k + "' has no NORMA table to absorb into");
  }
}

// ---- report ----
console.log("arest DEFs loaded:", Object.keys(DEFS).length);
console.log("design state:", facts.length, "fact types");
console.log("canon rmap output: a STORE of", store.length, "cells",
  "(" + canonKeys.length, "entity cells +", canonSeparate.length, "relation cells)");
for (const [name, ok] of laws) console.log((ok ? "  law OK: " : "  LAW FAILED: ") + name);
if (laws.some(l => !l[1])) process.exitCode = 1;
console.log("NORMA output:", norma.tables.length, "tables",
  "(" + absorbingTables.length, "absorbing +", factTables.length, "fact tables +",
  valueTables.length, "value-domain-only, excluded)");
console.log("absorption keys (canon):", canonKeys.join(", "));
console.log("absorbing tables (NORMA):", absorbingTables.join(", "));
const absorbedColumnCount = canonPairs.length;
console.log("absorbed fact types (canon rule 2):", absorbedColumnCount,
  "— column naming out of scope, see header");
for (const n of notes) console.log("  note: " + n);
if (mismatches.length === 0) {
  console.log("SCHEMA MATCH: canon rmap and NORMA RMAP agree on classification and grouping.");
} else {
  console.log("SCHEMA MISMATCHES: " + mismatches.length);
  for (const m of mismatches) console.log("  - " + m);
  process.exitCode = 1;
}
