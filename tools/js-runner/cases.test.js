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
import { readFileSync, readdirSync, unlinkSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
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

// ---- IS AN INSTANCE CREATED AT RUNTIME STILL ONE AFTER A BOOT FROM TABLES? -
//
// That a row READS BACK is the test above; that the store still knows WHAT it
// is, is this one, and the two came apart. `Object Type Instance is instance of
// Object Type` and `Object Type Instance has Reference` (metamodel/instances.md
// 188 and 231) are facts like any other, and the create wrote neither: it
// registered the new id in state:otpops, a design-state cell spliced into the
// module at BUILD time, and nothing else. So the write emitted its own fact into
// the tables, the next boot read it back through system:pop_rows, and ui:ids --
// which the mandatory check, the entry screen and main:status_base all ask --
// answered the population the readings had, without it. Measured 2026-09-16 on
// support.auto.dev: `create` answered committed, `get sr-alpha-1` answered the
// row, and after a restart the same call answered `#` with the four facts still
// in store.db.
//
// THE LEDGER IS SEEDED HERE THE WAY compile-store.js SEEDS IT: a fixture whose
// _asserted holds every row the tables had BEFORE the write under test is a
// fixture where exactly that write is the runtime one, which is what the loader
// has to be able to tell. An empty ledger would test the same path with every
// row of every population looking new.
test("an instance created at runtime is listed after a boot from the tables", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-inst-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const FT = "StreamHasName";
  const PRIME = "probe-prime-" + Math.random().toString(36).slice(2, 8);
  const KEY = "probe-inst-" + Math.random().toString(36).slice(2, 8);

  const path = join(dir, "inst.db");
  const db0 = new Database(path);
  db0.run("create table _meta (ft text, kind text, tbl text, arity int)");
  db0.run("create table _composition (hash text)");
  db0.prepare("insert into _composition values(?)").run(stamp);
  db0.run("create table _asserted (ft text, row text, primary key (ft, row)) without rowid");
  db0.run("pragma wal_checkpoint(TRUNCATE)");
  db0.close();

  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb } = globalThis.AREST;",
    "if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS);",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.WRITE, 'probe-name']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) emitToDb(before, CELLS); }",
    "  console.log('status ' + out[1]);",
    "} else {",
    "  const flat = (v) => { let x = v; while (Array.isArray(x)) x = x.length ? x[0] : null; return x; };",
    "  const ot = String(flat(Ev('main:cr_players', [CELLS, process.env.FT])[0]));",
    "  const inst = Ev('system:pop_rows', ['ObjectTypeInstanceIsInstanceOfObjectType', CELLS]);",
    "  console.log('type ' + ot);",
    "  console.log('fact ' + inst.some((r) => String(flat(r[0])) === process.env.KEY && String(flat(r[1])) === ot));",
    "  console.log('listed ' + Ev('ui:ids', [CELLS, ot]).some((i) => String(flat(i)) === process.env.KEY));",
    "  console.log('row ' + Ev('system:pop_rows', [process.env.FT, CELLS]).some((r) => String(flat(r[0])) === process.env.KEY));",
    "}",
  ].join("\n"));

  const run = (write) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, FT, KEY, AREST_STORE_DB: path };
    if (write) env.WRITE = write; else delete env.WRITE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  try {
    // the fixture's own build: one write, then every row it left is the ledger's
    expect(run(PRIME)).toContain("status 201");
    const db1 = new Database(path);
    const ains = db1.prepare("insert or ignore into _asserted values(?,?)");
    db1.transaction(() => {
      for (const m of db1.query("select ft, kind, tbl from _meta").all()) {
        if (m.kind !== "rel") continue;
        for (const r of db1.query("select * from " + m.tbl).all()) ains.run(m.ft, JSON.stringify(Object.values(r)));
      }
    })();
    db1.run("pragma wal_checkpoint(TRUNCATE)");
    db1.close();

    // and now the write under test, in its own process, read back in a third
    expect(run(KEY)).toContain("status 201");
    const back = run(null);
    expect(back).toContain("fact true");     // the instance fact reached the tables
    expect(back).toContain("listed true");   // and the loaded store knows the id is one
    expect(back).toContain("row true");      // the fact it was created with is there too
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 180_000);

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
    // THE BUDGET IS THE FILE'S, NOT THE DEFAULT'S. This walks every character of
    // canon -- two megabytes, and one more cell of the reader's is nine kilobytes
    // of it -- so bun's 5-second default was a ceiling canon was already touching
    // (5.4 s on 2026-09-17, on a scan that had not changed). A lint over a growing
    // file that fails on the growth says nothing about the file, so it is given
    // room to finish and still fails on what it is for: a constructor holding
    // fewer arguments than its name.
    test(name + " has no truncated constructor", () => {
      expect(arityMismatches(readFileSync(file, "utf8"))).toEqual([]);
    }, 60_000);
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

