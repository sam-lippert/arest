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
      return r;
    });
  }
}

let names = process.argv.slice(2);
if (names.length === 1 && fs.existsSync(names[0])) {
  names = fs.readFileSync(names[0], "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== "");
}

const now = () => Number(process.hrtime.bigint() / 1000000n);
let t = now();
const store = A.Ev("main:boot", A.CELLS.slice());
console.log("boot " + (now() - t) + " ms");

let bad = 0;
for (const l of names) {
  t = now();
  let r;
  try {
    const o = A.Ev(l, store);
    r = Array.isArray(o) ? "SEQ " + o.length : A.show(o);
  } catch (e) {
    r = ("ERROR " + String(e && e.message).replace(/\n/g, " ")).substring(0, TRACE ? 6000 : 260);
    if (TRACE && e && e.lambdaPath) r += " [in primitive " + e.lambdaPath + " on " + e.lambdaArg + "]";
    if (TRACE && PATH.length) r += " [last '[]' from " + PATH.slice(-3).join(" | ") + "]";
  }
  if (r !== "T") bad++;
  console.log(l + " " + r + " " + (now() - t) + " ms");
}
console.log(names.length + " laws, " + bad + " not T");
process.exitCode = bad === 0 ? 0 : 1;
