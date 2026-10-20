// ONE APP'S STORE OVER MCP, a peer of tools/java-runner/Serve.java. JSON-RPC on stdio, one message to a line, and
// every answer lambda's: mcp:instructions at initialize, mcp:tools_json for the tools, main:as for a verb, mcp:call for
// a fact type's own resource, mcp:prompts, mcp:prompt and mcp:prompt_description for the verbalization patterns, and
// mcp:not_committed for a write this host cannot commit. This file builds the protocol's envelopes and nothing else.
//
// The store is the app's database: lambda reads a population where the database places it (store:for_read,
// store:sql_rows) once the store names its database in state:store_db, and the carriers its check wrote beside the
// database give the schema it is read through.
//
// A WRITE IS COMMITTED BY LAMBDA OR IT IS REFUSED. An answer whose third part is `stored` was committed by lambda's own
// program (sqlite:program inside it, as an entity retract is), and it is answered. An answer that hands back a new
// store is a write lambda does not commit itself yet (#197, the write path), and this host has no commit of its own to
// run in its place, so it answers what lambda says of that and keeps the store as it was.
//
//   bun serve.js <app .check directory>                         serve MCP on stdio
//   bun serve.js <app .check directory> --call <tool> <json>    one call, answered on stdout
"use strict";
const fs = require("fs");
const A = require("./arest.js");
// stdout is the protocol's; anything a registration prints goes to stderr
console.log = console.error;

const t0 = Date.now();
const dir = process.argv[2].replace(/\\/g, "/");
const lambda = A.path("AREST_LAMBDA", __dirname + "/../../arest");
A.load(lambda);
A.loadCarriers(dir);
require("./registrations.js").register(lambda);
const db = dir + "/store.db";
if (!fs.existsSync(db)) throw new Error("no store at " + db + ": the app's check writes it");
A.CELLS.push(["CELL", "state:store_db", db]);
// what a served read asks of the schema, computed once by lambda (store:boot)
const store = A.Ev("store:boot", A.CELLS.slice());
process.stderr.write("serve: " + dir + " booted in " + (Date.now() - t0) + " ms, " + store.length + " cells\n");

// the store as a read is answered over: its populations read in the database (store:for_read)
const read = () => A.Ev("store:for_read", store);
const text = (x) => Array.isArray(x) ? "" : String(x);
const str = (x) => x == null ? "null" : String(x);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
// JSON as lambda reads it: an object is its pairs, a whole number a number, the rest atoms (Gui.fromJson)
const fromJson = (x) => Array.isArray(x) ? x.map(fromJson) : isObj(x) ? Object.entries(x).map(([k, v]) => [k, fromJson(v)])
  : typeof x === "number" && Number.isInteger(x) ? BigInt(x) : String(x);

const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, message) => ({ jsonrpc: "2.0", id, error: { code: -32603, message } });

function handle(msg) {
  const id = msg.id === undefined ? null : msg.id;
  const method = str(msg.method);
  const p = isObj(msg.params) ? msg.params : {};
  if (method === "initialize") {
    const r = { protocolVersion: "2024-11-05", capabilities: { tools: {}, prompts: {} }, serverInfo: { name: "arest", version: "1.0.0" } };
    try { r.instructions = String(A.Ev("mcp:instructions", read())); }
    catch (e) { process.stderr.write("serve: mcp:instructions: " + e.message + "\n"); }
    return reply(id, r);
  }
  if (method === "tools/list") return reply(id, { tools: JSON.parse(String(A.Ev("mcp:tools_json", read()))) });
  if (method === "prompts/list")
    return reply(id, { prompts: A.Ev("mcp:prompts", read()).map((row) => ({ name: text(row[0]), description: text(row[1]) })) });
  if (method === "prompts/get") {
    const name = p.name == null ? "" : String(p.name);
    const t = String(A.Ev("mcp:prompt", [name, read()]));
    return reply(id, { description: String(A.Ev("mcp:prompt_description", name)),
      messages: [{ role: "user", content: { type: "text", text: t } }] });
  }
  if (method === "tools/call") {
    let out;
    try { out = call(p); } catch (e) { out = [String(e.message), 500]; }
    return reply(id, { content: [{ type: "text", text: String(out[0]) }], isError: out[1] >= 400 });
  }
  if (id === null) return null;
  return fail(id, "unknown method: " + method);
}

function call(p) {
  const name = str(p.name);
  const a = isObj(p.arguments) ? p.arguments : {};
  const caller = a.caller == null ? "" : String(a.caller);
  if (name === "fact") {
    const method = a.method == null ? "GET" : String(a.method);
    if (method !== "GET") return notCommitted();
    const fact = a.fact == null ? [] : fromJson(a.fact);
    const out = A.Ev("mcp:call", [method, str(a.factType), caller, fact, store]);
    return answered(out, Number(out[1]));
  }
  const argv = [name];
  if (Array.isArray(a.args)) for (const x of a.args) argv.push(fromJson(x));
  // a verb lambda says writes is not evaluated: its new store would be thrown away (answered, below)
  if (A.Ev("main:verb_writes", [read(), argv]) === "T") return notCommitted();
  const out = A.Ev("main:as", [store, caller, argv]);
  return answered(out, out[1] === "T" ? 200 : 500);
}

// a write lambda does not commit and this host cannot: lambda says so (mcp:not_committed)
const notCommitted = () => [String(A.Ev("mcp:not_committed", [])), 501];

// a read's answer, a write lambda stored, or a write this host cannot commit
function answered(out, status) {
  if (out.length > 2 && out[2] === "stored") return [out[0], status];
  if (out.length > 2 && status < 400) return notCommitted();
  return [out[0], status];
}

if (process.argv[3] === "--call") {
  const t1 = Date.now();
  const out = call({ name: process.argv[4], arguments: process.argv[5] ? JSON.parse(process.argv[5]) : {} });
  process.stderr.write("serve: " + process.argv[4] + " answered in " + (Date.now() - t1) + " ms, status " + out[1] + "\n");
  process.stdout.write(String(out[0]) + "\n");
} else {
  const lines = require("readline").createInterface({ input: process.stdin });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let r;
    try { r = handle(JSON.parse(line)); } catch (e) { r = fail(null, String(e.message)); }
    if (r !== null) process.stdout.write(JSON.stringify(r) + "\n");
  });
}
