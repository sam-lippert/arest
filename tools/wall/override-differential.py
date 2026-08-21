"""Do engine/rust's NATIVE overrides answer what their canon DEFs answer?

THE WALL CANNOT ASK THIS. Every name in DEF_OVERRIDES is also a canon DEF, and
a DEFS cell is consulted before prim() -- where resolve_def lives -- so the 519
cases reduce the canon body and the native twin never runs. Running the whole
case table with AREST_NO_OVERRIDE=* is byte-identical to running it without,
which looks like certification and is the overrides never being reached.

They fire on the RESIDENT path only. --serve accepts both forms over one store:

    {"cases":[{"f":...,"xd":[],"fuel":0}]}   the canon body      (the meaning)
    {"op":"neval","f":...,"x":"x"}           the native prim     (the twin)

so this sends both and compares. derive.rs pins entity_view, ev_cols and
vb_fetch that way; the five theta arms had nothing.

A BOTTOM ON BOTH SIDES IS NOT AGREEMENT. An operand of the wrong shape errors
identically down both paths and would score as a pass, which is the quiet-skip
shape that has already put three wrong numbers in this repo. Those are counted
separately and never as agreement.

    python tools/wall/override-differential.py [--verbose]
"""
import json
import os
import subprocess
import sys

# operands per override: shapes taken from the canon DEFs' own callers, with
# the edge cases each function's body distinguishes (empty, singleton,
# duplicate, nested, absent).
PROBES = [
    ("theta:dedup", [[["a"], ["b"], ["a"]], [], [["x"]], [["a"], ["a"], ["a"]]]),
    ("theta:flatten", [[[["a"], ["b"]], [["c"]]], [], [[], [["z"]]]]),
    ("theta:append_phi", [[["a"], ["b"]], [], [["only"]]]),
    ("theta:member", [["b", [["a"], ["b"]]], ["z", [["a"]]], ["a", []]]),
    ("theta:join_combine", [[[["a", "1"]], [["a", "2"]]], [[], []]]),
]


def main(argv):
    verbose = "--verbose" in argv
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    exe = os.path.join(root, "engine", "rust", "target", "debug", "arest.exe")
    if not os.path.exists(exe):
        print("no debug binary at %s -- cargo build first" % exe)
        return 2

    lines, meta = [], []
    for name, operands in PROBES:
        for op in operands:
            f = ["COMP", name, ["CONST", op]]
            lines.append(json.dumps({"op": "neval", "f": f, "x": "x"}))
            meta.append((name, op, "native"))
            lines.append(json.dumps({"cases": [{"f": f, "xd": [], "fuel": 0}]}))
            meta.append((name, op, "canon"))

    env = dict(os.environ, AREST_NEVAL_TRACE="1")
    p = subprocess.run([exe, "--serve"], input="\n".join(lines) + "\n",
                       capture_output=True, text=True, env=env, timeout=600)
    out = [l for l in p.stdout.splitlines() if not l.startswith("neval-def")]
    if len(out) != len(meta):
        print("PROTOCOL MISMATCH: sent %d, got %d replies -- not measured"
              % (len(meta), len(out)))
        return 2

    def value(kind, line):
        try:
            j = json.loads(line)
        except Exception:
            return None, "unparsed"
        if kind == "native":
            if not isinstance(j, dict) or "result" not in j:
                return None, j.get("error", "no result") if isinstance(j, dict) else "shape"
            return j["result"].get("result"), None
        if isinstance(j, list) and len(j) == 1:
            return j[0], None
        return None, "cases shape"

    agree = differ = bottom = 0
    pairs = [(meta[i], out[i], meta[i + 1], out[i + 1])
             for i in range(0, len(meta), 2)]
    for (name, op, _), nline, (_, _, _), cline in pairs:
        nv, nerr = value("native", nline)
        cv, cerr = value("canon", cline)
        if nerr or cerr or nv is None or cv is None:
            bottom += 1
            print("BOTTOM  %-20s %s -- native:%s canon:%s"
                  % (name, json.dumps(op)[:38], nerr or "ok", cerr or "ok"))
        elif nv == cv:
            agree += 1
            if verbose:
                print("agree   %-20s %s = %s"
                      % (name, json.dumps(op)[:38], json.dumps(nv)[:40]))
        else:
            differ += 1
            print("DIFFERS %-20s %s" % (name, json.dumps(op)[:38]))
            print("        native %s" % json.dumps(nv)[:100])
            print("        canon  %s" % json.dumps(cv)[:100])
    print("---")
    print("agree %d / differ %d / not-measured %d" % (agree, differ, bottom))
    return 1 if differ else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
