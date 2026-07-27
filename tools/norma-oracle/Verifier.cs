// The readings verifier: parse the FORML 2 declaration fragment out of the
// Elysium metamodel readings, build one ORM model through NORMA's public
// object model, and report (a) the sentence census, (b) NORMA's own model
// errors, (c) the live RMAP result (ConceptualDatabase tables).
//
// Scope note (honest oracle): NORMA verbalization is generate-only, so the
// translation from sentence to model element here is the harness's parse
// leg. What NORMA authoritatively supplies: model well-formedness rules,
// reference-mode machinery, constraint arity/compatibility validation, and
// the ORM -> OIAL -> DCIL relational mapping. Sentence kinds outside the
// declaration fragment (derivations, ring/set-comparison text forms,
// instance facts, SMD populations) are classified and counted, not mapped.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.Modeling;
using ORMSolutions.ORMArchitect.Core.ObjectModel;

namespace Elysium.NormaOracle
{
	internal sealed class Verifier
	{
		private readonly Store myStore;
		private readonly ORMModel myModel;
		private readonly Dictionary<string, ObjectType> myTypes = new Dictionary<string, ObjectType>(StringComparer.Ordinal);
		private readonly Dictionary<string, int> myCensus = new Dictionary<string, int>(StringComparer.Ordinal);
		private readonly List<string> myUnrecognized = new List<string>();
		private readonly List<string> myMapLog = new List<string>();
		private FactType myLastFact;
		private List<Role> myLastRoles;
		private List<string> myLastPlayers;
		private readonly List<FactIndexEntry> myFactIndex = new List<FactIndexEntry>();
		private readonly HashSet<FactType> myFullyDerived = new HashSet<FactType>();
		private readonly HashSet<FactType> mySemiDerived = new HashSet<FactType>();
		private readonly Dictionary<string, string> myMarkerBySentence = new Dictionary<string, string>(StringComparer.Ordinal);

		// derivation markers register per RAW line (declaration text -> mark),
		// decoupled from the sentence stream: a trailing ". *" before a
		// stripped header or a rule block was position-fragile in the orphan
		// path (markers vanished or misattributed by adjacency)
		public void RegisterMarkers(string markdown)
		{
			string noComments = Regex.Replace(markdown, "<!--.*?-->", " ", RegexOptions.Singleline);
			foreach (string rawLine in noComments.Split('\n'))
			{
				string line = rawLine.TrimEnd('\r').Trim();
				Match m = Regex.Match(line, @"^(.+?\.)\s*(\*\*|\*|\+)\s*$");
				if (!m.Success) continue;
				string sent = m.Groups[1].Value.TrimEnd('.').Trim();
				myMarkerBySentence[NormalizeWords(sent)] = m.Groups[2].Value;
			}
		}
		private readonly HashSet<FactType> myStoredDerived = new HashSet<FactType>();
		private readonly HashSet<string> mySubtypeDerived = new HashSet<string>(StringComparer.Ordinal);
		public HashSet<string> FullyDerivedNames()
		{
			var names = new HashSet<string>(StringComparer.Ordinal);
			foreach (FactType f in myFullyDerived)
			{
				if (!f.IsDeleted) names.Add(f.Name);
			}
			return names;
		}
		private sealed class FactIndexEntry
		{
			public FactType Fact;
			public List<Role> Roles;
			public List<string> Players;
			public string ReadingWords;
			public string ReadingText;
			public string FullKey; // normalized players-interleaved sentence
			public readonly List<List<string>> Rows = new List<List<string>>();
			public readonly List<List<string>> RowKinds = new List<List<string>>();
		}

		public Verifier(Store store, ORMModel model)
		{
			myStore = store;
			myModel = model;
		}

		private readonly List<KeyValuePair<string, ConstraintModality>> myDeferred = new List<KeyValuePair<string, ConstraintModality>>();

		public void DeferConstraint(string s, ConstraintModality modality)
		{
			myDeferred.Add(new KeyValuePair<string, ConstraintModality>(s, modality));
		}

		public void ReplayDeferred()
		{
			ResetContext();
			foreach (var kv in myDeferred)
			{
				try
				{
					if (MapConstraint(kv.Key, kv.Value))
					{
						Count("constraint mapped on deferred replay");
					}
					else
					{
						Count("alethic constraint (unmapped pattern)");
						myUnrecognized.Add("[constraint] " + Shorten(kv.Key));
					}
				}
				catch (Exception ex)
				{
					Count("harness-error");
					myMapLog.Add("ERROR replaying '" + Shorten(kv.Key) + "': " + ex.Message);
				}
			}
			myDeferred.Clear();
		}

		// AREST Def 3: populations are sets. Fact types whose readings carry no
		// uniqueness sentence get a spanning UC so RMAP can complete; each one
		// is REPORTED — the missing set-restriction sentence is a finding.
		public List<string> AssumeSetSemantics()
		{
			var assumed = new List<string>();
			foreach (FactIndexEntry entry in myFactIndex)
			{
				bool hasUC = false;
				foreach (var role in entry.Fact.RoleCollection)
				{
					Role r = role.Role;
					foreach (ConstraintRoleSequence seq in r.ConstraintRoleSequenceCollection)
					{
						if (seq.Constraint is UniquenessConstraint)
						{
							hasUC = true;
							break;
						}
					}
					if (hasUC) break;
				}
				if (!hasUC)
				{
					UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(entry.Fact);
					foreach (Role r in entry.Roles) uc.RoleCollection.Add(r);
					assumed.Add(entry.ReadingWords + "  [" + string.Join(", ", entry.Players) + "]");
				}
			}
			return assumed;
		}

		public void ResetContext()
		{
			myLastFact = null;
			myLastRoles = null;
			myLastPlayers = null;
		}

		public IEnumerable<string> Unrecognized { get { return myUnrecognized; } }
		public IEnumerable<KeyValuePair<string, int>> Census { get { return myCensus.OrderByDescending(kv => kv.Value); } }
		public IEnumerable<string> MapLog { get { return myMapLog; } }

		private void Count(string kind)
		{
			int n;
			myCensus.TryGetValue(kind, out n);
			myCensus[kind] = n + 1;
		}

		#region sentence extraction
		public static List<string> ExtractSentences(string markdown)
		{
			// strip comments, headers, code fences; join wrapped lines; split on '.'
			string noComments = Regex.Replace(markdown, "<!--.*?-->", " ", RegexOptions.Singleline);
			List<string> sentences = new List<string>();
			var sb = new System.Text.StringBuilder();
			foreach (string rawLine in noComments.Split('\n'))
			{
				string line = rawLine.TrimEnd('\r').Trim();
				if (line.Length == 0 || line.StartsWith("#") || line.StartsWith("```") || line.StartsWith("|"))
				{
					continue;
				}
				sb.Append(line).Append(' ');
			}
			string joined = sb.ToString();
			// split into sentences on '.' followed by space/end, but not inside quotes
			var current = new System.Text.StringBuilder();
			bool inQuote = false;
			for (int i = 0; i < joined.Length; i++)
			{
				char c = joined[i];
				if (c == '\'')
				{
					// word-boundary quotes only: an apostrophe with letters on
					// both sides is a possessive, not a quote toggle
					char prevC = i >= 1 ? joined[i - 1] : ' ';
					char nextC = i + 1 < joined.Length ? joined[i + 1] : ' ';
					if (!inQuote)
					{
						if (!char.IsLetterOrDigit(prevC)) inQuote = true;
					}
					else
					{
						if (!char.IsLetterOrDigit(nextC)) inQuote = false;
					}
				}
				current.Append(c);
				if (c == '.' && !inQuote)
				{
					char next = i + 1 < joined.Length ? joined[i + 1] : ' ';
					char prev = i >= 1 ? joined[i - 1] : ' ';
					// avoid splitting "X(.id)" reference modes and "10.3" style
					if ((next == ' ' || next == '\0') && prev != '(' && !char.IsDigit(next))
					{
						string s = current.ToString().Trim();
						if (s.Length > 1) sentences.Add(s);
						current.Clear();
					}
				}
			}
			string tail = current.ToString().Trim();
			if (tail.Length > 1) sentences.Add(tail);
			return sentences;
		}
		#endregion

		#region pass 1: type declarations
		private static readonly Regex EntityDecl = new Regex(@"^([\w :]+?)\s*\(\s*\.\s*([\w ]+)\s*\)\s+is an entity type\.$");
		// composite reference scheme (Halpin §7.3): X(.A, .B, ...) - the
		// components bind existing types (or mint value types, the single-
		// refmode precedent) through per-component fact types, and an
		// EXTERNAL uniqueness constraint spanning the far roles is the
		// preferred identifier
		private static readonly Regex EntityDeclComposite = new Regex(@"^([\w :]+?)\s*\(\s*\.\s*([\w ]+(?:\s*,\s*\.\s*[\w ]+)+)\s*\)\s+is an entity type\.$");
		// NORMA's own composite-identification verbalization, as written in
		// the wild: "This association with A, B provides the preferred
		// identification scheme for X."
		private static readonly Regex AssocScheme = new Regex(@"^This association with ([\w ,]+?) provides the preferred identification scheme for ([\w :]+?)\.$");
		private static readonly Regex EntityDeclBare = new Regex(@"^([\w :]+?)\s+is an entity type\.$");
		private static readonly Regex ValueDecl = new Regex(@"^([\w :]+?)\s+is a value type\.$");

		public void DeclarePass(IEnumerable<string> sentences)
		{
			foreach (string s in sentences)
			{
				try
				{
					DeclareSentence(s);
				}
				catch (Exception ex)
				{
					Count("harness-error (declare)");
					myMapLog.Add("ERROR declaring '" + Shorten(s) + "': " + ex.Message);
				}
			}
		}

		private void DeclareSentence(string s)
		{
			{
				Match m;
				if ((m = EntityDeclComposite.Match(s)).Success
					|| (m = AssocScheme.Match(s)).Success)
				{
					bool assocForm = s.StartsWith("This association");
					ObjectType t = EnsureType(
						(assocForm ? m.Groups[2] : m.Groups[1]).Value.Trim(), false);
					myDeclaredNames.Add(t.Name);
					var comps = new List<string>();
					foreach (string compRaw in (assocForm ? m.Groups[1] : m.Groups[2]).Value.Split(','))
					{
						comps.Add(compRaw.Trim().TrimStart('.').Trim());
					}
					// DEFERRED: schemes build only after every file's
					// declarations have landed - a component name minted
					// here could poison a type another file declares
					// (auth.md's .Customer before customer-auth.md's entity)
					myDeferredSchemes.Add(new DeferredScheme { Name = t.Name, Comps = comps, IndexPos = myFactIndex.Count });
					Count("entity-type declaration");
				}
				else if ((m = EntityDecl.Match(s)).Success)
				{
					ObjectType t = EnsureType(m.Groups[1].Value.Trim(), false);
					myDeclaredNames.Add(t.Name);
					string mode = m.Groups[2].Value.Trim();
					// DEFERRED like the composites: whether this mode names an
					// existing type is only knowable after every declaration
					myDeferredSchemes.Add(new DeferredScheme { Name = t.Name, Comps = new List<string> { mode }, IndexPos = myFactIndex.Count });
					Count("entity-type declaration");
				}
				else if ((m = EntityDeclBare.Match(s)).Success)
				{
					myDeclaredNames.Add(m.Groups[1].Value.Trim());
					EnsureType(m.Groups[1].Value.Trim(), false);
					Count("entity-type declaration");
				}
				else if ((m = ValueDecl.Match(s)).Success)
				{
					string vName = m.Groups[1].Value.Trim();
					myDeclaredNames.Add(vName);
					ObjectType vt = EnsureType(vName, true);
					if (!vt.IsValueType)
					{
						if (vt.ReferenceModeString.Length != 0 || vt.PreferredIdentifier != null)
						{
							Count("KIND CONFLICT: declared value type collides with entity type");
							myMapLog.Add("KIND CONFLICT: '" + vName + "' declared as a value type but already an identified entity type");
						}
						else
						{
							// the Resource-squat mechanism: flipping a
							// pre-existing entity to a value type can orphan a
							// subtype chain's identification - always say so
							myMapLog.Add("KIND FLIP: '" + vName + "' was an entity (by usage) and is now declared a value type - if the metamodel or another file meant the entity, this squat orphans its subtree");
							vt.IsValueType = true;
						}
					}
					EnsureDataType(vt, "text");
					Count("value-type declaration");
				}
			}
		}

		// names introduced by an explicit declaration sentence vs names
		// MINTED BY USAGE - role players invented silently, the
		// undeclared-type class the report names below (static: one
		// verifier run per process, and the static DumpErrors reads them)
		private static readonly HashSet<string> myDeclaredNames = new HashSet<string>(StringComparer.Ordinal);
		private static readonly HashSet<string> myMintedNames = new HashSet<string>(StringComparer.Ordinal);
		private static bool myMintedPrinted;

		// reference schemes queued during declaration, built only after
		// EVERY file's declarations have landed (cross-file ordering:
		// auth.md's .Customer component must not mint a value type that
		// poisons customer-auth.md's entity declaration)
		private sealed class DeferredScheme { public string Name; public List<string> Comps; public int IndexPos; }
		private readonly List<DeferredScheme> myDeferredSchemes = new List<DeferredScheme>();
		// scheme facts stay OUT of myFactIndex (the emitters' surface) until
		// a file explicitly restates them - then the restatement adopts the
		// fact at its own stream position, which is the old pipeline's
		// membership semantics exactly
		private readonly Dictionary<string, FactIndexEntry> mySchemeFacts = new Dictionary<string, FactIndexEntry>(StringComparer.OrdinalIgnoreCase);

		public void FlushSchemes()
		{
			// position-preserving: defer the BUILDING, not the ORDERING -
			// each scheme's facts insert where declaration would have put
			// them, so the carriers' fact order (and the canon-RMAP vs
			// norma:tables agreement the schema-match law certifies) is
			// unchanged by deferral
			int inserted = 0;
			foreach (var scheme in myDeferredSchemes)
			{
				int insertAt = scheme.IndexPos + inserted;
				try
				{
					ObjectType t = myTypes[scheme.Name];
					if (t.ReferenceModeString.Length != 0 || t.PreferredIdentifier != null) continue;
					if (scheme.Comps.Count == 1 && !myTypes.ContainsKey(scheme.Comps[0]))
					{
						// a fresh single mode: NORMA's own refmode machinery,
						// then index the minted fact so restatements adopt
						string mode = scheme.Comps[0];
						t.ReferenceModeString = mode;
						foreach (Role pr in t.PlayedRoleCollection)
						{
							FactType rft = pr.FactType;
							if (rft == null || rft.RoleCollection.Count != 2) continue;
							Role other = rft.RoleCollection[0].Role == pr ? rft.RoleCollection[1].Role : rft.RoleCollection[0].Role;
							if (other.RolePlayer == null || !string.Equals(other.RolePlayer.Name, mode, StringComparison.OrdinalIgnoreCase)) continue;
							mySchemeFacts[NormalizeWords(t.Name + " has " + other.RolePlayer.Name)] = new FactIndexEntry
							{
								Fact = rft,
								Roles = new List<Role> { pr, other },
								Players = new List<string> { t.Name, other.RolePlayer.Name },
								ReadingWords = "has",
								ReadingText = "{0} has {1}",
								FullKey = NormalizeWords(t.Name + " has " + other.RolePlayer.Name),
							};
							break;
						}
					}
					else
					{
						inserted += BuildCompositeScheme(t, scheme.Comps, insertAt);
					}
				}
				catch (Exception ex)
				{
					Count("harness-error (scheme)");
					myMapLog.Add("ERROR building scheme for '" + scheme.Name + "': " + ex.Message);
				}
			}
			myDeferredSchemes.Clear();
		}

		// one scheme builder for every identification form: composite
		// declarations, the association verbalization, and single refmodes
		// whose named type already exists (ReferenceModeString would mint a
		// twin). Per component: a binary with near-role mandatory + unique;
		// the far roles form the external preferred identifier.
		private int BuildCompositeScheme(ObjectType t, IEnumerable<string> comps, int insertAt)
		{
			int added = 0;
			var farRoles = new List<Role>();
			foreach (string comp in comps)
			{
				ObjectType compT;
				myTypes.TryGetValue(comp, out compT);
				if (compT == null)
				{
					// unbound component: mint a value type, the .slug precedent
					compT = EnsureType(comp, true);
					compT.IsValueType = true;
					EnsureDataType(compT, "text");
				}
				FactType ft = new FactType(myStore);
				Role near = new Role(myStore);
				Role far = new Role(myStore);
				ft.RoleCollection.Add(near);
				ft.RoleCollection.Add(far);
				near.RolePlayer = t;
				far.RolePlayer = compT;
				MandatoryConstraint.CreateSimpleMandatoryConstraint(near);
				UniquenessConstraint iuc = UniquenessConstraint.CreateInternalUniquenessConstraint(ft);
				iuc.RoleCollection.Add(near);
				var reading = new ReadingOrder(myStore);
				ft.ReadingOrderCollection.Add(reading);
				reading.RoleCollection.Add(near);
				reading.RoleCollection.Add(far);
				var r = new Reading(myStore);
				reading.ReadingCollection.Add(r);
				r.Text = "{0} has {1}";
				// index the scheme fact so an explicit restatement
				// ("X has Comp.") adopts it instead of minting a twin
				mySchemeFacts[NormalizeWords(t.Name + " has " + comp)] = new FactIndexEntry
				{
					Fact = ft,
					Roles = new List<Role> { near, far },
					Players = new List<string> { t.Name, comp },
					ReadingWords = "has",
					ReadingText = "{0} has {1}",
					FullKey = NormalizeWords(t.Name + " has " + comp),
				};
				farRoles.Add(far);
			}
			if (farRoles.Count == 1)
			{
				// one component = the plain refmode shape: an INTERNAL
				// uniqueness on the far role is the preferred identifier
				// (a one-role external constraint is TooFewRoleSequences)
				UniquenessConstraint fuc = UniquenessConstraint.CreateInternalUniquenessConstraint(farRoles[0].FactType);
				fuc.RoleCollection.Add(farRoles[0]);
				fuc.IsPreferred = true;
			}
			else
			{
				UniquenessConstraint euc = new UniquenessConstraint(myStore);
				euc.Model = myModel;
				foreach (Role fr in farRoles) euc.RoleCollection.Add(fr);
				euc.IsPreferred = true;
			}
			Count("composite reference scheme");
			return added;
		}

		private ObjectType EnsureType(string name, bool isValueType)
		{
			ObjectType t;
			if (!myTypes.TryGetValue(name, out t))
			{
				// adopt types NORMA already minted (reference-mode value types
				// appear in the model the moment an entity declares "(.Mode)")
				foreach (ObjectType existing in myModel.ObjectTypeCollection)
				{
					if (string.Equals(existing.Name, name, StringComparison.Ordinal))
					{
						t = existing;
						// NORMA-minted (refmode expansion) traces to a declaration
						myDeclaredNames.Add(name);
						break;
					}
				}
				if (t == null)
				{
					t = new ObjectType(myStore);
					t.Name = name;
					t.Model = myModel;
					if (isValueType)
					{
						t.IsValueType = true;
					}
					myMintedNames.Add(name);
				}
				myTypes[name] = t;
			}
			return t;
		}

		// "The data type of X is <token>." — the token map to NORMA's
		// intrinsic data types. Every metamodel value type carries one of
		// these sentences; the census reports any that do not.
		private static readonly Dictionary<string, Type> DataTypeTokens = new Dictionary<string, Type>(StringComparer.OrdinalIgnoreCase)
		{
			{ "text", typeof(VariableLengthTextDataType) },
			{ "integer", typeof(SignedIntegerNumericDataType) },
			{ "decimal", typeof(DecimalNumericDataType) },
			{ "float", typeof(DoublePrecisionFloatingPointNumericDataType) },
			{ "boolean", typeof(TrueOrFalseLogicalDataType) },
			{ "datetime", typeof(DateAndTimeTemporalDataType) },
			{ "date", typeof(DateTemporalDataType) },
			{ "time", typeof(TimeTemporalDataType) },
		};
		private readonly HashSet<string> myExplicitlyTyped = new HashSet<string>(StringComparer.Ordinal);

		private void ApplyDataType(string typeName, string token)
		{
			Type dtType;
			if (!DataTypeTokens.TryGetValue(token, out dtType))
			{
				Count("data-type token unknown");
				myMapLog.Add("UNKNOWN data-type token '" + token + "' for '" + typeName + "'");
				return;
			}
			ObjectType vt = EnsureType(typeName, true);
			foreach (DataType dt in myModel.DataTypeCollection)
			{
				if (dt.GetType() == dtType)
				{
					vt.DataType = dt;
					myExplicitlyTyped.Add(typeName);
					Count("data type applied (" + token.ToLowerInvariant() + ")");
					return;
				}
			}
			Count("data-type intrinsic instance missing");
			myMapLog.Add("no intrinsic instance for data-type token '" + token + "'");
		}

		public void DumpDataTypes(TextWriter w)
		{
			var census = new Dictionary<string, int>(StringComparer.Ordinal);
			var untyped = new List<string>();
			foreach (ObjectType ot in myModel.ObjectTypeCollection)
			{
				if (!ot.IsValueType || ot.IsImplicitBooleanValue) continue;
				// audit surface = readings-declared value types; NORMA's own
				// reference-mode mints (Function_id) are typed by its machinery
				if (!myTypes.ContainsKey(ot.Name)) continue;
				DataType dt = ot.DataType;
				string kind = dt == null ? "(null)" : dt.GetType().Name;
				int n;
				census.TryGetValue(kind, out n);
				census[kind] = n + 1;
				if (!myExplicitlyTyped.Contains(ot.Name))
				{
					untyped.Add(ot.Name);
				}
			}
			foreach (var kv in census.OrderByDescending(kv => kv.Value))
			{
				w.WriteLine("  {0,4}  {1}", kv.Value, kv.Key);
			}
			if (untyped.Count == 0)
			{
				w.WriteLine("  UNTYPED VALUE TYPES: (none — every value type carries an explicit data-type sentence)");
			}
			else
			{
				w.WriteLine("  UNTYPED VALUE TYPES: " + untyped.Count);
				foreach (string name in untyped.OrderBy(x => x, StringComparer.Ordinal))
				{
					w.WriteLine("      - " + name);
				}
			}
		}

		private void EnsureDataType(ObjectType valueType, string portableName)
		{
			// give every value type NORMA's variable-length text data type by
			// default; "The data type of X is Y" sentences refine it later.
			if (valueType.DataType == null || valueType.DataType is UnspecifiedDataType)
			{
				foreach (DataType dt in myModel.DataTypeCollection)
				{
					if (dt is VariableLengthTextDataType)
					{
						valueType.DataType = dt;
						break;
					}
				}
			}
		}
		#endregion

		#region pass 2: everything else
		public void MapPass(IEnumerable<string> sentences)
		{
			foreach (string s in sentences)
			{
				try
				{
					MapSentence(s);
				}
				catch (Exception ex)
				{
					Count("harness-error");
					myMapLog.Add("ERROR mapping '" + Shorten(s) + "': " + ex.Message);
				}
			}
		}

		private static string Shorten(string s)
		{
			return s.Length <= 90 ? s : s.Substring(0, 87) + "...";
		}

		private static readonly Regex SubtypeDecl = new Regex(@"^([\w :]+?)\s+is a subtype of\s+([\w :]+?)\.$");
		private static readonly Regex SupertypeDecl = new Regex(@"^([\w :]+?)\s+is a supertype of\s+([\w :]+?)\.$");
		private static readonly Regex ExclusiveSubtypes = new Regex(@"^\{(.+?)\}\s+are mutually exclusive subtypes of\s+([\w :]+?)\.$");
		private static readonly Regex PossibleValues = new Regex(@"^The possible values of\s+([\w :]+?)\s+are\s+(.+)\.$");
		private static readonly Regex DataTypeDecl = new Regex(@"^The data type of\s+([\w :]+?)\s+is\s+(\w+)");

