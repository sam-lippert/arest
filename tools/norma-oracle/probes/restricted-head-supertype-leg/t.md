# A restricted head whose one leg is declared over the subject's supertype, and one whose leg names a role in its predicate

Organization(.name) is an entity type.
Corporation(.name) is an entity type.
Corporation is a subtype of Organization.
State(.name) is an entity type.
Nexus(.id) is an entity type.
Minnesota Nexus(.id) is an entity type.
Minnesota Nexus is a subtype of Nexus.
Nexus Type is a value type.
Person(.name) is an entity type.
Authority(.citation) is an entity type.
Florida Authority(.citation) is an entity type.
Florida Authority is a subtype of Authority.

Organization has principal place of business in State.
Organization has Employment Footprint in State.
Corporation has Nexus of Nexus Type. +
Corporation has Florida Nexus. +
Person has Work Location in State.
Person is subject to Authority. +

+ Corporation has Minnesota Nexus of Nexus Type 'physical presence' if Corporation has principal place of business in State 'Minnesota'.
+ Corporation has Florida Nexus if Corporation has Employment Footprint in State 'Florida'.
+ Person is subject to Florida Authority if Person has Work Location in State 'Florida'.
