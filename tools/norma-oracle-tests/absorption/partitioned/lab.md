# The same subtyping, asked to partition, which NORMA refuses

### Partition is one of NORMA's three literals and NORMA will not apply it to
### this model: AssimilationMappingAddedRule answers "Partitioning is not
### allowed with the current subtyping pattern. Partitioning requires an
### ExclusiveOr constraint between all subtypes." That refusal is NORMA
### validating its own model and it is right, so what this fixture pins is the
### ORACLE'S behaviour around it -- the run finishes, the schema is the
### unpartitioned one, and the refusal is reported in NORMA's own words rather
### than thrown. Until 2026-09-10 it was a FATAL that killed the check.

## Entity Types

Subscription is an entity type.
Subscription is a subtype of Object Type Instance.

## Value Types

Plan Code is a value type.

## Fact Types

Subscription has Plan Code.
  Each Subscription has at most one Plan Code.

## Instance Facts

Fact Type 'SubscriptionIsASubtypeOfObjectTypeInstance' has Assimilation Absorption Choice 'Partition'.
