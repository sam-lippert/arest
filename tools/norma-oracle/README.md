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
verbalization leg, and the cross-check inputs for tools/js-runner
(design-state.json — fact types with top-supertype-collapsed players and
UC spans; norma-tables.json — NORMA's RMAP output). `oracle-report.txt`
is the pinned latest run; `verbalization-report.txt` is the pinned
tag-stripped verbalization (the .html original is regenerated on every
run and not tracked).

Verbalization leg (nf, out-direction): after RMAP, every object type and
non-implied fact type is verbalized through NORMA's own engine (the
automated verbalizer of Halpin & Curland 2006) via VerbalizationManager
against the VerbalizationBrowser target. The harness parse leg carries
sentences IN; this leg emits NORMA's sentences OUT — the whitepaper's nf
round-trip exhibited in both directions by the reference implementation
(declared readings like "Object Type is of OT Kind" come back verbatim).

Honest-oracle scope: the sentence→element translation here is the harness's
parse leg, kept small and reported sentence-by-sentence. What NORMA
authoritatively supplies: model well-formedness (reference schemes,
constraint arity/compatibility, supertype-lattice checks, implied-constraint
detection), the intrinsic data types, RMAP, and the generated verbalization.
Derivation rules, ring/set-comparison textual constraints, deontic bodies
beyond simple mandatory/uniqueness, and instance populations are classified
and counted, not mapped. Objectifications ARE mapped: "This association
with ... provides the preferred identification scheme for X" nests X over
the fact type it follows.

Known NORMA-inherent behaviors (verified, not harness defects):

- Ring m:n fact types: NORMA creates an implied objectification for every
  m:n fact type and mints link fact types reading "{0} is involved in {1}" /
  "{1} involves {0}" per role. On a ring fact both roles share a player, so
  the two link readings collide by construction and NORMA registers
  DuplicateReadingSignatureError twins. `ORACLE_RING_PROBE=1
  ./bin/Debug/norma-oracle.exe` demonstrates this with a bare one-type ring
  model. The report separates these as expected (currently 10 = 5 ring fact
  types × 2) from blocking errors.
- Objectified-type absorption: the ORM→OIAL→DCIL bridge occasionally gives
  an explicitly objectified type (API) its own identity table and
  occasionally absorbs it into the fact tables that already carry its
  identity — both are valid RMAP outcomes; the tie-break is
  nondeterministic inside the bridge (the objectified type's identity table appears or is absorbed run-to-run; one table of difference either way).

Requires: NORMA VSIX installed in VS (assembly paths in Program.cs), .NET
Framework 4.8, dotnet SDK to build.
