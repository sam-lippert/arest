// compose — byte-level concatenation, the linker's job and nothing more:
// prolog.js ; arest ; design-state ; norma-answer ; epilog.js -> runner.js.
// With an app name: the app's carriers and the app epilog -> runner-<app>.js
// (the app report holds the generic laws plus Thm 1, Thm 2, and the
// per-entity schema comparison — an application legitimately emits its
// entities' own tables per Def 8; the one-table form is the metamodel's).
"use strict";
const fs = require("fs");
const path = require("path");
const here = __dirname;
const app = process.argv[2];
const carriers = app
  ? path.join(here, "..", "..", "apps", app)
  : path.join(here, "..", "norma-oracle");
const parts = [
  path.join(here, "prolog.js"),
  path.join(here, "..", "..", "arest"),
  path.join(carriers, "design-state"),
  path.join(carriers, "norma-answer"),
  path.join(here, app ? "epilog-app.js" : "epilog.js"),
];
const out = path.join(here, app ? "runner-" + app + ".js" : "runner.js");
fs.writeFileSync(out, parts.map(p => fs.readFileSync(p, "utf8")).join("\n;\n"));
console.log("composed " + path.basename(out) + " = " + parts.map(p => path.basename(p)).join(" ; "));
