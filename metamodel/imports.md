# JS Library Imports

<!-- Ported 2026-07-31 from readings/core/imports.md (last touched
     2026-05-05). No counterpart existed under metamodel/, so this file was
     the residue of the readings/core -> metamodel merge rather than a
     superseded copy. Vocabulary map applied per the 2026-07-15 ruling in
     core.md: Verb -> Predicate; the (.Name) reference mode is dropped and
     JS Package identifies through Function(.id) like every other entity
     type here. Fact types, constraints, and instance facts are otherwise
     carried over verbatim. -->

## Entity Types

JS Package is an entity type.
JS Package is a subtype of Function.

## Value Types

Module Path is a value type.
Symbol Name is a value type.
Version is a value type.
Package Manager is a value type.
  The possible values of Package Manager are 'npm', 'yarn', 'pnpm', 'bun', 'deno', 'jsr'.

## Fact Types

### JS Package
JS Package has Version.
  Each JS Package has at most one Version.
  <!-- was "at most one Version per Domain", with "the same JS Package has more
       than one Version across Domains" beside it. Neither verbalizes, and
       neither is expressible on this fact type: it is binary, so there is no
       Domain role for "per Domain" to qualify. Nor is one needed. JS Package is
       a subtype of Function and "Each Function belongs to at most one Domain"
       (core.md), so a JS Package's Domain is already functionally determined —
       the qualifier was a uniqueness constraint written across a functional
       determination that the model already carries. And since JS Package
       identifies through Function(.id), the same npm package declared in two
       Domains is two JS Package entities, not one with two Versions; "across
       Domains" was talking about package NAMES, which are not the identity. -->


JS Package has Description.
  Each JS Package has at most one Description.

JS Package has Package Manager.
  Each JS Package has at most one Package Manager.

### Predicate
Predicate is exported from JS Package.
  Each Predicate is exported from at most one JS Package.
  It is possible that some JS Package exports more than one Predicate.

Predicate has Module Path.
  Each Predicate has at most one Module Path.

Predicate has Symbol Name.
  Each Predicate has at most one Symbol Name.

Predicate has Description.
  Each Predicate has at most one Description.

## Constraints

It is obligatory that each Predicate exported from some JS Package has some Module Path.
It is obligatory that each Predicate exported from some JS Package has some Symbol Name.

It is forbidden that a Predicate is exported from a JS Package and also is backed by an External System.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'imports' has Access 'public'. -->
Domain 'imports' has Description 'JS library imports as a federation primitive. Predicates exported from a JS Package are bound at runtime via DEFS the same way HTTP-backed Predicates are.'.
