"""Analyse a value type's population and name its conceptual data type.

A value type is the analytic endpoint of a model: it denotes itself, so what
there is to get right about it is WHAT KIND OF ATOM it is. NORMA says this with
ConceptualDataType on the ValueType, over the vocabulary in
DataTypesGenerator.xml -- eight groups, twenty-eight types. The corpus says it
with one: the archived tasks.orm declares 247 value types and every one refs a
single VariableLengthTextDataType, so every atom in the model is a string.

The evidence for the right answer is already in the store. Every value type has
a population -- the values it actually takes across the fact types whose far
role it plays -- and those values are decisive far more often than not: a column
of '2026-08-24' is a Date, a column of 'T'/'F' is TrueOrFalse, a column of
'1268' is an integer. So this reads the population and classifies it, and only
falls back to VariableLength when the values genuinely do not say.

Two rules keep it honest:

  - a classification must hold for EVERY value, not most. One '2026-08-2x'
    among dates makes the type Text, because the model would then be asserting
    something false about the rest.
  - the name is a tiebreak, never evidence. Cost/Price/Amount promotes a
    decimal to Money, because Money and Decimal have the same lexical form and
    nothing but intent separates them. A name never overrides the values.

    python tools/wall/conceptual-types.py [app ...] [--apply] [--apps DIR]

Without --apply it reports what it would assign. With --apply it appends the
instance facts to the app's readings, as ordinary FORML:

    Value Type 'Due Date' has Conceptual Data Type 'Date'.

which needs no new reading grammar -- a designation is an instance fact.
"""
import os
import re
import sys

sys.setrecursionlimit(100000)

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$")
TIME = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?$")
INT = re.compile(r"^-?\d+$")
DEC = re.compile(r"^-?\d+\.\d+$")
UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
TRUEFALSE = {"T", "F", "true", "false", "True", "False"}
YESNO = {"Y", "N", "yes", "no", "Yes", "No"}
MONEYISH = ("cost", "price", "amount", "fee", "salary", "wage", "balance",
            "charge", "payment", "revenue", "budget")


def classify(name, values):
    """The NORMA DataType every one of these values is, or VariableLength."""
    vals = [str(v) for v in values if v is not None and str(v) != ""]
    if not vals:
        return "VariableLength", "no values"
    n = name.lower()

    def all_match(rx):
        return all(rx.match(v) for v in vals)

    if all_match(UUID):
        return "UUID", "all uuid"
    if all_match(DATETIME):
        return "DateAndTime", "all date-time"
    if all_match(DATE):
        return "Date", "all dates"
    if all_match(TIME):
        return "Time", "all times"
    if all(v in TRUEFALSE for v in vals):
        return "TrueOrFalse", "all T/F"
    if all(v in YESNO for v in vals):
        return "YesOrNo", "all Y/N"
    if all_match(INT):
        money = any(w in n for w in MONEYISH)
        if money:
            return "Money", "all integers, money-named"
        if all(not v.startswith("-") for v in vals):
            return "UnsignedInteger", "all non-negative integers"
        return "SignedInteger", "all integers"
    if all_match(DEC) or (all_match(INT) or all_match(DEC)):
        if any(w in n for w in MONEYISH):
            return "Money", "all decimals, money-named"
        return "Decimal", "all decimals"
    if all(DEC.match(v) or INT.match(v) for v in vals):
        if any(w in n for w in MONEYISH):
            return "Money", "all numeric, money-named"
        return "Decimal", "all numeric"
    if max(len(v) for v in vals) > 200:
        return "LargeLength", "longest %d chars" % max(len(v) for v in vals)
    return "VariableLength", "text"


def load(root):
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(root, "engine", "python", "__init__.py"),
        submodule_search_locations=[os.path.join(root, "engine", "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)
    return mod


def analyse(root, app, db):
    load(root)
    from pyarest import persist, system
    D = persist.load_sqlite(db)
    inst = [tuple(r) for r in system._pop_rows(D, "instanceOf")]
    roles = [tuple(r) for r in system._pop_rows(D, "role")]
    values = {n for (n, k) in ((r[0], r[1]) for r in inst) if k == "ValueType"}

    # every value type's population: the values at the roles it plays
    pop = {v: [] for v in values}
    byft = {}
    for r in roles:
        byft.setdefault(r[1], []).append((r[2], r[3]))
    for ft, rs in byft.items():
        try:
            rows = [tuple(x) for x in system._pop_rows(D, ft)]
        except Exception:
            continue
        for (posn, player) in rs:
            if player in pop:
                for row in rows:
                    if len(row) >= posn:
                        pop[player].append(row[posn - 1])
    return {v: classify(v, pop[v]) for v in sorted(values)}, pop


def main(argv):
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    apps_dir = "C:/Users/lippe/Repos/apps"
    for i, a in enumerate(argv):
        if a == "--apps":
            apps_dir = argv[i + 1]
    apply_it = "--apply" in argv
    names = [a for a in argv[1:] if not a.startswith("--")
             and a != apps_dir]
    if not names:
        names = sorted(d for d in os.listdir(apps_dir)
                       if os.path.isdir(os.path.join(apps_dir, d)))

    total = {}
    for app in names:
        db = os.path.join(apps_dir, app, app + ".db")
        if not os.path.exists(db):
            continue
        try:
            got, pop = analyse(root, app, db)
        except Exception as e:
            print("%-26s ERROR %s" % (app, str(e)[:60]))
            continue
        typed = {v: t for v, (t, _w) in got.items() if t != "VariableLength"}
        print("%-26s %3d value types, %3d typed beyond text" % (app, len(got), len(typed)))
        for v, (t, why) in sorted(got.items()):
            if t != "VariableLength":
                print("     %-34s %-16s %s (%d values)" % (v, t, why, len(pop[v])))
            total[t] = total.get(t, 0) + 1
        if apply_it and typed:
            write_facts(apps_dir, app, typed)
    print("\n--- corpus totals ---")
    for t, n in sorted(total.items(), key=lambda kv: -kv[1]):
        print("  %-18s %d" % (t, n))
    return 0


def write_facts(apps_dir, app, typed):
    """The designations, as ordinary instance facts in the app's readings."""
    rd = os.path.join(apps_dir, app, "readings")
    if not os.path.isdir(rd):
        return
    path = os.path.join(rd, "conceptual-types.md")
    lines = ["# Conceptual Data Types", "",
             "The data type of each value type whose population says what kind of",
             "atom it is. Derived from the values themselves, not from the names --",
             "see tools/wall/conceptual-types.py. A value type absent from this list",
             "is VariableLength, which is NORMA's default and what the corpus was.",
             "", "## Fact Types", "",
             "Value Type has Conceptual Data Type.", "",
             "## Constraints", "",
             "Each Value Type has at most one Conceptual Data Type.", "",
             "## Instance Facts", ""]
    for v, t in sorted(typed.items()):
        lines.append("Value Type '%s' has Conceptual Data Type '%s'." % (v, t))
    lines.append("")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("     -> wrote %d designations to %s" % (len(typed), path))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
