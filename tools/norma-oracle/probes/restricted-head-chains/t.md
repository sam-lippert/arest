# The value-restricted head over two-leg bodies: two unaries, a chain, a membership leg

Person(.name) is an entity type.
Customer(.name) is an entity type.
Customer is a subtype of Person.
Account(.id) is an entity type.
Authority(.name) is an entity type.
Delaware Authority(.name) is an entity type.
Delaware Authority is a subtype of Authority.

Person is employed.
Person is resident.
Person holds Account.
Account is active.
Customer accepts current terms.
Person is subject to Authority. +

+ Person is subject to Delaware Authority if Person is employed and that Person is resident.
+ Person is subject to Delaware Authority if Person holds Account and that Account is active.
+ Person is subject to Delaware Authority if Person is a Customer and that Person accepts current terms.
