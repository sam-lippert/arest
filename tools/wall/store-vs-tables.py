"""Does the 3NF projection answer what the STORE answers?

The return leg of fact types -> compiled schema -> tables. project() already
builds the schema from the fact types, populates it, and ALTERs new fact types
in on a later compile (ensure_columns) -- so the way OUT is finished. Nothing
reads back: _pop_rows walks the D term, and the tables are a mirror nobody
consults. Every case invocation therefore rebuilds a store that already exists
as rows, which is ~435ms of boot on the fastest station, the same for a bare
selector as for a 44-row reduction.

Before any read path can be built on the tables, the tables have to be shown to
carry the same rows. This is that differential, per own-table fact type:

    _pop_rows(D, ft)   vs   SELECT <cols> FROM <table>

ABSORBED fact types are NOT compared here and are reported as such: a
single-role uniqueness constraint absorbs a fact type into its role-1 player's
table as a COLUMN (Halpin book 10.3), so its population is a projection of that
table rather than a table of its own. Comparing those needs the column mapping,
which is the next step and not this one -- and a differential that quietly
skipped them would be claiming more than it checked.

    python tools/wall/store-vs-tables.py <app> [apps-dir]
"""
import os
import sqlite3
import sys


def main(argv):
    argv = [a for a in argv]
    pos = [a for a in argv[1:] if not a.startswith("--")]
    app = pos[0] if pos else "arest-dev"
    apps = pos[1] if len(pos) > 1 else "C:/Users/lippe/Repos/apps"
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(root, "engine", "python", "__init__.py"),
        submodule_search_locations=[os.path.join(root, "engine", "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)

    from pyarest import protocol, system, ddl

    reg = protocol.Registry(apps)
    D = reg._store(app).load() if hasattr(reg, "_store") else None
    if D is None:
        from pyarest import persist
        D = persist.load_sqlite(os.path.join(apps, app, app + ".db"))

    partition, roles, ref, entities, mandatory = ddl._analyze(D)
    absorbed = {f for f, k in partition.items() if k != f}
    own = sorted(f for f in partition if f not in absorbed)
    # the same two derivations generate() and project() make, so the column
    # naming here is theirs and not a second opinion about it
    own_tables = ddl._owntables(partition.keys(), list(absorbed))
    entity_tables = ddl._entitytables(entities, partition.values(), own_tables)

    # --fresh projects into an EMPTY db and compares that instead. It is what
    # separates "the projection is wrong" from "this db has accumulated": the
    # projection INSERT OR REPLACEs and never deletes, so a row the population
    # no longer contains survives forever -- and a row whose key came out NULL
    # can never be replaced at all, because NULL does not equal NULL in SQL, so
    # every later compile adds another. identity.db carries two such rows in
    # user; a fresh projection of the same store carries one correct row.
    #
    # That is the gap between an upsert and a MATERIALISATION, and it is the
    # one that has to close before a population can be read from a table: a
    # reader cannot tell an asserted row from a stale one.
    fresh = "--fresh" in argv
    if fresh:
        import tempfile
        dbpath = os.path.join(tempfile.mkdtemp(), app + ".db")
        con = sqlite3.connect(dbpath)
        ddl.project(D, con)
        con.commit()
    else:
        con = sqlite3.connect(os.path.join(apps, app, app + ".db"))
    have = {r[0] for r in con.execute(
        "select name from sqlite_master where type='table'")}

    same = diff = missing = 0
    for ft in own:
        t = ddl._sql_name(ft)
        if t not in have:
            missing += 1
            print("NO TABLE  %s -> %s" % (ft, t))
            continue
        store = sorted(tuple(str(v) for v in r) for r in system._pop_rows(D, ft))
        cols = [r[1] for r in con.execute('PRAGMA table_info("%s")' % t)]
        rows = sorted(tuple("" if v is None else str(v) for v in r)
                      for r in con.execute('SELECT %s FROM "%s"'
                                           % (", ".join('"%s"' % c for c in cols), t)))
        if store == rows:
            same += 1
        else:
            diff += 1
            print("DIFFERS   %s (%s): store %d rows, table %d rows"
                  % (ft, t, len(store), len(rows)))
            for s, r in list(zip(store, rows))[:2]:
                if s != r:
                    print("            store %r" % (s,))
                    print("            table %r" % (r,))
                    break

    # ---- the absorbed half: a fact type that lives as a COLUMN ------------
    # A single-role uniqueness constraint absorbs a fact type into its role-1
    # player's table (Halpin 10.3), so its population is a projection of that
    # table rather than a table of its own: the key column paired with the
    # absorbed column, over the rows where the column is present. A unary
    # absorbs as a BOOLEAN and its population is the keys where it is true.
    asame = adiff = askip = 0
    for table in sorted({k for f, k in partition.items() if k != f}):
        t = ddl._sql_name(table)
        if t not in have:
            askip += 1
            print('NO TABLE  absorbing table %s -> %s' % (table, t))
            continue
        cols = ddl._entity_columns(table, partition, roles, ref, entities,
                                   entity_tables)
        key = ddl._key_col(table, ref)
        present = {r[1] for r in con.execute('PRAGMA table_info("%s")' % t)}
        if key not in present:
            askip += len(cols)
            print('NO KEY    %s.%s (%d columns unchecked)' % (t, key, len(cols)))
            continue
        for (ft, col, kind, _other) in cols:
            if partition.get(ft) == ft:
                continue                      # own table, checked above
            if col not in present:
                askip += 1
                print('NO COLUMN %s in %s.%s' % (ft, t, col))
                continue
            store = sorted(tuple(str(v) for v in r)
                           for r in system._pop_rows(D, ft))
            if kind == 'unary':
                rows = sorted((str(r[0]),) for r in con.execute(
                    'SELECT "%s" FROM "%s" WHERE "%s" IN (1, %s)'
                    % (key, t, col, "'T'")))
            else:
                rows = sorted((str(r[0]), str(r[1])) for r in con.execute(
                    'SELECT "%s", "%s" FROM "%s" WHERE "%s" IS NOT NULL'
                    % (key, col, t, col)))
            if store == rows:
                asame += 1
            else:
                adiff += 1
                print('ABSORBED  %s in %s.%s: store %d, column %d'
                      % (ft, t, col, len(store), len(rows)))

    print("--- %s" % ("fresh projection" if fresh else "the app db as it stands"))
    print("own-table fact types: %d same, %d differ, %d with no table"
          % (same, diff, missing))
    print("absorbed columns: %d same, %d differ, %d not in the table"
          % (asame, adiff, askip))
    return 1 if (diff or missing or adiff) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
