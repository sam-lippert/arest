# rust-runner — the composed checker, Rust parity station (and the WASM leg)

A μ beside `tools/{cs,js,java,c}-runner`. Same doctrine: the laws are canon
DEFs (the `law:` family in `arest`), never host code; the canon and the
carriers enter AS SOURCE and are **compiled** — sliced into `CANON!(...)`
invocations by the linker — and the executable is then just exec'd.
Nothing is read, eval'd, or interpreted at runtime.

    python compose.py ../../arest ../norma-oracle/design-state ../norma-oracle/norma-answer composed.g.rs
    rustc --edition 2021 --crate-name composed_g -O -o rust-runner.exe composed.g.rs
    ./rust-runner.exe                        # base: law:report (22 laws), exit 0 iff all T

    # apps swap the two carrier files (../../apps/order, ../../apps/family)
    ./rust-runner-order.exe app              # law:app_report (10 laws)

`composed*.g.rs`, the executables, `composed*.wasm`, `*.pdb`, and `*.txt`
captures are generated and untracked.

## The same honest deviation as Java: the linker is a real program

The plain byte-concatenation form — the whole canon as ONE `CANON!(...)`
invocation — compiles and passes, but rustc's type inference, trait
resolution, and drop elaboration are superlinear in single-body size:
~30 minutes per build, ruled **non-viable** (2026-07-17). `compose.py` is
therefore a real linker, but SYNTAX ONLY, exactly like `java-runner`'s: it
counts parens and quotes, splits the three tuples at top-level commas into
slice functions (registration order kept), and never inspects a name or
evaluates anything; every canon byte appears verbatim. Simpler than Java's:
no hoisting, because Rust has no method-size cap — the ~53KB `state:fts`
item sits whole in its own slice. Sliced build: ~3 min.

## CANON! and the canon's own claim

Each slice is a `CANON!(...)` invocation, converting each element at the
boundary (bare docstring literals are `&str`, everything else is already
built):

    macro_rules! CANON {
        ( $($x:expr),* $(,)? ) => { vec![ $( IntoObj::obj($x) ),* ] };
    }

Slices run as sequential statements and `vec!` elements evaluate left to
right (guaranteed in Rust), so DEF registration order is source order. The
canon's opening docstring separately claims the file is "include!d in
expression position, normal Rust" — i.e. that the bare tuple literal itself
type-checks as one giant heterogeneous tuple expression. That claim is
verified by a standing probe (see the ledger), independently of the sliced
join the station uses.

## The WASM leg

The same composed source is the sixth station:

    rustc --edition 2021 --crate-name composed_g -O --target wasm32-wasip1 \
          -C link-arg=-zstack-size=268435456 -o composed.wasm composed.g.rs
    node wasi-host.mjs composed.wasm         # the host; node's WASI preview1

(bun 1.3.14 runs small WASI modules natively but traps on this one —
`Out of bounds call_indirect` at instantiation, at any stack size — so the
wasm leg runs under the node host.) The host is effects-only (WASI preview1:
args pass through, including `app`; the exit code passes through). wasip1
has no threads, so the deep
canonical recursion gets its stack at link time there; natively `main` spawns
a thread with a 512 MB stack instead. One binary, two substrates — the same
bytes of canon evaluated under an OS process and under a sandboxed linear
memory, expected byte-identical.

## Strictness is the point

Values are `Rc`-shared and immutable; reference counting is the collector.
The μ panics (`STRICT: ...`) exactly where the other stations throw or die:

| pathology | lenient μ | this μ |
|---|---|---|
| selector on an atom | returns a character | **panics** |
| selector out of range | undefined value | **panics** |
| compare across atom kinds | coerces / stringifies | **panics** |
| duplicate DEF | silent overwrite | **panics** |
| unresolved atom | undefined value | **panics** |
| `tl`/`tlr`/`1r`/`INSERT` on ⟨⟩ | empty / garbage | **panics** (Backus 11.2.3: ⊥) |

Two documented ASCII simplifications (shared with the c station): `slug`
filters by `char::is_alphanumeric` (a hair wider than C#'s `IsLetterOrDigit`
outside ASCII) and comparison orders by UTF-8 byte where C#/Java/JS order by
UTF-16 code unit. Every name and value the laws slug or sort is ASCII, where
all orders coincide; the byte-identical cross-station verdicts are the
standing check that this stays true.

## The parity it proves

Byte-identical verdict output (modulo CRLF) with the C#, JS, Java, and C
stations — natively and through WASM — across the 22 base laws and 10 app
laws on each app; under the canon mutation trial (`induce:reset_pair` made
identity) it flips exactly `induce-exactness` and `induce-facts-emitted`,
like every other μ. Six evaluators, five languages, four runtime models
(CLR, JSC, JVM, bare process, linear-memory sandbox), one canon.
