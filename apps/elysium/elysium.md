# Elysium: The Project As Its Own Carrier

<!-- The fifth app (2026-07-20, the experiment ruling): the collaboration
     was the last system in the room still running un-AREST'd. Project
     memory stops being prose re-narrated per session and becomes facts
     under constraints: tickets advance by FIRED TRANSITIONS through the
     journal (the emit leg's own acceptance - a ticket closed today
     boots closed tomorrow), and an adjudication is OPEN exactly while
     no 'is ruled' row exists - presence of fact, not prose recall.

     The checkability ruling (same day): no description fields - prose
     goes stale and is not checkable. What a ticket means is what it
     COVERS: Functions, checkable against the store itself - a covers
     row naming a Function not yet a cell of D is an open promise, and
     a done ticket whose Function is missing is a contradiction a law
     can catch. The seed carries no fired events: every status change
     arrives through the journal, the store of record, in file order. -->

## Entity Types

Ticket(.Name) is an entity type.
Adjudication(.Name) is an entity type.

<!-- The query ruling (same day): an adjudication's identifier is a
     name, never question prose - the question itself is a relation to
     a query object. Here the query objects are Functions (Derivation
     Rules when textual, the has-Text binding); concerns carries the
     subject today. Amended by the resource ruling: the question is not
     a string boxed in a type either - facts are resources per se,
     everything in the store is addressable (every prefix a valid
     fetch), so an adjudication's subject is a RELATION TO A RESOURCE:
     a Function cell via concerns, a row by its address when a question
     needs one. No Text-carrying query objects. -->

## Fact Types

Ticket covers Function.

Adjudication concerns Function.

Adjudication is ruled.

## State Machine

State Machine Definition 'Work' is for Object Type 'Ticket'.
Status 'open' is initial in State Machine Definition 'Work'.

Ticket is started.
Ticket is finished.

Transition 'start' is defined in State Machine Definition 'Work'.
Transition 'start' is from Status 'open'.
Transition 'start' is to Status 'underway'.
Transition 'start' is triggered by Event Type 'Ticket is started'.

Transition 'finish' is defined in State Machine Definition 'Work'.
Transition 'finish' is from Status 'underway'.
Transition 'finish' is to Status 'done'.
Transition 'finish' is triggered by Event Type 'Ticket is finished'.

## Instance Facts

Ticket 'the emit leg' covers Function 'ui:replay'.
Ticket 'the emit leg' covers Function 'ui:jentry'.
Ticket 'retraction' covers Function 'ui:retract'.
Ticket 'retraction' covers Function 'ui:removefirst'.
Ticket 'web store append' covers Function 'store:append'.
Ticket 'the validate leg' covers Function 'ui:validate'.
Ticket 'the validate leg' covers Function 'ui:navpe'.

Adjudication 'the reports menu' concerns Function 'ui:modes'.
Adjudication 'marker-closure scope' concerns Function 'law:markers'.
Adjudication 'the division primitive' concerns Function 'ntoa'.
Adjudication 'the initial-representation sentence' concerns Function 'ui:top'.
Adjudication 'tools tracking' is ruled.

Domain 'elysium' has Description 'The project as its own store: tickets advance by fired transitions in the journal, adjudications hold rulings as facts, and continuity is a law.'.
