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
Operation is registered.
Operation awaits a driver. **

<!-- WHAT MAY BE REGISTERED IS NOT WHAT IS (2026-09-14). `is registrable` says a host MAY
     fill this seam; nothing said whether one had, so Cor 6's honest list of where unverified
     computation enters could not be derived, and law:origin_boundary compares the manifest
     against the store's own declarations -- declaration against declaration, never against a
     host. Measured the same day: of the seven registrable Operations FIVE are empty
     (compile, apps_compile and the three csdp seams) and THREE operations the host really
     does register -- clock, crypt:encrypt, crypt:decrypt -- are not in the registrable list
     at all. The boundary was unsound in both directions.

     A HOST ASSERTS WHAT IT FILLED. It knows its own table, so `Operation is registered` is a
     fact it can state at boot, and the awaiting list is then a DERIVATION rather than a
     comment. Samuel, 2026-09-14: the LLM seams do not need wiring into the mu -- Ev is
     synchronous and no primitive is async -- they have to be driven manually by an llm or a
     person at those points. Driving them manually requires knowing where the points ARE, and
     that is what this derives. The negated clause follows evolution.md's `Domain Change is
     valid` exactly, which the oracle builds as a finite anti-join. -->
<!-- AND THE MARKER IS `**`, NOT `*` (2026-09-18). The awaiting list has to be READABLE
     FROM THE TABLES -- a person or an llm driving these seams does not boot the closure
     to find out where the points are -- and `*` is defined as `derive at runtime`
     (core.md's marker ruling, Samuel 2026-08-04: the four are orthogonal, `*` derive,
     `**` derive and store, `+` derive or assert, `++` both). A `*` head therefore LEAVES
     THE STORED SCHEMA in both directions: the oracle drops it from state:fts citing Codd
     1970 1.5, a stored derivable relation is strong redundancy, and canon's rmap:gate
     drops it from the relational map, which is NORMA's own GATE:187-188. So this head had
     no table AT ALL -- absent, not empty -- while both of its inputs were stored and
     correct, and the list this derivation exists to give was readable only by booting the
     rules. `**` is the marker that says derive AND store, and it stays unassertable,
     which is right for a head that is nothing but a consequence of the other two.
     The price is stated where the markers are: a stored cell is materialized and
     persists, so between materializations the table GROWS under the rule and does not
     shrink -- a stored row seeds the closure and derivation is monotone. Retraction is
     the next materialization, which builds from the carriers with an empty seed. -->
** Operation awaits a driver iff that Operation is registrable and it is not true that that Operation is registered.

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
Operation 'create' is overridable.
Operation 'replace' is overridable.
Operation 'apply' is overridable.
Operation 'retract' is overridable.
Operation 'get' is overridable.
Operation 'actions' is overridable.
Operation 'schema' is overridable.
Operation 'cells' is overridable.
Operation 'orient' is overridable.
Operation 'tutor' is overridable.
Operation 'derive' is overridable.
Operation 'nav' is overridable.
Operation 'explain' is overridable.
Operation 'induce' is overridable.
Operation 'compile' is overridable.
Operation 'propose' is overridable.
Operation 'ask' is overridable.

<!-- WHAT EACH SERVED VERB TAKES AND ANSWERS (2026-09-10). The verb route
     dispatches by looking the name up in the store, and until now it passed
     one operand shape to all of them: <first argument, store state>. Most of
     these verbs read the STORE at their first selector, so they were handed
     the argument where the store belongs and answered an empty schema, one
     empty cell, an empty menu -- wrong answers rather than errors. This is
     where the model says which shape each takes, and main:verb_pair reads it.
     The shapes were measured against the base store, comparing the CONTENT
     each verb answers under each operand rather than whether it merely
     returned. A verb whose shape is not yet settled carries no row and keeps
     the pair, which is what get, ask, induce and retract take. -->
Function 'schema' accepts Type Expression 'store'.
Function 'schema' yields Type Expression 'table-list'.
Function 'cells' accepts Type Expression 'store'.
Function 'cells' yields Type Expression 'cell-list'.
Function 'rmap' accepts Type Expression 'store'.
Function 'rmap' yields Type Expression 'cell-list'.
<!-- AND actions TAKES THE ENTITY AND THE CELLS (2026-09-17). This said
     'store', measured in 2026-09-10 against a cell that was system:view_menu
     itself; under the pair that cell also answered an empty menu, so the
     store was recorded as the better of two wrong answers. Both are wrong.
     Theorem 2's transitions(status(e)) is a function of an ENTITY -- the
     machine of a type it is an instance of, the status derived for it, the
     transitions leaving that status -- and a store alone names no entity, so
     `actions sr-alpha-1` dropped the id and answered the empty menu for a
     Support Request whose whole lifecycle the app declares.
     THE CELLS AND NOT THE STORE STATE, for orient's reason: store:state is
     <descriptors, phi>, and the machine of an instance is found through
     state:otpops -- a top-level cell, no fact type, no descriptor -- so the
     projection cannot see which type's population holds the id. Measured on
     support.auto.dev: under name-and-store the menu is empty, under
     name-and-cells it is accept, resolve and merge. -->
Function 'actions' accepts Type Expression 'name-and-cells'.
Function 'actions' yields Type Expression 'menu'.
Function 'nav' accepts Type Expression 'store'.
Function 'nav' yields Type Expression 'pattern-list'.
Function 'propose' accepts Type Expression 'store'.
Function 'propose' yields Type Expression 'descriptor-list'.
Function 'get' accepts Type Expression 'name-and-store'.
Function 'get' yields Type Expression 'entity-view'.
Function 'ask' accepts Type Expression 'arguments-and-populations'.
Function 'ask' yields Type Expression 'filtered-population'.
Function 'query' accepts Type Expression 'recipe-and-populations'.
Function 'query' yields Type Expression 'rows'.
Function 'synthesize' accepts Type Expression 'name-and-cells'.
Function 'synthesize' yields Type Expression 'sentences-and-checked-and-unchecked-and-verdict'.
Function 'derive' accepts Type Expression 'arguments-and-populations'.
Function 'derive' yields Type Expression 'populations'.
Function 'validate' accepts Type Expression 'descriptor-list'.
Function 'validate' yields Type Expression 'violation-list'.
Function 'verify' accepts Type Expression 'cells'.
Function 'verify' yields Type Expression 'boolean'.
Function 'orient' accepts Type Expression 'name-and-cells'.
Function 'orient' yields Type Expression 'orientation-rows'.
Function 'tutor' accepts Type Expression 'name-and-cells'.
Function 'tutor' yields Type Expression 'tutorial-text'.
<!-- AND THE ONE THAT WRITES (2026-09-16). Every verb above reads, so the
     served verb surface had no way to make a fact at all: a Support Request
     has three mandatory roles and is therefore only sayable as a whole ROW,
     and the only address that took one was an HTTP POST to its collection.
     `apply` cannot be that verb -- it is the mu's own apply combinator,
     registered below with the shape it has always had, and a canon cell of
     that name would shadow the combinator everywhere in canon. `create` is
     the name the model itself uses for the write (an app's authorization
     readings say `Operation 'create' on Protected Resource 'Support
     Request'`), so that is the Operation declared here. It takes ONE
     argument, the row -- the entity whole, its fact types naming its values
     and the pair named for the collection carrying the id -- and answers
     what Theorem 1 says a transition answers: the outcome AND the successor
     store. `row-and-cells` is a new type expression over a construction
     main:verb_pair already builds, the argument beside the cells, so the
     route needed the map row and no new arm. -->
