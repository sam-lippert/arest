// POPULATION EQUALITY: do two recipes for the same head derive the same rows?
//
// The acceptance test for the oracle's derivation arms was, until now, that an
// emitted recipe reproduce canon's hand-written cell BYTE-FOR-BYTE. That is the
// right conservative gate while each sentence shape admits one sensible plan,
// and it caught every arm bug this month. It cannot adjudicate TWO CORRECT
// PLANS, and the general join arm produced the first of those:
//
//   FactIsInConsequentFactType
//     oracle : join-based left fold, with reordering projections
//     canon  : nested joinon with explicit keys and arbitrary out projections
//
// joinon is the more general operator -- it needs no reordering -- so canon's
// plan is flatter. Both are plausible over the same four legs, and string
// comparison says only that they differ. This says whether they AGREE.
//
// WHICH STORE. Evaluating against the app's own store answered 0 rows against 0
// rows, which proves nothing: a comparison set that cannot exhibit the
// phenomenon is silent, not confirming. So the store used here is the SYNTHETIC
// one canon's own law carries (arest, the law:report entry that asserts
// FactIsInConsequentFactType == <<fx,ftc>>), derived first through
// rules:metamodel so that DERIVED inputs -- FactIsOfFunction among them -- exist
// before either recipe runs. That store is built to exercise these rules, and a
// run that yields 0 rows on both sides is reported as INCONCLUSIVE rather than
// as agreement.
//
//   bun tools/pop-equal.js <recipe-file>
//
// where <recipe-file> holds two recipe sources, one per line, in canon's own
// constructor syntax. Prints the rows each derives and whether they agree.
const BS = String.fromCharCode(92);
const root = process.cwd().split(BS).join("/");
await import("file://" + root + "/tools/js-runner/cases.g.js");
const { Ev, CELLS } = globalThis.AREST;
const fs = await import("node:fs");

// recipe source -> AST. A("x") is an atom, N(n) a number, S<k>(..) a tuple and
// PHI() the empty one -- the constructors canon itself is written in, so a
// recipe can be pasted straight from a design-state or from arest.
function parse(src) {
  let i = 0;
  const ws = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };
  function node() {
    ws();
    if (src.startsWith("PHI()", i)) { i += 5; return []; }
    const m = /^([A-Z]+)(\d*)\(/.exec(src.slice(i));
    if (!m) throw new Error("cannot parse at: " + src.slice(i, i + 40));
    i += m[0].length;
    if (m[1] === "A") {
      const q = src.indexOf('"', i) + 1, e = src.indexOf('"', q);
      const v = src.slice(q, e); i = src.indexOf(")", e) + 1; return v;
    }
    if (m[1] === "N") {
      const e = src.indexOf(")", i); const v = Number(src.slice(i, e)); i = e + 1; return v;
    }
    const out = [];
    for (;;) { ws(); if (src[i] === ")") { i++; break; } out.push(node()); }
    return out;
  }
  return node();
}

// the synthetic population from canon's law, lifted by locating the first
// theta:unfold_pairs applied to a literal rather than to a name
function balanced(s, i) {
  let d = 0;
  for (; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")" && --d === 0) return i + 1;
  }
  return -1;
}
function syntheticStore() {
  const canon = fs.readFileSync(root + "/arest", "utf8");
  const at = canon.indexOf('A("theta:unfold_pairs"), K(');
  if (at < 0) throw new Error("no synthetic population found in canon");
  const k = canon.indexOf("K(", at);
  const lit = canon.slice(k + 2, balanced(canon, canon.indexOf("(", k)) - 1);
  const rules = Ev("theta:unfold_pairs", Ev("rules:metamodel", CELLS));
  return Ev("derive", [rules, Ev("theta:unfold_pairs", parse(lit))]);
}

const lines = fs.readFileSync(process.argv[2], "utf8").split("\n").filter((l) => l.trim());
if (lines.length < 2) { console.error("need two recipe sources, one per line"); process.exit(1); }
const store = syntheticStore();
const key = (r) => JSON.stringify(r);
const [ra, rb] = [parse(lines[0]), parse(lines[1])].map((r) => Ev("derive:eval", [r, store]));
const sa = new Set(ra.map(key)), sb = new Set(rb.map(key));
const onlyA = [...sa].filter((x) => !sb.has(x)), onlyB = [...sb].filter((x) => !sa.has(x));
console.error("  A: " + ra.length + " rows  " + [...sa].slice(0, 4).join(" "));
console.error("  B: " + rb.length + " rows  " + [...sb].slice(0, 4).join(" "));
if (ra.length === 0 && rb.length === 0) {
  console.error("  INCONCLUSIVE - both empty; this store does not exercise the rule");
  process.exit(2);
}
if (onlyA.length === 0 && onlyB.length === 0) { console.error("  POPULATIONS EQUAL"); process.exit(0); }
console.error("  DIFFER - only-A " + JSON.stringify(onlyA) + "  only-B " + JSON.stringify(onlyB));
process.exit(1);
