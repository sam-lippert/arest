# Domain Evolution

## Entity Types

Domain Change(.Change Id) is an entity type.
Domain Change is a subtype of Resource.
  <!-- elysium-audit: joins the established schema-entity-as-Resource
       pattern (core.md: Event Type, Status, Constraint, Derivation Rule
       are Resource subtypes), so the outcome provenance fact types
       (`Violation is triggered by Resource`, `Failure is triggered by
       Resource`) type-check against a Domain Change — the validity rules
       below join through them. -->
Signal(.Signal Id) is an entity type.
Model Element(.id) is an entity type.

## Value Types

Change Id is a value type.
Signal Id is a value type.
Rationale is a value type.
Signal Source is a value type.
  The possible values of Signal Source are 'Constraint Violation', 'Human', 'Error Pattern', 'Feature Request', 'Support Request'.

## Readings

### Domain Change

Domain Change proposes Reading.
Domain Change proposes Noun.
Domain Change proposes Constraint.
Domain Change proposes Fact Type.
Domain Change proposes Status.
Domain Change proposes Transition.

Domain Change has Rationale.
  Each Domain Change has exactly one Rationale.

Domain Change targets Domain.
  Each Domain Change targets exactly one Domain.

Domain Change is evaluated.
  <!-- Asserted by the staged gate run: per 11.2/Cor 4 (cor:closure),
       ingesting a Domain Change is itself a create judged by the one
       gate; the staged application emits outcome facts (outcomes.md)
       and records this marker. Without the marker, absence of
       violations before any evaluation would read as vacuous validity. -->

Domain Change has blocking outcome. *

Domain Change is valid. *

### Signal

Signal leads to Domain Change.
  Each Signal leads to at most one Domain Change.

Signal has Signal Source.
  Each Signal has exactly one Signal Source.

### Domain Change actions

User submits Domain Change for review.
  Each User, Domain Change combination occurs at most once in the population of User submits Domain Change for review.

User approves Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User approves Domain Change.

User rejects Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User rejects Domain Change.

User requests revision of Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User requests revision of Domain Change.

Domain Change is applied.

## Subtypes

Model Element is a supertype of Reading.
Model Element is a supertype of Noun.
Model Element is a supertype of Constraint.
Model Element is a supertype of Fact Type.
Model Element is a supertype of Status.
Model Element is a supertype of Transition.

## Constraints

Each Domain Change proposes some Model Element.
It is possible that the same Domain Change proposes more than one Model Element.

It is obligatory that each Domain Change has exactly one Rationale.

It is forbidden that a Domain Change targeting Domain 'core' is applied without Signal Source 'Human'.
It is forbidden that a Domain Change targeting Domain 'evolution' is applied without Signal Source 'Human'.
<!-- elysium-audit: the same human-gate for Domain 'ethics' referenced a
     domain declared nowhere in the base readings. Preserved here as a
     forward declaration; reinstate as a reading the moment an ethics
     domain exists:
       It is forbidden that a Domain Change targeting Domain 'ethics' is applied without Signal Source 'Human'. -->

## Derivation Rules

<!-- elysium-audit (real rules, replacing prose that claimed validity was
     "implemented by the compile pipeline" — a `*` marker whose rule lives
     in a host is drift wearing a derivation mark. Per 11.2/Cor 4 the
     staged ingestion of a Domain Change is a create judged by the gate,
     and the gate's outcomes are facts (outcomes.md), so validity derives
     from them. The old prose conditions map: (1) parseable → no Failure
     (Failure Type 'parse') triggered by the change; (2) population
     consistency and (3) constraint satisfiability → no error-severity
     Violation triggered by the staged application. Disjunction is two
     rules per datalog convention; the single negated clause reads the
     settled derived cell (a finite anti-join, Lem 1). -->

* Domain Change has blocking outcome iff some Violation is triggered by that Domain Change and that Violation has Severity 'error'.

* Domain Change has blocking outcome iff some Failure is triggered by that Domain Change.

* Domain Change is valid iff that Domain Change is evaluated and it is not true that that Domain Change has blocking outcome.

## Instance Facts

State Machine Definition 'Domain Change' is for Noun 'Domain Change'.
Status 'Proposed' is initial in State Machine Definition 'Domain Change'.
Status 'Applied' is terminal in State Machine Definition 'Domain Change'.
Status 'Rejected' is terminal in State Machine Definition 'Domain Change'.

Transition 'review' is defined in State Machine Definition 'Domain Change'.
Transition 'review' is from Status 'Proposed'.
Transition 'review' is to Status 'Under Review'.
Transition 'review' is triggered by Event Type 'User submits Domain Change for review'.

Transition 'approve-change' is defined in State Machine Definition 'Domain Change'.
Transition 'approve-change' is from Status 'Under Review'.
Transition 'approve-change' is to Status 'Approved'.
Transition 'approve-change' is triggered by Event Type 'User approves Domain Change'.

Transition 'reject' is defined in State Machine Definition 'Domain Change'.
Transition 'reject' is from Status 'Under Review'.
Transition 'reject' is to Status 'Rejected'.
Transition 'reject' is triggered by Event Type 'User rejects Domain Change'.

Transition 'revise' is defined in State Machine Definition 'Domain Change'.
Transition 'revise' is from Status 'Under Review'.
Transition 'revise' is to Status 'Proposed'.
Transition 'revise' is triggered by Event Type 'User requests revision of Domain Change'.

Transition 'apply' is defined in State Machine Definition 'Domain Change'.
Transition 'apply' is from Status 'Approved'.
Transition 'apply' is to Status 'Applied'.
Transition 'apply' is triggered by Event Type 'Domain Change is applied'.

<!-- elysium-audit: validity wired into the machine through the Guard
     vocabulary (state.md) — approval is affordable only for a change the
     staged gate run judged valid. Evolution is core AREST: the
     self-modification SM uses the framework's own guard machinery. -->
Guard 'valid-domain-change' guards Transition 'approve-change'.
Guard 'valid-domain-change' references Fact Type 'Domain Change is valid'.

Domain 'evolution' has Access 'public'.
Domain 'evolution' has Description 'Self-modification as a Domain Change state machine. Proposing a new fact type is proposing a theorem (Curry-Howard). CSDP validation is the proof check, successful ingestion is the proof.'.
