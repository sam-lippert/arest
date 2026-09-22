# AREST UI: CRUDL Operations — the iFactr ActionType DECORATION over the access Operation (crudl-menu-projection)

> The iFactr-presentation DECORATION layer over the access-control `Operation`.
> `Operation` itself — the CRUDL verb — and `Operation applies in View Context`
> (the HATEOAS resource kind it shows up in) are SUBSTRATE, declared in
> readings/access/access.md; this reading does NOT redeclare them, it REFERENCES
> that `Operation` and pins, per verb, how iFactr should draw it.
>
> Grounded DIRECTLY in iFactr's action vocabulary —
> `iFactr-Android/iFactr.UI/iFactr.UI/Controls/ActionType.cs`
> (`Undefined, Add, Cancel, Edit, Delete, More, Submit, None`) — and its
> serialized controls (`Button`, `SubmitButton`, `CancelButton`; see
> `apps/ui.do/src/ifactr/contract.md`). The menu itself is
> `iLayer.ActionButtons` / `IMenu.Buttons`; each item is a `Button`/`Link`
> carrying an `ActionType` + `RequestType` (+ optional confirmation).
>
> Operation → iFactr ActionType: create=`Add`, edit=`Edit`, delete=`Delete`,
> save=`Submit`, cancel=`Cancel`. "Search" is the `IListView` SearchBox (a
> list affordance, not an action button), so it is NOT an Operation here.
> "Multi-Delete" is `Delete` in a collection/multi-select context.
>
> This reading is the iFactr DECORATION (Action Type / Control Kind / Request
> Type per Operation). The permission gate (`User is authorized for Operation on
> Object Type`) and the view-context applicability (`Operation applies in View Context`)
> are the access SUBSTRATE; the HATEOAS CRUDL menu
> (command::crudl_menu_operations) projects `authorized` ∩ applies-in-context and
> then decorates each surviving Operation with the iFactr metadata below.

## Domain Metadata

<!-- This file's part of the domain: The iFactr ActionType decoration over the access-control Operation: per-CRUDL-verb Action Type, Control Kind and Request Type. Decoration only -- Operation and its View Context substrate live in access.md.
     The sentence below is readings/ui/ui.md:403 repeated verbatim.
     core.md:220 makes Description functional, so a domain carries ONE
     text and an identical sentence is the identical fact. -->
Domain 'ui' has Description 'Platform-agnostic view hierarchy, navigation, and controls. Custom renderers registered per platform via the factory pattern.'.

## Value Types

iFactr Action Type is a value type.
  The possible values of iFactr Action Type are
    'Undefined', 'Add', 'Cancel', 'Edit', 'Delete', 'More', 'Submit', 'None'.

Control Kind is a value type.
  The possible values of Control Kind are
    'Button', 'SubmitButton', 'CancelButton', 'Link', 'Icon', 'Label'.

CRUDL Request Type is a value type.
  The possible values of CRUDL Request Type are 'GET', 'POST', 'PUT', 'DELETE'.

## Fact Types

> `Operation(.Name)` is declared in readings/access/access.md (the access
> SUBSTRATE) and only REFERENCED here. So is `Operation applies in View Context`
> — the view-context applicability is substrate, not iFactr decoration.

Operation has iFactr Action Type.
  Each Operation has at most one iFactr Action Type.

Operation has CRUDL Request Type.
  Each Operation has at most one CRUDL Request Type.

Operation has Control Kind.
  Each Operation has at most one Control Kind.

Operation requires Confirmation.

## Instance Facts

Operation 'create' has iFactr Action Type 'Add'.
Operation 'create' has CRUDL Request Type 'POST'.
Operation 'create' has Control Kind 'Button'.

Operation 'edit' has iFactr Action Type 'Edit'.
Operation 'edit' has CRUDL Request Type 'GET'.
Operation 'edit' has Control Kind 'Button'.

Operation 'delete' has iFactr Action Type 'Delete'.
Operation 'delete' has CRUDL Request Type 'DELETE'.
Operation 'delete' has Control Kind 'Button'.
Operation 'delete' requires Confirmation.

Operation 'multi-delete' has iFactr Action Type 'Delete'.
Operation 'multi-delete' has CRUDL Request Type 'DELETE'.
Operation 'multi-delete' has Control Kind 'Button'.
Operation 'multi-delete' requires Confirmation.

Operation 'save' has iFactr Action Type 'Submit'.
Operation 'save' has CRUDL Request Type 'PUT'.
Operation 'save' has Control Kind 'SubmitButton'.

Operation 'cancel' has iFactr Action Type 'Cancel'.
Operation 'cancel' has CRUDL Request Type 'GET'.
Operation 'cancel' has Control Kind 'CancelButton'.
