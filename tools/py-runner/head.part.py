# ============================================================================
# py-runner — the composed checker, Python PARITY station.
#
# A STRICT mu mirroring tools/cs-runner/{Vocabulary,Mu}.cs point for point
# (and the js, java, c, rust, and wasm stations, which mirror the same
# source): a selector on an atom dies, a selector out of range dies, a
# comparison across atom kinds dies, a duplicate DEF dies, an unresolved
# atom dies, tl/tlr/1r/INSERT on the empty sequence die (Backus 11.2.3:
# tl of the empty sequence is bottom). Booleans are the atoms "T" and "F".
# No law semantics live here — if a guard or a name list ever appears in
# this file, delete it; accretion is how the first two js runners died.
#
# The canon and the carriers appear AS SOURCE, and Python is the language
# the canon's opening docstring names outright: "this file is a normal
# Python module." Here that claim EXECUTES. The compose step is byte
# concatenation (cat/copy /b) and the join is NOTHING AT ALL — each tuple
# is a bare expression statement, evaluated left to right for its DEF side
# effects and discarded, because Python ends the statement at the closing
# parenthesis and a following newline (no ASI call hazard, no wrap, no
# linker). The zero-name join: even the "one extra name" is gone.
#
# Sequences are Python tuples (immutable), numbers are ints, atoms are
# strs. Python's == IS DeepEq (elementwise on tuples, cross-kind False,
# never a coercion); no bool is ever constructed, so bool-is-int never
# bites. One documented simplification shared with the c/rust stations:
# slug filters by str.isalnum (a hair wider than C#'s IsLetterOrDigit
# outside ASCII) and comparison is by code point where C#/Java/JS use
# UTF-16 code units. Every name and value the laws slug or sort is ASCII,
# where all orders coincide; the byte-identical cross-station verdicts are
# the standing check that this stays true.
# ============================================================================

class StrictError(Exception):
    pass

def die(msg):
    raise StrictError("STRICT: " + msg)

# ---- the registration vocabulary: DEF, A, N, K, PHI, S1..S9 ----------------
# DEF accumulates the composed store (one CELL per registered name) so the
# store reads itself; a duplicate dies by map semantics, exactly as the C#
# Dictionary.Add throws — law:one_name is the law.
DEFS = {}
CELLS = []

def DEF(name, body):
    if name in DEFS:
        die("duplicate DEF: " + name)
    DEFS[name] = body
    CELLS.append(("CELL", name, body))
    return name

def A(s): return s
def N(n): return n
def K(x): return ("CONST", x)
def PHI(): return ()
def S1(a): return (a,)
def S2(a, b): return (a, b)
def S3(a, b, c): return (a, b, c)
def S4(a, b, c, d): return (a, b, c, d)
def S5(a, b, c, d, e): return (a, b, c, d, e)
def S6(a, b, c, d, e, f): return (a, b, c, d, e, f)
def S7(a, b, c, d, e, f, g): return (a, b, c, d, e, f, g)
def S8(a, b, c, d, e, f, g, h): return (a, b, c, d, e, f, g, h)
def S9(a, b, c, d, e, f, g, h, i): return (a, b, c, d, e, f, g, h, i)

# ---- helpers: seq / at strictly mirror C# Seq(x) and Seq(x)[i] -------------
def seq(x):
    if not isinstance(x, tuple):
        die("expected sequence, got atom: " + repr(x))
    return x

def at(x, i):
    a = seq(x)
    if i < 0 or i >= len(a):
        die("index %d out of %d" % (i, len(a)))
    return a[i]

def boolean(b):
    return "T" if b else "F"

def is_T(x):
    return isinstance(x, str) and x == "T"

# CompareAtoms: both ints numeric; both strs ordinal (code point, equal to
# C#'s CompareOrdinal on ASCII); anything else DIES.
def cmp_atoms(a, b):
    if isinstance(a, int) and isinstance(b, int):
        return (a > b) - (a < b)
    if isinstance(a, str) and isinstance(b, str):
        return (a > b) - (a < b)
    die("compare across atom kinds: %r vs %r" % (a, b))

def need_str(x):
    if not isinstance(x, str):
        die("expected string atom: " + repr(x))
    return x

def need_int(x):
    if not isinstance(x, int):
        die("expected number atom: " + repr(x))
    return x

# ---- the base primitives: Backus 11.2.3 plus the registered boundary rows
# of resolution.md (lex, implode, slug, escape_html, strip_prefix, 1r, tlr).
def _tl(x):
    a = seq(x)
    if len(a) == 0: die("tl on empty")
    return a[1:]

