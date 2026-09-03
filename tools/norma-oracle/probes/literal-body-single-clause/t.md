# A single-clause body carrying a literal

Bankruptcy Case(.number) is an entity type.
Chapter Number is a value type.

Bankruptcy Case is filed under Chapter Number.
  Each Bankruptcy Case is filed under at most one Chapter Number.
Bankruptcy Case is under Chapter 11. *

* Bankruptcy Case is under Chapter 11 iff Bankruptcy Case is filed under Chapter Number '11'.
