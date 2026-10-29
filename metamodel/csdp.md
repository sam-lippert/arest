# CSDP

## Description

<!-- arest-audit H (10.2 discipline: readings files carry sentences of R
     and comments; bare prose invites prose-as-name compile artifacts):
     Halpin's Conceptual Schema Design Procedure (7 steps) as an
     EXECUTABLE state machine of the framework itself, not prose and not
     an app: every AREST universe of discourse carries the procedure that
     designs it (procedural-code-to-substrate — the engine drives and
     ENFORCES its own design procedure; you cannot skip a CSDP step the
     SM does not afford). Each Schema Design is an entity whose status is
     the CSDP step it has reached; the legal transitions out of the
     current status are the ONLY HATEOAS affordances. Building an app is
     navigation of this machine — the links ARE the next valid CSDP
     steps. -->

<!--
Steps per Halpin 2001: (1) elementary facts from examples (sec 3.3),
(2) draw fact types and populate (3.4), (3) trim schema; note basic
derivations (3.5), (4) uniqueness constraints + arity check (4.1),
(5) mandatory roles + logical derivations (5.1), (6) value,
set-comparison and subtype constraints (6.1), (7) other constraints
+ final checks (7.1).
-->

<!--
A CHANGE IS A SCHEMA DESIGN OVER A POPULATED DOMAIN (Sam, 2026-10-26): the Domain Change machine
(evolution.md) folds in here. Its migration is step 2's restatement of the population, its approval
step 6's acceptance (Halpin 2008, sec. 1.2: the modeler abstracts to fact types once the domain expert
agrees with the verbalization), step 7's final checks (sec. 7.5) its validity, and applying it a step of
its own after the relational mapping (Sam, 2026-10-28: RMAP just creates the schema). A design the expert
does not accept goes back to step 1; there is no reject step, since a dropped proposal's rows are
dropped (Sam, 2026-10-28). Formerly: CSDP is
how a schema comes to BE, the Domain Change SM is how it CHANGES —
the two halves of the self-modification machinery. First proven as
the apps/csdp dogfood walk (the tasks app's in-progress-
recommendation derivation traversed design → rmap end-to-end);
now part of the framework proper.
-->

## Instance Facts

<!-- The file's Domain, as it was when evolution.md shared it: the Domain Change machine folded in here (Sam,
     2026-10-26), so Domain 'evolution' is how a schema comes to be and how it changes, one machine. -->
Domain 'evolution' has Description 'Self-modification as the Conceptual Schema Design Procedure: a Schema Design over a populated Domain is a change, approved at step 6 by a human User and applied after its relational mapping. Proposing a new fact type is proposing a theorem (Curry-Howard). CSDP validation is the proof check, successful ingestion is the proof.'.

Object Type 'Design Note' has Format 'text'.
  <!-- Widget opt-in (pb-zero-glue-acceptance): the §4.2 view rules
       key widgets off the value type's Format; until the CDT→Format
       bridge lands (audit-entity-datatype-norma-vs-view Phase 2) a
       value type declares its Format explicitly. With this fact a
       getEntity on a Schema Design synthesizes an instance view
       whose Design Note renders as a text-input — through the
       generic render seam, zero procedure-specific code. -->.

## Entity Types

Schema Design is an entity type.
Schema Design is a subtype of Object Type Instance.
Signal is an entity type.
Signal is a subtype of Object Type Instance.

## Value Types

Design Note is a value type.
The data type of Design Note is text.
Rationale is a value type.
  The data type of Rationale is text.
Signal Kind is a value type.
  The possible values of Signal Kind are 'Constraint Violation', 'Error Pattern', 'Feature Request', 'Support Request'.
  The data type of Signal Kind is text.

## Fact Types

### Schema Design

Schema Design has Design Note.
  Each Schema Design has at most one Design Note.

<!-- A Schema Design proposes a DEFINITION: Function is the unification root that names every
     definition, so one open fact type carries every kind (an Object Type, a Fact Type, a Constraint,
     a Derivation Rule, a Migration) without an enumeration to keep (from evolution.md). -->
Schema Design proposes Function.
  Each Schema Design, Function combination occurs at most once in the population of Schema Design proposes Function.
  It is possible that some Schema Design proposes more than one Function and that more than one Schema Design proposes the same Function.

Schema Design has Rationale.
  Each Schema Design has exactly one Rationale.

Schema Design targets Domain.
  Each Schema Design targets exactly one Domain.

Schema Design retires Reading.
  Each Schema Design, Reading combination occurs at most once in the population of Schema Design retires Reading.
  It is possible that some Schema Design retires more than one Reading and that more than one Schema Design retires the same Reading.
  <!-- A design creates a fact type from a reading. The fact type may be retracted, but the reading
       persists: retiring a Reading retracts the Fact Type it created (its Roles and its stored rows)
       once a User approves the design and the readings no longer declare that fact type; the Reading
       stays, its Text spelled out in its players' names (compile:ip_migrate). -->

