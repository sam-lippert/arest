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
