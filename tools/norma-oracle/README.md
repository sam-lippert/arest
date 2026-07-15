# norma-oracle

Verifies the Elysium metamodel readings against NORMA — the reference ORM 2
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
and counted, not mapped. Objectifications ARE mapped, in NORMA's own
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
  ./bin/Debug/norma-oracle.exe` demonstrates this with a bare one-type ring
  model. The report separates these as expected (rings × 2; explicit
  objectification of a ring fact type adds its own pair) from blocking
  errors.
- Objectified-type absorption: the ORM→OIAL→DCIL bridge's old
  nondeterministic identity-table tie-break (API) dissolved with the
  one-table rule — identity through the Function subtype removes the
  choice, and every objectified type assimilates deterministically.

Requires: NORMA VSIX installed in VS (assembly paths in Program.cs), .NET
Framework 4.8, dotnet SDK to build.
