;
// THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
// All dispatch and all text live in canon `main`; a new operation is a
// canon edit, never a host edit. Adding a branch here is how runners die.
const out = Ev("main", [CELLS, process.argv.slice(2)]);
console.log(out[0]);
process.exit(out[1] === "T" ? 0 : 1);
