using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using SQLitePCL;

// The platform's registrations, a peer of tools/java-runner/Registrations.java and
// tools/js-runner/registrations.js, written from the JS host's line for line: one body for each Function
// metamodel/resolution.md declares with Definition Origin 'registered' and lambda applies. Each is outside D
// (a clock, a file, entropy, a database engine), which is why it is registered and not defined (AREST.tex
// Def. 9); a body that decides more than its row says is meaning in the host.
//
// A write call is one transaction: it commits whole or leaves the database as it was (Backus 14.3.1).
// SQLite is reached through its own C API (SQLitePCLRaw), as bun:sqlite and sqlite-jdbc reach it: positional
// parameters, integers as 64-bit, every value answered as the text SQLite gives it and NULL as #.
public static class Registrations
{
    const string KEY = "AREST_MASTER_KEY";

    static string Text(object x)
    {
        if (x is object[]) throw new Exception("a sequence where a text belongs");
        return Arest.Show(x);
    }

    static bool Present(string s) { return !string.IsNullOrEmpty(s); }

    static byte[] Sha256(byte[] b) { using (var h = SHA256.Create()) return h.ComputeHash(b); }

    static string Hex(byte[] b) { var sb = new StringBuilder(); foreach (var x in b) sb.Append(x.ToString("x2")); return sb.ToString(); }

    // The master key: the environment's, else the AREST_MASTER_KEY line of the .env beside the lambda. Never printed.
    static string MasterKey(string root)
    {
        var env = Environment.GetEnvironmentVariable(KEY);
        if (Present(env)) return env;
        var p = Path.Combine(root, ".env");
        if (!File.Exists(p)) return null;
        foreach (var line in File.ReadAllText(p).Split('\n'))
        {
            var m = Regex.Match(line.TrimEnd('\r'), @"^\s*AREST_MASTER_KEY\s*=(.*)$");
            if (!m.Success) continue;
            var v = m.Groups[1].Value.Trim();
            if (v.Length > 1 && ((v.StartsWith("\"") && v.EndsWith("\"")) || (v.StartsWith("'") && v.EndsWith("'")))) v = v.Substring(1, v.Length - 2);
            return Present(v) ? v : null;
        }
        return null;
    }

