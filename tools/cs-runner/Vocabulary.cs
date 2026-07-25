using System;
using System.Collections.Generic;

// The registration vocabulary — exactly the intersection's fourteen names
// (DEF, A, N, K, PHI, S1..S9) plus CANON, the varargs wrap that turns the
// canon's one tuple literal into a compiled method call. DEF accumulates
// the composed store (one CELL per registered name) so the store reads
// itself. Nothing else belongs in this file, ever: a host supplies the
// vocabulary, the mu, the base primitives, and the registered boundary
// rows — accretion is how the last two runners died.
public static partial class Arest
{
    public static readonly Dictionary<string, object> DEFS =
        new Dictionary<string, object>(StringComparer.Ordinal);
    public static readonly List<object> CELLS = new List<object>();

    public static object DEF(string name, object body)
    {
        DEFS.Add(name, body); // a duplicate throws by collection semantics; law:one_name is the law
        CELLS.Add(new object[] { "CELL", name, body });
        return name;
    }

    public static object A(string s) { return s; }
    public static object N(int n) { return n; }
    public static object K(object x) { return new object[] { "CONST", x }; }
    public static object PHI() { return new object[0]; }

    // Backus 13.2 rule 4: a sequence has arbitrary length n. S1..S9 is notation;
    // a carrier longer than 9 must not encode its length as depth, because depth
    // already means tenancy here (backus78 14.7, AREST.tex prop:tenant).
    public static object S(params object[] a) { return a; }

    public static object S1(object a) { return new[] { a }; }
    public static object S2(object a, object b) { return new[] { a, b }; }
    public static object S3(object a, object b, object c) { return new[] { a, b, c }; }
    public static object S4(object a, object b, object c, object d) { return new[] { a, b, c, d }; }
    public static object S5(object a, object b, object c, object d, object e) { return new[] { a, b, c, d, e }; }
    public static object S6(object a, object b, object c, object d, object e, object f) { return new[] { a, b, c, d, e, f }; }
    public static object S7(object a, object b, object c, object d, object e, object f, object g) { return new[] { a, b, c, d, e, f, g }; }
    public static object S8(object a, object b, object c, object d, object e, object f, object g, object h) { return new[] { a, b, c, d, e, f, g, h }; }
    public static object S9(object a, object b, object c, object d, object e, object f, object g, object h, object i) { return new[] { a, b, c, d, e, f, g, h, i }; }

    public static object CANON(params object[] xs) { return xs; }
}
