# muc — the μ compiler (the first Futamura projection)

Not an eighth mirror. The seven stations in `tools/*-runner` are strict
interpreters of the same μ over the same bytes; `muc` is the **first
Futamura projection** of that μ over the canon: `Ev(f, x)` with `f` static
partially evaluates into one Rust function per DEF, so the interpretive
dispatch loop does not exist in the output. COMP becomes call sequencing,
COND becomes `if`, ALPHA/INSERT/WHILE become loops, selectors become
bounds-checked indexing, and every name resolves at generation time.
Church–Turing says the procedural twin exists; Futamura constructs it
mechanically. This is the candidate engine for shipping — the path the
interpretive stations certify.

    python muc.py ../../arest ../norma-oracle/design-state ../norma-oracle/norma-answer compiled.g.rs
    rustc --edition 2021 --crate-name compiled_g -O -o compiled.exe compiled.g.rs
    ./compiled.exe                  # base: law:report, exit 0 iff all T
    ./compiled.exe app              # after generating against an app's carriers

`compiled*.g.rs`, `compiled*.exe`, `*.pdb`, and `*.txt` captures are
generated and untracked.

## What the compiler is (and is not)

`muc.py` is MECHANICAL and NAME-BLIND: it loads the three tuples with the
py-runner's own vocabulary (the canon is a normal Python module — the
seventh station's proof), then compiles every DEF body identically by
structure. It embeds no law semantics, treats no name specially, and
preserves the strictness contract exactly:

- selector on an atom / out of range → panic at runtime;
- compare across atom kinds, `tl`/`tlr`/`1r`/`INSERT` on ⟨⟩ → panic
  (Backus 11.2.3: ⊥);
- an atom in function position that is neither DEF nor primitive, or an
  unknown form head, compiles to a **die-stub that panics IF EVALUATED** —
  dead branches die only when taken, exactly as under the μ. (The canon
  carries recipe terms as data; their innards compile to stubs that no
  passing law ever reaches.)

Values are interned: atoms and sequences are `u32` ids, every sequence is
hash-consed at construction, so structural equality is `==` on a Copy
value — the C station's discipline promoted into the value representation.
Constants (CONST payloads and the store's own cell terms) dedupe at
generation time into a pool built once at startup.

`apply` evaluates terms that arrive as data, so the runtime keeps
`ev_dyn` — a small interpretive μ over the same interned values, whose
DEF resolution goes through an atom-id → compiled-fn table. Dynamic and
compiled evaluation agree by construction (the Lisp coexistence).

## Certification

The seven interpretive stations are the certifier, and the compiled
runtime holds: byte-identical verdict captures on base, order, and
family, and — by an accident of scheduling that became evidence — its
very first build ran against the mutation-trial canon
(`induce:reset_pair` made dead) and produced the mutated verdict
byte-identical to every station's: exactly `induce-exactness` and
`induce-facts-emitted` flipped. The compiled runtime discriminates
precisely as the μ does. If this runtime and the mirrors ever disagree,
the mirrors are right.

## Step 1 is correctness, not yet speed

Measured honestly: generation ~5s, rustc -O ~3m25s, base report
**3m24s** (was 6m04s before sequences became `Rc<[V]>` — input copying
halved it). That beats only the C station and CPython; bun still runs the
same report in ~22s. The Futamura step removed dispatch, but the value
representation still pays hash-cons hashing on every construction and a
fresh allocation per intermediate sequence — and the μ's semantics
build *enormous* numbers of intermediates. That volume is exactly what
step 2 exists to delete: selector-of-CONS cancellation and ALPHA fusion
remove the intermediates before codegen instead of building them faster.
The speed thesis lives or dies there, and it should be measured
identity-by-identity when it lands.

## Step 2 (not yet built): the algebra as canon

The identities of Backus's algebra of programs — selector-of-CONS
cancellation, ALPHA fusion, composition distribution — are equations over
terms, which makes them data, which makes them canon. The plan of record:
register them as canon DEFs and let `muc` apply only canon-registered
rewrites ahead of codegen. Optimization-as-canon: the meaning stays where
the doctrine says meaning lives, and every rewrite is certified by the
same seven-station parity plus the mutation trial.
