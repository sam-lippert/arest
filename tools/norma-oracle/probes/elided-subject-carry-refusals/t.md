# WHAT THE ELIDED-SUBJECT CARRY REFUSES. An anaphor resolver that guesses the
# wrong antecedent silently is worse than one that declines, so the carry states
# its refusals here and this probe fails if any of them is ever widened away.
# The first sentence BUILDS -- without it the cell would be absent and the three
# refusals below would be pinned only by a nothing that any regression also
# prints. Its single row is the whole assertion: the cell must hold exactly one
# DEO: marking, so a refusal that starts guessing shows up as a second one.
#
#   (1) THE CARRIED SUBJECT MUST NAME A DECLARED READING. `also is dropped in a
#       Bin` after `a Widget is packed in a Crate` restores to `that Widget is
#       dropped in a Bin`, which is not declared (only Gadget is dropped in Bin,
#       and Widget is no kind of Gadget). The clause is left exactly as written
#       and declines -- the resolver never reaches for a near reading.
#
#   (2) A NEGATED CLAUSE OFFERS NO SUBJECT. `a Widget is not packed in a Crate
#       and also is stamped by a Press` states the stamping of the Widget
#       OUTSIDE the negation, not of the negated scope, and this arm has no way
#       to say which it means. Carrying the subject out of a negation is the
#       wrong-antecedent defect, so nothing is carried and the sentence declines.
#
#   (3) THE RESTORED CLAUSE IS TESTED BY THE PLAIN RESOLVER ONLY. `also is
#       stamped by a Press 'p1'` carries a literal; the restored form does not
#       answer to the plain resolver, so no carry fires and the sentence
#       declines. Reading the restored form through the threshold, literal and
#       negation shapes as well would be a second resolver beside the one the
#       clause loop already runs -- the drift this arm is built to avoid.

Widget(.id) is an entity type.
Part(.id) is an entity type.
Crate(.id) is an entity type.
Press(.id) is an entity type.
Gadget(.id) is an entity type.
Bin(.id) is an entity type.

Widget is a subtype of Part.

Widget is packed in Crate.
Part is stamped by Press.
Gadget is dropped in Bin.

It is forbidden that a Widget is packed in a Crate and also is stamped by a Press.
It is forbidden that a Widget is packed in a Crate and also is dropped in a Bin.
It is forbidden that a Widget is not packed in a Crate and also is stamped by a Press.
It is forbidden that a Widget is packed in a Crate and also is stamped by a Press 'p1'.
