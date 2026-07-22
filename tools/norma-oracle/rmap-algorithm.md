# NORMA's RMAP algorithm — the canon transcription source

Extracted from NORMA's own source (Repos/NORMA) with file:line
citations. Sam's ruling: RMAP in canon must match NORMA — this
document is the specification the canon's rmap family transcribes,
decision by decision, certified against norma:tables on every
station. No shortcuts, no comparison-weakening.

## Citation legend (all paths under `C:\Users\lippe\Repos\NORMA\`)
- **FTMTR** = `Oial\ORMOialBridge\FactTypeMapsTowardsRole.cs`
- **OMIFORM** = `Oial\ORMOialBridge\OialModelIsForORMModel.cs`
- **STRUCT** = `Oial\ORMOialBridge\ORMOialBridgeStructures.cs`
- **PERM** = `Oial\ORMOialBridge\ORMOialBridgePermuter.cs`
- **GATE** = `Oial\ORMOialBridge\ORMElementGateway.cs`
- **ASM** = `RelationalModel\OialDcilBridge\AssimilationMapping.cs`
- **FIXUP** = `RelationalModel\OialDcilBridge\OialDcilBridge.DeserializationFixupListeners.cs`
- **NAMEGEN** = `RelationalModel\OialDcilBridge\NameGeneration.cs`
- **NAMEPART** = `ORMModel\ObjectModel\NamePart.cs`
- **REFMODE** = `ORMModel\ObjectModel\ReferenceModeNaming.cs`
- **UTIL** = `ORMModel\Framework\Utility.cs`
- **DSL** = `RelationalModel\DcilModel\DcilModel.dsl`

The pipeline has two stages. Stage 1 (ORM→OIAL/Abstraction), driven by `TransformORMtoOial` (OMIFORM:287): `PerformInitialFactTypeMappings` → `FilterFactTypeMappings` → `FactTypeMappingPermuter.Run` → `GenerateOialModel`. Stage 2 (OIAL→relational/DCIL) is `FullyGenerateConceptualDatabaseModel` (FIXUP:160). "Byte-identical" reproduction must honor the **default `AlgorithmVersion` "1.012"** (OMIFORM:39) and the two-stage split precisely.

---

## Section 0 — GATEWAY FILTER (what participates at all)

**0.1 — Fact types ignored.** `ShouldIgnoreFactType` (GATE:37) returns true (⇒ excluded from every dictionary and loop) iff the fact type is gateway-excluded (`ExcludedORMModelElement` link exists), OR is a `QueryBase`, OR is `IHasAlternateOwner<FactType>`, OR **has a non-null `Objectification`** (the objectified fact type itself is ignored; its implied binary "link" fact types participate instead).

**0.2 — Object types ignored.** `ShouldIgnoreObjectType` (GATE:33): excluded iff gateway-excluded or `IHasAlternateOwner<ObjectType>`.

**0.3 — Gateway exclusion preconditions.** An element is *excluded* (not considered) unless it passes `ShouldConsiderObjectType`/`ShouldConsiderFactType`:
- ObjectType (GATE:99): considered only if it has **no** `ReferenceSchemeError`, `PreferredIdentifierRequiresMandatoryError`, `CompatibleSupertypesError`, `DataTypeNotSpecifiedError`; AND if it has a `PreferredIdentifier`, none of the pid's fact types are excluded (and if objectified, the nested fact type is considered); AND if it is a non-value-type subtype with no pid of its own, a non-excluded primary supertype chain resolving to a pid must exist (GATE:143-175).
- FactType (GATE:212): considered only if no `InternalUniquenessConstraintRequiredError` / `ImpliedInternalUniquenessConstraintError`, not `QueryBase`/alternate-owner; non-subtypes that are fully-derived-not-stored are skipped (GATE:181-201, 224); a unary whose required-negation partner is derived-not-stored is skipped (GATE:234-260); every role player must be non-excluded (GATE:262-272).

**0.3-exact — `IsFactTypeIgnoredForDerivationState` (GATE:181-201).** Ignored iff the fact type has a `FactTypeDerivationRule` with `DerivationCompleteness == FullyDerived && (!ExternalDerivation || DerivationStorage == NotStored)`. Note the asymmetry: an *internal* fully-derived rule is ignored **regardless of storage**; only `ExternalDerivation && Stored` maps. `ExternalDerivation` cannot coexist with an in-store body — `LeadRolePathAddedRule` (`ORMModel\ObjectModel\RolePath.cs:6143-6152`) clears it on any path add at commit. `PartiallyDerived` always maps.

**0.3-canon.** `state:mapinputs` flags 4–6 carry each fact's rule truth (`derivationCompleteness` none|full|partial, `derivationStorage` none|stored|notstored, `externalDerivation` T|F). `rmap:gate` transcribes GATE:187-188 + the subtype exemption (GATE:221): excluded iff ¬subtype ∧ full ∧ (external=F ∨ storage=notstored). `rmap:gmi` filters mapinputs ahead of Section A. Oracle input fidelity for the FORML markers: `+` ⇒ `PartiallyDerived`; `**` ⇒ `ExternalDerivation`+`Stored` with no in-store body (recipe stays parse-side); `*` ⇒ `FullyDerived`+`NotStored`. Input-vacuous arms, to land with their inputs: the unary-negation-partner rule (GATE:229-260; the oracle models no negation unary patterns) and the role-player exclusion cascade (GATE:262-272; object-type exclusions are error-driven and the composition gate certifies zero errors).

