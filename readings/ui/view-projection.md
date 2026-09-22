# AREST UI: View Projection — schema

<!-- Restored 2026-08-02. This file was deleted earlier in the same session
     on the strength of its own header, which recorded the eager `iff`-rule
     approach as failed ("DOES NOT WORK ... pathological forward-chain" over
     the ~593-FT metamodel join). That judgement was right about the RULES
     and wrong about the file: the deletion also took the schema, and
     view-detail.md, view-list.md, and view-menu.md reference these types 43
     times. They had been sitting on undeclared nouns since.

     What comes back is the declarations only. The unmarked derivation rules
     that caused the forward-chain blowup do not: their work is now done by
     the objectified associations in the three view readings, whose heads are
     projective and whose ViewElement identity comes from a spanning UC
     rather than from a rule that materialises a four-way join eagerly.

     Note the namespace is load-bearing. `ui.md` declares a DIFFERENT
     `View(.id)` — the MonoView control view, subtyped into List/Browser/
     Grid/Canvas/Tab. This `View(.Name)` is the projection view. That is why
     the three readings qualify theirs as `view-projection.View`: the dot
     disambiguates two nouns that would otherwise collide, and it is a fetch
     path in the Backus 14.7 sense, not decoration. -->

## Domain Metadata

<!-- This file's part of the domain: View Projection schema -- the projective, objectified-association declarations view-detail.md, view-list.md and view-menu.md build on.
     The sentence below is readings/ui/ui.md:403 repeated verbatim.
     core.md:220 makes Description functional, so a domain carries ONE
     text and an identical sentence is the identical fact. -->
Domain 'ui' has Description 'Platform-agnostic view hierarchy, navigation, and controls. Custom renderers registered per platform via the factory pattern.'.

## Entity Types

View(.Name) is an entity type.
ViewElement(.id) is an entity type.

## Value Types

View Kind is a value type.
  The possible values of View Kind are 'collection', 'instance', 'menu'.

## Fact Types

View is for Object Type.
  Each View is for exactly one Object Type.
View has View Kind.
  Each View has exactly one View Kind.

ViewElement belongs to View.
  Each ViewElement belongs to exactly one View.
ViewElement renders Fact Type. *
  Each ViewElement renders at most one Fact Type.
  <!-- `*` (fully-derived / View-materialized). This FIRST declaration must
       carry the star: view-detail.md re-declares the fact type with `*`,
       and duplicate declarations dedupe to the first, dropping the
       re-declaration's Derivation Mode marker. Without the star here the
       rule compiles Stored, never gets its
       `view:ViewElement_renders_Fact_Type` def, and `resolve_view` returns
       None for every instance view (blocker found 2026-06-10). -->
ViewElement has Component Role. *
ViewElement has Order.
  Each ViewElement has at most one Order.
