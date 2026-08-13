# AREST UI: Collection-List View Derivation — task-934-2

> **Status: canonized 2026-08-01.** The former status block cited
> `lib.rs`, `UI_VIEW_READINGS`, and tests in `crates/arest/` — a source
> layout absent from this repository, so none of it was verifiable. It is
> removed rather than restated. What the reading asserts is the model.

## Overview

A collection view-projection.View of an Object Type lists its instances. Each row is a `ViewElement`
that renders one `Object Type Instance` instance of that Object Type. The derivation is lazy
(resolved at fetch time via `resolve_view`). ViewElement identity comes from
the objectified association's identification scheme below, so it is stable
across re-reads by construction.

This is design-doc §3.1/§4.6 (collection rows) instantiated as a predicate
reading. The join is simpler than the menu (3-antecedent chain vs 5-antecedent
chain), and objectifies the same way.

## The Derivation (Predicate Reading Form)

<!-- Canonized 2026-08-01, same treatment as view-detail.md. Both rules
     shared one antecedent join, which is the tell that the frontier was an
     undeclared identifying association. Declared, given a UC spanning both
     roles (Halpin, *Objectification and Atomicity*, rev. 2020-04-28:
     objectification requires a spanning UC), and objectified — so the head
     is projective per Def. 4 and the `(E)` syntax is unnecessary. -->

### ViewElement (objectification of "View lists Object Type Instance")

```
View lists Object Type Instance.
  Each View, Object Type Instance combination occurs at most once in the population of
    View lists Object Type Instance.
  This association with View, Object Type Instance provides the preferred
    identification scheme for ViewElement.
```

The association is populated by one projective rule:

```
* View lists Object Type Instance if and only if
    view-projection.View is for Object Type
    and view-projection.View has View Kind 'collection'
    and Object Type Instance is instance of Object Type.
```

and the Component Role derives from the View it involves rather than by
restating the join — which also makes explicit what the original pair left
implicit, that 'list' followed from the View Kind and not from the
Object Type Instance:

```
* ViewElement has Component Role 'list' if and only if
    ViewElement involves View and that View has View Kind 'collection'.
```

Both rules carry `*` (lazy, `view-projection.View` materialization policy — never enters the
eager forward chain). The `view-projection.View has View Kind 'collection'` antecedent is a
literal-pinned filter: the parser records it as `AntecedentRoleLiteral`
(role = "View Kind", value = "collection") and the join compiler applies it as
a per-antecedent predicate filter over the `View_has_View_Kind` cell.

## Fact Types

`ViewElement has Component Role` is already declared `*` (fully-derived) in
`view-projection.md`. The collection-specific `renders Object Type Instance` link is
declared here. The `*` suffix marks it view-projection.View-materialized so the forward chain
never eager-evaluates the join over the ~593-FT metamodel.

ViewElement renders Object Type Instance. *

## Derivation Rules

Single-line registration form of the prose above. `View is for exactly one
Object Type` (UC in view-projection.md), so the objectified association's
identifying pair is effectively (View, Object Type Instance) — one ViewElement per row,
which is the design intent stated as identification rather than as a
consequence of which nouns happened to enter a hash.

Component Role 'list' is chosen because §3.1 of the design doc maps each
collection row instance to the `list` Component (the `list` value is already
in the `components.md` enum — no new value needed). The `list` role labels
the row cell in the list view surface, matching iFactr's `IContentCell` shape.

* View lists Object Type Instance if and only if view-projection.View is for Object Type and view-projection.View has View Kind 'collection' and Object Type Instance is instance of Object Type.
* ViewElement has Component Role 'list' if and only if ViewElement involves View and that View has View Kind 'collection'.

## Metamodel Fact-Type Names (Verified)

The following cell names have been verified against `readings/ui/view-projection.md`
and `readings/core/instances.md`:

| FORML 2 reading text               | Cell name                      |
|------------------------------------|-------------------------------|
| view-projection.View is for Object Type                   | `View_is_for_Object_Type`            |
| view-projection.View has View Kind 'collection'    | `View_has_View_Kind`          |
| Object Type Instance is instance of Object Type       | `Object Type Instance_is_instance_of_Object_Type`|

`View_is_for_Object_Type` and `View_has_View_Kind` are declared in `view-projection.md`.
`Object Type Instance_is_instance_of_Object_Type` is declared in `readings/core/instances.md`.
`View Kind` is a value type (not entity-typed) — it is excluded from the
entity-typed frontier (it is not part of the identifying tuple).

## Join Chain

```
view-projection.View is for Object Type                          (view-projection.View → Object_Type_N)
  ⋈ view-projection.View has View Kind 'collection'      (view-projection.View → View_Kind, filtered to 'collection')
  ⋈ Object Type Instance is instance of Object Type         (Object Type Instance → Object_Type_N)     [join on Object_Type_N]
```

Join keys (shared by ≥2 antecedents): `view-projection.View` (appears in FTs 1+2), `Object Type`
(appears in FTs 1+3).

Because each view-projection.View is for exactly one Object Type (UC from view-projection.md), the
`(view-projection.View, Object Type)` pair collapses to `(view-projection.View)` as the discriminating prefix, so
the effective granularity is one ViewElement per (view-projection.View, Object Type Instance) pair —
exactly the design-doc §3.1 intent.

## ViewElement Properties

Each property below used to be a consequence of hashing the frontier. Under
objectification they follow from the identification scheme instead, which is
a stronger footing: the old versions were guarantees the host had to keep,
these are things the model cannot express otherwise.

- **Deterministic**: identity is the identifying tuple itself, not a function
  computed over it. Re-reading the same population yields the same
  ViewElements because they are the same facts.
- **Idempotent**: duplicates are not *prevented*, they are unrepresentable —
  the UC spans the association's roles, so a second ViewElement for the same
  tuple is a uniqueness violation rather than a second row.
- **Lazy**: the rules emit `view:{cell}` defs, never `derivation:{cell}`
  defs, resolved at `Func::Fetch` / `Func::FetchOrPhi` time.

<!-- Trimmed 2026-08-01. Everything from here down was "Remaining Work"
     and "Test Coverage" — issue-tracker state and test-name inventories
     citing crates/arest/, a source layout this repository does not have.
     Neither is runtime-necessary, so neither belongs in a reading. The
     model above stands without them. -->
