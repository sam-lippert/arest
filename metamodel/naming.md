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

Pluralization Rule has Pattern.
  Each Pluralization Rule has exactly one Pattern.
Pluralization Rule has Replacement.
  Each Pluralization Rule has exactly one Replacement.

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

<!-- elysium-audit G: subjects were bare quoted ids ('rule-child' has
     Pattern …) with no entity-type name. `has Pattern` is ambiguous across
     Pluralization Rule, Noun, Facet, and Format — the bare form cannot
     resolve its fact type by reading alone (Def 4's fragment resolves
     declarations by keyword-delimited family; an anonymous subject leans
     on parser charity). Subjects are now explicit. -->
Pluralization Rule 'rule-child' has Pattern '^child$'. Pluralization Rule 'rule-child' has Replacement 'children'.
Pluralization Rule 'rule-person' has Pattern '^person$'. Pluralization Rule 'rule-person' has Replacement 'people'.
Pluralization Rule 'rule-ay' has Pattern 'ay$'. Pluralization Rule 'rule-ay' has Replacement 'ays'.
Pluralization Rule 'rule-ey' has Pattern 'ey$'. Pluralization Rule 'rule-ey' has Replacement 'eys'.
Pluralization Rule 'rule-oy' has Pattern 'oy$'. Pluralization Rule 'rule-oy' has Replacement 'oys'.
Pluralization Rule 'rule-uy' has Pattern 'uy$'. Pluralization Rule 'rule-uy' has Replacement 'uys'.
Pluralization Rule 'rule-iy' has Pattern 'iy$'. Pluralization Rule 'rule-iy' has Replacement 'iys'.
Pluralization Rule 'rule-ss' has Pattern 'ss$'. Pluralization Rule 'rule-ss' has Replacement 'sses'.
Pluralization Rule 'rule-sh' has Pattern 'sh$'. Pluralization Rule 'rule-sh' has Replacement 'shes'.
Pluralization Rule 'rule-ch' has Pattern 'ch$'. Pluralization Rule 'rule-ch' has Replacement 'ches'.
Pluralization Rule 'rule-x' has Pattern 'x$'. Pluralization Rule 'rule-x' has Replacement 'xes'.
Pluralization Rule 'rule-s' has Pattern 's$'. Pluralization Rule 'rule-s' has Replacement 'ses'.
Pluralization Rule 'rule-z' has Pattern 'z$'. Pluralization Rule 'rule-z' has Replacement 'zzes'.
Pluralization Rule 'rule-ies' has Pattern 'y$'. Pluralization Rule 'rule-ies' has Replacement 'ies'.
Pluralization Rule 'rule-default' has Pattern '$'. Pluralization Rule 'rule-default' has Replacement 's'.

<!-- organizations-domain (ruling 2): Domain 'naming' has Access 'public'. -->
Domain 'naming' has Description 'Convention-based name projection (pluralization rules) declared as data per the Sweep-1 dispatch-to-data lift recipe (#895). PluralizationRuleTable reads the parallel Pluralization Pattern / Pluralization Replacement enum values; boot mirrors the legacy cascade so behavior round-trips.'.
