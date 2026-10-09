// Compose a runnable module by byte concatenation: the host, then lambda and
// the carriers, then the call that starts it.
//
// Lambda is intersection source -- one file that is simultaneously valid in
// every host language -- so the JS parser is what reads it here, and no host
// carries a lambda parser of its own. Lambda is ONE tuple literal, so writing the
// bare token LAMBDA immediately before it makes those parens an argument list:
// `function LAMBDA(){ return arguments; }` catches it and the DEF side effects
// populate CELLS in registration order.
//
// THAT SPLICE IS THIS FILE'S JOB, NOT THE HOST'S. It used to live in seven
// `.part.js` files -- a head, five mids and a tail -- of which about twenty
// lines were semicolons and LAMBDA tokens. There is one host file now, host.js,
// and the punctuation is emitted here where it belongs.
//
// In bun rather than `copy /b` because the shell-specific build is not portable
// and does not fail loudly: the cmd form silently produced a 38KB file with
// every large input missing, which would have run an empty lambda and passed. So
// each input is checked for existence and the result is checked for size.
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const here = import.meta.dir;
const root = join(here, "..", "..");
// which carriers to compose in. The oracle's are the default; an app's own
// design-state and norma-answer are the same two files elsewhere,
// so a per-app build is this one pointed at a different directory.
const oracle = process.env.AREST_CARRIERS || join(here, "..", "carriers", "base");

// lambda, the case table, then the carriers. The case table rides in the same
// module as the laws rather than a second composition, because the case cells
// do not disturb law:report -- the base report is byte-identical with and
// without them -- and one module then answers both `law:report` and `case`.
// THE REGRESS MODE COMPOSES NO SCHEMA. law:regress_report reads the run's
// outcome (state:built, state:errors, state:readback, the oracle's `outcome`
// carrier) and the record (`expected`), nothing else; composing us-law's
// 15 MB design-state beside them cost the host two minutes to load the
// module and minutes more in the derivation closure before the three rows
// could be answered (2026-09-04). Lambda, the outcome and the record boot in
// seconds on any store.
// THE READER MODE COMPOSES LAMBDA ALONE AND BOOTS NOTHING. It is the host of
// tools/compile-design-state.js: lambda's reader needs no carrier, and the
// carrier it writes is the one every other mode composes.
// AND THE COMPILE MODE IS THE READER'S COMPOSITION WITH THE CLI TAIL (2026-09-29). The compile is
// lambda's address now -- `bun compile.g.js compile <out> <dir>...`, main routing it to compile:run --
// and it reads its schema from the readings it is handed, so it composes no carrier, the reader's
// reason; boot falls through to run_cli for a mode it does not name, which is the six-line contract.
const slim = process.argv[2] === "regress" || process.argv[2] === "reader" || process.argv[2] === "compile";
// THE WITNESS'S ANSWER IS NOT A BUILD INPUT. norma-answer is NORMA's own
// relational answer, composed so the rmap-vs-NORMA laws can compare; a
// carriers directory lambda wrote (tools/compile-design-state.js) has none,
// and the build is the same build without it.
// THE TESTS RIDE ONLY IN A TEST COMPOSITION. arest.tests holds lambda's law:
// cells; cli (the report), test (the suite's module) and regress run them, and
// every served or compiling module composes arest alone.
const TESTS = ["cli", "test", "regress"].includes(process.argv[2] || "cli") ? [join(root, "arest.tests")] : [];
const SPLICED = slim ? [join(root, "arest"), ...TESTS] : [
  join(root, "arest"),
  ...TESTS,
  join(root, "engine", "shared", "scenarios.canon"),
  join(oracle, "design-state"),
  ...(existsSync(join(oracle, "norma-answer")) ? [join(oracle, "norma-answer")] : []),
];
// AND THESE ARE WHAT DECIDE THE POPULATIONS. The three optional carriers pushed
// below do not: `compiled` is a precomputed answer ABOUT the relational map
// (and carries a stamp of its own, checked twenty lines down), `outcome` and
// `expected` are a run's record, read only by the regress laws. A store.db is a
// projection of the POPULATIONS, so its identity is these and not those --
// measured 2026-09-11, when hashing all seven gave support.auto.dev's
// cases.g.js and composed.g.js two different stamps for one store, because its
// build writes cases.g.js before `compiled` and composed.g.js after.
// The tests decide no population either, so a test composition and a served
// one over the same carriers have the same identity.
const IDENTITY = SPLICED.filter((p) => !TESTS.includes(p));

