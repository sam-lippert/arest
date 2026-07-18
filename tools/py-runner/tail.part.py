
# ---- effects only, the Platform seam: apply the canon's own report to the
# composed store and print the verdicts, byte-identical to the other
# stations so a diff of any two captures is the parity check itself. The
# deep canonical recursion runs on a thread with a large stack (Python
# frames are heavy; the report, not the load, is the deep part).
import sys
import threading

def _run_report():
    name = "law:app_report" if len(sys.argv) > 1 and sys.argv[1] == "app" else "law:report"
    store = tuple(CELLS)
    report = seq(Ev(name, store))
    ok = True
    for pair in report:
        law = need_str(at(pair, 0))
        passed = is_T(at(pair, 1))
        ok = ok and passed
        print(("  law OK: %s" % law) if passed else ("  LAW FAILED: %s -> F" % law))
    if ok:
        print("ALL LAWS HOLD (canon-evaluated: %s over the composed store)" % name)
    else:
        print("LAW FAILURE")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.setrecursionlimit(200000)
    threading.stack_size(128 * 1024 * 1024)  # the Windows CPython maximum (256MB is rejected)
    _code = []
    def _main():
        _code.append(_run_report())
    _t = threading.Thread(target=_main)
    _t.start()
    _t.join()
    sys.exit(_code[0] if _code else 1)
