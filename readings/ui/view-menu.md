# AREST UI: Menu-View Derivation — task-934-3

> **Status: canonized 2026-08-01.** The former status claims cited
> `lib.rs`, `UI_VIEW_READINGS`, and `compile_explicit_derivation_tests.rs`
> in `crates/arest/` — a source layout absent from this repository, so none
> of them were verifiable. They are removed rather than restated. What the
> reading now asserts is the model, which stands on its own.

## Overview

An Object Type's action menu is a DERIVED view. Each menu item is a `ViewElement`
that renders a `Transition` — specifically, every transition that is legal from
the entity's CURRENT status. The derivation is lazy (resolved at fetch time
via `resolve_view`). `ViewElement` identity is fixed by the preferred
identification scheme of the objectified association below, so it is
deterministic across re-reads by construction rather than by a computed key.

This is design-doc §4.5 (Theorem 4 as a view) instantiated as a predicate reading.

## The Derivation (Predicate Reading Form)

<!-- Canonized 2026-08-01, same treatment as view-detail.md and
     view-list.md. Worth naming what the objectified association turns out
     to be here: `Object Type Instance affords Transition` is Theorem 2's
     transitions(status(e)) — the affordance set the paper proves equal to
     Adm. So the menu ViewElement is the objectification of the HATEOAS
     affordance relation itself, and the menu is that relation wearing a
     Component Role. The UC spans both roles, satisfying Halpin's 2020
     precondition, and the head is projective per Def. 4. -->

### ViewElement (objectification of "Object Type Instance affords Transition")

```
Object Type Instance affords Transition.
  Each Object Type Instance, Transition combination occurs at most once in the
    population of Object Type Instance affords Transition.
  This association with Object Type Instance, Transition provides the preferred
    identification scheme for ViewElement.
```

The association is populated by one projective rule — the live-status
affordance join:

```
* Object Type Instance affords Transition if and only if
    Object Type Instance is currently in Status
    and Transition is from that Status
    and Transition is defined in State Machine Definition
    and that State Machine Definition is for Object Type
    and Object Type Instance is instance of that Object Type.
```

and the Component Role derives from what the element involves:

```
* ViewElement has Component Role 'button' if and only if
    ViewElement involves Transition.
```

Both rules carry `*` (lazy, `view-projection.View` materialization policy — never enters the
eager forward chain that caused the task-934 metamodel hang).

## Fact Types

`ViewElement has Component Role` is already declared `*` (fully-derived) in
`view-projection.md`; only the menu-specific `renders Transition` link is
declared here. The `*` suffix marks it view-projection.View-materialized so the
forward chain never eager-evaluates the 5-way join over the ~593-FT metamodel.

ViewElement renders Transition. *

## Derivation Rules

Single-line registration form of the prose above. One rule populates the
objectified association; the other reads the objectification's link role.
Both heads are projective.

* Object Type Instance affords Transition if and only if Object Type Instance is currently in Status and Transition is from that Status and Transition is defined in State Machine Definition and that State Machine Definition is for Object Type and Object Type Instance is instance of that Object Type.
* ViewElement has Component Role 'button' if and only if ViewElement involves Transition.

## Metamodel Fact-Type Names (Verified)

The following cell names have been verified against `readings/core/state.md`,
`readings/core/instances.md`, and `readings/core/core.md`:

| FORML 2 reading text                         | Cell name                                          |
|----------------------------------------------|----------------------------------------------------|
| State Machine Definition is for Object Type         | `State_Machine_Definition_is_for_Object_Type`             |
| Transition is defined in State Machine Def.  | `Transition_is_defined_in_State_Machine_Definition`|
| Transition is from Status                    | `Transition_is_from_Status`                        |
| State Machine is currently in Status         | `State_Machine_is_currently_in_Status`             |
| State Machine is for Object Type Instance                | `State_Machine_is_for_Object Type Instance`                    |
| Object Type Instance is instance of Object Type                 | `Object Type Instance_is_instance_of_Object_Type`                     |
| Object Type Instance is currently in Status              | `Object Type Instance_is_currently_in_Status`                  |

`Object Type Instance is currently in Status` is the bridge projection declared in
`readings/core/instances.md` and populated per-app by the SM-for-Object Type Instance ×
SM-currently-in-Status join (e.g. `apps/tasks/readings/app.md`). The
menu-view derivation should join on the general-level cells above (the 6-way
join) to work across ALL Object Types+SMs, not just the tasks domain.

## Join Chain

```
Object Type Instance is currently in Status            (Object Type Instance → Status_S)
  ⋈ Transition is from Status             (Transition → Status_S)  [join on Status_S]
  ⋈ Transition is defined in SMD          (Transition → SMD_D)
  ⋈ State Machine Definition is for Object Type  (SMD_D → Object_Type_N)
  ⋈ Object Type Instance is instance of Object Type          (Object Type Instance → Object_Type_N)      [join on Object_Type_N]
```

The join yields the association `Object Type Instance affords Transition`, which the
objectification identifies `ViewElement` by.

## ViewElement Properties

Each property below used to be a consequence of hashing the frontier. Under
objectification they are consequences of the identification scheme, which is
a stronger footing: the old versions were guarantees the host had to keep,
these are things the model cannot express otherwise.

- **Deterministic**: identity is the `(Object Type Instance, Transition)` pair itself,
  not a function computed over it. Re-reading the same population yields the
  same ViewElements because they are the same facts.
- **Idempotent**: duplicates are not *prevented*, they are unrepresentable —
  the UC spans both roles, so a second ViewElement for the same pair is a
  uniqueness violation rather than a second row.
- **Lazy**: the rules emit `view:{cell}` defs, never `derivation:{cell}`
  defs, resolved at `Func::Fetch` / `Func::FetchOrPhi` time.
- **Terminal-safe**: an entity in a terminal status affords no transitions,
  so the association is empty for it and no ViewElement exists. This now
  follows from the rule body rather than needing a test to establish it.

<!-- Trimmed 2026-08-01. Everything from here down was "Remaining Work"
     and "Test Coverage" — issue-tracker state and test-name inventories
     citing crates/arest/, a source layout this repository does not have.
     Neither is runtime-necessary, so neither belongs in a reading. The
     model above stands without them. -->
