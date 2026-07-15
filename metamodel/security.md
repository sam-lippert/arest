# Security

<!--
## Description
SSRF defense vocabulary (#25, #894). Each `CIDR Block` row in the
instance fact list below is a network range that External System URLs
must NOT resolve to. The deontic constraint below makes the policy
explicit; the killed host's engine read the CIDR list at
platform_compile time, and the evaluator-phase gate must likewise
reject any `External System has URL` whose host sits inside one of
the listed blocks.
-->

<!-- elysium-audit H (10.2 discipline): Before #894 this list lived as a
     `forbidden_v4 = a == 127 || …` chain in
     `crates/arest/src/parse_forml2.rs::is_forbidden_url`. The Sweep-1
     dispatch-to-data lift moves it here so operators can add or retract
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

## Fact Types

### CIDR Block
CIDR Block has Block Kind.
  Each CIDR Block has exactly one Block Kind.

## Deontic Constraints

### SSRF Blocklist

It is forbidden that External System URL resolves to host in CIDR Block.

## Instance Facts

<!-- elysium-audit H (10.2 discipline): The eight CIDR Block entries below
     mirror the pre-#894 hardcoded IPv4/IPv6 dispatch in
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
