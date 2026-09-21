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
// Each entry names an app and its .check directory (carriers and store.db);
// the directory above .check is the app's package, where its own scripts run.
// The surface: the verbs (get, ask, query, orient, tutor, ...) with an `app`
// argument; `apps`, which lists the residents; and the two session verbs canon
// names in system:session_verbs for what a readings change needs, apps_check
// (the app's own check: the design state from its readings) and apps_compile
// (the module and the store from the carriers, then that app's server again).
// The per-fact-type tools of one app are not the tools of another, so the
// router serves none (#117 (5)). prompts/list and prompts/get are answered by
// the first app whose canon carries the patterns, since they are the
// metamodel's, not an app's.
import { spawn, spawnSync } from "node:child_process";
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

// THE ROUTER IS IN THE MIDDLE OF THE SAMPLING ROUND TRIP TOO, and this is the
// half most easily missed. A child server that wants a completion sends
// sampling/createMessage -- a request from a SERVER to a CLIENT -- and the only
// client here is on the other side of this process. So the request goes UP with
// an id of the router's own, the client's reply comes back and is routed DOWN to
// the child that asked, under the id THAT child used. The pattern is request()
// below, inverted: a pending map keyed by id, a promise settled on the matching
// reply. The two id spaces must not meet, so the upward ones are strings.
//
// AND THE CAPABILITY IS AGGREGATED, NOT ASSUMED. A child may only be told
// sampling is available if the real client offered it, or it would ask into a
// pipe where nothing answers and every drive would hang instead of refusing
// honestly. The children's processes still spawn at load -- that is the slow
// part -- but their initialize handshake waits for the client's, which is the
// only moment this process learns what the client can do.
let clientCaps = null;
let sawClient;
const capsSeen = new Promise((r) => { sawClient = r; });
const childCaps = () => (clientCaps && clientCaps.sampling ? { sampling: clientCaps.sampling } : {});
const UP = new Map();                     // router id -> <resident, the child's own id>
let upSeq = 0;

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

