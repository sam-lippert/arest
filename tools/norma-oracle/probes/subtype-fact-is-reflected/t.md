# A subtyping is a fact type: reflected with its two roles and its reading, and its link lands in Object Type is subtype of Object Type

### NORMA holds `Person is a subtype of Party` as a SubtypeFact -- a FactType
### whose two roles the subtype and the supertype play, read `{0} is a subtype
### of {1}`, named `PersonIsASubtypeOfParty` (ORMCore.dsl:712, ORMModel.resx) --
### and the design state carried it nowhere a reflection could read: a citation
### of the subtyping resolved to the fact's id and stood as a Fact Type instance
### with no role and no reading (eu-law, 19 + 19 mandatory violations,
### 2026-09-10). The oracle now writes every subtype fact as a reading-shaped
### row of state:subtypefacts, the reflection reads that surface beside
### state:readings, and the link itself is a row of Halpin's own fact type for
### it, `Object Type is subtype of Object Type` (13.8, p.705), with the fact an
### instance of Subtype Fact. The probe surface shows no carrier, so the rows
### are pinned by ASubtypeFactIsReflectedAsAFactType in ProbeTests.cs: the two
### subtypefacts rows from this reading alone, and over the metamodel the pair
### `Person, Party`, the extent of Subtype Fact and the citation's row naming
### PersonIsASubtypeOfParty.

Person(.name) is an entity type.
Party(.name) is an entity type.
Customer(.name) is an entity type.

Person is a subtype of Party.
Customer is a subtype of Person.
Person smokes.

Person 'ann' smokes.
