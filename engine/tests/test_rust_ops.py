"""The fat host's OP surface, which no other harness reaches.

The wall certifies the four stations against each other; the kernel
differentials hold java/csharp to the python evaluator. Neither routes through
engine/rust's MCP ops, so a defect there is invisible to every green signal the
repo has. That is not hypothetical: op_sql_project carried 442 lines with no
test anywhere, and wiring the `cells` op to canon shipped a HANG (store:namerows
sorts, a resident base is ~1000 cells, and reduce_over's Scott mu was still
running at 240s) that compiled clean and left the wall green.

One process, ops fed as JSON lines on stdin in order, answers matched by op.
"""
import json
import re
import os
import subprocess

import pytest

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BIN = os.path.join(_ROOT, "rust", "target", "debug", "arest.exe")


def _serve(ops, timeout=600):
    """Feed ops to one --serve process; return {op: result} in order."""
    payload = "".join(json.dumps(o) + "\n" for o in ops)
    out = subprocess.run([_BIN, "--serve"], input=payload, capture_output=True,
                         text=True, timeout=timeout, encoding="utf-8")
    assert out.returncode == 0, out.stderr[-800:]
    answers = []
    for line in out.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            answers.append(json.loads(line))
    return answers


@pytest.mark.skipif(not os.path.exists(_BIN),
                    reason="engine/rust not built (cargo build)")
def test_the_cells_op_lists_the_store_through_canon():
    # the store surface is canon now (store:namerows): names, row counts and
    # the SORT come from the DEF, the host only filters and renders.
    got = _serve([{"op": "base_seed"},
                  {"op": "cells", "pattern": "factType"}])
    seed = next(a for a in got if a.get("op") == "base_seed")
    assert seed["result"]["cells"] > 0

    cells = next(a for a in got if a.get("op") == "cells")["result"]["cells"]
    assert cells, "the cells op answered an empty listing"

    names = [c["name"] for c in cells]
    assert names == sorted(names), "store:namerows must answer sorted"
    assert all("facttype" in n.lower() for n in names), "pattern not applied"

    ft = next(c for c in cells if c["name"] == "factType")
    assert isinstance(ft["rows"], int) and ft["rows"] > 0

    # an atom cell has no population: canon answers phi, the host prints null.
    # A 0-row SEQUENCE cell must still print 0, never null.
    for c in cells:
        assert c["rows"] is None or isinstance(c["rows"], int)


@pytest.mark.skipif(not os.path.exists(_BIN),
                    reason="engine/rust not built (cargo build)")
def test_the_rule_closure_reaches_a_fixpoint():
    # THE ORACLE op_run_rules never had. Its 1119 lines are the semi-naive
    # positive-rule closure, and canon carries 45 derive: DEFs including
    # derive:eval and derive:delta_eval -- so the meaning is largely there
    # already and those lines are owed to canon, exactly as op_sql_project's
    # were. op_run_rules is NOT in test_canon_coverage's OVERRIDES registry,
    # so it is not a sanctioned certified twin either.
    #
    # The assertion is the DEFINING property rather than a transcript of one
    # store's answer: a fixpoint re-run must derive nothing new. That survives
    # the rewiring to canon, which a golden list of changed cells would not.
    got = _serve([{"op": "base_seed"},
                  {"op": "run_rules"},
                  {"op": "run_rules"}], timeout=900)
    runs = [a["result"] for a in got if a.get("op") == "run_rules"]
    assert len(runs) == 2, f"expected two run_rules answers, got {len(runs)}"

    first, second = runs
    assert first["rounds"] >= 1
    assert first["changed"], "the first closure over a fresh base derived nothing"

    # the recursive rule fired: a transitive closure ("reaches") is exactly the
    # shape that needs the fixpoint rather than one pass
    assert any("reaches" in c for c in first["changed"]), (
        f"no transitive-closure cell among {first['changed'][:4]}")

    # THE FIXPOINT: the store was replaced by the derived result, so a second
    # closure has nothing left to find. If this ever fails, the closure is not
    # closing -- which no other signal in the repo would show.
    assert second["changed"] == [], (
        f"re-running the closure derived more: {second['changed'][:4]}")


_MIXED_MODEL = "\n".join([
    "Person is a noun.",
    "Company is a noun.",
    "Person has Name.",
    "Person works for Company.",
    "Each Person has at most one Name.",
    "It is obligatory that each Person has some Name.",
    "Employee is a kind of Person.",
])


@pytest.mark.skipif(not os.path.exists(_BIN),
                    reason="engine/rust not built (cargo build)")
