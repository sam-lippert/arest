# js-runner

The first executing host in Elysium: a thin mu-evaluator (~90 lines) over
the `arest` canon, per Backus's FFP — atoms resolve through DEFS, numbers
are selectors, sequences are functional forms (COMP, CONS, CONST, COND,
ALPHA, INSERT, WHILE) — plus the base primitive set the canon composes
with (id, tl, apndl/apndr, distl/distr, cat, null, eq, not, and, length,
le/ge/gt, +, apply). Representations are plain data: the vocabulary
binding maps A/N/K/PHI/S1..S9 to atoms, numbers, and arrays, so the same
canon bytes the other hosts read are what mu evaluates.

    node run.js

executes the canon's `rmap` definition over the design state the NORMA
oracle emitted (`tools/norma-oracle/design-state.json`: one entry per
parsed fact type — generated name, players collapsed to their top
supertypes per RMAP 10.3 step 0, internal UC spans as 1-based positions)
and confirms the resulting schema against NORMA's own RMAP output
(`norma-tables.json`). Both forms of the canon's output are written to
`js-schema.json`: the STORE (a sequence of ⟨CELL, name, rows⟩ — entity
cells carrying wide rows per absorption group, relation cells per
separated fact type; Backus 13.3.4/14.3, the paper's "RMAP assigns each
entity its own cell") and the SCHEMA (the same content as full fact-type
descriptors — output type = input type).

Two laws are checked by evaluating the canon itself, every run:

- L1, fixpoint: re-classifying the emitted schema reproduces its keys
  and separations, and the projection descriptors pass through
  unchanged — rmap is idempotent on its own output.
- L2, a table IS fetch: the canon's own `ast:Fetch` builder, evaluated
  by the same mu against the emitted store, returns each cell's
  contents — Backus's up-arrow-n and Codd's restrict-then-project on
  the name component are the same operator, executed.

Slot convention in wide rows: a PRESENT slot is the 1-sequence of the
member fact's nonkey values (a present unary's value sequence is itself
phi, and stays distinguishable); phi marks absence.

What is compared (exactly): classification and grouping — every fact
type the canon separates (rule 1) must be a NORMA table, matched by
generated fact name or objectifying-type name, and every NORMA fact
table must be canon-separated; every rule-2 absorption key the canon
derives must have a NORMA table absorbing its columns, and every NORMA
absorbing table must be a canon key. What is not: column naming (NORMA
emits role-qualified names, the canon emits absorbed fact names; counts
are reported) and the value-domain-only tables NORMA mints for
independent value types (no fact content — outside rmap's mapping).

Known tolerated divergence, reported as a note when it occurs: NORMA's
objectified-identity tie-break (see the oracle README) sometimes absorbs
an explicitly objectified type's identity table into a fact table that
already carries its identity columns; the runner accepts that shape when
every player of the separated fact is covered by some table's columns.

An unresolved atom throws — which makes the registered boundary (Def 9,
origin=registered) visible at runtime: evaluating `csdp` here stops at
`csdp:elementarize` by design until a registration supplies it.
