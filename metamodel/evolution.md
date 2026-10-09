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
<!-- arest-audit I+J (NORMA CompatibleSupertypesError x4; the
     ontology lens): `Model Element(.id)` is retired. As a
     second identification root declared a supertype of Reading / Noun /
     Constraint / Fact Type / Status / Transition, it handed four types two
     unrelated identification paths — NORMA refused all four. But the
     deeper correction is that no classifier was needed at all: in ORM
     everything is object-or-fact, in AREST both are FFP objects, and the
     metamodel's name for that unification root is Function. A Domain
     Change proposes a DEFINITION — so one open fact type, `Domain Change
     proposes Function`, replaces the closed six-way enumeration. The six
     kinds stay recoverable by restriction on what the proposed Function
     is, and new definition kinds (a Derivation Rule now, any later
     kind) are proposable without constraint surgery — as Cor 4's closure
     requires of the self-modification vocabulary. -->

## Value Types

Rationale is a value type.
  The data type of Rationale is text.
<!-- `Signal Source` (retired) answered TWO questions with one
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

Domain Change has Rationale.
  Each Domain Change has exactly one Rationale.

Domain Change targets Domain.
  Each Domain Change targets exactly one Domain.

Domain Change retires Reading.
  Each Domain Change, Reading combination occurs at most once in the population of Domain Change retires Reading.
  It is possible that some Domain Change retires more than one Reading and that more than one Domain Change retires the same Reading.
  <!-- A domain change creates a fact type from
       a reading. The fact type may be retracted, but the reading
       persists. Retiring a Reading retracts the Fact Type it created
       (its Roles and its stored rows) once exactly one User approves the
       Domain Change and the readings no longer declare that fact type.
       The Reading stays, with its Text spelled out in its players' names
       since its Roles are gone, and a fact that named the retracted Fact
       Type (a Domain Change that proposed it) names the Reading instead
       (compile:ip_migrate). -->

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
  <!-- Object Type Instance is the party mixin, so a Human, an Organization or
       an Agent - the agents module's type, not core's -
       may raise a signal - which is the point: automated origins
       finally have a raiser to name. `exactly one` is the throat: every
       signal is somebody's. -->        

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

### Function supersession

<!-- THE MEMORY DOMAIN. Function is the one id space over
     every definition - Object Type, Fact Type, Reading, Constraint and a
     host registration all identify through Function(.id) - so retirement
     needs no new object type and no new namespace: it is one ring over
     the space that already names everything.

     Written because the failure it prevents is in this repo's own
     history twice over: a claim about `finiteness_check` was reasoned
     from long after the fat hosts that carried it were deleted, and the
     count of unreachable definitions was quoted as 36 when the store
     said 95. Both are one defect - a sentence ABOUT an artifact
     outliving the artifact. A count and a description rot. A fact whose
     truth is a function of the store cannot: when it stops holding it is
     retracted, which is an operation this system now has.

     The reading is passive on purpose. What gets looked up is the name
     that has already gone stale - "does this still mean anything?" - so
     the retired role reads first. It is also what makes the asymmetry
     statable: the negated-predicate ring form drops a leading "is", so
     `is superseded by` has a spelling in the parsed fragment and
     `supersedes` does not.

     NO DATE ROLE AND NO RATIONALE ROLE. When a retirement is a modelling
     act its account already has a home - `Domain Change proposes
     Function` above, with Rationale mandatory on the change - and
     duplicating it here would put one claim in two places with no rule
     keeping them equal. What is elementary here is only which definition
     took which one's place. -->

Function is superseded by Function.
  Each Function, Function combination occurs at most once in the population of Function is superseded by Function.
  <!-- SPANNING, and no narrower uniqueness on either role. A retirement
       may have more than one successor - `Signal Source` below was split
       into two elementary facts, which is the witness in the population -
       and one successor may retire several predecessors when definitions
       merge. An `at most one` on either role would refuse the split this
       model actually performed. -->

## Constraints

<!-- arest-audit I+J: the former `## Subtypes` block (Model Element as a
     supertype of six proposable kinds) collapsed first to an inclusive-or
     over six fact types, then — per the ontology lens — to the one open
     mandatory below: a Domain Change proposes a definition, and Function
     is the unification root that already names every definition. -->
Each Domain Change proposes some Function.

It is obligatory that each Domain Change has exactly one Rationale.

