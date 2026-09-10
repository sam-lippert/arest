# A leg that names a subtype is the declared leg joined with the subtype's extent

### `that ZIP Code is within some State Jurisdiction` resolves to the declared
### `ZIP Code is within Jurisdiction` with the subtype in the Jurisdiction role
### (ResolveClauseSub), and the recorder declined the rule as "a substituted
### subtype" (support.auto.dev: ten heads, the Vehicle Purchase Quote amounts,
### 2026-09-10). The restriction the sentence states is membership of the
### subtype, and the store carries every extent: an asserted subtype's is the
### reflective `Object Type Instance is instance of Object Type` selected on
### the subtype's name (population inclusion materialised up the chain, so an
### instance of a further subtype is in it too); a derived subtype's is its own
### population, the head its rule produces. The leg's rows are joined with that
### extent on the substituted column and the accumulator's own columns kept.

Quote(.id) is an entity type.
ZIP Code(.code) is an entity type.
Jurisdiction(.id) is an entity type.
State Jurisdiction is a subtype of Jurisdiction.
County Jurisdiction is a subtype of Jurisdiction.
Rate is a value type.
  The data type of Rate is integer.
Level is a value type.

Quote has ZIP Code.
  Each Quote has at most one ZIP Code.
ZIP Code is within Jurisdiction.
Jurisdiction has Rate.
  Each Jurisdiction has at most one Rate.
Jurisdiction has Level.
  Each Jurisdiction has at most one Level.
Quote has state- Rate. *
Quote has local- Rate. *

Local Jurisdiction is a subtype of Jurisdiction.
* Each Local Jurisdiction is a Jurisdiction that has Level 'local'.

* Quote has state- Rate iff Quote has ZIP Code and that ZIP Code is within some State Jurisdiction and that State Jurisdiction has Rate.
* Quote has local- Rate iff Quote has ZIP Code and that ZIP Code is within some Local Jurisdiction and that Local Jurisdiction has Rate.

Jurisdiction 'J1' has Rate 1.
Jurisdiction 'J1' has Level 'local'.
State Jurisdiction 'S1' has Rate 6.
State Jurisdiction 'S1' has Level 'state'.
County Jurisdiction 'C1' has Rate 2.
County Jurisdiction 'C1' has Level 'local'.
ZIP Code '111' is within Jurisdiction 'J1'.
ZIP Code '222' is within Jurisdiction 'S1'.
ZIP Code '222' is within Jurisdiction 'C1'.
Quote 'q1' has ZIP Code '111'.
Quote 'q2' has ZIP Code '222'.
