"""Read a fact type's population OUT of the tables, and verbalize it back.

project() sends fact types to tables: an own-table fact type gets its own table
with a column per role, an absorbed one becomes a column on the table it
absorbs into. Nothing has ever read back. `_pop_rows` walks the D term, so the
tables are a mirror nobody consults, and listing 360 fact types costs 4.7s
against 5ms for the same question in SQL.

This is the inverse. Given the app's schema knowledge (the partition, the roles,
the reference scheme) and the projected db, it answers each fact type's
population from the TABLES:

    own-table   SELECT the role columns
    absorbed    SELECT <key, column> from the absorbing table where the column
                is not null -- keyed at the position the table plays, which is
                rmap:keypos and not necessarily role 1

and --verbalize renders each row back through the fact type's own reading
template, so a row becomes the FORML sentence that would have asserted it:

    Layer 'OSI-1' has Layer Name 'Physical'.

which is the point: the instance facts in a readings file are EXAMPLES that
define the schema, not the storage. Once the schema exists the table stands on
its own, and facts come back out of it -- re-verbalized rather than recompiled.

    python tools/wall/unproject.py <app> [apps-dir] [--verbalize] [--limit N]

Compares against the term for every fact type and reports agreement, so the
substrate can be trusted before anything is built on it.
"""
import os
import re
import sqlite3
import sys
import time

sys.setrecursionlimit(100000)


def _load(root):
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(root, "engine", "python", "__init__.py"),
        submodule_search_locations=[os.path.join(root, "engine", "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)
    return mod


def verbalize(template, players, row):
    """A row back through its reading template. Entity refs and values both
    arrive as literals, so both are quoted -- which is what the readings do."""
    if not template:
        return " ".join(str(v) for v in row) + "."
    out = template
    for i, v in enumerate(row):
        out = out.replace("{%d}" % i, "%s '%s'" % (players[i], v)
                          if i < len(players) else "'%s'" % v)
    return out + "."


def main(argv):
    pos = [a for a in argv[1:] if not a.startswith("--")]
    app = pos[0] if pos else "tasks"
    apps = pos[1] if len(pos) > 1 else "C:/Users/lippe/Repos/apps"
    want_verb = "--verbalize" in argv
    limit = 6
    for a in argv:
        if a.startswith("--limit"):
            limit = int(a.split("=")[1]) if "=" in a else limit

    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    mod = _load(root)
    from pyarest import protocol, persist, system, ddl

    dbp = os.path.join(apps, app, app + ".db")
    t0 = time.time()
    D = persist.load_sqlite(dbp)
    t_load = time.time() - t0

    partition, roles, ref, entities, mandatory = protocol._analyze(D)
    own = protocol._owntables(partition.keys(),
                              [f for f, k in partition.items() if k != f])
    etabs = protocol._entitytables(entities, partition.values(), own)
    templates = {r[0]: (r[1] if len(r) > 1 else None)
                 for r in system._pop_rows(D, "factType")}

    con = sqlite3.connect(dbp)
    have = {r[0] for r in con.execute(
        "select name from sqlite_master where type='table'")}

    def q(n):
        return '"%s"' % str(n).replace('"', '""')

    same = differ = missing = 0
    shown = 0
    t0 = time.time()
    for ft in sorted(partition):
        term = [tuple(r) for r in system._pop_rows(D, ft)]
        tbl = ddl._sql_name(partition[ft])
        if tbl not in have:
            missing += 1
            continue
        if partition[ft] == ft:                       # own table
            cols = [r[1] for r in con.execute("PRAGMA table_info(%s)" % q(tbl))]
            rows = [tuple(r) for r in con.execute(
                "SELECT %s FROM %s" % (", ".join(q(c) for c in cols), q(tbl)))]
        else:                                          # absorbed column
            col = next((c for (f, c, _k, _o) in protocol._entity_columns(
                partition[ft], partition, roles, ref, entities, etabs)
                if f == ft), None)
            if col is None:
                missing += 1
                continue
            key = protocol._key_col(partition[ft], ref)
            rows = [tuple(r) for r in con.execute(
                "SELECT %s, %s FROM %s WHERE %s IS NOT NULL"
                % (q(key), q(col), q(tbl), q(col)))]
        if len(rows) == len(term):
            same += 1
        else:
            differ += 1
        if want_verb and rows and shown < limit:
            shown += 1
            players = [p for (_pos, p) in sorted(roles.get(ft, []))]
            print("   %s" % verbalize(templates.get(ft), players, rows[0]))
    t_read = time.time() - t0

    print("---")
    print("%s: load %.2fs, read %d fact types from TABLES in %.2fs"
          % (app, t_load, same + differ + missing, t_read))
    print("counts agree with the term: %d   differ: %d   no table: %d"
          % (same, differ, missing))
    return 1 if differ else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
