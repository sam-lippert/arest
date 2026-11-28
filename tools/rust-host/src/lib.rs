// arest-host -- the vocabulary's mu, STRICT, a peer of tools/java-runner/Arest.java,
// tools/js-runner/arest.js and tools/cs-runner/Mu.cs, written from the JS host line for line.
//
// A selector on an atom is bottom, a comparison across atom kinds is bottom, an out-of-range
// selection is bottom. Booleans are the atoms "T" and "F", a number is a 64-bit integer whose
// arithmetic is checked (a result past 64 bits is bottom), a text is a string and a sequence a
// vector. Bottom is an Err carrying its reason, never a panic, so the same evaluator runs where a
// panic cannot be caught (wasm) or must not happen (UEFI). No meaning lives here and no speed: no
// memo and no twin, since a strategy a host keeps is one every other host must keep too.
//
// THE MU IS A LIBRARY with three callers: the CLI (src/main.rs, src/bin/laws.rs), engine/os on bare
// UEFI, and a wasm module. Lambda is READ, not compiled in: a caller hands the texts of lambda, the
// case table and the scenarios to `load`, from files (the CLI), from bytes embedded in the image
// (UEFI, feature "embedded") or from its loader (wasm). The platform's registrations are the
// caller's too (src/platform.rs natively; the loader's on wasm).
#![allow(clippy::new_without_default)]

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

#[cfg(all(feature = "platform", not(target_arch = "wasm32"), not(target_os = "uefi")))]
pub mod platform;

#[cfg(target_arch = "wasm32")]
mod wasm;

#[cfg(all(feature = "platform", not(target_arch = "wasm32"), not(target_os = "uefi")))]
#[global_allocator]
static ALLOC: mimalloc::MiMalloc = mimalloc::MiMalloc;

// ---- the value -------------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub enum V {
    S(Rc<str>),
    N(i64),
    Q(Rc<Vec<V>>),
}

pub type R = Result<V, String>;

pub fn a(s: &str) -> V { V::S(Rc::from(s)) }
pub fn q(v: Vec<V>) -> V { V::Q(Rc::new(v)) }
thread_local! {
    static TF: (V, V) = (a("T"), a("F"));
}
fn boolv(b: bool) -> V { TF.with(|t| if b { t.0.clone() } else { t.1.clone() }) }
pub fn is_t(x: &V) -> bool { matches!(x, V::S(s) if &**s == "T") }

pub fn show(x: &V) -> String {
    match x {
        V::S(s) => s.to_string(),
        V::N(n) => n.to_string(),
        V::Q(v) => {
            let mut o = String::from("<");
            for (i, e) in v.iter().enumerate() {
                if i > 0 { o.push_str(", "); }
                o.push_str(&show(e));
            }
            o.push('>');
            o
        }
    }
}

fn clip(s: String, n: usize) -> String {
    if s.len() <= n { return s; }
    let mut e = n;
    while !s.is_char_boundary(e) { e -= 1; }
    s[..e].to_string()
}

pub fn seq(x: &V) -> Result<Rc<Vec<V>>, String> {
    match x {
        V::Q(v) => Ok(v.clone()),
        _ => Err(format!("expected sequence, got atom: {}", clip(show(x), 300))),
    }
}

pub fn at(x: &V, i: usize) -> R {
    let s = seq(x)?;
    s.get(i).cloned().ok_or_else(|| format!("index {} out of {}", i, s.len()))
}

pub fn text(x: &V) -> Result<String, String> {
    match x {
        V::Q(_) => Err("a sequence where a text belongs".to_string()),
        _ => Ok(show(x)),
    }
}

pub fn int(x: &V) -> Result<i64, String> {
    match x { V::N(n) => Ok(*n), _ => Err(format!("a number expected: {}", clip(show(x), 300))) }
}

pub fn deep_eq(x: &V, y: &V) -> bool {
    match (x, y) {
        (V::S(p), V::S(r)) => p == r,
        (V::N(p), V::N(r)) => p == r,
        (V::Q(p), V::Q(r)) => Rc::ptr_eq(p, r) || (p.len() == r.len() && p.iter().zip(r.iter()).all(|(u, w)| deep_eq(u, w))),
        _ => false,
    }
}

