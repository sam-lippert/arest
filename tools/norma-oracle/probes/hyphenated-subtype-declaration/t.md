# A subtyping whose type name carries a hyphen is a subtyping, not a fact type

### The hyphen rule was already written down (Verifier.cs, NameChars): a type
### name may carry an internal hyphen -- Trade-In Amount, Cooling-Off Rule,
### Sub-Processor, Non-Merchant -- and the hyphen is part of the name only when
### a word character FOLLOWS it, since a trailing hyphen before a space is
### FORML's hyphen binding (`payoff- Balance`), which names a ROLE. That rule
### reached the entity and value declarations and never reached the three
### subtyping ones, which is the failure the rule's own comment predicts: the
### declaration falls through pass 1 and the declaration LINE is minted as a
### fact type.
###
### MEASURED 2026-09-11, before the fix, on this very fixture's shape:
###
###   Practice(practiceName, isEmotionRecognitionInWorkplace?, isPlainScan?,
###                          realTimeScanIsASubtypeOf?)
###
### Three sibling declarations, and the hyphenated one alone became a unary
### fact type ON THE SUPERTYPE -- `Real-Time Scan is a subtype of {0}` -- with
### `Real-Time Scan is a subtype of` left as predicate text and only Practice
### bound as a player. So the type was never declared, the subtyping never
### existed, and the RMAP gave Practice a column spelled after the sentence.
###
### 17 real declarations inside the ten corpora were read that way (28 across
### every readings file on disk; the other 11 are a second copy of us-law's
### tax-strategies file under apps/doNotPayDemo, which no corpus reads):
### Sub-Processor,
### Non-Merchant, Cooling-Off Rule Section, Short-Term and Long-Term Capital
### Gain, Above-The-Line and Below-The-Line Deduction, S-Corporation,
### C-Corporation, Donor-Advised Fund, No-Income-Tax State, Self-Employment
### Income, S-Corp Distribution, Tax-Exempt Income, Quasi-Suspect
### Classification, Non-Conforming Tender, and eu-law's Real-Time Remote
### Biometric Identification In Public. Three of those are the very names the
### NameChars comment cites as its motivation, which is what a fix too small
### looks like from the outside: the rule was right and reached four regexes
### of seven. The metamodel itself has none, so the base carriers are
### byte-identical across this change.
###
### WHAT THIS PROBE PINS, and it pins it in both directions. `Cooling-Off Rule
### is a subtype of Rule` is declared here, so a citation of it must resolve
### and leave NO refusal line. `Non-Existent Rule is a subtype of Rule` is NOT
### declared, so its citation must still be refused by name -- the one REFUSED
### line below. Read the other way: were the hyphen fix reverted, the declared
### one would join it; were the citation refusal ever dropped wholesale, that
### line would vanish. An empty refusal section alone could not tell the two
### apart.
###
### The supertype and exclusive-subtype forms take the same class and have no
### corpus witness today; they are here because the regexes changed. `The data
### type of X is ...` and `X objectifies "..."` still carry the bare class and
### have no witness either -- measured, not assumed: zero hyphenated instances
### of both across the metamodel and every app's readings.

Function(.name) is an entity type.
Fact Type(.name) is an entity type.
Object Type(.name) is an entity type.
  Object Type is a subtype of Function.
  Fact Type is a subtype of Function.
Citation(.id) is an entity type.
Rule(.name) is an entity type.
Practice(.name) is an entity type.

Function cites Citation.

Cooling-Off Rule is a subtype of Rule.
Plain Rule is a subtype of Rule.
Rule is a supertype of Right-Of-Rescission Rule.
Sub-Processor is a subtype of Practice.
Non-Merchant is a subtype of Practice.
{Sub-Processor, Non-Merchant} are mutually exclusive subtypes of Practice.

Fact Type 'Cooling-Off Rule is a subtype of Rule' cites Citation 'C-1'.
Fact Type 'Plain Rule is a subtype of Rule' cites Citation 'C-2'.
Fact Type 'Non-Existent Rule is a subtype of Rule' cites Citation 'C-3'.
