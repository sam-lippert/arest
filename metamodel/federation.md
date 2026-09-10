# Federation — sources, connectors, translators (a standard module)

<!-- The federation system is declared in FORML and dispatched through DEFS (the
whitepaper's platform-binding move: one SYSTEM varies by DEFS, not by logic). A Source
is where facts live; a Connector names HOW to reach and read it — its Fetcher and
Translator are DEFINITION NAMES resolved by rho at fetch time, so swapping an
implementation is re-registering a name (IoC through the store). Any backend —
clickhouse, postgresql, sqlite, cloudflare, mongo, a file — is one more Connector
declaring its two names. -->

<!-- Declaration sweep (2026-08-09). This file was carried in with reference
     modes and with no constraints at all, so NORMA had to ASSUME a spanning
     uniqueness on each of its four fact types per Def 3 set semantics — which
     models every one of them as many-to-many, the opposite of what the note
     above describes. Modeling is verbalization: a fact type whose constraints
     are not written is not modelled, it is only mentioned.

     Reference modes: `Source(.Name)` and `Connector(.Name)` are dropped.
     Function(.id) is the ONLY declared reference mode in this metamodel
     (core.md, Halpin 2nd ed §6.7 and §10.4 — a subtype inherits the root's
     primary reference scheme, and a subtype-own scheme is the advanced case
     that mapped as dual-identity bridge columns); every entity type here
     identifies through Function(.id) by being a subtype of Function. -->

## Entity Types

Source is an entity type.
Source is a subtype of Function.

Connector is an entity type.
Connector is a subtype of Function.

<!-- A Fetcher is a definition name resolved by rho (the note above), which is
     to say a Function: src.do keys its fetchers map by name and dispatches by
     it (index.js, doFetch), and each fetcher has properties of its own (an
     implementation, proxy-based, isolated), which is what auto.dev's
     source-routing.md says of it. Declared a value type in the 2026-08-09
     sweep, it met auto.dev's Fetcher entity as a KIND CONFLICT the oracle
     settled by keeping this file's kind and refusing the app's scheme (Sam,
     2026-09-10: "if the real object is an entity, then the model is wrong").
     Translator stays a value type: src.do has no translators to consult. -->
Fetcher is an entity type.
Fetcher is a subtype of Function.

## Value Types

Url is a value type.
Translator is a value type.

## Fact Types

### Source

Source has Url.
  Each Source has at most one Url.
  It is obligatory that each Source has some Url.

Source uses Connector.
  Each Source uses at most one Connector.
  It is obligatory that each Source uses some Connector.
  It is possible that more than one Source uses the same Connector.

### Connector

Connector fetches with Fetcher.
  Each Connector fetches with at most one Fetcher.
  It is obligatory that each Connector fetches with some Fetcher.

Connector translates with Translator.
  Each Connector translates with at most one Translator.
  It is obligatory that each Connector translates with some Translator.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'federation' has Access 'public'. -->
Domain 'federation' has Description 'Sources, connectors and translators as a standard module: a Source is where facts live and a Connector names how to reach and read it, its Fetcher and Translator being definition names resolved through DEFS at fetch time.'.
