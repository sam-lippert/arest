// THE APP IS A PER-CALL ARGUMENT, AND THE STORES ARE RESIDENT TOGETHER.
//
// Sam, 2026-09-15: "Choosing the app that you're calling should be dynamic."
// "We also can't have it be single-threaded. A swarm of agents may want to
// use different apps at the same time." And 2026-09-16: "It's necessary for
// you to be able to use claude while support uses support.auto.dev."
//
// This is the router (#117's recommendation A): it speaks MCP on stdio, and
// behind it runs the unchanged single-store server (the app's compiled mcp.g.js) once
// per resident app, each in its own process over its own store. A call names
// its app; the router forwards it to that app's process and answers when it
// answers, so two agents on two apps never wait on each other, and two calls
// on one app are answered in that app's order. The router decides nothing
// about the model: every answer is canon's, from the app's own server.
//
//   bun tools/js-runner/mcp-router.js
//
// THE APP LIST IS A STORE, NOT A STRING (Sam, 2026-09-21: "Is there a way for
// the mcp to have its own db for app listing and config?"; 2026-09-23: "I don't
// like the app list coming from a config file. AREST should have an mcp sqlite
// store for config."). The router's store is the registry PACKAGE beside this
// file, registry/. Its readings say which apps there are, where each package
// is and whether to start it; `bun run check` there compiles them the way
// every app's check compiles its own; and this daemon reads the App table of
// registry/.check/store.db with bun:sqlite -- one select, the columns taken BY
// NAME, the handle closed before anything else runs, because a check renames
// a build over that file and an open handle is the EPERM stop() below exists
// for. An app's .check directory follows from its package directory, and the
// package is where its own scripts run. Nothing in a launch configuration
// names an app; AREST_REGISTRY points the router at ANOTHER registry package,
// which is what a test does.
//
// THE STORE IS BUILT BEFORE THE FIRST READ. The daemon's start runs the
// registry's own check when there is no store or its readings are newer, so
// a fresh clone and an edit to readings/apps.md both come up serving what the
// readings say. A registry that cannot be built or read is a REFUSAL carrying
// the check's report or the command that builds it, and never an empty list:
// a router that serves nothing and says nothing cannot be told apart from one
// whose apps are all still booting.
//
// AREST_APPS -- the semicolon-separated string the launch configuration named
// the apps in until 2026-09-23 -- is not read. Where a launch still sets it,
// `apps` says so, and the line can be deleted.
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
import { readFileSync, appendFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { Database } from "bun:sqlite";
import { createServer, connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// THE REAL BUN, AND NO WINDOW (Sam, 2026-09-24: "a shell pops up when I start the
// mcp"). `bun` on this machine is chocolatey's launcher, which starts the real
// bun.exe as ITS child, and a flag given to the launcher does not reach that child.
// The daemon was spawned detached through it, so the launcher had no console, the
// real bun it started got a new one, and Windows handed that console to Windows
// Terminal: measured at the MCP's start (conhost for the daemon's bun, then
// OpenConsole under svchost, 08:14:52) and again for a scratch router on another
// port (08:23:02). So every bun this file starts is process.execPath -- the bun
// running it, the real one -- and every child is started with windowsHide, since
// a detached daemon has no console of its own for them to inherit.
const BUN = process.execPath;
const NL = "\n";
// ONE ROUTER FOR EVERY SESSION (Sam, 2026-09-21: "The MCP should be able to
// host all apps at the same time and be non-blocking"). This file runs in two
// modes. `--daemon` is the router as it was -- the six app servers as its own
// children, the verbs forwarded, the session verbs -- listening on a local
// port instead of stdio, every connected client answered on its own line
// stream. The default mode, the one ~/.claude.json launches, is a shim: it
// connects to the daemon, starting one if none listens, and pipes its stdio
// to the socket. Measured before this: two sessions meant two routers, each
// owning its own children under "one server per app directory", so every
// apps_compile from one reaped the other's app -- six down at a time.
// The daemon's stderr is a log file beside it, because a detached process
// has no terminal and the reason a child exited was otherwise lost.
const DAEMON = process.argv.includes("--daemon");
const PORT = Number(process.env.AREST_ROUTER_PORT || 41817);
const LOG = join(here, ".router.log");
function log(line) {
  const s = String(line).endsWith(NL) ? String(line) : String(line) + NL;
  if (DAEMON) { try { appendFileSync(LOG, new Date().toISOString().slice(11, 19) + " " + s); } catch {} }
  else process.stderr.write(s);
}
// the connected clients: each speaks JSON-RPC on its own stream; a reply goes
// to the client that asked, a notification to all, and a child's own request
// (sampling) to the client whose capabilities the children were told
const clients = new Set();
let primary = null;
const broadcast = (line) => { for (const c of clients) { try { c.write(line + NL); } catch {} } };
const upWrite = (line) => { const c = primary && clients.has(primary) ? primary : [...clients][0]; if (c) { try { c.write(line + NL); } catch {} } };

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

// ---- THE REGISTRY: THE ROUTER'S OWN STORE ---------------------------------
// A row is <slug, package directory, serving status>, and those three column
// names are canon's relational map over the registry's readings -- App(.Slug),
// `App has Package Directory`, `App has Serving Status`. They are read BY NAME:
// the map orders a table's columns by its own rules, and reading by position
// would silently swap a name for a path the first time it reordered them.
//
// THE HANDLE IS NEVER HELD. compile.js writes store.db.build beside the store
// and renames it in; on Windows a rename over an open file is EPERM, which is
// exactly the failure the stop() note below records. So the database is opened,
// read and closed inside read(), and nothing in this process keeps a handle on
// it between calls.
const REGISTRY_NAME = "registry";
class Registry {
  constructor() {
    this.pkg = String(process.env.AREST_REGISTRY || join(here, "registry")).trim().replace(/\\/g, "/").replace(/\/+$/, "");
    this.ignoredApps = String(process.env.AREST_APPS || "").trim() !== "";   // a launch still naming apps: said, not read
    this.dir = this.pkg + "/.check";
    this.db = this.dir + "/store.db";
    this.built = "";                        // what the start's check did, when it ran one
    this.error = "";                        // why there is no list at all
    this.note = "";                         // the last check's result, or refused rows
    this.busy = null;                       // null | checking
    this.readMs = 0;
    this.count = 0;
  }
  // WHAT TO RUN, SAID IN FULL, wherever there is no store to read.
  howToBuild() {
    return "run `bun run check` in " + this.pkg + " (or apps_check on '" + REGISTRY_NAME
      + "' and then apps_compile on it), which compiles readings/apps.md into its App table";
  }
  source() { return this.db; }
  // AND A STORE OLDER THAN ITS READINGS IS SAID, NOT GUESSED AT. Its rows are
  // still served -- refusing on an mtime would take the router down for an edit
  // in progress -- but the list is the previous check's, and nothing else in
  // this process would ever say so. Recomputed wherever it is reported, not
  // cached at read(): an edit to the readings calls nothing, and two statSyncs
  // over a directory of markdown are nothing beside the answer they qualify.
  staleness() {
    if (!existsSync(this.db)) return "";
    try {
      const at = statSync(this.db).mtimeMs;
      let newest = 0, which = "";
      for (const f of readdirSync(join(this.pkg, "readings"))) {
        const m = statSync(join(this.pkg, "readings", f)).mtimeMs;
        if (m > newest) { newest = m; which = f; }
      }
      if (newest > at) return "STALE: readings/" + which + " is newer than the store, so this list is the previous check's -- " + this.howToBuild();
    } catch { /* no readings directory beside the store: nothing to compare */ }
    return "";
  }
  // THE START BUILDS WHAT IT IS ABOUT TO READ: with no store, or readings newer
  // than it, the registry's own check runs first -- the command apps_check runs,
  // synchronously here, since nothing is served until the list is known. A check
  // that fails leaves read() to refuse (no store) or to serve the previous one
  // (stale), and either way `apps` carries the check's report.
  ensureBuilt() {
    const had = existsSync(this.db);
    if (had && !this.staleness()) return;
    const why = had ? "its readings are newer than the store" : "there was no store";
    const r = spawnSync(BUN, ["run", "--silent", "check"], { cwd: this.pkg, env: { ...process.env, AREST_DB: this.db }, encoding: "utf8", windowsHide: true });
    const out = String(r.stderr || "") + NL + String(r.stdout || "") + (r.error ? NL + String(r.error.message) : "");
    this.built = r.status === 0
      ? "built at start because " + why + ": " + (lastLines(String(r.stdout || ""), 1) || lastLines(out, 1))
      : "the check at start FAILED (exit " + r.status + ", because " + why + "): " + lastLines(out, 6);
  }
  read() {
    const t0 = Date.now();
    this.error = "";
    const done = (v) => { this.readMs = Date.now() - t0; this.count = v.length; return v; };
    if (!existsSync(this.db)) {
      this.error = "the registry store is not compiled: there is no " + this.db + ". To build it, " + this.howToBuild() + ".";
      return done([]);
    }
    let rows = [];
    try {
      const db = new Database(this.db, { readonly: true });
      try {
        const cols = db.query('pragma table_info("App")').all().map((c) => String(c.name));
        if (!cols.length) {
          this.error = "the registry store " + this.db + " has no App table: its readings declare no App. " + this.howToBuild() + ".";
          return done([]);
        }
        for (const need of ["slug", "packageDirectory"]) {
          if (cols.includes(need)) continue;
          this.error = "the registry store " + this.db + " has an App table with no `" + need + "` column (it has "
            + cols.join(", ") + "): its readings declare no `App has Package Directory`. " + this.howToBuild() + ".";
          return done([]);
        }
        // THE OPTIONAL COLUMN IS ASKED FOR ONLY WHERE IT EXISTS: a registry
        // whose readings carry no Serving Status is one where every app serves.
        const want = ["slug", "packageDirectory"].concat(cols.includes("servingStatus") ? ["servingStatus"] : []);
        // NO ORDER BY. The natural order is the order the readings assert the
        // apps in, which is the order they boot in and the order `apps` lists.
        rows = db.query("select " + want.map((c) => '"' + c + '"').join(", ") + ' from "App"').all();
      } finally { db.close(true); }
    } catch (e) {
      this.error = "the registry store " + this.db + " could not be read: " + String(e.message) + ". " + this.howToBuild() + ".";
      return done([]);
    }
    const apps = [];
    const refused = [];
    for (const row of rows) {
      const name = String(row.slug === null || row.slug === undefined ? "" : row.slug).trim();
      const pkg = String(row.packageDirectory === null || row.packageDirectory === undefined ? "" : row.packageDirectory)
        .trim().replace(/\\/g, "/").replace(/\/+$/, "");
      // ABSENCE READS AS SERVING: the smallest row the readings can carry is a
      // package directory, and it serves. 'suspended' is the opt-out.
      const serving = row.servingStatus === null || row.servingStatus === undefined ? "serving" : String(row.servingStatus);
      if (!name) { refused.push("a row with no slug"); continue; }
      if (!pkg) { refused.push("App '" + name + "' has no Package Directory"); continue; }
      if (name === REGISTRY_NAME) { refused.push("App '" + name + "' is the name this router uses for the registry itself"); continue; }
      apps.push({ name, dir: pkg + "/.check", suspended: serving === "suspended" });
    }
    this.note = refused.length ? refused.length + " row(s) REFUSED: " + refused.join("; ") : "";
    return done(apps);
  }
  // apps_check on the registry: its own check, in its own package, the same
  // call an app's check is. Nothing is stopped first, because nothing here
  // holds the store open.
  check() {
    if (this.busy) return null;
    this.busy = "checking";
    this.note = "";
    run(["run", "--silent", "check"], this.pkg, { AREST_DB: join(this.dir, "store.db") }).then(({ code, tail }) => {
      this.note = (code === 0 ? "check ok: " : "check FAILED (exit " + code + "): ") + lastLines(tail, code === 0 ? 1 : 6);
      this.busy = null;
    });
    return "checking the registry: bun run check in " + this.pkg + "; `apps` reports the result, and apps_compile on '"
      + REGISTRY_NAME + "' then reads the App table again and reconciles the residents against it";
  }
  status() {
    if (this.busy) return this.busy + " (the residents are reconciled by apps_compile on '" + REGISTRY_NAME + "')"
      + (this.note ? " -- " + this.note : "");
    const head = this.error
      ? "NO APP IS SERVED: " + this.error
      : this.count + " app(s) from " + this.source() + ", read in " + this.readMs + " ms";
    return [head, this.staleness(), this.built, this.note,
      this.ignoredApps ? "AREST_APPS is set in this launch and was NOT read -- the list is this store's, so delete it from the launch configuration" : ""]
      .filter(Boolean).join(" -- ");
  }
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
      p = spawn(BUN, args, { cwd, env: { ...process.env, ...(extraEnv || {}) }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
    this.state = "booting";                 // booting | serving | failed | stopped | suspended
    this.busy = null;                       // null | checking | compiling
    this.note = "";                         // the last check or compile result
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
    // THE SEPARATOR IS NOT THE PATH. The registry read normalises a dir to forward
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
          { env: { ...process.env, AREST_REAP_MARKER: marker }, encoding: "utf8", timeout: 20000, windowsHide: true });
        pids = String(ps.stdout || "").split(/\s+/).filter((s) => /^\d+$/.test(s)).map(Number);
      } else {
        const pg = spawnSync("pgrep", ["-f", marker], { encoding: "utf8", timeout: 20000 });
        pids = String(pg.stdout || "").split(/\s+/).filter((s) => /^\d+$/.test(s)).map(Number);
      }
    } catch { return 0; }
    pids = pids.filter((p) => p !== process.pid);
    for (const p of pids) {
      try {
        if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        else process.kill(p, "SIGKILL");
      } catch { /* already gone */ }
    }
    if (pids.length) log("[" + this.name + "] reaped " + pids.length +
      " orphaned server process(es) still holding " + this.dir);
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
    // THE SERVER IS THE MODULE apps_compile BUILT, OVER THE STORE apps_check
    // WROTE (Sam, 2026-09-21: "it should just use the existing store"). This
    // ran build.js mcp --run, which composes the module from the working tree
    // at every spawn and stamps it there. Measured at the 18:39 reboot: the
    // daemon rewrote all six mcp.g.js from a tree carrying an uncommitted canon
    // patch, five stores no longer matched their module's stamp, and five apps
    // died at boot with their stores intact. Composing is apps_compile's move
    // alone; a spawn runs what was compiled, and an app never compiled says so
    // instead of building one.
    const module = join(this.dir, "mcp.g.js");
    if (!existsSync(module)) {
      this.child = null;
      this.error = "not compiled: no mcp.g.js in " + this.dir + " (apps_check, then apps_compile)";
      this.state = "failed";
      this.ready = Promise.resolve();
      return;
    }
    const child = spawn(BUN, [module], {
      env: { ...process.env, AREST_CARRIERS: this.dir, AREST_OUT_DIR: this.dir, AREST_STORE_DB: this.dir + "/store.db" },
      stdio: ["pipe", "pipe", "pipe"],
      // its own process group where a group can be signalled, so stop() below
      // can reach the whole tree; on Windows detached would open a console, and
      // taskkill /T walks the tree instead.
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { if (this.child === child) this.onData(chunk); });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(NL)) {
        if (!line.trim()) continue;
        log("[" + this.name + "] " + line);
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
  // AND A SUSPENDED APP IS NOT STARTED AT ALL. Serving Status is the one piece
  // of per-app config the router can act on: the row keeps its package
  // directory, `apps` lists it, the per-verb enum leaves it out, and no server
  // is spawned. Absence of the value reads as serving, so this is only ever
  // reached because the registry's readings say 'suspended'.
  suspend() {
    this.child = null;
    this.state = "suspended";
    this.error = "suspended in the registry: App '" + this.name
      + "' has Serving Status 'suspended', so no server is started for it";
    this.ready = Promise.resolve();
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
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
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
        upWrite(JSON.stringify({ jsonrpc: "2.0", id: up, method: msg.method, params: msg.params }));
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
    // THE REASON, NOT THE STATE NAME. A resident with no child has one in
    // `error` -- "not compiled: no mcp.g.js in ...", "server exited with code
    // 1", "suspended in the registry: ..." -- and answering `qa: failed` threw
    // that away at the one moment a caller was asking.
    if (!this.child) return Promise.reject(new Error(this.name + ": " + (this.busy || this.error || this.state)));
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
      ? this.busy + " (not served until apps_compile)"
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
    // AND THE SERVER IS STOPPED FIRST, BECAUSE THE STORE THE CHECK WRITES IS THE
    // ONE IT HOLDS OPEN (2026-09-21). Measured on support: the check ran to its
    // last line and failed there, renaming store.db.build over store.db --
    // EPERM, errno -4048, compile.js:383 -- because the serving child held
    // store.db (stop() above: bun releases a sqlite handle at exit, not
    // before). compile() stops the child for that reason; a check that said
    // "the previous build still serves" was the sentence that failed it, and
    // one that had succeeded would have left the child serving the OLD
    // projections over the NEW tables and writing them back. Not served from
    // here until apps_compile spawns it again over the store this writes.
    this.stop("checking");
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
    return "checking " + this.name + ": bun run check in " + this.pkg + "; not served until apps_compile; `apps` reports the result";
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
      const b = await run([join(here, "build.js"), "mcp"], this.pkg, env);
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
    return "compiling " + this.name + ": its server is stopped, build.js mcp runs in " + this.pkg + ", then it serves the new module over the store apps_check wrote";
  }
}

const registry = new Registry();
const residents = new Map();
// RECONCILE, DO NOT REBUILD. A resident already serving the directory the table
// still names is left alone -- its server is the expensive thing here, fifteen
// seconds and half a gigabyte on the smallest app -- so only the difference
// moves: a row that is new is spawned, a row that is gone or newly suspended is
// stopped, and a row whose package directory changed is stopped and spawned
// again at the new one. This is what apps_compile on the registry runs, and it
// is what the daemon's own start runs over an empty residents map.
//
// EVERY APP AT ONCE, EACH ANNOUNCED AS IT LANDS (2026-09-21). The daemon boots
// its residents in parallel -- there is one daemon for every session, so a
// store's first boot after a rebuild happens once, not once per session -- and
// the client hears tools/list_changed for each as it comes up. A resident that
// fails stays "not serving" with its error; the others serve.
function reconcile() {
  const wanted = registry.read();
  const byName = new Map(wanted.map((a) => [a.name, a]));
  const started = [], stopped = [], parked = [];
  for (const [name, r] of [...residents]) {
    const a = byName.get(name);
    const why = !a ? "removed from the registry"
      : a.dir !== r.dir ? "its package directory changed to " + a.dir
      : a.suspended && r.state !== "suspended" ? "suspended in the registry"
      : !a.suspended && r.state === "suspended" ? "no longer suspended in the registry"
      : "";
    if (!why) continue;
    r.stop(why);
    residents.delete(name);
    stopped.push(name + " (" + why + ")");
  }
  for (const a of wanted) {
    if (residents.has(a.name)) continue;
    const r = new Resident(a);
    residents.set(a.name, r);
    if (a.suspended) { r.suspend(); parked.push(a.name); continue; }
    r.spawn();
    r.boot().then(announceTools);
    started.push(a.name);
  }
  announceTools();
  return { wanted, started, stopped, parked };
}
// The shim reads no registry and spawns nothing: it connects to the daemon and
// pipes its stdio. Only the daemon has residents, so only the daemon builds and
// reads the table, and a session's launch pays neither the check nor the select.
if (DAEMON) { registry.ensureBuilt(); reconcile(); }

const isVerb = (t) => t.inputSchema && t.inputSchema.properties && t.inputSchema.properties.args && !t.inputSchema.properties.method;
const names = () => [...residents.keys()];
const appArg = () => ({ type: "string", enum: names(), description: "the resident app this call is for" });
// AND THE TWO SESSION VERBS TAKE THE REGISTRY TOO, because apps_check and
// apps_compile on it are how the app LIST is changed: the check recompiles its
// readings, the compile reads the App table again and reconciles the residents.
// A client that validates against the enum could not name it otherwise.
const sessionArg = () => ({ type: "string", enum: names().concat([REGISTRY_NAME]),
  description: "the resident app this call is for, or '" + REGISTRY_NAME
    + "' -- the router's own store, whose App table says which apps there are" });

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
    { name: "apps", description: "the registry and the resident apps: where the app list was read from, whether each app is serving, and its last check or compile result", inputSchema: { type: "object", properties: {} } },
    { name: "apps_check", description: "run the app's own check in its package (bun run check: the design state from its readings, and its store); the app is stopped first, because it holds the store the check writes, and `apps` reports the result. After a readings change: apps_check, then apps_compile. On '" + REGISTRY_NAME + "' it recompiles the router's own readings -- which apps there are -- instead.", inputSchema: { type: "object", properties: { app: sessionArg() }, required: ["app"] } },
    { name: "apps_compile", description: "rebuild the app's module from its carriers (build.js mcp) and start its server again; the app is not served meanwhile, and `apps` reports the result. The store is written by apps_check, stamped to match this module, so run apps_check first and the app serves from its database. On '" + REGISTRY_NAME + "' it reads the App table again and reconciles the residents instead: a new app is spawned, a removed or suspended one is stopped.", inputSchema: { type: "object", properties: { app: sessionArg() }, required: ["app"] } },
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
  broadcast(JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }));
}

