// Compile the design state from the readings: canon reads the closure and
// writes the carrier build.js composes.
//
// THIS IS THE ORACLE'S SEAT, TAKEN BY CANON (Sam, 2026-09-16: "AREST needs to
// provide all functionality"). The oracle wrote `design-state` from NORMA's
// model of the same .md files; this writes it from canon's reader --
// read:sentences over each file, read:row_of over each sentence, and
// read:design_state_of over the rows -- and nothing here decides anything:
// every cell is a canon value rendered as intersection source. The witness
// (tools/norma-oracle) keeps writing its own carrier to compare against; the
// build reads this one.
//
//   AREST_OUT_DIR=<app>/.check bun tools/compile-design-state.js <dir>...
//
// The directories are read in the order given, each with core.md first and
// the rest alphabetical, which is the order the oracle read them in. The
// reader's host is the reader module (canon and nothing else, booting
// nothing: the reader needs no carrier, and the base's own carrier is what
// this writes), built here when it is missing.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const here = import.meta.dir;
const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: AREST_OUT_DIR=<dir> bun tools/compile-design-state.js <readings dir>...");
  process.exit(1);
}
const out = process.env.AREST_OUT_DIR || process.cwd();

const host = join(here, "js-runner", "reader.g.js");
if (!existsSync(host)) {
  // WITHOUT AREST_OUT_DIR, which is OURS AND NOT THE BUILD'S. build.js writes
  // its module into AREST_OUT_DIR when that is set, and this run has it set to
  // the app's .check -- so the build put reader.g.js beside the carrier we are
  // about to write and the import two lines down died with "Cannot find module
  // reader.g.js", on every first run of a clean checkout (2026-09-16). The
  // reader's module belongs beside build.js, where the next run finds it.
  const env = { ...process.env };
  delete env.AREST_OUT_DIR;
  const r = spawnSync("bun", ["build.js", "reader"], { cwd: join(here, "js-runner"), stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status || 1);
}
await import(pathToFileURL(host).href);
const { Ev } = globalThis.AREST;

const order = (a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b);
const rows = [];
let files = 0, sentences = 0;
const t0 = Date.now();
for (const dir of dirs) {
  const names = readdirSync(dir);
  for (const f of names.filter((f) => f.endsWith(".md")).sort(order)) {
    files++;
    for (const s of Ev("read:sentences", readFileSync(join(dir, f), "utf8"))) { sentences++; rows.push(Ev("read:row_of", s)); }
  }
  // .env IS A CARRIER, NOT AN ENVIRONMENT FILE (2026-09-19, #109 (h)).
  // apps/support.auto.dev/.env holds twelve AREST sentences and NOT ONE
  // KEY=VALUE line: six `Domain connects to External System` and the six
  // `DomainConnectsToExternalSystem carries Secret Reference` beside them.
  // readings/feature-requests.md:207 says so outright -- the connection fact
  // and the reference it carries live together in that gitignored file. The
  // oracle is handed the app directory (support's check passes `..`) and reads
  // it: DomainConnectsToExternalSystem appears 20 times in the carrier it
  // wrote. This reader took `*.md` only, so the seat canon is taking from the
  // oracle would have dropped all six connections silently.
  // A SECRET REFERENCE IS A NAME, NOT A SECRET, and the value half is what
  // compile-store.js encrypts out of process.env at build time. So only
  // SENTENCES are read here: a KEY=VALUE line cannot become a fact, which is
  // what keeps a future .env that does carry values out of the carrier. The
  // `#` lines go the same way -- support's end in a period and would otherwise
  // read as sentences.
  if (names.includes(".env")) {
    const keep = readFileSync(join(dir, ".env"), "utf8").split("\n")
      .filter((l) => !/^\s*#/.test(l) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(l));
    let n = 0;
    for (const s of Ev("read:sentences", keep.join("\n"))) { sentences++; n++; rows.push(Ev("read:row_of", s)); }
    if (n) files++;
  }
}
const tRead = Date.now() - t0;
// THIS ONE CALL IS 95% OF THE SEAT, AND IT ACCELERATES (measured 2026-09-19).
// Taking the oracle's place costs 17m58s on support's closure where the
// oracle's own check reports 46,754 ms -- and the reading above is only
// 48,814 ms of it. Three closures, same machine, nothing else running:
//
//   closure              files  sentences   read ms   state ms
//   metamodel               16       1809      5658      18204
//   + templates + connectors 24      2341      8376      27167
//   support's whole closure  71      7762     48814    1028704
//
// The READ is a steady ~n^1.5 across both steps (1.52 then 1.47). The STATE is
// not: ~n^1.5 from the first closure to the second, then ~n^3.0 from the second
// to the third. An exponent that rises with n is a sum of terms, with a near
// cubic one taking over at application scale -- which is why this is fine on
// the metamodel the suite exercises and ruinous on an app.
// THOSE THREE CLOSURES DIFFER IN CONTENT AS WELL AS SIZE, so their exponents
// are indicative only. The controlled answer, from a generated corpus -- one
// block of twelve sentences declaring two entity types, two value types and two
// fact types, uniquely named, NO BLOCK REFERRING TO ANOTHER, plus padding
// sentences that are bare instances of block 0 so sentences and DECLARATIONS
// move independently. Declarations held at 60, paragraphs normal:
//
//   sentences    read ms    state ms   read exp   state exp
//         120        188         191          -           -
//         360        505         917       0.90        1.43
//         600        670        2762       0.56        2.16
//        1200       1470       11298       1.13        2.03
//        2400       4090       48251       1.48        2.09
//
// THE STATE IS QUADRATIC IN SENTENCES and the exponent SETTLES at ~2.05 over
// the last two doublings. The reading is roughly linear. A second sweep holding
// sentences at 1200 and varying declarations 60 -> 600 moves the state 12,434
// -> 28,159 ms, so there is a declaration term on top, but sentences are the
// dominant axis and n^2 is the shape.
// THE TERM IS read:super_of, NAMED BY CALL COUNT (2026-09-19). Profiled on the
// generated corpus at 1200 and 2400 sentences, every DEF's count is either
// ~2.1x (linear) or ~4.3x (quadratic) with nothing between:
//
//   read:player_head     3,559,880 -> 15,723,080   x4.42   exp 2.14
//   read:is_subtyping    2,949,700 -> 13,066,300   x4.43   exp 2.15
//   read:pop_cand          625,860 ->  2,689,260   x4.30   exp 2.10
//   CONST               19,112,266 -> 77,200,169   x4.04   exp 2.01
//   CONS                23,293,247 -> 90,681,280   x3.89   exp 1.96
//   everything else                                x~2.1   exp ~1.06
//
// The first two are exactly the pair inside read:super_of's ALPHA, and 628 of
// 793 stack samples read
//   read:design_state_of > read:design_state > read:otpops_state >
//   read:otpops_pairs > read:up_rows > read:ancestors_of > read:super_of
// read:super_of scans EVERY row to find ONE parent, and read:ancestors walks
// the chain calling it again at each step, so a population that reflects over
// the rows pays O(rows) per ancestor per row. It is absent from the table
// because that sorts by SELF time and all of its cost is in its children.
// #109 (f) named read:super_of and the base-metamodel reader path showed it
// costing nothing, so it was left alone with the caveat that two callers could
// still dominate an app-sized store. This is that store. The fix is an index
// rather than a scan -- a twin keyed on the rows by WeakMap, the way CATPROV
// and DEDUPKEYS already key on an array -- which takes the per-call O(rows)
// to O(1) amortised and the whole build from quadratic to linear.
// PARAGRAPHS ARE WHY AN EARLIER VERSION OF THIS NOTE SAID OTHERWISE, and the
// trap is worth recording. read:sentences is COMP(read:markers_forward,
// flatten, ALPHA(read:split_sentences), read:paragraphs, ..., read:lines,
// chars), so the split is per PARAGRAPH and quadratic in a paragraph's length.
// The generator wrote no blank lines, making one 1200-line paragraph, and the
// reading alone took 23,555 ms; the same 1200 sentences with a blank line every
// twelve take 1,399 ms. SEVENTEEN TIMES, from layout. Real readings are
// paragraphed, so that cost is not theirs -- but a generated corpus without
// blank lines measures the reader's worst case and not its normal one, and the
// numbers it gave were an artifact. The state is untouched by the layout
// (12,434 against 11,975), which is how the two were told apart.
const cells = Ev("read:design_state_of", rows);
const tState = Date.now() - t0 - tRead;

// the same renderer as compile-rmap.js: a carrier is data, and the variadic
// S( is what a generated carrier may use
function src(v) {
  if (Array.isArray(v)) return v.length === 0 ? "PHI()" : "S(" + v.map(src).join(", ") + ")";
  if (typeof v === "number") return "N(" + v + ")";
  const s = String(v);
  if (s.includes("\n") || s.includes("\r")) throw new Error("value is not emittable as canon source: " + JSON.stringify(s.slice(0, 60)));
  return 'A("' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")';
}
// the oracle's IChunked: a cell's rows in chunks of nine, one level, which
// every consumer flattens exactly once; an empty cell is S1(PHI())
function chunked(list) {
  if (list.length === 0) return "S1(PHI())";
  const chunks = [];
  for (let i = 0; i < list.length; i += 9) chunks.push(list.slice(i, i + 9));
  return src(chunks);
}
const note = "THE DESIGN STATE in INTERSECTION SOURCE (generated by tools/compile-design-state.js from canon's reader over "
  + files + " readings; regenerate, never edit). The cells are the ones the oracle's design-state carries, in its shapes: "
  + cells.map((c) => String(c[0])).join(", ") + ".";
// the carrier grammar: a note, then the cells, comma-separated, no comma after the last
const parts = [JSON.stringify(note)];
for (const [name, value] of cells) parts.push('DEF("' + name + '", ' + chunked(value) + ")");
const text = "(\n" + parts.join(",\n\n") + "\n)\n";
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "design-state"), text);
console.log("design-state: " + text.length + " bytes, " + cells.length + " cells from " + files + " files, " + sentences
  + " sentences (read " + tRead + " ms, state " + tState + " ms) at " + join(out, "design-state"));
