# AREST Validation: ORM2 Modeling Rules

## Deontic Constraints

### Object Type Declaration

It is obligatory that each Role references exactly one Object Type.

### Arity Decomposition

It is forbidden that a Constraint of Constraint Type 'UC' spans fewer Roles than the arity of its Fact Type minus one.

### Objectification Spanning

It is forbidden that a Fact Type is objectified when no Constraint of Constraint Type 'UC' spans all Roles of that Fact Type.
<!-- Halpin, "Objectification and Atomicity" (2020-04-28,
     infosci/ObjectificationAndAtomicity.pdf): objectification is
     restricted to fact types with a SPANNING uniqueness constraint —
     the ORM 1 relaxation admitting 1:1s and the ORM 2 relaxation
     admitting any fact type are both retracted. Flattened, an
     objectified fact type without a spanning UC violates the n-1 rule
     (Arity Decomposition above), so facts populated against the
     objectified type are non-atomic conjunctions. Unaries pass without
     exemption: a unary's single role is a spanning UC, asserted or
     implied. NORMA as shipped still implements the ORM 2 relaxation,
     so the oracle checks this rule itself at objectification time.
     First enforcement: the former Resource Role objectification
     (instances.md) was retired under this rule. -->



### Ring Constraint Completeness

It is obligatory that when a Fact Type has exactly two Roles that both reference the same Object Type, some Constraint of Constraint Type 'IR', 'AS', 'AT', 'SY', 'IT', 'TR', or 'AC' spans those Roles.

It is permitted that a Fact Type has no Constraint of Constraint Type 'IR', 'AS', 'AT', 'SY', 'IT', 'TR', or 'AC' spanning its Roles when the Reading of that Fact Type contains a capitalized-word-prefixed form of its Ring Object Type, or when some Object Type ending in that Ring Object Type is declared elsewhere in the corpus.
<!-- elysium-audit H (prose split, per the vindicated 10.2 scrub): the two
     conditions reflect compound-noun parse-time artifacts (eu-law
     `Personal Data Breach … Personal Data` and Biometric/Genetic/Personal
     Data sharing the `Data` suffix) and were read by the killed host's
     `check_ring_completeness` to suppress ring-completeness hints;
     without them, that corpus surfaced 9 false positives. The permission
     sentence remains the source of truth for the suppression patterns —
     the evaluator-phase checker must read the Permission cell and apply
     the named pattern matchers; deleting either condition re-enables the
     corresponding hints. -->


### Ring Constraint Validity

<!-- It is forbidden that a Constraint of Constraint Type 'IR', 'AS', 'AT', 'SY', 'IT', 'TR', or 'AC' spans Roles of a Fact Type where those Roles reference different Nouns. -->

### Singular Naming

It is forbidden that Object Type has Name that ends in 's' when that Name is a plural form.
<!-- audit-fix C: one home. core.md's cruder syntactic 'ies' rule is
     retired into this one — the plural-form qualifier is what keeps
     Series and Species legal. -->

### Alethic Before Deontic

It is forbidden that a Constraint has Modality Type 'Deontic' when that Constraint could be enforced as Modality Type 'Alethic'.

### Derivation Over Storage

It is forbidden that a Role stores a value that is derivable from existing Fact instances and Constraint spans.

### Subtype Constraint Declaration

It is obligatory that each subtype Object Type has some totality or exclusion Constraint declared for its supertype relationship.

### Reference Mode Redundancy

It is forbidden that a Reading restates the Reference Mode of an Object Type as a separate Fact Type.
<!-- elysium-batch ruling 4: un-commented and reworded to canonical
     vocabulary. NORMA models the machinery as ReferenceMode +
     ReferenceModeKind (General/Popular/UnitBased; ORM2Core.xsd): the mode
     mints the value type and the identifying fact type, so restating it
     as an explicit reading duplicates the model. First enforcement:
     instances.md's `Resource has Reference` retired. -->

### Elementary Fact Decomposition

It is forbidden that a Reading conjoins two independent assertions using 'and' when they can be expressed as separate Readings.

### Derivation Rule Acyclicity

<!-- elysium-audit B: the former pair here (irreflexive + asymmetric)
     forbade self- and mutual recursion, which Lem 1 licenses, and
     disagreed with core.md's (also wrong) irreflexive + intransitive.
     The faithful constraint — no VALUE-INTRODUCING rule on a dependency
     cycle — lives in core.md beside the `reaches` closure and the
     `introduces values` fact type. One home, per the one-gate lesson. -->

### Derivation Rule Range Restriction

It is obligatory that each variable in a Derivation Rule consequent appears in at least one antecedent of that Derivation Rule.

## Constraint Violation Templates (#898)

