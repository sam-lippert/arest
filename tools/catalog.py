"""The metamodel's own facts, as facts in the metamodel's own fact types.

Sam: AREST apps must be able to reference types directly from the metamodel --
sherlock says `Derivation Rule 'induce explains' produces Fact Type
'HypothesisExplainsObservation'`, so that column is a foreign key into the
catalogue. Today it points at a `fact_type` table holding ONE row, while the
335 fact types that exist sit in a private lowercase cell the projection never
reaches. 2,251 metamodel facts are held that way.

The metamodel declares the fact types for all of it -- Fact_Type_has_Role,
Object_Type_plays_Role, Constraint_spans_Role, Fact_Type_has_Reading,
Object_Type_is_subtype_of_Object_Type, Object_Type_has_Reference_Mode,
Constraint_is_of_Constraint_Type -- so nothing needs inventing. The host cells
are a parallel encoding of populations the model already has names for.

    python tools/catalog.py <app|--base>

Emits each population from the host cells and, where the store ALSO holds the
declared form, checks them against each other. That check is the point:
agent-action-governance carries both, and Fact_Type_has_Role there is exactly
pi(ft, roleId) of the role cell -- declared minus projected 0, with the only
extras being roles of DERIVED fact types, which an asserted population
correctly omits.
"""
import importlib.util
import os
import sys


def load(root):
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(root, "engine", "python", "__init__.py"),
        submodule_search_locations=[os.path.join(root, "engine", "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)
    return mod


def catalog(cells):
    """host cell rows -> {metamodel fact type: set of rows}.

    cells is a plain {name: [rows]} of the host encoding.
    """
    role = [tuple(r) for r in cells.get("role", ()) if len(r) >= 4]
    cons = [tuple(r) for r in cells.get("constraint", ()) if len(r) >= 3]
    ft_of = {c[0]: c[2] for c in cons}

    out = {}
    out["Fact_Type_has_Role"] = {(r[1], r[0]) for r in role}
    out["Object_Type_plays_Role"] = {(r[3], r[0]) for r in role}
    out["Fact_Type_has_Reading"] = {
        (r[0], r[1]) for r in cells.get("factType", ()) if len(r) >= 2}
    out["Object_Type_is_subtype_of_Object_Type"] = {
        (r[0], r[1]) for r in cells.get("subtype", ()) if len(r) >= 2}
    out["Object_Type_has_Reference_Mode"] = {
        (r[0], r[1]) for r in cells.get("refMode", ()) if len(r) >= 2}
    out["Constraint_is_of_Constraint_Type"] = {(c[0], c[1]) for c in cons}
    # a span names a POSITION; the role it spans is that position of the
    # constraint's own fact type, which is how role ids are formed
    out["Constraint_spans_Role"] = {
        (r[0], "%s.%s" % (ft_of[r[0]], r[1]))
        for r in cells.get("spans", ()) if len(r) >= 2 and r[0] in ft_of}
    return out


def main(argv):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load(root)
    from pyarest import persist, system

    which = argv[1] if len(argv) > 1 else "--base"
    if which == "--base":
        import json
        from pyarest.lam import to_lam

        def tup(x):
            return tuple(tup(y) for y in x) if isinstance(x, list) else x
        raw = json.load(open(os.path.join(root, "engine", "shared",
                                          "base.store.json"), encoding="utf-8"))
        cells = {c[1]: tup(c[2]) for c in raw["d"]
                 if not (isinstance(c[2], list) and c[2]
                         and isinstance(c[2][0], str))}
        D = to_lam(tuple(("CELL", n, v) for n, v in cells.items()))
        label = "base"
    else:
        db = os.path.join(os.path.dirname(root), "apps", which, which + ".db")
        D = persist.load_sqlite(db)
        cells = {n: [tuple(r) for r in system._pop_rows(D, n)]
                 for n in ("role", "constraint", "spans", "factType",
                           "subtype", "refMode")}
        label = which

    emitted = catalog(cells)
    print("%s: %d metamodel populations emitted from the host cells" % (label, len(emitted)))
    print("%-42s %7s %9s %s" % ("fact type", "emitted", "declared", "agreement"))
    rc = 0
    for name in sorted(emitted):
        have = {tuple(str(x) for x in r) for r in system._pop_rows(D, name)}
        mine = {tuple(str(x) for x in r) for r in emitted[name]}
        if not have:
            verdict = "not populated in this store"
        elif have <= mine:
            extra = len(mine - have)
            verdict = "declared subset of emitted (+%d, derived omitted)" % extra
        else:
            verdict = "MISMATCH: %d declared rows not emitted" % len(have - mine)
            rc = 1
        print("  %-40s %7d %9d  %s" % (name[:40], len(mine), len(have), verdict))
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv))
