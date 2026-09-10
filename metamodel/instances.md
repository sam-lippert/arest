# AREST Instances: Runtime Entities

<!-- Layer (arest-batch task 3): AREST-extension vocabulary end to end —
     the runtime side (Object Type Instance, State Machine, Event, Fact instances,
     Guard Run, User, Citation). ORM canon models schemas; populations
     here are Thm 1's FILE cell made addressable. Everything homes under
     Object Type Instance, itself a Function subtype (FFP: one root). -->

## Entity Types

Object Type Instance is an entity type.
  Object Type Instance is a subtype of Function.
<!-- 2026-07-09 (Samuel, NORMA-grounded): Object Type Instance was a subtype of Noun, a
     GraphDL "Graph Schema is a Noun" artifact. In NORMA's own metamodel
     (ORMCoreMetaModel.orm) ObjectType and FactType are DISJOINT SIBLINGS —
     both <: ORMNamedElement, and FactType is NEVER a subtype of ObjectType.
     Halpin: subtyping holds only between object types; a fact type is
     "predicate + its object types", not an object type. Because Fact Type <
     Event Type < Object Type Instance, the old `Object Type Instance < Noun` made every fact type a
     Noun by population inclusion, tripping the mandatory noun-classification
     facts (Object Type / World Assumption) on 494 fact types. Reparenting
     Object Type Instance under Function (beside Noun, mirroring ObjectType/FactType both
     under ORMNamedElement) makes Fact Type a sibling of Noun, not a subtype.
     Category stays instance-of: `Object Type Instance is instance of Noun` below is a
     genuine instance-of fact between disjoint types, most-specific per
     NORMA's ObjectTypeHasObjectTypeInstance (Multiplicity One) with
     WalkSupertypes delegation for supertype-walking consumers. -->
Event is an entity type.
  Event is a subtype of Object Type Instance.
Fact is an entity type.
  Fact is a subtype of Event.
State Machine is an entity type.
State Machine is a subtype of Object Type Instance.
Guard Run is an entity type.
Guard Run is a subtype of Object Type Instance.
Citation is an entity type.
Citation is a subtype of Object Type Instance.
User is an entity type.
User is a subtype of Object Type Instance.

## Value Types

Reference is a value type.
  The data type of Reference is text.
Email is a value type.
  The data type of Email is text.
Value is a value type.
  The data type of Value is text.
Retrieval Date is a value type.
  The data type of Retrieval Date is date.

Cell Name is a value type.
  The data type of Cell Name is text.
Cell Version Id is a value type.
  The data type of Cell Version Id is text.

Authority Type is a value type.
  The possible values of Authority Type are 'Constitutional', 'Statute', 'Regulation', 'Case', 'Rule-of-Court', 'Executive-Order', 'Treaty', 'Agency-Guidance', 'Industry-Standard', 'Administrative-Ruling', 'Runtime-Function', 'Federated-Fetch', 'Storage-Pin'.
  The data type of Authority Type is text.

## Readings

### Citation
Citation has Text.
  Each Citation has exactly one Text.
Citation has URI.
  Each Citation has at most one URI.
Citation has Retrieval Date.
  Each Citation has at most one Retrieval Date.
Citation has Authority Type.
  Each Citation has at most one Authority Type.
  It is possible that more than one Citation has the same Authority Type.
Citation is backed by External System.
  Each Citation is backed by at most one External System.
  It is possible that more than one Citation is backed by the same External System.
Citation pins Cell Name.
  Each Citation pins at most one Cell Name.
  It is possible that more than one Citation pins the same Cell Name.
Citation pins Cell Version Id.
  Each Citation pins at most one Cell Version Id.
  It is possible that more than one Citation pins the same Cell Version Id.

### Fact
Fact is of Fact Type.
  Each Fact is of exactly one Fact Type.
