// compose — byte-level concatenation, the linker's job and nothing more:
// prolog.js ; arest ; design-state ; norma-answer ; epilog.js -> runner.js.
// The ';' separators make each tuple literal its own expression statement.
// runner.js is generated (untracked); node runner.js executes the canon as
// source — no eval, no readFile, no interpretation by host code.
"use strict";
const fs = require("fs");
const path = require("path");
const here = __dirname;
const parts = [
  path.join(here, "prolog.js"),
  path.join(here, "..", "..", "arest"),
  path.join(here, "..", "norma-oracle", "design-state"),
  path.join(here, "..", "norma-oracle", "norma-answer"),
  path.join(here, "epilog.js"),
];
fs.writeFileSync(path.join(here, "runner.js"),
  parts.map(p => fs.readFileSync(p, "utf8")).join("\n;\n"));
console.log("composed runner.js = " + parts.map(p => path.basename(p)).join(" ; "));
