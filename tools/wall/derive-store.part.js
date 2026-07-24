;
// Derive-and-store harness: evaluate each scoped cell once (the
// dispatch live-derives on the pristine store) and emit the
// derived-state carrier as comma-led DEF entries for the journal
// segment (CANON("journal" ... ) call arguments).
const SCOPE = ["rmap:gmi","rmap:s1p","rmap:childrenN","rmap:children0",
  "rmap:assim","rmap:cts","rmap:tablects","rmap:tables","rmap:uniqs",
  "rmap:djrows","rmap:pidfacts","rmap:evident","rmap:pidchains",
  "rmap:colpathsP","rmap:colpaths","rmap:cexp","rmap:nreadings",
  "rmap:colnames","rmap:ncprows","rmap:ncp3","rmap:nmrows","rmap:ncrows",
  "rmap:narows","rmap:nrrows","rmap:nirows","rmap:nurows","rmap:ntnames",
  "rmap:ctab","rmap:g2","rmap:coltabs","rmap:ntabs"];
const fs = require("fs");
const t0 = Date.now();
let n = 0;
fs.writeFileSync(process.env.DERIVED_OUT, "");
for (const name of SCOPE) {
  const s = Date.now();
  let v;
  try { v = Ev(name, CELLS); }
  catch (e) { console.log("SKIP\t" + name + "\t" + String(e).slice(0, 80)); continue; }
  // append per cell: a killed run keeps its prefix on disk
  fs.appendFileSync(process.env.DERIVED_OUT,
    ",\nDEF(\"stored:" + name + "\", " + JSON.stringify(v) + ")");
  n++;
  // incremental: later cells' dispatches fetch this result instead of
  // re-deriving the whole prefix (the run was O(n^2) without it)
  CELLS.push(["CELL", "stored:" + name, v]);
  console.log("STORED\t" + name + "\t" + ((Date.now() - s) / 1000).toFixed(0) + "s");
}
fs.appendFileSync(process.env.DERIVED_OUT, "\n");
console.log("DERIVED " + n + " cells in " + ((Date.now() - t0) / 1000).toFixed(0) + "s -> " + process.env.DERIVED_OUT);
