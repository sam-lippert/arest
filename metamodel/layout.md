# Repository Layout — where a runner finds what it loads

<!-- Added 2026-08-03. Four hosts each hardcode the same repository layout in
     their own idiom: rust/main.rs walks the executable's ancestors for a
     `shared/` carrying a landmark file (24 lines of path logic),
     csharp/RoslynLoader (5), python/canon.py computes _ROOT from two dirnames
     off __file__ and then hardcodes "shared" and "rust/target/release" (4),
     java/CanonLoader resolves through one `sharedPath` call (1). Nothing
     declares the layout, so a move breaks four hosts independently and each
     discovers it separately.

     A thin runner should be handed ONE path — the canon — and read the rest
     from what it loads. That is the same move as every other correction in
     this corpus: the knowledge is a fact, not host code, and a host that
     carries its own copy carries one that can go stale.

     Bootstrap order matters and bounds what this file can do. A runner cannot
     read this reading to find the canon, because it needs the canon to read a
     reading. So exactly one path is a runner's argument: the canon file. Every
     other location below is declared here and resolved after load, relative to
     the Canon Root — the directory containing the canon. -->

## Entity Types

Source Location is an entity type.
Source Location is a subtype of Function.

## Value Types

Relative Path is a value type.
Location Role is a value type.
  The possible values of Location Role are 'canon', 'scenarios', 'grammar', 'metamodel', 'apps', 'connectors'.

## Fact Types

Source Location has Location Role.
  Each Source Location has exactly one Location Role.
  For each Location Role, at most one Source Location has that Location Role.

Source Location has Relative Path.
  Each Source Location has exactly one Relative Path.
  <!-- Relative to the Canon Root: the directory holding the canon file the
       runner was handed. Not to the executable, not to the source file of
       whichever host is asking — those are the four conventions this
       replaces. -->

## Constraints

It is obligatory that each Location Role names some Source Location.
  <!-- Deontic rather than alethic: a runner that never resolves readings (an
       ARC-AGI pyarest run reducing canon only) is not in violation for having
       no metamodel location, and a checkout missing `apps` is degraded, not
       invalid. Cor. 6's open-world reading of host-supplied facts. -->

## Instance Facts

Source Location 'canon' has Location Role 'canon'.
Source Location 'canon' has Relative Path 'arest.canon'.

Source Location 'scenarios' has Location Role 'scenarios'.
Source Location 'scenarios' has Relative Path 'scenarios.canon'.

Source Location 'grammar' has Location Role 'grammar'.
Source Location 'grammar' has Relative Path '../../readings/forml2-grammar.md'.

Source Location 'metamodel' has Location Role 'metamodel'.
Source Location 'metamodel' has Relative Path '../../metamodel'.

Source Location 'apps' has Location Role 'apps'.
Source Location 'apps' has Relative Path '../../../apps'.

Source Location 'connectors' has Location Role 'connectors'.
Source Location 'connectors' has Relative Path '../../../apps/connectors'.

<!-- organizations-domain (ruling 2): Domain 'layout' has Access 'public'. -->
Domain 'layout' has Description 'Where a runner finds what it loads, declared once instead of hardcoded in each host. One path is a runner argument — the canon; every other location resolves from the Canon Root.'.
