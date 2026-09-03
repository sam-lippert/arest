## Entity Types
Quote(.id) is an entity type.
## Value Types
Gross Amount is a value type.
Discount Amount is a value type.
Net Amount is a value type.
## Fact Types
Quote has Gross Amount.
  Each Quote has at most one Gross Amount.
Quote has Discount Amount.
  Each Quote has at most one Discount Amount.
Quote has Net Amount. *
  Each Quote has at most one Net Amount.
## Derivation Rules
* Quote has Net Amount iff Quote has Gross Amount and Quote has Discount Amount and Net Amount equals Gross Amount minus Discount Amount.
