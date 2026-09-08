// rust-host — the fourth thin mu, mirroring tools/js-runner/head.part.js
// point for point (as tools/java-runner/Arest.java and tools/cs-runner/Mu.cs
// already do). No law semantics live here: the laws are canon DEFs, and if a
// guard or a mode name ever appears in this file, delete it — accretion is how
// the first two js runners died.
//
// WHY THIS EXISTS. engine/rust is 19,664 lines and had drifted from its own
// documented behavior: README.md's known-good table records "1,000 fetches on
// D: 337 us (0.34 us per fetch, since Map is O(1))", while its NEval resolved
// every named application with `self.cells.iter().find(..)` — a linear scan.
// That pipeline is measured under 700 ms on 414 KB of readings; the same host
// could not finish a 230 KB metamodel compile in 900 s. A host is ~500
// lines, not ~19,000, and byte-identity against the other three certifies it.
//
// TRANSLITERATED FROM Arest.java, NOT from engine/rust. The two mus are
// different machines: engine/rust implements true FFP metacomposition
// (<f1..fn>:x = f1:<<f1..fn>,x>, so COMP/CONS resolve as NAMES), while the js
// head — which java and cs mirror — dispatches the seven forms directly and
// throws on anything else. They agree on canon, which only uses the seven, but
// only the js shape is certified byte-identical, so that is the shape copied.
// engine/rust's prims also ride a richer Leaf (F, AppTag) and a resolve_def
// override table a host must not have.
//
// The canon and carriers are include!d AS SOURCE and compiled: each file is
// ONE tuple literal (include! takes a single expression) whose DEF side effects
// populate DEFS and CELLS in registration order. rustc tokenizes the same bytes
// bun executes and javac compiles — no JSON store artifact, no bespoke reader.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

// ============================ the value ======================================
// Atoms are strings or integers; sequences are Rc'd vectors — mirroring the js
// head (string | number | array) and Arest.java (String | Integer | Object[]).
// The printed atoms are the contract, so the value model must agree with them.
#[derive(Clone)]
enum V {
    S(Rc<str>),
    I(i64),
    Q(Rc<Vec<V>>),
}

fn a(s: &str) -> V { V::S(Rc::from(s)) }
fn astr(s: String) -> V { V::S(Rc::from(s.as_str())) }
fn q(v: Vec<V>) -> V { V::Q(Rc::new(v)) }
fn boolv(b: bool) -> V { a(if b { "T" } else { "F" }) }

fn seq(x: &V) -> Rc<Vec<V>> {
    match x {
        V::Q(v) => v.clone(),
        V::S(s) => panic!("expected sequence, got atom: {}", s),
        V::I(i) => panic!("expected sequence, got atom: {}", i),
    }
}

// 0-based and bounds-checked, exactly like the js head's at()
fn at(x: &V, i: usize) -> V {
    let s = seq(x);
    if i >= s.len() { panic!("index {} out of {}", i, s.len()); }
    s[i].clone()
}

fn is_t(x: &V) -> bool { matches!(x, V::S(s) if &**s == "T") }

// deep structural equality; a number and a string are NEVER equal (the js
// head's strict ===, and cs DeepEq's separate int-vs-string cases)
fn deep_eq(x: &V, y: &V) -> bool {
    match (x, y) {
        (V::S(p), V::S(r)) => p == r,
        (V::I(p), V::I(r)) => p == r,
        (V::Q(p), V::Q(r)) => {
            p.len() == r.len() && p.iter().zip(r.iter()).all(|(m, n)| deep_eq(m, n))
        }
        _ => false,
    }
}

// both numbers -> numeric; both strings -> ordinal; anything else THROWS
// Does NOT coerce a numeric-looking string: canon's eq does not coerce
// (eq<1,"1"> = F), and a coercing <= would give le<1,"1"> = le<"1",1> = T with
// eq<1,"1"> = F — antisymmetry violated, so <= would not be an order relation.
// Mixed int/lexical atoms are a READING-BOUNDARY defect (#31).
fn cmp_atoms(x: &V, y: &V) -> std::cmp::Ordering {
    match (x, y) {
        (V::I(p), V::I(r)) => p.cmp(r),
        (V::S(p), V::S(r)) => p.as_bytes().cmp(r.as_bytes()),
        _ => panic!("compare across atom kinds"),
    }
}

// js Array.join semantics: an atom stringifies, a nested sequence joins its own
// elements with "," (Arest.java's String.valueOf would diverge here, but the
// certified corpus never reaches it, so the js rule is the safe one to keep).
fn join_text(x: &V) -> String {
    match x {
        V::S(s) => s.to_string(),
        V::I(i) => i.to_string(),
        V::Q(v) => v.iter().map(join_text).collect::<Vec<_>>().join(","),
    }
}

// THE MEMO KEY — by REFERENCE for sequences, by value for atoms, mirroring
// what a JS Map does natively (`EVMEMO` keys arrays by object identity). This
// is deliberately NOT the structural key below: an operand is routinely the
// whole store, so serializing it per call costs more than the reduction it was
// meant to save. That mistake cost 9m54s for 25 laws before it was measured.
// js reaches the same place via `chain = len<=4 ? [len, ...x] : [-1, x]`, whose
// array entries are identity-keyed.
fn memo_key(x: &V) -> String {
    // js: `chain = (Array.isArray(x) && x.length <= 4) ? [x.length, ...x]
    //               : [-1, x]`, whose entries a Map keys by identity.
    // The SMALL-FRAME CASE IS THE WHOLE POINT. Frames are rebuilt on every
    // call, so keying a frame by its own address never hits; keying it by its
    // ELEMENTS' addresses does, because those are the ctx-threaded references
    // shared across calls. Keying every sequence by its own pointer (the first
    // attempt here) produced a memo that essentially never hit.
    match x {
        V::Q(rc) if rc.len() <= 4 => {
            let mut k = format!("f{}", rc.len());
            for e in rc.iter() { k.push('|'); k.push_str(&atom_or_addr(e)); }
            k
        }
        _ => format!("w|{}", atom_or_addr(x)),
    }
}

fn atom_or_addr(x: &V) -> String {
    match x {
        V::S(s) => format!("s{}:{}", s.len(), s),
        V::I(i) => format!("i{}", i),
        V::Q(rc) => format!("q{:p}", Rc::as_ptr(rc)),
    }
}

// Canonical key standing in for JSON.stringify's use as a Set/Map key in the
// FASTPRIMS (dedup, setminus, entsat, find_desc), where VALUE equality is the
// point. Only the EQUIVALENCE CLASSES matter and both encodings are injective
// over {string, int, sequence}; length-prefixing makes this one unambiguous.
fn key(x: &V) -> String {
    let mut b = String::new();
    key_into(x, &mut b);
    b
}
fn key_into(x: &V, b: &mut String) {
    match x {
        V::S(s) => { b.push('S'); b.push_str(&s.len().to_string()); b.push(':'); b.push_str(s); }
        V::I(i) => { b.push('N'); b.push_str(&i.to_string()); }
        V::Q(v) => {
            b.push('[');
            for (i, e) in v.iter().enumerate() { if i > 0 { b.push(','); } key_into(e, b); }
            b.push(']');
        }
    }
}

// ============================ registration ===================================
// Registration is INTO DEFS (the paper's platform binding). A duplicate DEF
// dies loud; law:one_name is the law that says so.
thread_local! {
    static DEFS: RefCell<HashMap<String, V>> = RefCell::new(HashMap::new());
    static CELLS: RefCell<Vec<V>> = RefCell::new(Vec::new());
    // pure-application memo (see Ev). Evaluation is pure and D is frozen during
    // a step (Backus 14.6), so a named cell applied to the same input is the
    // same value. Keys: atoms by value, sequences by the canonical key.
    // name -> memo_key -> (operand, result). The OPERAND IS RETAINED ON
    // PURPOSE: memo_key identifies a sequence by its Rc address, and an
    // address is only unique while the allocation lives. Holding the operand
    // keeps it alive, so no later sequence can land on the same address and
    // collide. A JS Map gets this free by holding its keys strongly; dropping
    // the operand here produced stale hits that surfaced far downstream as
    // "theta:nth selector out of range".
    static EVMEMO: RefCell<HashMap<String, HashMap<String, (V, V)>>> =
        RefCell::new(HashMap::new());
    static EVMEMON: RefCell<usize> = RefCell::new(0);
    // list-address -> (retained list, index). Same retention discipline as the
    // memo: the key is an Rc address, which is unique only while the
    // allocation lives, so the list is held alongside its index.
    static ENTIDX: RefCell<HashMap<usize, (V, HashMap<String, Vec<V>>)>> =
        RefCell::new(HashMap::new());
    static ENTDESC: RefCell<HashMap<usize, (V, HashMap<String, V>)>> =
        RefCell::new(HashMap::new());
    // The join / lookup indexes. Each mirrors a js host WeakMap (matchRows'
    // MATCHIDX, ast:fetch's FETCHIDX, ...). Same retention discipline as ENTIDX:
    // keyed by the Rc address of a frozen canon list, with that list held
    // alongside so the address cannot be reused. NOT cleared by the memo's size
    // cap (that trims EVMEMO only) -- these are true for as long as the value
    // lives, exactly as the js WeakMaps are, and only a store mutation would
    // invalidate them (the law report performs none).
    // matchRows: rows-address -> (rows, key(col1) -> matching rows).
    static MATCHIDX: RefCell<HashMap<usize, (V, HashMap<String, Vec<V>>)>> =
        RefCell::new(HashMap::new());
    // matchRowsAt: rows-address -> (rows, column -> key(col) -> matching rows).
    static MATCHATIDX: RefCell<HashMap<usize, (V, HashMap<i64, HashMap<String, Vec<V>>>)>> =
        RefCell::new(HashMap::new());
    // ast:fetch: cells-address -> (cells, key(name) -> third field, first wins).
    static FETCHIDX: RefCell<HashMap<usize, (V, HashMap<String, V>)>> =
        RefCell::new(HashMap::new());
    // solve:cell: cells-address -> (cells, key(name) -> index; a "bad" flag when
    // an element before some name could not be selected, so a miss re-raises).
    static SOLVEIDX: RefCell<HashMap<usize, (V, HashMap<String, usize>, bool)>> =
        RefCell::new(HashMap::new());
    // rmap:wide_row: relation-address -> (relation, key(col1) -> member pair).
    static SLOTIDX: RefCell<HashMap<usize, (V, HashMap<String, V>)>> =
        RefCell::new(HashMap::new());
    // law:slot_for: <desc, nested>-address -> (that pair, its member pairs).
    static SLOTFOR: RefCell<HashMap<usize, (V, V)>> =
        RefCell::new(HashMap::new());
    // theta:member / read:memberw over a long list: list-address -> (list, keys).
    static MEMBIDX: RefCell<HashMap<usize, (V, HashSet<String>)>> =
        RefCell::new(HashMap::new());
    // joinPat: list-address -> (list, key(elem selector) -> join-key -> rows).
    static JOINIDX: RefCell<HashMap<usize, (V, HashMap<String, HashMap<String, Vec<V>>>)>> =
        RefCell::new(HashMap::new());
    // rmap:member_pairs by the descriptor's identity (PAIRIDX's x-branch).
    static PAIRIDX_X: RefCell<HashMap<usize, (V, V)>> =
        RefCell::new(HashMap::new());
    // rmap:member_pairs by the rows' identity, then by the four leading fields
    // (PAIRIDX's rows-branch: the positions are a function of those fields).
    static PAIRIDX_ROWS: RefCell<HashMap<usize, (V, HashMap<String, V>)>> =
        RefCell::new(HashMap::new());
}

