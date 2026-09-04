// Every corpus in corpora.md is one theory (trait Category=Corpus: the three
// closures that carry us-law take the oracle minutes each, so
//   dotnet test --filter Category!=Corpus
// is the quick suite). A corpus must read as recorded in expected/<name>, a
// carrier in intersection source the oracle itself wrote (expect:built, the
// built heads with multiplicity; expect:errors; expect:readback). The check
// is canon: the theory composes the run's carriers with that record and asks
// the host `regress`, which answers with law:regress over state:* and
// expect:* and, under its three rows, the heads lost and new. A change you
// verified is recorded deliberately with NORMA_ORACLE_RECORD=1, which copies
// the run's own expectation there.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Arest.NormaOracle.Tests
{
    public static class Corpus
    {
        static readonly Regex Reads = new Regex(@"^Corpus '([^']+)' reads Directory '([^']+)'\.$");

        public static string Manifest
        {
            get { return Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "corpora.md"); }
        }

        // name -> the directories as listed, in order
        public static List<KeyValuePair<string, List<string>>> All()
        {
            var result = new List<KeyValuePair<string, List<string>>>();
            foreach (string raw in File.ReadAllLines(Manifest))
            {
                Match m = Reads.Match(raw.Trim());
                if (!m.Success) continue;
                string name = m.Groups[1].Value;
                int at = result.FindIndex(kv => kv.Key == name);
                if (at < 0)
                {
                    result.Add(new KeyValuePair<string, List<string>>(name, new List<string>()));
                    at = result.Count - 1;
                }
                result[at].Value.Add(m.Groups[2].Value);
            }
            return result;
        }

        // a '/**' entry is the directory and every directory under it, the
        // parent before its children, siblings in ordinal order
        public static List<string> Directories(string name)
        {
            var dirs = new List<string>();
            foreach (var kv in All())
            {
                if (kv.Key != name) continue;
                foreach (string rel in kv.Value)
                {
                    if (rel.EndsWith("/**", StringComparison.Ordinal))
                    {
                        Tree(Path.GetFullPath(Path.Combine(Oracle.Root, rel.Substring(0, rel.Length - 3))), dirs);
                    }
                    else
                    {
                        dirs.Add(Path.GetFullPath(Path.Combine(Oracle.Root, rel)));
                    }
                }
            }
            return dirs;
        }

        static void Tree(string dir, List<string> into)
        {
            into.Add(dir);
            foreach (string sub in Directory.GetDirectories(dir).OrderBy(x => x, StringComparer.Ordinal))
            {
                Tree(sub, into);
            }
        }
    }

    public class CorpusTests
    {
        public static IEnumerable<object[]> Corpora()
        {
            foreach (var kv in Corpus.All()) yield return new object[] { kv.Key };
        }

        static string ExpectedPath(string name)
        {
            return Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "expected", name);
        }

        [Theory]
        [MemberData(nameof(Corpora))]
        [Trait("Category", "Corpus")]
        public void CorpusReadsAsRecorded(string name)
        {
            List<string> dirs = Corpus.Directories(name);
            foreach (string d in dirs) Assert.True(Directory.Exists(d), "corpus " + name + " names a directory that does not exist: " + d);
            string scratch = Oracle.Scratch("corpora", name);
            // the record composed in is this theory's copy of the file under expected/,
            // never a previous run's: absent while the oracle runs and while recording
            string spliced = Path.Combine(scratch, "expected");
            if (File.Exists(spliced)) File.Delete(spliced);
            Oracle.Run run = Oracle.Execute(scratch, dirs);
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string expectation = Path.Combine(scratch, "expectation");
            Assert.True(File.Exists(expectation), "the oracle wrote no expectation carrier");
            string expectedPath = ExpectedPath(name);
            if (Oracle.Recording)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(expectedPath));
                File.Copy(expectation, expectedPath, true);
                return;
            }
            Assert.True(File.Exists(expectedPath), "NO EXPECTED " + name + " (NORMA_ORACLE_RECORD=1 records it)");
            File.Copy(expectedPath, spliced, true);
            // the host's three rows and, under them, the heads lost and new
            Oracle.Run regress = Oracle.Host(scratch, "regress");
            Assert.True(regress.ExitCode == 0, name + " does not read as recorded:\n" + regress.Output);
        }

        // THE CARRIERS ARE NOT THE STORE. Every other check here reads what the
        // oracle wrote; this one BOOTS it -- FILE projected from state:fts, the
        // meta-types reflected, the populations closed under the program's own
        // rules -- and asks canon for the law report. Three defects in one day
        // (2026-09-04) were invisible to every reading check and would each have
        // been caught here: a single-leg rule emitting a bare atom where a form
        // belongs, which crashed the closure on any us-law store; deontic
        // constraints that could have stopped building with all six corpora
        // still green; and a closure that doubled a semi-derived head, writing
        // `Right has World Assumption open` beside `... closed`.
        //
        // Recorded, not asserted green: law-core's report is 58 laws holding and
        // marker-closure answering F, because `Authority is currently in force`
        // is marked derived and has no executable recipe. Pinning the real
        // answer makes a change visible; asserting a green we do not have would
        // only mean deleting the test later. NORMA_ORACLE_RECORD=1 writes it.
        [Fact]
        [Trait("Category", "Corpus")]
        public void LawReportReadsAsRecorded()
        {
            const string name = "lawcore";
            List<string> dirs = Corpus.Directories(name);
            foreach (string d in dirs) Assert.True(Directory.Exists(d), "corpus " + name + " names a directory that does not exist: " + d);
            string scratch = Oracle.Scratch("corpora", name + "-laws");
            Oracle.Run run = Oracle.Execute(scratch, dirs);
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            Oracle.Run report = Oracle.LawReport(scratch);
            string actual = report.Output.Trim();
            string expectedPath = ExpectedPath("laws-" + name);
            if (Oracle.Recording)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(expectedPath));
                File.WriteAllText(expectedPath, actual);
                return;
            }
            Assert.True(File.Exists(expectedPath), "NO EXPECTED laws-" + name + " (NORMA_ORACLE_RECORD=1 records it)");
            Assert.Equal(File.ReadAllText(expectedPath).Replace("\r\n", "\n").Trim(), actual);
        }

        // the carriers are a function of the readings: two runs of the same
        // corpus are byte-identical (they were not until 2026-09-03, when
        // object-kind rows and the fact order were made canonical)
        [Fact]
        [Trait("Category", "Corpus")]
        public void MetamodelCarriersAreReproducible()
        {
            List<string> dirs = Corpus.Directories("metamodel");
            Oracle.Run a = Oracle.Execute(Oracle.Scratch("corpora", "metamodel-a"), dirs);
            Oracle.Run b = Oracle.Execute(Oracle.Scratch("corpora", "metamodel-b"), dirs);
            foreach (string carrier in new[] { "design-state", "norma-answer" })
            {
                string pa = Path.Combine(a.Scratch, carrier), pb = Path.Combine(b.Scratch, carrier);
                Assert.True(File.Exists(pa) && File.Exists(pb), carrier + " was not written");
                Assert.Equal("identical", CarrierKind.Classify(File.ReadAllText(pa), File.ReadAllText(pb)));
            }
        }
    }
}
