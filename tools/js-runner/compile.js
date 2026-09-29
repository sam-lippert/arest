// THE COMPILER IS LAMBDA. THIS IS THE I/O.
//
// Sam, 2026-09-20: "compile moving from a c# host to a js host is wrong", "the
// full framework must be lambda with registered DEFS". The C# oracle (17,967
// lines) and the JS compiler (compile-store 902, compile-design-state 361,
// compile-rmap 161) are both deleted. What replaced them is this file, and it
// makes no decision: it reads bytes, hands them to lambda, and executes the SQL
// lambda answers.
//
//   fs:dir / fs:read      ->  REGISTERED: a directory listing, a file's bytes
//   sql:exec              ->  REGISTERED: the database engine
//   CELLS.unshift         ->  lambda's answer installed as cells
//
// EVERY DECISION IS A DEF. Which sentences a file holds (read:sentences), what
// a sentence declares (read:row_of), the schema (read:schema_of),
// the relational map (rmap:*, 324 DEFs) and the schema itself (rmap:ddl and its
// eleven helpers, which have been lambda all along) -- none of it is here.
//
// THE CARRIER IS GONE, NOT MOVED. design-state was a FILE because the oracle
// was a separate PROCESS and had to hand its answer across a process boundary.
// In-process the schema is a value, installed with CELLS.unshift the way
// host.js already installs the store (:3444, :3452, :3580). That deletes the
// renderer too -- src()/chunked(), whose 9-wide chunking restated lambda's
// S1..S9 arity ceiling in JavaScript for a second host to get wrong.
//
// AND THE CALLS THEMSELVES ARE REGISTERED (#109, 2026-09-21). Sam: "Compile
// should have a lambda implementation with registrations for the db engine.
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
import { readFileSync, writeFileSync, rmSync, existsSync, renameSync, readdirSync, statSync } from "node:fs";
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

// ---- A COMPILE WHOSE INPUTS HAVE NOT CHANGED MAKES NOTHING (2026-09-29) --------
// Sam, 2026-09-28: "There should be no schema recomputation unless readings changed." What
// a compile makes is a function of what it reads -- the readings in the directories it is
// handed, lambda, this file, the host and build.js that compose its reader, the strict mode,
// the master key -- and of the store it builds over, whose runtime rows it carries. So the
// compile writes, beside its carriers, the fingerprint of those inputs and the store as it
// left it (size and time), and a compile that finds both unchanged, and the carriers there,
// has nothing to make. A store written since -- by the runtime, or by hand -- is a change. A
// .env is fingerprinted by its size and time and never its bytes, the master key by a hash of
// it. AREST_FORCE=1 compiles regardless.
const INPUTS = (() => {
  const h = createHash("sha256");
  const put = (label, bytes) => { h.update(label + " " + (bytes ? bytes.length : -1) + " "); if (bytes) h.update(bytes); };
  put("arest-compile-inputs-1");
  for (const f of [join(import.meta.dir, "..", "..", "arest"), join(import.meta.dir, "..", "..", "engine", "shared", "scenarios.canon"),
                   join(import.meta.dir, "compile.js"), join(import.meta.dir, "host.js"), join(import.meta.dir, "build.js")])
    put(f, existsSync(f) ? readFileSync(f) : null);
  for (const dir of dirs) {
    put("dir " + dir);
    let names = [];
    try { names = readdirSync(dir).sort(); } catch { names = []; }
    for (const name of names) {
      const p = join(dir, name);
      let st; try { st = statSync(p); } catch { continue; }
      if (!st.isFile()) continue;
      if (name === ".env" || name.endsWith(".env")) put("env " + name + " " + st.size + " " + st.mtimeMs);
      else put("file " + name, readFileSync(p));
    }
  }
  put("strict " + (process.env.AREST_STRICT === "1"));
  if (process.env.AREST_MASTER_KEY) put("key " + createHash("sha256").update(process.env.AREST_MASTER_KEY).digest("hex"));
  return h.digest("hex");
})();
const storeMark = (p) => { try { const st = statSync(p); return st.size + " " + st.mtimeMs; } catch { return "absent"; } };
{
  const od = process.env.AREST_OUT_DIR, db = process.env.AREST_DB;
  if (od && process.env.AREST_FORCE !== "1") {
    let was = null;
    try { was = JSON.parse(readFileSync(join(od, "inputs"), "utf8")); } catch { was = null; }
    const same = was && was.inputs === INPUTS && existsSync(join(od, "design-state")) && existsSync(join(od, "compiled"))
      && (db ? was.store === storeMark(db) && was.db === db : !was.db);
    if (same) {
      console.log("unchanged: the readings, lambda and the compiler are what the last compile read, and the store is as it left it (inputs "
        + INPUTS.slice(0, 16) + ") -- nothing to compile");
      process.exit(0);
    }
  }
}

// The reader is lambda alone -- build.js `slim` composes no carrier and boots
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
  // failure: `reader` is build.js's slim mode and slim is LAMBDA ALONE, which is
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
const { Ev, CELLS, DEFS, loadStoreDb, popSnapshot, closeStore, emitToDb, storeDb, writeMetaschema, adoptStore } = globalThis.AREST;

// ---- THE MODE IS A CELL, AND THE ENVIRONMENT INSTALLS IT ------------------
// lambda's read:strict answers F: the AREST default is not strict (Sam,
// 2026-09-22). A person who wants strictness sets AREST_STRICT=1 where their
// checks are spawned -- mcp-router's apps_check runs `bun run check` with
// process.env, so the env of the router's own entry in ~/.claude.json is one
// person's default and nobody else's. The strict cell is installed the way
// DEF installs one -- in DEFS, which every application of the name reads, and
// in CELLS, which ast:fetch reads -- before the first evaluation, so nothing
// was compiled against the default first. This file decides nothing: what
// strictness refuses is written in lambda beside the arm that refuses it.
const strict = process.env.AREST_STRICT === "1";
if (strict) {
  DEFS.set("read:strict", ["CONST", "T"]);
  CELLS.unshift(["CELL", "read:strict", ["CONST", "T"]]);
}

// WHICH FILES ARE READINGS AND IN WHAT ORDER IS LAMBDA'S. It was this file's
// last decision in the read phase -- core.md first, then alphabetical -- and
// read:file_order answers it from a directory listing.

// THE READ PHASE IS DEF(compile). compile:files is the reading files of every
// directory in reading order, compile:rows their sentences as rows, and
// DEF(compile) is read:schema_of over those -- the whole pipeline this
// file used to run as a loop. The two file calls inside it are REGISTERED:
// fs:dir and fs:read are host prims with no lambda cell, which is what puts
// them in the enumerable boundary instead of in this file.
const t0 = Date.now();
const files = Ev("compile:files", dirs).length;
const sentences = Ev("compile:rows", dirs).length;
const tRead = Date.now() - t0;

// AND THE SCHEMA IS DEF(compile) ITSELF, not read:schema_of over
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
// single-flatten readers are lambda's convention, not a defect each; the
// compiler now holds what the module holds and every reader answers both.
// The relational map's artifacts are computed over the chunked cells too,
// which is how a module without a compiled carrier computes them, and they
// come out byte-identical (gated).
const chunked = state.map((c) => Ev("read:chunk9", c[1]));
for (let i = state.length - 1; i >= 0; i--) CELLS.unshift(["CELL", String(state[i][0]), chunked[i]]);
const tState = Date.now() - t1;
const folded = globalThis.AREST.foldLast ? globalThis.AREST.foldLast() : null;   // where the parse's fold started (read:parse's kept states, host.js)
// ---- A VALUE STORED THROUGH A FUNCTION IS STORED THROUGH IT, BEFORE ANYTHING IS WRITTEN
// (2026-09-25). core.md: `Object Type 'Secret Reference' is stored through Function
// 'crypt:encrypt'`, and Sam, 2026-09-12: ".env contains compile-time plaintext secrets.
// They are never put in a .md. ... The fact types are in the .md and specify whether the
// field is encrypted." hook:write is lambda's definition that applies the declared
// Function, and until now nothing called it. It is applied HERE, to the design state
// lambda just read, because everything this file writes is made from that state: the
// carrier the served module embeds, the build's rows, the closure's, the ledger. Applied
// at the store alone the plaintext would still have been in the carrier, which a `cells`
// answer prints, and in the instance-of rows, where a value is an entity id and no column
// is a Secret Reference. So every value a population holds in a role such a type plays is
// swapped for what hook:write makes of it, wherever it occurs in the state. The key is
// AREST_MASTER_KEY, which the router loads from arest/.env and nothing else holds. No key
// refuses the check, and so does a plaintext still anywhere in the state afterwards, even
// inside a longer atom; a check that refuses writes nothing, and neither message carries a
// value.
const sealed = new Set();
{
  // the marking as the readings assert it, from its descriptor: system:pop_rows reads a
  // population through FILE, which this file never installs, so there it answers nothing --
  // and hook:write, which finds its Function the same way, is given a store holding exactly
  // that marking as a cell of its own, the shape lambda's own hook:write cases use
  const descs = Ev("store:fts", CELLS);
  const through = [];
  for (const d of descs) if (Array.isArray(d) && String(d[0]) === "ObjectTypeIsStoredThroughFunction" && Array.isArray(d[4])) through.push(...d[4]);
  const marking = [["CELL", "ObjectTypeIsStoredThroughFunction", through]];
  const marked = new Map();
  for (const r of through) if (Array.isArray(r) && r.length >= 2) marked.set(String(r[0]), String(r[1]));
  const plain = new Map();
  if (marked.size) {
    for (const d of descs) {
      const players = Array.isArray(d) && Array.isArray(d[1]) ? d[1].map(String) : [];
      const at = players.map((p, i) => (marked.has(p) ? i : -1)).filter((i) => i >= 0);
      if (!at.length) continue;
      for (const row of Array.isArray(d[4]) ? d[4] : []) for (const i of at) {
        const v = Array.isArray(row) ? row[i] : undefined;
        if (typeof v === "string" && v !== "" && v !== "#") plain.set(v, players[i]);
      }
    }
  }
  if (plain.size) {
    const types = [...new Set(plain.values())].map((t) => "'" + t + "'").join(", ");
    const key = process.env.AREST_MASTER_KEY;
    if (!key) {
      console.error("REFUSED: " + plain.size + " value(s) of " + types + ", which the readings store through a Function, "
        + "and no AREST_MASTER_KEY to store them with. Nothing was written.");
      process.exit(1);
    }
    const sealedOf = new Map();
    for (const [v, type] of plain) {
      const c = String(Ev("hook:write", [key, type, v, marking]));
      if (c === v) { console.error("REFUSED: hook:write left a value of '" + type + "' as it was. Nothing was written."); process.exit(1); }
      sealedOf.set(v, c);
    }
    const swap = (x) => (Array.isArray(x) ? x.map(swap) : typeof x === "string" && sealedOf.has(x) ? sealedOf.get(x) : x);
    for (let i = 0; i < state.length; i++) { state[i] = [state[i][0], swap(state[i][1])]; chunked[i] = swap(chunked[i]); }
    const vals = [...plain.keys()];
    const holds = (x) => (Array.isArray(x) ? x.some(holds) : typeof x === "string" && vals.some((v) => x.includes(v)));
    const where = state.filter((c, i) => holds(c[1]) || holds(chunked[i])).map((c) => String(c[0]));
    if (where.length) {
      console.error("REFUSED: a value the readings store through a Function is still in " + where.join(", ")
        + " as written. Nothing was written.");
      process.exit(1);
    }
    for (let i = 0; i < state.length; i++) {
      if (!(Array.isArray(CELLS[i]) && String(CELLS[i][1]) === String(state[i][0]))) throw new Error("the design state is not where it was installed");
    }
    adoptStore(CELLS.map((c, i) => (i < state.length ? ["CELL", String(state[i][0]), chunked[i]] : c)));
    for (const v of vals) sealed.add(v);
    console.log("stored through: " + plain.size + " value(s) of " + types + ", sealed before anything is written");
  }
}
// AND NO QUOTED VALUE OF A .env IS PRINTED. A finding quotes its reading, and a reading
// from a .env may carry a secret, so every quoted value a .env gives -- and every value
// sealed above -- is blanked in what this file prints.
const unprinted = new Set(sealed);
for (const dir of dirs) {
  let names = [];
  try { names = Ev("fs:dir", dir); } catch { names = []; }
  if (!Array.isArray(names) || !names.map(String).includes(".env")) continue;
  for (const row of Ev("compile:file_rows", [dir, ".env"])) {
    for (const tok of Array.isArray(row) && Array.isArray(row[1]) ? row[1] : []) {
      const t = String(Array.isArray(tok) ? tok[0] : tok);
      if (t.length > 2 && t.startsWith("'") && t.endsWith("'")) unprinted.add(t.slice(1, -1));
    }
  }
}
const redact = (text) => { let t = String(text); for (const v of unprinted) if (v) t = t.split(v).join("(not printed)"); return t; };

