;
// CONTINUITY PROBE (scratchpad harness): one boot per invocation.
// argv[2] = "fire" to apply the first offered transition through
// ui:navpe and append through the registered store:append; argv[3] =
// the prior boot's status - the CONTINUITY judgment is canon's own eq.
PRIMS.set("store:append", x => {
  require("fs").appendFileSync(process.env.CONT_JOURNAL, x[1]);
  return "T";
});
const MODE = process.argv[2];
const EXPECT = process.argv[3];
const store = Ev("ui:boot", CELLS.slice());
const st0 = Ev("ui:status", [store, "Case", "The Speckled Band"]);
console.log("status:", st0, "jcount:", Ev("ui:jcount", store));
if (EXPECT !== undefined) console.log("CONTINUITY:", Ev("eq", [st0, EXPECT]));
if (MODE === "fire") {
  const tree = Ev("ui:screen", [store, ["Case", "The Speckled Band"], []]);
  let fireAddr = null;
  for (let m = 3; m < tree.length && !fireAddr; m++)
    for (let i = 2; i < tree[m].length && !fireAddr; i++) {
      const r = tree[m][i];
      if (Array.isArray(r) && r[0] === "item" && Array.isArray(r[3]) && r[3][0] === "fire")
        fireAddr = r[3];
    }
  if (!fireAddr) { console.log("NO TRANSITION OFFERED"); process.exit(0); }
  const od = Ev("ui:navpe", [store, [["master", []], ["detail", []]], fireAddr]);
  Ev("store:append", ["journal", od[2]]);
  console.log("fired:", JSON.stringify(fireAddr));
  console.log("after:", Ev("ui:status", [od[0], "Case", "The Speckled Band"]),
    "jcount:", Ev("ui:jcount", od[0]));
}