// both numbers -> numeric; both texts -> UTF-16 code-unit order; anything else is bottom
fn cmp_atoms(x: &V, y: &V) -> Result<std::cmp::Ordering, String> {
    match (x, y) {
        (V::N(p), V::N(r)) => Ok(p.cmp(r)),
        // UTF-8 byte order is code-point order, which is UTF-16 order unless a character past U+FFFF is
        // involved (a 4-byte sequence, lead byte 0xF0 and up); only then are the code units compared
        (V::S(p), V::S(r)) => Ok(if p.bytes().chain(r.bytes()).any(|b| b >= 0xF0) {
            p.encode_utf16().cmp(r.encode_utf16())
        } else {
            p.as_bytes().cmp(r.as_bytes())
        }),
        _ => Err(format!("compare across atom kinds: {} vs {}", clip(show(x), 200), clip(show(y), 200))),
    }
}

// ---- the store: DEFS, CELLS, the registrations ------------------------------------------------

pub type Prim = Rc<dyn Fn(&V) -> R>;

// FNV-1a: the names are short and trusted, so a fast hash serves where SipHash's flood resistance buys
// nothing; every atom applied is one lookup.
#[derive(Default, Clone, Copy)]
pub struct Fnv(u64);
impl std::hash::Hasher for Fnv {
    fn finish(&self) -> u64 { self.0 }
    fn write(&mut self, b: &[u8]) {
        let mut h = if self.0 == 0 { 0xcbf29ce484222325 } else { self.0 };
        for x in b { h ^= *x as u64; h = h.wrapping_mul(0x100000001b3); }
        self.0 = h;
    }
}
type Fx = std::hash::BuildHasherDefault<Fnv>;

thread_local! {
    static DEFS: RefCell<HashMap<Rc<str>, V, Fx>> = RefCell::new(HashMap::default());
    static CELLS: RefCell<Vec<V>> = const { RefCell::new(Vec::new()) };
    static PRIMS: RefCell<HashMap<String, Prim, Fx>> = RefCell::new(HashMap::default());
}

fn def(name: &str, body: V) -> Result<(), String> {
    DEFS.with(|d| {
        let mut d = d.borrow_mut();
        if d.contains_key(name) { return Err(format!("duplicate DEF: {}", name)); }
        d.insert(Rc::from(name), body.clone());
        Ok(())
    })?;
    CELLS.with(|c| c.borrow_mut().push(q(vec![a("CELL"), a(name), body])));
    Ok(())
}

/// Registration is INTO DEFS' surface: a registered function resolves through the one mu by name,
/// after any compiled cell of the same name, and a duplicate registration is refused.
pub fn register(name: &str, f: Prim) -> Result<(), String> {
    PRIMS.with(|p| {
        let mut p = p.borrow_mut();
        if p.contains_key(name) { return Err(format!("duplicate registration: {}", name)); }
        p.insert(name.to_string(), f);
        Ok(())
    })
}

pub fn push_cell(name: &str, body: V) { CELLS.with(|c| c.borrow_mut().push(q(vec![a("CELL"), a(name), body]))); }
pub fn cells() -> V { CELLS.with(|c| q(c.borrow().clone())) }
pub fn cell_count() -> usize { CELLS.with(|c| c.borrow().len()) }

// ---- Backus's primitives (11.2.3), each as Arest.java defines it ------------------------------

fn py_strip(s: &str, cs: &str) -> String { s.trim_matches(|c| cs.contains(c)).to_string() }
fn py_rstrip(s: &str, cs: &str) -> String { s.trim_end_matches(|c| cs.contains(c)).to_string() }

fn is_ws(b: u8) -> bool { matches!(b, b' ' | b'\t' | b'\n' | 0x0B | 0x0C | b'\r') }

