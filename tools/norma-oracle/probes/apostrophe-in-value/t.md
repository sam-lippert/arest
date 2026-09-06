# An apostrophe inside a quoted value
### "the metamodel's types": the instance-fact scanner paired quotes with
### '([^']*)', so the Description ended at "metamodel" and " s types are
### populated BY" became predicate words -- stored truncated, reported
### nowhere (#96). ExtractSentences and LiteralRx already treat a quote with
### a letter straight after it as a possessive; the value scanner now does
### the same. An EVEN number of inner apostrophes used to split the value
### into extra roles and change the arity instead. The rule's one blind
### spot is a possessive of a name ending in s followed by a space
### ("Chris' plan"): that quote is followed by a space and closes the value,
### which is what an escape would be for -- not written here.

## Entity Types
Domain(.name) is an entity type.
Plan(.name) is an entity type.
Description is a value type.
Tier is a value type.
  The possible values of Tier are 'Sam's Tier', 'plain'.

## Fact Types
Domain has Description.
  Each Domain has at most one Description.
Plan has Tier.

## Instance Facts
Domain 'instances' has Description 'The instance level, the population the metamodel's types are populated BY, and what a Fact is of a Function means'.
Domain 'two' has Description 'Sam's plan and Chris's plan, both of them'.
Plan 'free' has Tier 'Sam's Tier'.
