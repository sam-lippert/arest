// The C# host's own unit tests. `dotnet test` -- no python, no second host.
//
// Every host runs the same lambda over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv and agreement follows because they
// all match the same file. Verifying this host needs the dotnet SDK and
// nothing else.
//
// The lambda is loaded ONCE for the assembly, not per case: Reader.Load mutates
// Arest.CELLS, so loading per test would stack the lambda on itself 566 times.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Xunit;

public static class Lambda
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
            Reader.Load(Path.Combine(r, "arest.tests"));
            Reader.Load(Path.Combine(r, "tools", "norma-oracle", "design-state"));
            Reader.Load(Path.Combine(r, "tools", "norma-oracle", "norma-answer"));
            Reader.Load(Path.Combine(r, "engine", "shared", "scenarios.canon"));
            // the two carriers js-runner/build.js also splices, on the same
            // terms: the compiled map only while its stamp matches the
            // design-state, the outcome only when the oracle wrote one. There
            // is no third: the journal is gone (Samuel, 2026-09-11).
            Reader.LoadCompiled(Path.Combine(r, "tools", "norma-oracle", "compiled"),
                                Path.Combine(r, "tools", "norma-oracle", "design-state"));
            Reader.LoadOptional(Path.Combine(r, "tools", "norma-oracle", "outcome"));
            // and the store is BOOTED, which is what the two hosts differed on
            Arest.Boot();
            loaded = true;
        }
    }

    // THE BOTTOM ROWS ARE THE POINT. lambda's note above main:case_text says one
    // case per invocation is deliberate: the table holds rows that BOTTOM, no
    // lambda def can branch on bottom, and a fold would die at the first one.
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
        foreach (var kv in Lambda.Golden()) yield return new object[] { kv.Key, kv.Value };
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void EveryCaseAnswersWhatTheLambdaSays(string name, string want)
    {
        Lambda.Load();
        Assert.Equal(want, Lambda.Answer(name));
    }

    // A def NO host can evaluate answers <refused> everywhere and agrees
    // perfectly, so the refusal COUNT is the signal, not the pass line.
    [Fact]
    public void TheGoldenStillExpectsExactlySeventeenRefusals()
    {
        // 19 since 4cc9f726 (2026-09-02, a nested population is one row per fact);
        // the js host has no count test, so this one lagged the golden by a day
        Assert.Equal(19, Lambda.Golden().Count(kv => kv.Value == "<refused>"));
    }

    // The law report is the gate, and no copy of it is kept (2026-10-02): main
    // answers its text beside a verdict that is T exactly when every law holds.
    [Fact]
    public void LawReportHolds()
    {
        Lambda.Load();
        var outp = (object[])Arest.Ev("main",
            new object[] { Arest.CELLS.ToArray(), new object[] { } });
        var lines = ((string)outp[0]).TrimEnd().Split('\n');
        Assert.Empty(lines.Where(l => !l.StartsWith("  test OK: ") && !l.StartsWith("ALL TESTS PASS ")));
        Assert.Equal("T", outp[1]?.ToString());
    }
}
