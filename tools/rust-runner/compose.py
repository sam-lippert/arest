# -*- coding: utf-8 -*-
# The Rust LINKER for the composed checker — the same honest deviation the
# Java station carries, forced here not by a format limit but by rustc's
# cost model: type inference, trait resolution, and drop elaboration are
# superlinear in single-function-body size, and the canon's one tuple
# literal as a single CANON!(...) invocation type-checks for ~30 minutes
# per build (ruled non-viable 2026-07-17). This script is therefore a real
# program where cs/js/c concatenate — but it is SYNTAX ONLY: it counts
# parens and quotes and splits the tuple at top-level commas into slice
# functions, registration order kept. It never inspects a name, never
# evaluates anything, and every canon byte appears verbatim in the
# generated source. No hoisting: Rust has no method-size cap, so an
# oversized single item (state:fts is ~53KB) sits whole in its own slice.
# Evaluation-order safety: slices run as sequential statements and vec!
# elements evaluate left to right, so DEF registration order is source
# order, exactly as in every other station.
#
#   python compose.py <arest> <design-state> <norma-answer> <out.rs>
import io
import os
import sys

SLICE_LIMIT = 16000   # target source chars per generated slice body

def read(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()

def strip_outer(text):
    # the three files are one parenthesized tuple: ( items )
    i = text.index("(")
    j = text.rindex(")")
    return text[i + 1:j]

def split_top(text):
    # split at depth-0 commas, string- and escape-aware
    items = []
    depth = 0
    in_str = False
    esc = False
    start = 0
    for k, c in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            items.append(text[start:k].strip())
            start = k + 1
    tail = text[start:].strip()
    if tail:
        items.append(tail)
    return items

def slices(items, prefix):
    # group items into CANON!(...) slice functions, registration order kept
    out = []
    cur = []
    cur_len = 0
    for it in items:
        if cur and cur_len + len(it) > SLICE_LIMIT:
            out.append(cur)
            cur = []
            cur_len = 0
        cur.append(it)
        cur_len += len(it) + 2
    if cur:
        out.append(cur)
    names = []
    bodies = []
    for n, group in enumerate(out):
        name = "%s%d" % (prefix, n)
        names.append(name)
        bodies.append("fn " + name + "() -> Vec<Obj> { CANON!(\n    "
                      + ",\n    ".join(group) + "\n) }")
    return names, bodies

def loader(fname, names):
    calls = "\n    ".join(x + "();" for x in names)
    return "fn " + fname + "() {\n    " + calls + "\n}"

def main():
    arest, ds, na, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    head = read(os.path.join(os.path.dirname(os.path.abspath(__file__)), "head.part.rs"))
    rn, rb = slices(split_top(strip_outer(read(arest))), "r")
    dn, db = slices(split_top(strip_outer(read(ds))), "d")
    nn, nb = slices(split_top(strip_outer(read(na))), "n")
    src = "\n\n".join(
        [head.rstrip("\n"),
         "// GENERATED below this line by compose.py (the Rust linker; see its",
         "// header for why this station splits where cs/js/c concatenate).",
         "// Every canon and carrier byte appears verbatim; slices are the",
         "// tuple's items in registration order.",
         loader("load_root", rn),
         loader("load_ds", dn),
         loader("load_na", nn)]
        + rb + db + nb) + "\n"
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(src)
    total = len(rb) + len(db) + len(nb)
    print("composed: %d slice functions (%d/%d/%d)"
          % (total, len(rb), len(db), len(nb)))

if __name__ == "__main__":
    main()
