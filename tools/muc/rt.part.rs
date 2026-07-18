// ============================================================================
// muc runtime — the target of the μ compiler (tools/muc/muc.py).
//
// This is NOT an eighth mirror. It is the FIRST FUTAMURA PROJECTION of the
// strict μ over the canon: muc.py partially evaluates "Ev(f, x) with f
// static" into one Rust function per DEF, so the interpretive dispatch
// loop the seven stations share does not exist here — COMP is call
// sequencing, COND is `if`, ALPHA/INSERT/WHILE are loops, selectors are
// bounds-checked indexing, and every DEF name resolves at generation time.
// The strictness contract is untouched and still enforced AT RUNTIME on
// exactly the paths the μ would take: a selector on an atom panics, out of
// range panics, compare across atom kinds panics, tl/tlr/1r/INSERT on the
// empty sequence panic (Backus 11.2.3: bottom), and an atom that resolves
// to neither DEF nor primitive compiles to a die-stub that panics IF
// EVALUATED (dead branches must die only when taken, exactly as under the
// μ). Booleans are the atoms "T" and "F".
//
// Values are interned: atoms and sequences are u32 ids into runtime
// tables, every sequence is hash-consed at construction, so structural
// equality IS `==` on a 16-byte Copy value — the C station's hash-consing
// discipline, promoted to the value representation itself.
//
// `apply` evaluates a term that arrives as DATA, so ev_dyn keeps a small
// interpretive μ over the same interned values (the Lisp coexistence);
// compiled DEFs are reachable from it through an atom-id → fn table, so
// dynamic and compiled evaluation agree by construction.
//
// No law semantics live here. The certifier is the seven interpretive
// stations: byte-identical verdicts on every store, identical flips under
// the mutation trial. If this runtime and the mirrors ever disagree, the
// mirrors are right.
// ============================================================================
#![allow(non_snake_case, dead_code, unused_variables, unused_mut)]

use std::collections::HashMap;
use std::rc::Rc;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
enum V {
    I(i64),
    A(u32),
    Q(u32),
}

struct Rt {
    strs: Vec<String>,
    str_ids: HashMap<String, u32>,
    seqs: Vec<Rc<[V]>>,
    seq_ids: HashMap<Rc<[V]>, u32>,
    t: V,
    f: V,
    id_comp: u32,
    id_cons: u32,
    id_const: u32,
    id_cond: u32,
    id_alpha: u32,
    id_insert: u32,
    id_while: u32,
    table: Vec<Option<fn(V, &mut Rt) -> V>>,
    pool: Vec<V>,
}

fn die(msg: &str) -> ! {
    panic!("STRICT: {}", msg)
}

impl Rt {
    fn new() -> Rt {
        let mut rt = Rt {
            strs: Vec::new(),
            str_ids: HashMap::new(),
            seqs: Vec::new(),
            seq_ids: HashMap::new(),
            t: V::I(0),
            f: V::I(0),
            id_comp: 0,
            id_cons: 0,
            id_const: 0,
            id_cond: 0,
            id_alpha: 0,
            id_insert: 0,
            id_while: 0,
            table: Vec::new(),
            pool: Vec::new(),
        };
        rt.t = rt.atom("T");
        rt.f = rt.atom("F");
        rt.id_comp = rt.atom_id("COMP");
        rt.id_cons = rt.atom_id("CONS");
        rt.id_const = rt.atom_id("CONST");
        rt.id_cond = rt.atom_id("COND");
        rt.id_alpha = rt.atom_id("ALPHA");
        rt.id_insert = rt.atom_id("INSERT");
        rt.id_while = rt.atom_id("WHILE");
        rt
    }

    fn atom_id(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.str_ids.get(s) {
            return id;
        }
        let id = self.strs.len() as u32;
        self.strs.push(s.to_string());
        self.str_ids.insert(s.to_string(), id);
        id
    }

    fn atom(&mut self, s: &str) -> V {
        V::A(self.atom_id(s))
    }

    fn seq(&mut self, items: &[V]) -> V {
        if let Some(&id) = self.seq_ids.get(items) {
            return V::Q(id);
        }
        let rc: Rc<[V]> = items.into();
        let id = self.seqs.len() as u32;
        self.seqs.push(rc.clone());
        self.seq_ids.insert(rc, id);
        V::Q(id)
    }

