# A computed head role is a left fold of calc steps, literals paired on

### `tax- Amount equals Price times Rate divided by 100` is Divide(Multiply(Price,
### Rate), 100) in the NORMA rule, nested left to right; the recipe emitter took
### exactly one binary operation with both operands bound by legs and declined
### the rest as "arithmetic of more than one operation" (seven of
### support.auto.dev's tax amounts, 2026-09-10), a literal operand with it. Each
### step now reads the previous step's column as its left operand, a numeric
### literal is paired on as a column, and a bare operand is a copy of its
### column. `the minimum of` names a primitive this grammar lacks and says so.
### The values compute because the roles are typed integer: the oracle writes
### an integer-typed value type's values as numbers (N), the kind the hosts'
### `+ - * /` and `cmp` take, and a literal on such a role the same way; the
### first recording of this probe threw "* on non-number" over atoms.

Quote(.id) is an entity type.
Price is a value type.
  The data type of Price is integer.
Rate is a value type.
  The data type of Rate is integer.
Amount is a value type.
  The data type of Amount is integer.

Quote has Price.
  Each Quote has at most one Price.
Quote has Rate.
  Each Quote has at most one Rate.
Quote has tax- Amount. *
Quote has total- Amount. *
Quote has base- Amount. *
Quote has capped- Amount. *

* Quote has tax- Amount iff Quote has Price and Quote has Rate and tax- Amount equals Price times Rate divided by 100.
* Quote has total- Amount iff Quote has Price and Quote has tax- Amount and total- Amount equals Price plus tax- Amount plus 5.
* Quote has base- Amount iff Quote has Price and base- Amount equals Price.
* Quote has capped- Amount iff Quote has Price and Quote has tax- Amount and capped- Amount equals the minimum of Price and tax- Amount.

Quote 'q1' has Price 200.
Quote 'q1' has Rate 8.
Quote 'q2' has Price 50.