		private void MapSentence(string s)
		{
			// fully derived rules verbalize with "iff" (the CWA closure over
			// all rules of the head); semi-derived rules state sufficient
			// conditions with a bare "if" — both are derivations to defer
			if (s.Contains(" iff ") || (s.StartsWith("* ") && Regex.IsMatch(s, @"\bif\b")))
			{
				myDeferredRules.Add(s);
				Count("derivation rule (deferred: no textual rule input in NORMA)");
				return;
			}
			// derived subtype (Halpin Fig 13.29 form): "* Each Entity Type is an
			// Object Type that is of OT Kind 'entity'." — map the subtype edge,
			// defer the defining rule like any derivation
			{
				Match dm = Regex.Match(s, @"^\* Each ([\w ]+?) is an? ([\w ]+?) that\b");
				if (dm.Success)
				{
					MapSubtype(dm.Groups[1].Value.Trim(), dm.Groups[2].Value.Trim());
					mySubtypeDerived.Add(dm.Groups[1].Value.Trim());
					Count("derived subtype (edge mapped; rule deferred)");
					return;
				}
			}
			// derivation-mode markers (* / ** / +) trailing a reading start the
			// next split sentence; strip them before dispatch. A leading '*'
			// that is NOT a derivation-rule sentence (no if/iff connective)
			// marks the fact just mapped as FULLY DERIVED — Codd 1970 1.5:
			// a stored derivable relation is strong redundancy, so fully
			// derived fact types leave the stored schema (both emitters).
			Match mkDerived = System.Text.RegularExpressions.Regex.Match(s, @"^([*+?]+)\s+");
			if (mkDerived.Success)
			{
				s = s.Substring(mkDerived.Length);
				// '*' = fully derived, not stored (leaves the stored schema);
				// '**' = fully derived, STORED — the consequent is a real
				// cell the runtime reads (NORMA: DerivationStorage=Stored),
				// so it STAYS in the stored schema on both surfaces; '+' = semi
				if (mkDerived.Groups[1].Value == "*" && myLastFact != null &&
					!System.Text.RegularExpressions.Regex.IsMatch(s, @"\biff?\b"))
				{
					myFullyDerived.Add(myLastFact);
				}
				if (mkDerived.Groups[1].Value == "**" && myLastFact != null &&
					!System.Text.RegularExpressions.Regex.IsMatch(s, @"\biff?\b"))
				{
					myStoredDerived.Add(myLastFact);
				}
				if (mkDerived.Groups[1].Value == "+" && myLastFact != null &&
					!System.Text.RegularExpressions.Regex.IsMatch(s, @"\biff?\b"))
				{
					mySemiDerived.Add(myLastFact);
				}
			}
			if (s.Contains(" or some ") || s.Contains(" or that ") || s.Contains(" or is "))
			{
				myTextual.Add(new KeyValuePair<string, string>("disjunctive", s));
				return;
			}
			Match m;
			if (EntityDecl.IsMatch(s) || EntityDeclBare.IsMatch(s) || ValueDecl.IsMatch(s))
			{
				return; // pass 1 handled
			}
			if ((m = SubtypeDecl.Match(s)).Success)
			{
				MapSubtype(m.Groups[1].Value.Trim(), m.Groups[2].Value.Trim());
				return;
			}
			if ((m = SupertypeDecl.Match(s)).Success)
			{
				MapSubtype(m.Groups[2].Value.Trim(), m.Groups[1].Value.Trim());
				return;
			}
			if ((m = ExclusiveSubtypes.Match(s)).Success)
			{
				string parent = m.Groups[2].Value.Trim();
				foreach (string part in m.Groups[1].Value.Split(','))
				{
					string child = part.Trim();
					if (child.Length != 0) MapSubtype(child, parent);
				}
				myTextual.Add(new KeyValuePair<string, string>("subtype-exclusion", s));
				Count("subtype exclusivity (subtypes mapped)");
				return;
			}
			if ((m = PossibleValues.Match(s)).Success)
			{
				MapValueEnum(m.Groups[1].Value.Trim(), m.Groups[2].Value);
				return;
			}
			if ((m = DataTypeDecl.Match(s)).Success)
			{
				ApplyDataType(m.Groups[1].Value.Trim(), m.Groups[2].Value.Trim());
				return;
			}
			if (s.StartsWith("* "))
			{
				myDeferredRules.Add(s);
				Count("derivation rule (deferred: no textual rule input in NORMA)");
				return;
			}
			if (s.StartsWith("Each ") || s.StartsWith("For each ") || s.StartsWith("In each population"))
			{
				if (MapConstraint(s, ConstraintModality.Alethic)) return;
				DeferConstraint(s, ConstraintModality.Alethic);
				return;
			}
			if (s.StartsWith("It is obligatory that ") || s.StartsWith("It is forbidden that ") || s.StartsWith("It is permitted that "))
			{
				// only OBLIGATORY bodies share the positive constraint shapes;
				// a forbidden/permitted body run through the same mapper would
				// invert its meaning (deontic UC/MC assert the pattern holds).
				// Constraints may be deontic (the modality came FROM NORMA's
				// interface): an obligatory body in a canonical constraint
				// shape builds as the real constraint with Modality=Deontic;
				// only genuinely qualified prose stays a note.
				if (s.StartsWith("It is obligatory that "))
				{
					string body = s.Substring(s.IndexOf("that ") + 5);
					if (body.StartsWith("each ") || body.StartsWith("Each "))
					{
						if (MapConstraint("Each " + body.Substring(5), ConstraintModality.Deontic)) return;
					}
					if (body.StartsWith("for each ") || body.StartsWith("For each "))
					{
						if (MapConstraint("For each " + body.Substring(9), ConstraintModality.Deontic)) return;
					}
				}
				myTextual.Add(new KeyValuePair<string, string>("deontic", s));
				return;
			}
			if (s.StartsWith("It is possible that "))
			{
				Count("default-form reading (no constraint)");
				return;
			}
			if (s.StartsWith("It is impossible that "))
			{
				myTextual.Add(new KeyValuePair<string, string>("impossibility", s));
				return;
			}
			if (s.StartsWith("If ") || s.StartsWith("No "))
			{
				myTextual.Add(new KeyValuePair<string, string>("conditional", s));
				return;
			}
			{
				// objectification, NORMA's own verbalized form: X objectifies
				// "reading". No preferred-identification claim — identity is
				// the one id space (the subtype declaration that follows;
				// MapSubtype demotes the auto-assigned objectification UC).
				// The quoted reading resolves the fact by FullKey so the
				// sentence parses in entity context too (the nf B side sees
				// it beside the entity type, not under the fact).
				Match om = Regex.Match(s, "^([\\w :]+) objectifies [\"“](.+)[\"”]\\.$");
				if (om.Success)
				{
					string wanted = NormalizeWords(om.Groups[2].Value);
					FactType target = null;
					foreach (FactIndexEntry entry in myFactIndex)
					{
						if (entry.FullKey == wanted) { target = entry.Fact; break; }
					}
					if (target != null)
					{
						FactType saveLast = myLastFact;
						myLastFact = target;
						bool ok = ObjectifySpanning(om.Groups[1].Value.Trim(), s);
						myLastFact = saveLast;
						if (ok) return;
					}
					Count("objectification (unresolved reading, deferred)");
					return;
				}
			}
			if (s.StartsWith("This association with "))
			{
				// legacy FORML objectification-with-preferred-id form —
				// retired from the source (2026-07-16 one-table wave); kept
				// only to refuse loudly if it reappears.
				Count("RETIRED FORM: association-provides-identification");
				myMapLog.Add("RETIRED FORM (use: X objectifies \"reading\"): " + Shorten(s));
				return;
			}
			if (Regex.IsMatch(s, @"'[^']*'"))
			{
				// instance facts attribute AFTER every file's readings exist —
				// csdp.md's SM rows precede state.md's SM readings in file order
				myInstanceSentences.Add(s);
				return;
			}
			// candidate fact-type reading
			if (MapFactReading(s))
			{
				return;
			}
			Count("unrecognized");
			myUnrecognized.Add(Shorten(s));
		}

		private bool ObjectifySpanning(string nestingName, string sentence)
		{
			// Halpin, "Objectification and Atomicity" (2020-04-28):
			// objectification is legal only over a UC spanning all roles
			// (unaries pass — the single role is spanning). NORMA as shipped
			// still implements the ORM 2 any-fact-type relaxation, so the
			// oracle enforces the rule here, per validation.md's
			// Objectification Spanning deontic.
			int roleCount = myLastFact.RoleCollection.Count;
			bool spanning = false;
			foreach (UniquenessConstraint uc in InternalUCs(myLastFact))
			{
				if (uc.RoleCollection.Count == roleCount)
				{
					spanning = true;
					break;
				}
			}
			if (!spanning)
			{
				Count("OBJECTIFICATION REFUSED (no spanning UC; Halpin 2020)");
				myMapLog.Add("OBJECTIFICATION REFUSED (Halpin 2020, no spanning UC): " + Shorten(sentence));
				return true;
			}
			ObjectType nesting = EnsureType(nestingName, false);
			myDeclaredNames.Add(nesting.Name);
			if (nesting.NestedFactType == null)
			{
				nesting.NestedFactType = myLastFact;
			}
			Count("objectification (nested fact type)");
			return true;
		}

		private void MapSubtype(string subName, string superName)
		{
			ObjectType sub = EnsureType(subName, false);
			myDeclaredNames.Add(subName); // 'X is a subtype of Y' declares X
			ObjectType super = EnsureType(superName, false);
			foreach (ObjectType existing in sub.SupertypeCollection)
			{
				if (existing == super) { Count("subtype declaration"); return; }
			}
			if (sub.IsValueType != super.IsValueType)
			{
				// name the offender before NORMA's commit rule throws blind:
				// mixed entity/value subtyping is a MODEL error, and the model
				// author needs the pair, not a stack trace
				throw new InvalidOperationException(
					"mixed subtype: '" + subName + "' ("
					+ (sub.IsValueType ? "value" : "entity") + ") is a subtype of '"
					+ superName + "' (" + (super.IsValueType ? "value" : "entity")
					+ ") - both sides must be the same kind; declare the missing "
					+ "entity/value type explicitly");
			}
			SubtypeFact subtypeFact = SubtypeFact.Create(sub, super);
			// Halpin §6.7: "By default, a subtype inherits the primary
			// reference scheme of the root supertype." SubtypeFact.Create
			// wires ProvidesPreferredIdentifier only for value types; an
			// entity subtype with no local reference scheme takes its
			// preferred identification through its first supertype path.
			if (!sub.IsValueType && sub.ResolvedPreferredIdentifier == null)
			{
				subtypeFact.ProvidesPreferredIdentifier = true;
				Count("subtype provides preferred identification (Halpin 6.7)");
			}
			else if (!sub.IsValueType && sub.NestedFactType != null && RootsAtFunction(super))
			{
				// one-table rule (model-driven; fires only when the readings
				// declare an OBJECTIFIED entity a Function subtype): identity
				// moves from the association to the one id space — Def 9, one
				// id space in D — and the objectifying spanning UC remains as
				// a plain uniqueness over the absorbed role columns, so the
				// pairhood constraint survives while the concept assimilates
				// into Function instead of standing as its own table.
				UniquenessConstraint pid = sub.ResolvedPreferredIdentifier as UniquenessConstraint;
				if (pid != null)
				{
					pid.PreferredIdentifierFor = null;
				}
				subtypeFact.ProvidesPreferredIdentifier = true;
				Count("objectified subtype takes Function identity (one-table rule)");
			}
			Count("subtype declaration");
		}

		private bool RootsAtFunction(ObjectType t)
		{
			if (t == null) return false;
			if (t.Name == "Function") return true;
			foreach (ObjectType sup in t.SupertypeCollection)
			{
				if (RootsAtFunction(sup)) return true;
			}
			return false;
		}

		private void MapValueEnum(string typeName, string valueList)
		{
			ObjectType vt = EnsureType(typeName, true);
			EnsureDataType(vt, "text");
			ValueTypeValueConstraint constraint = vt.ValueConstraint;
			if (constraint == null)
			{
				constraint = new ValueTypeValueConstraint(myStore);
				constraint.ValueType = vt;
			}
			foreach (Match vm in Regex.Matches(valueList, @"'([^']*)'"))
			{
				// idempotent (the tab doctrine): a value already in the
				// constraint is the same declaration restated, not an overlap
				bool present = false;
				foreach (ValueRange existing in constraint.ValueRangeCollection)
				{
					if (existing.MinValue == vm.Groups[1].Value) { present = true; break; }
				}
				if (present) continue;
				ValueRange range = new ValueRange(myStore);
				range.MinValue = vm.Groups[1].Value;
				range.MaxValue = vm.Groups[1].Value;
				range.ValueConstraint = constraint;
			}
			Count("value enumeration");
		}

		// instance-fact verbalizations (exec ruling 2): populations enter
		// through the same channel as everything else — sentences. The
		// tokenizer splits on quoted literals; each preceding text segment
		// either ends in a declared type name (an entity reference) or the
		// literal is a value for a value-type role; the remaining words are
		// the predicate, matched against the fact index.
		private readonly List<string> myInstanceSentences = new List<string>();

		public void AttributeInstanceFacts()
		{
			foreach (string s in myInstanceSentences)
			{
				try
				{
					if (MapInstanceFact(s))
					{
						continue;
					}
					Count("instance fact (no matching fact type)");
					myUnrecognized.Add("[instance] " + Shorten(s));
				}
				catch (Exception ex)
				{
					Count("harness-error (instance)");
					myMapLog.Add("ERROR attributing '" + Shorten(s) + "': " + ex.Message);
				}
			}
			myInstanceSentences.Clear();
		}

		// a kind satisfies a role player if it IS the player or is a subtype
		// of it (population inclusion — HTTP Method rows populate Predicate
		// fact types)
		private bool KindSatisfies(string kind, string player)
		{
			if (string.Equals(kind, player, StringComparison.Ordinal)) return true;
			ObjectType t;
			if (!myTypes.TryGetValue(kind, out t)) return false;
			var seen = new HashSet<ObjectType>();
			while (t != null && seen.Add(t))
			{
				ObjectType super = null;
				foreach (ObjectType sup in t.SupertypeCollection) { super = sup; break; }
				if (super == null) return false;
				if (string.Equals(super.Name, player, StringComparison.Ordinal)) return true;
				t = super;
			}
			return false;
		}

