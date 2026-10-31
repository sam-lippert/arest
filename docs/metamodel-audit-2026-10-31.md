# Lane F: metamodel consistency audit (Phase 1 only, 2026-10-31)

Tree: main 3dcd5ad7, in worktree tmp/lf/wt (branch lane-metamodel). **No commits made.** Phase 2 was stopped by the coordinator before it began.

## Machine evidence over the base (main 3dcd5ad7)

**Compile-store of ../../metamodel** (tmp/lf/cs0.out, the store in tmp/lf/bs0):
- 15,342 rows; alethic_clean T.
- The carriers are a fixpoint: design-state and compiled are byte-equal to tools/carriers/base.
- Diagnostics:
  - UNDECLARED DERIVED FACT TYPE: 1. ingest.md:83's `Webhook Event yields Fact`.
  - UNRESOLVED: 2 clauses, both in that same rule.
  - COLLISIONS: 1, `apply`. It is a Transition in evolution (csdp.md:227) and an Operation and a Function in resolution (resolution.md:87, :838).
  - value_cycle: none.

**Kernel V over the base** (UnitRun +kernel, k:V . k:boot): **2184** violations, which match lane D's count.

| Count | Constraint | Item |
|---:|---|---|
| 675 | MC:e:ObjectTypeInstanceHasReference#1 | lane C's retirement |
| 599 | MC:e:ObjectTypeInstanceIsInstanceOfObjectType#1 | |
| 599 | MC:e:ObjectTypeInstanceIsInvolvedIn…IsInstanceOfObjectType#1 | |
| 258 | MC:e:ObjectTypeHasWorldAssumption#1 | |
| 19 | MC:e:ConstraintSpanHasPosition#1 | F1 |
| 19 | MC:e:ConstraintSpanHasSequenceNumber#1 | F1 |
| 4 | MC:e:FactTypeHasReading#1 | F4 |
| 4 | MC:e:FactTypeHasRole#1 | F4 |
| 1 | MC:e:FactTypeHasRole#2 | F4 |
| 3 | DEO:m:ConstraintIsInvolvedInConstraintSpan#1 | F2, the imports.md deontics |
| 1 | MC:e:ObjectTypePlaysRole#2 | |
| 1 | MC:e:RoleIsInvolvedInRoleIsUsedInReading#1 | |
| 1 | MC:e:RoleIsUsedInReading#1 | |

The last three single violations are F4's role .3 of StatusReachesStatusInStateMachineDefinition.

The run of k:unbuilt and ui:violations was killed at the stop, so today's ui:violations count was not measured in this lane. Today's validate is the compile's alethic_clean T.

**App stores**, copied read-only to tmp/lf/stores (claude, tasks, qa, pm, engineering, support):
- WebhookEventTypeYieldsFactTypeWithRoleFromJSONPath has **0 rows in every store**.
- auto.dev's "Webhook Event Type 'x' yields …" sentences are already filed under core's `Function yields Fact Type with Role from JSON Path`. Webhook Event Type is a Function subtype, so the general reading took them. Support holds 257 such rows.
- Support also holds **6 rows** of the old `Webhook Event Type belongs to External System`: the six Stripe event types, all 'stripe'.
- The auto.dev library's readings use ingest's vocabulary:
  - auth.md:119, `Webhook Event is for Subscription`;
  - stripe.md:242, `Webhook Event is backed by Federation`, and stripe.md:270;
  - plans-subscriptions.md:685-722.
- So retiring ingest.md means migrating auto.dev's readings, not just dropping the file. See item 1.

## Numbered list

Each item gives the file:line, the inconsistency, the source that settles it, and the fix. FOR SAM marks a design choice the sources leave open.

### Decided by Sam (ready to apply)

**1. ingest.md (whole file): superseded by federation.**
- Sources: Sam, 10-31; federation.md:80-90 and :138.
- Fix, in arest:
  - delete ingest.md;
  - move `JSON Path is a value type` (ingest.md:23) to core.md beside `Function yields …`, since core.md:1300 and federation.md:94-131 use it;
  - drop Payload.
- Fix to the coverage deontic (ingest.md:73-79). Measured: moved unscoped onto `Function yields Fact Type with Role from JSON Path`, it would fire on exactly three Functions, each a performed predicate whose subject role main:performed binds:
  - sendSupportEmail (approve), yielding only EmailMessageHasResendId.2;
  - draftSupportReply (accept, redraft);
  - claude's 'affect step' (excite).
