# The universal: every X that P Q, laid as a negation with the consequent negated inside it, behind an existential guard

Customer(.id) is an entity type.
Use Case(.name) is an entity type.
API(.name) is an entity type.
Measurement Window is a value type.
Call Volume is a value type.

Customer pursues Use Case.
Customer calls API in Measurement Window with Call Volume.
API is load bearing for Use Case. *

* API is load bearing for Use Case iff some Customer pursues that Use Case and that Customer calls that API in some Measurement Window with some Call Volume and every Customer that pursues that Use Case calls that API in some Measurement Window with some Call Volume.