		private bool MapInstanceFact(string s)
		{
			string body = s.TrimEnd('.').Trim();
			var quotes = new List<string>();
			var texts = new List<string>();
			int cursor = 0;
			foreach (Match qm in Regex.Matches(body, @"'([^']*)'"))
			{
				texts.Add(body.Substring(cursor, qm.Index - cursor));
				quotes.Add(qm.Groups[1].Value);
				cursor = qm.Index + qm.Length;
			}
			texts.Add(body.Substring(cursor));
			if (quotes.Count == 0) return false;

			var kinds = new List<string>();      // per quote: entity kind or null (value literal)
			var wordParts = new List<string>();
			for (int i = 0; i < quotes.Count; i++)
			{
				string t = texts[i].Trim();
				string kind = null;
				foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
				{
					if (t == name || t.EndsWith(" " + name, StringComparison.Ordinal))
					{
						kind = name;
						t = t.Substring(0, t.Length - name.Length).Trim();
						break;
					}
				}
				kinds.Add(kind);
				if (t.Length > 0) wordParts.Add(t);
			}
			string tail = texts[texts.Count - 1].Trim();
			if (tail.Length > 0) wordParts.Add(tail);
			string words = Regex.Replace(string.Join(" ", wordParts), @"\s+", " ").Trim();

			FactIndexEntry match = null;
			int candidates = 0;
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Players.Count != quotes.Count) continue;
				bool ok = true;
				for (int i = 0; i < quotes.Count && ok; i++)
				{
					if (kinds[i] != null)
					{
						ok = KindSatisfies(kinds[i], entry.Players[i]);
					}
					else
					{
						ObjectType p;
						ok = myTypes.TryGetValue(entry.Players[i], out p) && p.IsValueType;
					}
				}
				if (!ok) continue;
				// hyphen-bound role qualifiers ("is from- Status") are
				// absorption naming, invisible in spoken instance facts
				string entryWords = entry.ReadingWords.Replace("- ", " ").TrimEnd('-');
				if (string.Equals(entryWords, words, StringComparison.Ordinal))
				{
					match = entry;
					candidates = 1;
					break;
				}
				candidates++;
				if (match == null) match = entry;
			}
			if (match == null || candidates != 1)
			{
				return false;
			}
			match.Rows.Add(new List<string>(quotes));
			match.RowKinds.Add(new List<string>(kinds.Select(k => k ?? "")));
			Count("instance fact (row attributed)");
			return true;
		}

		// nf round-trip surfaces: normalized reading signatures and UC spans,
		// comparable across two independently parsed models
		public static string NormalizeWords(string words)
		{
			return Regex.Replace(words.Replace("- ", " ").TrimEnd('-'), @"\s+", " ").Trim().ToLowerInvariant();
		}

		public List<string> ReadingKeys()
		{
			var keys = new List<string>();
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Fact.IsDeleted) continue;
				keys.Add(string.Join("|", entry.Players) + " :: " + NormalizeWords(entry.ReadingWords));
			}
			return keys;
		}

		public Dictionary<string, List<string>> UcSignatures()
		{
			var result = new Dictionary<string, List<string>>(StringComparer.Ordinal);
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Fact.IsDeleted) continue;
				string key = string.Join("|", entry.Players) + " :: " + NormalizeWords(entry.ReadingWords);
				var spans = new List<string>();
				foreach (UniquenessConstraint uc in InternalUCs(entry.Fact))
				{
					var positions = new List<int>();
					bool complete = true;
					foreach (Role r in uc.RoleCollection)
					{
						int at = entry.Roles.IndexOf(r);
						if (at < 0) { complete = false; break; }
						positions.Add(at + 1);
					}
					if (complete) { positions.Sort(); spans.Add(string.Join(",", positions)); }
				}
				spans.Sort(StringComparer.Ordinal);
				result[key] = spans;
			}
			return result;
		}

		public List<string> SubtypeEdges()
		{
			var edges = new List<string>();
			foreach (SubtypeFact sf in myStore.ElementDirectory.FindElements<SubtypeFact>(true))
			{
				if (sf.IsDeleted || sf.Subtype == null || sf.Supertype == null) continue;
				edges.Add(sf.Subtype.Name + " < " + sf.Supertype.Name);
			}
			return edges;
		}

		public bool HasType(string name)
		{
			return myTypes.ContainsKey(name);
		}

		public IEnumerable<KeyValuePair<string, int>> PopulationCensus()
		{
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Rows.Count > 0)
				{
					yield return new KeyValuePair<string, int>(entry.Fact.Name, entry.Rows.Count);
				}
			}
		}

		private bool MapFactReading(string s)
		{
			string body = s.TrimEnd('.');
			// find object-type occurrences by longest-name-first matching
			List<KeyValuePair<int, string>> hits = new List<KeyValuePair<int, string>>();
			string working = body;
			foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
			{
				int at = 0;
				while ((at = working.IndexOf(name, at, StringComparison.Ordinal)) >= 0)
				{
					bool leftOk = at == 0 || !char.IsLetterOrDigit(working[at - 1]);
					int end = at + name.Length;
					bool rightOk = end >= working.Length || !char.IsLetterOrDigit(working[end]);
					if (leftOk && rightOk)
					{
						hits.Add(new KeyValuePair<int, string>(at, name));
						working = working.Substring(0, at) + new string((char)1, name.Length) + working.Substring(end);
						at = end;
					}
					else
					{
						at = at + 1;
					}
				}
			}
			if (hits.Count == 0 || hits.Count > 5)
			{
				return false;
			}
			hits.Sort((a, b) => a.Key.CompareTo(b.Key));
			// build reading text with {n} placeholders
			var readingText = new System.Text.StringBuilder();
			int cursor = 0, slot = 0;
			var players = new List<string>();
			foreach (var hit in hits)
			{
				readingText.Append(body, cursor, hit.Key - cursor);
				readingText.Append('{').Append(slot++).Append('}');
				cursor = hit.Key + hit.Value.Length;
				players.Add(hit.Value);
			}
			readingText.Append(body, cursor, body.Length - cursor);
			string text = Regex.Replace(readingText.ToString(), @"\s+", " ").Trim();
			// unary needs a verb phrase; reject degenerate "{0}" readings
			if (Regex.Replace(text, @"\{\d\}", "").Trim().Length == 0)
			{
				return false;
			}
			// duplicate reading: the same text over the same players is the same
			// fact type — reuse it (fact types are IDEMPOTENT across files;
			// a domain is a tab, and one fact type may appear in many).
			// Case-insensitive to match NORMA's expanded-signature semantics:
			// the signature lowercases, so 'has URL' and 'has url' are twins.
			// a restatement of a scheme fact ADOPTS it into the index at the
			// restatement's own stream position (the old pipeline's membership:
			// scheme facts emit only when a file states them)
			{
				string schemeKey = null;
				if (players.Count == 2) schemeKey = NormalizeWords(players[0] + " " + Regex.Replace(text, @"\{\d\}", " ").Trim() + " " + players[1]);
				FactIndexEntry adopted;
				if (schemeKey != null && mySchemeFacts.TryGetValue(schemeKey, out adopted))
				{
					mySchemeFacts.Remove(schemeKey);
					myFactIndex.Add(adopted);
					myLastFact = adopted.Fact;
					myLastRoles = adopted.Roles;
					myLastPlayers = adopted.Players;
					Count("scheme fact adopted (restated)");
					return true;
				}
			}
			foreach (FactIndexEntry prior in myFactIndex)
			{
				if (string.Equals(prior.ReadingText, text, StringComparison.OrdinalIgnoreCase) &&
					prior.Players.SequenceEqual(players, StringComparer.OrdinalIgnoreCase))
				{
					myLastFact = prior.Fact;
					myLastRoles = prior.Roles;
					myLastPlayers = prior.Players;
					Count("duplicate reading (fact type reused)");
					return true;
				}
			}
			// prose guard: readings are short verb phrases; markdown/backticks,
			// slashes-of-prose, or > 60 chars of connective text mean a stray
			// documentation sentence, not a fact reading
			string connective = Regex.Replace(text, @"\{\d\}", "");
			if (text.IndexOf('`') >= 0 || text.IndexOf('(') >= 0 || connective.Length > 60)
			{
				Count("prose skipped (not a reading)");
				return false;
			}

			FactType fact = new FactType(myStore);
			fact.Model = myModel;
			var roles = new List<Role>();
			foreach (string player in players)
			{
				Role role = new Role(myStore);
				fact.RoleCollection.Add(role);
				role.RolePlayer = myTypes[player];
				roles.Add(role);
			}
			ReadingOrder order = new ReadingOrder(myStore);
			fact.ReadingOrderCollection.Add(order);
			foreach (Role role in roles)
			{
				order.RoleCollection.Add(role);
			}
			Reading reading = new Reading(myStore);
			order.ReadingCollection.Add(reading);
			reading.Text = text;

			myLastFact = fact;
			myLastRoles = roles;
			myLastPlayers = players;
			string full = text;
			for (int i = 0; i < players.Count; i++)
			{
				full = full.Replace("{" + i + "}", players[i]);
			}
			myFactIndex.Add(new FactIndexEntry
			{
				Fact = fact,
				Roles = roles,
				Players = players,
				ReadingWords = Regex.Replace(text, @"\{\d\}", " ").Trim(),
				ReadingText = text,
				FullKey = NormalizeWords(full),
			});
			// classify by the line-registered derivation marker (position-free)
			string mark;
			if (myMarkerBySentence.TryGetValue(NormalizeWords(full), out mark))
			{
				if (mark == "*") myFullyDerived.Add(fact);
				else if (mark == "**") myStoredDerived.Add(fact);
				else if (mark == "+") mySemiDerived.Add(fact);
			}
			Count("fact-type reading (arity " + players.Count + ")");
			return true;
		}

		private readonly List<KeyValuePair<string, string>> myTextual = new List<KeyValuePair<string, string>>();
		private readonly List<string> myRuleRecipes = new List<string>();
		private readonly List<string> myRingRows = new List<string>();
		private readonly List<string> myDeferredRules = new List<string>();

		private FactIndexEntry FindEntryByNormalizedSentence(string sentence)
		{
			string key = NormalizeWords(sentence);
			FactIndexEntry found = null;
			foreach (FactIndexEntry e in myFactIndex)
			{
				if (e.Fact.IsDeleted || e.FullKey != key) continue;
				if (found != null) return null;
				found = e;
			}
			return found;
		}

		// NORMA's inbuilt derivation mechanism: FactTypeDerivationRule owns a
		// LeadRolePath (the same role-path machinery the join-path constraints
		// use) plus a RoleSetDerivationProjection mapping each derived role to
		// a pathed role. The linear two-leg iff class builds natively:
		//   * <head> iff some <J> <leg1> and that <J> <leg2>.
		// (one join variable, two positive facts, every head player found in
		// exactly one leg). DerivationStorage=NotStored makes the Codd 1.5
		// exclusion NORMA-native: the bridge itself stops emitting the table.
		// Everything beyond the class — recursion (closures need a fixpoint),
		// multi-rule heads, negation, aggregation, chained multi-variable
		// bodies — exceeds a single role path; those rules stay deferred prose
		// here and EXECUTE in the canon's rules:metamodel under the C# runner,
		// which law:markers holds to closure (no marker without a deliverer).
		public List<string> BuildDerivationRules()
		{
			var log = new List<string>();
			// a fully-derived head is the CWA closure over ALL its rules; one
			// role path can hold one rule, so only single-rule heads build —
			// a multi-rule head built partially would be wrong, not partial
			var rulesPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			var linearPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			var generalPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			foreach (string sRaw0 in myDeferredRules)
			{
				string s = sRaw0;
				while (s.StartsWith("* * ")) s = s.Substring(2);
				Match hm = Regex.Match(s, @"^\* (.+?) iff ");
				if (!hm.Success) continue;
				string h = NormalizeWords(hm.Groups[1].Value.Trim());
				int n;
				rulesPerHead.TryGetValue(h, out n);
				rulesPerHead[h] = n + 1;
				// a multi-rule head may build IFF every one of its rules is
				// linear-class: the closure is the union of its lead role
				// paths, and a head split across classes would build
				// partially, which is wrong rather than partial
				if (Regex.IsMatch(s, @"^\* (.+?) iff some ([A-Z][\w ]*?) (.+) and that \2 (.+)\.$"))
				{
					linearPerHead.TryGetValue(h, out n);
					linearPerHead[h] = n + 1;
				}
				// the general two-leg class's shape: iff + exactly two clauses
				Match gm = Regex.Match(s, @"^\* (.+?) iff (.+)\.$");
				if (gm.Success && Regex.Split(gm.Groups[2].Value.Trim(), @" and (?=that |some )").Length == 2)
				{
					generalPerHead.TryGetValue(h, out n);
					generalPerHead[h] = n + 1;
				}
			}
			foreach (string s in myDeferredRules)
			{
				Match m = Regex.Match(s, @"^\* (.+?) iff some ([A-Z][\w ]*?) (.+) and that \2 (.+)\.$");
				if (!m.Success) continue;
				string head = m.Groups[1].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(NormalizeWords(head), out headRules);
				int linearRules;
				linearPerHead.TryGetValue(NormalizeWords(head), out linearRules);
				if (headRules != 1 && linearRules != headRules) continue;
				string j = m.Groups[2].Value.Trim();
				if (!myTypes.ContainsKey(j)) continue;
				string leg1 = Dequantify(j + " " + m.Groups[3].Value.Trim());
				string leg2 = Dequantify(j + " " + m.Groups[4].Value.Trim());
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				FactIndexEntry e1 = FindEntryByNormalizedSentence(leg1);
				FactIndexEntry e2 = FindEntryByNormalizedSentence(leg2);
				if (headE == null || e1 == null || e2 == null || headE == e1 || headE == e2) continue;
				if (headE.Fact.DerivationRule != null && headRules == 1) continue;
				int j1 = e1.Players.IndexOf(j), j2 = e2.Players.IndexOf(j);
				if (j1 < 0 || j2 < 0 || e1.Players.LastIndexOf(j) != j1 || e2.Players.LastIndexOf(j) != j2) continue;
				// each head player must be found at exactly one non-join leg position
				var located = new List<KeyValuePair<FactIndexEntry, int>>();
				bool ok = true;
				for (int i = 0; i < headE.Players.Count && ok; i++)
				{
					string p = headE.Players[i];
					var hits = new List<KeyValuePair<FactIndexEntry, int>>();
					for (int c = 0; c < e1.Players.Count; c++)
						if (c != j1 && e1.Players[c] == p) hits.Add(new KeyValuePair<FactIndexEntry, int>(e1, c));
					for (int c = 0; c < e2.Players.Count; c++)
						if (c != j2 && e2.Players[c] == p) hits.Add(new KeyValuePair<FactIndexEntry, int>(e2, c));
					if (hits.Count != 1) { ok = false; break; }
					located.Add(hits[0]);
				}
				if (!ok) continue;
				// get-or-create: a multi-rule head holds ONE derivation rule
				// whose closure is the union of one lead role path per rule
				var rule = headE.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule == null)
				{
					rule = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(headE.Fact, rule);
					ApplyDerivationMarkers(headE.Fact, rule);
				}
				var lead = new LeadRolePath(myStore);
				rule.OwnedLeadRolePathCollection.Add(lead);
				new RolePathObjectTypeRoot(lead, myTypes[j]);
				var steps = new PathedRole[headE.Roles.Count];
				foreach (var legPair in new[] { new KeyValuePair<FactIndexEntry, int>(e1, j1), new KeyValuePair<FactIndexEntry, int>(e2, j2) })
				{
					var sub = new RoleSubPath(myStore);
					lead.SubPathCollection.Add(sub);
					var entry = new PathedRole(sub, legPair.Key.Roles[legPair.Value]);
					entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					for (int i = 0; i < located.Count; i++)
					{
						if (located[i].Key != legPair.Key) continue;
						var step = new PathedRole(sub, legPair.Key.Roles[located[i].Value]);
						step.PathedRolePurpose = PathedRolePurpose.SameFactType;
						steps[i] = step;
					}
				}
				var proj = new RoleSetDerivationProjection(rule, lead);
				for (int i = 0; i < headE.Roles.Count; i++)
				{
					if (steps[i] == null) { ok = false; break; }
					var drp = new DerivedRoleProjection(proj, headE.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp, steps[i]);
				}
				if (!ok) continue;
				log.Add(headE.Fact.Name + " := join over " + j + " (" + e1.Fact.Name + " x " + e2.Fact.Name + "), " + DescribeDerivation(headE.Fact));
				RecordRuleRecipe(headE, e1, e2, j1, j2, located);
			}
			// the value-condition class: a UNARY head whose legs all anchor
			// at the head's own player — existence legs enter a fact and
			// stop; a quoted-constant leg adds a boolean path condition
			// (Equals over the step and a PathConstant). The ** head stores
			// its consequent, so DerivationStorage follows the marker.
			Function eqFn = null;
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && fn.IsBoolean && fn.Name == "Equals") { eqFn = fn; break; }
			}
			foreach (string s in myDeferredRules)
			{
				Match m = Regex.Match(s, @"^\* (.+?) iff (.+)\.$");
				if (!m.Success) continue;
				string head = m.Groups[1].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(NormalizeWords(head), out headRules);
				if (headRules != 1) continue;
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				if (headE == null || headE.Fact.DerivationRule != null || headE.Players.Count != 1) continue;
				string rootVar = headE.Players[0];
				ObjectType rootT;
				if (!myTypes.TryGetValue(rootVar, out rootT)) continue;
				var condLegs = new List<KeyValuePair<FactIndexEntry, KeyValuePair<int, string>>>();
				bool ok = true;
				foreach (string lt in m.Groups[2].Value.Split(new[] { " and " }, StringSplitOptions.None))
				{
					string t = lt.Trim();
					if (!t.StartsWith(rootVar + " ", StringComparison.Ordinal)) { ok = false; break; }
					string constVal = null;
					Match qm = Regex.Match(t, @"^(.*) '([^']*)'$");
					if (qm.Success) { t = qm.Groups[1].Value.Trim(); constVal = qm.Groups[2].Value; }
					List<string> lp;
					FactIndexEntry le2 = ResolveClause(Dequantify(" " + t + " ").Trim(), out lp);
					if (le2 == null || le2.Players.Count != 2 ||
						le2.Players.IndexOf(rootVar) < 0 ||
						le2.Players.LastIndexOf(rootVar) != le2.Players.IndexOf(rootVar)) { ok = false; break; }
					int rootAt = le2.Players.IndexOf(rootVar);
					condLegs.Add(new KeyValuePair<FactIndexEntry, KeyValuePair<int, string>>(le2,
						new KeyValuePair<int, string>(rootAt, constVal)));
				}
				if (!ok || condLegs.Count < 1) continue;
				if (condLegs.Exists(l => l.Value.Value != null) && eqFn == null)
				{
					eqFn = new Function(myStore);
					eqFn.Name = "Equals";
					eqFn.IsBoolean = true;
					eqFn.Model = myModel;
					var pa2 = new FunctionParameter(myStore); pa2.Function = eqFn; pa2.Name = "left";
					var pb2 = new FunctionParameter(myStore); pb2.Function = eqFn; pb2.Name = "right";
				}
				var vrule = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(headE.Fact, vrule);
				ApplyDerivationMarkers(headE.Fact, vrule);
				if (myStoredDerived.Contains(headE.Fact))
				{
					// LeadRolePathAddedRule (RolePath.cs:6143-6152) clears
					// ExternalDerivation on any path add at commit, and only
					// External+Stored escapes GATE:188 - so a stored (**)
					// fact keeps NO in-store body. Its executable recipe is
					// parse-side (state:rules/canon); the store carries the
					// marker triple only.
					log.Add(headE.Fact.Name + " := conjunction head, " + DescribeDerivation(headE.Fact) + " (body external to store)");
					continue;
				}
				var vlead = new LeadRolePath(myStore);
				vrule.OwnedLeadRolePathCollection.Add(vlead);
				var vroot = new RolePathObjectTypeRoot(vlead, rootT);
				foreach (var leg in condLegs)
				{
					var sub = new RoleSubPath(myStore);
					vlead.SubPathCollection.Add(sub);
					var entry = new PathedRole(sub, leg.Key.Roles[leg.Value.Key]);
					entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					var step = new PathedRole(sub, leg.Key.Roles[1 - leg.Value.Key]);
					step.PathedRolePurpose = PathedRolePurpose.SameFactType;
					if (leg.Value.Value != null)
					{
						var cpv = new CalculatedPathValue(myStore);
						vlead.CalculatedValueCollection.Add(cpv);
						cpv.Function = eqFn;
						cpv.RequiredForLeadRolePath = vlead;
						var inL = new CalculatedPathValueInput(myStore);
						cpv.InputCollection.Add(inL);
						foreach (FunctionParameter fp in eqFn.ParameterCollection)
						{
							new CalculatedPathValueInputCorrespondsToFunctionParameter(inL, fp);
							break;
						}
						new CalculatedPathValueInputBindsToPathedRole(inL, step);
						var inR = new CalculatedPathValueInput(myStore);
						cpv.InputCollection.Add(inR);
						int pi = 0;
						foreach (FunctionParameter fp in eqFn.ParameterCollection)
						{
							if (pi++ == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(inR, fp); break; }
						}
						var pc = new PathConstant(myStore);
						pc.LexicalValue = leg.Value.Value;
						new CalculatedPathValueInputBindsToPathConstant(inR, pc);
					}
				}
				var vproj = new RoleSetDerivationProjection(vrule, vlead);
				var drp0 = new DerivedRoleProjection(vproj, headE.Roles[0]);
				new DerivedRoleProjectedFromRolePathRoot(drp0, vroot);
				log.Add(headE.Fact.Name + " := conjunction at " + rootVar + " ("
					+ string.Join(" & ", condLegs.Select(l => l.Key.Fact.Name + (l.Value.Value != null ? "='" + l.Value.Value + "'" : ""))) + "), "
					+ DescribeDerivation(headE.Fact));
			}
			// the aggregate class: "* <head> iff <V> is the count of <X>
			// where <source-reading>." — Definition 7's finite bag to one
			// scalar as NORMA's own CalculatedPathValue (Count, aggregated
			// per path root), the literature's flagship derived-fact example
			Function countFn = null;
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && fn.IsAggregate && fn.Name == "Count") { countFn = fn; break; }
			}
			if (countFn == null)
			{
				// the function library is tool-loaded data in the NORMA UI;
				// headless, the one function the aggregate class cites is
				// seeded through NORMA's own Function/FunctionParameter
				// classes (an aggregate over one bag input)
				countFn = new Function(myStore);
				countFn.Name = "Count";
				countFn.IsAggregate = true;
				countFn.Model = myModel;
				var bag = new FunctionParameter(myStore);
				bag.Function = countFn;
				bag.Name = "bag";
				bag.BagInput = true;
			}
			// the CHAINED class: "* <head> iff that <V0> ... and ... and ..."
			// — a conjunction of binary legs, each entered at an already-bound
			// variable and stepping to a new one (or closing onto a head
			// player); sub-paths nest under the sub-path that bound the entry
			// variable, so multi-variable bodies build as one rooted path
			// tree. This is the chained-clause machinery the identity-cast
			// and other-quantifier notes were waiting on; casts ("that is
			// that") and quantified legs stay outside the leg shape and
			// remain deferred prose, executing as canon recipes.
			foreach (string s in myDeferredRules)
			{
				Match m = Regex.Match(s, @"^\* (.+?) iff (that [\w ]+? .+)\.$");
				if (!m.Success) continue;
				string head = m.Groups[1].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(NormalizeWords(head), out headRules);
				if (headRules != 1) continue;
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				if (headE == null || headE.Fact.DerivationRule != null || headE.Players.Count != 2) continue;
				if (headE.Players[0] == headE.Players[1]) continue;
				string[] legTexts = m.Groups[2].Value.Split(new[] { " and " }, StringSplitOptions.None);
				if (legTexts.Length < 1) continue;
				// each leg is a RELATIVE CHAIN — "that A <p1> some B that <p2>
				// some C ..." — optionally ending in the CAST terminal
				// "that is that T": node identity across a subtype edge
				// (Object Type IS a Function through the one id space, so the
				// projection is subtype-compatible — fully inside NORMA, per
				// the external-identity ruling). Clauses resolve VERBATIM
				// longest-type-first; a cast adds an alias, never a node.
				var legs = new List<KeyValuePair<FactIndexEntry, KeyValuePair<string, string>>>();
				var legPos = new List<KeyValuePair<int, int>>();
				var aliasOf = new Dictionary<string, string>(StringComparer.Ordinal);
				// SUBSCRIPT VARIABLES (the metamodel's own deferred-note
				// convention: "Derivation Rule1 reaches Derivation Rule2"):
				// a token <Type><digits> is a DISTINCT variable of that type,
				// so same-typed players can join. Clauses resolve by TYPE
				// (subscript stripped); a twice-typed leg disambiguates
				// positionally (sentence order = reading order).
				var typeOfVar = new Dictionary<string, string>(StringComparer.Ordinal);
				bool ok = true;
				foreach (string lt in legTexts)
				{
					string t = lt.Trim();
					if (t.StartsWith("that ") || t.StartsWith("some ")) t = t.Substring(5);
					else { ok = false; break; }
					string cur = null;
					foreach (string key in myTypes.Keys.OrderByDescending(k => k.Length))
					{
						Match vm = Regex.Match(t, @"^(" + Regex.Escape(key) + @"\d*) ");
						if (vm.Success) { cur = vm.Groups[1].Value; typeOfVar[cur] = key; break; }
					}
					if (cur == null) { ok = false; break; }
					string rest = t.Substring(cur.Length + 1);
					while (ok && rest.Length > 0)
					{
						Match cm2 = Regex.Match(rest, @"^is that ([\w ]+)$");
						if (cm2.Success && myTypes.ContainsKey(cm2.Groups[1].Value.Trim()))
						{
							aliasOf[cm2.Groups[1].Value.Trim()] = cur;
							rest = "";
							break;
						}
						string mid = null, nxt = null, more = null;
						foreach (string key in myTypes.Keys.OrderByDescending(k => k.Length))
						{
							Match hm2 = Regex.Match(rest, @"^(.+?) (?:some|that) (" + Regex.Escape(key) + @"\d*)(?: that (.+))?$");
							if (hm2.Success)
							{
								mid = hm2.Groups[1].Value.Trim();
								nxt = hm2.Groups[2].Value;
								typeOfVar[nxt] = key;
								more = hm2.Groups[3].Success ? hm2.Groups[3].Value.Trim() : null;
								break;
							}
						}
						if (mid == null) { ok = false; break; }
						string curT = typeOfVar[cur], nxtT = typeOfVar[nxt];
						List<string> lp;
						FactIndexEntry legE = ResolveClause(curT + " " + mid + " " + nxtT, out lp);
						if (legE == null || legE.Players.Count != 2 || legE == headE) { ok = false; break; }
						int eAtL, nAtL;
						if (curT == nxtT)
						{
							// twice-typed leg: legal only with DISTINCT variable
							// tokens; positions by sentence order (= reading order)
							if (cur == nxt) { ok = false; break; }
							eAtL = legE.Players.IndexOf(curT);
							nAtL = legE.Players.LastIndexOf(nxtT);
							if (eAtL < 0 || nAtL <= eAtL) { ok = false; break; }
						}
						else
						{
							if (legE.Players.LastIndexOf(curT) != legE.Players.IndexOf(curT) ||
								legE.Players.LastIndexOf(nxtT) != legE.Players.IndexOf(nxtT)) { ok = false; break; }
							eAtL = legE.Players.IndexOf(curT);
							nAtL = legE.Players.IndexOf(nxtT);
							if (eAtL < 0 || nAtL < 0) { ok = false; break; }
						}
						legs.Add(new KeyValuePair<FactIndexEntry, KeyValuePair<string, string>>(legE,
							new KeyValuePair<string, string>(cur, nxt)));
						legPos.Add(new KeyValuePair<int, int>(eAtL, nAtL));
						cur = nxt;
						rest = more == null ? "" : more;
					}
					if (!ok) break;
				}
				if (!ok || legs.Count < 1) continue;
				// the root VARIABLE is the first leg's first token; its TYPE
				// must be the head's first player (subscripted or bare)
				string rootVar = legs[0].Value.Key;
				string rootVarT;
				if (!typeOfVar.TryGetValue(rootVar, out rootVarT)) rootVarT = rootVar;
				if (rootVarT != headE.Players[0]) continue;
				ObjectType rootT;
				if (!myTypes.TryGetValue(rootVarT, out rootT)) continue;
				var rule = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(headE.Fact, rule);
				ApplyDerivationMarkers(headE.Fact, rule);
				var lead = new LeadRolePath(myStore);
				rule.OwnedLeadRolePathCollection.Add(lead);
				var root = new RolePathObjectTypeRoot(lead, rootT);
				// where each variable is reachable: bound at the lead (root)
				// or at the sub-path whose step introduced it
				var boundAt = new Dictionary<string, RolePath>(StringComparer.Ordinal) { { rootVar, lead } };
				var stepOf = new Dictionary<string, PathedRole>(StringComparer.Ordinal);
				for (int li = 0; li < legs.Count; li++)
				{
					var leg = legs[li];
					string t1 = leg.Value.Key, t2 = leg.Value.Value;
					string entryVar = boundAt.ContainsKey(t1) ? t1 : (boundAt.ContainsKey(t2) ? t2 : null);
					if (entryVar == null) { ok = false; break; }
					string newVar = entryVar == t1 ? t2 : t1;
					int eAt = entryVar == t1 ? legPos[li].Key : legPos[li].Value;
					int nAt = entryVar == t1 ? legPos[li].Value : legPos[li].Key;
					if (eAt < 0 || nAt < 0) { ok = false; break; }
					var sub = new RoleSubPath(myStore);
					boundAt[entryVar].SubPathCollection.Add(sub);
					var entry = new PathedRole(sub, leg.Key.Roles[eAt]);
					entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					var step = new PathedRole(sub, leg.Key.Roles[nAt]);
					step.PathedRolePurpose = PathedRolePurpose.SameFactType;
					if (!boundAt.ContainsKey(newVar))
					{
						boundAt[newVar] = sub;
						stepOf[newVar] = step;
					}
					else
					{
						// closing onto an already-bound variable (a head
						// player): the projection reads this step
						stepOf[newVar] = step;
					}
				}
				if (!ok) continue;
				var proj = new RoleSetDerivationProjection(rule, lead);
				var resolvedVars = new List<string>();
				for (int i = 0; i < headE.Roles.Count; i++)
				{
					string p = headE.Players[i];
					// a cast alias projects from the node it is identical to
					// (subtype-compatible: the node's type is a subtype of
					// the head role's player through the one id space)
					if (aliasOf.ContainsKey(p)) p = aliasOf[p];
					// resolve the VARIABLE for this head role: the bare type
					// token when bound, else the k-th variable of the type in
					// subscript order (head's k-th same-typed role)
					if (!(p == rootVar || stepOf.ContainsKey(p)))
					{
						int k = 0;
						for (int q = 0; q < i; q++)
							if (headE.Players[q] == headE.Players[i]) k++;
						var cands = new List<string>();
						foreach (var kv in typeOfVar)
							if (kv.Value == p && (kv.Key == rootVar || stepOf.ContainsKey(kv.Key)))
								cands.Add(kv.Key);
						cands.Sort((a, b) => a.Length != b.Length
							? a.Length.CompareTo(b.Length)
							: string.CompareOrdinal(a, b));
						if (k < cands.Count) p = cands[k];
					}
					resolvedVars.Add(p);
					var drp = new DerivedRoleProjection(proj, headE.Roles[i]);
					if (p == rootVar)
						new DerivedRoleProjectedFromRolePathRoot(drp, root);
					else if (stepOf.ContainsKey(p))
						new DerivedRoleProjectedFromPathedRole(drp, stepOf[p]);
					else { ok = false; break; }
				}
				if (!ok) continue;
				// the strict two-chain all-binary case records its canon
				// recipe through the same recorder the general class uses,
				// so subscripted chains execute in state:rules too. Scoped to
				// the feature's own footprint: only rules that USE a
				// subscripted variable record here - unsubscripted chains
				// keep their prior status exactly (NORMA-built, no recipe),
				// so no station's closure gains unasked-for work.
				bool usesSubscript = false;
				foreach (var kv in typeOfVar)
					if (kv.Key != kv.Value) { usesSubscript = true; break; }
				if (usesSubscript && legs.Count == 2 && legs[1].Value.Key == legs[0].Value.Value
					&& legs[0].Key.Players.Count == 2 && legs[1].Key.Players.Count == 2
					&& headE.Players.Count == 2)
				{
					int rj1 = legPos[0].Value, rj2 = legPos[1].Key;
					var relocated = new List<KeyValuePair<FactIndexEntry, int>>();
					bool rok = true;
					foreach (string pv in resolvedVars)
					{
						if (pv == rootVar)
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[0].Key, legPos[0].Key));
						else if (pv == legs[0].Value.Value)
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[0].Key, legPos[0].Value));
						else if (pv == legs[1].Value.Value)
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[1].Key, legPos[1].Value));
						else { rok = false; break; }
					}
					if (rok)
						RecordRuleRecipe(headE, legs[0].Key, legs[1].Key, rj1, rj2, relocated);
				}
				var names = new List<string>();
				foreach (var leg in legs) names.Add(leg.Key.Fact.Name);
				log.Add(headE.Fact.Name + " := chain over " + string.Join(" -> ", names) + ", fully derived, not stored");
			}
			foreach (string s in myDeferredRules)
			{
				Match m = Regex.Match(s, @"^\* (.+?) iff ([\w ]+?) is the count of ([\w ]+?) where (.+)\.$");
				if (!m.Success) continue;
				if (countFn == null) { log.Add("SKIPPED (no Count function in library): " + s); continue; }
				string head = m.Groups[1].Value.Trim();
				string v = m.Groups[2].Value.Trim();
				string x = m.Groups[3].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(NormalizeWords(head), out headRules);
				if (headRules != 1) continue;
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				FactIndexEntry src = FindEntryByNormalizedSentence(Dequantify(" " + m.Groups[4].Value.Trim()).Trim());
				if (headE == null || src == null || headE == src) continue;
				if (headE.Fact.DerivationRule != null) continue;
				int vAt = headE.Players.IndexOf(v);
				if (vAt < 0 || headE.Players.Count != 2) continue;
				string groupPlayer = headE.Players[1 - vAt];
				int gAt = src.Players.IndexOf(groupPlayer);
				int xAt = src.Players.IndexOf(x);
				if (gAt < 0 || xAt < 0 || gAt == xAt) continue;
				ObjectType rootType;
				if (!myTypes.TryGetValue(groupPlayer, out rootType)) continue;
				var rule = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(headE.Fact, rule);
				ApplyDerivationMarkers(headE.Fact, rule);
				var lead = new LeadRolePath(myStore);
				rule.OwnedLeadRolePathCollection.Add(lead);
				var root = new RolePathObjectTypeRoot(lead, rootType);
				var entry = new PathedRole(lead, src.Roles[gAt]);
				entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				var step = new PathedRole(lead, src.Roles[xAt]);
				step.PathedRolePurpose = PathedRolePurpose.SameFactType;
				var cpv = new CalculatedPathValue(myStore);
				lead.CalculatedValueCollection.Add(cpv);
				cpv.Function = countFn;
				new CalculatedPathValueAggregationContextIncludesRolePathRoot(cpv, root);
				var input = new CalculatedPathValueInput(myStore);
				cpv.InputCollection.Add(input);
				foreach (FunctionParameter fp in countFn.ParameterCollection)
				{
					new CalculatedPathValueInputCorrespondsToFunctionParameter(input, fp);
					break;
				}
				new CalculatedPathValueInputBindsToPathedRole(input, step);
				var proj = new RoleSetDerivationProjection(rule, lead);
				var drpGroup = new DerivedRoleProjection(proj, headE.Roles[1 - vAt]);
				new DerivedRoleProjectedFromRolePathRoot(drpGroup, root);
				var drpValue = new DerivedRoleProjection(proj, headE.Roles[vAt]);
				new DerivedRoleProjectedFromCalculatedPathValue(drpValue, cpv);
				log.Add(headE.Fact.Name + " := Count(" + x + ") per " + groupPlayer + " over " + src.Fact.Name + ", fully derived, not stored");
			}
			// LEFTOVERS PASS — the object-join arm of the linear two-leg
			// class: exactly two clauses joined by " and ", sharing ONE type
			// quantified "some J" in one clause and referenced "that J" in
			// the other, J in subject OR object position (the head-anchored
			// shape "iff Evidence comes from some Source and that Sleuth
			// vouches for that Source" joins on the object). Runs LAST and
			// only for heads no earlier class built, so every existing build
			// stays byte-identical. Built rules record their executable
			// recipe for state:rules in the rules:metamodel grammar (join =
			// left's last column meets right's first; proj flips a leg);
			// v1 records the all-binary shape.
			foreach (string sRaw in myDeferredRules)
			{
				// an orphan derivation marker from a preceding ". *" declaration
				// can glue onto the first rule of a block ("* * Head iff ...");
				// normalize repeated stars before matching
				string s = sRaw;
				while (s.StartsWith("* * ")) s = s.Substring(2);
				bool dbg = false;
				Match m = Regex.Match(s, @"^\* (.+?) iff (.+)\.$");
				if (!m.Success) continue;
				string head = m.Groups[1].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(NormalizeWords(head), out headRules);
				int generalRules;
				generalPerHead.TryGetValue(NormalizeWords(head), out generalRules);
				// a multi-rule head admits IFF every one of its rules is
				// this class's shape (the linear-class treatment, mirrored)
				if (headRules != 1 && generalRules != headRules) continue;
				string[] clauses = Regex.Split(m.Groups[2].Value.Trim(), @" and (?=that |some )");
				if (clauses.Length != 2) continue;
				string j = null;
				foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
				{
					// the shared player is quantified ("some J") or BARE in one
					// clause and referenced "that J" in the other
					bool q0 = clauses[0].Contains("some " + name) || clauses[0].Contains(name),
					     q1 = clauses[1].Contains("some " + name) || clauses[1].Contains(name);
					bool r0 = clauses[0].Contains("that " + name), r1 = clauses[1].Contains("that " + name);
					if ((q0 && r1) || (q1 && r0)) { j = name; break; }
				}
				if (j == null) continue;
				Func<string, string> stripQ = c =>
				{
					if (c.StartsWith("that ")) c = c.Substring(5);
					if (c.StartsWith("some ")) c = c.Substring(5);
					return Dequantify(c);
				};
				string leg1 = stripQ(clauses[0]);
				string leg2 = stripQ(clauses[1]);
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				FactIndexEntry e1 = FindEntryByNormalizedSentence(leg1);
				FactIndexEntry e2 = FindEntryByNormalizedSentence(leg2);
				if (headE == null || e1 == null || e2 == null || headE == e1 || headE == e2) continue;
				if (headE.Fact.DerivationRule != null && headRules == 1) continue;
				int j1 = e1.Players.IndexOf(j), j2 = e2.Players.IndexOf(j);
				if (j1 < 0 || j2 < 0 || e1.Players.LastIndexOf(j) != j1 || e2.Players.LastIndexOf(j) != j2) continue;
				var located = new List<KeyValuePair<FactIndexEntry, int>>();
				bool ok = true;
				for (int i = 0; i < headE.Players.Count && ok; i++)
				{
					string p = headE.Players[i];
					if (p == j)
					{
						// the head projects the JOIN PLAYER itself: locate it
						// at e1's join position; the step reuses the entry role
						located.Add(new KeyValuePair<FactIndexEntry, int>(e1, j1));
						continue;
					}
					var hits = new List<KeyValuePair<FactIndexEntry, int>>();
					for (int c = 0; c < e1.Players.Count; c++)
						if (c != j1 && e1.Players[c] == p) hits.Add(new KeyValuePair<FactIndexEntry, int>(e1, c));
					for (int c = 0; c < e2.Players.Count; c++)
						if (c != j2 && e2.Players[c] == p) hits.Add(new KeyValuePair<FactIndexEntry, int>(e2, c));
					if (hits.Count != 1) { ok = false; break; }
					located.Add(hits[0]);
				}
				if (!ok) continue;
				// get-or-create: a multi-rule head unions one lead per rule
				var rule = headE.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule == null)
				{
					rule = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(headE.Fact, rule);
					ApplyDerivationMarkers(headE.Fact, rule);
				}
				var lead = new LeadRolePath(myStore);
				rule.OwnedLeadRolePathCollection.Add(lead);
				new RolePathObjectTypeRoot(lead, myTypes[j]);
				var steps = new PathedRole[headE.Roles.Count];
				foreach (var legPair in new[] { new KeyValuePair<FactIndexEntry, int>(e1, j1), new KeyValuePair<FactIndexEntry, int>(e2, j2) })
				{
					var sub = new RoleSubPath(myStore);
					lead.SubPathCollection.Add(sub);
					var entry = new PathedRole(sub, legPair.Key.Roles[legPair.Value]);
					entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					for (int i = 0; i < located.Count; i++)
					{
						if (located[i].Key != legPair.Key) continue;
						if (located[i].Value == legPair.Value) { steps[i] = entry; continue; }
						var step = new PathedRole(sub, legPair.Key.Roles[located[i].Value]);
						step.PathedRolePurpose = PathedRolePurpose.SameFactType;
						steps[i] = step;
					}
				}
				var proj = new RoleSetDerivationProjection(rule, lead);
				for (int i = 0; i < headE.Roles.Count; i++)
				{
					if (steps[i] == null) { ok = false; break; }
					var drp = new DerivedRoleProjection(proj, headE.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp, steps[i]);
				}
				if (!ok) continue;
				log.Add(headE.Fact.Name + " := join over " + j + " (" + e1.Fact.Name + " x " + e2.Fact.Name + "), " + DescribeDerivation(headE.Fact));
				RecordRuleRecipe(headE, e1, e2, j1, j2, located);
			}
			return log;
		}

		// the executable recipe for state:rules in the rules:metamodel grammar
		// (join = left's last column meets right's first; proj flips a leg
		// into that arrangement). v1 records the all-binary shape — wider
		// legs stay rules:metamodel-side.
		private void RecordRuleRecipe(FactIndexEntry headE, FactIndexEntry e1, FactIndexEntry e2,
			int j1, int j2, List<KeyValuePair<FactIndexEntry, int>> located)
		{
			if (headE.Players.Count != 2 || e1.Players.Count != 2 || e2.Players.Count != 2) return;
			string legA = j1 == 1 ? IAtom(e1.Fact.Name)
				: "S3(" + IAtom("proj") + ", " + IAtom(e1.Fact.Name) + ", S2(N(2), N(1)))";
			string legB = j2 == 0 ? IAtom(e2.Fact.Name)
				: "S3(" + IAtom("proj") + ", " + IAtom(e2.Fact.Name) + ", S2(N(2), N(1)))";
			var pos = new List<string>();
			foreach (var kv in located)
			{
				// joined columns are (left-non-join, JOIN, right-non-join) =
				// 1, 2, 3; a head player located AT a join position is the
				// join column itself
				bool atJoin = (kv.Key == e1 && kv.Value == j1) || (kv.Key == e2 && kv.Value == j2);
				pos.Add("N(" + (atJoin ? 2 : kv.Key == e1 ? 1 : 3) + ")");
			}
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), S4(" + IAtom("join") + ", "
				+ legA + ", " + legB + ", S2(" + string.Join(", ", pos) + ")))");
		}

		private static string Dequantify(string leg)
		{
			return leg.Replace(" that ", " ").Replace(" some ", " ");
		}

		// the killed host's check.rs layers, re-homed as oracle readers.
		// Ring completeness: validation.md's obligation that every binary
		// fact type whose two roles share a player carries some ring
		// constraint. Deontic — findings are for adjudication, not errors.
		public List<string> CheckRingCompleteness()
		{
			var ringed = new HashSet<FactType>();
			foreach (SetConstraint sc in myStore.ElementDirectory.FindElements<SetConstraint>(true))
			{
				if (sc.IsDeleted || !(sc is RingConstraint)) continue;
				foreach (Role r in sc.RoleCollection)
				{
					if (r.FactType != null) ringed.Add(r.FactType);
				}
			}
			var findings = new List<string>();
			foreach (FactIndexEntry e in myFactIndex)
			{
				if (e.Fact.IsDeleted || e.Roles.Count != 2) continue;
				// the obligation scopes to ASSERTED fact types (adjudicated
				// 2026-07-17): on a derived fact type the population is a
				// theorem of its rules — the ring question is answered by
				// the derivation itself (Codd 1970 1.5; a truthful ring like
				// TR on a closure may still be declared as documentation)
				if (myFullyDerived.Contains(e.Fact) || myStoredDerived.Contains(e.Fact) ||
					mySemiDerived.Contains(e.Fact) || e.Fact.DerivationRule != null) continue;
				ObjectType a = e.Roles[0].RolePlayer, b = e.Roles[1].RolePlayer;
				if (a == null || a != b) continue;
				bool spanning = false;
				foreach (UniquenessConstraint uc in InternalUCs(e.Fact))
					if (uc.RoleCollection.Count == 2) spanning = true;
				if (!spanning) continue;
				if (!ringed.Contains(e.Fact))
					findings.Add(e.Fact.Name + " [" + a.Name + "] — asserted same-player m:n, no ring constraint");
			}
			return findings;
		}

		// Singular naming: an Object Type name must not be the plural form
		// of another Object Type name, measured by the model's OWN
		// Pluralization Rule populations (pattern -> replacement applied to
		// each name; a produced name colliding with a declared name is the
		// forbidden plural). The lexicon lives in the model, not the host.
		public List<string> CheckSingularNaming()
		{
			var patterns = new Dictionary<string, string>(StringComparer.Ordinal);
			var replacements = new Dictionary<string, string>(StringComparer.Ordinal);
			foreach (FactIndexEntry e in myFactIndex)
			{
				if (e.Fact.IsDeleted) continue;
				bool isPat = e.Fact.Name == "PluralizationRuleHasPluralizationPattern";
				bool isRep = e.Fact.Name == "PluralizationRuleHasPluralizationReplacement";
				if (!isPat && !isRep) continue;
				for (int r = 0; r < e.Rows.Count; r++)
				{
					if (e.Rows[r].Count != 2) continue;
					if (isPat) patterns[e.Rows[r][0]] = e.Rows[r][1];
					else replacements[e.Rows[r][0]] = e.Rows[r][1];
				}
			}
			var findings = new List<string>();
			foreach (var rule in patterns)
			{
				string rep;
				if (!replacements.TryGetValue(rule.Key, out rep)) continue;
				foreach (string name in myTypes.Keys)
				{
					string lower = name.ToLowerInvariant();
					System.Text.RegularExpressions.Match pm;
					try { pm = Regex.Match(lower, rule.Value); }
					catch (ArgumentException) { continue; }
					if (!pm.Success) continue;
					string plural = Regex.Replace(lower, rule.Value, rep);
					foreach (string other in myTypes.Keys)
					{
						if (!ReferenceEquals(other, name) && other.ToLowerInvariant() == plural)
							findings.Add(other + " is the plural of " + name + " (rule " + rule.Key + ")");
					}
				}
			}
			return findings;
		}

		// exec ruling 5: nothing deferred — every textual constraint form is
		// built as a NORMA element. Rings and direct subsets/exclusions/
		// disjunctive mandatories become real constraints; forms needing a
		// join path (where-clauses, mid-clause relatives, self-joins) become
		// ModelNotes with the join-path construction named as the next
		// oracle increment — represented and verbalized, never dropped.
		public void BuildTextualConstraints()
		{
			foreach (var kv in myTextual)
			{
				try
				{
					if (BuildTextual(kv.Key, kv.Value)) continue;
					AddNote(kv.Key, kv.Value, "unmatched form");
				}
				catch (Exception ex)
				{
					Count("harness-error (textual)");
					myMapLog.Add("ERROR building textual '" + Shorten(kv.Value) + "': " + ex.Message);
				}
			}
			myTextual.Clear();
		}

		private void AddNote(string kind, string sentence, string reason)
		{
			ModelNote note = new ModelNote(myStore);
			note.Text = sentence;
			note.Model = myModel;
			Count("textual constraint (model note: " + kind + ", " + reason + ")");
			myMapLog.Add("note (" + reason + "): " + Shorten(sentence));
		}

		private FactIndexEntry FindRingEntry(string player, string words)
		{
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Players.Count == 2 &&
					entry.Players[0] == player && entry.Players[1] == player &&
					string.Equals(entry.ReadingWords, words, StringComparison.Ordinal))
				{
					return entry;
				}
			}
			return null;
		}

		private void BuildRing(FactIndexEntry entry, string ringType, ConstraintModality modality)
		{
			RingConstraint rc = new RingConstraint(myStore);
			rc.Model = myModel;
			rc.RoleCollection.Add(entry.Roles[0]);
			rc.RoleCollection.Add(entry.Roles[1]);
			rc.RingType = (RingConstraintType)Enum.Parse(typeof(RingConstraintType), ringType);
			rc.Modality = modality;
			myRingRows.Add("S2(" + IAtom(entry.Fact.Name) + ", " + IAtom(ringType) + ")");
			Count("ring constraint (" + ringType.ToLowerInvariant() + ")");
		}

		// resolve a clause ("some Status is initial in some State Machine
		// Definition") to a fact entry plus the ordered players it binds
		private FactIndexEntry ResolveClause(string clause, out List<string> playersOut)
		{
			playersOut = null;
			string working = " " + Regex.Replace(clause.Trim(), @"\s+", " ") + " ";
			var hits = new List<KeyValuePair<int, string>>();
			foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
			{
				int at = 0;
				string probe = name;
				while ((at = working.IndexOf(probe, at, StringComparison.Ordinal)) >= 0)
				{
					bool leftOk = !char.IsLetterOrDigit(working[at - 1]);
					int end = at + probe.Length;
					bool rightOk = end >= working.Length || !char.IsLetterOrDigit(working[end]);
					if (leftOk && rightOk)
					{
						hits.Add(new KeyValuePair<int, string>(at, name));
						working = working.Substring(0, at) + new string((char)1, probe.Length) + working.Substring(end);
						at = end;
					}
					else at++;
				}
			}
			if (hits.Count == 0) return null;
			hits.Sort((a, b) => a.Key.CompareTo(b.Key));
			var players = hits.Select(h => h.Value).ToList();
			string words = Regex.Replace(working, "+", " ");
			words = Regex.Replace(words, @"\b(some|that|a|an|the)\b", " ");
			words = Regex.Replace(words, @"\s+", " ").Trim();
			string wordsKey = NormalizeWords(words);
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Players.Count != players.Count) continue;
				bool same = true;
				for (int i = 0; i < players.Count && same; i++) same = entry.Players[i] == players[i];
				if (!same) continue;
				// ReadingWords keeps interior placeholder gaps as doubled
				// spaces ("uses  for" from a ternary); compare normalized
				if (string.Equals(NormalizeWords(entry.ReadingWords), wordsKey, StringComparison.Ordinal))
				{
					playersOut = players;
					return entry;
				}
			}
			return null;
		}

		private sealed class SideClause
		{
			public FactIndexEntry Entry;
			public List<string> Players;
		}

		// a side is one clause or a two-clause chain joined by
		// where/and/that; backtracking split, right-to-left, each piece
		// resolved against the fact index
		private List<SideClause> ParseSide(string text)
		{
			List<string> players;
			FactIndexEntry whole = ResolveClause(text, out players);
			if (whole != null)
			{
				return new List<SideClause> { new SideClause { Entry = whole, Players = players } };
			}
			foreach (string splitter in new[] { " where ", " and ", " that " })
			{
				int at = text.Length;
				while ((at = text.LastIndexOf(splitter, at - 1, StringComparison.Ordinal)) > 0)
				{
					string left = text.Substring(0, at);
					string right = text.Substring(at + splitter.Length);
					List<string> lp, rp;
					FactIndexEntry le = ResolveClause(left, out lp);
					if (le == null) continue;
					// a bare continuation names no subject; try the left
					// clause's players as the elided subject (last for
					// that-relatives, first for and-continuations)
					FactIndexEntry re = ResolveClause(right, out rp);
					if (re == null && lp.Count > 0)
					{
						re = ResolveClause(lp[lp.Count - 1] + " " + right, out rp);
					}
					if (re == null && lp.Count > 0)
					{
						re = ResolveClause(lp[0] + " " + right, out rp);
					}
					if (re == null) continue;
					return new List<SideClause>
					{
						new SideClause { Entry = le, Players = lp },
						new SideClause { Entry = re, Players = rp },
					};
				}
			}
			return null;
		}

		private static string InternalVar(List<SideClause> side)
		{
			if (side.Count != 2) return null;
			foreach (string p in side[0].Players)
			{
				if (side[1].Players.Contains(p)) return p;
			}
			return null;
		}

		// one constraint role sequence for a side; a two-clause side gets a
		// join path in NORMA's own serialized shape
		private SetComparisonConstraintRoleSequence BuildSideSequence(List<SideClause> side, List<string> projVars)
		{
			var seq = new SetComparisonConstraintRoleSequence(myStore);
			if (side.Count == 1)
			{
				foreach (string v in projVars)
				{
					int at = side[0].Players.IndexOf(v);
					if (at < 0) return null;
					seq.RoleCollection.Add(side[0].Entry.Roles[at]);
				}
				return seq;
			}
			return BuildPathForSequence(seq, side, projVars) ? seq : null;
		}

		// populate any constraint role sequence (set-comparison sequence or
		// an external set constraint) with the projected roles of a
		// two-clause side plus the join path that grounds them
		// the chain tree on the constraint projection layer: clauses bind
		// variables progressively from the root subject, each clause's
		// sub-path attaching under the sub-path (or lead) that bound its
		// entry variable — the same construction the chained derivation
		// class walks, with ConstraintRoleSequence projections on top
		private bool BuildChainedPathForSequence(ConstraintRoleSequence seq, string rootVar, List<SideClause> clauses, List<string> projVars)
		{
			ObjectType rootType;
			if (!myTypes.TryGetValue(rootVar, out rootType)) return false;
			// locate each projected variable at exactly one non-entry position
			var projLoc = new Dictionary<string, KeyValuePair<int, int>>(StringComparer.Ordinal);
			var jp = new ConstraintRoleSequenceJoinPath(myStore);
			jp.RoleSequence = seq;
			var lead = new LeadRolePath(myStore);
			jp.OwnedLeadRolePathCollection.Add(lead);
			var root = new RolePathObjectTypeRoot(lead, rootType);
			var boundAt = new Dictionary<string, RolePath>(StringComparer.Ordinal) { { rootVar, lead } };
			var stepPathed = new Dictionary<string, PathedRole>(StringComparer.Ordinal);
			for (int c = 0; c < clauses.Count; c++)
			{
				SideClause cl = clauses[c];
				if (cl.Players.Count != 2) return false;
				string entryVar = boundAt.ContainsKey(cl.Players[0]) ? cl.Players[0]
					: (boundAt.ContainsKey(cl.Players[1]) ? cl.Players[1] : null);
				if (entryVar == null) return false;
				string newVar = entryVar == cl.Players[0] ? cl.Players[1] : cl.Players[0];
				int eAt = cl.Players.IndexOf(entryVar);
				int nAt = 1 - eAt;
				var sub = new RoleSubPath(myStore);
				boundAt[entryVar].SubPathCollection.Add(sub);
				var entry = new PathedRole(sub, cl.Entry.Roles[eAt]);
				entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				var step = new PathedRole(sub, cl.Entry.Roles[nAt]);
				step.PathedRolePurpose = PathedRolePurpose.SameFactType;
				if (!boundAt.ContainsKey(newVar)) boundAt[newVar] = sub;
				stepPathed[newVar] = step;
				if (projVars.Contains(newVar) && !projLoc.ContainsKey(newVar))
					projLoc[newVar] = new KeyValuePair<int, int>(c, nAt);
			}
			foreach (string v in projVars)
			{
				if (!projLoc.ContainsKey(v) || !stepPathed.ContainsKey(v)) return false;
			}
			foreach (string v in projVars)
			{
				var loc = projLoc[v];
				seq.RoleCollection.Add(clauses[loc.Key].Entry.Roles[loc.Value]);
			}
			var jpp = new ConstraintRoleSequenceJoinPathProjection(jp, lead);
			foreach (string v in projVars)
			{
				var loc = projLoc[v];
				Role role = clauses[loc.Key].Entry.Roles[loc.Value];
				ConstraintRoleSequenceHasRole link = null;
				foreach (ConstraintRoleSequenceHasRole l in ConstraintRoleSequenceHasRole.GetLinksToRoleCollection(seq))
				{
					if (l.Role == role) { link = l; break; }
				}
				if (link == null) return false;
				var crp = new ConstraintRoleProjection(jpp, link);
				new ConstraintRoleProjectedFromPathedRole(crp, stepPathed[v]);
			}
			return true;
		}

		private bool BuildPathForSequence(ConstraintRoleSequence seq, List<SideClause> side, List<string> projVars)
		{
			string joinVar = InternalVar(side);
			if (joinVar == null) return false;
			ObjectType rootType;
			if (!myTypes.TryGetValue(joinVar, out rootType)) return false;
			var projRole = new Dictionary<string, KeyValuePair<int, int>>(StringComparer.Ordinal);
			foreach (string v in projVars)
			{
				bool found = false;
				for (int c = 0; c < side.Count && !found; c++)
				{
					int at = side[c].Players.IndexOf(v);
					if (at >= 0)
					{
						projRole[v] = new KeyValuePair<int, int>(c, at);
						found = true;
					}
				}
				if (!found) return false;
			}
			foreach (string v in projVars)
			{
				var loc = projRole[v];
				seq.RoleCollection.Add(side[loc.Key].Entry.Roles[loc.Value]);
			}
			var jp = new ConstraintRoleSequenceJoinPath(myStore);
			jp.RoleSequence = seq;
			var lead = new LeadRolePath(myStore);
			jp.OwnedLeadRolePathCollection.Add(lead);
			new RolePathObjectTypeRoot(lead, rootType);
			var stepPathed = new Dictionary<string, PathedRole>(StringComparer.Ordinal);
			for (int c = 0; c < side.Count; c++)
			{
				int joinAt = side[c].Players.IndexOf(joinVar);
				if (joinAt < 0) return false;
				var sub = new RoleSubPath(myStore);
				lead.SubPathCollection.Add(sub);
				var entry = new PathedRole(sub, side[c].Entry.Roles[joinAt]);
				entry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				foreach (string v in projVars)
				{
					var loc = projRole[v];
					if (loc.Key != c) continue;
					var step = new PathedRole(sub, side[c].Entry.Roles[loc.Value]);
					step.PathedRolePurpose = PathedRolePurpose.SameFactType;
					stepPathed[v] = step;
				}
			}
			var jpp = new ConstraintRoleSequenceJoinPathProjection(jp, lead);
			foreach (string v in projVars)
			{
				var loc = projRole[v];
				Role role = side[loc.Key].Entry.Roles[loc.Value];
				ConstraintRoleSequenceHasRole link = null;
				foreach (ConstraintRoleSequenceHasRole l in ConstraintRoleSequenceHasRole.GetLinksToRoleCollection(seq))
				{
					if (l.Role == role) { link = l; break; }
				}
				if (link == null || !stepPathed.ContainsKey(v)) return false;
				var crp = new ConstraintRoleProjection(jpp, link);
				new ConstraintRoleProjectedFromPathedRole(crp, stepPathed[v]);
			}
			return true;
		}

		private bool BuildTextual(string kind, string s)
		{
			string body = s.TrimEnd('.').Trim();
			ConstraintModality modality = ConstraintModality.Alethic;
			if (body.StartsWith("It is forbidden that ") || body.StartsWith("It is obligatory that "))
			{
				modality = ConstraintModality.Deontic;
			}
			// ORM 2 treats deontic as the SAME constraint under a different
			// modality operator — "Deontic readings use these patterns with the
			// relevant substitution of modality operators" (tech report 2,
			// sec. 1.7). The shape regexes below match the BARE pattern, so an
			// obligatory body must have its operator stripped or it can never
			// reach them; modality is already captured above and every builder
			// stamps it. Only OBLIGATORY is stripped: a forbidden body run
			// through the positive shapes would invert its meaning.
			if (body.StartsWith("It is obligatory that "))
			{
				body = body.Substring(body.IndexOf("that ") + 5).Trim();
				if (body.Length > 0) body = char.ToUpperInvariant(body[0]) + body.Substring(1);
			}

			// ring: "No X <words> itself" — X matched longest-type-first so
			// multi-word players ("Object Type") bind whole
			if (body.StartsWith("No ") && body.EndsWith(" itself"))
			{
				string middle = body.Substring(3, body.Length - 3 - 7).Trim();
				foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
				{
					if (middle.StartsWith(name + " ", StringComparison.Ordinal))
					{
						FactIndexEntry ring = FindRingEntry(name, middle.Substring(name.Length).Trim());
						if (ring != null)
						{
							BuildRing(ring, "Irreflexive", modality);
							return true;
						}
						break;
					}
				}
				AddNote(kind, s, "no ring fact type for irreflexive form");
				return true;
			}

			// tag subscripted variables: "Object Type1" -> "Object Type#1"
			string tagged = body;
			foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
			{
				tagged = Regex.Replace(tagged, Regex.Escape(name) + @"(\d)\b", name.Replace("$", "$$") + "#$1");
			}
			// ring asymmetric: If X#1 w X#2, then X#2 is not w' X#1 — the
			// negated predicate drops the leading "is" ("is subtype of" ->
			// "is not subtype of")
			Match m = Regex.Match(tagged, @"^If ([\w :]+?)#1 (.+?) \1#2, then \1#2 is not (.+?) \1#1$");
			if (m.Success)
			{
				string w = m.Groups[2].Value.Trim();
				string neg = m.Groups[3].Value.Trim();
				bool negMatches = string.Equals(neg, w, StringComparison.Ordinal) ||
					(w.StartsWith("is ") && string.Equals(neg, w.Substring(3), StringComparison.Ordinal));
				if (negMatches)
				{
					FactIndexEntry ring = FindRingEntry(m.Groups[1].Value.Trim(), w);
					if (ring != null)
					{
						BuildRing(ring, "Asymmetric", modality);
						return true;
					}
				}
			}
			// ring transitive: If X#1 w X#2 and X#2 w X#3, then X#1 w X#3
			m = Regex.Match(tagged, @"^If ([\w :]+?)#1 (.+?) \1#2 and \1#2 \2 \1#3, then \1#1 \2 \1#3$");
			if (m.Success)
			{
				FactIndexEntry ring = FindRingEntry(m.Groups[1].Value.Trim(), m.Groups[2].Value.Trim());
				if (ring != null)
				{
					BuildRing(ring, "Transitive", modality);
					return true;
				}
			}

			// value comparison (Codd's inequality theta): "If some A <p> some
			// B then that A <q1> some V and that B <q2> some V where that A V
			// is before that B V." — a NORMA ValueComparisonConstraint over
			// the two V roles, grounded by a CHAINED join path: root A,
			// branch into the A-V fact, walk A-p-B, and nest into the B-V
			// fact under the B step (two join variables, so the flat
			// one-root builder does not apply)
			m = Regex.Match(body, @"^If some ([\w :]+?) (.+?) some ([\w :]+?) then that \1 (.+?) some ([\w :]+?) and that \3 (.+?) some \5 where that \1 \5 is (before|after) that \3 \5$");
			if (m.Success)
			{
				string aName = m.Groups[1].Value.Trim();
				string bName = m.Groups[3].Value.Trim();
				string vName = m.Groups[5].Value.Trim();
				List<string> pAB, pAV, pBV;
				FactIndexEntry eAB0 = ResolveClause("some " + aName + " " + m.Groups[2].Value.Trim() + " some " + bName, out pAB);
				FactIndexEntry eAV0 = ResolveClause("that " + aName + " " + m.Groups[4].Value.Trim() + " some " + vName, out pAV);
				FactIndexEntry eBV0 = ResolveClause("that " + bName + " " + m.Groups[6].Value.Trim() + " some " + vName, out pBV);
				{
					SideClause cAB = eAB0 == null ? null : new SideClause { Entry = eAB0, Players = pAB };
					SideClause cAV = eAV0 == null ? null : new SideClause { Entry = eAV0, Players = pAV };
					SideClause cBV = eBV0 == null ? null : new SideClause { Entry = eBV0, Players = pBV };
					ObjectType rootA;
					if (cAB != null && cAV != null && cBV != null && myTypes.TryGetValue(aName, out rootA))
					{
						Role tsA = cAV.Entry.Roles[cAV.Players.IndexOf(vName)];
						Role tsB = cBV.Entry.Roles[cBV.Players.IndexOf(vName)];
						var vcc = new ValueComparisonConstraint(myStore);
						vcc.Model = myModel;
						vcc.Operator = m.Groups[7].Value == "before"
							? ValueComparisonOperator.LessThan
							: ValueComparisonOperator.GreaterThan;
						vcc.Modality = modality;
						vcc.RoleCollection.Add(tsA);
						vcc.RoleCollection.Add(tsB);
						var jp = new ConstraintRoleSequenceJoinPath(myStore);
						jp.RoleSequence = vcc;
						var lead = new LeadRolePath(myStore);
						jp.OwnedLeadRolePathCollection.Add(lead);
						new RolePathObjectTypeRoot(lead, rootA);
						var subAV = new RoleSubPath(myStore);
						lead.SubPathCollection.Add(subAV);
						var eAV = new PathedRole(subAV, cAV.Entry.Roles[cAV.Players.IndexOf(aName)]);
						eAV.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
						var sTs1 = new PathedRole(subAV, tsA);
						sTs1.PathedRolePurpose = PathedRolePurpose.SameFactType;
						var subAB = new RoleSubPath(myStore);
						lead.SubPathCollection.Add(subAB);
						var eAB = new PathedRole(subAB, cAB.Entry.Roles[cAB.Players.IndexOf(aName)]);
						eAB.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
						var sB = new PathedRole(subAB, cAB.Entry.Roles[cAB.Players.IndexOf(bName)]);
						sB.PathedRolePurpose = PathedRolePurpose.SameFactType;
						var subBV = new RoleSubPath(myStore);
						subAB.SubPathCollection.Add(subBV);
						var eBV = new PathedRole(subBV, cBV.Entry.Roles[cBV.Players.IndexOf(bName)]);
						eBV.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
						var sTs2 = new PathedRole(subBV, tsB);
						sTs2.PathedRolePurpose = PathedRolePurpose.SameFactType;
						var jpp = new ConstraintRoleSequenceJoinPathProjection(jp, lead);
						foreach (var pair in new[] { new KeyValuePair<Role, PathedRole>(tsA, sTs1), new KeyValuePair<Role, PathedRole>(tsB, sTs2) })
						{
							ConstraintRoleSequenceHasRole link = null;
							foreach (ConstraintRoleSequenceHasRole l in ConstraintRoleSequenceHasRole.GetLinksToRoleCollection(vcc))
							{
								if (l.Role == pair.Key) { link = l; break; }
							}
							if (link != null)
							{
								var crp = new ConstraintRoleProjection(jpp, link);
								new ConstraintRoleProjectedFromPathedRole(crp, pair.Value);
							}
						}
						Count("value comparison constraint (chained join path)");
						myMapLog.Add("value comparison built: " + Shorten(s));
						return true;
					}
				}
				AddNote(kind, s, "value comparison beyond the chained builder");
				return true;
			}

			// subset: If <side> then <side> — each side one clause (plain
			// role sequence) or a two-clause chain (a real NORMA join path:
			// root = the internal shared player, one sub-path per fact,
			// PostInnerJoin entry + SameFactType step, projections from the
			// stepped pathed roles; the shape NORMA itself serializes)
			m = Regex.Match(body, @"^If (.+?) then (.+)$");
			if (m.Success)
			{
				var ante = ParseSide(m.Groups[1].Value);
				var cons = ParseSide(m.Groups[2].Value);
				if (ante != null && cons != null)
				{
					var anteVars = ante.SelectMany(c => c.Players).Distinct().ToList();
					var consVars = cons.SelectMany(c => c.Players).Distinct().ToList();
					var proj = consVars.Intersect(anteVars).Distinct().ToList();
					// internal join vars must not be projection vars
					if (ante.Count == 2)
					{
						string v = InternalVar(ante);
						if (v != null) proj.Remove(v);
					}
					if (cons.Count == 2)
					{
						string v = InternalVar(cons);
						if (v != null) proj.Remove(v);
					}
					if (proj.Count > 0)
					{
						SetComparisonConstraintRoleSequence sub = BuildSideSequence(ante, proj);
						SetComparisonConstraintRoleSequence super = BuildSideSequence(cons, proj);
						if (sub != null && super != null)
						{
							SubsetConstraint sc = new SubsetConstraint(myStore);
							sc.Model = myModel;
							sc.RoleSequenceCollection.Add(sub);
							sc.RoleSequenceCollection.Add(super);
							sc.Modality = modality;
							bool joined = ante.Count > 1 || cons.Count > 1;
							Count("subset constraint (" + (joined ? "join path" : "direct") + ", " + proj.Count + "-role sequences)");
							myMapLog.Add("subset built (" + (joined ? "join path" : "direct") + "): " + Shorten(s));
							return true;
						}
					}
				}
				AddNote(kind, s, "clauses beyond the two-clause chain builder");
				return true;
			}

			// external uniqueness: "For each A and B, at most one S <c1> and
			// <c2>" — the listed players live on different fact types joined
			// through the shared subject; a UniquenessConstraint (external)
			// carrying its join path. A leg may CHAIN through one
			// intermediate ("has some Migration that produces target that
			// Fact Type"): the same chain tree the derivation classes walk,
			// grafted onto the constraint projection layer.
			if (kind == "external-uc")
			{
				Match xu = Regex.Match(body, @"^For each (.+?), at most one ([\w :]+?) (.+)$");
				if (xu.Success)
				{
					var listNames = Regex.Split(xu.Groups[1].Value, @"\s+and\s+|,")
						.Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
					string subject = xu.Groups[2].Value.Trim();
					var side = ParseSide(subject + " " + xu.Groups[3].Value.Trim());
					if (side != null && side.Count == 2 && listNames.Count >= 2)
					{
						UniquenessConstraint uc = new UniquenessConstraint(myStore);
						uc.Model = myModel;
						uc.Modality = modality;
						if (BuildPathForSequence(uc, side, listNames))
						{
							Count("external uniqueness constraint (join path)");
							myMapLog.Add("external UC built: " + Shorten(s));
							return true;
						}
						uc.Delete();
					}
					// chained legs: split on " and ", each leg either direct
					// ("<pred> that <X>") or one-hop ("<pred> some <M> that
					// <pred2> that <X>"); every clause resolves to a binary
					// fact entry and the chain tree binds variables in order
					// the lazy subject match can split a multi-word type
					// ("Migration" | "Application has ..."): re-derive the
					// subject longest-type-first from the full tail
					string chainTail = xu.Groups[2].Value.Trim() + " " + xu.Groups[3].Value.Trim();
					string chainSubject = null;
					foreach (string key in myTypes.Keys.OrderByDescending(k => k.Length))
					{
						if (chainTail.StartsWith(key + " ", StringComparison.Ordinal)) { chainSubject = key; break; }
					}
					var clauses = new List<SideClause>();
					bool chainOk = chainSubject != null;
					string chainRest = chainOk ? chainTail.Substring(chainSubject.Length + 1) : "";
					foreach (string legRaw in Regex.Split(chainRest.Trim(), @"\s+and\s+"))
					{
						string leg = legRaw.Trim();
						// legs resolve VERBATIM against declared readings after
						// quantifier-stripping — no relocation, no rewriting
						// (ruling 2026-07-17: matching that could hit a wrong
						// predicate is banned). A chained leg splits at its
						// intermediate; both clause texts must BE readings.
						Match ch = Regex.Match(leg, @"^(.+?) some ([\w ]+?) that (.+)$");
						if (ch.Success && myTypes.ContainsKey(ch.Groups[2].Value.Trim()))
						{
							string mid = ch.Groups[2].Value.Trim();
							List<string> pa, pb;
							FactIndexEntry ea = ResolveClause(chainSubject + " " + ch.Groups[1].Value.Trim() + " " + mid, out pa);
							FactIndexEntry eb = ResolveClause(mid + " " + Dequantify(" " + ch.Groups[3].Value.Trim() + " ").Trim(), out pb);
							if (ea == null || eb == null) { chainOk = false; break; }
							clauses.Add(new SideClause { Entry = ea, Players = pa });
							clauses.Add(new SideClause { Entry = eb, Players = pb });
							continue;
						}
						{
							List<string> pd;
							FactIndexEntry ed = ResolveClause(chainSubject + " " + Dequantify(" " + leg + " ").Trim(), out pd);
							if (ed == null) { chainOk = false; break; }
							clauses.Add(new SideClause { Entry = ed, Players = pd });
							continue;
						}
					}
					if (chainOk && clauses.Count >= 2 && listNames.Count >= 2)
					{
						UniquenessConstraint uc = new UniquenessConstraint(myStore);
						uc.Model = myModel;
						uc.Modality = modality;
						if (BuildChainedPathForSequence(uc, chainSubject, clauses, listNames))
						{
							Count("external uniqueness constraint (chained join path)");
							myMapLog.Add("external UC built (chained): " + Shorten(s));
							return true;
						}
						uc.Delete();
					}
				}
				AddNote(kind, s, "external uniqueness beyond the two-clause builder");
				return true;
			}

			// subtype exclusion: {A, B, C} are mutually exclusive subtypes of P
			// — an exclusion constraint over the subtype-fact roles, NORMA's
			// own modeling of exclusive subtypes
			if (kind == "subtype-exclusion")
			{
				Match xm = ExclusiveSubtypes.Match(body + ".");
				if (xm.Success)
				{
					string parent = xm.Groups[2].Value.Trim();
					var sequences = new List<SetComparisonConstraintRoleSequence>();
					foreach (string part in xm.Groups[1].Value.Split(','))
					{
						string child = part.Trim();
						if (child.Length == 0) continue;
						SubtypeFact found = null;
						foreach (SubtypeFact sf in myStore.ElementDirectory.FindElements<SubtypeFact>(true))
						{
							if (!sf.IsDeleted && sf.Subtype != null && sf.Supertype != null &&
								sf.Subtype.Name == child && sf.Supertype.Name == parent)
							{
								found = sf;
								break;
							}
						}
						if (found == null) { sequences = null; break; }
						sequences.Add(null);
						sequences[sequences.Count - 1] = new SetComparisonConstraintRoleSequence(myStore);
					}
					if (sequences != null && sequences.Count >= 2)
					{
						// attach sequences to the exclusion FIRST: NORMA's
						// SubtypeMetaRole rule admits external constraints on
						// subtype roles only when the owning constraint is
						// already an exclusion
						ExclusionConstraint xc = new ExclusionConstraint(myStore);
						xc.Model = myModel;
						foreach (var q in sequences) xc.RoleSequenceCollection.Add(q);
						int i = 0;
						foreach (string part in xm.Groups[1].Value.Split(','))
						{
							string child = part.Trim();
							if (child.Length == 0) continue;
							foreach (SubtypeFact sf in myStore.ElementDirectory.FindElements<SubtypeFact>(true))
							{
								if (!sf.IsDeleted && sf.Subtype != null && sf.Supertype != null &&
									sf.Subtype.Name == child && sf.Supertype.Name == parent)
								{
									// NORMA admits external constraints on the
									// SUPERTYPE meta role only (resx:
									// SupertypeMetaRole.ExclusionMustBeSingleColumn)
									sequences[i].RoleCollection.Add(sf.SupertypeRole.Role);
									break;
								}
							}
							i++;
						}
						Count("exclusion constraint (exclusive subtypes)");
						return true;
					}
				}
				AddNote(kind, s, "subtype facts not found");
				return true;
			}

			// impossibility with a negated relative unary: "It is impossible
			// that <A rel B> that is not <unary>" is the subset B ⊆ unary
			m = Regex.Match(body, @"^It is impossible that (.+?) that is not (.+)$");
			if (m.Success)
			{
				List<string> p1;
				FactIndexEntry c1 = ResolveClause(m.Groups[1].Value, out p1);
				if (c1 != null && p1.Count > 0)
				{
					string lastPlayer = p1[p1.Count - 1];
					List<string> pu;
					FactIndexEntry unary = ResolveClause(lastPlayer + " is " + m.Groups[2].Value.Trim(), out pu);
					if (unary == null)
					{
						unary = ResolveClause(lastPlayer + " " + m.Groups[2].Value.Trim(), out pu);
					}
					if (unary != null && unary.Roles.Count == 1)
					{
						SubsetConstraint sc = new SubsetConstraint(myStore);
						sc.Model = myModel;
						var sub = new SetComparisonConstraintRoleSequence(myStore);
						sub.RoleCollection.Add(c1.Roles[p1.Count - 1]);
						var super = new SetComparisonConstraintRoleSequence(myStore);
						super.RoleCollection.Add(unary.Roles[0]);
						sc.RoleSequenceCollection.Add(sub);
						sc.RoleSequenceCollection.Add(super);
						Count("subset constraint (negated-unary impossibility)");
						myMapLog.Add("subset built (negated-unary): " + Shorten(s));
						return true;
					}
				}
				AddNote(kind, s, "negated-unary form unresolved");
				return true;
			}

			// transitive ring: "If X1 <words> X2 and X2 <words> X3 then X1
			// <words> X3." — the closure-theorem documentation form. A
			// derived transitive closure IS transitive (induction over its
			// base and step rules); declaring TR records the theorem, per
			// Halpin's practice for derived ring fact types (ancestorOf).
			m = Regex.Match(body, @"^If ([\w ]+?)1 (.+?) ([\w ]+?)2 and ([\w ]+?)2 \2 ([\w ]+?)3,? then ([\w ]+?)1 \2 ([\w ]+?)3$");
			if (m.Success)
			{
				string tp = m.Groups[1].Value.Trim();
				if (tp == m.Groups[3].Value.Trim() && tp == m.Groups[4].Value.Trim() &&
					tp == m.Groups[5].Value.Trim() && tp == m.Groups[6].Value.Trim() &&
					tp == m.Groups[7].Value.Trim() && myTypes.ContainsKey(tp))
				{
					FactIndexEntry tring = FindRingEntry(tp, m.Groups[2].Value.Trim());
					if (tring != null)
					{
						BuildRing(tring, "Transitive", modality);
						myMapLog.Add("ring built (transitive, closure theorem): " + Shorten(s));
						return true;
					}
				}
				AddNote(kind, s, "transitive form unresolved");
				return true;
			}

			// impossibility as exclusion: It is impossible that <c1> and <c2>
			m = Regex.Match(body, @"^It is impossible that (.+?) and (.+)$");
			if (m.Success)
			{
				List<string> p1, p2;
				FactIndexEntry c1 = ResolveClause(m.Groups[1].Value, out p1);
				FactIndexEntry c2 = ResolveClause(m.Groups[2].Value, out p2);
				if (c1 != null && c2 != null && c1 != c2)
				{
					// a clause binding the shared player at MORE than one of
					// its own roles is a self-join ("reaches THAT Derivation
					// Rule" — the diagonal); a single-column sequence would
					// silently overstate it (forbid reaching ANYTHING). The
					// content is the stratification theorem the canon's
					// law:finiteness executes — defer, never misbuild.
					var shared = p1.Intersect(p2).Distinct().ToList();
					if (shared.Count == 1 &&
						(p1.Count(x => x == shared[0]) > 1 || p2.Count(x => x == shared[0]) > 1))
					{
						AddNote(kind, s, "self-join clause (stratification theorem; executes as law:finiteness — a single-column exclusion would overstate it)");
						return true;
					}
					if (shared.Count == 1)
					{
						ExclusionConstraint ec = new ExclusionConstraint(myStore);
						ec.Model = myModel;
						var s1 = new SetComparisonConstraintRoleSequence(myStore);
						var s2 = new SetComparisonConstraintRoleSequence(myStore);
						s1.RoleCollection.Add(c1.Roles[p1.IndexOf(shared[0])]);
						s2.RoleCollection.Add(c2.Roles[p2.IndexOf(shared[0])]);
						ec.RoleSequenceCollection.Add(s1);
						ec.RoleSequenceCollection.Add(s2);
						Count("exclusion constraint (impossibility form)");
						return true;
					}
				}
				AddNote(kind, s, "self-join or unresolved clauses");
				return true;
			}

			// disjunctive mandatory: Each K <w1> or <w2>
			m = Regex.Match(body, @"^Each ([\w :]+?) (.+?) or (.+)$");
			if (m.Success && myTypes.ContainsKey(m.Groups[1].Value.Trim()))
			{
				string k = m.Groups[1].Value.Trim();
				List<string> pa, pb;
				FactIndexEntry fa = ResolveClause(k + " " + m.Groups[2].Value.Trim(), out pa);
				FactIndexEntry fb = ResolveClause(k + " " + m.Groups[3].Value.Trim(), out pb);
				if (fa != null && fb != null)
				{
					MandatoryConstraint mc = new MandatoryConstraint(myStore);
					mc.Model = myModel;
					mc.RoleCollection.Add(fa.Roles[pa.IndexOf(k)]);
					mc.RoleCollection.Add(fb.Roles[pb.IndexOf(k)]);
					mc.Modality = modality;
					Count("disjunctive mandatory constraint");
					return true;
				}
			}
			// disjunctive mandatory, inverse phrasing: "For each K, some A
			// <p> that K or some B <q> that K" — the K roles of the two
			// facts, one must be played
			m = Regex.Match(body, @"^For each ([\w :]+?), some ([\w :]+?) (.+?) that \1 or some ([\w :]+?) (.+?) that \1$");
			if (m.Success && myTypes.ContainsKey(m.Groups[1].Value.Trim()))
			{
				string k = m.Groups[1].Value.Trim();
				List<string> pa, pb;
				FactIndexEntry fa = ResolveClause("some " + m.Groups[2].Value.Trim() + " " + m.Groups[3].Value.Trim() + " some " + k, out pa);
				FactIndexEntry fb = ResolveClause("some " + m.Groups[4].Value.Trim() + " " + m.Groups[5].Value.Trim() + " some " + k, out pb);
				if (fa != null && fb != null && pa.Contains(k) && pb.Contains(k))
				{
					MandatoryConstraint mc = new MandatoryConstraint(myStore);
					mc.Model = myModel;
					mc.RoleCollection.Add(fa.Roles[pa.IndexOf(k)]);
					mc.RoleCollection.Add(fb.Roles[pb.IndexOf(k)]);
					mc.Modality = modality;
					Count("disjunctive mandatory constraint (for-each inverse)");
					return true;
				}
			}

			AddNote(kind, s, kind == "deontic" ? "qualified deontic prose" : "no direct construction");
			if (kind == "deontic")
			{
				// deontic player resolution: prose deontics never mint types,
				// so a capitalized phrase that resolves to NO declared type is
				// a reference nothing anchors ('Tesla Vehicle Offer') - the
				// class the minted-by-usage report structurally cannot see
				string bare = Regex.Replace(s, @"'[^']*'", " ");
				foreach (Match pm in Regex.Matches(bare, @"\b([A-Z][a-z\w]*(?: [A-Z][a-z\w]*)+)\b"))
				{
					string phrase = pm.Groups[1].Value;
					bool known = myTypes.ContainsKey(phrase);
					if (!known)
					{
						// try successively shorter prefixes - the phrase may
						// embed a known type plus trailing reading words
						string[] words = phrase.Split(' ');
						for (int take = words.Length; take >= 1 && !known; take--)
							if (myTypes.ContainsKey(string.Join(" ", words.Take(take)))) known = true;
					}
					if (!known && phrase.EndsWith("s"))
					{
						// plural of a declared type resolves
						known = myTypes.ContainsKey(phrase.Substring(0, phrase.Length - 1));
					}
					if (!known)
					{
						// a phrase INSIDE a declared name is that name misread
						// ('Data Processing' in 'Personal Data Processing');
						// a phrase EXTENDING a declared name ('Tesla Vehicle
						// Offer' over 'Vehicle Offer') is the undeclared-
						// subtype pattern and MUST flag - one direction only
						foreach (string t in myTypes.Keys)
						{
							if ((" " + t + " ").Contains(" " + phrase + " "))
							{ known = true; break; }
						}
					}
					if (!known && !phrase.StartsWith("It ") && !phrase.StartsWith("Each "))
						myUnresolvedDeonticRefs.Add(phrase);
				}
			}
			return true;
		}

		// deontic prose phrases that resolve to no declared type - reported,
		// never blocking (deontics are adjudication surfaces by design)
		private static readonly SortedSet<string> myUnresolvedDeonticRefs = new SortedSet<string>(StringComparer.Ordinal);

		private static List<UniquenessConstraint> InternalUCs(FactType fact)
		{
			var found = new List<UniquenessConstraint>();
			foreach (RoleBase rb in fact.RoleCollection)
			{
				Role r = rb.Role;
				foreach (ConstraintRoleSequence seq in r.ConstraintRoleSequenceCollection)
				{
					UniquenessConstraint uc = seq.Constraint as UniquenessConstraint;
					if (uc != null && uc.IsInternal && !found.Contains(uc)) found.Add(uc);
				}
			}
			return found;
		}

		// implication-aware internal-UC creation. A same-roles UC is a duplicate;
		// an existing tighter UC (subset of the span) implies the wider one; an
		// existing wider UC is itself implied by the new tighter span and is
		// removed (NORMA reports implied internal UCs as model errors, so a
		// green model cannot carry both — the census records every skip).
		private void AddInternalUC(FactType fact, IList<Role> span, ConstraintModality modality, string kind)
		{
			foreach (UniquenessConstraint existing in InternalUCs(fact))
			{
				var existingRoles = existing.RoleCollection;
				bool existingWithinSpan = true;
				foreach (Role r in existingRoles)
				{
					if (!span.Contains(r)) { existingWithinSpan = false; break; }
				}
				if (existingWithinSpan)
				{
					Count(existingRoles.Count == span.Count
						? "uniqueness skipped (duplicate of existing UC)"
						: "uniqueness skipped (implied by tighter UC)");
					return;
				}
				bool spanWithinExisting = true;
				foreach (Role r in span)
				{
					if (!existingRoles.Contains(r)) { spanWithinExisting = false; break; }
				}
				if (spanWithinExisting)
				{
					existing.Delete();
					Count("uniqueness narrowed (implied wider UC removed)");
					break;
				}
			}
			UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(fact);
			foreach (Role r in span) uc.RoleCollection.Add(r);
			uc.Modality = modality;
			Count(kind);
		}

		private void AddSimpleMandatory(Role role, ConstraintModality modality, string kind)
		{
			foreach (ConstraintRoleSequence seq in role.ConstraintRoleSequenceCollection)
			{
				MandatoryConstraint existing = seq.Constraint as MandatoryConstraint;
				if (existing != null && existing.IsSimple)
				{
					Count("mandatory skipped (role already mandatory)");
					return;
				}
			}
			MandatoryConstraint mc = MandatoryConstraint.CreateSimpleMandatoryConstraint(role);
			mc.Modality = modality;
			Count(kind);
		}

		private bool MapConstraint(string s, ConstraintModality modality)
		{
			string body = s.TrimEnd('.');
			List<string> players = myLastPlayers;
			List<Role> roles = myLastRoles;
			// external uniqueness routes by FORM, not by resolution: a
			// for-each list of two or more DECLARED types queues for the
			// join-path build directly (the dead fit-scorer had been the
			// accidental vehicle here — form-routing is the deterministic
			// replacement, no target guessing involved)
			{
				Match xm2 = Regex.Match(body, @"^For each (.+?), (?:at most one|exactly one) ");
				if (xm2.Success && !body.StartsWith("For each combination"))
				{
					var names2 = Regex.Split(xm2.Groups[1].Value, @"\s+and\s+|,")
						.Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
					if (names2.Count >= 2 && names2.TrueForAll(n2 => myTypes.ContainsKey(n2)))
					{
						myTextual.Add(new KeyValuePair<string, string>("external-uc", s));
						Count("external uniqueness (queued for join-path build)");
						return true;
					}
				}
			}
			// combination UC: "For each combination of A and B, that A <reading>
			// that B at most once" — NORMA's own m:n spanning-UC phrasing. The
			// inner clause must resolve VERBATIM (dequantified) to a declared
			// reading; no context, no scoring.
			{
				Match cm = Regex.Match(body, @"^For each combination of ([\w :]+?) and ([\w :]+?), (.+?) at most once$");
				if (cm.Success)
				{
					List<string> cps;
					FactIndexEntry ce = ResolveClause(Dequantify(" " + cm.Groups[3].Value.Trim() + " ").Trim(), out cps);
					string ca = cm.Groups[1].Value.Trim(), cb = cm.Groups[2].Value.Trim();
					if (ce != null && cps.Contains(ca) && cps.Contains(cb))
					{
						var span = RolesFor(new List<string> { ca, cb }, ce.Players, ce.Roles);
						if (span != null)
						{
							AddInternalUC(ce.Fact, span, modality, "spanning uniqueness (combination form)");
							return true;
						}
					}
					AddNote("uniqueness", s, "combination form did not resolve verbatim");
					return true;
				}
			}
			FactType target = myLastFact;
			// cross-context constraint: a sentence keeps the running context
			// only while the context fact's reading words fit at least as well
			// as any fact in the index. Prefix-match alone is not enough — a
			// constraint after the last reading of a section ("Each Domain
			// Change proposes some Function." following the unary "Domain
			// Change is applied.") shares the leading player with the wrong
			// fact and must retarget by reading words.
			{
				// "In each population of <reading>, each ..." NAMES its fact —
				// resolve the target from the reading text directly; the
				// fit-scorer must never shop a self-addressed constraint
				Match popm = Regex.Match(body, @"^In each population of (.+?), [Ee]ach ");
				if (popm.Success)
				{
					string readingRef = popm.Groups[1].Value.Trim();
					string working = " " + readingRef + " ";
					var refPlayers = new List<string>();
					foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
					{
						int at = 0;
						while ((at = working.IndexOf(name, at, StringComparison.Ordinal)) >= 0)
						{
							bool leftOk = !char.IsLetterOrDigit(working[at - 1]);
							int end = at + name.Length;
							bool rightOk = end >= working.Length || !char.IsLetterOrDigit(working[end]);
							if (leftOk && rightOk)
							{
								refPlayers.Add(name);
								working = working.Substring(0, at) + new string((char)1, name.Length) + working.Substring(end);
								at = end;
							}
							else at++;
						}
					}
					string refWords = NormalizeWords(Regex.Replace(working, "+", " "));
					foreach (FactIndexEntry entry in myFactIndex)
					{
						if (entry.Players.Count != refPlayers.Count) continue;
						if (!string.Equals(NormalizeWords(entry.ReadingWords), refWords, StringComparison.Ordinal)) continue;
						var sortedA = entry.Players.OrderBy(x => x, StringComparer.Ordinal);
						var sortedB = refPlayers.OrderBy(x => x, StringComparer.Ordinal);
						if (!sortedA.SequenceEqual(sortedB, StringComparer.Ordinal)) continue;
						players = entry.Players;
						roles = entry.Roles;
						target = entry.Fact;
						break;
					}
				}
				// exact-sentence fast path: quantifiers stripped, the body IS
				// some reading's players-interleaved sentence (NORMA inserts
				// the quantifier before a hyphen-bound role: "Each Transition
				// is exactly one to Status" is the is-to- reading) — an exact
				// match is BINDING and beats every fit heuristic
				bool resolved = popm.Success && target != null;
				if (!resolved)
				{
					string exactKey = Regex.Replace(body, @"^(Each|For each)\s+", "");
					exactKey = Regex.Replace(exactKey, @"\b(exactly one|at most one|at most once|some|each|that)\b", " ");
					exactKey = NormalizeWords(exactKey);
					foreach (FactIndexEntry entry in myFactIndex)
					{
						if (string.Equals(entry.FullKey, exactKey, StringComparison.Ordinal))
						{
							players = entry.Players;
							roles = entry.Roles;
							target = entry.Fact;
							resolved = true;
							break;
						}
					}
				}
				// no fit scoring, no synonyms, no guessing (ruling 2026-07-17:
				// automatic matching that could hit a wrong predicate is
				// banned). The cross-context resolver is SORTED-EXACT: strip
				// the quantifier tokens, extract the player multiset
				// longest-type-first, and bind only when exactly ONE fact
				// type carries the same players and the same residual reading
				// words. Anything else refuses, and the source moves toward
				// a declared reading.
				if (!resolved)
				{
					string working2 = " " + body + " ";
					working2 = Regex.Replace(working2, @"\b(For each|Each|exactly one|at most one|at most once|some|that|each)\b", " ");
					var bodyPlayers = new List<string>();
					foreach (string name in myTypes.Keys.OrderByDescending(n => n.Length))
					{
						int at2 = 0;
						while ((at2 = working2.IndexOf(name, at2, StringComparison.Ordinal)) >= 0)
						{
							bool leftOk = !char.IsLetterOrDigit(working2[at2 - 1]);
							int end2 = at2 + name.Length;
							bool rightOk = end2 >= working2.Length || !char.IsLetterOrDigit(working2[end2]);
							if (leftOk && rightOk)
							{
								bodyPlayers.Add(name);
								working2 = working2.Substring(0, at2) + new string((char)1, name.Length) + working2.Substring(end2);
								at2 = end2;
							}
							else at2++;
						}
					}
					string residual = NormalizeWords(Regex.Replace(working2, "+", " ").Replace(",", " "));
					var sortedBody = bodyPlayers.OrderBy(x => x, StringComparer.Ordinal).ToList();
					FactIndexEntry only = null;
					int hits = 0;
					foreach (FactIndexEntry entry in myFactIndex)
					{
						if (entry.Fact.IsDeleted) continue;
						var sortedE = entry.Players.OrderBy(x => x, StringComparer.Ordinal).ToList();
						bool playersMatch = sortedE.SequenceEqual(sortedBody, StringComparer.Ordinal);
						if (!playersMatch && sortedBody.Count == sortedE.Count + 1)
						{
							// a for-each sentence names one player twice
							var reduced = new List<string>(sortedBody);
							foreach (string p in entry.Players)
							{
								if (reduced.Count(x => x == p) >= 2) { reduced.Remove(p); break; }
							}
							playersMatch = reduced.OrderBy(x => x, StringComparer.Ordinal)
								.SequenceEqual(sortedE, StringComparer.Ordinal);
						}
						if (!playersMatch) continue;
						if (!string.Equals(NormalizeWords(entry.ReadingWords), residual, StringComparison.Ordinal)) continue;
						only = entry;
						hits++;
					}
					if (hits == 1)
					{
						players = only.Players;
						roles = only.Roles;
						target = only.Fact;
						resolved = true;
						Count("constraint resolved cross-context (sorted-exact)");
						myMapLog.Add("resolved (sorted-exact): '" + Shorten(s) + "' -> [" + string.Join(", ", only.Players) + "] '" + only.ReadingWords + "'");
					}
				}
				// unresolved and the context fact does not prefix-match the
				// sentence: refuse rather than bind the wrong context
				if (!resolved)
				{
					string probe = body.StartsWith("For each ") ? body.Substring(9) : body.StartsWith("Each ") ? body.Substring(5) : body;
					if (!(players != null && FindPlayerPrefix(probe, players) >= 0))
					{
						target = null;
					}
				}
			}

			if (target == null || roles == null)
			{
				return false;
			}
			// spanning UC: "Each A, B combination occurs at most once in the population of ..."
			Match m = Regex.Match(body, @"^(?:In each population of .*?, )?[Ee]ach (.+?) combination occurs at most once");
			if (m.Success)
			{
				var namesInList = m.Groups[1].Value.Split(',').Select(x => x.Trim()).ToList();
				var span = RolesFor(namesInList, players, roles);
				if (span == null) return false;
				AddInternalUC(target, span, modality, "spanning uniqueness");
				return true;
			}

			// "For each pair/combination of A and B, ... at most once" : spanning UC
			m = Regex.Match(body, @"^For each (?:pair|combination) of (.+?),");
			if (m.Success && (body.Contains("at most once") || body.Contains("at most one")))
			{
				var listNames = Regex.Split(m.Groups[1].Value, @"\s+and\s+|,").Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
				var span = RolesFor(listNames, players, roles);
				if (span == null) return false;
				AddInternalUC(target, span, modality, "spanning uniqueness (pair form)");
				return true;
			}

			// "For each X [and Y], (exactly one|at most one|some) Z ..." : the
			// listed players are the key; exactly-one adds mandatory on them.
			m = Regex.Match(body, @"^For each (.+?)(,| that| some| exactly| at)");
			if (m.Success)
			{
				var listNames = Regex.Split(m.Groups[1].Value, @"\s+and\s+|,").Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
				string tail = body.Substring(m.Groups[1].Index + m.Groups[1].Length);
				string quantF =
					tail.Contains("exactly one") ? "exactly one" :
					tail.Contains("at most one") || tail.Contains("at most once") ? "at most one" :
					Regex.IsMatch(tail, @"\bsome\b") ? "some" : null;
				if (quantF == null) return false;
				var span = RolesFor(listNames, players, roles);
				if (span == null)
				{
					// the listed players span more than one fact type: an
					// EXTERNAL uniqueness (built with its join path in the
					// textual phase, when every fact exists)
					if (quantF != "some" && body.Contains(" and "))
					{
						myTextual.Add(new KeyValuePair<string, string>("external-uc", s));
						Count("external uniqueness (queued for join-path build)");
						return true;
					}
					return false;
				}
				if (span.Count == roles.Count)
				{
					// "For each A and B, that A ... that B at most once" over the whole fact
					AddInternalUC(target, span, modality, "spanning uniqueness (for-each all-roles)");
					return true;
				}
				if (quantF == "exactly one" || quantF == "at most one")
				{
					AddInternalUC(target, span, modality, "uniqueness (for-each form)");
				}
				if (quantF == "exactly one" || quantF == "some")
				{
					AddSimpleMandatory(span[0], modality, "mandatory (for-each form)");
				}
				return true;
			}

			// simple forms, player-driven: "Each <player> ... <quantifier> ..."
			if (body.StartsWith("Each "))
			{
				string rest = body.Substring(5);
				int keyIdx = FindPlayerPrefix(rest, players);
				if (keyIdx >= 0)
				{
					string remainder = rest;
					string quant =
						remainder.Contains("exactly one") ? "exactly one" :
						remainder.Contains("at most one") ? "at most one" :
						remainder.Contains("at most once") ? "at most once" :
						System.Text.RegularExpressions.Regex.IsMatch(remainder, @"\bsome\b") ? "some" :
						remainder.Contains(" each ") ? "each" : null;
					if (quant == null) return false;
					// no-guessing: with the quantifier removed, the sentence must
					// RESTATE one of the target fact's readings (players
					// interleaved, hyphen binding absorbed). A subject-player
					// match alone must never bind a constraint onto a fact whose
					// reading it does not restate — nf machinery sentences
					// (refmode expansions whose readings are skipped) dangle
					// after myLastFact and would otherwise narrow a wrong
					// fact's UC.
					if (quant == "exactly one" || quant == "at most one" || quant == "some")
					{
						int qAt, qLen;
						if (quant == "some")
						{
							var qm = System.Text.RegularExpressions.Regex.Match(remainder, @"\bsome\b");
							qAt = qm.Index; qLen = 4;
						}
						else
						{
							qAt = remainder.IndexOf(quant, StringComparison.Ordinal); qLen = quant.Length;
						}
						string candidate = remainder.Substring(0, qAt) + remainder.Substring(qAt + qLen);
						if (!RestatesReading(target, candidate)) return false;
					}
					var span = new List<Role> { roles[keyIdx] };
					// "at most one Y per Z" / "at most one Y for each Z" widen
					// the key to include Z (the n-1 span of an n-ary fact)
					var perMatch = System.Text.RegularExpressions.Regex.Match(remainder, @"(?: per | for each )([-\w :]+)$");
					if (perMatch.Success)
					{
						for (int i = 0; i < players.Count; i++)
						{
							if (i != keyIdx && string.Equals(players[i], perMatch.Groups[1].Value.Trim(), StringComparison.Ordinal))
							{
								span.Add(roles[i]);
							}
						}
						if (quant == "each") quant = "at most one";
					}
					if (quant == "at most once" || quant == "each")
					{
						AddInternalUC(target, roles, modality, "spanning uniqueness (set restriction)");
						return true;
					}
					if (quant == "exactly one" || quant == "at most one")
					{
						AddInternalUC(target, span, modality, "uniqueness (each-form)");
					}
					if (quant == "exactly one" || quant == "some")
					{
						AddSimpleMandatory(span[0], modality, "mandatory");
					}
					return true;
				}
				return false;
			}
			return false;
		}

		// longest player whose name (optionally preceded by a hyphen-bound
		// adjective like "value-type- ") prefixes the text
		// the constraint sentence, quantifier removed, must equal one of the
		// fact's readings with players interleaved (FullKey), normalized the
		// same way — hyphen binding absorbed, whitespace collapsed
		private bool RestatesReading(FactType fact, string candidate)
		{
			string want = NormalizeWords(candidate);
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Fact == fact && entry.FullKey == want) return true;
			}
			return false;
		}

		private static int FindPlayerPrefix(string text, List<string> players)
		{
			int best = -1, bestLen = -1;
			for (int i = 0; i < players.Count; i++)
			{
				string p = players[i];
				if (p.Length > bestLen &&
					(text.StartsWith(p + " ", StringComparison.Ordinal) ||
					 text.StartsWith(p + ",", StringComparison.Ordinal) ||
					 System.Text.RegularExpressions.Regex.IsMatch(text, @"^[-\w]+- " + System.Text.RegularExpressions.Regex.Escape(p) + " ")))
				{
					best = i;
					bestLen = p.Length;
				}
			}
			return best;
		}

		private List<Role> RolesFor(List<string> names, List<string> players, List<Role> roles)
		{
			var result = new List<Role>();
			var used = new bool[players.Count];
			foreach (string rawName in names)
			{
				string name = Regex.Replace(rawName, @"^(that|some|the)\s+", "").Trim();
				// NORMA subscripts repeated players in generated constraint
				// text (Status1, Status2); the subscript is display only
				name = Regex.Replace(name, @"(\D)\d$", "$1");
				int found = -1;
				for (int i = 0; i < players.Count; i++)
				{
					if (!used[i] && string.Equals(players[i], name, StringComparison.Ordinal))
					{
						found = i;
						break;
					}
				}
				if (found < 0)
				{
					// try suffix match: "value-type- Name" ~ "Name"
					for (int i = 0; i < players.Count; i++)
					{
						if (!used[i] && (players[i].EndsWith(" " + name) || name.EndsWith(" " + players[i])))
						{
							found = i;
							break;
						}
					}
				}
				if (found < 0) return null;
				used[found] = true;
				result.Add(roles[found]);
			}
			return result;
		}
		#endregion

		#region design-state and table export (checker cross-check inputs)
		// exec ruling 2: no JSON where meaning lives. The interchange
		// artifacts are INTERSECTION SOURCE — the same registration-call
		// dialect as the canon, evaluated by any host's two-line vocabulary
		// binding. Chunk convention: collection positions (the fts list,
		// each pop, the otpops list, each column list) ride as chunks of at
		// most nine, and consumers flatten exactly one level; fixed-shape
		// positions (the 5-slot descriptor, a row, a uc span) are direct
		// S-constructors.
		private static string IAtom(string s)
		{
			if (s.IndexOf('"') >= 0)
			{
				throw new InvalidOperationException("double quote in atom: " + s);
			}
			return "A(\"" + s + "\")";
		}

		private static string ISeq(List<string> elements)
		{
			if (elements.Count == 0) return "PHI()";
			if (elements.Count <= 9)
			{
				return "S" + elements.Count + "(" + string.Join(", ", elements) + ")";
			}
			var chunks = new List<string>();
			for (int i = 0; i < elements.Count; i += 9)
			{
				chunks.Add(ISeq(elements.Skip(i).Take(9).ToList()));
			}
			return ISeq(chunks);
		}

		// Backus 13.2 rule 4: a sequence has arbitrary length n. S(...) is the
		// arity-free spelling; S1..S9 is notation, not mathematics. Used where a
		// sequence must stay FLAT regardless of length, so that length is never
		// encoded as depth — depth already means tenancy here (backus78 14.7,
		// AREST.tex prop:tenant).
		private static string IFlatSeq(List<string> elements)
		{
			if (elements.Count == 0) return "PHI()";
			if (elements.Count <= 9)
			{
				return "S" + elements.Count + "(" + string.Join(", ", elements) + ")";
			}
			return "S(" + string.Join(", ", elements) + ")";
		}

		// a chunked collection: ALWAYS one level of chunk wrapping, even for
		// nine or fewer elements, so consumers uniformly flatten once
		private static string IChunked(List<string> elements)
		{
			if (elements.Count == 0) return "S1(PHI())";
			var chunks = new List<string>();
			for (int i = 0; i < elements.Count; i += 9)
			{
				chunks.Add(ISeq(elements.Skip(i).Take(9).ToList()));
			}
			// the OUTER sequence must stay flat: ISeq would re-chunk above nine
			// chunks (>81 elements) and silently add a second level, breaking the
			// "consumers uniformly flatten once" contract stated above. That is
			// what crashed law:exclusion on auto.dev (~130 object types).
			return IFlatSeq(chunks);
		}

		private static string TopSupertype(ObjectType t)
		{
			var seen = new HashSet<ObjectType>();
			while (t != null && seen.Add(t))
			{
				ObjectType super = null;
				foreach (ObjectType s in t.SupertypeCollection)
				{
					super = s;
					break;
				}
				if (super == null) return t.Name;
				t = super;
			}
			return t == null ? "" : t.Name;
		}

		// the CSDP/RMAP design state as the canon defs consume it, in the
		// intersection dialect. Each fact type: descriptor
		// S5(name, players, ucs, mands, pop) — players top-collapsed (RMAP
		// 10.3 step 0; identification already flows to the root per the
		// one-reference-scheme ruling), ucs as 1-based positions, pop the
		// attributed instance rows (chunked). state:nestings pairs
		// objectified fact names with their nesting types; state:otpops the
		// per-kind entity populations (population inclusion materialized up
		// the subtype chain); state:declared carries the DECLARED players
		// alongside for consumers that need pre-collapse names.
		// The carrier paths are RELATIVE, so the working directory chooses which
		// station gets overwritten. Run from a station's directory by mistake and
		// its certified inputs are replaced by whatever the given sources happen
		// to describe - silently, and with exit 0. That has happened once: an
		// 8797-byte model landed on a 513856-byte artifact and only a hand-made
		// backup saved it. So say where the bytes are going, and refuse a
		// collapse outright unless it is asked for.
		private static void WriteCarrier(string path, string content)
		{
			string full = System.IO.Path.GetFullPath(path);
			long had = System.IO.File.Exists(full) ? new System.IO.FileInfo(full).Length : 0L;
			long now = System.Text.Encoding.UTF8.GetByteCount(content);
			Console.WriteLine("  writing " + full + "  (" + had + " -> " + now + " bytes)");
			if (had > 0 && now * 4 < had &&
				string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AREST_ORACLE_ALLOW_SHRINK")))
			{
				throw new InvalidOperationException(
					"refusing to shrink " + full + " from " + had + " to " + now +
					" bytes. This usually means the working directory is a station whose" +
					" sources are not the ones being read. Set AREST_ORACLE_ALLOW_SHRINK=1" +
					" if the collapse is intended.");
			}
			System.IO.File.WriteAllText(full, content);
		}

		public void WriteDesignState(string path, string extraCells = null)
		{
			// Declaration Order: position is DATA (2026-07-17 ruling — the
			// core mechanism for mapping a data type to a list or a form).
			// Source order fills it; an explicit instance row SETS it and
			// wins. Emitted as integers (the value type is integer-typed)
			// so ordering never rides lexicographic luck.
			{
				FactIndexEntry fthdo = null;
				foreach (FactIndexEntry e in myFactIndex)
					if (!e.Fact.IsDeleted && e.Fact.Name == "FactTypeHasDeclarationOrder") { fthdo = e; break; }
				if (fthdo != null)
				{
					var have = new HashSet<string>(StringComparer.Ordinal);
					foreach (var row in fthdo.Rows) if (row.Count == 2) have.Add(row[0]);
					int ord = 0;
					foreach (FactIndexEntry e in myFactIndex)
					{
						if (e.Fact.IsDeleted) continue;
						ord++;
						if (myFullyDerived.Contains(e.Fact)) continue;
						if (!have.Contains(e.Fact.Name))
						{
							fthdo.Rows.Add(new List<string> { e.Fact.Name, ord.ToString() });
							fthdo.RowKinds.Add(new List<string> { "", "" });
						}
					}
				}
			}
			var fts = new List<string>();
			var declared = new List<string>();
			var nestings = new List<string>();
			var otpops = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Fact.IsDeleted) continue;
				// Codd 1970 1.5: fully derived fact types are strong
				// redundancy as stored relations — they leave the stored
				// schema; their meaning is their (deferred) rule
				if (myFullyDerived.Contains(entry.Fact)) continue;
				string name = IAtom(entry.Fact.Name);
				var tops = new List<string>();
				var decls = new List<string>();
				for (int i = 0; i < entry.Roles.Count; i++)
				{
					ObjectType player = entry.Roles[i].RolePlayer;
					tops.Add(IAtom(player == null ? entry.Players[i] : TopSupertype(player)));
					decls.Add(IAtom(entry.Players[i]));
				}
				var ucs = new List<string>();
				foreach (UniquenessConstraint uc in InternalUCs(entry.Fact))
				{
					var positions = new List<string>();
					bool complete = true;
					foreach (Role r in uc.RoleCollection)
					{
						int at = entry.Roles.IndexOf(r);
						if (at < 0) { complete = false; break; }
						positions.Add("N(" + (at + 1) + ")");
					}
					if (complete && positions.Count > 0) ucs.Add(ISeq(positions));
				}
				bool intSecond = entry.Fact.Name == "FactTypeHasDeclarationOrder";
				var rows = new List<string>();
				for (int r = 0; r < entry.Rows.Count; r++)
				{
					rows.Add(ISeq(entry.Rows[r].Select((v, ci) =>
						intSecond && ci == 1 && System.Text.RegularExpressions.Regex.IsMatch(v, "^[0-9]+$")
							? "N(" + v + ")" : IAtom(v)).ToList()));
					for (int i = 0; i < entry.Rows[r].Count; i++)
					{
						string kind = entry.RowKinds[r][i];
						if (kind.Length == 0) continue;
						ObjectType t;
						myTypes.TryGetValue(kind, out t);
						while (true)
						{
							HashSet<string> set;
							if (!otpops.TryGetValue(kind, out set)) otpops[kind] = set = new HashSet<string>(StringComparer.Ordinal);
							set.Add(entry.Rows[r][i]);
							if (t == null) break;
							ObjectType super = null;
							foreach (ObjectType sup in t.SupertypeCollection) { super = sup; break; }
							if (super == null) break;
							kind = super.Name;
							t = super;
						}
					}
				}
				fts.Add("S5(" + name + ", " + ISeq(tops) + ", " + (ucs.Count == 0 ? "PHI()" : ISeq(ucs)) + ", PHI(), " + IChunked(rows) + ")");
				declared.Add("S2(" + name + ", " + ISeq(decls) + ")");
				ObjectType nesting = entry.Fact.NestingType;
				if (nesting != null)
				{
					nestings.Add("S2(" + name + ", " + IAtom(nesting.Name) + ")");
				}
			}
			var pops = otpops.OrderBy(kv => kv.Key, StringComparer.Ordinal)
				.Select(kv => "S2(" + IAtom(kv.Key) + ", " + IChunked(kv.Value.OrderBy(x => x, StringComparer.Ordinal).Select(IAtom).ToList()) + ")")
				.ToList();
			var sb = new System.Text.StringBuilder();
			sb.Append("(\n");
			sb.Append("\"THE DESIGN STATE in INTERSECTION SOURCE (generated by norma-oracle; regenerate, never edit). state:fts — one S5 descriptor per parsed fact type: name, players (top-collapsed), ucs (1-based positions), mands (phi), pop (attributed instance rows). state:declared pairs each name with its declared players; state:nestings pairs objectified fact names with their nesting types; state:otpops the per-kind entity populations, inclusion materialized up the subtype chain; state:derived pairs each derivation-marked name with its mode (full/stored/semi/subtype) — the marker surface the closure law reads against rules:metamodel; state:exclusions holds one scope-list per exclusion constraint (population name + 1-based positions; a subtype-meta scope names the child extent). state:rules — every NORMA-built app derivation rule as (name, recipe) in the rules:metamodel grammar (join/proj), the executable surface the canon closure runs beside rules:metamodel. Chunk convention: state:fts, each pop, each otpop, and state:declared/state:nestings/state:derived/state:rules are chunked — consumers flatten exactly one level; descriptors, rows, and uc spans are direct.\",\n\n");
			sb.Append("DEF(\"state:fts\", ").Append(IChunked(fts)).Append("),\n\n");
			sb.Append("DEF(\"state:declared\", ").Append(IChunked(declared)).Append("),\n\n");
			sb.Append("DEF(\"state:nestings\", ").Append(IChunked(nestings)).Append("),\n\n");
			sb.Append("DEF(\"state:otpops\", ").Append(IChunked(pops)).Append("),\n\n");
			// the derivation surface: every derivation-marked name with its
			// mode — 'full' (*), 'stored' (**), 'semi' (+), 'subtype'
			// (Fig 13.29 form). The
			// marker-closure law reads this against rules:metamodel targets:
			// no marker without a deliverer, no rule without a declared head.
			var derivedPairs = new List<string>();
			foreach (FactType f in myFullyDerived)
				if (!f.IsDeleted) derivedPairs.Add("S2(" + IAtom(f.Name) + ", " + IAtom("full") + ")");
			foreach (FactType f in myStoredDerived)
				if (!f.IsDeleted && !myFullyDerived.Contains(f)) derivedPairs.Add("S2(" + IAtom(f.Name) + ", " + IAtom("stored") + ")");
			foreach (FactType f in mySemiDerived)
				if (!f.IsDeleted && !myFullyDerived.Contains(f)) derivedPairs.Add("S2(" + IAtom(f.Name) + ", " + IAtom("semi") + ")");
			foreach (string n in mySubtypeDerived)
				derivedPairs.Add("S2(" + IAtom(n) + ", " + IAtom("subtype") + ")");
			derivedPairs.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:derived\", ").Append(IChunked(derivedPairs)).Append("),\n\n");
			// the executable rule surface: every NORMA-built app derivation
			// rule as (name, recipe) in the rules:metamodel grammar, so the
			// canon's closure machinery derives app populations from the
			// same vocabulary induce emits. Chunked like its siblings.
			sb.Append("DEF(\"state:rules\", ").Append(IChunked(myRuleRecipes)).Append("),\n\n");
			// ring constraints per fact type (name, ring type): the alethic
			// gate surface abduction filters hidden facts against
			sb.Append("DEF(\"state:rings\", ").Append(myRingRows.Count == 0 ? "S1(PHI())" : IChunked(myRingRows)).Append("),\n\n");
			// the verbalization surface: every fact type's reading as
			// (name, players, template-words) — slots "{i}" interleave with
			// players so a row renders as its own FORML instance sentence
			// (synthesize is read's inverse; the output re-ingests)
			var readingRows = new List<string>();
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (entry.Fact.IsDeleted) continue;
				var ps = new List<string>();
				foreach (string p in entry.Players) ps.Add(IAtom(p));
				var ws = new List<string>();
				foreach (string w in entry.ReadingText.Split(' '))
					if (w.Length > 0) ws.Add(IAtom(w));
				// template words chunk uniformly (groups of <=9, single group
				// included); the canon flattens exactly one level
				var groups = new List<string>();
				for (int g = 0; g < ws.Count; g += 9)
				{
					int n = Math.Min(9, ws.Count - g);
					groups.Add("S" + n + "(" + string.Join(", ", ws.GetRange(g, n)) + ")");
				}
				readingRows.Add("S3(" + IAtom(entry.Fact.Name) + ", S" + ps.Count + "("
					+ string.Join(", ", ps) + "), " + (groups.Count == 0 ? "S1(PHI())" :
					"S" + groups.Count + "(" + string.Join(", ", groups) + ")") + ")");
			}
			sb.Append("DEF(\"state:readings\", ").Append(IChunked(readingRows)).Append("),\n\n");
			// the scheme facts' generated readings: reference-scheme facts
			// stay out of state:readings (membership semantics above), but
			// NAMEGEN reads their NORMA-generated '{0} has {1}' when naming
			// columns - the naming walk needs the same surface
			var indexedFacts = new HashSet<FactType>();
			foreach (FactIndexEntry entry in myFactIndex)
				if (entry.Fact != null) indexedFacts.Add(entry.Fact);
			var schemeReadingRows = new List<string>();
			foreach (var sf in mySchemeFacts)
			{
				FactIndexEntry entry = sf.Value;
				if (entry.Fact == null || entry.Fact.IsDeleted || indexedFacts.Contains(entry.Fact)) continue;
				var sps = new List<string>();
				foreach (string p0 in entry.Players) sps.Add(IAtom(p0));
				var sws = new List<string>();
				foreach (string w in entry.ReadingText.Split(' '))
					if (w.Length > 0) sws.Add(IAtom(w));
				var sgroups = new List<string>();
				for (int g = 0; g < sws.Count; g += 9)
				{
					int n = Math.Min(9, sws.Count - g);
					sgroups.Add("S" + n + "(" + string.Join(", ", sws.GetRange(g, n)) + ")");
				}
				schemeReadingRows.Add("S3(" + IAtom(entry.Fact.Name) + ", S" + sps.Count + "("
					+ string.Join(", ", sps) + "), " + (sgroups.Count == 0 ? "S1(PHI())" :
					"S" + sgroups.Count + "(" + string.Join(", ", sgroups) + ")") + ")");
			}
			schemeReadingRows.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:schemereadings\", ").Append(schemeReadingRows.Count == 0 ? "S1(PHI())" : IChunked(schemeReadingRows)).Append("),\n\n");
			// the exclusion surface: one entry per ExclusionConstraint, each a
			// list of scopes (population name, 1-based positions). A scope over
			// a SubtypeFact's supertype meta role resolves to the SUBTYPE
			// EXTENT (the child's entity population, column 1); a scope over
			// ordinary roles resolves to the owning fact type's population.
			// law:exclusion verifies all pairwise projected intersections
			// empty; cmd:excl_viols enforces the same at create.
			var exclusions = new List<string>();
			foreach (ExclusionConstraint xc in myStore.ElementDirectory.FindElements<ExclusionConstraint>(true))
			{
				if (xc.IsDeleted) continue;
				var scopes = new List<string>();
				bool ok = true;
				foreach (SetComparisonConstraintRoleSequence seq in xc.RoleSequenceCollection)
				{
					var byFact = new Dictionary<FactIndexEntry, List<int>>();
					string subtypeScope = null;
					foreach (Role r in seq.RoleCollection)
					{
						SubtypeFact sf = r.FactType as SubtypeFact;
						if (sf != null && sf.Subtype != null)
						{
							subtypeScope = sf.Subtype.Name;
							continue;
						}
						FactIndexEntry home = null;
						foreach (FactIndexEntry e in myFactIndex)
							if (!e.Fact.IsDeleted && e.Fact == r.FactType) { home = e; break; }
						if (home == null) { ok = false; break; }
						List<int> pos;
						if (!byFact.TryGetValue(home, out pos)) byFact[home] = pos = new List<int>();
						pos.Add(home.Roles.IndexOf(r) + 1);
					}
					if (!ok) break;
					if (subtypeScope != null)
					{
						scopes.Add("S2(" + IAtom(subtypeScope) + ", S1(N(1)))");
					}
					foreach (var kv in byFact)
					{
						scopes.Add("S2(" + IAtom(kv.Key.Fact.Name) + ", " +
							ISeq(kv.Value.Select(p => "N(" + p + ")").ToList()) + ")");
					}
				}
				if (ok && scopes.Count >= 2) exclusions.Add(ISeq(scopes));
			}
			exclusions.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:exclusions\", ").Append(exclusions.Count == 0 ? "PHI()" : IChunked(exclusions)).Append("),\n\n");
			// hyphen-bound role qualifiers, one mechanism both sides: NORMA
			// holds them in the reading text; the carrier mirrors them so
			// canon consumers (rendered labels) read the SAME data
			var quals = new List<string>();
			foreach (FactIndexEntry qe in myFactIndex)
			{
				if (qe.Fact.IsDeleted || myFullyDerived.Contains(qe.Fact)) continue;
				var perRole = new List<string>();
				bool anyq = false;
				for (int ri = 0; ri < qe.Roles.Count; ri++)
				{
					var qm = System.Text.RegularExpressions.Regex.Match(qe.ReadingText,
						@"(\w+)- \{" + ri + @"\}");
					if (qm.Success) { perRole.Add(IAtom(qm.Groups[1].Value)); anyq = true; }
					else perRole.Add(IAtom(""));
				}
				if (anyq) quals.Add("S2(" + IAtom(qe.Fact.Name) + ", " + ISeq(perRole) + ")");
			}
			sb.Append("DEF(\"state:qualifiers\", ").Append(quals.Count == 0 ? "PHI()" : IChunked(quals)).Append(")");
			if (!string.IsNullOrEmpty(extraCells))
			{
				sb.Append(",\n\n").Append(extraCells.TrimEnd().TrimEnd(','));
			}
			sb.Append("\n)\n");
			WriteCarrier(path, sb.ToString());
		}

		public static void WriteNormaAnswer(Store store, System.Reflection.Assembly relationalAssembly, System.Reflection.Assembly abstractionAssembly, System.Reflection.Assembly dcilBridgeAssembly, string path, HashSet<string> excludeFullyDerived)
		{
			Type tableType = relationalAssembly.GetTypes().First(x => x.Name == "Table" && typeof(ModelElement).IsAssignableFrom(x));
			// D.3's structural certification target: each column's RECORDED
			// concept-type-child path (ColumnHasConceptTypeChild - stage 2
			// stores the chain; NAMEGEN:1207 walks it, never recomputes).
			Type colPathLinkType = dcilBridgeAssembly == null ? null : dcilBridgeAssembly.GetTypes().FirstOrDefault(x => x.Name == "ColumnHasConceptTypeChild" && typeof(ModelElement).IsAssignableFrom(x));
			var pathAccessor = colPathLinkType == null ? null : colPathLinkType.GetMethod("GetLinksToConceptTypeChildPath",
				System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
			Type ctType2 = abstractionAssembly == null ? null : abstractionAssembly.GetTypes().First(x => x.Name == "ConceptType" && typeof(ModelElement).IsAssignableFrom(x));
			var tables = store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(tableType), true)
				.Cast<ModelElement>()
				.OrderBy(t => (string)tableType.GetProperty("Name").GetValue(t, null), StringComparer.Ordinal)
				.ToList();
			var entries = new List<string>();
			var colPaths = new List<string>();
			var constraintRows = new List<string>();
			foreach (ModelElement table in tables)
			{
				string tableName = (string)tableType.GetProperty("Name").GetValue(table, null);
				// Codd 1970 1.5, mirrored on the NORMA side: NORMA has no
				// rule bodies (the * rules are deferred), so its DCIL still
				// materializes fully derived fact types; the answer surface
				// excludes them symmetrically with the design state
				if (excludeFullyDerived != null && excludeFullyDerived.Contains(tableName)) continue;
				var columns = (System.Collections.IEnumerable)tableType.GetProperty("ColumnCollection").GetValue(table, null);
				var colNames = new List<string>();
				foreach (object col in columns)
				{
					string colName = (string)col.GetType().GetProperty("Name").GetValue(col, null);
					colNames.Add(IAtom(colName));
					if (pathAccessor == null) continue;
					var steps = new List<string>();
					bool indicator = false;
					foreach (object link in (System.Collections.IEnumerable)pathAccessor.Invoke(null, new object[] { col }))
					{
						var linkType = link.GetType();
						var indProp = linkType.GetProperty("AbsorptionIndicator");
						if (indProp != null && (bool)indProp.GetValue(link, null)) indicator = true;
						object child = linkType.GetProperty("ConceptTypeChild").GetValue(link, null);
						string kind = child.GetType().Name == "ConceptTypeAssimilatesConceptType" ? "assim"
							: child.GetType().Name == "InformationType" ? "info" : "rel";
						object cparent = (child.GetType().GetProperty("Parent") ?? child.GetType().GetProperty("ConceptType")).GetValue(child, null);
						object ctarget = child.GetType().GetProperty("Target").GetValue(child, null);
						string pnm = cparent == null ? "" : (string)cparent.GetType().GetProperty("Name").GetValue(cparent, null);
						string tnm = ctarget == null ? "" : (string)ctarget.GetType().GetProperty("Name").GetValue(ctarget, null);
						string cnm = "";
						var np = child.GetType().GetProperty("Name");
						if (np != null) { object v = np.GetValue(child, null); cnm = v == null ? "" : v.ToString(); }
						steps.Add("S4(" + IAtom(kind) + ", " + IAtom(pnm) + ", " + IAtom(tnm) + ", " + IAtom(cnm) + ")");
					}
					colPaths.Add("S4(" + IAtom(tableName) + ", " + IAtom(colName)
						+ ", " + IAtom(indicator ? "T" : "F")
						+ ", " + (steps.Count == 0 ? "PHI()" : "S" + steps.Count + "(" + string.Join(", ", steps) + ")") + ")");
				}
				entries.Add("S2(" + IAtom(tableName) + ", " + IChunked(colNames) + ")");
				// the constraint surface: PK/UC rows S4(kind, table, name,
				// cols); FK rows S5("fk", table, name, sourceCols, target)
				var ucCollProp = tableType.GetProperty("UniquenessConstraintCollection");
				if (ucCollProp != null)
				{
					foreach (object uc in (System.Collections.IEnumerable)ucCollProp.GetValue(table, null))
					{
						var ucType = uc.GetType();
						string ucName = (string)ucType.GetProperty("Name").GetValue(uc, null);
						bool primary = false;
						var pProp = ucType.GetProperty("IsPrimary");
						if (pProp != null) primary = (bool)pProp.GetValue(uc, null);
						var ucCols = new List<string>();
						foreach (object c in (System.Collections.IEnumerable)ucType.GetProperty("ColumnCollection").GetValue(uc, null))
							ucCols.Add(IAtom((string)c.GetType().GetProperty("Name").GetValue(c, null)));
						constraintRows.Add("S4(" + IAtom(primary ? "pk" : "uc") + ", " + IAtom(tableName)
							+ ", " + IAtom(ucName) + ", " + (ucCols.Count == 0 ? "PHI()" : "S" + ucCols.Count + "(" + string.Join(", ", ucCols) + ")") + ")");
					}
				}
				var rcCollProp = tableType.GetProperty("ReferenceConstraintCollection");
				if (rcCollProp != null)
				{
					foreach (object rc in (System.Collections.IEnumerable)rcCollProp.GetValue(table, null))
					{
						var rcType = rc.GetType();
						string rcName = (string)rcType.GetProperty("Name").GetValue(rc, null);
						object tgt = rcType.GetProperty("TargetTable").GetValue(rc, null);
						string tgtName = tgt == null ? "" : (string)tgt.GetType().GetProperty("Name").GetValue(tgt, null);
						var srcCols = new List<string>();
						var crProp = rcType.GetProperty("ColumnReferenceCollection");
						if (crProp != null)
						{
							foreach (object cr in (System.Collections.IEnumerable)crProp.GetValue(rc, null))
							{
								object sc = cr.GetType().GetProperty("SourceColumn").GetValue(cr, null);
								srcCols.Add(IAtom((string)sc.GetType().GetProperty("Name").GetValue(sc, null)));
							}
						}
						constraintRows.Add("S5(" + IAtom("fk") + ", " + IAtom(tableName)
							+ ", " + IAtom(rcName) + ", " + (srcCols.Count == 0 ? "PHI()" : "S" + srcCols.Count + "(" + string.Join(", ", srcCols) + ")")
							+ ", " + IAtom(tgtName) + ")");
					}
				}
			}
			var sb = new System.Text.StringBuilder();
			sb.Append("(\n");
			sb.Append("\"NORMA'S RMAP ANSWER in INTERSECTION SOURCE (generated by norma-oracle; regenerate, never edit). norma:tables — one S2 per relational table: name, columns. norma:colpaths — one S4 per column: table, name, absorptionIndicator, S(steps) with step S4(kind, parent, target, childName): the recorded ConceptTypeChild chain stage 2 stores and the name generator walks. norma:constraints — S4(pk|uc, table, name, cols) and S5(fk, table, name, sourceCols, targetTable). Chunked; consumers flatten one level.\",\n\n");
			sb.Append("DEF(\"norma:tables\", ").Append(IChunked(entries)).Append("),\n\n");
			sb.Append("DEF(\"norma:colpaths\", ").Append(colPaths.Count == 0 ? "S1(PHI())" : IChunked(colPaths)).Append("),\n\n");
			sb.Append("DEF(\"norma:constraints\", ").Append(constraintRows.Count == 0 ? "S1(PHI())" : IChunked(constraintRows)).Append(")\n");
			sb.Append(")\n");
			WriteCarrier(path, sb.ToString());
		}
		#endregion

		#region reporting
		public static void DumpErrors(Store store, TextWriter w)
		{
			// No whitelist. The former ring-twin class (duplicate link-reading
			// signatures on same-player m:n facts) is FIXED at the source by
			// DisambiguateRingLinkReadings; any survivor is a real error.
			var groups = new Dictionary<string, List<string>>();
			foreach (ModelError err in store.ElementDirectory.FindElements<ModelError>(true))
			{
				string kind = err.GetDomainClass().Name;
				string text = err.ErrorText;
				List<string> list;
				if (!groups.TryGetValue(kind, out list)) groups[kind] = list = new List<string>();
				list.Add(text);
			}
			int total = 0;
			foreach (var kv in groups.OrderByDescending(g => g.Value.Count))
			{
				total += kv.Value.Count;
				w.WriteLine("  {0} x{1}", kv.Key, kv.Value.Count);
				foreach (string text in kv.Value.Take(8))
				{
					w.WriteLine("      - " + text);
				}
				if (kv.Value.Count > 8) w.WriteLine("      ... and " + (kv.Value.Count - 8) + " more");
			}
			w.WriteLine(total == 0 ? "  (none)" : "  TOTAL BLOCKING ERRORS: " + total);
			// the silent class: role players invented by usage with no
			// declaration sentence anywhere - each composes as an accidental
			// value type and hides a modeling intent nobody wrote down
			var minted = new List<string>();
			foreach (string name in myMintedNames)
			{
				if (!myDeclaredNames.Contains(name)) minted.Add(name);
			}
			if (myMintedPrinted) minted.Clear();
			myMintedPrinted = true;
			if (minted.Count > 0)
			{
				minted.Sort(StringComparer.Ordinal);
				w.WriteLine("== types minted by usage, never declared ==");
				foreach (string name in minted) w.WriteLine("  " + name);
			}
			if (myUnresolvedDeonticRefs.Count > 0 && !myDeonticRefsPrinted)
			{
				myDeonticRefsPrinted = true;
				w.WriteLine("== deontic references resolving to no declared type ==");
				foreach (string phrase in myUnresolvedDeonticRefs) w.WriteLine("  " + phrase);
			}
		}
		private static bool myDeonticRefsPrinted;

		// NORMA implies an objectification for every compound-UC fact type and
		// gives each role a binary link fact type reading "{0} involves {1}" /
		// "{0} is involved in {1}". On a fact type where several roles share a
		// player, those generated readings are textually identical, so their
		// expanded signatures collide and NORMA raises
		// DuplicateReadingSignatureError per colliding text. The readings are
		// ordinary Reading elements — editable, exactly as a modeler would do
		// in the UI — so the honest resolution is distinct texts, not a
		// whitelist: each same-player group gets ordinal-qualified link
		// readings ("involves first", "involves second", ...). Returns one log
		// line per rewritten link fact type.
		public static List<string> DisambiguateRingLinkReadings(Store store)
		{
			var log = new List<string>();
			string[] ord = { "first", "second", "third", "fourth", "fifth" };
			foreach (Objectification obj in store.ElementDirectory.FindElements<Objectification>(true))
			{
				// group link fact types by far-role player
				var byPlayer = new Dictionary<ObjectType, List<FactType>>();
				foreach (FactType link in obj.ImpliedFactTypeCollection)
				{
					ObjectType far = null;
					foreach (RoleBase rb in link.RoleCollection)
					{
						Role r = rb.Role;
						if (r != null && r.RolePlayer != null && r.RolePlayer != obj.NestingType)
							far = r.RolePlayer;
					}
					if (far == null) continue;
					List<FactType> list;
					if (!byPlayer.TryGetValue(far, out list)) byPlayer[far] = list = new List<FactType>();
					list.Add(link);
				}
				foreach (var kv in byPlayer)
				{
					if (kv.Value.Count < 2) continue;
					for (int i = 0; i < kv.Value.Count; i++)
					{
						FactType link = kv.Value[i];
						string q = ord[Math.Min(i, ord.Length - 1)];
						int rewrote = 0;
						foreach (ReadingOrder ro in link.ReadingOrderCollection)
						{
							foreach (Reading r in ro.ReadingCollection)
							{
								string t = r.Text;
								// idempotent: an already-qualified reading
								// (an earlier pass) must not qualify again
								if (Regex.IsMatch(t, @" involves (?:first|second|third|fourth|fifth) | is involved (?:first|second|third|fourth|fifth) in "))
									continue;
								string nt = t;
								if (t.Contains(" involves "))
									nt = t.Replace(" involves ", " involves " + q + " ");
								else if (t.Contains(" is involved in "))
									nt = t.Replace(" is involved in ", " is involved " + q + " in ");
								if (nt != t) { r.Text = nt; rewrote++; }
							}
						}
						log.Add(obj.NestingType.Name + " link[" + kv.Key.Name + " #" + (i + 1) + "]: "
							+ (rewrote > 0 ? rewrote + " reading(s) ordinal-qualified '" + q + "'"
							               : "no generated readings present"));
					}
				}
			}
			return log;
		}

		// INPUT FIDELITY FOR THE DERIVATION MARKERS (rmap-algorithm.md
		// Section 0; GATE:181-201 is the consumer): '+' semiderived states
		// sufficient-not-necessary conditions, so asserted rows persist -
		// PartiallyDerived, which the gateway always keeps. '**' stored is
		// materialized by the arest runtime, external to NORMA's own
		// derivation engine - ExternalDerivation + Stored, the one
		// combination GATE:188 exempts from exclusion. Bare '*' is
		// FullyDerived + NotStored - gateway-excluded, derived at read
		// time. Precedence mirrors the state:derived emission: a fact
		// marked both full and semi is full.
		private void ApplyDerivationMarkers(FactType fact, FactTypeDerivationRule rule)
		{
			if (myStoredDerived.Contains(fact))
			{
				rule.DerivationCompleteness = DerivationCompleteness.FullyDerived;
				rule.DerivationStorage = DerivationStorage.Stored;
				rule.ExternalDerivation = true;
			}
			else if (mySemiDerived.Contains(fact) && !myFullyDerived.Contains(fact))
			{
				rule.DerivationCompleteness = DerivationCompleteness.PartiallyDerived;
				rule.DerivationStorage = DerivationStorage.NotStored;
			}
			else
			{
				rule.DerivationCompleteness = DerivationCompleteness.FullyDerived;
				rule.DerivationStorage = DerivationStorage.NotStored;
			}
		}

		private string DescribeDerivation(FactType fact)
		{
			if (myStoredDerived.Contains(fact)) return "fully derived, STORED (external)";
			if (mySemiDerived.Contains(fact) && !myFullyDerived.Contains(fact)) return "semiderived";
			return "fully derived, not stored";
		}

		// NORMA'S OWN STAGE-1 DECISIONS AS CARRIER CELLS - the per-decision
		// certification targets for the canon rmap transcription
		// (rmap-algorithm.md): state:normamap = each decided fact-type
		// mapping <factName, towardsPlayer, depth>; state:normacts = the
		// concept types <name, topLevel>; state:normaassim = assimilations
		// <assimilatorName, assimilatedName, refersToSubtype>. Emitted by
		// reflection over the abstraction/bridge assemblies (the
		// DumpRelational pattern), appended to the design-state text.
		// THE ALGORITHM'S INPUTS (rmap-algorithm.md section A): everything
		// stage 1 consumes that state:fts does not carry. state:mapinputs -
		// one row per non-deleted binary fact type: <factName, role1, role2,
		// facttypeFlags> where each role = <player, kind, unique, preferred,
		// mandatoryClass, identifiesOpposite, inOwnPid, hyphenPrefix
		// ('' when the reading binds nothing)> and facttypeFlags =
		// <subtype, unary, objectificationImplied, derivationCompleteness
		// none|full|partial, derivationStorage none|stored|notstored,
		// externalDerivation T|F> - the last three are GATE:181-201's
		// inputs; canon's rmap:gate implements the exclusion predicate
		// (FullyDerived && (!External || NotStored), subtypes exempt) and
		// filters mapinputs before stage 1. state:otmeta - one row
		// per object type: <name, kind, independent>.
		// The role's hyphen-bound prefix from the fact's reading text
		// (ResolveRoleName's lexical INPUT, OMIFORM:1681-1763): the
		// maximal run of '-'-terminated tokens immediately before the
		// role's placeholder, hyphens stripped, space-joined; '' when
		// unbound. The mu vocabulary has no character-suffix surgery,
		// so the lex belongs here beside state:readings' own tokenizer;
		// the ALGORITHM (side choice, swap, default, join) stays canon.
		private string HyphenPrefixFor(FactType ft, Role r)
		{
			// Search by ROLE membership, not by the querying fact: an
			// objectification's implied link fact holds role proxies whose
			// Role resolves to the ORIGINAL fact's role - and the hyphen
			// binding lives on the original reading (the one NORMA's
			// ResolveRoleName consults).
			foreach (FactIndexEntry entry in myFactIndex)
			{
				if (!entry.Roles.Contains(r)) continue;
				int idx = entry.Roles.IndexOf(r);
				if (idx < 0 || string.IsNullOrEmpty(entry.ReadingText)) return "";
				string slot = "{" + idx + "}";
				string[] toks = entry.ReadingText.Split(' ');
				for (int i = 0; i < toks.Length; i++)
				{
					if (toks[i] != slot) continue;
					var words = new List<string>();
					int j = i - 1;
					while (j >= 0 && toks[j].EndsWith("-", StringComparison.Ordinal) && toks[j].Length > 1)
					{
						words.Insert(0, toks[j].Substring(0, toks[j].Length - 1));
						j--;
					}
					return string.Join(" ", words);
				}
				return "";
			}
			return "";
		}

		private static string IMemberSeq(List<string> members)
		{
			if (members.Count == 0) return "PHI()";
			if (members.Count <= 9)
				return "S" + members.Count + "(" + string.Join(", ", members) + ")";
			return IChunked(members);
		}

		// A constraint's identity in the MODEL is its ordered member roles plus the
		// flags that distinguish two constraints over the same roles. NORMA hands
		// out InternalUniquenessConstraint<N> / ImpliedMandatoryConstraint<N> in a
		// deferred rule pass whose internal order it does not fix, so that name
		// binds to a different constraint on every run, and a surface sorted by it
		// is a stable sort over an unstable key. Building the emitted name from
		// model content instead makes state:ucs and state:djmands reproducible.
		private static string CanonicalConstraintKey(string kind, string flags, List<string> members)
		{
			return kind + ":" + flags + ":" + string.Join("+", members);
		}

		// Injectivity is the whole requirement for a key canon only ever joins on,
		// so a collision must not be papered over: sort by key and give each repeat
		// a deterministic ordinal. Two alethic constraints over identical roles with
		// identical flags should not occur; if they do, the surface stays stable and
		// keeps them distinct rather than merging two rows into one.
		private static List<KeyValuePair<string, string>> DisambiguateKeys(
			List<KeyValuePair<string, string>> keyed)
		{
			keyed.Sort(delegate(KeyValuePair<string, string> x, KeyValuePair<string, string> y)
			{
				int c = StringComparer.Ordinal.Compare(x.Key, y.Key);
				return c != 0 ? c : StringComparer.Ordinal.Compare(x.Value, y.Value);
			});
			var outRows = new List<KeyValuePair<string, string>>(keyed.Count);
			string prev = null;
			int dup = 0;
			foreach (KeyValuePair<string, string> kv in keyed)
			{
				if (kv.Key == prev)
				{
					dup++;
					outRows.Add(new KeyValuePair<string, string>(kv.Key + ":" + dup, kv.Value));
				}
				else
				{
					prev = kv.Key;
					dup = 0;
					outRows.Add(kv);
				}
			}
			return outRows;
		}

		private static List<string> MemberKeyParts(LinkedElementCollection<Role> roles)
		{
			var parts = new List<string>();
			foreach (Role mr in roles)
			{
				FactType kft = mr.BinarizedOrSameFactType;
				if (kft == null) continue;
				int kpos = 0;
				for (int i = 0; i < kft.RoleCollection.Count; i++)
					if (kft.RoleCollection[i].Role == mr) { kpos = i + 1; break; }
				parts.Add(kft.Name + "#" + kpos);
			}
			return parts;
		}

		public string InputStateCells()
		{
			var rows = new List<string>();
			foreach (FactType ft in myStore.ElementDirectory.FindElements<FactType>(true))
			{
				// objectified ORIGINALS ride the surface too (their role
				// mandatories are D.4's evidence inputs); flag 7 marks them and
				// canon's rmap:gate excludes them from mapping exactly where
				// NORMA does (ShouldIgnoreFactType's Objectification arm,
				// rmap-algorithm.md 0.1)
				if (ft.IsDeleted) continue;
				LinkedElementCollection<RoleBase> rc = ft.RoleCollection;
				bool isSubtype = ft is SubtypeFact;
				bool isUnary = ft.UnaryPattern != UnaryValuePattern.NotUnary;
				if (rc.Count != 2 && !isUnary) continue;
				var roleInfos = new List<string>();
				foreach (RoleBase rb in rc)
				{
					Role r = rb.Role;
					if (r == null || r.RolePlayer == null) { roleInfos.Add("PHI()"); continue; }
					ObjectType p = r.RolePlayer;
					UniquenessConstraint suc = null;
					MandatoryConstraint smc = null;
					foreach (ConstraintRoleSequence seq in r.ConstraintRoleSequenceCollection)
					{
						UniquenessConstraint uc = seq as UniquenessConstraint;
						if (uc != null && uc.IsInternal && uc.Modality == ConstraintModality.Alethic
							&& uc.RoleCollection.Count == 1) suc = uc;
						MandatoryConstraint mc = seq as MandatoryConstraint;
						if (mc != null && mc.Modality == ConstraintModality.Alethic
							&& mc.RoleCollection.Count == 1) smc = mc;
					}
					string mand = smc == null ? "none" : (smc.IsImplied ? "implied" : "explicit");
					Role opp = null;
					foreach (RoleBase ob in rc) { if (ob.Role != r) { opp = ob.Role; break; } }
					bool identifiesOpp = false;
					if (opp != null && opp.RolePlayer != null)
					{
						UniquenessConstraint oppPid = opp.RolePlayer.PreferredIdentifier;
						if (oppPid != null) identifiesOpp = oppPid.RoleCollection.Contains(r);
					}
					// PERM:1178-1187 excludes a functional role when the OPPOSITE
					// role carries the uniqueness constraint that is this object
					// type's preferred identifier ("opposite part of the preferred
					// identifier for this ObjectType", rmap-algorithm.md:111) - so
					// the membership test takes opp, not r. A preferred identifier's
					// roles are played by the identifying value types, never by the
					// identified entity, so Contains(r) was false on every row of
					// every station (7587 of 7587).
					bool inOwnPid = false;
					UniquenessConstraint ownPid = p.PreferredIdentifier;
					if (ownPid != null && opp != null) inOwnPid = ownPid.RoleCollection.Contains(opp);
					roleInfos.Add("S8(" + IAtom(p.Name) + ", " + IAtom(p.IsValueType ? "value" : "entity")
						+ ", " + IAtom(suc != null ? "T" : "F")
						+ ", " + IAtom(suc != null && suc.IsPreferred ? "T" : "F")
						+ ", " + IAtom(mand)
						+ ", " + IAtom(identifiesOpp ? "T" : "F")
						+ ", " + IAtom(inOwnPid ? "T" : "F")
						+ ", " + IAtom(HyphenPrefixFor(ft, r)) + ")");
				}
				while (roleInfos.Count < 2) roleInfos.Add("PHI()");
				var dr = ft.DerivationRule as FactTypeDerivationRule;
				string dcomp = dr == null ? "none"
					: (dr.DerivationCompleteness == DerivationCompleteness.PartiallyDerived ? "partial" : "full");
				string dstore = dr == null ? "none"
					: (dr.DerivationStorage == DerivationStorage.Stored ? "stored" : "notstored");
				rows.Add("S4(" + IAtom(ft.Name) + ", " + roleInfos[0] + ", " + roleInfos[1]
					+ ", S7(" + IAtom(isSubtype ? "T" : "F") + ", " + IAtom(isUnary ? "T" : "F")
					+ ", " + IAtom(ft.ImpliedByObjectification != null ? "T" : "F")
					+ ", " + IAtom(dcomp) + ", " + IAtom(dstore)
					+ ", " + IAtom(dr != null && dr.ExternalDerivation ? "T" : "F")
					+ ", " + IAtom(ft.Objectification != null ? "T" : "F") + "))");
			}
			rows.Sort(StringComparer.Ordinal);
			// THE UNIQUENESS SURFACE (GenerateUniqueness's input,
			// OMIFORM:1508-1632): every alethic uniqueness constraint with
			// its ordered member roles as (factName, 1-based role position);
			// state:ucs - S4(name, isPreferred, internal, S(members)).
			var ucRows = new List<string>();
			var ucKeyed = new List<KeyValuePair<string, string>>();
			foreach (UniquenessConstraint uc in myStore.ElementDirectory.FindElements<UniquenessConstraint>(true))
			{
				if (uc.IsDeleted || uc.Modality != ConstraintModality.Alethic) continue;
				var members = new List<string>();
				bool ok = true;
				foreach (Role mr in uc.RoleCollection)
				{
					FactType mft = mr.BinarizedOrSameFactType;
					if (mft == null) { ok = false; break; }
					int pos = 0;
					for (int i = 0; i < mft.RoleCollection.Count; i++)
						if (mft.RoleCollection[i].Role == mr) { pos = i + 1; break; }
					if (pos == 0) { ok = false; break; }
					members.Add("S2(" + IAtom(mft.Name) + ", N(" + pos + "))");
				}
				if (!ok || members.Count == 0) continue;
				ucKeyed.Add(new KeyValuePair<string, string>(
					CanonicalConstraintKey("UC",
						(uc.IsInternal ? "i" : "e") + (uc.IsPreferred ? "p" : "n"),
						MemberKeyParts(uc.RoleCollection)),
					", " + IAtom(uc.IsPreferred ? "T" : "F")
						+ ", " + IAtom(uc.IsInternal ? "T" : "F")
						+ ", " + IMemberSeq(members) + ")"));
			}
			foreach (var kv in DisambiguateKeys(ucKeyed))
				ucRows.Add("S4(" + IAtom(kv.Key) + kv.Value);
			ucRows.Sort(StringComparer.Ordinal);
			// THE DISJUNCTIVE-MANDATORY SURFACE (AssimilationIsSelfEvident's
			// completion arm, ASM:242-296): every alethic NON-simple
			// mandatory constraint with its ordered members as (factName,
			// 1-based role position) - state:djmands, S2(name, S(members)),
			// the state:ucs pattern.
			var djRows = new List<string>();
			var djKeyed = new List<KeyValuePair<string, string>>();
			foreach (MandatoryConstraint mc in myStore.ElementDirectory.FindElements<MandatoryConstraint>(true))
			{
				if (mc.IsDeleted || mc.Modality != ConstraintModality.Alethic || mc.IsSimple) continue;
				var members = new List<string>();
				bool ok = true;
				foreach (Role mr in mc.RoleCollection)
				{
					FactType mft = mr.BinarizedOrSameFactType;
					if (mft == null) { ok = false; break; }
					int pos = 0;
					for (int i = 0; i < mft.RoleCollection.Count; i++)
						if (mft.RoleCollection[i].Role == mr) { pos = i + 1; break; }
					if (pos == 0) { ok = false; break; }
					members.Add("S2(" + IAtom(mft.Name) + ", N(" + pos + "))");
				}
				if (!ok || members.Count == 0) continue;
				djKeyed.Add(new KeyValuePair<string, string>(
					CanonicalConstraintKey("DJ", mc.IsImplied ? "i" : "e",
						MemberKeyParts(mc.RoleCollection)),
					", " + IAtom(mc.IsImplied ? "T" : "F")
						+ ", " + IMemberSeq(members) + ")"));
			}
			foreach (var kv in DisambiguateKeys(djKeyed))
				djRows.Add("S3(" + IAtom(kv.Key) + kv.Value);
			djRows.Sort(StringComparer.Ordinal);
			// NO DECLARATION ORDINAL HERE. A position from model.ObjectTypeCollection
			// rode in this row briefly (af5bf95b). NORMA does walk that collection to
			// build oialModel.ConceptTypeCollection (OMIFORM:1083-1102), and the DCIL
			// bridge walks THAT to add each table's constraints (DCILFIXUP:518-531),
			// so the mechanism the ordinal was reaching for is real. The COLLECTION is
			// not a sound source for it: two runs of this binary over identical sources
			// put eight of a hundred and ninety-one object types at different positions,
			// and all eight are objectified fact types - present in state:nestings, one
			// and all. Types the parse leg creates keep their order; types created when
			// a fact type is objectified are ordered by whatever the fixup pass happens
			// to visit first. An unstable field in a carrier is worse than a missing
			// one: it costs the design state its byte-reproducibility, and byte-identical
			// derivation is how a station is proved. If declaration order is wanted, it
			// has to come from the harness's own sentence sequence, which is ordered and
			// deterministic, not from a collection assembled after fixup.
			var ots = new List<string>();
			foreach (ObjectType ot in myStore.ElementDirectory.FindElements<ObjectType>(true))
			{
				if (ot.IsDeleted) continue;
				ots.Add("S3(" + IAtom(ot.Name) + ", " + IAtom(ot.IsValueType ? "value" : "entity")
					+ ", " + IAtom(ot.TreatAsIndependent ? "T" : "F") + ")");
			}
			ots.Sort(StringComparer.Ordinal);
			// THE DECLARATION-ORDER SURFACE (the played-role/collection
			// order every OIAL/DCIL child loop follows - OMIFORM:1145-1168
			// iterates PlayedRoleCollection, DCILFIXUP:910-995 iterates the
			// child link collections, both creation-ordered): every fact
			// type (subtype and implied included) with its position in the
			// model's element enumeration. UNSORTED - the order IS the row.
			// ... with ONE stabilisation, and it is narrower than it looks.
			// The implied fact types NORMA generates for an objectification are
			// materialised by a deferred rule pass whose internal order it does
			// not fix, so state:factorder is not reproducible. Measured, the
			// permutation swaps WHOLE GROUPS - an objectification's implied set
			// moving as a unit - while each group's internal sequence is
			// preserved. Canon is sensitive to the WITHIN-group order (it reads
			// this surface through cn:foidx to number uniqueness constraints) and
			// insensitive to the BETWEEN-group order (two natural permutations
			// derive byte-identically). NORMA is insensitive to both, reaching
			// these facts through the concept type structure rather than the
			// enumeration.
			// So: order the GROUPS by their objectification and leave each
			// group's members exactly as enumerated. Sorting the members instead
			// - the obvious move, and the one tried first - interleaves different
			// objectifications and destroys the one thing canon does read.
			var foFacts = new List<FactType>();
			foreach (FactType ft in myStore.ElementDirectory.FindElements<FactType>(true))
			{
				if (ft.IsDeleted || string.IsNullOrEmpty(ft.Name)) continue;
				foFacts.Add(ft);
			}
			Func<FactType, string> groupKey = delegate(FactType ft)
			{
				Objectification o = ft.ImpliedByObjectification;
				if (o == null) return null;
				FactType nested = o.NestedFactType;
				return nested != null && !string.IsNullOrEmpty(nested.Name) ? nested.Name : "";
			};
			for (int i = 0; i < foFacts.Count; )
			{
				if (groupKey(foFacts[i]) == null) { i++; continue; }
				int j = i;
				while (j < foFacts.Count && groupKey(foFacts[j]) != null) j++;
				// OrderBy is a STABLE sort, which is the whole point: groups move,
				// members within a group keep their enumeration order.
				var run = foFacts.GetRange(i, j - i)
					.OrderBy(groupKey, StringComparer.Ordinal).ToList();
				for (int k = 0; k < run.Count; k++) foFacts[i + k] = run[k];
				i = j;
			}
			var foRows = new List<string>();
			int foIndex = 0;
			foreach (FactType ft in foFacts)
			{
				foIndex++;
				foRows.Add("S2(" + IAtom(ft.Name) + ", N(" + foIndex + "))");
			}
			var sb = new System.Text.StringBuilder();
			sb.Append("DEF(\"state:mapinputs\", ").Append(IChunked(rows)).Append("),\n\n");
			sb.Append("DEF(\"state:otmeta\", ").Append(IChunked(ots)).Append("),\n\n");
			sb.Append("DEF(\"state:ucs\", ").Append(ucRows.Count == 0 ? "S1(PHI())" : IChunked(ucRows)).Append("),\n\n");
			sb.Append("DEF(\"state:djmands\", ").Append(djRows.Count == 0 ? "S1(PHI())" : IChunked(djRows)).Append("),\n\n");
			sb.Append("DEF(\"state:factorder\", ").Append(foRows.Count == 0 ? "S1(PHI())" : IChunked(foRows)).Append("),\n\n");
			// THE REFERENCE-MODE SURFACE (ReferenceModeNaming.cs 3026-3031:
			// Popular refmodes name as {Entity}{RefMode} both uses; General/
			// UnitBased name FK references as the BARE entity and pid columns
			// as the VALUE TYPE name): per entity with a reference mode -
			// (entity, modeName, kind popular|unitbased|general, valueTypeName).
			// Subtype resolution (the C# alternateEntityType semantics:
			// name from the subtype, KIND from the pattern carrier): climb
			// supertypes until an own scheme is found, then emit under the
			// SUBTYPE's name. Composite/no-scheme entities stay absent.
			var rmRows = new List<string>();
			foreach (ObjectType ot in myStore.ElementDirectory.FindElements<ObjectType>(true))
			{
				if (ot.IsDeleted || ot.IsValueType) continue;
				ObjectType carrier = ot;
				IReferenceModePattern rmp = null;
				int guard = 0;
				while (carrier != null && guard++ < 32)
				{
					rmp = carrier.ReferenceModePattern;
					if (rmp != null) break;
					ObjectType super = null;
					foreach (Role role in carrier.PlayedRoleCollection)
					{
						SubtypeMetaRole subRole = role as SubtypeMetaRole;
						if (subRole != null)
						{
							SubtypeFact sf = subRole.FactType as SubtypeFact;
							if (sf != null) { super = sf.Supertype; break; }
						}
					}
					carrier = super;
				}
				string kind, modeName, vtName = "";
				UniquenessConstraint pid;
				if (rmp != null && carrier != null)
				{
					pid = carrier.PreferredIdentifier;
					if (pid != null && pid.RoleCollection.Count == 1)
					{
						ObjectType vt = pid.RoleCollection[0].RolePlayer;
						if (vt != null) vtName = vt.Name;
					}
					switch (rmp.ReferenceModeType)
					{
						case ReferenceModeType.Popular: kind = "popular"; break;
						case ReferenceModeType.UnitBased: kind = "unitbased"; break;
						default: kind = "general"; break;
					}
					modeName = rmp.Name;
				}
				else
				{
					// has-scheme entities (single-role preferred identifier
					// without a formal reference-mode pattern): NORMA's
					// no-pattern naming path gives them the GENERAL behavior
					// (bare entity for references, the VT name for pid
					// leaves). Composite and unidentified entities stay
					// absent (they contribute nothing at their step).
					carrier = ot;
					pid = null;
					int guard2 = 0;
					while (carrier != null && guard2++ < 32)
					{
						pid = carrier.PreferredIdentifier;
						if (pid != null) break;
						ObjectType super = null;
						foreach (Role role in carrier.PlayedRoleCollection)
						{
							SubtypeMetaRole subRole = role as SubtypeMetaRole;
							if (subRole != null)
							{
								SubtypeFact sf = subRole.FactType as SubtypeFact;
								if (sf != null) { super = sf.Supertype; break; }
							}
						}
						carrier = super;
					}
					if (pid == null || pid.RoleCollection.Count != 1) continue;
					ObjectType vt2 = pid.RoleCollection[0].RolePlayer;
					if (vt2 == null || !vt2.IsValueType) continue;
					vtName = vt2.Name;
					kind = "general";
					modeName = "";
				}
				rmRows.Add("S4(" + IAtom(ot.Name) + ", " + IAtom(modeName)
					+ ", " + IAtom(kind) + ", " + IAtom(vtName) + ")");
			}
			rmRows.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:refmodes\", ").Append(rmRows.Count == 0 ? "S1(PHI())" : IChunked(rmRows)).Append("),\n\n");

			// THE AUTO-IDENTIFICATION SURFACE. The permuter refuses to GENERATE a
			// deep mapping away from an auto-identified entity type
			// (OialModelIsForORMModel.cs:636-646, "Possible deep map toward
			// firstRolePlayer and toward secondRolePlayer, depending on whether the
			// opposite role player is auto identified"), so a candidate that canon
			// scores correctly may be one NORMA never created. The test
			// (:308-328) walks EVERY role of the preferred identifier and asks
			// whether the playing value type's data type is an incremental
			// generator. Both flags are needed and they sit on DIFFERENT objects:
			// AutoGenerated on the ValueTypeHasDataType LINK, AutoGenerationIncremental
			// on the DataType it points at - reading ot.DataType alone would drop
			// the first and call every counter-typed value type auto-generating.
			// Emitted per entity rather than folded into state:refmodes because
			// that surface skips composite identifiers, while this rule reads all
			// of their roles.
			var aiRows = new List<string>();
			foreach (ObjectType ot in myStore.ElementDirectory.FindElements<ObjectType>(true))
			{
				if (ot.IsDeleted || ot.IsValueType) continue;
				bool auto = false;
				UniquenessConstraint aiPid = ot.PreferredIdentifier;
				if (aiPid != null)
				{
					foreach (Role idRole in aiPid.RoleCollection)
					{
						ObjectType idPlayer = idRole.RolePlayer;
						if (idPlayer == null) continue;
						ValueTypeHasDataType dataTypeUse = ValueTypeHasDataType.GetLinkToDataType(idPlayer);
						if (dataTypeUse != null && dataTypeUse.AutoGenerated
							&& dataTypeUse.DataType != null && dataTypeUse.DataType.AutoGenerationIncremental)
						{
							auto = true;
							break;
						}
					}
				}
				aiRows.Add("S2(" + IAtom(ot.Name) + ", " + IAtom(auto ? "T" : "F") + ")");
			}
			aiRows.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:autoid\", ").Append(aiRows.Count == 0 ? "S1(PHI())" : IChunked(aiRows)).Append("),\n\n");
			return sb.ToString();
		}

		public static string MappingStateCells(Store store, System.Reflection.Assembly abstractionAssembly, System.Reflection.Assembly bridgeAssembly, System.Reflection.Assembly relationalAssembly = null)
		{
			var sb = new System.Text.StringBuilder();
			// FORCE THE FULL ORM->OIAL TRANSFORM: the bridge maintains
			// mappings incrementally under delayed validation, and a
			// programmatic build (no .orm load, no deserialization fixups)
			// leaves most FactTypeMapsTowardsRole links never computed -
			// 43 of 398 on base when first read. Invoke the transform the
			// load fixup would have run (rmap-algorithm.md, OMIFORM:287).
			Type bridgeLinkType = bridgeAssembly.GetTypes().First(x => (x.Name == "AbstractionModelIsForORMModel" || x.Name == "OialModelIsForORMModel") && typeof(ModelElement).IsAssignableFrom(x));
			var transform = bridgeLinkType.GetMethod("TransformORMtoOial",
				System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
			if (transform != null)
			{
				Type clearMapType = bridgeAssembly.GetTypes().First(x => x.Name == "FactTypeMapsTowardsRole" && typeof(ModelElement).IsAssignableFrom(x));
				Type absModelType = abstractionAssembly.GetTypes().First(x => x.Name == "AbstractionModel" && typeof(ModelElement).IsAssignableFrom(x));
				foreach (ModelElement link in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(bridgeLinkType), true).Cast<ModelElement>().ToList())
				{
					using (Transaction t = store.TransactionManager.BeginTransaction("force OIAL transform"))
					{
						// the load fixup CLEARS before transforming
						// (OMIFORM:198-212): stale incremental links and
						// abstraction elements collide with the rebuild
						foreach (ModelElement m in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(clearMapType), true).Cast<ModelElement>().ToList())
							m.Delete();
						foreach (ModelElement am in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(absModelType), true).Cast<ModelElement>().ToList())
						{
							foreach (string coll in new[] { "ConceptTypeCollection", "InformationTypeFormatCollection" })
							{
								var pc = absModelType.GetProperty(coll);
								if (pc == null) continue;
								var items = ((System.Collections.IEnumerable)pc.GetValue(am, null)).Cast<ModelElement>().ToList();
								foreach (ModelElement it in items) it.Delete();
							}
						}
						transform.Invoke(link, null);
						t.Commit();
					}
				}
			}
			Type mapType = bridgeAssembly.GetTypes().First(x => x.Name == "FactTypeMapsTowardsRole" && typeof(ModelElement).IsAssignableFrom(x));
			var maps = new List<string>();
			foreach (ModelElement m in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(mapType), true).Cast<ModelElement>())
			{
				object fact = mapType.GetProperty("FactType").GetValue(m, null);
				object roleBase = mapType.GetProperty("TowardsRole").GetValue(m, null);
				// the link class persists the depth as 'Depth' (the wrapper
				// struct's 'MappingDepth' is bridge-internal)
				var depthProp = mapType.GetProperty("Depth") ?? mapType.GetProperty("MappingDepth");
				object depth = depthProp == null ? "shallow" : depthProp.GetValue(m, null);
				if (fact == null || roleBase == null) continue;
				string factName = (string)fact.GetType().GetProperty("Name").GetValue(fact, null);
				object role = roleBase.GetType().GetProperty("Role") != null
					? roleBase.GetType().GetProperty("Role").GetValue(roleBase, null) : roleBase;
				object player = role.GetType().GetProperty("RolePlayer").GetValue(role, null);
				string playerName = player == null ? "" : (string)player.GetType().GetProperty("Name").GetValue(player, null);
				maps.Add("S3(" + IAtom(factName) + ", " + IAtom(playerName) + ", " + IAtom(depth.ToString().ToLowerInvariant()) + ")");
			}
			maps.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:normamap\", ").Append(IChunked(maps)).Append("),\n\n");

			Type ctType = abstractionAssembly.GetTypes().First(x => x.Name == "ConceptType" && typeof(ModelElement).IsAssignableFrom(x));
			Type asType = abstractionAssembly.GetTypes().First(x => x.Name == "ConceptTypeAssimilatesConceptType" && typeof(ModelElement).IsAssignableFrom(x));
			var assimilated = new HashSet<ModelElement>();
			var assims = new List<string>();
			foreach (ModelElement a in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(asType), true).Cast<ModelElement>())
			{
				object parent = asType.GetProperty("AssimilatorConceptType").GetValue(a, null);
				object child = asType.GetProperty("AssimilatedConceptType").GetValue(a, null);
				if (parent == null || child == null) continue;
				assimilated.Add((ModelElement)child);
				bool sub = false;
				var subProp = asType.GetProperty("RefersToSubtype");
				if (subProp != null) sub = (bool)subProp.GetValue(a, null);
				assims.Add("S3(" + IAtom((string)ctType.GetProperty("Name").GetValue(parent, null))
					+ ", " + IAtom((string)ctType.GetProperty("Name").GetValue(child, null))
					+ ", " + IAtom(sub ? "T" : "F") + ")");
			}
			assims.Sort(StringComparer.Ordinal);

			var cts = new List<string>();
			foreach (ModelElement ct in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(ctType), true).Cast<ModelElement>())
			{
				string name = (string)ctType.GetProperty("Name").GetValue(ct, null);
				cts.Add("S2(" + IAtom(name) + ", " + IAtom(assimilated.Contains(ct) ? "F" : "T") + ")");
			}
			cts.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:normacts\", ").Append(IChunked(cts)).Append("),\n\n");
			sb.Append("DEF(\"state:normaassim\", ").Append(IChunked(assims)).Append("),\n\n");

			// SECTION C TARGETS (rmap-algorithm.md C.2-C.3): the concept-type
			// children beyond assimilations, with their fact paths - the
			// per-decision certification surface for canon children and the
			// path replay stage 2's columns certify against.
			// state:normarels  - S5(parent, related, name, oppositeName, mandatory)
			// state:normainfos - S4(parent, formatName, name, mandatory)
			// state:normauniq  - S4(parent, name, isPreferred, S(childNames))
			// state:normapaths - S5(kind, parent, target, name, S(factNames))
			Type relType = abstractionAssembly.GetTypes().First(x => x.Name == "ConceptTypeRelatesToConceptType" && typeof(ModelElement).IsAssignableFrom(x));
			Type infType = abstractionAssembly.GetTypes().First(x => x.Name == "InformationType" && typeof(ModelElement).IsAssignableFrom(x));
			Type uniqType = abstractionAssembly.GetTypes().First(x => x.Name == "Uniqueness" && typeof(ModelElement).IsAssignableFrom(x));
			Func<Type, ModelElement, string, string> propName = (t, el, prop) =>
			{
				var p = t.GetProperty(prop);
				object v = p == null ? null : p.GetValue(el, null);
				return v == null ? "" : v.ToString();
			};
			// ConceptTypeChildHasPathFactType is a BRIDGE link (child in the
			// abstraction model, fact in ORM) - the ordered path collection
			// is reached through the bridge link class's static accessor,
			// not a property on the abstraction element.
			Type pathLinkType = bridgeAssembly.GetTypes().First(x => x.Name == "ConceptTypeChildHasPathFactType" && typeof(ModelElement).IsAssignableFrom(x));
			var pathAccessor = pathLinkType.GetMethod("GetPathFactTypeCollection",
				System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
			Func<Type, ModelElement, string> childPath = (t, el) =>
			{
				if (pathAccessor == null) return "PHI()";
				var seq = new List<string>();
				foreach (object ft in (System.Collections.IEnumerable)pathAccessor.Invoke(null, new object[] { el }))
					seq.Add(IAtom((string)ft.GetType().GetProperty("Name").GetValue(ft, null)));
				if (seq.Count == 0) return "PHI()";
				return "S" + seq.Count + "(" + string.Join(", ", seq) + ")";
			};
			var rels = new List<string>();
			var paths = new List<string>();
			foreach (ModelElement r in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(relType), true).Cast<ModelElement>())
			{
				object parent = relType.GetProperty("RelatingConceptType").GetValue(r, null);
				object related = relType.GetProperty("RelatedConceptType").GetValue(r, null);
				if (parent == null || related == null) continue;
				string pn = (string)ctType.GetProperty("Name").GetValue(parent, null);
				string rn = (string)ctType.GetProperty("Name").GetValue(related, null);
				string nm = propName(relType, r, "Name");
				rels.Add("S5(" + IAtom(pn) + ", " + IAtom(rn) + ", " + IAtom(nm)
					+ ", " + IAtom(propName(relType, r, "OppositeName"))
					+ ", " + IAtom(propName(relType, r, "IsMandatory") == "True" ? "T" : "F") + ")");
				paths.Add("S5(" + IAtom("rel") + ", " + IAtom(pn) + ", " + IAtom(rn) + ", " + IAtom(nm) + ", " + childPath(relType, r) + ")");
			}
			rels.Sort(StringComparer.Ordinal);
			Func<Type, ModelElement, object> parentOf = (t, el) =>
			{
				var p = t.GetProperty("ConceptType") ?? t.GetProperty("Parent");
				return p == null ? null : p.GetValue(el, null);
			};
			var infos = new List<string>();
			foreach (ModelElement it in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(infType), true).Cast<ModelElement>())
			{
				object parent = parentOf(infType, it);
				object fmt = infType.GetProperty("InformationTypeFormat").GetValue(it, null);
				if (parent == null || fmt == null) continue;
				string pn = (string)ctType.GetProperty("Name").GetValue(parent, null);
				string fn = (string)fmt.GetType().GetProperty("Name").GetValue(fmt, null);
				string nm = propName(infType, it, "Name");
				infos.Add("S4(" + IAtom(pn) + ", " + IAtom(fn) + ", " + IAtom(nm)
					+ ", " + IAtom(propName(infType, it, "IsMandatory") == "True" ? "T" : "F") + ")");
				paths.Add("S5(" + IAtom("info") + ", " + IAtom(pn) + ", " + IAtom(fn) + ", " + IAtom(nm) + ", " + childPath(infType, it) + ")");
			}
			infos.Sort(StringComparer.Ordinal);
			foreach (ModelElement a in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(asType), true).Cast<ModelElement>())
			{
				object parent = asType.GetProperty("AssimilatorConceptType").GetValue(a, null);
				object child = asType.GetProperty("AssimilatedConceptType").GetValue(a, null);
				if (parent == null || child == null) continue;
				paths.Add("S5(" + IAtom("assim")
					+ ", " + IAtom((string)ctType.GetProperty("Name").GetValue(parent, null))
					+ ", " + IAtom((string)ctType.GetProperty("Name").GetValue(child, null))
					+ ", " + IAtom(propName(asType, a, "Name")) + ", " + childPath(asType, a) + ")");
			}
			paths.Sort(StringComparer.Ordinal);
			var uniqs = new List<string>();
			foreach (ModelElement u in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(uniqType), true).Cast<ModelElement>())
			{
				object parent = parentOf(uniqType, u);
				if (parent == null) continue;
				var kidNames = new List<string>();
				var kids = new List<string>();
				var kp = uniqType.GetProperty("ConceptTypeChildCollection");
				if (kp != null)
					foreach (object k in (System.Collections.IEnumerable)kp.GetValue(u, null))
					{
						string kn = propName(k.GetType(), (ModelElement)k, "Name");
						kidNames.Add(kn);
						kids.Add(IAtom(kn));
					}
				// SAME DEFECT AS state:ucs AND state:djmands, missed when those were
				// fixed: the OIAL Uniqueness carries NORMA's deferred-pass name, and
				// InternalUniquenessConstraint<N> binds to a different constraint on
				// every run. Two runs over the largest station put 250 and 258 on the
				// same constraint, which is the only thing left making a regenerated
				// design state differ from itself. Sorting the surface by that name is
				// a stable sort over an unstable key. The canon drops this field
				// entirely (rmap:nurows:derive keeps 1, 3 and 4), so nothing reads it -
				// and an unstable field nothing reads is exactly the kind that costs a
				// carrier its byte-reproducibility for no gain. Name it from content.
				string uName = propName(uniqType, u, "Name");
				bool autoNamed = System.Text.RegularExpressions.Regex.IsMatch(
					uName ?? "", "^(Internal|External|Implied)[A-Za-z]*Constraint[0-9]+$");
				string parentName = (string)ctType.GetProperty("Name").GetValue(parent, null);
				bool preferred = propName(uniqType, u, "IsPreferred") == "True";
				uniqs.Add("S4(" + IAtom(parentName)
					+ ", " + IAtom(autoNamed
						? CanonicalConstraintKey("uniq", parentName + (preferred ? "|P" : ""), kidNames)
						: uName)
					+ ", " + IAtom(preferred ? "T" : "F")
					+ ", " + (kids.Count == 0 ? "PHI()" : "S" + kids.Count + "(" + string.Join(", ", kids) + ")") + ")");
			}
			uniqs.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:normarels\", ").Append(IChunked(rels)).Append("),\n\n");
			sb.Append("DEF(\"state:normainfos\", ").Append(IChunked(infos)).Append("),\n\n");
			sb.Append("DEF(\"state:normauniq\", ").Append(IChunked(uniqs)).Append("),\n\n");
			sb.Append("DEF(\"state:normapaths\", ").Append(IChunked(paths)).Append("),\n\n");

			// THE ORDER NORMA NUMBERS FROM. Utility.GenerateUniqueNames walks
			// IterateConstraints (NameGeneration.cs:171, :415) - schema.TableCollection,
			// then each table's CONSTRAINT COLLECTION in ADD order - and appends
			// 1, 2, 3 to colliding generated names, which is where the digits in
			// Function_UC1 and CacheEntry_FK2 come from. That order is a fact
			// about how the model was BUILT, and the answer records what was
			// built; nine orderings derivable from the answer have been measured
			// against it and every one failed.
			// EMIT THE POSITION ONLY, keyed on (table, columns). Canon still
			// derives the NAME from it and still applies the single-vs-multiple
			// rule. The name would be an answer canon is meant to compute; the
			// position is a fact canon cannot compute. Sorting the rows is
			// harmless because the ordinal rides IN the row.
			if (relationalAssembly != null)
			{
				Type conTableType = relationalAssembly.GetTypes().FirstOrDefault(x => x.Name == "Table" && typeof(ModelElement).IsAssignableFrom(x));
				Type conLinkType = relationalAssembly.GetTypes().FirstOrDefault(x => x.Name == "TableContainsConstraint" && typeof(ModelElement).IsAssignableFrom(x));
				var conAccessor = conLinkType == null ? null : conLinkType.GetMethod("GetConstraintCollection",
					System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
				var conRows = new List<string>();
				if (conTableType != null && conAccessor != null)
				{
					foreach (ModelElement conTable in store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(conTableType), true))
					{
						string conTableName = (string)conTableType.GetProperty("Name").GetValue(conTable, null);
						int conPos = 0;
						foreach (object con in (System.Collections.IEnumerable)conAccessor.Invoke(null, new object[] { conTable }))
						{
							++conPos;
							// uniqueness constraints carry ColumnCollection; reference
							// constraints carry ColumnReferenceCollection and their
							// source columns hang off each reference. Reading only the
							// former left 164 of 226 rows keyless.
							var colProp = con.GetType().GetProperty("ColumnCollection");
							var conCols = new List<string>();
							if (colProp != null)
								foreach (object c in (System.Collections.IEnumerable)colProp.GetValue(con, null))
									conCols.Add(IAtom((string)c.GetType().GetProperty("Name").GetValue(c, null)));
							if (conCols.Count == 0)
							{
								var refProp = con.GetType().GetProperty("ColumnReferenceCollection");
								if (refProp != null)
									foreach (object cr in (System.Collections.IEnumerable)refProp.GetValue(con, null))
									{
										object sc = cr.GetType().GetProperty("SourceColumn").GetValue(cr, null);
										if (sc != null)
											conCols.Add(IAtom((string)sc.GetType().GetProperty("Name").GetValue(sc, null)));
									}
							}
							// KIND IS PART OF THE KEY. A table can carry a uniqueness
							// constraint and a reference constraint over the SAME single
							// column - Function has both on transitionPredicateId - and
							// keying on (table, columns) alone collides them, so one
							// lookup wins and the other reads a position belonging to a
							// different constraint. That collision, not the order, was
							// the whole of the 2% disagreement measured at 4541e74c.
							// The kinds match norma:constraints' own: pk, uc, fk.
							string conKind = "fk";
							var primProp = con.GetType().GetProperty("IsPrimary");
							if (colProp != null && colProp.GetValue(con, null) != null &&
								con.GetType().GetProperty("ColumnReferenceCollection") == null)
								conKind = (primProp != null && (bool)primProp.GetValue(con, null)) ? "pk" : "uc";
							else if (primProp != null)
								conKind = (bool)primProp.GetValue(con, null) ? "pk" : "uc";
							conRows.Add("S4(" + IAtom(conKind) + ", " + IAtom(conTableName)
								+ ", " + (conCols.Count == 0 ? "PHI()" : "S" + conCols.Count + "(" + string.Join(", ", conCols) + ")")
								+ ", N(" + conPos + "))");
						}
					}
				}
				conRows.Sort(StringComparer.Ordinal);
				sb.Append("DEF(\"state:conorder\", ").Append(conRows.Count == 0 ? "S1(PHI())" : IChunked(conRows)).Append("),\n\n");
			}
			return sb.ToString();
		}

		public static void DumpRelational(Store store, System.Reflection.Assembly relationalAssembly, TextWriter w)
		{
			Type tableType = relationalAssembly.GetTypes().First(x => x.Name == "Table" && typeof(ModelElement).IsAssignableFrom(x));
			var tables = store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(tableType), true)
				.Cast<ModelElement>()
				.OrderBy(t => (string)tableType.GetProperty("Name").GetValue(t, null), StringComparer.Ordinal)
				.ToList();
			foreach (ModelElement table in tables)
			{
				string tableName = (string)tableType.GetProperty("Name").GetValue(table, null);
				var columns = (System.Collections.IEnumerable)tableType.GetProperty("ColumnCollection").GetValue(table, null);
				var colNames = new List<string>();
				foreach (object col in columns)
				{
					var colType = col.GetType();
					string cn = (string)colType.GetProperty("Name").GetValue(col, null);
					bool nullable = false;
					var nullProp = colType.GetProperty("IsNullable");
					if (nullProp != null) nullable = (bool)nullProp.GetValue(col, null);
					colNames.Add(cn + (nullable ? "?" : ""));
				}
				w.WriteLine("  {0}({1})", tableName, string.Join(", ", colNames));
			}
			w.WriteLine("  TOTAL TABLES: " + tables.Count);
		}
		#endregion
	}
}
