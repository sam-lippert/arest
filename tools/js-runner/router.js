// EVERY APP OVER ONE MCP CONNECTION, a peer of tools/java-runner/Router.java. The app is a per-call argument; each app
// is its own process over its own store (serve.js), started at its first call and stopped after ten minutes without
// one, so two apps answer at once and one app answers in its order.
//
// The router's own store is the registry (tools/js-runner/registry): its App table says which apps there are and where
// each package is, and lambda reads it, as it reads any served store. The verbs are lambda's, read off the registry's
// store, and every one takes `app`; `apps` lists the apps. Every sentence it answers is lambda's too (router:*); this
// file starts, stops and speaks to the app servers.
//
//   bun router.js
//
// AREST_LAMBDA names the lambda file, AREST_REGISTRY the registry package, AREST_LOGIN the caller a call names when it
// names none. AREST_HTTP_PORT, when set, serves HTTP on 127.0.0.1 too: /<app>/<resource> is passed to that app's server
// as it came (serve.js's HTTP), and the caller is the request's own.
"use strict";
const fs = require("fs");
const nodePath = require("path");
const { spawn } = require("child_process");
const A = require("./arest.js");
const serve = require("./serve.js");

const IDLE_MS = 600000;
const MAX_ANSWER = 2000000;
const slash = (s) => s.replace(/\\/g, "/");
const lambda = slash(nodePath.resolve(A.path("AREST_LAMBDA", __dirname + "/../../arest")));
const registry = slash(A.path("AREST_REGISTRY", nodePath.dirname(lambda) + "/tools/js-runner/registry"));
const login = A.path("AREST_LOGIN", "");
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

// a sentence lambda says over the parts this host knows; one part is passed as itself
const say = (def, ...parts) => String(A.Ev(def, parts.length === 1 ? parts[0] : parts));
const names = () => [...APPS.keys()];
const text = (id, s, err) => serve.reply(id, { content: [{ type: "text", text: s }], isError: err });

// ONE APP'S SERVER: a serve.js process over the app's .check directory, spoken to in JSON-RPC lines
class App {
  constructor(name, dir) {
    this.name = name;
    this.dir = dir;
    this.proc = null;
    this.instructions = null;
    this.error = null;
    this.busy = null;
    this.note = "";
    this.last = Date.now();
    this.seq = 0;
    this.pending = new Map();
    this.starting = null;
  }

  alive() { return this.proc !== null && this.proc.running; }

  // apps_check: the app's server is stopped, because the check writes the store it holds, and the command line runs
  // lambda's `apps_check <package directory>` in the package. Which readings, in what order and where they land are
  // lambda's; this starts the process and reports how it ended.
  async check() {
    if (this.busy !== null) return say("router:busy", this.name, this.busy);
    await this.stop();
    this.busy = "checking";
    this.note = "";
    const pkg = slash(nodePath.dirname(this.dir));
    const root = slash(nodePath.dirname(lambda));
    const logPath = pkg + "/check.log";
    const log = fs.openSync(logPath, "w");
    const env = Object.assign({}, process.env, { AREST_LAMBDA: lambda, AREST_TESTS: root + "/arest.tests",
      AREST_SCENARIOS: root + "/engine/shared/scenarios.canon", AREST_CARRIERS: root + "/tools/carriers/base" });
    const p = spawn(process.execPath, [__dirname + "/program.js", "apps_check", pkg], { cwd: pkg, env, stdio: ["ignore", log, log] });
    p.on("close", (code) => {
      fs.closeSync(log);
      let tail = "";
      try {
        const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/);
        if (lines.length && lines[lines.length - 1] === "") lines.pop();
        tail = lines.slice(Math.max(0, lines.length - (code === 0 ? 1 : 6))).join(" | ");
      } catch (e) { }
      this.busy = null;
      this.note = say("router:check_note", BigInt(code === null ? -1 : code), tail);
    });
    return say("router:checking", this.name, pkg, this.dir);
  }

  // apps_compile: this host reads lambda and the store's carriers when a server starts, so compiling the app is
  // starting its server again over the store apps_check wrote.
  async compile() {
    if (this.busy !== null) return say("router:busy", this.name, this.busy);
    await this.stop();
    this.note = "";
    await this.start();
    return say("router:compiled", this.name, this.dir);
  }

  status() {
    if (this.busy !== null) return this.busy;
    return say("router:with_note", this.statusOf(), this.note);
  }

  statusOf() {
    if (this.error !== null) return say("router:failed", this.error);
    if (this.alive()) return "serving";
    return fs.existsSync(this.dir + "/store.db") ? "idle" : say("router:no_store_at", this.dir);
  }

  async start() {
    if (this.alive()) return;
    if (this.starting) return this.starting;
    if (this.busy !== null) throw new Error(say("router:start_busy", this.name, this.busy));
    this.error = null;
    if (!fs.existsSync(this.dir + "/store.db")) throw new Error(say("router:no_store", this.name, this.dir));
    const log = fs.openSync(this.dir + "/serve.log", "w");
    const me = spawn(process.execPath, [__dirname + "/serve.js", this.dir],
      { env: Object.assign({}, process.env, { AREST_LAMBDA: lambda }), stdio: ["pipe", "pipe", log] });
    me.running = true;
    this.proc = me;
    require("readline").createInterface({ input: me.stdout }).on("line", (line) => {
      let m;
      try { m = JSON.parse(line); } catch (e) { return; }
      const f = typeof m.id === "number" ? this.pending.get(m.id) : undefined;
      if (f) { this.pending.delete(m.id); f(m); }
    });
    me.on("close", (code) => {
      me.running = false;
      fs.closeSync(log);
      if (this.proc === me) this.error = say("router:exited", code === null ? "running" : BigInt(code), this.dir);
      for (const f of this.pending.values()) f(serve.fail(null, say("router:exited_call", this.name, this.dir)));
      this.pending.clear();
    });
    this.starting = this.send("initialize", {}).then((init) => {
      if (isObj(init.result) && init.result.instructions != null) this.instructions = String(init.result.instructions);
    });
    try { await this.starting; } finally { this.starting = null; }
  }

  async request(method, params) {
    this.last = Date.now();
    await this.start();
    const r = await this.send(method, params);
    this.last = Date.now();
    return r;
  }

  send(method, params) {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  restIfIdle() {
    if (this.alive() && this.pending.size === 0 && Date.now() - this.last > IDLE_MS) this.stop();
  }

  // the server's input closes and it stops; past five seconds it is killed
  stop() {
    if (this.proc === null) return Promise.resolve();
    const p = this.proc;
    this.proc = null;
    if (!p.running) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(() => { try { p.kill(); } catch (e) { } }, 5000);
      p.on("close", () => { clearTimeout(t); resolve(); });
      try { p.stdin.end(); } catch (e) { }
    });
  }
}

