// The js host's own unit tests. `bun test` -- no python, no other host.
//
// Every host runs the same canon over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv, and agreement follows because they
// all match the same file. Verifying this host needs bun and nothing else.
//
// Each case is one test, so a failure names the case rather than printing a
// diff of 566 lines. The evaluator is entered exactly as the CLI enters it --
// Ev("main", [CELLS, ["case", name]]) -- so this tests canon, not a test-only
// path through the runner.
//
//   bun run build:test && bun test
import { expect, test, describe } from "bun:test";
import { readFileSync, unlinkSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";

import "./cases.g.js";
const { Ev, CELLS } = globalThis.AREST;

const SHARED = join(import.meta.dir, "..", "..", "engine", "shared");

function golden(file) {
  const out = new Map();
  const text = readFileSync(join(SHARED, file), "utf8");
  for (const line of text.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    out.set(line.slice(0, tab), JSON.parse(line.slice(tab + 1)));
  }
  return out;
}

// A case that no host can evaluate answers "<refused>" everywhere and agrees
// perfectly, which is why the refusal COUNT is the signal and not the pass
// line: a def the hosts cannot reduce would otherwise look verified.
function answer(name) {
  // THE BOTTOM ROWS ARE THE POINT. canon's note above main:case_text says one
  // case per invocation is deliberate: the table holds rows that BOTTOM, no
  // canon def can branch on bottom, and a fold would die at the first one. The
  // CLI makes a bottom visible by dying, and the driver records <refused>.
  // In-process the boundary is a catch, and it has to be here or 17 deliberate
  // refusals read as 17 broken tests.
  let out;
  try {
    out = Ev("main", [CELLS, ["case", name]]);
  } catch {
    return "<refused>";
  }
  const text = out === undefined ? undefined : out[0];
  return text === "" || text === undefined ? "<refused>" : String(text).trim();
}

const cases = golden("expected-cases.tsv");

describe("every case answers what the canon says it answers", () => {
  for (const [name, want] of cases) {
    test(name, () => {
      expect(answer(name)).toBe(want);
    });
  }
});

// A def NO host can evaluate answers <refused> everywhere and agrees
// perfectly, so the refusal COUNT is the signal, not the pass line. But the
// per-case tests already assert each refusal against the golden, so counting
// them by re-evaluating all 566 doubles the suite to prove nothing new. The
// risk that remains is a golden REGENERATED with more refusals than it had --
// that is a change to the expectation, and this is where it gets noticed.
// 19 since case:eval-unknown-form-refuses joined them: a recipe form that names no
// entry in derive:forms must REFUSE, because the thing it replaced -- a COND
// chain whose final else was the join -- silently treated an unrecognized form
// AS a join, and a transitive closure stopped closing. That fix landed in the
// table path and left derive:eval's chain standing with the same final else;
// the new case pins the full path, which now shares the one table.
test("the golden still expects exactly 19 refusals", () => {
  const refused = [...cases.values()].filter((v) => v === "<refused>");
  expect(refused.length).toBe(19);
});

// 53 laws over the composed store is minutes, not milliseconds -- it is the
// single most expensive thing this host does, and bun's default 5s cuts it off
// mid-run and reports a timeout as a failure.
test("law:report holds, byte for byte", () => {
  const want = readFileSync(join(SHARED, "expected-laws.txt"), "utf8").trim();
  const got = String(Ev("main", [CELLS, []])[0]).trim();
  expect(got).toBe(want);
}, 900_000);

// THE FIRST SCREEN IS A GOLDEN TOO. The laws never read the panes, so a canon
// change to ui:groups that emptied the root screen passed every gate above and
// was caught by running a container (2026-09-07). The root layer of the base
// store, as the ui container routes it, is recorded here and compared as the
// law report is; a screen that changes on purpose re-records it.
test("the root screen holds, byte for byte", () => {
  const want = readFileSync(join(SHARED, "expected-root.txt"), "utf8").trim();
  const got = JSON.stringify(Ev("ui:route", [CELLS, [], [], []])).trim();
  expect(got).toBe(want);
}, 60_000);

// ---- DOES CANON'S RELATIONAL MAPPING PROJECT TO A REAL DATABASE? -----------
//
// rmap:ddl renders the mapping as CREATE TABLE. Asserting the text against a
// golden would only pin the text; what matters is whether SQLite ACCEPTS it,
// which is a question no string comparison answers. So the test runs it.
//
// This is the leg that went out with the fat hosts (engine/python's
// ddl.project(D, con) and the rust resident's `sql` verb) and it was never
// fat-host work -- canon derives the schema, the host only opens a file. The
// pieces were always here: rmap:ddl_table and rmap:ddl_order existed with NO
// caller, so nothing walked the schema and nothing noticed.
test("canon's DDL is a database SQLite will accept", () => {
  const sql = String(Ev("rmap:ddl", CELLS));
  expect(sql).toContain("CREATE TABLE IF NOT EXISTS");

  const db = new Database(":memory:");
  db.run(sql);                                    // throws on invalid SQL
  const tables = db
    .query("select name from sqlite_master where type = ?")
    .all("table")
    .map((r) => r.name);

  // every table canon names must exist in the database it just described
  for (const name of Ev("rmap:tables", CELLS)) {
    expect(tables).toContain(String(name));
  }
  expect(tables.length).toBeGreaterThan(0);
});

// ---- DOES orient ANSWER THE FACTS OF A DOMAIN? -----------------------------
//
// `orient` was named in system:session_verbs and had NO definition -- no cell
// called orient, main:orient or session:orient -- so solve:cell answered PHI,
// the CLI route printed `unknown mode`, and mcp:verb_keep dropped it from the
// tool list. FROM OUTSIDE, A VERB THAT ANSWERS NOTHING AND A VERB THAT DOES NOT
// EXIST ARE THE SAME THING, and that indistinguishability is the whole defect.
// So the assertion here is not `it did not throw` and not `errors 0`: it is
// that for every Domain the store attributes facts to, orient answers rows,
// and answers EXACTLY the rows the store attributes -- recomputed here from the
// populations rather than read back from orient, so the two can disagree.
//
// Proven to fail before it was trusted: replacing orient's body with K(PHI())
// reports `silent` holding all 25 domains of the composed store and 4 of the
// synthetic one, naming each with the count of facts it dropped.
//
// The Domain role sits at position 2 in every `belongs to Domain` fact type and
// at position 1 in `Domain has Description`; that is the model's shape, not a
// convention -- see system:domain_belongings in canon.
const ORIENT_SOURCES = [
  ["DomainHasDescription", 0, 1],
  ["FunctionBelongsToDomain", 1, 0],
  ["FactBelongsToDomain", 1, 0],
  ["ObjectTypeInstanceBelongsToDomain", 1, 0],
  ["ViolationBelongsToDomain", 1, 0],
  ["FailureBelongsToDomain", 1, 0],
];

const popOf = (store, ft) => Ev("system:pop_rows", [ft, store]).map((r) => r.map(String));
const key = (row) => JSON.stringify(row);   // a separator no value can forge

// the rule, stated a second time and independently: the Domain's Description
// plus the facts belonging to it and to the Domains it reaches, less the
// entities in a terminal status
function attributedTo(store, domain) {
  const reaches = popOf(store, "DomainReachesDomain");
  const scope = new Set([domain, ...reaches.filter((r) => r[0] === domain).map((r) => r[1])]);
  const terminal = new Set(popOf(store, "StatusIsTerminalInStateMachineDefinition").map((r) => r[0]));
  const retired = new Set(
    popOf(store, "ObjectTypeInstanceIsCurrentlyInStatus").filter((r) => terminal.has(r[1])).map((r) => r[0]),
  );
  const out = [];
  for (const [ft, dpos, vpos] of ORIENT_SOURCES)
    for (const row of popOf(store, ft))
      if (scope.has(row[dpos]) && !retired.has(row[vpos])) out.push(key([row[dpos], ft, row[vpos]]));
  return out.sort();
}

const orientRows = (store, domain) => Ev("orient", [domain, store]).map((r) => key(r.map(String))).sort();

function orientHolds(store, label) {
  const domains = new Set();
  for (const [ft, dpos] of ORIENT_SOURCES) for (const row of popOf(store, ft)) domains.add(row[dpos]);

  const silent = [], wrong = [];
  let fired = 0;
  for (const d of [...domains].sort()) {
    const want = attributedTo(store, d);
    if (!want.length) continue;            // nothing attributed: nothing to answer
    fired++;
    const got = orientRows(store, d);
    if (!got.length) silent.push(`${d}: store attributes ${want.length} facts, orient answered 0`);
    else if (got.join("\n") !== want.join("\n"))
      wrong.push(`${d}: orient ${got.length} rows, store ${want.length}; only in orient ` +
        JSON.stringify(got.filter((r) => !want.includes(r)).slice(0, 3)) +
        `, only in store ` + JSON.stringify(want.filter((r) => !got.includes(r)).slice(0, 3)));
  }
  // A CHECK THAT NEVER FIRES IS NOT A CHECK: if no domain in this store had
  // facts, every assertion above would pass on a verb that answers nothing.
  expect(`${label}: domains with facts = ${fired}`).not.toBe(`${label}: domains with facts = 0`);
  expect(silent).toEqual([]);
  expect(wrong).toEqual([]);
  return fired;
}

test("orient is declared AND defined, which was the defect", () => {
  expect(Ev("system:session_verbs", []).map((v) => String(v))).toContain("orient");
  // solve:cell is what main's verb route and mcp:verb_row both ask; PHI here is
  // exactly what made the verb unreachable from every surface
  expect(Ev("solve:cell", ["orient", CELLS]).length).toBeGreaterThan(0);
});

test("orient answers what the composed store attributes to a domain", () => {
  expect(orientHolds(CELLS, "composed store")).toBeGreaterThan(0);
});

// The composed store populates ONE of the six sources (Domain has Description),
// because nothing in the metamodel or the templates asserts `belongs to Domain`
// and `Domain is contained in Domain` is empty, so its reach closure is empty
// too. A rule checked only where it degenerates is not checked: this store
// carries all three legs -- a reach closure two deep, four belonging
// populations, and an entity in a terminal status -- and the SAME assertions
// run over it. The cells are prepended because ast:FetchPop consults top-level
// cells before FILE, so these populations win over the composed store's.
const SYNTHETIC = [
  ["CELL", "DomainHasDescription", [["d1", "Top"], ["d2", "Child"], ["d3", "Grandchild"], ["dx", "Unrelated"]]],
  ["CELL", "DomainReachesDomain", [["d1", "d2"], ["d2", "d3"], ["d1", "d3"]]],
  ["CELL", "FunctionBelongsToDomain", [["f1", "d1"], ["f2", "d2"], ["f3", "d3"], ["fx", "dx"]]],
  ["CELL", "FactBelongsToDomain", [["k1", "d2"]]],
  ["CELL", "ObjectTypeInstanceBelongsToDomain", [["e1", "d1"], ["edead", "d2"]]],
  ["CELL", "ViolationBelongsToDomain", [["v1", "d3"]]],
  ["CELL", "ObjectTypeInstanceIsCurrentlyInStatus", [["edead", "Closed"], ["e1", "Open"]]],
  ["CELL", "StatusIsTerminalInStateMachineDefinition", [["Closed", "M"]]],
  ...CELLS,
];

test("orient answers what a store with reach and terminal statuses attributes", () => {
  expect(orientHolds(SYNTHETIC, "synthetic store")).toBeGreaterThan(0);
});

test("orient's three legs each do something: reach, restriction, terminal", () => {
  // REACH: d1 reaches d2 and d3, so their facts and their Descriptions are
  // d1's orientation -- one rule, not a description rule and a facts rule
  expect(Ev("orient:scope", ["d1", SYNTHETIC]).map(String)).toEqual(["d1", "d2", "d3"]);
  const d1 = orientRows(SYNTHETIC, "d1");
  expect(d1).toContain(key(["d3", "DomainHasDescription", "Grandchild"]));
  expect(d1).toContain(key(["d2", "FactBelongsToDomain", "k1"]));
  expect(d1).toContain(key(["d3", "ViolationBelongsToDomain", "v1"]));

  // RESTRICTION: dx reaches nothing and nothing reaches it, so it is absent
  expect(d1.filter((r) => r.includes("dx") || r.includes("fx"))).toEqual([]);
  // and a leaf answers only its own, which is what makes reach load-bearing
  expect(orientRows(SYNTHETIC, "d3")).toEqual(
    [key(["d3", "DomainHasDescription", "Grandchild"]),
     key(["d3", "FunctionBelongsToDomain", "f3"]),
     key(["d3", "ViolationBelongsToDomain", "v1"])].sort());

  // TERMINAL: `edead` is currently in Closed, which is terminal, so it is gone
  // while `e1` in Open survives -- AREST.tex's logical deletion, compiled as a
  // restriction over the collection view rather than a delete
  expect(Ev("orient:retired", SYNTHETIC).map(String)).toEqual(["edead"]);
  expect(d1).toContain(key(["d1", "ObjectTypeInstanceBelongsToDomain", "e1"]));
  expect(d1.some((r) => r.includes("edead"))).toBe(false);

  // a Domain nobody declared answers nothing, which is the one empty that is
  // correct -- and is why the test above asks whether the store attributes
  // anything before demanding rows
  expect(orientRows(SYNTHETIC, "no-such-domain")).toEqual([]);
});

// ---- IS A store.db A PROJECTION OF *THIS* MODULE? --------------------------
//
// tools/compile-store.js projects the booted populations into store.db and the
// host boots serve and mcp from it, so the database is a projection of ONE
// composition's canon and carriers. Nothing said which. Measured 2026-09-11:
// the base store.db of 09-08 booted into the current module and `schema` threw
// `selector 2 out of range 1` from inside the answer; a database rebuilt from
// the same module answered byte-identically to a carriers boot. The stale one
// differed only in lacking four fact types that had since become populated, so
// no comparison of _meta against the module's own descriptors could have caught
// it -- most declared fact types are unpopulated and have no table either.
//
// The test writes its own three databases rather than reading whatever store.db
// is on disk: an artifact-shaped test skips when the artifact is missing, which
// is a pass that answers nothing. These three are the whole rule.
test("a store.db from another composition is refused rather than loaded", () => {
  const stamp = globalThis.AREST.composition;
  expect(stamp).toMatch(/^[0-9a-f]{16}$/);

  const make = (hash) => {
    const p = join(tmpdir(), "arest-stamp-" + Math.random().toString(36).slice(2) + ".db");
    const db = new Database(p);
    db.run("create table _meta (ft text, kind text, tbl text, arity int)");
    if (hash !== null) {
      db.run("create table _composition (hash text)");
      db.prepare("insert into _composition values(?)").run(hash);
    }
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
    return p;
  };

  const mine = make(stamp), other = make("0000deadbeef0000"), unstamped = make(null);
  try {
    // this module's own stamp loads; _meta is empty, so it reconstructs no cell
    // and the store it was asked about is unchanged
    const before = CELLS.length;
    globalThis.AREST.loadStoreDb(mine);
    expect(CELLS.length).toBe(before);
    // any other answer is a refusal, and the ABSENCE of an answer is one too:
    // a database written before the stamp existed cannot be shown to match, and
    // falling back to the carriers would silently drop every write living in it
    expect(() => globalThis.AREST.loadStoreDb(other)).toThrow(/was built from composition 0000deadbeef0000/);
    expect(() => globalThis.AREST.loadStoreDb(unstamped)).toThrow(/predates the stamp/);
  } finally {
    for (const p of [mine, other, unstamped]) try { unlinkSync(p); } catch { /* left behind */ }
  }
});

// ---- DOES A WRITE REACH THE TABLES, AND ONLY WHEN THERE ARE TABLES? --------
//
// #108's whole claim: the journal is retired because a write emits the changed
// populations into the sqlite tables and the next boot reads them. Nothing
// checked it. The three host callers that do it -- the serve POST, ui:navpe and
// the MCP call -- each run the same four lines, so this runs those four rather
// than a wrapper that could drift: snapshot the populations, evaluate main:api,
// adopt the successor store, emit what changed.
//
// AND THE ABSENCE IS A DIFFERENT ANSWER, not a quiet one. A store booted with
// no database keeps its writes in memory, which is what a test wants and what
// the host says it does; a store booted WITH one must have them on disk
// afterwards. Measured 2026-09-11 on the base store: with a database the write
// emits 1 fact type, the file grows 434,176 -> 438,272 bytes and a fresh boot
// from it has the row; without one the write still answers 201, emits 0, the
// file is byte-identical and a fresh boot has 0 rows. A check that only
// asserted the first half would pass just as happily on a host that had
// silently stopped writing.
//
// The database is BUILT here rather than read from disk: an artifact-shaped
// test skips when the artifact is missing, and an empty _meta also exercises
// the path a fact type takes when it is populated for the first time since the
// tables were built.
test("a write reaches the tables, and a store with no tables keeps it in memory", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-write-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const FT = "StreamHasName", KEY = "probe-stream-" + Math.random().toString(36).slice(2, 8);

  const fresh = (name) => {
    const p = join(dir, name);
    const db = new Database(p);
    db.run("create table _meta (ft text, kind text, tbl text, arity int)");
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
    return p;
  };
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb } = globalThis.AREST;",
    "if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS);",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.KEY, 'probe-name']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) console.log('emitted ' + emitToDb(before, CELLS)); }",
    "  console.log('status ' + out[1]);",
    "} else {",
    "  const rows = Ev('system:pop_rows', [process.env.FT, CELLS]);",
    "  console.log('present ' + rows.some((r) => String(r[0]) === process.env.KEY));",
    "}",
  ].join("\n"));

  const run = (db, write) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, FT, KEY };
    if (db) env.AREST_STORE_DB = db; else delete env.AREST_STORE_DB;
    if (write) env.WRITE = "1"; else delete env.WRITE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  try {
    const withDb = fresh("with.db"), without = fresh("without.db");
    const untouched = readFileSync(without);

    // HOW MANY fact types move is not the claim and is not pinned: against the
    // full base store.db this write emits 1 and against this empty _meta it
    // emits 2, because a carriers boot has more to diff. The claim is that
    // SOMETHING reached the tables, and that the row is there on the next boot.
    const wrote = run(withDb, true);
    expect(wrote).toContain("status 201");
    expect(wrote).toMatch(/emitted [1-9]/);
    expect(run(withDb, false)).toContain("present true");

    // the same write with no database attached: it still answers, emits
    // nothing, leaves the file it was never given alone, and is gone next boot
    const memoryOnly = run(null, true);
    expect(memoryOnly).toContain("status 201");
    expect(memoryOnly).toContain("emitted 0");
    expect(readFileSync(without).equals(untouched)).toBe(true);
    expect(run(without, false)).toContain("present false");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);

