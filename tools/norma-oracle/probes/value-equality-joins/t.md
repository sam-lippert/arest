# A value equality between two tokens is the join key, or between two joined columns a filter

### `Customer has Stripe Customer if Stripe Customer has Email Address and
### Customer has Email and that Email Address is that Email` joins two legs that
### share no token: the equality clause names the pair. The chain recorder read
### the clause as a comparison and declined it as "a comparison (is)", and when
### the legs shared no token the second leg was "a leg the chain never reaches"
### (auto.dev's PostHog Person and Stripe Customer links, 2026-09-10). Now an
### equality between a token the accumulator holds and one of a candidate leg's
### is the key that join runs on, consumed there; and an equality between two
### columns already joined (`that billing- Email is that shipping- Email`) is a
### filter -- the rows minus the strictly-less rows each way, since cmp is the
### grammar's only order. Rows on this store: c1 links to s1 and c2 to p1 by
### their addresses; o1 is consistent (its two emails agree), o2 is not.

Customer(.id) is an entity type.
Stripe Customer(.id) is an entity type.
PostHog Person(.id) is an entity type.
Order(.id) is an entity type.
Email is a value type.
Email Address is a value type.

Customer has Email.
  Each Customer has at most one Email.
Stripe Customer has Email Address.
  Each Stripe Customer has at most one Email Address.
PostHog Person has Email Address.
  Each PostHog Person has at most one Email Address.
Customer has Stripe Customer. +
Customer has PostHog Person. +
Order has billing- Email.
  Each Order has at most one billing- Email.
Order has shipping- Email.
  Each Order has at most one shipping- Email.
Order is consistent. *

+ Customer has Stripe Customer if Stripe Customer has Email Address and Customer has Email and that Email Address is that Email.
+ Customer has PostHog Person if some PostHog Person has Email Address and Customer has Email and that Email Address is that Email.
* Order is consistent iff Order has billing- Email and Order has shipping- Email and that billing- Email is that shipping- Email.

Customer 'c1' has Email 'a@x.io'.
Customer 'c2' has Email 'b@x.io'.
Stripe Customer 's1' has Email Address 'a@x.io'.
Stripe Customer 's2' has Email Address 'z@x.io'.
PostHog Person 'p1' has Email Address 'b@x.io'.
Order 'o1' has billing- Email 'a@x.io'.
Order 'o1' has shipping- Email 'a@x.io'.
Order 'o2' has billing- Email 'a@x.io'.
Order 'o2' has shipping- Email 'b@x.io'.
