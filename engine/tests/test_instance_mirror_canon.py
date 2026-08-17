"""The instance mirror IS canon, and the host copy is a checked twin.

THREE hosts held this derivation natively -- engine/rust inside op_run_rules,
engine/python inside run_rules, and nothing in canon -- while the pieces it
called out to (rmap:entities, rmap:rolegroups) were already canon. What stayed
native was the JOIN between them. derive:instance_mirror now carries it.

The host copies STAY, on a measurement rather than a preference: wiring rust's
site to the canon DEF is correct (the fixpoint test passes, so the store it
derives is right) and takes that test from 618s to 841s against a 900s budget.
A sanctioned twin is not drift -- but "sanctioned" has to mean something, so
this file runs both over a compiled model and compares. Without it, OVERRIDES
is a comment.
"""
import importlib.util
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if "pyarest" not in sys.modules:
    _spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(_ROOT, "python", "__init__.py"),
        submodule_search_locations=[os.path.join(_ROOT, "python")])
    _mod = importlib.util.module_from_spec(_spec)
    sys.modules["pyarest"] = _mod
    _spec.loader.exec_module(_mod)

import pyarest.prims  # noqa: F401,E402
from pyarest import ast, forml  # noqa: E402
from pyarest.engine import _instance_mirror, _pop_rows  # noqa: E402
from pyarest.lam import CONS, NIL, SEQ, to_lam, from_lam, atom as A  # noqa: E402
from pyarest.reduce import apply as _ap  # noqa: E402

MODEL = """
* Person is identified by Person Name.
* Company is identified by Company Name.
* Person1 works for Company1.
"""


def _S(*xs):
    l = NIL
    for x in reversed(xs):
        l = CONS(x)(l)
    return SEQ(l)


def _store(D, name, rows):
    return _ap(ast.Store(name), _S(to_lam(rows), D))


def _populated(D):
    """A store the mirror can actually derive from.

    compile_model alone yields EMPTY role and instanceOf cells -- those are
    populated further down the pipeline -- so a differential over its output
    compares two empty sets and passes while proving nothing. The first
    version of this file did exactly that: three tests green, zero content.
    Both sides are therefore handed the SAME synthetic store, and every
    assertion below checks the answer is non-empty before checking the two
    sides agree.

    Two nouns at two positions of one fact type is the shape that does real
    work: the column read differs per role, so an implementation that paired
    every id with every noun would answer four extra rows here.
    """
    D = _store(D, "instanceOf",
               (("Person", "ObjectType"), ("Company", "ObjectType")))
    D = _store(D, "role",
               (("r1", "F1", 1, "Person"), ("r2", "F1", 2, "Company")))
    return _store(D, "F1", (("p1", "c1"), ("p2", "c2")))


EXPECTED = {("p1", "Person"), ("p2", "Person"),
            ("c1", "Company"), ("c2", "Company")}


def _canon_rows(D):
    """derive:instance_mirror over the store as name-contents PAIRS.

    The store:* family takes pairs where the ast:* family takes Backus's
    <CELL, name, contents> triples, so the shape is converted here rather
    than assumed.
    """
    cells = tuple((c[1], c[2]) for c in from_lam(D)
                  if isinstance(c, tuple) and len(c) >= 3)
    out = from_lam(_ap(A("derive:instance_mirror"), to_lam(cells)))
    assert isinstance(out, tuple), f"the def must answer rows, got {out!r}"
    return {tuple(r) for r in out if isinstance(r, tuple)}


def test_the_canon_mirror_twins_the_host_derivation():
    D, _rep = forml.compile_model(MODEL)
    D = _populated(D)
    host = _instance_mirror(D)
    assert host == EXPECTED, "the host derivation moved: %r" % (host,)
    assert _canon_rows(D) == host


def test_the_twin_holds_on_an_unpopulated_model():
    """The empty arm, which must answer empty ROWS rather than bottom.

    Deliberately kept BESIDE the populated case rather than alone: on its own
    this is the vacuous comparison that made the first version of this file
    worthless.
    """
    D, _rep = forml.compile_model(MODEL)
    assert not _instance_mirror(D), "expected a compiled model to have no rows"
    assert _canon_rows(D) == _instance_mirror(D)


def test_the_host_derivation_is_reachable_by_name():
    """The registry cannot name an inline block.

    This derivation lived inside run_rules with underscore-prefixed locals,
    which is why it sat undeclared through every twin sweep this session ran.
    Extracting it is what let it be declared at all.
    """
    from pyarest import engine
    assert callable(getattr(engine, "_instance_mirror", None))