// ---- IS THE ARITHMETIC TOTAL ON A DECIMAL COLUMN'S DOMAIN? (#109) -----------
//
// THIS IS NOT IN engine/shared/expected-cases.tsv AND MUST NOT BE. That golden
// is the CROSS-HOST agreement surface -- every host asserts every row of it
// (tools/rust-host/src/lib.rs:1651 loops the whole file) -- and the other
// certified hosts have no decimal in their value domain at all:
// tools/rust-host/src/lib.rs:1214 is `fn N(n: i64) -> V`,
// tools/cs-runner/Reader.cs:113 is int.Parse, tools/java-runner/Reader.java:106
// is Integer.parseInt. A decimal case there would make three hosts refuse a row
// this one answers, which is not disagreement about canon but a question canon
// cannot ask them. So these are the js mu's OWN properties, beside the store.db
// and emitToDb tests, and the shared table keeps saying only what all four hosts
// can say.
//
// The defect measured at HEAD (6278af5b), before any of this:
//   * <0.06875, 100000> = 6875.000000000001    not a value of DECIMAL(p, s)
//   * <1.15, 100>       = 114.99999999999999   for any s a model declares
//   + <0.1, 0.2>        = 0.30000000000000004  and + is the sum emitter's fold
//   / <0.3, 0.1>        = 2                    truncation turns a last-bit
//   / <0.29, 0.01>      = 28                   error into a WHOLE UNIT
// Def. 3 admits only a total function, Lemma 1 wants the base operations total
// on their declared domains, and Val is the disjoint union of the value-type
// domains -- of which decimal is one (metamodel/core.md:2083, :2189, and
// Precision / Scale at :1803-1806).
describe("the mu's arithmetic is exact on a decimal value type's domain", () => {
  const ev = (f, x) => Ev(f, x);
  const threw = (f, x) => { try { ev(f, x); return null; } catch (e) { return e.message; } };

  test("* is exact where binary floating point was not", () => {
    expect(ev("*", [0.06875, 100000])).toBe(6875);
    expect(ev("*", [1.15, 100])).toBe(115);
    expect(ev("*", [0.1, 0.2])).toBe(0.02);
    expect(ev("*", [19.99, 3])).toBe(59.97);
  });

  test("+ and - are exact, which is what a sum over a decimal column folds with", () => {
    expect(ev("+", [0.1, 0.2])).toBe(0.3);
    expect(ev("-", [0.3, 0.1])).toBe(0.2);
    // the fold itself: five DECIMAL(10,2) rows, left to right as INSERT runs it
    expect([19.99, 0.07, 1.15, 100.10, 0.01].reduce((a, b) => ev("+", [a, b]), 0)).toBe(121.32);
    // and every partial sum stays inside DECIMAL(., 2) -- the property the
    // declared domain actually asserts, which a single total can pass by luck
    let acc = 0;
    for (const v of [0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07]) {
      acc = ev("+", [acc, v]);
      expect(("" + acc).split(".")[1] === undefined || ("" + acc).split(".")[1].length <= 2).toBe(true);
    }
    expect(acc).toBe(0.7);
  });

  test("/ keeps truncation toward zero and gains exactness", () => {
    // MEASURED AT HEAD, where / was Math.trunc of a FLOATING quotient: these
    // five each came back one short, because 0.3/0.1 is 2.9999999999999996 in
    // binary and truncation is the one operation that turns a last-bit error
    // into a whole unit. It is exact division of the two spellings now.
    expect(ev("/", [0.3, 0.1])).toBe(3);      // HEAD: 2
    expect(ev("/", [0.7, 0.1])).toBe(7);      // HEAD: 6
    expect(ev("/", [0.29, 0.01])).toBe(29);   // HEAD: 28
    expect(ev("/", [6.6, 1.1])).toBe(6);      // HEAD: 5
    expect(ev("/", [0.69, 0.23])).toBe(3);    // HEAD: 2
    // and the MEANING is unchanged -- truncation toward zero, which is what
    // the cs, java and rust hosts' integer division does
    expect(ev("/", [10, 4])).toBe(2);
    expect(ev("/", [-7, 2])).toBe(-3);
    expect(ev("/", [1, 3])).toBe(0);
    expect(ev("/", [19.99, 3])).toBe(6);
    expect(ev("/", [-0.69, 0.23])).toBe(-3);
    expect(threw("/", [5, 0])).toBe("division by zero");
  });

  test("round puts a product back in its column's declared scale", () => {
    // DECIMAL(10,2) x DECIMAL(10,3) is DECIMAL(20,5); the column is still (.,2)
    expect(ev("*", [19.99, 0.075])).toBe(1.49925);
    expect(ev("round", [ev("*", [19.99, 0.075]), 2])).toBe(1.5);
    // half AWAY FROM ZERO, symmetric, which is what SQL DECIMAL's ROUND means
    expect(ev("round", [6.875, 2])).toBe(6.88);
    expect(ev("round", [-6.875, 2])).toBe(-6.88);
    expect(ev("round", [2.5, 0])).toBe(3);
    expect(ev("round", [-2.5, 0])).toBe(-3);
    expect(ev("round", [2.4, 0])).toBe(2);
    // a scale finer than the operand's own answers the operand
    expect(ev("round", [6.875, 5])).toBe(6.875);
    // and a NEGATIVE scale rounds to tens and hundreds, so the one operation
    // covers the integer side too
    expect(ev("round", [1250, -2])).toBe(1300);
    expect(ev("round", [1249, -2])).toBe(1200);
    // it is a function of two numbers and refuses anything else
    expect(threw("round", ["6.875", 2])).toBe("round on non-number");
    expect(threw("round", [6.875, 0.5])).toBe("round to a non-integer scale");
  });

  test("an exact result the host's number domain cannot hold is REFUSED, not approximated", () => {
    // 12345678.90 x 98765432.10 is exactly 1219326311126352.6890, twenty
    // significant digits; a double holds fifteen. The old code answered the
    // nearest double and said nothing, which is the failure mode 19c1ed00
    // names: "not even reliably loud, which is worse than the throw".
    expect(threw("*", [12345678.90, 98765432.10])).toContain("* exceeds the exact decimal domain");
    expect(threw("*", [123456789, 987654321])).toContain("exceeds the exact decimal domain");
    expect(threw("+", [1e300, 1e-300])).toContain("exceeds the exact decimal domain");
    // and the diagnostic names the exact value rather than printing 600 digits
    expect(threw("+", [1e300, 1e-300]).length).toBeLessThan(120);
    // a non-finite operand is in no value type's domain either
    expect(threw("*", [Infinity, 2])).toBe("* on a non-finite number: Infinity");
  });

  test("the integer domain the four hosts share is untouched", () => {
    expect(ev("+", [2, 3])).toBe(5);
    expect(ev("-", [2, 3])).toBe(-1);
    expect(ev("*", [4, 5])).toBe(20);
    expect(ev("/", [7, 2])).toBe(3);
    // the fast path runs to the safe-integer boundary and never builds a BigInt
    expect(ev("+", [Number.MAX_SAFE_INTEGER - 1, 1])).toBe(Number.MAX_SAFE_INTEGER);
    expect(ev("*", [94906265, 94906265])).toBe(9007199136250225);
    // PAST IT THE TEST IS REPRESENTABILITY, NOT SAFETY, and the two differ:
    // 94906266^2 is 9007199326062756, above MAX_SAFE_INTEGER and EVEN, so the
    // double holds it exactly and the exact path hands it back...
    expect(ev("*", [94906266, 94906266])).toBe(9007199326062756);
    // ...while 99999999^2 is 9999999800000001, odd, and the nearest double is
    // 9999999800000000. HEAD answered that, one short, in silence; the rust
    // host's i64 answers 9999999800000001. A double cannot, so this refuses
    // rather than joining HEAD in being quietly wrong.
    expect(threw("*", [99999999, 99999999]))
      .toBe("* exceeds the exact decimal domain: 9999999800000001");
    // and a non-number still refuses by kind, before any of this is reached --
    // which is what a `number`-typed store cell arriving as TEXT hits today
    expect(threw("+", ["2", "3"])).toBe("+ on non-number");
    expect(threw("*", ["4", 5])).toBe("* on non-number");
  });
});

