# A negated leg is an anti-join on the accumulator, whether or not the head shows its tokens

### `that Country Code is not in EEA` sits five legs from the head and binds a
### token the head does not show; `that Fee Schedule has no Cap Amount` binds a
### body token and a fresh one inside its own existential. Until 2026-09-10 the
### recorder projected a negated leg onto the head's columns and subtracted it
### there, so both were declined as "a negated leg that does not bind the head"
### (support.auto.dev: Billable Request triggers cross-border Personal Data
### Transfer; Vehicle Purchase Quote has document- Fee Amount). The subtraction is
### now an anti-join laid on the accumulator before the comparisons and the
### projection: the rows minus the rows the negated leg's population matches on
### the tokens they share, the accumulator's own columns kept. Rows on this
### store: r1 triggers (its system sits in the US), r2 does not (Germany is in the
### EEA), r3 involves no personal data; q1 is uncapped (Texas's schedule carries
### no cap), q2 is not.

Billable Request(.id) is an entity type.
Meter Endpoint(.id) is an entity type.
External System(.id) is an entity type.
Country Code(.code) is an entity type.
Quote(.id) is an entity type.
State(.name) is an entity type.
Fee Schedule(.id) is an entity type.
Cap Amount is a value type.
  The data type of Cap Amount is integer.

Billable Request involves Personal Data.
Billable Request has Meter Endpoint.
  Each Billable Request has at most one Meter Endpoint.
Meter Endpoint is provided by External System.
  Each Meter Endpoint is provided by at most one External System.
External System is established in Country Code.
  Each External System is established in at most one Country Code.
Country Code is in EEA.
Billable Request triggers cross-border Personal Data Transfer. *
Quote is in State.
  Each Quote is in at most one State.
Fee Schedule belongs to State.
Fee Schedule has Cap Amount.
  Each Fee Schedule has at most one Cap Amount.
Quote is uncapped. *

* Billable Request triggers cross-border Personal Data Transfer iff Billable Request involves Personal Data and Billable Request has some Meter Endpoint and that Meter Endpoint is provided by some External System and that External System is established in some Country Code and that Country Code is not in EEA.
* Quote is uncapped iff Quote is in State and Fee Schedule belongs to that State and that Fee Schedule has no Cap Amount.

Billable Request 'r1' involves Personal Data.
Billable Request 'r1' has Meter Endpoint 'm1'.
Meter Endpoint 'm1' is provided by External System 'e1'.
External System 'e1' is established in Country Code 'US'.
Billable Request 'r2' involves Personal Data.
Billable Request 'r2' has Meter Endpoint 'm2'.
Meter Endpoint 'm2' is provided by External System 'e2'.
External System 'e2' is established in Country Code 'DE'.
Country Code 'DE' is in EEA.
Billable Request 'r3' has Meter Endpoint 'm1'.
Quote 'q1' is in State 'Texas'.
Quote 'q2' is in State 'Florida'.
Fee Schedule 's1' belongs to State 'Texas'.
Fee Schedule 's2' belongs to State 'Florida'.
Fee Schedule 's2' has Cap Amount 500.
