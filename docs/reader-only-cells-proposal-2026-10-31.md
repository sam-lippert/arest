# 9j1a: the six reader-only cells, as a CSDP proposal for Sam (step 6)

Lane C, 2026-10-31. Read-only; nothing committed. Sources: the base design-state carrier; the `state:` cells in `_defs` of the 9j0 scratch copies of support and claude (read-only); parser `$T/lc/9j1a/cells.py`, dump `dump.py`. Support's live store has fewer rows than the sizing note said (499 / 108 / 448), a store-version difference, so 9j1b re-counts.

| cell | what it is | proposal |
|---|---|---|
| nestings | a fact type that is missing | "Entity Type objectifies Fact Type", plus "Objectification is implied" |
| qualifiers | a fact type that is missing | "RoleIsUsedInReading has Pre-/Post-Bound Text", or derived from Reading text only |
| refmode kind | declared, half populated | "Reference Mode is of Reference Mode Type", popular derived from facts |
| rpaths | the Join Path family exists but its population check fails | Sam's design, tied to #220 |
| exclusions | existing Constraint/Span objects the compile never writes | no schema change: compile work and a reader fix |
| independent | declared, never populated | make "Object Type is independent" semi-derived (+) |

## 1. NESTINGS → "Entity Type objectifies Fact Type." (NORMA Objectification)

- Rows: base 83, e.g. (ObjectTypeHasPermission, ObjectTypeHasPermission), (ConstraintSpan, ConstraintSpan), (API, API); claude 153; support 469. Every row is (X, X): the objectifying type takes the fact type's id.
- Facts: Entity Type 'API' objectifies Fact Type 'API'. Entity Type 'ConstraintSpan' objectifies Fact Type 'ConstraintSpan'.
- Population check: no type objectifies two fact types; no fact type is objectified twice.
- Constraints: each Entity Type objectifies at most one Fact Type; for each Fact Type, at most one Entity Type objectifies it.
- validation.md:34-40 already speaks of "a Fact Type is objectified" with no fact type behind it.
- Second fact, needed for #6: "Objectification is implied" (NORMA IsImplied). In base 6 of 83 come from an explicit "X objectifies" sentence (API, Constraint Span, DomainConnectsToFederation, RoleInstance, RoleIsUsedInReading, RoleSequenceHasPosition); 77 are implied.

## 2. QUALIFIERS → "Role has Role Name" is wrong by NORMA

