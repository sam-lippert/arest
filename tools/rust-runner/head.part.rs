// ============================================================================
// rust-runner — the composed checker, Rust PARITY station.
//
// A STRICT mu mirroring tools/cs-runner/{Vocabulary,Mu}.cs point for point
// (and the js, java, and c stations, which mirror the same source): a
// selector on an atom panics, a selector out of range panics, a duplicate
// DEF panics, a comparison across atom kinds panics, an unresolved atom
// panics, tl/tlr/1r/INSERT on empty panic (Backus 11.2.3: tl of the empty
// sequence is bottom). Booleans are the atoms "T" and "F". No law semantics
// live here — if a guard or a name list ever appears in this file, delete
// it; accretion is how the first two js runners died.
//
// The canon and the carriers appear AS SOURCE and are COMPILED: compose.py
// (the Rust linker, the same honest deviation the Java station carries —
// see its header; the single-CANON! form type-checks for ~30 min and was
// ruled non-viable 2026-07-17) splits the three tuples at top-level commas
// into CANON! slice functions, every byte verbatim, registration order
// kept. CANON! is the "one extra name" join — a macro_rules! that converts
// each element at the boundary (bare docstring literals to atoms,
// everything else already built). Elements evaluate left to right, so DEF
// registration order is source order. The executable is then just exec'd —
// nothing is read, eval'd, or interpreted at runtime.
//
// Values are Rc-shared and immutable; reference counting is the collector.
// Two documented ASCII simplifications (shared with the c station): slug
// filters by char::is_alphanumeric (a hair wider than C#'s IsLetterOrDigit
// outside ASCII) and string comparison orders by UTF-8 byte where C#/Java/JS
// order by UTF-16 code unit. Every name and value the laws slug or sort is
// ASCII, where all four orders coincide; the byte-identical cross-station
// verdicts are the standing check that this stays true.
//
// This same source is the WASM station: rustc --target wasm32-wasip1 turns
// it into composed.wasm, run under a WASI host (bun or node:wasi). wasip1
// has no threads, so the deep-recursion stack is sized at link time there
// (-C link-arg=-zstack-size=...) and by a spawned thread natively.
// ============================================================================
#![allow(non_snake_case, dead_code)]

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

#[derive(Debug)]
enum V {
    S(String),
    I(i64),
    Q(Vec<Obj>),
}
type Obj = Rc<V>;

fn mk_str(s: &str) -> Obj { Rc::new(V::S(s.to_string())) }
fn mk_int(i: i64) -> Obj { Rc::new(V::I(i)) }
fn mk_seq(v: Vec<Obj>) -> Obj { Rc::new(V::Q(v)) }

// ---- the registration vocabulary: DEF, A, N, K, PHI, S1..S9, CANON! -------
// DEF accumulates the composed store (one CELL per registered name) so the
// store reads itself; a duplicate panics by map semantics, exactly as the
// C# Dictionary.Add throws — law:one_name is the law.
thread_local! {
    static DEFS: RefCell<HashMap<String, Obj>> = RefCell::new(HashMap::new());
    static CELLS: RefCell<Vec<Obj>> = RefCell::new(Vec::new());
}

