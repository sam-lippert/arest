using System;
using System.Collections.Generic;

// The vocabulary lambda is written in (DEF, A, N, K, PHI, S1..S9), bound to C# values: an atom is a
// string, a number a 64-bit long (as Java's Long and the JS host's 64-bit BigInt), a sequence an
// object[]. DEF registers a cell; a second DEF of one name is refused, as every host refuses it.
public static partial class Arest
{
    public static readonly Dictionary<string, object> DEFS =
        new Dictionary<string, object>(StringComparer.Ordinal);
    public static readonly List<object> CELLS = new List<object>();

    public static object DEF(string name, object body)
    {
        if (DEFS.ContainsKey(name)) throw new Exception("duplicate DEF: " + name);
        DEFS.Add(name, body);
        CELLS.Add(new object[] { "CELL", name, body });
        return name;
    }

    public static object A(string s) { return s; }
    public static object N(long n) { return n; }
    public static object K(object x) { return new object[] { "CONST", x }; }
    public static object PHI() { return new object[0]; }
}
