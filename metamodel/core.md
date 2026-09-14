# AREST Core Metamodel

<!-- arest-batch (Samuel's ruling, 2026-07-15): the metamodel is canonical
     FORML/ORM/Halpin. Legacy GraphDL vocabulary is renamed in all operative
     sentences: Noun -> Object Type, the old {entity, value} enum -> Object Kind
     (Halpin Fig 13.29: "each EntityType is an ObjectType that is of OTkind
     'Entity'"), Verb -> Predicate, Reference Scheme -> Reference Mode.
     Historical comments below retain the names in use when they were
     written.

     Two amendments, 2026-08-02:

     (1) The enum is Object Kind, not OT Kind. `OTkind` is Halpin's label on
     Figure 13.29 — a diagram label, abbreviated for space on a figure, not
     a verbalization. A reading is the sentence a domain expert validates,
     so an abbreviation is the one thing that cannot go there: "Object Type
     is of Object Kind 'value'" reads aloud, "is of OT Kind" does not. The
     quotation of Halpin above is left verbatim because it is a quotation;
     the departure is from his figure label, not from his model.

     (2) The note's last clause was backwards and is removed. It claimed
     canon cell names still carried the old vocabulary. In fact the canon
     held three legacy strings total (`State_Machine_Definition_is_for_Noun`
     and two copies of the reading fragment "is for Noun"), while `Noun`
     survived in 91 live places across the READINGS. Both are now clean;
     the stale artifacts are the serialized stores, which are keyed by the
     old cell names until regenerated. -->

<!-- Layer map (arest-batch task 3): two vocabularies share this file.
     ORM-canonical — echoes of Halpin's metamodel (Fig 13.29) and NORMA's
     ORM2Core: Object Type, Object Kind, Entity Type, Value Type, Fact Type,
     Predicate, Reading, Role, Constraint, Constraint Type, Derivation
     Rule, Reference Mode, Join Path/Join/Role Sequence/Role Projection,
     Value Range/Bound/Facet, Unit/Dimension, Conceptual Data Type/Data
     Type Group. AREST-extension: Function (the FFP root and DEFS cell),
     Object Type Instance, Event Type as Fact Type supertype, Definition Origin, Type
     Expression, Domain, Migration, Language/Format, External System,
     schema:Thing, and the HTTP/API/JSON/SQL projection vocabulary.
     state.md (Harel SMDs) and instances.md (runtime) are AREST layers
     end to end and carry their own head notes. -->


## Entity Types

Function(.id) is an entity type.
  <!-- arest (Halpin sweep, 2026-07-15): the ONLY declared reference
       mode in the metamodel. Book (2nd-ed text) §6.7: "By default, a
       subtype inherits the primary reference scheme of the root
       supertype; in this case the reference scheme is not displayed on
       the subtype" — and §10.4 marks a subtype-own scheme as the
       advanced case ("shown if and only if the subtype has at least one
       direct supertype with a DIFFERENT primary reference scheme"),
       mapped via total tables and "extremely complex reference
       constraints". The 48 per-kind modes ((.id)/(.Name)/(.code)/
       (.Email)/(.Reference)) were exactly that case and mapped as
       dual-identity bridge columns on this root's table. They are
       stripped: every subtype identifies through Function(.id) — a
       Def 9 definition's name IS its identity, one id space in D.
       Former natural-key modes survive as data where they carry
       information beyond identity (Object Type Instance has Reference, User has
       Email — mandatory 1:1 secondary references). -->
Object Type is a subtype of Function.
  Entity Type is a subtype of Object Type.
  Value Type is a subtype of Object Type.
  For each Object Type, exactly one of the following holds:
      that Object Type is an Entity Type;
      that Object Type is a Value Type.
  <!-- Added 2026-08-02. The two defining conditions were already declared
       below as derived rules, but the subtypes themselves were never
       declared, so both rules had heads naming types the model did not
       contain. Halpin's Fig 13.29 compresses this into the OTkind
       attribute; the later editions spell out the partition.

       The verbalization is NORMA's, not a shorthand: the
       ForEachIndentedQuantifier snippet ("for each {0},") composed with
       GroupExclusiveOr ("exactly one of the following holds:") and the
       CompoundList separators. GroupExclusiveOr is exclusion AND
       exhaustion in one, which is why no separate totality line appears —
       an earlier draft of this block carried one and it was redundant.
       Plain exclusion without exhaustion is GroupExclusion, "at most one
       of the following holds", which is what the other eight partitions in
       this corpus needed. -->

<!-- Abstractness is deliberately NOT declared here (2026-08-02). An
     Object Type is abstract when it is a supertype that does not absorb
     its subtypes — one table per subtype, none for the supertype. That is
     a consequence of the Rmap absorption outcome, so it derives; asserting
     it would be modeling the symptom.

     What it would derive FROM does not exist yet. csdp.md models Rmap as a
     machine whose step 0 is absorption, but as an event that advances the
     procedure ('Relational Mapping absorbs subtypes'), never as a per-type
     outcome — there is no `Subtype is absorbed into Object Type` fact.
     Given one, this is a one-line derived unary:

       *Object Type is abstract if and only if some Object Type is a
        subtype of that Object Type and is not absorbed into it.

     Until then, note the live consequence: forml2-grammar.md accepts
     `is abstract` as a Trailing Marker (:30) and classifies it (:240), but
     the metamodel has no head for it, which is why the grammar carries
     'abstract' as a third value in its Object Kind column. That third
     value is the symptom of this same gap, not a kind. -->

  Event Type is a subtype of Function.
  Fact Type is a subtype of Event Type.
  Subtype Fact is a subtype of Fact Type.
  <!-- ORMCore (NORMA's own metamodel, made canonical here 2026-09-10 at
       Sam's ruling): SubtypeFact derives from FactType (ORMCore.dsl:712),
       its two roles a SubtypeMetaRole and a SupertypeMetaRole
       (ORMCore.dsl:2437, :2443), its reading `{0} is a subtype of {1}`
       and its name `{0}IsASubtypeOf{1}` (ORMModel.resx). The oracle
       reflects every subtype fact on its own reading-shaped surface
       (state:subtypefacts), so its roles, players and reading follow at
       boot like any fact type's, and lists it as an instance of Subtype
       Fact (Object Type Instance is instance of Object Type). The meta
       roles are the reading's positions 1 and 2, which is also how NORMA
       finds them when the role class is absent (SubtypeFact.cs:100-136);
       they are not declared as Role subtypes here because nothing attaches
       to them. The links themselves are Halpin's fact type below, `Object
       Type is subtype of Object Type`. -->

  For each Function, at most one of the following holds:
      that Function is an Event Type;
      that Function is a Constraint;
      that Function is a Derivation Rule.
  <!-- arest-batch ruling 1 (FFP): one root. Everything the metamodel
       names is a cell in D; the ORM spelling is a subtype edge to
       Function (schema content) or to Object Type Instance (runtime instances, itself
       a Function subtype). Backus has no lattice — atoms and sequences,
       kind by head atom — so these edges are fragment R's per-type
       statement of rho's totality, the same way the spanning UCs state
       Def 3's set semantics per fact type. Schema elements surface as
       addressable Object Type Instances by reflection (instance-of), never by a second
       subtype path. The former Object Type Instance placements of this trio migrate
       accordingly. -->
  <!-- arest-audit A: State Machine Definition removed from the exclusive
       list. state.md declares `State Machine Definition is a subtype of
       Status` (the Harel nesting, deliberate per instances.md task-987),
       so SMD and Status cannot also be mutually exclusive siblings — the
       pair of declarations forced SMD's population empty. SMD inherits
       Status's exclusions through the subtype.
       arest-audit I (NORMA CompatibleSupertypesError): Status removed
       too. Its home is `Status is a subtype of Noun` (state.md); listing
       it here also made it a direct Object Type Instance subtype, giving Status two
       unrelated identification paths (Noun -> Function.id vs
       Object Type Instance.Reference). Status's schema-side identity flows through
       Noun; schema elements surface as Object Type Instances by reflection
       (`Object Type Instance is instance of Noun`, instances.md), not by subtyping. -->


Reading is an entity type.
Reading is a subtype of Function.

Role is an entity type.
Role is a subtype of Function.

Predicate is a subtype of Function.
  HTTP Method is a subtype of Predicate.

Constraint is an entity type.
  Constraint is a subtype of Function.
* Each Set Comparison Constraint is a Constraint that is of some Constraint Type that has Constraint Type Family 'set-comparison'.
* Each Frequency Constraint is a Constraint that is of some Constraint Type that has Constraint Type Family 'frequency'.
* Each Cardinality Constraint is a Constraint that is of some Constraint Type that has Constraint Type Family 'cardinality'.
* Each Ring Constraint is a Constraint that is of some Constraint Type that has Constraint Type Family 'ring'.
<!-- #66: Ring Constraint was SPOKEN of by two deontic sentences (core.md:945,
     :955) and declared nowhere, so both obligations resolved to no type and
     were enforced by nothing — meaning present in the text, absent from the
     machinery. Declared as a DERIVED subtype. 88b218a8 made it ASSERTED and
     added a separate obligation tying it to Constraint Type Family 'ring',
     because the one-hop arm could not express a chained predicate; that
     commit's own note defended the pair as "the tie between the two".
     6ddb4182 shipped the chained arm, so THE TIE IS THE DEFINITION and the
     obligation is retired: it restated the predicate word for word, which is
     one meaning in two places. NORMA's RingConstraint is a CLASS subtype
     (RingConstraint : SingleChildSequenceConstraint) carrying a ring-type
     attribute, and Halpin's "Subtyping Revisited" Sec 3 permits asserted,
     derived and semi-derived alike -- so deriving it is the choice that removes
     the duplication, not the only legal one. Sec 3 also fixes the consequence:
     only an ASSERTED subtype needs its exclusion declared "since it is not
     derivable". Deliberately NOT added to the exclusion set above:
     both exclusion declarations in this metamodel are 3-element and a 4-element
     one is unprecedented here, so widening it is a separate ruling with its own
     evidence, not a silent rider on a declaration fix. -->

Constraint Type is an entity type.
Constraint Type is a subtype of Function.

Derivation Rule is an entity type.
  Derivation Rule is a subtype of Function.

Modality Type is a value type.
  The possible values of Modality Type are 'Alethic', 'Deontic'.
  The data type of Modality Type is text.

World Assumption is a value type.
  The possible values of World Assumption are 'closed', 'open'.
  The data type of World Assumption is text.

Language is an entity type.
Language is a subtype of Function.

schema:Thing is an entity type.
schema:Thing is a subtype of Function.

External System is an entity type.
External System is a subtype of Function.

Domain is an entity type.
Domain is a subtype of Function.
  <!-- arest-batch ruling 2: Domain is the namespace unit `Function
       belongs to Domain` requires — declared at last, schema-side under
       Function. Access and Scope are organization-domain vocabulary per
       Cor 2 (authorization is a derivation over User/Organization facts,
       never an enum stored on Domain); both stay out of core, and the
       stray Access instance facts are preserved as comments until
       organization readings exist. -->
Domain has Description.
  Each Domain has at most one Description.

<!-- The party kinds (ruling 2026-07-24, per Halpin's Subtyping
     Revisited 4 and the Party pattern): Human, Organization, and
     Agent are RIGID kinds - an instance belongs for its whole
     existence. Function's one id space is the Party scheme ("a
     simple global identification scheme for all parties").
     Declared in core so the kind anchors before any
     alphabetically-earlier app file can infer a kind from usage.

     User is NOT a subtype of any one kind. It was, briefly, until
     the audit against Subtyping Revisited 4 asked the paper's own
     remodel question - "if our business domain includes (now or
     possibly later) some people or organizations that are not
     customers, then we do need to remodel" - and the ruling came
     back that agent users and company users are real. So User is a
     ROLE subtype of Object Type Instance, the mixin, exactly as Fig. 11 hangs
     Customer off Party rather than off Person: a role type over the
     one id space, migration permitted, open to every kind. Any
     facts specific to one kind of user belong on an intersection
     subtype (Fig. 11's PersonalCustomer/CorporateCustomer), not on
     User itself. -->        
Human is an entity type.
Human is a subtype of Object Type Instance.
Organization is an entity type.
Organization is a subtype of Object Type Instance.
Agent is an entity type.
Agent is a subtype of Object Type Instance.

## Value Types

URL is a value type.
  The data type of URL is text.
Secret Reference is a value type.
  The data type of Secret Reference is text.
Reference Mode is a value type.
  The data type of Reference Mode is text.

<!-- exec (2026-07-16): the bare id/code value types are RETIRED. They were
     reference-mode vocabulary; the reference-scheme sweep left them declared
     with no fact role, and a roleless value type maps to a degree-1 relation,
     which is just the active domain (Codd 1970 2.3) — derived, never stored.
     Only an INDEPENDENT object type earns a standalone table (Halpin), and
     none of these was one. Same retirement: Data (was in the roster below)
     and Confidence (outcomes.md, superseded by Confidence Score). -->
Arity is a value type.
  The data type of Arity is integer.
Position is a value type.
  The data type of Position is integer.
Sequence Number is a value type.
  The data type of Sequence Number is integer.
  <!-- Which argument sequence of a constraint a span belongs to. Paired
       with Position it gives the 1.1 / 1.2 / 2.1 numbering.

       The number is family-neutral; what the pair MEANS is the Constraint
       Type's. Subset reads 1 as included in 2, so sequence 1 is the
       antecedent and a materializing subset fills 2. Equality reads 1 as
       equal to 2, which is symmetric — a materializing equality provides
       in both directions. Exclusion reads them as disjoint and can only
       refuse, so it never carries a Derivation Mode. Reading the ordinal
       as "1 = subset" would re-specialize the mechanism to the one family
       it started in. -->

Min Occurrence is a value type.
  The data type of Min Occurrence is integer.
Max Occurrence is a value type.
  The data type of Max Occurrence is integer.
Name is a value type.
  The data type of Name is text.
Plural is a value type.
  The data type of Plural is text.
Object Kind is a value type.
  The possible values of Object Kind are 'entity', 'value'.
  The data type of Object Kind is text.
<!-- `Format` was a value type here (legacy widget Format: 'text', 'date',
     'boolean'). It is PROMOTED to a first-class, extensible entity type
     `Format(.Name)` in the NORMA Value Domain section below (alongside
     `Conceptual Data Type`), so new presentation Formats are added by
     declaring instances rather than editing a closed enumeration. The
     `Noun has Format` binary at :109 is unchanged in surface syntax but is
     now an entity-valued refinement link (Noun -> Format entity). No live
     reading or app ever populated `Noun has Format`, so the promotion is
     data-safe. See "## NORMA Value Domain" -> Format. -->
Enum Values is a value type.
  The data type of Enum Values is text.
Minimum is a value type.
  The data type of Minimum is decimal.
Maximum is a value type.
  The data type of Maximum is decimal.
Exclusive Minimum is a value type.
  The data type of Exclusive Minimum is decimal.
Exclusive Maximum is a value type.
  The data type of Exclusive Maximum is decimal.
Multiple Of is a value type.
  The data type of Multiple Of is decimal.
Min Length is a value type.
  The data type of Min Length is integer.
Max Length is a value type.
  The data type of Max Length is integer.
Pattern is a value type.
  The data type of Pattern is text.
Description is a value type.
Local Name is a value type.
  The data type of Local Name is text.
  The data type of Description is text.
Text is a value type.
  The data type of Text is text.
URI is a value type.
  The data type of URI is text.
Prefix is a value type.
  The data type of Prefix is text.
Header is a value type.
Header Value is a value type.
  The data type of Header is text.
Kind is a value type.
  The data type of Kind is text.
Timestamp is a value type.
  The data type of Timestamp is datetime.
Argument Length is a value type.
  The data type of Argument Length is integer.
Declaration Order is a value type.
  The data type of Declaration Order is integer.
  <!-- exec (2026-07-16): renamed from the bare Order — too generic, and
       it collided with the first test app entity. This is the ordinal
       position of a fact type in its declaration source. -->
Result is a value type.
  The data type of Result is text.
Title is a value type.
  The data type of Title is text.

Permission is a value type.
  The possible values of Permission are 'create', 'read', 'update', 'delete', 'list', 'versioned', 'login', 'rateLimit'.
  The data type of Permission is text.

Role Relationship is a value type.
  The possible values of Role Relationship are 'many-to-one', 'one-to-many', 'many-to-many', 'one-to-one'.
  The data type of Role Relationship is text.


<!-- arest-batch ruling 2 (organizations-domain vocabulary, moved out):
Scope is a value type.
  The possible values of Scope are 'organization', 'public'. -->

Derivation Mode is a value type.
  The possible values of Derivation Mode are 'fully-derived', 'derived-and-stored', 'semi-derived', 'semi-derived-and-stored'.
  The data type of Derivation Mode is text.
  <!-- marker ruling (Samuel, 2026-08-04): 'semi-derived-and-stored' added. The
       enum carried three of Halpin's four ORM 2 derivation markers, so the
       corpus could not express `++` at all. The four are orthogonal, storage on
       one axis and assertability on the other:
         *   derive at runtime
         **  derive and store
         +   derive or assert
         ++  derive and store, or assert
       The missing mode is the only one that supports a computed DEFAULT an
       author may then override. A runtime-derived cell (`*`, `+`) recomputes on
       every read, so an assertion to the contrary is overwritten, which is the
       non-monotonic retraction Lem 1 excludes and which state.md already hit on
       effective-initial. A STORED cell is materialized once and persists, so a
       later assertion survives until the next materialization.
       First use: `Subscription is set to cancel at period end` in
       apps/auto.dev/plans-subscriptions.md, where an admin-provisioned trial
       must default to cancelling at trial end and an admin may deliberately
       assert otherwise.
       AREST.tex enumerates only three ("fully derived (*), derived and stored
       (**, materialized), or semi-derived (+, also directly assertable)") and
       carries the same gap. Not corrected here; the readings lead.
       Follow-up, not taken unilaterally: NORMA models this as TWO orthogonal
       enums, completeness (fully / partially derived) crossed with storage
       (derived / derived and stored), which yields the four markers as products
       rather than as a flat list. Splitting this value type that way is the
       faithful modeling and would make the orthogonality structural, but it
       changes the shape of an existing populated value type. -->


Constraint Type Label is a value type.
  The data type of Constraint Type Label is text.

Constraint Type Family is a value type.
  The possible values of Constraint Type Family are 'ring', 'uniqueness', 'mandatory', 'frequency', 'value-comparison', 'set-comparison', 'subset', 'equality', 'deontic', 'cardinality'.
  The data type of Constraint Type Family is text.

Constraint Match Keyword is a value type.
  The data type of Constraint Match Keyword is text.

## Fact Types

### Object Type
Object Type is of Object Kind.
  Each Object Type is of exactly one Object Kind.

<!-- arest-batch (Halpin Fig 13.29, verbatim shape): the kinds as
     derived subtypes — "each EntityType is an ObjectType that is of
     OTkind 'Entity'". -->
* Each Entity Type is an Object Type that is of Object Kind 'entity'.
* Each Value Type is an Object Type that is of Object Kind 'value'.
Object Type has Plural.
  Each Object Type has at most one Plural.
<!-- one-table wave (2026-07-16): `Object Type has value-type- Name` (the
     GLOBAL uniqueness of value-type names, keyed on the Name role — it was
     the whole Name absorption table) is RETIRED as superseded by tenancy:
     names denote per store (Backus 14.7; the whitepaper's tenant-isolation
     proposition makes cross-store name comparison ill-formed), and the
     per-store statement is the external uniqueness over Domain and Local
     Name above. -->
Object Type has Format.
  Each Object Type has at most one Format.
Object Type has Enum Values.
  Each Object Type has at most one Enum Values.
Object Type has Minimum.
  Each Object Type has at most one Minimum.
Object Type has Maximum.
  Each Object Type has at most one Maximum.
Object Type has Pattern.
  Each Object Type has at most one Pattern.
Object Type has Description.
  Each Object Type has at most one Description.
Object Type has Exclusive Minimum.
  Each Object Type has at most one Exclusive Minimum.
Object Type has Exclusive Maximum.
  Each Object Type has at most one Exclusive Maximum.
Object Type has Multiple Of.
  Each Object Type has at most one Multiple Of.
Object Type has Min Length.
  Each Object Type has at most one Min Length.
Object Type has Max Length.
  Each Object Type has at most one Max Length.
Object Type has Permission.
  Each Object Type, Permission combination occurs at most once in the population of Object Type has Permission.
ObjectTypeHasPermission objectifies "Object Type has Permission".
ObjectTypeHasPermission is a subtype of Function.
Entity Type has Reference Mode.
  Each Entity Type has at most one Reference Mode.
  <!-- Halpin, ORM metamodel (Fig 13.29): the reference mode is a fact about
       an entity type -- a value type is identified by its values and has
       none -- and a subtype is identified by its supertype's scheme rather
       than by a reference mode of its own; a composite preferred identifier
       is a uniqueness constraint, not a reference mode. Moved here from
       Object Type on 2026-09-09 (Sam: "Object Type doesn't have a reference
       mode directly though, the entity subtype does"). The population is
       the reflection: each entity type with the reference mode it declares. -->
<!-- Halpin 13.8 (p.705): "you can capture subtype links by adding the fact
     type ObjectType is a subtype of ObjectType" -- this is that fact type.
     Its population is the direct links, one row per NORMA SubtypeFact
     (ORMCore.dsl:712), written by the oracle from the model it built; the
     fact type of each link, with its two roles and its reading `{0} is a
     subtype of {1}`, is reflected as a Subtype Fact (see Fact Type). An
     indirect subtype is not a row: subtypehood is transitive (6.5), the rows
     are the graph's edges, so the rings below are irreflexive and asymmetric
     and not transitive. Empty in every store until 2026-09-10. -->
Object Type is subtype of Object Type.
  Each Object Type, Object Type combination occurs at most once in the population of Object Type is subtype of Object Type.
ObjectTypeIsSubtypeOfObjectType objectifies "Object Type is subtype of Object Type".
ObjectTypeIsSubtypeOfObjectType is a subtype of Function.
Object Type is described to AI by prompt Text.
  Each Object Type, Text combination occurs at most once in the population of Object Type is described to AI by prompt Text.
ObjectTypeIsDescribedToAIByPromptText objectifies "Object Type is described to AI by prompt Text".
ObjectTypeIsDescribedToAIByPromptText is a subtype of Function.
Object Type has World Assumption. +
  Each Object Type has exactly one World Assumption.
  <!-- SEMI-DERIVED (ruling 2026-08-31, Samuel: "the default assumption is
       closed for world assumption unless it comes from an external
       system"). The mandatory says every Object Type has exactly one,
       nothing declared a default, and nothing asserted a single row — so
       the constraint was unsatisfiable by construction, and invisible with
       it, because until f47c0d81 no mandatory was checkable at all.

       `+` AND NOT `*`, which is the whole point of the marker: a default
       that can be overridden is derived OR asserted. Fully derived would
       say no author may ever state a world assumption, and an author must
       be able to — the default is a default, not a law. The same marker
       and the same reason as `Derivation Rule introduces values` below,
       `State Machine is currently in Status` (instances.md) and `Predicate
       is performed during Transition` (state.md).

       A DEFAULT IS NOT DATA either: one row per Object Type would put a
       ruling in 147 places and let them drift. The derivation is closed
       unless the type is backed by an External System, which is the
       paper's own line — §355, "A noun backed by an external system sits
       on this line: its population is fetched by a registered function,
       and its facts enter under the open-world assumption", with §309
       pairing an alethic constraint over a closed-world noun against a
       deontic one over an open-world noun. The predicate it turns on is
       declared above: `Object Type is backed by External System`.

       NOT AN iff RULE, and the first two attempts are why. A literal in
       the HEAD (`has World Assumption 'open' iff ...`) names no declared
       fact type and the oracle refuses it outright; moving the value into
       the body (`iff World Assumption is 'open' and ...`) resolves the
       head, reads badly, and lands among the 22 rules no arm accepts. The
       shape this wants is a SUBSET CONSTRAINT (Samuel, 2026-09-01: "should
       be with the World Assumption definition as a set of subset
       constraint derivations, default is open if function source is
       external sort of thing"), which is a declarative statement about
       populations rather than a recipe, is written beside the definition
       it constrains, and carries its own modality. -->
If some Object Type is backed by some External System then that Object Type has World Assumption 'open'.
If some Object Type is not backed by some External System then that Object Type has World Assumption 'closed'.
  <!-- TWO RULES, NOT ONE (Samuel, 2026-09-01: "you can't draw conclusions
       from open populations. The default needs a twin rule for
       non-external populations."). The first version of this stated only
       the exception and argued closed was implied by being an Object
       Type. That is a conclusion drawn from ABSENCE, and it is wrong
       twice over.

       As modelling: §355 says a noun backed by an external system has its
       population fetched by a registered function and "its facts enter
       under the open-world assumption", and that under the open world
       "the absence of a violation guarantees nothing". Not finding a type
       in a population is not a fact about that type.

       As mechanism: a constraint executed by filling its empty leg only
       ever produces rows for a leg some rule NAMES. With the exception
       stated alone, nothing derives 'closed' -- the default would be a
       default in prose and an empty population in fact, which is exactly
       the state this reading was in before any of this.

       So the default is a rule, and the pair is exhaustive and disjoint
       over one predicate, which is what makes `exactly one` hold by
       derivation rather than by assertion.

       KNOWN LIMITATION, stated rather than discovered later: NORMA files
       both of these as `textual constraint (model note: conditional)`
       because its two-clause chain builder does not accept a consequent
       carrying a VALUE literal, and the second also needs a negated
       binary antecedent, which the subset form has no spelling for beyond
       the negated-unary case. NORMA is a modelling tool and rendering a
       derivation as a note is reasonable there; AREST is what has to
       execute it. -->
Object Type is independent.
Object Type is of schema:Thing.
  Each Object Type is of at most one schema:Thing.
  It is possible that more than one Object Type is of the same schema:Thing.
Object Type plays Role.
  It is obligatory that each Object Type plays some Role.
  For each Role, exactly one Object Type plays that Role.
  It is possible that some Object Type plays more than one Role.

### Reading
Reading has Text.
  Each Reading has exactly one Text.
  It is possible that more than one Reading has the same Text.
Reading is used by Predicate.
  Each Reading is used by exactly one Predicate.
  It is possible that some Predicate is used by more than one Reading.
Reading is localized for Language.
  Each Reading is localized for at most one Language.
  It is possible that more than one Reading is localized for the same Language.
Reading is primary.
Role is used in Reading.
  Each Role, Reading combination occurs at most once in the population of Role is used in Reading.
  Each Role is used in some Reading.
  For each Reading, some Role is used in that Reading.
RoleIsUsedInReading objectifies "Role is used in Reading".
RoleIsUsedInReading is a subtype of Function.

### Fact Type (subtype of Object Type)
Fact Type has Title.
  Each Fact Type has at most one Title.
Fact Type has Reading.
  Each Fact Type has some Reading.
  For each Reading, exactly one Fact Type has that Reading.
  It is possible that some Fact Type has more than one Reading.
Fact Type has Role.
  Each Fact Type has some Role.
  For each Role, exactly one Fact Type has that Role.
  It is possible that some Fact Type has more than one Role.
Fact Type has Arity. *
  Each Fact Type has exactly one Arity.
Fact Type has Declaration Order.
  Each Fact Type has at most one Declaration Order.
Fact Type has Role Relationship.
  Each Fact Type has at most one Role Relationship.
Fact Type has Derivation Mode.
  Each Fact Type has at most one Derivation Mode.
Subtype Fact provides preferred identifier.
<!-- ORMCore SubtypeFact.ProvidesPreferredIdentifier, shown as
     IdentificationPath (ORMCore.dsl:731): the subtype link along which the
     subtype takes its supertype's reference scheme, the identifying path of
     "a subtype inherits the primary reference scheme of the root" (the note
     at Entity Type has Reference Mode). The oracle writes it from the model
     it built. NORMA's IsPrimary (ORMCore.dsl:726, not browsable) is a display
     choice and is not reflected. -->

### Role
Constraint spans Role.
  Each Constraint, Role combination occurs at most once in the population of Constraint spans Role.
  Each Constraint spans some Role.
Constraint Span objectifies "Constraint spans Role".
Constraint Span is a subtype of Function.
Constraint Span has Sequence Number.
  Each Constraint Span has exactly one Sequence Number.
Constraint Span has Position.
  Each Constraint Span has exactly one Position.
  <!-- Added 2026-08-05 (Samuel: "the subset is sequence 1, with roles
       numbered 1.1, 1.2, etc, and the superset is sequence 2"). The span
       was a pure Constraint x Role pair, recording WHICH roles a constraint
       spans but never in what sequence or order — so for a set-comparison
       constraint nothing said which spanned roles belonged to which
       argument sequence, and the ordered arguments of a compound span were
       unordered. Sequence Number and Position are that numbering: 1.1 is
       Sequence Number 1, Position 1. The families read the sequences
       differently (see Sequence Number); the span only numbers them.

       This is what `Derivation Rule is provided by Constraint` was standing
       in for. The 2026-07-15 ruling says a materializing constraint's
       derivation "compiles from the constraint's own role sequences", but
       the sequences were not in the model, so the rule could not be
       recomputed from its constraint and had to be reachable by a stored
       link. With the ordinals declared, antecedent is the spans at Sequence
       Number 1 and consequent the spans at 2, and the link becomes what it
       looked like all along: one bit (does this constraint materialize)
       that `Constraint has Derivation Mode` could carry instead.

       NORMA models this as Role Sequence with Position (1154); that entity
       exists here but belongs to the derivation-body decomposition and is
       never linked to Constraint. Numbering the span directly matches the
       flattened 1.1/1.2 form and needs no new wiring. -->
  <!-- objectification legal per Halpin, "Objectification and Atomicity"
       (2020-04-28): the UC above spans both roles. one-table wave
       (2026-07-16): identity through the one id space (the subtype), the
       spanning UC stays as the pairhood uniqueness; the old association-
       provides-identification form is retired. -->
<!-- one-table wave (2026-07-16): `Role has Position for Reading` (compound
     key Role+Reading) is Halpin's nesting transformation of the SAME content
     below — the position rides the objectified usage pair, so the compound-
     key ternary leaves the schema and the position column absorbs into the
     one Function table. -->
RoleIsUsedInReading has Position.
  Each RoleIsUsedInReading has at most one Position.

### Predicate
Predicate has Name.
  Each Predicate has exactly one Name.
  It is possible that more than one Predicate has the same Name.
Fact Type is activated by Predicate.
  In each population of Fact Type is activated by Predicate, each Fact Type, Predicate combination occurs at most once.
API objectifies "Fact Type is activated by Predicate".
API is a subtype of Function.
  <!-- objectification legal per Halpin, "Objectification and Atomicity"
       (2020-04-28): the UC above spans both roles. one-table wave
       (2026-07-16): identity through the one id space. -->
Fact is referenced by Predicate.
  Each Fact, Predicate combination occurs at most once in the population of Fact is referenced by Predicate.
  It is possible that some Predicate references more than one Fact.
  It is possible that more than one Predicate references the same Fact.
FactIsReferencedByPredicate objectifies "Fact is referenced by Predicate".
FactIsReferencedByPredicate is a subtype of Function.
<!-- arest-batch ruling 5: Moore/Mealy action attachment lives in
     state.md, single home; the Mealy relation is semi-derived there
     (Moore folds into it on entry). -->

### Function
Function has Name.
  Each Function has at most one Name.
Function has callback URI.
  Each Function has at most one callback URI.
Function is called with HTTP Method.
  Each Function is called with at most one HTTP Method.
  <!-- THE PATH WITHOUT THE METHOD IS HALF AN ADDRESS. `Function has callback
       URI` has been here since the connector work and says WHERE; nothing said
       WITH WHAT, so a performer assembling the call had to choose POST in host
       code, which is the one thing a host must never decide. Status has HTTP
       Method already (state.md:59) for the route a lifecycle step answers on;
       this is the same value type on the other side of the boundary, for the
       call the store MAKES rather than the one it serves. At most one, because
       a Function with two methods is two Functions.

       AND IT IS `is called with`, NOT `has`, BECAUSE `has` STOLE. Written the
       obvious way -- `Function has HTTP Method` -- this fact type captured
       `Status 'deleted' has HTTP Method 'DELETE'` outright: Status is a subtype
       of Function here, so the instance sentence matches both readings and the
       newer one wins. StatusHasHTTPMethod went from its one row to EMPTY and
       the oracle reported no errors; only reading the population showed it.
       A different predicate cannot capture it, and it is the truer sentence
       besides: a Status HAS the method it answers on, a Function IS CALLED WITH
       the one that invokes it.

       MEASURED 2026-09-12:
       support's sendSupportEmail has callback URI '/emails' and External System
       'resend' at https://api.resend.com, and the method was the only piece of
       the line the model could not supply. -->
Function sends Header.
  Each Function sends each Header at most once.
FunctionSendsHeader objectifies "Function sends Header".
FunctionSendsHeader is a subtype of Function.
  <!-- `has`, HERE, STOLE FROM External System. MEASURED 2026-09-12 on
       support's corpus: FunctionHasHeader carried 16 rows and every subject
       was an External System -- cornell-lii, congress-gov, auto.dev and the
       rest, cross-checked against ExternalSystemHasURL -- while
       ExternalSystemHasHeader carried NONE. External System is a subtype of
       Function, both readings were `{0} has Header {1}`, and the general one
       took every sentence the specific one was written for. Zero of those 16
       rows was ever a fact about a Function, so this fact type has never held
       its own population and nothing is lost by moving it off `has`.

       THE SAME COLLISION AS `Function has HTTP Method` against `Status has
       HTTP Method` the day before, and the same remedy: the specific subject
       keeps the plain verb, the general one takes a predicate that cannot
       capture. This one is worse only because nobody was watching -- the HTTP
       Method theft was caught the hour it was written, and this had been
       silently misfiling every connector's headers for as long as both
       declarations have existed. It is why the Resend credential could not
       reach the store, and why widening External System has Header to carry a
       value changed nothing on its own. -->
<!-- arest-batch ruling 2 (organizations-domain vocabulary, moved out):
Function has Scope.
  Each Function has at most one Scope. -->
Function belongs to Domain.
  Each Function belongs to at most one Domain.

Function has Local Name.
  Each Function has at most one Local Name.

For each Domain and Local Name, at most one Function belongs to that Domain and has that Local Name.
  <!-- exec ruling (2026-07-16, refined by Samuel mid-course): NAMESPACING
       IS TENANCY. A Domain is a tenant — a cell whose contents is
       another entire store (Backus 14.7; the paper: a tenant is a
       sub-store and a tenant's tenants are sub-sub-stores). A Function
       belongs to a Domain means its cell LIVES IN that domain's
       sub-store, and its Local Name is its cell name THERE, so
       similarly-named objects in different domains never collide: they
       are different cells in different stores. Resolution is fetch
       walking the path — up-arrow 'theta' answers a store, up-arrow
       'dedup' within it answers the cell — and the colon notation
       (theta:dedup) DENOTES that path, not a flat prefixed string. This
       external uniqueness, spanning belongs-to and has-local-name
       through their shared Function, is the relational statement of
       per-store name uniqueness; path uniqueness follows inductively
       from it plus the containment tree below. The sub-store is equally
       the restriction Restrict(store, domain) — containment and
       restriction are the materialized and derived views of the same
       tenant. -->

Domain is contained in Domain.
  Each Domain is contained in at most one Domain.

Domain reaches Domain. *
  Each Domain, Domain combination occurs at most once in the population of Domain reaches Domain.

No Domain reaches itself.
  <!-- SUB-TENANCY: domains nest, and the nesting is a tree — at most
       one parent, and the derived reachability closure is irreflexive,
       which gives acyclicity in the fragment (the state.md reaches
       pattern). A multi-segment path (a:b:c) is a walk down the tree:
       store a, then its sub-store b, then cell c. -->
It is obligatory that each Function belongs to some Domain.

Definition Origin is a value type.
  The possible values of Definition Origin are 'compiled', 'registered'.
  The data type of Definition Origin is text.
Function has Definition Origin.
  Each Function has at most one Definition Origin.
  <!-- arest-audit E: Def 9 — a definition is ⟨name, dom, cod, origin,
       impl⟩ with origin ∈ {compiled, registered}; Eq 5 filters DEFS on
       origin = 'registered', Cor 5 identifies that restriction with the
       decidability frontier, and Cor 1 reads rule bodies as data. Without
       an origin fact the boundary is not a query over P — it lived only in
       host kernels (the 17 boundary atoms were undeclared in-canon; the
       rebuild's manifest DEF is the ready salvage). At-most-one rather
       than exactly-one: Function's population includes runtime Object Type Instances
       (instances.md) that carry no definition; origin is mandatory exactly
       for DEFS entries. Signature (dom/cod) facts follow when the canon
       manifest lands. -->

Type Expression is a value type.
  The data type of Type Expression is text.
Function accepts Type Expression.
  Each Function accepts at most one Type Expression.
Function yields Type Expression.
  Each Function yields at most one Type Expression.
  <!-- arest-batch ruling 11: Def 9's dom and cod — accepts is dom,
       yields is cod. Values are lexical type expressions: an Object Type
       name where the signature is simple, an FFP shape expression where
       structured. Carried exactly for DEFS entries, like Definition
       Origin; population arrives with the canon manifest (the rebuild's
       SALVAGE transcribed dom/cod for the five boundary primitives). -->

Function is inverted by Function.
  Each Function is inverted by at most one Function.
  <!-- THE PAIR IS A FACT ABOUT THE FUNCTIONS, NOT A CONVENTION OVER THEIR
       TYPE EXPRESSIONS. Samuel, 2026-09-11, named `an encrypt/decrypt
       function` -- a pair -- and `Object Type is stored through Function`
       below names only one end of it, so the other end has to be findable.
       The first attempt said it already was: the inverse of an encryption
       is the Function whose accepts-type is what it yields. MEASURED, that
       resolves to nothing. crypt:encrypt yields `ciphertext`, crypt:decrypt
       accepts `key-and-ciphertext`, and NO Function in the model accepts
       `ciphertext`; `key-and-` occurs on 2 of the 112 accepts/yields rows,
       which is two functions agreeing, not a convention. Matching them
       would mean canon taking a prefix off an identifier to discover a
       fact -- grepping a name for something the model should say.

       NO RING CONSTRAINT, and both are deliberate. Irreflexive would be
       false: an involution is its own inverse. Symmetric would be true and
       the oracle reads no symmetric ring (Irreflexive, Asymmetric and
       Transitive are the three it knows), so the honest substitute is to
       assert both rows and let the at-most-one keep each end single. -->

Implementation is a value type.
  The data type of Implementation is text.
Function has Implementation.
  Each Function has at most one Implementation.
  <!-- audit-fix E (Def 9's impl; Samuel's ruling 2026-07-15): SYMBOLIC
       function definitions in Backus's functional forms (1978 Turing
       lecture, 11.2.4) — composition, construction, condition, constant,
       insert (fold), apply-to-all (alpha), selectors — serialized the way
       the canon's intersection vocabulary writes them (DEF/A/N/K/PHI()/
       S1..S9 over double-quoted atoms). The paper's Lem 1 claim "the
       bodies are data" gets its home here: a compiled definition's
       Implementation is rho(o) in symbolic form. Registration and
       resolution of ANY function already work (the Def 9 origin split;
       a registered prewritten module just implements the invocation), so
       lambda-in-the-host is the uninteresting, solved part. The
       interesting area — the reason this cell exists — is registering
       the alpha/fold-class combinators through FFP/AST so that fact
       types, facts, objects, CSDP, and RMAP are themselves DEFINED
       symbolically at the arest-arest level: the algebra of programs
       over the fact algebra. Population arrives with the canon
       manifest. -->

### Constraint
Constraint has modality of Modality Type.
Constraint has Text.
  Each Constraint has at most one Text.
Constraint is semantic.

<!-- WHICH DECIDER OWNS THIS CONSTRAINT (2026-09-05). Sam: the deontic rules
     for messaging split into "deterministic ones that may be determined by a
     rule such as a regex, population check, or other custom function, and
     otherwise ones to be determined by llm having to do with tone or policy",
     and a violation is a trigger to regenerate the message with the
     corrections, before human approval. Nothing in the model said WHICH kind a
     rule was, so both landed in one bucket -- 26 in one store, 36 in another,
     12 more in support.auto.dev's state-law-wiring.md -- and the runtime could
     not route what the model would not say.

     A Predicate is already a bound function (has Name, Module Path, Symbol
     Name), so naming one IS the deterministic case. Its absence is the judged
     case, made explicit as a derivation rather than left as an implication of
     silence. `Object Type is described to AI by prompt Text` is the hook the
     judged side already has, and `Constraint Type has Violation Template` is
     the corrections text a regeneration is handed.

     NOT `Constraint is semantic` above, which derives as deontic AND spanning
     a role whose object type has no instances -- that is "nothing to check
     against yet", a neighbouring notion, and reusing it here would conflate an
     empty population with a rule that needs judgement. -->
Constraint is decided by Predicate.
  Each Constraint is decided by at most one Predicate.
Constraint is machine-decidable. *

Constraint has Constraint Match Keyword.
  Each Constraint, Constraint Match Keyword combination occurs at most once in the population of Constraint has Constraint Match Keyword.
  It is possible that some Constraint has more than one Constraint Match Keyword.
ConstraintHasConstraintMatchKeyword objectifies "Constraint has Constraint Match Keyword".
ConstraintHasConstraintMatchKeyword is a subtype of Function.

### Constraint Type (merged #13: NORMA ConstraintType — one classifier carrying code, Name, Label, Family, and Violation Template)
Constraint is of Constraint Type.
  Each Constraint is of exactly one Constraint Type.
<!-- #66 root cause (cont 583): NO fact type joined Constraint to Constraint
     Type at all, so every sentence of the form "Constraint of Constraint Type
     'IR'" (validation.md:40, :53, :68) named a path that did not exist. The
     cardinality is not a preference: NORMA raises
     RingConstraintTypeNotSpecifiedError when the type is left unset, i.e. the
     typing is MANDATORY, which gives exactly one. The shape is the metamodel's
     own precedent for a kind-attribute, core.md:268-269
     `Object Type is of Object Kind. / Each Object Type is of exactly one Object Kind.` -->
<!-- `Constraint Type has Name. / Each Constraint Type has at most one Name.`
     is RETIRED for the same reason as Data Type Group has Name below: the
     rows are already in FunctionHasName — ["UC","Uniqueness"],
     ["MC","Mandatory"], ["IR","Irreflexive"] and the rest of the 24 — because
     Constraint Type is Function-rooted and `has Name` resolves to the root.
     ConstraintTypeHasName sat at 0 rows while ConstraintTypeHasConstraintTypeLabel
     carried all 24, which is the tell: the label fact type has a distinct
     predicate and gets reached, the naming one does not.

     `at most one` meant this never showed up as a mandatory violation, so
     unlike its sibling it was costing nothing — it was simply a declaration
     nothing could ever satisfy or contradict. -->
Constraint Type has Constraint Type Label.
  Each Constraint Type has exactly one Constraint Type Label.
Constraint Type has Constraint Type Family.
  Each Constraint Type has exactly one Constraint Type Family.

### Set Comparison Constraint (subtype of Constraint)
Set Comparison Constraint has Argument Length.
  Each Set Comparison Constraint, Argument Length combination occurs at most once in the population of Set Comparison Constraint has Argument Length.
SetComparisonConstraintHasArgumentLength objectifies "Set Comparison Constraint has Argument Length".
SetComparisonConstraintHasArgumentLength is a subtype of Function.

### Frequency Constraint (subtype of Constraint)
Frequency Constraint has Min Occurrence.
  Each Frequency Constraint has exactly one Min Occurrence.
Frequency Constraint has Max Occurrence.
  Each Frequency Constraint has at most one Max Occurrence.

### Cardinality Constraint (subtype of Constraint)
<!-- arest-audit D: Def 2 lists cardinality among the constraint kinds —
     a bound on the SIZE of a type's population (NORMA CardinalityConstraint),
     distinct from frequency's per-value occurrence bound. It was absent from
     this metamodel. Cor 2 leans on the kind directly: "a rate limit is a
     cardinality constraint over timestamped request facts"; §3's slack
     discussion tunes CAP posture by a cardinality constraint's distance
     from its bound. -->
Cardinality Constraint has Min Occurrence.
  Each Cardinality Constraint has at most one Min Occurrence.
Cardinality Constraint has Max Occurrence.
  Each Cardinality Constraint has at most one Max Occurrence.

### Constraint Span (objectification of "Constraint spans Role")
<!-- exec ruling (2026-07-16): the `Constraint Span autofills from
     superset` unary is RETIRED — a stored boolean where the mechanism
     belongs. A constraint that materializes its consequent does so by
     PROVIDING a derivation: see `Derivation Rule is provided by
     Constraint` under the Derivation Rule readings. Constraint Span is
     now a pure objectification. -->

### Stream
Stream has Name.
  Each Stream has exactly one Name.
  It is possible that more than one Stream has the same Name.

### API (objectification of "Fact Type is activated by Predicate")
API accepts Object Type as parameter.
  Each API, Object Type combination occurs at most once in the population of API accepts Object Type as parameter.
APIAcceptsObjectTypeAsParameter objectifies "API accepts Object Type as parameter".
APIAcceptsObjectTypeAsParameter is a subtype of Function.

## Constraints

Each Constraint has modality of exactly one Modality Type.
It is possible that more than one Constraint has modality of the same Modality Type.

## Disjunctive Mandatory Constraints

For each Status, some Transition is from that Status or some Transition is to that Status.


## Subset Constraints

If some Role is used in some Reading where some Fact Type has that Reading then that Fact Type has that Role.
<!-- residue fix (2026-07-16): both sentences below were phrased over `Fact
     uses Object Type Instance for Role`, the ternary the one-table nesting
     transformation retired (Fact fills Role + RoleInstance uses Object Type Instance)
     — the dangling-reference class. Rewritten over the current readings. -->
If some Fact fills some Role then that Fact is of some Fact Type that has that Role.
It is obligatory that each Object Type Instance that some RoleInstance uses is instance of some Object Type that plays the Role that RoleInstance fills.
  <!-- derived residue note (2026-07-17): the role-typing subset is
       expressible in NORMA only through the IMPLIED link fact types of
       the RoleInstance objectification (the sequence needs the pair's
       Fact and Role components, and the nesting transformation traded
       the flat ternary for link-machinery-only access — Halpin's own
       prescription). Implied link readings are not A-declared
       vocabulary, so the sentence stays deontic prose by construction,
       not by limitation; the canon's population-consistency and
       instance-attribution machinery carry the semantics. -->
<!-- the resource-typing leg correlates through the objectified pair, which
     Definition Fragment excludes (nested objectification lies outside R):
     it stands as the deontic obligation above until link-fact readings or
     the evaluator's validate step carry it. -->

If some Fact Type defines some Fact then some Object Type Instance that is that Fact is instance of some Object Type that is that Fact Type.
If some Fact is referenced by some Predicate and that Fact is of some Fact Type then some Reading is used by that Predicate where that Fact Type has that Reading.
If some Guard Run is for some Guard and that Guard Run references some Fact then that Guard references some Fact Type where that Fact is of that Fact Type.
<!-- exec (canonical alignment, 2026-07-16): both sentences above were
     phrased through INVERSE readings never declared ("Predicate uses
     Reading" for `Reading is used by Predicate`; "Fact Type defines
     Fact" for `Fact is of Fact Type`) — parseable by charity only.
     Reworded to the declared reading directions; both now build as real
     NORMA subset constraints with join paths. -->
If some State Machine is currently in some Status then that Status is defined in some State Machine Definition where that State Machine is instance of that State Machine Definition.
If some API accepts some Object Type as parameter and some other Object Type is subtype of that Object Type then that API accepts that subtype Object Type as parameter.
<!-- exec-4 adjudication (2026-07-15): the two Format subset sentences
     that stood here are retired — built as real NORMA SubsetConstraints,
     NORMA proved both redundant: "implied by a simple mandatory
     constraint on the superset role" (EqualityOrSubsetImpliedByMandatory
     / NotWellModeledSubsetAndMandatory). Each Object Type with a Format
     has a Conceptual Data Type because `Each Format is built on exactly
     one Conceptual Data Type` and the Format link already carries it;
     the mandatory is the one home. Retired forms:
       If some Object Type has some Format then that Object Type has some Conceptual Data Type.
       If some Object Type has some Format then that Format is built on some Conceptual Data Type. -->

## Ring Constraints

No Object Type is subtype of itself.
If Object Type1 is subtype of Object Type2, then Object Type2 is not subtype of Object Type1.
<!-- The population of `Object Type is subtype of Object Type` is the DIRECT
     links, one row per NORMA SubtypeFact (2026-09-10), so the transitive
     ring that stood here -- "If Object Type1 is subtype of Object Type2 and
     Object Type2 is subtype of Object Type3, then Object Type1 is subtype of
     Object Type3" -- would have made every chain of two links a violation.
     Subtypehood is transitive (Halpin 6.5: an indirect subtype), the stored
     links are the graph's edges, and the graph is acyclic; the oracle reads
     no acyclic ring form yet, so irreflexive and asymmetric are what is
     declared. -->

<!-- arest-audit B: the former rings here (irreflexive + intransitive; and
     validation.md carried irreflexive + asymmetric) contradicted Lem 1 and
     each other. Lem 1 licenses arbitrary recursion — self- and mutual
     recursion included (transitive closure is a legitimate rule) — and
     forbids exactly one shape: a VALUE-INTRODUCING rule on a dependency
     cycle. Intransitivity even forbade legitimate dependency diamonds
     (DR1→DR2→DR3 with DR1→DR3). Cor 1 makes the true check a query over
     the dependency graph; the faithful constraint follows. -->

Derivation Rule introduces values.
  <!-- THE `+` CAME OFF (2026-09-05) BECAUSE IT WAS A CLAIM ABOUT A RULE
       THAT IS NOT THERE. Halpin: "Derivation rules should normally be
       biconditionals (i.e., their main operator is iff). If their main
       operator is if, the fact type is only partly derived." So `+` says
       a rule EXISTS and is one-directional — it does not say "a rule is
       owed". The note below is right that assertion is the only
       population source until the evaluator phase lands, and that
       sentence is the definition of a BASE fact type. Marked `+`, this
       failed softly and invisibly for as long as it has existed: the
       asserted half populates, so the head looks alive while the derived
       half silently never arrives, and law:markers did not look at semi
       heads at all. The marker comes back in the same commit as the rule.
       Cor 1: value introduction is syntactic — a rule body applies a
       definition with origin 'registered' (the Eq 5 boundary) or a
       value-constructing base operation (arithmetic, length, dynamic
       application); every other operation rearranges atoms already in
       adom(P) or quoted in the rule. Semi-derived: asserting it from the
       body's clause shapes is an EVALUATOR-PHASE OBLIGATION (audit-fix
       A3 — the killed host's compile pass is the reference behavior; no
       compiler exists in this repo); an author may also assert it
       directly, and until the evaluator lands that is the only
       population source. -->

Derivation Rule reaches Derivation Rule. *
  Each Derivation Rule, Derivation Rule combination occurs at most once in the population of Derivation Rule reaches Derivation Rule.
If Derivation Rule1 reaches Derivation Rule2 and Derivation Rule2 reaches Derivation Rule3 then Derivation Rule1 reaches Derivation Rule3.
  <!-- ring adjudication (2026-07-17, derived): reaches is the transitive
       closure of depends-on (base + step rules below), and the closure of
       any relation is transitive — by induction on the base-side
       derivation, the step rule closes every composite. The TR ring is
       that theorem declared, Halpin's practice for derived ring fact
       types (ancestorOf); it is the ONLY listed ring property that holds:
       irreflexivity and acyclicity are correctly absent, because the
       closure must be able to hold cycles for Cor 1 to refuse the
       value-introducing ones. law:rules witnesses the theorem by
       execution: the chain of the derived closure minus the closure is
       empty. -->

It is impossible that some Derivation Rule introduces values and that Derivation Rule reaches that Derivation Rule.
  <!-- Lem 1's hypothesis as an alethic constraint, refused like any other
       (Cor 1: "refused like any alethic violation"; the rebuild SPEC called
       it G7 and ran it on every DEFS change). -->
  <!-- reclassified (2026-07-17): the second clause is a SELF-JOIN
       ("reaches THAT Derivation Rule" — the diagonal), and the
       single-column exclusion NORMA was holding silently overstated it
       ("introduces values and reaches ANYTHING") — masked only by empty
       populations. The content is the stratification theorem: it
       EXECUTES as law:finiteness (Cor 6 — a value-introducing rule
       reaching its own target is refused) and as derive:layers at every
       derivation; per Codd 1970 1.5 and the constitution ruling, an
       executing law needs no restating constraint. The oracle defers
       self-join impossibility clauses to this note class rather than
       misbuild them. -->

### External System
External System has URL.
  Each External System has exactly one URL.
External System has Header.
  Each External System has each Header at most once.
External System has Header with Header Value.
  Each External System, Header combination occurs at most once in the population of External System has Header with Header Value.
  <!-- A TERNARY, NOT AN OBJECTIFIED BINARY PLUS AN ATTRIBUTE, because the
       Header Value is functionally dependent on the System and the Header
       together, and because apps/connectors had ALREADY WRITTEN the ternary
       sentence -- `External System 'resend' has Header 'Authorization' with
       Header Value 'Bearer'` -- before any of this was declared. The model
       should hold the sentence a reader naturally wrote, not make the corpus
       restate it in two. -->
External System authenticates with Header.
  Each External System authenticates with at most one Header.
  <!-- A SYSTEM HAS MORE THAN ONE HEADER AND THEY CARRY VALUES, which this could
       not say. It was a binary with `at most one` and no Header Value type
       existed, so apps/connectors wrote what it needed anyway --
       `External System 'resend' has Header 'Authorization' with Header Value
       'Bearer'` plus a User-Agent and an `authenticates via` line -- and ALL
       THREE fell through silently. MEASURED 2026-09-12 on support's built
       store: ExternalSystemHasHeader 0 rows, and neither
       ExternalSystemHasHeaderWithHeaderValue nor
       ExternalSystemAuthenticatesViaHeader existed as a fact type at all. The
       oracle reported no errors. This is the same shape as the unquoted
       rotation limit and `Resource (.Name)` with a space: well-formed English
       the model cannot hold.

       OBJECTIFIED THE WAY `Function has Header` ALREADY IS, so the value hangs
       off the header rather than becoming a third role, and the authenticating
       header is named separately because WHICH header carries the credential is
       not something a caller should infer from the name. `with`, not `via`,
       because `Customer authenticates via Cookie Name` already exists and the
       lesson of this week is that a shared predicate steals. -->
External System has Prefix.
  Each External System has at most one Prefix.
External System has Kind.
  Each External System has at most one Kind.
Object Type is backed by External System.
  Each Object Type is backed by at most one External System.
Function is backed by External System.
  Each Function is backed by at most one External System.
Function reaches its subject through Fact Type.
  Each Function reaches its subject through at most one Fact Type.
  <!-- THE FACTS A CALL SENDS AND RECORDS ARE OFTEN NOT ABOUT THE ENTITY THAT
       FIRED IT. main:performed answers <predicate, entity, may-create> where the
       entity is the one whose STATUS MOVED -- support.auto.dev's Support Response
       -- while the body it sends and the receipt it records are facts of that
       response's EMAIL MESSAGE. One declared functional step apart, and nothing
       said which step, so perform:body_val could read the entity or the function
       and neither of those is the subject.

       A NARROW SPECIAL CASE OF A JOIN PATH, LIMITED TO ONE STEP ON PURPOSE. Join
       Path, Join and Role Sequence already model an arbitrary path and are
       populated by nothing, anywhere. A multi-step subject belongs there when
       something finally reads them. One functional step covers every caller that
       exists, is decided by the uniqueness constraint on the named fact type
       rather than by a search, and does not raise a second general mechanism
       beside the one already declared.

       ABSENT MEANS THE ENTITY ITSELF, which is what every Function without a
       federated subject wants, and is why this is optional rather than one more
       mandatory that nothing can satisfy. -->
Function yields Fact Type with Role from JSON Path.
  Each Function, Fact Type, Role combination occurs at most once in the population of Function yields Fact Type with Role from JSON Path.
  It is possible that some Function yields more than one Fact Type.
  It is possible that more than one Function yields the same Fact Type.
  <!-- THE RESPONSE HAD NOWHERE TO LAND. `Webhook Event Type yields Fact Type
       with Role from JSON Path` (ingest.md:49) covers a payload that ARRIVES
       unbidden; `Function sends ... to JSON Path` above covers the body that
       LEAVES. Neither covers the answer to a call the app itself made, which
       is where a send receipt comes back -- so a performed predicate could
       state its whole request from facts and had no declared way to record
       what it got. `Function yields Type Expression` (core.md:789) is the
       signature's return type, not a projection, and was the near-miss that
       made this look already modelled.

       ONE ROLE PER ROW, AND THE OTHER ROLES ARE NOT THIS FACT TYPE'S JOB.
       Inbound, ingest.md:58 obliges every Role of the yielded Fact Type to
       appear in the payload, because a webhook is all there is. A response is
       not: the call was made ABOUT something, so the entity role is already
       bound by `main:performed`'s row and only the values the service
       returned come from the body. Mirroring that obligation would demand a
       JSON Path for a role the request already knows.

       AND IT MAY NOT MINT. What a performed predicate is permitted to assert
       is `Event Type can be created by Predicate`, the may-create ceiling,
       which is the Thm 1 boundary. This says WHERE a value is found in the
       answer; it never widens WHAT may be written. -->
Function sends Fact Type with Role to JSON Path.
  Each Function, Fact Type, Role combination occurs at most once.
  It is possible that some Function sends more than one Fact Type.
  It is possible that more than one Function sends the same Fact Type.
  <!-- THE MIRROR OF ingest.md:49, WHICH HAD NO MIRROR. `Webhook Event Type
       yields Fact Type with Role from JSON Path` says how an arriving payload
       becomes facts; nothing said how facts become a LEAVING one, so a request
       body could not be assembled from the model at all and every outbound call
       had to carry its shape in host code.

       THE OBLIGATION IS NOT MIRRORED, deliberately. Inbound, every Role of a
       yielded Fact Type must be fillable or the fact cannot be built, and
       ingest.md makes that obligatory. Outbound the opposite is normal: a call
       sends ONE role of a fact type and leaves the rest -- `to` is filled from
       the Email Address role of Support Request has Email Address and the
       Support Request role is the subject being sent, not a field. Copying the
       inbound constraint here would refuse every real request body. -->

Object Type has URI.
  Each Object Type has at most one URI.

### Domain Connection
Domain connects to External System.
  Each Domain, External System combination occurs at most once in the population of Domain connects to External System.
DomainConnectsToExternalSystem objectifies "Domain connects to External System".
DomainConnectsToExternalSystem is a subtype of Function.
Send Mode is a value type.
  The possible values of Send Mode are 'dry', 'live'.
DomainConnectsToExternalSystem has Send Mode.
  Each DomainConnectsToExternalSystem has at most one Send Mode.
  <!-- WHETHER BYTES LEAVE WAS THE ONE THING NOT IN THE MODEL. Everything about
       an outbound call is declared -- the External System's URL, the Function's
       callback URI and HTTP Method, the headers and which carries the credential,
       the body's JSON Paths, the may-create ceiling, and now the subject and the
       response projection. The arming was an environment variable, AREST_PERFORM,
       which is a configuration key beside a fact-based configuration system and
       the most consequential decision of the lot (Sam, 2026-09-14).

       IT RIDES THE CONNECTION because that is what is or is not live: the same
       objectified `Domain connects to External System` that carries the Secret
       Reference, and a connection with no credential cannot send anyway. Not the
       Function -- one Function reaches one system, but a store may connect to a
       system it is not yet allowed to call.

       ABSENT MEANS NOT PERFORMED AT ALL, which is the safe default and needs no
       row: 'dry' resolves the call and records what it would send without sending,
       'live' sends. Three states out of two values plus absence, matching what the
       environment variable expressed by being unset, 'dry', or anything else.

       THE MASTER KEY STAYS OUTSIDE and is the only thing that can. It decrypts the
       Secret Reference, so it cannot live in the store it protects; hook:read
       already takes it as an argument rather than reading it. -->
DomainConnectsToExternalSystem carries Secret Reference.
  Each DomainConnectsToExternalSystem carries at most one Secret Reference.
  <!-- one-table wave (2026-07-16): Halpin's nesting transformation of the
       former `Domain connects to External System with Secret Reference`
       (compound key Domain+ExternalSystem): the connection objectifies —
       this is the "Domain Connection" the connectors note anticipated —
       and the per-connection secret rides functionally. -->

### Derivation Rule

Derivation Rule is an entity type.
Derivation Rule has Text.
  Each Derivation Rule has exactly one Text.
Derivation Rule is provided by Constraint.
  Each Derivation Rule is provided by at most one Constraint.
  For each Constraint, at most one Derivation Rule is provided by that Constraint.
  <!-- exec ruling (2026-07-15, commit 3f76bcda): the derivation a
       materializing constraint supplies. A provided rule carries no
       authored Text — its content compiles from the providing
       constraint's role sequences. Optional both ways: most rules are
       authored, most constraints only restrict.

       Considered and rejected 2026-08-05: replacing this with `Constraint
       has Derivation Mode`, on the reasoning that the link stores only one
       real bit (whether this constraint materializes) and everything else
       recomputes. The reasoning holds; the replacement does not, because
       the recomputation is not expressible. The ruling names an
       "antecedent sequence" and a "consequent sequence", but the metamodel
       has only `Constraint spans Role` (543) and `Fact Type has Role`
       (529) — nothing distinguishes which of a constraint's spanned roles
       are antecedent and which consequent, and Role Sequence (1126)
       belongs to the derivation-body decomposition and is never linked to
       Constraint. So a rule reached only from its constraint cannot find
       its own head. Retiring this link needs
       `Constraint has antecedent Role Sequence` / `... consequent ...`
       declared first; that is the real gap, and it is why the link exists. -->
Derivation Rule has antecedent Fact Type.
  Each Derivation Rule, Fact Type combination occurs at most once in the population of Derivation Rule has antecedent Fact Type.
DerivationRuleHasAntecedentFactType objectifies "Derivation Rule has antecedent Fact Type".
DerivationRuleHasAntecedentFactType is a subtype of Function.
Derivation Rule produces Fact Type.
  Each Derivation Rule produces exactly one Fact Type.
Derivation Rule depends on Derivation Rule. *
  Each Derivation Rule, Derivation Rule combination occurs at most once in the population of Derivation Rule depends on Derivation Rule.

## Derivation Rules

<!-- sub-tenancy closure (exec ruling 2026-07-16): reachability over
     domain containment, the acyclicity carrier for the tenant tree. -->

* Domain1 reaches Domain2 iff Domain1 is contained in Domain2.

* Domain1 reaches Domain3 iff Domain1 reaches Domain2 and Domain2 reaches Domain3.

* Fact Type has Arity iff Arity is the count of Role where Fact Type has Role.

* Derivation Rule1 depends on Derivation Rule2 iff Derivation Rule1 has antecedent Fact Type and Derivation Rule2 produces that Fact Type.
<!-- arest-audit B: "some other Derivation Rule" dropped from this rule —
     it filtered self-loops out of the dependency graph, so a
     value-introducing self-recursive rule (a 1-cycle Lem 1 must refuse)
     was invisible to the Cor 1 check. Self-dependency is a legitimate,
     recordable edge. -->

* Derivation Rule1 reaches Derivation Rule2 iff Derivation Rule1 depends on Derivation Rule2.

* Derivation Rule1 reaches Derivation Rule3 iff Derivation Rule1 depends on Derivation Rule2 and Derivation Rule2 reaches Derivation Rule3.



Constraint is semantic iff Constraint has modality of Modality Type 'Deontic' and Constraint spans some Role and that Role is played by some Object Type and no Object Type Instance is instance of that Object Type.

* Constraint is machine-decidable iff Constraint is decided by some Predicate and that Predicate is bound.

## Implicit Derivation Rules (#316 / #287c)

<!--
The four derivations below are currently materialised by the
compiler's `compile_derivations` synthesis pass (per-subtype, per-SS,
per-noun-FT, per-binary-pair fan-out). Expressing them as rules in the
metamodel closes the loop: the parser will drive them straight from
these readings once #317 lands anaphora + subscript + metamodel-cell
push; until then the Rust synthesis continues to cover them.
-->

### Subtype inheritance

<!-- arest-audit H2 (10.2, oracle-found prose — this block parsed into
     garbage fact types): Every fact that binds a subtype also binds the
     supertype: if Noun1 is a subtype of Noun2 and a Fact uses an Object Type Instance
     whose Noun is Noun1 for some Role, then that same Object Type Instance is also an
     instance of Noun2. In ORM this IS `Object Type Instance is instance of Noun` —
     subtyping is population inclusion (Halpin, "Subtyping Revisited"), so
     instance-of is transitive and the runtime mirror is deliberately
     over-broad to carry it. Inheritance proper is PROPERTY reuse, not a
     distinct membership relation. -->

<!-- RETIRED 2026-07-09 (challenged + NORMA-verified): `Object Type Instance is
     inherited instance of Noun` was a non-canonical relation — ORM has
     no separate "inherited membership", and it only existed to prop up
     the (also non-canonical, now relaxed) `instance of exactly one
     Noun`. It had ZERO readers in base or apps (grep: only its own
     declaration), so retiring it removes dead derived data.
* Object Type Instance is inherited instance of Noun iff Object Type Instance is instance of some subtype of that Noun. -->


### Derivations provided by constraints

<!-- exec ruling (2026-07-16), replacing the retired autofill flag and
     the killed host's SS auto-fill pass: a Subset Constraint that is to
     be MATERIALIZED provides a Derivation Rule. The rule needs no
     authored body — its content compiles from the constraint's own role
     sequences (the antecedent sequence is the projection, the consequent
     sequence the head; a joined sequence contributes its join path), so
     the constraint is satisfied by construction wherever it provides.
     This is the constraint-to-restriction compilation of section 5.2 run
     in the derivation direction, and it generalizes: any constraint
     whose satisfaction can be established by producing facts (subset,
     equality) may provide; refusal-only families (uniqueness, exclusion)
     never provide. Evaluator-phase obligation: compile a provided rule
     from its providing constraint's sequences and hold it to the same
     Lem 1 discipline as authored rules. The old SS auto-fill sketch
     ("Fact is in consequent Fact Type iff some Subset Constraint has
     autofill 'true' ...") is superseded by this modeling. -->

Fact is in consequent Fact Type. *
  Each Fact, Fact Type combination occurs at most once in the population of Fact is in consequent Fact Type.

<!-- audit-B re-entry (2026-07-16): the demoted sketch's head, declared
     at last and restated in the provided-by vocabulary (the autofill
     flag it leaned on is retired). The relation records which facts
     feed a provided consequent — provenance before materialization.
     Recipe #37 of rules:metamodel: a joinon chain over is-provided-by /
     produces / has-antecedent, closed through the Fact is of Function
     cast (one id space makes the antecedent Fact Type literally the
     Function the fact is of). -->

* Fact is in consequent Fact Type1 iff some Derivation Rule is provided by some Constraint and that Derivation Rule produces Fact Type1 and that Derivation Rule has antecedent some Fact Type2 and that Fact is of some Function that is that Fact Type2.


### Transitivity of binary Fact Types

<!--
For each pair of binary Fact Types `(A R B, B R C)` where the second
Role of the first FT and the first Role of the second FT share a Noun,
emit inferred `A R C` facts. Compile-time enumerates FT pairs; runtime
derives one fact per join.
-->

Fact joins Fact. *
  Each Fact, Fact combination occurs at most once in the population of Fact joins Fact.
No Fact joins itself.

<!-- audit-B re-entry (2026-07-16): the join sketch's positional prose,
     finally in the fragment. A fact chain-composes with a distinct
     fact when the resource it uses at a position-2 role is the
     resource the other uses at a position-1 role — positions through
     RoleIsUsedInReading has Position, usage through RoleInstance uses
     Object Type Instance. Recipes #38/#39 of rules:metamodel: the flat form
     unfolds both nested attachments (their extensional first columns
     open into components), two cmp mirrors hold the distinctness the
     sketch's "some other Fact" asked for, so the ring is irreflexive
     by construction. The anaphoric RoleInstance / RoleIsUsedInReading
     references bind nearest-antecedent. -->

* Fact1 joins Fact2 iff Fact1 fills some Role1 and that RoleInstance uses some Object Type Instance and that Role1 is used in some Reading1 and that RoleIsUsedInReading has Position 2 and some other Fact2 fills some Role2 and that RoleInstance uses that Object Type Instance and that Role2 is used in some Reading2 and that RoleIsUsedInReading has Position 1.

## Check-Readings Deontic Obligations (#288)

<!--
Layers 2 and 3 of the killed host's readings checker
(crates/arest/src/check.rs) enforced ring-constraint validity and
completeness as Rust control flow. The deontic constraints below are
the readings-side home; the evaluator-phase obligation is to drive
them through the Def 6 / Thm 1 violation path (Theorem 4 in
pre-2026-07-13 draft numbering) so authors see the diagnostics via
the standard violation surface.
-->

### Layer 2: ring validity — same-object type spans

<!-- arest-audit H2 (10.2): A ring constraint (IR, AS, AT, SY, IT, TR,
     AC, RF) must span roles whose Nouns are identical. A ring across mixed
     nouns is nonsensical — "No Customer is-subtype-of Address" has nothing
     to forbid. The killed host's check.rs emitted an Error-level
     diagnostic; the deontic form below is the same invariant spelled
     declaratively, and is the surviving home. -->

It is obligatory that each Ring Constraint spans two Roles and both Roles are played by the same Object Type.

### Layer 3: ring completeness — declare the ring on a same-object type binary

<!-- arest-audit H2 (10.2): A binary Fact Type whose two Roles share the
     same Noun almost always wants an explicit ring constraint — without
     one, nothing prevents the self-reference cycle the schema is
     implicitly modelling. check.rs emits a Hint-level diagnostic pointing
     at the missing "is acyclic." / "is irreflexive." annotation. -->

It is obligatory that each binary Fact Type whose Roles are played by the same Object Type has some Ring Constraint spanning it.

## NORMA Structural Decomposition (#279)

<!--
The concepts below mirror NORMA's `ORMCoreMetaModel.orm`
decomposition of derivation rule bodies. They are the FORML 2
surface that the meta-circular parser (#280) populates by
decomposing each user-authored rule into a `Join Path` +
`Role Sequence` + `Role Projection`, rather than classifying the
rule text with Rust heuristics.
-->

<!-- arest-audit H2 (10.2):
Backus §11.2.4 / Def 7 correspondence (Table 1 of pre-2026-07-13 drafts):
  Join Path       ↔ Composition (COMP)
  Role Sequence   ↔ Construction (CONS)
  Role Projection ↔ Selector
  Join Type       ↔ Condition (COND)
-->

### Entity types

Join Path is an entity type.
Join Path is a subtype of Function.
Join is an entity type.
Join is a subtype of Function.
Role Sequence is an entity type.
Role Sequence is a subtype of Function.
Role Projection is an entity type.
Role Projection is a subtype of Function.
Join Type is an entity type.
Join Type is a subtype of Function.

### Value types

Clusivity is a value type.
  The possible values of Clusivity are 'inclusive', 'exclusive'.
  The data type of Clusivity is text.

Derivation Storage Type is a value type.
  The possible values of Derivation Storage Type are 'stored', 'derived', 'derived-and-stored'.
  The data type of Derivation Storage Type is text.

Assimilation Absorption Choice is a value type.
  The possible values of Assimilation Absorption Choice are 'Absorb', 'Partition', 'Separate'.
  The data type of Assimilation Absorption Choice is text.
<!-- NORMA'S OWN NAMES AND NORMA'S OWN THREE LITERALS, verbatim from
     RelationalModel/OialDcilBridge/OialDcilBridge.dsl:398 -- Absorb pulls all
     assimilations into the supertype's table, Partition gives each subtype its
     own table with the supertype's data duplicated, Separate gives each
     subtype its own table with the supertype's data in a separate referenced
     table. The literals keep NORMA's capitalisation because they are NORMA's
     enumeration and not a spelling of ours. -->

### Fact types

Derivation Rule has Join Path.
  Each Derivation Rule has at most one Join Path.

Join Path has Join.
  Each Join Path has some Join.
  For each Join, exactly one Join Path has that Join.

Join uses Fact Type.
  Each Join uses exactly one Fact Type.

Join has Join Type.
  Each Join has exactly one Join Type.

Join has Role Sequence.
  Each Join, Role Sequence combination occurs at most once in the population of Join has Role Sequence.
  Each Join has some Role Sequence.
JoinHasRoleSequence objectifies "Join has Role Sequence".
JoinHasRoleSequence is a subtype of Function.

Role Sequence has Position.
  Each Role Sequence, Position combination occurs at most once in the population of Role Sequence has Position.
RoleSequenceHasPosition objectifies "Role Sequence has Position".
RoleSequenceHasPosition is a subtype of Function.
RoleSequenceHasPosition holds Role.
  Each RoleSequenceHasPosition holds at most one Role.
  <!-- one-table wave (2026-07-16): Halpin's nesting transformation of the
       former `Role Sequence has Role at Position` (compound key
       RoleSequence+Position): the slot pair objectifies, the role it holds
       rides functionally, and the compound-key ternary leaves the schema. -->

Role Projection is from Role Sequence.
  Each Role Projection is from exactly one Role Sequence.

Role Projection produces Role.
  Each Role Projection produces exactly one Role.

Derivation Rule has Role Projection.
  Each Derivation Rule, Role Projection combination occurs at most once in the population of Derivation Rule has Role Projection.
  Each Derivation Rule has some Role Projection.
DerivationRuleHasRoleProjection objectifies "Derivation Rule has Role Projection".
DerivationRuleHasRoleProjection is a subtype of Function.

Fact Type has Derivation Storage Type.
  Each Fact Type has at most one Derivation Storage Type.

Fact Type has Assimilation Absorption Choice.
  Each Fact Type has at most one Assimilation Absorption Choice.
<!-- WHY THE CHOICE HANGS ON A FACT TYPE AND NOT AN OBJECT TYPE. NORMA carries
     it as AssimilationMapping.AbsorptionChoice, joined to its fact type by
     AssimilationMappingCustomizesFactType at ZeroOne (OialDcilBridge.dsl:57,
     :147), so the customised thing is the SUBTYPING, not the subtype: `Customer
     is a subtype of User` and `Customer is a subtype of Party` can be answered
     differently. The AssimilationMapping class hosts no other role, so Halpin's
     own preference for the unnested schema applies and this is the plain
     binary rather than an objectification of it.

     ABSENCE IS NOT 'Absorb'. GetDefaultAbsorptionChoice (AssimilationMapping.cs
     :429) answers Absorb for a subtype fact or an objectification-implied fact
     type and Separate for anything else, so a fact type with no row here takes
     the structural default and a row OVERRIDES it. That is why this is `at most
     one` and not mandatory: writing Absorb on every subtyping would say nothing
     and cost a row per subtyping.

     MEASURED BEFORE IT EXISTED (2026-09-10, recorded in the probe
     body-leg-on-a-derived-cell): under the default, support.auto.dev's 141
     declared subtypings all absorb, so User, Event, Citation, State Machine,
     Guard Run, Fact, Object Type Instance and Customer have no table of their
     own and Subscription, which has no supertype, does. Sam: "Absorbtion should
     be configurable, same as in NORMA." -->

## Negation

<!--
There are TWO negations here, and conflating them is what left the model
with none. NORMA carries both, and the paper names both.

(1) PATH NEGATION — inference from absence. NORMA holds it as a boolean at
    three positions in a role path, declared as DomainProperty entries in
    ORMCore.dsl:
      LeadRolePath.IsNegated   "Indicates a negated path root."
      PathedRole.IsNegated     "Indicates that this step in the path is
                                negated."
      RolePath.SplitIsNegated  "Indicates if the tail split in its entirety
                                should be treated as a negation."
    The paper names the same three: negation is admitted "inside derivation
    role paths, where a step, a root, or a branch may be negated."

    Negation is ORTHOGONAL to join flavour — NORMA has no 'anti' join kind.
    That is why `Join Type 'anti'` is retired (see Join Types under Instance
    Facts): an anti-join is how a negated step EVALUATES, not what it is
    ("a negated role path ... evaluates as a finite anti-join against a
    completed lower stratum"). Carrying both gave two ways to say "negated
    step" and made negation exclusive with inner/outer, which it is not.
    The step flag sits on `Join` because that is where `Join Type` sat, so
    the granularity is unchanged — only the axis is.

    BRANCH NEGATION IS NOT MODELLED. SplitIsNegated negates a tail split,
    and this decomposition has no split: `Join Path has Join` is a flat list
    with no branch structure. The gap is structural and pre-dates negation —
    a split entity has to come first — so it is recorded rather than faked.

(2) EXPLICIT NEGATION — epistemic falsity, never inferred from absence:
    "An epistemic falsity, verbalized 'it is known to be false that,' enters
    P as an explicit negation fact." Definition 2 puts it in the SCHEMA, not
    the evaluator: the fact domain F "includes the paired explicit-negation
    type of each negatable fact type." So negatability is not a flag — a
    Fact Type is negatable exactly when it has a pair.

    The three-valued reading follows from the pairing instead of being
    stored: a ground fact is true if it is in P, false if its pair is in P,
    unknown otherwise, and under the closed-world assumption on a noun
    unknown collapses to false. That is a reading of the CANDIDATE fact
    space, not a property of a Fact — every Fact in P is trivially true — so
    no `Fact has Truth Value` is declared.

    Def 2's consistency condition ("excludes a ground fact and its pair from
    occurring together") compares two facts tuple-wise: the same filler in
    each corresponding role. `Fact fills Role` and `RoleInstance uses Object
    Type Instance` supply the parts, but FORML 2 has no quantifier over
    corresponding roles, so the condition is NOT written here as an
    obligation against vocabulary that cannot carry it — the same
    adjudication validation.md made for Subtype Constraint Declaration. The
    evaluator enforces it; the schema owns the pairing below.

The verbalization sign axis ("it is not true that" / "it is known to be
false that" / "it is not known to be false that") is a third thing again,
and it is already modelled: validation.md's Constraint Invertibility carries
NORMA's positive/negative form pairing.
-->

Join Path is negated.

Join is negated.

Explicit Negation Fact Type is a subtype of Fact Type.

Explicit Negation Fact Type negates Fact Type.
  Each Explicit Negation Fact Type negates exactly one Fact Type.
  For each Fact Type, at most one Explicit Negation Fact Type negates that Fact Type.

<!-- NO ¬¬ PROHIBITION IS DECLARED, and the omission is deliberate.
     A sentence forbidding an Explicit Negation Fact Type from negating an
     Explicit Negation Fact Type was drafted here and withdrawn on three
     counts. It is unsourced: neither Def 2 nor NORMA forbids it. It is
     probably FALSE under the very reading this section adopts — double
     negation does not eliminate in a three-valued open-world logic, so
     "it is known to be false that it is known to be false that P" is not P,
     and a modeller may have cause to say it. And it mis-modelled: the
     compiler mints a fact type per deontic body, so the sentence produced
     `an_Explicit_Negation_Fact_Type_negates_an_Explicit_Negation_Fact_Type`
     — a SECOND predicate for what `negates` already says, and the only
     article-prefixed same-object-type binary in M, which then owes a ring
     constraint under Layer 3 above.
     The 1:1 pairing above already carries what "paired" means. Recorded so
     the prohibition is not re-derived and re-added. -->

## Antecedent Clause Shape (#281)

<!--
Every clause inside a derivation-rule antecedent should parse into a
recognised `Clause Shape`. If the compiler can't attach a shape (the
clause didn't match any known pattern — Fact-Type literal, Antecedent
Role bind, Negation, Comparison, …) the rule is unsafe to chain and
the validator surfaces the violation. Expressing this as a deontic
constraint lets the runtime emit the diagnostic through the Def 6 /
Thm 1 violation path rather than a hard-coded check pass.
-->

Antecedent Clause is an entity type.
Antecedent Clause is a subtype of Function.
Clause Shape is a value type.
  The possible values of Clause Shape are 'fact-type-literal', 'antecedent-role', 'negation', 'comparison', 'conjunction', 'quantified', 'unresolved'.
  The data type of Clause Shape is text.

Derivation Rule has Antecedent Clause.
  Each Derivation Rule has some Antecedent Clause.
  For each Antecedent Clause, exactly one Derivation Rule has that Antecedent Clause.

Antecedent Clause has Clause Shape.
  Each Antecedent Clause has at most one Clause Shape.

It is obligatory that each Antecedent Clause has some Clause Shape.

<!-- audit-fix C: the stray naming deontic that stood here ("It is
     forbidden that each Object Type has a name that ends with 'ies'.")
     is retired: misplaced (Antecedent Clause section), malformed
     (forbidding a universal is satisfied by one counterexample), and
     over-broad (it forbade Series/Species). validation.md's Singular
     Naming rule — plural-form names forbidden — is the one home and
     subsumes the intent. -->

## Migration (#348)

### Rationale
<!-- arest-audit H2 (10.2): Population-level rewriting when a schema
     evolves. Cor 4 (cor:closure) stages migration as derivation rules /
     transition triggers / deontic rules; none is shaped for "rewrite facts
     of one Fact Type into facts of another," so Migration names it
     directly. Firing a rule emits a MigrationApplication (#349);
     visible_population (#350) projects out migrated sources, keeping P
     monotonic. -->

Migration is an entity type.
Migration is a subtype of Function.
Migration Rule Text is a value type.
  The data type of Migration Rule Text is text.

Migration has Fact Type as source.
  Each Migration has exactly one Fact Type as source.

Migration produces Fact Type as target.
  Each Migration, Fact Type combination occurs at most once in the population of Migration produces Fact Type as target.
  Each Migration produces some Fact Type as target.
MigrationProducesFactTypeAsTarget objectifies "Migration produces Fact Type as target".
MigrationProducesFactTypeAsTarget is a subtype of Function.

Migration has Migration Rule Text.
  Each Migration has exactly one Migration Rule Text.

Migration has Timestamp.
  Each Migration has exactly one Timestamp.

It is obligatory that each Migration produces some Fact Type as target.

## Migration Application (#349)

### Rationale
<!-- arest-audit H2 (10.2): Migration firing emits a Migration
     Application per source fact touched, recording which target facts were
     produced and when. Prop 3 (prop:derive; Theorem 5 in pre-2026-07-13
     drafts) holds because Migration Application is itself a fact: the
     visible_population projection (#350) reads it to filter out migrated
     sources without a destructive write, so population monotonicity is
     preserved and Cor 4 (cor:closure) survives. -->

Migration Application is an entity type.
Migration Application is a subtype of Object Type Instance.

Migration Application has Migration.
  Each Migration Application has exactly one Migration.

Migration Application has Fact as source.
  Each Migration Application has exactly one Fact as source.

Migration Application produces Fact.
  Each Migration Application, Fact combination occurs at most once in the population of Migration Application produces Fact.
  Each Migration Application produces some Fact.
  It is possible that some Migration Application produces more than one Fact.
MigrationApplicationProducesFact objectifies "Migration Application produces Fact".
MigrationApplicationProducesFact is a subtype of Function.

Migration Application has Timestamp.
  Each Migration Application has exactly one Timestamp.

## Migration Application ordering (#351)

<!--
### Rationale
Two deontics compose migration chains and make federation convergence
constructive. The at-most-one obligation rules out direct v1 → v3
shortcuts: competing MAs for the same source row would flag, forcing
the chain through v2 via a paired Migration + MA. The distinct-Timestamp
obligation is what lets two peers replay the same Migration + MA stream
and converge by the §3 consensus paragraph (Cor. consensus in
pre-2026-07-13 drafts) — timestamps establish the total order the
replay needs, and visible_population is a function of the replayed
set, so partial replays up to any T agree across peers.
-->

It is obligatory that for each Fact and Fact Type, at most one Migration Application has that Fact as source and has some Migration that produces that Fact Type as target.
  <!-- chained-leg external uniqueness (2026-07-17): the "per target Fact
       Type" prose becomes the canonical for-each form, with the
       role-qualified legs in the fluent as-form per Samuel's wording
       ("has that Fact as source", not "has source that Fact"); the
       parser relocates the postfix qualifier onto the prefix-style
       reading (has source Fact). The second leg walks has-Migration
       then produces-target, and the constraint builds as a real deontic
       UniquenessConstraint whose join path is the chain tree (root
       Migration Application, the Fact and Fact Type steps projected).
       The at-most-one obligation rules out direct v1 -> v3 shortcuts
       per the ordering rationale above. -->

It is obligatory that for each Timestamp, at most one Migration Application has that Timestamp.

## NORMA Value Domain (#279)

### Entity types

Bound is an entity type.
Bound is a subtype of Function.
Value Range is an entity type.
Value Range is a subtype of Function.
Facet is an entity type.
Facet is a subtype of Function.
<!-- arest-batch ruling 3a (NORMA-correct): the reified Value entity is
     retired — NORMA's ValueRange carries MinValue/MaxValue lexically and
     has no Value instance entity. Bounds carry Lexical Value directly.
Value(.id) is an entity type. -->
Unit is an entity type.
Unit is a subtype of Function.
Dimension is an entity type.
Dimension is a subtype of Function.
Conceptual Data Type is an entity type.
Conceptual Data Type is a subtype of Function.
Data Type Group is an entity type.
Data Type Group is a subtype of Function.
Format is an entity type.
Format is a subtype of Function.
Textual Constraint is a subtype of Constraint.

### Value types

Regex Pattern is a value type.
  The data type of Regex Pattern is text.
Lexical Value is a value type.
  The data type of Lexical Value is text.
Alias is a value type.
  The data type of Alias is text.
Length is a value type.
  The data type of Length is integer.
Binary Precision is a value type.
  The data type of Binary Precision is integer.
Digit Count is a value type.
  The data type of Digit Count is integer.
Precision is a value type.
  The data type of Precision is integer.
Scale is a value type.
  The data type of Scale is integer.
JSON Type is a value type.
  The data type of JSON Type is text.
JSON Format is a value type.
  The data type of JSON Format is text.
Abstract SQL Type is a value type.
  The data type of Abstract SQL Type is text.

### Fact types

Value Range has lower Bound.
  Each Value Range has at most one lower Bound.

Value Range has upper Bound.
  Each Value Range has at most one upper Bound.

Bound has Lexical Value.
  Each Bound has exactly one Lexical Value.

Bound has Clusivity.
  Each Bound has exactly one Clusivity.

Object Type has Value Range.
  Each Object Type, Value Range combination occurs at most once in the population of Object Type has Value Range.
  It is possible that more than one Object Type has the same Value Range.
ObjectTypeHasValueRange objectifies "Object Type has Value Range".
ObjectTypeHasValueRange is a subtype of Function.

Object Type has Facet.
  Each Object Type, Facet combination occurs at most once in the population of Object Type has Facet.
  It is possible that more than one Object Type has the same Facet.
ObjectTypeHasFacet objectifies "Object Type has Facet".
ObjectTypeHasFacet is a subtype of Function.

Facet has Length.
  Each Facet has at most one Length.

Facet has Binary Precision.
  Each Facet has at most one Binary Precision.

Facet has Digit Count.
  Each Facet has at most one Digit Count.

Facet has Regex Pattern.
  Each Facet has at most one Regex Pattern.

Unit has Dimension.
  Each Unit has exactly one Dimension.

Object Type is measured in Unit.
  Each Object Type is measured in at most one Unit.

Textual Constraint has Text.
  Each Textual Constraint has exactly one Text.

Object Type has Alias.
  Each Object Type, Alias combination occurs at most once in the population of Object Type has Alias.
  It is possible that more than one Object Type has the same Alias.
ObjectTypeHasAlias objectifies "Object Type has Alias".
ObjectTypeHasAlias is a subtype of Function.

Fact Type has Alias.
  Each Fact Type, Alias combination occurs at most once in the population of Fact Type has Alias.
  It is possible that more than one Fact Type has the same Alias.
FactTypeHasAlias objectifies "Fact Type has Alias".
FactTypeHasAlias is a subtype of Function.

<!-- `Data Type Group has Name. / Each Data Type Group has exactly one Name.`
     is RETIRED (2026-09-01, Samuel: "do the retire"). It could never be
     populated. Data Type Group is Function-rooted, so a `has Name` sentence
     routes to the ROOT's fact type, and the eight group names are already in
     FunctionHasName — ["logical","Logical"], ["numeric","Numeric"],
     ["raw","Raw"] and the rest. Two fact types for one predicate, and the
     parser only ever reaches one of them.

     IT WAS INVISIBLE UNTIL A MANDATORY COULD BE CHECKED (f47c0d81). `exactly
     one Name` over 8 Data Type Groups against 0 rows reported 8 violations,
     which read as missing data and were nothing of the kind: the data was
     one fact type over. Retiring the reading removes the constraint that
     could not be satisfied and loses no information, because Function has
     Name already holds all of it. -->
Conceptual Data Type is in Data Type Group.
  Each Conceptual Data Type is in exactly one Data Type Group.

Object Type has Conceptual Data Type.
  Each Object Type has at most one Conceptual Data Type.

Object Type has Precision.
  Each Object Type has at most one Precision.

Object Type has Scale.
  Each Object Type has at most one Scale.

<!-- A VALUE TYPE DECLARES THE FUNCTION IT IS STORED THROUGH, and encryption is
     one instance of that rather than the mechanism itself. Samuel, 2026-09-12:
     `'filter' I guess was me being colorful about the projection done by the
     hook. Let's get the generic in place and replace the previous encryption
     reading with wiring up the generic.` The Function runs on the way to
     STORAGE; `Function is inverted by Function` gives the way back; a type
     whose Function declares no inverse reads as itself, which is how a ONE-WAY
     store -- hashing, redaction, normalisation -- falls out with no second fact
     type. NOT named a projection: Role Projection is already a distinct concept
     here, and a second meaning for one word is the collision `has HTTP Method`
     just cost us.

     ORIGINALLY WRITTEN AS ENCRYPTION (Samuel, 2026-09-11: .env should
     read as encrypted fields, and it is the value type for whatever the secret
     is that declares it as using an encrypt/decrypt function). This is the
     Connector move one level down — federation.md's note that a Fetcher and a
     Translator "are DEFINITION NAMES resolved by rho at fetch time, so swapping
     an implementation is a data edit". A value type that names its cipher is
     ciphertext at rest everywhere it is carried, without a single consumer
     knowing, and swapping AES for a KMS handle is an instance fact.

     ONE END, AND THE PAIR LIVES ON THE FUNCTIONS. Only the encryption is
     named here, because a second link on the Object Type could name an encrypt
     and a decrypt that are not each other's inverse and nothing would catch it.
     The first version of this comment claimed the decrypt needed no declaring
     at all, being the Function whose accepts-type is what the encrypt yields;
     that was measured false the same day (crypt:encrypt yields 'ciphertext',
     crypt:decrypt accepts 'key-and-ciphertext', and no Function accepts
     'ciphertext'), so `Function is inverted by Function` carries the pair --
     one fact, on the two definitions it is actually about.

     The key is NOT here and must not be: a key in the store defeats the store
     being encrypted. AREST.tex puts it outside — "external identity,
     authorization, and transport controls remain deployment concerns" — so one
     key reaches the host from its deployment and every other secret is a fact. -->
Object Type is stored through Function.
  Each Object Type is stored through at most one Function.
  It is possible that more than one Object Type is stored through the same Function.

Conceptual Data Type has JSON Type.
  Each Conceptual Data Type has exactly one JSON Type.

Conceptual Data Type has JSON Format.
  Each Conceptual Data Type has at most one JSON Format.

Conceptual Data Type has Abstract SQL Type.
  Each Conceptual Data Type has exactly one Abstract SQL Type.

Format is built on Conceptual Data Type.
  Each Format is built on exactly one Conceptual Data Type.
  <!-- Format-on-Conceptual-Data-Type (Phase 1). A `Format` is a
       first-class, extensible REFINEMENT layered ON TOP of exactly one
       base Conceptual Data Type. The base CDT supplies the portable
       skeleton — JSON Type, the base JSON Format, and the Abstract SQL
       Type; the Format refines the *presentation* (a narrower JSON
       Format and an optional validation Pattern) without re-deriving the
       skeleton. The legacy widget Formats ('text', 'date', 'boolean',
       'enum') are seeded below as Format instances built on the matching
       CDT leaf. -->

Format has JSON Format.
  Each Format has at most one JSON Format.
  <!-- The Format's own JSON-Schema `format` keyword, REFINING the base
       CDT's JSON Format (`Conceptual Data Type has JSON Format` above).
       Effective JSON Format of a value type = its Format's JSON Format
       when it declares a Format, ELSE its base CDT's JSON Format. -->

Format has Pattern.
  Each Format has at most one Pattern.
  <!-- Optional regex `pattern` keyword for the Format (reuses the core
       `Pattern` value type at :67). Surfaces in the derived JSON Schema
       as `pattern`; absent when the Format imposes no lexical shape. -->

## Instance Facts

### Ciphers

<!-- The one value type that is ciphertext at rest. A DomainConnectsToExternal
     System carries at most one Secret Reference (:1225); with this fact the
     value it carries is encrypted.

     THE FIRST VERSION OF THIS COMMENT DREW THE WRONG CONCLUSION, and it is
     corrected here rather than quietly replaced, because it told a future
     reader to do the unsafe thing. It said the point of encrypting was "so the
     connection facts can live in a readings file the oracle reads and in git
     instead of a gitignored .env that no store ever sees" -- that is, move the
     secrets into a COMMITTED .md once they were ciphertext. Samuel overruled
     that the same day (2026-09-12): ".env contains compile-time plaintext
     secrets. They are never put in a .md. .env in arest contains atomic fact
     instance readings itself. The fact types are in the .md and specify whether
     the field is encrypted." support.auto.dev's .gitignore records the reversal
     in its own words ("NO SECRETS .md IS PLANNED OR WANTED").

     SO THE FIX WENT THE OTHER WAY: the oracle reads .env, which is what Samuel
     asked for on 2026-09-14 -- ".env should be read into the system to make it
     all work in the live db. .env is compile-time, and a db must be portable to
     another environment."

     MEASURED on support.auto.dev, 2026-09-14, both sides of that change. Its
     .env was already FORML -- `Domain ...` and `DomainConnectsToExternalSystem
     ...` sentences, not shell assignments -- but sat in no readings directory,
     so DomainConnectsToExternalSystem answered 0 ROWS while `Domain Connects To
     External System has Send Mode`, which rides that same objectification and
     lives in a .md, had its one row. The sentences were written; nothing could
     ever see them. The cost was not theoretical: perform:conn_of could not
     build the 'domain/system' key, so a correctly declared and correctly armed
     performer refused every send with "this connection declares no Send Mode".
     Reading .env took the same corpus to 6 connections, 6 Secret References,
     conn_of 'support/resend' and send_mode_of 'dry', NORMA model errors (none).

     WHERE THE CIPHER APPLIES, since "stored through" names a moment and not a
     file. Plaintext exists at COMPILE time -- in .env and in the carriers the
     oracle writes, both gitignored, both on the machine that compiles. The
     value that reaches the STORE is what hook:write made of it, so the db
     carries ciphertext and travels while the key does not travel in it. -->
Object Type 'Secret Reference' is stored through Function 'crypt:encrypt'.

### Constraint Types

Constraint Type 'UC' has Name 'Uniqueness'.
Constraint Type 'MC' has Name 'Mandatory'.
Constraint Type 'FC' has Name 'Frequency'.
Constraint Type 'SS' has Name 'Subset'.
Constraint Type 'EQ' has Name 'Equality'.
Constraint Type 'XC' has Name 'Exclusion'.
Constraint Type 'OR' has Name 'InclusiveOr'.
Constraint Type 'XO' has Name 'ExclusiveOr'.
Constraint Type 'IR' has Name 'Irreflexive'.
Constraint Type 'AS' has Name 'Asymmetric'.
Constraint Type 'AT' has Name 'Antisymmetric'.
Constraint Type 'SY' has Name 'Symmetric'.
Constraint Type 'IT' has Name 'Intransitive'.
Constraint Type 'TR' has Name 'Transitive'.
Constraint Type 'AC' has Name 'Acyclic'.
Constraint Type 'VC' has Name 'ValueComparison'.

### Conceptual Data Types (#279)

<!-- arest-audit H2 (10.2): NORMA's portable data-type catalog. Each leaf
     Conceptual Data Type is classified into exactly one of eight Data Type
     Groups. The "is in" facts below are the single source of truth for the
     leaf codes and group membership. A value type opts into a data type
     with "The data type of <ValueType> is <code>." which absorbs
     conceptualDataType onto the Noun cell. The declaration may carry NORMA
     facets in a trailing clause (#279 P4): "The data type of Price is
     decimal with precision 10 and scale 2." These absorb onto the Noun
     cell as precision / scale / maxLength and parameterize the projected
     DDL: DECIMAL(precision, scale), CHARACTER VARYING(length). The Facet
     entity models per-instance facet rows for a future supertype / units
     pass, independent of the absorbed Noun fields. -->

Data Type Group 'text' has Name 'Text'.
Data Type Group 'numeric' has Name 'Numeric'.
Data Type Group 'temporal' has Name 'Temporal'.
Data Type Group 'logical' has Name 'Logical'.
Data Type Group 'raw' has Name 'Raw'.
Data Type Group 'other' has Name 'Other'.
Data Type Group 'unspecified' has Name 'Unspecified'.
Data Type Group 'userDefined' has Name 'User Defined'.

<!-- THE ONE FORMAT THIS MODEL USES, and it had no base. `Each Format is
     built on exactly one Conceptual Data Type` was the last genuinely
     missing instance fact in the metamodel: Format 'text' exists, from the
     single `Object Type has Format` row, and nothing said which base it
     refines. Samuel, 2026-09-01: "Formats should map directly to json
     schema, so text is varchar-like" -- and varchar-like is the CDT named
     `text` in the catalog below, distinct from fixedText (CHARACTER) and
     largeText (CHARACTER LARGE OBJECT). A Format is a refinement layered on
     exactly one base; this names the base. -->
Format 'text' is built on Conceptual Data Type 'text'.

Conceptual Data Type 'text' is in Data Type Group 'text'.
Conceptual Data Type 'fixedText' is in Data Type Group 'text'.
Conceptual Data Type 'largeText' is in Data Type Group 'text'.
Conceptual Data Type 'smallInteger' is in Data Type Group 'numeric'.
Conceptual Data Type 'integer' is in Data Type Group 'numeric'.
Conceptual Data Type 'largeInteger' is in Data Type Group 'numeric'.
Conceptual Data Type 'unsignedTiny' is in Data Type Group 'numeric'.
Conceptual Data Type 'unsignedSmall' is in Data Type Group 'numeric'.
Conceptual Data Type 'unsigned' is in Data Type Group 'numeric'.
Conceptual Data Type 'unsignedLarge' is in Data Type Group 'numeric'.
Conceptual Data Type 'autoCounter' is in Data Type Group 'numeric'.
Conceptual Data Type 'singleFloat' is in Data Type Group 'numeric'.
Conceptual Data Type 'doubleFloat' is in Data Type Group 'numeric'.
Conceptual Data Type 'decimal' is in Data Type Group 'numeric'.
Conceptual Data Type 'money' is in Data Type Group 'numeric'.
Conceptual Data Type 'uuid' is in Data Type Group 'numeric'.
Conceptual Data Type 'date' is in Data Type Group 'temporal'.
Conceptual Data Type 'time' is in Data Type Group 'temporal'.
Conceptual Data Type 'dateTime' is in Data Type Group 'temporal'.
Conceptual Data Type 'autoTimestamp' is in Data Type Group 'temporal'.
Conceptual Data Type 'boolean' is in Data Type Group 'logical'.
Conceptual Data Type 'yesNo' is in Data Type Group 'logical'.
Conceptual Data Type 'fixedRaw' is in Data Type Group 'raw'.
Conceptual Data Type 'raw' is in Data Type Group 'raw'.
Conceptual Data Type 'largeRaw' is in Data Type Group 'raw'.
Conceptual Data Type 'picture' is in Data Type Group 'raw'.
Conceptual Data Type 'oleObject' is in Data Type Group 'raw'.
Conceptual Data Type 'rowId' is in Data Type Group 'other'.
Conceptual Data Type 'objectId' is in Data Type Group 'other'.
Conceptual Data Type 'unspecified' is in Data Type Group 'unspecified'.
Conceptual Data Type 'userDefined' is in Data Type Group 'userDefined'.

<!-- arest-audit H2 (10.2): JSON-Schema projection of the catalog
     (#279 P2a). Each leaf carries one JSON Type and, for temporal / binary
     / uuid leaves, a JSON Format; these absorb jsonType / jsonFormat onto
     the Conceptual Data Type cell via RMAP, the same way
     conceptualDataType absorbs onto Noun. The generator's
     JsonTypeMappingTable reads them back; its boot fallback mirrors this
     block one-for-one. -->

Conceptual Data Type 'text' has JSON Type 'string'.
Conceptual Data Type 'fixedText' has JSON Type 'string'.
Conceptual Data Type 'largeText' has JSON Type 'string'.
Conceptual Data Type 'smallInteger' has JSON Type 'integer'.
Conceptual Data Type 'integer' has JSON Type 'integer'.
Conceptual Data Type 'largeInteger' has JSON Type 'integer'.
Conceptual Data Type 'unsignedTiny' has JSON Type 'integer'.
Conceptual Data Type 'unsignedSmall' has JSON Type 'integer'.
Conceptual Data Type 'unsigned' has JSON Type 'integer'.
Conceptual Data Type 'unsignedLarge' has JSON Type 'integer'.
Conceptual Data Type 'autoCounter' has JSON Type 'integer'.
Conceptual Data Type 'singleFloat' has JSON Type 'number'.
Conceptual Data Type 'doubleFloat' has JSON Type 'number'.
Conceptual Data Type 'decimal' has JSON Type 'number'.
Conceptual Data Type 'money' has JSON Type 'number'.
Conceptual Data Type 'uuid' has JSON Type 'string'.
Conceptual Data Type 'date' has JSON Type 'string'.
Conceptual Data Type 'time' has JSON Type 'string'.
Conceptual Data Type 'dateTime' has JSON Type 'string'.
Conceptual Data Type 'autoTimestamp' has JSON Type 'string'.
Conceptual Data Type 'boolean' has JSON Type 'boolean'.
Conceptual Data Type 'yesNo' has JSON Type 'boolean'.
Conceptual Data Type 'fixedRaw' has JSON Type 'string'.
Conceptual Data Type 'raw' has JSON Type 'string'.
Conceptual Data Type 'largeRaw' has JSON Type 'string'.
Conceptual Data Type 'picture' has JSON Type 'string'.
Conceptual Data Type 'oleObject' has JSON Type 'string'.
Conceptual Data Type 'rowId' has JSON Type 'integer'.
Conceptual Data Type 'objectId' has JSON Type 'integer'.
Conceptual Data Type 'unspecified' has JSON Type 'string'.
Conceptual Data Type 'userDefined' has JSON Type 'string'.

Conceptual Data Type 'uuid' has JSON Format 'uuid'.
Conceptual Data Type 'date' has JSON Format 'date'.
Conceptual Data Type 'time' has JSON Format 'time'.
Conceptual Data Type 'dateTime' has JSON Format 'date-time'.
Conceptual Data Type 'autoTimestamp' has JSON Format 'date-time'.
Conceptual Data Type 'fixedRaw' has JSON Format 'byte'.
Conceptual Data Type 'raw' has JSON Format 'byte'.
Conceptual Data Type 'largeRaw' has JSON Format 'byte'.
Conceptual Data Type 'picture' has JSON Format 'byte'.
Conceptual Data Type 'oleObject' has JSON Format 'byte'.

<!--
SQL/DDL projection of the catalog (#279 P2b). NORMA maps a Conceptual
Data Type to SQL in two stages: first to an abstract SQL type (the
DCIL layer — a SQL-standard "predefined type" name), then to the
vendor type per dialect (`readings/templates/sql-dialects.md`). The
Abstract SQL Type facts below are stage one. They absorb `abstractSqlType`
onto the Conceptual Data Type cell via RMAP, the same way `jsonType`
absorbs (P2a) and `conceptualDataType` absorbs onto Noun (P1). The
generator's `AbstractSqlTypeTable` reads them back; its boot fallback
mirrors this block one-for-one.
-->

<!--
Type-mapping only (P2b): the IDENTITY / auto-increment semantics of
autoCounter / autoTimestamp and the unsigned-range CHECK constraints
of the unsigned* leaves are deferred to a later phase — here they map
to the abstract type that holds their VALUES (autoCounter / rowId /
objectId → INTEGER; the unsigned* leaves → the smallest signed
abstract type that fits, i.e. one width up where needed). uuid maps
to the abstract UUID type; dialects without a native UUID fall back to
CHARACTER in the vendor layer.
-->

Conceptual Data Type 'text' has Abstract SQL Type 'CHARACTER VARYING'.
Conceptual Data Type 'fixedText' has Abstract SQL Type 'CHARACTER'.
Conceptual Data Type 'largeText' has Abstract SQL Type 'CHARACTER LARGE OBJECT'.
Conceptual Data Type 'smallInteger' has Abstract SQL Type 'SMALLINT'.
Conceptual Data Type 'integer' has Abstract SQL Type 'INTEGER'.
Conceptual Data Type 'largeInteger' has Abstract SQL Type 'BIGINT'.
Conceptual Data Type 'unsignedTiny' has Abstract SQL Type 'SMALLINT'.
Conceptual Data Type 'unsignedSmall' has Abstract SQL Type 'INTEGER'.
Conceptual Data Type 'unsigned' has Abstract SQL Type 'BIGINT'.
Conceptual Data Type 'unsignedLarge' has Abstract SQL Type 'BIGINT'.
Conceptual Data Type 'autoCounter' has Abstract SQL Type 'INTEGER'.
Conceptual Data Type 'singleFloat' has Abstract SQL Type 'REAL'.
Conceptual Data Type 'doubleFloat' has Abstract SQL Type 'DOUBLE PRECISION'.
Conceptual Data Type 'decimal' has Abstract SQL Type 'DECIMAL'.
Conceptual Data Type 'money' has Abstract SQL Type 'DECIMAL'.
Conceptual Data Type 'uuid' has Abstract SQL Type 'UUID'.
Conceptual Data Type 'date' has Abstract SQL Type 'DATE'.
Conceptual Data Type 'time' has Abstract SQL Type 'TIME'.
Conceptual Data Type 'dateTime' has Abstract SQL Type 'TIMESTAMP'.
Conceptual Data Type 'autoTimestamp' has Abstract SQL Type 'TIMESTAMP'.
Conceptual Data Type 'boolean' has Abstract SQL Type 'BOOLEAN'.
Conceptual Data Type 'yesNo' has Abstract SQL Type 'BOOLEAN'.
Conceptual Data Type 'fixedRaw' has Abstract SQL Type 'BINARY'.
Conceptual Data Type 'raw' has Abstract SQL Type 'BINARY VARYING'.
Conceptual Data Type 'largeRaw' has Abstract SQL Type 'BINARY LARGE OBJECT'.
Conceptual Data Type 'picture' has Abstract SQL Type 'BINARY VARYING'.
Conceptual Data Type 'oleObject' has Abstract SQL Type 'BINARY VARYING'.
Conceptual Data Type 'rowId' has Abstract SQL Type 'INTEGER'.
Conceptual Data Type 'objectId' has Abstract SQL Type 'INTEGER'.
Conceptual Data Type 'unspecified' has Abstract SQL Type 'CHARACTER VARYING'.
Conceptual Data Type 'userDefined' has Abstract SQL Type 'CHARACTER VARYING'.

### Constraint Types (#747)

<!--
Each Constraint Type code below names one alethic constraint dispatch
arm in `compile.rs`. The Family groups codes that share an evaluation
shape (ring, set-comparison, subset/equality, value, frequency,
uniqueness, mandatory) so tooling — OpenAPI, docs, MCP introspection —
can enumerate the inventory from declared facts instead of reading the
Rust match. AT and ANS share the antisymmetric ring kernel; ANS is
preserved as a separate kind so the alias surfaces as a fact.
-->

Constraint Type 'IR' has Constraint Type Label 'Irreflexive Ring'.
Constraint Type 'IR' has Constraint Type Family 'ring'.
Constraint Type 'AS' has Constraint Type Label 'Asymmetric Ring'.
Constraint Type 'AS' has Constraint Type Family 'ring'.
Constraint Type 'SY' has Constraint Type Label 'Symmetric Ring'.
Constraint Type 'SY' has Constraint Type Family 'ring'.
Constraint Type 'AT' has Constraint Type Label 'Antisymmetric Ring'.
Constraint Type 'AT' has Constraint Type Family 'ring'.
Constraint Type 'IT' has Constraint Type Label 'Intransitive Ring'.
Constraint Type 'IT' has Constraint Type Family 'ring'.
Constraint Type 'TR' has Constraint Type Label 'Transitive Ring'.
Constraint Type 'TR' has Constraint Type Family 'ring'.
Constraint Type 'AC' has Constraint Type Label 'Acyclic Ring'.
Constraint Type 'AC' has Constraint Type Family 'ring'.
Constraint Type 'RF' has Constraint Type Label 'Reflexive Ring'.
Constraint Type 'RF' has Constraint Type Family 'ring'.
Constraint Type 'UC' has Constraint Type Label 'Uniqueness'.
Constraint Type 'UC' has Constraint Type Family 'uniqueness'.
Constraint Type 'MC' has Constraint Type Label 'Mandatory'.
Constraint Type 'MC' has Constraint Type Family 'mandatory'.
Constraint Type 'FC' has Constraint Type Label 'Frequency'.
Constraint Type 'FC' has Constraint Type Family 'frequency'.
Constraint Type 'VC' has Constraint Type Label 'Value Comparison'.
Constraint Type 'VC' has Constraint Type Family 'value-comparison'.
<!-- ORMCore separates two things this row said at once (2026-09-10, #107's
     audit): ValueComparisonConstraint is a SetConstraint over a role sequence
     -- `that Order's ship Date is after that Order's order Date`, which the
     oracle builds (Verifier.cs, "value comparison (Codd's inequality theta)")
     -- while ValueConstraint : ORMNamedElement is the allowed values or ranges
     of a value type or role, a different class that is not a constraint over
     roles at all (ORMCore.dsl, ValueComparisonConstraint : SetConstraint;
     ValueConstraint, ValueTypeValueConstraint, RoleValueConstraint). This row
     is NAMED ValueComparison and was LABELLED 'Value', so the constraint-type
     table gave one id two meanings and the comparison had no name of its own.
     ORMCore's ValueConstraint is not missing from AREST: it is carried as
     facts of the object type it restricts -- `Object Type has Enum Values`,
     `Object Type has Value Range` with its Bounds, `Object Type has Facet` --
     which is where the oracle writes it (ApplyValueEnum), so it needs no
     Constraint Type row and has none. -->
Constraint Type 'XO' has Constraint Type Label 'Exclusive Or'.
Constraint Type 'XO' has Constraint Type Family 'set-comparison'.
Constraint Type 'XC' has Constraint Type Label 'Exclusion'.
Constraint Type 'XC' has Constraint Type Family 'set-comparison'.
Constraint Type 'OR' has Constraint Type Label 'Inclusive Or'.
Constraint Type 'OR' has Constraint Type Family 'set-comparison'.
Constraint Type 'SS' has Constraint Type Label 'Subset'.
Constraint Type 'SS' has Constraint Type Family 'subset'.
Constraint Type 'EQ' has Constraint Type Label 'Equality'.
Constraint Type 'EQ' has Constraint Type Family 'equality'.
Constraint Type 'CC' has Name 'Cardinality'.
Constraint Type 'CC' has Constraint Type Label 'Cardinality'.
Constraint Type 'CC' has Constraint Type Family 'cardinality'.

Constraint Type 'DF_pop' has Constraint Type Label 'Deontic Forbidden (population)'.
Constraint Type 'DF_pop' has Constraint Type Family 'deontic'.
Constraint Type 'DF_cwa' has Constraint Type Label 'Deontic Forbidden (closed-world)'.
Constraint Type 'DF_cwa' has Constraint Type Family 'deontic'.
Constraint Type 'DF_owa' has Constraint Type Label 'Deontic Forbidden (open-world)'.
Constraint Type 'DF_owa' has Constraint Type Family 'deontic'.
Constraint Type 'DO_pop' has Constraint Type Label 'Deontic Obligatory (population)'.
Constraint Type 'DO_pop' has Constraint Type Family 'deontic'.
Constraint Type 'DO_obl' has Constraint Type Label 'Deontic Obligatory'.
Constraint Type 'DO_obl' has Constraint Type Family 'deontic'.
Constraint Type 'DO_sender' has Constraint Type Label 'Deontic Obligatory (sender)'.
Constraint Type 'DO_sender' has Constraint Type Family 'deontic'.

### Join Types (NORMA #279)

Join Type 'inner' has Name 'inner'.
Join Type 'outer' has Name 'outer'.
Join Type 'left-outer' has Name 'left-outer'.
Join Type 'right-outer' has Name 'right-outer'.
<!-- 'anti' retired with the Negation section above. NORMA has no 'anti'
     join kind: negation is an orthogonal boolean on the path (IsNegated),
     and the anti-join is how a negated step EVALUATES. Fused into this
     enum it made negation exclusive with inner/outer and gave a second way
     to say what `Join is negated` says. No derivation read this value —
     the machinery is system:compile_rule_neg, which builds the anti-join
     from the negation, not from a join kind. -->


### HTTP Methods

HTTP Method 'GET' has Name 'GET'.
HTTP Method 'POST' has Name 'POST'.
HTTP Method 'PUT' has Name 'PUT'.
HTTP Method 'PATCH' has Name 'PATCH'.
HTTP Method 'DELETE' has Name 'DELETE'.
HTTP Method 'HEAD' has Name 'HEAD'.
HTTP Method 'OPTIONS' has Name 'OPTIONS'.

### External Systems

<!-- External System auth shape instance facts (URL/Header/Prefix/Country Code/Kind) for auth.vin, auto.dev, stripe, github, resend live in apps/connectors/readings/connectors.md, which is what a consuming app composes via ../../connectors/readings. It was written here as arest/readings/templates/connectors.md in seven places across the corpus and in none correctly: a path in a comment cannot fail a check, so it was written once and propagated by copy while everything around it was gated. Per-app Domain Connection facts carrying Secret References live in each consuming app's gitignored .env file, as TWO sentences since the 2026-07-16 one-table wave -- the connection, then the secret on the objectification, identified <Domain>/<ExternalSystem> (support.auto.dev confirmed the spelling by row count, 2026-09-11). -->

<!-- organizations-domain (ruling 2): Domain 'core' has Access 'public'. -->
Domain 'core' has Description 'Extracted from NORMA ORM2 model (design/html/). The canonical FORML 2 metamodel against which every user domain is a subtype binding.'.
