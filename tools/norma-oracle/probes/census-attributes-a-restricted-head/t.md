# The census resolves a rule head the way the builder does

### `Person is subject to Minnesota Authority` is a rule for the declared fact
### type Person is subject to Authority (a subtype in the Authority role), and
### `Integration has Integration Shape 'fan-out'` one for Integration has
### Integration Shape (a literal on the Integration Shape role): the builder
### resolves both (ResolveRestrictedHead) while the census looked each head up
### verbatim, found nothing, and reported the head as "marked derived, no rule
### written" -- the corpus's debt, when the debt was the grammar's or nobody's
### (support.auto.dev, 2026-09-10: five of its nine such heads had rules). Now
### only the head no rule names at all reads so: Integration is capacity bound.
### The qualified subtype definition below is in Halpin's form, "Each ... is a
### ... that", so the fact type it restricts on (Person works in State) stays
### asserted; written without "Each" a `*` line is a marker on the fact type
### mapped before it.

Person(.name) is an entity type.
Authority(.citation) is an entity type.
Minnesota Authority is a subtype of Authority.
State(.name) is an entity type.
Integration(.id) is an entity type.
Integration Shape is a value type.
  The possible values of Integration Shape are 'single-endpoint', 'fan-out'.
Call Volume is a value type.

Person works in State.
  Each Person works in at most one State.
Person is subject to Authority. +
Integration has Integration Shape. *
  Each Integration has at most one Integration Shape.
Integration has Call Volume.
  Each Integration has at most one Call Volume.
Integration is capacity bound. *

Minnesota Person is a subtype of Person.
* Each Minnesota Person is a Person that works in State 'Minnesota'.

+ Person is subject to Minnesota Authority if Person works in State 'Minnesota'.
* Integration has Integration Shape 'fan-out' iff Integration has Call Volume that is at least 80.

### A rule may be PROVIDED BY A CONSTRAINT (core.md: `Derivation Rule is provided
### by Constraint`; Samuel 2026-09-01 on the World Assumption default, "a set
### of subset constraint derivations"). A `+` head whose only deliverer is a
### conditional is ruled, not rule-less.
Priority is a value type.
  The possible values of Priority are 'high', 'normal'.
Integration has Priority. +
  Each Integration has at most one Priority.
If some Integration is capacity bound then that Integration has Priority 'high'.

Person 'p1' works in State 'Minnesota'.
Integration 'i1' has Call Volume '90'.
