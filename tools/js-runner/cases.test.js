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

// ---- DOES EVERY FACT THE STORE HOLDS HAVE A PLACE IN THE SCHEMA? ----------
//
// Halpin's Rmap step 1 maps each fact type with a compound UC to a table of its
// own, and Information Modeling and Relational Databases says twice -- at the
// end of 10.3's Mapping Subtypes and again in 10.4 -- that absorbing a subtype
// does NOT take that away from a non-functional role the subtype plays.
// canon's rmap:absorbed took it away anyway, so 38 fact types of the base
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
// readings declare. It needs no database -- canon is held against itself -- and
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
  ["CELL","state:declared",[[["FactTypeHasRole", ["Fact Type", "Role"]], ["ConstraintSpan", ["Constraint", "Role"]], ["ConstraintSpanHasPosition", ["ConstraintSpan", "Position"]], ["ConstraintSpanHasSequenceNumber", ["ConstraintSpan", "Sequence Number"]]]]]
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
// digits over the whole canon file and the carriers -- and measured 2026-09-21
// that is both too strong and too weak. TOO STRONG: three canon commits that
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
    expect(short).toContain("apps_check");

    // AND NO TABLES AT ALL IS THE 09-11 STORE, named table by table.
    let bare = "";
    try { globalThis.AREST.loadStoreDb(make("bare", stamp, "bare")); } catch (e) { bare = e.message; }
    expect(bare).toContain("no such table");
    expect(bare).toContain("apps_check");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
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
// A STORE'S TABLES ARE THE SCHEMA THE READINGS DESCRIBE, so a fixture builds
// them the way compile.js does and emitToDb writes into them. What stood here
// was `create table _meta (ft, kind, tbl, arity)` and nothing else: the old
// writer invented a table per fact type on first write, named `r` and a hash of
// the name, with an arity guessed from the first row. rmap:ddl has every table
// the readings imply, populated or not, so there is no first write to invent
// for.
const makeTables = (db) => {
  const flat = (v) => (Array.isArray(v) ? v.map(flat).join("") : String(v));
  for (const stmt of flat(Ev("rmap:ddl", CELLS)).split(";")) if (stmt.trim()) db.run(stmt + ";");
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
// are read with sqlite alone -- no canon, no closure -- because a check that
// asked canon would be asking the very computation whose answer was never
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
    "  const before = popSnapshot(CELLS);",
    "  const out = Ev('main:api', [CELLS, 'POST', process.env.FT, '', [process.env.WRITE, 'probe note']]);",
    "  if (out.length > 2) { adoptStore(out[2]); if (Number(out[1]) < 400) emitToDb(before, CELLS); }",
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
  // canon at all, which it could while every fact type had a table of its own
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
test("solve:declared answers the same rows over the flat design state as over the chunked one", () => {
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

// ---- AND DOES THE CARRY LEAVE A REFLECTED ROW TO THE CLOSURE? --------------
//
// compile.js's carry (the comment beside "AND THE PRIOR STORE IS NOT THROWN
// AWAY", ~296) is not this host's code -- it is compile.js's own, run as a CLI
// over a readings directory -- so testing it means running it, the way the
// test above runs a driver rather than reimplementing emitToDb. ConstraintSpan
// and Function.constraintModalityType are the metamodel's own case: canon's
// reflect:computed pairs ConstraintSpan with reflect:spans and
// ConstraintHasModalityOfModalityType with reflect:modalities (both #122 item
// 1's reflect:cells union). Since the check writes the closure into the build
// (2026-09-21) a fresh compile.js build holds the reflection's own rows in
// both; what an OLDER design state's write-back would have left there is a
// row and a value this design state's reflection does not produce, and the
// carry over the next build must not keep them. A row written straight into the
// store between two builds stands in for what a BOOT's write-back would have
// left there from an older design state (host.js's loadReflected + emitToDb,
// the durability tests above); the carry must not mistake it for a runtime
// fact the way it does at HEAD (b6e16927).
test("the carry leaves a reflected row to the closure instead of keeping it", () => {
  const dir = mkdtempSync(join(tmpdir(), "arest-carry-reflected-"));
  const compiler = join(import.meta.dir, "compile.js");
  // metamodel ALONE throws inside reflect:cells (a CSDP reflection gap, see
  // compile.js's own note beside the try/catch this fix adds): every shipped
  // app's check/compile script reads templates beside it too, and this does
  // the same, so the carry under test is the one a real build exercises.
  const metamodel = join(import.meta.dir, "..", "..", "metamodel");
  const templates = join(import.meta.dir, "..", "..", "readings", "templates");
  const path = join(dir, "store.db");

  const build = () => {
    const p = Bun.spawnSync(["bun", compiler, metamodel, templates],
      { env: { ...process.env, AREST_DB: path }, stdout: "pipe", stderr: "pipe" });
    return p.stdout.toString() + p.stderr.toString();
  };

  try {
    // the fresh build: no prior store, nothing carried; the check writes the
    // closure into it, so the reflected shapes ARE populated -- by canon's
    // reflection over this design state, and by nothing else
    const first = build();
    expect(first).toContain("store:");
    expect(first).not.toContain("runtime row(s) carried");
    const before = new Database(path, { readonly: true });
    expect(before.prepare('select count(*) c from "ConstraintSpan"').get().c).toBeGreaterThan(0);
    expect(before.prepare('select count(*) c from "ConstraintSpan" where "constraintSpanId"=?').get("x-probe-span").c).toBe(0);
    // a Function the reflection gives no modality, so the value injected below
    // is one this design state's own closure would not produce
    const fnKey = before.prepare('select "functionId" k from "Function" where "constraintModalityType" is null limit 1').get().k;
    expect(fnKey).toBeTruthy();
    before.close(true);

    // what a boot's write-back would have left behind from an older design
    // state: a ConstraintSpan row and a Function constraint-modality value
    // this design state's own reflection would not produce
    const seed = new Database(path);
    seed.run('insert into "ConstraintSpan" ("constraintSpanId","constraintId","position","roleId","sequenceNumber") values (?,?,?,?,?)',
      ["x-probe-span", "x-probe-constraint", "9", "x-probe-role", "9"]);
    seed.run('update "Function" set "constraintModalityType"=?, "constraintTypeId"=? where "functionId"=?',
      ["x-probe-modality", "x-probe-type", fnKey]);
    seed.run("pragma wal_checkpoint(TRUNCATE)");
    seed.close(true);

    // the carry, over the SAME readings: the stale reflected row and value are
    // not runtime facts, and must not survive it
    const second = build();
    expect(second).toContain("store:");
    const after = new Database(path, { readonly: true });
    expect(after.prepare('select count(*) c from "ConstraintSpan" where "constraintSpanId"=?').get("x-probe-span").c).toBe(0);
    expect(after.prepare('select "constraintModalityType" v from "Function" where "functionId"=?').get(fnKey).v).toBe(null);
    after.close(true);
    expect(second).toContain("reflected row(s) left to the closure");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* left behind */ }
  }
}, 300_000);

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
  expect(body[1].map((p) => p[0]).sort()).toEqual(["FunctionHasDefinitionOrigin", "ObjectTypeInstanceHasReference", "ObjectTypeInstanceIsInstanceOfObjectType"]);
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
let REACT_CONTAINER = null;
let REACT_CONTAINER_ERROR = "";
try {
  REACT_CONTAINER = await import("../../../apps/ui.do/src/render/registry.ts");
} catch (e) {
  REACT_CONTAINER_ERROR = e instanceof Error ? e.message : String(e);
}

describe("law:paired over the React container's registration table", () => {
  const container = () => {
    expect(REACT_CONTAINER_ERROR).toBe("");
    expect(REACT_CONTAINER).not.toBeNull();
    return REACT_CONTAINER;
  };

  test("the container's table is reachable, and is the table it renders from", () => {
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

  test("the container pairs every declared control kind, and the store declares every pair", () => {
    const HTML = container().REGISTERED_NAMES.map(String);
    const declared = Ev("law:ctl_declared", CELLS).map(String);
    expect(declared.length).toBeGreaterThan(0);        // an empty set pairs vacuously
    expect(Ev("law:unpaired", [CELLS, HTML])).toEqual([]);
    expect(Ev("law:paired", [CELLS, HTML])).toBe("T");
    // BOTH WAYS ROUND, which is what #124 added: law:unpaired above says the
    // container registers everything the store declares, and this says the
    // store declares everything the container registers. One direction alone
    // let the metamodel declare ten kinds while canon emitted nineteen --
    // ui:screen on `new Function` places a navigationfield over this very
    // store, and no container was ever asked whether it had one.
    expect(declared.slice().sort()).toEqual(HTML.slice().sort());
  });

  test("a container missing one native control is refused, by name", () => {
    const HTML = container().REGISTERED_NAMES.map(String);
    const short = HTML.filter((n) => n !== "render:itemrow");
    expect(Ev("law:paired", [CELLS, short])).toBe("F");
    expect(Ev("law:unpaired", [CELLS, short]).map(String)).toEqual(["render:itemrow"]);
  });

  test("a container missing the layout engine is refused too", () => {
    // a platform is its paired controls AND the engine that lays them out, so
    // an unregistered render:html is as fatal as an unregistered widget
    const HTML = container().REGISTERED_NAMES.map(String);
    const short = HTML.filter((n) => n !== "render:html");
    expect(Ev("law:paired", [CELLS, short])).toBe("F");
    expect(Ev("law:unpaired", [CELLS, short]).map(String)).toEqual(["render:html"]);
  });

  test("a caller that is not a platform owes no pairing", () => {
    // what law:report and law:app_report pass; the verdict is the store half
    expect(Ev("law:paired", [CELLS, []])).toBe("T");
  });

  test("the reading binds the same controls the container registers", () => {
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

// ---- THE READER IS CANON, AND IT IS NOW ITS OWN WITNESS -------------------
//
// 2026-09-20, #109: the oracle is deleted and the carrier these tests read
// as `the witness` is written by canon's own reader (tools/js-runner/
// compile.js). So every comparison below is canon against the design state
// canon wrote, read back through the host's CANONTEXT -- a ROUND TRIP of the
// carrier, which can fail on chunking, on an escape, on an atom that should
// have been a number. It is no longer a comparison against an independent
// second implementation, and nothing is, because there no longer is one.
// The paragraph below is kept for what it says about why.
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
    // THE WITNESS IS REGENERATED AND THE DISTANCE IS ZERO (2026-09-17). It was
    // recorded against carriers of 2026-09-15 19:14 and had drifted two days:
    // canon read four descriptors the witness lacked (Verbalization Pattern's
    // fact types, from metamodel/verbalization.md and the orient and tutor
    // operations) and the rows of three operation fact types and of the
    // reflected populations they touch (kinds, instances, references, data
    // type, declaration order, subtype, reference mode, enum values) moved
    // with them. Regenerating tools/norma-oracle over metamodel/ closes all of
    // it: witness 257 -> 261, canonOnly 4 -> 0, rows 244 -> 250, stateRows 245
    // -> 257, stateUcs 624 -> 631, and every descriptor field agrees.
    // AND THE LAST ONE IS THIS BRANCH'S FIX. With the witness fresh but the
    // metamodel unchanged, ucs/all/stateRows each stayed ONE short, on
    // UserApprovesDomainChange alone: the self-modification gate's `exactly one
    // User approves that Domain Change` built a deontic uniqueness over the
    // Domain Change role, which is NARROWER than the fact type's spanning one,
    // so the oracle deleted the spanning UC ([[1,2]] -> [[2]]) while canon's
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
    // canon, players, ucs, mands, all and stateRows all stay where they were.
    // AND `Operation awaits a driver` IS STORED NOW (2026-09-18). Declaring it
    // `**` rather than `*` in metamodel/resolution.md puts it in the STORED
    // schema -- the oracle drops a `*` head from state:fts (Codd 1970 1.5,
    // Verifier.cs) and canon's rmap:gate drops it from the map (NORMA
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
    // witness/canon/both/all at 262 -- every state row canon writes is
    // byte-identical to the carrier's, the first time the distance has been zero
    // on that field. `canon's state:otpops carries the witness's populations`
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
    expect({ witness: O.size, canon: C.size, both, canonOnly: canonOnly.length, oracleOnly: oracleOnly.length,
             players, ucs, mands, all, rows: rowsEq, rejected, derived: [derO.size, derC.size, derBoth], stateRows, stateUcs })
      .toEqual({ witness: 289, canon: 289, both: 289, canonOnly: 0, oracleOnly: 0,
                 players: 262, ucs: 289, mands: 289, all: 262, rows: 279, rejected: 0, derived: [37, 37, 37], stateRows: 289, stateUcs: 665 });
  }, 300_000);

  // state:deontics, row for row (task #93, 2026-09-16). The witness builds 13 of
  // the base metamodel's 37 deontic sentences -- 9 mandatory, 1 uniqueness, 3
  // prohibited -- and the carrier canon writes must hold the same 13 rows, key,
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
      .toEqual({ witness: 13, canon: 13, oracleOnly: [], canonOnly: [] });
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
  //
  // AND THE ROW THAT WAS CANON-ONLY IS THE RECORD OF WHAT THE ORACLE DID NOT
  // BUILD. metamodel/state.md states the Harel nesting of `Status is defined in
  // State Machine Definition` (a state defined in a nested machine is defined in
  // the machine that nests it); the reader compiles it with the SUBTYPE
  // NARROWING arm, and the oracle built no rule for that head at all -- it
  // listed StatusIsDefinedInStateMachineDefinition as UNDELIVERED. That row is
  // now in the carrier, because canon writes the carrier, so canonOnly is 0 and
  // witnessUndelivered is two names rather than three. The 46-vs-45 row count
  // went the same way: the oracle wrote two of its rows twice, from an
  // `and no ... where` arm that re-emitted what an earlier arm had built, and
  // canon writes each row once.
  //
  // What survives is the round trip: 45 rules in, 45 rules out, every recipe
  // tree identical after the carrier has been written and parsed again.
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
             canonOnlyRows: canon.map(J).filter((r) => !W.has(r)),
             undelivered: und.map((p) => String(p[0])), reasons: und.every((p) => typeof p[1] === "string" && p[1].length > 0),
             witnessUndelivered: Ev("ast:fetch", ["state:undelivered", CELLS]).flat(1).map((p) => String(p[0])) })
      .toEqual({ witnessRows: 45, witness: 45, canon: 45, distinct: 45, both: 45, canonOnly: 0, witnessOnly: 0,
                 canonOnlyRows: [],
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
// THE WITNESS IS REGENERATED (2026-09-17), exactly as the schema test above
// records. It used to predate metamodel/verbalization.md and the orient and
// tutor operations, so canon read six fact types and six object types it had
// never seen and the distance was stated as "every witness row, and canon's own
// newer ones named"; the two sides now hold the same sets and the pins below say
// so. A change in either direction is a finding, not noise.
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
      .toEqual({ witness: 41, canon: 41, missing: [], same: 41,
                 grew: [], contained: true, newTypes: [] });
  }, 300_000);

  // THE ORDER IS THE ROW, so the ordinal is only meaningful against the same
  // set of fact types: canon's sequence restricted to the ones the witness has
  // is the witness's sequence. The six Verbalization Pattern fact types that
  // used to be canon-only are in the regenerated witness (2026-09-17), so the
  // two sequences are now the same rows and canonOnly is empty. Agent left
  // core on 2026-09-18 (its declaration moved to readings/templates), so
  // AgentIsASubtypeOfObjectTypeInstance is no longer in the base metamodel's
  // declaration order and the count is 506 where it was 507. Ordinals after
  // it renumber, which is why `renumbered` is the field that proves nothing
  // else moved.
  test("canon's state:factorder is the witness's sequence", () => {
    const w = witness("state:factorder").map((r) => String(r[0]));
    const c = Ev("read:order_state", F);
    const WN = new Set(w);
    const kept = c.filter((r) => WN.has(String(r[0])));
    expect({ canon: c.length, witness: w.length, kept: kept.length,
             sequence: J(kept.map((r) => String(r[0]))) === J(w),
             renumbered: J(kept.map((r, i) => [String(r[0]), i + 1])) === J(witness("state:factorder").map((r) => [String(r[0]), r[1]])),
             canonOnly: c.filter((r) => !WN.has(String(r[0]))).map((r) => String(r[0])) })
      // 506 -> 541 (2026-09-21): a fully-derived head is stored, so the 16
      // binary `*` heads with a spanning uniqueness are objectified as any
      // asserted many-to-many is, and their 35 involvement fact types (two per
      // binary, three for Status reaches Status in State Machine Definition,
      // four for Status has effective Transition to Status on Event Type) take
      // a place in the sequence; the heads themselves were in it already.
      .toEqual({ canon: 541, witness: 541, kept: 541, sequence: true, renumbered: true, canonOnly: [] });
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
describe("canon's state:setcmp against the witness, on the base metamodel", () => {
  const META = join(import.meta.dir, "..", "..", "metamodel");
  const files = readdirSync(META).filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "core.md" ? "0" : a).localeCompare(b === "core.md" ? "0" : b));
  const rows = [];
  for (const f of files) for (const s of Ev("read:sentences", readFileSync(join(META, f), "utf8"))) rows.push(Ev("read:row_of", s));
  const F = Ev("read:x_full", Ev("read:x_of", rows));
  const J = (x) => JSON.stringify(x);

  test("canon's state:setcmp is the witness's, row for row and recipe for recipe", () => {
    const w = Ev("ast:fetch", ["state:setcmp", CELLS]).flat(1).map(J);
    const c = Ev("read:setcmp_state", F).map(J);
    const W = new Set(w), C = new Set(c);
    expect({ witness: w.length, canon: c.length, order: J(w) === J(c),
             oracleOnly: w.filter((r) => !C.has(r)), canonOnly: c.filter((r) => !W.has(r)) })
      .toEqual({ witness: 9, canon: 9, order: true, oracleOnly: [], canonOnly: [] });
  }, 300_000);

  // the value condition the step triples could never say: the superset leg is
  // `sel` around the fact type, and dropped it would read every World Assumption
  test("the valued leg is a sel and the joined legs are one joinon each", () => {
    const c = Ev("read:setcmp_state", F);
    expect(J(c[0])).toBe(J(["subset", "alethic", [["ObjectTypeIsBackedByExternalSystem", 1]],
                            [["ObjectTypeHasWorldAssumption", 1]],
                            [["proj", "ObjectTypeIsBackedByExternalSystem", [1]],
                             ["proj", ["sel", "ObjectTypeHasWorldAssumption", 2, "open"], [1]]]]));
    expect(J(c[1][4])).toBe(J([["proj", "EventCausedTransition", [1, 2]],
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
      "EventIsInvolvedInEventCausedTransition", "FactIsInvolvedInGuardRunReferencesFact",
      "FactIsInvolvedInRoleInstance", "FailureIsInvolvedInFailureSucceedsViolation",
      "GuardIsInvolvedInGuardReferencesFactType", "PredicateIsInvolvedInFactIsReferencedByPredicate",
      "RoleIsInvolvedInRoleInstance", "RoleIsInvolvedInRoleIsUsedInReading",
      "StateMachineDefinitionIsInvolvedInStatusIsDefinedInStateMachineDefinition",
      "StatusIsInvolvedInStatusIsDefinedInStateMachineDefinition", "StatusIsInvolvedInStatusIsDefinedInStateMachineDefinition",
      "TransitionIsInvolvedInEventCausedTransition", "ViolationIsInvolvedInFailureSucceedsViolation"]);
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
  test("read:design_state names state:setcmp", () => {
    const names = Ev("read:design_state_of", rows).map((c) => String(c[0]));
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
describe("canon's reader carries the chain's named shapes", () => {
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
  // both sides before comparing; canon keyed on the words as written and the
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
describe("canon's reader reads a numeral, a scheme's order and a marker", () => {
  const J = (x) => JSON.stringify(x);
  const stateOf = (cell, text) =>
    Ev(cell, Ev("read:x_full", Ev("read:x_of", Ev("read:sentences", text).map((s) => Ev("read:row_of", s)))));

  // apps/auto.dev/cost-attribution.md and listings.md, against
  // apps/support.auto.dev/.check/design-state: the witness's state:otpops
  // carries Amount, Max Mileage, Year and twenty more, canon carried none of
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
  // through read:entity_names, which sorts, so canon's began at the
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
// reference modes have KINDS -- popular, unit-based, general -- and canon wrote
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
describe("canon's reader reads a reference mode's kind and its name", () => {
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
// ---- A REFLECTED POPULATION KEEPS THE ROWS THE STORE ASSERTS (#122 item 1) ----
//
// loadReflected installs canon's reflection as the cell of that name, and the
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
    // way loadStoreDb adopts a table's rows; adoptStore reflects again
    adoptStore(Ev("store:src_all", [[[MOD, [["x-asserted", "Deontic"]]], [TYPE, [["x-asserted", "DF_owa"]]], [SPAN, [["x-asserted", ROLE]]]], CELLS]));
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
// on the base design state before this: ObjectTypeInstanceIsInstanceOfObjectType
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
  // design state cannot pay: loadStoreDb files the instance rows a write-back
  // leaves into state:otpops, which is what ui:ids reads, so `Each Reading has
  // exactly one Text` and `Each Reading is used by exactly one Predicate` bind
  // from the second boot on -- measured 104 and 506 alethic mandatory
  // violations, and the create then answers 409. This is the price, stated:
  // reflect Reading only when both can be answered.
  const readings = new Set(rows("FactTypeHasReading").map(([, rd]) => rd));
  if (rows("ObjectTypeInstanceIsInstanceOfObjectType").some(([, ot]) => ot === "Reading")) {
    expect([rows("ReadingHasText").length, rows("ReadingIsUsedByPredicate").length])
      .toEqual([readings.size, readings.size]);
  }
  // the cell is still the union, so what the build filed and the reflection
  // does not answer is still there
  expect(rows("ObjectTypeInstanceIsInstanceOfObjectType").some(([, ot]) => ot === "Subtype Fact")).toBe(true);
}, 120_000);
