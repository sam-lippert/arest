# Event Ingest

<!-- Ported 2026-07-31 from readings/core/ingest.md (last touched
     2026-05-05). No counterpart existed under metamodel/, so this file was
     the residue of the readings/core -> metamodel merge rather than a
     superseded copy. Vocabulary map applied per the 2026-07-15 ruling in
     core.md: the (.id) and (.Name) reference modes are dropped and both
     entity types identify through Function(.id); "reference scheme" ->
     "reference mode" in the derivation rule. Fact types, constraints, the
     derivation rule, and instance facts are otherwise carried over
     verbatim. This is the Cor. 3 path -- an external event entering P
     through the same store as any other fact. -->

## Entity Types

Webhook Event is an entity type.
Webhook Event is a subtype of Function.
Webhook Event Type is an entity type.
Webhook Event Type is a subtype of Function.

## Value Types

JSON Path is a value type.
Payload is a value type.

## Fact Types

### Webhook Event

Webhook Event has Webhook Event Type.
  Each Webhook Event has exactly one Webhook Event Type.

Webhook Event has Payload.
  Each Webhook Event has exactly one Payload.

Webhook Event has Timestamp.
  Each Webhook Event has exactly one Timestamp.

Webhook Event is processed.

### Webhook Event Type

Webhook Event Type belongs to External System.
  Each Webhook Event Type belongs to exactly one External System.
  It is possible that more than one Webhook Event Type belongs to the same External System.

### Yields

Webhook Event Type yields Fact Type with Role from JSON Path.
  Each Webhook Event Type, Fact Type, Role combination occurs at most once.
  It is possible that some Webhook Event Type yields more than one Fact Type.
  It is possible that more than one Webhook Event Type yields the same Fact Type.

## Constraints

<!-- Removed 2026-09-30, with Sam's approval: "It is forbidden that a Webhook
     Event is processed more than once." `Webhook Event is processed` is a
     unary, and a unary fact holds or it does not, so no population can hold
     it twice and the rule could never be violated. If idempotent delivery
     matters, it is a dated fact (a Webhook Event processed at a Timestamp)
     with a uniqueness over the Webhook Event. -->

<!-- Decided by a function (2026-09-30, Sam: "All of this looks fine as
     recommended"). The sentence was "It is obligatory that for each Webhook
     Event Type that yields some Fact Type, every Role of that Fact Type
     appears in some Webhook Event Type yields Fact Type with Role from JSON
     Path". It built no constraint: it quantifies over every Role of a Fact
     Type, which no reading says. The coverage is per Webhook Event Type,
     because the derivation below fills each Role from that event's own
     Payload, so another event type's JSON Path cannot complete the fact.
     decide:webhook_coverage in lambda answers each Webhook Event Type that
     yields a Fact Type without mapping every Role of it. -->
Constraint 'webhook-yield-covers-roles' has Text 'It is obligatory that each webhook event type that yields some fact type maps every role of that fact type from some JSON path'.
Constraint 'webhook-yield-covers-roles' has modality of Modality Type 'Deontic'.
Constraint 'webhook-yield-covers-roles' is of Constraint Type 'DO_pop'.
Constraint 'webhook-yield-covers-roles' spans Role 'WebhookEventTypeYieldsFactTypeWithRoleFromJSONPath.1'.
Constraint 'webhook-yield-covers-roles' is decided by Predicate 'decide:webhook_coverage'.
Predicate 'decide:webhook_coverage' has Name 'decide:webhook_coverage'.
Predicate 'decide:webhook_coverage' has Module Path 'arest'.
Predicate 'decide:webhook_coverage' has Symbol Name 'decide:webhook_coverage'.

## Derivation Rules

* Webhook Event yields Fact iff Webhook Event has Webhook Event Type
  and Webhook Event Type yields Fact Type
  and Fact is of that Fact Type
  and for each Role of that Fact Type some Object Type Instance fills that Role
  where that Object Type Instance is found by reference mode over the value at
  JSON Path in the Payload of that Webhook Event.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'ingest' has Access 'public'. -->
Domain 'ingest' has Description 'Webhook event ingest. External system pushes a Webhook Event carrying a Payload; the Webhook Event Type declares which Fact Types it yields and the JSON Paths that fill each Role.'.
