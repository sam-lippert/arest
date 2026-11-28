using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

// cs-runner -- the vocabulary's mu, STRICT, a peer of tools/java-runner/Arest.java and
// tools/js-runner/arest.js, written from the JS host line for line. A selector on an atom throws, a
// comparison across atom kinds throws, an out-of-range selection throws. Booleans are the atoms "T"
// and "F", a number is a 64-bit long whose arithmetic is checked (a result past 64 bits is bottom),
// a text is a string and a sequence an object[]. No meaning lives here and no speed: no memo and no
// twin, since a strategy a host keeps is one every other host must keep too. The laws are lambda's.
public static partial class Arest
{
    static readonly Dictionary<string, Func<object, object>> PRIMS =
        new Dictionary<string, Func<object, object>>(StringComparer.Ordinal);

    // Registration is INTO DEFS' surface: a registered function resolves through the one mu by name,
    // after any compiled cell of the same name, and a duplicate registration dies loud.
    public static void Register(string name, Func<object, object> impl)
    {
        if (PRIMS.ContainsKey(name)) throw new Exception("duplicate registration: " + name);
        PRIMS[name] = impl;
    }

    public static string Show(object x)
    {
        if (x is object[] a) return "<" + string.Join(", ", a.Select(Show)) + ">";
        if (x is long n) return n.ToString(CultureInfo.InvariantCulture);
        return x as string ?? Convert.ToString(x, CultureInfo.InvariantCulture);
    }

    public static object[] Seq(object x)
    {
        if (x is object[] a) return a;
        throw new Exception("expected sequence, got atom: " + Show(x));
    }

    public static object At(object x, int i)
    {
        var a = Seq(x);
        if (i < 0 || i >= a.Length) throw new Exception("index " + i + " out of " + a.Length);
        return a[i];
    }

    public static bool DeepEq(object a, object b)
    {
        if (a is string sa && b is string sb) return string.Equals(sa, sb, StringComparison.Ordinal);
        if (a is long la && b is long lb) return la == lb;
        if (a is object[] xa && b is object[] xb)
        {
            if (xa.Length != xb.Length) return false;
            for (int i = 0; i < xa.Length; i++) if (!DeepEq(xa[i], xb[i])) return false;
            return true;
        }
        return false;
    }

    static string Bool(bool b) { return b ? "T" : "F"; }

    // both numbers -> numeric; both texts -> UTF-16 code-unit order; anything else THROWS
    static int CmpAtoms(object a, object b)
    {
        if (a is long la && b is long lb) return la.CompareTo(lb);
        if (a is string sa && b is string sb) return Math.Sign(string.CompareOrdinal(sa, sb));
        throw new Exception("compare across atom kinds: " + Show(a) + " vs " + Show(b));
    }

    static long Int(object x)
    {
        if (x is long n) return n;
        throw new Exception("a number expected: " + Show(x));
    }

    static string PyStrip(string s, string cs)
    {
        int a = 0, b = s.Length;
        while (a < b && cs.IndexOf(s[a]) >= 0) a++;
        while (b > a && cs.IndexOf(s[b - 1]) >= 0) b--;
        return s.Substring(a, b - a);
    }

    static string PyRstrip(string s, string cs)
    {
        int b = s.Length;
        while (b > 0 && cs.IndexOf(s[b - 1]) >= 0) b--;
        return s.Substring(0, b);
    }

    static readonly Regex Quoted = new Regex("'[^']*'", RegexOptions.CultureInvariant);
    static readonly Regex Token = new Regex("[^ \\t\\n\\x0B\\f\\r]+", RegexOptions.CultureInvariant);

