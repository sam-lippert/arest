// ONE APP'S STORE OVER MCP, a peer of tools/java-runner/Serve.java. JSON-RPC on stdio, one message to a line, and
// every answer lambda's: mcp:instructions at initialize, mcp:tools_json for the tools, k:as for a verb, k:mcp_call for
// a fact type's own resource, mcp:prompts, mcp:prompt and mcp:prompt_description for the verbalization patterns, and
// mcp:not_committed for a write this host cannot commit. This file builds the protocol's envelopes and nothing else.
//
// The store is the app's database: lambda reads a population where the database places it (store:for_read,
// store:sql_rows) once the store names its database in state:store_db. The schema it is read through is the one its
// compile wrote into the database (store:schema_in reads its _defs).
//
// A WRITE IS COMMITTED BY LAMBDA OR IT IS REFUSED. An answer whose third part is `stored` was committed by lambda's own
// program (sqlite:program inside it, as an entity retract is), and it is answered. A POST, a PUT or a DELETE of a fact
// goes to lambda as any request does, and one application of SYSTEM commits it in one program (k:system, k:do_change), as
// it does a writing verb; a request SYSTEM does not answer stays with main:api and main:as, which commit their own
// (main:commit, main:as_commit). An answer that still hands back a new store is a write lambda did not commit, over a store
// held in memory alone, and this host has no commit of its own to run in its place, so it answers what lambda says of
// that and keeps the store as it was.
//
// HTTP IS THE SAME OPERATION OVER ANOTHER TRANSPORT. A request is <store, method, resource, caller, body> through
// k:api: the resource is the path less its leading slash, the caller the x-arest-caller header (no header
// is the anonymous caller), the body the request's JSON (none is the empty sequence). The answer's text and status are
// lambda's. A navigation lambda answers with 202 and a request (ui:read_fetch) is read here, and asked again with the
// page (readPage), the I/O lambda cannot do.
//
//   bun serve.js <app store directory>                         serve MCP on stdio
//   bun serve.js <app store directory> --call <tool> <json>    one call, answered on stdout
//   bun serve.js <app store directory> --http <port>           serve HTTP on the port, on 127.0.0.1
"use strict";
const fs = require("fs");
const A = require("./arest.js");
// stdout is the protocol's; anything a registration prints goes to stderr
console.log = console.error;

// the store this server answers over: an app's (boot), or the registry's when router.js serves through this file
let store = null;

// lambda and the database named: what a served read asks of the schema, computed once by lambda, with SYSTEM's D (k:serve_boot)
function boot(dir) {
  const t0 = Date.now();
  const lambda = A.path("AREST_LAMBDA", __dirname + "/../../arest");
  A.load(lambda);
  // SYSTEM's own cells, beside lambda: a request goes through them (k:serve_boot, k:api, k:mcp_call, k:as)
  A.load(A.path("AREST_KERNEL", __dirname + "/../../kernel"));
  // a store is read through the schema its compile wrote into it (store:schema_in reads its _defs)
  require("./registrations.js").register(lambda);
  const db = dir + "/store.db";
  if (!fs.existsSync(db)) throw new Error("no store at " + db + ": the app's check writes it");
  A.CELLS.push(["CELL", "state:store_db", db]);
  store = A.Ev("k:serve_boot", A.CELLS.slice());
  served = db;
  composed = composition();
  process.stderr.write("serve: " + dir + " booted in " + (Date.now() - t0) + " ms, " + store.length + " cells\n");
  return store;
}

// the database served and the composition it was booted over: a check another session makes of the store lands in it
// while this server holds it, and the next request is answered over what it left
let served = null, composed = "";
const composition = () => text(A.Ev("store:composition", served));
function fresh() {
  if (served === null) return;
  const now = composition();
  if (now === composed) return;
  store = A.Ev("k:serve_boot", A.CELLS.slice());
  composed = now;
  process.stderr.write("serve: booted again over a store another check left, " + store.length + " cells
");
}

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
    return call(p).catch((e) => [String(e.message), 500])
      .then((out) => reply(id, { content: [{ type: "text", text: String(out[0]) }], isError: out[1] >= 400 }));
  }
  // the router's HTTP request for this app, passed on as it came
  if (method === "http/request")
    return request(str(p.method), p.resource == null ? "" : String(p.resource), p.caller == null ? "" : String(p.caller), p.body)
      .then((out) => reply(id, { status: out[1], body: String(out[0]) }));
  if (id === null) return null;
  return fail(id, "unknown method: " + method);
}

