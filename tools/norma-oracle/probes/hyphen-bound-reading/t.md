# A hyphen in a reading or a type name, and the sentence that speaks it
### Two shapes that parsed fine without the hyphen and fell through with it
### (2026-09-06). `has default- Fetcher` is FORML's hyphen binding on a
### predicate word: the reading's words dropped the hyphen and the instance
### sentence's kept it, so the declared fact type never matched its own row
### and the fallback filed it by player signature. `Cross-Border Recognition`
### is a type name with an internal hyphen: the value-constraint regex did
### not admit one, so "The possible values of ..." was not a constraint but
### an instance sentence with three quoted values.

## Entity Types
Source Declaration(.name) is an entity type.
Fetcher(.name) is an entity type.
Case(.id) is an entity type.
Cross-Border Recognition is a value type.
  The possible values of Cross-Border Recognition are 'foreign_main', 'foreign_nonmain', 'not_recognized'.
Plain Recognition is a value type.
  The possible values of Plain Recognition are 'one', 'two', 'three'.

## Fact Types
Source Declaration has default- Fetcher.
  Each Source Declaration has at most one default- Fetcher.
Source Declaration has Fetcher.
Case has Cross-Border Recognition.
Case has Plain Recognition.

## Instance Facts
Source Declaration 'edmunds' has default- Fetcher 'fetch'.
Source Declaration 'eu' has Fetcher 'cheerio'.
Case 'c1' has Cross-Border Recognition 'foreign_main'.
Case 'c1' has Plain Recognition 'one'.