// crypt:genkey mints the master key the other two use. The two properties
// worth pinning are the ones that make it safe to expose over MCP at all: it
// NEVER answers the key (an answer is transcript), and it REFUSES rather than
// overwriting, because a second key silently makes every existing ciphertext
// undecryptable. Neither is observable from the happy path, so both are
// asserted here rather than left to the one manual run that minted the key.
describe("crypt:genkey", () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
  const { join } = require("node:path");
  const { tmpdir } = require("node:os");
  const call = (p) => {
    try { return { ok: globalThis.AREST.Ev("crypt:genkey", [p]) }; }
    catch (e) { return { err: e.message }; }
  };

  test("answers a fingerprint, never the key, and refuses to mint a second", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-genkey-"));
    // BUN AUTO-LOADS .env FROM THE CWD, so once a key has been minted into
    // arest/.env it is live in process.env for every run from this directory
    // and the environment guard below fires first. That guard is correct --
    // minting a file key while an env key is active gives two keys where env
    // silently wins -- so the file half is tested with the ambient one cleared
    // rather than by weakening the guard.
    const ambient = process.env.AREST_MASTER_KEY;
    delete process.env.AREST_MASTER_KEY;
    try {
      // the environment guard itself, asserted rather than assumed
      process.env.AREST_MASTER_KEY = "an-active-key";
      expect(call(join(dir, "never-written.env")).err).toContain("already set in the environment");
      delete process.env.AREST_MASTER_KEY;

      const fresh = join(dir, "fresh.env");
      writeFileSync(fresh, "FOO=bar\n", "utf8");

      const first = call(fresh);
      expect(first.err).toBeUndefined();
      expect(first.ok).toMatch(/^[0-9a-f]{12}$/);

      // the key reached the FILE and not the ANSWER
      const line = readFileSync(fresh, "utf8").split(/\r?\n/)
        .find((l) => l.startsWith("AREST_MASTER_KEY="));
      expect(line).toBeDefined();
      const key = line.slice("AREST_MASTER_KEY=".length);
      expect(key.length).toBeGreaterThan(40);          // 32 random bytes, base64
      expect(first.ok).not.toContain(key);
      expect(key).not.toContain(first.ok);

      // a second mint would orphan every ciphertext made under the first
      expect(call(fresh).err).toContain("already in");

      // and a file that arrived with one is refused on the first call
      const had = join(dir, "had.env");
      writeFileSync(had, "AREST_MASTER_KEY=already-here\n", "utf8");
      expect(call(had).err).toContain("already in");
    } finally {
      if (ambient === undefined) delete process.env.AREST_MASTER_KEY;
      else process.env.AREST_MASTER_KEY = ambient;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// THE PAIRING HALF, MADE TO FAIL (#108). law:origin_boundary took <store,
// registered-names> so a container could be asked whether it has a native
// control for every abstract kind the store declares registered -- and then
// law:report and law:app_report passed PHI, which the law reads as "not a
// platform, owes no pairing" and answers T. So the pairing half shipped
// without ever having run over a real set anywhere the suite could see it.
// The java container asks (Gui.java:439) and the two js containers now do too
// (host.js pairing_gate), and this is where the law is shown to FAIL: it is
// handed a set with one kind removed and has to name that kind. A law that
// only ever answers T over PHI is not a law, it is a row.
describe("law:paired over a container's registration set", () => {
  // the HTML container's own list, verbatim from host.js run_ui
  const HTML = ["canvas", "headerbar", "titletext", "backbtn", "sectionheader",
                "itemrow", "sep", "blocktext", "textbox", "button",
                "selectlist", "navigationfield", "numericfield", "datepicker",
                "timepicker", "switch", "textarea", "imagepicker", "label"]
                .map((c) => "render:" + c);

  test("the container that serves HTML pairs every declared control kind", () => {
    const declared = Ev("law:ctl_declared", CELLS).map(String);
    expect(declared.length).toBeGreaterThan(0);        // an empty set pairs vacuously
    expect(Ev("law:unpaired", [CELLS, HTML])).toEqual([]);
    expect(Ev("law:paired", [CELLS, HTML])).toBe("T");
  });

  test("a container missing one native control is refused, by name", () => {
    const short = HTML.filter((n) => n !== "render:itemrow");
    expect(Ev("law:paired", [CELLS, short])).toBe("F");
    expect(Ev("law:unpaired", [CELLS, short]).map(String)).toEqual(["render:itemrow"]);
  });

  test("a caller that is not a platform owes no pairing", () => {
    // what law:report and law:app_report pass; the verdict is the store half
    expect(Ev("law:paired", [CELLS, []])).toBe("T");
  });
});

// ---- THE READER IS CANON, AND THE ORACLE IS ITS WITNESS -------------------
//
// Sam, 2026-09-15: "I don't want to be dependent on NORMA. I'm developing
// AREST. AREST needs to provide all functionality." So the FORML reader is
// canon end to end -- text in, sentences (read:sentences), tokens
// (read:row_of), the populated conceptual schema (read:parse) -- and the C#
// oracle is consulted only as the witness it is named for: its cells are
// already composed into this module, so the comparison is Ev against Ev, and
// nothing here runs NORMA. The numbers below are the measurement, not a hope:
// they are pinned as a RATCHET, so this test fails on every improvement until
// it is re-pinned, which is the only way a golden can be honest about a
// reader that is still closing a distance.
describe("canon's reader against the witness, on the base metamodel", () => {
  const { DEFS } = globalThis.AREST;
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const files = readdirSync(META).filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b));

  // read:lines has a fast twin in this host -- one native pass where the DEF is
  // an interpreted one, now that the DEF reads its input as a theta:stream and
  // is no longer quadratic through tl. The DEF is the meaning either way, and
  // its compiled form is evaluated here beside the twin, on text that exercises
  // every branch: a comment closed with a space, a comment across lines, a
  // carriage return, a trailing empty line.
  test("the read:lines twin is its DEF", () => {
    const text = "a b <!-- c. -->\r\nd\n<!-- e\nf --> g\r\n\nh";
    const chars = Ev("chars", text);
    const twin = Ev("read:lines", chars);
    const def = Ev(DEFS.get("read:lines"), chars);
    expect(JSON.stringify(twin)).toBe(JSON.stringify(def));
    expect(twin.map((l) => l.join(""))).toEqual(["a b  ", "d", "  g", "", "h"]);   // the close adds one space and the source has its own
  });

  test("read:sentences reads the oracle's sentences", () => {
    // the rules ExtractSentences enforces, each on one line
    const text = [
      "# A heading", "",
      "Widget(.id) is an entity type. Colour is a value type.  <!-- a comment. with a period -->",
      "Widget has Colour.", "  Each Widget has at most one Colour. **", "",
      "Rule 'e.g. this' cites Citation 'Art. 28'. Widget weighs 10.3 kg per Art. 28 of the code.",
      "| a | table |", "```", "code. block.", "```", "Widget is a subtype of Thing", "",
    ].join("\r\n");
    expect(Ev("read:sentences", text)).toEqual([
      "Widget(.id) is an entity type.", "Colour is a value type.", "Widget has Colour.",
      "** Each Widget has at most one Colour.",
      "Rule 'e.g. this' cites Citation 'Art. 28'.", "Widget weighs 10.3 kg per Art. 28 of the code.",
      "code.", "block.",   // a fence ends a paragraph; the lines inside it are lines, as ExtractSentences reads them
      "Widget is a subtype of Thing",
    ]);
  });

  test("the reader reproduces the witness's schema, to the pinned distance", () => {
    const rows = [];
    for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const out = Ev("read:parse", rows);
    const J = (x) => JSON.stringify(x);
    const O = new Map(Ev("store:fts", CELLS).map((d) => [String(d[0]), d]));
    const D = new Map(Ev("ast:fetch", ["state:declared", CELLS]).flat(1).map((d) => [String(d[0]), d]));
    const C = new Map(out[1].map((d) => [String(d[0]), d]));
    const derO = new Set(Ev("ast:fetch", ["state:derived", CELLS]).flat(1).map((r) => String(r[0])));
    const derC = new Set(out[2].filter((r) => Array.isArray(r[2]) && String(r[2][0]) === "derived").map((r) => String(r[0])));
    let both = 0, players = 0, ucs = 0, mands = 0, all = 0;
    for (const [n, c] of C) { const o = O.get(n); if (!o) continue; both++;
      const p = D.has(n) && J(c[1]) === J(D.get(n)[1]), u = J(c[2]) === J(o[2]), m = J(c[3]) === J(o[3]);
      players += p; ucs += u; mands += m; all += p && u && m; }
    const canonOnly = [...C.keys()].filter((n) => !O.has(n)), oracleOnly = [...O.keys()].filter((n) => !C.has(n));
    const derBoth = [...derC].filter((n) => derO.has(n)).length;
    // the rows as the carrier holds them (state:fts, chunked by nine), in its order; store:fts unfolds them
    const R = new Map(Ev("ast:fetch", ["state:fts", CELLS]).flat(1).map((d) => [String(d[0]), d]));
    const rowsEq = [...C.values()].filter((d) => R.has(String(d[0])) && J(d[4]) === J(R.get(String(d[0]))[4])).length;
    const rejected = out[2].filter((r) => Array.isArray(r[2]) && String(r[2][0]) === "rejected").length;
    // the state canon writes (the ten synthesized populations included) and its uniqueness rows, against the carrier's
    const X = Ev("read:x_of", rows); const S = Ev("read:state_fts", X);
    const stateRows = S.filter((d) => R.has(String(d[0])) && J(d) === J(R.get(String(d[0])))).length;
    const U = new Set(Ev("ast:fetch", ["state:ucs", CELLS]).flat(1).map(J)); const stateUcs = Ev("read:state_ucs", X).filter((r) => U.has(J(r))).length;
    // the witness predates metamodel/verbalization.md and the orient and tutor
    // operations (2026-09-16): canon reads four descriptors the witness lacks
    // (Verbalization Pattern's fact types), and the rows of three operation fact
    // types and of the reflected populations they touch (kinds, instances,
    // references, data type, declaration order, subtype, reference mode, enum
    // values) moved with them; the distance below is measured after that change
    // AND IT ALSO PREDATES evolution.md's SELF-MODIFICATION GATE (2026-09-17).
    // That sentence named `Human`, a type that plays no role in any fact type,
    // so NORMA refused it and the witness carries nothing for it; restated
    // against `User`, the type that plays the role of `User approves Domain
    // Change`, canon resolves it and the deontic `exactly one` lands on
    // UserApprovesDomainChange exactly as the witness's own deontic `at most
    // one` lands on MigrationApplicationHasTimestamp -- a uniqueness ON THE
    // DESCRIPTOR ([[1,2]] becomes [[1,2],[2]]) beside the DEO:u row, which is
    // the oracle's own behaviour and not a canon divergence. So ucs, all and
    // stateRows are each one below the witness for that one fact type, and
    // regenerating the witness (the oracle's run, not this repo's) closes it.
    // the pinned distance (2026-09-16); every number is a floor, and a change
    // in either direction is a finding, not noise
    expect({ witness: O.size, canon: C.size, both, canonOnly: canonOnly.length, oracleOnly: oracleOnly.length,
             players, ucs, mands, all, rows: rowsEq, rejected, derived: [derO.size, derC.size, derBoth], stateRows, stateUcs })
      .toEqual({ witness: 257, canon: 261, both: 257, canonOnly: 4, oracleOnly: 0,
                 players: 257, ucs: 256, mands: 257, all: 256, rows: 244, rejected: 0, derived: [37, 37, 37], stateRows: 245, stateUcs: 624 });
  }, 300_000);

  // state:deontics, row for row (task #93, 2026-09-16). The witness builds 12 of
  // the base metamodel's 37 deontic sentences -- 8 mandatory, 1 uniqueness, 3
  // prohibited -- and the carrier canon writes must hold the same 12 rows, key,
  // kind and legs, in both directions; the rows are listed by name on a miss.
  // AND TWO MORE SINCE THE SELF-MODIFICATION GATE WAS RESTATED (2026-09-17,
  // #108). `It is obligatory that each applied Domain Change is approved by
  // exactly one Human` named a type that plays no role in any fact type, so
  // NEITHER reader carried it and the gate was enforced nowhere. Against
  // `User` -- what plays the role of `User approves Domain Change` -- the
  // `exactly one` reads as the pair it is: DEO:m (every applied change has an
  // approval) and DEO:u (no second approver) on the Domain Change role, keyed
  // through the objectification's link fact type as read:deo_nest_leg has it.
  // The two rows are canonOnly because the witness carrier predates the
  // restatement; regenerating it is the oracle's run, not this repo's, and
  // oracleOnly stays empty, which is the direction that would mean a loss.
  test("canon's state:deontics is the witness's, row for row", () => {
    const rows = [];
    for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const J = (x) => JSON.stringify(x);
    const cells = new Map(Ev("read:design_state_of", rows).map((c) => [String(c[0]), c[1]]));
    const canon = (cells.get("state:deontics") || []).map(J);
    const witness = Ev("ast:fetch", ["state:deontics", CELLS]).flat(1).map(J);
    const W = new Set(witness), C = new Set(canon);
    expect({ witness: witness.length, canon: canon.length,
             oracleOnly: witness.filter((r) => !C.has(r)), canonOnly: canon.filter((r) => !W.has(r)) })
      .toEqual({ witness: 12, canon: 14, oracleOnly: [], canonOnly: [
        JSON.stringify(["DEO:m:DomainChangeIsInvolvedInUserApprovesDomainChange#1", "mandatory", [["DomainChangeIsInvolvedInUserApprovesDomainChange", 1]]]),
        JSON.stringify(["DEO:u:DomainChangeIsInvolvedInUserApprovesDomainChange#1", "uniqueness", [["DomainChangeIsInvolvedInUserApprovesDomainChange", 1]]]),
      ] });
  }, 300_000);

  // THE RULES THE READER CARRIES (#109). state:rules was written EMPTY until
  // 2026-09-16: the reader recognised a derivation sentence and kept its
  // clauses, and nothing compiled them into the recipe derive runs, so every
  // carrier canon wrote had its heads marked and no deliverer. The compiler is
  // the read:rule_* family -- the oracle's arm sequence, read from the reader's
  // own records -- and this pins its answer against the witness's rows compared
  // as SETS of recipe trees in both directions (the trees are what derive
  // evaluates), and the heads the witness lists undelivered against the ones
  // canon lists with a reason of its own naming. Pinned before the compiler
  // existed it failed at canon 0 of 44. The witness writes two of its 46 rows
  // twice (its `and no ... where` arm re-emits what an earlier arm built);
  // canon writes each row once, so the raw witness count is pinned beside it.
  test("the reader carries the witness's derivation rules, row for row", () => {
    const rows = [];
    for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const F = Ev("read:x_full", Ev("read:x_of", rows));
    const J = (x) => JSON.stringify(x);
    const witness = Ev("ast:fetch", ["state:rules", CELLS]).flat(1);
    const W = new Set(witness.map(J));
    const canon = Ev("read:state_rules", F);
    const C = new Set(canon.map(J));
    const both = [...C].filter((r) => W.has(r)).length;
    const und = Ev("read:state_undelivered", F);
    expect({ witnessRows: witness.length, witness: W.size, canon: canon.length, distinct: C.size, both, canonOnly: C.size - both, witnessOnly: W.size - both,
             undelivered: und.map((p) => String(p[0])), reasons: und.every((p) => typeof p[1] === "string" && p[1].length > 0),
             witnessUndelivered: Ev("ast:fetch", ["state:undelivered", CELLS]).flat(1).map((p) => String(p[0])) })
      .toEqual({ witnessRows: 46, witness: 44, canon: 44, distinct: 44, both: 44, canonOnly: 0, witnessOnly: 0,
                 undelivered: ["FactJoinsFact", "ObjectTypeHasWorldAssumption"], reasons: true,
                 witnessUndelivered: ["FactJoinsFact", "ObjectTypeHasWorldAssumption"] });
  }, 300_000);
});

// ---- THE GENERAL CHAIN (the witness's @6042) ------------------------------
//
// The arms that landed with the compiler each know a shape: a two-leg join, a
// star, a negation, a comparison. What none of them read is the body that is
// simply a PATH -- `User accesses Domain if User owns Organization and App
// belongs to that Organization and Domain belongs to that App` -- three legs
// meeting at no one centre, which the witness walks as one chain and this arm
// now walks too: each leg joined on every token it shares with what is already
// joined, every column kept so the head stays addressable, a substituted
// subtype joined with its own extent, a negated leg subtracted as an
// anti-join, and the head read off the accumulator by token. The recipe trees
// below are the witness's own, copied from the served apps' carriers
// (.check/design-state): the three chains and the membership leg from
// arest-dev, the anti-join from its `Fact Type is inert`.
describe("canon's reader carries the witness's general chain", () => {
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const TEMPLATES = join(import.meta.dir, "..", "..", "readings", "templates");
  const order = (a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b);
  const J = (x) => JSON.stringify(x);

  function rulesOf(dirs) {
    const rows = [];
    for (const d of dirs) for (const f of readdirSync(d).filter((f) => f.endsWith(".md")).sort(order))
      for (const s of Ev("read:sentences", readFileSync(join(d, f), "utf8"))) rows.push(Ev("read:row_of", s));
    return Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows)));
  }

  test("the chain's pieces: every shared token is a key, a negation is an anti-join", () => {
    // two legs sharing two tokens join on both, keyed on each token's first column
    expect(Ev("read:rule_gchain_keys", [["User", "Organization", "App", "Organization"], ["App", "Organization"]]))
      .toEqual([[3, 1], [2, 2]]);
    expect(Ev("read:rule_gchain_keys", [["Authority", "Message", "Support Request", "Customer"], ["Customer", "Authority"]]))
      .toEqual([[4, 1], [1, 2]]);
    expect(Ev("read:rule_gchain_keys", [["Fact Type", "Derivation Mode"], ["Reading"]])).toEqual([]);
    // a negated leg resolves positively and carries a flag
    expect(Ev("read:rule_gchain_neg", ["Fact", "Type", "is", "not", "delivered"]))
      .toEqual(["T", ["Fact", "Type", "is", "delivered"]]);
    expect(Ev("read:rule_gchain_neg", ["Authority", "has", "no", "Supersession", "Date"]))
      .toEqual(["T", ["Authority", "has", "Supersession", "Date"]]);
    expect(Ev("read:rule_gchain_neg", ["it", "is", "not", "true", "that", "Operation", "is", "registered"]))
      .toEqual(["T", ["Operation", "is", "registered"]]);
    expect(Ev("read:rule_gchain_neg", ["App", "belongs", "to", "that", "Organization"]))
      .toEqual(["F", ["App", "belongs", "to", "that", "Organization"]]);
    // `Fact Type is inert iff Fact Type has some Derivation Mode and Fact Type is
    // not delivered` (arest-dev/readings/build-surface.md), as arest-dev's carrier writes it
    expect(J(Ev("read:rule_gchain_anti", ["FactTypeHasDerivationMode", ["Fact Type", "Derivation Mode"],
                                          ["FactTypeIsDelivered", ["Fact Type"]]])))
      .toBe(J(["minus", "FactTypeHasDerivationMode",
               ["joinon", "FactTypeHasDerivationMode", "FactTypeIsDelivered", [[1, 1]], [1, 2]]]));
    // a leg sharing nothing with the body would subtract everything or nothing
    expect(Ev("read:rule_gchain_anti", ["FactTypeHasDerivationMode", ["Fact Type", "Derivation Mode"], ["ReadingIsPrimary", ["Reading"]]]))
      .toEqual([]);
  });

  test("the reader walks the templates' chains as the witness does", () => {
    const rules = rulesOf([META, TEMPLATES]);
    const treesOf = (h) => rules.filter((r) => String(r[0]) === h).map((r) => J(r[2])).sort();
    // three arms of one head, each a three-leg path (arest-dev/.check/design-state)
    expect(treesOf("UserAccessesDomain")).toEqual([
      ["UserAdministersOrganization", "UserBelongsToOrganization", "UserOwnsOrganization"].map((first) =>
        J(["proj", ["joinon", ["joinon", first, "AppBelongsToOrganization", [[2, 2]], [1, 2, 3, 4]],
                    "DomainBelongsToApp", [[3, 2]], [1, 2, 3, 4, 5, 6]], [1, 5]])),
    ].flat().sort());
    // `App displays Object Type if App navigates Domain and Object Type belongs to
    // that Domain`: the second leg only resolves through the declared supertype
    // (Function belongs to Domain), so the subtype's extent is joined on the
    // substituted column and only the accumulator's own columns are kept
    expect(treesOf("AppDisplaysObjectType")).toEqual([
      J(["proj", ["joinon", ["joinon", "AppNavigatesDomain", "FunctionBelongsToDomain", [[2, 2]], [1, 2, 3, 4]],
                  ["sel", "ObjectTypeInstanceIsInstanceOfObjectType", 2, "Object Type"], [[3, 1]], [1, 2, 3, 4]], [1, 3]]),
    ]);
  }, 300_000);
});