    fn items(&self, x: V) -> &[V] {
        match x {
            V::Q(id) => &self.seqs[id as usize],
            V::A(id) => die(&format!("expected sequence, got atom: {}", self.strs[id as usize])),
            V::I(n) => die(&format!("expected sequence, got atom: {}", n)),
        }
    }

    fn items_vec(&self, x: V) -> Rc<[V]> {
        match x {
            V::Q(id) => self.seqs[id as usize].clone(),
            _ => { self.items(x); unreachable!() }
        }
    }

    fn s(&self, x: V) -> &str {
        match x {
            V::A(id) => &self.strs[id as usize],
            _ => die("expected string atom"),
        }
    }
}

fn boolean(rt: &Rt, b: bool) -> V {
    if b { rt.t } else { rt.f }
}

fn is_t(rt: &Rt, x: V) -> bool {
    x == rt.t
}

fn at(rt: &Rt, x: V, i: usize) -> V {
    let a = rt.items(x);
    if i >= a.len() {
        die(&format!("index {} out of {}", i, a.len()));
    }
    a[i]
}

fn sel(rt: &Rt, x: V, n: i64) -> V {
    match x {
        V::Q(id) => {
            let a = &rt.seqs[id as usize];
            if n < 1 || (n as usize) > a.len() {
                die(&format!("selector {} out of range {}", n, a.len()));
            }
            a[(n - 1) as usize]
        }
        _ => die(&format!("selector {} on atom", n)),
    }
}

fn cmp_atoms(rt: &Rt, a: V, b: V) -> std::cmp::Ordering {
    match (a, b) {
        (V::I(x), V::I(y)) => x.cmp(&y),
        (V::A(x), V::A(y)) => rt.strs[x as usize].as_str().cmp(rt.strs[y as usize].as_str()),
        _ => die("compare across atom kinds"),
    }
}

// ---- the 24 primitives, compiled dispatch targets --------------------------
fn p_id(x: V, rt: &mut Rt) -> V { x }

fn p_tl(x: V, rt: &mut Rt) -> V {
    let a = rt.items_vec(x);
    if a.is_empty() { die("tl on empty"); }
    rt.seq(&a[1..])
}

fn p_atom(x: V, rt: &mut Rt) -> V {
    boolean(rt, !matches!(x, V::Q(_)))
}

fn p_apndl(x: V, rt: &mut Rt) -> V {
    let h = at(rt, x, 0);
    let t = rt.items_vec(at(rt, x, 1));
    let mut v = Vec::with_capacity(t.len() + 1);
    v.push(h);
    v.extend_from_slice(&t);
    rt.seq(&v)
}

fn p_apndr(x: V, rt: &mut Rt) -> V {
    let h = rt.items_vec(at(rt, x, 0));
    let t = at(rt, x, 1);
    let mut v = Vec::with_capacity(h.len() + 1);
    v.extend_from_slice(&h);
    v.push(t);
    rt.seq(&v)
}

fn p_distl(x: V, rt: &mut Rt) -> V {
    let h = at(rt, x, 0);
    let t = rt.items_vec(at(rt, x, 1));
    let mut out = Vec::with_capacity(t.len());
    for &e in t.iter() {
        let p = rt.seq(&[h, e]);
        out.push(p);
    }
    rt.seq(&out)
}

fn p_distr(x: V, rt: &mut Rt) -> V {
    let h = rt.items_vec(at(rt, x, 0));
    let t = at(rt, x, 1);
    let mut out = Vec::with_capacity(h.len());
    for &e in h.iter() {
        let p = rt.seq(&[e, t]);
        out.push(p);
    }
    rt.seq(&out)
}

fn p_cat(x: V, rt: &mut Rt) -> V {
    let a = rt.items_vec(at(rt, x, 0));
    let b = rt.items_vec(at(rt, x, 1));
    let mut v = Vec::with_capacity(a.len() + b.len());
    v.extend_from_slice(&a);
    v.extend_from_slice(&b);
    rt.seq(&v)
}

