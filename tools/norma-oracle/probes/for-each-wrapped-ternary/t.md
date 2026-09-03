# A binary, a derived ternary and a quaternary sharing players, each with its own uniqueness;
# the three-player For-each must bind to the quaternary it restates, not to the running context

Customer(.id) is an entity type.
API(.id) is an entity type.
Concurrency Ceiling is a value type.
Measurement Window(.Start, .End) is an entity type.
Call Volume is a value type.

API has Concurrency Ceiling.
Customer calls API in Measurement Window with Call Volume.

### Derived
Customer exceeds Concurrency Ceiling of API. *

## Constraints

For each Customer, API and Measurement Window, that Customer calls that API in that
Measurement Window with at most one Call Volume.
Each API has at most one Concurrency Ceiling.
For each Customer and API, that Customer exceeds at most one Concurrency Ceiling
of that API.
