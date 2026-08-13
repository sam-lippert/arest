# AREST UI: Instance-Detail (Form) View Derivation — task-934-2

> **Status: canonized 2026-08-01.** The former status block cited
> `lib.rs`, `UI_VIEW_READINGS`, and tests in `crates/arest/` — a source
> layout absent from this repository, so none of it was verifiable. It is
> removed rather than restated. What the reading asserts is the model.

## Overview

An instance/detail view-projection.View of an Object Type projects its Fact Types into a form
structure — one `ViewElement` per Fact Type the Object Type participates in, with the
widget chosen by the Fact Type's value-type. The derivation is lazy (resolved
at fetch time via `resolve_view`). ViewElement identity comes from the
objectified association's identification scheme below, so it is stable
across re-reads by construction.

This is design-doc §3.2 (instance detail + form view) instantiated as a
predicate reading. The join is a 4-antecedent chain over view-projection.View→Object Type, Fact
Type→Role→Object Type, yielding one ViewElement per (view-projection.View, Fact Type) binding.

## The Derivation (Predicate Reading Form)

<!-- Canonized 2026-08-01: the `(E)` existential heads are gone, replaced by
     objectification under a spanning uniqueness constraint. The five rules
     all carried the SAME antecedent join and the same frontier, which is
     the tell: the frontier was an identifying association nobody had
     declared. Declaring it, constraining it with a UC that spans all three
     roles (Halpin, *Objectification and Atomicity*, p. 2 rev. 2020-04-28 —
     objectification is admitted only for a fact type with a spanning UC),
     and objectifying it gives ViewElement an identity the population
     already fixes instead of one minted from the binding.

     The consequence is not cosmetic. A skolem head invents a value, which
     is why it needed surface syntax and a parser path; an objectified head
     is PROJECTIVE — it introduces no fresh entity, because the ViewElement
     exists exactly when the objectified fact does. That satisfies Def. 4
     ("Heads are projective: no derivation rule introduces a fresh entity")
     and puts these rules back inside the admitted fragment of Def. 3.
     Follows the form already used in metamodel/core.md for Constraint Span
     and API. view-list.md and view-menu.md carry the identical shape. -->

### ViewElement (objectification of "View displays Role of Fact Type")

```
View displays Role of Fact Type.
  Each View, Fact Type, Role combination occurs at most once in the
    population of View displays Role of Fact Type.
  This association with View, Fact Type, Role provides the preferred
    identification scheme for ViewElement.
```

The association is populated by one projective rule — the former shared
frontier, now declared as the join path it always was:

```
* View displays Role of Fact Type if and only if
    view-projection.View is for Object Type
    and view-projection.View has View Kind 'instance'
    and Fact Type has Role
    and Role is played by Object Type.
```

and the widget rules become ordinary derivations over the objectified
object type, each reached through the link role the objectification
provides rather than by re-stating the join:

```
* ViewElement has Component Role 'text-input' if and only if
    ViewElement involves Fact Type and that Fact Type has Format 'text'.

* ViewElement has Component Role 'date-picker' if and only if
    ViewElement involves Fact Type and that Fact Type has Format 'date'.

* ViewElement has Component Role 'checkbox' if and only if
    ViewElement involves Fact Type and that Fact Type has Format 'boolean'.

* ViewElement has Component Role 'combo-box' if and only if
    ViewElement involves Fact Type and that Fact Type has some Enum Values.
```

All five rules carry `*` (lazy, `view-projection.View` materialization policy
— never enters the eager forward chain). The `view-projection.View has View
Kind 'instance'` antecedent is a literal-pinned filter on the one rule that
still carries the join; the four widget rules no longer restate it, because
they reach the Fact Type through the objectification's link role. There were
six rules before, and the sixth — `ViewElement renders Fact Type` — is now
the objectified association itself rather than a separate derivation.

The combo-box rule uses the eagerly-projected `Fact Type has Enum Values`
cell, parallel to `Fact Type has Format`.

## Fact Types

`ViewElement has Component Role` is already declared `*` (fully-derived) in
`view-projection.md`. `ViewElement renders Fact Type` is declared there too
(at most one, view-projection.View-materialized via these rules). The `*` suffix marks them
view-projection.View-materialized so the forward chain never eager-evaluates the join over the
~593-FT metamodel.

`Fact Type has Format` and `Fact Type has Enum Values` are declared `**`
(derived-and-stored, EAGER) here. Eager because: (a) each is a small per-FT
projection (~one row per value-typed FT — no combinatorial blowup), and
(b) the lazy widget rules above must see them materialized in the population
when `resolve_view` evaluates them — lazy `*` projections would require
lazy-on-lazy chaining which `resolve_view` does NOT do.

Fact Type has Format. **
  Each Fact Type has at most one Format.
Fact Type has Enum Values. **
  Each Fact Type has at most one Enum Values.

## Derivation Rules

### Eager projections (Stored / `**`)

Projects the value-type role's Object Type Format and Enum Values onto the Fact Type.
Fire in the forward chain on every apply, before the lazy view rules evaluate.
One output row per value-typed Fact Type (linear, no combinatorial blowup).

** Fact Type has Format if and only if Fact Type has some Role and that Role is played by some Object Type and that Object Type is of Object Kind 'value' and that Object Type has Format.
** Fact Type has Enum Values if and only if Fact Type has some Role and that Role is played by some Object Type and that Object Type is of Object Kind 'value' and that Object Type has some Enum Values.

