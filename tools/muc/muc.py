# -*- coding: utf-8 -*-
# muc — the μ COMPILER: the first Futamura projection of the strict μ over
# the canon. Ev(f, x) with f static specializes into one Rust function per
# DEF: COMP becomes call sequencing, COND becomes `if`, ALPHA/INSERT/WHILE
# become loops, selectors become bounds-checked indexing, and every name
# resolves at generation time. The compiler is MECHANICAL and NAME-BLIND:
# it treats every DEF identically, embeds no law semantics, and preserves
# the strictness contract exactly — an unresolved atom or unknown form in
# function position compiles to a die-stub that panics IF EVALUATED (dead
# branches die only when taken, exactly as under the μ).
#
# Input is the same bytes every station composes: the canon and the two
# carriers, each one tuple literal. They are LOADED with the py-runner's
# own vocabulary (the canon is a normal Python module — the seventh
# station's proof), then walked structurally:
#   - every constant (CONST payloads, the store's own cell terms) interns
#     once into a generation-time-deduplicated pool;
#   - every DEF body compiles to fn d<i>(x, rt);
#   - an atom-id -> fn table makes compiled DEFs reachable from ev_dyn,
#     the small interpretive μ that `apply` keeps (the Lisp coexistence).
#
# The certifier is the seven interpretive stations: byte-identical verdicts
# on every store and identical flips under the mutation trial. Step 2
# (not here): the algebra-of-programs identities as canon-registered
# rewrites ahead of codegen.
#
#   python muc.py <arest> <design-state> <norma-answer> <out.rs>
import io
import os
import sys

PRIMS = {
    "id": "p_id", "tl": "p_tl", "atom": "p_atom", "apndl": "p_apndl",
    "apndr": "p_apndr", "distl": "p_distl", "distr": "p_distr",
    "cat": "p_cat", "null": "p_null", "eq": "p_eq", "not": "p_not",
    "and": "p_and", "length": "p_length", "le": "p_le", "ge": "p_ge",
    "gt": "p_gt", "+": "p_plus", "apply": "p_apply", "lex": "p_lex",
    "implode": "p_implode", "slug": "p_slug", "escape_html": "p_escape_html",
    "strip_prefix": "p_strip_prefix", "1r": "p_1r", "tlr": "p_tlr",
}
FORMS = {"COMP", "CONS", "CONST", "COND", "ALPHA", "INSERT", "WHILE"}

# ---- load the three tuples with the py-runner vocabulary -------------------
def load_cells(paths):
    cells = []
    defs = {}
    def DEF(name, body):
        if name in defs:
            raise SystemExit("duplicate DEF: " + name)
        defs[name] = body
        cells.append(("CELL", name, body))
        return name
    env = {
        "DEF": DEF, "A": lambda s: s, "N": lambda n: n,
        "K": lambda x: ("CONST", x), "PHI": lambda: (),
    }
    for k in range(1, 10):
        env["S%d" % k] = (lambda *xs: xs)
    for p in paths:
        with io.open(p, "r", encoding="utf-8") as f:
            eval(compile(f.read(), p, "eval"), env)
    return cells, defs

# ---- Rust string literal ---------------------------------------------------
def rs(s):
    out = s.replace("\\", "\\\\").replace('"', '\\"')
    out = out.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
    return '"' + out + '"'

# ---- the generation-time-deduplicated constant pool ------------------------
class Pool(object):
    def __init__(self):
        self.memo = {}
        self.stmts = []
    def idx(self, t):
        key = ("t", t)
        if key in self.memo:
            return self.memo[key]
        if isinstance(t, tuple):
            elems = [self.idx(e) for e in t]
            refs = ", ".join("rt.pool[%d]" % i for i in elems)
            self.stmts.append("let v = rt.seq(&[%s]); rt.pool.push(v);" % refs)
        elif isinstance(t, int):
            self.stmts.append("rt.pool.push(V::I(%d));" % t)
        else:
            self.stmts.append("let v = rt.atom(%s); rt.pool.push(v);" % rs(t))
        i = len(self.memo)
        self.memo[key] = i
        return i