// lex yields TOKEN-RECORDS, ten fields per token, as metamodel/resolution.md types it: tok, nopunct,
// base, ordinal-suffix, lower, quoted-text, initial-cap, hyphen-template, is-quoted, quote-index.
fn lex(x: &V) -> R {
    let t = match x { V::S(s) => s.clone(), _ => return Err("lex of a non-text".to_string()) };
    let b = t.as_bytes();
    let mut spans: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'\'' {
            if let Some(j) = b[i + 1..].iter().position(|&c| c == b'\'') { spans.push((i, i + 1 + j + 1)); i = i + 1 + j + 1; continue; }
            break;
        }
        i += 1;
    }
    let mut rows = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if is_ws(b[i]) { i += 1; continue; }
        let s = i;
        while i < b.len() && !is_ws(b[i]) { i += 1; }
        let e = i;
        let tok = &t[s..e];
        let mut k = 0usize;
        for (n, sp) in spans.iter().enumerate() { if s < sp.1 && sp.0 < e { k = n + 1; break; } }
        let mut qtext = String::new();
        if k > 0 {
            let lo = s.max(spans[k - 1].0 + 1);
            let hi = e.min(spans[k - 1].1 - 1);
            if hi > lo { qtext = t[lo..hi].to_string(); }
        }
        let nopunct = py_strip(tok, ".;:,");
        let base = py_rstrip(&nopunct, "0123456789");
        let mut tpl = tok.to_string();
        if tpl.len() > 2 && tpl.ends_with("--") { tpl.pop(); }
        else if tpl.len() > 2 && tpl.starts_with("--") { tpl.remove(0); }
        else if tpl.len() > 1 && tpl.ends_with('-') { tpl.pop(); }
        else if tpl.len() > 1 && tpl.starts_with('-') { tpl.remove(0); }
        let up = base.as_bytes().first().map(|c| c.is_ascii_uppercase()).unwrap_or(false);
        let suffix = nopunct[base.len()..].to_string();
        rows.push(q(vec![a(tok), a(&nopunct), a(&base), a(&suffix), a(&tok.to_lowercase()), a(&qtext),
                         boolv(up), a(&tpl), boolv(k > 0), V::N(k as i64)]));
    }
    Ok(q(rows))
}

fn base_prim(name: &str, x: &V) -> Option<R> {
    let r = match name {
        "id" => Ok(x.clone()),
        "tl" => seq(x).and_then(|s| if s.is_empty() { Err("tl of <>".into()) } else { Ok(q(s[1..].to_vec())) }),
        "atom" => Ok(boolv(!matches!(x, V::Q(_)))),
        "apndl" => (|| { let p = seq(x)?; let t = seq(p.get(1).ok_or("apndl of one")?)?; let mut v = Vec::with_capacity(t.len() + 1); v.push(p[0].clone()); v.extend(t.iter().cloned()); Ok(q(v)) })(),
        "apndr" => (|| { let p = seq(x)?; let h = seq(&p[0])?; let mut v = h.to_vec(); v.push(p[1].clone()); Ok(q(v)) })(),
        "distl" => (|| { let p = seq(x)?; Ok(q(seq(&p[1])?.iter().map(|e| q(vec![p[0].clone(), e.clone()])).collect())) })(),
        "distr" => (|| { let p = seq(x)?; Ok(q(seq(&p[0])?.iter().map(|e| q(vec![e.clone(), p[1].clone()])).collect())) })(),
        "cat" => (|| { let p = seq(x)?; let mut v = seq(&p[0])?.to_vec(); v.extend(seq(&p[1])?.iter().cloned()); Ok(q(v)) })(),
        "null" => Ok(boolv(matches!(x, V::Q(v) if v.is_empty()))),
        "eq" => (|| { let p = seq(x)?; Ok(boolv(deep_eq(&p[0], &p[1]))) })(),
        "not" => Ok(boolv(!is_t(x))),
        "and" => (|| { let p = seq(x)?; Ok(boolv(is_t(&p[0]) && is_t(&p[1]))) })(),
        "length" => seq(x).map(|s| V::N(s.len() as i64)),
        "lt" => (|| { let p = seq(x)?; Ok(boolv(cmp_atoms(&p[0], &p[1])?.is_lt())) })(),
        "le" => (|| { let p = seq(x)?; Ok(boolv(cmp_atoms(&p[0], &p[1])?.is_le())) })(),
        "ge" => (|| { let p = seq(x)?; Ok(boolv(cmp_atoms(&p[0], &p[1])?.is_ge())) })(),
        "gt" => (|| { let p = seq(x)?; Ok(boolv(cmp_atoms(&p[0], &p[1])?.is_gt())) })(),
        "reverse" => seq(x).map(|s| { let mut v = s.to_vec(); v.reverse(); q(v) }),
        "trans" => (|| {
            let rows = seq(x)?;
            if rows.is_empty() { return Ok(q(vec![])); }
            let w = seq(&rows[0])?.len();
            let mut o = Vec::with_capacity(w);
            for c in 0..w { let mut col = Vec::with_capacity(rows.len()); for r in rows.iter() { col.push(at(r, c)?); } o.push(q(col)); }
            Ok(q(o))
        })(),
        // defined when both are numbers and the result is one, so a result past 64 bits is bottom
        "+" | "-" | "*" | "/" => (|| {
            let p = seq(x)?;
            let (u, w) = (int(p.first().ok_or("arity")?)?, int(p.get(1).ok_or("arity")?)?);
            let r = match name { "+" => u.checked_add(w), "-" => u.checked_sub(w), "*" => u.checked_mul(w), _ => u.checked_div(w) };
            r.map(V::N).ok_or_else(|| format!("a number past 64 bits: {} {} {}", u, name, w))
        })(),
        "apply" => (|| { let p = seq(x)?; ev(&p[0], &p[1]) })(),
        "lex" => lex(x),
        // implode joins atoms, numbers stringified; a sequence among them is bottom
        "implode" => (|| {
            let p = seq(x)?;
            let sep = text(&p[0])?;
            let mut parts = Vec::new();
            for e in seq(&p[1])?.iter() { if matches!(e, V::Q(_)) { return Err("implode on sequence".to_string()); } parts.push(show(e)); }
            Ok(a(&parts.join(&sep)))
        })(),
        // the char-level boundary: one atom per UTF-16 unit
        "chars" => match x {
            V::S(s) => Ok(q(s.encode_utf16().map(|u| a(&String::from_utf16_lossy(&[u]))).collect())),
            _ => Err("chars of a non-text".to_string()),
        },
        "1r" => seq(x).and_then(|s| s.last().cloned().ok_or_else(|| "1r of <>".to_string())),
        "tlr" => seq(x).and_then(|s| if s.is_empty() { Err("tlr of <>".into()) } else { Ok(q(s[..s.len() - 1].to_vec())) }),
        _ => return None,
    };
    Some(r)
}