// ---- WHAT THE READER REPORTED, AND WHAT IT REFUSED -----------------------
// compile:check's second answer, one row per finding: <undeclared, fact type
// name, status, object types, reading text> for a reading that names an
// object type no declaration opens; <rejected, name, status, (), reading> for
// an instance sentence under a reading no fact type declares, its quoted
// values taken out; <unattached, name, status, (), sentence> for a constraint
// that attached to no reading; and <domain, path, status, domains, fault> for
// a file that declares elements and no Domain (a file's domain is the first
// Domain sentence it writes; later ones are catalog entries). Under the
// default every row is `reported`, one summary line per kind goes to stderr
// and the check goes on -- nothing is silent. Under AREST_STRICT=1 the row
// says `refused` -- the reader refused the reading, the check the sentence it
// did not read, the rule the file -- and a check that refuses is a failed
// check: it says so, writes nothing, and exits 1. Each line says REFUSED when
// its own rows were, and names the count and each subject once: an object
// type with the first reading that names it, a rejected reading with how many
// sentences it lost, a constraint as written, a file by its path.
const undeclared = findings.filter((r) => String(r[0]) === "undeclared");
const rejected = findings.filter((r) => String(r[0]) === "rejected");
const unattached = findings.filter((r) => String(r[0]) === "unattached");
const domainless = findings.filter((r) => String(r[0]) === "domain");
const refused = findings.some((r) => String(r[2]) === "refused");
const verdict = (rows) => (rows.some((r) => String(r[2]) === "refused") ? " -- REFUSED (AREST_STRICT=1)" : "");
if (undeclared.length) {
  const first = new Map();
  for (const r of undeclared) for (const t of r[3]) if (!first.has(String(t))) first.set(String(t), redact(r[4]));
  console.error("UNDECLARED: " + undeclared.length + " reading(s) name " + first.size
    + " object type(s) no declaration opens" + verdict(undeclared) + ": "
    + [...first].map(([t, text]) => t + " (" + text + ")").join("; "));
}
if (rejected.length) {
  const lost = new Map();
  for (const r of rejected) { const text = redact(r[4]); lost.set(text, (lost.get(text) || 0) + 1); }
  console.error("REJECTED: " + rejected.length + " instance sentence(s) under " + lost.size
    + " reading(s) no fact type declares" + verdict(rejected) + ": "
    + [...lost].map(([text, n]) => (n > 1 ? text + " (" + n + ")" : text)).join("; "));
}
if (unattached.length) {
  console.error("UNATTACHED: " + unattached.length + " constraint(s) attach to no reading" + verdict(unattached) + ": "
    + unattached.map((r) => redact(r[4])).join("; "));
}
if (domainless.length) {
  console.error("FILE DOMAINS: " + domainless.length + " file(s) declare elements and no Domain" + verdict(domainless) + ": "
    + domainless.map((r) => String(r[1])).join(", "));
}
if (refused) process.exit(1);

