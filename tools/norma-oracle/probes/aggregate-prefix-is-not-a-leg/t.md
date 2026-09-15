# The census counted the aggregate prefix as a failing leg. A mean whose head role
# is predicate text does not build, so the census prints its leg ratio -- and the
# ratio was 2/3 against a body whose three clauses all resolve. The missing leg was
# never a leg: it was `average daily cost is the mean of Daily Amount where some
# Cost Observation is of that Variable Cost Source`, the aggregate prefix glued to
# clause one, because the census stripped `count|sum` where the arm reads
# count|sum|mean|min|max. Written with `mean` deliberately: a `sum` in this exact
# shape reports 3/3 and hides the defect, which is why aggregate-role-is-predicate
# -text does not catch it.

Variable Cost Source(.Source Name) is an entity type.
Cost Observation(.id) is an entity type.
Observation Date is a value type.
Daily Amount is a value type.

Cost Observation is of Variable Cost Source.
Cost Observation has Observation Date.
Cost Observation has Daily Amount.
Variable Cost Source has average daily cost for Observation Date. *

* Variable Cost Source has average daily cost for Observation Date iff average daily cost is the mean of Daily Amount where some Cost Observation is of that Variable Cost Source and that Cost Observation has that Observation Date and that Cost Observation has that Daily Amount.
