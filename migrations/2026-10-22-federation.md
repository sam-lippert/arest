# Migration: External System is renamed Federation (2026-10-22)

Sam, 2026-10-22: "External System" is renamed "Federation", word for word, in all of its readings. Every
fact type whose name carries the type is dropped by the new readings and declared again under the new name,
so a store's rows of the old fact types are runtime facts of a fact type the readings no longer declare,
and the in-place compile refuses them (compile:ip_why_unplaced) unless an approved Migration carries them
(compile:ip_migrate, migrate:plan, migrate:recipe). These are those Migrations: one Domain Change per
Domain, proposing one Migration per asserted fact type. Fully derived fact types hold no rows and have none.

NOT DEPLOYED. Step 8 asserts them into each prior store BEFORE that store's recompile against the renamed
readings, because migrate:plan reads them off the prior store (the source fact types still exist there),
then Sam approves each Domain Change (`User 'sam' approves Domain Change '...'`): the gate is exactly one
User, and that User human. The approval is his to give, so it is not written here. A Migration whose
source fact type holds no runtime row in a store moves nothing there.

This file is not composed into any app: it is the facts to assert, in readings form and as `assert`
operands (each fact `[factType, players in role order]`).

## What these Migrations do not carry

A Migration moves the rows of a fact type that the readings dropped. It renames no value inside a fact
type that stays, so three things are for step 8 to settle before or at each recompile:

