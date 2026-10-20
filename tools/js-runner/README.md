# js-runner: the thin JS host

A peer of `tools/java-runner`, written from the same rows. A host brings Backus's primitives, the registrations
`metamodel/resolution.md` declares, and a way in; everything else is lambda. There is no memo and no twin here: a
strategy a host keeps is one every other host must keep too, so speed belongs in lambda.

- `arest.js`: the vocabulary and the strict mu. Lambda is read as what it is in JS: `LAMBDA` before the file's one
  parenthesized literal makes it a call, and `DEF`, `A`, `N`, `K`, `PHI` and `S1`..`S9` are bound to this host's
  functions. Each constructor is held to its name, so `S3` with four elements is refused, as the Java reader refuses
  it. A number is a 64-bit integer (a BigInt held to 64 bits, as Java's Long is). `AREST_PROFILE=<file>` writes a
  profile of lambda's own names; under it, a throw names the innermost cells.
- `registrations.js`: one body per registered Function lambda applies: the clock, `round`, the files,
  `module:root`, the crypt rows, `hook:seal`, and the SQLite engine (bun's `bun:sqlite`).
- `program.js`: the command line. It prints what lambda's `main` answers over the cells and the arguments, and exits
  by its verdict.

      bun program.js <address...>        # as java Program <address...>

- `serve.js`: one app's store over MCP on stdio. It builds the JSON-RPC envelopes around lambda's answers
  (`mcp:instructions`, `mcp:tools_json`, `main:as`, `mcp:call`, `mcp:prompts`, `mcp:prompt`, `mcp:prompt_description`,
  `mcp:not_committed`) and writes nothing of its own. Over the same store its answers are Java's, byte for byte.

      bun serve.js <app .check directory>                        # as java Serve <dir>
      bun serve.js <app .check directory> --call <tool> <json>   # one call, answered on stdout

`AREST_LAMBDA`, `AREST_TESTS`, `AREST_SCENARIOS` and `AREST_CARRIERS` name the files, as for the Java host.

The `registry/` directory is the router's own readings and store.
