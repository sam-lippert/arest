# " iff " inside a quoted value is not a derivation rule

### The derivation test read the RAW sentence -- s.Contains(" iff "), with no
### quoting awareness at all and before any value was extracted -- so an
### instance fact whose VALUE said " iff " was reclassified as a rule
### declaration and deferred. Not refused: DEFERRED. No row, no unrecognized
### sentence, no model error, nothing in the map log; only a +1 in the
### "derivation rule (deferred)" census bucket, which is a number nobody reads
### per sentence. That is what swallowed every `Derivation Rule has Text` fact
### (#115), and the loss was blamed on reading theft (#95) until it was probed.
###
### MEASURED 2026-09-15, one byte apart: S2(A("x iff y"), N(1)) landed no row
### while S2(A("x if y"), N(1)) and S2(A("xiffy"), N(1)) both landed exactly.
### Quoted spans are blanked to spaces of the same width before the test now,
### so indices do not move and a rule's own iff -- which is never inside a
### value -- still reads. The rule below is that control.

Clause(.tag) is an entity type.
Body is a value type.
Label is a value type.

Clause has Body.
  Each Clause has at most one Body.
Clause has Label.
  Each Clause has at most one Label.

Clause is labelled. *

* Clause is labelled iff Clause has some Label.

Clause 'a' has Body 'S2(A("x iff y"), N(1))'.
Clause 'b' has Body 'S2(A("x if y"), N(1))'.
Clause 'c' has Body '* App navigates Domain iff App has navigable Domain'.
Clause 'd' has Body 'one iff two iff three'.
Clause 'a' has Label 'kept'.
