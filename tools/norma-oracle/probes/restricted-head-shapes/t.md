# The value-restricted head over the bodies the state-law rules use

Corporation(.name) is an entity type.
State(.name) is an entity type.
Nexus(.id) is an entity type.
Minnesota Nexus(.id) is an entity type.
Minnesota Nexus is a subtype of Nexus.
Nexus Type is a value type.
Dispute(.id) is an entity type.
Arbitration Proceeding(.id) is an entity type.
Governing Law is a value type.
Status is a value type.
Person(.name) is an entity type.
Customer(.name) is an entity type.
Customer is a subtype of Person.
Authority(.name) is an entity type.
Delaware Authority(.name) is an entity type.
Delaware Authority is a subtype of Authority.

Corporation has principal place of business in State.
Corporation has Nexus of Nexus Type. +
Dispute is governed by Governing Law.
Dispute has Status.
Dispute requires Arbitration Proceeding. +
Customer accepts current terms.
Person is subject to Authority. +

+ Corporation has Minnesota Nexus of Nexus Type 'physical presence' if Corporation has principal place of business in State 'Minnesota'.
+ Dispute requires Arbitration Proceeding if Dispute is governed by Governing Law 'Delaware' and Dispute has Status 'negotiation-failed'.
+ Person is subject to Delaware Authority if Person is Customer and that Customer accepts current terms.
