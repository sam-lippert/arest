# A decimal orders exactly, computes exactly, and divides only where that is exact

### MEASURED 2026-09-10 against the mu itself, which is what changed the answer
### here. The recipe emitter used to refuse every comparison, threshold and
### arithmetic touching a decimal with one reason, "the hosts hold integers and
### text". That sentence was about IValue and not about the mu.
###
### RE-MEASURED 2026-09-15 THROUGH THE MU AT fb2ff6c2, and half the table below
### was overturned by it. What the primitives answer now:
###
###   cmp on two host numbers   6.875 < 6.9  -> T,  0.1 > 0.09 -> T   exact
###   cmp on two TEXT atoms     "10" > "9"   -> F                     LEXICAL
###   + - * on fractions        2.5 + 4 -> 6.5,  0.1 + 0.2 -> 0.3     EXACT now
###   * over decimals           0.06875 * 100000 -> 6875              EXACT now
###   / truncates toward zero   7 / 2 -> 3,  128909.6875 / 100 -> 1289
###   rounding primitive        round<1289.096875, 2> -> 1289.1       EXISTS now
###
### THE SECOND ROW IS THE DEFECT THIS PROBE IS FOR, and it is a SILENT WRONG
### ANSWER rather than a refusal. A decimal column written as a TEXT atom does
### not fail to compare; it compares LEXICALLY. gt<"10", "9"> is F where the
### numbers say T, and gt<"100", "20"> is F as well. The first version of this
### probe recorded its three comparing rules as BUILT and they agreed with
### arithmetic ONLY BY LUCK: 6.875, 6.5 and 4.25 all have one digit before the
### point, so their lexical order and their numeric order coincide. q3 below is
### here to break that luck -- Tax Rate 10.5 against Cap Rate 9.25 orders one way
### as text and the other way as numbers -- and `Quote is over cap` puts the same
### divergence on a threshold, where the literal 6.5 IS written as a number and
### an atom column makes cmp throw outright.
###
### SO THE BOUNDARY IS WHERE THE KIND WAS MISSING, exactly as the cmp note says
### (host.js:187, "a READING-BOUNDARY defect, to be fixed where text becomes
### values, not by breaking the order axioms in every host"). A number-typed
### role's values are written as host numbers -- and so is the object type
### POPULATION those values land in, which is the other half and not a detail:
### writing the row as N(200) while state:otpops keeps A('200') is one value in
### two representations, and it took support's store down with eighteen alethic
### violations (auto.dev/service-health.md:19-30). One function writes both.
###
### THE SIX OUTCOMES, and they are the point of the probe.
###
### `Quote is steep` BUILDS: two decimal columns ordered against each other,
### which is exact once both are host numbers. q3 is the row that says so.
###
### `Quote is over six` BUILDS: a decimal column ordered against the INTEGER
### literal 6, which is written as a numeral for the same reason.
###
### `Quote is over cap` BUILDS as well, and only since 2026-09-11. It did not,
### and not for any reason the emitter decided: the clause-splitting regex that
### peels a threshold off a leg took `([0-9]+)` and nothing else, so `greater
### than 6.5` never split, went to the resolver whole, matched no reading, and
### the arm died as "clause names no fact type" -- a reading-matcher refusal
### reported for a rule whose only fault was a decimal point. The equality
### branch three lines below it already read `([0-9]+(?:\.[0-9]+)?)`, so the
### threshold was the odd one out rather than a decision. Worth keeping as a
### case: the emitter's own decimal refusal had already been lifted and nothing
### could reach it, so the fix looked done and was not.
###
### `Quote has total- Tax Rate` BUILDS since 2026-09-15, and its reason for not
### building is what fb2ff6c2 spent. It used to decline as "an arithmetic
### operand typed decimal (Tax Rate): the mu multiplies in binary floating point
### and truncates division"; the mu now adds over the operands' own decimal
### spellings, so 0.1 plus 0.2 is 0.3 and not 0.30000000000000004. q2 carries
### exactly that pair so the claim is a row and not a sentence.
###
### `Quote has tax- Amount` BUILDS, and it is the MONEY case. `Price times Tax
### Rate divided by 100` is where exact multiplication alone is not enough:
### 18750.50 * 6.875 is 128909.6875 exactly, and `/` truncates that to 1289,
### losing 89 cents. `/` is not the thing to change -- truncation toward zero is
### the meaning the cs, java and rust hosts share -- so the EMITTER writes a
### power-of-ten divisor as a multiplication by its exact reciprocal, and the
### head answers 128909.6875 * 0.01 = 1289.096875. Rounding that to the column's
### declared scale is a SEPARATE step this emitter does not take: `round` is a
### primitive now (round<1289.096875, 2> is 1289.1), but nothing yet reads a
### value type's Scale facet to know what to round to.
###
### AND THE VERBALIZATION BELOW STILL READS `Divide(Multiply(Price, Tax Rate),
### 100)`, WHICH IS RIGHT: it is NORMA's verbalization of the RULE, and the rule
### is unchanged. The reciprocal is the RECIPE -- state:rules emits
### calc(pairwith(calc(join, `*`), 0.01), `*`) -- an exact equivalent of what
### the reading says, chosen because `/` is not. Measured in the booted store:
### q1 answers tax- Amount 1289.096875, q2 0.3 for total- Tax Rate (0.1 plus
### 0.2, not 0.30000000000000004), and q3 is in steep, over cap and over six.
### At HEAD the same fixture did not merely answer wrongly: the store would not
### BOOT, throwing `compare across atom kinds: 6.5 vs 10.5`.
###
### `Quote has odd- Amount` does NOT build, and the refusal is the boundary of
### the one above. Dividing by a COLUMN cannot be turned into a reciprocal, and
### `/` over a decimal would silently drop the fraction, so the emitter declines
### by name instead of emitting truncation where the reading says division.
### Exact decimal division at a declared scale is a different operation
### (round . <*, K(10^s)>) and is not total: 1/3 is in no DECIMAL(p, s).

