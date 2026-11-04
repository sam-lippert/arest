# Verbalization

<!-- The patterns FORML 2 is written and read in, as facts. Two readers use
     them. The tutor verb teaches them: each pattern's family, form, example
     and note. The verbalizer, lambda's `verbalize`, emits a compiled
     constraint's sentence from them (AREST.tex prop:spec: nf = verbalize .
     compile . parse, and verbalize emits a compiled object's primary
     reading). The verbalizer is built after Halpin and Curland, "Automated
     Verbalization for ORM 2", and its specification, ORM 2 Technical Report
     2: snippets with numbered replacement fields, looked up by name,
     modality and sign; patterns chosen by the constraint's type, the shape of
     its constrained roles and the readings available; field replacement
     over the constraint's facts. The forms are Halpin's (Technical Report 2,
     sections 2 and 3; AREST.tex Definition 4, the admitted fragment); every
     example is a sentence this metamodel already speaks. A, B, C stand for
     object types, R and S for predicates, N for a name. -->

## Domain Metadata

<!-- This file's part of the domain: the forms FORML 2 is written and read in
     (Halpin, ORM 2 Technical Report 2, sections 2-3): Verbalization Pattern,
     its family, form, example and note, which the tutor verb reads, and the
     snippets and pattern attributes the verbalizer reads.
     The sentence below repeats core.md's Domain Description verbatim.
     core.md makes Description functional, so a domain carries one text and
     an identical sentence is the identical fact. -->
Domain 'core' has Description 'Extracted from NORMA ORM2 model (design/html/). The canonical FORML 2 metamodel against which every user domain is a subtype binding.'.

Verbalization Pattern is an entity type.
Verbalization Pattern is a subtype of Object Type Instance.

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

### Snippets

<!-- A snippet is a text particle with numbered replacement fields, {0},
     {1} and on (the paper's field replacement, after .NET's
     String.Format): `each {0}`, `for each {0}, {1}`. NORMA retrieves a
     snippet by name, modality and sign, so that the alethic and deontic
     modalities and the positive and negative forms of one pattern differ in
     their snippets alone ("Retrieving a snippet by {name, modality, sign}
     instead of just {name} takes care of the largest variability"). Here
     that retrieval is one fact type, its text functional in the other three.
     Only a phrasing that differs is a row: a snippet stated for the Alethic
     modality and the positive sign serves a modality or sign with no row of
     its own, as the paper's common case needs nothing more to switch them.
     The list separators are snippets too, since list generation is the one
     place the paper concatenates, and it does so with user-specified
     separators. -->
Verbalization Snippet is a value type.
  The data type of Verbalization Snippet is text.
Snippet Text is a value type.
  The data type of Snippet Text is text.
Verbalization Sign is a value type.
  The possible values of Verbalization Sign are 'positive', 'negative'.
  The data type of Verbalization Sign is text.

Verbalization Snippet in Modality Type and Verbalization Sign reads Snippet Text.
  Each Verbalization Snippet, Modality Type, Verbalization Sign combination occurs at most once in the population of Verbalization Snippet in Modality Type and Verbalization Sign reads Snippet Text.

### Pattern shapes

<!-- A pattern is chosen as the paper's ConstrainedRoles and ReadingChoice
     choose one: by the constraint's type, its constraint arity (the
     constrained roles: 1, n for every role of its one fact type, n-1 for
     all but one), its fact arity (1, 2, or n for three or more), its fact
     count (1, or n for more than one fact type), the sign, and whether it
     requires a lead reading, one that opens with the constrained role and
     has no front text. A pattern states only the attributes it depends on,
     and the most specific pattern that fits is chosen. A pattern that
     distinguishes repeated players subscripts an object type that plays
     more than one role of a fact type (Technical Report 2, 1.4: Person1,
     Person2).

     A pattern is the paper's XML tree, stated as facts: the pattern starts
     with a Pattern Step, and every other step fills a field of its parent
     step at a Position. A step either uses a Verbalization Snippet, whose
     fields its child steps fill in order (Snippet), or is of a Pattern
     Construct, which reads the constraint's facts:
       Fact                the current fact type's primary reading, each
                           field replaced as the PredicateReplacement step
                           that matches its role says;
       ConverseFact        the same over a binary, its two players exchanged;
       PredicateTail       the reading less its first field, the predicate
                           after a subject already said;
       ConditionalReading  PredicateTail when the reading opens with a role
                           the constraint does not constrain, else Fact (the
                           paper's ReadingChoice);
       PredicateReplacement  the role's name wrapped in the snippet of its
                           one child step; it matches the primary role (the
                           fact type's first constrained role), the included
                           roles (the constrained ones), the excluded roles,
                           or, matching nothing, every role no other
                           replacement matches;
       IterateRoles        the constrained roles' names, each wrapped in its
                           child step, listed in its List Style;
       IterateFacts        its child step over each constrained fact type,
                           unaries last, listed in its List Style;
       RolePlayer          the name of the primary role, of the first
                           excluded role, or of the role at a Position of the
                           current fact type, wrapped in its child step;
       IndefiniteArticle   the name wrapped in its first child's snippet, or
                           in its second's when the name opens with a vowel
                           (the paper's "a" or "an");
       ConstraintText      the constraint's Text.
     A snippet step with no child steps wraps the name its parent gives it.
     A List Style separates its items with one snippet and the last item
     with another. Hyphen binding (first- Given Name) and front text are
     read off the reading itself. -->
Constraint Arity is a value type.
  The possible values of Constraint Arity are '1', 'n-1', 'n'.
  The data type of Constraint Arity is text.
Fact Arity is a value type.
  The possible values of Fact Arity are '1', '2', 'n'.
  The data type of Fact Arity is text.
Fact Count is a value type.
  The possible values of Fact Count are '1', 'n'.
  The data type of Fact Count is text.
Pattern Step is an entity type.
Pattern Step is a subtype of Object Type Instance.
Pattern Construct is a value type.
  The possible values of Pattern Construct are 'Fact', 'ConverseFact', 'PredicateTail', 'ConditionalReading', 'PredicateReplacement', 'IterateRoles', 'IterateFacts', 'RolePlayer', 'IndefiniteArticle', 'ConstraintText'.
  The data type of Pattern Construct is text.
Role Match is a value type.
  The possible values of Role Match are 'primary', 'included', 'excluded'.
  The data type of Role Match is text.
List Style is an entity type.
List Style is a subtype of Object Type Instance.
  <!-- An entity type, not a value type: a List Style has facts of its own
       (the snippets it separates and ends with), and Halpin models a thing
       with facts of its own as an entity, identified as every instance is. -->

Verbalization Pattern verbalizes Constraint Type.
  Each Verbalization Pattern verbalizes at most one Constraint Type.
Verbalization Pattern has Constraint Arity.
  Each Verbalization Pattern has at most one Constraint Arity.
Verbalization Pattern has Fact Arity.
  Each Verbalization Pattern has at most one Fact Arity.
Verbalization Pattern has Fact Count.
  Each Verbalization Pattern has at most one Fact Count.
Verbalization Pattern has Verbalization Sign.
  Each Verbalization Pattern has at most one Verbalization Sign.
Verbalization Pattern requires lead reading.
Verbalization Pattern distinguishes repeated players.
Verbalization Pattern starts with Pattern Step.
  Each Verbalization Pattern starts with at most one Pattern Step.
  For each Pattern Step, at most one Verbalization Pattern starts with that Pattern Step.
Pattern Step fills a field of Pattern Step.
  Each Pattern Step fills a field of at most one Pattern Step.
Pattern Step has Position.
  Each Pattern Step has at most one Position.
Pattern Step uses Verbalization Snippet.
  Each Pattern Step uses at most one Verbalization Snippet.
Pattern Step is of Pattern Construct.
  Each Pattern Step is of at most one Pattern Construct.
Pattern Step matches Role Match.
  Each Pattern Step matches at most one Role Match.
Pattern Step has List Style.
  Each Pattern Step has at most one List Style.
Pattern Step reads the role in Position.
  Each Pattern Step reads the role in at most one Position.
List Style separates with Verbalization Snippet.
  Each List Style separates with exactly one Verbalization Snippet.
List Style ends with Verbalization Snippet.
  Each List Style ends with exactly one Verbalization Snippet.

## Snippets

<!-- The reference snippet set, in English. A snippet's text is lower case:
     the verbalizer capitalizes the sentence and closes it with a period, as
     the paper's selection manager does. ImpliedModalNecessityOperator is the
     modal operator a positive alethic sentence leaves implied; the For-list
     forms put it after the list. The separators carry their own spaces. -->
Verbalization Snippet 'ImpliedModalNecessityOperator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0}'.
Verbalization Snippet 'ImpliedModalNecessityOperator' in Modality Type 'Deontic' and Verbalization Sign 'positive' reads Snippet Text 'it is obligatory that {0}'.
Verbalization Snippet 'ImpliedModalNecessityOperator' in Modality Type 'Alethic' and Verbalization Sign 'negative' reads Snippet Text 'it is impossible that {0}'.
Verbalization Snippet 'ImpliedModalNecessityOperator' in Modality Type 'Deontic' and Verbalization Sign 'negative' reads Snippet Text 'it is forbidden that {0}'.
Verbalization Snippet 'ModalImpossibilityOperator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'it is impossible that {0}'.
Verbalization Snippet 'ModalImpossibilityOperator' in Modality Type 'Deontic' and Verbalization Sign 'positive' reads Snippet Text 'it is forbidden that {0}'.
Verbalization Snippet 'UniversalQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'each {0}'.
Verbalization Snippet 'UniversalQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'negative' reads Snippet Text 'any {0}'.
Verbalization Snippet 'ExistentialQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'some {0}'.
Verbalization Snippet 'ExistentialQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'negative' reads Snippet Text 'no {0}'.
Verbalization Snippet 'SomeQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'some {0}'.
Verbalization Snippet 'NegativeUniversalQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'no {0}'.
Verbalization Snippet 'AtMostOneQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'at most one {0}'.
Verbalization Snippet 'AtMostOneQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'negative' reads Snippet Text 'more than one {0}'.
Verbalization Snippet 'IdentityReferenceQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'the same {0}'.
Verbalization Snippet 'DefiniteArticle' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'that {0}'.
Verbalization Snippet 'IndefiniteArticle' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'a {0}'.
Verbalization Snippet 'VowelIndefiniteArticle' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'an {0}'.
Verbalization Snippet 'ObjectTypeName' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0}'.
Verbalization Snippet 'ReflexivePronoun' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'itself'.
Verbalization Snippet 'ForEachCompactQuantifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'for each {0}, {1}'.
Verbalization Snippet 'CombinationIdentifier' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0} combination'.
Verbalization Snippet 'OccursInPopulation' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0} occurs at most once in the population of {1}'.
Verbalization Snippet 'OccursInPopulation' in Modality Type 'Alethic' and Verbalization Sign 'negative' reads Snippet Text '{0} occurs more than once in the population of {1}'.
Verbalization Snippet 'Conditional' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'if {0} then {1}'.
Verbalization Snippet 'Conjunction' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0} and {1}'.
Verbalization Snippet 'Juxtaposition' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0} {1}'.
Verbalization Snippet 'AcyclicTraversal' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'no {0} may cycle back to itself via one or more traversals through {1}'.
Verbalization Snippet 'GroupExclusion' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'for each {0}, at most one of the following holds: {1}'.
Verbalization Snippet 'GroupExclusiveOr' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text 'for each {0}, exactly one of the following holds: {1}'.
Verbalization Snippet 'SubtypeAssertion' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '{0} is {1}'.
Verbalization Snippet 'SimpleListSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text ', '.
Verbalization Snippet 'SimpleListFinalSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text ' and '.
Verbalization Snippet 'CompactListSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text ', '.
Verbalization Snippet 'AndListSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text ' and '.
Verbalization Snippet 'OrListSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text ' or '.
Verbalization Snippet 'SemicolonListSeparator' in Modality Type 'Alethic' and Verbalization Sign 'positive' reads Snippet Text '; '.