fn p_null(x: V, rt: &mut Rt) -> V {
    let b = matches!(x, V::Q(id) if rt.seqs[id as usize].is_empty());
    boolean(rt, b)
}

fn p_eq(x: V, rt: &mut Rt) -> V {
    // hash-consing makes structural equality id equality
    boolean(rt, at(rt, x, 0) == at(rt, x, 1))
}

fn p_not(x: V, rt: &mut Rt) -> V {
    let b = !is_t(rt, x);
    boolean(rt, b)
}

fn p_and(x: V, rt: &mut Rt) -> V {
    let b = is_t(rt, at(rt, x, 0)) && is_t(rt, at(rt, x, 1));
    boolean(rt, b)
}

fn p_length(x: V, rt: &mut Rt) -> V {
    V::I(rt.items(x).len() as i64)
}

fn p_le(x: V, rt: &mut Rt) -> V {
    let c = cmp_atoms(rt, at(rt, x, 0), at(rt, x, 1));
    boolean(rt, c != std::cmp::Ordering::Greater)
}

fn p_ge(x: V, rt: &mut Rt) -> V {
    let c = cmp_atoms(rt, at(rt, x, 0), at(rt, x, 1));
    boolean(rt, c != std::cmp::Ordering::Less)
}

fn p_gt(x: V, rt: &mut Rt) -> V {
    let c = cmp_atoms(rt, at(rt, x, 0), at(rt, x, 1));
    boolean(rt, c == std::cmp::Ordering::Greater)
}

fn p_plus(x: V, rt: &mut Rt) -> V {
    match (at(rt, x, 0), at(rt, x, 1)) {
        (V::I(a), V::I(b)) => V::I(a + b),
        _ => die("+ on non-number"),
    }
}

fn p_apply(x: V, rt: &mut Rt) -> V {
    let f = at(rt, x, 0);
    let a = at(rt, x, 1);
    ev_dyn(f, a, rt)
}

fn p_lex(x: V, rt: &mut Rt) -> V {
    let s = rt.s(x).to_string();
    let words: Vec<String> = s.split_whitespace().map(|w| w.to_string()).collect();
    let mut out = Vec::with_capacity(words.len());
    for w in words {
        let a = rt.atom(&w);
        out.push(a);
    }
    rt.seq(&out)
}

fn p_implode(x: V, rt: &mut Rt) -> V {
    let sep = rt.s(at(rt, x, 0)).to_string();
    let parts = rt.items_vec(at(rt, x, 1));
    let mut words = Vec::with_capacity(parts.len());
    for &w in parts.iter() {
        match w {
            V::A(id) => words.push(rt.strs[id as usize].clone()),
            _ => die("implode on non-string"),
        }
    }
    let joined = words.join(&sep);
    rt.atom(&joined)
}

fn p_slug(x: V, rt: &mut Rt) -> V {
    let s = rt.s(x).to_lowercase();
    let out: String = s.chars().filter(|c| c.is_alphanumeric()).collect();
    rt.atom(&out)
}

fn p_escape_html(x: V, rt: &mut Rt) -> V {
    let s = rt.s(x)
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    rt.atom(&s)
}

fn p_strip_prefix(x: V, rt: &mut Rt) -> V {
    let pre = rt.s(at(rt, x, 0)).to_string();
    let t = rt.s(at(rt, x, 1)).to_string();
    if t.len() > pre.len() && t.starts_with(&pre) {
        rt.atom(&t[pre.len()..])
    } else {
        rt.atom(&t)
    }
}

fn p_1r(x: V, rt: &mut Rt) -> V {
    let a = rt.items(x);
    if a.is_empty() { die("1r on empty"); }
    a[a.len() - 1]
}

fn p_tlr(x: V, rt: &mut Rt) -> V {
    let a = rt.items_vec(x);
    if a.is_empty() { die("tlr on empty"); }
    rt.seq(&a[..a.len() - 1])
}

