// Every probe under tools/norma-oracle/probes/ is one theory: a small reading
// with distinct types, run through the oracle ALONE, whose rule verbalizations
// and blocking-error count must read as recorded in its expected.txt.
//
//   line 1        errors N          NORMA's blocking model errors
//   then          every UNBUILT line the oracle printed, with its reason
//   then          every read-back verdict
//   then          every rule block  the verbalization of each derived head
//
// An expected.txt of ONE line checks the error count only; that is how a
// known wrong build is kept red until it is fixed. NORMA_ORACLE_RECORD=1
// writes the expectation.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Arest.NormaOracle.Tests
{
    public class ProbeTests
    {
        public static string ProbesDir
        {
            get { return Path.Combine(Oracle.Root, "tools", "norma-oracle", "probes"); }
        }

        public static IEnumerable<object[]> Probes()
        {
            foreach (string d in Directory.GetDirectories(ProbesDir).OrderBy(x => x, StringComparer.Ordinal))
            {
                if (File.Exists(Path.Combine(d, "t.md"))) yield return new object[] { Path.GetFileName(d) };
            }
        }

        [Theory]
        [MemberData(nameof(Probes))]
        public void ProbeReadsAsRecorded(string name)
        {
            string dir = Path.Combine(ProbesDir, name);
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", name), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string actual = Oracle.ProbeActual(run);
            File.WriteAllText(Path.Combine(run.Scratch, "actual.txt"), actual);
            string expectedPath = Path.Combine(dir, "expected.txt");
            if (Oracle.Recording)
            {
                File.WriteAllText(expectedPath, actual);
                return;
            }
            Assert.True(File.Exists(expectedPath), "NO EXPECTED " + name + " (NORMA_ORACLE_RECORD=1 records it)");
            string expected = File.ReadAllText(expectedPath).Replace("\r\n", "\n");
            if (expected.TrimEnd('\n').Split('\n').Length <= 1)
            {
                Assert.Equal(expected.TrimEnd('\n'), actual.Split('\n')[0]);
                return;
            }
            Assert.Equal(expected, actual);
        }
    }
}
