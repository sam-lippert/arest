# State Test

### Entity Types

Node(.name) is an entity type.
Leaf(.name) is an entity type.
Operator(.name) is an entity type.

### Value Types

Count is a value type.

### Fact Types

Node steps to Leaf by Operator.
Operator costs Count.
Leaf is goal.
Node reaches goal at Count. *

## Derivation Rules

* Node1 reaches goal at Count1 iff Node1 steps to Leaf1 by Operator1 and Operator1 costs Count1 and Leaf1 is goal.
