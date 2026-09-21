// THE COMPILER IS CANON. THIS IS THE I/O.
//
// Sam, 2026-09-20: "compile moving from a c# host to a js host is wrong", "the
// full framework must be canon with registered DEFS". The C# oracle (17,967
// lines) and the JS compiler (compile-store 902, compile-design-state 361,
// compile-rmap 161) are both deleted. What replaced them is this file, and it
// makes no decision: it reads bytes, hands them to canon, and executes the SQL
// canon answers.
//
//   fs:dir / fs:read      ->  REGISTERED: a directory listing, a file's bytes
//   sql:exec              ->  REGISTERED: the database engine
//   CELLS.unshift         ->  canon's answer installed as cells
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
// AND THE CALLS THEMSELVES ARE REGISTERED (#109, 2026-09-21). Sam: "Compile
// should have a canon implementation with registrations for the db engine.
// Having compile be an empty slot is wrong." It was an empty slot: resolution.md
// declared `Operation compile is registrable` with no registration, so the
// model's own `Operation awaits a driver` named compile a seam to be driven by
// hand. DEF(compile) is the implementation, and fs:dir, fs:read and sql:exec are
// the registrations -- a directory listing, a file's bytes and a database engine,
// the three things outside D. They live in host.js's PRIMS beside clock and the
// crypt pair, so deleting tools/js-runner loses the binding and never the
// compiler.
//
// WHAT IS STILL THIS FILE'S: the carrier's renderer (src/esc below) and the row
// inserts. The inserts stay here deliberately -- #96 was an apostrophe silently
// truncating a value, and rendering 2,657 rows into SQL text to pass them
// through sql:exec would earn that back.
//
//   AREST_DB=<path> bun tools/js-runner/compile.js <readings dir>...
//   AREST_OUT_DIR=<dir> bun tools/js-runner/compile.js <readings dir>...
import { readFileSync, writeFileSync, rmSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
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

// WHICH FILES ARE READINGS AND IN WHAT ORDER IS CANON'S. It was this file's
// last decision in the read phase -- core.md first, then alphabetical -- and
// read:file_order answers it from a directory listing.

// THE READ PHASE IS DEF(compile). compile:files is the reading files of every
// directory in reading order, compile:rows their sentences as rows, and
// DEF(compile) is read:design_state_of over those -- the whole pipeline this
// file used to run as a loop. The two file calls inside it are REGISTERED:
// fs:dir and fs:read are host prims with no canon cell, which is what puts
// them in the enumerable boundary instead of in this file.
const t0 = Date.now();
const files = Ev("compile:files", dirs).length;
const sentences = Ev("compile:rows", dirs).length;
const tRead = Date.now() - t0;

// AND THE DESIGN STATE IS DEF(compile) ITSELF, not read:design_state_of over
// rows this file gathered. The counts above come from the same two cells the
// pipeline walks, on the same `dirs` array, so the evaluator answers them from
// its memo rather than reading the directory twice.
const t1 = Date.now();
const state = Ev("compile", dirs);
for (let i = state.length - 1; i >= 0; i--) CELLS.unshift(["CELL", String(state[i][0]), state[i][1]]);
const tState = Date.now() - t1;

// ---- THE CARRIER, WRITTEN BY CANON --------------------------------------
// It is the design state as intersection source, the form host.js's CANONTEXT
// already reads -- and writing it here is NOT the renderer coming back. The
// old one chunked every sequence nine wide because build.js spliced the
// carrier as JavaScript CODE and S9 is a nine-parameter function; a carrier is
// spliced as TEXT now (build.js's AS_TEXT, 2026-09-07), and CANONTEXT accepts
// the bare `S` at any arity. So no host restates canon's S1..S9 ceiling and
// this is twelve lines: A an atom, N a number, PHI the empty sequence, DEF a
// <name, body> entry, and the escapes CANONTEXT's own reader undoes.
//
// WHY IT EXISTS AT ALL, since #109 is about removing exactly this kind of
// intermediate: build.js composes the design state INTO the module, and the
// alternative -- the module booting its design state from the store -- is the
// half of the flip that canon cannot yet answer. Measured on the metamodel
// (2026-09-20): rmap:ddl gives 11 tables and 344 columns, but each column
// carries a PATH of 1 to 7 steps (32 are one hop; 100 are two; 82 are four),
// and 4 populated fact types -- ObjectTypeIsSubtypeOfObjectType,
// ObjectTypeInstanceIsInstanceOfObjectType, FunctionIsSupersededByFunction,
// GuardReferencesFactType, 1,543 of the store's 3,540 rows -- are named by no
// path at all, because subtyping and instance-of are realised as table
// MEMBERSHIP rather than as a column. Canon emits the schema and has no
// projection into it and no inverse, so until it does, the store cannot carry
// the design state and the carrier does.
const outDir = process.env.AREST_OUT_DIR;
// THE DESIGN STATE IS A VALUE; THE CARRIER IS ONE RENDERING OF IT, and the
// store's identity is the value, not the file. This rendering used to live
// inside `if (outDir)` together with the stamp that hashes it, so a compile
// asked only for a database -- which is how a store is made -- wrote one with
// NO STAMP, and loadStoreDb refused it on sight. Rendering always and writing
// only when a carrier was asked for costs the render and nothing else.
const esc = (s) => {
    let o = "";
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      o += ch === "\\" ? "\\\\" : ch === '"' ? '\\"' : c === 10 ? "\\n" : c === 13 ? "\\r" : c === 9 ? "\\t" : ch;
    }
    return o;
};
const src = (v) => Array.isArray(v)
    ? (v.length === 0 ? "PHI()" : "S(" + v.map(src).join(",") + ")")
    : typeof v === "number" ? "N(" + v + ")" : 'A("' + esc(v) + '")';