# ---- function-position compilation ----------------------------------------
class Gen(object):
    def __init__(self, defs, pool):
        self.defs = defs
        self.pool = pool
        self.def_fn = {}
        for i, name in enumerate(defs):
            self.def_fn[name] = "d%d" % i
        self.tmp = 0

    def fresh(self):
        self.tmp += 1
        return "v%d" % self.tmp

    def block(self, t, x):
        # a Rust block expression evaluating term t on input expression x
        lines = []
        e = self.emit(t, x, lines)
        body = "\n        ".join(lines + [e])
        return "{\n        %s\n    }" % body

    def emit(self, t, x, lines):
        # appends statements to lines, returns the result EXPRESSION (a var)
        if isinstance(t, int):
            v = self.fresh()
            lines.append("let %s = sel(rt, %s, %d);" % (v, x, t))
            return v
        if isinstance(t, str):
            v = self.fresh()
            if t in self.def_fn:
                lines.append("let %s = %s(%s, rt);" % (v, self.def_fn[t], x))
            elif t in PRIMS:
                lines.append("let %s = %s(%s, rt);" % (v, PRIMS[t], x))
            else:
                lines.append("let %s: V = die(%s);" % (v, rs("unresolved atom: " + t)))
            return v
        head = t[0] if len(t) > 0 else None
        if not isinstance(head, str) or head not in FORMS:
            v = self.fresh()
            shown = head if isinstance(head, str) else "<empty>" if head is None else repr(head)
            lines.append("let %s: V = die(%s);" % (v, rs("unknown form: " + shown)))
            return v
        if head == "COMP":
            v = x
            for i in range(len(t) - 1, 0, -1):
                v = self.emit(t[i], v, lines)
            return v
        if head == "CONS":
            elems = [self.emit(e, x, lines) for e in t[1:]]
            v = self.fresh()
            lines.append("let %s = rt.seq(&[%s]);" % (v, ", ".join(elems)))
            return v
        if head == "CONST":
            v = self.fresh()
            lines.append("let %s = rt.pool[%d];" % (v, self.pool.idx(t[1])))
            return v
        if head == "COND":
            c = self.emit(t[1], x, lines)
            v = self.fresh()
            lines.append("let %s = if is_t(rt, %s) %s else %s;"
                         % (v, c, self.block(t[2], x), self.block(t[3], x)))
            return v
        if head == "ALPHA":
            xs, out, v = self.fresh(), self.fresh(), self.fresh()
            lines.append("let %s = rt.items_vec(%s);" % (xs, x))
            lines.append("let mut %s = Vec::with_capacity(%s.len());" % (out, xs))
            lines.append("for &e in %s.iter() { let r = %s; %s.push(r); }"
                         % (xs, self.block(t[1], "e"), out))
            lines.append("let %s = rt.seq(&%s);" % (v, out))
            return v
        if head == "INSERT":
            xs, acc = self.fresh(), self.fresh()
            lines.append("let %s = rt.items_vec(%s);" % (xs, x))
            lines.append('if %s.is_empty() { die("INSERT on empty"); }' % xs)
            lines.append("let mut %s = %s[%s.len() - 1];" % (acc, xs, xs))
            lines.append("for i in (0..%s.len() - 1).rev() { let pair = rt.seq(&[%s[i], %s]); %s = %s; }"
                         % (xs, xs, acc, acc, self.block(t[1], "pair")))
            return acc
        if head == "WHILE":
            v = self.fresh()
            lines.append("let mut %s = %s;" % (v, x))
            lines.append("loop { let c = %s; if !is_t(rt, c) { break; } %s = %s; }"
                         % (self.block(t[1], v), v, self.block(t[2], v)))
            return v
        raise AssertionError("unhandled form " + head)

def slices(stmts, prefix, args, argvals, limit=800):
    # group statements into functions of at most `limit` statements
    fns = []
    calls = []
    for k in range(0, max(len(stmts), 1), limit):
        group = stmts[k:k + limit]
        name = "%s%d" % (prefix, len(fns))
        fns.append("fn %s(%s) {\n    %s\n}" % (name, args, "\n    ".join(group)))
        calls.append("%s(%s);" % (name, argvals))
    return fns, calls

def main():
    arest, ds, na, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    cells, defs = load_cells([arest, ds, na])
    pool = Pool()
    gen = Gen(defs, pool)

    # compile every DEF body (pool fills as CONST payloads are met)
    def_fns = []
    for i, (name, body) in enumerate(defs.items()):
        blk = gen.block(body, "x")
        def_fns.append("// %s\nfn d%d(x: V, rt: &mut Rt) -> V %s" % (name, i, blk))

    # the composed store itself, as one pooled term
    store_idx = pool.idx(tuple(cells))

    # the atom-id -> compiled-fn table (ev_dyn's DEFS resolution)
    table_stmts = []
    for i, name in enumerate(defs):
        table_stmts.append(
            "let id = rt.atom_id(%s) as usize; "
            "if rt.table.len() <= id { rt.table.resize(id + 1, None); } "
            "rt.table[id] = Some(d%d as fn(V, &mut Rt) -> V);" % (rs(name), i))

    pool_fns, pool_calls = slices(pool.stmts, "b", "rt: &mut Rt", "&mut rt")
    table_fns, table_calls = slices(table_stmts, "t", "rt: &mut Rt", "&mut rt")

    head = io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rt.part.rs"),
                   "r", encoding="utf-8").read()

    base_fn = gen.def_fn.get("law:report")
    app_fn = gen.def_fn.get("law:app_report")
    if base_fn is None or app_fn is None:
        raise SystemExit("canon must DEF law:report and law:app_report")

    src = [head.rstrip("\n"), ""]
    src.append("// GENERATED below this line by muc.py — see its header. One fn per")
    src.append("// DEF, a deduplicated constant pool, the store as a pooled term.")
    src.append("")
    src.extend(pool_fns)
    src.extend(table_fns)
    src.extend(def_fns)
    src.append("""
fn run() {
    let mut rt = Rt::new();
    rt.pool.reserve(%(npool)d);
    %(pool_calls)s
    %(table_calls)s
    let store = rt.pool[%(store)d];
    let args: Vec<String> = std::env::args().collect();
    let app = args.len() > 1 && args[1] == "app";
    let code = if app {
        run_report(&mut rt, store, %(app_fn)s, "law:app_report")
    } else {
        run_report(&mut rt, store, %(base_fn)s, "law:report")
    };
    std::process::exit(code);
}

fn main() {
    std::thread::Builder::new().stack_size(512 * 1024 * 1024).spawn(run).unwrap().join().unwrap();
}
""" % {"npool": len(pool.memo), "pool_calls": "\n    ".join(pool_calls),
       "table_calls": "\n    ".join(table_calls), "store": store_idx,
       "app_fn": app_fn, "base_fn": base_fn})

    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(src) + "\n")
    print("muc: %d defs compiled, %d pooled constants, %d pool slices, store at pool[%d]"
          % (len(defs), len(pool.memo), len(pool_fns), store_idx))

if __name__ == "__main__":
    main()
