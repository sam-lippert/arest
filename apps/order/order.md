# Test App: Sale Workflow

<!-- exec (2026-07-16): a test application for the checker mu — a
     classic sale workflow exercising the whitepaper's claims: Thm 2
     (the affordances from a status are the effective transitions,
     served by system:view_menu), Thm 1's validate leg (uniqueness
     refusal, mandatory warning), and per-app RMAP (multi-entity
     absorption — unlike the base metamodel's one-root world, a normal
     app absorbs into one cell per entity). Parsed COMBINED with the
     base metamodel so the state vocabulary binds. -->

## Entity Types

Customer(.Nr) is an entity type.
Sale(.Nr) is an entity type.
Item(.Code) is an entity type.

## Value Types

Total is a value type.
  The data type of Total is decimal.
Quantity is a value type.
  The data type of Quantity is integer.

## Readings

Sale is placed by Customer.
  Each Sale is placed by exactly one Customer.
  It is possible that more than one Sale is placed by the same Customer.

Sale has Total.
  Each Sale has at most one Total.

Sale contains Item in Quantity.
  Each Sale, Item combination occurs at most once in the population of Sale contains Item in Quantity.

## State Machine

State Machine Definition 'Sale' is for Object Type 'Sale'.
Status 'draft' is initial in State Machine Definition 'Sale'.

Sale is submitted.
Sale is paid for.
Sale is shipped.
Sale is cancelled.

Transition 'submit' is defined in State Machine Definition 'Sale'.
Transition 'submit' is from Status 'draft'.
Transition 'submit' is to Status 'placed'.
Transition 'submit' is triggered by Event Type 'Sale is submitted'.

Transition 'pay' is defined in State Machine Definition 'Sale'.
Transition 'pay' is from Status 'placed'.
Transition 'pay' is to Status 'paid'.
Transition 'pay' is triggered by Event Type 'Sale is paid for'.

Transition 'ship' is defined in State Machine Definition 'Sale'.
Transition 'ship' is from Status 'paid'.
Transition 'ship' is to Status 'shipped'.
Transition 'ship' is triggered by Event Type 'Sale is shipped'.

Transition 'cancel' is defined in State Machine Definition 'Sale'.
Transition 'cancel' is from Status 'placed'.
Transition 'cancel' is to Status 'cancelled'.
Transition 'cancel' is triggered by Event Type 'Sale is cancelled'.

## Instance Facts

Sale 'o1' is placed by Customer 'c1'.
Sale 'o2' is placed by Customer 'c1'.
Sale 'o3' is placed by Customer 'c2'.

Sale 'o1' has Total '19.99'.
Sale 'o2' has Total '5.00'.

Sale 'o1' contains Item 'widget' in Quantity '2'.
Sale 'o1' contains Item 'gadget' in Quantity '1'.
Sale 'o2' contains Item 'widget' in Quantity '7'.

Domain 'order' has Description 'A sale workflow: draft to placed to paid to shipped, with cancellation.'.