def _apndl(x):
    return (at(x, 0),) + seq(at(x, 1))

def _apndr(x):
    return seq(at(x, 0)) + (at(x, 1),)

def _distl(x):
    h = at(x, 0)
    return tuple((h, e) for e in seq(at(x, 1)))

def _distr(x):
    t = at(x, 1)
    return tuple((e, t) for e in seq(at(x, 0)))

def _plus(x):
    return need_int(at(x, 0)) + need_int(at(x, 1))

def _lex(x):
    return tuple(need_str(x).split())

def _implode(x):
    sep = need_str(at(x, 0))
    return sep.join(need_str(w) for w in seq(at(x, 1)))

def _slug(x):
    return "".join(c for c in need_str(x).lower() if c.isalnum())

def _escape_html(x):
    return (need_str(x).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))

def _strip_prefix(x):
    pre = need_str(at(x, 0)); t = need_str(at(x, 1))
    return t[len(pre):] if len(t) > len(pre) and t.startswith(pre) else t

def _1r(x):
    a = seq(x)
    if len(a) == 0: die("1r on empty")
    return a[-1]

def _tlr(x):
    a = seq(x)
    if len(a) == 0: die("tlr on empty")
    return a[:-1]

PRIMS = {
    "id": lambda x: x,
    "tl": _tl,
    "atom": lambda x: boolean(not isinstance(x, tuple)),
    "apndl": _apndl,
    "apndr": _apndr,
    "distl": _distl,
    "distr": _distr,
    "cat": lambda x: seq(at(x, 0)) + seq(at(x, 1)),
    "null": lambda x: boolean(isinstance(x, tuple) and len(x) == 0),
    "eq": lambda x: boolean(at(x, 0) == at(x, 1)),
    "not": lambda x: boolean(not is_T(x)),
    "and": lambda x: boolean(is_T(at(x, 0)) and is_T(at(x, 1))),
    "length": lambda x: len(seq(x)),
    "le": lambda x: boolean(cmp_atoms(at(x, 0), at(x, 1)) <= 0),
    "ge": lambda x: boolean(cmp_atoms(at(x, 0), at(x, 1)) >= 0),
    "gt": lambda x: boolean(cmp_atoms(at(x, 0), at(x, 1)) > 0),
    "+": _plus,
    "apply": lambda x: Ev(at(x, 0), at(x, 1)),
    "lex": _lex,
    "implode": _implode,
    "slug": _slug,
    "escape_html": _escape_html,
    "strip_prefix": _strip_prefix,
    "1r": _1r,
    "tlr": _tlr,
}

# ---- the mu: atoms resolve through DEFS then the primitives, ints are
# selectors, tuples are the seven functional forms (COMP right-to-left,
# CONS, CONST, COND, ALPHA, INSERT as a right fold, WHILE). -----------------
def Ev(f, x):
    while True:
        if isinstance(f, int):
            if not isinstance(x, tuple):
                die("selector %d on atom: %r" % (f, x))
            if f < 1 or f > len(x):
                die("selector %d out of range %d" % (f, len(x)))
            return x[f - 1]
        if isinstance(f, str):
            if f in DEFS:
                f = DEFS[f]
                continue
            p = PRIMS.get(f)
            if p is None:
                die("unresolved atom: " + f)
            return p(x)
        form = seq(f)
        if len(form) == 0:
            die("unknown form: <empty>")
        h = form[0]
        if h == "COMP":
            v = x
            for i in range(len(form) - 1, 0, -1):
                v = Ev(form[i], v)
            return v
        if h == "CONS":
            return tuple(Ev(form[i], x) for i in range(1, len(form)))
        if h == "CONST":
            return form[1]
        if h == "COND":
            if is_T(Ev(form[1], x)):
                f = form[2]
            else:
                f = form[3]
            continue
        if h == "ALPHA":
            return tuple(Ev(form[1], e) for e in seq(x))
        if h == "INSERT":
            xs = seq(x)
            if len(xs) == 0:
                die("INSERT on empty")
            acc = xs[-1]
            for i in range(len(xs) - 2, -1, -1):
                acc = Ev(form[1], (xs[i], acc))
            return acc
        if h == "WHILE":
            v = x
            while is_T(Ev(form[1], v)):
                v = Ev(form[2], v)
            return v
        die("unknown form: " + (h if isinstance(h, str) else repr(h)))

# the canon's one tuple literal follows as a bare expression statement — the
# "normal Python module" of its own opening docstring, executing verbatim;
# DEF side effects populate CELLS in source order:
