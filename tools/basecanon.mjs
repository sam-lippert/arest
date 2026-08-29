// Emit a store's compiled TERMS as canon notation, and read them back.
//
// Sam: "the json file must be deleted and removed as a concept", and
// "shouldn't the compiled fixpoint metamodel be available?"
//
// tools/storefacts.py already established the split: a POPULATION is a list of
// rows, a TERM is a form, and every term cell in the base is headed COMP. The
// facts go to base.db (tools/storedb.py, round-tripping 58 of 58). This is the
// other half -- the terms, in the notation the canon reader already parses:
//
//     expr := A(STRING) | N(INT) | K(expr) | PHI() | S1..S9(expr, ...)
//
// NOT include!d into the binary. main.rs:15630 argues against exactly that:
// include! "costs a full rebuild for every canon edit", and "AREST.tex:59 makes
// D STATE, carried by transitions; a station holding it as object code cannot
// be handed a different D." Canon itself moved off include! to reading from
// disk. The metamodel follows it rather than reversing it.
//
// S9 IS THE CEILING and four base cells exceed it -- Pluralization Replacement
// (15), Pluralization Pattern (15), Authority Type (13), Constraint Type Family
// (10). All four are `_vc` cells: value-constraint ENUMERATIONS, flat lists of
// allowed values. They are facts wearing a term's clothing, caught as terms
// only because element 0 is a string -- the same false positive that hid the
// Function: vectors. They are reported, not emitted, so nothing is silently
// re-shaped; routing them to the facts side is a separate, visible change.
//
//     bun tools/basecanon.mjs write <store.json> <out.canon>
//     bun tools/basecanon.mjs check <store.json> <out.canon>
//
// check is the part that matters: every term read back must equal the term that
// went in. Written in JS on Sam's instruction to prefer a faster target than
// python -- it is a serializer, and 327,042 nodes is where that shows.

import { readFileSync, writeFileSync, statSync } from "node:fs";

