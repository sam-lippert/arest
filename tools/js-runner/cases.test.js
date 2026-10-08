// The js host's own unit tests. `bun test` -- no python, no other host.
//
// Every host runs the same lambda over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv, and agreement follows because they
// all match the same file. Verifying this host needs bun and nothing else.
//
// Each case is one test, so a failure names the case rather than printing a
// diff of 566 lines. The evaluator is entered exactly as the CLI enters it --
// Ev("main", [CELLS, ["case", name]]) -- so this tests lambda, not a test-only
// path through the runner.
//
//   bun run build:test && bun test
import { expect, test, describe } from "bun:test";
import { readFileSync, readdirSync, unlinkSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";

import "./cases.g.js";

// THE STORES EARLIER RUNS LEFT ARE SWEPT FIRST (2026-10-03). Each store test removes its directory in
// its finally, but the module keeps the store it loaded open and Windows does not delete an open file,
// so every run left them: 3,346 directories, 17 GB, filled C:. A store is open only in the process
// that loaded it, so a directory of this suite's an hour old belongs to a run that has ended.
{
  const ours = /^arest-(fit|meta|write|inst|closure|get|lazy|rows)-/;
  const hour = 60 * 60 * 1000;
  for (const name of readdirSync(tmpdir())) {
    if (!ours.test(name)) continue;
    const p = join(tmpdir(), name);
    try { if (Date.now() - statSync(p).mtimeMs > hour) rmSync(p, { recursive: true, force: true }); }
    catch { /* still open, or gone already */ }
  }
}

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
  // THE BOTTOM ROWS ARE THE POINT. lambda's note above main:case_text says one
  // case per invocation is deliberate: the table holds rows that BOTTOM, no
  // lambda def can branch on bottom, and a fold would die at the first one. The
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

// THE WANDERING RED IN THIS BLOCK IS GARBAGE COLLECTION, NOT A SLOW CASE, AND
// THE CAP MUST NOT BE RAISED TO HIDE IT (2026-09-19). Five consecutive full
// runs each timed out on ONE case at about ten seconds, a DIFFERENT case every
// time -- case:an-obligation-nothing-violates-is-still-unchecked 9982 ms,
// case:a-migration-rule-text-may-introduce-a-value-the-source-lacks 8932 ms,
// case:the-same-bound-child-is-still-one-child 10396 ms,
// case:create-binds-a-child-by-its-content 9943 ms -- and one run fired none.
// It is not the case's own work: every one of those answers in 1 to 66 ms when
// asked on its own through Ev("main", [CELLS, ["case", name]]), in either order,
// so it is not a first-one-pays cost either. It is a collection of a heap this
// file grows over 886 tests (one reader pass alone reaches 98 MB heap and
// 366 MB rss), billed by the runner to whichever test was running.
// THE EXPERIMENT THAT SAYS SO, predicted before it was run: a smaller heap
// should make each collection smaller and the worst pause shorter, while doing
// more collection overall. `bun --smol test cases.test.js` gives exactly that
// -- the worst pause falls 9943 -> 6508 ms (case:entity-view-canonical, a
// fifth distinct case) while the run rises 526 -> 729 s.
// The lever is therefore ALLOCATION, not the cap: CONS is called 5.5M to 20M
// times in a single reader pass and each call allocates. Every FASTPRIMS twin
// that replaces an interpreted scan removes its allocations too, which is the
// other half of why they are worth having. A timer cannot see the pause from
// inside -- the evaluator never yields, so setInterval does not fire once for
// the whole run -- which is why this is measured by its shape and not caught
// in the act.
describe("every case answers what the lambda says it answers", () => {
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

// THE LAW REPORT IS THE GATE, SO THIS ASKS IT AND KEEPS NO COPY (2026-10-02).
// engine/shared/expected-laws.txt held the report's text, compared byte for
// byte, so every law added left the copy stale until someone recorded it again:
// it listed 67 of the 86 laws the report names, and this failed on a report
// that said ALL LAWS HOLD. The copy is gone. main answers <text, verdict>, and
// the verdict is T exactly when every law the report names holds, so this asks
// for that and shows the report's own lines for whatever does not. A law taken
// out of the report that nothing else calls is law:unreachable's to see.
// The report over the composed store is minutes, not milliseconds -- it is the
// single most expensive thing this host does, and bun's default 5s cuts it off
// mid-run and reports a timeout as a failure.
test("law:report holds", () => {
  const [text, verdict] = Ev("main", [CELLS, []]);
  const lines = String(text).trimEnd().split("\n");
  expect(lines.filter((l) => !l.startsWith("  law OK: ") && !l.startsWith("ALL LAWS HOLD "))).toEqual([]);
  expect(lines.length).toBeGreaterThan(1);
  expect(verdict).toBe("T");
}, 900_000);

// THE FIRST SCREEN IS A GOLDEN TOO. The laws never read the panes, so a lambda
// change to ui:groups that emptied the root screen passed every gate above and
// was caught by running a container (2026-09-07). The root layer of the base
// store, as the ui container routes it, is recorded here and compared as the
// law report is; a screen that changes on purpose re-records it.
test("the root screen holds, byte for byte", () => {
  const want = readFileSync(join(SHARED, "expected-root.txt"), "utf8").trim();
  const got = JSON.stringify(Ev("ui:route", [CELLS, [], [], []])).trim();
  expect(got).toBe(want);
}, 60_000);

// A MEMOISED NAME THAT IS NEVER GIVEN AN ANSWER BACK IS APPLIED BARE, AND ANSWERS
// AS BEFORE (2026-09-23). The memo is evaluator quality, so the cases above hold
// it byte for byte whatever it does; what they cannot show is that the judgement
// happens at all, and the judgement is the whole of the saving -- arest-dev's
// server peaked at 1,761 MB booting and settled at 1,212 while rmap:unproj_cell's
// 2.1 million never-repeated operands filled the memo, and at 793 and 585 once
// they stopped. Three probe names, registered for this test alone: one is never
// asked the same thing twice and must go bare; one is asked everything twice and
// must stay memoised, holding only a bounded share of what it stored; and one
// holding a few answers must still hold them after the other two have run, since
// a name's bound drops its own entries and never the memo's.
test("a memoised name that is never given an answer back is applied bare, and answers as before", () => {
  const { DEFS, memoStat } = globalThis.AREST;
  const once = "state:memo_probe_once", twice = "state:memo_probe_twice", kept = "state:memo_probe_kept";
  DEFS.set(once, "id");
  DEFS.set(twice, "id");
  DEFS.set(kept, "id");
  try {
    for (let i = 0; i < 16; i++) Ev(kept, ["k" + i]);
    const wrong = [];
    for (let i = 0; i < 8192; i++) {
      const got = Ev(once, ["o" + i]);
      if (JSON.stringify(got) !== JSON.stringify(["o" + i])) wrong.push(i);
    }
    for (let i = 0; i < 8192; i++) {
      const got = Ev(twice, ["t" + i]), again = Ev(twice, ["t" + i]);
      if (JSON.stringify(got) !== JSON.stringify(["t" + i]) || JSON.stringify(again) !== JSON.stringify(got)) wrong.push(-i);
    }
    expect(wrong).toEqual([]);
    const o = memoStat(once), t = memoStat(twice);
    expect(o.bare).toBe(true);
    expect(o.givenBack).toBe(0);
    expect(o.stored).toBeLessThan(8192);
    expect(t.bare).toBe(false);
    expect(t.givenBack * 8).toBeGreaterThanOrEqual(t.stored);
    expect(t.held).toBeLessThan(t.stored);
    // its own entries went, not the memo: the name beside it answers from it still
    const k = memoStat(kept).givenBack;
    for (let i = 0; i < 16; i++) Ev(kept, ["k" + i]);
    expect(memoStat(kept).givenBack).toBe(k + 16);
    // and a name applied bare still answers what it answered
    expect(Ev(once, ["o7"])).toEqual(["o7"]);
  } finally {
    DEFS.delete(once);
    DEFS.delete(twice);
    DEFS.delete(kept);
  }
});


// THE INSTANCE-OF INDEX IN ONE PASS IS THE INDEX THE FOLD BUILDS (2026-09-24).
// store:otpops was 17.7 s of support's 22.7 s start -- a right fold whose every
// step flattened, searched and copied a type's whole instance list -- and its
// twin builds the same value in one pass: 27 ms and byte-identical on support's
// 24,050 rows. The DEF's body evaluated as a FORM never reaches the twin, which
// is looked up by the name, so the two can be held against each other here on
// every shape the fold treats differently: a new instance of a known type, one
// already there (the entry keeps its own shape), a type met for the first time
// (a new chunk at the end), the same type on entries in two chunks, an entry
// whose instances are flat and one whose are wrapped, and the rows' own order,
// which the fold reads last-first.
test("the instance-of index built in one pass is the index the fold builds", () => {
  const { DEFS } = globalThis.AREST;
  const prior = [[["Person", ["p1", "p2"]], ["Car", ["c1"]]], [["Person", [["p9"]]]], [["Dog", [["d1", "d2"]]]]];
  const cells = [["CELL", "state:otpops", prior]];
  const rows = [["p3", "Person"], ["c1", "Car"], ["b1", "Boat"], ["p1", "Person"], ["b2", "Boat"],
    ["d3", "Dog"], ["b1", "Boat"], ["p9", "Person"], ["x1", "Cat"], ["p3", "Person"]];
  const twin = Ev("store:otpops", [rows, cells]);
  const def = Ev(DEFS.get("store:otpops"), [rows, cells]);
  expect(JSON.stringify(twin)).toBe(JSON.stringify(def));
  // and nothing at all to fold is the prior index itself
  expect(JSON.stringify(Ev("store:otpops", [[], cells]))).toBe(JSON.stringify(Ev(DEFS.get("store:otpops"), [[], cells])));
});

// ---- DOES LAMBDA'S RELATIONAL MAPPING PROJECT TO A REAL DATABASE? -----------
//
// rmap:ddl renders the mapping as CREATE TABLE. Asserting the text against a
// golden would only pin the text; what matters is whether SQLite ACCEPTS it,
// which is a question no string comparison answers. So the test runs it.
//
// This is the leg that went out with the fat hosts (engine/python's
// ddl.project(D, con) and the rust resident's `sql` verb) and it was never
// fat-host work -- lambda derives the schema, the host only opens a file. The
// pieces were always here: rmap:ddl_table and rmap:ddl_order existed with NO
// caller, so nothing walked the schema and nothing noticed.
test("lambda's DDL is a database SQLite will accept", () => {
  const sql = String(Ev("schema:ddl", CELLS));
  expect(sql).toContain("CREATE TABLE IF NOT EXISTS");

  const db = new Database(":memory:");
  db.run(sql);                                    // throws on invalid SQL
  const tables = db
    .query("select name from sqlite_master where type = ?")
    .all("table")
    .map((r) => r.name);

  // every table lambda names must exist in the database it just described
  for (const name of Ev("rmap:tables", CELLS)) {
    expect(tables).toContain(String(name));
  }
  expect(tables.length).toBeGreaterThan(0);
});

// ---- DOES EVERY FACT THE STORE HOLDS HAVE A PLACE IN THE SCHEMA? ----------
//
// Halpin's Rmap step 1 maps each fact type with a compound UC to a table of its
// own, and Information Modeling and Relational Databases says twice -- at the
// end of 10.3's Mapping Subtypes and again in 10.4 -- that absorbing a subtype
// does NOT take that away from a non-functional role the subtype plays.
// lambda's rmap:absorbed took it away anyway, so 38 fact types of the base
// metamodel had nowhere in the schema to be written: 1,538 of its 3,540 rows,
// among them ObjectTypeInstanceIsInstanceOfObjectType's 1,426 and
// ObjectTypeIsSubtypeOfObjectType's 111. The compiler dropped every one of them
// in silence, because a column that does not exist refuses nothing.
//
// AND THE SUITE COULD NOT SEE IT. Fixing it moved the metamodel from 11 tables
// to 49 and from 344 columns to 466, and every one of the 886 tests still
// passed, because nothing here read the schema's SHAPE -- only that SQLite
// accepted whatever shape it was. So this asks a property rather than a count,
// which is also why it does not need re-pinning when a reading is added: every
// POPULATED fact type is either a table of its own or is carried by some column
// of one.
//
// Proven to fail before it was trusted: at b9efb2b5, the commit before the fix,
// it reports 38 fact types and 1,538 rows with no home.
test("every populated fact type has a place in the schema", () => {
  const ctab = Ev("rmap:ctab", CELLS);
  const tables = new Set(ctab.map((t) => String(t[0])));
  const carried = new Set();
  for (const t of ctab) {
    for (const col of t[2]) {
      const ft = String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : []));
      if (ft !== "#") carried.add(ft);
    }
  }
  const homeless = [];
  let rows = 0;
  for (const desc of Ev("store:fts", CELLS)) {
    const name = String(desc[0]);
    const pop = Array.isArray(desc[4]) ? desc[4] : [];
    if (!pop.length || tables.has(name) || carried.has(name)) continue;
    homeless.push(name);
    rows += pop.length;
  }
  expect({ factTypes: homeless.sort(), rows }).toEqual({ factTypes: [], rows: 0 });
}, 120_000);

// ---- AND DO ITS ROWS LAND THERE? ------------------------------------------
//
// Having a PLACE in the schema is weaker than the rows arriving in it, and the
// gap is not hypothetical: at 0e36f877 the test above answered 0 rows with no
// home on claude while four of its tables stood empty. rmap:ctab's row is
// <object type name, TABLE NAME, columns> -- "CSDP Step" beside "CSDPStep" --
// and rmap:proj_cols looked a table up by the FIRST while compile.js, rmap:ddl,
// rmap:colnames and rmap:coltabs all name it by the SECOND. Sixteen of claude's
// tables were created by the DDL and filled by nobody.
//
// So this asks each table for its rows BY THE NAME THE SCHEMA GIVES IT, which
// is the name compile.js asks with, and sets them beside the population the
// readings declare: a fact type with a table of its own wants that many rows in
// it, and one carried by a column wants that many non-# cells in that column.
// It needs no database, so the projection is held to the store's standard
// without one being built.
//
// PROVEN TO FAIL BEFORE IT WAS TRUSTED. On THIS corpus at e922de7c, the commit
// before b9efb2b5 gave relation tables their rows: 13 populated fact types
// whole and 36 SHORT BY 3,209 ROWS, among them FactTypeHasDeclarationOrder's
// 262 and SubtypeFactProvidesPreferredIdentifier's 110. On claude at 0e36f877:
// 113 whole, 4 short by 90 -- ActionClassHasActionKind 13,
// SourceMappingMapsAgentLayer 35, SourceMappingMapsSourceLayer 35,
// CSDPStepHasStepName 7.
test("every populated fact type's rows land in the schema", () => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  const tabs = new Set(Ev("rmap:coltabs", CELLS).map((t) => String(t[0])));
  const own = new Map();
  const carried = new Map();
  for (const t of Ev("rmap:ctab", CELLS)) {
    own.set(String(t[0]), String(t[1]));
    t[2].forEach((col, i) => {
      const ft = String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : []));
      if (ft === "#") return;
      if (!carried.has(ft)) carried.set(ft, []);
      carried.get(ft).push([String(t[1]), i]);
    });
  }
  const cache = new Map();
  const rowsOf = (t) => {
    if (!cache.has(t)) cache.set(t, Ev("rmap:proj_rows", [t, CELLS]));
    return cache.get(t);
  };
  const short = [];
  let lost = 0;
  for (const desc of Ev("store:fts", CELLS)) {
    const name = String(desc[0]);
    const want = Array.isArray(desc[4]) ? desc[4].length : 0;
    if (!want) continue;
    const table = own.get(name);
    let got = 0;
    if (table && tabs.has(table)) got = rowsOf(table).length;
    else {
      for (const [t, i] of carried.get(name) || []) {
        const n = rowsOf(t).filter((r) => r[i] !== undefined && flat(r[i]) !== "#").length;
        if (n > got) got = n;
      }
    }
    if (got >= want) continue;
    short.push(name);
    lost += want - got;
  }
  expect({ factTypes: short.sort(), rows: lost }).toEqual({ factTypes: [], rows: 0 });
}, 120_000);

// ---- AND DOES THE SCHEMA STILL SAY WHAT THE READINGS SAID? -----------------
//
// The two tests above ask whether the rows reach the schema. This asks whether
// the schema still MEANS them: every table projected with rmap:proj_rows and
// read straight back with rmap:unproj, compared against the population the
// readings declare. It needs no database -- lambda is held against itself -- and
// it is the same question a boot asks when it loads a store instead of a
// carrier, which is what rmap:unproj exists for.
//
// The five rules run backwards. A relation table's role columns are its fact
// type's tuple in order; an entity table's key is rmap:ddl_pkof, the columns the
// DDL makes primary; a unary column is presence; and the tuple order follows the
// role the table plays, so a separated 1:1 carried the other way round -- Email
// .userId holding UserHasEmail, whose players are <Function, Email> -- puts the
// cell first and the key second.
//
// WHAT IT CATCHES, measured while it was being written rather than after: at
// 0e36f877 the same comparison against claude's written store answered 116 of
// 117, the missing one being UserHasEmail, because Email's PRIMARY KEY was
// written NULL in every row and sqlite took it without a word. f9fbc72a fixed
// that and both stores now answer whole -- the metamodel 52 of 52, claude 117 of
// 117 -- and this corpus 49 of 49.
test("the schema still means what the readings said", () => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  const got = new Map();
  for (const t of Ev("rmap:coltabs", CELLS)) {
    const table = String(t[0]);
    const rows = Ev("rmap:proj_rows", [table, CELLS]);
    if (!rows.length) continue;
    for (const p of Ev("rmap:unproj", [table, rows, CELLS])) {
      const ft = String(p[0]);
      if (!got.has(ft)) got.set(ft, []);
      got.get(ft).push((Array.isArray(p[1]) ? p[1] : [p[1]]).map(flat));
    }
  }
  const key = (rows) => rows.map((t) => JSON.stringify(t)).sort().join("|");
  const differ = [];
  let lost = 0;
  for (const d of Ev("store:fts", CELLS)) {
    const ft = String(d[0]);
    const pop = Array.isArray(d[4]) ? d[4] : [];
    if (!pop.length) continue;
    const want = pop.map((r) => (Array.isArray(r) ? r.map(flat) : [flat(r)]));
    const have = got.get(ft) || [];
    if (key(want) === key(have)) continue;
    differ.push(ft);
    lost += Math.abs(want.length - have.length) || want.length;
  }
  expect({ factTypes: differ.sort(), rows: lost }).toEqual({ factTypes: [], rows: 0 });
}, 120_000);

// ---- AND A SUBTYPE'S OWN TABLE READS ITS ROWS KEY FIRST -------------------
//
// support.auto.dev's APIProduct table as rmap:ctab, rmap:colnames and
// rmap:pkrows name it, with the four functional fact types it carries: each is
// declared <API Product, X> and carried by store:fts as <Function, X>, because
// API Product is a subtype of API and every FFP entity player is named by the
// type that holds its reference. API(.Endpoint Slug) keys on its slug, so the
// subtype keeps a table of its own, keyed on a minted APIProductId -- a shape
// the base has none of, its subtypes being absorbed into Function, whose owner
// IS the carried player. At 758d23cb rmap:unproj answered <Free, vin> for
// APIProductRequiresPlanTier -- the value before the key -- because it decided
// the tuple order by comparing the carried first player, Function, with the
// table's owner, API Product, and read every disagreement as a column carried
// the other way round; the uniqueness over role 1 then saw Free three times and
// reported a violation on each of the three (task #122 item 1). The rows below
// are what sqlite hands back, null as #, and the projection's own answer.
test("a functional fact type in a subtype's own table reads back key first", () => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  const store = [
  ["CELL","stored:rmap:ctab",[["API Product", "APIProduct", [["APIProduct", "F", [["info", "API Product", "API Product_id", "API Product_id", ["APIProductHasAPIProductId"], "T"]]], ["APIProduct", "F", [["info", "API Product", "Cache Strategy", "Cache Strategy", ["APIProductHasCacheStrategy"], "F"]]], ["APIProduct", "F", [["info", "API Product", "TTL", "TTL", ["APIProductHasTTL"], "F"]]], ["APIProduct", "F", [["rel", "API Product", "Plan Tier", "API Product", ["APIProductRequiresPlanTier"], "F"], ["info", "Plan Tier", "Plan Tier", "", [], "T"]]], ["APIProduct", "F", [["info", "API Product", "Equipment Scope", "Equipment Scope", ["APIProductReturnsEquipmentScope"], "F"]]]]]]],
  ["CELL","stored:rmap:colnames",[["APIProduct", "APIProductId", "F"], ["APIProduct", "cacheStrategy", "F"], ["APIProduct", "TTL", "F"], ["APIProduct", "planTier", "F"], ["APIProduct", "equipmentScope", "F"]]],
  ["CELL","stored:rmap:pkrows",[["pk", "APIProduct", "APIProduct_PK", ["APIProductId"]]]],
  ["CELL","state:fts",[[["APIProductHasCacheStrategy", ["Function", "Cache Strategy"], [[1]], [], [[["listings", "stale-while-revalidate"], ["recalls", "network-first"]]]], ["APIProductHasTTL", ["Function", "TTL"], [[1]], [], [[["listings", "1 hour"], ["recalls", "1 day"]]]], ["APIProductRequiresPlanTier", ["Function", "Plan Tier"], [[1]], [], [[["vin", "Free"], ["listings", "Free"], ["recalls", "Growth"]]]], ["APIProductReturnsEquipmentScope", ["Function", "Equipment Scope"], [[1]], [], []]]]],
  ["CELL","state:declared",[[["APIProductHasCacheStrategy", ["API Product", "Cache Strategy"]], ["APIProductHasTTL", ["API Product", "TTL"]], ["APIProductRequiresPlanTier", ["API Product", "Plan Tier"]], ["APIProductReturnsEquipmentScope", ["API Product", "Equipment Scope"]]]]]
  ];
  const cols = ["APIProductId", "cacheStrategy", "TTL", "planTier", "equipmentScope"];
  const rows = [
    ["vin", "#", "#", "Free", "#"],
    ["listings", "stale-while-revalidate", "1 hour", "Free", "#"],
    ["recalls", "network-first", "1 day", "Growth", "#"],
  ];
  expect(Ev("rmap:proj_colnames", ["APIProduct", store]).map(String)).toEqual(cols);
  // the projection writes the key first: rule 6 fills the identifying column with it
  const byKey = (a, b) => a[0].localeCompare(b[0]);
  expect(Ev("rmap:proj_rows", ["APIProduct", store]).map((r) => r.map(flat)).sort(byKey)).toEqual(rows.slice().sort(byKey));
  // and the inverse reads it back the same way, row by row, column by column
  const back = Ev("rmap:unproj", ["APIProduct", rows, store]).map((p) => [String(p[0]), (Array.isArray(p[1]) ? p[1] : [p[1]]).map(flat)]);
  expect(back).toEqual([
    ["APIProductRequiresPlanTier", ["vin", "Free"]],
    ["APIProductHasCacheStrategy", ["listings", "stale-while-revalidate"]],
    ["APIProductHasTTL", ["listings", "1 hour"]],
    ["APIProductRequiresPlanTier", ["listings", "Free"]],
    ["APIProductHasCacheStrategy", ["recalls", "network-first"]],
    ["APIProductHasTTL", ["recalls", "1 day"]],
    ["APIProductRequiresPlanTier", ["recalls", "Growth"]],
  ]);
});

// ---- AND A COLUMN KEYED BY ITS SECOND PLAYER LANDS EVERY ROW ---------------
//
// qa.auto.dev's Function.functionId and Function.roleFactTypeId columns and its
// ConstraintSpan table as rmap:ctab, rmap:colnames and rmap:pkrows name them,
// over a store of one fact type with two roles and one constraint spanning both.
// FactTypeHasRole is declared <Fact Type, Role> with the uniqueness on the Role,
// so its column sits in Role's row, a Function row, and its path enters the fact
// type through the SECOND role; the projection keyed the row by the FIRST player
// and matched element 1, so it wrote DomainHasDescription.1 into the fact type's
// row and dropped DomainHasDescription.2 -- one role per fact type (FactTypeHasRole
// 506 of 993 on the base, ObjectTypePlaysRole 218 of 993), and no Role row at
// all. ConstraintSpan keeps its table with its own identifier column ahead of the
// roles and its position and sequence number after them; the role layout wrote #
// into all three, so the span's 997 positions and 997 sequence numbers had no row
// to land in. Every boot over the tables found the four lacking, re-projected
// Function and ConstraintSpan and landed no more of them than before (2026-09-21).
// The rows below are the projection's own answer and what the inverse reads back
// from them: the key at the role the path enters through, the tuple in the
// declared order, and the span identified as reflect:span_rec mints it.
test("an absorbed column keyed by its second player lands every row, and an objectified span carries its id and attributes", () => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  const store = [
  ["CELL","stored:rmap:ctab",[["Function", "Function", [["Function", "F", [["info", "Function", "Function_id", "Function_id", ["FunctionHasFunctionId"], "T"]]], ["Function", "F", [["assim", "Function", "Role", "Function", [], "F", "T"], ["rel", "Role", "Fact Type", "Role", ["FactTypeHasRole"], "F"], ["assim", "Event Type", "Fact Type", "Event Type", [], "T", "T"], ["assim", "Function", "Event Type", "Function", [], "T", "T"], ["info", "Function", "Function_id", "Function_id", ["FunctionHasFunctionId"], "T"]]]]], ["ConstraintSpan", "ConstraintSpan", [["ConstraintSpan", "F", [["assim", "Function", "ConstraintSpan", "Function", [], "T", "T"], ["info", "Function", "Function_id", "Function_id", ["FunctionHasFunctionId"], "T"]]], ["ConstraintSpan", "F", [["rel", "ConstraintSpan", "Constraint", "ConstraintSpan", ["ConstraintIsInvolvedInConstraintSpan"], "F"], ["assim", "Function", "Constraint", "Function", [], "T", "T"], ["info", "Function", "Function_id", "Function_id", ["FunctionHasFunctionId"], "T"]]], ["ConstraintSpan", "F", [["info", "ConstraintSpan", "Position", "Position", ["ConstraintSpanHasPosition"], "F"]]], ["ConstraintSpan", "F", [["info", "ConstraintSpan", "Sequence Number", "Sequence Number", ["ConstraintSpanHasSequenceNumber"], "F"]]], ["ConstraintSpan", "F", [["rel", "ConstraintSpan", "Role", "ConstraintSpan", ["RoleIsInvolvedInConstraintSpan"], "F"], ["assim", "Function", "Role", "Function", [], "T", "T"], ["info", "Function", "Function_id", "Function_id", ["FunctionHasFunctionId"], "T"]]]]]]],
  ["CELL","stored:rmap:colnames",[["Function", "functionId", "F"], ["Function", "roleFactTypeId", "F"], ["ConstraintSpan", "constraintSpanId", "F"], ["ConstraintSpan", "constraintId", "F"], ["ConstraintSpan", "position", "F"], ["ConstraintSpan", "sequenceNumber", "F"], ["ConstraintSpan", "roleId", "F"]]],
  ["CELL","stored:rmap:pkrows",[["pk", "ConstraintSpan", "ConstraintSpan_PK", ["constraintSpanId"]], ["pk", "Function", "Function_PK", ["functionId"]]]],
  ["CELL","state:fts",[[["FactTypeHasRole", ["Function", "Function"], [[2]], [1, 2], [["DomainHasDescription", "DomainHasDescription.1"], ["DomainHasDescription", "DomainHasDescription.2"]]], ["ConstraintSpan", ["Function", "Function"], [[1, 2]], [1], [["UC:en:DomainHasDescription#1", "DomainHasDescription.1"], ["UC:en:DomainHasDescription#1", "DomainHasDescription.2"]]], ["ConstraintSpanHasPosition", ["Function", "Position"], [[1]], [1], [["UC:en:DomainHasDescription#1.DomainHasDescription.1", "1"], ["UC:en:DomainHasDescription#1.DomainHasDescription.2", "2"]]], ["ConstraintSpanHasSequenceNumber", ["Function", "Sequence Number"], [[1]], [1], [["UC:en:DomainHasDescription#1.DomainHasDescription.1", "1"], ["UC:en:DomainHasDescription#1.DomainHasDescription.2", "1"]]]]]],
  ["CELL","state:declared",[[["FactTypeHasRole", ["Fact Type", "Role"]], ["ConstraintSpan", ["Constraint", "Role"]], ["ConstraintSpanHasPosition", ["ConstraintSpan", "Position"]], ["ConstraintSpanHasSequenceNumber", ["ConstraintSpan", "Sequence Number"]]]]],
  // the players each fact type declares, in role order, which is where the relation
  // projection reads a role column`s role from (2026-09-24): ConstraintSpan`s columns
  // carry ConstraintIsInvolvedInConstraintSpan and RoleIsInvolvedInConstraintSpan
  ["CELL","state:readings",[[["FactTypeHasRole", ["Fact Type", "Role"], [["{0}", "has", "{1}"]]], ["ConstraintSpan", ["Constraint", "Role"], [["{0}", "spans", "{1}"]]], ["ConstraintSpanHasPosition", ["ConstraintSpan", "Position"], [["{0}", "has", "{1}"]]], ["ConstraintSpanHasSequenceNumber", ["ConstraintSpan", "Sequence Number"], [["{0}", "has", "{1}"]]]]]]
  ];
  const byKey = (a, b) => a[0].localeCompare(b[0]);
  const pairs = (table, rows) => Ev("rmap:unproj", [table, rows, store]).map((p) => [String(p[0]), (Array.isArray(p[1]) ? p[1] : [p[1]]).map(flat)]);
  // Function: one row per Role, keyed by the role, holding its fact type
  expect(Ev("rmap:proj_colnames", ["Function", store]).map(String)).toEqual(["functionId", "roleFactTypeId"]);
  const roles = Ev("rmap:proj_rows", ["Function", store]).map((r) => r.map(flat)).sort(byKey);
  expect(roles).toEqual([
    ["DomainHasDescription.1", "DomainHasDescription"],
    ["DomainHasDescription.2", "DomainHasDescription"],
  ]);
  // and the inverse reads the tuple in the declared order, fact type first
  expect(pairs("Function", roles)).toEqual([
    ["FactTypeHasRole", ["DomainHasDescription", "DomainHasDescription.1"]],
    ["FactTypeHasRole", ["DomainHasDescription", "DomainHasDescription.2"]],
  ]);
  // ConstraintSpan: the span id, the roles, and the span's own two attributes
  expect(Ev("rmap:proj_colnames", ["ConstraintSpan", store]).map(String)).toEqual(["constraintSpanId", "constraintId", "position", "sequenceNumber", "roleId"]);
  const spans = Ev("rmap:proj_rows", ["ConstraintSpan", store]).map((r) => r.map(flat)).sort(byKey);
  expect(spans).toEqual([
    ["UC:en:DomainHasDescription#1.DomainHasDescription.1", "UC:en:DomainHasDescription#1", "1", "1", "DomainHasDescription.1"],
    ["UC:en:DomainHasDescription#1.DomainHasDescription.2", "UC:en:DomainHasDescription#1", "2", "1", "DomainHasDescription.2"],
  ]);
  expect(pairs("ConstraintSpan", spans)).toEqual([
    ["ConstraintSpan", ["UC:en:DomainHasDescription#1", "DomainHasDescription.1"]],
    ["ConstraintSpanHasPosition", ["UC:en:DomainHasDescription#1.DomainHasDescription.1", "1"]],
    ["ConstraintSpanHasSequenceNumber", ["UC:en:DomainHasDescription#1.DomainHasDescription.1", "1"]],
    ["ConstraintSpan", ["UC:en:DomainHasDescription#1", "DomainHasDescription.2"]],
    ["ConstraintSpanHasPosition", ["UC:en:DomainHasDescription#1.DomainHasDescription.2", "2"]],
    ["ConstraintSpanHasSequenceNumber", ["UC:en:DomainHasDescription#1.DomainHasDescription.2", "1"]],
  ]);
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
// at position 1 in `Function has Description`; that is the model's shape, not a
// convention -- see system:domain_belongings in lambda. The Description leg reads
// the rows of FunctionHasDescription whose subject is a Domain (2026-10-01: the
// subtype descriptions were retired for the one on Function, so a Predicate or a
// served verb carries a Description that is no Domain's and orients nothing).
const ORIENT_SOURCES = [
  ["FunctionHasDescription", 0, 1],
  ["FunctionBelongsToDomain", 1, 0],
  ["FactBelongsToDomain", 1, 0],
  ["ObjectTypeInstanceBelongsToDomain", 1, 0],
  ["ViolationBelongsToDomain", 1, 0],
  ["FailureBelongsToDomain", 1, 0],
];

const popOf = (store, ft) => Ev("system:pop_rows", [ft, store]).map((r) => r.map(String));
const key = (row) => JSON.stringify(row);   // a separator no value can forge
// a source's rows as orient reads them: a Description only where its subject is a Domain
const domainsOf = (store) => new Set(Ev("ui:ids", [store, "Domain"]).map(String));
const sourceRows = (store, ft) => ft !== "FunctionHasDescription" ? popOf(store, ft)
  : popOf(store, ft).filter((r) => domainsOf(store).has(r[0]));

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
    for (const row of sourceRows(store, ft))
      if (scope.has(row[dpos]) && !retired.has(row[vpos])) out.push(key([row[dpos], ft, row[vpos]]));
  return out.sort();
}

const orientRows = (store, domain) => Ev("orient", [domain, store]).map((r) => key(r.map(String))).sort();

function orientHolds(store, label) {
  const domains = new Set();
  for (const [ft, dpos] of ORIENT_SOURCES) for (const row of sourceRows(store, ft)) domains.add(row[dpos]);

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

// The composed store populates ONE of the six sources (Function has Description, on a Domain),
// because nothing in the metamodel or the templates asserts `belongs to Domain`
// and `Domain is contained in Domain` is empty, so its reach closure is empty
// too. A rule checked only where it degenerates is not checked: this store
// carries all three legs -- a reach closure two deep, four belonging
// populations, and an entity in a terminal status -- and the SAME assertions
// run over it. The cells are prepended because ast:FetchPop consults top-level
// cells before FILE, so these populations win over the composed store's.
// The synthetic Domains are Domains of the store: a Description orients only where ui:ids files its
// subject under Domain, so the composed store's own state:otpops is carried with d1..dx added to it,
// and fz is a Function with a Description that is no Domain.
const SYNTHETIC_OTPOPS = (() => {
  const pops = Ev("ui:otpops", CELLS);
  const extra = ["d1", "d2", "d3", "dx"];
  // a type's ids are held in chunks, so the four are one more chunk
  return pops.some((p) => String(p[0]) === "Domain")
    ? pops.map((p) => String(p[0]) === "Domain" ? [p[0], [...p[1], extra]] : p)
    : [...pops, ["Domain", [extra]]];
})();
const SYNTHETIC = [
  ["CELL", "FunctionHasDescription", [["d1", "Top"], ["d2", "Child"], ["fz", "A Function that is no Domain"], ["d3", "Grandchild"], ["dx", "Unrelated"]]],
  ["CELL", "state:otpops", [SYNTHETIC_OTPOPS]],
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
  expect(d1).toContain(key(["d3", "FunctionHasDescription", "Grandchild"]));
  expect(d1).toContain(key(["d2", "FactBelongsToDomain", "k1"]));
  expect(d1).toContain(key(["d3", "ViolationBelongsToDomain", "v1"]));

  // RESTRICTION: dx reaches nothing and nothing reaches it, so it is absent
  expect(d1.filter((r) => r.includes("dx") || r.includes("fx"))).toEqual([]);
  // and a leaf answers only its own, which is what makes reach load-bearing
  expect(orientRows(SYNTHETIC, "d3")).toEqual(
    [key(["d3", "FunctionHasDescription", "Grandchild"]),
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
  // and a Function that is no Domain orients nothing, its Description included
  expect(orientRows(SYNTHETIC, "fz")).toEqual([]);
  expect(d1.filter((r) => r.includes("fz"))).toEqual([]);
});

// ---- DOES A store.db HOLD THE SCHEMA IT IS READ THROUGH? -------------------
//
// compile.js projects the booted populations into store.db and the host boots
// serve and mcp from it, so a database that lacks a table the host selects from
// is the wrong store. Measured 2026-09-11: the base store.db of 09-08 booted
// into the current module and `schema` threw `selector 2 out of range 1` from
// inside the answer; it differed from a rebuilt one only in lacking four fact
// types' tables, and loadStoreDb's read loop skipped each one in silence.
//
// WHAT STOOD HERE HELD THE STORE TO THE COMPOSITION STAMP instead -- sixteen hex
// digits over the whole lambda file and the carriers -- and measured 2026-09-21
// that is both too strong and too weak. TOO STRONG: three lambda commits that
// moved no table (reflect:src_*, rmap:unproj_owner deleted from the read side,
// the judge's DEFs) invalidated every app's store, five were down at once, and
// support's re-read is ten minutes. TOO WEAK: a database carrying THIS module's
// stamp and NO TABLES AT ALL loaded in 23 ms without a word -- the 09-11 failure
// exactly, which the stamp was introduced to catch and never did.
//
// The four databases below are the whole rule, and the test writes them rather
// than reading whatever store.db is on disk: an artifact-shaped test skips when
// the artifact is missing, which is a pass that answers nothing. makeTables is
// the fixture the durability tests use, a few lines down, and it is rmap:ddl --
// so a store built with it holds exactly the schema the module reads.
test("a store.db is held to the schema it is read through, not to the composition it was built from", () => {
  const stamp = globalThis.AREST.composition;
  expect(stamp).toMatch(/^[0-9a-f]{16}$/);
  const dir = mkdtempSync(join(tmpdir(), "arest-fit-"));

  // THE COLUMN IS TAKEN FROM THE SCHEMA, NOT NAMED HERE: what must be missed is
  // a column the module is about to select. Not every column can be missed --
  // sqlite refuses to drop a primary key or an indexed one -- so the drop is
  // tried here, on a database that is thrown away, and the first that works is
  // the one the fixture below leaves out.
  let table = "", col = "";
  {
    const db = new Database(join(dir, "pick.db"));
    makeTables(db);
    for (const t of Ev("rmap:coltabs", CELLS)) {
      const name = String(t[0]);
      const named = new Set(Ev("rmap:proj_colnames", [name, CELLS]).map(String));
      for (const c of db.query('pragma table_info("' + name + '")').all().reverse()) {
        if (c.pk || !named.has(String(c.name))) continue;
        try { db.run('alter table "' + name + '" drop column "' + String(c.name) + '"'); }
        catch { continue; }                     // keyed, indexed or constrained: some other column
        table = name; col = String(c.name);
        break;
      }
      if (col) break;
    }
    db.close();
  }
  expect(col).not.toBe("");

  const make = (name, hash, how) => {
    const p = join(dir, name + ".db");
    const db = new Database(p);
    if (how === "bare") db.run("create table _meta (ft text, kind text, tbl text, arity int)");
    else makeTables(db);
    if (how === "short") db.run('alter table "' + table + '" drop column "' + col + '"');
    if (hash !== null) {
      db.run("create table _composition (hash text, schema text)");
      db.prepare("insert into _composition values(?,?)").run(hash, "0000000000000000");
    }
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
    return p;
  };

  try {
    // THE SCHEMA FITS, SO THE STORE LOADS -- whatever composition wrote it, and
    // whether or not it says which. Both are empty, so they reconstruct no cell
    // and the store they were asked about is unchanged.
    const before = CELLS.length;
    globalThis.AREST.loadStoreDb(make("other", "0000deadbeef0000"));
    globalThis.AREST.loadStoreDb(make("unstamped", null));
    expect(CELLS.length).toBe(before);

    // ONE COLUMN SHORT IS A REFUSAL, AND IT NAMES THE COLUMN. This module's own
    // stamp is on it, which at HEAD was enough to load it and read that table
    // as empty.
    let short = "";
    try { globalThis.AREST.loadStoreDb(make("short", stamp, "short")); } catch (e) { short = e.message; }
    expect(short).toContain(table);
    expect(short).toContain(col);
    expect(short).toContain("serve it with the module its own build wrote");

    // AND NO TABLES AT ALL IS THE 09-11 STORE, named table by table.
    let bare = "";
    try { globalThis.AREST.loadStoreDb(make("bare", stamp, "bare")); } catch (e) { bare = e.message; }
    expect(bare).toContain("no such table");
    expect(bare).toContain("serve it with the module its own build wrote");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
});

// ---- DOES THE STORE CARRY THE MAP IT WAS WRITTEN THROUGH? ------------------
//
// Sam, 2026-09-22: "The metaschema should be prebuilt by us into a table.
// That's how the bootstrap works. The metamodel doesn't change, and it's used
// to bootstrap other apps."
//
// THE CIRCLE. loadStoreDb asks lambda which tables to select from and which
// columns, and both answers are functions of state:fts. Measured at 7194e39f on
// a module composed from lambda alone (build.js reader -- the empty carrier):
// ast:fetch of state:fts answers #, rmap:coltabs throws `selector 1 on atom: #`
// in 3 ms and loadStoreDb throws the same before it has opened anything. The
// schema is what reads the tables and the schema is in the tables.
//
// SO THE STORE CARRIES ITS OWN MAP, in a table whose layout is known before
// anything is read, and that is what this holds: the map is WRITTEN (the same
// function compile.js calls, on a fixture built the way the durability tests
// build one), it is FAITHFUL (table for table and column for column against
// lambda's own two answers, in lambda's own order), and it is READ -- by a module
// with no readings at all, which is the only module that proves anything here,
// so it is composed and spawned rather than simulated in this one.
//
// AND ITS ABSENCE IS A DIFFERENT ANSWER, not a quiet one: the same module over
// the same store with the table dropped refuses and names the table that would
// have said what is in it.
test("a store carries the metaschema table it was written through, and a module with no readings opens it through that", () => {
  const dir = mkdtempSync(join(tmpdir(), "arest-meta-"));
  try {
    // ---- WRITTEN -----------------------------------------------------------
    const p = join(dir, "store.db");
    {
      const db = new Database(p);
      makeTables(db);
      const n = globalThis.AREST.writeMetaschema(db);
      expect(n).toBeGreaterThan(0);
      db.run("create table _composition (hash text, schema text)");
      db.prepare("insert into _composition values(?,?)").run(globalThis.AREST.composition, "0000000000000000");
      // one row, so the read below answers rows and not only tables
      db.prepare('insert into "Function" ("functionId") values (?)').run("probe-meta-fn");
      db.run("pragma wal_checkpoint(TRUNCATE)");
      db.close();
    }

    // ---- FAITHFUL: LAMBDA'S OWN TWO ANSWERS, IN LAMBDA'S OWN ORDER -----------
    // rmap:coltabs names the tables and rmap:proj_colnames their columns IN THE
    // ORDER THE PROJECTION FILLS THEM (its own note, arest ~17189) -- the order
    // the read loop selects in and rmap:unproj takes a tuple in. An unordered
    // comparison would pass on the permutation that put 218 values in the wrong
    // column the last time these two were zipped wrong.
    const want = new Map();
    for (const t of Ev("rmap:coltabs", CELLS)) {
      const table = String(t[0]);
      const cols = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
      if (cols.length) want.set(table, cols);
    }
    {
      const db = new Database(p, { readonly: true });
      const got = globalThis.AREST.readMetaschema(db);
      expect(got).not.toBe(null);
      expect([...got.keys()].sort()).toEqual([...want.keys()].sort());
      for (const [table, cols] of want) expect(got.get(table)).toEqual(cols);
      // AND EVERY COLUMN'S FACT TYPE IS THE ONE THE MAP CARRIES THERE. A relation
      // table is named BY its fact type and its role columns carry the IsInvolved
      // links, which is the shape the inverse reads a tuple from.
      const spans = db.query('select "col", "ft" from "_metaschema" where "tab" = ? order by "ord"').values("ConstraintSpan");
      expect(spans.length).toBeGreaterThan(0);
      expect(spans.map((r) => String(r[1]))).toContain("ConstraintIsInvolvedInConstraintSpan");
      expect(spans.map((r) => String(r[1]))).toContain("RoleIsInvolvedInConstraintSpan");
      db.close();
    }

    // ---- READ, BY A MODULE THAT CARRIES NO READINGS ------------------------
    // build.js reader splices lambda and nothing else, which is exactly the
    // empty-carrier module the note above measures. AREST_OUT_DIR keeps it in the
    // scratch directory rather than over this directory's modules.
    const readerDir = join(dir, "mod");
    mkdirSync(readerDir, { recursive: true });
    const built = Bun.spawnSync(["bun", "build.js", "reader"],
      { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: readerDir }, stdout: "pipe", stderr: "pipe" });
    expect(built.stdout.toString() + built.stderr.toString()).toContain("reader.g.js");

    const driver = join(dir, "open.mjs");
    writeFileSync(driver, [
      "await import(process.env.MODULE);",
      "const { Ev, CELLS, loadStoreDb, storeRaw } = globalThis.AREST;",
      "console.log('state:fts ' + Ev('ast:fetch', ['state:fts', CELLS]));",
      "try {",
      "  loadStoreDb(process.env.DB);",
      "  const raw = storeRaw();",
      "  let rows = 0; for (const t of raw.values()) rows += t.rows.length;",
      "  console.log('OPENED tables ' + raw.size + ' rows ' + rows);",
      "} catch (e) { console.log('REFUSED ' + e.message); }",
    ].join(String.fromCharCode(10)));
    const open = (db) => {
      const env = { ...process.env, MODULE: pathToFileURL(join(readerDir, "reader.g.js")).href, DB: db };
      delete env.AREST_STORE_DB;
      const r = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
      return r.stdout.toString() + r.stderr.toString();
    };

    // the module really does carry no schema, and it really does open the store
    const out = open(p);
    expect(out).toContain("state:fts #");
    expect(out).toContain("OPENED tables " + want.size + " rows 1");

    // AND WITHOUT THE TABLE IT IS THE STORE AT 7194e39f: nothing says what is in
    // it, and the refusal names the table that would have.
    const bare = join(dir, "bare.db");
    writeFileSync(bare, readFileSync(p));
    { const db = new Database(bare); db.run('drop table "_metaschema"'); db.run("pragma wal_checkpoint(TRUNCATE)"); db.close(); }
    const refused = open(bare);
    expect(refused).toContain("REFUSED");
    expect(refused).toContain("_metaschema");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);

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
// A STORE'S TABLES ARE THE SCHEMA THE READINGS DESCRIBE, so a fixture builds
// them the way compile.js does and emitToDb writes into them. What stood here
// was `create table _meta (ft, kind, tbl, arity)` and nothing else: the old
// writer invented a table per fact type on first write, named `r` and a hash of
// the name, with an arity guessed from the first row. rmap:ddl has every table
// the readings imply, populated or not, so there is no first write to invent
// for.
// A NAME FROM THE SCHEMA GOES BETWEEN DOUBLE QUOTES AND DOUBLES THE ONES IT
// CARRIES -- compile.js's qi, which a column named from prose earned.
const quo = (n) => '"' + String(n).split('"').join('""') + '"';
const makeTables = (db) => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  for (const stmt of flat(Ev("schema:ddl", CELLS)).split(";")) if (stmt.trim()) db.run(stmt + ";");
};

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
    makeTables(db);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
    return p;
  };
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore } = globalThis.AREST;",
    "if (process.env.MAKE) {",
    "  const b = popSnapshot(CELLS); closeStore(); console.log('made ' + emitToDb(b, CELLS));",
    "} else if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.KEY, 'probe-name']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) console.log('emitted ' + emitToDb(before, CELLS, prior)); }",
    "  console.log('status ' + out[1]);",
    "} else {",
    "  const rows = Ev('system:pop_rows', [process.env.FT, CELLS]);",
    "  console.log('present ' + rows.some((r) => String(r[0]) === process.env.KEY));",
    "}",
  ].join("\n"));

  const run = (db, write) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, FT, KEY };
    if (db) env.AREST_STORE_DB = db; else delete env.AREST_STORE_DB;
    if (write === "MAKE") env.MAKE = "1"; else if (write) env.WRITE = "1"; else delete env.WRITE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  try {
    const withDb = fresh("with.db"), without = fresh("without.db");
    const untouched = readFileSync(without);

    // AND NEITHER IS 201 (2026-09-18). These six assertions read
    // `status 201` until a deontic scoped on a supertype began binding its
    // subtype cone. `Stream is a subtype of Function`, and
    // `DEO:m:FunctionBelongsToDomain#1` is a deontic mandatory on Function,
    // whose cone is 112 of the base store's 131 object types. The base store
    // ALREADY carried 320 standing violations of that rule; the probe entity
    // is the 321st, and was invisible only because a runtime-created id is
    // filed under the declared player of the role it fills and the population
    // was an exact-name lookup. So 200 here is `committed_with_violations`
    // one line above 201's `committed` in http:status -- the row IS created
    // and IS in the body, main:create_outcome refuses only on an ALETHIC
    // violation, and every driver gates on < 400, which both pass. Pinning
    // 201 pinned the absence of a deontic warning on the probe entity, which
    // is a fact about the base readings and never what these tests are for.
    // `20[01]` rather than `200`: brittle the other way, and it breaks the
    // day a probe entity is given a Domain.
    // HOW MANY fact types move is not the claim and is not pinned: against the
    // full base store.db this write emits 1 and against this empty _meta it
    // emits 2, because a carriers boot has more to diff. The claim is that
    // SOMETHING reached the tables, and that the row is there on the next boot.
    // THE FIXTURE IS MADE THE WAY THE CHECK MAKES A STORE (2026-09-21): its
    // tables, then the closure written into them once. A start computes
    // nothing now, so a store whose tables were never closed is not a store
    // the check would have left, and a create over it is refused on what the
    // closure would have supplied.
    expect(run(withDb, "MAKE")).toMatch(/made \d+/);
    const wrote = run(withDb, true);
    expect(wrote).toMatch(/status 20[01]/);
    expect(wrote).toMatch(/emitted [1-9]/);
    expect(run(withDb, false)).toContain("present true");

    // the same write with no database attached: it still answers, emits
    // nothing, leaves the file it was never given alone, and is gone next boot
    const memoryOnly = run(null, true);
    expect(memoryOnly).toMatch(/status 20[01]/);
    expect(memoryOnly).toContain("emitted 0");
    expect(readFileSync(without).equals(untouched)).toBe(true);
    expect(run(without, false)).toContain("present false");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);

// ---- A WRITE WHOSE ROWS THE DATABASE REFUSES IS NOT COMMITTED --------------
//
// emitToDb wrote each row in a try of its own and took a refusal for a row that
// was not the table's, so a POST the closure admitted and the database refused
// answered 201 `committed` while the table kept nothing: the process held the
// row, and the next boot did not (2026-10-03, a primary key over two roles of a
// ternary on a test store; a uniqueness over a span now refuses that write at the
// gate, and any other refusal still went unsaid). Here every table of the store
// refuses every insert, so the row this create writes is refused. The answer is
// not committed and says why, the store the process holds is the one before the
// write, and so is the next boot's.
test("a write whose rows the database refuses is not committed, and the store is as it was", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-write-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const FT = "StreamHasName", KEY = "probe-stream-" + Math.random().toString(36).slice(2, 8);
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, emitToDb, closeStore, answerWrite } = globalThis.AREST;",
    "const has = () => Ev('system:pop_rows', [process.env.FT, CELLS]).some((r) => String(r[0]) === process.env.KEY);",
    "if (process.env.MAKE) {",
    "  const b = popSnapshot(CELLS); closeStore(); console.log('made ' + emitToDb(b, CELLS));",
    "} else if (process.env.WRITE) {",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.KEY, 'probe-name']]);",
    "  const [body, status] = answerWrite(out);",
    "  console.log('status ' + status + ' ' + body);",
    "  console.log('present ' + has());",
    "} else {",
    "  console.log('present ' + has());",
    "}",
  ].join("\n"));
  const run = (db, mode) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, FT, KEY, AREST_STORE_DB: db };
    delete env.MAKE; delete env.WRITE;
    if (mode) env[mode] = "1";
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };
  try {
    const path = join(dir, "store.db");
    const db = new Database(path);
    makeTables(db);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.close();
    expect(run(path, "MAKE")).toMatch(/made \d+/);
    const refusing = new Database(path);
    const tables = refusing.query("select name from sqlite_master where type = 'table'").values().map((r) => String(r[0]))
      .filter((t) => !t.startsWith("_") && !t.startsWith("sqlite_"));
    for (const t of tables)
      refusing.run("create trigger " + quo("refuse " + t) + " before insert on " + quo(t) + " begin select raise(abort, 'refused by the test'); end");
    refusing.close();
    expect(tables.length).toBeGreaterThan(0);
    const wrote = run(path, "WRITE");
    expect(wrote).toMatch(/status 500 \["not_committed",/);
    expect(wrote).toContain("refused by the test");
    expect(wrote).toContain("present false");
    expect(run(path, null)).toContain("present false");
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
// The tables hold the whole population now, so the fixture is simply a store
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
  makeTables(db0);
  db0.run("create table _composition (hash text)");
  db0.prepare("insert into _composition values(?)").run(stamp);
  db0.run("pragma wal_checkpoint(TRUNCATE)");
  db0.close();

  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore } = globalThis.AREST;",
    "if (process.env.MAKE) {",
    "  const b = popSnapshot(CELLS); closeStore(); console.log('made ' + emitToDb(b, CELLS));",
    "} else if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.WRITE, 'probe-name']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) emitToDb(before, CELLS, prior); }",
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
    if (write === "MAKE") env.MAKE = "1"; else if (write) env.WRITE = write; else delete env.WRITE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  try {
    // the fixture's own build: the closure written once as the check writes
    // it, then one write; every row it leaves is the ledger's
    expect(run("MAKE")).toMatch(/made \d+/);
    expect(run(PRIME)).toMatch(/status 20[01]/);
    // NO LEDGER IS FILLED. It held the rows the tables had BEFORE this write, so
    // the loader could tell the runtime's rows from the build's and carry only
    // those into the source. The tables now hold the whole population and are
    // adopted whole, so there is nothing to tell apart and nothing to record.

    // and now the write under test, in its own process, read back in a third
    expect(run(KEY)).toMatch(/status 20[01]/);
    const back = run(null);
    expect(back).toContain("fact true");     // the instance fact reached the tables
    expect(back).toContain("listed true");   // and the loaded store knows the id is one
    expect(back).toContain("row true");      // the fact it was created with is there too
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 180_000);

// ---- AND IS WHAT THE CLOSURE DERIVES OVER THAT INSTANCE IN THE TABLES? -----
//
// The test above is that the runtime's OWN rows survive a boot. This is the
// rows nobody wrote: `State Machine is for Object Type Instance` is one machine
// per instance of an object type a State Machine Definition is for, and no
// write emits it -- reflection runs at LOAD, so main:api's successor store does
// not carry it and there is nothing for emitToDb to diff. tools/compile-store.js
// cannot write it either: it boots with AREST_STORE_DB deleted, on purpose, so
// that the tables are what the READINGS say, and it carries the
// runtime's rows back into the tables only afterwards, with nothing re-derived
// over them. So the machine of an entity created through the API existed in
// every server's memory and in no store on disk.
//
// Measured 2026-09-18 on support.auto.dev's live store (built 21:37 the evening
// before): the tables hold FIVE machines, sm.Free sm.Starter sm.Growth sm.Scale
// sm.Enterprise, the five Plans the readings declare as VALUES, and the same
// store booted through loadStoreDb answers SIX -- the sixth is
// sm.sr-chris-pennington-20260913, the one Support Request a person created
// through the MCP, at Draft, which is what its stored AdminAcceptsSupportRequest
// implies. `actions` on that request has always answered its four affordances,
// off the same main:status_pop, so the stored fact and the menu were two
// computations and a worklist read off the tables found no live request.
//
// The other thirteen definitions produce nothing in either reading and that is
// not the defect: support holds no instance of Error Pattern, Connect Session,
// Subscription, Schema Design, Relational Mapping, Domain Change, Agent Chat,
// Escrow, Incident, Feature Request, Support Response, Chat Response or Support
// Chat, in the tables or in the registry, so there is no machine to derive.
//
// Here the base's own CSDP machine stands in for support's: Schema Design is
// what it is for, a created one seeds at step1-elementary-facts, and the tables
// are read with sqlite alone -- no lambda, no closure -- because a check that
// asked lambda would be asking the very computation whose answer was never
// stored.
test("the machine a boot derives over a runtime row is in the tables", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-closure-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const FT = "SchemaDesignHasDesignNote";        // Schema Design is what CSDP is the machine for
  const MACH = "StateMachineIsForObjectTypeInstance";
  const STAT = "StateMachineIsCurrentlyInStatus";
  const PRIME = "probe-prime-" + Math.random().toString(36).slice(2, 8);
  const KEY = "probe-design-" + Math.random().toString(36).slice(2, 8);

  const path = join(dir, "closure.db");
  const db0 = new Database(path);
  makeTables(db0);
  db0.run("create table _composition (hash text)");
  db0.prepare("insert into _composition values(?)").run(stamp);
  db0.run("pragma wal_checkpoint(TRUNCATE)");
  db0.close();

  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore } = globalThis.AREST;",
    "const flat = (v) => { let x = v; while (Array.isArray(x)) x = x.length ? x[0] : null; return x; };",
    "if (process.env.MAKE) {",
    "  const b = popSnapshot(CELLS); closeStore(); console.log('made ' + emitToDb(b, CELLS));",
    "} else if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.WRITE, 'probe note']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) emitToDb(before, CELLS, prior); }",
    "  console.log('status ' + out[1]);",
    "} else {",
    "  const m = Ev('system:pop_rows', ['StateMachineIsForObjectTypeInstance', CELLS]);",
    "  console.log('memory ' + m.some((r) => String(flat(r[1])) === process.env.KEY));",
    "}",
  ].join("\n"));

  const run = (write) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, FT, KEY, AREST_STORE_DB: path };
    if (write === "MAKE") env.MAKE = "1"; else if (write) env.WRITE = write; else delete env.WRITE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  // WHERE A FACT LIVES IS THE SCHEMA'S ANSWER. This read the tables with no
  // lambda at all, which it could while every fact type had a table of its own
  // named `r` and a hash of it. Neither of these two has a table: State Machine
  // is a subtype of Function and both are carried as COLUMNS of it, so which
  // table and which column is rmap:ctab's answer and nobody else's.
  const carriers = (ft) => {
    const out = [];
    for (const t of Ev("rmap:ctab", CELLS)) {
      const cn = Ev("rmap:proj_colnames", [String(t[1]), CELLS]).map(String);
      t[2].forEach((col, i) => {
        if (String(Ev("rmap:proj_carried", Array.isArray(col[2]) ? col[2] : [])) === ft) out.push([String(t[1]), cn[i]]);
      });
    }
    return out;
  };
  const stored = (ft) => {
    const db = new Database(path, { readonly: true });
    const out = [];
    try {
      for (const [table, col] of carriers(ft)) {
        const keys = Ev("rmap:ddl_pkof", [table, CELLS]).map(String);
        const cols = keys.concat([col]);
        for (const r of db.query("select " + cols.map((c) => '"' + c + '"').join(",")
              + ' from "' + table + '" where "' + col + '" is not null').values()) out.push(r.map(String));
      }
      return out;
    } catch { return []; } finally { db.close(); }
  };
  // AND THIS IS WHAT A REBUILD LEAVES. tools/compile-store.js writes the rows
  // the CARRIERS imply and carries the runtime's own rows back afterwards, so
  // the fact reaches the tables and the machine it implies does not. Taking the
  // two derived rows away is that build, exactly: support's 21:37 store is its
  // own tables with sm.sr-chris-pennington-20260913 and its Draft missing and
  // every fact of the request still there.
  const rebuild = (needle) => {
    const db = new Database(path);
    try {
      for (const ft of [MACH, STAT]) {
        // and taking the machine away is clearing the column that carries it
        for (const [table, col] of carriers(ft)) {
          try { db.run('update "' + table + '" set "' + col + '" = null where "' + col + '" like ?', ["%" + needle + "%"]); }
          catch { /* a table this database does not have */ }
        }
      }
      db.run("pragma wal_checkpoint(TRUNCATE)");
    } finally { db.close(); }
  };

  try {
    // the fixture's own build: the closure written once as the check writes
    // it, then one write; every row it leaves is the ledger's
    expect(run("MAKE")).toMatch(/made \d+/);
    expect(run(PRIME)).toMatch(/status 20[01]/);
    // NO LEDGER IS FILLED. It held the rows the tables had BEFORE this write, so
    // the loader could tell the runtime's rows from the build's and carry only
    // those into the source. The tables now hold the whole population and are
    // adopted whole, so there is nothing to tell apart and nothing to record.

    // the write under test, and then the store a rebuild would leave: the
    // request's facts, and no machine for it
    expect(run(KEY)).toMatch(/status 20[01]/);
    rebuild(KEY);
    expect(stored(MACH).some((r) => r.includes(KEY))).toBe(false);

    // and now the CHECK's closure over those tables (compile.js adopts its
    // build, closes it under the reflection and the rules, and writes what that
    // adds; 2026-09-21): it derives the machine and stores it, and a start
    // reads it from the tables and computes nothing
    expect(run("MAKE")).toMatch(/made [1-9]/);
    expect(run(null)).toContain("memory true");
    const J = JSON.stringify;
    // THE MACHINE IS THE INSTANCE'S COLUMN (2026-09-21). The column that
    // carries StateMachineIsForObjectTypeInstance is Function.objectTypeInstanceStateMachineId,
    // reached through the Object Type Instance -- the second declared player --
    // so the row is the instance's and the value the machine's id. The
    // projection put it in the machine's row until today (the path's role was
    // not honoured), and this line pinned that placement.
    expect(stored(MACH).some((r) => J(r) === J([KEY, "sm." + KEY]))).toBe(true);
    expect(stored(STAT).some((r) => J(r) === J(["sm." + KEY, "step1-elementary-facts"]))).toBe(true);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 180_000);

// ---- AND IS A POPULATION IN ANOTHER ORDER A CHANGE? ------------------------
//
// The test above is that the closure's rows reach the tables. This is what
// "changed" means when the boot decides to write them. The write-back is the
// write's three lines over the closure -- snapshot, close, emit what changed --
// and a snapshot was the JSON text of a population's rows AS ORDERED. The two
// sides of the boot's diff never agree on an order: the tables answer in their
// key order (loadStoreDb's own note, 17 of 49 on the base corpus) and the
// closure answers in the readings', so the same rows compared unequal and the
// boot deleted and re-inserted them. Measured 2026-09-21 on a copy of
// qa.auto.dev's store, written back once already: FactTypeHasReading (513
// rows) and FunctionBelongsToDomain (737) were called changed at every boot
// and were the same set each time. A population is a SET, the DDL stores no
// order, and the diff now compares it as one: the rows' JSON texts sorted and
// made unique, on both sides.
//
// The store on the other side of the diff is made the way loadStoreDb makes
// it, store:src_all over the same rows in another order, and its snapshot is
// the host's own; the fixture is the tables the readings describe, empty, so
// that a changed population has somewhere to land -- the reordered store
// writes nothing because it is not a change, not because there is no table.
// THE COMPILER HOLDS A DESIGN-STATE CELL FLAT AND A MODULE HOLDS IT IN THE
// CARRIER'S NINE-WIDE CHUNKS, and a definition that reads one answers the same
// rows over both. solve:declared flattened exactly once: over the flat shape it
// answered 524 elements, 262 of them bare fact type names, and rmap:proj_rows
// threw `selector 1 on atom: DomainHasDescription` the first time compile.js
// wrote a store through the projection (2026-09-21). Failing at a22a756e.
test("solve:declared answers the same rows over the flat schema as over the chunked one", () => {
  const chunked = Ev("solve:declared", CELLS);
  expect(chunked.length).toBeGreaterThan(0);
  expect(chunked.every(Array.isArray)).toBe(true);
  const flat = Ev("rmap:unfold4", Ev("ast:fetch", ["state:declared", CELLS]));
  expect(flat.every(Array.isArray)).toBe(true);
  const cells = CELLS.filter((c) => !(Array.isArray(c) && c[0] === "CELL" && c[1] === "state:declared"));
  expect(cells.length).toBe(CELLS.length - 1);
  cells.unshift(["CELL", "state:declared", flat]);
  const over = Ev("solve:declared", cells);
  expect(over.filter((r) => !Array.isArray(r)).length).toBe(0);
  expect(JSON.stringify(over)).toBe(JSON.stringify(chunked));
});
test("a population in another order is not a change; one row fewer is", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-asset-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const path = join(dir, "asset.db");
  const db0 = new Database(path);
  makeTables(db0);
  db0.run("create table _composition (hash text)");
  db0.prepare("insert into _composition values(?)").run(stamp);
  db0.run("pragma wal_checkpoint(TRUNCATE)");
  db0.close();

  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, emitToDb } = globalThis.AREST;",
    "// a fact type a table carries, with rows enough to have an order",
    "const carried = new Set(Ev('rmap:ctab', CELLS).map((t) => String(t[0])));",
    "const snap = popSnapshot(CELLS);",
    "const ft = [...snap.keys()].find((k) => carried.has(k) && JSON.parse(snap.get(k)).length > 1);",
    "const rows = JSON.parse(snap.get(ft));",
    "const reordered = Ev('store:src_all', [[[ft, rows.slice().reverse()]], CELLS]);",
    "const fewer = Ev('store:src_all', [[[ft, rows.slice(1)]], CELLS]);",
    "console.log('ft ' + ft + ' rows ' + rows.length);",
    "console.log('same ' + emitToDb(snap, CELLS));",
    "console.log('reordered ' + emitToDb(popSnapshot(reordered), CELLS));",
    "console.log('fewer ' + emitToDb(popSnapshot(fewer), CELLS));",
  ].join("\n"));
  const p = Bun.spawnSync(["bun", driver], {
    env: { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path }, stdout: "pipe", stderr: "pipe" });
  const out = p.stdout.toString() + p.stderr.toString();
  try {
    expect(out).toMatch(/ft \S+ rows (?:[2-9]|\d{2,})\b/);
    expect(out).toContain("same 0");             // the same rows in the same order never were a change
    expect(out).toContain("reordered 0");        // the same rows in another order are not one either
    expect(out).toMatch(/\bfewer [1-9]/);        // a row the tables lack is
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);

// ---- AND `get` READS THE ROWS THAT NAME THE ID, NOT THE WHOLE STORE -----------
//
// Sam, 2026-09-25: "rmap is supposed to be done on compile, not every time you call
// a column?" The DEF of `get` projected the whole store again -- rmap over every group
// and relation, then one cell taken -- and on support.auto.dev the first `get` cost
// 2.2 s and a gigabyte for one entity's row, which the tables already hold. Since
// 2026-10-01 it reads every population to cut each to the rows that hold the id
// (get:cut) and answers the entity's facts and links from those. Its twin
// is the DEF over the store cut to the facts that name the id. So, over a store built
// the way the check builds one: for ids from every keyed table (up to twenty of each), a
// value that is no entity and an id that is nothing, the twin answers what the DEF
// answers; the twin reads no table whole for an id that names no fact type, where
// the DEF reads them (an id that NAMES one is evaluated apart: until 2026-10-01 the
// DEF merged that fact type's relation cell into its answer and the twin read it
// whole, the base's StatusIsTerminalInStateMachineDefinition); and the served
// route, which applies the verb cell's body rather than calling the name, reaches
// the twin -- `main` answering `get` reads no table whole either. Failing with
// AREST_NOTWIN=get (the whole-read assertions) and with the twin found only by name
// (the route's).
test("get over a store read from its tables reads the rows that name the id, and answers what the DEF answers", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-get-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const path = join(dir, "store.db");
  {
    const db = new Database(path);
    makeTables(db);
    expect(globalThis.AREST.writeMetaschema(db)).toBeGreaterThan(0);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
  }
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "import { Database } from 'bun:sqlite';",
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, DEFS, popSnapshot, emitToDb, closeStore, storeRead } = globalThis.AREST;",
    "const say = (k, v) => console.log(k + '=' + JSON.stringify(v));",
    "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore(); say('made', emitToDb(b, CELLS)); process.exit(0); }",
    "const db = new Database(process.env.AREST_STORE_DB, { readonly: true });",
    "const st = Ev('store:state', CELLS);",
    "// an id that names a fact type is evaluated apart, as the twin read that fact type whole until 2026-10-01",
    "const named = new Set(st[0].map((d) => String(d[0])));",
    "const ids = [];",
    "for (const t of db.query(\"select name from sqlite_master where type = 'table' and substr(name, 1, 1) <> '_'\").values().map((r) => String(r[0]))) {",
    "  const pk = db.query('select name from pragma_table_info(?) where pk > 0').values(t).map((r) => String(r[0]));",
    "  if (pk.length !== 1) continue;",
    "  const vals = db.query('select \"' + pk[0] + '\" from \"' + t + '\" where \"' + pk[0] + '\" is not null').values().map((r) => String(r[0]));",
    "  const step = Math.max(1, Math.floor(vals.length / 20));",
    "  for (let i = 0; i < vals.length; i += step) ids.push(vals[i]);",
    "  // the stride alone can miss every key that names a fact type: one more fact type in the base",
    "  // (2026-09-28) moved it off all 300 of Function's. So a table also offers its first such key.",
    "  const fn = vals.find((v) => named.has(v));",
    "  if (fn !== undefined && !ids.includes(fn)) ids.push(fn);",
    "}",
    "ids.push('no-such-id-anywhere');",
    "say('ids', ids.length);",
    "say('named', ids.filter((id) => named.has(id)).length);",
    "const before = storeRead();",
    "const twin = new Map();",
    "for (const id of ids) if (!named.has(id)) twin.set(id, JSON.stringify(Ev('get', [id, st])));",
    "say('twin reads', { tables: storeRead().tables - before.tables, scans: storeRead().scans - before.scans });",
    "for (const id of ids) if (named.has(id)) twin.set(id, JSON.stringify(Ev('get', [id, st])));",
    "const plain = ids.find((id) => !named.has(id));",
    "const was = storeRead().tables;",
    "const served = Ev('main', [CELLS, ['get', plain]]);",
    "say('served reads', storeRead().tables - was);",
    "const def = DEFS.get('get');",
    "const same = ids.filter((id) => JSON.stringify(Ev(def, [id, st])) === twin.get(id)).length;",
    "say('same', same);",
    "say('def reads', storeRead().tables - before.tables);",
    "say('served same', JSON.stringify(Ev('main', [CELLS, ['get', plain]])) === JSON.stringify(served));",
  ].join("\n"));
  const run = (extra) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path, ...extra };
    delete env.AREST_EAGER_STORE;
    if (!extra.AREST_NOTWIN) delete env.AREST_NOTWIN;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    const got = { out: p.stdout.toString() + p.stderr.toString() };
    for (const line of p.stdout.toString().split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) try { got[line.slice(0, i)] = JSON.parse(line.slice(i + 1)); } catch { /* not a line of ours */ }
    }
    return got;
  };
  try {
    const made = run({ MAKE: "1" });
    expect(made.made, made.out).toBeGreaterThan(0);
    const got = run({});
    expect(got.ids, got.out).toBeGreaterThan(50);
    expect(got.named).toBeGreaterThan(0);                // some ids name fact types
    expect(got["twin reads"].tables).toBe(0);          // and no other id reads a table whole
    expect(got["twin reads"].scans).toBeGreaterThan(0);
    expect(got["served reads"]).toBe(0);                // the served route took the twin
    expect(got.same).toBe(got.ids);                     // and every answer is the DEF's
    expect(got["def reads"]).toBeGreaterThan(0);        // which reads the tables whole
    expect(got["served same"]).toBe(true);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 240_000);



// ---- AND A GET'S LINKS READ THE TABLES THAT NAME THE ID, BEFORE A WRITE AND AFTER ONE ----------
//
// A GET's links are nav:peers <id, FILE>: each population whose atoms hold the id. Its DEF reads
// every population, which over a store read from its tables is every table: on a copy of support
// a keyed GET of one Cancel Request read 1,666 populations for the 24 that hold it. The twin
// (host.js, 2026-10-03) decides a FILE cell nothing has read yet from the scan for the id
// (lazyStore's mentioning) and leaves the cell unread. A twin answers what its DEF answers over
// the same store at every call, and only the host can hold it to that -- a case composes its
// store and never reads one from tables -- so this is a test and not a case. At start: ids of
// every object type, up to two of each, and an id that is nothing. After a write: FILE keeps the
// cell it had for a head the write's closure moved (main:refile1 refiles the written fact type
// alone, and before store:closed_from), and that cell holds the rows its descriptor held when
// they were first read -- here, before the write -- while the tables hold the rows after it. So
// the twin leaves a fact type a write moved to the DEF. The write is Domain state is contained in
// Domain core, which moves Domain reaches Domain, read before it through its descriptor; without
// that, the twin named 'state' a peer in it and the DEF did not.
test("a GET's links over a store read from its tables are the DEF's, at start and after a write that moved a head", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-peers-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const path = join(dir, "store.db");
  {
    const db = new Database(path);
    makeTables(db);
    expect(globalThis.AREST.writeMetaschema(db)).toBeGreaterThan(0);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
  }
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, DEFS, popSnapshot, adoptStore, emitToDb, closeStore, storeRead } = globalThis.AREST;",
    "const say = (k, v) => console.log(k + '=' + JSON.stringify(v));",
    "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore(); say('made', emitToDb(b, CELLS)); process.exit(0); }",
    "// a write as the server makes one: main:api, its successor adopted, what moved emitted",
    "const contain = (args) => { const prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, 'POST', 'DomainIsContainedInDomain', '', args]);",
    "  if (out.length > 2 && Number(out[1]) < 400) { adoptStore(out[2]); emitToDb(null, CELLS, prior); }",
    "  return Number(out[1]); };",
    "if (process.env.PRE) { say('pre', contain(['law', 'core'])); process.exit(0); }",
    "const ids = ['state', 'law', 'core'], per = new Map();",
    "for (const r of Ev('system:pop_rows', ['ObjectTypeInstanceIsInstanceOfObjectType', CELLS])) {",
    "  const ty = JSON.stringify(r[1]), n = per.get(ty) || 0;",
    "  if (n < 2 && typeof r[0] === 'string' && !ids.includes(r[0])) { ids.push(r[0]); per.set(ty, n + 1); } }",
    "ids.push('no-such-id-anywhere');",
    "say('ids', ids.length);",
    "Ev('ast:fetch', ['FILE', CELLS]);",
    "if (process.env.WRITE) {",
    "  // the head's rows are read through its descriptor, and FILE's cell for it is not read",
    "  say('reach before', Ev('store:fts', CELLS).find((d) => d[0] === 'DomainReachesDomain')[4]);",
    "  say('status', contain(['state', 'core']));",
    "  say('reach after', Ev('system:pop_rows', ['DomainReachesDomain', CELLS]));",
    "}",
    "const file = Ev('ast:fetch', ['FILE', CELLS]);",
    "const s0 = storeRead().scans;",
    "const twin = ids.map((id) => JSON.stringify(Ev('nav:peers', [id, file])));",
    "say('twin scans', storeRead().scans - s0);",
    "say('peers', twin.reduce((a, p) => a + JSON.parse(p).length, 0));",
    "const def = DEFS.get('nav:peers');",
    "say('differ', ids.filter((id, i) => JSON.stringify(Ev(def, [id, file])) !== twin[i]));",
  ].join("\n"));
  const run = (extra) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path, ...extra };
    delete env.AREST_EAGER_STORE;
    delete env.AREST_NOTWIN;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    const got = { out: p.stdout.toString() + p.stderr.toString() };
    for (const line of p.stdout.toString().split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) try { got[line.slice(0, i)] = JSON.parse(line.slice(i + 1)); } catch { /* not a line of ours */ }
    }
    return got;
  };
  try {
    const made = run({ MAKE: "1" });
    expect(made.made, made.out).toBeGreaterThan(0);
    const pre = run({ PRE: "1" });                       // law in core: Domain reaches Domain holds a row
    expect(pre.pre, pre.out).toBeGreaterThanOrEqual(200);
    expect(pre.pre).toBeLessThan(400);
    const start = run({});
    expect(start.ids, start.out).toBeGreaterThan(20);
    expect(start["twin scans"]).toBeGreaterThan(0);      // the twin took the scan
    expect(start.peers).toBeGreaterThan(0);
    expect(start.differ).toEqual([]);                    // and answered every id as the DEF does
    const after = run({ WRITE: "1" });
    expect(after.status, after.out).toBeGreaterThanOrEqual(200);
    expect(after.status).toBeLessThan(400);
    expect(after["reach before"]).toEqual([["law", "core"]]);
    expect(after["reach after"]).toContainEqual(["state", "core"]);   // the closure moved the head
    expect(after["twin scans"]).toBeGreaterThan(0);
    expect(after.differ).toEqual([]);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 240_000);



// ---- A STORE IS READ WHEN ASKED, AND READ ONCE -----------------------------
//
// A server over a store reads no rows at start (host.js, lazyStore): each
// stored fact type is a cell read from its tables the first time anything
// reaches into it. Three things have to hold, and each is a count or a
// comparison only a test like this can make. ONE POPULATION READS ITS OWN
// TABLE: a relation table's fact type costs one select and nothing else, and
// so does FILE's cell for another -- ast:FetchPop reads FILE for every fact
// type whose own cell is #, and FILE was adopted from every population to
// answer one, every table read and store:src_all over all of them (support,
// 2026-09-24: 5.5-6.5 s of the MCP server's first answer, spent on
// DomainReachesDomain, which is empty). NO TABLE IS READ TWICE before a write:
// the instance-of table was read at start for state:otpops and again by the
// first whole-store read, and support's Function table, 19,080 rows, once for
// the tools and again for FILE. AND EVERY ANSWER IS THE WHOLE LOAD'S: every
// stored fact type's rows, FILE and the descriptors, digested, the same read
// on demand as read whole at start (AREST_EAGER_STORE=1), before a write and
// after one -- and the row a write over a store read on demand made is there
// after a restart.
test("a store is read when asked: a population reads its own table, none is read twice, and every answer is the whole load's", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-lazy-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const path = join(dir, "store.db");
  {
    const db = new Database(path);
    makeTables(db);
    expect(globalThis.AREST.writeMetaschema(db)).toBeGreaterThan(0);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
  }
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "import { Database } from 'bun:sqlite';",
    "import { createHash } from 'node:crypto';",
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore, storeRead } = globalThis.AREST;",
    "const say = (k, v) => console.log(k + '=' + JSON.stringify(v));",
    "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore(); say('made', emitToDb(b, CELLS)); process.exit(0); }",
    "if (process.env.WRITE) {",
    "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, 'POST', 'StreamHasName', '', ['probe-lazy-stream', 'probe-name']]);",
    "  if (out.length > 2 && Number(out[1]) < 400) { adoptStore(out[2]); say('emitted', emitToDb(before, CELLS, prior)); }",
    "  say('status', Number(out[1]));",
    "  process.exit(0);",
    "}",
    "say('start', storeRead());",
    "// two relation tables with rows, beside the one the start reads, chosen from the store",
    "const db = new Database(process.env.AREST_STORE_DB, { readonly: true });",
    "const rel = Ev('rmap:coltabs', CELLS).map((t) => String(t[0])).filter((t) => t !== 'ObjectTypeInstanceIsInstanceOfObjectType'",
    "  && Ev('rmap:unproj_isrel', [t, CELLS]) === 'T' && db.query('select count(*) n from \"' + t + '\"').get().n > 0);",
    "say('relations', rel.length);",
    "say('one', Ev('system:pop_rows', [rel[0], CELLS]).length);",
    "say('after one', storeRead());",
    "const file = Ev('ast:fetch', ['FILE', CELLS]);",
    "say('file cell', Array.isArray(Ev('ast:fetch', [rel[1], file])));",
    "say('after file', storeRead());",
    "popSnapshot(CELLS);",
    "say('after all', storeRead());",
    "const fts = [...new Set(db.query('select ft from _metaschema').values().map((r) => r[0])",
    "  .filter((ft) => ft !== null && ft !== '#').map(String).concat(rel))].sort();",
    "const h = createHash('sha256');",
    "for (const ft of fts) h.update(ft + ' ' + JSON.stringify(Ev('system:pop_rows', [ft, CELLS])) + ' ');",
    "h.update(JSON.stringify(Ev('ast:fetch', ['FILE', CELLS])));",
    "h.update(JSON.stringify(Ev('store:fts', CELLS)));",
    "say('fact types', fts.length);",
    "say('digest', h.digest('hex'));",
    "say('probe', Ev('system:pop_rows', ['StreamHasName', CELLS]).some((r) => String(r[0]) === 'probe-lazy-stream'));",
  ].join("\n"));
  const run = (extra) => {
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path, ...extra };
    if (!extra.AREST_EAGER_STORE) delete env.AREST_EAGER_STORE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    const got = { out: p.stdout.toString() + p.stderr.toString() };
    for (const line of p.stdout.toString().split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) try { got[line.slice(0, i)] = JSON.parse(line.slice(i + 1)); } catch { /* not a line of ours */ }
    }
    return got;
  };
  try {
    // THE FIXTURE IS MADE THE WAY THE CHECK MAKES A STORE: its tables, the
    // metaschema it is read through, then the closure written into them once
    const made = run({ MAKE: "1" });
    expect(made.made, made.out).toBeGreaterThan(0);

    const lazy = run({}), eager = run({ AREST_EAGER_STORE: "1" });
    expect(eager.start, eager.out).toBe(null);          // read whole at start: nothing to count
    expect(lazy.start, lazy.out).not.toBe(null);
    expect(lazy.start.tables).toBeLessThanOrEqual(1);   // the instance-of table, for state:otpops
    expect(lazy.relations).toBeGreaterThanOrEqual(2);
    expect(lazy.one).toBeGreaterThan(0);
    // one population: one select, one table
    expect(lazy["after one"].selects).toBe(lazy.start.selects + 1);
    expect(lazy["after one"].tables).toBe(lazy.start.tables + 1);
    // FILE's cell for another: one select, one table, and not the store
    expect(lazy["file cell"]).toBe(true);
    expect(lazy["after file"].selects).toBe(lazy["after one"].selects + 1);
    expect(lazy["after file"].tables).toBe(lazy["after one"].tables + 1);
    // every population, and no table read twice
    expect(lazy["after all"].tables).toBeGreaterThan(lazy["after file"].tables);
    expect(lazy["after all"].most).toBe(1);
    expect(lazy["fact types"]).toBeGreaterThan(100);
    expect(lazy.digest).toBe(eager.digest);
    expect(lazy.probe).toBe(false);

    // a write over the store read on demand, and a restart each way
    const wrote = run({ WRITE: "1" });
    expect(wrote.status, wrote.out).toBeGreaterThanOrEqual(200);
    expect(wrote.status).toBeLessThan(400);
    expect(wrote.emitted).toBeGreaterThan(0);
    const lazy2 = run({}), eager2 = run({ AREST_EAGER_STORE: "1" });
    expect(lazy2.probe, lazy2.out).toBe(true);
    expect(eager2.probe, eager2.out).toBe(true);
    expect(lazy2.digest).toBe(eager2.digest);
    expect(lazy2.digest).not.toBe(lazy.digest);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 240_000);


// ---- A WRITE REWRITES THE ROWS IT MOVED -------------------------------------
//
// emitToDb re-projected every table a write touched, whole, and a create on
// support.auto.dev touches Function: 20,159 rows by 301 columns re-projected to
// land two, 29.8 s and 70,892 rows written of a 51 s create (2026-09-25). Now
// the rows the moved facts name are deleted and written again from lambda
// (host.js, rowPlanner), and no other row is touched. What has to hold is that
// nothing the whole rewrite would have written is missed. So the same six
// writes run twice over one store -- once handed the store as it was, as the
// servers now hand it, and once without, which rewrites the tables whole as
// compile.js does -- and after EVERY write the two stores hold the same rows in
// every table. The writes are the ones a store takes: an entity created, one
// with a state machine, a value replaced, a fact deleted, a relation's row
// added and removed. And lambda's projection is the witness over both: no table
// ends further from it than it began. Three base tables are not their
// projection even as the store is made -- FunctionIsSupersededByFunction,
// GuardReferencesFactType and ObjectTypeIsSubtypeOfObjectType read back as other
// rows, which is rmap's round trip and not a write's -- so the claim is that the
// writes add nothing to it. The whole rewrite writes hundreds of times the rows.
// And handed the WRONG store as it was -- the store after, so nothing looks moved
// -- the stores must part at the first write, or the comparison is not one.
test("a write rewrites the rows it moved, and leaves every table as the whole rewrite would", () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-rows-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const made = join(dir, "made.db");
  {
    const db = new Database(made);
    makeTables(db);
    globalThis.AREST.writeMetaschema(db);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(stamp);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();
  }
  const driver = join(dir, "drive.mjs");
  writeFileSync(driver, [
    "import { createHash } from 'node:crypto';",
    "await import(process.env.MODULE);",
    "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore, storeDb } = globalThis.AREST;",
    "const say = (k, v) => console.log(k + '=' + JSON.stringify(v));",
    "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore(); say('made', emitToDb(b, CELLS)); process.exit(0); }",
    "const flat = (v) => (Array.isArray(v) ? v.map(flat).join('') : String(v));",
    "const cell = (v) => (v === '#' || v === undefined ? null : flat(v));",
    "const db = storeDb(), Q = String.fromCharCode(34);",
    "const tables = [...new Set(Ev('rmap:ctab', CELLS).map((t) => String(t[1])))].sort();",
    "// every table's rows, sorted, as one digest",
    "const digest = () => {",
    "  const h = createHash('sha256');",
    "  for (const t of tables) { let rows = []; try { rows = db.query('select * from [' + t + ']').values().map((r) => JSON.stringify(r)).sort(); } catch {} h.update(t + ' ' + rows.join(' ') + ' '); }",
    "  return h.digest('hex');",
    "};",
    "// each table against lambda's projection of the store, written into a temp table of the",
    "// same DDL the way emitToDb writes: how many rows either has that the other has not",
    "const apart = () => {",
    "  const out = {};",
    "  for (const table of tables) {",
    "    const ddl = db.query('select sql from sqlite_master where type = ? and name = ?').values('table', table)[0];",
    "    const cols = Ev('rmap:proj_colnames', [table, CELLS]).map(String);",
    "    if (!ddl || !cols.length) continue;",
    "    const text = String(ddl[0]);",
    "    db.run('drop table if exists temp.want');",
    "    db.run('create temp table want' + text.slice(text.indexOf(Q, text.indexOf(Q) + 1) + 1));",
    "    const list = cols.map((c) => '[' + c + ']').join(',');",
    "    const put = db.prepare('insert into temp.want (' + list + ') values (' + cols.map(() => '?').join(',') + ')');",
    "    for (const row of Ev('rmap:proj_rows', [table, CELLS])) { try { put.run(...cols.map((_, i) => cell(row[i]))); } catch {} }",
    "    const n = db.query('select (select count(*) from (select ' + list + ' from [' + table + '] except select ' + list + ' from temp.want))'",
    "      + ' + (select count(*) from (select ' + list + ' from temp.want except select ' + list + ' from [' + table + ']))').values()[0][0];",
    "    if (n) out[table] = n;",
    "  }",
    "  db.run('drop table if exists temp.want');",
    "  return out;",
    "};",
    "if (process.env.APART) say('began', apart());",
    "for (const [method, ft, fact] of JSON.parse(process.env.WRITES)) {",
    "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
    "  const out = Ev('main:api', [CELLS, method, ft, '', fact]);",
    "  if (!(out.length > 2 && Number(out[1]) < 400)) { say('refused', [method, ft, String(out[0]).slice(0, 300)]); continue; }",
    "  adoptStore(out[2]);",
    "  const mode = process.env.MODE;",
    "  const n = emitToDb(before, CELLS, mode === 'rows' ? prior : mode === 'wrong' ? CELLS.slice() : undefined);",
    "  say('write', { method, ft, written: n, digest: digest() });",
    "}",
    "if (process.env.APART) say('ended', apart());",
  ].join("\n"));
  const WRITES = [
    ["POST", "StreamHasName", ["probe-rows-stream", "probe name"]],
    ["POST", "SchemaDesignHasDesignNote", ["probe-rows-design", "a note"]],
    ["PUT", "StreamHasName", ["probe-rows-stream", "renamed"]],
    ["DELETE", "SchemaDesignHasDesignNote", ["probe-rows-design", "a note"]],
    ["POST", "FactTypeHasAlias", ["StreamHasName", "probe alias"]],
    ["DELETE", "FactTypeHasAlias", ["StreamHasName", "probe alias"]],
  ];
  const run = (name, extra) => {
    const path = join(dir, name + ".db");
    if (name !== "made") copyFileSync(made, path);
    const env = { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path, WRITES: JSON.stringify(WRITES), ...extra };
    delete env.AREST_EAGER_STORE;
    const p = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
    const got = { out: p.stdout.toString() + p.stderr.toString(), writes: [], refused: [] };
    for (const line of p.stdout.toString().split("\n")) {
      const i = line.indexOf("=");
      if (i < 0) continue;
      let v; try { v = JSON.parse(line.slice(i + 1)); } catch { continue; }
      const k = line.slice(0, i);
      if (k === "write") got.writes.push(v); else if (k === "refused") got.refused.push(v); else got[k] = v;
    }
    return got;
  };
  const sum = (r) => r.writes.reduce((a, w) => a + w.written, 0);
  try {
    const m = run("made", { MAKE: "1" });
    expect(m.made, m.out).toBeGreaterThan(0);
    { const d = new Database(made); d.run("pragma wal_checkpoint(TRUNCATE)"); d.close(); }

    const rows = run("rows", { MODE: "rows", APART: "1" });
    const whole = run("whole", { MODE: "whole" });
    expect(rows.refused, rows.out).toEqual([]);
    expect(whole.refused, whole.out).toEqual([]);
    expect(rows.writes.length).toBe(WRITES.length);
    expect(whole.writes.length).toBe(WRITES.length);
    // the same rows in every table, after every write
    for (let i = 0; i < WRITES.length; i++) expect(rows.writes[i].digest, JSON.stringify(WRITES[i])).toBe(whole.writes[i].digest);
    // and no table further from lambda's projection than it began
    for (const [t, n] of Object.entries(rows.ended)) expect(n, t).toBeLessThanOrEqual(rows.began[t] || 0);
    // for a sliver of the rows
    expect(sum(rows), rows.out).toBeGreaterThan(0);
    expect(sum(rows) * 100).toBeLessThan(sum(whole));

    const wrong = run("wrong", { MODE: "wrong", WRITES: JSON.stringify(WRITES.slice(0, 1)) });
    expect(wrong.refused, wrong.out).toEqual([]);
    expect(wrong.writes[0].digest).not.toBe(whole.writes[0].digest);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 300_000);






// ---- AND A ROLE COLUMN HOLDS THE PLAYER OF THE ROLE ITS LINK NAMES ---------
//
// rmap:ctab lays a relation table out key-first, so a table whose columns are not
// in declared role order exists wherever a uniqueness skips a role -- and in the
// metamodel itself: RoleIsUsedInReading is laid out reading first beside its
// alternate reading `Reading uses Role`. The projection took the players in
// turn, so readingId held role ids and roleId reading ids, in every app; the
// inverse read them back in the same order, so the round trip held and saw
// nothing. Failing at dc98eb9c: each stored pair is the declared pair reversed.
test("a relation table's role column holds the player of the role its link names", () => {
  const table = "RoleIsUsedInReading";
  const cols = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
  const rows = Ev("rmap:proj_rows", [table, CELLS]);
  const pop = Ev("rmap:proj_pop", [table, CELLS]).map((p) => p.map(String));
  expect(rows.length).toBeGreaterThan(0);
  const role = cols.indexOf("roleId"), reading = cols.indexOf("readingId");
  expect(role).toBeGreaterThanOrEqual(0);
  expect(reading).toBeGreaterThanOrEqual(0);
  const stored = rows.map((r) => JSON.stringify([String(r[role]), String(r[reading])])).sort();
  expect(stored).toEqual(pop.map((p) => JSON.stringify(p)).sort());
  const back = Ev("rmap:unproj", [table, rows.map((r) => r.map(String)), CELLS])
    .filter((p) => String(p[0]) === table).map((p) => JSON.stringify(p[1].map(String))).sort();
  expect(back).toEqual(pop.map((p) => JSON.stringify(p)).sort());
});





// ---- AND A SERVER GIVES ITS MEMO BACK WHEN IT GOES IDLE --------------------
//
// The memo held most of a server's memory after a burst of calls and nothing
// ever let it go: on support.auto.dev a `get` left 19,245 answers under 44 names,
// each under both bounds, and the live heap after a full collection was 744 MB
// where the same calls without the memo left 130. Now every answer schedules a
// release AREST_MEMO_IDLE_MS later and the release says what it gave back. So: an
// MCP module over the base carriers (no store, no compile), the delay set to
// 200 ms, one fact type read, a pause, and the line. Failing at 80523ee5: no
// server ever releases, so the line never comes.
test("an MCP server gives its memo back when it goes idle, and says how much", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arest-memo-"));
  let server = null;
  try {
    const env = { ...process.env, AREST_CARRIERS: join(import.meta.dir, "..", "carriers", "base"), AREST_OUT_DIR: dir };
    delete env.AREST_INSTRUMENTED;
    const b = Bun.spawnSync(["bun", "build.js", "mcp"], { cwd: import.meta.dir, env, stdout: "pipe", stderr: "pipe" });
    expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
    const run = { ...process.env, AREST_MEMO_IDLE_MS: "200" };
    delete run.AREST_STORE_DB;
    server = Bun.spawn(["bun", join(dir, "mcp.g.js")], { env: run, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    let err = "";
    (async () => { for await (const chunk of server.stderr) err += new TextDecoder().decode(chunk); })();
    const pending = new Map();
    (async () => {
      let buf = "";
      for await (const chunk of server.stdout) {
        buf += new TextDecoder().decode(chunk);
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("{")) continue;
          try { const m = JSON.parse(line); if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch { /* not a reply */ }
        }
      }
    })();
    let next = 0;
    const send = (method, params) => new Promise((resolve) => {
      const id = ++next;
      pending.set(id, resolve);
      server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      server.stdin.flush();
    });
    await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "cases", version: "1" } });
    const tools = await send("tools/list", {});
    const names = (tools.result && tools.result.tools || []).map((t) => t.name);
    const ft = names.includes("FactTypeHasRole") ? "FactTypeHasRole" : "ObjectTypePlaysRole";
    expect(names).toContain(ft);
    const r = await send("tools/call", { name: ft, arguments: { method: "GET" } });
    expect((r.result && r.result.content || []).map((x) => x.text).join("")).toContain('"rows"');
    let released = null;
    for (let i = 0; i < 50 && !released; i++) {
      await Bun.sleep(100);
      released = err.match(/memo released: (\d+) answer\(s\) under (\d+) name\(s\)/);
    }
    expect(released, err.slice(-400)).not.toBeNull();
    expect(Number(released[2])).toBeGreaterThan(0);
  } finally {
    if (server) server.kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);




// ---- A PROHIBITION WRITTEN OF A SUBTYPE JUDGES THAT SUBTYPE`S INSTANCES --------
// (2026-09-29.) `It is forbidden that Response uses Dash` over `Message uses Dash`
// was prose: the three single-clause shapes look a clause up exactly, and the join
// builder, which substitutes a subtype and joins its extent, took two clauses or
// more. It takes one now. The recipe the case above finds in the carrier, evaluated
// over the populations a check hands it: the Message that is a Response and uses a
// Dash is the violation, the Message that is no Response is not, and with no
// Response among them there is none.
test("a prohibition written of a subtype judges the subtype's instances and no other", () => {
  const ofResponse = ["joinon", "MessageUsesDash", ["sel", "ObjectTypeInstanceIsInstanceOfObjectType", 2, "Response"], [[1, 1]], [1, 2]];
  const uses = ["MessageUsesDash", [["r1", "emdash"], ["m1", "emdash"]]];
  const shown = (v) => v.map((r) => r.map(String));
  expect(shown(Ev("derive:eval", [ofResponse, [uses, ["ObjectTypeInstanceIsInstanceOfObjectType", [["r1", "Response"], ["r1", "Message"], ["m1", "Message"]]]]]))).toEqual([["r1", "emdash"]]);
  expect(shown(Ev("derive:eval", [ofResponse, [uses, ["ObjectTypeInstanceIsInstanceOfObjectType", [["r1", "Message"], ["m1", "Message"]]]]]))).toEqual([]);
});




// ---- IS EVERY OBJECTIFICATION A NOUN? --------------------------------------
//
// Sam, 2026-09-23: "an objectified fact type should only exist if it must be
// used as a noun in some way, like `Inspector inspects Vehicle` objectifying an
// `Inspection` that may have a check list, a materials list, and more". The
// one-table wave objectified every compound-key fact type (4c5abe9f: `Halpin:
// every asserted compound-key fact type objectifies`), and 32 of the 38 it left
// in the metamodel play no role but the link fact types their own
// objectification implies and the subtype link to Function. Asked of SYSTEM one
// at a time -- `sel ObjectTypePlaysRole 1 <name>` -- the six that do are
// RoleIsUsedInReading (has Position), ConstraintSpan (has Position, has Sequence
// Number), API (accepts Object Type as parameter), DomainConnectsToExternalSystem
// (carries Secret Reference, has Send Mode), RoleSequenceHasPosition (holds
// Role) and RoleInstance (uses Object Type Instance). This reads the nestings
// the schema carries and asks the same question of every one.
test("every objectification the metamodel declares is used as a noun", () => {
  // WHICH NESTS ARE OBJECTIFICATIONS IS NOT CARRIED. state:nestings holds every
  // nest -- the declared objectifications AND the implicit ones NORMA makes of
  // every many-to-many and n-ary fact type (read:is_implied_nest, IsImplied in
  // ORMCore), each of which is declared an object type too -- so nothing in the
  // schema tells the two apart; that is the catalog gap `Object Type
  // objectifies Fact Type` closes. The reader's own state does: its first
  // element's seventh slot is the declared nest names, the list read:implied_nests
  // subtracts. So the metamodel is read here the way the witness cases read it.
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const files = readdirSync(META).filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b));
  const rows = [];
  for (const f of files) for (const t of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", t));
  const nestings = Ev("read:x_of", rows)[0][6].map(String);
  const plays = Ev("system:pop_rows", ["ObjectTypePlaysRole", CELLS]).map((r) => [String(r[0]), String(r[1])]);
  const factOf = (role) => role.slice(0, role.lastIndexOf("."));
  // what every objectification plays by construction: the link fact types its
  // own objectification implies, and (until the one-table wave is undone) its
  // subtype link -- neither is a use of the noun
  const structural = (x, ft) => ft.startsWith(x + "IsASubtypeOf")
    || (/IsInvolved(First|Second)?In/.test(ft) && ft.endsWith("In" + x));
  const nouns = nestings.filter((x) => plays.some(([ot, role]) => ot === x && !structural(x, factOf(role))));
  expect(nestings.length).toBeGreaterThan(0);
  expect(nestings.filter((x) => !nouns.includes(x)).sort()).toEqual([]);
  expect(nouns.sort()).toEqual(["API", "ConstraintSpan", "DomainConnectsToExternalSystem",
    "RoleInstance", "RoleIsUsedInReading", "RoleSequenceHasPosition"]);
}, 120_000);


// ---- IS EACH LAMBDA FILE STILL INTERSECTION SOURCE? -------------------------
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
// it. That is exactly what happened: the ROOT lambda accumulated eight `//`
// comment lines -- legal Rust, C#, Java and JS, invalid Python -- while only
// the curated engine/shared/arest.canon was fed to CPython."
//
// It used Python's parser as the strictest reader. With python gone no host
// rejects a `//`, so the rule needs asserting rather than inheriting -- and it
// was already broken: this session's lambda carried the forbidden trailing comma
// until the byte check went looking for it.
//
// These are BYTE rules, not a parser. Whether the file PARSES is already proven
// by bun exec'ing the composition; what a parse cannot tell you is whether it
// would still parse somewhere else.
// Each test below is named for its file, split on either separator: [\/] split on a
// slash alone, so on Windows every one was named for the whole checkout path, and a worktree
// renamed them all (2026-10-02).
const LAMBDA_FILES = [
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
// [a, b] and the c is GONE, with no error. This is not a property lambda can
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

// ---- A RETRACT KEYED BY THE ENTITY'S ID ALONE REMOVES THE ENTITY ------------
//
// A bound child's id is its content spelled (main:bd_id), so correcting a
// Message body is a different child and the old one has to be retracted; and
// retract took the fact WITH its current value, which the caller correcting it
// is exactly the caller who does not have. Measured 2026-09-21 on the base
// store before the fix: retract of {Function: id} answered 400 `a retract
// removes one fact`, on the served route and the direct one, and a single-fact
// retract left the id registered -- ObjectTypeInstanceIsInstanceOfObjectType
// kept its row and ui:ids still listed it. A row carrying the key alone now
// retracts the entity: every row of every declared fact type in which the id
// fills an entity-typed role (state:declared's players against
// ObjectTypeIsOfObjectKind, the two cells main:cr_pairs registers an instance
// by), the id out of state:otpops in the same step, one closure, one Theorem 1
// check; the body's rows are the facts removed. The single-fact retract is
// untouched, and the two shapes are the only two.
test("a retract keyed by the entity's id alone removes every fact of it; a full-row retract is unchanged", () => {
  const ID = "probe:retract-by-id-" + Math.random().toString(36).slice(2, 8);
  const row = [["Function", ID], ["FunctionHasDefinitionOrigin", "compiled"]];
  const has = (ft, store) => Ev("system:pop_rows", [ft, store]).some((r) => String(r[0]) === ID);
  const listed = (store) => Ev("ui:ids", [store, "Function"]).some((i) => String(i) === ID);
  const made = Ev("create", [row, CELLS]);
  expect(Number(made[1])).toBeLessThan(400);   // 200: the deontic FunctionBelongsToDomain, as in the write test above
  const S1 = made[2];
  expect(has("FunctionHasDefinitionOrigin", S1)).toBe(true);
  expect(has("ObjectTypeInstanceIsInstanceOfObjectType", S1)).toBe(true);
  expect(listed(S1)).toBe(true);
  const before = Ev("ui:ids", [S1, "Function"]).length;

  // by key alone: the entity's own fact, its two instance facts and its registration go
  const gone = Ev("retract", [[["Function", ID]], S1]);
  expect(Number(gone[1])).toBe(201);
  const S2 = gone[2];
  expect(has("FunctionHasDefinitionOrigin", S2)).toBe(false);
  expect(has("ObjectTypeInstanceIsInstanceOfObjectType", S2)).toBe(false);
  expect(has("ObjectTypeInstanceHasReference", S2)).toBe(false);
  expect(listed(S2)).toBe(false);
  expect(Ev("ui:ids", [S2, "Function"]).length).toBe(before - 1);
  // the body says what went, as <fact type, rows> pairs
  const body = JSON.parse(String(gone[0]));
  expect(body[0]).toBe("committed");
  // FunctionBelongsToDomain is the fourth since the reflection files an
  // instance under its most specific type's domain: the entity carries a
  // membership row, and retracting the entity takes it with the rest.
  expect(body[1].map((p) => p[0]).sort()).toEqual(["FunctionBelongsToDomain", "FunctionHasDefinitionOrigin", "ObjectTypeInstanceHasReference", "ObjectTypeInstanceIsInstanceOfObjectType"]);
  // every other row of the population is kept
  expect(Ev("system:pop_rows", ["FunctionHasDefinitionOrigin", S2]).length).toBe(Ev("system:pop_rows", ["FunctionHasDefinitionOrigin", S1]).length - 1);
  // and the served route is the same operation: main answers a claim and the store
  const served = Ev("main", [S1, ["retract", [["Function", ID]]]]);
  expect(String(served[1])).toBe("T");
  expect(has("FunctionHasDefinitionOrigin", served[2])).toBe(false);

  // a full-row retract is what it was: 201, the one fact gone, the instance still registered
  const one = Ev("retract", [row, S1]);
  expect(Number(one[1])).toBe(201);
  expect(has("FunctionHasDefinitionOrigin", one[2])).toBe(false);
  expect(has("ObjectTypeInstanceIsInstanceOfObjectType", one[2])).toBe(true);
  expect(listed(one[2])).toBe(true);
  // an id that is nobody's is case:retract-absent's no-op, and the two shapes are the only two
  const nobody = Ev("retract", [[["Function", "probe:nobody"]], S1]);
  expect(Number(nobody[1])).toBe(201);
  expect(JSON.parse(String(nobody[0]))[1]).toEqual([]);
  expect(Number(Ev("retract", [[["Function", ID], ["FunctionHasDefinitionOrigin", "compiled"], ["FunctionHasName", "x"]], S1])[1])).toBe(400);
  expect(Number(Ev("main:api", [S1, "DELETE", "Function", "", [ID, "extra"]])[1])).toBe(400);
}, 60_000);

// ---- A PAGE IS ONE WRITE ------------------------------------------------------------------
//
// The federations read pages of rows -- a hundred Stripe subscriptions, a capped window of one
// customer's requests -- and a create on support.auto.dev costs seconds, most of it validating the
// whole store. `assert` takes a list of facts and makes them one step: every fact not already held
// goes into one trial, validated once and committed only when V holds no alethic violation, or the
// store it was given comes back unchanged. A second run of the same page asserts nothing. Failing
// at bbaa4186: assert is not a verb. And the page is grouped by fact type, so each population it
// touches is written once rather than once per fact: support.auto.dev's first backfill page, 386
// facts, went from never answering to 7.1 s.
test("assert writes a list of facts as one step: new ones land, held ones are counted, a violation refuses the list", () => {
  const S0 = CELLS;
  const names = (S) => Ev("system:pop_rows", ["StreamHasName", S]).filter((r) => String(r[0]).startsWith("pg-"))
    .map((r) => r.map(String).join("=")).sort();
  const page = [["StreamHasName", "pg-1", "one"], ["StreamHasName", "pg-2", "two"]];
  const first = Ev("assert", [page, S0]);
  expect(Number(first[1])).toBe(201);
  expect(JSON.parse(String(first[0]))).toEqual(["committed", ["new", 2], ["held", 0], ["violations", []]]);
  expect(names(first[2])).toEqual(["pg-1=one", "pg-2=two"]);
  // the entities the page introduces are registered with it, an instance and a reference each
  const pg = (ft, S) => Ev("system:pop_rows", [ft, S]).filter((r) => String(r[0]).startsWith("pg-"))
    .map((r) => r.map(String).join("=")).sort();
  expect(pg("ObjectTypeInstanceIsInstanceOfObjectType", first[2])).toEqual(["pg-1=Stream", "pg-2=Stream"]);
  expect(pg("ObjectTypeInstanceHasReference", first[2])).toEqual(["pg-1=pg-1", "pg-2=pg-2"]);
  // the same page again: nothing new, nothing lost -- and nothing written, so the store comes back
  // as it was, neither validated nor closed again (failing at d8c16f5c, which closed it anew)
  const again = Ev("assert", [page, first[2]]);
  expect(Number(again[1])).toBe(201);
  expect(JSON.parse(String(again[0])).slice(0, 3)).toEqual(["committed", ["new", 0], ["held", 2]]);
  expect(names(again[2])).toEqual(["pg-1=one", "pg-2=two"]);
  expect(again[2]).toBe(first[2]);
  // a hundred facts are one write per population they touch, and all of them land
  const hundred = [];
  for (let i = 0; i < 100; i++) hundred.push(["StreamHasName", "pg-h" + i, "h" + i]);
  const big = Ev("assert", [hundred, first[2]]);
  expect(JSON.parse(String(big[0])).slice(0, 3)).toEqual(["committed", ["new", 100], ["held", 0]]);
  expect(names(big[2]).length).toBe(102);
  expect(pg("ObjectTypeInstanceIsInstanceOfObjectType", big[2]).length).toBe(102);
  // a page that breaks a uniqueness is refused whole: pg-3 does not land either
  const bad = Ev("assert", [[["StreamHasName", "pg-3", "three"], ["StreamHasName", "pg-1", "uno"]], first[2]]);
  expect(Number(bad[1])).toBe(409);
  expect(JSON.parse(String(bad[0]))[0]).toBe("refused");
  expect(names(bad[2])).toEqual(["pg-1=one", "pg-2=two"]);
  // what is not a list of facts is refused before anything is tried
  expect(Number(Ev("assert", ["x", S0])[1])).toBe(400);
  expect(Number(Ev("assert", [[["NoSuchFactType", "a", "b"]], S0])[1])).toBe(400);
  expect(Number(Ev("assert", [[[]], S0])[1])).toBe(400);
  // and a fact names one value for each role of its fact type: claude took a text for a one-role
  // fact type, lost it at the next boot, and refused every write after (2026-09-30)
  const extra = Ev("assert", [[["StreamHasName", "pg-9", "nine", "more"]], S0]);
  expect(Number(extra[1])).toBe(400);
  expect(String(extra[0])).toContain("one value for each of its roles");
  expect(Number(Ev("assert", [[["StreamHasName", "pg-9"]], S0])[1])).toBe(400);
  expect(Number(Ev("assert", [[["StreamHasName", "pg-9", "nine"], ["StreamHasName", "pg-10"]], S0])[1])).toBe(400);
  // and the served route is the same operation
  const served = Ev("main", [S0, ["assert", page]]);
  expect(String(served[1])).toBe("T");
  expect(names(served[2])).toEqual(["pg-1=one", "pg-2=two"]);
}, 120_000);

// ---- A WRITE THAT MAKES NO SUCCESSOR GIVES ITS MEMO BACK ----------------------------------
//
// A refused write hands back the store it was given, so adoptStore adopted nothing and the memo,
// which only a new store cleared, kept what the evaluation computed over a trial store nothing can
// reach again: 170 refused asserts through the MCP verb route grew one module to 10.2 GB. So a
// refused page's memo is gone once its answer is taken. Failing at 8cf843de: adoptStore returns
// before touching the memo, and what the trial held is still held.
test("a refused write gives back the memo its trial built", () => {
  const A = globalThis.AREST;
  const bad = [["StreamHasName", "mm-1", "one"], ["StreamHasName", "mm-1", "uno"]];
  const out = Ev("assert", [bad, CELLS]);
  expect(Number(out[1])).toBe(409);
  expect(out[2]).toBe(CELLS);
  expect(A.memoHeld()).toBeGreaterThan(0);
  expect(A.adoptStore(out[2])).toBe(true);
  expect(A.memoHeld()).toBe(0);
}, 120_000);

// ---- A FEDERATION IS A READ ---------------------------------------------------------------
//
// A Source uses a Connector, a Connector is a Function addressed as the performer addresses one,
// and what its answer yields is `Function yields Fact Type with Role from JSON Path`, read once per
// row with every role from its own path. `sync` handed no page answers the request the model
// declares and writes nothing; handed a page, it asserts what the page yields in one step. Failing
// at 8f31455d: sync is not a verb.
test("sync answers a Source's request, and asserts what a page of its rows yields, once", () => {
  const fromJson = (x) => Array.isArray(x) ? x.map(fromJson)
    : (x !== null && typeof x === "object") ? Object.keys(x).map((k) => [k, fromJson(x[k])])
    : typeof x === "number" ? x : String(x);
  const F = "listStreams", S = "streams-src";
  const decl = [
    ["SourceUsesConnector", S, F],
    ["FunctionIsBackedByExternalSystem", F, "fake"],
    ["ExternalSystemHasURL", "fake", "http://127.0.0.1:9/v1"],
    ["FunctionHasCallbackURI", F, "/streams"],
    ["FunctionIsCalledWithHTTPMethod", F, "GET"],
    ["FunctionReadsRowsAtJSONPath", F, "$.data"],
    ["FunctionPagesWhileJSONPath", F, "$.has_more"],
    ["FunctionPagesByQueryParameter", F, "starting_after"],
    ["FunctionPagesFromJSONPath", F, "$.data[-1].id"],
    ["FunctionHasQueryParameterWithParameterValue", F, "limit", "2"],
    ["FunctionHasQueryParameterWithParameterValue", F, "owner", "{who}"],
    ["FunctionYieldsFactTypeWithRoleFromJSONPath", F, "StreamHasName", "StreamHasName.2", "$.owner.email|lower"],
    ["FunctionYieldsFactTypeWithRoleFromJSONPath", F, "StreamHasName", "StreamHasName.1", "$.id"],
    ["FunctionReadsRowsWhereJSONPathEqualsConditionValue", F, "$.owner.email|present", "T"],
    ["FunctionReadsRowsWhereJSONPathEqualsConditionValue", F, "$.kind", "live"],
    ["SourceUsesConnector", "mail-src", "listMsgs"],
    ["FunctionIsBackedByExternalSystem", "listMsgs", "fake"],
    ["FunctionHasCallbackURI", "listMsgs", "/messages"],
    ["FunctionIsCalledWithHTTPMethod", "listMsgs", "GET"],
    ["FunctionReadsRowsAtJSONPath", "listMsgs", "$.messages"],
    ["FunctionPagesWhileJSONPath", "listMsgs", "$.nextPageToken|present"],
    ["FunctionPagesByQueryParameter", "listMsgs", "pageToken"],
    ["FunctionPagesFromJSONPath", "listMsgs", "$.nextPageToken"],
    ["FunctionYieldsFactTypeWithRoleFromJSONPath", "listMsgs", "StreamHasName", "StreamHasName.1", "$.id"],
    ["FunctionYieldsFactTypeWithRoleFromJSONPath", "listMsgs", "StreamHasName", "StreamHasName.2", "$.threadId"],
  ];
  const declared = Ev("assert", [decl, CELLS]);
  expect(Number(declared[1])).toBeLessThan(400);
  const S0 = declared[2];
  // no page: the request, and nothing written; a templated parameter with nothing to bind refuses
  const unbound = Ev("sync", [S, S0]);
  expect(Number(unbound[1])).toBe(400);
  expect(String(unbound[0])).toContain("owner");
  const q = Ev("sync", [[S, fromJson({ who: "sam" })], S0]);
  expect(Number(q[1])).toBe(200);
  const req = JSON.parse(String(q[0]));
  expect(req.slice(0, 3)).toEqual(["request", "GET", "http://127.0.0.1:9/v1/streams"]);
  expect(req[3].map((p) => p.join("=")).sort()).toEqual(["limit=2", "owner=sam"]);
  expect(req[4]).toEqual([]);                        // no Query Text declared, so no body
  expect(q[2]).toBe(S0);
  // a page: role 1 from $.id and role 2 from the owner's email, lowered, in the fact type's own
  // order though declared the other way round. A row is read only where every condition holds:
  // st_3 has no owner and st_4 is not live, so both are skipped and counted, and the cursor is
  // still the page's last row (failing at ed60ff64, where st_4 lands)
  const page = fromJson({ object: "list", has_more: true, data: [
    { id: "st_1", kind: "live", owner: { email: "One@X.com" } },
    { id: "st_2", kind: "live", owner: { email: "two@y.com" } },
    { id: "st_3", kind: "live", owner: null },
    { id: "st_4", kind: "archived", owner: { email: "d@w.com" } },
  ] });
  const one = Ev("sync", [[S, [], [], page], S0]);
  const body = JSON.parse(String(one[0]));
  expect(body[0]).not.toBe("refused");
  expect(body.slice(1, 3)).toEqual([["new", 2], ["held", 0]]);
  expect(body.slice(4)).toEqual([["facts", 2], ["unread", []], ["more", "T"], ["next", ["starting_after", "st_4"]], ["skipped", 2]]);
  const st = (S1) => Ev("system:pop_rows", ["StreamHasName", S1]).filter((r) => String(r[0]).startsWith("st_"))
    .map((r) => r.map(String).join("=")).sort();
  expect(st(one[2])).toEqual(["st_1=one@x.com", "st_2=two@y.com"]);
  // the same page again asserts nothing and hands back the store it was given
  const again = Ev("sync", [[S, [], [], page], one[2]]);
  expect(JSON.parse(String(again[0])).slice(1, 3)).toEqual([["new", 0], ["held", 2]]);
  expect(again[2]).toBe(one[2]);
  // a cursor at the top of the answer, Gmail's shape: more while the token is there, and the last
  // page, which carries none, ends the paging (failing at ac07c425, which read the cursor from the
  // last row and more only as the text true)
  const mail1 = JSON.parse(String(Ev("sync", [["mail-src", [], [], fromJson({ messages: [{ id: "m_1", threadId: "t_1" }], nextPageToken: "tok2" })], S0])[0]));
  expect(mail1.slice(6, 8)).toEqual([["more", "T"], ["next", ["pageToken", "tok2"]]]);
  const mail2 = JSON.parse(String(Ev("sync", [["mail-src", [], ["pageToken", "tok2"], fromJson({ messages: [{ id: "m_2", threadId: "t_2" }] })], S0])[0]));
  expect(mail2.slice(6, 8)).toEqual([["more", "F"], ["next", []]]);
  // and a path counts from the end
  const two = fromJson({ data: [{ id: "a" }, { id: "b" }] });
  expect(Ev("fed:at", [two, "$.data[-1].id"])).toBe("b");
  expect(Ev("fed:at", [two, "$.data[-2].id"])).toBe("a");
  expect(Ev("fed:at", [two, "$.data[-3].id"])).toEqual([]);
  // a Source nothing declares is not a request anyone can make
  expect(Number(Ev("sync", ["nowhere", S0])[1])).toBe(404);
  // and the served route is the same operation
  const served = Ev("main", [S0, ["sync", [S, fromJson({ who: "sam" })]]]);
  expect(String(served[1])).toBe("T");
  // the filters a path takes: a Unix time as UTC ISO-8601, an email lowered
  expect(Ev("tpl:filter", ["iso", 1758800000])).toBe("2025-09-25T11:33:20Z");
  expect(Ev("tpl:filter", ["iso", "951782400"])).toBe("2000-02-29T00:00:00Z");
  expect(Ev("tpl:filter", ["iso", "4102444800"])).toBe("2100-01-01T00:00:00Z");
  expect(Ev("tpl:filter", ["iso", "12a"])).toEqual([]);
  expect(Ev("tpl:filter", ["lower", "Mixed@Case.COM"])).toBe("mixed@case.com");
}, 120_000);

// AND A VALUE THAT SPELLS THE SAME ATOM IS NOT THE ENTITY. Function(.id) is one
// id space, so an atom in an entity-typed role IS the entity; the same atom in
// a value-typed role is a value. Retracting the entity leaves the value alone.
test("a retract by key leaves a value-typed role that spells the same atom alone", () => {
  const V = "probe:samename-" + Math.random().toString(36).slice(2, 8);
  const S1 = Ev("create", [[["Function", V], ["FunctionHasDefinitionOrigin", "compiled"]], CELLS])[2];
  const S2 = Ev("create", [[["Function", V + "-2"], ["FunctionHasName", V]], S1])[2];
  const gone = Ev("retract", [[["Function", V]], S2]);
  expect(Number(gone[1])).toBe(201);
  expect(Ev("system:pop_rows", ["FunctionHasName", gone[2]]).some((r) => String(r[0]) === V + "-2" && String(r[1]) === V)).toBe(true);
  expect(Ev("system:pop_rows", ["FunctionHasDefinitionOrigin", gone[2]]).some((r) => String(r[0]) === V)).toBe(false);
  expect(Ev("ui:ids", [gone[2], "Function"]).some((i) => String(i) === V)).toBe(false);
}, 60_000);

// AND THE PARENT'S RETRACT DOES NOT CASCADE TO ITS BOUND CHILD: the readings
// (metamodel/instances.md) say what an instance is and nothing ties a child's
// life to its parent's. `Ticket has Note` is the Ticket's fact and goes; the
// Note's own facts are the Note's and stay, and the Note retracts by its own
// key -- the content-spelled id -- like any entity.
test("retracting a parent by key removes its facts and not its bound child's", () => {
  const F0 = Ev("fixture:bind-store", []);
  const F1 = Ev("main:api", [F0, "POST", "Ticket", "", [["Ticket", "t1"], ["TicketHasNote", [[["NoteHasBody", "hi"], ["NoteHasStamp", "T1"]]]]]])[2];
  const CHILD = "Note:NoteHasBody=hi|NoteHasStamp=T1";
  const parent = Ev("retract", [[["Ticket", "t1"]], F1]);
  expect(Number(parent[1])).toBe(201);
  expect(JSON.parse(String(parent[0]))[1]).toEqual([["TicketHasNote", [["t1", CHILD]]]]);
  const F2 = parent[2];
  expect(Ev("system:pop_rows", ["NoteHasBody", F2])).toEqual([[CHILD, "hi"]]);
  expect(Ev("ui:ids", [F2, "Ticket"])).toEqual([]);
  expect(Ev("ui:ids", [F2, "Note"])).toEqual([CHILD]);
  const child = Ev("retract", [[["Note", CHILD]], F2]);
  expect(Number(child[1])).toBe(201);
  expect(Ev("system:pop_rows", ["NoteHasBody", child[2]])).toEqual([]);
  expect(Ev("ui:ids", [child[2], "Note"])).toEqual([]);
});

describe("every constructor holds what it was given", () => {
  for (const file of LAMBDA_FILES) {
    const name = file.split(/[\\/]/).pop();
    // THE BUDGET IS THE FILE'S, NOT THE DEFAULT'S. This walks every character of
    // lambda -- two megabytes, and one more cell of the reader's is nine kilobytes
    // of it -- so bun's 5-second default was a ceiling lambda was already touching
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
  for (const file of LAMBDA_FILES) {
    const name = file.split(/[\\/]/).pop();
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
      // every host, and cost this session a whole composed build.
      // A QUOTE AFTER AN ESCAPED BACKSLASH CLOSES ITS STRING (2026-10-02). This counted
      // the quotes no backslash precedes, which reads the closing quote of A("\\") as
      // escaped: compile:plain (7e654901, 2026-10-01), which tests an atom
      // for a backslash, a quote and three controls on one line, was flagged as opening a
      // string it did not close, on a line every host parses. The line is read as a host
      // reads it: inside a string a backslash escapes the character after it.
      const opens = (l) => {
        let inStr = false;
        for (let i = 0; i < l.length; i++) {
          if (inStr && l[i] === "\\") i++;
          else if (l[i] === '"') inStr = !inStr;
        }
        return inStr;
      };
      const bad = text.split("\n").filter(opens);
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
// this one answers, which is not disagreement about lambda but a question lambda
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

// THE PAIRING HALF, MADE TO FAIL (#108), OVER THE CONTAINER'S OWN TABLE (#124).
// law:origin_boundary took <store, registered-names> so a container could be
// asked whether it has a native control for every abstract kind the store
// declares registered -- and then law:report and law:app_report passed PHI,
// which the law reads as "not a platform, owes no pairing" and answers T. So
// the pairing half shipped without ever having run over a real set anywhere
// the suite could see it, and this is where it is shown to FAIL: it is handed
// a set with one kind removed and has to name that kind. A law that only ever
// answers T over PHI is not a law, it is a row.
//
// AND THE SET IS A CONTAINER'S, NOT A COPY OF ONE (2026-09-21). This block held
// nineteen names with the comment "verbatim from host.js run_ui" -- verbatim
// from a function 3321421a had deleted, so the suite was certifying the pairing
// of a container that did not exist against a list no host read. Sam, the same
// day: "The web UI should be React." The container is therefore
// apps/ui.do/src/render (package @arest/ui.do), its table is RENDER_REGISTRY,
// and REGISTERED_NAMES is the list that table is built from and asserted
// against at module load. That file imports nothing, which is what lets this
// one read it without React, a bundler, or that package's node_modules.
//
// AND WHERE ui.do IS NOT BESIDE THIS CHECKOUT THE FIVE ARE SKIPPED, SAYING WHY
// (2026-10-02). The container is imported from ../../../apps/ui.do, the apps
// directory beside the arest checkout, and a worktree under .claude/worktrees has
// none: all five failed there on an import that was never the container's. They
// are skipped now and the reason is printed. AREST_UIDO names a ui.do checkout to
// import instead, a worktree of ui.do that matches this one, say; one that is named
// and does not import fails, because then the import is what is under test.
const UIDO = process.env.AREST_UIDO;
let REACT_CONTAINER = null;
let REACT_CONTAINER_ERROR = "";
try {
  REACT_CONTAINER = await import(UIDO ? pathToFileURL(join(UIDO, "src", "render", "registry.ts")).href
                                      : "../../../apps/ui.do/src/render/registry.ts");
} catch (e) {
  REACT_CONTAINER_ERROR = e instanceof Error ? e.message : String(e);
}
const REACT_SKIP = !UIDO && REACT_CONTAINER_ERROR !== "";
if (REACT_SKIP) console.log("SKIPPED: law:paired over the React container's registration table, five tests: " +
  "ui.do is not beside this checkout (" + REACT_CONTAINER_ERROR + "); AREST_UIDO=<a ui.do checkout> runs them");
const reactTest = REACT_SKIP ? test.skip : test;

describe("law:paired over the React container's registration table", () => {
  const container = () => {
    expect(REACT_CONTAINER_ERROR).toBe("");
    expect(REACT_CONTAINER).not.toBeNull();
    return REACT_CONTAINER;
  };

  reactTest("the container's table is reachable, and is the table it renders from", () => {
    const c = container();
    expect(c.TOOLKIT).toBe("react");
    expect(c.CONTROL_KINDS.length).toBe(19);
    expect(c.LAYOUT_ENGINE).toBe("render:html");
    // the widgets, then the layout engine -- a platform is its paired controls
    // AND the engine that lays them out
    expect(c.REGISTERED_NAMES).toEqual([
      ...c.CONTROL_KINDS.map((k) => "render:" + k), c.LAYOUT_ENGINE,
    ]);
    // every control carries the Toolkit Symbol the reading binds it at
    for (const kind of c.CONTROL_KINDS) expect(typeof c.TOOLKIT_SYMBOL[kind]).toBe("string");
  });

  reactTest("the container pairs every declared control kind, and the store declares every pair", () => {
    const HTML = container().REGISTERED_NAMES.map(String);
    const declared = Ev("law:ctl_declared", CELLS).map(String);
    expect(declared.length).toBeGreaterThan(0);        // an empty set pairs vacuously
    expect(Ev("law:unpaired", [CELLS, HTML])).toEqual([]);
    expect(Ev("law:paired", [CELLS, HTML])).toBe("T");
    // BOTH WAYS ROUND, which is what #124 added: law:unpaired above says the
    // container registers everything the store declares, and this says the
    // store declares everything the container registers. One direction alone
    // let the metamodel declare ten kinds while lambda emitted nineteen, and
    // no container was ever asked whether it had the other nine. The nineteen
    // are the iFactr interfaces since 2026-10-01 (Sam: the idealized controls
    // are based on the MonoView and iFactr interfaces). The container's one
    // engine is the rest of what it registers (2026-10-02: a platform is its
    // controls and its own layout engine, so the web container registers
    // render:html and none of the other platforms' engines).
    const engines = Ev("law:engines_declared", CELLS).map(String);
    const mine = HTML.filter((n) => engines.includes(n));
    expect(mine).toEqual(["render:html"]);
    expect(declared.concat(mine).sort()).toEqual(HTML.slice().sort());
  });

  reactTest("a container missing one native control is refused, by name", () => {
    const HTML = container().REGISTERED_NAMES.map(String);
    const short = HTML.filter((n) => n !== "render:gridcell");
    expect(Ev("law:paired", [CELLS, short])).toBe("F");
    expect(Ev("law:unpaired", [CELLS, short]).map(String)).toEqual(["render:gridcell"]);
  });

  reactTest("a container missing the layout engine is refused too", () => {
    // a platform is its paired controls AND the engine that lays them out, so
    // an unregistered render:html is as fatal as an unregistered widget, and
    // the refusal names the engines the store declares, any one of which
    // would pair it (2026-10-02)
    const HTML = container().REGISTERED_NAMES.map(String);
    const short = HTML.filter((n) => n !== "render:html");
    expect(Ev("law:paired", [CELLS, short])).toBe("F");
    const engines = Ev("law:engines_declared", CELLS).map(String);
    expect(engines.slice().sort()).toEqual(["render:html", "render:slint", "render:swing", "render:wpf"]);
    expect(Ev("law:unpaired", [CELLS, short]).map(String)).toEqual(engines);
  });

  test("a caller that is not a platform owes no pairing", () => {
    // what law:report and law:app_report pass; the verdict is the store half
    expect(Ev("law:paired", [CELLS, []])).toBe("T");
  });

  reactTest("the reading binds the same controls the container registers", () => {
    // readings/ui/components.md declares Toolkit 'react' and one
    // ImplementationBinding per idealized control. The binding rows and the
    // module's table are two statements of one pairing; if they disagree, the
    // model describes a container nobody wrote.
    const c = container();
    const reading = readFileSync(join(import.meta.dir, "..", "..", "readings", "ui", "components.md"), "utf8");
    const bound = new Map();
    for (const line of reading.split(/\r?\n/)) {
      const m = line.match(/^Component '([^']+)' is implemented by Toolkit 'react' at Toolkit Symbol '([^']+)'\.$/);
      if (m) bound.set(m[1], m[2]);
    }
    expect([...bound.keys()].sort()).toEqual([...c.CONTROL_KINDS].sort());
    for (const kind of c.CONTROL_KINDS) expect(bound.get(kind)).toBe(c.TOOLKIT_SYMBOL[kind]);
  });
});

// ---- THE READER IS LAMBDA, AND IT IS NOW ITS OWN WITNESS -------------------
//
// 2026-09-20, #109: the oracle is deleted and the carrier these tests read
// as `the witness` is written by lambda's own reader (tools/js-runner/
// compile.js). So every comparison below is lambda against the schema
// lambda wrote, read back through the host's LAMBDATEXT -- a ROUND TRIP of the
// carrier, which can fail on chunking, on an escape, on an atom that should
// have been a number. It is no longer a comparison against an independent
// second implementation, and nothing is, because there no longer is one.
// The paragraph below is kept for what it says about why.
//
// Sam, 2026-09-15: "I don't want to be dependent on NORMA. I'm developing
// AREST. AREST needs to provide all functionality." So the FORML reader is
// lambda end to end -- text in, sentences (read:sentences), tokens
// (read:row_of), the populated conceptual schema (read:parse) -- and the C#
// oracle is consulted only as the witness it is named for: its cells are
// already composed into this module, so the comparison is Ev against Ev, and
// nothing here runs NORMA. The numbers below are the measurement, not a hope:
// they are pinned as a RATCHET, so this test fails on every improvement until
// it is re-pinned, which is the only way a golden can be honest about a
// reader that is still closing a distance.
describe("lambda's reader against the witness, on the base metamodel", () => {
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

  // read:spoken has a fast twin too. Its DEF applies theta:Filter to a
  // predicate to BUILD a filter and then applies that, so the closure is
  // rebuilt on each of the 411,268 calls the base metamodel's reader path
  // makes -- 6,475 ms self, 18% of that run (2026-09-18). The DEF is the
  // meaning either way, and its compiled form is evaluated here beside the
  // twin on every branch that distinguishes them: the atom dropped, a NESTED
  // <"-"> which is not the atom and stays, the near-misses "--" and "-x",
  // the empty string and a space, and an all-dashes list that empties.
  test("the read:spoken twin is its DEF", () => {
    const def = DEFS.get("read:spoken");
    for (const input of [[], ["a"], ["-"], ["-", "-", "-"], ["a", "-", "b"],
                         ["Each", "-", "Function", "-", "belongs"],
                         [["a", "b"], "-", "c"], ["-", ["-"], "-"],
                         ["", "-", " "], ["--", "-", "-x"]])
      expect(JSON.stringify(Ev("read:spoken", input))).toBe(JSON.stringify(Ev(def, input)));
    expect(Ev("read:spoken", ["-", ["-"], "-"])).toEqual([["-"]]);   // the nested one is not the atom
    expect(Ev("read:spoken", ["--", "-", "-x"])).toEqual(["--", "-x"]);
  });

  // read:firstn, read:dropn and read:rule_seq_at have fast twins too (2026-09-28). The rules
  // compiler found a word sequence in a clause by slicing the clause at every position, each
  // slice a WHILE of tl or tlr that copies the list at every step: sampled on support's
  // closure, rule_slice, firstn and dropn were 27%, 23% and 12% of the whole parse. Each DEF's
  // compiled form is evaluated beside its twin on every branch its contract distinguishes and
  // on every shape the DEF raises on, which the twin hands back to the DEF: a count below
  // zero, past the end, fractional, not a number, NaN; an atom where a sequence goes; the empty
  // sequence searched and searched for; a nested element; a number beside its own spelling.
  test("the read:firstn, read:dropn and read:rule_seq_at twins are their DEFs", () => {
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const L = ["a", "b", "c", "d", "e"], N = [["x"], "y", 3, ["x"]];
    const cases = {
      "read:dropn": [[0, L], [1, L], [5, L], [6, L], [-1, L], [0.5, L], [4.5, L], [0, "atom"], [1, "atom"], [1, []],
        ["1", L], [NaN, L], [3, N], [2, L, "extra"], "atom", [1]],
      "read:firstn": [[0, L], [3, L], [5, L], [9, L], [-1, L], [1.5, L], [0, []], [-1, []], [2, "atom"], ["2", L],
        [NaN, L], [2, N], "atom", [1]],
      "read:rule_seq_at": [[["b", "c"], L], [["e"], L], [["e", "f"], L], [["x"], L], [[], L], [[], []], [["a"], []],
        [["b", "b"], ["a", "b", "b", "c"]], [[["x"]], N], [["y", 3], N], [[3], ["3"]], [["3"], [3]], ["atom", L],
        [["a"], "atom"], [["a"]], [["that", "Customer"], ["each", "Order", "is", "for", "that", "Customer"]]],
    };
    for (const [name, inputs] of Object.entries(cases)) {
      const def = DEFS.get(name);
      for (const x of inputs) expect(run(() => Ev(name, x))).toBe(run(() => Ev(def, x)));
    }
    expect(Ev("read:rule_seq_at", [["that", "Customer"], ["each", "Order", "is", "for", "that", "Customer"]])).toBe(5);
    expect(Ev("read:rule_seq_at", [[], ["a"]])).toBe(1);   // the empty sequence is at 1
    expect(run(() => Ev("read:dropn", [6, L]))).toBe("raises");   // past the end raises, as tl does
  });

  // csdp:matches, solve:assoc and every other first-column lookup share one index per APPEND CHAIN
  // (2026-09-28): the reader's fold appends a record per landed sentence and asks the population
  // index after each, and indexing each new array afresh keyed 1.55 million rows on tasks' closure
  // to answer 3,344 asks. An array appended to the newest array of a chain extends the chain's
  // index, and every array of the chain must still answer ONLY its own rows. Each ask is held
  // against csdp:matches' own DEF: the chain's tip and its older arrays asked after it has grown
  // past them, a branch off an array that is no longer the tip, a cat, rows that raise, and keys
  // that are a number beside its spelling or a sequence.
  test("a lookup over an array appended to an indexed one answers that array's rows and no others", () => {
    const def = DEFS.get("csdp:matches");
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const same = (key, rows) => expect(run(() => Ev("csdp:matches", [key, rows]))).toBe(run(() => Ev(def, [key, rows])));
    const chain = [[["a", 1], ["b", 2], ["a", 3]]];
    same("a", chain[0]);
    for (let i = 0; i < 6; i++) chain.push(Ev("apndr", [chain[chain.length - 1], [i % 2 ? "a" : "c", 10 + i]]));
    for (const rows of chain) for (const key of ["a", "b", "c", "z"]) same(key, rows);
    for (let k = chain.length - 1; k >= 0; k--) same("a", chain[k]);   // the older arrays, after the chain ran past them
    const b1 = Ev("apndr", [chain[3], ["a", 99]]), b2 = Ev("apndr", [chain[3], ["b", 98]]);   // a branch
    for (const key of ["a", "b", "c"]) { same(key, b1); same(key, b2); same(key, chain[3]); same(key, chain[chain.length - 1]); }
    const c1 = Ev("cat", [chain[chain.length - 1], [["a", 50], ["d", 51]]]);
    for (const key of ["a", "d", "c"]) same(key, c1);
    same("a", Ev("apndr", [c1, "atom"]));   // raises, as the fold's selector does
    same("a", Ev("apndr", [c1, []]));
    same("a", c1);
    const mixed = [[1, "one"], ["1", "string one"], [["x"], "nested"], [1, "one again"]];
    for (const key of [1, "1", ["x"], ["y"]]) same(key, mixed);
    const m2 = Ev("apndr", [mixed, [["x"], "nested 2"]]);
    for (const key of [1, "1", ["x"]]) { same(key, m2); same(key, mixed); }
    expect(Ev("csdp:matches", ["a", chain[0]])).toEqual([["a", 1], ["a", 3]]);   // the root, after six appends
    expect(Ev("solve:assoc", ["c", chain[0]])).toEqual([]);
    expect(Ev("solve:assoc", ["c", chain[1]])).toBe(10);
  });

  // compile:text_rows -- a readings file's rows from its name and text -- is kept across runs by the host
  // (2026-09-28), keyed by the composition and the text, so an unchanged file is not parsed again. The
  // kept answer must be the DEF's, a changed text must be a new entry and never the old one's rows, and a
  // .env must be parsed and NEVER kept: its rows carry the plaintext compile.js seals.
  test("a readings file's rows are kept across runs by its text, and a .env's never are", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-parse-cache-"));
    const path = join(dir, "parse.db"), was = process.env.AREST_PARSE_CACHE;
    process.env.AREST_PARSE_CACHE = path;
    try {
      const def = DEFS.get("compile:text_rows");
      const text = "Customer(.id) is an entity type.\nEach Customer has at most one Email.\n";
      const cold = Ev("compile:text_rows", ["a.md", text]), warm = Ev("compile:text_rows", ["a.md", text]);
      expect(JSON.stringify(cold)).toBe(JSON.stringify(Ev(def, ["a.md", text])));
      expect(JSON.stringify(warm)).toBe(JSON.stringify(cold));
      const more = text + "Email is a value type.\n";
      expect(JSON.stringify(Ev("compile:text_rows", ["a.md", more]))).toBe(JSON.stringify(Ev(def, ["a.md", more])));
      const env = "Connection 'x' has Secret Reference 'not-a-real-secret'.\n";
      expect(JSON.stringify(Ev("compile:text_rows", [".env", env]))).toBe(JSON.stringify(Ev(def, [".env", env])));
      const db = new Database(path, { readonly: true });
      const kept = db.query("select v from rows").values().map((r) => String(r[0]));
      db.close();
      expect(kept.length).toBe(2);
      expect(kept.some((v) => v.includes("not-a-real-secret"))).toBe(false);
    } finally {
      if (was === undefined) delete process.env.AREST_PARSE_CACHE; else process.env.AREST_PARSE_CACHE = was;
      try { rmSync(dir, { recursive: true, force: true }); } catch { }
    }
  });

  // read:parse's fold is kept at its checkpoints by the host (2026-09-29): the DEF's WHILE run a chunk of rows at a
  // time, the state at a few chunk boundaries kept in the parse cache under the composition, the strict cell, the
  // initial state and every row folded to there, and a parse started from the last one it finds. A fold started
  // from a kept state must be the DEF's answer; a row added after it must start from it; and a row changed before
  // it must never start from it, however alike the rows after it are -- the key is the chain of every row folded
  // to the boundary, not the rows of one chunk.
  test("the parse's fold is kept at its checkpoints, and a fold started from one is the DEF's answer", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-fold-kept-"));
    const path = join(dir, "parse.db"), was = process.env.AREST_PARSE_CACHE;
    process.env.AREST_PARSE_CACHE = path;
    try {
      const def = DEFS.get("read:parse");
      const NL = String.fromCharCode(10);
      const meta = Ev("compile:rows", [META]);
      const probe = (noun, more) => Ev("compile:text_rows", ["probe.md",
        [noun + "(.id) is an entity type.", "", "Domain 'fold-probe' has Description 'a kept fold'.", "", ...more, ""].join(NL)]);
      const a = [...meta, ...probe("Fold Probe", [])];
      const plus = [...meta, ...probe("Fold Probe", ["Domain 'fold-probe-2' has Description 'one more'."])];
      const b = [...meta, ...probe("Fold Probe Two", [])];
      const kept = () => globalThis.AREST.foldLast().kept;
      const same = (rows) => expect(JSON.stringify(Ev("read:parse", rows))).toBe(JSON.stringify(Ev(def, rows)));
      same(a);
      expect(kept()).toBe(0);              // nothing kept yet
      same(a);
      expect(kept()).toBeGreaterThan(0);   // the same rows: from the last state kept
      same(plus);
      expect(kept()).toBeGreaterThan(0);   // an instance sentence after it: from a kept state
      same(b);                             // a declaration changed before every kept state: from none of a's
      const db = new Database(path, { readonly: true });
      expect(db.query("select count(*) n from folds").get().n).toBeGreaterThan(0);
      db.close();
    } finally {
      if (was === undefined) delete process.env.AREST_PARSE_CACHE; else process.env.AREST_PARSE_CACHE = was;
      try { rmSync(dir, { recursive: true, force: true }); } catch { }
    }
  }, 120_000);

  // The per-token string tests have native twins (2026-09-28): charisdigit, charislow and charup were lambda
  // over chars with no twin, under read:numchar (220,208 calls on tasks' closure), read:is_numword,
  // read:lastn and read:endswith (106,456 each) and cn:pascalw (38,057). Each DEF's compiled form is
  // evaluated beside its twin on every branch its contract distinguishes -- the empty string, the first
  // character alone deciding, a character past the ASCII ranges, an astral one, a combining mark, a
  // hyphen anywhere, a count below zero or fractional -- and on the shapes the DEF raises on.
  test("the per-token string twins are their DEFs", () => {
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const strs = ["", "a", "z", "A", "Z", "0", "9", "5x", "x5", "-", "--a", "a-b", "-a-b-", "1.5", ".", "..", "1..2",
      "zebra", "Zebra", "ábc", "ß", "\u{1D7D8}", "a\u0301", " ", "1e5", ".5", "5.", "@", "[", "`", "{", "customer-id"];
    for (const name of ["charisdigit", "charislow", "charup", "read:numchar", "read:is_numword", "cn:pascalw"]) {
      const def = DEFS.get(name);
      for (const x of [...strs, 5, ["a"], []]) expect(run(() => Ev(name, x))).toBe(run(() => Ev(def, x)));
    }
    const L = ["a", "b", "c", "d"], N = [["x"], "y", 3];
    for (const x of [[0, L], [1, L], [4, L], [9, L], [-1, L], [1.5, L], [2.5, L], [0, []], [2, "atom"], ["2", L], [1, N], "atom", [1]])
      expect(run(() => Ev("read:lastn", x))).toBe(run(() => Ev(DEFS.get("read:lastn"), x)));
    for (const x of [[["c", "d"], L], [["b"], L], [[], L], [L, L], [["z", "a", "b", "c", "d"], L], [["a"], []], [[3], N], [["3"], [3]], ["atom", L], [["a"]]])
      expect(run(() => Ev("read:endswith", x))).toBe(run(() => Ev(DEFS.get("read:endswith"), x)));
    expect(Ev("charup", "zebra")).toBe("Z");   // the first character alone
    expect(Ev("charup", "a\u0301")).toBe("A");
    expect(Ev("read:lastn", [2.5, L])).toEqual(["c", "d"]);
    expect(Ev("cn:pascalw", "customer-id")).toBe("Customerid");
  });

  // read:rule_match_at and read:rule_findrun have native twins (2026-09-28): the rules compiler's subtype
  // narrowing scanned every clause for every subtype's words, a WHILE over positions with a slice and a
  // match at each. Held against the DEFs on every branch: a subscript of digits, none, a non-digit tail,
  // a digit charisdigit does not count, the leading words differing, a start past the end or below 1,
  // an empty player, words that are not strings.
  test("the rule-scan twins are their DEFs", () => {
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const P1 = ["Customer"], P2 = ["Domain", "Change"];
    const C = ["each", "Customer1", "has", "some", "Domain", "Change", "and", "Domain", "Change2", "Customer", "Customerx", "Customer\u0663"];
    for (const m of [[P1, ["Customer"]], [P1, ["Customer12"]], [P1, ["Customerx"]], [P1, ["Custom"]], [P1, ["Customer\u0663"]],
                     [P2, ["Domain", "Change7"]], [P2, ["Domains", "Change7"]], [[], ["x"]], [["x"], [5]], [[5], ["x"]], [["x"]]])
      expect(run(() => Ev("read:rule_match_at", m))).toBe(run(() => Ev(DEFS.get("read:rule_match_at"), m)));
    for (const p of [P1, P2, ["zzz"], [], [5]]) for (const i of [1, 3, 9, 13, 0, 1.5])
      expect(run(() => Ev("read:rule_findrun", [p, C, i]))).toBe(run(() => Ev(DEFS.get("read:rule_findrun"), [p, C, i])));
    expect(Ev("read:rule_findrun", [P1, C, 1])).toEqual([2, "1"]);
    expect(Ev("read:rule_findrun", [P1, C, 3])).toEqual([10, ""]);
    expect(Ev("read:rule_match_at", [P1, ["Customer\u0663"]])).toEqual([]);
  });

  // cn:contains has a twin (2026-09-29): a substring test the DEF answers with a WHILE over characters.
  // Held against the DEF on every branch its contract distinguishes -- an empty text, an empty part, a
  // part longer than the text, at the start, the middle, the end, overlapping, repeated, absent -- on
  // characters past ASCII and past the BMP, and on the shapes the DEF raises on.
  test("the cn:contains twin is its DEF", () => {
    const def = DEFS.get("cn:contains");
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const texts = ["", "a", "ab", "abc", "aaa", "abab", "FactTypeIsInvolvedIn", "IsInvolved", "sInvolved",
      "café", "é", "x𝟘y", "𝟘", " ", "a b"];
    for (const a of texts) for (const b of texts)
      expect(run(() => Ev("cn:contains", [a, b]))).toBe(run(() => Ev(def, [a, b])));
    for (const x of [[5, "5"], ["5", 5], [["a"], "a"], ["a"], "a", [], ["abc", "b", "extra"]])
      expect(run(() => Ev("cn:contains", x))).toBe(run(() => Ev(def, x)));
    expect(Ev("cn:contains", ["", ""])).toBe("F");   // an empty text contains nothing
    expect(Ev("cn:contains", ["a", ""])).toBe("T");
    expect(Ev("cn:contains", ["FactTypeIsInvolvedIn", "IsInvolved"])).toBe("T");
  });

  // rmap:proj_row has a twin (2026-09-29): an entity table's row a column at a time, each column's path
  // resolved once -- its first step, fact type, population and key position, asked of the DEFs
  // rmap:proj_val asks -- and a row answered by one index lookup per column. Held against the DEF on
  // every entity table of this store (the metamodel absorbs every entity type into Function, so it is
  // that one): keys spread over each table, keys no table holds, a key that
  // is #, a number, a sequence, the empty string; and on the shapes the DEF raises on, which the twin
  // hands back to it.
  test("the rmap:proj_row twin is its DEF on every entity table", () => {
    const def = DEFS.get("rmap:proj_row");
    const run = (f) => { try { return JSON.stringify(f()); } catch (e) { return "raises"; } };
    const fts = Ev("store:fts", CELLS);
    let tables = 0, rows = 0, filled = 0;
    for (const t of Ev("rmap:coltabs", CELLS)) {
      const table = String(t[0]);
      if (Ev("rmap:proj_hits", [table, fts]).length > 0) continue;   // a relation table's rows are proj_relrow's
      tables++;
      const keys = Ev("rmap:proj_keys", [table, CELLS]);
      const pick = keys.filter((_, i) => i % Math.max(1, Math.floor(keys.length / 200)) === 0);
      for (const k of [...pick, "no-such-key", "#", 7, ["a", "b"], ""]) {
        const twin = run(() => Ev("rmap:proj_row", [k, table, CELLS]));
        expect(twin).toBe(run(() => Ev(def, [k, table, CELLS])));
        rows++;
        if (twin !== "raises" && JSON.parse(twin).some((v) => v !== "#")) filled++;
      }
    }
    expect(tables).toBeGreaterThan(0);
    expect(filled).toBeGreaterThan(100);   // the rows compared hold values, not only #
    for (const x of [["k"], ["k", "Function"], "atom", [], ["k", "NoSuchTable", CELLS], ["k", 5, CELLS]])
      expect(run(() => Ev("rmap:proj_row", x))).toBe(run(() => Ev(def, x)));
    expect(Ev("rmap:proj_row", ["k", "NoSuchTable", CELLS])).toEqual([]);
  });

  // read:has_key <k, rows> -- some row's first element eq k -- is answered from a key index kept along the
  // parse's fold (2026-09-28): an appended record adds its key, and read:put_row, which replaces a record in
  // place and keeps its key where it was, shares the index outright. Every array of the chain must still
  // answer only for its own rows: the tip after a put, the older arrays after the chain ran past them, a
  // branch, rows that raise, keys that are a number beside its spelling or a sequence.
  test("whether some row is keyed k is answered for that array's rows, through appends and in-place puts", () => {
    const def = DEFS.get("read:has_key");
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const same = (k, rows) => expect(run(() => Ev("read:has_key", [k, rows]))).toBe(run(() => Ev(def, [k, rows])));
    const rec = (name, vals) => [name, ["A", "B"], [], [], [vals], [], []];
    const chain = [[rec("F", ["x"]), rec("G", ["y"])]];
    same("F", chain[0]);
    for (let i = 0; i < 4; i++) chain.push(Ev("apndr", [chain[chain.length - 1], rec("N" + i, ["v"])]));
    const put = Ev("read:put_row", [chain[chain.length - 1], ["F", "w"]]);
    const after = Ev("apndr", [put, rec("Z", ["q"])]);
    for (const k of ["F", "G", "N0", "N3", "Z", "Q"]) { same(k, put); same(k, after); for (const rows of chain) same(k, rows); }
    const branch = Ev("apndr", [chain[1], rec("B1", ["b"])]);
    for (const k of ["B1", "N0", "F"]) { same(k, branch); same(k, chain[1]); }
    same("F", Ev("apndr", [after, "atom"]));
    same(1, [[1, "a"], ["1", "b"]]); same("1", [[1, "a"]]); same(["x"], [[["x"], 1]]); same("a", []);
    expect(Ev("read:has_key", ["Z", chain[chain.length - 1]])).toBe("F");   // appended after it, so not its row
    expect(Ev("read:has_key", ["N3", put])).toBe("T");
  });

  // read:super_of <name, rows> -- the supertype the first subtype row for name gives, or "" -- is answered
  // from an index kept along the fold (2026-09-28): an appended row extends it, and read:put_row, which only
  // ever replaces a record holding a population and never a subtype row, shares it. Every array of the chain
  // must still answer for its own rows: the first subtype row winning over a later one, older arrays asked
  // after the chain ran past them, a branch, a put, and rows the DEF raises on.
  test("a name's supertype is answered for that array's rows, through appends and in-place puts", () => {
    const def = DEFS.get("read:super_of");
    const run = (f) => { try { return JSON.stringify(f()); } catch { return "raises"; } };
    const same = (nm, rows) => expect(run(() => Ev("read:super_of", [nm, rows]))).toBe(run(() => Ev(def, [nm, rows])));
    const sub = (a, b) => [a + "IsASubtypeOf" + b, [a, b], [], [], ["subtype"], [], []];
    const fact = (name, vals) => [name, ["X", "Y"], [], [], [vals], [], []];
    // as the fold does: the newest array is asked before the next is appended to it, so the index is
    // one and the chain extends it; the older arrays are asked only after it has run past them
    const chain = [[sub("Agent", "User"), fact("F", ["x"])]];
    same("Agent", chain[0]);
    for (const row of [fact("G", ["y"]), sub("User", "Function"), sub("Agent", "Other"), fact("H", ["z"])]) {
      chain.push(Ev("apndr", [chain[chain.length - 1], row]));
      same("Agent", chain[chain.length - 1]);
    }
    const put = Ev("read:put_row", [chain[chain.length - 1], ["F", "w"]]);
    same("User", put);
    const after = Ev("apndr", [put, sub("Nope", "Some")]);
    same("Nope", after);
    for (const nm of ["Agent", "User", "Nope", "Function"]) {
      for (const rows of chain) same(nm, rows);
      same(nm, put); same(nm, after);
    }
    const branch = Ev("apndr", [chain[1], sub("Nope", "Branch")]);
    for (const nm of ["Nope", "User"]) { same(nm, branch); same(nm, chain[1]); }
    same("Agent", Ev("apndr", [after, ["short"]]));
    expect(Ev("read:super_of", ["Agent", after])).toBe("User");   // the first subtype row wins
    expect(Ev("read:super_of", ["User", chain[1]])).toBe("");      // appended after it
    expect(Ev("read:super_of", ["Nope", put])).toBe("");           // appended after it too
  });

  // strdown has a fast twin too. Its DEF folds each character through
  // chardown -- charisup, then charmap:pick over the 26 pairs -- and
  // e33971ab's case-fold in cn:number calls it for both sides of every
  // column-name comparison: 109,544 calls on the base metamodel, 18.2 s
  // inclusive instrumented, the ddl phase 4.3-6.2 s -> 16.1 s uninstrumented
  // (2026-09-21). The DEF is the meaning either way, and its compiled form is
  // evaluated here beside the twin on every branch: the empty string, each end
  // of A-Z and the neighbour outside it, digits and punctuation, letters above
  // ASCII (charisup compares code units, so they are not upper), and an astral
  // code point; a non-string is refused in chars's words by both.
  test("the strdown twin is its DEF", () => {
    const def = DEFS.get("strdown");
    for (const input of ["", "A", "Z", "@", "[", "a", "z", "Zebra", "URL2", "url1", "meterEndpoint",
                         "\u00dcn\u00efcode", "\u00c9", "\u00df", "A\u{1F600}B", "9-_ x", "A\u{1F600}B-\u00c9z9"])
      expect(JSON.stringify(Ev("strdown", input))).toBe(JSON.stringify(Ev(def, input)));
    expect(Ev("strdown", "A\u{1F600}B-\u00c9z9")).toBe("a\u{1F600}b-\u00c9z9");
    expect(() => Ev("strdown", ["A"])).toThrow("chars on non-string");
    expect(() => Ev(def, ["A"])).toThrow("chars on non-string");
  });

  // read:put_row has a fast twin as well. Its DEF is COMP(ALPHA(read:row_at),
  // distr): distr pairs EVERY row with the item, so one put is one interpreted
  // scan of the whole list -- 1,354 calls made 1,274,506 read:row_at calls on
  // the base metamodel, 941 per write, which is the row count (2026-09-18).
  // The scan is inherent; interpreting it is not. The twin hands any shape the
  // DEF would RAISE on back to the DEF, so the five throwing shapes below are
  // part of the contract and not this twin's to reproduce.
  test("the read:super_of twin is its DEF", () => {
    const def = DEFS.get("read:super_of");
    const row = (n, players, f5) => [n, players, [], [], f5, ["t"], ["{0}"]];
    const sub = (n, a, b) => row(n, [a, b], ["subtype"]);
    const der = (n, a, b, second) => row(n, [a, b], ["derived", second]);
    const plain = row("Plain", ["A", "B"], [[]]);   // as a real corpus row has it
    const inputs = [
      [["A", []]],                                          // no rows at all
      [["A", [sub("S", "A", "Super")]]],                    // the one subtyping matches
      [["Z", [sub("S", "A", "Super")]]],                    // nothing matches -> ""
      [["A", [sub("S1", "A", "First"), sub("S2", "A", "Second")]]],  // FIRST wins
      [["A", [plain, sub("S", "A", "Super"), plain]]],      // found past plain rows
      [["A", [der("D", "A", "Super", "subtype")]]],         // derived+subtype counts
      [["A", [der("D", "A", "Super", "other")]]],           // derived+other does not
      [["A", [row("R", ["A", "B", "C"], ["subtype"])]]],    // three players, skipped
      [["A", [row("R", ["A"], ["subtype"])]]],              // one player, skipped
      [["", [sub("S", "", "Super")]]],                      // the empty name has a head too
      [["A", [sub("S", "A", "")]]],                         // the supertype IS the empty atom
      [["A", [plain]]],                                     // only plain rows
    ];
    for (const [input] of inputs)
      expect(JSON.stringify(Ev("read:super_of", input))).toBe(JSON.stringify(Ev(def, input)));
    // the twin indexes the rows array by IDENTITY and keeps that index, so ask
    // ONE array for several names -- a cached index that answered the first
    // name and not the rest, or that leaked one name onto another, passes
    // every case above and fails here.
    const shared = [sub("S1", "A", "Super"), sub("S2", "B", "Other"), plain,
                    sub("S3", "A", "Later"), der("D", "C", "Third", "subtype")];
    for (const name of ["A", "B", "C", "Plain", "Z", "", "A"])
      expect(JSON.stringify(Ev("read:super_of", [name, shared])))
        .toBe(JSON.stringify(Ev(def, [name, shared])));
    // and the shapes the DEF raises on: the twin must raise the same words
    for (const input of [
      [["A", [row("R", ["A", "B"], [])]]],                  // slot 5 empty
      [["A", [["short", ["A", "B"]]]]],                     // a row of two
      [["A", ["atomrow"]]],                                 // an atom where a row goes
      [["A", [row("R", "notalist", ["subtype"])]]],         // the players are an atom
      [["A", [row("R", ["A", "B"], ["derived"])]]],         // derived with nothing behind it
      [["A", [sub("S", "A", "Super"), row("R", ["A", "B"], [])]]],  // the BAD row is second
    ]) {
      const [x] = input;
      let tw = "", dw = "";
      try { Ev("read:super_of", x); } catch (e) { tw = e.message; }
      try { Ev(def, x); } catch (e) { dw = e.message; }
      expect(dw).not.toBe("");        // the DEF really does raise on this shape
      expect(tw).toBe(dw);
    }
  });
  // rmap:unproj_live has a fast twin, and it is the one a store read runs through for
  // every row of every table: the DEF builds a triple for EVERY column and drops the
  // empty ones after, the twin builds only the ones it keeps. Held to its DEF on a real
  // table's ctx -- the widest the test store has, where a triple per column is the whole
  // cost -- over rows empty, full, sparse, short, long, carrying numbers and the empty
  // string, and on the shapes the DEF raises on, which the twin must hand back to it.
  test("the rmap:unproj_live twin is its DEF", () => {
    const def = DEFS.get("rmap:unproj_live");
    const tables = Ev("rmap:coltabs", CELLS).map((t) => String(t[0]));
    const widest = tables.map((t) => [t, Ev("rmap:unproj_ctx", [t, CELLS])])
      .filter(([, c]) => Array.isArray(c) && Array.isArray(c[1]))
      .sort((a, b) => b[1][1].length - a[1][1].length)[0];
    expect(widest).toBeDefined();
    const ctx = widest[1], w = ctx[1].length;
    expect(w).toBeGreaterThan(20);
    const at = (f) => Array.from({ length: w }, (_, i) => f(i));
    const rows = [
      at(() => "#"),                                    // nothing held
      at((i) => "v" + i),                               // every column held
      at((i) => (i % 7 === 0 ? "v" + i : "#")),         // sparse, as a wide table is
      at((i) => (i === w - 1 ? "last" : "#")),          // only the last column
      at((i) => (i % 3 === 0 ? i : "#")),               // numbers where values go
      at((i) => (i % 5 === 0 ? "" : "#")),              // the empty string is a value
      at((i) => "v" + i).slice(0, 3),                   // shorter than the paths: zip stops
      at((i) => "v" + i).concat(["extra", "#", "x"]),   // longer: the paths stop it
      [],
    ];
    for (const row of rows)
      expect(JSON.stringify(Ev("rmap:unproj_live", [row, ctx]))).toBe(JSON.stringify(Ev(def, [row, ctx])));
    // the shapes the DEF raises on: the twin must raise the same words
    const badPath = [ctx[0], ctx[1].slice(0, 2).concat(["atom"], ctx[1].slice(3))].concat(ctx.slice(2));
    for (const x of [
      [at(() => "#"), badPath],                         // a path that is an atom, under an EMPTY cell
      [at((i) => [i]), ctx],                            // a value that is a sequence
      ["row", ctx],                                     // an atom where the row goes
      [at(() => "#"), "ctx"],                           // an atom where the ctx goes
    ]) {
      let tw = "", dw = "";
      try { Ev("rmap:unproj_live", x); } catch (e) { tw = e.message; }
      try { Ev(def, x); } catch (e) { dw = e.message; }
      if (dw === "") expect(JSON.stringify(Ev("rmap:unproj_live", x))).toBe(JSON.stringify(Ev(def, x)));
      else expect(tw).toBe(dw);
    }
  });
  // and rmap:unproj_key beside it: the key's values of a row, by the same ctx, over the
  // same rows plus one whose key column is empty, which the DEF keeps as #.
  test("the rmap:unproj_key twin is its DEF", () => {
    const def = DEFS.get("rmap:unproj_key");
    const tables = Ev("rmap:coltabs", CELLS).map((t) => String(t[0]));
    const keyed = tables.map((t) => [t, Ev("rmap:unproj_ctx", [t, CELLS])])
      .filter(([, c]) => Array.isArray(c) && Array.isArray(c[1]) && Array.isArray(c[2]) && c[2].length > 0)
      .sort((a, b) => b[1][1].length - a[1][1].length);
    expect(keyed.length).toBeGreaterThan(0);
    for (const [, ctx] of keyed.slice(0, 3)) {
      const w = ctx[1].length;
      const at = (f) => Array.from({ length: w }, (_, i) => f(i));
      for (const row of [at(() => "#"), at((i) => "v" + i), at((i) => (i % 7 === 0 ? "v" + i : "#")),
                         at((i) => (i % 3 === 0 ? i : "#")), at((i) => "v" + i).slice(0, 2), []])
        expect(JSON.stringify(Ev("rmap:unproj_key", [row, ctx]))).toBe(JSON.stringify(Ev(def, [row, ctx])));
    }
    const ctx = keyed[0][1], w = ctx[1].length;
    const badPath = [ctx[0], ctx[1].slice(0, 2).concat(["atom"], ctx[1].slice(3))].concat(ctx.slice(2));
    for (const x of [[Array.from({ length: w }, () => "#"), badPath], ["row", ctx]]) {
      let tw = "", dw = "";
      try { Ev("rmap:unproj_key", x); } catch (e) { tw = e.message; }
      try { Ev(def, x); } catch (e) { dw = e.message; }
      if (dw === "") expect(JSON.stringify(Ev("rmap:unproj_key", x))).toBe(JSON.stringify(Ev(def, x)));
      else expect(tw).toBe(dw);
    }
  });
  // and rmap:unproj itself (2026-09-29): a table's rows read back as facts, each column's decisions asked of the
  // DEFs once. Held to its DEF on every table the test store has, over the rows its own projection makes; on the
  // widest table and a relation table over rows empty, full, sparse, holding T, numbers and the empty string,
  // short and long; and on the shapes the DEF raises on, which the twin must hand back to it.
  test("the rmap:unproj twin is its DEF", () => {
    const def = DEFS.get("rmap:unproj");
    const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
    const same = (x) => {
      let tw = "", dw = "", a, b;
      try { a = Ev("rmap:unproj", x); } catch (e) { tw = e.message; }
      try { b = Ev(def, x); } catch (e) { dw = e.message; }
      expect(tw).toBe(dw);
      if (dw === "") expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      return dw;
    };
    const tables = Ev("rmap:coltabs", CELLS).map((t) => String(t[0]));
    let facts = 0, filled = 0;
    for (const t of tables) {
      const rows = Ev("rmap:proj_rows", [t, CELLS]).map((r) => r.map((v) => (v === "#" ? "#" : flat(v))));
      if (!rows.length) continue;
      filled++;
      same([t, rows, CELLS]);
      facts += Ev("rmap:unproj", [t, rows, CELLS]).length;
    }
    expect(filled).toBeGreaterThan(4);   // the base store fills six tables
    expect(facts).toBeGreaterThan(100);
    const ctxs = tables.map((t) => [t, Ev("rmap:unproj_ctx", [t, CELLS])]).filter(([, c]) => Array.isArray(c) && Array.isArray(c[1]));
    const widest = ctxs.slice().sort((a, b) => b[1][1].length - a[1][1].length)[0];
    const relation = ctxs.find(([, c]) => c[3] === "T" && Array.isArray(c[5]) && c[5].some((rc) => rc > 0));
    // and a table with a column whose fact type is unary, where only a T is a fact
    const fts = Ev("store:fts", CELLS);
    const unaryAt = (ctx) => ctx[1].findIndex((p) => { try { const ft = Ev("rmap:proj_carried", p[1]);
      return ft !== "#" && !ctx[2].includes(p[0]) && Ev("cn:contains", [ft, "IsInvolved"]) !== "T" && Ev("length", Ev(2, Ev(1, Ev("rmap:proj_hits", [ft, fts])))) === 1; } catch { return false; } });
    const unary = ctxs.find(([, c]) => Array.isArray(c[2]) && c[2].length > 0 && unaryAt(c) >= 0);
    expect(widest).toBeDefined();
    expect(relation).toBeDefined();
    expect(unary).toBeDefined();
    // row by row, so a row the DEF raises on does not stand in for the others
    let answered = 0;
    for (const [t, ctx] of [widest, relation, unary]) {
      const w = ctx[1].length;
      const at = (f) => Array.from({ length: w }, (_, i) => f(i));
      for (const row of [
        at(() => "#"), at((i) => "v" + i), at((i) => (i % 7 === 0 ? "v" + i : "#")), at((i) => (i % 2 ? "T" : "#")),
        at((i) => (i % 3 === 0 ? i : "#")), at((i) => (i % 5 === 0 ? "" : "#")), at((i) => "v" + i).slice(0, 3),
        at((i) => "v" + i).concat(["extra", "#", "x"]),
      ]) if (same([t, [row], CELLS]) === "") answered++;
      same([t, [], CELLS]);
    }
    expect(answered).toBeGreaterThan(6);
    // the unary column alone beside the key: T is the fact, anything else is none
    {
      const [t, ctx] = unary, w = ctx[1].length, u = unaryAt(ctx);
      const k = ctx[1].findIndex((p) => ctx[2].includes(p[0]));
      const only = (key, v) => Array.from({ length: w }, (_, i) => (i === k ? key : i === u ? v : "#"));
      expect(same([t, [only("k1", "T"), only("k2", "no"), only("k3", "")], CELLS])).toBe("");
      expect(Ev("rmap:unproj", [t, [only("k1", "T"), only("k2", "no")], CELLS]).length).toBe(1);
    }
    // the shapes the DEF raises on
    const [rt, rctx] = relation;
    const raised = [
      same([rt, [["x"]], CELLS]),                                            // a relation row short of its role columns
      same([widest[0], ["row"], CELLS]),                                    // a row that is an atom
      same([widest[0], "rows", CELLS]),                                     // rows that are an atom
    ];
    expect(raised.filter((m) => m !== "").length).toBeGreaterThan(1);
    same([widest[0], [Array.from({ length: widest[1][1].length }, (_, i) => (i === 1 ? ["a", "b"] : "#"))], CELLS]);   // a value that is a sequence
  }, 120_000);
  // cn:ucfacts has a twin (2026-09-29): the first preferred uniqueness holding a fact, from an index of the
  // uniqueness list. Held to its DEF over the test store's own uniquenesses, for every fact any of them holds and
  // for facts none does; over a list whose first preferred uniqueness is not the only one holding a fact; and on
  // the lists the DEF raises on.
  test("the cn:ucfacts twin is its DEF", () => {
    const def = DEFS.get("cn:ucfacts");
    const same = (x) => {
      let tw = "", dw = "", a, b;
      try { a = Ev("cn:ucfacts", x); } catch (e) { tw = e.message; }
      try { b = Ev(def, x); } catch (e) { dw = e.message; }
      expect(tw).toBe(dw);
      if (dw === "") expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      return dw === "" ? a : null;
    };
    const ucs = Ev("theta:flatten", Ev("ast:fetch", ["state:ucs", CELLS]));
    expect(ucs.length).toBeGreaterThan(100);
    const facts = [...new Set(ucs.flatMap((u) => u[3].map((r) => JSON.stringify(r[0]))))].map((f) => JSON.parse(f));
    let held = 0;
    for (const f of facts.concat(["NoSuchFactType", "", 1, ["a"]])) { const a = same([f, ucs]); if (Array.isArray(a) && a.length) held++; }
    expect(held).toBeGreaterThan(20);
    // two preferred uniquenesses holding one fact: the first is the answer; a non-preferred one before them is not
    const two = [["u0", "F", "F", [["X", 1]]], ["u1", "T", "F", [["X", 1], ["Y", 2]]], ["u2", "T", "F", [["X", 1], ["Z", 1]]]];
    expect(same(["X", two])).toEqual(["X", "Y"]);
    expect(same(["Z", two])).toEqual(["Z", "X"].reverse());
    expect(same(["W", two])).toEqual([]);
    same(["X", []]);
    // the lists the DEF raises on
    const raised = [
      same(["X", [["u", "T", "F"]]]),                        // a uniqueness short of its fourth field
      same(["X", [["u", "T", "F", ["atom"]]]]),               // a row that is an atom
      same(["X", [["u", "F", "F", [["Y", 1]]], "atom"]]),     // a uniqueness that is an atom
    ];
    expect(raised.filter((r) => r === null).length).toBe(3);
  });
  test("the read:put_row twin is its DEF", () => {
    const def = DEFS.get("read:put_row");
    const row = (name, chunks, t = ["p", "q"]) => [name, "b", "c", "d", chunks, t[0], t[1]];
    const nine = (p) => Array.from({ length: 9 }, (_, i) => `${p}${i}`);
    const inputs = [
      [[row("A", [["x"]]), row("B", [["y"]])], ["C", "z"]],          // no match
      [[row("A", [["x"]]), row("B", [["y"]])], ["A", "z"]],          // match, chunk short
      [[row("A", [nine("x")])], ["A", "z"]],                        // chunk full at 9 -> a new one
      [[row("A", [nine("x").slice(0, 8)])], ["A", "z"]],            // 8 -> appended
      [[row("A", [["x", "z"]])], ["A", "z"]],                       // already there
      [[row("A", [["z"], ["x"]])], ["A", "z"]],                     // already there, earlier chunk
      [[row("A", [["x"]]), row("A", [["y"]])], ["A", "z"]],         // two rows, one name
      [[], ["A", "z"]],                                             // no rows
      [[["A", "b", "c", "d", ["atom"], "p", "q"]], ["A", "z"]],      // not a fact row
      [[row("A", [["x"]])], ["A", ["z1", "z2"]]],                   // the value is a list
      [[row("A", [[["z1", "z2"]]])], ["A", ["z1", "z2"]]],          // that list already there
    ];
    for (const input of inputs)
      expect(JSON.stringify(Ev("read:put_row", input))).toBe(JSON.stringify(Ev(def, input)));
    // and the shapes the DEF raises on: the twin must raise the same words
    for (const input of [
      [[["A", "b", "c", "d", [], "p", "q"]], ["A", "z"]],                       // empty 5th
      [["atomrow", row("A", [["x"]])], ["A", "z"]],                             // an atom row
      [[["A", "b", "c", "d", [["x"], "atomchunk"], "p", "q"]], ["A", "z"]],     // a chunk that is an atom
      [[["A", "b", "c", "d", [["x"]]]], ["A", "z"]],                            // a row of five
      [[row("A", [["x"]])], ["A"]],                                            // an item of one
    ]) {
      let tw = "", dw = "";
      try { Ev("read:put_row", input); } catch (e) { tw = e.message; }
      try { Ev(def, input); } catch (e) { dw = e.message; }
      expect(dw).not.toBe("");        // the DEF really does raise on this shape
      expect(tw).toBe(dw);
    }
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
    const lambdaOnly = [...C.keys()].filter((n) => !O.has(n)), oracleOnly = [...O.keys()].filter((n) => !C.has(n));
    const derBoth = [...derC].filter((n) => derO.has(n)).length;
    // the rows as the carrier holds them (state:fts, chunked by nine), in its order; store:fts unfolds them
    const R = new Map(Ev("ast:fetch", ["state:fts", CELLS]).flat(1).map((d) => [String(d[0]), d]));
    const rowsEq = [...C.values()].filter((d) => R.has(String(d[0])) && J(d[4]) === J(R.get(String(d[0]))[4])).length;
    const rejected = out[2].filter((r) => Array.isArray(r[2]) && String(r[2][0]) === "rejected").length;
    // the state lambda writes (the ten synthesized populations included) and its uniqueness rows, against the carrier's
    const X = Ev("read:x_of", rows); const S = Ev("read:state_fts", X);
    const stateRows = S.filter((d) => R.has(String(d[0])) && J(d) === J(R.get(String(d[0])))).length;
    const U = new Set(Ev("ast:fetch", ["state:ucs", CELLS]).flat(1).map(J)); const stateUcs = Ev("read:state_ucs", X).filter((r) => U.has(J(r))).length;
    // THE WITNESS IS REGENERATED AND THE DISTANCE IS ZERO (2026-09-17). It was
    // recorded against carriers of 2026-09-15 19:14 and had drifted two days:
    // lambda read four descriptors the witness lacked (Verbalization Pattern's
    // fact types, from metamodel/verbalization.md and the orient and tutor
    // operations) and the rows of three operation fact types and of the
    // reflected populations they touch (kinds, instances, references, data
    // type, declaration order, subtype, reference mode, enum values) moved
    // with them. Regenerating tools/norma-oracle over metamodel/ closes all of
    // it: witness 257 -> 261, lambdaOnly 4 -> 0, rows 244 -> 250, stateRows 245
    // -> 257, stateUcs 624 -> 631, and every descriptor field agrees.
    // AND THE LAST ONE IS THIS BRANCH'S FIX. With the witness fresh but the
    // metamodel unchanged, ucs/all/stateRows each stayed ONE short, on
    // UserApprovesDomainChange alone: the self-modification gate's `exactly one
    // User approves that Domain Change` built a deontic uniqueness over the
    // Domain Change role, which is NARROWER than the fact type's spanning one,
    // so the oracle deleted the spanning UC ([[1,2]] -> [[2]]) while lambda's
    // reader kept both ([[1,2],[2]]) -- and NORMA then refused the model,
    // FactTypeRequiresInternalUniquenessConstraintError, because the only
    // uniqueness left on it was deontic. The gate now reads `some User`
    // (evolution.md), the spanning uniqueness the objectification stands on is
    // back, and both readers say [[1,2]]: ucs/all 260 -> 261, stateRows 257 ->
    // 258, stateUcs 631 -> 632.
    // AND Agent LEFT core (2026-09-18). `Agent is a subtype of Object Type
    // Instance` moved to readings/templates/agents.md, so the base metamodel
    // no longer carries AgentIsASubtypeOfObjectTypeInstance and its two
    // internal uniqueness constraints go with it: stateUcs 632 -> 630. Every
    // other field is unmoved -- the subtype fact is not a table, so witness,
    // lambda, players, ucs, mands, all and stateRows all stay where they were.
    // AND `Operation awaits a driver` IS STORED NOW (2026-09-18). Declaring it
    // `**` rather than `*` in metamodel/resolution.md puts it in the STORED
    // schema -- the oracle drops a `*` head from state:fts (Codd 1970 1.5,
    // Verifier.cs) and lambda's rmap:gate drops it from the map (NORMA
    // GATE:187-188), so a fully derived head has no table at all, which is why
    // this one had none while both of its inputs did. One fact type enters,
    // both readers read it the same way, and every count that ranges over the
    // schema moves by exactly one: witness/canon/both/players/ucs/mands/all
    // 261 -> 262, rows 250 -> 251, stateRows 258 -> 259. derived stays [37,
    // 37, 37] -- the head was always derivation-MARKED, only its mode moved,
    // full -> stored -- and stateUcs stays 630, because its uniqueness was in
    // state:ucs before the head was in state:fts.

    // AND A VALUE OF A VALUE TYPE IS NO LONGER RESOLVED TO A NAME (2026-09-18).
    // `read:lit_value` replaced a quoted literal by its pascal-cased form
    // whenever that form was a declared name -- right for a REFERENCE, wrong for
    // a VALUE, so `Pattern Example`'s seven well-formed FORML sentences came back
    // as EntityTypeIsASubtypeOfObjectType and the like. The role now decides:
    // read:parse carries the kind in its WHILE state and drops it before the
    // answer exists, so the declared entry stays three slots and the six
    // case:read-* goldens are untouched. THIS RAISES THE FLOOR, which is why the
    // pin moves: rows 251 -> 252 and stateRows 259 -> 262. stateRows now EQUALS
    // witness/canon/both/all at 262 -- every state row lambda writes is
    // byte-identical to the carrier's, the first time the distance has been zero
    // on that field. `lambda's state:otpops carries the witness's populations`
    // goes green with it; it was the same defect read through the populations.

    // AND A FULLY-DERIVED HEAD IS STORED LIKE ANY OTHER (Sam, 2026-09-21: an
    // app is a sqlite db with an interface, and reads come from the table).
    // The oracle drops a `*` head from state:fts (Codd 1970 1.5, Verifier.cs)
    // and read:stored_only did the same in both slots of read:parse; the
    // descriptor slot now keeps every fact record, with a `*` head's asserted
    // population blanked (read:rule_owned), so the closure's answer is what its
    // table holds. The 27 fully-derived heads of the base enter the stored
    // schema and every count that ranges over it moves by exactly 27:
    // witness/canon/both 262 -> 289, ucs and mands 262 -> 289 (the carrier and
    // the reader agree on their uniqueness and mandatory fields), rows 252 ->
    // 279 (their populations are [[]] on both sides; the same ten differ as
    // before), stateRows 262 -> 289. players and all STAY at 262: D is
    // state:declared, the ASSERTABLE schema, which still goes through
    // read:stored_only -- a fully-derived head cannot be asserted, so it has no
    // players there and is counted in neither. stateUcs 630 -> 665: the 16
    // binary heads whose only uniqueness spans both roles are objectified as
    // any asserted many-to-many is (NORMA binarizes), so their 16 spanning
    // UC:in rows become 35 single-role uniquenesses on the involvement fact
    // types plus 16 spanning UC:ip rows over involvement roles (+51, -16).
    // derived stays [37, 37, 37]: the markings never moved, only the storage.

    // AND A READING CARRIES ITS TEXT (2026-09-22). read:reflect writes an
    // ELEVENTH population at read time, ReadingHasText, and `rows` is the
    // field that counts it: read:parse is the parse alone and merges no
    // reflected row, so the ten pairs read:reflect wrote were exactly the ten
    // descriptors whose rows differed -- EntityTypeHasReferenceMode,
    // FactTypeHasDeclarationOrder, FactTypeHasDerivationMode,
    // ObjectTypeHasConceptualDataType, ObjectTypeHasEnumValues,
    // ObjectTypeInstanceHasReference, ObjectTypeInstanceIsInstanceOfObjectType,
    // ObjectTypeIsOfObjectKind, ObjectTypeIsSubtypeOfObjectType and
    // SubtypeFactProvidesPreferredIdentifier, measured by name. The eleventh is
    // ReadingHasText with its 402 rows, so rows 279 -> 278 and nothing else in
    // this expectation moves. stateRows STAYS 289: read:state_fts is the path
    // that merges the reflection, and it agrees with the carrier row for row.

    // AND AN OBJECTIFICATION THAT IS NO NOUN IS NO OBJECTIFICATION (2026-09-23).
    // 32 of the metamodel's 38 lose `X objectifies` and `X is a subtype of
    // Function`; the subtype link is one-to-one, a uniqueness on each role, so
    // the 32 subtype facts take 64 uniquenesses with them: stateUcs 665 -> 601.
    // It is still the whole agreement -- lambda and the carrier are one compile's.

    // AND A FUNCTION CAN FILL A JSON PATH FROM A TEMPLATE (2026-09-25). core.md declares
    // Body Template and `Function fills JSON Path with Body Template`, unique over Function
    // and JSON Path, and the carrier is regenerated by the recipe that first reproduced the
    // committed one byte for byte. One fact type enters and both readers read it the same
    // way: witness/lambda/both/ucs/mands/stateRows 289 -> 290, players/all 262 -> 263, rows
    // 278 -> 279, stateUcs 601 -> 605, derived unmoved. Still the whole agreement.

    // AND A CONNECTOR SAYS HOW ITS ANSWER PAGES (2026-09-25). federation.md declares Query
    // Parameter and Parameter Value and five fact types -- the query parameters, where the rows
    // are, the path that says there is more, and the cursor as two binaries -- with the recipe
    // that first reproduced the committed carrier byte for byte. Five fact types enter and both
    // readers read them alike: witness/lambda/both/ucs/mands/stateRows 290 -> 295, players/all
    // 263 -> 268, rows 279 -> 284, stateUcs 605 -> 615, derived unmoved.
    // AND A ROW IS READ ONLY WHERE ITS CONDITIONS HOLD (2026-09-25): Condition Value and
    // `Function reads rows where JSON Path equals Condition Value`, unique over Function and JSON
    // Path, and both readers read it alike: 295 -> 296, players/all 268 -> 269, rows 284 -> 285,
    // stateUcs 615 -> 619, derived unmoved.
    // AND A QUERY IS SENT AS THE BODY (2026-09-25): Query Text and `Function sends Query Text`,
    // at most one per Function, read alike: 296 -> 297, players/all 269 -> 270, rows 285 -> 286,
    // stateUcs 619 -> 620, derived unmoved.
    // AND A TRANSITION EXITS A STATUS IN A MACHINE (2026-09-28, #130): state.md derives
    // `Transition exits Status in State Machine Definition`, and terminal reads it. A fully derived
    // head, stored like every other and read alike by both: 297 -> 298, rows 286 -> 287, stateUcs
    // 620 -> 624 (its spanning uniqueness, objectified over three involvement fact types), derived
    // 37 -> 38. players/all stay at 270: a fully derived head has no players in the assertable
    // schema.
    // AND A SUCCESSFUL CALL ASSERTS WHAT IT ESTABLISHED (2026-09-28, #131): core.md declares
    // `Function asserts Fact Type on success`, asserted and unique over both roles, read alike:
    // 298 -> 299, players/all 270 -> 271, rows 287 -> 288, stateUcs 624 -> 627 (the spanning
    // uniqueness objectified over two involvement fact types), derived unmoved.
    // AND A CREDENTIAL IS WRITTEN AS ITS SYSTEM SAYS (2026-09-28): `External System has Credential
    // Encoding`, at most one per system, read alike: 299 -> 300, players/all 271 -> 272, rows 288 ->
    // 289, stateUcs 627 -> 628, derived unmoved.
    // AND AN INSTANCE'S DOMAIN IS ITS MOST SPECIFIC TYPE'S (2026-09-28): instances.md derives
    // `Object Type Instance is properly of Object Type` and `is most specifically of`, read alike:
    // 300 -> 302, rows 289 -> 291, stateUcs 628 -> 634 (two spanning uniquenesses objectified),
    // derived 38 -> 40. players/all stay at 272: a fully derived head has no players to assert.
    // RE-PINNED 2026-10-02, each move a commit's own and alike in both readers (lambdaOnly and
    // oracleOnly stayed 0; the carrier is regenerated by each commit below):
    // - 0277020a (09-30): `Each Function reads rows at at most one JSON Path` attaches, so
    //   FunctionReadsRowsAtJSONPath is n:1 and no longer objectified: stateUcs 634 -> 632.
    // - 5781f228 (09-30): `Constraint is semantic` is derived (Sam's judged deontic): players/all
    //   272 -> 271, derived 40 -> 41.
    // - 3079d929 (09-30): metamodel/layout.md is deleted, and with it Source Location's two fact
    //   types: 302 -> 300, players/all 271 -> 269, stateUcs 632 -> 627.
    // - 79def8ec (10-01): `External System resolves to Resolved Address` enters security.md, its
    //   spanning uniqueness objectified: 300 -> 301, players/all 269 -> 270, stateUcs 627 -> 630.
    // - 186c1497 (10-01): Function has one Description, and Domain, JS Package, Object Type and
    //   Predicate have none of their own: 301 -> 298, players/all 270 -> 267, stateUcs 630 -> 627.
    // - df80097c (10-02): the reader honors `**`, so Operation awaits a driver leaves the
    //   assertable schema: players/all 267 -> 266.
    // rows 291 -> 287 with the schema, eleven short of it as before.
    expect({ witness: O.size, lambda: C.size, both, lambdaOnly: lambdaOnly.length, oracleOnly: oracleOnly.length,
             players, ucs, mands, all, rows: rowsEq, rejected, derived: [derO.size, derC.size, derBoth], stateRows, stateUcs })
      .toEqual({ witness: 298, lambda: 298, both: 298, lambdaOnly: 0, oracleOnly: 0,
                 players: 266, ucs: 298, mands: 298, all: 266, rows: 287, rejected: 0, derived: [41, 41, 41], stateRows: 298, stateUcs: 627 });
  }, 300_000);

  // state:deontics, row for row (task #93, 2026-09-16). The witness builds 13 of
  // the base metamodel's 37 deontic sentences -- 9 mandatory, 1 uniqueness, 3
  // prohibited -- and the carrier lambda writes must hold the same 13 rows, key,
  // kind and legs, in both directions; the rows are listed by name on a miss.
  // AND ONE MORE SINCE THE SELF-MODIFICATION GATE WAS RESTATED (2026-09-17,
  // #108), re-recorded here against a regenerated witness. `It is obligatory
  // that each applied Domain Change is approved by exactly one Human` named a
  // type that plays no role in any fact type, so NEITHER reader carried it and
  // the gate was enforced nowhere. Restated against `User`, `exactly one` read
  // as a uniqueness over the Domain Change role -- NARROWER than the spanning
  // uniqueness `User approves Domain Change` is objectified over, so the oracle
  // deleted the spanning one and NORMA refused the model. The gate now reads
  // `some User`, which is the form this metamodel uses for an obligation over
  // an objectified fact type (core.md:1701), and it carries DEO:m -- every
  // applied change has an approval -- keyed through the objectification's link
  // fact type as read:deo_nest_leg has it. Both readers write that row and
  // neither writes a DEO:u: 13 rows, no side-only rows in either direction.
  // What `no second approver` costs to carry is written out in evolution.md
  // beside the sentence: a deontic uniqueness beside the alethic spanning one
  // is legal ORM and the oracle's AddInternalUC, which compares role spans and
  // never modality, cannot build the pair.
  test("lambda's state:deontics is the witness's, row for row", () => {
    const rows = [];
    for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const J = (x) => JSON.stringify(x);
    const cells = new Map(Ev("read:schema_of", rows).map((c) => [String(c[0]), c[1]]));
    const lambda = (cells.get("state:deontics") || []).map(J);
    const witness = Ev("ast:fetch", ["state:deontics", CELLS]).flat(1).map(J);
    const W = new Set(witness), C = new Set(lambda);
    expect({ witness: witness.length, lambda: lambda.length,
             oracleOnly: witness.filter((r) => !C.has(r)), lambdaOnly: lambda.filter((r) => !W.has(r)) })
      .toEqual({ witness: 13, lambda: 13, oracleOnly: [], lambdaOnly: [] });
  }, 300_000);

  // THE RULES THE READER CARRIES (#109). state:rules was written EMPTY until
  // 2026-09-16: the reader recognised a derivation sentence and kept its
  // clauses, and nothing compiled them into the recipe derive runs, so every
  // carrier lambda wrote had its heads marked and no deliverer. The compiler is
  // the read:rule_* family -- the oracle's arm sequence, read from the reader's
  // own records -- and this pins its answer against the witness's rows compared
  // as SETS of recipe trees in both directions (the trees are what derive
  // evaluates), and the heads the witness lists undelivered against the ones
  // lambda lists with a reason of its own naming. Pinned before the compiler
  // existed it failed at lambda 0 of 44. The witness writes two of its 46 rows
  // twice (its `and no ... where` arm re-emits what an earlier arm built);
  // lambda writes each row once, so the raw witness count is pinned beside it.
  //
  // AND THE ROW THAT WAS LAMBDA-ONLY IS THE RECORD OF WHAT THE ORACLE DID NOT
  // BUILD. metamodel/state.md states the Harel nesting of `Status is defined in
  // State Machine Definition` (a state defined in a nested machine is defined in
  // the machine that nests it); the reader compiles it with the SUBTYPE
  // NARROWING arm, and the oracle built no rule for that head at all -- it
  // listed StatusIsDefinedInStateMachineDefinition as UNDELIVERED. That row is
  // now in the carrier, because lambda writes the carrier, so lambdaOnly is 0 and
  // witnessUndelivered is two names rather than three. The 46-vs-45 row count
  // went the same way: the oracle wrote two of its rows twice, from an
  // `and no ... where` arm that re-emitted what an earlier arm had built, and
  // lambda writes each row once.
  //
  // What survives is the round trip: 45 rules in, 45 rules out, every recipe
  // tree identical after the carrier has been written and parsed again. 48
  // since 2026-09-28 (#130): the three rules of `Transition exits Status in
  // State Machine Definition` enter state.md, and terminal's rule is stated
  // again over it, one rule for one. 50 since 2026-09-28: an instance's domain is its most
  // specific type's, three rules for the one bridge rule. 51 since 2026-09-30 (5781f228):
  // `Constraint is semantic` is derived, by one rule. AND NOTHING IS UNDELIVERED since
  // 2026-09-30 (70c5339b): FactJoinsFact and ObjectTypeHasWorldAssumption have their recipes
  // in the hand-written rules:metamodel, and read:state_undelivered counts that cell now, in
  // lambda and so in the carrier it writes.
  test("the reader carries the witness's derivation rules, row for row", () => {
    const rows = [];
    for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
    const F = Ev("read:x_full", Ev("read:x_of", rows));
    const J = (x) => JSON.stringify(x);
    const witness = Ev("ast:fetch", ["state:rules", CELLS]).flat(1);
    const W = new Set(witness.map(J));
    const lambda = Ev("read:state_rules", F);
    const C = new Set(lambda.map(J));
    const both = [...C].filter((r) => W.has(r)).length;
    const und = Ev("read:state_undelivered", F);
    expect({ witnessRows: witness.length, witness: W.size, lambda: lambda.length, distinct: C.size, both, lambdaOnly: C.size - both, witnessOnly: W.size - both,
             lambdaOnlyRows: lambda.map(J).filter((r) => !W.has(r)),
             undelivered: und.map((p) => String(p[0])), reasons: und.every((p) => typeof p[1] === "string" && p[1].length > 0),
             witnessUndelivered: Ev("ast:fetch", ["state:undelivered", CELLS]).flat(1).map((p) => String(p[0])) })
      .toEqual({ witnessRows: 51, witness: 51, lambda: 51, distinct: 51, both: 51, lambdaOnly: 0, witnessOnly: 0,
                 lambdaOnlyRows: [],
                 undelivered: [], reasons: true,
                 witnessUndelivered: [] });
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
describe("lambda's reader carries the witness's general chain", () => {
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
    // not delivered` (arest-dev/readings/build-surface.md), as arest-dev's carrier writes it.
    // THE FOURTH FIELD IS THE POSITIVE SIDE (8a53bafc, 2026-10-01): each negated leg is joined
    // against it, not against the subtraction so far, and for the first leg the two are the same.
    expect(J(Ev("read:rule_gchain_anti", ["FactTypeHasDerivationMode", ["Fact Type", "Derivation Mode"],
                                          ["FactTypeIsDelivered", ["Fact Type"]], "FactTypeHasDerivationMode"])))
      .toBe(J(["minus", "FactTypeHasDerivationMode",
               ["joinon", "FactTypeHasDerivationMode", "FactTypeIsDelivered", [[1, 1]], [1, 2]]]));
    // a leg sharing nothing with the body would subtract everything or nothing
    expect(Ev("read:rule_gchain_anti", ["FactTypeHasDerivationMode", ["Fact Type", "Derivation Mode"], ["ReadingIsPrimary", ["Reading"]], "FactTypeHasDerivationMode"]))
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
    // that Domain and that Object Type is of Object Kind 'entity'`: the second leg only
    // resolves through the declared supertype (Function belongs to Domain), so the
    // subtype's extent is joined on the substituted column; the kind is joined on the
    // same column and selected as 'entity' (2026-10-03: a value has no identity, so an
    // App displays entity types only), and only the accumulator's own columns are kept
    expect(treesOf("AppDisplaysObjectType")).toEqual([
      J(["proj", ["sel", ["joinon", ["joinon", ["joinon", "AppNavigatesDomain", "FunctionBelongsToDomain", [[2, 2]], [1, 2, 3, 4]],
                  "ObjectTypeIsOfObjectKind", [[3, 1]], [1, 2, 3, 4, 5, 6]],
                  ["sel", "ObjectTypeInstanceIsInstanceOfObjectType", 2, "Object Type"], [[3, 1]], [1, 2, 3, 4, 5, 6]], 6, "entity"], [1, 3]]),
    ]);
  }, 300_000);
});

// ---- THE CONSTRAINT CELLS THE STORE CONSUMES, AND THE ORDERING CELL --------
//
// Lambda's reader wrote 17 of the 29 design-state cells the witness writes, and
// five of the twelve it did not write are the ones a STORE reads: state:otpops
// is ui:ids, so every mandatory verdict ranged over an empty population and 16
// laws bottomed on `#`; state:exclusions is law:exclusion and cmd:excl_viols;
// state:rings is solve:rings; state:setcmp is cmd:sc_rows; state:qualifiers is
// the rendered role label. state:factorder is cn:foidx, the ordinal every
// relational constraint name is numbered by. Each is pinned here against the
// witness as a SET in both directions and, where the oracle's own order is
// reproducible, position for position.
//
// THE WITNESS IS REGENERATED (2026-09-17), exactly as the schema test above
// records. It used to predate metamodel/verbalization.md and the orient and
// tutor operations, so lambda read six fact types and six object types it had
// never seen and the distance was stated as "every witness row, and lambda's own
// newer ones named"; the two sides now hold the same sets and the pins below say
// so. A change in either direction is a finding, not noise.
describe("lambda's constraint cells against the witness, on the base metamodel", () => {
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
  // subtype exclusions as scope lists. Nine rings since 2026-09-30 (c08f870e): Domain is
  // contained in Domain is acyclic, Function is inverted by Function is symmetric, and JS
  // Package depends on JS Package is irreflexive, alike in both.
  for (const [cell, name, n] of [["read:ring_state", "state:rings", 9],
                                 ["read:qual_state", "state:qualifiers", 3],
                                 ["read:excl_state", "state:exclusions", 2]]) {
    test("lambda's " + name + " is the witness's, row for row", () => {
      const w = witness(name).map(J), c = Ev(cell, F).map(J);
      const W = new Set(w), C = new Set(c);
      expect({ witness: w.length, lambda: c.length, order: J(w) === J(c),
               oracleOnly: w.filter((r) => !C.has(r)), lambdaOnly: c.filter((r) => !W.has(r)) })
        .toEqual({ witness: n, lambda: n, order: true, oracleOnly: [], lambdaOnly: [] });
    }, 300_000);
  }

  // THE POPULATIONS ui:ids READS. Every object type the witness carries, with
  // the same values in the same (ordinal) order: 41 types on both sides once
  // the witness is regenerated (it was 36 against carriers of 2026-09-15, which
  // predated metamodel/verbalization.md).
  //
  // WAS KNOWN RED UNTIL 2026-09-18, ON ONE DEFECT: read:lit_value asked the
  // TEXT and not the ROLE, so read:otpops_state camel-cased seven `Pattern
  // Example` VALUES into identifiers -- `Pattern Example` is a value type
  // (metamodel/verbalization.md:19) and `'Predicate is bound.'` came out
  // `PredicateIsBound`, the seven that disagreed being exactly the examples
  // that are themselves well-formed FORML2 sentences. `same` was 40 where it
  // should be 41, `grew` named Pattern Example, `contained` was false. The
  // expectation below always stated what a correct reader answers, and the
  // reader now answers it: read:pop_values zips the row's literals against the
  // matched fact type's players and a literal filling a value type's role is
  // kept verbatim, while `Transition 'advance-to-step2' is triggered by Event
  // Type 'Schema Design notes elementary facts'` still enters Event Type's
  // population as SchemaDesignNotesElementaryFacts, because Event Type is an
  // entity type.
  test("lambda's state:otpops carries the witness's populations", () => {
    const W = new Map(witness("state:otpops").map((r) => [String(r[0]), r[1].flat(1).map(String)]));
    const C = new Map(Ev("read:otpops_state", F).map((r) => [String(r[0]), r[1].flat(1).map(String)]));
    const missing = [...W.keys()].filter((k) => !C.has(k));
    const same = [...W].filter(([k, v]) => C.has(k) && J(v) === J(C.get(k))).length;
    const grew = [...W].filter(([k, v]) => C.has(k) && J(v) !== J(C.get(k)));
    expect({ witness: W.size, lambda: C.size, missing, same,
             grew: grew.map(([k]) => k),
             contained: grew.every(([k, v]) => v.every((x) => C.get(k).includes(x))),
             newTypes: [...C.keys()].filter((k) => !W.has(k)) })
    // 41 UNTIL 2026-09-22, when core.md's alternate reading of
    // Role is used in Reading gave Reading, Role and Text an instance
    // population they had not had: read:otpops_state files the subjects and
    // objects of INSTANCE FACTS, and those seven sentences name a Reading, two
    // Roles and a Text literally where before every one of them reached the
    // store only as a reflected link. The witness and lambda still answer the
    // same 44 keys with the same values, which is what missing, grew and
    // newTypes being empty says; only the count moved.
    // 44 -> 45 (2026-09-30), alike in both: the five judged rules declared as instances
    // (cb0c4e59) give Constraint and Modality Type a population, layout.md's deletion (3079d929)
    // takes Location Role, Relative Path and Source Location's, and the first bound decider
    // (a5dda86a) gives Module Path and Symbol Name theirs.
      .toEqual({ witness: 45, lambda: 45, missing: [], same: 45,
                 grew: [], contained: true, newTypes: [] });
  }, 300_000);

  // THE ORDER IS THE ROW, so the ordinal is only meaningful against the same
  // set of fact types: lambda's sequence restricted to the ones the witness has
  // is the witness's sequence. The six Verbalization Pattern fact types that
  // used to be lambda-only are in the regenerated witness (2026-09-17), so the
  // two sequences are now the same rows and lambdaOnly is empty. Agent left
  // core on 2026-09-18 (its declaration moved to readings/templates), so
  // AgentIsASubtypeOfObjectTypeInstance is no longer in the base metamodel's
  // declaration order and the count is 506 where it was 507. Ordinals after
  // it renumber, which is why `renumbered` is the field that proves nothing
  // else moved.
  test("lambda's state:factorder is the witness's sequence", () => {
    const w = witness("state:factorder").map((r) => String(r[0]));
    const c = Ev("read:order_state", F);
    const WN = new Set(w);
    const kept = c.filter((r) => WN.has(String(r[0])));
    expect({ lambda: c.length, witness: w.length, kept: kept.length,
             sequence: J(kept.map((r) => String(r[0]))) === J(w),
             renumbered: J(kept.map((r, i) => [String(r[0]), i + 1])) === J(witness("state:factorder").map((r) => [String(r[0]), r[1]])),
             lambdaOnly: c.filter((r) => !WN.has(String(r[0]))).map((r) => String(r[0])) })
      // 506 -> 541 (2026-09-21): a fully-derived head is stored, so the 16
      // binary `*` heads with a spanning uniqueness are objectified as any
      // asserted many-to-many is, and their 35 involvement fact types (two per
      // binary, three for Status reaches Status in State Machine Definition,
      // four for Status has effective Transition to Status on Event Type) take
      // a place in the sequence; the heads themselves were in it already.
      // 541 -> 509 (2026-09-23): the 32 objectifications that are no noun lose
      // `X is a subtype of Function`, one subtype fact each, and the sequence and
      // its renumbering still agree with the carrier's.
      // 509 -> 513 (2026-09-25): Body Template and `Function fills JSON Path with Body
      // Template` enter core.md, the sequence moves by four in both readers, and it and its
      // renumbering still agree with the carrier's.
      // 513 -> 523 (2026-09-25): Query Parameter, Parameter Value and the five fact types a
      // Connector pages with enter federation.md, and the sequence moves alike in both readers.
      // 523 -> 527 (2026-09-25): Condition Value and the row condition, alike in both.
      // 527 -> 528 (2026-09-25): Query Text and `Function sends Query Text`, alike in both.
      // 528 -> 532 (2026-09-28, #130): `Transition exits Status in State Machine Definition`
      // and the three involvement fact types its spanning uniqueness objectifies, alike in both.
      // 532 -> 535 (2026-09-28, #131): `Function asserts Fact Type on success` and the two
      // involvement fact types its spanning uniqueness objectifies, alike in both.
      // 535 -> 536 (2026-09-28): `External System has Credential Encoding`, alike in both.
      // 536 -> 542 (2026-09-28): `is properly of` and `is most specifically of`, and the four
      // involvement fact types their spanning uniquenesses objectify, alike in both.
      // 542 -> 540 (2026-09-30, 0277020a): `Function reads rows at JSON Path` takes its uniqueness
      // over Function, so its two involvement fact types go. 540 -> 537 (2026-09-30, 3079d929):
      // layout.md's Source Location subtype fact and its two fact types go. 537 -> 540 (2026-10-01,
      // 79def8ec): `External System resolves to Resolved Address` and its two involvement fact
      // types. 540 -> 537 (2026-10-01, 186c1497): Function has Description replaces four. Alike in both.
      .toEqual({ lambda: 537, witness: 537, kept: 537, sequence: true, renumbered: true, lambdaOnly: [] });
  }, 300_000);

  // and the assembler carries them: the schema lambda writes holds every
  // cell it used to hold and these beside them
  test("read:schema names the new cells", () => {
    const names = Ev("read:schema_of", rows).map((c) => String(c[0]));
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
describe("lambda's reader reads an alias and a leg's own value", () => {
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

// ---- THE SET COMPARISONS, THE LAST CELL THE STORE CONSUMED AND THE READER DID
// NOT WRITE ------------------------------------------------------------------
//
// state:setcmp is what cmd:sc_rows fetches, so cmd:sub_viols, the commit gate's
// subset arm and law:subset_clean all bottom on it: a reader that does not write
// it answers PHI, setminus of PHI is PHI, and a constraint that FIRES reads
// exactly like one that holds. The nine rows below are the witness's own
// (tools/norma-oracle/design-state), pinned as a set in both directions AND in
// the oracle's order -- which is its rendered rows sorted ordinally, a key
// read:setcmp_key reproduces field for field -- with the recipes compared as
// trees, because a leg with the WRONG path is the silent wrong answer a missing
// one is not.
//
// The ten sentences that state an implication and yield no constraint are named
// here too, each with why, because a decline is a claim: `Derivation Rule2` is a
// subscript and not an object type, so the leg has no root to lay, and the
// oracle's BuildPathForSequence refuses it in the same place.
describe("lambda's state:setcmp against the witness, on the base metamodel", () => {
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const files = readdirSync(META).filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b));
  const rows = [];
  for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
  const F = Ev("read:x_full", Ev("read:x_of", rows));
  const J = (x) => JSON.stringify(x);

  test("lambda's state:setcmp is the witness's, row for row and recipe for recipe", () => {
    const w = Ev("ast:fetch", ["state:setcmp", CELLS]).flat(1).map(J);
    const c = Ev("read:setcmp_state", F).map(J);
    const W = new Set(w), C = new Set(c);
    expect({ witness: w.length, lambda: c.length, order: J(w) === J(c),
             oracleOnly: w.filter((r) => !C.has(r)), lambdaOnly: c.filter((r) => !W.has(r)) })
      .toEqual({ witness: 9, lambda: 9, order: true, oracleOnly: [], lambdaOnly: [] });
  }, 300_000);

  // the value condition the step triples could never say: the superset leg is
  // `sel` around the fact type, and dropped it would read every World Assumption
  test("the valued leg is a sel and the joined legs are one joinon each", () => {
    const c = Ev("read:setcmp_state", F);
    expect(J(c[0])).toBe(J(["subset", "alethic", [["ObjectTypeIsBackedByExternalSystem", 1]],
                            [["ObjectTypeHasWorldAssumption", 1]],
                            [["proj", "ObjectTypeIsBackedByExternalSystem", [1]],
                             ["proj", ["sel", "ObjectTypeHasWorldAssumption", 2, "open"], [1]]]]));
    // `Event caused Transition in State Machine` is no longer objectified as
    // `Event Caused Transition` (2026-09-23), so the fact type is its reading's name
    expect(J(c[1][4])).toBe(J([["proj", "EventCausedTransitionInStateMachine", [1, 2]],
                               ["joinon", "EventIsOfEventType", "TransitionIsTriggeredByEventType", [[2, 2]], [1, 3]]]));
    expect(c.filter((r) => String(r[4][0][0]) === "joinon" || String(r[4][1][0]) === "joinon").length).toBe(6);
  }, 300_000);

  // every member names the BINARIZED fact type -- an objectified side's role
  // belongs to its implied XIsInvolvedInY link -- while every recipe names the
  // fact types themselves, which is what derive:eval can read rows from
  test("members are binarized and recipes are not", () => {
    const c = Ev("read:setcmp_state", F);
    const members = c.flatMap((r) => [...r[2], ...r[3]]).map((m) => String(m[0]));
    // AND FIVE MORE SINCE A FULLY-DERIVED HEAD IS STORED (2026-09-21). Three of
    // the nine subset constraints have a `*` head as their superset -- `Failure
    // succeeds Violation` once, `Status is defined in State Machine Definition`
    // twice (initial is a subset of defined; a machine's definition is one the
    // status is defined in) -- and a stored many-to-many head is objectified
    // like any other, so those superset members are spelled over its
    // involvement links: 8 -> 13. Every recipe still names the fact types.
    expect(members.filter((n) => n.includes("IsInvolvedIn")).sort()).toEqual([
      "EventIsInvolvedInEventCausedTransitionInStateMachine", "FactIsInvolvedInGuardRunReferencesFact",
      "FactIsInvolvedInRoleInstance", "FailureIsInvolvedInFailureSucceedsViolation",
      "GuardIsInvolvedInGuardReferencesFactType", "PredicateIsInvolvedInFactIsReferencedByPredicate",
      "RoleIsInvolvedInRoleInstance", "RoleIsInvolvedInRoleIsUsedInReading",
      "StateMachineDefinitionIsInvolvedInStatusIsDefinedInStateMachineDefinition",
      "StatusIsInvolvedInStatusIsDefinedInStateMachineDefinition", "StatusIsInvolvedInStatusIsDefinedInStateMachineDefinition",
      "TransitionIsInvolvedInEventCausedTransitionInStateMachine", "ViolationIsInvolvedInFailureSucceedsViolation"]);
    expect(J(c.flatMap((r) => r[4]).map(J).filter((s) => s.includes("IsInvolvedIn")))).toBe(J([]));
  }, 300_000);

  // A DECLINE IS A CLAIM, so it is named. Ten sentences of the base state an
  // implication and build no constraint: the oracle builds none either, and the
  // reasons are the oracle's own -- a predicate that matches no declared reading,
  // more clauses than a two-clause chain, or a join player that is a subscript
  // rather than an object type (BuildPathForSequence's myTypes lookup).
  test("the implications that lay no leg are these ten", () => {
    const said = rows.filter((r) => Ev("read:setcmp_is", r) === "T");
    const idx = Ev("read:rule_index", F[0][3]);
    const declined = said.filter((r) => Ev("read:setcmp_row", [r, [idx, F]]).length === 0)
      .map((r) => Ev("read:setcmp_words", r).map(String).join(" "));
    expect({ said: said.length, laid: said.length - declined.length, declined: declined.length })
      .toEqual({ said: 19, laid: 9, declined: 10 });
    expect(declined.map((s) => s.slice(0, 52))).toEqual([
      "If some Object Type is not backed by some External S",
      "If some Fact Type defines some Fact then some Object",
      "If some API accepts some Object Type as parameter an",
      "If Object Type1 is subtype of Object Type2 , then Ob",
      "If Derivation Rule1 reaches Derivation Rule2 and Der",
      "If Function1 is superseded by Function2 , then Funct",
      "If JS Package1 reaches JS Package2 and JS Package2 r",
      "If some Violation occurs before some Transition then",
      "It is obligatory that if some Predicate1 is performe",
      "It is obligatory that if some Status1 reaches Status",
    ]);
  }, 300_000);

  // and the assembler carries it, at the end, where the oracle's carrier has it
  test("read:schema names state:setcmp", () => {
    const names = Ev("read:schema_of", rows).map((c) => String(c[0]));
    expect(names.includes("state:setcmp")).toBe(true);
    expect(names[names.length - 1]).toBe("state:setcmp");
  }, 600_000);
});

// ---- THE NAMED SHAPES THE GENERAL CHAIN COULD NOT SAY ----------------------
//
// Each fixture is one app sentence with just the vocabulary it names, and each
// expectation is the recipe the oracle's own carrier holds for that head
// (apps/auto.dev/.check/design-state and apps/support.auto.dev/.check, state:rules),
// copied tree for tree rather than restated. A fixture is a corpus, not a unit:
// what is being tested is that the whole reader answers the sentence, so a shape
// that moves to another arm keeps its test.
describe("lambda's reader carries the chain's named shapes", () => {
  const J = (x) => JSON.stringify(x);
  const rulesOf = (text) => {
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    return Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows)));
  };

  // A ROLE NAME QUALIFIES THE VARIABLE. `override- Fetcher` and `default- Fetcher`
  // are two Fetchers, and the tokens have to say so: matching on the player alone
  // made the anti-join carry a second key [[2,1],[6,2]] where the oracle carries
  // [[2,1]], subtracting the rows whose default Fetcher happened to equal the
  // override one rather than the rows that have an override at all.
  // (apps/auto.dev/source-routing.md:155)
  const ROUTING = [
    "Source Request(.id) is an entity type.",
    "Resource Declaration(.Name) is an entity type.",
    "Source Declaration(.Name) is an entity type.",
    "Fetcher(.Name) is an entity type.",
    "Source Service(.Name) is an entity type.", "",
    "Source Request is for Resource Declaration.",
    "Source Request is for Source Declaration.",
    "Resource Declaration has override- Fetcher.",
    "Source Declaration has default- Fetcher.",
    "Source Declaration is captcha-gated.",
    "Source Request is to Source Service. +",
    "Source Request is routed via Fetcher. +", "", "",
  ].join("\n");

  test("a leg's role name is part of its token, so two Fetchers do not join", () => {
    const text = ROUTING + "+ Source Request is routed via Fetcher if Source Request is for some Resource Declaration and that Resource Declaration has no override- Fetcher and Source Request is for some Source Declaration and that Source Declaration has default- Fetcher.\n";
    const legs = ["SourceRequestIsForResourceDeclaration", "SourceRequestIsForSourceDeclaration"];
    const both = ["joinon", ["joinon", legs[0], legs[1], [[1, 1]], [1, 2, 3, 4]], "SourceDeclarationHasDefaultFetcher", [[4, 1]], [1, 2, 3, 4, 5, 6]];
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["SourceRequestIsRoutedViaFetcher", ["Source Request", "Fetcher"],
         ["proj", ["minus", both, ["joinon", both, "ResourceDeclarationHasOverrideFetcher", [[2, 1]], [1, 2, 3, 4, 5, 6]]], [1, 6]]]),
    ]);
  }, 300_000);

  // the pieces: the prefix is the role name written before the player, the token
  // carries it, and a head token finds its column qualified before bare
  test("the role-qualified token and the three passes that place it", () => {
    const w = (s) => Ev("lex:qparts", s);
    expect(Ev("read:rule_gchain_rq", [w("Noun is backed by primary- External System"), ["Noun", "External System"]]))
      .toEqual(["Noun", "primary- External System"]);
    expect(Ev("read:rule_gchain_rq", [w("Noun is backed by External System"), ["Noun", "External System"]]))
      .toEqual(["Noun", "External System"]);
    // a hyphen inside a name is not a role name: the segment before it is capitalised
    expect(Ev("read:rule_gchain_rq", [w("Log Entry concerns EEA-Customer"), ["Log Entry", "Customer"]]))
      .toEqual(["Log Entry", "Customer"]);
    // and a role name may itself be hyphenated
    expect(Ev("read:rule_gchain_rq", [w("Vehicle Purchase Quote has taxable-base- Amount"), ["Vehicle Purchase Quote", "Amount"]]))
      .toEqual(["Vehicle Purchase Quote", "taxable-base- Amount"]);
    expect(Ev("read:rule_gchain_bare", "taxable-base- Amount")).toBe("Amount");
    expect(Ev("read:rule_gchain_bare", "External System")).toBe("External System");
    // qualified first, then bare, then the leg whose role name the head omits
    expect(Ev("read:rule_gchain_col", ["alternate- External System", ["Noun", "primary- External System", "alternate- External System"]])).toBe(3);
    expect(Ev("read:rule_gchain_col", ["Fetcher", ["Source Request", "Source Declaration", "default- Fetcher"]])).toBe(3);
    expect(Ev("read:rule_gchain_col", ["Reading", ["Noun", "External System"]])).toBe(0);
  });

  // THE SAME RULE, READ THE OTHER WAY: here the HEAD names the role and the body
  // binds two External Systems, so the head's own token has to be the qualified
  // one -- matching on the player alone took the first leg, which is the DEGRADED
  // primary, the exact opposite of what the reading says.
  // (apps/auto.dev/service-health.md:180)
  test("a head that names the role takes the leg that names it", () => {
    const text = [
      "Noun(.id) is an entity type.",
      "External System(.Name) is an entity type.",
      "Service Health Status is a value type.", "",
      "Noun is backed by External System.",
      "External System has Service Health Status.",
      "Noun is resolved from alternate- External System. +", "",
      "+ Noun is resolved from alternate- External System if Noun is backed by primary- External System and that primary- External System has Service Health Status 'degraded' and Noun is backed by that alternate- External System.\n",
    ].join("\n");
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["NounIsResolvedFromAlternateExternalSystem", ["Noun", "External System"],
         ["proj", ["sel", ["joinon", ["joinon", "NounIsBackedByExternalSystem", "ExternalSystemHasServiceHealthStatus", [[2, 1]], [1, 2, 3, 4]],
                           "NounIsBackedByExternalSystem", [[1, 1]], [1, 2, 3, 4, 5, 6]], 4, "degraded"], [1, 6]]]),
    ]);
  }, 300_000);

  // A CLAUSE KEEPS ITS ARTICLES WHERE THE READING DROPS THEM. `that Customer
  // exceeds the Concurrency Ceiling of some API` is the declared `Customer exceeds
  // Concurrency Ceiling of API`, and ResolveClause drops `a`, `an` and `the` from
  // both sides before comparing; lambda keyed on the words as written and the
  // clause named no fact type, so the whole rule declined.
  // (apps/auto.dev/api-use-cases.md:108)
  test("a clause resolves with its articles dropped", () => {
    const text = [
      "Integration(.id) is an entity type.",
      "Customer(.Name) is an entity type.",
      "Use Case(.Name) is an entity type.",
      "API(.Name) is an entity type.",
      "Concurrency Ceiling is a value type.", "",
      "Integration is for Customer.",
      "Integration is for Use Case.",
      "Use Case requires API.",
      "Customer exceeds Concurrency Ceiling of API. *",
      "Integration is capacity bound. *", "",
      "* Integration is capacity bound iff Integration is for some Customer and Integration is for some Use Case and that Customer exceeds the Concurrency Ceiling of some API and that Use Case requires that API.\n",
    ].join("\n");
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["IntegrationIsCapacityBound", ["Integration"],
         ["proj", ["joinon", ["joinon", ["joinon", "IntegrationIsForCustomer", "IntegrationIsForUseCase", [[1, 1]], [1, 2, 3, 4]],
                              "CustomerExceedsConcurrencyCeilingOfAPI", [[2, 1]], [1, 2, 3, 4, 5, 6, 7]],
                   "UseCaseRequiresAPI", [[4, 1], [7, 2]], [1, 2, 3, 4, 5, 6, 7, 8, 9]], [1]]]),
    ]);
  }, 300_000);

  // the four keys read:rule_find tries, in order, against one index
  test("the entry a clause names, keyed four ways", () => {
    const IX = [
      ["Noun Is Backed By External System", "NounIsBackedByExternalSystem", ["Noun", "External System"]],
      ["Customer Exceeds Concurrency Ceiling Of API", "CustomerExceedsConcurrencyCeilingOfAPI", ["Customer", "API"]],
      ["Resource Declaration Has Override Fetcher", "ResourceDeclarationHasOverrideFetcher", ["Resource Declaration", "Fetcher"]],
      ["Log Entry Concerns EEA Customer", "LogEntryConcernsEEACustomer", ["Log Entry", "EEA Customer"]],
    ];
    const find = (s) => Ev("read:rule_find", [IX, Ev("read:rule_dequant", Ev("lex:qparts", s))]);
    expect(find("Noun is backed by External System")).toEqual(IX[0].slice(1));
    expect(find("Noun is backed by that alternate- External System")).toEqual(IX[0].slice(1));
    expect(find("that Customer exceeds the Concurrency Ceiling of some API")).toEqual(IX[1].slice(1));
    // a role name a READING declares still resolves as itself: the literal key wins
    expect(find("that Resource Declaration has override- Fetcher")).toEqual(IX[2].slice(1));
    // and a hyphen inside a name is not a role name
    expect(find("Log Entry concerns EEA-Customer")).toEqual(IX[3].slice(1));
    expect(find("Noun is backed by Reading")).toEqual([]);
  });

  // A HEAD ROLE MAY BE A CONSTANT AFTER A CHAIN. `Source Request is to Source
  // Service 'svc.do' if ...` binds one head role from the body and names the other
  // outright, so the bound role projects, the literal is paired on, and a final
  // proj puts the two back in the head's order. The chain arm declined any head
  // carrying a literal outright. (apps/auto.dev/source-routing.md:161)
  test("a head role a literal restricts is paired on after the chain", () => {
    const text = ROUTING + "+ Source Request is to Source Service 'svc.do' if Source Request is for Source Declaration that is captcha-gated.\n";
    expect(rulesOf(text).map((r) => J(r))).toEqual([
      J(["SourceRequestIsToSourceService", ["Source Request", "Source Service"],
         ["proj", ["pairwith", ["proj", ["joinon", "SourceRequestIsForSourceDeclaration", "SourceDeclarationIsCaptchaGated", [[2, 1]], [1, 2, 3]], [1]],
                   "svc.do"], [1, 2]]]),
    ]);
  }, 300_000);

  // the pieces: with no literal the projection is what it always was, and the
  // arm declines rather than guess when the counts do not meet
  test("the constant head's projection, and what it declines", () => {
    expect(J(Ev("read:rule_gchain_proj", ["ACC", [1, 3], []]))).toBe(J(["proj", "ACC", [1, 3]]));
    expect(Ev("read:rule_gchain_proj", ["ACC", [1, 0], []])).toEqual([]);
    expect(J(Ev("read:rule_gchain_proj", ["ACC", [4, 0], ["svc.do"]])))
      .toBe(J(["proj", ["pairwith", ["proj", "ACC", [4]], "svc.do"], [1, 2]]));
    // the literal lands on the role it follows, whichever role that is
    expect(J(Ev("read:rule_gchain_proj", ["ACC", [0, 2], ["closed"]])))
      .toBe(J(["proj", ["pairwith", ["proj", "ACC", [2]], "closed"], [2, 1]]));
    // two literals over two unbound roles, in the head's order
    expect(J(Ev("read:rule_gchain_proj", ["ACC", [0, 5, 0], ["a", "b"]])))
      .toBe(J(["proj", ["pairwith", ["pairwith", ["proj", "ACC", [5]], "a"], "b"], [2, 1, 3]]));
    // and never a head that is all constants, nor counts that do not meet
    expect(Ev("read:rule_gchain_proj", ["ACC", [0, 0], ["one"]])).toEqual([]);
    expect(Ev("read:rule_gchain_proj", ["ACC", [1, 0], ["one", "two"]])).toEqual([]);
  });

// THE READER'S FIDELITY ON THE SERVED APPS (#109). Three defects measured
// against the witness carriers (apps/*/.check/design-state, written by
// tools/norma-oracle) on 2026-09-17, each pinned here on the smallest fixture
// that shows it. Every case below fails on the parent commit.
describe("lambda's reader reads a numeral, a scheme's order and a marker", () => {
  const J = (x) => JSON.stringify(x);
  const stateOf = (cell, text) =>
    Ev(cell, Ev("read:x_full", Ev("read:x_of", Ev("read:sentences", text).map((s) => Ev("read:row_of", s)))));

  // apps/auto.dev/cost-attribution.md and listings.md, against
  // apps/support.auto.dev/.check/design-state: the witness's state:otpops
  // carries Amount, Max Mileage, Year and twenty more, lambda carried none of
  // them -- a numeral was not a value, so the sentence was rejected and its
  // digits were tiled into the fact type's name (InvoiceHasAmount642.95).
  const NUMS = [
    "Invoice(.Id) is an entity type.",
    "Listing Policy(.Name) is an entity type.",
    "Amount is a value type.",
    "  The data type of Amount is decimal.",
    "Max Mileage is a value type.",
    "  The data type of Max Mileage is integer.",
    "Invoice has Amount.",
    "  Each Invoice has at most one Amount.",
    "Listing Policy has Max Mileage.",
    "  Each Listing Policy has at most one Max Mileage.",
    "Invoice 'Fly.io/2026-02' has Amount 642.95.",
    "Listing Policy 'default' has Max Mileage 125000.", "",
  ].join("\n");

  test("a quoted word and a numeral are both values of the sentence's own reading", () => {
    const row = Ev("read:row_of", "Invoice 'Fly.io/2026-02' has Amount 642.95.");
    // the decimal is three tokens and one value
    expect(Ev("read:glue_nums", row[1]).map((p) => p[0]))
      .toEqual(["Invoice", "'Fly.io/2026-02'", "has", "Amount", "642.95"]);
    expect(Ev("read:is_numword", "642.95")).toBe("T");
    expect(Ev("read:is_numword", "125000")).toBe("T");
    expect(Ev("read:is_numword", ".")).toBe("F");
    expect(Ev("read:is_numword", "2026-02")).toBe("F");
    expect(Ev("read:pop_values", [[], [], row, ["Invoice", "Amount"], ["Amount"]])).toEqual(["Fly.io/2026-02", "642.95"]);
    expect(Ev("read:nonlit_pairs", [[], [], row]).map((p) => p[0])).toEqual(["Invoice", "has", "Amount"]);
  }, 300_000);

  // AND THE ROLE'S PLAYER DECIDES WHETHER A LITERAL IS A NAME. read:pop_values
  // takes the matched fact type's players as its fourth operand and the value
  // types' names as its fifth, and zips the players against the row's literals,
  // so read:lit_value is asked of the ROLE and not of the text: the same literal
  // resolves to the declared name where an entity type plays the role and is
  // kept verbatim where a value type does. The names come from the ROWS, by the
  // read:type_row_of that read:object_types already asks -- NOT from a tag on
  // the declared entry, whose three slots are read:parse's own answer and are
  // pinned by six case:read-*. Where the players and the literals do not line
  // up, and for a sentence that matched no reading, no player is known and the
  // resolution stands as before.
  test("a literal filling a value type's role is text, not a declared name", () => {
    const decls = ["Invoice(.Id) is an entity type.", "Note Text is a value type."]
      .map((s) => Ev("read:row_of", s));
    const vals = Ev("read:value_names", decls);
    expect(vals).toEqual(["Note Text"]);
    const row = Ev("read:row_of", "Invoice 'i1' has Note Text 'Invoice has Amount'.");
    const recs = [["InvoiceHasAmount"]];  // one record, and that is its name
    expect(Ev("read:pop_values", [[], recs, row, ["Invoice", "Note Text"], []]))
      .toEqual(["i1", "InvoiceHasAmount"]);
    expect(Ev("read:pop_values", [[], recs, row, ["Invoice", "Note Text"], vals]))
      .toEqual(["i1", "Invoice has Amount"]);
    expect(Ev("read:pop_values", [[], recs, row, [], vals]))
      .toEqual(["i1", "InvoiceHasAmount"]);
  }, 300_000);

  test("a numeral lands in the fact type's population and its value type's extent", () => {
    const fts = stateOf("read:state_fts", NUMS);
    const pop = (n) => fts.filter((r) => r[0] === n).flatMap((r) => r[4].flat());
    expect(J(pop("InvoiceHasAmount"))).toBe(J([["Fly.io/2026-02", "642.95"]]));
    expect(J(pop("ListingPolicyHasMaxMileage"))).toBe(J([["default", "125000"]]));
    // and no fact type is named for the digits it was populated with
    expect(fts.map((r) => r[0]).filter((n) => n.indexOf("642") >= 0)).toEqual([]);
    const otpops = Object.fromEntries(stateOf("read:otpops_state", NUMS).map((r) => [r[0], r[1].flat()]));
    expect(otpops["Amount"]).toEqual(["642.95"]);
    expect(otpops["Max Mileage"]).toEqual(["125000"]);
  }, 300_000);

  // apps/support.auto.dev/.check/design-state, state:factorder: the oracle's
  // order is the declaration order and its scheme facts come first, so its
  // first row is the first entity's. read:scheme_rows read its entities
  // through read:entity_names, which sorts, so lambda's began at the
  // alphabetically first one and diverged at position 0.
  const SCHEMES = [
    "Zebra(.id) is an entity type.",
    "Apple(.id) is an entity type.",
    "Stripe(.id) is an entity type.", "",
    "Zebra has Apple.",
    "  Each Zebra has at most one Apple.", "",
  ].join("\n");

  test("reference schemes are ordered by declaration, not by name", () => {
    expect(stateOf("read:scheme_rows", SCHEMES).map((r) => r[0]))
      .toEqual(["ZebraHasZebraId", "AppleHasAppleId", "StripeHasStripeId"]);
    expect(stateOf("read:order_state", SCHEMES).map((r) => r[0]).slice(0, 4))
      .toEqual(["ZebraHasZebraId", "AppleHasAppleId", "StripeHasStripeId", "ZebraHasApple"]);
    // the sorted surfaces stay sorted: state:refmodes is the witness's own order
    expect(stateOf("read:state_refmodes", SCHEMES).map((r) => r[0])).toEqual(["Apple", "Stripe", "Zebra"]);
  }, 300_000);

  // apps/auto.dev/cost-mitigation.md and source-routing.md, against
  // apps/auto.dev/.check/design-state, state:derived: a markdown bullet and a
  // **bold** phrase carry NORMA's derivation-marker characters, and every one
  // of them was read as a marked derived head -- 109 heads to the witness's
  // 103-105, and each phantom head is an undelivered one too.
  const MARKS = [
    "Loader(.Name) is an entity type.",
    "Resumability is a value type.",
    "Arity is a value type.", "",
    "Loader has Resumability.",
    "  Each Loader has at most one Resumability.",
    "Loader has Arity. *",
    "  Each Loader has exactly one Arity.", "",
    "**Loader placement convention** (encoded as derivations below):",
    "**Why this is its own reading**: the invoice arrives after the spend is irreversible.",
    "* It is forbidden to conclude a Loader is restart-safe from the filterFn alone.",
    "* A Loader with Resumability 'idempotent-selection' recovers work on restart.", "",
  ].join("\n");

  test("a marked reading is a derived head and a marked prose bullet is not", () => {
    expect(stateOf("read:state_derived", MARKS)).toEqual([["LoaderHasArity", "full"]]);
    // bold is not a marker: the star left after the first one says so
    const starred = (s) => Ev("read:star_left", [[], [], Ev("read:row_of", s)]);
    expect(starred("**Loader placement convention** (encoded as derivations below):")).toBe("T");
    expect(starred("* Each Loader has exactly one Arity.")).toBe("F");
    // and a marked sentence some later arm answers is read without its marker
    const headed = (s) => Ev("read:marked_head", [[], [], [0, Ev("read:demark_pairs", Ev("read:row_of", s)[1])]]);
    expect(headed("* Each Loader has exactly one Arity.")).toBe("T");
    expect(headed("* It is forbidden to conclude a Loader is restart-safe from the filterFn alone.")).toBe("F");
    expect(headed("* A Loader with Resumability 'idempotent-selection' recovers work on restart.")).toBe("F");
    // and no prose sentence is tiled whole into a fact type's name
    const names = stateOf("read:state_fts", MARKS).map((r) => r[0]);
    expect(names.filter((n) => n.indexOf("*") >= 0 || n.indexOf("ItIsForbidden") === 0)).toEqual([]);
  }, 300_000);

  // AND THE SORTED LIST IS BISECTED, NOT WALKED. system:ins_asc inserts into a
  // sorted list, so its position is the lower bound; the fold that builds the
  // sort inserts from the right, so an equal key must land BEFORE the ones
  // already there or the sort stops being stable.
  test("system:sort_asc is stable and system:ins_lo is the lower bound", () => {
    expect(Ev("system:ins_lo", [["c"], [["a"], ["b"], ["d"]]])).toBe(2);
    expect(Ev("system:ins_lo", [["b"], [["a"], ["b"], ["b"], ["d"]]])).toBe(1);
    expect(Ev("system:ins_lo", [["a"], []])).toBe(0);
    expect(Ev("system:ins_asc", [["b", 9], [["a", 1], ["b", 2], ["c", 3]]]))
      .toEqual([["a", 1], ["b", 9], ["b", 2], ["c", 3]]);
    expect(Ev("system:sort_asc", [["c", 1], ["a", 2], ["b", 3], ["a", 4]]))
      .toEqual([["a", 2], ["a", 4], ["b", 3], ["c", 1]]);
  }, 300_000);
});
});

// ================================================================================
// THE REFERENCE-MODE KIND, against apps/support.auto.dev/.check/design-state and
// apps/auto.dev/.check/design-state (state:refmodes, state:schemereadings). ORM
// reference modes have KINDS -- popular, unit-based, general -- and lambda wrote
// K("popular") into every row and derived every value type as `{Entity}_{mode}`,
// while stripping the spaces out of a multi-word mode on the way in. Measured
// 2026-09-18: 108 of support's 298 rows and 86 of auto.dev's 272 are general in
// the witness, and every one of them disagreed on kind, on mode name, or on both.
//
// The witness decides it in Verifier.cs (state:refmodes) off
// IReferenceModePattern.ReferenceModeType, which ObjectType.GetReferenceMode
// resolves from the preferred identifier's VALUE TYPE NAME: a mode named by one
// of NORMA's intrinsic popular modes (Id id ID UUID Uuid Name name Code code
// Title title Nr nr #, ReferenceMode.cs:336-349) that is NOT already a declared
// type mints `{Entity}_{mode}` and is popular; anything else keeps the mode name
// as the value type and is general. `Name` and `Title` are declared in core.md
// and `Code` in auto.dev/api-errors.md, which is why `Make(.Name)` is general in
// every corpus while `Item(.Code)` is popular in `order` and general in auto.dev.
// Measured across 34 witness corpora, 6183 rows, zero exceptions.
describe("lambda's reader reads a reference mode's kind and its name", () => {
  const stateOf = (cell, text) =>
    Ev(cell, Ev("read:x_full", Ev("read:x_of", Ev("read:sentences", text).map((s) => Ev("read:row_of", s)))));

  const KINDS = [
    "Name is a value type.",
    "Path Pattern is a value type.", "",
    "Agent(.id) is an entity type.",
    "API Endpoint(.Path Pattern) is an entity type.",
    "Account(.Account Id) is an entity type.",
    "Make(.Name) is an entity type.",
    "Item(.Code) is an entity type.", "",
  ].join("\n");

  test("a multi-word reference mode keeps its spaces", () => {
    // read:type_row_of used to rejoin the parenthesised tokens with no separator
    expect(stateOf("read:all_types", KINDS).filter((r) => r[1] === "entity").map((r) => [r[0], r[2]]))
      .toEqual([["Agent", ".id"], ["API Endpoint", ".Path Pattern"], ["Account", ".Account Id"],
                ["Make", ".Name"], ["Item", ".Code"]]);
    expect(Ev("read:mode_name", ".Account Id")).toBe("Account Id");
  }, 300_000);

  test("the kind is popular only for an intrinsic mode that is not a declared type", () => {
    // sorted by entity name: state:refmodes is a sorted surface
    expect(stateOf("read:state_refmodes", KINDS)).toEqual([
      ["API Endpoint", "Path Pattern", "general", "Path Pattern"],
      ["Account", "Account Id", "general", "Account Id"],
      ["Agent", "id", "popular", "Agent_id"],
      ["Item", "Code", "popular", "Item_Code"],
      ["Make", "Name", "general", "Name"],
    ]);
  }, 300_000);

  test("a general scheme fact is named for its value type, not for {Entity}_{mode}", () => {
    const R = [["{0}", "has", "{1}"]];
    expect(stateOf("read:state_schemereadings", KINDS)).toEqual([
      ["AgentHasAgentId", ["Agent", "Agent_id"], R],
      ["APIEndpointHasPathPattern", ["API Endpoint", "Path Pattern"], R],
      ["AccountHasAccountId", ["Account", "Account Id"], R],
      ["MakeHasName", ["Make", "Name"], R],
      ["ItemHasItemCode", ["Item", "Item_Code"], R],
    ]);
  }, 300_000);
});

// ================================================================================
describe("lambda's reader reads a value type's kind and the rows that need it", () => {
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
    ["Block Kind","text"], ["Violation Template","text"], ["Body Template","text"],
    // metamodel/security.md:41-42 (79def8ec, 2026-10-01): `Resolved Address is a value type.
    // The data type of Resolved Address is text.` The reader reads it so; this list is the
    // deleted oracle's carrier, kept by hand, and had not been told.
    ["Resolved Address","text"],
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
  // written in that kind in one place -- a numeral on an integer role is an integer, on a
  // number role the decimal it spells, and everything else is the atom the reading wrote
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
    // a number is held as a decimal, whole or not, as a population of a number role holds it (2026-09-29);
    // the fraction that had no cell here is the decimal it spells
    expect(Ev("read:kind_cell", ["number", "100"])).toEqual([["decimal", 100, 0]]);
    expect(Ev("read:kind_cell", ["number", "6.875"])).toEqual([["decimal", 6875, 3]]);
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
  // A RULE THAT COMPILES TO NO RECIPE IS A FINDING (2026-09-29). A sum over a value the
  // reading left as text is one the aggregate arm declines; the check said nothing and the
  // head derived nothing, which is how pm's measured-category rules and six auto.dev heads
  // were lost. read:undelivered_rows names the head with lambda's reason, and a head marked
  // derived with no rule sentence at all is the marker-closure law's debt, not a finding here.
  test("a rule no arm compiles is a finding, with lambda's reason", () => {
    const text = [
      "# a sum over a value the reading left as text", "",
      "Organization(.name) is an entity type.",
      "Revenue Stream(.name) is an entity type.",
      "Frequency is a value type.",
      "Amount is a value type.", "",
      "Organization generates Revenue Stream.",
      "Revenue Stream has Amount per Frequency.",
      "Organization has revenue- Amount per Frequency. +",
      "Organization has budget- Amount per Frequency. +", "",
      "+ Organization has revenue- Amount per Frequency if revenue- Amount is the sum of Amount where Organization generates some Revenue Stream and that Revenue Stream has some Amount per that Frequency.", "", "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const F = Ev("read:x_full", Ev("read:x_of", rows));
    expect(Ev("read:state_rules", F)).toEqual([]);
    expect(Ev("read:undelivered_rows", F).map(J)).toEqual([J(["undelivered", "OrganizationHasRevenueAmountPerFrequency", "reported", [], "a `where` clause no form says"])]);
    // and through compile:findings_of_x, the path compile:check hands the host: its cat is binary, so a
    // third sequence handed it was dropped without a word, and the first version of this finding was
    expect(Ev("compile:findings_of_x", [F, []]).filter((r) => String(r[0]) === "undelivered").map(J)).toEqual([J(["undelivered", "OrganizationHasRevenueAmountPerFrequency", "reported", [], "a `where` clause no form says"])]);
    // the same arity bug closed no back button: html:backbtn handed cat three sequences and lost its </a>.
    // The back link is the view's since 2026-10-01 (an IListView's BackLink), and a linked IGridCell is the
    // control whose markup now closes an <a> around its children
    const cell = ["gridcell", 0, 0, 120, 24, [["NavigationLink", ["cases"]], ["Children", [["label", 0, 0, 120, 24, [["Text", "cases"]]]]]]];
    expect(String(Ev("html:gridcell", cell)).endsWith("</div></a>")).toBe(true);
  }, 300_000);
  // AN INTEGER IS HELD AS AN INTEGER (2026-09-29, Sam: a value always in its exact type, never converted where it
  // is used). The reader wrote `Widget 'w1' has Count 12` as the text 12 and a store boot handed rmap:unproj the
  // text every cell held, while the counts lambda computes were numbers: on the base module FactTypeHasArity held
  // integers and ConstraintSpanHasPosition text. A value is typed where it enters, by the kind its role's value
  // type declares -- the reader, what the tables answer, what a writer hands main:cf_store, an assert -- and a
  // table cell still holds the text it prints as.
  test("an integer is held as an integer: read, loaded, written and asserted", () => {
    const text = [
      "Widget(.name) is an entity type.",
      "Count is a value type.",
      "  The data type of Count is integer.",
      "Label is a value type.", "",
      "Widget has Count.",
      "  Each Widget has at most one Count.",
      "Widget has Label.",
      "  Each Widget has at most one Label.", "",
      "Widget 'w1' has Count 12.",
      "Widget 'w2' has Count 7.",
      "Widget 'w1' has Label '12'.", "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const cells = new Map(Ev("read:schema_of", rows).map((c) => [String(c[0]), c[1]]));
    const pop = (n) => cells.get("state:fts").find((d) => d[0] === n)[4].flat(1);
    expect(pop("WidgetHasCount")).toEqual([["w1", 12], ["w2", 7]]);
    expect(pop("WidgetHasLabel")).toEqual([["w1", "12"]]);
    const otp = (n) => cells.get("state:otpops").find((e) => e[0] === n)[1].flat(1);
    expect(otp("Count")).toEqual([12, 7]);
    expect(otp("Label")).toEqual(["12"]);
    // the lexeme read:kind_isint reads: a leading minus kept, anything else left as it is
    expect(Ev("value:as_int", "-40")).toBe(-40);
    expect(Ev("value:as_int", "007")).toBe(7);
    expect(Ev("value:as_int", "12.5")).toBe("12.5");
    expect(Ev("value:as_int", "-")).toBe("-");
    expect(Ev("value:as_int", "")).toBe("");
    expect(Ev("value:as_int", 3)).toBe(3);
    // what the tables answer, typed by the fact type each pair is of; a text role keeps its text
    expect(Ev("value:typed_pairs", [[["FactTypeHasArity", ["X", "2"]], ["FunctionHasDescription", ["d", "2"]]], CELLS]))
      .toEqual([["FactTypeHasArity", ["X", 2]], ["FunctionHasDescription", ["d", "2"]]]);
    // a write: the population main:cf_store is handed, typed, and a row that meets another once typed is one row
    expect(Ev("value:cf_typed", [CELLS, ["FactTypeHasArity", [["X", "2"], ["X", 2]]]])[1]).toEqual(["FactTypeHasArity", [["X", 2]]]);
    // an assert, typed before it is compared with anything the store holds
    expect(Ev("value:typed_in", [CELLS, [["FactTypeHasArity", "X", "3"], ["FunctionHasDescription", "d", "3"]]])[1])
      .toEqual([["FactTypeHasArity", "X", 3], ["FunctionHasDescription", "d", "3"]]);
    // the instance rows a store rebuilds a value type's population from: an instance of an integer type is one
    expect(Ev("value:typed_insts", [[["2", "Arity"], ["x", "Fact Type"]], CELLS])).toEqual([[2, "Arity"], ["x", "Fact Type"]]);
    // main:api: the fact of a fact-type resource, typed by that resource's kinds, as the fact tool's PUT and DELETE compare it
    expect(Ev("value:typed_row", [["X", "4"], Ev("value:ft_kinds", ["FactTypeHasArity", CELLS])])).toEqual(["X", 4]);
    // the kind rows come from the schema's own descriptor, which a store read at load has before any population cell does
    expect(Ev("value:cdt_rows", CELLS).filter((r) => r[0] === "Arity")).toEqual([["Arity", "integer"]]);
    // and the base module's own: the reflection's span positions are integers, as its arities were
    const span = Ev("system:pop_rows", ["ConstraintSpanHasPosition", CELLS]);
    expect(span.length).toBeGreaterThan(0);
    expect(span.every((r) => typeof r[1] === "number")).toBe(true);
  }, 300_000);
  // A DECIMAL IS HELD AS A DECIMAL (2026-09-29, the second unit of typed values). A value of a value type declared
  // decimal or money is <decimal, m, s>, normalized, typed where every value enters and written as its text where
  // every value leaves: a table cell, JSON, a template. A decimal column has NUMERIC affinity, so sqlite holds a REAL
  // and a load reads back its shortest text -- 1e-7 among them -- which is why exponent notation is a lexeme here.
  // ARITHMETIC AND ORDER OVER TYPED VALUES (2026-09-29, the third unit). A recipe names a primitive and the closure
  // applies it by the type each value carries: two integers stay on the primitive, anything else is decimal. A
  // division is the exact quotient whatever its operands, so a share of two counts is 0.3 and not 0; a sum of
  // decimals is exact; an integer and a decimal compare.
  // AN OPERAND'S `that` IS ITS ANAPHOR (2026-09-29). The calc arm looked `that total- Call Volume` up as a name no
  // leg binds and declined pm's share as a body no form says, where the same rule without the anaphors compiled.
  // Read as the roles the legs bound, the quotient lands over a ternary head, the Call Outcome carried through from
  // the derived total row.
  test("a quotient over a ternary head, its operands named as the legs bound them", () => {
    const T = (x) => Ev("value:text", x);
    const text = [
      "Cancel Request(.id) is an entity type.",
      "API Endpoint(.path) is an entity type.",
      "Call Outcome is a value type.",
      "Call Volume is a value type.",
      "  The data type of Call Volume is integer.",
      "Measured Share is a value type.",
      "  The data type of Measured Share is decimal.",
      "",
      "Cancel Request follows Call Volume calls to API Endpoint with Call Outcome.",
      "  For each Cancel Request, API Endpoint and Call Outcome, that Cancel Request follows at most one Call Volume calls to that API Endpoint with that Call Outcome.",
      "Cancel Request has counted- Call Volume.",
      "  Each Cancel Request has at most one counted- Call Volume.",
      "Cancel Request follows total- Call Volume calls with Call Outcome. *",
      "  For each Cancel Request and Call Outcome, that Cancel Request follows at most one total- Call Volume calls with that Call Outcome.",
      "Cancel Request has observed- Measured Share of calls with Call Outcome. *",
      "  For each Cancel Request and Call Outcome, that Cancel Request has at most one observed- Measured Share of calls with that Call Outcome.",
      "",
      "* Cancel Request follows total- Call Volume calls with Call Outcome iff total- Call Volume is the sum of Call Volume where that Cancel Request follows that Call Volume calls to some API Endpoint with that Call Outcome.",
      "* Cancel Request has observed- Measured Share of calls with Call Outcome iff that Cancel Request follows some total- Call Volume calls with that Call Outcome and that Cancel Request has some counted- Call Volume and observed- Measured Share is that total- Call Volume divided by that counted- Call Volume.",
      "",
      "Cancel Request 'c1' follows Call Volume 3 calls to API Endpoint '/vin' with Call Outcome 'served'.",
      "Cancel Request 'c1' follows Call Volume 1 calls to API Endpoint '/build' with Call Outcome 'served'.",
      "Cancel Request 'c1' follows Call Volume 1 calls to API Endpoint '/vin' with Call Outcome 'failed'.",
      "Cancel Request 'c2' follows Call Volume 1 calls to API Endpoint '/vin' with Call Outcome 'served'.",
      "Cancel Request 'c1' has counted- Call Volume 5.",
      "Cancel Request 'c2' has counted- Call Volume 3.",
      "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const F = Ev("read:x_full", Ev("read:x_of", rows));
    expect(Ev("read:state_undelivered", F)).toEqual([]);
    const rules = Ev("read:state_rules", F).map((r) => [r[0], r[2]]);
    const head = "CancelRequestHasObservedMeasuredShareOfCallsWithCallOutcome";
    expect(rules.find((r) => String(r[0]) === head)[1]).toEqual(["proj", ["calc", ["joinon", "CancelRequestFollowsTotalCallVolumeCallsWithCallOutcome", "CancelRequestHasCountedCallVolume", [[1, 1]], [1, 2, 3, 4, 5]], "dec:div", 2, 5], [1, 6, 3]]);
    const schema = Ev("read:schema_of", rows);
    const pops = schema.find((c) => String(c[0]) === "state:fts")[1].map((d) => [d[0], d[4].flat(1).filter((r) => Array.isArray(r) && r.length)]);
    const share = (Ev("derive", [rules, pops]).find((e) => String(e[0]) === head) || ["", []])[1];
    expect(share.map((r) => [r[0], T(r[1]), r[2]]).sort()).toEqual([["c1", "0.2", "failed"], ["c1", "0.8", "served"], ["c2", "0.33333333333333", "served"]]);
  }, 300_000);

  // FP:OR2 IS NOT A GUARD (2026-09-29). read:rule_chain_step tested `null . 11` inside an or2 whose other side took
  // `length . 2 . 11`, so when the chain arm found no fact type for a hop the pair was built anyway and the selector
  // threw on the empty sequence -- the whole reader, for one rule whose head lacks a role a leg quantifies. The
  // guards are COND now; the chain arm declines the rule and the calc arm reads it.
  test("a leg that quantifies a role the head lacks declines the chain arm instead of throwing", () => {
    const text = [
      "Cancel Request(.id) is an entity type.",
      "API Endpoint(.path) is an entity type.",
      "Call Outcome is a value type.",
      "Call Volume is a value type.",
      "  The data type of Call Volume is integer.",
      "Measured Share is a value type.",
      "  The data type of Measured Share is decimal.",
      "",
      "Cancel Request follows Call Volume calls to API Endpoint with Call Outcome.",
      "  For each Cancel Request, API Endpoint and Call Outcome, that Cancel Request follows at most one Call Volume calls to that API Endpoint with that Call Outcome.",
      "Cancel Request has counted- Call Volume.",
      "  Each Cancel Request has at most one counted- Call Volume.",
      "Cancel Request follows total- Call Volume calls with Call Outcome. *",
      "  For each Cancel Request and Call Outcome, that Cancel Request follows at most one total- Call Volume calls with that Call Outcome.",
      "Cancel Request has overall- Measured Share. *",
      "  Each Cancel Request has at most one overall- Measured Share.",
      "",
      "* Cancel Request follows total- Call Volume calls with Call Outcome iff total- Call Volume is the sum of Call Volume where that Cancel Request follows that Call Volume calls to some API Endpoint with that Call Outcome.",
      "* Cancel Request has overall- Measured Share iff that Cancel Request follows some total- Call Volume calls with some Call Outcome and that Cancel Request has some counted- Call Volume and overall- Measured Share is that total- Call Volume divided by that counted- Call Volume.",
      "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const F = Ev("read:x_full", Ev("read:x_of", rows));
    expect(Ev("read:state_undelivered", F)).toEqual([]);
    const rules = Ev("read:state_rules", F).map((r) => [r[0], r[2]]);
    expect(rules.find((r) => String(r[0]) === "CancelRequestHasOverallMeasuredShare")[1]).toEqual(["proj", ["calc", ["joinon", "CancelRequestFollowsTotalCallVolumeCallsWithCallOutcome", "CancelRequestHasCountedCallVolume", [[1, 1]], [1, 2, 3, 4, 5]], "dec:div", 2, 5], [1, 6]]);
  }, 300_000);

  // A TUPLE IS KNOWN BY ITS FIRST VALUE, AND A DECIMAL IS A VALUE (2026-09-29). rmap:unnest asked atom of a tuple's
  // first element, so a tuple opening with a decimal read as a list of cells and unnest descended into the decimal:
  // the served get of every paid plan on support threw `selector 1 on atom: 0` once its money was held as decimals.
  test("a tuple whose first value is a decimal untuples, and does not unnest the decimal", () => {
    const d = ["decimal", 100, 0];
    expect(Ev("rmap:unnest", [d, "x"])).toEqual([[d], ["x"]]);
    expect(Ev("rmap:unnest", [["decimal", 15, 4], ["decimal", 25, 2]])).toEqual([[["decimal", 15, 4]], [["decimal", 25, 2]]]);
    expect(Ev("rmap:unnest", ["a", "b"])).toEqual([["a"], ["b"]]);
  });

  // A ROW THAT OPENS WITH A DECIMAL IS A ROW (2026-09-29). value:typed_rows asked atom of a row's first element, so
  // rows of a ternary <x- Level, y- Level, Point>, once typed, read as lists of rows and were
  // typed again inside each decimal: <decimal, <decimal, -7, 0>, 1>, and the store refused the population.
  test("a population whose rows open with a decimal types once, and typing twice is typing once", () => {
    const kinds = ["decimal", "decimal", "text"];
    const text = [["-0.7", "0.7", "p1"], ["0", "0.35", "p2"]];
    const once = Ev("value:typed_rows", [kinds, text]);
    expect(once).toEqual([[["decimal", -7, 1], ["decimal", 7, 1], "p1"], [0, ["decimal", 35, 2], "p2"]].map((r) => r.map((v) => (v === 0 ? Ev("value:as_dec", "0") : v))));
    expect(Ev("value:typed_rows", [kinds, once])).toEqual(once);
    const chunked = [text.slice(0, 1), text.slice(1)];
    expect(Ev("value:typed_rows", [kinds, Ev("value:typed_rows", [kinds, chunked])])).toEqual([once.slice(0, 1), once.slice(1)]);
    expect(Ev("value:kind_deep", ["decimal", [["decimal", -7, 1], "0.5"]])).toEqual([["decimal", -7, 1], ["decimal", 5, 1]]);
  });

  // AN OBJECTIFIED INSTANCE READS BACK BY ITS ID (2026-09-29). support's PlanProduct table is keyed on its two roles and
  // has no id column, so its prices read back as <Growth, vin, 0.0025> for a binary fact type and the uniqueness on the
  // first role counted Plans. On a relation table a multi-column key is the instance, spelled as rmap:proj_objkey spells it.
  test("a relation table keyed on its roles reads its instance back by its id", () => {
    const paths = [["plan", "p"], ["platformAPI", "p"], ["callAmount", "p"]];
    const rel = ["PlanProduct", paths, ["plan", "platformAPI"], "T", [], [1, 2]];
    const ent = ["PlanProduct", paths, ["plan", "platformAPI"], "F", [], []];
    const one = ["ConstraintSpan", [["constraintSpanId", "p"], ["position", "p"]], ["constraintSpanId"], "T", [], [0]];
    const def = globalThis.AREST.DEFS.get("rmap:unproj_key");
    for (const [x, want] of [
      [[["Growth", "vin", "0.0025"], rel], ["Growth.vin"]],
      [[["Growth", "vin", "0.0025"], ent], ["Growth", "vin"]],
      [[["c1.r1", "2"], one], ["c1.r1"]],
    ]) {
      expect(Ev("rmap:unproj_key", x)).toEqual(want);
      expect(Ev(def, x)).toEqual(want);
    }
  });

  // A DECIMAL PRINTS AS ITS LEXEME (2026-09-29). system:show is the text every served verb answers in, and it printed
  // a decimal as the sequence it is held as: `get Growth` on support answered (decimal, 100, 0) for its price per
  // billing interval. render:json had the arm from the start; the two print a decimal alike now.
  test("a decimal prints as its lexeme in a verb's text, as it does in JSON", () => {
    expect(Ev("system:show", ["decimal", 4, 3])).toBe("0.004");
    expect(Ev("system:show", [["decimal", 100, 0]])).toBe("(100)");
    expect(Ev("system:show", ["Starter.vin", ["decimal", 4, 3]])).toBe("('Starter.vin', 0.004)");
    expect(Ev("render:json", ["Starter.vin", ["decimal", 4, 3]])).toBe('["Starter.vin",0.004]');
    // a sequence that only looks like one keeps printing as a sequence
    expect(Ev("system:show", ["decimal", "4", 3])).toBe("('decimal', '4', 3)");
  });

  // MEMBERSHIP IS CLOSED OVER SUBTYPING, WHOEVER MADE THE INSTANCE (2026-09-29, Sam: `Support Response should be a
  // subtype of Response, and Response should be a subtype of Message.`). An instance the runtime created was an
  // instance of the noun it was created as and of the nouns whose roles it plays: support's Support Responses were
  // Support Responses and Messages and never Responses. The extent now pairs the instances of each type that has a
  // supertype with that type's upward cone, once per type; a type with none adds nothing, its rows being the store's
  // own, which the cell keeps. The closure adds memberships, never an instance, so no reference.
  test("membership is closed over subtyping: each subtype's instances with its upward cone, the store's own rows kept, and no new reference", () => {
    const { adoptStore } = globalThis.AREST;
    const keep = CELLS.slice();
    try {
      adoptStore(Ev("store:src_all", [[
        ["ObjectTypeIsSubtypeOfObjectType", [["Support Response", "Response"], ["Response", "Message"], ["Chat Response", "Response"]]],
        ["ObjectTypeInstanceIsInstanceOfObjectType", [["r1", "Support Response"], ["r1", "Message"], ["c1", "Chat Response"], ["m1", "Message"]]],
      ], CELLS]));
      const of = (rows, id) => rows.filter((r) => String(r[0]) === id).map((r) => String(r[1])).sort();
      const up = Ev("reflect:inst_up", CELLS);
      expect(of(up, "r1")).toEqual(["Message", "Response", "Support Response"]);
      expect(of(up, "c1")).toEqual(["Chat Response", "Message", "Response"]);
      expect(of(up, "m1")).toEqual([]);
      const cell = Ev("reflect:cells", CELLS).find((c) => String(c[0]) === "ObjectTypeInstanceIsInstanceOfObjectType")[1];
      expect(of(cell, "r1")).toEqual(["Message", "Response", "Support Response"]);
      expect(of(cell, "c1")).toEqual(["Chat Response", "Message", "Response"]);
      expect(of(cell, "m1")).toEqual(["Message"]);
      expect(new Set(cell.map((r) => JSON.stringify(r))).size).toBe(cell.length);
      const refs = Ev("reflect:inst_refs", CELLS).map((r) => String(r[0]));
      for (const id of ["r1", "c1", "m1"]) expect(refs).not.toContain(id);
    } finally {
      adoptStore(keep);
    }
  });

  // AND A WRITE CLOSES THE MEMBERSHIP IT FILES, ON THE STORE A SERVER READS (2026-09-29). A start computes
  // nothing, so over a store.db the closure arrives with the first write's reflection and reaches the tables
  // with its write-back. Served support was the case: rebuilt on 034a5772, its reply resp-test-beau-20260925
  // was still no Response, because nothing had written since. This writes a Stream -- `Stream is a subtype
  // of Function` -- through main:api over a closed base store, and the next boot reads the new instance
  // under Function as well as under Stream, from the tables.
  test("a write closes the membership it files, and the next boot reads it from the tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-closure-"));
    const mod = join(import.meta.dir, "cases.g.js");
    const KEY = "probe-stream-" + Math.random().toString(36).slice(2, 8);
    const p = join(dir, "store.db");
    {
      const db = new Database(p);
      makeTables(db);
      db.run("create table _composition (hash text)");
      db.prepare("insert into _composition values(?)").run(globalThis.AREST.composition);
      db.run("pragma wal_checkpoint(TRUNCATE)");
      db.close();
    }
    const driver = join(dir, "drive.mjs");
    writeFileSync(driver, [
      "await import(process.env.MODULE);",
      "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore } = globalThis.AREST;",
      "if (process.env.MAKE) {",
      "  const b = popSnapshot(CELLS); closeStore(); console.log('made ' + emitToDb(b, CELLS));",
      "} else if (process.env.WRITE) {",
      "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
      "  const out = Ev('main:api', [CELLS, 'POST', 'StreamHasName', '', [process.env.KEY, 'probe-name']]);",
      "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) console.log('emitted ' + emitToDb(before, CELLS, prior)); }",
      "  console.log('status ' + out[1]);",
      "} else {",
      "  const rows = Ev('system:pop_rows', ['ObjectTypeInstanceIsInstanceOfObjectType', CELLS]);",
      "  console.log('types ' + JSON.stringify(rows.filter((r) => String(r[0]) === process.env.KEY).map((r) => String(r[1])).sort()));",
      "}",
    ].join(String.fromCharCode(10)));
    const run = (mode) => {
      const env = { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: p, KEY };
      delete env.MAKE; delete env.WRITE; delete env.AREST_EAGER_STORE;
      if (mode) env[mode] = "1";
      const r = Bun.spawnSync(["bun", driver], { env, stdout: "pipe", stderr: "pipe" });
      return r.stdout.toString() + r.stderr.toString();
    };
    try {
      expect(run("MAKE")).toMatch(/made \d+/);
      expect(run("WRITE")).toMatch(/status 20[01]/);
      const read = run(null);
      const m = read.match(/types (\[.*\])/);
      expect(m, read).not.toBe(null);
      const types = JSON.parse(m[1]);
      expect(types, read).toContain("Stream");
      expect(types, read).toContain("Function");
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 120_000);

  // THE COMPILE IS LAMBDA'S ADDRESS, AND THE BASE CARRIERS ARE WHAT IT WRITES (2026-09-29). compile.js is
  // deleted; `compile <out> <dir>...` is routed by main to compile:run, which renders both carriers in lambda
  // and writes them through the registered fs:write. The metamodel compiled that way is the committed base,
  // byte for byte -- which is also what keeps tools/carriers/base in step with metamodel/ from now on.
  test("the carrier grammar escapes what LAMBDATEXT unescapes", () => {
    const q = String.fromCharCode(34), b = String.fromCharCode(92);
    const text = "a" + q + "b" + b + "c" + String.fromCharCode(10) + "d" + String.fromCharCode(13) + "e" + String.fromCharCode(9) + "f";
    const want = "S(A(" + q + "a" + b + q + "b" + b + b + "c" + b + "n" + "d" + b + "r" + "e" + b + "t" + "f" + q + "),N(3),PHI(),A(" + q + q + "))";
    expect(Ev("compile:src", [text, 3, [], ""])).toBe(want);
  });

  // AND THE STORE IT WRITES IS THE CLOSED STORE (2026-09-30). `compile-store` writes out/store.db beside the
  // carriers: the compiled cells closed by store:close, adopted as their own source, projected table by table.
  // A start reads the tables and computes nothing, so the store is right exactly when a module started from it
  // holds what a module that closes the carriers itself holds -- every fact type the store has a home for,
  // fact for fact, compared as sorted texts with each value spelled as it is stored.
  test("a store lambda's compile writes is the closed store a carriers boot computes", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-cstore-"));
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const out = join(dir, "carriers");
      mkdirSync(out);
      const env = { ...process.env, AREST_PARSE_CACHE: "off" };
      delete env.AREST_STORE_DB; delete env.AREST_STRICT;
      const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile-store", out, "metamodel"],
        { cwd: join(import.meta.dir, "..", ".."), env, stdout: "pipe", stderr: "pipe" });
      const text = r.stdout.toString() + r.stderr.toString();
      expect(r.exitCode, text).toBe(0);
      expect(text).toMatch(/store: \d+ rows in its tables/);
      const db = new Database(join(out, "store.db"), { readonly: true });
      const homed = new Set(db.query('select distinct "ft" from "_metaschema" where "ft" is not null').values().map((v) => String(v[0])));
      const tables = new Set(db.query("select name from sqlite_master where type = 'table'").values().map((v) => String(v[0])));
      db.close();
      const driver = join(dir, "pops.mjs");
      writeFileSync(driver, [
        "await import(process.env.MODULE);",
        "const { Ev, CELLS } = globalThis.AREST;",
        "const norm = (v) => (Array.isArray(v) ? (Ev('dec:is', v) === 'T' ? Ev('dec:text', v) : v.map(norm)) : String(v));",
        "const out = {};",
        // compile:adopt_pairs and not derive:store_pairs: the latter answers nothing for a fully derived head,
        // which is right for the fixpoint's input and left this comparison blind to every population the rule
        // owns -- and the compile had written none of them (2026-09-30).
        "for (const p of Ev('compile:adopt_pairs', CELLS)) {",
        "  const rows = Array.isArray(p[1]) ? p[1] : [];",
        "  out[String(p[0])] = rows.map((r) => JSON.stringify(norm(r))).sort();",
        "}",
        "console.log('POPS ' + JSON.stringify(out));",
      ].join(String.fromCharCode(10)));
      const pops = (store) => {
        const e = { ...process.env, MODULE: pathToFileURL(join(import.meta.dir, "cases.g.js")).href };
        delete e.AREST_EAGER_STORE;
        if (store) e.AREST_STORE_DB = store; else delete e.AREST_STORE_DB;
        const p = Bun.spawnSync(["bun", driver], { env: e, stdout: "pipe", stderr: "pipe" });
        const s = p.stdout.toString();
        const at = s.indexOf("POPS ");
        expect(at, s + p.stderr.toString()).toBeGreaterThan(-1);
        return JSON.parse(s.slice(at + 5).split(String.fromCharCode(10))[0]);
      };
      const fromCarriers = pops(null), fromStore = pops(join(out, "store.db"));
      const differ = [];
      let compared = 0, facts = 0;
      for (const ft of Object.keys(fromCarriers)) {
        if (!homed.has(ft) && !tables.has(ft)) continue;
        const a = fromCarriers[ft] || [], s = fromStore[ft] || [];
        compared++; facts += a.length;
        if (JSON.stringify(a) !== JSON.stringify(s)) differ.push(ft + " carriers " + a.length + " store " + s.length);
      }
      expect(differ).toEqual([]);
      // and not vacuously: the metamodel's store homes hundreds of fact types and thousands of their facts
      expect(compared).toBeGreaterThan(100);
      expect(facts).toBeGreaterThan(5000);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 240_000);

  // AND A STORE THAT EXISTS IS CHANGED IN PLACE (2026-09-30). The same compile over a store that exists copies it,
  // applies the new schema's delta, keeps what the runtime wrote and supersedes what the last readings said and these
  // do not. A probe corpus is compiled, a row is written into its store the way a server writes one, the readings
  // change -- one stated Widget goes, another comes, Widget gains a column and Gadget is new -- and the compile runs
  // again over the store: the runtime's row is there, the dropped Widget is not, the new table and column are, and a
  // compile of the same readings once more writes nothing.
  test("a compile over a store that exists keeps what the runtime wrote and moves only what the readings did", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-inplace-"));
    const NL = String.fromCharCode(10);
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const out = join(dir, "carriers"), v1 = join(dir, "v1"), v2 = join(dir, "v2");
      for (const d of [out, v1, v2]) mkdirSync(d);
      const head = ["Widget(.id) is an entity type.", "Colour is a value type."];
      const domain = ["", "Domain 'ip-probe' has Description 'an in-place probe'.", ""];
      writeFileSync(join(v1, "probe.md"), [...head, ...domain,
        "Widget has Colour.", "  Each Widget has at most one Colour.", "", "Widget 'w1' has Colour 'red'.", ""].join(NL));
      writeFileSync(join(v2, "probe.md"), [...head, "Size is a value type.", "Gadget(.id) is an entity type.", ...domain,
        "Widget has Colour.", "  Each Widget has at most one Colour.", "Widget has Size.", "  Each Widget has at most one Size.",
        "Gadget has Colour.", "  Each Gadget has at most one Colour.", "",
        "Widget 'w3' has Colour 'green'.", "Gadget 'g1' has Colour 'red'.", ""].join(NL));
      const env = { ...process.env, AREST_PARSE_CACHE: "off" };
      delete env.AREST_STORE_DB; delete env.AREST_STRICT;
      const compile = (readings) => {
        const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile-store", out, "metamodel", readings],
          { cwd: join(import.meta.dir, "..", ".."), env, stdout: "pipe", stderr: "pipe" });
        const text = r.stdout.toString() + r.stderr.toString();
        expect(r.exitCode, text).toBe(0);
        return text;
      };
      const widgets = () => {
        const db = new Database(join(out, "store.db"), { readonly: true });
        try { return db.query('select "widgetId", "colour" from "Widget" order by 1').values().map((r) => r.join("=")); }
        finally { db.close(); }
      };
      expect(compile(v1)).toMatch(/store: \d+ rows in its tables/);
      expect(widgets()).toEqual(["w1=red"]);
      // the runtime writes a Widget of its own, as a server writes a row
      const db = new Database(join(out, "store.db"));
      db.run('insert into "Widget" ("widgetId", "colour") values (?, ?)', ["w-runtime", "blue"]);
      db.close();
      const moved = compile(v2);
      expect(moved).toMatch(/store \(in place\): 1 fact\(s\) the runtime wrote kept, \d+ table\(s\) written again, 1 created, 1 re-laid, 0 dropped/);
      expect(widgets()).toEqual(["w-runtime=blue", "w3=green"]);
      const g = new Database(join(out, "store.db"), { readonly: true });
      expect(g.query('select "gadgetId", "colour" from "Gadget"').values()).toEqual([["g1", "red"]]);
      expect(g.query("select name from pragma_table_info('Widget')").values().map((r) => r[0])).toContain("size");
      g.close();
      expect(existsSync(join(out, "store.db.prior"))).toBe(true);
      // and the same readings again change nothing
      expect(compile(v2)).toMatch(/store \(in place\): 1 fact\(s\) the runtime wrote kept, 0 table\(s\) written again, 0 created, 0 re-laid, 0 dropped/);
      expect(widgets()).toEqual(["w-runtime=blue", "w3=green"]);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 240_000);

  // AND A COLUMN THAT CARRIES ANOTHER FACT TYPE NOW REFUSES ONLY WHEN IT HOLDS VALUES (2026-09-30). Sam re-read
  // `Agent Chat is with Agent` as `Agent uses Agent Chat` with no mandatory, and claude's check refused, because every
  // column whose fact type changed was refused, empty or not. The probe makes the same change -- `Widget is with Owner`
  // becomes `Owner uses Widget` -- over two stores. Where the owner column is empty, the compile goes through and the
  // column carries the new fact type. Where the runtime wrote an owner into it, the compile refuses by name and the
  // store keeps its owner.
  test("a column that carries another fact type now is refused only when it holds values", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-recarry-"));
    const NL = String.fromCharCode(10);
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const v1 = join(dir, "v1"), v2 = join(dir, "v2"), empty = join(dir, "empty"), filled = join(dir, "filled");
      for (const d of [v1, v2, empty, filled]) mkdirSync(d);
      const head = ["Widget(.id) is an entity type.", "Owner(.id) is an entity type.", "Colour is a value type.", "",
        "Domain 'rc-probe' has Description 'a recarry probe'.", "", "Widget has Colour.", "  Each Widget has at most one Colour."];
      writeFileSync(join(v1, "probe.md"), [...head, "Widget is with Owner.", "  Each Widget is with at most one Owner.", "",
        "Widget 'w1' has Colour 'red'.", ""].join(NL));
      writeFileSync(join(v2, "probe.md"), [...head, "Owner uses Widget.", "  For each Widget, at most one Owner uses that Widget.", "",
        "Widget 'w1' has Colour 'red'.", ""].join(NL));
      const env = { ...process.env, AREST_PARSE_CACHE: "off" };
      delete env.AREST_STORE_DB; delete env.AREST_STRICT;
      const compile = (out, readings) => {
        const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile-store", out, "metamodel", readings],
          { cwd: join(import.meta.dir, "..", ".."), env, stdout: "pipe", stderr: "pipe" });
        return { code: r.exitCode, text: r.stdout.toString() + r.stderr.toString() };
      };
      const read = (out, sql) => {
        const db = new Database(join(out, "store.db"), { readonly: true });
        try { return db.query(sql).values(); } finally { db.close(); }
      };
      for (const out of [empty, filled]) { const r = compile(out, v1); expect(r.code, r.text).toBe(0); }
      const col = read(filled, "select name from pragma_table_info('Widget')").map((r) => r[0]).find((c) => /owner/i.test(c));
      expect(col).toBeDefined();
      const carried = (out) => read(out, "select ft from _metaschema where tab = 'Widget' and col = '" + col + "'").map((r) => r[0]);
      expect(carried(empty)).toEqual(["WidgetIsWithOwner"]);
      // the runtime writes an owner into one store, as a server writes a row
      const w = new Database(join(filled, "store.db"));
      w.run('update "Widget" set "' + col + '" = ? where "widgetId" = ?', ["o1", "w1"]);
      w.close();
      const e = compile(empty, v2);
      expect(e.code, e.text).toBe(0);
      expect(carried(empty)).toEqual(["OwnerUsesWidget"]);
      expect(read(empty, 'select "widgetId", "colour" from "Widget"')).toEqual([["w1", "red"]]);
      const f = compile(filled, v2);
      expect(f.code, f.text).not.toBe(0);
      // the owner the runtime wrote is a fact of a fact type the new readings do not declare, and the refusal names it
      expect(f.text).toContain("fact(s) the runtime wrote are of fact types the readings no longer declare");
      expect(f.text).toContain("WidgetIsWithOwner");
      expect(carried(filled)).toEqual(["WidgetIsWithOwner"]);
      expect(read(filled, 'select "' + col + '" from "Widget" where "widgetId" = \'w1\'')).toEqual([["o1"]]);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 240_000);

  // AND THE REFLECTION'S INSTANCES OF A FACT TYPE THE READINGS DROP GO WITH IT (2026-09-30). The server writes the
  // reflection's instances back into the instance-of extent, a fact type as a Fact Type and its roles as Roles, and
  // the compile kept that extent whole as runtime facts. So claude's store kept the instances of fact types its
  // readings no longer declare, each broke a mandatory, and every write was refused. The probe writes those rows the
  // way the server does, beside an instance the runtime created, then drops the fact type: the reflection's rows go
  // and the runtime's instance stays.
  test("the reflection's instances of a fact type the readings drop go with it, and the runtime's stay", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-reflected-"));
    const NL = String.fromCharCode(10);
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const out = join(dir, "carriers"), v1 = join(dir, "v1"), v2 = join(dir, "v2");
      for (const d of [out, v1, v2]) mkdirSync(d);
      const domain = ["", "Domain 'rf-probe' has Description 'a reflection probe'.", ""];
      const colour = ["Widget has Colour.", "  Each Widget has at most one Colour."];
      writeFileSync(join(v1, "probe.md"), ["Widget(.id) is an entity type.", "Owner(.id) is an entity type.", "Colour is a value type.",
        ...domain, ...colour, "Widget is with Owner.", "  Each Widget is with at most one Owner.", "", "Widget 'w1' has Colour 'red'.", ""].join(NL));
      writeFileSync(join(v2, "probe.md"), ["Widget(.id) is an entity type.", "Colour is a value type.",
        ...domain, ...colour, "", "Widget 'w1' has Colour 'red'.", ""].join(NL));
      const env = { ...process.env, AREST_PARSE_CACHE: "off" };
      delete env.AREST_STORE_DB; delete env.AREST_STRICT;
      const compile = (readings) => {
        const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile-store", out, "metamodel", readings],
          { cwd: join(import.meta.dir, "..", ".."), env, stdout: "pipe", stderr: "pipe" });
        const text = r.stdout.toString() + r.stderr.toString();
        expect(r.exitCode, text).toBe(0);
        return text;
      };
      const ids = ["WidgetIsWithOwner", "WidgetIsWithOwner.1", "WidgetIsWithOwner.2", "w-runtime"];
      const extent = () => {
        const db = new Database(join(out, "store.db"), { readonly: true });
        try {
          return db.query('select "objectTypeInstanceId", "objectTypeId" from "ObjectTypeInstanceIsInstanceOfObjectType" where "objectTypeInstanceId" in (?, ?, ?, ?) order by 1, 2')
            .values(...ids).map((r) => r.join(" is a "));
        } finally { db.close(); }
      };
      compile(v1);
      // A compile's own closure files the reflection's instances and records them as derived, so the next compile drops
      // them with the rest of its closure. claude's were written back by a server before any compile kept a record, so
      // no record names them: the probe's store is made that way, and gets an instance the runtime created beside them.
      const w = new Database(join(out, "store.db"));
      expect(w.query("select count(*) from _derived where ft = 'ObjectTypeInstanceIsInstanceOfObjectType' and row like '%WidgetIsWithOwner%'").values()[0][0]).toBeGreaterThan(0);
      w.run("delete from _derived where row like '%WidgetIsWithOwner%'");
      for (const [i, t] of [["WidgetIsWithOwner", "Fact Type"], ["WidgetIsWithOwner", "Function"], ["WidgetIsWithOwner.1", "Role"],
        ["WidgetIsWithOwner.2", "Role"], ["w-runtime", "Widget"]])
        w.run('insert or ignore into "ObjectTypeInstanceIsInstanceOfObjectType" ("objectTypeInstanceId", "objectTypeId") values (?, ?)', [i, t]);
      w.close();
      expect(extent()).toContain("WidgetIsWithOwner.1 is a Role");
      compile(v2);
      expect(extent()).toEqual(["w-runtime is a Widget"]);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 240_000);

  // AND A VALUE THE READINGS STORE THROUGH A FUNCTION IS SEALED BEFORE ANYTHING IS WRITTEN (2026-09-30). A probe's
  // .env gives a connection a Secret Reference, which core.md stores through crypt:encrypt. With a key the compile
  // writes it nowhere in plaintext -- not the answer, the carriers or the store -- and the store's column decrypts
  // back to it under that key. With no key it refuses by name, names no value and writes nothing. Bun loads a .env
  // from the working directory, and arest's own holds the real master key, so the keyed compile is given a test key
  // explicitly and the keyless one runs from a directory with no .env at all.
  test("a secret a .env gives is sealed before the compile writes anything, and with no key nothing is written", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-seal-"));
    const NL = String.fromCharCode(10), secret = "not-a-real-secret-4c1d", key = "test-key-not-real";
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const probe = join(dir, "probe"), keyed = join(dir, "keyed"), keyless = join(dir, "keyless"), bare = join(dir, "bare");
      for (const d of [probe, keyed, keyless, bare]) mkdirSync(d);
      writeFileSync(join(probe, "probe.md"), ["Domain 'seal-probe' has Description 'a sealing probe'.", ""].join(NL));
      writeFileSync(join(probe, ".env"), ["Domain 'seal-probe' connects to External System 'probe-sys'.",
        "DomainConnectsToExternalSystem 'seal-probe.probe-sys' carries Secret Reference '" + secret + "'.", ""].join(NL));
      const metamodel = join(import.meta.dir, "..", "..", "metamodel");
      const run = (out, cwd, withKey) => {
        const env = { ...process.env, AREST_PARSE_CACHE: "off" };
        delete env.AREST_STORE_DB; delete env.AREST_STRICT; delete env.AREST_MASTER_KEY;
        if (withKey) env.AREST_MASTER_KEY = key;
        const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile-store", out, metamodel, probe],
          { cwd, env, stdout: "pipe", stderr: "pipe" });
        return { code: r.exitCode, text: r.stdout.toString() + r.stderr.toString() };
      };
      const k = run(keyed, join(import.meta.dir, "..", ".."), true);
      expect(k.code, k.text).toBe(0);
      expect(k.text.includes(secret)).toBe(false);
      for (const f of ["design-state", "compiled", "store.db"]) expect(readFileSync(join(keyed, f)).includes(secret), f).toBe(false);
      const db = new Database(join(keyed, "store.db"), { readonly: true });
      const row = db.query('select "secretReference" from "DomainConnectsToExternalSystem" where "domainConnectsToExternalSystemId" = ?').get("seal-probe.probe-sys");
      db.close();
      expect(row && typeof row.secretReference === "string" && row.secretReference !== secret).toBe(true);
      expect(Ev("crypt:decrypt", [key, row.secretReference])).toBe(secret);
      const n = run(keyless, bare, false);
      expect(n.code, n.text).toBe(1);
      expect(n.text).toContain("no AREST_MASTER_KEY to store them with");
      expect(n.text.includes(secret)).toBe(false);
      expect(readdirSync(keyless)).toEqual([]);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 240_000);

  test("what the compile prints says a .env sentence by its shape and blanks no value, and cn:contains's twin is its DEF", () => {
    // Sam, 2026-10-02: blanking every .env value wherever an answer says it lets anyone who can put
    // text into an answer guess and check. A finding about a .env sentence says its shape instead,
    // and a text that merely says the same value is printed as it is.
    const said = "It is forbidden that Thing 'a3' has Code 'k-123'";
    const shapes = [[said, "It is forbidden that Thing '...' has Code '...'"]];
    expect(Ev("compile:env_shaped", [[["unbuilt", "r", "reported", [], said]], shapes])).toEqual([["unbuilt", "r", "reported", [], "It is forbidden that Thing '...' has Code '...'"]]);
    expect(Ev("compile:env_shaped", [[["unbuilt", "r", "reported", [], "a rule that says k-123"]], shapes])).toEqual([["unbuilt", "r", "reported", [], "a rule that says k-123"]]);
    expect(globalThis.AREST.DEFS.has("compile:redact")).toBe(false);
    const def = globalThis.AREST.DEFS.get("cn:contains");
    const pairs = [["", ""], ["", "a"], ["a", ""], ["abc", "bc"], ["abc", "cd"], ["abc", "abcd"], ["a\u{1F600}b", "\u{1F600}b"], ["\u{1F600}", "\uDE00"]];
    for (const p of pairs) expect(Ev("cn:contains", p), JSON.stringify(p)).toBe(Ev(def, p));
  });

  test("the base carriers regenerate byte for byte through lambda's compile address", () => {
    const dir = mkdtempSync(join(tmpdir(), "arest-compile-"));
    try {
      const b = Bun.spawnSync(["bun", "build.js", "compile"],
        { cwd: import.meta.dir, env: { ...process.env, AREST_OUT_DIR: dir }, stdout: "pipe", stderr: "pipe" });
      expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
      const out = join(dir, "carriers");
      mkdirSync(out);
      const env = { ...process.env, AREST_PARSE_CACHE: "off" };
      delete env.AREST_STORE_DB; delete env.AREST_STRICT;
      const r = Bun.spawnSync(["bun", join(dir, "compile.g.js"), "compile", out, "metamodel"],
        { cwd: join(import.meta.dir, "..", ".."), env, stdout: "pipe", stderr: "pipe" });
      const text = r.stdout.toString() + r.stderr.toString();
      expect(r.exitCode, text).toBe(0);
      expect(text).toContain("relational map: 34 artifacts");
      for (const f of ["design-state", "compiled"]) {
        expect(readFileSync(join(out, f)).equals(readFileSync(join(import.meta.dir, "..", "carriers", "base", f))), f).toBe(true);
      }
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 120_000);

  test("arithmetic and order by the type a value carries: a sum, a share, a comparison", () => {
    const T = (x) => Ev("value:text", x);
    expect(Ev("value:add", [2, 3])).toBe(5);
    expect(Ev("value:div", [7, 2])).toBe(3);
    expect(T(Ev("value:add", [["decimal", 1, 1], ["decimal", 2, 1]]))).toBe("0.3");
    expect(T(Ev("value:add", [["decimal", 1, 1], 2]))).toBe("2.1");
    expect(T(Ev("value:sub", [1, ["decimal", 1, 3]]))).toBe("0.999");
    expect(T(Ev("value:mul", [["decimal", 15, 1], ["decimal", -225, 2]]))).toBe("-3.375");
    expect(T(Ev("dec:div", [2677, 5]))).toBe("535.4");
    expect(T(Ev("dec:div", [1, 3]))).toBe("0.33333333333333");
    expect(T(Ev("dec:div", [2, 3]))).toBe("0.66666666666667");
    expect(T(Ev("dec:div", [-7, 2]))).toBe("-3.5");
    expect(T(Ev("dec:div", [["decimal", 5, 1], ["decimal", 25, 2]]))).toBe("2");
    expect(T(Ev("dec:div", [1, 7000]))).toBe("0.00014285714286");
    expect(Ev("value:ge", [["decimal", 10, 2], ["decimal", 1, 1]])).toBe("T");
    expect(Ev("value:ge", [5, ["decimal", 51, 1]])).toBe("F");
    expect(Ev("value:ge", ["b", "a"])).toBe("T");
    expect(Ev("value:op_of", "+")).toBe("value:add");
    expect(Ev("value:op_of", "dec:div")).toBe("dec:div");
    expect(Ev("value:kinds_meet", ["integer", "number"])).toBe("T");
    expect(Ev("value:kinds_meet", ["integer", "text"])).toBe("F");
    // a literal in a rule is held as its role holds it
    expect(Ev("read:kind_cell", ["number", "0.25"])).toEqual([["decimal", 25, 2]]);
    expect(Ev("read:kind_cell", ["number", "7"])).toEqual([["decimal", 7, 0]]);
    // a rule: a share of two counts, and a sum of decimal amounts, compiled and closed
    const text = [
      "Widget(.name) is an entity type.",
      "Hits is a value type.", "  The data type of Hits is integer.",
      "Total is a value type.", "  The data type of Total is integer.",
      "Share is a value type.", "  The data type of Share is decimal.", "",
      "Widget has Hits.", "  Each Widget has at most one Hits.",
      "Widget has Total.", "  Each Widget has at most one Total.",
      "Widget has Share. *", "  Each Widget has at most one Share.", "",
      "* Widget has Share iff Widget has Hits and Widget has Total and Share is Hits divided by Total.", "",
      "Widget 'w1' has Hits 12.", "Widget 'w1' has Total 40.",
      "Widget 'w2' has Hits 1.", "Widget 'w2' has Total 3.", "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const schema = Ev("read:schema_of", rows);
    const rules = JSON.stringify(schema.find((c) => String(c[0]) === "state:rules")[1]);
    expect(rules.includes('"dec:div"')).toBe(true);
    const pops = schema.find((c) => String(c[0]) === "state:fts")[1].map((d) => [d[0], d[4].flat(1).filter((r) => Array.isArray(r) && r.length)]);
    const derived = Ev("derive", [Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows))).map((r) => [r[0], r[2]]), pops]);
    const share = (derived.find((e) => String(e[0]) === "WidgetHasShare") || ["", []])[1];
    expect(share.map((r) => [r[0], T(r[1])]).sort()).toEqual([["w1", "0.3"], ["w2", "0.33333333333333"]]);
    // a sum of decimal amounts, exact where binary floating point would give 0.30000000000000004
    const sumText = [
      "Organization(.name) is an entity type.",
      "Revenue Stream(.name) is an entity type.",
      "Amount is a value type.", "  The data type of Amount is decimal.", "",
      "Organization generates Revenue Stream.",
      "Revenue Stream has Amount.", "  Each Revenue Stream has at most one Amount.",
      "Organization has revenue- Amount. +", "  Each Organization has at most one revenue- Amount.", "",
      "+ Organization has revenue- Amount if revenue- Amount is the sum of Amount where Organization generates some Revenue Stream and that Revenue Stream has some Amount.", "",
      "Organization 'o1' generates Revenue Stream 'r1'.", "Organization 'o1' generates Revenue Stream 'r2'.",
      "Revenue Stream 'r1' has Amount 0.10.", "Revenue Stream 'r2' has Amount 0.20.", "",
    ].join("\n");
    const rows2 = [];
    for (const s of Ev("read:sentences", sumText)) rows2.push(Ev("read:row_of", s));
    const schema2 = Ev("read:schema_of", rows2);
    const pops2 = schema2.find((c) => String(c[0]) === "state:fts")[1].map((d) => [d[0], d[4].flat(1).filter((r) => Array.isArray(r) && r.length)]);
    const rules2 = Ev("read:state_rules", Ev("read:x_full", Ev("read:x_of", rows2))).map((r) => [r[0], r[2]]);
    expect(rules2.length).toBe(1);
    const revenue = (Ev("derive", [rules2, pops2]).find((e) => String(e[0]) === "OrganizationHasRevenueAmount") || ["", []])[1];
    expect(revenue.map((r) => [r[0], T(r[1])])).toEqual([["o1", "0.3"]]);
  }, 300_000);

  test("a decimal is held as a decimal: read, typed, written as its text and read back", () => {
    const D = (x) => Ev("value:as_dec", x), T = (x) => Ev("value:text", x);
    expect(D("12.340")).toEqual(["decimal", 1234, 2]);
    expect(D("-0.5")).toEqual(["decimal", -5, 1]);
    expect(D(7)).toEqual(["decimal", 7, 0]);
    expect(D("0.000")).toEqual(["decimal", 0, 0]);
    expect(D("1e-7")).toEqual(["decimal", 1, 7]);
    expect(D("1.5e+3")).toEqual(["decimal", 1500, 0]);
    expect(D("12.")).toBe("12.");   // a point with no digit after it spells nothing
    expect(D("free")).toBe("free");
    expect(D(["decimal", 5, 1])).toEqual(["decimal", 5, 1]);
    expect(T(["decimal", 1234, 2])).toBe("12.34");
    expect(T(["decimal", -5, 1])).toBe("-0.5");
    expect(T(["decimal", 1, 7])).toBe("0.0000001");
    expect(T(["decimal", 5, 3])).toBe("0.005");
    expect(T(7)).toBe(7);
    expect(T("x")).toBe("x");
    // a row that is not a decimal is not read as one: the tag and two numbers make one
    expect(Ev("dec:is", ["decimal", "2", "1"])).toBe("F");
    // the reader
    const text = [
      "Widget(.name) is an entity type.",
      "Share is a value type.",
      "  The data type of Share is decimal.",
      "Price is a value type.",
      "  The data type of Price is money.", "",
      "Widget has Share.",
      "  Each Widget has at most one Share.",
      "Widget has Price.",
      "  Each Widget has at most one Price.", "",
      "Widget 'w1' has Share 0.250.",
      "Widget 'w1' has Price 49.00.", "",
    ].join("\n");
    const rows = [];
    for (const s of Ev("read:sentences", text)) rows.push(Ev("read:row_of", s));
    const cells = new Map(Ev("read:schema_of", rows).map((c) => [String(c[0]), c[1]]));
    const pop = (n) => cells.get("state:fts").find((d) => d[0] === n)[4].flat(1);
    expect(pop("WidgetHasShare")).toEqual([["w1", ["decimal", 25, 2]]]);
    expect(pop("WidgetHasPrice")).toEqual([["w1", ["decimal", 49, 0]]]);
    expect(cells.get("state:otpops").find((e) => e[0] === "Share")[1].flat(1)).toEqual([["decimal", 25, 2]]);
    // what the tables answer, typed; ObjectTypeHasMinimum is the base module's decimal
    expect(Ev("value:typed_pairs", [[["ObjectTypeHasMinimum", ["X", "0.50"]]], CELLS])).toEqual([["ObjectTypeHasMinimum", ["X", ["decimal", 5, 1]]]]);
    // JSON prints a decimal as a number, the DEF and its twin alike; a template fills it as its text
    const rowsD = [["w1", ["decimal", 25, 2]], ["w2", "text"]];
    expect(Ev("render:json", rowsD)).toBe('[["w1",0.25],["w2","text"]]');
    expect(Ev(globalThis.AREST.DEFS.get("render:json"), rowsD)).toBe('[["w1",0.25],["w2","text"]]');
    expect(Ev("tpl:str", ["decimal", 25, 2])).toBe("0.25");
    // the entity view shows Minimum as a column control holding the decimal (2026-10-01: an entity
    // displays its column data as controls, in column order), and does not throw; render:json, the
    // served view`s spelling, prints that value as 0.5
    const posted = Ev("main:api", [CELLS, "POST", "ObjectTypeHasMinimum", "", ["Arity", "0.50"]]);
    expect(Number(posted[1])).toBeLessThan(400);
    const view = Ev("render:json", Ev("ui:route", [posted[2], ["Function", "Arity"], [], []]));
    expect(view).toMatch(/"ObjectTypeHasMinimum","[^"]*",\[[^\]]*\],0\.5\]/);
    // written into a store and read back, in processes of their own, the way a server writes
    const dir = mkdtempSync(join(tmpdir(), "arest-dec-"));
    const mod = join(import.meta.dir, "cases.g.js");
    const path = join(dir, "store.db");
    try {
      { const db = new Database(path); makeTables(db); globalThis.AREST.writeMetaschema(db);
        db.run("create table _composition (hash text)"); db.prepare("insert into _composition values(?)").run(globalThis.AREST.composition);
        db.run("pragma wal_checkpoint(TRUNCATE)"); db.close(); }
      const driver = join(dir, "drive.mjs");
      writeFileSync(driver, [
        "await import(process.env.MODULE);",
        "const { Ev, CELLS, popSnapshot, adoptStore, emitToDb, closeStore } = globalThis.AREST;",
        "const say = (k, v) => console.log(k + '=' + JSON.stringify(v));",
        "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore(); say('made', emitToDb(b, CELLS)); process.exit(0); }",
        "if (process.env.WRITE) {",
        "  const before = popSnapshot(CELLS), prior = CELLS.slice();",
        "  const out = Ev('main:api', [CELLS, 'POST', 'ObjectTypeHasMinimum', '', ['Arity', '0.50']]);",
        "  if (out.length > 2 && Number(out[1]) < 400) { adoptStore(out[2]); say('emitted', emitToDb(before, CELLS, prior)); }",
        "  say('status', Number(out[1])); say('body', String(out[0]).slice(0, 400));",
        "  process.exit(0);",
        "}",
        "say('rows', Ev('system:pop_rows', ['ObjectTypeHasMinimum', CELLS]));",
        "say('json', Ev('render:json', Ev('system:pop_rows', ['ObjectTypeHasMinimum', CELLS])));",
      ].join("\n"));
      const run = (extra) => {
        const p = Bun.spawnSync(["bun", driver], { env: { ...process.env, MODULE: pathToFileURL(mod).href, AREST_STORE_DB: path, ...extra }, stdout: "pipe", stderr: "pipe" });
        const got = { out: p.stdout.toString() + p.stderr.toString() };
        for (const line of p.stdout.toString().split("\n")) { const k = line.indexOf("="); if (k > 0) try { got[line.slice(0, k)] = JSON.parse(line.slice(k + 1)); } catch { /* not ours */ } }
        return got;
      };
      const made = run({ MAKE: "1" });
      expect(made.made, made.out).toBeGreaterThan(0);
      const wrote = run({ WRITE: "1" });
      expect(wrote.status, wrote.out).toBeLessThan(400);
      expect(wrote.emitted, wrote.out).toBeGreaterThan(0);
      const read = run({});
      expect(read.rows, read.out).toEqual([["Arity", ["decimal", 5, 1]]]);
      expect(read.json).toBe('[["Arity",0.5]]');
      // the cell holds the number sqlite made of the text, 0.5, and never a sequence spelled out
      const db = new Database(path, { readonly: true });
      const at = db.query("select tab, col from _metaschema where ft = 'ObjectTypeHasMinimum'").get();
      const cell = db.query('select "' + at.col + '" v from "' + at.tab + '" where "' + at.col + '" is not null').all().map((r) => r.v);
      db.close();
      expect(cell).toEqual([0.5]);
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
    }
  }, 300_000);
});
// ---- THE JUDGE'S VERDICT LANDS AS A VIOLATION ROW (#122 item 7) ----------
//
// llm:validate_judge is the fourth driven seam and yields validate's own
// violation-list; the three CSDP seams land their answers as <fact type,
// players> claims, and a violation row is not a claim, so `drive` answered
// [] for a judged verdict and nothing was ever written (measured at HEAD,
// 2026-09-21). A judged rule's violation is RECORDED (support's
// state-law-wiring.md): the row lands as a Violation whose id is minted from
// its content the way a bound child's is, whose Timestamp is the clock when
// `Operation 'clock' is registered` and the request's own time otherwise, and
// whose Text is the judge's reason or, for a 3-slot row, the Constraint's own
// Text. The rows go through the entity door, so the mandatory gate holds them.
const fromJsonRow = (x) => Array.isArray(x) ? x.map(fromJsonRow)
  : (x !== null && typeof x === "object") ? Object.keys(x).map((k) => [k, fromJsonRow(x[k])])
  : (typeof x === "number" ? x : String(x));

test("llm:validate_judge's verdict lands as a Violation row, stamped by the registered clock", () => {
  const { adoptStore } = globalThis.AREST;
  const keep = CELLS.slice();
  const DEO = String(Ev("system:pop_rows", ["ConstraintHasModalityOfModalityType", CELLS]).find((r) => String(r[1]) === "Deontic")[0]);
  const RULE = "A Support Response must not misrepresent the customer's rights under state law.";
  const AT = "2026-09-21T00:00:00.000Z";
  const VID = "Violation:ViolationIsOfConstraint=" + DEO + "|ViolationIsTriggeredByObjectTypeInstance=msg-1";
  const judged = (facts) => fromJsonRow({ operation: "llm:validate_judge", subject: DEO, at: AT, model: "m",
    definition: "agentdef-llm-validate-judge", agent: "agent-test", completion: "cmp-test-1", claim: "claim-cmp-test-1",
    prompt: "p", input: "i", output: JSON.stringify(facts), facts });
  const of = (pairs, ft) => pairs.filter((p) => String(p[0]) === ft).map((p) => p[1].map(String));
  try {
    // a deontic constraint of the base, given a Text, as support's twelve have
    adoptStore([["CELL", "ConstraintHasText", [[DEO, RULE]]]].concat(CELLS));

    // the verdict, in validate's shape plus the judge's reason
    const pairs = Ev("drive", [judged([[DEO, "deontic", "msg-1", "It tells the customer arbitration is mandatory."]]), CELLS]);
    expect(of(pairs, "ViolationIsOfConstraint")).toEqual([[VID, DEO]]);
    expect(of(pairs, "ViolationHasText")).toEqual([[VID, "It tells the customer arbitration is mandatory."]]);
    expect(of(pairs, "ViolationHasSeverity")).toEqual([[VID, "warning"]]);
    expect(of(pairs, "ViolationIsTriggeredByObjectTypeInstance")).toEqual([[VID, "msg-1"]]);
    // clock is registered on the base (resolution.md), so the stamp is the
    // clock's and not the request's
    const [[, at]] = of(pairs, "ViolationOccurredAtTimestamp");
    expect(at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
    expect(at).not.toBe(AT);

    // validate's row verbatim, three slots: the Text is the Constraint's own
    const three = Ev("drive", [judged([[DEO, "deontic", "msg-2"]]), CELLS]);
    expect(of(three, "ViolationHasText")).toEqual([["Violation:ViolationIsOfConstraint=" + DEO + "|ViolationIsTriggeredByObjectTypeInstance=msg-2", RULE]]);

    // the CSDP seams still land claims
    const claims = Ev("drive", [judged([{ factType: "FunctionBelongsToDomain", players: ["f-test", "d-test"] }]).map((p) => (String(p[0]) === "operation" ? ["operation", "csdp:elementarize"] : p)), CELLS]);
    expect(of(claims, "FunctionBelongsToDomain")).toEqual([["f-test", "d-test"]]);

    // and the rows go in through the entity door mcp:entities names for them
    const ents = Ev("mcp:entities", CELLS);
    const table = ents.find((e) => (e[2] || []).some((f) => String(f[0]) === "ViolationIsOfConstraint"));
    expect(table).toBeDefined();
    const fact = [VID];
    for (const p of pairs.filter((p) => /^Violation/.test(String(p[0])))) fact.push(String(p[0]), String(p[1][1]));
    const out = Ev("mcp:call", ["POST", String(table[1]), "", fact, CELLS]);
    expect(Number(out[1])).toBeLessThan(400);
    adoptStore(out[2]);
    expect(Ev("system:pop_rows", ["ViolationIsOfConstraint", CELLS]).map((r) => r.map(String))).toEqual([[VID, DEO]]);

    // when no host registers a clock, the time the request provides is used
    const reg = Ev("system:pop_rows", ["OperationIsRegistered", CELLS]).filter((r) => String(r[0]) !== "clock");
    adoptStore([["CELL", "OperationIsRegistered", reg]].concat(CELLS));
    expect(String(Ev("drive:stamp", [judged([]), CELLS]))).toBe(AT);
  } finally {
    adoptStore(keep);
  }
}, 120_000);

// ---- AND A DRIVER'S ANSWER IS ONE WRITE (2026-09-30) -----------------------
//
// The seam gathered an answer's facts onto the tables mcp:entities names and posted each entity
// whole, in the order the answer listed them, while a fact type that is nobody's column went as a
// POST of its own. So an answer that named a new entity first in a spanning fact type posted that
// fact before the entity had its mandatory roles, and it was refused as a partial entity: claude's
// `Correction is given by User` for c6. Now the answer is one assert. The probe answers
// csdp:elementarize over the base with a Domain Change that proposes a Function (a table of its
// own) listed before the Rationale and Domain it must have, and all three land.
test("a driver's answer is written as one step, so an entity it names first in a table of its own is not posted partial", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arest-seam-"));
  let server = null;
  try {
    const env = { ...process.env, AREST_CARRIERS: join(import.meta.dir, "..", "carriers", "base"), AREST_OUT_DIR: dir };
    delete env.AREST_INSTRUMENTED;
    const b = Bun.spawnSync(["bun", "build.js", "mcp"], { cwd: import.meta.dir, env, stdout: "pipe", stderr: "pipe" });
    expect(b.exitCode, b.stdout.toString() + b.stderr.toString()).toBe(0);
    const run = { ...process.env };
    delete run.AREST_STORE_DB;
    server = Bun.spawn(["bun", join(dir, "mcp.g.js")], { env: run, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const pending = new Map();
    (async () => {
      let buf = "";
      for await (const chunk of server.stdout) {
        buf += new TextDecoder().decode(chunk);
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("{")) continue;
          try { const m = JSON.parse(line); if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch { /* not a reply */ }
        }
      }
    })();
    let next = 0;
    const send = (method, params) => new Promise((resolve) => {
      const id = ++next;
      pending.set(id, resolve);
      server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      server.stdin.flush();
    });
    const text = (r) => ((r.result && r.result.content) || []).map((x) => x.text).join("") + (r.error ? r.error.message : "");
    await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "cases", version: "1" } });
    const answer = [
      { factType: "DomainChangeProposesFunction", players: ["dc-seam", "DomainChangeHasRationale"] },
      { factType: "DomainChangeHasRationale", players: ["dc-seam", "an answer is one write"] },
      { factType: "DomainChangeTargetsDomain", players: ["dc-seam", "evolution"] },
    ];
    const r = await send("tools/call", { name: "csdp_elementarize", arguments: { args: ["dc-seam", answer] } });
    const said = text(r);
    expect(said).toContain("wrote the answer as one step, 3 facts");
    const rows = async (ft) => JSON.parse(text(await send("tools/call", { name: ft, arguments: { method: "GET" } })))
      .find((p) => p[0] === "rows")[1].filter((row) => row[0] === "dc-seam");
    expect(await rows("DomainChangeProposesFunction")).toEqual([["dc-seam", "DomainChangeHasRationale"]]);
    expect(await rows("DomainChangeHasRationale")).toEqual([["dc-seam", "an answer is one write"]]);
    expect(await rows("DomainChangeTargetsDomain")).toEqual([["dc-seam", "evolution"]]);
  } finally {
    if (server) server.kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 120_000);
// ---- A RECORDED VIOLATION IS A VERDICT (#122 item 7, the read half) ------
//
// The landing half writes a judge's verdict as a Violation -- is of
// Constraint, is triggered by Object Type Instance, has Severity, has Text,
// occurred at Timestamp -- and nothing read one back. Measured at HEAD with
// that row in the store: ui:violations answered its 152 rows unchanged and
// not one of them the constraint's, synth:awaiting still named the
// constraint, and synthesize still counted it unchecked. cmd:rec_viols is
// the violation-list's fourth arm: one row <the Constraint, the family, the
// instance> per recorded Violation, exactly the shape cmd:dv_prohib emits,
// so a consumer cannot tell a judged verdict from a computed one except by
// what stands in slot 1. The family is judge:severity read backwards --
// warning is deontic, anything else alethic, which is the word the commit
// gate refuses on.
test("a recorded Violation is a verdict, and its constraint is checked rather than awaiting", () => {
  const { adoptStore } = globalThis.AREST;
  const keep = CELLS.slice();
  const DEO = String(Ev("system:pop_rows", ["ConstraintHasModalityOfModalityType", CELLS]).find((r) => String(r[1]) === "Deontic")[0]);
  const INST = "msg-1";
  const VID = "Violation:ViolationIsOfConstraint=" + DEO + "|ViolationIsTriggeredByObjectTypeInstance=" + INST;
  const AT = "2026-09-21T00:00:00.000Z";
  const shown = (v) => v.map((r) => (Array.isArray(r) ? r.map(String) : String(r)));
  const put = (pairs) => adoptStore(pairs.map(([ft, r]) => ["CELL", ft, r]).concat(CELLS));
  try {
    // a deontic constraint of the base that awaits a decider, as support's twelve do
    put([["ConstraintAwaitsADecider", [[DEO]]]]);
    expect(shown(Ev("synth:awaiting", CELLS))).toEqual([DEO]);
    const before = Ev("ui:violations", CELLS);
    expect(before.filter((r) => String(r[0]) === DEO)).toEqual([]);
    expect(shown(Ev("synthesize", [DEO, CELLS])[2])).toContain(DEO);

    // the verdict a judge recorded: the five rows the landing half writes
    put([["ViolationIsOfConstraint", [[VID, DEO]]],
      ["ViolationIsTriggeredByObjectTypeInstance", [[VID, INST]]],
      ["ViolationHasSeverity", [[VID, "warning"]]],
      ["ViolationHasText", [[VID, "It tells the customer arbitration is mandatory."]]],
      ["ViolationOccurredAtTimestamp", [[VID, AT]]]]);

    // it is a row of the violation-list now, in a computed deontic row's shape
    const after = Ev("ui:violations", CELLS);
    expect(shown(after).filter((r) => r[0] === DEO)).toEqual([[DEO, "deontic", INST]]);
    expect(after.length).toBe(before.length + 1);
    expect(shown(Ev("cmd:rec_viols", CELLS))).toEqual([[DEO, "deontic", INST]]);
    // a warning is deontic, so the commit gate warns and does not refuse
    expect(shown(Ev("main:deontic_of", after)).filter((r) => r[0] === DEO)).toEqual([[DEO, "deontic", INST]]);
    expect(Ev("main:alethic_of", after).filter((r) => String(r[0]) === DEO)).toEqual([]);

    // and the constraint is CHECKED, not awaiting
    const sy = Ev("synthesize", [DEO, CELLS]);
    expect(shown(sy[1]).filter((r) => r[0] === DEO)).toEqual([[DEO, "deontic", INST]]);
    expect(shown(sy[2])).not.toContain(DEO);
    expect(Ev("synth:awaiting", CELLS)).toEqual([]);

    // the Severity is the family read backwards: error is no deontic verdict,
    // and alethic is what the gate refuses on
    put([["ViolationHasSeverity", [[VID, "error"]]]]);
    expect(shown(Ev("cmd:rec_viols", CELLS))).toEqual([[DEO, "alethic", INST]]);
    expect(shown(Ev("main:alethic_of", Ev("ui:violations", CELLS))).filter((r) => r[0] === DEO)).toEqual([[DEO, "alethic", INST]]);

    // a Violation naming no offender is no verdict, and neither is one of no Constraint
    put([["ViolationHasSeverity", [[VID, "warning"]]], ["ViolationIsTriggeredByObjectTypeInstance", []]]);
    expect(Ev("cmd:rec_viols", CELLS)).toEqual([]);
    put([["ViolationIsTriggeredByObjectTypeInstance", [[VID, INST]]], ["ViolationIsOfConstraint", []]]);
    expect(Ev("cmd:rec_viols", CELLS)).toEqual([]);
  } finally {
    adoptStore(keep);
  }
}, 120_000);
// ---- AND A MANDATORY WHOSE FACT TYPE THE TOOL LIST CANNOT REACH ----------
//
// cmd:mv_pos reads the object type PLAYING the mandatory position by applying
// that position to solve:assoc of the fact type name against mcp:tools, and
// solve:assoc answers PHI for a name it does not hold: the position is then a
// selector over an empty player list. Measured at HEAD on support.auto.dev's
// store, walking all 1,479 descriptors: EXACTLY ONE threw -- the fully derived
// MeterUsageReportHasIdempotencyKey, whose reading declares `Each Meter Usage
// Report has exactly one Idempotency Key.` and whose starred fact type is no
// part of the stored schema -- and cmd:mand_viols, and with it every arm of
// ui:violations, died as `selector 1 out of range 0`, so the app could not say
// what a row violates and no create could be judged. The base metamodel never
// reaches it: all 88 of its descriptors carrying a mandatory are names
// mcp:tools answers, which is the last two assertions here and is why the
// carrier cannot move. The fixture is the defect's own shape and not the
// store: the player extent is NOT empty, so a guard that read the population
// instead of the player would pass this and still throw there. Failing at
// d99bf996.
test("a mandatory whose fact type the tool list cannot reach is no violation, and one it can reach is unchanged", () => {
  // the descriptor support throws on, byte for byte
  const DERIVED = ["MeterUsageReportHasIdempotencyKey", ["Meter Usage Report", "Idempotency Key"], [[1]], [1], []];
  const VIOLATES = ["WidgetHasColor", ["Widget", "Color"], [[1]], [1], [["w1", "red"]]];
  const HELD = ["GadgetHasSize", ["Gadget", "Size"], [[1]], [1], [["g1", "big"]]];
  const cells = [
    ["CELL", "state:fts", [[DERIVED, VIOLATES, HELD]]],
    ["CELL", "state:declared", [[["WidgetHasColor", ["Widget", "Color"]], ["GadgetHasSize", ["Gadget", "Size"]]]]],
    ["CELL", "state:otpops", [[["Meter Usage Report", [["mur1", "mur2"]]],
      ["Widget", [["w1", "w2"]]], ["Gadget", [["g1"]]]]]],
    ["CELL", "WidgetHasColor", [["w1", "red"]]],
    ["CELL", "GadgetHasSize", [["g1", "big"]]],
  ].concat(CELLS);
  const shown = (v) => v.map((r) => (Array.isArray(r) ? r.map(String) : String(r)));

  // the shape: no player list to be had, an empty population, and two instances
  // of the player type that a reachable fact type would report as violations
  expect(Ev("solve:assoc", ["MeterUsageReportHasIdempotencyKey", Ev("mcp:tools", cells)])).toEqual([]);
  expect(shown(Ev("ui:ids", [cells, "Meter Usage Report"]))).toEqual(["mur1", "mur2"]);
  expect(Ev("system:pop_rows", ["MeterUsageReportHasIdempotencyKey", cells])).toEqual([]);

  // it is no violation, and the two the tool list reaches answer as they did
  expect(Ev("cmd:mv_desc", [DERIVED, cells])).toEqual([]);
  expect(shown(Ev("cmd:mv_desc", [VIOLATES, cells]))).toEqual([["WidgetHasColor", "mandatory", "w2"]]);
  expect(Ev("cmd:mv_desc", [HELD, cells])).toEqual([]);
  expect(shown(Ev("cmd:mand_viols", cells))).toEqual([["WidgetHasColor", "mandatory", "w2"]]);

  // and the guard fires nowhere on the base, so the carrier cannot move
  const reach = new Set(Ev("mcp:tools", CELLS).map((r) => String(r[0])));
  const mand = Ev("store:fts", CELLS).filter((d) => Array.isArray(d[3]) && d[3].length > 0);
  expect(mand.length).toBeGreaterThan(0);
  expect(mand.filter((d) => !reach.has(String(d[0]))).map((d) => String(d[0]))).toEqual([]);
  expect(Ev("cmd:mand_viols", CELLS)).toEqual([]);
}, 120_000);
// ---- A REFLECTED POPULATION KEEPS THE ROWS THE STORE ASSERTS (#122 item 1) ----
//
// loadReflected installs lambda's reflection as the cell of that name, and the
// cell shadowed the rows the store ASSERTS for the same fact type: support's
// twelve state-law Constraints lost their modality, type and span at every
// boot, and emitToDb then wrote the tables without them (measured 2026-09-21:
// the fresh build carries 12 Deontic Function rows and 12 spans, the same
// build booted once 21 and 5,183, none of them the twelve). reflect:cells is
// now the union: the reflection, then the source's rows on a key the
// reflection does not answer.
test("a reflected population keeps the rows the store asserts on a key the reflection does not answer", () => {
  const { adoptStore } = globalThis.AREST;
  const keep = CELLS.slice();
  const MOD = "ConstraintHasModalityOfModalityType", TYPE = "ConstraintIsOfConstraintType", SPAN = "ConstraintSpan";
  const rows = (ft) => Ev("system:pop_rows", [ft, CELLS]).map((r) => r.map(String));
  const ROLE = String(Ev("system:pop_rows", ["FactTypeHasRole", CELLS])[0][1]);
  const DEO = String(rows(MOD).find((r) => r[1] === "Deontic")[0]);
  const before = { c: Ev("reflect:constraints", CELLS).length, s: Ev("reflect:spans", CELLS).length, mod: rows(MOD).length, type: rows(TYPE).length, span: rows(SPAN).length };
  try {
    // a Constraint the readings assert, as support's twelve are, adopted the
    // way loadStoreDb adopts a table's rows; adoptStore reflects again.
    // AND THE TABLE STILL HOLDS THE ROWS IT HELD (2026-10-02). The table adopted here was the
    // one new row alone, which was all the base store asserted until the metamodel began to
    // declare Constraints as instance facts (2026-09-30 on: the five judged rules of cb0c4e59,
    // then the decided ones of a5dda86a and after). Fourteen are asserted so on the base, a
    // modality, a type and a span each, on keys the reflection does not answer, and a table of
    // the one row dropped them: each cell came back 14 short of before + 1 (759, 759, 1000
    // for 773, 773, 1014). A table holds every row the store wrote, so the fixture adopts the
    // population the cell answers with the new row beside it.
    const plus = (ft, row) => [ft, Ev("system:pop_rows", [ft, CELLS]).concat([row])];
    adoptStore(Ev("store:src_all", [[plus(MOD, ["x-asserted", "Deontic"]), plus(TYPE, ["x-asserted", "DF_owa"]), plus(SPAN, ["x-asserted", ROLE])], CELLS]));
    expect(rows(MOD)).toContainEqual(["x-asserted", "Deontic"]);
    expect(rows(TYPE)).toContainEqual(["x-asserted", "DF_owa"]);
    expect(rows(SPAN)).toContainEqual(["x-asserted", ROLE]);
    // the reflection itself is what it was, and each cell is it plus the one row
    expect(Ev("reflect:constraints", CELLS).length).toBe(before.c);
    expect(Ev("reflect:spans", CELLS).length).toBe(before.s);
    expect([rows(MOD).length, rows(TYPE).length, rows(SPAN).length]).toEqual([before.mod + 1, before.type + 1, before.span + 1]);
    // the write-back projects it: emitToDb adopts the cells into the source and reads rmap:proj_rows
    adoptStore(Ev("store:src_all", [[MOD, TYPE, SPAN].map((ft) => [ft, Ev("system:pop_rows", [ft, CELLS])]), CELLS]));
    const names = Ev("rmap:proj_colnames", ["Function", CELLS]).map(String);
    const row = Ev("rmap:proj_rows", ["Function", CELLS]).find((r) => String(r[0]) === "x-asserted");
    expect(row).toBeDefined();
    expect(String(row[names.indexOf("constraintModalityType")])).toBe("Deontic");
    expect(String(row[names.indexOf("constraintTypeId")])).toBe("DF_owa");
    expect(Ev("rmap:proj_rows", [SPAN, CELLS]).some((r) => r.map(String).includes("x-asserted"))).toBe(true);
    // and the reflection answers the keys it has: a source row on a reflected key does not override it
    adoptStore(Ev("store:src_all", [[[MOD, [[DEO, "Alethic"], ["x-asserted", "Deontic"]]]], CELLS]));
    expect(rows(MOD).filter((r) => r[0] === DEO)).toEqual([[DEO, "Deontic"]]);
    expect(rows(MOD)).toContainEqual(["x-asserted", "Deontic"]);
  } finally {
    adoptStore(keep);
  }
}, 120_000);

// THE STATE PHASE INDEXES ITS RECORDS; IT DOES NOT SCAN THEM PER FACT TYPE
// (#123, 2026-09-21). read:x_of computes read:nest_names once and carries it as
// the parse state's 7th component (after the rows apndr appends), where
// read:nested_names, read:implied_nests, read:types_named and read:type_rows
// used to recompute it -- three to six full scans of the records per fact
// record through read:fact_row. read:derived_mode and read:deontic_ucs_of
// answer `the records named n` through csdp:matches over the one records list
// (indexed once by the host) instead of a flatten of every record per call.
// Pinned on a text with a nesting, a fully-derived reading, a deontic
// uniqueness and a population row; the module built from HEAD answers the same
// (probe.mjs, both modules), and the metamodel's and the templates' design
// states are byte-identical.
describe("the reader's state phase indexes its records instead of scanning them per fact type", () => {
  const TEXT = [
    "Name is a value type.",
    "Person(.Name) is an entity type.",
    "Company(.Name) is an entity type.",
    "Person works for Company.",
    "It is obligatory that each Person works for at most one Company.",
    "Person leads Company. *",
    "Employment objectifies \"Person works for Company\".",
    "Person 'Ann' works for Company 'Acme'.",
  ].join("\n");
  const rows = () => Ev("read:sentences", TEXT).map((s) => Ev("read:row_of", s));

  test("read:x_of carries the nest names once, equal to read:nest_names over the state", () => {
    const X = Ev("read:x_of", rows());
    expect(X[0].length).toBe(7);
    expect(X[0][6]).toEqual(["Employment"]);
    expect(X[0][6]).toEqual(Ev("read:nest_names", X));
  }, 300_000);

  test("read:derived_mode and read:deontic_ucs_of answer the records named n", () => {
    const X = Ev("read:x_of", rows());
    const recs = X[0][3];
    expect(Ev("read:derived_mode", ["PersonLeadsCompany", X])).toBe("full");
    expect(Ev("read:derived_mode", ["Employment", X])).toBe("");
    expect(Ev("read:derived_mode", ["NoSuchFactType", X])).toBe("");
    expect(Ev("read:deontic_ucs_of", ["PersonWorksForCompany", recs])).toEqual([[1]]);
    expect(Ev("read:deontic_ucs_of", ["Employment", recs])).toEqual([]);
    const F = Ev("read:x_full", X);
    expect(Ev("read:state_derived", F)).toEqual([["PersonLeadsCompany", "full"]]);
    // `Person leads Company. *` is stored now (2026-09-21): a fully-derived
    // binary with the spanning uniqueness nests as any many-to-many does, and
    // its descriptor stands in state:fts with an empty population; the
    // objectification Employment is still read first.
    expect(Ev("read:state_nestings", F)).toEqual([["Employment", "Employment"], ["PersonLeadsCompany", "PersonLeadsCompany"]]);
    expect(Ev("read:state_fts", F).map((r) => r[0])).toEqual(["Employment", "PersonLeadsCompany"]);
  }, 300_000);
});
// ---- THE META-TYPES HAVE EXTENTS, NOT ONLY LINKS (#122 item 2) ----
//
// The reflection answered the LINKS between the meta-types -- a fact type has
// a role, a role is played by an object type and used in a reading -- and the
// meta-types those links run between had no population of their own. Measured
// on the base schema before this: ObjectTypeInstanceIsInstanceOfObjectType
// claimed 142 of the 506 fact types and not one of the 993 roles, so every role
// id in FactTypeHasRole, in ObjectTypePlaysRole and in all 997 ConstraintSpan
// rows was nobody's instance and `Each Fact Type has some Role` was satisfied by
// link rows over ids no object type claimed. The extents are the same reflection
// one meta-type up, with the ids the links already use.
test("every fact type and role a reflected link names is an instance of its object type", () => {
  const rows = (ft) => Ev("system:pop_rows", [ft, CELLS]).map((r) => r.map(String));
  const claims = new Map();
  for (const [id, ot] of rows("ObjectTypeInstanceIsInstanceOfObjectType")) {
    if (!claims.has(id)) claims.set(id, new Set());
    claims.get(id).add(ot);
  }
  const isA = (id, ot) => claims.has(id) && claims.get(id).has(ot);
  const unclaimed = (pairs) => pairs.filter(([id, ot]) => !isA(id, ot)).slice(0, 3);
  // every id a link population names is an instance of the type that link says it is
  expect(unclaimed(rows("FactTypeHasRole").map(([ft]) => [ft, "Fact Type"]))).toEqual([]);
  expect(unclaimed(rows("FactTypeHasRole").map(([, role]) => [role, "Role"]))).toEqual([]);
  expect(unclaimed(rows("FactTypeHasReading").map(([ft]) => [ft, "Fact Type"]))).toEqual([]);
  expect(unclaimed(rows("ObjectTypePlaysRole").map(([, role]) => [role, "Role"]))).toEqual([]);
  expect(unclaimed(rows("RoleIsUsedInReading").map(([role]) => [role, "Role"]))).toEqual([]);
  expect(unclaimed(rows("ConstraintSpan").map(([, role]) => [role, "Role"]))).toEqual([]);
  // the ids are the ones the links already use, and membership is transitive
  // the way read:up_rows files a build-produced instance -- under its type and
  // every ancestor
  const FT = rows("FactTypeHasRole")[0][0];
  expect(["Fact Type", "Event Type", "Function"].filter((t) => !isA(FT, t))).toEqual([]);
  const roles = rows("FactTypeHasRole").filter(([ft]) => ft === FT).map(([, role]) => role);
  expect(roles).toEqual(roles.map((unused, i) => FT + "." + (i + 1)));
  // every reflected instance has its reference, which is its id
  const refs = new Map(rows("ObjectTypeInstanceHasReference"));
  expect([...claims.keys()].filter((id) => refs.get(id) !== id).slice(0, 3)).toEqual([]);
  // EVERY REFLECTED ROW IS FLAT. The write-back adopts the cells into the
  // source and store:fix_desc unfolds a descriptor's rows (theta:unfold_rows),
  // so a column holding a tuple is a population the store cannot hold at all:
  // it throws `expected sequence, got atom` out of theta:flatten and the
  // closure is computed but not stored, which is every durability test.
  for (const cell of Ev("reflect:cells", CELLS)) {
    const nested = cell[1].filter((r) => r.some((c) => Array.isArray(c))).length;
    expect([String(cell[0]), nested]).toEqual([String(cell[0]), 0]);
  }
  // AND A READING IS NOT YET A POPULATION, because being one has a price the
  // schema cannot pay: loadStoreDb files the instance rows a write-back
  // leaves into state:otpops, which is what ui:ids reads, so `Each Reading has
  // exactly one Text` and `Each Reading is used by exactly one Predicate` bind
  // from the second boot on -- measured 104 and 506 alethic mandatory
  // violations, and the create then answers 409. This is the price, stated:
  // reflect Reading only when both can be answered.
  const readings = new Set(rows("FactTypeHasReading").map(([, rd]) => rd));
  // AND THE PRICE IS PER INSTANCE, WHICH IS WHAT THE TWO MANDATORIES SAY.
  // `Each Reading has exactly one Text` and `Each Reading is used by exactly
  // one Predicate` bind on a Reading that IS an Object Type Instance; a
  // reading reached only as a link target is nobody's instance and neither
  // binds on it. What stood here demanded that if ANY Reading were an
  // instance then ALL readings carry a text and a predicate, which was the
  // right warning while the REFLECTION was the only thing that could file
  // one -- it would have filed all 541 at once, and the measurement behind
  // the warning was 104 and 506 alethic violations on the second boot.
  // core.md's alternate reading (2026-09-22) files exactly ONE, by instance
  // fact, and gives it both: two checks into the same store answer
  // cmd:mand_viols 0 and 0, and ui:violations 30 then 29, all deontic. So the
  // demand is made of the instances, where it bites, and it still fails the
  // moment a reading is registered without a text or without a predicate.
  const asInstance = new Set(rows("ObjectTypeInstanceIsInstanceOfObjectType")
    .filter(([, ot]) => ot === "Reading").map(([id]) => id));
  const hasText = new Set(rows("ReadingHasText").map(([rd]) => rd));
  const hasPredicate = new Set(rows("ReadingIsUsedByPredicate").map(([rd]) => rd));
  expect([...asInstance].filter((rd) => !hasText.has(rd) || !hasPredicate.has(rd)).sort()).toEqual([]);
  // and the extent is still SHORT of the readings, which is the price still
  // unpaid: one of 542 is an instance and the rest are nobody's, the same gap
  // Role and Fact Type had before they were given extents. When this line
  // fails, Reading has become an extent and the warning above is spent.
  expect(asInstance.size).toBeLessThan(readings.size);
  // the cell is still the union, so what the build filed and the reflection
  // does not answer is still there
  expect(rows("ObjectTypeInstanceIsInstanceOfObjectType").some(([, ot]) => ot === "Subtype Fact")).toBe(true);
}, 120_000);

// ---- IS A READING'S OWN TEXT IN THE STORE, OR ONLY ITS NAME? --------------
//
// Sam, 2026-09-22, on the note one commit below this one: `Readings have no
// stored text` -- `Oof that's bad, we need to store that under Reading has
// Text`. It was 0 rows of 541 readings in every store ever built, so a reading
// survived as a fact type NAME and nothing else.
//
// A NAME IS MINTED FROM A READING, which makes it look like a lossless encoding
// of one. It is not, and this measures exactly where it leaks rather than
// asserting that it does: put the players back where the placeholders are, drop
// the spaces, and a name that spells its reading comes back character for
// character. 282 of the 289 declared fact types do. The seven below do not --
// three whose design carries a separate name (ConstraintSpan, API, RoleInstance,
// where the name is not the sentence at all; EventCausedTransition was the
// fourth until its objectification came off on 2026-09-23, and its name is its
// reading's now) and four
// whose reading carries the qualifier hyphen a name cannot hold. Their text was
// unrecoverable from anything any store held.
//
// THE POPULATION IS THE THREE ARMS THAT CARRY TOKENS AND NOT THE FOURTH, which
// is asserted here and not merely tolerated: the link fact types state:mapinputs
// adds have no sentence, so they get no row, and the count is 402 of 541. A
// change that invented a sentence for them would fail this case.
//
// AND IT IS IN THE TABLES, not only in the cells. Reading is a subtype of
// Function, so the text absorbs into Function's table; which table and which
// column is asked of rmap rather than named here, the way the schema-fit case
// above picks its column, and the last third of this emits a store and selects
// the text back out of it with sqlite alone.
test("a reading's spoken text is in the store, and the seven its name cannot spell come back exactly", () => {
  // the exact texts, which is the whole point: none of these is derivable
  const EXACT = [
    ["ConstraintSpan", "{0} spans {1}"],
    ["API", "{0} is activated by {1}"],
    ["RoleInstance", "{0} fills {1}"],
    ["ConstraintIsMachineDecidable", "{0} is machine- decidable"],
    ["HypothesisCandidateHasHiddenFact", "{0} has hidden- {1}"],
    ["TransitionIsFromStatus", "{0} is from- {1}"],
    ["TransitionIsToStatus", "{0} is to- {1}"],
  ];

  // ---- the population -----------------------------------------------------
  const rows = Ev("system:pop_rows", ["ReadingHasText", CELLS]).map((r) => r.map(String));
  const text = new Map(rows);
  expect(text.size).toBe(rows.length);            // Each Reading has one Text
  const spoken = (e) => e.length > 2 && Array.isArray(e[2]) && e[2].length > 0;
  const surface = Ev("reflect:surface", CELLS);
  const said = surface.filter(spoken), mute = surface.filter((e) => !spoken(e));
  expect(said.length).toBeGreaterThan(0);
  expect(mute.length).toBeGreaterThan(0);         // the link fact types
  // A TEXT THAT BELONGS TO NO SURFACE ENTRY IS A READING DECLARED RATHER THAN
  // REFLECTED. reflect:surface is the reader's pass over the sentences, so a
  // reading written as an instance fact -- core.md's alternate reading of
  // Role is used in Reading, 2026-09-22 -- has a text and no surface entry.
  // Naming it is stronger than counting it: the count alone would not say
  // WHICH reading is off the surface, and a reflected text going missing
  // would cancel against a declared one appearing.
  const onSurface = new Set(surface.map((e) => "r" + String(e[0])));
  const declaredOnly = [...text.keys()].filter((id) => !onSurface.has(id)).sort();
  expect(declaredOnly).toEqual(["rReadingUsesRole"]);
  expect(rows.length).toBe(said.length + declaredOnly.length);
  expect(said.filter((e) => !text.has("r" + String(e[0]))).map((e) => String(e[0]))).toEqual([]);
  expect(mute.filter((e) => text.has("r" + String(e[0]))).map((e) => String(e[0]))).toEqual([]);
  // and every id with a text is a Reading the schema already knows
  const readings = new Set(Ev("system:pop_rows", ["FactTypeHasReading", CELLS]).map((r) => String(r[1])));
  expect([...text.keys()].filter((id) => !readings.has(id))).toEqual([]);

  // ---- what the name loses ------------------------------------------------
  const spell = (e) => {
    const players = (e[1] || []).map(String);
    return e[2].flat().map(String)
      .map((w) => (w.length > 2 && w[0] === "{" && w[w.length - 1] === "}" ? String(players[Number(w.slice(1, -1))]) : w))
      .join("").split(" ").join("");
  };
  const declared = Ev("reflect:rd_arm", CELLS);   // state:readings: the declared fact types
  const lost = declared.filter((e) => spell(e).toLowerCase() !== String(e[0]).toLowerCase())
    .map((e) => String(e[0])).sort();
  expect(lost).toEqual(EXACT.map((p) => p[0]).sort());
  // 282 -> 283 (2026-09-25): `Function fills JSON Path with Body Template` enters core.md, and
  // its name spells its reading
  // 283 -> 288 (2026-09-25): the five fact types a Connector pages with enter federation.md,
  // and each name spells its reading
  // 288 -> 289 (2026-09-25): `Function reads rows where JSON Path equals Condition Value`
  // 289 -> 290 (2026-09-25): `Function sends Query Text`
  // 290 -> 291 (2026-09-28, #130): `Transition exits Status in State Machine Definition`
  // 291 -> 292 (2026-09-28, #131): `Function asserts Fact Type on success`
  // 292 -> 293 (2026-09-28): `External System has Credential Encoding`
  // 293 -> 295 (2026-09-28): `is properly of` and `is most specifically of`
  // 295 -> 293 (2026-09-30, 3079d929): layout.md's two fact types go with it
  // 293 -> 294 (2026-10-01, 79def8ec): `External System resolves to Resolved Address`
  // 294 -> 291 (2026-10-01, 186c1497): Function has Description replaces four Has Description
  expect(declared.length - lost.length).toBe(291);
  for (const [name, t] of EXACT) expect([name, text.get("r" + name)]).toEqual([name, t]);

  // ---- and it is in the tables --------------------------------------------
  // WHICH TABLE AND WHICH COLUMN IS THE SCHEMA'S TO SAY. rmap:ctab pairs a fact
  // type with the table carrying it and rmap:proj_carried says which fact type a
  // column path carries, in the order rmap:proj_colnames names the columns.
  let table = "", idx = -1;
  for (const t of Ev("rmap:ctab", CELLS)) {
    let i = 0;
    for (const c of (Array.isArray(t[2]) ? t[2] : [])) {
      if (String(Ev("rmap:proj_carried", Array.isArray(c[2]) ? c[2] : [])) === "ReadingHasText") { table = String(t[1]); idx = i; break; }
      i++;
    }
    if (table) break;
  }
  expect([table === "", idx]).not.toEqual([true, -1]);
  const names = Ev("rmap:proj_colnames", [table, CELLS]).map(String);
  const col = names[idx], key = names[0];

  const dir = mkdtempSync(join(tmpdir(), "arest-rdtext-"));
  try {
    const path = join(dir, "s.db");
    const db = new Database(path);
    makeTables(db);
    db.run("create table _composition (hash text)");
    db.prepare("insert into _composition values(?)").run(globalThis.AREST.composition);
    db.run("pragma wal_checkpoint(TRUNCATE)");
    db.close();

    // ONE POPULATION IS THE ONE THAT MOVED, so only the table carrying it is
    // re-projected: emitToDb writes a fact type whose text differs from the
    // snapshot it is given, and the snapshot handed over is this store's own
    // with that one entry dropped.
    const NL = String.fromCharCode(10);
    const driver = join(dir, "drive.mjs");
    writeFileSync(driver, [
      "await import(process.env.MODULE);",
      "const { CELLS, popSnapshot, emitToDb } = globalThis.AREST;",
      "const before = popSnapshot(CELLS); before.delete(process.env.FT);",
      "console.log('emitted ' + emitToDb(before, CELLS));",
    ].join(NL));
    const out = Bun.spawnSync(["bun", driver], {
      env: { ...process.env, MODULE: pathToFileURL(join(import.meta.dir, "cases.g.js")).href,
             FT: "ReadingHasText", AREST_STORE_DB: path },
      stdout: "pipe", stderr: "pipe" });
    const told = out.stdout.toString() + out.stderr.toString();
    expect(told).toContain("emitted ");
    expect(told).not.toContain("emitted 0");

    const back = new Database(path, { readonly: true });
    const got = new Map(back.query("select " + quo(key) + ", " + quo(col) + " from " + quo(table)
      + " where " + quo(col) + " is not null").values().map((r) => [String(r[0]), String(r[1])]));
    back.close();
    expect(got.size).toBe(rows.length);
    for (const [name, t] of EXACT) expect([name, got.get("r" + name)]).toEqual([name, t]);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 300_000);

// ---- AND CAN ONE PREDICATE CARRY TWO READINGS OF DIFFERENT ROLE ORDER? ----
//
// Samuel, 2026-09-22: "Create an alternate reading of the predicate for
// Reading uses Role. Readings are their own entity, a predicate can have
// multiple readings with different role orders." And, when told the reader
// had no form for it: "You should be able to populate the metamodel facts of
// which readings are used with which fact types." He was right and the first
// answer was wrong: no new form is needed, because Reading is an entity type
// of this metamodel and a second reading is a POPULATION of its fact types,
// written as instance facts in core.md the way every other instance is.
//
// WHAT WOULD HAPPEN WITHOUT THAT. Writing `Reading uses Role.` as a sentence
// beside `Role is used in Reading.` declares a SECOND FACT TYPE: measured on
// a copy, 67 tables became 68 and the new one was ReadingUsesRole with its
// own two columns and no constraint tying its population to this one's.
// This case exists so that a reader who tries that sees why it is wrong.
test("one predicate carries two readings of a fact type, and both roles are used in each", () => {
  const FT = "RoleIsUsedInReading";
  const rows = (ft) => Ev("system:pop_rows", [ft, CELLS]).map((r) => r.map(String));

  // TWO READINGS, ONE FACT TYPE. `It is possible that some Fact Type has more
  // than one Reading` (core.md) is exercised here for the first time in this
  // model, and `For each Reading, exactly one Fact Type has that Reading`
  // still holds: each of the two names this one fact type and no other.
  const mine = rows("FactTypeHasReading").filter((r) => r[0] === FT).map((r) => r[1]).sort();
  expect(mine).toEqual(["rReadingUsesRole", "rRoleIsUsedInReading"]);
  const owners = rows("FactTypeHasReading").filter((r) => mine.includes(r[1])).map((r) => r[0]);
  expect(new Set(owners)).toEqual(new Set([FT]));

  // EACH HAS ITS OWN SPOKEN TEXT, and the two differ -- which is the whole
  // point of an alternate reading and is not derivable from either name.
  const text = new Map(rows("ReadingHasText"));
  expect(text.get("rRoleIsUsedInReading")).toBe("{0} is used in {1}");
  expect(text.get("rReadingUsesRole")).toBe("{0} uses {1}");

  // ONE PREDICATE CARRIES BOTH, which is Samuel's sentence exactly.
  // `It is possible that some Predicate is used by more than one Reading`
  // had no witness before this: ReadingIsUsedByPredicate was 0 rows, because
  // the Predicate population was the seven HTTP methods and nothing else.
  const pred = new Map(rows("ReadingIsUsedByPredicate"));
  expect(pred.get("rRoleIsUsedInReading")).toBe("RoleUsage");
  expect(pred.get("rReadingUsesRole")).toBe("RoleUsage");
  expect(new Map(rows("PredicateHasName")).get("RoleUsage")).toBe("role usage");

  // AND BOTH ROLES ARE USED IN BOTH. Role is used in Reading is <role,
  // reading>, and a reading that used only one role would verbalize only
  // half the fact.
  const used = rows("RoleIsUsedInReading");
  for (const rd of mine) {
    expect(used.filter((r) => r[1] === rd).map((r) => r[0]).sort()).toEqual([FT + ".1", FT + ".2"]);
  }

  // WHAT IS STILL MISSING, asserted so it is a measurement and not a silence:
  // which role is {0} in each reading. `Role is used in Reading has Position`
  // is 0 rows in every store, and writing it as an instance fact reaches the
  // deadlock reflect:roles_of records -- `expected sequence, got atom:
  // RoleIsUsedInReading.2.rReadingUsesRole`, the objectified pair imploded the
  // way rmap:proj_objkey keys it, met by a rule that wants the triple flat.
  // Until that is reconciled the second reading is in the model and cannot be
  // rendered from it. When the position lands this expectation is what fails.
  expect(rows("RoleIsUsedInReadingHasPosition")).toEqual([]);
});

// ---- WHICH ROLE DOES A CREATED PAIR FILL? ---------------------------------
//
// Samuel, 2026-09-23: "role order really shouldn't matter. Having the reading
// be correct for the direction is a nice-to-have, but you need to look at the
// uniqueness constraints to determine which role is the subject, not the role
// order."
//
// rmap:keypos already answers it, from the uniqueness on the descriptor, and
// the PROJECTION already obeys it: Function.readingFactTypeId sits on the
// READING's row because FactTypeHasReading keys on role 2. ui:addfact did not:
// it built <id, value> positionally, so a create naming FactTypeHasReading
// filed the new id as the FACT TYPE and the value as the Reading, and then
// Fact Type's own obligations for Role, Arity and Reading landed on an id that
// was never meant to be one. Measured on the base before the fix: eight
// alethic violations for the row below, including ReadingHasText against
// RoleIsUsedInReading. After: one.
test("a created pair fills the role the uniqueness keys, not role one", () => {
  const desc = (n) => Ev("theta:find_desc", [n, Ev("store:fts", CELLS)]);
  const keypos = (n) => Number(Ev("rmap:keypos", desc(n)));

  // THE TWO DIRECTIONS, from the uniqueness and not from the sentence.
  // `For each Reading, exactly one Fact Type has that Reading` keys role 2;
  // `Each Reading has exactly one Text` keys role 1.
  expect([keypos("FactTypeHasReading"), keypos("ReadingHasText")]).toEqual([2, 1]);

  // A ROW THAT USES BOTH. rProbeAlt is a Reading: it carries its own text and
  // predicate through role-1 fact types and names its fact type through a
  // role-2 one. Every pair has to land on the right side for this to refuse
  // ONLY the obligation it genuinely cannot meet.
  const row = [["Function", "rProbeAlt"], ["ReadingHasText", "{0} probes {1}"],
               ["FactTypeHasReading", "RoleIsUsedInReading"],
               ["ReadingIsUsedByPredicate", "RoleUsage"]];
  const out = Ev("create", [row, CELLS]);
  const answer = JSON.parse(String(out[0]));
  expect(answer[0]).toBe("refused");
  expect(answer[1]).toEqual([["Function", "rProbeAlt"]]);

  // AND THE ONE IT CANNOT MEET IS THE MANY-TO-MANY. `Role is used in Reading`
  // has a spanning uniqueness over both roles, so it is a relation and no
  // collection's column, and a create row cannot assert it at all. That is a
  // different gap and it is named here rather than left as a bare count.
  expect(answer[2]).toEqual([["RoleIsUsedInReading", "mandatory", "rProbeAlt"]]);
  expect(Ev("rmap:functionalp", desc("RoleIsUsedInReading"))).toBe("F");

  // WHAT WOULD HAVE FAILED BEFORE, asserted by absence: with the subject in
  // role 1, RoleIsUsedInReading was filed as the Reading and rProbeAlt as the
  // Fact Type, so these four were in the list.
  const flat = answer[2].map((v) => v.join(" "));
  for (const gone of ["ReadingHasText mandatory RoleIsUsedInReading",
                      "FactTypeHasReading mandatory rProbeAlt",
                      "FactTypeHasRole mandatory rProbeAlt",
                      "FactTypeHasArity mandatory rProbeAlt"]) {
    expect(flat).not.toContain(gone);
  }
}, 300_000);

// ---- AN INSTANCE BELONGS TO THE DOMAIN ITS TYPE BELONGS TO -----------------
//
// (task #122 item 15, 2026-09-22.) Sam: "Why would we have anything being
// created without a domain, though? Is core missing a domain?" -- and, on what
// belongs, "Both? Nouns and fact types may define tables and columns." Every
// create of a Function-typed entity answered 200 committed_with_violations
// with the deontic `Each Function belongs to some Domain` naming the new id
// unless the row carried a Domain, which most rows in most apps never do. The
// type had a domain all along (Stream is state.md's); the reflection that
// answers `Function belongs to Domain` gave an instance a domain only through
// a type with no subtypes, gave a role none at all, and was not consulted by
// the create, which validated over a trial store carrying the boot's cell.
// Measured at 8f1ef6ea over the carriers boot: the POST below answered 200
// with ["FunctionBelongsToDomain","deontic",<id>] in its deontic slot, and
// the population had no row for DomainHasDescription.1 (a role), FactJoinsFact
// (a fact type off the served surface) or Applied (a Status, whose type has a
// subtype). The membership is by the most specific type, a fact type's by its
// first player, a role's by its fact type; the account is at
// reflect:fbd_type_dom in lambda.
test("an instance created with no Domain belongs to its type's, and a reflected role to its fact type's", () => {
  const flat = (v) => { let x = v; while (Array.isArray(x)) x = x.length ? x[0] : null; return String(x); };
  const dom = (id, cells) => {
    const hit = Ev("system:pop_rows", ["FunctionBelongsToDomain", cells]).find((r) => flat(r[0]) === id);
    return hit ? flat(hit[1]) : null;
  };
  // the reflected extents over the carriers boot: a role takes its fact type's
  // domain, a fact type its first player's wherever it is on the surface, an
  // instance its most specific type's
  expect(dom("FunctionHasDescription.1", CELLS)).toBe("core");
  expect(dom("FactJoinsFact", CELLS)).toBe("instances");
  expect(dom("Applied", CELLS)).toBe("state");
  // a type whose file declares a domain gives its instances that domain:
  // resolution.md declares `resolution` first, before its twelve catalog
  // rows, and the reader takes the first Domain sentence in file order as
  // the file's, so its Operations are resolution's
  expect(dom("actions", CELLS)).toBe("resolution");
  // and a type in no file's declared list still has no domain, so the
  // deontic still names what follows it rather than a domain guessed from an
  // ancestor: Ring Constraint is declared only as `* Each Ring Constraint is
  // a Constraint that ...` (core.md:166), which the reader keeps as a subtype
  // fact marked `subtype` in state:derived while compile:rows_types lists a
  // name from a type row or an `is a subtype of` row only -- so the subtype
  // fact's first player resolves to nothing, and the fact is nobody's
  expect(dom("RingConstraintIsASubtypeOfConstraint", CELLS)).toBeNull();
  // the create: Stream is state.md's, the row carries no Domain, and the
  // answer is committed with no warning -- from the trial store the check
  // reads, before any host reflection -- with the membership in the store it
  // answers
  const KEY = "probe-domain-" + Math.random().toString(36).slice(2, 8);
  const out = Ev("main:api", [CELLS, "POST", "StreamHasName", "", [KEY, "probe-name"]]);
  expect(Number(out[1])).toBe(201);
  const body = JSON.parse(String(out[0]));
  expect(body[0]).toBe("committed");
  expect(body[3].filter((v) => String(v[0]) === "FunctionBelongsToDomain")).toEqual([]);
  expect(dom(KEY, out[2])).toBe("state");
}, 120_000);

// ---- IS A SUB-STATUS OF A COMPOSITE TERMINAL IN THE MACHINE THAT NESTS IT? -----
//
// #130 (pm.auto.dev, 2026-09-25): support.auto.dev's
// StatusIsTerminalInStateMachineDefinition listed Received, Draft, Responded
// and Escalated -- the sub-statuses of its composite Open -- as terminal in
// Support Request beside Closed, live, and its Agent Chat machine the same.
// metamodel/state.md defines a nested machine's statuses in the machine that
// nests it, and terminal counted only the transitions defined in that same
// machine, so a status whose every exit is inside Open, or is Open's own, had
// none in Support Request. Terminal now reads `Transition exits Status in State
// Machine Definition`: defined there and from that status, or exiting it in a
// nested machine defined there, or exiting a composite there that the status is
// defined in. Terminal is what is defined in the machine and exited by nothing
// in it.
//
// The machines are support's shape, and a three-level one, merged into the base
// store's own populations and closed as the host closes them. At bedba10a this
// answered Support Request {Closed, Draft, Escalated, Received, Responded}, Outer
// {Done, Inner, i1, i2, m2} and Mid {i1, i2, m2}.
test("a nested machine's exits count in the machine that nests it, so only what nothing leaves is terminal", () => {
  const TR = [
    ["pr-resolve", "PR Support Request", "PR Open", "PR Resolved"],
    ["pr-merge", "PR Support Request", "PR Open", "PR Closed"],
    ["pr-reopen", "PR Support Request", "PR Resolved", "PR Open"],
    ["pr-close", "PR Support Request", "PR Resolved", "PR Closed"],
    ["pr-accept", "PR Open", "PR Received", "PR Draft"],
    ["pr-respond", "PR Open", "PR Draft", "PR Responded"],
    ["pr-reply", "PR Open", "PR Responded", "PR Received"],
    ["pr-escalate", "PR Open", "PR Draft", "PR Escalated"],
    ["pr-release", "PR Open", "PR Escalated", "PR Draft"],
    ["pr-finish", "PR Outer", "PR Mid", "PR Done"],
    ["pr-go", "PR Mid", "PR Inner", "PR m2"],
    ["pr-step", "PR Inner", "PR i1", "PR i2"],
  ];
  const MACHINES = ["PR Support Request", "PR Open", "PR Outer", "PR Mid", "PR Inner"];
  const add = {
    TransitionIsDefinedInStateMachineDefinition: TR.map((r) => [r[0], r[1]]),
    TransitionIsFromStatus: TR.map((r) => [r[0], r[2]]),
    TransitionIsToStatus: TR.map((r) => [r[0], r[3]]),
    StatusIsInitialInStateMachineDefinition: [["PR Open", "PR Support Request"], ["PR Received", "PR Open"],
      ["PR Mid", "PR Outer"], ["PR Inner", "PR Mid"], ["PR i1", "PR Inner"]],
    ObjectTypeInstanceIsInstanceOfObjectType: MACHINES.map((m) => [m, "State Machine Definition"]),
  };
  const cells = CELLS.slice();
  for (const [name, rows] of Object.entries(add)) {
    const have = Ev("system:pop_rows", [name, CELLS]);
    const at = cells.findIndex((c) => Array.isArray(c) && String(c[0]) === "CELL" && String(c[1]) === name);
    const cell = ["CELL", name, [...(Array.isArray(have) ? have : []), ...rows]];
    if (at >= 0) cells[at] = cell; else cells.unshift(cell);
  }
  const closed = Ev("derive:closed", cells);
  const pop = (n) => (closed.find((e) => String(e[0]) === n) || [n, []])[1].map((r) => r.map(String));
  const terminal = pop("StatusIsTerminalInStateMachineDefinition");
  const terminalIn = (m) => terminal.filter((r) => r[1] === m).map((r) => r[0]).sort();
  expect(terminalIn("PR Support Request")).toEqual(["PR Closed"]);
  expect(terminalIn("PR Open")).toEqual([]);
  expect(terminalIn("PR Outer")).toEqual(["PR Done"]);
  expect(terminalIn("PR Mid")).toEqual(["PR m2"]);
  expect(terminalIn("PR Inner")).toEqual(["PR i2"]);
  // and the exits say why: accept, inside Open, leaves Received in Support Request too, and resolve,
  // which leaves Open, leaves every sub-status of Open
  const exits = new Set(pop("TransitionExitsStatusInStateMachineDefinition").map((r) => r.join(" > ")));
  expect(exits.has("pr-accept > PR Received > PR Support Request")).toBe(true);
  for (const s of ["PR Received", "PR Draft", "PR Responded", "PR Escalated"])
    expect(exits.has("pr-resolve > " + s + " > PR Support Request")).toBe(true);
  expect(exits.has("pr-finish > PR i1 > PR Outer")).toBe(true);
  expect([...exits].some((e) => e.endsWith(" > PR Closed > PR Support Request"))).toBe(false);
});

// ---- DOES A NOUN DECLARED TWICE BELONG TO THE MORE SPECIFIC DOMAIN? -------------
//
// Sam, 2026-09-28: `They should resolve by cascading from the most specific domain`. reflect:dom_of
// answers the first pair naming an element, and compile:pairs_eldomain laid the pairs out in read
// order, the metamodel first: on support.auto.dev User was filed under the metamodel's instances
// although support's vendored-deps declares it too. Laid out from the last file read to the first,
// the first match is the most specific. Before the change this answered 'lib'.
test("a noun declared in a library and in the app belongs to the app's domain", () => {
  const pairs = Ev("compile:pairs_eldomain", [["lib", ["PC Noun", "PC Other"]], ["#", ["PC Loose"]], ["app", ["PC Noun"]]])
    .map((r) => r.map(String));
  expect(pairs).toEqual([["PC Noun", "app"], ["PC Noun", "lib"], ["PC Other", "lib"]]);
  expect(String(Ev("solve:assoc", ["PC Noun", pairs]))).toBe("app");
  expect(String(Ev("solve:assoc", ["PC Other", pairs]))).toBe("lib");
});

// ---- DOES AN INSTANCE OF A SUBTYPE BELONG TO ONE DOMAIN? -------------------------
//
// pm.auto.dev, 2026-09-28, on a copy of support.auto.dev: the first write of a module session
// committed and every write after it was refused on `Each Object Type Instance belongs to at most
// one Domain`. Customer is a subtype of User there, so a customer is an instance of both, and the
// bridge `Object Type Instance is of Function` related it to both. Customer is in database-routing
// and User in instances, so every customer derived two domains. The compiled store carried one,
// and each runtime closure re-derived two. Now an instance is of its most specific types only: an
// Admin of Admin < Customer < User belongs to Admin's domain, and a Customer to Customer's. At
// 6bf15817 the customer belonged to pr-cust-dom and pr-user-dom both.
test("an instance of a subtype belongs to its most specific type's domain alone", () => {
  const add = {
    ObjectTypeInstanceIsInstanceOfObjectType: [["pr-c1", "PR Customer"], ["pr-c1", "PR User"],
      ["pr-a1", "PR Admin"], ["pr-a1", "PR Customer"], ["pr-a1", "PR User"]],
    ObjectTypeIsSubtypeOfObjectType: [["PR Customer", "PR User"], ["PR Admin", "PR Customer"]],
    FunctionBelongsToDomain: [["PR User", "pr-user-dom"], ["PR Customer", "pr-cust-dom"], ["PR Admin", "pr-admin-dom"]],
  };
  const cells = CELLS.slice();
  for (const [name, rows] of Object.entries(add)) {
    const have = Ev("system:pop_rows", [name, CELLS]);
    const at = cells.findIndex((c) => Array.isArray(c) && String(c[0]) === "CELL" && String(c[1]) === name);
    const cell = ["CELL", name, [...(Array.isArray(have) ? have : []), ...rows]];
    if (at >= 0) cells[at] = cell; else cells.unshift(cell);
  }
  const closed = Ev("derive:closed", cells);
  const pop = (n) => (closed.find((e) => String(e[0]) === n) || [n, []])[1].map((r) => r.map(String));
  const of = (ft, id) => pop(ft).filter((r) => r[0] === id).map((r) => r[1]).sort();
  expect(of("ObjectTypeInstanceIsOfFunction", "pr-c1")).toEqual(["PR Customer"]);
  expect(of("ObjectTypeInstanceBelongsToDomain", "pr-c1")).toEqual(["pr-cust-dom"]);
  expect(of("ObjectTypeInstanceIsOfFunction", "pr-a1")).toEqual(["PR Admin"]);
  expect(of("ObjectTypeInstanceBelongsToDomain", "pr-a1")).toEqual(["pr-admin-dom"]);
  // and why: each is properly of every type above its most specific one
  expect(of("ObjectTypeInstanceIsProperlyOfObjectType", "pr-a1")).toEqual(["PR Customer", "PR User"]);
});

// ---- AND DOES THE DESCENT END WHERE THE STORE CONTRADICTS ITSELF? --------
//
// `Status is initial in State Machine Definition` is a fact about the
// DEFINITION, and main:leaf_initial walks it to the leaf, because entering a
// composite Status enters its initial substate (Harel; main:enter reads the
// same walk). The walk kept no record of the statuses it had entered, so a
// population holding both <s, m> and <m, s> sent it round for ever: the
// predicate answers non-null at every step and nothing ends it. That is not a
// slow answer, it is no answer -- the closure never returns.
//
// A population holds both when a store is PROJECTED under one placement and
// READ under another. apps/claude/.check/store.db (2026-09-21 13:58) and
// apps/qa.auto.dev/.check/store.db (2026-09-22 09:55) both carry the marking
// as Function['step1-elementary-facts'].stateMachineDefinitionStatusId =
// 'CSDP', keyed by the STATUS; a store this tip projects carries it as
// Function['CSDP'].stateMachineDefinitionStatusId = 'step1-elementary-facts',
// keyed by the MACHINE. compile.js keeps the prior row, because its key is
// not one the build wrote, and loadStoreDb reconstructs it with the current
// placement -- which is the pair the other way round. MEASURED 2026-09-22:
// qa.auto.dev's check over a copy of its own prior store does not finish the
// closure in 180 s, where the same check over a fresh store closes in 5.5 s;
// with the walk guarded it closes in 6.5 s and writes 15,570 rows.
//
// The store here is one statement away from that one: made the check's way,
// two Schema Designs in it -- CSDP is the machine Schema Design has, and
// Schema Design is a subtype of Object Type Instance -- and the one column
// that carries the marking rewritten into the other placement.
//
// THE CLOSURE RUNS IN A CHILD THAT ANSWERS INTO A FILE. At e70a60dd it does
// not return, and a bun child inside a synchronous loop survives p.kill(9)
// on win32 while the parent's read of its stdout never ends (measured
// 2026-09-22), so a case written the way the durability cases above are
// written would HANG the suite instead of failing it. A file needs no pipe,
// and the platform ends the process.
test("a store naming a machine's initial both ways round still seats its instances", async () => {
  const stamp = globalThis.AREST.composition;
  const dir = mkdtempSync(join(tmpdir(), "arest-descent-"));
  const mod = join(import.meta.dir, "cases.g.js");
  const path = join(dir, "descent.db");
  const answered = join(dir, "answer.json");
  const L = String.fromCharCode(10);
  try {
    const db0 = new Database(path);
    makeTables(db0);
    db0.run("create table _composition (hash text)");
    db0.prepare("insert into _composition values(?)").run(stamp);
    db0.run("pragma wal_checkpoint(TRUNCATE)");
    db0.close();

    const driver = join(dir, "drive.mjs");
    writeFileSync(driver, [
      "import { writeFileSync, renameSync } from 'node:fs';",
      "await import(process.env.MODULE);",
      "const { Ev, CELLS, popSnapshot, emitToDb, closeStore } = globalThis.AREST;",
      "const say = (v) => { writeFileSync(process.env.ANSWER + '.part', JSON.stringify(v));",
      "  renameSync(process.env.ANSWER + '.part', process.env.ANSWER); };",
      "if (process.env.MAKE) { const b = popSnapshot(CELLS); closeStore();",
      "  say(['made', emitToDb(b, CELLS)]); }",
      "else { closeStore();",
      "  say([Ev('reflect:machines', CELLS), Ev('reflect:otistatus', CELLS)]); }",
    ].join(L));

    const readAnswer = () => {
      try { return JSON.parse(readFileSync(answered, "utf8")); } catch { return null; }
    };
    const run = async (make) => {
      try { rmSync(answered, { force: true }); } catch { /* not there */ }
      const env = { ...process.env, MODULE: pathToFileURL(mod).href,
        AREST_STORE_DB: path, ANSWER: answered };
      if (make) env.MAKE = "1"; else delete env.MAKE;
      const p = Bun.spawn(["bun", driver], { env, stdout: "ignore", stderr: "ignore" });
      const deadline = Date.now() + 120_000;
      let got = null;
      while (Date.now() < deadline && (got = readAnswer()) === null) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (process.platform === "win32") {
        Bun.spawnSync(["taskkill", "/F", "/T", "/PID", String(p.pid)],
          { stdout: "ignore", stderr: "ignore" });
      } else { try { p.kill(9); } catch { /* already gone */ } }
      return got;
    };

    // the check's own build first: the marking is a derived head with a table
    // of its own since 36774b07, and it has to be in the tables to be flipped
    const made = await run(true);
    expect(made && made[0]).toBe("made");

    const db1 = new Database(path);
    for (const k of ["sd-alpha", "sd-beta"]) {
      db1.run('insert or replace into "Function" ("functionId", "belongsToDomainId",'
        + ' "objectTypeInstanceReference", "objectTypeInstanceDomainId", "schemaDesignNote")'
        + " values (?, ?, ?, ?, ?)", [k, "evolution", k, "evolution", "probe note"]);
      // keyed on the pair since the objectification came off (2026-09-23): the
      // surrogate this wrote, k + ".Schema Design", was the pair joined on a dot
      db1.run('insert or replace into "ObjectTypeInstanceIsInstanceOfObjectType"'
        + ' ("objectTypeId", "objectTypeInstanceId")'
        + " values (?, ?)", ["Schema Design", k]);
    }
    // and the marking keyed by the STATUS, which is the placement every store
    // built before 2026-09-21 23:45 carries
    const marks = db1.query('select "functionId", "stateMachineDefinitionStatusId"'
      + ' from "Function" where "stateMachineDefinitionStatusId" is not null')
      .values().map((r) => r.map(String));
    expect(marks.length).toBeGreaterThan(0);
    db1.run('update "Function" set "stateMachineDefinitionStatusId" = null');
    for (const [machine, status] of marks) {
      db1.run('update "Function" set "stateMachineDefinitionStatusId" = ?'
        + ' where "functionId" = ?', [machine, status]);
    }
    db1.run("pragma wal_checkpoint(TRUNCATE)");
    db1.close();

    const out = await run(false);
    expect(out).not.toBeNull();   // at e70a60dd the child never answers
    const J = JSON.stringify;
    const [machines, statuses] = out;
    expect(machines.some((r) => J(r) === J(["sm.sd-alpha", "sd-alpha"]))).toBe(true);
    expect(machines.some((r) => J(r) === J(["sm.sd-beta", "sd-beta"]))).toBe(true);
    // and each one seated at CSDP's initial: the walk stops at the last status
    // it legitimately entered, which is the machine's own initial
    expect(statuses.some((r) => J(r) === J(["sd-alpha", "step1-elementary-facts"]))).toBe(true);
    expect(statuses.some((r) => J(r) === J(["sd-beta", "step1-elementary-facts"]))).toBe(true);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 300_000);