List Style 'SimpleList' separates with Verbalization Snippet 'SimpleListSeparator'.
List Style 'SimpleList' ends with Verbalization Snippet 'SimpleListFinalSeparator'.
List Style 'CompactList' separates with Verbalization Snippet 'CompactListSeparator'.
List Style 'CompactList' ends with Verbalization Snippet 'CompactListSeparator'.
List Style 'AndList' separates with Verbalization Snippet 'AndListSeparator'.
List Style 'AndList' ends with Verbalization Snippet 'AndListSeparator'.
List Style 'OrList' separates with Verbalization Snippet 'OrListSeparator'.
List Style 'OrList' ends with Verbalization Snippet 'OrListSeparator'.
List Style 'SemicolonList' separates with Verbalization Snippet 'SemicolonListSeparator'.
List Style 'SemicolonList' ends with Verbalization Snippet 'SemicolonListSeparator'.

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
Verbalization Pattern 'uniqueness-at-most-one' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-at-most-one' has Constraint Arity '1'.
Verbalization Pattern 'uniqueness-at-most-one' has Fact Arity '2'.
Verbalization Pattern 'uniqueness-at-most-one' has Fact Count '1'.
Verbalization Pattern 'uniqueness-at-most-one' has Verbalization Sign 'positive'.
Verbalization Pattern 'uniqueness-at-most-one' requires lead reading.
Verbalization Pattern 'uniqueness-at-most-one' starts with Pattern Step 'uniqueness-at-most-one.1'.
Pattern Step 'uniqueness-at-most-one.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-at-most-one.1.1' fills a field of Pattern Step 'uniqueness-at-most-one.1'.
Pattern Step 'uniqueness-at-most-one.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-at-most-one.1.1.1' fills a field of Pattern Step 'uniqueness-at-most-one.1.1'.
Pattern Step 'uniqueness-at-most-one.1.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-at-most-one.1.1.1' matches Role Match 'included'.
Pattern Step 'uniqueness-at-most-one.1.1.1.1' fills a field of Pattern Step 'uniqueness-at-most-one.1.1.1'.
Pattern Step 'uniqueness-at-most-one.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one.1.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'uniqueness-at-most-one.1.1.2' fills a field of Pattern Step 'uniqueness-at-most-one.1.1'.
Pattern Step 'uniqueness-at-most-one.1.1.2' has Position 2.
Pattern Step 'uniqueness-at-most-one.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-at-most-one.1.1.2.1' fills a field of Pattern Step 'uniqueness-at-most-one.1.1.2'.
Pattern Step 'uniqueness-at-most-one.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-at-most-one.1.1.2.1' uses Verbalization Snippet 'AtMostOneQuantifier'.

Verbalization Pattern 'uniqueness-at-most-one-negative' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Pattern Form 'It is impossible that the same A R more than one B.'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Pattern Example 'It is impossible that the same Object Type is of more than one Object Kind.'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Pattern Note 'the negative form of a uniqueness on the first role: how a population violates it'.
Verbalization Pattern 'uniqueness-at-most-one-negative' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Constraint Arity '1'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Fact Arity '2'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Fact Count '1'.
Verbalization Pattern 'uniqueness-at-most-one-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'uniqueness-at-most-one-negative' requires lead reading.
Verbalization Pattern 'uniqueness-at-most-one-negative' starts with Pattern Step 'uniqueness-at-most-one-negative.1'.
Pattern Step 'uniqueness-at-most-one-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-at-most-one-negative.1.1' fills a field of Pattern Step 'uniqueness-at-most-one-negative.1'.
Pattern Step 'uniqueness-at-most-one-negative.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one-negative.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1' fills a field of Pattern Step 'uniqueness-at-most-one-negative.1.1'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1' matches Role Match 'included'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1.1' fills a field of Pattern Step 'uniqueness-at-most-one-negative.1.1.1'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-at-most-one-negative.1.1.1.1' uses Verbalization Snippet 'IdentityReferenceQuantifier'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2' fills a field of Pattern Step 'uniqueness-at-most-one-negative.1.1'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2' has Position 2.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2.1' fills a field of Pattern Step 'uniqueness-at-most-one-negative.1.1.2'.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-at-most-one-negative.1.1.2.1' uses Verbalization Snippet 'AtMostOneQuantifier'.

Verbalization Pattern 'uniqueness-for-each' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-for-each' has Pattern Form 'For each B, at most one A R that B.'.
Verbalization Pattern 'uniqueness-for-each' has Pattern Example 'For each Role, at most one Fact Type has that Role.'.
Verbalization Pattern 'uniqueness-for-each' has Pattern Note 'a uniqueness on a role no reading opens with; its negative form is For each B, it is impossible that more than one A R that B'.
Verbalization Pattern 'uniqueness-for-each' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-for-each' has Constraint Arity 'n-1'.
Verbalization Pattern 'uniqueness-for-each' has Fact Arity '2'.
Verbalization Pattern 'uniqueness-for-each' has Fact Count '1'.
Verbalization Pattern 'uniqueness-for-each' starts with Pattern Step 'uniqueness-for-each.1'.
Pattern Step 'uniqueness-for-each.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'uniqueness-for-each.1.1' fills a field of Pattern Step 'uniqueness-for-each.1'.
Pattern Step 'uniqueness-for-each.1.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-for-each.1.1' has List Style 'SimpleList'.
Pattern Step 'uniqueness-for-each.1.1.1' fills a field of Pattern Step 'uniqueness-for-each.1.1'.
Pattern Step 'uniqueness-for-each.1.1.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-for-each.1.2' fills a field of Pattern Step 'uniqueness-for-each.1'.
Pattern Step 'uniqueness-for-each.1.2' has Position 2.
Pattern Step 'uniqueness-for-each.1.2' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-for-each.1.2.1' fills a field of Pattern Step 'uniqueness-for-each.1.2'.
Pattern Step 'uniqueness-for-each.1.2.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.2.1' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-for-each.1.2.1.1' fills a field of Pattern Step 'uniqueness-for-each.1.2.1'.
Pattern Step 'uniqueness-for-each.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-for-each.1.2.1.1' matches Role Match 'included'.
Pattern Step 'uniqueness-for-each.1.2.1.1.1' fills a field of Pattern Step 'uniqueness-for-each.1.2.1.1'.
Pattern Step 'uniqueness-for-each.1.2.1.1.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'uniqueness-for-each.1.2.1.2' fills a field of Pattern Step 'uniqueness-for-each.1.2.1'.
Pattern Step 'uniqueness-for-each.1.2.1.2' has Position 2.
Pattern Step 'uniqueness-for-each.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-for-each.1.2.1.2.1' fills a field of Pattern Step 'uniqueness-for-each.1.2.1.2'.
Pattern Step 'uniqueness-for-each.1.2.1.2.1' has Position 1.
Pattern Step 'uniqueness-for-each.1.2.1.2.1' uses Verbalization Snippet 'AtMostOneQuantifier'.

