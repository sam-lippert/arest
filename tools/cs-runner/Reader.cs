using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// ============================ the canon READER ================================
// The canon, the case table and the carriers READ AT RUNTIME, replacing the
// csproj's copy /b of head.part + arest + mid1.part + design-state + ... into
// Composed.g.cs.
//
// That concatenation is the cheapest of the four compose steps -- byte
// concatenation, the linker's job -- but it still puts the whole canon through
// the C# compiler on every canon edit, and it means this station holds the
// program as object code where js, java and rust-station now read it. The
// intersection source's claim is that ONE file is read by every host; a host
// that compiles it in cannot be handed a different D.
//
// Fourth and last of these readers. The platforms differ only in what a value
// is: A is a string here, N an int, PHI an empty object[], K an object[] of
// "CONST" and x, SN an object[]. Same grammar, same four names, same order.
//
//     file := '(' item* ')'
//     item := note | def
//     def  := 'DEF' '(' STRING ',' expr ')' ','?
//     expr := A(STRING) | N(INT) | K(expr) | PHI() | S(expr,..) | S1..S9(..)
public static class Reader
{
    private readonly struct Nothing { }

    private sealed class P
    {
        public byte[] B;
        public int I;

        public void Ws()
        {
            while (I < B.Length && char.IsWhiteSpace((char)B[I])) I++;
        }

        public bool Eat(string s)
        {
            Ws();
            var t = Encoding.UTF8.GetBytes(s);
            if (I + t.Length > B.Length) return false;
            for (int k = 0; k < t.Length; k++) if (B[I + k] != t[k]) return false;
            I += t.Length;
            return true;
        }

        public string Str()
        {
            Ws();
            if (I >= B.Length || B[I] != (byte)'"') return null;
            I++;
            var outp = new StringBuilder();
            while (I < B.Length)
            {
                byte c = B[I];
                if (c == (byte)'\\' && I + 1 < B.Length)
                {
                    // the escapes the base uses: quotes, newlines, backslashes,
                    // CRs and one \x1f (derive:txn_surrogate's unit separator)
                    byte e = B[I + 1];
                    I += 2;
                    switch ((char)e)
                    {
                        case 'n': outp.Append('\n'); break;
                        case 'r': outp.Append('\r'); break;
                        case 't': outp.Append('\t'); break;
                        case '0': outp.Append('\0'); break;
                        case 'x':
                            if (I + 1 < B.Length)
                            {
                                var h = Encoding.UTF8.GetString(B, I, 2);
                                if (int.TryParse(h, System.Globalization.NumberStyles.HexNumber,
                                                 null, out int v))
                                {
                                    outp.Append((char)v);
                                    I += 2;
                                }
                            }
                            break;
                        default: outp.Append((char)e); break;
                    }
                    continue;
                }
                if (c == (byte)'"') { I++; return outp.ToString(); }
                int len = 1;
                if ((c & 0x80) != 0)
                {
                    if ((c & 0xE0) == 0xC0) len = 2;
                    else if ((c & 0xF0) == 0xE0) len = 3;
                    else if ((c & 0xF8) == 0xF0) len = 4;
                }
                len = Math.Min(len, B.Length - I);
                outp.Append(Encoding.UTF8.GetString(B, I, len));
                I += len;
            }
            return null;
        }

        public object Expr()
        {
            Ws();
            if (Eat("PHI(")) { Eat(")"); return Arest.PHI(); }
            if (Eat("A(")) { var s = Str(); Eat(")"); return Arest.A(s); }
            if (Eat("N("))
            {
                Ws();
                int st = I;
                if (I < B.Length && B[I] == (byte)'-') I++;
                while (I < B.Length && B[I] >= (byte)'0' && B[I] <= (byte)'9') I++;
                int n = int.Parse(Encoding.UTF8.GetString(B, st, I - st));
                Eat(")");
                return Arest.N(n);
            }
            if (Eat("K(")) { var x = Expr(); Eat(")"); return Arest.K(x); }
            Ws();
            if (I + 1 < B.Length && B[I] == (byte)'S')
            {
                int argc = -1, skip = 0;
                if (B[I + 1] == (byte)'(') { argc = -2; skip = 2; }          // variadic
                else if (I + 2 < B.Length && B[I + 1] >= (byte)'1' && B[I + 1] <= (byte)'9'
                         && B[I + 2] == (byte)'(') { argc = B[I + 1] - (byte)'0'; skip = 3; }
                if (argc != -1)
                {
                    I += skip;
                    var parts = new List<object>();
                    if (argc == -2)
                    {
                        while (true)
                        {
                            Ws();
                            if (I < B.Length && B[I] == (byte)')') { I++; break; }
                            if (parts.Count > 0 && !Eat(",")) return null;
                            parts.Add(Expr());
                        }
                    }
                    else
                    {
                        for (int k = 0; k < argc; k++)
                        {
                            if (k > 0 && !Eat(",")) return null;
                            parts.Add(Expr());
                        }
                        Eat(")");
                    }
                    return parts.ToArray();
                }
            }
            return null;
        }
    }

