// epilog-app — apply the canon's law:app_report to the composed store and
// print the verdicts. Effects only, the Platform seam.
"use strict";
{
  let report;
  try {
    report = ev("law:app_report", CELLS);
  } catch (e) {
    report = [["law:app_report", "F (" + e.message + ")"]];
  }
  let ok = true;
  for (const pair of report) {
    const pass = pair[1] === "T";
    ok = ok && pass;
    console.log((pass ? "  law OK: " : "  LAW FAILED: ") + pair[0] +
      (pass ? "" : " -> " + pair[1]));
  }
  console.log(ok
    ? "ALL APP LAWS HOLD (canon-evaluated: law:app_report over the composed store)"
    : "APP LAW FAILURE");
  process.exit(ok ? 0 : 1);
}
