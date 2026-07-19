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
Evidence(.Item) is an entity type.
Evidence Source(.Name) is an entity type.

## Value Types

The data type of Statement is text.
The data type of Claim is text.
The data type of Title is text.
The data type of Item is text.

## Fact Types

Case observes Observation.
  For each Observation, at most one Case observes that Observation.

Case proposes Hypothesis.
  For each Hypothesis, at most one Case proposes that Hypothesis.

Hypothesis explains Observation.

Hypothesis contradicts Hypothesis.
  Each Hypothesis, Hypothesis combination occurs at most once in the population of Hypothesis contradicts Hypothesis.
No Hypothesis contradicts itself.

Evidence supports Hypothesis.

Evidence comes from Evidence Source.
  Each Evidence comes from exactly one Evidence Source.

Sleuth(.Name) is an entity type.

Sleuth vouches for Evidence Source.

Evidence is vetted by Sleuth. *

Hypothesis is corroborated by Sleuth. *

Case strongly suspects Hypothesis. *

Explanation is for Case.
  Each Explanation is for exactly one Case.

Explanation selects Hypothesis. *

## Derivation Rules

* Evidence is vetted by Sleuth iff Evidence comes from some Evidence Source and that Sleuth vouches for that Evidence Source.

* Hypothesis is corroborated by Sleuth iff some Evidence supports Hypothesis and that Evidence is vetted by that Sleuth.

* Case strongly suspects Hypothesis iff Case proposes Hypothesis and that Hypothesis is corroborated by some Sleuth.

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

Evidence 'the ventilator passage' supports Hypothesis 'a trained snake killed her'.
Evidence 'the dummy bell rope' supports Hypothesis 'a trained snake killed her'.
Evidence 'gypsies camped on the grounds' supports Hypothesis 'the gypsies killed her'.
Evidence 'the shop adjoins the bank vault' supports Hypothesis 'the league was a pretext to tunnel into the bank vault'.
Evidence 'the absurdly generous wage' supports Hypothesis 'the league was a pretext to tunnel into the bank vault'.
Evidence 'the league advertisement' supports Hypothesis 'the league was genuine charity'.
Evidence 'RACHE written in blood' supports Hypothesis 'he was killed for revenge'.
Evidence 'the wedding ring at the scene' supports Hypothesis 'he was killed for revenge'.
Evidence 'newspaper riot rumors' supports Hypothesis 'political rioters killed him'.

Evidence 'the ventilator passage' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'the dummy bell rope' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'gypsies camped on the grounds' comes from Evidence Source 'village hearsay'.
Evidence 'the shop adjoins the bank vault' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'the absurdly generous wage' comes from Evidence Source 'client account'.
Evidence 'the league advertisement' comes from Evidence Source 'league advertisement'.
Evidence 'RACHE written in blood' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'the wedding ring at the scene' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'newspaper riot rumors' comes from Evidence Source 'newspaper speculation'.

Sleuth 'Sherlock Holmes' vouches for Evidence Source 'Holmes fieldwork'.

Explanation 'the resolution of The Speckled Band' is for Case 'The Speckled Band'.
Explanation 'the resolution of The Red-Headed League' is for Case 'The Red-Headed League'.
Explanation 'the resolution of A Study in Scarlet' is for Case 'A Study in Scarlet'.