fn prim_by_name(name: &str) -> Option<fn(V, &mut Rt) -> V> {
    Some(match name {
        "id" => p_id, "tl" => p_tl, "atom" => p_atom, "apndl" => p_apndl,
        "apndr" => p_apndr, "distl" => p_distl, "distr" => p_distr,
        "cat" => p_cat, "null" => p_null, "eq" => p_eq, "not" => p_not,
        "and" => p_and, "length" => p_length, "le" => p_le, "ge" => p_ge,
        "gt" => p_gt, "+" => p_plus, "apply" => p_apply, "lex" => p_lex,
        "implode" => p_implode, "slug" => p_slug, "escape_html" => p_escape_html,
        "strip_prefix" => p_strip_prefix, "1r" => p_1r, "tlr" => p_tlr,
        _ => return None,
    })
}

// ---- ev_dyn: the interpretive μ over interned terms (the apply seam) ------
// DEFS resolve through the compiled-function table, so dynamic terms and
// compiled code cannot disagree; forms and strictness mirror the μ exactly.
fn ev_dyn(f: V, x: V, rt: &mut Rt) -> V {
    match f {
        V::I(n) => sel(rt, x, n),
        V::A(id) => {
            if let Some(Some(d)) = rt.table.get(id as usize).copied() {
                return d(x, rt);
            }
            let name = rt.strs[id as usize].clone();
            match prim_by_name(&name) {
                Some(p) => p(x, rt),
                None => die(&format!("unresolved atom: {}", name)),
            }
        }
        V::Q(fid) => {
            let form = rt.seqs[fid as usize].to_vec();
            if form.is_empty() { die("unknown form: <empty>"); }
            let head = match form[0] { V::A(h) => h, _ => die("unknown form") };
            if head == rt.id_comp {
                let mut v = x;
                for i in (1..form.len()).rev() {
                    v = ev_dyn(form[i], v, rt);
                }
                v
            } else if head == rt.id_cons {
                let mut out = Vec::with_capacity(form.len() - 1);
                for i in 1..form.len() {
                    let e = ev_dyn(form[i], x, rt);
                    out.push(e);
                }
                rt.seq(&out)
            } else if head == rt.id_const {
                form[1]
            } else if head == rt.id_cond {
                let c = ev_dyn(form[1], x, rt);
                if is_t(rt, c) { ev_dyn(form[2], x, rt) } else { ev_dyn(form[3], x, rt) }
            } else if head == rt.id_alpha {
                let xs = rt.items_vec(x);
                let mut out = Vec::with_capacity(xs.len());
                for &e in xs.iter() {
                    let r = ev_dyn(form[1], e, rt);
                    out.push(r);
                }
                rt.seq(&out)
            } else if head == rt.id_insert {
                let xs = rt.items_vec(x);
                if xs.is_empty() { die("INSERT on empty"); }
                let mut acc = xs[xs.len() - 1];
                for i in (0..xs.len() - 1).rev() {
                    let pair = rt.seq(&[xs[i], acc]);
                    acc = ev_dyn(form[1], pair, rt);
                }
                acc
            } else if head == rt.id_while {
                let mut v = x;
                loop {
                    let c = ev_dyn(form[1], v, rt);
                    if !is_t(rt, c) { break; }
                    v = ev_dyn(form[2], v, rt);
                }
                v
            } else {
                die(&format!("unknown form: {}", rt.strs[head as usize]));
            }
        }
    }
}

// ---- effects only: apply the canon's own report to the composed store -----
fn run_report(rt: &mut Rt, store: V, report_fn: fn(V, &mut Rt) -> V, report_name: &str) -> i32 {
    let report = report_fn(store, rt);
    let rows = rt.items_vec(report);
    let mut ok = true;
    for &pair in rows.iter() {
        let name = rt.s(at(rt, pair, 0)).to_string();
        let passed = is_t(rt, at(rt, pair, 1));
        ok = ok && passed;
        if passed {
            println!("  law OK: {}", name);
        } else {
            println!("  LAW FAILED: {} -> F", name);
        }
    }
    if ok {
        println!("ALL LAWS HOLD (canon-evaluated: {} over the composed store)", report_name);
        0
    } else {
        println!("LAW FAILURE");
        1
    }
}

// generated code follows: the interned constant pool builders, one compiled
// function per DEF, the id->fn table, the store, and main.
