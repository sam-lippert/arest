// Compose a runnable module by byte concatenation: the host, then canon and
// the carriers, then the call that starts it.
//
// Canon is intersection source -- one file that is simultaneously valid in
// every host language -- so the JS parser is what reads it here, and no host
// carries a canon parser of its own. Canon is ONE tuple literal, so writing the
// bare token CANON immediately before it makes those parens an argument list:
// `function CANON(){ return arguments; }` catches it and the DEF side effects
// populate CELLS in registration order.
//
// THAT SPLICE IS THIS FILE'S JOB, NOT THE HOST'S. It used to live in seven
// `.part.js` files -- a head, five mids and a tail -- of which about twenty
// lines were semicolons and CANON tokens. There is one host file now, host.js,
// and the punctuation is emitted here where it belongs.
//
// In bun rather than `copy /b` because the shell-specific build is not portable
// and does not fail loudly: the cmd form silently produced a 38KB file with
// every large input missing, which would have run an empty canon and passed. So
// each input is checked for existence and the result is checked for size.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const root = join(here, "..", "..");
// which carriers to compose in. The oracle's are the default; an app's own
// design-state, norma-answer and journal are the same three files elsewhere,
// so a per-app build is this one pointed at a different directory.
const oracle = process.env.AREST_CARRIERS || join(here, "..", "norma-oracle");

// canon, the case table, then the carriers. The case table rides in the same
// module as the laws rather than a second composition, because the case cells
// do not disturb law:report -- the base report is byte-identical with and
// without them -- and one module then answers both `law:report` and `case`.
const SPLICED = [
  join(root, "arest"),
  join(root, "engine", "shared", "scenarios.canon"),
  join(oracle, "design-state"),
  join(oracle, "norma-answer"),
];

// THE COMPILED RELATIONAL MAP IS OPTIONAL, and optional is the whole point: a
// store that has not been compiled still runs, it just pays the Rmap
// derivation the way every store did before tools/compile-rmap.js existed.
// Splicing it when present is what makes rmap run for uncompiled schemas only.
try {
  statSync(join(oracle, "compiled"));
  SPLICED.push(join(oracle, "compiled"));
} catch {
  /* uncompiled schema: canon derives instead */
}

// The journal is APPEND-ONLY and carries a leading doc atom, so it is spliced
// as CANON("journal", ...entries) rather than as a bare tuple: every entry is
// appended bytes, never a rewrite. An empty journal registers nothing.
const JOURNAL = join(oracle, "journal");

const mode = process.argv[2] || "cli";
const OUT = { cli: "composed", test: "cases", serve: "serve", mcp: "mcp", sql: "sql", ui: "ui" };
if (!(mode in OUT)) {
  console.error("unknown mode: " + mode + " (cli, test, serve, mcp, sql, ui)");
  process.exit(1);
}

function must(p) {
  try {
    statSync(p);
  } catch {
    console.error("missing composition input: " + p);
    process.exit(1);
  }
  // an EMPTY carrier is legitimate -- a fresh journal has no entries -- so
  // emptiness is not an error here; the size check below catches a lost input
  return readFileSync(p);
}

const parts = [must(join(here, "host.js"))];
for (const p of SPLICED) {
  parts.push(Buffer.from("\n;\nCANON"), must(p));
}
parts.push(Buffer.from('\n;\nCANON("journal"'), must(JOURNAL), Buffer.from(")"));
parts.push(Buffer.from("\n;\nJOURNAL_PATH = " + JSON.stringify(JOURNAL) + ";\n"));
parts.push(Buffer.from("\n;\nboot(" + JSON.stringify(mode) + ");\n"));

const out = Buffer.concat(parts);
if (out.length < 1_000_000) {
  console.error("composition is " + out.length + " bytes; canon alone is over 1MB");
  process.exit(1);
}
const name = OUT[mode] + ".g.js";
writeFileSync(join(here, name), out);
console.log(name + ": " + out.length + " bytes from " + (SPLICED.length + 2) + " inputs");
