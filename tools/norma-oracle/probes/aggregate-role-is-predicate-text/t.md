# A head role spelled as lowercase predicate text is not a role. The minimal pair:
# the SAME sum, once with the aggregated value written `trailing daily cost` (no
# declared type, so the words are predicate text and the intended ternary parses as
# a BINARY with the value gone) and once with it written `trailing- Cost` over
# the declared value type `Cost`. Only the second reaches the aggregate arm. This is
# the shape at apps/auto.dev/cost-mitigation.md:97,119 -- corpus debt, not an oracle
# resolution gap, and the pair is the evidence: nothing about the body differs.

Variable Cost Source(.Source Name) is an entity type.
Cost Observation(.id) is an entity type.
Observation Date is a value type.
Daily Amount is a value type.
Cost is a value type.

Cost Observation is of Variable Cost Source.
Cost Observation has Observation Date.
Cost Observation has Daily Amount.
Variable Cost Source has trailing daily cost for Observation Date. *
Variable Cost Source has trailing- Cost for Observation Date. *

* Variable Cost Source has trailing daily cost for Observation Date iff trailing daily cost is the sum of Daily Amount where some Cost Observation is of that Variable Cost Source and that Cost Observation has that Observation Date and that Cost Observation has that Daily Amount.
* Variable Cost Source has trailing- Cost for Observation Date iff trailing- Cost is the sum of Daily Amount where some Cost Observation is of that Variable Cost Source and that Cost Observation has that Observation Date and that Cost Observation has that Daily Amount.
