# Domain Evolution

## Entity Types

Domain Change is an entity type.
Domain Change is a subtype of Resource.
  <!-- elysium-audit: joins the established schema-entity-as-Resource
       pattern (core.md: Event Type, Status, Constraint, Derivation Rule
       are Resource subtypes), so the outcome provenance fact types
       (`Violation is triggered by Resource`, `Failure is triggered by
       Resource`) type-check against a Domain Change — the validity rules
       below join through them. -->
Signal is an entity type.
Signal is a subtype of Resource.
<!-- elysium-audit I+J (NORMA CompatibleSupertypesError x4; Samuel's
     ontology lens, 2026-07-15): `Model Element(.id)` is retired. As a
     second identification root declared a supertype of Reading / Noun /
     Constraint / Fact Type / Status / Transition, it handed four types two
     unrelated identification paths — NORMA refused all four. But the
     deeper correction is that no classifier was needed at all: in ORM
     everything is object-or-fact, in AREST both are FFP objects, and the
     metamodel's name for that unification root is Function. A Domain
     Change proposes a DEFINITION — so one open fact type, `Domain Change
     proposes Function`, replaces the closed six-way enumeration. The six
     kinds stay recoverable by restriction on what the proposed Function
     is, and new definition kinds (a Derivation Rule today, tomorrow's
     kind) are proposable without constraint surgery — as Cor 4's closure
     requires of the self-modification vocabulary. -->

## Value Types

Rationale is a value type.
Signal Source is a value type.
  The possible values of Signal Source are 'Constraint Violation', 'Human', 'Error Pattern', 'Feature Request', 'Support Request'.

## Readings

### Domain Change

Domain Change proposes Function.
  Each Domain Change, Function combination occurs at most once in the population of Domain Change proposes Function.
  It is possible that some Domain Change proposes more than one Function and that more than one Domain Change proposes the same Function.

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

## Constraints

<!-- elysium-audit I+J: the former `## Subtypes` block (Model Element as a
     supertype of six proposable kinds) collapsed first to an inclusive-or
     over six fact types, then — per the ontology lens — to the one open
     mandatory below: a Domain Change proposes a definition, and Function
     is the unification root that already names every definition. -->
Each Domain Change proposes some Function.

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

State Machine Definition 'Domain Change' is for Object Type 'Domain Change'.
Status 'Proposed' is initial in State Machine Definition 'Domain Change'.
<!-- audit-fix D: the asserted terminal rows for 'Applied' and 'Rejected'
     are retired — `Status is terminal in State Machine Definition` is
     fully derived again (state.md), and both fall out of the rule: no
     Transition in this machine leaves either. -->

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

<!-- organizations-domain (ruling 2): Domain 'evolution' has Access 'public'. -->
Domain 'evolution' has Description 'Self-modification as a Domain Change state machine. Proposing a new fact type is proposing a theorem (Curry-Howard). CSDP validation is the proof check, successful ingestion is the proof.'.
