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
Species(.Name) is an entity type.
Motive(.Name) is an entity type.

## Value Types

The data type of Claim is text.
The data type of Title is text.
The data type of Description is text.
The data type of Wording is text.
The data type of Girth is decimal.
The data type of Bore is decimal.

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

### The grounding layer (v7: the prose-free ruling)

<!-- 2026-07-20, the ruling: "A snake being trained doesn't necessarily
     mean that it fits in the vent." The means names were carrying
     unmodeled physics, and the induced affords/explains pair is
     abductive - a hypothesis's own explanatory claim manufactured the
     availability of its own means. The abductive layer STAYS (it is
     honestly named: suspects), and this layer grounds it: every step
     below is a join over attested or reference facts, evidence-side
     only, no hypothesis-side feedback. Comparisons ride as populated
     reference relations over distinct value types (the finite-domain
     Codd form: the relevant extension of "fits through" as rows, since
     the oracle's rule grammar joins and never compares). The last mile
     - one corroborates head disjoining the three cases' differently
     shaped grounds into the selects gate - needs multi-rule heads,
     which the oracle names as its own boundary (one role path holds
     one rule); until that lands, the grounded facts derive, populate
     the representations, and are law-checkable beside the abductive
     verdict they will eventually gate. -->

Species has Girth.
  Each Species has at most one Girth.

Bore pierces Fixture.
  Each Bore, Fixture combination occurs at most once in the population of Bore pierces Fixture.

Girth threads Bore.
  Each Girth, Bore combination occurs at most once in the population of Girth threads Bore.

Hypothesis posits Species.
  Each Hypothesis posits at most one Species.

Room is in Building.
  Each Room is in at most one Building.

Observation reads Phrase.
  Each Observation reads at most one Phrase.

Phrase indicts Motive.
  Each Phrase indicts at most one Motive.

Species clears Bore. *

Species passes Fixture. *

Hypothesis gains access via Fixture. *

Observation locates digging toward Building. *

Observation exhibits Motive. *

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

* Species clears Bore iff Species has some Girth and that Girth threads that Bore.

* Species passes Fixture iff Species clears some Bore and that Bore pierces that Fixture.

* Hypothesis gains access via Fixture iff Hypothesis posits some Species and that Species passes that Fixture.

* Observation locates digging toward Building iff Observation attests digging heard from some Room and that Room is in that Building.

* Observation exhibits Motive iff Observation reads some Phrase and that Phrase indicts that Motive.

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

Derivation Rule 'induce explains' has Text 'induce'.
Derivation Rule 'induce explains' produces Fact Type 'HypothesisExplainsObservation'.
Derivation Rule 'induce affords' has Text 'induce'.
Derivation Rule 'induce affords' produces Fact Type 'ObservationAffordsMeans'.

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

<!-- v6 (the overfitting ruling resolved, 2026-07-19): the six
     hand-authored affords rows are gone. ONE seed row remains, and both
     ObservationAffordsMeans and HypothesisExplainsObservation are bound
     to the induce Func above (per-target rules, selection by Text; the
     metamodel's "Each Derivation Rule produces exactly one Fact Type"
     is the once-per-target discipline). The induce-closure fixpoint
     learns the covering joins - affords = joinon(explains, relies on);
     explains = joinon(observes, strongly suspects) - and the learned
     rules close a cycle (explains -> affords -> available -> suspects
     -> explains) that the closure now holds: solve:update is UNION
     with dedup (Lemma 1's F_S(P) = P ∪ heads), monotone over finite
     domains, so the fixpoint terminates where the old REPLACE
     semantics oscillated. The seed is one of the three affords rows
     the learned rule derives from the asserted explains evidence, so
     coverage holds from the first candidate. -->
Observation 'the cellar digging' affords Means 'a tunnel into the vault'.

Hypothesis 'the gypsies killed her' relies on Means 'entry from outside'.
Hypothesis 'a trained snake killed her' relies on Means 'a hidden path to the sleeper'.
Hypothesis 'the league was genuine charity' relies on Means 'genuine philanthropy'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' relies on Means 'a tunnel into the vault'.
Hypothesis 'political rioters killed him' relies on Means 'random street violence'.
Hypothesis 'he was killed for revenge' relies on Means 'a motive of vengeance'.

Explanation 'the resolution of The Speckled Band' is for Case 'The Speckled Band'.
Explanation 'the resolution of The Red-Headed League' is for Case 'The Red-Headed League'.
Explanation 'the resolution of A Study in Scarlet' is for Case 'A Study in Scarlet'.

<!-- v7 grounding rows: reference facts (measured or common knowledge in
     the stories' own text) and the per-case atoms the derivations
     compose. The threads population is the relevant extension of "fits
     through" over the declared sizes - 2 threads 4, and NOTHING
     threads for the intruder's 18: the derived access facts then hold
     for the adder and are ABSENT for the intruder, which is the
     snake-fits-the-vent fact, prose-free. -->

Species 'a swamp adder' has Girth '2'.
Species 'a human intruder' has Girth '18'.
Girth '2' threads Bore '4'.
Bore '4' pierces Fixture 'the ventilator'.
Hypothesis 'a trained snake killed her' posits Species 'a swamp adder'.
Hypothesis 'the gypsies killed her' posits Species 'a human intruder'.
Room 'the cellar' is in Building 'the pawnshop'.
Observation 'the wall writing' reads Phrase 'RACHE'.
Phrase 'RACHE' indicts Motive 'revenge'.

Domain 'sherlock' has Description 'Abductive case investigation: observations afford means, hypotheses rely on them, explanations select the strongly suspected.'.