// THE COMPILED RELATIONAL MAP IS OPTIONAL, and optional is the whole point: a
// store that has not been compiled still runs, it just pays the Rmap
// derivation the way every store did before tools/compile-rmap.js existed.
// Splicing it when present is what makes rmap run for uncompiled schemas only.
if (!slim) try {
  const carrier = readFileSync(join(oracle, "compiled"), "utf8");
  const stamped = (carrier.match(/AREST_COMPILED_FROM=([0-9a-f]+)/) || [])[1];
  // KEYED ON LAMBDA AS WELL AS THE SCHEMA (2026-10-07, task #197). The map is
  // lambda's answer about design-state, and each rmap:X reads stored:rmap:X
  // before it derives, so a cache written by another lambda overrode the new
  // DEFs while its design-state-only stamp still matched. compile:stamped
  // stamps the lambda text followed by the design-state text; this hashes the
  // same two files in the same order (law:compiled_keyed pins both).
  const now = createHash("sha256")
    .update(readFileSync(join(root, "arest")))
    .update(readFileSync(join(oracle, "design-state")))
    .digest("hex").slice(0, 16);
  if (stamped === now) {
    SPLICED.push(join(oracle, "compiled"));
  } else {
    // STALE, SO DECLINE IT. The carrier is derived FROM design-state by lambda,
    // and a schema regenerated or a lambda changed since leaves it describing
    // tables that no longer exist. Not splicing is the safe direction: lambda derives instead, which
    // is slower and correct. Splicing it is neither.
    console.error("compiled carrier is stale (built from " + (stamped || "?") +
      ", lambda and design-state are now " + now + "); deriving instead. Regenerate with:");
    console.error("  (compile-rmap.js is gone: compilation is moving into lambda, #109)");
  }
} catch {
  /* uncompiled schema: lambda derives instead */
}

// THE RECORDED EXPECTATION IS OPTIONAL TOO. The oracle writes every run's
// outcome into design-state (state:built, state:errors, state:readback) and
// the same under expect: names into `expectation`; an accepted run's copy,
// placed in the carriers directory as `expected`, is composed in, and
// law:regress holds the store to it (`bun composed.g.js regress`). A directory
// without one is a store nobody has recorded, and the law holds of it.
// The run's own outcome rides in `outcome`, three surfaces the oracle writes
// beside design-state every run; a carriers directory from before it has
// none, and the regress laws then hold vacuously of the store.
for (const carrier of ["outcome", "expected"]) {
  try {
    statSync(join(oracle, carrier));
    SPLICED.push(join(oracle, carrier));
  } catch {
    /* not written, or nothing recorded */
  }
}

const mode = process.argv[2] || "cli";
const OUT = { cli: "composed", test: "cases", serve: "serve", mcp: "mcp", sql: "sql", ui: "ui", regress: "regress", reader: "reader", compile: "compile", page: "page" };
if (!(mode in OUT)) {
  console.error("unknown mode: " + mode + " (cli, test, serve, mcp, sql, ui, regress, reader, page)");
  process.exit(1);
}

function must(p) {
  try {
    statSync(p);
  } catch {
    console.error("missing composition input: " + p);
    process.exit(1);
  }
  // an EMPTY carrier is legitimate, so emptiness is not an error here; the
  // size check below catches a lost input
  return readFileSync(p);
}

