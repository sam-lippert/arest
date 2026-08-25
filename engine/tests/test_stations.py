"""The station differential as tests, run on the DELTA.

Every canonical runner answers the same. Compose the same canon for js, java,
cs and rust, evaluate each case on each, and hold the printed bytes identical.
That check was a shell script driving xargs and diffing files, and it cost tens
of minutes for every edit -- which is not a check, because a check nobody can
afford to run is one that gets skipped. It was: a green run of it went out over
two broken python tests it never looked at.

So it is tests, and it only runs what an edit could have changed. A case is a
closed term: it can answer differently only if a DEF it REACHES changed, or if
the runner itself changed. stationdelta fingerprints each case over exactly
those bodies, the answers are cached against that fingerprint, and an unchanged
case costs a dict lookup rather than four processes. Editing ui:ctl_entry
touches 10 of 566 cases; rmap:keyof touches 2.

The old harness could also LIE. Killed mid-run it left four case files of
different lengths, and the diff read as a four-station disagreement -- 589/568/
576/645 lines against 555 cases, with one runner reporting more answers than
there were cases. Nothing here can do that: an interrupted pytest run is an
interrupted run, and a cache entry is only written for a case that actually
answered.
"""
import hashlib
import json
import os
import subprocess

import pytest

import stationdelta as sd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools", "wall", "stations.out")
CACHE = os.path.join(OUT, "delta-cache.json")
REFERENCE = "js"

PARTS = ["head.part.js", "midcases.part.js", "mid1.part.js", "mid2.part.js",
         "mid3.part.js", "mid4.part.js", "tail.part.js"]
ORACLE = os.path.join(ROOT, "tools", "norma-oracle")


def _sh(cmd, cwd, timeout=180):
    """(ok, text) or (False, why).

    A station that RAN and printed nothing is a refusal, which is a legitimate
    answer -- 17 of the cases refuse. A station that could not run at all is
    not an answer, and collapsing the two lets two timed-out stations agree
    with each other on "<refused>" and pass. That is the interrupted harness's
    lie in a smaller box, so the two are kept apart here.
    """
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "timed out after %ss" % timeout
    except OSError as e:
        return False, "could not start: %s" % e
    return True, p.stdout.decode("utf-8", "replace").strip()


def _digest(paths):
    h = hashlib.sha256()
    for p in sorted(paths):
        try:
            with open(p, "rb") as f:
                h.update(f.read())
        except OSError:
            h.update(b"\0")
    return h.hexdigest()


def _compose_js():
    """The js station is a byte concatenation, never an eval — the same one
    stations.sh built, kept here so the tests own their own inputs."""
    os.makedirs(OUT, exist_ok=True)
    g = os.path.join(OUT, "js.g.js")
    order = [
        os.path.join(ROOT, "tools", "js-runner", "head.part.js"),
        os.path.join(ROOT, "arest"),
        os.path.join(ROOT, "tools", "js-runner", "midcases.part.js"),
        os.path.join(ROOT, "engine", "shared", "scenarios.canon"),
        os.path.join(ROOT, "tools", "js-runner", "mid1.part.js"),
        os.path.join(ORACLE, "design-state"),
        os.path.join(ROOT, "tools", "js-runner", "mid2.part.js"),
        os.path.join(ORACLE, "norma-answer"),
        os.path.join(ROOT, "tools", "js-runner", "mid3.part.js"),
        os.path.join(ORACLE, "journal"),
        os.path.join(ROOT, "tools", "js-runner", "mid4.part.js"),
        os.path.join(ROOT, "tools", "js-runner", "tail.part.js"),
    ]
    with open(g, "wb") as w:
        for p in order:
            with open(p, "rb") as f:
                w.write(f.read())
    return g


def _runners():
    """station -> (argv, cwd, identity). Identity is the runner's OWN code, never
    canon: hashing the composed js would invalidate every case on any canon
    edit, which is the whole cost this is removing."""
    js_g = _compose_js()
    java = os.path.join(ROOT, "tools", "java-runner")
    cs = os.path.join(ROOT, "tools", "cs-runner", "bin", "Debug", "net8.0",
                      "cs-runner.exe")
    rust = os.path.join(ROOT, "tools", "rust-station", "target", "debug",
                        "arest-station.exe")
    return {
        "js": (["bun", js_g], ROOT,
               _digest([os.path.join(ROOT, "tools", "js-runner", p) for p in PARTS])),
        "java": (["java", "-cp", ".", "Program"], java,
                 _digest([os.path.join(java, "Program.class"),
                          os.path.join(java, "Arest.java")])),
        # cwd is the RUNNER'S OWN directory, not the binary's: onecase.sh ran
        # them from tools/cs-runner and tools/rust-station, and from
        # bin/Debug/net8.0 they do not start. A station that fails to start is
        # reported as not built and silently drops out of the comparison, so
        # this getting it wrong made a four-station check pass on two.
        "cs": ([cs], os.path.join(ROOT, "tools", "cs-runner"), _digest([cs])),
        "rust": ([rust], os.path.join(ROOT, "tools", "rust-station"),
                 _digest([rust])),
    }


@pytest.fixture(scope="session")
def stations():
    runners = _runners()
    live = {}
    for name, (argv, cwd, ident) in runners.items():
        ok, _probe = _sh(list(argv) + ["case", "case:and-tt"], cwd)
        if ok:
            live[name] = (argv, cwd, ident)
    if REFERENCE not in live:
        pytest.skip("the reference station (%s) is not built" % REFERENCE)
    return live


