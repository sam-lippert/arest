# THE THIN-HOST CHECK. Thin hosts, with the logic in lambda and ORM, is mechanical to check: a host
# that holds logic names lambda's definitions, because a twin is keyed by the DEF it stands in for and a memo's list
# is a list of DEF names. So every quoted name in a host's source that lambda (or the kernel) DEFines is counted,
# beyond the contract's own: the entry points a host applies (main, main:boot, main:api, system:show), the forms
# lambda defines that a primitive arm also reads (CONS, CONST), and hook:write, which hook:seal applies by name. A
# host that names any other DEF is reported with each name and where it stands, in two kinds: LOGIC, a name in the
# evaluator's own source (a twin keyed by it, a memo list holding it: the DEF's work done or kept by the host), and
# ENTRY, a name a host's protocol layer applies (serving, routing, performing: lambda's surface known to the host,
# which one lambda entry per protocol would remove).
#
# THE BASELINE (tools/thin-hosts.baseline) is the names hosts held when the check began, one "<host> <name>" a line:
# they are the retirement list. A name not in it fails the check (exit 1), so no new logic lands in a host; a name
# in it that a host no longer holds is reported as retired, and --write rewrites the baseline to what is left, so the
# list only ever shrinks.
#
#   python -I tools/thin-hosts.py            every host; exit 1 where a host names a DEF the baseline does not hold
#   python -I tools/thin-hosts.py --write    rewrite the baseline to the names hosts hold now
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVALUATORS = ("tools/java-runner/Arest.java", "tools/js-runner/arest.js", "tools/cs-runner/Mu.cs",
              "tools/rust-host/src/lib.rs")
HOSTS = {
    "java": ("tools/java-runner", (".java",)),
    "js": ("tools/js-runner", (".js",)),
    "cs": ("tools/cs-runner", (".cs",)),
    "rust": ("tools/rust-host/src", (".rs",)),
    "wasm": ("tools/rust-host", ("wasm.js",)),
    "uefi": ("engine/os/src", (".rs",)),
}
CONTRACT = {"main", "main:boot", "main:api", "system:show", "hook:write", "CONS", "CONST"}
SKIP = re.compile(r"(\.g\.js$|^composed|/registry/|/node_modules/|/target)")


def defs():
    names = set()
    for f in ("arest", "kernel", "kernel.forms"):
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            names |= set(re.findall(r'DEF\("([^"]+)"', open(p, encoding="utf-8").read()))
    return names


BASELINE = os.path.join(ROOT, "tools", "thin-hosts.baseline")


def baseline():
    if not os.path.exists(BASELINE):
        return set()
    return {tuple(l.split()) for l in open(BASELINE, encoding="utf-8") if l.strip() and not l.startswith("#")}


def main():
    names = defs()
    held = set()
    quoted = re.compile(r'"([A-Za-z_][\w]*:[\w:+*\-]+)"')
    bad = 0
    for host, (d, exts) in HOSTS.items():
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        found = {}
        for dp, _, fs in os.walk(base):
            for f in fs:
                p = os.path.join(dp, f)
                rel = os.path.relpath(p, ROOT).replace("\\", "/")
                if not f.endswith(exts) or SKIP.search(rel):
                    continue
                for i, line in enumerate(open(p, encoding="utf-8", errors="replace"), 1):
                    s = line.strip()
                    if s.startswith(("//", "#", "*", "/*")):
                        continue
                    for n in quoted.findall(line):
                        if n in names and n not in CONTRACT:
                            found.setdefault(n, []).append("%s:%d" % (rel, i))
        held |= {(host, n) for n in found}
        logic = {n: w for n, w in found.items() if any(x.split(":")[0] in EVALUATORS for x in w)}
        entry = {n: w for n, w in found.items() if n not in logic}
        bad += len(found)
        print("%-5s %s" % (host, "thin" if not found else "%d LOGIC, %d ENTRY lambda name(s) in host code" % (len(logic), len(entry))))
        for kind, part in (("LOGIC", logic), ("ENTRY", entry)):
            for n in sorted(part):
                print("   %s %-28s %s" % (kind, n, ", ".join(part[n][:3]) + (" ..." if len(part[n]) > 3 else "")))
    base = baseline()
    if "--write" in sys.argv:
        with open(BASELINE, "w", encoding="utf-8") as f:
            f.write("# the lambda names hosts still hold: the retirement list (tools/thin-hosts.py); it only shrinks\n")
            for h, n in sorted(held):
                f.write("%s %s\n" % (h, n))
        print("baseline: %d name(s) written" % len(held))
        sys.exit(0)
    new = sorted(held - base)
    gone = sorted(base - held)
    for h, n in new:
        print("NEW   %s %s: a lambda name a host did not hold before (thin hosts, logic in lambda and ORM)" % (h, n))
    if gone:
        print("retired since the baseline: %d (run with --write to shrink it): %s" % (len(gone), ", ".join("%s %s" % g for g in gone[:10])))
    print("baseline %d, held %d, new %d" % (len(base), len(held), len(new)))
    sys.exit(1 if new else 0)


if __name__ == "__main__":
    main()