Fact is of Function. *
  Each Fact, Function combination occurs at most once in the population of Fact is of Function.
  <!-- ns-2 (ns-derive-population-domains): the single-sourcing BRIDGE for a
       Fact's domain. A Fact Type IS a Function (Fact Type < Object Type Instance < Noun <
       Function; same identity, same id), so this fully-derived FT re-labels
       the Fact Type a Fact is of as that same Function. It stores NO domain —
       it only re-projects the existing `Fact is of Fact Type` value under a
       `Function` role so the domain rule below can JOIN on `Function` (the
       role `Function belongs to Domain` carries), exactly as Violation/Failure
       join on the Function they are against. See the rule under
       "## Derivation Rules". -->
Fact belongs to Domain. *
  Each Fact belongs to at most one Domain.
  <!-- ns-2 (ns-derive-population-domains): a Fact does NOT store its own
       domain — it DERIVES it from its Fact Type, keeping domain single-sourced
       on Function (a Fact Type is a subtype of Function via Object Type Instance < Noun <
       Function; core.md "Function belongs to Domain"). The `*` marks this Fact
       Type as fully derived; the rule is under "## Derivation Rules" below.
       Fact never stored a domain, so nothing is removed — this only adds the
       derivation so a Fact's domain is the domain of its Fact Type. -->
