# `no other X <reading>`: a negated leg over a fresh variable, distinct from the one the head bound, the distinctness inside the negation

Vehicle(.VIN) is an entity type.
Style Candidate(.id) is an entity type.
Squish VIN is a value type.

Vehicle has Squish VIN.
Style Candidate has Squish VIN.
Vehicle is resolved to Style Candidate. *

* Vehicle is resolved to Style Candidate iff Vehicle has Squish VIN and Style Candidate has that Squish VIN and no other Style Candidate has that Squish VIN.
