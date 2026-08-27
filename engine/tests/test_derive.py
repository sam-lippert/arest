"""Role-path -> F_S: a derivation rule is a conjunctive query (join-project over fact types,
per ORM->Datalog); recursion is resolved by derive = lfp F_S. Compiled rules reduce by the one mu."""
from pyarest import from_lam, to_lam, apply
import pyarest.prims  # noqa: F401
from pyarest import system


def ev(op, data):
    return from_lam(apply(op, to_lam(data)))


def test_two_fact_type_join_derivation():
    # FastCarDriver(x) <- drives(x, y), isFast(y)  — join on the Car, project the Person
    rule = system.join_rule2(2, [1])
    drives = (("alice", "car1"), ("bob", "car2"))
    is_fast = (("car1",),)
    assert set(ev(rule, (drives, is_fast))) == {("alice",)}   # alice drives a fast car; bob doesn't


def test_one_step_join():
    # grandparent(x,z) <- parent(x,y), parent(y,z)  — one application of the self-join rule
    rule = system.join_rule(2, [1, 3])
    parent = (("a", "b"), ("b", "c"))
    assert set(ev(rule, parent)) == {("a", "c")}


def test_recursive_transitive_closure():
    # ancestor <- link ; link(x,y), ancestor(y,z)  — derive_of takes the least fixed point
    derive = system.derive_of([system.join_rule(2, [1, 3])])
    links = (("a", "b"), ("b", "c"), ("c", "d"))
    assert set(ev(derive, links)) == {("a", "b"), ("b", "c"), ("c", "d"),
                                       ("a", "c"), ("b", "d"), ("a", "d")}   # full transitive closure


def test_derived_fact_type_via_create_pipeline():
    # a semiderived (+) fact type: base links are asserted; the create pipeline runs the rule as its
    # `derive` stage, so the committed population is the transitive closure (asserted ∪ derived).
    from pyarest import ast
    from pyarest.lam import atom as A
    import pyarest.lam as L
    derive = system.derive_of([system.join_rule(2, [1, 3])])
    D = L.SEQ(L.CONS(ast.cell("anc", to_lam(())))(L.NIL))
    for link in (("a", "b"), ("b", "c"), ("c", "d")):
        D = apply(A(2), ast.run(to_lam(link), D, derive_obj=derive, cell_name="anc"))   # thread D'
    anc = [c for c in from_lam(D) if isinstance(c, tuple) and c[:2] == ("CELL", "anc")][0][2]
    assert set(anc) == {("a", "b"), ("b", "c"), ("c", "d"), ("a", "c"), ("b", "d"), ("a", "d")}


def test_marker_storage_method():
    assert system.materialize("derived-and-stored") and system.materialize("partially-derived-and-stored")
    assert not system.materialize("fully-derived") and not system.materialize("semi-derived")


def test_derivation_rule_reading_compiles_and_computes():
    # NORMA's role-path verbalization (infosci ORM->Datalog) parses to the join rule and computes:
    # FastCarDriver(x) <- drives(x,y), isFast(y)
    from pyarest import forml, defs
    from pyarest.lam import atom as A
    D, rep = forml.compile_model("*Each FastCarDriver is some Person who drives some Car that is fast.")
    assert rep["unparsed"] == []
    # A compiled rule is applied to the STORE, not to a tuple of populations:
    # engine.py:1339 and :1374 both do `_ap(_A(rule_cid), D)`. The rule carries
    # its atom NAMES in its operand and fetches them itself. This test used to
    # pass the pair directly, which was system:join_rule2's convention and one
    # the engine never used -- so it stayed green while the two-hop join derived
    # nothing in production. It is written against the real convention now.
    D = to_lam(tuple(from_lam(D)) + (
        ("CELL", "Person_drives_Car", (("alice", "car1"), ("bob", "car2"))),
        ("CELL", "Car_is_fast", (("car1",),)),
    ))
    with defs.step(D):                                        # the rule lives in D's DEFS
        v = from_lam(apply(A("FastCarDriver_rule"), D))
    assert set(map(tuple, v)) == {("alice",)}                 # alice drives a fast car; bob doesn't
