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
`check` at ..\..rest\cratesrest	arget
elease\check-cli.exe, and crates/
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

## What a rule's body may say

Four rules of the body, each found by a corpus rule that stayed unbuilt:

- A leg may contain ` and ` (`Vertical Privity exists between Successor and
  Original Party`): the splitter re-joins a leg that resolves to no declared
  reading with its neighbour when the joined text is one. Nothing else is
  ever joined, so a comparison, an arithmetic clause or a negation keeps its
  own leg.
- `H iff A or B` is two rules on one head, "and" binding tighter; the split
  happens where the rule is deferred, outside quotes and outside any leg that
  resolves to a declared reading (`Party fails to perform or repudiates.` is
  one unary reading), never before more/fewer/less/later/earlier/equal.
- A possessive is not a quote: `Defendant's Conduct ... Plaintiff's use` is
  a reading, not an instance fact with a literal.
- A sentence a rule uses, as a leg or as its head, is a reading by
  construction: the prose guard (more than sixty characters of connective
  text is documentation) still skips such a sentence at first, and the replay
  after the map declares it once a deferred rule names it. A marked head
  declared past the guard (`Defendant is liable for defamation of public
  official or public figure. *`) keeps its marking, which registers per line.

The census then says per rule what it lacks: `ONE AWAY: <clause> <- <head>`
for a body one declaration short, `MISSING (n): <clause> | ... <- <head>` for
the rest, and `UNBUILT ... [legs resolving k/n; general join: <reason>]` for
a body every arm declined; the general join's reason is printed only there,
since a later arm builds most of what it declines. `Estate is a Fee Simple` as a body leg is a leg over the subtype
fact itself, entered at the supertype role; and a variable typed a subtype
of a leg's player walks up through the subtype fact before the leg (NORMA
models a subtype as a fact type with two roles, so the step is an ordinary
pathed-role pair). `* Each Fee Simple Absolute is a Fee Simple that ...` is
the qualified subtype definition NORMA already builds.

## Where a run's time goes

Every section boundary prints `timing: <phase> N ms` and every commit
`timing: commit N ms`, closed by `timing: total`. Two things used to make a
closure take minutes (us-law, 2026-09-03, 513 s under load): NORMA validates
the whole model at every commit, and nine phases each committed; and ten
sites scanned every type name against every sentence, longest name first,
which is O(types x sentence) per sentence and ran again on the round-trip's
re-parse. Now there are three commits (the declarations, the map, and
everything after them -- one commit crashes NORMA's ORM-to-OIAL bridge on
the us-law closure, and so does declarations-plus-map, so measure any
transaction change on us-law); the round-trip's second model is read inside
its open transaction and never committed; undo recording is off on both
headless stores; and the type names are indexed by their first run of
letters and digits, so a sentence offers candidates only where its own runs
match, with the old scan's acceptance order exactly (longer names first,
ties in dictionary order, left to right, a name's run a prefix of the
sentence's so `Node1` is Node with a subscript, a neighbour inside an
accepted span a boundary). The carriers are byte-identical before and
after: eu-law 108 s to 36 s. If a run is slow again, read the timing lines
before anything else.

## What a declaration decides

Canon maps first. Files sort by name within a source directory (core.md
first) and the directories keep the order they were given, so the
metamodel's declarations land before any app's. One sort across every
directory used to put law-core's core-types.md before the metamodel's
instances.md, and the app's `Citation is a value type` was the declaration
kept while the canon's entity was the one reported.

Declarations map before any reading (a declaration pass over every file, then
the schemes, then the readings), so a type is never minted by usage before its
own declaration and file order cannot decide a declared kind. Two explicit
declarations of different kinds are a `KIND CONFLICT`, the first kept -- the
same rule as two reference schemes for one entity (`DECLARED TWICE WITH
DIFFERENT REFERENCE SCHEMES`). What file order still decides is a name minted
by usage alone: a reading that uses `Customer` before any file declares it
binds nothing, which is a missing declaration in the corpus, not an order to
fix.

Reference schemes and value enumerations are built after every file has
mapped, because whether a mode names an existing type, and whether `The
possible values of Filing Status are ...` constrains a value type or the
identifying value type of an entity, is knowable only then. An enumeration on
an entity with no single value identifier is an `ERROR mapping` line.

A restated subtype is the same fact: two readings may both say `Partnership
is a subtype of Business Entity`, and a second SubtypeFact is what NORMA
reports as transitive implication.

