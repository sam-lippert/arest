using System;
using System.Collections.Generic;
using System.Linq;

// The mu: atoms resolve through DEFS then the primitives, numbers are
// selectors, sequences are the functional forms (COMP right-to-left, CONS,
// CONST, COND, ALPHA, INSERT as a right fold, WHILE). The primitives are
// Backus 11.2.3 plus the registered boundary rows of resolution.md (lex,
// implode, slug, escape_html, strip_prefix, 1r, tlr). Booleans are the
// atoms "T" and "F". No law semantics live here.
public static partial class Arest
{
    public static bool DeepEq(object a, object b)
    {
        if (ReferenceEquals(a, b)) return true;
        if (a is string sa && b is string sb) return string.Equals(sa, sb, StringComparison.Ordinal);
        if (a is int ia && b is int ib) return ia == ib;
        if (a is object[] xa && b is object[] xb)
        {
            if (xa.Length != xb.Length) return false;
            for (int i = 0; i < xa.Length; i++) if (!DeepEq(xa[i], xb[i])) return false;
            return true;
        }
        return false;
    }

    static string Bool(bool b) { return b ? "T" : "F"; }
    static object[] Seq(object x) { return (object[])x; }

    static int CompareAtoms(object a, object b)
    {
        if (a is int ia && b is int ib) return ia.CompareTo(ib);
        return string.CompareOrdinal((string)a, (string)b);
    }

    static readonly Dictionary<string, Func<object, object>> PRIMS =
        new Dictionary<string, Func<object, object>>(StringComparer.Ordinal)
    {
        { "id", x => x },
        { "tl", x => { var a = Seq(x); if (a.Length == 0) throw new InvalidOperationException("tl on empty"); return a.Skip(1).ToArray(); } },
        { "atom", x => Bool(!(x is object[])) },
        { "apndl", x => { var p = Seq(x); return new[] { p[0] }.Concat(Seq(p[1])).ToArray(); } },
        { "apndr", x => { var p = Seq(x); return Seq(p[0]).Concat(new[] { p[1] }).ToArray(); } },
        { "distl", x => { var p = Seq(x); return Seq(p[1]).Select(e => (object)new[] { p[0], e }).ToArray(); } },
        { "distr", x => { var p = Seq(x); return Seq(p[0]).Select(e => (object)new[] { e, p[1] }).ToArray(); } },
        { "cat", x => { var p = Seq(x); return Seq(p[0]).Concat(Seq(p[1])).ToArray(); } },
        { "null", x => Bool(x is object[] s && s.Length == 0) },
        { "eq", x => { var p = Seq(x); return Bool(DeepEq(p[0], p[1])); } },
        { "not", x => Bool(!(x is string s && s == "T")) },
        { "and", x => { var p = Seq(x); return Bool((p[0] as string) == "T" && (p[1] as string) == "T"); } },
        { "length", x => Seq(x).Length },
        { "le", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) <= 0); } },
        { "ge", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) >= 0); } },
        { "gt", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) > 0); } },
        { "+", x => { var p = Seq(x); return (int)p[0] + (int)p[1]; } },
        { "apply", x => { var p = Seq(x); return Ev(p[0], p[1]); } },
        { "lex", x => ((string)x).Split((char[])null, StringSplitOptions.RemoveEmptyEntries).Cast<object>().ToArray() },
        { "implode", x => { var p = Seq(x); return string.Join((string)p[0], Seq(p[1]).Cast<string>()); } },
        { "slug", x => new string(((string)x).ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray()) },
        { "escape_html", x => ((string)x).Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;") },
        { "strip_prefix", x => { var p = Seq(x); var pre = (string)p[0]; var t = (string)p[1];
            return t.Length > pre.Length && t.StartsWith(pre, StringComparison.Ordinal) ? t.Substring(pre.Length) : t; } },
        { "1r", x => Seq(x)[Seq(x).Length - 1] },
        { "tlr", x => { var a = Seq(x); if (a.Length == 0) throw new InvalidOperationException("tlr on empty"); return a.Take(a.Length - 1).ToArray(); } },
    };

    public static object Ev(object f, object x)
    {
        if (f is int n)
        {
            if (!(x is object[])) throw new Exception("selector " + n + " on atom: " + x);
            return Seq(x)[n - 1];
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
        var head = form[0] as string;
        switch (head)
        {
            case "COMP":
            {
                object v = x;
                for (int i = form.Length - 1; i >= 1; i--) v = Ev(form[i], v);
                return v;
            }
            case "CONS":
            {
                var outp = new object[form.Length - 1];
                for (int i = 1; i < form.Length; i++) outp[i - 1] = Ev(form[i], x);
                return outp;
            }
            case "CONST": return form[1];
            case "COND": return (Ev(form[1], x) as string) == "T" ? Ev(form[2], x) : Ev(form[3], x);
            case "ALPHA": return Seq(x).Select(e => Ev(form[1], e)).ToArray();
            case "INSERT":
            {
                var xs = Seq(x);
                object acc = xs[xs.Length - 1];
                for (int i = xs.Length - 2; i >= 0; i--) acc = Ev(form[1], new[] { xs[i], acc });
                return acc;
            }
            case "WHILE":
            {
                object v = x;
                while ((Ev(form[1], v) as string) == "T") v = Ev(form[2], v);
                return v;
            }
        }
        throw new Exception("unknown form: " + head);
    }
}