function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
function fail(id, message) { return { jsonrpc: "2.0", id, error: { code: -32603, message } }; }
const text = (id, s, isError) => reply(id, { content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) });

async function handle(msg) {
  if (msg.method === "initialize") {
    // learned first, because that is what the children's own initialize is
    // waiting on. AND THE HANDSHAKE DOES NOT WAIT FOR THE APPS (2026-09-21):
    // it awaited every boot, a store rebuilt against new canon boots fresh for
    // minutes, and the client gave up at 30 s -- "Starting mcp failed" -- with
    // every app it wanted a minute from serving. The answer is what is known
    // now; each app announces itself through tools/list_changed as it lands,
    // and `apps` says where each one is.
    clientCaps = (msg.params && msg.params.capabilities) || {};
    sawClient();
    const lines = [];
    for (const r of residents.values()) lines.push(r.name + (r.state === "serving" ? ": " + r.instructions : " (" + r.status() + ")"));
    // AND THE REGISTRY'S OWN STATE IS THE FIRST THING SAID WHEN IT REFUSES. A
    // client told that AREST serves 0 apps, and nothing else, has no way to
    // find out why; this is the one place every session reads.
    const head = registry.error
      ? "AREST serves NO app: " + registry.error
      : "AREST serves " + residents.size + " resident apps, each its own store; every verb takes `app`: " + names().join(", ");
    return reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: true }, prompts: {} },
      serverInfo: { name: "arest", version: "1.0.0" },
      instructions: head + ". The app list is the App table of " + registry.source() +
        "; a readings change is apps_check then apps_compile on that app, and on '" + REGISTRY_NAME +
        "' for the list itself. `apps` reports each. " + (registry.staleness() ? registry.staleness() + " ||| " : "") + lines.join(" ||| "),
    });
  }
  if (msg.method === "tools/list") { return reply(msg.id, { tools: tools() }); }
  if (msg.method === "prompts/list") {
    const r = [...residents.values()].find((x) => x.prompts && x.prompts.length);
    return reply(msg.id, { prompts: r ? r.prompts : [] });
  }
  if (msg.method === "prompts/get") {
    const r = [...residents.values()].find((x) => x.prompts && x.prompts.length);
    if (!r) return fail(msg.id, "no resident app carries the verbalization patterns");
    try { return reply(msg.id, await r.request("prompts/get", msg.params || {})); } catch (e) { return fail(msg.id, String(e.message)); }
  }
  if (msg.method === "tools/call") {
    const p = msg.params || {};
    if (p.name === "apps") {
      // THE REGISTRY IS THE FIRST ROW: where the list came from, how long it
      // took to read, and -- where there is no store to read -- the refusal and
      // the command that builds one. An empty list with no first row was the
      // silence this replaced, and it is reported as an error so that a client
      // cannot mistake it for six apps that are merely slow.
      const rows = [[REGISTRY_NAME, registry.status(), registry.dir || registry.source()]];
      for (const r2 of residents.values()) rows.push([r2.name, r2.status(), r2.dir]);
      return text(msg.id, JSON.stringify(rows), !!registry.error);
    }
    const args = { ...(p.arguments || {}) };
    const app = args.app;
    delete args.app;
    // THE REGISTRY IS NOT A RESIDENT. It has no server and no verbs; the two
    // session verbs are what it takes, and they change the LIST rather than an
    // app: apps_check recompiles its readings, apps_compile reads the App table
    // again and reconciles.
    if (app === REGISTRY_NAME) {
      if (p.name !== "apps_check" && p.name !== "apps_compile") {
        return text(msg.id, "'" + REGISTRY_NAME + "' is the router's own store, not a served app: only apps_check and apps_compile take it."
          + " The apps are " + (names().join(", ") || "none"), true);
      }
      if (p.name === "apps_check") {
        const started = registry.check();
        return started ? text(msg.id, started) : text(msg.id, "the registry is " + registry.status() + "; wait for `apps` to report it", true);
      }
      const was = names().join(", ") || "none";
      const out = reconcile();
      if (registry.error) return text(msg.id, "the registry was read again and REFUSES: " + registry.error, true);
      return text(msg.id, "the registry was read again: " + out.wanted.length + " app(s) from " + registry.db
        + " in " + registry.readMs + " ms"
        + (out.started.length ? "; started " + out.started.join(", ") : "")
        + (out.parked.length ? "; suspended, not started: " + out.parked.join(", ") : "")
        + (out.stopped.length ? "; stopped " + out.stopped.join(", ") : "")
        + (out.started.length || out.stopped.length || out.parked.length ? "" : "; nothing changed")
        + ". The residents are now " + (names().join(", ") || "none") + " (they were " + was + ")"
        + (registry.note ? ". " + registry.note : "")
        + (registry.staleness() ? ". " + registry.staleness() : ""));
    }
    const r = residents.get(app);
    if (!r) return text(msg.id, "no resident app named " + JSON.stringify(app) + "; "
      + (registry.error ? registry.error : "the apps are " + (names().join(", ") || "none")), true);
    if (p.name === "apps_check" || p.name === "apps_compile") {
      const started = p.name === "apps_check" ? r.check() : r.compile();
      return started ? text(msg.id, started) : text(msg.id, r.name + " is " + r.status() + "; wait for `apps` to report it", true);
    }
    if (r.ready) await r.ready;              // this app's boot, not every app's
    try { return reply(msg.id, await r.request("tools/call", { name: p.name, arguments: args })); }
    catch (e) { return text(msg.id, String(e.message), true); }
  }
  if (msg.id === undefined) return null;
  return fail(msg.id, "unknown method: " + msg.method);
}

