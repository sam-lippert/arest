# norma-oracle

Verifies the Arest metamodel readings against NORMA — the reference ORM 2
implementation — without an AREST math runner: it parses the FORML 2
declaration fragment out of `metamodel/*.md`, builds one ORM model through
NORMA's own object model (headless DSL store, booted the way NORMA's
ORM2CommandLineTest does), lets NORMA's validation rules judge it, and reads
back the live ORM → Abstraction → ConceptualDatabase RMAP result.

    dotnet build
    ./bin/Debug/norma-oracle.exe ../../metamodel

Output: sentence census, unrecognized sentences, the missing-uniqueness
finding list (spanning UCs assumed per Def 3 set semantics, each one
reported), the value-type data-type census (every readings-declared value
type carries an explicit "The data type of X is <token>." sentence; the
token map covers text/integer/decimal/float/boolean/datetime/date/time),
NORMA's model errors grouped by kind, the full relational table dump, the
verbalization leg, the nf round-trip gate (NORMA's generated
verbalizations re-parsed into a second model and compared on readings,
subtype edges, and UC spans — the exec ruling: all verbalizations are
canonical, and divergences of form move the source toward the canonical
phrasing), and the checker inputs (design-state, norma-answer — both
INTERSECTION SOURCE per the pure-math carrier ruling; instance facts
are parsed as verbalizations and ride as populations). All generated
reports and artifacts are untracked ephemera; the tools regenerate them
on demand.

Verbalization leg (nf, out-direction): after RMAP, every object type and
non-implied fact type is verbalized through NORMA's own engine (the
automated verbalizer of Halpin & Curland 2006) via VerbalizationManager
against the VerbalizationBrowser target. The harness parse leg carries
sentences IN; this leg emits NORMA's sentences OUT — the whitepaper's nf
round-trip exhibited in both directions by the reference implementation
(declared readings like "Object Type is of OT Kind" come back verbatim).

Constraint depth: rings, subsets (direct and JOIN-PATH — NORMA's
ConstraintRoleSequenceJoinPath with root, sub-paths, and projections),
exclusions (including exclusive subtypes over the supertype meta roles),
disjunctive mandatories, and the negated-unary impossibility form all
build as real NORMA elements. The principled residue rides as
ModelNotes, each named in the map log: the identity-cast reflection
bridge (one-id-space semantics, derivational), the API subtype-closure
rule (a derivation in constraint clothing), the two value-comparison
temporal forms (ValueComparisonConstraint over joined Timestamp roles —
the next constraint increment), two disjunctive-consequent forms, and
the qualified-deontic modeling prose.

