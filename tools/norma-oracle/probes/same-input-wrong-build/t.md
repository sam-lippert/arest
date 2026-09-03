# Same Input Test

### Entity Types

Problem(.name) is an entity type.
Observation(.name) is an entity type.

### Value Types

Count is a value type.

### Fact Types

Problem includes Observation.
Observation has input match Count with Observation.
Problem spans Count.
Observation has the same input as Observation. *

## Derivation Rules

* Observation1 has the same input as Observation2 iff Problem1 includes Observation1 and Problem1 includes Observation2 and Observation1 has input match Count1 with Observation2 and Problem1 spans Count1.