// ---- THE CONSTRAINT CELLS THE STORE CONSUMES, AND THE ORDERING CELL --------
//
// Canon's reader wrote 17 of the 29 design-state cells the witness writes, and
// five of the twelve it did not write are the ones a STORE reads: state:otpops
// is ui:ids, so every mandatory verdict ranged over an empty population and 16
// laws bottomed on `#`; state:exclusions is law:exclusion and cmd:excl_viols;
// state:rings is solve:rings; state:setcmp is cmd:sc_rows; state:qualifiers is
// the rendered role label. state:factorder is cn:foidx, the ordinal every
// relational constraint name is numbered by. Each is pinned here against the
// witness as a SET in both directions and, where the oracle's own order is
// reproducible, position for position.
//
// THE WITNESS PREDATES metamodel/verbalization.md and the orient and tutor
// operations (2026-09-16), exactly as the schema test above records: canon
// reads six fact types and six object types the witness has never seen, so the
// distance below is stated as "every witness row, and canon's own newer ones
// named". A change in either direction is a finding, not noise.
describe("canon's constraint cells against the witness, on the base metamodel", () => {
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const files = readdirSync(META).filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b));
  const rows = [];
  for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
  const F = Ev("read:x_full", Ev("read:x_of", rows));
  const J = (x) => JSON.stringify(x);
  const witness = (name) => Ev("ast:fetch", [name, CELLS]).flat(1);

  // row for row and in the oracle's own order: the ring sentences in the order
  // the corpus states them, the hyphen-bound qualifiers per fact type, the
  // subtype exclusions as scope lists
  for (const [cell, name, n] of [["read:ring_state", "state:rings", 6],
                                 ["read:qual_state", "state:qualifiers", 3],
                                 ["read:excl_state", "state:exclusions", 2]]) {
    test("canon's " + name + " is the witness's, row for row", () => {
      const w = witness(name).map(J), c = Ev(cell, F).map(J);
      const W = new Set(w), C = new Set(c);
      expect({ witness: w.length, canon: c.length, order: J(w) === J(c),
               oracleOnly: w.filter((r) => !C.has(r)), canonOnly: c.filter((r) => !W.has(r)) })
        .toEqual({ witness: n, canon: n, order: true, oracleOnly: [], canonOnly: [] });
    }, 300_000);
  }

  // THE POPULATIONS ui:ids READS. Every object type the witness carries, with
  // the same values in the same (ordinal) order -- except where canon reads a
  // sentence the witness predates, which can only ADD instances, so the witness's
  // list must be a PREFIX-FREE SUBSET of canon's and the three types that grew
  // are named. 36 witness types, 41 canon types.
  test("canon's state:otpops carries the witness's populations", () => {
    const W = new Map(witness("state:otpops").map((r) => [String(r[0]), r[1].flat(1).map(String)]));
    const C = new Map(Ev("read:otpops_state", F).map((r) => [String(r[0]), r[1].flat(1).map(String)]));
    const missing = [...W.keys()].filter((k) => !C.has(k));
    const same = [...W].filter(([k, v]) => C.has(k) && J(v) === J(C.get(k))).length;
    const grew = [...W].filter(([k, v]) => C.has(k) && J(v) !== J(C.get(k)));
    expect({ witness: W.size, canon: C.size, missing, same,
             grew: grew.map(([k]) => k),
             contained: grew.every(([k, v]) => v.every((x) => C.get(k).includes(x))),
             newTypes: [...C.keys()].filter((k) => !W.has(k)) })
      .toEqual({ witness: 36, canon: 41, missing: [], same: 33,
                 grew: ["Function", "Operation", "Type Expression"], contained: true,
                 newTypes: ["Pattern Example", "Pattern Family", "Pattern Form", "Pattern Note", "Verbalization Pattern"] });
  }, 300_000);

  // THE ORDER IS THE ROW, so the ordinal is only meaningful against the same
  // set of fact types: canon's sequence restricted to the ones the witness has
  // is the witness's sequence, and the six it adds are named.
  test("canon's state:factorder is the witness's sequence", () => {
    const w = witness("state:factorder").map((r) => String(r[0]));
    const c = Ev("read:order_state", F);
    const WN = new Set(w);
    const kept = c.filter((r) => WN.has(String(r[0])));
    expect({ canon: c.length, witness: w.length, kept: kept.length,
             sequence: J(kept.map((r) => String(r[0]))) === J(w),
             renumbered: J(kept.map((r, i) => [String(r[0]), i + 1])) === J(witness("state:factorder").map((r) => [String(r[0]), r[1]])),
             canonOnly: c.filter((r) => !WN.has(String(r[0]))).map((r) => String(r[0])) })
      .toEqual({ canon: 507, witness: 501, kept: 501, sequence: true, renumbered: true,
                 canonOnly: ["VerbalizationPatternHasVerbalizationPatternName", "VerbalizationPatternIsInPatternFamily",
                             "VerbalizationPatternHasPatternForm", "VerbalizationPatternHasPatternExample",
                             "VerbalizationPatternHasPatternNote", "Verbalization PatternIsASubtypeOfFunction"] });
  }, 300_000);

  // and the assembler carries them: the design state canon writes holds every
  // cell it used to hold and these beside them
  test("read:design_state names the new cells", () => {
    const names = Ev("read:design_state_of", rows).map((c) => String(c[0]));
    expect(names.filter((n) => ["state:otpops", "state:rings", "state:qualifiers", "state:exclusions", "state:factorder"].includes(n)))
      .toEqual(["state:otpops", "state:rings", "state:qualifiers", "state:exclusions", "state:factorder"]);
  }, 600_000);
});