// AREST_PROFILE: a measurement aid, never an answer: how many times each lambda name is applied.
thread_local! {
    static PROFILING: std::cell::Cell<bool> = std::cell::Cell::new(std::env::var("AREST_PROFILE").is_ok());
    static COUNTS: RefCell<HashMap<Rc<str>, u64, Fx>> = RefCell::new(HashMap::default());
}

thread_local! {
    // the named DEFs being applied, innermost last, and per (scan, caller, caller's caller): the scan's
    // applications and the predicate tests made under it
    static STACK: RefCell<Vec<Rc<str>>> = const { RefCell::new(Vec::new()) };
    static BYCALLER: RefCell<HashMap<(Rc<str>, Rc<str>, Rc<str>), (u64, u64), Fx>> = RefCell::new(HashMap::default());
}
struct Pop;
impl Drop for Pop { fn drop(&mut self) { STACK.with(|t| { t.borrow_mut().pop(); }); } }

const SCANS: [&str; 4] = ["csdp:matches_at", "theta:filter_eq", "theta:find_desc", "derive:news_for"];
const TESTS: [&str; 3] = ["csdp:keep_keyed_at", "theta:keep_eq", "theta:keep_named"];

fn attribute(name: &Rc<str>) {
    let scan = SCANS.contains(&&**name);
    let test = TESTS.contains(&&**name);
    if !scan && !test { return; }
    STACK.with(|t| {
        let t = t.borrow();
        // a scan is charged to itself (it is about to be pushed); a test to the nearest scan on the stack
        let at = if scan { Some(t.len()) } else { t.iter().rposition(|n| SCANS.contains(&&**n)) };
        let Some(i) = at else { return };
        let me: Rc<str> = if scan { name.clone() } else { t[i].clone() };
        let none: Rc<str> = Rc::from("-");
        // a form lambda defines (CONS, CONST: an upper-case name) is on the stack but says nothing of who
        // called; the callers are the nearest named DEFs below the scan that are not forms
        let form = |n: &Rc<str>| n.chars().all(|c| !c.is_ascii_lowercase());
        let mut up = t[..i].iter().rev().filter(|n| !form(n));
        let c1 = up.next().cloned().unwrap_or_else(|| none.clone());
        let c2 = up.next().cloned().unwrap_or(none);
        BYCALLER.with(|b| {
            let mut b = b.borrow_mut();
            let e = b.entry((me, c1, c2)).or_insert((0, 0));
            if scan { e.0 += 1 } else { e.1 += 1 }
        });
    });
}

