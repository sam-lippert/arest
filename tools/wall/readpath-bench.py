"""Term walk versus SQL, on the same question, over the same store.

FetchPop finds a population by walking the cell list, which the kernel's own
note prices at O(cells) reductions -- 559ms over the base's 965 cells against
11ms over six. The projected tables answer the same question with an indexed
read. This times both and checks they agree, per app and per fact type, because
a speed claim with no agreement check is how you make a fast wrong answer.

    python tools/wall/readpath-bench.py [app ...]

Reports rows, wall time each way, the ratio, and any fact type where the two
disagree. Disagreement is the headline: SQL cannot become the storage until it
answers what the term answers, everywhere.
"""
import os
import sqlite3
import sys
import time

sys.setrecursionlimit(100000)


def load(root):
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pyarest", os.path.join(root, "engine", "python", "__init__.py"),
        submodule_search_locations=[os.path.join(root, "engine", "python")])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pyarest"] = mod
    spec.loader.exec_module(mod)
    return mod


def bench(root, app, apps_dir):
    load(root)
    from pyarest import protocol, persist, system, ddl
    dbp = os.path.join(apps_dir, app, app + ".db")
    if not os.path.exists(dbp):
        return None
    D = persist.load_sqlite(dbp)
    partition, roles, ref, entities, mandatory = protocol._analyze(D)
    own = protocol._owntables(partition.keys(),
                              [f for f, k in partition.items() if k != f])
    etabs = protocol._entitytables(entities, partition.values(), own)
    con = sqlite3.connect(dbp)
    have = {r[0] for r in con.execute(
        "select name from sqlite_master where type='table'")}

    def q(n):
        return '"%s"' % str(n).replace('"', '""')

    fts = [f for f in sorted(partition) if ddl._sql_name(partition[f]) in have]

    # SQLITE TREATS AN UNKNOWN "identifier" AS A STRING LITERAL. A column the
    # table does not have comes back as the constant text of its own name, one
    # row per row of the table, and the read looks like it worked. That is how
    # a stale projection fabricates data instead of failing, so every planned
    # column is checked against the table before it is ever selected.
    colsof = {t: {r[1] for r in con.execute("PRAGMA table_info(%s)" % q(t))}
              for t in have}
    absent = []

    # the SQL plan, resolved once -- schema knowledge is not per-read cost
    plan = {}
    for ft in fts:
        tbl = ddl._sql_name(partition[ft])
        if partition[ft] == ft:
            cols = [r[1] for r in con.execute("PRAGMA table_info(%s)" % q(tbl))]
            plan[ft] = ("SELECT %s FROM %s"
                        % (", ".join(q(c) for c in cols), q(tbl)), None)
        else:
            hit = next(((c, k) for (f, c, k, _o) in protocol._entity_columns(
                partition[ft], partition, roles, ref, entities, etabs)
                if f == ft), None)
            if hit is None:
                continue
            col, kind = hit
            key = protocol._key_col(partition[ft], ref)
            if col not in colsof.get(tbl, ()) or key not in colsof.get(tbl, ()):
                absent.append((ft, tbl, col))
                continue
            if kind == "unary":
                plan[ft] = ("SELECT %s FROM %s WHERE %s = 1"
                            % (q(key), q(tbl), q(col)), "unary")
            else:
                # THE VALUES GO BACK AT THEIR ROLE POSITIONS. The table is not
                # always the fact type's role 1: Fact_Type_has_Role absorbs
                # into Role because its uniqueness spans role 2, so the key is
                # the SECOND element of the fact and selecting key-then-column
                # returns every row reversed -- 512 rows that all disagree
                # while the counts match. This is rmap:keypos, which the write
                # leg already learned and the read leg had not.
                rs = roles.get(ft, [])
                kp = next((p for (p, player) in rs if player == partition[ft]), 1)
                plan[ft] = ("SELECT %s, %s FROM %s WHERE %s IS NOT NULL"
                            % (q(key), q(col), q(tbl), q(col)),
                            "swap" if kp == 2 else None)

    t0 = time.time()
    term = {ft: [tuple(r) for r in system._pop_rows(D, ft)] for ft in plan}
    t_term = time.time() - t0

    t0 = time.time()
    sql = {}
    for ft, (stmt, kind) in plan.items():
        rows = con.execute(stmt).fetchall()
        if kind == "unary":
            sql[ft] = [(r[0],) for r in rows]
        elif kind == "swap":
            sql[ft] = [(r[1], r[0]) for r in rows]
        else:
            sql[ft] = [tuple(r) for r in rows]
    t_sql = time.time() - t0

    def norm(rs):
        return sorted(tuple(str(x) for x in r) for r in rs)
    bad = [ft for ft in plan if norm(term[ft]) != norm(sql[ft])]
    rows = sum(len(v) for v in term.values())
    return app, len(plan), rows, t_term, t_sql, bad, absent


def main(argv):
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    apps_dir = "C:/Users/lippe/Repos/apps"
    names = [a for a in argv[1:] if not a.startswith("--")] or ["tasks", "arest-dev"]
    print("%-24s %5s %7s %9s %9s %8s %s"
          % ("app", "fts", "rows", "term", "sql", "ratio", "disagree"))
    rc = 0
    for app in names:
        got = bench(root, app, apps_dir)
        if got is None:
            continue
        app, n, rows, t_term, t_sql, bad, absent = got
        ratio = (t_term / t_sql) if t_sql > 0 else float("inf")
        print("%-24s %5d %7d %8.3fs %8.4fs %7.0fx %s"
              % (app, n, rows, t_term, t_sql, ratio, bad or "none"))
        if absent:
            print("     %d fact types have NO SUCH COLUMN (stale projection): %s"
                  % (len(absent), [a[0] for a in absent[:4]]))
        if bad or absent:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv))
