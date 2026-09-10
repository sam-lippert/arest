# The subtype-fact reflection over the metamodel (read by ASubtypeFactIsReflectedAsAFactType, not a probe of its own)

### No t.md here: this reading composes with arest/metamodel, so it declares
### nothing the metamodel declares. Person is a subtype of Party is NORMA's
### SubtypeFact; over the metamodel its link is a row of `Object Type is
### subtype of Object Type`, the fact is an instance of Subtype Fact and of
### Fact Type, and the citation names the fact by its one name,
### PersonIsASubtypeOfParty.

Person(.name) is an entity type.
Party(.name) is an entity type.
Customer(.name) is an entity type.

Person is a subtype of Party.
Customer is a subtype of Person.
Person smokes.

Person 'ann' smokes.
Citation 'C-1' has Text 'Halpin 13.8, p.705'.
Fact Type 'Person is a subtype of Party' cites Citation 'C-1'.
