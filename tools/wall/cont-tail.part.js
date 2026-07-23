;
// CONTINUITY PROBE (scratchpad harness): one boot per invocation.
// argv[2] = "fire" to apply the first offered transition through
// ui:navpe and append through the registered store:append; argv[3] =
// the prior boot's status - the CONTINUITY judgment is canon's own eq.
PRIMS.set("store:append", x => {
  require("fs").appendFileSync(process.env.CONT_JOURNAL, x[1]);
  return "T";
});
// the harness clock is CONSTANT - determinism by registration, so the
// journal byte-identity comparisons hold across stations and reruns
PRIMS.set("clock", () => "0");
const MODE = process.argv[2];
const EXPECT = process.argv[3];
const CTYPE = process.env.CONT_TYPE || "Case";
const CID = process.env.CONT_ID || "The Speckled Band";
const store = Ev("ui:boot", CELLS.slice());
const st0 = Ev("ui:status", [store, CTYPE, CID]);
console.log("status:", st0, "jcount:", Ev("ui:jcount", store));
if (EXPECT !== undefined) console.log("CONTINUITY:", Ev("eq", [st0, EXPECT]));
if (MODE === "fire") {
  const tree = Ev("ui:screen", [store, [CTYPE, CID], []]);
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
  console.log("after:", Ev("ui:status", [od[0], CTYPE, CID]),
    "jcount:", Ev("ui:jcount", od[0]));
}
if (MODE === "retract") {
  const target = process.argv[4];
  const od = Ev("ui:navpe", [store, [["master", []], ["detail", []]], ["retract", target]]);
  Ev("store:append", ["journal", od[2]]);
  console.log("retracted:", target);
  console.log("after:", Ev("ui:status", [od[0], CTYPE, CID]),
    "jcount:", Ev("ui:jcount", od[0]));
}
