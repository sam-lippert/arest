# AREST Agents: AI Behavioral Entities

## Entity Types

# The model an agent runs on is the AI Model: `Model` alone is the car model
# wherever this template meets auto.dev (`Model(.Name)`, Year Make Model Trim),
# and two concepts sharing a name is a kind conflict the oracle settles by
# keeping the first declaration (Sam, 2026-09-10: "AI Model is good for the
# llm one"; a domain outside our control that insists on a conflicting name
# is namespaced instead).
AI Model(.code) is an entity type.
Agent Definition(.id) is an entity type.
Agent(.id) is an entity type.
# The subtype link moved here from metamodel/core.md on 2026-09-17 (Sam: "I
# want to pull Agent out into a module. That doesn't seem core."). Core said
# `Agent is an entity type` and this line and nothing else -- NO core fact type
# ever took an Agent role -- and the reference mode was already this file's, so
# `.id` did not move and identification does not change. This line did have to
# come with it: `Agent is for Object Type Instance` below is a fact type, not a
# subtyping, so without this declaration `Agent 'claude'` stops being an Object
# Type Instance and every mixin fact over the one id space goes with it.
Agent is a subtype of Object Type Instance.
Completion(.id) is an entity type.

## Value Types

# Declared nowhere until 2026-09-07: `Agent Definition has Prompt` built over
# an undeclared Prompt, so no instance of it could ever land and every Agent
# Definition violated `has exactly one Prompt` from the moment it existed.
Prompt is a value type.
  The data type of Prompt is largeText.

## Readings

### AI Model
AI Model has Name.
  Each AI Model has exactly one Name.

### Agent Definition
Agent Definition belongs to Domain.
  Each Agent Definition belongs to exactly one Domain.

Agent Definition has Name.
  Each Agent Definition has exactly one Name.

Agent Definition uses AI Model.
  Each Agent Definition uses exactly one AI Model.

Agent Definition has Prompt.
  Each Agent Definition has exactly one Prompt.

### Agent
Agent is instance of Agent Definition.
  Each Agent is instance of exactly one Agent Definition.

Agent is for Object Type Instance.
  Each Agent is for at most one Object Type Instance.

### Completion
Completion belongs to Agent.
  Each Completion belongs to exactly one Agent.

Completion has input Text.
  Each Completion has exactly one input Text.

Completion has output Text.
  Each Completion has at most one output Text.

Completion occurred at Timestamp.
  Each Completion occurred at exactly one Timestamp.

### Predicate connection
Predicate invokes Agent Definition.
  Each Predicate invokes at most one Agent Definition.

<!--
  Engine wiring: when a Predicate invokes an Agent Definition, the verb
  name resolves to `Func::Platform(name)` in DEFS. The handler
  (installed per-target via `arest::externals` / `install_platform_fn`
  or `install_async_platform_fn`) walks the Agent Definition's `uses
  AI Model` + `has Prompt` facts to assemble the request, calls the
  model, and writes the resulting `Completion` cell. No separate
  agent-dispatch machinery — the same `Func::Platform` path serves
  every external function (LLMs, HTTP APIs, hardware sensors).

  Targets that don't install a handler (e.g. the bare kernel) see
  `Object::Bottom` for the call — graceful skip, not a panic.
-->


## Instance Facts

Domain 'agents' has Access 'public'.
