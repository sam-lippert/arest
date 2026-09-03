# An objectification declared before its fact, then used as one player

Plan(.Name) is an entity type.
API(.Name) is an entity type.
Price Per Call is a value type.
Plan Product objectifies "Plan includes API".

## Readings

Plan includes API.
  Each Plan, API combination occurs at most once in the population of Plan includes API.
Plan Product has Price Per Call.

## Constraints

Each Plan Product has at most one Price Per Call.
