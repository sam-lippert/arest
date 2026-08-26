"""One-shot Registry verbs for the Rust resident's write delegation.

The resident keeps the read path hot over sidecars and spawns this script for
the verbs that need the compiler host: apply, retract, and compile. Each
invocation runs exactly one Registry verb through the same pipeline the
Python MCP server uses, prints one JSON receipt on stdout, and exits 0 on a
committed write (or a clean compile), 1 on a refusal, and 2 on a usage error.
The script self-registers the pyarest package from the python/ host directory
(the same bootstrap conftest.py performs), so it needs no install and no
particular working directory."""
import importlib.util
import json
import os
import sys

# THE MU EVALUATOR RECURSES DEEPLY, and this entry point never raised the
# limit, so it ran at CPython's default of 1000. pyarest.tromp sets 200_000,
# but the compile path does not import it, so `cli.py compile` died with
# RecursionError on any app whose evaluation goes deep -- agent-policy and
# kernel among 6 tested -- while the IDENTICAL compile succeeded from a script
# that had raised the limit itself. The resident spawns this script for its
# write delegation, so the failure surfaced as a broken verb, not as a stack
# trace anyone read. (A worker thread with a larger stack was NOT needed:
# measured, the limit alone is sufficient.)
sys.setrecursionlimit(200_000)

# UTF-8 on both streams REGARDLESS of the console codepage: the usage
# text carries an em-dash, and receipts carry app values — on a cp1252
# Windows console those bytes crash the SPAWNING side's utf-8 reader
# thread (subprocess.run text=True), turning stderr/stdout into None
# (found 2026-07-09 via test_cli; the resident's receipt reads share
# the class).
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

_ROOT = os.path.dirname(os.path.abspath(__file__))

if "pyarest" not in sys.modules:
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(_ROOT, "python", "__init__.py"),
        submodule_search_locations=[os.path.join(_ROOT, "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)

_USAGE = ("usage: cli.py <verb> --apps-dir <dir> <app> [args...]\n"
          "write verbs: compile <app> | apply <app> <fact_type> <row-json> |"
          " retract <app> <fact_type> <row-json>\n"
          "read verbs: get <app> <noun> <id> | schema <app> | sql <app>"
          " <statement> | explain <app> <id> | validate <app> | verify <app>"
          " | actions <app> <noun> <id> | synthesize <app> <id>\n"
          "desktop: show <app> [noun] — the store as a native window;"
          " controls resolve through DEFS, events apply facts\n")

# Each read verb names its Registry method; the CLI is a thin delegate, so
# outputs pass through as the method answers them.
#
# CANON: DEF("system:read_verbs") and DEF("system:read_args"). The dict that
# stood here mapped verb to ARITY, and engine/rust held the same contract as
# the trailing argument NAMES -- one that cannot say what an argument means,
# one that cannot say which verbs there are. The arity is the count of a
# verb's rows plus the app, so it is derived here rather than restated.
_READS_CACHE = {}


def _reads():
    if not _READS_CACHE:
        from pyarest.lam import atom as _A, to_lam as _tl, from_lam as _fl
        from pyarest.reduce import apply as _apply
        verbs = _fl(_apply(_A("system:read_verbs"), _tl(())))
        _READS_CACHE.update({v: 1 for v in verbs})
        for row in _fl(_apply(_A("system:read_args"), _tl(()))):
            _READS_CACHE[row[0]] += 1
    return _READS_CACHE


def main(argv):
    args = list(argv[1:])
    if len(args) >= 3 and args[1] == "--apps-dir":
        verb, apps_dir, rest = args[0], args[2], args[3:]
    else:
        sys.stderr.write(_USAGE)
        return 2
    import pyarest.prims  # noqa: F401
    from pyarest import apps
    reg = apps.Registry(apps_dir)
    if verb == "compile" and len(rest) == 1:
        out = reg.compile(rest[0])
        print(json.dumps(out, default=str))
        return 0
    if verb in ("apply", "retract") and len(rest) == 3:
        app, ft, row = rest[0], rest[1], tuple(json.loads(rest[2]))
        out = getattr(reg, verb)(app, ft, row)
        print(json.dumps(out, default=str))
        return 0 if out.get("committed") else 1
    if verb in _reads() and len(rest) == _reads()[verb]:
        try:
            out = getattr(reg, verb)(*rest)
        except Exception as e:
            # a read verb's failure on caller input (a bad SQL statement, an
            # unknown noun) is the CALLER'S error, answered as an envelope at
            # exit 0 so the resident relays it as a result; real crashes in
            # the write path keep their nonzero exits
            print(json.dumps({"error": f"{type(e).__name__}: {e}"},
                             default=str))
            return 0
        print(json.dumps(out, default=str))
        return 0
    if verb == "show" and 1 <= len(rest) <= 3:
        from pyarest import showui
        ff = 'single' if '--single' in rest else 'auto'
        pos = [r for r in rest if not r.startswith('--')]
        showui.show(reg, pos[0], pos[1] if len(pos) > 1 else None,
                    form_factor=ff)
        return 0
    if verb == "call" and len(rest) == 2:
        # the generic form: EVERY first-class verb through the one dispatch
        # (protocol.SESSION_VERBS / APP_VERBS) — the CLI is a binding like the
        # MCP servers, never a second verb table.
        #   cli.py call --apps-dir <dir> <verb> <json-args>
        from pyarest import mcp_server
        name, vargs = rest[0], json.loads(rest[1] or "{}")
        try:
            out = mcp_server._dispatch(reg, name, vargs)
        except Exception as e:
            print(json.dumps({"error": f"{type(e).__name__}: {e}"},
                             default=str))
            return 0
        print(json.dumps(out, default=str))
        return 0
    sys.stderr.write(_USAGE)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