Verbalization Pattern 'uniqueness-n-minus-one' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-n-minus-one' has Pattern Form 'For each A and B, that A R that B at most one C.'.
Verbalization Pattern 'uniqueness-n-minus-one' has Pattern Note 'a uniqueness over all but one role of a fact type of three or more roles: the combination of the others identifies at most one C'.
Verbalization Pattern 'uniqueness-n-minus-one' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-n-minus-one' has Constraint Arity 'n-1'.
Verbalization Pattern 'uniqueness-n-minus-one' has Fact Arity 'n'.
Verbalization Pattern 'uniqueness-n-minus-one' has Fact Count '1'.
Verbalization Pattern 'uniqueness-n-minus-one' distinguishes repeated players.
Verbalization Pattern 'uniqueness-n-minus-one' starts with Pattern Step 'uniqueness-n-minus-one.1'.
Pattern Step 'uniqueness-n-minus-one.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'uniqueness-n-minus-one.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1'.
Pattern Step 'uniqueness-n-minus-one.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-n-minus-one.1.1' has List Style 'SimpleList'.
Pattern Step 'uniqueness-n-minus-one.1.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1.1'.
Pattern Step 'uniqueness-n-minus-one.1.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-n-minus-one.1.2' fills a field of Pattern Step 'uniqueness-n-minus-one.1'.
Pattern Step 'uniqueness-n-minus-one.1.2' has Position 2.
Pattern Step 'uniqueness-n-minus-one.1.2' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-n-minus-one.1.2.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1.2'.
Pattern Step 'uniqueness-n-minus-one.1.2.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.2.1' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1.2.1'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1' matches Role Match 'included'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1.2.1.1'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2' fills a field of Pattern Step 'uniqueness-n-minus-one.1.2.1'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2' has Position 2.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2.1' fills a field of Pattern Step 'uniqueness-n-minus-one.1.2.1.2'.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one.1.2.1.2.1' uses Verbalization Snippet 'AtMostOneQuantifier'.

Verbalization Pattern 'uniqueness-n-minus-one-negative' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' has Pattern Form 'It is impossible that the same A R the same B more than one C.'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' has Constraint Arity 'n-1'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' has Fact Arity 'n'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' has Fact Count '1'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'uniqueness-n-minus-one-negative' distinguishes repeated players.
Verbalization Pattern 'uniqueness-n-minus-one-negative' starts with Pattern Step 'uniqueness-n-minus-one-negative.1'.
Pattern Step 'uniqueness-n-minus-one-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one-negative.1'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one-negative.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one-negative.1.1'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1' matches Role Match 'included'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1.1' fills a field of Pattern Step 'uniqueness-n-minus-one-negative.1.1.1'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.1.1' uses Verbalization Snippet 'IdentityReferenceQuantifier'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2' fills a field of Pattern Step 'uniqueness-n-minus-one-negative.1.1'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2' has Position 2.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2.1' fills a field of Pattern Step 'uniqueness-n-minus-one-negative.1.1.2'.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-n-minus-one-negative.1.1.2.1' uses Verbalization Snippet 'AtMostOneQuantifier'.

Verbalization Pattern 'uniqueness-spanning' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-spanning' has Pattern Form 'Each A, B combination occurs at most once in the population of A R B.'.
Verbalization Pattern 'uniqueness-spanning' has Pattern Example 'Each Constraint, Role combination occurs at most once in the population of Constraint spans Role.'.
Verbalization Pattern 'uniqueness-spanning' has Pattern Note 'a uniqueness over every role: the population is a set, not a bag'.
Verbalization Pattern 'uniqueness-spanning' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-spanning' has Constraint Arity 'n'.
Verbalization Pattern 'uniqueness-spanning' has Fact Count '1'.
Verbalization Pattern 'uniqueness-spanning' starts with Pattern Step 'uniqueness-spanning.1'.
Pattern Step 'uniqueness-spanning.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-spanning.1.1' fills a field of Pattern Step 'uniqueness-spanning.1'.
Pattern Step 'uniqueness-spanning.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1' uses Verbalization Snippet 'OccursInPopulation'.
Pattern Step 'uniqueness-spanning.1.1.1' fills a field of Pattern Step 'uniqueness-spanning.1.1'.
Pattern Step 'uniqueness-spanning.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'uniqueness-spanning.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.1'.
Pattern Step 'uniqueness-spanning.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.1.1' uses Verbalization Snippet 'CombinationIdentifier'.
Pattern Step 'uniqueness-spanning.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.1.1'.
Pattern Step 'uniqueness-spanning.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.1.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-spanning.1.1.1.1.1' has List Style 'CompactList'.
Pattern Step 'uniqueness-spanning.1.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.1.1.1'.
Pattern Step 'uniqueness-spanning.1.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-spanning.1.1.2' fills a field of Pattern Step 'uniqueness-spanning.1.1'.
Pattern Step 'uniqueness-spanning.1.1.2' has Position 2.
Pattern Step 'uniqueness-spanning.1.1.2' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-spanning.1.1.2.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.2'.
Pattern Step 'uniqueness-spanning.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-spanning.1.1.2.1' matches Role Match 'included'.
Pattern Step 'uniqueness-spanning.1.1.2.1.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.2.1'.
Pattern Step 'uniqueness-spanning.1.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-spanning.1.1.2.2' fills a field of Pattern Step 'uniqueness-spanning.1.1.2'.
Pattern Step 'uniqueness-spanning.1.1.2.2' has Position 2.
Pattern Step 'uniqueness-spanning.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-spanning.1.1.2.2.1' fills a field of Pattern Step 'uniqueness-spanning.1.1.2.2'.
Pattern Step 'uniqueness-spanning.1.1.2.2.1' has Position 1.
Pattern Step 'uniqueness-spanning.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'uniqueness-spanning-negative' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-spanning-negative' has Pattern Form 'It is impossible that the same A, B combination occurs more than once in the population of A R B.'.
Verbalization Pattern 'uniqueness-spanning-negative' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-spanning-negative' has Constraint Arity 'n'.
Verbalization Pattern 'uniqueness-spanning-negative' has Fact Count '1'.
Verbalization Pattern 'uniqueness-spanning-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'uniqueness-spanning-negative' starts with Pattern Step 'uniqueness-spanning-negative.1'.
Pattern Step 'uniqueness-spanning-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-spanning-negative.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1'.
Pattern Step 'uniqueness-spanning-negative.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1' uses Verbalization Snippet 'OccursInPopulation'.
Pattern Step 'uniqueness-spanning-negative.1.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.1' uses Verbalization Snippet 'IdentityReferenceQuantifier'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1' uses Verbalization Snippet 'CombinationIdentifier'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.1.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1' has List Style 'CompactList'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-spanning-negative.1.1.2' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.2' has Position 2.
Pattern Step 'uniqueness-spanning-negative.1.1.2' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.2'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1' matches Role Match 'included'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.2.1'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.2'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2' has Position 2.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2.1' fills a field of Pattern Step 'uniqueness-spanning-negative.1.1.2.2'.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2.1' has Position 1.
Pattern Step 'uniqueness-spanning-negative.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'uniqueness-unary' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-unary' has Pattern Form 'Each A occurs at most once in the population of A R.'.
Verbalization Pattern 'uniqueness-unary' has Pattern Note 'the uniqueness every unary fact type has: no instance plays it twice'.
Verbalization Pattern 'uniqueness-unary' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-unary' has Constraint Arity 'n'.
Verbalization Pattern 'uniqueness-unary' has Fact Arity '1'.
Verbalization Pattern 'uniqueness-unary' has Fact Count '1'.
Verbalization Pattern 'uniqueness-unary' starts with Pattern Step 'uniqueness-unary.1'.
Pattern Step 'uniqueness-unary.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-unary.1.1' fills a field of Pattern Step 'uniqueness-unary.1'.
Pattern Step 'uniqueness-unary.1.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1' uses Verbalization Snippet 'OccursInPopulation'.
Pattern Step 'uniqueness-unary.1.1.1' fills a field of Pattern Step 'uniqueness-unary.1.1'.
Pattern Step 'uniqueness-unary.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'uniqueness-unary.1.1.1.1' fills a field of Pattern Step 'uniqueness-unary.1.1.1'.
Pattern Step 'uniqueness-unary.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-unary.1.1.1.1' has List Style 'CompactList'.
Pattern Step 'uniqueness-unary.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-unary.1.1.1.1'.
Pattern Step 'uniqueness-unary.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-unary.1.1.2' fills a field of Pattern Step 'uniqueness-unary.1.1'.
Pattern Step 'uniqueness-unary.1.1.2' has Position 2.
Pattern Step 'uniqueness-unary.1.1.2' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-unary.1.1.2.1' fills a field of Pattern Step 'uniqueness-unary.1.1.2'.
Pattern Step 'uniqueness-unary.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-unary.1.1.2.1' matches Role Match 'included'.
Pattern Step 'uniqueness-unary.1.1.2.1.1' fills a field of Pattern Step 'uniqueness-unary.1.1.2.1'.
Pattern Step 'uniqueness-unary.1.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-unary.1.1.2.2' fills a field of Pattern Step 'uniqueness-unary.1.1.2'.
Pattern Step 'uniqueness-unary.1.1.2.2' has Position 2.
Pattern Step 'uniqueness-unary.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-unary.1.1.2.2.1' fills a field of Pattern Step 'uniqueness-unary.1.1.2.2'.
Pattern Step 'uniqueness-unary.1.1.2.2.1' has Position 1.
Pattern Step 'uniqueness-unary.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'uniqueness-unary-negative' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-unary-negative' has Pattern Form 'It is impossible that the same A occurs more than once in the population of A R.'.
Verbalization Pattern 'uniqueness-unary-negative' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-unary-negative' has Constraint Arity 'n'.
Verbalization Pattern 'uniqueness-unary-negative' has Fact Arity '1'.
Verbalization Pattern 'uniqueness-unary-negative' has Fact Count '1'.
Verbalization Pattern 'uniqueness-unary-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'uniqueness-unary-negative' starts with Pattern Step 'uniqueness-unary-negative.1'.
Pattern Step 'uniqueness-unary-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-unary-negative.1.1' fills a field of Pattern Step 'uniqueness-unary-negative.1'.
Pattern Step 'uniqueness-unary-negative.1.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1' uses Verbalization Snippet 'OccursInPopulation'.
Pattern Step 'uniqueness-unary-negative.1.1.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1'.
Pattern Step 'uniqueness-unary-negative.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.1' uses Verbalization Snippet 'IdentityReferenceQuantifier'.
Pattern Step 'uniqueness-unary-negative.1.1.1.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.1'.
Pattern Step 'uniqueness-unary-negative.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-unary-negative.1.1.1.1' has List Style 'CompactList'.
Pattern Step 'uniqueness-unary-negative.1.1.1.1.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.1.1'.
Pattern Step 'uniqueness-unary-negative.1.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-unary-negative.1.1.2' fills a field of Pattern Step 'uniqueness-unary-negative.1.1'.
Pattern Step 'uniqueness-unary-negative.1.1.2' has Position 2.
Pattern Step 'uniqueness-unary-negative.1.1.2' is of Pattern Construct 'Fact'.
Pattern Step 'uniqueness-unary-negative.1.1.2.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.2'.
Pattern Step 'uniqueness-unary-negative.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-unary-negative.1.1.2.1' matches Role Match 'included'.
Pattern Step 'uniqueness-unary-negative.1.1.2.1.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.2.1'.
Pattern Step 'uniqueness-unary-negative.1.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-unary-negative.1.1.2.2' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.2'.
Pattern Step 'uniqueness-unary-negative.1.1.2.2' has Position 2.
Pattern Step 'uniqueness-unary-negative.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-unary-negative.1.1.2.2.1' fills a field of Pattern Step 'uniqueness-unary-negative.1.1.2.2'.
Pattern Step 'uniqueness-unary-negative.1.1.2.2.1' has Position 1.
Pattern Step 'uniqueness-unary-negative.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'uniqueness-exactly-one' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Form 'Each A R exactly one B.'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Example 'Each Object Type is of exactly one Object Kind.'.
Verbalization Pattern 'uniqueness-exactly-one' has Pattern Note 'uniqueness and mandatory in one sentence: every A relates to one B and only one'.

