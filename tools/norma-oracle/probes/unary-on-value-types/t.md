# Authority Test

### Entity Types

Authority(.citation) is an entity type.

### Value Types

Effective Date is a value type.
Supersession Date is a value type.

### Fact Types

Authority has Effective Date.
Authority has Supersession Date.
Effective Date is in the past.
Supersession Date is in the future.
Authority is currently in force. *

## Derivation Rules

* Authority is currently in force iff Authority has some Effective Date and that Effective Date is in the past and Authority has some Supersession Date and that Supersession Date is in the future.
