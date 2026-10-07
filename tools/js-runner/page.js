// THE PAGE HOST (2026-10-07, task #200; Sam: an artifact is a custom native view bound to AREST data, powered
// by its own fact base; the fact base "will just be sqlite, so mcp should be able to access it, but self-hosted
// js arest in page is OK"). An artifact page is one more host. build.js splices this file after host.js only
// in a page composition, and boot("page") calls run_page. The module runs in two places:
//
//   in bun, it writes the page: `AREST_STORE_DB=<store.db> AREST_PAGE_OUT=<file> [AREST_CALLER=<login>]
//   bun page.g.js <address>...`
//   answers main's `artifact <address>` over the store, the page lambda writes, and puts before its end the
//   store's bytes and this module's own text, each gzipped, with the loader below;
//
//   in the page, the loader opens those bytes as an in-memory SQLite database (sql.js, SQLite compiled to
//   wasm), evaluates the module, and the module boots from that database as serve and mcp boot from a file
//   (AREST_STORE_DB, loadStoreDb), so the page's fact base is the store's own tables.
//
// What this file registers is a binding and nothing more. The engine: `bun:sqlite` answers a Database over the
// one in-page sql.js database, the calls host.js makes of bun's (query and prepare with all, get, values and
// run; exec, run, transaction, close). And the page's navigate: a followed link goes to lambda's
// artifact:follow; a store its answer carries is adopted and stored by answerWrite, as a served write is; and
// the page is written again from main's `artifact` at the address it answers. No decision about an address,
// a write or a view is made here.

function pageEngine(SQL, bytes) {
  const raw = new SQL.Database(bytes);
  const cache = new Map();
  const bindable = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "bigint" ? Number(v) : v);
  const rows = (st, params, arrays) => {
    st.bind(params.map(bindable));
    const out = [];
    try { while (st.step()) out.push(arrays ? st.get() : st.getAsObject()); } finally { st.reset(); }
    return out;
  };
  const statement = (sql) => {
    let st = cache.get(sql);
    if (!st) { st = raw.prepare(sql); cache.set(sql, st); }
    return {
      all: (...p) => rows(st, p, false),
      get: (...p) => rows(st, p, false)[0] || null,
      values: (...p) => rows(st, p, true),
      run: (...p) => { rows(st, p, true); return { changes: raw.getRowsModified() }; },
      finalize: () => {},
    };
  };
  const db = {
    raw,
    query: statement,
    prepare: statement,
    exec: (sql) => { raw.exec(String(sql)); },
    run: (sql, ...p) => { raw.run(String(sql), p.map(bindable)); return { changes: raw.getRowsModified() }; },
    transaction: (fn) => (...a) => {
      raw.exec("begin");
      try { const r = fn(...a); raw.exec("commit"); return r; }
      catch (e) { try { raw.exec("rollback"); } catch { } throw e; }
    },
    // sql.js frees every prepared statement when it exports, so the cache goes with them
    serialize: () => { const b = raw.export(); cache.clear(); return b; },
    close: () => {},
  };
  return db;
}

// the loader the page runs first: the store and the module out of their gzipped base64, sql.js from the CDN,
// then the module evaluated in the page's global scope
const PAGE_SQLJS = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
const PAGE_LOADER = `(async function () {
  var el = function (id) { return document.getElementById(id); };
  var bytes = function (id) { var s = atob(el(id).textContent.trim()); var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  var gunzip = async function (id) { return new Uint8Array(await new Response(new Blob([bytes(id)]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()); };
  try {
    document.body.setAttribute("data-arest", "loading");
    var SQL = await initSqlJs({ locateFile: function (f) { return "${PAGE_SQLJS}" + f; } });
    var store = await gunzip("arest-store");
    var text = new TextDecoder().decode(await gunzip("arest-module"));
    var at = JSON.parse(el("arest-address").textContent);
    globalThis.AREST_PAGE = { SQL: SQL, store: store, address: at.address, caller: at.caller };
    globalThis.process = { env: { AREST_STORE_DB: "page" }, argv: [] };
    (0, eval)(text);
  } catch (e) {
    document.body.setAttribute("data-arest", "failed");
    document.body.setAttribute("data-arest-error", String((e && e.message) || e));
    throw e;
  }
})();`;

