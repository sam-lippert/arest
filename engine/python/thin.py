"""The thin pyarest host: kernel + canon, nothing else.

The package __init__ pulls engine, compiler, protocol and tools in at import
time (lines 42-54), which is what makes pyarest a 14k-line spine rather than a
runner. Those four are not needed to BE a host. A host is what the paper says
it is: an implementation of the reduction over the object algebra, plus
whatever it registers into DEFS. That is `kernel` (the lambda substrate, the
definition store, the enumerable boundary, mu = Y(tau), the Backus base) and
`canon` (the intersection-source vocabulary and theta-1 bindings -- "binds,
never authors"). 1,434 lines, against the Java host's 1,058.

Run it and it answers exactly what java/Program.java answers, because both
reduce the same canon. That is the whole claim: any canonical runner behaves
the same, and the ones that differ are carrying something they should not.

    python -m pyarest.thin          (or: python engine/python/thin.py)
"""
import importlib.util
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))


def _thin_package():
    """Construct the pyarest package WITHOUT the fat modules.

    Mirrors __init__ up to the kernel/canon boundary: the alias table so
    `pyarest.lam`, `.defs`, `.delta`, `.reduce`, `.prims` all resolve to the
    kernel, then canon.load_all() to bind the intersection source. It stops
    where __init__ starts importing engine/compiler/protocol/tools.
    """
    if "pyarest" in sys.modules:
        return sys.modules["pyarest"]
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(_HERE, "__init__.py"),
        submodule_search_locations=[_HERE])
    pkg = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = pkg
    pkg.__path__ = [_HERE]

    kernel = importlib.import_module("pyarest.kernel")
    for alias in ("lam", "defs", "delta", "reduce", "prims"):
        sys.modules["pyarest." + alias] = kernel
        setattr(pkg, alias, kernel)
    pkg.kernel = kernel

    canon = importlib.import_module("pyarest.canon")
    pkg.canon = canon
    canon.load_all()
    return pkg


def show(o, kernel):
    """Render a reduced value the way java/Program.show does, so the two
    hosts' stdout can be compared byte for byte."""
    # `o` arrives already converted by the caller's from_lam, so this only
    # renders -- it must not convert again. Guarding on an incomplete type
    # list (str, int, tuple) sent floats back through from_lam and killed the
    # run at case:div, which is a harness bug, not a host difference.
    py = o
    if py is kernel.BOT or py == "BOT" or py == "⊥":
        return "⊥"
    if isinstance(py, tuple):
        return "(" + ", ".join(show(x, kernel) for x in py) + ")"
    if isinstance(py, str):
        return "'" + py + "'"
    return str(py)


def main():
    pkg = _thin_package()
    kernel, canon = pkg.kernel, pkg.canon
    A, to_lam = kernel.atom, kernel.to_lam
    apply = kernel.apply

    print("defs=%d" % len(dict(canon.read("arest.canon"))))

    def mu(expr, operand):
        return apply(A(expr) if isinstance(expr, str) else expr, to_lam(operand))

    # the same probes java/Program.java runs, in the same order
    print("max2('305','1190')=" + show(mu("system:max2", ("305", "1190")), kernel))
    pops = ((("t1", "draft"), ("t2", "review")),
            (("t1", "submit"), ("t2", "approve")),
            (("t1", "review"), ("t2", "done")))
    print("sm_join=" + show(mu("system:sm_join", pops), kernel))

    # the cross-host case table, from the same scenarios.canon bytes. The
    # sub-terms come out by the canon's OWN selectors, so the pair is never
    # unwrapped into host values on the way in.
    for name, pair in canon.read("scenarios.canon"):
        expr = apply(A(1), pair)
        operand = apply(A(2), pair)
        got = kernel.from_lam(apply(expr, operand))
        print("%s=%s" % (name, "⊥" if got == "⊥" else show(got, kernel)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
