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
set -e
here="$(cd "$(dirname "$0")" && pwd)"
lib="$here/../lib"
jar="$lib/junit-platform-console-standalone.jar"
url="https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.10.2/junit-platform-console-standalone-1.10.2.jar"

if [ ! -f "$jar" ]; then
  echo "fetching the JUnit console launcher..."
  mkdir -p "$lib"
  curl -sSL -o "$jar" "$url"
fi

cd "$here"
javac -cp "$jar;." CasesTest.java
exec java -jar "$jar" -cp . -c CasesTest --details=summary
