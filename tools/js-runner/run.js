#!/usr/bin/env node
// The checker: a quick-and-dirty mu over the arest canon (per the exec
// ruling: never production — Rust->WASM generates the production
// artifacts; this exists to hold the canon to its laws). Atoms resolve
// through DEFS, numbers are selectors, sequences are functional forms.
// ALL inputs and outputs are INTERSECTION SOURCE (the pure-math carrier
// ruling): design-state and norma-answer are evaluated with the same
// vocabulary binding as the canon itself; no JSON anywhere.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const oracleDir = path.join(root, "tools", "norma-oracle");

// ---- vocabulary: representations ARE FFP objects ----
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
const canonNames = new Set(Object.keys(DEFS));
eval(fs.readFileSync(path.join(oracleDir, "design-state"), "utf8"));
eval(fs.readFileSync(path.join(oracleDir, "norma-answer"), "utf8"));

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
  "atom": x => (isSeq(x) ? "F" : "T"),
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

// ---- carriers: shape-driven unchunking. Long collections nest in
// chunks of nine (recursively, so depth grows with size); consumers
// flatten — through the canon's own theta:flatten — until every element
// has the documented leaf shape.
const flat1 = chunks => ev("theta:flatten", chunks);
function unfold(x, leaf) {
  if (!isSeq(x) || x.length === 0) return x;
  let v = x;
  while (!v.every(leaf)) v = flat1(v);
  return v;
}
const isAtom = e => !isSeq(e);
// an empty sequence is a spent chunk, not a row — rows carry at least one atom
const isRow = e => isSeq(e) && e.length > 0 && e.every(isAtom);
const isDescriptor = e => isSeq(e) && e.length === 5 && isAtom(e[0]) && isSeq(e[1]);
const isPair = e => isSeq(e) && e.length === 2 && isAtom(e[0]);
const fts = unfold(DEFS["state:fts"], isDescriptor)
  .map(d => [d[0], d[1], d[2], d[3], unfold(d[4], isRow)]);
const nestings = new Map(unfold(DEFS["state:nestings"], isPair).map(p => [p[0], p[1]]));
const normaTables = unfold(DEFS["norma:tables"], isPair)
  .map(t => ({ name: t[0], columns: unfold(t[1], isAtom) }));
const state = [fts, unfold(DEFS["state:otpops"], isPair).map(p => [p[0], unfold(p[1], isAtom)])];

// ---- execute the canon ----
const store = ev("rmap", state);
const schema = ev("rmap:schema", state);
const [groupDescs, projDescs] = schema;
const canonSeparate = projDescs.map(d => d[0]);
const canonKeys = groupDescs.map(d => d[0]);
const populated = fts.filter(d => d[4].length > 0);

// ---- laws, canon-evaluated ----
const laws = [];
// L1 fixpoint
const schema2 = ev("rmap:schema", [[...groupDescs, ...projDescs], []]);
laws.push(["L1 fixpoint: keys",
  JSON.stringify(schema2[0].map(d => d[0]).sort()) === JSON.stringify([...canonKeys].sort())]);
laws.push(["L1 fixpoint: separations",
  JSON.stringify(schema2[1].map(d => d[0]).sort()) === JSON.stringify([...canonSeparate].sort())]);
laws.push(["L1 fixpoint: projections pass through unchanged",
  schema2[1].every(d2 => projDescs.some(d => deepEq(d, d2)))]);
// L2 table IS fetch
let l2 = true, l2note = "";
try {
  for (const probe of [canonSeparate[0], canonKeys[0]]) {
    const fetched = ev(ev("ast:Fetch", probe), store);
    const cell = store.find(c => c[0] === "CELL" && c[1] === probe);
    if (!deepEq(fetched, cell[2])) l2 = false;
  }
} catch (e) { l2 = false; l2note = " (" + e.message + ")"; }
laws.push(["L2 fetch = restrict-project: table access through ast:Fetch" + l2note, l2]);
// L3 origin boundary: manifest:origins over the canon-as-store agrees with
// the readings' boundary rows — compiled names are exactly the DEFs, and
// every hand-declared registered name is in the computed registered set
let l3 = true, l3notes = [];
try {
  const canonStore = Object.keys(DEFS)
    .filter(n => canonNames.has(n))
    .map(n => ["CELL", n, DEFS[n]]);
  const origins = ev("manifest:origins", canonStore);
  const compiled = new Set(origins.filter(r => r[1] === "compiled").map(r => r[0]));
  const registered = new Set(origins.filter(r => r[1] === "registered").map(r => r[0]));
  const defNames = new Set(canonStore.map(c => c[1]));
  if (compiled.size !== defNames.size || ![...defNames].every(n => compiled.has(n))) {
    l3 = false; l3notes.push("compiled set != DEF names");
  }
  const originFt = fts.find(d => d[0] === "FunctionHasDefinitionOrigin");
  const handRegistered = originFt
    ? originFt[4].filter(r => r[1] === "registered").map(r => r[0])
    : [];
  const missing = handRegistered.filter(n => !registered.has(n));
  if (missing.length > 0) {
    l3 = false;
    l3notes.push("boundary rows not in computed registered set: " + missing.join(", "));
  }
  const extras = [...registered].filter(n => typeof n === "string" && !handRegistered.includes(n));
  laws.push(["L3 origin boundary: compiled = DEFs (" + compiled.size + "), hand rows (" +
    handRegistered.length + ") all computed-registered" +
    (l3notes.length ? " — " + l3notes.join("; ") : ""), l3]);
  console.log("  L3 computed-registered beyond the hand rows (forms, marks, data atoms): " + extras.length);
} catch (e) {
  laws.push(["L3 origin boundary (" + e.message + ")", false]);
}
// L4 population consistency: every DECLARED single-role key holds in the
// attributed population (csdp:s4's induction must rediscover it)
let l4 = true;
let induceChecked = 0, induceCandidates = 0;
const l4failures = [];
for (const d of populated) {
  const inducedRaw = ev("csdp:single_key_positions", d);
  const induced = new Set(inducedRaw);
  const declaredSingles = d[2].filter(u => isSeq(u) && u.length === 1).map(u => u[0]);
  induceChecked++;
  induceCandidates += Math.max(0, induced.size - declaredSingles.length);
  for (const p of declaredSingles) {
    if (!induced.has(p)) {
      l4 = false;
      if (l4failures.length < 8) l4failures.push(d[0] + " declared key position " + p + " violated by rows");
    }
  }
}
laws.push(["L4 population consistency: declared keys hold in " + induceChecked + " populated fact types", l4]);
for (const f of l4failures) console.log("  L4 violation: " + f);

