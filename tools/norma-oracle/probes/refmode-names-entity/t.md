# A reference mode whose name is an entity type
### A reference mode is a value, and WHICH value depends on the mode's KIND.
### Measured from state:refmodes, 2026-09-15:
###
###   Law(.citation)   general  ->  the value type `citation`    SHARED
###   Person(.name)    popular  ->  the value type `Person_name` MINTED
###   Citation(.id)    popular  ->  the value type `Citation_id` MINTED
###
### So NORMA mints a lowercase `citation` value type beside the `Citation`
### ENTITY and identifies Law by THAT -- state:schemereadings carries
### `LawHasCitation <Law, citation>`, the value, never the entity. It raises no
### error doing it, which is the whole reason this probe needs a [Fact] beside
### it: the error count cannot see any of this.
###
### WHAT THIS COMMENT USED TO SAY, corrected 2026-09-15 because it inverted
### both halves. It said the mode "now gets the entity's own value type,
### Law_citation, and the census says so" -- `Law_citation` occurs in exactly
### one commit, ac757d90, on a comment line, never in code or output, and that
### same commit records the entity-named-mode branch as "inert and is not
### kept". And it said "Person keeps sharing Name", where Person's POPULAR mode
### mints Person_name and it is LAW's general mode that shares. Nothing
### regressed; the comment was wrong the day it was written.
###
### AND THE NAME WAS NEVER THE CAUSE (ac757d90, #99). The real defect was
### rmap:tpairs feeding 1:1 entity-value pairs into an undirected closure, so
### every entity using a general mode joined one chain. The name stays: a
### citation is one thing, a document citing another (Sam, 2026-09-06).

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
