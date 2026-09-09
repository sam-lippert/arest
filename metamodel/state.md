# AREST State: Behavioral Entities

<!-- Layer (arest-batch task 3): AREST-extension vocabulary end to end —
     Harel statecharts carried through ORM (SMD, Status, Transition,
     Guard, Stream). Not part of Halpin's metamodel; the ORM-canonical
     vocabulary it consumes (Object Type, Predicate, Fact Type,
     Constraint) is declared in core.md. -->

## Entity Types

Status is an entity type.
Status is a subtype of Object Type Instance.
<!-- WAS `subtype of Object Type`, and that made every Status an OBJECT TYPE.
     evolution.md states the established pattern while citing this very type as
     precedent for itself - "the schema-entity-as-Object Type Instance pattern
     (core.md: Event Type, Status, Constraint, Derivation Rule are Object Type
     Instance subtypes)" - so Domain Change followed the pattern and the type it
     was following did not.

     It was invisible until a mandatory could be checked. state:otpops
     materializes inclusion up the subtype chain, so every Status, and every
     State Machine Definition through the subtype link below, landed in the
     Object Type population: 24 of them, including `step5-mandatory` and
     `step7-final-checks`, which are CSDP steps. `Each Object Type is of exactly
     one Object Kind` (core.md) and `Each Object Type has exactly one World
     Assumption` then reported 24 violations each - 48 of the 59 the first
     mandatory run surfaced - all of them phantoms asking a workflow step which
     kind of object type it is.

     A Status is a value a machine can be in, not an object type of the modelled
     domain. Sam: the metamodel should already have clear differentiation
     between value and entity types - and it does; this line was reading the
     instance level as the type level. -->
<!-- STILL OPEN, deliberately not changed here: `State Machine Definition is a
     subtype of Status` below says every state machine definition IS a status,
     which is what carried CSDP, Rmap and Schema Design up the same chain. It is
     a separate ruling and it does not need to be made to fix the 48. -->

State Machine Definition is an entity type.
State Machine Definition is a subtype of Status.
Transition is an entity type.
Transition is a subtype of Function.
Guard is an entity type.
Guard is a subtype of Function.

Stream is an entity type.
Stream is a subtype of Function.

## Readings

### State Machine Definition
State Machine Definition is for Object Type.
  Each State Machine Definition is for at most one Object Type.

### Status
Predicate is performed in Status.
  Each Predicate is performed in at most one Status.
  For each Status, at most one Predicate is performed in that Status.
Status has HTTP Method.
  Each Status has at most one HTTP Method.

### Transition
Transition is defined in State Machine Definition.
  Each Transition is defined in exactly one State Machine Definition.
Transition is from- Status.
  Each Transition is from exactly one Status.
Transition is to- Status.
  Each Transition is to exactly one Status.
Transition is triggered by Event Type.
  Each Transition is triggered by exactly one Event Type.
Predicate is performed during Transition. +
  Each Predicate is performed during at most one Transition.
  For each Transition, at most one Predicate is performed during that Transition.

### Status
Status is initial in State Machine Definition.
  For each State Machine Definition, at most one Status is initial in that State Machine Definition.
Status is defined in State Machine Definition. *
  Each Status, State Machine Definition combination occurs at most once in the population of Status is defined in State Machine Definition.
Status is terminal in State Machine Definition. *
  Each Status, State Machine Definition combination occurs at most once in the population of Status is terminal in State Machine Definition.
<!-- audit-fix D (2026-07-15): DERIVED again. The asserted-form rationale
     that stood here ("a derivation rule asserts only positive facts")
     contradicted both the paper (§Negation: a negated role path over
     settled cells is a finite anti-join; Lem 1 undisturbed) and this
     file's own `rooted` rule, which derives with the same negation
     shape. The real motive was a killed-host parser defect (see the
     history note beside the rule). An asserted sink list can silently
     disagree with the transition graph; the rule cannot. -->

