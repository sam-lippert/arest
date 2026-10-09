# java-runner — the second thin μ, and the GUI container

Two containers. The console one runs over the certified strict μ
(`Arest.java`, mirroring the js-runner's head point for point); the Swing
one is a platform over the serving host's `navigate`. No law semantics, no
mode names, no rendering decisions live here; if a guard or a name list ever
appears in this directory, delete it — accretion is how the first fleet died.

    javac -encoding UTF-8 Arest.java Reader.java Program.java Gui.java GuiSnapshot.java TransportCheck.java
    java -cp . Program [mode…]     # console container: THE HOST CONTRACT
    AREST_PORT=8787 java -cp . Gui # the Swing platform over a serving host
    AREST_PORT=8787 java -Djava.awt.headless=true -cp . GuiSnapshot <dir> [<pane>=<address>|<pane>@<button>]…
    AREST_PORT=8787 java -cp . TransportCheck   # local and remote answer the same bytes

There is no compose step. The console container READS the lambda and the carriers at
runtime through `Reader`, so a lambda edit needs no rebuild — and lambda stays
STATE, which AREST.tex:59 requires of D: a station holding it as object code
cannot be handed a different one. `compose.py` produced a 2.16 MB
`Composed.g.java` that javac chewed on every edit, because the JVM caps a method
at 64 KB and the lambda is one 1.1 MB tuple. A parser has no such cap.

## Program — the console container

The host contract, final: convert argv to atoms, evaluate lambda `main`,
print the one text atom (plus `"\n"` — never `println`, whose platform
separator would break byte parity), exit by the flag. Six lines, no
branches, forever. Certified byte-identical to `bun composed.g.js` on the
same carriers: base 53 laws, app 10, solve, explain, and the unknown-mode
refusal with exit 1.

## Gui — the Swing platform (#124)

A platform is a shim that registers its paired controls, hands each event
to lambda and draws what lambda answers (Sam, 2026-09-20), and Sam,
2026-10-01: a registration surface per platform, any host language through
the same one. `Gui.java` is the Java one, the sibling of ui.do's
`src/render`:

- **The registration**: one Swing widget per iFactr interface lambda places,
  `render:<kind>` for the nineteen (`WIDGETS`), and its own layout engine,
  `render:swing` (`screen`), which draws a screen's placed rows at the
  rectangles lambda gave them inside the view's chrome.
- **Its IPlatformDefaults**: the look and feel's own fonts and the iFactr
  margins, so lambda places and measures for this platform.
- **The one call**: `navigate`, the request
  `<stacks, address, widths, registered, defaults, from, app>` and the answer
  `<stacks, style, panes, unpaired, alert>`. A write is a request of the
  same interface: a form's Submit sends its values with its link
  (IListView.Submit) and main:api commits or refuses it, the refusal drawn
  as the IAlert. `AREST_APP` is the App the container opens at (lambda roots
  every navigation there); `AREST_CALLER` is who is signed in, sent as the
  serving host's `x-arest-caller`, so a transition fired here names them as
  its actor.
- **Its transport**, a registration (`AREST_TRANSPORT`, remote unless set):
  `remote` is `POST /navigate` on a serving host (`AREST_SERVE`, or
  `AREST_PORT` on this machine); `local` is lambda in this process, the
  store read from a carriers directory (`AREST_LAMBDA`, `AREST_SCENARIOS`,
  `AREST_CARRIERS`, as Program reads them), booted as the js host boots one
  (FILE, then the closure) and asked the same `main:api` the serving host
  asks. Both answer the same bytes (`TransportCheck`). Local is not usable
  yet: this evaluator takes about 20 minutes to close even the base store,
  where the js host takes about a second.
- **The stacks**, its form factor (master and detail), carried from one
  answer to the next request.

The pairing is lambda's: each request carries the names registered here and
`ui:unpaired` answers over them, so a frame naming one is a refusal to
draw. Nothing here validates or persists. `GuiSnapshot` drives the same
container with no window and writes each frame it draws to a PNG; a step
written `<pane>@<title>` clicks the button of that title, as a person would.

## The admin path: the Swing UI against a serving host

An admin approves drafts in this container, against the JS host serving the
app's store. Two commands, one per terminal:

    # 1. serve the store (here, support's; the module is built from the current lambda)
    cd apps/support.auto.dev && AREST_PORT=8946 bun run serve

    # 2. the Swing UI against it, opened at the App, signed in as its Admin
    cd arest/tools/java-runner && javac -encoding UTF-8 Arest.java Reader.java Gui.java
    AREST_PORT=8946 AREST_APP=support AREST_CALLER=<admin email> java -cp . Gui

**Live support sends real email.** On the live store, Approve on a draft fires
`Admin approves Support Response`, and the performer sends the reply through
the connection the store declares. Try it on a copy first:

    mkdir <copy> && sqlite3 apps/support.auto.dev/.check/store.db "VACUUM INTO '<copy>/store.db'"
    cp apps/support.auto.dev/.check/{design-state,compiled,norma-answer,outcome,expectation} <copy>/
    cd arest/tools/js-runner && env -u AREST_MASTER_KEY AREST_CARRIERS=<copy> AREST_OUT_DIR=<copy> AREST_STORE_DB=<copy>/store.db AREST_PORT=8946 bun build.js serve --run

A copy of the live store keeps live's connections, so fence it before the
first write: make every connection it declares dry, which resolves a send and
records what it would carry without sending it, and serve it without
`AREST_MASTER_KEY`, so no sealed credential can be unsealed:

    curl -s http://127.0.0.1:8946/DomainConnectsToExternalSystemHasSendMode          # the connections
    curl -s -X PUT -H 'content-type: application/json' -d '["support.gmail","dry"]' http://127.0.0.1:8946/DomainConnectsToExternalSystemHasSendMode

On the retention copies, which declare no Send Mode at all, Approve answered
201 and recorded the approval, and the draft stayed at Draft, since approve is
guarded by the send succeeding. Without
`AREST_CALLER` the same click is refused with the alert "... needs its Admin".
Serve a store from one process at a time: the MCP router serves the same
store when asked, and two processes each hold their own copy of it.

## The linker (`compose.py`) — the one honest deviation

C#, js, and python accept the lambda's one tuple literal whole; the JVM
caps a method's bytecode at 64KB, so the lambda cannot compile as a single
call. `compose.py` is a real program but SYNTAX ONLY: it counts parens
and quotes, splits the tuple at top-level commas into slice methods, and
hoists oversized balanced subexpressions into helpers. It never inspects
a name and never evaluates anything; every lambda byte appears verbatim in
the generated `Composed.g.java` (class `Composed extends Arest`, so the
lambda's unqualified `DEF/A/N/K/PHI/S1..S9` resolve by inheritance).
