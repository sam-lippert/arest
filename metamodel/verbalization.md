# Verbalization

<!-- The patterns an author writes FORML 2 in, as facts, so the served surface
     can teach them (Sam, 2026-09-16: the MCP must "provide help and tutoring
     (prompts) for verbalization patterns in FORML2"). The forms are Halpin's
     (ORM 2 Technical Report 2, sections 2 and 3; AREST.tex Definition 4, the
     admitted fragment); every example is a sentence this metamodel already
     speaks. A, B, C stand for object types, R and S for predicates, N for a
     name. The tutor verb reads these rows and nothing else. -->

## Domain Metadata

<!-- This file's part of the domain: The forms an author writes FORML 2 in (Halpin ORM 2 Technical Report 2, sections 2-3): Verbalization Pattern, Pattern Family, Pattern Form, Pattern Example -- read by the tutor verb, nothing else.
     The sentence below is metamodel/core.md:2320 repeated verbatim.
     core.md:220 makes Description functional, so a domain carries ONE
     text and an identical sentence is the identical fact. -->
Domain 'core' has Description 'Extracted from NORMA ORM2 model (design/html/). The canonical FORML 2 metamodel against which every user domain is a subtype binding.'.

Verbalization Pattern(.name) is an entity type.
Verbalization Pattern is a subtype of Function.

Pattern Family is a value type.
  The possible values of Pattern Family are 'declaration', 'fact type', 'uniqueness', 'mandatory', 'ring', 'set comparison', 'value', 'subtyping', 'objectification', 'derivation', 'deontic', 'state machine', 'population'.
  The data type of Pattern Family is text.
Pattern Form is a value type.
  The data type of Pattern Form is text.
Pattern Example is a value type.
  The data type of Pattern Example is text.
Pattern Note is a value type.
  The data type of Pattern Note is text.

Verbalization Pattern is in Pattern Family.
  Each Verbalization Pattern is in exactly one Pattern Family.
Verbalization Pattern has Pattern Form.
  Each Verbalization Pattern has exactly one Pattern Form.
Verbalization Pattern has Pattern Example.
  Each Verbalization Pattern has at most one Pattern Example.
Verbalization Pattern has Pattern Note.
  Each Verbalization Pattern has at most one Pattern Note.

## Declarations

Verbalization Pattern 'entity-type' is in Pattern Family 'declaration'.
Verbalization Pattern 'entity-type' has Pattern Form 'A(.ref) is an entity type.'.
Verbalization Pattern 'entity-type' has Pattern Example 'Order(.OrderId) is an entity type.'.
Verbalization Pattern 'entity-type' has Pattern Note 'the reference mode in parentheses is how an instance is identified; .id makes the identifier auto-generated'.

Verbalization Pattern 'value-type' is in Pattern Family 'declaration'.
Verbalization Pattern 'value-type' has Pattern Form 'A is a value type.'.
Verbalization Pattern 'value-type' has Pattern Example 'Message Role is a value type.'.
Verbalization Pattern 'value-type' has Pattern Note 'a value type identifies itself; declare its data type on the next line as The data type of A is text, and its admitted values as The possible values of A are ..., each value in single quotes'.

## Fact types

Verbalization Pattern 'fact-type-unary' is in Pattern Family 'fact type'.
Verbalization Pattern 'fact-type-unary' has Pattern Form 'A R.'.
Verbalization Pattern 'fact-type-unary' has Pattern Example 'Predicate is bound.'.
Verbalization Pattern 'fact-type-unary' has Pattern Note 'one object type and a predicate; the fact holds of an instance or does not'.

Verbalization Pattern 'fact-type-binary' is in Pattern Family 'fact type'.
Verbalization Pattern 'fact-type-binary' has Pattern Form 'A R B.'.
Verbalization Pattern 'fact-type-binary' has Pattern Example 'Object Type is of Object Kind.'.
Verbalization Pattern 'fact-type-binary' has Pattern Note 'an elementary fact type: the object types are declared names, the predicate is the words between them; with no uniqueness sentence beneath it the fact type is many-to-many'.

Verbalization Pattern 'fact-type-ternary' is in Pattern Family 'fact type'.
Verbalization Pattern 'fact-type-ternary' has Pattern Form 'A R B S C.'.
Verbalization Pattern 'fact-type-ternary' has Pattern Example 'Function sends Fact Type with Role to JSON Path.'.
Verbalization Pattern 'fact-type-ternary' has Pattern Note 'three or more roles; the predicate words fall between and after the players, and the uniqueness sentence beneath names the roles that identify a fact'.

## Uniqueness

Verbalization Pattern 'uniqueness-at-most-one' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-at-most-one' has Pattern Form 'Each A R at most one B.'.
Verbalization Pattern 'uniqueness-at-most-one' has Pattern Example 'Each Object Type is of at most one schema:Thing.'.
Verbalization Pattern 'uniqueness-at-most-one' has Pattern Note 'a uniqueness on the first role, written indented under the fact type it constrains: an A relates to at most one B'.

Verbalization Pattern 'uniqueness-exactly-one' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Form 'Each A R exactly one B.'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Example 'Each Object Type is of exactly one Object Kind.'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Note 'uniqueness and mandatory in one sentence: every A relates to one B and only one'.

Verbalization Pattern 'uniqueness-external' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-external' has Pattern Form 'For each B and C, at most one A R that B and S that C.'.
Verbalization Pattern 'uniqueness-external' has Pattern Example 'For each Domain and Local Name, at most one Function belongs to that Domain and has that Local Name.'.
Verbalization Pattern 'uniqueness-external' has Pattern Note 'an external uniqueness over roles of two fact types: the combination of a B and a C identifies at most one A'.

## Mandatory

Verbalization Pattern 'mandatory-simple' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-simple' has Pattern Form 'Each A R some B.'.
Verbalization Pattern 'mandatory-simple' has Pattern Example 'Each Order is placed by some Customer.'.
Verbalization Pattern 'mandatory-simple' has Pattern Note 'a mandatory role: every A relates to at least one B; combine with uniqueness as exactly one'.

Verbalization Pattern 'mandatory-disjunctive' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Form 'For each A, some B R that A or some C S that A.'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Example 'For each Status, some Transition is from that Status or some Transition is to that Status.'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Note 'an inclusive-or mandatory over roles of two fact types: every A plays at least one of them'.

## Ring

Verbalization Pattern 'ring-irreflexive' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-irreflexive' has Pattern Form 'No A R itself.'.
Verbalization Pattern 'ring-irreflexive' has Pattern Example 'No Domain reaches itself.'.
Verbalization Pattern 'ring-irreflexive' has Pattern Note 'a ring constraint on a fact type whose two roles are played by one object type; the other kinds are written by name'.

Verbalization Pattern 'ring-kind' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-kind' has Pattern Form 'A R A is acyclic.'.
Verbalization Pattern 'ring-kind' has Pattern Example 'Memory supersedes Memory is acyclic.'.
Verbalization Pattern 'ring-kind' has Pattern Note 'the fact type in its own words, then is and the kind: acyclic, asymmetric, antisymmetric, symmetric, transitive, intransitive or irreflexive'.

## Set comparison

Verbalization Pattern 'subset' is in Pattern Family 'set comparison'.
Verbalization Pattern 'subset' has Pattern Form 'If A R B then A S B.'.
Verbalization Pattern 'subset' has Pattern Example 'If Object Type1 is subtype of Object Type2, then Object Type2 is not subtype of Object Type1.'.
Verbalization Pattern 'subset' has Pattern Note 'a subset constraint: every A that R a B also S that B; subscripts 1 and 2 tell two instances of one type apart, and a negated consequent states an exclusion'.

Verbalization Pattern 'exclusion-of-subtypes' is in Pattern Family 'set comparison'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Form 'For each A, at most one of the following holds: that A is a B; that A is a C.'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Example 'For each Function, at most one of the following holds: that Function is an Event Type; that Function is a Constraint; that Function is a Derivation Rule.'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Note 'exactly one of the following holds makes the subtypes a partition of A'.

## Values

Verbalization Pattern 'value-constraint' is in Pattern Family 'value'.
Verbalization Pattern 'value-constraint' has Pattern Form 'The possible values of A are v1, v2.'.
Verbalization Pattern 'value-constraint' has Pattern Note 'each value is written in single quotes, indented under the value type it constrains; the data type is declared beside it as The data type of A is text'.

## Subtyping and objectification

Verbalization Pattern 'subtyping' is in Pattern Family 'subtyping'.
Verbalization Pattern 'subtyping' has Pattern Form 'A is a subtype of B.'.
Verbalization Pattern 'subtyping' has Pattern Example 'Entity Type is a subtype of Object Type.'.
Verbalization Pattern 'subtyping' has Pattern Note 'A inherits the identification of B; a subtype declared with its own reference mode identifies itself'.

Verbalization Pattern 'objectification' is in Pattern Family 'objectification'.
Verbalization Pattern 'objectification' has Pattern Form 'N objectifies "A R B".'.
Verbalization Pattern 'objectification' has Pattern Example 'ObjectTypeHasPermission objectifies "Object Type has Permission".'.
Verbalization Pattern 'objectification' has Pattern Note 'the fact type becomes an object type N that plays roles of its own; the reading is quoted in double quotes'.

## Derivation

Verbalization Pattern 'derivation-fully' is in Pattern Family 'derivation'.
Verbalization Pattern 'derivation-fully' has Pattern Form '* A R B iff A S C and C T B.'.
Verbalization Pattern 'derivation-fully' has Pattern Example '* Domain1 reaches Domain2 iff Domain1 is contained in Domain2.'.
Verbalization Pattern 'derivation-fully' has Pattern Note 'the leading asterisk marks the fact type fully derived; the body joins fact types on shared object types; two asterisks store the derived rows'.

Verbalization Pattern 'derivation-semi' is in Pattern Family 'derivation'.
Verbalization Pattern 'derivation-semi' has Pattern Form '+ A R B iff A S B.'.
Verbalization Pattern 'derivation-semi' has Pattern Note 'a plus marks a semi-derived fact type, derived where the rule applies and assertable directly elsewhere; two pluses store it'.

## Deontic

Verbalization Pattern 'deontic-obligation' is in Pattern Family 'deontic'.
Verbalization Pattern 'deontic-obligation' has Pattern Form 'It is obligatory that each A R some B.'.
Verbalization Pattern 'deontic-obligation' has Pattern Example 'It is obligatory that each Function belongs to some Domain.'.
Verbalization Pattern 'deontic-obligation' has Pattern Note 'a deontic constraint warns and commits where an alethic one rejects; It is forbidden that and It is permitted that are the other modalities, and the body is any constraint sentence'.

## State machines

Verbalization Pattern 'state-machine' is in Pattern Family 'state machine'.
Verbalization Pattern 'state-machine' has Pattern Form 'Transition t is triggered by Fact Type f.'.
Verbalization Pattern 'state-machine' has Pattern Note 'a machine is five kinds of population sentence over the names in single quotes: State Machine Definition m is for Noun a; Status s is initial in State Machine Definition m; Transition t is from Status s; Transition t is to Status s2; Transition t is triggered by Fact Type f'.

## Populations

Verbalization Pattern 'population' is in Pattern Family 'population'.
Verbalization Pattern 'population' has Pattern Form 'A x R B y.'.
Verbalization Pattern 'population' has Pattern Note 'an instance fact names the object types with their values in single quotes after each; it must match a declared fact type reading word for word'.
