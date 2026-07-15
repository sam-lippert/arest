# AREST Constitution

<!-- exec ruling 8a (2026-07-15): the constitution as READINGS — pure math
     to live in Elysium, parsed by the oracle, verbalized canonically, and
     subject to its own gates. Prose specifications were falsified as a
     fix by the second rebuild (the constitution was in the SPEC and the
     run violated it anyway); a constitution the system can read is one
     the gates can hold it to. Sources of each clause: the fail-1/2 root
     cause (meaning-location), the 2026-07-15 audit (marker closure), the
     nf ruling (canonical verbalization), the carrier ruling (pure math
     in Elysium), the host rulings (checker/production stations), and
     Backus 6-7/H1-H6 (host smallness). -->

## Entity Types

Host is an entity type.
Host is a subtype of Resource.
  <!-- a Host is a runtime participant: it evaluates the canon through
       its mu and supplies the registered surface. Stations below. -->

Law is an entity type.
Law is a subtype of Function.
  <!-- a Law is a named, executable check — the gates. A Law's
       Implementation is the check itself (Def 9), so gates are
       definitions, not prose. -->

## Value Types

Station is a value type.
  The possible values of Station are 'reference', 'checker', 'oracle', 'production'.
  The data type of Station is text.

## Readings

Host has Station.
  Each Host has exactly one Station.

Law holds for Host.
  Each Law, Host combination occurs at most once in the population of Law holds for Host.

## Deontic Constraints

### Meaning location (the fail-1/2 root cause)

It is obligatory that each Function of Definition Origin 'compiled' has Implementation in the canon.
It is forbidden that a Host carries meaning that is not a registered Function of the enumerable boundary.
<!-- Native carries speed or effects, never meaning. The enumerable
     boundary is Cor 5: manifest:origins computes it from the store;
     resolution.md's boundary rows state it as readings; the gate holds
     the two equal. -->

### Marker closure (the 2026-07-15 audit lesson)

It is forbidden that a Fact Type is marked derived when no Derivation Rule derives that Fact Type and no comment names the deriver as an evaluator-phase obligation.
<!-- a derivation marker is a debt instrument: the deliverer exists, or
     the debtor is named as future. Never a bare promise. -->

### Canonical verbalization (the nf ruling)

It is obligatory that each Reading re-parses to the Fact Type it verbalizes.
It is obligatory that each Reading reads as plain English at the arity of its Fact Type.
<!-- nf = verbalize of compile of parse, idempotent; NORMA's generated
     verbalization is the normal form, and divergences of form move the
     source toward the canonical phrasing. Naturalness operates under
     the absorption semantics: hyphen-bound role qualifiers (is from-
     Status) are load-bearing column names, not style. -->

### The carrier (the pure-math ruling)

It is forbidden that meaning is carried by a storage format other than readings and the intersection source.
<!-- JSON, sqlite, and every storage driver are acceptable at the
     registration edge; inside Elysium the carriers are FORML sentences
     and FFP objects in the intersection dialect. -->

### Host discipline (Backus 6-7, H1-H6)

It is obligatory that each Host is a thin evaluator of the canon.
It is obligatory that each override is byte-equal to its canon definition under the kill switch.
It is forbidden that an autonomous loop runs without an explicit ask.
<!-- the framework is the changeable part's servant: hosts supply mu,
     the primitives, and the registered surface — nothing else. The
     twin gate (AREST_NO_OVERRIDE) is the parity oracle. -->

### Sources before authoring (the fail-3 lesson)

It is obligatory that authoring verifies its claims against the primary sources before it lands.
<!-- when told to read, open the text; scope every claim to what was
     opened; a dropped pointer is a lead, not an excuse. -->

## Instance Facts

Host 'Python' has Station 'reference'.
Host 'JavaScript' has Station 'checker'.
Host 'C#' has Station 'oracle'.
Host 'Rust' has Station 'production'.
<!-- exec ruling 4 (2026-07-15): the JS mu is a quick-and-dirty checker
     for the canonized lambda and will never be used in production;
     production execution artifacts are WASM generated from Rust. The
     C# host exists to carry NORMA, the ORM reference implementation,
     as the oracle. -->

Law 'nf-idempotence' holds for Host 'C#'.
Law 'rmap-idempotence' holds for Host 'JavaScript'.
Law 'table-is-fetch' holds for Host 'JavaScript'.
Law 'schema-match' holds for Host 'JavaScript'.
Law 'origin-boundary-match' holds for Host 'JavaScript'.
<!-- the standing laws: nf round-trip (oracle), L1 rmap fixpoint, L2
     fetch-equals-restrict-project, the canon-vs-NORMA schema match, and
     the manifest-vs-boundary-rows check. Every run of the named host
     holds its laws; a failed law is a blocking finding. -->

It is obligatory that each Law holds for some Host on every run.

Domain 'constitution' has Description 'Governance readings: meaning location, marker closure, canonical verbalization, the pure-math carrier, host discipline, and sources-before-authoring — the constitution the evaluator phase is held to, stated as facts and deontics the system itself can parse.'.
