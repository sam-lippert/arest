# Security

<!--
## Description
SSRF defense vocabulary. Each `CIDR Block` row in the
instance fact list below is a network range that External System URLs
must NOT resolve to. The deontic constraint below makes the policy
explicit; the killed host's engine read the CIDR list at
platform_compile time, and the evaluator-phase gate must likewise
reject any `External System has URL` whose host sits inside one of
the listed blocks.
-->

<!-- arest-audit H (10.2 discipline): this list is data, not a
     `forbidden_v4 = a == 127 || …` chain in
     host code,
     so operators can add or retract
     ranges without touching Rust — e.g. a tenant operating inside RFC 6598
     (`100.64.0.0/10`, carrier-grade NAT) can add that prefix as one extra
     instance fact and the next compile re-derives the blocklist. -->

<!--
The killed host's `cidr_contains` Platform Func (crates/arest/src/
ast.rs) was the membership predicate — one implementation called by
both the engine's SSRF check and app access-control derivation rules.
Evaluator-phase obligation: register cidr_contains once (Def 9,
origin 'registered') and serve both surfaces from the one definition.
-->

## Entity Types

CIDR Block is an entity type.
CIDR Block is a subtype of Function.

## Value Types

Block Kind is a value type.
  The possible values of Block Kind are 'internal-loopback', 'private-rfc1918', 'link-local', 'ipv6-loopback', 'ipv6-link-local', 'ipv6-unique-local'.
  The data type of Block Kind is text.

Resolved Address is a value type.
  The data type of Resolved Address is text.

## Fact Types

### CIDR Block
CIDR Block has Block Kind.
  Each CIDR Block has exactly one Block Kind.

### External System
External System resolves to Resolved Address.
  Each External System, Resolved Address combination occurs at most once in the population of External System resolves to Resolved Address.
  <!-- What the host of the system's URL resolved to when a request to it was
       made, which keeps the SSRF check honest. Recorded by the performer at
       the send, the one moment the name is looked up, so the store holds the
       address a request actually went to and not one written down for it. -->

### Authorization
<!-- Permission is restriction by authorization and
     authentication. A caller sees, and may take, only the controls it is
     authorized for (AREST.tex, Theorem thm:hateoas: links_c(e) is nav(e) and
     transitions(status(e)) intersected with auth_P(c)). An application grants
     authorization in plain readings, by derivation rules over this fact type,
     and a function that decides authentication is bound to its predicate
     (Predicate has Module Path, Symbol Name); no syntax beyond FORML. -->
User is authorized for Permission on Function. +
  Each User, Permission, Function combination occurs at most once in the population of User is authorized for Permission on Function.

User is authenticated.

<!-- DENY BY DEFAULT, GRANTED BY FACTS. A user only has read
     or write access to a resource if their group or user has that permission,
     so resources are deny-by-default unless users are not included in the
     universe of discourse or access permissions are given for any user on a
     resource. There is no custom FORML syntax or magic phrase:
     permissions are set via permission fact verbalizations, and groups are
     both roles and organizations.
     A permission is a fact of one of four fact types, verbalized like any
     instance fact:
       to one user        User 'u' is authorized for Permission 'create' on Function 'F'.
       to a role          Access Role 'admin' is authorized for Permission 'create' on Function 'F'.
       to an organization Organization 'o' is authorized for Permission 'read' on Function 'F'.
                          (organizations.md, where a User belongs to an Organization)
       to any user        Object Type 'F' has Permission 'read'.   (core.md)
     A user is authorized for what is granted to the user, to a role the user
     has, or to an organization the user belongs to; everything else is denied.
     A grant on an entity type is a grant on all of it: every fact type it
     plays a role in, its columns, unless a column is constrained by a grant of
     its own: a grant on an entity grants its full entity
     access unless a column is constrained.
     The any-user grant and the open case -- an application whose readings
     declare no User at all -- are read where the controls are computed
     (auth:links), not multiplied out per user here. There is no
     `It is permitted that` feature;
     permissions work via canonical FORML, and access
     is only ever these facts.
     Access Role, not Role: Role is the ORM role (core.md). -->
Access Role(.Name) is an entity type.

User has Access Role.
  Each User, Access Role combination occurs at most once in the population of User has Access Role.

Access Role is authorized for Permission on Function.
  Each Access Role, Permission, Function combination occurs at most once in the population of Access Role is authorized for Permission on Function.

+ User is authorized for Permission on Function if that User has some Access Role and that Access Role is authorized for that Permission on that Function.

## Deontic Constraints

### SSRF Blocklist

<!-- Decided by a function, not by the sentence "It
     is forbidden that External System URL resolves to host in CIDR Block",
     which builds no constraint. decide:ssrf in lambda answers each External
     System whose URL names a host in a CIDR Block below: a dotted quad, a
     bracketed IPv6 literal, or localhost. That is what the killed host's
     is_forbidden_url judged, from the URL as written. A hostname is NOT
     resolved: that is network I/O, which a deontic computed on every write
     must not wait on. A hostname that resolves into a blocked range is
     caught where the request is made: the performer resolves
     the host before a live send, refuses the send when any address it gets
     lies in a CIDR Block below, and records each address as `External System
     resolves to Resolved Address`. decide:ssrf reads those records too, so a
     system whose name resolved inside a blocked range is a violation here as
     well as a refused send. -->
Constraint 'external-system-url-not-internal' has Text 'It is forbidden that the URL of an external system resolves to a host in a blocked CIDR block'.
Constraint 'external-system-url-not-internal' has modality of Modality Type 'Deontic'.
Constraint 'external-system-url-not-internal' is of Constraint Type 'DF_pop'.
Constraint 'external-system-url-not-internal' spans Role 'ExternalSystemHasURL.1'.
Constraint 'external-system-url-not-internal' is decided by Predicate 'decide:ssrf'.
Predicate 'decide:ssrf' has Module Path 'arest'.
Predicate 'decide:ssrf' has Symbol Name 'decide:ssrf'.

## Instance Facts

<!-- arest-audit H (10.2 discipline): The eight CIDR Block entries below
     mirror the former hardcoded IPv4/IPv6 dispatch in
     `is_forbidden_url`. Each row's `Block Kind` documents the rationale;
     `cidr_contains` only reads the id (the CIDR string itself, now the Function id). Order
     is the same as the legacy code's branch ordering so a row-by-row audit
     between the Rust source and this list is straightforward. -->

CIDR Block '127.0.0.0/8' has Block Kind 'internal-loopback'.
CIDR Block '10.0.0.0/8' has Block Kind 'private-rfc1918'.
CIDR Block '169.254.0.0/16' has Block Kind 'link-local'.
CIDR Block '192.168.0.0/16' has Block Kind 'private-rfc1918'.
CIDR Block '172.16.0.0/12' has Block Kind 'private-rfc1918'.
CIDR Block '::1/128' has Block Kind 'ipv6-loopback'.
CIDR Block 'fe80::/10' has Block Kind 'ipv6-link-local'.
CIDR Block 'fc00::/7' has Block Kind 'ipv6-unique-local'.

<!-- organizations-domain (ruling 2): Domain 'security' has Access 'public'. -->
Domain 'security' has Description 'SSRF defense vocabulary. CIDR Block entries are the data the engine reads at platform_compile time to reject External System URLs resolving to internal/loopback/link-local hosts. Lifted from hardcoded Rust per the Sweep-1 dispatch-to-data recipe (#894).'.