### Lazy view rules (View / `*`)

Single-line registration form of the prose above. One rule populates the
objectified association; the widget rules read the objectification's link
role instead of restating the join. All heads are projective.

* View displays Role of Fact Type if and only if view-projection.View is for Object Type and view-projection.View has View Kind 'instance' and Fact Type has Role and Role is played by Object Type.
* ViewElement has Component Role 'text-input' if and only if ViewElement involves Fact Type and that Fact Type has Format 'text'.
* ViewElement has Component Role 'date-picker' if and only if ViewElement involves Fact Type and that Fact Type has Format 'date'.
* ViewElement has Component Role 'checkbox' if and only if ViewElement involves Fact Type and that Fact Type has Format 'boolean'.
* ViewElement has Component Role 'combo-box' if and only if ViewElement involves Fact Type and that Fact Type has some Enum Values.

## Metamodel Fact-Type Names (Verified)

The following cell names have been verified against `readings/ui/view-projection.md`
and `readings/core/core.md`:

| FORML 2 reading text                 | Cell name                        |
|--------------------------------------|----------------------------------|
| view-projection.View is for Object Type                     | `View_is_for_Object_Type`               |
| view-projection.View has View Kind 'instance'        | `View_has_View_Kind`             |
| Fact Type has Role                   | `Fact_Type_has_Role`             |
| Role is played by Object Type               | `Object_Type_plays_Role` (inverse read) |
| Object Type is of Object Kind                 | `Object_Type_is_of_Object_Kind`           |
| Object Type has Format                      | `Object_Type_has_Format`                |
| Object Type has Enum Values                 | `Object_Type_has_Enum_Values`           |
| Fact Type has Format                 | `Fact_Type_has_Format` (eager)   |
| Fact Type has Enum Values            | `Fact_Type_has_Enum_Values` (eager) |
| ViewElement renders Fact Type        | `ViewElement_renders_Fact_Type`  |
| ViewElement has Component Role       | `ViewElement_has_Component_Role` |

`View_is_for_Object_Type` and `View_has_View_Kind` are declared in `view-projection.md`.
`Fact_Type_has_Role`, `Object_Type_plays_Role`, `Object_Type_is_of_Object_Kind`, `Object_Type_has_Format`,
and `Object_Type_has_Enum_Values` are declared in `readings/core/core.md`.
`Fact_Type_has_Format` is declared here with `**` (eager/derived-and-stored).

**Projection paths**: the eager rules materialize `Fact_Type_has_Format` and
`Fact_Type_has_Enum_Values` by following `FT → Role → Object Type(value-type) →
Format` and `FT → Role → Object Type(value-type) → Enum Values` respectively. In
production, `Object_Type_is_of_Object_Kind`, `Object_Type_has_Format`, and
`Object_Type_has_Enum_Values` are reconstituted from the absorbed Object Type-cell fields
via `FetchOrPhi`. In test mini-schemas they are pushed directly. Either way,
the eager derivations materialize both projection cells before the lazy widget
rules evaluate.

## Join Chain

### Eager projections (pre-populate `Fact_Type_has_Format` + `Fact_Type_has_Enum_Values`):
```
Fact Type has some Role              (FT → Role_R)
  ⋈ that Role is played by some Object Type (Role_R → Object_Type_V, value-type)
  ⋈ Object_Type_V has Object Kind 'value'  (filtered)
  ⋈ Object_Type_V has Format                (Object_Type_V → Format_F)
→ emits: (Fact Type=FT, Format=Format_F)

Fact Type has some Role              (FT → Role_R)
  ⋈ that Role is played by some Object Type (Role_R → Object_Type_V, value-type)
  ⋈ Object_Type_V has Object Kind 'value'  (filtered)
  ⋈ Object_Type_V has some Enum Values      (Object_Type_V → Enum_Values_E)
→ emits: (Fact Type=FT, Enum Values=Enum_Values_E)
```

### Base (renders) + widget rules:
```
view-projection.View is for Object Type                          (view-projection.View → Object_Type_N, entity-type)
  ⋈ view-projection.View has View Kind 'instance'        (view-projection.View → View_Kind, filtered to 'instance')
  ⋈ Fact Type (FT) has Role              (FT → Role_R)
  ⋈ Role is played by Object Type               (Role_R → Object_Type_N)     [join on Object_Type_N + Role_R]
```

For text/date/boolean widget rules, additionally:
```
  ⋈ Fact Type (FT) has Format 'text'     (FT → Format, filtered to 'text')
```
(Format and Enum Values are materialized eagerly; FetchOrPhi finds them directly.)

For combo-box, additionally:
```
  ⋈ Fact Type (FT) has some Enum Values  (FT → Enum Values, materialized eagerly)
```

Join keys: `view-projection.View` (FTs 1+2), `Object Type` (FTs 1+4), `Role` (FTs 3+4), `Fact Type` (FTs 3+5)

Because each view-projection.View is for exactly one Object Type (UC from view-projection.md), and
each Role is played by exactly one Object Type (UC from core.md), the
`(view-projection.View, Object Type, Role)` combination collapses to `(view-projection.View, Role)` as the
discriminating prefix — one ViewElement per (view-projection.View, Fact Type) pair.

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
