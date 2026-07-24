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
  "rmap:ctab","rmap:coltabs","rmap:ntabs"];
const fs = require("fs");
const out = [];
const t0 = Date.now();
for (const name of SCOPE) {
  const s = Date.now();
  let v;
  try { v = Ev(name, CELLS); }
  catch (e) { console.log("SKIP\t" + name + "\t" + String(e).slice(0, 80)); continue; }
  out.push(",\nDEF(\"stored:" + name + "\", " + JSON.stringify(v) + ")");
  console.log("STORED\t" + name + "\t" + ((Date.now() - s) / 1000).toFixed(0) + "s");
}
fs.writeFileSync(process.env.DERIVED_OUT, out.join("") + "\n");
console.log("DERIVED " + out.length + " cells in " + ((Date.now() - t0) / 1000).toFixed(0) + "s -> " + process.env.DERIVED_OUT);
