# The general chain arm emits an executable recipe: a unary head, a joined leg, and a negated leg as a difference

Authority(.id) is an entity type.
Effective Date is a value type.
  The data type of Effective Date is date.
Supersession Date is a value type.
  The data type of Supersession Date is date.

Authority has Effective Date.
Effective Date is in the past.
Authority has Supersession Date.
Authority is currently in force. *

* Authority is currently in force iff Authority has some Effective Date and that Effective Date is in the past and Authority has no Supersession Date.
