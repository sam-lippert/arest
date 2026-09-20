// THE COMPILER IS CANON. THIS IS THE I/O.
//
// Sam, 2026-09-20: "compile moving from a c# host to a js host is wrong", "the
// full framework must be canon with registered DEFS". The C# oracle (17,967
// lines) and the JS compiler (compile-store 902, compile-design-state 361,
// compile-rmap 161) are both deleted. What replaced them is this file, and it
// makes no decision: it reads bytes, hands them to canon, and executes the SQL
// canon answers.
//
//   readdir / readFile   ->  canon reads the sentences
//   CELLS.unshift        ->  canon's answer installed as cells
//   db.exec              ->  canon's DDL run
//
// EVERY DECISION IS A DEF. Which sentences a file holds (read:sentences), what
// a sentence declares (read:row_of), the design state (read:design_state_of),
// the relational map (rmap:*, 324 DEFs) and the schema itself (rmap:ddl and its
// eleven helpers, which have been canon all along) -- none of it is here.
//
// THE CARRIER IS GONE, NOT MOVED. design-state was a FILE because the oracle
// was a separate PROCESS and had to hand its answer across a process boundary.
// In-process the design state is a value, installed with CELLS.unshift the way
// host.js already installs the store (:3444, :3452, :3580). That deletes the
// renderer too -- src()/chunked(), whose 9-wide chunking restated canon's
// S1..S9 arity ceiling in JavaScript for a second host to get wrong.
//
// STILL OWED, AND IT IS THE POINT OF THE TICKET: these four calls should be
// REGISTERED PREDICATES, not JavaScript. metamodel/imports.md:81-85 declares
// `Predicate has Module Path` and `has Symbol Name`; readings/templates/
// vercel-ai.md:30 is the live example; main:performed walks
// PredicateIsPerformedDuringTransition and host.js's performDeclared "chooses
// NOTHING. Canon says what the call is." Compile then stops being a script and
// becomes a process in the readings, the shape #116 gave the temporal
// derivations. The module paths below are JavaScript, so the BINDING belongs in
// a per-host reading: delete tools/js-runner and you should lose the binding,
// never the compiler.
//
//   AREST_DB=<path> bun tools/js-runner/compile.js <readings dir>...
import { readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Database } from "bun:sqlite";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: AREST_DB=<path> bun tools/js-runner/compile.js <readings dir>...");
  process.exit(1);
}

// The reader is canon alone -- build.js `slim` composes no carrier and boots
// nothing, which is what lets a compiler exist before any store does.
const host = join(import.meta.dir, "reader.g.js");
if (!existsSync(host)) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("bun", ["build.js", "reader"], { cwd: import.meta.dir, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
await import(pathToFileURL(host).href);
const { Ev, CELLS } = globalThis.AREST;

// core.md first, then alphabetical -- the order the readings are meant to be
// read in. THIS IS THE LAST DECISION LEFT IN THE HOST and it belongs in canon
// with the rest of the enumeration.
const order = (a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b);

const t0 = Date.now();
const rows = [];
let files = 0, sentences = 0;
for (const dir of dirs) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort(order)) {
    files++;
    for (const s of Ev("read:sentences", readFileSync(join(dir, f), "utf8"))) {
      sentences++;
      rows.push(Ev("read:row_of", s));
    }
  }
}
const tRead = Date.now() - t0;

const t1 = Date.now();
const state = Ev("read:design_state_of", rows);
for (let i = state.length - 1; i >= 0; i--) CELLS.unshift(["CELL", String(state[i][0]), state[i][1]]);
const tState = Date.now() - t1;

const t2 = Date.now();
const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
const ddl = flat(Ev("rmap:ddl", CELLS));
const tDdl = Date.now() - t2;

const out = process.env.AREST_DB;
if (!out) {
  process.stdout.write(ddl);
} else {
  // THE LAST COMPLETE STORE IS NEVER DESTROYED UNTIL A NEW COMPLETE ONE EXISTS
  // (compile-store.js's one-sentence invariant, #108). The build goes beside
  // the store and is renamed in; that half is not written yet, so this refuses
  // to touch a store that already exists rather than risk the data.
  if (existsSync(out)) {
    console.error("refusing: " + out + " exists, and the migration gate is not rebuilt yet (#109).");
    console.error("  the invariant is compile-store.js's: the last complete store is never destroyed");
    console.error("  until a new complete one exists. Build aside and rename in, or point AREST_DB elsewhere.");
    process.exit(1);
  }
  const db = new Database(out, { create: true });
  db.exec(ddl);
  const n = db.query("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;
  db.close(true);
  console.log("store: " + n + " tables at " + out);
}
console.log("compiled " + sentences + " sentences from " + files + " files: "
  + state.length + " cells, " + ddl.length + " bytes of DDL"
  + " (read " + tRead + " ms, state " + tState + " ms, ddl " + tDdl + " ms)");