// ---- IS EACH CANON FILE STILL INTERSECTION SOURCE? -------------------------
//
// The discipline: one tuple literal per file, every element either a
// DEF(name, tree) call or a double-quoted description string, no comments (the
// comment syntaxes do not intersect), double-quoted strings only, and no
// trailing comma before the file's closing paren.
//
// NOTHING ENFORCED IT after engine/tests went. The check that did --
// test_intersection_shape.py -- approached the property directly, of the bytes,
// and its docstring records why that matters: "a file that four of the five
// hosts accept passes everything, because the fifth host is never pointed at
// it. That is exactly what happened: the ROOT canon accumulated eight `//`
// comment lines -- legal Rust, C#, Java and JS, invalid Python -- while only
// the curated engine/shared/arest.canon was fed to CPython."
//
// It used Python's parser as the strictest reader. With python gone no host
// rejects a `//`, so the rule needs asserting rather than inheriting -- and it
// was already broken: this session's canon carried the forbidden trailing comma
// until the byte check went looking for it.
//
// These are BYTE rules, not a parser. Whether the file PARSES is already proven
// by bun exec'ing the composition; what a parse cannot tell you is whether it
// would still parse somewhere else.
const CANON_FILES = [
  join(import.meta.dir, "..", "..", "arest"),
  join(SHARED, "scenarios.canon"),
];

