# THE LINKER, rust station — the one honest deviation, mirroring
# tools/java-runner/compose.py's justification exactly. A real program, but
# SYNTAX ONLY: it counts parens and quotes, and never inspects a name or
# evaluates anything. Every canon byte appears verbatim in the emitted file.
#
# It does two jobs, and they are NOT the same class. Only the second is a real
# platform limit of the kind java's compose.py answers.
#
# 1. A NOTATION GAP, and the rewrite is the right fix — not a stopgap.
#    Two earlier versions of this header were wrong in opposite directions.
#    The first called it a platform limit on par with the JVM's 64 KB cap; it
#    is not, since under currying arity is free. The second concluded the
#    serializer should stop emitting variadics and chunk in nines instead.
#    Reading norma-oracle/Verifier.cs refutes that: it has THREE deliberate
#    spellings — ISeq recurses in nines where depth is harmless, IChunked
#    always wraps one level, and IFlatSeq emits the arity-free `S(` where
#    "a sequence must stay FLAT regardless of length, so that length is never
#    encoded as depth — DEPTH ALREADY MEANS TENANCY here (backus78 14.7,
#    AREST.tex prop:tenant)". Nesting those 23 sites would collide length with
#    the structure that makes a tenant a sub-store.
#    So the variadic is load-bearing, and Backus 13.2 rule 4 is the authority:
#    a sequence has arbitrary length n, and "S1..S9 is notation, not
#    mathematics". Rust cannot spell arbitrary arity, so this rewrite to
#    `Sv(vec![ ... ])` supplies the missing NOTATION and changes no value.
#    The canon needs none of it (S1..S9 30,524 times, bare S( zero times),
#    which is why engine/rust can include! the raw canon bytes.
#
# 2. ONE 1.7 MB EXPRESSION DEFEATS LLVM. The canon is a single tuple literal,
#    and codegen over it does not finish: full release ran >20 min and even
#    opt-level 1 timed out at ~10 min, while opt-level 0 compiles in ~25 s.
#    That left the station unoptimised and so ~20x slower than the three JIT'd
#    hosts it is compared against. Splitting the tuple at TOP-LEVEL COMMAS into
#    chunked functions gives LLVM many small bodies instead of one enormous
#    one. The DEF calls run once at load, so nothing is lost by chunking them.
#
#   python compose.py <in> <out>            # carriers: varargs rewrite only
#   python compose.py --split <in> <out>    # canon: rewrite + chunk into fns
import io
import re
import sys

BARE_S = re.compile(r"(?<![A-Za-z0-9_])S\(")
# Bound the SOURCE LENGTH of a generated body, not the element count. LLVM's
# cost over one body is superlinear: the unsplit 1.7 MB expression never
# finished, 5 bodies of 250 elements took 9m39s, 31 bodies took 4m32s. Element
# count alone is the wrong bound — design-state has only 27 top-level elements
# and one DEF is megabytes wide, so chunking by count put them all in one body
# again. Oversized items are HOISTED apart first (see hoist), exactly as
# java-runner/compose.py does for the JVM's 64 KB method cap.
SLICE_LIMIT = 8000


def matching_close(text, open_paren):
    """Index of the ')' closing the '(' at open_paren, honouring strings."""
    depth = 0
    instr = False
    esc = False
    k = open_paren
    while k < len(text):
        c = text[k]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
        elif c == '"':
            instr = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return k
        k += 1
    raise ValueError("unbalanced parentheses at %d" % open_paren)


def rewrite_varargs(text):
    """`S( ... )` -> `Sv(vec![ ... ])`, positionally, one pass."""
    opens = [m.end() - 1 for m in BARE_S.finditer(text)]
    closes = {matching_close(text, j) for j in opens}
    openset = set(opens)
    out = []
    for i, c in enumerate(text):
        if i in openset:
            out.append("v(vec![")     # the 'S' is already emitted
        elif i in closes:
            out.append("])")
        else:
            out.append(c)
    return "".join(out), len(opens)


def top_level_elements(text):
    """The tuple literal's elements, split only at depth-0 commas outside
    strings. No element's bytes are altered. Mirrors java compose.py's own
    split and gen_canon.py's top_level_elements."""
    s = text.strip()
    if not (s.startswith("(") and s.endswith(")")):
        raise ValueError("not a tuple literal")
    inner = s[1:-1]
    elems = []
    depth = 0
    instr = False
    esc = False
    start = 0
    for i, c in enumerate(inner):
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
            continue
        if c == '"':
            instr = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            elems.append(inner[start:i])
            start = i + 1
    elems.append(inner[start:])
    return [e for e in elems if e.strip()]


