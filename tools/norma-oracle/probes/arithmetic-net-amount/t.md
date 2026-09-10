## Entity Types
Quote(.id) is an entity type.
## Value Types
Gross Amount is a value type.
  The data type of Gross Amount is integer.
Discount Amount is a value type.
  The data type of Discount Amount is integer.
Net Amount is a value type.
  The data type of Net Amount is integer.
## Fact Types
Quote has Gross Amount.
  Each Quote has at most one Gross Amount.
Quote has Discount Amount.
  Each Quote has at most one Discount Amount.
Quote has Net Amount. *
  Each Quote has at most one Net Amount.
## Derivation Rules
* Quote has Net Amount iff Quote has Gross Amount and Quote has Discount Amount and Net Amount equals Gross Amount minus Discount Amount.