// ---- THE CARRIER, WRITTEN BY LAMBDA --------------------------------------
// It is the schema as intersection source, the form host.js's LAMBDATEXT
// already reads -- and writing it here is NOT the renderer coming back. The
// old one chunked every sequence nine wide because build.js spliced the
// carrier as JavaScript CODE and S9 is a nine-parameter function; a carrier is
// spliced as TEXT now (build.js's AS_TEXT, 2026-09-07), and LAMBDATEXT accepts
// the bare `S` at any arity. So no host restates lambda's S1..S9 ceiling and
// this is twelve lines: A an atom, N a number, PHI the empty sequence, DEF a
// <name, body> entry, and the escapes LAMBDATEXT's own reader undoes.
//
// WHY IT STILL EXISTS, since #109 is about removing exactly this kind of
// intermediate: build.js composes the schema INTO the module, and the
// alternative -- the module reading its schema out of the store -- is
// the half of the flip lambda cannot yet answer. WHAT STOOD HERE NAMED THE
// WRONG OBSTACLE and is corrected rather than deleted. It said four populated
// fact types were named by no path and that lambda emits the schema and has no
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
// THE SCHEMA IS A VALUE; THE CARRIER IS ONE RENDERING OF IT, and the
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
// AND IT IS CHUNKED NINE WIDE, BECAUSE LAMBDA READS IT THAT WAY. Measured
// 2026-09-20: 48 lambda DEFs compose an UNGUARDED theta:flatten with an
// ast:fetch of a state: cell -- rules:model, solve:rules, ui:otpops,
// rmap:readrows, main:declared_names and forty-three more -- so each of them
// flattens exactly one level and a carrier chunked any other way is a
// different value. The nine came from S9 being a nine-parameter JavaScript
// function; it has been load-bearing lambda ever since, undeclared. So this
// does not restate it: read:chunk9 IS lambda's chunker, 43 ms for all 22
// cells, and the width lives where the readers live.
//
// Since 2026-09-21 the cells this file holds in CELLS are the same chunked
// values (ONE CELL, ONE SHAPE above), so the forty-seven answer here as they
// answer in a module; rmap:unfold4 remains right for a reader that must
// answer either shape.
//
// reflect:surface was the exception that proved it. It flattened
// unconditionally too, and lambda's own flat schema made four
// reflections raise `selector 2 on atom: DomainHasDescription` while the
// oracle's chunked one passed; it now unfolds with rmap:unfold4 and both
// shapes answer 781/400/781/781. The other forty-seven are recorded, not
// fixed: they are a lambda change with a suite behind it, not a compiler one.
const body = state.map((c, i) => 'DEF("' + esc(String(c[0])) + '", ' + src(chunked[i]) + ")").join(",\n");
const carrier = "(\n" + body + "\n)\n";
const carrierBytes = Buffer.from(carrier, "utf8");
if (outDir) {
  const tmp = join(outDir, "design-state.build");
  writeFileSync(tmp, carrier);
  renameSync(tmp, join(outDir, "design-state"));
  console.log("carrier: " + carrier.length + " bytes at " + join(outDir, "design-state"));

  // ---- AND THE RELATIONAL MAP, WHICH IS THE SAME COMPILATION ----------------
  // tools/compile-rmap.js (161 lines, deleted) wrote these; they are lambda's
  // own answers cached, one DEF per rmap artifact, and lambda reads each through
  // a COND that derives only when the cell is absent. Without them the map is
  // rederived at every boot -- `lambda's DDL is a database SQLite will accept`
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
  // THE MAP IS KEPT BY THE SCHEMA IT MAPS (2026-09-29). The relational map is a function of the
  // schema and of nothing the readings populate: every artifact below came out identical with
  // each fact type's population and each object type's instances taken out of the cells, on
  // tasks' closure and on support's -- where computing them is 40 of the compile's seconds. So they
  // are kept, keyed by lambda, the strict mode and the schema without its populations, in the
  // cache the reader keeps a file's rows in, and a readings change that only moves instances --
  // the everyday one -- maps nothing. AREST_PARSE_CACHE=off turns it off with the other.
  const rmapCache = (() => {
    if (process.env.AREST_PARSE_CACHE === "off") return null;
    try {
      const path = process.env.AREST_PARSE_CACHE || join(require("node:os").tmpdir(), "arest-cache", "parse.db");
      require("node:fs").mkdirSync(require("node:path").dirname(path), { recursive: true });
      const db = new Database(path, { create: true });
      db.exec("pragma journal_mode = wal"); db.exec("pragma busy_timeout = 5000");
      db.exec("create table if not exists rmap (k text primary key, v text not null, t integer not null)");
      return db;
    } catch { return null; }
  })();
  const rmapKey = createHash("sha256").update(JSON.stringify([
    createHash("sha256").update(readFileSync(join(import.meta.dir, "..", "..", "arest"))).digest("hex"),
    strict,
    state.map(([n, v]) => [String(n), String(n) === "state:fts" ? v.map((d) => [d[0], d[1], d[2], d[3]])
      : String(n) === "state:otpops" ? v.map((r) => r[0]) : v]),
  ])).digest("hex");
  let kept = null;
  if (rmapCache) { try { const hit = rmapCache.query("select v from rmap where k = ?").get(rmapKey); if (hit) kept = JSON.parse(hit.v); } catch { kept = null; } }
  const made = {};
  for (const a of ARTIFACTS) {
    let v;
    if (kept && Object.prototype.hasOwnProperty.call(kept, a)) v = kept[a];
    else {
      try { v = Ev("rmap:" + a, CELLS); } catch (e) { skipped.push(a + " (" + e.message.slice(0, 60) + ")"); continue; }
      made[a] = v;
    }
    CELLS.unshift(["CELL", "stored:rmap:" + a, v]);
    defs.push('DEF("stored:rmap:' + a + '", ' + src(v) + ")");
  }
  // and the DDL, which the map's artifacts do not carry: installed as the stored:rmap:ddl cell
  // rmap:ddl reads, for this compile only -- it is not written into `compiled`
  let ddlKept = kept && typeof kept.ddl === "string" ? kept.ddl : null;
  if (ddlKept === null) { try { ddlKept = String(Ev("rmap:ddl", CELLS)); made.ddl = ddlKept; } catch { ddlKept = null; } }
  if (ddlKept !== null) CELLS.unshift(["CELL", "stored:rmap:ddl", ddlKept]);
  // the cells above went in after ast:fetch had indexed CELLS: say so, or no rmap:X reads its stored cell
  if (globalThis.AREST.cellsChanged) globalThis.AREST.cellsChanged();
  if (rmapCache) {
    try {
      if (!kept) rmapCache.query("insert or replace into rmap (k, v, t) values (?, ?, ?)").run(rmapKey, JSON.stringify(made), Date.now());
      else rmapCache.query("update rmap set t = ? where k = ?").run(Date.now(), rmapKey);
      rmapCache.query("delete from rmap where t < ?").run(Date.now() - 30 * 86400000);   // a month unused
    } catch { }
    try { rmapCache.close(); } catch { }
  }
  // THE STAMP IS WHAT LETS build.js REFUSE IT. The carrier is derived FROM the
  // schema, so a schema regenerated since leaves it describing
  // tables that no longer exist; build.js hashes design-state and declines a
  // `compiled` that names another.
  const stamp = createHash("sha256").update(carrierBytes).digest("hex").slice(0, 16);
  const compiled = '(\n"AREST_COMPILED_FROM=' + stamp + '",\n\n' + defs.join(",\n") + "\n)\n";
  const ctmp = join(outDir, "compiled.build");
  writeFileSync(ctmp, compiled);
  renameSync(ctmp, join(outDir, "compiled"));
  console.log("relational map: " + defs.length + " of " + ARTIFACTS.length + " artifacts" + (kept ? " (kept: the schema is the one mapped before)" : "") + ", "
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
// migration gate (migrate:, 25 lambda DEFs); until it is, this REPLACES rather
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
// A REFLECTED NAME NEVER CARRIES (b6e16927, #122 item 1 continued), and has no runtime part in place (2026-09-29). A boot
// writes the REFLECTED populations back into these same tables too --
// host.js's loadReflected installs lambda's own reflect:cells answer as the
// cell of a reflected fact type's name, and emitToDb (~349) projects that
// cell the same way any other one is projected. So a row the prior store
// holds for a reflected name is the CLOSURE's computation over whatever
// schema that boot had, not a runtime fact, and carrying it forward
// is carrying a STALE closure answer into a build the closure has not run
// over yet -- a constraint the readings no longer declare surviving
// because the carry could not tell a reflected row from a written one.
// Skipped here, nothing is lost: the next boot's loadReflected + emitToDb
// recomputes it fresh and writes it back.
//
// WHICH NAMES ARE REFLECTED IS LAMBDA'S ANSWER, the same one loadReflected
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
// rmap's -- both go stale on the same lambda edit and neither one
// evaluates a population to get the names.
const REFLECTED_NAMES = new Set(("FactTypeHasRole FactTypeHasReading ObjectTypePlaysRole "
  + "RoleIsUsedInReading StateMachineIsForObjectTypeInstance StateMachineIsInstanceOfStateMachineDefinition "
  + "StateMachineIsCurrentlyInStatus ObjectTypeInstanceIsCurrentlyInStatus ConstraintIsOfConstraintType "
  + "ConstraintHasModalityOfModalityType ConstraintSpan ConstraintSpanHasSequenceNumber "
  + "ConstraintSpanHasPosition FunctionBelongsToDomain").split(" "));

// ---- THE READINGS' ROWS (2026-09-29: out of the rebuild's block, so the in-place path writes the same) ----
// rmap:proj_rows answers a table's rows -- the key, then one value per column in the order
// rmap:proj_colnames gives them -- so this binds and executes and decides nothing. # is lambda's absent
// value and becomes SQL NULL; everything else goes in as text, because a column's type is the schema's
// business and sqlite's affinity applies it.
function writeReadingsRows(db) {
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
  return { inserted, refused, first };
}
// AND WHAT THOSE ROWS ARE, fact by fact, read back from the tables as loadStoreDb reads a store: every
// table rmap:coltabs names, its columns in rmap:proj_colnames' order, handed to rmap:unproj. This, and not
// store:fts's fifth slot, is what a build hands its closure as the readings' facts: a fact type with no
// table (27 on support.auto.dev, the compound reference schemes lambda does not map to a composite key)
// and a unary whose table the inverse cannot read back (ThemeIsTheDefaultTheme, PlatformAPIIsPerVIN)
// never reach it, and a column's affinity has already given a value its stored spelling.
function factsOfDb(db) {
  const facts = [];
  for (const [table] of Ev("rmap:coltabs", CELLS)) {
    const name = String(table);
    const cn = Ev("rmap:proj_colnames", [name, CELLS]).map(String);
    if (!cn.length) continue;
    const rows = db.query("select " + cn.map((c) => '"' + c + '"').join(",") + ' from "' + name + '"').values();
    if (!rows.length) continue;
    const clean = rows.map((r) => r.map((v) => (v === null ? "#" : String(v))));
    for (const p of Ev("rmap:unproj", [name, clean, CELLS])) facts.push([String(p[0]), p[1]]);
  }
  return facts;
}

// A ROW AS THE LEDGER SPELLS IT: its filled columns by name, in the table's
// column order. A Function row is 301 columns of which three or four hold
// anything, so the empty ones are left out rather than written as null.
const ledgerRow = (names, row) => { const o = {}; for (const nm of names) { const v = row[nm]; if (v !== null && v !== undefined) o[nm] = v; } return JSON.stringify(o); };
// and the same spelling from a row's values in its columns' order, without an object per row: JSON.stringify
// of the object ledgerRow builds, member by member, which is the same text while no column's name is an
// array index (an object puts those first), and then it is ledgerRow's own
const INDEXLIKE = /^(0|[1-9][0-9]*)$/;
const spellRow = (names, vals) => {
  if (names.some((n) => INDEXLIKE.test(n))) { const o = {}; names.forEach((n, i) => { o[n] = vals[i]; }); return ledgerRow(names, o); }
  let t = "{", first = true;
  for (let i = 0; i < names.length; i++) {
    const v = vals[i];
    if (v === null || v === undefined) continue;
    t += (first ? "" : ",") + JSON.stringify(names[i]) + ":" + JSON.stringify(v);
    first = false;
  }
  return t + "}";
};
// AND A FACT AS THE RECORDS SPELL IT (2026-09-29): its tuple as JSON, every number as the text a
// table cell holds, so a fact read back from the tables and the same fact as the readings state it
// are one spelling (the 1-and-"1" note beside popSnapshot in host.js).
const asStoredV = (v) => (Array.isArray(v) ? v.map(asStoredV) : typeof v === "number" ? String(v) : v);
const factText = (r) => JSON.stringify(asStoredV(r));
// and a population as the set of those, one spelling to a line, to say whether two are one
const factSet = (rows) => {
  const t = rows.map(factText);
  t.sort();
  let out = "";
  for (let i = 0; i < t.length; i++) if (i === 0 || t[i] !== t[i - 1]) out += t[i] + "\n";
  return out;
};

// ---- A READINGS CHANGE APPLIED TO THE STORE IN PLACE (2026-09-29) ---------------------------
// Sam, 2026-09-28: "There should be no schema recomputation unless readings changed, and even
// then, the changes only need to be the deltas." A rebuild writes every row the readings assert
// into a fresh file, carries across every row the runtime wrote, closes the result and ledgers it:
// on support.auto.dev that is the whole store written again for an edit to one instance. The store
// is already almost all of what the next one will be. So the compile (unless AREST_INPLACE=0)
// copies the store beside itself and applies the readings' change there as a WRITE -- the same
// snapshot, evaluate, emit a runtime write takes, the row planner rewriting only the rows whose
// facts moved -- and renames the copy in, as a rebuild renames its build.
//
// WHAT IT NEEDS THE STORE RECORDS (_readings, _derived, beside the ledger): the facts the last
// build's readings asserted and the facts its closure derived into a semi-derived head. The facts
// the store holds beyond those, and beyond the reflected and fully derived populations the closure
// recomputes whole, are the runtime's, and they stay. So a fact type's new population is the
// runtime's facts and the new readings' facts -- the readings winning a uniqueness they share, as
// the carry fills only what the readings leave empty -- and the closure is taken over that.
//
// WHAT IT DOES NOT HANDLE IS A REBUILD, AND SAYS SO: a store with no records; a table, index or
// column the store has that the new schema does not have in the same words, or a column that now
// carries another fact type (a new table is created in place); an entity the readings stop
// introducing while a runtime fact still names it, which the rebuild's carry decides row by row.
function compileInPlace() {
  const t0 = Date.now();
  const no = (why) => { console.log("in place: no -- " + why + "; rebuilding"); return null; };
  if (!existsSync(out)) return no("there is no store yet");
  // THE STORE CARRIES ITS RECORDS
  const prior = new Database(out, { readonly: true });
  const priorHas = (t) => !!prior.query("select 1 from sqlite_master where type = 'table' and name = ?").get(t);
  for (const t of ["_metaschema", "_readings", "_derived", "_asserted"]) {
    if (!priorHas(t)) { prior.close(); return no("the store carries no " + t); }
  }
  // THE SCHEMA IS THE STORE'S, OR THE STORE'S AND NEW TABLES: every table and index it has is in the
  // new schema in the same words, and every column of them carries the fact type it carried
  const fresh = new Database(build);
  writeMetaschema(fresh);
  const objects = (d) => {
    const m = new Map();
    for (const r of d.query("select type, name, tbl_name, sql from sqlite_master where sql is not null").all()) {
      if (String(r.tbl_name).startsWith("_") || String(r.name).startsWith("sqlite_")) continue;
      m.set(r.type + " " + r.name, String(r.sql));
    }
    return m;
  };
  const metaOf = (d) => {
    const m = new Map();
    for (const r of d.query('select "tab", "ord", "col", "ft" from "_metaschema" order by "tab", "ord"').values()) {
      const k = String(r[0]);
      m.set(k, (m.get(k) || "") + JSON.stringify(r) + "\n");
    }
    return m;
  };
  const was = objects(prior), now = objects(fresh), wasMeta = metaOf(prior), nowMeta = metaOf(fresh);
  // A TABLE THAT GAINED COLUMNS IS ALTERED IN PLACE, NOT REBUILT (2026-09-29). Sam: "An alter statement will be
  // the implementation of a schema change." A functional fact type added to an entity type is a column of its
  // table, and the whole store was rebuilt for it. A table whose new definition is its old one with columns
  // added -- every old column there with the same type, nullability, default and key position, each new one
  // outside the key, nullable and with no default, neither definition carrying any constraint but its primary
  // key, no index on the table, and every old column carrying the fact type it carried -- is re-laid in the
  // store's copy as SQLite's generalized ALTER does it: the new layout created, the rows copied into it by
  // column name, the old table dropped and the new one renamed into its place. Not ADD COLUMN, which puts a
  // column last where the DDL puts it in its place, and the ledger spells a row in its table's column order:
  // re-laid, the table is the DDL's byte for byte, as a rebuild writes it. A column that went, a key that
  // moved or a constraint added is a rebuild, as before.
  const colsOf = (d, t) => d.query('select "name", "type", "notnull", "dflt_value", "pk" from pragma_table_info(?)').values(t)
    .map((r) => ({ name: String(r[0]), attrs: JSON.stringify([r[1], r[2], r[3], r[4]]), pk: Number(r[4]), notnull: Number(r[2]), dflt: r[3] }));
  const keyOnly = (sql) => !/\b(CHECK|REFERENCES|UNIQUE|DEFAULT|COLLATE|GENERATED|NULL|WITHOUT|STRICT|AS)\b/i.test(String(sql).replace(/"(?:[^"]|"")*"/g, '""'));
  const indexedTables = (d) => new Set(d.query("select tbl_name from sqlite_master where type = 'index' and sql is not null").values().map((r) => String(r[0])));
  const carriesOf = (d) => {
    const m = new Map();
    for (const r of d.query('select "tab", "col", "ft" from "_metaschema"').values()) {
      let c = m.get(String(r[0])); if (!c) m.set(String(r[0]), (c = new Map()));
      c.set(String(r[1]), String(r[2]));
    }
    return m;
  };
  const wasIndexed = indexedTables(prior), nowIndexed = indexedTables(fresh);
  const relaid = new Map();
  const moved = [];
  for (const [k, sql] of was) {
    const nsql = now.get(k);
    if (nsql === sql) continue;
    const t = k.startsWith("table ") ? k.slice(6) : null;
    if (t === null || nsql === undefined || wasIndexed.has(t) || nowIndexed.has(t) || !keyOnly(sql) || !keyOnly(nsql)) { moved.push(k); continue; }
    const oc = colsOf(prior, t), nc = colsOf(fresh, t);
    const nOf = new Map(nc.map((c) => [c.name, c]));
    const added = nc.filter((c) => !oc.some((o) => o.name === c.name));
    if (!oc.every((c) => nOf.has(c.name) && nOf.get(c.name).attrs === c.attrs) || !added.length || added.some((c) => c.pk || c.notnull || c.dflt !== null)) { moved.push(k); continue; }
    relaid.set(t, { sql: nsql, cols: oc.map((c) => c.name) });
  }
  const wasCarries = carriesOf(prior), nowCarries = carriesOf(fresh);
  fresh.close(true);
  if (moved.length) { prior.close(); return no(moved.length + " table(s) or index(es) the store has are not in the new schema as they are (" + moved.slice(0, 3).join(", ") + ")"); }
  const recarried = [...wasMeta].filter(([t, v]) => {
    if (nowMeta.get(t) === v) return false;
    if (!relaid.has(t)) return true;
    const o = wasCarries.get(t) || new Map(), n = nowCarries.get(t) || new Map();
    for (const [c, ft] of o) if (n.get(c) !== ft) return true;
    return false;
  }).map(([t]) => t);
  if (recarried.length) { prior.close(); return no(recarried.length + " table(s) carry other fact types now (" + recarried.slice(0, 3).join(", ") + ")"); }
  const created = [...now].filter(([k]) => !was.has(k));
  // THE RECORDS: what the last build's readings asserted and its closure derived, fact by fact
  const recordOf = (t) => {
    const m = new Map();
    for (const r of prior.query('select "ft", "row" from ' + qi(t)).values()) {
      let s = m.get(String(r[0]));
      if (!s) m.set(String(r[0]), (s = new Set()));
      s.add(String(r[1]));
    }
    return m;
  };
  const R0 = recordOf("_readings"), D0 = recordOf("_derived");
  prior.close();
  // AND THE NEW READINGS', as a build hands them to its closure: their rows written into the fresh schema
  // and read back (factsOfDb); and the uniqueness constraints each fact type declares short of its arity
  const R1 = new Map(), R1text = new Map(), ucsOf = new Map();
  {
    const fdb = new Database(build);
    writeReadingsRows(fdb);
    for (const [ft, r] of factsOfDb(fdb)) {
      let l = R1.get(ft); if (!l) { R1.set(ft, (l = [])); R1text.set(ft, new Set()); }
      const t = factText(r);
      if (R1text.get(ft).has(t)) continue;
      l.push(r); R1text.get(ft).add(t);
    }
    fdb.close(true);
  }
  for (const d of Ev("store:fts", CELLS)) {
    if (!Array.isArray(d) || typeof d[0] !== "string") continue;
    const arity = Array.isArray(d[1]) ? d[1].length : 0;
    ucsOf.set(d[0], (Array.isArray(d[2]) ? d[2] : []).filter((u) => Array.isArray(u) && u.length > 0 && u.length < arity));
  }
  const tReadings = Date.now() - t0;
  // AND EACH DESCRIPTOR'S OWN ROWS, as the design state has them before any store is read into the cells:
  // a build leaves a fact type whose table holds nothing with these, and so does this
  const ownRows = new Map();
  for (const d of Ev("store:fts", CELLS)) if (Array.isArray(d) && typeof d[0] === "string") ownRows.set(d[0], Array.isArray(d[4]) ? d[4] : []);
  // THE COPY, beside the store, and the new tables in it
  const saved = CELLS.slice();
  const restart = (why) => {
    // nothing is lost: the store is untouched, and the rebuild gets the fresh schema it expects
    adoptStore(saved);
    try { rmSync(build); } catch { }
    ddl = String(Ev("compile:schema", [build, CELLS]));
    return no(why);
  };
  try { rmSync(build); } catch { }
  {
    const p = new Database(out, { readonly: true });
    p.exec("vacuum into '" + build.split("'").join("''") + "'");
    p.close();
  }
  const db = new Database(build);
  db.exec("begin");
  for (const [t, r] of relaid) {
    const head = "CREATE TABLE " + qi(t) + " (";
    if (!r.sql.startsWith(head)) { db.exec("rollback"); db.close(true); return restart("the new definition of " + t + " does not begin as the DDL writes one"); }
    const tmp = qi(t + "__relaid"), cl = r.cols.map(qi).join(",");
    db.exec("CREATE TABLE " + tmp + " (" + r.sql.slice(head.length));
    db.exec("insert into " + tmp + " (" + cl + ") select " + cl + " from " + qi(t));
    db.exec("drop table " + qi(t));
    db.exec("alter table " + tmp + " rename to " + qi(t));
  }
  for (const [k, sql] of created) if (k.startsWith("table ")) db.exec(sql);
  for (const [k, sql] of created) if (!k.startsWith("table ")) db.exec(sql);
  db.exec("commit");
  writeMetaschema(db);
  const identity = createHash("sha256");
  identity.update(readFileSync(join(import.meta.dir, "..", "..", "arest")));
  identity.update(readFileSync(join(import.meta.dir, "..", "..", "engine", "shared", "scenarios.canon")));
  identity.update(carrierBytes);
  const witness = outDir ? join(outDir, "norma-answer") : "";
  if (witness && existsSync(witness)) identity.update(readFileSync(witness));
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
  db.exec('delete from "_composition"');
  db.query('insert into "_composition" (hash, schema) values (?, ?)').run(identity.digest("hex").slice(0, 16), schemaHash);
  db.close(true);
  // THE STORE, READ THROUGH THE NEW SCHEMA. What the snapshot below reads is what is on disk: system:pop_rows
  // reads a fact type's top-level cell, which the load makes for every table that holds rows, and never
  // its descriptor.
  const tCopy = Date.now() - t0 - tReadings;
  process.env.AREST_STORE_DB = build;
  loadStoreDb(build);
  collect();
  const before = popSnapshot(CELLS);
  let priorCells = CELLS.slice();
  const tLoad = Date.now() - t0 - tReadings - tCopy;
  // THE DELTA: each fact type's new population is the runtime's facts -- what the store holds less the
  // last readings' facts and everything the last closure added -- and the new readings' facts, a runtime
  // fact giving way to a readings fact that holds the same key on a uniqueness constraint. A population
  // the closure computes whole is left with the runtime's part of it, which is none, and the closure
  // below computes it again; one it merges with rows it was handed keeps those rows.
  const r0typed = new Set(), r1typed = new Set();
  const OTPOPS = "ObjectTypeInstanceIsInstanceOfObjectType";
  for (const t of R0.get(OTPOPS) || []) { try { r0typed.add(String(JSON.parse(t)[0])); } catch { } }
  for (const r of R1.get(OTPOPS) || []) if (Array.isArray(r)) r1typed.add(String(asStoredV(r[0])));
  const gone = new Set([...r0typed].filter((x) => !r1typed.has(x)));
  const pairs = [];
  let facts = 0;
  const runtimeOf = new Map();
  for (const [ft, text] of before) {
    const current = Ev("system:pop_rows", [ft, CELLS]);
    // THE STORE MUST READ AS IT WAS WRITTEN. A fact the last build's readings put into a table reads back
    // from it under the same schema, unless the runtime took it out; when a fact type's key role moves
    // from one player to the other the tables, columns and fact types stay and only the direction the
    // rows are read in changes, and the store then reads as facts it never held -- every one of which
    // this would have kept as the runtime's. So a readings fact that no longer reads back is a rebuild.
    {
      const r0 = R0.get(ft);
      if (r0 && r0.size) {
        const here = new Set(current.map(factText));
        let lost = 0; for (const t of r0) if (!here.has(t)) lost++;
        if (lost) return restart(lost + " of the last build's " + r0.size + " readings fact(s) of " + ft + " no longer read back from the store");
      }
    }
    let next;
    {
      const r0 = R0.get(ft), d0 = D0.get(ft);
      const r1 = R1.get(ft) || [], r1t = R1text.get(ft) || new Set();
      const ucs = ucsOf.get(ft) || [];
      const taken = ucs.map((u) => new Set(r1.map((r) => JSON.stringify(u.map((p) => asStoredV(r[p - 1]))))));
      const runtime = [];
      for (const r of current) {
        const t = factText(r);
        if ((r0 && r0.has(t)) || (d0 && d0.has(t)) || r1t.has(t)) continue;
        if (REFLECTED_NAMES.has(ft)) continue;   // the closure's to answer, never the runtime's: the carry keeps none either
        if (ucs.some((u, i) => taken[i].has(JSON.stringify(u.map((p) => asStoredV(r[p - 1])))))) continue;
        if (gone.size && (Array.isArray(r) ? r : [r]).some((v) => gone.has(String(v)))) {
          return restart("the readings no longer introduce " + [...gone].slice(0, 3).join(", ")
            + " and a runtime fact of " + ft + " names one");
        }
        runtime.push(r);
      }
      next = r1.concat(runtime);
      if (runtime.length) runtimeOf.set(ft, runtime);
    }
    if (factSet(next) !== factSet(current)) { pairs.push([ft, next]); facts++; }
  }
  // THE STORE BEFORE, AS THE ROW PLANNER READS IT: from each fact type's descriptor, and a fact type the
  // disk holds nothing of keeps the design state's own rows there -- so a relation added with a fact of its
  // own read as already written, and its new table stayed empty. For every fact type the delta moves that
  // holds nothing on disk, the planner's store before says so; the cells the closure reads are not these.
  {
    const bare = pairs.filter(([ft]) => before.get(ft) === "[]").map(([ft]) => ft);
    if (bare.length) {
      const b = new Set(bare);
      priorCells = Ev("store:src_all", [bare.map((ft) => [ft, []]), priorCells]).filter((c) => !(Array.isArray(c) && c[0] === "CELL" && b.has(c[1])));
    }
  }
  // A POPULATION THE DELTA EMPTIES IS LEFT AS A BUILD LEAVES ONE: no top-level cell -- loadDerived takes a
  // cell of a head's name, even an empty one, for the head's own and skips what the closure derives, which
  // lost support.auto.dev's nine authorizations (a head whose rules carry the '+', not its declaration) --
  // and its descriptor holding the design state's own rows.
  if (pairs.length) adoptStore(Ev("store:src_all", [pairs.map(([ft, rows]) => [ft, rows.length ? rows : (ownRows.get(ft) || [])]), CELLS]));
  {
    const emptied = new Set(pairs.filter((p) => !p[1].length).map((p) => p[0]));
    if (emptied.size) adoptStore(CELLS.filter((c) => !(Array.isArray(c) && c[0] === "CELL" && emptied.has(c[1]))));
  }
  // AND THE INSTANCE TYPING IS THE READINGS' OWN, WITH THE STORE'S MERGED IN. store:otpops merges the
  // rows it is handed into the state:otpops the cells hold, and after the load that is the store's
  // typing already -- a task the readings dropped would stay typed. A build merges its rows into the
  // readings' cell, the one the design state installed before any store was read; so does this.
  if (pairs.some((p) => p[0] === OTPOPS)) {
    const own = saved.find((c) => Array.isArray(c) && c[1] === "state:otpops");
    const withOwn = CELLS.filter((c) => !(Array.isArray(c) && c[1] === "state:otpops"));
    if (own) withOwn.unshift(own);
    adoptStore(withOwn);
    const cell = Ev("store:otpops", [pairs.find((p) => p[0] === OTPOPS)[1], CELLS]);
    const next = CELLS.filter((c) => !(Array.isArray(c) && c[1] === "state:otpops"));
    next.unshift(["CELL", "state:otpops", cell]);
    adoptStore(next);
  }
  const tDelta = Date.now() - t0;
  // THE CLOSURE, over the runtime's facts and the new readings', and what it moved written as rows
  const t1 = Date.now();
  const preClose = popSnapshot(CELLS);
  closeStore();
  collect();
  // AND THE DESCRIPTORS SAY WHAT THE CELLS SAY. The closure answers in top-level cells; a table is projected
  // from the descriptors, and emitToDb brings a descriptor up to date only for a fact type whose population
  // moved. A reflected population the delta set to the readings' rows and the closure answered again as
  // the store already held it has not moved -- so its descriptor kept the readings' rows, and a Function
  // table written whole from it lost the domains. Every fact type the delta touched is brought up to date.
  if (pairs.length) adoptStore(Ev("store:src_all", [pairs.map(([ft]) => [ft, Ev("system:pop_rows", [ft, CELLS])]), CELLS]));
  const report = {};
  // WHAT MOVED IS WRITTEN: a table row by row, the rows whose facts moved deleted by their key and
  // projected again (emitToDb's planner, handed the store before); a reflected relation whole, as a build's
  // closure writes it and the carry keeps none of it, because the planner deletes a row by the key its facts project to and a ConstraintSpan
  // an older schema's write-back left, holding another key, outlived its facts -- a REFLECTED relation's,
  const relation = new Set();
  {
    const ftsHere = Ev("store:fts", CELLS);
    for (const t of Ev("rmap:coltabs", CELLS)) { try { if (Ev("rmap:proj_hits", [String(t[0]), ftsHere]).length > 0) relation.add(String(t[0])); } catch { } }
  }
  report.whole = (table) => relation.has(table) && REFLECTED_NAMES.has(table);   // a reflected relation's rows are wholly the closure's
  const written = emitToDb(before, CELLS, priorCells, report);
  const touched = new Set(report.touched || []);
  const derivedNow = [];
  for (const [ft, t] of popSnapshot(CELLS)) {
    const was = preClose.get(ft);
    if (was === t) continue;
    const had = new Set((was ? JSON.parse(was) : []).map(factText));
    for (const r of JSON.parse(t)) { const x = factText(r); if (!had.has(x)) derivedNow.push([ft, x]); }
  }
  const sdb = storeDb();
  if (sdb) sdb.close(true);
  const tClose = Date.now() - t1;
  // THE LEDGER AND THE RECORDS, for the next compile. The ledger is written for every table, each row the
  // runtime's or the readings' and the closure's as its facts say (below); the two records change by their
  // differences.
  const t2 = Date.now();
  // WHOSE A ROW IS, fact by fact: a row is the runtime's when it holds a fact the runtime wrote -- which is
  // what the rebuild's carry comes to, a row it added or filled from the store being the runtime's unless the
  // closure derives what it filled. Which row holds a fact is the projection's answer, as the row planner
  // reads it: in a relation table the row IS the fact; in an entity table a column's value is walked from
  // the row's key, which the fact holds at the key position of the column's first step (rmap:proj_keypos).
  // Matching a key against every value a runtime fact holds took readings rows keyed 'AT' or '2' for the
  // runtime's, and a relation table's columns carry its role links, not the relation, so a relation's
  // runtime rows were ledgered as the readings' -- rows the next rebuild would have superseded.
  const ctabOf = new Map();
  try { for (const ct of Ev("rmap:ctab", CELLS)) ctabOf.set(String(ct[1]), ct); } catch { }
  const ftsNow = Ev("store:fts", CELLS);
  const runtimeRowsOf = (table) => {
    let rel = false;
    try { rel = Ev("rmap:proj_hits", [table, ftsNow]).length > 0; } catch { rel = false; }
    const keys = new Set();
    if (rel) {
      for (const r of runtimeOf.get(table) || []) keys.add(JSON.stringify((Array.isArray(r) ? r : [r]).map((v) => String(v)).sort()));
      return { rel, keys };
    }
    const ct = ctabOf.get(table);
    for (const col of (ct && Array.isArray(ct[2]) ? ct[2] : [])) {
      let na;
      try { na = Ev("rmap:proj_nonassim", Array.isArray(col[2]) ? col[2] : []); } catch { continue; }
      if (!Array.isArray(na) || !na.length) continue;
      const st = na[0];
      const ft = Array.isArray(st) && Array.isArray(st[4]) && st[4].length ? String(st[4][0]) : null;
      if (!ft || !runtimeOf.has(ft)) continue;
      let kp = 1;
      try { kp = Number(Ev("rmap:proj_keypos", [st, CELLS])); } catch { kp = 1; }
      for (const r of runtimeOf.get(ft)) { const v = Array.isArray(r) ? r[kp - 1] : r; if (v !== undefined && v !== null) keys.add(String(v)); }
    }
    return { rel, keys };
  };
  let ledgered = 0;
  {
    const ldb = new Database(build);
    ldb.exec("begin");
    // AND ONLY WHAT DIFFERS IS WRITTEN (2026-09-29): each table's entries are read, the rows spelled from
    // their values, and an entry the table no longer has deleted and a new one inserted -- rewriting all
    // of them, through an object per row of a 313-column table, was 3.3 of support's in-place seconds
    const unspell = ldb.prepare('delete from "_asserted" where "tbl" = ? and "row" = ?');
    const put = ldb.prepare('insert or ignore into "_asserted" ("tbl", "row") values (?, ?)');
    const held = new Map();
    for (const r of ldb.query('select "tbl", "row" from "_asserted"').values()) {
      let hs = held.get(String(r[0])); if (!hs) held.set(String(r[0]), (hs = new Set()));
      hs.add(String(r[1]));
    }
    // every table, not only those the write touched: a row the runtime changed since the last build is
    // spelled otherwise than the ledger holds it, and a rebuild supersedes the old spelling
    const tables = ldb.query("select name from sqlite_master where type = 'table'").values().map((r) => String(r[0]))
      .filter((t) => !t.startsWith("_") && !t.startsWith("sqlite_"));
    for (const table of tables) {
      const names = ldb.query("select name from pragma_table_info(?)").values(table).map((c) => String(c[0]));
      const was = held.get(table) || new Set();
      held.delete(table);
      if (!names.length) { for (const t of was) unspell.run(table, t); continue; }
      const rt = runtimeRowsOf(table);
      const pkAt = ldb.query("select name from pragma_table_info(?) where pk > 0 order by pk").values(table).map((c) => names.indexOf(String(c[0])));
      const now = new Set();
      for (const vals of ldb.query("select " + names.map(qi).join(",") + " from " + qi(table)).values()) {
        if (rt.keys.size) {
          if (rt.rel) {
            const fact = vals.filter((v) => v !== null && v !== undefined).map((v) => String(v)).sort();   // the whole fact: a key may span fewer roles
            if (rt.keys.has(JSON.stringify(fact))) continue;
          } else if (pkAt.length === 1 && pkAt[0] >= 0 && vals[pkAt[0]] !== null && vals[pkAt[0]] !== undefined && rt.keys.has(String(vals[pkAt[0]]))) continue;
        }
        now.add(spellRow(names, vals));
      }
      for (const t of was) if (!now.has(t)) unspell.run(table, t);
      for (const t of now) if (!was.has(t)) put.run(table, t);
      ledgered += now.size;
    }
    // and a table the store no longer has leaves no entries
    for (const [table, hs] of held) for (const t of hs) unspell.run(table, t);
    const change = (table, was, now) => {
      const del = ldb.prepare('delete from ' + qi(table) + ' where "ft" = ? and "row" = ?');
      const add = ldb.prepare('insert or ignore into ' + qi(table) + ' ("ft", "row") values (?, ?)');
      let n = 0;
      for (const [ft, set] of was) { const keep = now.get(ft); for (const t of set) if (!keep || !keep.has(t)) { del.run(ft, t); n++; } }
      for (const [ft, set] of now) { const had = was.get(ft); for (const t of set) if (!had || !had.has(t)) { add.run(ft, t); n++; } }
      return n;
    };
    const D1 = new Map();
    for (const [ft, t] of derivedNow) { let ds = D1.get(ft); if (!ds) D1.set(ft, (ds = new Set())); ds.add(t); }
    const movedRecords = change("_readings", R0, R1text) + change("_derived", D0, D1);
    ldb.exec("commit");
    ldb.close(true);
    let nr = 0; for (const set of R1text.values()) nr += set.size;
    console.log("record: " + nr + " fact(s) the readings assert, " + derivedNow.length + " the closure added (" + movedRecords + " record(s) moved)");
  }
  const tLedger = Date.now() - t2;
  renameSync(build, out);
  console.log("store (in place): " + facts + " fact type(s) moved by the readings, " + written + " row(s) written with the closure's, "
    + ledgered + " ledgered in the " + touched.size + " table(s) it wrote, " + created.length + " table(s) and index(es) created, " + relaid.size + " table(s) re-laid with columns added"
    + " (delta " + tDelta + " ms: readings' rows " + tReadings + ", copy " + tCopy + ", load " + tLoad + ", facts " + (tDelta - tReadings - tCopy - tLoad)
    + "; closure " + tClose + " ms, ledger " + tLedger + " ms) at " + out);
  return true;
}

const inplaced = out && process.env.AREST_INPLACE !== "0" ? compileInPlace() : null;

if (!out && !outDir) {
  process.stdout.write(ddl);
} else if (out && !inplaced) {
  const db = new Database(build, { create: true });
  // AND IT CARRIES THE COMPOSITION IT IS A PROJECTION OF. build.js stamps a
  // module with sha256 of lambda and the carriers -- IDENTITY, which is
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
  // AND THE ROWS ARE LAMBDA'S TOO. rmap:proj_rows answers a table's rows -- the
  // key, then one value per column in the order rmap:colnames gives them -- so
  // this binds and executes and decides nothing. # is lambda's absent value and
  // becomes SQL NULL; everything else goes in as text, because a column's type
  // is the schema's business and sqlite's affinity applies it.
  const t3 = Date.now();
  const { inserted, refused, first } = writeReadingsRows(db);
  // WHAT THE READINGS ARE, AS THE STORE READS THEM BACK (see factsOfDb)
  const readingsFacts = factsOfDb(db);
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
  //
  // AND THE LEDGER IS BACK, BECAUSE THE PREMISE ABOVE IS FALSE (2026-09-24). The
  // build beside us is what the readings assert NOW; what the prior store holds
  // and it does not is what the runtime wrote OR what the readings asserted
  // BEFORE, and the carry could not tell them apart. It runs before the closure,
  // too, so every build carried the previous closure's whole answer forward as
  // runtime rows -- 55,012 on support's rebuild today -- and when a reading went,
  // its rows stayed: support's store kept the roles, the Event Type and Fact
  // Type instances and the subtype links of fact types its readings no longer
  // declare (894 rows, one runtime case among 86,902), and every create was
  // refused on 355 alethic violations the closure raised over them. So the
  // build records, in `_asserted`, every row it and its closure asserted -- all
  // of them but the ones this carry brought back -- and the next build asks it:
  // a prior row the ledger holds is the READINGS', and is superseded when this
  // build does not assert it; a prior row it does not hold is the RUNTIME's, and
  // is carried, or refused for a Migration if it would be lost. A store with no
  // ledger is read as before, every row the runtime's -- which is why a store
  // that already carries such rows is made honest ONCE, by a build over a prior
  // that holds only its runtime rows (227c4422's own finding, the first time).
  let carried = 0, filled = 0, reflectedSkipped = 0, moved = 0, tCarry = 0, tCarryReflect = 0, tCarryRows = 0;
  let superseded = 0, priorLedger = null;
  // what this carry brought back, by table: by key where the row had one, whole
  // where it did not -- the rows the ledger written below leaves out
  const carriedKeys = new Map(), carriedRows = new Map();
  // WHAT THE CARRY FILLED, by table and key: the column, its value and the fact type the
  // column carries, so the closure can be asked afterwards whether it derives the value itself
  const filledCells = new Map();
  let withEntity = 0, rederived = 0;
  const withEntityRows = [];
  const followed = [];
  const movedFts = new Map();
  const orphaned = [];
  const rekeyed = [];
  if (existsSync(out)) {
    const tCarryStart = Date.now();
    const prior = new Database(out, { readonly: true });
    priorLedger = null;
    try {
      if (prior.prepare("select 1 from sqlite_master where type = 'table' and name = '_asserted'").get()) {
        priorLedger = new Map();
        for (const r of prior.prepare('select "tbl", "row" from "_asserted"').values()) {
          let set = priorLedger.get(r[0]); if (!set) priorLedger.set(r[0], (set = new Set()));
          set.add(r[1]);
        }
      }
    } catch (e) { console.error("  (the prior store's ledger could not be read -- " + e.message + " -- every prior row is the runtime's, as before)"); priorLedger = null; }
    // the rows of a prior table (under `where`) that the ledger does not hold --
    // all of them when there is no ledger -- and those it does are superseded
    // AN ENTITY THE READINGS INTRODUCED AND NO LONGER INTRODUCE TAKES ITS OWN ROW WITH IT
    // (2026-09-25). The reader types every instance a reading names -- read:reflect writes
    // `Object Type Instance is instance of Object Type` -- so the build knows, before this
    // carry runs, which entities the readings still introduce, and the last build's ledger
    // knows which they introduced then. A row keyed by an entity in the second set and not
    // the first is the readings' row of an entity they have dropped: support.auto.dev's
    // `redraft-sent` after cd64286, whose typing rows the ledger held and the batch build
    // superseded, while its Function row -- never ledgered, for the reason the fill note
    // below gives -- was carried back as runtime and kept Sent from being terminal. A runtime
    // entity is never typed by the ledger, so its rows carry exactly as before.
    const TYPING = "ObjectTypeInstanceIsInstanceOfObjectType";
    const priorTyped = new Set(), buildTyped = new Set();
    if (priorLedger && priorLedger.has(TYPING)) {
      for (const spelled of priorLedger.get(TYPING)) {
        try { const o = JSON.parse(spelled); if (o.objectTypeInstanceId !== undefined) priorTyped.add(String(o.objectTypeInstanceId)); }
        catch { /* not a row this spells */ }
      }
      try { for (const r of db.prepare('select "objectTypeInstanceId" from ' + qi(TYPING)).values()) buildTyped.add(String(r[0])); }
      catch { priorTyped.clear(); }   // no typing in the build: nothing can be said, so nothing is
    }
    const runtimeCount = (table, cols, where) => {
      const names = cols.map((o) => o.name);
      const all = prior.prepare('select ' + names.map(qi).join(',') + ' from ' + qi(table) + (where ? ' where ' + where : '')).all();
      const held = priorLedger && priorLedger.get(table);
      if (!held) return all.length;
      let n = 0;
      for (const r of all) if (!held.has(ledgerRow(names, r))) n++;
      return n;
    };
    const shapeOf = (d) => {
      const m = new Map();
      for (const t of d.prepare("select name from sqlite_master where type='table'").all()) {
        if (String(t.name).startsWith("_")) continue;
        m.set(t.name, d.prepare('pragma table_info(' + qi(t.name) + ')').all());
      }
      return m;
    };
    const was = shapeOf(prior), now = shapeOf(db);
    // WHICH FACT TYPE EACH COLUMN CARRIES, on both sides: the prior store's metaschema is the
    // map it was written through, and the build's was written before this carry runs (~525)
    const metaOf = (d) => {
      const m = new Map();
      try {
        for (const r of d.prepare('select "tab", "col", "ft" from "_metaschema"').values()) {
          if (r[2] === null || r[2] === undefined) continue;
          let t = m.get(String(r[0])); if (!t) m.set(String(r[0]), (t = new Map()));
          t.set(String(r[1]), String(r[2]));
        }
      } catch { /* a store written before the metaschema: nothing is followed, as before */ }
      return m;
    };
    const priorMeta = metaOf(prior), buildMeta = metaOf(db);
    db.exec("begin");   // and one for the carry: claude's check spent 9 s on Function and 17 s on the instance table, a sync per carried row
    // A REFLECTED NAME NEVER CARRIES: REFLECTED_NAMES, at module scope, says which and why.
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
        const all = prior.prepare('select count(*) c from ' + qi(table)).get().c;
        const n = all ? runtimeCount(table, oldCols) : 0;
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
      // A COLUMN THE MAP RENAMED IS FOLLOWED BY THE FACT TYPE IT CARRIES (2026-09-25). The carry
      // matched a prior column to the build's by NAME, and a name is not a fact: when an entity
      // gains a second role played by the same type, the relational map disambiguates and the
      // first role's column is named anew. pm.auto.dev's dry run of support's quoted reply
      // (`Email Message quotes Message Body` beside `Email Message has Message Body`) was refused
      // on EmailMessage.messageBody -- the 4 runtime bodies of the emails sent or drafted that day
      // -- although the build carries the same fact type in a column of another name. So a prior
      // column the build lacks is followed to the build column that carries the SAME fact type,
      // when exactly one prior column and exactly one new build column carry it and neither is a
      // key. Anything else -- two columns on one fact type, a ring, a key -- is not guessed at, and
      // stays an orphan that refuses, as before.
      const renamed = new Map();   // build column -> the prior column its values come from
      {
        const pm = priorMeta.get(table), bm = buildMeta.get(table);
        if (pm && bm) {
          const byFt = (m) => { const o = new Map(); for (const [c, ft] of m) { let l = o.get(ft); if (!l) o.set(ft, (l = [])); l.push(c); } return o; };
          const priorByFt = byFt(pm), buildByFt = byFt(bm);
          for (const o of oldColsK) {
            if (o.pk || keep.includes(o.name)) continue;
            const ft = pm.get(o.name);
            if (!ft) continue;
            const olds = priorByFt.get(ft) || [];
            const news = (buildByFt.get(ft) || []).filter((c) => !oldColsK.some((x) => x.name === c));
            if (olds.length !== 1 || news.length !== 1) continue;
            const nc = newColsK.find((c2) => c2.name === news[0]);
            if (!nc || nc.pk || renamed.has(news[0])) continue;
            renamed.set(news[0], o.name);
          }
          for (const [nn, on] of renamed) { keep.push(nn); followed.push(table + "." + on + " -> " + nn); }
        }
      }
      const src = (n2) => renamed.get(n2) || n2;
      // NO SHARED COLUMN, NOTHING TO MATCH ON: the prior table is a different
      // layout of the same name (compile-store.js's k + fact-type-name columns
      // against lambda's role-named ones), and its rows are orphaned whole.
      if (!keep.length) {
        const all = prior.prepare('select count(*) c from ' + qi(table)).get().c;
        const n = all ? runtimeCount(table, oldCols) : 0;
        if (n) orphaned.push({ table, rows: n, why: 'no column of the prior table survives in the build' });
        continue;
      }
      const followedFrom = new Set(renamed.values());
      const dropped = oldColsK.map((o) => o.name).filter((n2) => !keep.includes(n2) && !followedFrom.has(n2));
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
        const all = prior.prepare('select count(*) c from ' + qi(table) + ' where ' + qi(d2) + ' is not null').get().c;
        const n = all ? runtimeCount(table, oldCols, qi(d2) + ' is not null') : 0;
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
      // a PRIOR row's key reads each build column's value where the prior store wrote it
      const keyOfPrior = (r) => JSON.stringify(keep.map((n2) => r[src(n2)] === undefined ? null : r[src(n2)]));
      const seen = (r) => {
        if (!present) present = new Set(db.prepare('select ' + cols + ' from ' + qi(table)).all().map(keyOf));
        return present.has(keyOfPrior(r));
      };
      const wherePk = pk.length ? pk.map((k) => qi(k) + ' is ?').join(" and ") : "";
      const vals = keep.filter((n2) => !pk.includes(n2));
      const findPk = pk.length && vals.length
        ? db.prepare('select ' + vals.map(qi).join(",") + ' from ' + qi(table) + ' where ' + wherePk)
        : null;
      // one UPDATE per column, prepared once, not once per filled value
      const fills = new Map();
      const fill = (v) => { let s = fills.get(v); if (!s) { s = db.prepare('update ' + qi(table) + ' set ' + qi(v) + '=? where ' + wherePk); fills.set(v, s); } return s; };
      const priorNames = oldCols.map((o) => o.name);
      const held = priorLedger && priorLedger.get(table);
      let ck = carriedKeys.get(table), cr = carriedRows.get(table);
      if (!ck) carriedKeys.set(table, (ck = { pk, keys: new Set() }));
      if (!cr) carriedRows.set(table, (cr = { cols: keep, rows: new Set() }));
      for (const row of prior.prepare('select ' + priorNames.map(qi).join(',') + ' from ' + qi(table)).all()) {
        // the readings' own row: superseded when this build does not say it, and
        // never a source of values for cells this build left empty
        const isHeld = held ? held.has(ledgerRow(priorNames, row)) : false;
        // AND IT GOES BEFORE ANYTHING IS ASKED ABOUT IT (2026-09-29): every branch below ends a held
        // row with `continue`, and the keyed one asked the build for the row's every other column
        // first -- a select per prior row, 34,547 of them on support's Function table, 3.8 s of its
        // carry for rows the ledger was always going to drop.
        if (isHeld) continue;
        const k = pk.map((n2) => row[n2]);
        const keyed = pk.length && k.every((v) => v !== null && v !== undefined);
        if (!keyed) {
          if (seen(row)) continue;   // the build already says it
          try { add.run(...keep.map((n2) => row[src(n2)])); carried++; present.add(keyOfPrior(row)); cr.rows.add(keyOfPrior(row)); } catch { /* the build refuses it */ }
          continue;
        }
        const here = findPk ? findPk.get(...k) : null;
        if (!here) {
          if (pk.length === 1 && priorTyped.has(String(k[0])) && !buildTyped.has(String(k[0]))) {
            withEntity++;
            if (withEntityRows.length < 12) withEntityRows.push(table + " '" + String(k[0]) + "'");
            continue;
          }
          try { add.run(...keep.map((n2) => row[src(n2)])); carried++; ck.keys.add(JSON.stringify(k)); } catch { /* the build refuses it */ }
          continue;
        }
        for (const v of vals) {
          if (here[v] !== null && here[v] !== undefined) continue;   // the readings say something: they win
          const pv = row[src(v)];
          if (pv === null || pv === undefined) continue;     // the runtime said nothing either
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
            if (cf.rev.has(JSON.stringify([pv, k[0]]))) {
              moved++;
              movedFts.set(cf.ft, (movedFts.get(cf.ft) || 0) + 1);
              continue;
            }
          }
          try {
            fill(v).run(pv, ...k); filled++; ck.keys.add(JSON.stringify(k));
            let byKey = filledCells.get(table); if (!byKey) filledCells.set(table, (byKey = new Map()));
            const kk = JSON.stringify(k); let cells = byKey.get(kk); if (!cells) byKey.set(kk, (cells = []));
            cells.push({ col: v, value: pv, ft: cf ? cf.ft : null, ring: cf ? cf.a === cf.b : true, key: k });
            if (process.env.AREST_CARRY_TRACE) console.error("  fill " + table + " " + kk + " " + v + " (" + (cf ? cf.ft : "no single fact type") + ")");
          }
          catch { /* the build refuses it */ }
        }
      }
      // A TABLE THAT COSTS A SECOND IS NAMED as it finishes, with the split:
      // the detection of its reflected columns (lambda, per table and column)
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
  // AND WHAT THE CLOSURE ADDED, TO ANY POPULATION (2026-09-29). A population the closure writes into
  // may hold rows it did not derive as well -- a semi-derived head's asserted rows, and the rows a
  // reflection merges with what it infers: reflect:computed names sixteen populations, and the readings
  // type 1,773 instances into ObjectTypeInstanceIsInstanceOfObjectType before the reflection adds its
  // own (tasks' closure). Once written they are all rows of one table, so this records the closure's
  // part of every population: what it holds after the closure less what it was handed (on
  // support.auto.dev 170,869 facts over 40 populations). A population whose answer cannot be read
  // leaves no record at all rather than a partial one, so nothing downstream can take a derived
  // fact for an asserted one.
  let derivedFacts = [];
  try {
    for (const [ft, t] of popSnapshot(CELLS)) {
      const was = beforeClosure.get(ft);
      if (was === t) continue;
      const had = new Set((was ? JSON.parse(was) : []).map(factText));
      for (const r of JSON.parse(t)) { const x = factText(r); if (!had.has(x)) derivedFacts.push([ft, x]); }
    }
  } catch (e) {
    console.error("  (what the closure added could not be read -- " + String(e.message).slice(0, 120) + " -- no record of it is written)");
    derivedFacts = null;
  }
  // A FILL THE CLOSURE DERIVES IS THE CLOSURE'S, NOT THE RUNTIME'S (2026-09-25). The carry
  // fills a cell the build left empty from the prior store, and a filled row is the runtime's,
  // so the ledger leaves it out. But a build leaves EVERY derived column empty -- the closure
  // has not run yet -- so a value the last closure derived was filled back as though the
  // runtime had written it, its row kept out of the ledger, and the next build read the row as
  // runtime again, for ever: support.auto.dev's accept, resolve-escalation and redraft-sent,
  // whose transitionPredicateId `draftSupportResponse` is the Moore-to-Mealy rule's, were in
  // no ledger since the first rebuild after it was seeded (pm.auto.dev, 2026-09-25), and when
  // cd64286 dropped redraft-sent it was carried back whole. So the head's own rules are asked,
  // over this build with the head's rows emptied, whether they derive each filled fact; a row
  // whose every fill they derive is the readings' and the closure's, and is ledgered. A fill
  // they do not derive -- a fact type with no rule, a unary, a ring, a composite key -- stays the
  // runtime's, which is the old reading and the safe one.
  const tRederive = Date.now();
  if (filledCells.size) {
    try {
      const fts = new Set();
      for (const byKey of filledCells.values()) for (const cells of byKey.values())
        for (const c of cells) if (c.ft && !c.ring && c.key.length === 1) fts.add(c.ft);
      const rules = fts.size ? Ev("law:all_rules", CELLS) : [];
      const pairs = fts.size ? Ev("derive:store_pairs", CELLS) : [];
      const derivedRows = new Map();
      for (const ft of fts) {
        const mine = rules.filter((r) => Array.isArray(r) && String(r[0]) === ft);
        if (!mine.length) continue;
        const without = pairs.map((p) => (String(p[0]) === ft ? [p[0], []] : p));
        const rows = Ev("derive:pop", [ft, Ev("derive", [mine, without])]);
        derivedRows.set(ft, new Set((Array.isArray(rows) ? rows : []).map((r) => JSON.stringify((Array.isArray(r) ? r : [r]).map(String)))));
      }
      for (const [table, byKey] of filledCells) {
        const ck = carriedKeys.get(table);
        for (const [kk, cells] of byKey) {
          const theirs = cells.every((c) => {
            const set = c.ft && !c.ring && c.key.length === 1 ? derivedRows.get(c.ft) : null;
            if (!set) return false;
            const k0 = String(c.key[0]), v = String(c.value);
            return set.has(JSON.stringify([k0, v])) || set.has(JSON.stringify([v, k0]));
          });
          if (theirs && ck && ck.keys.delete(kk)) {
            rederived++;
            if (process.env.AREST_CARRY_TRACE) console.error("  rederived " + table + " " + kk + ": " + cells.map((c) => c.col).join(", "));
          }
        }
      }
    } catch (e) {
      console.error("  (whether the closure derives the filled values could not be read -- " + String(e.message).slice(0, 160)
        + " -- every fill stays the runtime's, as before)");
    }
  }
  const rederiveMs = Date.now() - tRederive;
  const sdb = storeDb();
  if (sdb) sdb.close(true);
  console.log("closure: " + closed + " row(s) written into the build (" + (Date.now() - t4) + " ms)");
  // THE LEDGER: every row of the build but the ones the carry brought back
  // (by key, or whole where a row had no key) -- the readings' rows and the
  // closure's, which the next build supersedes when it no longer asserts them.
  const tLedger = Date.now();
  let ledgered = 0;
  {
    const ldb = new Database(build);
    ldb.exec('create table if not exists "_asserted" ("tbl" text not null, "row" text not null, primary key ("tbl", "row")) without rowid');
    ldb.exec("begin");
    // THE READINGS' FACTS AND THE CLOSURE'S, AS FACTS (2026-09-29). The ledger says which ROWS a
    // build asserted; these say which FACTS: every fact the readings assert (_readings) and every
    // fact the closure derived into a semi-derived head (_derived). What the store holds beyond
    // them, and beyond the reflected and fully derived populations the closure recomputes whole,
    // is what the runtime wrote -- which is what a compile that applies a readings change to the
    // store in place has to know, fact by fact.
    ldb.exec('create table if not exists "_readings" ("ft" text not null, "row" text not null, primary key ("ft", "row")) without rowid');
    const putR = ldb.prepare('insert or ignore into "_readings" ("ft", "row") values (?, ?)');
    for (const [ft, r] of readingsFacts) putR.run(ft, factText(r));
    if (derivedFacts) {
      ldb.exec('create table if not exists "_derived" ("ft" text not null, "row" text not null, primary key ("ft", "row")) without rowid');
      const putD = ldb.prepare('insert or ignore into "_derived" ("ft", "row") values (?, ?)');
      for (const [ft, t] of derivedFacts) putD.run(ft, t);
    }
    const put = ldb.prepare('insert or ignore into "_asserted" ("tbl", "row") values (?, ?)');
    for (const t of ldb.prepare("select name from sqlite_master where type = 'table'").values()) {
      const table = String(t[0]);
      if (table.startsWith("_")) continue;
      const names = ldb.prepare('pragma table_info(' + qi(table) + ')').all().map((c) => c.name);
      const ck = carriedKeys.get(table), cr = carriedRows.get(table);
      const was = priorLedger && priorLedger.get(table);
      for (const row of ldb.prepare('select ' + names.map(qi).join(',') + ' from ' + qi(table)).all()) {
        const spelled = ledgerRow(names, row);
        if (was) was.delete(spelled);   // still asserted, or still here: not superseded
        if (ck && ck.keys.size && ck.keys.has(JSON.stringify(ck.pk.map((c) => (row[c] === undefined ? null : row[c]))))) continue;
        if (cr && cr.rows.size && cr.rows.has(JSON.stringify(cr.cols.map((c) => (row[c] === undefined ? null : row[c]))))) continue;
        put.run(table, spelled);
        ledgered++;
      }
    }
    // what the last ledger held and the finished build does not hold at all --
    // including every row of a table the build no longer has
    if (priorLedger) for (const set of priorLedger.values()) superseded += set.size;
    ldb.exec("commit");
    ldb.close(true);
  }
  console.log("ledger: " + ledgered + " row(s) the readings and the closure assert (" + (Date.now() - tLedger) + " ms)");
  console.log("record: " + readingsFacts.length + " fact(s) the readings assert, "
    + (derivedFacts ? derivedFacts.length + " the closure added" : "the closure's not recorded"));
  renameSync(build, out);
  console.log("store: " + n + " tables, " + inserted + " rows at " + out
    + ", schema " + schemaHash
    + ", metaschema " + metarows + " column(s) (" + tMetaMs + " ms)"
    + (refused ? ", " + refused + " REFUSED BY SQLITE" : "")
    + (carried || filled ? " [" + carried + " runtime row(s) carried, " + filled + " value(s) filled]" : "")
    + (superseded ? " [" + superseded + " row(s) superseded: the last build asserted them and this one does not]" : "")
    + (followed.length ? " [" + followed.length + " column(s) followed by the fact type they carry: " + followed.join(", ") + "]" : "")
    + (withEntity ? " [" + withEntity + " row(s) superseded with their entity, which the readings typed and this build does not: "
        + withEntityRows.join(", ") + (withEntity > withEntityRows.length ? ", ..." : "") + "]" : "")
    + (rederived ? " [" + rederived + " filled row(s) ledgered: the closure derives every value filled into them ("
        + rederiveMs + " ms to ask)]" : "")
    + (reflectedSkipped ? " [" + reflectedSkipped + " reflected row(s) left to the closure]" : "")
    + (moved ? " [" + moved + " value(s) NOT carried: the build already asserts the same fact with the"
        + " roles the other way -- " + [...movedFts].map((e) => e[0] + " " + e[1]).join(", ") + "]" : "")
    + " (" + tRows + " ms" + (tCarry ? ", " + tCarry + " ms carry: reflected columns " + tCarryReflect + " ms, rows " + tCarryRows + " ms" : "") + ")");
  for (const f of first) console.log("  " + f);
}
// WHAT THE STORE CANNOT HOLD IS SAID, NOT SKIPPED. rmap:unkeyed is every fact
// type the map gives a table with no columns -- an entity-type player with no
// reference scheme lambda can map, so nothing that needs its key has a column to
// carry -- and rmap:coltabs leaves them out so the DDL is one sqlite accepts.
// This prints them because a silent omission is the defect state:undelivered
// exists to prevent; the composite key for a compound scheme is what fixes it.
const unkeyed = Ev("rmap:unkeyed", CELLS);
if (unkeyed.length) {
  console.error("UNSTORED: " + unkeyed.length + " fact type(s) have no key column and get no table -- an entity type in each declares a compound reference scheme, which lambda does not yet map to a composite key:");
  for (const u of unkeyed) console.error("  " + u[0]);
}
// THE LAST ACT: what this compile read, and the store as it left it (see INPUTS, at the top).
if (outDir) writeFileSync(join(outDir, "inputs"), JSON.stringify({ inputs: INPUTS, db: out || null, store: out ? storeMark(out) : null }));
console.log("compiled " + sentences + " sentences from " + files + " files: "
  + state.length + " cells, " + ddl.length + " bytes of DDL"
  + " (read " + tRead + " ms, state " + tState + " ms" + (folded && folded.kept > 0 ? ", the fold kept to row " + folded.kept + " of " + folded.rows : "") + ", ddl " + tDdl + " ms)");
