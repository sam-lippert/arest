"""Classify a difference between two intersection-source carriers.

    python carrier-kind.py <baseline-file> <new-file>

Prints "identical", "order only", or "content". A carrier is a list of
DEF("cell", S(...)) lines. Every set-like collection in it, the cell's own
list and every population nested inside a descriptor, is CHUNKED into S9(...)
groups (a last partial chunk is shorter, an empty one is S1(PHI())), and
consumers flatten exactly one level; every position-carrying collection, a
role list, a row, a uc span, is direct. Chunking is visible in the syntax, so
each cell is parsed and canonicalised: a chunked collection becomes the
sorted multiset of its elements, a direct one keeps its order. Two carriers
with the same canonical form differ by order only; anything else, a cell on
one side only, or an element whose own contents changed (a factorder ordinal
moving from one fact type to another counts, the ordinal is the datum), is
content.
"""
import io
import re
import sys

TOKEN = re.compile(r'\s*(?:("(?:[^"\\]|\\.)*")|([A-Z]+\d*)|(-?\d+(?:\.\d+)?)|([(),]))')
SNAME = re.compile(r"^S\d*$")


def tokens(text):
    pos = 0
    n = len(text)
    while pos < n:
        m = TOKEN.match(text, pos)
        if not m or m.end() == pos:
            if text[pos:].strip() == "":
                return
            raise ValueError("cannot tokenise at %d: %r" % (pos, text[pos:pos + 40]))
        pos = m.end()
        s, ident, num, punct = m.groups()
        if s is not None:
            yield ("str", s)
        elif ident is not None:
            yield ("id", ident)
        elif num is not None:
            yield ("num", num)
        else:
            yield ("p", punct)


class Parser(object):
    def __init__(self, text):
        self.toks = list(tokens(text))
        self.i = 0

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else (None, None)

    def take(self):
        t = self.toks[self.i]
        self.i += 1
        return t

    def node(self):
        kind, val = self.take()
        if kind in ("str", "num"):
            return val
        if kind != "id":
            raise ValueError("unexpected %r" % (val,))
        if self.peek() != ("p", "("):
            return val
        self.take()
        kids = []
        if self.peek() != ("p", ")"):
            kids.append(self.node())
            while self.peek() == ("p", ","):
                self.take()
                kids.append(self.node())
        if self.take() != ("p", ")"):
            raise ValueError("expected )")
        return (val, tuple(kids))


def is_chunked(node):
    """All children are S-nodes, every chunk but the last has exactly nine
    elements and the last has one to nine: the shape IChunked emits."""
    if not isinstance(node, tuple) or not node[1]:
        return False
    kids = node[1]
    for k in kids:
        if not isinstance(k, tuple) or not SNAME.match(k[0]):
            return False
    for k in kids[:-1]:
        if len(k[1]) != 9:
            return False
    return 1 <= len(kids[-1][1]) <= 9


def canonical(node):
    if not isinstance(node, tuple):
        return node
    if is_chunked(node):
        elems = []
        for chunk in node[1]:
            elems.extend(canonical(k) for k in chunk[1])
        return "{" + ", ".join(sorted(elems)) + "}"
    return node[0] + "(" + ", ".join(canonical(k) for k in node[1]) + ")"


def cells(path):
    out = {}
    text = io.open(path, encoding="utf-8", errors="replace").read()
    for line in text.split("\n"):
        line = line.strip().rstrip(",")
        if not line.startswith("DEF("):
            continue
        d = Parser(line).node()
        if not isinstance(d, tuple) or d[0] != "DEF" or len(d[1]) != 2:
            continue
        name, top = d[1]
        out[name] = canonical(top)
    return out


def main():
    a, b = sys.argv[1], sys.argv[2]
    ta = io.open(a, encoding="utf-8", errors="replace").read()
    tb = io.open(b, encoding="utf-8", errors="replace").read()
    if ta == tb:
        print("identical")
        return
    ca, cb = cells(a), cells(b)
    if ca == cb:
        print("order only")
    else:
        print("content")
        if len(sys.argv) > 3 and sys.argv[3] == "-v":
            for name in sorted(set(ca) | set(cb)):
                if ca.get(name) != cb.get(name):
                    print("  differs:", name)


if __name__ == "__main__":
    main()