Function 'create' accepts Type Expression 'row-and-cells'.
Function 'create' yields Type Expression 'outcome-and-store'.
Function 'replace' accepts Type Expression 'row-and-cells'.
Function 'replace' yields Type Expression 'outcome-and-store'.
<!-- AND THE ONE THAT CORRECTS. `create` is additive and a functional fact
     type refuses a second value for the same key, so a typo taken at intake
     was permanent: over the MCP the store was append-only, and nothing could
     put a customer's real address where a placeholder stood. The correction
     is one checked step ALREADY -- http:method_kinds maps PUT to
     `replacement`, main:api0 routes it to main:replace_step, and
     main:replace builds ONE successor population, the old rows dropped and
     the new row added in the same step, which main:write_answer then
     validates once. Only the served verb was missing, and this is that verb
     on exactly create's terms: main:api applied to PUT and the row, so a
     tool call and a PUT are one operation and not two. The row carries the
     collection's id and ONE fact type, because PUT at a fact-type resource
     replaces one fact; a row carrying more is refused rather than quietly
     folded into several checks.

     THE THREE ROWS THAT SERVE IT ARE HELD, and this is the whole of the
     hold: mcp:verbs lists an Operation that carries an accepts row and
     resolves to a cell, the cell is in canon now, and these are the rows --

       Operation 'replace' is overridable.
       Function 'replace' accepts Type Expression 'row-and-cells'.
       Function 'replace' yields Type Expression 'outcome-and-store'.

     Measured 2026-09-18 with them in: canon's reader compiles them, mcp:verbs
     answers 18 verbs where it answered 17, and the new row is
     ('replace', 'row-and-cells', 'outcome-and-store'). Measured with them in
     AND the witness carrier left as it stands: `the reader reproduces the
     witness's schema, to the pinned distance` moves rows 250 -> 247 and
     stateRows 258 -> 255, exactly the three fact types these rows populate and
     nothing else, and state:otpops grows Function and Operation by one each.
     That is the carrier being stale, not the readings being wrong, and the
     remedy is the one that test's own comment names: regenerate
     tools/norma-oracle over metamodel/. They go in with that regeneration, in
     the commit that does it.

     WHAT THIS DOES NOT SERVE is DELETE: the name `retract` is already a
     canon cell, Backus's population-level one
     that answers rows and no store, and solve:cell would serve THAT cell to
     a caller who asked for a retraction. The address argument the note
     below gives is stale -- create answered it by taking the row whole --
     but the name collision is not, and freeing the name is the move
     f1b0202f already made for create: the pipeline goes under cmd:retract
     and `retract` becomes main:api applied to DELETE. -->