## Entity Types

Quote(.id) is an entity type.

## Value Types

Tax Rate is a value type.
  The data type of Tax Rate is decimal.
Cap Rate is a value type.
  The data type of Cap Rate is decimal.
Price is a value type.
  The data type of Price is decimal.
Amount is a value type.
  The data type of Amount is decimal.

## Fact Types

Quote has Tax Rate.
  Each Quote has at most one Tax Rate.
Quote has Cap Rate.
  Each Quote has at most one Cap Rate.
Quote has Price.
  Each Quote has at most one Price.
Quote has submission- Tax Rate.
Quote has response- Tax Rate.
Quote has total- Tax Rate. *
Quote has tax- Amount. *
Quote has odd- Amount. *
Quote is steep. *
Quote is over cap. *
Quote is over six. *

## Derivation Rules

* Quote is steep iff Quote has Tax Rate and Quote has Cap Rate and that Tax Rate exceeds Cap Rate.
* Quote is over cap iff Quote has Cap Rate and that Quote has Tax Rate greater than 6.5.
* Quote is over six iff Quote has Cap Rate and that Quote has Tax Rate greater than 6.
* Quote has total- Tax Rate iff Quote has some submission- Tax Rate and Quote has some response- Tax Rate and total- Tax Rate is submission- Tax Rate plus response- Tax Rate.
* Quote has tax- Amount iff Quote has Price and Quote has Tax Rate and tax- Amount equals Price times Tax Rate divided by 100.
* Quote has odd- Amount iff Quote has Price and Quote has Tax Rate and odd- Amount equals Price divided by Tax Rate.

## Instance Facts

Quote 'q1' has Tax Rate 6.875.
Quote 'q1' has Cap Rate 6.5.
Quote 'q1' has Price 18750.50.
Quote 'q1' has submission- Tax Rate 6.875.
Quote 'q1' has response- Tax Rate 0.125.
Quote 'q2' has Tax Rate 4.25.
Quote 'q2' has Cap Rate 6.5.
Quote 'q2' has Price 100.
Quote 'q2' has submission- Tax Rate 0.1.
Quote 'q2' has response- Tax Rate 0.2.
Quote 'q3' has Tax Rate 10.5.
Quote 'q3' has Cap Rate 9.25.
Quote 'q3' has Price 20.
Quote 'q3' has submission- Tax Rate 10.5.
Quote 'q3' has response- Tax Rate 9.25.