function outsideStrings(text) {
  // blank every double-quoted span so the scans below cannot see a `//` or a
  // `'` that is part of a description string -- the mistake that made an
  // earlier corpus sweep destroy three rules it was meant to leave alone
  let out = "", inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { out += "  "; i++; continue; }
      if (c === '"') { inStr = false; out += '"'; continue; }
      out += c === "\n" ? "\n" : " ";
      continue;
    }
    if (c === '"') { inStr = true; out += '"'; continue; }
    out += c;
  }
  return out;
}

// ---- DOES EVERY CONSTRUCTOR HOLD WHAT IT WAS GIVEN? ------------------------
//
// Sn is fixed-arity JS -- S2(a, b) { return [a, b]; } -- so S2(a, b, c) returns
// [a, b] and the c is GONE, with no error. This is not a property canon can
// check about itself: by the time a cell exists the constructor has already
// been applied, and the evidence that a fourth argument was written is
// destroyed at load. Only the SOURCE knows, which is why this sits beside the
// byte rules and not in the law report.
//
// It cost a debugging pass in #22. law:reach_out was written S4 with four
// functions after COMP; the fifth -- the CONS that built the operand -- was
// dropped, the closure expanded nothing, and law:reachable came back exactly
// equal to the entry set. That looks like an answer.
//
// Proven to fail before it was shipped: re-injecting that exact S5-to-S4 edit
// reports (4, 5), and turning an S2 into an S3 reports (3, 2). It catches too
// many and too few.
//
// IT SCANNED ONLY Sn, AND THE ONE THAT COST MOST WAS A DEF. 696b6904 rewrote
// six lines of main:links_of into one and dropped a closing paren; the file
// stayed BALANCED because the tuple's own last line had grown a second `)` to
// match, so both the paren count and "ends with )" agreed. What actually
// happened is that DEF swallowed the next 46 elements as extra arguments --
// `DEF(name, body)` ignores them in js, so all 46 still registered, just in
// the wrong ORDER, and 33 commits of green suite went by. rustc found it in
// one line ("this function takes 2 arguments but 48 arguments were supplied")
// because rust has no variadic tolerance, which is the whole argument for
// keeping a strict host in the fleet. So the scan now covers every
// constructor the host declares, DEF included, and the file's element count
// is the tell: 1859 before, 1905 after.
const ARITY = {
  DEF: 2, A: 1, N: 1, K: 1, PHI: 0,
  S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6, S7: 7, S8: 8, S9: 9,
};

