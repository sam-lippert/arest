# java-runner — the second thin μ, and the GUI container

Two containers. The console one runs over the certified strict μ
(`Arest.java`, mirroring the js-runner's head point for point); the Swing
one is a platform over the serving host's `navigate`. No law semantics, no
mode names, no rendering decisions live here; if a guard or a name list ever
appears in this directory, delete it — accretion is how the first fleet died.

    javac -encoding UTF-8 Arest.java Reader.java Program.java Gui.java GuiSnapshot.java
    java -cp . Program [mode…]     # console container: THE HOST CONTRACT
    AREST_PORT=8787 java -cp . Gui # the Swing platform over a serving host
    AREST_PORT=8787 java -Djava.awt.headless=true -cp . GuiSnapshot <dir>

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
- **The one call**: `POST /navigate` on the serving host, the request
  `<stacks, address, widths, registered, defaults, from>` and the answer
  `<stacks, style, panes, unpaired, alert>`. A write is a request of the
  same interface: a form's Submit sends its values with its link
  (IListView.Submit) and main:api commits or refuses it, the refusal drawn
  as the IAlert.
- **The stacks**, its form factor (master and detail), carried from one
  answer to the next request.

The pairing is lambda's: each request carries the names registered here and
`law:unpaired` answers over them, so a frame naming one is a refusal to
draw. Nothing here boots a store, validates or persists. `GuiSnapshot`
drives the same container with no window and writes each frame it draws to
a PNG.

## The linker (`compose.py`) — the one honest deviation

C#, js, and python accept the lambda's one tuple literal whole; the JVM
caps a method's bytecode at 64KB, so the lambda cannot compile as a single
call. `compose.py` is a real program but SYNTAX ONLY: it counts parens
and quotes, splits the tuple at top-level commas into slice methods, and
hoists oversized balanced subexpressions into helpers. It never inspects
a name and never evaluates anything; every lambda byte appears verbatim in
the generated `Composed.g.java` (class `Composed extends Arest`, so the
lambda's unqualified `DEF/A/N/K/PHI/S1..S9` resolve by inheritance).
