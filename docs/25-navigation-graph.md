# 25 — The Entity Navigation Graph

Theorem 4 (chapter 04, *HATEOAS as Projection*) and its navigation half, Theorem
4b (chapter 07), give the **local** view: for one entity `e`, the links it carries
— its valid transitions plus one navigation URI per binary fact type it
participates in. That is a neighbour-star: from `e`, here are the adjacent
resources.

A user interface, and an ORM diagram, need the **global** structure the star is a
slice of: which noun is a root, what drills into what, what sits beside what. That
structure is the **Entity Navigation Graph**, and AREST derives it — like
everything else — from the model itself, with no hand-authored menu and no
separate cardinality annotation. It lives in the shared lambda as the
`system:nav_*` family (`engine/shared/arest.canon:4255`–`4396`); this chapter is
its specification.

The graph is *one* structure with two renderings: unfolded in time it is the
**navigation map** (how you drill an app); embedded in space it is the **ORM
diagram layout**. The same edge classification drives both.

## Cardinality is read off uniqueness — it is not stored

AREST never stores a "1:n" annotation. Following ORM (Halpin & Morgan,
*Information Modeling and Relational Databases*, 2nd ed., §4 on uniqueness), a
fact type's cardinality **is** its uniqueness-constraint pattern:

- a uniqueness constraint spanning a **proper subset** of the roles makes the fact
  type **functional** on that subset (the subset determines the rest) —
  many-to-one, a **1:n** relationship;
- a uniqueness constraint spanning **all** the roles makes it **one-to-one** (1:1);
- **no** uniqueness constraint makes it **many-to-many** (m:n).

So the classifier only has to look at the fact type's uniqueness constraints and
its arity. The lambda does exactly that:

- `system:ev_roles` (`arest.canon:4057`) — the fact type's roles (from the
  `role` population), hence its **arity** via `system:nav_arity` = `length ∘
  ev_roles` (`:4292`).
- `system:nav_ucs` (`:4255`) — the constraints of `kind = "uniqueness"` whose
  target is this fact type: its uniqueness constraints.
- `system:nav_spans` (`:4277`) — the number of roles a given uniqueness constraint
  spans (`length` of its `spans` row).
- `system:nav_spanning` (`:4295`) — `not ∘ null` over the uniqueness constraints
  filtered to those whose span **equals the arity**: **true iff some UC spans every
  role**, i.e. the fact type is 1:1.

## The edge classification — `nav_kind`

`system:nav_kind` (`arest.canon:4310`) reduces the above to one of three tags:

```
nav_kind(ft) =  collection   if  nav_ucs(ft) is empty        -- m:n
                peer         if  nav_spanning(ft)             -- 1:1
                child        otherwise                        -- 1:n (functional)
```

- **`child`** — a functional (1:n) fact type. This is a *drill* edge: one side
  determines the other, so from a row on the determining side you descend into the
  dependent rows. Chaining child edges — 1:n into that n's own 1:n, and so on — is
  the spanning descent the navigation map is built from.
- **`peer`** — a 1:1 fact type. The two nouns are co-equal; the edge is a
  *sibling* placed at the same level, not a descent.
- **`collection`** — an m:n fact type. A junction; rendered as a related
  collection beside the node, never a descent (descending an m:n would not
  terminate).

The determinant/dependent *direction* of a `child` edge is refined by which role
carries the subset UC; `nav_kind` returns the class, and the projection
(`nav_of`, below) resolves the direction for a concrete entity.

## The edge and the graph — `nav_control` and `nav`

- `system:nav_players` (`:4324`) — the noun playing each role of the fact type.
- `system:nav_remaining` (`:4332`) — from the current noun, the *other* players:
  the edge's targets (correctly handling ring fact types, where a noun plays more
  than one role, by dropping only one occurrence of self).
- `system:nav_control` (`:4355`) — the **edge record**:
  `⟨ nav_kind(ft), from-noun, nav_remaining(ft, from-noun) ⟩` — a classified,
  directed edge.
- `system:nav_playedfts` (`:4364`) — the fact types the noun plays a role in
  (its `role` rows), and `system:ev_ownfts` (`:4794`) its owned/objectified ones.
- `system:nav` (`:4380`) — the top level: `ALPHA(nav_control)` over the noun's
  played and owned fact types. **`nav(n)` is the set of classified edges out of
  noun `n`.**

The Entity Navigation Graph of an app is `G = ⋃_n nav(n)` — every noun's edge set,
each edge tagged `child` / `peer` / `collection`.

## Rendering 1 — the navigation map

