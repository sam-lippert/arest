# js-runner — the one thin runner

Seven stations died of the same disease at different speeds: host code.
First it was fallback lists and guards; at the end it was mode dispatch —
every canon operation teaching eight hosts a new argv branch. The cure is
structural. This runner is the whole fleet now, and it can never grow.

**The host contract, final:** the canon's `main` takes `⟨store, args⟩`
and answers `⟨text, ok⟩`. The tail converts argv to atoms, evaluates
`main`, prints the text atom verbatim, and exits by the flag:

    const out = Ev("main", [CELLS, process.argv.slice(2)]);
    console.log(out[0]);
    process.exit(out[1] === "T" ? 0 : 1);

That is the entire host surface. All dispatch (base report, app report,
solve, loud refusal of unknown modes) and ALL rendering (every output
line) live in canon `main:`. A new operation is a canon edit, never a
host edit. If you are about to add a branch to the tail, stop — that is
precisely how the last runners died.

    npm run build           && bun composed.g.js          # base: 24 laws
    npm run build:order     && bun composed.g.js app      # an app's 10 laws
    npm run build:sherlock  && bun composed.g.js solve    # the solve narrative
    bun build.js mcp --run                                # the MCP server, on stdio
    bun composed.g.js regress                             # the run against its record

`regress` is law:regress over the run's own outcome (`state:built`,
`state:errors`, `state:readback`, three surfaces the oracle writes into
`design-state`) and a recorded expectation composed in as the carrier
`expected` beside `design-state` (optional, like `compiled` and `journal`;
`AREST_OUT_DIR` puts the composed module beside them). Three rows, then the
heads lost and new. That is the corpus check of tools/norma-oracle-tests.

The composed modules (`*.g.js`) are build products and are not tracked,
so anything that starts one must compose it first. The MCP entry in the
repository's `.mcp.json` runs `build.js mcp --run`, which composes from
the current canon and carriers and then starts the module on the same
stdio (the size line and the boot timings go to stderr; stdout is the
protocol channel). A module started directly can be days old: the one the
harness started on 2026-09-03 took two minutes to boot, past the client's
thirty-second limit, where a current one boots in about eight seconds,
most of it the derivation closure (`boot: derived` on stderr says how much).

`head.part.js` is the strict μ, unchanged from the certified fleet era
(selector-on-atom throws, duplicate DEF throws, compare-across-kinds
throws, Backus ⊥ on `tl`/`tlr`/`1r`/`INSERT` of the empty sequence).
The compose step is byte concatenation; bun execs the composed file;
nothing is read, eval'd, or interpreted at runtime.

The fourth carrier is the JOURNAL (Def 6's emit leg): an append-only
argument list whose open paren lives in `mid3.part.js` and whose close
lives in `mid4.part.js`, so the journal file itself is nothing but
appended entries — `,\n\nDEF("journal:n", address)` — and an empty
journal is an empty file. Entries are written by the registered
`store:append` (the one durable write a container owns); their bytes,
names, and sequence are canon (`ui:jentry`, `ui:jname`, `ui:jcount`),
and `ui:boot` replays the journal cells through `ui:apply`/`ui:create`
in file order, so a fired transition survives recomposition — the
continuity law, certified two boots at a time.

The certification story after the reset: the NORMA oracle remains the
independent semantic anchor, and any second μ — a redeployed station
from git history, or muc regenerated against this same contract — must
reproduce this runner's printed atoms byte-for-byte. The deleted fleet
lives in git (`87ad3e7` and earlier) should a dispute ever need a
second opinion; its evidentiary work (eight evaluators, byte-identical
across five languages) is banked in the ledger.
