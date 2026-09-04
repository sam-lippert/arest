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

        // A CONSTRAINT IS NOT A RULE, and nothing else here would notice one.
        // ProbeActual carries the error count, the UNBUILT lines, the read-back
        // verdicts and the rule verbalizations — every one of them about DERIVED
        // HEADS. A deontic mandatory is none of those, and the corpus theories
        // compare the `expectation` carrier (state:built, state:errors,
        // state:readback), which does not carry deontic constraints either. So
        // the six corpora passed unchanged when the unary obligation began to
        // build, and would have passed unchanged had it stopped. This is the
        // one check that reads the constraint itself, out of the design-state
        // where the canon closure will look for it.
        [Fact]
        public void AUnaryObligationBuildsADeonticMandatory()
        {
            string dir = Path.Combine(ProbesDir, "unary-obligation");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "unary-obligation-deontic"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // "It is obligatory that each Post is approved." over the unary
            // reading `Post is approved` — a simple mandatory at role 1, under
            // the deontic operator, which is where the commit gate reads it
            Assert.Contains("DEO:m:PostIsApproved#1", state);
            Assert.Contains("A(\"PostIsApproved\"), N(1)", state);
        }
    }
}