// THE LOOP DOES NOT SERIALISE: each line is handled on its own promise, and
// the answer goes out when it is ready, so a slow query in one app is not a
// wait in another. Answers to one client id are single lines, so interleaving
// is safe. One loop per connected client; ids are the client's own, so two
// clients using the same id never meet.
function attach(socket) {
  clients.add(socket);
  socket.setEncoding("utf8");
  let buf = "";
  socket.on("data", (chunk) => {
    buf += chunk;
    for (;;) {
      const nl = buf.indexOf(NL);
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { socket.write(JSON.stringify(fail(null, String(e.message))) + NL); continue; }
      // the client answering a question a CHILD asked: not a call, a reply to route
      if (msg.method === undefined && msg.id !== undefined && UP.has(msg.id)) {
        const { resident, childId } = UP.get(msg.id);
        UP.delete(msg.id);
        resident.answer(childId, msg.error ? { error: msg.error } : { result: msg.result });
        continue;
      }
      if (msg.method === "initialize" && (!primary || !clients.has(primary))) primary = socket;
      handle(msg).then((out) => { if (out) { try { socket.write(JSON.stringify(out) + NL); } catch {} } },
        (e) => { try { socket.write(JSON.stringify(fail(msg.id === undefined ? null : msg.id, String(e && e.message))) + NL); } catch {} });
    }
  });
  const gone = () => { clients.delete(socket); if (primary === socket) primary = null; idle(); };
  socket.on("close", gone);
  socket.on("error", gone);
}

