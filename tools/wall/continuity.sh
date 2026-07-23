#!/bin/sh
# THE CONTINUITY LAW (two-boot; Def 6's emit leg certified): fire ->
# emit through the registered store:append -> recompose -> the status
# holds; then a second fire across a second reboot. Canon's own eq is
# the judgment; the harness only drives the boots. Runs on a SCRATCH
# journal so the app's store of record stays untouched.
#   sh continuity.sh [app]          (default sherlock)
APP=${1:-sherlock}
case "$APP" in
  order)  export CONT_TYPE="Sale"; export CONT_ID="o1" ;;
  family) export CONT_TYPE=""; export CONT_ID="" ;;
esac
W="$(cd "$(dirname "$0")" && pwd)"
E="$W/../.."
J="$W/journal.test"
G="$W/cont.g.js"
: > "$J"
export CONT_JOURNAL="$J"
compose() {
  cat "$E/tools/js-runner/head.part.js" "$E/arest" \
      "$E/tools/js-runner/mid1.part.js" "$E/apps/$APP/design-state" \
      "$E/tools/js-runner/mid2.part.js" "$E/apps/$APP/norma-answer" \
      "$E/tools/js-runner/mid3.part.js" "$J" \
      "$E/tools/js-runner/mid4.part.js" "$W/cont-tail.part.js" > "$G"
}
echo "=== BOOT A (pristine; fire #1) ==="
compose
bun "$G" fire | tee "$W/contA.txt"
ST1=$(grep "^after:" "$W/contA.txt" | sed 's/after: \([a-z]*\) .*/\1/')
echo "=== BOOT B (replay #1; expect $ST1; fire #2) ==="
compose
bun "$G" fire "$ST1" | tee "$W/contB.txt"
ST2=$(grep "^after:" "$W/contB.txt" | sed 's/after: \([a-z]*\) .*/\1/')
if [ -z "$ST2" ]; then ST2="$ST1"; fi
echo "=== BOOT C (replay all; expect $ST2; retract fire #2) ==="
compose
bun "$G" retract "$ST2" journal:2 | tee "$W/contC.txt"
ST3=$(grep "^after:" "$W/contC.txt" | sed 's/after: \([a-z]*\) .*/\1/')
echo "=== BOOT D (replay with retraction; expect $ST3) ==="
compose
bun "$G" check "$ST3" | tee "$W/contD.txt"
echo "=== JOURNAL BYTES ==="
cat "$J"
echo ""
if grep -q "CONTINUITY: F" "$W/contB.txt" "$W/contC.txt" "$W/contD.txt"; then
  echo "CONTINUITY LAW: BROKEN"; exit 1
fi
if [ "$ST3" = "$ST1" ] && grep -q "CONTINUITY: T" "$W/contB.txt" \
   && grep -q "CONTINUITY: T" "$W/contC.txt" && grep -q "CONTINUITY: T" "$W/contD.txt"; then
  echo "CONTINUITY LAW: HOLDS (retraction reverts to $ST1 and survives reboot)"; exit 0
fi
echo "CONTINUITY LAW: INCOMPLETE"; exit 1
