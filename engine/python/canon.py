"""The Python binding of the INTERSECTION SOURCE vocabulary (shared/*.py),
the repo's layout, and Codd's theta1 bindings (merged from paths.py and
theta.canon, 2026-07-04, the fewer-files push: one module owns how shared
sources are FOUND, LOADED, and NAMED from Python).

An intersection file is normal Python and normal Rust verbatim: statements of nested
calls over the vocabulary DEF, A, N, PHI, S2..S9, semicolon-terminated, double-quoted
strings only, no imports, no assignments, no host functions. Each platform defines
the vocabulary and consumes the same bytes; here Python's exec binds it (the lambda
used determines the implementation), the Rust host include!s the identical file into
a function whose scope defines the same names, and the C# and Java hosts wrap the same
bytes in a varargs method. Definitions land in DEFS as compiled objects and reference
each other by name through rho, so per-host OPTIMIZATIONS (delta, FAST, native) remain
DEFS registrations over the same names."""
import hashlib
import marshal
import os

from . import defs
from .lam import atom as _atom, PHI as _PHI
from . import lam as L


# --- repo layout (from paths.py): the polyglot monorepo is shared/ (canonical
# cross-host sources), python/ (this host), rust/, csharp/, java/. Hosts locate
# the shared sources and each other through the repo root, never through their
# own package position. ---
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def root():
    return _ROOT


# THE canon is ONE file at the REPO ROOT, named `arest`. It is not in shared/ and
# is not copied there: engine/shared/arest.canon was a CURATED SUBSET carrying 362
# DEFs against canon's 1153, and the 18 names the MCP host resolves -- actions ask
# cells create csdp derive explain get induce lt nav propose query retract rmap
# schema validate verify -- were ALL among the missing. Layer 1's resolution order
# (prim -> process -> canon -> bottom) therefore ended in bottom for the MCP's own
# verb table, so the host's match arms were the only copy that ran. See #88.
_CANON = "arest.canon"


def shared(name):
    """A canonical shared source file (readings any host ingests).

    The canonical name `arest.canon` resolves to the repo-root canon; every other
    intersection file lives in shared/. Redirecting HERE rather than at the call
    sites is deliberate: read(), read_native() and load() all funnel through this
    one function, so canon.py keeps owning "how shared sources are FOUND"."""
    if name == _CANON:
        return os.path.join(os.path.dirname(_ROOT), "arest")
    return os.path.join(_ROOT, "shared", name)


def rust_bin(name):
    return os.path.join(_ROOT, "rust", "target", "release",
                        name + (".exe" if os.name == "nt" else ""))


def _S(*xs):
    l = L.NIL
    for x in reversed(xs):
        l = L.CONS(x)(l)
    return L.SEQ(l)


def vocabulary(out):
    v = {"PHI": lambda: _PHI, "A": _atom, "N": _atom,
         "K": lambda x: _S(_atom("CONST"), x),
         "DEF": lambda name, obj: out.append((name, obj))}
    for k in range(1, 10):
        def _sk(*xs, _k=k):
            if len(xs) != _k:
                raise TypeError("S%d takes %d arguments, got %d" % (_k, _k, len(xs)))
            return _S(*xs)
        v["S%d" % k] = _sk
    return v


def vocabulary_native(out):
    """The THIRD consumer of the intersection files (stratum 2 of the polyglot
    debug): the same names building the delta evaluator's carrier directly — a
    scalar IS an atom, a tuple IS a sequence — so definition resolution on the
    fast path can skip the Scott boundary entirely. Faithfulness is pinned by
    the differential against scott_to_native of the canonical load."""
    v = {"PHI": lambda: (), "A": lambda x: x, "N": lambda x: x,
         "K": lambda x: ("CONST", x),
         "DEF": lambda name, obj: out.append((name, obj))}
    for k in range(1, 10):
        def _sk(*xs, _k=k):
            if len(xs) != _k:
                raise TypeError("S%d takes %d arguments, got %d" % (_k, _k, len(xs)))
            return tuple(xs)
        v["S%d" % k] = _sk
    return v


_CODE = {}


def _code(p):
    """The canon file's CODE OBJECT, compiled once per process and cached on disk.

    A canon file is executed as Python -- DEF, S3, A, N, K are callables -- so
    loading it means compile() over ~1.5MB, and CPython caches bytecode for
    imported modules but never for compile() of a string. It was paying that
    four times per process: load() reads the file under the Scott vocabulary
    and AGAIN under the native one, and the code object is identical both times
    because only the globals differ.

    Measured: 1.565s of builtins.compile in a 3.82s package init, which every
    pytest process pays before collecting a single test. The disk half is
    keyed on the file's own bytes, so a canon edit invalidates it and a stale
    hit is impossible; marshal is the same mechanism .pyc uses.
    """
    src = open(p, "rb").read()
    key = hashlib.sha256(src).hexdigest()
    got = _CODE.get(p)
    if got is not None and got[0] == key:
        return got[1]
    cache = os.path.join(os.path.dirname(os.path.abspath(p)), "__pycache__",
                         os.path.basename(p) + "." + key[:16] + ".marshal")
    code = None
    try:
        with open(cache, "rb") as f:
            code = marshal.loads(f.read())
    except Exception:
        code = None
    if code is None:
        code = compile(src.decode("utf-8"), p, "exec")
        try:
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            tmp = cache + ".%d" % os.getpid()
            with open(tmp, "wb") as f:
                marshal.dump(code, f)
            os.replace(tmp, cache)
        except Exception:
            pass
    _CODE[p] = (key, code)
    return code