def test_compile_model_is_deterministic_and_restores_the_store():
    # THE ORACLE compile.rs never had. It is 3783 lines -- the Stage-1 cook
    # boundary ported from python's _COOK table -- and holds work that is
    # canon-owed (num() assigns the ORM type that canon's NATEQ then compares
    # on, and canon has ntoa but no inverse). None of it can move safely
    # without a host-level check, which is what made op_sql_project's 442 lines
    # and op_run_rules' 1119 unsafe until each got one.
    #
    # The property pinned is the one a REFACTOR must preserve: compiling the
    # same text twice in one session answers identically. compile_model uses
    # the resident store as scratch and restores it whole, so a restore that
    # leaked would show up as the second answer differing from the first --
    # and nothing else in the repo would notice.
    got = _serve([{"op": "base_seed"},
                  {"op": "compile_model", "text": _MIXED_MODEL},
                  {"op": "compile_model", "text": _MIXED_MODEL}], timeout=900)
    runs = [a["result"] for a in got if a.get("op") == "compile_model"]
    assert len(runs) == 2, f"expected two compile_model answers, got {len(runs)}"
    first, second = runs

    assert first["total"] == 7
    assert first["classified"] >= 1, "the compile classified nothing at all"
    assert first["prose"] == [] and first["blocked"] == []

    # IDEMPOTENT: the scratch store was restored, so the second compile of the
    # same text is the same answer. This is the regression the refactor risks.
    for k in ("total", "classified", "unclassified", "prose", "missing", "blocked"):
        assert first[k] == second[k], (
            f"compile_model not idempotent on {k}: {first[k]!r} then {second[k]!r}")

    # CURRENT BEHAVIOUR, pinned deliberately rather than endorsed: a noun
    # declaration classifies only where that noun is used as a SUBJECT
    # elsewhere in the same text. "Person is a noun." classifies (Person heads
    # "Person has Name."); "Company is a noun." does not, Company appearing
    # only as an object; and in a nouns-only model NOTHING classifies. Whether
    # that is right is a question for the grammar, not for a refactor -- and a
    # refactor must not change it silently, which is what this line is for.
    assert first["unclassified"] == ["Company is a noun."], (
        f"noun-classification behaviour moved: {first['unclassified']}")


@pytest.mark.skipif(not os.path.exists(_BIN),
                    reason="engine/rust not built (cargo build)")
def test_the_sql_projection_holds_its_shape():
    # THE ORACLE op_sql_project never had. Its 442 lines duplicate canon by
    # arest's own rmap:schema ruling -- "the flat table is the derived
    # presentation rmap:unnest" (Codd 1970 1.3) -- so they are owed to canon,
    # and nothing could catch a regression while they moved. Structural, not
    # byte-exact: the point is to hold the projection's SHAPE across a rewiring
    # to rmap:unnest, not to freeze one store's bytes.
    got = _serve([{"op": "base_seed"}, {"op": "sql_project"}])
    proj = next(a for a in got if a.get("op") == "sql_project")["result"]

    tables, counts = proj["tables"], proj["counts"]
    assert tables and counts, "the projection answered nothing"

    for t in tables:
        assert t["name"] and t["columns"], f"table {t.get('name')!r} has no columns"
        assert t["create_sql"].startswith("CREATE TABLE IF NOT EXISTS ")
        # every row is one value per declared column -- the projection is flat
        # (Codd 1970 1.4 interchange form: no pointers, no ordering lists)
        for row in t["rows"]:
            assert len(row) == len(t["columns"]), (
                f"{t['name']}: row of {len(row)} against {len(t['columns'])} columns")

    # PARENTS-FIRST (rmap:ddl_order): a table must not be created before a
    # projected table it references, or the DDL cannot be executed in order.
    # The parents are not in the answer, so read them back off the REFERENCES
    # clauses -- which also checks the clause canon emits is well formed.
    pos = {}
    for i, t in enumerate(tables):
        pos.setdefault(t["name"], i)
    for i, t in enumerate(tables):
        for ref in re.findall(r'REFERENCES "([^"]+)"', t["create_sql"]):
            if ref == t["name"] or ref not in pos:
                continue          # self-reference and external both pass
            assert pos[ref] <= i, (
                f"{t['name']} at {i} references {ref} at {pos[ref]}: not parents-first")

    # counts must agree with the rows actually emitted. It is keyed by the
    # table's SOURCE (the fact type / object type it projects, e.g. "Agent"),
    # not by the sql_name the table carries (e.g. "agent") -- two spellings of
    # one thing, and the report names the source.
    for t in tables:
        assert counts.get(t["source"]) == len(t["rows"]), (
            f"{t['source']}: counts {counts.get(t['source'])}, rows {len(t['rows'])}")
