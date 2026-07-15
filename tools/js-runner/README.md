# js-runner — the checker

A quick-and-dirty mu over the `arest` canon, and nothing more than that
by ruling: it exists to hold the canon to its laws, never for
production — Rust-to-WASM generates the production execution artifacts.
Station 'checker' in constitution.md.

The mu (~90 lines): atoms resolve through DEFS, numbers are selectors,
sequences are functional forms (COMP, CONS, CONST, COND, ALPHA, INSERT,
WHILE), plus the base primitives (id, tl, atom, apndl/apndr,
distl/distr, cat, null, eq, not, and, length, le/ge/gt, +, apply).
Representations are plain data, so the same canon bytes every host
reads are what mu evaluates. An unresolved atom throws, which makes the
registered boundary visible at runtime: `csdp` stops at
`csdp:elementarize` until a registration supplies it.

    node run.js

Inputs and outputs are INTERSECTION SOURCE only (the pure-math carrier
ruling — JSON and its kin live at the registration edge, never inside
Elysium): `../norma-oracle/design-state` (fact-type descriptors with
top-collapsed players, UC position spans, and the attributed instance
populations; entity populations; nestings) and
`../norma-oracle/norma-answer` (NORMA's RMAP tables), both evaluated
with the same vocabulary binding as the canon. Long collections nest in
chunks of nine; consumers unfold — through the canon's own
theta:flatten — until the documented leaf shape appears. The checker's
own answer is written the same way (`checker-answer`).

Laws held on every run, all evaluated through the canon itself:

- L1, fixpoint: re-classifying rmap's emitted schema reproduces its
  keys and separations; projection descriptors pass through unchanged.
- L2, a table IS fetch — and application IS fetch, chained: the canon's
  own ast:Fetch, against the emitted store, returns each cell's
  contents (Backus's up-arrow-n and Codd's restrict-then-project, one
  operator), and because a relation cell holds its rows CURRIED
  (rmap:nest — one store level per role, per the 2026-07-16 ruling that
  a higher-arity fact type is a higher-arity function and curried
  functions are single-parameter functions chained), fetching a key
  value inside the cell answers that key's image. Every curried
  application over the populated relation cells is checked against
  restriction-then-projection of the flat rows.
- L3, origin boundary: manifest:origins over the canon-as-store answers
  compiled = exactly the DEFs, and every hand-declared registered name
  (resolution.md's boundary rows, read from the design state's own
  populations) falls inside the computed registered set. The computed
  set over-approximates by design — the walk is total because any atom
  can reach operator position through apply — and the extras are
  reported.
- L4, population consistency: every DECLARED single-role key holds in
  the attributed rows — csdp:s4's uniqueness induction, run backwards
  as a data check. Induced-beyond-declared candidates are reported as
  small-sample information, never as findings.
- L5, currying agreement: rmap:unnest of every emitted relation cell
  reproduces exactly its population rows — nest and unnest are inverses
  on deduplicated rows, so the curried store and the flat presentation
  assert the same facts, row for row. The flat table is the derived
  view (Codd 1970 1.3: normal form is a storage discipline, reversible;
  AST holds sequences natively).

Plus the schema comparison: every fact type the canon separates must be
a NORMA table (by generated or objectifying-type name) and vice versa;
every canon absorption key must have a NORMA table absorbing its
columns and vice versa. There is NO tolerated value-domain class: a
NORMA table the canon cannot account for is a mismatch (that shunt hid
four orphan value types until 2026-07-16 — a roleless value type maps
to a degree-1 relation, the active domain, which is derived and never
stored). Column naming is out of scope (counts reported); the
objectified-identity tie-break (oracle README) is tolerated with a
note. Any law failure or schema mismatch exits nonzero.

## Test apps (test-apps.js)

    node test-apps.js

Runs the test applications (apps/sale-workflow in apps/order, and
apps/family) through the mu and holds the outputs to the whitepaper:
Thm 2 (the affordances from each status are exactly the effective
transitions, served by the canon own system:view_menu), Thm 1 validate
(the constraints:uniqueness builder refuses a duplicated key and passes
the clean population; the mandatory family answers violations by set
difference), Def derive with Lem 1 (grandparenthood as a projection of
a natural join through the theta ops — exact rows, no atom invention),
and per-app RMAP (Def 8: one cell per entity in a normal multi-entity
app; m:n and ring fact types keep their own tables). Each app is parsed
COMBINED with the base metamodel (the user domain binds to the base
vocabulary), NORMA validates the combined model, and the oracle emits
the app design state the mu consumes.