**0.4** The model is (re)built by clearing `ConceptTypeCollection`/`InformationTypeFormatCollection` and deleting all `FactTypeMapsTowardsRole` links for the model, then running the algorithm (OMIFORM:198-212). Binarization: non-binary/objectified fact types are asserted away before mapping; each considered fact type has exactly 2 roles (OMIFORM:385). `BinarizedOrSameFactType` is used throughout to resolve a role's participating fact type.

---

## Section A — FACT TYPE MAPPING (direction + depth)

### A.0 Meaning of Shallow vs Deep (STRUCT:35-94, 165-168)
A `FactTypeMapping` records `FactType`, `FromRole`, `TowardsRole`, `InverseFactType`, and `FactTypeMappingFlags`. `MappingDepth` is derived: **Deep** iff the `DeepMapping` (0x1) flag is set, else **Shallow** (STRUCT:165). Semantics:
- **Shallow** = the *content* of the fact (a value, or a reference to the from-object-type's identifier) is absorbed as attribute(s)/relation into the towards-object-type. The from-object-type keeps its own identity.
- **Deep** = the from-object-type is *absorbed into* the towards-object-type (its whole identity/roles migrate there). Deep mappings become `ConceptTypeAssimilatesConceptType` (assimilations = subtype/partition/separation candidates). An object type may have **at most one deep mapping away from it** (enforced in filtering and permutation).

`FactTypeMappingFlags` bit meanings (STRUCT:40-93): `DeepMapping`0x1, `TowardsValueType`0x2, `TowardsRoleMandatory`0x4, `TowardsRoleImpliedMandatory`0x8, `FromValueType`0x10, `FromRoleMandatory`0x20, `FromRoleImpliedMandatory`0x40, `Subtype`0x80, `FromPreferredIdentifier`0x100 (auto-computed in ctor when FromRole is the/part-of preferred identifier), `FactTypeIsNegation`0x200, `InversePairIsMandatory`0x400, `FromRoleSimplePreferred`0x800, `TowardsRoleSimplePreferred`0x1000.

### A.1 Subtype facts → immediately decided one-to-one (OMIFORM:345-369)
For a `SubtypeFact`: `FromRole = SubtypeRole`, `TowardsRole = SupertypeRole`. Flags = `Subtype` | `FromRoleMandatory` | (`DeepMapping` **unless** the subtype has a generated/auto-counter identifier AND does not itself provide the pid — precisely: deep is set iff `subtypeFact.ProvidesPreferredIdentifier || !EntityTypeIsAutoIdentified(subtype)`) | (`TowardsRoleMandatory|TowardsRoleImpliedMandatory` iff the supertype role carries an *implied* mandatory) | (`FromValueType|TowardsValueType` iff subtype is a value type). Added to `decidedOneToOneFactTypeMappings`. `EntityTypeIsAutoIdentified` (OMIFORM:308) = pid role player is a value type whose data type is `AutoGenerated` and `AutoGenerationIncremental`.

### A.2 Unary facts → immediately decided many-to-one (OMIFORM:370-380)
If `factType.UnaryPattern != NotUnary`: `FromRole = null`, `TowardsRole = UnaryRole`. Flags = `FromValueType` | (`TowardsValueType` iff role player is value type) | inverse flags (A.4) | (`TowardsRoleMandatory` iff role player has an implied-mandatory constraint AND the unary role has a single-role alethic mandatory). Added to `decidedManyToOneFactTypeMappings`. (A unary is intrinsically many-to-one: STRUCT/pattern `OneToMany`.)

### A.3 Binary facts → many-to-one, decided one-to-one, or undecided (OMIFORM:381-704)
Compute per role: uniqueness = single-role alethic internal UC present (`firstRoleIsUnique`/`secondRoleIsUnique`; OMIFORM:396-403); "unique-and-preferred" = that UC `.IsPreferred` (OMIFORM:407-408); mandatory decomposed into explicit/implicit/inherent (OMIFORM:410-417). **Spanning uniqueness** (a 2-role internal UC) is ignored — treated as external (FTMTR:212-214), so a fact spanned by a single spanning UC has *no* single-role uniqueness on either side.

**A.3.0 Inherent-mandatory normalization** (OMIFORM:419-440): if both roles inherently mandatory ⇒ both downgraded to implied; if one inherent + other explicit ⇒ the inherent one downgraded to implied (explicit wins).

Set `possibilityBits` ∈ {`FIRST_SECOND_SHALLOW`=1, `FIRST_SECOND_DEEP`=2, `SECOND_FIRST_SHALLOW`=4, `SECOND_FIRST_DEEP`=8} (naming: `X_Y` = from X to Y):

- **A.3.a Only first role unique** (OMIFORM:453): `SECOND_FIRST_SHALLOW`, `manyToOne=true`. (Map shallow toward the unique side.)
- **A.3.b Only second role unique** (OMIFORM:459): `FIRST_SECOND_SHALLOW`, `manyToOne=true`.
- **A.3.c Both roles unique = one-to-one** (OMIFORM:465):
  - **Ring** (same role player both sides, OMIFORM:468): if only first explicitly mandatory ⇒ `FIRST_SECOND_SHALLOW`; if only second ⇒ `SECOND_FIRST_SHALLOW`; else ⇒ `FIRST_SECOND_SHALLOW`.
  - **Non-ring, neither role explicitly mandatory** (OMIFORM:490): add `SECOND_FIRST_SHALLOW` unless first role is preferred; add `FIRST_SECOND_SHALLOW` unless second role is preferred. (Never shallow-map *toward* a preferred identifier.)
  - **Non-ring, only first explicitly mandatory** (OMIFORM:506): always `SECOND_FIRST_SHALLOW`; additionally, iff (second role player has no implied/inherent mandatory) OR (second role is preferred-and-not-value-type) OR (fact is objectification-implied) (OMIFORM:548): add `FIRST_SECOND_SHALLOW` unless second is preferred, AND add `FIRST_SECOND_DEEP` unless first role player is auto-identified.
  - **Non-ring, only second explicitly mandatory** (OMIFORM:566): mirror image — always `FIRST_SECOND_SHALLOW`; conditionally add `SECOND_FIRST_SHALLOW` (unless first preferred) and `SECOND_FIRST_DEEP` (unless second player auto-identified), gated by the symmetric condition at OMIFORM:603.
  - **Non-ring, both explicitly mandatory** (OMIFORM:621): add `SECOND_FIRST_SHALLOW` unless first preferred; add `FIRST_SECOND_SHALLOW` unless second preferred; add `FIRST_SECOND_DEEP` unless first player auto-identified; add `SECOND_FIRST_DEEP` unless second player auto-identified.

**A.3.1 Classification by bit population** (OMIFORM:651-703): exactly one bit ⇒ decided (`manyToOne? decidedManyToOne : decidedOneToOne`); the single-bit shallow cases carry `manyToOne`. More than one bit ⇒ a `FactTypeMappingList` of all candidates added to `undecidedOneToOneFactTypeMappings`. Each candidate's flags come from `GetFlags` (A.5).

### A.4 Inverse (unary negation pairing) (OMIFORM:707-777, `ResolveInverseFactType`)
For unary/objectified-unary fact types, resolves the paired positive/negation fact type and sets `FactTypeIsNegation` and/or `InversePairIsMandatory` from the `UnaryValuePattern` (Required* ⇒ pair mandatory). Objectified inverse resolves through the unary role proxy; if ignorable, cleared.

### A.5 GetFlags (OMIFORM:778-806)
Given `(deepMapping, fromValueType, fromMandatory, fromImpliedMandatory, towardsValueType, towardsMandatory, towardsImpliedMandatory, fromRoleSimplePreferred, towardsRoleSimplePreferred)` sets the corresponding flag bits; mandatory bits always paired with their implied bit when implied.

### A.6 Undecided resolution cascade — `FilterFactTypeMappings` (OMIFORM:814-822)
Loop **`do { RemoveImpossiblePotentialFactTypeMappings; changed = MapTrivialOneToOneFactTypesWithTwoMandatories>0 } while(changed)`** — order is fixed and repeated to fixpoint.

**A.6.a `RemoveImpossiblePotentialFactTypeMappings`** (OMIFORM:832): collect `FromObjectType` of every *decided* deep 1-1 mapping into `deeplyMappedObjectTypes`. For each undecided list, remove any candidate that is Deep AND whose `FromObjectType` is already in that set (can't deep-map an object type two ways). If a list collapses to 1 candidate ⇒ move to decided.

**A.6.b `MapTrivialOneToOneFactTypesWithTwoMandatories`** (OMIFORM:892): for each undecided 1-1 fact where *both roles have single-role alethic mandatories*: compute `firstRolePlayerHasPossibleDeepMappingsAway` / `secondRolePlayerHasPossibleDeepMappingsAway` via `ObjectTypeHasPossibleDeepMappingsAway`. If exactly one side has *no* possible deep mapping away, deep-map toward that side — but **only if** the chosen towards-role's UC `!IsPreferred` (going toward a pid is left to the permuter). Returns count decided.

**A.6.c `ObjectTypeHasPossibleDeepMappingsAway`** (OMIFORM:992): true iff any played role's fact (≠ excluded fact) has a decided-deep or potential-deep mapping whose `FromObjectType == objectType`.

### A.7 Permuter final resolution — `FactTypeMappingPermuter.Run` (PERM:253-317)
Remaining undecided fact types are resolved by exhaustive permutation per **chain**:

**A.7.a Chaining** (`FactTypeChainer.Run`, PERM:268-274; `BuildChains`/`ProcessObjectType` PERM:79-221): partitions via graph traversal from each unvisited 1:1 fact — for every played role of every reached object type: an **undecided 1:1** or **predecided 1:1 (subtype facts included — chains span the subtype web)** is added to the chain AND traversed through to the other player; a **predecided many-to-one toward the reached object** is attached WITHOUT traversal; anything else ignored. Chain = the connected component; `chain.ObjectTypes` = every object visited.

**A.7.a-reduce `EnsureReasonablePermutations`** (STRUCT:533-727): if the chain's permutation product (Π of candidate-list sizes) exceeds **`MaxReasonablePermutations = 2048`** (STRUCT:438), apply reduction rounds 0..5; in each round, scan undecided lists **backward**; a list where the round's predicate filters all but **exactly one** candidate has that survivor DECIDED (moved to the chain's predecided AND the global predecided/decided dictionaries; product divided); after each full round stop if product ≤ 2048. Round predicates (each returns true = filter the candidate; later rounds duplicate earlier flag checks):
0. toward a **non-mandatory (or only implied-mandatory) value type** from a non-value-type (`Towards*ValueType&!From*` with `!TowardsRoleMandatory` or implied-only);
1. NOT (deep toward a simple-preferred identifier role) — i.e. keep only a non-subtype deep toward a simple identifier when one exists;
2. unbalanced explicit from-mandatory on a non-subtype (map toward the mandatory: filter the from-mandatory candidate) + round-0 duplicate;
3. `FromPreferredIdentifier` unset ⇒ filter (keep only away-from-pid) + rounds 0/2 duplicates;
4. any deep ⇒ filter (prefer shallow) + duplicates;
5. towards-role not first in the fact's role collection ⇒ filter (arbitrary toward-first-role; "truly pathological") + duplicates.
Consequence at the metamodel scale: chains unified through the subtype web put all undecided 1:1s in one chain; with ≥12 undecided the reducer fires — e.g. the XHasName star decides toward-the-entity at round 0, before enumeration.

**A.7.b Enumerate permutations** (`PermuteFactTypeMappings`, PERM:889): recursively pick one candidate per undecided fact; a running `deeplyMappedObjectTypes` set forbids adding a Deep candidate whose `FromObjectType` already has a deep mapping in the partial permutation (so **no object type is deep-mapped in two directions within a permutation**).

**A.7.c `EliminateInvalidPermutations`** (PERM:939-1122) — three filters, in order:
- **Cycles** (PERM:956-1024): per permutation (scanned last-to-first), follow deep mappings hop-by-hop (`FindDeepMappingAwayFromObjectType` checks predecided-1:1 deeps THEN the permutation's own, PERM:319-337); revisiting a fact on the current path ⇒ cycle ⇒ permutation removed.
- **Blocked deeps** (PERM:1026-1042, `IsBlockedDeepMapping` PERM:1123-1151): a deep mapping toward `T` is blocked when `ObjectTypePlaysNonIdentifierFunctionalRoles(T)` is false AND no non-blocked deep continues away from `T` within the same permutation (recursive, cycle-safe after the first filter). Any blocked deep ⇒ permutation removed. `ObjectTypePlaysNonIdentifierFunctionalRoles(X)` (PERM:1153-1201): true iff `X.TreatAsIndependent`, or X plays some role with a single-role alethic **non-preferred** UC whose opposite role is not part of X's own preferred identifier. Consequence: a 1:1 identifier star (many `XHasName` sharing value type `Name`) loses every deep-containing permutation here — only all-shallow survives, before minimization or weights run.
- **Ambiguous deeps across the surviving set** (PERM:1045-1121): if deep-away-from-the-same-object occurs via two different non-subtype fact types in different surviving permutations, or via a subtype fact in one and a non-subtype fact in another, remove all the non-subtype-deep permutations involved ("the choice is arbitrary, so allow none").

**A.7.d `FindSmallestPermutationsInTermsOfConceptTypes`** (PERM:666-743): using `ObjectTypeStates` (predecided vs permutation, must-have-concept-type vs must-not-have-top-level), keep only permutations minimizing **(1) top-level concept-type count, then (2) non-top-level concept-type count** (lexicographic minimization). Exact state machine (PERM:343-664):
- Chain seed (`BeginChainEvaluation`, PERM:519-564): for every predecided many-to-one and one-to-one mapping with `!IsFromPreferredIdentifier` ⇒ towards-object gets `HasPredecidedNonPreferredIdentifierMappingTowards` (4); predecided 1-1 from-side: `FromRole is SubtypeMetaRole` ⇒ `IsSubtype` (1), `Deep` ⇒ `HasPredecidedDeepMappingAway` (8); `TreatAsIndependent` chain objects ⇒ `IsIndependent` (2).
- Per permutation (`BeginPermutation`, PERM:571-599): each mapping with `!IsFromPreferredIdentifier` ⇒ towards-object `PermutationHasNonPreferredIdentifierMappingTowards` (0x10); each `Deep` ⇒ from-object `PermutationHasDeepMappingAway`.
- Masks (PERM:343-410): `MustHaveConceptType` = IsSubtype | IsIndependent | Has(Predecided|Permutation)NonPreferredIdentifierMappingTowards; `MustNotHaveTopLevelConceptType` = Has(Predecided|Permutation)DeepMappingAway.
- Count loop (PERM:675-743): for each chain object with MustHaveConceptType: MustNotHaveTopLevel ⇒ non-top-level, else top-level. A permutation is discarded inline the moment its top-level count exceeds the running minimum (or ties it with more non-top-levels); a strict improvement clears the survivor list. **Survivors keep enumeration order** — which feeds A.7.g's tie rule.

**A.7.e `ChooseOptimalPermutation`** (PERM:771-799): among the surviving smallest set, if >1, compute `GetPermutationPriority` (long) per permutation and pick the **maximum** (sort `order` by `weights[right].CompareTo(weights[left])`, take `order[0]`). If exactly 1, take it.

**A.7.f `GetPermutationPriority` weight (THE FINAL TIE-BREAK)** (PERM:801-865). With `n = mappingCount`: `deepMappingValue=1`, `balancedEntityValue=n+1`, `unbalancedEntityValue=(n+1)*n+1`, `balancedMandatoryValue=unbalancedMandatoryValue=unbalancedEntityValue*n+1`. Sum over mappings (explicit mandatory only — implied ignored, STRUCT `*ExplicitlyMandatory`):
  1. from&to explicitly mandatory ⇒ `+balancedMandatoryValue`; from-only + Deep ⇒ `+unbalancedMandatoryValue`; to-only + Shallow ⇒ `+unbalancedMandatoryValue`; else 0.
  2. FromValueType&!TowardsValueType ⇒ `+unbalancedEntityValue`; !From&!Towards (entity→entity) ⇒ `+balancedEntityValue`; value→value / entity→value ⇒ 0.
  3. Deep & `IsFromPreferredIdentifier` ⇒ `−1`; Deep & not ⇒ `+1`.

  The coefficient magnitudes guarantee strict tier dominance: **mandatory balance ≫ entity/value balance ≫ deep-over-shallow**. Higher total wins (prefer shallow-toward-mandatory / deep-away-from-mandatory; prefer value→entity then entity→entity; prefer deep except away from a pid).

**A.7.g Exact-tie determinism (sourced, load-bearing).** Candidate lists are built from `possibilityBits` in the hand-written unpack order **`FIRST_SECOND_SHALLOW`, `SECOND_FIRST_SHALLOW`, `FIRST_SECOND_DEEP`, `SECOND_FIRST_DEEP`** (OMIFORM:686-703 — note this is *not* ascending bit value). `PermuteFactTypeMappings` (PERM:889) recurses per fact in candidate-list order, so permutation #0 picks every fact's first surviving candidate. `ChooseOptimalPermutation` sorts `order` with a comparator on weights (PERM:786-792); for ≤16 permutations .NET's introsort takes the insertion-sort path, which never moves equal keys, so **on an all-equal weight tie `order[0]` is the first enumerated permutation**. Consequence for a case_none entity–entity 1:1 singleton chain (2 permutations, equal weights): the decided mapping is `FIRST_SECOND_SHALLOW` — shallow **toward the second role player**. Verified against `state:normamap` on the metamodel: DerivationRuleIsProvidedByConstraint→Constraint, PredicateIsPerformedDuringTransition→Transition, PredicateIsPerformedInStatus→Status, StateMachineDefinitionIsForObjectType→Object Type (all r2). Ties among >16 permutations enter introsort's partition path, whose equal-key order is implementation-defined — treat as equivalent outputs only there.

Decided mappings become `FactTypeMapsTowardsRole` links via `GenerateFactTypeMappings` (OMIFORM:1634-1646); `FactTypeMapsTowardsRole.Create` computes and stores `MappingUniquenessPattern` (Subtype/OneToOne/OneToMany/ManyToOne) and `MappingMandatoryPattern` (Both/Towards/Opposite/NotMandatory) via `GetMappingPatterns` (FTMTR:139-188) — these persisted patterns are later read by stage 2's self-evidence checks.

---

## Section B — CONCEPT TYPES (which object types get tables-in-waiting)

**B.1 `ObjectTypeIsConceptType`** (OMIFORM:1811-1881) — an object type gets a `ConceptType` iff **any** of:
1. `objectType.TreatAsIndependent` (OMIFORM:1814) — independent ⇒ always.
2. It plays a `SubtypeFact` role (OMIFORM:1830) — subtype (and supertype) ⇒ always.
3. Some considered fact mapped with `MappingDepth==Deep` involves it (OMIFORM:1837) — deep mapping ⇒ concept type on both ends.
4. Some considered fact's mapping is **towards** this object type via a role that is **not part of a preferred identifier** (OMIFORM:1844-1876); OR is toward it via a pid role **whose role player is an auto-counter/auto-increment value type** (OMIFORM:1858-1866, always its own concept type).

Otherwise **no concept type** (OMIFORM:1880).

**B.2 Factless / reference-scheme-only entity (EXPLICIT CASE).** An entity type whose only participating facts are its own reference-scheme (identifying) facts, and which is not independent, not a subtype, not deep-mapped, and not auto-identified: every mapping toward it is *part of its preferred identifier*, so B.1.4 fails ⇒ **it does NOT get a concept type and therefore NO table**; its identifier is collapsed into whatever absorbs it. The auto-counter exception (B.1.4b) is the sole reason such an entity would still get its own concept type/table. A gateway-valid entity with a pid but *zero* facts at all never has a mapping toward it ⇒ no concept type.

**B.3 Value types → concept type only when independent/otherwise qualified** (same rules). A qualifying value type concept type additionally gets an `InformationType` named `"<Name>Value"` mandatory, plus a preferred `Uniqueness` named `"<Name>Uniqueness"` (OMIFORM:1104-1128). Every non-ignored value type first yields an `InformationTypeFormat` named `<ValueType.Name>` (OMIFORM:1051-1073).

**B.4 `ObjectTypeIsTopLevelConceptType`** (OMIFORM:1771-1795): is a concept type (B.1) AND has **no** deep mapping away from it (no considered fact with `FromObjectType==objectType && Deep`). Top-level ⇒ candidate for its own table; non-top-level ⇒ absorbed via assimilation.

`ConceptType.Name = objectType.Name` (OMIFORM:1097).

---

## Section C — CONCEPT TYPE CHILDREN (absorbed facts → children)

**C.1 Driver** `GenerateConceptTypeChildren` (OMIFORM:1140-1170): for each concept type's object type, for each played role whose fact has a decided mapping with `TowardsRole == playedRole` (i.e., mapped *into* this concept type), call `GenerateConceptTypeChildrenForFactTypeMapping`.

**C.2 `GenerateConceptTypeChildrenForFactTypeMapping`** (OMIFORM:1199-1502). Pushes the fact onto `factTypePath`; `isMandatory = isMandatorySoFar && factTypeMapping.TowardsRoleMandatory`. Three outcomes:

- **C.2.a From a concept type** (from-object-type has a `ConceptType`, non-unary; OMIFORM:1210): create a **reference-style** child.
  - **Deep mapping ⇒ `ConceptTypeAssimilatesConceptType`** (OMIFORM:1243-1295): assimilator = parent, assimilated = fromConceptType. `RefersToSubtype = (fact is SubtypeFact)`. `IsPreferredForTarget`: for subtypes = `subtypeFact.ProvidesPreferredIdentifier`; else = `TowardsRole` UC `.IsPreferred` (OMIFORM:1252-1265). `IsPreferredForParent = factTypeMapping.IsFromPreferredIdentifier` (OMIFORM:1267).
  - **Shallow mapping ⇒ `ConceptTypeRelatesToConceptType`** (OMIFORM:1303-1314).
  - Names (OMIFORM:1235-1241): `name = ResolveRoleName(fromRoleBase)`, `oppositeName = ResolveRoleName(toRoleBase)`; **stored deliberately swapped** — child `Name = oppositeName`, `OppositeName = name` (kept for file-format compatibility; same swap in stage-2 delete/update paths).

- **C.2.b From a value type or unary (has an InformationTypeFormat) ⇒ `InformationType`** (OMIFORM:1317-1367). Unary uses model-level `PositiveUnaryInformationTypeFormat`/`NegativeUnaryInformationTypeFormat` (names `_positive_unary`/`_negative_unary`, OMIFORM:1336-1341). Name = `ResolveRoleName` of the towards role (unary) or from role.

- **C.2.c No InformationTypeFormat (from an entity/structured value type mapped shallowly) ⇒ collapse the from-object-type's preferred identifier** (OMIFORM:1368-1461): recurse into each pid role's fact, chaining `factTypePath`. Special handling: single-fact pid deeply mapped away (create a shallow "fake" mapping, OMIFORM:1411-1419); cyclic deep collapse (subtype identified by supertype + objectified 1-1) is broken by forwarding a shallow mapping using `parentConceptTypeHasDeepAway` (OMIFORM:1420-1457).

**C.3 Paths/chains.** Every generated child records its full `factTypePath` as `ConceptTypeChildHasPathFactType` links (OMIFORM:1493-1496) — this ordered path is the exact fact chain later replayed by stage 2 for column derivation and naming. Inverse (unary +/−) children are paired via `InverseConceptTypeChild` with `PairIsMandatory` (OMIFORM:1464-1491). `ResolveRoleName` (OMIFORM:1681-1763): role's explicit `Name`; else the role player name adjusted by hyphen-bound reading / unary reading text.

**C.4 Associations.** `GenerateAssociations` (OMIFORM:1648-1672): for objectified concept types, links children of the implied binary facts as `ConceptTypeHasChildAsPartOfAssociation`.

---

## Section D — TABLES (Stage 2: OIAL→relational)

**D.-1 Theory ground (AREST.tex §Cells; Backus 14.7; Halpin 5NF).** Two facts anchor this section to the whitepaper rather than beside it. (1) Stage 2 performs **no normalization** — elementary fact types are in fifth normal form by construction (AREST.tex §Map, "the named relations are the cells themselves"), so grouping and naming are the *only* operations here; there is no dependency analysis to transcribe because elementarity already did it. (2) The Absorb recursion (D.3.4: recurse into the assimilated concept type in the SAME table, recording the assimilation path) is the paper's nested-cell structure — "RMAP assigns each entity its own cell … and a cell in one store may contain another entire store" (§Cells, citing Backus 14.7). A top-level concept type's table with absorbed column groups IS the curried entity cell containing sub-cells; the C.1 driver ("facts mapped into this concept type") is the paper's "row of facts depending on its key." Consequently the canon's store form and the transcribed table set are one answer at two levels of one nesting, and certifying D against `norma:tables` certifies the store form's grouping as a corollary.

**D.0 Entry / defaults** `GenerateConceptualDatabaseFixupListener.ProcessElement` (FIXUP:1448-1552): ensures a `Catalog` + one `Schema` (`Schema.Name = AbstractionModel.Name`), then `FullyGenerateConceptualDatabaseModel` (FIXUP:160). Regeneration is gated on `CoreAlgorithmVersion`/`NameAlgorithmVersion`. **Default customization = none** (`SchemaCustomization(null)`), so all "if customization…" branches below take their default path.

**D.1 Which concept types become tables** (FIXUP:180-220). For each concept type, `needsTable=true` unless:
- it is the **assimilated** target of some assimilation whose choice is **Absorb** (FIXUP:183-192) ⇒ absorbed into assimilator's table; OR
- it is the **assimilator** parent of some assimilation whose choice is **Partition** (FIXUP:195-204) ⇒ its data is pushed into partitioned children.

Otherwise create `Table` with initial `Name = conceptType.Name` and `TableIsPrimarilyForConceptType` link (FIXUP:209-211). (Top-level, per B.4, ⇔ needsTable in the default all-Absorb-subtypes configuration.)

**D.2 AssimilationAbsorptionChoice — the three choices + DEFAULT.** Per-assimilation choice resolved by `GetAbsorptionChoiceFromAssimilation` (ASM:154-158) → `GetAbsorptionChoiceFromFactType` (ASM:398-404): if an `AssimilationMapping` customization exists use its `AbsorptionChoice`, else **`GetDefaultAbsorptionChoice` (ASM:429-432)**:
> **DEFAULT = `Absorb` iff the fact is a `SubtypeFact` OR `factType.ImpliedByObjectification != null`; otherwise `Separate`.** (Multi-fact-path assimilations default to `Absorb`, ASM:157.)

So by default: **subtypes are absorbed into the supertype table; objectification-implied deep facts are absorbed; all other (entity→entity) deep assimilations are `Separate` (own table + FK).** `Partition` is never a default.

**D.2.1 `ObjectTypeAbsorptionChoice` enum** (ASM:41-83) is the object-type-level *aggregate view* shown in the property grid; it is computed from the per-assimilation `AssimilationAbsorptionChoice`s (ASM `GetValue`, 807-862) and setting it rewrites the underlying per-assimilation choices (ASM:889-1056). Generation reads only the per-assimilation `AssimilationAbsorptionChoice`.

**D.3 Columns & uniqueness per table** `GenerateContentForConceptTypeChildren` (FIXUP:422-741), recursively over the primary concept type with `isMandatorySoFar=isPreferredSoFar=true` initially:
1. **InformationType ⇒ one `Column`** (FIXUP:428-500 → `GenerateColumnForInformationType`:335). `Name = informationType.Name`; `IsNullable = !(isMandatorySoFar && (forceCurrentMandatory || informationType.IsMandatory))`. Paired unary inverse: only the positive side yields the column; negative registered as inverse (FIXUP:443-458); self-evidence/`PairIsMandatory` govern `forceMandatory` (FIXUP:461-489).
2. **ConceptTypeRelatesToConceptType ⇒ FK columns = the related concept type's preferred-identifier columns** (FIXUP:503-515 → `GenerateColumnsForConceptTypePreferredIdentifier`:769/802). Nullable if the relation isn't mandatory-so-far.
3. **OIAL Uniqueness ⇒ table `UniquenessConstraint`** (FIXUP:518-545): `IsPrimary = isPreferredSoFar && oialUniqueness.IsPreferred`; columns = the mapped children's columns (inverse pairs de-duplicated).
4. **Assimilations where concept type is parent** (FIXUP:548-674):
   - **Absorb** ⇒ recurse into assimilated concept type *into the same table* (`TableIsAlsoForConceptType`, records assimilation path); if the assimilation is not self-evident (D.4), emit an **absorption-indicator column** named `assimilated.Name`, nullable per mandatory-so-far (FIXUP:564-621).
   - **Partition** ⇒ nothing here (data lives in children).
   - **Separate** ⇒ only if `SeparateConceptTypeAssimilationMapsToParentConceptType` (= `assimilation.IsPreferredForParent`, FIXUP:298-308): emit the assimilated pid columns + a `UniquenessConstraint` (`IsPrimary = isPreferredSoFar && IsPreferredForParent`) (FIXUP:648-666).
5. **Assimilations where concept type is target** (FIXUP:677-740): **Absorb** ⇒ nothing (maps away); **Partition** ⇒ recurse assimilator into this (partitioned-child) table; **Separate** ⇒ if **not** `IsPreferredForParent`, emit the assimilator's pid columns + `UniquenessConstraint` (`IsPrimary = isPreferredSoFar && IsPreferredForTarget`) (FIXUP:717-731).

**D.3.1 Reference-scheme (identifier) columns source** `GenerateColumnsForConceptTypePreferredIdentifier` (FIXUP:802-886): resolve the concept type's identifier by, in order: (a) its preferred `Uniqueness` — recurse its children (InformationType⇒column, Relation⇒recurse related pid); (b) else the assimilation `IsPreferredForTarget` toward it (recurse assimilator pid); (c) else the assimilation `IsPreferredForParent` it assimilates (recurse assimilated pid). This is how identifier/FK columns originate and how a collapsed reference-scheme entity's value column lands in the referencing table.

**D.4 Assimilation self-evidence / absorption-indicator** `AssimilationIsSelfEvident` (ASM:186-391) → `NoEvidence`/`OptionalEvidence`/`MandatoryEvidence`. Fully-derived-not-stored subtype/objectification ⇒ `MandatoryEvidence` (ASM:208-237). Otherwise scans children and non-assimilated references, using the persisted `FactTypeMapsTowardsRole.MandatoryPattern` plus disjunctive-mandatory completion (ASM:242-390). `MandatoryEvidence` ⇒ no indicator column; `NoEvidence`/`OptionalEvidence` ⇒ absorb needs the boolean absorption-indicator column (D.3.4).

*Doctrine ground (Halpin, "Subtyping Revisited" — infosci/Subtyping_revisited.pdf):* the asserted/derived/semi-derived subtype trichotomy is the same trichotomy the FORML derivation markers carry, and the paper's Patient example is the absorption-indicator case in doctrine form — a *derived* subtype's membership is evidenced by its defining fact (gender 'M' ⇒ MalePatient; no extra column), an *asserted* subtype needs the boolean indicator. The "kind discriminator" columns of the one-Function-table form are exactly those asserted-subtype indicators. Canon inputs already exist: `state:derived`'s `subtype` rows mark the derived subtypes (⇒ MandatoryEvidence); the rest take the ASM:242-390 scan over mandatory patterns available from mapinputs.

**D.5 Reference constraints (FKs)** `GenerateReferenceConstraintsForConceptTypeChildren` (FIXUP:910-995) then `GenerateReferenceConstraint` (FIXUP:1017+): each `ConceptTypeRelatesToConceptType` ⇒ FK named `relation.Name`; Absorb assimilation ⇒ recurse; Separate ⇒ FK when it maps to the parent side or the target side accordingly; Partition ⇒ recurse. Target table resolved by `GetTargetTableForReferenceConstraint` (FIXUP:1191) via `TableIsPrimarilyForConceptType`/`TableIsAlsoForConceptType`. Constraint columns matched by concept-type-child path.

**D.6 Subtypes (default).** Because subtype assimilations default to **Absorb** (D.2), a subtype is by default **merged into its supertype's table** (no separate subtype table); its extra roles become nullable columns; an absorption-indicator column marks membership only when not self-evident. Choosing `Separate` gives the subtype its own table with an FK/PK to the supertype; `Partition` duplicates supertype data into each subtype's table and removes the supertype table.

**D.7 TABLE & COLUMN NAMING** `NameGeneration.GenerateAllNames` (NAMEGEN:66-182), run last (FIXUP:291). Uses `DefaultDatabaseNameGenerator` over two `RelationalNameGenerator` refinements.

**D.7.1 RelationalNameGenerator DEFAULTS (NAMEGEN:1648-1674 + base NameGenerator FinishPropertyInitialization):**
- root generator: `SpacingFormat = Remove`.
- **Table** usage (`RelationalTable`): `CasingOption = Pascal`, `SpacingFormat = Remove`.
- **Column** usage (`RelationalColumn`): `CasingOption = Camel`, `SpacingFormat = Remove`.
- `SpacingReplacement` unused when format is Remove (empty).

**D.7.2 Table name** `GenerateTableName` (NAMEGEN:502-522, phase 0 only): `ReferenceModeNaming.SeparateObjectTypeParts(objectType,…)` (REFMODE:2922-2954) emits name parts (abbreviation if any; else objectified default-reading parts; else value-type reference-mode parts; else the native object-type name), then `NamePart.GetFinalName`. Empty ⇒ literal `"TABLE"`.

**D.7.3 `NamePart` tokenize→recase→rejoin (this answers "API Endpoint" → "APIEndpoint"):**
- `AddToNameCollection` (NAMEPART:164-309): each incoming string is **split on space and hyphen** (`NameDelimiterArray`, NAMEPART:143) into individual parts; each part is further split on camel/Pascal/numeric boundaries when `Utility.IsMultiPartName` (UTIL:686) via `Utility.MatchNameParts` regex (UTIL:769-771); parts with trailing all-caps runs or numerics get `ExplicitCasing`; **adjacent duplicate parts are collapsed** (NAMEPART:228-307).
- `GetFinalName` (NAMEPART:331-397): applies **recognized-phrase/abbreviation replacement** (`ResolveRecognizedPhrases`, model-driven), then re-cases each part per `CasingOption` (`DoFirstWordCasing`; explicit-cased or adjacent-uppercase parts are left as-is, NAMEPART:704-720), then **joins with the spacing replacement** = `""` for `Remove` (NAMEPART:398-415).

Therefore **"APIEndpoint" is NOT a naïve `Replace(" ","")`.** The general rule is *tokenize (spaces/hyphens + camelCase/PascalCase/numeric boundaries) → recognized-phrase/abbreviation substitution → adjacent-duplicate collapse → per-`CasingOption` recasing → concatenate with `SpacingFormat` separator*.

**D.7.4 Column name** `GenerateColumnName` (NAMEGEN:523-845): reconstructs the column's `ColumnPathStep` chain from `ColumnHasConceptTypeChild` path and walks it, emitting reading/role/hyphen-bound/reference-mode name parts (Camel casing, Remove spacing). Value-type value column with empty path ⇒ `ResourceStrings.NameGenerationValueTypeValueColumn`. Empty ⇒ `"COLUMN"`.

**D.7.5 Uniqueness across scope & collision** `Utility.GenerateUniqueNames`: table names unique in schema, column names unique in table, constraint names unique in schema; higher "phase" adds decoration on collisions (table-name prefix, predicate text). Constraint names (NAMEGEN:846-888): reuse a non-default ORM UC name if present, suffix `_PK`/`_UC`; FK ⇒ `<SourceTable>_FK`.

**D.7.6 Column ORDER** `SortColumns`/`ColumnSorter` (NAMEGEN:183-413). Default `Table.ColumnOrder = AutoSchemaDefault` (DSL:112) ⇒ resolves to `Schema.DefaultColumnOrder` (NAMEGEN:331-353) whose **default = `PrimaryMandatoryUniqueOther`** (DSL:68). Groups: (0) primary-key columns, (1) other mandatory, (2) other unique, (3) rest; within a group **sorted by column name (CurrentCulture), tie-broken by `Column.Id`** (NAMEGEN:265-329).

---

## Section E — UNIQUENESS / PRIMARY KEY

**E.1 OIAL uniqueness** `GenerateUniqueness` (OMIFORM:1508-1632): for each concept type, examine alethic uniqueness constraints on the *opposite* role of each played role. Include a constraint only if **every** constrained role's fact is non-ignored AND maps **toward** this object type (`allChildrenMapTowardObjectType`, OMIFORM:1546-1566). Skip if any child resolves to an assimilation, or a child column is missing (OMIFORM:1577-1609). Create `Uniqueness` (`Name = ormUC.Name`, `IsPreferred = ormUC.IsPreferred`, `UniquenessIsForUniquenessConstraint` back-link) including the mapped `ConceptTypeChild`ren (OMIFORM:1611-1626). Value-type concept types additionally get the synthetic preferred `<Name>Uniqueness` (B.3).

**E.2 Table uniqueness/PK** `UniquenessConstraint` objects (D.3.3/3.4/3.5, FIXUP:527-531/660-663/726-729): `Name = oialUniqueness.Name` (or assimilated/assimilator concept type name for separations); **`IsPrimary = isPreferredSoFar && <source>.IsPreferred/IsPreferredForParent/IsPreferredForTarget`**. So a table's **primary key** is the table's preferred OIAL uniqueness *provided the entire absorption/identifier path to it has been preferred so far*; non-preferred uniquenesses become alternate keys (`_UC`).

**E.3 Identifier propagation.** Because FK/reference columns for a related or separated concept type are literally its preferred-identifier columns (D.3.1), an entity's primary key propagates into every absorbing/referencing table as those same columns, and `isPreferredSoFar` determines whether that propagated identifier is the referencing table's own PK or merely an FK/alternate key.

---

### Key determinism notes for byte-identical certification
- Default state assumed everywhere: **no `MappingCustomization`/`SchemaCustomization`** (D.0); subtype & objectification assimilations = **Absorb**, other deep assimilations = **Separate** (D.2); table casing **Pascal**+Remove, column casing **Camel**+Remove (D.7.1); column order **PrimaryMandatoryUniqueOther** with name+`Id` tiebreak (D.7.6); algorithm version **1.012**.
- Iteration order follows the model's `ObjectTypeCollection`/`FactTypeCollection`/played-role/link collection order; the only non-stable step is the weight sort in `ChooseOptimalPermutation` (A.7.e/f), which is reached only on exact weight ties among already concept-count-minimal permutations (treated as equivalent results).
- Two independent version stamps exist: OIAL `AlgorithmVersion="1.012"` (OMIFORM:39) and schema `CoreAlgorithmVersion`/`NameAlgorithmVersion` (FIXUP:1474) — both must match to avoid regeneration divergence.