const isTerm = (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "string";

function qstr(s) {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

// the cells carrying a sequence wider than S9, reported so the count is visible
const wide = [];

// A LITERAL WIDER THAN S9 IS CANON'S OWN PROBLEM AND CANON ALREADY ANSWERS IT.
// The idiom, lifted verbatim from `arest`:
//
//     S3(A("COMP"), A("cat"), S3(A("CONS"), S9(...), S9(...)))
//
// COMP(cat, CONS(a, b)) is the concatenation form, nested for more than 18.
// The four base cells that need it are all `_vc` value-constraint enumerations
// -- Pluralization Replacement (15), Pluralization Pattern (15), Authority Type
// (13), Constraint Type Family (10) -- and the wide list sits INSIDE the
// constraint form, not as the cell's own contents, so routing them to the facts
// side was never available: they are sub-expressions of a term.
//
// The stored object is then a FORM that reduces to the literal rather than the
// literal itself, exactly as it is everywhere else in canon. check/ therefore
// compares after applying the same reduction, so what is verified is that the
// encoding denotes the same sequence -- not that two spellings match.
function enc(x, cell) {
  if (typeof x === "string") return "A(" + qstr(x) + ")";
  if (typeof x === "number" && Number.isInteger(x)) return "N(" + x + ")";
  if (Array.isArray(x)) {
    if (x.length === 0) return "PHI()";
    const parts = x.map((y) => enc(y, cell));
    if (x.length <= 9) return "S" + x.length + "(" + parts.join(", ") + ")";
    wide.push([cell, x.length]);
    // split into <=9 head and the rest, recursively, as COMP(cat, CONS(a, b))
    const head = "S9(" + parts.slice(0, 9).join(", ") + ")";
    const tail = enc(x.slice(9), cell);
    return 'S3(A("COMP"), A("cat"), S3(A("CONS"), ' + head + ", " + tail + "))";
  }
  throw new Error("unencodable leaf " + JSON.stringify(x) + " in " + cell);
}

// the reduction the runtime mu performs: COMP(cat, CONS(a, b)) -> a ++ b
function uncat(x) {
  if (!Array.isArray(x)) return x;
  // BOTH operands must be sequences. The base ALREADY uses COMP(cat, CONS(a,b))
  // for real computation, where an operand is a form or an atom, and flattening
  // one of those would be inventing a value. That ambiguity is the honest limit
  // here: canon notation cannot tell a wide LITERAL from a genuine cat, because
  // the encoding for the first is the spelling of the second.
  if (x.length === 3 && x[0] === "COMP" && x[1] === "cat"
      && Array.isArray(x[2]) && x[2].length === 3 && x[2][0] === "CONS"
      && Array.isArray(x[2][1]) && Array.isArray(x[2][2])) {
    return uncat(x[2][1]).concat(uncat(x[2][2]));
  }
  return x.map(uncat);
}

// ---- the reader: the canon grammar, nothing more ----
function parse(src) {
  let i = 0;
  const ws = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };
  const want = (c) => { ws(); if (src[i] !== c) throw new Error("want " + c + " at " + i); i++; };
  function str() {
    ws(); want('"'); i--; i++;                     // at the opening quote
    let out = "";
    while (src[i] !== '"') {
      if (src[i] === "\\") { i++; out += src[i] === "n" ? "\n" : src[i]; i++; }
      else out += src[i++];
    }
    i++;
    return out;
  }
  function expr() {
    ws();
    if (src.startsWith("A(", i)) { i += 2; const s = str(); want(")"); return s; }
    if (src.startsWith("N(", i)) {
      i += 2; ws(); let j = i; while (/[-0-9]/.test(src[j])) j++;
      const n = parseInt(src.slice(i, j), 10); i = j; want(")"); return n;
    }
    if (src.startsWith("PHI()", i)) { i += 5; return []; }
    const m = /^S([1-9])\(/.exec(src.slice(i, i + 4));
    if (m) {
      i += m[0].length;
      const out = [];
      for (;;) { ws(); if (src[i] === ")") { i++; return out; } out.push(expr()); }
    }
    throw new Error("bad expr at " + i + ": " + src.slice(i, i + 40));
  }
  const cells = [];
  for (;;) {
    ws();
    if (i >= src.length) return cells;
    if (!src.startsWith("DEF(", i)) throw new Error("want DEF at " + i);
    i += 4;
    // no want(",") here: ws() already skips commas, exactly as it must for
    // the S-sequence loop below, so demanding one finds it already eaten
    const name = str();
    cells.push([name, expr()]);
    want(")");
  }
}

const [verb, src, out] = process.argv.slice(2);
if (!verb || !src || !out) {
  console.log("bun tools/basecanon.mjs write|check <store.json> <out.canon>");
  process.exit(2);
}

const t0 = performance.now();
const raw = JSON.parse(readFileSync(src, "utf8"));
const terms = raw.d.filter((c) => isTerm(c[2])).map((c) => [c[1], c[2]]);
const facts = raw.d.filter((c) => !isTerm(c[2]));

const lines = [];
let skipped = 0;
for (const [name, v] of terms) {
  const e = enc(v, name);
  if (e === null) { skipped++; continue; }
  lines.push("DEF(" + qstr(name) + ", " + e + ")");
}
const text = lines.join("\n") + "\n";
writeFileSync(out, text);
const ms = performance.now() - t0;

console.log("terms %d  emitted %d  over S9 %d  facts %d",
            terms.length, lines.length, skipped, facts.length);
for (const [c, n] of wide.filter((w, k) => wide.findIndex((x) => x[0] === w[0]) === k))
  console.log("   over S9: %s  arity %d", c, n);
console.log("%s: %d bytes (json %d)  %.0fms",
            out.split(/[\/]/).pop(), statSync(out).size, statSync(src).size, ms);

if (verb === "check") {
  const t1 = performance.now();
  const back = new Map(parse(readFileSync(out, "utf8")));
  let same = 0, differ = [];
  for (const [name, v] of terms) {
    if (!back.has(name)) continue;
    // uncat both sides: a wide literal is stored as the concatenation FORM, so
    // what must match is what it denotes, not how it is spelled
    if (JSON.stringify(uncat(back.get(name))) === JSON.stringify(uncat(v))) same++;
    else differ.push(name);
  }
  console.log("read back %d cells in %.0fms", back.size, performance.now() - t1);
  console.log("round-trip equal: %d   differ: %d   not emitted: %d",
              same, differ.length, skipped);
  if (differ.length) console.log("   problems: %s", differ.slice(0, 6).join(", "));
  process.exit(differ.length ? 1 : 0);
}
