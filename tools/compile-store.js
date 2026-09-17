// Compile the store's populations into a normalized relational database.
//
// The paper is explicit (AREST.tex Sec.2, Def.2): a population is a finite
// consistent SET. So the store on disk is Codd's relational form -- no order,
// no duplication, no serialized blob. RMAP (Halpin) gives the 3NF shape: each
// entity type's functional fact types are columns of one entity table, and
// each spanning (m:n) fact type is its own relation table. A fact type's
// population is then a projection -- a SELECT -- of its column(s), which is
// exactly Backus's fetch = Codd's restrict-then-project (Sec.3).
//
// This boots the composed store once (the closure runs here, so the stored
// populations are the closed ones) and emits <dir>/store.db. The js host reads
// it with AREST_STORE_DB set (loadStoreDb in host.js) and runs none of the
// boot pipeline. Held byte-identical to a text-carrier boot by the case suite
// and the reports.
//
// GENERALIZED (2026-09-08): one entity table per rmap:groups group, named by
// the group's object type (index [0]); base still yields exactly one table
// named "Function", byte-identically. The functional column of each fact type
// is read from the RMAP itself -- a group's members (rmap:members_of, in the
// same order as the wide-row columns, index [4]) -- so a fact type's column is
// its position among its group's members. No O(cols x rows) scan: only the ONE
// candidate column is verified against the population, because the RMAP names
// it. The single-column check STAYS, and is not redundant: on a store whose
// populations do not satisfy their declared single-role uniqueness in the
// absorbed direction, rmap:functionalp and the population disagree (base: 6
// fact types -- GuardReferencesFactType absorbs though its UC is compound;
// ObjectTypePlaysRole/FactTypeHasRole/... are functionalp yet m:n in the key
// the group absorbs on), so classifying by functionalp alone would change the
// store. The check is what keeps this byte-identical to the set-match it
// replaces.
import { Database } from "bun:sqlite";
import { unlinkSync, statSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const modDir = process.env.AREST_OUT_DIR || join(import.meta.dir, "js-runner");
delete process.env.AREST_STORE_DB;               // boot from the carriers, not a db
await import(pathToFileURL(join(modDir, "cases.g.js")).href);
const { Ev, CELLS } = globalThis.AREST;
if (!Ev) { console.error("no composition at " + modDir + "/cases.g.js"); process.exit(1); }

const flat = (v) => { let x = v; while (Array.isArray(x)) x = x.length ? x[0] : null; return x; };
// A RELATION TABLE'S NAME IS A FUNCTION OF THE FACT TYPE, and three places
// compute it: here, host.js emitToDb (a runtime write to a fact type the tables
// do not carry) and the migration writer below. Same hash, same table, or a
// runtime row and a migrated row land in two tables under one name.
const relTableName = (ft) => "r" + Math.abs([...ft].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
const fts = Ev("store:fts", CELLS);
const ftnames = fts.map((d) => d[0]).filter((n) => typeof n === "string");
const popof = {};
for (const ft of ftnames) { let p; try { p = Ev("system:pop_rows", [ft, CELLS]); } catch { p = []; } popof[ft] = Array.isArray(p) ? p : []; }

// One rmap:groups group -> one entity table. A group is
// <objecttype, members, <<1>>, phi, wide-rows>: index [0] is the object type
// (the table name), index [4] the wide rows <keyval, slot...>. Column c+1 of a
// wide row is member c of rmap:members_of, so a member's position IS its column.
const groups = Ev("rmap:groups", fts);
const G = groups.map((g, gi) => {
  const table = flat(g[0]);
  const wrows = g[4] || [];
  const projCol = (c) => wrows.filter((r) => Array.isArray(r[c + 1]) && r[c + 1].length).map((r) => [flat(r[0]), flat(r[c + 1])]);
  const members = Ev("rmap:members_of", [g[0], fts]).map((m) => m[0]);   // wide-row column order
  return { gi, table, wrows, projCol, members };
});
// ft -> {gi, col}: the column that fact type occupies in its group's wide row.
// Each fact type has one rmap:keyplayer, so it is a member of exactly one group.
const colOf = {};
for (const grp of G) for (let c = 0; c < grp.members.length; c++) { const nm = grp.members[c]; if (!(nm in colOf)) colOf[nm] = { gi: grp.gi, col: c }; }

// Classify. Absorb ft as a column iff its population equals its OWN wide-row
// column (the one the RMAP put it in) -- one O(rows) check, no column scan.
// Otherwise it is a relation cell. An empty population is neither (as before).
const funcCol = {};                          // ft -> {gi, col}
const funcByTable = new Map();               // gi -> [ft...] in fts order (column order)
const rel = [];
for (const ft of ftnames) {
  const pop = popof[ft]; if (!pop.length) continue;
  const cand = colOf[ft];
  if (cand && Array.isArray(pop[0]) && pop[0].length === 2) {
    const want = new Set(pop.map((r) => JSON.stringify([flat(r[0]), flat(r[1])])));
    const s = new Set(G[cand.gi].projCol(cand.col).map((x) => JSON.stringify(x)));
    if (s.size === want.size && [...want].every((x) => s.has(x))) {
      funcCol[ft] = cand;
      if (!funcByTable.has(cand.gi)) funcByTable.set(cand.gi, []);
      funcByTable.get(cand.gi).push(ft);
      continue;
    }
  }
  rel.push(ft);
}

// A VALUE TYPE THAT NAMES A STORAGE FUNCTION IS WRITTEN THROUGH IT (2026-09-14).
// `Object Type is stored through Function` (core.md) says a value reaches the
// STORE as what that Function made of it; hook:write applies it and hook:read
// applies the inverse. Samuel: "Prod keys live in .env at compile time and in
// db at runtime, encrypted if marked so" -- so plaintext exists in .env and in
// the carriers the oracle writes beside it, both gitignored and both on the
// machine that compiles, and the db that TRAVELS carries ciphertext.
//
// WHY THE SEAM IS HERE AND NOT IN THE ORACLE, which is the other candidate and
// would have made the carriers ciphertext too: crypt:encrypt is AES-256-GCM
// with a randomBytes(12) iv, so it answers differently every call. The carriers
// are byte-compared goldens. Encrypting upstream would churn every corpus
// golden on every run; store.db is gitignored and compared by nothing. The
// non-determinism picks the seam, not a preference.
//
// The players come from main:cr_players, the same reader main:api uses to check
// a POST body, so a role's Object Type is read from the model rather than named
// here -- swapping AES for a KMS handle stays an instance fact. On the base and
// on eight of the nine corpora ObjectTypeIsStoredThroughFunction is EMPTY and
// this whole block is skipped; on support it is one row, Secret Reference.
const master = process.env.AREST_MASTER_KEY || "";
const cipherAt = {};                         // ft -> [role index...] needing the hook
for (const ft of ftnames) {
  if (!popof[ft].length) continue;
  let players; try { players = Ev("main:cr_players", [CELLS, ft]); } catch { continue; }
  if (!Array.isArray(players)) continue;
  const marked = [];
  for (let i = 0; i < players.length; i++) {
    const ot = flat(players[i]);
    if (typeof ot !== "string") continue;
    let fn; try { fn = Ev("hook:fn_of", [ot, CELLS]); } catch { continue; }
    if (typeof fn === "string" && fn) marked.push([i, ot]);
  }
  if (marked.length) cipherAt[ft] = marked;
}
// REFUSE RATHER THAN WRITE PLAINTEXT. A db that is supposed to be ciphertext at
// rest and silently is not is the failure this whole marking exists to stop, and
// it would be invisible: the rows look identical to a reader without the key.
if (Object.keys(cipherAt).length && !master) {
  console.error("this store carries a value type marked `is stored through Function` (" +
    Object.keys(cipherAt).join(", ") + ") and AREST_MASTER_KEY is not set, so the value " +
    "could only be stored as plaintext. Set it, or remove the marking.");
  process.exit(1);
}
// A MARKED TYPE AT ROLE 0 OF AN ABSORBED FACT TYPE would land in the entity
// table's KEY column, which is written from the wide row's key and never passes
// through store1 -- so it would be stored as plaintext while every other marked
// value was encrypted, and nothing would say so. No corpus has one today (Secret
// Reference is always the value role), which is exactly why it would go unnoticed
// if one ever arrived. Refuse instead, on the same principle as the missing key.
for (const ft of Object.keys(cipherAt)) {
  if (funcCol[ft] && cipherAt[ft].some((e) => e[0] === 0)) {
    console.error(ft + " carries a value type marked `is stored through Function` in the role " +
      "its entity table uses as the key, which this writer stores unencrypted. Encrypting an " +
      "identifier is not supported here; give the marking to the value role or store it as a " +
      "relation.");
    process.exit(1);
  }
}
// ft, role index, raw value -> what the store should hold.
const store1 = (ft, i, v) => {
  const m = cipherAt[ft]; if (!m) return v;
  const hit = m.find((e) => e[0] === i); if (!hit) return v;
  return Ev("hook:write", [master, hit[1], String(v), CELLS]);
};

// A READINGS CHANGE MUST NOT COST THE DATA (2026-09-15). This used to unlink
// store.db and recreate it from the carriers, which silently dropped every fact
// written at runtime through main:api/emitToDb since the last build --
// arest-dev.events.jsonl holds rows whose fact types are in no reading at all.
// Samuel: "I don't want automatic schema evolution. That sounds like a ticking
// time bomb", and: "Migrations are fact types to assert or change, and
// optionally function definitions for adapting old facts to new types."
//
// So: SNAPSHOT THE OLD DATABASE FIRST, build the new one BESIDE it, and only
// replace the old once nothing has been lost. The old file is never destroyed
// before the comparison passes, which means a failed build leaves the store
// exactly as it was rather than half-written.
const dbp = join(modDir, "store.db");
const snapp = dbp + ".prior";

// BUN RELEASES A SQLITE HANDLE AT PROCESS EXIT, NOT AT close(). Opening store.db
// here and then trying to replace it later fails with EBUSY no matter how long
// we retry, while a separate process deletes it instantly -- measured 2026-09-15.
// So the snapshot is taken from a COPY: the live file is never opened by this
// process, stays replaceable, and the copy doubles as the restore if the build
// turns out to lose rows.
// SWEEP LAST RUN'S COPIES FIRST. The same handle behaviour means the unlink at
// the end of a run cannot succeed -- the file is still open until this process
// exits -- so the copies are cleared at the START, when nothing holds them.
for (const leftover of [snapp, dbp + ".check"]) {
  try { unlinkSync(leftover); } catch {}
}

const priorRows = new Map();
const priorLedger = new Map();                   // ft -> the rows the PREVIOUS build asserted
let priorMeta = [];
if (existsSync(dbp)) {
  try {
    copyFileSync(dbp, snapp);
    const old = new Database(snapp, { readonly: true });
    priorMeta = old.prepare("select ft, kind, tbl, arity from _meta").all();
    // THE LEDGER (2026-09-16, see _asserted below): a stored row the previous
    // build asserted is that build's, and the new build may say otherwise; a
    // stored row it did not assert was written at runtime. A database built
    // before the ledger existed carries none, and every row of it is treated
    // as runtime, which is exactly the older, stricter behaviour.
    try {
      for (const r of old.prepare("select ft, row from _asserted").all()) {
        if (!priorLedger.has(r.ft)) priorLedger.set(r.ft, new Set());
        priorLedger.get(r.ft).add(r.row);
      }
    } catch { /* no ledger: built before it existed */ }
    // A func row's _meta.tbl is the COLUMN name, not the table, so the owning
    // entity table is recovered from the schema -- the column name is unique to
    // one entity table (see the _meta note below and host.js loadStoreDb).
    const ownerOf = new Map();
    for (const t of old.prepare("select name from sqlite_master where type='table'").all()) {
      if (t.name.startsWith("_")) continue;
      for (const c of old.prepare('pragma table_info("' + t.name + '")').all()) {
        if (!ownerOf.has(c.name)) ownerOf.set(c.name, t.name);
      }
    }
    for (const m of priorMeta) {
      const isFunc = m.kind === "func";
      const tbl = isFunc ? ownerOf.get(m.ft) : m.tbl;
      if (!tbl) continue;
      // a functional column is <k, value>; a relation table is <c0..cn>
      const cols = isFunc
        ? ['"k"', '"' + m.ft + '"']
        : Array.from({ length: m.arity }, (_, i) => '"c' + i + '"');
      try {
        const rows = old.prepare("select " + cols.join(",") + ' from "' + tbl + '"').all();
        const keep = new Set();
        for (const r of rows) {
          const vals = Object.values(r);
          // an absent functional value is not a fact, so it cannot be lost
          if (isFunc && (vals[1] === null || vals[1] === undefined)) continue;
          keep.add(JSON.stringify(vals));
        }
        priorRows.set(m.ft, keep);
      } catch { /* a table the old schema named but does not carry */ }
    }
    old.close();
  } catch (e) {
    console.error("could not read the existing store.db (" + e.message + "); treating this as a first build");
  }
}

// A TABLE THE STORE ALREADY HAS IS NOT DROPPED BECAUSE THE READINGS STOPPED
// PRODUCING ROWS FOR IT (2026-09-17). The classification above materializes a
// fact type only when the readings give it rows, which is right for a FIRST
// build and wrong for every one after: a Support Request created at runtime is
// the only row SupportRequestHasSubject has, the readings have none, so the
// rebuild materialized nothing for it and the gate below read that as `no
// longer materialized` -- a shape change, a Migration nobody can write -- and
// refused the rebuild of a store whose readings had not moved at all. The fact
// type is still DECLARED and still says the same thing; what is empty is the
// carriers' half of its population. So a relation table the previous database
// carried is created again, empty, with its own arity, and the rows the runtime
// wrote are carried into it like any other. A fact type the readings no longer
// declare is NOT revived: that one is a real migration, and the gate says so.
const priorArity = new Map();
for (const m of priorMeta) if (m.kind === "rel") priorArity.set(m.ft, m.arity);
const declared = new Set(ftnames);
const already = new Set(rel);
for (const [ft] of priorArity) if (declared.has(ft) && !already.has(ft) && !funcCol[ft]) rel.push(ft);

try { unlinkSync(dbp); } catch {}
try { unlinkSync(dbp + "-wal"); } catch {}
const db = new Database(dbp);

// entity tables, in group order, only those that absorbed a column. For the
// base this is exactly one table named "Function" with the same 33 columns.
const usedGis = G.map((g) => g.gi).filter((gi) => funcByTable.has(gi));
for (const gi of usedGis) {
  const grp = G[gi];
  const fcols = funcByTable.get(gi);
  // A TABLE WITHOUT A KEY IS NOT A RELATION (Codd). An entity table is keyed by
  // k; a relation table below by all of its columns, and its inserts ignore a
  // row already present, because a population is a set (AREST.tex Def. 3)
  // and a fact asserted in two readings files is one fact -- the carriers
  // carried `App 'arest-dev' has navigable Domain 'canon-first'` twice and the
  // store served it twice (2026-09-16).
  db.run('create table "' + grp.table + '" (k text primary key' + fcols.map((ft) => ', "' + ft + '" text').join("") + ")");
  const ins = db.prepare('insert into "' + grp.table + '" values(?' + ",?".repeat(fcols.length) + ")");
  db.transaction(() => { for (const r of grp.wrows) { const row = [JSON.stringify(flat(r[0]))]; for (const ft of fcols) { const s = r[funcCol[ft].col + 1]; row.push(Array.isArray(s) && s.length ? JSON.stringify(store1(ft, 1, flat(s))) : null); } ins.run(...row); } })();
}

// _meta: one row per materialized fact type. func rows keep tbl = the column
// name (= ft): the base row (ft,"func",ft,2) is unchanged, so the committed
// base store.db and today's loadStoreDb are byte-identical/untouched. The
// entity table a functional column lives in is recoverable in the loader
// because the column name is unique to one entity table (see host.js note).
// [If explicit storage is preferred: set tbl = grp.table here and read
//  `select "<ft>" from "<tbl>"` in loadStoreDb -- but that changes the base
//  row to (ft,"func","Function",2), i.e. a one-time base-DB regen.]
db.run("create table _meta (ft text, kind text, tbl text, arity int)");
const mins = db.prepare("insert into _meta values(?,?,?,?)");
for (const ft of ftnames) if (funcCol[ft]) mins.run(ft, "func", ft, 2);
const relTbl = {};                           // ft -> its relation table
for (const ft of rel) {
  const pop = popof[ft], ar = Array.isArray(pop[0]) ? pop[0].length : (priorArity.get(ft) || 1);
  const tbl = relTableName(ft);
  relTbl[ft] = tbl;
  const cols = Array.from({ length: ar }, (_, i) => '"c' + i + '"');
  db.run("create table " + tbl + " (" + cols.map((c) => c + " text").join(",") + ", primary key (" + cols.join(",") + "))");
  const ins = db.prepare("insert or ignore into " + tbl + " values(" + Array.from({ length: ar }, () => "?").join(",") + ")");
  db.transaction(() => { for (const row of pop) { const t = Array.isArray(row) ? row : [row]; ins.run(...t.map((v, i) => JSON.stringify(store1(ft, i, v)))); } })();
  mins.run(ft, "rel", tbl, ar);
}
// _composition: WHICH MODULE THESE TABLES ARE A PROJECTION OF. build.js hashes
// the canon and carriers it splices and stamps the module with it; this records
// the stamp of the module booted above, and host.js loadStoreDb refuses a
// database carrying any other value. Refusing to WRITE an unstamped database is
// the same rule from the other side: an unstamped one can never be shown to
// match, so producing it would only produce a refusal later.
if (!globalThis.AREST.composition) {
  console.error("the module carries no composition stamp; rebuild it: bun tools/js-runner/build.js test");
  process.exit(1);
}
db.run("create table _composition (hash text)");
db.prepare("insert into _composition values(?)").run(globalThis.AREST.composition);
// _asserted: THE LEDGER OF WHAT THIS BUILD SAID (2026-09-16). Every row written
// above, before anything is carried back, in the same encoding the comparison
// below reads rows in. It is what lets the next build tell a readings change
// from a runtime write: a stored row equal to a ledger row is a fact the
// readings asserted, and the readings may now say otherwise (a different value,
// or nothing) without that being a loss; a stored row the ledger lacks was
// written at runtime and is what durability protects. Without it the gate
// refused support's rebuild on 899 declaration orders the carriers renumbered,
// six ciphertexts (AES-GCM never answers the same twice) and six numbers the
// store held as text atoms -- none a fact anyone wrote at runtime -- and, the
// other way round, carried back rows the readings had REMOVED as if they were
// runtime facts (the memory store kept 20 rows of a retired carrier). The
// ledger is the plain rows, not a hash: a hash that collided would misfile a
// runtime edit as the build's, and nothing would ever say so.
db.run("create table _asserted (ft text, row text, primary key (ft, row)) without rowid");
const ains = db.prepare("insert or ignore into _asserted values(?,?)");
db.transaction(() => {
  for (const gi of usedGis) {
    const grp = G[gi];
    for (const ft of funcByTable.get(gi)) {
      for (const r of db.prepare('select k, "' + ft + '" from "' + grp.table + '"').all()) {
        const vals = Object.values(r);
        if (vals[1] === null || vals[1] === undefined) continue;
        ains.run(ft, JSON.stringify(vals));
      }
    }
  }
  for (const ft of rel) for (const r of db.prepare("select * from " + relTbl[ft]).all()) ains.run(ft, JSON.stringify(Object.values(r)));
})();
db.run("pragma wal_checkpoint(TRUNCATE)");
db.close();

// WHAT WOULD BE LOST. Every row the old database held is looked for in the new
// one. A row that is gone is a fact this build cannot account for: either it was
// written at runtime and the carriers do not produce it, or its fact type
// changed shape and no Migration says how to carry it. Either way it is a
// MIGRATION that has not been written -- Samuel: "Migrations are fact types to
// assert or change, and optionally function definitions for adapting old facts
// to new types" -- so the build refuses instead of dropping it.
// AREST_MIGRATE=allow-loss is the deliberate override, for the case where the
// runtime facts really are expendable.
// THE LEDGER DECIDES WHOSE ROW IT IS. A stored row absent from the new build
// that the previous build asserted (it is in _asserted) is that build's own
// reading of the readings, and the readings have moved: it is SUPERSEDED, by
// the new value or by nothing, and that is the readings change durability was
// meant to allow, not the loss it was meant to stop. A stored row the ledger
// does not hold was written at runtime, and for it the older rule stands:
// A ROW THAT IS STILL SAYABLE IS NOT A MIGRATION. Where the fact type is still
// materialized with the SAME kind and arity and the build does not assert its
// key, the carriers simply do not produce it -- there is nothing to migrate and
// the row is carried back. Where the fact type is gone, or its shape moved, or
// the build asserts a DIFFERENT value for its functional key, the row cannot be
// re-asserted and what to do with it is a Migration somebody has to write.
// The functional clash refuses on purpose: `Each X has at most one Y` makes
// <k, y> one fact, so a runtime y and the readings' y for one k are two facts
// that cannot both stand, and choosing between them silently is the automatic
// schema evolution Sam ruled out. (A runtime edit is settled by writing it into
// the readings: the build then asserts the stored value and nothing is gone.)
const lost = [];
const carry = [];
let superseded = 0;
let nowMeta = new Map();
let wasMeta = new Map();
// the declared arity of a fact type, from the same reader main:api checks a
// POST body with -- so "still declared" is read off the model, never guessed
const declPlayers = (ft) => { try { const p = Ev("main:cr_players", [CELLS, ft]); return Array.isArray(p) && p.length ? p.map(flat) : null; } catch { return null; } };
if (priorRows.size) {
  wasMeta = new Map(priorMeta.map((m) => [m.ft, m]));
  // compare from a COPY -- see the handle note above; store.db must stay
  // replaceable in case the comparison says to restore it
  const checkp = dbp + ".check";
  copyFileSync(dbp, checkp);
  const fresh = new Database(checkp, { readonly: true });
  const ownerOf = new Map();
  for (const tb of fresh.prepare("select name from sqlite_master where type='table'").all()) {
    if (tb.name.startsWith("_")) continue;
    for (const c of fresh.prepare('pragma table_info("' + tb.name + '")').all()) {
      if (!ownerOf.has(c.name)) ownerOf.set(c.name, tb.name);
    }
  }
  nowMeta = new Map(fresh.prepare("select ft, kind, tbl, arity from _meta").all().map((m) => [m.ft, m]));
  for (const [ft, before] of priorRows) {
    if (!before.size) continue;
    const m = nowMeta.get(ft);
    const was = wasMeta.get(ft);
    const after = new Set();
    const afterKeys = new Set();
    let isFunc = false;
    let tbl = null;
    if (m) {
      isFunc = m.kind === "func";
      tbl = isFunc ? ownerOf.get(ft) : m.tbl;
      const cols = isFunc
        ? ['"k"', '"' + ft + '"']
        : Array.from({ length: m.arity }, (_, i) => '"c' + i + '"');
      if (tbl) {
        try {
          for (const r of fresh.prepare("select " + cols.join(",") + ' from "' + tbl + '"').all()) {
            const vals = Object.values(r);
            if (isFunc && (vals[1] === null || vals[1] === undefined)) continue;
            after.add(JSON.stringify(vals));
            if (isFunc) afterKeys.add(vals[0]);
          }
        } catch { /* the new schema does not carry it */ }
      }
    }
    const built = priorLedger.get(ft) || new Set();
    const gone = [];
    for (const r of before) {
      if (after.has(r)) continue;
      if (built.has(r)) superseded++; else gone.push(r);
    }
    if (!gone.length) continue;
    // A FACT TYPE THE READINGS STILL DECLARE IS STILL SAYABLE, WHETHER OR NOT
    // THIS BUILD HAPPENED TO WRITE A ROW OF IT (2026-09-17). "Materialized" was
    // read off the new _meta, which only lists fact types the CARRIERS gave rows
    // to -- so a fact type whose whole population was written at runtime (the
    // usual case for a fresh one: emitToDb gives it a relation table of its own,
    // and the carriers give it nothing) came back as `no longer materialized`
    // and was refused on every rebuild, forever, with no Migration that could
    // ever satisfy it. The Domain Change and Migration facts this file writes
    // below are exactly that shape, so the gate would have refused its own
    // proposals. Still declared, same kind, same arity: carry, and make the
    // table. A fact type the readings no longer declare still refuses, which is
    // the 53 ghosts support's store carried and the reason the rule exists.
    const declAr = (declPlayers(ft) || []).length;
    if (!m && was && was.kind === "rel" && declAr === was.arity) {
      carry.push({ ft, tbl: relTableName(ft), isFunc: false, arity: was.arity, rows: gone, make: true });
      continue;
    }
    if (!m || !was || !tbl || m.kind !== was.kind || m.arity !== was.arity) {
      lost.push({ ft, gone, was, why: m ? "its shape changed" : "no longer materialized" });
      continue;
    }
    const keep = [];
    const clash = [];
    for (const r of gone) {
      if (isFunc && afterKeys.has(JSON.parse(r)[0])) clash.push(r); else keep.push(r);
    }
    if (keep.length) carry.push({ ft, tbl, isFunc, arity: m.arity, rows: keep });
    if (clash.length) lost.push({ ft, gone: clash, was, why: "the build asserts a different value for the same key" });
  }
  fresh.close();
  try { unlinkSync(checkp); } catch {}
}

// ---------------------------------------------------------------------------
// THE MIGRATION (2026-09-17, #108's other half). The refusal above says "Write
// the Migration", and this is what writing one means. Samuel, 2026-09-15:
// "Migrations are part of the implementation of domain evolution. It must
// always be gated by human approval, but either agents or humans may propose
// fact types and mutations to them along with instructions for how to modify
// changed data."
//
// So there are two acts here and only one of them is gated. PROPOSING is
// mechanical and this file does it: when it refuses, it writes an UNAPPROVED
// Domain Change proposing a Migration for what it detected -- the source fact
// type, the target the shape moved to, a Rationale naming the rows and the
// reason, and a Migration Rule Text a human can read and edit -- into the store
// it is restoring, so the proposal survives the refusal and is there to be
// approved. APPLYING is gated, by evolution.md's obligation that for each
// applied Domain Change exactly one User approves it, and the gate is canon's
// migrate:plan: given the refused fact type and the five populations it answers
// the Migration, its target, its rule text, the Domain Change and the one
// approver, or nothing. Two approvers is not two votes; it is no throat, and it
// answers nothing.
//
// THE RULE TEXT IS A DERIVATION BODY AND NOTHING NEW EVALUATES IT. `Memory
// holds Title iff that Memory has Title.` reads through canon's migrate:recipe
// into a recipe of derive:forms, and derive:eval runs it over the prior rows --
// the same machinery that closes a store under its derivation rules. What the
// recipe answers is written into the target's table, one Migration Application
// is recorded per source fact (the Migration, a Timestamp, the source Fact and
// the Fact it produced), and the Domain Change is marked applied.
const MIGFTS = ["MigrationHasFactTypeAsSource", "MigrationProducesFactTypeAsTarget",
  "MigrationHasMigrationRuleText", "DomainChangeProposesFunction", "UserApprovesDomainChange"];
// the prior store's rows as canon reads rows: the columns hold JSON, so a row
// is parsed twice -- once as the row, once per value
const priorPop = (ft) => [...(priorRows.get(ft) || [])].map((r) => JSON.parse(r).map((v) => JSON.parse(v)));
const decode = (rs) => rs.map((r) => JSON.parse(r).map((v) => JSON.parse(v)));
// a fact type name is a reading tiled; split it back on the capitals and the
// reading is legible again -- MemoryHoldsTitle is `Memory Holds Title`, which
// is what read:tokens_of tiles and migrate:tile compares against the name
const unTile = (ft) => ft.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

// insert rows into a fact type's table, making the table when the build gave it
// none: the same rule host.js emitToDb follows for a runtime write
function writerFor(db) {
  const meta = new Map(db.prepare("select ft, kind, tbl, arity from _meta").all().map((m) => [m.ft, m]));
  const ownerOf = new Map();
  for (const t of db.prepare("select name from sqlite_master where type='table'").all()) {
    if (t.name.startsWith("_")) continue;
    for (const c of db.prepare('pragma table_info("' + t.name + '")').all()) if (!ownerOf.has(c.name)) ownerOf.set(c.name, t.name);
  }
  const make = (ft, ar) => {
    if (meta.has(ft)) return meta.get(ft).tbl;
    const tbl = relTableName(ft);
    const cols = Array.from({ length: ar }, (_, i) => '"c' + i + '"');
    db.run("create table if not exists " + tbl + " (" + cols.map((c) => c + " text").join(",") + ", primary key (" + cols.join(",") + "))");
    db.prepare("insert into _meta values(?,?,?,?)").run(ft, "rel", tbl, ar);
    meta.set(ft, { ft, kind: "rel", tbl, arity: ar });
    return tbl;
  };
  return {
    has: (ft) => meta.has(ft),
    make,
    rows: (ft) => {
      const m = meta.get(ft); if (!m) return [];
      if (m.kind === "func") {
        const T = ownerOf.get(ft); if (!T) return [];
        return db.prepare('select k, "' + ft + '" v from "' + T + '" where "' + ft + '" is not null').all().map((r) => [JSON.parse(r.k), JSON.parse(r.v)]);
      }
      return db.prepare("select * from " + m.tbl).all().map((r) => Object.values(r).map((v) => JSON.parse(v)));
    },
    put: (ft, rows) => {
      if (!rows.length) return 0;
      const m = meta.get(ft);
      if (m && m.kind === "func") {
        const T = ownerOf.get(ft); if (!T) return 0;
        const upd = db.prepare('update "' + T + '" set "' + ft + '"=? where k=?');
        const ins = db.prepare('insert into "' + T + '" (k, "' + ft + '") values(?,?)');
        for (const r of rows) { const k = JSON.stringify(r[0]), v = JSON.stringify(r[1]); if (!upd.run(v, k).changes) ins.run(k, v); }
        return rows.length;
      }
      const ar = m ? m.arity : rows[0].length;
      const tbl = m ? m.tbl : make(ft, ar);
      const ins = db.prepare("insert or ignore into " + tbl + " values(" + Array.from({ length: ar }, () => "?").join(",") + ")");
      for (const r of rows) ins.run(...Array.from({ length: ar }, (_, i) => JSON.stringify(r[i])));
      return rows.length;
    },
  };
}

// WHAT THE GATE ANSWERS, per refused fact type. Nothing is written yet: a build
// that still loses something restores the snapshot, and a migration applied
// into a store that is about to be thrown away would be a lie in the summary.
const migCtx = MIGFTS.map(priorPop);
const applied = [];
const declined = [];
for (const l of lost) {
  const plan = Ev("migrate:plan", [l.ft, migCtx]);
  if (!Array.isArray(plan) || plan.length !== 5) { declined.push({ ft: l.ft, why: "no approved Domain Change proposes a Migration from it" }); continue; }
  const [mig, target, ruleText, dc, user] = plan.map((v) => (Array.isArray(v) ? flat(v) : v));
  const players = declPlayers(target);
  if (!players) { declined.push({ ft: l.ft, why: "the Migration's target " + target + " is not a fact type this build declares" }); continue; }
  const recipe = Ev("migrate:recipe", [ruleText, l.ft, target, players]);
  if (!Array.isArray(recipe) || !recipe.length) { declined.push({ ft: l.ft, why: "the Migration Rule Text of " + mig + " does not read as a recipe over " + l.ft }); continue; }
  const src = decode(l.gone);
  let produced;
  try { produced = Ev("derive:eval", [recipe, [[l.ft, src]]]); } catch (e) { declined.push({ ft: l.ft, why: "the Migration Rule Text of " + mig + " did not evaluate (" + e.message + ")" }); continue; }
  if (!Array.isArray(produced) || produced.length !== src.length) {
    declined.push({ ft: l.ft, why: "the Migration produced " + (Array.isArray(produced) ? produced.length : 0) + " row(s) from " + src.length + ", so a fact would be dropped anyway" });
    continue;
  }
  applied.push({ ft: l.ft, mig, target, dc, user, src, produced, recipe });
}

const stillLost = lost.filter((l) => !applied.some((a) => a.ft === l.ft));
if (stillLost.length && process.env.AREST_MIGRATE !== "allow-loss") {
  const rows = stillLost.reduce((a, l) => a + l.gone.length, 0);
  console.error("REFUSING: this build would drop " + rows + " row(s) across " +
    stillLost.length + " fact type(s), and no Migration says how to carry them.");
  for (const l of stillLost.slice(0, 12)) {
    console.error("  " + l.ft + " (" + l.why + ") -- " + l.gone.length +
      " row(s), e.g. " + l.gone[0].slice(0, 120));
    const d = declined.find((x) => x.ft === l.ft);
    if (d) console.error("    " + d.why);
  }
  if (stillLost.length > 12) console.error("  ... and " + (stillLost.length - 12) + " more fact type(s)");
  copyFileSync(snapp, dbp);
  try { unlinkSync(dbp + "-wal"); } catch {}
  try { unlinkSync(snapp); } catch {}
  // AND THE PROPOSAL GOES INTO THE STORE IT RESTORED. An agent may propose;
  // only applying is gated, so what this writes is a Domain Change with no
  // approval on it. A human approves it through the store -- `User approves
  // Domain Change` is a fact a create can assert -- and reruns the build.
  const back = new Database(dbp);
  const w = writerFor(back);
  const wrote = [];
  const unproposed = [];
  back.transaction(() => {
    for (const l of stillLost) {
      if (applied.some((a) => a.ft === l.ft)) continue;
      // the target is where the shape MOVED: a fact type this build materializes
      // that the prior store did not, of the same kind and arity. One candidate
      // is a proposal; none or several is a question only a human can answer,
      // and guessing at it is the automatic schema evolution Sam ruled out.
      const cands = l.was ? [...nowMeta.values()].filter((m) => !wasMeta.has(m.ft) && m.kind === l.was.kind && m.arity === l.was.arity) : [];
      if (cands.length !== 1) { unproposed.push(l.ft + ": " + (cands.length ? cands.length + " candidate target fact types (" + cands.slice(0, 4).map((m) => m.ft).join(", ") + ")" : "no candidate target fact type")); continue; }
      const target = cands[0].ft;
      const mig = "migration-" + l.ft + "-to-" + target;
      const dc = "domain-change-" + l.ft + "-to-" + target;
      if (w.rows("DomainChangeProposesFunction").some((r) => String(r[0]) === dc && String(r[1]) === mig)) continue;   // already proposed
      const text = unTile(target) + " iff that " + unTile(l.ft) + ".";
      const rationale = "compile-store refused " + l.gone.length + " runtime row(s) of " + l.ft + " (" + l.why +
        ") on " + new Date().toISOString().slice(0, 10) + "; " + target + " is the one fact type this build materializes that the prior store did not, " +
        "with the same kind and arity. Example row: " + JSON.stringify(decode([l.gone[0]])[0]).slice(0, 160) + ". Read the Migration Rule Text before approving.";
      w.put("MigrationHasFactTypeAsSource", [[mig, l.ft]]);
      w.put("MigrationProducesFactTypeAsTarget", [[mig, target]]);
      w.put("MigrationHasMigrationRuleText", [[mig, text]]);
      w.put("MigrationHasTimestamp", [[mig, new Date().toISOString()]]);
      w.put("DomainChangeProposesFunction", [[dc, mig]]);
      w.put("DomainChangeHasRationale", [[dc, rationale]]);
      const dom = (popof["FunctionBelongsToDomain"] || []).map((r) => (Array.isArray(r) ? r.map(flat) : [flat(r)])).find((r) => r[0] === target);
      if (dom) w.put("DomainChangeTargetsDomain", [[dc, dom[1]]]);
      // AND THE APPROVAL'S TABLE IS MADE HERE, EMPTY, so that approving is one
      // statement. It cannot be a `create` against this store today: the store
      // this restored was built from the PREVIOUS carriers and loadStoreDb
      // refuses a database whose composition is not the module's -- correctly,
      // since the module beside it is now the one built from the CHANGED
      // readings. The row is the same row a create would write.
      wrote.push({ ft: l.ft, target, mig, dc, text, domain: dom ? dom[1] : null, tbl: w.make("UserApprovesDomainChange", 2) });
    }
  })();
  back.run("pragma wal_checkpoint(TRUNCATE)");
  back.close();
  for (const p of wrote) {
    console.error("PROPOSED (unapproved) " + p.dc + ": " + p.mig + " from " + p.ft + " to " + p.target);
    console.error("    Migration Rule Text: " + p.text);
    if (!p.domain) console.error("    no Domain Change targets Domain row: the store does not say which Domain " + p.target + " belongs to");
    console.error("    approve it (exactly one User: a committee is not a throat), then rebuild:");
    console.error('      sqlite3 "' + dbp + "\" \"insert into " + p.tbl + " values('\\\"<your user id>\\\"','\\\"" + p.dc + "\\\"')\"");
  }
  for (const u of unproposed) console.error("NOT PROPOSED -- " + u);
  if (wrote.length) console.error("Read the Rationale and the Migration Rule Text before approving: `User approves Domain Change` is the fact that lets this build carry those rows, and nothing else does.");
  console.error("store.db RESTORED to what it was. Write the Migration, or rebuild with AREST_MIGRATE=allow-loss.");
  process.exit(1);
}

// THE APPROVED MIGRATIONS, RUN. Only reached when nothing is owed, so the store
// this writes into is the one that stays.
let migRows = 0;
if (applied.length) {
  const mdb = new Database(dbp);
  const w = writerFor(mdb);
  const t0 = Date.now();
  let n = 0;
  mdb.transaction(() => {
    for (const a of applied) {
      w.put(a.target, a.produced.map((r) => (Array.isArray(r) ? r.map(flat) : [flat(r)])));
      migRows += a.produced.length;
      // one Migration Application per source fact (core.md #349), each with its
      // own Timestamp -- the deontic `for each Timestamp, at most one Migration
      // Application has that Timestamp` is why they are spaced by one ms rather
      // than all stamped with the run's clock. A Fact is identified by the fact
      // type it is of and the row it is, which is the only identity a stored row
      // has and is stable across replays, as the ordering obligation needs.
      for (let i = 0; i < a.src.length; i++) {
        const ma = "migration-application-" + a.mig + "-" + (i + 1);
        const from = a.ft + "#" + JSON.stringify(a.src[i]);
        const to = a.target + "#" + JSON.stringify(Array.isArray(a.produced[i]) ? a.produced[i].map(flat) : [flat(a.produced[i])]);
        w.put("MigrationApplicationHasMigration", [[ma, a.mig]]);
        w.put("MigrationApplicationHasTimestamp", [[ma, new Date(t0 + n++).toISOString()]]);
        w.put("MigrationApplicationHasFactAsSource", [[ma, from]]);
        w.put("MigrationApplicationProducesFact", [[ma, to]]);
      }
      w.put("DomainChangeIsApplied", [[a.dc]]);
    }
  })();
  mdb.run("pragma wal_checkpoint(TRUNCATE)");
  mdb.close();
  for (const a of applied) {
    console.error("MIGRATED " + a.src.length + " row(s) from " + a.ft + " to " + a.target +
      " by " + a.mig + " (" + JSON.stringify(a.recipe) + "), approved by " + a.user +
      " on " + a.dc + ", now applied.");
  }
}

// NOTHING IS OWED, SO CARRY THE SURVIVORS BACK. Only reached when the build
// loses nothing it cannot account for -- a refusal restores the snapshot above
// and never gets here.
let carried2 = 0;
if (carry.length) {
  const back = new Database(dbp);
  back.transaction(() => {
    for (const c of carry) {
      // a fact type the readings declare and this build gave no row: its table
      // is made here, and _meta gets the row, or loadStoreDb would never read it
      if (c.make) {
        const cols = Array.from({ length: c.arity }, (_, i) => '"c' + i + '"');
        back.run("create table if not exists " + c.tbl + " (" + cols.map((x) => x + " text").join(",") + ", primary key (" + cols.join(",") + "))");
        back.prepare("insert into _meta values(?,?,?,?)").run(c.ft, "rel", c.tbl, c.arity);
      }
      if (c.isFunc) {
        const upd = back.prepare('update "' + c.tbl + '" set "' + c.ft + '"=? where k=?');
        const ins = back.prepare('insert into "' + c.tbl + '" (k, "' + c.ft + '") values(?,?)');
        for (const r of c.rows) {
          const [k, v] = JSON.parse(r);
          if (!upd.run(v, k).changes) ins.run(k, v);
          carried2++;
        }
      } else {
        const ins = back.prepare('insert or ignore into "' + c.tbl + '" values(?' + ",?".repeat(c.arity - 1) + ")");
        for (const r of c.rows) { ins.run(...JSON.parse(r)); carried2++; }
      }
    }
  })();
  back.run("pragma wal_checkpoint(TRUNCATE)");
  back.close();
  console.error("CARRIED " + carried2 + " runtime row(s) across " + carry.length +
    " fact type(s) the carriers do not produce: " +
    carry.slice(0, 8).map((c) => c.ft + " x" + c.rows.length).join(", ") +
    (carry.length > 8 ? ", ... and " + (carry.length - 8) + " more" : ""));
}
try { unlinkSync(snapp); } catch {}

const fcount = Object.keys(funcCol).length;
const carried = [...priorRows.values()].reduce((a, s) => a + s.size, 0);
console.error("store.db: " + (statSync(dbp).size / 1024).toFixed(0) + " KB (" + usedGis.length + " entity tables, " + fcount + " functional columns, " + rel.length + " relation tables) at " + dbp +
  (priorRows.size ? " [" + carried + " prior row(s) accounted for" +
    (superseded ? ", " + superseded + " superseded by the readings" : "") +
    (carried2 ? ", " + carried2 + " carried" : "") +
    (migRows ? ", " + migRows + " migrated by " + applied.length + " approved Migration(s)" : "") +
    (stillLost.length ? ", " + stillLost.reduce((a, l) => a + l.gone.length, 0) + " DROPPED by AREST_MIGRATE=allow-loss" : "") + "]" : ""));
