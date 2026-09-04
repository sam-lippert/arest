# The value-restricted head over a membership leg and a leg on the subtype

Person(.name) is an entity type.
Customer(.name) is an entity type.
Customer is a subtype of Person.
Authority(.name) is an entity type.
Delaware Authority(.name) is an entity type.
Delaware Authority is a subtype of Authority.

Customer is registered.
Person is subject to Authority. +

+ Person is subject to Delaware Authority if Person is a Customer and that Customer is registered.