Status is rooted in State Machine Definition. *
  Each Status, State Machine Definition combination occurs at most once in the population of Status is rooted in State Machine Definition.
Status is effective initial in State Machine Definition. *
  Each Status, State Machine Definition combination occurs at most once in the population of Status is effective initial in State Machine Definition.
<!-- sm-retire-forml2: the resolved seed status of a machine. The cardinality
     gate ("exactly one rooted ⇒ initial, else empty") is a non-monotonic
     predicate FORML 2 cannot express (count+`=1` does not compose as a same-rule
     filter; `no Status is initial` is not an antecedent kind — derivation.md
     193-223 / 414-422). So this `*` cell's deriver is an EVALUATOR-PHASE
     OBLIGATION (audit-fix A2): a compiled definition (Def 9, origin
     'compiled') that prefers an explicit `Status is initial in State
     Machine Definition` and else applies the cardinality gate over
     `Status is rooted in State Machine Definition` — the killed host's
     Rust effective-initial helper is the reference behavior, but it does
     not exist in this repo, so until that definition lands the cell is
     unpopulated: the marker names the debt, not a present deriver. The
     seed-branch rule for `State Machine is currently in Status` joins
     against this cell. This is the one deliberate, documented
     non-monotonic remnant — retained, not newly added. -->

### Effective Transition (post-Harel available-transition relation)
<!-- sm-retire-forml2: the post-Harel <from, to, event> available-transition
     relation, multi-valued. REPLACES the Rust Harel expansion + transition_table
     + machine:{noun} + transitions:{noun} (compile.rs compile_state_machine
     11957-12003 fan-out). Rule 1 is the DIRECT declared edge; rule 2 is the
     INHERITED (Harel) edge: because State Machine Definition is a subtype of
     Status, a Transition whose single `from` Status IS the machine super-state
     induces an effective transition out of every child Status defined in that
     machine. Override-suppression (a child's own <event> edge shadowing the
     inherited one) is NOT expressible as a rule (negation is not an antecedent
     kind, and it would recurse through negation over this same FT) — the union
     deliberately over-emits and consumer-side firing precedence prefers the
     DIRECT row. The rules are under "## Derivation Rules". -->
Status has effective Transition to Status on Event Type. *
  Each Status, Transition, Status, Event Type combination occurs at most once in the population of Status has effective Transition to Status on Event Type.

### Guard

<!-- TRANSITION GROUNDEDNESS holds by construction here, so no deontic is
     declared for it. The paper states the condition: "an add or delete may
     not occur under negation or disjunction, and each disjunctive branch
     must carry a positive event; negation may guard a transition but never
     supplies its effect."
     This decomposition separates the two structurally. A Transition's
     EFFECT is carried by `Transition is triggered by Event Type` — exactly
     one, asserted positively — while a Guard only `references Fact Type`
     and `guards Transition`. A Guard therefore has no way to supply an
     effect, and there is no branch of a Transition lacking a positive
     event, because every Transition has exactly one. Negation can only ever
     appear inside a Guard's role path, which is precisely where the paper
     permits it.
     Recorded so the condition is not re-derived and added as a missing
     obligation: written as a deontic it would name no populatable
     violation, the same failure validation.md documents for Subtype
     Constraint Declaration. See core.md's Negation section for the two
     negations themselves. -->
Guard references Fact Type.
  It is possible that some Guard references more than one Fact Type and that for some Fact Type, more than one Guard references that Fact Type.
  For each combination of Guard and Fact Type, that Guard references that Fact Type at most once.
GuardReferencesFactType objectifies "Guard references Fact Type".
GuardReferencesFactType is a subtype of Function.
Guard guards Transition.
  Each Guard guards at most one Transition.
  It is possible that more than one Guard guards the same Transition.

## Derivation Rules

