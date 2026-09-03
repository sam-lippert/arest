## Entity Types
Customer(.id) is an entity type.
Admin(.id) is an entity type.
Trial(.id) is an entity type.
## Fact Types
Customer has granted Trial. +
Admin provisions Customer.
Customer is flagged. ++
## Derivation Rules
+ Customer has granted Trial if some Admin provisions that Customer.
++ Customer is flagged if some Admin provisions that Customer.
