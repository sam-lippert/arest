"""Aggregates in rule heads (Def. derive sanctions them verbatim: 'an aggregate
reducing a finite bag to one scalar'). The clause surface `<out> is the <op> of
<source>` is the readings corpus's numeric-aggregation shape (derivation.md shape 7:
`<role> is the <op> of <target> where <body>`, ops count/sum/avg/min/max; here the bag
is scoped by the rule's own conjuncts instead of a `where` suffix), and the form is
Halpin's own gloss of aggregation ("n is the count of all the facts satisfying
condition", Logical Data Modeling Part 13). Semantics per Halpin/Curland's ORM-to-
datalog mapping: the aggregate stratum sits above the positive closure (agg<<>> over a
derived predicate), the head is functional per group, so recompute REPLACES — the old
engine's documented misfold (a stale larger min surviving union-merge over a growing
source) is this suite's regression case. min/max/sum/count are all LANDED and gated
below (2026-07-14: the historical 'count/sum/avg fall to ruleDiag until landed' note was
stale, found dogfooding a decision through AREST). avg is the lone exception — it parses
with NO diagnostic yet folds to EMPTY, a SILENT no-op that violates the loud-absent
doctrine and should either fold or fall to ruleDiag; captured as a strict-xfail below."""
import pytest

import pyarest.prims  # noqa: F401
import pyarest.lam as L
from pyarest.lam import atom as A, to_lam, from_lam
from pyarest import ast, forml, system
from pyarest.reduce import apply


def S(*xs):
    l = L.NIL
    for x in reversed(xs):
        l = L.CONS(x)(l)
    return L.SEQ(l)


def _cell(Dpy, name):
    for c in Dpy:
        if isinstance(c, tuple) and len(c) == 3 and c[:2] == ("CELL", name):
            return set(c[2])
    return set()


MODEL = """Node(.Id) is an entity type.
Cost is a value type.
Node moves to Node at Cost.
Node cheapest to Node at Cost.
Node1 cheapest to Node2 at Cost3 if Node1 moves to Node2 at Cost2 and Cost3 is the min of Cost2.
"""


def test_min_folds_to_one_scalar_per_group():
    D, rep = forml.compile_model(MODEL)
    assert rep["unparsed"] == []
    assert rep["rule_diagnostics"] == []
    D = apply(ast.Store("Node_moves_to_Node_at_Cost"),
              S(to_lam((("a", "b", 5), ("a", "b", 3), ("a", "c", 7))), D))
    D = system.run_rules(D)
    assert _cell(from_lam(D), "Node_cheapest_to_Node_at_Cost") == \
        {("a", "b", 3), ("a", "c", 7)}


def test_a_better_minimum_supersedes_the_stale_one():
    # the old engine's misfold, as our regression: the aggregate head REPLACES on
    # recompute, so a later cheaper edge supersedes the stored minimum
    D, _ = forml.compile_model(MODEL)
    D = apply(ast.Store("Node_moves_to_Node_at_Cost"),
              S(to_lam((("a", "b", 5), ("a", "b", 3))), D))
    D = system.run_rules(D)
    assert _cell(from_lam(D), "Node_cheapest_to_Node_at_Cost") == {("a", "b", 3)}
    D = apply(A(2), system.create(D, "Node_moves_to_Node_at_Cost", to_lam(("a", "b", 2))))
    D = system.run_rules(D)
    assert _cell(from_lam(D), "Node_cheapest_to_Node_at_Cost") == {("a", "b", 2)}


def test_max_folds_too():
    MODEL2 = MODEL.replace("cheapest", "dearest").replace("the min of", "the max of")
    D, rep = forml.compile_model(MODEL2)
    assert rep["rule_diagnostics"] == []
    D = apply(ast.Store("Node_moves_to_Node_at_Cost"),
              S(to_lam((("a", "b", 5), ("a", "b", 3))), D))
    D = system.run_rules(D)
    assert _cell(from_lam(D), "Node_dearest_to_Node_at_Cost") == {("a", "b", 5)}


# ── sum / count / avg (landed 2026-07-14, previously ungated) ───────────────
# The same functional-per-group folding contract, on a one-role source bag.
_FOLD_MODEL = """Item(.Id) is an entity type.
Value is a value type.
Item has Value.
Item folds Value.
Item folds Value2 if Item has Value and Value2 is the {op} of Value.
"""


def _fold(op):
    D, rep = forml.compile_model(_FOLD_MODEL.format(op=op))
    assert rep["unparsed"] == [] and rep["rule_diagnostics"] == []
    D = apply(ast.Store("Item_has_Value"),
              S(to_lam((("a", 5), ("a", 3), ("b", 10))), D))
    D = system.run_rules(D)
    return _cell(from_lam(D), "Item_folds_Value")


def test_sum_folds_per_group():
    # a: 5+3=8, b: 10 — the aggregate head is functional per group
    assert _fold("sum") == {("a", 8), ("b", 10)}


def test_count_folds_per_group():
    # a: two facts, b: one
    assert _fold("count") == {("a", 2), ("b", 1)}


@pytest.mark.xfail(strict=True, reason="avg parses with NO rule diagnostic yet folds to "
                   "EMPTY — a silent no-op that violates the loud-absent doctrine. It "
                   "should fold (a:(5+3)/2=4, b:10) or fall to ruleDiag. Found 2026-07-14 "
                   "dogfooding a Kepner-Tregoe decision (weighted scoring needs it).")
def test_avg_folds_per_group():
    assert _fold("avg") == {("a", 4), ("b", 10)}
