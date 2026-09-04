# A clause naming an objectification anaphorically, twice, with `some other` and an unquoted number

Fact(.id) is an entity type.
Role(.id) is an entity type.
Reading(.id) is an entity type.
Object Type Instance(.id) is an entity type.
Position is a value type.

Fact fills Role.
  Each Fact, Role combination occurs at most once in the population of Fact fills Role.
RoleInstance objectifies "Fact fills Role".
RoleInstance uses Object Type Instance.
Role is used in Reading.
  Each Role, Reading combination occurs at most once in the population of Role is used in Reading.
RoleIsUsedInReading objectifies "Role is used in Reading".
RoleIsUsedInReading has Position.
Fact joins Fact. *

* Fact1 joins Fact2 iff Fact1 fills some Role1 and that RoleInstance uses some Object Type Instance and that Role1 is used in some Reading1 and that RoleIsUsedInReading has Position 2 and some other Fact2 fills some Role2 and that RoleInstance uses that Object Type Instance and that Role2 is used in some Reading2 and that RoleIsUsedInReading has Position 1.
