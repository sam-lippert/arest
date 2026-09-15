# THE SELF-MODIFICATION GATE'S SHAPE (metamodel/evolution.md:216, measured 2026-09-15).
# A deontic whose predicate names a DECLARED object type that plays no role in any
# asserted fact type. `Approver` is declared and subtyped exactly as `Human` is in
# metamodel/core.md:242 and appears in no reading, so the sentence asserts a relation
# the model has no column for: no constructor arm, however wide, can build it, because
# there is nothing to build from. The sentence that IS declared here (`Signer signs
# Change`) names a different player, and substituting it would carry a WEAKER rule than
# the sentence states -- the exact failure the gate exists to prevent.
#
# The deontic reference report asked only whether a phrase was DECLARED, which
# `Approver` is, and its regex required two capitalized words, which a one-word type
# name never has. So the sentence stood as a note that nothing reads and no store can
# contradict: declared, and unfalsifiable.

Party(.id) is an entity type.
Approver is an entity type.
Approver is a subtype of Party.
Signer(.id) is an entity type.
Change(.id) is an entity type.

Change is applied.
Signer signs Change.

It is obligatory that each applied Change is signed by exactly one Approver.
