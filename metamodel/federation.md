# Federation — sources, connectors, translators (a standard module)

<!-- The federation system is declared in FORML and dispatched through DEFS (the
whitepaper's platform-binding move: one SYSTEM varies by DEFS, not by logic). A Source
is where facts live; a Connector names HOW to reach and read it — its Fetcher and
Translator are DEFINITION NAMES resolved by rho at fetch time, so swapping an
implementation is re-registering a name (IoC through the store). Any backend —
clickhouse, postgresql, sqlite, cloudflare, mongo, a file — is one more Connector
declaring its two names. -->

<!-- Declared constraints. Without them
     NORMA has to ASSUME a spanning
     uniqueness on each of its four fact types per Def 3 set semantics — which
     models every one of them as many-to-many, the opposite of what the note
     above describes. Modeling is verbalization: a fact type whose constraints
     are not written is not modelled, it is only mentioned.

     Reference modes: no `Source(.Name)` and no `Connector(.Name)`.
     Function(.id) is the ONLY declared reference mode in this metamodel
     (core.md, Halpin 2nd ed §6.7 and §10.4 — a subtype inherits the root's
     primary reference scheme, and a subtype-own scheme is the advanced case
     that mapped as dual-identity bridge columns); every entity type here
     identifies through Function(.id) by being a subtype of Function. -->

## Entity Types

Source is an entity type.
Source is a subtype of Function.

Connector is an entity type.
Connector is a subtype of Object Type Instance.

<!-- A Fetcher is a definition name resolved by rho (the note above), which is
     to say a Function: a fetcher is dispatched by its name, and each fetcher
     has properties of its own (an implementation, proxy-based, isolated). Declared
     a value type, it would meet an app's Fetcher entity as a KIND CONFLICT the
     oracle settles by keeping this file's kind and refusing the app's scheme; the
     real object is an entity, and a model that says value is wrong.
     Translator stays a value type: a translator has no properties of its own. -->
Fetcher is an entity type.
Fetcher is a subtype of Object Type Instance.

## Value Types

Url is a value type.
Translator is a value type.
Query Parameter is a value type.
Parameter Value is a value type.
Condition Value is a value type.
Query Text is a value type.

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

### Reading rows

<!-- A FEDERATION IS A READ, AND WHAT IT READS IS DECLARED. Modeling and
     running the requested federations is the main deliverable. A Connector is a Function, so it
     is addressed as any Function is -- backed by a Federation, called with an HTTP Method
     at its Callback URI, with the system`s headers and the connection`s credential (core.md) --
     and what its answer yields is `Function yields Fact Type with Role from JSON Path`, the
     declaration a webhook payload and a performed call`s receipt already use, read here once per
     ROW with every role taken from its own path. These say what the call carries and how its
     answer pages: its query parameters, where in the answer the rows are, which path says there
     is more, and which query parameter carries the cursor and from which path of the answer --
     one source`s is $.data[-1].id, the last row`s id, another`s $.nextPageToken.
     The cursor is two facts and not one ternary: a Function has one of each, and a ternary unique
     on one role is two binaries that were never elementary together. -->
Function has Query Parameter with Parameter Value.
  Each Function, Query Parameter, Parameter Value combination occurs at most once in the population of Function has Query Parameter with Parameter Value.

Function reads rows at JSON Path.
  Each Function reads rows at at most one JSON Path.

Function pages while JSON Path.
  Each Function pages while at most one JSON Path.

Function pages by Query Parameter.
  Each Function pages by at most one Query Parameter.

Function pages from JSON Path.
  Each Function pages from at most one JSON Path.

<!-- AND A ROW IS READ ONLY WHEN IT SAYS WHAT THE SOURCE MEANS. A hole yields no fact of that
     TYPE, but a subscription that belongs to a deleted customer with no email still yields its
     Plan, so the Customer role a mandatory constraint needs is missing and the whole page is refused. A condition is on the ROW: every one
     a Function declares must hold, or none of the row is read. The path takes the filters a value
     does, so `is present` is the path with |present equal to 'T', and an event Source keeps its
     kind with $.type equal to 'subscription.deleted'. Several conditions are all of them;
     an either-or is two Sources. -->
Function reads rows where JSON Path equals Condition Value.
  Each Function, JSON Path combination occurs at most once in the population of Function reads rows where JSON Path equals Condition Value.

<!-- AND A QUERY IS SENT AS THE BODY. ClickHouse answers SQL posted to its HTTP interface
     and binds a placeholder like {email:String} from the query parameter param_email on the server,
     so the text goes out exactly as written and nothing here fills it: a customer and a window are
     bindings the caller passes, and a cap is a bound LIMIT like any other value. -->
Function sends Query Text.
  Each Function sends at most one Query Text.

<!-- AND A QUERY CAN NAME WHAT THE CALL IS ABOUT, so the
     payload API makes the external federation r/w. A Function's Query Parameters are fixed
     values, which is all a read needs; a write is about one entity, and Payload addresses the
     document it updates by its query, PATCH /api/users?where[email][equals]=<email>. This is the
     mirror of `Function sends Fact Type with Role to JSON Path` (core.md) for the query: the value
     is the subject's, from the role named, and a value that cannot be filled refuses the call. -->
Function sends Fact Type with Role to Query Parameter.
  Each Function, Query Parameter combination occurs at most once in the population of Function sends Fact Type with Role to Query Parameter.

### What came off the line

<!-- A RESPONSE IS RECORDED AS AN INSTANCE, so a response coming off the line can be debugged. The
     recorder is a log provider, registered and resolved, and there is no separate log db: events
     are object instances. Each answer a
     read or a performed call receives is a Response, recorded in the store through the write path by
     the log provider the host registers (log:write, lambda`s store:write). It is not declared a
     subtype of Event: recording an entity is recording a fact, and so an event, its id unboxed to
     its id column, which it gets from the fact inheritance. ITS BODY IS NOT KEPT: it powers the
     facts its Function yields and is gone;
     a log provider may keep bodies elsewhere -- logs.requests in ClickHouse, say -- and the
     store holds none, since a body can carry what the read never declared to take: an auth service
     may answer an admin's read with every user's live API key. -->
Response is an entity type.
Response is a subtype of Object Type Instance.

HTTP Status Code is a value type.

Response answers Function.
  Each Response answers at most one Function.
  Each Response answers some Function.

Response is from Url.
  Each Response is from at most one Url.
  Each Response is from some Url.

Response has HTTP Status Code.
  Each Response has at most one HTTP Status Code.
  Each Response has some HTTP Status Code.

Response occurred at Timestamp.
  Each Response occurred at at most one Timestamp.
  Each Response occurred at some Timestamp.

### An Object Type as its own federated view

<!-- AN OBJECT TYPE IS ITS OWN FEDERATED VIEW. This is a better way
     to populate an object instance from a federated view than a Source per question.
     `Object Type is backed by Federation` and `Object Type has URI`
     (core.md) were declared and read by nothing but the world assumption. With the three below an
     Object Type is the view: it is identified at a JSON Path of each document its URI lists, each
     Fact Type it plays the first role of is federated at a JSON Path of the same document, and its
     system speaks a REST Dialect, which says how that system pages, names one document and answers
     an update. Lambda answers from them what a Source, its Connector and a write Function would have
     declared (fed:ot_*): a sync of the Object Type reads every federated Fact Type of every document,
     a federated unary holds when its field is true, and asserting or retracting a federated fact
     writes it to the document its key names. A path is written without its leading `$.`, as a body's
     is, and may carry a read filter after a bar (`email|lower`); the update writes the field before it. -->
Object Type is identified at JSON Path.
  Each Object Type is identified at at most one JSON Path.

Fact Type is federated at JSON Path.
  Each Fact Type is federated at at most one JSON Path.

<!-- A FIELD READ THROUGH A FILTER IS WRITTEN THROUGH ITS INVERSE, AND THE INVERSE IS THE FIELD'S
     The inverse is defined at the federation level: upper is not
     universally the inverse of lower, just for a particular field. A user's role may be read
     through lower and written through upper; an email read through lower has no inverse, and a
     field read through a filter that declares none is read-only. The pair is held to the values
     the store holds: read(write(v)) is v (fed:ot_roundtrip_bad). A Filter is one of lambda's
     registered value filters (tpl:filter), as a JSON Path's bar names one. -->
Filter is a value type.

Fact Type is written through Filter.
  Each Fact Type is written through at most one Filter.

REST Dialect is a value type.
  The possible values of REST Dialect are 'payload'.

Federation speaks REST Dialect.
  Each Federation speaks at most one REST Dialect.

## Instance Facts

<!-- THE HTTP READ IS A REGISTERED FUNCTION. A Connector that declares no Fetcher reads by
     HTTP, and fed:ot_rd1 answers 'fetch' as the Fetcher of every REST-dialect read. It is
     outside D -- the network -- so its origin is registered (Def 9), and a population it
     fetches enters under the open world (§355). No host need register a
     body named 'fetch' (tools/js-runner/registrations.js has none); the row states what the
     name is, not that a host performs it. -->
Fetcher 'fetch' has Definition Origin 'registered'.

<!-- THE REFLECTION IS A FEDERATION POINTED AT LAMBDA: its schema arms are fetched from lambda
     when the schema changes, and its instance arms are derivations over the store. The schema arms -- the roles, readings,
     primary readings, players and uses, the five constraint arms, the local names, the Domains
     of declaration and the ring texts -- read only the carrier and schema cells, so they are a
     population fetched from lambda: the Connector 'reflection' fetches with the Fetcher
     'reflect:schema', a DEF the compile registers, whose origin is compiled. It is synced in
     the step that changes DEFS (a compile, or the boot of a composed store) and never in a
     write, and what it answers is never compile input (compile:ip_excluded leaves the
     reflected names out of the runtime's facts). The Federation has no URL, and it is
     compiled, so what it backs is closed-world (core.md, `Federation is compiled`). It backs
     the two Object Types whose instances only the reflection introduces: Role, introduced by
     Fact Type has Role, and Reading, by Fact Type has Reading. The instance arms are not
     here: they are derivations over the store. -->
Federation 'lambda' has Kind 'lambda'.
Connector 'reflection' is backed by Federation 'lambda'.
Connector 'reflection' fetches with Fetcher 'reflect:schema'.
Connector 'reflection' translates with Translator 'id'.
Fetcher 'reflect:schema' has Definition Origin 'compiled'.
Object Type 'Role' is backed by Federation 'lambda'.
Object Type 'Reading' is backed by Federation 'lambda'.


<!-- In the organizations vocabulary: Domain 'federation' has Access 'public'. -->
Domain 'federation' has Description 'Sources, connectors and translators as a standard module: a Source is where facts live and a Connector names how to reach and read it, its Fetcher and Translator being definition names resolved through DEFS at fetch time.'.