Fact is completed.
Fact is example.
<!-- `Fact cites Citation` moved to `Function cites Citation` (2026-09-10, Sam:
     "shouldn't we get Citation analysis moved to a supertype so that we don't
     have to keep redeclaring that for every type?"). A Fact is an Object Type
     Instance and so a Function; the role it plays is inherited. See the
     Citation section below. -->


### Event
Event is of Event Type.
  Each Event is of exactly one Event Type.
Event occurred at Timestamp.
  Each Event occurred at exactly one Timestamp.
Event is created by State Machine.
  Each Event is created by at most one State Machine.
  It is possible that more than one Event is created by the same State Machine.
Transition occurred at Timestamp. *
  Each Transition, Timestamp combination occurs at most once in the population of Transition occurred at Timestamp.
  <!-- value-comparison increment (2026-07-16): outcomes.md:100 referenced
       this fact type without a declaration anywhere — the silent-Replacement
       defect class. A Transition (a definition-level edge) has no clock of
       its own: it occurred at every Timestamp at which some Event caused it,
       so the fact type is fully derived (rule below; recipe in the canon's
       rules:metamodel), leaves the stored schema per Codd 1.5, and carries
       the roles the value-comparison constraint's join path grounds on. -->

### Event Type
Event Type publishes to Stream.
  Each Event Type publishes to at most one Stream.
  It is possible that more than one Event Type publishes to the same Stream.
Event Type can be created by Predicate.
  It is possible that some Event Type can be created by more than one Predicate and that some Predicate can create more than one Event Type.
  For each combination of Event Type and Predicate, that Event Type can be created by that Predicate at most once.
EventTypeCanBeCreatedByPredicate objectifies "Event Type can be created by Predicate".
EventTypeCanBeCreatedByPredicate is a subtype of Function.

### Citing an Authority
### ONE DOOR, ON THE SUPERTYPE (Sam, 2026-09-10: "shouldn't we get Citation
### analysis moved to a supertype so that we don't have to keep redeclaring
### that for every type?"). This stood as four fact types -- `Fact cites
### Citation`, `Fact Type cites Citation`, `Constraint cites Citation` and, for
### an hour, `Object Type cites Citation` -- one per kind that turned out to
### cite an authority, each a table of its own and each a new declaration the
### next kind would need again. Every one of those players is a Function: an
### Object Type is (core.md), a Constraint is, a Fact Type is through Event
### Type, and a Fact is through Event and Object Type Instance. So the role is
### played by Function and the kinds inherit it by population inclusion, which
### is what subtyping means here; the cited element's own kind is read off the
### store, where `Object Type Instance is instance of Object Type` already
### says it, and is not duplicated in four relations.
###
### NORMA HAS THE SAME GENERAL FORM. ORMCore gives each element class its own
### embedded Note and Definition (ObjectTypeHasNote, FactTypeHasNote,
### SetConstraintHasNote, ORMCore.dsl:5079-5199) AND a general reference,
### ModelNoteReferencesModelElement (:5279), for a note that points at any
### element. A Citation is that second thing: it is not owned by the element it
### cites, it refers to it.
###
### WHAT THIS FIXES BESIDES THE REDECLARATION. us-law writes `Fact Type 'Buyer'
### cites Citation 'UCC-2-103'` -- Buyer is a declared entity type, not a
### sentence -- 134 times over 93 subjects, refused since the citation subject
### stopped being minted (2026-09-09) and, before that, minted as a phantom
### fact type with no role and no reading. With one door those sentences are
### rows like any other; only the row's KIND is corrected, to the kind the
### value really is. A subject that names neither a declared fact type nor a
### declared object type is still refused with its sentence.
###
### And the older defect this replaced (2026-09-09): with no `Constraint cites
### Citation`, us-law's 34 `Constraint '...' cites Citation '...'` sentences
### were filed by player signature alone into `Function is superseded by
### Function`, so its store said `Taxpayer files return` IS SUPERSEDED BY
### `IRC-6012` -- thirty-one rows asserting, of a legal corpus, the opposite of
### what the citation means.
Function cites Citation.
  For each combination of Function and Citation, that Function cites that Citation at most once.
  It is possible that some Function cites more than one Citation.
  It is possible that more than one Function cites the same Citation.
FunctionCitesCitation objectifies "Function cites Citation".
FunctionCitesCitation is a subtype of Function.

### Object Type Instance
Object Type Instance is instance of Object Type.
  Each Object Type Instance, Object Type combination occurs at most once in the population of Object Type Instance is instance of Object Type.
  Each Object Type Instance is instance of some Object Type.
ObjectTypeInstanceIsInstanceOfObjectType objectifies "Object Type Instance is instance of Object Type".
ObjectTypeInstanceIsInstanceOfObjectType is a subtype of Function.
<!-- 'exactly one Noun' was NON-CANONICAL (challenged 2026-07-09, verified
     against Halpin, "Subtyping Revisited", NORMA): in ORM subtyping is
     population inclusion — "all instances of one type are also instances
     of a more encompassing type" — so an entity is legitimately an
     instance of its subtype AND every supertype (Patient 101 is in both
     the MalePatient and Patient populations). Membership is transitive;
     there is no single type per entity. The old uniqueness fired alethic
     on every subtype/multi-typed id on recompile. Mandatory only now
     (every Object Type Instance has some type). 'inherited' in ORM is PROPERTY reuse
     (a subtype plays the supertype's roles because it IS a supertype
     instance), not a separate membership relation — so the over-broad
     mirror (instance of every role-noun, supertypes included) is the
     CORRECT transitive membership, and 'Object Type Instance is inherited instance
     of Noun' is a non-canonical crutch (retire separately). -->

Object Type Instance is of Function. *
  Each Object Type Instance, Function combination occurs at most once in the population of Object Type Instance is of Function.
  <!-- ns-2 (ns-derive-population-domains): the single-sourcing BRIDGE for a
       Object Type Instance's domain. A Noun IS a Function (Noun < Function; same identity,
       same id), so this fully-derived FT re-labels the Noun an Object Type Instance is an
       instance of as that same Function. It stores NO domain — it only
       re-projects the existing `Object Type Instance is instance of Noun` value under a
       `Function` role so the domain rule below can JOIN on `Function` (the
       role `Function belongs to Domain` carries), exactly as Violation/Failure
       join on the Function they are against. See the rule under
       "## Derivation Rules". -->
