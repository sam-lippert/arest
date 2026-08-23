"""Read a canon DEF as a tree instead of as a line.

Canon files take no comments, so a long DEF arrives as one unbroken line. I
twice called my own work "generated" on the strength of that and declined to
read it -- system:rmap_side, 4133 characters, which decides where every absorbed
fact type in every app lands. It is a tree. It was just never printed like one.

    sh -c 'cd <repo> && python tools/wall/canonfmt.py system:rmap_side'
    python tools/wall/canonfmt.py rmap:coldisamb --width=100 --depth=6

Indents by structure, collapses any subtree that fits on a line, and names the
FFP form each S-constructor builds:

    COMP(f, g, h)   f after g after h        ALPHA(f)   map f
    CONS(f, g)      the pair <f(x), g(x)>    K(v)       the constant v
    COND(p, t, e)   if p then t else e       N(k)       select k

The durable fix is still decomposition -- a name is the only documentation canon
allows inside a body, so a DEF that needs a diagram wants to be several DEFs.
This makes the reading possible in the meantime, and makes the decomposition
something you can see rather than guess at.
"""
import re
import sys


def parse(s, i=0):
    """S-expression -> nested lists. Atoms are strings."""
    while i < len(s) and s[i] in " \n\t":
        i += 1
    if s[i] == '"':
        j = i + 1
        while s[j] != '"':
            j += 2 if s[j] == "\\" else 1
        return s[i:j + 1], j + 1
    m = re.match(r"[A-Za-z_][A-Za-z_0-9]*", s[i:])
    if not m:
        m = re.match(r"-?\d+", s[i:])
        return m.group(0), i + m.end()
    head, i = m.group(0), i + m.end()
    if i >= len(s) or s[i] != "(":
        return head, i
    i += 1
    kids = []
    while True:
        while i < len(s) and s[i] in " ,\n\t":
            i += 1
        if s[i] == ")":
            return [head] + kids, i + 1
        node, i = parse(s, i)
        kids.append(node)


def flat(n):
    if isinstance(n, str):
        return n
    return "%s(%s)" % (n[0], ", ".join(flat(k) for k in n[1:]))


LABEL = {"COMP": "after", "CONS": "pair", "COND": "if", "ALPHA": "map",
         "K": "const", "N": "sel", "WHILE": "while", "INSERT": "fold"}


def render(n, ind=0, width=92, depth=99, out=None):
    out = out if out is not None else []
    pad = "  " * ind
    s = flat(n)
    if isinstance(n, str) or len(pad) + len(s) <= width or ind >= depth:
        out.append(pad + s)
        return out
    head = n[0]
    # S-constructors carry their arity in the name; show the form they build
    tag = ""
    if head.startswith("S") and head[1:].isdigit() and len(n) > 1:
        inner = n[1]
        if isinstance(inner, list) and inner[0] == "A":
            nm = inner[1].strip('"')
            tag = "   <- %s%s" % (nm, "  (%s)" % LABEL[nm] if nm in LABEL else "")
    out.append("%s%s(%s" % (pad, head, tag))
    for k in n[1:]:
        render(k, ind + 1, width, depth, out)
    out.append(pad + ")")
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if "=" in a}
    name = args[0]
    src = open("arest", encoding="utf-8").read()
    m = re.search(r'(?m)^DEF\("' + re.escape(name) + r'",(.*?)(?=^DEF\(")',
                  src, re.S)
    if not m:
        print("no such DEF: %s" % name)
        sys.exit(1)
    body = m.group(1).strip().rstrip(",")
    tree, _ = parse(body)
    print("\n".join(render(tree, depth=int(opts.get("--depth", 99)),
                           width=int(opts.get("--width", 92)))))
