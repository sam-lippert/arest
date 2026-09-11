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
### `State Machine is for Object Type Instance` has the same player. That is
### the gap, it is the engine's rather than support's, and it is not fixed
### here -- this probe records where the search got to and what it ruled out.

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
