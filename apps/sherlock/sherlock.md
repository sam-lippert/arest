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
Observation(.id) is an entity type.
Hypothesis(.id) is an entity type.
Explanation(.id) is an entity type.
Evidence(.id) is an entity type.
Evidence Source(.Name) is an entity type.

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

Case 'The Speckled Band' observes Observation 'cause-unknown'.
Case 'The Speckled Band' observes Observation 'locked-room'.
Case 'The Speckled Band' observes Observation 'dying-words'.

Case 'The Red-Headed League' observes Observation 'league-dissolved'.
Case 'The Red-Headed League' observes Observation 'copying-job'.
Case 'The Red-Headed League' observes Observation 'cellar-digging'.

Case 'A Study in Scarlet' observes Observation 'rache-writing'.
Case 'A Study in Scarlet' observes Observation 'no-robbery'.
Case 'A Study in Scarlet' observes Observation 'poison-death'.

Case 'The Speckled Band' proposes Hypothesis 'h-gypsies'.
Case 'The Speckled Band' proposes Hypothesis 'h-snake'.
Case 'The Red-Headed League' proposes Hypothesis 'h-charity'.
Case 'The Red-Headed League' proposes Hypothesis 'h-tunnel'.
Case 'A Study in Scarlet' proposes Hypothesis 'h-riots'.
Case 'A Study in Scarlet' proposes Hypothesis 'h-revenge'.

Hypothesis 'h-gypsies' contradicts Hypothesis 'h-snake'.
Hypothesis 'h-snake' contradicts Hypothesis 'h-gypsies'.
Hypothesis 'h-charity' contradicts Hypothesis 'h-tunnel'.
Hypothesis 'h-tunnel' contradicts Hypothesis 'h-charity'.
Hypothesis 'h-riots' contradicts Hypothesis 'h-revenge'.
Hypothesis 'h-revenge' contradicts Hypothesis 'h-riots'.

Hypothesis 'h-snake' explains Observation 'dying-words'.
Hypothesis 'h-tunnel' explains Observation 'cellar-digging'.
Hypothesis 'h-revenge' explains Observation 'rache-writing'.

Evidence 'ventilator-passage' supports Hypothesis 'h-snake'.
Evidence 'dummy-bell-rope' supports Hypothesis 'h-snake'.
Evidence 'gypsy-presence' supports Hypothesis 'h-gypsies'.
Evidence 'vault-adjacency' supports Hypothesis 'h-tunnel'.
Evidence 'wage-oddity' supports Hypothesis 'h-tunnel'.
Evidence 'charity-claim' supports Hypothesis 'h-charity'.
Evidence 'rache-blood' supports Hypothesis 'h-revenge'.
Evidence 'wedding-ring' supports Hypothesis 'h-revenge'.
Evidence 'riot-rumor' supports Hypothesis 'h-riots'.

Evidence 'ventilator-passage' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'dummy-bell-rope' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'gypsy-presence' comes from Evidence Source 'village hearsay'.
Evidence 'vault-adjacency' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'wage-oddity' comes from Evidence Source 'client account'.
Evidence 'charity-claim' comes from Evidence Source 'league advertisement'.
Evidence 'rache-blood' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'wedding-ring' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'riot-rumor' comes from Evidence Source 'newspaper speculation'.

Sleuth 'Sherlock Holmes' vouches for Evidence Source 'Holmes fieldwork'.

Explanation 'resolution-sb' is for Case 'The Speckled Band'.
Explanation 'resolution-rhl' is for Case 'The Red-Headed League'.
Explanation 'resolution-sis' is for Case 'A Study in Scarlet'.