Object Type Instance belongs to Domain. *
  Each Object Type Instance belongs to at most one Domain.
  <!-- ns-2 (ns-derive-population-domains): an Object Type Instance does NOT store its own
       domain — it DERIVES it from the Noun it is an instance of, keeping
       domain single-sourced on Function (a Noun is a subtype of Function;
       core.md "Function belongs to Domain"). The `*` marks this Fact Type as
       fully derived; the rule is under "## Derivation Rules" below. Object Type Instance
       never stored a domain, so nothing is removed — this only adds the
       derivation so an Object Type Instance's domain is the domain of its Noun. Distinct
       from the createEntity `domain` command field (ast.rs `same_identity` /
       `annotate_noun_domain`), which is the per-FILE namespace tag, not a
       stored population-level domain fact. -->
Object Type Instance has Reference.
  Each Object Type Instance has exactly one Reference.
  For each Reference, at most one Object Type Instance has that Reference.
  <!-- arest (Halpin sweep): reversal of the ruling-4 retirement, on
       Halpin's own grounds. Ruling 4 removed this reading because the
       (.Reference) reference mode minted the identical fact type. The
       sweep then removed the mode itself — Object Type Instance is a subtype of
       Function and inherits Function(.id) per §6.7's default — so
       Reference is no longer identity but data: the runtime address, a
       mandatory 1:1 secondary reference. With no mode there is no minted
       fact type to restate, so the Reference Mode Redundancy deontic is
       satisfied. -->
Object Type Instance has Value.
  Each Object Type Instance has at most one Value.
Object Type Instance is created by User.
  Each Object Type Instance is created by at most one User.

### Fact uses Object Type Instance for Role
Fact fills Role.
  Each Fact, Role combination occurs at most once in the population of Fact fills Role.
  Each Fact fills some Role.
RoleInstance objectifies "Fact fills Role".
RoleInstance is a subtype of Function.
RoleInstance uses Object Type Instance.
  Each RoleInstance uses exactly one Object Type Instance.
  <!-- one-table wave (2026-07-16): Halpin's nesting transformation of the
       former `Fact uses Object Type Instance for Role` (compound key Fact+Role): the
       filled-role pair objectifies, its resource rides functionally
       (exactly one — a filling IS a usage), and the compound-key ternary
       leaves the schema. -->
<!-- arest (Halpin, "Objectification and Atomicity", 2020-04-28): the
     former `Object Type Instance Role` objectification is retired. Its UC spans
     {Fact, Role} — two of three roles — and the note restricts
     objectification to fact types with a SPANNING uniqueness constraint
     (the ORM 2 any-fact-type relaxation is retracted; flattened, a
     non-spanning objectification violates the n-1 rule, so populated
     facts against it are non-atomic conjunctions). The old association
     sentence also contradicted the declared UC by claiming the full
     triple as the identification scheme. Nothing in the corpus played a
     role against Object Type Instance Role, which is exactly the note's prescription
     case: the objectified type hosts no other roles, so prefer the
     unnested schema. The ternary stays as the plain fact type above. -->

### User
User has Email.
  Each User has exactly one Email.
  For each Email, at most one User has that Email.
  <!-- arest (Halpin sweep): formerly User(.Email) — an email is
       mutable data, not identity; identification inherits Function(.id)
       and the email survives as a mandatory 1:1 secondary reference. -->

### State Machine (runtime instance of State Machine Definition)
State Machine is instance of State Machine Definition. *
  Each State Machine is instance of exactly one State Machine Definition.
State Machine is instance of Object Type.
  Each State Machine, Object Type combination occurs at most once in the population of State Machine is instance of Object Type.
  Each State Machine is instance of some Object Type.
StateMachineIsInstanceOfObjectType objectifies "State Machine is instance of Object Type".
StateMachineIsInstanceOfObjectType is a subtype of Function.
<!-- 'exactly one Noun' relaxed 2026-07-09 (Samuel: fix the SM readings),
     the SAME non-canonical case as Object Type Instance (see the Object Type Instance note). This
     ft is a REFLECTION cell (protocol.py REFLECTION set) like
     Object Type Instance_is_instance_of_Noun, populated by schema self-description,
     so an SMD reflects as an instance of Noun AND State Machine
     Definition via SMD < Status < Noun (deliberate — the Harel nesting,
     state.md). Transitive membership is correct; the uniqueness was not.
     The sibling 'exactly one State Machine Definition' (line above) is
     NOT a reflection cell and stays exactly-one pending its own
     disambiguation. -->