#[allow(non_snake_case)]
fn DEF(name: &str, body: V) -> V {
    DEFS.with(|d| {
        let mut d = d.borrow_mut();
        if d.contains_key(name) { panic!("duplicate DEF: {}", name); }
        d.insert(name.to_string(), body.clone());
    });
    CELLS.with(|c| c.borrow_mut().push(q(vec![a("CELL"), a(name), body])));
    a(name)
}

// The canon's vocabulary, bound as this platform's lambda. The canon file uses
// exactly these names and no others — that is what makes one file readable by
// four hosts.
// The canon vocabulary -- A, N, K, PHI, S1..S9, Sv -- used to be bound here as
// this platform lambda so that compose.py output could call it. The READER is
// that binding now: it turns the same names into the same values, from the file
// rather than from generated source, so the functions had no callers left. A
// host that defines what no dispatch reaches is the shape the coverage scan
// catches, and it scans this file.

// ============================ the base =======================================
// Backus 11.2.3's primitives, transliterated from Arest.java one for one. Each
// edge is the certified one: `tl` on empty panics, `strip_prefix` needs a
// STRICTLY longer subject, `ntoa` refuses a non-number, the char ops are ASCII
// on every host.
fn prim(name: &str, x: &V) -> Option<V> {
    let r = match name {
        "id" => x.clone(),
        "tl" => { let s = seq(x); q(s[1..].to_vec()) }
        "atom" => boolv(!matches!(x, V::Q(_))),
        "apndl" => { let p = seq(x); let t = seq(&p[1]);
            let mut r = Vec::with_capacity(t.len() + 1);
            r.push(p[0].clone()); r.extend(t.iter().cloned()); q(r) }
        "apndr" => { let p = seq(x); let h = seq(&p[0]);
            let mut r = h.to_vec(); r.push(p[1].clone()); q(r) }
        "distl" => { let p = seq(x); let t = seq(&p[1]);
            q(t.iter().map(|e| q(vec![p[0].clone(), e.clone()])).collect()) }
        "distr" => { let p = seq(x); let h = seq(&p[0]);
            q(h.iter().map(|e| q(vec![e.clone(), p[1].clone()])).collect()) }
        "cat" => { let p = seq(x); let l = seq(&p[0]); let r2 = seq(&p[1]);
            let mut r = l.to_vec(); r.extend(r2.iter().cloned()); q(r) }
        "null" => boolv(matches!(x, V::Q(v) if v.is_empty())),
        "eq" => { let p = seq(x); boolv(deep_eq(&p[0], &p[1])) }
        "not" => boolv(!is_t(x)),
        "and" => { let p = seq(x); boolv(is_t(&p[0]) && is_t(&p[1])) }
        "length" => V::I(seq(x).len() as i64),
        // lt completes the comparison quartet; reverse and trans are Backus
        // 11.2.3 base functions. All three were referenced by canon and
        // registered only by the python host, so the DEFs using them
        // (constraints:vr_lo, system:keep_first, system:ftid, ...) answered
        // bottom on every host.
        "lt" => { let p = seq(x); boolv(cmp_atoms(&p[0], &p[1]) == std::cmp::Ordering::Less) }
        "reverse" => { let l = seq(x); q(l.iter().rev().cloned().collect()) }
        "trans" => { let rows = seq(x);
            if rows.is_empty() { q(vec![]) } else {
                let w = seq(&rows[0]).len();
                q((0..w).map(|c| q(rows.iter().map(|r| seq(r)[c].clone()).collect()))
                    .collect())
            } }
        "le" => { let p = seq(x); boolv(cmp_atoms(&p[0], &p[1]) != std::cmp::Ordering::Greater) }
        "ge" => { let p = seq(x); boolv(cmp_atoms(&p[0], &p[1]) != std::cmp::Ordering::Less) }
        "gt" => { let p = seq(x); boolv(cmp_atoms(&p[0], &p[1]) == std::cmp::Ordering::Greater) }
        "+" => { let p = seq(x); V::I(int_of(&p[0]) + int_of(&p[1])) }
        "-" => { let p = seq(x); V::I(int_of(&p[0]) - int_of(&p[1])) }
        "*" => { let p = seq(x); V::I(int_of(&p[0]) * int_of(&p[1])) }
        "/" => { let p = seq(x); V::I(int_of(&p[0]) / int_of(&p[1])) }
        "apply" => { let p = seq(x); ev(&p[0], &p[1]) }
        // lex yields TOKEN-RECORDS, ten fields per token, as
        // metamodel/resolution.md types it. This host answered a flat word
        // list, so canon's system: family (sqlname field 5 of token 1,
        // rp_step field 8, cf_dropw field 1) read CHARACTERS here and FIELDS
        // in the engine kernels. Fields: tok, nopunct, base, ordinal-suffix,
        // lower, quoted-text, initial-cap, hyphen-template, is-quoted,
        // quote-index.
        "lex" => {
            let text = text_of(x);
            let b = text.as_bytes();
            let mut spans: Vec<(usize, usize)> = Vec::new();
            let mut i = 0usize;
            while i < b.len() {
                if b[i] == b'\'' {
                    let mut j = i + 1;
                    while j < b.len() && b[j] != b'\'' { j += 1; }
                    if j < b.len() { spans.push((i, j + 1)); i = j + 1; continue; }
                }
                i += 1;
            }
            let mut rows: Vec<V> = Vec::new();
            let mut p = 0usize;
            while p < b.len() {
                while p < b.len() && (b[p] as char).is_whitespace() { p += 1; }
                if p >= b.len() { break; }
                let s = p;
                while p < b.len() && !(b[p] as char).is_whitespace() { p += 1; }
                let e = p;
                let tok = text[s..e].to_string();
                let mut k = 0usize;
                for (idx, sp) in spans.iter().enumerate() {
                    if s < sp.1 && sp.0 < e { k = idx + 1; break; }
                }
                let qtext = if k > 0 {
                    let a = std::cmp::max(s, spans[k - 1].0 + 1);
                    let z = std::cmp::min(e, spans[k - 1].1 - 1);
                    if z > a { text[a..z].to_string() } else { String::new() }
                } else { String::new() };
                let nopunct = tok.trim_matches(|c| ".;:,".contains(c)).to_string();
                let bas = nopunct.trim_end_matches(|c: char| c.is_ascii_digit()).to_string();
                // field 8 is the NORMA hyphen template (#24)
                let mut tpl = tok.clone();
                if tpl.len() > 2 && tpl.ends_with("--") { tpl.pop(); }
                else if tpl.len() > 2 && tpl.starts_with("--") { tpl.remove(0); }
                else if tpl.len() > 1 && tpl.ends_with('-') { tpl.pop(); }
                else if tpl.len() > 1 && tpl.starts_with('-') { tpl.remove(0); }
                let up = matches!(bas.chars().next(), Some(c) if ('A'..='Z').contains(&c));
                rows.push(q(vec![
                    astr(tok.clone()), astr(nopunct.clone()), astr(bas.clone()),
                    astr(nopunct[bas.len()..].to_string()), astr(tok.to_lowercase()),
                    astr(qtext), astr((if up { "T" } else { "F" }).to_string()),
                    astr(tpl), astr((if k > 0 { "T" } else { "F" }).to_string()),
                    V::I(k as i64)]));
            }
            q(rows) }
        "implode" => { let p = seq(x); let sep = text_of(&p[0]); let parts = seq(&p[1]);
            astr(parts.iter().map(join_text).collect::<Vec<_>>().join(&sep)) }
        // slug yields an IDENTIFIER (resolution.md). Canon defines the same
        // function as sl:slug; this stays until both carriers regenerate.
        // slug is CANON -- DEF("slug"). Deleted here.
        "chars" => q(text_of(x).chars().map(|c| astr(c.to_string())).collect()),
        // charup is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // chardown is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // charisup / charislow / charisdigit are CANON -- range tests over
        // 1 . chars. Deleted here.
        // 1r was COLLATERAL of that deletion (the brace walk ran on to tlr).
        // It is Backus 11.2.3 base, the right selector, and it stays.
        "1r" => { let s = seq(x); s[s.len() - 1].clone() }
        "tlr" => { let s = seq(x); q(s[..s.len() - 1].to_vec()) }
        // clock is REGISTERED (resolution.md): the journal stamps each
        // submitted event with it. ISO 8601 in UTC, the js host's shape.
        "clock" => astr(clock_text()),
        _ => return None,
    };
    Some(r)
}

// The wall clock as ISO 8601 UTC text. wasm32-unknown-unknown has no clock
// (SystemTime::now panics there), so the module stamps the epoch until the
// boundary imports one from its embedder.
fn clock_text() -> String {
    #[cfg(target_arch = "wasm32")]
    { "1970-01-01T00:00:00.000Z".to_string() }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let d = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
        let secs = d.as_secs() as i64;
        let ms = d.subsec_millis();
        let days = secs.div_euclid(86_400);
        let sod = secs.rem_euclid(86_400);
        // civil_from_days (Hinnant): proleptic Gregorian date of a day count from 1970-01-01.
        let z = days + 719_468;
        let era = z.div_euclid(146_097);
        let doe = z.rem_euclid(146_097);
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let day = doy - (153 * mp + 2) / 5 + 1;
        let month = if mp < 10 { mp + 3 } else { mp - 9 };
        let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
        format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z", year, month, day, sod / 3600, (sod % 3600) / 60, sod % 60, ms)
    }
}

fn int_of(x: &V) -> i64 {
    match x { V::I(i) => *i, _ => panic!("arithmetic on non-number") }
}
fn text_of(x: &V) -> String {
    match x { V::S(s) => s.to_string(), _ => panic!("expected text atom") }
}
// The EMPTY atom is NOT a refusal: js, python and all three engine kernels
// pass it through and answer "F" for the tests. NUL is in none of the ranges,
// so charup/chardown return the atom unchanged and charisup/charislow/
// charisdigit answer F — the same five answers, from one place.
// first_char deleted: charup/chardown are CANON, this had no callers.