// THE DAEMON OUTLIVES A SESSION AND NOT THE DAY: with no client for ten
// minutes it stops its children and exits, so a reconnect inside that window
// finds every app already up, and nothing is left running overnight.
let idleTimer = null;
function idle() {
  if (clients.size) { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } return; }
  if (idleTimer) return;
  idleTimer = setTimeout(() => {
    if (clients.size) return;
    log("no client for ten minutes; stopping the apps and exiting");
    for (const r of residents.values()) r.stop("router idle");
    process.exit(0);
  }, 10 * 60 * 1000);
}

function daemon() {
  const server = createServer((socket) => { attach(socket); idle(); });
  server.on("error", (e) => { log("cannot listen on 127.0.0.1:" + PORT + ": " + e.message); process.exit(1); });
  server.listen(PORT, "127.0.0.1", () => log("router daemon listening on 127.0.0.1:" + PORT
    + " for " + (names().join(", ") || "NO app") + " -- registry: " + registry.status()));
  process.on("exit", () => { for (const r of residents.values()) r.stop("daemon exit"); });
  idle();
}

// THE SHIM: what the client launches. Connect to the daemon; if none listens,
// start one detached and connect when it answers. Stdio is piped to the
// socket line for line, and the client's own end closes only this shim: the
// daemon and the apps stay up for the other sessions.
function shim() {
  let spawned = false;
  const started = Date.now();
  const attempt = () => {
    const sock = connect(PORT, "127.0.0.1");
    sock.on("connect", () => {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => sock.write(chunk));
      process.stdin.on("end", () => sock.end());
      sock.setEncoding("utf8");
      sock.on("data", (chunk) => process.stdout.write(chunk));
      sock.on("close", () => process.exit(0));
      sock.on("error", () => process.exit(0));
    });
    sock.on("error", (e) => {
      if (e && e.code !== "ECONNREFUSED") { process.stderr.write("router: " + e.message + NL); process.exit(1); }
      if (!spawned) {
        spawned = true;
        const d = spawn(BUN, [fileURLToPath(import.meta.url), "--daemon"], { env: process.env, detached: true, stdio: "ignore", windowsHide: true });
        d.unref();
        process.stderr.write("router: started the daemon (pid " + d.pid + ") on 127.0.0.1:" + PORT + "; its log is " + LOG + NL);
      }
      if (Date.now() - started > 30000) { process.stderr.write("router: no daemon answered on 127.0.0.1:" + PORT + " in 30 s" + NL); process.exit(1); }
      setTimeout(attempt, 250);
    });
  };
  attempt();
}

if (DAEMON) daemon();
else shim();