Schema Design is evaluated.
  <!-- Asserted by the staged gate run: ingesting a design is itself a create judged by the one gate
       (11.2, Cor 4); without the marker, no violations before any evaluation would read as validity. -->

Schema Design has blocking outcome. *

Schema Design is valid. *

### Signal

Signal leads to Schema Design.
  Each Signal leads to at most one Schema Design.

Signal has Signal Kind.
  Each Signal has exactly one Signal Kind.

Signal is raised by Object Type Instance.
  Each Signal is raised by exactly one Object Type Instance.

### The domain expert's judgments

User approves Schema Design.
  Each User, Schema Design combination occurs at most once in the population of User approves Schema Design.

User requests revision of Schema Design.
  Each User, Schema Design combination occurs at most once in the population of User requests revision of Schema Design.

Schema Design is applied.

### CSDP step-completion event facts

<!-- arest: the procedure these step facts narrate is
     DEFINED in the lambda — `arest` carries csdp (seven steps composed;
     s1/s3/s6-acceptance as registered seams, s2/s4/s5/s7 computable:
     population gate, uniqueness induction from example populations,
     mandatory derivation, the n-1 elementarity gate) and rmap (rule-2
     absorption / rule-1 separation over the schema). These
     readings remain the workflow's fact-side narration; the lambda defs
     are the operations the steps perform. -->

Schema Design notes elementary facts.
Schema Design populates fact types.
Schema Design trims schema and notes derivations.
Schema Design adds uniqueness constraints.
Schema Design adds mandatory roles.
Schema Design adds value and subtype constraints.
Schema Design passes final checks.

## Constraints

Each Schema Design proposes some Function.

It is obligatory that each Schema Design has exactly one Rationale.

<!-- THE SELF-MODIFICATION GATE ("it always has to be one Human. There must be a throat to choke."),
     moved from evolution.md with its reasons: accountability sits at the approval, not at what prompted
     the change; it is an obligation so the cardinality does not fall inside a negated scope; every Domain,
     not an enumeration; and User is a role over the mixin, so an Agent may be a User and propose a
     change, never sign it off. -->
It is obligatory that if some Schema Design is applied then some User approves that Schema Design.
It is obligatory that if some User approves some Schema Design then that User is human.

## Derivation Rules

* Schema Design has blocking outcome iff some Violation is triggered by that Schema Design and that Violation has Severity 'error'.

* Schema Design has blocking outcome iff some Failure is triggered by that Schema Design.

* Schema Design is valid iff that Schema Design is evaluated and it is not true that that Schema Design has blocking outcome.

## State Machine

State Machine Definition 'CSDP' is for Object Type 'Schema Design'.
Status 'step1-elementary-facts' is initial in State Machine Definition 'CSDP'.
Status 'applied' is terminal in State Machine Definition 'CSDP'.


Transition 'advance-to-step2' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step2' is from Status 'step1-elementary-facts'.
Transition 'advance-to-step2' is to Status 'step2-populate'.
Transition 'advance-to-step2' is triggered by Event Type 'Schema Design notes elementary facts'.

Transition 'advance-to-step3' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step3' is from Status 'step2-populate'.
Transition 'advance-to-step3' is to Status 'step3-trim-derivations'.
Transition 'advance-to-step3' is triggered by Event Type 'Schema Design populates fact types'.

Transition 'advance-to-step4' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step4' is from Status 'step3-trim-derivations'.
Transition 'advance-to-step4' is to Status 'step4-uniqueness'.
Transition 'advance-to-step4' is triggered by Event Type 'Schema Design trims schema and notes derivations'.

Transition 'advance-to-step5' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step5' is from Status 'step4-uniqueness'.
Transition 'advance-to-step5' is to Status 'step5-mandatory'.
Transition 'advance-to-step5' is triggered by Event Type 'Schema Design adds uniqueness constraints'.

Transition 'advance-to-step6' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step6' is from Status 'step5-mandatory'.
Transition 'advance-to-step6' is to Status 'step6-value-subtype'.
Transition 'advance-to-step6' is triggered by Event Type 'Schema Design adds mandatory roles'.

