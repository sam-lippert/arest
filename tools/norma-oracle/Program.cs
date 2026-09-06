// norma-oracle spike: boot NORMA headless, build a two-object model via the
// API, and confirm (a) the store loads, (b) model errors surface, (c) the
// ORM -> Abstraction -> ConceptualDatabase bridges populate live so RMAP
// results are readable. Grows into the readings verifier once green.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.VisualStudio.Modeling;
using ORMSolutions.ORMArchitect.Core.ObjectModel;
using ORMSolutions.ORMArchitect.Core.Load;
using ORMSolutions.ORMArchitect.Framework;
using ORMSolutions.ORMArchitect.Framework.Shell;

namespace Arest.NormaOracle
{
	internal static class Program
	{
		private static readonly string[] ProbeDirs =
		{
			@"C:\Program Files\Microsoft Visual Studio\18\Professional\Common7\IDE\Extensions\4btgttbq.44q",
			@"C:\Program Files\Microsoft Visual Studio\18\Professional\Common7\IDE\Extensions\4btgttbq.44q\Extensions",
			@"C:\Program Files\Microsoft Visual Studio\18\Professional\Common7\IDE\PrivateAssemblies",
			@"C:\Program Files\Microsoft Visual Studio\18\Professional\Common7\IDE\PublicAssemblies",
			@"C:\Program Files\Microsoft Visual Studio\18\Professional\Common7\IDE",
		};

		// PHASE TIMINGS. A closure run takes minutes and printed one timing line,
		// the map's; every section boundary now prints how long the previous
		// section took, so a slow run names its slow phase.
		private static System.Diagnostics.Stopwatch myPhase;
		private static System.Diagnostics.Stopwatch myTotal;
		private static string myPhaseName;
		private static void TimedCommit(Transaction t)
		{
			var sw = System.Diagnostics.Stopwatch.StartNew();
			t.Commit();
			Console.WriteLine("timing: commit " + sw.ElapsedMilliseconds + " ms");
		}
		private static void Mark(string next)
		{
			if (myPhase == null)
			{
				myPhase = System.Diagnostics.Stopwatch.StartNew();
				myTotal = System.Diagnostics.Stopwatch.StartNew();
			}
			else
			{
				Console.WriteLine("timing: " + myPhaseName + " " + myPhase.ElapsedMilliseconds + " ms");
				myPhase.Restart();
			}
			myPhaseName = next;
			if (next == "end") Console.WriteLine("timing: total " + myTotal.ElapsedMilliseconds + " ms");
		}
		private static int Main(string[] args)
		{
			AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs e)
			{
				string name = new AssemblyName(e.Name).Name;
				foreach (string dir in ProbeDirs)
				{
					string candidate = System.IO.Path.Combine(dir, name + ".dll");
					if (System.IO.File.Exists(candidate))
					{
						return Assembly.LoadFrom(candidate);
					}
				}
				return null;
			};
			try
			{
				return Run(args);
			}
			catch (Verifier.Refusal refused)
			{
				// the run asked whether it could write and was told no: one line,
				// because there is nothing to debug and a stack reads as a crash
				Console.Error.WriteLine("REFUSED: " + refused.Message);
				return 2;
			}
			catch (Exception ex)
			{
				Console.Error.WriteLine("FATAL: " + ex);
				return 2;
			}
		}

		private static IEnumerable<Type> LoadableTypes(Assembly asm)
		{
			// VSIX assemblies carry VS-shell-facing types that cannot load
			// headless; the domain models themselves can. Take what loads.
			try
			{
				return asm.GetTypes();
			}
			catch (ReflectionTypeLoadException ex)
			{
				return ex.Types.Where(t => t != null);
			}
		}

