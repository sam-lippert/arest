# AREST Outcomes: Violations and Failures as Facts

## Entity Types

Violation is an entity type.
Violation is a subtype of Object Type Instance.
Failure is an entity type.
Failure is a subtype of Object Type Instance.
Batch is an entity type.
Batch is a subtype of Object Type Instance.

## Value Types

Failure Type is a value type.
  The possible values of Failure Type are 'extraction', 'evaluation', 'transition', 'parse', 'induction'.
  The data type of Failure Type is text.
Severity is a value type.
  The possible values of Severity are 'error', 'warning', 'info'.
  The data type of Severity is text.
<!-- exec (2026-07-16): Confidence retired — roleless orphan, superseded by
     induction.md's Confidence Score (Hypothesis Candidate has Confidence
     Score). See the retirement note in core.md's value-type roster. -->

## Fact Types

### Violation
Violation belongs to Domain. *
  Each Violation belongs to at most one Domain.
  <!-- ns-2 (ns-derive-population-domains): Violation does NOT store its own
       domain — it DERIVES it from the Function it is against, so domain stays
       single-sourced on Function (core.md "Function belongs to Domain"). The
       `*` marks this Fact Type as fully derived; the rule is under
       "## Derivation Rules" below. The prior stored binding ("Each Violation
       belongs to exactly one Domain") is removed — outcome facts inherit
       their domain via derivation, never duplication. -->
Violation is of Constraint.
  Each Violation is of exactly one Constraint.
Violation is against Function.
  Each Violation is against at most one Function.
Violation has Text.
  Each Violation has exactly one Text.
Violation has Severity.
  Each Violation has exactly one Severity.
Violation occurred at Timestamp.
  Each Violation occurred at exactly one Timestamp.
Violation belongs to Batch.
  Each Violation belongs to at most one Batch.

### Failure
Failure belongs to Domain. *
  Each Failure belongs to at most one Domain.
  <!-- ns-2 (ns-derive-population-domains): Failure does NOT store its own
       domain — it DERIVES it from the Function (its operation / verb; a Verb
       is a subtype of Function) it is against, so domain stays single-sourced
       on Function. The `*` marks this Fact Type as fully derived; the rule is
       under "## Derivation Rules" below. The prior stored binding ("Each
       Failure belongs to at most one Domain") is removed. -->
Failure has Failure Type.
  Each Failure has exactly one Failure Type.
Failure is against Function.
  Each Failure is against at most one Function.
Failure has input Text.
  Each Failure has at most one input Text.
Failure has reason Text.
  Each Failure has exactly one reason Text.
Failure has Severity.
  Each Failure has exactly one Severity.
Failure occurred at Timestamp.
  Each Failure occurred at exactly one Timestamp.

### Causal Links
Failure is caused by Violation.
  Each Failure is caused by at most one Violation.
Violation is triggered by Object Type Instance.
  Each Violation is triggered by at most one Object Type Instance.
Failure is triggered by Object Type Instance.
  Each Failure is triggered by at most one Object Type Instance.
  <!-- arest-audit: provenance parity with Violation. evolution.md's
       validity rules read it — a staged Domain Change application that
       cannot parse emits a Failure (Failure Type 'parse') triggered by
       the change, mirroring how a gate refusal emits a Violation
       triggered by it. -->
Failure occurs during Transition.
  Each Failure occurs during at most one Transition.

### Temporal Ordering
Failure follows Violation.
  Each Failure follows at most one Violation.
Violation occurs before Transition.
  Each Violation occurs before at most one Transition.
Failure succeeds Violation. *
  Each Failure, Violation combination occurs at most once in the population of Failure succeeds Violation.
  <!-- residue fix (2026-07-16): the former disjunctive consequent ("is
       caused by ... or ... Timestamp is before ...") is this UNION relation
       reified: a Failure succeeds a Violation when it is caused by it or
       when it temporally follows it. Fully derived (rules below; recipes in
       the canon's rules:metamodel — the union is two rules on one target,
       the temporal leg riding the cmp recipe form), so the subset sentence
       below becomes a plain one-clause subset NORMA holds as a real
       element. -->

## Constraints

Each Violation is of exactly one Constraint.
Each Failure has exactly one Failure Type.

## Subset Constraints

If some Failure follows some Violation then that Failure succeeds that Violation.
If some Violation occurs before some Transition then that Violation occurred at some Timestamp and that Transition occurred at some Timestamp where that Violation Timestamp is before that Transition Timestamp.

## Derivation Rules

<!-- ns-2 (ns-derive-population-domains): outcome facts DERIVE their home
     Domain from the Function they are against, keeping domain single-sourced
     on Function (core.md "Function belongs to Domain"). The shape is the
     standard existential-over-join derivation
     (`<X> belongs to Domain iff <X> <relates to> some <Y> and <Y> belongs to
     Domain`); because `belongs to Domain` is declared on Function and both
     `is against Function` and `Function belongs to Domain` carry a Function
     role, the rule classifies as a Join and the Domain value propagates from
     the joined Function fact onto the Violation / Failure consequent. No
     domain is stored on the outcome itself. -->

* Failure succeeds Violation iff that Failure is caused by that Violation.

* Failure succeeds Violation iff that Violation occurred at some Timestamp1 and that Failure occurred at some Timestamp2 where Timestamp1 is before Timestamp2.

* Violation belongs to Domain iff Violation is against Function and that Function belongs to Domain.

* Failure belongs to Domain iff Failure is against Function and that Function belongs to Domain.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'outcomes' has Access 'public'. -->
Domain 'outcomes' has Description 'Violations and failures as first-class facts. Every evaluation path returns valid claims, violation facts, failure facts, or a combination. No silent paths.'.
