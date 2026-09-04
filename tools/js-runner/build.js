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
import { createHash } from "node:crypto";
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
  const carrier = readFileSync(join(oracle, "compiled"), "utf8");
  const stamped = (carrier.match(/AREST_COMPILED_FROM=([0-9a-f]+)/) || [])[1];
  const now = createHash("sha256")
    .update(readFileSync(join(oracle, "design-state")))
    .digest("hex").slice(0, 16);
  if (stamped === now) {
    SPLICED.push(join(oracle, "compiled"));
  } else {
    // STALE, SO DECLINE IT. The carrier is derived FROM design-state, and a
    // schema regenerated since leaves it describing tables that no longer
    // exist. Not splicing is the safe direction: canon derives instead, which
    // is slower and correct. Splicing it is neither.
    console.error("compiled carrier is stale (built from " + (stamped || "?") +
      ", design-state is now " + now + "); deriving instead. Regenerate with:");
    console.error("  AREST_CARRIERS=" + oracle + " bun tools/compile-rmap.js");
  }
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

// A journal that has never been written is ABSENT, not empty, and absent is
// the ordinary state of an app store that has only ever been checked. It is
// the same case as an uncompiled schema having no `compiled` carrier: the
// composition is well-formed without it, so read it as the empty journal
// rather than refusing to build. Only the two derived carriers are required.
function mayBe(p) {
  try {
    return readFileSync(p);
  } catch {
    return Buffer.alloc(0);
  }
}

const parts = [must(join(here, "host.js"))];
for (const p of SPLICED) {
  parts.push(Buffer.from("\n;\nCANON"), must(p));
}
parts.push(Buffer.from('\n;\nCANON("journal"'), mayBe(JOURNAL), Buffer.from(")"));
parts.push(Buffer.from("\n;\nJOURNAL_PATH = " + JSON.stringify(JOURNAL) + ";\n"));
// STAMP THE CARRIERS THIS COMPOSITION WAS MADE FROM. tools/compile-rmap.js
// writes beside AREST_CARRIERS but reads whatever composition is on disk, so
// the two can disagree and it will emit one store's relational map into
// another's directory. That happened twice today. This is what lets it refuse.
parts.push(Buffer.from([""," // AREST_CARRIERS_DIR=" + oracle, ""].join(String.fromCharCode(10))));
parts.push(Buffer.from("\n;\nboot(" + JSON.stringify(mode) + ");\n"));

const out = Buffer.concat(parts);
if (out.length < 1_000_000) {
  console.error("composition is " + out.length + " bytes; canon alone is over 1MB");
  process.exit(1);
}
const name = OUT[mode] + ".g.js";
writeFileSync(join(here, name), out);
// --run COMPOSES AND THEN STARTS THE MODULE, so a launcher (the MCP entry in
// .mcp.json) never runs a stale composition: the module the harness started on
// 2026-09-03 had been built two days earlier and took two minutes to boot, past
// the client's thirty-second limit, while a current one boots in eight. In this
// mode stdout belongs to the module (it is the MCP channel), so the size line
// goes to stderr with the rest of the build's chatter.
const run = process.argv.includes("--run");
(run ? console.error : console.log)(name + ": " + out.length + " bytes from " + (SPLICED.length + 2) + " inputs");
if (run) {
  const proc = Bun.spawn(["bun", join(here, name)], { stdio: ["inherit", "inherit", "inherit"] });
  process.exit(await proc.exited);
}