/// For each scan, its callers two levels up with the scan's applications and the tests made under it, the
/// heaviest first, when AREST_PROFILE is set.
pub fn profile_callers(top: usize) -> Vec<String> {
    let mut v: Vec<((Rc<str>, Rc<str>, Rc<str>), (u64, u64))> = BYCALLER.with(|b| b.borrow().iter().map(|(k, n)| (k.clone(), *n)).collect());
    v.sort_by(|p, r| r.1 .1.cmp(&p.1 .1));
    let mut out = Vec::new();
    for scan in SCANS {
        for ((s, c1, c2), (calls, tests)) in v.iter().filter(|e| &*e.0 .0 == scan).take(top) {
            out.push(format!("{} <- {} <- {}: {} applications, {} tests", s, c1, c2, calls, tests));
        }
    }
    out
}

/// The names applied most, with their counts, when AREST_PROFILE is set.
pub fn profile(top: usize) -> Vec<(String, u64)> {
    let mut v: Vec<(String, u64)> = COUNTS.with(|c| c.borrow().iter().map(|(k, n)| (k.to_string(), *n)).collect());
    v.sort_by(|p, r| r.1.cmp(&p.1));
    v.truncate(top);
    v
}

// ---- mu ------------------------------------------------------------------------------------------

pub fn ev(f: &V, x: &V) -> R {
    match f {
        V::N(n) => {
            let xs = match x { V::Q(v) => v, _ => return Err(format!("selector {} on atom: {}", n, clip(show(x), 300))) };
            if *n < 1 || *n as usize > xs.len() { return Err(format!("selector {} out of range {}", n, xs.len())); }
            Ok(xs[*n as usize - 1].clone())
        }
        V::S(s) => {
            if let Some(body) = DEFS.with(|d| d.borrow().get(&**s).cloned()) {
                if PROFILING.with(|p| p.get()) {
                    COUNTS.with(|c| *c.borrow_mut().entry(s.clone()).or_insert(0) += 1);
                    attribute(s);
                    STACK.with(|t| t.borrow_mut().push(s.clone()));
                    let _pop = Pop;
                    return ev(&body, x);
                }
                return ev(&body, x);
            }
            if let Some(p) = PRIMS.with(|p| p.borrow().get(&**s).cloned()) { return p(x); }
            if let Some(r) = base_prim(s, x) { return r; }
            Err(format!("unresolved atom: {}", s))
        }
        V::Q(form) => {
            let head = match form.first() { Some(V::S(h)) => Some(h.clone()), _ => None };
            // tau clause (c), METACOMPOSITION (Backus 13.3.2): the head is FETCHED, so a form lambda
            // defines is lambda's; the forms below are the primitive arm
            let defined = head.as_ref().map(|h| DEFS.with(|d| d.borrow().contains_key(&**h))).unwrap_or(false);
            if head.is_none() || defined {
                let h = form.first().cloned().ok_or("an empty form")?;
                return ev(&h, &q(vec![f.clone(), x.clone()]));
            }
            match &**head.as_ref().unwrap() {
                "COMP" => { let mut v = x.clone(); for g in form[1..].iter().rev() { v = ev(g, &v)?; } Ok(v) }
                "COND" => if is_t(&ev(&form[1], x)?) { ev(&form[2], x) } else { ev(&form[3], x) },
                "ALPHA" => { let xs = seq(x)?; let mut o = Vec::with_capacity(xs.len()); for e in xs.iter() { o.push(ev(&form[1], e)?); } Ok(q(o)) }
                "INSERT" => {
                    let xs = seq(x)?;
                    if xs.is_empty() { return Err("INSERT on empty".to_string()); }
                    let mut acc = xs[xs.len() - 1].clone();
                    for i in (0..xs.len() - 1).rev() { acc = ev(&form[1], &q(vec![xs[i].clone(), acc]))?; }
                    Ok(acc)
                }
                "WHILE" => { let mut v = x.clone(); while is_t(&ev(&form[1], &v)?) { v = ev(&form[2], &v)?; } Ok(v) }
                h => Err(format!("unknown form: {}", h)),
            }
        }
    }
}

// ---- the reader ----------------------------------------------------------------------------------
//
// A file is one parenthesized literal of text atoms and DEF(name, body) calls, the body written in A,
// N, K, PHI, S and S1..S9. Each constructor is held to its name (S3 with four elements is refused and
// named, as the Java and JS readers refuse it); a number is read as 64 bits.

struct Rd<'t> { b: &'t [u8], i: usize, what: &'t str, def: String, arity: Vec<String> }