// ---- THE GENERAL CHAIN'S TWO LAST SHAPES: AN EQUALITY THAT NAMES A ROLE, AND
// A LEG THAT CARRIES ITS OWN VALUE ------------------------------------------
//
// Both are the oracle's @6042 and both were a decline here. `... and Description
// is Message Body` names no fact type, so the leg-or-nothing resolution threw
// the sentence away; and a quoted value anywhere in the sentence declined the
// arm outright, so a leg the corpus writes as `that Meter Endpoint has
// Identifier Sensitivity 'plate-identifier'` could not be read at all. Six of
// support.auto.dev's Support Request fields were the first, three heads across
// auto.dev and support.auto.dev the second.
//
// The fixtures are the ORACLE'S OWN TREES, copied from the app carriers
// (apps/support.auto.dev/.check/design-state and apps/auto.dev/.check/design-state,
// state:rules) and reproduced here over a corpus small enough to read: the same
// readings, the same rule sentences, the same recipe. A rule sentence is fed to
// the reader whole -- read:sentences, read:row_of, read:x_of, read:x_full,
// read:state_rules -- so this exercises the arm through the door an app uses.
describe("canon's reader reads an alias and a leg's own value", () => {
  const J = (x) => JSON.stringify(x);
  const rulesOf = (text) => {
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    return Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows)));
  };
  const VOCAB = [
    "# The chain's last two shapes", "",
    "Contact Submission is an entity type.",
    "Support Request is an entity type.",
    "Message Body is a value type.",
    "Description is a value type.",
    "Customer is an entity type.",
    "Meter Endpoint is an entity type.",
    "Identifier Sensitivity is a value type.",
    "Billable Request is an entity type.",
    "Trust Score is a value type.",
    "Authenticated Trust Score is a value type.",
    "Request Context is an entity type.", "",
    "Contact Submission has Message Body.",
    "Support Request is Contact Submission.",
    "Support Request has Description. +",
    "Billable Request has Customer.",
    "Customer is in EEA.",
    "Billable Request has Meter Endpoint.",
    "Meter Endpoint has Identifier Sensitivity.",
    "Billable Request involves Personal Data. *",
    "Request Context belongs to Customer.",
    "Customer is authenticated.",
    "Request Context has Trust Score. *", "", "",
  ].join("\n");

  // `<Type> is|equals <Type>` naming no fact type equates two declared names; a
  // role prefix (`contact- Name`) is stripped so the answer is the player the
  // head carries, and a name the model never declared is not an alias at all
  test("an equality between two declared type names is an alias", () => {
    const C = [[], ["Description", "Message Body", "Name", "Submitter Name", "Trust Score", "Issue Type"], [], [], [], []];
    expect(Ev("read:rule_gchain_alias", [C, ["Description", "is", "Message", "Body"]])).toEqual(["Description", "Message Body"]);
    expect(Ev("read:rule_gchain_alias", [C, ["contact", "-", "Name", "is", "Submitter", "Name"]])).toEqual(["Name", "Submitter Name"]);
    expect(Ev("read:rule_gchain_alias", [C, ["Trust", "Score", "is", "that", "Issue", "Type"]])).toEqual(["Trust Score", "Issue Type"]);
    // a side the model never declared is not a name this arm may project from
    expect(Ev("read:rule_gchain_alias", [C, ["Category", "equals", "Issue", "Type"]])).toEqual([]);
    expect(Ev("read:rule_gchain_alias", [C, ["Support", "Request", "is", "Contact", "Submission"]])).toEqual([]);
    // and a clause with nothing on one side of the verb is not an equality
    expect(Ev("read:rule_gchain_alias", [C, ["is", "Message", "Body"]])).toEqual([]);
    expect(Ev("read:rule_gchain_alias", [C, ["Description", "is"]])).toEqual([]);
  });

  // the fold answers a column for every request a leg makes: a value restriction
  // is <literal, position> on its leg and comes back <literal, absolute column>,
  // and read:rule_gchain_sels lays one `sel` per restriction, innermost first
  test("the fold places a leg's value and read:rule_gchain_sels selects on it", () => {
    const folded = Ev("read:rule_gchain_fold", [
      ["BillableRequestHasCustomer", ["Billable Request", "Customer"], [], []],
      ["CustomerIsInEEA", ["Customer"], [], []],
      ["BillableRequestHasMeterEndpoint", ["Billable Request", "Meter Endpoint"], [], []],
      ["MeterEndpointHasIdentifierSensitivity", ["Meter Endpoint", "Identifier Sensitivity"], [], ["plate-identifier", 2]],
    ]);
    expect(J(folded[0])).toBe(J(["joinon", ["joinon", ["joinon", "BillableRequestHasCustomer", "CustomerIsInEEA", [[2, 1]], [1, 2, 3]],
                                            "BillableRequestHasMeterEndpoint", [[1, 1]], [1, 2, 3, 4, 5]],
                                 "MeterEndpointHasIdentifierSensitivity", [[5, 1]], [1, 2, 3, 4, 5, 6, 7]]));
    expect(J(folded[1])).toBe(J(["Billable Request", "Customer", "Customer", "Billable Request", "Meter Endpoint", "Meter Endpoint", "Identifier Sensitivity"]));
    expect(J(folded[3])).toBe(J([["plate-identifier", 7]]));
    expect(J(Ev("read:rule_gchain_sels", ["ACC", folded[3]]))).toBe(J(["sel", "ACC", 7, "plate-identifier"]));
    expect(J(Ev("read:rule_gchain_sels", ["ACC", [["gold", 3], ["eu", 5]]])))
      .toBe(J(["sel", ["sel", "ACC", 3, "gold"], 5, "eu"]));
    expect(J(Ev("read:rule_gchain_sels", ["ACC", []]))).toBe(J("ACC"));
  });

  // apps/support.auto.dev/.check/design-state, state:rules: the head's second
  // role is bound by no leg -- the equality says it is the Message Body the
  // first leg bound, and the projection reads it there
  test("a head role an equality defines projects from the column its other side bound", () => {
    const text = VOCAB + "+ Support Request has Description iff that Contact Submission has Message Body and Support Request is Contact Submission and Description is Message Body.\n";
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["SupportRequestHasDescription", ["Support Request", "Description"],
         ["proj", ["joinon", "ContactSubmissionHasMessageBody", "SupportRequestIsContactSubmission", [[1, 2]], [1, 2, 3, 4]], [3, 2]]]),
    ]);
  }, 300_000);

  // apps/auto.dev/.check/design-state, state:rules: four legs joined on every
  // token each shares, the fourth leg's quoted value selected on its column
  test("a leg's own value restriction is a sel on the joined rows", () => {
    const text = VOCAB + "* Billable Request involves Personal Data iff Billable Request has some Customer and that Customer is in EEA and Billable Request has some Meter Endpoint and that Meter Endpoint has Identifier Sensitivity 'plate-identifier'.\n";
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["BillableRequestInvolvesPersonalData", ["Billable Request"],
         ["proj", ["sel", ["joinon", ["joinon", ["joinon", "BillableRequestHasCustomer", "CustomerIsInEEA", [[2, 1]], [1, 2, 3]],
                                      "BillableRequestHasMeterEndpoint", [[1, 1]], [1, 2, 3, 4, 5]],
                           "MeterEndpointHasIdentifierSensitivity", [[5, 1]], [1, 2, 3, 4, 5, 6, 7]], 7, "plate-identifier"], [1]]]),
    ]);
  }, 300_000);

  // AND THE ALIAS WHOSE OTHER SIDE NO LEG BINDS IS STILL NOT A RULE. `Trust
  // Score is Authenticated Trust Score` names a value type carrying its value as
  // a population, so nothing in the body binds it; the oracle records no recipe
  // for that rule (`a head role from a bare type root`) and neither does this --
  // the head's column is 0 and the arm declines, which is the honest answer
  // rather than a projection from a column that is not there.
  test("an alias onto a bare value type is no recipe", () => {
    const text = VOCAB + "* Request Context has Trust Score iff Request Context belongs to some Customer and that Customer is authenticated and Trust Score is Authenticated Trust Score.\n";
    expect(rulesOf(text)).toEqual([]);
  }, 300_000);
});