// ---- NORMA comparison ----
const norm = s => s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const byName = new Map();
for (const d of fts) {
  byName.set(norm(d[0]), d);
  const nest = nestings.get(d[0]);
  if (nest) byName.set(norm(nest), d);
}
const canonSeparateSet = new Set(canonSeparate.map(norm));
const valueTables = [], factTables = [], absorbingTables = [];
for (const t of normaTables) {
  if (t.columns.length === 1 && t.columns[0] === "value") valueTables.push(t.name);
  else if (byName.has(norm(t.name))) factTables.push(t.name);
  else absorbingTables.push(t.name);
}
const mismatches = [];
const notes = [];
for (const t of factTables) {
  const d = byName.get(norm(t));
  const nest = nestings.get(d[0]);
  const sep = canonSeparateSet.has(norm(d[0])) || (nest && canonSeparateSet.has(norm(nest)));
  if (!sep) mismatches.push("NORMA separates '" + t + "' but the canon absorbed it");
}
for (const name of canonSeparate) {
  const d = byName.get(norm(name));
  const nest = d ? nestings.get(d[0]) : null;
  const label = nest || name;
  const present = normaTables.some(t => norm(t.name) === norm(name) ||
                                        (nest && norm(t.name) === norm(nest)));
  if (present) continue;
  const carrier = d && (
    normaTables.find(t => nest && norm(t.name).startsWith(norm(nest))) ||
    normaTables.find(t => d[1].every(p => t.columns.some(c => norm(c).startsWith(norm(p))))));
  if (d && nest && carrier) {
    notes.push("canon separates '" + label + "'; NORMA absorbed its identity into '" +
      carrier.name + "' (objectified-identity tie-break, both valid per oracle README)");
  } else {
    mismatches.push("canon separates '" + label + "' but NORMA has no such table");
  }
}
for (const t of absorbingTables) {
  if (!canonKeys.some(k => norm(k) === norm(t))) {
    mismatches.push("NORMA absorbing table '" + t + "' is not a canon rule-2 key");
  }
}
for (const k of canonKeys) {
  if (!normaTables.some(t => norm(t.name) === norm(k))) {
    mismatches.push("canon rule-2 key '" + k + "' has no NORMA table to absorb into");
  }
}

// ---- checker answer, in the intersection dialect ----
function emit(x) {
  if (typeof x === "number") return "N(" + x + ")";
  if (typeof x === "string") {
    if (x.indexOf('"') >= 0) throw new Error("double quote in atom");
    return 'A("' + x + '")';
  }
  if (isSeq(x)) {
    if (x.length === 0) return "PHI()";
    if (x.length <= 9) return "S" + x.length + "(" + x.map(emit).join(", ") + ")";
    const chunks = [];
    for (let i = 0; i < x.length; i += 9) chunks.push(x.slice(i, i + 9));
    return emit(chunks);
  }
  throw new Error("unemittable: " + typeof x);
}
fs.writeFileSync(path.join(__dirname, "checker-answer"),
  '(\n"THE CHECKER ANSWER in INTERSECTION SOURCE (generated by js-runner; regenerate, never edit). checker:store — the store rmap answered: entity cells with wide rows, relation cells with their populations.",\n\nDEF("checker:store", ' +
  emit(store) + ")\n)\n");

// ---- report ----
console.log("arest DEFs loaded:", canonNames.size, "— carriers:",
  fts.length, "fact types,", populated.length, "populated,",
  state[1].length, "entity populations,", normaTables.length, "NORMA tables");
console.log("canon rmap output: a STORE of", store.length, "cells",
  "(" + canonKeys.length, "entity cells +", canonSeparate.length, "relation cells)");
const fnGroup = groupDescs.find(d => d[0] === "Function");
if (fnGroup) {
  console.log("Function entity cell:", fnGroup[4].length, "wide rows (sample:",
    JSON.stringify(fnGroup[4][0] ? fnGroup[4][0].slice(0, 4) : null), "...)");
}
for (const [name, ok] of laws) console.log((ok ? "  law OK: " : "  LAW FAILED: ") + name);
console.log("  L4 induced-beyond-declared key candidates (small-sample, informational):", induceCandidates);
for (const n of notes) console.log("  note: " + n);
if (mismatches.length === 0) {
  console.log("SCHEMA MATCH: canon rmap and NORMA RMAP agree on classification and grouping.");
} else {
  console.log("SCHEMA MISMATCHES: " + mismatches.length);
  for (const m of mismatches) console.log("  - " + m);
}
if (laws.some(l => !l[1]) || mismatches.length > 0) process.exitCode = 1;
