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
using System.Text.RegularExpressions;

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
        // lines, read-back verdicts, REFUSED and FILED lines, the state:deontics
        // cell (2026-09-15) and rule verbalizations, and the corpus
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
        //
        // NO LONGER TRUE OF ProbeActual AS OF 2026-09-15, and the paragraph is
        // kept because it is the reason this probe was weak for as long as it
        // was. ProbeActual now also carries the state:deontics CELL whenever a
        // DEO: marking exists, so a built obligation shows its prohibited
        // population and a declined one shows nothing. Measured: with
        // BuildDeonticJoin disabled, deontic-join-obligation now fails with
        // Expected `errors 0\nDEONTICS DEF("state:deontics", ...` against Actual
        // `errors 0\n`. Before that surface existed the arm could be DELETED
        // OUTRIGHT and this suite stayed green. The rest of the paragraph still
        // describes the corpus theories correctly.
        //
        // ProbeActual carried the error count, the UNBUILT lines, the read-back
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

        // A DEONTIC WHOSE BODY IS A JOIN (2026-09-15). The deontic path resolved
        // ONE clause to ONE fact type, so `It is obligatory that each Widget
        // packed in some Crate has some Stamp Code` -- both legs declared --
        // became a model note and nothing read it. The obligation is the dual of
        // a prohibition (De Morgan): the Widget/Crate pairs MINUS the pairs whose
        // Widget has a Stamp Code, every surviving row a violation. The probe
        // theory above cannot see this: it reads errors, UNBUILT lines, read-back
        // and rule verbalizations, and a deontic is none of those. This reads the
        // constraint out of the design-state, where the canon closure looks for it.
        [Fact]
        public void ADeonticOverAJoinIsCarriedAsAProhibitedPopulation()
        {
            string dir = Path.Combine(ProbesDir, "deontic-join-obligation");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "deontic-join-obligation-state"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            Assert.Contains(
                "S3(A(\"DEO:p:WidgetIsPackedInCrate\"), A(\"prohibited\"), "
                + "S2(A(\"WidgetIsPackedInCrate\"), "
                + "S3(A(\"minus\"), A(\"WidgetIsPackedInCrate\"), "
                + "S5(A(\"joinon\"), A(\"WidgetIsPackedInCrate\"), A(\"WidgetHasStampCode\"), "
                + "S1(S2(N(1), N(1))), S2(N(1), N(2))))))",
                state);
            // AND IT IS NOT A NOTE INSTEAD. The note stays as NORMA's record of the
            // text (NORMA has no element for an empty-population constraint), so the
            // presence of a note proves nothing; that the oracle stopped calling it
            // unbuildable prose does.
            Assert.DoesNotContain("qualified deontic prose", run.Output);
        }

        // A HYPHEN IS SILENT WHEN A SENTENCE IS SPOKEN. FORML's hyphen binding
        // on a predicate word (`has default- Fetcher`, `has applicable- Tax
        // Year`) is absorption naming; the reading's words dropped the hyphen
        // and the instance sentence's kept it, so a DECLARED fact type never
        // matched its own row and the fallback filed it by player signature
        // (three auto.dev source declarations, a us-law revenue procedure). And
        // a type name with an internal hyphen (`Cross-Border Recognition`) was
        // not admitted by the value-constraint regex, so "The possible values
        // of ..." fell through to the instance path and its three quoted
        // values filed into a ternary. The probe theory above reads neither: it
        // records errors, UNBUILT lines, read-back and rules, and there are
        // none here.
        [Fact]
        public void AHyphenBoundReadingTakesItsOwnSentence()
        {
            string dir = Path.Combine(ProbesDir, "hyphen-bound-reading");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "hyphen-bound-reading-facts"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // every sentence found its reading; none was reported or filed elsewhere
            Assert.DoesNotContain("[instance]", run.Output);
            Assert.DoesNotContain("READING NOT MATCHED", run.Output);
            Assert.Contains("A(\"SourceDeclarationHasDefaultFetcher\")", state);
            Assert.Contains("S2(A(\"edmunds\"), A(\"fetch\"))", state);
            Assert.Contains("A(\"CaseHasCrossBorderRecognition\")", state);
            Assert.Contains("S2(A(\"c1\"), A(\"foreign_main\"))", state);
            // and the value constraints were BUILT -- NORMA verbalizes them, a
            // value no row uses among them. Nothing had ever built one: the one
            // flush ran in the declarations phase, before the map pass that
            // reads the sentence (2026-09-06).
            string verbalized = File.ReadAllText(Path.Combine(run.Scratch, "verbalization-report.txt"));
            Assert.Contains("'foreign_nonmain'", verbalized);
            Assert.Contains("'two'", verbalized);
        }

        // AN OBJECTIFICATION DECLARED BEFORE ITS FACT RESOLVES TO THE FACT TYPE.
        // probes/objectify-before-fact was the last of the eight one-line `errors 0`
        // expectations left unaccounted for, and measuring it settles that it is
        // blind: `Plan Product objectifies "Plan includes API"` is written ABOVE the
        // reading it objectifies, and if that forward declaration fell through, the
        // oracle would mint `Plan Product` as its own entity type and
        // `Plan Product has Price Per Call` would take THAT as its player. The model
        // stays well formed either way, so NORMA raises nothing and the error count
        // reads 0 in both worlds. ProbeActual cannot see it either: its surfaces are
        // errors, UNBUILT, read-back, REFUSED, FILED, UNDELIVERED, the deontics cell
        // and rule blocks, and this probe declares no rule at all.
        //
        // The difference is one player. Measured: state:fts carries
        // `PlanProductHasPricePerCall <PlanIncludesAPI, Price Per Call>` -- the
        // OBJECTIFIED FACT TYPE standing as the object type -- and state:otmeta
        // lists no `PlanProduct` at all, so nothing was minted beside it.
        //
        // NOT ASSERTED, because I did not establish it: state:otmeta flags
        // PlanIncludesAPI `T` where every other type here is `F`, but that flag is
        // not "is objectified" -- the metamodel flags six types T and none of them
        // is one of its many declared objectifications. Pinning a flag whose meaning
        // is unknown is how the comment on refmode-names-entity went wrong.
        [Fact]
        public void AnObjectificationDeclaredBeforeItsFactStandsAsTheFactType()
        {
            string dir = Path.Combine(ProbesDir, "objectify-before-fact");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "objectify-before-fact-nesting"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // the objectified fact type is the player, not a minted `Plan Product`
            Assert.Contains("S5(A(\"PlanProductHasPricePerCall\"), S2(A(\"PlanIncludesAPI\"), A(\"Price Per Call\"))", state);
            // and nothing was minted beside it: no PlanProduct object type exists
            Assert.DoesNotContain("A(\"PlanProduct\"), A(\"entity\")", state);
            Assert.DoesNotContain("A(\"PlanProduct\"), A(\"value\")", state);
            // stated rather than relied on: the error count is blind to all of it
            Assert.Equal(0, Oracle.BlockingErrors(run.Output));
        }

        // A GENERAL REFERENCE MODE SHARES ITS VALUE TYPE; A POPULAR ONE MINTS ONE.
        // probes/refmode-names-entity was recorded by ac757d90 (#99) with a one-line
        // `errors 0` expectation and no [Fact] beside it -- and the defect it guards
        // raises NO NORMA ERROR, which that commit says in as many words. So the
        // check could not fail on the thing it was named for: the whole question is
        // what the reference mode RESOLVES TO, and nothing read that.
        //
        // WHAT IT RESOLVES TO, measured 2026-09-15 from state:refmodes:
        //   Law(.citation)  general  -> the value type `citation`   (SHARED)
        //   Person(.name)   popular  -> the value type `Person_name` (MINTED)
        //   Citation(.id)   popular  -> the value type `Citation_id` (MINTED)
        // and state:otmeta marks `citation` value/implied beside the `Citation`
        // ENTITY, which is exactly what ac757d90 reports: "NORMA minting a lowercase
        // citation value type beside the entity with no error, and THE NAME WAS
        // NEVER THE CAUSE". The real defect was rmap:tpairs feeding 1:1 entity-value
        // pairs into an undirected closure; the name stays, because a citation is
        // one thing and a document citing another (Sam, 2026-09-06).
        //
        // THE PROBE'S OWN COMMENT INVERTED BOTH HALVES and this is why it mattered
        // that nothing checked. It said the mode "now gets the entity's own value
        // type, Law_citation, and the census says so" -- `Law_citation` occurs in
        // exactly one commit, ac757d90, on a comment line, never in code or output,
        // and that same commit records the entity-named-mode branch as "inert and is
        // not kept". And it said "Person keeps sharing Name", where Person's POPULAR
        // mode mints Person_name and it is LAW's general mode that shares. Nothing
        // regressed; the comment was wrong the day it was written, and an
        // unfalsifiable probe is how it stayed wrong.
        //
        // So this asserts the resolution itself, including that Law's identifying
        // fact type takes the VALUE as its second player and not the entity -- the
        // #99 shape read the other way round.
        [Fact]
        public void AGeneralReferenceModeSharesItsValueTypeAndAPopularOneMintsIts()
        {
            string dir = Path.Combine(ProbesDir, "refmode-names-entity");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "refmode-names-entity-facts"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // the general mode shares the value type the mode NAMES, lowercase
            Assert.Contains("S4(A(\"Law\"), A(\"citation\"), A(\"general\"), A(\"citation\"))", state);
            // the popular modes mint one apiece, and Person does NOT adopt `Name`
            Assert.Contains("S4(A(\"Person\"), A(\"name\"), A(\"popular\"), A(\"Person_name\"))", state);
            Assert.Contains("S4(A(\"Citation\"), A(\"id\"), A(\"popular\"), A(\"Citation_id\"))", state);
            // and Law is identified by that VALUE, never by the Citation ENTITY:
            // `S2(A("Law"), A("Citation"))` here would be #99 back again
            Assert.Contains("S3(A(\"LawHasCitation\"), S2(A(\"Law\"), A(\"citation\"))", state);
            // the branch ac757d90 tried and did not keep stays not kept
            Assert.DoesNotContain("Law_citation", state);
            // and the whole point: NORMA raises nothing, so the error count is blind
            Assert.Equal("0", Oracle.BlockingErrors(run.Output).ToString());
        }

        // AN APOSTROPHE INSIDE A VALUE IS PART OF THE VALUE. The instance-fact
        // scanner paired quotes with '([^']*)', so `... the metamodel's types
        // ...` ended the Description at "metamodel" and stored it truncated
        // with the rest as predicate words, reported nowhere (#96) -- while
        // ExtractSentences and LiteralRx already read a quote with a letter
        // straight after it as a possessive. One scanner now; the probe
        // theory sees none of this, it records errors, UNBUILT, read-back and
        // rules.
        [Fact]
        public void AnApostropheInsideAValueStaysInTheValue()
        {
            string dir = Path.Combine(ProbesDir, "apostrophe-in-value");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "apostrophe-in-value-facts"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // the whole Description, past the possessive, is the stored value
            Assert.Contains("populated BY, and what a Fact is of a Function means", state);
            Assert.Contains("and Chris's plan, both of them", state);
            // no sentence was reported or filed elsewhere
            Assert.DoesNotContain("[instance]", run.Output);
            Assert.DoesNotContain("READING NOT MATCHED", run.Output);
            // and the enumerated value with the apostrophe is one value
            string verbalized = File.ReadAllText(Path.Combine(run.Scratch, "verbalization-report.txt"));
            Assert.Contains("'Sam's Tier', 'plain'", verbalized);
        }

        // A VALUE IS NOT A RULE. The derivation test ran s.Contains(" iff ") on
        // the raw sentence, so an instance fact whose VALUE held those five bytes
        // was DEFERRED as a rule declaration -- no row, no unrecognized sentence,
        // no model error, nothing in the map log, only a +1 in a census bucket.
        // The probe theory above cannot see that: it records errors, UNBUILT,
        // read-back and rules, and a swallowed instance fact moves none of them.
        // So the loss is read here, off the population, where it is visible.
        [Fact]
        public void IffInsideAValueIsNotReadAsARule()
        {
            string dir = Path.Combine(ProbesDir, "iff-inside-a-value");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "iff-inside-a-value-facts"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            // all four bodies are stored, iff and all: before the fix the three
            // carrying " iff " were absent from the store entirely
            Assert.Contains("x iff y", state);
            Assert.Contains("x if y", state);
            Assert.Contains("App navigates Domain iff App has navigable Domain", state);
            Assert.Contains("one iff two iff three", state);
            // and no sentence was reported, refiled, or quietly deferred
            Assert.DoesNotContain("[instance]", run.Output);
            Assert.DoesNotContain("READING NOT MATCHED", run.Output);
            // the control: a rule's own iff is outside every value and still reads
            Assert.Contains("ClauseIsLabelled", state);
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
        // the negated leg subtracted, and the result projected onto the head's
        // role.
        //
        // THE SUBTRACTION MOVED INSIDE THE PROJECTION and this assertion did
        // not follow it, so the test stood red against a correct emitter. It
        // read minus(proj(chain), proj(SupersessionDate)) -- project both sides
        // to keys, subtract keys -- and the emitter now writes
        // proj(minus(chain, joinon(chain, SupersessionDate))): the anti-join on
        // whole ROWS, projected afterwards. MEASURED 2026-09-11 over a
        // population -- a1 qualifies, a2 has a past date but is superseded, a3's
        // date is not past, a4 is superseded with no past date -- both shapes
        // answer exactly (a1), and the minus compares rows of width 3 against
        // width 3, so the difference really subtracts rather than silently
        // subtracting nothing. The new shape is what generalises: subtracting
        // KEYS is only sound while the head carries one role, and the anti-join
        // is sound for any head. So the golden follows the emitter here, and
        // case:a-negated-leg-subtracts-the-superseded-rows in the case table
        // pins what it ANSWERS -- a re-association that preserves the answer
        // moves this string and that case stays green, while one that breaks it
        // fails the case even if someone re-records this.
        [Fact]
        public void AChainWithANegatedLegEmitsADifference()
        {
            string dir = Path.Combine(ProbesDir, "chain-recipe-with-negation");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "chain-recipe-negation"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            const string chain = "S5(A(\"joinon\"), A(\"AuthorityHasEffectiveDate\"), "
                + "A(\"EffectiveDateIsInThePast\"), S1(S2(N(2), N(1))), S3(N(1), N(2), N(3)))";
            Assert.Contains(
                "S3(A(\"AuthorityIsCurrentlyInForce\"), S1(A(\"Authority\")), "
                + "S3(A(\"proj\"), S3(A(\"minus\"), " + chain + ", "
                + "S5(A(\"joinon\"), " + chain + ", A(\"AuthorityHasSupersessionDate\"), "
                + "S1(S2(N(1), N(1))), S3(N(1), N(2), N(3)))), S1(N(1))))",
                state);
        }

        // A SUBTYPING IS A FACT TYPE, AS NORMA HAS IT (2026-09-10). NORMA holds
        // `Person is a subtype of Party` as a SubtypeFact, a FactType with two
        // roles and the reading `{0} is a subtype of {1}`, and the design state
        // carried it nowhere the reflection could read: a citation of it named a
        // Fact Type instance with no role and no reading (eu-law, 19 + 19). The
        // oracle writes every subtype fact as a reading-shaped row of
        // state:subtypefacts under its one DCIL name; over the metamodel the link
        // is a row of Halpin's `Object Type is subtype of Object Type` (13.8,
        // p.705), the fact an instance of Subtype Fact and, up the chain, of Fact
        // Type, and a citation of the subtyping names that fact.
        [Fact]
        public void ASubtypeFactIsReflectedAsAFactType()
        {
            string dir = Path.Combine(ProbesDir, "subtype-fact-is-reflected");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "subtype-fact-reflected"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            string reading = "S1(S6(A(\"{0}\"), A(\"is\"), A(\"a\"), A(\"subtype\"), A(\"of\"), A(\"{1}\")))";
            Assert.Contains("S3(A(\"CustomerIsASubtypeOfPerson\"), S2(A(\"Customer\"), A(\"Person\")), " + reading + ")", state);
            Assert.Contains("S3(A(\"PersonIsASubtypeOfParty\"), S2(A(\"Person\"), A(\"Party\")), " + reading + ")", state);

            List<string> dirs = Corpus.Directories("metamodel");
            dirs.Add(Path.Combine(ProbesDir, "subtype-fact-lab"));
            Oracle.Run lab = Oracle.Execute(Oracle.Scratch("probes", "subtype-fact-lab"), dirs);
            Assert.True(Oracle.Crash(lab.Output) == null, "the oracle crashed: " + Oracle.Crash(lab.Output));
            string labState = File.ReadAllText(Path.Combine(lab.Scratch, "design-state"));
            // the pair is a row of the fact type's own population, so it is read
            // inside that descriptor and not anywhere the two names meet
            int at = labState.IndexOf("S5(A(\"ObjectTypeIsSubtypeOfObjectType\")", StringComparison.Ordinal);
            Assert.True(at >= 0, "no descriptor for Object Type is subtype of Object Type");
            int next = labState.IndexOf("S5(A(\"", at + 1, StringComparison.Ordinal);
            string descriptor = next < 0 ? labState.Substring(at) : labState.Substring(at, next - at);
            Assert.Contains("S2(A(\"Person\"), A(\"Party\"))", descriptor);
            Assert.Contains("S2(A(\"PersonIsASubtypeOfParty\"), A(\"Subtype Fact\"))", labState);
            Assert.Contains("S2(A(\"PersonIsASubtypeOfParty\"), A(\"Fact Type\"))", labState);
            Assert.Contains("S2(A(\"PersonIsASubtypeOfParty\"), A(\"C-1\"))", labState);
        }

        // A PREDICATE WITH A NAME AND NO BINDING DECIDES NOTHING (2026-09-11).
        // `Constraint is machine-decidable iff Constraint is decided by some
        // Predicate` trusted the NAME, so support.auto.dev's three state-law
        // constraints claimed a judge on the strength of two Predicates that
        // carry a Name and no Module Path, no Symbol Name and no JS Package --
        // the model asserting that something decides a rule when nothing
        // resolves. Sam's own parenthesis says the three go together: "a
        // Predicate is already a bound function (has Name, Module Path, Symbol
        // Name)". `Predicate is bound` is that test, and the fixture's two
        // predicates differ in nothing else.
        [Fact]
        public void APredicateWithNoBindingDecidesNothing()
        {
            List<string> dirs = Corpus.Directories("metamodel");
            dirs.Add(Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "decider"));
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("decider", "bound"), dirs);
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));

            // both derived heads are marked and both BUILT -- a marker whose rule
            // declines would leave the model claiming a test it cannot run, which
            // is the very shape this fixture exists to refuse
            Assert.Contains("S2(A(\"PredicateIsBound\"), A(\"full\"))", state);
            Assert.Contains("S2(A(\"ConstraintIsMachineDecidable\"), A(\"full\"))", state);
            Assert.DoesNotContain("S2(A(\"PredicateIsBound\"), A(\"", Undelivered(state));
            Assert.DoesNotContain("S2(A(\"ConstraintIsMachineDecidable\"), A(\"", Undelivered(state));

            // THE RECIPES ARE THE MECHANISM. Both heads are fully derived, so
            // neither has a state:fts descriptor to carry a population (#103: a
            // `*` type is omitted) and the rows follow from these at closure time.
            // Bound joins the two bindings; machine-decidable joins the naming to
            // the binding, which is the whole change -- naming alone used to do it.
            Assert.Contains("S5(A(\"joinon\"), S3(A(\"proj\"), A(\"PredicateHasModulePath\"), S1(N(1))), "
                + "S3(A(\"proj\"), A(\"PredicateHasSymbolName\"), S1(N(1)))", Rules(state));
            Assert.Contains("S3(A(\"ConstraintIsMachineDecidable\"), S1(A(\"Constraint\")), "
                + "S4(A(\"join\"), A(\"ConstraintIsDecidedByPredicate\"), A(\"PredicateIsBound\")", Rules(state));
        }

        // AN AGGREGATE THIS ARM WILL NOT EMIT MUST SAY WHY. auto.dev's closure
        // writes TEN aggregates over a where-clause chain, and they stood in
        // state:undelivered as `no arm emitted a recipe` -- the census saying it
        // does not know. None of the three below is a defect in the arm and none
        // may be guessed at, so the deliverable is the NAME, and each names a
        // DIFFERENT piece of work: a column nobody typed, a grouping the count
        // form cannot say, a value type the reading left as text.
        //
        // WHAT THE NAME SAYS MOVED ONCE THE GRAMMAR LEARNED A SUM (2026-09-15).
        // derive:forms carried eleven forms and exactly one aggregate, `count`,
        // keyed on a single column; 6cf45015 put `sum` beside it and the emitter
        // wires it. So BasketHasTotalWeight is no longer declined for the FORM --
        // it is declined for its COLUMN: the fold is INSERT(+), only an
        // integer-typed cell is written to the store as a host number, and
        // `Weight is a value type.` types nothing. Two text rows in one group
        // throw `+ on non-number` and a group of one row answers the text itself,
        // so emitting here would be a wrong total rather than a missing one. The
        // form-less case is alive next door, where the mean is (probes
        // aggregate-where and aggregate-sum-delivers).
        //
        // MEASURE IT IN THE APP'S OWN CLOSURE. An earlier note here read "only TWO
        // of auto.dev's ten reach this arm; the other eight never build" and every
        // number in it was an artifact of running the oracle on `apps/auto.dev`
        // ALONE. THE ORACLE DOES NOT RECURSE. auto.dev's closure is its package.json
        // `check` script -- metamodel, connectors/readings, the app dir and the app's
        // readings/, FOUR arguments, 55 files against 34 -- and the 21 that go
        // missing include the whole metamodel, where External System (core.md:207),
        // Organization (core.md:244) and User (instances.md:38) are declared. Drop
        // one declaration and a rule stops building; that is all the "small closure
        // builds it, big closure does not" split ever was. Any measurement of an app
        // taken outside its own closure measures nothing.
        //
        // MEASURED IN THE SANCTIONED CLOSURE, the ten are: 4 declined (sum)
        // -- cost-attribution.md:94, :96 and drivly-inc-business.md:40, :44; 1 (mean)
        // -- service-health.md:157; 1 a count grouped by 2 columns -- :159; 1 a
        // numeric threshold on a role typed text -- :155; 1 a leg the chain never
        // reaches -- taxes-derivation.md:433. That is EIGHT named. The ninth,
        // cost-mitigation.md:119, is the one silent `no arm emitted a recipe` left,
        // and it is CORPUS: `trailing daily cost` names no declared type, so the
        // words are predicate text, the intended ternary parses as a binary and the
        // aggregated value sits in no head role (the guard at Verifier.cs ~6348).
        // The probe aggregate-role-is-predicate-text is that minimal pair. The
        // tenth, auth.md:175, is UNBUILT at `legs resolving 2/4` and is corpus too.
        //
        // AND WIRING derive:form_sum DELIVERED NONE OF THEM, which an earlier
        // note here predicted as FOUR. Measured in the sanctioned closure with
        // the emitter in place: all five sums decline on their over-column --
        // Amount is decimal (stripe.md:36), Cost and Daily Amount are typed by
        // nothing -- so the debt moved off arest's grammar and onto the reading
        // boundary and the corpus without a head crossing. A mean form would not
        // change that either, and neither is the count: `count` counts rows where
        // these rules say distinct instances.
        //
        // The three rules here are the three answers. The sum names its column and
        // the ternary count names the missing grouping; the third is the corpus case
        // (ExternalSystemHasErrorRateForInterval) whose BODY does not join either --
        // a numeric threshold on a text-typed role -- and it must keep the body's
        // reason, because the body is resolved through the chain arm's own
        // ChainLegsUsable and JoinChainBody and the two jobs are different sizes:
        // a line in a readings file against a grouping the grammar cannot say.
        //
        // AND NO RECIPE IS EMITTED FOR ANY OF THEM. A recipe nothing can evaluate
        // would be worse than the decline it replaced, so state:rules stays empty
        // and the assertion says that too.
        [Fact]
        public void AnAggregateWithNoFormDeclinesByName()
        {
            string dir = Path.Combine(ProbesDir, "aggregate-has-no-form");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "aggregate-has-no-form-run"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            string why = Undelivered(state);
            Assert.Contains(
                "S2(A(\"BasketHasTotalWeight\"), A(\"a sum over a column the reading never typed (Weight)\"))",
                why);
            Assert.Contains(
                "S2(A(\"GrowerHasTallyForSeason\"), A(\"a count grouped by 2 columns (the count form groups by one)\"))",
                why);
            Assert.Contains(
                "S2(A(\"ServerHasErrorTallyForWindow\"), A(\"a numeric threshold on a role typed text (Status Code)\"))",
                why);
            // the silence this replaced
            Assert.DoesNotContain("no arm emitted a recipe", why);
            // and nothing was emitted that no host could run
            Assert.DoesNotContain("BasketHasTotalWeight", Rules(state));
            Assert.DoesNotContain("GrowerHasTallyForSeason", Rules(state));
            Assert.DoesNotContain("ServerHasErrorTallyForWindow", Rules(state));
        }

        // A SUM DELIVERS, AND THE RECIPE IS THE ONLY SURFACE THAT SHOWS IT.
        // ProbeActual carries what was NOT delivered, so the auto-discovered
        // theory beside this one sees a sum arrive only as three UNDELIVERED
        // lines going away -- which a recipe that folds the WRONG column, or
        // groups by the wrong one, satisfies just as well. This reads state:rules
        // and pins the text, the way the deontic cell is pinned whole and for the
        // same reason.
        //
        // The three shapes here are what the emitter writes. A binary head is the
        // fold bare, <sum, body, N(key), N(over)>, because the fold answers
        // <key, total> and the head wants exactly that. A head with TWO group
        // roles is a CONS key, which answers <<g1,g2>, total>, so `flat` unfolds
        // the first column back into two and a `proj` puts the total where the
        // head declared it -- here position 2 of <Depot, Yearly Total, Season>,
        // hence <N(1), N(3), N(2)>. The third is the same fold over a body a
        // THRESHOLD has filtered, which pairs its literal on as a trailing column
        // and so moves the width the fold's selectors are read against: the key
        // and the summed column stay the join's, 1 and 4, and a sum of the wrong
        // one is a wrong number rather than a missing one. Evaluated against the
        // mu before these were written: <b1,5>, <b2,5>; <d1,5,spring>,
        // <d1,5,fall>; <b1,3>, <b2,5> where the priority-1 item drops out; and
        // nothing at all over an empty store.
        //
        // AND THE COLUMN GATE IS THE MINIMAL PAIR. Total Weight and Code Total
        // share the body and the fold and differ only in their column's declared
        // type; forcing the decimal one through the mu with the store's own
        // encoding (a number-typed cell stays an atom) throws `+ on non-number`.
        // The mean is here so the form-less decline keeps a home once `sum` has
        // one.
        [Fact]
        public void ASumOverAnIntegerColumnEmitsTheFold()
        {
            string dir = Path.Combine(ProbesDir, "aggregate-sum-delivers");
            Oracle.Run run = Oracle.Execute(Oracle.Scratch("probes", "aggregate-sum-delivers-run"), new[] { dir });
            Assert.True(Oracle.Crash(run.Output) == null, "the oracle crashed: " + Oracle.Crash(run.Output));
            string state = File.ReadAllText(Path.Combine(run.Scratch, "design-state"));
            string rules = Rules(state);
            // the binary head: the fold bare, on the body the chain arm built
            Assert.Contains(
                "S3(A(\"BinHasTotalCount\"), S2(A(\"Bin\"), A(\"Total Count\")), "
                + "S4(A(\"sum\"), S5(A(\"joinon\"), A(\"BinHoldsItem\"), A(\"ItemHasUnitCount\"), "
                + "S1(S2(N(2), N(1))), S4(N(1), N(2), N(3), N(4))), N(1), N(4)))",
                rules);
            // two group roles: a CONS key, unfolded by flat, the total projected back
            Assert.Contains(
                "S3(A(\"proj\"), S2(A(\"flat\"), S4(A(\"sum\"), ", rules);
            Assert.Contains(
                "S3(A(\"CONS\"), N(1), N(8)), N(6))), S3(N(1), N(3), N(2)))", rules);
            // a threshold pairs its literal on as a seventh column and filters on it;
            // the fold must still read the columns the JOIN gave it, 1 and 4
            Assert.Contains(
                "S3(A(\"BinHasUrgentTotal\"), S2(A(\"Bin\"), A(\"Urgent Total\")), "
                + "S4(A(\"sum\"), S3(A(\"minus\"), S3(A(\"pairwith\"), ", rules);
            Assert.Contains("N(6), N(7))), N(1), N(4)))", rules);
            // and what it refuses, each by its own name
            string why = Undelivered(state);
            Assert.Contains(
                "S2(A(\"BinHasTotalWeight\"), A(\"a sum over a column typed decimal (Gram Weight)"
                + ": a number stays an atom in the store and + throws on it\"))", why);
            Assert.Contains(
                "S2(A(\"BinHasCodeTotal\"), A(\"a sum over a column the reading never typed (Label Code)\"))", why);
            Assert.Contains(
                "S2(A(\"BinHasMeanCount\"), A(\"an aggregate this grammar has no form for (mean)\"))", why);
            Assert.DoesNotContain("BinHasTotalWeight", rules);
            Assert.DoesNotContain("BinHasCodeTotal", rules);
            Assert.DoesNotContain("BinHasMeanCount", rules);
            // the delivered three are not in the census at all
            Assert.DoesNotContain("BinHasTotalCount", why);
            Assert.DoesNotContain("BinHasUrgentTotal", why);
            Assert.DoesNotContain("DepotHasYearlyTotalForSeason", why);
        }

        private static string Cell(string state, string name)
        {
            int at = state.IndexOf("DEF(\"" + name + "\"", StringComparison.Ordinal);
            Assert.True(at >= 0, "no " + name + " in the design state");
            int next = state.IndexOf("\nDEF(", at + 1, StringComparison.Ordinal);
            return next < 0 ? state.Substring(at) : state.Substring(at, next - at);
        }

        private static string Rules(string state) { return Cell(state, "state:rules"); }
        private static string Undelivered(string state) { return Cell(state, "state:undelivered"); }

        // the table names and their columns, read off a run's norma-answer
        private static Dictionary<string, List<string>> NormaTables(Oracle.Run run)
        {
            string answer = File.ReadAllText(Path.Combine(run.Scratch, "norma-answer"));
            int at = answer.IndexOf("DEF(\"norma:tables\"", StringComparison.Ordinal);
            int end = answer.IndexOf("\nDEF(", at + 1, StringComparison.Ordinal);
            string seg = end < 0 ? answer.Substring(at) : answer.Substring(at, end - at);
            var result = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            var starts = new List<KeyValuePair<string, int>>();
            foreach (Match m in Regex.Matches(seg, "S2\\(A\\(\"([A-Za-z][A-Za-z0-9_']*)\"\\), S[0-9]?\\("))
                starts.Add(new KeyValuePair<string, int>(m.Groups[1].Value, m.Index));
            for (int i = 0; i < starts.Count; i++)
            {
                int from = starts[i].Value, to = i + 1 < starts.Count ? starts[i + 1].Value : seg.Length;
                var cols = new List<string>();
                foreach (Match c in Regex.Matches(seg.Substring(from, to - from), "A\\(\"([a-z][A-Za-z0-9_']*)\"\\)"))
                    cols.Add(c.Groups[1].Value);
                result[starts[i].Key] = cols;
            }
            return result;
        }

        // ABSORPTION IS CONFIGURABLE, THE WAY IT IS IN NORMA (Sam, 2026-09-10).
        // NORMA's default for a subtyping is Absorb (AssimilationMapping.cs:429),
        // which is why the base maps 116 entity types to five tables and support
        // maps 548 to 435 with all 141 of its declared subtypes inside Function.
        // `Fact Type 'SubscriptionIsASubtypeOfObjectTypeInstance' has Assimilation
        // Absorption Choice 'Separate'.` is core.md's surface for overriding that,
        // per SUBTYPING rather than per subtype, and this is the measured
        // difference the one sentence makes. Partition is NORMA's third literal
        // and NORMA refuses it on this shape; what is pinned there is that the
        // oracle reports the refusal and finishes, since letting the exception out
        // killed the check.
        [Fact]
        public void AnAbsorptionChoiceSeparatesASubtypeThatOtherwiseAbsorbs()
        {
            string fixtures = Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "absorption");
            Func<string, Oracle.Run> at = name =>
            {
                List<string> dirs = Corpus.Directories("metamodel");
                dirs.Add(Path.Combine(fixtures, name));
                Oracle.Run r = Oracle.Execute(Oracle.Scratch("absorption", name), dirs);
                Assert.True(Oracle.Crash(r.Output) == null, name + ": the oracle crashed: " + Oracle.Crash(r.Output));
                return r;
            };

            // the default: no table of its own, and Function carries both the
            // discriminator and the absorbed column
            Dictionary<string, List<string>> absorbed = NormaTables(at("absorbed"));
            Assert.False(absorbed.ContainsKey("Subscription"), "absorbed: Subscription should have no table of its own");
            Assert.Contains("isSubscription", absorbed["Function"]);
            Assert.Contains("subscriptionPlanCode", absorbed["Function"]);

            // one sentence later: its own table, and Function carries neither
            Dictionary<string, List<string>> separated = NormaTables(at("separated"));
            Assert.True(separated.ContainsKey("Subscription"), "separated: Subscription should have its own table");
            Assert.Equal(new[] { "subscriptionId", "planCode" }, separated["Subscription"]);
            Assert.DoesNotContain("isSubscription", separated["Function"]);
            Assert.DoesNotContain("subscriptionPlanCode", separated["Function"]);

            // NORMA refuses Partition here, in its own words, and the run survives
            Oracle.Run partitioned = at("partitioned");
            Assert.Contains("ABSORPTION CHOICE REFUSED BY NORMA", partitioned.Output);
            Assert.Contains("Partitioning requires an ExclusiveOr constraint between all subtypes", partitioned.Output);
            Assert.False(NormaTables(partitioned).ContainsKey("Subscription"),
                "partitioned: a refused choice must leave the default mapping standing");
        }

        // AND CANON FOLLOWS THE CHOICE, not just NORMA. rmap:absorbed and
        // rmap:sepnames are the two cells that read NORMA's subtype flag as an
        // absorption verdict, so they are where the choice lands; rmap:assim is
        // NORMA's own carrier and is left alone (its third field is
        // refersToSubtype, held against state:normaassim). Before this, a store
        // that chose Separate answered F on six laws where the same store without
        // the sentence answered 63 of 63.
        //
        // THE RULE, MEASURED 2026-09-11 with both cases side by side. Canon names
        // the reference after the LAST assimilation step's target; NORMA after the
        // FIRST's; and the two coincide on every walk that goes DOWN, which is
        // every walk any corpus has today.
        //
        //   absorbed   Function.subscriptionPlanCode, path
        //              assim Function->Object Type Instance
        //              assim Object Type Instance->Subscription
        //              info  Subscription->Plan Code
        //              last assim target = Subscription; both sides say
        //              "subscription", and canon is right.
        //
        //   separated  Subscription.<the reference>, path (the same three
        //              reversed)
        //              assim Object Type Instance->Subscription
        //              assim Function->Object Type Instance
        //              info  Function->Function_id
        //              last assim target = Object Type Instance, so canon says
        //              objectTypeInstanceId; FIRST assim target = Subscription,
        //              the table's own concept type, so NORMA says subscriptionId.
        //
        // WHERE IT IS DECIDED. In the NAMING path the separated reference's first
        // step is not an assim at all: rmap:colpathsP:derive builds it from a
        // rmap:seprefs row as
        //     <"rel", assimilated, assimilator, assimilated, [factName],
        //      isPreferredForTarget>
        // and cn:asrun's WHILE only runs over consecutive `assim` heads, so with a
        // `rel` head it returns its seed, <N(3)(head), head> -- element 3, the
        // ASSIMILATOR. That one selector is the whole difference; NORMA wants
        // element 2, the assimilated, which is the table's own concept type.
        //
        // AND BOTH ONE-LINE FIXES ARE WRONG, which is why this is still a
        // measurement. Changing colpathsP's element 3 propagates, because
        // rmap:colpaths:derive is built FROM colpathsP and rewrites this rel into
        // NORMA's <"assim", step.3, step.2, step.3>, matching seprefs on <step.2,
        // step.3, factName> -- so the compared cell and its membership test both
        // break and colpaths-normacolpaths goes red. Testing the step's element 6
        // instead misfires: it reads as IsPreferredForTarget here, but the base's
        // 151 ordinary `rel` steps carry "T" in that slot from a different branch,
        // so the test would rename every relation foreign key in every store.
        //
        // What it wants is a discriminator of its own -- a distinct kind atom for
        // the seprefs-built step, or a seventh element -- carried through
        // colpathsP and matched by the colpaths rewrite in place of the current
        // membership test. That is two cells and their tests, not one selector.
        //
        // THE FOUR STILL RED are ONE difference, and it is a column name.
        // rmap:seprefs' fourth field, IsPreferredForTarget, now reads
        // `Subtype Fact provides preferred identifier` and answers T for a
        // subtyping that identifies, so canon emits Subscription_PK where it used
        // to emit a uniqueness beside a key -- measured in
        // rmap:normaconstraints_witness, which went from
        //   canon ["uc", "Subscription", "Subscription_UC", ["objectTypeInstanceId"]]
        // to
        //   canon ["pk", "Subscription", "Subscription_PK", ["objectTypeInstanceId"]]
        // against NORMA's ["pk", "Subscription", "Subscription_PK", ["subscriptionId"]].
        // What is left is objectTypeInstanceId versus subscriptionId: canon names a
        // separated assimilation's reference after the ASSIMILATOR, NORMA after the
        // table's own concept type when the assimilation is its preferred identifier
        // (NAMEGEN, GenerateColumnsForConceptTypePreferredIdentifier). Canon's PATH
        // already matches -- colpaths-normacolpaths is green -- so this is the cn:
        // walk and nothing upstream of it. The four laws below all fail on that one
        // name, and the assertion is deliberately exact so that fixing it turns the
        // test red and forces this comment to be rewritten.
        [Fact]
        public void CanonsRelationalMapFollowsTheAbsorptionChoice()
        {
            string fixtures = Path.Combine(Oracle.Root, "tools", "norma-oracle-tests", "absorption");
            Func<string, List<string>> report = name =>
            {
                List<string> dirs = Corpus.Directories("metamodel");
                dirs.Add(Path.Combine(fixtures, name));
                Oracle.Run r = Oracle.Execute(Oracle.Scratch("absorption", name + "-laws"), dirs);
                Assert.True(Oracle.Crash(r.Output) == null, name + ": the oracle crashed: " + Oracle.Crash(r.Output));
                return Oracle.LawReport(r.Scratch).Output
                    .Split('\n').Where(l => l.Contains("LAW FAILED")).Select(l => l.Trim()).ToList();
            };

            Assert.Empty(report("absorbed"));

            List<string> failed = report("separated");
            Assert.DoesNotContain(failed, l => l.Contains("tables-normatables"));
            Assert.DoesNotContain(failed, l => l.Contains("colpaths-normacolpaths"));
            Assert.DoesNotContain(failed, l => l.Contains("assimilations-normaassim"));
            Assert.Equal(
                new[]
                {
                    "LAW FAILED: schema-match -> F",
                    "LAW FAILED: colnames-normacolnames -> F",
                    "LAW FAILED: colorder-normacolorder -> F",
                    "LAW FAILED: constraints-normaconstraints -> F",
                },
                failed);
        }
    }
}
