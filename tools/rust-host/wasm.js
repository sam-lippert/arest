// THE WASM HOST, a peer of tools/java-runner/Program.java and tools/js-runner/program.js: the Rust mu compiled to
// wasm (src/wasm.rs), given lambda's texts and the base, and the platform: every registration the JS host makes
// (tools/js-runner/registrations.js) is offered to the module, which applies it across the boundary, each value
// written in lambda's own vocabulary both ways. The answer is lambda's main over the cells and the command line.
//
//   cargo rustc --release --lib --target wasm32-unknown-unknown --crate-type cdylib --no-default-features
//   bun wasm.js <address...>            the six-line contract
//   bun wasm.js --laws <list-file>      the lambda laws over the booted base, one by one
"use strict";
const fs = require("fs");
const nodePath = require("path");
const A = require("../js-runner/arest.js");

const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);
const lambda = env("AREST_LAMBDA", __dirname + "/../../arest");
const wasmPath = env("AREST_WASM", __dirname + "/target/wasm32-unknown-unknown/release/arest_host.wasm");

// The JS host's registrations, registered into its own table and applied from there; nothing of the JS mu runs.
require("../js-runner/registrations.js").register(lambda);
const KEY = "AREST_MASTER_KEY";
function masterKey() {
  if (process.env[KEY]) return process.env[KEY];
  const p = nodePath.join(nodePath.dirname(nodePath.resolve(lambda)), ".env");
  if (!fs.existsSync(p)) return "";
  const m = /^\s*AREST_MASTER_KEY\s*=(.*)$/m.exec(fs.readFileSync(p, "utf8"));
  if (!m) return "";
  let v = m[1].trim();
  if (v.length > 1 && /^(["']).*\1$/.test(v)) v = v.slice(1, -1);
  return v;
}

// ---- a value in the vocabulary, both ways ----------------------------------------------------------------------
function write(x) {
  if (Array.isArray(x)) return "S(" + x.map(write).join(",") + ")";
  if (typeof x === "bigint") return "N(" + x.toString() + ")";
  const s = typeof x === "string" ? x : String(x);
  return 'A("' + s.replace(/[\\"\x00-\x1f]/g, (c) => {
    if (c === "\\") return "\\\\"; if (c === '"') return '\\"';
    if (c === "\n") return "\\n"; if (c === "\r") return "\\r"; if (c === "\t") return "\\t";
    return "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
  }) + '")';
}
function read(t) {
  const S = (...a) => a, Aa = (s) => s, N = (n) => BigInt(n), PHI = () => [], K = (x) => ["CONST", x];
  return new Function("S", "A", "N", "PHI", "K", "return " + t + ";")(S, Aa, N, PHI, K);
}

// ---- the module --------------------------------------------------------------------------------------------------
let mem;
const enc = new TextEncoder(), dec = new TextDecoder();
let X;
function put(s) {
  const b = enc.encode(s);
  const p = X.arest_alloc(b.length);
  new Uint8Array(X.memory.buffer, p, b.length).set(b);
  return [p, b.length];
}
function got(p) {
  const v = new DataView(X.memory.buffer);
  const n = v.getUint32(p, true);
  const flag = String.fromCharCode(new Uint8Array(X.memory.buffer, p + 4, 1)[0]);
  const text = dec.decode(new Uint8Array(X.memory.buffer, p + 5, n - 1));
  X.arest_free(p, n + 4);
  return [flag, text];
}
function hostCall(np, nl, ap, al) {
  const name = dec.decode(new Uint8Array(X.memory.buffer, np, nl));
  const arg = dec.decode(new Uint8Array(X.memory.buffer, ap, al));
  let out;
  try {
    if (name === "platform:master_key") out = "V" + write(masterKey());
    else {
      const f = A.PRIMS.get(name);
      if (!f) throw new Error("no registration " + name);
      out = "V" + write(f(read(arg)));
    }
  } catch (e) { out = "E" + String(e && e.message); }
  const [p, n] = put(out);
  return (BigInt(p) << 32n) | BigInt(n);
}

const inst = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasmPath)), { env: { arest_host_call: hostCall } });
X = inst.exports;
function call(fn, ...texts) {
  const args = [];
  for (const t of texts) args.push(...put(t));
  const [flag, text] = got(fn(...args));
  if (flag === "E") throw new Error(text);
  return [flag, text];
}

call(X.arest_load, fs.readFileSync(lambda, "utf8"), lambda);
const tests = env("AREST_TESTS", __dirname + "/../../arest.tests");
call(X.arest_load, fs.readFileSync(tests, "utf8"), tests);
const scen = env("AREST_SCENARIOS", __dirname + "/../../engine/shared/scenarios.canon");
call(X.arest_load, fs.readFileSync(scen, "utf8"), scen);
const base = env("AREST_CARRIERS", __dirname + "/../base");
if (fs.existsSync(base + "/store.db")) call(X.arest_cell, "state:base_db", write(nodePath.resolve(base + "/store.db").replace(/\\/g, "/")));
else process.stderr.write("no base at " + base + ": nothing composed under the readings\n");
for (const name of [...A.PRIMS.keys()].filter((n) => !["id", "tl", "atom", "apndl", "apndr", "distl", "distr", "cat", "null", "eq", "not", "and", "length", "lt", "le", "ge", "gt", "reverse", "trans", "+", "-", "*", "/", "apply", "lex", "implode", "chars", "1r", "tlr"].includes(n)))
  call(X.arest_bridge, name);

const argv = process.argv.slice(2);
if (argv[0] === "--laws") {
  let names = fs.readFileSync(argv[1], "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => s);
  let t = Date.now();
  call(X.arest_boot_store);
  console.log("boot " + (Date.now() - t) + " ms");
  let bad = 0;
  for (const l of names) {
    t = Date.now();
    let r;
    try { const [flag, text] = call(X.arest_law, l); r = flag === "S" ? "SEQ " + text : text; }
    catch (e) { r = ("ERROR " + e.message.replace(/\n/g, " ")).substring(0, 260); }
    if (r !== "T") bad++;
    console.log(l + " " + r + " " + (Date.now() - t) + " ms");
  }
  console.log(names.length + " laws, " + bad + " not T");
  process.exitCode = bad === 0 ? 0 : 1;
} else {
  const [flag, text] = call(X.arest_ask, argv.join("\x1f"));
  process.stdout.write(text + "\n");
  process.exitCode = flag === "T" ? 0 : 1;
}
