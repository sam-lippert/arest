# The corpora the oracle is measured over

# A corpus is an app's readings closure as its package.json declares it
# (auto.dev depends on law-core and us-law; support on auto.dev, law-core,
# us-law and arest's templates; eu-law and us-law on law-core), always with
# the metamodel first. The oracle reads ONE directory level, so a library
# that keeps its domains in subdirectories is listed as a tree ('/**'), and
# auto.dev's own readings/ subdirectory (customer-auth.md declares Customer)
# rides with auto.dev. Paths are relative to the arest repository root. A
# population is a set, and the oracle reads directories in the order given,
# canon first: the metamodel is every corpus's first line.

<!-- THE PACKAGE GRAPH IS THE SOURCE; THE READS LIST IS ITS DENORMALISATION.
     The prose above always said a corpus is "an app's readings closure as its
     package.json declares it", and until 2026-09-05 the closure was only ever
     spelled out below, one `reads` line per dependency per app, kept in step
     with seven package.json files by hand. It is not a primitive: it is the
     transitive closure of one edge over JS Package, plus the directories each
     package keeps its readings in. Both now live in metamodel/imports.md
     (`JS Package depends on JS Package`, `JS Package reaches JS Package`,
     `JS Package has Readings Directory`), so the facts below are the SOURCE
     and the `reads` lines are what follows from them.

     Corpus and Directory are declared here as the harness's own vocabulary.
     A corpus IS its package -- Corpus 'autodev' is JS Package 'auto.dev' --
     and the two names differ only because the manifest predates the edge.
     CorpusTests.Corpus.All() parses the `reads` lines with a regex, so they
     stay until that reader asks a booted store for `JS Package reaches` and
     `has Readings Directory` instead; that is the remaining half of the
     rewrite and it is a change to the harness, not to this file. -->

Corpus(.Name) is an entity type.
Directory(.Path) is an entity type.
Corpus reads Directory.

## The dependency graph, from each package.json

JS Package 'auto.dev' depends on JS Package 'law-core'.
JS Package 'auto.dev' depends on JS Package 'us-law'.
JS Package 'us-law' depends on JS Package 'law-core'.
JS Package 'eu-law' depends on JS Package 'law-core'.
JS Package 'support.auto.dev' depends on JS Package 'auto.dev'.
JS Package 'support.auto.dev' depends on JS Package 'law-core'.
JS Package 'support.auto.dev' depends on JS Package 'us-law'.
<!-- The prose at the top always named this one -- "support on auto.dev,
     law-core, us-law and arest's templates" -- and it was the ONE corpus whose
     directory list did not follow from the graph until arest was written down
     as a package like any other. -->
JS Package 'support.auto.dev' depends on JS Package 'arest'.
<!-- The connector registry (apps/connectors) is where an External System's
     URL, auth shape and Country Code live; both apps' readings say so in
     their comments and both checks compose it since 2026-09-07, so the
     corpora do too. -->
JS Package 'auto.dev' depends on JS Package 'connectors'.
JS Package 'support.auto.dev' depends on JS Package 'connectors'.

## Where each package keeps its readings

JS Package 'metamodel' has Readings Directory 'metamodel'.
JS Package 'kernel' has Readings Directory '../apps/kernel/readings'.
JS Package 'law-core' has Readings Directory '../apps/law-core/readings'.
JS Package 'us-law' has Readings Directory '../apps/us-law/readings/**'.
JS Package 'eu-law' has Readings Directory '../apps/eu-law/readings'.
JS Package 'auto.dev' has Readings Directory '../apps/auto.dev'.
JS Package 'auto.dev' has Readings Directory '../apps/auto.dev/readings'.
JS Package 'support.auto.dev' has Readings Directory '../apps/support.auto.dev/readings'.
JS Package 'arest' has Readings Directory 'readings/templates'.
JS Package 'connectors' has Readings Directory '../apps/connectors/readings'.
JS Package 'arest-dev' has Readings Directory '../apps/arest-dev/readings'.
<!-- The smallest app: one reading, the engineering punchlist, driven daily over
     MCP. Gated here so the pipeline's simplest case is measured every time. -->