// ============================ join / lookup indexes ==========================
// The shared machinery the FASTPRIMS below stand on. Each builds an index over
// a frozen canon list ONCE, keyed by the list's Rc address, then answers O(1).
// The index is built in locals and only then stored under a short borrow, so a
// selector evaluated while building (ev) never re-enters the same cache.

// the rows whose first column equals `key`, in source order -- the value of
// csdp:matches. Throws building the index exactly where the fold's selector 1
// would: at an atom row or an empty row, whatever the key (js matchRows).
fn match_rows(k: &V, rows_v: &V) -> Vec<V> {
    let rows = seq(rows_v);
    let id = Rc::as_ptr(&rows) as usize;
    let built = MATCHIDX.with(|m| m.borrow().contains_key(&id));
    if !built {
        let mut idx: HashMap<String, Vec<V>> = HashMap::new();
        for r in rows.iter() {
            match r {
                V::Q(ra) if !ra.is_empty() => idx.entry(key(&ra[0])).or_default().push(r.clone()),
                V::Q(_) => panic!("selector 1 out of range 0"),
                _ => panic!("selector 1 on atom"),
            }
        }
        MATCHIDX.with(|m| { m.borrow_mut().entry(id).or_insert((rows_v.clone(), idx)); });
    }
    let kk = key(k);
    MATCHIDX.with(|m| m.borrow().get(&id).and_then(|e| e.1.get(&kk)).cloned().unwrap_or_default())
}

// the same, on an arbitrary 1-based column: <n, key, rows> (js matchRowsAt).
fn match_rows_at(n: i64, k: &V, rows_v: &V) -> Vec<V> {
    let rows = seq(rows_v);
    let id = Rc::as_ptr(&rows) as usize;
    let have = MATCHATIDX.with(|m| m.borrow().get(&id).map_or(false, |e| e.1.contains_key(&n)));
    if !have {
        let mut idx: HashMap<String, Vec<V>> = HashMap::new();
        for r in rows.iter() {
            match r {
                V::Q(ra) if n >= 1 && (n as usize) <= ra.len() =>
                    idx.entry(key(&ra[(n - 1) as usize])).or_default().push(r.clone()),
                V::Q(ra) => panic!("selector {} out of range {}", n, ra.len()),
                _ => panic!("selector {} on atom", n),
            }
        }
        MATCHATIDX.with(|m| {
            let mut m = m.borrow_mut();
            let e = m.entry(id).or_insert_with(|| (rows_v.clone(), HashMap::new()));
            e.1.entry(n).or_insert(idx);
        });
    }
    let kk = key(k);
    MATCHATIDX.with(|m| m.borrow().get(&id).and_then(|e| e.1.get(&n)).and_then(|c| c.get(&kk)).cloned().unwrap_or_default())
}

// the atoms of a value, in order: an atom is itself, a sequence is its members'
// atoms flattened (js atomsOf, iterative to bound the stack).
fn atoms_of(x: &V) -> Vec<V> {
    match x {
        V::Q(_) => {
            let mut out: Vec<V> = Vec::new();
            let mut stack: Vec<V> = vec![x.clone()];
            while let Some(v) = stack.pop() {
                if let V::Q(vv) = &v { for e in vv.iter().rev() { stack.push(e.clone()); } }
                else { out.push(v); }
            }
            out
        }
        _ => vec![x.clone()],
    }
}

// membership over a long list, answered by a set kept on the list (js MEMBIDX).
fn membidx_has(list_v: &V, l: &Rc<Vec<V>>, needle: &V) -> V {
    let id = Rc::as_ptr(l) as usize;
    let built = MEMBIDX.with(|m| m.borrow().contains_key(&id));
    if !built {
        let mut s: HashSet<String> = HashSet::new();
        for e in l.iter() { s.insert(key(e)); }
        MEMBIDX.with(|m| { m.borrow_mut().entry(id).or_insert((list_v.clone(), s)); });
    }
    let nk = key(needle);
    boolv(MEMBIDX.with(|m| m.borrow().get(&id).map_or(false, |e| e.1.contains(&nk))))
}

// rmap:nest, one pass: group rows by their first column (keys in theta:dedup's
// last-occurrence order), each group nesting again with that column dropped
// (js rmap:nest). Recursive because the extension is curried level by level.
fn rmap_nest(x: &V) -> V {
    let rows = seq(x);
    if rows.is_empty() { return q(vec![]); }
    if seq(&rows[0]).len() == 1 { return q(rows.iter().map(|r| at(r, 0)).collect()); }
    let mut groups: HashMap<String, (V, Vec<V>)> = HashMap::new();
    for row in rows.iter() {
        let r = seq(row);
        let k = key(&r[0]);
        groups.entry(k).or_insert_with(|| (r[0].clone(), Vec::new())).1.push(row.clone());
    }
    let mut order: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for row in rows.iter().rev() {
        let k = key(&seq(row)[0]);
        if seen.insert(k.clone()) { order.push(k); }
    }
    order.reverse();
    let mut out: Vec<V> = Vec::with_capacity(order.len());
    for k in order.iter() {
        let (keyval, grows) = groups.get(k).unwrap();
        let leaf = seq(&grows[0]).len() == 2;
        let contents = if leaf {
            q(grows.iter().map(|r| at(r, 1)).collect())
        } else {
            let tails: Vec<V> = grows.iter().map(|r| { let rs = seq(r); q(rs[1..].to_vec()) }).collect();
            rmap_nest(&q(tails))
        };
        out.push(q(vec![a("CELL"), keyval.clone(), contents]));
    }
    q(out)
}

// ============================ join / filter form patterns ====================
// The two structural fast paths the mu takes inside COMP and INSERT: a hash
// join for the equal-keys filter over distr/distl, and a linear pass for the
// prepend-every-survivor fold. Both are STRATEGY -- each runs the SAME body on
// the SAME rows in the SAME order the written form would, only skipping rows the
// form itself proves emit nothing (joinPat) or copy nothing (filterFold).

#[derive(Clone)]
struct JoinPattern { elem: V, carrier: V, body: V, distl: bool }
#[derive(Clone)]
struct EqKey { elem: V, carrier: V, form: V }
enum NecKey { NoKey, Never, Key(EqKey) }
#[derive(Clone)]
struct FoldPattern { pred: V, val: Option<V> }

// the frame slot a selector reads: a number is itself, COMP inherits its last
// step's, anything else is not rooted at a slot (js rootSel).
fn root_sel(f: &V) -> i64 {
    match f {
        V::I(n) => *n,
        V::Q(form) if !form.is_empty() && matches!(&form[0], V::S(s) if &**s == "COMP") =>
            root_sel(&form[form.len() - 1]),
        _ => 0,
    }
}
// CONST PHI, the base every emitting filter falls through to (js isPhiForm).
fn is_phi_form(f: &V) -> bool {
    matches!(f, V::Q(form) if form.len() >= 2
        && matches!(&form[0], V::S(s) if &**s == "CONST")
        && matches!(&form[1], V::Q(inner) if inner.is_empty()))
}
// a body that reaches the fold frame only through selector 1 (the element), so
// the accumulator slot is provably unread (js framePure).
fn frame_pure(f: &V) -> bool {
    match f {
        V::I(n) => *n == 1,
        V::Q(form) if !form.is_empty() => match &form[0] {
            V::S(s) => match &**s {
                "CONST" => true,
                "COMP" => frame_pure(&form[form.len() - 1]),
                "CONS" | "COND" => form[1..].iter().all(frame_pure),
                _ => false,
            },
            _ => false,
        },
        _ => false,
    }
}
// COMP(eq, CONS(l, r)) whose two sides root at the element and the carrier
// slot, in either order (js eqKey).
fn eq_key(p: &V, es: i64, cs: i64) -> Option<EqKey> {
    let form = match p { V::Q(f) => f, _ => return None };
    if form.len() != 3 { return None; }
    if !matches!(&form[0], V::S(s) if &**s == "COMP") { return None; }
    if !matches!(&form[1], V::S(s) if &**s == "eq") { return None; }
    let cons = match &form[2] { V::Q(c) => c, _ => return None };
    if cons.len() != 3 || !matches!(&cons[0], V::S(s) if &**s == "CONS") { return None; }
    let (l, r) = (&cons[1], &cons[2]);
    let (rl, rr) = (root_sel(l), root_sel(r));
    if rl == es && rr == cs { return Some(EqKey { elem: l.clone(), carrier: r.clone(), form: p.clone() }); }
    if rl == cs && rr == es { return Some(EqKey { elem: r.clone(), carrier: l.clone(), form: p.clone() }); }
    None
}
// the necessary key of a COND tree: a branch that is PHI emits nothing, a branch
// guarded by an eq requires it, and the tree has a key when every emitting
// branch requires the same one (js necKey).
fn nec_key(body: &V, es: i64, cs: i64) -> NecKey {
    if is_phi_form(body) { return NecKey::Never; }
    let form = match body {
        V::Q(f) if f.len() == 4 && matches!(&f[0], V::S(s) if &**s == "COND") => f,
        _ => return NecKey::NoKey,
    };
    let p = &form[1];
    let mut kp = eq_key(p, es, cs);
    if kp.is_none() {
        if let V::Q(pf) = p {
            if pf.len() == 3 && matches!(&pf[0], V::S(s) if &**s == "COMP")
                && matches!(&pf[1], V::S(s) if &**s == "and") {
                if let V::Q(cons) = &pf[2] {
                    if cons.len() == 3 && matches!(&cons[0], V::S(s) if &**s == "CONS") {
                        kp = eq_key(&cons[1], es, cs).or_else(|| eq_key(&cons[2], es, cs));
                    }
                }
            }
        }
    }
    let kf = nec_key(&form[2], es, cs);
    let kg = nec_key(&form[3], es, cs);
    // the then-branch emits only when p holds: it requires p's key if p has
    // one, else whatever the branch itself requires; the else-branch learns
    // nothing from p being false.
    let req_f = match kf {
        NecKey::Never => NecKey::Never,
        other => match kp { Some(k) => NecKey::Key(k), None => other },
    };
    // kg never -> reqF; reqF never -> kg; both keys and equal -> that key; else none.
    match (req_f, kg) {
        (rf, NecKey::Never) => rf,
        (NecKey::Never, g) => g,
        (NecKey::Key(a), NecKey::Key(b)) =>
            if deep_eq(&a.form, &b.form) { NecKey::Key(a) } else { NecKey::NoKey },
        _ => NecKey::NoKey,
    }
}
// COMP(flatten, ALPHA(body), distr|distl) [, operand] whose body has a
// necessary key: the equal-keys filter answered by an index (js joinPat).
fn join_pat(form: &[V]) -> Option<JoinPattern> {
    if !(form.len() == 4 || form.len() == 5) { return None; }
    if !matches!(&form[1], V::S(s) if &**s == "theta:flatten") { return None; }
    let dl = match &form[3] {
        V::S(s) if &**s == "distl" => true,
        V::S(s) if &**s == "distr" => false,
        _ => return None,
    };
    let alpha = match &form[2] {
        V::Q(a2) if a2.len() >= 2 && matches!(&a2[0], V::S(s) if &**s == "ALPHA") => a2,
        _ => return None,
    };
    let body = &alpha[1];
    let (es, cs) = if dl { (2i64, 1i64) } else { (1i64, 2i64) };
    match nec_key(body, es, cs) {
        NecKey::Key(k) => Some(JoinPattern { elem: k.elem, carrier: k.carrier, body: body.clone(), distl: dl }),
        _ => None,
    }
}
// run the join: distr frames are <element, carrier>, distl frames <carrier,
// element>; index the list on the element key, look up the carrier key, run the
// body on the hits in list order and flatten -- pair for pair the scan's value.
fn join_exec(jp: &JoinPattern, list_v: &V, carrier_v: &V, list: &Rc<Vec<V>>) -> V {
    let frame = |elem: &V| -> V {
        if jp.distl { q(vec![carrier_v.clone(), elem.clone()]) }
        else { q(vec![elem.clone(), carrier_v.clone()]) }
    };
    let id = Rc::as_ptr(list) as usize;
    let elemk = key(&jp.elem);
    let have = JOINIDX.with(|m| m.borrow().get(&id).map_or(false, |e| e.1.contains_key(&elemk)));
    if !have {
        let mut by_key: HashMap<String, Vec<V>> = HashMap::new();
        for e in list.iter() {
            let k = key(&ev(&jp.elem, &frame(e)));
            by_key.entry(k).or_default().push(e.clone());
        }
        JOINIDX.with(|m| {
            let mut m = m.borrow_mut();
            let e = m.entry(id).or_insert_with(|| (list_v.clone(), HashMap::new()));
            e.1.entry(elemk.clone()).or_insert(by_key);
        });
    }
    let want_frame = if jp.distl { q(vec![carrier_v.clone(), q(vec![])]) } else { q(vec![q(vec![]), carrier_v.clone()]) };
    let want = key(&ev(&jp.carrier, &want_frame));
    let hits = JOINIDX.with(|m| m.borrow().get(&id).and_then(|e| e.1.get(&elemk)).and_then(|bk| bk.get(&want)).cloned());
    match hits {
        None => q(vec![]),
        Some(hs) => {
            let mut out: Vec<V> = Vec::new();
            for h in hs.iter() { out.extend(seq(&ev(&jp.body, &frame(h))).iter().cloned()); }
            q(out)
        }
    }
}
// the INSERT filter fold: COND(pred, apndl, 2) or COND(pred, apndl . CONS(v, 2),
// 2), the pred frame-pure, resolving a named body to its DEF (js filterFold).
fn fold_pattern(body: &V, depth: usize) -> Option<FoldPattern> {
    if depth > 8 { return None; }
    match body {
        V::S(name) => {
            if is_fastprim_name(name) { return None; }
            let b = DEFS.with(|d| d.borrow().get(&**name).cloned());
            b.and_then(|bb| fold_pattern(&bb, depth + 1))
        }
        V::Q(f) => {
            if f.len() == 4 && matches!(&f[0], V::S(s) if &**s == "COND")
                && matches!(&f[3], V::I(2)) && frame_pure(&f[1]) {
                let then = &f[2];
                if matches!(then, V::S(s) if &**s == "apndl") {
                    return Some(FoldPattern { pred: f[1].clone(), val: None });
                }
                if let V::Q(tf) = then {
                    if tf.len() == 3 && matches!(&tf[0], V::S(s) if &**s == "COMP")
                        && matches!(&tf[1], V::S(s) if &**s == "apndl") {
                        if let V::Q(cons) = &tf[2] {
                            if cons.len() == 3 && matches!(&cons[0], V::S(s) if &**s == "CONS")
                                && matches!(&cons[2], V::I(2)) && frame_pure(&cons[1]) {
                                return Some(FoldPattern { pred: f[1].clone(), val: Some(cons[1].clone()) });
                            }
                        }
                    }
                }
            }
            None
        }
        _ => None,
    }
}