impl<'t> Rd<'t> {
    fn ws(&mut self) { while self.i < self.b.len() && (self.b[self.i] as char).is_whitespace() { self.i += 1; } }
    fn peek(&mut self, c: u8) -> bool { self.ws(); self.i < self.b.len() && self.b[self.i] == c }
    fn need(&mut self, c: u8) -> Result<(), String> {
        self.ws();
        if self.i >= self.b.len() || self.b[self.i] != c {
            return Err(format!("lambda reader: {} is not the DEF grammar: '{}' expected at byte {} in {}", self.what, c as char, self.i, self.def));
        }
        self.i += 1;
        Ok(())
    }
    fn str(&mut self) -> Result<String, String> {
        self.ws();
        if self.i >= self.b.len() || self.b[self.i] != b'"' { return Err(format!("lambda reader: {}: a text expected at byte {} in {}", self.what, self.i, self.def)); }
        self.i += 1;
        let mut o: Vec<u8> = Vec::new();
        while self.i < self.b.len() {
            let c = self.b[self.i];
            if c == b'\\' && self.i + 1 < self.b.len() {
                let e = self.b[self.i + 1];
                self.i += 2;
                match e {
                    b'n' => o.push(b'\n'),
                    b'r' => o.push(b'\r'),
                    b't' => o.push(b'\t'),
                    b'0' => o.push(0),
                    b'x' => {
                        let h = std::str::from_utf8(&self.b[self.i..self.i + 2]).map_err(|e| e.to_string())?;
                        let ch = char::from_u32(u32::from_str_radix(h, 16).map_err(|e| e.to_string())?).unwrap_or('\u{fffd}');
                        let mut buf = [0u8; 4];
                        o.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                        self.i += 2;
                    }
                    _ => o.push(e),
                }
                continue;
            }
            if c == b'"' { self.i += 1; return String::from_utf8(o).map_err(|e| e.to_string()); }
            o.push(c);
            self.i += 1;
        }
        Err(format!("lambda reader: {}: an unterminated text in {}", self.what, self.def))
    }
    fn word(&mut self) -> String {
        self.ws();
        let s = self.i;
        while self.i < self.b.len() && (self.b[self.i].is_ascii_alphanumeric() || self.b[self.i] == b'_') { self.i += 1; }
        String::from_utf8_lossy(&self.b[s..self.i]).to_string()
    }
    fn args(&mut self) -> Result<Vec<V>, String> {
        self.need(b'(')?;
        let mut v = Vec::new();
        if self.peek(b')') { self.i += 1; return Ok(v); }
        loop {
            v.push(self.expr()?);
            if self.peek(b',') { self.i += 1; if self.peek(b')') { self.i += 1; return Ok(v); } continue; }
            self.need(b')')?;
            return Ok(v);
        }
    }
    fn expr(&mut self) -> R {
        self.ws();
        if self.i < self.b.len() && self.b[self.i] == b'"' { return Ok(a(&self.str()?)); }
        let at0 = self.i;
        let w = self.word();
        match w.as_str() {
            "A" => { self.need(b'(')?; let s = self.str()?; self.need(b')')?; Ok(a(&s)) }
            "N" => {
                self.need(b'(')?; self.ws();
                let s = self.i;
                if self.i < self.b.len() && self.b[self.i] == b'-' { self.i += 1; }
                while self.i < self.b.len() && self.b[self.i].is_ascii_digit() { self.i += 1; }
                let n: i64 = std::str::from_utf8(&self.b[s..self.i]).ok().and_then(|t| t.parse().ok())
                    .ok_or_else(|| format!("lambda reader: {}: a number past 64 bits in {}", self.what, self.def))?;
                self.need(b')')?;
                Ok(V::N(n))
            }
            "PHI" => { self.need(b'(')?; self.need(b')')?; Ok(q(vec![])) }
            "K" => {
                let v = self.args()?;
                if v.len() != 1 { self.arity.push(format!("K with {} elements in {}", v.len(), self.def)); }
                Ok(q(vec![a("CONST"), v.into_iter().next().unwrap_or_else(|| q(vec![]))]))
            }
            "S" => Ok(q(self.args()?)),
            _ if w.len() == 2 && w.as_bytes()[0] == b'S' && (b'1'..=b'9').contains(&w.as_bytes()[1]) => {
                let n = (w.as_bytes()[1] - b'0') as usize;
                let v = self.args()?;
                if v.len() != n { self.arity.push(format!("{} with {} elements in {}", w, v.len(), self.def)); }
                Ok(q(v))
            }
            _ => Err(format!("lambda reader: {} is not the DEF grammar: '{}' at byte {} in {}", self.what, w, at0, self.def)),
        }
    }
}

