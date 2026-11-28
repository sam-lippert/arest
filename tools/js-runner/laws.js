// The lambda laws over the booted base, one by one, a peer of the Java law run: boot the store once
// (main:boot over the cells, as program.js reads them), then apply each named law to it and print
// its name, its answer and its time. A law answers T or it fails; an error is its answer too.
//
//   bun laws.js <list-file | law...>
//
// The list file holds one law name per line (the suite's list, e.g. arest.tests' test:* names).
// Nothing here decides an answer: the laws are lambda's, and this only applies them. A law cannot
// be stopped once it runs, since a host evaluates synchronously; bound the whole run from outside.
"use strict";
const fs = require("fs");
const A = require("./arest.js");
const lambda = A.path("AREST_LAMBDA", __dirname + "/../../arest");
A.load(lambda);
A.load(A.path("AREST_TESTS", __dirname + "/../../arest.tests"));
A.load(A.path("AREST_SCENARIOS", __dirname + "/../../engine/shared/scenarios.canon"));
A.loadBase(A.path("AREST_CARRIERS", __dirname + "/../base"), lambda);
require("./registrations.js").register(lambda);

// LAWTRACE: a diagnosis aid, never an answer. A SQLite refusal is given the statement it refused, and a
// failing law prints the lambda names it was inside when it died, innermost last.
const TRACE = process.env.LAWTRACE !== undefined;
const PATH = [];
const SQL = [];
const BASEPRIM = new Set(["id","tl","atom","apndl","apndr","distl","distr","cat","null","eq","not","and","length","lt","le","ge","gt","reverse","trans","+","-","*","/","apply","lex","implode","chars","1r","tlr"]);
let LAWS_STARTED = false;
// a text in the answer that looks like JSON (starts with [ or {), looked for in at most n atoms
function jsonish(v, n) {
  const st = [v];
  while (st.length && n-- > 0) {
    const x = st.pop();
    if (Array.isArray(x)) { for (const e of x) st.push(e); continue; }
    if (typeof x === "string" && x.length > 1 && (x[0] === "[" || x[0] === "{")) return true;
  }
  return false;
}
if (TRACE) {
  const { Database } = require("bun:sqlite");
  for (const m of ["query", "prepare", "exec", "run"]) {
    const f = Database.prototype[m];
    Database.prototype[m] = function (sql, ...rest) {
      try { return f.call(this, sql, ...rest); }
      catch (e) { e.message += " -- SQL: " + String(sql).substring(0, 4000); throw e; }
    };
  }
  // which primitive last answered the text "[]" (a text where lambda may expect a sequence), and on what
  const prims = A.PRIMS;
  for (const [name, impl] of [...prims]) {
    prims.set(name, (x) => {
      let r;
      try { r = impl(x); }
      catch (e) { if (!e.lambdaPath) { e.lambdaPath = name; e.lambdaArg = A.show(x).substring(0, 600); } throw e; }
      if (r === "[]" || (Array.isArray(r) && r.some((row) => Array.isArray(row) && row.includes("[]"))))
        PATH.push(name + " on " + A.show(x).substring(0, 1500));
      if (LAWS_STARTED && !BASEPRIM.has(name) && process.env.LAWTRACE === "sql" && jsonish(r, 2000))
        SQL.push(name + " ASKED " + A.show(x).substring(0, 3000) + " ANSWERED " + A.show(r).substring(0, 800));
      return r;
    });
  }
}

// AREST_DUMP=<file>: every cell loaded, one "<name>\t<body>" a line in load order, the body in the vocabulary's own
// canonical spelling (S(...), A("..."), N(n); a text escapes backslash, quote, \n, \r, \t), the same spelling every
// host's law run writes, so two loads (a file in two forms, or two hosts) compare line for line. Nothing is booted.
if (process.env.AREST_DUMP) {
  const ESC = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" };
  const canon = (x) => Array.isArray(x) ? "S(" + x.map(canon).join(",") + ")"
    : typeof x === "bigint" ? "N(" + x + ")"
    : 'A("' + String(x).replace(/[\\"\n\r\t]/g, (c) => ESC[c]) + '")';
  fs.writeFileSync(process.env.AREST_DUMP, A.CELLS.map((c) => c[1] + "\t" + canon(c[2])).join("\n") + "\n");
  process.exit(0);
}

let names = process.argv.slice(2);
if (names.length === 1 && fs.existsSync(names[0])) {
  names = fs.readFileSync(names[0], "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== "");
}

const now = () => Number(process.hrtime.bigint() / 1000000n);
let t = now();
const store = A.Ev("main:boot", A.CELLS.slice());
console.log("boot " + (now() - t) + " ms");
if (TRACE) LAWS_STARTED = true;

let bad = 0;
for (const l of names) {
  t = now();
  let r;
  try {
    const o = A.Ev(l, store);
    r = Array.isArray(o) ? "SEQ " + o.length + (process.env.LAWSHOW ? " " + A.show(o).substring(0, 6000) : "") : A.show(o);
  } catch (e) {
    r = ("ERROR " + String(e && e.message).replace(/\n/g, " ")).substring(0, TRACE ? 6000 : 260);
    if (TRACE && e && e.lambdaPath) r += " [in primitive " + e.lambdaPath + " on " + e.lambdaArg + "]";
    if (TRACE && PATH.length) r += " [last '[]' from " + PATH.slice(-3).join(" | ") + "]";
    if (TRACE && SQL.length) { r += "\n  SQL that answered JSON-like text, last 2:\n    " + SQL.slice(-2).join("\n    "); SQL.length = 0; }
  }
  if (r !== "T") bad++;
  console.log(l + " " + r + " " + (now() - t) + " ms");
}
console.log(names.length + " laws, " + bad + " not T");
process.exitCode = bad === 0 ? 0 : 1;
