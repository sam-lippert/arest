"""The REGISTERED seams (Samuel, 2026-07-13: LLMs register through DEFS so
synthesize and validate can be registered operations, the one valid
delegation without a shared canon). A STUB registered function proves each
seam, exactly as Platform functions test: no live LLM anywhere, and no
store either — the seams are module-level functions the verbs consume in
one visible line each, so every contract tests in milliseconds
(performance-over-grinding: the first drafts paid minutes-class verbalize
reductions and full base compiles for assertions worth seconds). Contracts
pinned: nothing registered means the input unchanged; a registration is
consulted through kernel.register's origin=registered entry; the kill
switch retires it like any row; a BROKEN registration degrades gracefully
with the degradation NAMED (the outcomes doctrine: no silent paths); and
the validate judge is DEONTIC-ONLY, so it can flag but can never block."""
import os

import pyarest.prims  # noqa: F401
from pyarest import kernel
from pyarest import protocol as P
from pyarest.lam import to_lam, from_lam

FACTS = [{"reading": "{0} has Side {1}", "row": ["c1", "heads"],
          "text": "c1 has Side heads"}]


def _shaper(mu):
    def run(operand):
        rows = from_lam(operand)
        shaped = tuple((r, w, "SHAPED: " + str(t)) for (r, w, t) in rows)
        return to_lam(shaped)
    return run


def _judge(mu):
    def run(D):
        return to_lam((("Coin_has_Side", ("c1",)),))
    return run


def _broken(mu):
    def run(operand):
        raise RuntimeError("not implemented")
    return run


def test_the_synthesize_shaper_seam():
    # absent: the input unchanged, no degradation
    kernel.latest.pop("llm:synthesize_shaper", None)
    facts, deg = P.apply_registered_shaper(FACTS)
    assert facts == FACTS and deg is None
    # registered: consulted; words change, content never does
    kernel.register("llm:synthesize_shaper", _shaper)
    facts, deg = P.apply_registered_shaper(FACTS)
    assert deg is None
    assert all(f["text"].startswith("SHAPED:") for f in facts)
    assert [f["row"] for f in facts] == [f["row"] for f in FACTS]
    # killed: the plain path, exactly as any registry row
    os.environ["AREST_NO_OVERRIDE"] = "llm:synthesize_shaper"
    try:
        facts, deg = P.apply_registered_shaper(FACTS)
    finally:
        del os.environ["AREST_NO_OVERRIDE"]
    assert facts == FACTS and deg is None
    # broken: graceful degradation, named, never an exception
    kernel.register("llm:synthesize_shaper", _broken)
    facts, deg = P.apply_registered_shaper(FACTS)
    assert facts == FACTS
    assert deg["name"] == "llm:synthesize_shaper"
    assert "not implemented" in deg["error"]


def test_the_validate_judge_seam_is_deontic_only():
    D = to_lam(())  # the stubs ignore D; the seam only passes it through
    kernel.latest.pop("llm:validate_judge", None)
    assert P.registered_judge_entries(D) == [], \
        "nothing registered, nothing changes"
    kernel.register("llm:validate_judge", _judge)
    extra = P.registered_judge_entries(D)
    assert len(extra) == 1
    assert extra[0]["fact_type"] == "Coin_has_Side"
    assert extra[0]["alethic"] is False, \
        "a registered judge flags, never blocks"
    assert extra[0]["kinds"] == ["registered_judge"]
    assert extra[0]["source"] == "registered"
    os.environ["AREST_NO_OVERRIDE"] = "llm:validate_judge"
    try:
        assert P.registered_judge_entries(D) == [], \
            "a killed registration is silence"
    finally:
        del os.environ["AREST_NO_OVERRIDE"]
    kernel.register("llm:validate_judge", _broken)
    deg = P.registered_judge_entries(D)
    assert len(deg) == 1
    assert deg[0]["kinds"] == ["registered_degraded"]
    assert deg[0]["alethic"] is False
    assert "not implemented" in deg[0]["offenders"][0][0]
