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

# CORPORA narrows the run: the three small corpora take about two minutes,
# the three closures that carry us-law take the oracle over an hour each.
corpora=${CORPORA:-"metamodel autodev kernel support eulaw uslaw"}

# A corpus is an app's readings closure as its package.json declares it
# (auto.dev depends on law-core and us-law; support on auto.dev, law-core,
# us-law and arest's templates; eu-law and us-law on law-core), always with
# the metamodel first. The oracle reads ONE directory level, and a library
# keeps its domains in subdirectories (us-law: 65 of 67 files), so every
# directory under a library's readings is passed. Until 2026-09-03 the
# support and auto.dev corpora here carried none of us-law's statutory
# readings and support carried files it does not import.
tree_of() {
  find "$1" -type d | sed 's|^/c/|C:/|'
}
dirs_for() {
  case $1 in
    metamodel) echo "$A/metamodel" ;;
    kernel)    echo "$A/metamodel $R/kernel/readings" ;;
    autodev)   echo "$A/metamodel $R/auto.dev $R/law-core/readings $(tree_of "$R/us-law/readings")" ;;
    support)   echo "$A/metamodel $R/support.auto.dev/readings $R/auto.dev $R/law-core/readings $(tree_of "$R/us-law/readings") $A/readings/templates" ;;
    eulaw)     echo "$A/metamodel $R/eu-law/readings $R/law-core/readings" ;;
    uslaw)     echo "$A/metamodel $(tree_of "$R/us-law/readings") $R/law-core/readings" ;;
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
  # the read-back gate: paths that read as none of their head's rules, plus
  # built rules no path reads; both are wrong builds NORMA did not object to
  rb=$(grep -o 'READ-BACK SUMMARY: .*' "$d/out.lf" | grep -oE '[0-9]+ MISMATCH' | grep -oE '^[0-9]+')
  rbn=$(grep -o 'READ-BACK SUMMARY: .*' "$d/out.lf" | grep -oE '[0-9]+ built rule' | grep -oE '^[0-9]+')
  echo "$(( ${rb:-0} + ${rbn:-0} ))" > "$d/readback.count"
  grep -E '^  READ-BACK (MISMATCH|NO PATH)' "$d/out.lf" | sed 's/^ *//' | sort > "$d/readback.txt"
  # a run that died is not a run with zero errors
  grep -m1 -E 'Unhandled Exception|^   at Arest\.NormaOracle\.Program' "$d/out.lf" > "$d/crash" || true
  rm -f "$d/out.lf"
}

mkdir -p "$OUT"
for c in $corpora; do run_one "$c" & done
wait

for c in $corpora; do
  d="$OUT/$c"
  nb=$(wc -l < "$d/built.names" | tr -d ' ')
  ne=$(cat "$d/errors.count")
  nr=$(cat "$d/readback.count")
  if [ -s "$d/crash" ]; then
    printf '%-9s CRASHED after %s mapped files: %s\n' "$c" "$(grep -c '^mapped:' "$d/out.txt")" "$(cut -c1-140 "$d/crash")"
    continue
  fi
  if [ -z "$BASE" ]; then
    printf '%-9s built %3s  errors %s  read-back %s\n' "$c" "$nb" "$ne" "$nr"
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
  # A carrier can differ by ORDER alone: the oracle's emission of app corpora
  # is not reproducible run to run (NORMA-minted implied fact types and the
  # oracle's own minted twins land in enumeration order), while the metamodel
  # has stayed byte-identical. So a difference is classified: the same
  # multiset of elements in another order is "order only"; anything else is
  # "content", which is the finding.
  carriers=IDENTICAL
  for f in design-state norma-answer; do
    if [ ! -f "$b/$f" ] || [ ! -f "$d/$f" ]; then carriers="NO CARRIERS TO COMPARE"; break; fi
    if ! cmp -s "$b/$f" "$d/$f"; then
      kind=$(python "$A/tools/norma-oracle/carrier-kind.py" "$b/$f" "$d/$f")
      if [ "$kind" = "content" ]; then carriers="DIFFER (content)"; elif [ "$carriers" = IDENTICAL ]; then carriers="DIFFER (order only)"; fi
    fi
  done
  or=$(cat "$b/readback.count" 2>/dev/null || echo '?')
  printf '%-9s built %3s -> %3s (+%s/-%s)  errors %s -> %s  read-back %s -> %s  carriers %s\n' \
    "$c" "$ob" "$nb" "$new" "$lost" "$oe" "$ne" "$or" "$nr" "$carriers"
  comm -23 "$b/built.names" "$d/built.names" | sed 's/^/    lost: /'
  comm -13 "$b/built.names" "$d/built.names" | sed 's/^/    new:  /'
  comm -3 "$b/errors.txt" "$d/errors.txt" | sed 's/^\t/    error now:  /; t; s/^/    error gone: /'
done