Verbalization Pattern 'uniqueness-external' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-external' has Pattern Form 'For each B and C, at most one A R that B and S that C.'.
Verbalization Pattern 'uniqueness-external' has Pattern Example 'For each Domain and Local Name, at most one Function belongs to that Domain and has that Local Name.'.
Verbalization Pattern 'uniqueness-external' has Pattern Note 'an external uniqueness over roles of two fact types: the combination of a B and a C identifies at most one A'.
Verbalization Pattern 'uniqueness-external' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-external' has Fact Count 'n'.
Verbalization Pattern 'uniqueness-external' has Verbalization Sign 'positive'.
Verbalization Pattern 'uniqueness-external' starts with Pattern Step 'uniqueness-external.1'.
Pattern Step 'uniqueness-external.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'uniqueness-external.1.1' fills a field of Pattern Step 'uniqueness-external.1'.
Pattern Step 'uniqueness-external.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.1' is of Pattern Construct 'IterateRoles'.
Pattern Step 'uniqueness-external.1.1' has List Style 'SimpleList'.
Pattern Step 'uniqueness-external.1.1.1' fills a field of Pattern Step 'uniqueness-external.1.1'.
Pattern Step 'uniqueness-external.1.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'uniqueness-external.1.2' fills a field of Pattern Step 'uniqueness-external.1'.
Pattern Step 'uniqueness-external.1.2' has Position 2.
Pattern Step 'uniqueness-external.1.2' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-external.1.2.1' fills a field of Pattern Step 'uniqueness-external.1.2'.
Pattern Step 'uniqueness-external.1.2.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1' uses Verbalization Snippet 'Juxtaposition'.
Pattern Step 'uniqueness-external.1.2.1.1' fills a field of Pattern Step 'uniqueness-external.1.2.1'.
Pattern Step 'uniqueness-external.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'uniqueness-external.1.2.1.1' matches Role Match 'excluded'.
Pattern Step 'uniqueness-external.1.2.1.1.1' fills a field of Pattern Step 'uniqueness-external.1.2.1.1'.
Pattern Step 'uniqueness-external.1.2.1.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1.1.1' uses Verbalization Snippet 'AtMostOneQuantifier'.
Pattern Step 'uniqueness-external.1.2.1.2' fills a field of Pattern Step 'uniqueness-external.1.2.1'.
Pattern Step 'uniqueness-external.1.2.1.2' has Position 2.
Pattern Step 'uniqueness-external.1.2.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'uniqueness-external.1.2.1.2' has List Style 'AndList'.
Pattern Step 'uniqueness-external.1.2.1.2.1' fills a field of Pattern Step 'uniqueness-external.1.2.1.2'.
Pattern Step 'uniqueness-external.1.2.1.2.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1.2.1' is of Pattern Construct 'ConditionalReading'.
Pattern Step 'uniqueness-external.1.2.1.2.1.1' fills a field of Pattern Step 'uniqueness-external.1.2.1.2.1'.
Pattern Step 'uniqueness-external.1.2.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-external.1.2.1.2.1.1.1' fills a field of Pattern Step 'uniqueness-external.1.2.1.2.1.1'.
Pattern Step 'uniqueness-external.1.2.1.2.1.1.1' has Position 1.
Pattern Step 'uniqueness-external.1.2.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.

Verbalization Pattern 'uniqueness-external-negative' is in Pattern Family 'uniqueness'.
Verbalization Pattern 'uniqueness-external-negative' has Pattern Form 'It is impossible that more than one A R the same B and S the same C.'.
Verbalization Pattern 'uniqueness-external-negative' verbalizes Constraint Type 'UC'.
Verbalization Pattern 'uniqueness-external-negative' has Fact Count 'n'.
Verbalization Pattern 'uniqueness-external-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'uniqueness-external-negative' starts with Pattern Step 'uniqueness-external-negative.1'.
Pattern Step 'uniqueness-external-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'uniqueness-external-negative.1.1' fills a field of Pattern Step 'uniqueness-external-negative.1'.
Pattern Step 'uniqueness-external-negative.1.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1' uses Verbalization Snippet 'Juxtaposition'.
Pattern Step 'uniqueness-external-negative.1.1.1' fills a field of Pattern Step 'uniqueness-external-negative.1.1'.
Pattern Step 'uniqueness-external-negative.1.1.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'uniqueness-external-negative.1.1.1' matches Role Match 'excluded'.
Pattern Step 'uniqueness-external-negative.1.1.1.1' fills a field of Pattern Step 'uniqueness-external-negative.1.1.1'.
Pattern Step 'uniqueness-external-negative.1.1.1.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1.1.1' uses Verbalization Snippet 'AtMostOneQuantifier'.
Pattern Step 'uniqueness-external-negative.1.1.2' fills a field of Pattern Step 'uniqueness-external-negative.1.1'.
Pattern Step 'uniqueness-external-negative.1.1.2' has Position 2.
Pattern Step 'uniqueness-external-negative.1.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'uniqueness-external-negative.1.1.2' has List Style 'AndList'.
Pattern Step 'uniqueness-external-negative.1.1.2.1' fills a field of Pattern Step 'uniqueness-external-negative.1.1.2'.
Pattern Step 'uniqueness-external-negative.1.1.2.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1.2.1' is of Pattern Construct 'ConditionalReading'.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1' fills a field of Pattern Step 'uniqueness-external-negative.1.1.2.1'.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1.1' fills a field of Pattern Step 'uniqueness-external-negative.1.1.2.1.1'.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1.1' has Position 1.
Pattern Step 'uniqueness-external-negative.1.1.2.1.1.1' uses Verbalization Snippet 'IdentityReferenceQuantifier'.

## Mandatory

Verbalization Pattern 'mandatory-simple' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-simple' has Pattern Form 'Each A R some B.'.
Verbalization Pattern 'mandatory-simple' has Pattern Example 'Each Order is placed by some Customer.'.
Verbalization Pattern 'mandatory-simple' has Pattern Note 'a mandatory role: every A relates to at least one B; combine with uniqueness as exactly one'.
Verbalization Pattern 'mandatory-simple' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-simple' has Constraint Arity '1'.
Verbalization Pattern 'mandatory-simple' has Fact Count '1'.
Verbalization Pattern 'mandatory-simple' has Verbalization Sign 'positive'.
Verbalization Pattern 'mandatory-simple' requires lead reading.
Verbalization Pattern 'mandatory-simple' starts with Pattern Step 'mandatory-simple.1'.
Pattern Step 'mandatory-simple.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-simple.1.1' fills a field of Pattern Step 'mandatory-simple.1'.
Pattern Step 'mandatory-simple.1.1' has Position 1.
Pattern Step 'mandatory-simple.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'mandatory-simple.1.1.1' fills a field of Pattern Step 'mandatory-simple.1.1'.
Pattern Step 'mandatory-simple.1.1.1' has Position 1.
Pattern Step 'mandatory-simple.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-simple.1.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-simple.1.1.1.1' fills a field of Pattern Step 'mandatory-simple.1.1.1'.
Pattern Step 'mandatory-simple.1.1.1.1' has Position 1.
Pattern Step 'mandatory-simple.1.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'mandatory-simple.1.1.2' fills a field of Pattern Step 'mandatory-simple.1.1'.
Pattern Step 'mandatory-simple.1.1.2' has Position 2.
Pattern Step 'mandatory-simple.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-simple.1.1.2.1' fills a field of Pattern Step 'mandatory-simple.1.1.2'.
Pattern Step 'mandatory-simple.1.1.2.1' has Position 1.
Pattern Step 'mandatory-simple.1.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

