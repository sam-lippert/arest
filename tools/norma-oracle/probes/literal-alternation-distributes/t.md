# A value alternation on one role is one rule per literal, everything else in common

### `... has Identifier Sensitivity 'vehicle-identifier' or 'plate-identifier'
### and Log Entry has Date and Date is more than 30 days in the past` was cut
### at that `or` like a disjunction of legs: the first piece became a rule
### missing every clause after the alternation, the second a piece beginning
### with a literal, unbuildable, and once the first piece's chain reached its
### legs (2026-09-10, the equality key) the head carried a recipe for a rule
### the reading never said (auto.dev's EEA purge). The alternation now
### distributes: one rule per literal, the rest of the sentence in common. The
### purge stays undelivered here for its temporal clause, which is a process
### to remodel; the sensitivity head shows the distribution deliver both
### literals: l1 (vehicle) and l2 (plate) are sensitive, l3 is not.

Log Entry(.id) is an entity type.
Endpoint(.id) is an entity type.
Meter Endpoint is a subtype of Endpoint.
Identifier Sensitivity is a value type.
Date is a value type.
  The data type of Date is date.

Log Entry concerns EEA Customer.
Log Entry has Endpoint.
  Each Log Entry has at most one Endpoint.
Meter Endpoint has Identifier Sensitivity.
  Each Meter Endpoint has at most one Identifier Sensitivity.
Log Entry has Date.
  Each Log Entry has at most one Date.
Log Entry must be purged. *
Log Entry is sensitive. *

* Log Entry must be purged iff Log Entry concerns EEA Customer and Log Entry has Endpoint that is Meter Endpoint that has Identifier Sensitivity 'vehicle-identifier' or 'plate-identifier' and Log Entry has Date and Date is more than 30 days in the past.
* Log Entry is sensitive iff Log Entry has Endpoint that is Meter Endpoint that has Identifier Sensitivity 'vehicle-identifier' or 'plate-identifier'.

Meter Endpoint 'm1' has Identifier Sensitivity 'vehicle-identifier'.
Meter Endpoint 'm2' has Identifier Sensitivity 'plate-identifier'.
Meter Endpoint 'm3' has Identifier Sensitivity 'none'.
Log Entry 'l1' has Endpoint 'm1'.
Log Entry 'l2' has Endpoint 'm2'.
Log Entry 'l3' has Endpoint 'm3'.
Log Entry 'l1' concerns EEA Customer.
Log Entry 'l1' has Date '2026-01-01'.