// AND IT IS CHUNKED NINE WIDE, BECAUSE CANON READS IT THAT WAY. Measured
// 2026-09-20: 48 canon DEFs compose an UNGUARDED theta:flatten with an
// ast:fetch of a state: cell -- rules:model, solve:rules, ui:otpops,
// rmap:readrows, main:declared_names and forty-three more -- so each of them
// flattens exactly one level and a carrier chunked any other way is a
// different value. The nine came from S9 being a nine-parameter JavaScript
// function; it has been load-bearing canon ever since, undeclared. So this
// does not restate it: read:chunk9 IS canon's chunker, 43 ms for all 22
// cells, and the width lives where the readers live.
//
// reflect:surface was the exception that proved it. It flattened
// unconditionally too, and canon's own flat design state made four
// reflections raise `selector 2 on atom: DomainHasDescription` while the
// oracle's chunked one passed; it now unfolds with rmap:unfold4 and both
// shapes answer 781/400/781/781. The other forty-seven are recorded, not
// fixed: they are a canon change with a suite behind it, not a compiler one.
const body = state.map((c) => 'DEF("' + esc(String(c[0])) + '", ' + src(Ev("read:chunk9", c[1])) + ")").join(",\n");
const carrier = "(\n" + body + "\n)\n";
const carrierBytes = Buffer.from(carrier, "utf8");
if (outDir) {
  const tmp = join(outDir, "design-state.build");
  writeFileSync(tmp, carrier);
  renameSync(tmp, join(outDir, "design-state"));
  console.log("carrier: " + carrier.length + " bytes at " + join(outDir, "design-state"));

  // ---- AND THE RELATIONAL MAP, WHICH IS THE SAME COMPILATION ----------------
  // tools/compile-rmap.js (161 lines, deleted) wrote these; they are canon's
  // own answers cached, one DEF per rmap artifact, and canon reads each through
  // a COND that derives only when the cell is absent. Without them the map is
  // rederived at every boot -- `canon's DDL is a database SQLite will accept`
  // went from passing to a 12.5 s timeout against a 5 s cap the moment the
  // carriers were deleted, and slowness is a defect, not a budget.
  //
  // Each artifact is INSTALLED as it is computed, so the next one reads it
  // instead of rederiving it; that is the whole reason the set is cheap in one
  // pass and ruinous in thirty-three. Flat, not chunked: the COND hands the
  // stored cell back AS the value of rmap:X, so it must be the shape
  // rmap:X:derive returns.
  const ARTIFACTS = ("assim cands7 cexp childrenN colnames colpaths colpathsP coltabs ctab cts djrows "
    + "evident fkrows g2 gmi narows ncp3 ncprows ncrows nirows nmrows nreadings nrrows ntabs ntnames "
    + "nurows pidchains pidfacts pkrows s1p tablects tables ucrows2 uniqs").split(" ");
  const t3 = Date.now();
  const defs = [];
  const skipped = [];
  for (const a of ARTIFACTS) {
    let v;
    try { v = Ev("rmap:" + a, CELLS); } catch (e) { skipped.push(a + " (" + e.message.slice(0, 60) + ")"); continue; }
    CELLS.unshift(["CELL", "stored:rmap:" + a, v]);
    defs.push('DEF("stored:rmap:' + a + '", ' + src(v) + ")");
  }
  // THE STAMP IS WHAT LETS build.js REFUSE IT. The carrier is derived FROM the
  // design state, so a design state regenerated since leaves it describing
  // tables that no longer exist; build.js hashes design-state and declines a
  // `compiled` that names another.
  const stamp = createHash("sha256").update(carrierBytes).digest("hex").slice(0, 16);
  const compiled = '(\n"AREST_COMPILED_FROM=' + stamp + '",\n\n' + defs.join(",\n") + "\n)\n";
  const ctmp = join(outDir, "compiled.build");
  writeFileSync(ctmp, compiled);
  renameSync(ctmp, join(outDir, "compiled"));
  console.log("relational map: " + defs.length + " of " + ARTIFACTS.length + " artifacts, "
    + compiled.length + " bytes, stamped " + stamp + " (" + (Date.now() - t3) + " ms)"
    + (skipped.length ? "\n  DERIVED AT BOOT INSTEAD: " + skipped.join("; ") : ""));
}

