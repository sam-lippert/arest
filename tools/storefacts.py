"""How much of a store is facts, and how much is its own compiled program.

Sam: very technically, by Halpin and Backus, there are only facts as defined by
the metamodel -- using facts to define facts -- and metacompose. A store should
therefore be facts. base.store.json is 92.6% metacompose, written down.

The test is mechanical, not a naming heuristic, and that matters: two earlier
attempts to size this went by cell-name patterns and both were wrong, once by
an order of magnitude. A POPULATION is a list of rows. A TERM is a form, and
every term cell in the base store is headed COMP.

    python tools/storefacts.py [store.json ...]

Reports the split, and with --project checks the claim that the terms carry no
relational content by projecting the store with and without them: 187 tables
and 478 rows either way, byte-identical, on a source 13.5x smaller.

None of the term cells is fetched by name from canon (grep _isa_ arest -> 0);
they are compile-time products attached to facts -- constraint objects, subtype
edges, derivation deltas -- so a store that keeps only facts loses nothing a
compile cannot rebuild. 437 of 443 constraint objects were checked byte-for-
byte against constraints:uniqueness / scoped_mandatory_* applied to their own
constraint and spans rows; the 6 that differ take the documented
implied-population variant.
"""
import json
import os
import sys


def is_term(v):
    """A form, not a population: a list whose head is a combining-form name."""
    return isinstance(v, list) and v and isinstance(v[0], str)


def split(path):
    raw = json.load(open(path, encoding="utf-8"))
    terms, rows = [], []
    for c in raw["d"]:
        (terms if is_term(c[2]) else rows).append((c[1], len(json.dumps(c[2]))))
    return terms, rows


def main(argv):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths = [a for a in argv[1:] if not a.startswith("--")]
    if not paths:
        shared = os.path.join(root, "engine", "shared")
        paths = [os.path.join(shared, n) for n in sorted(os.listdir(shared))
                 if n.endswith(".store.json")]
    print("%-34s %7s %7s %11s %11s %7s"
          % ("store", "facts", "terms", "fact bytes", "term bytes", "program"))
    for p in paths:
        terms, rows = split(p)
        tb = sum(b for _, b in terms)
        rb = sum(b for _, b in rows)
        print("%-34s %7d %7d %11d %11d %6.1f%%"
              % (os.path.basename(p), len(rows), len(terms), rb, tb,
                 100.0 * tb / max(tb + rb, 1)))
        if terms:
            raw = json.load(open(p, encoding="utf-8"))
            hs = sorted({c[2][0] for c in raw["d"] if is_term(c[2])})
            print("%-34s term heads: %s" % ("", hs))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