// one HTTP request through k:api, answered <text, status>, asked once more with the page where it reads first (readPage)
async function request(method, resource, caller, body) {
  try {
    const out = api(method, resource, caller, body), page = await readPage(out, caller);
    if (page === undefined) return out;
    const again = Array.isArray(body) ? body.slice(0, 7) : [];
    while (again.length < 7) again.push([]);
    return api(method, resource, caller, again.concat([page]));
  } catch (e) { return [String(e.message), 500]; }
}
const api = (method, resource, caller, body) => {
  const out = A.Ev("k:api", [store, method, resource, caller, body == null ? [] : fromJson(body)]);
  return answered(out, status(out[1]));
};
// A NAVIGATION THAT HAS TO READ FIRST answers 202 with the request lambda built for its Source, the Source after it
// (ui:read_fetch). This host makes it through the Connector's Fetcher `fetch` (none declared is that one), when the
// connection's Send Mode is live, with the headers it declares, and answers the page, or <failed, text> where it could
// not read; it opens no credential, so a connection that carries one is not read here. A request that went out is
// recorded as a sync's read is (record). undefined: no read is asked.
async function readPage(out, caller) {
  let q;
  try { q = Number(out[1]) === 202 ? JSON.parse(String(out[0])) : null; } catch (e) { q = null; }
  if (!Array.isArray(q) || q[0] !== "request" || q.length < 6) return undefined;
  return page(q, caller);
}
// the page one request of lambda's reads, the Source after it
async function page(q, caller) {
  const rd = read(), fn = A.Ev("fed:connector", [String(q[5]), rd]);
  if (Array.isArray(fn)) return ["failed", "the Source '" + q[5] + "' uses no Connector"];
  const of = (f) => { const v = A.Ev(f, [fn, rd]); return Array.isArray(v) ? "" : String(v); };
  const fetcher = of("perform:fetcher_of"), mode = of("perform:send_mode_of");
  if (fetcher && fetcher !== "fetch") return ["failed", "no host here registers Fetcher '" + fetcher + "', so this read is the caller's"];
  if (of("perform:auth_header_of") && of("perform:secret_of")) return ["failed", "not performed: this host opens no credential"];
  const qs = new URLSearchParams((Array.isArray(q[3]) ? q[3] : []).map((p) => [String(p[0]), String(p[1])])).toString();
  const url = String(q[2]) + (qs ? (String(q[2]).includes("?") ? "&" : "?") + qs : "");
  if (mode !== "live") return ["failed", (mode || "not performed: this connection declares no Send Mode") + " -- would " + q[1] + " " + url];
  const headers = Object.fromEntries(A.Ev("perform:headers_of", [fn, rd]).map((h) => [String(h[0]), String(h[1])]));
  const sent = Array.isArray(q[4]) || String(q[4]) === "" ? undefined : String(q[4]);
  let res, text;
  try { res = await fetch(url, { method: String(q[1]), headers, body: sent, redirect: "manual" }); text = await res.text(); }
  catch (e) { record(fn, url, "0", caller); return ["failed", q[1] + " " + url + " failed: " + e.message]; }
  record(fn, url, String(res.status), caller);
  if (res.status >= 300) return ["failed", q[1] + " " + url + " answered " + res.status + ": " + text.slice(0, 300)];
  try { return JSON.parse(text); } catch (e) { return ["failed", q[1] + " " + url + " answered a body that is not JSON"]; }
}
// WHAT CAME OFF THE LINE IS RECORDED, as the Java host records a sync's read (Perform.record): a Response answering
// the Function, from the address, with its status and time (fed:response_facts), asserted as the system's login, or the
// caller's where the environment names none. Its body is not kept.
// What an answer being made reads is recorded once the answer is out (live): a write moves the store it is made over.
let later = null;
function record(fn, url, code, who) {
  try {
    const facts = A.Ev("fed:response_facts", [fn, url, code, new Date().toISOString()]);
    if (later) { later.push([facts, who]); return; }
    keep(fn, facts, who);
  } catch (e) { process.stderr.write("serve: response record threw for " + fn + ": " + String(e.message).slice(0, 300) + "\n"); }
}
function keep(fn, facts, who) {
  try {
    const out = A.Ev("k:as", [store, process.env.AREST_SYSTEM_LOGIN || who, ["assert", facts]]);
    const st = answered(out, out[1] === "T" ? 200 : 500);
    if (st[1] >= 400) process.stderr.write("serve: response record not kept for " + fn + ": " + String(st[0]).slice(0, 300) + "\n");
  } catch (e) { process.stderr.write("serve: response record threw for " + fn + ": " + String(e.message).slice(0, 300) + "\n"); }
}
// WHAT AN ANSWER RESTS ON IS READ BEFORE IT IS GIVEN, as the Java host reads it (Serve.live): while k:live names a
// federated entity to read this host reads it and asks again, and the verb is asked of the store k:live answers.
async function live(argv, caller) {
  let state = [];
  for (;;) {
    const l = A.Ev("k:live", [store, argv, state]);
    if (!Array.isArray(l[1]) || l[1].length === 0) return l[0];
    if (!later) later = [];
    state = [l[3], (state[1] || []).concat([[l[1], fromJson(await page(l[2], caller))]])];
  }
}
function drain() {
  const due = later;
  later = null;
  if (due && due.length) keep("what was read", due.flatMap((r) => r[0]), due[0][1]);
}
const status = (s) => { const n = Number(s); return Number.isInteger(n) ? n : 500; };