// THE SCHEMA IS ASKED FOR ONLY WHEN IT IS WANTED. rmap:ddl is 23 s on the
// metamodel against the reader's 1.6, so a check that only needs the carrier
// does not pay for a schema nobody reads.
const out = process.env.AREST_DB;
const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
// ONE EVALUATION OF rmap:ddl, NOT TWO. compile:schema executes the DDL and
// ANSWERS it, so making the schema and reporting its size are the same call;
// asking rmap:ddl here as well cost 6.1 s of the metamodel's 68 (2026-09-21).
// The build goes BESIDE the store -- compile-store.js's one-sentence invariant
// (#108) -- and is renamed in only once the rows are there, so a run that dies
// half way leaves the previous store untouched. What is NOT rebuilt yet is the
// migration gate (migrate:, 25 canon DEFs); until it is, this REPLACES rather
// than migrates, so rows written at runtime do not survive a recompile.
const build = out ? out + ".build" : "";
let ddl = "", tDdl = 0;
if (out) {
  try { rmSync(build); } catch {}
  const t2 = Date.now();
  ddl = String(Ev("compile:schema", [build, CELLS]));
  tDdl = Date.now() - t2;
} else if (!outDir) {
  const t2 = Date.now();
  ddl = flat(Ev("rmap:ddl", CELLS));
  tDdl = Date.now() - t2;
}
if (!out && !outDir) {
  process.stdout.write(ddl);
} else if (out) {
  const db = new Database(build, { create: true });
  // AND IT CARRIES THE COMPOSITION IT IS A PROJECTION OF. build.js stamps a
  // module with sha256 of canon and the carriers -- IDENTITY, which is
  // deliberately not the host source, because a comment in host.js does not move
  // a population -- and loadStoreDb refuses a database stamped with anything
  // else. compile.js wrote no stamp, so every store it has written has been
  // refused on sight and the six app stores have been unreadable since. The same
  // three buffers in the same order give the same sixteen hex digits.
  // THE SAME THREE BUFFERS IN THE SAME ORDER build.js hashes, and the third is
  // the carrier's BYTES rather than a path, so a store is stamped whether or not
  // a carrier was written beside it.
  const identity = createHash("sha256");
  identity.update(readFileSync(join(import.meta.dir, "..", "..", "arest")));
  identity.update(readFileSync(join(import.meta.dir, "..", "..", "engine", "shared", "scenarios.canon")));
  identity.update(carrierBytes);
  db.exec('create table if not exists "_composition" (hash text)');
  db.query('insert into "_composition" (hash) values (?)').run(identity.digest("hex").slice(0, 16));
  const n = db.query("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;
  // AND THE ROWS ARE CANON'S TOO. rmap:proj_rows answers a table's rows -- the
  // key, then one value per column in the order rmap:colnames gives them -- so
  // this binds and executes and decides nothing. # is canon's absent value and
  // becomes SQL NULL; everything else goes in as text, because a column's type
  // is the schema's business and sqlite's affinity applies it.
  const t3 = Date.now();
  let inserted = 0, refused = 0;
  const first = [];
  for (const [table] of Ev("rmap:coltabs", CELLS)) {
    const name = String(table);
    // THE NAMES COME FROM THE SAME PLACE THE VALUES DO. rmap:coltabs answers a
    // table's columns in a DIFFERENT ORDER than rmap:ctab, which is what
    // rmap:proj_row fills; zipping one against the other put every value in the
    // wrong column and sqlite accepted all of it.
    const cn = Ev("rmap:proj_colnames", [name, CELLS]).map(String);
    const sql = 'insert into "' + name + '" ("' + cn.join('","') + '") values ('
      + cn.map(() => "?").join(",") + ")";
    const ins = db.prepare(sql);
    for (const row of Ev("rmap:proj_rows", [name, CELLS])) {
      const vals = cn.map((_, i) => { const v = row[i]; return v === "#" || v === undefined ? null : flat(v); });
      try { ins.run(...vals); inserted++; }
      catch (e) { refused++; if (first.length < 3) first.push(name + ": " + e.message.slice(0, 90)); }
    }
  }
  const tRows = Date.now() - t3;
  db.close(true);
  renameSync(build, out);
  console.log("store: " + n + " tables, " + inserted + " rows at " + out
    + (refused ? ", " + refused + " REFUSED BY SQLITE" : "") + " (" + tRows + " ms)");
  for (const f of first) console.log("  " + f);
}
console.log("compiled " + sentences + " sentences from " + files + " files: "
  + state.length + " cells, " + ddl.length + " bytes of DDL"
  + " (read " + tRead + " ms, state " + tState + " ms, ddl " + tDdl + " ms)");
