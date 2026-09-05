# A unary head over a two-leg join: the membership shape, keep one column

Rule(.id) is an entity type.
Head(.name) is an entity type.
Recipe is a value type.

Rule produces Head.
  Each Rule produces exactly one Head.
Rule has Recipe.
  Each Rule has at most one Recipe.
Head is delivered. *

* Head is delivered iff some Rule produces Head and that Rule has some Recipe.

Rule 'r1' produces Head 'h1'.
Rule 'r1' has Recipe 'proj(...)'.
Rule 'r2' produces Head 'h2'.