// ================================================================================
// THE KIND A ROLE PLAYS, AND THE ROWS THAT NEED IT (task #109). The reader read
// `The data type of Sales Tax Rate Percentage is decimal` and the rules compiler
// could not reach it, so a numeral beside a typed role was written as the atom the
// reading wrote and every arithmetic, comparison and threshold touching one was
// declined. read:kind_* is the oracle's ValueKindOf/ICell pair (Verifier.cs:14179,
// 14220) over the rows x_full already carries, and read:rule_context hands them to
// the arms. The recipe fixtures below are the ORACLE'S OWN TREES, copied from
// apps/auto.dev/.check/design-state and apps/support.auto.dev/.check/design-state.
// ================================================================================
describe("canon's reader reads a value type's kind and the rows that need it", () => {
  const J = (x) => JSON.stringify(x);
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const order = (a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b);
  const rulesOf = (text) => {
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    return Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows)));
  };

  // tools/norma-oracle/design-state, state:fts: the ObjectTypeHasConceptualDataType
  // population the oracle synthesises from the declarations it parsed. BOTH
  // DIRECTIONS -- a kind the reader invents is as wrong as one it drops.
  // verbalization.md is left out because the oracle's base carrier does not carry
  // it: it holds no Verbalization Pattern row at all, and its four value types are
  // the only rows the two sides would differ by.
  const WITNESS_KINDS = [
    ["Modality Type","text"], ["World Assumption","text"], ["URL","text"],
    ["Secret Reference","text"], ["Reference Mode","text"], ["Arity","integer"],
    ["Position","integer"], ["Sequence Number","integer"], ["Min Occurrence","integer"],
    ["Max Occurrence","integer"], ["Name","text"], ["Plural","text"],
    ["Object Kind","text"], ["Enum Values","text"], ["Minimum","decimal"],
    ["Maximum","decimal"], ["Exclusive Minimum","decimal"], ["Exclusive Maximum","decimal"],
    ["Multiple Of","decimal"], ["Min Length","integer"], ["Max Length","integer"],
    ["Pattern","text"], ["Local Name","text"], ["Description","text"],
    ["Text","text"], ["URI","text"], ["Prefix","text"],
    ["Header","text"], ["Kind","text"], ["Timestamp","dateTime"],
    ["Argument Length","integer"], ["Declaration Order","integer"], ["Result","text"],
    ["Title","text"], ["Permission","text"], ["Role Relationship","text"],
    ["Derivation Mode","text"], ["Constraint Type Label","text"], ["Constraint Type Family","text"],
    ["Constraint Match Keyword","text"], ["Definition Origin","text"], ["Type Expression","text"],
    ["Implementation","text"], ["Clusivity","text"], ["Derivation Storage Type","text"],
    ["Assimilation Absorption Choice","text"], ["Clause Shape","text"], ["Migration Rule Text","text"],
    ["Regex Pattern","text"], ["Lexical Value","text"], ["Alias","text"],
    ["Length","integer"], ["Binary Precision","integer"], ["Digit Count","integer"],
    ["Precision","integer"], ["Scale","integer"], ["JSON Type","text"],
    ["JSON Format","text"], ["Abstract SQL Type","text"], ["Design Note","text"],
    ["Rationale","text"], ["Signal Kind","text"], ["Confidence Score","decimal"],
    ["Recipe Text","text"], ["Reference","text"], ["Email","text"],
    ["Value","text"], ["Retrieval Date","date"], ["Cell Name","text"],
    ["Cell Version Id","text"], ["Authority Type","text"], ["Pluralization Pattern","text"],
    ["Pluralization Replacement","text"], ["Failure Type","text"], ["Severity","text"],
    ["Block Kind","text"], ["Violation Template","text"],
  ];
  test("every value type's conceptual data type, as the oracle's carrier has it", () => {
    const rows = [];
    for (const f of readdirSync(META).filter((f) => f.endsWith(".md") && f !== "verbalization.md").sort(order))
      for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const kinds = Ev("read:kind_rows", Ev("read:x_full", Ev("read:x_of", rows)));
    const W = new Set(WITNESS_KINDS.map(J)), C = new Set(kinds.map(J));
    expect([...W].filter((r) => !C.has(r))).toEqual([]);
    expect([...C].filter((r) => !W.has(r))).toEqual([]);
  }, 300_000);

  // the kind is read off the catalogue id the value type declared, and a value is
  // written in that kind in one place -- a numeral on an integer- or number-typed
  // role is a host number, everything else is the atom the reading wrote
  test("a role's kind, and a value written in it", () => {
    const rows = [["Sales Tax Rate Percentage", "decimal"], ["Registration Age", "integer"], ["Tier", "text"]];
    expect(Ev("read:kind_cdt", ["Registration Age", rows])).toBe("integer");
    expect(Ev("read:kind_cdt", ["Never Declared", rows])).toBe("");
    expect(Ev("read:kind_vkind", ["Registration Age", rows])).toBe("integer");
    expect(Ev("read:kind_vkind", ["Sales Tax Rate Percentage", rows])).toBe("number");
    expect(Ev("read:kind_vkind", ["Tier", rows])).toBe("text");
    expect(Ev("read:kind_vkind", ["Never Declared", rows])).toBe("text");
    expect(Ev("read:kind_cell", ["integer", "500"])).toEqual([500]);
    expect(Ev("read:kind_cell", ["integer", "-12"])).toEqual([-12]);
    expect(Ev("read:kind_cell", ["integer", "gold"])).toEqual(["gold"]);
    expect(Ev("read:kind_cell", ["text", "500"])).toEqual(["500"]);
    expect(Ev("read:kind_cell", ["number", "100"])).toEqual([100]);
    // the one cell this host cannot write: a fraction needs a fractional literal,
    // and N() is an int in the cs and java readers
    expect(Ev("read:kind_cell", ["number", "6.875"])).toEqual([]);
  });

  // apps/auto.dev/.check/design-state, state:rules: the two Years of a quote and a
  // model are two roles of one value type, and the chain reads them under their own
  // names, so the third leg joins on the Vehicle alone; the difference is then one
  // `calc` over the joined rows and the head projects the column it appended.
  const CALCVOCAB = [
    "# the calc arm", "",
    "Vehicle is an entity type.",
    "Vehicle Purchase Quote(.id) is an entity type.",
    "Year is a value type.",
    "  The data type of Year is integer.",
    "Registration Age is a value type.",
    "  The data type of Registration Age is integer.", "",
    "Vehicle Purchase Quote concerns Vehicle.",
    "Vehicle Purchase Quote occurred in quote- Year.",
    "Vehicle has model- Year.",
    "Vehicle has Registration Age for Vehicle Purchase Quote. *", "", "",
  ].join("\n");
  test("a head role an arithmetic clause computes is a calc over the joined rows", () => {
    const text = CALCVOCAB + "* Vehicle has Registration Age for Vehicle Purchase Quote iff Vehicle Purchase Quote concerns Vehicle and Vehicle Purchase Quote occurred in quote- Year and Vehicle has model- Year and Registration Age is quote- Year minus model- Year.\n";
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["VehicleHasRegistrationAgeForVehiclePurchaseQuote", ["Vehicle", "Registration Age", "Vehicle Purchase Quote"],
         ["proj", ["calc", ["joinon", ["joinon", "VehiclePurchaseQuoteConcernsVehicle", "VehiclePurchaseQuoteOccurredInQuoteYear", [[1, 1]], [1, 2, 3, 4]],
                            "VehicleHasModelYear", [[2, 1]], [1, 2, 3, 4, 5, 6]], "-", 4, 6], [2, 7, 1]]]),
    ]);
  }, 300_000);

  // the role's own name, and the player under it: the hyphen-bound words the clause
  // put in front of a player make it a variable of its own
  test("a role's own name is the player with its hyphen-bound words", () => {
    expect(Ev("read:rule_calc_qual", [["Vehicle", "has", "model", "-", "Year"], "Year"])).toBe("model - Year");
    expect(Ev("read:rule_calc_qual", [["Vehicle", "Purchase", "Quote", "has", "some", "combined", "-", "sales", "-", "tax", "-", "Amount"], "Amount"]))
      .toBe("combined - sales - tax - Amount");
    expect(Ev("read:rule_calc_qual", [["Vehicle", "Purchase", "Quote", "concerns", "Vehicle"], "Vehicle"])).toBe("Vehicle");
    expect(Ev("read:rule_calc_base", "combined - sales - tax - Amount")).toBe("Amount");
    expect(Ev("read:rule_calc_base", "title - Fee Amount")).toBe("Fee Amount");
    expect(Ev("read:rule_calc_base", "Registration Age")).toBe("Registration Age");
    // the expression is cut into its <operator, operand> parts, the first empty
    expect(Ev("read:rule_calc_split", ["quote", "-", "Year", "minus", "model", "-", "Year"]))
      .toEqual([["", ["quote", "-", "Year"]], ["minus", ["model", "-", "Year"]]]);
    expect(Ev("read:rule_calc_split", ["Price", "times", "Rate", "divided", "by", "100"]))
      .toEqual([["", ["Price"]], ["times", ["Rate"]], ["divided by", ["100"]]]);
  });

  // apps/auto.dev/.check/design-state, state:rules: eight legs of one entity, each
  // an Amount of its own, added left to right; read:rule_split_body does not cut the
  // body at the `and` before `total-taxes-and-fees- Amount equals ...` -- the role
  // name has its own `and` in it -- so the arm cuts at the `and` whose neighbours
  // are not the binding hyphen and takes the leg before it with the rest.
  test("eight legs and seven additions, the oracle's own tree", () => {
    const text = [
      "# the calc arm, folded left", "",
      "Vehicle Purchase Quote(.id) is an entity type.",
      "Amount is a value type.",
      "  The data type of Amount is decimal.",
      "Fee Amount is a value type.",
      "  The data type of Fee Amount is decimal.", "",
      "Vehicle Purchase Quote has combined-sales-tax- Amount.",
      "Vehicle Purchase Quote has title- Fee Amount.",
      "Vehicle Purchase Quote has registration- Fee Amount.",
      "Vehicle Purchase Quote has document- Fee Amount.",
      "Vehicle Purchase Quote has plate- Fee Amount.",
      "Vehicle Purchase Quote has motor-vehicle-excise-tax- Amount.",
      "Vehicle Purchase Quote has gas-guzzler-tax- Amount.",
      "Vehicle Purchase Quote has dmv-fee-total- Amount.",
      "Vehicle Purchase Quote has total-taxes-and-fees- Amount. *", "",
      "* Vehicle Purchase Quote has total-taxes-and-fees- Amount iff Vehicle Purchase Quote has some combined-sales-tax- Amount and Vehicle Purchase Quote has some title- Fee Amount and Vehicle Purchase Quote has some registration- Fee Amount and Vehicle Purchase Quote has some document- Fee Amount and Vehicle Purchase Quote has some plate- Fee Amount and Vehicle Purchase Quote has some motor-vehicle-excise-tax- Amount and Vehicle Purchase Quote has some gas-guzzler-tax- Amount and Vehicle Purchase Quote has some dmv-fee-total- Amount and total-taxes-and-fees- Amount equals combined-sales-tax- Amount plus title- Fee Amount plus registration- Fee Amount plus document- Fee Amount plus plate- Fee Amount plus motor-vehicle-excise-tax- Amount plus gas-guzzler-tax- Amount plus dmv-fee-total- Amount.", "", "",
    ].join("\n");
    const rows = rulesOf(text);
    expect(rows.length).toBe(1);
    const acc = ["joinon", ["joinon", ["joinon", ["joinon", ["joinon", ["joinon", ["joinon",
      "VehiclePurchaseQuoteHasCombinedSalesTaxAmount", "VehiclePurchaseQuoteHasTitleFeeAmount", [[1, 1]], [1, 2, 3, 4]],
      "VehiclePurchaseQuoteHasRegistrationFeeAmount", [[1, 1]], [1, 2, 3, 4, 5, 6]],
      "VehiclePurchaseQuoteHasDocumentFeeAmount", [[1, 1]], [1, 2, 3, 4, 5, 6, 7, 8]],
      "VehiclePurchaseQuoteHasPlateFeeAmount", [[1, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      "VehiclePurchaseQuoteHasMotorVehicleExciseTaxAmount", [[1, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
      "VehiclePurchaseQuoteHasGasGuzzlerTaxAmount", [[1, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],
      "VehiclePurchaseQuoteHasDmvFeeTotalAmount", [[1, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]];
    let e = ["calc", acc, "+", 2, 4];
    for (const [l, r] of [[17, 6], [18, 8], [19, 10], [20, 12], [21, 14], [22, 16]]) e = ["calc", e, "+", l, r];
    expect(J(rows[0])).toBe(J(["VehiclePurchaseQuoteHasTotalTaxesAndFeesAmount", ["Vehicle Purchase Quote", "Amount"],
                               ["proj", e, [1, 23]]]));
  }, 300_000);

  // apps/auto.dev/.check/design-state, state:rules: `<role> is the sum of <value>
  // where <clauses>` -- the where-clauses join, the head's other roles are the
  // group key in the head's own order, a composite key is unfolded with `flat`, and
  // the total lands last so a head that wants it in the middle projects back
  test("a sum over the chain its where-clauses join", () => {
    const text = [
      "# the aggregate arm", "",
      "Organization(.name) is an entity type.",
      "Revenue Stream(.name) is an entity type.",
      "Frequency is a value type.",
      "Amount is a value type.",
      "  The data type of Amount is decimal.", "",
      "Organization generates Revenue Stream.",
      "Revenue Stream has Amount per Frequency.",
      "Organization has revenue- Amount per Frequency. +", "",
      "+ Organization has revenue- Amount per Frequency if revenue- Amount is the sum of Amount where Organization generates some Revenue Stream and that Revenue Stream has some Amount per that Frequency.", "", "",
    ].join("\n");
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["OrganizationHasRevenueAmountPerFrequency", ["Organization", "Amount", "Frequency"],
         ["proj", ["flat", ["sum", ["joinon", "OrganizationGeneratesRevenueStream", "RevenueStreamHasAmountPerFrequency", [[2, 1]], [1, 2, 3, 4, 5]],
                            ["CONS", 1, 5], 4]], [1, 3, 2]]]),
    ]);
  }, 300_000);

  // and a single group role takes the column itself, with no flat and no proj: the
  // body before the `where` joins with it, the clause boundary cut at the `and`
  test("a sum grouped by one role is the column itself", () => {
    const text = [
      "# the aggregate arm, one key", "",
      "Vehicle Purchase Quote(.id) is an entity type.",
      "ZIP Code(.Zip Code Digits) is an entity type.",
      "State(.name) is an entity type.",
      "Sales Tax Jurisdiction(.Name) is an entity type.",
      "State Sales Tax Jurisdiction is an entity type.",
      "State Sales Tax Jurisdiction is a subtype of Sales Tax Jurisdiction.",
      "Vehicle Fee Schedule(.id) is an entity type.",
      "DMV Fee(.name) is an entity type.",
      "Fee Amount is a value type.",
      "  The data type of Fee Amount is decimal.",
      "Amount is a value type.",
      "  The data type of Amount is decimal.", "",
      "Vehicle Purchase Quote has ZIP Code.",
      "ZIP Code is within Sales Tax Jurisdiction in State.",
      "Vehicle Fee Schedule belongs to State.",
      "Vehicle Fee Schedule has DMV Fee.",
      "DMV Fee has Fee Amount.",
      "Vehicle Purchase Quote has dmv-fee-total- Amount. *", "",
      "* Vehicle Purchase Quote has dmv-fee-total- Amount iff Vehicle Purchase Quote has ZIP Code and that ZIP Code is within some State Sales Tax Jurisdiction in some State and Vehicle Fee Schedule belongs to that State and dmv-fee-total- Amount is the sum of Fee Amount where that Vehicle Fee Schedule has DMV Fee and that DMV Fee has Fee Amount.", "", "",
    ].join("\n");
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["VehiclePurchaseQuoteHasDmvFeeTotalAmount", ["Vehicle Purchase Quote", "Amount"],
         ["sum", ["joinon", ["joinon", ["joinon", ["joinon", "VehiclePurchaseQuoteHasZIPCode", "ZIPCodeIsWithinSalesTaxJurisdictionInState", [[2, 1]], [1, 2, 3, 4, 5]],
                             "VehicleFeeScheduleBelongsToState", [[5, 2]], [1, 2, 3, 4, 5, 6, 7]],
                  "VehicleFeeScheduleHasDMVFee", [[6, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9]],
                  "DMVFeeHasFeeAmount", [[9, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]], 1, 11]]),
    ]);
  }, 300_000);

  // the boundary read:rule_split_body missed: a separating `and` is one whose
  // neighbours are not the binding hyphen
  test("the clause boundary the body splitter missed", () => {
    expect(Ev("read:rule_calc_cut", ["Vehicle", "Fee", "Schedule", "belongs", "to", "that", "State", "and", "dmv", "-", "fee", "-", "total", "-", "Amount"])).toBe(8);
    expect(Ev("read:rule_calc_cut", ["Quote", "has", "some", "dmv", "-", "Amount", "and", "total", "-", "taxes", "-", "and", "-", "fees", "-", "Amount"])).toBe(7);
    expect(Ev("read:rule_calc_cut", ["Registration", "Age"])).toBe(0);
  });

  // apps/support.auto.dev/.check/design-state, state:rules: two legs that share no
  // token and whose whole content is the comparison between them -- a cross join,
  // which is `joinon` with no keys -- then the negated leg subtracted and the bound
  // laid as the rows minus the strict rows the other way.
  const CMPVOCAB = [
    "# the comparison arm", "",
    "Vehicle Purchase Quote(.id) is an entity type.",
    "Sales Tax Rate(.id) is an entity type.",
    "Date is a value type.",
    "Effective Date is a value type.",
    "Supersession Date is a value type.", "",
    "Vehicle Purchase Quote occurred on Date.",
    "Sales Tax Rate has Effective Date.",
    "Sales Tax Rate has Supersession Date.",
    "Sales Tax Rate is in force for Vehicle Purchase Quote. *", "", "",
  ].join("\n");
  test("a bound between two columns the join bound, over a cross join", () => {
    const text = CMPVOCAB + "* Sales Tax Rate is in force for Vehicle Purchase Quote iff Vehicle Purchase Quote occurred on Date and Sales Tax Rate has Effective Date and that Effective Date is at most that Date and Sales Tax Rate has no Supersession Date." + "\n";
    const J0 = ["joinon", "VehiclePurchaseQuoteOccurredOnDate", "SalesTaxRateHasEffectiveDate", [], [1, 2, 3, 4]];
    const JN = ["joinon", J0, "SalesTaxRateHasSupersessionDate", [[3, 1]], [1, 2, 3, 4]];
    const M = ["minus", J0, JN];
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["SalesTaxRateIsInForceForVehiclePurchaseQuote", ["Sales Tax Rate", "Vehicle Purchase Quote"],
         ["proj", ["minus", M, ["cmp", M, 2, 4]], [3, 1]]]),
    ]);
  }, 300_000);

  // and `exceeds` is the pair swapped, over the same body with the leg positive
  test("a strict comparison is the pair the other way up", () => {
    const text = CMPVOCAB + "* Sales Tax Rate is in force for Vehicle Purchase Quote iff Vehicle Purchase Quote occurred on Date and Sales Tax Rate has Effective Date and that Effective Date is at most that Date and Sales Tax Rate has Supersession Date and that Supersession Date exceeds that Date." + "\n";
    const JJ = ["joinon", ["joinon", "VehiclePurchaseQuoteOccurredOnDate", "SalesTaxRateHasEffectiveDate", [], [1, 2, 3, 4]],
                "SalesTaxRateHasSupersessionDate", [[3, 1]], [1, 2, 3, 4, 5, 6]];
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["SalesTaxRateIsInForceForVehiclePurchaseQuote", ["Sales Tax Rate", "Vehicle Purchase Quote"],
         ["proj", ["cmp", ["minus", JJ, ["cmp", JJ, 2, 4]], 2, 6], [3, 1]]]),
    ]);
  }, 300_000);

  // the phrases this grammar says, and the order each means
  test("the comparison phrases, and one comparison laid", () => {
    expect(Ev("read:rule_cmp_at", ["that", "Effective", "Date", "is", "at", "most", "that", "Date"])).toEqual([4, "atmost", 3]);
    expect(Ev("read:rule_cmp_at", ["that", "Error", "Rate1", "exceeds", "that", "Error", "Rate2"])).toEqual([4, "more", 1]);
    expect(Ev("read:rule_cmp_at", ["that", "Rate1", "is", "below", "that", "Rate2"])).toEqual([3, "less", 2]);
    expect(Ev("read:rule_cmp_at", ["Sales", "Tax", "Rate", "has", "no", "Supersession", "Date"])).toEqual([]);
    const toks = ["Vehicle Purchase Quote", "Date", "Sales Tax Rate", "Effective Date"];
    expect(Ev("read:rule_cmp_one", ["ACC", toks, [], ["that", "Effective", "Date", "is", "at", "most", "that", "Date"]]))
      .toEqual(["minus", "ACC", ["cmp", "ACC", 2, 4]]);
    expect(Ev("read:rule_cmp_one", ["ACC", toks, [], ["that", "Effective", "Date", "is", "less", "than", "that", "Date"]]))
      .toEqual(["cmp", "ACC", 4, 2]);
    expect(Ev("read:rule_cmp_one", ["ACC", toks, [], ["that", "Effective", "Date", "exceeds", "that", "Date"]]))
      .toEqual(["cmp", "ACC", 2, 4]);
    // a side no leg bound is no comparison this arm may lay
    expect(Ev("read:rule_cmp_one", ["ACC", toks, [], ["that", "Cutoff", "Date", "is", "at", "most", "that", "Date"]])).toEqual([]);
    // and a leg that shares nothing is still a leg: the fold cross-joins it
    expect(Ev("read:rule_cmp_join", [["A", ["X", "Y"], [], []], ["B", ["P", "Q"], [], []]])[0])
      .toEqual(["joinon", "A", "B", [], [1, 2, 3, 4]]);
  });
});
