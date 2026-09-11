# Four shapes that DO build, and the one thing support's blocked rules differ by

### support.auto.dev's two most-asked questions -- is this Customer
### subscribed, what Status is this Feature Request in -- are both undelivered,
### and the first guess was that a rule cannot read a DERIVED cell as a body
### leg. This probe was written to reproduce that and does not. Four shapes
### build and deliver:
###   a body leg on a derived unary                 (Customer is waiting)
###   the same where the leg names a SUBTYPE        (Customer is cleared)
###   a derived binary leg carrying a literal       (Customer is settled up)
###   the derived head itself joining two fact types (Account is currently in State)
### So none of those is the class, and that is worth keeping: a negative result
### narrows the next search, and this one is cheap to re-run.

### WHAT SUPPORT'S RULES ACTUALLY DIFFER BY, from its own check output:
###   clause names no fact type: that Subscription is currently in Status 'Active'
###   clause names no fact type: that Resource is currently in some Status
### The leg does not RESOLVE. `Object Type Instance is currently in Status` is
### declared over Object Type Instance, and Subscription and Resource are app
### entity types with no subtype edge to it -- correctly, because an instance
### is not a subtype: the metamodel relates them by `Object Type Instance is
### instance of Object Type`, which is instance-of, not subtyping (Halpin).
### Every shape below declares the edge with `is a subtype of` and builds,
### which is exactly why they do not reproduce it.

### So an app entity cannot appear in ANY metamodel fact type whose player is
### Object Type Instance, and going through the state machine does not help:
### `State Machine is for Object Type Instance` has the same player.

### THE EDGE IS NOT THE ENGINE'S TO ADD, MEASURED 2026-09-10. The obvious
### repair -- have the oracle mint `X is a subtype of Object Type Instance`
### for every entity type that has no supertype -- was measured before being
### written, and the measurement disqualifies it. NORMA ABSORBS a subtype into
### its supertype's table, so a declared edge costs the subtype its table:
###
###                        base   support   eu-law
###   entity types          116       548     1063
###   declared subtypings   111       141      250
###   entity types w/o one    5       407      813
###   tables NORMA maps       5       435      772
###   columns on Function   304       341      324
###   columns, all tables     -      1602     2053
###
### In support NOT ONE of User, Event, Citation, State Machine, Guard Run,
### Fact, Object Type Instance or Customer has a table of its own: all 141
### declared subtypes live in `Function`. `Subscription`, which has no
### supertype, has its own table. Minting the edge for the 407 that lack one
### would absorb every remaining table into `Function`, leaving support ONE
### table of about 1,600 columns and eu-law ONE of about 2,050. That is not a
### side effect of the change; it is the change.
###
### WHAT WORKS INSTEAD is already in the corpus and costs one sentence. Support
### reaches Object Type Instance for Customer the ordinary way -- `Customer is
### a subtype of User`, and `User is a subtype of Object Type Instance`
### (instances.md:39) -- and every shape below declares its edge and builds.
### A type whose state machine an app wants to read declares the edge in the
### app's own readings, per type, deliberately, and pays one table for it.
### An implied ancestor is not a substitute: resolving the clause without a
### SubtypeFact leaves NORMA's join path no subtype step to walk, which is
### what `joins to a path role with an incompatible role player` said when
### that shortcut was tried and reverted on 2026-09-10.
###
### SAM RULED ON THE SCHEMA SHAPE, 2026-09-10, shown this measurement:
### "Absorbtion should be configurable, same as in NORMA." NORMA carries the
### choice per SUBTYPE FACT, not per object type: AssimilationMapping has an
### AbsorptionChoice, related to its fact type by AssimilationMappingCustomizes-
### FactType at ZeroOne, and AssimilationAbsorptionChoice has three literals
### (OialDcilBridge.dsl:398) --
###   Absorb      all assimilations are pulled into the supertype's table
###   Partition   each subtype gets its own table, supertype data duplicated
###   Separate    each subtype gets its own table, supertype data in a
###               separate referenced table
### The stored default is Absorb, and GetDefaultAbsorptionChoice answers Absorb
### for a SubtypeFact or an objectification-implied fact type and Separate for
### anything else (AssimilationMapping.cs:429), which is exactly the one-table
### outcome measured above. So the numbers here are NORMA's default and not
### NORMA's only answer, and making the choice sayable is the next piece of
### work rather than a decision anyone still owes.

Customer(.id) is an entity type.
Ticket(.id) is an entity type.
Status(.name) is an entity type.

Ticket has Status.
  Each Ticket has at most one Status.
Customer has Ticket.
Ticket is open. *
Customer is waiting. +

* Ticket is open if that Ticket has Status 'open'.
+ Customer is waiting if Customer has Ticket and that Ticket is open.

Party(.id) is an entity type.
Client(.id) is an entity type.
Client is a subtype of Party.
Party has Balance.
  Each Party has at most one Balance.
Balance is a value type.
Party is settled. *
Customer has Client.
Customer is cleared. +

* Party is settled if that Party has Balance 'zero'.
+ Customer is cleared if Customer has Client and that Client is settled.

Account(.id) is an entity type.
Holder(.id) is an entity type.
Holder is a subtype of Account.
Machine(.id) is an entity type.
State(.name) is an entity type.
Machine is for Account.
Machine is currently in State.
Account is currently in State. *
Customer has Holder.
Customer is settled up. +

* Account is currently in State if some Machine is for that Account and that Machine is currently in that State.
+ Customer is settled up if Customer has Holder and that Holder is currently in State 'clear'.