Transition 'advance-to-step7' is defined in State Machine Definition 'CSDP'.
Transition 'advance-to-step7' is from Status 'step6-value-subtype'.
Transition 'advance-to-step7' is to Status 'step7-final-checks'.
Transition 'advance-to-step7' is triggered by Event Type 'User approves Schema Design'.
<!-- STEP 6'S ACCEPTANCE IS THE APPROVAL (Sam, 2026-10-26), affordable only for a design the staged gate
     judged valid (the guard evolution.md's approve-change carried). -->
Guard 'valid-schema-design' guards Transition 'advance-to-step7'.
Guard 'valid-schema-design' references Fact Type 'SchemaDesignIsValid'.

Transition 'revise' is defined in State Machine Definition 'CSDP'.
Transition 'revise' is from Status 'step6-value-subtype'.
Transition 'revise' is to Status 'step1-elementary-facts'.
Transition 'revise' is triggered by Event Type 'User requests revision of Schema Design'.

Transition 'complete-design' is defined in State Machine Definition 'CSDP'.
Transition 'complete-design' is from Status 'step7-final-checks'.
Transition 'complete-design' is to Status 'designed'.
Transition 'complete-design' is triggered by Event Type 'Schema Design passes final checks'.

<!-- APPLYING IS ITS OWN STEP (Sam, 2026-10-28: RMAP just creates the schema): a designed schema is mapped
     (Rmap, below), and applying it re-maps the tables it touches, in the write that applies it: the
     Predicate takes the store (perform:on_store) and answers it with the Relational Schema rows of the
     touched tables re-mapped, and the emit runs the DDL their difference implies (schema:emit_ddl). -->
Transition 'apply' is defined in State Machine Definition 'CSDP'.
Transition 'apply' is from Status 'designed'.
Transition 'apply' is to Status 'applied'.
Transition 'apply' is triggered by Event Type 'Schema Design is applied'.

Predicate 'remap touched tables' is performed during Transition 'apply'.
Predicate 'remap touched tables' has Module Path 'arest'.
Predicate 'remap touched tables' has Symbol Name 'schema:dc_remap'.

# Rmap

## Description

<!--
Halpin's basic Rmap procedure (relational mapping, 2001 sec 10.3,
summary box p. 428) as an executable state machine, the sibling of
the CSDP machine above: a designed conceptual schema is mapped to a
relational schema by walking steps 0-2, and the legal transitions
are the only affordances. Step 0: absorb subtypes into their top
supertype, mentally erase explicit primary identification schemes,
treat compositely identified object types as black boxes. Step 1:
map each fact type with a compound UC to a separate table. Step 2:
group fact types with functional roles attached to the same object
type into one table keyed on that object type's identifier; map 1:1
cases to a single table favoring fewer nulls (subtype-specific
columns carry their qualifications).
-->

## Entity Types

Relational Mapping is an entity type.
Relational Mapping is a subtype of Object Type Instance.

## Fact Types

### Relational Mapping

Relational Mapping maps Schema Design.
  Each Relational Mapping maps exactly one Schema Design.

### Rmap step-completion event facts

Relational Mapping absorbs subtypes.
Relational Mapping maps compound fact types.
Relational Mapping groups functional fact types.

## State Machine

State Machine Definition 'Rmap' is for Object Type 'Relational Mapping'.
Status 'step0-absorb-subtypes' is initial in State Machine Definition 'Rmap'.
Status 'mapped' is terminal in State Machine Definition 'Rmap'.

Transition 'advance-to-rmap1' is defined in State Machine Definition 'Rmap'.
Transition 'advance-to-rmap1' is from Status 'step0-absorb-subtypes'.
Transition 'advance-to-rmap1' is to Status 'step1-compound-uc-tables'.
Transition 'advance-to-rmap1' is triggered by Event Type 'Relational Mapping absorbs subtypes'.

Transition 'advance-to-rmap2' is defined in State Machine Definition 'Rmap'.
Transition 'advance-to-rmap2' is from Status 'step1-compound-uc-tables'.
Transition 'advance-to-rmap2' is to Status 'step2-functional-grouping'.
Transition 'advance-to-rmap2' is triggered by Event Type 'Relational Mapping maps compound fact types'.

Transition 'complete-mapping' is defined in State Machine Definition 'Rmap'.
Transition 'complete-mapping' is from Status 'step2-functional-grouping'.
Transition 'complete-mapping' is to Status 'mapped'.
Transition 'complete-mapping' is triggered by Event Type 'Relational Mapping groups functional fact types'.

# Relational Schema

## Description

<!-- RMAP's output object. After NORMA's relational catalog
     (rcd:Table, rcd:Column, rcd:UniquenessConstraint IsPrimary,
     rcd:ReferenceConstraint) and its bridge back to the conceptual schema
     (TableIsPrimarilyForConceptType, ColumnHasConceptTypeChild,
     UniquenessConstraintIsForUniqueness). The schema is rows in the store;
     the attached engine initializes it as the app's database. The bridge is
     what makes the mapping incremental: a Schema Design re-derives only the
     tables bridged to the Functions it proposes. -->

