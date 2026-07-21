# -*- coding: utf-8 -*-
# THE PROCEDURAL TRANSFORM, rust target: emits the whole crate -
# runtime head (Value enum, strict helpers, prims, tree-Ev fallback),
# every DEF as a fn, the carriers as data, the host contract as main.
# ALPHA IS PARALLEL (rayon par_iter): purity makes the map form
# data-parallel by construction - Backus 78's own thesis, honored at
# last. Sequential fallback under feature "seq" for parity debugging.
import io, json, sys

def rustr(v):
    # rust string literal: raw UTF-8 passthrough, escaping only the
    # structural characters (json's \uXXXX form is not rust's)
    out = v.replace("\\", "\\\\").replace('"', '\\"')
    out = out.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
    return '"' + out + '"'

CANON = r"C:\Users\lippe\Repos\arest\arest"
APP = sys.argv[1] if len(sys.argv) > 1 else "sherlock"
BASE = r"C:\Users\lippe\Repos\arest"
DS = BASE + (r"\tools\norma-oracle\design-state" if APP == "base" else r"\apps\%s\design-state" % APP)
NA = BASE + (r"\tools\norma-oracle\norma-answer" if APP == "base" else r"\apps\%s\norma-answer" % APP)
JR = BASE + (r"\tools\norma-oracle\journal" if APP == "base" else r"\apps\%s\journal" % APP)
OUTDIR = BASE + r"\tools\rust-runner"

env = {}
exec(io.open("mu_bench_head.py", encoding="utf-8").read(), env)
eval(compile(io.open(CANON, encoding="utf-8").read(), CANON, "eval"), env)
CANON_DEFS = dict(env["DEFS"])  # forms only - carriers below are DATA
for p in (DS, NA):
    eval(compile(io.open(p, encoding="utf-8").read(), p, "eval"), env)
jr = io.open(JR, encoding="utf-8").read().strip()
if jr:
    eval(compile("(\"journal\"" + jr + ")", JR, "eval"), env)
DEFS = CANON_DEFS
CELLS = env["CELLS"]

names = sorted(DEFS.keys())
fid = {n: "d%d" % i for i, n in enumerate(names)}

def rlit(v):
    if isinstance(v, tuple):
        return "s(vec![" + ",".join(rlit(e) for e in v) + "])"
    if isinstance(v, int):
        return "V::N(%d)" % v
    return "a(%s)" % rustr(v)

konsts = []
tmpn = [0]

def fresh():
    tmpn[0] += 1
    return "_t%d" % tmpn[0]

def emit_anf(t, x, out):
    # ANF: every subexpression binds a temporary; expression depth is
    # bounded by the source's COND nesting alone (rustc's stack died
    # twice on node-count depth - never again)
    if isinstance(t, int):
        v = fresh(); out.append("let %s = sel(%s,%d);" % (v, x, t)); return v
    if isinstance(t, str):
        v = fresh()
        if t in fid:
            out.append("let %s = %s(&%s);" % (v, fid[t], x) if not x.startswith("&") else "let %s = %s(%s);" % (v, fid[t], x))
        else:
            out.append("let %s = prim(%s,%s);" % (v, rustr(t), x if x.startswith("&") else "&" + x))
        return v
    h = t[0]
    if h == "CONST":
        konsts.append(t[1])
        v = fresh(); out.append("let %s = KONSTS[%d].clone();" % (v, len(konsts) - 1)); return v
    if h == "COMP":
        cur = x
        for part in reversed(t[1:]):
            cur = "&" + emit_anf(part, cur, out)
        v = fresh(); out.append("let %s = %s.clone();" % (v, cur.lstrip("&"))); return v
    if h == "CONS":
        parts = [emit_anf(p2, x, out) for p2 in t[1:]]
        v = fresh()
        out.append("let %s = s(vec![%s]);" % (v, ",".join(p2 + ".clone()" for p2 in parts)))
        return v
    if h == "COND":
        pv = emit_anf(t[1], x, out)
        v = fresh()
        tb, eb = [], []
        tv = emit_anf(t[2], x, tb)
        ev2 = emit_anf(t[3], x, eb)
        out.append("let %s = if is_t(&%s) { %s %s } else { %s %s };" % (
            v, pv, " ".join(tb), tv, " ".join(eb), ev2))
        return v
    if h == "ALPHA":
        b = []
        bv = emit_anf(t[1], "_e", b)
        v = fresh()
        out.append("let %s = alpha(%s,|_e| { %s %s });" % (
            v, x if x.startswith("&") else "&" + x, " ".join(b), bv))
        return v
    if h == "INSERT":
        b = []
        bv = emit_anf(t[1], "&_ab", b)
        v = fresh()
        out.append("let %s = foldr(%s,|_a,_b| { let _ab = pair(_a,_b); %s %s });" % (
            v, x if x.startswith("&") else "&" + x, " ".join(b), bv))
        return v
    if h == "WHILE":
        pb, fb = [], []
        pv = emit_anf(t[1], "_v", pb)
        fv = emit_anf(t[2], "_v", fb)
        v = fresh()
        out.append("let %s = wh(%s,|_v| { %s %s },|_v| { %s %s });" % (
            v, x if x.startswith("&") else "&" + x,
            " ".join(pb), pv, " ".join(fb), fv))
        return v
    raise AssertionError("form %r" % (h,))

