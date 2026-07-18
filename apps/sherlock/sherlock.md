# Sherlock: Abductive Case Investigation

<!-- Port of the pre-reset sherlock app (Repos/apps/sherlock), demo-lean:
     the crime/cases/evidence vocabulary collapsed to the solve loop,
     SPD-1 affect layers cut. The old app's asserted resolution becomes
     DERIVED here: the selection follows from conclusive evidence, the
     confidence from the selection, and the Investigation state machine
     closes on the derived facts. The old `Fact` entity type is renamed
     `Observation` (the metamodel-collision class the Sale/Order renames
     precedented). -->

## Entity Types

Case(.Name) is an entity type.
Observation(.id) is an entity type.
Hypothesis(.id) is an entity type.
Explanation(.id) is an entity type.
Evidence(.id) is an entity type.
Evidence Source(.Name) is an entity type.

## Value Types

Confidence Level is a value type.
  The data type of Confidence Level is text.
  The possible values of Confidence Level are 'Definitive', 'Strong', 'Moderate', 'Weak', 'Speculative'.
Evidence Weight is a value type.
  The data type of Evidence Weight is text.
  The possible values of Evidence Weight are 'Conclusive', 'Strong', 'Moderate', 'Weak', 'Negligible'.
Reliability is a value type.
  The data type of Reliability is text.
  The possible values of Reliability are 'Verified', 'Corroborated', 'Uncorroborated', 'Disputed', 'Discredited'.

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

Evidence is direct.

Evidence comes from Evidence Source.
  Each Evidence comes from exactly one Evidence Source.

Evidence Source has Reliability.
  Each Evidence Source has exactly one Reliability.

Evidence has Evidence Weight. +
  Each Evidence has at most one Evidence Weight.
* Evidence has Evidence Weight 'Conclusive' if Evidence is direct and Evidence comes from some Evidence Source and that Evidence Source has Reliability 'Verified'.
* Evidence has Evidence Weight 'Weak' if Evidence comes from some Evidence Source and that Evidence Source has Reliability 'Uncorroborated'.

Explanation is for Case.
  Each Explanation is for exactly one Case.

Explanation selects Hypothesis. *
* Explanation selects Hypothesis if and only if Explanation is for some Case and that Case proposes that Hypothesis and some Evidence supports that Hypothesis and that Evidence has Evidence Weight 'Conclusive'.

Explanation reaches Confidence Level. *
* Explanation reaches Confidence Level 'Definitive' if and only if Explanation selects some Hypothesis and some Evidence supports that Hypothesis and that Evidence is direct and that Evidence has Evidence Weight 'Conclusive'.

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

Case 'The Speckled Band' proposes Hypothesis 'h1-gypsies'.
Hypothesis 'h1-gypsies' explains Observation 'locked-room'.

Case 'The Speckled Band' proposes Hypothesis 'h2-snake'.
Hypothesis 'h2-snake' explains Observation 'locked-room'.
Hypothesis 'h2-snake' explains Observation 'dying-words'.
Hypothesis 'h2-snake' explains Observation 'cause-unknown'.

Hypothesis 'h1-gypsies' contradicts Hypothesis 'h2-snake'.
Hypothesis 'h2-snake' contradicts Hypothesis 'h1-gypsies'.

Evidence 'ventilator-passage' is direct.
Evidence 'ventilator-passage' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'ventilator-passage' supports Hypothesis 'h2-snake'.

Evidence 'dummy-bell-rope' is direct.
Evidence 'dummy-bell-rope' comes from Evidence Source 'Holmes fieldwork'.
Evidence 'dummy-bell-rope' supports Hypothesis 'h2-snake'.

Evidence 'gypsy-presence' comes from Evidence Source 'village hearsay'.
Evidence 'gypsy-presence' supports Hypothesis 'h1-gypsies'.

Evidence Source 'Holmes fieldwork' has Reliability 'Verified'.
Evidence Source 'village hearsay' has Reliability 'Uncorroborated'.

Explanation 'resolution-sb' is for Case 'The Speckled Band'.