// A BUILD STEP IS A CHILD PROCESS WHOSE LAST LINES ARE ITS REPORT. The tools
// say what they did on stderr (design-state: ..., store.db: ..., REFUSING ...),
// so the tail, colours stripped, is what `apps` shows afterwards.
function run(args, cwd, extraEnv) {
  return new Promise((resolve) => {
    let tail = "";
    const keep = (chunk) => { tail = (tail + String(chunk)).slice(-6000); };
    let p;
    try {
      p = spawn("bun", args, { cwd, env: { ...process.env, ...(extraEnv || {}) }, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { resolve({ code: -1, tail: String(e.message) }); return; }
    p.stdout.on("data", keep);
    p.stderr.on("data", keep);
    p.on("error", (e) => resolve({ code: -1, tail: tail + NL + String(e.message) }));
    p.on("exit", (code) => resolve({ code, tail }));
  });
}
function lastLines(tail, n) {
  const lines = String(tail).split(/\r?\n/).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").trim()).filter(Boolean);
  return lines.slice(-n).join(" | ");
}

// one resident: a child server and the promise-keyed requests in flight to it
class Resident {
  constructor(app) {
    this.name = app.name;
    this.dir = app.dir;
    this.pkg = dirname(app.dir);            // the app's package, where its scripts run
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.buf = "";
    this.ready = null;
    this.error = null;
    this.instructions = "";
    this.tools = [];
    this.prompts = null;
    this.state = "booting";                 // booting | serving | failed | stopped
    this.busy = null;                       // null | checking | compiling
    this.note = "";                         // the last check or compile result
    this.spawn();
  }
  // ONE SERVER PER APP DIRECTORY, ENFORCED AT SPAWN (2026-09-18). stop() kills
  // its own child's tree correctly (c6efdb97), and that is not enough, because
  // a router only ever reaches the children IT spawned. Anything that ends a
  // router's life without it reaping first -- a /mcp reconnect, which starts a
  // new router beside the old one, or a canon merge, which moves every
  // composition stamp and takes all six app servers down at once -- leaves
  // servers no later router has a handle on, and they hold store.db. The next
  // compile then fails EBUSY and the app cannot be rebuilt until a human kills
  // them. Measured 2026-09-18: seven such failures in one day across two
  // sessions, four of them on a single afternoon's compiles. Sam's invariant:
  // "Restarting the server shouldn't leave zombies."
  //
  // So the invariant is enforced where it can be -- at the START, when this
  // Resident has no child of its own and therefore ANY process serving this
  // directory is an orphan by definition. The match is the exact path this
  // router is about to run, not a pattern sweep, and it is passed through the
  // environment so no quoting can widen it.
  reap() {
    if (this.child) return 0;                  // we have our own; nothing here is an orphan
    // THE SEPARATOR IS NOT THE PATH. parseApps normalises a dir to forward
    // slashes and node's join gives backslashes on Windows, while a command
    // line carries whichever the caller typed -- the router's own grandchild
    // has backslashes, a hand-started one may have slashes. Contains() is
    // exact, so both sides are normalised to one separator before comparing;
    // measured, matching the unnormalised marker reaped nothing at all.
    const marker = join(this.dir, "mcp.g.js").replace(/\//g, "\\");
    let pids = [];
    try {
      if (process.platform === "win32") {
        const ps = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
          "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/','\\').Contains($env:AREST_REAP_MARKER) } | ForEach-Object { $_.ProcessId }"],
          { env: { ...process.env, AREST_REAP_MARKER: marker }, encoding: "utf8", timeout: 20000 });
        pids = String(ps.stdout || "").split(/\s+/).filter((s) => /^\d+$/.test(s)).map(Number);
      } else {
        const pg = spawnSync("pgrep", ["-f", marker], { encoding: "utf8", timeout: 20000 });
        pids = String(pg.stdout || "").split(/\s+/).filter((s) => /^\d+$/.test(s)).map(Number);
      }
    } catch { return 0; }
    pids = pids.filter((p) => p !== process.pid);
    for (const p of pids) {
      try {
        if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p), "/T", "/F"], { stdio: "ignore" });
        else process.kill(p, "SIGKILL");
      } catch { /* already gone */ }
    }
    if (pids.length) process.stderr.write("[" + this.name + "] reaped " + pids.length +
      " orphaned server process(es) still holding " + this.dir + NL);
    return pids.length;
  }

  spawn() {
    this.reap();
    this.pending = new Map();
    this.nextId = 1;
    this.buf = "";
    this.ready = null;
    this.error = null;
    this.state = "booting";
    const child = spawn("bun", [join(here, "build.js"), "mcp", "--run"], {
      env: { ...process.env, AREST_CARRIERS: this.dir, AREST_OUT_DIR: this.dir, AREST_STORE_DB: this.dir + "/store.db" },
      stdio: ["pipe", "pipe", "pipe"],
      // its own process group where a group can be signalled, so stop() below
      // can reach the whole tree; on Windows detached would open a console, and
      // taskkill /T walks the tree instead.
      detached: process.platform !== "win32",
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { if (this.child === child) this.onData(chunk); });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(NL)) {
        if (!line.trim()) continue;
        process.stderr.write("[" + this.name + "] " + line + NL);
        if (this.child === child && /error:/i.test(line) && !this.error) this.error = line.trim();
      }
    });
    child.on("exit", (code) => {
      if (this.child !== child) return;      // stopped on purpose, or already replaced
      if (!this.error) this.error = "server exited with code " + code;
      this.state = "failed";
      for (const [, p] of this.pending) p.reject(new Error(this.name + ": " + this.error));
      this.pending.clear();
    });
  }
  // stop the server: a rebuild needs store.db, which a serving process holds
  // open (bun releases a sqlite handle at process exit, not before)
  // KILL THE TREE, NOT THE CHILD (2026-09-17). `bun` here is a shim that
  // execs the real binary, so the process that opens store.db is this child's
  // OWN child. child.kill() signals the direct child, the grandchild is
  // orphaned, and it keeps the sqlite handle -- exactly what the note above
  // says must not happen. Measured: four orphans held support's store from
  // 10:05, every apps_compile on it failed, and compile-store reported the
  // lock as `table "App" already exists` because it swallowed the failed
  // unlink. Synchronous on purpose: compile() rebuilds immediately after, and
  // a kill still in flight is the same defect with a shorter window.
  stop(why) {
    const child = this.child;
    this.child = null;
    this.state = "stopped";
    for (const [, p] of this.pending) p.reject(new Error(this.name + ": " + why));
    this.pending.clear();
    if (!child) return;
    try {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGKILL");         // the group spawn() detached it into
    } catch { /* already gone, or never started */ }
    try { child.kill(); } catch {}
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
      // A CHILD MAY ASK, TOO. A line carrying a method is not an answer to
      // anything this router sent: it is the child's own request, and the only
      // thing that can answer it is the client above. Forwarded under an id of
      // the router's own so the client's reply is unambiguously ours to route
      // back, and the child's id is kept so the reply reaches it as its own.
      if (msg.method !== undefined) {
        if (msg.id === undefined) continue;             // a child notification wants nobody
        const up = "router-up-" + (++upSeq);
        UP.set(up, { resident: this, childId: msg.id });
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: up, method: msg.method, params: msg.params }) + NL);
        continue;
      }
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || String(msg.error)));
      else p.resolve(msg.result);
    }
  }
  // the client's answer, back down to the child that asked, under the child's id
  answer(childId, payload) {
    if (this.child) this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: childId, ...payload }) + NL);
  }
  request(method, params) {
    if (!this.child) return Promise.reject(new Error(this.name + ": " + (this.busy || this.state)));
    if (this.error) return Promise.reject(new Error(this.name + ": " + this.error));
    const id = this.nextId++;
    const child = this.child;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + NL);
    });
  }
  notify(method, params) {
    if (this.child) this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + NL);
  }
  // initialize the child, learn its instructions, verbs and prompts; a child
  // that cannot boot leaves the router serving the others and says so
  boot() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        await capsSeen;                    // only the real client's offer may be passed on
        const init = await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: childCaps(), clientInfo: { name: "arest-router", version: "1.0.0" } });
        this.instructions = String((init && init.instructions) || "");
        this.notify("notifications/initialized", {});
        const list = await this.request("tools/list", {});
        this.tools = (list && list.tools) || [];
        try { const pl = await this.request("prompts/list", {}); this.prompts = (pl && pl.prompts) || []; } catch { this.prompts = []; }
        if (this.child) this.state = "serving";
      } catch (e) {
        if (!this.error) this.error = String(e.message);
        this.state = "failed";
      }
    })();
    return this.ready;
  }
  status() {
    const s = this.busy
      ? this.busy + (this.child ? " (the previous build still serves)" : "")
      : this.state === "serving" ? "serving" : "not serving: " + (this.error || this.state);
    return this.note ? s + " -- " + this.note : s;
  }
  // apps_check: the app's own check, in its package -- the design state from
  // its readings, by whichever writer the package names (canon's
  // compile-design-state.js or the oracle). The server keeps serving the
  // previous build; the carriers are spliced into a module at build time, so
  // nothing running holds them.
  check() {
    if (this.busy) return null;
    this.busy = "checking";
    this.note = "";
    // AND THE STORE IS BUILT WITH THE CARRIERS (#109). The app's check names its
    // own readings directories -- the router does not know them and should not --
    // so AREST_DB beside AREST_OUT_DIR is the whole change: compile.js writes the
    // tables rmap:ddl emits and the rows rmap:proj_rows answers, carries forward
    // what the runtime wrote into the prior store, and stamps it with the same
    // composition build.js stamps the module with. A compiled app then serves from
    // its database instead of from its carriers.
    run(["run", "--silent", "check"], this.pkg, { AREST_DB: join(this.dir, "store.db") }).then(({ code, tail }) => {
      this.note = (code === 0 ? "check ok: " : "check FAILED (exit " + code + "): ") + lastLines(tail, code === 0 ? 1 : 6);
      this.busy = null;
    });
    return "checking " + this.name + ": bun run check in " + this.pkg + "; `apps` reports the result";
  }
  // apps_compile: the module from the carriers, then this app's server again.
  // The server is stopped first because it holds store.db open.
  //
  // THE STORE IS REBUILT BY THE CHECK, AND THIS BUILDS THE MODULE THAT READS IT
  // (2026-09-21, #109 closed). What stood here said the store could not be
  // rebuilt at all: compile-store.js was deleted and canon emitted the SCHEMA
  // with no projection of the populations into it and no inverse, so a compiled
  // app served from its carriers while loadStoreDb refused its store.db on the
  // composition stamp. Canon has the projection (rmap:proj_rows) and the inverse
  // (rmap:unproj) now, compile.js writes and stamps the store, and apps_check
  // passes it AREST_DB. So the order is the order it always was -- apps_check,
  // then apps_compile -- and the module this builds is stamped to match the store
  // that check just wrote.
  compile() {
    if (this.busy) return null;
    this.busy = "compiling";
    this.note = "";
    this.stop("compiling");
    const env = { AREST_CARRIERS: this.dir, AREST_OUT_DIR: this.dir };
    (async () => {
      const b = await run([join(here, "build.js"), "test"], this.pkg, env);
      this.note = b.code !== 0
        ? "module build FAILED (exit " + b.code + "): " + lastLines(b.tail, 6)
        : "compiled: " + lastLines(b.tail, 1);
      this.busy = null;
      this.spawn();
      await this.boot();
      // the surface this app serves is the surface the router offers, so the
      // client is told to read it again rather than keep the list it cached at
      // initialize.
      announceTools();
    })();
    return "compiling " + this.name + ": its server is stopped, build.js test runs in " + this.pkg + ", then it serves the new module over the store apps_check wrote";
  }
}