_READ = {}


def _exec_once(p, vocab, tag):
    """Execute the canon file under one vocabulary, ONCE per process.

    Caching the code object stopped the recompiles; this stops the re-EXECUTION.
    The file was running four times per process -- load() reads it under both
    vocabularies and this module reads it again at import for the theta
    bindings -- and each Scott pass folds 120,018 CONS cells, which profiled as
    the largest remaining cost in the package init.

    The definitions are VALUES: immutable structure built out of atoms and
    sequences, with no per-caller state, so handing the same objects to a
    second caller is the same thing as building them again. Callers get their
    own list so appending to the result cannot corrupt the cache, and the key
    is the file's content hash, so an edit rebuilds.
    """
    src_key = hashlib.sha256(open(p, "rb").read()).hexdigest()
    hit = _READ.get((p, tag))
    if hit is not None and hit[0] == src_key:
        return list(hit[1])
    out = []
    exec(_code(p), vocab(out))
    _READ[(p, tag)] = (src_key, out)
    return list(out)


def read(name):
    """Collect a shared intersection file's definitions without registering them."""
    return _exec_once(shared(name), vocabulary, "scott")


def read_native(name):
    """Collect a shared file's definitions as delta-native objects (no Scott)."""
    return _exec_once(shared(name), vocabulary_native, "native")


def load(name="arest.canon"):
    """Consume a shared intersection file: exec under BOTH vocabularies, register
    each definition with its native twin (the fast path's store then skips the
    Scott boundary for canonical names). Returns the names, in file order."""
    pairs = read(name)
    npairs = dict(read_native(name))
    for n, obj in pairs:
        defs.define(n, obj, native_obj=npairs.get(n))
    return [n for n, _ in pairs]


def load_all():
    """Every intersection file, in dependency order (constraints, ast, and system
    reference theta; system's pipeline references ast)."""
    return load("arest.canon")


# --- Codd's adequate collection theta1 (Codd §2.2), from theta.canon: the Python
# BINDING of the canonical definitions in shared/theta.canon. The closed objects
# here ARE the canon values, loaded from the shared file; the parameterized
# constructors APPLY the canonical builders through the reducer (canon boots
# with the package, so the names resolve). Nothing is defined twice: this half
# binds, it does not author. "Navigation needs no separate query language" —
# each operator is a rho-application over the population P. ---
_C = dict(read("arest.canon"))                                  # the shared file, verbatim

member = _C["theta:member"]
dedup = _C["theta:dedup"]
flatten = _C["theta:flatten"]
setminus = _C["theta:setminus"]
Tie = _C["theta:Tie"]


def Filter(p):
    """Codd selection sigma_p: the canonical builder applied to p (shared/theta.canon)."""
    from .lam import atom as A
    from .reduce import apply as _apply
    return _apply(A("theta:Filter"), p)


def NatJoin(i):
    """Codd natural join R*S (§2.1.3), joining R.i = S.1: the canonical builder
    applied to the selector."""
    from .lam import atom as A
    from .reduce import apply as _apply
    return _apply(A("theta:NatJoin"), A(i))


def Project(cols):
    """Codd projection pi_L (§2.1.2): the canonical builder applied to the selector
    row ⟨c1..ck⟩."""
    from .lam import atom as A, to_lam
    from .reduce import apply as _apply
    return _apply(A("theta:Project"), to_lam(tuple(cols)))


def JoinOn(pairs, keep):
    """Codd's join (§2.1.3) in its general equi form: R ⋈ S on {R.ri = S.si} for the
    (ri, si) in `pairs`, emitting r ++ s[keep] (the fresh columns, in clause order).
    Empty `pairs` is the degenerate cross product; empty `keep` is the semijoin. The
    canonical COND-over-null builder applied to ⟨pairs, keep⟩ (shared/theta.canon).
        match   = eq∘[⟨ri…⟩∘1, ⟨si…⟩∘2]
        combine = cat∘[1, ⟨keep…⟩∘2]        (just 1 when keep is empty)
        R⋈S     = flatten ∘ α( α(combine) ∘ Filter(match) ∘ distl ) ∘ distr
    """
    from .lam import atom as A, to_lam
    from .reduce import apply as _apply
    return _apply(A("theta:JoinOn"),
                  to_lam((tuple(tuple(p) for p in pairs), tuple(keep))))


def Restrict(cols_L, cols_M):
    """Codd restriction R_{L|M}S (§2.1.5): the maximal R'⊆R with pi_L(R')=pi_M(S),
    over ⟨R, S⟩ — the semijoin keeping rows of R whose L-key occurs in pi_M(S). The
    canonical builder applied to ⟨L, M⟩ (shared/theta.canon).
        Restrict(L,M) = α(1) ∘ Filter(pi_L(r) ∈ pi_M(S)) ∘ distr ∘ [1, pi_M∘2]
    """
    from .lam import atom as A, to_lam
    from .reduce import apply as _apply
    return _apply(A("theta:Restrict"),
                  to_lam((tuple(cols_L), tuple(cols_M))))
