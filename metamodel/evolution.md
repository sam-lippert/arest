# Domain Evolution

## Entity Types

Domain Change is an entity type.
Domain Change is a subtype of Object Type Instance.
  <!-- arest-audit: joins the established schema-entity-as-Object Type Instance
       pattern (core.md: Event Type, Status, Constraint, Derivation Rule
       are Object Type Instance subtypes), so the outcome provenance fact types
       (`Violation is triggered by Object Type Instance`, `Failure is triggered by
       Object Type Instance`) type-check against a Domain Change — the validity rules
       below join through them. -->
Signal is an entity type.
Signal is a subtype of Object Type Instance.
<!-- arest-audit I+J (NORMA CompatibleSupertypesError x4; Samuel's
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
  The data type of Rationale is text.
<!-- `Signal Source` (retired 2026-07-24) answered TWO questions with one
     mandatory value: 'Constraint Violation' and 'Error Pattern' named a
     phenomenon the system detected, 'Feature Request' and 'Support
     Request' named an artifact a person produced, and 'Human' named who
     raised it. Since each Signal had exactly one Source those competed,
     and the self-modification gate below broke in both directions: a
     person's feature request motivating a core change was REFUSED (its
     source was 'Feature Request', not 'Human'), while an automated
     detector's signal could be recorded as 'Human' and PASS, since no
     actual person was referenced. Split into the two elementary facts
     the prose was always asking for - who raised it, and what kind of
     thing it is. -->
Signal Kind is a value type.
  The possible values of Signal Kind are 'Constraint Violation', 'Error Pattern', 'Feature Request', 'Support Request'.
  The data type of Signal Kind is text.

## Readings

### Domain Change

Domain Change proposes Function.
  Each Domain Change, Function combination occurs at most once in the population of Domain Change proposes Function.
  It is possible that some Domain Change proposes more than one Function and that more than one Domain Change proposes the same Function.
DomainChangeProposesFunction objectifies "Domain Change proposes Function".
DomainChangeProposesFunction is a subtype of Function.

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

Signal has Signal Kind.
  Each Signal has exactly one Signal Kind.

Signal is raised by Object Type Instance.
  Each Signal is raised by exactly one Object Type Instance.
  <!-- Object Type Instance is the party mixin, so a Human, an Organization or an
       Agent may raise a signal - which is the point: automated origins
       finally have a raiser to name. `exactly one` is the throat: every
       signal is somebody's. -->        

### Domain Change actions

User submits Domain Change for review.
  Each User, Domain Change combination occurs at most once in the population of User submits Domain Change for review.
UserSubmitsDomainChangeForReview objectifies "User submits Domain Change for review".
UserSubmitsDomainChangeForReview is a subtype of Function.

User approves Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User approves Domain Change.
UserApprovesDomainChange objectifies "User approves Domain Change".
UserApprovesDomainChange is a subtype of Function.

User rejects Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User rejects Domain Change.
UserRejectsDomainChange objectifies "User rejects Domain Change".
UserRejectsDomainChange is a subtype of Function.

User requests revision of Domain Change.
  Each User, Domain Change combination occurs at most once in the population of User requests revision of Domain Change.
UserRequestsRevisionOfDomainChange objectifies "User requests revision of Domain Change".
UserRequestsRevisionOfDomainChange is a subtype of Function.

Domain Change is applied.

## Constraints

<!-- arest-audit I+J: the former `## Subtypes` block (Model Element as a
     supertype of six proposable kinds) collapsed first to an inclusive-or
     over six fact types, then — per the ontology lens — to the one open
     mandatory below: a Domain Change proposes a definition, and Function
     is the unification root that already names every definition. -->
Each Domain Change proposes some Function.

It is obligatory that each Domain Change has exactly one Rationale.

<!-- THE SELF-MODIFICATION GATE (reworded 2026-07-24, ruling: "it always
     has to be one Human. There must be a throat to choke.").
     The gate moved from the signal's ORIGIN to the change's APPROVAL,
     because that is where accountability actually sits: what makes a
     core rewrite answerable is not what prompted it but who signed it
     off. This also fixes both directions the old wording failed in - an
     automatically detected constraint violation MAY now motivate a core
     change, provided a person approves it, and no signal can launder
     itself past the gate by being labelled 'Human'.
     `exactly one` is deliberate and is the ruling: a committee is not a
     throat. It is stated as an OBLIGATION, not as `forbidden ... without
     approval by exactly one Human`, because under a negation the
     cardinality falls inside the negated scope and the sentence also
     reads as forbidding a SECOND approver. `It is obligatory that each
     ... exactly one ...` is the form the metamodel already uses for a
     cardinality claim, and deontic bodies here are classified rather
     than mapped, so an ambiguous one would never have been caught.
     Note this gate is now load-bearing in a way it was not
     before - User became a ROLE type over the mixin (5f11814d), so an
     Agent may be a User and could otherwise approve its own rewrite of
     the core. The Human requirement is what keeps that from happening,
     and it must be stated HERE because it is no longer implied by the
     subtype lattice. -->
It is obligatory that each applied Domain Change targeting Domain 'core' is approved by exactly one Human.
It is obligatory that each applied Domain Change targeting Domain 'evolution' is approved by exactly one Human.
<!-- arest-audit: the same human-gate for Domain 'ethics' referenced a
     domain declared nowhere in the base readings. Preserved here as a
     forward declaration; reinstate as a reading the moment an ethics
     domain exists:
       It is obligatory that each applied Domain Change targeting Domain 'ethics' is approved by exactly one Human. -->

## Derivation Rules

<!-- arest-audit (real rules, replacing prose that claimed validity was
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

<!-- arest-audit: validity wired into the machine through the Guard
     vocabulary (state.md) — approval is affordable only for a change the
     staged gate run judged valid. Evolution is core AREST: the
     self-modification SM uses the framework's own guard machinery. -->
Guard 'valid-domain-change' guards Transition 'approve-change'.
Guard 'valid-domain-change' references Fact Type 'Domain Change is valid'.

<!-- organizations-domain (ruling 2): Domain 'evolution' has Access 'public'. -->
Domain 'evolution' has Description 'Self-modification as a Domain Change state machine. Proposing a new fact type is proposing a theorem (Curry-Howard). CSDP validation is the proof check, successful ingestion is the proof.'.
