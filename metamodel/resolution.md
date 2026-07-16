# Resolution Registry Catalog

<!-- The canon side of the Resolution Registry (docs ch. 15): which named
     operations admit a certified per-platform override. An operation's
     reference implementation is the canon DEF carrying its name (or, for a
     verb, the canon pipeline the verb reduces); a platform's fast override
     is held byte-equal to that reference by a parity pin behind the one
     kill switch (AREST_NO_OVERRIDE). The catalog is data so a target can
     enumerate what it is expected to twin and the parity-pin list can
     generate from it. The override bindings themselves are per-platform
     code, never canon data. -->

## Entity Types

Operation is an entity type.
Operation is a subtype of Function.

## Fact Types

Operation is overridable.
Operation is registrable.

## The catalog

<!-- DEF-level: the operation name is the canon DEF the override twins. -->
Operation 'system:ev_cols' is overridable.
Operation 'system:entity_view' is overridable.
Operation 'system:vb_fetch' is overridable.
Operation 'theta:NatJoin' is overridable.
Operation 'theta:append_phi' is overridable.
Operation 'theta:flatten' is overridable.
Operation 'theta:join_combine' is overridable.
Operation 'theta:member' is overridable.
Operation 'theta:dedup' is overridable.
Operation 'csdp' is overridable.
Operation 'rmap' is overridable.

<!-- Verb-level: the operation is a verb whose reference is the canon
     pipeline it reduces; the override is the host's native route. -->
Operation 'query' is overridable.
Operation 'synthesize' is overridable.
Operation 'apps_compile' is overridable.
Operation 'verify' is overridable.
Operation 'validate' is overridable.
Operation 'apply' is overridable.
Operation 'retract' is overridable.
Operation 'get' is overridable.
Operation 'actions' is overridable.
Operation 'schema' is overridable.
Operation 'cells' is overridable.
Operation 'derive' is overridable.
Operation 'nav' is overridable.
Operation 'explain' is overridable.
Operation 'induce' is overridable.
Operation 'compile' is overridable.
Operation 'propose' is overridable.
Operation 'ask' is overridable.