function arityMismatches(text) {
  // a constructor NAME inside a note is prose, so call sites are found in the
  // blanked text; outsideStrings is length-preserving, so the indices still
  // point into the real bytes, where the argument scan handles strings itself
  const bare = outsideStrings(text);
  const out = [];
  const re = /\b(DEF|A|N|K|PHI|S[1-9])\(/g;
  let m;
  while ((m = re.exec(bare)) !== null) {
    const want = ARITY[m[1]];
    let i = m.index + m[0].length, depth = 1, inStr = false, args = 1;
    let seen = false;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (inStr) {
        if (c === "\\") { i += 2; continue; }
        if (c === '"') inStr = false;
      } else if (c === '"') { inStr = true; seen = true; }
      else if (c === "(") { depth++; seen = true; }
      else if (c === ")") depth--;
      else if (c === "," && depth === 1) args++;
      else if (!/\s/.test(c)) seen = true;
      i++;
    }
    if (!seen) args = 0;                       // PHI() takes nothing
    if (args !== want) {
      const line = bare.slice(0, m.index).split("\n").length;
      out.push(`line ${line}: ${m[1]} takes ${want}, given ${args}`);
    }
  }
  return out;
}

describe("every constructor holds what it was given", () => {
  for (const file of CANON_FILES) {
    const name = file.split(/[\/]/).pop();
    test(name + " has no truncated constructor", () => {
      expect(arityMismatches(readFileSync(file, "utf8"))).toEqual([]);
    });
  }
});

