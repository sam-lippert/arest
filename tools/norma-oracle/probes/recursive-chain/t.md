# A chain whose leg names its own head: the inductive step of a cost-to-goal, with the sum as a declared reading and as arithmetic

State(.id) is an entity type.
Count(.id) is an entity type.
Operator is a value type.
Node(.id) is an entity type.
Distance is a value type.

State steps to State by Operator.
Operator costs Count.
State is goal.
Count plus Count is Count.
State reaches goal at Count. *

Node links to Node at Distance.
Node is root.
Node is reached at Distance. *

* State1 reaches goal at Count1 iff State1 steps to State2 by Operator1 and Operator1 costs Count1 and State2 is goal.
* State1 reaches goal at Count3 iff State1 steps to State2 by Operator1 and Operator1 costs Count2 and State2 reaches goal at Count1 and Count2 plus Count1 is Count3.
* Node1 is reached at Distance1 iff Node1 links to Node2 at Distance1 and Node2 is root.
* Node1 is reached at Distance3 iff Node1 links to Node2 at Distance2 and Node2 is reached at Distance1 and Distance3 equals Distance2 plus Distance1.
