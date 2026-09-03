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

Corpus(.Name) is an entity type.
Directory(.Path) is an entity type.
Corpus reads Directory.

Corpus 'metamodel' reads Directory 'metamodel'.

Corpus 'kernel' reads Directory 'metamodel'.
Corpus 'kernel' reads Directory '../apps/kernel/readings'.

Corpus 'autodev' reads Directory 'metamodel'.
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

Corpus 'eulaw' reads Directory 'metamodel'.
Corpus 'eulaw' reads Directory '../apps/eu-law/readings'.
Corpus 'eulaw' reads Directory '../apps/law-core/readings'.

Corpus 'uslaw' reads Directory 'metamodel'.
Corpus 'uslaw' reads Directory '../apps/us-law/readings/**'.
Corpus 'uslaw' reads Directory '../apps/law-core/readings'.