// ---- THE CARRIERS ARE SPLICED AS TEXT THE HOST READS ------------------------
// 8.6 s of the support module's 13.8-second load was bun parsing 50 MB of
// nested constructor calls, three quarters of them the three carriers
// (2026-09-07). A carrier is data: design-state, norma-answer and the compiled
// map are spliced as ONE literal each, in their own intersection source, and
// the host reads the literal at load (LAMBDATEXT in host.js) into the value the
// constructors would have built -- the same DEF registrations, the prose
// dropped as LAMBDA dropped it. The carrier stays the carrier, inside the
// composition, and nothing is read from a path beside the module: a JSON
// sidecar stood here for an hour and Sam's answer was "Codd says no". The
// lambda and the scenarios stay spliced as source: they are code, and small.
// The rust build reads the carrier files themselves and is unaffected. The
// literal is a template string, so only its three delimiters are escaped.
const AS_TEXT = new Set([join(oracle, "design-state"), join(oracle, "norma-answer"), join(oracle, "compiled")]);
function asLiteral(text) {
  return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

// A RELEASE MODULE CARRIES NO INSTRUMENTS (Sam, 2026-09-07: "we don't want
// to leave perf counters in a release build"). The host's profiler, stamp and
// trace live between `// @instrument-begin` and `// @instrument-end`, and the
// lines that call them in the evaluator end with `// @instrument`; both are
// dropped here unless the composition is asked to be instrumented
// (AREST_INSTRUMENTED=1), which is what a 30-second sample composes. A
// release module therefore has no counter, no stamp and no clock in the hot
// path, and the gates run on the module that ships.
function hostSource() {
  const text = must(join(here, "host.js")).toString("utf8");
  if (process.env.AREST_INSTRUMENTED) return Buffer.from(text);
  const out = [];
  let inside = false;
  for (const line of text.split("\n")) {
    const t = line.trimEnd();
    if (t.endsWith("// @instrument-begin")) { inside = true; continue; }
    if (t.endsWith("// @instrument-end")) { inside = false; continue; }
    if (inside || t.endsWith("// @instrument")) continue;
    out.push(line);
  }
  return Buffer.from(out.join("\n"));
}

// AND THE COMPOSITION'S IDENTITY IS ITS LAMBDA AND ITS CARRIERS, NOT ITS HOST.
// tools/compile-store.js projects the booted populations into <dir>/store.db
// and the host boots serve and mcp from it; the database is therefore a
// projection of IDENTITY above and goes stale when any of it changes. The host
// source is deliberately not hashed: a comment or a strategy in host.js does
// not move a population, and hashing it would invalidate every database on
// every host edit. Measured 2026-09-11: the base store.db of 09-08 booted into
// the current module and `schema` threw `selector 2 out of range 1`, while the
// same call over a database rebuilt from it is byte-identical to a carriers
// boot -- the stale database lacked four fact types that had since become
// populated, and nothing anywhere said so.
const composition = createHash("sha256");
const parts = [hostSource()];
// THE PAGE HOST RIDES ONLY IN A PAGE COMPOSITION (2026-10-07, task #200): page.js is one more host, the one an
// artifact page runs, and its registrations (the in-page SQLite engine, the page's navigate) follow host.js.
if (mode === "page") parts.push(Buffer.from("\n;\n"), must(join(here, "page.js")));
for (const p of SPLICED) {
  const buf = must(p);
  if (IDENTITY.includes(p)) composition.update(buf);
  if (AS_TEXT.has(p)) { parts.push(Buffer.from("\n;\nLAMBDATEXT(" + asLiteral(buf.toString("utf8")) + ");\n")); continue; }
  parts.push(Buffer.from("\n;\nLAMBDA"), buf);
}
// STAMP THE CARRIERS THIS COMPOSITION WAS MADE FROM. tools/compile-rmap.js
// writes beside AREST_CARRIERS but reads whatever composition is on disk, so
// the two can disagree and it will emit one store's relational map into
// another's directory. That happened twice today. This is what lets it refuse.
parts.push(Buffer.from([""," // AREST_CARRIERS_DIR=" + oracle, ""].join(String.fromCharCode(10))));
parts.push(Buffer.from("\n;\nCOMPOSED(" + JSON.stringify(composition.digest("hex").slice(0, 16)) + ");\n"));
// AND WHERE ITS LAMBDA CAME FROM (2026-09-30): module:root answers it, so a compile can stamp a store
// with the identity of the module that will read it, which is these same files hashed.
parts.push(Buffer.from("\n;\nROOTED(" + JSON.stringify(root.split(String.fromCharCode(92)).join("/")) + ");\n"));
parts.push(Buffer.from("\n;\nboot(" + JSON.stringify(mode) + ");\n"));

const out = Buffer.concat(parts);
if (out.length < 1_000_000) {
  console.error("composition is " + out.length + " bytes; lambda alone is over 1MB");
  process.exit(1);
}
const name = OUT[mode] + ".g.js";
// AREST_OUT_DIR puts the module elsewhere: a corpus theory composes each
// store into its own scratch directory rather than over this directory's
// modules, which are the base store's
const outDir = process.env.AREST_OUT_DIR || here;
writeFileSync(join(outDir, name), out);
// --run COMPOSES AND THEN STARTS THE MODULE, so a launcher (the MCP entry in
// .mcp.json) never runs a stale composition: the module the harness started on
// 2026-09-03 had been built two days earlier and took two minutes to boot, past
// the client's thirty-second limit, while a current one boots in eight. In this
// mode stdout belongs to the module (it is the MCP channel), so the size line
// goes to stderr with the rest of the build's chatter.
const run = process.argv.includes("--run");
(run ? console.error : console.log)(name + ": " + out.length + " bytes from " + (SPLICED.length + 2) + " inputs");
if (run) {
  // the module's own arguments follow `--` (`build.js ui --run -- --serve`,
  // `build.js ui --run -- --text Task`); they were dropped until 2026-09-07,
  // so `bun run ui` composed a container and then ran it with no address
  const sep = process.argv.indexOf("--");
  const rest = sep < 0 ? [] : process.argv.slice(sep + 1);
  // A CHECK'S HEAP GROWS BY A QUARTER BEFORE THE ENGINE COLLECTS, NOT TWOFOLD (2026-10-02;
  // Sam: this should be capable of running on a Commodore). JavaScriptCore sizes a heap's
  // growth from the machine's memory: a heap under a quarter of it may double before a full
  // collection, and on a 16 GB machine every heap a check holds is under that. Sampled with a
  // collection every ten seconds, support's check held 260 to 740 MB live, and run as it ran,
  // it peaked at 2.7 to 3.0 GB of working set: the rest was garbage the engine had not yet
  // collected and pages it had not yet given back. So a check's module runs with the factor
  // JavaScriptCore itself gives a heap it calls large (1.24) at the two smaller sizes as well.
  // Only when and how much is collected changes, never what is computed. An environment that
  // sets either factor keeps its own.
  const env = { ...process.env };
  if (mode === "compile") {
    if (env.BUN_JSC_smallHeapGrowthFactor === undefined) env.BUN_JSC_smallHeapGrowthFactor = "1.25";
    if (env.BUN_JSC_mediumHeapGrowthFactor === undefined) env.BUN_JSC_mediumHeapGrowthFactor = "1.25";
  }
  const proc = Bun.spawn(["bun", join(outDir, name), ...rest], { stdio: ["inherit", "inherit", "inherit"], env });
  const code = await proc.exited;
  // THE STORE A COMPILE WRITES IS JUDGED BY THE COMPILE (2026-10-07, task #194). From 2026-10-03 this
  // composed a second module (serve, 14 MB) over the carriers the compile wrote, booted it on the store
  // with AREST_VERDICT and had it record T or F in _verdict: about 49 s of whole check on support beside
  // the composition and the boot. The compile holds the closed store already, so lambda judges it there
  // and writes _verdict with the other records before the store is put in place (compile:judge): only
  // the constraints its changes touched when the store it replaces was known clean, else the whole check.
  process.exit(code);
}
