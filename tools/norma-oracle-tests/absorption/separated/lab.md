# The same subtyping, separated by one sentence

### absorbed/lab.md plus the instance fact below. The subtyping is customised
### with NORMA's own AssimilationMapping, so Subscription gets its OWN table
### (subscriptionId, planCode) and Function loses both `isSubscription` and
### `subscriptionPlanCode`. The choice hangs on the SUBTYPING, which is why the
### subject is the subtype fact's name rather than the subtype's.

## Entity Types

Subscription is an entity type.
Subscription is a subtype of Object Type Instance.

## Value Types

Plan Code is a value type.

## Fact Types

Subscription has Plan Code.
  Each Subscription has at most one Plan Code.

## Instance Facts

Fact Type 'SubscriptionIsASubtypeOfObjectTypeInstance' has Assimilation Absorption Choice 'Separate'.
