# A subtyping with no reference mode of its own, absorbed

### The control for AnAbsorptionChoiceSeparatesASubtypeThatOtherwiseAbsorbs.
### Subscription takes its identity from Object Type Instance, so NORMA's
### default for a SubtypeFact -- Absorb (AssimilationMapping.cs:429) -- pulls it
### into the supertype's table: there is NO Subscription table, and Function
### carries the discriminator `isSubscription` beside `subscriptionPlanCode`.
### The separated/ directory is this reading plus one sentence.

## Entity Types

Subscription is an entity type.
Subscription is a subtype of Object Type Instance.

## Value Types

Plan Code is a value type.

## Fact Types

Subscription has Plan Code.
  Each Subscription has at most one Plan Code.
