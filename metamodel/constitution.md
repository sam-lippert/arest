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
LawHoldsForHost objectifies "Law holds for Host".
LawHoldsForHost is a subtype of Function.

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
<!-- exec ruling 4 (2026-07-15): production execution artifacts are WASM
     generated from Rust. The C# host exists to carry NORMA, the ORM
     reference implementation, as the oracle. Ruling (2026-07-16): the
     first JavaScript checker was DELETED — its law loops and comparison
     logic were accreting native semantics beside the canon, the fail-1/2
     root cause re-armed. Ruling (same day): the laws were rewritten as
     canon DEFs (the law: family) and the checker host RETURNS as a
     COMPOSED SINGLE FILE — prolog (the registration vocabulary, the mu,
     the base primitives, and the registered boundary rows), then the
     canon bytes, then the carriers, then an epilog that applies
     law:report and prints — concatenated so the canon appears AS SOURCE
     (the one tuple literal reads as the comma operator) and node
     executes one file: nothing is evaled, read, or interpreted by host
     code at runtime, and no law semantics live in the host. -->

Law 'nf-idempotence' holds for Host 'C#'.
Law 'rmap-idempotence' holds for Host 'JavaScript'.
Law 'table-is-fetch' holds for Host 'JavaScript'.
Law 'schema-match' holds for Host 'JavaScript'.
Law 'origin-boundary-match' holds for Host 'JavaScript'.
Law 'population-consistency' holds for Host 'JavaScript'.
Law 'currying-agreement' holds for Host 'JavaScript'.
Law 'emission' holds for Host 'JavaScript'.
Law 'rmap-idempotence' holds for Host 'Rust'.
Law 'table-is-fetch' holds for Host 'Rust'.
Law 'schema-match' holds for Host 'Rust'.
Law 'origin-boundary-match' holds for Host 'Rust'.
Law 'population-consistency' holds for Host 'Rust'.
Law 'currying-agreement' holds for Host 'Rust'.
Law 'emission' holds for Host 'Rust'.
<!-- the standing laws: nf round-trip (oracle, live today); then the
     canon laws, each a canon DEF the mu applies — law:rmap_idempotence
     (L1 fixpoint), law:table_is_fetch (L2: application = fetch,
     chained), law:schema_match (the one-table form against NORMA),
     law:origin_boundary (manifest vs the boundary rows),
     law:population_consistency (L4: declared keys re-induced from
     rows), law:currying (L5: nest and unnest inverse), and law:emission
     (L6: every emitted wide-row slot is a fetch chain through
     ast:File). The JavaScript rows are LIVE (the composed runner holds
     them on every run); the Rust rows are the named evaluator-phase
     debt per marker closure: the production host holds the same DEFs
     from its first run — same canon bytes, same laws, different mu. -->

It is obligatory that each Law holds for some Host on every run.

Domain 'constitution' has Description 'Governance readings: meaning location, marker closure, canonical verbalization, the pure-math carrier, host discipline, and sources-before-authoring — the constitution the evaluator phase is held to, stated as facts and deontics the system itself can parse.'.