async function handle(msg) {
  const id = msg.id === undefined ? null : msg.id;
  const method = msg.method == null ? "null" : String(msg.method);
  const p = isObj(msg.params) ? msg.params : {};
  if (method === "initialize") {
    const lines = [];
    for (const a of APPS.values()) if (a.instructions !== null) lines.push([a.name, a.instructions]);
    return serve.reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {}, prompts: {} },
      serverInfo: { name: "arest", version: "1.0.0" }, instructions: say("router:instructions", names(), lines) });
  }
  if (method === "tools/list") return serve.reply(id, { tools: JSON.parse(say("router:tools_json", names(), serve.read())) });
  if (method === "prompts/list" || method === "prompts/get") return serve.handle(msg);
  if (method === "tools/call") {
    const name = p.name == null ? "null" : String(p.name);
    const a = isObj(p.arguments) ? Object.assign({}, p.arguments) : {};
    if (name === "apps") return text(id, JSON.stringify([...APPS.values()].map((x) => [x.name, x.status(), x.dir])), false);
    const app = a.app == null ? "" : String(a.app);
    if (a.app != null) delete a.app;
    const x = APPS.get(app);
    if (!x) return text(id, say("router:no_app", app, names()), true);
    if (name === "apps_check") return text(id, await x.check(), false);
    if (name === "apps_compile") return text(id, await x.compile(), false);
    if (a.caller == null) a.caller = login;
    const r = await x.request("tools/call", { name, arguments: a });
    if (r.error != null) return text(id, String(r.error.message), true);
    const result = r.result;
    let size = 0;
    if (Array.isArray(result.content)) for (const c of result.content) size += String(c.text).length;
    if (size > MAX_ANSWER) return text(id, say("router:too_large", name, app, BigInt(size), BigInt(MAX_ANSWER)), true);
    return serve.reply(id, result);
  }
  if (id === null) return null;
  return serve.fail(id, "unknown method: " + method);
}

// the registry's store, booted as an app's is, and its App table
const dir = registry + "/.check";
serve.boot(dir);
const read = serve.read();
const rows = (factType) => { const r = A.Ev("system:pop_rows", [factType, read]); return Array.isArray(r) ? r : []; };
const status = new Map(rows("AppHasServingStatus").map((r) => [String(r[0]), String(r[1])]));
const APPS = new Map();
for (const r of rows("AppHasPackageDirectory")) {
  const name = String(r[0]);
  if (status.get(name) === "suspended") continue;
  APPS.set(name, new App(name, slash(String(r[1])) + "/.check"));
}
process.stderr.write("router: " + APPS.size + " apps from " + dir + ": " + names().join(", ") + "\n");
setInterval(() => { for (const a of APPS.values()) a.restIfIdle(); }, 60000).unref();

// /<app>/<resource> to that app's server; an app the registry does not name is lambda's unknown resource
const httpPort = A.path("AREST_HTTP_PORT", "");
if (httpPort !== "") {
  Bun.serve({ hostname: "127.0.0.1", port: Number(httpPort), async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const rest = path.startsWith("/") ? path.slice(1) : path;
    const i = rest.indexOf("/");
    const name = i < 0 ? rest : rest.slice(0, i);
    const x = APPS.get(name);
    if (!x) return serve.respond(serve.status(A.Ev("http:status_of", "unknown_resource")), say("router:no_app", name, names()));
    let out;
    try {
      const r = await x.request("http/request", { method: req.method, resource: i < 0 ? "" : rest.slice(i + 1),
        caller: serve.callerOf(req), body: await serve.body(req) });
      out = r.error != null ? [String(r.error.message), 500] : [String(r.result.body), serve.status(r.result.status)];
    } catch (e) { out = [String(e.message), 500]; }
    return serve.respond(out[1], out[0]);
  } });
  process.stderr.write("router: HTTP on 127.0.0.1:" + httpPort + "\n");
}

const inflight = new Set();
const lines = require("readline").createInterface({ input: process.stdin });
lines.on("line", (line) => {
  if (!line.trim()) return;
  const t = (async () => {
    let r;
    try { r = await handle(JSON.parse(line)); } catch (e) { r = serve.fail(null, String(e.message)); }
    if (r !== null) process.stdout.write(JSON.stringify(r) + "\n");
  })();
  inflight.add(t);
  t.finally(() => inflight.delete(t));
});
// the client has gone: the calls it already made are answered, then every app stops
lines.on("close", async () => {
  await Promise.all([...inflight]);
  for (const a of APPS.values()) await a.stop();
  process.exit(0);
});
