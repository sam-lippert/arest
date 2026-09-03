## Entity Types
System(.id) is an entity type.
Window(.id) is an entity type.
## Value Types
Rate is a value type.
Ceiling is a value type.
## Fact Types
System has Rate for Window.
  For each System and Window, that System has at most one Rate for that Window.
Window has Ceiling.
  Each Window has at most one Ceiling.
System is over budget for Window. *
## Derivation Rules
* System is over budget for Window iff System has Rate for Window and Window has Ceiling and that Rate exceeds Ceiling.
