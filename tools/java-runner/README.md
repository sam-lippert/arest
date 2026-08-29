# java-runner — the second thin μ, and the GUI container

Two containers over one certified strict μ (`Arest.java`, mirroring the
js-runner's head point for point). No law semantics, no mode names, no
rendering decisions live here; if a guard or a name list ever appears in
this directory, delete it — accretion is how the first fleet died.

    javac -encoding UTF-8 Arest.java Reader.java Program.java Gui.java
    java -cp . Program [mode…]     # console container: THE HOST CONTRACT
    java -cp . Gui                 # GUI container: registered components

There is no compose step. Both containers READ the canon and the carriers at
runtime through `Reader`, so a canon edit needs no rebuild — and canon stays
STATE, which AREST.tex:59 requires of D: a station holding it as object code
cannot be handed a different one. `compose.py` produced a 2.16 MB
`Composed.g.java` that javac chewed on every edit, because the JVM caps a method
at 64 KB and the canon is one 1.1 MB tuple. A parser has no such cap.

## Program — the console container

The host contract, final: convert argv to atoms, evaluate canon `main`,
print the one text atom (plus `"\n"` — never `println`, whose platform
separator would break byte parity), exit by the flag. Six lines, no
branches, forever. Certified byte-identical to `bun composed.g.js` on the
same carriers: base 53 laws, app 10, solve, explain, and the unknown-mode
refusal with exit 1.

## Gui — the GUI container (MonoCross made structural)

One map, every container: a console and a GUI differ only in registered
render functions. The canon's `ui:screen ⟨store, event⟩` answers the
abstract element tree — `⟨menu, ⟨⟨button, label, event⟩…⟩⟩` plus
`⟨text, content⟩` — and this container walks it with REGISTERED toolkit
implementations (`registerComponents()`: menu → JPanel, button → JButton
firing its canon-emitted event atom, text → monospace JTextArea). The
host holds exactly ONE piece of platform state, the last event atom;
which buttons exist, what an event means, what text shows, and how an
unknown mode is refused are all canonical (`ui:modes` is the mode
registry as data; a registry miss passes the raw event to `main`, so the
refusal is main's own). An unregistered element name throws — strictness,
not semantics. Extending the UI is a canon edit plus, at most, one
registration.

## The linker (`compose.py`) — the one honest deviation

C#, js, and python accept the canon's one tuple literal whole; the JVM
caps a method's bytecode at 64KB, so the canon cannot compile as a single
call. `compose.py` is a real program but SYNTAX ONLY: it counts parens
and quotes, splits the tuple at top-level commas into slice methods, and
hoists oversized balanced subexpressions into helpers. It never inspects
a name and never evaluates anything; every canon byte appears verbatim in
the generated `Composed.g.java` (class `Composed extends Arest`, so the
canon's unqualified `DEF/A/N/K/PHI/S1..S9` resolve by inheritance).
