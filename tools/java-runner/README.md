# java-runner — the composed checker, Java parity station

The third independent μ, beside `tools/cs-runner` and `tools/js-runner`.
Same doctrine: the laws are canon DEFs, never host code; the canon and the
carriers appear AS SOURCE in the generated `Composed.g.java`, are COMPILED
by javac, and the class files are then just exec'd — nothing is read,
eval'd, or interpreted at runtime. `Composed extends Arest`, so the canon's
unqualified `DEF/A/N/K/PHI/S1..S9` resolve by inheritance — Java's version
of the "one extra name" join the doctrine promised.

    python compose.py ../../arest ../norma-oracle/design-state ../norma-oracle/norma-answer Composed.g.java
    javac -encoding UTF-8 Arest.java Program.java Composed.g.java
    java -cp . Program            # base: law:report (22 laws), exit 0 iff all T
    java -cp . Program app        # after composing an app's carriers: law:app_report

## The one honest deviation: the linker is a real program

C#, js, and python accept the canon's one tuple literal whole, so those
stations compose by byte concatenation (`copy /b`). The JVM class-file
format does not: a method's bytecode is capped at 64KB, and the largest
single carrier item alone (state:fts) is ~53KB of source. `compose.py` is
therefore a real linker — but SYNTAX ONLY: it counts parens and quotes,
splits the tuple at top-level commas into slice methods (registration order
kept), and hoists oversized balanced subexpressions into helper methods.
It never inspects a name and never evaluates anything; every canon byte
appears verbatim in the generated source. Hoisting is evaluation-order-safe
because Java evaluates arguments left to right and every hoisted
subexpression is a pure constructor call. Typical output: ~33 slices, ~14
helpers.

## Strictness, mirrored

`Arest.java` mirrors `cs-runner/{Vocabulary,Mu}.cs` point for point, and
throws in the same six places (probe-verified, write-then-deleted):
selector-on-atom, selector-out-of-range, compare-across-atom-kinds,
duplicate-DEF, unresolved-atom, and `tl`/`tlr`/`1r`/`INSERT` on the empty
sequence (Backus 11.2.3: ⊥). If a guard or a name list ever appears in
this station, delete it — accretion is how the first two js runners died.

## The parity it joins

Four-way, all fresh in one pass: NORMA validates the model (0 errors, nf
zero divergence) and emits the carriers; the C# μ, the js μ (under bun —
JavaScriptCore), and this μ (HotSpot) each hold all 22 base laws and 10 app
laws per app over the same bytes, with byte-identical verdict output
(diffs empty, line endings aside). `schema-match` holding under all three
is three independent evaluators agreeing the canon reproduces NORMA's
relational mapping. Under a canon mutation (`induce:reset_pair` made
identity) all three μ flip the same two laws (`induce-exactness`,
`induce-facts-emitted`) byte-identically; the canon restores
sha256-identical. Wall-clock for the base report: java ~10s, bun ~22s,
node ~26s, dotnet ~57s.

`Composed.g.java`, `*.class`, and the parity captures are generated and
untracked.
