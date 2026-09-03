#!/bin/sh
# probes.sh - run each minimal model under probes/ through norma-oracle ALONE
# and compare its rule verbalizations and blocking-error count with expected.txt.
#
#   tools/norma-oracle/probes.sh [--record] [probe-name ...]
#
# A probe is a directory probes/<name>/ holding one small reading (t.md) with
# distinct types, so NORMA's naming is unambiguous, and expected.txt:
#   line 1        errors N          NORMA's blocking model errors
#   then          every UNBUILT line the oracle printed, with its reason
#   then          every rule block  the verbalization of each derived head,
#                                   from its marker line to the blank line
# An expected.txt of ONE line checks the error count only; that is how a
# known wrong build is kept red until it is fixed.
#
# --record writes what the oracle produced as expected.txt. Read it first:
# a probe records the meaning you verified, not whatever came out.
#
# Scratch output goes under _reports/probes/<name>/ (out.txt, the carriers,
# actual.txt, diff.txt). AREST overrides the repository root.
set -u

A=${AREST:-C:/Users/lippe/Repos/arest}
EXE="$A/tools/norma-oracle/bin/Debug/norma-oracle.exe"
P="$A/tools/norma-oracle/probes"
SCRATCH=${PROBE_SCRATCH:-$A/_reports/probes}

record=0
if [ "${1:-}" = "--record" ]; then record=1; shift; fi
names=${*:-$(ls "$P")}

fail=0
for n in $names; do
  d="$SCRATCH/$n"
  mkdir -p "$d"
  ( cd "$d" && "$EXE" "$P/$n" > out.txt 2>&1 )
  errs=$(tr -d '\r' < "$d/out.txt" | grep -o 'TOTAL BLOCKING ERRORS: [0-9]*' | grep -o '[0-9]*$')
  {
    echo "errors ${errs:-0}"
    tr -d '\r' < "$d/out.txt" | grep '^  UNBUILT (' | sed 's/^ *//'
    tr -d '\r' < "$d/out.txt" | grep -E '^  READ-BACK (MISMATCH|NO PATH)' | sed 's/^ *//'
    tr -d '\r' < "$d/verbalization-report.txt" | awk '/^[*+]+[A-Z]/{p=1} p{print} p&&/^$/{p=0}'
  } > "$d/actual.txt"
  if [ $record = 1 ]; then
    cp "$d/actual.txt" "$P/$n/expected.txt"
    echo "recorded $n"; cat "$d/actual.txt"
    continue
  fi
  if [ ! -f "$P/$n/expected.txt" ]; then
    echo "NO EXPECTED $n"; fail=1; continue
  fi
  if [ "$(wc -l < "$P/$n/expected.txt" | tr -d ' ')" -le 1 ]; then
    head -1 "$d/actual.txt" > "$d/actual.head"
    if diff -u "$P/$n/expected.txt" "$d/actual.head" > "$d/diff.txt"; then echo "PASS $n"; else echo "FAIL $n"; cat "$d/diff.txt"; fail=1; fi
    continue
  fi
  if diff -u "$P/$n/expected.txt" "$d/actual.txt" > "$d/diff.txt"; then
    echo "PASS $n"
  else
    echo "FAIL $n"; cat "$d/diff.txt"; fail=1
  fi
done
exit $fail
