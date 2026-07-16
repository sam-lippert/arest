# js-runner — the composed checker

The laws are canon DEFs (the `law:` family in `arest` — see THE LAWS AS
CANON), never host code: the first checker was deleted for accreting law
semantics in JavaScript, and this one exists only because it cannot
repeat that. It is a COMPOSED SINGLE FILE:

    node compose.js     # prolog.js ; arest ; design-state ; norma-answer ; epilog.js -> runner.js
    node runner.js      # exit 0 iff every law answers T

compose.js is byte-level concatenation — the linker's job and nothing
more. The canon and the carriers appear AS SOURCE inside runner.js: the
intersection's one-tuple-literal shape reads as the JS comma operator,
so registration happens by node executing the file. Nothing is evaled,
readFile'd, or interpreted by host code at runtime; runner.js is a
generated artifact (untracked), regenerated whenever the canon or the
oracle's carriers change.

prolog.js supplies exactly what the constitution allows a host: the
registration vocabulary (DEF/A/N/K/PHI/S1..S9 — DEF also accumulates the
composed store, one CELL per registered name, so the store reads
itself), the mu (atoms resolve through DEFS then the primitives; numbers
are selectors; COMP/CONS/CONST/COND/ALPHA/INSERT/WHILE), the base
primitives of Backus 11.2.3, and the five registered boundary rows of
resolution.md (lex, implode, slug, escape_html, strip_prefix — the
lexical work law:schema_match rides on). epilog.js applies the canon's
own `law:report` to the composed store and prints the verdicts — the
Platform seam, effects only.

The laws, all canon-evaluated (constitution.md holds the same names as
Law rows for Hosts JavaScript and Rust): law:rmap_idempotence,
law:table_is_fetch (application = fetch, chained), law:schema_match (the
one-table form against NORMA), law:origin_boundary,
law:population_consistency, law:currying, law:emission (every emitted
wide-row slot is a fetch chain through ast:File). Carrier unfolding is
canon too (law:fts / law:norma flatten chunks-of-nine to the leaf
shapes through theta:flatten).
