# A quoted value is a value, whatever words are inside it

# The disjunctive classifier tested the WHOLE sentence for ` or some `,
# ` or that ` and ` or is ` with a naked Contains, so a sentence whose quoted
# VALUE happened to contain one of them was filed as a textual constraint with
# no direct construction and its row was dropped from every store the oracle
# writes. metamodel/verbalization.md declares the form of the disjunctive
# mandatory pattern as a value:
#
#   Verbalization Pattern 'mandatory-disjunctive' has Pattern Form
#     'For each A, some B R that A or some C S that A.'.
#
# so VerbalizationPatternHasPatternForm lost that one row, the role is
# mandatory, and EVERY write to any oracle-carried store was refused with a
# fourth violation about a verbalization pattern it had never mentioned.
# The two sentences below are the same two sentences: one quoted value with
# the connective inside it, one real disjunctive mandatory with it outside.

## Entity Types

Pattern(.name) is an entity type.
Status(.name) is an entity type.
Transition(.name) is an entity type.

## Value Types

Form is a value type.

The data type of Form is text.

## Fact Types

Pattern has Form.
  Each Pattern has exactly one Form.

Transition is from Status.
  Each Transition is from at most one Status.

Transition is to Status.
  Each Transition is to at most one Status.

For each Status, some Transition is from that Status or some Transition is to that Status.

## Instance Facts

Pattern 'simple' has Form 'Each A R some B.'.
Pattern 'disjunctive' has Form 'For each A, some B R that A or some C S that A.'.