<!-- task-987 / junk-writer-3: the SM seed has ALWAYS written this
     triple at runtime (compile.rs sm seed: instance_of_Noun +
     for_Object Type Instance + currently_in_Status), but the fact type was never
     DECLARED — so cor:closure's orphan GC dropped the population at
     every compile and the next SM init re-minted it, forever
     (arc-agi-3 issue-13 forensics). Declaring the engine's own
     vocabulary makes the population legal, persistent, queryable
     (a 3NF table), and subject to validate — the substrate-derived
     987 ruling: complete the self-description, never scope it. -->
State Machine is for Object Type Instance.
  For each Object Type Instance, at most one State Machine is for that Object Type Instance.
<!-- arest-audit F: a duplicate `State Machine is for Object Type Instance. *` stood
     here — a fully-derived marker whose rule was REMOVED 2026-06-12 (see
     the note below); the orphaned `*` declared meaning the readings could
     not deliver, while the real writers are the SM seed and the task-929
     backfill. The asserted fact type above is the truth. -->

<!-- [REMOVED 2026-06-12, board-derived-layer poisoning] The rule
     `* State Machine is for Object Type Instance iff Object Type Instance is instance of Noun
     and some State Machine Definition is for that Noun.` is
     UNDERSPECIFIED: it cannot bind WHICH State Machine, so it emitted
     one-role partial tuples. Starved for months (its antecedent
     `Object Type Instance is instance of Noun` was empty), it activated the moment
     the task-987 membership reflection populated that cell — the
     partials landed first in the Object Type Instance-keyed cell and
     KeyConflict-displaced every real SM-for-Object Type Instance fact, emptying
     the entire Task derived layer downstream (status bridge,
     recommendation markers). The REAL writers are the SM seed
     (compile.rs s0 trio) and the task-929 for-Object Type Instance backfill; the
     chain-side arity-completeness guard is the defense-in-depth. -->


### State (projected from SM via State Machine is for Object Type Instance × State Machine is currently in Status)
<!-- task-742 rename context: post-rename the canonical SM status
     lives in State_Machine_is_currently_in_Status, keyed by the
     SM entity id; the per-Object Type Instance projection materialises via the
     SM-for-Object Type Instance role chain. Object Type Instance is an abstract noun so
     RMAP cannot absorb the status into an Object Type Instance cell -- there
     IS no Object Type Instance cell. App-level readings (e.g. apps/tasks/
     readings/app.md) carry the explicit projection
     "Object Type Instance is currently in Status iff some State Machine is
     for that Object Type Instance and that State Machine is currently in
     that Status."  -->
Object Type Instance is currently in Status. *
  Each Object Type Instance is currently in at most one Status.

