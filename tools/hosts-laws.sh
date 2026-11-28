#!/bin/sh
# The laws through every host: the kernel's own (kernel.tests, through each host's program, as
# tools/java-runner/kernel-laws.sh runs them on Java) and, given a list, lambda's (arest.tests, each law over
# the booted base, through each host's law run). Each host answers alone; agreement is every host answering
# T for every law, and the table says which did not.
#
#   sh tools/hosts-laws.sh [lambda-law-list] [host...]
#
# Hosts: java js cs rust wasm (all by default), jstrict (Java with AREST_NO_TWINS and AREST_NO_MEMO: lambda as the
# other hosts run it, with no memo and no twin to hide a cost), and solidity: the contracts lambda generates, built and tested
# by forge (contracts/). The base is tools/base (AREST_CARRIERS to change it): build it
# with Java's compile-store of the metamodel, as its README says. Each host is built first where it builds.
# Output goes to tools/.laws/<host>.<suite>.out; the summary prints laws answered, T and seconds.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
out="$here/.laws"; mkdir -p "$out"
list="${1:-}"; [ $# -gt 0 ] && shift
hosts="${*:-java js cs rust wasm}"
base="${AREST_CARRIERS:-$root/tools/base}"
J="$root/tools/lib/sqlite-jdbc.jar;$root/tools/lib/slf4j-api.jar"

build() {
  case "$1" in
    java|jstrict) (cd "$root/tools/java-runner" && javac -nowarn -cp "../lib/junit-platform-console-standalone.jar;../lib/sqlite-jdbc.jar;../lib/slf4j-api.jar;." *.java) ;;
    cs) (cd "$root/tools/cs-runner" && dotnet build -c Release -v q -o bin/hosts >/dev/null && dotnet build laws -c Release -v q -o laws/bin/hosts >/dev/null) ;;
    rust) (cd "$root/tools/rust-host" && cargo build --release -q) ;;
    wasm) (cd "$root/tools/rust-host" && cargo rustc --release -q --lib --target wasm32-unknown-unknown --crate-type cdylib --no-default-features) ;;
  esac
}

program() {   # the host's six-line contract, from its own directory
  case "$1" in
    java) (cd "$root/tools/java-runner" && java -Xss512m -Xmx6g -cp "$J;." Program) ;;
    jstrict) (cd "$root/tools/java-runner" && AREST_NO_TWINS=1 AREST_NO_MEMO=1 java -Xss512m -Xmx6g -cp "$J;." Program) ;;
    js) (cd "$root/tools/js-runner" && bun program.js) ;;
    cs) (cd "$root/tools/cs-runner" && dotnet bin/hosts/cs-runner.dll) ;;
    rust) (cd "$root/tools/rust-host" && ./target/release/arest-host) ;;
    wasm) (cd "$root/tools/rust-host" && bun wasm.js) ;;
  esac
}

lawrun() {    # the host's law run over the booted base
  case "$1" in
    java) (cd "$root/tools/java-runner" && java -Xss512m -Xmx6g -cp "$J;." Laws "$2") ;;
    jstrict) (cd "$root/tools/java-runner" && AREST_NO_TWINS=1 AREST_NO_MEMO=1 java -Xss512m -Xmx6g -cp "$J;." Laws "$2") ;;
    js) (cd "$root/tools/js-runner" && bun laws.js "$2") ;;
    cs) (cd "$root/tools/cs-runner" && dotnet laws/bin/hosts/cs-laws.dll "$2") ;;
    rust) (cd "$root/tools/rust-host" && ./target/release/arest-laws "$2") ;;
    wasm) (cd "$root/tools/rust-host" && bun wasm.js --laws "$2") ;;
  esac
}

printf "%-6s %-7s %6s %6s %8s\n" host suite laws T seconds
for h in $hosts; do
  if [ "$h" = solidity ]; then
    s=$(date +%s)
    (cd "$root/contracts" && forge test) > "$out/solidity.forge.out" 2>&1
    printf "%-6s %-7s %6s %6s %8s
" sol forge "$(grep -c '^\[\(PASS\|FAIL\)' "$out/solidity.forge.out")" "$(grep -c '^\[PASS' "$out/solidity.forge.out")" "$(( $(date +%s) - s ))"
    continue
  fi
  build "$h" || { echo "$h: build failed"; continue; }
  s=$(date +%s)
  ( export AREST_LAMBDA="$root/kernel" AREST_TESTS="$root/kernel.tests" AREST_SCENARIOS="$root/kernel.forms" AREST_CARRIERS="$base"; program "$h" ) > "$out/$h.kernel.out" 2>&1
  printf "%-6s %-7s %6s %6s %8s\n" "$h" kernel "$(grep -c ' [TF]$' "$out/$h.kernel.out")" "$(grep -c ' T$' "$out/$h.kernel.out")" "$(( $(date +%s) - s ))"
  if [ -n "$list" ]; then
    s=$(date +%s)
    ( export AREST_LAMBDA="$root/arest" AREST_TESTS="$root/arest.tests" AREST_SCENARIOS="$root/engine/shared/scenarios.canon" AREST_CARRIERS="$base"; lawrun "$h" "$list" ) > "$out/$h.lambda.out" 2>&1
    printf "%-6s %-7s %6s %6s %8s\n" "$h" lambda "$(grep -cE '^test:' "$out/$h.lambda.out")" "$(grep -cE '^test:[^ ]+ T ' "$out/$h.lambda.out")" "$(( $(date +%s) - s ))"
  fi
done