<!-- arest-batch ruling 5: Moore and Mealy are two views of one
     operation. Moore -> Mealy is the monotone direction (an action
     attached to a status is performed by every transition entering it),
     so the Mealy relation is semi-derived (+): directly assertable for
     genuine per-edge actions AND populated from Moore assertions by the
     rule below. The reverse direction needs universal quantification —
     out of the monotone fragment. The per-transition uniqueness doubles
     as a conflict detector between an edge's own asserted action and its
     target status's derived action.
     audit-fix A5 (datalog-paper convention): a semi-derived rule states a
     SUFFICIENT condition only — "if", never "iff". The iff reading is the
     closed-world closure over all rules of a fully-derived head; a `+`
     head has asserted rows no closure can claim. -->

+ Predicate is performed during Transition if that Transition is to some Status and that Predicate is performed in that Status.

<!-- Moore and Mealy are two views of one machine (ruling 5) and both are
     first-class: a state action is asserted `Predicate is performed in Status`
     (the rule above derives its edge view), a genuine edge action is asserted
     `Predicate is performed during Transition` and is NOT performed in the
     transition's target status. Mixing the two styles in ONE machine is a
     style smell, not an error, so it is flagged deontically -- the write still
     succeeds. The negated clause is what separates a real edge action from a
     derived edge row: a derived row IS in the target status, so a pure-Moore
     machine never trips this and a pure-Mealy machine has no state action to
     trip it -- only a machine doing both flags. -->
It is obligatory that if some Predicate1 is performed in some Status1 and that Status1 is defined in some State Machine Definition and some Predicate2 is performed during some Transition and that Transition is defined in that State Machine Definition and that Transition is to some Status2 then Predicate2 is performed in Status2.

* Status is defined in State Machine Definition iff some Transition is defined in that State Machine Definition and that Transition is from that Status.

* Status is defined in State Machine Definition iff some Transition is defined in that State Machine Definition and that Transition is to that Status.

* Status is terminal in State Machine Definition iff that Status is defined in that State Machine Definition and no Transition is defined in that State Machine Definition where that Transition is from that Status.
<!-- audit-fix D: restored, mirroring `rooted`. History: the killed host's
     parser stripped the `no ... where ...` clause (AbsenceOf detection
     removed 2026-05-19, parse_forml2.rs), compiling this rule to
     `terminal == defined` (verified wrong live: 32/32), and the 2026-06
     response demoted the cell to asserted under a rationale the paper
     does not support. Evaluator-phase gate obligation: negated-clause
     rules compile faithfully or refuse loudly — never strip-and-fall-back. -->