// ---- EXPLAIN JUSTIFIES EVERY CONCLUSION ------------------------------------
//
// `verify` never touches solve:*, so the law report stayed byte-identical
// through a mis-parenthesised solve:witness and through the fixed (1,2)/(2,3)
// leg split that read a ternary leg as a binary and a nested join's columns as
// its second element's (#97). This is explain's own gate, over whatever store
// the suite was built against: every derived row gets a justification, none
// throws, a head with a rule is never left bare unless every rule it has is a
// count or a flat (no row witnesses those), the first line is a `because` and
// each later one a `because` or an `and`, and no fact witnesses itself -- its
// own sentence never appears as a leg at the next indentation.
describe("explain justifies every conclusion", () => {
  const rules = Ev("solve:rules", CELLS);
  const reads = Ev("solve:readings", CELLS);
  const clos = Ev("solve:closure", CELLS);
  // the path guard empty, and every join recipe's identity relation evaluated
  // once (solve:wits) -- as solve:explain builds it
  const env = [rules, reads, clos, [], Ev("solve:wits", [rules, reads, clos])];
  const bare = (head) =>
    rules.filter((r) => r[0] === head).every((r) => r[2][0] === "count" || r[2][0] === "flat");
  // the property is per row; the first fifty of a head are the gate, so a
  // 730-row head does not cost the suite a minute
  const SAMPLE = 50;
  for (const [head, rows] of clos) {
    if (!rules.some((r) => r[0] === head)) continue;
    test(head + " (" + (rows || []).length + " rows)", () => {
      for (const row of (rows || []).slice(0, SAMPLE)) {
        const said = Ev("solve:say", [reads, head, row]);
        const lines = Ev("solve:just", [env, head, row, "  "]);
        if (bare(head)) continue;
        expect(lines.length).toBeGreaterThan(0);
        expect(lines[0].startsWith("  because ")).toBe(true);
        for (const l of lines.slice(1)) expect(/^ {2,}(because|and) /.test(l)).toBe(true);
        expect(lines).not.toContain("  because " + said);
        expect(lines).not.toContain("  and " + said);
      }
    }, 120000);
  }
});