def split_top_args(text):
    """The comma-separated arguments of one call's parenthesised body."""
    args = []
    depth = 0
    instr = False
    esc = False
    start = 0
    for i, c in enumerate(text):
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
            continue
        if c == '"':
            instr = True
        elif c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        elif c == "," and depth == 0:
            args.append(text[start:i])
            start = i + 1
    args.append(text[start:])
    return args


HELPERS = []
PREFIX = [""]      # the emitted file's fn-name family, set per run


def hoist(text):
    """Return an expression of source length <= SLICE_LIMIT, lifting the
    largest arguments into helper fns until it fits.

    EVALUATION-ORDER SAFE: Rust evaluates call arguments left to right, and a
    hoisted argument is replaced by `hN()` IN THE SAME POSITION, so the order
    of any side effect is unchanged. DEF (the only effectful name) appears at
    item level and is never hoisted apart, exactly as java-runner/compose.py
    argues for the JVM.
    """
    t = text.strip()
    if len(t) <= SLICE_LIMIT:
        return t
    if t.startswith('"'):
        raise ValueError("string literal exceeds slice limit")
    i = t.index("(")
    head = t[:i]
    if not t.endswith(")"):
        raise ValueError("unbalanced item")
    args = [hoist(a) for a in split_top_args(t[i + 1:-1])]
    while True:
        rebuilt = head + "(" + ", ".join(args) + ")"
        if len(rebuilt) <= SLICE_LIMIT:
            return rebuilt
        k = max(range(len(args)), key=lambda j: len(args[j]))
        if len(args[k]) < 64:
            return rebuilt          # nothing left worth hoisting
        name = "%s_h%d" % (PREFIX[0], len(HELPERS))
        HELPERS.append((name, args[k]))
        args[k] = name + "()"


def main():
    args = sys.argv[1:]
    split = args and args[0] == "--split"
    if split:
        args = args[1:]
    src, dst = args[0], args[1]
    text = io.open(src, encoding="utf-8", newline="").read()

    if not split:
        body, n = rewrite_varargs(text)
        io.open(dst, "w", encoding="utf-8", newline="").write(body)
        note = "%d varargs sequences rewritten" % n
    else:
        # Hoist on the RAW form, where every item is a uniform `Name(args)`.
        # The varargs rewrite runs last, over the emitted file, so helper
        # bodies and chunk bodies are rewritten alike — doing it first turns
        # items into `Sv(vec![..])`, whose bracket macro the splitter (which
        # only understands calls, exactly like java compose.py) cannot walk.
        body = text
        # one fn-name family per emitted file, so canon and each carrier can
        # all be split without colliding
        stem = re.sub(r"[^A-Za-z0-9]", "_",
                      dst.replace("\\", "/").rsplit("/", 1)[-1].split(".")[0])
        del HELPERS[:]
        PREFIX[0] = stem
        elems = [hoist(e) for e in top_level_elements(body)]
        # group by SOURCE LENGTH, registration order kept
        chunks = []
        cur = []
        cur_len = 0
        for e in elems:
            if cur and cur_len + len(e) > SLICE_LIMIT:
                chunks.append(cur)
                cur = []
                cur_len = 0
            cur.append(e)
            cur_len += len(e) + 2
        if cur:
            chunks.append(cur)

        out = ["// GENERATED by tools/rust-station/compose.py — syntax only.\n",
               "// Every source byte is verbatim; only the tuple's top-level\n",
               "// commas became statement boundaries, and oversized arguments\n",
               "// were lifted into hN() helpers called in the same position.\n",
               "// Do not edit.\n"]
        for name, expr in HELPERS:
            out.append("#[allow(non_snake_case, unused)]\n")
            out.append("fn %s() -> V {\n    use crate::vocab::*;\n    %s\n}\n"
                       % (name, expr.strip()))
        for k, ch in enumerate(chunks):
            out.append("#[allow(non_snake_case, unused, path_statements)]\n")
            out.append("fn %s_%d() {\n    use crate::vocab::*;\n" % (stem, k))
            for e in ch:
                out.append("    %s;\n" % e.strip())
            out.append("}\n")
        out.append("#[allow(non_snake_case, unused)]\nfn load_%s_all() {\n" % stem)
        for k in range(len(chunks)):
            out.append("    %s_%d();\n" % (stem, k))
        out.append("}\n")
        emitted, n = rewrite_varargs("".join(out))
        io.open(dst, "w", encoding="utf-8", newline="").write(emitted)
        note = "%d elements, %d hoisted helpers, %d chunk fns, %d varargs rewritten" % (
            len(elems), len(HELPERS), len(chunks), n)

    print("  %s -> %s (%s)" % (src.replace("\\", "/").rsplit("/", 1)[-1],
                               dst.replace("\\", "/").rsplit("/", 1)[-1], note))


if __name__ == "__main__":
    main()