<!-- THE SELF-MODIFICATION GATE ("it always
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
     Note this gate is load-bearing: User
     is a ROLE type over the mixin, so a
     User need not be a Human: an Agent, the agents module's type
     rather than core's, may be one and could otherwise
     approve its own rewrite of the core. The Human requirement is what
     keeps that from happening,
     and it must be stated HERE because it is no longer implied by the
     subtype lattice. -->
<!-- EVERY DOMAIN, not an enumeration (a change must always be
     gated by human approval, but either agents or humans may propose fact
     types and mutations to them along with instructions for how to modify
     changed data). This read `targeting Domain 'core'` and again
     `targeting Domain 'evolution'`, which is a list somebody has to keep,
     and the proof that it does not get kept was the third line: an 'ethics'
     gate was written, found to name a domain declared nowhere, and parked
     in a comment as a forward declaration. A domain that does not exist yet
     cannot be enumerated, and one added later was UNGATED BY DEFAULT -- a
     failure that reads as silence, because an ungated domain raises
     nothing.

     Every reason above is a reason about domain changes, not about those
     two domains: the throat to choke, `exactly one` because a committee is
     not one, the obligation form because a prohibition puts the cardinality
     inside the negated scope, and User being a role over the mixin so an
     Agent - a type the agents module declares, not this metamodel - may be
     a User and could otherwise approve its own rewrite. None
     of that narrows. The forward declaration is no longer needed: an ethics
     domain is gated the day it is declared, by this sentence, without
     anyone remembering to add it.

     This is also the gate domain evolution's IMPLEMENTATION needs. A
     Migration is proposable by an agent -- `Domain Change proposes Function`
     carries it, since Migration is a subtype of Function, which is exactly
     the openness the ontology-lens comment above was written for -- and
     applying one is a Domain Change being applied, so it arrives here. -->
<!-- AND IT IS STATED AGAINST THE TYPE THAT PLAYS THE ROLE.
     `Human` plays no role in any fact type - it is a bare Object Type
     Instance subtype beside Organization (core.md:248; Agent is
     declared by the agents module) - so the
     obligation named a type the approval fact does not mention, and NORMA
     refuses it by name. It was carried by nothing: state:deontics had no
     row for it, so the gate that this whole comment is about was enforced
     NOWHERE. `User approves Domain Change` is the fact, and `User` is what
     plays its first role, so that is the type the cardinality is about.
     It is spelled in the `For each X, ... that X` form the metamodel
     already uses (core.md:559), because that is the form whose body
     restates the reading and therefore the one both readers resolve.
     KNOWN AND STATED: the for-each head's `applied`
     qualifier is not carried - the rows say it of every Domain Change,
     which is stronger than the sentence and never weaker, and narrowing
     it to the applied ones is a join the deontic row shape has no legs
     for.
     AND `exactly one` IS NOT A UNIQUENESS ON THIS FACT TYPE (measured
     against the oracle rather than lambda's
     reader alone). `exactly one User approves that Domain Change` builds an
     internal uniqueness over the DOMAIN CHANGE ROLE ALONE, and that span is
     narrower than the spanning uniqueness declared above, so the reader that
     carries the narrower one deletes the wider - the oracle's AddInternalUC
     removes a wider UC the new span implies, because NORMA reports an implied
     internal UC as a model error - and the sentence deleted the very
     uniqueness `User approves Domain Change` is OBJECTIFIED over. MEASURED on metamodel/: `uniqueness narrowed
     (implied wider UC removed)` x1, and the model's only blocking error,
     FactTypeRequiresInternalUniquenessConstraintError x1, "fact type
     'UserApprovesDomainChange' requires an internal uniqueness constraint
     with alethic modality" - because the only uniqueness left on it was a
     deontic one. Stating that narrower uniqueness ALETHICALLY instead (`For
     each Domain Change, at most one User approves that Domain Change.`)
     clears the error and takes the objectification with it: OBJECTIFICATION
     REFUSED (Halpin 2020, no spanning UC), nestings 38 -> 37, and the
     deontic row rekeys from DomainChangeIsInvolvedInUserApprovesDomainChange
     to the bare fact type - UserApprovesDomainChange stops being the
     Function the supersession ring and the deontic legs name. The pair
     uniqueness above is not boilerplate: it is what the objectification
     stands on.
     SO THE OBLIGATION IS THE `some` FORM, which is what this metamodel
     already uses for an obligation over an objectified fact type -
     core.md:1701, `It is obligatory that each Migration produces some Fact
     Type as target.`, beside that fact type's own pair uniqueness. It
     carries DEO:m on the Domain Change role (every applied change has an
     approval), which is the half a store can actually violate and therefore
     the half a deontic is for: state:deontics is 13 rows where the `exactly
     one` form made 14, and the row given up is
     DEO:u:DomainChangeIsInvolvedInUserApprovesDomainChange#1.
     WHAT IS NOT CARRIED, said rather than lost: `no second approver`. A
     committee is still not a throat, but that is not a cardinality on an m:n
     fact type - a deontic uniqueness beside an alethic spanning one is legal
     ORM, since the modalities differ and neither implies the other, and the
     oracle cannot build the pair: AddInternalUC compares role spans and
     never modality, so whichever arrives second erases the first. Until it
     can, the second approver is refused where it can be refused - lambda's
     migrate:plan answers nothing when two Users approve one Domain Change
     (engine/shared/scenarios.canon, case:a-second-approver-is-not-a-throat)
     and compile-store declines the Migration.
     WHAT THIS GIVES UP, said rather than lost: `Human` also said an Agent -
     a type the agents module declares, not one this
     metamodel has of its own - may not sign off its own rewrite, and User
     being a role over the mixin means an Agent may be a User. That half was
     never enforced either, and
     it is a question about WHICH Object Type Instance the approving User
     is - a join through `User is a role of Object Type Instance` - not
     about how many there are. It belongs in its own sentence, against a
     fact type that carries it, and is not smuggled into a cardinality. -->
It is obligatory that if some Domain Change is applied then some User approves that Domain Change.
<!-- THE HALF GIVEN UP ABOVE, NOW STATED. With Human an attribute
     of a user (`User is human`, instances.md), whether the approver is a
     person is a fact the approval can be joined to, so "it always has to be
     one Human" is said of the User who approves: an Agent that is a User may
     propose a change, never sign it off. -->
It is obligatory that if some User approves some Domain Change then that User is human.
<!-- Restated so that the deontic works. It read
     "It is obligatory that for each applied Domain Change, some User
     approves that Domain Change". The reader matched Domain Change in the
     subject, dropped `applied`, and marked a mandatory on every Domain
     Change's role in User approves Domain Change; that mark, once
     checked, would have warned for every Domain
     Change not yet approved, applied or not. A for-each subject with a word
     that names no object type is now reported UNBUILT. The conditional form
     says the rule as written and builds it: a deontic subset, each applied
     Domain Change among those some User approves. -->

## Ring Constraints

No Function is superseded by itself.
If Function1 is superseded by Function2, then Function2 is not superseded by Function1.
<!-- ACYCLIC is the true property and neither sentence states it: the
     parsed ring fragment carries irreflexive, asymmetric and transitive,
     and acyclicity has no spelling. These two are its consequences at
     path lengths one and two.

     The rest is carried by a law rather than left implied, because what
     actually matters here is stronger than acyclicity and is a question
     about the store rather than about the schema: the two roles are
     DISJOINT - no Function is both retired and current. That makes every
     chain exactly one hop, which is the point of the domain. A memory
     that answers "superseded by X" and then makes you ask again about X
     has spent the lookup it was meant to save. When a successor is
     itself replaced the fix is to retract the old row and assert the new
     one, never to grow a chain: obsolescence is a retraction. Both
     halves are witnessed by execution over the population, in lambda,
     under the law registered as supersession-resolves - no retired name
     resolves to a definition, and the two role sets do not meet. -->

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

<!-- AN APPLIED DOMAIN CHANGE RE-MAPS THE TABLES IT TOUCHES. Bound
     to a lambda function as a decider is; the function takes the store (perform:on_store) and answers
     it with the Relational Schema rows of the tables the change touches re-mapped, and the write's
     emit runs the DDL their difference implies (schema:emit_ddl). -->
Predicate 'remap touched tables' is performed during Transition 'apply'.
Predicate 'remap touched tables' has Module Path 'arest'.
Predicate 'remap touched tables' has Symbol Name 'schema:dc_remap'.

<!-- arest-audit: validity wired into the machine through the Guard
     vocabulary (state.md) — approval is affordable only for a change the
     staged gate run judged valid. Evolution is core AREST: the
     self-modification SM uses the framework's own guard machinery. -->
Guard 'valid-domain-change' guards Transition 'approve-change'.
Guard 'valid-domain-change' references Fact Type 'DomainChangeIsValid'.
<!-- THE ID, NOT THE READING (a reference type in
     a fact is always filled by the reference id: the id refers to the entity,
     the reading refers to the predicate text). This said `Fact Type 'Domain
     Change is valid'`, which fills the role with the PREDICATE TEXT — the
     reading — where the role player is the fact type itself and is carried by
     its id.

     It was the only instance fact in the metamodel naming a Fact Type, and it
     put the one member of the Fact Type population under a name nothing else
     uses: state:readings, state:derived and state:fts all key on the ftid
     `DomainChangeIsValid`. So `Each Fact Type has some Reading` and `has some
     Role` reported violations that looked like missing data and were a naming
     mismatch — the reading and the role are both there, filed under the id. -->


<!-- organizations-domain (ruling 2): Domain 'evolution' has Access 'public'. -->
Domain 'evolution' has Description 'Self-modification as a Domain Change state machine. Proposing a new fact type is proposing a theorem (Curry-Howard). CSDP validation is the proof check, successful ingestion is the proof.'.

<!-- SUPERSESSION, populated from what the repo can be asked rather than
     from what it says in prose. Every retired name below was checked to
     resolve to nothing: none is a lambda definition and none carries a
     Definition Origin row, which is the standing law's first half. The
     three lambda rows are this rebuild's own retirements; the two `Signal
     Source` rows are this file's, and are the split witness the spanning
     uniqueness above is stated for. -->

Function 'finiteness_check' is superseded by Function 'derive:stratified'.
Function 'ast:pop_row' is superseded by Function 'ast:pop_exp'.
Function 'journal:overflow' is superseded by Function 'ui:st_long'.
Function 'Signal Source' is superseded by Function 'Signal Kind'.
Function 'Signal Source' is superseded by Function 'Signal is raised by Object Type Instance'.