describe("intersection source", () => {
  for (const file of CANON_FILES) {
    const name = file.split(/[\/]/).pop();
    const text = readFileSync(file, "utf8");
    const bare = outsideStrings(text);

    test(name + " is one tuple literal", () => {
      expect(text.trimStart()[0]).toBe("(");
      expect(text.trimEnd().endsWith(")")).toBe(true);
    });

    test(name + " has no trailing comma before its closing paren", () => {
      expect(text.trimEnd().endsWith(",\n)")).toBe(false);
      expect(/,\s*\)\s*$/.test(text)).toBe(false);
    });

    test(name + " carries no comment syntax", () => {
      // `//` is legal in four hosts and not in the fifth; `#` the other way
      expect(bare.includes("//")).toBe(false);
      expect(/(^|\n)\s*#/.test(bare)).toBe(false);
    });

    test(name + " uses double-quoted strings only", () => {
      expect(bare.includes("'")).toBe(false);
    });

    test(name + " opens no string it does not close on the same line", () => {
      // a note is a SINGLE-LINE literal; a multi-line one is a parse error in
      // every host, and cost this session a whole composed build
      const bad = text.split("\n").filter((l) => (l.match(/(?<!\\)"/g) || []).length % 2);
      expect(bad).toEqual([]);
    });
  }
});
