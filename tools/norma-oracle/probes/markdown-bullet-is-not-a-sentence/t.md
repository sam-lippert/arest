# A markdown bullet is not a sentence

### support.auto.dev's corpus reads the app's root markdown, and a bullet
### `- **Feature Request** -- Proposed -> Approved -> In Progress -> Shipped`
### was read as a unary fact type over Feature Request with the bullet as its
### predicate text (2026-09-09). A FORML sentence never opens with a hyphen;
### the derivation markers are * and +. The bullet is refused and reported,
### and the reading beside it stands.

Feature Request(.id) is an entity type.
Lifecycle Status(.name) is an entity type.

Feature Request has Lifecycle Status.
- **Feature Request** — Proposed → Approved → In Progress → Shipped.
- a second bullet naming Feature Request and Lifecycle Status together.