Verbalization Pattern 'mandatory-simple-negative' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-simple-negative' has Pattern Form 'It is impossible that any A R no B.'.
Verbalization Pattern 'mandatory-simple-negative' has Pattern Example 'It is impossible that any Object Type is of no Object Kind.'.
Verbalization Pattern 'mandatory-simple-negative' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-simple-negative' has Constraint Arity '1'.
Verbalization Pattern 'mandatory-simple-negative' has Fact Arity '2'.
Verbalization Pattern 'mandatory-simple-negative' has Fact Count '1'.
Verbalization Pattern 'mandatory-simple-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'mandatory-simple-negative' requires lead reading.
Verbalization Pattern 'mandatory-simple-negative' starts with Pattern Step 'mandatory-simple-negative.1'.
Pattern Step 'mandatory-simple-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-simple-negative.1.1' fills a field of Pattern Step 'mandatory-simple-negative.1'.
Pattern Step 'mandatory-simple-negative.1.1' has Position 1.
Pattern Step 'mandatory-simple-negative.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'mandatory-simple-negative.1.1.1' fills a field of Pattern Step 'mandatory-simple-negative.1.1'.
Pattern Step 'mandatory-simple-negative.1.1.1' has Position 1.
Pattern Step 'mandatory-simple-negative.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-simple-negative.1.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-simple-negative.1.1.1.1' fills a field of Pattern Step 'mandatory-simple-negative.1.1.1'.
Pattern Step 'mandatory-simple-negative.1.1.1.1' has Position 1.
Pattern Step 'mandatory-simple-negative.1.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'mandatory-simple-negative.1.1.2' fills a field of Pattern Step 'mandatory-simple-negative.1.1'.
Pattern Step 'mandatory-simple-negative.1.1.2' has Position 2.
Pattern Step 'mandatory-simple-negative.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-simple-negative.1.1.2.1' fills a field of Pattern Step 'mandatory-simple-negative.1.1.2'.
Pattern Step 'mandatory-simple-negative.1.1.2.1' has Position 1.
Pattern Step 'mandatory-simple-negative.1.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

Verbalization Pattern 'mandatory-for-each' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-for-each' has Pattern Form 'For each B, some A R that B.'.
Verbalization Pattern 'mandatory-for-each' has Pattern Example 'For each Reading, some Fact Type has that Reading.'.
Verbalization Pattern 'mandatory-for-each' has Pattern Note 'a mandatory on a role no reading opens with; with the deontic modality it reads For each B, it is obligatory that some A R that B'.
Verbalization Pattern 'mandatory-for-each' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-for-each' has Constraint Arity '1'.
Verbalization Pattern 'mandatory-for-each' has Fact Count '1'.
Verbalization Pattern 'mandatory-for-each' has Verbalization Sign 'positive'.
Verbalization Pattern 'mandatory-for-each' distinguishes repeated players.
Verbalization Pattern 'mandatory-for-each' starts with Pattern Step 'mandatory-for-each.1'.
Pattern Step 'mandatory-for-each.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'mandatory-for-each.1.1' fills a field of Pattern Step 'mandatory-for-each.1'.
Pattern Step 'mandatory-for-each.1.1' has Position 1.
Pattern Step 'mandatory-for-each.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'mandatory-for-each.1.1' matches Role Match 'primary'.
Pattern Step 'mandatory-for-each.1.1.1' fills a field of Pattern Step 'mandatory-for-each.1.1'.
Pattern Step 'mandatory-for-each.1.1.1' has Position 1.
Pattern Step 'mandatory-for-each.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'mandatory-for-each.1.2' fills a field of Pattern Step 'mandatory-for-each.1'.
Pattern Step 'mandatory-for-each.1.2' has Position 2.
Pattern Step 'mandatory-for-each.1.2' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-for-each.1.2.1' fills a field of Pattern Step 'mandatory-for-each.1.2'.
Pattern Step 'mandatory-for-each.1.2.1' has Position 1.
Pattern Step 'mandatory-for-each.1.2.1' is of Pattern Construct 'Fact'.
Pattern Step 'mandatory-for-each.1.2.1.1' fills a field of Pattern Step 'mandatory-for-each.1.2.1'.
Pattern Step 'mandatory-for-each.1.2.1.1' has Position 1.
Pattern Step 'mandatory-for-each.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-for-each.1.2.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-for-each.1.2.1.1.1' fills a field of Pattern Step 'mandatory-for-each.1.2.1.1'.
Pattern Step 'mandatory-for-each.1.2.1.1.1' has Position 1.
Pattern Step 'mandatory-for-each.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'mandatory-for-each.1.2.1.2' fills a field of Pattern Step 'mandatory-for-each.1.2.1'.
Pattern Step 'mandatory-for-each.1.2.1.2' has Position 2.
Pattern Step 'mandatory-for-each.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-for-each.1.2.1.2.1' fills a field of Pattern Step 'mandatory-for-each.1.2.1.2'.
Pattern Step 'mandatory-for-each.1.2.1.2.1' has Position 1.
Pattern Step 'mandatory-for-each.1.2.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

Verbalization Pattern 'mandatory-for-each-negative' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-for-each-negative' has Pattern Form 'For each B, it is impossible that no A R that B.'.
Verbalization Pattern 'mandatory-for-each-negative' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-for-each-negative' has Constraint Arity '1'.
Verbalization Pattern 'mandatory-for-each-negative' has Fact Arity '2'.
Verbalization Pattern 'mandatory-for-each-negative' has Fact Count '1'.
Verbalization Pattern 'mandatory-for-each-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'mandatory-for-each-negative' distinguishes repeated players.
Verbalization Pattern 'mandatory-for-each-negative' starts with Pattern Step 'mandatory-for-each-negative.1'.
Pattern Step 'mandatory-for-each-negative.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'mandatory-for-each-negative.1.1' fills a field of Pattern Step 'mandatory-for-each-negative.1'.
Pattern Step 'mandatory-for-each-negative.1.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'mandatory-for-each-negative.1.1' matches Role Match 'primary'.
Pattern Step 'mandatory-for-each-negative.1.1.1' fills a field of Pattern Step 'mandatory-for-each-negative.1.1'.
Pattern Step 'mandatory-for-each-negative.1.1.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'mandatory-for-each-negative.1.2' fills a field of Pattern Step 'mandatory-for-each-negative.1'.
Pattern Step 'mandatory-for-each-negative.1.2' has Position 2.
Pattern Step 'mandatory-for-each-negative.1.2' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-for-each-negative.1.2.1' fills a field of Pattern Step 'mandatory-for-each-negative.1.2'.
Pattern Step 'mandatory-for-each-negative.1.2.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.2.1' is of Pattern Construct 'Fact'.
Pattern Step 'mandatory-for-each-negative.1.2.1.1' fills a field of Pattern Step 'mandatory-for-each-negative.1.2.1'.
Pattern Step 'mandatory-for-each-negative.1.2.1.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-for-each-negative.1.2.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-for-each-negative.1.2.1.1.1' fills a field of Pattern Step 'mandatory-for-each-negative.1.2.1.1'.
Pattern Step 'mandatory-for-each-negative.1.2.1.1.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'mandatory-for-each-negative.1.2.1.2' fills a field of Pattern Step 'mandatory-for-each-negative.1.2.1'.
Pattern Step 'mandatory-for-each-negative.1.2.1.2' has Position 2.
Pattern Step 'mandatory-for-each-negative.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-for-each-negative.1.2.1.2.1' fills a field of Pattern Step 'mandatory-for-each-negative.1.2.1.2'.
Pattern Step 'mandatory-for-each-negative.1.2.1.2.1' has Position 1.
Pattern Step 'mandatory-for-each-negative.1.2.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

Verbalization Pattern 'mandatory-disjunctive' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Form 'For each A, some B R that A or some C S that A.'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Example 'For each Status, some Transition is from that Status or some Transition is to that Status.'.
Verbalization Pattern 'mandatory-disjunctive' has Pattern Note 'an inclusive-or mandatory over roles of two fact types: every A plays at least one of them'.
Verbalization Pattern 'mandatory-disjunctive' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-disjunctive' has Fact Count 'n'.
Verbalization Pattern 'mandatory-disjunctive' has Verbalization Sign 'positive'.
Verbalization Pattern 'mandatory-disjunctive' distinguishes repeated players.
Verbalization Pattern 'mandatory-disjunctive' starts with Pattern Step 'mandatory-disjunctive.1'.
Pattern Step 'mandatory-disjunctive.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-disjunctive.1.1' fills a field of Pattern Step 'mandatory-disjunctive.1'.
Pattern Step 'mandatory-disjunctive.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1' uses Verbalization Snippet 'ForEachCompactQuantifier'.
Pattern Step 'mandatory-disjunctive.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1'.
Pattern Step 'mandatory-disjunctive.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'mandatory-disjunctive.1.1.1' matches Role Match 'primary'.
Pattern Step 'mandatory-disjunctive.1.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1.1'.
Pattern Step 'mandatory-disjunctive.1.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'mandatory-disjunctive.1.1.2' fills a field of Pattern Step 'mandatory-disjunctive.1.1'.
Pattern Step 'mandatory-disjunctive.1.1.2' has Position 2.
Pattern Step 'mandatory-disjunctive.1.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'mandatory-disjunctive.1.1.2' has List Style 'OrList'.
Pattern Step 'mandatory-disjunctive.1.1.2.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1.2'.
Pattern Step 'mandatory-disjunctive.1.1.2.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.2.1' is of Pattern Construct 'Fact'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1.2.1'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1.2.1.1'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2' fills a field of Pattern Step 'mandatory-disjunctive.1.1.2.1'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2' has Position 2.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2.1' fills a field of Pattern Step 'mandatory-disjunctive.1.1.2.1.2'.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2.1' has Position 1.
Pattern Step 'mandatory-disjunctive.1.1.2.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

