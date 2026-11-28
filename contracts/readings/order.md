# Order Domain

## Instance Facts

Domain 'order' has Description 'An order from cart to archive: the readings the Solidity generator is held to.'.

## Entity Types

Order(.Order Id) is an entity type.
Customer(.Name) is an entity type.

## Value Types

Amount is a value type.
Note is a value type.

## Fact Types

Order was placed by Customer.
  Each Order was placed by exactly one Customer.

Order has Amount.
  Each Order has at most one Amount.

Order has Note.
  It is obligatory that each Order has at most one Note.

Order is placed.
Order is shipped.
Order is archived.
Customer cancels Order.

## State Machines

State Machine Definition 'Order' is for Object Type 'Order'.
Status 'In Cart' is initial in State Machine Definition 'Order'.

Transition 'place' is defined in State Machine Definition 'Order'.
Transition 'place' is from Status 'In Cart'.
Transition 'place' is to Status 'Placed'.
Transition 'place' is triggered by Event Type 'Order is placed'.

Transition 'ship' is defined in State Machine Definition 'Order'.
Transition 'ship' is from Status 'Placed'.
Transition 'ship' is to Status 'Shipped'.
Transition 'ship' is triggered by Event Type 'Order is shipped'.

Transition 'archive' is defined in State Machine Definition 'Order'.
Transition 'archive' is from Status 'Shipped'.
Transition 'archive' is to Status 'Archived'.
Transition 'archive' is triggered by Event Type 'Order is archived'.

Transition 'cancel' is defined in State Machine Definition 'Order'.
Transition 'cancel' is from Status 'Placed'.
Transition 'cancel' is to Status 'Cancelled'.
Transition 'cancel' is triggered by Event Type 'Customer cancels Order'.
