# Two identical composite declarations are one scheme, said once

### `OAuth Account(.OAuth Provider, .Provider Account Id)` in auth.md and again
### in readings/customer-auth.md (auto.dev, 2026-09-10) declare one scheme; the
### oracle compared the second with the first's mode STRING, which a composite
### leaves empty, printed "<composite>" and reported DECLARED TWICE for words
### that were the same. A composite remembers its components: the same words
### are the duplicate the oracle tolerates for a single mode, and different
### words are named in the report instead of "<composite>".

OAuth Provider is a value type.
Provider Account Id is a value type.
Customer(.Email Address) is an entity type.
OAuth Account(.OAuth Provider, .Provider Account Id) is an entity type.
OAuth Account(.OAuth Provider, .Provider Account Id) is an entity type.
Ticket(.Queue, .Number) is an entity type.
Ticket(.Number) is an entity type.
OAuth Account is for Customer.
  Each OAuth Account is for exactly one Customer.
Ticket is raised by Customer.
  Each Ticket is raised by exactly one Customer.
