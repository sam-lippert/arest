// The platform's registrations, a peer of tools/java-runner/Registrations.java: one body for each Function that
// metamodel/resolution.md declares with Definition Origin 'registered' and lambda applies, written from its row
// there. Each is outside D (a clock, a file, entropy, a database engine), which is why it is registered and not
// defined (AREST.tex Def. 9); a body that decides more than its row says is meaning in the host.
//
// A write call is one transaction: it commits whole or leaves the database as it was (Backus 14.3.1).
"use strict";
const fs = require("fs");
const nodePath = require("path");
const crypto = require("crypto");
const { Database } = require("bun:sqlite");
const A = require("./arest.js");

const KEY = "AREST_MASTER_KEY";

function text(x) {
  if (Array.isArray(x)) throw new Error("a sequence where a text belongs");
  return typeof x === "string" ? x : String(x);
}
const present = (s) => s !== undefined && s !== null && s !== "";
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();

// The master key: the environment's, else the AREST_MASTER_KEY line of the .env beside the lambda, a dev key kept on
// disk in plaintext. Never printed. An agent that holds the key (as git asks a credential helper, or
// a key in pageant) goes before the file.
function masterKey(root) {
  if (present(process.env[KEY])) return process.env[KEY];
  const p = nodePath.join(root, ".env");
  if (!fs.existsSync(p)) return undefined;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*AREST_MASTER_KEY\s*=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[1].trim();
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    return present(v) ? v : undefined;
  }
  return undefined;
}

function register(lambdaPath) {
  const root = nodePath.dirname(nodePath.resolve(lambdaPath)).replace(/\\/g, "/");
  const reg = A.register;

  // sequence -> text: now, ISO 8601 in UTC
  reg("clock", () => new Date().toISOString());
  // number-pair -> number: <x, s> to x at scale s, half away from zero
  reg("round", round);

  // path -> name-list; path -> text; path-and-text -> path, written beside itself and moved in, so a reader
  // never meets half of it
  reg("fs:dir", (x) => {
    const p = text(x);
    let names;
    try { names = fs.readdirSync(p); } catch (e) { throw new Error("fs:dir: not a directory: " + p); }
    return names;
  });
  reg("fs:read", (x) => fs.readFileSync(text(x), "utf8"));
  reg("fs:write", (x) => {
    const p = text(A.at(x, 0));
    fs.writeFileSync(p + ".build", text(A.at(x, 1)), "utf8");
    fs.renameSync(p + ".build", p);
    return p;
  });
  // text -> cell-list: a carrier read as cells, registering nothing
  reg("carrier:cells", (x) => A.cells(text(x)));
  // object -> path: the directory the composition's lambda was read from
  reg("module:root", () => root);
  // object -> identifier: the storage engine this host provides
  reg("storage:engine", () => "sqlite");

  // text -> digest: SHA-256, hex
  reg("crypt:digest", (x) => sha256(Buffer.from(text(x), "utf8")).toString("hex"));
  // AES-256-GCM under the SHA-256 of the key's text, as one text atom: base64 of iv (12) || tag (16) || ciphertext
  reg("crypt:encrypt", encrypt);
  reg("crypt:decrypt", decrypt);
  // env-path -> key-fingerprint: a new key appended to the file, never answered; refused where a key is set or
  // already in the file
  reg("crypt:genkey", genkey);
  // object -> boolean: whether the platform holds a key
  reg("crypt:keyed", () => (present(masterKey(root)) ? "T" : "F"));
  // type-and-value-and-store -> text: lambda's hook:write under the key
  reg("hook:seal", (x) => {
    const key = masterKey(root);
    if (!present(key)) throw new Error("hook:seal: there is no " + KEY + " to store a value through a Function with");
    return A.Ev("hook:write", [key, A.at(x, 0), A.at(x, 1), A.at(x, 2)]);
  });

  reg("sqlite:exec", (x) => {
    const p = text(A.at(x, 0));
    write(p, (db) => { db.exec(text(A.at(x, 1))); return null; });
    return p;
  });
  reg("sqlite:run", run);
  reg("sqlite:query", (x) => {
    const db = open(text(A.at(x, 0)), true);
    try { return query(db, text(A.at(x, 1)), A.seq(A.at(x, 2)), false); } finally { db.close(); }
  });
  reg("sqlite:scratch", (x) => {
    const db = open(":memory:", false);
    try { db.exec(text(A.at(x, 0))); return query(db, text(A.at(x, 1)), A.seq(A.at(x, 2)), false); } finally { db.close(); }
  });
  reg("sqlite:program", program);
  reg("sqlite:data_version", (x) => BigInt(watched(text(x)).query("pragma data_version").values()[0][0]));
  reg("sqlite:fresh", (x) => {
    const p = text(x);
    unwatch(p);
    for (const f of [p, p + "-wal", p + "-shm", p + "-journal"]) fs.rmSync(f, { force: true });
    return p;
  });
  reg("sqlite:install", (x) => {
    const build = text(A.at(x, 0)), p = text(A.at(x, 1));
    if (fs.existsSync(p)) throw new Error("sqlite:install refuses: " + p + " exists; a store that exists is changed in place, never overwritten by a fresh build");
    unwatch(build); unwatch(p);
    fs.renameSync(build, p);
    return p;
  });
  reg("sqlite:copy", (x) => {
    const from = text(A.at(x, 0)), to = text(A.at(x, 1));
    if (from === to || !fs.existsSync(from)) throw new Error("sqlite:copy refuses: nothing to copy from " + from + " to " + to);
    unwatch(to);
    for (const f of [to, to + "-wal", to + "-shm", to + "-journal"]) fs.rmSync(f, { force: true });
    const db = open(from, true);
    try { db.query("vacuum into ?").run(to); } finally { db.close(); }
    return to;
  });
  reg("sqlite:replace", (x) => {
    const build = text(A.at(x, 0)), p = text(A.at(x, 1));
    unwatch(build); unwatch(p); unwatch(p + ".prior");
    if (fs.existsSync(p)) {
      fs.rmSync(p + ".prior", { force: true });
      fs.renameSync(p, p + ".prior");
    }
    fs.renameSync(build, p);
    return p;
  });
}