fn parse(src: &str, what: &str, each: &mut dyn FnMut(String, V) -> Result<(), String>) -> Result<(), String> {
    let mut p = Rd { b: src.as_bytes(), i: 0, what, def: "(top)".to_string(), arity: Vec::new() };
    p.need(b'(')?;
    loop {
        p.ws();
        if p.i >= p.b.len() { return Err(format!("lambda reader: {}: the literal is not closed", what)); }
        if p.b[p.i] == b')' { p.i += 1; break; }
        if p.b[p.i] == b'"' { p.str()?; }
        else {
            if !p.b[p.i..].starts_with(b"DEF(") { return Err(format!("lambda reader: {} is not the DEF grammar at byte {}", what, p.i)); }
            p.i += 4;
            let name = p.str()?;
            p.def = name.clone();
            p.need(b',')?;
            let body = p.expr()?;
            if p.peek(b',') { p.i += 1; }
            p.need(b')')?;
            each(name, body)?;
        }
        if p.peek(b',') { p.i += 1; }
    }
    p.ws();
    if p.i < p.b.len() { return Err(format!("lambda reader: {}: text after the literal at byte {}", what, p.i)); }
    if !p.arity.is_empty() {
        return Err(format!("lambda reader: {}: {} constructors whose name is not their length:\n  {}", what, p.arity.len(), p.arity.join("\n  ")));
    }
    Ok(())
}

/// Read one lambda text and register its DEFs, in file order.
pub fn load(src: &str, what: &str) -> Result<(), String> {
    parse(src, what, &mut |n, b| def(&n, b))
}

/// A carrier's text to the <CELL, name, body> list DEF would have made of it, registering nothing.
pub fn carrier_cells(src: &str) -> R {
    let mut o = Vec::new();
    parse(src, "carrier text", &mut |n, b| { o.push(q(vec![a("CELL"), a(&n), b])); Ok(()) })?;
    Ok(q(o))
}

/// Read a value written in the vocabulary (S, A, N, ...), as a loader hands one across a boundary.
pub fn read_value(src: &str) -> R {
    let mut p = Rd { b: src.as_bytes(), i: 0, what: "value", def: "(value)".to_string(), arity: Vec::new() };
    let v = p.expr()?;
    if !p.arity.is_empty() { return Err(p.arity.join("; ")); }
    Ok(v)
}

/// Write a value in the vocabulary, the inverse of read_value.
pub fn write_value(x: &V, o: &mut String) {
    match x {
        V::S(s) => {
            o.push_str("A(\"");
            for c in s.chars() {
                match c { '"' => o.push_str("\\\""), '\\' => o.push_str("\\\\"), '\n' => o.push_str("\\n"), '\r' => o.push_str("\\r"), '\t' => o.push_str("\\t"), _ => o.push(c) }
            }
            o.push_str("\")");
        }
        V::N(n) => { o.push_str("N("); o.push_str(&n.to_string()); o.push(')'); }
        V::Q(v) => {
            o.push_str("S(");
            for (i, e) in v.iter().enumerate() { if i > 0 { o.push(','); } write_value(e, o); }
            o.push(')');
        }
    }
}

// ---- the registrations every target can make --------------------------------------------------------
// now, ISO 8601 in UTC, to the millisecond
pub fn clock() -> String {
    let d = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let ms = d.as_millis() as i64;
    let (days, rem) = (ms.div_euclid(86_400_000), ms.rem_euclid(86_400_000));
    // civil from days (H. Hinnant)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let dd = doy - (153 * mp + 2) / 5 + 1;
    let mm = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mm <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z", y, mm, dd, rem / 3_600_000, rem / 60_000 % 60, rem / 1000 % 60, rem % 1000)
}

// <x, s> to x at scale s, half away from zero
pub fn round(x: &V) -> R {
    let v = match at(x, 0)? { V::N(n) => n, _ => return Err("round on non-number".into()) };
    let s = match at(x, 1)? { V::N(n) => n, _ => return Err("round to a non-integer scale".into()) };
    if s >= 0 { return Ok(V::N(v)); }
    if s <= -20 { return Ok(V::N(0)); }
    let pow = 10i128.pow((-s) as u32);
    let bv = v as i128;
    let mut qt = bv / pow;
    let r = bv % pow;
    if r.abs() * 2 >= pow { qt += if v < 0 { -1 } else { 1 }; }
    let o = qt * pow;
    if o < i64::MIN as i128 || o > i64::MAX as i128 { return Err(format!("a number past 64 bits: {}", o)); }
    Ok(V::N(o as i64))
}