- docs/2026-07-10-norma-hyphen-naming-spec.md §A (citing Verbalization.cs:1355-1990): Role.Name is model-level; a hyphen adjective is reading-local and re-parsed from the reading text, which the store already holds (rHypothesisCandidateHasHiddenFact = "{0} has hidden- {1}").
- Rows: base 3: (HypothesisCandidateHasHiddenFact, ("", hidden)), (TransitionIsFromStatus, ("", from)), (TransitionIsToStatus, ("", to)); claude 29 (30 bound words); support 104.
- Proposed: "RoleIsUsedInReading has Pre-Bound Text." and "RoleIsUsedInReading has Post-Bound Text." (NORMA's RoleText cache), at most one each. Fact: RoleIsUsedInReading 'HypothesisCandidateHasHiddenFact.2.rHypothesisCandidateHasHiddenFact' has Pre-Bound Text 'hidden'. Support has 6,359 RoleIsUsedInReading rows.
- Alternative: derived from Reading text, no fact type.
- Findings: read:hyphen_at reads only the leading form (a trailing "{N} -word" is dropped); the cell is keyed per fact type, not per reading, so alternate readings (#205) with different adjectives collide.
- Sam's choice: the stored parse object (#197 direction) or derived only.

## 3. REFMODE KIND → "Reference Mode is of Reference Mode Type."

- Entity Type has Reference Mode exists (core.md:454); support 247 rows, so half modeled.
- Rows: base 78 (77 popular, 1 general), e.g. (API, id, popular, Function_id), (Access Role, Name, general, Name); claude 127 (95 / 32); support 360 (188 / 172). No unit-based rows.
- Proposed: Reference Mode Type values 'popular', 'unit-based', 'general' (NORMA ReferenceModeType); each Reference Mode is of exactly one Reference Mode Type.
- Derivable (CSDP step 3): read:mode_kind (arest:15922) answers popular iff the mode is in a fixed list (Id, id, ID, UUID, Uuid, Name, name, Code, code, Title, title, Nr, nr, #) and no type of that name is declared, otherwise general. So the list should itself be facts (Reference Mode 'id' is of Reference Mode Type 'popular'), and general derived where the mode names a declared Object Type (Access Role's Name is general because Name is a declared value type).
- Column 4 (the value type, e.g. Function_id) derives from the kind and the root's mode; no new fact type.

## 4. RPATHS → the Join Path family (core.md:1693-1762) exists but is empty

- Support: 0 JoinHasRoleSequence, 0 RoleSequenceHasPosition rows, and no state:rpaths cell. Base has 44 heads.
- Example, DerivationRuleDependsOnDerivationRule = joinon(DerivationRuleHasAntecedentFactType, DerivationRuleProducesFactType, [[2,2]], [1,3]): Derivation Rule has Join Path 'jp1'; jp1 has Join j1 (uses DerivationRuleHasAntecedentFactType, Join Type 'inner') and Join j2 (uses DerivationRuleProducesFactType); the condition is a Role Sequence of .2 of each; two Role Projections give the head's roles.
- The population check FAILS on the base sample:
  - (a) 17 of 44 heads have 2-4 recipes (a union), against "Each Derivation Rule has at most one Join Path".
  - (b) 6 are recursive (#base): DomainReachesDomain, StatusReachesStatusInStateMachineDefinition, ...
  - (c) No home for the 26 sel (role = constant), 8 calc, 3 cmp, 3 pairwith.
  - (d) Nothing orders the Joins inside a Join Path.
  - minus (11) has a home: "Join is negated" / "Join Path is negated" (core.md:1857-1859).
- Sam ruled 2026-10-22 (core.md:1762 note) that Derivation Rule becomes a Constraint Type (#220), which moves where a Join Path hangs (in NORMA, on a constraint role sequence and a derivation rule). So this cell's design is Sam's, coupled to #220. No fact types proposed.

## 5. EXCLUSIONS → no new fact type

- These are Constraints of Constraint Type 'XO' or 'XC' spanning the subtype facts' roles (Constraint Span with Sequence Number and Position); support has 298 subtype-fact Role rows.
- Rows: base 2: ((Entity Type,(1)),(Value Type,(1))) and ((Event Type,(1)),(Constraint,(1)),(Derivation Rule,(1))); claude 2; support 9 (Dark/Light Theme, Sans/Mono Family, the 5 views, ...).
- Support's Constraint population has 0 XO and 0 XC rows: the compile never writes them.
- Reader defect: the cell drops exactly-one against at-most-one. core.md:65 is "exactly one" (XO), :123 "at most one" (XC); both read the same shape. Each group becomes one Constraint (XO or XC) with one span per subtype fact, numbered by sequence.

## 6. INDEPENDENT → "Object Type is independent." exists (core.md:560), null on all 82,050 support Function rows

- Rows: base 70 T of 264; claude 135; support 418 (APIAcceptsObjectTypeAsParameter, entity, T).
- Base check: every independent name is a nesting; the 13 nestings not independent are the 6 explicit ones plus 7 whose UC spans n-1 roles (FunctionSendsFactTypeWithRoleToJSONPath, ...).
- So it derives as NORMA has it (Objectification.cs:1082, cited at read:independent_names): an implied objectification whose single internal UC spans every role.
- Proposed: make the unary semi-derived (+), so a user may still assert it as NORMA allows; the rule reads #1's two facts and Constraint Span.

## For Sam

Accept or amend: #1's two readings; #2's home (stored, or derived only); #3's type and its derivation; #6's + marking. #4 is his design, tied to #220. #5 needs no schema change: it is compile work (9j1b) plus the reader's XO/XC fix.
