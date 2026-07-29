"""THE MISSING AXIS: is each canon file still INTERSECTION SOURCE?

shared/intersection.md is the discipline of record and states the file shape:
"One tuple literal per file... Every element is either a DEF(name, tree) call or
a double-quoted description string. Nothing else: no imports, no assignments, no
host functions, no comments (the comment syntaxes do not intersect), and
double-quoted strings only... No trailing comma before the file's closing paren".

NOTHING ENFORCED IT. The existing tests approach the property from the wrong
side, and each is satisfied by a file no longer in the intersection:

  test_intersection.py          compares REDUCTION RESULTS of ~13 named DEFs
                                across the two kernels. Its strongest-sounding
                                test, `test_both_kernels_consume_the_identical
                                _file`, checks five DEFs reduce alike -- not that
                                the file is consumable by every host.
  test_canon_coverage.py        asks host-ops-vs-shared/*.canon, never
                                shared-vs-canon (see #88, cont 513).
  the cross-kernel differential runs only where a host was pointed at the file.

So a file that four of the five hosts accept passes everything, because the
fifth host is never pointed at it. That is exactly what happened: the ROOT canon
accumulated eight `//` comment lines -- legal Rust, C#, Java and JS, invalid
Python -- while only the curated engine/shared/arest.canon was fed to CPython.
The drift was invisible to every host that could read it.

This test asks the property DIRECTLY, of the bytes, for every canon file. It
needs no host and no reduction: Python's own parser IS the strictest reader of
the intersection, so `ast.parse` alone catches the comment syntaxes that do not
intersect, and the tree shape catches everything else.
"""
import ast
import io
import os

import pytest

# Every file that CLAIMS intersection-source status, located by PATH rather than
# through a host's resolver. Deliberate: this guard must not depend on which file
# a host happens to be pointed at -- that dependency is what let the root canon
# drift while only the curated copy was ever fed to CPython. Resolving here means
# the property is checked for every such file, always.
_ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ROOT = os.path.dirname(_ENGINE)

CANON_FILES = (
    os.path.join(_ROOT, "arest"),                        # THE canon
    os.path.join(_ENGINE, "shared", "arest.canon"),      # the curated copy, while it exists
    os.path.join(_ENGINE, "shared", "scenarios.canon"),
)


def _src(path):
    return path, io.open(path, encoding="utf-8", newline="").read()


def _ids(paths):
    return [os.path.basename(os.path.dirname(p)) + "/" + os.path.basename(p) for p in paths]


@pytest.mark.parametrize("path", CANON_FILES, ids=_ids(CANON_FILES))
def test_the_file_parses_as_python(path):
    """Python is the strictest reader, so its parser IS the intersection gate.

    A `//` or `/* */` comment, a single-quoted multi-character string, or any
    C-family-only construct fails here and nowhere else."""
    path, src = _src(path)
    try:
        ast.parse(src)
    except SyntaxError as e:
        pytest.fail(
            "%s is not intersection source: %s at line %s\n    %s\n"
            "shared/intersection.md forbids comments (the comment syntaxes do "
            "not intersect). Carry commentary as a double-quoted DESCRIPTION "
            "STRING element, or put it outside the file." % (
                path, e.msg, e.lineno, (e.text or "").rstrip()))


@pytest.mark.parametrize("path", CANON_FILES, ids=_ids(CANON_FILES))
def test_the_file_is_one_tuple_of_DEF_calls_and_description_strings(path):
    """One tuple literal whose every element is a DEF call or a description string.

    intersection.md says "The FIRST element may be a double-quoted string (the
    file's own description); every other element is a DEF(name, tree) call.
    Nothing else." THAT SENTENCE IS STALE, and this test is deliberately written
    to the practised invariant instead. Measured on canon: 1206 top-level
    elements = 1152 DEF + 54 string + 0 other. The strings are the merged files'
    own docstrings (elements 22, 80, 118 are visibly theta/ast/command headers)
    plus dated design notes -- element 145 is the one documenting
    system:compile_rule_neg. The document predates the merge of the several
    shared/*.canon files into one canon and never caught up.

    A string element is legal in every host: a tuple element in Python and Rust
    (the latter under #[allow(path_statements)]), a varargs argument in C# and
    Java, an operand of JS's comma operator. Since the comment syntaxes do not
    intersect, a description string is THE sanctioned way to carry commentary
    inside a canon file -- so forbidding it past position 0 would forbid the only
    mechanism there is.

    What this still refuses is anything that is neither: an assignment, an
    import, a bare name, a call to something other than DEF."""
    path, src = _src(path)
    mod = ast.parse(src)
    assert len(mod.body) == 1, "%s: expected ONE expression, got %d statements" % (
        path, len(mod.body))
    assert isinstance(mod.body[0], ast.Expr), "%s: not an expression statement" % path
    top = mod.body[0].value
    assert isinstance(top, ast.Tuple), "%s: top level is %s, not a tuple literal" % (
        path, type(top).__name__)

    for i, el in enumerate(top.elts):
        if isinstance(el, ast.Constant) and isinstance(el.value, str):
            continue                      # a description string
        assert isinstance(el, ast.Call), (
            "%s: element %d (line %s) is %s; every element must be a DEF(name, tree) "
            "call or a double-quoted description string" % (
                path, i, el.lineno, type(el).__name__))
        assert isinstance(el.func, ast.Name) and el.func.id == "DEF", (
            "%s: element %d (line %s) calls %s, not DEF" % (
                path, i, el.lineno, getattr(el.func, "id", type(el.func).__name__)))


@pytest.mark.parametrize("path", CANON_FILES, ids=_ids(CANON_FILES))
def test_no_trailing_comma_before_the_closing_paren(path):
    """The C# and Java hosts wrap the bytes as a VARARGS ARGUMENT LIST, and
    neither language accepts a trailing comma there. Python and Rust accept
    both forms, so the strictest reader sets the rule (intersection.md)."""
    path, src = _src(path)
    body = src.rstrip()
    assert body.endswith(")"), "%s: does not end with the closing paren" % path
    assert not body[:-1].rstrip().endswith(","), (
        "%s: trailing comma before the closing paren -- rejected by the C# and "
        "Java varargs wrap" % path)


@pytest.mark.parametrize("path", CANON_FILES, ids=_ids(CANON_FILES))
def test_double_quoted_strings_only(path):
    """A multi-character single-quoted string is a broken char literal to the
    C-family tokenizers, so the intersection admits double quotes only. Checked
    on the bytes because `ast` discards quote style."""
    path, src = _src(path)
    bad, i, n, inq = [], 0, len(src), False
    line = 1
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
        elif inq:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                inq = False
        elif c == '"':
            inq = True
        elif c == "'":
            bad.append(line)
        i += 1
    assert not bad, "%s: single quote(s) at line(s) %s -- double-quoted only" % (
        path, bad[:10])
