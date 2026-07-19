# Test App: Family Derivation

<!-- exec (2026-07-16): a test application for the checker mu — the
     datalog-paper classic: parenthood with a derived grandparenthood,
     exercising derivation-as-theta-composition (a rule is a projection
     of a natural join — the paper's Def derive semantics executed
     through the canon's theta ops), the ring constraint build, and
     per-app RMAP over a ring m:n fact type. -->

## Entity Types

Person(.Name) is an entity type.

## Readings

Person is parent of Person.
  Each Person, Person combination occurs at most once in the population of Person is parent of Person.

No Person is parent of itself.

## Instance Facts

Person 'alice' is parent of Person 'bob'.
Person 'bob' is parent of Person 'carol'.
Person 'bob' is parent of Person 'dave'.
Person 'carol' is parent of Person 'erin'.

Domain 'family' has Description 'The datalog classic: parenthood with derived grandparenthood.'.