@pytest.fixture(scope="session")
def fingerprints():
    canon, scen = sd.load(ROOT)
    return sd.fingerprints(canon, scen)


@pytest.fixture(scope="session")
def cache():
    """Read every shard, write only this worker's.

    Under xdist the fixture is session-scoped PER WORKER, so a single shared
    file means each worker writes the whole cache at teardown and the last one
    wins -- silently dropping the others' entries and turning the next run's
    hits back into four processes apiece. Sharding by worker makes the merge
    happen on read, where it cannot lose anything.
    """
    got = {}
    try:
        for fn in sorted(os.listdir(OUT)):
            if fn.startswith("delta-cache") and fn.endswith(".json"):
                try:
                    with open(os.path.join(OUT, fn), encoding="utf-8") as f:
                        got.update(json.load(f))
                except (OSError, ValueError):
                    pass
    except OSError:
        pass
    mine = dict(got)
    yield got
    worker = os.environ.get("PYTEST_XDIST_WORKER", "main")
    fresh = {k: v for k, v in got.items() if mine.get(k) != v}
    if fresh:
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, "delta-cache.%s.json" % worker)
        try:
            with open(path, encoding="utf-8") as f:
                prior = json.load(f)
        except (OSError, ValueError):
            prior = {}
        prior.update(fresh)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(prior, f)


def _cases():
    canon, scen = sd.load(ROOT)
    return sorted(n for n in sd.parse(scen) if n.startswith("case:"))


FULL = bool(os.environ.get("AREST_STATIONS_FULL"))
_WROTE = [0]


def _flush(cache, every=20):
    """Persist as we go. The cache used to be written only at teardown, so a run
    killed at 99% -- which a timeout does routinely, this matrix takes ~580s --
    threw away every answer it had just paid four processes to compute."""
    if len(cache) - _WROTE[0] < every:
        return
    _WROTE[0] = len(cache)
    worker = os.environ.get("PYTEST_XDIST_WORKER", "main")
    path = os.path.join(OUT, "delta-cache.%s.json" % worker)
    try:
        os.makedirs(OUT, exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(cache, f)
        os.replace(tmp, path)
    except OSError:
        pass


def _agree(label, argv_extra, fp, stations, cache, timeout=180):
    answers = {}
    for name, (argv, cwd, ident) in stations.items():
        key = "%s|%s" % (name, label)
        want = hashlib.sha256((fp + ident).encode()).hexdigest()
        hit = cache.get(key)
        if hit and hit.get("fp") == want and not FULL:
            answers[name] = hit["out"]
            continue
        ok, got = _sh(list(argv) + argv_extra, cwd, timeout)
        assert ok, "%s could not run %s: %s" % (name, label, got)
        out = got or "<refused>"
        answers[name] = out
        cache[key] = {"fp": want, "out": out}
        _flush(cache)
    ref = answers[REFERENCE]
    for name, out in sorted(answers.items()):
        assert out == ref, (
            "%s answered %r for %s; %s answered %r (stations: %s)"
            % (name, out, label, REFERENCE, ref, sorted(answers)))


@pytest.mark.parametrize("case", _cases())
def test_every_station_answers_the_same(case, stations, fingerprints, cache):
    """One case, every built station, byte-identical -- or cached as such.

    THE ASSUMPTION, stated because a delta that is wrong is worse than a slow
    one: the fingerprint covers the DEFs a case refers to STATICALLY. Where
    canon resolves a DEF by a name it read out of DATA -- a derivation recipe
    naming its own function, an override consulted by name -- an edit to that
    DEF is invisible here and the case will not re-run. AREST_STATIONS_FULL=1
    ignores the cache entirely and is what a merge should run.
    """
    fp, _n = fingerprints[case]
    _agree(case, ["case", case], fp, stations, cache)


def test_the_law_report_agrees(stations, cache, laws_fingerprint):
    """All 53 laws, printed, byte-identical across every built station.

    Whole-report granularity, and the fingerprint is over ALL of canon rather
    than a closure: main dispatches a bare invocation straight to law:report,
    there is no way to ask for one law, and the laws read a composed store
    whose contents no static closure describes. So this re-runs whenever canon
    or a carrier or a runner changes -- and skips entirely when none did, which
    is most edits: ui:ctl_entry, system:h_entity and rmap:keyof reach zero of
    the 96 law DEFs between them.
    """
    _agree("law:report", [], laws_fingerprint, stations, cache, timeout=2400)


@pytest.fixture(scope="session")
def laws_fingerprint():
    h = hashlib.sha256()
    for p in (os.path.join(ROOT, "arest"),
              os.path.join(ORACLE, "design-state"),
              os.path.join(ORACLE, "norma-answer"),
              os.path.join(ORACLE, "journal")):
        with open(p, "rb") as f:
            h.update(f.read())
    return h.hexdigest()


EXPECTED = ("js", "java", "cs", "rust")


def test_every_station_is_actually_built(stations):
    """A station that will not start drops out of the comparison SILENTLY, so
    a four-way check quietly becomes a two-way one. It did: cs and rust were
    given their binary's directory as cwd instead of their own, neither
    started, and 566 cases passed on js and java alone. This is the alarm."""
    missing = [s for s in EXPECTED if s not in stations]
    assert not missing, (
        "not built, so NOT COMPARED: %s (comparing only %s)"
        % (missing, sorted(stations)))