- core.md:1314-1320 says such a receipt need not cover every role. So restate the deontic, scoped:
  - Text: 'It is obligatory that each Function that yields some Fact Type and is performed in no Status and during no Transition maps every role of that Fact Type from some JSON path';
  - span: FunctionYieldsFactTypeWithRoleFromJSONPath.1, with its Sequence Number and Position;
  - lambda: decide:webhook_coverage (arest:11241-11244) becomes decide:yield_coverage. It reads FunctionYields… less the Functions in PredicateIsPerformedInStatus.1 and PredicateIsPerformedDuringTransition.1. Rename it in decide:deciders (arest:10607) and main:w2_dec_reads (arest:29488).
  - Measured: this scoped form gives 0 violations on every app store.
- Comment fixes: core.md:1304-1320 and :1344-1356 cite ingest.md:49 and :58.
- Migration outside arest (auto.dev, which support composes; not in this lane's authority):
  - `Webhook Event Type 'x' belongs to Federation 'stripe'` becomes `Function 'x' is backed by Federation 'stripe'` (core.md:1271);
  - `Webhook Event` becomes a Response (federation.md:146), or auto.dev declares its own Webhook Event;
  - the 6 support rows move with it.
  - Land the auto.dev change together with the metamodel change, or support's next compile drops those sentences.
- This also removes the compile's undeclared/unresolved diagnostics and the F4 member WebhookEventYieldsFact.

**2. csdp.md:227-234: the collision `apply`.**
- Problem: Transition 'apply' (Domain evolution) and Function or Operation 'apply' (resolution.md:87, :838, the mu's own apply combinator) are one id in one id space.
- Source: core.md:810-833, the metamodel's own 'function-declared-in-one-domain'; Sam, 10-31.
- Fix: rename the Transition, the side whose name is a local choice, to 'apply-design', after 'complete-design'. Update csdp.md:227-232 (four Transition facts and the Predicate 'remap touched tables' line), the lambda/tests that name Transition 'apply' (the cddbdb78 fixtures: grep `"apply"` beside SchemaDesign), and any runtime Event rows (check the stores first).
- The compile reports no other collision.

**3. instances.md:262: `Each User has exactly one Email` becomes `Each User has at most one Email`.**
- Sources: Sam, 10-31; organizations.md:58.
- Also fix:
  - instances.md:264-266 ("mandatory 1:1 secondary reference");
  - core.md:60-61 ("User has Email — mandatory 1:1"). Line 60 shares a sentence with lane C's `Object Type Instance has Reference`, so coordinate.
- Elsewhere: listAuthVinAdmins, listAuthVinPastDueUsers and listRecordingsSince in support yield UserHasEmail; they are not affected.

**4. apps/claude/readings/conceptual-types.md:19: `Value Type 'Arity' has Conceptual Data Type 'unsigned'` is stale.**
- Source: Arity has no declaration since 78eb74ad (Sam, 10-31).
- Fix: delete the line, with a signed commit in apps/claude. Not done.

**5. 9j1a (Sam approved (a), (c), (d)). The readings to add, with one conflict found.**
- (a) `Entity Type objectifies Fact Type.`, with "Each Entity Type objectifies at most one Fact Type." and "For each Fact Type, at most one Entity Type objectifies that Fact Type." (NORMA Objectification).
  - **CONFLICT, FOR SAM:** "Objectification is implied" needs an Objectification object. Objectifying this 1:1 binary breaks the metamodel's own rule 'objectification-needs-spanning-uniqueness' (validation.md:40; Halpin, "Objectification and Atomicity", 2020: 1:1 objectification retracted).
  - Options:
    - (i) a unary on Fact Type, `Fact Type is implicitly objectified` (recommended; the link is 1:1, so NORMA's IsImplied is a property of either end);
    - (ii) a unary on Entity Type;
    - (iii) objectify anyway and exempt it.
- (c) `Reference Mode Type is a value type`, with values 'popular', 'unit-based' and 'general' (NORMA ReferenceModeKind), and `Reference Mode is of Reference Mode Type. +` with "Each Reference Mode is of exactly one Reference Mode Type."
  - The popular modes are instance facts; general is a subset rule in the World Assumption pattern of core.md:515-517: "If some Reference Mode is some Object Type then that Reference Mode is of Reference Mode Type 'general'".
  - Note: 'Name' and 'Title' are declared value types in the base (core.md:297, :359), so they must not be popular instance facts, or "exactly one" fails. Popular is then Id, id, ID, UUID, Uuid, name, Code, code, title, Nr, nr, #. An app that declares 'Code' would then answer a violation where read:mode_kind silently says general.
- (d) `Object Type is independent` becomes `+`. NORMA's rule (Objectification.cs:1082: an implied objectification whose single internal UC spans every role) needs "every role", which is universal quantification outside FORML's monotone fragment.
  - **FOR SAM:** (i) a lambda deriver, as instances.md:315 has for State Machine is for Object Type Instance, with the marker kept; (ii) a counting form, once one is admitted.
- 9j1b (the compile and the law that the facts equal the cells: nestings 83, refmode kinds 78, independent 70) was not started.

### Machine findings

**6. F1: 19 Constraint Spans the readings assert lack Sequence Number and Position.**
- Where:
  - core.md:830, :871, :1104, :1620, :1667;
  - state.md:241, :485;
  - validation.md:26, :43, :77, :144, :194, :204, :211, :282, :298, :305;
  - security.md:129;
  - ingest.md:76.
- Problem: they violate core.md:648-651. The note at core.md:1660-1661 ("a span the readings state without its numbers … says nothing about sequences") excuses what the mandatory forbids.
- Source: core.md:648-651; NORMA (a role sequence is always ordered).
- Fix: for each, add `Constraint Span '<constraint>.<role>' has Sequence Number 1.` and `… has Position 1.`, the span id being as the store mints it, for example 'function-declared-in-one-domain.FunctionIsDeclaredInDomain.1'. Delete the excusing sentence at core.md:1660-1661.
- Expected V: −38.

**7. F2: imports.md:114-117. The three deontics span no role, and the compile gives them a recipe instead (kernel note at kernel:265).**
- Source: core.md:30 / CLAUDE.md ("spans a set of roles … a Constraint Span with a Position per role"); state.md:445 already shows the form that builds a deontic subset.
- Fix: restate them as
  - "It is obligatory that if some Predicate is exported from some JS Package then that Predicate has some Module Path." and the same for Symbol Name;
  - "It is forbidden that some Predicate is exported from some JS Package and that Predicate is backed by some Federation." (a deontic exclusion).
- Expected V: −3. Check that the compile gives role spans.

**8. F4: derived fact types with no Fact Type has Reading / has Role rows.**
- Which: StatusHasEffectiveTransitionToStatusOnEventType (state.md:172), StatusReachesStatusInStateMachineDefinition (:461, and its role .3), TransitionExitsStatusInStateMachineDefinition (:114), and WebhookEventYieldsFact (item 1).
- Measured: all three are in state:readings, state:derived, state:rpaths, state:nestings and state:mapinputs but **not in state:declared**. StatusIsRootedInStateMachineDefinition has the same shape but is not flagged.
- Judgement: this is the reflection or kernel declaration path (code), not the readings. The readings declare each with its UC.

### Contradictions and reversed rulings

**9. state.md:105-112 says "audit-fix D: DERIVED again", directly under :99-103 ("DECLARED, NOT DERIVED (Sam, 2026-10-27)").**
- The declaration is unmarked (asserted).
- Fix: delete :105-112.

**10. State Machine Definition is a subtype of Status, which state.md:34-44 retired.** Comments still claim it:
- state.md:164-170, :312-318, :394-407, :411-423;
- core.md:137-142 (audit A), core.md:143-149 ("Status is a subtype of Noun"; Status is a subtype of Object Type Instance, state.md:12);
- instances.md:286;
- validation.md:238 (one of the "four" counterexamples is gone).
- Fix: the comments, to the declared `Status has sub-machine State Machine Definition`.

**11. Wrong subtype chains in comments: "Fact Type < Object Type Instance < Noun < Function" (instances.md:21, :97, :109, :467).**
- Core declares Fact Type < Event Type < Function (core.md:105-106), and instances.md:15-25 itself says Object Type Instance is not under Noun.
- Fix: the comments.

**12. core.md:486-492 lists `Derivation Rule introduces values` as carrying the same `+`, but core.md:1158 is unmarked.** Its own note (:1159) says "NO `+`", then :1175 says "Semi-derived".
- Fix: drop it from the :490 list and drop "Semi-derived" at :1175.

**13. core.md:2244 cites "`For each Reading, exactly one Fact Type has that Reading`", but the constraint is at most one (core.md:596).**
- Fix: the comment.

**14. validation.md:286-291 says instances.md's `Object Type Instance has Reference` was retired, but instances.md:212 declares it.** This is lane C's retirement; the comment becomes true when it lands.

**15. core.md:1226-1232 says "A TERNARY, NOT AN OBJECTIFIED BINARY", against :1248-1250, which says "OBJECTIFIED THE WAY `Function has Header` ALREADY IS".**
- Function has Header is now `Function sends Header` (:760), not objectified.
- Fix: delete :1248-1253.

**16. state.md:300-306 says "Status is defined in SM is `*`", but it is `**` (state.md:96).**
- The same `*`-wording slip is at instances.md:110 and outcomes.md:32 and :55 (all are `**`).
- Fix: the comments.

**17. state.md:324-326 cites a core.md subset constraint that does not exist** ("If some State Machine is currently in some Status then that Status is defined in …").
- Fix: delete the citation, or restore the constraint (FOR SAM: it was retired at some point).

**18. core.md:2529-2530 says "ANS preserved as a separate kind", but there is no ANS row.**
- Fix: the comment.

### Duplicates and redundancies

**19. state.md:95 and :438: the same UC, "For each State Machine Definition, at most one Status is initial in …", stated twice.**
- Fix: remove :95 (keep :438 with its note).

**20. outcomes.md:104-105 duplicate :37 and :59 exactly.**
- Fix: remove the "## Constraints" block at :102-105.

**21. core.md:1430 `Derivation Rule is an entity type.` duplicates core.md:190.**
- Fix: remove :1430.

**22. FOR SAM: an alethic constraint plus its own deontic restatement, so the deontic can never be violated.**
- Where: core.md:1943 with :1951 (Migration produces some target), and csdp.md:89 with :154 (Schema Design has exactly one Rationale).
- Both pairs come from Sam's initial import 0af4c279.
- Options: keep the alethic one (a write lacking it is refused), or keep the deontic one (it warns and commits).
- Recommendation: Rationale deontic (a design may be proposed before it is justified) and Migration alethic.

**23. core.md:1710-1712 and :1769-1770, `Fact Type has Derivation Storage Type` ('stored', 'derived', 'derived-and-stored'), duplicates `Fact Type has Derivation Mode` (core.md:375-399, :609).**
- Two fact types for one property, and they can contradict each other (fully-derived with 'stored').
- Source: core.md:398 (NORMA's two enums, which Derivation Mode flattens).
- Fix: retire Derivation Storage Type, after checking stores for rows. It is from the 0af4c279 import, so it could be FOR SAM, but the sources settle it.

**24. FOR SAM: core.md:2102-2103, `Textual Constraint has Text`, is a subtype redeclaring its supertype's `Constraint has Text` (core.md:965).**
- This is the theft class core.md:729-732 warns of.
- Options: retire it and give Textual Constraint a deontic that requires a Text; or keep it.

**25. FOR SAM: two value types for one concept, `URL` (core.md:257; Federation has URL) and `Url` (federation.md:47; Source has Url, Response is from Url).**
- Merging them renames fact type ids (SourceHasUrl, ResponseIsFromUrl), which is a data migration in the apps.

### Fact-type shape against Halpin, NORMA and the one-root ruling

**26. FOR SAM: csdp.md:309-313, Relational Schema, Table, Column, Table Key and Table Reference, have no supertype.**
- So they have no reference scheme, against core.md:45-61, :127-136 (ruling 1: one root, Function(.id)) and federation.md:18-23.
- Also federation.md:146 (Response).
- Options:
  - make each a subtype of Object Type Instance, and restate `Table has Name` and `Column has Name` (csdp.md:342-344, :375-377) over Function has Name. They would otherwise be stolen by it (core.md:729).
  - or amend core's "ONLY reference mode" ruling to admit them.

**27. core.md:45-61 says Function(.id) is "the ONLY declared reference mode", but there are two others.**
- verbalization.md:172 `Verbalization Pattern(.name)` is a subtype of Object Type Instance, which is exactly the §6.7/§10.4 case core strips. Fix: drop (.name).
- security.md:98 `Access Role(.Name)` has no supertype. FOR SAM: make it a subtype of Object Type Instance and drop (.Name) (AccessRoleHasName is used by lane D's ld:fx and tests), or note the exception in core.

**28. FOR SAM: core.md:405-407 and :2572-2581, the Constraint Type families against Halpin and NORMA.**
- Problem:
  - `Set Comparison Constraint` (core.md:163) is derived from family 'set-comparison' = {XO, XC, OR};
  - Halpin ch. 6 and NORMA SetComparisonConstraint are {Subset, Equality, Exclusion};
  - NORMA's inclusive-or is a disjunctive MandatoryConstraint;
  - exclusive-or is an exclusion coupled with a mandatory.
- So SS and EQ are left out and OR is wrongly in.
- Options:
  - re-family SS and EQ to 'set-comparison' and OR to 'mandatory', checking lambda's family readers first;
  - or redefine the derived subtype over {'set-comparison', 'subset', 'equality'} less OR.

**29. FOR SAM: instances.md:301-302, `State Machine is for Object Type Instance`, has a UC on role 2 only.**
- So one machine may be for many instances, while the id is minted per instance (`sm.<id>`, :333-337).
- Option: add "Each State Machine is for exactly one Object Type Instance."

**30. imports.md:107-108: `JS Package reaches JS Package *` has only its base rule.**
- Problem: reaches equals depends-on, so the transitive ring at :108 fails on every two-step chain. The comment at :101-103 promises "the closure as a biconditional", following core.md:1468-1474.
- Fix: add "* JS Package1 reaches JS Package3 iff JS Package1 depends on JS Package2 and JS Package2 reaches JS Package3."

### Verbalizations (FORML 2 against the formal shape; Sam, 10-31)

**31. core.md:708-709 use an undeclared reverse reading, "Predicate references Fact".**
- Fix: "It is possible that some Fact is referenced by more than one Predicate." and "It is possible that more than one Fact is referenced by the same Predicate."
- Same class:
  - imports.md:77, "some JS Package exports", becomes "It is possible that more than one Predicate is exported from the same JS Package.";
  - instances.md:151, "some Predicate can create".

**32. core.md:1341, "Each Function, Fact Type, Role combination occurs at most once.", names no fact type.**
- Fix: "… occurs at most once in the population of Function sends Fact Type with Role to JSON Path." (ingest.md:50 has the same; it goes with item 1).

**33. outcomes.md:129 and :131 lack the quantifier and anaphora.**
- Fix: "** Violation belongs to Domain iff that Violation is against some Function and that Function belongs to that Domain." (and the same for Failure).
- Verify that the recipe is unchanged.

**34. verbalization.md: the patterns contradict the metamodel they claim to quote (:159-161 says "every example is a sentence this metamodel already speaks").**
- :298: the example reverses core.md:1468. It should be "Domain1 reaches Domain2 iff Domain2 is contained in Domain1."
- :302: 'derivation-semi' is written "iff", against state.md:213-216 (a semi-derived rule says "if"). Fix: "+ A R B if A S B.", example security.md:106.
- :268: the 'subset' example is the asymmetric ring sentence (core.md:1138). Fix: use core.md:1084.
- :315-316: "Transition t is triggered by Fact Type f" does not match state.md:75 (… by Event Type). Fix: use Event Type.
- :309: the deontic example is not the metamodel's sentence (core.md:868). Fix: use core.md:565.
- :291: the objectification example is not in the metamodel. Fix: use core.md:646.
- :167-168: stale line citations.

**35. core.md:1118, "… then that API accepts that subtype Object Type as parameter", does not read as FORML.**
- "that subtype Object Type" has no antecedent.
- Fix: "If some API accepts some Object Type1 as parameter and some Object Type2 is subtype of that Object Type1 then that API accepts that Object Type2 as parameter."

### Stale names and citations (comments only)

**36. Stale names and line numbers in comments.**
- "External System": security.md:114-115, core.md:2289.
- "evolution.md": outcomes.md:78-82, resolution.md:43, core.md:953.
- "compile.rs" and "check.rs": throughout.
- Line numbers: core.md:167, :1009, :1013, :1448-1450, :2246, :2290; verbalization.md:167-168.
- csdp.md:55: a stray "." after the comment.
- Fix: the comments only.

## Git history

217 of the 218 commits touching metamodel/ carry Claude trailers. The only exception is the import 0af4c279 (Sam, 07-14). The audit above checks the current text, which is what those edits produced. The blame of each duplicate:
- items 19-24 and 22 come from the 0af4c279 import (Sam's text), or from moves of it (fd2d9da8, cddbdb78);
- item 9's reversal comes from 8c7c62f3 (AI);
- item 1's theft comes from ingest's original design.

## Not done (stopped by the coordinator)

All Phase 2: no commits, no gate. 9j1b was not started. The apps/claude Arity line was not deleted. The worktree tmp/lf/wt is unchanged.
