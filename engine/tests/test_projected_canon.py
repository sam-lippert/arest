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


# ── the assembly gate (task 25 / task 16) ──────────────────────────────────
# The projected checkers above are exercised DIRECTLY and pass; the correctly
# REGISTERED named checker also validates clean (verified via validate_modal —
# it returns no violations here). The bug is in validate_for's assembly: when
# the head fact type is ABSORBED (unary predicates fold into the entity table —
# here both `is delegating` and `is registered` fold into Operation), _rebuilt
# (compiler.py ~2640) intercepts the subset and rebuilds it with the
# NON-PROJECTED C.scoped_subset over the view, shadowing the correct projected
# checker, so the full-row/absorbed-view comparison mis-flags the WHOLE
# condition population. strict=True flips this to a FAILURE the moment task 16
# repairs the assembly — delete the marker with the fix.
_SUBSET_SATISFIED = (
    "Operation(.name) is an entity type.\n"
    "Operation is delegating.\n"
    "Operation is registered.\n"
    "It is obligatory that each Operation is registered if that Operation is delegating.\n"
    "Operation 'synthesize' is delegating.\n"
    "Operation 'synthesize' is registered.\n"
    "Operation 'validate' is delegating.\n"
    "Operation 'validate' is registered.\n"
)


@pytest.mark.xfail(strict=True, reason="task 25/16: validate_for._rebuilt rebuilds an "
                   "ABSORBED projected-subset with non-projected scoped_subset over the "
                   "view, shadowing the correct projected checker -> whole population "
                   "mis-flagged. Canon DEF + named checker are correct. Fix in task 16.")
def test_projected_subset_deontic_validates_clean_when_satisfied():
    from pyarest import forml, system, defs
    D, _rep = forml.compile_model(_SUBSET_SATISFIED)
    # delegating == registered == {synthesize, validate}: π(delegating) ⊆ π(registered)
    # holds, so validate MUST report no violations.
    val = forml.validate_for("Operation_is_delegating", D, system.rmap_partition(D))
    pop = tuple(tuple(r) for r in system._pop_rows(D, "Operation_is_delegating"))
    with defs.step(D):
        _p, viol, _flag = from_lam(R(val, S(to_lam(pop), D)))
    assert tuple(viol) == ()
