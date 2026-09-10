# A literal in a body leg is a filter the grammar already says

### The general chain arm collected every leg that carries a literal -- an
### equality (`has Tier 'gold'`), a strict threshold (`Score greater than 10`)
### or a bound (`Score of 10 or more`) -- and declined the whole rule as "a
### threshold" (support.auto.dev: 11 heads, 2026-09-10), though the recipe
### grammar says each of them: an equality is `sel` on the joined rows before
### the projection, the same place a comparison filters; a strict threshold
### is the constant paired on as a column and `cmp` against it; a bound is
### the rows minus the rows the strict comparison keeps, since `cmp` is
### strictly less-than. Nothing new in the grammar, one more place that reads
### it. A threshold inside a negated leg has no column to filter and is
### declined by name.

Customer(.id) is an entity type.
Request(.id) is an entity type.
Tier is a value type.
  The possible values of Tier are 'gold', 'silver'.
Score is a value type.
  The data type of Score is numeric.

Request is by Customer.
  Each Request is by exactly one Customer.
Customer has Tier.
  Each Customer has at most one Tier.
Request has Score.
  Each Request has at most one Score.

Request is premium. *
Request is heavy. *
Request is qualified. *
Request is light. *
Request is capped. *
Request is unscored. *

* Request is premium iff Request is by Customer and that Customer has Tier 'gold'.
* Request is heavy iff Request is by Customer and that Request has Score greater than 10.
* Request is qualified iff Request is by Customer and that Request has Score of 10 or more.
* Request is light iff Request is by Customer and that Request has Score less than 10.
* Request is capped iff Request is by Customer and that Request has Score at most 10.
* Request is unscored iff Request is by Customer and that Request has no Score greater than 10.

Customer 'c1' has Tier 'gold'.
Customer 'c2' has Tier 'silver'.
Request 'r1' is by Customer 'c1'.
Request 'r1' has Score 10.
Request 'r2' is by Customer 'c2'.
Request 'r2' has Score 12.
Request 'r3' is by Customer 'c1'.
