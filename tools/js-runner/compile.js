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
const { Ev, CELLS, loadStoreDb, popSnapshot, closeStore, emitToDb, storeDb } = globalThis.AREST;

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
  let carried = 0, filled = 0, reflectedSkipped = 0, tCarry = 0, tCarryReflect = 0, tCarryRows = 0;
  const orphaned = [];
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
      if (ctabEntry) {
        try {
          const cn = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
          ctabEntry[2].forEach((col, i) => {
            const carriedFt = String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : []));
            if (cn[i] && REFLECTED_NAMES.has(carriedFt)) reflectedCols.add(cn[i]);
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
      for (const d2 of dropped) {
        const n = prior.prepare('select count(*) c from ' + qi(table) + ' where ' + qi(d2) + ' is not null').get().c;
        if (n) orphaned.push({ table, column: d2, rows: n, why: 'the build declares no such column' });
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
  const beforeClosure = popSnapshot(CELLS);
  closeStore();
  const closed = emitToDb(beforeClosure, CELLS);
  const sdb = storeDb();
  if (sdb) sdb.close(true);
  console.log("closure: " + closed + " row(s) written into the build (" + (Date.now() - t4) + " ms)");
  renameSync(build, out);
  console.log("store: " + n + " tables, " + inserted + " rows at " + out
    + ", schema " + schemaHash
    + (refused ? ", " + refused + " REFUSED BY SQLITE" : "")
    + (carried || filled ? " [" + carried + " runtime row(s) carried, " + filled + " value(s) filled]" : "")
    + (reflectedSkipped ? " [" + reflectedSkipped + " reflected row(s) left to the closure]" : "")
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
