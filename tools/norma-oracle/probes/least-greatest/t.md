# The least or greatest of two values: a cap on a charged fee, and a cap on a computed tax

Quote(.id) is an entity type.
Cap(.id) is an entity type.
Fee Amount is a value type.
Amount is a value type.
Price is a value type.
Percentage is a value type.

Quote has charged- Fee Amount.
Quote has Cap.
Cap has Fee Amount.
Quote has document- Fee Amount. *
Quote has Price.
Quote has Percentage.
Quote has tax- Amount. *

* Quote has document- Fee Amount iff Quote has charged- Fee Amount and Quote has Cap and that Cap has Fee Amount and document- Fee Amount equals the minimum of charged- Fee Amount and Fee Amount.
* Quote has tax- Amount iff Quote has Price and Quote has Percentage and tax- Amount equals the minimum of 5000 and Price times Percentage divided by 100.