Honest-oracle scope: the sentence→element translation here is the harness's
parse leg, kept small and reported sentence-by-sentence. What NORMA
authoritatively supplies: model well-formedness (reference schemes,
constraint arity/compatibility, supertype-lattice checks, implied-constraint
detection), the intrinsic data types, RMAP, and the generated verbalization.
Derivation rules, ring/set-comparison textual constraints, deontic bodies
beyond simple mandatory/uniqueness, and instance populations are classified
and counted, not mapped. Value comparisons ARE mapped: the conditional
comparison form ("If some A p some B then that A q1 some V and that B q2
some V where that A V is before that B V") builds a real
ValueComparisonConstraint over the two V roles, grounded by a CHAINED join
path — root A, a branch into the A-V fact, a walk across A-p-B, and a
nested sub-path into the B-V fact under the B step (two join variables,
beyond the flat one-root builder). Objectifications ARE mapped, in NORMA's own
verbalized form: `X objectifies "reading".` nests X over the fact type the
quoted reading resolves to (by normalized full-sentence key, so the
sentence parses in any context). Identity is never the association: the
one-table rule (2026-07-16) has every objectified entity declared a
subtype of Function, and identification flows through the one id space —
the spanning UC stays as the pairhood uniqueness over the absorbed
columns. Fact types whose readings carry the fully-derived marker (`*`)
leave BOTH emitted answers (design state and norma-answer): a stored
derivable relation is Codd 1970 1.5 strong redundancy; NORMA's DCIL still
materializes them (their rules are deferred), so the exclusion lives at
the answer surface, symmetrically.

Known NORMA-inherent behaviors (verified, not harness defects):

- Ring m:n fact types: NORMA creates an implied objectification for every
  m:n fact type and mints link fact types reading "{0} is involved in {1}" /
  "{1} involves {0}" per role. On a ring fact both roles share a player, so
  the two link readings collide by construction and NORMA registers
  DuplicateReadingSignatureError twins. `ORACLE_RING_PROBE=1
  ./bin/Debug/norma-oracle.exe` demonstrates the raw collision with a bare
  one-type ring model. FIXED, not classified: the generated link readings
  are ordinary editable Reading elements (no lock, exactly what a modeler
  would edit in the UI), so DisambiguateRingLinkReadings ordinal-qualifies
  each same-player group ("involves first", "is involved second in", ...)
  right after mapping. The error report carries no whitelist — a surviving
  duplicate-signature error is a real error. The nf feed's link-reading
  filter matches the qualified forms (" involves ", " is involved ").
- Objectified-type absorption: the ORM→OIAL→DCIL bridge's old
  nondeterministic identity-table tie-break (API) dissolved with the
  one-table rule — identity through the Function subtype removes the
  choice, and every objectified type assimilates deterministically.

Readers (the killed host's checker layers, re-homed): ring completeness
(same-player m:n fact types without a ring constraint — deontic findings
for adjudication; DerivationRule depends-on/reaches surface as principled
exceptions, self-dependency being a legitimate edge and the closure
having to hold cycles to refuse them) and singular naming (a name that is
another's plural, measured by the model's own Pluralization Rule
populations — the lexicon lives in the model, not the host). The third
layer, the SSRF guard, dissolved into the semantic-constraint
classification: deontic with a no-instance player, enforced at fetch
time, never a model check.

Requires: NORMA VSIX installed in VS (assembly paths in Program.cs), .NET
Framework 4.8, dotnet SDK to build.

## Checking an app or a library

The oracle is the corpus's verifier now. Every app package.json still points
`check` at ..\..rest\cratesrest	argetelease\check-cli.exe, and crates/
went with the fat hosts, so no app in apps/ can currently check itself.

It takes the SAME directory list its carriers record. Each app keeps that list
in design-state.source, and a mismatch is refused:

    refusing to overwrite ...\design-state: it was generated from
    <metamodel>;<app> but this run read <app>. The carrier paths are
    relative, so a run started in the wrong directory lands one station's
    model on another's certified inputs.

That guard is the reason the invocation matters. To REGENERATE an app's
carriers, run from the app directory with the list its .source names:

    cd apps/sherlock
    .../norma-oracle.exe C:/Users/lippe/Repos/arest/metamodel C:/Users/lippe/Repos/apps/sherlock

Forward slashes: a Windows path in a shell string loses its backslashes.

THERE IS NO READ-ONLY MODE -- WriteDesignState takes a relative path and always
writes -- so a `check` that must not touch the source tree runs from a scratch
directory instead, which is how the law libraries are checked (they carry no
carriers to regenerate):

    mkdir -p .check && cd .check
    .../norma-oracle.exe <law-core/readings> <the library's reading dirs...>

What to read in the output: the sentence census, the `unrecognized sentences`
list, and the UNBUILT lines -- one per derivation the compiler could not build,
each carrying the head, the body no arm accepted, and how many legs resolved,
closed by an UNBUILT SUMMARY. Those are printed unprompted on every run and are
the fastest true statement about a reading's health that exists.

## Regression and probes

Two gates ride beside the oracle, both plain sh:

    tools/norma-oracle/regress.sh <out-dir> [baseline-dir]
    tools/norma-oracle/probes.sh [--record] [probe-name ...]

`regress.sh` runs the metamodel and the four app corpora in parallel (about
three minutes) and, against a baseline, reports built derivation-rule heads
by NAME with multiplicity (a count hides a dropped rule; a name does not),
NORMA's blocking errors, and whether the carriers are byte-identical, listing
lost heads, new heads, and changed errors under each line. A run without a
baseline is the baseline for the next one; keep them under `_reports/`.

`probes.sh` runs each minimal model under `probes/` through the oracle ALONE
and diffs its rule verbalizations, UNBUILT lines, and error count against
`expected.txt`. Probes use distinct types so NORMA's naming is unambiguous.
`--record` writes what the oracle produced as the expectation: read it back
first, because a probe records the meaning that was verified, not whatever
came out. A one-line `errors 0` expectation keeps a known wrong build red
until it is fixed.
