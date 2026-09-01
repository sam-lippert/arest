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
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
