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
// a name between double quotes doubles the double quotes it carries -- a column
// named from prose on support carried one and the carry's prepare failed after
// the whole build was written (2026-09-21)
const qi = (n) => '"' + String(n).replace(/"/g, '""') + '"';

// WHERE THE MEMORY WENT (2026-09-23): five resident servers and one check took the
// machine to its floor, so a compile can be asked to stamp each line it prints.
if (process.env.AREST_COMPILE_MEMORY) {
  for (const k of ["log", "error"]) {
    const f = console[k].bind(console);
    console[k] = (...a) => { const m = process.memoryUsage();
      f(...a, "[rss " + (m.rss >> 20) + " MB, heap " + (m.heapUsed >> 20) + "/" + (m.heapTotal >> 20) + " MB]"); };
  }
}

// EACH PHASE'S GARBAGE IS COLLECTED BEFORE THE NEXT ONE ALLOCATES (2026-09-23).
// A compile is five phases in one process -- read, relational map, rows, carry,
// closure -- and what each builds is dead the moment the next begins. The
// collector cannot know that: it sizes the heap by what it last saw live, so
// one phase's garbage raises the ceiling the next grows under. Measured on
// arest-dev the committed heap only ever grew across the phases, 194 -> 525 ->
// 610 -> 674 MB, with 71 MB of it live when the closure began. A full collection
// at each boundary costs a fraction of a second and starts the next phase from
// what is actually live: with host.js's memo rules in place, arest-dev's compile
// peaked at 926 and 971 MB private without these five and at 690 and 697 with
// them, in the same 81-89 s.
const collect = () => Bun.gc(true);

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
  // AND IT IS BUILT WITH THIS FILE'S ENVIRONMENT, NOT THE CHECK'S. build.js
  // reads AREST_OUT_DIR to decide where a module lands (build.js ~205) and
  // AREST_CARRIERS to decide which carriers compose into it (~29), and every
  // shipped `bun run check` sets AREST_OUT_DIR=$PWD/.check. Inheriting it sent
  // reader.g.js into the app's .check directory and the import one line below
  // then threw `Cannot find module` -- which is every app's FIRST check after a
  // fresh clone, the one moment reader.g.js is absent, and invisible in any tree
  // where it is already on disk. Reproduced 2026-09-22 by moving it aside.
  //
  // AREST_CARRIERS goes too, and for a reason of meaning rather than a measured
  // failure: `reader` is build.js's slim mode and slim is CANON ALONE, which is
  // what lets a compiler exist before any store does. The design-state and
  // compiled carriers are already withheld from it, but the `outcome` and
  // `expected` carriers are pushed without asking whether the build is slim
  // (build.js ~101), so a carriers directory holding either would compose into
  // the reader. No shipped check sets AREST_CARRIERS, so nothing has hit it.
  const env = { ...process.env };
  delete env.AREST_OUT_DIR;
  delete env.AREST_CARRIERS;
  const r = spawnSync("bun", ["build.js", "reader"], { cwd: import.meta.dir, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status || 1);
}
await import(pathToFileURL(host).href);
const { Ev, CELLS, DEFS, loadStoreDb, popSnapshot, closeStore, emitToDb, storeDb, writeMetaschema } = globalThis.AREST;

// ---- THE MODE IS A CELL, AND THE ENVIRONMENT INSTALLS IT ------------------
// canon's read:strict answers F: the AREST default is not strict (Sam,
// 2026-09-22). A person who wants strictness sets AREST_STRICT=1 where their
// checks are spawned -- mcp-router's apps_check runs `bun run check` with
// process.env, so the env of the router's own entry in ~/.claude.json is one
// person's default and nobody else's. The strict cell is installed the way
// DEF installs one -- in DEFS, which every application of the name reads, and
// in CELLS, which ast:fetch reads -- before the first evaluation, so nothing
// was compiled against the default first. This file decides nothing: what
// strictness refuses is written in canon beside the arm that refuses it.
const strict = process.env.AREST_STRICT === "1";
if (strict) {
  DEFS.set("read:strict", ["CONST", "T"]);
  CELLS.unshift(["CELL", "read:strict", ["CONST", "T"]]);
}

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
// compile:check is DEF(compile) beside its findings, from the one parse: the
// cells are its first element, the findings -- readings over an undeclared
// object type, files under no single domain -- its second (reported below).
const checked = Ev("compile:check", dirs);
const state = checked[0];
const findings = checked[1];
// ONE CELL, ONE SHAPE (2026-09-21). A module holds a design-state cell as the
// carrier rendered it -- read:chunk9's nine-wide chunks (the note below) --
// and until now this file held the same cell FLAT, as DEF(compile) answers
// it, so a reader that flattens exactly once answered the module and threw
// in the compiler: solve:declared under rmap:proj_rows the first time a store
// was written through the projection (64732aa4), then main:cf_entry under
// store:src_all the first time the closure ran here. The forty-seven
// single-flatten readers are canon's convention, not a defect each; the
// compiler now holds what the module holds and every reader answers both.
// The relational map's artifacts are computed over the chunked cells too,
// which is how a module without a compiled carrier computes them, and they
// come out byte-identical (gated).
const chunked = state.map((c) => Ev("read:chunk9", c[1]));
for (let i = state.length - 1; i >= 0; i--) CELLS.unshift(["CELL", String(state[i][0]), chunked[i]]);
const tState = Date.now() - t1;

// ---- WHAT THE READER REPORTED, AND WHAT IT REFUSED -----------------------
// compile:check's second answer, one row per finding: <undeclared, fact type
// name, status, object types, reading text> for a reading that names an
// object type no declaration opens, and <domain, path, status, domains,
// fault> for a file that declares elements and no Domain (a file's domain
// is the first Domain sentence it writes; later ones are catalog entries).
// Under the default every row is `reported`, one summary line per kind goes
// to stderr and the check goes on -- nothing is silent. Under AREST_STRICT=1
// the reader refused the reading and the rule refused the file, the row says
// `refused`, and a check that refuses is a failed check: it says so, writes
// nothing, and exits 1. The line names the count and each subject once: an
// object type with the first reading that names it, a file by its path.
const undeclared = findings.filter((r) => String(r[0]) === "undeclared");
const domainless = findings.filter((r) => String(r[0]) === "domain");
const refused = findings.some((r) => String(r[2]) === "refused");
const verdict = refused ? " -- REFUSED (AREST_STRICT=1)" : "";
if (undeclared.length) {
  const first = new Map();
  for (const r of undeclared) for (const t of r[3]) if (!first.has(String(t))) first.set(String(t), String(r[4]));
  console.error("UNDECLARED: " + undeclared.length + " reading(s) name " + first.size
    + " object type(s) no declaration opens" + verdict + ": "
    + [...first].map(([t, text]) => t + " (" + text + ")").join("; "));
}
if (domainless.length) {
  console.error("FILE DOMAINS: " + domainless.length + " file(s) declare elements and no Domain" + verdict + ": "
    + domainless.map((r) => String(r[1])).join(", "));
}
if (refused) process.exit(1);

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
// WHY IT STILL EXISTS, since #109 is about removing exactly this kind of
// intermediate: build.js composes the design state INTO the module, and the
// alternative -- the module reading its design state out of the store -- is
// the half of the flip canon cannot yet answer. WHAT STOOD HERE NAMED THE
// WRONG OBSTACLE and is corrected rather than deleted. It said four populated
// fact types were named by no path and that canon emits the schema and has no
// projection into it and no inverse. Measured at b72a7b35 on the base
// metamodel: rmap:unkeyed is 0, the 289 fact types give 65 tables and 427
// column paths, 69 fact types are populated, and POPULATED-BUT-HOMELESS is 0.
// The inverse is here and it is EXACT: loadStoreDb hands every table's rows to
// rmap:unproj -- operand <table, rows, store>, three components, which is
// declared nowhere although rmap:unproj is on law:entry_hosts -- and
// re-projecting what it answers gives the tables back row for row: 65 tables,
// 15,452 rows, 0 differing.
//
// THE OBSTACLE IS THAT THE SCHEMA IS ONLY PART OF ITS OWN POPULATION. The
// schema is a population of the metamodel -- Fact Type, Role, Reading,
// Constraint and Object Type are entity types the metamodel declares -- and
// the store holds that population wherever something writes it: read:reflect
// writes ten fact types at read time, reflect:cells sixteen at boot, 17,477
// rows on the base. WHAT NOTHING WRITES, measured on the store this file
// makes: ReadingHasText 0 rows of 541 readings, which is state:readings;
// Derivation Rule and the six fact types that carry a rule -- text, produces,
// antecedent, join path, role sequence, role projection -- 0 rows, which is
// state:rules and state:undelivered after it; ObjectTypeIsIndependent 0 of the
// 22 the cell holds, which is state:otmeta; EntityTypeHasReferenceMode 2 of
// 112, which is state:refmodes and state:schemereadings after it;
// FactTypeHasDerivationMode 31 of 37, which is state:derived;
// FactTypeHasDeclarationOrder 262 of 541 and under another numbering, which is
// state:factorder; no Constraint of Constraint Type XC or XO, which is
// state:exclusions; and 10 of the 13 deontic Constraints, the three DEO:p
// being outside reflect:con_all, which is state:deontics. TWO CELLS HAVE NO
// FACT TYPE IN THE METAMODEL AT ALL, so the metamodel is short by two:
// state:autoid and state:qualifiers.
//
// THE READING TEXT IS THE SHARPEST OF THEM and stands for the rest. A fact
// type's name is minted from its reading, so re-imploding the reading from the
// name and the players looks like an inverse; measured on the base it recovers
// 280 of 289 and loses exactly the nine whose design carries a separate name
// or a qualified word -- ConstraintSpan, RoleInstance, API,
// EventCausedTransition, and the four readings state:qualifiers records. A
// name is a lossy encoding of the reading it came from, so the text is not
// derivable and has to be stored.
//
// AND THE SCHEMA IS WHAT READS THE TABLES, so none of this is recoverable by
// reading harder. Measured on a module composed with an empty carrier over the
// same store: ast:fetch of state:fts answers #, and store:fts, rmap:coltabs,
// rmap:colpaths, rmap:ddl and loadStoreDb every one throw selector 1 on atom:
// #. Until those populations are written the store cannot carry the design
// state and the carrier does.
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
// Since 2026-09-21 the cells this file holds in CELLS are the same chunked
// values (ONE CELL, ONE SHAPE above), so the forty-seven answer here as they
// answer in a module; rmap:unfold4 remains right for a reader that must
// answer either shape.
//
// reflect:surface was the exception that proved it. It flattened
// unconditionally too, and canon's own flat design state made four
// reflections raise `selector 2 on atom: DomainHasDescription` while the
// oracle's chunked one passed; it now unfolds with rmap:unfold4 and both
// shapes answer 781/400/781/781. The other forty-seven are recorded, not
// fixed: they are a canon change with a suite behind it, not a compiler one.
const body = state.map((c, i) => 'DEF("' + esc(String(c[0])) + '", ' + src(chunked[i]) + ")").join(",\n");
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

collect();
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
  // AND norma-answer WHEN THE APP HAS ONE, because build.js splices it and hashes
  // it (build.js:54,64) even while its own note says the witness's answer is not
  // a build input. support.auto.dev keeps one from the oracle era, the metamodel
  // has none, and that is exactly the difference between a store the module
  // accepted (metamodel) and one it refused on the stamp (support, 2026-09-21:
  // store 972fca99d81b9a6a, module 3ffe2da55596553e). The same bytes in the
  // same order, or the stamp is two identities. Retiring the file from the
  // identity is build.js's change to make, and the stores would restamp with it.
  const witness = outDir ? join(outDir, "norma-answer") : "";
  if (witness && existsSync(witness)) identity.update(readFileSync(witness));
  // AND THE SCHEMA IT IS, BESIDE THE COMPOSITION IT CAME FROM. loadStoreDb no
  // longer reads the stamp to decide -- it compares the tables and columns it is
  // about to select against the ones that are here -- so both of these are the
  // RECORD: which build wrote the store, and what shape it wrote, readable with
  // sqlite alone and needing no module. The schema hash is taken from THE
  // DATABASE ITSELF, the tables compile:schema just executed, and not from
  // rmap:coltabs, so that the host computing the same digits from rmap:coltabs
  // is a measurement rather than a tautology: a3290a48c72db8c7 both ways on the
  // base, 49 tables and 382 columns (2026-09-21). Underscore tables are left out
  // because _composition is written one line below and is not part of the shape.
  const schema = createHash("sha256");
  {
    const cols = new Map();
    for (const r of db.query("select m.name t, c.name c from sqlite_master m join pragma_table_info(m.name) c where m.type = 'table'").values()) {
      const t = String(r[0]);
      if (t.startsWith("_") || t.startsWith("sqlite_")) continue;
      let cs = cols.get(t);
      if (!cs) cols.set(t, (cs = []));
      cs.push(String(r[1]));
    }
    for (const t of [...cols.keys()].sort()) schema.update(t + "\u0000" + cols.get(t).sort().join("\u0000") + "\n");
  }
  const schemaHash = schema.digest("hex").slice(0, 16);
  db.exec('create table if not exists "_composition" (hash text, schema text)');
  db.query('insert into "_composition" (hash, schema) values (?, ?)').run(identity.digest("hex").slice(0, 16), schemaHash);
  // ---- AND THE MAP IT WAS WRITTEN THROUGH, SO IT CAN BE READ BACK ---------
  // Sam, 2026-09-22: "The metaschema should be prebuilt by us into a table.
  // That's how the bootstrap works." The two lines above record WHICH build
  // wrote this store and WHAT SHAPE it wrote; this records the shape itself --
  // table, column order and the fact type each column carries -- so that a
  // module which has not been handed the schema can still open it. Everything
  // it needs has been evaluated already: rmap:coltabs and rmap:proj_colnames are
  // the insert loop's own two calls twenty lines down, and rmap:ctab is an input
  // to rmap:coltabs and comes back from the memo. The layout and the writer are
  // declared in host.js beside loadStoreDb, which is the reader of them.
  const tMeta = Date.now();
  const metarows = writeMetaschema(db);
  const tMetaMs = Date.now() - tMeta;
  const n = db.query("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;
  // AND THE ROWS ARE CANON'S TOO. rmap:proj_rows answers a table's rows -- the
  // key, then one value per column in the order rmap:colnames gives them -- so
  // this binds and executes and decides nothing. # is canon's absent value and
  // becomes SQL NULL; everything else goes in as text, because a column's type
  // is the schema's business and sqlite's affinity applies it.
  const t3 = Date.now();
  let inserted = 0, refused = 0;
  const first = [];
  // ONE TRANSACTION FOR THE ROWS. Each insert was its own autocommit
  // transaction with its own disk sync: 6.5 ms a row on Windows, 83 s for
  // support's 12,742 rows (2026-09-21). The build is a fresh file nobody
  // reads until it is renamed in; a refused row is a statement-level error
  // inside the transaction and is caught as before.
  db.exec("begin");
  for (const [table] of Ev("rmap:coltabs", CELLS)) {
    const name = String(table);
    // THE NAMES COME FROM THE SAME PLACE THE VALUES DO. rmap:coltabs answers a
    // table's columns in a DIFFERENT ORDER than rmap:ctab, which is what
    // rmap:proj_row fills; zipping one against the other put every value in the
    // wrong column and sqlite accepted all of it.
    const cn = Ev("rmap:proj_colnames", [name, CELLS]).map(String);
    // AND THEY ARE SPELLED FOR SQL ALREADY: rmap:proj_colnames answers the
    // DDL's own spelling of a name, a quote inside it doubled (rmap:ddl_q), so
    // this splices them between quotes and escapes nothing -- qi here doubled
    // the doubling and MonoView's prose-named column was not found (2026-09-21).
    // The carry below reads names from pragma table_info, which answers them
    // raw, and those go through qi.
    const sql = 'insert into "' + name + '" ("' + cn.join('","') + '") values ('
      + cn.map(() => "?").join(",") + ")";
    const ins = db.prepare(sql);
    for (const row of Ev("rmap:proj_rows", [name, CELLS])) {
      const vals = cn.map((_, i) => { const v = row[i]; return v === "#" || v === undefined ? null : flat(v); });
      try { ins.run(...vals); inserted++; }
      catch (e) { refused++; if (first.length < 3) first.push(name + ": " + e.message.slice(0, 90)); }
    }
  }
  db.exec("commit");
  const tRows = Date.now() - t3;
  collect();
  // ---- AND THE PRIOR STORE IS NOT THROWN AWAY ------------------------------
  // #108 asked that a readings change MIGRATE rather than replace, and since
  // compile-store.js was deleted this file has replaced: every row written at
  // runtime -- a Support Request someone created, a status a transition moved --
  // was lost on the next compile without a word. The ledger that told an asserted
  // row from a runtime one is gone too, and it is not needed: THE BUILD BESIDE US
  // IS EXACTLY WHAT THE READINGS ASSERT, so anything the prior store holds that
  // the build does not is, by construction, what the runtime wrote.
  //
  // A TABLE THE BUILD STILL HAS carries those rows forward -- a key it lacks is
  // inserted, a column it left NULL where the prior store has a value is filled.
  // Filling rather than replacing is the point: the build's own value is what the
  // readings say now and wins, and the runtime's value survives only where the
  // readings say nothing.
  //
  // A TABLE THE BUILD NO LONGER HAS is the other half, and it needs the PRIOR
  // schema to say which fact type those rows were -- which is exactly what a
  // store cannot yet tell us, because its schema is spliced into the module
  // rather than carried in the database. So this counts and names those tables
  // and REFUSES; it does not guess. AREST_MIGRATE=allow-loss says drop them.
  let carried = 0, filled = 0, reflectedSkipped = 0, moved = 0, tCarry = 0, tCarryReflect = 0, tCarryRows = 0;
  const movedFts = new Map();
  const orphaned = [];
  const rekeyed = [];
  if (existsSync(out)) {
    const tCarryStart = Date.now();
    const prior = new Database(out, { readonly: true });
    const shapeOf = (d) => {
      const m = new Map();
      for (const t of d.prepare("select name from sqlite_master where type='table'").all()) {
        if (String(t.name).startsWith("_")) continue;
        m.set(t.name, d.prepare('pragma table_info(' + qi(t.name) + ')').all());
      }
      return m;
    };
    const was = shapeOf(prior), now = shapeOf(db);
    db.exec("begin");   // and one for the carry: claude's check spent 9 s on Function and 17 s on the instance table, a sync per carried row
    // A REFLECTED NAME NEVER CARRIES (b6e16927, #122 item 1 continued). A boot
    // writes the REFLECTED populations back into these same tables too --
    // host.js's loadReflected installs canon's own reflect:cells answer as the
    // cell of a reflected fact type's name, and emitToDb (~349) projects that
    // cell the same way any other one is projected. So a row the prior store
    // holds for a reflected name is the CLOSURE's computation over whatever
    // design state that boot had, not a runtime fact, and carrying it forward
    // is carrying a STALE closure answer into a build the closure has not run
    // over yet -- a constraint the readings no longer declare surviving
    // because the carry could not tell a reflected row from a written one.
    // Skipped here, nothing is lost: the next boot's loadReflected + emitToDb
    // recomputes it fresh and writes it back.
    //
    // WHICH NAMES ARE REFLECTED IS CANON'S ANSWER, the same one loadReflected
    // itself reads -- reflect:cells' <name, population> pairs -- but READING
    // IT COSTS THE POPULATIONS, and MEASURED on the metamodel (with and
    // without readings/templates beside it) Ev("reflect:cells", CELLS) does
    // not just cost, it THROWS: `selector 1 on atom: Abstract SQL Type`.
    // reflect:cells' sub-computations read cells a live boot's derivation
    // closure installs (loadDerived, alternated with loadReflected itself,
    // host.js ~3687); compile.js runs no closure at all -- it is the read
    // phase, on purpose (this file's own header) -- so the union it would
    // need is never there to read. There is no names-only DEF either
    // (grepped reflect:*, 2026-09-21: reflect:computed pairs a name with the
    // DEF that computes it and nothing answers the names alone). So this
    // copies reflect:computed's OWN pairs (arest:14286-14287) as data, the
    // way this file's ARTIFACTS list two hundred lines up (~176) copies
    // rmap's -- both go stale on the same canon edit and neither one
    // evaluates a population to get the names.
    const REFLECTED_NAMES = new Set(("FactTypeHasRole FactTypeHasReading ObjectTypePlaysRole "
      + "RoleIsUsedInReading StateMachineIsForObjectTypeInstance StateMachineIsInstanceOfStateMachineDefinition "
      + "StateMachineIsCurrentlyInStatus ObjectTypeInstanceIsCurrentlyInStatus ConstraintIsOfConstraintType "
      + "ConstraintHasModalityOfModalityType ConstraintSpan ConstraintSpanHasSequenceNumber "
      + "ConstraintSpanHasPosition FunctionBelongsToDomain").split(" "));
    // WHICH TABLES AND COLUMNS A NAME CARRIES IS rmap:ctab's TO ANSWER, NOT
    // HARDCODED -- <fact type, table, columns> rows, a column's path
    // resolved to the ONE fact type it carries by rmap:proj_carried, the
    // same pair emitToDb walks (~365) to decide which tables a write
    // touched. Measured OK on the metamodel alone and with templates (49 and
    // 71 tables); still guarded, the way a RMAP ARTIFACT compile.js cannot
    // compute is skipped rather than refused (~182), so a build that used to
    // succeed keeps succeeding even where this cannot be read.
    let ctabByTable = new Map();
    try { ctabByTable = new Map(Ev("rmap:ctab", CELLS).map((ct) => [String(ct[1]), ct])); }
    catch (e) { console.error("  (rmap:ctab could not be read -- " + e.message + " -- carrying every table as before)"); }
    for (const [table, oldCols] of was) {
      const newCols = now.get(table);
      if (!newCols) {
        const n = prior.prepare('select count(*) c from ' + qi(table)).get().c;
        if (n) orphaned.push({ table, rows: n, why: 'the build declares no such table' });
        continue;
      }
      // A RELATION TABLE NAMED FOR A REFLECTED FACT TYPE IS NOT CARRIED AT
      // ALL -- ConstraintSpan is the case (reflect:computed pairs it with
      // reflect:spans): every row in it is the reflection's own row, so a row
      // the prior store has and this build does not is an older design
      // state's answer and not this table's to keep.
      const tTable = Date.now();
      if (process.env.AREST_CARRY_TRACE) console.error("  carry " + table + ": " + oldCols.length + " prior column(s), " + prior.prepare('select count(*) c from ' + qi(table)).get().c + " prior row(s) ...");
      const ctabEntry = ctabByTable.get(table);
      if (ctabEntry && REFLECTED_NAMES.has(String(ctabEntry[0]))) {
        reflectedSkipped += prior.prepare('select count(*) c from ' + qi(table)).get().c;
        continue;
      }
      // AND A COLUMN CARRYING A REFLECTED FACT TYPE IS NOT CARRIED AND NOT
      // FILLED, on a table that is not itself reflected whole -- Function
      // holds its own written attributes beside reflected columns like
      // constraintModalityType, and only the second kind is the closure's to
      // answer. rmap:proj_colnames names a table's columns in the order
      // rmap:ctab fills them (its own comment, ~17084), which is what lets
      // this zip ctabEntry's column paths against them by position, exactly
      // as the durability suite's own `carriers()` helper does.
      const reflectedCols = new Set();
      // AND WHICH ROLES THE COLUMN'S TWO ENDS PLAY, from the same path, in the
      // same walk -- the placement test below needs it and it costs nothing
      // extra. A column path is <table, flag, steps> and exactly one step is
      // the `rel`: ["rel", from-player, to-player, ..., [fact type], dir]. So
      // the path SAYS which role the row plays and which the value plays:
      //   stateMachineDefinitionStatusId
      //     rel State Machine Definition -> Status
      //     (StatusIsInitialInStateMachineDefinition)
      // A path with no rel step is an identifier or an assimilation and binds
      // no second player; a path with more than one is a join through two fact
      // types and its two ends are not one fact's two roles. Neither is a
      // placement this test can read, so neither is recorded.
      const colFact = new Map();
      if (ctabEntry) {
        try {
          const cn = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
          ctabEntry[2].forEach((col, i) => {
            const carriedFt = String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : []));
            if (cn[i] && REFLECTED_NAMES.has(carriedFt)) reflectedCols.add(cn[i]);
            if (!cn[i]) return;
            const steps = Array.isArray(col[2]) ? col[2] : [];
            const rels = steps.filter((st) => Array.isArray(st) && String(st[0]) === "rel");
            if (rels.length !== 1) return;
            const a = String(rels[0][1]), b = String(rels[0][2]);
            colFact.set(cn[i], { ft: carriedFt, a, b, rev: null });
          });
        } catch (e) { /* this table's carried columns could not be determined -- carry it as before */ }
      }
      if (reflectedCols.size) {
        const cond = [...reflectedCols].map((c2) => qi(c2) + " is not null").join(" or ");
        reflectedSkipped += prior.prepare('select count(*) c from ' + qi(table) + ' where ' + cond).get().c;
      }
      const tReflect = Date.now() - tTable;
      tCarryReflect += tReflect;
      if (process.env.AREST_CARRY_TRACE) console.error("  carry " + table + ": reflected columns " + tReflect + " ms, now its rows ...");
      const oldColsK = oldCols.filter((o) => !reflectedCols.has(o.name));
      const newColsK = newCols.filter((c2) => !reflectedCols.has(c2.name));
      const keep = newColsK.map((c2) => c2.name).filter((n2) => oldColsK.some((o) => o.name === n2));
      // NO SHARED COLUMN, NOTHING TO MATCH ON: the prior table is a different
      // layout of the same name (compile-store.js's k + fact-type-name columns
      // against canon's role-named ones), and its rows are orphaned whole.
      if (!keep.length) {
        const n = prior.prepare('select count(*) c from ' + qi(table)).get().c;
        if (n) orphaned.push({ table, rows: n, why: 'no column of the prior table survives in the build' });
        continue;
      }
      const dropped = oldColsK.map((o) => o.name).filter((n2) => !keep.includes(n2));
      // A RETIRED SURROGATE IS NOT A LOST FACT (2026-09-23). A column the build
      // no longer declares was, until now, always a dropped fact. It is not when
      // every value it holds is RECOMPUTABLE from the row the build keeps: taking
      // the objectification off a fact type (Halpin 2008 10.3 step 1 keys it on
      // its spanning uniqueness) retires the Function surrogate the one-table
      // wave gave it (566a1043), and in that form an objectification's id is its
      // pair joined on a dot (arest: `the id is <constraint>.<role>, derivable
      // from the pair the way APIIsASubtypeOfFunction is derivable from <API,
      // Function>`) -- measured on the base store, '$.Pluralization Pattern',
      // 'API.Function', 'valid-domain-change.DomainChangeIsValid'.
      //
      // So the carry does not assume a sole key is a surrogate; it would then
      // retire a real natural key, an Email, the day a reference scheme moved to
      // a name pair. The column is retired only when it was the prior table's
      // sole key, every column of the build's key is a prior column, no other
      // prior table names it, and some order of the build's key columns, joined
      // on a dot, gives back EVERY value it holds from a row whose key columns are
      // all present. A value that is not recomputable is a fact, and refuses.
      const priorPk = oldColsK.filter((o) => o.pk).map((o) => o.name);
      const buildPk = newColsK.filter((c2) => c2.pk).map((c2) => c2.name);
      const orders = (cs) => cs.length <= 1 ? [cs]
        : cs.flatMap((c2, i) => orders(cs.filter((_, j) => j !== i)).map((rest) => [c2, ...rest]));
      for (const d2 of dropped) {
        const n = prior.prepare('select count(*) c from ' + qi(table) + ' where ' + qi(d2) + ' is not null').get().c;
        if (!n) continue;
        const candidate = priorPk.length === 1 && priorPk[0] === d2
          && buildPk.length > 0 && buildPk.length <= 4 && buildPk.every((c2) => keep.includes(c2))
          && ![...was].some(([t2, cs]) => t2 !== table && cs.some((c3) => c3.name === d2));
        if (candidate) {
          const vals = prior.prepare('select ' + [d2, ...buildPk].map(qi).join(', ') + ' from ' + qi(table)
            + ' where ' + qi(d2) + ' is not null').all();
          const whole = vals.every((r) => buildPk.every((c2) => r[c2] !== null && r[c2] !== undefined));
          const order = whole && orders(buildPk).find((ord) =>
            vals.every((r) => String(r[d2]) === ord.map((c2) => String(r[c2])).join('.')));
          if (order) { rekeyed.push({ table, column: d2, rows: n, key: buildPk, order }); continue; }
          orphaned.push({ table, column: d2, rows: n, why: 'the build declares no such column, and its values are not '
            + 'the build key joined on a dot, so they are facts, not a surrogate' });
          continue;
        }
        orphaned.push({ table, column: d2, rows: n, why: 'the build declares no such column' });
      }
      // THE DECLARED KEY, WHEN THE ROW ACTUALLY HAS ONE. An objectified
      // association's identifier column is its primary key and is NULL in every
      // row of it, so a row is matched on its key only where that key is present;
      // otherwise the row IS its identity and is matched whole, with IS rather
      // than = so that NULL compares to NULL.
      const pk = newColsK.filter((c2) => c2.pk).map((c2) => c2.name).filter((n2) => keep.includes(n2));
      const cols = keep.map(qi).join(",");
      const add = db.prepare('insert into ' + qi(table) + ' (' + cols + ') values ('
        + keep.map(() => "?").join(",") + ')');
      // THE BUILD'S ROWS, READ ONCE. `select 1 ... where c1 is ? and c2 is ?`
      // per unkeyed prior row was a full scan of the build's table per row --
      // no index serves it -- so a table with n build rows and m prior rows
      // cost n*m visits: claude's check spent 2.4 hours of CPU here on
      // 2026-09-22 and support's carry took 86-94 s. The kept values of the
      // build's rows are read once, when the first unkeyed row asks, into a
      // set keyed by their JSON (null is null, a text '2' is not the number
      // 2, the same distinctions `is` makes), and a carried row joins it.
      let present = null;
      const keyOf = (r) => JSON.stringify(keep.map((n2) => r[n2] === undefined ? null : r[n2]));
      const seen = (r) => {
        if (!present) present = new Set(db.prepare('select ' + cols + ' from ' + qi(table)).all().map(keyOf));
        return present.has(keyOf(r));
      };
      const wherePk = pk.length ? pk.map((k) => qi(k) + ' is ?').join(" and ") : "";
      const vals = keep.filter((n2) => !pk.includes(n2));
      const findPk = pk.length && vals.length
        ? db.prepare('select ' + vals.map(qi).join(",") + ' from ' + qi(table) + ' where ' + wherePk)
        : null;
      // one UPDATE per column, prepared once, not once per filled value
      const fills = new Map();
      const fill = (v) => { let s = fills.get(v); if (!s) { s = db.prepare('update ' + qi(table) + ' set ' + qi(v) + '=? where ' + wherePk); fills.set(v, s); } return s; };
      for (const row of prior.prepare('select ' + cols + ' from ' + qi(table)).all()) {
        const k = pk.map((n2) => row[n2]);
        const keyed = pk.length && k.every((v) => v !== null && v !== undefined);
        if (!keyed) {
          if (seen(row)) continue;   // the build already says it
          try { add.run(...keep.map((n2) => row[n2])); carried++; present.add(keyOf(row)); } catch { /* the build refuses it */ }
          continue;
        }
        const here = findPk ? findPk.get(...k) : null;
        if (!here) { try { add.run(...keep.map((n2) => row[n2])); carried++; } catch { /* the build refuses it */ } continue; }
        for (const v of vals) {
          if (here[v] !== null && here[v] !== undefined) continue;   // the readings say something: they win
          if (row[v] === null || row[v] === undefined) continue;     // the runtime said nothing either
          // AND THE BUILD MAY ALREADY SAY IT, ON ANOTHER ROW. An empty cell is
          // not an absent fact: when a fact type's key role moves from one
          // player to the other, the column keeps its name and its table and
          // only the row changes, so the prior value lands in a cell the build
          // left empty while the build asserts the SAME FACT on the row the
          // other player keys. Filling it asserts the fact twice, columns
          // swapped, and the store then answers both ways round: measured on
          // claude 2026-09-22, StatusIsInitialInStateMachineDefinition eight
          // rows where the readings declare four, and the Harel descent read
          // it as a cycle (b72a7b35).
          //
          // So the fill asks what the unkeyed branch above already asks --
          // does the build already say this? -- of the FACT rather than the
          // row: is the reversed pair in this same column of the build. Only
          // where the two ends play DIFFERENT object types, because a ring
          // fact type's (a,b) and (b,a) are two facts and not one placement:
          // DerivationRuleDependsOnDerivationRule is the case in the
          // metamodel. A ring column carries as before; it is counted, so the
          // exposure is named rather than silent.
          const cf = colFact.get(v);
          if (cf && cf.a !== cf.b && pk.length === 1) {
            if (!cf.rev) {
              cf.rev = new Set(db.prepare('select ' + qi(pk[0]) + ', ' + qi(v) + ' from ' + qi(table)
                + ' where ' + qi(v) + ' is not null').values().map((r) => JSON.stringify([r[0], r[1]])));
            }
            if (cf.rev.has(JSON.stringify([row[v], k[0]]))) {
              moved++;
              movedFts.set(cf.ft, (movedFts.get(cf.ft) || 0) + 1);
              continue;
            }
          }
          try { fill(v).run(row[v], ...k); filled++; }
          catch { /* the build refuses it */ }
        }
      }
      // A TABLE THAT COSTS A SECOND IS NAMED as it finishes, with the split:
      // the detection of its reflected columns (canon, per table and column)
      // against its row loop (sqlite). Slowness is a defect, and a summary
      // that only says "carry N ms" hides which one this is.
      const tTableRows = Date.now() - tTable - tReflect;
      tCarryRows += tTableRows;
      if (tReflect + tTableRows > 1000) console.error("  carry " + table + ": reflected columns " + tReflect + " ms, rows " + tTableRows + " ms");
    }
    db.exec("commit");
    tCarry = Date.now() - tCarryStart;
    prior.close(true);
  }
  db.close(true);
  collect();
  for (const r of rekeyed) {
    console.error('  re-keyed ' + r.table + ' on (' + r.key.join(', ') + '): ' + r.column + ' held only <'
      + r.order.join('>.<') + '> in its ' + r.rows + ' row(s), so it is retired and no fact goes with it');
  }
  // NOTHING WAS DESTROYED, SO NOTHING NEEDS RESTORING. The build is beside the
  // store; discarding it leaves store.db the file it has been all along.
  if (orphaned.length && process.env.AREST_MIGRATE !== "allow-loss") {
    const n = orphaned.reduce((a, o) => a + o.rows, 0);
    console.error("REFUSING: this build would drop " + n + " row(s) the prior store holds,");
    console.error("  and no Migration says how to carry them.");
    for (const o of orphaned.slice(0, 12)) {
      console.error("  " + o.table + (o.column ? "." + o.column : "") + " -- " + o.rows + " row(s): " + o.why);
    }
    if (orphaned.length > 12) console.error("  ... and " + (orphaned.length - 12) + " more");
    console.error("  " + out + " is UNTOUCHED -- the build was never written into it.");
    console.error("  Write the Migration, or rebuild with AREST_MIGRATE=allow-loss.");
    try { rmSync(build); } catch {}
    process.exit(1);
  }
  // THE CLOSURE IS WRITTEN HERE, ONCE (Sam, 2026-09-21: "An app doesn't need
  // to be booted"). The build holds what the readings assert and what the
  // runtime wrote (carried above); the tables the server reads must also hold
  // what the reflection and the rules derive from them, which every start
  // used to recompute and re-project (task #123). So the build is adopted as
  // a start adopts a store, closed under the reflection and the rules, and
  // what that adds is projected into its tables -- the same three lines a
  // write takes: snapshot, evaluate, emit what changed.
  const t4 = Date.now();
  process.env.AREST_STORE_DB = build;
  loadStoreDb(build);
  collect();
  const beforeClosure = popSnapshot(CELLS);
  closeStore();
  collect();
  const closed = emitToDb(beforeClosure, CELLS);
  const sdb = storeDb();
  if (sdb) sdb.close(true);
  console.log("closure: " + closed + " row(s) written into the build (" + (Date.now() - t4) + " ms)");
  renameSync(build, out);
  console.log("store: " + n + " tables, " + inserted + " rows at " + out
    + ", schema " + schemaHash
    + ", metaschema " + metarows + " column(s) (" + tMetaMs + " ms)"
    + (refused ? ", " + refused + " REFUSED BY SQLITE" : "")
    + (carried || filled ? " [" + carried + " runtime row(s) carried, " + filled + " value(s) filled]" : "")
    + (reflectedSkipped ? " [" + reflectedSkipped + " reflected row(s) left to the closure]" : "")
    + (moved ? " [" + moved + " value(s) NOT carried: the build already asserts the same fact with the"
        + " roles the other way -- " + [...movedFts].map((e) => e[0] + " " + e[1]).join(", ") + "]" : "")
    + " (" + tRows + " ms" + (tCarry ? ", " + tCarry + " ms carry: reflected columns " + tCarryReflect + " ms, rows " + tCarryRows + " ms" : "") + ")");
  for (const f of first) console.log("  " + f);
}
// WHAT THE STORE CANNOT HOLD IS SAID, NOT SKIPPED. rmap:unkeyed is every fact
// type the map gives a table with no columns -- an entity-type player with no
// reference scheme canon can map, so nothing that needs its key has a column to
// carry -- and rmap:coltabs leaves them out so the DDL is one sqlite accepts.
// This prints them because a silent omission is the defect state:undelivered
// exists to prevent; the composite key for a compound scheme is what fixes it.
const unkeyed = Ev("rmap:unkeyed", CELLS);
if (unkeyed.length) {
  console.error("UNSTORED: " + unkeyed.length + " fact type(s) have no key column and get no table -- an entity type in each declares a compound reference scheme, which canon does not yet map to a composite key:");
  for (const u of unkeyed) console.error("  " + u[0]);
}
console.log("compiled " + sentences + " sentences from " + files + " files: "
  + state.length + " cells, " + ddl.length + " bytes of DDL"
  + " (read " + tRead + " ms, state " + tState + " ms, ddl " + tDdl + " ms)");
