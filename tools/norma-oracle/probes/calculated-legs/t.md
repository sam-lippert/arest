# Calculated legs: a sum stated as `A plus B is that H`, operands naming roles of the subject or of a bound variable, and a quoted 'no' that is not a negation

Monroney Label(.id) is an entity type.
Suggested Retail Price is a value type.
Optional Equipment Total is a value type.
Label Subtotal is a value type.
Quote(.id) is an entity type.
Amount is a value type.
Rate(.id) is an entity type.
Percentage is a value type.
State(.name) is an entity type.
Flag is a value type.

Monroney Label discloses standard equipment Suggested Retail Price.
Monroney Label has Optional Equipment Total.
Monroney Label has Label Subtotal. *
Quote has state- Amount.
Quote has county- Amount.
Quote has combined- Amount. *
Quote has base- Amount.
Quote uses Rate.
Rate has Percentage.
Quote has tax- Amount. *
Quote is in State.
State has In-Lieu-Of Tax Flag.
Quote is exempt. *

* Monroney Label has Label Subtotal iff Monroney Label discloses standard equipment Suggested Retail Price and Monroney Label has Optional Equipment Total and that Suggested Retail Price plus that Optional Equipment Total is that Label Subtotal.
* Quote has combined- Amount iff combined- Amount equals state- Amount plus county- Amount.
* Quote has tax- Amount iff Quote uses Rate and Quote has base- Amount and tax- Amount equals base- Amount times Percentage divided by 100.
* Quote is exempt iff Quote is in State and that State has In-Lieu-Of Tax Flag 'no'.
