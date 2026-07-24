#!/bin/sh
# Semi-derive refresh: recompute only the given cells and patch the
# station carrier in place. Composes WITH the existing carrier so
# unchanged upstream cells fetch-hit.
# Usage: sh derive-refresh.sh <app|base> <cell,cell,...>
APP=${1:-base}
CELLS_ARG=${2:?"cell list required"}
W="$(cd "$(dirname "$0")" && pwd)"
E="$W/../.."
if [ "$APP" = "base" ]; then D="$E/tools/norma-oracle"
elif [ -d "$E/apps/$APP" ]; then D="$E/apps/$APP"
else D="$E/../apps/$APP"; fi
G="$W/derive-refresh.g.js"
cat "$E/tools/js-runner/head.part.js" "$E/arest" \
    "$E/tools/js-runner/mid1.part.js" "$D/design-state" \
    "$E/tools/js-runner/mid2.part.js" "$D/norma-answer" \
    "$E/tools/js-runner/mid3.part.js" "$D/derived-state" "$D/journal" \
    "$E/tools/js-runner/mid4.part.js" "$W/derive-refresh.part.js" > "$G"
DERIVED_OUT="$D/derived-state" REFRESH_CELLS="$CELLS_ARG" bun "$G"