    static Arest()
    {
        // Backus's primitives (11.2.3), each as Arest.java defines it
        PRIMS["id"] = x => x;
        PRIMS["tl"] = x => { var a = Seq(x); if (a.Length == 0) throw new Exception("tl of <>"); return a.Skip(1).ToArray(); };
        PRIMS["atom"] = x => Bool(!(x is object[]));
        PRIMS["apndl"] = x => { var p = Seq(x); var t = Seq(p[1]); var r = new object[t.Length + 1]; r[0] = p[0]; Array.Copy(t, 0, r, 1, t.Length); return r; };
        PRIMS["apndr"] = x => { var p = Seq(x); var h = Seq(p[0]); var r = new object[h.Length + 1]; Array.Copy(h, r, h.Length); r[h.Length] = p[1]; return r; };
        PRIMS["distl"] = x => { var p = Seq(x); return Seq(p[1]).Select(e => (object)new[] { p[0], e }).ToArray(); };
        PRIMS["distr"] = x => { var p = Seq(x); return Seq(p[0]).Select(e => (object)new[] { e, p[1] }).ToArray(); };
        PRIMS["cat"] = x => { var p = Seq(x); var a = Seq(p[0]); var b = Seq(p[1]); var r = new object[a.Length + b.Length]; Array.Copy(a, r, a.Length); Array.Copy(b, 0, r, a.Length, b.Length); return r; };
        PRIMS["null"] = x => Bool(x is object[] s && s.Length == 0);
        PRIMS["eq"] = x => { var p = Seq(x); return Bool(DeepEq(p[0], p[1])); };
        PRIMS["not"] = x => Bool(!("T".Equals(x as string)));
        PRIMS["and"] = x => { var p = Seq(x); return Bool("T".Equals(p[0] as string) && "T".Equals(p[1] as string)); };
        PRIMS["length"] = x => (long)Seq(x).Length;
        PRIMS["lt"] = x => { var p = Seq(x); return Bool(CmpAtoms(p[0], p[1]) < 0); };
        PRIMS["le"] = x => { var p = Seq(x); return Bool(CmpAtoms(p[0], p[1]) <= 0); };
        PRIMS["ge"] = x => { var p = Seq(x); return Bool(CmpAtoms(p[0], p[1]) >= 0); };
        PRIMS["gt"] = x => { var p = Seq(x); return Bool(CmpAtoms(p[0], p[1]) > 0); };
        PRIMS["reverse"] = x => { var a = Seq(x); var r = (object[])a.Clone(); Array.Reverse(r); return r; };
        // trans: transpose a sequence of equal-length sequences
        PRIMS["trans"] = x =>
        {
            var rows = Seq(x);
            if (rows.Length == 0) return new object[0];
            int w = Seq(rows[0]).Length;
            var o = new object[w];
            for (int c = 0; c < w; c++) { var col = new object[rows.Length]; for (int r = 0; r < rows.Length; r++) col[r] = At(rows[r], c); o[c] = col; }
            return o;
        };
        // defined when both are numbers and the result is one, so a result past 64 bits is bottom
        PRIMS["+"] = x => { var p = Seq(x); return checked(Int(p[0]) + Int(p[1])); };
        PRIMS["-"] = x => { var p = Seq(x); return checked(Int(p[0]) - Int(p[1])); };
        PRIMS["*"] = x => { var p = Seq(x); return checked(Int(p[0]) * Int(p[1])); };
        PRIMS["/"] = x => { var p = Seq(x); return checked(Int(p[0]) / Int(p[1])); };
        PRIMS["apply"] = x => { var p = Seq(x); return Ev(p[0], p[1]); };
        // lex yields TOKEN-RECORDS, ten fields per token, as metamodel/resolution.md types it: tok,
        // nopunct, base, ordinal-suffix, lower, quoted-text, initial-cap, hyphen-template, is-quoted,
        // quote-index. White space is the ASCII set the Java station splits on.
        PRIMS["lex"] = x =>
        {
            var text = x as string;
            if (text == null) throw new Exception("lex of a non-text");
            var spans = new List<int[]>();
            foreach (Match m in Quoted.Matches(text)) spans.Add(new[] { m.Index, m.Index + m.Length });
            var rows = new List<object>();
            foreach (Match m in Token.Matches(text))
            {
                string tok = m.Value;
                int s = m.Index, e = s + tok.Length, k = 0;
                for (int i = 0; i < spans.Count; i++) if (s < spans[i][1] && spans[i][0] < e) { k = i + 1; break; }
                string qtext = "";
                if (k > 0)
                {
                    int a = Math.Max(s, spans[k - 1][0] + 1), b = Math.Min(e, spans[k - 1][1] - 1);
                    qtext = b > a ? text.Substring(a, b - a) : "";
                }
                string nopunct = PyStrip(tok, ".;:,");
                string bas = PyRstrip(nopunct, "0123456789");
                string tpl = tok;
                if (tpl.Length > 2 && tpl.EndsWith("--", StringComparison.Ordinal)) tpl = tpl.Substring(0, tpl.Length - 1);
                else if (tpl.Length > 2 && tpl.StartsWith("--", StringComparison.Ordinal)) tpl = tpl.Substring(1);
                else if (tpl.Length > 1 && tpl.EndsWith("-", StringComparison.Ordinal)) tpl = tpl.Substring(0, tpl.Length - 1);
                else if (tpl.Length > 1 && tpl.StartsWith("-", StringComparison.Ordinal)) tpl = tpl.Substring(1);
                string up = bas.Length > 0 && bas[0] >= 'A' && bas[0] <= 'Z' ? "T" : "F";
                rows.Add(new object[] { tok, nopunct, bas, nopunct.Substring(bas.Length), tok.ToLowerInvariant(), qtext, up, tpl, k > 0 ? "T" : "F", (long)k });
            }
            return rows.ToArray();
        };
        // implode joins atoms, numbers stringified; a sequence among them is bottom
        PRIMS["implode"] = x =>
        {
            var p = Seq(x);
            var sep = p[0] as string ?? Show(p[0]);
            return string.Join(sep, Seq(p[1]).Select(e => { if (e is object[]) throw new Exception("implode on sequence"); return Show(e); }));
        };
        // the char-level boundary: one atom per UTF-16 unit
        PRIMS["chars"] = x => { var s = x as string; if (s == null) throw new Exception("chars of a non-text"); return s.Select(c => (object)c.ToString()).ToArray(); };
        PRIMS["1r"] = x => { var a = Seq(x); if (a.Length == 0) throw new Exception("1r of <>"); return a[a.Length - 1]; };
        PRIMS["tlr"] = x => { var a = Seq(x); if (a.Length == 0) throw new Exception("tlr of <>"); return a.Take(a.Length - 1).ToArray(); };
    }