<!-- AND THE ONE THAT ASKS (Samuel, 2026-09-17: "what the MCP needs is a way of
     asking you to do something"). The comment above `Operation awaits a driver`
     has said since 2026-09-14 that these seams "have to be driven manually by an
     llm or a person at those points"; MEANWHILE AN LLM IS ATTACHED, because
     every caller of the MCP is one, and the protocol has the request for exactly
     this -- sampling/createMessage, which a SERVER sends to the CLIENT. So the
     seam is called and something answers. `drive` takes the operation to drive
     and the subject to drive it over, and answers the facts the completion
     commits the store to: the judgement lands as rows, with the Completion that
     produced it beside them, so what a model decided is something someone can
     contradict rather than a paragraph in a session nobody can audit.

     `completion-and-cells` IS THE POINT OF THE NEW TYPE EXPRESSION, and it is
     not a shape: main:verb_shapes maps it onto the argument-beside-the-cells
     construction row-and-cells already uses. It is what tells a HOST that this
     verb's operand has to be FETCHED before canon can be handed it -- the host
     reads the accepts row off mcp:verbs and knows to go and ask -- so which verb
     needs a completion is a fact of the model and not a name in a host. `drive`
     is NOT declared registrable: it is canon's own pipeline, and what awaits a
     driver is the seam it drives, never the driving. -->
Operation 'drive' is overridable.
Function 'drive' accepts Type Expression 'completion-and-cells'.
Function 'drive' yields Type Expression 'fact-list'.
<!-- MEASURED 2026-09-11, which is the condition the note these replace set.
     It said derive "reads its first element as a sequence, so it answers to
     <[], populations> and throws on the empty argument an address of one
     element gives it", and that its shape stays off the surface "until the
     argument it wants is measured rather than guessed". Both were asked, on
     the base store, for every operand the verb route can build:

       derive   <[], derive:store_pairs>   247 rows, the populations unchanged
                <[], store:state>          throws, selector 1 out of range 0
       validate store:fts                  0 rows, no violations on the base
                store:state                throws, expected sequence, got atom
                derive:store_pairs         throws, selector 5 out of range 2

     So derive wants what 'arguments-and-populations' already builds, <args,
     derive:store_pairs>, which is the operand law:all_rules is handed at the
     one call site canon has. No rules in the argument means no round runs and
     the populations come back as they went in: an answer, not a failure.
     validate wants the fact type DESCRIPTORS that store:fts holds, a shape
     the table did not have and now does. Through the route both used to throw
     'selector 2 out of range 1', which is the one-element address the old
     note names, and query threw it too. query still throws, but the throw
     moved: it is now 'selector 1 out of range 0', raised inside query rather
     than while building its operand. query is declared and its operand is
     built as declared; what it does with an empty recipe is a separate
     question this did not settle. -->
<!-- AND THE THREE STILL UNDECLARED ARE UNDECLARED FOR A MEASURED REASON,
     2026-09-11. explain, induce and retract have canon DEFs and are not on
     the served surface, and the missing declaration is not what keeps them
     off it. Each was asked on the base store for every operand the route
     can build, with an empty argument and with a fact type's name:

       explain  <[], anything>   throws, selector 1 out of range 0
                <[name], pairs>  throws, selector 2 out of range 1
       induce   <[], anything>   0 rows
                <[name], pairs>  throws, selector 2 on atom
       retract  <[], pairs>      247 rows, the populations unchanged
                <[name], pairs>  throws, selector 1 on atom

     So all three take a STRUCTURED argument -- explain a pair, induce a
     pair of sequences, retract a sequence of rows -- and the route builds
     its argument half out of the words of an address, which are atoms. No
     declaration reaches them: the operand they want is not one an address
     can spell. THAT REASONING IS STALE FOR THE FIRST HALF, 2026-09-18:
     create took the row WHOLE through main:api rather than through an
     address, and `replace` above does the same for PUT, so a structured
     operand is no longer something an address has to spell. What still
     keeps retract off the surface is a NAME: `retract` already resolves to
     Backus's population-level cell, which answers rows and no store, so
     declaring it would serve that one and not main:retract_step. Freeing
     the name is the move f1b0202f made for create -- the pipeline under
     cmd:retract, the name left for the write -- and it is one commit, not
     a design question. explain and induce are untouched by this. That is a question about the address, not about this file,
     and it is why retract answering 247 rows to <[], pairs> is not enough
     to declare it -- an empty retraction is the only call it could serve.

     verify is the opposite and is declared above: `verify` IS law:all, it
     takes the CELLS (answering 'T' on the base store, where store:state
     raises `expected sequence, got atom`), and `cells` is an operand the
     route already builds. It was off the surface only for want of the two
     rows. Through the CLI it never reaches the route at all -- main's very
     first arm matches the address <'verify'> and answers the law report --
     but mcp:call goes through main:api, which has no mode chain, so this
     is what puts it in mcp:verbs beside the other twelve. -->

<!-- The REGISTERED class (Samuel, 2026-07-13): operations a host may serve
     through a registered function (kernel.register, origin=registered, the
     Def 9 / Cor 5 (cor:boundary) surface — "Cor. 8" in the original note
     matched no draft's numbering) — an LLM shaping synthesize's wording under the name
     llm:synthesize_shaper, an LLM judge flagging deontic-only validate
     entries under llm:validate_judge. The plain paths are the unchanged
     fallbacks; the kill switch retires a registration like any row. -->
Operation 'synthesize' is registrable.
Operation 'validate' is registrable.
<!-- the command increment (2026-07-16): compile and apps_compile are the
     parse-and-compile verbs — their reference is the reading-to-DEFS leg
     (NORMA carries it today as the oracle; a host carries it in
     production), which is registration-edge work by the Stage-1 doctrine:
     text enters the system only at the boundary. law:catalog holds every
     catalogued operation to a canon DEF or a registered row; these two
     resolve here. -->
Operation 'compile' is registrable.
Operation 'apps_compile' is registrable.

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

<!-- REGISTERED BY THE JS HOST, and clock and the crypt pair are added to the registrable
     list at the same time because they were filled without ever being declared fillable.
     Probed through Ev, 2026-09-14: an unresolved atom is empty, anything else resolved.
     What is left registrable and unregistered -- compile, apps_compile, and the three csdp
     seams -- is what `Operation awaits a driver` now derives, and those are the points a
     person or an llm drives by hand. -->
Operation 'clock' is registrable.
Operation 'crypt:encrypt' is registrable.
Operation 'crypt:decrypt' is registrable.
Operation 'crypt:genkey' is registrable.

Operation 'synthesize' is registered.
Operation 'validate' is registered.
Operation 'clock' is registered.
Operation 'crypt:encrypt' is registered.
Operation 'crypt:decrypt' is registered.
Operation 'crypt:genkey' is registered.

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
Function 'escape_html' has Definition Origin 'compiled'.
Function 'escape_html' accepts Type Expression 'text'.
Function 'escape_html' yields Type Expression 'html-text'.
Function 'slug' has Definition Origin 'compiled'.
Function 'slug' accepts Type Expression 'text'.
Function 'slug' yields Type Expression 'identifier'.
Function 'strip_prefix' has Definition Origin 'compiled'.
Function 'strip_prefix' accepts Type Expression 'prefix-and-text'.
Function 'strip_prefix' yields Type Expression 'text'.

<!-- The boundary is only a query over P if every registered function has an
     origin fact. Enumerating the runners' registration tables against canon's
     own DEF names found six that had none: three js-host primitives (chars,
     reverse, trans), two controls the web and wpf hosts register beyond the
     eight ui:renderers names (render:button, render:textbox), and the durable
     write itself. Origin-only, since at-most-one is the constraint and the
     signature facts follow when the manifest lands.

     The rule that decides which side a name falls on: a host name canon does
     NOT define is registered; a host name canon DOES define is a native twin
     (an acceleration, like the js host's FASTPRIMS for theta:member and
     friends) and stays compiled. Getting that backwards would make Eq 5's
     restriction meaningless by marking half of canon as boundary. -->

Function 'chars' has Definition Origin 'registered'.
Function 'reverse' has Definition Origin 'registered'.
Function 'trans' has Definition Origin 'registered'.
Function 'store:append' has Definition Origin 'registered'.
Function 'render:button' has Definition Origin 'registered'.
Function 'render:textbox' has Definition Origin 'registered'.

<!-- exec ruling (2026-07-16): the canon prefix families declared as
     Domains — TENANTS of the base store (namespacing is tenancy:
     Backus 14.7, a cell whose contents is another entire store). Each
     family's definitions are cells within its tenant sub-store; the
     colon in theta:dedup denotes the fetch path, not a flat prefix. -->
Domain 'theta' has Description 'The adequate relational algebra of Codd 2.2 as canon: projection, natural join, tie, restriction, and the set helpers they ride on.'.
Domain 'system' has Description 'The AST system layer as canon: cell reflection, state machine rows, compiled-rule builders, scheduler classification, views, and render.'.
Domain 'ast' has Description 'Cells, fetch, store, and DefineIn per Backus 13.3.4 and 13.3.5.'.
Domain 'constraints' has Description 'The constraint family builders: uniqueness, mandatory, subset, equality, exclusion, value, frequency.'.
Domain 'csdp' has Description 'The Conceptual Schema Design Procedure as canon: seven steps composed, three registered seams.'.
Domain 'rmap' has Description 'Relational mapping as canon: the store form, absorption and separation.'.
Domain 'manifest' has Description 'Def 9 origins computed from the store: the enumerable boundary as set arithmetic.'.
Domain 'law' has Description 'The standing laws as canon: carrier unfolding, set algebra, and the checks law:report names — gates are definitions the mu applies, never host code, and a law that executes needs no restatement.'.
Domain 'nav' has Description 'The navigation map as emitted view: patterns generated from rmap per Thm 2 — an entity group answers collection and item patterns, a separated fact type one pattern per curry prefix, links(e) = nav(e) union transitions — one map serving browser, console, and server by varying registered render functions.'.
Domain 'derive' has Description 'The fixpoint as canon, semi-naive and stratified from birth: seven recipe forms (proj, join, joinon, sel, cmp, minus, count), each round bounded to the deltas, layers ordered so settled-required reads and positive feeders precede their readers, rule scope fixed by the sources the recipe names — never the whole population.'.
Domain 'induce' has Description 'Codd 2.3 as canon: attempts to induce the redundancies, fallible by construction — candidate recipes generated under declared-signature filtering, gated by coverage and exactness, ranked by the standing judge; adoption stays a modeling judgment at the boundary.'.
Domain 'rules' has Description 'The metamodel star rules as executable data, complete: the defined/terminal/rooted/effective-initial family, both Mealy edges, all three reaches closures, the dependency graph, the bridge casts and belongs-to family, arity by count, Domain Change blocking and validity, Failure succeeds Violation, Transition occurred at Timestamp — held to ten known answers by law and to Cor 6 by stratification.'.

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

<!-- The render surface (2026-07-19, the registration ruling: components
     register INTO DEFS, never a side table): each abstract control's
     realization is a registered definition a container supplies at its
     OnSetDefinitions moment; the canon's ui:renderers names the surface,
     so the manifest's total walk computes these rows. -->
Function 'render:canvas' has Definition Origin 'registered'.
Function 'render:canvas' accepts Type Expression 'placed-row'.
Function 'render:canvas' yields Type Expression 'widget'.
Function 'render:headerbar' has Definition Origin 'registered'.
Function 'render:headerbar' accepts Type Expression 'placed-row'.
Function 'render:headerbar' yields Type Expression 'widget'.
Function 'render:titletext' has Definition Origin 'registered'.
Function 'render:titletext' accepts Type Expression 'placed-row'.
Function 'render:titletext' yields Type Expression 'widget'.
Function 'render:backbtn' has Definition Origin 'registered'.
Function 'render:backbtn' accepts Type Expression 'placed-row'.
Function 'render:backbtn' yields Type Expression 'widget'.
Function 'render:sectionheader' has Definition Origin 'registered'.
Function 'render:sectionheader' accepts Type Expression 'placed-row'.
Function 'render:sectionheader' yields Type Expression 'widget'.
Function 'render:sep' has Definition Origin 'registered'.
Function 'render:sep' accepts Type Expression 'placed-row'.
Function 'render:sep' yields Type Expression 'widget'.
Function 'render:itemrow' has Definition Origin 'registered'.
Function 'render:itemrow' accepts Type Expression 'placed-row'.
Function 'render:itemrow' yields Type Expression 'widget'.
Function 'render:blocktext' has Definition Origin 'registered'.
Function 'render:blocktext' accepts Type Expression 'placed-row'.
Function 'render:blocktext' yields Type Expression 'widget'.

<!-- The storage surface (2026-07-20, the emit ruling: recording is
     storage registration; the byte form is canon, so a worthy driver
     holds nothing but the platform's one durable write). ntoa and
     quote_str sit at the registered boundary beside lex and
     escape_html. (store:append WAS listed here as the effect verb and is
     gone 2026-08-12: Backus 13.3.4 defines store in the ALGEBRA --
     down-arrow-n = pair -> (push n).[1, (pop n).2] over apndl/tl/eq/length --
     and canon already carries it as ast:Store/ast:Pop/ast:Purge. No host ever
     implemented store:append and nothing but the now-deleted store:effects
     named it, so it was a false row in the enumerable boundary: Cor 6 is
     meant to be the honest list of where unverified computation enters, and
     it claimed a host capability that did not exist.) Enumerable through
     the canon's store:effects the way render:* is through
     ui:renderers. -->
Function '*' has Definition Origin 'registered'.
Function '*' accepts Type Expression 'number-pair'.
Function '*' yields Type Expression 'number'.
Function '/' has Definition Origin 'registered'.
Function '/' accepts Type Expression 'number-pair'.
Function '/' yields Type Expression 'number'.

<!-- The decimal surface (2026-09-15, arest #109). `*` above is exact decimal
     multiplication and `/` exact truncation toward zero; neither lands a
     product back in the scale its column declares, because DECIMAL(p1,s1) x
     DECIMAL(p2,s2) is DECIMAL(p1+p2, s1+s2). round<x, s> is that total map
     from the wider domain into DECIMAL(., s) -- half away from zero, which
     is what Abstract SQL Type DECIMAL means by ROUND in Postgres numeric,
     MySQL, Oracle and SQL Server, so a store and the SQL it projects agree.
     Half-even is a DIFFERENT function and would be another row here, never a
     mode flag. A negative scale rounds to tens and hundreds, so the operand
     is a number-pair like every other arithmetic row.

     ONLY THE js HOST IMPLEMENTS IT, AND ONLY js CAN. The certified hosts
     have no decimal in their value domain to round:
     tools/rust-host/src/lib.rs:1214 is `fn N(n: i64) -> V`,
     tools/cs-runner/Reader.cs:113 is int.Parse and
     tools/java-runner/Reader.java:106 is Integer.parseInt, so N(6.875) does
     not compile in one and throws in the other two. This row is the
     declaration of record; design-state carries it once the oracle runs
     again, and until then the store simply does not mention round -- which
     law:origins_match permits, since the store's registered set need only be
     a SUBSET of the manifest's, not equal to it. -->
Function 'round' has Definition Origin 'registered'.
Function 'round' accepts Type Expression 'number-pair'.
Function 'round' yields Type Expression 'number'.
Function 'ntoa' has Definition Origin 'compiled'.
Function 'ntoa' accepts Type Expression 'number'.
Function 'ntoa' yields Type Expression 'text'.
Function 'quote_str' has Definition Origin 'compiled'.
Function 'quote_str' accepts Type Expression 'text'.
Function 'quote_str' yields Type Expression 'text'.
Function 'clock' has Definition Origin 'registered'.
Function 'clock' accepts Type Expression 'sequence'.
Function 'clock' yields Type Expression 'text'.

<!-- The encryption surface (2026-07-20, the hooks ruling: don't assume
     encryption is just there - the core carries the named seam, a host
     registers real platform crypto only when a domain's data types
     demand it, and an unregistered hook refuses loudly through the mu).
     Enumerable via the canon's crypt:effects, the store:effects
     pattern. -->
Function 'crypt:encrypt' has Definition Origin 'registered'.
Function 'crypt:encrypt' accepts Type Expression 'key-and-text'.
Function 'crypt:encrypt' yields Type Expression 'ciphertext'.
Function 'crypt:decrypt' has Definition Origin 'registered'.
Function 'crypt:decrypt' accepts Type Expression 'key-and-ciphertext'.
Function 'crypt:decrypt' yields Type Expression 'text'.
Function 'crypt:encrypt' is inverted by Function 'crypt:decrypt'.
Function 'crypt:decrypt' is inverted by Function 'crypt:encrypt'.

<!-- AND THE KEY THOSE TWO TAKE HAS TO COME FROM SOMEWHERE (Samuel, 2026-09-15:
     "Would it make sense to have a canon method to generate a key?" / "and
     invoke via mcp?"). Not canon: Def 3 admits only a deterministic,
     side-effect-free total function, and a key consumes entropy and answers
     differently every call. Registered, then, in the boundary Cor 8 enumerates
     -- and the host already HAS the entropy, since randomBytes makes
     crypt:encrypt's iv. Naming it here is the difference between a boundary
     that lists where unverified computation enters and one that omits the step
     that mints the secret everything else depends on.

     IT YIELDS A FINGERPRINT, NOT A KEY, and that is what makes it safe to put
     on the MCP surface at all. An answer is transcript. core.md:1227 already
     rules the key "cannot live in the store it protects"; the reply is the same
     argument. So the yielded Type Expression is a truncated digest -- enough to
     tell two keys apart, useless for decrypting -- and the key itself reaches
     .env and nothing else. It refuses rather than overwriting, on an active
     environment key or one already in the file, because a second key silently
     orphans every ciphertext made under the first. -->
Function 'crypt:genkey' has Definition Origin 'registered'.
Function 'crypt:genkey' accepts Type Expression 'env-path'.
Function 'crypt:genkey' yields Type Expression 'key-fingerprint'.
