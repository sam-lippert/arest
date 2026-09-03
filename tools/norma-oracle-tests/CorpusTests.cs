// Every corpus in corpora.md is one theory (trait Category=Corpus: the three
// closures that carry us-law take the oracle minutes each, so
//   dotnet test --filter Category!=Corpus
// is the quick suite). A corpus must read as recorded in expected/<name>.txt:
// the blocking-error total, the read-back count, then every built head with
// multiplicity. A lost head, a new head, or a changed count fails the theory
// with the difference in the words regress.sh printed; a change you verified
// is recorded deliberately with NORMA_ORACLE_RECORD=1.
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
            return Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "expected", name + ".txt");
        }

        [Theory]
        [MemberData(nameof(Corpora))]
        [Trait("Category", "Corpus")]
        public void CorpusReadsAsRecorded(string name)
        {
            List<string> dirs = Corpus.Directories(name);
            foreach (string d in dirs) Assert.True(Directory.Exists(d), "corpus " + name + " names a directory that does not exist: " + d);
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("corpora", name), dirs);
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string actual = Oracle.CorpusActual(run);
            File.WriteAllText(Path.Combine(run.Scratch, "actual.txt"), actual);
            string expectedPath = ExpectedPath(name);
            if (Oracle.Recording)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(expectedPath));
                File.WriteAllText(expectedPath, actual);
                return;
            }
            Assert.True(File.Exists(expectedPath), "NO EXPECTED " + name + " (NORMA_ORACLE_RECORD=1 records it)");
            string expected = File.ReadAllText(expectedPath).Replace("\r\n", "\n");
            Assert.True(expected == actual, name + " does not read as recorded:\n" + Oracle.Explain(expected, actual));
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
