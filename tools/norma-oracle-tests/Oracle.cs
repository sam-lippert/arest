// The oracle under test, driven as the process it ships as. The exe writes
// its carriers into its working directory, so every run gets a scratch
// directory under _reports/, and what a test reads back is what probes.sh
// and regress.sh used to extract with grep and awk: the blocking-error
// total, the UNBUILT lines, the read-back verdicts, the verbalized rule
// blocks, the built heads with multiplicity.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Arest.NormaOracle.Tests
{
    public static class Oracle
    {
        public static readonly string Root = FindRoot();

        static string FindRoot()
        {
            var d = new DirectoryInfo(AppContext.BaseDirectory);
            while (d != null && !File.Exists(Path.Combine(d.FullName, "tools", "norma-oracle", "norma-oracle.csproj")))
            {
                d = d.Parent;
            }
            if (d == null)
            {
                throw new InvalidOperationException("the arest repository root is not above " + AppContext.BaseDirectory);
            }
            return d.FullName;
        }

        public static string Exe
        {
            get { return Path.Combine(Root, "tools", "norma-oracle", "bin", "Debug", "norma-oracle.exe"); }
        }

        // NORMA_ORACLE_RECORD=1 writes what the oracle produced as the
        // expectation instead of asserting. Read it first: an expectation
        // records the meaning you verified, not whatever came out.
        public static bool Recording
        {
            get { return Environment.GetEnvironmentVariable("NORMA_ORACLE_RECORD") == "1"; }
        }

        public static string Scratch(string kind, string name)
        {
            string d = Path.Combine(Root, "_reports", kind, name);
            Directory.CreateDirectory(d);
            return d;
        }

        public sealed class Run
        {
            public string Output;
            public string Scratch;
            public string Report;
            public int ExitCode;
        }

        public static Run Execute(string scratch, IEnumerable<string> dirs)
        {
            if (!File.Exists(Exe))
            {
                throw new FileNotFoundException("build the oracle first (dotnet build in tools/norma-oracle)", Exe);
            }
            var psi = new ProcessStartInfo
            {
                FileName = Exe,
                WorkingDirectory = scratch,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (string d in dirs)
            {
                psi.ArgumentList.Add(d);
            }
            using (Process p = Process.Start(psi))
            {
                var err = p.StandardError.ReadToEndAsync();
                string outp = p.StandardOutput.ReadToEnd();
                p.WaitForExit();
                string text = (outp + err.Result).Replace("\r\n", "\n");
                File.WriteAllText(Path.Combine(scratch, "out.txt"), text);
                string reportPath = Path.Combine(scratch, "verbalization-report.txt");
                return new Run
                {
                    Output = text,
                    Scratch = scratch,
                    Report = File.Exists(reportPath) ? File.ReadAllText(reportPath).Replace("\r\n", "\n") : "",
                    ExitCode = p.ExitCode,
                };
            }
        }

        public static string[] Lines(string text)
        {
            return text.Split('\n');
        }

        public static int BlockingErrors(string output)
        {
            Match m = Regex.Match(output, @"TOTAL BLOCKING ERRORS: (\d+)");
            return m.Success ? int.Parse(m.Groups[1].Value) : 0;
        }

        // the read-back gate: paths that read as none of their head's rules,
        // plus built rules no path reads; both are wrong builds NORMA did not
        // object to
        public static int ReadBack(string output)
        {
            Match m = Regex.Match(output, @"READ-BACK SUMMARY: .*");
            if (!m.Success) return 0;
            int mismatch = 0, unread = 0;
            Match a = Regex.Match(m.Value, @"(\d+) MISMATCH");
            if (a.Success) mismatch = int.Parse(a.Groups[1].Value);
            Match b = Regex.Match(m.Value, @"(\d+) built rule");
            if (b.Success) unread = int.Parse(b.Groups[1].Value);
            return mismatch + unread;
        }

        // a run that died is not a run with zero errors
        public static string Crash(string output)
        {
            foreach (string l in Lines(output))
            {
                if (l.Contains("Unhandled Exception") || l.StartsWith("   at Arest.NormaOracle.Program", StringComparison.Ordinal)) return l;
            }
            return null;
        }

        // built derivation-rule heads, sorted, WITH multiplicity: a head with
        // two rules yields two lines; counts hide a dropped rule, names do not
        public static List<string> BuiltHeads(string output)
        {
            var heads = new List<string>();
            bool inSection = false;
            foreach (string l in Lines(output))
            {
                if (l.StartsWith("== derivation rules built", StringComparison.Ordinal)) { inSection = true; continue; }
                if (inSection && l.StartsWith("== ", StringComparison.Ordinal)) break;
                if (!inSection) continue;
                int at = l.IndexOf(" := ", StringComparison.Ordinal);
                if (at < 0) continue;
                heads.Add(l.TrimStart().Substring(0, l.TrimStart().IndexOf(" := ", StringComparison.Ordinal)));
            }
            heads.Sort(StringComparer.Ordinal);
            return heads;
        }

        // probes.sh's actual.txt: the error total, every UNBUILT line with its
        // reason, every read-back verdict, then every rule block of the
        // verbalization report (from its marker line to the blank line)
        public static string ProbeActual(Run r)
        {
            var sb = new StringBuilder();
            sb.Append("errors ").Append(BlockingErrors(r.Output)).Append('\n');
            foreach (string l in Lines(r.Output))
            {
                if (l.StartsWith("  UNBUILT (", StringComparison.Ordinal)) sb.Append(l.TrimStart()).Append('\n');
            }
            foreach (string l in Lines(r.Output))
            {
                if (Regex.IsMatch(l, @"^  READ-BACK (MISMATCH|NO PATH)")) sb.Append(l.TrimStart()).Append('\n');
            }
            bool printing = false;
            foreach (string l in Lines(r.Report))
            {
                if (Regex.IsMatch(l, @"^[*+]+[A-Z]")) printing = true;
                if (printing) sb.Append(l).Append('\n');
                if (printing && l.Length == 0) printing = false;
            }
            return sb.ToString();
        }

        // regress.sh's per-corpus record: the error total, the read-back
        // count, then the built heads one per line
        public static string CorpusActual(Run r)
        {
            var sb = new StringBuilder();
            sb.Append("errors ").Append(BlockingErrors(r.Output)).Append('\n');
            sb.Append("read-back ").Append(ReadBack(r.Output)).Append('\n');
            foreach (string h in BuiltHeads(r.Output)) sb.Append(h).Append('\n');
            return sb.ToString();
        }

        // the difference between a recorded corpus expectation and a run, in
        // the words regress.sh printed: lost and new heads, the error counts
        public static string Explain(string expected, string actual)
        {
            var e = new List<string>(expected.TrimEnd('\n').Split('\n'));
            var a = new List<string>(actual.TrimEnd('\n').Split('\n'));
            var sb = new StringBuilder();
            for (int i = 0; i < 2; i++)
            {
                if (i < e.Count && i < a.Count && e[i] != a[i]) sb.Append(e[i]).Append(" -> ").Append(a[i]).Append('\n');
            }
            var eh = e.GetRange(Math.Min(2, e.Count), Math.Max(0, e.Count - 2));
            var ah = a.GetRange(Math.Min(2, a.Count), Math.Max(0, a.Count - 2));
            var lost = new List<string>(eh);
            foreach (string h in ah) lost.Remove(h);
            var added = new List<string>(ah);
            foreach (string h in eh) added.Remove(h);
            foreach (string h in lost) sb.Append("lost: ").Append(h).Append('\n');
            foreach (string h in added) sb.Append("new:  ").Append(h).Append('\n');
            return sb.ToString();
        }
    }
}
