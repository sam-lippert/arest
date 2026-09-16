# AN UNTERMINATED SENTENCE MAY NOT MINT A FACT TYPE. A paragraph that ends without
# a period still yields its remainder as a sentence, and every pass then reads it as
# one. `Widget pricing is handled by the pricing service` is documentation; read as a
# unary fact-type reading on the declared Widget it became the schema column
# pricingIsHandledByThePricingService, silently, with nothing in the census saying so.
# The oracle cannot tell a forgotten period from a line of prose, so it refuses BY NAME
# and both readings are repaired the same way: write the period, or delete the line.
#
# `Widget is packed in Crate` is the forgotten-period case and is refused too -- that is
# the point, not a casualty. What is NOT refused is the RESTATEMENT: the second
# `Widget has Colour` mints nothing, because the terminated one above already declared
# it, so it takes the duplicate-reading path untouched. A lone type name stays merely
# unrecognized: it never reaches the minting line.

Widget(.id) is an entity type.
Colour is a value type.
Crate(.id) is an entity type.

Widget has Colour.

Widget is packed in Crate

Widget pricing is handled by the pricing service

Widget has Colour

Crate

Each Widget has exactly one Colour.