// the names fastprim answers, so filterFold does not mistake a twin for a fold
// body (js FASTPRIMS.has). Kept beside fastprim; a name added there is added
// here.
fn is_fastprim_name(s: &str) -> bool {
    matches!(s,
        "theta:member" | "theta:filter_eq" | "theta:drop" | "theta:take" | "theta:nth"
        | "theta:last" | "theta:butlast" | "theta:iota" | "theta:zip" | "theta:dedup"
        | "theta:setminus" | "theta:flatten" | "cn:entsat" | "theta:find_desc"
        | "read:memberw" | "CONS" | "CONST" | "ast:fetch" | "csdp:matches"
        | "csdp:matches_at" | "rmap:rows_for" | "rmap:lookup0" | "solve:assoc"
        | "solve:assoc3" | "cn:fokey" | "cn:rmvt" | "cn:owner" | "cn:gmpl"
        | "theta:natjoin" | "derive:jo_rows" | "rmap:nest" | "derive:count_rows"
        | "rmap:merge_cells" | "rmap:member_pairs" | "rmap:slot" | "rmap:wide_row"
        | "law:slot_for" | "main:flat" | "theta:append_phi" | "law:atoms_of"
        | "manifest:opatoms" | "solve:cell")
}

// ============================ FASTPRIMS ======================================
// Compiled forms of hot canon list cells. The DEF stays the meaning; the head
// evaluates its EXTENSIONAL EQUAL and the unit tests certify identity. Measured
// necessity on the js host with the same canon bytes: memo off -> ZERO laws
// in 120s; FASTPRIMS off -> ZERO laws in 300s; both on -> 53 laws in 49.7s.
// Neither alone suffices, which is exactly why java and cs would not finish.
fn fastprim(name: &str, x: &V) -> Option<V> {
    let r = match name {
        "theta:member" => { let needle = at(x, 0); let lv = at(x, 1); let l = seq(&lv);
            if l.len() < 16 { boolv(l.iter().any(|e| deep_eq(&needle, e))) } else { membidx_has(&lv, &l, &needle) } }
        "theta:filter_eq" => q(seq(x).iter()
            .filter(|p| deep_eq(&at(p, 0), &at(p, 1))).cloned().collect()),
        "theta:drop" => { let l = seq(&at(x, 0)); let k = drain(&l, &at(x, 1)); q(l[k..].to_vec()) }
        "theta:take" => { let l = seq(&at(x, 0)); let k = drain(&l, &at(x, 1)); q(l[..k].to_vec()) }
        "theta:nth" => { let l = seq(&at(x, 0)); let k = drain(&l, &at(x, 1));
            if k >= l.len() { panic!("selector 1 out of range 0"); }
            l[k].clone() }
        "theta:last" => { let l = seq(x); if l.is_empty() { a("?") } else { l[l.len() - 1].clone() } }
        "theta:butlast" => { let l = seq(x);
            q(if l.is_empty() { vec![] } else { l[..l.len() - 1].to_vec() }) }
        "theta:iota" => match x {
            V::I(n) => q((1..=*n).map(V::I).collect()),
            _ => panic!("iota on non-number"),
        },
        "theta:zip" => { let l = seq(&at(x, 0)); let r2 = seq(&at(x, 1));
            q(l.iter().zip(r2.iter()).map(|(p, s)| q(vec![p.clone(), s.clone()])).collect()) }
        "theta:dedup" => { let l = seq(x);
            let mut seen = HashSet::new();
            let mut out: Vec<V> = Vec::new();
            for e in l.iter().rev() { if seen.insert(key(e)) { out.push(e.clone()); } }
            out.reverse(); q(out) }
        "theta:setminus" => { let l = seq(&at(x, 0)); let r2 = seq(&at(x, 1));
            let drop: HashSet<String> = r2.iter().map(key).collect();
            q(l.iter().filter(|e| !drop.contains(&key(e))).cloned().collect()) }
        "theta:flatten" => { let mut out: Vec<V> = Vec::new();
            for s in seq(x).iter() { out.extend(seq(s).iter().cloned()); }
            q(out) }
        // Both of these are ASSOC LOOKUPS written as scans, and both are
        // indexed once per list OBJECT — js keeps ENTIDX/DESCIDX for exactly
        // this, and records law:find_desc firing 28,203,649 times inside
        // law:induce alone. Backus 13.3.4 defines fetch as a linear walk and
        // law:find_desc IS that walk, but the MEANING is "the first descriptor
        // named n" — a lookup — so the walk is the evaluator's business.
        "cn:entsat" => { let lv = at(x, 0); let l = seq(&lv); let k = key(&at(x, 1));
            let id = Rc::as_ptr(&l) as usize;
            let hit = ENTIDX.with(|m| {
                let mut m = m.borrow_mut();
                let (_, idx) = m.entry(id).or_insert_with(|| {
                    let mut idx: HashMap<String, Vec<V>> = HashMap::new();
                    for e in l.iter() {
                        if let V::Q(ea) = e {
                            if ea.len() >= 2 {
                                idx.entry(key(&ea[0])).or_default().push(ea[1].clone());
                            }
                        }
                    }
                    (lv.clone(), idx)          // retain the list: the key is its address
                });
                idx.get(&k).cloned()
            });
            match hit {
                None => q(vec![]),
                Some(vs) => { let mut out: Vec<V> = Vec::new();
                    for v in vs.iter() { out.extend(seq(v).iter().cloned()); }
                    q(out) }
            } }
        "theta:find_desc" => { let name_k = key(&at(x, 0)); let dv = at(x, 1); let descs = seq(&dv);
            let id = Rc::as_ptr(&descs) as usize;
            ENTDESC.with(|m| {
                let mut m = m.borrow_mut();
                let (_, idx) = m.entry(id).or_insert_with(|| {
                    let mut idx: HashMap<String, V> = HashMap::new();
                    for d in descs.iter() {
                        if let V::Q(da) = d {
                            if !da.is_empty() {
                                idx.entry(key(&da[0])).or_insert_with(|| d.clone()); // first wins
                            }
                        }
                    }
                    (dv.clone(), idx)
                });
                idx.get(&name_k).cloned()
            }).unwrap_or_else(|| q(vec![])) }
        // -- CONS / CONST: the combining forms' fast paths (Backus 13.3.2),
        // reached by name through metacomposition. CONS <<CONS f1..fn>, y> is
        // <f1:y .. fn:y>; CONST is the form's second element (Ev 2 . Ev 1).
        "CONS" => { let form = seq(&at(x, 0)); let y = at(x, 1);
            q(form[1..].iter().map(|fi| ev(fi, &y)).collect()) }
        "CONST" => at(&at(x, 0), 1),
        // -- ast:fetch: the FIRST cell named n, the store indexed once by name.
        // A cell is any sequence of length 3; the answer is its third element.
        "ast:fetch" => { let name = at(x, 0); let cells_v = at(x, 1); let cells = seq(&cells_v);
            let id = Rc::as_ptr(&cells) as usize;
            let built = FETCHIDX.with(|m| m.borrow().contains_key(&id));
            if !built {
                let mut idx: HashMap<String, V> = HashMap::new();
                for c in cells.iter() {
                    if let V::Q(ca) = c { if ca.len() == 3 { idx.entry(key(&ca[1])).or_insert_with(|| ca[2].clone()); } }
                }
                FETCHIDX.with(|m| { m.borrow_mut().entry(id).or_insert((cells_v.clone(), idx)); });
            }
            let kk = key(&name);
            FETCHIDX.with(|m| m.borrow().get(&id).and_then(|e| e.1.get(&kk).cloned())).unwrap_or_else(|| a("#")) }
        // -- the first-match lookups, all matchRows over a table indexed once by
        // its first column, each with its DEF's own answer and sentinel.
        "csdp:matches" => q(match_rows(&at(x, 0), &at(x, 1))),
        "csdp:matches_at" => q(match_rows_at(int_of(&at(x, 0)), &at(x, 1), &at(x, 2))),
        "rmap:rows_for" => q(match_rows(&at(x, 0), &at(x, 1))),
        "rmap:lookup0" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { q(vec![]) } else { q(vec![at(&h[0], 1)]) } }
        "solve:assoc" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { q(vec![]) } else { at(&h[0], 1) } }
        "solve:assoc3" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { q(vec![a(""), q(vec![]), q(vec![])]) } else { h[0].clone() } }
        "cn:fokey" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { V::I(999999) } else { at(&h[0], 1) } }
        "cn:rmvt" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { a("") } else { at(&h[0], 3) } }
        "cn:owner" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { q(vec![]) } else { q(vec![at(&h[0], 1)]) } }
        "cn:gmpl" => { let h = match_rows(&at(x, 0), &at(x, 1));
            if h.is_empty() { q(vec![]) } else {
                let third = at(&h[0], 2);
                if matches!(&third, V::Q(t) if t.is_empty()) { q(vec![]) }
                else { q(vec![at(&at(&h[0], 1), 0), at(&third, 0)]) } } }
        // -- solve:cell: the first cell named n, indexed like ast:fetch but with
        // this DEF's edges -- a cell needs a second field to index and a third
        // to answer, and a name missing before a malformed cell raises it.
        "solve:cell" => { let name = at(x, 0); let cells_v = at(x, 1); let cells = seq(&cells_v);
            let id = Rc::as_ptr(&cells) as usize;
            let built = SOLVEIDX.with(|m| m.borrow().contains_key(&id));
            if !built {
                let mut idx: HashMap<String, usize> = HashMap::new();
                let mut bad = false;
                for (i, c) in cells.iter().enumerate() {
                    match c {
                        V::Q(ca) if ca.len() >= 2 => { idx.entry(key(&ca[1])).or_insert(i); }
                        _ => { bad = true; break; }
                    }
                }
                SOLVEIDX.with(|m| { m.borrow_mut().entry(id).or_insert((cells_v.clone(), idx, bad)); });
            }
            let kk = key(&name);
            let (hit, bad) = SOLVEIDX.with(|m| { let mm = m.borrow(); let e = mm.get(&id).unwrap(); (e.1.get(&kk).copied(), e.2) });
            match hit {
                Some(i) => at(&cells[i], 2),
                None => { if bad { panic!("solve:cell: selector on a cell with no name"); } q(vec![]) }
            } }
        // -- the two hash joins. theta:natjoin <(theta:natjoin keys), <A, B>>
        // and derive:jo_rows <keys, <A, B>>: index the right list in its own
        // order, walk the left, each hit combined -- pair for pair the loop.
        "theta:natjoin" => { let form_v = at(x, 0); let keys = at(&form_v, 1);
            let ab = at(x, 1); let a_v = at(&ab, 0); let b_v = at(&ab, 1);
            let av = seq(&a_v); let bv = seq(&b_v);
            if av.is_empty() { q(vec![]) } else {
                let mut idx: HashMap<String, Vec<V>> = HashMap::new();
                for b in bv.iter() {
                    match b { V::Q(bb) if !bb.is_empty() => idx.entry(key(&bb[0])).or_default().push(b.clone()),
                              V::Q(_) => panic!("selector 1 out of range 0"), _ => panic!("selector 1 on atom") }
                }
                let mut out: Vec<V> = Vec::new();
                for a_row in av.iter() {
                    let hk = key(&ev(&keys, a_row));
                    if let Some(hits) = idx.get(&hk) {
                        let arow = seq(a_row);
                        for b in hits.iter() { let bb = seq(b);
                            let mut row = arow.to_vec(); row.extend(bb[1..].iter().cloned()); out.push(q(row)); }
                    }
                }
                q(out)
            } }
        "derive:jo_rows" => { let keys_v = at(x, 0); let keys = seq(&keys_v);
            let pair = at(x, 1); let a_v = at(&pair, 0); let b_v = at(&pair, 1);
            let av = seq(&a_v); let bv = seq(&b_v);
            if av.is_empty() || bv.is_empty() { q(vec![]) }
            else if keys.is_empty() {
                let mut out: Vec<V> = Vec::new();
                for a_row in av.iter() { for b_row in bv.iter() {
                    let mut r = seq(a_row).to_vec(); r.extend(seq(b_row).iter().cloned()); out.push(q(r)); } }
                q(out)
            } else {
                let sel_a: Vec<V> = keys.iter().map(|k| at(k, 0)).collect();
                let sel_b: Vec<V> = keys.iter().map(|k| at(k, 1)).collect();
                let mut idx: HashMap<String, Vec<V>> = HashMap::new();
                for b_row in bv.iter() {
                    let mut kk = String::new();
                    for sel in sel_b.iter() { let v = key(&ev(sel, b_row)); kk.push_str(&v.len().to_string()); kk.push(':'); kk.push_str(&v); }
                    idx.entry(kk).or_default().push(b_row.clone());
                }
                let mut out: Vec<V> = Vec::new();
                for a_row in av.iter() {
                    let mut kk = String::new();
                    for sel in sel_a.iter() { let v = key(&ev(sel, a_row)); kk.push_str(&v.len().to_string()); kk.push(':'); kk.push_str(&v); }
                    if let Some(hits) = idx.get(&kk) {
                        let asq = seq(a_row);
                        for b_row in hits.iter() { let mut r = asq.to_vec(); r.extend(seq(b_row).iter().cloned()); out.push(q(r)); }
                    }
                }
                q(out)
            } }
        // -- grouping in one pass: rmap:nest, derive:count_rows, rmap:merge_cells.
        "rmap:nest" => rmap_nest(x),
        "derive:count_rows" => { let sel = at(x, 0); let rows_v = at(x, 1); let rows = seq(&rows_v);
            let keyvals: Vec<V> = rows.iter().map(|r| ev(&sel, r)).collect();
            let mut counts: HashMap<String, (V, i64)> = HashMap::new();
            for kv in keyvals.iter() { let e = counts.entry(key(kv)).or_insert_with(|| (kv.clone(), 0)); e.1 += 1; }
            let mut order: Vec<String> = Vec::new(); let mut seen: HashSet<String> = HashSet::new();
            for kv in keyvals.iter().rev() { let k = key(kv); if seen.insert(k.clone()) { order.push(k); } }
            order.reverse();
            q(order.iter().map(|k| { let (kv, n) = counts.get(k).unwrap(); q(vec![kv.clone(), V::I(*n)]) }).collect()) }
        "rmap:merge_cells" => { let cells = seq(x);
            let mut groups: HashMap<String, (Option<V>, V, Vec<V>)> = HashMap::new();
            let mut order: Vec<String> = Vec::new();
            for c in cells.iter() { let name = at(c, 1); let k = key(&name);
                if let Some(g) = groups.get_mut(&k) { g.0 = None; g.2.push(c.clone()); }
                else { groups.insert(k.clone(), (Some(c.clone()), name.clone(), vec![c.clone()])); order.push(k); } }
            let mut out: Vec<V> = Vec::with_capacity(order.len());
            for k in order.iter() { let (cell, name, parts) = groups.get(k).unwrap();
                match cell { Some(c) => out.push(c.clone()),
                    None => { let mut contents: Vec<V> = Vec::new();
                        for c in parts.iter() { contents.extend(seq(&at(c, 2)).iter().cloned()); }
                        out.push(q(vec![a("CELL"), name.clone(), q(contents)])); } } }
            q(out) }
        // -- the rmap wide-row machinery. member_pairs caches on the rows'
        // identity (and the descriptor's); slot / wide_row / slot_for are its
        // first-column lookups.
        "rmap:member_pairs" => {
            if let V::Q(xr) = x {
                let xid = Rc::as_ptr(xr) as usize;
                if let Some(v) = PAIRIDX_X.with(|m| m.borrow().get(&xid).map(|(_, v)| v.clone())) { return Some(v); }
            }
            let rows_v = at(x, 4); let rows = seq(&rows_v);
            let rid = Rc::as_ptr(&rows) as usize;
            let ck = key(&q(vec![at(x, 0), at(x, 1), at(x, 2), at(x, 3)]));
            let cached = PAIRIDX_ROWS.with(|m| m.borrow().get(&rid).and_then(|(_, per)| per.get(&ck).cloned()));
            let out = match cached {
                Some(o) => o,
                None => {
                    let keypos = ev(&a("rmap:keypos"), x);
                    let nonkeys_v = ev(&a("rmap:nonkey_positions"), x);
                    let nonkeys = seq(&nonkeys_v);
                    let mut rowsout: Vec<V> = Vec::with_capacity(rows.len());
                    for r in rows.iter() {
                        let nk: Vec<V> = nonkeys.iter().map(|sel| ev(sel, r)).collect();
                        rowsout.push(q(vec![ev(&keypos, r), q(nk)]));
                    }
                    let o = q(rowsout);
                    PAIRIDX_ROWS.with(|m| { let mut m = m.borrow_mut();
                        let e = m.entry(rid).or_insert_with(|| (rows_v.clone(), HashMap::new()));
                        e.1.insert(ck.clone(), o.clone()); });
                    o
                }
            };
            if let V::Q(xr) = x { let xid = Rc::as_ptr(xr) as usize;
                if xid != rid { PAIRIDX_X.with(|m| { m.borrow_mut().entry(xid).or_insert((x.clone(), out.clone())); }); } }
            out
        }
        "rmap:slot" => { let pairs = ev(&a("rmap:member_pairs"), &at(x, 0));
            let h = match_rows(&at(x, 1), &pairs);
            if h.is_empty() { q(vec![]) } else { q(vec![at(&h[0], 1)]) } }
        "rmap:wide_row" => { let key_v = at(x, 0); let rels_v = at(x, 1); let rels = seq(&rels_v);
            let kk = key(&key_v);
            let mut out: Vec<V> = Vec::with_capacity(rels.len() + 1);
            out.push(key_v.clone());
            for rel in rels.iter() {
                let relrc = seq(rel); let rid = Rc::as_ptr(&relrc) as usize;
                let built = SLOTIDX.with(|m| m.borrow().contains_key(&rid));
                if !built {
                    let pairs_v = ev(&a("rmap:member_pairs"), rel); let pairs = seq(&pairs_v);
                    let mut slots: HashMap<String, V> = HashMap::new();
                    for p in pairs.iter() {
                        match p { V::Q(pa) if !pa.is_empty() => { slots.entry(key(&pa[0])).or_insert_with(|| p.clone()); }
                                  V::Q(_) => panic!("selector 1 out of range 0"), _ => panic!("selector 1 on atom") }
                    }
                    SLOTIDX.with(|m| { m.borrow_mut().entry(rid).or_insert((rel.clone(), slots)); });
                }
                let hit = SLOTIDX.with(|m| m.borrow().get(&rid).and_then(|e| e.1.get(&kk).cloned()));
                out.push(match hit { Some(p) => q(vec![at(&p, 1)]), None => q(vec![]) });
            }
            q(out) }
        "law:slot_for" => { let d_v = at(x, 1); let d = seq(&d_v);
            let did = Rc::as_ptr(&d) as usize;
            let cached = SLOTFOR.with(|m| m.borrow().get(&did).map(|(_, v)| v.clone()));
            let pairs = match cached { Some(p) => p, None => {
                let desc = seq(&at(&d_v, 0));
                let unnested = ev(&a("rmap:unnest"), &at(&d_v, 1));
                let rel = q(vec![desc[0].clone(), desc[1].clone(), desc[2].clone(), desc[3].clone(), unnested]);
                let p = ev(&a("rmap:member_pairs"), &rel);
                SLOTFOR.with(|m| { m.borrow_mut().entry(did).or_insert((d_v.clone(), p.clone())); });
                p } };
            let h = match_rows(&at(x, 0), &pairs);
            if h.is_empty() { q(vec![]) } else { q(vec![at(&h[0], 1)]) } }
        // -- concatenation and atom twins.
        "main:flat" => { let mut out: Vec<V> = Vec::new();
            for s in seq(x).iter() { out.extend(seq(s).iter().cloned()); } q(out) }
        "theta:append_phi" => { let l = seq(x); let mut out = l.to_vec(); out.push(q(vec![])); q(out) }
        "law:atoms_of" | "manifest:opatoms" => q(atoms_of(x)),
        // -- read:memberw: theta:member's twin on the same kept set.
        "read:memberw" => { let needle = at(x, 0); let lv = at(x, 1); let l = seq(&lv);
            if l.len() < 16 { boolv(l.iter().any(|e| deep_eq(&needle, e))) } else { membidx_has(&lv, &l, &needle) } }
        _ => return None,
    };
    Some(r)
}