Violation Template is a value type.

Constraint Type has Violation Template.
  Each Constraint Type has at most one Violation Template.

### Placeholders

<!--
Each template carries one or more `{name}` substitution markers. The
per-kind resolver in `compile.rs` maps each name to a `Vec<Func>`
that runtime-evaluates to the atoms inserted at that position:

- `{value}` — the offending role value (single-role kinds: IR, AC,
  RF), via `role_value(0)` or the role index of the constrained
  span's single role.
- `{x}`, `{y}`, `{z}` — role values for binary / ternary ring chains
  (AS, SY, AT, IT, TR). `{x}` is role 0 of the first fact, `{y}` is
  role 1 (and the second-fact role 0 for chains), `{z}` is role 1
  of the second fact.
- `{noun}` — the constrained noun's declared name, as a string atom.
- `{reading}` — the constrained fact type's reading string.
- `{range}` — the frequency constraint's `exactly N` / `between M
  and N` / `at least N` phrase. Resolver builds the phrase from the
  constraint's `min_occurrence` / `max_occurrence` at compile time.
- `{valid_set}` — value-constraint's allowed-value set, joined as
  `{A, B, C}` (curly braces in the substituted atom, not in the
  template).
- `{entity}`, `{requirement}`, `{clause_count}` — set-comparison
  values: the entity noun being scoped over, the kind's English
  requirement (`exactly one` / `at most one` / `at least one`), and
  the clause-fact-type count.
- `{a_ft}`, `{b_ft}` — subset / equality fact-type IDs (left and
  right side of the directional subset check).
- `{pairs}` — subset / equality multi-segment placeholder: expands
  to one `<noun, value>` pair per common-noun join column.
-->

### Templates

Constraint Type 'IR' has Violation Template 'Irreflexive violation: {value} references itself'.
Constraint Type 'AS' has Violation Template 'Asymmetric violation: {x} relates to {y} and vice versa'.
Constraint Type 'SY' has Violation Template 'Symmetric violation: {x} relates to {y} but not the reverse'.
Constraint Type 'AT' has Violation Template 'Antisymmetric violation: {x} and {y} relate to each other but are not the same'.
Constraint Type 'IT' has Violation Template 'Intransitive violation: {x} relates to {y} relates to {z} but shortcut also exists'.
Constraint Type 'TR' has Violation Template 'Transitive violation: {x} relates to {y} relates to {z} but shortcut is missing'.
Constraint Type 'AC' has Violation Template 'Acyclic violation: cycle detected through {value}'.
Constraint Type 'RF' has Violation Template 'Reflexive violation: {value} does not reference itself'.
Constraint Type 'UC' has Violation Template 'Uniqueness violation: {object_type} {value} is not unique in {reading}'.
Constraint Type 'MC' has Violation Template 'Mandatory violation: {object_type} {value} does not participate in {reading}'.
Constraint Type 'FC' has Violation Template 'Frequency violation: {object_type} {value} in {reading} expected {range}'.
Constraint Type 'VC' has Violation Template 'Value constraint violation: {object_type} {value} is not in {valid_set}'.
Constraint Type 'CC' has Violation Template 'Cardinality violation: population of {object_type} expected {range}'.
Constraint Type 'XO' has Violation Template 'Set-comparison violation: {entity} {value} expected {requirement} of {clause_count} clause fact types'.
Constraint Type 'XC' has Violation Template 'Set-comparison violation: {entity} {value} expected {requirement} of {clause_count} clause fact types'.
Constraint Type 'OR' has Violation Template 'Set-comparison violation: {entity} {value} expected {requirement} of {clause_count} clause fact types'.
Constraint Type 'SS' has Violation Template 'Subset violation: {pairs} participates in {a_ft} but not in {b_ft}'.
Constraint Type 'EQ' has Violation Template 'Equality violation: {pairs} in {a_ft} but not in {b_ft}'.

### Deontic-path templates

Constraint Type 'DF_pop' has Violation Template 'Forbidden fact present in {primary_ft}'.
Constraint Type 'DF_cwa' has Violation Template 'Response contains forbidden {object_type} {value}'.
Constraint Type 'DF_owa' has Violation Template 'Response may violate: {text}'.
Constraint Type 'DO_pop' has Violation Template 'Obligation violated in {primary_ft}'.
Constraint Type 'DO_obl' has Violation Template 'Response missing obligatory {object_type}'.
Constraint Type 'DO_sender' has Violation Template 'Response missing obligatory SenderIdentity'.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'validation' has Access 'public'. -->
Domain 'validation' has Description 'Deontic constraints encoding ORM 2 / FORML 2 modeling discipline at the framework level. Meta-constraints about how domain models should be structured. Every domain inherits them.'.
