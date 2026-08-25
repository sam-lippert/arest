"""Which cases can a canon edit possibly change, and what is each one's fingerprint.

The station matrix is 566 cases x 4 runners. Running all of it for every edit
is what made verification cost tens of minutes, and a check nobody can afford
to run is a check that gets skipped -- which is how a green run went out over
two broken tests.

Almost none of that work is ever necessary. A case is a closed term: it can
only answer differently if one of the DEFs it REACHES changed, or if the runner
itself changed. So this builds the reference graph out of the canon text --
DEF("name", body) with every A("...") in the body an edge -- takes the
transitive closure from each case, and fingerprints the case by the bodies it
actually depends on. Same fingerprint, same answer; there is nothing to re-run.

No evaluation is involved. This is the static over-approximation, and it errs
the safe way: a name mentioned but never applied still counts as a dependency,
so the fingerprint changes more often than strictly needed and never less.
"""
import hashlib
import os
import re

DEF_START = re.compile(r'(?m)^DEF\("([^"]+)",')
COMMENT_LINE = re.compile(r'(?m)^"')
REF_RE = re.compile(r'A\("([^"]+)"\)')


def parse(text):
    """name -> body, cut at the NEXT top-level DEF.

    Not "everything up to `),` before the next DEF": canon carries prose
    between DEFs as bare top-level strings, so a DEF followed by a comment does
    not end flush against the next one. Requiring that dropped 139 of 1505
    canon DEFs and 132 of 566 cases -- silently, which for a fingerprint means
    missing real dependencies and reporting a case as unchanged when it is not.

    The trailing prose is cut too, at the first line beginning with a quote, so
    a name mentioned in a comment cannot become a false edge.
    """
    starts = [(m.group(1), m.end()) for m in DEF_START.finditer(text)]
    bounds = [m.start() for m in DEF_START.finditer(text)] + [len(text)]
    out = {}
    for i, (name, body_at) in enumerate(starts):
        body = text[body_at:bounds[i + 1]]
        cut = COMMENT_LINE.search(body)
        out[name] = body[:cut.start()] if cut else body
    return out


def graph(bodies):
    """name -> the names its body mentions, restricted to names that are DEFs.
    A mention of a primitive is not an edge: prims live in the host, and a host
    change is caught by the runner fingerprint instead."""
    known = set(bodies)
    return {n: {r for r in REF_RE.findall(b) if r in known and r != n}
            for n, b in bodies.items()}


def closure(deps, start):
    """Every DEF reachable from `start`, start included when it is a DEF."""
    seen, stack = set(), [s for s in start]
    while stack:
        n = stack.pop()
        if n in seen or n not in deps:
            continue
        seen.add(n)
        stack.extend(deps[n])
    return seen


def fingerprints(canon_text, scenario_text, extra=b""):
    """case name -> a hash over its own body and the bodies it reaches.

    `extra` is the runner's identity -- its binary or its composed source --
    because a station can change its answer with canon untouched.
    """
    canon = parse(canon_text)
    cases = parse(scenario_text)
    both = dict(canon)
    both.update(cases)
    deps = graph(both)
    out = {}
    for name, body in cases.items():
        if not name.startswith("case:"):
            continue
        reach = closure(deps, deps.get(name, set()))
        h = hashlib.sha256()
        h.update(extra)
        h.update(body.encode("utf-8"))
        for dep in sorted(reach):
            h.update(dep.encode("utf-8"))
            h.update(both[dep].encode("utf-8"))
        out[name] = (h.hexdigest(), len(reach))
    return out


def reach_map(canon_text, scenario_text):
    """case name -> the set of DEFs it reaches. For asking which cases an edit
    touches, which is the question a delta run is answering."""
    canon = parse(canon_text)
    cases = parse(scenario_text)
    both = dict(canon)
    both.update(cases)
    deps = graph(both)
    return {n: closure(deps, deps.get(n, set()))
            for n in cases if n.startswith("case:")}


def load(root):
    canon = open(os.path.join(root, "arest"), encoding="utf-8").read()
    scen = open(os.path.join(root, "engine", "shared", "scenarios.canon"),
                encoding="utf-8").read()
    return canon, scen