def flat_enc(v, out):
    # postorder flat stream: children first, then the node
    if isinstance(v, tuple):
        for e in v: flat_enc(e, out)
        out.append("s%d" % len(v))
    elif isinstance(v, int):
        out.append("n%d" % v)
    else:
        out.append("a" + v.replace("%", "%25").replace(chr(10), "%0A").replace(chr(13), "%0D"))

bodies = []
for n in names:
    stmts = []
    rv = emit_anf(DEFS[n], "x", stmts)
    bodies.append("fn %s(x:&V)->V{ %s %s }" % (fid[n], " ".join(stmts), rv))

HEAD = r'''
// GENERATED by transform_rust.py - the procedural projection, rust
// target. ALPHA is PARALLEL (rayon): purity makes the map form
// data-parallel by construction. The strict refusals panic with the
// same conditions the mu names; the printed atoms are the contract.
use std::sync::Arc;
use rayon::prelude::*;
use once_cell::sync::Lazy;

#[derive(Clone, Debug)]
pub enum V { A(Arc<str>), N(i64), S(Arc<Vec<V>>) }

fn a(s: &str) -> V { V::A(Arc::from(s)) }
fn s(v: Vec<V>) -> V { V::S(Arc::new(v)) }
fn pair(x: &V, y: &V) -> V { s(vec![x.clone(), y.clone()]) }
fn is_t(x: &V) -> bool { matches!(x, V::A(s) if &**s == "T") }
fn boolean(b: bool) -> V { a(if b { "T" } else { "F" }) }
fn seq<'a>(x: &'a V) -> &'a [V] {
    match x { V::S(v) => v, _ => panic!("expected sequence, got atom") }
}
fn sel(x: &V, n: usize) -> V {
    let a = seq(x);
    if n < 1 || n > a.len() { panic!("selector {} out of range {}", n, a.len()); }
    a[n - 1].clone()
}
fn alpha<F: Fn(&V) -> V + Sync + Send>(x: &V, f: F) -> V {
    let a = seq(x);
    s(a.par_iter().map(|e| f(e)).collect())
}
fn foldr<F: Fn(&V, &V) -> V>(x: &V, f: F) -> V {
    let a = seq(x);
    if a.is_empty() { panic!("INSERT on empty"); }
    let mut acc = a[a.len() - 1].clone();
    for i in (0..a.len() - 1).rev() { acc = f(&a[i], &acc); }
    acc
}
fn wh<P: Fn(&V) -> V, F: Fn(&V) -> V>(x: &V, p: P, f: F) -> V {
    let mut v = x.clone();
    while is_t(&p(&v)) { v = f(&v); }
    v
}
fn deep_eq(x: &V, y: &V) -> bool {
    match (x, y) {
        (V::A(a), V::A(b)) => a == b,
        (V::N(a), V::N(b)) => a == b,
        (V::S(a), V::S(b)) => a.len() == b.len()
            && a.iter().zip(b.iter()).all(|(p, q)| deep_eq(p, q)),
        _ => false,
    }
}
fn cmp_atoms(x: &V, y: &V) -> std::cmp::Ordering {
    match (x, y) {
        (V::N(a), V::N(b)) => a.cmp(b),
        (V::A(a), V::A(b)) => a.as_bytes().cmp(b.as_bytes()),
        _ => panic!("compare across atom kinds"),
    }
}
fn need_str<'a>(x: &'a V) -> &'a str {
    match x { V::A(s) => s, _ => panic!("expected string atom") }
}
fn need_int(x: &V) -> i64 {
    match x { V::N(n) => *n, _ => panic!("expected number") }
}
fn show(x: &V) -> String {
    match x {
        V::A(s) => s.to_string(),
        V::N(n) => n.to_string(),
        V::S(v) => format!("[{}]", v.iter().map(show).collect::<Vec<_>>().join(",")),
    }
}
fn decode_many(data: &str) -> Vec<V> {
    // flat postorder stream: aTEXT / nINT / sCOUNT build with an
    // explicit stack; a line of just "!" seals one value
    let mut stack: Vec<V> = Vec::new();
    let mut out: Vec<V> = Vec::new();
    for line in data.split('\n') {
        if line == "!" { out.push(stack.pop().expect("seal on empty")); continue; }
        if line.is_empty() { continue; }
        let (k, rest) = line.split_at(1);
        match k {
            "a" => stack.push(a(&rest.replace("%0A", "\n").replace("%0D", "\r").replace("%25", "%"))),
            "n" => stack.push(V::N(rest.parse().expect("bad int"))),
            "s" => { let c: usize = rest.parse().expect("bad count");
                let at = stack.len() - c;
                let items = stack.split_off(at);
                stack.push(s(items)); }
            _ => panic!("bad stream line"),
        }
    }
    if !stack.is_empty() { out.push(stack.pop().unwrap()); }
    out
}
fn prim(name: &str, x: &V) -> V {
    match name {
        "id" => x.clone(),
        "tl" => { let a = seq(x); if a.is_empty() { panic!("tl on empty"); } s(a[1..].to_vec()) }
        "atom" => boolean(!matches!(x, V::S(_))),
        "apndl" => { let p = seq(x); let mut v = vec![p[0].clone()]; v.extend_from_slice(seq(&p[1])); s(v) }
        "apndr" => { let p = seq(x); let mut v = seq(&p[0]).to_vec(); v.push(p[1].clone()); s(v) }
        "distl" => { let p = seq(x); s(seq(&p[1]).iter().map(|e| pair(&p[0], e)).collect()) }
        "distr" => { let p = seq(x); s(seq(&p[0]).iter().map(|e| pair(e, &p[1])).collect()) }
        "cat" => { let p = seq(x); let mut v = seq(&p[0]).to_vec(); v.extend_from_slice(seq(&p[1])); s(v) }
        "null" => boolean(matches!(x, V::S(v) if v.is_empty())),
        "eq" => { let p = seq(x); boolean(deep_eq(&p[0], &p[1])) }
        "not" => boolean(!is_t(x)),
        "and" => { let p = seq(x); boolean(is_t(&p[0]) && is_t(&p[1])) }
        "length" => V::N(seq(x).len() as i64),
        "le" => { let p = seq(x); boolean(cmp_atoms(&p[0], &p[1]) != std::cmp::Ordering::Greater) }
        "ge" => { let p = seq(x); boolean(cmp_atoms(&p[0], &p[1]) != std::cmp::Ordering::Less) }
        "gt" => { let p = seq(x); boolean(cmp_atoms(&p[0], &p[1]) == std::cmp::Ordering::Greater) }
        "+" => { let p = seq(x); V::N(need_int(&p[0]) + need_int(&p[1])) }
        "-" => { let p = seq(x); V::N(need_int(&p[0]) - need_int(&p[1])) }
        "*" => { let p = seq(x); V::N(need_int(&p[0]) * need_int(&p[1])) }
        "/" => { let p = seq(x); let b = need_int(&p[1]); if b == 0 { panic!("division by zero"); } V::N(need_int(&p[0]) / b) }
        "apply" => { let p = seq(x); ev(&p[0], &p[1]) }
        "lex" => { s(need_str(x).split_whitespace().map(|w| a(w)).collect()) }
        "implode" => { let p = seq(x); let sepr = need_str(&p[0]);
            let words: Vec<&str> = seq(&p[1]).iter().map(|w| match w { V::A(s) => &**s, _ => panic!("implode on non-string") }).collect();
            a(&words.join(sepr)) }
        "slug" => { a(&need_str(x).to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>()) }
        "escape_html" => { a(&need_str(x).replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")) }
        "strip_prefix" => { let p = seq(x); let pre = need_str(&p[0]); let t = need_str(&p[1]);
            if t.len() > pre.len() && t.starts_with(pre) { a(&t[pre.len()..]) } else { p[1].clone() } }
        "ntoa" => { a(&need_int(x).to_string()) }
        "quote_str" => { let t = need_str(x);
            a(&format!("\"{}\"", t.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r"))) }
        "1r" => { let v = seq(x); if v.is_empty() { panic!("1r on empty"); } v[v.len() - 1].clone() }
        "tlr" => { let v = seq(x); if v.is_empty() { panic!("tlr on empty"); } s(v[..v.len() - 1].to_vec()) }
        _ => panic!("unresolved atom: {}", name),
    }
}
// the rho-fallback: terms arriving as DATA tree-walk here; DEF names
// dispatch compiled through TABLE
fn ev(f: &V, x: &V) -> V {
    match f {
        V::N(n) => sel(x, *n as usize),
        V::A(name) => {
            if let Some(func) = table(name) { return func(x); }
            prim(name, x)
        }
        V::S(form) => {
            let head = match &form[0] { V::A(s) => &**s, _ => panic!("unknown form") };
            match head {
                "COMP" => { let mut v = x.clone(); for part in form[1..].iter().rev() { v = ev(part, &v); } v }
                "CONS" => s(form[1..].iter().map(|p| ev(p, x)).collect()),
                "CONST" => form[1].clone(),
                "COND" => if is_t(&ev(&form[1], x)) { ev(&form[2], x) } else { ev(&form[3], x) },
                "ALPHA" => { let a2 = seq(x); s(a2.iter().map(|e| ev(&form[1], e)).collect()) }
                "INSERT" => { let a2 = seq(x); if a2.is_empty() { panic!("INSERT on empty"); }
                    let mut acc = a2[a2.len() - 1].clone();
                    for i in (0..a2.len() - 1).rev() { acc = ev(&form[1], &pair(&a2[i], &acc)); } acc }
                "WHILE" => { let mut v = x.clone(); while is_t(&ev(&form[1], &v)) { v = ev(&form[2], &v); } v }
                _ => panic!("unknown form: {}", head),
            }
        }
    }
}
'''

