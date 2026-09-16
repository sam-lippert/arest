// THE APP IS A PER-CALL ARGUMENT, AND THE STORES ARE RESIDENT TOGETHER.
//
// Sam, 2026-09-15: "Choosing the app that you're calling should be dynamic."
// "We also can't have it be single-threaded. A swarm of agents may want to
// use different apps at the same time." And 2026-09-16: "It's necessary for
// you to be able to use claude while support uses support.auto.dev."
//
// This is the router (#117's recommendation A): it speaks MCP on stdio, and
// behind it runs the unchanged single-store server (build.js mcp --run) once
// per resident app, each in its own process over its own store. A call names
// its app; the router forwards it to that app's process and answers when it
// answers, so two agents on two apps never wait on each other, and two calls
// on one app are answered in that app's order. The router decides nothing
// about the model: every answer is canon's, from the app's own server.
//
//   AREST_APPS="claude=C:/.../apps/claude/.check;support=C:/.../apps/support.auto.dev/.check"
//   bun tools/js-runner/mcp-router.js
//
// Each entry names an app and its .check directory (carriers and store.db).
// The surface: the verbs (get, ask, query, orient, tutor, ...) with an `app`
// argument, and `apps`, which lists the residents; the per-fact-type tools
// of one app are not the tools of another, so the router serves none (#117
// (5)). prompts/list and prompts/get are answered by the first app whose
// canon carries the patterns, since they are the metamodel's, not an app's.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const NL = "\n";

// THE MASTER KEY REACHES THE CHILDREN FROM arest/.env AND NOWHERE ELSE. A store
// whose closure marks a value type `is stored through Function 'crypt:encrypt'`
// (support's Secret Reference) boots and writes only with AREST_MASTER_KEY, and
// bun auto-loads .env from the current directory alone, which a client's
// launch never is. The router reads arest/.env itself, sets only the keys it
// finds that the environment lacks, and never prints one.
function loadArestEnv() {
  try {
    const text = readFileSync(join(here, "..", "..", ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  } catch { /* no .env: the stores that need a key say so when they boot */ }
}
loadArestEnv();

function parseApps(spec) {
  const apps = [];
  for (const part of String(spec || "").split(";")) {
    const s = part.trim();
    if (!s) continue;
    const eq = s.indexOf("=");
    if (eq < 0) throw new Error("AREST_APPS entry needs name=dir: " + s);
    apps.push({ name: s.slice(0, eq).trim(), dir: s.slice(eq + 1).trim().replace(/\\/g, "/") });
  }
  if (!apps.length) throw new Error("AREST_APPS names no app (name=dir;name=dir)");
  return apps;
}

// one resident: a child server and the promise-keyed requests in flight to it
class Resident {
  constructor(app) {
    this.name = app.name;
    this.dir = app.dir;
    this.pending = new Map();
    this.nextId = 1;
    this.buf = "";
    this.ready = null;
    this.error = null;
    this.instructions = "";
    this.tools = [];
    this.prompts = null;
    this.child = spawn("bun", [join(here, "build.js"), "mcp", "--run"], {
      env: { ...process.env, AREST_CARRIERS: app.dir, AREST_OUT_DIR: app.dir, AREST_STORE_DB: app.dir + "/store.db" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(NL)) {
        if (!line.trim()) continue;
        process.stderr.write("[" + this.name + "] " + line + NL);
        if (/error:/i.test(line) && !this.error) this.error = line.trim();
      }
    });
    this.child.on("exit", (code) => {
      if (!this.error) this.error = "server exited with code " + code;
      for (const [, p] of this.pending) p.reject(new Error(this.name + ": " + this.error));
      this.pending.clear();
    });
  }
  onData(chunk) {
    this.buf += chunk;
    for (;;) {
      const nl = this.buf.indexOf(NL);
      if (nl < 0) break;
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || String(msg.error)));
      else p.resolve(msg.result);
    }
  }
  request(method, params) {
    if (this.error) return Promise.reject(new Error(this.name + ": " + this.error));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + NL);
    });
  }
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + NL);
  }
  // initialize the child, learn its instructions, verbs and prompts; a child
  // that cannot boot leaves the router serving the others and says so
  boot() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const init = await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "arest-router", version: "1.0.0" } });
        this.instructions = String((init && init.instructions) || "");
        this.notify("notifications/initialized", {});
        const list = await this.request("tools/list", {});
        this.tools = (list && list.tools) || [];
        try { const pl = await this.request("prompts/list", {}); this.prompts = (pl && pl.prompts) || []; } catch { this.prompts = []; }
      } catch (e) {
        if (!this.error) this.error = String(e.message);
      }
    })();
    return this.ready;
  }
}

