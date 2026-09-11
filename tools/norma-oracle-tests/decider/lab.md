# A predicate with a name and no binding decides nothing

### Sam's own parenthesis when he split the deciders on 2026-09-05 says what a
### Predicate is: "a Predicate is already a bound function (has Name, Module
### Path, Symbol Name)". The three come together, because a Predicate without
### the last two resolves to no code. support.auto.dev has two that do not --
### breach-precedes-notification and consent-on-file carry a Name alone -- and
### three of its constraints name them, so `Constraint is machine-decidable`
### answered T for all three and the model claimed a judge that does not exist.
###
### The two predicates below differ only in the binding, and the two
### constraints differ only in which they name. What the test asserts:
###   real-check     IS bound      -> settled-constraint IS machine-decidable
###   named-only     is NOT bound  -> hopeful-constraint is NOT, and therefore
###                                   it is what `Constraint awaits a decider`
###                                   picks up in an app that derives it.
### Absence answers F here, which is the whole point: a missing Module Path is
### a missing judge, not a silent yes.

## Instance Facts

Predicate 'real-check' has Name 'real-check'.
Predicate 'real-check' has Module Path 'lib/checks.ts'.
Predicate 'real-check' has Symbol Name 'realCheck'.

Predicate 'named-only' has Name 'named-only'.

Constraint 'settled-constraint' has Text 'a rule something actually decides'.
Constraint 'settled-constraint' has modality of Modality Type 'Deontic'.
Constraint 'settled-constraint' is decided by Predicate 'real-check'.

Constraint 'hopeful-constraint' has Text 'a rule that names a judge it does not have'.
Constraint 'hopeful-constraint' has modality of Modality Type 'Deontic'.
Constraint 'hopeful-constraint' is decided by Predicate 'named-only'.