const apps = parseApps(process.env.AREST_APPS);
const residents = new Map(apps.map((a) => [a.name, new Resident(a)]));
const booting = Promise.all([...residents.values()].map((r) => r.boot()));

const isVerb = (t) => t.inputSchema && t.inputSchema.properties && t.inputSchema.properties.args && !t.inputSchema.properties.method;
const names = () => [...residents.keys()];
const appArg = () => ({ type: "string", enum: names(), description: "the resident app this call is for" });

function tools() {
  // the verbs are canon's and the same in every app: take the first resident
  // that booted, add the app argument, and offer the router's own
  const first = [...residents.values()].find((r) => !r.error && r.tools.length);
  const verbs = first ? first.tools.filter(isVerb) : [];
  const withApp = verbs.map((t) => ({
    name: t.name,
    description: t.description + " -- in the app named by `app`",
    inputSchema: { type: "object",
      properties: { app: appArg(), ...t.inputSchema.properties },
      required: ["app"] },
  }));
  return [
    { name: "apps", description: "the resident apps: whether each is serving, and its last check or compile result", inputSchema: { type: "object", properties: {} } },
    { name: "apps_check", description: "run the app's own check in its package (bun run check: the design state from its readings); the app keeps serving its previous build meanwhile, and `apps` reports the result. After a readings change: apps_check, then apps_compile.", inputSchema: { type: "object", properties: { app: appArg() }, required: ["app"] } },
    { name: "apps_compile", description: "rebuild the app's module from its carriers (build.js test) and start its server again; the app is not served meanwhile, and `apps` reports the result. The store is written by apps_check, stamped to match this module, so run apps_check first and the app serves from its database", inputSchema: { type: "object", properties: { app: appArg() }, required: ["app"] } },
  ].concat(withApp);
}