// ---- the number --------------------------------------------------------------------------------------------

function round(x) {
  const v = A.at(x, 0), s = A.at(x, 1);
  if (typeof v !== "bigint") throw new Error("round on non-number");
  if (typeof s !== "bigint") throw new Error("round to a non-integer scale");
  if (s >= 0n) return v;
  // a 64-bit number is under half of 10^20, so it rounds to 0 there and beyond
  if (s <= -20n) return 0n;
  const pow = 10n ** -s;
  let q = v / pow;
  const r = v % pow;
  if ((r < 0n ? -r : r) * 2n >= pow) q += v < 0n ? -1n : 1n;
  return A.num(q * pow);
}

// ---- crypt --------------------------------------------------------------------------------------------------

function encrypt(x) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", sha256(Buffer.from(text(A.at(x, 0)), "utf8")), iv);
  const body = Buffer.concat([c.update(Buffer.from(text(A.at(x, 1)), "utf8")), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

function decrypt(x) {
  const all = Buffer.from(text(A.at(x, 1)), "base64");
  if (all.length < 28) throw new Error("crypt:decrypt on a ciphertext shorter than its iv and tag");
  const d = crypto.createDecipheriv("aes-256-gcm", sha256(Buffer.from(text(A.at(x, 0)), "utf8")), all.subarray(0, 12));
  d.setAuthTag(all.subarray(12, 28));
  try { return Buffer.concat([d.update(all.subarray(28)), d.final()]).toString("utf8"); }
  catch (e) { throw new Error("crypt:decrypt: " + e.message); }
}

function genkey(x) {
  const p = text(x);
  if (present(process.env[KEY])) throw new Error("crypt:genkey refuses: " + KEY + " is already set in the environment");
  const had = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (new RegExp("^\\s*" + KEY + "\\s*=", "m").test(had)) throw new Error("crypt:genkey refuses: " + KEY + " is already in " + p);
  const key = crypto.randomBytes(32).toString("base64");
  fs.appendFileSync(p, (had === "" || had.endsWith("\n") ? "" : "\n") + KEY + "=" + key + "\n", "utf8");
  return sha256(Buffer.from(key, "utf8")).toString("hex").substring(0, 12);
}

// ---- sqlite -------------------------------------------------------------------------------------------------

function open(p, readOnly) {
  return readOnly ? new Database(p, { readonly: true, safeIntegers: true }) : new Database(p, { readwrite: true, create: true, safeIntegers: true });
}

// one write call, one transaction
function write(p, work) {
  const db = open(p, false);
  try {
    db.exec("begin");
    try { const out = work(db); db.exec("commit"); return out; }
    catch (e) { try { db.exec("rollback"); } catch (_) { } throw e; }
  } finally { db.close(); }
}

// SQLite's own text for a value: an integer in decimal, a real as SQLite prints one (%!.15g), NULL as #
function sqlText(v) {
  if (v === null || v === undefined) return "#";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return realText(v);
  if (v instanceof Uint8Array) return Buffer.from(v).toString("utf8");
  return String(v);
}
function realText(v) {
  if (!Number.isFinite(v)) return v > 0 ? "Inf" : v < 0 ? "-Inf" : "NaN";
  let s = v.toPrecision(15);
  if (s.indexOf("e") >= 0) {
    let [m, e] = s.split("e");
    if (m.indexOf(".") >= 0) m = m.replace(/0+$/, "").replace(/\.$/, ".0"); else m += ".0";
    return m + "e" + (e[0] === "-" ? "-" : "+") + e.replace(/^[+-]/, "").padStart(2, "0");
  }
  if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, ".0"); else s += ".0";
  return s;
}

function bind(ps, hashIsNull) {
  return ps.map((v) => {
    if (Array.isArray(v)) throw new Error("a sequence where a value belongs");
    if (hashIsNull && v === "#") return null;
    return v;
  });
}

// a statement's rows, each value the text SQLite gives it and NULL as #
function query(db, statement, ps, hashIsNull) {
  return db.query(statement).values(...bind(ps, hashIsNull)).map((r) => r.map(sqlText));
}

// path-and-sql-and-rows -> number: one prepared statement per row, # bound as NULL, the count of rows run
function run(x) {
  const p = text(A.at(x, 0)), statement = text(A.at(x, 1)), rows = A.seq(A.at(x, 2));
  return write(p, (db) => {
    const st = db.prepare(statement);
    try {
      let n = 0;
      for (const r of rows) {
        try { st.run(...bind(A.seq(r), true)); }
        catch (e) { throw new Error(e.message + " -- row " + (n + 1) + " of " + rows.length); }
        n++;
      }
      return BigInt(n);
    } finally { st.finalize(); }  // a connection with a statement still prepared stays open past its close, and holds its file
  });
}

const changes = (db) => db.query("select total_changes()").values()[0][0];

// path-and-steps -> program-answer: the steps in order between one begin and one commit, as
// Registrations.java's program: exec, rows, fix, refuse and deny, each optionally guarded by a select
function program(x) {
  const p = text(A.at(x, 0)), steps = A.seq(A.at(x, 1));
  const db = open(p, false);
  try {
    db.exec("begin");
    try {
      const out = runSteps(db, steps);
      db.exec(out[0] === "committed" ? "commit" : "rollback");
      return out;
    } catch (e) { try { db.exec("rollback"); } catch (_) { } throw e; }
  } finally { db.close(); }
}

function runSteps(db, steps) {
  const answers = [], denied = [];
  let n = 0;
  for (const step of steps) {
    n++;
    const s = A.seq(step);
    const kind = text(s[0]), statement = text(s[1]);
    const ps = s.length > 2 ? A.seq(s[2]) : [];
    const guard = s.length > 3 && kind !== "fix" ? text(s[3]) : "";
    try {
      if (guard !== "" && query(db, guard, [], true).length === 0) { answers.push([]); continue; }
      if (kind === "exec") {
        const was = changes(db);
        if (ps.length > 0) db.query(statement).run(...bind(ps, true)); else db.exec(statement);
        answers.push(changes(db) - was);
      } else if (kind === "rows") {
        answers.push(query(db, statement, ps, true));
      } else if (kind === "fix") {
        const was = changes(db);
        const st = db.query(statement);
        for (let before = -1n; before !== changes(db); ) { before = changes(db); st.run(...bind(ps, true)); }
        answers.push(changes(db) - was);
      } else if (kind === "refuse") {
        const rows = query(db, statement, ps, true);
        if (rows.length > 0) return ["refused", BigInt(n), rows];
        answers.push(rows);
      } else if (kind === "deny") {
        const rows = query(db, statement, ps, true);
        answers.push(rows);
        if (rows.length > 0) denied.push([BigInt(n), rows]);
      } else {
        throw new Error("no step of kind " + kind);
      }
    } catch (e) {
      throw new Error("sqlite:program, step " + n + " (" + kind + "): " + e.message + " -- " + statement.substring(0, 300));
    }
  }
  if (denied.length > 0) return ["denied", denied];
  return ["committed", answers];
}

// PRAGMA data_version moves when ANOTHER connection commits, so it is asked on a connection kept for that alone,
// one per path, closed before its file is removed or renamed
const WATCHED = new Map();
function watched(p) {
  let db = WATCHED.get(p);
  if (!db) { db = open(p, true); WATCHED.set(p, db); }
  return db;
}
function unwatch(p) {
  const db = WATCHED.get(p);
  if (db) { WATCHED.delete(p); try { db.close(); } catch (_) { } }
}

module.exports = { register };