## Entity Types

Relational Schema is an entity type.
Table is an entity type.
Column is an entity type.
Table Key is an entity type.
Table Reference is an entity type.

## Fact Types

### Relational Schema

Relational Mapping produces Relational Schema.
  Each Relational Mapping produces exactly one Relational Schema.

Relational Schema is for Domain.
  Each Relational Schema is for exactly one Domain.
  For each Domain, at most one Relational Schema is for that Domain.
  <!-- DOMAINS: an app keeps its own database while it
       compiles with a shared library, and a child organization never
       administers its parent unless granted. So a schema is for the Domain
       that keeps a store (an app, or a sublet child, whose store is a cell
       in its parent's). A Domain it uses lends names, never data: what that
       Domain declares is mapped into the using Domain's own schema, as its
       own tables. Two apps that use one library hold two tables for one
       fact type, and neither sees the other's rows. -->

Relational Schema covers Domain. *
  Each Relational Schema, Domain combination occurs at most once in the population of Relational Schema covers Domain.

### Table

Table belongs to Relational Schema.
  Each Table belongs to exactly one Relational Schema.

Table has Name.
  Each Table has exactly one Name.
  For each Relational Schema and Name, at most one Table belongs to that Relational Schema and has that Name.

Table is primarily for Object Type.
  Each Table is primarily for at most one Object Type.

Table is primarily for Fact Type.
  Each Table is primarily for at most one Fact Type.

For each Table, that Table is primarily for some Object Type or that Table is primarily for some Fact Type.
  <!-- Inclusive, not exclusive (a fact that is also an object is
       very common): an objectified fact type's one table is primarily for the Fact
       Type and for the Object Type that objectifies it, so a Domain Change touching
       either re-maps it. -->

If some Table belongs to some Relational Schema and that Table is primarily for some Object Type and that Object Type belongs to some Domain then that Relational Schema covers that Domain.
If some Table belongs to some Relational Schema and that Table is primarily for some Fact Type and that Fact Type belongs to some Domain then that Relational Schema covers that Domain.
  <!-- A schema maps only what its Domain declares or draws on: PM's schema
       has no table for support's tickets unless both draw on the Domain that
       declares them. -->

Table is a view.
  <!-- Asserted by Rmap for the views it builds, not derived. A fully
       derived fact type is not always a table: a functional one is grouped into its
       entity's table as a column (step 2), so a rule over the derivation mode would
       call more tables views than the database holds. -->

### Column

Column belongs to Table.
  Each Column belongs to exactly one Table.

Column has Name.
  Each Column has exactly one Name.
  For each Table and Name, at most one Column belongs to that Table and has that Name.

Column has Position.
  Each Column has exactly one Position.
  For each Table and Position, at most one Column belongs to that Table and has that Position.

Column has Conceptual Data Type.
  Each Column has at most one Conceptual Data Type.

Column is nullable.

Column is for Role.
  Each Column, Role combination occurs at most once in the population of Column is for Role.
  Each Column is for some Role.
  <!-- Holds for key columns too (Halpin's Rmap step 4): a compositely
       identified object type is a black box until its column is unpacked into the
       columns of its identifying fact types, each the column of a role of them. -->

### Table Key

Table Key belongs to Table.
  Each Table Key belongs to exactly one Table.

Table Key spans Column.
  Each Table Key, Column combination occurs at most once in the population of Table Key spans Column.
  Each Table Key spans some Column.

Table has primary Table Key.
  Each Table has at most one primary Table Key.
  For each Table Key, at most one Table has primary that Table Key.

Table Key realizes Constraint.
  Each Table Key realizes at most one Constraint.

### Table Reference

Table Reference is from Table.
  Each Table Reference is from exactly one Table.

Table Reference targets Table Key.
  Each Table Reference targets exactly one Table Key.

Table Reference uses Column.
  Each Table Reference, Column combination occurs at most once in the population of Table Reference uses Column.
  Each Table Reference uses some Column.

### Incremental mapping

Schema Design touches Table. *

## Derivation Rules

* Relational Schema covers Domain iff that Relational Schema is for that Domain.
* Relational Schema covers Domain2 iff that Relational Schema is for some Domain1 and Domain1 draws on Domain2.

* Schema Design touches Table iff that Schema Design proposes some Role and some Column belongs to that Table and that Column is for that Role.
* Schema Design touches Table iff that Schema Design proposes some Object Type and that Table is primarily for that Object Type.
* Schema Design touches Table iff that Schema Design proposes some Fact Type and that Table is primarily for that Fact Type.
* Schema Design touches Table iff that Schema Design proposes some Constraint and some Table Key belongs to that Table and that Table Key realizes that Constraint.
