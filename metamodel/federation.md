# Federation — sources, connectors, translators (a standard module)

<!-- The federation system is declared in FORML and dispatched through DEFS (the
whitepaper's platform-binding move: one SYSTEM varies by DEFS, not by logic). A Source
is where facts live; a Connector names HOW to reach and read it — its Fetcher and
Translator are DEFINITION NAMES resolved by rho at fetch time, so swapping an
implementation is re-registering a name (IoC through the store). Any backend —
clickhouse, postgresql, sqlite, cloudflare, mongo, a file — is one more Connector
declaring its two names. -->

<!-- Declaration sweep. Without declared constraints
     NORMA has to ASSUME a spanning
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
     source-routing.md says of it. Declared a value type, it
     met auto.dev's Fetcher entity as a KIND CONFLICT the oracle
     settled by keeping this file's kind and refusing the app's scheme; if
     the real object is an entity, a model that says value is wrong.
     Translator stays a value type: src.do has no translators to consult. -->
Fetcher is an entity type.
Fetcher is a subtype of Function.

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
     is addressed as any Function is -- backed by an External System, called with an HTTP Method
     at its Callback URI, with the system`s headers and the connection`s credential (core.md) --
     and what its answer yields is `Function yields Fact Type with Role from JSON Path`, the
     declaration a webhook payload and a performed call`s receipt already use, read here once per
     ROW with every role taken from its own path. These say what the call carries and how its
     answer pages: its query parameters, where in the answer the rows are, which path says there
     is more, and which query parameter carries the cursor and from which path of the answer --
     Stripe`s is $.data[-1].id, the last row`s id, and Gmail`s $.nextPageToken.
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

<!-- AND A ROW IS READ ONLY WHEN IT SAYS WHAT THE SOURCE MEANS. pm.auto.dev, over all
     2,651 Stripe subscriptions: a hole yields no fact of that TYPE, but ten subscriptions belong to
     deleted customers with no email and still yield their Plan, so the Customer role a mandatory
     constraint needs is missing and the whole page is refused. A condition is on the ROW: every one
     a Function declares must hold, or none of the row is read. The path takes the filters a value
     does, so `is present` is the path with |present equal to 'T', and an event Source keeps its
     kind with $.type equal to 'customer.subscription.deleted'. Several conditions are all of them;
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
     store holds none, since a body can carry what the read never declared to take: auth.vin answers an
     admin's read with every user's live API key. -->
Response is an entity type.

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
     `Object Type is backed by External System` and `Object Type has URI`
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
     universally the inverse of lower, just for a particular field. auth.vin's role is read
     through lower and written through upper; an email read through lower has no inverse, and a
     field read through a filter that declares none is read-only. The pair is held to the values
     the store holds: read(write(v)) is v (fed:ot_roundtrip_bad). A Filter is one of lambda's
     registered value filters (tpl:filter), as a JSON Path's bar names one. -->
Filter is a value type.

Fact Type is written through Filter.
  Each Fact Type is written through at most one Filter.

REST Dialect is a value type.
  The possible values of REST Dialect are 'payload'.

External System speaks REST Dialect.
  Each External System speaks at most one REST Dialect.

## Instance Facts

<!-- organizations-domain (ruling 2): Domain 'federation' has Access 'public'. -->
Domain 'federation' has Description 'Sources, connectors and translators as a standard module: a Source is where facts live and a Connector names how to reach and read it, its Fetcher and Translator being definition names resolved through DEFS at fetch time.'.
