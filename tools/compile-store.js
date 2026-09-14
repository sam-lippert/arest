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
import { unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const modDir = process.env.AREST_OUT_DIR || join(import.meta.dir, "js-runner");
delete process.env.AREST_STORE_DB;               // boot from the carriers, not a db
await import(pathToFileURL(join(modDir, "cases.g.js")).href);
const { Ev, CELLS } = globalThis.AREST;
if (!Ev) { console.error("no composition at " + modDir + "/cases.g.js"); process.exit(1); }

const flat = (v) => { let x = v; while (Array.isArray(x)) x = x.length ? x[0] : null; return x; };
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

const dbp = join(modDir, "store.db");
try { unlinkSync(dbp); } catch {}
try { unlinkSync(dbp + "-wal"); } catch {}
const db = new Database(dbp);

// entity tables, in group order, only those that absorbed a column. For the
// base this is exactly one table named "Function" with the same 33 columns.
const usedGis = G.map((g) => g.gi).filter((gi) => funcByTable.has(gi));
for (const gi of usedGis) {
  const grp = G[gi];
  const fcols = funcByTable.get(gi);
  db.run('create table "' + grp.table + '" (k text' + fcols.map((ft) => ', "' + ft + '" text').join("") + ")");
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
for (const ft of rel) {
  const pop = popof[ft], ar = Array.isArray(pop[0]) ? pop[0].length : 1;
  const tbl = "r" + Math.abs([...ft].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  db.run("create table " + tbl + " (" + Array.from({ length: ar }, (_, i) => '"c' + i + '" text').join(",") + ")");
  const ins = db.prepare("insert into " + tbl + " values(" + Array.from({ length: ar }, () => "?").join(",") + ")");
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
db.run("pragma wal_checkpoint(TRUNCATE)");
db.close();
const fcount = Object.keys(funcCol).length;
console.error("store.db: " + (statSync(dbp).size / 1024).toFixed(0) + " KB (" + usedGis.length + " entity tables, " + fcount + " functional columns, " + rel.length + " relation tables) at " + dbp);