    // Read one file and register it, in file order. A file that is missing or
    // does not parse is FATAL, never skipped: a station that quietly registers
    // nothing answers <refused> to every case, which reads as silence rather
    // than as an error.
    // A CARRIER THE ORACLE HAS NOT WRITTEN IS ABSENT, NOT EMPTY, and absent is
    // legitimate: a store that was never compiled pays the rmap derivation, a
    // run that recorded no outcome has none, a fresh journal has no entries.
    // js-runner/build.js splices each of these only when it is there, and the
    // compiled map only when its stamp still matches the design-state it was
    // compiled from -- a stale map is a different store, not a faster one.
    public static void LoadOptional(string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length == 0) return;
        Load(path);
    }

    public static void LoadCompiled(string path, string designState)
    {
        if (!File.Exists(path) || !File.Exists(designState)) return;
        var head = File.ReadAllText(path);
        var at = head.IndexOf("AREST_COMPILED_FROM=", StringComparison.Ordinal);
        if (at < 0) return;
        var stamped = head.Substring(at + 20, 16);
        string now;
        using (var sha = System.Security.Cryptography.SHA256.Create())
        {
            var hash = sha.ComputeHash(File.ReadAllBytes(designState));
            var sb = new System.Text.StringBuilder();
            foreach (var b in hash) sb.Append(b.ToString("x2"));
            now = sb.ToString().Substring(0, 16);
        }
        if (stamped == now) Load(path);
    }

    // The journal is APPEND-ONLY and is a FRAGMENT: it opens with a comma and
    // carries no parenthesis of its own, because every entry is appended bytes
    // and never a rewrite. The js host splices it as CANON("journal", ...entries);
    // wrapping it here is the same act in this reader's grammar.
    public static void LoadJournal(string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length == 0) return;
        var body = File.ReadAllBytes(path);
        var open = System.Text.Encoding.UTF8.GetBytes("(\"journal\"");
        var close = System.Text.Encoding.UTF8.GetBytes(")");
        var src = new byte[open.Length + body.Length + close.Length];
        Buffer.BlockCopy(open, 0, src, 0, open.Length);
        Buffer.BlockCopy(body, 0, src, open.Length, body.Length);
        Buffer.BlockCopy(close, 0, src, open.Length + body.Length, close.Length);
        Parse(src, path);
    }

    public static void Load(string path)
    {
        byte[] src;
        try { src = File.ReadAllBytes(path); }
        catch (Exception e)
        {
            throw new Exception("canon reader: cannot read " + path + ": " + e.Message);
        }
        Parse(src, path);
    }

    static void Parse(byte[] src, string path)
    {
        var p = new P { B = src, I = 0 };
        p.Eat("(");
        while (true)
        {
            p.Ws();
            if (p.I >= p.B.Length) break;
            if (p.B[p.I] == (byte)')') { p.I++; continue; }
            if (p.B[p.I] == (byte)'"') { p.Str(); p.Eat(","); continue; }
            if (p.Eat("DEF("))
            {
                var name = p.Str();
                if (!p.Eat(",")) throw new Exception("canon reader: " + path + " bad DEF");
                var body = p.Expr();
                p.Eat(")");
                p.Eat(",");
                Arest.DEF(name, body);
                continue;
            }
            throw new Exception("canon reader: " + path + " is not the DEF grammar");
        }
    }

    public static string Path(string var, string dflt)
    {
        var v = Environment.GetEnvironmentVariable(var);
        return string.IsNullOrEmpty(v) ? dflt : v;
    }
}
