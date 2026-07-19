# Sherlock: Abductive Case Investigation

<!-- Port of the pre-reset sherlock app (Repos/apps/sherlock), rebuilt for
     genuine machine reasoning per the standing rulings: NO pre-solved
     cases — all three cases enter unsolved, and every conclusion must
     come from the canon's own mechanisms. Each case carries exactly one
     honest textual seed (the story's direct clue: the dying words name
     the speckled band; the digging is heard from the cellar; RACHE is
     written on the wall). The evidence gate is a chain of NORMA-native
     two-leg derivations (credible from verified source; corroborated
     from credible support; strongly-suspects from proposal and
     corroboration), so the derived populations exist for induction to
     consume: induce completes the explains relation (the abduced
     conclusions are the MDL-minimal candidate's hidden facts), and the
     selection derives from the completed evidence-gated picture. `Fact`
     is renamed `Observation` (the metamodel-collision class); same-player
     m:n uses the `Fact joins Fact` pattern (combination UC + irreflexive
     ring). -->

## Entity Types

Case(.Name) is an entity type.
Observation(.Statement) is an entity type.
Hypothesis(.Claim) is an entity type.
Explanation(.Title) is an entity type.
Means(.Description) is an entity type.

## Value Types

The data type of Statement is text.
The data type of Claim is text.
The data type of Title is text.
The data type of Description is text.

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

Case 'The Speckled Band' observes Observation 'the cause of death is unknown'.
Case 'The Speckled Band' observes Observation 'the room was locked from the inside'.
Case 'The Speckled Band' observes Observation 'her dying words named the speckled band'.

Case 'The Red-Headed League' observes Observation 'the league dissolved without warning'.
Case 'The Red-Headed League' observes Observation 'the copying work was pointless'.
Case 'The Red-Headed League' observes Observation 'digging was heard from the cellar'.

Case 'A Study in Scarlet' observes Observation 'RACHE was written on the wall'.
Case 'A Study in Scarlet' observes Observation 'nothing was stolen'.
Case 'A Study in Scarlet' observes Observation 'the victim was poisoned'.

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

Hypothesis 'a trained snake killed her' explains Observation 'her dying words named the speckled band'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' explains Observation 'digging was heard from the cellar'.
Hypothesis 'he was killed for revenge' explains Observation 'RACHE was written on the wall'.

Case 'The Speckled Band' observes Observation 'a ventilator connects her room to the study'.
Case 'The Speckled Band' observes Observation 'a bell rope hangs over the bolted bed'.
Case 'The Red-Headed League' observes Observation 'the pawnshop adjoins the bank vault'.
Case 'A Study in Scarlet' observes Observation 'a wedding ring lay by the body'.

Observation 'a ventilator connects her room to the study' affords Means 'a hidden path to the sleeper'.
Observation 'a bell rope hangs over the bolted bed' affords Means 'a hidden path to the sleeper'.
Observation 'the pawnshop adjoins the bank vault' affords Means 'a tunnel into the vault'.
Observation 'digging was heard from the cellar' affords Means 'a tunnel into the vault'.
Observation 'RACHE was written on the wall' affords Means 'a motive of vengeance'.
Observation 'a wedding ring lay by the body' affords Means 'a motive of vengeance'.

Hypothesis 'the gypsies killed her' relies on Means 'entry from outside'.
Hypothesis 'a trained snake killed her' relies on Means 'a hidden path to the sleeper'.
Hypothesis 'the league was genuine charity' relies on Means 'genuine philanthropy'.
Hypothesis 'the league was a pretext to tunnel into the bank vault' relies on Means 'a tunnel into the vault'.
Hypothesis 'political rioters killed him' relies on Means 'random street violence'.
Hypothesis 'he was killed for revenge' relies on Means 'a motive of vengeance'.

Explanation 'the resolution of The Speckled Band' is for Case 'The Speckled Band'.
Explanation 'the resolution of The Red-Headed League' is for Case 'The Red-Headed League'.
Explanation 'the resolution of A Study in Scarlet' is for Case 'A Study in Scarlet'.
