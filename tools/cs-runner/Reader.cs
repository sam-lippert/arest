using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// The lambda reader, a peer of tools/js-runner/arest.js's: a file is one parenthesized literal of
// text atoms and DEF(name, body) calls, the body written in A, N, K, PHI, S and S1..S9. Each
// constructor is held to its name (S3 with four elements, K with two, is refused and named, as the
// Java and JS readers refuse it), a number is read as a 64-bit long, and a file that is missing or
// does not parse is fatal.
public static class Reader
{
    sealed class P
    {
        public byte[] B;
        public int I;
        public string What;
        public string Def = "(top)";
        public List<string> Arity = new List<string>();

        public void Ws() { while (I < B.Length && char.IsWhiteSpace((char)B[I])) I++; }

        public bool Peek(char c) { Ws(); return I < B.Length && B[I] == (byte)c; }

        public void Need(char c)
        {
            Ws();
            if (I >= B.Length || B[I] != (byte)c)
                throw new Exception("lambda reader: " + What + " is not the DEF grammar: '" + c + "' expected at byte " + I + " in " + Def);
            I++;
        }

        public string Str()
        {
            Ws();
            if (I >= B.Length || B[I] != (byte)'"') throw new Exception("lambda reader: " + What + ": a text expected at byte " + I + " in " + Def);
            I++;
            var o = new MemoryStream();
            while (I < B.Length)
            {
                byte c = B[I];
                if (c == (byte)'\\' && I + 1 < B.Length)
                {
                    byte e = B[I + 1];
                    I += 2;
                    switch ((char)e)
                    {
                        case 'n': o.WriteByte((byte)'\n'); break;
                        case 'r': o.WriteByte((byte)'\r'); break;
                        case 't': o.WriteByte((byte)'\t'); break;
                        case '0': o.WriteByte(0); break;
                        case 'u':
                        {
                            // a UTF-16 unit in four hex digits, as the Java and JS readers take it; a surrogate pair
                            // written as two is one character
                            int u;
                            if (I + 4 <= B.Length && int.TryParse(Encoding.ASCII.GetString(B, I, 4), System.Globalization.NumberStyles.HexNumber, null, out u))
                            {
                                I += 4;
                                string ch = ((char)u).ToString();
                                int lo;
                                if (u >= 0xD800 && u <= 0xDBFF && I + 6 <= B.Length && B[I] == (byte)'\\' && B[I + 1] == (byte)'u'
                                    && int.TryParse(Encoding.ASCII.GetString(B, I + 2, 4), System.Globalization.NumberStyles.HexNumber, null, out lo)
                                    && lo >= 0xDC00 && lo <= 0xDFFF)
                                {
                                    ch = new string(new[] { (char)u, (char)lo });
                                    I += 6;
                                }
                                var bytes = Encoding.UTF8.GetBytes(ch);
                                o.Write(bytes, 0, bytes.Length);
                            }
                            else o.WriteByte((byte)'u');
                            break;
                        }
                        case 'x':
                        {
                            var h = Encoding.ASCII.GetString(B, I, 2);
                            var bytes = Encoding.UTF8.GetBytes(((char)Convert.ToInt32(h, 16)).ToString());
                            o.Write(bytes, 0, bytes.Length);
                            I += 2;
                            break;
                        }
                        default: o.WriteByte(e); break;
                    }
                    continue;
                }
                if (c == (byte)'"') { I++; return Encoding.UTF8.GetString(o.ToArray()); }
                o.WriteByte(c);
                I++;
            }
            throw new Exception("lambda reader: " + What + ": an unterminated text in " + Def);
        }

        string Word()
        {
            Ws();
            int s = I;
            while (I < B.Length && (char.IsLetterOrDigit((char)B[I]) || B[I] == (byte)'_')) I++;
            return Encoding.ASCII.GetString(B, s, I - s);
        }

        List<object> Args()
        {
            Need('(');
            var a = new List<object>();
            if (Peek(')')) { I++; return a; }
            while (true)
            {
                a.Add(Expr());
                if (Peek(',')) { I++; if (Peek(')')) { I++; return a; } continue; }
                Need(')');
                return a;
            }
        }

        public object Expr()
        {
            Ws();
            if (I < B.Length && B[I] == (byte)'"') return Str();
            int at = I;
            var w = Word();
            switch (w)
            {
                case "A":
                {
                    Need('('); var s = Str(); Need(')');
                    return Arest.A(s);
                }
                case "N":
                {
                    Need('('); Ws();
                    int st = I;
                    if (I < B.Length && B[I] == (byte)'-') I++;
                    while (I < B.Length && B[I] >= (byte)'0' && B[I] <= (byte)'9') I++;
                    long n;
                    if (!long.TryParse(Encoding.ASCII.GetString(B, st, I - st), out n))
                        throw new Exception("lambda reader: " + What + ": a number past 64 bits in " + Def);
                    Need(')');
                    return Arest.N(n);
                }
                case "PHI": Need('('); Need(')'); return Arest.PHI();
                case "K":
                {
                    var a = Args();
                    if (a.Count != 1) Arity.Add("K with " + a.Count + " elements in " + Def);
                    return Arest.K(a.Count > 0 ? a[0] : null);
                }
                case "S": return Args().ToArray();
            }
            if (w.Length == 2 && w[0] == 'S' && w[1] >= '1' && w[1] <= '9')
            {
                int n = w[1] - '0';
                var a = Args();
                if (a.Count != n) Arity.Add(w + " with " + a.Count + " elements in " + Def);
                return a.ToArray();
            }
            throw new Exception("lambda reader: " + What + " is not the DEF grammar: '" + w + "' at byte " + at + " in " + Def);
        }
    }

