# A calculated clause whose target a leg already bound is a condition, not a head value

State(.id) is an entity type.
Operator(.id) is an entity type.
Count is a value type.

State steps to State by Operator.
Operator costs Count.
State shortest to goal at Count.
State leads toward State. *

* State1 leads toward State2 iff State1 steps to State2 by Operator1 and Operator1 costs Count2 and State1 shortest to goal at Count1 and State2 shortest to goal at Count3 and Count2 plus Count3 is Count1.
