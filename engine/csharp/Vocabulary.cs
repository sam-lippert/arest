// The C# binding of the INTERSECTION SOURCE vocabulary
// (shared/intersection.md): the same names CPython execs, rustc tokenizes,
// and the Java host compiles. RoslynLoader compiles the raw shared/*.canon
// bytes in memory against these (a generated CanonGen `using static`s them),
// so the C# compiler tokenizes exactly the bytes the other hosts do -- no
// MSBuild byte-wrap, no generated Canon.g.cs, no JSON store. Trees build in
// the delta evaluator's native form: an atom is a scalar (string/long), a
// sequence is an object[], K(x) is the pair ("CONST", x). Public so the
// in-memory CanonGen (a separate class in a fresh assembly) can call them.
namespace Arestlam;

// public so the in-memory CanonGen (a separate Roslyn assembly) can
// `using static` this class; Defs stays internal (only the host reads it).
public static class Canon
{
    internal static readonly List<KeyValuePair<string, object>> Defs = new();

    public static object T(params object[] elements) => elements;

    public static object DEF(string name, object tree)
    {
        Defs.Add(new KeyValuePair<string, object>(name, tree));
        return name;
    }

    public static object A(string s) => s;
    public static object A(long i) => i;
    public static object N(long i) => i;
    public static object PHI() => Array.Empty<object>();
    public static object K(object x) => new object[] { "CONST", x };

    public static object S1(object a) => new[] { a };
    public static object S2(object a, object b) => new[] { a, b };
    public static object S3(object a, object b, object c) => new[] { a, b, c };
    public static object S4(object a, object b, object c, object d)
        => new[] { a, b, c, d };
    public static object S5(object a, object b, object c, object d, object e)
        => new[] { a, b, c, d, e };
    public static object S6(object a, object b, object c, object d, object e,
                            object f) => new[] { a, b, c, d, e, f };
    public static object S7(object a, object b, object c, object d, object e,
                            object f, object g) => new[] { a, b, c, d, e, f, g };
    public static object S8(object a, object b, object c, object d, object e,
                            object f, object g, object h)
        => new[] { a, b, c, d, e, f, g, h };
    public static object S9(object a, object b, object c, object d, object e,
                            object f, object g, object h, object i)
        => new[] { a, b, c, d, e, f, g, h, i };
}
