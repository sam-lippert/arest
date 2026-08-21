#!/bin/sh
# store-vs-tables over every compiled app: does each store agree with its own
# projected 3NF tables? The single-app differential found two defects on the
# first two stores it was pointed at; this is the same question asked of the
# corpus.
#
#   sh tools/wall/store-sweep.sh [seconds-per-app] [apps-dir]
#
# AN APP THAT DID NOT PRODUCE A SUMMARY IS AN ERROR, NOT A PASS. The first
# version of this counted "no FLAGS lines" as agreement, so eleven apps whose
# stores RecursionError on load were reported OK -- the quiet-skip shape that
# makes a differential worse than none. Classification keys off the summary
# line the tool prints, so a crash cannot read as agreement.
#
# FRESH=1 projects each store into an EMPTY db with the CURRENT code and
# compares that, instead of comparing against the db as it sits on disk. The
# on-disk dbs were projected by whatever code was current when they were last
# compiled, so after a projection fix they answer the OLD question. Nothing is
# written to any app: --fresh builds its db elsewhere.
BUDGET="${1:-180}"
EXTRA=""
[ -n "$FRESH" ] && EXTRA="--fresh"
DIR="${2:-C:/Users/lippe/Repos/apps}"
E="$(cd "$(dirname "$0")/../.." && pwd)"
OK=0; FLAG=0; ERR=0; SLOW=0; PARKED=0

for store in "$DIR"/*/*.store.json; do
  [ -e "$store" ] || continue
  app="$(basename "$(dirname "$store")")"
  case "$(basename "$store")" in
    "$app.store.json") ;;
    *) PARKED=$((PARKED + 1)); echo "PARKED  $app"; continue ;;
  esac
  out="$(cd "$E" && timeout "$BUDGET" python tools/wall/store-vs-tables.py "$app" "$DIR" $EXTRA 2>&1)"
  rc=$?
  if [ "$rc" = "124" ]; then
    SLOW=$((SLOW + 1)); echo "SLOW    $app (over ${BUDGET}s, not measured)"
  elif ! echo "$out" | grep -q "own-table fact types:"; then
    ERR=$((ERR + 1))
    echo "ERROR   $app -- $(echo "$out" | grep -oE '[A-Za-z]*Error[^ ]*' | tail -1)"
  elif echo "$out" | grep -qE '^(DIFFERS|ABSORBED|NO TABLE|NO KEY|NO COLUMN)'; then
    FLAG=$((FLAG + 1)); echo "FLAGS   $app"
    echo "$out" | grep -E '^(DIFFERS|ABSORBED|NO TABLE|NO KEY|NO COLUMN)' \
      | head -4 | sed 's/^/        /'
  else
    OK=$((OK + 1)); echo "OK      $app -- $(echo "$out" | tail -2 | tr '\n' ' ')"
  fi
done

echo "---"
echo "agree $OK / flags $FLAG / error $ERR / slow $SLOW / parked $PARKED"
[ "$FLAG" = "0" ] && [ "$ERR" = "0" ]
