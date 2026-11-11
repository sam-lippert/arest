#!/bin/sh
# The kernel's own laws (kernel.tests), through this host's command line as it stands.
#
#   sh tools/java-runner/kernel-laws.sh
#
# The kernel is written to run alone: kernel.forms brings the two forms it needs,
# kernel is SYSTEM, and kernel.tests holds its laws and a `main` that applies each
# to the cells and prints its name with its answer. Loaded beside lambda that
# `main` is a second definition of lambda's, which the reader refuses, so the
# three files go where the command line reads lambda, the case table and the
# scenarios. Program is unchanged: it prints what `main` answers and exits 0
# where every law answered T.
#
# The laws read the base a compile-store of the metamodel wrote: AREST_CARRIERS,
# tools/base unless set. They leave nothing in the working folder. About 40 s.
#
# THE SOURCES ARE COMPILED FIRST, as test.sh compiles them. The classes are
# ignored build output and nothing else rebuilds them: a Serve compiled before
# the hosts sent every write through SYSTEM answers a fact POST through lambda's
# own path, and looks no different from outside.
#
# The class path is relative for the reason test.sh gives.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
javac -nowarn -cp "../lib/junit-platform-console-standalone.jar;../lib/sqlite-jdbc.jar;../lib/slf4j-api.jar;." *.java
AREST_LAMBDA=../../kernel.forms AREST_TESTS=../../kernel AREST_SCENARIOS=../../kernel.tests \
  exec java -Xss512m -Xmx6g -cp "../lib/sqlite-jdbc.jar;../lib/slf4j-api.jar;." Program
