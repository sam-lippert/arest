// Compose the TEST module by byte concatenation, the same contract as the
// shipped build -- head, canon, the case table, the carriers, then a tail that
// exposes instead of exits.
//
// In bun rather than `copy /b` because the shell-specific build is not portable
// and does not fail loudly: the cmd form silently produced a 38KB file with
// every large input missing, which would have tested an empty canon and passed.
// So each part is checked for existence and the result is checked for size.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const root = join(here, "..", "..");
const oracle = join(here, "..", "norma-oracle");

// which last step, and what it is called on disk. A tail is transport only:
// none of them may branch on a verb, a method or a status.
const TAIL = { serve: "serve-tail", mcp: "mcp-tail" };
const OUT = { serve: "serve", mcp: "mcp" };
const mode = process.argv[2];

const parts = [
  join(here, "head.part.js"),
  join(root, "arest"),
  join(here, "midcases.part.js"),
  join(root, "engine", "shared", "scenarios.canon"),
  join(here, "mid1.part.js"),
  join(oracle, "design-state"),
  join(here, "mid2.part.js"),
  join(oracle, "norma-answer"),
  join(here, "mid3.part.js"),
  join(oracle, "journal"),
  join(here, "mid4.part.js"),
  // the tail is the ONLY thing that varies between what this composes: the
  // test module exposes the evaluator, the serving module binds a socket, the
  // mcp module speaks JSON-RPC over stdio, and all three run the same canon
  // over the same carriers. `bun build-test.js serve` / `... mcp`
  join(here, TAIL[mode] || "test-tail") + ".part.js",
];

const chunks = [];
for (const p of parts) {
  let st;
  try {
    st = statSync(p);
  } catch {
    console.error("missing composition input: " + p);
    process.exit(1);
  }
  // an EMPTY carrier is legitimate -- a fresh journal has no entries -- so
  // emptiness is not an error here; the total-size check below is what catches
  // a composition that lost its inputs.
  chunks.push(readFileSync(p));
}

const out = Buffer.concat(chunks);
if (out.length < 1_000_000) {
  console.error("composition is " + out.length + " bytes; canon alone is over 1MB");
  process.exit(1);
}
writeFileSync(join(here, (OUT[mode] || "cases") + ".g.js"), out);
console.log((OUT[mode] || "cases") + ".g.js: " + out.length + " bytes from " + parts.length + " parts");
