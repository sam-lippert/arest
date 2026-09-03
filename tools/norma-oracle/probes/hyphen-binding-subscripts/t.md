# Subscript Test

### Entity Types

Node(.name) is an entity type.
Edge(.id) is an entity type.

### Value Types

Label is a value type.

### Fact Types

Edge is from- Node.
Edge is to- Node.
Edge has Label.

Node has hop Edge to Node with Label. *

## Derivation Rules

* Node1 has hop Edge to Node2 with Label iff Edge is from Node1 and Edge is to Node2 and Edge has Label.
