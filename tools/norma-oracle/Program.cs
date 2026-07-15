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

namespace Elysium.NormaOracle
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
			ModelingEventManager eventManager = ModelingEventManager.GetModelingEventManager(store);
			// Enter through NORMA's front door: deserialize a minimal seed
			// model so the load-time fixups run (intrinsic data types, bridge
			// initialization) exactly as they do for a real .orm file.
			string seed =
				"<ormRoot:ORM2 xmlns:ormRoot=\"http://schemas.neumont.edu/ORM/2006-04/ORMRoot\" xmlns:orm=\"http://schemas.neumont.edu/ORM/2006-04/ORMCore\">" +
				"<orm:ORMModel id=\"_" + Guid.NewGuid() + "\" Name=\"Elysium\"/>" +
				"</ormRoot:ORM2>";
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
				t.Commit();
			}
			foreach (IModelingEventSubscriber subscriber in Utility.EnumerateDomainModels<IModelingEventSubscriber>(store.DomainModels))
			{
				subscriber.ManageModelingEventHandlers(eventManager, EventSubscriberReasons.DocumentLoaded | EventSubscriberReasons.ModelStateEvents, EventHandlerAction.Add);
			}
			Console.WriteLine("store loaded: " + store.DomainModels.Count + " domain models");

			// 3. Parse the Elysium metamodel readings and build the ORM model.
			ORMModel model = store.ElementDirectory.FindElements<ORMModel>(false).First();
			Console.WriteLine("seed model: " + model.Name + ", intrinsic data types: " + model.DataTypeCollection.Count);

			// ORACLE_RING_PROBE=1: instead of mapping the metamodel, build the
			// minimal NORMA-only scenario — one entity type, one ring m:n fact
			// (spanning UC), one unary fact — and dump the resulting model
			// errors. Documents which errors NORMA produces BY CONSTRUCTION
			// (implied-objectification link readings on rings), so the main
			// report can classify them as expected rather than blocking.
			if (Environment.GetEnvironmentVariable("ORACLE_RING_PROBE") == "1")
			{
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
					t.Commit();
				}
				Console.WriteLine();
				Console.WriteLine("== RING PROBE: NORMA errors for {ring m:n fact, unary fact} alone ==");
				Verifier.DumpErrors(store, Console.Out);
				return 0;
			}

			string metamodelDir = args.Length > 0 ? args[0] : System.IO.Path.Combine("..", "..", "metamodel");
			string[] files = System.IO.Directory.GetFiles(metamodelDir, "*.md");
			Array.Sort(files, (x, y) => string.CompareOrdinal(
				System.IO.Path.GetFileName(x) == "core.md" ? "0" : System.IO.Path.GetFileName(x),
				System.IO.Path.GetFileName(y) == "core.md" ? "0" : System.IO.Path.GetFileName(y)));
			var fileSentences = new Dictionary<string, List<string>>();
			foreach (string f in files)
			{
				fileSentences[f] = Verifier.ExtractSentences(System.IO.File.ReadAllText(f));
			}

			Verifier verifier = new Verifier(store, model);
			using (Transaction t = store.TransactionManager.BeginTransaction("declarations"))
			{
				foreach (string f in files)
				{
					verifier.DeclarePass(fileSentences[f]);
				}
				t.Commit();
			}
			foreach (string f in files)
			{
				verifier.ResetContext();
				using (Transaction t = store.TransactionManager.BeginTransaction("map " + System.IO.Path.GetFileName(f)))
				{
					verifier.MapPass(fileSentences[f]);
					t.Commit();
				}
				Console.WriteLine("mapped: " + System.IO.Path.GetFileName(f) + " (" + fileSentences[f].Count + " sentences)");
			}

			using (Transaction t = store.TransactionManager.BeginTransaction("deferred constraints"))
			{
				verifier.ReplayDeferred();
				t.Commit();
			}
			using (Transaction t = store.TransactionManager.BeginTransaction("textual constraints"))
			{
				verifier.BuildTextualConstraints();
				t.Commit();
			}
			using (Transaction t = store.TransactionManager.BeginTransaction("instance facts"))
			{
				verifier.AttributeInstanceFacts();
				t.Commit();
			}
			List<string> assumed;
			using (Transaction t = store.TransactionManager.BeginTransaction("set semantics"))
			{
				assumed = verifier.AssumeSetSemantics();
				t.Commit();
			}

			Console.WriteLine();
			Console.WriteLine("== FINDING: fact types with no declared uniqueness (spanning UC assumed per Def 3 set semantics) ==");
			foreach (string a in assumed) Console.WriteLine("  " + a);
			Console.WriteLine("  TOTAL ASSUMED: " + assumed.Count);

			Console.WriteLine();
			Console.WriteLine("== sentence census ==");
			foreach (var kv in verifier.Census)
			{
				Console.WriteLine("  {0,4}  {1}", kv.Value, kv.Key);
			}
			Console.WriteLine();
			Console.WriteLine("== unrecognized sentences ==");
			int shown = 0;
			foreach (string u in verifier.Unrecognized)
			{
				Console.WriteLine("  " + u);
				if (++shown >= 40) { Console.WriteLine("  ..."); break; }
			}
			if (shown == 0) Console.WriteLine("  (none)");
			Console.WriteLine();
			Console.WriteLine("== harness map log ==");
			foreach (string line in verifier.MapLog) Console.WriteLine("  " + line);
			Console.WriteLine();
			Console.WriteLine("== NORMA model errors ==");
			Verifier.DumpErrors(store, Console.Out);
			Console.WriteLine();
			Console.WriteLine("== value-type data types ==");
			verifier.DumpDataTypes(Console.Out);

			Console.WriteLine();
			Console.WriteLine("== RMAP: relational result ==");
			Verifier.DumpRelational(store, assemblies[4], Console.Out);

			// cross-check inputs for the checker (tools/js-runner), in the
			// intersection dialect per the pure-math carrier ruling: the
			// design state the canon's defs consume, and NORMA's own RMAP
			// answer to confirm against.
			verifier.WriteDesignState("design-state");
			Verifier.WriteNormaAnswer(store, assemblies[4], "norma-answer", verifier.FullyDerivedNames());
			Console.WriteLine();
			Console.WriteLine("== checker inputs ==");
			Console.WriteLine("  written: design-state, norma-answer (intersection source)");

			// 5. Verbalization leg — NORMA's generate-only direction (the
			// automated verbalizer of Halpin & Curland 2006). The harness
			// parse leg carried sentences IN; this emits NORMA's own
			// verbalization of the built model OUT: the whitepaper's nf
			// round-trip demonstrated in both directions by the reference
			// implementation. HTML is NORMA's native output; a tag-stripped
			// text distillation is written alongside for reading and diffs.
			Console.WriteLine();
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
					line.Contains("_id") || line.Contains(" is involved in ") ||
					line.Contains(" involves ") ||
					line.Contains("“") || line.Contains("”"))
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
			ModelingEventManager eventManagerB = ModelingEventManager.GetModelingEventManager(storeB);
			using (Transaction t = storeB.TransactionManager.BeginTransaction("load"))
			{
				foreach (IModelingEventSubscriber subscriber in Utility.EnumerateDomainModels<IModelingEventSubscriber>(storeB.DomainModels))
				{
					subscriber.ManageModelingEventHandlers(eventManagerB, EventSubscriberReasons.DocumentLoading | EventSubscriberReasons.ModelStateEvents, EventHandlerAction.Add);
				}
				string seedB =
					"<ormRoot:ORM2 xmlns:ormRoot=\"http://schemas.neumont.edu/ORM/2006-04/ORMRoot\" xmlns:orm=\"http://schemas.neumont.edu/ORM/2006-04/ORMCore\">" +
					"<orm:ORMModel id=\"_" + Guid.NewGuid() + "\" Name=\"ElysiumNf\"/>" +
					"</ormRoot:ORM2>";
				using (System.IO.MemoryStream seedStream = new System.IO.MemoryStream(System.Text.Encoding.UTF8.GetBytes(seedB)))
				{
					(new ORMSerializationEngine(storeB)).Load(seedStream);
				}
				t.Commit();
			}
			ORMModel modelB = storeB.ElementDirectory.FindElements<ORMModel>(false).First();
			Verifier verifierB = new Verifier(storeB, modelB);
			var feedSentences = new List<string>();
			foreach (string line in feed)
			{
				feedSentences.AddRange(Verifier.ExtractSentences(line));
			}
			using (Transaction t = storeB.TransactionManager.BeginTransaction("nf declarations"))
			{
				verifierB.DeclarePass(feedSentences);
				t.Commit();
			}
			using (Transaction t = storeB.TransactionManager.BeginTransaction("nf map"))
			{
				verifierB.MapPass(feedSentences);
				t.Commit();
			}
			using (Transaction t = storeB.TransactionManager.BeginTransaction("nf deferred"))
			{
				verifierB.ReplayDeferred();
				verifierB.BuildTextualConstraints();
				verifierB.AttributeInstanceFacts();
				// Def 3: spanning UCs on n-ary m:n facts verbalize as the
				// possible-family (no restrictive sentence), so set semantics
				// is assumed on re-parse exactly as on first parse
				verifierB.AssumeSetSemantics();
				t.Commit();
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
			return 0;
		}
	}
}
