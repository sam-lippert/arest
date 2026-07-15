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
reported), NORMA's model errors grouped by kind, and the full relational
table dump. `oracle-report.txt` is the pinned latest run.

Honest-oracle scope: NORMA's verbalization is generate-only, so the
sentence→element translation here is the harness's parse leg, kept small and
reported sentence-by-sentence. What NORMA authoritatively supplies: model
well-formedness (reference schemes, constraint arity/compatibility,
supertype-lattice checks, implied-constraint detection), the intrinsic data
types, and RMAP. Derivation rules, ring/set-comparison textual constraints,
deontic bodies beyond simple mandatory/uniqueness, objectification wiring,
and instance populations are classified and counted, not mapped.

Requires: NORMA VSIX installed in VS (assembly paths in Program.cs), .NET
Framework 4.8, dotnet SDK to build.