fn DEF(name: &str, body: Obj) -> Obj {
    DEFS.with(|d| {
        let mut d = d.borrow_mut();
        if d.contains_key(name) { panic!("STRICT: duplicate DEF: {}", name); }
        d.insert(name.to_string(), body.clone());
    });
    CELLS.with(|c| c.borrow_mut().push(mk_seq(vec![mk_str("CELL"), mk_str(name), body])));
    mk_str(name)
}
fn A(s: &str) -> Obj { mk_str(s) }
fn N(n: i64) -> Obj { mk_int(n) }
fn PHI() -> Obj { mk_seq(vec![]) }
fn K(x: Obj) -> Obj { mk_seq(vec![mk_str("CONST"), x]) }
fn S1(a: Obj) -> Obj { mk_seq(vec![a]) }
fn S2(a: Obj, b: Obj) -> Obj { mk_seq(vec![a, b]) }
fn S3(a: Obj, b: Obj, c: Obj) -> Obj { mk_seq(vec![a, b, c]) }
fn S4(a: Obj, b: Obj, c: Obj, d: Obj) -> Obj { mk_seq(vec![a, b, c, d]) }
fn S5(a: Obj, b: Obj, c: Obj, d: Obj, e: Obj) -> Obj { mk_seq(vec![a, b, c, d, e]) }
fn S6(a: Obj, b: Obj, c: Obj, d: Obj, e: Obj, f: Obj) -> Obj { mk_seq(vec![a, b, c, d, e, f]) }
fn S7(a: Obj, b: Obj, c: Obj, d: Obj, e: Obj, f: Obj, g: Obj) -> Obj { mk_seq(vec![a, b, c, d, e, f, g]) }
fn S8(a: Obj, b: Obj, c: Obj, d: Obj, e: Obj, f: Obj, g: Obj, h: Obj) -> Obj { mk_seq(vec![a, b, c, d, e, f, g, h]) }
fn S9(a: Obj, b: Obj, c: Obj, d: Obj, e: Obj, f: Obj, g: Obj, h: Obj, i: Obj) -> Obj { mk_seq(vec![a, b, c, d, e, f, g, h, i]) }

// the CANON boundary: bare docstring literals are &str, everything else is
// already Obj; each element converts in place, left to right.
trait IntoObj { fn obj(self) -> Obj; }
impl IntoObj for Obj { fn obj(self) -> Obj { self } }
impl<'a> IntoObj for &'a str { fn obj(self) -> Obj { mk_str(self) } }
macro_rules! CANON {
    ( $($x:expr),* $(,)? ) => { vec![ $( IntoObj::obj($x) ),* ] };
}

// ---- helpers: seq / at strictly mirror C# Seq(x) and Seq(x)[i] ------------
fn is_seq(x: &Obj) -> bool { matches!(&**x, V::Q(_)) }
fn seq(x: &Obj) -> &Vec<Obj> {
    match &**x { V::Q(v) => v, V::S(s) => panic!("STRICT: expected sequence, got atom: {}", s),
        V::I(i) => panic!("STRICT: expected sequence, got atom: {}", i) }
}
fn at(x: &Obj, i: usize) -> Obj {
    let a = seq(x);
    if i >= a.len() { panic!("STRICT: index {} out of {}", i, a.len()); }
    a[i].clone()
}
fn strv(x: &Obj) -> &str {
    match &**x { V::S(s) => s, _ => panic!("STRICT: expected string atom") }
}
fn boolean(b: bool) -> Obj { mk_str(if b { "T" } else { "F" }) }
fn is_T(x: &Obj) -> bool { matches!(&**x, V::S(s) if s == "T") }

// deep structural equality; an int and a string are never equal. Rc sharing
// makes the pointer fast path exact, never observable.
fn deep_eq(a: &Obj, b: &Obj) -> bool {
    if Rc::ptr_eq(a, b) { return true; }
    match (&**a, &**b) {
        (V::S(x), V::S(y)) => x == y,
        (V::I(x), V::I(y)) => x == y,
        (V::Q(x), V::Q(y)) => x.len() == y.len() && x.iter().zip(y.iter()).all(|(p, q)| deep_eq(p, q)),
        _ => false,
    }
}

// CompareAtoms: both ints numeric; both strings ordinal (UTF-8 byte order,
// which equals C#'s CompareOrdinal on ASCII); anything else PANICS.
fn cmp_atoms(a: &Obj, b: &Obj) -> std::cmp::Ordering {
    match (&**a, &**b) {
        (V::I(x), V::I(y)) => x.cmp(y),
        (V::S(x), V::S(y)) => x.cmp(y),
        _ => panic!("STRICT: compare across atom kinds"),
    }
}