<!--
  #759 / Audit MC3b-a: normalized SM derivation rules covering Pass 1
  / 2 / 2b of the Rust function `derive_state_machines_from_facts`
  (compile.rs:372-507). Together with the existing transition-driven
  derivation above, these rules let the SM cell be populated from
  instance facts via the engine's forward-chain — no Rust path needed.
  The existing JSON-blob StateMachine cell stays live as fallback
  until #761-#763 swap consumers over and #763 deletes the typed
  StateMachineDef + the Rust function.

    Pass 1 (compile.rs:376-383): instance facts of the form
      `State Machine Definition 'X' is for Noun 'Y'`
    already register the SM record by virtue of the FT itself; no
    derivation rule needed.

    Pass 2 (compile.rs:385-401): an `initial in` declaration entails
    that the same Status is defined in the same SM. The rule below
    fires whenever the parser captures the initial-marking fact,
    populating `Status_is_defined_in_State_Machine_Definition` so
    downstream consumers see initial Statuses without the Rust path.

    Pass 2b (compile.rs:403-415): a non-initial
      `Status 'S' is defined in State Machine Definition 'X'`
    instance fact is a direct assertion the parser already routes
    into the same cell; no derivation rule needed (Status is defined
    in SM is `*` in the FT declaration above for the transition-driven
    derivation, but assertable instance facts still land in the cell
    per the parser's normal instance-fact pathway).
-->

* Status is defined in State Machine Definition iff that Status is initial in that State Machine Definition.

* Status is effective initial in State Machine Definition iff that Status is initial in that State Machine Definition.

* Status is effective initial in State Machine Definition iff that Status is rooted in that State Machine Definition and no Status is initial in that State Machine Definition.
<!-- residue fix (2026-07-16): the effective-initial rules, which never
     existed (the marker's named debt): the declared initial when present,
     else the graph-derived root — the Pass-4 source-never-target fold the
     comment below documents. Recipes in the canon's rules:metamodel: the
     second rule is minus over a joinon (rooted rows in SMDs that declare
     no initial), stratified. -->

<!--
  #760 / Audit MC3b-b: Pass-4 graph-derived initial Status. Mirrors
  the source-never-target topology fold in
  `derive_state_machines_from_facts` at compile.rs:479-505.

  A Status is "rooted" in a SM iff it is the source of some Transition
  in that SM and no Transition in that SM has it as target. The
  consumer side (#761 — `compile_state_machine`) promotes a single
  rooted Status to `is initial in` ONLY when the rooted set has
  cardinality 1; ambiguity (multiple rooted, zero rooted, or cycles)
  leaves the SM without an inferred initial — the same behaviour the
  Rust path implements at compile.rs:502-504.

  Two things the rule is NOT able to express on its own and that the
  consumer side (#761) must therefore implement:

  (1) Uniqueness gate. FORML 2 derivations are monotonic — "exactly
      one rooted Status per SM" is a cardinality predicate, not a
      join. Per task #760's option (a) we deliberately stop short
      and emit every candidate; the consumer applies cardinality.

  (2) Strict set-difference negation. The parser currently strips
      the leading `no` and the trailing `where …` clause and falls
      back to resolving the bare FT (parse_forml2.rs:1184-1194), so
      the negative antecedent does not produce an `AbsenceOf` source
      — only the explicit `_cwa_negation_…` synthetic rules in
      compile.rs:2546-2599 currently emit AbsenceOf, and only for
      CWA nouns. Until parser-side negation lands as a follow-up,
      this rule over-emits for source-AND-target Statuses; the
      consumer's cardinality gate filters that case naturally
      (over-emit ⇒ |rooted| > 1 ⇒ no initial inferred ⇒ same end
      result as the Rust path's "ambiguous" branch).

  See task #760 report for grammar coverage notes.
-->

* Status is rooted in State Machine Definition iff some Transition is defined in that State Machine Definition and that Transition is from that Status and no Transition is defined in that State Machine Definition where that Transition is to that Status.

<!-- sm-retire-forml2: post-Harel effective-transition relation. Rule 1 is the
     DIRECT declared edge (the literal Transition from its single `from` Status).
     Rule 2 is the INHERITED / Harel edge: State Machine Definition is a subtype
     of Status, so a Transition whose single `from` Status IS the machine
     super-state induces an effective transition out of every child Status that
     is defined in that machine. The two from-roles never collapse: rule 2's
     first antecedent types the from-value as a State Machine Definition entity,
     so it fires ONLY when the from-Status is itself a machine; the child clause
     then ranges over that machine's members via the already-derived
     `Status is defined in State Machine Definition` cell. Noun-scoping is
     intrinsic (the join is through the SMD), preserving #813 — shared status
     names never cross-attach. The union over-emits a child's overridden edge
     (direct + inherited); firing precedence (consumer-side) picks the direct
     row, the affordance path tolerates the extra legal row. -->

* Status1 has effective Transition1 to Status2 on Event Type iff Transition1 is from Status1 and Transition1 is to Status2 and Transition1 is triggered by Event Type.

<!-- sm-retire-forml2 RULE 2 (Harel inherited edge), now ENABLED. State Machine
     Definition is a subtype of Status, so a Transition whose single `from`
     Status IS the machine super-state induces an effective transition out of
     every child Status defined in that machine. This was previously blocked:
     compute_ring_join_plan (parse_forml2.rs) dropped the `State Machine
     Definition1` token (a Status subtype) from the `Transition is from Status`
     arity count, so the ring plan bailed and the rule derived 0 inherited rows.
     The planner now accepts a subtype filler in a supertype-typed role (the
     supertype_chain walk), mirroring the existing subtype bridge in
     resolve_derivation_rule, so the rule fires. Noun-scoping is intrinsic (the
     join threads through the SMD), preserving #813 — shared status names never
     cross-attach. The union over-emits a child's overridden edge (direct +
     inherited); consumer-side firing precedence picks the direct row. -->
* Status1 has effective Transition1 to Status2 on Event Type iff Transition1 is from State Machine Definition1 and Transition1 is to Status2 and Transition1 is triggered by Event Type and Status1 is defined in State Machine Definition1.

<!-- arest-audit C: transitive reachability over declared transitions,
     feeding the Liveness obligation under ## Constraints. -->

* Status1 reaches Status2 in State Machine Definition iff some Transition is defined in that State Machine Definition and that Transition is from Status1 and that Transition is to Status2.

* Status1 reaches Status3 in State Machine Definition iff Status1 reaches Status2 in that State Machine Definition and Status2 reaches Status3 in that State Machine Definition.



## Constraints

For each Object Type, at most one State Machine Definition is for that Object Type.
For each State Machine Definition, at most one Status is initial in that State Machine Definition.
  <!-- reworded 2026-07-17 (no-guessing ruling): the old phrasing ("has
       exactly one initial Status") matched no declared reading and rode
       the fit-scorer onto is-initial-in; the sentence now speaks the
       declared reading's own direction. At-most-one: the initial status
       is optional at declaration (effective-initial falls back to the
       root), so the old "exactly one" overstated the model. -->
For each State Machine Definition, some Status is defined in that State Machine Definition.
<!-- exec-4 (2026-07-15): NORMA's NotWellModeledSubsetAndMandatory
     resolution (2) — the initial-implies-defined subset plus the
     mandatory initial Status requires the superset role mandatory too.
     Semantically right on its own: a machine with no defined Status is
     vacuous. The defined population is derived from transitions, so
     this evaluates after the closure. -->
It is obligatory that for each State Machine Definition, some Status is terminal in that State Machine Definition.
If some Status is initial in some State Machine Definition then that Status is defined in that State Machine Definition.

### Liveness (AREST.tex, after Thm 2)

Status reaches Status in State Machine Definition. *
  Each Status, Status, State Machine Definition combination occurs at most once in the population of Status reaches Status in State Machine Definition.

It is obligatory that if some Status1 reaches Status1 in some State Machine Definition then some Status2 reaches Status1 in that State Machine Definition and Status1 reaches Status2 in that State Machine Definition and some Transition is defined in that State Machine Definition and that Transition is from Status2 and that Transition is to some Status3 and it is not true that Status3 reaches Status2 in that State Machine Definition.
<!-- arest-batch ruling 6 (fidelity over improvement — replacing the
     audit-C strengthening, which was denied): the paper's sentence is
     "the deontic obligation that each cycle carry some exit transition"
     (AREST.tex, after Thm 2), formalized at status granularity: a cyclic
     Status (one that reaches itself) shares a mutually-reaching component
     with some Status2 that has a Transition to a Status3 that does not
     reach back — an edge leaving the strongly connected component.
     Trap-freedom exactly; no termination demand. The single negated
     clause is constraint-side (evaluated, never chained; Lem 1
     untouched). A stricter policy — every cyclic status reaches some
     terminal Status — remains available as an app-level deontic. -->

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'state' has Access 'public'. -->
Domain 'state' has Description 'Status, Transition and Guard as a Mealy machine over Object Type Instances: a State Machine Definition is for an Object Type, and an Event Type causes a Transition whose Guard decides it.'.

<!-- task-965 lift (shipped 6393ceb3): the HATEOAS destructive-affordance
     rule, lifted from a Rust literal (command.rs http_method_for_status)
     into a reading. A transition whose target Status has a declared HTTP
     Method surfaces with that method; all others default to GET. -->
Status 'deleted' has HTTP Method 'DELETE'.