const apps = parseApps(process.env.AREST_APPS);
const residents = new Map(apps.map((a) => [a.name, new Resident(a)]));
const booting = Promise.all([...residents.values()].map((r) => r.boot()));

const isVerb = (t) => t.inputSchema && t.inputSchema.properties && t.inputSchema.properties.args && !t.inputSchema.properties.method;
const names = () => [...residents.keys()];

function tools() {
  // the verbs are canon's and the same in every app: take the first resident
  // that booted, add the app argument, and offer `apps`
  const first = [...residents.values()].find((r) => !r.error && r.tools.length);
  const verbs = first ? first.tools.filter(isVerb) : [];
  const withApp = verbs.map((t) => ({
    name: t.name,
    description: t.description + " -- in the app named by `app`",
    inputSchema: { type: "object",
      properties: { app: { type: "string", enum: names(), description: "the resident app this call is for" }, ...t.inputSchema.properties },
      required: ["app"] },
  }));
  return [{ name: "apps", description: "the resident apps and whether each is serving", inputSchema: { type: "object", properties: {} } }].concat(withApp);
}

function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
function fail(id, message) { return { jsonrpc: "2.0", id, error: { code: -32603, message } }; }

async function handle(msg) {
  if (msg.method === "initialize") {
    await booting;
    const lines = [];
    for (const r of residents.values()) lines.push(r.name + (r.error ? " (not serving: " + r.error + ")" : ": " + r.instructions));
    return reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, prompts: {} },
      serverInfo: { name: "arest", version: "1.0.0" },
      instructions: "AREST serves " + residents.size + " resident apps, each its own store; every verb takes `app`: " + names().join(", ") + ". " + lines.join(" ||| "),
    });
  }
  if (msg.method === "tools/list") { await booting; return reply(msg.id, { tools: tools() }); }
  if (msg.method === "prompts/list") {
    await booting;
    const r = [...residents.values()].find((x) => x.prompts && x.prompts.length);
    return reply(msg.id, { prompts: r ? r.prompts : [] });
  }
  if (msg.method === "prompts/get") {
    await booting;
    const r = [...residents.values()].find((x) => x.prompts && x.prompts.length);
    if (!r) return fail(msg.id, "no resident app carries the verbalization patterns");
    try { return reply(msg.id, await r.request("prompts/get", msg.params || {})); } catch (e) { return fail(msg.id, String(e.message)); }
  }
  if (msg.method === "tools/call") {
    await booting;
    const p = msg.params || {};
    if (p.name === "apps") {
      const rows = [...residents.values()].map((r) => [r.name, r.error ? "not serving: " + r.error : "serving", r.dir]);
      return reply(msg.id, { content: [{ type: "text", text: JSON.stringify(rows) }] });
    }
    const args = { ...(p.arguments || {}) };
    const app = args.app;
    delete args.app;
    const r = residents.get(app);
    if (!r) return reply(msg.id, { content: [{ type: "text", text: "no resident app named " + JSON.stringify(app) + "; the apps are " + names().join(", ") }], isError: true });
    try { return reply(msg.id, await r.request("tools/call", { name: p.name, arguments: args })); }
    catch (e) { return reply(msg.id, { content: [{ type: "text", text: String(e.message) }], isError: true }); }
  }
  if (msg.id === undefined) return null;
  return fail(msg.id, "unknown method: " + msg.method);
}

// THE LOOP DOES NOT SERIALISE: each line is handled on its own promise, and
// the answer goes out when it is ready, so a slow query in one app is not a
// wait in another. Answers to one client id are single lines, so interleaving
// is safe.
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  for (;;) {
    const nl = buf.indexOf(NL);
    if (nl < 0) break;
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { process.stdout.write(JSON.stringify(fail(null, String(e.message))) + NL); continue; }
    handle(msg).then((out) => { if (out) process.stdout.write(JSON.stringify(out) + NL); },
      (e) => { process.stdout.write(JSON.stringify(fail(msg.id === undefined ? null : msg.id, String(e && e.message))) + NL); });
  }
});
process.stdin.on("end", () => { for (const r of residents.values()) try { r.child.kill(); } catch {} process.exit(0); });
