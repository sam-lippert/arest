# AN OBLIGATION WHOSE SUBJECT IS A SUBTYPE. De Morgan puts the consequent in a NEGATED
# leg -- `each Gadget packed in some Crate has some Stamp Code` is `Gadget is packed in
# some Crate and it is not true that Gadget has some Stamp Code` -- so the Gadget-for-
# Widget substitution lands on BOTH legs, and the join emitter declined every such
# obligation as `a substituted subtype inside a negated leg`. A model declares a
# supertype precisely so its subtypes can be spoken of, so this is the common shape of
# a deontic, not an exotic one. The positive leg already joins the accumulator's column
# with Gadget's extent and the anti-join keys on that same column, so the negated leg's
# copy of the substitution restricts nothing and the rows are the Gadget/Crate pairs
# whose Gadget has no Stamp Code.

Widget(.id) is an entity type.
Gadget is an entity type.
Gadget is a subtype of Widget.
Crate(.id) is an entity type.
Stamp Code is a value type.

Widget is packed in Crate.
Widget has Stamp Code.

It is obligatory that each Gadget packed in some Crate has some Stamp Code.