// A CACHED TOOL LIST GOES STALE AND NOTHING SAID SO (2026-09-17). `tools()`
// rebuilds the list on every tools/list -- the app argument's enum is
// `names()`, a function -- so the router always KNOWS the current surface. But
// a client reads tools/list once at initialize and caches it, and the router
// advertised no `listChanged`, so after apps_compile changed an app's verb
// surface (any canon commit does) a running session kept calling the old list
// and a newly registered app was not addressable without reconnecting. That
// was one of support's seven. The capability is now declared and this is the
// notification that goes with it: a server that says listChanged and never
// sends one is the same silence with a promise attached.
function announceTools() {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }) + NL);
}

function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
function fail(id, message) { return { jsonrpc: "2.0", id, error: { code: -32603, message } }; }
const text = (id, s, isError) => reply(id, { content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) });

async function handle(msg) {
  if (msg.method === "initialize") {
    // learned before `await booting`, because that is what the children's own
    // initialize is waiting on; the other way round is a deadlock
    clientCaps = (msg.params && msg.params.capabilities) || {};
    sawClient();
    await booting;
    const lines = [];
    for (const r of residents.values()) lines.push(r.name + (r.error ? " (not serving: " + r.error + ")" : ": " + r.instructions));
    return reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: true }, prompts: {} },
      serverInfo: { name: "arest", version: "1.0.0" },
      instructions: "AREST serves " + residents.size + " resident apps, each its own store; every verb takes `app`: " + names().join(", ") +
        ". A readings change is apps_check then apps_compile on that app; `apps` reports each. " + lines.join(" ||| "),
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
      const rows = [...residents.values()].map((r) => [r.name, r.status(), r.dir]);
      return text(msg.id, JSON.stringify(rows));
    }
    const args = { ...(p.arguments || {}) };
    const app = args.app;
    delete args.app;
    const r = residents.get(app);
    if (!r) return text(msg.id, "no resident app named " + JSON.stringify(app) + "; the apps are " + names().join(", "), true);
    if (p.name === "apps_check" || p.name === "apps_compile") {
      const started = p.name === "apps_check" ? r.check() : r.compile();
      return started ? text(msg.id, started) : text(msg.id, r.name + " is " + r.status() + "; wait for `apps` to report it", true);
    }
    try { return reply(msg.id, await r.request("tools/call", { name: p.name, arguments: args })); }
    catch (e) { return text(msg.id, String(e.message), true); }
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
    // the client answering a question a CHILD asked: not a call, a reply to route
    if (msg.method === undefined && msg.id !== undefined && UP.has(msg.id)) {
      const { resident, childId } = UP.get(msg.id);
      UP.delete(msg.id);
      resident.answer(childId, msg.error ? { error: msg.error } : { result: msg.result });
      continue;
    }
    handle(msg).then((out) => { if (out) process.stdout.write(JSON.stringify(out) + NL); },
      (e) => { process.stdout.write(JSON.stringify(fail(msg.id === undefined ? null : msg.id, String(e && e.message))) + NL); });
  }
});
process.stdin.on("end", () => { for (const r of residents.values()) r.stop("router closed"); process.exit(0); });