/// The registrations a target without a database or files can still make (engine/os): the clock, round, a
/// carrier read as cells, and the storage engine's name.
pub fn register_core() -> Result<(), String> {
    register("clock", Rc::new(|_: &V| Ok(a(&clock()))))?;
    register("round", Rc::new(round))?;
    register("carrier:cells", Rc::new(|x: &V| carrier_cells(&text(x)?)))?;
    register("storage:engine", Rc::new(|_: &V| Ok(a("sqlite"))))
}

// ---- the contract ----------------------------------------------------------------------------------

/// What lambda's `main` answers over the cells and the command line: its text and its flag.
pub fn ask(argv: &[&str]) -> Result<(String, bool), String> {
    let addr = q(argv.iter().map(|s| a(s)).collect());
    let out = ev(&a("main"), &q(vec![cells(), addr]))?;
    let o = seq(&out)?;
    Ok((text(o.first().ok_or("main answered <>")?)?, is_t(o.get(1).ok_or("main answered one value")?)))
}

/// The resource interface: lambda's main:api over the cells, shown.
pub fn api(method: &str, resource: &str, caller: &str, fact: &[&str]) -> Result<String, String> {
    let f = q(fact.iter().map(|s| a(s)).collect());
    let out = ev(&a("main:api"), &q(vec![cells(), a(method), a(resource), a(caller), f]))?;
    text(&ev(&a("system:show"), &out)?)
}

/// The store lambda boots over the cells (main:boot), for laws applied one by one.
pub fn boot_store() -> R { ev(&a("main:boot"), &cells()) }

/// Read lambda, the case table and the scenarios from the files the environment names (defaults relative to
/// tools/rust-host, as the other hosts' defaults are), and name the base: where AREST_CARRIERS holds store.db
/// the cells name it in state:base_db and lambda reads it whole at boot. Answers lambda's path.
#[cfg(not(any(target_arch = "wasm32", target_os = "uefi")))]
pub fn load_from_env() -> Result<String, String> {
    let path = |k: &str, d: &str| std::env::var(k).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| d.to_string());
    let read = |p: &str| std::fs::read_to_string(p).map_err(|e| format!("lambda reader: cannot read {}: {}", p, e));
    let lambda = path("AREST_LAMBDA", "../../arest");
    load(&read(&lambda)?, &lambda)?;
    let t = path("AREST_TESTS", "../../arest.tests");
    load(&read(&t)?, &t)?;
    let s = path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon");
    load(&read(&s)?, &s)?;
    let base = path("AREST_CARRIERS", "../base");
    let db = std::path::Path::new(&base).join("store.db");
    if db.is_file() {
        let full = std::fs::canonicalize(&db).map_err(|e| e.to_string())?.to_string_lossy().trim_start_matches(r"\\?\").replace('\\', "/");
        push_cell("state:base_db", a(&full));
    } else {
        eprint!("no base at {}: nothing composed under the readings
", base);
    }
    Ok(lambda)
}

/// Run work on a thread whose stack is as deep as the Java host's (-Xss512m): lambda recurses past a default
/// thread's stack.
#[cfg(not(any(target_arch = "wasm32", target_os = "uefi")))]
pub fn deep<T: Send + 'static>(work: impl FnOnce() -> T + Send + 'static) -> T {
    std::thread::Builder::new().stack_size(1 << 30).spawn(work).expect("spawn").join().expect("join")
}

/// The texts embedded in the image, for a caller with no file system (engine/os).
#[cfg(feature = "embedded")]
pub mod embedded {
    pub const LAMBDA: &str = include_str!("../../../arest");
    pub const TESTS: &str = include_str!("../../../arest.tests");
    pub const SCENARIOS: &str = include_str!("../../../engine/shared/scenarios.canon");

    /// Load the embedded texts once.
    pub fn boot() -> Result<(), String> {
        if super::cell_count() > 0 { return Ok(()); }
        super::load(LAMBDA, "arest")?;
        super::load(TESTS, "arest.tests")?;
        super::load(SCENARIOS, "scenarios.canon")
    }
}