Verbalization Pattern 'mandatory-disjunctive-lead' is in Pattern Family 'mandatory'.
Verbalization Pattern 'mandatory-disjunctive-lead' has Pattern Form 'Each A R some B or S some C.'.
Verbalization Pattern 'mandatory-disjunctive-lead' has Pattern Note 'an inclusive-or mandatory whose every role opens a reading: the subject is said once, the binaries before the unaries'.
Verbalization Pattern 'mandatory-disjunctive-lead' verbalizes Constraint Type 'MC'.
Verbalization Pattern 'mandatory-disjunctive-lead' has Fact Count 'n'.
Verbalization Pattern 'mandatory-disjunctive-lead' has Verbalization Sign 'positive'.
Verbalization Pattern 'mandatory-disjunctive-lead' requires lead reading.
Verbalization Pattern 'mandatory-disjunctive-lead' starts with Pattern Step 'mandatory-disjunctive-lead.1'.
Pattern Step 'mandatory-disjunctive-lead.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'mandatory-disjunctive-lead.1.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1' uses Verbalization Snippet 'Juxtaposition'.
Pattern Step 'mandatory-disjunctive-lead.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'mandatory-disjunctive-lead.1.1.1' matches Role Match 'primary'.
Pattern Step 'mandatory-disjunctive-lead.1.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.1.1' uses Verbalization Snippet 'UniversalQuantifier'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2' has Position 2.
Pattern Step 'mandatory-disjunctive-lead.1.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2' has List Style 'OrList'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.2'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1' is of Pattern Construct 'PredicateTail'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.2.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1' matches Role Match 'included'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.1.1' uses Verbalization Snippet 'ExistentialQuantifier'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.2.1'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2' has Position 2.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2.1' fills a field of Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2'.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2.1' has Position 1.
Pattern Step 'mandatory-disjunctive-lead.1.1.2.1.2.1' uses Verbalization Snippet 'ExistentialQuantifier'.

## Ring