Take the sub-graph of **`child`** edges. It is (barring modelled cycles) a DAG on
the functional relationships. A navigation map is a walk of it:

1. **Roots** are nouns reachable as an entry (top-level collections — those with an
   incoming `collection`/`peer` affordance but not themselves a functional
   dependent), or an explicitly chosen home noun.
2. From a node, **descend** each `child` edge — 1:n into the dependent noun, then
   that noun's own `child` edges, recursively: the "1:n → that n's 1:n → …" spanning
   descent.
3. At each node, its **`peer`** and **`collection`** edges are **siblings** —
   lateral affordances rendered beside the drill path, not descended.
4. A node whose only out-edges are `peer`/`collection` is a **leaf** of the drill.

This is the whole navigation-map generation algorithm: no per-screen menu is
maintained; the legal next moves at any node are recomputed from `nav(n)` and split
by `nav_kind` into *descend* (child) versus *beside* (peer/collection).

## Rendering 2 — the ORM diagram layout

The same graph, embedded in the plane, is the ORM diagram's layout engine:

- **`child`** edges are **rank edges** — a layered (Sugiyama-style) assignment on
  the functional DAG. The determinant is one rank up, the dependent one rank down;
  chained child edges deepen the levels.
- **`peer`** edges join nouns at the **same rank**, placed adjacent.
- **`collection`** edges are drawn as **junction siblings** between their two
  participants, off the main descent.

The drill order of the navigation map and the top-to-bottom rank order of the
diagram are the *same* ordering of the *same* graph — which is why one algorithm
served both the nav-map generator and the diagram layout engine.

## Relation to Theorem 4 — the graph is what the links project from

`system:nav` is the **schema-level** graph. `system:nav_of` (`arest.canon:3233`),
which Theorem 4b uses, is its **instance-level projection**: for a concrete entity
`e` of noun `n`, each out-edge `⟨kind, target⟩` of `nav(n)` becomes a concrete
link in `e`'s representation —

- `child` → the dependent collection filtered by `e`'s key,
- `peer` → the 1:1 counterpart entity,
- `collection` → the related m:n set,

which is exactly `links_full(e, n, status) = nav(e) ∪ transitions(status(e))` of
chapter 07. Theorem 4's per-entity links are the shadow this schema graph casts on
a single entity. The graph is primary; the HATEOAS links are its projection.

## Worked example (the classification test)

`engine/tests/test_entity_view.py::test_nav_labels_controls_by_the_uniqueness_structure`
pins the whole classification on one fixture. A `Task` noun plays three fact types:

| fact type            | uniqueness constraint          | `nav_kind` |
| -------------------- | ------------------------------ | ---------- |
| `Task_blocks_Task`   | spans **both** roles (the pair is the key) | **peer** (1:1) |
| `Task_owns_Widget`   | spans **only** Task's role     | **child** (1:n — Widgets are children of the key) |
| `Task_notes`         | **none**                       | **collection** (m:n) |

and asserts `system:nav("Task", D)` reduces to exactly

```
(("peer",       "Task_blocks_Task", ("Task",)),
 ("child",      "Task_owns_Widget", ("Widget",)),
 ("collection", "Task_notes",       ("Note",)))
```

with `system:nav("Zebra", D) = ()` for an unplayed noun, and
`system:links("Task", e, D) = ⟨nav(e), transitions(status(e))⟩` closing the union of
Theorem 4. The classification above is therefore executable and verified, not a
description of intent.

## Absorption does not change navigation

The classification above is stated over a schema whose fact types each keep their own
table. On a compiled store, RMAP absorbs a noun's functional fact types as columns of
its table, and those absorbed fact types are exactly its `child` and `peer` edges. So
`system:nav` draws its candidate pool from every fact type the noun plays, not from the
own-table fact types alone (`system:ev_ownfts`, `factType` minus `rmapColumns`, whose
other caller `system:ev_facts` does need own-table only). Absorption is a *storage*
decision (own table vs. column); it must not change *navigation*: an absorbed functional
fact type is still a reference edge, the strongest navigation link. An absorbed unary
fact type surfaces as a target-less `('collection', ft, ())` edge, as an own-table unary
does; an arity-at-least-2 filter drops them where unary flags are unwanted as links.

## An app carries only its own definitions

A compiled app carries only its own definitions. An engine definition (every namespaced
name: `system:`, `constraints:`, `ast:`, `theta:`, `monad:` and the rest) resolves from
the live lambda, never from a copy frozen into the app's store: a host resolves a
store's own definitions before lambda's, so a frozen copy would shadow every later fix
to that definition, in every host alike. This is the chapter-15 thesis in one case: an
app defers engine names to the shared live reference.
