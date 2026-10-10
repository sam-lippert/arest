# AREST Validation: ORM2 Modeling Rules

## Deontic Constraints

### Object Type Declaration

<!-- retired (no-guessing ruling): "each Role references
     exactly one Object Type" named no declared predicate (the fit-scorer
     bound it to plays by synonym) and its content is already held
     ALETHICALLY at core.md's Role declaration: "For each Role, exactly
     one Object Type plays that Role." An alethic constraint subsumes its
     deontic restatement.
It is obligatory that each Role references exactly one Object Type. -->

### Arity Decomposition

<!-- Decided by a function, not by the sentence "It
     is forbidden that a Constraint of Constraint Type 'UC' spans fewer Roles
     than the arity of its Fact Type minus one", which builds no constraint;
     the compile does not make the check either: csdp:s7 makes it only over the
     law report's fixed example. decide:n_minus_one in lambda answers each
     fact type that holds such a uniqueness. -->
Constraint 'uniqueness-spans-n-minus-one' has Text 'It is forbidden that a uniqueness constraint spans fewer roles than the arity of its fact type minus one'.
Constraint 'uniqueness-spans-n-minus-one' has modality of Modality Type 'Deontic'.
Constraint 'uniqueness-spans-n-minus-one' is of Constraint Type 'DF_pop'.
Constraint 'uniqueness-spans-n-minus-one' spans Role 'FactTypeHasRole.1'.
Constraint 'uniqueness-spans-n-minus-one' is decided by Predicate 'decide:n_minus_one'.
Predicate 'decide:n_minus_one' has Module Path 'arest'.
Predicate 'decide:n_minus_one' has Symbol Name 'decide:n_minus_one'.

### Objectification Spanning

<!-- Decided by a function, not by the sentence "It
     is forbidden that a Fact Type is objectified when no Constraint of
     Constraint Type 'UC' spans all Roles of that Fact Type", which builds no
     constraint, and the compile in lambda does not make the check the note
     below gives the oracle: without the decider, `Birth objectifies "Person
     was born in Country"` over an n:1 binary compiles clean.
     decide:objectified_spanning in lambda answers each such fact type. -->
Constraint 'objectification-needs-spanning-uniqueness' has Text 'It is forbidden that a fact type is objectified when no uniqueness constraint spans all roles of that fact type'.
Constraint 'objectification-needs-spanning-uniqueness' has modality of Modality Type 'Deontic'.
Constraint 'objectification-needs-spanning-uniqueness' is of Constraint Type 'DF_pop'.
Constraint 'objectification-needs-spanning-uniqueness' spans Role 'FactTypeHasRole.1'.
Constraint 'objectification-needs-spanning-uniqueness' is decided by Predicate 'decide:objectified_spanning'.
Predicate 'decide:objectified_spanning' has Module Path 'arest'.
Predicate 'decide:objectified_spanning' has Symbol Name 'decide:objectified_spanning'.
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
     First enforcement: the former Object Type Instance Role objectification
     (instances.md) was retired under this rule. -->



### Ring Constraint Completeness

<!-- Decided by a function, not by the sentence "It
     is obligatory that when an asserted Fact Type has exactly two Roles that
     both reference the same Object Type, some Constraint of Constraint Type
     'IR', 'AS', 'AT', 'SY', 'IT', 'TR', or 'AC' spans those Roles", which builds
     no constraint. decide:ring_complete in lambda answers each such fact
     type that has no ring, leaving out a fully derived one (the note below),
     and decide:rc_perm applies both conditions of the permission that
     follows. core.md holds no duplicate of this rule; this is its one
     home. -->