Verbalization Pattern 'ring-irreflexive' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-irreflexive' has Pattern Form 'No A R itself.'.
Verbalization Pattern 'ring-irreflexive' has Pattern Example 'No Domain reaches itself.'.
Verbalization Pattern 'ring-irreflexive' has Pattern Note 'a ring constraint on a fact type whose two roles are played by one object type; the other kinds are written by name'.
Verbalization Pattern 'ring-irreflexive' verbalizes Constraint Type 'IR'.
Verbalization Pattern 'ring-irreflexive' has Verbalization Sign 'positive'.
Verbalization Pattern 'ring-irreflexive' starts with Pattern Step 'ring-irreflexive.1'.
Pattern Step 'ring-irreflexive.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'ring-irreflexive.1.1' fills a field of Pattern Step 'ring-irreflexive.1'.
Pattern Step 'ring-irreflexive.1.1' has Position 1.
Pattern Step 'ring-irreflexive.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'ring-irreflexive.1.1.1' fills a field of Pattern Step 'ring-irreflexive.1.1'.
Pattern Step 'ring-irreflexive.1.1.1' has Position 1.
Pattern Step 'ring-irreflexive.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive.1.1.1' matches Role Match 'primary'.
Pattern Step 'ring-irreflexive.1.1.1.1' fills a field of Pattern Step 'ring-irreflexive.1.1.1'.
Pattern Step 'ring-irreflexive.1.1.1.1' has Position 1.
Pattern Step 'ring-irreflexive.1.1.1.1' uses Verbalization Snippet 'NegativeUniversalQuantifier'.
Pattern Step 'ring-irreflexive.1.1.2' fills a field of Pattern Step 'ring-irreflexive.1.1'.
Pattern Step 'ring-irreflexive.1.1.2' has Position 2.
Pattern Step 'ring-irreflexive.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive.1.1.2' matches Role Match 'included'.
Pattern Step 'ring-irreflexive.1.1.2.1' fills a field of Pattern Step 'ring-irreflexive.1.1.2'.
Pattern Step 'ring-irreflexive.1.1.2.1' has Position 1.
Pattern Step 'ring-irreflexive.1.1.2.1' uses Verbalization Snippet 'ReflexivePronoun'.
Pattern Step 'ring-irreflexive.1.1.3' fills a field of Pattern Step 'ring-irreflexive.1.1'.
Pattern Step 'ring-irreflexive.1.1.3' has Position 3.
Pattern Step 'ring-irreflexive.1.1.3' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive.1.1.3.1' fills a field of Pattern Step 'ring-irreflexive.1.1.3'.
Pattern Step 'ring-irreflexive.1.1.3.1' has Position 1.
Pattern Step 'ring-irreflexive.1.1.3.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-irreflexive-negative' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-irreflexive-negative' has Pattern Form 'It is impossible that some A R itself.'.
Verbalization Pattern 'ring-irreflexive-negative' verbalizes Constraint Type 'IR'.
Verbalization Pattern 'ring-irreflexive-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'ring-irreflexive-negative' starts with Pattern Step 'ring-irreflexive-negative.1'.
Pattern Step 'ring-irreflexive-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'ring-irreflexive-negative.1.1' fills a field of Pattern Step 'ring-irreflexive-negative.1'.
Pattern Step 'ring-irreflexive-negative.1.1' has Position 1.
Pattern Step 'ring-irreflexive-negative.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'ring-irreflexive-negative.1.1.1' fills a field of Pattern Step 'ring-irreflexive-negative.1.1'.
Pattern Step 'ring-irreflexive-negative.1.1.1' has Position 1.
Pattern Step 'ring-irreflexive-negative.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive-negative.1.1.1' matches Role Match 'primary'.
Pattern Step 'ring-irreflexive-negative.1.1.1.1' fills a field of Pattern Step 'ring-irreflexive-negative.1.1.1'.
Pattern Step 'ring-irreflexive-negative.1.1.1.1' has Position 1.
Pattern Step 'ring-irreflexive-negative.1.1.1.1' uses Verbalization Snippet 'SomeQuantifier'.
Pattern Step 'ring-irreflexive-negative.1.1.2' fills a field of Pattern Step 'ring-irreflexive-negative.1.1'.
Pattern Step 'ring-irreflexive-negative.1.1.2' has Position 2.
Pattern Step 'ring-irreflexive-negative.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive-negative.1.1.2' matches Role Match 'included'.
Pattern Step 'ring-irreflexive-negative.1.1.2.1' fills a field of Pattern Step 'ring-irreflexive-negative.1.1.2'.
Pattern Step 'ring-irreflexive-negative.1.1.2.1' has Position 1.
Pattern Step 'ring-irreflexive-negative.1.1.2.1' uses Verbalization Snippet 'ReflexivePronoun'.
Pattern Step 'ring-irreflexive-negative.1.1.3' fills a field of Pattern Step 'ring-irreflexive-negative.1.1'.
Pattern Step 'ring-irreflexive-negative.1.1.3' has Position 3.
Pattern Step 'ring-irreflexive-negative.1.1.3' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-irreflexive-negative.1.1.3.1' fills a field of Pattern Step 'ring-irreflexive-negative.1.1.3'.
Pattern Step 'ring-irreflexive-negative.1.1.3.1' has Position 1.
Pattern Step 'ring-irreflexive-negative.1.1.3.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-asymmetric' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-asymmetric' has Pattern Form 'If A1 R A2 then it is impossible that A2 R A1.'.
Verbalization Pattern 'ring-asymmetric' has Pattern Example 'If Function1 is superseded by Function2 then it is impossible that Function2 is superseded by Function1.'.
Verbalization Pattern 'ring-asymmetric' verbalizes Constraint Type 'AS'.
Verbalization Pattern 'ring-asymmetric' has Verbalization Sign 'positive'.
Verbalization Pattern 'ring-asymmetric' distinguishes repeated players.
Verbalization Pattern 'ring-asymmetric' starts with Pattern Step 'ring-asymmetric.1'.
Pattern Step 'ring-asymmetric.1' uses Verbalization Snippet 'Conditional'.
Pattern Step 'ring-asymmetric.1.1' fills a field of Pattern Step 'ring-asymmetric.1'.
Pattern Step 'ring-asymmetric.1.1' has Position 1.
Pattern Step 'ring-asymmetric.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'ring-asymmetric.1.1.1' fills a field of Pattern Step 'ring-asymmetric.1.1'.
Pattern Step 'ring-asymmetric.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric.1.1.1' matches Role Match 'included'.
Pattern Step 'ring-asymmetric.1.1.1.1' fills a field of Pattern Step 'ring-asymmetric.1.1.1'.
Pattern Step 'ring-asymmetric.1.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric.1.1.2' fills a field of Pattern Step 'ring-asymmetric.1.1'.
Pattern Step 'ring-asymmetric.1.1.2' has Position 2.
Pattern Step 'ring-asymmetric.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric.1.1.2.1' fills a field of Pattern Step 'ring-asymmetric.1.1.2'.
Pattern Step 'ring-asymmetric.1.1.2.1' has Position 1.
Pattern Step 'ring-asymmetric.1.1.2.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric.1.2' fills a field of Pattern Step 'ring-asymmetric.1'.
Pattern Step 'ring-asymmetric.1.2' has Position 2.
Pattern Step 'ring-asymmetric.1.2' uses Verbalization Snippet 'ModalImpossibilityOperator'.
Pattern Step 'ring-asymmetric.1.2.1' fills a field of Pattern Step 'ring-asymmetric.1.2'.
Pattern Step 'ring-asymmetric.1.2.1' has Position 1.
Pattern Step 'ring-asymmetric.1.2.1' is of Pattern Construct 'ConverseFact'.
Pattern Step 'ring-asymmetric.1.2.1.1' fills a field of Pattern Step 'ring-asymmetric.1.2.1'.
Pattern Step 'ring-asymmetric.1.2.1.1' has Position 1.
Pattern Step 'ring-asymmetric.1.2.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric.1.2.1.1' matches Role Match 'included'.
Pattern Step 'ring-asymmetric.1.2.1.1.1' fills a field of Pattern Step 'ring-asymmetric.1.2.1.1'.
Pattern Step 'ring-asymmetric.1.2.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric.1.2.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric.1.2.1.2' fills a field of Pattern Step 'ring-asymmetric.1.2.1'.
Pattern Step 'ring-asymmetric.1.2.1.2' has Position 2.
Pattern Step 'ring-asymmetric.1.2.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric.1.2.1.2.1' fills a field of Pattern Step 'ring-asymmetric.1.2.1.2'.
Pattern Step 'ring-asymmetric.1.2.1.2.1' has Position 1.
Pattern Step 'ring-asymmetric.1.2.1.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-asymmetric-negative' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-asymmetric-negative' has Pattern Form 'It is impossible that A1 R A2 and A2 R A1.'.
Verbalization Pattern 'ring-asymmetric-negative' verbalizes Constraint Type 'AS'.
Verbalization Pattern 'ring-asymmetric-negative' has Verbalization Sign 'negative'.
Verbalization Pattern 'ring-asymmetric-negative' distinguishes repeated players.
Verbalization Pattern 'ring-asymmetric-negative' starts with Pattern Step 'ring-asymmetric-negative.1'.
Pattern Step 'ring-asymmetric-negative.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'ring-asymmetric-negative.1.1' fills a field of Pattern Step 'ring-asymmetric-negative.1'.
Pattern Step 'ring-asymmetric-negative.1.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1' uses Verbalization Snippet 'Conjunction'.
Pattern Step 'ring-asymmetric-negative.1.1.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1'.
Pattern Step 'ring-asymmetric-negative.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'ring-asymmetric-negative.1.1.1.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.1'.
Pattern Step 'ring-asymmetric-negative.1.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric-negative.1.1.1.1' matches Role Match 'included'.
Pattern Step 'ring-asymmetric-negative.1.1.1.1.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.1.1'.
Pattern Step 'ring-asymmetric-negative.1.1.1.1.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric-negative.1.1.1.2' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.1'.
Pattern Step 'ring-asymmetric-negative.1.1.1.2' has Position 2.
Pattern Step 'ring-asymmetric-negative.1.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric-negative.1.1.1.2.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.1.2'.
Pattern Step 'ring-asymmetric-negative.1.1.1.2.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.1.2.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric-negative.1.1.2' fills a field of Pattern Step 'ring-asymmetric-negative.1.1'.
Pattern Step 'ring-asymmetric-negative.1.1.2' has Position 2.
Pattern Step 'ring-asymmetric-negative.1.1.2' is of Pattern Construct 'ConverseFact'.
Pattern Step 'ring-asymmetric-negative.1.1.2.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.2'.
Pattern Step 'ring-asymmetric-negative.1.1.2.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric-negative.1.1.2.1' matches Role Match 'included'.
Pattern Step 'ring-asymmetric-negative.1.1.2.1.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.2.1'.
Pattern Step 'ring-asymmetric-negative.1.1.2.1.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-asymmetric-negative.1.1.2.2' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.2'.
Pattern Step 'ring-asymmetric-negative.1.1.2.2' has Position 2.
Pattern Step 'ring-asymmetric-negative.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-asymmetric-negative.1.1.2.2.1' fills a field of Pattern Step 'ring-asymmetric-negative.1.1.2.2'.
Pattern Step 'ring-asymmetric-negative.1.1.2.2.1' has Position 1.
Pattern Step 'ring-asymmetric-negative.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-symmetric' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-symmetric' has Pattern Form 'If A1 R A2 then A2 R A1.'.
Verbalization Pattern 'ring-symmetric' has Pattern Example 'If Function1 is inverted by Function2 then Function2 is inverted by Function1.'.
Verbalization Pattern 'ring-symmetric' verbalizes Constraint Type 'SY'.
Verbalization Pattern 'ring-symmetric' has Verbalization Sign 'positive'.
Verbalization Pattern 'ring-symmetric' distinguishes repeated players.
Verbalization Pattern 'ring-symmetric' starts with Pattern Step 'ring-symmetric.1'.
Pattern Step 'ring-symmetric.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'ring-symmetric.1.1' fills a field of Pattern Step 'ring-symmetric.1'.
Pattern Step 'ring-symmetric.1.1' has Position 1.
Pattern Step 'ring-symmetric.1.1' uses Verbalization Snippet 'Conditional'.
Pattern Step 'ring-symmetric.1.1.1' fills a field of Pattern Step 'ring-symmetric.1.1'.
Pattern Step 'ring-symmetric.1.1.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.1' is of Pattern Construct 'Fact'.
Pattern Step 'ring-symmetric.1.1.1.1' fills a field of Pattern Step 'ring-symmetric.1.1.1'.
Pattern Step 'ring-symmetric.1.1.1.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.1.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-symmetric.1.1.1.1' matches Role Match 'included'.
Pattern Step 'ring-symmetric.1.1.1.1.1' fills a field of Pattern Step 'ring-symmetric.1.1.1.1'.
Pattern Step 'ring-symmetric.1.1.1.1.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-symmetric.1.1.1.2' fills a field of Pattern Step 'ring-symmetric.1.1.1'.
Pattern Step 'ring-symmetric.1.1.1.2' has Position 2.
Pattern Step 'ring-symmetric.1.1.1.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-symmetric.1.1.1.2.1' fills a field of Pattern Step 'ring-symmetric.1.1.1.2'.
Pattern Step 'ring-symmetric.1.1.1.2.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.1.2.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-symmetric.1.1.2' fills a field of Pattern Step 'ring-symmetric.1.1'.
Pattern Step 'ring-symmetric.1.1.2' has Position 2.
Pattern Step 'ring-symmetric.1.1.2' is of Pattern Construct 'ConverseFact'.
Pattern Step 'ring-symmetric.1.1.2.1' fills a field of Pattern Step 'ring-symmetric.1.1.2'.
Pattern Step 'ring-symmetric.1.1.2.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-symmetric.1.1.2.1' matches Role Match 'included'.
Pattern Step 'ring-symmetric.1.1.2.1.1' fills a field of Pattern Step 'ring-symmetric.1.1.2.1'.
Pattern Step 'ring-symmetric.1.1.2.1.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-symmetric.1.1.2.2' fills a field of Pattern Step 'ring-symmetric.1.1.2'.
Pattern Step 'ring-symmetric.1.1.2.2' has Position 2.
Pattern Step 'ring-symmetric.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-symmetric.1.1.2.2.1' fills a field of Pattern Step 'ring-symmetric.1.1.2.2'.
Pattern Step 'ring-symmetric.1.1.2.2.1' has Position 1.
Pattern Step 'ring-symmetric.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-acyclic' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-acyclic' has Pattern Form 'No A may cycle back to itself via one or more traversals through A R A.'.
Verbalization Pattern 'ring-acyclic' has Pattern Example 'No Domain may cycle back to itself via one or more traversals through Domain is contained in Domain.'.
Verbalization Pattern 'ring-acyclic' verbalizes Constraint Type 'AC'.
Verbalization Pattern 'ring-acyclic' has Verbalization Sign 'positive'.
Verbalization Pattern 'ring-acyclic' starts with Pattern Step 'ring-acyclic.1'.
Pattern Step 'ring-acyclic.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'ring-acyclic.1.1' fills a field of Pattern Step 'ring-acyclic.1'.
Pattern Step 'ring-acyclic.1.1' has Position 1.
Pattern Step 'ring-acyclic.1.1' uses Verbalization Snippet 'AcyclicTraversal'.
Pattern Step 'ring-acyclic.1.1.1' fills a field of Pattern Step 'ring-acyclic.1.1'.
Pattern Step 'ring-acyclic.1.1.1' has Position 1.
Pattern Step 'ring-acyclic.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'ring-acyclic.1.1.1' matches Role Match 'primary'.
Pattern Step 'ring-acyclic.1.1.1.1' fills a field of Pattern Step 'ring-acyclic.1.1.1'.
Pattern Step 'ring-acyclic.1.1.1.1' has Position 1.
Pattern Step 'ring-acyclic.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-acyclic.1.1.2' fills a field of Pattern Step 'ring-acyclic.1.1'.
Pattern Step 'ring-acyclic.1.1.2' has Position 2.
Pattern Step 'ring-acyclic.1.1.2' is of Pattern Construct 'Fact'.
Pattern Step 'ring-acyclic.1.1.2.1' fills a field of Pattern Step 'ring-acyclic.1.1.2'.
Pattern Step 'ring-acyclic.1.1.2.1' has Position 1.
Pattern Step 'ring-acyclic.1.1.2.1' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-acyclic.1.1.2.1' matches Role Match 'included'.
Pattern Step 'ring-acyclic.1.1.2.1.1' fills a field of Pattern Step 'ring-acyclic.1.1.2.1'.
Pattern Step 'ring-acyclic.1.1.2.1.1' has Position 1.
Pattern Step 'ring-acyclic.1.1.2.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'ring-acyclic.1.1.2.2' fills a field of Pattern Step 'ring-acyclic.1.1.2'.
Pattern Step 'ring-acyclic.1.1.2.2' has Position 2.
Pattern Step 'ring-acyclic.1.1.2.2' is of Pattern Construct 'PredicateReplacement'.
Pattern Step 'ring-acyclic.1.1.2.2.1' fills a field of Pattern Step 'ring-acyclic.1.1.2.2'.
Pattern Step 'ring-acyclic.1.1.2.2.1' has Position 1.
Pattern Step 'ring-acyclic.1.1.2.2.1' uses Verbalization Snippet 'ObjectTypeName'.

