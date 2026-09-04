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

        // COMPOSE THE STORE THE ORACLE JUST WROTE, AND ASK THE HOST. The regression
        // check is canon (law:regress over the run's state:* surfaces and the
        // recorded expect:* carrier), so a theory composes the scratch directory's
        // carriers into a module of their own there and runs a mode of `main`;
        // what comes back is the host's verdict and its text, nothing scraped.
        public static string JsRunner
        {
            get { return Path.Combine(Root, "tools", "js-runner"); }
        }

        // The composition is the slim one, canon with the run's outcome and the
        // record and no schema: us-law's design-state took the host two minutes to
        // load and minutes more to close under the rules before it could answer,
        // and the three regress laws read none of it.
        public static Run Host(string scratch, params string[] args)
        {
            var build = new ProcessStartInfo
            {
                FileName = "bun",
                WorkingDirectory = JsRunner,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            build.ArgumentList.Add("build.js");
            build.ArgumentList.Add("regress");
            build.Environment["AREST_CARRIERS"] = scratch;
            build.Environment["AREST_OUT_DIR"] = scratch;
            using (Process p = Process.Start(build))
            {
                var err = p.StandardError.ReadToEndAsync();
                p.StandardOutput.ReadToEnd();
                p.WaitForExit();
                if (p.ExitCode != 0) throw new InvalidOperationException("the composition failed: " + err.Result);
            }
            var psi = new ProcessStartInfo
            {
                FileName = "bun",
                WorkingDirectory = scratch,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            psi.ArgumentList.Add(Path.Combine(scratch, "regress.g.js"));
            foreach (string a in args) psi.ArgumentList.Add(a);
            using (Process p = Process.Start(psi))
            {
                var err = p.StandardError.ReadToEndAsync();
                string outp = p.StandardOutput.ReadToEnd();
                p.WaitForExit();
                return new Run
                {
                    Output = (outp + err.Result).Replace("\r\n", "\n"),
                    Scratch = scratch,
                    Report = "",
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

    }
}