Constraint 'same-type-binary-has-ring' has Text 'It is obligatory that when an asserted fact type has exactly two roles that both reference the same object type, some ring constraint spans those roles, unless the reading of that fact type contains a capitalized-word-prefixed form of the name of that object type, or some object type has a name ending in that name'.
Constraint 'same-type-binary-has-ring' has modality of Modality Type 'Deontic'.
Constraint 'same-type-binary-has-ring' is of Constraint Type 'DO_pop'.
Constraint 'same-type-binary-has-ring' spans Role 'FactTypeHasRole.1'.
Constraint 'same-type-binary-has-ring' is decided by Predicate 'decide:ring_complete'.
Predicate 'decide:ring_complete' has Module Path 'arest'.
Predicate 'decide:ring_complete' has Symbol Name 'decide:ring_complete'.
  <!-- ring adjudication (derived): scoped to ASSERTED fact
       types. The obligation operationalizes Halpin's ring question, whose
       point is restricting INPUT; on a fully derived fact type the
       population is a theorem of its rules (Codd 1970 1.5), so the ring
       answer is carried by the derivation — depends-on is the witness:
       every listed ring type is falsified by a population the doctrine
       licenses (self-recursion kills IR/AS/AC, mutual recursion kills
       AS/AT/SY, diamond dependencies kill IT, and TR is false because
       depends-on is deliberately the closure's base). A truthful ring on
       a derived fact type (TR on reaches) may still be declared as
       documentation. -->

<!-- The exception is the rule's own, in an
     explicit verbalization that does not need to map `It is permitted that`,
     not "It is permitted that a Fact Type has no Constraint of Constraint
     Type 'IR', 'AS', 'AT', 'SY', 'IT', 'TR', or 'AC' spanning its Roles when
     the Reading of that Fact Type contains a capitalized-word-prefixed form of
     the Name of the Object Type that its Roles reference, or when some Object
     Type has Name ending in that Name." A permission is not how anything is
     allowed here: access is granted by permission facts (security.md), and an
     exception to a rule is part of that rule. Its two conditions are in
     the Text of 'same-type-binary-has-ring' above, and decide:rc_perm
     applies both. -->

<!-- The rule does not say "its Ring Object Type". That is not a
     type — it is prose shorthand for "the Object Type both ring Roles
     reference", exactly as :40 above spells it, and the audit note below
     already called the two conditions parse-time artifacts. So the fix is to
     say it in declared vocabulary, NOT to declare a type that does not exist:
     inventing `Ring Object Type` to satisfy the resolver would have put a
     fiction in the model to silence a report. BOTH conditions are preserved
     verbatim in force — the note below makes this sentence the source of truth
     for the suppression patterns, and dropping either re-enables 9 false
     positives on the eu-law corpus. -->
<!-- arest-audit H (prose split, per the vindicated 10.2 scrub): the two
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

### Value Comparison Type Compatibility

<!-- Decided by a function, not by the sentence "It
     is obligatory that each Constraint of Constraint Type 'VC' spans Roles
     that are played by Object Types of the same Conceptual Data Type", which
     builds no constraint. decide:vc_types in lambda answers each VC
     constraint whose players do not share one Conceptual Data Type. No store
     holds a VC constraint row yet: a value comparison reaches a store as the
     comparison inside a derivation body. So this decides nothing until one is
     materialized, and the note below still describes the open question. -->
Constraint 'value-comparison-same-data-type' has Text 'It is obligatory that each value comparison constraint spans roles that are played by object types of the same conceptual data type'.
Constraint 'value-comparison-same-data-type' has modality of Modality Type 'Deontic'.
Constraint 'value-comparison-same-data-type' is of Constraint Type 'DO_pop'.
Constraint 'value-comparison-same-data-type' spans Role 'ConstraintSpan.1'.
Constraint 'value-comparison-same-data-type' is decided by Predicate 'decide:vc_types'.
Predicate 'decide:vc_types' has Module Path 'arest'.
Predicate 'decide:vc_types' has Symbol Name 'decide:vc_types'.

<!-- Recorded because the implementations disagree exactly where
     this model was silent, which is the signature of a missing fact rather
     than a bug. `⟦lt⟧(Int, Str)` — comparing a number against a string atom —
     has THREE live readings across the fleet:
         engine/csharp, engine/java, engine/rust   coerce, answer T
         engine/python                             refuses, answers ⊥
         tools/java-runner (cmpAtoms)              throws
     Each is a defensible reading of an unstated rule, and each host filled
     the silence on its own.

     The asymmetry that names the gap: RING constraints carry an explicit
     compatibility obligation ("both Roles are played by the same Object
     Type", Layer 2 above) while Value Comparison carried none, though
     `Constraint Type 'VC' has Name 'ValueComparison'` has been declared all
     along. Halpin's requirement — a value comparison holds between roles of
     compatible type — was assumed by every implementer and written down by
     none.

     WHY DEONTIC RATHER THAN ALETHIC. The legs do not all exist yet: nothing
     yet relates a VC Constraint's spanned Roles to the Conceptual Data Types
     of their players, so an alethic reading would block a commit on a
     structure the schema cannot yet express. Deontic records the obligation
     without demanding its referents up front — a todo with teeth, surfacing
     as a Violation through the Def 6 / Thm 1 path until satisfied, exactly
     as the deontics-are-violable ruling intends.

     WHAT IT DOES NOT DECIDE. It says comparison is well formed only within a
     Conceptual Data Type; it does not choose T, ⊥ or throw for the ill-formed
     case. That answer follows once the obligation is enforceable, and it must
     be one answer across all seven hosts. Until then the ⟦lt⟧(Int,Str) split
     stands as a known outstanding item, not a silent divergence.

     Derived, and NOT covered by this: ⟦cmp⟧(Str, Str) is ORDINAL. system:max2's
     sole caller is system:mint_next, which composes "+" after the fold, and +
     demands numbers on every station — so max2's operands are numeric on the
     only reachable path, and value-typed role fillers are already coerced at
     the reading boundary ('40' as Budget Hours becomes 40; '42' as a Task id
     stays a string). The boundary decides the type; the base must not decide
     again. -->

### Singular Naming

Constraint 'singular-naming' has Text 'It is forbidden that an object type has a name that ends in the letter s when that name is a plural form'.
Constraint 'singular-naming' has modality of Modality Type 'Deontic'.
Constraint 'singular-naming' is of Constraint Type 'DF_owa'.
Constraint 'singular-naming' spans Role 'FunctionHasName.1'.
<!-- audit-fix C: one home. core.md's cruder syntactic 'ies' rule is
     retired into this one — the plural-form qualifier is what keeps
     Series and Species legal. -->

### Alethic Before Deontic

Constraint 'alethic-before-deontic' has Text 'It is forbidden that a constraint has deontic modality when that constraint could be enforced with alethic modality'.
Constraint 'alethic-before-deontic' has modality of Modality Type 'Deontic'.
Constraint 'alethic-before-deontic' is of Constraint Type 'DF_owa'.
Constraint 'alethic-before-deontic' spans Role 'ConstraintHasModalityOfModalityType.1'.

### Derivation Over Storage

Constraint 'derivation-over-storage' has Text 'It is forbidden that a role stores a value that is derivable from existing fact instances and constraint spans'.
Constraint 'derivation-over-storage' has modality of Modality Type 'Deontic'.
Constraint 'derivation-over-storage' is of Constraint Type 'DF_owa'.
Constraint 'derivation-over-storage' spans Role 'FactTypeHasRole.2'.

### Subtype Constraint Declaration

<!-- This section does not assert

       "It is obligatory that each subtype Object Type has some totality or
        exclusion Constraint declared for its supertype relationship."

     That sentence is FALSE, and it is retired rather than narrowed. Its source
     is "Subtyping Revisited" Sec 3, which says of the asserted Patient
     subtypes: "the exclusive-or constraint INDICATING THAT PATIENT IS
     PARTITIONED INTO THESE TWO SUBTYPES must be explicitly declared, since it
     is not derivable."
     The requirement is CONDITIONAL ON THE PARTITION HOLDING. It says: what you
     cannot derive, you must declare. It does not say every subtype stands in
     an exclusion or totality constraint — and the same paper's Fig. 5(a) shows
     Grandparent+ as the ONLY subtype of Person with neither constraint.

     Our own metamodel falsifies it four times over. An exclusion constraint
     needs at least two arguments, and a totality constraint over a single
     subtype asserts subtype = supertype. So every supertype with exactly ONE
     subtype makes the obligation unsatisfiable except by asserting something
     false, and there are four:
         Fact Type              is a subtype of Event Type   (core.md:47)
         HTTP Method            is a subtype of Predicate    (core.md:81)
         Fact                   is a subtype of Event        (instances.md:31)
         State Machine Definition is a subtype of Status     (state.md:14)
     Not every Event Type is a Fact Type, not every Predicate is an HTTP
     Method, not every Event is a Fact, not every Status is a State Machine
     Definition — so the missing constraints are missing correctly.

     Nor is it narrowed to "each ASSERTED subtype". THAT AXIS IS
     WRONG: all four counterexamples are asserted, so the narrowing leaves
     every one of them standing. The trigger is whether a partition holds, not
     how the subtype is populated.

     AND THAT ANTECEDENT IS NOT IN THE MODEL. "An exclusion that holds but is
     undeclared" is precisely what an undeclared constraint makes invisible, so
     the paper's rule cannot be written as an obligation over the population at
     all. It is an instruction to the MODELLER, not a constraint on models, and
     stating it as an obligation converted advice into a false universal — the
     same class as deontic sentences that name no type and markers
     with no deliverer, except that this one is not merely unenforced but
     wrong. Kept here as prose so it is not re-derived and re-added.

     The rule that IS checkable, and that the metamodel now satisfies, is its
     contrapositive: an exclusion or totality Constraint over DERIVED subtypes
     adds nothing, because their definitions already entail it (Halpin,
     Information Modeling and Relational Databases, p.381). Such a Constraint
     is redundant rather than erroneous — ORM 2 permits declaring it so long as
     it is marked derived — so this is recorded as guidance, not an obligation.

     (This paragraph sat OUTSIDE the comment, so the harness read it as three
     sentences and could parse none of them: guidance is not a verbalization,
     and every line that is not a comment here is a sentence the model must be
     able to state. The stray "**" in the unrecognized list was this text too —
     the italic markers around the book title, which the marker regex reads as
     a derivation marker. Folded in, with the title left unemphasised.) -->

### Reference Mode Redundancy

<!-- Decided by a function, not by the sentence "It
     is forbidden that a Reading restates the Reference Mode of an Object Type
     as a separate Fact Type", which builds no constraint.
     decide:refmode_restated in lambda answers each declared binary, under
     another name than the reference fact type, over the same two players
     with a uniqueness on the value's role. -->
Constraint 'reference-mode-not-restated' has Text 'It is forbidden that a reading restates the reference mode of an object type as a separate fact type'.
Constraint 'reference-mode-not-restated' has modality of Modality Type 'Deontic'.
Constraint 'reference-mode-not-restated' is of Constraint Type 'DF_pop'.
Constraint 'reference-mode-not-restated' spans Role 'FactTypeHasRole.1'.
Constraint 'reference-mode-not-restated' is decided by Predicate 'decide:refmode_restated'.
Predicate 'decide:refmode_restated' has Module Path 'arest'.
Predicate 'decide:refmode_restated' has Symbol Name 'decide:refmode_restated'.
<!-- arest-batch ruling 4: un-commented and reworded to canonical
     vocabulary. NORMA models the machinery as ReferenceMode +
     ReferenceModeKind (General/Popular/UnitBased; ORM2Core.xsd): the mode
     mints the value type and the identifying fact type, so restating it
     as an explicit reading duplicates the model. First enforcement:
     instances.md's `Object Type Instance has Reference` retired. -->

### Elementary Fact Decomposition

Constraint 'elementary-fact-decomposition' has Text 'It is forbidden that a reading conjoins two independent assertions with the word and when they can be expressed as separate readings'.
Constraint 'elementary-fact-decomposition' has modality of Modality Type 'Deontic'.
Constraint 'elementary-fact-decomposition' is of Constraint Type 'DF_owa'.
Constraint 'elementary-fact-decomposition' spans Role 'ReadingHasText.1'.

### Constraint Invertibility

Constraint 'constraint-invertibility' has Text 'It is forbidden that the verbalization of a constraint states its restriction in only one of positive form and negative form'.
Constraint 'constraint-invertibility' has modality of Modality Type 'Deontic'.
Constraint 'constraint-invertibility' is of Constraint Type 'DF_owa'.
Constraint 'constraint-invertibility' spans Role 'ConstraintHasText.1'.
<!-- All constraint verbalizations should be
     invertible. This is NORMA's own POSITIVE/NEGATIVE FORM pairing
     (Halpin & Curland, Automated Verbalization for ORM 2, 2): every
     constraint verbalizes both ways - positive shows how to SATISFY it,
     negative how to VIOLATE it - and the pair is generated from one
     constraint element, so for a mapped constraint invertibility holds BY
     CONSTRUCTION. Note the axis: positive/negative is FORM; alethic/
     deontic is MODALITY. This rule is about form.
     It bites exactly where NORMA's mechanism does not reach - deontic
     bodies here are classified as prose, never mapped to constraint
     elements, so nothing generates their negative form and nothing checks
     it. Hence a reading rather than a habit.
     The case that produced it: the self-modification gate was first
     written `It is forbidden that a Domain Change ... is applied without
     approval by exactly one Human`, whose positive form is NOT the same
     claim - under the negation the cardinality falls inside the negated
     scope, so the prohibition ALSO reads as forbidding a SECOND approver.
     The general trap is A QUANTIFIER UNDER A NEGATION ('without exactly
     one', 'without some', 'unless every'). State the cardinality
     positively and negate nothing but the verb.
     A compound cardinality is still invertible: `exactly one` is NORMA's
     positive verbalization of a mandatory + uniqueness PAIR, and its
     negative form is correspondingly two sentences ("... is approved by
     no Human" / "... by more than one Human"), which is why it does not
     violate Elementary Fact Decomposition above. -->        

### Derivation Rule Acyclicity

<!-- arest-audit B: the former pair here (irreflexive + asymmetric)
     forbade self- and mutual recursion, which Lem 1 licenses, and
     disagreed with core.md's (also wrong) irreflexive + intransitive.
     The faithful constraint — no VALUE-INTRODUCING rule on a dependency
     cycle — lives in core.md beside the `reaches` closure and the
     `introduces values` fact type. One home, per the one-gate lesson. -->

### Derivation Rule Range Restriction

<!-- There is no deontic "It is obligatory that each
     variable in a Derivation Rule consequent appears in at least one
     antecedent of that Derivation Rule": the compiler already reports it.
     A rule whose derived fact type names a role no antecedent binds gets no recipe, so the
     compile reports its derived fact type UNDELIVERED ("no form says this condition") and
     AREST_STRICT=1 refuses it. Measured with
     `* Person likes Country iff Person speaks Language.`: undelivered. The
     same rule with the derived fact type `Person knows Language` builds. -->

## Constraint Violation Templates (#898)

Violation Template is a value type.
  The data type of Violation Template is text.

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
Constraint Type 'VC' has Violation Template 'Value comparison violation: {object_type} {value} is not {operator} {other_value}'.
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
