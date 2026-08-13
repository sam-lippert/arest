# -*- coding: utf-8 -*-
# The Java LINKER for the composed checker — and the one honest deviation
# from the copy /b doctrine, forced by the JVM class-file format: a method's
# bytecode is capped at 64KB (u2 code length), so the canon's one tuple
# literal cannot compile as a single CANON(...) call the way C#, js, and
# python accept it. This script is therefore a real program where the other
# stations have byte concatenation — but it is SYNTAX ONLY: it counts parens
# and quotes, splits the tuple at top-level commas into slice methods, and
# hoists oversized balanced subexpressions into helper methods. It never
# inspects a name, never evaluates anything, and every canon byte appears
# verbatim in the generated source. Hoisting is evaluation-order-safe
# because Java evaluates arguments left to right and every hoisted
# subexpression is a pure constructor call (A/N/K/PHI/S1..S9 — DEF appears
# only at item level and is never hoisted apart).
#
#   python compose.py <arest> <design-state> <norma-answer> <journal> <out.java>
#
# The journal carrier is INTERIOR-ONLY bytes (the other stations hold its
# open paren and doc atom in mid parts); this linker synthesizes the same
# wrap before splitting, so every journal byte appears verbatim like the
# rest.
import sys
import io

SLICE_LIMIT = 16000   # max source chars per generated method body

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

helpers = []

def hoist(text):
    # return an expression of source length <= SLICE_LIMIT, hoisting the
    # largest arguments into helper methods until it fits
    if len(text) <= SLICE_LIMIT:
        return text
    assert not text.startswith('"'), "string literal exceeds slice limit"
    i = text.index("(")
    head = text[:i]
    assert text.endswith(")"), "unbalanced item"
    args = [hoist(a) for a in split_top(text[i + 1:-1])]
    while True:
        rebuilt = head + "(" + ", ".join(args) + ")"
        if len(rebuilt) <= SLICE_LIMIT:
            return rebuilt
        k = max(range(len(args)), key=lambda j: len(args[j]))
        if len(args[k]) < 64:
            return rebuilt  # nothing left worth hoisting
        name = "h%d" % len(helpers)
        helpers.append((name, args[k]))
        args[k] = name + "()"

def slices(items, prefix):
    # group items into CANON(...) slice methods, registration order kept
    out = []
    cur = []
    cur_len = 0
    for it in items:
        it = hoist(it)
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
        bodies.append("    static Object[] " + name + "() { return CANON(\n        "
                      + ",\n        ".join(group) + "\n    ); }")
    return names, bodies

def main():
    arest, ds, na, journal, out = (sys.argv[1], sys.argv[2], sys.argv[3],
                                   sys.argv[4], sys.argv[5])
    # the shared case table is OPTIONAL and loads as one more carrier, so
    # Program.java stays the six-line contract. It rides in the same binary as
    # the laws because the case cells leave law:report byte-identical.
    cases = sys.argv[6] if len(sys.argv) > 6 else None
    rn, rb = slices(split_top(strip_outer(read(arest))), "r")
    dn, db = slices(split_top(strip_outer(read(ds))), "d")
    nn, nb = slices(split_top(strip_outer(read(na))), "n")
    en, eb = slices(split_top(strip_outer('("journal"' + read(journal) + ")")), "e")
    sn, sb = (slices(split_top(strip_outer(read(cases))), "s") if cases
              else ([], []))
    hb = ["    static Object " + name + "() { return " + body + "; }" for name, body in helpers]
    j = ("    static Object[] j(Object[][] parts) {\n"
         "        int n = 0;\n"
         "        for (Object[] p : parts) n += p.length;\n"
         "        Object[] r = new Object[n];\n"
         "        int i = 0;\n"
         "        for (Object[] p : parts) { System.arraycopy(p, 0, r, i, p.length); i += p.length; }\n"
         "        return r;\n"
         "    }")
    def loader(fname, field, names):
        calls = ", ".join(x + "()" for x in names)
        return ("    static void " + fname + "() { " + field
                + " = j(new Object[][] { " + calls + " }); }")
    src = "\n".join(
        ["// GENERATED by compose.py (the Java linker; see its header for why",
         "// this station splits where the others concatenate). Every canon and",
         "// carrier byte appears verbatim below; helpers are hoisted balanced",
         "// subexpressions, slices are the tuple's items in registration order.",
         "final class Composed extends Arest {",
         "    static Object[] ROOT, DS, NA, J, SC;",
         j,
         "    static void load() { loadRoot(); }",
         loader("loadRoot", "ROOT", rn),
         loader("loadCarriers0", "DS", dn),
         loader("loadCarriers1", "NA", nn),
         loader("loadCarriers2", "J", en)]
        + ([loader("loadCases", "SC", sn)] if sn else [])
        + ["    static void loadCarriers() { loadCarriers0(); loadCarriers1(); loadCarriers2();"
           + (" loadCases();" if sn else "") + " }"]
        + rb + db + nb + eb + sb + hb
        + ["}"])
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(src + "\n")
    total = len(rb) + len(db) + len(nb)
    print("composed: %d slice methods (%d/%d/%d), %d hoisted helpers"
          % (total, len(rb), len(db), len(nb), len(helpers)))

if __name__ == "__main__":
    main()
