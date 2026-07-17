;
// ---- effects only, the Platform seam: apply the canon's own report to the
// composed store and print the verdicts. No fallback lists, no guards, no
// comparison logic — localizing a failure is a probe you write when you need
// it and delete when you're done (standing features are how the last two
// runners died). The per-law lines are byte-identical to the C# station so a
// diff of the two captures is the parity check itself.
const reportName = (process.argv[2] === "app") ? "law:app_report" : "law:report";
const report = Ev(reportName, CELLS);
let ok = true;
for (const pair of report) {
  const pass = pair[1] === "T";
  ok = ok && pass;
  console.log((pass ? "  law OK: " : "  LAW FAILED: ") + pair[0] + (pass ? "" : " -> F"));
}
console.log(ok
  ? "ALL LAWS HOLD (canon-evaluated: " + reportName + " over the composed store)"
  : "LAW FAILURE");
process.exit(ok ? 0 : 1);