1. **The .env files.** An app's `.env` states its connections as readings, `Domain 'support' connects
   to External System 'resend'.` and `DomainConnectsToExternalSystem 'support.resend' carries Secret
   Reference '...'.`. Under the renamed readings those sentences name a type and fact types that no
   longer exist. They must read `Federation` and `DomainConnectsToFederation` before the recompile.
   The .env files were not opened here.
2. **Instance-of rows of an External System made at runtime.** `Object Type Instance is instance of
   Object Type` rows written by a create, `<id, 'External System'>`, name the Object Type by its old
   name. The compile recomputes the rows its readings asserted, and drops the reflection's own, but a
   runtime create's row naming 'External System' would be refused as naming an instance the readings
   no longer introduce. Measure each prior store for such rows first.
3. **The SSRF constraint's id.** 'external-system-url-not-internal' is now
   'federation-url-not-internal'. A recorded Violation of it (`Violation is of Constraint`) is a runtime
   row that names the old id, and is refused the same way. Measure each prior store for one.

The Migrations' rule texts are read by migrate:recipe's player-rename arm (arest 34ec1080), against
the target's declared players. Measured on the Java host: thirteen of the 34 rule texts below read as
the identity projection of their source (four in test:migrate_rename, nine as scratch probes: the
`alternate-` role names, the commerce ternary, Service Health Status, Log Entry, Country Code, the
secret on the objectification, REST Dialect, Test reaches). The other 21 have the same shapes, a
binary with Federation first or second, and were not run one by one.

Not measured: whether a store accepts these facts as written. Migration and Domain Change are
subtypes of Function and Object Type Instance, and a create may owe facts of those supertypes that
are not listed here. No store was written to; asserting them is step 8's first act on each store.

## Domain Change 'dc-2026-10-22-federation-core'

Readings: arest/metamodel (core.md, instances.md). Target stores: every store (claude, tasks, support, qa, pm, engineering, and any other app compiled over the metamodel).

```
Domain Change 'dc-2026-10-22-federation-core' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-core' targets Domain 'core'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-url'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-header'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-header-with-header-value'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-authenticates-with-header'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-credential-encoding'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-prefix'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-federation-has-kind'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-object-type-is-backed-by-federation'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-function-is-backed-by-federation'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-domain-connects-to-federation'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-domainconnectstofederation-has-send-mode'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-domainconnectstofederation-carries-secret-reference'.
Domain Change 'dc-2026-10-22-federation-core' proposes Function 'mig-2026-10-22-citation-is-backed-by-federation'.
Migration 'mig-2026-10-22-federation-has-url' has Fact Type 'ExternalSystemHasURL' as source.
Migration 'mig-2026-10-22-federation-has-url' produces Fact Type 'FederationHasURL' as target.
Migration 'mig-2026-10-22-federation-has-url' has Migration Rule Text 'Federation has URL iff that External System has URL.'.
Migration 'mig-2026-10-22-federation-has-url' has Timestamp '2026-10-22T12:00:00Z'.
Migration 'mig-2026-10-22-federation-has-header' has Fact Type 'ExternalSystemHasHeader' as source.
Migration 'mig-2026-10-22-federation-has-header' produces Fact Type 'FederationHasHeader' as target.
Migration 'mig-2026-10-22-federation-has-header' has Migration Rule Text 'Federation has Header iff that External System has Header.'.
Migration 'mig-2026-10-22-federation-has-header' has Timestamp '2026-10-22T12:00:01Z'.
Migration 'mig-2026-10-22-federation-has-header-with-header-value' has Fact Type 'ExternalSystemHasHeaderWithHeaderValue' as source.
Migration 'mig-2026-10-22-federation-has-header-with-header-value' produces Fact Type 'FederationHasHeaderWithHeaderValue' as target.
Migration 'mig-2026-10-22-federation-has-header-with-header-value' has Migration Rule Text 'Federation has Header with Header Value iff that External System has Header with Header Value.'.
Migration 'mig-2026-10-22-federation-has-header-with-header-value' has Timestamp '2026-10-22T12:00:02Z'.
Migration 'mig-2026-10-22-federation-authenticates-with-header' has Fact Type 'ExternalSystemAuthenticatesWithHeader' as source.
Migration 'mig-2026-10-22-federation-authenticates-with-header' produces Fact Type 'FederationAuthenticatesWithHeader' as target.
Migration 'mig-2026-10-22-federation-authenticates-with-header' has Migration Rule Text 'Federation authenticates with Header iff that External System authenticates with Header.'.
Migration 'mig-2026-10-22-federation-authenticates-with-header' has Timestamp '2026-10-22T12:00:03Z'.
Migration 'mig-2026-10-22-federation-has-credential-encoding' has Fact Type 'ExternalSystemHasCredentialEncoding' as source.
Migration 'mig-2026-10-22-federation-has-credential-encoding' produces Fact Type 'FederationHasCredentialEncoding' as target.
Migration 'mig-2026-10-22-federation-has-credential-encoding' has Migration Rule Text 'Federation has Credential Encoding iff that External System has Credential Encoding.'.
Migration 'mig-2026-10-22-federation-has-credential-encoding' has Timestamp '2026-10-22T12:00:04Z'.
Migration 'mig-2026-10-22-federation-has-prefix' has Fact Type 'ExternalSystemHasPrefix' as source.
Migration 'mig-2026-10-22-federation-has-prefix' produces Fact Type 'FederationHasPrefix' as target.
Migration 'mig-2026-10-22-federation-has-prefix' has Migration Rule Text 'Federation has Prefix iff that External System has Prefix.'.
Migration 'mig-2026-10-22-federation-has-prefix' has Timestamp '2026-10-22T12:00:05Z'.
Migration 'mig-2026-10-22-federation-has-kind' has Fact Type 'ExternalSystemHasKind' as source.
Migration 'mig-2026-10-22-federation-has-kind' produces Fact Type 'FederationHasKind' as target.
Migration 'mig-2026-10-22-federation-has-kind' has Migration Rule Text 'Federation has Kind iff that External System has Kind.'.
Migration 'mig-2026-10-22-federation-has-kind' has Timestamp '2026-10-22T12:00:06Z'.
Migration 'mig-2026-10-22-object-type-is-backed-by-federation' has Fact Type 'ObjectTypeIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-object-type-is-backed-by-federation' produces Fact Type 'ObjectTypeIsBackedByFederation' as target.
Migration 'mig-2026-10-22-object-type-is-backed-by-federation' has Migration Rule Text 'Object Type is backed by Federation iff that Object Type is backed by External System.'.
Migration 'mig-2026-10-22-object-type-is-backed-by-federation' has Timestamp '2026-10-22T12:00:07Z'.
Migration 'mig-2026-10-22-function-is-backed-by-federation' has Fact Type 'FunctionIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-function-is-backed-by-federation' produces Fact Type 'FunctionIsBackedByFederation' as target.
Migration 'mig-2026-10-22-function-is-backed-by-federation' has Migration Rule Text 'Function is backed by Federation iff that Function is backed by External System.'.
Migration 'mig-2026-10-22-function-is-backed-by-federation' has Timestamp '2026-10-22T12:00:08Z'.
Migration 'mig-2026-10-22-domain-connects-to-federation' has Fact Type 'DomainConnectsToExternalSystem' as source.
Migration 'mig-2026-10-22-domain-connects-to-federation' produces Fact Type 'DomainConnectsToFederation' as target.
Migration 'mig-2026-10-22-domain-connects-to-federation' has Migration Rule Text 'Domain connects to Federation iff that Domain connects to External System.'.
Migration 'mig-2026-10-22-domain-connects-to-federation' has Timestamp '2026-10-22T12:00:09Z'.
Migration 'mig-2026-10-22-domainconnectstofederation-has-send-mode' has Fact Type 'DomainConnectsToExternalSystemHasSendMode' as source.
Migration 'mig-2026-10-22-domainconnectstofederation-has-send-mode' produces Fact Type 'DomainConnectsToFederationHasSendMode' as target.
Migration 'mig-2026-10-22-domainconnectstofederation-has-send-mode' has Migration Rule Text 'DomainConnectsToFederation has Send Mode iff that DomainConnectsToExternalSystem has Send Mode.'.
Migration 'mig-2026-10-22-domainconnectstofederation-has-send-mode' has Timestamp '2026-10-22T12:00:10Z'.
Migration 'mig-2026-10-22-domainconnectstofederation-carries-secret-reference' has Fact Type 'DomainConnectsToExternalSystemCarriesSecretReference' as source.
Migration 'mig-2026-10-22-domainconnectstofederation-carries-secret-reference' produces Fact Type 'DomainConnectsToFederationCarriesSecretReference' as target.
Migration 'mig-2026-10-22-domainconnectstofederation-carries-secret-reference' has Migration Rule Text 'DomainConnectsToFederation carries Secret Reference iff that DomainConnectsToExternalSystem carries Secret Reference.'.
Migration 'mig-2026-10-22-domainconnectstofederation-carries-secret-reference' has Timestamp '2026-10-22T12:00:11Z'.
Migration 'mig-2026-10-22-citation-is-backed-by-federation' has Fact Type 'CitationIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-citation-is-backed-by-federation' produces Fact Type 'CitationIsBackedByFederation' as target.
Migration 'mig-2026-10-22-citation-is-backed-by-federation' has Migration Rule Text 'Citation is backed by Federation iff that Citation is backed by External System.'.
Migration 'mig-2026-10-22-citation-is-backed-by-federation' has Timestamp '2026-10-22T12:00:12Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-core", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-core", "core"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-url"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-header"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-header-with-header-value"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-authenticates-with-header"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-credential-encoding"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-prefix"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-federation-has-kind"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-object-type-is-backed-by-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-function-is-backed-by-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-domain-connects-to-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-domainconnectstofederation-has-send-mode"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-domainconnectstofederation-carries-secret-reference"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-core", "mig-2026-10-22-citation-is-backed-by-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-url", "ExternalSystemHasURL"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-url", "FederationHasURL"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-url", "Federation has URL iff that External System has URL."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-url", "2026-10-22T12:00:00Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-header", "ExternalSystemHasHeader"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-header", "FederationHasHeader"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-header", "Federation has Header iff that External System has Header."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-header", "2026-10-22T12:00:01Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-header-with-header-value", "ExternalSystemHasHeaderWithHeaderValue"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-header-with-header-value", "FederationHasHeaderWithHeaderValue"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-header-with-header-value", "Federation has Header with Header Value iff that External System has Header with Header Value."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-header-with-header-value", "2026-10-22T12:00:02Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-authenticates-with-header", "ExternalSystemAuthenticatesWithHeader"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-authenticates-with-header", "FederationAuthenticatesWithHeader"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-authenticates-with-header", "Federation authenticates with Header iff that External System authenticates with Header."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-authenticates-with-header", "2026-10-22T12:00:03Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-credential-encoding", "ExternalSystemHasCredentialEncoding"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-credential-encoding", "FederationHasCredentialEncoding"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-credential-encoding", "Federation has Credential Encoding iff that External System has Credential Encoding."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-credential-encoding", "2026-10-22T12:00:04Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-prefix", "ExternalSystemHasPrefix"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-prefix", "FederationHasPrefix"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-prefix", "Federation has Prefix iff that External System has Prefix."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-prefix", "2026-10-22T12:00:05Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-kind", "ExternalSystemHasKind"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-kind", "FederationHasKind"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-kind", "Federation has Kind iff that External System has Kind."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-kind", "2026-10-22T12:00:06Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-object-type-is-backed-by-federation", "ObjectTypeIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-object-type-is-backed-by-federation", "ObjectTypeIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-object-type-is-backed-by-federation", "Object Type is backed by Federation iff that Object Type is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-object-type-is-backed-by-federation", "2026-10-22T12:00:07Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-function-is-backed-by-federation", "FunctionIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-function-is-backed-by-federation", "FunctionIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-function-is-backed-by-federation", "Function is backed by Federation iff that Function is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-function-is-backed-by-federation", "2026-10-22T12:00:08Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-domain-connects-to-federation", "DomainConnectsToExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-domain-connects-to-federation", "DomainConnectsToFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-domain-connects-to-federation", "Domain connects to Federation iff that Domain connects to External System."],
["MigrationHasTimestamp", "mig-2026-10-22-domain-connects-to-federation", "2026-10-22T12:00:09Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-domainconnectstofederation-has-send-mode", "DomainConnectsToExternalSystemHasSendMode"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-domainconnectstofederation-has-send-mode", "DomainConnectsToFederationHasSendMode"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-domainconnectstofederation-has-send-mode", "DomainConnectsToFederation has Send Mode iff that DomainConnectsToExternalSystem has Send Mode."],
["MigrationHasTimestamp", "mig-2026-10-22-domainconnectstofederation-has-send-mode", "2026-10-22T12:00:10Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-domainconnectstofederation-carries-secret-reference", "DomainConnectsToExternalSystemCarriesSecretReference"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-domainconnectstofederation-carries-secret-reference", "DomainConnectsToFederationCarriesSecretReference"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-domainconnectstofederation-carries-secret-reference", "DomainConnectsToFederation carries Secret Reference iff that DomainConnectsToExternalSystem carries Secret Reference."],
["MigrationHasTimestamp", "mig-2026-10-22-domainconnectstofederation-carries-secret-reference", "2026-10-22T12:00:11Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-citation-is-backed-by-federation", "CitationIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-citation-is-backed-by-federation", "CitationIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-citation-is-backed-by-federation", "Citation is backed by Federation iff that Citation is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-citation-is-backed-by-federation", "2026-10-22T12:00:12Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-federation'

Readings: arest/metamodel/federation.md. Target stores: every store.

```
Domain Change 'dc-2026-10-22-federation-federation' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-federation' targets Domain 'federation'.
Domain Change 'dc-2026-10-22-federation-federation' proposes Function 'mig-2026-10-22-federation-speaks-rest-dialect'.
Migration 'mig-2026-10-22-federation-speaks-rest-dialect' has Fact Type 'ExternalSystemSpeaksRESTDialect' as source.
Migration 'mig-2026-10-22-federation-speaks-rest-dialect' produces Fact Type 'FederationSpeaksRESTDialect' as target.
Migration 'mig-2026-10-22-federation-speaks-rest-dialect' has Migration Rule Text 'Federation speaks REST Dialect iff that External System speaks REST Dialect.'.
Migration 'mig-2026-10-22-federation-speaks-rest-dialect' has Timestamp '2026-10-22T12:00:13Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-federation", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-federation", "federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-federation", "mig-2026-10-22-federation-speaks-rest-dialect"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-speaks-rest-dialect", "ExternalSystemSpeaksRESTDialect"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-speaks-rest-dialect", "FederationSpeaksRESTDialect"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-speaks-rest-dialect", "Federation speaks REST Dialect iff that External System speaks REST Dialect."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-speaks-rest-dialect", "2026-10-22T12:00:13Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-ingest'

Readings: arest/metamodel/ingest.md. Target stores: every store.

```
Domain Change 'dc-2026-10-22-federation-ingest' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-ingest' targets Domain 'ingest'.
Domain Change 'dc-2026-10-22-federation-ingest' proposes Function 'mig-2026-10-22-webhook-event-type-belongs-to-federation'.
Migration 'mig-2026-10-22-webhook-event-type-belongs-to-federation' has Fact Type 'WebhookEventTypeBelongsToExternalSystem' as source.
Migration 'mig-2026-10-22-webhook-event-type-belongs-to-federation' produces Fact Type 'WebhookEventTypeBelongsToFederation' as target.
Migration 'mig-2026-10-22-webhook-event-type-belongs-to-federation' has Migration Rule Text 'Webhook Event Type belongs to Federation iff that Webhook Event Type belongs to External System.'.
Migration 'mig-2026-10-22-webhook-event-type-belongs-to-federation' has Timestamp '2026-10-22T12:00:14Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-ingest", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-ingest", "ingest"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-ingest", "mig-2026-10-22-webhook-event-type-belongs-to-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-webhook-event-type-belongs-to-federation", "WebhookEventTypeBelongsToExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-webhook-event-type-belongs-to-federation", "WebhookEventTypeBelongsToFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-webhook-event-type-belongs-to-federation", "Webhook Event Type belongs to Federation iff that Webhook Event Type belongs to External System."],
["MigrationHasTimestamp", "mig-2026-10-22-webhook-event-type-belongs-to-federation", "2026-10-22T12:00:14Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-security'

Readings: arest/metamodel/security.md. Target stores: every store.

```
Domain Change 'dc-2026-10-22-federation-security' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-security' targets Domain 'security'.
Domain Change 'dc-2026-10-22-federation-security' proposes Function 'mig-2026-10-22-federation-resolves-to-resolved-address'.
Migration 'mig-2026-10-22-federation-resolves-to-resolved-address' has Fact Type 'ExternalSystemResolvesToResolvedAddress' as source.
Migration 'mig-2026-10-22-federation-resolves-to-resolved-address' produces Fact Type 'FederationResolvesToResolvedAddress' as target.
Migration 'mig-2026-10-22-federation-resolves-to-resolved-address' has Migration Rule Text 'Federation resolves to Resolved Address iff that External System resolves to Resolved Address.'.
Migration 'mig-2026-10-22-federation-resolves-to-resolved-address' has Timestamp '2026-10-22T12:00:15Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-security", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-security", "security"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-security", "mig-2026-10-22-federation-resolves-to-resolved-address"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-resolves-to-resolved-address", "ExternalSystemResolvesToResolvedAddress"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-resolves-to-resolved-address", "FederationResolvesToResolvedAddress"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-resolves-to-resolved-address", "Federation resolves to Resolved Address iff that External System resolves to Resolved Address."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-resolves-to-resolved-address", "2026-10-22T12:00:15Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-api-products'

Readings: apps/auto.dev/api-products.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-api-products' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-api-products' targets Domain 'api-products'.
Domain Change 'dc-2026-10-22-federation-api-products' proposes Function 'mig-2026-10-22-api-product-is-backed-by-federation'.
Domain Change 'dc-2026-10-22-federation-api-products' proposes Function 'mig-2026-10-22-meter-event-is-backed-by-federation'.
Migration 'mig-2026-10-22-api-product-is-backed-by-federation' has Fact Type 'APIProductIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-api-product-is-backed-by-federation' produces Fact Type 'APIProductIsBackedByFederation' as target.
Migration 'mig-2026-10-22-api-product-is-backed-by-federation' has Migration Rule Text 'API Product is backed by Federation iff that API Product is backed by External System.'.
Migration 'mig-2026-10-22-api-product-is-backed-by-federation' has Timestamp '2026-10-22T12:00:16Z'.
Migration 'mig-2026-10-22-meter-event-is-backed-by-federation' has Fact Type 'MeterEventIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-meter-event-is-backed-by-federation' produces Fact Type 'MeterEventIsBackedByFederation' as target.
Migration 'mig-2026-10-22-meter-event-is-backed-by-federation' has Migration Rule Text 'Meter Event is backed by Federation iff that Meter Event is backed by External System.'.
Migration 'mig-2026-10-22-meter-event-is-backed-by-federation' has Timestamp '2026-10-22T12:00:17Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-api-products", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-api-products", "api-products"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-api-products", "mig-2026-10-22-api-product-is-backed-by-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-api-products", "mig-2026-10-22-meter-event-is-backed-by-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-api-product-is-backed-by-federation", "APIProductIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-api-product-is-backed-by-federation", "APIProductIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-api-product-is-backed-by-federation", "API Product is backed by Federation iff that API Product is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-api-product-is-backed-by-federation", "2026-10-22T12:00:16Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-meter-event-is-backed-by-federation", "MeterEventIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-meter-event-is-backed-by-federation", "MeterEventIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-meter-event-is-backed-by-federation", "Meter Event is backed by Federation iff that Meter Event is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-meter-event-is-backed-by-federation", "2026-10-22T12:00:17Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-apis-surface'

Readings: apps/auto.dev/apis-surface.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-apis-surface' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-apis-surface' targets Domain 'apis-surface'.
Domain Change 'dc-2026-10-22-federation-apis-surface' proposes Function 'mig-2026-10-22-api-endpoint-proxies-to-federation'.
Migration 'mig-2026-10-22-api-endpoint-proxies-to-federation' has Fact Type 'APIEndpointProxiesToExternalSystem' as source.
Migration 'mig-2026-10-22-api-endpoint-proxies-to-federation' produces Fact Type 'APIEndpointProxiesToFederation' as target.
Migration 'mig-2026-10-22-api-endpoint-proxies-to-federation' has Migration Rule Text 'API Endpoint proxies to Federation iff that API Endpoint proxies to External System.'.
Migration 'mig-2026-10-22-api-endpoint-proxies-to-federation' has Timestamp '2026-10-22T12:00:18Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-apis-surface", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-apis-surface", "apis-surface"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-apis-surface", "mig-2026-10-22-api-endpoint-proxies-to-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-api-endpoint-proxies-to-federation", "APIEndpointProxiesToExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-api-endpoint-proxies-to-federation", "APIEndpointProxiesToFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-api-endpoint-proxies-to-federation", "API Endpoint proxies to Federation iff that API Endpoint proxies to External System."],
["MigrationHasTimestamp", "mig-2026-10-22-api-endpoint-proxies-to-federation", "2026-10-22T12:00:18Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-cancellation'

Readings: apps/auto.dev/cancellation.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-cancellation' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-cancellation' targets Domain 'cancellation'.
Domain Change 'dc-2026-10-22-federation-cancellation' proposes Function 'mig-2026-10-22-federation-records-evidence-kind'.
Migration 'mig-2026-10-22-federation-records-evidence-kind' has Fact Type 'ExternalSystemRecordsEvidenceKind' as source.
Migration 'mig-2026-10-22-federation-records-evidence-kind' produces Fact Type 'FederationRecordsEvidenceKind' as target.
Migration 'mig-2026-10-22-federation-records-evidence-kind' has Migration Rule Text 'Federation records Evidence Kind iff that External System records Evidence Kind.'.
Migration 'mig-2026-10-22-federation-records-evidence-kind' has Timestamp '2026-10-22T12:00:19Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-cancellation", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-cancellation", "cancellation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-cancellation", "mig-2026-10-22-federation-records-evidence-kind"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-records-evidence-kind", "ExternalSystemRecordsEvidenceKind"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-records-evidence-kind", "FederationRecordsEvidenceKind"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-records-evidence-kind", "Federation records Evidence Kind iff that External System records Evidence Kind."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-records-evidence-kind", "2026-10-22T12:00:19Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-database-routing'

Readings: apps/auto.dev/database-routing.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-database-routing' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-database-routing' targets Domain 'database-routing'.
Domain Change 'dc-2026-10-22-federation-database-routing' proposes Function 'mig-2026-10-22-data-store-is-backed-by-federation'.
Migration 'mig-2026-10-22-data-store-is-backed-by-federation' has Fact Type 'DataStoreIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-data-store-is-backed-by-federation' produces Fact Type 'DataStoreIsBackedByFederation' as target.
Migration 'mig-2026-10-22-data-store-is-backed-by-federation' has Migration Rule Text 'Data Store is backed by Federation iff that Data Store is backed by External System.'.
Migration 'mig-2026-10-22-data-store-is-backed-by-federation' has Timestamp '2026-10-22T12:00:20Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-database-routing", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-database-routing", "database-routing"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-database-routing", "mig-2026-10-22-data-store-is-backed-by-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-data-store-is-backed-by-federation", "DataStoreIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-data-store-is-backed-by-federation", "DataStoreIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-data-store-is-backed-by-federation", "Data Store is backed by Federation iff that Data Store is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-data-store-is-backed-by-federation", "2026-10-22T12:00:20Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-eu-compliance'

Readings: apps/auto.dev/eu-compliance.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-eu-compliance' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-eu-compliance' targets Domain 'eu-compliance'.
Domain Change 'dc-2026-10-22-federation-eu-compliance' proposes Function 'mig-2026-10-22-meter-endpoint-is-provided-by-federation'.
Domain Change 'dc-2026-10-22-federation-eu-compliance' proposes Function 'mig-2026-10-22-federation-is-established-in-country-code'.
Migration 'mig-2026-10-22-meter-endpoint-is-provided-by-federation' has Fact Type 'MeterEndpointIsProvidedByExternalSystem' as source.
Migration 'mig-2026-10-22-meter-endpoint-is-provided-by-federation' produces Fact Type 'MeterEndpointIsProvidedByFederation' as target.
Migration 'mig-2026-10-22-meter-endpoint-is-provided-by-federation' has Migration Rule Text 'Meter Endpoint is provided by Federation iff that Meter Endpoint is provided by External System.'.
Migration 'mig-2026-10-22-meter-endpoint-is-provided-by-federation' has Timestamp '2026-10-22T12:00:21Z'.
Migration 'mig-2026-10-22-federation-is-established-in-country-code' has Fact Type 'ExternalSystemIsEstablishedInCountryCode' as source.
Migration 'mig-2026-10-22-federation-is-established-in-country-code' produces Fact Type 'FederationIsEstablishedInCountryCode' as target.
Migration 'mig-2026-10-22-federation-is-established-in-country-code' has Migration Rule Text 'Federation is established in Country Code iff that External System is established in Country Code.'.
Migration 'mig-2026-10-22-federation-is-established-in-country-code' has Timestamp '2026-10-22T12:00:22Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-eu-compliance", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-eu-compliance", "eu-compliance"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-eu-compliance", "mig-2026-10-22-meter-endpoint-is-provided-by-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-eu-compliance", "mig-2026-10-22-federation-is-established-in-country-code"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-meter-endpoint-is-provided-by-federation", "MeterEndpointIsProvidedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-meter-endpoint-is-provided-by-federation", "MeterEndpointIsProvidedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-meter-endpoint-is-provided-by-federation", "Meter Endpoint is provided by Federation iff that Meter Endpoint is provided by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-meter-endpoint-is-provided-by-federation", "2026-10-22T12:00:21Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-is-established-in-country-code", "ExternalSystemIsEstablishedInCountryCode"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-is-established-in-country-code", "FederationIsEstablishedInCountryCode"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-is-established-in-country-code", "Federation is established in Country Code iff that External System is established in Country Code."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-is-established-in-country-code", "2026-10-22T12:00:22Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-plans-subscriptions'

Readings: apps/auto.dev/plans-subscriptions.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-plans-subscriptions' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-plans-subscriptions' targets Domain 'plans-subscriptions'.
Domain Change 'dc-2026-10-22-federation-plans-subscriptions' proposes Function 'mig-2026-10-22-subscription-is-billed-by-federation'.
Migration 'mig-2026-10-22-subscription-is-billed-by-federation' has Fact Type 'SubscriptionIsBilledByExternalSystem' as source.
Migration 'mig-2026-10-22-subscription-is-billed-by-federation' produces Fact Type 'SubscriptionIsBilledByFederation' as target.
Migration 'mig-2026-10-22-subscription-is-billed-by-federation' has Migration Rule Text 'Subscription is billed by Federation iff that Subscription is billed by External System.'.
Migration 'mig-2026-10-22-subscription-is-billed-by-federation' has Timestamp '2026-10-22T12:00:23Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-plans-subscriptions", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-plans-subscriptions", "plans-subscriptions"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-plans-subscriptions", "mig-2026-10-22-subscription-is-billed-by-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-subscription-is-billed-by-federation", "SubscriptionIsBilledByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-subscription-is-billed-by-federation", "SubscriptionIsBilledByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-subscription-is-billed-by-federation", "Subscription is billed by Federation iff that Subscription is billed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-subscription-is-billed-by-federation", "2026-10-22T12:00:23Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-service-health'

Readings: apps/auto.dev/service-health.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-service-health' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-service-health' targets Domain 'service-health'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-log-entry-has-federation'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-federation-has-service-health'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-federation-has-service-health-status'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-object-type-has-alternate-federation'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-object-type-is-resolved-from-alternate-federation'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-incident-references-federation'.
Domain Change 'dc-2026-10-22-federation-service-health' proposes Function 'mig-2026-10-22-federation-has-retry-limit'.
Migration 'mig-2026-10-22-log-entry-has-federation' has Fact Type 'LogEntryHasExternalSystem' as source.
Migration 'mig-2026-10-22-log-entry-has-federation' produces Fact Type 'LogEntryHasFederation' as target.
Migration 'mig-2026-10-22-log-entry-has-federation' has Migration Rule Text 'Log Entry has Federation iff that Log Entry has External System.'.
Migration 'mig-2026-10-22-log-entry-has-federation' has Timestamp '2026-10-22T12:00:24Z'.
Migration 'mig-2026-10-22-federation-has-service-health' has Fact Type 'ExternalSystemHasServiceHealth' as source.
Migration 'mig-2026-10-22-federation-has-service-health' produces Fact Type 'FederationHasServiceHealth' as target.
Migration 'mig-2026-10-22-federation-has-service-health' has Migration Rule Text 'Federation has Service Health iff that External System has Service Health.'.
Migration 'mig-2026-10-22-federation-has-service-health' has Timestamp '2026-10-22T12:00:25Z'.
Migration 'mig-2026-10-22-federation-has-service-health-status' has Fact Type 'ExternalSystemHasServiceHealthStatus' as source.
Migration 'mig-2026-10-22-federation-has-service-health-status' produces Fact Type 'FederationHasServiceHealthStatus' as target.
Migration 'mig-2026-10-22-federation-has-service-health-status' has Migration Rule Text 'Federation has Service Health Status iff that External System has Service Health Status.'.
Migration 'mig-2026-10-22-federation-has-service-health-status' has Timestamp '2026-10-22T12:00:26Z'.
Migration 'mig-2026-10-22-object-type-has-alternate-federation' has Fact Type 'ObjectTypeHasAlternateExternalSystem' as source.
Migration 'mig-2026-10-22-object-type-has-alternate-federation' produces Fact Type 'ObjectTypeHasAlternateFederation' as target.
Migration 'mig-2026-10-22-object-type-has-alternate-federation' has Migration Rule Text 'Object Type has alternate- Federation iff that Object Type has alternate- External System.'.
Migration 'mig-2026-10-22-object-type-has-alternate-federation' has Timestamp '2026-10-22T12:00:27Z'.
Migration 'mig-2026-10-22-object-type-is-resolved-from-alternate-federation' has Fact Type 'ObjectTypeIsResolvedFromAlternateExternalSystem' as source.
Migration 'mig-2026-10-22-object-type-is-resolved-from-alternate-federation' produces Fact Type 'ObjectTypeIsResolvedFromAlternateFederation' as target.
Migration 'mig-2026-10-22-object-type-is-resolved-from-alternate-federation' has Migration Rule Text 'Object Type is resolved from alternate- Federation iff that Object Type is resolved from alternate- External System.'.
Migration 'mig-2026-10-22-object-type-is-resolved-from-alternate-federation' has Timestamp '2026-10-22T12:00:28Z'.
Migration 'mig-2026-10-22-incident-references-federation' has Fact Type 'IncidentReferencesExternalSystem' as source.
Migration 'mig-2026-10-22-incident-references-federation' produces Fact Type 'IncidentReferencesFederation' as target.
Migration 'mig-2026-10-22-incident-references-federation' has Migration Rule Text 'Incident references Federation iff that Incident references External System.'.
Migration 'mig-2026-10-22-incident-references-federation' has Timestamp '2026-10-22T12:00:29Z'.
Migration 'mig-2026-10-22-federation-has-retry-limit' has Fact Type 'ExternalSystemHasRetryLimit' as source.
Migration 'mig-2026-10-22-federation-has-retry-limit' produces Fact Type 'FederationHasRetryLimit' as target.
Migration 'mig-2026-10-22-federation-has-retry-limit' has Migration Rule Text 'Federation has Retry Limit iff that External System has Retry Limit.'.
Migration 'mig-2026-10-22-federation-has-retry-limit' has Timestamp '2026-10-22T12:00:30Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-service-health", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-service-health", "service-health"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-log-entry-has-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-federation-has-service-health"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-federation-has-service-health-status"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-object-type-has-alternate-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-object-type-is-resolved-from-alternate-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-incident-references-federation"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-service-health", "mig-2026-10-22-federation-has-retry-limit"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-log-entry-has-federation", "LogEntryHasExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-log-entry-has-federation", "LogEntryHasFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-log-entry-has-federation", "Log Entry has Federation iff that Log Entry has External System."],
["MigrationHasTimestamp", "mig-2026-10-22-log-entry-has-federation", "2026-10-22T12:00:24Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-service-health", "ExternalSystemHasServiceHealth"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-service-health", "FederationHasServiceHealth"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-service-health", "Federation has Service Health iff that External System has Service Health."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-service-health", "2026-10-22T12:00:25Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-service-health-status", "ExternalSystemHasServiceHealthStatus"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-service-health-status", "FederationHasServiceHealthStatus"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-service-health-status", "Federation has Service Health Status iff that External System has Service Health Status."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-service-health-status", "2026-10-22T12:00:26Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-object-type-has-alternate-federation", "ObjectTypeHasAlternateExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-object-type-has-alternate-federation", "ObjectTypeHasAlternateFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-object-type-has-alternate-federation", "Object Type has alternate- Federation iff that Object Type has alternate- External System."],
["MigrationHasTimestamp", "mig-2026-10-22-object-type-has-alternate-federation", "2026-10-22T12:00:27Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-object-type-is-resolved-from-alternate-federation", "ObjectTypeIsResolvedFromAlternateExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-object-type-is-resolved-from-alternate-federation", "ObjectTypeIsResolvedFromAlternateFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-object-type-is-resolved-from-alternate-federation", "Object Type is resolved from alternate- Federation iff that Object Type is resolved from alternate- External System."],
["MigrationHasTimestamp", "mig-2026-10-22-object-type-is-resolved-from-alternate-federation", "2026-10-22T12:00:28Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-incident-references-federation", "IncidentReferencesExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-incident-references-federation", "IncidentReferencesFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-incident-references-federation", "Incident references Federation iff that Incident references External System."],
["MigrationHasTimestamp", "mig-2026-10-22-incident-references-federation", "2026-10-22T12:00:29Z"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-federation-has-retry-limit", "ExternalSystemHasRetryLimit"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-federation-has-retry-limit", "FederationHasRetryLimit"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-federation-has-retry-limit", "Federation has Retry Limit iff that External System has Retry Limit."],
["MigrationHasTimestamp", "mig-2026-10-22-federation-has-retry-limit", "2026-10-22T12:00:30Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-stripe'

Readings: apps/auto.dev/stripe.md. Target stores: support, engineering (both compose arest-auto-dev), and auto.dev's own.

```
Domain Change 'dc-2026-10-22-federation-stripe' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-stripe' targets Domain 'stripe'.
Domain Change 'dc-2026-10-22-federation-stripe' proposes Function 'mig-2026-10-22-webhook-event-is-backed-by-federation'.
Migration 'mig-2026-10-22-webhook-event-is-backed-by-federation' has Fact Type 'WebhookEventIsBackedByExternalSystem' as source.
Migration 'mig-2026-10-22-webhook-event-is-backed-by-federation' produces Fact Type 'WebhookEventIsBackedByFederation' as target.
Migration 'mig-2026-10-22-webhook-event-is-backed-by-federation' has Migration Rule Text 'Webhook Event is backed by Federation iff that Webhook Event is backed by External System.'.
Migration 'mig-2026-10-22-webhook-event-is-backed-by-federation' has Timestamp '2026-10-22T12:00:31Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-stripe", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-stripe", "stripe"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-stripe", "mig-2026-10-22-webhook-event-is-backed-by-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-webhook-event-is-backed-by-federation", "WebhookEventIsBackedByExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-webhook-event-is-backed-by-federation", "WebhookEventIsBackedByFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-webhook-event-is-backed-by-federation", "Webhook Event is backed by Federation iff that Webhook Event is backed by External System."],
["MigrationHasTimestamp", "mig-2026-10-22-webhook-event-is-backed-by-federation", "2026-10-22T12:00:31Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-change-safety'

Readings: apps/engineering.auto.dev/readings/change-safety.md. Target stores: engineering.

```
Domain Change 'dc-2026-10-22-federation-change-safety' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-change-safety' targets Domain 'change-safety'.
Domain Change 'dc-2026-10-22-federation-change-safety' proposes Function 'mig-2026-10-22-test-reaches-federation'.
Migration 'mig-2026-10-22-test-reaches-federation' has Fact Type 'TestReachesExternalSystem' as source.
Migration 'mig-2026-10-22-test-reaches-federation' produces Fact Type 'TestReachesFederation' as target.
Migration 'mig-2026-10-22-test-reaches-federation' has Migration Rule Text 'Test reaches Federation iff that Test reaches External System.'.
Migration 'mig-2026-10-22-test-reaches-federation' has Timestamp '2026-10-22T12:00:32Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-change-safety", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-change-safety", "change-safety"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-change-safety", "mig-2026-10-22-test-reaches-federation"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-test-reaches-federation", "TestReachesExternalSystem"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-test-reaches-federation", "TestReachesFederation"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-test-reaches-federation", "Test reaches Federation iff that Test reaches External System."],
["MigrationHasTimestamp", "mig-2026-10-22-test-reaches-federation", "2026-10-22T12:00:32Z"]
]
```

## Domain Change 'dc-2026-10-22-federation-commerce'

Readings: apps/commerce/commerce.md. Target stores: commerce (not a resident).

```
Domain Change 'dc-2026-10-22-federation-commerce' has Rationale 'Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings.'.
Domain Change 'dc-2026-10-22-federation-commerce' targets Domain 'commerce'.
Domain Change 'dc-2026-10-22-federation-commerce' proposes Function 'mig-2026-10-22-status-notifies-federation-with-message-type'.
Migration 'mig-2026-10-22-status-notifies-federation-with-message-type' has Fact Type 'StatusNotifiesExternalSystemWithMessageType' as source.
Migration 'mig-2026-10-22-status-notifies-federation-with-message-type' produces Fact Type 'StatusNotifiesFederationWithMessageType' as target.
Migration 'mig-2026-10-22-status-notifies-federation-with-message-type' has Migration Rule Text 'Status notifies Federation with Message Type iff that Status notifies External System with Message Type.'.
Migration 'mig-2026-10-22-status-notifies-federation-with-message-type' has Timestamp '2026-10-22T12:00:33Z'.
```

```json
[
["DomainChangeHasRationale", "dc-2026-10-22-federation-commerce", "Sam, 2026-10-22: External System is renamed Federation, word for word, in all of its readings."],
["DomainChangeTargetsDomain", "dc-2026-10-22-federation-commerce", "commerce"],
["DomainChangeProposesFunction", "dc-2026-10-22-federation-commerce", "mig-2026-10-22-status-notifies-federation-with-message-type"],
["MigrationHasFactTypeAsSource", "mig-2026-10-22-status-notifies-federation-with-message-type", "StatusNotifiesExternalSystemWithMessageType"],
["MigrationProducesFactTypeAsTarget", "mig-2026-10-22-status-notifies-federation-with-message-type", "StatusNotifiesFederationWithMessageType"],
["MigrationHasMigrationRuleText", "mig-2026-10-22-status-notifies-federation-with-message-type", "Status notifies Federation with Message Type iff that Status notifies External System with Message Type."],
["MigrationHasTimestamp", "mig-2026-10-22-status-notifies-federation-with-message-type", "2026-10-22T12:00:33Z"]
]
```

