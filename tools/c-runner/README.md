# c-runner — the composed checker, C parity station

A μ beside `tools/cs-runner`, `tools/js-runner`, and `tools/java-runner`, in
the one mainstream language with no garbage collector and no runtime. Same
doctrine: the laws are canon DEFs (the `law:` family in `arest`), never host
code; the canon and the carriers enter AS SOURCE and are **compiled** — the
one tuple literal reads as a `CANON(...)` call, and the executable is then
just exec'd. Nothing is read, eval'd, or interpreted at runtime.

    # compose (byte concatenation, the linker's job and nothing more)
    cat head.part.c ../../arest mid1.part.c ../norma-oracle/design-state \
        mid2.part.c ../norma-oracle/norma-answer tail.part.c > composed.g.c
    gcc -O2 -o c-runner.exe composed.g.c     # ~5 min: gcc chews the tuple
    ./c-runner.exe                           # base: law:report (22 laws), exit 0 iff all T

    # apps swap the two carrier files (../../apps/order, ../../apps/family)
    ./c-runner-order.exe app                 # law:app_report (10 laws)

`composed*.g.c`, the executables, and `*.txt` captures are generated and
untracked.

## CANON in C

C is the one station where the docstrings meet a static type system with no
common supertype, so the join is a C99 variadic macro:

    #define CANON(...) canon_build(sizeof((const void*[]){__VA_ARGS__})/sizeof(void*), \
                                   (const void*[]){__VA_ARGS__})

The compound literal carries the tuple's elements; `sizeof` counts them (an
**unevaluated** operand, so `DEF` side effects are not duplicated); and
`canon_build` tells built values from bare docstring literals by **exact
arena membership** — every `Obj` lives in the arena, every string literal in
the binary's read-only data, so a pointer-range test at the CANON boundary is
precise, not heuristic. Elements evaluate before the call in source order, so
DEF registration order is source order.

## Memory: hash-consing instead of a collector

The naive arena died twice — first of boolean churn at 1 GB, then, with item
arrays and small-int interning, at 16 GB in 44 s: the fixpoint rounds
recompute structurally equal values endlessly, and with no GC every copy is
forever. The station therefore **hash-conses**: every string, int, and
sequence interns bottom-up (open-addressing tables over FNV), so

- structural identity IS pointer identity — `deep_eq` gains an exact `a == b`
  fast path, and the arena holds only *novel* structures;
- the whole base run completes in ~2 min inside a bounded arena (16 MB
  chunks, reclaimed by process exit — values are immutable, so sharing is
  invisible to the canon.

## Strictness is the point

Same table as every station; C dies loudly (`STRICT: ...` on stderr, exit 3)
where the others throw:

| pathology | lenient μ | this μ |
|---|---|---|
| selector on an atom | returns a character | **dies** |
| selector out of range | undefined value | **dies** |
| compare across atom kinds | coerces / stringifies | **dies** |
| duplicate DEF | silent overwrite | **dies** |
| unresolved atom | undefined value | **dies** |
| `tl`/`tlr`/`1r`/`INSERT` on ⟨⟩ | empty / garbage | **dies** (Backus 11.2.3: ⊥) |

Two documented ASCII simplifications (C has no Unicode tables in scope):
`slug` keeps ASCII alphanumerics where C#/JS/Java lower-case and filter by
Unicode class, and comparison orders by byte value where they order by UTF-16
code unit. Every name and value the laws slug or sort is ASCII, where all
orders coincide; the byte-identical cross-station verdicts are the standing
check that this stays true.

## The parity it proves

Byte-identical verdict output (modulo CRLF) with the C#, JS, Java, Rust, and
WASM stations across the 22 base laws and 10 app laws on each app; under the
canon mutation trial (`induce:reset_pair` made identity) it flips exactly
`induce-exactness` and `induce-facts-emitted`, like every other μ. A compiled,
collector-free, hash-consed evaluator agreeing byte-for-byte with four
garbage-collected runtimes is the strongest evidence yet that the meaning
lives in the canon, not in any host.
