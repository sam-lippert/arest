# A reference mode whose name is an entity type
### A reference mode is a value. A single mode whose name is an existing VALUE
### type adopts it (Person(.name) shares Name), but `Law(.citation)` beside a
### Citation ENTITY identified Law by an entity: no value at the end of the
### chain, no identifier path for canon's RMAP, and NORMA raised nothing (#99).
### The mode now gets the entity's own value type, Law_citation, and the census
### says so. Person keeps sharing Name.

## Entity Types
Citation(.id) is an entity type.
Law(.citation) is an entity type.
Person(.name) is an entity type.
Name is a value type.

## Fact Types
Law has Title.
Title is a value type.
Person likes Law.

## Instance Facts
Law '42 U.S.C. 12101' has Title 'ADA'.
Person 'Ada' likes Law '42 U.S.C. 12101'.