<!-- The REGISTERED class (Samuel, 2026-07-13): operations a host may serve
     through a registered function (kernel.register, origin=registered, the
     Def 9 / Cor 5 (cor:boundary) surface — "Cor. 8" in the original note
     matched no draft's numbering) — an LLM shaping synthesize's wording under the name
     llm:synthesize_shaper, an LLM judge flagging deontic-only validate
     entries under llm:validate_judge. The plain paths are the unchanged
     fallbacks; the kill switch retires a registration like any row. -->
Operation 'synthesize' is registrable.
Operation 'validate' is registrable.

<!-- The CSDP boundary class (Samuel's ruling, 2026-07-15): the canon
     defines csdp and rmap symbolically (alpha/fold over the design
     state — see the CSDP AS CANON / RMAP AS CANON sections of `arest`),
     and the three names below are the REGISTERED seams those defs apply
     through DEFS: elementarize is world->facts, the one non-computable
     step (Stage-1 doctrine: text->atom stays at the boundary);
     combine_judgment and accept_judgment are modeling judgments (entity
     combination; acceptance of computed subtype candidates). Everything
     else in the procedure — the population gate, uniqueness induction
     from example populations, mandatory derivation, the n-1
     elementarity gate, and both RMAP grouping rules — is canon. -->
Operation 'csdp:elementarize' is registrable.
Operation 'csdp:combine_judgment' is registrable.
Operation 'csdp:accept_judgment' is registrable.

## Def 9 boundary rows

<!-- exec ruling 4b (2026-07-15): the registered surface as instance-fact
     verbalizations — Cor 5's enumerable boundary stated as readings. The
     canon's manifest:origins computes the same boundary from the store by
     set arithmetic (form-aware functional-position walk); the checker mu
     holds the two against each other, and the delta report is the honest
     surface. The five SALVAGE primitives carry dom/cod transcribed from
     the quarry implementations (system:registered in the canon is the
     same manifest as data); the base primitives carry dom/cod from
     Backus 11.2.3's own signatures. Functional FORMS (COMP, CONS, CONST,
     COND, ALPHA, INSERT, WHILE) are the mu's grammar per H1, not DEFS
     entries, so they carry no rows. Type Expression values are lexical
     FFP shape expressions in the SALVAGE naming style. -->

Function 'lex' has Definition Origin 'registered'.
Function 'lex' accepts Type Expression 'text'.
Function 'lex' yields Type Expression 'token-records'.
Function 'implode' has Definition Origin 'registered'.
Function 'implode' accepts Type Expression 'separator-and-words'.
Function 'implode' yields Type Expression 'text'.
Function 'slug' has Definition Origin 'registered'.
Function 'slug' accepts Type Expression 'text'.
Function 'slug' yields Type Expression 'identifier'.
Function 'escape_html' has Definition Origin 'registered'.
Function 'escape_html' accepts Type Expression 'text'.
Function 'escape_html' yields Type Expression 'html-text'.
Function 'strip_prefix' has Definition Origin 'registered'.
Function 'strip_prefix' accepts Type Expression 'prefix-and-text'.
Function 'strip_prefix' yields Type Expression 'text'.

<!-- exec ruling (2026-07-16): the canon prefix families declared as
     Domains — TENANTS of the base store (namespacing is tenancy:
     Backus 14.7, a cell whose contents is another entire store). Each
     family's definitions are cells within its tenant sub-store; the
     colon in theta:dedup denotes the fetch path, not a flat prefix. -->
Domain 'theta' has Description 'The adequate relational algebra of Codd 2.2 as canon: projection, natural join, tie, restriction, and the set helpers they ride on.'.
Domain 'system' has Description 'The AST system layer as canon: cell reflection, state machine rows, compiled-rule builders, scheduler classification, views, and render.'.
Domain 'ast' has Description 'Cells, fetch, store, and DefineIn per Backus 13.3.4 and 13.3.5.'.
Domain 'constraints' has Description 'The constraint family builders: uniqueness, mandatory, subset, equality, exclusion, value, frequency.'.
Domain 'monad' has Description 'The two monadic helpers of the command pipeline.'.
Domain 'csdp' has Description 'The Conceptual Schema Design Procedure as canon: seven steps composed, three registered seams.'.
Domain 'rmap' has Description 'Relational mapping as canon: the store form, absorption and separation.'.
Domain 'manifest' has Description 'Def 9 origins computed from the store: the enumerable boundary as set arithmetic.'.
Domain 'law' has Description 'The standing laws as canon: carrier unfolding, set algebra, and the checks law:report names — gates are definitions the mu applies, never host code, and a law that executes needs no restatement.'.
Domain 'nav' has Description 'The navigation map as emitted view: patterns generated from rmap per Thm 2 — an entity group answers collection and item patterns, a separated fact type one pattern per curry prefix, links(e) = nav(e) union transitions — one map serving browser, console, and server by varying registered render functions.'.

Function 'csdp:elementarize' has Definition Origin 'registered'.
Function 'csdp:elementarize' accepts Type Expression 'familiar-examples'.
Function 'csdp:elementarize' yields Type Expression 'design-state'.
Function 'csdp:combine_judgment' has Definition Origin 'registered'.
Function 'csdp:combine_judgment' accepts Type Expression 'design-state'.
Function 'csdp:combine_judgment' yields Type Expression 'design-state'.
Function 'csdp:accept_judgment' has Definition Origin 'registered'.
Function 'csdp:accept_judgment' accepts Type Expression 'candidates-and-design-state'.
Function 'csdp:accept_judgment' yields Type Expression 'design-state'.

Function 'id' has Definition Origin 'registered'.
Function 'id' accepts Type Expression 'object'.
Function 'id' yields Type Expression 'object'.
Function 'atom' has Definition Origin 'registered'.
Function 'atom' accepts Type Expression 'object'.
Function 'atom' yields Type Expression 'boolean'.
Function 'null' has Definition Origin 'registered'.
Function 'null' accepts Type Expression 'object'.
Function 'null' yields Type Expression 'boolean'.
Function 'not' has Definition Origin 'registered'.
Function 'not' accepts Type Expression 'boolean'.
Function 'not' yields Type Expression 'boolean'.
Function 'and' has Definition Origin 'registered'.
Function 'and' accepts Type Expression 'boolean-pair'.
Function 'and' yields Type Expression 'boolean'.
Function 'eq' has Definition Origin 'registered'.
Function 'eq' accepts Type Expression 'pair'.
Function 'eq' yields Type Expression 'boolean'.
Function 'length' has Definition Origin 'registered'.
Function 'length' accepts Type Expression 'sequence'.
Function 'length' yields Type Expression 'number'.
Function 'le' has Definition Origin 'registered'.
Function 'le' accepts Type Expression 'number-pair'.
Function 'le' yields Type Expression 'boolean'.
Function 'ge' has Definition Origin 'registered'.
Function 'ge' accepts Type Expression 'number-pair'.
Function 'ge' yields Type Expression 'boolean'.
Function 'gt' has Definition Origin 'registered'.
Function 'gt' accepts Type Expression 'number-pair'.
Function 'gt' yields Type Expression 'boolean'.
Function '+' has Definition Origin 'registered'.
Function '+' accepts Type Expression 'number-pair'.
Function '+' yields Type Expression 'number'.
Function 'tl' has Definition Origin 'registered'.
Function 'tl' accepts Type Expression 'sequence'.
Function 'tl' yields Type Expression 'sequence'.
Function 'apndl' has Definition Origin 'registered'.
Function 'apndl' accepts Type Expression 'element-and-sequence'.
Function 'apndl' yields Type Expression 'sequence'.
Function 'apndr' has Definition Origin 'registered'.
Function 'apndr' accepts Type Expression 'sequence-and-element'.
Function 'apndr' yields Type Expression 'sequence'.
Function 'distl' has Definition Origin 'registered'.
Function 'distl' accepts Type Expression 'element-and-sequence'.
Function 'distl' yields Type Expression 'pair-sequence'.
Function 'distr' has Definition Origin 'registered'.
Function 'distr' accepts Type Expression 'sequence-and-element'.
Function 'distr' yields Type Expression 'pair-sequence'.
Function 'cat' has Definition Origin 'registered'.
Function 'cat' accepts Type Expression 'sequence-pair'.
Function 'cat' yields Type Expression 'sequence'.
Function 'apply' has Definition Origin 'registered'.
Function 'apply' accepts Type Expression 'representation-and-object'.
Function 'apply' yields Type Expression 'object'.
Function '1r' has Definition Origin 'registered'.
Function '1r' accepts Type Expression 'sequence'.
Function '1r' yields Type Expression 'element'.
Function 'tlr' has Definition Origin 'registered'.
Function 'tlr' accepts Type Expression 'sequence'.
Function 'tlr' yields Type Expression 'sequence'.
