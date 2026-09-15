# THE SECOND CONJUNCT ELIDES ITS SUBJECT. `It is forbidden that a Widget is
# packed in a Crate and also is stamped by a Press` hands the chain arm two
# clauses, and the second one -- `also is stamped by a Press` -- names no fact
# type, so the whole prohibition declined as missing vocabulary and reached canon
# as a model note nothing reads. (metamodel/imports.md: `It is forbidden that a
# Predicate is exported from a JS Package and also is backed by an External
# System`, task #93.)
#
# The subject the resolver carries forward is the one the PREVIOUS clause
# resolved at position 0, and here that carry has to survive a SUBTYPE LIFT as
# well, exactly as the metamodel sentence does: `Widget is stamped by Press` is
# not declared, `Part is stamped by Press` is, and Widget is a Part -- the same
# shape as Predicate / Function is backed by External System. So the recipe must
# show the lifted leg joined to the Widget extent, not a bare two-leg join.

Widget(.id) is an entity type.
Part(.id) is an entity type.
Crate(.id) is an entity type.
Press(.id) is an entity type.

Widget is a subtype of Part.

Widget is packed in Crate.
Part is stamped by Press.

It is forbidden that a Widget is packed in a Crate and also is stamped by a Press.
