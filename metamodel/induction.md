# Induction

<!--
## Description
Vocabulary for the induce Func (#846-#852). The engine's search loop
populates Hypothesis Candidate facts; ranking is AUTOMATED and domain-
agnostic (forward-chain COVERAGE of the observed facts (the gate) plus
SIMPLICITY/MDL [fewest hidden facts; Occam/Solomonoff]) NOT hand-
declared per-app. Per Halpin, rulemaking is itself automatable, so the
ranking meta-rule is INDUCED (CSDP applied at the meta level), the
inductive complement of deduction, not a user knob. A Scoring Rule, when
present, is a derived/induced fact, never a hand-tuned per-domain heuristic.
Prop 3 (prop:derive): induce is a ρ-application over P that returns
candidate populations as facts in P. The induction posture is Codd 1970
§2.3 itself: a system "might, over a period of time, make attempts to
induce the redundancies, but such attempts would be fallible" — hence
candidates plus a judge, never silent adoption. Note (elysium-audit
sweep): induce has no section of its own in the current paper and never
did in any checkpointed draft — the old "§3 + Theorem 4" citation was
loose; it rides Prop 3's licence and Codd's posture.
-->

## Entity Types
Hypothesis Candidate is an entity type.
Hypothesis Candidate is a subtype of Resource.
Scoring Rule is an entity type.
Scoring Rule is a subtype of Function.

## Value Types
Confidence Score is a value type.
  The data type of Confidence Score is decimal.

## Fact Types
### Hypothesis Candidate
Hypothesis Candidate has Confidence Score.
  Each Hypothesis Candidate has at most one Confidence Score.

Hypothesis Candidate explains Fact.
  Each Hypothesis Candidate, Fact combination occurs at most once in the population of Hypothesis Candidate explains Fact.
HypothesisCandidateExplainsFact objectifies "Hypothesis Candidate explains Fact".
HypothesisCandidateExplainsFact is a subtype of Function.
Hypothesis Candidate has hidden- Fact.
  Each Hypothesis Candidate, Fact combination occurs at most once in the population of Hypothesis Candidate has hidden- Fact.
HypothesisCandidateHasHiddenFact objectifies "Hypothesis Candidate has hidden- Fact".
HypothesisCandidateHasHiddenFact is a subtype of Function.

### Scoring Rule
Recipe Text is a value type.
  The data type of Recipe Text is text.
Hypothesis Candidate targets Fact Type.
  Each Hypothesis Candidate targets exactly one Fact Type.
Hypothesis Candidate has Recipe Text.
  Each Hypothesis Candidate has exactly one Recipe Text.
For each Fact Type and Recipe Text, at most one Hypothesis Candidate targets that Fact Type and has that Recipe Text.
  <!-- extensional identity as EXTERNAL UNIQUENESS (2026-07-17, Samuel's
       ruling: identity through external uniqueness constraints is
       explicitly supported in NORMA — use the canonical mechanism, do
       not hold identity as prose): a candidate IS its target-recipe
       pair (Prop 3; no minting, surrogates are the boundary's
       business). The external UC holds that extensional identity as a
       real constraint; the PREFERRED scheme remains Function(.id) per
       the one-reference-scheme ruling (Halpin 6.7 — subtypes inherit
       the root's identification), so the id space stores while the
       external UC guarantees no two candidates share content. The
       canon's induce:facts emits both identity facts (the recipe rides
       extensionally; Recipe Text's serialization is the registration
       boundary's business, like every surrogate). Def 4's fact
       identity (fact type, tuple) is the same doctrine at instance
       level, held by the canon — a variable-arity tuple is beyond a
       fixed role pair. -->

Scoring Rule applies to Hypothesis Candidate.
  Each Scoring Rule, Hypothesis Candidate combination occurs at most once in the population of Scoring Rule applies to Hypothesis Candidate.
ScoringRuleAppliesToHypothesisCandidate objectifies "Scoring Rule applies to Hypothesis Candidate".
ScoringRuleAppliesToHypothesisCandidate is a subtype of Function.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'induction' has Access 'public'. -->
Domain 'induction' has Description 'Operational vocabulary the induce Func populates and consumes. Hypothesis Candidate per candidate population, Confidence Score per candidate, Scoring Rule per ranking heuristic. Prop 3 (prop:derive) + Codd 1970 §2.3.'.
