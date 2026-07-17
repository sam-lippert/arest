// WASI preview1 host for the wasm leg: effects only, the Platform seam.
// Arguments pass through (including "app"), the exit code passes through,
// stdout is the station's report — byte-identical to every other station.
// No law semantics live here.
//
//   node wasi-host.mjs composed.wasm [app]
//   bun  wasi-host.mjs composed.wasm [app]
import { readFile } from "node:fs/promises";
import { WASI } from "node:wasi";
import { argv, exit } from "node:process";

const [wasmPath, ...rest] = argv.slice(2);
if (!wasmPath) { console.error("usage: node wasi-host.mjs <composed.wasm> [app]"); exit(2); }
const wasi = new WASI({ version: "preview1", args: [wasmPath, ...rest], returnOnExit: true });
const wasm = await WebAssembly.compile(await readFile(wasmPath));
const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject());
exit(wasi.start(instance));
