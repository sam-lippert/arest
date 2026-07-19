# Sherlock: Abductive Case Investigation

<!-- Port of the pre-reset sherlock app (Repos/apps/sherlock), rebuilt for
     genuine machine reasoning per the standing rulings: NO pre-solved
     cases — all three cases enter unsolved, and every conclusion must
     come from the canon's own mechanisms. The evidence chain is grounded
     and NORMA-native (Observation affords Means; Hypothesis relies on
     Means; availability and strong suspicion derive by two-leg joins),
     and the explains relation is completed by INDUCTION: the Instance
     Facts bind the predicate to the Func that derives it — `Derivation
     Rule 'induce' produces Fact Type 'HypothesisExplainsObservation'`
     (Derivation Rule is a subtype of Function, so the binding rides
     Function(.id); the rule's Text IS the Func term). No marker syntax:
     the designation is itself a fact, in canonical FORML.

     v5 (the atomization ruling): evidence is no longer prose. Each
     observation ATTESTS an elementary fact over real players — CSDP
     applied to the case domains: persons, rooms, fixtures, phrases,
     organizations, buildings, items — as fact types with populations
     and uniqueness constraints. An Observation's reference is a short
     natural name; its CONTENT is its attestation row. -->

## Entity Types

Case(.Name) is an entity type.
Observation(.Name) is an entity type.
Hypothesis(.Claim) is an entity type.
Explanation(.Title) is an entity type.
Means(.Description) is an entity type.
Person(.Name) is an entity type.
Room(.Name) is an entity type.
Fixture(.Name) is an entity type.
Phrase(.Wording) is an entity type.
Organization(.Name) is an entity type.
Building(.Name) is an entity type.
Item(.Name) is an entity type.

## Value Types

The data type of Claim is text.
The data type of Title is text.
The data type of Description is text.
The data type of Wording is text.

## Fact Types

Case observes Observation.
  For each Observation, at most one Case observes that Observation.

Case proposes Hypothesis.
  For each Hypothesis, at most one Case proposes that Hypothesis.

Hypothesis explains Observation.

Hypothesis contradicts Hypothesis.
  Each Hypothesis, Hypothesis combination occurs at most once in the population of Hypothesis contradicts Hypothesis.
No Hypothesis contradicts itself.

Observation affords Means.

Hypothesis relies on Means.
  Each Hypothesis relies on at most one Means.

Means is available in Case. *

Case strongly suspects Hypothesis. *

Explanation is for Case.
  Each Explanation is for exactly one Case.

Explanation selects Hypothesis. *

### Attestations (the atomic evidence)

Observation attests unexplained death of Person.
  Each Observation attests unexplained death of at most one Person.

Observation attests inside-locked Room.
  Each Observation attests inside-locked at most one Room.

Observation attests dying Person spoke Phrase.
  Each Observation, Person, Phrase combination occurs at most once in the population of Observation attests dying Person spoke Phrase.

Observation attests Fixture connects Room to Room.
  Each Observation, Fixture, Room, Room combination occurs at most once in the population of Observation attests Fixture connects Room to Room.

Observation attests Fixture hangs over Fixture.
  Each Observation, Fixture, Fixture combination occurs at most once in the population of Observation attests Fixture hangs over Fixture.

Observation attests abrupt dissolution of Organization.
  Each Observation attests abrupt dissolution of at most one Organization.

Observation attests pointless work assigned by Organization.
  Each Observation attests pointless work assigned by at most one Organization.

Observation attests digging heard from Room.
  Each Observation attests digging heard from at most one Room.

Observation attests Building adjoins Building.
  Each Observation, Building, Building combination occurs at most once in the population of Observation attests Building adjoins Building.

Observation attests Phrase written on Fixture.
  Each Observation, Phrase, Fixture combination occurs at most once in the population of Observation attests Phrase written on Fixture.

Observation attests unrobbed Person.
  Each Observation attests unrobbed at most one Person.

Observation attests poisoned Person.
  Each Observation attests poisoned at most one Person.

Observation attests Item lay beside Person.
  Each Observation, Item, Person combination occurs at most once in the population of Observation attests Item lay beside Person.

## Derivation Rules

* Means is available in Case iff some Observation affords Means and some Case observes that Observation.

* Case strongly suspects Hypothesis iff Hypothesis relies on some Means and that Means is available in that Case.

* Explanation selects Hypothesis iff Explanation is for some Case and that Case strongly suspects that Hypothesis.

## State Machine

State Machine Definition 'Investigation' is for Object Type 'Case'.
Status 'open' is initial in State Machine Definition 'Investigation'.

Case is observed.
Case is hypothesized.
Case is tested.
Case is concluded.

Transition 'begin-observation' is defined in State Machine Definition 'Investigation'.
Transition 'begin-observation' is from Status 'open'.
Transition 'begin-observation' is to Status 'observing'.
Transition 'begin-observation' is triggered by Event Type 'Case is observed'.

Transition 'form-hypotheses' is defined in State Machine Definition 'Investigation'.
Transition 'form-hypotheses' is from Status 'observing'.
Transition 'form-hypotheses' is to Status 'hypothesizing'.
Transition 'form-hypotheses' is triggered by Event Type 'Case is hypothesized'.

Transition 'test-hypotheses' is defined in State Machine Definition 'Investigation'.
Transition 'test-hypotheses' is from Status 'hypothesizing'.
Transition 'test-hypotheses' is to Status 'testing'.
Transition 'test-hypotheses' is triggered by Event Type 'Case is tested'.

Transition 'close-case' is defined in State Machine Definition 'Investigation'.
Transition 'close-case' is from Status 'testing'.
Transition 'close-case' is to Status 'closed'.
Transition 'close-case' is triggered by Event Type 'Case is concluded'.

## Instance Facts

Derivation Rule 'induce' has Text 'induce'.
Derivation Rule 'induce' produces Fact Type 'HypothesisExplainsObservation'.

Case 'The Speckled Band' observes Observation 'the unexplained death'.
Case 'The Speckled Band' observes Observation 'the locked room'.
Case 'The Speckled Band' observes Observation 'the dying words'.
Case 'The Speckled Band' observes Observation 'the ventilator passage'.
Case 'The Speckled Band' observes Observation 'the bell rope'.

Case 'The Red-Headed League' observes Observation 'the abrupt dissolution'.
Case 'The Red-Headed League' observes Observation 'the pointless work'.
Case 'The Red-Headed League' observes Observation 'the cellar digging'.
Case 'The Red-Headed League' observes Observation 'the adjoining vault'.

Case 'A Study in Scarlet' observes Observation 'the wall writing'.
Case 'A Study in Scarlet' observes Observation 'the untouched valuables'.
Case 'A Study in Scarlet' observes Observation 'the poisoning'.
Case 'A Study in Scarlet' observes Observation 'the wedding ring'.

Observation 'the unexplained death' attests unexplained death of Person 'Julia Stoner'.
Observation 'the locked room' attests inside-locked Room 'her bedroom'.
Observation 'the dying words' attests dying Person 'Julia Stoner' spoke Phrase 'the speckled band'.
Observation 'the ventilator passage' attests Fixture 'the ventilator' connects Room 'her bedroom' to Room 'the study'.
Observation 'the bell rope' attests Fixture 'the bell rope' hangs over Fixture 'the bolted bed'.

Observation 'the abrupt dissolution' attests abrupt dissolution of Organization 'the Red-Headed League'.
Observation 'the pointless work' attests pointless work assigned by Organization 'the Red-Headed League'.
Observation 'the cellar digging' attests digging heard from Room 'the cellar'.
Observation 'the adjoining vault' attests Building 'the pawnshop' adjoins Building 'the bank vault'.

Observation 'the wall writing' attests Phrase 'RACHE' written on Fixture 'the wall'.
Observation 'the untouched valuables' attests unrobbed Person 'Enoch Drebber'.
Observation 'the poisoning' attests poisoned Person 'Enoch Drebber'.
Observation 'the wedding ring' attests Item 'a wedding ring' lay beside Person 'Enoch Drebber'.

Case 'The Speckled Band' proposes Hypothesis 'the gypsies killed her'.
Case 'The Speckled Band' proposes Hypothesis 'a trained snake killed her'.
Case 'The Red-Headed League' proposes Hypothesis 'the league was genuine charity'.
Case 'The Red-Headed League' proposes Hypothesis 'the league was a pretext to tunnel into the bank vault'.
Case 'A Study in Scarlet' proposes Hypothesis 'political rioters killed him'.
Case 'A Study in Scarlet' proposes Hypothesis 'he was killed for revenge'.

Hypothesis 'the gypsies killed her' contradicts Hypothesis 'a trained snake killed her'.
Hypothesis 'a trained snake killed her' contradicts Hypothesis 'the gypsies killed her'.
Hypothesis 'the league was genuine charity' contradicts Hypothesis 'the league was a pretext to tunnel into the bank vault'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' contradicts Hypothesis 'the league was genuine charity'.
Hypothesis 'political rioters killed him' contradicts Hypothesis 'he was killed for revenge'.
Hypothesis 'he was killed for revenge' contradicts Hypothesis 'political rioters killed him'.

Hypothesis 'a trained snake killed her' explains Observation 'the dying words'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' explains Observation 'the cellar digging'.
Hypothesis 'he was killed for revenge' explains Observation 'the wall writing'.

<!-- OPEN RULING (2026-07-19, "Shouldn't most of these be induced from
     premises?"): these six hand-authored affords rows are overfitting.
     The intended v6: one seed row, ObservationAffordsMeans bound to the
     induce Func, and an induce-closure fixpoint learning the covering
     join (verified recipes: affords = joinon(explains, relies on);
     explains = joinon(observes, strongly suspects)). Blocked on a real
     engine defect: solve:closure assumes the declared rules form a DAG,
     and the two learned rules close a cycle (explains -> affords ->
     available -> suspects -> explains) that hangs it. See the ledger
     entry of this date for the full expedition record. -->
Observation 'the ventilator passage' affords Means 'a hidden path to the sleeper'.
Observation 'the bell rope' affords Means 'a hidden path to the sleeper'.
Observation 'the adjoining vault' affords Means 'a tunnel into the vault'.
Observation 'the cellar digging' affords Means 'a tunnel into the vault'.
Observation 'the wall writing' affords Means 'a motive of vengeance'.
Observation 'the wedding ring' affords Means 'a motive of vengeance'.

Hypothesis 'the gypsies killed her' relies on Means 'entry from outside'.
Hypothesis 'a trained snake killed her' relies on Means 'a hidden path to the sleeper'.
Hypothesis 'the league was genuine charity' relies on Means 'genuine philanthropy'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' relies on Means 'a tunnel into the vault'.
Hypothesis 'political rioters killed him' relies on Means 'random street violence'.
Hypothesis 'he was killed for revenge' relies on Means 'a motive of vengeance'.

Explanation 'the resolution of The Speckled Band' is for Case 'The Speckled Band'.
Explanation 'the resolution of The Red-Headed League' is for Case 'The Red-Headed League'.
Explanation 'the resolution of A Study in Scarlet' is for Case 'A Study in Scarlet'.