// negative counts drain, zero takes nothing, past-the-end clamps
fn drain(l: &[V], n: &V) -> usize {
    let n = int_of(n);
    if n == 0 { 0 } else if n < 0 { l.len() } else { (n as usize).min(l.len()) }
}

fn memoable(f: &str) -> bool {
    // The js host's MEMOCN, in full. Each names a PURE function of its argument
    // whose input repeats: fetches and lookups keyed by the frozen store, the
    // column tokenizer keyed by a name atom, the store-shaped reports. Memoising
    // a pure def cannot change a value while D is frozen (Backus 14.6), so this
    // is speed only; the leaf twins above intercept the ones that are also
    // FASTPRIMS (ast:fetch, cn:gmpl) before the memo is consulted.
    const MEMOCN: [&str; 22] = ["ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor", "cn:sfx",
        "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts", "cn:chrank", "lex:lw",
        "induce:sig_of", "system:pop_in", "store:fts", "ui:otpops", "mcp:tools",
        "derive:sm_marks", "main:status_fts", "main:cell2", "lex:subruns", "lex:camel"];
    MEMOCN.contains(&f) || f.starts_with("rmap:") || f.starts_with("state:")
}

// ============================ the mu =========================================
// Selectors, sequences are the seven functional forms (COMP right-to-left,
// CONS, CONST, COND, ALPHA, INSERT as a right fold, WHILE). Booleans are the
// atoms "T" and "F". No law semantics live here.
fn ev(f: &V, x: &V) -> V {
    match f {
        V::I(n) => {
            let s = seq(x);
            let n = *n;
            if n < 1 || n as usize > s.len() {
                panic!("selector {} out of range {}", n, s.len());
            }
            s[(n - 1) as usize].clone()
        }
        V::S(name) => {
            let name: &str = name;
            let body = DEFS.with(|d| d.borrow().get(name).cloned());
            if let Some(body) = body {
                if let Some(r) = fastprim(name, x) { return r; }
                if !memoable(name) { return ev(&body, x); }
                let k = memo_key(x);
                if let Some(hit) = EVMEMO.with(|m| {
                    m.borrow().get(name).and_then(|t| t.get(&k).map(|(_, v)| v.clone()))
                }) {
                    return hit;
                }
                let v = ev(&body, x);
                EVMEMO.with(|m| {
                    m.borrow_mut().entry(name.to_string()).or_default()
                        .insert(k, (x.clone(), v.clone()))
                });
                let over = EVMEMON.with(|n| { let mut n = n.borrow_mut(); *n += 1; *n > 400_000 });
                if over {
                    EVMEMO.with(|m| m.borrow_mut().clear());
                    EVMEMON.with(|n| *n.borrow_mut() = 0);
                }
                return v;
            }
            if let Some(r) = prim(name, x) { return r; }
            panic!("unresolved atom: {}", name);
        }
        V::Q(form) => {
            if form.is_empty() { panic!("unknown form: <empty>"); }
            let head = match &form[0] { V::S(s) => s.to_string(), _ => String::new() };
            // tau clause (c): METACOMPOSITION (Backus 13.3.2, 13.4).
            //     (rho <x1..xn>):y = (rho x1):<<x1..xn>, y>
            // FETCH the head, do not MATCH it -- see the note in Arest.java.
            // The match below is the PRIMITIVE ARM of this rule, taken only
            // when canon does not define the form. Note this file's own header
            // recorded the omission ("engine/rust implements true FFP
            // metacomposition ... while the js head ... dispatches the seven
            // forms directly") and justified it by "they agree on canon, which
            // only uses the seven" -- but canon only used the seven BECAUSE the
            // hosts only offered seven, so the consequence was the warrant.
            if head.is_empty() || DEFS.with(|d| d.borrow().contains_key(&head)) {
                return ev(&form[0], &q(vec![f.clone(), x.clone()]));
            }
            match head.as_str() {
                "COMP" => {
                    // the equal-keys filter over distr/distl, answered by an
                    // index once the scanned list is long enough to pay for the
                    // build (joinPat). The written chain runs otherwise, and
                    // always for a short list -- same value, same order.
                    if form.len() == 4 || form.len() == 5 {
                        if let Some(jp) = join_pat(&form[..]) {
                            let jx = if form.len() == 5 { ev(&form[4], x) } else { x.clone() };
                            if let V::Q(pairv) = &jx {
                                if pairv.len() == 2 {
                                    let (list_v, carrier_v) = if jp.distl { (&pairv[1], &pairv[0]) } else { (&pairv[0], &pairv[1]) };
                                    if let V::Q(list) = list_v {
                                        if list.len() > 32 {
                                            return join_exec(&jp, list_v, carrier_v, list);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    let mut v = x.clone();
                    for i in (1..form.len()).rev() { v = ev(&form[i], &v); }
                    v
                }
                // CONS and CONST are CANON now (Backus 13.3.2 verbatim) and
                // reach this host through tau clause (c) above. See
                // head.part.js for why removal, not equivalence, is the proof.
                "COND" => if is_t(&ev(&form[1], x)) { ev(&form[2], x) } else { ev(&form[3], x) },
                "ALPHA" => q(seq(x).iter().map(|e| ev(&form[1], e)).collect()),
                "INSERT" => {
                    let xs = seq(x);
                    if xs.is_empty() { panic!("INSERT on empty"); }
                    let base = xs[xs.len() - 1].clone();
                    // the prepend-every-survivor filter in one linear pass, when
                    // the accumulator is long enough for the copying to bite
                    // (filterFold). framePure proved the accumulator slot unread,
                    // so the sentinel standing in it is never selected; a stray
                    // read would surface loudly rather than as stale data.
                    if xs.len() > 32 {
                        if let V::Q(basev) = &base {
                            if let Some(pat) = fold_pattern(&form[1], 0) {
                                let sentinel = a("\u{0}unread-accumulator");
                                let mut out: Vec<V> = Vec::new();
                                for i in 0..xs.len() - 1 {
                                    let frame = q(vec![xs[i].clone(), sentinel.clone()]);
                                    if is_t(&ev(&pat.pred, &frame)) {
                                        out.push(match &pat.val { None => xs[i].clone(), Some(v) => ev(v, &frame) });
                                    }
                                }
                                out.extend(basev.iter().cloned());
                                return q(out);
                            }
                        }
                    }
                    let mut acc = base;
                    for i in (0..xs.len() - 1).rev() {
                        acc = ev(&form[1], &q(vec![xs[i].clone(), acc]));
                    }
                    acc
                }
                "WHILE" => {
                    let mut v = x.clone();
                    while is_t(&ev(&form[1], &v)) { v = ev(&form[2], &v); }
                    v
                }
                _ => panic!("unknown form: {}", head),
            }
        }
    }
}

// ============================ the canon and carriers =========================
// THE canon, at the repo root — not a curated copy. Each carrier is likewise
// one tuple literal, appearing AS SOURCE exactly as the js host concatenates
// it and the cs csproj copy /b's it.
// compose.py's chunked projection of the canon: the same bytes, split at the
// tuple's top-level commas into fn bodies so LLVM sees many small functions
// instead of one 1.7 MB expression it cannot finish optimizing.
// ============================ the canon VOCABULARY ============================
// Canon is intersection source: ONE file that is simultaneously valid in every
// host language, so that each host's OWN COMPILER reads it. These constructors
// are what make that true here, and they mirror js head.part.js exactly -- A is
// the atom itself, N the selector, K a CONST pair, PHI the empty sequence,
// S1..S9 the sequence family (Backus 13.2 rule 4, chunked at nine because a
// host carries no variadics).
//
// THIS REPLACES A RUNTIME PARSER, and that is the point. Reading canon at run
// time with a hand-written reader throws away the entire reason canon is shaped
// the way it is: it makes the host the canon parser instead of the host's
// compiler, and it means a second implementation of the grammar that can drift.
// The reader was adopted to escape a fifty-minute rebuild; build.rs answers
// that at ~4 minutes by chunking, which is where the cost actually lived.
#[allow(non_snake_case)] fn A(s: &str) -> V { a(s) }
#[allow(non_snake_case)] fn N(n: i64) -> V { V::I(n) }
#[allow(non_snake_case)] fn K(x: V) -> V { q(vec![a("CONST"), x]) }
#[allow(non_snake_case)] fn PHI() -> V { q(vec![]) }
#[allow(non_snake_case)] fn Sv(v: Vec<V>) -> V { q(v) }
// a wide sequence whose MEMBERS were split across part fns by build.rs and
// concatenated back here: same members, same order, still flat
#[allow(non_snake_case)] fn Scat(parts: Vec<Vec<V>>) -> V {
    q(parts.into_iter().flatten().collect())
}
#[allow(non_snake_case)] fn S1(a1: V) -> V { q(vec![a1]) }
#[allow(non_snake_case)] fn S2(a1: V, a2: V) -> V { q(vec![a1, a2]) }
#[allow(non_snake_case)] fn S3(a1: V, a2: V, a3: V) -> V { q(vec![a1, a2, a3]) }
#[allow(non_snake_case)] fn S4(a1: V, a2: V, a3: V, a4: V) -> V { q(vec![a1, a2, a3, a4]) }
#[allow(non_snake_case)] fn S5(a1: V, a2: V, a3: V, a4: V, a5: V) -> V { q(vec![a1, a2, a3, a4, a5]) }
#[allow(non_snake_case)] fn S6(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V) -> V { q(vec![a1, a2, a3, a4, a5, a6]) }
#[allow(non_snake_case)] fn S7(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V) -> V { q(vec![a1, a2, a3, a4, a5, a6, a7]) }
#[allow(non_snake_case)] fn S8(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V, a8: V) -> V { q(vec![a1, a2, a3, a4, a5, a6, a7, a8]) }
#[allow(non_snake_case)] fn S9(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V, a8: V, a9: V) -> V { q(vec![a1, a2, a3, a4, a5, a6, a7, a8, a9]) }

// canon, the case table and the carriers, compiled as rust source. build.rs
// emits this: the same bytes, split only at the tuple's top-level commas so
// rustc sees many small fn bodies instead of one it cannot finish.
include!(concat!(env!("OUT_DIR"), "/canon.rs"));

// The cross-host case table rides in the same composed binary here for the
// same reason it does on the other three hosts (js midcases.part.js, java
// compose.py's 6th arg -> SC inside loadCarriers, cs midcases.part): canon
// `main`'s `case <name>` mode resolves the row by solve:cell over CELLS, so a
// host whose CELLS carry no case: cells refuses every row.
//
// THIS WAS MISSING, and it was invisible: rust-host is not in hosts.sh's
// default AREST_STATIONS ("js java cs"), so when the case table was wired into
// the other three the fourth was simply never run, and conjunct 2 looked
// finished at 3/4. Turning rust on printed "rust: 102 refused, 0 answered" --
// not disagreement, total silence, which is the signature of a host that
// cannot see the questions rather than one that answers them differently.
// Loading it AFTER canon and BEFORE the carriers matches the js concatenation
// order exactly, so the composed store stays byte-equal.
fn load_canon() {
    load_compiled_canon();
}

// The carriers are chunked the same way and for the same reason (the base
// design-state alone is 560 KB). The base journal is empty, and an empty
// CANON("journal") registers nothing, so there is no third carrier here — the
// composed store is byte-equal to the js host's on these carriers.
fn load_carriers() {
    // the carriers are compiled in with canon, in the js concatenation order
}


// ============================ the host contract ==============================
// SIX LINES, and now a FUNCTION rather than a main: load canon, hand canon the
// address, take back the text and the flag. No modes, no rendering, forever --
// all dispatch and all text live in canon `main`, and a new operation is a
// canon edit, never a host edit. Adding a branch here is how runners die.
//
// IT BECAME A LIBRARY THE DAY engine/os NEEDED IT. The OS was carrying a SECOND
// engine -- `arest::worker::arest_call(verb, json)` out of engine/rust, a verb
// table over a JSON store image -- and that engine went with the fat hosts. The
// fix is not to regrow a mu beside this one; it is to have one mu with two
// callers, the CLI beside this file and the OS. A host is ~500 lines because
// there is only ever one of it.

thread_local! {
    static BOOTED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

// ============================ the store boot =================================
// A STORE IS NOT THE FILE IT WAS READ FROM (cs-runner/Boot.cs, ported here). The
// carriers give canon plus the composed populations; the STORE js and the C#
// host answer over is three steps further on -- FILE is a projection of
// state:fts, the reflected meta-types are computed from the schema, and the
// derived populations are the closure under the program's own rules. Skipping
// them is the whole of "the law golden is js-only": the hosts were not
// disagreeing about an answer, they were answering over different stores, and
// origin-boundary-match / store-closed / unreachable-set / nothing-owed /
// writable / file-is-projection are the family that reads exactly that state.
//
// Every step is the same canon call the js and C# hosts make, in the same order
// and under the same memo rule: CELLS is mutated, so the memo and the identity
// indexes are cleared at each mutation point, because ev keys on the store's
// identity and a store whose contents changed under the same reference would
// keep answering from the old one. Order is not free: FILE is what the
// population accessor reads, so it is first; a reflected population is an input
// a rule may read, so it precedes the closure; the journal is folded last
// because its entries change state:fts, whose projection FILE must then rebuild.

// a fresh snapshot of the cell store, the operand every boot step evaluates over
fn store_cells() -> V { CELLS.with(|c| q(c.borrow().clone())) }

// CELLS was mutated: drop the memo and every identity index, exactly as js
// memoClear does, so the next evaluation reindexes the new store.
fn memo_clear_all() {
    EVMEMO.with(|m| m.borrow_mut().clear());
    EVMEMON.with(|n| *n.borrow_mut() = 0);
    ENTIDX.with(|m| m.borrow_mut().clear());
    ENTDESC.with(|m| m.borrow_mut().clear());
    MATCHIDX.with(|m| m.borrow_mut().clear());
    MATCHATIDX.with(|m| m.borrow_mut().clear());
    FETCHIDX.with(|m| m.borrow_mut().clear());
    SOLVEIDX.with(|m| m.borrow_mut().clear());
    SLOTIDX.with(|m| m.borrow_mut().clear());
    SLOTFOR.with(|m| m.borrow_mut().clear());
    MEMBIDX.with(|m| m.borrow_mut().clear());
    JOINIDX.with(|m| m.borrow_mut().clear());
    PAIRIDX_X.with(|m| m.borrow_mut().clear());
    PAIRIDX_ROWS.with(|m| m.borrow_mut().clear());
}

fn is_cell_named(cell: &V, name: &V) -> bool {
    matches!(cell, V::Q(a) if a.len() >= 2
        && matches!(&a[0], V::S(s) if &**s == "CELL") && deep_eq(&a[1], name))
}
fn is_journal_cell(cell: &V) -> bool {
    matches!(cell, V::Q(a) if a.len() >= 2
        && matches!(&a[1], V::S(s) if s.starts_with("journal:")))
}

// FILE is a projection of state:fts, and the accessor reads it, so it is built
// first. Prepend each built cell (js unshift / C# Insert(0), which reverses).
fn load_file() {
    let cells = store_cells();
    if !deep_eq(&ev(&a("ast:fetch"), &q(vec![a("FILE"), cells.clone()])), &a("#")) { return; }
    let built = ev(&a("ast:File"), &ev(&a("store:state"), &cells));
    let bs = seq(&built);
    if bs.is_empty() { return; }
    CELLS.with(|c| {
        let mut cc = c.borrow_mut();
        let mut nv: Vec<V> = bs.iter().rev().cloned().collect();
        nv.extend(cc.drain(..));
        *cc = nv;
    });
    memo_clear_all();
}

// canon says WHICH meta-types are reflected: reflect:cells answers
// <name, population> pairs computed from the schema. Prepend each new one.
fn load_reflected() {
    let cells = store_cells();
    let entries = ev(&a("reflect:cells"), &cells);
    let mut added = false;
    for entry in seq(&entries).iter() {
        let e = seq(entry);
        let name = &e[0];
        let pop = &e[1];
        if !matches!(pop, V::Q(p) if !p.is_empty()) { continue; }
        if CELLS.with(|c| c.borrow().iter().any(|cell| is_cell_named(cell, name))) { continue; }
        CELLS.with(|c| c.borrow_mut().insert(0, q(vec![a("CELL"), name.clone(), pop.clone()])));
        added = true;
    }
    if added { memo_clear_all(); }
}

// THE STORE IS CLOSED UNDER ITS OWN RULES. derive:closed is the closure; carry a
// head only when it holds MORE rows than already present (a semi-derived head
// may carry an asserted prefix), never when empty, never over its own cell.
fn load_derived() -> bool {
    let cells = store_cells();
    let mut carried: HashMap<String, usize> = HashMap::new();
    for p in seq(&ev(&a("derive:store_pairs"), &cells)).iter() {
        let pa = seq(p);
        let n = if let V::Q(rows) = &pa[1] { rows.len() } else { 0 };
        carried.insert(key(&pa[0]), n);
    }
    let mut seen: HashSet<String> = HashSet::new();
    CELLS.with(|c| for cell in c.borrow().iter() {
        if let V::Q(a2) = cell {
            if a2.len() >= 2 && matches!(&a2[0], V::S(s) if &**s == "CELL") { seen.insert(key(&a2[1])); }
        }
    });
    let closed = ev(&a("derive:closed"), &cells);
    let mut to_add: Vec<V> = Vec::new();
    for entry in seq(&closed).iter() {
        let e = seq(entry);
        let nk = key(&e[0]);
        if seen.contains(&nk) { continue; }
        let rows_len = if let V::Q(rows) = &e[1] { rows.len() } else { 0 };
        if *carried.get(&nk).unwrap_or(&0) >= rows_len { continue; }
        if rows_len == 0 { continue; }
        to_add.push(q(vec![a("CELL"), e[0].clone(), e[1].clone()]));
    }
    if to_add.is_empty() { return false; }
    CELLS.with(|c| {
        let mut cc = c.borrow_mut();
        for cell in to_add.iter() { cc.insert(0, cell.clone()); }
    });
    memo_clear_all();
    true
}

// ui:replay folds the journal:<n> cells on their verbs and answers the store
// they produce; canon returns the SAME operand when nothing folds. Returns
// whether there were journal entries at all (the count, not the cell delta).
fn load_journal() -> bool {
    let before = store_cells();
    let out = ev(&a("ui:replay"), &before);
    if let (V::Q(o), V::Q(b)) = (&out, &before) { if Rc::ptr_eq(o, b) { return false; } }
    let outv = match &out { V::Q(o) if !o.is_empty() => o.clone(), _ => return false };
    let n = CELLS.with(|c| c.borrow().iter().filter(|cell| is_journal_cell(cell)).count());
    CELLS.with(|c| *c.borrow_mut() = outv.iter().cloned().collect());
    memo_clear_all();
    n > 0
}

// a new store replaces the old wholesale (main:refile after a journal fold).
fn adopt_store(next: &V) {
    if let V::Q(arr) = next {
        if arr.is_empty() { return; }
        CELLS.with(|c| *c.borrow_mut() = arr.iter().cloned().collect());
        memo_clear_all();
    }
}

// The boot, mirroring Boot.cs / js boot() for the canon+carriers path (no
// store-db). A store with no schema surface has no FILE to build, nothing to
// reflect and no rules to close under, and asking anyway throws -- so it is left
// as the carriers gave it.
fn build_store() {
    if deep_eq(&ev(&a("ast:fetch"), &q(vec![a("state:fts"), store_cells()])), &a("#")) { return; }
    load_file();
    load_reflected();
    load_derived();
    if load_journal() {
        adopt_store(&ev(&a("main:refile"), &store_cells()));
        load_derived();
    }
}

/// Load canon and the carriers, once per thread. Every entry below calls it so
/// a caller cannot forget, and the flag is why: DEF registration order is the
/// contract, and loading twice would double CELLS rather than fail loudly.
pub fn boot() {
    BOOTED.with(|b| {
        if !b.get() {
            load_canon();
            load_carriers();
            build_store();
            b.set(true);
        }
    });
}

/// Ask canon `main` an address -- the CLI contract, verbatim: <text, ok>.
pub fn ask(argv: &[&str]) -> (String, bool) {
    boot();
    let cells = CELLS.with(|c| q(c.borrow().clone()));
    let addr = q(argv.iter().map(|s| a(s)).collect());
    let out = ev(&a("main"), &q(vec![cells, addr]));
    let o = seq(&out);
    (join_text(&o[0]), is_t(&o[1]))
}

/// Ask canon `main:api` a REST step: Eq 2's addressed operation, the one the
/// HTTP and MCP surfaces both enter by. A method is not a verb here -- canon's
/// http:method_kinds says which KIND of step each one is, and canon decides
/// whether the caller may take it. The rendering is canon's own `system:show`:
/// a host that formats has started to mean something.
pub fn api(method: &str, resource: &str, caller: &str, fact: &[&str]) -> String {
    boot();
    let cells = CELLS.with(|c| q(c.borrow().clone()));
    let f = q(fact.iter().map(|s| a(s)).collect());
    let out = ev(
        &a("main:api"),
        &q(vec![cells, a(method), a(resource), a(caller), f]),
    );
    join_text(&ev(&a("system:show"), &out))
}

/// How many cells the load registered. The boot receipt, derived rather than
/// announced -- a host may report what it did, never what canon means.
pub fn cell_count() -> usize {
    boot();
    CELLS.with(|c| c.borrow().len())
}

// ============================ the wasm boundary ==============================
// The same six-line contract over linear memory, for a caller that has no
// thread to spawn and no argv to pass: a bun script, a browser, a Worker.
// `arest_ask` takes the address as UTF-8 arguments joined by 0x1F (the unit
// separator) and answers one buffer -- a little-endian u32 length, canon's
// flag as `T` or `F`, then canon's text. No wasm-bindgen: a host carries no
// dependencies, and the loader is twenty lines (wasm.js beside Cargo.toml).
// The stack budget main.rs spawns a thread for is a LINK flag on this target
// (.cargo/config.toml); the build is
//   cargo rustc --lib --target wasm32-unknown-unknown --crate-type cdylib
// so the native builds keep linking only the rlib. A panic is a trap here
// (the target's strategy is abort), which the caller sees as an exception --
// the same host error the CLI reports with a non-zero exit.
#[cfg(target_arch = "wasm32")]
mod wasm_boundary {
    /// A buffer the caller fills; freed with `arest_free` at the same length.
    #[no_mangle]
    pub extern "C" fn arest_alloc(n: usize) -> *mut u8 {
        let mut v = Vec::<u8>::with_capacity(n.max(1));
        let p = v.as_mut_ptr();
        std::mem::forget(v);
        p
    }

    /// Give a buffer from `arest_alloc` or `arest_ask` back, at its length.
    #[no_mangle]
    pub unsafe extern "C" fn arest_free(p: *mut u8, n: usize) {
        drop(Vec::from_raw_parts(p, 0, n.max(1)));
    }

    /// Load canon and the carriers without asking anything; answers the cell
    /// count, the boot receipt, so a caller can time the load apart from
    /// `main`.
    #[no_mangle]
    pub extern "C" fn arest_boot() -> usize {
        super::cell_count()
    }

    /// Ask canon `main` an address: arguments joined by 0x1F in; out, a
    /// buffer of [len: u32 LE][`T` | `F`][text], `len` counting the flag and
    /// the text, to be freed with `arest_free(ptr, 4 + len)`.
    #[no_mangle]
    pub unsafe extern "C" fn arest_ask(p: *const u8, n: usize) -> *const u8 {
        let bytes = std::slice::from_raw_parts(p, n);
        let s = std::str::from_utf8(bytes).unwrap_or("");
        let argv: Vec<&str> = if n == 0 { Vec::new() } else { s.split(char::from(31u8)).collect() };
        let (text, ok) = super::ask(&argv);
        let mut out = Vec::<u8>::with_capacity(5 + text.len());
        out.extend_from_slice(&((1 + text.len()) as u32).to_le_bytes());
        out.push(if ok { b'T' } else { b'F' });
        out.extend_from_slice(text.as_bytes());
        let p = out.as_ptr();
        std::mem::forget(out);
        p
    }
}

// ---------------------------------------------------------------------------
// The rust host's own unit tests. `cargo test` -- no python, no second host.
//
// Every host runs the same canon over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv and agreement follows because they
// all match the same file. Verifying this host needs cargo and nothing else.
//
// No crate is added for it. The host's Cargo.toml says a host carries no
// dependencies on purpose, and a JSON string is twelve lines of unescaping.
// ---------------------------------------------------------------------------
#[cfg(test)]
mod host_tests {
    use super::*;

    // The canon is one deeply nested expression: building it recurses past a
    // test thread's 2 MB default, which is STATUS_STACK_OVERFLOW rather than a
    // failure. main() spawns at 512 MB for exactly this, so the tests do too --
    // and doing it here rather than through RUST_MIN_STACK keeps the budget
    // with the code that needs it.
    fn with_stack<F: FnOnce() + Send + 'static>(f: F) {
        std::thread::Builder::new()
            .stack_size(512 * 1024 * 1024)
            .spawn(f)
            .expect("spawn")
            .join()
            .expect("join");
    }

    fn shared(name: &str) -> String {
        let mut p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        p.pop();
        p.pop();
        p.push("engine");
        p.push("shared");
        p.push(name);
        std::fs::read_to_string(&p)
            .unwrap_or_else(|e| panic!("cannot read {}: {}", p.display(), e))
    }

    // A JSON string literal back to its text. The golden encodes answers this
    // way because two of them are SQL DDL carrying real newlines, and a
    // hand-rolled escaper silently wrote a file that did not round-trip.
    fn unescape(lit: &str) -> String {
        let b: Vec<char> = lit.trim().chars().collect();
        let mut out = String::new();
        let mut i = if b.first() == Some(&'"') { 1 } else { 0 };
        let end = if b.last() == Some(&'"') { b.len() - 1 } else { b.len() };
        while i < end {
            if b[i] != '\\' {
                out.push(b[i]);
                i += 1;
                continue;
            }
            i += 1;
            match b[i] {
                'n' => out.push('\n'),
                't' => out.push('\t'),
                'r' => out.push('\r'),
                'b' => out.push('\u{8}'),
                'f' => out.push('\u{c}'),
                'u' => {
                    let hex: String = b[i + 1..i + 5].iter().collect();
                    let n = u32::from_str_radix(&hex, 16).expect("\\u escape");
                    out.push(char::from_u32(n).unwrap_or('\u{fffd}'));
                    i += 4;
                }
                c => out.push(c),
            }
            i += 1;
        }
        out
    }

    fn golden_cases() -> Vec<(String, String)> {
        shared("expected-cases.tsv")
            .lines()
            .filter(|l| !l.is_empty())
            .map(|l| {
                let t = l.find('\t').expect("golden row has no tab");
                (l[..t].to_string(), unescape(&l[t + 1..]))
            })
            .collect()
    }

    // THE BOTTOM ROWS ARE THE POINT. canon's note above main:case_text says one
    // case per invocation is deliberate: the table holds rows that BOTTOM, no
    // canon def can branch on bottom, and a fold would die at the first one.
    // The CLI makes a bottom visible by dying and the driver recorded
    // <refused>. In-process the boundary is catch_unwind, and it has to be
    // here or the deliberate refusals read as broken tests.
    fn answer(name: &str) -> String {
        let got = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let cells = CELLS.with(|c| q(c.borrow().clone()));
            let argv = q(vec![a("case"), astr(name.to_string())]);
            let out = ev(&a("main"), &q(vec![cells, argv]));
            join_text(&seq(&out)[0])
        }));
        match got {
            Ok(s) if !s.trim().is_empty() => s.trim().to_string(),
            _ => "<refused>".to_string(),
        }
    }

    #[test]
    fn every_case_answers_what_the_canon_says() {
        with_stack(|| {
            boot();
            // expected panics are the deliberate bottoms; do not print 17 of them
            let prior = std::panic::take_hook();
            std::panic::set_hook(Box::new(|_| {}));
            let mut bad: Vec<String> = Vec::new();
            let cases = golden_cases();
            for (name, want) in &cases {
                let got = answer(name);
                if &got != want {
                    bad.push(format!("{}: want {:?}, got {:?}", name, want, got));
                }
            }
            std::panic::set_hook(prior);
            assert!(cases.len() > 500, "golden looks truncated: {}", cases.len());
            assert!(bad.is_empty(), "{} case(s) differ:\n{}", bad.len(), bad.join("\n"));
        });
    }

    // A def NO host can evaluate answers <refused> everywhere and agrees
    // perfectly, so the refusal COUNT is the signal, not the pass line.
    // 19 since case:eval-unknown-form-refuses joined them: the full-path
    // no entry in derive:forms must REFUSE, because the COND chain it
    // replaced treated an unrecognized form AS a join and a transitive
    // closure stopped closing. This host asserted 17 while the SHARED
    // golden said 18 -- it is not in hosts.sh's default stations, so
    // nothing ran it to notice.
    #[test]
    fn the_golden_still_expects_exactly_19_refusals() {
        let n = golden_cases().iter().filter(|(_, v)| v == "<refused>").count();
        assert_eq!(n, 19, "the golden's refusal count moved");
    }

    #[test]
    fn law_report_holds_byte_for_byte() {
        with_stack(|| {
            boot();
            let want = shared("expected-laws.txt");
            let cells = CELLS.with(|c| q(c.borrow().clone()));
            let out = ev(&a("main"), &q(vec![cells, q(vec![])]));
            let got = join_text(&seq(&out)[0]);
            assert_eq!(got.trim(), want.trim());
        });
    }
}
