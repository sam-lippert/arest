# An aggregate that ends a chain: legs reach the schedule, the sum ranges over its fees

Vehicle Purchase Quote(.id) is an entity type.
State(.name) is an entity type.
Vehicle Fee Schedule(.id) is an entity type.
DMV Fee(.name) is an entity type.
ZIP Code is a value type.
Amount is a value type.
Fee Amount is a value type.

Vehicle Purchase Quote has ZIP Code.
ZIP Code is in State.
Vehicle Fee Schedule belongs to State.
Vehicle Fee Schedule has DMV Fee.
DMV Fee has Fee Amount.
Vehicle Purchase Quote has dmv-fee-total- Amount. *

* Vehicle Purchase Quote has dmv-fee-total- Amount iff Vehicle Purchase Quote has ZIP Code and that ZIP Code is in some State and Vehicle Fee Schedule belongs to that State and dmv-fee-total- Amount is the sum of Fee Amount where that Vehicle Fee Schedule has DMV Fee and that DMV Fee has Fee Amount.
