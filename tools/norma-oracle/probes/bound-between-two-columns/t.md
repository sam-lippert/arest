# A bound between two bound values: at most and at least, as a rule over dated events needs

### Storage is for all time, so "the rate in force" is not a rule over a clock
### but over the dated event that asks: a Rate is in force for a Quote when its
### effective date is on or before the day the Quote occurred and it is not
### superseded by then. The comparison grammar had strict orders between two
### bound values (exceeds, is less than) and the bounds only against a
### literal; `that effective- Date is at most that Date` now reads as NORMA's
### LessThanOrEqual and, in the recipe, as the rows minus the strictly-less
### rows the other way. Dates order lexically in their ISO spelling, which is
### the order cmp gives text. Rows on this store: r1 (effective in January,
### never superseded) and r4 (effective last June, superseded next June) are in
### force for q1, which occurred on the first of March; r2 takes effect after
### it and r3 was superseded before it.

Quote(.id) is an entity type.
Rate(.id) is an entity type.
Date is a value type.
  The data type of Date is date.

Quote occurred on Date.
  Each Quote occurred on at most one Date.
Rate has effective- Date.
  Each Rate has at most one effective- Date.
Rate has supersession- Date.
  Each Rate has at most one supersession- Date.
Rate is in force for Quote. *

* Rate is in force for Quote iff Quote occurred on Date and Rate has effective- Date and that effective- Date is at most that Date and Rate has no supersession- Date.
* Rate is in force for Quote iff Quote occurred on Date and Rate has effective- Date and that effective- Date is at most that Date and Rate has supersession- Date and that supersession- Date exceeds that Date.

Quote 'q1' occurred on Date '2026-03-01'.
Rate 'r1' has effective- Date '2026-01-01'.
Rate 'r2' has effective- Date '2026-04-01'.
Rate 'r3' has effective- Date '2025-01-01'.
Rate 'r3' has supersession- Date '2026-02-01'.
Rate 'r4' has effective- Date '2025-06-01'.
Rate 'r4' has supersession- Date '2026-06-01'.
