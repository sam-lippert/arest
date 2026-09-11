# A decimal orders exactly and computes inexactly, and the two are decided apart

### MEASURED 2026-09-10 against the mu itself, which is what changed the answer
### here. The recipe emitter used to refuse every comparison, threshold and
### arithmetic touching a decimal with one reason, "the hosts hold integers and
### text". That sentence was about IValue and not about the mu:
###
###   cmp on two host numbers   6.875 < 6.9  -> T,  0.1 > 0.09 -> T   exact
###   cmp on two TEXT atoms     "2" < "10"   -> F                     lexical
###   + - * on fractions        2.5 + 4 -> 6.5,  10.5 - 0.25 -> 10.25 accepted
###   * in binary floating pt   0.06875 * 100000 -> 6875.000000000001 INEXACT
###   / truncates               7 / 2 -> 3                            INEXACT
###   rounding primitive        none
###
### So the boundary was the gap: IValue wrote a numeral only for an INTEGER-typed
### role, and a decimal landed as text, where cmp orders lexically. It now writes
### one for any number-typed role whose value is a numeral, and the three rules
### below split on what that buys.
###
### FOUR OUTCOMES, and they are the point of the probe.
###
### `Quote is steep` BUILDS: two decimal columns ordered against each other,
### which is exact once IValue writes both as host numbers. This is the unblock.
###
### `Quote is over six` BUILDS: a decimal column ordered against the INTEGER
### literal 6, which IValue writes as a numeral for the same reason.
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
### `Quote has total- Tax Rate` does NOT build, and its reason is now exactness
### rather than kind: "an arithmetic operand typed decimal (Tax Rate): the mu
### multiplies in binary floating point and truncates division". A money
### computation that way is wrong by a cent and silently, and there is no
### rounding primitive to state a tax rule with. That is a decision about the
### mu's arithmetic, not about this model.

## Entity Types

Quote(.id) is an entity type.

## Value Types

Tax Rate is a value type.
  The data type of Tax Rate is decimal.
Cap Rate is a value type.
  The data type of Cap Rate is decimal.

## Fact Types

Quote has Tax Rate.
  Each Quote has at most one Tax Rate.
Quote has Cap Rate.
  Each Quote has at most one Cap Rate.
Quote has submission- Tax Rate.
Quote has response- Tax Rate.
Quote has total- Tax Rate. *
Quote is steep. *
Quote is over cap. *
Quote is over six. *

## Derivation Rules

* Quote is steep iff Quote has Tax Rate and Quote has Cap Rate and that Tax Rate exceeds Cap Rate.
* Quote is over cap iff Quote has Cap Rate and that Quote has Tax Rate greater than 6.5.
* Quote is over six iff Quote has Cap Rate and that Quote has Tax Rate greater than 6.
* Quote has total- Tax Rate iff Quote has some submission- Tax Rate and Quote has some response- Tax Rate and total- Tax Rate is submission- Tax Rate plus response- Tax Rate.

## Instance Facts

Quote 'q1' has Tax Rate 6.875.
Quote 'q1' has Cap Rate 6.5.
Quote 'q2' has Tax Rate 4.25.
Quote 'q2' has Cap Rate 6.5.