Verbalization Pattern 'ring-kind' is in Pattern Family 'ring'.
Verbalization Pattern 'ring-kind' has Pattern Form 'A R A is acyclic.'.
Verbalization Pattern 'ring-kind' has Pattern Example 'Memory supersedes Memory is acyclic.'.
Verbalization Pattern 'ring-kind' has Pattern Note 'the fact type in its own words, then is and the kind: acyclic, asymmetric, antisymmetric, symmetric, transitive, intransitive or irreflexive'.

## Set comparison

Verbalization Pattern 'subset' is in Pattern Family 'set comparison'.
Verbalization Pattern 'subset' has Pattern Form 'If A R B then A S B.'.
Verbalization Pattern 'subset' has Pattern Example 'If some Role has some Position in some Reading where some Fact Type has that Reading then that Fact Type has that Role.'.
Verbalization Pattern 'subset' has Pattern Note 'a subset constraint: every A that R a B also S that B; subscripts 1 and 2 tell two instances of one type apart, and a negated consequent states an exclusion'.

Verbalization Pattern 'exclusion-of-subtypes' is in Pattern Family 'set comparison'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Form 'For each A, at most one of the following holds: that A is a B; that A is a C.'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Example 'For each Function, at most one of the following holds: that Function is an Event Type; that Function is a Constraint; that Function is a Derivation Rule.'.
Verbalization Pattern 'exclusion-of-subtypes' has Pattern Note 'exactly one of the following holds makes the subtypes a partition of A'.
Verbalization Pattern 'exclusion-of-subtypes' verbalizes Constraint Type 'XC'.
Verbalization Pattern 'exclusion-of-subtypes' has Verbalization Sign 'positive'.
Verbalization Pattern 'exclusion-of-subtypes' starts with Pattern Step 'exclusion-of-subtypes.1'.
Pattern Step 'exclusion-of-subtypes.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'exclusion-of-subtypes.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1'.
Pattern Step 'exclusion-of-subtypes.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1' uses Verbalization Snippet 'GroupExclusion'.
Pattern Step 'exclusion-of-subtypes.1.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1'.
Pattern Step 'exclusion-of-subtypes.1.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'exclusion-of-subtypes.1.1.1' matches Role Match 'primary'.
Pattern Step 'exclusion-of-subtypes.1.1.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.1'.
Pattern Step 'exclusion-of-subtypes.1.1.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'exclusion-of-subtypes.1.1.2' fills a field of Pattern Step 'exclusion-of-subtypes.1.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2' has Position 2.
Pattern Step 'exclusion-of-subtypes.1.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'exclusion-of-subtypes.1.1.2' has List Style 'SemicolonList'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1' uses Verbalization Snippet 'SubtypeAssertion'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1' reads the role in Position 2.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2' has Position 2.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2' is of Pattern Construct 'RolePlayer'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2' reads the role in Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1.2'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1' is of Pattern Construct 'IndefiniteArticle'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.1' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.1' has Position 1.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.1' uses Verbalization Snippet 'IndefiniteArticle'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.2' fills a field of Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1'.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.2' has Position 2.
Pattern Step 'exclusion-of-subtypes.1.1.2.1.2.1.2' uses Verbalization Snippet 'VowelIndefiniteArticle'.

Verbalization Pattern 'partition-of-subtypes' is in Pattern Family 'set comparison'.
Verbalization Pattern 'partition-of-subtypes' has Pattern Form 'For each A, exactly one of the following holds: that A is a B; that A is a C.'.
Verbalization Pattern 'partition-of-subtypes' has Pattern Example 'For each Object Type, exactly one of the following holds: that Object Type is an Entity Type; that Object Type is a Value Type.'.
Verbalization Pattern 'partition-of-subtypes' verbalizes Constraint Type 'XO'.
Verbalization Pattern 'partition-of-subtypes' has Verbalization Sign 'positive'.
Verbalization Pattern 'partition-of-subtypes' starts with Pattern Step 'partition-of-subtypes.1'.
Pattern Step 'partition-of-subtypes.1' uses Verbalization Snippet 'ImpliedModalNecessityOperator'.
Pattern Step 'partition-of-subtypes.1.1' fills a field of Pattern Step 'partition-of-subtypes.1'.
Pattern Step 'partition-of-subtypes.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1' uses Verbalization Snippet 'GroupExclusiveOr'.
Pattern Step 'partition-of-subtypes.1.1.1' fills a field of Pattern Step 'partition-of-subtypes.1.1'.
Pattern Step 'partition-of-subtypes.1.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'partition-of-subtypes.1.1.1' matches Role Match 'primary'.
Pattern Step 'partition-of-subtypes.1.1.1.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.1'.
Pattern Step 'partition-of-subtypes.1.1.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.1.1' uses Verbalization Snippet 'ObjectTypeName'.
Pattern Step 'partition-of-subtypes.1.1.2' fills a field of Pattern Step 'partition-of-subtypes.1.1'.
Pattern Step 'partition-of-subtypes.1.1.2' has Position 2.
Pattern Step 'partition-of-subtypes.1.1.2' is of Pattern Construct 'IterateFacts'.
Pattern Step 'partition-of-subtypes.1.1.2' has List Style 'SemicolonList'.
Pattern Step 'partition-of-subtypes.1.1.2.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.2'.
Pattern Step 'partition-of-subtypes.1.1.2.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1' uses Verbalization Snippet 'SubtypeAssertion'.
Pattern Step 'partition-of-subtypes.1.1.2.1.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1'.
Pattern Step 'partition-of-subtypes.1.1.2.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1.1' is of Pattern Construct 'RolePlayer'.
Pattern Step 'partition-of-subtypes.1.1.2.1.1' reads the role in Position 2.
Pattern Step 'partition-of-subtypes.1.1.2.1.1.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1.1'.
Pattern Step 'partition-of-subtypes.1.1.2.1.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1.1.1' uses Verbalization Snippet 'DefiniteArticle'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2' has Position 2.
Pattern Step 'partition-of-subtypes.1.1.2.1.2' is of Pattern Construct 'RolePlayer'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2' reads the role in Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1.2'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1' is of Pattern Construct 'IndefiniteArticle'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.1' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1.2.1'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.1' has Position 1.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.1' uses Verbalization Snippet 'IndefiniteArticle'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.2' fills a field of Pattern Step 'partition-of-subtypes.1.1.2.1.2.1'.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.2' has Position 2.
Pattern Step 'partition-of-subtypes.1.1.2.1.2.1.2' uses Verbalization Snippet 'VowelIndefiniteArticle'.

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
Verbalization Pattern 'objectification' has Pattern Example 'Constraint Span objectifies "Constraint spans Role".'.
Verbalization Pattern 'objectification' has Pattern Note 'the fact type becomes an object type N that plays roles of its own; the reading is quoted in double quotes'.

## Derivation

Verbalization Pattern 'derivation-fully' is in Pattern Family 'derivation'.
Verbalization Pattern 'derivation-fully' has Pattern Form '* A R B iff A S C and C T B.'.
Verbalization Pattern 'derivation-fully' has Pattern Example '* Domain1 reaches Domain2 iff Domain2 is contained in Domain1.'.
Verbalization Pattern 'derivation-fully' has Pattern Note 'the leading asterisk marks the fact type fully derived; the body joins fact types on shared object types; two asterisks store the derived rows'.

Verbalization Pattern 'derivation-semi' is in Pattern Family 'derivation'.
Verbalization Pattern 'derivation-semi' has Pattern Form '+ A R B if A S B.'.
Verbalization Pattern 'derivation-semi' has Pattern Example '+ User is authorized for Permission on Function if that User has some Access Role and that Access Role is authorized for that Permission on that Function.'.
Verbalization Pattern 'derivation-semi' has Pattern Note 'a plus marks a semi-derived fact type, derived where the rule applies and assertable directly elsewhere; two pluses store it'.

## Deontic

Verbalization Pattern 'deontic-obligation' is in Pattern Family 'deontic'.
Verbalization Pattern 'deontic-obligation' has Pattern Form 'It is obligatory that each A R some B.'.
Verbalization Pattern 'deontic-obligation' has Pattern Example 'It is obligatory that each Object Type plays some Role.'.
Verbalization Pattern 'deontic-obligation' has Pattern Note 'a deontic constraint warns and commits where an alethic one rejects; It is forbidden that is the other one, and the body is any constraint sentence; a permission is not a modality but a fact of a permission fact type (security.md)'.

Verbalization Pattern 'constraint-text' is in Pattern Family 'deontic'.
Verbalization Pattern 'constraint-text' has Pattern Form 'It is obligatory that ...'.
Verbalization Pattern 'constraint-text' has Pattern Note 'a constraint stated as a sentence the compiler builds no shape for verbalizes as its Text; a constraint of a shape some pattern reads is never verbalized so'.
Verbalization Pattern 'constraint-text' has Verbalization Sign 'positive'.
Verbalization Pattern 'constraint-text' starts with Pattern Step 'constraint-text.1'.
Pattern Step 'constraint-text.1' is of Pattern Construct 'ConstraintText'.

## State machines

Verbalization Pattern 'state-machine' is in Pattern Family 'state machine'.
Verbalization Pattern 'state-machine' has Pattern Form 'Transition t is triggered by Event Type f.'.
Verbalization Pattern 'state-machine' has Pattern Note 'a machine is five kinds of population sentence over the names in single quotes: State Machine Definition m is for Object Type a; Status s is initial in State Machine Definition m; Transition t is from Status s; Transition t is to Status s2; Transition t is triggered by Event Type f'.

## Populations

Verbalization Pattern 'population' is in Pattern Family 'population'.
Verbalization Pattern 'population' has Pattern Form 'A x R B y.'.
Verbalization Pattern 'population' has Pattern Note 'an instance fact names the object types with their values in single quotes after each; it must match a declared fact type reading word for word'.