    public static object Ev(object f, object x)
    {
        if (f is long n)
        {
            if (!(x is object[] xs)) throw new Exception("selector " + n + " on atom: " + Show(x));
            if (n < 1 || n > xs.Length) throw new Exception("selector " + n + " out of range " + xs.Length);
            return xs[n - 1];
        }
        if (f is string s)
        {
            object body;
            if (DEFS.TryGetValue(s, out body)) return Ev(body, x);
            Func<object, object> prim;
            if (PRIMS.TryGetValue(s, out prim)) return prim(x);
            throw new Exception("unresolved atom: " + s);
        }
        var form = Seq(f);
        var head = form.Length > 0 ? form[0] as string : null;
        // tau clause (c), METACOMPOSITION (Backus 13.3.2): the head is FETCHED, so a form lambda defines
        // is lambda's; the forms below are the primitive arm, reached only when lambda defines none
        if (head == null || DEFS.ContainsKey(head)) return Ev(form[0], new object[] { f, x });
        switch (head)
        {
            case "COMP":
            {
                object v = x;
                for (int i = form.Length - 1; i >= 1; i--) v = Ev(form[i], v);
                return v;
            }
            case "COND": return "T".Equals(Ev(form[1], x) as string) ? Ev(form[2], x) : Ev(form[3], x);
            case "ALPHA": return Seq(x).Select(e => Ev(form[1], e)).ToArray();
            case "INSERT":
            {
                var xs = Seq(x);
                if (xs.Length == 0) throw new Exception("INSERT on empty");
                object acc = xs[xs.Length - 1];
                for (int i = xs.Length - 2; i >= 0; i--) acc = Ev(form[1], new object[] { xs[i], acc });
                return acc;
            }
            case "WHILE":
            {
                object v = x;
                while ("T".Equals(Ev(form[1], v) as string)) v = Ev(form[2], v);
                return v;
            }
        }
        throw new Exception("unknown form: " + head);
    }

    // Lambda recurses deeper than a default thread's stack, so the host evaluates on its own thread
    // with a stack as deep as the Java host's (-Xss512m).
    public static T Deep<T>(Func<T> work)
    {
        T r = default(T);
        Exception err = null;
        var th = new System.Threading.Thread(() => { try { r = work(); } catch (Exception e) { err = e; } }, 1 << 30);
        th.Start();
        th.Join();
        if (err != null) throw err;
        return r;
    }
}
