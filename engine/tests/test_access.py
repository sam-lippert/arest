"""Authorization per the platform arc: the access MODULE (shared/access.md)
is ordinary readings, authorization is the derived fact type `User is authorized for
Operation on Resource` (rule power: roles, and later subtype closure), and enforcement
is one membership check in create against the RMAP resource (the table a write lands
in). An engine without the module ingested proceeds ungoverned: graceful absence, the
same principle as the override interface."""
import os
import pyarest.prims  # noqa: F401
import pyarest.lam as L
from pyarest.lam import atom as A, to_lam, from_lam
from pyarest import ast, forml, system
from pyarest.reduce import apply

# The module was a file (engine/shared/access.md) until e1103b36 retired all 17
# readings from engine/shared, leaving this test reading a path that no longer
# existed -- which aborted COLLECTION of the whole suite, not just this file.
# It is inlined here beside MODEL and GRANTS, which this test always inlined;
# reading one of its three inputs from disk was the anomaly. Not repointed at
# readings/access/access.md: that is a different, prose document about
# server-side enforcement, not this ingestible module.
ACCESS = """# Access — the standard authorization module

User is not core metamodel: this module is ordinary readings an application ingests or
does not (composition is the tree-shaking). Authorization is a DERIVED fact type with
full rule power; enforcement is one membership check in create, and an engine without
this module ingested proceeds ungoverned (graceful absence, one closed-default
declaration away).

User(.Id) is an entity type.
Role(.Name) is an entity type.
Operation(.Name) is an entity type.
Resource(.Name) is an entity type.

User has Role.
Role grants Operation on Resource.

User1 is authorized for Operation2 on Resource3 if User1 has Role4 and Role4 grants Operation2 on Resource3.
"""

MODEL = """Order(.OrderId) is an entity type.
Customer(.Name) is an entity type.
Customer places Order.
"""

GRANTS = """User 'u1' has Role 'admin'.
Role 'admin' grants Operation 'create' on Resource 'Customer_places_Order'.
"""


def _cell(Dpy, name):
    for c in Dpy:
        if isinstance(c, tuple) and len(c) == 3 and c[:2] == ("CELL", name):
            return set(c[2])
    return set()


def _world():
    D, rep = forml.compile_model(ACCESS + MODEL + GRANTS)
    assert rep["unparsed"] == []
    return system.run_rules(D)                                # derive the authorization


def test_the_module_parses_and_derives_authorization():
    D = _world()
    auth = _cell(from_lam(D), "User_is_authorized_for_Operation_on_Resource")
    assert ("u1", "create", "Customer_places_Order") in auth


def test_an_authorized_actor_commits():
    D = _world()
    Dp = apply(A(2), system.create(D, "Customer_places_Order", to_lam(("c1", "o1")),
                                   actor="u1"))
    assert ("c1", "o1") in _cell(from_lam(Dp), "Customer_places_Order")


def test_an_unauthorized_actor_is_refused_with_d_unchanged():
    D = _world()
    res = system.create(D, "Customer_places_Order", to_lam(("c1", "o1")), actor="u2")
    assert from_lam(apply(A(1), res)) == "ERROR"
    Dp = apply(A(2), res)
    assert ("c1", "o1") not in _cell(from_lam(Dp), "Customer_places_Order")


def test_absence_of_the_module_is_graceful():
    D, _ = forml.compile_model(MODEL)                         # no access module ingested
    Dp = apply(A(2), system.create(D, "Customer_places_Order", to_lam(("c1", "o1")),
                                   actor="anyone"))
    assert ("c1", "o1") in _cell(from_lam(Dp), "Customer_places_Order")
