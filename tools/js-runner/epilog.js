// epilog — apply the canon's own law:report to the composed store and print
// the verdicts. No law semantics live here: printing and the exit code are
// effects, the Platform seam.
"use strict";
{
  let report;
  try {
    report = ev("law:report", CELLS);
  } catch (e) {
    // localize: apply each law separately so one failure names itself
    report = [];
    for (const name of ["law:rmap_idempotence", "law:table_is_fetch",
      "law:schema_match", "law:origin_boundary", "law:population_consistency",
      "law:currying", "law:emission", "law:navmap", "law:induce", "law:derive", "law:rules", "law:finiteness", "law:induce_facts", "law:machine", "law:catalog", "law:apply", "law:thm1", "law:thm2"]) {
      try { report.push([name, ev(name, CELLS)]); }
      catch (err) { report.push([name, "F (" + err.message + ")"]); }
    }
  }
  let ok = true;
  for (const pair of report) {
    const pass = pair[1] === "T";
    ok = ok && pass;
    console.log((pass ? "  law OK: " : "  LAW FAILED: ") + pair[0] +
      (pass ? "" : " -> " + pair[1]));
  }
  console.log(ok
    ? "ALL LAWS HOLD (canon-evaluated: law:report over the composed store)"
    : "LAW FAILURE");
  process.exit(ok ? 0 : 1);
}
