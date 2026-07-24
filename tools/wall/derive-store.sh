#!/bin/sh
# Derive-and-store: evaluate the scoped pipeline cells once and write
# the station's derived-state carrier (comma-led journal-segment
# entries). Usage: sh derive-store.sh [app|base]
APP=${1:-base}
W="$(cd "$(dirname "$0")" && pwd)"
E="$W/../.."
if [ "$APP" = "base" ]; then D="$E/tools/norma-oracle"
elif [ -d "$E/apps/$APP" ]; then D="$E/apps/$APP"
else D="$E/../apps/$APP"; fi
G="$W/derive-store.g.js"
cat "$E/tools/js-runner/head.part.js" "$E/arest" \
    "$E/tools/js-runner/mid1.part.js" "$D/design-state" \
    "$E/tools/js-runner/mid2.part.js" "$D/norma-answer" \
    "$E/tools/js-runner/mid3.part.js" "$D/journal" \
    "$E/tools/js-runner/mid4.part.js" "$W/derive-store.part.js" > "$G"
DERIVED_OUT="$D/derived-state" bun "$G"
