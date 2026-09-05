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
Readings Directory is a value type.
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

### The dependency graph, which package.json already states and nothing modelled
<!-- Added 2026-09-05. tools/norma-oracle-tests/corpora.md opens by saying what
     a corpus is: "an app's readings closure as its package.json declares it".
     It then spells that closure out as a hand-kept list of
     `Corpus 'X' reads Directory 'Y'` lines, one per dependency per app, which
     has to be walked forward every time a package.json changes and sits
     outside every store where no law can check it. The closure is not a
     primitive: it is the transitive closure of one edge, and the edge was
     simply missing from this file. `reaches` is the same shape core.md
     already uses for `Domain reaches Domain` -- a derived ring whose
     transitivity is declared as the theorem it is, per Halpin's practice for
     derived ring fact types. -->
JS Package depends on JS Package.
  Each JS Package, JS Package combination occurs at most once in the population of JS Package depends on JS Package.

JS Package reaches JS Package. *
  Each JS Package, JS Package combination occurs at most once in the population of JS Package reaches JS Package.

<!-- The directories are per package, not per corpus: a package may keep its
     readings in more than one place (auto.dev has both its own directory and a
     readings/ subdirectory), which is why the closure alone does not give the
     list. This is the fact the hand-kept manifest actually carries that the
     dependency graph does not. -->
JS Package has Readings Directory.
  Each JS Package, Readings Directory combination occurs at most once in the population of JS Package has Readings Directory.

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

## Derivations

<!-- Same construction as core.md's `Domain reaches Domain`: the base edge, then
     the closure as a biconditional over it, then transitivity declared as the
     theorem. The closure of any relation is transitive, so the ring property is
     the theorem stated rather than an extra restriction. Irreflexivity is
     deliberately absent: a package that depended on itself is a modelling error
     for a law to report, not a shape the closure may not hold. -->
* JS Package1 reaches JS Package2 iff JS Package1 depends on JS Package2.
If JS Package1 reaches JS Package2 and JS Package2 reaches JS Package3 then JS Package1 reaches JS Package3.

## Constraints

It is obligatory that each Predicate exported from some JS Package has some Module Path.
It is obligatory that each Predicate exported from some JS Package has some Symbol Name.

It is forbidden that a Predicate is exported from a JS Package and also is backed by an External System.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'imports' has Access 'public'. -->
Domain 'imports' has Description 'JS library imports as a federation primitive. Predicates exported from a JS Package are bound at runtime via DEFS the same way HTTP-backed Predicates are.'.
