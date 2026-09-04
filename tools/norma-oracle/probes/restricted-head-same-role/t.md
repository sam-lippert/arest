# A head that specialises a role AND names its value, over a single leg and over a chain

Customer(.name) is an entity type.
Member(.name) is an entity type.
Member is a subtype of Customer.
Authority(.citation) is an entity type.
Regulation(.citation) is an entity type.
Regulation is a subtype of Authority.
Country Code is a value type.

Customer is in EEA.
Customer has Country Code.
Member holds Membership.
Customer is subject to Authority. +

Regulation 'GDPR (EU 2016/679)'.

+ Customer is subject to Regulation 'GDPR (EU 2016/679)' if Customer is in EEA.
+ Customer is subject to Regulation 'GDPR (EU 2016/679)' if Customer is a Member and that Member holds Membership.
