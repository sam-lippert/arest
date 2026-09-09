# AREST Organizations: Access Control

## Entity Types

Organization(.Slug) is an entity type.
App(.Slug) is an entity type.
Domain(.Slug) is an entity type.
External System(.Name) is an entity type.
Generator(.Name) is an entity type.

<!-- Connector-registry business nouns (API Product, Stripe *) and their
     External-System backings were moved OUT of the baked metamodel into the
     non-metamodel `connectors` library (apps/connectors) on 2026-06-24, so the
     base no longer bleeds business connectors into every app (#23). Apps that
     integrate those services depend on `file:../connectors`. -->

## Value Types

Slug is a value type.
Email is a value type.
Access is a value type.
  The possible values of Access are 'private', 'public'.
Label is a value type.
App Type is a value type.
  The possible values of App Type are 'standard', 'chat'.

## Fact Types

### Organization

<!-- `Organization has Name` is not declared here (2026-09-07): Organization
     is an Object Type Instance and so a Function (core.md), and the
     metamodel's `Function has Name` is the fact type an
     `Organization 'x' has Name 'y'` sentence lands in -- the oracle files by
     the supertype's reading -- so a second declaration here was a fact type
     with an `exactly one` and no rows, an alethic violation per organization
     that refused every write. When the oracle files by the most specific
     player the declaration and its mandatory can return. -->

User owns Organization.
  Each Organization is owned by at most one User.

User administers Organization.

User belongs to Organization.

### User

User has Email.
  Each User has at most one Email.
  For each Email, exactly one User has that Email.

### App

App has Name.
  Each App has at most one Name.

App has App Type.
  Each App has at most one App Type.

App has URI.
  Each App has at most one URI.

App has navigable Domain.
  Each App has some navigable Domain.

App belongs to Organization.
  Each App belongs to at most one Organization.

App uses Generator.

<!-- The app's auth context (2026-09-09). Sam: "Users aren't necessary,
     but if an app has no auth context, then all operations are permitted.
     Permission is inherent to users." An app that asserts this fact names
     the fact type whose population answers whether a caller may follow a
     link; canon (auth:designation) reads it, and an app that asserts none
     offers every link to every caller. The named fact type's first role is
     the user; a unary one (`User is authorized`) permits the login every
     operation on every resource, a wider one narrows by operation and by
     resource. -->
App answers authorization with Fact Type.
  Each App answers authorization with at most one Fact Type.

### Domain

Domain has Name.
  Each Domain has at most one Name.

Domain belongs to App.
  Each Domain belongs to at most one App.

Domain belongs to Organization.
  Each Domain belongs to at most one Organization.

Domain has Label.
  Each Domain has at most one Label.

Domain has Access.
  Each Domain has at most one Access.
<!-- Optional, not mandatory (2026-09-07): every domain in a composed
     closure is a Domain, the metamodel's own included, and `exactly one`
     made each of the 57 in support.auto.dev's closure an alethic violation
     that refused every write. The derivation below already reads absence
     as private: only a Domain with Access 'public' is accessed without
     membership. -->

## Value Types (continued)

### Derived Fact Types

User accesses Domain. +
App navigates Domain. +
App displays Object Type. +

App extends App.

Domain depends on Domain.

## Constraints

If some User owns some Organization and that User is deleted then that Organization is also deleted.

Each App, App combination occurs at most once in the population of App extends App.
Each Domain, Domain combination occurs at most once in the population of Domain depends on Domain.

## Ring Constraints

No App extends itself.
No App may cycle back to itself via one or more traversals through extends.

No Domain depends on itself.
No Domain may cycle back to itself via one or more traversals through depends on.

## Derivation Rules

If some User authenticates and that User has some Email and that User does not own any Organization then that User owns some Organization and that Organization has Name that is that Email.

+ User accesses Domain if User owns Organization and App belongs to that Organization and Domain belongs to that App.
+ User accesses Domain if User administers Organization and App belongs to that Organization and Domain belongs to that App.
+ User accesses Domain if User belongs to Organization and App belongs to that Organization and Domain belongs to that App.
+ User accesses Domain if Domain has Access 'public'.

+ App navigates Domain if App has navigable Domain.
<!-- ilayer-join-order (2026-06-23): clauses ordered "App contains Domain" ->
     "Object Type is defined in Domain" -> "Object Type is displayed by Element" so each join
     shares a key (Domain, then Object Type) with the prior clause. The original
     Object Type-displayed-first order joined C1(Object Type,Element) x C2(App,Domain) -- which
     share NO variable -- as a full cartesian before the C3 filter, materializing
     a multi-GB witness set that OOM-crashed every app compile.

     2026-09-07: that rule named three fact types this model never declared
     (`App contains Domain`, `Object Type is defined in Domain`, `Object Type is
     displayed by Element`) and every check dropped it as matching no fact type,
     in every store that composes the templates. The rule it meant is the one
     the declared vocabulary can say: an app that displays an object type is
     rendered by the layer generator. -->
+ App uses Generator 'ilayer' if App displays some Object Type.

## Instance Facts

Domain 'organizations' has Access 'public'.