TAIL = r'''
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let argv = s(args.iter().map(|w| a(w)).collect());
    let store = CELLS.clone();
    let out = ev(&a("main"), &s(vec![store, argv]));
    let o = seq(&out);
    print!("{}\n", need_str(&o[0]));
    std::process::exit(if is_t(&o[1]) { 0 } else { 1 });
}
'''

table_arms = "\n".join('        "%s" => Some(%s),' % (n.replace('"', '\\"'), fid[n]) for n in names)
konst_stream = []
for v in konsts:
    flat_enc(v, konst_stream)
    konst_stream.append("!")
cells_stream = []
flat_enc(tuple(tuple(c) for c in CELLS), cells_stream)
NL = chr(10)
konst_lines = ("static KONST_DATA: &str = " + rustr(NL.join(konst_stream))
    + ";" + NL + "static KONSTS: Lazy<Vec<V>> = Lazy::new(|| decode_many(KONST_DATA));")
cells_lit = ("static CELLS_DATA: &str = " + rustr(NL.join(cells_stream))
    + ";" + NL + "static CELLS: Lazy<V> = Lazy::new(|| { let mut v = decode_many(CELLS_DATA); v.pop().expect(\"empty cells\") });")

src = (HEAD
    + "\nfn table(name: &str) -> Option<fn(&V) -> V> {\n    match name {\n"
    + table_arms
    + "\n        _ => None,\n    }\n}\n\n"
    + konst_lines + "\n\n"
    + "\n".join(bodies) + "\n\n"
    + cells_lit + "\n"
    + TAIL)

import os
os.makedirs(OUTDIR + r"\src", exist_ok=True)
io.open(OUTDIR + r"\Cargo.toml", "w", encoding="utf-8", newline="\n").write(
"""[package]
name = "arest-proc"
version = "0.1.0"
edition = "2021"

[dependencies]
rayon = "1.10"
once_cell = "1.19"

[profile.release]
opt-level = 3
""")
io.open(OUTDIR + r"\src\main.rs", "w", encoding="utf-8", newline="\n").write(src)
print("emitted rust crate: %d defs, %d consts, cells for %s" % (len(names), len(konsts), APP))
