# Naming

<!--
## Description
Convention-based name projection — pluralization, slug, table name —
declared as data so the rule set lives in the readings, not in Rust.
-->

<!--
The English pluralization cascade in the killed host's
crates/arest/src/naming.rs was lifted (#895) to a PluralizationRuleTable
whose rows were read at runtime from the parallel enum value types
`Pluralization Pattern` and `Pluralization Replacement` declared below.
Evaluator-phase obligation: read the rule set from these readings the
same way, and mirror the legacy suffix cascade at boot so behavior
round-trips on every historical input.
-->

<!--
Pattern dialect (the killed host interpreted this in
`PluralizationRuleTable::pluralize`; an evaluator-phase reader must
honor the same dialect):
  - `^WORD$` matches the entire lowercased word; replacement returned
    with the leading character's case lifted from the input.
  - `SUFFIX$` matches the lowercased word's tail; the matched suffix
    is stripped from the original word and the replacement appended
    (so the prefix's case survives — `Match` + `ch$ → ches` yields
    `Matches`).
  - `$` matches any word as a zero-length suffix → trailing default,
    appended verbatim.
-->

<!--
Order matters — the cascade is first-match-wins. Vowel-y patterns must
precede the consonant-y catchall, specific es-suffixes must precede
bare `s$`, and the empty-pattern default must be last.
-->

## Entity Types

Pluralization Rule is an entity type.
Pluralization Rule is a subtype of Function.

## Value Types

Pluralization Pattern is a value type.
  The possible values of Pluralization Pattern are '^child$', '^person$', 'ay$', 'ey$', 'oy$', 'uy$', 'iy$', 'ss$', 'sh$', 'ch$', 'x$', 's$', 'z$', 'y$', '$'.
  The data type of Pluralization Pattern is text.
Pluralization Replacement is a value type.
  The possible values of Pluralization Replacement are 'children', 'people', 'ays', 'eys', 'oys', 'uys', 'iys', 'sses', 'shes', 'ches', 'xes', 'ses', 'zzes', 'ies', 's'.
  The data type of Pluralization Replacement is text.

## Fact Types

Pluralization Rule has Pluralization Pattern.
  Each Pluralization Rule has exactly one Pluralization Pattern.
Pluralization Rule has Pluralization Replacement.
  Each Pluralization Rule has exactly one Pluralization Replacement.
<!-- exec-4 finding (2026-07-15): the readings said bare Pattern (core's
     generic JSON-schema value type) and bare Replacement (declared
     NOWHERE — the fact type silently parsed as a unary until the
     instance-fact leg exposed it). The enum value types above are the
     one authority; the fact types now use them, so the enumerated
     values constrain the rows. -->

## Instance Facts

<!--
The parallel `Pluralization Pattern` / `Pluralization Replacement`
enum-value declarations above are the authority (the killed host's
`PluralizationRuleTable::from_grammar_state` read them; an
evaluator-phase reader must treat them the same); the per-row
instance facts below mirror them as Pluralization Rule entities for
human-readability and tooling that walks the rule set as named
records (e.g. UI surfaces, diagnostics).
-->

<!-- arest-audit G: subjects were bare quoted ids ('rule-child' has
     Pattern …) with no entity-type name. `has Pattern` is ambiguous across
     Pluralization Rule, Noun, Facet, and Format — the bare form cannot
     resolve its fact type by reading alone (Def 4's fragment resolves
     declarations by keyword-delimited family; an anonymous subject leans
     on parser charity). Subjects are now explicit. -->
Pluralization Rule 'rule-child' has Pluralization Pattern '^child$'. Pluralization Rule 'rule-child' has Pluralization Replacement 'children'.
Pluralization Rule 'rule-person' has Pluralization Pattern '^person$'. Pluralization Rule 'rule-person' has Pluralization Replacement 'people'.
Pluralization Rule 'rule-ay' has Pluralization Pattern 'ay$'. Pluralization Rule 'rule-ay' has Pluralization Replacement 'ays'.
Pluralization Rule 'rule-ey' has Pluralization Pattern 'ey$'. Pluralization Rule 'rule-ey' has Pluralization Replacement 'eys'.
Pluralization Rule 'rule-oy' has Pluralization Pattern 'oy$'. Pluralization Rule 'rule-oy' has Pluralization Replacement 'oys'.
Pluralization Rule 'rule-uy' has Pluralization Pattern 'uy$'. Pluralization Rule 'rule-uy' has Pluralization Replacement 'uys'.
Pluralization Rule 'rule-iy' has Pluralization Pattern 'iy$'. Pluralization Rule 'rule-iy' has Pluralization Replacement 'iys'.
Pluralization Rule 'rule-ss' has Pluralization Pattern 'ss$'. Pluralization Rule 'rule-ss' has Pluralization Replacement 'sses'.
Pluralization Rule 'rule-sh' has Pluralization Pattern 'sh$'. Pluralization Rule 'rule-sh' has Pluralization Replacement 'shes'.
Pluralization Rule 'rule-ch' has Pluralization Pattern 'ch$'. Pluralization Rule 'rule-ch' has Pluralization Replacement 'ches'.
Pluralization Rule 'rule-x' has Pluralization Pattern 'x$'. Pluralization Rule 'rule-x' has Pluralization Replacement 'xes'.
Pluralization Rule 'rule-s' has Pluralization Pattern 's$'. Pluralization Rule 'rule-s' has Pluralization Replacement 'ses'.
Pluralization Rule 'rule-z' has Pluralization Pattern 'z$'. Pluralization Rule 'rule-z' has Pluralization Replacement 'zzes'.
Pluralization Rule 'rule-ies' has Pluralization Pattern 'y$'. Pluralization Rule 'rule-ies' has Pluralization Replacement 'ies'.
Pluralization Rule 'rule-default' has Pluralization Pattern '$'. Pluralization Rule 'rule-default' has Pluralization Replacement 's'.

<!-- organizations-domain (ruling 2): Domain 'naming' has Access 'public'. -->
Domain 'naming' has Description 'Convention-based name projection (pluralization rules) declared as data per the Sweep-1 dispatch-to-data lift recipe (#895). PluralizationRuleTable reads the parallel Pluralization Pattern / Pluralization Replacement enum values; boot mirrors the legacy cascade so behavior round-trips.'.
