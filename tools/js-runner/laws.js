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
    r = ("ERROR " + String(e && e.message).replace(/\n/g, " ")).substring(0, 260);
  }
  if (r !== "T") bad++;
  console.log(l + " " + r + " " + (now() - t) + " ms");
}
console.log(names.length + " laws, " + bad + " not T");
process.exitCode = bad === 0 ? 0 : 1;
