#!/bin/sh
# regress.sh - run norma-oracle over the five corpora and compare with a baseline.
#
#   tools/norma-oracle/regress.sh <out-dir> [baseline-dir]
#
# Every corpus runs in its own directory under <out-dir>, because the oracle
# writes its carriers (design-state, norma-answer, verbalization-report.*)
# into the working directory. Each corpus directory then holds:
#   out.txt        the oracle's full output
#   built.names    built derivation-rule heads, sorted, WITH multiplicity
#                  (a head with two rules yields two lines; counts hide a
#                  dropped rule, names do not)
#   built.lines    the same lines with the arm description
#   unbuilt.txt    every UNBUILT line
#   errors.txt     NORMA's blocking model errors
#   errors.count   their total
#
# With a baseline, one line per corpus: built by name (+new/-lost), blocking
# errors, and whether the carriers are byte-identical. Lost heads, new heads,
# and changed errors are listed under the line. Without a baseline, the run
# IS the baseline: point the next run at it.
#
#   AREST and APPS override the repository roots.
set -u

A=${AREST:-C:/Users/lippe/Repos/arest}
R=${APPS:-C:/Users/lippe/Repos/apps}
EXE="$A/tools/norma-oracle/bin/Debug/norma-oracle.exe"
OUT=${1:?usage: regress.sh <out-dir> [baseline-dir]}
BASE=${2:-}

corpora="metamodel autodev kernel support eulaw"

dirs_for() {
  case $1 in
    metamodel) echo "$A/metamodel" ;;
    autodev)   echo "$A/metamodel $R/auto.dev $R/law-core/readings" ;;
    kernel)    echo "$A/metamodel $R/kernel/readings" ;;
    support)   echo "$A/metamodel $R/support.auto.dev/readings $R/law-core/readings $R/us-law/readings" ;;
    eulaw)     echo "$A/metamodel $R/eu-law/readings $R/law-core/readings" ;;
  esac
}

run_one() {
  c=$1; d="$OUT/$c"
  mkdir -p "$d"
  ( cd "$d" && "$EXE" $(dirs_for "$c") > out.txt 2>&1 )
  tr -d '\r' < "$d/out.txt" > "$d/out.lf"
  sed -n '/^== derivation rules built/,/^== /p' "$d/out.lf" | grep ' := ' | sed 's/^ *//' | sort > "$d/built.lines"
  sed 's/ := .*//' "$d/built.lines" > "$d/built.names"
  grep '^  UNBUILT (' "$d/out.lf" | sed 's/^ *//' | sort > "$d/unbuilt.txt"
  sed -n '/^== NORMA model errors ==/,/^== /p' "$d/out.lf" | grep '^      - ' | sed 's/^ *- //' | sort > "$d/errors.txt"
  n=$(grep -o 'TOTAL BLOCKING ERRORS: [0-9]*' "$d/out.lf" | grep -o '[0-9]*$')
  echo "${n:-0}" > "$d/errors.count"
  rm -f "$d/out.lf"
}

mkdir -p "$OUT"
for c in $corpora; do run_one "$c" & done
wait

for c in $corpora; do
  d="$OUT/$c"
  nb=$(wc -l < "$d/built.names" | tr -d ' ')
  ne=$(cat "$d/errors.count")
  if [ -z "$BASE" ]; then
    printf '%-9s built %3s  errors %s\n' "$c" "$nb" "$ne"
    grep -h 'UNBUILT SUMMARY' "$d/out.txt" | tr -d '\r' | sed 's/^ */    /'
    continue
  fi
  b="$BASE/$c"
  if [ ! -f "$b/built.names" ]; then
    printf '%-9s no baseline at %s\n' "$c" "$b"
    continue
  fi
  ob=$(wc -l < "$b/built.names" | tr -d ' ')
  oe=$(cat "$b/errors.count")
  new=$(comm -13 "$b/built.names" "$d/built.names" | wc -l | tr -d ' ')
  lost=$(comm -23 "$b/built.names" "$d/built.names" | wc -l | tr -d ' ')
  carriers=IDENTICAL
  for f in design-state norma-answer; do
    cmp -s "$b/$f" "$d/$f" || carriers=DIFFER
  done
  printf '%-9s built %3s -> %3s (+%s/-%s)  errors %s -> %s  carriers %s\n' \
    "$c" "$ob" "$nb" "$new" "$lost" "$oe" "$ne" "$carriers"
  comm -23 "$b/built.names" "$d/built.names" | sed 's/^/    lost: /'
  comm -13 "$b/built.names" "$d/built.names" | sed 's/^/    new:  /'
  comm -3 "$b/errors.txt" "$d/errors.txt" | sed 's/^\t/    error now:  /; t; s/^/    error gone: /'
done
