"""The projected subset/exclusion deontic checkers, moved from host-only
compositions into constraints.canon (2026-07-09 canon-completeness audit).
Gated by the ABSOLUTE result (intersection.md: authorship tests demand the exact
value, never a reference-bearing tautology): each canonical NAME applied to
<cell, proj_p, proj_c[, pos, lit]> builds a checker that, on a fixed synthetic
<P, D>, yields the exact violation set. Because the builders compose only
differential-covered primitives, the Rust host reduces the identical bytes.

Synthetic world: antecedent A (target population P) = <a,x>,<b,y>,<c,irreversible>;
sibling head cell 'Head' = <a,z>. proj_p = proj_c = [1] (the entity role);
value filter selects position 2 == 'irreversible' (only row c)."""
import pytest

import pyarest.prims  # noqa: F401
import pyarest.lam as L
from pyarest.lam import from_lam, to_lam, atom as A
from pyarest.reduce import apply as R


def S(*xs):
    l = L.NIL
    for x in reversed(xs):
        l = L.CONS(x)(l)
    return L.SEQ(l)


P = to_lam((("a", "x"), ("b", "y"), ("c", "irreversible")))
D = to_lam((("CELL", "Head", (("a", "z"),)),))
IN = S(P, D)


def check(name, *param):
    built = R(A(name), to_lam(tuple(param)))
    return sorted(from_lam(R(built, IN)))


def test_subset_projected():
    # π₁(P) ∖ π₁(Head) = {a,b,c} ∖ {a} = {b,c}
    assert check("constraints:scoped_subset_projected", "Head", (1,), (1,)) == [("b",), ("c",)]


def test_exclusion_projected():
    # π₁(P) ∩ π₁(Head) = {a,b,c} ∩ {a} = {a}
    assert check("constraints:scoped_exclusion_projected", "Head", (1,), (1,)) == [("a",)]


def test_subset_projected_filtered():
    # π₁(σ_{2=irreversible}(P)) ∖ π₁(Head) = {c} ∖ {a} = {c}
    assert check("constraints:scoped_subset_projected_filtered",
                 "Head", (1,), (1,), 2, "irreversible") == [("c",)]


def test_exclusion_projected_filtered():
    # π₁(σ_{2=irreversible}(P)) ∩ π₁(Head) = {c} ∩ {a} = {}
    assert check("constraints:scoped_exclusion_projected_filtered",
                 "Head", (1,), (1,), 2, "irreversible") == []


# ── the absorbed projected-subset assembly (task 25) ───────────────────────
# The projected checkers above are exercised DIRECTLY. These two go through the
# full compile → validate_for assembly over an ABSORBED head (both `is
# delegating` and `is registered` fold into the Operation entity table, which
# has no own-table population). validate_for._rebuilt used to rebuild the subset
# with a non-projected checker over that VACUOUS entity view and mis-flag the
# whole condition population; fixed 2026-07-14 by falling through to the
# correctly-registered projected checker (constraints:scoped_subset_projected).
# The pair pins BOTH directions — no false positive AND no false negative.
_SUBSET_HEAD = (
    "Operation(.name) is an entity type.\n"
    "Operation is delegating.\n"
    "Operation is registered.\n"
    "It is obligatory that each Operation is registered if that Operation is delegating.\n"
)
_SUBSET_SATISFIED = _SUBSET_HEAD + (
    "Operation 'synthesize' is delegating.\n"
    "Operation 'synthesize' is registered.\n"
    "Operation 'validate' is delegating.\n"
    "Operation 'validate' is registered.\n"
)
# synthesize is delegating but NOT registered → it is the one and only offender.
_SUBSET_VIOLATED = _SUBSET_HEAD + (
    "Operation 'synthesize' is delegating.\n"
    "Operation 'validate' is delegating.\n"
    "Operation 'validate' is registered.\n"
)


def _subset_violations(model):
    from pyarest import forml, system, defs
    D, _rep = forml.compile_model(model)
    val = forml.validate_for("Operation_is_delegating", D, system.rmap_partition(D))
    pop = tuple(tuple(r) for r in system._pop_rows(D, "Operation_is_delegating"))
    with defs.step(D):
        _p, viol, _flag = from_lam(R(val, S(to_lam(pop), D)))
    return tuple(viol)


def test_projected_subset_deontic_validates_clean_when_satisfied():
    # delegating == registered == {synthesize, validate}: no violation — and NOT
    # the whole population (the absorbed-view regression, task 25).
    assert _subset_violations(_SUBSET_SATISFIED) == ()


def test_projected_subset_deontic_flags_only_the_real_offender():
    # soundness: the fix must still CATCH a real violation, and only it.
    assert _subset_violations(_SUBSET_VIOLATED) == (("synthesize",),)
