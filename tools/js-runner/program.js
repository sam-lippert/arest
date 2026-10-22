// THE HOST CONTRACT, a peer of tools/java-runner/Program.java: read lambda, the case table and the carriers, register
// the platform, and print what lambda's `main` answers over the cells and the command line. All dispatch and all
// text live in lambda; a new operation is a lambda edit, never a host edit.
//
//   bun program.js <address...>
"use strict";
const A = require("./arest.js");
const lambda = A.path("AREST_LAMBDA", __dirname + "/../../arest");
A.load(lambda);
A.load(A.path("AREST_TESTS", __dirname + "/../../arest.tests"));
A.load(A.path("AREST_SCENARIOS", __dirname + "/../../engine/shared/scenarios.canon"));
A.loadCarriers(A.path("AREST_CARRIERS", __dirname + "/../carriers/base"), lambda);
require("./registrations.js").register(lambda);
const out = A.Ev("main", [A.CELLS.slice(), process.argv.slice(2)]);
process.stdout.write(A.show(out[0]) + "\n");
process.exitCode = out[1] === "T" ? 0 : 1;
