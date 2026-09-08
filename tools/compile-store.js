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
// FOLLOW-ONS (not yet done): the functional-column classification below
// verifies each column against its population (correct, but O(cols x rows));
// the clean version reads that mapping straight from the RMAP (rmap:groups'
// members). And this is base-tested -- support/eu-law need their own run.
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

// the RMAP entity table (functional absorption) and which wide-row column
// holds each functional fact type
const g = Ev("rmap:groups", fts)[0];
const wrows = g[4], ncol = wrows[0].length - 1;
const projCol = (c) => wrows.filter((r) => Array.isArray(r[c + 1]) && r[c + 1].length).map((r) => [flat(r[0]), flat(r[c + 1])]);
const func = {}, rel = [];
for (const ft of ftnames) {
  const pop = popof[ft]; if (!pop.length) continue;
  if (Array.isArray(pop[0]) && pop[0].length === 2) {
    const want = new Set(pop.map((r) => JSON.stringify([flat(r[0]), flat(r[1])])));
    let col = -1;
    for (let c = 0; c < ncol; c++) { const s = new Set(projCol(c).map((x) => JSON.stringify(x))); if (s.size === want.size && [...want].every((x) => s.has(x))) { col = c; break; } }
    if (col >= 0) { func[ft] = col; continue; }
  }
  rel.push(ft);
}

const dbp = join(modDir, "store.db");
try { unlinkSync(dbp); } catch {}
try { unlinkSync(dbp + "-wal"); } catch {}
const db = new Database(dbp);
const fcols = Object.keys(func);
db.run('create table "Function" (k text' + fcols.map((ft) => ', "' + ft + '" text').join("") + ")");
{
  const ins = db.prepare('insert into "Function" values(?' + ",?".repeat(fcols.length) + ")");
  db.transaction(() => { for (const r of wrows) { const row = [JSON.stringify(flat(r[0]))]; for (const ft of fcols) { const s = r[func[ft] + 1]; row.push(Array.isArray(s) && s.length ? JSON.stringify(flat(s)) : null); } ins.run(...row); } })();
}
db.run("create table _meta (ft text, kind text, tbl text, arity int)");
const mins = db.prepare("insert into _meta values(?,?,?,?)");
for (const ft of fcols) mins.run(ft, "func", ft, 2);
for (const ft of rel) {
  const pop = popof[ft], ar = Array.isArray(pop[0]) ? pop[0].length : 1;
  const tbl = "r" + Math.abs([...ft].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  db.run("create table " + tbl + " (" + Array.from({ length: ar }, (_, i) => '"c' + i + '" text').join(",") + ")");
  const ins = db.prepare("insert into " + tbl + " values(" + Array.from({ length: ar }, () => "?").join(",") + ")");
  db.transaction(() => { for (const row of pop) { const t = Array.isArray(row) ? row : [row]; ins.run(...t.map((v) => JSON.stringify(v))); } })();
  mins.run(ft, "rel", tbl, ar);
}
db.run("pragma wal_checkpoint(TRUNCATE)");
db.close();
console.error("store.db: " + (statSync(dbp).size / 1024).toFixed(0) + " KB (" + fcols.length + " functional columns, " + rel.length + " relation tables) at " + dbp);