JS Package 'tasks' depends on JS Package 'arest'.
JS Package 'tasks' has Readings Directory '../apps/tasks/readings'.
<!-- This file is a FORML reading and arest-dev is the package that models
     arest's own engineering, so the manifest's directory is one of arest-dev's
     readings directories. That is not a trick to make the arithmetic work: it
     is what makes corpora.md's Corpus/Directory vocabulary shareable at all.

     REDECLARING A TYPE IS NOT AN ERROR. Assertions are set-valued, so declaring
     `Corpus(.Name)` in two files asserts one fact twice and lands one row --
     the same object type on two NORMA tabs. Two earlier versions of this
     comment claimed otherwise: first that the redeclaration itself was a bug
     law:one_name would catch, then that build-surface.md's `Corpus(.name)`
     against this file's `Corpus(.Name)` was a reference-mode mismatch against
     core.md's `Each Object Type has at most one Reference Mode`. MEASURED, both
     wrong: two stores built from `.name` and `.Name` are BYTE-IDENTICAL, so the
     oracle normalises the reference mode and there was no defect there at all.
     The only real error was the deeper one -- Corpus was an entity type minted
     for a derived relationship.

     What putting the two files in one corpus buys is therefore narrower than
     claimed, and worth stating exactly: declarations that DISAGREE about
     something the oracle does not normalise now meet in one store and can be
     reported. It does not forbid redeclaration, and redeclaration is fine. -->
JS Package 'arest-dev' has Readings Directory 'tools/norma-oracle-tests'.

Corpus 'metamodel' reads Directory 'metamodel'.

Corpus 'kernel' reads Directory 'metamodel'.
Corpus 'kernel' reads Directory '../apps/kernel/readings'.

Corpus 'autodev' reads Directory 'metamodel'.
Corpus 'autodev' reads Directory '../apps/connectors/readings'.
Corpus 'autodev' reads Directory '../apps/auto.dev'.
Corpus 'autodev' reads Directory '../apps/auto.dev/readings'.
Corpus 'autodev' reads Directory '../apps/law-core/readings'.
Corpus 'autodev' reads Directory '../apps/us-law/readings/**'.

Corpus 'support' reads Directory 'metamodel'.
Corpus 'support' reads Directory '../apps/support.auto.dev/readings'.
Corpus 'support' reads Directory '../apps/auto.dev'.
Corpus 'support' reads Directory '../apps/auto.dev/readings'.
Corpus 'support' reads Directory '../apps/law-core/readings'.
Corpus 'support' reads Directory '../apps/us-law/readings/**'.
Corpus 'support' reads Directory 'readings/templates'.
Corpus 'support' reads Directory '../apps/connectors/readings'.

Corpus 'eulaw' reads Directory 'metamodel'.
Corpus 'eulaw' reads Directory '../apps/eu-law/readings'.
Corpus 'eulaw' reads Directory '../apps/law-core/readings'.

Corpus 'uslaw' reads Directory 'metamodel'.
Corpus 'uslaw' reads Directory '../apps/us-law/readings/**'.
Corpus 'uslaw' reads Directory '../apps/law-core/readings'.

# The smallest LAW-CLOSURE store, and the one LawReportReadsAsRecorded
# runs: metamodel plus the shared law library, no jurisdiction on top.
# Every other corpus here is checked by reading its carriers; this one is
# also BOOTED and asked for the law report, because the carriers are not
# the store -- FILE is a projection, the meta-types are reflected and the
# populations are a closure, and three defects in one day (a bare-atom
# recipe that crashed every us-law boot, deontic constraints that stopped
# building, a closure that doubled a semi-derived head) were invisible to
# every check here for exactly that reason. 27 s for the report.
Corpus 'lawcore' reads Directory 'metamodel'.
Corpus 'lawcore' reads Directory '../apps/law-core/readings'.

# arest-dev models arest's own engineering -- the build surface, the work
# process, the epistemics -- and until 2026-09-05 no corpus read it, so
# apps/arest-dev/readings was gated by nothing and I ran it by hand. It reads
# THIS FILE's directory too, which is the point: corpora.md declares Corpus and
# Directory, build-surface.md declared Corpus a second time, and nothing could
# say so because the two were never in one store. Now law:one_name can.
Corpus 'tasks' reads Directory 'metamodel'.
Corpus 'tasks' reads Directory 'readings/templates'.
Corpus 'tasks' reads Directory '../apps/tasks/readings'.
Corpus 'arestdev' reads Directory 'metamodel'.
Corpus 'arestdev' reads Directory '../apps/arest-dev/readings'.
Corpus 'arestdev' reads Directory 'tools/norma-oracle-tests'.
