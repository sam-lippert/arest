;
function showp(x) { return Array.isArray(x) ? "[" + x.map(showp).join(",") + "]" : "" + x; }
const store = CELLS.slice();
const phi = [], wback = [["back"]];
const battery = [[phi, phi], [["Case"], wback], [["Case", "The Speckled Band"], wback], [["HypothesisContradictsHypothesis"], wback]];
let out = "";
for (const [a, s] of battery) {
  out += showp(Ev("ui:arrange", [Ev("ui:screen", [store, a, s]), 960])) + "\n";
}
// the storage bytes join the battery: same fires, same journal bytes
out += Ev("ui:jentry", [1, ["fire", "Case is observed", "Case", "The Speckled Band"]]) + "\n";
out += Ev("ui:jentry", [42, ["submit", "Case", 'va"l\\ue']]) + "\n";
out += Ev("ui:jentry", [3, ["retract", "journal:1"]]) + "\n";
out += Ev("ui:st", [["nested", "row"], "atom"]) + "\n";
out += showp(Ev("ui:removefirst", [[["a"], ["b"], ["a"]], ["a"]])) + "\n";
// the grid engine's star weights ride the battery: one unit by division
// (Backus 11.2 arithmetic), weight x unit per star, truncation slack
out += showp(Ev("ui:colw", [[["abs", 100], ["star", 1], ["star", 3]], 500])) + "\n";
out += showp(Ev("ui:colw", [[["abs", 100], ["star", 1], ["star", 3]], 502])) + "\n";
out += showp(Ev("ui:colw", [[["abs", 60], ["abs", 40]], 500])) + "\n";
out += showp([Ev("/", [7, 2]), Ev("/", [-7, 2]), Ev("*", [6, 7])]) + "\n";
process.stdout.write(out);
