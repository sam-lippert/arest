;
// THE TEST TAIL. tail.part.js holds the host contract -- six lines, argv atoms
// in, one text atom out, process.exit -- and that contract is exactly what
// makes it unusable from a test file: it runs on import and then exits.
//
// This variant is the same composition with the last step removed. It exposes
// the evaluator and the cells and runs nothing, so a test can drive canon's
// own `main` the way the CLI does -- Ev("main", [CELLS, ["case", name]]) -- and
// assert the answer, without a process per case.
//
// Nothing is added: no dispatch, no rendering, no branch. A test that needed
// either would be testing the runner instead of the canon.
globalThis.AREST = { Ev: Ev, CELLS: CELLS };
