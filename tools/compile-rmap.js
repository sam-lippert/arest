// Compile the relational map once and write it beside the store.
//
// rmap is a migration script. Canon already says so: 33 of its steps are
// written as `COND (ast:fetch("stored:rmap:X", store) == '#') -> derive, else
// the stored cell` -- compile once, read thereafter. All 64 references to
// those names are READS. Nothing had ever written one, so every boot and every
// law report rebuilt the whole map: 76.8s on the oracle store, of which
// rmap:colnames alone is 63.6s, and auto.dev never finished a law report at
// all.
//
// This is the writer. It boots a host over the carriers, evaluates each
// artifact once, and emits them as a `compiled` carrier that build.js splices
// alongside design-state and norma-answer. A store that carries it skips the
// derivation entirely.
//
// Generated carriers may use the variadic S(, which the rust build rewrites to
// fixed arity and the js host gets for free from `arguments`. Hand-written
// canon may not -- S1..S9 is the ceiling there -- which is why this emits a
// carrier and not canon.
import { createHash } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const root = join(here, "..");
const carriers = process.env.AREST_CARRIERS || join(here, "norma-oracle");

// the artifact names are canon's own, not a list kept in step by hand
const names = [...new Set(
  readFileSync(join(root, "arest"), "utf8").match(/stored:rmap:[A-Za-z_0-9]+/g) || [])].sort();
// [A-Za-z], not [a-z]: rmap:childrenN reads stored:rmap:childrenN, and a
// lower-case-only class truncates it at the capital N. The tool then looked
// for rmap:children:derive, found nothing, and skipped a real artifact --
// which I reported as a dangling reference in canon. Canon was consistent.
if (names.length === 0) {
  console.error("no stored:rmap:* names found in canon");
  process.exit(1);
}

// THE COMPOSITION MUST BE THE ONE BUILT FOR THESE CARRIERS. This imports
// whatever cases.g.js is on disk while writing beside AREST_CARRIERS, so
// pointing the env var at one app while the composition holds another emits
// the WRONG store's artifacts into that app -- auto.dev twice received a
// carrier byte-identical to the oracle's, 1,009,655 bytes of another schema.
// WHERE the composition is read from follows AREST_OUT_DIR, the same variable
// build.js writes to, so a caller that composed into its own directory can
// compile there without touching the runner's working module. Compiling a
// corpus used to mean building js-runner/cases.g.js for that corpus and
// leaving it there, which clobbers the module every other check reads. The
// stamp test below is unchanged and is what actually keeps the two honest:
// wherever the composition sits, it must be the one built for THESE carriers.
const modDir = process.env.AREST_OUT_DIR || join(here, "js-runner");
const composed = readFileSync(join(modDir, "cases.g.js"), "utf8");
const stamped = (composed.match(/AREST_CARRIERS_DIR=(.*)/) || [])[1];
// Compared with separators normalised: build.js stamps a native Windows path
// while AREST_CARRIERS is usually given with forward slashes.
const norm = (s) => s.trim().split(String.fromCharCode(92)).join("/").replace(/\/+$/, "").toLowerCase();
if (stamped === undefined || norm(stamped) !== norm(carriers)) {
  console.error("refusing: composition built from " + (stamped || "(no stamp)").trim());
  console.error("           this run writes to " + carriers);
  console.error("build it for these carriers first:");
  console.error("  AREST_CARRIERS=" + carriers + " bun tools/js-runner/build.js test");
  process.exit(1);
}
await import("file://" + join(modDir, "cases.g.js").replace(/\\/g, "/"));
const { Ev, CELLS } = globalThis.AREST;

// A("...") is a string literal to every reader of a carrier -- the js module
// takes it as JavaScript, the rust build's splitter (build.rs top_level) reads
// a backslash as escaping the next byte, and the oracle already writes
// design-state values this way (Verifier.cs, the A() emitter: backslash
// doubled, quote escaped). The refusal that stood here skipped two artifacts
// of the support store, cexp and childrenN, over one reading that quotes a
// phrase, and the report then derived both at every boot (2026-09-07). A
// newline still ends the line for the rust splitter, so a value holding one
// is still refused.
function src(v) {
  if (Array.isArray(v)) return v.length === 0 ? "PHI()" : "S(" + v.map(src).join(", ") + ")";
  if (typeof v === "number") return "N(" + v + ")";
  const s = String(v);
  if (s.includes("\n") || s.includes("\r")) {
    throw new Error("value is not emittable as canon source: " + JSON.stringify(s.slice(0, 60)));
  }
  return 'A("' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")';
}

const parts = [];
let derived = 0, skipped = 0;
for (const full of names) {
  // COMPILE FROM THE DERIVE SIDE, NOT THE READ SIDE. rmap:tables is the COND
  // that returns the stored cell when one is present, so evaluating it while
  // an older `compiled` carrier is spliced in re-emits the stale artifact and
  // the tool silently becomes a no-op -- which is exactly what happened on the
  // first schema change after this file landed: 32 artifacts "rewritten" in
  // 10ms each, byte-identical, still describing the previous schema.
  // rmap:tables:derive is the computation itself and cannot short-circuit.
  const step = full.replace(/^stored:/, "") + ":derive";
  const t = Date.now();
  let v;
  try {
    v = Ev(step, CELLS);
  } catch (e) {
    console.error("  skip " + full + " (" + step + " raised: " + e.message.slice(0, 60) + ")");
    skipped++;
    continue;
  }
  let text;
  try {
    text = src(v);
  } catch (e) {
    console.error("  skip " + full + " (" + e.message + ")");
    skipped++;
    continue;
  }
  parts.push('DEF("' + full + '", ' + text + ")");
  derived++;
  console.error("  " + full.padEnd(28) + String(Date.now() - t).padStart(7) + " ms  " +
    (Array.isArray(v) ? v.length + " rows" : "scalar"));
}

const note = '"THE COMPILED RELATIONAL MAP (generated by tools/compile-rmap.js; regenerate, never edit). One DEF per stored:rmap artifact. Canon reads each through a COND that derives only when the cell is absent, so a store carrying this file skips the Rmap derivation entirely -- 76.8s on the oracle store when it was absent, of which rmap:colnames was 63.6s. This is the migration output: rmap runs for uncompiled schemas and not otherwise. It is keyed to the schema it was compiled from, so a schema change must regenerate it."';

// FINGERPRINT THE SCHEMA THIS WAS COMPILED FROM. The carrier is derived from
// design-state and nothing detected when the two drifted: regenerating
// design-state silently invalidated it, and an emitter change separately left
// app carriers describing a canon that no longer read them, surfacing as a boot
// crash naming a selector. build.js compares this and declines to splice a
// carrier that no longer matches, which is safe -- an uncompiled schema derives.
const NL2 = String.fromCharCode(10);
const qq = String.fromCharCode(34);
const fingerprint = createHash("sha256")
  .update(readFileSync(join(carriers, "design-state")))
  .digest("hex").slice(0, 16);
const out = "(" + NL2 + qq + "AREST_COMPILED_FROM=" + fingerprint + qq + "," + NL2 + NL2 + note + "," + NL2 + NL2 + parts.join("," + NL2 + NL2) + NL2 + ")" + NL2;
writeFileSync(join(carriers, "compiled"), out);
console.error(derived + " artifacts written, " + skipped + " skipped -> " + join(carriers, "compiled") + " (" + out.length + " bytes)");