		private static int Run(string[] args)
		{
			// 1. Discover every DomainModel the referenced NORMA assemblies offer.
			Assembly[] assemblies =
			{
				typeof(ORMCoreDomainModel).Assembly,
				Assembly.Load("ORMSolutions.ORMArchitect.ORMAbstraction.VS2022"),
				Assembly.Load("ORMSolutions.ORMArchitect.ORMToORMAbstractionBridge.VS2022"),
				Assembly.Load("ORMSolutions.ORMArchitect.ORMAbstractionToConceptualDatabaseBridge.VS2022"),
				Assembly.Load("ORMSolutions.ORMArchitect.RelationalModels.VS2022"),
			};
			List<Type> domainModels = new List<Type>
			{
				typeof(CoreDomainModel),
			};
			foreach (Assembly asm in assemblies)
			{
				foreach (Type t in LoadableTypes(asm))
				{
					if (typeof(DomainModel).IsAssignableFrom(t) && !t.IsAbstract &&
						!t.Name.Contains("Shape") && !t.Name.Contains("DesignSurface") &&
						!t.Name.Contains("Diagram") && !t.Name.Contains("HtmlReport"))
					{
						domainModels.Add(t);
					}
				}
			}
			domainModels.Sort((x, y) => string.CompareOrdinal(x.FullName, y.FullName));
			Console.WriteLine("domain models to load:");
			foreach (Type t in domainModels.Distinct())
			{
				Console.WriteLine("  " + t.FullName);
			}

			// 2. Boot the store the way ORM2CommandLineTest does.
			OracleStore store = new OracleStore();
			store.LoadDomainModels(domainModels.Distinct().ToArray());
			store.UndoManager.UndoState = UndoState.Disabled;
			ModelingEventManager eventManager = ModelingEventManager.GetModelingEventManager(store);
			// Enter through NORMA's front door: deserialize a minimal seed
			// model so the load-time fixups run (intrinsic data types, bridge
			// initialization) exactly as they do for a real .orm file.
			string seed =
				"<ormRoot:ORM2 xmlns:ormRoot=\"http://schemas.neumont.edu/ORM/2006-04/ORMRoot\" xmlns:orm=\"http://schemas.neumont.edu/ORM/2006-04/ORMCore\">" +
				"<orm:ORMModel id=\"_" + Guid.NewGuid() + "\" Name=\"Arest\"/>" +
				"</ormRoot:ORM2>";
			Mark("load");
			using (Transaction t = store.TransactionManager.BeginTransaction("load"))
			{
				foreach (IModelingEventSubscriber subscriber in Utility.EnumerateDomainModels<IModelingEventSubscriber>(store.DomainModels))
				{
					subscriber.ManageModelingEventHandlers(eventManager, EventSubscriberReasons.DocumentLoading | EventSubscriberReasons.ModelStateEvents, EventHandlerAction.Add);
				}
				using (System.IO.MemoryStream seedStream = new System.IO.MemoryStream(System.Text.Encoding.UTF8.GetBytes(seed)))
				{
					(new ORMSerializationEngine(store)).Load(seedStream);
				}
				TimedCommit(t);
			}
			foreach (IModelingEventSubscriber subscriber in Utility.EnumerateDomainModels<IModelingEventSubscriber>(store.DomainModels))
			{
				subscriber.ManageModelingEventHandlers(eventManager, EventSubscriberReasons.DocumentLoaded | EventSubscriberReasons.ModelStateEvents, EventHandlerAction.Add);
			}
			Console.WriteLine("store loaded: " + store.DomainModels.Count + " domain models");

			// 3. Parse the Arest metamodel readings and build the ORM model.
			ORMModel model = store.ElementDirectory.FindElements<ORMModel>(false).First();
			Console.WriteLine("seed model: " + model.Name + ", intrinsic data types: " + model.DataTypeCollection.Count);

			// ORACLE_RING_PROBE=1: instead of mapping the metamodel, build the
			// minimal NORMA-only scenario — one entity type, one ring m:n fact
			// (spanning UC), one unary fact — and dump the resulting model
			// errors. Documents the raw collision NORMA produces BY
			// CONSTRUCTION (identical link readings on a same-player fact);
			// the main pipeline FIXES it via DisambiguateRingLinkReadings
			// (ordinal-qualified link readings), so the probe shows the
			// disease and the main report must show zero errors, unclassified.
			if (Environment.GetEnvironmentVariable("ORACLE_RING_PROBE") == "1")
			{
				Mark("ring probe");
				using (Transaction t = store.TransactionManager.BeginTransaction("ring probe"))
				{
					ObjectType thing = new ObjectType(store);
					thing.Name = "ProbeThing";
					thing.Model = model;
					thing.ReferenceModeString = "id";
					FactType ring = new FactType(store);
					ring.Model = model;
					Role r1 = new Role(store);
					ring.RoleCollection.Add(r1);
					r1.RolePlayer = thing;
					Role r2 = new Role(store);
					ring.RoleCollection.Add(r2);
					r2.RolePlayer = thing;
					ReadingOrder ro = new ReadingOrder(store);
					ring.ReadingOrderCollection.Add(ro);
					ro.RoleCollection.Add(r1);
					ro.RoleCollection.Add(r2);
					Reading ringReading = new Reading(store);
					ro.ReadingCollection.Add(ringReading);
					ringReading.Text = "{0} probes {1}";
					UniquenessConstraint ringUC = UniquenessConstraint.CreateInternalUniquenessConstraint(ring);
					ringUC.RoleCollection.Add(r1);
					ringUC.RoleCollection.Add(r2);
					FactType unary = new FactType(store);
					unary.Model = model;
					Role u1 = new Role(store);
					unary.RoleCollection.Add(u1);
					u1.RolePlayer = thing;
					ReadingOrder uo = new ReadingOrder(store);
					unary.ReadingOrderCollection.Add(uo);
					uo.RoleCollection.Add(u1);
					Reading unaryReading = new Reading(store);
					uo.ReadingCollection.Add(unaryReading);
					unaryReading.Text = "{0} is probed";
					TimedCommit(t);
				}
				Console.WriteLine();
				Mark("RING PROBE");
				Console.WriteLine("== RING PROBE: NORMA errors for {ring m:n fact, unary fact} alone ==");
				Verifier.DumpErrors(store, Console.Out);
				return 0;
			}

			// SEVERAL directories, not one. Taking a single directory is why every app
			// station carries its own COPY of the eleven metamodel files inside
			// .combined - a second metamodel by construction, which is exactly what the
			// merge was supposed to end. The copy has already cost two fires: one
			// tracing a carrier byte-difference that was only the copy lagging a ruling,
			// and one proposing that lag as the cause of an unrelated red law.
			// Reading the metamodel by REFERENCE removes the duplicate rather than
			// refreshing it - 566a1043 refreshed it and it came back, because a refresh
			// does not fix a mechanism that regenerates the problem.
			string[] sourceDirs = args.Length > 0
				? args
				: new string[] { System.IO.Path.Combine("..", "..", "metamodel") };
			// Carriers are written relative to the CWD while the model is read from
			// here, so the two can disagree. Record which source this run read;
			// Verifier.WriteCarrier refuses to land it on a carrier built from a
			// different one. See the comment there for the incident this exists for.
			// With several dirs the identity is all of them, in order.
			var srcIds = new List<string>();
			foreach (string d in sourceDirs) srcIds.Add(System.IO.Path.GetFullPath(d));
			Verifier.CarrierSourceId = string.Join(";", srcIds);
			var fileList = new List<string>();
			// CANON FIRST. Files sort by name within a source directory (core.md
			// first) and the directories keep the order they were given, so the
			// metamodel's declarations land before any app's. One sort across
			// every directory put law-core's core-types.md before the metamodel's
			// instances.md, and the app's 'Citation is a value type' was the
			// declaration kept while the canon's entity was the one reported
			// (measured 2026-09-03 in every corpus that carries law-core).
			foreach (string d in sourceDirs)
			{
				string[] dirFiles = System.IO.Directory.GetFiles(d, "*.md");
				Array.Sort(dirFiles, (x, y) => string.CompareOrdinal(
					System.IO.Path.GetFileName(x) == "core.md" ? "0" : System.IO.Path.GetFileName(x),
					System.IO.Path.GetFileName(y) == "core.md" ? "0" : System.IO.Path.GetFileName(y)));
				fileList.AddRange(dirFiles);
			}
			string[] files = fileList.ToArray();
			var fileSentences = new Dictionary<string, List<string>>();
			foreach (string f in files)
			{
				fileSentences[f] = Verifier.ExtractSentences(System.IO.File.ReadAllText(f));
			}

			Verifier verifier = new Verifier(store, model);
			foreach (string f in files)
			{
				verifier.RegisterMarkers(System.IO.File.ReadAllText(f));
			}
			Mark("declarations");
			// ONE TRANSACTION FOR THE WHOLE BUILD. NORMA validates the model at every
			// commit and that validation grows with the model: nine phase commits paid
			// nine model-wide validations (us-law closure, 2026-09-03: declarations 15 s,
			// the map's commit 39 s, textual constraints 37 s, derivation rules 69 s).
			// Every phase from the declarations to the set-semantics assumption now
			// shares one transaction and one commit; the errors dump, which reads that
			// validation, follows the commit as before.
			Transaction build = store.TransactionManager.BeginTransaction("build");
			{
				foreach (string f in files)
				{
					verifier.DeclarePass(fileSentences[f]);
				}
				// schemes AFTER every file's declarations: cross-file order
				// must not decide a component's kind
				verifier.FlushSchemes();
			}
			// THE DECLARATIONS COMMIT ON THEIR OWN TOO: with the schemes and the readings in
			// one commit the same bridge threw during the map (us-law, 2026-09-03).
			TimedCommit(build);
			build.Dispose();
			build = store.TransactionManager.BeginTransaction("map");
			// ONE TRANSACTION FOR THE WHOLE MAP. NORMA validates at commit and that
			// validation grows with the model, so a commit per file made the closure
			// corpora quadratic: past seventy files each commit took minutes. One commit
			// validates once; the per-file map timing stays on the mapped line.
			var swCommit = new System.Diagnostics.Stopwatch();
			Mark("map");
			{
				foreach (string f in files)
				{
					verifier.ResetContext();
					var swMap = System.Diagnostics.Stopwatch.StartNew();
					verifier.MapPass(fileSentences[f]);
					swMap.Stop();
					Console.WriteLine("mapped: " + System.IO.Path.GetFileName(f) + " (" + fileSentences[f].Count + " sentences, map " + swMap.ElapsedMilliseconds + " ms)");
				}
				swCommit.Start();
				swCommit.Stop();
			}
			// THE MAP COMMITS ON ITS OWN. NORMA's ORM-to-OIAL bridge validates incrementally
			// at commit and threw KeyNotFoundException (us-law, 2026-09-03) when the fact
			// types, their constraints and their derivations arrived in one commit; with
			// the fact types committed first, everything after them shares one transaction.
			TimedCommit(build);
			build.Dispose();
			Console.WriteLine("mapped every file");
			verifier.ReportMapTiming();
			build = store.TransactionManager.BeginTransaction("constrain");

			Mark("deferred constraints");
			{
				verifier.ReplayProseReadings();
				verifier.ReplayObjectifications();
				verifier.ReplayDeferred();
			}
			Mark("textual constraints");
			{
				verifier.BuildTextualConstraints();
			}
			List<string> builtDerivations;
			Mark("derivation rules");
			{
				builtDerivations = verifier.BuildDerivationRules();
			}
			Console.WriteLine();
			Mark("derivation rules built through NORMA's inbuilt mechanism (linear two-leg class)");
			Console.WriteLine("== derivation rules built through NORMA's inbuilt mechanism (linear two-leg class) ==");
			foreach (string l in builtDerivations) Console.WriteLine("  " + l);
			if (builtDerivations.Count == 0) Console.WriteLine("  (none matched the class)");

			List<string> readBack = verifier.ReadBackDerivationRules();
			Console.WriteLine();
			Mark("read-back");
			Console.WriteLine("== read-back: every built lead path against the rule text it claims ==");
			foreach (string l in readBack) Console.WriteLine("  " + l);

			List<string> ringLinks;
			Mark("ring link disambiguation");
			{
				ringLinks = Verifier.DisambiguateRingLinkReadings(store);
			}
			Console.WriteLine();
			Mark("ring link readings (ordinal-qualified where a player repeats)");
			Console.WriteLine("== ring link readings (ordinal-qualified where a player repeats) ==");
			foreach (string l in ringLinks) Console.WriteLine("  " + l);
			if (ringLinks.Count == 0) Console.WriteLine("  (none needed)");

			// the last two mechanical readers from the killed host's checker
			// (the third, the SSRF guard, dissolved into the semantic-
			// constraint classification: deontic with a no-instance player,
			// enforced at fetch time, never a model check)
			Console.WriteLine();
			Mark("reader");
			Console.WriteLine("== reader: ring completeness (same-player m:n without a ring constraint; deontic findings) ==");
			var ringFindings = verifier.CheckRingCompleteness();
			foreach (string f in ringFindings) Console.WriteLine("  ~ " + f);
			if (ringFindings.Count == 0) Console.WriteLine("  (none)");
			Console.WriteLine();
			Mark("reader");
			Console.WriteLine("== reader: singular naming (a name that is another's plural per the model's own rules) ==");
			var nameFindings = verifier.CheckSingularNaming();
			foreach (string f in nameFindings) Console.WriteLine("  ~ " + f);
			if (nameFindings.Count == 0) Console.WriteLine("  (none)");
			Mark("instance facts");
			{
				verifier.AttributeInstanceFacts();
			}
			List<string> assumed;
			List<string> arityLog;
			Mark("reading arity");
			{
				arityLog = verifier.RepairReadingArity();
			}
			foreach (string l in arityLog) Console.WriteLine("  " + l);
			Mark("set semantics");
			{
				assumed = verifier.AssumeSetSemantics();
			}
			TimedCommit(build);
			build.Dispose();

			Console.WriteLine();
			Mark("FINDING");
			Console.WriteLine("== FINDING: fact types with no declared uniqueness (spanning UC assumed per Def 3 set semantics) ==");
			foreach (string a in assumed) Console.WriteLine("  " + a);
			Console.WriteLine("  TOTAL ASSUMED: " + assumed.Count);

			Console.WriteLine();
			Mark("sentence census");
			Console.WriteLine("== sentence census ==");
			foreach (var kv in verifier.Census)
			{
				Console.WriteLine("  {0,4}  {1}", kv.Value, kv.Key);
			}
			Console.WriteLine();
			Mark("unrecognized sentences");
			Console.WriteLine("== unrecognized sentences ==");
			int shown = 0;
			foreach (string u in verifier.Unrecognized)
			{
				Console.WriteLine("  " + u);
				if (++shown >= 40) { Console.WriteLine("  ..."); break; }
			}
			if (shown == 0) Console.WriteLine("  (none)");
			Console.WriteLine();
			// PROSE THAT BECAME A FACT TYPE. The census counts sentences SKIPPED as
			// prose; nothing counted the opposite, a sentence read AS a reading. One
			// such -- "Who calls which API, and what they are trying to do with it."
			// in auto.dev -- reached state:fts, then rmap, then the generated schema
			// as a column, and surfaced only as canon and NORMA disagreeing about that
			// column's name. Nothing between the sentence and the schema said a word.
			//
			// Sentence punctuation in a NAME is the cheap signal. It carries false
			// positives -- AgencyMayNotWithdraw,Suspend,Revoke,OrAnnul... is a genuine
			// enumeration in us-law -- and it is worth them, because the alternative is
			// a phantom fact type reaching a schema unremarked. It also catches the
			// unquoted-value class: an instance fact like "... on October 30, 2023."
			// mints a fact type named for the whole sentence.
			Mark("FINDING");
			Console.WriteLine("== FINDING: fact type names carrying sentence punctuation ==");
			int prosey = 0;
			foreach (FactType pft in store.ElementDirectory.FindElements<FactType>(true))
			{
				if (pft.IsDeleted) continue;
				string pnm = pft.Name;
				if (string.IsNullOrEmpty(pnm)) continue;
				if (pnm.IndexOf(',') < 0 && pnm.IndexOf(';') < 0 && pnm.IndexOf('?') < 0) continue;
				Console.WriteLine("  " + pnm);
				prosey++;
			}
			if (prosey == 0) Console.WriteLine("  (none)");
			else Console.WriteLine("  TOTAL: " + prosey + " -- check each against its source sentence");
			Console.WriteLine();
			Mark("harness map log");
			Console.WriteLine("== harness map log ==");
			foreach (string line in verifier.MapLog) Console.WriteLine("  " + line);
			Console.WriteLine();
			// second disambiguation sweep: the checker-era readers above build
			// facts AFTER the first pass, and their rings' link readings would
			// otherwise reach the report unqualified (the rewriter is
			// idempotent, so already-qualified readings are untouched)
			Mark("ring link disambiguation (late facts)");
			using (Transaction t2 = store.TransactionManager.BeginTransaction("ring link disambiguation (late facts)"))
			{
				Verifier.DisambiguateRingLinkReadings(store);
				TimedCommit(t2);
			}
			Mark("NORMA model errors");
			Console.WriteLine("== NORMA model errors ==");
			Verifier.DumpErrors(store, Console.Out);
			Console.WriteLine();
			Mark("value-type data types");
			Console.WriteLine("== value-type data types ==");
			verifier.DumpDataTypes(Console.Out);

			Console.WriteLine();
			Mark("RMAP");
			Console.WriteLine("== RMAP: relational result ==");
			Verifier.DumpRelational(store, assemblies[4], Console.Out);

			// the carriers, in the intersection dialect per the pure-math
			// ruling: the design state the canon's defs consume, and NORMA's
			// own RMAP answer to confirm against. Any law-holding host
			// consumes these by exec'ing the same canon bytes — the laws are
			// the law: family in the canon; the composed-file recipe
			// (vocabulary ; arest ; carriers ; apply-and-print) is the
			// sanctioned host shape whenever one is called for.
			verifier.WriteDesignState("design-state",
				verifier.InputStateCells()
				+ Verifier.MappingStateCells(store, assemblies[1], assemblies[2], assemblies[4]));
			Verifier.WriteNormaAnswer(store, assemblies[4], assemblies[1], assemblies[3], "norma-answer", verifier.FullyDerivedNames());
			// the build surface as FORML instance facts (arest #94): the same
			// derivation-mode / delivered / declined facts this tool has always
			// printed, written where a corpus can read them instead of a log.
			verifier.WriteBuildFacts("build-facts.md");
			// the run's outcome as a carrier of its own (the regression check composes
			// it without the schema), and the same in the expectation's form: recording
			// an accepted run is copying that file beside the corpus's name
			verifier.WriteOutcome("outcome", builtDerivations);
			verifier.WriteExpectation("expectation", builtDerivations);
			Console.WriteLine();
			Mark("carriers");
			Console.WriteLine("== carriers ==");
			Console.WriteLine("  written: design-state, norma-answer (intersection source)");

			// 5. Verbalization leg — NORMA's generate-only direction (the
			// automated verbalizer of Halpin & Curland 2006). The harness
			// parse leg carried sentences IN; this emits NORMA's own
			// verbalization of the built model OUT: the whitepaper's nf
			// round-trip demonstrated in both directions by the reference
			// implementation. HTML is NORMA's native output; a tag-stripped
			// text distillation is written alongside for reading and diffs.
			Console.WriteLine();
			Mark("VERBALIZATION");
			Console.WriteLine("== VERBALIZATION: NORMA generate leg (nf out-direction) ==");
			// FACT TYPES FIRST: the verbalization engine dedups — once an
			// object-type block lists a fact's reading, the fact-type element
			// is "already verbalized" and its CONSTRAINTS never emit. Leading
			// with fact types makes every reading carry its constraints.
			var verbalizeElements = new List<ModelElement>();
			foreach (FactType ft in model.FactTypeCollection.OrderBy(f => f.Name, StringComparer.Ordinal))
			{
				if (ft.ImpliedByObjectification == null)
				{
					verbalizeElements.Add(ft);
				}
			}
			foreach (ObjectType ot in model.ObjectTypeCollection.OrderBy(o => o.Name, StringComparer.Ordinal))
			{
				if (ot.IsImplicitBooleanValue) continue;
				// implied objectifying types exist for NORMA's own m:n
				// machinery; their link-fact readings are the documented ring
				// twins and not part of the model's own sentence surface
				Objectification nesting = ot.Objectification;
				if (nesting != null && nesting.IsImplied) continue;
				verbalizeElements.Add(ot);
			}
			VerbalizationManager verbalizationManager = VerbalizationManager.LoadFromDirectories(new string[] { "." });
			var htmlBuffer = new System.Text.StringBuilder();
			using (var htmlWriter = new System.IO.StringWriter(htmlBuffer))
			{
				verbalizationManager.Verbalize(store, htmlWriter, ORMCoreDomainModel.VerbalizationTargetName, verbalizeElements);
			}
			string html = htmlBuffer.ToString();
			System.IO.File.WriteAllText("verbalization-report.html", html);
			string text = System.Text.RegularExpressions.Regex.Replace(html, @"<(?:br|/p|/div)[^>]*>", "\n");
			text = System.Text.RegularExpressions.Regex.Replace(text, @"<[^>]+>", "");
			text = System.Net.WebUtility.HtmlDecode(text);
			text = System.Text.RegularExpressions.Regex.Replace(text, @"[ \t]+\n", "\n");
			text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");
			System.IO.File.WriteAllText("verbalization-report.txt", text.Trim() + "\n");
			int sentenceCount = 0;
			foreach (string line in text.Split('\n'))
			{
				if (line.Trim().Length > 0) sentenceCount++;
			}
			Console.WriteLine("  elements verbalized: " + verbalizeElements.Count);
			Console.WriteLine("  verbalization lines: " + sentenceCount);
			Console.WriteLine("  written: verbalization-report.html, verbalization-report.txt");

			// 6. THE NF ROUND-TRIP GATE (exec ruling 1: all verbalizations are
			// canonical). NORMA's generated sentences are re-parsed through
			// the same parse leg into a SECOND store; the two models are
			// compared on reading signatures, subtype edges, and UC spans.
			// A-only readings = phrasings NORMA re-emits differently
			// (non-canonical source or emit gap); B-only = generated
			// phrasings the parse leg misread (parse gap). Both are
			// findings; the source moves toward the canonical form.
			Console.WriteLine();
			Mark("nf round-trip (verbalize, then re-parse into a second model)");
			Console.WriteLine("== nf round-trip (verbalize, then re-parse into a second model) ==");
			var feed = new List<string>();
			var bSubtypes = new List<string>();
			var joined = new List<string>();
			foreach (string rawLine in text.Split('\n'))
			{
				string line = rawLine.Trim();
				if (line.Length == 0) continue;
				// HTML breaks split multi-clause verbalizations mid-sentence;
				// a continuation starts lowercase (or with a connective) and
				// rejoins its opener
				if (joined.Count > 0 &&
					(char.IsLower(line[0]) || line.StartsWith("and ") || line.StartsWith("or ")) &&
					!joined[joined.Count - 1].TrimEnd().EndsWith("."))
				{
					joined[joined.Count - 1] = joined[joined.Count - 1].TrimEnd() + " " + line;
					continue;
				}
				joined.Add(line);
			}
			foreach (string lineJoined in joined)
			{
				string line = lineJoined;
				if (line.Contains("{") || line.StartsWith("ORM2 Verbalization") ||
					line.StartsWith("Fact Types:") || line.StartsWith("Reference Scheme:") ||
					line.StartsWith("Data Type:") || line.StartsWith("Reference Mode:") ||
					line.Contains("_id") || line.Contains(" is involved ") ||
					line.Contains(" involves ") ||
					line.Contains("“") || line.Contains("”"))
				{
					continue;
				}
				// "Used By Derivations:" cross-reference lines name constraint
				// elements ("Value comparison constraint X."), not readings
				if (System.Text.RegularExpressions.Regex.IsMatch(line,
					@"^(Value comparison|Uniqueness|Subset|Exclusion|Ring|Frequency|Mandatory) constraint [\w]+\.$"))
				{
					continue;
				}
				// a DERIVED fact type verbalizes as its derivation block
				// ("*<reading> if and only if ..."), replacing the plain
				// reading line — synthesize the declaration deterministically
				// from the block's own head (everything before the connective)
				if (line.StartsWith("*") && line.Contains(" if and only if "))
				{
					// one star = derived not stored, two = derived STORED;
					// the head is the reading either way
					string head = line.Substring(0, line.IndexOf(" if and only if ", StringComparison.Ordinal)).TrimStart('*').Trim();
					feed.Add(head + ".");
					continue;
				}
				if (line.StartsWith("*") )
				{
					continue;
				}
				// NORMA emits association lines for its IMPLIED objectifications
				// too (generated names never declared in model A); the canonical
				// surface is A's declared vocabulary — skip the machinery ones
				System.Text.RegularExpressions.Match am =
					System.Text.RegularExpressions.Regex.Match(line, @"provides the preferred identification scheme for ([\w :]+)\.$");
				if (am.Success && !verifier.HasType(am.Groups[1].Value.Trim()))
				{
					continue;
				}
				// same doctrine for reference-mode expansion readings: an app
				// natural (Customer(.Nr)) makes NORMA mint Customer_Nr and a
				// "Customer has Customer_Nr" reading — machinery, never an
				// A-declared sentence (underscore names cannot be declared)
				System.Text.RegularExpressions.Match rm =
					System.Text.RegularExpressions.Regex.Match(line, @" has ([A-Za-z][\w]*_[\w]+)\.$");
				if (rm.Success && !verifier.HasType(rm.Groups[1].Value.Trim()))
				{
					continue;
				}
				System.Text.RegularExpressions.Match im =
					System.Text.RegularExpressions.Regex.Match(line, @"^Each ([\w :]+?) is an instance of ([\w :]+?)\.$");
				if (im.Success)
				{
					bSubtypes.Add(im.Groups[1].Value.Trim() + " < " + im.Groups[2].Value.Trim());
					// subtype-identified entity types get no declaration line
					// of their own — their entity-hood IS the instance-of
					// sentence; synthesize the declaration for the B parse
					feed.Add(im.Groups[1].Value.Trim() + " is an entity type.");
					continue;
				}
				feed.Add(line);
			}
			OracleStore storeB = new OracleStore();
			storeB.LoadDomainModels(domainModels.Distinct().ToArray());
			storeB.UndoManager.UndoState = UndoState.Disabled;
			ModelingEventManager eventManagerB = ModelingEventManager.GetModelingEventManager(storeB);
			Mark("nf load");
			// THE SECOND MODEL IS NEVER COMMITTED. The round-trip reads its reading keys,
			// subtype edges and uniqueness spans, structure that exists inside the open
			// transaction; four commits paid NORMA's whole-model validation for errors
			// nobody reads (eu-law 2026-09-03: 12 s of 72; us-law: a minute). The
			// comparison runs before the transaction is disposed, and disposal rolls back.
			Transaction nf = storeB.TransactionManager.BeginTransaction("nf");
			{
				foreach (IModelingEventSubscriber subscriber in Utility.EnumerateDomainModels<IModelingEventSubscriber>(storeB.DomainModels))
				{
					subscriber.ManageModelingEventHandlers(eventManagerB, EventSubscriberReasons.DocumentLoading | EventSubscriberReasons.ModelStateEvents, EventHandlerAction.Add);
				}
				string seedB =
					"<ormRoot:ORM2 xmlns:ormRoot=\"http://schemas.neumont.edu/ORM/2006-04/ORMRoot\" xmlns:orm=\"http://schemas.neumont.edu/ORM/2006-04/ORMCore\">" +
					"<orm:ORMModel id=\"_" + Guid.NewGuid() + "\" Name=\"ArestNf\"/>" +
					"</ormRoot:ORM2>";
				using (System.IO.MemoryStream seedStream = new System.IO.MemoryStream(System.Text.Encoding.UTF8.GetBytes(seedB)))
				{
					(new ORMSerializationEngine(storeB)).Load(seedStream);
				}
			}
			ORMModel modelB = storeB.ElementDirectory.FindElements<ORMModel>(false).First();
			Verifier verifierB = new Verifier(storeB, modelB);
			var feedSentences = new List<string>();
			foreach (string line in feed)
			{
				feedSentences.AddRange(Verifier.ExtractSentences(line));
			}
			Mark("nf declarations");
			{
				verifierB.DeclarePass(feedSentences);
			}
			Mark("nf map");
			{
				verifierB.MapPass(feedSentences);
			}
			Mark("nf deferred");
			{
				verifierB.ReplayDeferred();
				verifierB.BuildTextualConstraints();
				verifierB.AttributeInstanceFacts();
				// Def 3: spanning UCs on n-ary m:n facts verbalize as the
				// possible-family (no restrictive sentence), so set semantics
				// is assumed on re-parse exactly as on first parse
				verifierB.AssumeSetSemantics();
			}
			var aKeys = new HashSet<string>(verifier.ReadingKeys(), StringComparer.Ordinal);
			var bKeys = new HashSet<string>(verifierB.ReadingKeys(), StringComparer.Ordinal);
			var aOnly = aKeys.Except(bKeys).OrderBy(x => x, StringComparer.Ordinal).ToList();
			var bOnly = bKeys.Except(aKeys).OrderBy(x => x, StringComparer.Ordinal).ToList();
			Console.WriteLine("  readings: model A " + aKeys.Count + ", re-parsed B " + bKeys.Count + ", matched " + (aKeys.Count - aOnly.Count));
			Console.WriteLine("  A-only (source phrasing NORMA does not re-emit — move source toward canonical): " + aOnly.Count);
			foreach (string k in aOnly.Take(15)) Console.WriteLine("      - " + k);
			if (aOnly.Count > 15) Console.WriteLine("      ... and " + (aOnly.Count - 15) + " more");
			Console.WriteLine("  B-only (generated phrasing the parse leg misreads — parse gap): " + bOnly.Count);
			foreach (string k in bOnly.Take(15)) Console.WriteLine("      - " + k);
			if (bOnly.Count > 15) Console.WriteLine("      ... and " + (bOnly.Count - 15) + " more");
			var aEdges = new HashSet<string>(verifier.SubtypeEdges(), StringComparer.Ordinal);
			var bEdges = new HashSet<string>(bSubtypes.Concat(verifierB.SubtypeEdges()), StringComparer.Ordinal);
			Console.WriteLine("  subtype edges: A " + aEdges.Count + ", B " + bEdges.Count +
				", A-only " + aEdges.Except(bEdges).Count() + ", B-only " + bEdges.Except(aEdges).Count());
			var aUcs = verifier.UcSignatures();
			var bUcs = verifierB.UcSignatures();
			int ucAgree = 0, ucDiffer = 0;
			var ucSamples = new List<string>();
			foreach (var kv in aUcs)
			{
				List<string> b;
				if (!bUcs.TryGetValue(kv.Key, out b)) continue;
				if (string.Join(";", kv.Value) == string.Join(";", b)) ucAgree++;
				else
				{
					ucDiffer++;
					if (ucSamples.Count < 10) ucSamples.Add(kv.Key + "  A[" + string.Join(";", kv.Value) + "] B[" + string.Join(";", b) + "]");
				}
			}
			Console.WriteLine("  UC spans on matched readings: agree " + ucAgree + ", differ " + ucDiffer);
			foreach (string u in ucSamples) Console.WriteLine("      - " + u);
			nf.Dispose();
			Mark("end");
			return 0;
		}
	}
}