// the request's JSON, or nothing when it has none or it does not parse
async function body(req) {
  try { const s = await req.text(); return s.trim() ? JSON.parse(s) : null; } catch (e) { return null; }
}
const respond = (status, text) => new Response(text.length ? text : null,
  { status, headers: { "content-type": "application/json; charset=utf-8" } });
const callerOf = (req) => req.headers.get("x-arest-caller") || "";

// one request at a time, in the order they came, as the MCP lines are answered
function http(port) {
  let last = Promise.resolve();
  Bun.serve({ hostname: "127.0.0.1", port, fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const next = last.then(async () => {
      fresh();
      const out = await request(req.method, path.startsWith("/") ? path.slice(1) : path, callerOf(req), await body(req));
      return respond(Number(out[1]), String(out[0]));
    });
    last = next.catch(() => {});
    return next;
  } });
}

async function call(p) {
  const name = str(p.name);
  const a = isObj(p.arguments) ? p.arguments : {};
  const caller = a.caller == null ? "" : String(a.caller);
  if (name === "fact") {
    const method = a.method == null ? "GET" : String(a.method);
    const fact = a.fact == null ? [] : fromJson(a.fact);
    const out = A.Ev("k:mcp_call", [method, str(a.factType), caller, fact, store]);
    return answered(out, Number(out[1]));
  }
  const argv = [name];
  if (Array.isArray(a.args)) for (const x of a.args) argv.push(fromJson(x));
  // a writing verb is one application of SYSTEM (k:as), or commits its store through main:as; one not committed is answered below
  const out = A.Ev("k:as", [await live(argv, caller), caller, argv]);
  setImmediate(drain);
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

module.exports = { boot, handle, call, read, reply, fail, body, respond, callerOf, status, setStore: (s) => { store = s; } };

if (require.main === module) {
  boot(process.argv[2].replace(/\\/g, "/"));
  if (process.argv[3] === "--call") {
    const t1 = Date.now();
    call({ name: process.argv[4], arguments: process.argv[5] ? JSON.parse(process.argv[5]) : {} }).then((out) => {
      process.stderr.write("serve: " + process.argv[4] + " answered in " + (Date.now() - t1) + " ms, status " + out[1] + "\n");
      process.stdout.write(String(out[0]) + "\n");
    }, (e) => { process.stderr.write("serve: " + e.message + "\n"); process.exitCode = 1; });
  } else if (process.argv[3] === "--http") {
    http(Number(process.argv[4]));
    process.stderr.write("serve: HTTP on 127.0.0.1:" + process.argv[4] + "\n");
  } else {
    const lines = require("readline").createInterface({ input: process.stdin });
    let last = Promise.resolve();
    lines.on("line", (line) => {
      if (!line.trim()) return;
      last = last.then(async () => {
        let r;
        try { fresh(); r = await handle(JSON.parse(line)); } catch (e) { r = fail(null, String(e.message)); }
        if (r !== null) process.stdout.write(JSON.stringify(r) + "\n");
      });
    });
  }
}