    public static void Register(string lambdaPath)
    {
        Batteries_V2.Init();
        var root = Path.GetDirectoryName(Path.GetFullPath(lambdaPath)).Replace('\\', '/');

        // sequence -> text: now, ISO 8601 in UTC
        Arest.Register("clock", x => DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
        // number-pair -> number: <x, s> to x at scale s, half away from zero
        Arest.Register("round", Round);

        Arest.Register("fs:dir", x =>
        {
            var p = Text(x);
            if (!Directory.Exists(p)) throw new Exception("fs:dir: not a directory: " + p);
            return Directory.EnumerateFileSystemEntries(p).Select(e => (object)Path.GetFileName(e)).ToArray();
        });
        Arest.Register("fs:read", x => File.ReadAllText(Text(x), new UTF8Encoding(false)));
        Arest.Register("fs:write", x =>
        {
            var p = Text(Arest.At(x, 0));
            File.WriteAllText(p + ".build", Text(Arest.At(x, 1)), new UTF8Encoding(false));
            File.Move(p + ".build", p, true);
            return p;
        });
        // text -> cell-list: a carrier read as cells, registering nothing
        Arest.Register("carrier:cells", x => Reader.Cells(Text(x)));
        // object -> path: the directory the composition's lambda was read from
        Arest.Register("module:root", x => root);
        // object -> identifier: the storage engine this host provides
        Arest.Register("storage:engine", x => "sqlite");

        Arest.Register("crypt:digest", x => Hex(Sha256(Encoding.UTF8.GetBytes(Text(x)))));
        Arest.Register("crypt:encrypt", Encrypt);
        Arest.Register("crypt:decrypt", Decrypt);
        Arest.Register("crypt:genkey", GenKey);
        Arest.Register("crypt:keyed", x => Present(MasterKey(root)) ? "T" : "F");
        Arest.Register("hook:seal", x =>
        {
            var key = MasterKey(root);
            if (!Present(key)) throw new Exception("hook:seal: there is no " + KEY + " to store a value through a Function with");
            return Arest.Ev("hook:write", new object[] { key, Arest.At(x, 0), Arest.At(x, 1), Arest.At(x, 2) });
        });

        Arest.Register("sqlite:exec", x =>
        {
            var p = Text(Arest.At(x, 0));
            Write<object>(p, db => { Exec(db, Text(Arest.At(x, 1))); return null; });
            return p;
        });
        Arest.Register("sqlite:run", Run);
        // a read asks on the path's kept read connection (watched)
        Arest.Register("sqlite:query", x => Query(Watched(Text(Arest.At(x, 0))), Text(Arest.At(x, 1)), Arest.Seq(Arest.At(x, 2)), false));
        Arest.Register("sqlite:scratch", x =>
        {
            var db = Open(":memory:", false);
            try { Exec(db, Text(Arest.At(x, 0))); return Query(db, Text(Arest.At(x, 1)), Arest.Seq(Arest.At(x, 2)), false); }
            finally { raw.sqlite3_close_v2(db); }
        });
        Arest.Register("sqlite:program", Program_);
        Arest.Register("sqlite:data_version", x => Scalar(Watched(Text(x)), "pragma data_version"));
        Arest.Register("sqlite:fresh", x =>
        {
            var p = Text(x);
            Unwatch(p);
            foreach (var f in new[] { p, p + "-wal", p + "-shm", p + "-journal" }) if (File.Exists(f)) File.Delete(f);
            return p;
        });
        Arest.Register("sqlite:install", x =>
        {
            var build = Text(Arest.At(x, 0)); var p = Text(Arest.At(x, 1));
            if (File.Exists(p)) throw new Exception("sqlite:install refuses: " + p + " exists; a store that exists is changed in place, never overwritten by a fresh build");
            Unwatch(build); Unwatch(p);
            File.Move(build, p);
            return p;
        });
        Arest.Register("sqlite:copy", x =>
        {
            var from = Text(Arest.At(x, 0)); var to = Text(Arest.At(x, 1));
            if (from == to || !File.Exists(from)) throw new Exception("sqlite:copy refuses: nothing to copy from " + from + " to " + to);
            Unwatch(to);
            foreach (var f in new[] { to, to + "-wal", to + "-shm", to + "-journal" }) if (File.Exists(f)) File.Delete(f);
            var db = Open(from, true);
            try { Step(db, "vacuum into ?", new object[] { to }, false); }
            finally { raw.sqlite3_close_v2(db); }
            return to;
        });
        Arest.Register("sqlite:replace", x =>
        {
            var build = Text(Arest.At(x, 0)); var p = Text(Arest.At(x, 1));
            Unwatch(build); Unwatch(p); Unwatch(p + ".prior");
            if (File.Exists(p))
            {
                if (File.Exists(p + ".prior")) File.Delete(p + ".prior");
                File.Move(p, p + ".prior");
            }
            File.Move(build, p);
            return p;
        });
    }

    // ---- the number ----------------------------------------------------------------------------------------

    static object Round(object x)
    {
        var v0 = Arest.At(x, 0); var s0 = Arest.At(x, 1);
        if (!(v0 is long v)) throw new Exception("round on non-number");
        if (!(s0 is long s)) throw new Exception("round to a non-integer scale");
        if (s >= 0) return v;
        // a 64-bit number is under half of 10^20, so it rounds to 0 there and beyond
        if (s <= -20) return 0L;
        var pow = System.Numerics.BigInteger.Pow(10, (int)-s);
        var bv = new System.Numerics.BigInteger(v);
        var q = System.Numerics.BigInteger.Divide(bv, pow);
        var r = System.Numerics.BigInteger.Remainder(bv, pow);
        if (System.Numerics.BigInteger.Abs(r) * 2 >= pow) q += v < 0 ? -1 : 1;
        var outp = q * pow;
        if (outp < long.MinValue || outp > long.MaxValue) throw new Exception("a number past 64 bits: " + outp);
        return (long)outp;
    }

    // ---- crypt ---------------------------------------------------------------------------------------------

    static object Encrypt(object x)
    {
        var iv = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(Text(Arest.At(x, 1)));
        var ct = new byte[plain.Length]; var tag = new byte[16];
        using (var g = new AesGcm(Sha256(Encoding.UTF8.GetBytes(Text(Arest.At(x, 0)))), 16)) g.Encrypt(iv, plain, ct, tag);
        return Convert.ToBase64String(iv.Concat(tag).Concat(ct).ToArray());
    }

    static object Decrypt(object x)
    {
        var all = Convert.FromBase64String(Text(Arest.At(x, 1)));
        if (all.Length < 28) throw new Exception("crypt:decrypt on a ciphertext shorter than its iv and tag");
        var plain = new byte[all.Length - 28];
        try
        {
            using (var g = new AesGcm(Sha256(Encoding.UTF8.GetBytes(Text(Arest.At(x, 0)))), 16))
                g.Decrypt(all.AsSpan(0, 12), all.AsSpan(28), all.AsSpan(12, 16), plain);
        }
        catch (Exception e) { throw new Exception("crypt:decrypt: " + e.Message); }
        return Encoding.UTF8.GetString(plain);
    }

    static object GenKey(object x)
    {
        var p = Text(x);
        if (Present(Environment.GetEnvironmentVariable(KEY))) throw new Exception("crypt:genkey refuses: " + KEY + " is already set in the environment");
        var had = File.Exists(p) ? File.ReadAllText(p) : "";
        if (Regex.IsMatch(had, "^\\s*" + KEY + "\\s*=", RegexOptions.Multiline)) throw new Exception("crypt:genkey refuses: " + KEY + " is already in " + p);
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        File.AppendAllText(p, (had == "" || had.EndsWith("\n") ? "" : "\n") + KEY + "=" + key + "\n", new UTF8Encoding(false));
        return Hex(Sha256(Encoding.UTF8.GetBytes(key))).Substring(0, 12);
    }

    // ---- sqlite --------------------------------------------------------------------------------------------

    static sqlite3 Open(string p, bool readOnly)
    {
        sqlite3 db;
        int flags = readOnly ? raw.SQLITE_OPEN_READONLY : raw.SQLITE_OPEN_READWRITE | raw.SQLITE_OPEN_CREATE;
        int rc = raw.sqlite3_open_v2(p, out db, flags, null);
        if (rc != raw.SQLITE_OK) { var m = raw.sqlite3_errmsg(db).utf8_to_string(); raw.sqlite3_close_v2(db); throw new Exception("sqlite: cannot open " + p + ": " + m); }
        return db;
    }

    static void Check(sqlite3 db, int rc)
    {
        if (rc != raw.SQLITE_OK && rc != raw.SQLITE_ROW && rc != raw.SQLITE_DONE) throw new Exception(raw.sqlite3_errmsg(db).utf8_to_string());
    }

    static void Exec(sqlite3 db, string sql) { Check(db, raw.sqlite3_exec(db, sql)); }

    // one write call, one transaction
    static T Write<T>(string p, Func<sqlite3, T> work)
    {
        var db = Open(p, false);
        try
        {
            Exec(db, "begin");
            try { var o = work(db); Exec(db, "commit"); return o; }
            catch { try { Exec(db, "rollback"); } catch { } throw; }
        }
        finally { raw.sqlite3_close_v2(db); }
    }

    // SQLite's own text for a real (%!.15g), as the JS host writes it
    static string RealText(double v)
    {
        if (double.IsNaN(v)) return "NaN";
        if (double.IsInfinity(v)) return v > 0 ? "Inf" : "-Inf";
        var s = ToPrecision15(v);
        int e = s.IndexOf('e');
        if (e >= 0)
        {
            var m = s.Substring(0, e); var ex = s.Substring(e + 1);
            if (m.IndexOf('.') >= 0) { m = m.TrimEnd('0'); if (m.EndsWith(".")) m += "0"; } else m += ".0";
            var sign = ex[0] == '-' ? "-" : "+";
            return m + "e" + sign + ex.TrimStart('+', '-').PadLeft(2, '0');
        }
        if (s.IndexOf('.') >= 0) { s = s.TrimEnd('0'); if (s.EndsWith(".")) s += "0"; } else s += ".0";
        return s;
    }

    // JavaScript's Number.prototype.toPrecision(15)
    static string ToPrecision15(double v)
    {
        if (v == 0) return "0.00000000000000";
        var r = v.ToString("E14", CultureInfo.InvariantCulture);   // d.ddddddddddddddE+xxx
        int ei = r.IndexOf('E');
        int exp = int.Parse(r.Substring(ei + 1), CultureInfo.InvariantCulture);
        bool neg = r[0] == '-';
        var digits = r.Substring(neg ? 1 : 0, ei - (neg ? 1 : 0)).Replace(".", "");
        string body;
        if (exp < -6 || exp >= 15) body = digits[0] + "." + digits.Substring(1) + "e" + (exp < 0 ? "-" : "+") + Math.Abs(exp);
        else if (exp >= 0) body = digits.Substring(0, exp + 1) + (exp + 1 < 15 ? "." + digits.Substring(exp + 1) : "");
        else body = "0." + new string('0', -exp - 1) + digits;
        return (neg ? "-" : "") + body;
    }

    static void Bind(sqlite3 db, sqlite3_stmt st, object[] ps, bool hashIsNull)
    {
        for (int i = 0; i < ps.Length; i++)
        {
            var v = ps[i];
            if (v is object[]) throw new Exception("a sequence where a value belongs");
            int rc;
            if (hashIsNull && "#".Equals(v as string)) rc = raw.sqlite3_bind_null(st, i + 1);
            else if (v is long n) rc = raw.sqlite3_bind_int64(st, i + 1, n);
            else rc = raw.sqlite3_bind_text(st, i + 1, Arest.Show(v));
            Check(db, rc);
        }
    }

    static sqlite3_stmt Prepare(sqlite3 db, string sql)
    {
        sqlite3_stmt st;
        int rc = raw.sqlite3_prepare_v2(db, sql, out st);
        if (rc != raw.SQLITE_OK) throw new Exception(raw.sqlite3_errmsg(db).utf8_to_string());
        return st;
    }

    static string Cell(sqlite3_stmt st, int i)
    {
        switch (raw.sqlite3_column_type(st, i))
        {
            case raw.SQLITE_NULL: return "#";
            case raw.SQLITE_INTEGER: return raw.sqlite3_column_int64(st, i).ToString(CultureInfo.InvariantCulture);
            case raw.SQLITE_FLOAT: return RealText(raw.sqlite3_column_double(st, i));
            case raw.SQLITE_BLOB: return Encoding.UTF8.GetString(raw.sqlite3_column_blob(st, i));
            default: return raw.sqlite3_column_text(st, i).utf8_to_string();
        }
    }

    // a statement's rows, each value the text SQLite gives it and NULL as #
    static object[] Query(sqlite3 db, string sql, object[] ps, bool hashIsNull)
    {
        var st = Prepare(db, sql);
        try
        {
            Bind(db, st, ps, hashIsNull);
            var rows = new List<object>();
            int n = raw.sqlite3_column_count(st);
            while (true)
            {
                int rc = raw.sqlite3_step(st);
                if (rc == raw.SQLITE_DONE) break;
                if (rc != raw.SQLITE_ROW) throw new Exception(raw.sqlite3_errmsg(db).utf8_to_string());
                var r = new object[n];
                for (int i = 0; i < n; i++) r[i] = Cell(st, i);
                rows.Add(r);
            }
            return rows.ToArray();
        }
        finally { raw.sqlite3_finalize(st); }
    }

    // run one statement to its end, rows discarded
    static void Step(sqlite3 db, string sql, object[] ps, bool hashIsNull)
    {
        var st = Prepare(db, sql);
        try
        {
            Bind(db, st, ps, hashIsNull);
            int rc;
            while ((rc = raw.sqlite3_step(st)) == raw.SQLITE_ROW) { }
            if (rc != raw.SQLITE_DONE) throw new Exception(raw.sqlite3_errmsg(db).utf8_to_string());
        }
        finally { raw.sqlite3_finalize(st); }
    }

    static object Scalar(sqlite3 db, string sql)
    {
        var st = Prepare(db, sql);
        try
        {
            if (raw.sqlite3_step(st) != raw.SQLITE_ROW) throw new Exception("sqlite: no row from " + sql);
            return raw.sqlite3_column_int64(st, 0);
        }
        finally { raw.sqlite3_finalize(st); }
    }

    // path-and-sql-and-rows -> number: one prepared statement per row, # bound as NULL, the count of rows run
    static object Run(object x)
    {
        var p = Text(Arest.At(x, 0)); var sql = Text(Arest.At(x, 1)); var rows = Arest.Seq(Arest.At(x, 2));
        return Write<object>(p, db =>
        {
            var st = Prepare(db, sql);
            try
            {
                long n = 0;
                foreach (var r in rows)
                {
                    try
                    {
                        raw.sqlite3_reset(st);
                        raw.sqlite3_clear_bindings(st);
                        Bind(db, st, Arest.Seq(r), true);
                        int rc;
                        while ((rc = raw.sqlite3_step(st)) == raw.SQLITE_ROW) { }
                        if (rc != raw.SQLITE_DONE) throw new Exception(raw.sqlite3_errmsg(db).utf8_to_string());
                    }
                    catch (Exception e) { throw new Exception(e.Message + " -- row " + (n + 1) + " of " + rows.Length); }
                    n++;
                }
                return n;
            }
            finally { raw.sqlite3_finalize(st); }
        });
    }

    static long Changes(sqlite3 db) { return raw.sqlite3_total_changes(db); }

    // path-and-steps -> program-answer: the steps in order between one begin and one commit: exec, rows, fix,
    // refuse and deny, each optionally guarded by a select
    static object Program_(object x)
    {
        var p = Text(Arest.At(x, 0)); var steps = Arest.Seq(Arest.At(x, 1));
        var db = Open(p, false);
        try
        {
            Exec(db, "begin");
            try
            {
                var o = RunSteps(db, steps);
                Exec(db, "committed".Equals(o[0] as string) ? "commit" : "rollback");
                return o;
            }
            catch { try { Exec(db, "rollback"); } catch { } throw; }
        }
        finally { raw.sqlite3_close_v2(db); }
    }

    static object[] RunSteps(sqlite3 db, object[] steps)
    {
        var answers = new List<object>(); var denied = new List<object>();
        long n = 0;
        foreach (var step in steps)
        {
            n++;
            var s = Arest.Seq(step);
            var kind = Text(s[0]); var sql = Text(s[1]);
            var ps = s.Length > 2 ? Arest.Seq(s[2]) : new object[0];
            var guard = s.Length > 3 && kind != "fix" ? Text(s[3]) : "";
            try
            {
                if (guard != "" && Query(db, guard, new object[0], true).Length == 0) { answers.Add(new object[0]); continue; }
                if (kind == "exec")
                {
                    var was = Changes(db);
                    if (ps.Length > 0) Step(db, sql, ps, true); else Exec(db, sql);
                    answers.Add(Changes(db) - was);
                }
                else if (kind == "rows") answers.Add(Query(db, sql, ps, true));
                else if (kind == "fix")
                {
                    var was = Changes(db);
                    for (long before = -1; before != Changes(db);) { before = Changes(db); Step(db, sql, ps, true); }
                    answers.Add(Changes(db) - was);
                }
                else if (kind == "refuse")
                {
                    var rows = Query(db, sql, ps, true);
                    if (rows.Length > 0) return new object[] { "refused", n, rows };
                    answers.Add(rows);
                }
                else if (kind == "deny")
                {
                    var rows = Query(db, sql, ps, true);
                    answers.Add(rows);
                    if (rows.Length > 0) denied.Add(new object[] { n, rows });
                }
                else throw new Exception("no step of kind " + kind);
            }
            catch (Exception e)
            {
                throw new Exception("sqlite:program, step " + n + " (" + kind + "): " + e.Message + " -- " + (sql.Length > 300 ? sql.Substring(0, 300) : sql));
            }
        }
        if (denied.Count > 0) return new object[] { "denied", denied.ToArray() };
        return new object[] { "committed", answers.ToArray() };
    }

    // PRAGMA data_version moves when ANOTHER connection commits, so it is asked on a connection kept read-only,
    // one per path, closed before its file is removed or renamed; sqlite:query reads on it too
    static readonly Dictionary<string, sqlite3> WATCHED = new Dictionary<string, sqlite3>(StringComparer.Ordinal);

    static sqlite3 Watched(string p)
    {
        sqlite3 db;
        if (!WATCHED.TryGetValue(p, out db)) { db = Open(p, true); WATCHED[p] = db; }
        return db;
    }

    static void Unwatch(string p)
    {
        sqlite3 db;
        if (WATCHED.TryGetValue(p, out db)) { WATCHED.Remove(p); try { raw.sqlite3_close_v2(db); } catch { } }
    }
}
