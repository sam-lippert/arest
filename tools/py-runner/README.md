# py-runner — the composed checker, Python parity station

The seventh μ, beside `tools/{cs,js,java,c,rust}-runner` and the wasm leg.
Same doctrine: the laws are canon DEFs (the `law:` family in `arest`),
never host code; the canon and the carriers enter AS SOURCE and python
just executes the composed file. Nothing is read, eval'd, or interpreted
at runtime beyond Python running its own module.

    cat head.part.py ../../arest mid1.part.py ../norma-oracle/design-state \
        mid2.part.py ../norma-oracle/norma-answer tail.part.py > composed.g.py
    python composed.g.py            # base: law:report (22 laws), exit 0 iff all T

    # apps swap the two carrier files (../../apps/order, ../../apps/family)
    python composed.g.py app        # law:app_report (10 laws)

`composed*.g.py`, `__pycache__/`, and `*.txt` captures are generated and
untracked.

## The zero-name join

The canon's opening docstring claims the file is "a normal Python module."
In this station that claim EXECUTES: the join is nothing at all. Each of
the three tuples is a bare expression statement — Python evaluates it left
to right for its `DEF` side effects and discards the value, and the
statement ends at the closing parenthesis. No `CANON` wrap (js needed one
because ASI would have turned adjacent tuples into a call; Python has no
such hazard), no linker (CPython parses the 520KB literal whole — no
method-size cap, no superlinear type checking). Where C# has the one extra
name and Java and Rust have honest linkers, Python has an empty diff
between "the canon" and "the program."

## Representation

Sequences are Python tuples, numbers are ints, atoms are strs; booleans
are the atoms `"T"`/`"F"` and no Python `bool` is ever constructed (so
bool-is-int never bites). Python's `==` is exactly DeepEq — elementwise
on tuples, cross-kind False, never a coercion. Two adaptations, both
observationally invisible: COND branches and DEF-name resolution iterate
instead of recurse (Python frames are heavy; results and deaths are
identical), and the report runs on a thread with a 128MB stack — the
Windows CPython maximum — because the canonical recursion is deeper than
the main-thread default.

## Strictness is the point

| pathology | lenient μ | this μ |
|---|---|---|
| selector on an atom | returns a character | **dies** |
| selector out of range | undefined value | **dies** |
| compare across atom kinds | coerces / stringifies | **dies** |
| duplicate DEF | silent overwrite | **dies** |
| unresolved atom | undefined value | **dies** |
| `tl`/`tlr`/`1r`/`INSERT` on `()`, `implode` on a non-string | `()` / coerced | **dies** (Backus 11.2.3: ⊥) |

One documented simplification shared with the c/rust stations: `slug`
filters by `str.isalnum` (a hair wider than C#'s `IsLetterOrDigit` outside
ASCII) and comparison is by code point where C#/Java/JS use UTF-16 code
units. Every name and value the laws slug or sort is ASCII, where all
orders coincide; the byte-identical cross-station verdicts are the
standing check.

## The parity it joins

Byte-identical verdict output (modulo CRLF) with the C#, JS (bun), Java,
C, Rust, and WASM stations across the 22 base laws and 10 app laws on
each app; under the canon mutation trial (`induce:reset_pair` made dead)
it flips exactly `induce-exactness` and `induce-facts-emitted`, like
every other μ. Seven evaluators, six languages, five runtime models —
and in this one, the canon runs as the Python module its own first
docstring says it is.
