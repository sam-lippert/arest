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

// ============================ FASTPRIMS ======================================
// Compiled forms of hot canon list cells. The DEF stays the meaning; the head
// evaluates its EXTENSIONAL EQUAL and the unit tests certify identity. Measured
// necessity on the js host with the same canon bytes: memo off -> ZERO laws
// in 120s; FASTPRIMS off -> ZERO laws in 300s; both on -> 53 laws in 49.7s.
// Neither alone suffices, which is exactly why java and cs would not finish.
fn fastprim(name: &str, x: &V) -> Option<V> {
    let r = match name {
        "theta:member" => { let needle = at(x, 0);
            boolv(seq(&at(x, 1)).iter().any(|e| deep_eq(&needle, e))) }
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
    const MEMOCN: [&str; 13] = ["ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor", "cn:sfx",
        "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts", "cn:chrank", "lex:lw",
        "induce:sig_of"];
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
                    let mut acc = xs[xs.len() - 1].clone();
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

/// Load canon and the carriers, once per thread. Every entry below calls it so
/// a caller cannot forget, and the flag is why: DEF registration order is the
/// contract, and loading twice would double CELLS rather than fail loudly.
pub fn boot() {
    BOOTED.with(|b| {
        if !b.get() {
            load_canon();
            load_carriers();
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
