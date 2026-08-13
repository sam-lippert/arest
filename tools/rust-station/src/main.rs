// rust-station — the fourth thin mu, mirroring tools/js-runner/head.part.js
// point for point (as tools/java-runner/Arest.java and tools/cs-runner/Mu.cs
// already do). No law semantics live here: the laws are canon DEFs, and if a
// guard or a mode name ever appears in this file, delete it — accretion is how
// the first two js runners died.
//
// WHY THIS EXISTS. engine/rust is 19,664 lines and had drifted from its own
// documented behaviour: README.md's known-good table records "1,000 fetches on
// D: 337 us (0.34 us per fetch, since Map is O(1))", while its NEval resolved
// every named application with `self.cells.iter().find(..)` — a linear scan.
// That pipeline is measured under 700 ms on 414 KB of readings; the same host
// could not finish a 230 KB metamodel compile in 900 s. A station is ~500
// lines, not ~19,000, and byte-identity against the other three certifies it.
//
// TRANSLITERATED FROM Arest.java, NOT from engine/rust. The two mus are
// different machines: engine/rust implements true FFP metacomposition
// (<f1..fn>:x = f1:<<f1..fn>,x>, so COMP/CONS resolve as NAMES), while the js
// head — which java and cs mirror — dispatches the seven forms directly and
// throws on anything else. They agree on canon, which only uses the seven, but
// only the js shape is certified byte-identical, so that is the shape copied.
// engine/rust's prims also ride a richer Leaf (F, AppTag) and a resolve_def
// override table a station must not have.
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
// whole store, so serialising it per call costs more than the reduction it was
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
#[allow(non_snake_case)]
mod vocab {
    use super::*;
    pub fn A(s: &str) -> V { a(s) }
    pub fn N(i: i64) -> V { V::I(i) }
    pub fn K(x: V) -> V { q(vec![a("CONST"), x]) }
    pub fn PHI() -> V { q(vec![]) }
    pub fn S1(a1: V) -> V { q(vec![a1]) }
    pub fn S2(a1: V, a2: V) -> V { q(vec![a1, a2]) }
    pub fn S3(a1: V, a2: V, a3: V) -> V { q(vec![a1, a2, a3]) }
    pub fn S4(a1: V, a2: V, a3: V, a4: V) -> V { q(vec![a1, a2, a3, a4]) }
    pub fn S5(a1: V, a2: V, a3: V, a4: V, a5: V) -> V { q(vec![a1, a2, a3, a4, a5]) }
    pub fn S6(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V) -> V {
        q(vec![a1, a2, a3, a4, a5, a6])
    }
    pub fn S7(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V) -> V {
        q(vec![a1, a2, a3, a4, a5, a6, a7])
    }
    pub fn S8(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V, a8: V) -> V {
        q(vec![a1, a2, a3, a4, a5, a6, a7, a8])
    }
    pub fn S9(a1: V, a2: V, a3: V, a4: V, a5: V, a6: V, a7: V, a8: V, a9: V) -> V {
        q(vec![a1, a2, a3, a4, a5, a6, a7, a8, a9])
    }
    // The carriers' varargs `S(..)` — arities up to 63 — reaches this as
    // `Sv(vec![..])` after compose.py's syntax-only rewrite. This is PERMANENT,
    // not a stopgap. Backus 13.2 rule 4: a sequence has arbitrary length n, and
    // S1..S9 is notation rather than mathematics. norma-oracle emits the
    // arity-free spelling exactly where a sequence "must stay FLAT regardless
    // of length, so that length is never encoded as depth — depth already means
    // tenancy" (Verifier.cs IFlatSeq, citing backus78 14.7 / prop:tenant), so
    // chunking those sites would collide length with sub-store structure. Rust
    // is simply unable to spell arbitrary arity; this supplies the missing
    // notation and changes no value. See compose.py.
    pub fn Sv(xs: Vec<V>) -> V { q(xs) }
}

// ============================ the base =======================================
// Backus 11.2.3's primitives, transliterated from Arest.java one for one. Each
// edge is the certified one: `tl` on empty panics, `strip_prefix` needs a
// STRICTLY longer subject, `ntoa` refuses a non-number, the char ops are ASCII
// on every station.
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
        // bottom on every station.
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
        // metamodel/resolution.md types it. This station answered a flat word
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
        _ => return None,
    };
    Some(r)
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
// evaluates its EXTENSIONAL EQUAL and the wall certifies identity. Measured
// necessity on the js station with the same canon bytes: memo off -> ZERO laws
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
// one tuple literal, appearing AS SOURCE exactly as the js station concatenates
// it and the cs csproj copy /b's it.
// compose.py's chunked projection of the canon: the same bytes, split at the
// tuple's top-level commas into fn bodies so LLVM sees many small functions
// instead of one 1.7 MB expression it cannot finish optimising.
include!("canon.g.rs");
include!("scenarios.g.rs");
include!("design-state.g.rs");
include!("norma-answer.g.rs");

// The cross-host case table rides in the same composed binary here for the
// same reason it does on the other three stations (js midcases.part.js, java
// compose.py's 6th arg -> SC inside loadCarriers, cs midcases.part): canon
// `main`'s `case <name>` mode resolves the row by solve:cell over CELLS, so a
// station whose CELLS carry no case: cells refuses every row.
//
// THIS WAS MISSING, and it was invisible: rust-station is not in stations.sh's
// default AREST_STATIONS ("js java cs"), so when the case table was wired into
// the other three the fourth was simply never run, and conjunct 2 looked
// finished at 3/4. Turning rust on printed "rust: 102 refused, 0 answered" --
// not disagreement, total silence, which is the signature of a station that
// cannot see the questions rather than one that answers them differently.
// Loading it AFTER canon and BEFORE the carriers matches the js concatenation
// order exactly, so the composed store stays byte-equal.
fn load_canon() { load_canon_all(); load_scenarios_all(); }

// The carriers are chunked the same way and for the same reason (the base
// design-state alone is 560 KB). The base journal is empty, and an empty
// CANON("journal") registers nothing, so there is no third carrier here — the
// composed store is byte-equal to the js station's on these carriers.
fn load_carriers() {
    load_design_state_all();
    load_norma_answer_all();
}

// THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
// All dispatch and all text live in canon `main`; a new operation is a canon
// edit, never a host edit. Adding a branch here is how runners die.
fn run() {
    load_canon();
    load_carriers();
    let argv: Vec<V> = std::env::args().skip(1).map(|s| astr(s)).collect();
    let cells = CELLS.with(|c| q(c.borrow().clone()));
    let out = ev(&a("main"), &q(vec![cells, q(argv)]));
    let o = seq(&out);
    print!("{}\n", join_text(&o[0]));
    std::process::exit(if is_t(&o[1]) { 0 } else { 1 });
}

fn main() {
    // The canon is ONE deeply nested expression, so merely BUILDING it recurses
    // past the main thread's default stack, and mu then recurses deeper still.
    // engine/rust:main already spawns at 512 MB for exactly this; the same
    // reduction forces the same budget on every host (conftest.py's
    // setrecursionlimit(1_000_000), the wasm -zstack-size flag, and
    // engine/rust/.cargo/config.toml's RUST_MIN_STACK for test threads).
    std::thread::Builder::new()
        .stack_size(512 * 1024 * 1024)
        .spawn(run)
        .expect("spawn")
        .join()
        .expect("join");
}
