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

## Measured honestly

Step 1 (structural codegen): generation ~5s, rustc -O ~3m25s, base
report **3m24s** on the 22-law canon (was 6m04s before sequences became
`Rc<[V]>` — input copying halved it). Beats only the C station and
CPython; bun runs the same report in ~22s. The Futamura step removed
dispatch; the value representation still pays hash-cons hashing per
construction.

Step 2 (the algebra as canon): the canon now carries `rewrite:normalize`
(cancellation, ALPHA fusion, COMP flattening, id elimination — see the
rewrite: family and `law:rewrite_soundness`), and muc applies it to every
DEF body before codegen (`MUC_NO_REWRITE=1` skips it as a measurement
control). Result on this canon: 169/679 defs normalize, verdicts stay
byte-identical — and the runtime is a **wash** (4m07s with, 4m00s
without, on the 23-law canon). The form-level identities fire off the
hot paths; the fixpoint laws spend their time in data-dependent
construction that no static rewrite deletes. The machinery is the
deliverable: the optimizer-as-canon pattern, certified, ready for
identities that DO target the hot paths — which means profiling first,
then canon-specific theorems (theta-family identities), each landed with
its own witnesses under law:rewrite_soundness. The remaining
representational gap (interning tax vs a nursery) is a host property and
a separately-argued decision, not an algebra one.

## Step 2 (not yet built): the algebra as canon

The identities of Backus's algebra of programs — selector-of-CONS
cancellation, ALPHA fusion, composition distribution — are equations over
terms, which makes them data, which makes them canon. The plan of record:
register them as canon DEFs and let `muc` apply only canon-registered
rewrites ahead of codegen. Optimization-as-canon: the meaning stays where
the doctrine says meaning lives, and every rewrite is certified by the
same seven-station parity plus the mutation trial.