    // Read one literal, calling def for each DEF in file order.
    static void Parse(byte[] src, string what, Action<string, object> def)
    {
        var p = new P { B = src, I = 0, What = what };
        // TWO FORMS: one parenthesized literal of elements, or one statement each, `DEF("name", body);` defining and
        // `DOC("text");` defining nothing. A file is the second where it does not open with a paren.
        p.Ws();
        if (p.I < p.B.Length && p.B[p.I] != (byte)'(')
        {
            while (true)
            {
                p.Ws();
                if (p.I >= p.B.Length) break;
                if (p.I + 4 <= p.B.Length && Encoding.ASCII.GetString(p.B, p.I, 4) == "DEF(")
                {
                    p.I += 4;
                    var name = p.Str();
                    p.Def = name;
                    p.Need(',');
                    var body = p.Expr();
                    if (p.Peek(',')) p.I++;
                    p.Need(')');
                    p.Need(';');
                    def(name, body);
                    continue;
                }
                if (p.I + 4 <= p.B.Length && Encoding.ASCII.GetString(p.B, p.I, 4) == "DOC(")
                {
                    p.I += 4;
                    p.Str();
                    p.Need(')');
                    p.Need(';');
                    continue;
                }
                throw new Exception("lambda reader: " + what + " is not the DEF grammar at byte " + p.I);
            }
            if (p.Arity.Count > 0)
                throw new Exception("lambda reader: " + what + ": " + p.Arity.Count + " constructors whose name is not their length:\n  " + string.Join("\n  ", p.Arity));
            return;
        }
        p.Need('(');
        while (true)
        {
            p.Ws();
            if (p.I >= p.B.Length) throw new Exception("lambda reader: " + what + ": the literal is not closed");
            if (p.B[p.I] == (byte)')') { p.I++; break; }
            if (p.B[p.I] == (byte)'"') p.Str();
            else
            {
                int at = p.I;
                if (!(p.I + 4 <= p.B.Length && Encoding.ASCII.GetString(p.B, p.I, 4) == "DEF("))
                    throw new Exception("lambda reader: " + what + " is not the DEF grammar at byte " + at);
                p.I += 4;
                var name = p.Str();
                p.Def = name;
                p.Need(',');
                var body = p.Expr();
                if (p.Peek(',')) p.I++;
                p.Need(')');
                def(name, body);
            }
            if (p.Peek(',')) p.I++;
        }
        p.Ws();
        if (p.I < p.B.Length) throw new Exception("lambda reader: " + what + ": text after the literal at byte " + p.I);
        if (p.Arity.Count > 0)
            throw new Exception("lambda reader: " + what + ": " + p.Arity.Count + " constructors whose name is not their length:\n  " + string.Join("\n  ", p.Arity));
    }

    public static void Load(string path)
    {
        byte[] src;
        try { src = File.ReadAllBytes(path); }
        catch (Exception e) { throw new Exception("lambda reader: cannot read " + path + ": " + e.Message); }
        LOADED[path] = System.Text.Encoding.UTF8.GetString(src);
        Parse(src, path, (name, body) => Arest.DEF(name, body));
    }

    // The text of each file read, as it was read, by the path it was read from (module:text answers lambda's).
    public static readonly Dictionary<string, string> LOADED = new Dictionary<string, string>(StringComparer.Ordinal);

    // A carrier's text to the <CELL, name, body> list DEF would have made of it, registering nothing.
    public static object[] Cells(string text)
    {
        var o = new List<object>();
        Parse(Encoding.UTF8.GetBytes(text), "carrier text", (name, body) => o.Add(new object[] { "CELL", name, body }));
        return o.ToArray();
    }

    // THE BASE IS NAMED, NOT READ, as the Java and JS hosts name it: where dir holds store.db, the cells
    // name it in state:base_db and lambda reads it whole at boot.
    public static void LoadBase(string dir)
    {
        var db = System.IO.Path.Combine(dir, "store.db");
        if (File.Exists(db))
        {
            Arest.CELLS.Add(new object[] { "CELL", "state:base_db", System.IO.Path.GetFullPath(db).Replace('\\', '/') });
            return;
        }
        Console.Error.Write("no base at " + dir + ": nothing composed under the readings\n");
    }

    public static string Path(string var, string dflt)
    {
        var v = Environment.GetEnvironmentVariable(var);
        return string.IsNullOrEmpty(v) ? dflt : v;
    }
}
