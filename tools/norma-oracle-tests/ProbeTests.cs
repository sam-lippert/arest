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

        // A SENTENCE MUST SAY WHAT THE READING SAYS, and nothing else here reads
        // an instance fact at all. ProbeActual carries error counts, UNBUILT
        // lines, read-back verdicts and rule verbalizations, and the corpus
        // theories compare carrier sizes and hashes — a population that is
        // silently empty, or silently holding a sentence that means something
        // else, passes every one of them.
        //
        // MapInstanceFact compared the sentence's collapsed predicate words
        // against FactIndexEntry.ReadingWords, which is the reading with its
        // {n} placeholders replaced by single spaces: "{0} has {1} for {2}"
        // became "has   for", carrying a RUN of spaces per role, while the
        // sentence's words were collapsed with \s+. For any reading of two or
        // more roles the two could never be equal, that branch never fired, and
        // every sentence was decided by the fallback instead — the sole
        // player-signature-compatible entry, whatever the sentence actually
        // said. So ONE candidate accepted anything (a corpus declaring only
        // `Widget has Blob for Gizmo` took `Widget 'w2' completely unrelated
        // nonsense Blob '44' banana split Gizmo 'g2'` as a row of it) and TWO
        // candidates dropped everything (`has Blob` and `has Spare Blob`
        // annihilated each other and both populations came back empty).
        [Fact]
        public void EachReadingTakesOnlyTheSentencesThatMatchIt()
        {
            string dir = Path.Combine(ProbesDir, "reading-words-unread");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "reading-words-unread-facts"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // each fact type takes its own row and only its own
            Assert.Contains("S5(A(\"WidgetHasBlobForGizmo\"), S3(A(\"Widget\"), A(\"Blob\"), A(\"Gizmo\")), "
                + "S1(S2(N(1), N(3))), PHI(), S1(S1(S3(A(\"w1\"), A(\"42\"), A(\"g1\")))))", state);
            Assert.Contains("S5(A(\"WidgetHasSpareBlobForGizmo\"), S3(A(\"Widget\"), A(\"Blob\"), A(\"Gizmo\")), "
                + "S1(S2(N(1), N(3))), PHI(), S1(S1(S3(A(\"w1\"), A(\"43\"), A(\"g1\")))))", state);
            // and the sentence whose words match neither is REPORTED, not taken
            Assert.Contains("[instance] Widget 'w2' completely unrelated nonsense", run.Output);
            Assert.DoesNotContain("A(\"44\")", state);
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

        // A RECIPE IS A FORM; AN ATOM IS AN OPERAND. state:rules rows are
        // S3(head, players, recipe), and the closure asks a recipe for its tag,
        // so a recipe that is a bare atom throws selector 1 on an atom from
        // inside the fixpoint -- nine us-law rules were that shape and no
        // us-law store could boot. Nothing else here would see it: the corpus
        // theories compare the expectation carrier and never run the closure
        // over an app store, and this shape only appears when a single leg
        // leaves the source unwrapped.
        [Fact]
        public void ASingleMembershipLegIsWrappedInAForm()
        {
            string dir = Path.Combine(ProbesDir, "subtype-membership-head");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "subtype-membership-form"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains("S3(A(\"AgencyActionIsFinal\"), S1(A(\"Agency Action\")), S3(A(\"proj\"), A(\"Final Agency Action\"), S1(N(1))))", state);
        }

        // A PREFIX TEST, WITH NO NEW PRIMITIVE. strip_prefix answers the string
        // unchanged when the prefix is absent, so `starts with` is that answer
        // compared against the original -- the idiom ui:replay already uses to
        // find the journal cells. Fifteen auto.dev rules were blocked on this and
        // none of them was blocked on the evaluator.
        [Fact]
        public void APrefixTestEmitsAStartsStep()
        {
            string dir = Path.Combine(ProbesDir, "chain-recipe-prefix");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "chain-recipe-prefix-run"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains(
                "S3(A(\"ExternalSystemIsSecure\"), S1(A(\"External System\")), "
                + "S3(A(\"proj\"), S4(A(\"starts\"), A(\"ExternalSystemHasURI\"), N(2), A(\"https://\")), S1(N(1))))",
                state);
        }

        // A COMPUTED HEAD ROLE REACHES THE EVALUATOR. `+`, `-` and `*` were always
        // base primitives -- canon applies `+` forty-six times -- so arithmetic was
        // never missing from the language, only from the recipe grammar, and a rule
        // whose head is a sum built as a NORMA rule and then had nothing the closure
        // could run. calc appends op(col i, col j) the way pairwith appends a
        // constant, so the rule composes as join, calc, proj. Twelve auto.dev rules
        // are this shape.
        [Fact]
        public void AComputedHeadRoleEmitsACalcStep()
        {
            string dir = Path.Combine(ProbesDir, "chain-recipe-arithmetic");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "chain-recipe-arith"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains(
                "S3(A(\"RequestHasDeadlineDayCount\"), S2(A(\"Request\"), A(\"Day Count\")), "
                + "S3(A(\"proj\"), S5(A(\"calc\"), S5(A(\"joinon\"), A(\"RequestHasSubmissionDayCount\"), "
                + "A(\"RequestHasResponseDayCount\"), S1(S2(N(1), N(1))), S4(N(1), N(2), N(3), N(4))), "
                + "A(\"+\"), N(2), N(4)), S2(N(1), N(5))))",
                state);
        }

        // A UNARY HEAD OVER A TWO-LEG JOIN -- the membership shape, and the one
        // that found itself. JoinRecipe builds the NatJoin form, which projects
        // each leg to <contributed, join column> and pairs them, so it needs a
        // head naming exactly two players and refuses on its first line
        // otherwise. A head naming ONE fell through and the arm emitted nothing:
        // marked derived, verbalized, read-back clean, never populated.
        //
        // It surfaced by modelling arest's own build surface in FORML
        // (apps/arest-dev/readings/build-surface.md): `Head is delivered iff
        // some Rule produces Head and that Rule has some Recipe` is exactly this
        // shape, so the model of inert heads was itself an inert head. joinon
        // says it with no new form -- join on the shared pair, project the one
        // column the head names -- and the probe's population confirms it runs:
        // r1 has a recipe and r2 does not, and HeadIsDelivered answers (h1).
        [Fact]
        public void AUnaryHeadOverATwoLegJoinEmitsAJoinon()
        {
            string dir = Path.Combine(ProbesDir, "join-unary-head");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "join-unary-head-run"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains(
                "S3(A(\"HeadIsDelivered\"), S1(A(\"Head\")), "
                + "S5(A(\"joinon\"), A(\"RuleProducesHead\"), A(\"RuleHasRecipe\"), "
                + "S1(S2(N(1), N(1))), S1(N(2))))",
                state);
        }

        // THE GENERAL CHAIN ARM'S RECIPE. That arm builds the rule as a NORMA
        // object and emitted nothing executable, so a head only it built was
        // marked derived and never populated -- law:markers over a booted store
        // was the only thing that said so. The recipe here is the whole shape:
        // the positive legs joined on their shared token keeping every column,
        // projected onto the head's role, and the negated leg subtracted.
        [Fact]
        public void AChainWithANegatedLegEmitsADifference()
        {
            string dir = Path.Combine(ProbesDir, "chain-recipe-with-negation");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "chain-recipe-negation"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains(
                "S3(A(\"AuthorityIsCurrentlyInForce\"), S1(A(\"Authority\")), "
                + "S3(A(\"minus\"), S3(A(\"proj\"), S5(A(\"joinon\"), A(\"AuthorityHasEffectiveDate\"), "
                + "A(\"EffectiveDateIsInThePast\"), S1(S2(N(2), N(1))), S3(N(1), N(2), N(3))), S1(N(1))), "
                + "S3(A(\"proj\"), A(\"AuthorityHasSupersessionDate\"), S1(N(1))))",
                state);
        }
    }
}
