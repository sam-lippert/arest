// prolog — the JS vocabulary and mu. This file NEVER runs alone: compose.js
// concatenates prolog.js ; arest ; design-state ; norma-answer ; epilog.js
// into runner.js, so the canon and the carriers appear AS SOURCE (the one
// tuple literal reads as the comma operator) and node executes one file —
// nothing is eval'd, read, or interpreted by host code at runtime. The host
// supplies exactly what the constitution allows: the registration vocabulary,
// the mu, the base primitives, and the registered boundary rows. Every law
// is a canon DEF (the law: family); the epilog only applies law:report and
// prints the verdicts.
"use strict";
const DEFS = Object.create(null);
const CELLS = [];
function DEF(name, body) {
  // Def 9: one name, one cell. A DEF that shadows a primitive silently
  // rebinds every internal application (the 'apply' incident); a DEF that
  // rewrites an existing name silently masks a splice error. Both refuse
  // at load.
  if (name in DEFS) throw new Error("duplicate DEF: " + name);
  if (typeof PRIMS !== "undefined" && name in PRIMS) throw new Error("DEF shadows a primitive: " + name);
  DEFS[name] = body; CELLS.push(["CELL", name, body]); return name;
}
function A(s) { return s; }
function N(n) { return n; }
function K(x) { return ["CONST", x]; }
function PHI() { return []; }
function S1(a) { return [a]; }
function S2(a, b) { return [a, b]; }
function S3(a, b, c) { return [a, b, c]; }
function S4(a, b, c, d) { return [a, b, c, d]; }
function S5(a, b, c, d, e) { return [a, b, c, d, e]; }
function S6(a, b, c, d, e, f) { return [a, b, c, d, e, f]; }
function S7(a, b, c, d, e, f, g) { return [a, b, c, d, e, f, g]; }
function S8(a, b, c, d, e, f, g, h) { return [a, b, c, d, e, f, g, h]; }
function S9(a, b, c, d, e, f, g, h, i) { return [a, b, c, d, e, f, g, h, i]; }
const isSeq = Array.isArray;
function deepEq(a, b) {
  if (a === b) return true;
  if (!isSeq(a) || !isSeq(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
  return true;
}
// base primitives (Backus 11.2.3) plus the five registered boundary rows of
// resolution.md (lex, implode, slug, escape_html, strip_prefix) — the
// registered surface a host may serve, dom/cod per the Def 9 rows
const PRIMS = {
  id: x => x,
  tl: x => x.slice(1),
  atom: x => (isSeq(x) ? "F" : "T"),
  apndl: p => [p[0]].concat(p[1]),
  apndr: p => p[0].concat([p[1]]),
  distl: p => p[1].map(e => [p[0], e]),
  distr: p => p[0].map(e => [e, p[1]]),
  cat: p => p[0].concat(p[1]),
  "null": x => (isSeq(x) && x.length === 0 ? "T" : "F"),
  eq: p => (deepEq(p[0], p[1]) ? "T" : "F"),
  not: x => (x === "T" ? "F" : "T"),
  and: p => (p[0] === "T" && p[1] === "T" ? "T" : "F"),
  length: x => x.length,
  le: p => (p[0] <= p[1] ? "T" : "F"),
  ge: p => (p[0] >= p[1] ? "T" : "F"),
  gt: p => (p[0] > p[1] ? "T" : "F"),
  "+": p => p[0] + p[1],
  apply: p => ev(p[0], p[1]),
  lex: x => String(x).split(/\s+/).filter(w => w.length > 0),
  implode: p => p[1].join(String(p[0])),
  slug: x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ""),
  escape_html: x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  strip_prefix: p => {
    const pre = String(p[0]), t = String(p[1]);
    return t.length > pre.length && t.slice(0, pre.length) === pre
      ? t.slice(pre.length) : t;
  },
  "1r": x => x[x.length - 1],
  tlr: x => x.slice(0, -1),
};
function ev(f, x) {
  if (typeof f === "number") return x[f - 1];
  if (typeof f === "string") {
    if (f in DEFS) return ev(DEFS[f], x);
    if (f in PRIMS) return PRIMS[f](x);
    throw new Error("unresolved atom: " + f);
  }
  const head = f[0];
  if (head === "COMP") {
    let v = x;
    for (let i = f.length - 1; i >= 1; i--) v = ev(f[i], v);
    return v;
  }
  if (head === "CONS") {
    const out = [];
    for (let i = 1; i < f.length; i++) out.push(ev(f[i], x));
    return out;
  }
  if (head === "CONST") return f[1];
  if (head === "COND") return ev(f[1], x) === "T" ? ev(f[2], x) : ev(f[3], x);
  if (head === "ALPHA") return x.map(e => ev(f[1], e));
  if (head === "INSERT") {
    let acc = x[x.length - 1];
    for (let i = x.length - 2; i >= 0; i--) acc = ev(f[1], [x[i], acc]);
    return acc;
  }
  if (head === "WHILE") {
    let v = x;
    while (ev(f[1], v) === "T") v = ev(f[2], v);
    return v;
  }
  throw new Error("unknown form: " + String(head));
}
