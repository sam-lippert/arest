# A specialised head role with no body column is filled from the subtype's extent

### `Person is subject to Minnesota Authority if Person works in State
### 'Minnesota'` names a subtype on the head's Authority role and binds nothing
### to it: every Minnesota Authority pairs with every Person the body keeps. Both
### arms built the NORMA rule with the subtype as its root and declined the recipe
### ("a specialised role with no body column and no literal" from the single
### clause with a value condition, "a head role from a subtype extent" from the
### chain; support.auto.dev's Person / Organization is subject to Minnesota
### Authority, 2026-09-10). The fill is the body rows cross-joined with the
### subtype's extent -- a joinon with no key pairs, Backus's and-of-nothing -- the
### extent's instance column appended and projected into the head. An asserted
### subtype's extent is the reflective instance-of population selected on its
### name, which exists where the metamodel is read (the lab store), so this probe
### pins the recipes and the rows are verified there.

Person(.id) is an entity type.
Organization(.id) is an entity type.
Customer(.id) is an entity type.
Authority(.id) is an entity type.
Minnesota Authority is a subtype of Authority.
State(.name) is an entity type.
Residence is a value type.
Name is a value type.

Authority has Name.
  Each Authority has at most one Name.
Person works in State.
Person is Customer.
  Each Person is at most one Customer.
Customer has Residence.
  Each Customer has at most one Residence.
Organization transacts business in State.
Person is subject to Authority. +
Organization is subject to Authority. +

+ Person is subject to Minnesota Authority if Person works in State 'Minnesota'.
+ Person is subject to Minnesota Authority if Person is Customer and that Customer has Residence 'Minnesota'.
+ Organization is subject to Minnesota Authority if Organization transacts business in State 'Minnesota'.

Minnesota Authority 'a1' has Name 'MN Revenue'.
Minnesota Authority 'a2' has Name 'MN DPS'.
Authority 'a3' has Name 'TX Comptroller'.
Person 'p1' works in State 'Minnesota'.
Person 'p2' works in State 'Texas'.
Person 'p3' is Customer 'c3'.
Customer 'c3' has Residence 'Minnesota'.
Organization 'o1' transacts business in State 'Minnesota'.
Organization 'o2' transacts business in State 'Texas'.
