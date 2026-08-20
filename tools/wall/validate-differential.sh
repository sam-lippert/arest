#!/bin/sh
# The validate differential: run one app's `validate` through BOTH hosts and
# diff the answer. Two increments in a row said this harness did not exist and
# used that to defer the engine/rust deontic attach arms; it does exist, it is
# these fifteen lines, and the first run it was pointed at DISCONFIRMED the
# divergence they were deferred over.
#
#   sh tools/wall/validate-differential.sh <app> [apps-dir]
#
# The rust side runs NATIVE, not delegated. vo_validate returns None -- falling
# through to delegate_read -- unless AREST_NATIVE_VALIDATE is set or no --py-cli
# was given, so a run that forgets the variable silently compares python with
# itself and always passes. That is the trap this script exists to close.
set -e
APP="${1:?usage: validate-differential.sh <app> [apps-dir]}"
DIR="${2:-C:/Users/lippe/Repos/apps}"
E="$(cd "$(dirname "$0")/../.." && pwd)"
O="$(mktemp -d)"

python "$E/engine/cli.py" validate --apps-dir "$DIR" "$APP" > "$O/py.json"

printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"diff","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"apps_use\",\"arguments\":{\"name\":\"$APP\"}}}" \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"validate","arguments":{}}}' \
 | AREST_NATIVE_VALIDATE=1 "$E/engine/rust/target/debug/arest.exe" \
     --mcp --apps-dir "$DIR" > "$O/rs.jsonl"

python - "$O" <<'PY'
import json, sys
o = sys.argv[1]
py = json.load(open(o + "/py.json"))
rs = None
for line in open(o + "/rs.jsonl"):
    d = json.loads(line)
    if d.get("id") == 3:
        if "error" in d:
            print("rust validate errored:", d["error"]); sys.exit(1)
        rs = json.loads(d["result"]["content"][0]["text"])
if rs is None:
    print("no rust answer"); sys.exit(1)
pv = {v["fact_type"]: v for v in py["violations"]}
rv = {v["fact_type"]: v for v in rs["violations"]}
if py == rs:
    print("VALIDATE AGREES: %d violations, byte-identical" % len(py["violations"]))
    sys.exit(0)
print("VALIDATE DIFFERS")
for ft in sorted(set(pv) - set(rv)):
    print("  only python flags:", ft, pv[ft]["kinds"])
for ft in sorted(set(rv) - set(pv)):
    print("  only rust flags  :", ft, rv[ft]["kinds"])
for ft in sorted(set(pv) & set(rv)):
    if pv[ft] != rv[ft]:
        print("  differs:", ft)
        print("    py:", pv[ft])
        print("    rs:", rv[ft])
sys.exit(1)
PY
