#!/bin/sh
# One station, one case, one process. Factored out of stations.sh so the case
# loop can run through xargs -P: the isolation the case table needs is the
# PROCESS boundary -- a deliberate bottom row dies alone and a refusal is
# visible per case -- and nothing about that requires the cases to be in
# sequence. Serial, 514 cases at ~2s was the whole case phase.
#
#   sh onecase.sh <station> <case>     with E and O exported
s="$1"
c="$2"
case "$s" in
  js)   v=$(cd "$E" && bun "$O/js.g.js" case "$c" 2>/dev/null) ;;
  java) v=$(cd "$E/tools/java-runner" && java -cp . Program case "$c" 2>/dev/null) ;;
  cs)   v=$(cd "$E/tools/cs-runner" && ./bin/Debug/net8.0/cs-runner.exe case "$c" 2>/dev/null) ;;
  rust) v=$(cd "$E/tools/rust-station" && ./target/debug/arest-station.exe case "$c" 2>/dev/null) ;;
esac
[ -n "$v" ] || v="<refused>"
printf '%s=%s\n' "$c" "$v"
