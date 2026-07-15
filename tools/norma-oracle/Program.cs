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
			using (Transaction t = store.TransactionManager.BeginTransaction("seed"))
			{
				verifier.SeedObjectifications();
				t.Commit();
			}
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
			Console.WriteLine("== RMAP: relational result ==");
			Verifier.DumpRelational(store, assemblies[4], Console.Out);
			return 0;
		}
	}
}
