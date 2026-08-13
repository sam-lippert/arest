# FORML 2 Grammar

Classification grammar + recognizer derivation rules for FORML 2.
The parser is not a program. It is this file.

Stage-1 (#285) tokenizes input into `Statement` cells with structured
fields; Stage-2 (#280) applies the derivation rules below to populate
downstream metamodel cells (`Object Type`, `Fact Type`, `Role`,
`Instance Fact`, `Derivation Rule`, `Constraint`).

This file uses only Stage-1 bootstrap productions: entity types, value
types, enum values, binary / unary fact types, derivation rules.

## Entity Types

Statement(.id) is an entity type.

Role Reference(.id) is an entity type.

Classification(.name) is an entity type.

Translator(.name) is an entity type.

## Value Types

Text is a value type.
Head Object Type is a value type.
Predicate is a value type.
Trailing Marker is a value type.
  The possible values of Trailing Marker are 'is an entity type', 'is a value type', 'is abstract', 'is acyclic', 'is asymmetric', 'is antisymmetric', 'is intransitive', 'is irreflexive', 'is reflexive', 'is symmetric', 'is transitive', 'are mutually exclusive', 'is partitioned into', 'is a subtype of'.
Quantifier is a value type.
  The possible values of Quantifier are 'each', 'at most one', 'at least one', 'exactly one', 'some', 'no', 'at most', 'at least'.
Prose Stopword is a value type.
  The possible values of Prose Stopword are 'If', 'When', 'Then', 'That', 'This', 'An', 'A', 'The', 'Each', 'Some', 'No', 'Every'.
Constraint Span Prefix is a value type.
  The possible values of Constraint Span Prefix are 'It is obligatory that ', 'It is forbidden that ', 'It is permitted that ', 'Each ', 'each ', 'at most one ', 'exactly one ', 'at least one ', 'some ', 'No ', 'no '.
Deontic Predicate Operator is a value type.
  The possible values of Deontic Predicate Operator are ' ends with', ' does not end with', ' starts with', ' does not start with'.
Deontic Predicate Operator Kind is a value type.
  The possible values of Deontic Predicate Operator Kind are 'ends_with', 'starts_with'.
Deontic Predicate Operator Negated is a value type.
  The possible values of Deontic Predicate Operator Negated are 'false', 'true'.
Non Canonical Negation Hint is a value type.
  The possible values of Non Canonical Negation Hint are ' does not ', ' do not ', ' did not ', ' cannot ', ' can not ', ' must not ', ' will not ', ' would not ', ' never ', ' no longer '.
Derivation Marker is a value type.
  The possible values of Derivation Marker are 'derived-and-stored', 'fully-derived', 'semi-derived'.
Derivation Marker Symbol is a value type.
  The possible values of Derivation Marker Symbol are '**', '*', '+'.
Role Position is a value type.
Literal Value is a value type.
Keyword is a value type.
  The possible values of Keyword are 'iff', 'if'.
Deontic Operator is a value type.
  The possible values of Deontic Operator are 'obligatory', 'forbidden', 'permitted'.
Literal Role is a value type.
Enum Value is a value type.
Constraint Keyword is a value type.
  The possible values of Constraint Keyword are 'if and only if', 'at most one of the following holds', 'exactly one of the following holds', 'at least one of the following holds', 'if some then that', 'combination occurs at most once'.
Ring Adjective is a value type.
  The possible values of Ring Adjective are 'irreflexive', 'asymmetric', 'antisymmetric', 'symmetric', 'intransitive', 'transitive', 'acyclic', 'reflexive'.
Word Comparator is a value type.
  The possible values of Word Comparator are 'exceeds', 'is greater than', 'is less than', 'is at least', 'is at most', 'is more than', 'equals', 'is equal to'.
Range Operator is a value type.
  The possible values of Range Operator are 'within', 'before', 'after'.
Superlative Comparator is a value type.
  The possible values of Superlative Comparator are 'highest', 'lowest'.
Superlative Comparator Aggregate Op is a value type.
  The possible values of Superlative Comparator Aggregate Op are 'min', 'max'.
Quote Escape is a value type.
  The possible values of Quote Escape are 'doubled-quote'.
Universal Quantifier Keyword is a value type.
  The possible values of Universal Quantifier Keyword are 'for each ', 'given any ', 'every ', 'each '.
Extraction Clause Keyword is a value type.
  The possible values of Extraction Clause Keyword are ' is extracted from ', ' is derived from '.
Object Type Has Object Type Literal Keyword is a value type.
  The possible values of Object Type Has Object Type Literal Keyword are ' has '.
Entity Ref Scheme Literal Keyword is a value type.
  The possible values of Entity Ref Scheme Literal Keyword are ' is not', ' is'.
Temporal Predicate Keyword is a value type.
  The possible values of Temporal Predicate Keyword are 'now is ', ' in the past', ' in the future', 'is current', 'is expired', 'is fresh', 'is stale'.
Bare Value Comparison Keyword is a value type.
  The possible values of Bare Value Comparison Keyword are ' or more', ' or less', ' or greater', ' or fewer'.
Possessive Marker is a value type.
  The possible values of Possessive Marker are 'apostrophe-s'.
Subtype Instance Check Keyword is a value type.
  The possible values of Subtype Instance Check Keyword are ' is a ', ' is an '.
Existential Quantifier Keyword is a value type.
  The possible values of Existential Quantifier Keyword are ' some ', ' that '.
Anaphora Pronoun is a value type.
  The possible values of Anaphora Pronoun are ' that '.
Ring Constraint Trailing Marker is a value type.
  The possible values of Ring Constraint Trailing Marker are 'is irreflexive', 'is asymmetric', 'is antisymmetric', 'is symmetric', 'is intransitive', 'is transitive', 'is acyclic', 'is reflexive'.
Ring Constraint Kind Code is a value type.
  The possible values of Ring Constraint Kind Code are 'IR', 'AS', 'AT', 'SY', 'IT', 'TR', 'AC', 'RF'.
Conditional Ring Pattern is a value type.
  The possible values of Conditional Ring Pattern are 'and+impossible+isnot-ante', 'and+impossible', 'and', 'impossible', 'isnot-conse', 'itself-conse', 'plain'.
Conditional Ring Kind Code is a value type.
  The possible values of Conditional Ring Kind Code are 'AT', 'IT', 'TR', 'AS', 'RF', 'SY'.
Deontic Constraint Kind Code is a value type.
  The possible values of Deontic Constraint Kind Code are 'UC'.
Deontic Constraint Modality is a value type.
  The possible values of Deontic Constraint Modality are 'deontic'.
Cardinality Constraint Kind is a value type.
  The possible values of Cardinality Constraint Kind are 'Frequency Constraint', 'Uniqueness Constraint', 'Mandatory Role Constraint'.
Cardinality Constraint Kind Code is a value type.
  The possible values of Cardinality Constraint Kind Code are 'FC', 'UC', 'MC'.
Set Constraint Kind is a value type.
  The possible values of Set Constraint Kind are 'Equality Constraint', 'Subset Constraint', 'Exclusive-Or Constraint', 'Or Constraint', 'Exclusion Constraint'.
Set Constraint Kind Code is a value type.
  The possible values of Set Constraint Kind Code are 'EQ', 'SS', 'XO', 'OR', 'XC'.
Set Constraint Arbitration Rule is a value type.
  The possible values of Set Constraint Arbitration Rule are 'derivation_rule_wins', 'subset_wins'.
Object Type Source Kind is a value type.
  The possible values of Object Type Source Kind are 'Abstract Declaration', 'Partition Declaration', 'Entity Type Declaration', 'Value Type Declaration', 'Subtype Declaration'.
Object Kind is a value type.
  The possible values of Object Kind are 'entity', 'value'.

## Fact Types

Statement has Text.
Statement has Head Object Type.
Statement has Predicate.
Statement has Trailing Marker.
Statement has Quantifier.
Statement has Derivation Marker.
Statement has Literal Role.
Statement has Keyword.
Statement has Deontic Operator.
Statement has Enum Value.
Statement has Constraint Keyword.
Statement has Classification.

Classification has Translator.

Statement has Role Reference.
Role Reference has Head Object Type.
Role Reference has Literal Value.
Role Reference has Role Position.

## Statement Translator Dispatch (#833)

Per AREST.tex §3 (eq:sys) — *the entity handles the dispatch, not the
system function.* New translators are registered into DEFS without
modifying any entity. The Rust pipeline consults this table to
discover which translators apply to a given Statement Classification.
The relation is many-to-many: e.g., Subtype Declaration is handled by
both `translate_nouns` and `translate_subtypes`, and
`translate_set_constraints` handles five constraint kinds.

The Entity Type and Fact Type for this dispatch are declared in the
top-level `## Entity Types` and `## Fact Types` sections so the
bootstrap grammar parser picks them up. The Instance Facts populating
the table follow.

### Instance Facts

Classification 'Entity Type Declaration' has Translator 'translate_nouns'.
Classification 'Value Type Declaration' has Translator 'translate_nouns'.
Classification 'Subtype Declaration' has Translator 'translate_nouns'.
Classification 'Subtype Declaration' has Translator 'translate_subtypes'.
Classification 'Abstract Declaration' has Translator 'translate_nouns'.
Classification 'Partition Declaration' has Translator 'translate_nouns'.
Classification 'Partition Declaration' has Translator 'translate_partitions'.
Classification 'Enum Values Declaration' has Translator 'translate_enum_values'.
Classification 'Data Type Declaration' has Translator 'translate_data_types'.
Classification 'Instance Fact' has Translator 'translate_instance_facts'.
Classification 'Fact Type Reading' has Translator 'translate_fact_types'.
Classification 'Fact Type Reading' has Translator 'translate_derivation_mode_facts'.
Classification 'Derivation Rule' has Translator 'translate_derivation_rules'.
Classification 'Uniqueness Constraint' has Translator 'translate_cardinality_constraints'.
Classification 'Mandatory Role Constraint' has Translator 'translate_cardinality_constraints'.
Classification 'Frequency Constraint' has Translator 'translate_cardinality_constraints'.
Classification 'Ring Constraint' has Translator 'translate_ring_constraints'.
Classification 'Subset Constraint' has Translator 'translate_set_constraints'.
Classification 'Equality Constraint' has Translator 'translate_set_constraints'.
Classification 'Exclusion Constraint' has Translator 'translate_set_constraints'.
Classification 'Exclusive-Or Constraint' has Translator 'translate_set_constraints'.
Classification 'Or Constraint' has Translator 'translate_set_constraints'.
Classification 'Value Constraint' has Translator 'translate_value_constraints'.
Classification 'Deontic Constraint' has Translator 'translate_deontic_constraints'.

## Instance Facts — the classification vocabulary

Classification 'Entity Type Declaration' is a Classification.
Classification 'Value Type Declaration' is a Classification.
Classification 'Subtype Declaration' is a Classification.
Classification 'Partition Declaration' is a Classification.
Classification 'Abstract Declaration' is a Classification.
Classification 'Enum Values Declaration' is a Classification.
Classification 'Data Type Declaration' is a Classification.
Classification 'Fact Type Reading' is a Classification.
Classification 'Unary Fact Type Reading' is a Classification.
Classification 'Derivation Rule' is a Classification.
Classification 'Instance Fact' is a Classification.
Classification 'Uniqueness Constraint' is a Classification.
Classification 'Mandatory Role Constraint' is a Classification.
Classification 'Frequency Constraint' is a Classification.
Classification 'Value Constraint' is a Classification.
Classification 'Subset Constraint' is a Classification.
Classification 'Equality Constraint' is a Classification.
Classification 'Exclusion Constraint' is a Classification.
Classification 'Exclusive-Or Constraint' is a Classification.
Classification 'Or Constraint' is a Classification.
Classification 'Ring Constraint' is a Classification.
Classification 'Deontic Constraint' is a Classification.

## Derivation Rules — the recognizers

*Statement has Classification 'Entity Type Declaration' if and only if Statement has Trailing Marker 'is an entity type'.

*Statement has Classification 'Value Type Declaration' if and only if Statement has Trailing Marker 'is a value type'.

*Statement has Classification 'Subtype Declaration' if and only if Statement has Predicate 'is a subtype of'.

*Statement has Classification 'Partition Declaration' if and only if Statement has Predicate 'is partitioned into'.

*Statement has Classification 'Abstract Declaration' if and only if Statement has Trailing Marker 'is abstract'.

<!-- task-951: two surface forms lower to the same Predicate token, so a single
     recognizer covers both. Stage-1's extract_enum_values accepts either:

       1. "The possible values of <Object Type> are 'v1', 'v2', ..."  (FORML2 spec)
       2. "<Object Type> enumerates 'v1', 'v2', ..."                  (shorthand alias)

     Form (2) is mechanical sugar — stage-1 strips the Object Type and the literal
     'enumerates' keyword, then routes the remaining 'v1', 'v2', ... list to
     the same Enum_Value tokenizer, and overrides Predicate to 'the possible
     values of' so this classifier fires identically. There is no separate
     classifier rule for the shorthand. -->
*Statement has Classification 'Enum Values Declaration' if and only if Statement has Predicate 'the possible values of'.

<!-- #279 P1: `The data type of <ValueType> is <code>.` assigns a portable
     Conceptual Data Type to a value type. Stage-1 recognises the leading
     phrase and overrides Predicate to 'the data type of' (mirroring the enum
     declaration's Predicate override), so this single recognizer fires. -->
*Statement has Classification 'Data Type Declaration' if and only if Statement has Predicate 'the data type of'.

*Statement has Classification 'Derivation Rule' if and only if Statement has Keyword 'if and only if'.
*Statement has Classification 'Derivation Rule' if and only if Statement has Keyword 'if'.

*Statement has Classification 'Fact Type Reading' if and only if Statement has Role Reference.

*Statement has Classification 'Instance Fact' if and only if Statement has Literal Role.

*Statement has Classification 'Uniqueness Constraint' if and only if Statement has Quantifier 'at most one'.

*Statement has Classification 'Uniqueness Constraint' if and only if Statement has Quantifier 'exactly one'.

*Statement has Classification 'Uniqueness Constraint' if and only if Statement has Constraint Keyword 'combination occurs at most once'.

*Statement has Classification 'Mandatory Role Constraint' if and only if Statement has Quantifier 'at least one'.

*Statement has Classification 'Mandatory Role Constraint' if and only if Statement has Quantifier 'some'.

*Statement has Classification 'Frequency Constraint' if and only if Statement has Quantifier 'at most' and Statement has Quantifier 'at least'.

*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is irreflexive'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is asymmetric'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is antisymmetric'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is symmetric'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is intransitive'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is transitive'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is acyclic'.
*Statement has Classification 'Ring Constraint' if and only if Statement has Trailing Marker 'is reflexive'.

*Statement has Classification 'Exclusion Constraint' if and only if Statement has Trailing Marker 'are mutually exclusive'.
*Statement has Classification 'Exclusion Constraint' if and only if Statement has Constraint Keyword 'at most one of the following holds'.

*Statement has Classification 'Exclusive-Or Constraint' if and only if Statement has Constraint Keyword 'exactly one of the following holds'.

*Statement has Classification 'Or Constraint' if and only if Statement has Constraint Keyword 'at least one of the following holds'.

*Statement has Classification 'Equality Constraint' if and only if Statement has Constraint Keyword 'if and only if'.

*Statement has Classification 'Subset Constraint' if and only if Statement has Constraint Keyword 'if some then that'.

*Statement has Classification 'Value Constraint' if and only if Statement has Classification 'Enum Values Declaration'.

*Statement has Classification 'Deontic Constraint' if and only if Statement has Deontic Operator 'obligatory'.
*Statement has Classification 'Deontic Constraint' if and only if Statement has Deontic Operator 'forbidden'.
*Statement has Classification 'Deontic Constraint' if and only if Statement has Deontic Operator 'permitted'.

## Classification Tables (2026-08-02)
<!-- These eight tables were encoded as parallel value-type columns
     joined by position. That is a mapping stored in a set declaration,
     which is why five of them showed repeated values: a set has no
     duplicates, so the repeats were the model reporting its own error.
     Each is now a fact type with one instance fact per row, and each
     value type above declares only its distinct values. Nothing
     consumed the columns (zero references in compiler.py, the Rust
     sources, or the canon), so the restructuring is behaviour-neutral. -->

### Derivation Marker
Derivation Marker has Symbol.
  Each Derivation Marker has exactly one Symbol.

Derivation Marker 'derived-and-stored' has Symbol '**'.
Derivation Marker 'fully-derived' has Symbol '*'.
Derivation Marker 'semi-derived' has Symbol '+'.

### Deontic Predicate Operator
Deontic Predicate Operator has Kind.
  Each Deontic Predicate Operator has exactly one Kind.
Deontic Predicate Operator has Negated.
  Each Deontic Predicate Operator has exactly one Negated.

Deontic Predicate Operator ' ends with' has Kind 'ends_with'.
Deontic Predicate Operator ' ends with' has Negated 'false'.
Deontic Predicate Operator ' does not end with' has Kind 'ends_with'.
Deontic Predicate Operator ' does not end with' has Negated 'true'.
Deontic Predicate Operator ' starts with' has Kind 'starts_with'.
Deontic Predicate Operator ' starts with' has Negated 'false'.
Deontic Predicate Operator ' does not start with' has Kind 'starts_with'.
Deontic Predicate Operator ' does not start with' has Negated 'true'.

### Conditional Ring Pattern
Conditional Ring Pattern has Conditional Ring Kind Code.
  Each Conditional Ring Pattern has exactly one Conditional Ring Kind Code.

Conditional Ring Pattern 'and+impossible+isnot-ante' has Conditional Ring Kind Code 'AT'.
Conditional Ring Pattern 'and+impossible' has Conditional Ring Kind Code 'IT'.
Conditional Ring Pattern 'and' has Conditional Ring Kind Code 'TR'.
Conditional Ring Pattern 'impossible' has Conditional Ring Kind Code 'AS'.
Conditional Ring Pattern 'isnot-conse' has Conditional Ring Kind Code 'AS'.
Conditional Ring Pattern 'itself-conse' has Conditional Ring Kind Code 'RF'.
Conditional Ring Pattern 'plain' has Conditional Ring Kind Code 'SY'.

### Deontic Operator
Deontic Operator has Deontic Constraint Kind Code.
  Each Deontic Operator has exactly one Deontic Constraint Kind Code.
Deontic Operator has Deontic Constraint Modality.
  Each Deontic Operator has exactly one Deontic Constraint Modality.

Deontic Operator 'obligatory' has Deontic Constraint Kind Code 'UC'.
Deontic Operator 'obligatory' has Deontic Constraint Modality 'deontic'.
Deontic Operator 'forbidden' has Deontic Constraint Kind Code 'UC'.
Deontic Operator 'forbidden' has Deontic Constraint Modality 'deontic'.
Deontic Operator 'permitted' has Deontic Constraint Kind Code 'UC'.
Deontic Operator 'permitted' has Deontic Constraint Modality 'deontic'.

### Cardinality Constraint Kind
Cardinality Constraint Kind has Code.
  Each Cardinality Constraint Kind has exactly one Code.

Cardinality Constraint Kind 'Frequency Constraint' has Code 'FC'.
Cardinality Constraint Kind 'Uniqueness Constraint' has Code 'UC'.
Cardinality Constraint Kind 'Mandatory Role Constraint' has Code 'MC'.

### Set Constraint Kind
Set Constraint Kind has Code.
  Each Set Constraint Kind has exactly one Code.
Set Constraint Kind has Set Constraint Arbitration Rule.
  Each Set Constraint Kind has exactly one Set Constraint Arbitration Rule.

Set Constraint Kind 'Equality Constraint' has Code 'EQ'.
Set Constraint Kind 'Equality Constraint' has Set Constraint Arbitration Rule 'derivation_rule_wins'.
Set Constraint Kind 'Subset Constraint' has Code 'SS'.
Set Constraint Kind 'Subset Constraint' has Set Constraint Arbitration Rule 'subset_wins'.
Set Constraint Kind 'Exclusive-Or Constraint' has Code 'XO'.
Set Constraint Kind 'Exclusive-Or Constraint' has Set Constraint Arbitration Rule 'derivation_rule_wins'.
Set Constraint Kind 'Or Constraint' has Code 'OR'.
Set Constraint Kind 'Or Constraint' has Set Constraint Arbitration Rule 'derivation_rule_wins'.
Set Constraint Kind 'Exclusion Constraint' has Code 'XC'.
Set Constraint Kind 'Exclusion Constraint' has Set Constraint Arbitration Rule 'derivation_rule_wins'.

### Ring Constraint Trailing Marker
Ring Constraint Trailing Marker has Ring Constraint Kind Code.
  Each Ring Constraint Trailing Marker has exactly one Ring Constraint Kind Code.

Ring Constraint Trailing Marker 'is irreflexive' has Ring Constraint Kind Code 'IR'.
Ring Constraint Trailing Marker 'is asymmetric' has Ring Constraint Kind Code 'AS'.
Ring Constraint Trailing Marker 'is antisymmetric' has Ring Constraint Kind Code 'AT'.
Ring Constraint Trailing Marker 'is symmetric' has Ring Constraint Kind Code 'SY'.
Ring Constraint Trailing Marker 'is intransitive' has Ring Constraint Kind Code 'IT'.
Ring Constraint Trailing Marker 'is transitive' has Ring Constraint Kind Code 'TR'.
Ring Constraint Trailing Marker 'is acyclic' has Ring Constraint Kind Code 'AC'.
Ring Constraint Trailing Marker 'is reflexive' has Ring Constraint Kind Code 'RF'.

### Object Type Source Kind
Object Type Source Kind has Object Kind.
  Each Object Type Source Kind has exactly one Object Kind.

Object Type Source Kind 'Abstract Declaration' has Object Kind 'entity'.
Object Type Source Kind 'Partition Declaration' has Object Kind 'entity'.
Object Type Source Kind 'Entity Type Declaration' has Object Kind 'entity'.
Object Type Source Kind 'Value Type Declaration' has Object Kind 'value'.
Object Type Source Kind 'Subtype Declaration' has Object Kind 'entity'.

### Abstract supertypes
<!-- Split out of the Object Kind column: 'abstract' was a third
     value there, but abstractness is an Rmap absorption outcome, not
     a kind (see metamodel/core.md). These two source kinds declare a
     supertype that does not absorb its subtypes. -->
Object Type Source Kind yields an abstract Object Type.

Object Type Source Kind 'Abstract Declaration' yields an abstract Object Type.
Object Type Source Kind 'Partition Declaration' yields an abstract Object Type.

## Ported recognizer families (2026-08-03)

<!-- Six Classifications existed only in engine/shared/forml2-grammar.md and are
     ported here, because this file is the lineage with legible intent: 44
     commits in this repository between 2026-04-19 and 06-21 (the ORM2 Gap 2
     quantifier widening, the NORMA conceptual-data-type catalog, removing the
     ungrounded `when` connective, disciplining the superlative vocabulary),
     against three commits on the shared copy of which the first is the subtree
     import `Add 'engine/' from commit 397768f`.

     One of the six is load-bearing for work already in the corpus:
     'Objectification' recognises `This association with ...`, which is the form
     metamodel/core.md uses for Constraint Span and API and that the three view
     readings use for their ViewElement objectifications. Without this
     recognizer none of those classify. The seven State Machine Reading
     recognizers cover the whole SM declaration surface the paper's worked
     example depends on.

     `iff` is rewritten to `if and only if` and the recognizers take `*`, per
     this file's own conventions. -->

### Field value types

Disjunction is a value type.
  The possible values of Disjunction are 'or'.
Objectification Prefix is a value type.
  The possible values of Objectification Prefix are 'This association with'.

### Statement fields

Statement has Prose Punctuation.
Statement has Disjunction.
Statement has Objectification Prefix.

### Recognizers

*Statement has Classification 'Prose' if and only if Statement has Prose Punctuation.
*Statement has Classification 'Disjunctive Mandatory Constraint' if and only if Statement has Quantifier 'each' and Statement has Disjunction 'or'.
*Statement has Classification 'Objectification' if and only if Statement has Objectification Prefix 'This association with'.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is for Object Type' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is initial in State Machine Definition' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is from Status' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is to Status' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is triggered by Fact Type' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'is guarded by Fact Type' and Statement has Literal Role.
*Statement has Classification 'State Machine Reading' if and only if Statement has Predicate 'emits' and Statement has Literal Role.
*Statement has Classification 'Finality Declaration' if and only if Statement has Predicate 'becomes final at depth'.
*Statement has Classification 'Negation Reading' if and only if Statement has Predicate 'does not'.
*Statement has Classification 'Negation Reading' if and only if Statement has Predicate 'is not'.

## Grammar merge completion (2026-08-03)

<!-- The remainder of engine/shared/forml2-grammar.md that this lineage lacked.
     Excluded deliberately: the parallel-column enums (Deontic Predicate
     Operator Kind/Negated, Conditional Ring Kind Code, Deontic Constraint
     Kind Code/Modality, Set Constraint Arbitration Rule), which this file
     already carries restructured as fact types under "Classification Tables";
     and `Object Kind Source Kind`, which is not a real declaration but damage
     from running the vocabulary map over the shared copy earlier today.

     The earlier port brought recognizers without their Classification
     registrations or Translator bindings, so those six families would have
     classified into a dispatch table with no entry. Both halves are here. -->

### Field value types
Consequence is a value type.
The possible values of Consequence are 'then'.
Relative Pronoun is a value type.
The possible values of Relative Pronoun are 'who'.
Data Type Prefix is a value type.
The possible values of Data Type Prefix are 'Data Type:'.

### Statement fields
Statement has Consequence.
Statement has Extraction Clause Keyword.
Statement has Relative Pronoun.
Statement has Data Type Prefix.

### Classification registrations and translators
Classification 'Disjunctive Mandatory Constraint' has Translator 'translate_cardinality_constraints'.
Classification 'Objectification' has Translator 'translate_objectifications'.
Classification 'Disjunctive Mandatory Constraint' is a Classification.
Classification 'Objectification' is a Classification.
Classification 'State Machine Reading' is a Classification.
Classification 'Finality Declaration' is a Classification.
Classification 'Negation Reading' is a Classification.
Classification 'State Machine Reading' has Translator 'translate_state_machines'.
Classification 'Finality Declaration' has Translator 'translate_finality'.
Classification 'Negation Reading' has Translator 'translate_negation'.

### Recognizers

*Statement has Classification 'Uniqueness Constraint' if and only if Statement has Quantifier 'more than one'.
*Statement has Classification 'Subset Constraint' if and only if Statement has Keyword 'if' and Statement has Consequence 'then'.
*Statement has Classification 'Subset Constraint' if and only if Statement has Keyword 'if'.
*Statement has Classification 'Derivation Rule' if and only if Statement has Extraction Clause Keyword 'is derived from'.
*Statement has Classification 'Derivation Rule' if and only if Statement has Extraction Clause Keyword 'is extracted from'.
*Statement has Classification 'Derivation Rule' if and only if Statement has Quantifier 'each' and Statement has Relative Pronoun 'who'.
*Statement has Classification 'Data Type Declaration' if and only if Statement has Data Type Prefix 'Data Type:'.
*Statement has Classification 'Frequency Constraint' if and only if Statement has Quantifier 'each' and Statement has Quantifier 'at most'.
*Statement has Classification 'Frequency Constraint' if and only if Statement has Quantifier 'each' and Statement has Quantifier 'at least'.
*Statement has Classification 'Subtype Declaration' if and only if Statement has Predicate 'are mutually exclusive subtypes of'.
