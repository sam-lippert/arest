"""The compile CONTEXT as a canonical object, twinned against the host.

system:ctx_of ⟨store⟩ → ⟨names, edges, fts, vals⟩: the known context a model
compiles ATOP, read straight off the store — declared type names, subtype
edges, fact-type slugs, and the value-type subset. system:ctx_subject
⟨words-of-reading, word-sequences-of-known-names⟩ → the leading declared
Object Type, longest match first, else the first word.

compiler._context_of and compiler._subject are the behavioral specs and become
thin callers; the metamodel corpus is the twin oracle — the same shape
test_clause_canon.py uses for system:clause_ft.

Written after the fact: both were first verified by throwaway scripts in a job
scratch directory, which is verification that disappears. A twin oracle has to
live in the repo and run in CI, or the certification is a claim rather than a
check.
"""
import pyarest.prims  # noqa: F401
from pyarest.lam import atom as A, to_lam, from_lam
from pyarest.reduce import apply
from pyarest import compiler, meta


def _norm(xs):
    return sorted(set(tuple(e) if isinstance(e, (tuple, list)) else e
                      for e in xs))


def test_ctx_of_twins_context_of_over_the_metamodel_store():
    D, _ = meta.M_store()
    h_names, h_edges, h_fts, h_vals = compiler._context_of(D)
    c_names, c_edges, c_fts, c_vals = from_lam(apply(A("system:ctx_of"), D))
    assert _norm(c_names) == _norm(h_names)
    assert _norm(c_edges) == _norm(h_edges)
    assert _norm(c_fts) == _norm(h_fts)
    assert _norm(c_vals) == _norm(h_vals)


def test_ctx_subject_twins_subject_over_every_metamodel_statement():
    D, _ = meta.M_store()
    names, _e, _f, _v = compiler._context_of(D)
    known = set(names)
    text = compiler.M_readings()
    if isinstance(text, tuple):
        text = text[0]
    KS = tuple(tuple(k.split()) for k in known)
    checked = 0
    for s in compiler.statements(text):
        W = tuple(s.split())
        if not W:
            continue
        host, _rest = compiler._subject(s, known)
        got = from_lam(apply(A("system:ctx_subject"), to_lam((W, KS))))
        assert " ".join(got) == host, (s, host, got)
        checked += 1
    assert checked > 1000, "the corpus should exercise this heavily: %d" % checked


def test_ctx_of_pins_survive_the_switchover():
    """PINS, not a twin comparison. Once _context_of delegates to
    system:ctx_of the twin test above compares canon to itself and proves
    nothing — every switchover turns its own oracle into a tautology. These
    assertions hold against canon alone.

    Deliberately structural rather than count-based: exact cardinalities
    (194/104/335/87 at the time of writing) would fail on any honest
    metamodel edit, which trains people to update the pin instead of reading
    the failure.
    """
    D, _ = meta.M_store()
    names, edges, fts, vals = from_lam(apply(A("system:ctx_of"), D))
    names, vals, fts = set(names), set(vals), set(fts)

    # the metaschema describes itself (Halpin 13.7): its own vocabulary is
    # present in the context it computes
    for n in ("Object Type", "Fact Type", "Role", "Constraint"):
        assert n in names, n

    # a value type is an object type; the subset is proper (entity types exist)
    assert vals <= names
    assert vals != names

    # fact-type slugs are underscore-joined names, never spaced readings
    spaced = [f for f in fts if " " in str(f)]
    assert not spaced, spaced[:5]

    # subtype edges are pairs, and both ends are declared object types
    for a, b in list(edges)[:50]:
        assert a in names and b in names, (a, b)


def test_ctx_subject_falls_back_to_the_first_word():
    """The branch that cost 203 of the first 400 statements when it was
    missing: INSERT over an empty candidate list is an error, so a reading
    whose leading words are no declared type must answer its first word."""
    got = from_lam(apply(A("system:ctx_subject"),
                         to_lam((("For", "each", "Widget"), (("Gadget",),)))))
    assert " ".join(got) == "For"


def test_ctx_subject_prefers_the_longest_declared_name():
    """'State Machine Definition has ...' must not truncate to the declared
    prefix 'State Machine' — the host sorts by descending length for this
    reason; canon folds with system:ctx_longer instead."""
    W = ("State", "Machine", "Definition", "has", "Name")
    KS = (("State", "Machine"), ("State", "Machine", "Definition"))
    got = from_lam(apply(A("system:ctx_subject"), to_lam((W, KS))))
    assert " ".join(got) == "State Machine Definition"
