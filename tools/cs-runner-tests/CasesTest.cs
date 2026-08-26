// The C# host's own unit tests. `dotnet test` -- no python, no second host.
//
// Every host runs the same canon over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv and agreement follows because they
// all match the same file. Verifying this host needs the dotnet SDK and
// nothing else.
//
// The canon is loaded ONCE for the assembly, not per case: Reader.Load mutates
// Arest.CELLS, so loading per test would stack the canon on itself 566 times.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Xunit;

public static class Canon
{
    static readonly object Gate = new object();
    static bool loaded;

    public static string Shared(string name)
    {
        var dir = AppContext.BaseDirectory;
        // walk up to the repo root: bin/Debug/net8.0 -> cs-runner-tests -> tools -> arest
        var d = new DirectoryInfo(dir);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "arest"))) d = d.Parent;
        if (d == null) throw new InvalidOperationException("repo root not found from " + dir);
        return Path.Combine(d.FullName, "engine", "shared", name);
    }

    public static string Root()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "arest"))) d = d.Parent;
        return d.FullName;
    }

    public static void Load()
    {
        lock (Gate)
        {
            if (loaded) return;
            var r = Root();
            // the same four reads Program.cs does, in the same order, with
            // absolute paths because a test host's working directory is its
            // output folder rather than the runner's
            Reader.Load(Path.Combine(r, "arest"));
            Reader.Load(Path.Combine(r, "tools", "norma-oracle", "design-state"));
            Reader.Load(Path.Combine(r, "tools", "norma-oracle", "norma-answer"));
            Reader.Load(Path.Combine(r, "engine", "shared", "scenarios.canon"));
            loaded = true;
        }
    }

    // THE BOTTOM ROWS ARE THE POINT. canon's note above main:case_text says one
    // case per invocation is deliberate: the table holds rows that BOTTOM, no
    // canon def can branch on bottom, and a fold would die at the first one.
    // The CLI makes a bottom visible by dying and the driver recorded
    // <refused>. In-process the boundary is a catch, and it has to be here or
    // the deliberate refusals read as broken tests.
    public static string Answer(string name)
    {
        try
        {
            var argv = new object[] { "case", name };
            var outp = (object[])Arest.Ev("main",
                new object[] { Arest.CELLS.ToArray(), argv });
            var text = outp[0] as string;
            return string.IsNullOrWhiteSpace(text) ? "<refused>" : text.Trim();
        }
        catch
        {
            return "<refused>";
        }
    }

    public static List<KeyValuePair<string, string>> Golden()
    {
        var rows = new List<KeyValuePair<string, string>>();
        foreach (var line in File.ReadAllLines(Shared("expected-cases.tsv")))
        {
            if (line.Length == 0) continue;
            var t = line.IndexOf('\t');
            rows.Add(new KeyValuePair<string, string>(
                line.Substring(0, t), Unescape(line.Substring(t + 1))));
        }
        return rows;
    }

    // A JSON string literal back to its text. The golden encodes answers that
    // way because two of them are SQL DDL carrying real newlines.
    public static string Unescape(string lit)
    {
        lit = lit.Trim();
        var s = new StringBuilder();
        int i = lit.StartsWith("\"") ? 1 : 0;
        int end = lit.EndsWith("\"") ? lit.Length - 1 : lit.Length;
        while (i < end)
        {
            if (lit[i] != '\\') { s.Append(lit[i]); i++; continue; }
            i++;
            switch (lit[i])
            {
                case 'n': s.Append('\n'); break;
                case 't': s.Append('\t'); break;
                case 'r': s.Append('\r'); break;
                case 'b': s.Append('\b'); break;
                case 'f': s.Append('\f'); break;
                case 'u':
                    s.Append((char)Convert.ToInt32(lit.Substring(i + 1, 4), 16));
                    i += 4;
                    break;
                default: s.Append(lit[i]); break;
            }
            i++;
        }
        return s.ToString();
    }
}

public class CasesTest
{
    public static IEnumerable<object[]> Cases()
    {
        foreach (var kv in Canon.Golden()) yield return new object[] { kv.Key, kv.Value };
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void EveryCaseAnswersWhatTheCanonSays(string name, string want)
    {
        Canon.Load();
        Assert.Equal(want, Canon.Answer(name));
    }

    // A def NO host can evaluate answers <refused> everywhere and agrees
    // perfectly, so the refusal COUNT is the signal, not the pass line.
    [Fact]
    public void TheGoldenStillExpectsExactlySeventeenRefusals()
    {
        Assert.Equal(17, Canon.Golden().Count(kv => kv.Value == "<refused>"));
    }

    [Fact]
    public void LawReportHoldsByteForByte()
    {
        Canon.Load();
        var want = File.ReadAllText(Canon.Shared("expected-laws.txt")).Trim();
        var outp = (object[])Arest.Ev("main",
            new object[] { Arest.CELLS.ToArray(), new object[] { } });
        Assert.Equal(want, ((string)outp[0]).Trim());
    }
}
