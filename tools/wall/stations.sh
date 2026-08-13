#!/bin/sh
# THE STATIONS LAW: every canonical runner answers the same. Compose the
# SAME canon and the SAME carriers for each station, evaluate canon's own
# law:report on each, and hold the printed atoms byte-identical. Canon
# judges (every verdict printed is a law's own T/F); this harness only
# drives the boots and diffs the bytes — "a byte of drift is a broken
# wall" (README). A station that is not installed is reported as skipped,
# never as passing.
#
# ALL THREE STATIONS ARE GREEN AND BYTE-IDENTICAL (2026-08-06). They were
# not: js answered in ~50s while java and cs each ran past 20 minutes on the
# base carriers without printing a law. No station prints incrementally —
# the whole report is one atom printed at the end — so "printed nothing"
# always meant "did not finish", never "made no progress".
#
# The cause was not canon. The js head carried TWO evaluator optimizations
# the other heads lacked ENTIRELY: the pure-application memo (EVMEMO /
# memoable) and FASTPRIMS (14 compiled theta: list cells). Neither is
# semantics — both are extensional equals of canon DEFs, and byte-identity
# is what certifies that. Controls on the js station, same canon bytes:
#     memo ON,  FASTPRIMS ON   ->  49.7s, all 53 laws, exit 0
#     memo OFF, FASTPRIMS ON   ->  killed at 120s, ZERO laws printed
#     memo ON,  FASTPRIMS OFF  ->  killed at 300s, ZERO laws printed
# Both necessary, neither sufficient — which reproduced the java/cs symptom
# exactly. This is the C64 doctrine's own case: a long leg indicts the
# evaluator, so memo pure applications in the head and certify identical.
#
# Both landed in Arest.java and Mu.cs, and the base report now agrees to the
# byte across all three (md5 1219ce08..., 1664 bytes, 53 laws, exit 0):
#     js 49.7s   ·   java 29.7s   ·   cs 80.1s
# So the default is all three. A station that is not installed prints as
# SKIPPED, never as a pass.
# The rust station is CERTIFIED (53 laws, byte-identical to js on the base
# carriers) but is NOT in the default set: its build is minutes, not seconds,
# because rustc has no variadics and LLVM will not finish one 1.7 MB include!d
# expression. compose.py splits the canon into chunk fns, which fixed the
# canon, but the carriers hold single DEFs megabytes wide and still need java
# compose.py's other trick — hoisting oversized balanced subexpressions into
# helpers. Until that lands, ask for it explicitly.
#   sh stations.sh [app]                       (default base, js java cs)
#   AREST_STATIONS="js java cs rust" sh stations.sh
# THE CARRIERS ARE GENERATED, AND A STALE ONE HIDES DRIFT. design-state and
# norma-answer are gitignored artifacts that norma-oracle builds from
# metamodel/*.md; NORMA is the authority for metamodels, verbalizations and
# RMAP (Halpin/Curland), so norma-answer IS the reference answer the norma*
# laws are held to. A copy left on disk from an older metamodel makes the wall
# green against a model nobody is editing any more: three domains (imports,
# ingest, layout) had been added and never validated, and the wall could not
# see it. Regenerating exposed 6 failing laws, every one a real defect:
#   - three `Domain 'X' has Access 'public'.` instances left live, where every
#     other domain file comments that line out (the fact type was ruled out)
#   - the only 4-ary fact type in the metamodel declared its uniqueness in a
#     phrasing used nowhere else, so no 3-role UC was built and NORMA raised
#     NMinusOneError — one BLOCKING error, which made its RMAP meaningless
#   - two subtype definitions written `*Each X is by definition a Y that ...`
#     instead of the accepted `* Each X is a Y that ...` (Halpin Fig 13.29,
#     which core.md's own comment already quoted)
#   - canon's rules:metamodel still named seven fact types Resource*, a
#     metamodel rename to Object Type Instance that canon never followed
# The norma-oracle README carries the ruling that decides all of these:
# "all verbalizations are canonical, and divergences of form move the SOURCE
# toward the canonical phrasing" — the metamodel moves, not the harness.
# So: regenerate the carriers when the metamodel changes, and never read a
# green wall as green if they are older than metamodel/*.md.
#     cd tools/norma-oracle && dotnet build && ./bin/Debug/norma-oracle.exe ../../metamodel
APP=${1:-base}
# rust-station JOINS THE DEFAULT (2026-08-10). It was opt-in, and the cost of
# that was exact: when the cross-host case table was wired into js, java and cs,
# rust-station was skipped, and no run could report it -- conjunct 2 sat at 3/4
# looking finished. Turning it on printed "rust: 102 refused, 0 answered", which
# is not disagreement but total silence: a station that cannot see the questions.
# An optional station is an unchecked station. Cost is not the argument for
# leaving it out: the 102 cases take 13s (the rust binary is the FASTEST of the
# four to start), and cargo rebuilds range from seconds when only an include!d
# carrier changed to ~4 min when main.rs itself does -- against ~11 min once for
# a cold build. Measured, not estimated; earlier guesses here were wrong by two
# orders of magnitude in both directions.
WANT=${AREST_STATIONS:-js java cs rust}
want() { case " $WANT " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
W="$(cd "$(dirname "$0")" && pwd)"
E="$W/../.."
if [ "$APP" = "base" ]; then D="$E/tools/norma-oracle"
elif [ -d "$E/apps/$APP" ]; then D="$E/apps/$APP"
else D="$E/../apps/$APP"; fi
O="$W/stations.out"
mkdir -p "$O"
RC=0
STATIONS=""

# --- js station: byte concatenation, exec'd by bun, never eval'd -------
if want js && command -v bun >/dev/null 2>&1; then
  G="$O/js.g.js"
  cat "$E/tools/js-runner/head.part.js" "$E/arest" \
      "$E/tools/js-runner/midcases.part.js" "$E/engine/shared/scenarios.canon" \
      "$E/tools/js-runner/mid1.part.js" "$D/design-state" \
      "$E/tools/js-runner/mid2.part.js" "$D/norma-answer" \
      "$E/tools/js-runner/mid3.part.js" "$D/journal" \
      "$E/tools/js-runner/mid4.part.js" "$E/tools/js-runner/tail.part.js" > "$G"
  bun "$G" > "$O/js.txt" 2>&1; JS=$?; [ $JS -eq 0 ] || RC=1
  STATIONS="$STATIONS js"
  echo "=== js  ($(grep -c 'law OK:' "$O/js.txt") laws, exit $JS) ==="
  tail -1 "$O/js.txt"
else
  want js && echo "=== js  SKIPPED (bun not installed) ===" \
          || echo "=== js  not requested ==="
fi

# --- java station: compose.py is syntax-only (JVM 64KB method cap) -----
if want java && command -v javac >/dev/null 2>&1; then
  # Compiled IN PLACE and run with -cp . on purpose: javac and java are
  # Windows binaries, and a POSIX -d path ("/c/Users/...") is parsed as an
  # option switch, which fails with "use -help for a list of possible
  # options". The .class files are already ignored (*.class).
  ( cd "$E/tools/java-runner" \
    && python compose.py "$E/arest" "$D/design-state" "$D/norma-answer" \
         "$D/journal" Composed.g.java "$E/engine/shared/scenarios.canon" >/dev/null \
    && javac -encoding UTF-8 Arest.java Program.java Composed.g.java \
    && java -cp . Program ) > "$O/java.txt" 2>&1 || RC=1
  STATIONS="$STATIONS java"
  echo "=== java ($(grep -c 'law OK:' "$O/java.txt") laws) ==="
  tail -1 "$O/java.txt"
else
  want java && echo "=== java SKIPPED (javac not installed) ===" \
            || echo "=== java not requested (dark: see header) ==="
fi

# --- cs station: compose is copy /b inside the csproj, then compiled ---
if want cs && command -v dotnet >/dev/null 2>&1; then
  ( cd "$E/tools/cs-runner" && dotnet run ) > "$O/cs.txt" 2>&1 || RC=1
  STATIONS="$STATIONS cs"
  echo "=== cs   ($(grep -c 'law OK:' "$O/cs.txt") laws) ==="
  tail -1 "$O/cs.txt"
else
  want cs && echo "=== cs   SKIPPED (dotnet not installed) ===" \
          || echo "=== cs   not requested (dark: see header) ==="
fi

# --- rust station: compose.py is syntax-only (no variadics; LLVM chunking) ---
if want rust && command -v cargo >/dev/null 2>&1; then
  ( cd "$E/tools/rust-station" \
    && python compose.py --split "$E/arest" src/canon.g.rs >/dev/null \
    && python compose.py --split "$E/engine/shared/scenarios.canon" src/scenarios.g.rs >/dev/null \
    && python compose.py --split "$D/design-state" src/design-state.g.rs >/dev/null \
    && python compose.py --split "$D/norma-answer" src/norma-answer.g.rs >/dev/null \
    && cargo build -q \
    && ./target/debug/arest-station.exe ) > "$O/rust.txt" 2>&1 || RC=1
  STATIONS="$STATIONS rust"
  echo "=== rust ($(grep -c 'law OK:' "$O/rust.txt") laws) ==="
  tail -1 "$O/rust.txt"
else
  want rust && echo "=== rust SKIPPED (cargo not installed) ===" \
            || echo "=== rust not requested ==="
fi

# --- the stations law: byte-identical printed atoms --------------------
REF=""
for s in $STATIONS; do
  if [ -z "$REF" ]; then REF="$s"; continue; fi
  if cmp -s "$O/$REF.txt" "$O/$s.txt"; then
    echo "STATIONS AGREE: $s == $REF (byte-identical)"
  else
    echo "STATION DRIFT: $s != $REF"
    diff "$O/$REF.txt" "$O/$s.txt" | head -20
    RC=1
  fi
done
[ -n "$STATIONS" ] || { echo "NO STATION RAN"; RC=1; }

# --- THE BASE LAW: every station answers the shared case table alike --------
# The law report certifies stations against EACH OTHER, and the four were
# transliterated js -> java -> cs -> rust from one ancestor, so byte-identity
# among them is INVARIANT under an error they all inherited. It cannot see a
# wrong base. That is not hypothetical: strip_prefix carried an unsourced
# strictly-longer guard on all four stations at once, implode refused numbers
# on two, and three engine kernels were missing the whole char family — none
# of it visible to a report the laws never route through.
#
# engine/shared/scenarios.canon is the one artifact both lineages read, so
# running it HERE is what joins them. Canon judges (main's `case` mode fetches
# the row, applies it and renders it with system:show); this only drives the
# boots and diffs the bytes. ONE INVOCATION PER CASE on purpose: the table
# holds deliberate BOTTOM rows, no canon def can branch on bottom, and a fold
# would die at the first one — per invocation a station's refusal is visible
# at the boundary. A refusal normalises to <refused> because the observation
# is THAT a host refused; the message text is each host's own and always
# differs. Skip with AREST_CASES=0.
if [ "${AREST_CASES:-1}" = "1" ] && [ -n "$STATIONS" ]; then
  CASES=$(grep -o 'DEF("case:[^"]*"' "$E/engine/shared/scenarios.canon" \
          | sed 's/DEF("//; s/"$//')
  NC=$(printf '%s\n' "$CASES" | grep -c .)
  echo "=== base: $NC cases x stations ==="
  for s in $STATIONS; do
    : > "$O/cases.$s.txt"
    for c in $CASES; do
      case "$s" in
        js)   v=$(cd "$E" && bun "$O/js.g.js" case "$c" 2>/dev/null) ;;
        java) v=$(cd "$E/tools/java-runner" && java -cp . Program case "$c" 2>/dev/null) ;;
        cs)   v=$(cd "$E/tools/cs-runner" && ./bin/Debug/net8.0/cs-runner.exe case "$c" 2>/dev/null) ;;
        rust) v=$(cd "$E/tools/rust-station" && ./target/debug/arest-station.exe case "$c" 2>/dev/null) ;;
      esac
      [ -n "$v" ] || v="<refused>"
      printf '%s=%s\n' "$c" "$v" >> "$O/cases.$s.txt"
    done
    echo "  $s: $(grep -c '=<refused>' "$O/cases.$s.txt") refused, $(grep -vc '=<refused>' "$O/cases.$s.txt") answered"
  done
  CREF=""
  for s in $STATIONS; do
    if [ -z "$CREF" ]; then CREF="$s"; continue; fi
    if cmp -s "$O/cases.$CREF.txt" "$O/cases.$s.txt"; then
      echo "BASE AGREES: $s == $CREF (all $NC cases byte-identical)"
    else
      echo "BASE DRIFT: $s != $CREF"
      diff "$O/cases.$CREF.txt" "$O/cases.$s.txt" | head -20
      RC=1
    fi
  done
fi
exit $RC
