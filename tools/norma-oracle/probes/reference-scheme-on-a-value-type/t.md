# A reference scheme on a value type is refused, not half-built

### `Fetcher is a value type` in the metamodel and `Fetcher(.Fetcher Name) is an
### entity type` in auto.dev are a KIND CONFLICT the first declaration wins
### (support.auto.dev, 2026-09-09). The scheme still ran: the value type got a
### preferred identifier, NORMA answered "An object type with a preferred
### identifier must be an entity type", and its DCIL carried both a value column
### and a fetcherName key. The kind is decided at the declaration; the scheme
### is refused and said, and the facts read against the value type.

Fetcher is a value type.
Fetcher(.Fetcher Name) is an entity type.
Fetcher Implementation is a value type.
Fetcher has Fetcher Implementation.
  Each Fetcher has at most one Fetcher Implementation.
Fetcher 'edge' has Fetcher Implementation 'workerd'.
