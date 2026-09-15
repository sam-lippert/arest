# An aggregate with no form in the grammar: named, not silently undelivered

Basket(.id) is an entity type.
Fruit(.id) is an entity type.
Grower(.name) is an entity type.
Server(.name) is an entity type.
Log Entry(.id) is an entity type.
Weight is a value type.
Total Weight is a value type.
Season is a value type.
Tally is a value type.
Status Code is a value type.
Window is a value type.
Error Tally is a value type.

Basket holds Fruit.
Fruit has Weight.
Fruit grew in Season.
Grower tends Basket.
Log Entry has Server.
Log Entry has Status Code.
Log Entry falls in Window.
Basket has Total Weight. *
Grower has Tally for Season. *
Server has Error Tally for Window. *

* Basket has Total Weight iff Total Weight is the sum of Weight where Basket holds Fruit and that Fruit has that Weight.

* Grower has Tally for Season iff Tally is the count of Fruit where Grower tends Basket and that Basket holds Fruit and that Fruit grew in that Season.

* Server has Error Tally for Window iff Error Tally is the count of Log Entry where Log Entry has that Server and Log Entry has Status Code of 400 or more and Log Entry falls in that Window.
