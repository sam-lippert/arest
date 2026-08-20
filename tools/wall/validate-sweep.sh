#!/bin/sh
# Run the validate differential over EVERY compiled app and report which ones
# the two hosts disagree about. The single-app differential found a live
# deontic divergence on the first store it was pointed at; this is the same
# question asked of the whole corpus.
#
#   sh tools/wall/validate-sweep.sh [seconds-per-app] [apps-dir]
#
# An app that exceeds its budget is reported SLOW, not PASS: a differential
# that silently counts a timeout as agreement is the same failure as one that
# compares a host with itself.
BUDGET="${1:-180}"
DIR="${2:-C:/Users/lippe/Repos/apps}"
E="$(cd "$(dirname "$0")/../.." && pwd)"
AGREE=0; DIFFER=0; SLOW=0; ERR=0

for store in "$DIR"/*/*.store.json; do
  [ -e "$store" ] || continue
  app="$(basename "$(dirname "$store")")"
  out="$(timeout "$BUDGET" sh "$E/tools/wall/validate-differential.sh" "$app" "$DIR" 2>&1)"
  rc=$?
  if [ "$rc" = "124" ]; then
    SLOW=$((SLOW + 1)); echo "SLOW    $app (over ${BUDGET}s, not measured)"
  elif [ "$rc" = "0" ]; then
    AGREE=$((AGREE + 1)); echo "AGREE   $app -- $(echo "$out" | head -1)"
  elif echo "$out" | grep -q "VALIDATE DIFFERS"; then
    DIFFER=$((DIFFER + 1)); echo "DIFFER  $app"; echo "$out" | sed -n '2,8p' | sed 's/^/        /'
  else
    ERR=$((ERR + 1)); echo "ERROR   $app -- $(echo "$out" | tail -2 | tr '\n' ' ')"
  fi
done

echo "---"
echo "agree $AGREE / differ $DIFFER / slow $SLOW / error $ERR"
[ "$DIFFER" = "0" ]