// ---- the base primitives: Backus 11.2.3 plus the registered boundary rows
// of resolution.md (lex, implode, slug, escape_html, strip_prefix, 1r, tlr).
fn prim(name: &str, x: Obj) -> Obj {
    match name {
        "id" => x,
        "tl" => { let a = seq(&x); if a.is_empty() { panic!("STRICT: tl on empty"); }
            mk_seq(a[1..].to_vec()) }
        "atom" => boolean(!is_seq(&x)),
        "apndl" => { let h = at(&x, 0); let t0 = at(&x, 1); let t = seq(&t0);
            let mut v = Vec::with_capacity(t.len() + 1); v.push(h); v.extend_from_slice(t); mk_seq(v) }
        "apndr" => { let h0 = at(&x, 0); let h = seq(&h0); let t = at(&x, 1);
            let mut v = Vec::with_capacity(h.len() + 1); v.extend_from_slice(h); v.push(t); mk_seq(v) }
        "distl" => { let h = at(&x, 0); let t0 = at(&x, 1); let t = seq(&t0);
            mk_seq(t.iter().map(|e| mk_seq(vec![h.clone(), e.clone()])).collect()) }
        "distr" => { let h0 = at(&x, 0); let h = seq(&h0); let t = at(&x, 1);
            mk_seq(h.iter().map(|e| mk_seq(vec![e.clone(), t.clone()])).collect()) }
        "cat" => { let a0 = at(&x, 0); let b0 = at(&x, 1); let a = seq(&a0); let b = seq(&b0);
            let mut v = Vec::with_capacity(a.len() + b.len());
            v.extend_from_slice(a); v.extend_from_slice(b); mk_seq(v) }
        "null" => boolean(matches!(&*x, V::Q(v) if v.is_empty())),
        "eq" => boolean(deep_eq(&at(&x, 0), &at(&x, 1))),
        "not" => boolean(!is_T(&x)),
        "and" => boolean(is_T(&at(&x, 0)) && is_T(&at(&x, 1))),
        "length" => mk_int(seq(&x).len() as i64),
        "le" => boolean(cmp_atoms(&at(&x, 0), &at(&x, 1)) != std::cmp::Ordering::Greater),
        "ge" => boolean(cmp_atoms(&at(&x, 0), &at(&x, 1)) != std::cmp::Ordering::Less),
        "gt" => boolean(cmp_atoms(&at(&x, 0), &at(&x, 1)) == std::cmp::Ordering::Greater),
        "+" => { let a = at(&x, 0); let b = at(&x, 1);
            match (&*a, &*b) { (V::I(p), V::I(q)) => mk_int(p + q), _ => panic!("STRICT: + on non-number") } }
        "apply" => { let f = at(&x, 0); let a = at(&x, 1); Ev(&f, a) }
        "lex" => mk_seq(strv(&x).split_whitespace().map(mk_str).collect()),
        "implode" => { let sep0 = at(&x, 0); let sep = strv(&sep0);
            let parts0 = at(&x, 1); let parts = seq(&parts0);
            let words: Vec<&str> = parts.iter().map(|w| match &**w {
                V::S(s) => s.as_str(), _ => panic!("STRICT: implode on non-string") }).collect();
            mk_str(&words.join(sep)) }
        "slug" => mk_str(&strv(&x).to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>()),
        "escape_html" => mk_str(&strv(&x).replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")),
        "strip_prefix" => { let pre0 = at(&x, 0); let pre = strv(&pre0);
            let t0 = at(&x, 1); let t = strv(&t0);
            if t.len() > pre.len() && t.starts_with(pre) { mk_str(&t[pre.len()..]) } else { mk_str(t) } }
        "1r" => { let a = seq(&x); if a.is_empty() { panic!("STRICT: 1r on empty"); } a[a.len() - 1].clone() }
        "tlr" => { let a = seq(&x); if a.is_empty() { panic!("STRICT: tlr on empty"); }
            mk_seq(a[..a.len() - 1].to_vec()) }
        _ => panic!("STRICT: unresolved atom: {}", name),
    }
}

// ---- the mu: atoms resolve through DEFS then the primitives, ints are
// selectors, sequences are the seven functional forms (COMP right-to-left,
// CONS, CONST, COND, ALPHA, INSERT as a right fold, WHILE). ----------------
fn Ev(f: &Obj, x: Obj) -> Obj {
    match &**f {
        V::I(n) => {
            let n = *n;
            match &*x {
                V::Q(v) => {
                    if n < 1 || (n as usize) > v.len() { panic!("STRICT: selector {} out of range {}", n, v.len()); }
                    v[(n - 1) as usize].clone()
                }
                _ => panic!("STRICT: selector {} on atom", n),
            }
        }
        V::S(name) => {
            if let Some(body) = DEFS.with(|d| d.borrow().get(name).cloned()) { return Ev(&body, x); }
            prim(name, x)
        }
        V::Q(form) => {
            if form.is_empty() { panic!("STRICT: unknown form: <empty>"); }
            let head: &str = match &*form[0] { V::S(s) => s, _ => "" };
            match head {
                "COMP" => { let mut v = x; for i in (1..form.len()).rev() { v = Ev(&form[i], v); } v }
                "CONS" => { let mut out = Vec::with_capacity(form.len() - 1);
                    for i in 1..form.len() { out.push(Ev(&form[i], x.clone())); } mk_seq(out) }
                "CONST" => form[1].clone(),
                "COND" => if is_T(&Ev(&form[1], x.clone())) { Ev(&form[2], x) } else { Ev(&form[3], x) },
                "ALPHA" => { let items = seq(&x).clone();
                    mk_seq(items.into_iter().map(|e| Ev(&form[1], e)).collect()) }
                "INSERT" => { let items = seq(&x).clone();
                    if items.is_empty() { panic!("STRICT: INSERT on empty"); }
                    let mut acc = items[items.len() - 1].clone();
                    for i in (0..items.len() - 1).rev() { acc = Ev(&form[1], mk_seq(vec![items[i].clone(), acc])); }
                    acc }
                "WHILE" => { let mut v = x; while is_T(&Ev(&form[1], v.clone())) { v = Ev(&form[2], v); } v }
                _ => panic!("STRICT: unknown form: {}", head),
            }
        }
    }
}

// effects only, the Platform seam: apply the canon's own report to the
// composed store and print the verdicts, byte-identical to the other
// stations so a diff of any two captures is the parity check itself.
fn run_report() {
    let args: Vec<String> = std::env::args().collect();
    let report_name = if args.len() > 1 && args[1] == "app" { "law:app_report" } else { "law:report" };
    let store = CELLS.with(|c| mk_seq(c.borrow().clone()));
    let report = Ev(&mk_str(report_name), store);
    let rows = seq(&report).clone();
    let mut ok = true;
    for pair in rows {
        let name0 = at(&pair, 0);
        let pass = is_T(&at(&pair, 1));
        ok = ok && pass;
        if pass { println!("  law OK: {}", strv(&name0)); }
        else { println!("  LAW FAILED: {} -> F", strv(&name0)); }
    }
    if ok { println!("ALL LAWS HOLD (canon-evaluated: {} over the composed store)", report_name); }
    else { println!("LAW FAILURE"); }
    std::process::exit(if ok { 0 } else { 1 });
}

fn run() {
    load_root();
    load_ds();
    load_na();
    run_report();
}

// natively the deep canonical recursion runs on a thread with a large stack;
// wasm32-wasip1 has no threads, so its stack is sized at link time instead.
#[cfg(not(target_family = "wasm"))]
fn main() {
    std::thread::Builder::new().stack_size(512 * 1024 * 1024).spawn(run).unwrap().join().unwrap();
}
#[cfg(target_family = "wasm")]
fn main() { run(); }

// load_root/load_ds/load_na follow, generated by compose.py (the Rust
// linker): the tuples' items sliced verbatim into CANON! slice functions,
// DEF side effects populating CELLS in source order.
