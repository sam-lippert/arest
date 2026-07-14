"""The scoped constraint families from the shared source. A scoped violation expression
consumes ⟨P, D⟩, fetching sibling populations from the frozen D through ast:FetchPop —
which is why these waited for the ast wave. The strict gates hand-build stores with
sibling cells and assert absolute violations per family; the wrapper must agree with the
canonical name. The absorbed-view seam (the sibling is an absorbed fact type reassembled
through the index) is no longer a host composition: it is a PURE-DATA population spec —
⟨'view', table, col⟩, or ⟨'cell', name⟩ for a plain sibling — read by
constraints:pop_of_spec and folded by the spec-taking sibling builders (scoped_*_spec),
certified below and end-to-end in test_scoped_view (task 16)."""
import pyarest.prims  # noqa: F401
import pyarest.lam as L
from pyarest.lam import to_lam, from_lam, atom as A
from pyarest import constraints as C, defs
from pyarest.reduce import apply


def S(*xs):
    l = L.NIL
    for x in reversed(xs):
        l = L.CONS(x)(l)
    return L.SEQ(l)


def _D(*cells):
    return to_lam(tuple(("CELL", n, v) for (n, v) in cells))


def _run(obj, P, D):
    with defs.step(L.SEQ(L.NIL)):
        return set(from_lam(apply(obj, S(to_lam(P), D))))


def _name(name, cell, P, D):
    with defs.step(L.SEQ(L.NIL)):
        built = apply(A(name), A(cell))
        return set(from_lam(apply(built, S(to_lam(P), D))))


def test_scoped_subset_from_the_canon():
    D = _D(("B", (("a",),)))
    P = (("a",), ("c",))
    assert _name("constraints:scoped_subset", "B", P, D) == {("c",)}
    assert _run(C.scoped_subset("B"), P, D) == {("c",)}
    # absent sibling: everything in P violates (pop_of defaults to the empty pop)
    assert _name("constraints:scoped_subset", "ZZ", P, D) == {("a",), ("c",)}


def test_scoped_mandatory_both_attachments_from_the_canon():
    D = _D(("Person", (("p1",), ("p2",))), ("F", (("p2", "y"),)))
    facts = (("p1", "x"),)
    assert _name("constraints:scoped_mandatory_entities", "Person", facts, D) \
        == {("p2",)}
    assert _run(C.scoped_mandatory_entities("Person"), facts, D) == {("p2",)}
    entities = (("p1",), ("p2",))
    assert _name("constraints:scoped_mandatory_facts", "F", entities, D) == {("p1",)}
    assert _run(C.scoped_mandatory_facts("F"), entities, D) == {("p1",)}


def test_scoped_equality_side_from_the_canon():
    D = _D(("O", (("b",), ("c",))))
    P = (("a",), ("b",))
    assert _name("constraints:scoped_equality_side", "O", P, D) == {("a",), ("c",)}
    assert _run(C.scoped_equality_side("O"), P, D) == {("a",), ("c",)}


def test_the_pure_data_spec_branch_replaces_the_host_composition():
    # task 16: the absorbed-view seam is a PURE-DATA spec, not a host expression.
    # A ⟨'cell', name⟩ spec reads the named sibling via constraints:pop_of_spec and
    # AGREES with the name-taking builder, across all three migrated families; the
    # ⟨'view', table, col⟩ (absorbed) case is exercised end-to-end in test_scoped_view.
    import pytest
    D = _D(("B", (("a",),)))
    P = (("a",), ("c",))
    assert _run(C.scoped_subset(("cell", "B")), P, D) \
        == _name("constraints:scoped_subset", "B", P, D) == {("c",)}

    De = _D(("O", (("b",), ("c",))))
    Pe = (("a",), ("b",))
    assert _run(C.scoped_equality_side(("cell", "O")), Pe, De) \
        == _name("constraints:scoped_equality_side", "O", Pe, De) == {("a",), ("c",)}

    Dm = _D(("F", (("p2", "y"),)))
    ents = (("p1",), ("p2",))
    assert _run(C.scoped_mandatory_facts(("cell", "F")), ents, Dm) \
        == _name("constraints:scoped_mandatory_facts", "F", ents, Dm) == {("p1",)}

    # the host closure is retired: a raw population expression is no longer accepted,
    # the RMAP seam marshals a spec (compiler _vp) instead of composing a term
    expr = __import__("pyarest.ast", fromlist=["FetchPop"]).FetchPop("B")
    with pytest.raises(TypeError):
        C.scoped_subset(expr)