function run_page() {
  if (typeof window === "undefined") return page_write();
  const P = globalThis.AREST_PAGE;
  let here = P.address;
  const render = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    document.title = doc.title;
    document.body.innerHTML = doc.body.innerHTML;
    document.body.setAttribute("data-address", here.join(" "));
    document.body.setAttribute("data-arest", "ready");
  };
  window.arest = {
    // a followed link: lambda says what it writes and where the page goes; a store its answer carries is adopted
    // and stored in the page's database; the page is then written at that address over the cells
    navigate(addr) {
      document.body.setAttribute("data-arest", "working");
      const out = Ev("artifact:follow", [CELLS, here, addr.map(String), String(P.caller || "")]);
      let answered = null;
      if (Array.isArray(out[0]) && out[0].length > 1) answered = answerWrite(out[0], "artifact " + addr.join("/"), clockStart());
      here = seq(out[1]).map(String);
      window.arest.last = answered && { body: answered[0], status: answered[1] };
      render(String(Ev("main", [CELLS, ["artifact", ...here]])[0]));
      if (answered) document.body.setAttribute("data-arest-status", String(answered[1]));
      return window.arest.last;
    },
    // the fact base, as its bytes (an SQLite file) and as a statement over it
    export: () => storeDb().serialize(),
    query: (sql, ...p) => storeDb().query(sql).all(...p),
    address: () => here.slice(),
  };
  document.body.setAttribute("data-address", here.join(" "));
  document.body.setAttribute("data-arest", "ready");
}

function page_write() {
  const fs = require("node:fs"), zlib = require("node:zlib");
  const address = process.argv.slice(2);
  const out = Ev("main", [CELLS, ["artifact", ...address]]);
  const html = String(out[0]);
  const { Database } = require("bun:sqlite");
  const store = new Database(process.env.AREST_STORE_DB, { readonly: true }).serialize();
  const gz = (b) => zlib.gzipSync(b, { level: 9 }).toString("base64");
  // the address the page was published at, and the login it was published for (AREST_CALLER), the caller its
  // writes are made as, as a platform passes its signed-in user
  const json = JSON.stringify({ address, caller: process.env.AREST_CALLER || "" }).replace(/</g, "\\u003c");
  const runtime = "<script id='arest-address' type='application/json'>" + json + "</script>"
    + "<script id='arest-store' type='application/octet-stream'>" + gz(store) + "</script>"
    + "<script id='arest-module' type='application/octet-stream'>" + gz(fs.readFileSync(process.argv[1])) + "</script>"
    + "<script src='" + PAGE_SQLJS + "sql-wasm.js'></script>"
    + "<script>" + PAGE_LOADER + "</script>";
  const end = "</body></html>";
  if (!html.endsWith(end)) { console.error("page: lambda's page does not end " + end + "; nothing written"); process.exit(1); }
  const page = html.slice(0, -end.length) + runtime + end;
  const file = process.env.AREST_PAGE_OUT || "page.html";
  fs.writeFileSync(file, page);
  console.error("page: " + file + " " + page.length + " bytes (store " + store.length + ", module " + fs.statSync(process.argv[1]).size + ")");
  process.exit(0);
}

if (typeof window !== "undefined") {
  // one database for every open: the page's fact base is one SQLite database, read and written in place
  let one = null;
  const Database = function Database() { return one || (one = pageEngine(globalThis.AREST_PAGE.SQL, globalThis.AREST_PAGE.store)); };
  globalThis.require = (name) => {
    if (name === "bun:sqlite") return { Database };
    throw new Error("the page host provides no " + name);
  };
  const p = globalThis.process;
  p.memoryUsage = () => ({ rss: 0, heapUsed: 0, heapTotal: 0, external: 0 });
  p.exit = () => {};
  p.on = () => {};
}
