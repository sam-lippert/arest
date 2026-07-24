;
// Semi-derive refresh: re-derive ONLY the named cells against a store
// composed WITH the existing carrier (unchanged cells fetch-hit), then
// rewrite the carrier replacing the refreshed entries. Evaluates
// NAME:derive directly - the dispatch would echo the stale stored
// value for a cell being refreshed.
const REFRESH = (process.env.REFRESH_CELLS || "").split(",").filter(Boolean);
const fs = require("fs");
const t0 = Date.now();
const fresh = new Map();
for (const name of REFRESH) {
  const s = Date.now();
  let v;
  try { v = Ev(name + ":derive", CELLS); }
  catch (e) { console.log("SKIP\t" + name + "\t" + String(e).slice(0, 80)); continue; }
  fresh.set(name, JSON.stringify(v));
  // fetchable for later refresh cells; where a stale stored: row
  // exists it composes earlier and first-match keeps winning, so
  // this only lands for carrier-new cells (their dispatches would
  // otherwise re-derive)
  CELLS.push(["CELL", "stored:" + name, v]);
  memoClear();
  console.log("REFRESHED\t" + name + "\t" + ((Date.now() - s) / 1000).toFixed(0) + "s");
}
const path = process.env.DERIVED_OUT;
const old = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const kept = [];
const seen = new Set();
for (const line of old.split("\n")) {
  const m = line.match(/^DEF\("stored:([^"]+)", (.*)\),?$/);
  if (!m) continue;
  const name = m[1];
  seen.add(name);
  kept.push([name, fresh.has(name) ? fresh.get(name) : m[2]]);
}
for (const [name, v] of fresh) if (!seen.has(name)) kept.push([name, v]);
fs.writeFileSync(path,
  kept.map(([n, v]) => ',\nDEF("stored:' + n + '", ' + v + ")").join("") + "\n");
console.log("REFRESH " + fresh.size + "/" + REFRESH.length + " cells, carrier " +
  kept.length + " entries, " + ((Date.now() - t0) / 1000).toFixed(0) + "s -> " + path);
