"""Write the expected answers every host asserts against.

Each host runs the same canon over the same carriers, so "the hosts agree" can
be checked WITHOUT one host driving the others: each asserts its own output
against a checked-in expectation, and agreement follows transitively. That is
what removes python from the loop -- verifying the js host should need bun and
nothing else.

    engine/shared/expected-cases.tsv   <case>\\t<json-encoded answer>
    engine/shared/expected-laws.txt    law:report, verbatim

The answer is JSON-encoded rather than escaped by hand. Two case answers are
SQL DDL containing real newlines, and a hand-rolled escaper silently produced a
file with 573 lines for 566 rows -- it only surfaced because the counts did not
match. json.dumps is a correct escaper that every host can already decode, and
one row stays one line, so the file diffs.

Regenerating is a review event: a changed answer is a changed line, visible in
the diff, which a byte-comparison between four hosts never was.
"""
import glob
import json
import os
import sys

HOSTS = ["js", "java", "cs", "rust"]


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(root, "engine", "tests"))
    import test_stations as ts

    d = {}
    for f in glob.glob(os.path.join(ts.OUT, "delta-cache*.json")):
        with open(f, encoding="utf-8") as fh:
            d.update(json.load(fh))
    if not d:
        print("no cached answers; run the host comparison first")
        return 1

    cases = sorted({k.split("|", 1)[1] for k in d
                    if k.split("|", 1)[1].startswith("case:")})
    rows, disagree, partial = [], [], []
    for c in cases:
        got = {h: d["%s|%s" % (h, c)]["out"] for h in HOSTS
               if "%s|%s" % (h, c) in d}
        if len(got) != len(HOSTS):
            partial.append(c)
            continue
        if len(set(got.values())) != 1:
            disagree.append(c)
            continue
        rows.append((c, next(iter(got.values()))))

    out = "".join("%s\t%s\n" % (c, json.dumps(a)) for c, a in rows)
    p = os.path.join(root, "engine", "shared", "expected-cases.tsv")
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    law = d.get("js|law:report", {}).get("out", "")
    pl = os.path.join(root, "engine", "shared", "expected-laws.txt")
    with open(pl, "w", encoding="utf-8", newline="\n") as f:
        f.write(law + "\n")

    # the file has to read back as exactly what was written, or it is not an
    # expectation, it is a hope
    back = {}
    with open(p, encoding="utf-8") as f:
        for line in f:
            k, _, v = line.rstrip("\n").partition("\t")
            back[k] = json.loads(v)
    assert back == dict(rows), "the golden does not round-trip"

    print("cases: %d   round-trips: yes   refusals: %d"
          % (len(rows), sum(1 for _, a in rows if a == "<refused>")))
    print("laws: %d bytes, %d 'law OK'" % (len(law), law.count("law OK")))
    if disagree:
        print("EXCLUDED, hosts disagree: %s" % disagree[:5])
    if partial:
        print("EXCLUDED, not answered by every host: %s" % partial[:5])
    return 1 if (disagree or partial) else 0


if __name__ == "__main__":
    sys.exit(main())