<!-- task-955/924 (exec-6 hygiene: was a #-styled pseudo-comment): key the
     SM-keyed status projection so it stays single-valued. The killed
     host's imperative transition write AND the SM event-fold both wrote
     `State_Machine_is_currently_in_Status`; without this UC the cell is
     un-keyed, so the chain folds it by full tuple and the event-fold
     (which emits one status per triggered event) ACCUMULATES every
     historical status — the 923/924 readback artifact. Keyed by State
     Machine, keyed-upsert collapses the per-resource emits to
     last-write-wins (the latest transition target, in transition_table
     declaration order). -->
State Machine is currently in Status. +
  Each State Machine is currently in exactly one Status.
  <!-- audit-fix A4: semi-derived — the seed-branch rule below derives the
       initial occupancy; runtime transitions assert the moves. -->

### Event Caused Transition (objectification of "Event caused Transition in State Machine")
Event caused Transition in State Machine.
  In each population of Event caused Transition in State Machine, each Event, Transition, State Machine combination occurs at most once.
Event Caused Transition objectifies "Event caused Transition in State Machine".
Event Caused Transition is a subtype of Function.
  <!-- objectification legal per Halpin, "Objectification and Atomicity"
       (2020-04-28): the UC above spans all three roles. one-table wave
       (2026-07-16): identity through the one id space. -->

## Subset Constraints

If some Event caused some Transition in some State Machine then that Event is of some Event Type
  where that Transition is triggered by that Event Type.

### Guard Run
Guard Run is for Guard.
  Each Guard Run is for exactly one Guard.
Guard Run references Fact.
  It is possible that some Guard Run references more than one Fact and that some Fact is referenced by more than one Guard Run.
  For each combination of Guard Run and Fact, that Guard Run references that Fact at most once.
GuardRunReferencesFact objectifies "Guard Run references Fact".
GuardRunReferencesFact is a subtype of Function.
Guard Run has Result.
  Each Guard Run has at most one Result.

## Derivation Rules

<!-- ns-2 (ns-derive-population-domains): instance-level populations DERIVE
     their home Domain from their associated Function-subtype, keeping domain
     single-sourced on Function (core.md "Function belongs to Domain"). These
     rules FIRE through forward-chain (mirroring the outcomes.md Violation /
     Failure rules), via a single-sourcing FUNCTION BRIDGE.

     WHY THE BRIDGE: the forward-chaining JOIN that propagates the Domain value
     only forms when the relating Fact Type and `belongs to Domain` share a
     role NOUN-NAME, and the relating clause must resolve to a declared FT (the
     SchemaCatalog is keyed by role noun-SET). The outcomes rules join directly
     because `is against Function` and `Function belongs to Domain` both carry a
     `Function` role. An Object Type Instance's natural relating fact is `is instance of
     Noun` and a Fact's is `is of Fact Type` — those carry a `Noun` / `Fact
     Type` role, and a clause `that Noun belongs to Domain` neither resolves to
     the Function-keyed `Function belongs to Domain` FT (noun-set `[Domain,
     Noun]` is not declared) nor shares its `Function` role, so no join forms.

     A Noun IS a Function and a Fact Type IS a Function (Fact Type < Object Type Instance <
     Noun < Function), with the SAME identity / id. So the fully-derived bridge
     FTs `Object Type Instance is of Function` / `Fact is of Function` (declared above)
     re-label that same value under a `Function` role — a 1-antecedent
     ModusPonens with a computed-binding rename (`Function is Noun` /
     `Function is Fact Type`); they STORE NO domain. The domain rules then relate
     via `is of Function` and JOIN on `Function` with `Function belongs to
     Domain` — byte-for-byte the Violation / Failure shape — and the Domain
     value propagates onto the Object Type Instance / Fact consequent. Domain stays
     single-sourced on Function throughout (the only Domain-valued fact lives on
     the Function; Object Type Instance / Fact / the bridge store none).

     A future engine fix (filed task `derivation-subtype-join-resolution`) that
     resolves a subtype-subject `belongs to Domain` clause to the Function FT
     and widens the join across the subtype lattice would let the relating
     clause be the natural `is instance of Noun` / `is of Fact Type` directly
     and retire the bridge; until then the bridge is the readings-only form
     that materialises the single-sourced domain. -->

<!-- arest audit-fix A1 (2026-07-15): the four bridge rules are LIVE
     again. The 2026-06-22 disablement ("convergence-cycle ...
     absorbed-Function self-reference") was a defect of the killed host's
     deriver, never of the math — these are stratified positive joins with
     no value introduction (Lem 1), and the readings above wore `*`
     markers that nothing delivered: drift wearing a derivation mark. The
     reference-scheme sweep made the cast clause literal: one id space,
     so "some Object Type that is that Function" binds by identity.
     Evaluator-phase gate obligation: prove convergence on
     subtype-identity joins before claiming these cells. -->
* Object Type Instance is of Function iff that Object Type Instance is instance of some Object Type that is that Function.

* Object Type Instance belongs to Domain iff that Object Type Instance is of some Function that belongs to that Domain.

<!-- `Fact is of Fact Type` is a BASE fact type, populated by population
     reflection (the killed host did this in compile.rs
     `reflect_schema_cells`; the evaluator must reflect populated
     fact-type cells the same way) — every populated row of a fact-type
     cell IS a Fact of that fact type, the instance-object mirror of
     `Object Type Instance is instance of Noun`. It is VALIDATED, not derived, by the
     subset constraint in core.md (`If some Fact uses some Object Type Instance for some
     Role then that Fact is of some Fact Type that has that Role`). -->
* Fact is of Function iff that Fact is of some Fact Type that is that Function.

* Fact belongs to Domain iff that Fact is of some Function that belongs to that Domain.

<!-- sm-retire-forml2: SM/Object Type Instance status projections lifted from imperative
     Rust into reading-level derivations.

     (1) instance-of-definition (noun-scoped): replaces the compile-time-baked
         definition_id / compile_sm_instance_of_definition_backfill_for. A State
         Machine is an instance of the SM Definition that governs the Noun its
         Object Type Instance is an instance of. 3-antecedent equi-join, derivation.md
         shape 6. NOTE: `State Machine is for Object Type Instance` (the WHICH-SM binding)
         is NOT lifted — the `same entity as` identity equi-binding the safe
         rule would need is NOT supported by the parser (verified: no
         `same entity as` lowering in parse_forml2), and the underspecified
         partial-tuple form was REMOVED 2026-06-12 for KeyConflict-displacing
         real facts (instances.md 155-167). So compile_sm_for_resource_backfill_for
         is RETAINED.

     (2) Object Type Instance-is-currently-in-Status projection: lifts the per-app
         projection (apps/tasks/readings/app.md) to core, replacing the
         imperative Object Type Instance_is_currently_in_Status maintenance block in
         command.rs. 2-antecedent equi-join (derivation.md shape 6),
         single-valued.

     (3) SM seed branch: a fresh / eventless SM instance sits at its
         Definition's effective-initial status. 1-antecedent + effective-initial
         join. This is the ONLY authorable half of the current-status producer;
         the ADVANCE branch (last-applicable-transition fold over the
         occurred-ordered trigger-event history) has NO authorable shape (no
         ordered-foldl-into-the-same-cell antecedent in derivation.md 255-368)
         AND requires derived-cell retraction, so the live advance fold
         (compile_sm_reconstruction_fold) stays engine-synthesised. The keyed UC
         on State_Machine_is_currently_in_Status (instances.md 184-193) collapses
         the seed emit and the fold emits to last-write-wins. -->

* State Machine is instance of State Machine Definition iff that State Machine is for some Object Type Instance and that Object Type Instance is instance of some Object Type and that State Machine Definition is for that Object Type.

* Object Type Instance is currently in Status iff some State Machine is for that Object Type Instance and that State Machine is currently in that Status.

* State Machine is currently in Status iff that State Machine is instance of some State Machine Definition and that Status is effective initial in that State Machine Definition.

* Transition occurred at Timestamp iff some Event caused that Transition in some State Machine and that Event occurred at that Timestamp.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'instances' has Access 'public'. -->
### The apostrophe in `metamodel’s` is TYPOGRAPHIC, like the em dash beside it,
### because a straight one closes the quoted span. Written straight, this
### Description was stored truncated at "metamodel" for as long as the line has
### existed, and the rest of the sentence -- "s types are populated BY, and what
### a Fact is of a Function means." -- was read as predicate text. Nothing
### reported it. Prose descriptions are where apostrophes live; see the task.
Domain 'instances' has Description 'The instance level: Object Type Instances, Facts, Role Instances and the State Machines that carry them — the population the metamodel’s types are populated BY, and what a Fact is of a Function means.'.