Two constraint shapes the mapper no longer guesses at: `each` inside a
sentence (`discloses each Category`, `for each quarter end`) is not a
uniqueness quantifier, and a `For each` list may carry commas (`For each
Filing Status, Qualifying Condition and Tax Year, that Filing Status has at
most one ...`), which is the n-1 uniqueness NORMA writes for a quaternary.

## Regression and probes: the test project

The gates beside the oracle are xunit theories in `tools/norma-oracle-tests`,
run with the dotnet SDK and nothing else (no sh, no python, no interpreter
the target may not have):

    cd tools/norma-oracle-tests
    dotnet test --filter Category!=Corpus     # probes + the carrier classifier, ~1 min
    dotnet test --filter Category=Corpus      # the six corpora, ~15 min
    NORMA_ORACLE_RECORD=1 dotnet test ...     # record what the oracle produced

The tests drive the shipped `norma-oracle.exe` as a process from a scratch
directory under `_reports/` (the oracle writes its carriers into its working
directory, and it is one verifier run per process). A probe's expectation is
still text, NORMA's own verbalization of each rule; a corpus's is a carrier,
and its check runs in the system.

`ProbeTests`: every directory under `probes/` is one theory, a minimal model
with distinct types run through the oracle ALONE, whose `expected.txt` holds
the error count, the UNBUILT lines with their reasons, the read-back
verdicts and each derived head's verbalization. A one-line `errors 0`
expectation keeps a known wrong build red until it is fixed.

`CorpusTests`: every corpus in `corpora.md` is one theory. The corpora are
facts -- `Corpus 'uslaw' reads Directory '../apps/us-law/readings/**'` -- an
app's readings closure as its package.json declares it, the metamodel first,
a library's domain tree expanded because the oracle reads one directory
level. Every run writes its outcome as a carrier called `outcome`, three
surfaces: `state:built` (the built heads by NAME with multiplicity, sorted:
a count hides a dropped rule, a name does not), `state:errors` and
`state:readback`; and the same three under `expect:` names into a carrier
called `expectation`. `expected/<corpus>` is an accepted run's expectation,
copied there by recording. The theory composes the run's outcome with that
record and canon, no schema (us-law's `design-state` took the host minutes
to load and close, and the three laws read none of it), and asks the host:

    bun build.js regress && bun regress.g.js regress
                                    # law:regress_built, _errors, _readback,
                                    # then the heads lost and new

The check is canon, `law:regress_report` in `arest`, over `state:*` and
`expect:*`; a store with no record is held to nothing and the laws hold of
it. A lost head, a new head or a changed count fails the theory with the
host's rows and its witness. The expectation IS the baseline: a change you
verified is recorded deliberately, never by a run that happened to pass.
`MetamodelCarriersAreReproducible` runs the metamodel twice and requires
byte-identical carriers.

`CarrierKind` classifies two carriers as identical, order only or content
(a chunked collection is a multiset, a direct one keeps its order) and is
unit-tested on its own.

Record only what you have read: an expectation is the meaning that was
verified, not whatever came out.

## The read-back gate

After the arms have built, every lead role path NORMA holds for a derived
head is read back into the variable graph it denotes and compared with the
graph the head's rule text states. The path side follows NORMA's own
semantics: a path starts at its root object, the first pathed role is
played by that object, a same-fact-type step is another role of the same
fact instance played by a fresh object, any other step starts a new
instance entered by the object of the previous pathed role, a sub-path
continues from where its parent ended unless it carries its own root, and
a unifier or an Equals condition makes its members one object. The text
side has one instance per clause and one variable per written token.

A path that reads as none of its head's rules is `READ-BACK MISMATCH`, and a
built rule no path reads is `READ-BACK NO PATH READS`, whatever NORMA's
error count says. Every "built clean, read back wrong" case found by eye
before the gate existed was a variable mismatch of exactly this kind, and
its first run named twenty kernel rules whose second shared token had been
left as a free existential, plus a metamodel rule whose Failure succeeded
itself. Coverage is stated in the summary line: a head whose text needs a
subtype substitution, or has a clause naming no fact type, is UNCHECKED and
counted, and calculation clauses are not compared. A CLAUSE that resolves by
subtype substitution is checked: it reads as its supertype's fact with the
subtype's own token, the path having folded the subtype fact into that
variable -- the first such check found a rule built as a cross product. `CorpusTests` carries the
count as `read-back`; `ProbeTests` records the lines.
