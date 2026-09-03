## Entity Types
Customer(.id) is an entity type.
Subscription(.id) is an entity type.
Price(.id) is an entity type.
Product(.id) is an entity type.
## Fact Types
Customer has Subscription.
Subscription has Price.
Price is for Product.
Customer is entitled to Product. *
## Derivation Rules
* Customer is entitled to Product iff Customer has Subscription and that Subscription has Price and that Price is for Product.
