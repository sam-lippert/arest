#!/bin/sh
# The java host's own tests. No python, no second host, no build tool.
#
#   sh tools/java-runner/test.sh
#
# JUnit 5's console launcher is ONE jar and needs no maven or gradle, which
# suits a runner whose siblings carry no dependencies either. It is fetched
# rather than vendored because every other build output here -- bin/, obj/,
# target/ -- is ignored for the same reason: a 2.7 MB binary does not belong in
# a source tree. 1.10.2 is the last line that still runs on a 1.8 JDK, which is
# what this runner is built with.
#
# AND THE CLASSPATH IS RELATIVE, because javac is a WINDOWS binary and this is
# a POSIX shell (2026-09-11). `-cp "$jar;."` handed it /c/Users/.../lib/....jar
# -- MSYS rewrites a lone path argument to C:\ and leaves a SEMICOLON-joined
# one alone, since a path list to it is colon-joined -- so the jar was not on
# the classpath at all and every assertEquals in CasesTest was `cannot find
# symbol`, 20 errors, exit 1. The same shell runs this leg on windows-latest,
# so the java station has been failing in CI, not passing quietly. Relative to
# $here it needs no rewriting on any shell.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
lib="$here/../lib"
jar="$lib/junit-platform-console-standalone.jar"
cp="../lib/junit-platform-console-standalone.jar;."
url="https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.10.2/junit-platform-console-standalone-1.10.2.jar"

if [ ! -f "$jar" ]; then
  echo "fetching the JUnit console launcher..."
  mkdir -p "$lib"
  curl -sSL -o "$jar" "$url"
fi

# EVERY SOURCE IN THIS RUNNER, not the one the test names (2026-09-11). This
# compiled CasesTest.java alone, and javac only pulls in what that reaches:
# Arest and Reader. Gui.java -- the Swing container, the station that draws
# ui:screen -- and Program.java, the CLI, were compiled by NOTHING in this
# repo, so "the java GUI builds" was a fact about whoever last ran javac by
# hand rather than one the tree asserts. Samuel, today: GUI runners should
# work. A runner nothing compiles is a runner nothing knows the state of, and
# the five sources here compile clean from an empty directory, so gating all
# of them costs a second and closes that.
cd "$here"
javac -cp "$cp" *.java
exec java -jar ../lib/junit-platform-console-standalone.jar -cp . -c CasesTest --details=summary
