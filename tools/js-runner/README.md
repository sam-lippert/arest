# js-runner — the composed checker, JavaScript parity station

A second, independent μ beside `tools/cs-runner`. Same doctrine: the laws are
canon DEFs (the `law:` family in `arest`), never host code; the canon and the
carriers enter AS SOURCE — the one tuple literal reads as a `CANON(...)` call
(the rest-parameter wrap, JS's version of the "one extra name" join) — and
bun just EXECs the composed file (per Samuel's ruling; node runs it
identically — the μ is engine-independent, and bun being JavaScriptCore
rather than V8 makes JS-side agreement itself a two-engine property).
Nothing is read, eval'd, or interpreted at runtime.

    npm run build && npm start          # base: law:report (22 laws), exit 0 iff all T
    npm run build:order && npm start app # an app's carriers: law:app_report (10 laws)

The compose step is `copy /b` (Windows byte concatenation, the linker's job
and nothing more): `head.part.js ; arest ; design-state ; mid ; norma-answer ;
tail.part.js`. `cat` of the same files is byte-identical and is what the parity
runs use. `composed.g.js` is generated and untracked.

## Why a JS μ exists again

Two JS runners died before this one, both of accretion — fallback name lists,
guards, app-mode logic, comparison logic leaking in beside the canon. This is
not that. It is a **parity oracle**: its sole job is to agree-or-disagree with
the C# station. `head.part.js` is the *only* file with logic, and it mirrors
`cs-runner/{Vocabulary,Mu}.cs` point for point — the registration vocabulary
(`DEF` throws on a duplicate name by collection semantics, `law:one_name` is
the law; plus `A/N/K/PHI/S1..S9` and `CANON`), the μ (atoms through DEFS then
the primitives, numbers as selectors, the seven forms), the Backus 11.2.3
primitives with the registered boundary rows of `resolution.md`, and a tail
that applies the report and prints. If you ever add a guard or a name list to
this file, delete it — that is precisely how the last two died.

## Strictness is the point

The predecessors were **lenient**, and leniency is what let a selector index a
string to the character `"F"` and let `ins_asc` "sort" stringified arrays —
defects the strict C# μ later exposed. This μ is strict in exactly the same
places, so agreement between the two is meaningful and a re-introduced bug
flips both identically:

| pathology | lenient js (dead) | this μ / cs-runner |
|---|---|---|
| selector on an atom | returns a character | **throws** |
| selector out of range | `undefined` | **throws** |
| compare across atom kinds (number vs string, array) | coerces / stringifies | **throws** |
| duplicate DEF | silent overwrite | **throws** |
| unresolved atom | `undefined` | **throws** |

## The parity it proves

- **base + apps**: `diff` of the two stations' verdict output is empty (line
  endings aside — C# emits CRLF, node LF) across all 22 base laws and 10 app
  laws on each app.
- **discriminating power** (not just happy path): under a canon mutation
  (`induce:reset_pair` made identity) both μ flip the *same* laws
  (`induce-exactness`, `induce-facts-emitted`) to F, byte-identically; the
  canon restores sha256-identical.
- **↔ NORMA**: the carriers are NORMA's own RMAP answer, so `schema-match`
  (canon-RMAP ≡ `norma-answer`) holding under *both* μ is two independent
  evaluators agreeing the canon reproduces the reference ORM implementation's
  relational mapping — over a model NORMA validates at 0 errors, nf zero
  divergence.

A host is composed on demand and its verdict is only as trustworthy as a
second μ that agrees with it. That second μ is this one.
