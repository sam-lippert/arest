// The readings verifier: parse the FORML 2 declaration fragment out of the
// Arest metamodel readings, build one ORM model through NORMA's public
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

namespace Arest.NormaOracle
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
		private readonly SortedSet<string> myMarkerConflicts = new SortedSet<string>(StringComparer.Ordinal);

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
				// `\+\+` BEFORE `\+`, for the same reason `\*\*` precedes `\*`:
				// alternation is ordered, so a lone `\+` matches the first plus of
				// `++` and then `\s*$` cannot absorb the second, the Match FAILS,
				// and `continue` below skips the rule ENTIRELY -- not merely its
				// marker. core.md's marker ruling added 'semi-derived-and-stored'
				// precisely to express `++`, and this regex has never been able to
				// see one, so the corpus's only `++` rule has been dropped whole.
				Match m = Regex.Match(line, @"^(.+?\.)\s*(\*\*|\*|\+\+|\+)\s*$");
				if (!m.Success) continue;
				string sent = m.Groups[1].Value.TrimEnd('.').Trim();
				// ONE FACT TYPE, TWO MARKINGS. A head declared in two files -- law-core says
				// `Authority is currently in force. *`, support.auto.dev's vendored copy says
				// `+` -- silently took whichever was read last, so the SAME head builds fully
				// derived in one corpus and semi-derived in the other. That is two different
				// answers about what the rule means, and a marking is not a detail: it says
				// whether the rule owns the whole population. Recorded rather than resolved,
				// because which file should own the vocabulary is not the oracle's call.
				string mkey = NormalizeWords(sent);
				string priorMark;
				if (myMarkerBySentence.TryGetValue(mkey, out priorMark) && priorMark != m.Groups[2].Value)
					myMarkerConflicts.Add(sent + "  declared '" + priorMark + "' and '" + m.Groups[2].Value + "'");
				myMarkerBySentence[mkey] = m.Groups[2].Value;
			}
		}
		private readonly HashSet<FactType> myStoredDerived = new HashSet<FactType>();
		private readonly HashSet<string> mySubtypeDerived = new HashSet<string>(StringComparer.Ordinal);
		// The qualified subtype DEFINITIONS, kept whole. mySubtypeDerived above
		// holds only the subtype NAME (it feeds the state:derived marker), but
		// building the defining rule needs the qualifying clause too, and the
		// clause cannot be handled at map time — the fact type it steps through
		// may not be mapped yet. They cannot go on myDeferredRules: that pass
		// (see the `iff` loop below) is guarded by `^\* (.+?) iff `, and a
		// subtype definition has no `iff`, so it would be dropped silently.
		private readonly List<string> mySubtypeDefs = new List<string>();
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
			// A BLANK LINE OR HEADING ENDS A SENTENCE. These used to be `continue`d -
			// skipped, never terminating - so the whole file joined into one string that
			// split only on '.'. A line with no terminal period therefore swallowed
			// everything after it up to the next period, straight across blank lines and
			// headings. offers.md's period-less "## Cross-domain References" list ate a
			// declaration two paragraphs below it:
			//
			//   [API 'offers' (from api-products) Customer (from customer-auth) ...
			//    Offer Provider(.Provider Name) is an entity type.]
			//
			// one run-on matching no pattern, so Offer Provider was never declared and
			// every sentence naming it silently lost that role. The only thing that ever
			// said so was the "deontic references resolving to no declared type" report.
			//
			// No sentence in this corpus spans a blank line or a heading - a markdown
			// paragraph is exactly the unit a wrapped sentence lives inside - so
			// splitting per paragraph keeps the line-joining this was built for and
			// stops the swallowing.
			string noComments = Regex.Replace(markdown, "<!--.*?-->", " ", RegexOptions.Singleline);
			List<string> sentences = new List<string>();
			var paragraphs = new List<string>();
			var sb = new System.Text.StringBuilder();
			foreach (string rawLine in noComments.Split('\n'))
			{
				string line = rawLine.TrimEnd('\r').Trim();
				if (line.Length == 0 || line.StartsWith("#") || line.StartsWith("```") || line.StartsWith("|"))
				{
					if (sb.Length > 0) { paragraphs.Add(sb.ToString()); sb.Clear(); }
					continue;
				}
				sb.Append(line).Append(' ');
			}
			if (sb.Length > 0) paragraphs.Add(sb.ToString());
			foreach (string joined in paragraphs)
			{
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
			// A TRAILING DERIVATION MARKER IS NOT A SENTENCE. RegisterMarkers
			// already reads it per raw line ("^(.+?\.)\s*(\*\*|\*|\+)\s*$"), so
			// re-emitting it here can only produce a sentence nothing can parse.
			// The guard used to be `tail.Length > 1`, which drops a lone "*" by
			// accident of length and therefore emitted "**" — and "Object Type is
			// instantiable. **" is the corpus's only derived-AND-stored marker, so
			// it was the one declaration that reported itself unrecognized. Match
			// on what the marker IS, not on how long it happens to be.
			// `++` was missing from this set -- the same omission the paragraph above
			// records for `**`, made again for the semi-derived-and-stored marker.
			if (tail.Length > 1 && !Regex.IsMatch(tail, @"^(\*\*|\*|\+\+|\+)$")) sentences.Add(tail);
			}
			return sentences;
		}
		#endregion

		#region pass 1: type declarations
		// a type name may carry an internal hyphen: Trade-In Amount,
		// Cooling-Off Rule, Sub-Processor, Non-Merchant. The hyphen is part
		// of the name only when a word character FOLLOWS it — a trailing
		// hyphen before a space is FORML's hyphen binding ("payoff- Balance"),
		// which names a role, not a type. Without this the declaration falls
		// through pass 1 entirely and the declaration line itself is minted as
		// a fact type, while every reading using the name binds the shorter
		// rival ("Q has Trade-In Amount" binds Amount, arity 3).
		private const string NameChars = @"(?:[\w :]|-(?=\w))";
		private const string RefChars = @"(?:[\w ]|-(?=\w))";
		private static readonly Regex EntityDecl = new Regex(@"^(" + NameChars + @"+?)\s*\(\s*\.\s*(" + RefChars + @"+)\s*\)\s+is an entity type\.$");
		// composite reference scheme (Halpin §7.3): X(.A, .B, ...) - the
		// components bind existing types (or mint value types, the single-
		// refmode precedent) through per-component fact types, and an
		// EXTERNAL uniqueness constraint spanning the far roles is the
		// preferred identifier
		private static readonly Regex EntityDeclComposite = new Regex(@"^(" + NameChars + @"+?)\s*\(\s*\.\s*(" + RefChars + @"+(?:\s*,\s*\.\s*" + RefChars + @"+)+)\s*\)\s+is an entity type\.$");
		// NORMA's own composite-identification verbalization, as written in
		// the wild: "This association with A, B provides the preferred
		// identification scheme for X."
		private static readonly Regex AssocScheme = new Regex(@"^This association with ((?:[\w ,]|-(?=\w))+?) provides the preferred identification scheme for (" + NameChars + @"+?)\.$");
		// HALPIN'S VERBALIZED REFERENCE SCHEME. `Each Personal Data is identified by
		// Personal Data Id.` says exactly what `Personal Data(.Personal Data Id)` says,
		// and eu-law writes all 55 of its schemes this way -- so every one of those
		// entity types read as having no preferred identifier at all, which NORMA
		// reports as a BLOCKING error per type.
		private static readonly Regex IdentifiedByDecl = new Regex(@"^Each (" + NameChars + @"+?)\s+is identified by\s+(" + NameChars + @"+?)\.$");
		private static readonly Regex EntityDeclBare = new Regex(@"^(" + NameChars + @"+?)\s+is an entity type\.$");
		private static readonly Regex ValueDecl = new Regex(@"^(" + NameChars + @"+?)\s+is a value type\.$");

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
			// A DECLARATION FOLLOWING A MARKED ONE ARRIVES WITH THAT MARKER GLUED ON.
			// The bare-marker filter runs on the TAIL of a chunk only, so
			//     Customer is admin. +
			//     User Role is a value type.
			// reaches here as `+ User Role is a value type.`, matches no declaration
			// form, and the type is silently never declared -- then every reading using
			// it splits into whatever shorter names it contains (`User` and `Role`, both
			// metamodel entity types), turning a binary fact type ternary. Same leak I
			// fixed for RULES in NormalizeRuleSentence; declarations needed it too.
			//
			// Safe here because a real rule is dispatched before this point: anything
			// still carrying a marker and reaching DeclareSentence is a declaration that
			// inherited one.
			Match mk0 = Regex.Match(s, @"^(?:[*+]{1,2}\s+)+(.+)$");
			if (mk0.Success && Regex.IsMatch(mk0.Groups[1].Value, @" is (a value type|an entity type|a supertype of|a subtype of)\.$"))
			{
				s = mk0.Groups[1].Value;
			}
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
				else if ((m = IdentifiedByDecl.Match(s)).Success)
				{
					ObjectType t = EnsureType(m.Groups[1].Value.Trim(), false);
					myDeclaredNames.Add(t.Name);
					myDeferredSchemes.Add(new DeferredScheme { Name = t.Name,
						Comps = new List<string> { m.Groups[2].Value.Trim() }, IndexPos = myFactIndex.Count });
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
							// THE MINTED MODE TYPE NEEDS A DATA TYPE. NORMA's refmode machinery
							// creates the value type behind `Authority(.citation)` but leaves it
							// unspecified, and an unspecified value type is a BLOCKING error --
							// eighteen of them in eu-law, four in auto.dev, all named after modes
							// (citation, year, article, basis). The composite branch below has
							// always called EnsureDataType; this one never did.
							EnsureDataType(other.RolePlayer, "text");
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

		// THE DECLARED TYPE, KEPT. ApplyDataType set vt.DataType on the NORMA
		// model and nothing carried the fact into the store, so
		// ObjectTypeHasConceptualDataType stood at 0 rows against a catalogue of
		// 31 populated Conceptual Data Types -- and rmap, having no type to read,
		// emitted all 313 columns as TEXT, including the ones declared integer
		// and decimal. The token IS the catalogue name for six of the eight; the
		// two that differ are spelled out here rather than reverse-mapped from
		// NORMA's intrinsic type objects, because the declaration is what the
		// model said and the intrinsic is only how NORMA stores it.
		private readonly Dictionary<string, string> myDeclaredDataType = new Dictionary<string, string>(StringComparer.Ordinal);
		private static readonly Dictionary<string, string> CatalogueNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
		{
			{ "text", "text" }, { "integer", "integer" }, { "decimal", "decimal" },
			{ "float", "doubleFloat" }, { "boolean", "boolean" },
			{ "datetime", "dateTime" }, { "date", "date" }, { "time", "time" },
		};

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
					string catName;
					if (CatalogueNames.TryGetValue(token, out catName)) myDeclaredDataType[typeName] = catName;
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

		/// <summary>
		/// ORMOialBridgeStructures.cs EntityTypeIsAutoIdentified, transcribed: walk
		/// EVERY role of the preferred identifier and ask whether the value type
		/// playing it carries a data type that generates incrementally. The two
		/// flags sit on DIFFERENT objects -- generated on the link to the data type,
		/// incremental on the data type itself -- so reading valueType.DataType
		/// alone reaches the second and silently drops the first.
		/// </summary>
		private static bool EntityIsAutoIdentified(ObjectType entityType)
		{
			UniquenessConstraint pid;
			if (entityType == null || null == (pid = entityType.PreferredIdentifier))
			{
				return false;
			}
			foreach (Role idRole in pid.RoleCollection)
			{
				ObjectType idPlayer = idRole.RolePlayer;
				if (idPlayer == null) continue;
				ValueTypeHasDataType dataTypeUse = ValueTypeHasDataType.GetLinkToDataType(idPlayer);
				if (dataTypeUse != null && dataTypeUse.AutoGenerated
					&& dataTypeUse.DataType != null && dataTypeUse.DataType.AutoGenerationIncremental)
				{
					return true;
				}
			}
			return false;
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
					// WHERE it threw, not just what it said. This is counted as a
					// harness-error, which asserts the fault is OURS -- but the
					// message alone cannot tell our parse leg apart from a throw
					// inside NORMA's own object model, and an unattributed
					// "Object reference not set to an instance of an object" is
					// exactly the kind of finding that stays unfixed. The top
					// frame is enough to settle it and costs one line.
					string at = "";
					if (ex.StackTrace != null)
					{
						string[] frames = ex.StackTrace.Split('\n');
						if (frames.Length > 0) at = "  [at " + frames[0].Trim() + "]";
					}
					Count("harness-error");
					myMapLog.Add("ERROR mapping '" + Shorten(s) + "': " + ex.Message + at);
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
		// NORMA's OWN group verbalization of the same constraint, which is what
		// this corpus actually writes: "For each P, exactly one of the following
		// holds: that P is an A; that P is a B." GroupExclusiveOr ("exactly one")
		// is exclusion AND exhaustion; GroupExclusion ("at most one") is exclusion
		// alone. The brace spelling above occurs nowhere in the corpus.
		private static readonly Regex GroupSubtypeConstraint = new Regex(
			@"^For each ([\w :]+?), (exactly one|at most one) of the following holds:\s*(.+?)\.?$");
		private static readonly Regex GroupSubtypeItem = new Regex(
			@"^that\s+.+?\s+is an?\s+(.+?)\.?$");
		private static readonly Regex PossibleValues = new Regex(@"^The possible values of\s+([\w :]+?)\s+are\s+(.+)\.$");
		private static readonly Regex DataTypeDecl = new Regex(@"^The data type of\s+([\w :]+?)\s+is\s+(\w+)");

		private void MapSentence(string s)
		{
			// fully derived rules verbalize with "iff" (the CWA closure over
			// all rules of the head); semi-derived rules state sufficient
			// conditions with a bare "if" — both are derivations to defer
			if (s.Contains(" iff ") || (s.StartsWith("* ") && Regex.IsMatch(s, @"\bif\b"))
				|| Regex.IsMatch(s, @"^\+{1,2} .+ if "))
			{
				// A RULE'S OWN MARKER IS A DEF 5 MARKING, and NormalizeRuleSentence is about
				// to strip it. Where the declaration carries the marking too there is nothing
				// to do, but most of the corpus marks only the rule: support.auto.dev writes
				// 57 `+` rules whose heads are declared bare, and every one of them was built
				// FULLY derived. That is the reading's own warning ignored -- contact-
				// derivation.md says in as many words that "a fully-derived * would claim the
				// rule owns the whole population; it does not" -- and it is the same harm
				// ApplyDerivationMarkers already guards for ++ vs **: derived rows become the
				// only rows, so an asserted one is erased by the next derivation.
				Match mk = Regex.Match(s, @"^(\+{1,2}) (.+?) (?:iff|if) ");
				if (mk.Success) myRuleMarkers.Add(new string[] { mk.Groups[1].Value, mk.Groups[2].Value.Trim() });
				myDeferredRules.Add(NormalizeRuleSentence(s));
				Count("derivation rule (deferred: no textual rule input in NORMA)");
				return;
			}
			// derived subtype (Halpin Fig 13.29 form): "* Each Entity Type is an
			// Object Type that is of OT Kind 'entity'." — map the subtype edge,
			// defer the defining rule like any derivation
			//
			// The relative pronoun is not always "that". Halpin §6.5 (p.253) fixes
			// the operator set for a qualified subtype definition: `is a`/`is an`
			// means "is defined as", and "WHO", "THAT", or "WHICH" follows the
			// supertype name — "for persons, 'who' sounds more natural than
			// 'that'". Accepting only `that` silently dropped the WHOLE subtype
			// for the "who" form: measured on a minimal A/B, the `that` model
			// mapped an edge + declaration + preferred identification while its
			// `who` twin reported "(none matched the class)" — no edge, no
			// declaration, nothing. Not a deferral, a loss. The metamodel happens
			// to use `that` throughout, which is why five green stations never
			// showed it (INERT, not correct).
			{
				Match dm = Regex.Match(s, @"^\* Each ([\w ]+?) is an? ([\w ]+?) (?:that|who|which)\b");
				if (dm.Success)
				{
					MapSubtype(dm.Groups[1].Value.Trim(), dm.Groups[2].Value.Trim());
					mySubtypeDerived.Add(dm.Groups[1].Value.Trim());
					mySubtypeDefs.Add(s);
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
				if (mkDerived.Groups[1].Value == "++" && myLastFact != null &&
					!System.Text.RegularExpressions.Regex.IsMatch(s, @"\biff?\b"))
				{
					mySemiDerived.Add(myLastFact);
					myStoredDerived.Add(myLastFact);
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
			if ((m = GroupSubtypeConstraint.Match(s)).Success)
			{
				string parent = m.Groups[1].Value.Trim();
				bool exhaustive = m.Groups[2].Value == "exactly one";
				var kids = new List<string>();
				foreach (string item in m.Groups[3].Value.Split(';'))
				{
					Match im = GroupSubtypeItem.Match(item.Trim());
					if (im.Success) kids.Add(im.Groups[1].Value.Trim());
				}
				if (kids.Count >= 2)
				{
					foreach (string child in kids) MapSubtype(child, parent);
					// hand the existing builders the shape they already parse
					string canonical = "{" + string.Join(", ", kids) +
						"} are mutually exclusive subtypes of " + parent + ".";
					myTextual.Add(new KeyValuePair<string, string>("subtype-exclusion", canonical));
					if (exhaustive)
					{
						myTextual.Add(new KeyValuePair<string, string>("subtype-totality", canonical));
					}
					Count(exhaustive ? "subtype partition (NORMA group form)"
						: "subtype exclusion (NORMA group form)");
					return;
				}
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
			// THE UNBOUND-TYPE DIAGNOSIS LIVES INSIDE MapFactReading, AFTER its
			// hits.Count check - so the one case where NOTHING resolved, which is
			// the case that most needs naming, is the one case it never reports.
			// A sentence naming no declared type at all lands here as bare text and
			// the reader is left to work out which name was missing.
			//
			// Witness (cont 476): `Personal Data Breach has notification deadline.`
			// Personal Data Breach is never declared as an entity type anywhere in
			// auto.dev - it appears only inside readings - so this sentence has zero
			// hits and vanishes with no reason attached. Two fires read the model,
			// saw the declaration sitting in the file, and concluded the fact type
			// existed. Same shape of silence as 6fb6dee2 and one layer further up.
			//
			// Report-only, and deliberately the SAME candidate scan as the in-mapper
			// report so the two agree: capitalized runs, length guard, no word list.
			// It over-reports prose, which is why the line says "names no declared
			// type" rather than pretending to be a defect count.
			{
				var missing = new List<string>();
				foreach (Match cm in Regex.Matches(s, @"\p{Lu}[\w-]*(?:\s+\p{Lu}[\w-]*)*"))
				{
					string cand = cm.Value.Trim();
					if (cand.Length > 1 && !myTypes.ContainsKey(cand) && !missing.Contains(cand))
						missing.Add(cand);
				}
				if (missing.Count > 0)
					myMapLog.Add("UNRECOGNIZED, names no declared type ("
						+ string.Join(", ", missing) + "): " + Shorten(s));
			}
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

		// Transitive ancestry over SupertypeCollection, reflexive at the name.
		// RootsAtFunction was this walk with "Function" baked in; it is now one
		// walk with a parameter, so the subtype-cast check in RecordRenameRecipe
		// and the one-table Function rule cannot drift apart.
		// Resolve a head that NAMES VALUES, and may play a role with a subtype:
		//   Admin is authorized for Operation 'create' on Protected Resource 'Support Request'
		// resolves to the declared `User is authorized for Operation on Protected Resource`.
		// The arm and the UNBUILT census must agree on this or the census reports a rule
		// that built as undeclared -- lying in the flattering direction is the usual way a
		// census stops being worth reading, and this is the same shape from the other side.
		private FactIndexEntry ResolveRestrictedHead(string headRaw, out List<string> lits)
		{
			string swapped; ObjectType swappedTo;
			return ResolveRestrictedHead(headRaw, out lits, out swapped, out swappedTo);
		}

		// `swappedPlayer` / `swappedTo`: the declared player whose role the head named a
		// SUBTYPE of. A head may specialise a role without naming a value -- `Person is
		// subject to Minnesota Authority` -- and the caller needs to know which role,
		// because the subtype's own population is what fills it.
		private FactIndexEntry ResolveRestrictedHead(string headRaw, out List<string> lits,
			out string swappedPlayer, out ObjectType swappedTo)
		{
			swappedPlayer = null; swappedTo = null;
			lits = new List<string>();
			foreach (Match lm in Regex.Matches(headRaw, @"'([^']*)'")) lits.Add(lm.Groups[1].Value);
			// A head may be SPECIALISED WITHOUT NAMING A VALUE:
			//   + Person is subject to Minnesota Authority if Person works in State 'Minnesota'.
			// names the declared `Person is subject to Authority` with the Authority role
			// restricted to a SUBTYPE rather than to a value. No arm builds that -- it wants
			// a cross join against the subtype's population, and nothing in the body supplies
			// an Authority at all -- but the census must still say "declared, not built"
			// rather than "no such fact type", which sends a reader to the wrong file.
			string bare = Regex.Replace(headRaw, @"\s*'[^']*'", "").Trim();
			FactIndexEntry e = FindEntryByNormalizedSentence(bare);
			if (e != null) return e;
			// SUBSTITUTE ONE OCCURRENCE, IN ANY POSITION. The subtype is not always the
			// subject: `Customer is subject to Regulation 'GDPR (EU 2016/679)'` names the
			// declared `Customer is subject to Authority` with Regulation, a subtype of
			// Authority, in OBJECT position -- as do support.auto.dev's
			// `Person is subject to Minnesota Authority` family. Longest name first, so
			// `Minnesota Authority` is tried before the `Authority` inside it.
			foreach (string subName in myTypes.Keys.OrderByDescending(n => n.Length))
			{
				int at = 0;
				while ((at = bare.IndexOf(subName, at, StringComparison.Ordinal)) >= 0)
				{
					int end = at + subName.Length;
					bool leftOk = at == 0 || !char.IsLetterOrDigit(bare[at - 1]);
					bool rightOk = end >= bare.Length || !char.IsLetterOrDigit(bare[end]);
					if (leftOk && rightOk)
					{
						foreach (string supName in myTypes.Keys)
						{
							if (supName == subName || !RootsAt(myTypes[subName], supName)) continue;
							FactIndexEntry cand = FindEntryByNormalizedSentence(
								bare.Substring(0, at) + supName + bare.Substring(end));
							if (cand != null) { swappedPlayer = supName; swappedTo = myTypes[subName]; return cand; }
						}
					}
					at = end;
				}
			}
			return null;
		}

		private bool RootsAt(ObjectType t, string ancestor)
		{
			if (t == null) return false;
			if (t.Name == ancestor) return true;
			foreach (ObjectType sup in t.SupertypeCollection)
			{
				if (RootsAt(sup, ancestor)) return true;
			}
			return false;
		}

		private bool RootsAtFunction(ObjectType t)
		{
			return RootsAt(t, "Function");
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
		/// <summary>
		/// The key under which a derivation rule's HEAD is counted. Keyed by the
		/// RESOLVED FACT TYPE wherever the head resolves, because NormalizeWords does
		/// not strip subscripts: `Domain1 reaches Domain2` and `Domain1 reaches Domain3`
		/// are ONE fact type written two ways, and keying on the text counted them as
		/// two single-rule heads. The guards read these counts to decide whether a
		/// union is safe, so a miscount of 1 tells an arm it is the only rule and lets
		/// it build a single-path derivation for a multi-rule fact type -- the partial
		/// build the pre-pass itself calls "wrong rather than partial".
		/// Falls back to the normalized text when the head does not resolve, so
		/// undeclared heads keep their existing behaviour.
		/// </summary>
		private string RuleHeadKey(string headText)
		{
			FactIndexEntry he = FindEntryByNormalizedSentence(headText.Trim());
			// A RESTRICTED HEAD IS STILL THAT FACT TYPE. Five rules reading `Citation is
			// backed by External System '<one of five>'` are five rules of ONE head, and
			// keying them by their literal-bearing text gave each a quota of one path --
			// so the first built and capped out the other four.
			if (he == null) { List<string> ignoredLits; he = ResolveRestrictedHead(headText.Trim(), out ignoredLits); }
			return he != null ? ("\u0001ft:" + he.Fact.Id.ToString()) : NormalizeWords(headText);
		}
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
			// THE SILENT FOLD, made loud. Players are found by scanning for names
			// already in myTypes, so an object type the sentence NAMES but which was
			// never introduced records no hit: its text simply stays in the reading and
			// its role is gone. "Customer has Residence." becomes the unary
			// "{0} has Residence" with no counter and no log line.
			//
			// REPORTING ONLY: nothing below this point reads `unbound`, the arity is
			// untouched, and the carrier comes back byte-identical - measured.
			//
			// PRECISION IS MODEST AND THE COUNT IS NOT A DEFECT COUNT. On the real
			// station input (apps/auto.dev/.combined, the 44 files that reproduce the
			// shipped carrier byte for byte) this reports 83, of which only order-15 are
			// genuine dropped roles - Residence, Style, Engine, Drivetrain,
			// Transmission, Data, Fresh Until, Noun, Personal Data, Deadline. The rest
			// are sentence-initial capitals ("Not every API is...", "Every Customer
			// is...") and prose. Treat the output as a triage list to read, never as a
			// metric to quote.
			{
				string residual = Regex.Replace(text, @"\{\d\}", " ");
				var unbound = new List<string>();
				foreach (Match um in Regex.Matches(residual, @"\p{Lu}[\w-]*(?:\s+\p{Lu}[\w-]*)*"))
				{
					// length guard only, deliberately NO word list: a single capital is
					// the article "A" starting a sentence, never a type name here. HTTP
					// verbs and the like still report - a fallback name list is exactly
					// what killed the two runners before this one, and a few obvious
					// false positives in a triage log cost less than a hidden real case.
					string cand = um.Value.Trim();
					if (cand.Length > 1 && !myTypes.ContainsKey(cand)) unbound.Add(cand);
				}
				if (unbound.Count > 0)
				{
					Count("role dropped (type never introduced)");
					myMapLog.Add("UNBOUND TYPE in '" + Shorten(body) + "': "
						+ string.Join(", ", unbound) + " (arity " + players.Count + ")");
				}
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
				// `++` needs no fourth set. The markers are ORTHOGONAL -- core.md's
				// marker ruling: "storage on one axis and assertability on the other"
				// -- so semi-derived-and-stored is exactly the conjunction of the two
				// sets that already exist.
				else if (mark == "++") { mySemiDerived.Add(fact); myStoredDerived.Add(fact); }
			}
			Count("fact-type reading (arity " + players.Count + ")");
			return true;
		}

		private readonly List<KeyValuePair<string, string>> myTextual = new List<KeyValuePair<string, string>>();
		private readonly List<string> myRuleRecipes = new List<string>();
		private readonly List<string> myRingRows = new List<string>();
		private readonly List<string> myDeferredRules = new List<string>();
		// WHICH RULE SENTENCES HAVE BEEN BUILT. The paths-vs-rules cap counts how many
		// paths a head has, which stops an arm adding a third to a two-rule head -- but
		// it cannot tell WHICH rule each path came from. So when one rule of a head is
		// unbuildable, a later arm fills the free slot with a SECOND path over a rule
		// that already built, and the head still looks right by the count. That is what
		// state.md RULE 2 turned into once the general-join arm stopped mis-building it.
		private readonly HashSet<string> myBuiltRuleSentences = new HashSet<string>(StringComparer.Ordinal);
		private readonly List<string[]> myRuleMarkers = new List<string[]>();

		// FORML names two variables of ONE type by subscripting, so
		// `Domain1 reaches Domain2` is a rule over the declared ring fact type
		// `Domain reaches Domain` (core.md:533, marked fully derived). The digit
		// identifies the VARIABLE, not the type, so a sentence carrying one has to
		// resolve to the unsubscripted fact type or the rule is dropped with the
		// misleading report that its head names nothing declared.
		//
		// MEASURED BEFORE WRITING THIS (cont 475), because reading the arms had
		// suggested ring-ness was the whole story and it is not: a non-ring rule
		// that builds STOPS building when a needless subscript is added. The
		// subscript is independently fatal, so this is not merely ring bookkeeping.
		//
		// Applied ONLY as a fallback, after the literal key misses, so nothing that
		// resolves today can change meaning. Replacement is anchored on DECLARED
		// type names and longest-first, which keeps quoted literals and bare
		// numbers untouched and stops a short type name eating a longer one.
		private string StripSubscripts(string sentence)
		{
			var names = new List<string>(myTypes.Keys);
			names.Sort(delegate(string a, string b) { return b.Length.CompareTo(a.Length); });
			string s = sentence;
			foreach (string tn in names)
			{
				if (tn.Length == 0) continue;
				s = Regex.Replace(s, Regex.Escape(tn) + @"\d+", tn);
			}
			return s;
		}

		// The variable each role is bound to, as the sentence WRITES it: the player's
		// name plus whatever subscript follows it at that occurrence. `Domain1 reaches
		// Domain2` over players [Domain, Domain] yields ["Domain1", "Domain2"], which
		// is the only thing distinguishing the two roles of a ring fact type. For a
		// sentence with no subscripts the tokens are the bare names, which already
		// distinguish the roles of a non-ring one.
		// Returns null when a player cannot be located in the text, so callers decline
		// rather than bind to a guess.
		private List<string> SubscriptedTokens(string text, List<string> players)
		{
			var toks = new List<string>();
			int from = 0;
			foreach (string p in players)
			{
				int at = text.IndexOf(p, from, StringComparison.Ordinal);
				if (at < 0) return null;
				int end = at + p.Length;
				while (end < text.Length && char.IsDigit(text[end])) end++;
				toks.Add(text.Substring(at, end - at));
				from = end;
			}
			return toks;
		}

		private FactIndexEntry FindEntryByNormalizedSentence(string sentence)
		{
			FactIndexEntry hit = FindEntryByExactKey(NormalizeWords(sentence));
			if (hit != null) return hit;
			string stripped = StripSubscripts(sentence);
			return stripped == sentence ? null : FindEntryByExactKey(NormalizeWords(stripped));
		}

		private FactIndexEntry FindEntryByExactKey(string key)
		{
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
			// NESTED `that` IS THE SAME DERIVATION WRITTEN DIFFERENTLY, and only one
			// surface was accepted. Measured A/B on identical semantics:
			//     Thing has Gamma iff Thing has Alpha and that Alpha maps to Gamma.  BUILDS
			//     Thing has Gamma iff Thing has Alpha that maps to Gamma.            did not
			// Both are well formed and Ullman-safe; the second nests the continuation on the
			// bound variable instead of naming it again after `and`. Every arm splits bodies
			// on " and ", so the nested form arrives as ONE leg no arm can read.
			//
			// So restore the elided variable rather than teach the arms a second shape:
			//     <...> <Type> that <rest>   ->   <...> <Type> and that <Type> <rest>
			// The variable inserted is the DECLARED TYPE immediately before ` that `, which
			// is what the nesting elided - not a guess. Done here because myTypes is complete
			// by this point and every arm reads myDeferredRules after it.
			//
			// Conservative by construction: skipped when the clause already says `and that`,
			// when no declared type sits at the nesting point, and for the leading-`that`
			// continuation surface the chain arm already takes.
			// A rule's marking is its HEAD's marking. Resolved here rather than at parse
			// time because the fact index is what turns a head sentence into a fact type,
			// and a head declared `*` still wins -- ApplyDerivationMarkers reads
			// myFullyDerived first, so an explicit declaration is never overridden.
			foreach (string[] rm in myRuleMarkers)
			{
				FactIndexEntry he = FindEntryByNormalizedSentence(rm[1]);
				// The same resolution RuleHeadKey uses. A head that names a value or
				// specialises a role to a subtype is still THAT fact type, and its marking
				// lands there too; resolving only by sentence dropped the `+` on
				// `Admin is authorized for Operation 'create' ...`, which NORMA then built
				// FULLY derived -- forbidding the asserted instances the marking permits
				// (probe restricted-head-subtype).
				if (he == null) { List<string> ignoredLits; he = ResolveRestrictedHead(rm[1], out ignoredLits); }
				if (he == null) continue;
				mySemiDerived.Add(he.Fact);
				if (rm[0] == "++") myStoredDerived.Add(he.Fact);
			}
			for (int di = 0; di < myDeferredRules.Count; di++)
			{
				string dr = myDeferredRules[di], prev;
				do
				{
					prev = dr;
					Match nm2 = Regex.Match(dr, @" (?<t>[A-Z][\w\-]*(?: [A-Z][\w\-]*)*) that (?!is an?\b)(?<rest>\S)");
					if (!nm2.Success) break;
					string ty = nm2.Groups["t"].Value;
					if (!myTypes.ContainsKey(ty)) break;
					int at = nm2.Index;
					if (at >= 5 && dr.Substring(0, at).EndsWith(" and")) break;
					dr = dr.Substring(0, at) + " " + ty + " and that " + ty + " "
						+ dr.Substring(nm2.Groups["rest"].Index);
				} while (dr != prev);
				if (dr != myDeferredRules[di])
				{
					myMapLog.Add("NESTED-THAT normalised: " + Shorten(myDeferredRules[di])
						+ "  ->  " + Shorten(dr));
					myDeferredRules[di] = dr;
				}
			}
			var rulesPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			var linearPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			var generalPerHead = new Dictionary<string, int>(StringComparer.Ordinal);
			// the same counts keyed by the RESOLVED FACT NAME: emitted recipes carry that name,
			// while rulesPerHead is keyed by RuleHeadKey's fact-type id
			var rulesPerFactName = new Dictionary<string, int>(StringComparer.Ordinal);
			foreach (string sRaw0 in myDeferredRules)
			{
				string s = sRaw0;
				while (s.StartsWith("* * ")) s = s.Substring(2);
				Match hm = Regex.Match(s, @"^\* (.+?) iff ");
				if (!hm.Success) continue;
				string h = RuleHeadKey(hm.Groups[1].Value.Trim());
				int n;
				rulesPerHead.TryGetValue(h, out n);
				rulesPerHead[h] = n + 1;
				FactIndexEntry he0 = FindEntryByNormalizedSentence(hm.Groups[1].Value.Trim());
				if (he0 != null)
				{
					int nf;
					rulesPerFactName.TryGetValue(he0.Fact.Name, out nf);
					rulesPerFactName[he0.Fact.Name] = nf + 1;
				}
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
				rulesPerHead.TryGetValue(RuleHeadKey(head), out headRules);
				int linearRules;
				linearPerHead.TryGetValue(RuleHeadKey(head), out linearRules);
				// THE SPLIT-HEAD GUARD, RELAXED. It read
				//     if (headRules != 1 && linearRules != headRules) continue;
				// i.e. a multi-rule head builds only when EVERY one of its rules is
				// linear-class, on the reasoning that a head split across classes "would
				// build partially, which is wrong rather than partial". That was right
				// when this was the only arm. It is now one of eight, so a split head can
				// be built FULLY by different arms -- and the guard was instead keeping
				// `Status is defined in State Machine Definition` at 1 path for 3 rules,
				// because the projection arm had built its third rule and thereby made the
				// head "split".
				// Partial builds stay VISIBLE either way: the UNBUILT report already counts
				// "head has N path(s) for M rule(s)" separately, and a partially built head
				// is the gate on retiring its hand-written canon twin -- a head deriving 1
				// of 3 rules under-populates silently, which is why the twins come out only
				// when paths == rules.
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
					if (hits.Count != 1)
					{
						// A RING HEAD IS AMBIGUOUS BY NAME: its two players share a type
						// name, so each finds a candidate in both legs and hits.Count is 2
						// with nothing else objecting. The subscript is what the sentence
						// uses to tell them apart, so read it back rather than declining.
						// Engaged ONLY once the name match is already ambiguous, so every
						// rule that resolves today takes the identical path.
						List<string> hTok = SubscriptedTokens(head, headE.Players);
						List<string> t1 = SubscriptedTokens(leg1, e1.Players);
						List<string> t2 = SubscriptedTokens(leg2, e2.Players);
						if (hTok == null || t1 == null || t2 == null) { ok = false; break; }
						var narrowed = new List<KeyValuePair<FactIndexEntry, int>>();
						foreach (var h in hits)
						{
							string tok = h.Key == e1 ? t1[h.Value] : t2[h.Value];
							if (tok == hTok[i]) narrowed.Add(h);
						}
						// still ambiguous, or no subscript to disambiguate with: decline
						if (narrowed.Count != 1) { ok = false; break; }
						located.Add(narrowed[0]);
						continue;
					}
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
				myBuiltRuleSentences.Add(s);
				log.Add(headE.Fact.Name + " := join over " + j + " (" + e1.Fact.Name + " x " + e2.Fact.Name + "), " + DescribeDerivation(headE.Fact));
				RecordRuleRecipe(headE, e1, e2, j1, j2, located);
			}
			// THE PROJECTION-RENAME CLASS: a head whose whole body is ONE clause.
			//     * Domain1 reaches Domain2 iff Domain1 is contained in Domain2.
			// No join variable, no condition — the head IS the source fact type read
			// under another name, with its roles possibly permuted. Codd's projection
			// (1970 Sec 2.1.2) over a single relation; canon's `proj` form.
			//
			// WHY THIS ARM EXISTS. Measured 2026-09-02: of 43 live derivation sentences
			// in arest/metamodel, 23 were UNBUILT, and EVERY ONE of them had been
			// hand-transcribed into canon's derive:rules table instead — 1:1 on
			// multiplicity, 3 UNBUILT `Status is defined in State Machine Definition`
			// against 3 hand-written cells, and so on for all thirteen names. The
			// compile step was bypassed by hand, so for those rules the readings were
			// decorative and nothing checked that the English and the point-free form
			// still agreed. This is the simplest of the shapes it could not read, and
			// its legs already resolved 1/1 — the clause was found; no arm accepted it.
			//
			// THE TEST IS EXACT, WHICH IS WHY THIS SHAPE IS FIRST. Canon already holds
			// the hand-written answer, so the arm is not judged by "it built" but by
			// reproducing that cell byte-for-byte; only then may the twin be deleted
			// (see docs, the canon-first deletion procedure). Compare against
			//     S2(A("DomainReachesDomain"), S3(A("proj"), A("DomainIsContainedInDomain"), S2(N(1), N(2))))
			//
			// Conservative on purpose: single clause only, head and source must both
			// resolve and differ, and every head player must locate at exactly one
			// source position (subscripts breaking ties exactly as the join arm does,
			// since a ring head like `Domain1 reaches Domain2` is ambiguous by name).
			// Anything else declines and stays UNBUILT rather than building a guess.
			foreach (string sRaw in myDeferredRules)
			{
				string s1 = sRaw;
				while (s1.StartsWith("* * ")) s1 = s1.Substring(2);
				Match m1 = Regex.Match(s1, @"^\* (.+?) iff (.+)\.$");
				if (!m1.Success) continue;
				string body1 = m1.Groups[2].Value.Trim();
				// one clause only: a conjunction is the join arm's business
				if (body1.Contains(" and ")) continue;
				// a quoted literal is a condition, not a rename — the value-condition
				// arm owns that shape and baking it here would lose the constant
				if (body1.Contains("'")) continue;
				string head1 = m1.Groups[1].Value.Trim();
				FactIndexEntry hE = FindEntryByNormalizedSentence(head1);
				FactIndexEntry sE = FindEntryByNormalizedSentence(Dequantify(" " + body1 + " ").Trim());
				if (hE == null || sE == null || hE == sE) continue;
				// every head player must sit at exactly one source position
				var at = new int[hE.Players.Count];
				bool ok1 = true;
				List<string> hTok1 = null, sTok1 = null;
				for (int i = 0; i < hE.Players.Count && ok1; i++)
				{
					var hits = new List<int>();
					for (int c = 0; c < sE.Players.Count; c++)
						if (sE.Players[c] == hE.Players[i]) hits.Add(c);
					if (hits.Count == 1) { at[i] = hits[0]; continue; }
					if (hits.Count == 0) { ok1 = false; break; }
					// ambiguous by name: read the subscript back, as the join arm does
					if (hTok1 == null) { hTok1 = SubscriptedTokens(head1, hE.Players); sTok1 = SubscriptedTokens(body1, sE.Players); }
					if (hTok1 == null || sTok1 == null) { ok1 = false; break; }
					var narrowed = new List<int>();
					foreach (int c in hits) if (sTok1[c] == hTok1[i]) narrowed.Add(c);
					if (narrowed.Count != 1) { ok1 = false; break; }
					at[i] = narrowed[0];
				}
				if (!ok1) continue;
				// GET-OR-CREATE, exactly as the join arm does: a multi-rule head holds ONE
				// derivation rule whose closure is the UNION of one lead role path per
				// rule sentence. Creating a fresh rule here instead cost 11 heads — they
				// built with a single path and the join arm's contributions were lost,
				// moving them from "no arm accepts" to "paths fewer than rules" without
				// changing the UNBUILT total. Each sentence contributes one path; the
				// head is claimed once.
				var rule1 = hE.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule1 == null)
				{
					rule1 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE.Fact, rule1);
					ApplyDerivationMarkers(hE.Fact, rule1);
				}
				var lead1 = new LeadRolePath(myStore);
				rule1.OwnedLeadRolePathCollection.Add(lead1);
				// root at the type entering the source, i.e. the player of head role 0
				new RolePathObjectTypeRoot(lead1, myTypes[hE.Players[0]]);
				var sub1 = new RoleSubPath(myStore);
				lead1.SubPathCollection.Add(sub1);
				var stepAt = new PathedRole[sE.Roles.Count];
				var entry1 = new PathedRole(sub1, sE.Roles[at[0]]);
				entry1.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				stepAt[at[0]] = entry1;
				for (int c = 0; c < sE.Roles.Count; c++)
				{
					if (stepAt[c] != null) continue;
					var st = new PathedRole(sub1, sE.Roles[c]);
					st.PathedRolePurpose = PathedRolePurpose.SameFactType;
					stepAt[c] = st;
				}
				var proj1 = new RoleSetDerivationProjection(rule1, lead1);
				for (int i = 0; i < hE.Roles.Count; i++)
				{
					var drp = new DerivedRoleProjection(proj1, hE.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp, stepAt[at[i]]);
				}
				log.Add(hE.Fact.Name + " := proj " + sE.Fact.Name + ", " + DescribeDerivation(hE.Fact));
				RecordProjRecipe(hE, sE, at);
			}

			// THE VALUE-RESTRICTED PROJECTION CLASS. A head that names a value:
			//     * Customer has Data Subject Right Type 'access' iff Customer is in EEA.
			// The fact type IS declared (`Customer has Data Subject Right Type. *`); what
			// the head adds is a RESTRICTION on one role. NORMA carries that natively --
			// DerivedRoleProjectedFromPathConstant projects a head role from a constant
			// instead of from a pathed role -- so the restriction is REPRESENTED, not
			// dropped. Dropping it would build `every EEA Customer has every right type`,
			// which is a different and wronger claim than not building at all.
			//
			// Guard: exactly ONE head role may be unmatched in the body, and that is the
			// one the constant fills. Position in the sentence is NOT the test -- a head
			// player that also appears in the body would make the literal ambiguous, and
			// this declines rather than guessing.
			//
			// No recipe is recorded. RecordProjRecipe emits canon's `proj` form over
			// pathed columns and has no column for a constant; emitting one anyway would
			// put a recipe in the census that canon never wrote.
			Function eqFnV = null;
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && fn.IsBoolean && fn.Name == "Equals") { eqFnV = fn; break; }
			}
			foreach (string sV in myDeferredRules)
			{
				// A HEAD MAY NAME MORE THAN ONE VALUE, AND MAY NAME A SUBTYPE:
				//   + Admin is authorized for Operation 'create'
				//         on Protected Resource 'Support Request' iff Admin has Role.
				// The declared fact type is `User is authorized for Operation on Protected
				// Resource`; the head restricts BOTH value roles and plays the User role with
				// Admin, which is a subtype of it (Admin < Customer < User). 15 of
				// support.auto.dev's rules are this shape and every one reported as naming no
				// declared fact type. Take the literals in sentence order and pair them with
				// the unmatched roles in role order, which is the same order the reading lays
				// them out; require the counts to agree rather than guessing an alignment.
				Match mv = Regex.Match(sV, @"^\* (.+?) iff (.+)\.$");
				if (!mv.Success) continue;
				string headRawV = mv.Groups[1].Value.Trim();
				string bodyV = mv.Groups[2].Value.Trim();
				if (bodyV.Contains(" and ")) continue;
				List<string> litsV;
				string subPlayerV; ObjectType subTypeV;
				FactIndexEntry hV = ResolveRestrictedHead(headRawV, out litsV, out subPlayerV, out subTypeV);
				if (hV == null) continue;
				FactIndexEntry bV = FindEntryByNormalizedSentence(Dequantify(" " + bodyV + " ").Trim());
				// THE BODY MAY BE RESTRICTED TOO:
				//   * Feature Request has GitHub Issue State 'open'
				//         iff Feature Request has Lifecycle Status 'Proposed'.
				// Same treatment on the other side: resolve the base fact type and carry the
				// literal as an Equals condition over a PathConstant, which is what the
				// value-condition class already does for a quoted leg. 11 of
				// support.auto.dev's 22 restricted rules are this shape.
				string bodyLit = null;
				if (bV == null)
				{
					Match bvr = Regex.Match(bodyV, @"^(.+?) '([^']*)'$");
					if (bvr.Success)
					{
						bV = FindEntryByNormalizedSentence(Dequantify(" " + bvr.Groups[1].Value.Trim() + " ").Trim());
						if (bV != null) bodyLit = bvr.Groups[2].Value;
					}
				}
				if (bV == null) continue;
				// THE Equals FUNCTION IS CREATED ON DEMAND, NOT PRELOADED. The later
				// value-condition arms each build one if none exists, so at this point in the
				// pass there is usually none and looking it up alone finds nothing -- which is
				// why the first version of this arm declined every rule it was written for and
				// still compiled and still passed the regression. Build it here on the same
				// terms; their `if (eqFn == null)` lookup then finds this one, so there is
				// never a second.
				if (bodyLit != null && eqFnV == null)
				{
					eqFnV = new Function(myStore);
					eqFnV.Name = "Equals";
					eqFnV.IsBoolean = true;
					eqFnV.Model = myModel;
					var epa = new FunctionParameter(myStore); epa.Function = eqFnV; epa.Name = "left";
					var epb = new FunctionParameter(myStore); epb.Function = eqFnV; epb.Name = "right";
				}
				var atV = new int[hV.Roles.Count];
				var konstAt = new int[hV.Roles.Count];   // which literal fills this role, or -1
				var crossAt = new bool[hV.Roles.Count];  // filled from the subtype's own population
				bool anyCrossV = false;
				int konstSeen = 0;
				bool okV = true;
				for (int i = 0; i < hV.Roles.Count; i++)
				{
					konstAt[i] = -1;
					var hitsV = new List<int>();
					for (int c = 0; c < bV.Players.Count; c++)
						{
							// a body player may be a SUBTYPE of the head role's player -- Admin plays
							// the User role -- so ancestry, not name equality, is the test
							if (bV.Players[c] == hV.Players[i]
								|| RootsAt(myTypes.ContainsKey(bV.Players[c]) ? myTypes[bV.Players[c]] : null, hV.Players[i]))
								hitsV.Add(c);
						}
					if (hitsV.Count == 1) { atV[i] = hitsV[0]; continue; }
					if (hitsV.Count == 0)
					{
						if (konstSeen >= litsV.Count)
						{
							// A HEAD MAY SPECIALISE A ROLE WITHOUT NAMING A VALUE.
							//   * Person is subject to Minnesota Authority iff Person works in
							//     State 'Minnesota'.
							// The declared fact type is `Person is subject to Authority`; the head
							// names a SUBTYPE of that role and the body supplies no Authority at
							// all. What the rule says is that such a person is subject to the
							// Minnesota authorities -- the members of that subtype.
							if (subPlayerV != null && subTypeV != null && hV.Players[i] == subPlayerV)
							{
								crossAt[i] = true; anyCrossV = true; atV[i] = -1; continue;
							}
							okV = false; break;
						}
						konstAt[i] = konstSeen++; atV[i] = -1; continue;
					}
					okV = false; break;
				}
				// every literal must land somewhere, or the head says something this does not.
				// And there must BE a constant, on one side or the other: with none this is a
				// plain projection, which the projection-rename arm above already claims, and
				// adding a second path for the same rule would double-count it.
				if (!okV || konstSeen != litsV.Count) continue;
				if (litsV.Count == 0 && bodyLit == null && !anyCrossV) continue;
				// the restricted body role is the one no head role projects from; require
				// exactly one, and settle it BEFORE constructing anything so a decline cannot
				// leave a half-built rule in the store
				int condRole = -1;
				if (bodyLit != null)
				{
					for (int c = 0; c < bV.Roles.Count; c++)
					{
						bool used = false;
						for (int i = 0; i < hV.Roles.Count; i++) if (konstAt[i] < 0 && atV[i] == c) used = true;
						if (used) continue;
						if (condRole >= 0) { condRole = -2; break; }
						condRole = c;
					}
					if (condRole < 0) continue;
				}
				var ruleV = hV.Fact.DerivationRule as FactTypeDerivationRule;
				if (ruleV == null)
				{
					ruleV = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hV.Fact, ruleV);
					ApplyDerivationMarkers(hV.Fact, ruleV);
				}
				var leadV = new LeadRolePath(myStore);
				ruleV.OwnedLeadRolePathCollection.Add(leadV);
				new RolePathObjectTypeRoot(leadV, myTypes[bV.Players[0]]);
				var subV = new RoleSubPath(myStore);
				leadV.SubPathCollection.Add(subV);
				var stepV = new PathedRole[bV.Roles.Count];
				var entryV = new PathedRole(subV, bV.Roles[0]);
				entryV.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				stepV[0] = entryV;
				for (int c = 1; c < bV.Roles.Count; c++)
				{
					var stV = new PathedRole(subV, bV.Roles[c]);
					stV.PathedRolePurpose = PathedRolePurpose.SameFactType;
					stepV[c] = stV;
				}
				var projV = new RoleSetDerivationProjection(ruleV, leadV);
				for (int i = 0; i < hV.Roles.Count; i++)
				{
					var drpV = new DerivedRoleProjection(projV, hV.Roles[i]);
					if (konstAt[i] >= 0)
					{
						var pcV = new PathConstant(myStore);
						pcV.LexicalValue = litsV[konstAt[i]];
						new DerivedRoleProjectedFromPathConstant(drpV, pcV);
					}
					else if (crossAt[i])
					{
						// A LEG OVER THE SUBTYPE FACT, not a bare root. NORMA models a subtype as
						// a FactType with two roles, so this is an ordinary step: enter at the
						// subtype role, project the head from the supertype role. A root-only
						// sub-path builds too, and raises no error, but survives on the FIRST
						// lead path of a head only -- every later rule came out with the role
						// unconstrained, i.e. subject to EVERY Authority. Pathed roles do not
						// vanish that way.
						SubtypeFact sfV = null;
						foreach (SubtypeFact sf in myStore.ElementDirectory.FindElements<SubtypeFact>(true))
						{
							if (!sf.IsDeleted && sf.Subtype == subTypeV && sf.Supertype != null
								&& sf.Supertype.Name == hV.Players[i]) { sfV = sf; break; }
						}
						Role subRoleV = null, supRoleV = null;
						if (sfV != null)
							foreach (RoleBase rb in sfV.RoleCollection)
							{
								Role r = rb.Role;
								if (r.RolePlayer == subTypeV) subRoleV = r;
								else if (r.RolePlayer == sfV.Supertype) supRoleV = r;
							}
						if (subRoleV == null || supRoleV == null) { okV = false; break; }
						var stSp = new RoleSubPath(myStore);
						leadV.SubPathCollection.Add(stSp);
						// ROOTED AT THE SUBTYPE. Without its own root the sub-path continues from
						// where the lead left off -- the body's subject -- and NORMA read it as
						// "that PERSON is some Alpha Authority", an incompatible join. A
						// RoleSubPath may carry a root because it is itself a RolePath.
						new RolePathObjectTypeRoot(stSp, subTypeV);
						var stEntry = new PathedRole(stSp, subRoleV);
						stEntry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
						var stUp = new PathedRole(stSp, supRoleV);
						stUp.PathedRolePurpose = PathedRolePurpose.SameFactType;
						new DerivedRoleProjectedFromPathedRole(drpV, stUp);
					}
					else
					{
						new DerivedRoleProjectedFromPathedRole(drpV, stepV[atV[i]]);
					}
				}
				if (bodyLit != null)
				{
					var cpv = new CalculatedPathValue(myStore);
					cpv.Function = eqFnV;
					var cL = new CalculatedPathValueInput(myStore); cpv.InputCollection.Add(cL);
					var cR = new CalculatedPathValueInput(myStore); cpv.InputCollection.Add(cR);
					int pi = 0;
					foreach (FunctionParameter fp in eqFnV.ParameterCollection)
					{
						if (pi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(cL, fp);
						else if (pi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(cR, fp); break; }
						pi++;
					}
					new CalculatedPathValueInputBindsToPathedRole(cL, stepV[condRole]);
					var bpc = new PathConstant(myStore);
					bpc.LexicalValue = bodyLit;
					new CalculatedPathValueInputBindsToPathConstant(cR, bpc);
					leadV.CalculatedConditionCollection.Add(cpv);
				}
				var shownV = new List<string>();
				for (int i = 0; i < hV.Roles.Count; i++)
					if (konstAt[i] >= 0) shownV.Add(hV.Players[i] + " = '" + litsV[konstAt[i]] + "'");
				log.Add(hV.Fact.Name + " := proj " + bV.Fact.Name + " with "
					+ string.Join(", ", shownV) + ", " + DescribeDerivation(hV.Fact));
			}
			// THE SUBSCRIPTED TWO-LEG JOIN — the recursive step of a transitive closure:
			//     * Domain1 reaches Domain3 iff Domain1 reaches Domain2 and Domain2 reaches Domain3.
			// Same construction as the quantified two-leg arm above, but the join
			// variable is named by its SUBSCRIPT rather than introduced by
			// `some X ... and that X ...`, so that arm's regex never sees it. Its
			// legs resolved 2/2 the whole time: the clauses were found, no arm read them.
			//
			// Pairs with the projection arm: that one builds a closure's BASE case
			// (`* Domain1 reaches Domain2 iff Domain1 is contained in Domain2.`), this one
			// the inductive step, and a head needs both before its path count equals its
			// rule count. Canon's twin to reproduce:
			//     S2(A("DomainReachesDomain"), S4(A("join"), A("DomainReachesDomain"),
			//        A("DomainReachesDomain"), S2(N(1), N(3))))
			//
			// EXACTLY ONE TOKEN MAY BE SHARED BETWEEN THE LEGS. Status1 reaches Status3 in
			// State Machine Definition shares TWO (Status2 and the State Machine
			// Definition, the latter also a head player), and canon joins it on both:
			//     S5(A("joinon"), ..., S2(S2(N(2), N(1)), S2(N(3), N(3))), S3(N(1), N(5), N(3)))
			// A single-key join would silently drop the second equality and admit paths
			// across two different machines. So a second shared token DECLINES here and
			// waits for a multi-key arm rather than building a weaker rule that looks right.
			foreach (string sRaw3 in myDeferredRules)
			{
				string s3 = sRaw3;
				while (s3.StartsWith("* * ")) s3 = s3.Substring(2);
				Match m3 = Regex.Match(s3, @"^\* (.+?) iff (.+?) and (.+)\.$");
				if (!m3.Success) continue;
				// the quantified spelling belongs to the arm above
				if (Regex.IsMatch(s3, @"^\* (.+?) iff some ([A-Z][\w ]*?) (.+) and that \2 (.+)\.$")) continue;
				string head3 = m3.Groups[1].Value.Trim();
				string l1 = m3.Groups[2].Value.Trim(), l2 = m3.Groups[3].Value.Trim();
				// two legs only; conditions and negation are other arms' shapes
				if (l1.Contains(" and ") || l2.Contains(" and ")) continue;
				if (s3.Contains("'") || s3.Contains(" no ") || s3.Contains("not true")) continue;
				FactIndexEntry hE3 = FindEntryByNormalizedSentence(head3);
				FactIndexEntry aE = FindEntryByNormalizedSentence(Dequantify(" " + l1 + " ").Trim());
				FactIndexEntry bE = FindEntryByNormalizedSentence(Dequantify(" " + l2 + " ").Trim());
				if (hE3 == null || aE == null || bE == null) continue;
				List<string> ht = SubscriptedTokens(head3, hE3.Players);
				List<string> at3 = SubscriptedTokens(l1, aE.Players);
				List<string> bt3 = SubscriptedTokens(l2, bE.Players);
				if (ht == null || at3 == null || bt3 == null) continue;
				int ja = -1, jb = -1, shared = 0;
				for (int x = 0; x < at3.Count; x++)
				{
					for (int y = 0; y < bt3.Count; y++)
					{
						if (at3[x] != bt3[y]) continue;
						shared++;
						if (!ht.Contains(at3[x])) { ja = x; jb = y; }
					}
				}
				if (shared != 1 || ja < 0) continue;
				// LEG INDEX, NOT ENTRY IDENTITY. A self-join resolves both legs to the SAME
				// FactIndexEntry, so an identity test matches BOTH and each sub-path
				// received BOTH legs' steps -- duplicate roles in one path, which NORMA
				// rejects with "a same fact type role without a preceding fact type entry".
				// The recipe had the same bug and was fixed in 89ca02be; the PATH kept it,
				// and the recipe-only acceptance test could not see it.
				var located3 = new List<KeyValuePair<int, int>>();
				bool ok3 = true;
				for (int i = 0; i < ht.Count && ok3; i++)
				{
					var hits3 = new List<KeyValuePair<int, int>>();
					for (int c = 0; c < at3.Count; c++)
						if (c != ja && at3[c] == ht[i]) hits3.Add(new KeyValuePair<int, int>(0, c));
					for (int c = 0; c < bt3.Count; c++)
						if (c != jb && bt3[c] == ht[i]) hits3.Add(new KeyValuePair<int, int>(1, c));
					if (hits3.Count != 1) { ok3 = false; break; }
					located3.Add(hits3[0]);
				}
				if (!ok3) continue;
				ObjectType root3;
				if (!myTypes.TryGetValue(aE.Players[ja], out root3)) continue;
				var rule3 = hE3.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule3 == null)
				{
					rule3 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE3.Fact, rule3);
					ApplyDerivationMarkers(hE3.Fact, rule3);
				}
				var lead3 = new LeadRolePath(myStore);
				rule3.OwnedLeadRolePathCollection.Add(lead3);
				new RolePathObjectTypeRoot(lead3, root3);
				var steps3 = new PathedRole[hE3.Roles.Count];
				for (int leg = 0; leg < 2; leg++)
				{
					FactIndexEntry le = leg == 0 ? aE : bE;
					int jx = leg == 0 ? ja : jb;
					var sub3 = new RoleSubPath(myStore);
					lead3.SubPathCollection.Add(sub3);
					var entry3 = new PathedRole(sub3, le.Roles[jx]);
					entry3.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					for (int i = 0; i < located3.Count; i++)
					{
						if (located3[i].Key != leg) continue;
						var st3 = new PathedRole(sub3, le.Roles[located3[i].Value]);
						st3.PathedRolePurpose = PathedRolePurpose.SameFactType;
						steps3[i] = st3;
					}
				}
				var pr3 = new RoleSetDerivationProjection(rule3, lead3);
				for (int i = 0; i < hE3.Roles.Count && ok3; i++)
				{
					if (steps3[i] == null) { ok3 = false; break; }
					var drp3 = new DerivedRoleProjection(pr3, hE3.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp3, steps3[i]);
				}
				if (!ok3) continue;
				log.Add(hE3.Fact.Name + " := subscripted join over " + at3[ja] + " ("
					+ aE.Fact.Name + " x " + bE.Fact.Name + "), " + DescribeDerivation(hE3.Fact));
				// explicit leg indices, NOT RecordRuleRecipe: a self-join gives both legs
				// the same FactIndexEntry and its identity-keyed attribution breaks
				string rec3 = TwoLegJoinRecipe(hE3, aE, bE, at3, bt3, ja, jb, ht);
				if (rec3 != null)
				{
					var hp3 = new List<string>();
					foreach (string p in hE3.Players) hp3.Add(IAtom(p));
					myRuleRecipes.Add("S3(" + IAtom(hE3.Fact.Name) + ", S" + hp3.Count + "("
						+ string.Join(", ", hp3) + "), " + rec3 + ")");
				}
			}
			// THE MULTI-KEY TWO-LEG JOIN — two legs correlated on MORE THAN ONE variable:
			//     * Status1 reaches Status3 in State Machine Definition iff
			//       Status1 reaches Status2 in that State Machine Definition and
			//       Status2 reaches Status3 in that State Machine Definition.
			// Status2 is the join variable; the State Machine Definition is a SECOND
			// equality that also happens to be a head player. The single-key arm above
			// declines this on purpose -- joining on Status2 alone would admit a path
			// that walks from a status in one machine to a status in another, which
			// builds cleanly and is wrong.
			//
			// A second equality is not path structure, it is CORRELATION, and NORMA's
			// live mechanism for it is PathObjectUnifier (RolePath.cs:2551 --
			// PathedRoleIsRemotelyCorrelatedWithPathedRole is marked _Deprecated and
			// carries an UpgradeRemoteCorrelationToObjectUnifier path, so the unifier is
			// the one to build against). One unifier per extra shared variable, holding
			// the pathed role from each leg.
			//
			// Canon's twin, which is the acceptance test:
			//   S5(A("joinon"), A("StatusReachesStatusInStateMachineDefinition"),
			//      A("StatusReachesStatusInStateMachineDefinition"),
			//      S2(S2(N(2), N(1)), S2(N(3), N(3))), S3(N(1), N(5), N(3)))
			// keys are 1-based WITHIN each leg; out positions are 1-based over the
			// CONCATENATION, so leg2 position p is n1+p -- Status3 at leg2 role 2 with
			// n1=3 is N(5). Separate arm rather than a widening of the single-key one so
			// the eight rules that arm already reproduces cannot regress.
			foreach (string sRaw4 in myDeferredRules)
			{
				string s4 = sRaw4;
				while (s4.StartsWith("* * ")) s4 = s4.Substring(2);
				Match m4 = Regex.Match(s4, @"^\* (.+?) iff (.+?) and (.+)\.$");
				if (!m4.Success) continue;
				if (Regex.IsMatch(s4, @"^\* (.+?) iff some ([A-Z][\w ]*?) (.+) and that \2 (.+)\.$")) continue;
				string head4 = m4.Groups[1].Value.Trim();
				string g1 = m4.Groups[2].Value.Trim(), g2 = m4.Groups[3].Value.Trim();
				if (g1.Contains(" and ") || g2.Contains(" and ")) continue;
				if (s4.Contains("'") || s4.Contains(" no ") || s4.Contains("not true")) continue;
				FactIndexEntry hE4 = FindEntryByNormalizedSentence(head4);
				FactIndexEntry aE4 = FindEntryByNormalizedSentence(Dequantify(" " + g1 + " ").Trim());
				FactIndexEntry bE4 = FindEntryByNormalizedSentence(Dequantify(" " + g2 + " ").Trim());
				if (hE4 == null || aE4 == null || bE4 == null) continue;
				List<string> ht4 = SubscriptedTokens(head4, hE4.Players);
				List<string> at4 = SubscriptedTokens(g1, aE4.Players);
				List<string> bt4 = SubscriptedTokens(g2, bE4.Players);
				if (ht4 == null || at4 == null || bt4 == null) continue;
				// one key per DISTINCT token shared by the legs, at its first position in each
				var keys = new List<KeyValuePair<int, int>>();
				var seen4 = new List<string>();
				for (int x = 0; x < at4.Count; x++)
				{
					if (seen4.Contains(at4[x])) continue;
					int y = bt4.IndexOf(at4[x]);
					if (y < 0) continue;
					seen4.Add(at4[x]);
					keys.Add(new KeyValuePair<int, int>(x, y));
				}
				if (keys.Count < 2) continue;               // single-key is the arm above
				// the entry is the true join variable: shared and NOT a head player
				int entry4 = -1;
				for (int k = 0; k < keys.Count; k++)
					if (!ht4.Contains(at4[keys[k].Key])) { entry4 = k; break; }
				if (entry4 < 0) continue;
				// every head token must sit in one of the legs; leg1 wins, as canon reads it
				var srcLeg = new int[ht4.Count];
				var srcPos = new int[ht4.Count];
				bool ok4 = true;
				for (int i = 0; i < ht4.Count; i++)
				{
					int p = at4.IndexOf(ht4[i]);
					if (p >= 0 && p != keys[entry4].Key) { srcLeg[i] = 0; srcPos[i] = p; continue; }
					int q = bt4.IndexOf(ht4[i]);
					if (q >= 0 && q != keys[entry4].Value) { srcLeg[i] = 1; srcPos[i] = q; continue; }
					ok4 = false; break;
				}
				if (!ok4) continue;
				ObjectType root4;
				if (!myTypes.TryGetValue(aE4.Players[keys[entry4].Key], out root4)) continue;
				var rule4 = hE4.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule4 == null)
				{
					rule4 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE4.Fact, rule4);
					ApplyDerivationMarkers(hE4.Fact, rule4);
				}
				var lead4 = new LeadRolePath(myStore);
				rule4.OwnedLeadRolePathCollection.Add(lead4);
				new RolePathObjectTypeRoot(lead4, root4);
				// every position of both legs gets a pathed role, so correlations and
				// projections can name any of them
				var pa = new PathedRole[at4.Count];
				var pb = new PathedRole[bt4.Count];
				// ENTRY FIRST. PathedRoles are ORDERED within a sub-path, so creating them in
				// role order puts a SameFactType ahead of the entry whenever the entry is
				// not role 0 -- NORMA: "a same fact type role without a preceding fact type
				// entry". SRSISMD joins on key (2,1), so the left leg entered at role 2 and
				// tripped it every time. The recipe was correct throughout.
				var subA = new RoleSubPath(myStore);
				lead4.SubPathCollection.Add(subA);
				EnterLeg(subA, aE4, keys[entry4].Key, pa);
				var subB = new RoleSubPath(myStore);
				lead4.SubPathCollection.Add(subB);
				EnterLeg(subB, bE4, keys[entry4].Value, pb);
				for (int k = 0; k < keys.Count; k++)
				{
					if (k == entry4) continue;             // the entry IS the join; the rest correlate
					var unifier = new PathObjectUnifier(myStore.DefaultPartition);
					new LeadRolePathHasObjectUnifier(lead4, unifier);
					new PathObjectUnifierUnifiesPathedRole(unifier, pa[keys[k].Key]);
					new PathObjectUnifierUnifiesPathedRole(unifier, pb[keys[k].Value]);
				}
				var pr4 = new RoleSetDerivationProjection(rule4, lead4);
				for (int i = 0; i < hE4.Roles.Count; i++)
				{
					var drp4 = new DerivedRoleProjection(pr4, hE4.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp4, srcLeg[i] == 0 ? pa[srcPos[i]] : pb[srcPos[i]]);
				}
				log.Add(hE4.Fact.Name + " := " + keys.Count + "-key join (" + aE4.Fact.Name
					+ " x " + bE4.Fact.Name + "), " + DescribeDerivation(hE4.Fact));
				RecordJoinOnRecipe(hE4, aE4, bE4, keys, srcLeg, srcPos);
			}
			// THE STAR JOIN -- three or more legs all anchored on ONE shared variable:
			//     * Status1 has effective Transition1 to Status2 on Event Type iff
			//       Transition1 is from Status1 and Transition1 is to Status2 and
			//       Transition1 is triggered by Event Type.
			// Transition1 is the centre and is ALSO a head player, which is allowed: it is
			// the variable every leg enters on and a column the head projects.
			//
			// This head has FOUR players, and JoinRecipe refuses anything but a binary head
			// (`if (headE.Players.Count != 2) return null;`) because its whole shape is
			// "project the left leg down to <contributed, join>". That is why this rule
			// built in NORMA and emitted no recipe: canon learned nothing and the hand-
			// written twin stayed the only copy. The fold in StarJoinRecipe is the general
			// form; see its note for the index conventions.
			foreach (string sRaw5 in myDeferredRules)
			{
				string s5 = sRaw5;
				while (s5.StartsWith("* * ")) s5 = s5.Substring(2);
				Match m5 = Regex.Match(s5, @"^\* (.+?) iff (.+)\.$");
				if (!m5.Success) continue;
				if (s5.Contains("'") || s5.Contains(" no ") || s5.Contains("not true")) continue;
				string head5 = m5.Groups[1].Value.Trim();
				string[] rawLegs = m5.Groups[2].Value.Split(new[] { " and " }, StringSplitOptions.None);
				if (rawLegs.Length < 3) continue;            // two legs are the arms above
				FactIndexEntry hE5 = FindEntryByNormalizedSentence(head5);
				if (hE5 == null) continue;
				var legs = new List<FactIndexEntry>();
				var toks = new List<List<string>>();
				bool ok5 = true;
				foreach (string rl in rawLegs)
				{
					string lt = rl.Trim();
					FactIndexEntry le = FindEntryByNormalizedSentence(Dequantify(" " + lt + " ").Trim());
					if (le == null) { ok5 = false; break; }
					List<string> tk = SubscriptedTokens(lt, le.Players);
					if (tk == null) { ok5 = false; break; }
					legs.Add(le); toks.Add(tk);
				}
				if (!ok5) continue;
				List<string> ht5 = SubscriptedTokens(head5, hE5.Players);
				if (ht5 == null) continue;
				// the centre is the one token every leg carries
				string centreTok = null;
				foreach (string t in toks[0])
				{
					bool all = true;
					for (int i = 1; i < toks.Count && all; i++) if (!toks[i].Contains(t)) all = false;
					if (!all) continue;
					if (centreTok != null) { centreTok = null; break; }   // ambiguous centre
					centreTok = t;
				}
				if (centreTok == null) continue;
				var centre = new List<int>();
				foreach (var tk in toks) centre.Add(tk.IndexOf(centreTok));
				// the fold starts at the leg carrying head player 1
				int startLeg = -1;
				for (int i = 0; i < toks.Count && startLeg < 0; i++)
					for (int c = 0; c < toks[i].Count; c++)
						if (c != centre[i] && toks[i][c] == ht5[0]) { startLeg = i; break; }
				if (startLeg < 0) continue;
				// every head player at exactly one non-centre position, or IS the centre
				var loc5 = new List<KeyValuePair<int, int>>();
				for (int i = 0; i < ht5.Count && ok5; i++)
				{
					if (ht5[i] == centreTok) { loc5.Add(new KeyValuePair<int, int>(startLeg, centre[startLeg])); continue; }
					var hits5 = new List<KeyValuePair<int, int>>();
					for (int li = 0; li < toks.Count; li++)
						for (int c = 0; c < toks[li].Count; c++)
							if (c != centre[li] && toks[li][c] == ht5[i]) hits5.Add(new KeyValuePair<int, int>(li, c));
					if (hits5.Count != 1) { ok5 = false; break; }
					loc5.Add(hits5[0]);
				}
				if (!ok5) continue;
				string recipe5 = StarJoinRecipe(hE5, legs, toks, centre, ht5, startLeg);
				if (recipe5 == null) continue;               // no recipe, no build
				ObjectType root5;
				if (!myTypes.TryGetValue(legs[startLeg].Players[centre[startLeg]], out root5)) continue;
				var rule5 = hE5.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule5 == null)
				{
					rule5 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE5.Fact, rule5);
					ApplyDerivationMarkers(hE5.Fact, rule5);
				}
				var lead5 = new LeadRolePath(myStore);
				rule5.OwnedLeadRolePathCollection.Add(lead5);
				new RolePathObjectTypeRoot(lead5, root5);
				var prs = new List<PathedRole[]>();
				for (int li = 0; li < legs.Count; li++)
				{
					var sub5 = new RoleSubPath(myStore);
					lead5.SubPathCollection.Add(sub5);
					var row = new PathedRole[legs[li].Roles.Count];
					EnterLeg(sub5, legs[li], centre[li], row);   // entry first; see EnterLeg
					prs.Add(row);
				}
				var pj5 = new RoleSetDerivationProjection(rule5, lead5);
				for (int i = 0; i < hE5.Roles.Count; i++)
				{
					var drp5 = new DerivedRoleProjection(pj5, hE5.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp5, prs[loc5[i].Key][loc5[i].Value]);
				}
				var hp5 = new List<string>();
				foreach (string p in hE5.Players) hp5.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hE5.Fact.Name) + ", S" + hp5.Count + "("
					+ string.Join(", ", hp5) + "), " + recipe5 + ")");
				myBuiltRuleSentences.Add(sRaw5);
				log.Add(hE5.Fact.Name + " := star join on " + centreTok + " over " + legs.Count
					+ " legs, " + DescribeDerivation(hE5.Fact));
			}
			// NEGATION, shape one: `<positive> and it is not true that <negative>`.
			//     * Domain Change is valid iff that Domain Change is evaluated and
			//       it is not true that that Domain Change has blocking outcome.
			// Canon's twin is a set difference:
			//   S2(A("DomainChangeIsValid"), S3(A("minus"),
			//      S3(A("proj"), A("DomainChangeIsEvaluated"), S1(N(1))),
			//      A("DomainChangeHasBlockingOutcome")))
			//
			// NEGATION IS THE SHAPE WHERE A WRONG BUILD IS UNSOUND RATHER THAN MERELY
			// INCOMPLETE -- drop the negation and the rule asserts the opposite of what
			// the reading says, and it would still build, verbalize and populate. So the
			// negated branch carries RolePath.SplitIsNegated and the result is checked
			// against NORMA's OWN verbalization, not just against the recipe: if the
			// negation did not land in the model, NORMA re-verbalizes the rule without
			// it and the round trip says so.
			//
			// The paper reads this as an anti-join against a completed lower stratum
			// (sec. on negation: "A negated role path is an inference from absence"),
			// which is exactly `minus`. Stratification itself is Cor. 3's query and is
			// NOT checked here; this arm only refuses to build what it cannot express.
			foreach (string sRaw6 in myDeferredRules)
			{
				string s6 = sRaw6;
				while (s6.StartsWith("* * ")) s6 = s6.Substring(2);
				Match m6 = Regex.Match(s6, @"^\* (.+?) iff (.+?) and it is not true that (.+)\.$");
				if (!m6.Success) continue;
				string head6 = m6.Groups[1].Value.Trim();
				string posC = m6.Groups[2].Value.Trim(), negC = m6.Groups[3].Value.Trim();
				if (posC.Contains(" and ") || negC.Contains(" and ")) continue;
				FactIndexEntry hE6 = FindEntryByNormalizedSentence(head6);
				FactIndexEntry pE = FindEntryByNormalizedSentence(Dequantify(" " + posC + " ").Trim());
				FactIndexEntry nE = FindEntryByNormalizedSentence(Dequantify(" " + negC + " ").Trim());
				if (hE6 == null || pE == null || nE == null) continue;
				List<string> ht6 = SubscriptedTokens(head6, hE6.Players);
				List<string> pt = SubscriptedTokens(posC, pE.Players);
				List<string> nt = SubscriptedTokens(negC, nE.Players);
				if (ht6 == null || pt == null || nt == null) continue;
				// both sides must present exactly the head's columns for a set difference
				var pPos = new List<int>(); var nPos = new List<int>();
				bool ok6 = true;
				foreach (string h in ht6)
				{
					int a = pt.IndexOf(h), b = nt.IndexOf(h);
					if (a < 0 || b < 0) { ok6 = false; break; }
					pPos.Add(a); nPos.Add(b);
				}
				if (!ok6) continue;
				string leftSide = SideExpr(pE, pt.Count, pPos, true);
				string rightSide = SideExpr(nE, nt.Count, nPos, false);
				var rule6 = hE6.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule6 == null)
				{
					rule6 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE6.Fact, rule6);
					ApplyDerivationMarkers(hE6.Fact, rule6);
				}
				var lead6 = new LeadRolePath(myStore);
				rule6.OwnedLeadRolePathCollection.Add(lead6);
				new RolePathObjectTypeRoot(lead6, myTypes[hE6.Players[0]]);
				var subPos = new RoleSubPath(myStore);
				lead6.SubPathCollection.Add(subPos);
				var pRoles = new PathedRole[pE.Roles.Count];
				for (int c = 0; c < pE.Roles.Count; c++)
				{
					var pr = new PathedRole(subPos, pE.Roles[c]);
					pr.PathedRolePurpose = c == pPos[0] ? PathedRolePurpose.PostInnerJoin : PathedRolePurpose.SameFactType;
					pRoles[c] = pr;
				}
				// PathedRole.IsNegated, NOT RolePath.SplitIsNegated. The split flag negates
				// the COMBINATION of a path's children; setting it on the branch produced a
				// rule NORMA re-verbalized as "and  has blocking outcome" -- negation
				// silently dropped and the subject lost, i.e. the exact opposite of the
				// reading, built and populated without complaint. RolePath.cs:8264 names
				// the right mechanism: PathedRoleNegationState, "a negatable unary fact
				// type", which is what this clause is.
				var subNeg = new RoleSubPath(myStore);
				lead6.SubPathCollection.Add(subNeg);
				for (int c = 0; c < nE.Roles.Count; c++)
				{
					var nr = new PathedRole(subNeg, nE.Roles[c]);
					nr.PathedRolePurpose = c == nPos[0] ? PathedRolePurpose.PostInnerJoin : PathedRolePurpose.SameFactType;
					if (c != nPos[0]) nr.IsNegated = true;
				}
				if (nE.Roles.Count == 1) { foreach (PathedRole pr0 in subNeg.PathedRoleCollection) pr0.IsNegated = true; }
				var pj6 = new RoleSetDerivationProjection(rule6, lead6);
				for (int i = 0; i < hE6.Roles.Count; i++)
				{
					var drp6 = new DerivedRoleProjection(pj6, hE6.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp6, pRoles[pPos[i]]);
				}
				var hp6 = new List<string>();
				foreach (string p in hE6.Players) hp6.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hE6.Fact.Name) + ", S" + hp6.Count + "("
					+ string.Join(", ", hp6) + "), S3(A(\"minus\"), " + leftSide + ", " + rightSide + "))");
				log.Add(hE6.Fact.Name + " := minus (" + pE.Fact.Name + " less " + nE.Fact.Name
					+ "), " + DescribeDerivation(hE6.Fact));
			}
			// NEGATION, shape one and a half: THE POSITIVE SIDE IS THE TYPE ITSELF.
			//     * Billable Request is GDPR-compliant iff it is not true that that
			//       Billable Request involves Personal Data.
			// There is no positive clause to hang the negation on, and there does not
			// need to be: the rule says every Billable Request that is not one of THOSE.
			// The lead path roots at the head's own player, whose population is the left
			// side of the difference -- canon names a type's population with a bare atom,
			// exactly as `A("Domain Change")` already appears as an operand elsewhere in
			// state:rules. Unary head only: with two roles the "all" side would be a
			// cross product nobody wrote down.
			foreach (string sRaw6b in myDeferredRules)
			{
				string s6b = sRaw6b;
				while (s6b.StartsWith("* * ")) s6b = s6b.Substring(2);
				Match m6b = Regex.Match(s6b, @"^\* (.+?) iff it is not true that (.+)\.$");
				if (!m6b.Success) continue;
				string head6b = m6b.Groups[1].Value.Trim(), neg6b = m6b.Groups[2].Value.Trim();
				if (neg6b.Contains(" and ")) continue;
				FactIndexEntry hE6b = FindEntryByNormalizedSentence(head6b);
				FactIndexEntry nE6b = FindEntryByNormalizedSentence(Dequantify(" " + neg6b + " ").Trim());
				if (hE6b == null || nE6b == null || hE6b.Players.Count != 1) continue;
				int nAt6b = nE6b.Players.IndexOf(hE6b.Players[0]);
				if (nAt6b < 0) continue;
				int rules6b;
				rulesPerHead.TryGetValue(RuleHeadKey(head6b), out rules6b);
				var have6b = hE6b.Fact.DerivationRule as FactTypeDerivationRule;
				if (rules6b > 0 && have6b != null
					&& have6b.OwnedLeadRolePathCollection.Count >= rules6b) continue;
				ObjectType root6bT;
				if (!myTypes.TryGetValue(hE6b.Players[0], out root6bT)) continue;
				var rule6b = have6b;
				if (rule6b == null)
				{
					rule6b = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE6b.Fact, rule6b);
					ApplyDerivationMarkers(hE6b.Fact, rule6b);
				}
				var lead6b = new LeadRolePath(myStore);
				rule6b.OwnedLeadRolePathCollection.Add(lead6b);
				var root6b = new RolePathObjectTypeRoot(lead6b, root6bT);
				var subN6b = new RoleSubPath(myStore);
				lead6b.SubPathCollection.Add(subN6b);
				for (int c = 0; c < nE6b.Roles.Count; c++)
				{
					var nr6b = new PathedRole(subN6b, nE6b.Roles[c]);
					nr6b.PathedRolePurpose = c == nAt6b ? PathedRolePurpose.PostInnerJoin : PathedRolePurpose.SameFactType;
					if (c != nAt6b) nr6b.IsNegated = true;
				}
				if (nE6b.Roles.Count == 1) { foreach (PathedRole pr6b in subN6b.PathedRoleCollection) pr6b.IsNegated = true; }
				var pj6b = new RoleSetDerivationProjection(rule6b, lead6b);
				var drp6b = new DerivedRoleProjection(pj6b, hE6b.Roles[0]);
				new DerivedRoleProjectedFromRolePathRoot(drp6b, root6b);
				myRuleRecipes.Add("S3(" + IAtom(hE6b.Fact.Name) + ", S1(" + IAtom(hE6b.Players[0])
					+ "), S3(A(\"minus\"), " + IAtom(hE6b.Players[0]) + ", " + IAtom(nE6b.Fact.Name) + "))");
				log.Add(hE6b.Fact.Name + " := minus (" + hE6b.Players[0] + " less " + nE6b.Fact.Name
					+ "), " + DescribeDerivation(hE6b.Fact));
			}
			// NEGATION, shape two: `<positive> and no <X> <clause> where <clause>`.
			//     * Status is terminal in SMD iff that Status is defined in that SMD and
			//       no Transition is defined in that SMD where that Transition is from
			//       that Status.
			//     * Status is rooted in SMD iff some Transition is defined in that SMD and
			//       that Transition is from that Status and no Transition is defined in
			//       that SMD where that Transition is to that Status.
			// Either side may be a two-leg join; the rooted one is
			// minus(join(...from...), join(...to...)). Both sides go through BuildChain,
			// and the negated one carries PathedRole.IsNegated so NORMA renders it with
			// NegatedChainedList ("it is not true that (") rather than NegatedAndList
			// ("at least one of the following is false"), which would be De Morgan.
			foreach (string sRaw7 in myDeferredRules)
			{
				string s7 = sRaw7;
				while (s7.StartsWith("* * ")) s7 = s7.Substring(2);
				Match m7 = Regex.Match(s7, @"^\* (.+?) iff (.+)\.$");
				if (!m7.Success) continue;
				string[] halves = m7.Groups[2].Value.Split(new[] { " and no " }, StringSplitOptions.None);
				if (halves.Length != 2) continue;
				string[] negParts = halves[1].Split(new[] { " where " }, StringSplitOptions.None);
				if (negParts.Length != 2) continue;
				string head7 = m7.Groups[1].Value.Trim();
				FactIndexEntry hE7 = FindEntryByNormalizedSentence(head7);
				if (hE7 == null || hE7.Fact.DerivationRule != null) continue;
				List<string> ht7 = SubscriptedTokens(head7, hE7.Players);
				if (ht7 == null) continue;
				var posL = new List<FactIndexEntry>(); var posT = new List<List<string>>();
				var negL = new List<FactIndexEntry>(); var negT = new List<List<string>>();
				bool ok7 = true;
				foreach (string raw in halves[0].Split(new[] { " and " }, StringSplitOptions.None))
				{
					string c = raw.Trim();
					FactIndexEntry e = FindEntryByNormalizedSentence(Dequantify(" " + c + " ").Trim());
					List<string> t = e == null ? null : SubscriptedTokens(c, e.Players);
					if (t == null) { ok7 = false; break; }
					posL.Add(e); posT.Add(t);
				}
				foreach (string raw in negParts)
				{
					string c = raw.Trim();
					FactIndexEntry e = FindEntryByNormalizedSentence(Dequantify(" " + c + " ").Trim());
					List<string> t = e == null ? null : SubscriptedTokens(c, e.Players);
					if (t == null) { ok7 = false; break; }
					negL.Add(e); negT.Add(t);
				}
				if (!ok7 || posL.Count == 0 || negL.Count != 2) continue;
				string lhs = SideFromLegs(posL, posT, ht7);
				string rhs = SideFromLegs(negL, negT, ht7);
				if (lhs == null || rhs == null) continue;
				var rule7 = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(hE7.Fact, rule7);
				ApplyDerivationMarkers(hE7.Fact, rule7);
				var lead7 = new LeadRolePath(myStore);
				rule7.OwnedLeadRolePathCollection.Add(lead7);
				new RolePathObjectTypeRoot(lead7, myTypes[hE7.Players[0]]);
				PathedRole[][] posSlots = BuildChain(lead7, posL, posT, ht7[0], false);
				PathedRole[][] negSlots = BuildChain(lead7, negL, negT, ht7[0], true);
				if (posSlots == null || negSlots == null) continue;
				var headPR7 = new PathedRole[ht7.Count];
				for (int li = 0; li < posL.Count; li++)
					for (int c = 0; c < posT[li].Count; c++)
					{
						int hi = ht7.IndexOf(posT[li][c]);
						if (hi >= 0 && headPR7[hi] == null) headPR7[hi] = posSlots[li][c];
					}
				for (int i = 0; i < ht7.Count && ok7; i++) if (headPR7[i] == null) ok7 = false;
				if (!ok7) continue;
				// "no Transition is defined in THAT State Machine Definition" -- the negated
				// branch's SMD is the head's, not a fresh one. Without the unifier NORMA
				// reads it as "some State Machine Definition" and the rule is wrong: it
				// would exclude a status that has an outgoing transition in ANY machine.
				for (int li = 0; li < negL.Count; li++)
					for (int c = 0; c < negT[li].Count; c++)
					{
						int hi = ht7.IndexOf(negT[li][c]);
						if (hi <= 0) continue;               // head token 0 is the shared root
						var u7 = new PathObjectUnifier(myStore.DefaultPartition);
						new LeadRolePathHasObjectUnifier(lead7, u7);
						new PathObjectUnifierUnifiesPathedRole(u7, headPR7[hi]);
						new PathObjectUnifierUnifiesPathedRole(u7, negSlots[li][c]);
					}
				var pj7 = new RoleSetDerivationProjection(rule7, lead7);
				for (int i = 0; i < hE7.Roles.Count; i++)
				{
					var drp7 = new DerivedRoleProjection(pj7, hE7.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp7, headPR7[i]);
				}
				var hp7 = new List<string>();
				foreach (string p in hE7.Players) hp7.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hE7.Fact.Name) + ", S" + hp7.Count + "("
					+ string.Join(", ", hp7) + "), S3(A(\"minus\"), " + lhs + ", " + rhs + "))");
				log.Add(hE7.Fact.Name + " := minus with negated chain, " + DescribeDerivation(hE7.Fact));
			}
			// THE SUBTYPE-NARROWED SINGLE LEG. The clause names a SUBTYPE where the fact
			// type declares its SUPERTYPE, so the clause does not resolve at all:
			//     * Domain Change has blocking outcome iff some Failure is triggered by
			//       that Domain Change.
			// `Failure is triggered by Object Type Instance` is what is declared, and
			// `Domain Change is a subtype of Object Type Instance`. The projection arm
			// declined this correctly -- a bare projection of the supertype role would
			// answer with every Object Type Instance, not only the Domain Changes.
			//
			// Canon narrows by joining against the SUBTYPE'S OWN POPULATION:
			//   S5(A("joinon"), A("FailureIsTriggeredByObjectTypeInstance"),
			//      A("Domain Change"), S1(S2(N(2), N(1))), S1(N(3)))
			// so the concatenation is <fact type columns> ++ <the subtype column>, and the
			// head reads the narrowed column at n+1 rather than the supertype role at n.
			foreach (string sRaw8 in myDeferredRules)
			{
				string s8 = sRaw8;
				while (s8.StartsWith("* * ")) s8 = s8.Substring(2);
				Match m8 = Regex.Match(s8, @"^\* (.+?) iff (.+)\.$");
				if (!m8.Success) continue;
				string body8 = m8.Groups[2].Value.Trim();
				if (body8.Contains(" and ") || body8.Contains("'")) continue;
				string head8 = m8.Groups[1].Value.Trim();
				FactIndexEntry hE8 = FindEntryByNormalizedSentence(head8);
				if (hE8 == null || hE8.Fact.DerivationRule != null) continue;
				string clause8 = Dequantify(" " + body8 + " ").Trim();
				if (FindEntryByNormalizedSentence(clause8) != null) continue;  // proj arm's
				FactIndexEntry sE8 = null; string narrowType = null;
				foreach (KeyValuePair<string, ObjectType> kv in myTypes)
				{
					if (kv.Value.IsDeleted) continue;
					if (clause8.IndexOf(kv.Key, StringComparison.Ordinal) < 0) continue;
					foreach (ObjectType sup in kv.Value.SupertypeCollection)
					{
						FactIndexEntry cand = FindEntryByNormalizedSentence(clause8.Replace(kv.Key, sup.Name));
						if (cand == null) continue;
						sE8 = cand; narrowType = kv.Key; break;
					}
					if (sE8 != null) break;
				}
				if (sE8 == null) continue;
				// the narrowed role is the one played by the SUPERTYPE, and it must be unique
				int npos = -1; bool amb8 = false;
				ObjectType subOT8 = myTypes[narrowType];
				for (int c = 0; c < sE8.Players.Count; c++)
				{
					bool isSup = false;
					foreach (ObjectType sup in subOT8.SupertypeCollection) if (sE8.Players[c] == sup.Name) isSup = true;
					if (!isSup) continue;
					if (npos >= 0) { amb8 = true; break; }
					npos = c;
				}
				if (amb8 || npos < 0) continue;
				List<string> ht8 = SubscriptedTokens(head8, hE8.Players);
				if (ht8 == null) continue;
				int n8 = sE8.Players.Count;
				var outs8 = new List<string>();
				bool ok8 = true;
				foreach (string h in ht8)
				{
					if (h == narrowType) { outs8.Add("N(" + (n8 + 1) + ")"); continue; }
					int p = sE8.Players.IndexOf(h);
					if (p < 0) { ok8 = false; break; }
					outs8.Add("N(" + (p + 1) + ")");
				}
				if (!ok8) continue;
				var rule8 = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(hE8.Fact, rule8);
				ApplyDerivationMarkers(hE8.Fact, rule8);
				var lead8 = new LeadRolePath(myStore);
				rule8.OwnedLeadRolePathCollection.Add(lead8);
				new RolePathObjectTypeRoot(lead8, myTypes[hE8.Players[0]]);
				var sub8 = new RoleSubPath(myStore);
				lead8.SubPathCollection.Add(sub8);
				var row8 = new PathedRole[sE8.Roles.Count];
				EnterLeg(sub8, sE8, npos, row8);
				var pj8 = new RoleSetDerivationProjection(rule8, lead8);
				for (int i = 0; i < hE8.Roles.Count; i++)
				{
					var drp8 = new DerivedRoleProjection(pj8, hE8.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp8, row8[npos]);
				}
				var hp8 = new List<string>();
				foreach (string p in hE8.Players) hp8.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hE8.Fact.Name) + ", S" + hp8.Count + "("
					+ string.Join(", ", hp8) + "), S5(A(\"joinon\"), " + IAtom(sE8.Fact.Name)
					+ ", " + IAtom(narrowType) + ", S1(S2(N(" + (npos + 1) + "), N(1))), S"
					+ outs8.Count + "(" + string.Join(", ", outs8) + ")))");
				log.Add(hE8.Fact.Name + " := narrowed to " + narrowType + " over " + sE8.Fact.Name
					+ ", " + DescribeDerivation(hE8.Fact));
			}
			// TWO LEGS WITH A CONSTANT CONDITION on the second:
			//     * Domain Change has blocking outcome iff some Violation is triggered by
			//       that Domain Change and that Violation has Severity 'error'.
			// Canon builds a four-stage pipeline, and every stage is a piece already here:
			//   proj( sel( joinon( joinon(VITOTI, "Domain Change", <(2,1)>, <1,3>),
			//                      ViolationHasSeverity, <(1,1)>, <2,4>),
			//              2, "error"),
			//         <1> )
			// The inner joinon is the SUBTYPE NARROWING from ed20c820 -- leg one names
			// Domain Change where the fact type declares Object Type Instance -- except
			// that here it must KEEP the join variable as well, so out is <1,3>: the
			// original columns with the supertype role replaced by the narrowed one.
			// Then leg two joins on the shared Violation, the constant filters the role it
			// fills, and the head is projected out.
			foreach (string sRaw9 in myDeferredRules)
			{
				string s9 = sRaw9;
				while (s9.StartsWith("* * ")) s9 = s9.Substring(2);
				Match m9 = Regex.Match(s9, @"^\* (.+?) iff (.+?) and (.+?) '([^']*)'\.$");
				if (!m9.Success) continue;
				string head9 = m9.Groups[1].Value.Trim();
				string c1 = m9.Groups[2].Value.Trim(), c2 = m9.Groups[3].Value.Trim();
				string konst = m9.Groups[4].Value;
				if (c1.Contains(" and ") || c2.Contains(" and ")) continue;
				FactIndexEntry hE9 = FindEntryByNormalizedSentence(head9);
				if (hE9 == null) continue;
				List<string> ht9 = SubscriptedTokens(head9, hE9.Players);
				if (ht9 == null) continue;
				// leg one, narrowing to a subtype if the clause names one
				string q1 = Dequantify(" " + c1 + " ").Trim();
				FactIndexEntry e1 = FindEntryByNormalizedSentence(q1);
				string narrow9 = null; int np9 = -1;
				if (e1 == null)
				{
					foreach (KeyValuePair<string, ObjectType> kv in myTypes)
					{
						if (kv.Value.IsDeleted) continue;
						if (q1.IndexOf(kv.Key, StringComparison.Ordinal) < 0) continue;
						foreach (ObjectType sup in kv.Value.SupertypeCollection)
						{
							FactIndexEntry cand = FindEntryByNormalizedSentence(q1.Replace(kv.Key, sup.Name));
							if (cand == null) continue;
							e1 = cand; narrow9 = kv.Key; break;
						}
						if (e1 != null) break;
					}
					if (e1 == null) continue;
					bool amb9 = false;
					for (int c = 0; c < e1.Players.Count; c++)
					{
						bool isSup = false;
						foreach (ObjectType sup in myTypes[narrow9].SupertypeCollection) if (e1.Players[c] == sup.Name) isSup = true;
						if (!isSup) continue;
						if (np9 >= 0) { amb9 = true; break; }
						np9 = c;
					}
					if (amb9 || np9 < 0) continue;
				}
				FactIndexEntry e2 = FindEntryByNormalizedSentence(Dequantify(" " + c2 + " ").Trim());
				if (e2 == null) continue;
				// leg one's columns, with the supertype role replaced by the narrowed one
				var cols1 = new List<string>(e1.Players);
				string expr1 = IAtom(e1.Fact.Name);
				if (narrow9 != null)
				{
					var o1 = new List<string>();
					for (int c = 0; c < e1.Players.Count; c++)
						o1.Add("N(" + (c == np9 ? e1.Players.Count + 1 : c + 1) + ")");
					expr1 = "S5(A(\"joinon\"), " + IAtom(e1.Fact.Name) + ", " + IAtom(narrow9)
						+ ", S1(S2(N(" + (np9 + 1) + "), N(1))), S" + o1.Count + "("
						+ string.Join(", ", o1) + "))";
					cols1[np9] = narrow9;
				}
				// the shared variable, and the role the constant fills
				int p1 = -1, p2 = -1;
				for (int x = 0; x < cols1.Count && p1 < 0; x++)
				{
					int y = e2.Players.IndexOf(cols1[x]);
					if (y >= 0) { p1 = x; p2 = y; }
				}
				if (p1 < 0) continue;
				int kpos = -1;
				for (int y = 0; y < e2.Players.Count; y++) if (y != p2) { kpos = y; break; }
				if (kpos < 0) continue;
				// concatenation is cols1 ++ e2 players; keep the head columns then the
				// constant's, which is the order canon's <2,4> records
				var outs9 = new List<string>(); var keep = new List<string>();
				bool ok9 = true;
				foreach (string h in ht9)
				{
					int p = cols1.IndexOf(h);
					if (p < 0) { ok9 = false; break; }
					outs9.Add("N(" + (p + 1) + ")"); keep.Add(h);
				}
				if (!ok9) continue;
				outs9.Add("N(" + (cols1.Count + kpos + 1) + ")");
				// GET-OR-CREATE: DomainChangeHasBlockingOutcome has TWO rules and the
				// narrowing arm claims the head first, so a `DerivationRule != null` guard
				// silently skipped this one -- the arm never fired and looked like a
				// non-matching regex.
				var rule9 = hE9.Fact.DerivationRule as FactTypeDerivationRule;
				if (rule9 == null)
				{
					rule9 = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hE9.Fact, rule9);
					ApplyDerivationMarkers(hE9.Fact, rule9);
				}
				var lead9 = new LeadRolePath(myStore);
				rule9.OwnedLeadRolePathCollection.Add(lead9);
				new RolePathObjectTypeRoot(lead9, myTypes[hE9.Players[0]]);
				// CHAIN, DO NOT SIBLING. Two sub-paths both hanging off the lead root are
				// two independent ENTRIES, and NORMA rejects the second when its entry role
				// is not played by the root type: "joins to a path role with an incompatible
				// role player". Measured on auto.dev, which the metamodel never exposed --
				//   * API response indicates success iff API response has HTTP Status that
				//     has HTTP Status Class 'success'.
				// roots at API Response, and leg two enters at HTTP Status, which the root
				// does not play. The path has to walk API Response -> HTTP Status -> Class.
				var toks9 = new List<List<string>>();
				toks9.Add(cols1);
				toks9.Add(new List<string>(e2.Players));
				var legs9 = new List<FactIndexEntry>(); legs9.Add(e1); legs9.Add(e2);
				PathedRole[][] rows9 = BuildChain(lead9, legs9, toks9, ht9[0], false);
				if (rows9 == null) continue;
				var pj9 = new RoleSetDerivationProjection(rule9, lead9);
				for (int i = 0; i < hE9.Roles.Count; i++)
				{
					int lp9 = cols1.IndexOf(ht9[i]);
					if (lp9 < 0) { ok9 = false; break; }
					var drp9 = new DerivedRoleProjection(pj9, hE9.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp9, rows9[0][lp9]);
				}
				if (!ok9) continue;
				var hp9 = new List<string>();
				foreach (string p in hE9.Players) hp9.Add(IAtom(p));
				string joined = "S5(A(\"joinon\"), " + expr1 + ", " + IAtom(e2.Fact.Name)
					+ ", S1(S2(N(" + (p1 + 1) + "), N(" + (p2 + 1) + "))), S" + outs9.Count
					+ "(" + string.Join(", ", outs9) + "))";
				var proj9 = new List<string>();
				for (int i = 0; i < keep.Count; i++) proj9.Add("N(" + (i + 1) + ")");
				myRuleRecipes.Add("S3(" + IAtom(hE9.Fact.Name) + ", S" + hp9.Count + "("
					+ string.Join(", ", hp9) + "), S3(A(\"proj\"), S4(A(\"sel\"), " + joined
					+ ", N(" + outs9.Count + "), " + IAtom(konst) + "), S" + proj9.Count
					+ "(" + string.Join(", ", proj9) + ")))");
				log.Add(hE9.Fact.Name + " := constant condition '" + konst + "' over "
					+ e1.Fact.Name + " x " + e2.Fact.Name + ", " + DescribeDerivation(hE9.Fact));
			}
			// NEGATION, shape three: `<positive> and no <clause>` with NO `where`.
			//     * Status is effective initial in State Machine Definition iff that Status
			//       is rooted in that State Machine Definition and no Status is initial in
			//       that State Machine Definition.
			// The negated clause shares only SOME of the head's variables: `that State
			// Machine Definition` is the head's, while `Status` carries no `that` and is a
			// fresh existential -- the reading is "that machine has no initial status at
			// all", not "this status is not initial". Canon subtracts the positive rows
			// whose bound variables satisfy the negated clause:
			//   S3(A("minus"), A("StatusIsRootedInStateMachineDefinition"),
			//      S5(A("joinon"), A("StatusIsRootedInStateMachineDefinition"),
			//         A("StatusIsInitialInStateMachineDefinition"),
			//         S1(S2(N(2), N(2))), S2(N(1), N(2))))
			// Joining on BOTH positions instead would subtract only statuses that are
			// themselves initial -- a rule that builds and quietly means something else.
			foreach (string sRawA in myDeferredRules)
			{
				string sA = sRawA;
				while (sA.StartsWith("* * ")) sA = sA.Substring(2);
				Match arM = Regex.Match(sA, @"^\* (.+?) iff (.+?) and no (.+)\.$");
				if (!arM.Success) continue;
				string negCl = arM.Groups[3].Value.Trim();
				if (negCl.Contains(" where ") || negCl.Contains(" and ")) continue;   // other arms
				string posCl = arM.Groups[2].Value.Trim();
				if (posCl.Contains(" and ") || sA.Contains("'")) continue;
				string headA = arM.Groups[1].Value.Trim();
				FactIndexEntry hEA = FindEntryByNormalizedSentence(headA);
				FactIndexEntry pEA = FindEntryByNormalizedSentence(Dequantify(" " + posCl + " ").Trim());
				FactIndexEntry nEA = FindEntryByNormalizedSentence(Dequantify(" " + negCl + " ").Trim());
				if (hEA == null || pEA == null || nEA == null) continue;
				List<string> htA = SubscriptedTokens(headA, hEA.Players);
				List<string> ptA = SubscriptedTokens(posCl, pEA.Players);
				if (htA == null || ptA == null) continue;
				// the positive side must present exactly the head's columns
				var pposA = new List<int>();
				bool okA = true;
				foreach (string h in htA)
				{
					int p = ptA.IndexOf(h);
					if (p < 0) { okA = false; break; }
					pposA.Add(p);
				}
				if (!okA) continue;
				string leftA = SideExpr(pEA, ptA.Count, pposA, false);
				// keys: one per BOUND role of the negated clause
				bool[] bnd = BoundPositions(negCl, nEA.Players);
				var keysA = new List<string>();
				for (int c = 0; c < nEA.Players.Count; c++)
				{
					if (!bnd[c]) continue;
					int hp = htA.IndexOf(nEA.Players[c]);
					if (hp < 0) { okA = false; break; }
					keysA.Add("S2(N(" + (hp + 1) + "), N(" + (c + 1) + "))");
				}
				if (!okA || keysA.Count == 0) continue;
				var outA = new List<string>();
				for (int i = 0; i < htA.Count; i++) outA.Add("N(" + (i + 1) + ")");
				string rightA = "S5(A(\"joinon\"), " + leftA + ", " + IAtom(nEA.Fact.Name)
					+ ", S" + keysA.Count + "(" + string.Join(", ", keysA) + "), S" + outA.Count
					+ "(" + string.Join(", ", outA) + "))";
				var ruleA = hEA.Fact.DerivationRule as FactTypeDerivationRule;
				if (ruleA == null)
				{
					ruleA = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hEA.Fact, ruleA);
					ApplyDerivationMarkers(hEA.Fact, ruleA);
				}
				var leadA = new LeadRolePath(myStore);
				ruleA.OwnedLeadRolePathCollection.Add(leadA);
				new RolePathObjectTypeRoot(leadA, myTypes[hEA.Players[0]]);
				var spA = new RoleSubPath(myStore);
				leadA.SubPathCollection.Add(spA);
				var rowA = new PathedRole[pEA.Roles.Count];
				EnterLeg(spA, pEA, pposA[0], rowA);
				var spN = new RoleSubPath(myStore);
				leadA.SubPathCollection.Add(spN);
				var rowN = new PathedRole[nEA.Roles.Count];
				int nEntry = 0;
				for (int c = 0; c < nEA.Players.Count; c++) if (bnd[c]) { nEntry = c; break; }
				EnterLeg(spN, nEA, nEntry, rowN);
				if (spN.PathedRoleCollection.Count > 0) spN.PathedRoleCollection[0].IsNegated = true;
				var pjA = new RoleSetDerivationProjection(ruleA, leadA);
				for (int i = 0; i < hEA.Roles.Count; i++)
				{
					var drpA = new DerivedRoleProjection(pjA, hEA.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drpA, rowA[pposA[i]]);
				}
				var hpA = new List<string>();
				foreach (string p in hEA.Players) hpA.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hEA.Fact.Name) + ", S" + hpA.Count + "("
					+ string.Join(", ", hpA) + "), S3(A(\"minus\"), " + leftA + ", " + rightA + "))");
				log.Add(hEA.Fact.Name + " := minus on bound-only negation, " + DescribeDerivation(hEA.Fact));
			}
			// boolean LessThan, created on first use by the comparison arm below
			Function ltFn = null;
			// THE VALUE COMPARISON AS A DERIVATION (not a constraint):
			//     * Failure succeeds Violation iff that Violation occurred at some Timestamp
			//       and that Failure occurred at some Timestamp where that Violation
			//       Timestamp is before that Failure Timestamp.
			// The two legs share NO variable -- each `some Timestamp` is its own -- so canon
			// takes the CARTESIAN product and then theta-restricts, which is Codd 1972's
			// identity R[A theta B]S = (R x S)[A theta B] written out:
			//   S3(A("proj"), S4(A("cmp"),
			//        S5(A("joinon"), A("ViolationOccurredAtTimestamp"),
			//           A("FailureOccurredAtTimestamp"), PHI(), S4(N(1),N(2),N(3),N(4))),
			//        N(2), N(4)), S2(N(3), N(1)))
			// PHI() in the key slot IS the Cartesian product; `cmp` is the restriction.
			//
			// `cmp` is hard-wired to strict less-than (derive:keep_cmp is not-ge), so
			// `after` is expressed by swapping the operands rather than by another operator.
			foreach (string sRawB in myDeferredRules)
			{
				string sB = sRawB;
				while (sB.StartsWith("* * ")) sB = sB.Substring(2);
				Match bm = Regex.Match(sB, @"^\* (.+?) iff (.+?) and (.+?) where (.+?) is (before|after) (.+)\.$");
				if (!bm.Success) continue;
				string headB = bm.Groups[1].Value.Trim();
				FactIndexEntry hEB = FindEntryByNormalizedSentence(headB);
				if (hEB == null) continue;
				FactIndexEntry L1 = FindEntryByNormalizedSentence(Dequantify(" " + bm.Groups[2].Value.Trim() + " ").Trim());
				FactIndexEntry L2 = FindEntryByNormalizedSentence(Dequantify(" " + bm.Groups[3].Value.Trim() + " ").Trim());
				if (L1 == null || L2 == null) continue;
				List<string> htB = SubscriptedTokens(headB, hEB.Players);
				if (htB == null) continue;
				// an operand is `that <Player> <ValueType>`, naming a role of one leg
				var legs2 = new List<FactIndexEntry>(); legs2.Add(L1); legs2.Add(L2);
				int[] oLeg = new int[2], oPos = new int[2];
				bool okB = true;
				for (int k = 0; k < 2; k++)
				{
					string op = (k == 0 ? bm.Groups[4].Value : bm.Groups[6].Value).Trim();
					if (op.StartsWith("that ")) op = op.Substring(5).Trim();
					int fl = -1, fp = -1;
					for (int li = 0; li < 2 && fl < 0; li++)
						for (int i = 0; i < legs2[li].Players.Count && fl < 0; i++)
							for (int j = 0; j < legs2[li].Players.Count; j++)
							{
								if (i == j) continue;
								if (op != legs2[li].Players[i] + " " + legs2[li].Players[j]) continue;
								fl = li; fp = j; break;
							}
					if (fl < 0) { okB = false; break; }
					oLeg[k] = fl; oPos[k] = fp;
				}
				if (!okB) continue;
				int n1 = L1.Players.Count, n2 = L2.Players.Count;
				// `after` is `<` with the operands the other way round
				int aIdx = bm.Groups[5].Value == "before" ? 0 : 1, bIdx = 1 - aIdx;
				int cA = (oLeg[aIdx] == 0 ? 0 : n1) + oPos[aIdx] + 1;
				int cB = (oLeg[bIdx] == 0 ? 0 : n1) + oPos[bIdx] + 1;
				var idB = new List<string>();
				for (int i = 1; i <= n1 + n2; i++) idB.Add("N(" + i + ")");
				var outB = new List<string>();
				foreach (string h in htB)
				{
					int p = L1.Players.IndexOf(h);
					if (p >= 0) { outB.Add("N(" + (p + 1) + ")"); continue; }
					p = L2.Players.IndexOf(h);
					if (p < 0) { okB = false; break; }
					outB.Add("N(" + (n1 + p + 1) + ")");
				}
				if (!okB) continue;
				var ruleB = hEB.Fact.DerivationRule as FactTypeDerivationRule;
				if (ruleB == null)
				{
					ruleB = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hEB.Fact, ruleB);
					ApplyDerivationMarkers(hEB.Fact, ruleB);
				}
				var leadB = new LeadRolePath(myStore);
				ruleB.OwnedLeadRolePathCollection.Add(leadB);
				new RolePathObjectTypeRoot(leadB, myTypes[hEB.Players[0]]);
				var spB1 = new RoleSubPath(myStore); leadB.SubPathCollection.Add(spB1);
				var rB1 = new PathedRole[L1.Roles.Count]; EnterLeg(spB1, L1, 0, rB1);
				var spB2 = new RoleSubPath(myStore); leadB.SubPathCollection.Add(spB2);
				var rB2 = new PathedRole[L2.Roles.Count]; EnterLeg(spB2, L2, 0, rB2);
				// the condition itself, as a boolean Function over the two pathed roles --
				// the same CalculatedPathValue machinery the value-condition arm uses for
				// Equals, so the MODEL carries the comparison and not just the recipe
				if (ltFn == null)
				{
					ltFn = new Function(myStore);
					ltFn.Name = "LessThan";
					ltFn.IsBoolean = true;
					ltFn.Model = myModel;
					var lp = new FunctionParameter(myStore); lp.Function = ltFn; lp.Name = "left";
					var rp = new FunctionParameter(myStore); rp.Function = ltFn; rp.Name = "right";
				}
				var cpvB = new CalculatedPathValue(myStore);
				cpvB.Function = ltFn;
				var inL = new CalculatedPathValueInput(myStore); cpvB.InputCollection.Add(inL);
				var inR = new CalculatedPathValueInput(myStore); cpvB.InputCollection.Add(inR);
				int bpi = 0;
				foreach (FunctionParameter fp2 in ltFn.ParameterCollection)
				{
					if (bpi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(inL, fp2);
					else if (bpi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(inR, fp2); break; }
					bpi++;
				}
				new CalculatedPathValueInputBindsToPathedRole(inL, (oLeg[aIdx] == 0 ? rB1 : rB2)[oPos[aIdx]]);
				new CalculatedPathValueInputBindsToPathedRole(inR, (oLeg[bIdx] == 0 ? rB1 : rB2)[oPos[bIdx]]);
				leadB.CalculatedConditionCollection.Add(cpvB);
				var pjB = new RoleSetDerivationProjection(ruleB, leadB);
				for (int i = 0; i < hEB.Roles.Count; i++)
				{
					int p = L1.Players.IndexOf(htB[i]);
					PathedRole src = p >= 0 ? rB1[p] : rB2[L2.Players.IndexOf(htB[i])];
					var drpB = new DerivedRoleProjection(pjB, hEB.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drpB, src);
				}
				var hpB = new List<string>();
				foreach (string p in hEB.Players) hpB.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hEB.Fact.Name) + ", S" + hpB.Count + "("
					+ string.Join(", ", hpB) + "), S3(A(\"proj\"), S4(A(\"cmp\"), S5(A(\"joinon\"), "
					+ IAtom(L1.Fact.Name) + ", " + IAtom(L2.Fact.Name) + ", PHI(), S" + idB.Count
					+ "(" + string.Join(", ", idB) + ")), N(" + cA + "), N(" + cB + ")), S"
					+ outB.Count + "(" + string.Join(", ", outB) + ")))");
				log.Add(hEB.Fact.Name + " := value comparison over " + L1.Fact.Name + " x "
					+ L2.Fact.Name + ", " + DescribeDerivation(hEB.Fact));
			}
			// THE GENERAL n-LEG JOIN. Legs whose shared variables do not all meet at one
			// centre, which the star arm declines by design. See GeneralJoinRecipe for the
			// plan; this half resolves the legs and builds the NORMA path.
			//
			// SUBTYPE FILLERS ARE RESOLVED HERE, which the multi-leg arms previously could
			// not do. `Transition1 is from State Machine Definition1` names no declared
			// fact type -- `Transition is from- Status` is what exists -- but state.md:285
			// records that State Machine Definition IS A SUBTYPE OF Status, so this is a
			// subtype filler in a supertype-typed role: Harel's inherited edge, where a
			// transition whose `from` status is the machine super-state induces an
			// effective transition out of every child status. It reads exactly like an
			// undeclared-head defect and is not one.
			foreach (string sRawC in myDeferredRules)
			{
				string sC = sRawC;
				while (sC.StartsWith("* * ")) sC = sC.Substring(2);
				Match cm2 = Regex.Match(sC, @"^\* (.+?) iff (.+)\.$");
				if (!cm2.Success) continue;
				string bodyC = cm2.Groups[2].Value;
				if (bodyC.Contains("'") || bodyC.Contains(" no ") || bodyC.Contains("not true")
					|| bodyC.Contains(" where ")) continue;
				string[] rawC = bodyC.Split(new[] { " and " }, StringSplitOptions.None);
				if (rawC.Length < 3) continue;
				string headC = cm2.Groups[1].Value.Trim();
				FactIndexEntry hEC = FindEntryByNormalizedSentence(headC);
				if (hEC == null) continue;
				List<string> htC = SubscriptedTokens(headC, hEC.Players);
				if (htC == null) continue;
				var legsC = new List<FactIndexEntry>(); var toksC = new List<List<string>>();
				bool okC = true;
				// AN IDENTITY LEG IS NOT A FACT TYPE. `that Function is that Fact Type2` has
				// no verb: it asserts that two already-bound variables are the SAME one
				// (Fact Type being a subtype of Function). It resolves to nothing and used
				// to defeat the whole plan. Canon does not give it a leg either -- it
				// becomes the join key (2,2). So collect these first, drop them, and rename
				// one variable to the other everywhere else; the ordinary planner then joins
				// on the merged variable by itself.
				// Tokens that only resolved by substituting a supertype for the subtype the
				// clause actually named.
				var subTokC = new HashSet<string>(StringComparer.Ordinal);
				var renames = new Dictionary<string, string>(StringComparer.Ordinal);
				var realLegs = new List<string>();
				foreach (string raw0 in rawC)
				{
					string c0 = raw0.Trim();
					Match idm = Regex.Match(c0, @"^that ([\w :]+?) is that ([\w :]+?)$");
					if (idm.Success
						&& FindEntryByNormalizedSentence(Dequantify(" " + c0 + " ").Trim()) == null)
					{
						renames[idm.Groups[1].Value.Trim()] = idm.Groups[2].Value.Trim();
						continue;
					}
					realLegs.Add(c0);
				}
				if (realLegs.Count < 3) continue;
				foreach (string raw in realLegs)
				{
					string cl = raw.Trim();
					// A NESTED IDENTITY leg: `<clause> that is that <Token>` identifies the
					// clause's last role with an already-bound variable.
					//     that Fact is of some Function that is that Fact Type2
					// is `Fact is of Function` whose Function IS that Fact Type2 (Fact Type
					// being a subtype of Function). Canon expresses it as a join key on that
					// role, not as a separate leg, so the role is simply RENAMED to the
					// identified variable and the ordinary planner does the rest.
					string identWith = null;
					Match nid = Regex.Match(cl, @"^(.+?) that is that (.+)$");
					if (nid.Success) { cl = nid.Groups[1].Value.Trim(); identWith = nid.Groups[2].Value.Trim(); }
					string q = Dequantify(" " + cl + " ").Trim();
					FactIndexEntry e = FindEntryByNormalizedSentence(q);
					List<string> tk = null;
					if (e != null) tk = SubscriptedTokens(cl, e.Players);
					else
					{
						// subtype filler: substitute the supertype to resolve, but keep the
						// SUBTYPE name in the tokens so it stays a distinct variable
						foreach (KeyValuePair<string, ObjectType> kv in myTypes)
						{
							if (kv.Value.IsDeleted) continue;
							if (q.IndexOf(kv.Key, StringComparison.Ordinal) < 0) continue;
							foreach (ObjectType sup in kv.Value.SupertypeCollection)
							{
								FactIndexEntry cand = FindEntryByNormalizedSentence(q.Replace(kv.Key, sup.Name));
								if (cand == null) continue;
								var pl = new List<string>(cand.Players);
								for (int c = 0; c < pl.Count; c++) if (pl[c] == sup.Name) { pl[c] = kv.Key; break; }
								e = cand; tk = SubscriptedTokens(cl, pl);
								if (tk != null) foreach (string st in tk) if (st.StartsWith(kv.Key, StringComparison.Ordinal)) subTokC.Add(st);
								break;
							}
							if (e != null) break;
						}
					}
					if (e == null || tk == null)
					{
						log.Add("  general-join: unresolved leg <" + cl + "> in " + Shorten(sC));
						okC = false; break;
					}
					// rename the identified role so the planner joins on it
					if (identWith != null && tk.Count > 0) tk[tk.Count - 1] = identWith;
					for (int c = 0; c < tk.Count; c++)
					{
						string to;
						if (renames.TryGetValue(tk[c], out to)) tk[c] = to;
					}
					legsC.Add(e); toksC.Add(tk);
				}
				if (!okC)
				{
					// say WHICH leg defeated the plan; a silent continue here is
					// indistinguishable from a non-matching regex, which cost an iteration
					log.Add("  general-join: leg unresolved in: " + Shorten(sC));
					continue;
				}
				// A SUBTYPE FILLER CANNOT ALSO BE THE JOIN VARIABLE. `Transition1 is from
				// State Machine Definition1` resolves against the declared `Transition is
				// from- Status`, so the role NORMA builds is typed STATUS. Where the same
				// token is named again -- `Status1 is defined in State Machine Definition1`
				// -- that role is typed State Machine Definition, and joining the two needs
				// an explicit subtype step that this arm does not lay down. It built anyway,
				// and NORMA rendered it as `is some from Status ... and that Status1 is
				// defined in some State Machine Definition THAT IS THAT TRANSITION`: the
				// machine binding dropped from the from-role and the definition aliased to a
				// Transition. Wrong, not incomplete, and the only gate that could see it was
				// reading the verbalization back. Used ONCE the substitution is just a
				// filter and stays fine -- that is the case this guard leaves alone.
				bool subJoinC = false;
				foreach (string st in subTokC)
				{
					int seen = 0;
					for (int li = 0; li < toksC.Count; li++) if (toksC[li].Contains(st)) seen++;
					if (htC.Contains(st)) seen++;
					if (seen > 1) { subJoinC = true; break; }
				}
				if (subJoinC)
				{
					log.Add("  general-join: subtype filler is also the join variable (needs a subtype step) in: " + Shorten(sC));
					continue;
				}
				// A VARIABLE IN EVERY LEG IS THE STAR ARM'S SHAPE -- decline, or both arms
				// build the same sentence and the head ends with more paths than rules.
				// Measured when this guard was missing: three heads carried a duplicate
				// recipe and two others gained a second, differently shaped and non-canon
				// plan for a rule that already matched. "Paths fewer than rules" catches
				// the under-built case; nothing was catching the over-built one.
				bool everyLeg = false;
				foreach (string tok in toksC[0])
				{
					bool all = true;
					for (int li = 1; li < toksC.Count && all; li++) if (!toksC[li].Contains(tok)) all = false;
					if (all) { everyLeg = true; break; }
				}
				if (everyLeg) continue;
				string whyC;
				string recC = GeneralJoinRecipe(legsC, toksC, htC, out whyC);
				if (recC == null)
				{
					log.Add("  general-join: no plan (" + whyC + ") for: " + Shorten(sC));
					continue;
				}
				var ruleC = hEC.Fact.DerivationRule as FactTypeDerivationRule;
				if (ruleC == null)
				{
					ruleC = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hEC.Fact, ruleC);
					ApplyDerivationMarkers(hEC.Fact, ruleC);
				}
				var leadC = new LeadRolePath(myStore);
				ruleC.OwnedLeadRolePathCollection.Add(leadC);
				new RolePathObjectTypeRoot(leadC, myTypes[hEC.Players[0]]);
				var rowsC = new List<PathedRole[]>();
				for (int li = 0; li < legsC.Count; li++)
				{
					// enter each leg at a role whose variable another leg also carries, so
					// the sub-paths join rather than standing as independent entries
					int ent = 0;
					for (int c = 0; c < toksC[li].Count; c++)
					{
						bool sharedC = false;
						for (int lj = 0; lj < legsC.Count && !sharedC; lj++)
							if (lj != li && toksC[lj].Contains(toksC[li][c])) sharedC = true;
						if (sharedC) { ent = c; break; }
					}
					var spC = new RoleSubPath(myStore);
					leadC.SubPathCollection.Add(spC);
					var rowC = new PathedRole[legsC[li].Roles.Count];
					EnterLeg(spC, legsC[li], ent, rowC);
					rowsC.Add(rowC);
				}
				var headPRC = new PathedRole[htC.Count];
				for (int li = 0; li < legsC.Count; li++)
					for (int c = 0; c < toksC[li].Count; c++)
					{
						int hi = htC.IndexOf(toksC[li][c]);
						if (hi >= 0 && headPRC[hi] == null) headPRC[hi] = rowsC[li][c];
					}
				for (int i = 0; i < htC.Count && okC; i++) if (headPRC[i] == null) okC = false;
				if (!okC) continue;
				var pjC = new RoleSetDerivationProjection(ruleC, leadC);
				for (int i = 0; i < hEC.Roles.Count; i++)
				{
					var drpC = new DerivedRoleProjection(pjC, hEC.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drpC, headPRC[i]);
				}
				var hpC = new List<string>();
				foreach (string p in hEC.Players) hpC.Add(IAtom(p));
				myRuleRecipes.Add("S3(" + IAtom(hEC.Fact.Name) + ", S" + hpC.Count + "("
					+ string.Join(", ", hpC) + "), " + recC + ")");
				log.Add(hEC.Fact.Name + " := general join over " + legsC.Count + " legs, "
					+ DescribeDerivation(hEC.Fact));
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
			// THE QUALIFIED SUBTYPE DEFINITION — Halpin 6.5 (p.253), Fig 13.29:
			//     * Each Entity Type is an Object Type that is of OT Kind 'entity'.
			// Halpin is explicit that these "definitions are FORMAL - they are not just
			// comments", so a transcriber that maps only the edge drops model content.
			// Until now this arm mapped the SubtypeFact and stopped, counting "rule
			// deferred" - but nothing downstream ever built it, so the subtype carried a
			// state:derived marker with NO deliverer, which is precisely what
			// marker-closure reads against rules:metamodel.
			//
			// NORMA has the mechanism and we drove it ZERO times: SubtypeDerivationRule
			// (: RolePathOwner) attached to the SUBTYPE OBJECT TYPE via
			// SubtypeHasDerivationRule - ObjectType.DerivationRule, NOT the SubtypeFact.
			// Attaching it to the fact edge by analogy with FactTypeDerivationRule is the
			// obvious wrong guess; DomainClasses.cs:6114 settles it.
			//
			// NO PROJECTION. RoleSetDerivationProjection/DerivedRoleProjection bind a
			// derived head's roles to path variables; a subtype definition has no head
			// roles - it defines MEMBERSHIP. Copying the join arm wholesale would attach a
			// projection with nothing to project, which constructs cleanly and only fails
			// at validate time.
			//
			// The literal IS baked, deliberately, and this is the exact inverse of the
			// offset arm's ruling below ("would BAKE the literal ... change the window and
			// the rule still says 48. Right answer, wrong rule."). There the operand was a
			// REFERENCE to a value type carrying its value as a population. Here 'entity'
			// is a discriminator drawn from `The possible values of OT Kind are
			// 'entity','value'` - change the literal and the SUBTYPE changes. So a
			// PathConstant is the meaning here, not a shortcut.
			// Kill switch, following the AREST_NO_* convention of docs/15: with it set the
			// arm declines and the oracle reproduces the asserted-subtype answer, so the
			// derived-vs-asserted Rmap difference can be A/B'd in one build.
			bool noSubtypeRule = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AREST_NO_SUBTYPE_RULE"));
			foreach (string sd in noSubtypeRule ? new List<string>() : mySubtypeDefs)
			{
				Match sm = Regex.Match(sd, @"^\* Each ([\w ]+?) is an? ([\w ]+?) (?:that|who|which) (.+?)\s*\.?$");
				if (!sm.Success) continue;
				// myTypes is keyed by the DECLARED name under StringComparer.Ordinal, and
				// FindEntryByNormalizedSentence wants the NORMALIZED form. Normalizing both
				// missed every type ("entity type" vs "Entity Type") - traced, not guessed.
				string subN = sm.Groups[1].Value.Trim();
				string supN = sm.Groups[2].Value.Trim();
				ObjectType subOT, supOT;
				if (!myTypes.TryGetValue(subN, out subOT) || !myTypes.TryGetValue(supN, out supOT)) continue;
				if (subOT.DerivationRule != null) continue;
				// THE CHAINED (TWO-HOP) QUALIFYING PREDICATE, tried FIRST because it is the
				// more specific shape: the one-hop regex below would otherwise swallow it
				// (verb = 'is of some Constraint Type that has Constraint Type Family') and
				// then decline on the fact-type lookup, which is what it does today.
				//     * Each Set Comparison Constraint is a Constraint that is of some
				//       Constraint Type that has Constraint Type Family 'set-comparison'.
				// Halpin's book p.381: 'in practice MORE COMPLICATED SUBTYPE DEFINITIONS ARE
				// SOMETIMES REQUIRED', worked over two fact types ('each LargeUScity is a
				// City that is in Country US and has Population > 1000000'). That example is
				// a CONJUNCTION over two roles of the supertype; this is a CHAIN THROUGH an
				// intermediate entity type, which the same section licenses only via 'these
				// definitions must refer to roles played by the supertype(s)' -- the FIRST
				// hop does, and the second joins on. Recorded as the weaker warrant rather
				// than claimed as the worked example.
				// Why the metamodel needs it: the discriminating literal lives on Constraint
				// Type Family, not on Constraint, so no one-hop form can reach it. Left
				// undefined the three subtypes stay ASSERTED, and per Halpin's 'Subtyping
				// Revisited' Sec 3 an asserted subtype's exclusion 'must be explicitly
				// declared, since it is not derivable' -- which is why core.md's declared
				// exclusion is load-bearing today and why #36's deletion half needs this.
				Match cm = Regex.Match(sm.Groups[3].Value.Trim(),
					@"^(.+?)\s+some\s+([A-Z][\w ]*?)\s+(?:that|who|which)\s+(.+?)\s+'([^']*)'\s*$");
				if (cm.Success)
				{
					string verb1 = cm.Groups[1].Value.Trim();
					string midN = cm.Groups[2].Value.Trim();
					string verb2 = cm.Groups[3].Value.Trim();
					string clit = cm.Groups[4].Value;
					FactIndexEntry q1 = FindEntryByNormalizedSentence(NormalizeWords(supN + " " + verb1 + " " + midN));
					FactIndexEntry q2 = FindEntryByNormalizedSentence(NormalizeWords(midN + " " + verb2));
					if (q1 == null || q2 == null || q1.Roles.Count != 2 || q2.Roles.Count != 2) continue;
					int supAt = q1.Players.IndexOf(supN), midAt1 = q1.Players.IndexOf(midN);
					int midAt2 = q2.Players.IndexOf(midN);
					if (supAt < 0 || midAt1 < 0 || midAt2 < 0 || supAt == midAt1) continue;
					if (eqFn == null)
					{
						eqFn = new Function(myStore);
						eqFn.Name = "Equals";
						eqFn.IsBoolean = true;
						eqFn.Model = myModel;
						var cpa = new FunctionParameter(myStore); cpa.Function = eqFn; cpa.Name = "left";
						var cpb = new FunctionParameter(myStore); cpb.Function = eqFn; cpb.Name = "right";
					}
					var crule = new SubtypeDerivationRule(myStore);
					new SubtypeHasDerivationRule(subOT, crule);
					crule.DerivationCompleteness = DerivationCompleteness.FullyDerived;
					crule.DerivationStorage = DerivationStorage.NotStored;
					var clead = new LeadRolePath(myStore);
					crule.OwnedLeadRolePathCollection.Add(clead);
					new RolePathObjectTypeRoot(clead, supOT);
					// hop 1: enter the supertype's role, cross to the intermediate
					var h1in = new PathedRole(clead, q1.Roles[supAt]);
					h1in.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					var h1out = new PathedRole(clead, q1.Roles[midAt1]);
					h1out.PathedRolePurpose = PathedRolePurpose.SameFactType;
					// hop 2: JOIN into the second fact type on the intermediate, then cross to
					// the value. PostInnerJoin is what makes this a join rather than a second
					// independent entry.
					var h2in = new PathedRole(clead, q2.Roles[midAt2]);
					h2in.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
					var h2out = new PathedRole(clead, q2.Roles[1 - midAt2]);
					h2out.PathedRolePurpose = PathedRolePurpose.SameFactType;
					var ccpv = new CalculatedPathValue(myStore);
					ccpv.Function = eqFn;
					var cInL = new CalculatedPathValueInput(myStore); ccpv.InputCollection.Add(cInL);
					var cInR = new CalculatedPathValueInput(myStore); ccpv.InputCollection.Add(cInR);
					int cpi = 0;
					foreach (FunctionParameter fp in eqFn.ParameterCollection)
					{
						if (cpi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(cInL, fp);
						else if (cpi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(cInR, fp); break; }
						cpi++;
					}
					new CalculatedPathValueInputBindsToPathedRole(cInL, h2out);
					var cpc = new PathConstant(myStore);
					cpc.LexicalValue = clit;
					new CalculatedPathValueInputBindsToPathConstant(cInR, cpc);
					clead.CalculatedConditionCollection.Add(ccpv);
					// THE RECIPE, in RecordRuleRecipe's own column convention (see 2711): joined
					// columns are (left-non-join, JOIN, right-non-join) = 1,2,3; legA wants its
					// join column LAST, legB wants it FIRST, and a leg whose join column sits
					// elsewhere is flipped with proj(N(2),N(1)). The literal rides on legB as a
					// `sel`, which is legal in a leg slot because derive:src is
					// COND(atom, derive:pop, derive:eval) -- a NON-ATOM operand RECURSES -- and
					// nested legs already ship on all five stations under 52/0 walls.
					// The join form's FOURTH operand is itself the projection (derive:eval's join
					// arm is apply(theta:Project(4.1), apply(theta:NatJoin(2), ...))), so no outer
					// proj is wrapped: the subtype's members are the supertype column, i.e. the
					// left-non-join column, 1.
					string legA = midAt1 == 1 ? IAtom(q1.Fact.Name)
						: "S3(" + IAtom("proj") + ", " + IAtom(q1.Fact.Name) + ", S2(N(2), N(1)))";
					string sel2 = "S4(" + IAtom("sel") + ", " + IAtom(q2.Fact.Name)
						+ ", N(" + (2 - midAt2) + "), " + IAtom(clit) + ")";
					string legB = midAt2 == 0 ? sel2
						: "S3(" + IAtom("proj") + ", " + sel2 + ", S2(N(2), N(1)))";
					myRuleRecipes.Add("S3(" + IAtom(subN) + ", S1(" + IAtom(subN) + "), S4("
						+ IAtom("join") + ", " + legA + ", " + legB + ", S1(N(1))))");
					Count("subtype derivation rule BUILT (chained predicate, Halpin 9.6 p.381)");
					log.Add(subN + " := " + supN + " -> " + midN + " where " + verb2
						+ " = '" + clit + "', chained subtype rule, fully derived");
					continue;
				}
				// split the trailing quoted literal off the qualifying predicate
				Match pm = Regex.Match(sm.Groups[3].Value.Trim(), @"^(.+?)\s+'([^']*)'\s*$");
				if (!pm.Success) continue;
				string verb = pm.Groups[1].Value.Trim();
				FactIndexEntry qe = FindEntryByNormalizedSentence(NormalizeWords(supN + " " + verb));
				if (qe == null || qe.Roles.Count != 2) continue;
				int rootAt = qe.Players.IndexOf(supN);
				if (rootAt < 0) continue;
				if (eqFn == null)
				{
					eqFn = new Function(myStore);
					eqFn.Name = "Equals";
					eqFn.IsBoolean = true;
					eqFn.Model = myModel;
					var pa3 = new FunctionParameter(myStore); pa3.Function = eqFn; pa3.Name = "left";
					var pb3 = new FunctionParameter(myStore); pb3.Function = eqFn; pb3.Name = "right";
				}
				var srule = new SubtypeDerivationRule(myStore);
				new SubtypeHasDerivationRule(subOT, srule);
				// BOTH properties, explicitly — the same pair ApplyDerivationMarkers sets for
				// fact-type rules. rmap-algorithm.md:39 fixes the marker mapping:
				// `*` => FullyDerived + NotStored. Setting only completeness left storage at
				// whatever the default is, and canon's D.4 arm keys on state:derived's
				// 'subtype' mode as a stand-in for "fully derived and not stored". With both
				// set here that stand-in is exact BY CONSTRUCTION rather than by the accident
				// that the arm's `^\* Each ` regex cannot currently accept a `**` subtype.
				srule.DerivationCompleteness = DerivationCompleteness.FullyDerived;
				srule.DerivationStorage = DerivationStorage.NotStored;
				var slead = new LeadRolePath(myStore);
				srule.OwnedLeadRolePathCollection.Add(slead);
				new RolePathObjectTypeRoot(slead, supOT);
				var sEnter = new PathedRole(slead, qe.Roles[rootAt]);
				sEnter.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				var sVal = new PathedRole(slead, qe.Roles[1 - rootAt]);
				sVal.PathedRolePurpose = PathedRolePurpose.SameFactType;
				var scpv = new CalculatedPathValue(myStore);
				scpv.Function = eqFn;
				var sInL = new CalculatedPathValueInput(myStore);
				scpv.InputCollection.Add(sInL);
				var sInR = new CalculatedPathValueInput(myStore);
				scpv.InputCollection.Add(sInR);
				int spi = 0;
				foreach (FunctionParameter fp in eqFn.ParameterCollection)
				{
					if (spi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(sInL, fp);
					else if (spi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(sInR, fp); break; }
					spi++;
				}
				new CalculatedPathValueInputBindsToPathedRole(sInL, sVal);
				var spc = new PathConstant(myStore);
				spc.LexicalValue = pm.Groups[2].Value;
				new CalculatedPathValueInputBindsToPathConstant(sInR, spc);
				// the CONDITION attachment - "the calculated values that must be satisfied
				// by the path" (LeadRolePath.CalculatedConditionCollection,
				// DomainClasses.cs:12817). FIRST condition-shaped use in this file: every
				// other CalculatedPathValue here is PROJECTED as a value, so there is no
				// in-repo precedent to pattern-match against.
				slead.CalculatedConditionCollection.Add(scpv);
				// EMIT THE RECIPE. Building the NORMA rule is not enough: state:rules is
				// what the closure machinery runs and what marker-closure reads against
				// rules:metamodel, and it comes from myRuleRecipes alone. Six arms have
				// now moved `built` without moving coverage by skipping this.
				//
				// The shape is NOT invented - canon already hand-writes these two rules in
				// rules:metamodel, verbatim:
				//   S2(A("Entity Type"), S3(A("proj"),
				//        S4(A("sel"), A("ObjectTypeIsOfOTKind"), N(2), A("entity")),
				//        S1(N(1))))
				// and the one-leg conjunction arm above already computes exactly that
				// shape: selector N(2-rootAt), projection N(rootAt+1). With the supertype
				// at position 0 the two agree term for term. state:rules rows carry the
				// players field that rules:metamodel rows omit (solve:fts2 copies it into
				// the descriptor), hence S3(name, players, recipe) here against canon's
				// S2(name, recipe).
				myRuleRecipes.Add("S3(" + IAtom(subN) + ", S1(" + IAtom(subN) + "), S3("
					+ IAtom("proj") + ", S4(" + IAtom("sel") + ", " + IAtom(qe.Fact.Name)
					+ ", N(" + (2 - rootAt) + "), " + IAtom(pm.Groups[2].Value) + "), S1(N("
					+ (rootAt + 1) + "))))");
				Count("subtype derivation rule BUILT (Halpin 6.5 qualified definition)");
				log.Add(subN + " := " + supN + " where " + verb + " = '" + pm.Groups[2].Value
					+ "', subtype rule, fully derived");
			}
			foreach (string s in myDeferredRules)
			{
				Match m = Regex.Match(s, @"^\* (.+?) iff (.+)\.$");
				if (!m.Success) continue;
				string head = m.Groups[1].Value.Trim();
				int headRules;
				rulesPerHead.TryGetValue(RuleHeadKey(head), out headRules);
				FactIndexEntry headE = FindEntryByNormalizedSentence(head);
				if (headE == null || headE.Players.Count != 1) continue;
				// A MULTI-RULE HEAD IS A UNION, one lead path per rule -- the same relaxation
				// the linear arm already carries. `Customer is admin` has three rules and this
				// arm skipped all three, so a head whose every rule is exactly this shape built
				// nothing. The STORED (**) branch below writes a parse-side recipe rather than a
				// path, and folding several rules into one of those is a different question, so
				// it keeps the single-rule restriction.
				if (headRules != 1 && myStoredDerived.Contains(headE.Fact)) continue;
				if (headRules == 1 && headE.Fact.DerivationRule != null) continue;
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
				// GET-OR-CREATE: a multi-rule head holds ONE derivation rule whose closure is
				// the union of one lead path per rule sentence.
				var vrule = headE.Fact.DerivationRule as FactTypeDerivationRule;
				if (vrule == null)
				{
					vrule = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(headE.Fact, vrule);
					ApplyDerivationMarkers(headE.Fact, vrule);
				}
				if (myStoredDerived.Contains(headE.Fact))
				{
					// LeadRolePathAddedRule (RolePath.cs:6143-6152) clears
					// ExternalDerivation on any path add at commit, and only
					// External+Stored escapes GATE:188 - so a stored (**)
					// fact keeps NO in-store body. Its executable recipe is
					// parse-side (state:rules/canon); the store carries the
					// marker triple only.
					RecordConjunctionRecipe(headE, condLegs);
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
				// EMIT the executable recipe. This arm has always built the NORMA rule
				// and never emitted one - myRuleRecipes.Add lived at exactly one site,
				// inside RecordRuleRecipe, reachable only from the binary-join paths - so
				// a conjunction's head never reached state:rules and law:markers counted
				// it missing even though the rule had been understood.
				//
				// ONE-LEG ONLY, deliberately. A single leg needs no join bookkeeping: it
				// is a select on the non-root column when the leg carries a constant,
				// then a projection onto the root column. The n-leg case needs the join
				// column positions worked out per leg and that wants fitting offline
				// against real condLegs before any of it is written here.
				//
				// The shapes are precedented, not guessed: a unary head with a
				// one-column projection S1(N(1)) already runs in rules:metamodel
				// (DomainChangeIsValid), and solve:fts2 copies a rule row's players
				// field wholesale into the descriptor without indexing it, so a
				// one-element list is safe there.
				RecordConjunctionRecipe(headE, condLegs);
				log.Add(headE.Fact.Name + " := conjunction at " + rootVar + " ("
					+ string.Join(" & ", condLegs.Select(l => l.Key.Fact.Name + (l.Value.Value != null ? "='" + l.Value.Value + "'" : ""))) + "), "
					+ DescribeDerivation(headE.Fact));
			}
			// the aggregate class: "* <head> iff <V> is the count of <X>
			// where <source-reading>." — Definition 7's finite bag to one
			// scalar as NORMA's own CalculatedPathValue (Count, aggregated
			// per path root), the literature's flagship derived-fact example
			Function countFn = null;
			// the offset class's operator, minted on first use like Count and
			// Equals. NON-aggregate by construction: IsAggregate is DERIVED from
			// whether any parameter has BagInput (RolePath.cs:8588-8607), and both
			// of Add's parameters are scalar, so it stays false without being set.
			Function addFn = null;
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && !fn.IsAggregate && fn.Name == "Add") { addFn = fn; break; }
			}
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
				rulesPerHead.TryGetValue(RuleHeadKey(head), out headRules);
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
				// the chain as the traversal RESOLVES it: per leg, its entry and exit
				// COLUMN positions and the variable it introduces. Collected here rather
				// than recomputed, because sentence order is not traversal order
				// (instances.md:445's third clause reads SMDef-first and is entered at
				// Object Type) and one resolution is better than two that can disagree.
				var foldLegs = new List<FactIndexEntry>();
				var foldPos = new List<KeyValuePair<int, int>>();
				var foldVars = new List<string>();
				bool foldLinear = true;
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
					if (li > 0 && entryVar != foldVars[li - 1]) foldLinear = false;
					foldLegs.Add(leg.Key);
					foldPos.Add(new KeyValuePair<int, int>(eAt, nAt));
					foldVars.Add(newVar);
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
				// the strict two-chain all-binary case records its canon recipe
				// through the same recorder the general class uses.
				//
				// f9b2bd80 gated this on usesSubscript, scoping the feature to its
				// own footprint "so no station's closure gains unasked-for work".
				// THAT GATE IS NOW LIFTED, and the reason it was right then and wrong
				// now is b6d93bd5: until then NOTHING FED state:rules TO derive, so a
				// recipe was unasked-for work in the literal sense -- it could not be
				// evaluated and could not be checked. rules:station put the cell on a
				// derivation path and law:station_rules holds every recipe in it to
				// being evaluable, so a recorded chain is now both executed and
				// verified rather than merely stored.
				// MEASURED, not hoped: on base this records three chains whose target
				// recipes canon already hand-writes in rules:metamodel, and the
				// recorder's output equals them term for term --
				//     ResourceBelongsToDomain  <join, ResourceIsOfFunction,
				//                               FunctionBelongsToDomain, <N1,N3>>
				//     FactBelongsToDomain      the same shape
				//     StateMachineIsCurrentlyInStatus  legB flipped by proj<N2,N1>
				// so the differential's DIFFERS count stays 0 while MATCH rises.
				// The remaining chains stay recipe-less for STRUCTURAL reasons the
				// conditions below state: one leg (ResourceIsOfFunction,
				// FactIsOfFunction -- canon writes those as a bare proj rename) or
				// three (StateMachineIsInstanceOfStateMachineDefinition -- canon
				// nests two joins). Both are separate increments, not this one.
				// A REVERSED SECOND LEG is joinable and was being refused. legs are stored
				// as the SENTENCE reads them, not in traversal order, so a clause like
				// "that Status is effective initial in that State Machine Definition"
				// ENTERS at Status: the shared variable is leg 1's EXIT, not its entry, and
				// the forward-only link test declined it. Found by INSTRUMENTING the guard
				// rather than guessing the site (the #76 rule): link=False with
				// l0exit == l1exit == State Machine Definition.
				// The join variable is legs[0].Value.Value either way; what changes is where
				// it sits in leg 1 and which token carries the head player. RecordRuleRecipe
				// ALREADY flips legB to proj<N(2),N(1)> when j2 != 0 -- exactly the shape
				// canon hand-writes for this rule -- so the recorder needed no change at all;
				// only the outer test had to admit the orientation.
				if (legs.Count >= 3 && foldVars.Count == legs.Count)
				{
					string lastVar = foldVars[foldVars.Count - 1], lastVarT;
					if (!typeOfVar.TryGetValue(lastVar, out lastVarT)) lastVarT = lastVar;
					RecordChainFoldRecipe(headE, foldLegs, foldPos, foldLinear, rootVarT, lastVarT);
				}
				if (legs.Count == 1)
					RecordRenameRecipe(headE, legs[0].Key, legPos[0].Key, legPos[0].Value);
				bool fwd2 = legs.Count == 2 && legs[1].Value.Key == legs[0].Value.Value;
				bool rev2 = legs.Count == 2 && !fwd2
					&& legs[1].Value.Value == legs[0].Value.Value
					&& legs[1].Value.Key != legs[0].Value.Value;
				if ((fwd2 || rev2)
					&& legs[0].Key.Players.Count == 2 && legs[1].Key.Players.Count == 2
					&& headE.Players.Count == 2)
				{
					int rj1 = legPos[0].Value, rj2 = fwd2 ? legPos[1].Key : legPos[1].Value;
					var relocated = new List<KeyValuePair<FactIndexEntry, int>>();
					bool rok = true;
					foreach (string pv in resolvedVars)
					{
						if (pv == rootVar)
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[0].Key, legPos[0].Key));
						else if (pv == legs[0].Value.Value)
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[0].Key, legPos[0].Value));
						else if (pv == (fwd2 ? legs[1].Value.Value : legs[1].Value.Key))
							relocated.Add(new KeyValuePair<FactIndexEntry, int>(legs[1].Key,
								fwd2 ? legPos[1].Value : legPos[1].Key));
						else { rok = false; break; }
					}
					if (rok)
						RecordRuleRecipe(headE, legs[0].Key, legs[1].Key, rj1, rj2, relocated);
				}
				var names = new List<string>();
				foreach (var leg in legs) names.Add(leg.Key.Fact.Name);
				myBuiltRuleSentences.Add(s);
				log.Add(headE.Fact.Name + " := chain over " + string.Join(" -> ", names) + ", fully derived, not stored");
			}
			// THE NEGATION CLASS: `iff <positive> and no <Type> <clause> where <clause>`.
			// The scope note above lists negation as exceeding a single role path; §296 and
			// ORM2Core.xsd's PathedRoleType.IsNegated say otherwise, so that is wrong on this
			// item. This arm takes the RECIPE half: no NORMA path is built here (that wants
			// IsNegated wiring and is its own increment), but the executable recipe is emitted,
			// exactly as the stored-derived conjunction does.
			// Each side is a BARE fact type or the two-leg join JoinRecipe already builds, and
			// minus wraps them -- no new recipe shape. legA is the clause holding the head's
			// FIRST player, since legA's non-join column becomes column 1 of the join.
			foreach (string s in myDeferredRules)
			{
				Match nm = Regex.Match(s, @"^\* (.+?) iff (.+?) and no ([A-Z][\w ]*?) (.+?) where (.+)\.$");
				if (!nm.Success) continue;
				string nHead = nm.Groups[1].Value.Trim();
				int nHeadRules;
				rulesPerHead.TryGetValue(RuleHeadKey(nHead), out nHeadRules);
				if (nHeadRules != 1) continue;
				FactIndexEntry nHeadE = FindEntryByNormalizedSentence(nHead);
				if (nHeadE == null || nHeadE.Players.Count != 2) continue;
				string negVar = nm.Groups[3].Value.Trim();
				// the negated side: the existential's own clause, and the where clause
				string negMain = Dequantify(" " + negVar + " " + nm.Groups[4].Value.Trim()).Trim();
				string negWhere = Dequantify(" " + nm.Groups[5].Value.Trim()).Trim();
				string negRecipe = TwoClauseRecipe(nHeadE, negWhere, negMain, negVar);
				if (negRecipe == null) continue;
				// the positive side: one clause (a bare fact type) or two joined on a variable
				string pos = nm.Groups[2].Value.Trim();
				string posRecipe = null;
				string[] posParts = Regex.Split(pos, @" and (?=that |some )");
				if (posParts.Length == 1)
				{
					FactIndexEntry pe = FindEntryByNormalizedSentence(Dequantify(" " + pos).Trim());
					if (pe != null && pe.Players.Count == 2
						&& pe.Players[0] == nHeadE.Players[0] && pe.Players[1] == nHeadE.Players[1])
						posRecipe = IAtom(pe.Fact.Name);
				}
				else if (posParts.Length == 2)
				{
					Match pv = Regex.Match(posParts[0].Trim(), @"^(?:some|that) ([A-Z][\w ]*?) ");
					if (pv.Success)
					{
						string p1 = Dequantify(" " + posParts[0].Trim()).Trim();
						string p2 = Dequantify(" " + posParts[1].Trim()).Trim();
						posRecipe = TwoClauseRecipe(nHeadE, p2, p1, pv.Groups[1].Value.Trim());
					}
				}
				if (posRecipe == null) continue;
				var nHeadPlayers = new List<string>();
				foreach (string pp in nHeadE.Players) nHeadPlayers.Add(IAtom(pp));
				myRuleRecipes.Add("S3(" + IAtom(nHeadE.Fact.Name) + ", S" + nHeadPlayers.Count + "("
					+ string.Join(", ", nHeadPlayers) + "), S3(" + IAtom("minus") + ", "
					+ posRecipe + ", " + negRecipe + "))");
				log.Add(nHeadE.Fact.Name + " := negation (positive minus no-" + negVar
					+ "), fully derived, not stored");
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
				rulesPerHead.TryGetValue(RuleHeadKey(head), out headRules);
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
				RecordCountRecipe(headE, src, vAt, gAt);
				log.Add(headE.Fact.Name + " := Count(" + x + ") per " + groupPlayer + " over " + src.Fact.Name + ", fully derived, not stored");
			}
			// THE AGGREGATE OVER A CHAIN. The arm above is Definition 7's flagship shape --
			// a COUNT over ONE binary source, grouped by the head's other role. The corpus
			// has thirteen more that are the same idea with more of everything: sum, mean,
			// min and max as well as count; a head of any arity; and a `where` that is a
			// conjunction of readings rather than a single one. That is most of what
			// business-metrics.md exists to say, and none of it built.
			//
			// The bag IS the chain, so this is the chain arm with an aggregate on the end:
			// the where-clauses build one rooted path, the aggregated value is a role that
			// path already binds, and every head role but the aggregated one projects from
			// where the chain bound it. Grouping is NORMA's aggregation context, which is
			// why the head's first player has to root the path and the aggregated role may
			// not BE that player.
			foreach (string sAg in myDeferredRules)
			{
				Match am = Regex.Match(sAg, @"^\* (.+?) iff (.+?) is the (count|sum|mean|min|max) of ([\w\- ]+?) where (.+)\.$");
				if (!am.Success) continue;
				string headA = am.Groups[1].Value.Trim();
				FactIndexEntry hA = FindEntryByNormalizedSentence(headA);
				// the single-source arm above runs FIRST and keeps what it can build
				if (hA == null || hA.Fact.DerivationRule != null) continue;
				int rulesA;
				rulesPerHead.TryGetValue(RuleHeadKey(headA), out rulesA);
				if (rulesA != 1) continue;
				List<string> hqA = RoleQualified(headA, hA.Players, true);
				string vA = am.Groups[2].Value.Trim();
				int vAtA = hqA.IndexOf(vA);
				if (vAtA < 0) vAtA = hA.Players.IndexOf(vA);
				if (vAtA <= 0) continue;
				var legsA = new List<FactIndexEntry>();
				var toksA = new List<List<string>>();
				bool okA = true;
				foreach (string clA in Regex.Split(am.Groups[5].Value, @" and (?=that |some |[A-Z])"))
				{
					string tA = clA.Trim();
					if (tA.Length == 0) continue;
					List<string> plA;
					FactIndexEntry eA = ResolveClauseSub(Dequantify(" " + tA + " ").Trim(), out plA);
					if (eA == null) { okA = false; break; }
					legsA.Add(eA);
					toksA.Add(RoleQualified(Dequantify(" " + tA + " ").Trim(), plA, true) ?? plA);
				}
				if (!okA || legsA.Count < 1) continue;
				// the aggregated thing is a variable the chain binds -- an entity for a
				// count, a value for a sum -- not a second source to go and find
				string xA = am.Groups[4].Value.Trim();
				int xL = -1, xC = -1;
				for (int l = 0; l < toksA.Count && xL < 0; l++)
					for (int c = 0; c < toksA[l].Count; c++)
						if (toksA[l][c] == xA) { xL = l; xC = c; break; }
				if (xL < 0) continue;
				string rootTokA = hqA[0];
				if (ChainOrder(toksA, rootTokA) == null) continue;
				// every group role must sit somewhere in the chain, or the head would carry
				// a role the body never binds
				var gL = new int[hA.Players.Count];
				var gC = new int[hA.Players.Count];
				for (int i = 0; i < hA.Players.Count && okA; i++)
				{
					gL[i] = -1;
					if (i == vAtA) continue;
					for (int l = 0; l < toksA.Count && gL[i] < 0; l++)
						for (int c = 0; c < toksA[l].Count; c++)
							if (toksA[l][c] == hqA[i] || toksA[l][c] == hA.Players[i]) { gL[i] = l; gC[i] = c; break; }
					if (gL[i] < 0) okA = false;
				}
				if (!okA) continue;
				ObjectType rootTypeA;
				if (!myTypes.TryGetValue(hA.Players[0], out rootTypeA)) continue;
				Function aggFn = GetOrMakeAggregate(char.ToUpper(am.Groups[3].Value[0]) + am.Groups[3].Value.Substring(1));
				if (aggFn == null) continue;
				var ruleA = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(hA.Fact, ruleA);
				ApplyDerivationMarkers(hA.Fact, ruleA);
				var leadA = new LeadRolePath(myStore);
				ruleA.OwnedLeadRolePathCollection.Add(leadA);
				var rootA = new RolePathObjectTypeRoot(leadA, rootTypeA);
				PathedRole[][] rowsA = BuildChain(leadA, legsA, toksA, rootTokA, false);
				if (rowsA == null) { ruleA.Delete(); continue; }
				var cpvA = new CalculatedPathValue(myStore);
				leadA.CalculatedValueCollection.Add(cpvA);
				cpvA.Function = aggFn;
				new CalculatedPathValueAggregationContextIncludesRolePathRoot(cpvA, rootA);
				// THE GROUPING IS EVERY GROUP ROLE, NOT JUST THE ROOT. With a binary head the
				// root IS the group and the context needs nothing else, which is why the arm
				// above gets away with it. Here the head carries Frequency too, and a context
				// of Organization alone sums across ALL frequencies and then pairs that one
				// total with each of them -- NORMA said it plainly:
				//   where Amount1 = Sum(each Amount2 for that Organization)
				// which is a wrong number rather than a missing one.
				for (int i = 1; i < hA.Players.Count; i++)
					if (i != vAtA) new CalculatedPathValueAggregationContextIncludesPathedRole(cpvA, rowsA[gL[i]][gC[i]]);
				var inputA = new CalculatedPathValueInput(myStore);
				cpvA.InputCollection.Add(inputA);
				foreach (FunctionParameter fp in aggFn.ParameterCollection)
				{
					new CalculatedPathValueInputCorrespondsToFunctionParameter(inputA, fp);
					break;
				}
				new CalculatedPathValueInputBindsToPathedRole(inputA, rowsA[xL][xC]);
				var projA = new RoleSetDerivationProjection(ruleA, leadA);
				for (int i = 0; i < hA.Players.Count; i++)
				{
					var drpA = new DerivedRoleProjection(projA, hA.Roles[i]);
					if (i == vAtA) new DerivedRoleProjectedFromCalculatedPathValue(drpA, cpvA);
					else if (i == 0) new DerivedRoleProjectedFromRolePathRoot(drpA, rootA);
					else new DerivedRoleProjectedFromPathedRole(drpA, rowsA[gL[i]][gC[i]]);
				}
				log.Add(hA.Fact.Name + " := " + aggFn.Name + "(" + xA + ") over "
					+ legsA.Count + " clauses per " + rootTokA + ", " + DescribeDerivation(hA.Fact));
			}
			// THE OFFSET CLASS: "* <head> iff <leg> and <headValue> is [that]
			// <legValue> plus <Duration>" — one leg, one binary operator, the
			// result projected onto the head's value role. The corpus writes it
			// three times and all three are temporal (a Date or Timestamp offset
			// by a declared window).
			//
			// THE SECOND OPERAND IS BOUND BY NO LEG. `Expiry Window Hours` is a
			// value type carrying its value as a population (`... is 48.`), so
			// there is no role to step to. Binding it to a PathConstant — the
			// mechanism the equals arm uses — would BAKE the literal into the
			// derivation and lose the reference: change the window and the rule
			// still says 48. Right answer, wrong rule.
			// NORMA has the honest binding: CalculatedPathValueInputBindsToRolePathRoot.
			// A second RolePathObjectTypeRoot over the duration TYPE is a variable
			// ranging over that type's own population, so the operand is bound by
			// the type's extension and Ullman safety holds without a special case.
			//
			// Roles are identified POSITIONALLY, not by the role names in the
			// sentence: head and leg share exactly one player (the entity), and
			// each one's OTHER role is its value. Matching `expires- Timestamp`
			// against a player named `Timestamp` would be parsing decoration.
			foreach (string sRaw3 in myDeferredRules)
			{
				Match om = Regex.Match(sRaw3,
					@"^\* (.+?) iff (.+?) and ([\w\- ]+?) is (?:that )?([\w\- ]+?) plus ([\w ]+?)\.$");
				if (!om.Success) continue;
				int oRules;
				rulesPerHead.TryGetValue(RuleHeadKey(om.Groups[1].Value.Trim()), out oRules);
				if (oRules != 1) continue;
				FactIndexEntry oHead = FindEntryByNormalizedSentence(om.Groups[1].Value.Trim());
				FactIndexEntry oLeg = FindEntryByNormalizedSentence(
					Dequantify(" " + om.Groups[2].Value.Trim() + " ").Trim());
				if (oHead == null || oLeg == null || oHead == oLeg) continue;
				if (oHead.Fact.DerivationRule != null) continue;
				if (oHead.Players.Count != 2 || oLeg.Players.Count != 2) continue;
				// THE ENTITY IS THE PLAYER THAT IS NOT A VALUE TYPE, and it has to
				// be found that way rather than as "the player head and leg share".
				// A Timestamp offset by hours is still a Timestamp, so in every
				// temporal case the head and leg carry the SAME value type and BOTH
				// players are shared - overlap identifies nothing. Measured: the
				// first cut of this arm rejected all three rules as ambiguous.
				int hEnt = -1, lEnt = -1;
				for (int i = 0; i < 2; i++)
				{
					ObjectType pt;
					if (myTypes.TryGetValue(oHead.Players[i], out pt) && !pt.IsValueType)
					{
						if (hEnt >= 0) { hEnt = -1; break; }
						hEnt = i;
					}
				}
				for (int i = 0; i < 2; i++)
				{
					ObjectType pt;
					if (myTypes.TryGetValue(oLeg.Players[i], out pt) && !pt.IsValueType)
					{
						if (lEnt >= 0) { lEnt = -1; break; }
						lEnt = i;
					}
				}
				if (hEnt < 0 || lEnt < 0) continue;
				string shared = oHead.Players[hEnt];
				if (oLeg.Players[lEnt] != shared) continue;
				ObjectType oEntType, oDurType;
				if (!myTypes.TryGetValue(shared, out oEntType)) continue;
				if (!myTypes.TryGetValue(om.Groups[5].Value.Trim(), out oDurType)) continue;
				if (addFn == null)
				{
					addFn = new Function(myStore);
					addFn.Name = "Add";
					addFn.OperatorSymbol = "+";
					addFn.Model = myModel;
					var ap1 = new FunctionParameter(myStore); ap1.Function = addFn; ap1.Name = "left";
					var ap2 = new FunctionParameter(myStore); ap2.Function = addFn; ap2.Name = "right";
				}
				var oRule = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(oHead.Fact, oRule);
				ApplyDerivationMarkers(oHead.Fact, oRule);
				var oLead = new LeadRolePath(myStore);
				oRule.OwnedLeadRolePathCollection.Add(oLead);
				var oRoot = new RolePathObjectTypeRoot(oLead, oEntType);
				var oEntry = new PathedRole(oLead, oLeg.Roles[lEnt]);
				oEntry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				var oStep = new PathedRole(oLead, oLeg.Roles[1 - lEnt]);
				oStep.PathedRolePurpose = PathedRolePurpose.SameFactType;
				// A ROLE PATH HOLDS AT MOST ONE ROOT - the link's multiplicity is
				// 0..1, and adding a second threw
				// "Domain role ... can hold at most 1 link: RolePath of
				//  RolePathObjectTypeRoot".
				// A second free variable is a SUB-PATH with its own root, which is
				// how NORMA splits a path. Found by building it wrong first; the
				// constraint is not visible from the constructor's signature.
				var oSub = new RoleSubPath(myStore);
				oLead.SubPathCollection.Add(oSub);
				var oDurRoot = new RolePathObjectTypeRoot(oSub, oDurType);
				var oCpv = new CalculatedPathValue(myStore);
				oLead.CalculatedValueCollection.Add(oCpv);
				oCpv.Function = addFn;
				var oParams = new List<FunctionParameter>(addFn.ParameterCollection);
				var oIn1 = new CalculatedPathValueInput(myStore);
				oCpv.InputCollection.Add(oIn1);
				new CalculatedPathValueInputCorrespondsToFunctionParameter(oIn1, oParams[0]);
				new CalculatedPathValueInputBindsToPathedRole(oIn1, oStep);
				var oIn2 = new CalculatedPathValueInput(myStore);
				oCpv.InputCollection.Add(oIn2);
				new CalculatedPathValueInputCorrespondsToFunctionParameter(oIn2, oParams[1]);
				new CalculatedPathValueInputBindsToRolePathRoot(oIn2, oDurRoot);
				var oProj = new RoleSetDerivationProjection(oRule, oLead);
				var oDrpEnt = new DerivedRoleProjection(oProj, oHead.Roles[hEnt]);
				new DerivedRoleProjectedFromRolePathRoot(oDrpEnt, oRoot);
				var oDrpVal = new DerivedRoleProjection(oProj, oHead.Roles[1 - hEnt]);
				new DerivedRoleProjectedFromCalculatedPathValue(oDrpVal, oCpv);
				log.Add(oHead.Fact.Name + " := " + oLeg.Fact.Name + " + " + oDurType.Name
					+ " per " + shared + ", " + DescribeDerivation(oHead.Fact));
			}
			// THE COPY CLASS: "* <head> iff <one leg>." — a binary head taking a
			// binary leg's population unchanged. It is the simplest derivation
			// there is, the base case of every transitive closure the metamodel
			// writes ("Domain1 reaches Domain2 iff Domain1 is contained in
			// Domain2"), and no arm took it: every other arm wants two legs or a
			// unary head.
			//
			// MEASURED before writing it, because #76 had this filed as a RING
			// problem and it is not: a well-formed NON-ring copy
			// ("Thing has Alpha iff Thing owns Alpha", same players, different
			// predicate) does not build either. Ring was never the blocker for
			// this shape — the shape had no arm.
			//
			// Head roles map to leg roles by the SUBSCRIPTED token as written, so
			// a ring copy costs nothing extra: Domain1 -> whichever leg role says
			// Domain1. #74 strips subscripts so the sentence RESOLVES; here they
			// are read back to BIND. Where a rule carries no subscripts the tokens
			// are the bare type names, which distinguishes the roles of a non-ring
			// fact type and is exactly the case that needs no disambiguation.
			foreach (string sRaw4 in myDeferredRules)
			{
				string s4 = sRaw4;
				while (s4.StartsWith("* * ")) s4 = s4.Substring(2);
				Match cpm = Regex.Match(s4, @"^\* (.+?) iff (.+?)\.$");
				if (!cpm.Success) continue;
				string cHeadTxt = cpm.Groups[1].Value.Trim();
				string cLegTxt = cpm.Groups[2].Value.Trim();
				// one leg only; anything joined or alternated belongs to another arm
				if (cLegTxt.Contains(" and ") || cLegTxt.Contains(" or ")) continue;
				int cRules;
				rulesPerHead.TryGetValue(RuleHeadKey(cHeadTxt), out cRules);
				if (cRules != 1) continue;
				FactIndexEntry cHead = FindEntryByNormalizedSentence(cHeadTxt);
				FactIndexEntry cLeg = FindEntryByNormalizedSentence(
					Dequantify(" " + cLegTxt + " ").Trim());
				if (cHead == null || cLeg == null || cHead == cLeg) continue;
				if (cHead.Fact.DerivationRule != null) continue;
				if (cHead.Players.Count != 2 || cLeg.Players.Count != 2) continue;
				List<string> cHeadTok = SubscriptedTokens(cHeadTxt, cHead.Players);
				List<string> cLegTok = SubscriptedTokens(cLegTxt, cLeg.Players);
				if (cHeadTok == null || cLegTok == null) continue;
				// every head role must land on exactly one leg role
				var cMap = new int[2];
				bool cOk = true;
				for (int i = 0; i < 2 && cOk; i++)
				{
					int found = -1;
					for (int j = 0; j < 2; j++)
					{
						if (cLegTok[j] != cHeadTok[i]) continue;
						if (found >= 0) { cOk = false; break; }
						found = j;
					}
					if (found < 0) cOk = false;
					else cMap[i] = found;
				}
				if (!cOk || cMap[0] == cMap[1]) continue;
				ObjectType cRootType;
				if (!myTypes.TryGetValue(cLeg.Players[0], out cRootType)) continue;
				var cRule = new FactTypeDerivationRule(myStore);
				new FactTypeHasDerivationRule(cHead.Fact, cRule);
				ApplyDerivationMarkers(cHead.Fact, cRule);
				var cLead = new LeadRolePath(myStore);
				cRule.OwnedLeadRolePathCollection.Add(cLead);
				var cRoot = new RolePathObjectTypeRoot(cLead, cRootType);
				var cEntry = new PathedRole(cLead, cLeg.Roles[0]);
				cEntry.PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
				var cStep = new PathedRole(cLead, cLeg.Roles[1]);
				cStep.PathedRolePurpose = PathedRolePurpose.SameFactType;
				var cPathed = new PathedRole[] { cEntry, cStep };
				var cProj = new RoleSetDerivationProjection(cRule, cLead);
				for (int i = 0; i < 2; i++)
				{
					var drp = new DerivedRoleProjection(cProj, cHead.Roles[i]);
					new DerivedRoleProjectedFromPathedRole(drp, cPathed[cMap[i]]);
				}
				log.Add(cHead.Fact.Name + " := copy of " + cLeg.Fact.Name
					+ " (" + cHeadTok[0] + "->" + cLegTok[cMap[0]] + ", "
					+ cHeadTok[1] + "->" + cLegTok[cMap[1]] + "), "
					+ DescribeDerivation(cHead.Fact));
				if (cRoot == null) { }
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
				rulesPerHead.TryGetValue(RuleHeadKey(head), out headRules);
				int generalRules;
				generalPerHead.TryGetValue(RuleHeadKey(head), out generalRules);
				// a multi-rule head admits IFF every one of its rules is
				// this class's shape (the linear-class treatment, mirrored)
				if (headRules != 1 && generalRules != headRules) continue;				// The split only fired when the SECOND clause opened with `that` or
				// `some`, which is a surface accident rather than a property of the
				// rule. `Node1 owns some Thing and Node2 holds that Thing` and the
				// metamodel's `... has antecedent Fact Type and Derivation Rule2
				// produces that Fact Type` both name their variable before the verb
				// and arrived as ONE clause. Traced, not guessed: tagging every exit
				// in this arm showed notTwoClauses firing, three fires after I had
				// started guessing sites further downstream.
				// A body with exactly ONE " and " has an unambiguous split point, so
				// use it when the lookahead misses. Bodies the lookahead already
				// splits are untouched, and `X has A and B and that C` still takes the
				// lookahead path rather than being cut into three.
				string[] clauses = Regex.Split(m.Groups[2].Value.Trim(), @" and (?=that |some )");
				if (clauses.Length != 2)
				{
					string body2 = m.Groups[2].Value.Trim();
					var ands = Regex.Matches(body2, @" and ");
					if (ands.Count == 1)
						clauses = new string[] { body2.Substring(0, ands[0].Index),
							body2.Substring(ands[0].Index + 5) };
				}
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
					if (hits.Count != 1)
					{
						// A RING HEAD IS AMBIGUOUS BY NAME: its two players share a type
						// name, so each finds a candidate in both legs and hits.Count is 2
						// with nothing else objecting. The subscript is what the sentence
						// uses to tell them apart, so read it back rather than declining.
						// Engaged ONLY once the name match is already ambiguous, so every
						// rule that resolves today takes the identical path.
						List<string> hTok = SubscriptedTokens(head, headE.Players);
						List<string> t1 = SubscriptedTokens(leg1, e1.Players);
						List<string> t2 = SubscriptedTokens(leg2, e2.Players);
						if (hTok == null || t1 == null || t2 == null) { ok = false; break; }
						var narrowed = new List<KeyValuePair<FactIndexEntry, int>>();
						foreach (var h in hits)
						{
							string tok = h.Key == e1 ? t1[h.Value] : t2[h.Value];
							if (tok == hTok[i]) narrowed.Add(h);
						}
						// still ambiguous, or no subscript to disambiguate with: decline
						if (narrowed.Count != 1) { ok = false; break; }
						located.Add(narrowed[0]);
						continue;
					}
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
				myBuiltRuleSentences.Add(sRaw);
				log.Add(headE.Fact.Name + " := join over " + j + " (" + e1.Fact.Name + " x " + e2.Fact.Name + "), " + DescribeDerivation(headE.Fact));
				RecordRuleRecipe(headE, e1, e2, j1, j2, located);
			}
			// EVERY ARM ABOVE `continue`s SILENTLY WHEN IT DECLINES A RULE, and
			// the tool then reports only its successes. That silence is what made
			// the derivation question expensive: five fires went into inferring
			// this parser's behaviour from regexes over the corpus, and the
			// resulting taxonomy was wrong in both directions - chains and
			// multi-bullet counted as blockers when they build, literals counted
			// as supported when their arm is narrower than assumed. The tool knew
			// which rules it had dropped the whole time.
			//
			// So say it. Report-only: nothing above changes, and no emitted line
			// contains ":= ", so every built-count measured off this log stays
			// comparable across the change.
			//
			// The diagnosis is deliberately the CHEAPEST HONEST ONE - whether the
			// head resolved to a declared fact type at all. That single bit
			// separates the two causes that actually dominate: a rule naming a
			// fact type nobody declared (the head never resolves, and the body is
			// never even read - so any classification of that body is fiction),
			// versus a head that resolves and a body no arm accepts. Guessing at
			// finer reasons here would re-create the inference habit this is
			// meant to retire.
			// A HEAD WITH SEVERAL RULES IS NOT BUILT WHEN ONE OF THEM IS. Testing
			// `Fact.DerivationRule == null` was right while every head carried one
			// rule and became wrong the moment the copy arm landed: `Domain reaches
			// Domain` has a base case AND a transitive case, the copy arm built the
			// base, and the transitive rule then reported as built because its head
			// had acquired a derivation. base's count fell 23 -> 19 while two rules
			// were built - the two that vanished had not built at all.
			//
			// So count the RULES resolving to each fact type and compare against the
			// LEAD PATHS its derivation actually owns. A derivation rule may own
			// several lead paths (that is how a union of bullets is expressed), so
			// paths-vs-rules is the honest comparison and null-vs-not is not.
			// This is the fourth silent drop of the session and the second I wrote.
			Function gtFnC = null, ltFnC = null, eqFnC = null;
			var arithFnsC = new Dictionary<string, Function>(StringComparer.Ordinal);
			// PLACED LAST, DELIBERATELY. This is the fallback: run it before the specialised
			// arms and it claims heads they build better. It did exactly that on first
			// try -- `State Machine is instance of State Machine Definition` is a
			// three-clause body that an earlier arm already owned, and the metamodel's
			// design-state moved. The get-or-create guard cannot help, because whoever
			// runs first wins; order is the only thing that decides it.
			// THE GENERAL CHAIN: a body of THREE OR MORE plain clauses, walked as one path.
			//     * Customer has Payload Document iff Customer has Stripe Subscription and
			//       that Stripe Subscription has Stripe Price and that Stripe Price ...
			// Two-clause bodies are already owned above, so this takes three and up and
			// leaves those alone. Clauses carrying a quoted value, a comparison, an
			// aggregate or a negation belong to the arms that know what to do with them;
			// this one declines rather than dropping the part it cannot read, because a
			// body built from a SUBSET of its clauses over-populates the head.
			//
			// The walk is pre-checked with ChainOrder before anything is constructed: this
			// arm claims heads other arms may also want, and abandoning a half-built rule
			// in the store leaves NORMA validating a path nobody meant.
			foreach (string sC in myDeferredRules)
			{
				if (myBuiltRuleSentences.Contains(sC)) continue;
				Match mc = Regex.Match(sC, @"^\* (.+?) iff (.+)\.$");
				if (!mc.Success) continue;
				string headC = mc.Groups[1].Value.Trim();
				string bodyC = mc.Groups[2].Value.Trim();
				// A quoted value in the BODY is no longer a reason to decline: a clause may
				// carry a value restriction, which is kept as an Equals condition. A quoted
				// value in the HEAD still belongs to the value-restricted arm, which runs
				// earlier and will have claimed it.
				if (Regex.IsMatch(bodyC, @" is the (count|sum|mean|min|max) of |the (minimum|maximum) of |\b(or more|at least|more than|implies|neither|if|else)\b")) continue;
				// FORML gives a computed value a ROLE NAME, in lower case:
				//     ... and state Sales Tax Amount equals taxable Base Amount times ...
				// so splitting only before `that`, `some` or a capital leaves the arithmetic
				// glued to the clause before it, and it is never seen as its own clause.
				string[] partsC = SplitBody(bodyC);
				// TWO CLAUSES TOO. This arm used to leave those to the arms above, and they
				// do take most of them -- but each of those wants a particular shape (a
				// binary head, the join variable opening the second leg), and a two-clause
				// body that fits none of them had nowhere else to go. kernel writes eight:
				// a leg plus a unary filter (`... and Observation1 is training`), or two
				// legs meeting at a variable the earlier arms cannot enter on. Running last,
				// behind the built-sentence registry and the paths-vs-rules cap, this arm
				// can take them without stealing anything.
				if (partsC.Length < 2) continue;
				FactIndexEntry hC = FindEntryByNormalizedSentence(headC);
				// A HEAD MAY NAME A VALUE AND STILL HAVE A BODY THIS ARM CAN READ.
				//   * External System has Service Health Status 'degraded' iff External System
				//     has Error Rate for Interval and that Error Rate exceeds Error Threshold.
				// The single-clause arm above owns the restricted heads whose body is one
				// reading; these have a leg plus a threshold, which is this arm's shape. The
				// restricted role is filled by a constant, exactly as that arm fills it.
				var hLitsC = new List<string>();
				if (hC == null) hC = ResolveRestrictedHead(headC, out hLitsC);
				if (hC == null) continue;
				// `**` DECLARES THE BODY EXTERNAL -- fully derived and stored, with no in-store
				// body BY DESIGN, which is why the arm that owns it records a recipe and zero
				// paths. Zero paths is exactly what the paths-vs-rules cap reads as a free
				// slot, so lowering this arm's clause floor let it hand `Object Type is
				// instantiable` a body the declaration says it does not have.
				if (myStoredDerived.Contains(hC.Fact) && !mySemiDerived.Contains(hC.Fact)) continue;
				// WITH SUBSCRIPTS. `Feature sources Feature in training at Observation` has two
				// roles of one type, and FORML tells them apart the only way it can -- Feature1
				// and Feature2. Without reading that, both head roles are one token, the two
				// occurrences inside one leg read as a ring, and the arm declines a rule whose
				// legs all resolve.
				List<string> hqC = RoleQualified(headC, hC.Players, true);
				int headRulesC;
				rulesPerHead.TryGetValue(RuleHeadKey(headC), out headRulesC);
				// ONE RULE SENTENCE, ONE PATH. No arm knows what an earlier arm already
				// built -- each reads myDeferredRules from the top -- so a head an earlier
				// arm has finished can be built AGAIN here, and the head ends with more
				// paths than the readings give it rules. That is how `Fact is in consequent
				// Fact Type` came to carry a second, differently-shaped path over the same
				// sentence, which NORMA answered with "joins to a path role with an
				// incompatible role player" twice while the FIRST path stayed valid. The
				// star arm guards its own overlap by shape (`everyLeg`); this is the same
				// guard stated in general, and it needs no registry because NORMA's own
				// model already knows how many paths the head has.
				var haveRuleC = hC.Fact.DerivationRule as FactTypeDerivationRule;
				if (headRulesC > 0 && haveRuleC != null
					&& haveRuleC.OwnedLeadRolePathCollection.Count >= headRulesC) continue;
				// A MULTI-RULE HEAD IS A UNION HERE TOO, one lead path per rule. Requiring a
				// single rule was the largest thing this arm refused for itself -- Source Request
				// is routed via Fetcher, Vehicle Purchase Quote has registration Fee Amount and
				// Billable Request is GDPR-compliant all have several. Where only some of a head's
				// rules build, the paths-vs-rules census says so; that is what it is for.
				var legsC = new List<FactIndexEntry>();
				var toksC = new List<List<string>>();
				bool okC = true;
				// A CLAUSE IS EITHER A LEG OR A COMPARISON BETWEEN TWO BOUND VALUES.
				//     ... and that Error Rate exceeds Error Threshold
				// names no fact type; it constrains two values other clauses already bound,
				// so it becomes a path CONDITION rather than a step. Both sides must be
				// bound by legs -- a comparison against something the body never introduced
				// would silently drop, and dropping a condition WIDENS the head.
				// NEGATION, BUT ONLY THE TWO FORMS BELOW. Blanking them first means any OTHER
				// `no`/`not` in the body still declines the rule, rather than being built as
				// though it were not there -- dropping a negation does not narrow a rule, it
				// inverts it.
				if (Regex.IsMatch(Regex.Replace(bodyC, " has no | is not | does not ", " "), @"\b(no|not)\b")) continue;
				var negC = new List<bool>();
				// declared players that only matched because a subtype was substituted for them
				var swapPlayersC = new HashSet<string>(StringComparer.Ordinal);
				var cmpC = new List<string[]>();
				var arithC = new List<string[]>();
				var thrC = new List<string[]>();
				foreach (string clC in partsC)
				{
					string tC = clC.Trim();
					// AN ARITHMETIC CLAUSE COMPUTES a head value rather than binding one:
					//     ... and Net Amount equals Gross Amount minus Discount Amount
					// Its target appears in no leg -- it is the answer, not an input -- so it is
					// projected from a CalculatedPathValue instead of a pathed role. Checked
					// first: `equals` is unambiguous, and no fact type answers to such a clause.
					Match am = Regex.Match(tC, @"^(?:that )?([A-Za-z][\w- ]*?) equals (.+)$");
					if (am.Success)
					{
						arithC.Add(new string[] { am.Groups[1].Value.Trim(), am.Groups[2].Value.Trim() });
						continue;
					}
					// A DECLARED READING WINS OVER A COMPARISON READING. `Request is Submission`
					// matches `A is B` exactly as `that Email Address is that Email` does, and
					// taking the comparison first STOLE a genuine leg -- the body then had one leg
					// and two "comparisons", and the arm declined a rule it should have built. So
					// resolve as a leg FIRST, and read `A is B` as an equality only when no fact
					// type answers to it. The other comparison verbs cannot resolve as legs anyway,
					// so the order does not affect them.
					// `Resource Declaration has no override- Fetcher` is the declared reading
					// `Resource Declaration has override- Fetcher` under a negation, and
					// `Country Code is not an EEA Country Code` likewise. Resolve the POSITIVE
					// form and carry the negation as a flag; NORMA has one place to put it.
					bool thisNegC = false;
					string tPosC = tC;
					var negTriesC = new List<string>();
					if (tC.Contains(" has no ")) { thisNegC = true; negTriesC.Add(tC.Replace(" has no ", " has ")); }
					else if (tC.Contains(" is not ")) { thisNegC = true; negTriesC.Add(tC.Replace(" is not ", " is ")); }
					else if (tC.Contains(" does not "))
					{
						// `Billable Request does not trigger cross-border Personal Data Transfer`
						// negates the declared `Billable Request triggers ...`, and the declared
						// reading CONJUGATES the verb that `does not` leaves bare. Try it both
						// ways and let resolution decide -- neither is a guess, because a form
						// naming no fact type is refused exactly as an unresolved clause always
						// was. Conjugating silently is the thing to avoid, not conjugating.
						thisNegC = true;
						int dnC = tC.IndexOf(" does not ", StringComparison.Ordinal);
						string subjC = tC.Substring(0, dnC), restC = tC.Substring(dnC + 10);
						negTriesC.Add(subjC + " " + restC);
						int spC = restC.IndexOf(' ');
						if (spC > 0) negTriesC.Add(subjC + " " + restC.Substring(0, spC) + "s" + restC.Substring(spC));
					}
					List<string> plC = null;
					FactIndexEntry leC = null;
					string swapC = null;
					if (thisNegC)
					{
						foreach (string candC in negTriesC)
						{
							leC = ResolveClauseSub(Dequantify(" " + candC + " ").Trim(), out plC, out swapC);
							if (leC != null) { tPosC = candC; break; }
						}
					}
					else leC = ResolveClauseSub(Dequantify(" " + tPosC + " ").Trim(), out plC, out swapC);
					if (leC == null)
					{
						Match cm = Regex.Match(tC, @"^(?:that |some )?((?:[a-z][\w-]*- )?[A-Z][\w ]*?) (exceeds|is less than|is greater than|is below|is above|starts with|is) (?:that |some )?('[^']*'|[A-Z][\w ]*?)$");
						if (cm.Success)
						{
							cmpC.Add(new string[] { cm.Groups[1].Value.Trim(), cm.Groups[2].Value, cm.Groups[3].Value.Trim() });
							continue;
						}
					}
					// A LEG CARRYING ITS OWN THRESHOLD: `Query Route has Max Retry Count greater
					// than 0` is the declared leg `Query Route has Max Retry Count` plus a
					// condition on the value it binds. Split the comparison off the end and keep
					// both halves -- dropping the threshold would WIDEN the rule, which is the
					// one outcome worse than not building it.
					string thrOp = null, thrVal = null;
					if (leC == null)
					{
						// A LEG MAY CARRY A VALUE RESTRICTION as well as a threshold:
						//     that Sales Tax Rate has Tax Rate Type 'county'
						// is the declared leg plus an equality on the value it binds. Same treatment,
						// Equals instead of GreaterThan -- and dropping it would widen the rule the
						// same way dropping a threshold does.
						Match vm = Regex.Match(tC, @"^(.+?) '([^']*)'$");
						if (vm.Success)
						{
							FactIndexEntry vLeg = ResolveClauseSub(Dequantify(" " + vm.Groups[1].Value.Trim() + " ").Trim(), out plC);
							if (vLeg != null)
							{
								leC = vLeg;
								thrOp = "is";
								thrVal = vm.Groups[2].Value;
							}
						}
						Match tm = leC != null ? Match.Empty
							: Regex.Match(tC, @"^(.+?) (greater than|less than|at least|at most|of) ([0-9]+)( or more| or fewer)?$");
						if (tm.Success)
						{
							FactIndexEntry baseLeg = ResolveClauseSub(Dequantify(" " + tm.Groups[1].Value.Trim() + " ").Trim(), out plC);
							if (baseLeg != null)
							{
								leC = baseLeg;
								string suf = tm.Groups[4].Value;
								thrOp = tm.Groups[2].Value == "of"
									? (suf.Contains("fewer") ? "is less than" : "exceeds")
									: (tm.Groups[2].Value == "greater than" || tm.Groups[2].Value == "at least" ? "exceeds" : "is less than");
								thrVal = tm.Groups[3].Value;
							}
						}
					}
					if (leC == null || leC == hC) { okC = false; break; }
					if (thrOp != null) thrC.Add(new string[] { plC[plC.Count - 1], thrOp, thrVal, legsC.Count.ToString() });
					legsC.Add(leC);
					if (swapC != null) swapPlayersC.Add(swapC);
					negC.Add(thisNegC);
					toksC.Add(RoleQualified(Dequantify(" " + tPosC + " ").Trim(), plC, true));
				}
				// ONE LEG IS ENOUGH WHEN SOMETHING ELSE CONSTRAINS IT. `Citation has URI and
				// that URI starts with 'https://...'` is a single reading plus a condition on
				// the value it bound; the arms above want a body of readings, so a rule that
				// is one reading and one test belonged to none of them. Running last, behind
				// the registry and the paths cap, taking it steals nothing.
				if (!okC || legsC.Count < 1) continue;
				// every head player must sit at exactly one leg position, or the projection
				// would be guessing which occurrence the head means
				var atLegC = new int[hC.Players.Count];
				var atPosC = new int[hC.Players.Count];
				// a head role may take its value from a bare value type's own population
				var typeRootC = new ObjectType[hC.Players.Count];
				var konstAtC = new int[hC.Players.Count];
				for (int z = 0; z < konstAtC.Length; z++) konstAtC[z] = -1;
				int konstSeenC = 0;
				var arithKeyC = new string[hC.Players.Count];
				var aliasC = new int[hC.Players.Count];
				for (int z = 0; z < aliasC.Length; z++) aliasC[z] = -1;
				// A HEAD PLAYER MAY APPEAR IN SEVERAL LEGS -- that is what a JOIN VARIABLE is,
				// and requiring exactly one occurrence rejected the very shape a chain is
				// built on. Occurrences across legs denote the same value once joined, so
				// the first will do. Two occurrences INSIDE one leg is a ring, where they
				// denote different values and only a subscript could tell them apart, so
				// that still declines.
				for (int i = 0; i < hC.Players.Count && okC; i++)
				{
					// AN ARITHMETIC CLAUSE THAT NAMES THIS ROLE IS ITS DEFINITION, and it beats
					// any leg that merely binds a value of the same type. The tax total adds up
					// eight amounts and the head's own role is a ninth; without this the
					// stripped pass below takes the first `<something>- Amount` it sees, and the
					// total is projected from whichever component happens to come first -- a
					// number that is wrong rather than absent.
					bool computedFirst = false;
					foreach (string[] aq in arithC)
						if (aq[0] == hqC[i] || aq[0] == hC.Players[i]
							|| aq[0].EndsWith(" " + hC.Players[i], StringComparison.Ordinal))
							{ computedFirst = true; arithKeyC[i] = aq[0]; }
					if (computedFirst) { atLegC[i] = -1; atPosC[i] = -1; continue; }
					// A QUALIFIED MATCH BEATS AN UNQUALIFIED ONE, and both beat a stripped one.
					// The head of the rule above is `Noun is resolved from alternate- External
					// System`, and its body binds TWO External Systems; matching on the player
					// alone takes whichever leg comes first, which is the degraded primary --
					// the exact opposite of what the rule says. Where the head carries no role
					// name and a leg does (`Source Request is routed via Fetcher` projecting
					// from `Resource Declaration has override- Fetcher`) the stripped pass is
					// what carries it, and it only runs when nothing qualified answered.
					int found = 0;
					for (int pass = 0; pass < 3 && found == 0; pass++)
					{
						for (int l = 0; l < legsC.Count; l++)
						{
							// never from inside a negation: those variables do not exist outside
							// it, so a head role taking its value there would be reading a row the
							// rule says is absent
							if (negC[l]) continue;
							int inLeg = 0;
							for (int c = 0; c < toksC[l].Count; c++)
							{
								string tk = toksC[l][c];
								bool hit = pass == 0 ? tk == hqC[i]
									: (pass == 1 ? tk == hC.Players[i]
										: StripRolePrefix(tk) == hC.Players[i]);
								if (!hit) continue;
								inLeg++;
								if (found == 0) { atLegC[i] = l; atPosC[i] = c; }
								found++;
							}
							if (inLeg > 1) okC = false;
						}
					}
					if (found == 0)
					{
						// AN EQUALITY CAN BE AN ALIAS. In
						//   Support Request has Category iff ... has Issue Type ... and Category is Issue Type
						// `Category` is in no leg -- it is DEFINED by the equality, as another name
						// for a value the body did bind. Project the head role from the other side.
						for (int q = 0; q < cmpC.Count && found == 0; q++)
						{
							if (cmpC[q][1] != "is") continue;
							string other = (cmpC[q][0] == hC.Players[i] || cmpC[q][0] == hqC[i]) ? cmpC[q][2]
								: ((cmpC[q][2] == hC.Players[i] || cmpC[q][2] == hqC[i]) ? cmpC[q][0] : null);
							if (other == null) continue;
							// ONLY WHEN THE TWO SIDES ARE TYPE-COMPATIBLE. `Timestamp is Date` reads as
							// a value copy, but projecting a Timestamp role from a Date pathed role is a
							// coercion the model does not sanction, and NORMA says so:
							// "Role 2 ... has a derivation projection with an incompatible type".
							// Declining here leaves the rule visibly unbuilt, which is the honest answer
							// -- the reading equates two differently-typed values and only the author can
							// say which one the head should carry.
							ObjectType tHead, tOther;
							if (myTypes.TryGetValue(hC.Players[i], out tHead) && myTypes.TryGetValue(other, out tOther)
								&& tHead.DataType != null && tOther.DataType != null && tHead.DataType != tOther.DataType) continue;
							for (int l = 0; l < legsC.Count && found == 0; l++)
								for (int c = 0; c < legsC[l].Players.Count; c++)
									if (legsC[l].Players[c] == other) { atLegC[i] = l; atPosC[i] = c; found = 1; aliasC[i] = q; break; }
							// THE OTHER SIDE MAY BE A BARE VALUE TYPE. `Trust Score is Authenticated
							// Trust Score` names a value type carrying its value as a population
							// (`Authenticated Trust Score is 99.`), so no leg steps to it and the
							// alias found nothing. A root over the TYPE is a variable ranging over
							// that population -- the binding the offset arm already uses for a
							// declared window -- and it keeps the REFERENCE: change the 99 and the
							// rule still says what it says.
							ObjectType otherVT;
							if (found == 0 && myTypes.TryGetValue(other, out otherVT) && otherVT.IsValueType)
							{
								typeRootC[i] = otherVT; atLegC[i] = -1; atPosC[i] = -1; found = 1; aliasC[i] = q;
							}
						}
						if (found == 1) continue;
						bool computedRole = false;
						// the target carries the role name, the head carries the player: `state Sales
						// Tax Amount` is the `Sales Tax Amount` role read under its role name
						foreach (string[] aq in arithC)
						{
							if (aq[0] == hC.Players[i] || aq[0].EndsWith(" " + hC.Players[i], StringComparison.Ordinal))
								{ computedRole = true; arithKeyC[i] = aq[0]; }
						}
						if (computedRole) { atLegC[i] = -1; atPosC[i] = -1; }
						else if (konstSeenC < hLitsC.Count)
						{
							konstAtC[i] = konstSeenC++; atLegC[i] = -1; atPosC[i] = -1;
						}
						else okC = false;
					}
				}
				if (!okC) continue;
				ObjectType rootC;
				if (!myTypes.TryGetValue(hC.Players[0], out rootC)) continue;
				// A SUBTYPE FILLER CANNOT ALSO BE THE JOIN VARIABLE. `Transition1 is from
				// State Machine Definition1` resolves against `Transition is from- Status`,
				// so the role is typed STATUS while the clause named a State Machine
				// Definition. Any other leg joining on that Status is joining across a
				// subtype step this arm does not lay down, and NORMA does not refuse it --
				// it renders something else and populates it. state.md RULE 2 came out as
				// `is that from Status1 where that Transition is some to Status`, which is
				// not what the reading says. Used once, the substitution is only a filter.
				foreach (string swp in swapPlayersC)
				{
					int seenSwp = 0;
					for (int l = 0; l < toksC.Count; l++) if (toksC[l].Contains(swp)) seenSwp++;
					if (hC.Players.Contains(swp)) seenSwp++;
					if (seenSwp > 1) { okC = false; break; }
				}
				if (!okC) continue;
				// A HEAD ROLE MAY NOT PROJECT FROM INSIDE A NEGATION. The variables under a
				// negation do not exist outside it, so a head that took its value from one
				// would be reading a row the rule says is absent.
				for (int i = 0; i < hC.Players.Count && okC; i++)
					if (atLegC[i] >= 0 && atLegC[i] < negC.Count && negC[atLegC[i]]) okC = false;
				if (!okC) continue;
				string rootTokC = hC.Players[0];
				foreach (List<string> tl in toksC) if (tl.Contains(hqC[0])) { rootTokC = hqC[0]; break; }
				if (konstSeenC != hLitsC.Count) continue;
				bool[] negArrC = negC.ToArray();
				if (ChainOrder(toksC, rootTokC, negArrC) == null) continue;
				var ruleC = hC.Fact.DerivationRule as FactTypeDerivationRule;
				bool madeRuleC = false;
				if (ruleC == null)
				{
					madeRuleC = true;
					ruleC = new FactTypeDerivationRule(myStore);
					new FactTypeHasDerivationRule(hC.Fact, ruleC);
					ApplyDerivationMarkers(hC.Fact, ruleC);
				}
				var leadC = new LeadRolePath(myStore);
				ruleC.OwnedLeadRolePathCollection.Add(leadC);
				new RolePathObjectTypeRoot(leadC, rootC);
				PathedRole[][] rowsC = BuildChain(leadC, legsC, toksC, rootTokC, false, negArrC);
				// AN ARM THAT BAILS MUST TAKE ITS LEAD PATH WITH IT. The path is attached to
				// the head's derivation rule BEFORE the parts that can fail, so every
				// `continue` below here used to leave a rooted path with nothing projected
				// from it. NORMA reports that against the HEAD -- "must project all derived
				// roles from each projected source path" -- which reads as an accusation
				// against whichever rule of that head DID build. Latent until now: these
				// bodies never reached this arm while it refused every `no`.
				if (rowsC == null) { leadC.Delete(); if (madeRuleC) ruleC.Delete(); continue; }
				var computedC = new Dictionary<string, CalculatedPathValue>(StringComparer.Ordinal);
				foreach (string[] aq in arithC)
				{
					CalculatedPathValue topC = EmitExpression(aq[1], legsC, toksC, rowsC, ref arithFnsC);
					if (topC == null) { okC = false; break; }
					leadC.CalculatedValueCollection.Add(topC);
					computedC[aq[0]] = topC;
				}
				if (!okC) { leadC.Delete(); if (madeRuleC) ruleC.Delete(); continue; }
				var pjC = new RoleSetDerivationProjection(ruleC, leadC);
				for (int i = 0; i < hC.Roles.Count; i++)
				{
					var drpC = new DerivedRoleProjection(pjC, hC.Roles[i]);
					if (typeRootC[i] != null)
					{
						var tSp = new RoleSubPath(myStore);
						leadC.SubPathCollection.Add(tSp);
						var tRoot = new RolePathObjectTypeRoot(tSp, typeRootC[i]);
						new DerivedRoleProjectedFromRolePathRoot(drpC, tRoot);
					}
					else if (konstAtC[i] >= 0)
					{
						var pcC = new PathConstant(myStore);
						pcC.LexicalValue = hLitsC[konstAtC[i]];
						new DerivedRoleProjectedFromPathConstant(drpC, pcC);
					}
					else if (atLegC[i] < 0)
					{
						if (arithKeyC[i] == null || !computedC.ContainsKey(arithKeyC[i])) { okC = false; break; }
						new DerivedRoleProjectedFromCalculatedPathValue(drpC, computedC[arithKeyC[i]]);
					}
					else
					{
						new DerivedRoleProjectedFromPathedRole(drpC, rowsC[atLegC[i]][atPosC[i]]);
					}
				}
				if (!okC) { pjC.Delete(); leadC.Delete(); if (madeRuleC) ruleC.Delete(); continue; }
				// Each threshold becomes a condition on the value its own leg bound. If this
				// is skipped the rule still BUILDS -- with the threshold dropped, which
				// widens it. Measured: the split landed without this and QueryShouldRetry
				// built as though `greater than 0` were not written.
				foreach (string[] th in thrC)
				{
					int tl = int.Parse(th[3]);
					int tp = legsC[tl].Players.IndexOf(th[0]);
					if (tp < 0) { okC = false; break; }
					Function tf = GetOrMakeFunction(th[1] == "is" ? "Equals" : (th[1] == "exceeds" ? "GreaterThan" : "LessThan"), true);
					var tcpv = new CalculatedPathValue(myStore);
					tcpv.Function = tf;
					var tL = new CalculatedPathValueInput(myStore); tcpv.InputCollection.Add(tL);
					var tR = new CalculatedPathValueInput(myStore); tcpv.InputCollection.Add(tR);
					int tpi = 0;
					foreach (FunctionParameter fp in tf.ParameterCollection)
					{
						if (tpi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(tL, fp);
						else if (tpi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(tR, fp); break; }
						tpi++;
					}
					new CalculatedPathValueInputBindsToPathedRole(tL, rowsC[tl][tp]);
					var tpc = new PathConstant(myStore);
					tpc.LexicalValue = th[2];
					new CalculatedPathValueInputBindsToPathConstant(tR, tpc);
					leadC.CalculatedConditionCollection.Add(tcpv);
				}
				if (!okC) continue;
				for (int qi = 0; qi < cmpC.Count; qi++)
				{
					bool aliased = false;
					for (int z = 0; z < aliasC.Length; z++) if (aliasC[z] == qi) aliased = true;
					if (aliased) continue;
					string[] cp = cmpC[qi];
					// THE RIGHT SIDE MAY BE A LITERAL. `that URI starts with 'https://...'`
					// tests a value the body already bound against a constant -- there is no
					// second leg to find, and refusing it drops the only thing the rule says.
					string cpLit = null;
					if (cp[2].Length > 1 && cp[2][0] == (char)39 && cp[2][cp[2].Length - 1] == (char)39)
						cpLit = cp[2].Substring(1, cp[2].Length - 2);
					int lL = -1, pL = -1, lR = -1, pR = -1;
					for (int l = 0; l < legsC.Count; l++)
					{
						for (int c = 0; c < legsC[l].Players.Count; c++)
						{
							// AN OPERAND IS NAMED THE WAY THE CLAUSE NAMED IT -- the same
							// precedence OperandFor uses for arithmetic. Matching the declared
							// player alone cannot see `Error Rate1` against `Error Rate2`, which
							// is how a corpus comparing an observed rate to a threshold's rate
							// names its two operands.
							if ((toksC[l][c] == cp[0] || legsC[l].Players[c] == cp[0]) && lL < 0) { lL = l; pL = c; }
							if ((toksC[l][c] == cp[2] || legsC[l].Players[c] == cp[2]) && lR < 0) { lR = l; pR = c; }
						}
					}
					if (lL < 0 || (lR < 0 && cpLit == null)) { okC = false; break; }
					bool equalC = cp[1] == "is";
					bool greater = cp[1] == "exceeds" || cp[1] == "is greater than" || cp[1] == "is above";
					bool startsC = cp[1] == "starts with";
					// minted on first use like Equals and GreaterThan, which NORMA does not
					// ship either -- the function library is tool-loaded data in the UI
					Function fnC = GetOrMakeFunction(startsC ? "StartsWith"
						: (equalC ? "Equals" : (greater ? "GreaterThan" : "LessThan")), true);
					var cpvC = new CalculatedPathValue(myStore);
					cpvC.Function = fnC;
					var ciL = new CalculatedPathValueInput(myStore); cpvC.InputCollection.Add(ciL);
					var ciR = new CalculatedPathValueInput(myStore); cpvC.InputCollection.Add(ciR);
					int fpi = 0;
					foreach (FunctionParameter fp in fnC.ParameterCollection)
					{
						if (fpi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(ciL, fp);
						else if (fpi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(ciR, fp); break; }
						fpi++;
					}
					new CalculatedPathValueInputBindsToPathedRole(ciL, rowsC[lL][pL]);
					if (cpLit != null)
					{
						var cpcC = new PathConstant(myStore);
						cpcC.LexicalValue = cpLit;
						new CalculatedPathValueInputBindsToPathConstant(ciR, cpcC);
					}
					else new CalculatedPathValueInputBindsToPathedRole(ciR, rowsC[lR][pR]);
					leadC.CalculatedConditionCollection.Add(cpvC);
				}
				if (!okC) continue;
				myBuiltRuleSentences.Add(sC);
				log.Add(hC.Fact.Name + " := chain over " + legsC.Count + " clauses"
					+ (cmpC.Count > 0 ? " with " + cmpC.Count + " comparison" : "") + ", "
					+ DescribeDerivation(hC.Fact));
			}
			var uRuleCount = new Dictionary<FactType, int>();
			foreach (string sPre in myDeferredRules)
			{
				string sp = sPre;
				while (sp.StartsWith("* * ")) sp = sp.Substring(2);
				Match pm = Regex.Match(sp, @"^\* (.+?) iff (.+)\.$");
				if (!pm.Success) continue;
				FactIndexEntry pe = FindEntryByNormalizedSentence(pm.Groups[1].Value.Trim());
				// a value-restricted rule counts against the fact type it restricts, or its
				// paths would exceed a rule count that never included it
				if (pe == null)
				{
					Match pvr = Regex.Match(pm.Groups[1].Value.Trim(), @"^(.+?) '[^']*'$");
					if (pvr.Success) pe = FindEntryByNormalizedSentence(pvr.Groups[1].Value.Trim());
				}
				if (pe == null) continue;
				int pc;
				uRuleCount.TryGetValue(pe.Fact, out pc);
				uRuleCount[pe.Fact] = pc + 1;
			}
			int unbuiltHeadless = 0, unbuiltUnmatched = 0, unbuiltPartial = 0, unbuiltValueRestricted = 0;
			foreach (string sRaw2 in myDeferredRules)
			{
				string s2 = sRaw2;
				while (s2.StartsWith("* * ")) s2 = s2.Substring(2);
				Match um = Regex.Match(s2, @"^\* (.+?) iff (.+)\.$");
				if (!um.Success) continue;
				FactIndexEntry uE = FindEntryByNormalizedSentence(um.Groups[1].Value.Trim());
				if (uE == null)
				{
					// A VALUE-RESTRICTED HEAD IS NOT AN UNDECLARED ONE. "External System
					// has Service Health Status 'degraded' iff ..." names the declared
					// fact type "External System has Service Health Status" with the
					// second role restricted to a value; looking the whole sentence up
					// finds nothing, and reporting that as undeclared sends the reader to
					// the declarations to fix something that is not wrong there.
					string uhead = um.Groups[1].Value.Trim();
					List<string> uLits;
					FactIndexEntry baseE = ResolveRestrictedHead(uhead, out uLits);
					if (baseE != null)
					{
						// the value-restricted arm may have built it. Resolve to the base and
						// fall through to the ordinary paths-vs-rules comparison, so a rule
						// that BUILT stops being reported as unbuilt and a head that built
						// only SOME of its restrictions still shows as partial.
						if (baseE.Fact.DerivationRule == null)
						{
							unbuiltValueRestricted++;
							log.Add("UNBUILT (head is value-restricted; the fact type is declared, the restriction is not built): " + s2);
							continue;
						}
						uE = baseE;
					}
					else
					{
						unbuiltHeadless++;
						log.Add("UNBUILT (head names no declared fact type): " + s2);
						continue;
					}
				}
				RoleProjectedDerivationRule udr = uE.Fact.DerivationRule;
				if (udr == null)
				{
					unbuiltUnmatched++;
					// "no arm matched the body" CONFLATES TWO DIFFERENT THINGS that want
					// opposite work: a body the oracle cannot EXPRESS (a capability gap,
					// work for the oracle) and a body that REFERENCES something undeclared
					// (a model defect, work for the model). Measured instance: `* VDP is
					// sourced from Listing Source iff some Listing has that VDP and that
					// Listing is sourced from that Listing Source.` needs no capability the
					// oracle lacks — one join variable, two legs, binary head — but its
					// first leg names "Listing has VDP", and auto.dev declares only the
					// TERNARY "Listing has VDP via Listing Channel". The leg dangles.
					//
					// So report HOW MANY LEGS RESOLVE, as a measurement and NOT as a
					// verdict. Deliberately not re-partitioning the summary counts: the
					// leg-to-reading mapping is arm-specific, this probe uses only the
					// common Dequantify + lookup, and a rule whose legs it cannot resolve
					// may still be perfectly expressible by an arm that reads them
					// differently. Claiming a partition here would repeat exactly the
					// false positive c134c964 removed. A LOW ratio is a model-defect
					// CANDIDATE for a human to check, nothing more.
					{
						// An AGGREGATE body is not a conjunction of legs — it is
						// "<value> is the count|sum of <type> WHERE <conditions>", and
						// Halpin states the shape plainly (p.33, the nrChildren example):
						// the function "returns a count of the number of fact instances
						// WHERE that person appears as the parent". So the where-clause is a
						// SELECTION over the counted type and ITS conditions are the legs;
						// the "<value> is the count of <type>" prefix names no fact type and
						// must not be resolved as one. Without this the splitter reported
						// 0/1 on every aggregate rule, which said only that the splitter
						// could not read them.
						string ubody = um.Groups[2].Value;
						Match uagg = Regex.Match(ubody, @"^.+? is the (?:count|sum) of .+? where (.+)$");
						if (uagg.Success) ubody = uagg.Groups[1].Value;
						string[] ulegs = ubody.Split(new[] { " and " }, StringSplitOptions.None);
						int ures = 0;
						foreach (string ul in ulegs)
						{
							string ut = Dequantify(" " + ul.Trim() + " ").Trim();
							if (ut.Length != 0 && FindEntryByNormalizedSentence(ut) != null) ures++;
						}
						log.Add("UNBUILT (head resolves, no arm matched the body) [legs resolving "
							+ ures + "/" + ulegs.Length + "]: " + s2);
					}
					continue;
				}
				int want, have = udr.OwnedLeadRolePathCollection.Count;
				uRuleCount.TryGetValue(uE.Fact, out want);
				// A STORED (**) derived fact HAS NO IN-STORE BODY BY DESIGN, so
				// zero paths is correct for it and not a partial build. The
				// value-condition arm states the mechanism where it skips them
				// (LeadRolePathAddedRule, RolePath.cs:6143-6152, clears
				// ExternalDerivation on any path add at commit, and only
				// External+Stored escapes GATE:188). This census did not know
				// that and reported `Object Type is instantiable` — declared
				// `Object Type is instantiable. **` at core.md:363 — as a head
				// with "0 path(s) for 1 rule(s)". It is not a defect, and the
				// false positive nearly cost a fire: it was written up as the
				// sharpest lead in the census before the marker was read.
				if (myStoredDerived.Contains(uE.Fact)) continue;
				if (have < want)
				{
					unbuiltPartial++;
					log.Add("UNBUILT (head has " + have + " path(s) for " + want
						+ " rule(s) - this one may be the unbuilt member): " + s2);
				}
			}
			if (unbuiltHeadless != 0 || unbuiltUnmatched != 0 || unbuiltPartial != 0 || unbuiltValueRestricted != 0)
			{
				if (myMarkerConflicts.Count > 0)
				{
					log.Add("DECLARED TWICE WITH DIFFERENT MARKINGS: " + myMarkerConflicts.Count
						+ " (the last one read wins, which makes the same head mean different things in different corpora)");
					foreach (string mc in myMarkerConflicts) log.Add("    " + mc);
				}
				log.Add("UNBUILT SUMMARY: " + unbuiltHeadless + " with an undeclared head, "
					+ unbuiltValueRestricted + " with a value-restricted head, "
					+ unbuiltUnmatched + " with a body no arm accepts, "
					+ unbuiltPartial + " on a head whose paths are fewer than its rules");
			}
			// CLAUSES NAMING NO DECLARED FACT TYPE. The arms are no longer the binding
			// constraint on this corpus -- the vocabulary is -- and this is the worklist
			// that says so. A rule builds only when EVERY clause of its body resolves, so
			// declaring one clause of a body missing several moves nothing; the count per
			// rule is what tells you which rules are one declaration away.
			//
			// Independent of the arms on purpose: it asks whether the corpus DECLARES what
			// its own rules read, which is a question about the readings and not about how
			// clever the builder is.
			var needClause = new SortedDictionary<string, int>(StringComparer.Ordinal);
			int rulesOneAway = 0;
			var oneAway = new SortedSet<string>(StringComparer.Ordinal);
			foreach (string sN in myDeferredRules)
			{
				Match mn = Regex.Match(sN, @"^\* (.+?) iff (.+)\.$");
				if (!mn.Success) continue;
				if (FindEntryByNormalizedSentence(mn.Groups[1].Value.Trim()) == null) continue;
				int miss = 0;
				string lastMissing = null;
				// the SAME split the arm uses, including the lower-case role-named target of
				// an arithmetic clause -- otherwise two clauses arrive glued together and the
				// report names a "missing fact type" that is really a split failure.
				foreach (string clN in SplitBody(mn.Groups[2].Value))
				{
					string tN = clN.Trim();
					if (tN.Length == 0) continue;
					List<string> pN;
					if (ResolveClauseSub(Dequantify(" " + tN + " ").Trim(), out pN) != null) continue;
					// try the same normalisations the arms do before calling a clause missing:
					// a subscript names a variable, and a trailing literal is a value restriction
					// on a fact type that may well be declared.
					// through ResolveClauseSub, not ResolveClause: these variants have to see the
					// subtype and role-name fallbacks too, or a clause the arm resolves by
					// stripping a literal AND a role name is still reported missing -- which is
					// how `that primary- External System has Service Health Status 'degraded'`
					// stayed on the one-away list for a rule that had started building.
					string bareN = Regex.Replace(tN, @"([A-Za-z])[0-9]\b", "$1");
					if (bareN != tN && ResolveClauseSub(Dequantify(" " + bareN + " ").Trim(), out pN) != null) continue;
					string litN = Regex.Replace(tN, @"\s*'[^']*'", "").Trim();
					if (litN != tN && ResolveClauseSub(Dequantify(" " + litN + " ").Trim(), out pN) != null) continue;
					// a comparison or arithmetic clause names no fact type BY DESIGN
					// The arm reads `A is B` between two DECLARED types as a comparison or an
					// alias, so it is not missing vocabulary either. Without this the census
					// reports rules that BUILD as one declaration away, which is the report
					// disagreeing with the builder about the same rule.
					// The role name goes with the variable here too, or the census keeps
					// reporting `company- Name is Company Name` as missing vocabulary for a
					// rule the arm now builds.
					Match cmN = Regex.Match(tN, @"^(?:that |some )?((?:[a-z][\w-]*- )?[A-Z][\w ]*?) (exceeds|is less than|is greater than|is below|is above|starts with|is) (?:that |some )?('[^']*'|[A-Z][\w ]*?)$");
					if (cmN.Success && myTypes.ContainsKey(Regex.Replace(cmN.Groups[1].Value.Trim(), @"^[a-z][\w-]*- ", ""))
						&& myTypes.ContainsKey(cmN.Groups[3].Value.Trim())) continue;
					// A clause naming no fact type BY DESIGN is not missing vocabulary: an
					// aggregate, an arithmetic expression, a negation or a comparison names a
					// computation, and reporting it as a missing DECLARATION sends the reader
					// to write a fact type that should not exist. The arm already filtered
					// these; the census did not, and so disagreed with it about what is wrong.
					if (Regex.IsMatch(tN, @" is the (count|sum|mean|min|max) of |the (minimum|maximum) of | (plus|minus|times|divided by|multiplied by) |\b(exceeds|is less than|is greater than|is below|is above|equals|or more|or fewer|at least|at most|more than|within|in range|in the past|no|not|neither)\b")) continue;
					miss++;
					int had;
					needClause.TryGetValue(tN, out had);
					needClause[tN] = had + 1;
					lastMissing = tN;
				}
				if (miss == 1)
				{
					rulesOneAway++;
					oneAway.Add(lastMissing + "   <- " + mn.Groups[1].Value.Trim());
				}
			}
			if (needClause.Count != 0)
			{
				log.Add("CLAUSES NAMING NO DECLARED FACT TYPE: " + needClause.Count
					+ " distinct, " + rulesOneAway + " rule(s) one declaration away");
				foreach (var kv in needClause)
					log.Add("  needs (" + kv.Value + "x): " + kv.Key);
				// the actionable half: declare THIS clause and THAT rule builds. Everything
				// above is the vocabulary debt; this is the part that pays out immediately.
				foreach (string oa in oneAway) log.Add("  ONE AWAY: " + oa);
			}
			// THE PARTIAL-HEAD INVARIANT. A head's population is the union of ALL its rules
			// (derive:merge_news folds every rule's news into the target), so emitting a STRICT
			// SUBSET under-approximates it. The build guards enforce all-or-none by declining
			// multi-rule heads outright; this reports whether that HELD, because nothing else can
			// see it. The canon differential compares rule-by-rule, so a 1-of-3 head scores as a
			// MATCH; builtgap counts it as reaching; law:station_rules only asks whether a recipe
			// RUNS; and a closure sweep reads it as an IMPROVEMENT, since a partial target still
			// counts as produced. Four instruments moving the right way for a change that loses
			// facts.
			// It cannot be a law: a head's TOTAL rule count lives only in the FORML source, and
			// state:rules cannot know what is missing from itself.
			{
				var emittedPerTarget = new Dictionary<string, int>(StringComparer.Ordinal);
				foreach (string rr in myRuleRecipes)
				{
					Match tm = Regex.Match(rr, "^S3\\(\"([^\"]*)\"");
					if (!tm.Success) continue;
					int c;
					emittedPerTarget.TryGetValue(tm.Groups[1].Value, out c);
					emittedPerTarget[tm.Groups[1].Value] = c + 1;
				}
				int partialHeads = 0;
				foreach (var kv in emittedPerTarget)
				{
					int total;
					if (!rulesPerFactName.TryGetValue(kv.Key, out total)) continue;
					if (kv.Value >= total) continue;
					partialHeads++;
					log.Add("PARTIAL HEAD (under-approximates: " + kv.Value + " of " + total
						+ " rules emitted): " + kv.Key);
				}
				log.Add("partial heads (a strict subset of a head's rules emitted): "
					+ partialHeads);
			}
			return log;
		}

		// the executable recipe for state:rules in the rules:metamodel grammar
		// (join = left's last column meets right's first; proj flips a leg
		// into that arrangement). v1 records the all-binary shape — wider
		// legs stay rules:metamodel-side.
		// A ONE-LEG CHAIN IS A RENAME. `Resource is of Function iff Resource is
		// instance of some Object Type` has no join column, so RecordRuleRecipe
		// cannot be its site; canon hand-writes <proj, FT, <N1,N2>> because Object
		// Type is a subtype of Function and populations share ONE ID SPACE, so the
		// pair IS a <Resource, Function> pair read at the supertype.
		// THE CAST IS CHECKED RATHER THAN ASSUMED: emitting a rename for every
		// one-leg chain would reproduce canon's answer for the two rules that exist
		// today without its RULE, and would mis-encode any one-leg chain whose types
		// do not stand in a subtype relation. Each head player must be the leg's
		// player at that position, or an ancestor of it.
		// THE AGGREGATE RECIPE. The count arm builds a complete NORMA rule --
		// CalculatedPathValue over Count, an aggregation context, both
		// DerivedRoleProjections -- and then only logs, so unlike the chain arm
		// there was no guard to widen: the emitter was simply absent. canon
		// hand-writes <count, FactTypeHasRole, N1>, and derive:eval reads the form
		// as <"count", source, groupColumn>.
		// COLUMN ORDER IS CHECKED, NOT ASSUMED: derive:count_for is
		// CONS(N(1), length . derive:filter_sel(...)), so every output row is
		// <groupValue, count> -- GROUP FIRST. The head must therefore read
		// (group, count), which is vAt == 1.
		// A head reading (count, group) would need proj(count(...), <N(2),N(1)>) --
		// expressible, since a source slot may be a sub-recipe -- but no such rule
		// exists today and emitting the UNFLIPPED recipe for it would be right for
		// the one case that exists and wrong by construction. Declined instead.
		private void RecordCountRecipe(FactIndexEntry headE, FactIndexEntry src, int vAt, int gAt)
		{
			if (headE.Players.Count != 2) return;
			if (vAt != 1) return;
			if (gAt < 0 || gAt >= src.Players.Count) return;
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), S3(" + IAtom("count") + ", "
				+ IAtom(src.Fact.Name) + ", N(" + (gAt + 1) + ")))");
		}

		// A MULTI-LEG CHAIN FOLDS. RecordRuleRecipe takes a fixed PAIR, so a chain of
		// three or more legs had no site: canon left-associates the joins,
		//   <join, <join, leg0, leg1, <N1,N3>>, <proj, leg2, <N2,N1>>, <N1,N3>>
		// and each join yields (left-non-join, JOIN, right-non-join) = 1,2,3, so
		// projecting <N1,N3> keeps the accumulator at two columns (root, current exit).
		// That invariant is what makes the fold work at every step: the accumulator is
		// always shaped like a left leg whose join column is already last.
		// Orientation per leg is the SAME pair of rules the two-leg recorder uses --
		// leg 0 with its EXIT last, every later leg JOIN-COLUMN-FIRST -- and the
		// identity cases stay BARE so the emitted tree is byte-equal to canon's.
		// LINEARITY IS REQUIRED AND CHECKED: the fold assumes each leg enters at the
		// variable its predecessor introduced. A leg closing back onto an already-bound
		// variable is a different topology and would fold wrong, silently, so it is
		// refused. Two-leg chains stay on RecordRuleRecipe's proven path; this fires
		// only at three or more.
		// THE CONJUNCTION RECIPE, for one or two conditions on a shared root.
		// Extracted so the STORED (**) path can emit it too: a stored fact keeps no
		// in-store NORMA body (LeadRolePathAddedRule clears ExternalDerivation on any
		// path add), but its executable recipe is parse-side -- the arm's own comment
		// says so, and AREST.tex def:derive agrees that completeness and storage are
		// ORTHOGONAL, so `**` means derived AND materialized and says nothing about
		// whether a rule exists. canon hand-writes the recipe; the silence was ours.
		// ONE leg is a select-then-project. TWO legs join on the shared root column:
		//   <joinon, srcA, srcB, <<N(rootA), N(rootB)>>, <N(rootA)>>
		// THREE or more are DECLINED -- nesting joinons is a different shape and no
		// such rule exists in the corpus, so emitting one would be a guess.
		private void RecordConjunctionRecipe(FactIndexEntry headE,
			List<KeyValuePair<FactIndexEntry, KeyValuePair<int, string>>> condLegs)
		{
			if (headE.Players.Count != 1) return;
			if (condLegs.Count < 1 || condLegs.Count > 2) return;
			var srcs = new List<string>();
			var roots = new List<int>();
			foreach (var leg in condLegs)
			{
				int rootAt = leg.Value.Key;
				if (rootAt < 0 || leg.Key.Players.Count != 2) return;
				string src = IAtom(leg.Key.Fact.Name);
				if (leg.Value.Value != null)
					// sel's third element is a SELECTOR, not an index - see derive:eval's
					// sel arm, which pairs it with the value and hands both to
					// derive:filter_sel. Columns are 1-based.
					src = "S4(" + IAtom("sel") + ", " + src + ", N(" + (2 - rootAt)
						+ "), " + IAtom(leg.Value.Value) + ")";
				srcs.Add(src);
				roots.Add(rootAt);
			}
			string recipe;
			if (srcs.Count == 1)
				recipe = "S3(" + IAtom("proj") + ", " + srcs[0]
					+ ", S1(N(" + (roots[0] + 1) + ")))";
			else
				recipe = "S5(" + IAtom("joinon") + ", " + srcs[0] + ", " + srcs[1]
					+ ", S1(S2(N(" + (roots[0] + 1) + "), N(" + (roots[1] + 1) + ")))"
					+ ", S1(N(" + (roots[0] + 1) + ")))";
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S1("
				+ IAtom(headE.Players[0]) + "), " + recipe + ")");
		}

		private void RecordChainFoldRecipe(FactIndexEntry headE, List<FactIndexEntry> legsIn,
			List<KeyValuePair<int, int>> posIn, bool linear, string rootVarT, string lastVarT)
		{
			if (!linear) return;
			if (legsIn.Count < 3) return;
			if (headE.Players.Count != 2) return;
			for (int i = 0; i < legsIn.Count; i++)
				if (legsIn[i].Players.Count != 2) return;
			// the head must be exactly (root, last exit); anything else means the chain
			// does not project onto the head the way this fold assumes
			if (rootVarT != headE.Players[0]) return;
			if (lastVarT != headE.Players[1]) return;
			string acc = posIn[0].Value == 1 ? IAtom(legsIn[0].Fact.Name)
				: "S3(" + IAtom("proj") + ", " + IAtom(legsIn[0].Fact.Name)
					+ ", S2(N(" + (posIn[0].Key + 1) + "), N(" + (posIn[0].Value + 1) + ")))";
			for (int i = 1; i < legsIn.Count; i++)
			{
				string legB = posIn[i].Key == 0 ? IAtom(legsIn[i].Fact.Name)
					: "S3(" + IAtom("proj") + ", " + IAtom(legsIn[i].Fact.Name)
						+ ", S2(N(" + (posIn[i].Key + 1) + "), N(" + (posIn[i].Value + 1) + ")))";
				acc = "S4(" + IAtom("join") + ", " + acc + ", " + legB + ", S2(N(1), N(3)))";
			}
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), " + acc + ")");
		}

		private void RecordRenameRecipe(FactIndexEntry headE, FactIndexEntry e1, int rootAt, int exitAt)
		{
			if (headE.Players.Count != 2 || e1.Players.Count != 2) return;
			if (rootAt < 0 || exitAt < 0 || rootAt == exitAt) return;
			if (rootAt > 1 || exitAt > 1) return;
			ObjectType tRoot, tExit;
			if (!myTypes.TryGetValue(e1.Players[rootAt], out tRoot)) return;
			if (!myTypes.TryGetValue(e1.Players[exitAt], out tExit)) return;
			if (!RootsAt(tRoot, headE.Players[0])) return;
			if (!RootsAt(tExit, headE.Players[1])) return;
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), S3(" + IAtom("proj") + ", "
				+ IAtom(e1.Fact.Name) + ", S2(N(" + (rootAt + 1) + "), N(" + (exitAt + 1) + "))))");
		}

		// Two clauses sharing an existential variable, compiled to the join recipe.
		// clauseA is the one holding the head's FIRST player and becomes legA, so its
		// non-join column lands in column 1 of the join. Returns null when either clause
		// fails to resolve, when the shared variable is not a player of both, or when a
		// head player cannot be located -- silence beats a recipe built on a guess.
		private string TwoClauseRecipe(FactIndexEntry headE, string clauseA, string clauseB,
			string joinVar)
		{
			FactIndexEntry a = FindEntryByNormalizedSentence(clauseA);
			FactIndexEntry b = FindEntryByNormalizedSentence(clauseB);
			if (a == null || b == null || a == b) return null;
			if (a.Players.Count != 2 || b.Players.Count != 2) return null;
			int ja = a.Players.IndexOf(joinVar), jb = b.Players.IndexOf(joinVar);
			if (ja < 0 || jb < 0) return null;
			// each head player must sit in exactly one of the two clauses, away from the join
			var located = new List<KeyValuePair<FactIndexEntry, int>>();
			foreach (string hp in headE.Players)
			{
				int ia = a.Players.IndexOf(hp), ib = b.Players.IndexOf(hp);
				if (ia >= 0 && ia != ja)
					located.Add(new KeyValuePair<FactIndexEntry, int>(a, ia));
				else if (ib >= 0 && ib != jb)
					located.Add(new KeyValuePair<FactIndexEntry, int>(b, ib));
				else return null;
			}
			return JoinRecipe(headE, a, b, ja, jb, located);
		}

		// THE TWO-LEG JOIN RECIPE, or null when the shape is refused. Extracted from
		// RecordRuleRecipe so the minus form can compile its POSITIVE and NEGATIVE sides
		// with the SAME rules -- canon writes both sides of a negated rule as this exact
		// join shape, so a second copy of the orientation logic would be two things to
		// keep in step. Callable three times: positive side, negative side, and the
		// original two-leg path.
		private string JoinRecipe(FactIndexEntry headE, FactIndexEntry e1, FactIndexEntry e2,
			int j1, int j2, List<KeyValuePair<FactIndexEntry, int>> located)
		{
			// A UNARY RIGHT LEG IS JOINABLE and was being refused, so
			// `LogEntryConcernsEEACustomer := join over Customer (LogEntryHasCustomer
			// x CustomerIsInEEA)` built in NORMA and emitted no recipe - canon never
			// learned the derivation and the fact type stayed in marker-closure's
			// witness. Asked the algebra rather than assuming:
			//     theta:NatJoin(2) over [[e1 c1] [e2 c2] [e3 c1]] x [[c1]]
			//         ->  [[e1 c1] [e3 c1]]
			// joins on the shared column, two columns out. The recipe was always
			// expressible; only this guard refused it.
			// The left leg may be WIDER THAN BINARY. The note above was right about a
			// UNARY leg (a flip is meaningless on one column) and wrong about wider ones:
			// `Event caused Transition in State Machine` is TERNARY, so
			// TransitionOccurredAtTimestamp built in NORMA and emitted no recipe -- the
			// last of the five join-over rules to be refused while the other four emitted.
			// canon hand-writes a PROJECTION, not a flip:
			//     <proj, EventCausedTransitionInStateMachine, <N2,N1>>
			// which is <the column e1 contributes, the JOIN column> with the join column
			// LAST -- exactly what theta:NatJoin(2) requires. So legA generalises from
			// "flip a binary" to "project any arity down to <contributed, join>": the same
			// operator, a wider input.
			// THE GENERAL FORM SUBSUMES THE BINARY ONE. binary+j1==0 yields
			// proj(e1, <N(2),N(1)>), identical to the old flip; binary+j1==1 makes the
			// projection the IDENTITY, and canon writes that leg BARE, so it stays bare
			// rather than emitting proj(e1, <N(1),N(2)>) -- semantically equal, and it
			// would break every existing MATCH.
			// AMBIGUITY IS REFUSED: projecting a wide leg to two columns DISCARDS the rest,
			// so it is sound only when e1 contributes EXACTLY ONE head player that is not
			// the join column. Two head players in a wide leg would silently lose one.
			if (headE.Players.Count != 2) return null;
			if (e1.Players.Count < 2) return null;
			if (j1 < 0 || j1 >= e1.Players.Count) return null;
			if (e2.Players.Count != 2 && !(e2.Players.Count == 1 && j2 == 0)) return null;
			int otherAt = -1, e1Heads = 0;
			foreach (var kvA in located)
			{
				if (kvA.Key != e1) continue;
				e1Heads++;
				if (kvA.Value != j1) otherAt = kvA.Value;
			}
			if (e1.Players.Count > 2 && (e1Heads != 1 || otherAt < 0)) return null;
			if (otherAt < 0) otherAt = 1 - j1;
			string legA = (e1.Players.Count == 2 && j1 == 1) ? IAtom(e1.Fact.Name)
				: "S3(" + IAtom("proj") + ", " + IAtom(e1.Fact.Name)
					+ ", S2(N(" + (otherAt + 1) + "), N(" + (j1 + 1) + ")))";
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
			return "S4(" + IAtom("join") + ", " + legA + ", " + legB
				+ ", S2(" + string.Join(", ", pos) + "))";
		}

		// The wrapper: <target, columnTypes, recipe>. The recipe itself is JoinRecipe's.
		private void RecordRuleRecipe(FactIndexEntry headE, FactIndexEntry e1, FactIndexEntry e2,
			int j1, int j2, List<KeyValuePair<FactIndexEntry, int>> located)
		{
			string recipe = JoinRecipe(headE, e1, e2, j1, j2, located);
			if (recipe == null) return;
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), " + recipe + ")");
		}

		// The projection-rename recipe. `at` gives, FOR EACH HEAD POSITION, the source
		// position it reads — the same direction canon already uses, where
		// S3(A("proj"), A("TransitionIsDefinedInStateMachineDefinition"), S2(N(2), N(1)))
		// means head role 1 takes source role 2. Canon is 1-based; `at` is 0-based.
		private void RecordProjRecipe(FactIndexEntry headE, FactIndexEntry srcE, int[] at)
		{
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			var pos = new List<string>();
			foreach (int a in at) pos.Add("N(" + (a + 1) + ")");
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), S3(A(\"proj\"), " + IAtom(srcE.Fact.Name)
				+ ", S" + pos.Count + "(" + string.Join(", ", pos) + ")))");
		}

		// The multi-key join recipe. Keys are 1-based WITHIN each leg; out positions are
		// 1-based over the CONCATENATION of the two legs, so a leg2 position p is n1+p.
		// Canon's shape, which this must reproduce:
		//   S5(A("joinon"), <src1>, <src2>, S2(S2(N(2), N(1)), S2(N(3), N(3))), S3(N(1), N(5), N(3)))
		private void RecordJoinOnRecipe(FactIndexEntry headE, FactIndexEntry aE, FactIndexEntry bE,
			List<KeyValuePair<int, int>> keys, int[] srcLeg, int[] srcPos)
		{
			var headPlayers = new List<string>();
			foreach (string p in headE.Players) headPlayers.Add(IAtom(p));
			var ks = new List<string>();
			foreach (var k in keys) ks.Add("S2(N(" + (k.Key + 1) + "), N(" + (k.Value + 1) + "))");
			int n1 = aE.Players.Count;
			var outs = new List<string>();
			for (int i = 0; i < srcLeg.Length; i++)
				outs.Add("N(" + (srcLeg[i] == 0 ? srcPos[i] + 1 : n1 + srcPos[i] + 1) + ")");
			myRuleRecipes.Add("S3(" + IAtom(headE.Fact.Name) + ", S" + headPlayers.Count + "("
				+ string.Join(", ", headPlayers) + "), S5(A(\"joinon\"), " + IAtom(aE.Fact.Name)
				+ ", " + IAtom(bE.Fact.Name) + ", S" + ks.Count + "(" + string.Join(", ", ks)
				+ "), S" + outs.Count + "(" + string.Join(", ", outs) + ")))");
		}

		// THE STAR-JOIN FOLD. n legs all sharing one variable v, folded left the way canon
		// hand-writes it. theta:NatJoin(2) joins LEFT COLUMN 2 with RIGHT COLUMN 1 (the
		// note on JoinRecipe reads it as "join column last", which is the same thing for a
		// binary left leg and misleading for a wider one), so the accumulator always
		// carries v at position 2 and each new leg presents v at position 1.
		//
		// Canon's twin, which fixes every index here:
		//   S4(A("join"), S4(A("join"),
		//        S3(A("proj"), A("TransitionIsFromStatus"), S2(N(2), N(1))),
		//        A("TransitionIsToStatus"), S3(N(1), N(2), N(3))),
		//      A("TransitionIsTriggeredByEventType"), S4(N(1), N(2), N(3), N(4)))
		// The leading proj turns [Transition, Status1] into [Status1, Transition] -- the
		// contributed player first, v second. Legs already presenting v first are written
		// BARE, and an identity projection stays bare rather than emitting proj(x,<1,2>):
		// semantically equal, but it would not match what canon holds.
		//
		// Result columns of a join are LEFT ++ (RIGHT minus its join column), so the
		// accumulated order is fixed by the fold, and the final `out` permutes that onto
		// the head's own player order. Intermediate `out`s are the identity.
		// Two-leg join recipe by EXPLICIT LEG INDEX, not by FactIndexEntry identity.
		// A SELF-JOIN resolves both legs to the SAME entry object -- `Domain1 reaches
		// Domain3 iff Domain1 reaches Domain2 and Domain2 reaches Domain3` is
		// DomainReachesDomain on both sides -- so JoinRecipe's identity-keyed `located`
		// cannot tell which leg a head player came from and emitted S2(N(2), N(2)) where
		// canon holds S2(N(1), N(3)). Leg index is carried explicitly here.
		//
		// theta:NatJoin(2) joins LEFT column 2 with RIGHT column 1, so the left leg must
		// present the join column second and the right leg first; a leg already in that
		// shape is written BARE, as canon writes it. Result columns are
		// left ++ (right minus its join column), and `out` permutes that onto head order.
		// A left leg wider than binary would have to be projected down to two columns and
		// would silently discard a contributed player, so it declines instead.
		private string TwoLegJoinRecipe(FactIndexEntry headE, FactIndexEntry aE, FactIndexEntry bE,
			List<string> at, List<string> bt, int ja, int jb, List<string> ht)
		{
			if (at.Count != 2) return null;                  // wider left leg would lose a column
			string left = ja == 1 ? IAtom(aE.Fact.Name)
				: "S3(A(\"proj\"), " + IAtom(aE.Fact.Name) + ", S2(N(2), N(1)))";
			string right;
			if (jb == 0) right = IAtom(bE.Fact.Name);
			else
			{
				var ord = new List<string>(); ord.Add("N(" + (jb + 1) + ")");
				for (int i = 0; i < bt.Count; i++) if (i != jb) ord.Add("N(" + (i + 1) + ")");
				right = "S3(A(\"proj\"), " + IAtom(bE.Fact.Name) + ", S" + ord.Count
					+ "(" + string.Join(", ", ord) + "))";
			}
			var acc = new List<string>();
			acc.Add(at[ja == 1 ? 0 : 1]); acc.Add(at[ja]);
			for (int i = 0; i < bt.Count; i++) if (i != jb) acc.Add(bt[i]);
			var outs = new List<string>();
			foreach (string h in ht)
			{
				int p = acc.IndexOf(h);
				if (p < 0) return null;
				outs.Add("N(" + (p + 1) + ")");
			}
			return "S4(A(\"join\"), " + left + ", " + right + ", S" + outs.Count
				+ "(" + string.Join(", ", outs) + "))";
		}

		// One side of a `minus`: the fact type bare when it already presents exactly the
		// head's columns in order, projected otherwise. Canon writes the identity case
		// bare -- StatusIsDefinedInStateMachineDefinition, not proj(...,<1,2>) -- so an
		// identity projection here would be semantically equal and still not match.
		// `unaryProj` matches a convention of canon's rather than a semantic need: on the
		// LEFT of a minus it wraps a unary source in proj(...,<1>), which on arity-1 rows
		// is the identity, while writing the right side bare. Redundant, and matched
		// anyway so the hand-written twin can be retired byte-for-byte -- a semantically
		// equal rule that does not match leaves the twin un-deletable, which is the whole
		// point of the exercise.
		private string SideExpr(FactIndexEntry e, int arity, List<int> pos, bool unaryProj)
		{
			bool identity = pos.Count == arity && !(unaryProj && arity == 1);
			for (int i = 0; i < pos.Count && identity; i++) if (pos[i] != i) identity = false;
			if (identity) return IAtom(e.Fact.Name);
			var ns = new List<string>();
			foreach (int p in pos) ns.Add("N(" + (p + 1) + ")");
			return "S3(A(\"proj\"), " + IAtom(e.Fact.Name) + ", S" + ns.Count
				+ "(" + string.Join(", ", ns) + "))";
		}

		// THE GENERAL JOIN PLAN: n legs whose shared variables do NOT all meet at one
		// centre, so the star fold cannot express them.
		//     * Status1 has effective Transition1 to Status2 on Event Type iff Transition1
		//       is from State Machine Definition1 and Transition1 is to Status2 and
		//       Transition1 is triggered by Event Type and Status1 is defined in State
		//       Machine Definition1.
		// Transition1 ties three legs; the fourth joins on State Machine Definition1
		// instead. Canon's twin IS the plan -- star-fold the commonest variable, reorder
		// the accumulator so the next join variable sits at column 2, then join the
		// remaining leg:
		//   join(proj(<star-fold over Transition>, <2,1,3,4>),
		//        proj(StatusIsDefinedInStateMachineDefinition, <2,1>), <5,1,3,4>)
		// theta:NatJoin(2) is why the reorder is needed at all: it always joins LEFT
		// column 2 with RIGHT column 1, so each stage must present its join variable there.
		//
		// The start leg is the first one carrying the centre in SENTENCE order, and its
		// other role becomes accumulator column 1 whether or not it is a head player --
		// here it is State Machine Definition1, which the head never mentions. The star
		// arm requires a head player there and so declines this correctly.
		private string GeneralJoinRecipe(List<FactIndexEntry> legs, List<List<string>> toks,
			List<string> ht, out string why)
		{
			why = null;
			if (legs.Count < 3) { why = "fewer than three legs"; return null; }
			// Centre = the variable carried by the most legs, and it must be carried by at
			// least THREE. A shape whose maximum sharing is two legs is a LINEAR CHAIN
			// (A-B-C), which the existing chain arm already builds and builds to canon --
			// StateMachineIsInstanceOfStateMachineDefinition is one, and claiming it here
			// replaced a matching recipe with a valid but differently shaped plan. This arm
			// is for star-plus-extra: a centre tying three or more legs, with the remainder
			// joining on some other variable.
			string centre = null; int best = 2;
			var seen = new List<string>();
			foreach (List<string> t in toks)
				foreach (string tok in t)
				{
					if (seen.Contains(tok)) continue;
					seen.Add(tok);
					int n = 0;
					foreach (List<string> u in toks) if (u.Contains(tok)) n++;
					if (n > best) { best = n; centre = tok; }
				}
			if (centre == null) { why = "no variable shared by two legs"; return null; }
			var star = new List<int>(); var rest = new List<int>();
			for (int i = 0; i < legs.Count; i++) (toks[i].Contains(centre) ? star : rest).Add(i);
			if (star.Count < 2) { why = "centre in fewer than two legs"; return null; }
			// fold the star: start leg first in sentence order, others in head order
			int s0 = star[0];
			int c0 = toks[s0].IndexOf(centre);
			int o0 = -1;
			for (int i = 0; i < toks[s0].Count; i++) if (i != c0) { o0 = i; break; }
			if (o0 < 0) { why = "start leg is unary"; return null; }
			string expr = (toks[s0].Count == 2 && o0 == 0 && c0 == 1)
				? IAtom(legs[s0].Fact.Name)
				: "S3(A(\"proj\"), " + IAtom(legs[s0].Fact.Name) + ", S2(N(" + (o0 + 1) + "), N(" + (c0 + 1) + ")))";
			var acc = new List<string>(); acc.Add(toks[s0][o0]); acc.Add(centre);
			var others = new List<int>();
			for (int k = 1; k < star.Count; k++) others.Add(star[k]);
			others.Sort(delegate(int x, int y)
			{
				return HeadRank(toks[x], toks[x].IndexOf(centre), ht).CompareTo(
				       HeadRank(toks[y], toks[y].IndexOf(centre), ht));
			});
			foreach (int li in others)
			{
				int c = toks[li].IndexOf(centre);
				string right = c == 0 ? IAtom(legs[li].Fact.Name) : ProjTo(legs[li], toks[li].Count, c);
				for (int i = 0; i < toks[li].Count; i++) if (i != c) acc.Add(toks[li][i]);
				expr = "S4(A(\"join\"), " + expr + ", " + right + ", " + Ident(acc.Count) + ")";
			}
			// fold the remaining legs, each on a variable it shares with the accumulator
			foreach (int li in rest)
			{
				string link = null; int lp = -1, rp = -1;
				for (int i = 0; i < acc.Count && link == null; i++)
				{
					int j = toks[li].IndexOf(acc[i]);
					if (j >= 0) { link = acc[i]; lp = i; rp = j; }
				}
				if (link == null) { why = "leg shares no variable with the accumulation"; return null; }
				// NatJoin(2) wants the link at accumulator column 2
				if (lp != 1)
				{
					var order = new List<string>(); var na = new List<string>();
					order.Add("N(" + (acc.IndexOf(acc[0] == link ? acc[1] : acc[0]) + 1) + ")");
					na.Add(acc[0] == link ? acc[1] : acc[0]);
					order.Add("N(" + (lp + 1) + ")"); na.Add(link);
					for (int i = 0; i < acc.Count; i++)
					{
						if (i == lp || acc[i] == na[0]) continue;
						order.Add("N(" + (i + 1) + ")"); na.Add(acc[i]);
					}
					expr = "S3(A(\"proj\"), " + expr + ", S" + order.Count + "("
						+ string.Join(", ", order) + "))";
					acc = na;
				}
				string right2 = rp == 0 ? IAtom(legs[li].Fact.Name) : ProjTo(legs[li], toks[li].Count, rp);
				for (int i = 0; i < toks[li].Count; i++) if (i != rp) acc.Add(toks[li][i]);
				expr = "S4(A(\"join\"), " + expr + ", " + right2 + ", " + Ident(acc.Count) + ")";
			}
			// final projection onto the head's own order
			var outs = new List<string>();
			foreach (string h in ht)
			{
				int p = acc.IndexOf(h);
				if (p < 0) { why = "head player " + h + " is in no leg"; return null; }
				outs.Add("N(" + (p + 1) + ")");
			}
			int last = expr.LastIndexOf(", S");
			if (last < 0) { why = "no join to project"; return null; }
			return expr.Substring(0, last) + ", S" + outs.Count + "("
				+ string.Join(", ", outs) + "))";
		}

		// a leg projected so its join column comes FIRST, the shape NatJoin(2) wants on the right
		private string ProjTo(FactIndexEntry leg, int arity, int joinPos)
		{
			var o = new List<string>(); o.Add("N(" + (joinPos + 1) + ")");
			for (int i = 0; i < arity; i++) if (i != joinPos) o.Add("N(" + (i + 1) + ")");
			return "S3(A(\"proj\"), " + IAtom(leg.Fact.Name) + ", S" + o.Count + "("
				+ string.Join(", ", o) + "))";
		}

		private static string Ident(int n)
		{
			var o = new List<string>();
			for (int i = 1; i <= n; i++) o.Add("N(" + i + ")");
			return "S" + n + "(" + string.Join(", ", o) + ")";
		}

		// Earliest head position among the players a leg contributes (its centre aside).
		// int.MaxValue for a leg contributing nothing, which sorts it last.
		private static int HeadRank(List<string> tok, int centre, List<string> ht)
		{
			int best = int.MaxValue;
			for (int i = 0; i < tok.Count; i++)
			{
				if (i == centre) continue;
				int p = ht.IndexOf(tok[i]);
				if (p >= 0 && p < best) best = p;
			}
			return best;
		}

		private string StarJoinRecipe(FactIndexEntry headE, List<FactIndexEntry> legs,
			List<List<string>> toks, List<int> centre, List<string> ht, int startLeg)
		{
			var acc = new List<string>();                     // accumulated column tokens
			string expr;
			{
				List<string> t = toks[startLeg]; int c = centre[startLeg];
				int h0 = -1;
				for (int i = 0; i < t.Count; i++) if (i != c && ht.Contains(t[i])) { h0 = i; break; }
				if (h0 < 0) return null;
				if (t.Count == 2 && h0 == 0 && c == 1) expr = IAtom(legs[startLeg].Fact.Name);
				else expr = "S3(A(\"proj\"), " + IAtom(legs[startLeg].Fact.Name)
					+ ", S2(N(" + (h0 + 1) + "), N(" + (c + 1) + ")))";
				acc.Add(t[h0]); acc.Add(t[c]);
			}
			// FOLD IN HEAD ORDER, NOT SENTENCE ORDER. Both are semantically correct, but
			// canon folds by the position the leg's contributed player occupies in the
			// HEAD, which is why its intermediate `out`s come out as identities -- the
			// accumulator grows in the head's own column order. Reading
			//   * Status1 reaches Status2 in SMD iff some Transition is defined in that
			//     SMD and that Transition is from Status1 and that Transition is to Status2.
			// sentence order folds SMD before Status2 and lands a correct but differently
			// shaped rule; head order folds Status2 first and reproduces the twin.
			var order5 = new List<int>();
			for (int li = 0; li < legs.Count; li++) if (li != startLeg) order5.Add(li);
			order5.Sort(delegate(int x, int y)
			{
				return HeadRank(toks[x], centre[x], ht).CompareTo(HeadRank(toks[y], centre[y], ht));
			});
			foreach (int li in order5)
			{
				List<string> t = toks[li]; int c = centre[li];
				string right;
				if (c == 0) right = IAtom(legs[li].Fact.Name);
				else
				{
					var order = new List<string>(); order.Add("N(" + (c + 1) + ")");
					for (int i = 0; i < t.Count; i++) if (i != c) order.Add("N(" + (i + 1) + ")");
					right = "S3(A(\"proj\"), " + IAtom(legs[li].Fact.Name)
						+ ", S" + order.Count + "(" + string.Join(", ", order) + "))";
				}
				for (int i = 0; i < t.Count; i++) if (i != c) acc.Add(t[i]);
				var ident = new List<string>();
				for (int i = 0; i < acc.Count; i++) ident.Add("N(" + (i + 1) + ")");
				expr = "S4(A(\"join\"), " + expr + ", " + right
					+ ", S" + ident.Count + "(" + string.Join(", ", ident) + "))";
			}
			// permute the accumulation onto the head's order; identity if they agree
			var outs = new List<string>();
			foreach (string h in ht)
			{
				int p = acc.IndexOf(h);
				if (p < 0) return null;
				outs.Add("N(" + (p + 1) + ")");
			}
			bool identityOut = outs.Count == acc.Count;
			for (int i = 0; i < outs.Count && identityOut; i++) if (outs[i] != "N(" + (i + 1) + ")") identityOut = false;
			if (!identityOut)
			{
				int lastJoin = expr.LastIndexOf(", S");
				if (lastJoin < 0) return null;
				expr = expr.Substring(0, lastJoin) + ", S" + outs.Count + "(" + string.Join(", ", outs) + "))";
			}
			return expr;
		}

		// One side of a minus from ONE or TWO legs, projected onto the head's columns.
		// Two legs join on their single shared variable and the LEFT leg is the one
		// contributing head token 0 -- the head-order rule the star fold uses, and why
		// canon writes proj(TransitionIsFromStatus,<2,1>) first.
		private string SideFromLegs(List<FactIndexEntry> legs, List<List<string>> toks, List<string> ht)
		{
			if (legs.Count == 1)
			{
				var pos = new List<int>();
				foreach (string h in ht) { int p = toks[0].IndexOf(h); if (p < 0) return null; pos.Add(p); }
				return SideExpr(legs[0], toks[0].Count, pos, false);
			}
			if (legs.Count != 2) return null;
			int ja = -1, jb = -1, shared = 0;
			for (int x = 0; x < toks[0].Count; x++)
				for (int y = 0; y < toks[1].Count; y++)
					if (toks[0][x] == toks[1][y]) { shared++; if (!ht.Contains(toks[0][x])) { ja = x; jb = y; } }
			if (shared != 1 || ja < 0) return null;
			int li = -1;
			for (int c = 0; c < toks[0].Count; c++) if (c != ja && toks[0][c] == ht[0]) li = 0;
			if (li < 0) for (int c = 0; c < toks[1].Count; c++) if (c != jb && toks[1][c] == ht[0]) li = 1;
			if (li < 0) return null;
			return li == 0
				? TwoLegJoinRecipe(null, legs[0], legs[1], toks[0], toks[1], ja, jb, ht)
				: TwoLegJoinRecipe(null, legs[1], legs[0], toks[1], toks[0], jb, ja, ht);
		}

		// Build ONE CHAIN in a SINGLE sub-path: start at the leg carrying `rootTok`, then
		// append the next leg entered at the variable the two share. Sub-paths are for
		// BRANCHING, not chaining -- nesting each leg in its own child path rendered them
		// as sibling conjuncts with the second subject missing.
		//
		// NEGATION GOES ON THE PATHED ROLE, NOT THE SPLIT, and the snippet table says why:
		//   NegatedChainedListOpen  = "it is not true that ("
		//   NegatedAndLeadListOpen  = "at least one of the following is false:"
		// SplitIsNegated negates a path's SPLIT and therefore selects the And rendering,
		// which is De Morgan and NOT what `no X ... where ...` means. PathedRole.IsNegated
		// selects the chained rendering -- the same mechanism that made the unary
		// `it is not true that` case round-trip in f9827271.
		// The order a chain of legs can be walked in, or null if it cannot: start at the
		// leg holding the root token, then take each next leg BECAUSE it shares a token
		// with something already bound. Pure, so an arm can ask whether a body is
		// walkable BEFORE it constructs a rule and a path it would then have to abandon.
		// The old order was "the root's leg, then the rest as they came", which for three
		// or more legs hands the walk a leg sharing nothing with what precedes it. For two
		// legs this returns exactly what that did, so nothing already building moves.
		// Compile `Gross Amount minus Discount Amount times 2` into nested
		// CalculatedPathValues. NORMA carries this natively --
		// CalculatedPathValueInputBindsToCalculatedPathValue nests one inside another --
		// so an expression TREE maps directly and nothing has to be flattened or baked.
		//
		// LEFT-ASSOCIATIVE, NO PRECEDENCE, on purpose. FORML writes these as prose and the
		// corpus parenthesises whenever it means grouping ("10 plus (base MSRP times ...)"),
		// so inventing precedence here would silently disagree with a reading that spelled
		// its intent out. An expression with brackets is declined rather than guessed at.
		//
		// Every operand must be BOUND BY A LEG or be a number. An operand the body never
		// introduced would otherwise bind to nothing and the head would compute from a
		// value that is not there.
		private CalculatedPathValue EmitExpression(string expr, List<FactIndexEntry> legs,
			List<List<string>> toks, PathedRole[][] rows, ref Dictionary<string, Function> fns)
		{
			if (expr.IndexOf('(') >= 0 || expr.IndexOf(')') >= 0) return null;
			string[] bits = Regex.Split(expr.Trim(), @" (plus|minus|times|divided by) ");
			if (bits.Length < 3 || bits.Length % 2 == 0) return null;
			object acc = OperandFor(bits[0].Trim(), legs, toks, rows);
			if (acc == null) return null;
			for (int i = 1; i + 1 < bits.Length; i += 2)
			{
				object rhs = OperandFor(bits[i + 1].Trim(), legs, toks, rows);
				if (rhs == null) return null;
				string fname = bits[i] == "plus" ? "Add" : bits[i] == "minus" ? "Subtract"
					: bits[i] == "times" ? "Multiply" : "Divide";
				Function fn = GetOrMakeFunction(fname, false);
				var cpv = new CalculatedPathValue(myStore);
				cpv.Function = fn;
				var inL = new CalculatedPathValueInput(myStore); cpv.InputCollection.Add(inL);
				var inR = new CalculatedPathValueInput(myStore); cpv.InputCollection.Add(inR);
				int pi = 0;
				foreach (FunctionParameter fp in fn.ParameterCollection)
				{
					if (pi == 0) new CalculatedPathValueInputCorrespondsToFunctionParameter(inL, fp);
					else if (pi == 1) { new CalculatedPathValueInputCorrespondsToFunctionParameter(inR, fp); break; }
					pi++;
				}
				BindOperand(inL, acc);
				BindOperand(inR, rhs);
				acc = cpv;
			}
			return acc as CalculatedPathValue;
		}

		// A value already walked to by the chain, or a literal number. Anything else is
		// not an operand this can honour.
		private object OperandFor(string tok, List<FactIndexEntry> legs,
			List<List<string>> toks, PathedRole[][] rows)
		{
			if (Regex.IsMatch(tok, @"^[0-9]+(\.[0-9]+)?$"))
			{
				var pc = new PathConstant(myStore);
				pc.LexicalValue = tok;
				return pc;
			}
			// AN OPERAND IS NAMED THE WAY THE CLAUSE NAMED IT. The tax total adds eight
			// amounts that all declare the player `Amount` or `Fee Amount`; only the role
			// name tells them apart, so matching on the player alone finds the first one
			// eight times over. Qualified match first, declared player second -- the same
			// precedence the head roles use.
			if (toks != null)
				for (int l = 0; l < legs.Count; l++)
					for (int c = 0; c < toks[l].Count; c++)
						if (toks[l][c] == tok) return rows[l][c];
			for (int l = 0; l < legs.Count; l++)
				for (int c = 0; c < legs[l].Players.Count; c++)
					if (legs[l].Players[c] == tok) return rows[l][c];
			return null;
		}

		private void BindOperand(CalculatedPathValueInput input, object operand)
		{
			PathedRole pr = operand as PathedRole;
			if (pr != null) { new CalculatedPathValueInputBindsToPathedRole(input, pr); return; }
			PathConstant pc = operand as PathConstant;
			if (pc != null) { new CalculatedPathValueInputBindsToPathConstant(input, pc); return; }
			new CalculatedPathValueInputBindsToCalculatedPathValue(input, (CalculatedPathValue)operand);
		}

		// One function per NAME per model. Every arm that needs Equals or LessThan
		// creates it on demand, so a later arm that only checks its OWN cached variable
		// makes a SECOND one -- and NORMA throws from Function.set_Model rather than
		// merging them. Look in the store first; the minimal tests never caught this
		// because nothing else had created one there.
		// Resolve a clause, allowing a SUBTYPE where the declared reading names an
		// ancestor: `some Sales Tax Rate applies in that County Sales Tax Jurisdiction`
		// is the declared `Sales Tax Rate applies in Sales Tax Jurisdiction`. Head
		// resolution already did this; clause resolution did not, so a corpus that
		// declares a supertype and reads its subtypes -- which is why one declares a
		// supertype at all -- resolved on one side only.
		private FactIndexEntry ResolveClauseSub(string clause, out List<string> players)
		{
			string swapped;
			return ResolveClauseSub(clause, out players, out swapped);
		}

		// `swappedPlayer` names the DECLARED player that only matched because a subtype
		// was substituted for it. The caller needs to know: the role NORMA builds is
		// typed by the supertype, so joining another leg onto it is a subtype step, and
		// an arm that cannot lay one down must decline rather than join anyway.
		private FactIndexEntry ResolveClauseSub(string clause, out List<string> players, out string swappedPlayer)
		{
			swappedPlayer = null;
			FactIndexEntry e = ResolveClause(clause, out players);
			if (e != null) return e;
			foreach (string subName in myTypes.Keys.OrderByDescending(n => n.Length))
			{
				int at = clause.IndexOf(subName, StringComparison.Ordinal);
				if (at < 0) continue;
				int end = at + subName.Length;
				while (end < clause.Length && char.IsDigit(clause[end])) end++;
				bool leftOk = at == 0 || !char.IsLetterOrDigit(clause[at - 1]);
				bool rightOk = end >= clause.Length || !char.IsLetterOrDigit(clause[end]);
				if (!leftOk || !rightOk) continue;
				foreach (string supName in myTypes.Keys)
				{
					if (supName == subName || !RootsAt(myTypes[subName], supName)) continue;
					e = ResolveClause(clause.Substring(0, at) + supName + clause.Substring(end), out players);
					if (e != null) { swappedPlayer = supName; return e; }
				}
			}
			// A ROLE NAME CAN QUALIFY A VARIABLE WHERE THE DECLARATION CARRIES NONE.
			//     Noun is backed by External System.                      <- declared
			//     ... Noun is backed by primary- External System and ...  <- the rule
			// `primary-` is not part of the reading; it names WHICH External System, so
			// that the same rule can name a second one (`alternate-`) and mean a different
			// variable. Tried LAST, so a role name that IS part of a declared reading --
			// `Resource Declaration has override- Fetcher` -- still resolves as itself.
			string unqualified = Regex.Replace(clause, @"(?<![\w-])[a-z][\w-]*- (?=[A-Z])", "");
			if (unqualified != clause)
			{
				e = ResolveClause(unqualified, out players);
				if (e != null) return e;
			}
			return null;
		}

		private static string StripRolePrefix(string tok)
		{
			return Regex.Replace(Regex.Replace(tok, @"^[a-z][\w-]*- ", ""), "[0-9]+$", "");
		}

		// An aggregate is minted the way Count is -- one BAG parameter, and IsAggregate
		// set explicitly because it is DERIVED from whether a parameter has BagInput.
		// Reused if the library already holds it: a second Function of the same name is
		// what made Function.set_Model throw.
		private Function GetOrMakeAggregate(string name)
		{
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && fn.IsAggregate && fn.Name == name) return fn;
			}
			var made = new Function(myStore);
			made.Name = name;
			made.IsAggregate = true;
			var bag = new FunctionParameter(myStore);
			bag.Function = made;
			bag.Name = "bag";
			bag.BagInput = true;
			return made;
		}

		private Function GetOrMakeFunction(string name, bool boolean)
		{
			foreach (Function fn in myStore.ElementDirectory.FindElements<Function>(true))
			{
				if (!fn.IsDeleted && fn.Name == name) return fn;
			}
			var made = new Function(myStore);
			made.Name = name;
			made.IsBoolean = boolean;
			made.Model = myModel;
			var pl = new FunctionParameter(myStore); pl.Function = made; pl.Name = "left";
			var pr = new FunctionParameter(myStore); pr.Function = made; pr.Name = "right";
			return made;
		}

		// A ROLE NAME QUALIFIES THE VARIABLE, and the head spells it out.
		// `Support Request has contact- Name` names that Name role `contact`, and the
		// rule refers back to it as `contact- Name`, so the head player (Name) and the
		// clause (contact- Name) are one variable under two spellings. Six sibling rules
		// in this family -- Description, Subject, Category, Timestamp -- build on the
		// plain spelling; these are the same rule with a role name on the head role.
		private static List<string> RoleQualified(string text, List<string> players)
		{
			return RoleQualified(text, players, false);
		}

		// `withSubscript` also takes the digits FORML uses to tell two variables of one
		// type apart. Kept opt-in: it changes what joins, and the arms that already work
		// without it have their own tokenisers.
		private static List<string> RoleQualified(string text, List<string> players, bool withSubscript)
		{
			var toks = new List<string>();
			int from = 0;
			foreach (string p in players)
			{
				int at = text.IndexOf(p, from, StringComparison.Ordinal);
				if (at < 0) { toks.Add(p); continue; }
				int start = at;
				if (at >= 2 && text[at - 1] == ' ' && text[at - 2] == '-')
				{
					int w = at - 2;
					while (w > 0 && (char.IsLetterOrDigit(text[w - 1]) || text[w - 1] == '-')) w--;
					if (w < at - 2) start = w;
				}
				int stop = at + p.Length;
				if (withSubscript) while (stop < text.Length && char.IsDigit(text[stop])) stop++;
				toks.Add(text.Substring(start, stop - start));
				from = stop;
			}
			return toks;
		}

		private static List<int> ChainOrder(List<List<string>> toks, string rootTok)
		{
			return ChainOrder(toks, rootTok, null);
		}

		// A NEGATED LEG BINDS NOTHING OUTSIDE ITSELF. Its variables exist only under the
		// negation, so it can neither root the path nor be entered by a later leg -- it
		// can only be hung off something the positive legs already bound. Ordering the
		// positives first and the negated ones last is the whole of that rule.
		private static List<int> ChainOrder(List<List<string>> toks, string rootTok, bool[] negLeg)
		{
			if (toks.Count < 1) return null;
			int first = -1;
			for (int i = 0; i < toks.Count; i++)
			{
				if (negLeg != null && negLeg[i]) continue;
				if (toks[i].Contains(rootTok)) { first = i; break; }
			}
			if (first < 0) return null;
			var order = new List<int>(); order.Add(first);
			var bound = new HashSet<string>(toks[first], StringComparer.Ordinal);
			var left = new List<int>();
			for (int i = 0; i < toks.Count; i++) if (i != first) left.Add(i);
			while (left.Count > 0)
			{
				int pick = -1;
				foreach (int i in left)
				{
					if (negLeg != null && negLeg[i]) continue;
					foreach (string t in toks[i]) if (bound.Contains(t)) { pick = i; break; }
					if (pick >= 0) break;
				}
				// A LEG THAT SHARES NOTHING RESTARTS. Two legs joined only by a value
				// comparison -- Codd's theta join -- have no token in common, and refusing
				// them refused every customer-resolution rule in the corpus. Take one anyway;
				// BuildChain gives it a sub-path with its OWN root, which a RoleSubPath may
				// carry because it is itself a RolePath (ORMCore.dsl: RootObjectType is
				// ZeroOne PER PATH, not per lead).
				if (pick < 0)
					foreach (int i in left) if (negLeg == null || !negLeg[i]) { pick = i; break; }
				if (pick < 0) break;
				order.Add(pick); left.Remove(pick);
				foreach (string t in toks[pick]) bound.Add(t);
			}
			foreach (int i in new List<int>(left))
			{
				bool entered = false;
				foreach (string t in toks[i]) if (bound.Contains(t)) { entered = true; break; }
				if (!entered) return null;
				order.Add(i); left.Remove(i);
			}
			return order;
		}

		private PathedRole[][] BuildChain(RolePath parent, List<FactIndexEntry> legs,
			List<List<string>> toks, string rootTok, bool negated)
		{
			return BuildChain(parent, legs, toks, rootTok, negated, null);
		}

		private PathedRole[][] BuildChain(RolePath parent, List<FactIndexEntry> legs,
			List<List<string>> toks, string rootTok, bool negated, bool[] negLeg)
		{
			List<int> order = ChainOrder(toks, rootTok, negLeg);
			if (order == null) return null;
			// EACH LEG ATTACHES WHERE ITS ENTRY VARIABLE WAS BOUND, which is sometimes the
			// lead and sometimes another leg's sub-path. Laying every leg into ONE sub-path
			// chains them unconditionally, and NORMA rejects that the moment two legs both
			// enter at the ROOT -- a STAR, not a chain:
			//     Quote has Gross Amount and Quote has Discount Amount
			// reads as joining from Gross Amount to Quote, and answers
			// "joins to a path role with an incompatible role player". Tracking where each
			// token was bound gives siblings off the lead for a star and nesting for a walk,
			// which is the same rule the constraint-side builder follows.
			var slots = new PathedRole[legs.Count][];
			var boundAt = new Dictionary<string, RolePath>(StringComparer.Ordinal);
			var boundRole = new Dictionary<string, PathedRole>(StringComparer.Ordinal);
			// ONE UNIFIER PER VARIABLE. A pathed role may belong to at most one -- adding it
			// to a second throws inside ElementLink's constructor, which surfaces as the
			// whole run dying with built: 0. A variable with THREE legs hanging off it (the
			// AI Act's risk-management rule has that shape) needs one unifier carrying the
			// bound role and every branch root, not one unifier per branch.
			var uniByTok = new Dictionary<string, PathObjectUnifier>(StringComparer.Ordinal);
			LeadRolePath leadForUni = parent as LeadRolePath;
			// A SUB-PATH CONTINUES FROM WHERE ITS PARENT ENDED, not from the role whose
			// variable it entered on. Off the LEAD that is a branch and NORMA reads it as
			// one; off another sub-path it is not, and the second child silently continues
			// from the first child's last role instead. kernel's `State1 steps to State2 by
			// Operator1 and Operator1 costs Count1 and State2 is goal` has both the cost leg
			// and the goal leg hanging off the steps leg, and NORMA rendered the second as
			// "that OPERATOR is some State2 that is goal" -- then said so, with an
			// incompatible-role-player error. Refuse the shape rather than emit it.
			var childCount = new Dictionary<RolePath, int>();
			boundAt[rootTok] = parent;
			RoleSubPath firstSp = null;
			for (int k = 0; k < order.Count; k++)
			{
				int li = order[k];
				string entryTok = null;
				foreach (string t in toks[li]) if (boundAt.ContainsKey(t)) { entryTok = t; break; }
				var sp = new RoleSubPath(myStore);
				int ep;
				if (entryTok == null)
				{
					// disconnected: a sub-path of its own, rooted at its own entry player. The
					// condition that ties it to the rest is added by the caller.
					ObjectType freshRoot;
					if (!myTypes.TryGetValue(toks[li][0], out freshRoot)) return null;
					parent.SubPathCollection.Add(sp);
					new RolePathObjectTypeRoot(sp, freshRoot);
					entryTok = toks[li][0];
					ep = 0;
				}
				else
				{
					ep = toks[li].IndexOf(entryTok);
					RolePath into = boundAt[entryTok];
					int kids;
					childCount.TryGetValue(into, out kids);
					if (into != parent && kids > 0)
					{
						if (leadForUni == null || !boundRole.ContainsKey(entryTok)) return null;
						parent.SubPathCollection.Add(sp);
						// ROOTED AT ITS OWN ENTRY PLAYER. Off the lead a sub-path continues from
						// the LEAD'S ROOT, so without this the branch joins to the head's subject
						// -- NORMA read `Leaf1 is goal` as "that NODE is some Leaf2 that is goal".
						// With its own root it stands alone and the unifier says which variable it
						// is; same lesson as the subtype cross join.
						ObjectType uniRootT;
						if (!myTypes.TryGetValue(legs[li].Players[ep], out uniRootT)) return null;
						var uniRoot = new RolePathObjectTypeRoot(sp, uniRootT);
						var uniRow = new PathedRole[legs[li].Roles.Count];
						EnterLeg(sp, legs[li], ep, uniRow);
						PathObjectUnifier uni;
						if (!uniByTok.TryGetValue(entryTok, out uni))
						{
							uni = new PathObjectUnifier(myStore.DefaultPartition);
							new LeadRolePathHasObjectUnifier(leadForUni, uni);
							new PathObjectUnifierUnifiesPathedRole(uni, boundRole[entryTok]);
							uniByTok[entryTok] = uni;
						}
						new PathObjectUnifierUnifiesRolePathRoot(uni, uniRoot);
						slots[li] = uniRow;
						if (firstSp == null) firstSp = sp;
						if (negLeg != null && negLeg[li]) { uniRow[ep].IsNegated = true; continue; }
						for (int c = 0; c < toks[li].Count; c++)
							if (!boundAt.ContainsKey(toks[li][c]))
								{ boundAt[toks[li][c]] = sp; boundRole[toks[li][c]] = uniRow[c]; }
						continue;
					}
					childCount[into] = kids + 1;
					into.SubPathCollection.Add(sp);
				}
				if (firstSp == null) firstSp = sp;
				var row = new PathedRole[legs[li].Roles.Count];
				EnterLeg(sp, legs[li], ep, row);
				slots[li] = row;
				if (negLeg != null && negLeg[li])
				{
					// negated ON ITS ENTRY ROLE, the same place the whole-chain form puts it,
					// and its variables stay unbound so nothing downstream can join to them
					row[ep].IsNegated = true;
					continue;
				}
				for (int c = 0; c < toks[li].Count; c++)
					if (!boundAt.ContainsKey(toks[li][c]))
						{ boundAt[toks[li][c]] = sp; boundRole[toks[li][c]] = row[c]; }
			}
			// ONE negation over the whole chain, on its ENTRY role. Negating every pathed
			// role stacks them -- NORMA rendered "no Transition is that from Status where
			// it is not true that (...)", a negation per leg. Negating only the entry
			// gives "no Transition is from Status where that Transition is defined in
			// that SMD", which is the single NOT EXISTS the reading means.
			if (negated && firstSp != null && firstSp.PathedRoleCollection.Count > 0) firstSp.PathedRoleCollection[0].IsNegated = true;
			return slots;
		}

		// Lay one leg into a sub-path with the ENTRY ROLE CREATED FIRST. PathedRoles are
		// ordered within a path, and NORMA rejects a SameFactType role that is not
		// preceded by an entry into that fact type -- so building them in role order is
		// invalid whenever the entry is not role 0. Silent in the recipe, which is why a
		// recipe-only acceptance test missed it across three commits; the model errors in
		// NORMA's own report are what surfaced it.
		private void EnterLeg(RoleSubPath sp, FactIndexEntry leg, int entryPos, PathedRole[] row)
		{
			row[entryPos] = new PathedRole(sp, leg.Roles[entryPos]);
			row[entryPos].PathedRolePurpose = PathedRolePurpose.PostInnerJoin;
			for (int c = 0; c < leg.Roles.Count; c++)
			{
				if (c == entryPos) continue;
				row[c] = new PathedRole(sp, leg.Roles[c]);
				row[c].PathedRolePurpose = PathedRolePurpose.SameFactType;
			}
		}

		// Which role positions of a clause are BOUND to the surrounding rule, read off the
		// `that` marker that FORML uses for exactly this. In
		//     no Status is initial in that State Machine Definition
		// `Status` carries no `that` and is a FRESH existential -- "no status at all" --
		// while `that State Machine Definition` is the head's. Getting this wrong collapses
		// the two: joining on both positions would subtract only statuses that are
		// themselves initial, instead of every rooted status in a machine that HAS one.
		private static bool[] BoundPositions(string clause, List<string> players)
		{
			var bound = new bool[players.Count];
			int from = 0;
			for (int i = 0; i < players.Count; i++)
			{
				int at = clause.IndexOf(players[i], from, StringComparison.Ordinal);
				if (at < 0) { from = 0; at = clause.IndexOf(players[i], StringComparison.Ordinal); }
				if (at < 0) continue;
				string before = clause.Substring(0, at);
				bound[i] = before.EndsWith("that ", StringComparison.Ordinal);
				from = at + players[i].Length;
			}
			return bound;
		}

		// A SEMI-DERIVED rule is spelled `+ <head> if <body>.` and was NEVER COLLECTED:
		// the deferral test asked for " iff " or a `* ` start, so `+` sentences fell
		// through before any arm could see them -- 132 of them across apps/, dropped
		// without a word. NORMA's own snippets fix the spelling: *,** verbalize
		// "if and only if" (EQUALITY) and +,++ verbalize "if" (SUBSET).
		//
		// Every arm matches the `* ... iff ...` spelling, so the sentence is normalized
		// to it HERE, once, instead of in eleven regexes.
		//
		// SAFE FOR MODE, which is the whole question: ApplyDerivationMarkers reads
		// myFullyDerived / mySemiDerived / myStoredDerived, and those are populated from
		// the DECLARATION line (`Predicate is performed during Transition. +`), never
		// from the rule sentence. That is why that rule came out `semiderived` while its
		// sentence still read `*`. Normalizing changes what the arms MATCH, not what the
		// rule MEANS -- a `+` head stays PartiallyDerived and keeps subset semantics.
		private static string NormalizeRuleSentence(string s)
		{
			// STRIP THE MARKER FIRST, then supply `iff` only if the sentence does
			// not already spell it. Matching `(.+?) if (.+)` against the whole
			// sentence never fires on `+ Head iff Body` -- " iff " does not contain
			// " if " (the character after `if` is `f`, not a space) -- so the marker
			// stayed in the text, the head was looked up as "+ Head", no fact type
			// answered to that, and the rule was dropped without a word. 29 rules in
			// 4 files, including auto.dev's `+ Customer has granted Trial iff ...`,
			// which reported as an undeclared head three files from the cause.
			// STRIP THE WHOLE LEADING RUN OF MARKERS, not one. The filter that drops a
			// bare marker applies to the TAIL of a chunk only, so a declaration's
			// trailing marker is joined onto the rule that follows it:
			//     Customer has granted Trial. +
			//     + Customer has granted Trial if some Plan Change grants ...
			// arrives as `+ + Customer has granted Trial if ...`. Stripping one marker
			// left the other in the head, the head was looked up as "+ Customer has
			// granted Trial", nothing answered to that, and a rule whose head IS
			// declared two lines above reported as naming no declared fact type.
			// The corpus contains no doubled marker, so a run of two can only be this.
			Match mk = Regex.Match(s, @"^(?:[*+]{1,2}\s+)+(.+)$");
			if (!mk.Success) return s;
			string body = mk.Groups[1].Value;
			if (body.Contains(" iff ")) return "* " + body;
			Match m = Regex.Match(body, @"^(.+?) if (.+)$");
			return m.Success ? "* " + m.Groups[1].Value + " iff " + m.Groups[2].Value : s;
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
		// ONE SPLIT, USED BY THE ARM AND THE CENSUS. They had a copy each and drifted
		// twice already; a census that splits differently from the builder reports a
		// missing fact type for a clause the builder never saw.
		//
		// A CLAUSE MAY ALSO BEGIN WITH THE LITERAL OPENING WORD OF A DECLARED READING.
		// `auto.dev relies on GDPR Lawful Basis for Meter Endpoint` opens with a word
		// that is neither `that`, `some`, nor capitalised, so the body never split before
		// it and two clauses arrived glued together -- reported as one enormous missing
		// fact type, which is exactly the shape of a reading nobody can name.
		private string[] SplitBody(string body)
		{
			if (mySplitRe == null)
			{
				var leads = new SortedSet<string>(StringComparer.Ordinal);
				foreach (FactIndexEntry e in myFactIndex)
				{
					if (e.ReadingText == null || e.ReadingText.Length == 0) continue;
					string first = e.ReadingText.Split(' ')[0];
					if (first.Length == 0 || first[0] == '{' || char.IsUpper(first[0])) continue;
					if (first == "that" || first == "some" || first == "a" || first == "an" || first == "the") continue;
					leads.Add(Regex.Escape(first) + " ");
				}
				string alt = leads.Count == 0 ? "" : string.Join("|", leads) + "|";
				mySplitRe = new Regex(@" and (?=that |some |[A-Z]|" + alt
					+ @"[A-Za-z][\w-]*(?: [\w-]+){0,3} equals |[a-z][\w-]*(?: [\w-]+){0,3} is )");
			}
			return mySplitRe.Split(body);
		}
		private Regex mySplitRe;

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
					// A SUBSCRIPT NAMES THE VARIABLE, NOT THE TYPE. `Status1` is a Status, and
					// refusing the match because a digit follows left every subscripted clause
					// naming no fact type at all. Consume the digits with the name -- they must
					// be blanked too, or they survive into the reading words and match nothing.
					int digitEnd = end;
					while (digitEnd < working.Length && char.IsDigit(working[digitEnd])) digitEnd++;
					bool rightOk = digitEnd >= working.Length || !char.IsLetterOrDigit(working[digitEnd]);
					if (leftOk && rightOk)
					{
						hits.Add(new KeyValuePair<int, string>(at, name));
						working = working.Substring(0, at) + new string((char)1, digitEnd - at) + working.Substring(digitEnd);
						at = digitEnd;
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
				// THE SAME WORDS HAVE TO BE REMOVED FROM BOTH SIDES. The clause has its
				// articles stripped just above; the entry's reading words did not, so a
				// declared reading CONTAINING an article could never be matched by any
				// clause. `Effective Date is in the past` is one -- rename it to
				// `Effective Date has passed` and the identical rule builds -- and so is
				// every reading that says "the", "a" or "an" anywhere in it.
				if (string.Equals(NormalizeWords(Regex.Replace(entry.ReadingWords, @"\b(some|that|a|an|the)\b", " ")), wordsKey, StringComparison.Ordinal))
				{
					playersOut = players;
					return entry;
				}
			}
			return null;
		}

		// THE JOIN PATH, KEPT. state:setcmp emitted two flat lists of <fact type,
		// role position> and dropped the path saying how they join, so canon got a
		// constraint it could not evaluate: cmd:sc_leg skips any leg with more than
		// one role, which is 8 of the 9 constraints and 12 of the 18 legs. The
		// oracle HAS the path -- it builds ConstraintRoleSequenceJoinPath with
		// roots, sub-paths and projections -- and both builders below already know,
		// per clause, which role is the join and which is projected. Recorded at
		// construction rather than navigated back out of NORMA's graph afterwards.
		private readonly Dictionary<ConstraintRoleSequence, List<string>> myLegPath =
			new Dictionary<ConstraintRoleSequence, List<string>>();

		private void RecordPathStep(ConstraintRoleSequence seq, string ft, int joinPos, int projPos)
		{
			List<string> steps;
			if (!myLegPath.TryGetValue(seq, out steps)) { steps = new List<string>(); myLegPath[seq] = steps; }
			steps.Add("S3(" + IAtom(ft) + ", N(" + joinPos + "), N(" + projPos + "))");
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
				RecordPathStep(seq, cl.Entry.Fact.Name, eAt + 1, nAt + 1);
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
					RecordPathStep(seq, side[c].Entry.Fact.Name, joinAt + 1, loc.Value + 1);
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
			// the exhaustion half of GroupExclusiveOr: every supertype instance
			// plays one of the subtype roles. NORMA models it as a disjunctive
			// mandatory over the SUPERTYPE meta roles — the same roles the
			// exclusion below spans, which is the only surface it admits
			// external constraints on.
			if (kind == "subtype-totality")
			{
				Match tm = ExclusiveSubtypes.Match(body + ".");
				if (tm.Success)
				{
					string parent = tm.Groups[2].Value.Trim();
					var roles = new List<Role>();
					foreach (string part in tm.Groups[1].Value.Split(','))
					{
						string child = part.Trim();
						if (child.Length == 0) continue;
						foreach (SubtypeFact sf in myStore.ElementDirectory.FindElements<SubtypeFact>(true))
						{
							if (!sf.IsDeleted && sf.Subtype != null && sf.Supertype != null &&
								sf.Subtype.Name == child && sf.Supertype.Name == parent)
							{
								roles.Add(sf.SupertypeRole.Role);
								break;
							}
						}
					}
					if (roles.Count >= 2)
					{
						MandatoryConstraint mc = new MandatoryConstraint(myStore);
						mc.Model = myModel;
						foreach (Role r in roles) mc.RoleCollection.Add(r);
						mc.Modality = modality;
						Count("disjunctive mandatory constraint (subtype totality)");
						return true;
					}
				}
				AddNote(kind, s, "subtype facts not found");
				return false;
			}
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
		// Atoms are emitted into a JS source file, so the two characters that can
		// close or corrupt the literal must be escaped. This used to throw on a
		// double quote, which made a legitimate model unrepresentable: us-law's
		// statutory Descriptions quote the statutes they cite (FTC Negative Option
		// Rule, 16 CFR 425, effective 2024 - "click to cancel").
		// PROVABLY A NO-OP FOR EXISTING CARRIERS: measured across auto.dev, family
		// and base, zero atoms contain a backslash, and none can contain a quote
		// because that used to throw. So no shipped byte moves; the escape only
		// admits text that previously could not be emitted at all.
		private static string IAtom(string s)
		{
			return "A(\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\")";
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
		// The shrink guard below was not enough, and the second incident proves the
		// invariant was the wrong one. On 2026-07-28 this station's carriers were
		// overwritten with the support.auto.dev app model: 558,488 -> 1,077,078 bytes,
		// a 1.93x GROWTH, so nothing about a size ratio could have caught it, and base
		// spent hours judging a different program while looking merely "regenerated".
		// Size is not identity. Record WHICH SOURCE produced a carrier, in a sidecar
		// beside it, and refuse to overwrite a carrier that came from a different one.
		// A missing sidecar is not an error - carriers predating this check simply get
		// one on their next legitimate write.
		public static string CarrierSourceId;

		private static void WriteCarrier(string path, string content)
		{
			string full = System.IO.Path.GetFullPath(path);
			string stamp = full + ".source";
			long had = System.IO.File.Exists(full) ? new System.IO.FileInfo(full).Length : 0L;
			long now = System.Text.Encoding.UTF8.GetByteCount(content);
			Console.WriteLine("  writing " + full + "  (" + had + " -> " + now + " bytes)");
			bool allow = !string.IsNullOrEmpty(
				Environment.GetEnvironmentVariable("AREST_ORACLE_ALLOW_SHRINK"));
			if (had > 0 && !string.IsNullOrEmpty(CarrierSourceId) && System.IO.File.Exists(stamp))
			{
				string prev = System.IO.File.ReadAllText(stamp).Trim();
				if (!string.Equals(prev, CarrierSourceId, StringComparison.OrdinalIgnoreCase) && !allow)
				{
					throw new InvalidOperationException(
						"refusing to overwrite " + full + ": it was generated from " + prev +
						" but this run read " + CarrierSourceId + ". The carrier paths are" +
						" relative, so a run started in the wrong directory lands one" +
						" station's model on another's certified inputs. Set" +
						" AREST_ORACLE_ALLOW_SHRINK=1 only if the repoint is intended.");
				}
			}
			if (had > 0 && now * 4 < had && !allow)
			{
				throw new InvalidOperationException(
					"refusing to shrink " + full + " from " + had + " to " + now +
					" bytes. This usually means the working directory is a station whose" +
					" sources are not the ones being read. Set AREST_ORACLE_ALLOW_SHRINK=1" +
					" if the collapse is intended.");
			}
			System.IO.File.WriteAllText(full, content);
			if (!string.IsNullOrEmpty(CarrierSourceId))
			{
				System.IO.File.WriteAllText(stamp, CarrierSourceId);
			}
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
			// OBJECT KIND IS STRUCTURAL, so it is synthesized here rather than
			// asserted in the readings. Sam: "the object type matters on schema
			// generation, but once the columns are known, whether a column is a
			// value or reference type is determined by whether it's an id
			// column." The distinction is already complete and already consumed:
			// state:otmeta carries <object type, 'entity'|'value', independent>
			// for every one, and rmap:vtnames reads it by filtering N(2) ==
			// "value". The string ObjectKind appears NOWHERE in canon, so
			// ObjectTypeIsOfObjectKind was a second home for information nothing
			// was reading -- declared, mandatory, and empty, which is how
			// `Each Object Type is of exactly one Object Kind` came to be
			// unsatisfiable by construction.
			//
			// WRITING 147 ROWS INTO THE READINGS WOULD BE THE WRONG FIX: it puts
			// one ruling in 147 places and lets them drift. This is the
			// FactTypeHasDeclarationOrder pattern above, for the same reason and
			// with the same discipline -- source order fills it, an explicit
			// instance row SETS it and wins.
			//
			// UNATTRIBUTED (RowKinds ""), exactly as fthdo is. Attributing these
			// would grow the Object Type population from 4 to 147 and hand
			// `Each Object Type has exactly one World Assumption` 147 violations
			// instead of 4, for one unresolved reason -- and that ruling's
			// derivation does not run yet. The under-count in state:otpops is
			// real and separate; it is a question about what an otpop MEANS
			// (instances appearing in facts, or every declared type), not about
			// this fact type.
			{
				FactIndexEntry kindEntry = null;
				foreach (FactIndexEntry e in myFactIndex)
					if (!e.Fact.IsDeleted && e.Fact.Name == "ObjectTypeIsOfObjectKind") { kindEntry = e; break; }
				if (kindEntry != null)
				{
					var have = new HashSet<string>(StringComparer.Ordinal);
					foreach (var row in kindEntry.Rows) if (row.Count == 2) have.Add(row[0]);
					foreach (ObjectType ot in myModel.ObjectTypeCollection)
					{
						if (ot.IsDeleted || string.IsNullOrEmpty(ot.Name)) continue;
						if (have.Contains(ot.Name)) continue;
						kindEntry.Rows.Add(new List<string> { ot.Name, ot.IsValueType ? "value" : "entity" });
						kindEntry.RowKinds.Add(new List<string> { "", "" });
						have.Add(ot.Name);
					}
				}
			}
			// AND THE DECLARED DATA TYPE LANDS IN ITS OWN FACT TYPE. Same shape as
			// the Object Kind synthesis above and for the same reason: parsed
			// already, applied to the NORMA model already, and dropped on the way
			// out. An explicit row in the readings SETS it and wins; this fills
			// only what the declarations said.
			{
				FactIndexEntry cdtEntry = null;
				foreach (FactIndexEntry e in myFactIndex)
					if (!e.Fact.IsDeleted && e.Fact.Name == "ObjectTypeHasConceptualDataType") { cdtEntry = e; break; }
				if (cdtEntry != null)
				{
					var haveCdt = new HashSet<string>(StringComparer.Ordinal);
					foreach (var row in cdtEntry.Rows) if (row.Count == 2) haveCdt.Add(row[0]);
					foreach (var kv in myDeclaredDataType)
					{
						if (haveCdt.Contains(kv.Key)) continue;
						cdtEntry.Rows.Add(new List<string> { kv.Key, kv.Value });
						cdtEntry.RowKinds.Add(new List<string> { "", "" });
						haveCdt.Add(kv.Key);
					}
				}
			}
			// AND THE INSTANCE-OF PAIRING IS ALREADY COMPUTED TOO. The walk below
			// that materializes state:otpops reads exactly this: for every row of
			// every fact type, RowKinds[r][i] names the object type of
			// Rows[r][i], and the loop climbs SupertypeCollection adding the
			// value to each supertype's population. That climb IS
			// `Object Type Instance is instance of Object Type`, and the fact
			// type sat at 0 rows beside it.
			//
			// UP THE CHAIN, NOT JUST THE DIRECT TYPE, and the model says so
			// outright. instances.md declares "Each Object Type Instance,
			// Object Type combination occurs at most once" plus "is instance of
			// SOME Object Type" -- not exactly one -- and the note records the
			// 2026-07-09 ruling: "'exactly one Noun' was NON-CANONICAL
			// (challenged, verified against Halpin, Subtyping Revisited, NORMA):
			// in ORM subtyping is population inclusion." An instance of a
			// subtype IS an instance of its supertypes, so the emitted pairing
			// has to agree with the inclusion otpops already materializes.
			//
			// Unattributed, and explicit rows win, as above.
			{
				FactIndexEntry instEntry = null;
				foreach (FactIndexEntry e in myFactIndex)
					if (!e.Fact.IsDeleted && e.Fact.Name == "ObjectTypeInstanceIsInstanceOfObjectType") { instEntry = e; break; }
				if (instEntry != null)
				{
					var have = new HashSet<string>(StringComparer.Ordinal);
					foreach (var row in instEntry.Rows)
						if (row.Count == 2) have.Add(row[0] + "" + row[1]);
					foreach (FactIndexEntry e in myFactIndex)
					{
						if (e.Fact.IsDeleted) continue;
						for (int r = 0; r < e.Rows.Count && r < e.RowKinds.Count; r++)
						{
							for (int i = 0; i < e.Rows[r].Count && i < e.RowKinds[r].Count; i++)
							{
								string kind = e.RowKinds[r][i];
								if (string.IsNullOrEmpty(kind)) continue;
								string val = e.Rows[r][i];
								ObjectType t;
								myTypes.TryGetValue(kind, out t);
								while (true)
								{
									string key = val + "" + kind;
									if (!have.Contains(key))
									{
										instEntry.Rows.Add(new List<string> { val, kind });
										instEntry.RowKinds.Add(new List<string> { "", "" });
										have.Add(key);
									}
									if (t == null) break;
									ObjectType super = null;
									foreach (ObjectType sup in t.SupertypeCollection) { super = sup; break; }
									if (super == null) break;
									kind = super.Name;
									t = super;
								}
							}
						}
					}
				}
			}
			// AND EVERY INSTANCE'S REFERENCE, from the same walk. Sam, on what
			// this fact type means: "Object Type Instance has Reference is the
			// instance of an object type having a reference scheme. It may be a
			// flat id, or a complex external uniqueness constraint."
			//
			// So the mandatory is RIGHT -- every instance is identified somehow,
			// that is what a reference scheme is -- and the 21 violations were
			// missing DATA, not an over-strong constraint. I had it backwards
			// twice: first repeating this file's own "runtime address" (a phrase
			// that occurs exactly once in the repo, in the comment that coined
			// it, with no definition and no reader), then proposing to relax
			// `exactly one` to `at most one`. Both wrong.
			//
			// The oracle builds no NORMA sample-population objects at all --
			// EntityTypeInstance appears nowhere in this file -- so there is no
			// reference scheme to ask NORMA for. What it does have is the
			// identifying TEXT: every value in a parsed instance-fact row is
			// exactly the reference the instance is written by. For a flat id
			// that text IS the reference, which is every instance in this model.
			//
			// THE ROWS LOOK DEGENERATE and that is a representation artifact,
			// not a modelling one: the carrier already keys instances by their
			// reference, so <'Proposed', 'Proposed'> reads as a tautology when
			// it is the natural key stated once. A compound scheme would emit a
			// composite here; none exists in this model, because a parsed row
			// value is a single text by construction.
			{
				FactIndexEntry refEntry = null;
				foreach (FactIndexEntry e in myFactIndex)
					if (!e.Fact.IsDeleted && e.Fact.Name == "ObjectTypeInstanceHasReference") { refEntry = e; break; }
				if (refEntry != null)
				{
					var have = new HashSet<string>(StringComparer.Ordinal);
					foreach (var row in refEntry.Rows) if (row.Count == 2) have.Add(row[0]);
					foreach (FactIndexEntry e in myFactIndex)
					{
						if (e.Fact.IsDeleted) continue;
						for (int r = 0; r < e.Rows.Count && r < e.RowKinds.Count; r++)
						{
							for (int i = 0; i < e.Rows[r].Count && i < e.RowKinds[r].Count; i++)
							{
								if (string.IsNullOrEmpty(e.RowKinds[r][i])) continue;
								string val = e.Rows[r][i];
								if (have.Contains(val)) continue;
								refEntry.Rows.Add(new List<string> { val, val });
								refEntry.RowKinds.Add(new List<string> { "", "" });
								have.Add(val);
							}
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
				// THE MANDATORY SLOT WAS THE LITERAL "PHI()". Uniqueness above is
				// computed and the slot beside it was typed in, so 0 of 246
				// descriptors carried a mandatory and cmd:validate had nothing but
				// uniqueness to check. That is why the deontic path was
				// unreachable, and it had nothing to do with deontics: ALETHIC
				// mandatories were being dropped too. AREST.tex:137 lists mandatory
				// in C_S beside uniqueness, each alethic or deontic; both belong in
				// the descriptor, and dropping one is not a scope decision.
				//
				// EXPLICIT ONLY. NORMA IMPLIES a mandatory from a preferred
				// identifier, which is a consequence of the reference scheme rather
				// than a constraint a modeller declared; emitting those would make
				// validate report violations nobody wrote. This file already draws
				// that line at the mapinputs walk ("implied" vs "explicit"), and
				// this is the same line.
				//
				// ALETHIC ONLY HERE, and that is not the deontic filter repeated:
				// this slot feeds the arm that REFUSES a commit (Thm 1: D' carries
				// P'' iff V has no alethic violation), so a deontic mandatory in it
				// would enforce a violable rule as a hard one. Deontics need their
				// own surface carrying modality, which is the next step, not this
				// one.
				var mands = new List<string>();
				for (int i = 0; i < entry.Roles.Count; i++)
				{
					Role role = entry.Roles[i];
					if (role == null) continue;
					foreach (ConstraintRoleSequence seq in role.ConstraintRoleSequenceCollection)
					{
						MandatoryConstraint mc = seq as MandatoryConstraint;
						if (mc == null || mc.IsDeleted || mc.IsImplied) continue;
						if (mc.Modality != ConstraintModality.Alethic) continue;
						if (mc.RoleCollection.Count != 1) continue;
						mands.Add("N(" + (i + 1) + ")");
						break;
					}
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
				fts.Add("S5(" + name + ", " + ISeq(tops) + ", " + (ucs.Count == 0 ? "PHI()" : ISeq(ucs)) + ", " + ISeq(mands) + ", " + IChunked(rows) + ")");
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
			sb.Append("\"THE DESIGN STATE in INTERSECTION SOURCE (generated by norma-oracle; regenerate, never edit). state:fts — one S5 descriptor per parsed fact type: name, players (top-collapsed), ucs (1-based positions), mands (1-based positions of roles carrying an EXPLICIT ALETHIC simple mandatory -- implied ones follow from the reference scheme rather than a declaration, and a deontic one belongs on its own modality-carrying surface, since this slot feeds the arm that REFUSES a commit), pop (attributed instance rows). state:declared pairs each name with its declared players; state:nestings pairs objectified fact names with their nesting types; state:otpops the per-kind entity populations, inclusion materialized up the subtype chain; state:derived pairs each derivation-marked name with its mode (full/stored/semi/subtype) — the marker surface the closure law reads against rules:metamodel; state:exclusions holds one scope-list per exclusion constraint (population name + 1-based positions; a subtype-meta scope names the child extent). state:rules — every NORMA-built app derivation rule as (name, recipe) in the rules:metamodel grammar (join/proj), the executable surface the canon closure runs beside rules:metamodel. Chunk convention: state:fts, each pop, each otpop, and state:declared/state:nestings/state:derived/state:rules are chunked — consumers flatten exactly one level; descriptors, rows, and uc spans are direct.\",\n\n");
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
			// SUBSET AND EQUALITY CONSTRAINTS, BUILT AND NEVER EMITTED. The oracle
			// builds nine subsets -- 6 join-path, 2 direct, 1 negated-unary
			// impossibility -- and every one stopped here. There was no
			// state:subsets, no state:equalities, and no other cell carrying a
			// SetComparisonConstraint except the exclusions above.
			//
			// Sam: "AREST should execute the derivation by filling in empty legs
			// of equality and subset constraints." That is what these rows are
			// for. CHECKED, a subset refuses when its sub leg is not contained in
			// its super leg. EXECUTED, an empty super leg is DERIVED from the sub
			// leg -- the constraint produces instead of only refusing, which is
			// how a declarative statement about populations becomes a derivation
			// without any new recipe form.
			//
			// THE ORDER OF THE SEQUENCES IS THE CONTENT, which is why this cannot
			// reuse the exclusion shape above. An exclusion's scopes are
			// unordered: any two of them exclude each other. A subset is
			// DIRECTIONAL -- sequence 0 is contained in sequence 1 -- and getting
			// that backwards would fill the wrong leg. Equality is symmetric and
			// still carries both sides, so one shape serves both and the kind
			// says how to read it.
			var setcmp = new List<string>();
			foreach (SetComparisonConstraint scc in myStore.ElementDirectory.FindElements<SetComparisonConstraint>(true))
			{
				if (scc.IsDeleted) continue;
				string kind = scc is SubsetConstraint ? "subset"
					: scc is EqualityConstraint ? "equality" : null;
				if (kind == null) continue;
				var legs = new List<string>();
				var paths = new List<string>();
				bool ok = true;
				foreach (SetComparisonConstraintRoleSequence seq in scc.RoleSequenceCollection)
				{
					var members = new List<string>();
					foreach (Role r in seq.RoleCollection)
					{
						FactType mft = r.BinarizedOrSameFactType;
						if (mft == null) { ok = false; break; }
						int pos = 0;
						for (int i = 0; i < mft.RoleCollection.Count; i++)
							if (mft.RoleCollection[i].Role == r) { pos = i + 1; break; }
						if (pos == 0) { ok = false; break; }
						members.Add("S2(" + IAtom(mft.Name) + ", N(" + pos + "))");
					}
					if (!ok || members.Count == 0) { ok = false; break; }
					legs.Add(IMemberSeq(members));
					List<string> pathSteps;
					paths.Add(myLegPath.TryGetValue(seq, out pathSteps) && pathSteps.Count > 0
						? IMemberSeq(pathSteps) : "PHI()");
				}
				if (!ok || legs.Count != 2) continue;
				setcmp.Add("S5(" + IAtom(kind) + ", " + IAtom(scc.Modality == ConstraintModality.Deontic ? "deontic" : "alethic")
					+ ", " + legs[0] + ", " + legs[1] + ", " + IMemberSeq(paths) + ")");
			}
			setcmp.Sort(StringComparer.Ordinal);
			sb.Append("DEF(\"state:setcmp\", ").Append(setcmp.Count == 0 ? "S1(PHI())" : IChunked(setcmp)).Append("),\n\n");
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
			// ++ IS NOT **. Def 5: "completeness and storage are orthogonal, giving the
			// four markings *, **, +, and ++". The parser already gets this right (`++`
			// adds to BOTH mySemiDerived and myStoredDerived), but this branch tested
			// storage first and unconditionally said FullyDerived, so ++ collapsed into
			// ** and only three of the four markings existed.
			//
			// The difference is load-bearing, not cosmetic. ++ is SEMI-derived and
			// STORED: a rule seeds it, assertions add to it, and it is materialised --
			// which is exactly what a current-status column is. Collapsing it to ** makes
			// the derived rows the ONLY rows, so an asserted status would be erased by the
			// next derivation. ** is also EXTERNAL (no in-store body by design, hence zero
			// paths); ++ HAS a body, so it must not carry that flag.
			if (myStoredDerived.Contains(fact) && mySemiDerived.Contains(fact))
			{
				rule.DerivationCompleteness = DerivationCompleteness.PartiallyDerived;
				rule.DerivationStorage = DerivationStorage.Stored;
			}
			else if (myStoredDerived.Contains(fact))
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
			if (myStoredDerived.Contains(fact) && mySemiDerived.Contains(fact)) return "semiderived, STORED";
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
					// Ninth field: is this role's player identified by a generator?
					// The permuter refuses to GENERATE a deep mapping away from such
					// an entity (OialModelIsForORMModel.cs:638-646), and it asks the
					// question about the role player at the moment it considers the
					// mapping. The row is what canon's candidate builder is mapped
					// over, so carrying the flag HERE puts it in scope by
					// construction; fetching a store-wide surface from inside that
					// scope cannot work, because the argument there is one row.
					roleInfos.Add("S9(" + IAtom(p.Name) + ", " + IAtom(p.IsValueType ? "value" : "entity")
						+ ", " + IAtom(suc != null ? "T" : "F")
						+ ", " + IAtom(suc != null && suc.IsPreferred ? "T" : "F")
						+ ", " + IAtom(mand)
						+ ", " + IAtom(identifiesOpp ? "T" : "F")
						+ ", " + IAtom(inOwnPid ? "T" : "F")
						+ ", " + IAtom(HyphenPrefixFor(ft, r))
						+ ", " + IAtom(EntityIsAutoIdentified(p) ? "T" : "F") + ")");
				}
				while (roleInfos.Count < 2) roleInfos.Add("PHI()");
				var dr = ft.DerivationRule as FactTypeDerivationRule;
				// A SUBTYPE fact carries no derivation rule of its own. NORMA hangs a
				// SubtypeDerivationRule off the subtype OBJECT TYPE
				// (ObjectType.DerivationRule, DomainClasses.cs:6114), so reading only
				// ft.DerivationRule reported none/none for every derived subtype.
				// MEASURED, not inferred: with the subtype arm on and off, this row's
				// facttypeFlags were byte-identical, slots 4/5 both 'none'. Canon's
				// rmap:gate already implements NORMA's predicate
				// (FullyDerived && (!External || NotStored), AssimilationMapping.cs:210)
				// and simply was never told the subtype was derived.
				//
				// REPORTED, NOT DECIDED — same discipline as fields 8 and 9 below: the
				// completeness and storage are handed over as facts and canon composes
				// the exclusion itself. Deciding absorption here would leave NORMA's
				// rule behind in C#.
				var subFact = ft as SubtypeFact;
				SubtypeDerivationRule sdr = subFact != null ? subFact.Subtype.DerivationRule : null;
				string dcomp = dr != null
					? (dr.DerivationCompleteness == DerivationCompleteness.PartiallyDerived ? "partial" : "full")
					: sdr != null
						? (sdr.DerivationCompleteness == DerivationCompleteness.PartiallyDerived ? "partial" : "full")
						: "none";
				string dstore = dr != null
					? (dr.DerivationStorage == DerivationStorage.Stored ? "stored" : "notstored")
					: sdr != null
						? (sdr.DerivationStorage == DerivationStorage.Stored ? "stored" : "notstored")
						: "none";
				// Fields 8 and 9 are the two facts the subtype depth formula needs
				// (OialModelIsForORMModel.cs:364). They are reported rather than
				// decided: canon composes the disjunction itself, because a single
				// precomputed "this subtype is absorbed" flag would be NORMA's
				// answer with its rule left behind in C#.
				//
				// Both are read through SubtypeFact's own accessors, and that is
				// the point of resolving them here. Role order is NOT an invariant
				// -- SubtypeFact.SupertypeRole tries roles[1] then falls back,
				// noting "this is not guaranteed (the user can switch them in the
				// xml)" -- so which of roleInfos[0]/[1] holds the subtype cannot be
				// assumed positionally, and canon must not have to guess.
				SubtypeFact sf = ft as SubtypeFact;
				bool providesPid = sf != null && sf.ProvidesPreferredIdentifier;
				bool subAuto = sf != null && EntityIsAutoIdentified(sf.Subtype);
				rows.Add("S4(" + IAtom(ft.Name) + ", " + roleInfos[0] + ", " + roleInfos[1]
					+ ", S9(" + IAtom(isSubtype ? "T" : "F") + ", " + IAtom(isUnary ? "T" : "F")
					+ ", " + IAtom(ft.ImpliedByObjectification != null ? "T" : "F")
					+ ", " + IAtom(dcomp) + ", " + IAtom(dstore)
					+ ", " + IAtom(dr != null && dr.ExternalDerivation ? "T" : "F")
					+ ", " + IAtom(ft.Objectification != null ? "T" : "F")
					+ ", " + IAtom(providesPid ? "T" : "F")
					+ ", " + IAtom(subAuto ? "T" : "F") + "))");
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
			// THE DEONTIC CONSTRAINT SURFACE. Every emitter above filters
			// `Modality != ConstraintModality.Alethic` and drops what it finds,
			// and BuildRing assigns rc.Modality one line before writing a row
			// that has no room for it. So the readings state 38 deontic
			// sentences, NORMA builds the ones whose shape a builder matches,
			// stamps each with Deontic -- BuildTextual's own comment says "every
			// builder stamps it" -- and every one is discarded at this boundary.
			//
			// AREST.tex:137 puts modality in the DEFINITION of C_S: each
			// constraint "alethic or deontic". :189 gives the difference in one
			// sentence -- an alethic c rejects the commit, a deontic c warns and
			// commits -- and Thm 1 is written on it, since D' carries P'' iff V
			// has no ALETHIC violation, a condition that says nothing unless
			// deontic violations are in V. A deontic constraint dropped here
			// cannot warn, so every obligation the readings state was
			// unenforceable by construction.
			//
			// A SEPARATE CELL, NOT A COLUMN ON state:ucs / state:djmands. Those
			// feed consumers that treat their rows as hard constraints; merging
			// deontics in would enforce a violable rule as an alethic one, which
			// is exactly backwards. Membership in THIS cell is the modality, so
			// nothing downstream carries a flag it might forget to read.
			//
			// The kind recorded is the SHAPE to check, not the modality:
			// ConstraintTypeHasConstraintTypeFamily maps all six deontic
			// constraint types (DF_pop, DF_cwa, DF_owa, DO_pop, DO_obl,
			// DO_sender) to family 'deontic', which is the tag a violation
			// carries and the tag main:create_outcome branches on.
			var deoRows = new List<string>();
			var deoKeyed = new List<KeyValuePair<string, string>>();
			foreach (SetConstraint sc in myStore.ElementDirectory.FindElements<SetConstraint>(true))
			{
				if (sc.IsDeleted || sc.Modality != ConstraintModality.Deontic) continue;
				string kind = sc is MandatoryConstraint ? "mandatory"
					: sc is UniquenessConstraint ? "uniqueness" : null;
				if (kind == null) continue;
				var members = new List<string>();
				bool ok = true;
				foreach (Role mr in sc.RoleCollection)
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
				deoKeyed.Add(new KeyValuePair<string, string>(
					CanonicalConstraintKey("DEO", kind.Substring(0, 1),
						MemberKeyParts(sc.RoleCollection)),
					", " + IAtom(kind) + ", " + IMemberSeq(members) + ")"));
			}
			foreach (var kv in DisambiguateKeys(deoKeyed))
				deoRows.Add("S3(" + IAtom(kv.Key) + kv.Value);
			deoRows.Sort(StringComparer.Ordinal);
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
			// WITHIN-GROUP ORDER IS NORMA'S RULE, NOT A TIDY SORT OF MINE.
			// Objectification.cs:409-423 builds the implied set by walking the nested
			// fact type's RoleCollection BY INDEX ("Add implied fact types, one for
			// each role"), and :1279 links each implied fact back to its nested role
			// via `nearRoleProxy.TargetRole = nestedRole`. So a member's canonical
			// position is that role's index in the nested fact type.
			// CORRECTION TO THE NOTE ABOVE (measured, cont 468): the claim that each
			// group's internal sequence is preserved across processes is FALSE. The
			// internal order tracks the SLOT, not the group -
			//   CustomerHasPaymentMethod is (PaymentMethod, Customer) in one process
			//                            and (Customer, PaymentMethod) in the next.
			// Since canon READS this order through cn:foidx to number uniqueness
			// constraints, that flap is the dangerous kind, not the inert
			// between-group kind. Pinning it to NORMA's creation order fixes it at
			// the source rather than correlating with whichever order showed up.
			Func<FactType, int> memberIndex = delegate(FactType ft)
			{
				Objectification o = ft.ImpliedByObjectification;
				if (o == null) return -1;
				FactType nested = o.NestedFactType;
				if (nested == null) return -1;
				LinkedElementCollection<RoleBase> nestedRoles = nested.RoleCollection;
				foreach (RoleBase rb in ft.RoleCollection)
				{
					RoleProxy proxy = rb as RoleProxy;
					if (proxy != null && proxy.TargetRole != null)
					{
						return nestedRoles.IndexOf(proxy.TargetRole);
					}
				}
				return -1;
			};
			// GLOBAL, not per-run. The per-run version this replaces could not fix
			// the residual flap cont 469 measured (2 distinct design-states in 10
			// runs, the differing rows 520 positions apart): 51 of the 66 implied
			// runs hold exactly ONE group, so sorting inside a run is a no-op there,
			// and two groups landing in DIFFERENT runs can never be ordered against
			// each other. So collect every implied slot, sort the occupants globally
			// by (group, member), and lay them back into those same slots. Slots are
			// stable across processes - measured, run boundaries identical - so only
			// the occupancy needed pinning.
			//
			// A GROUP MAY NOW STRADDLE A RUN BOUNDARY, and that is safe - read from
			// canon, not assumed. cn:foidx (arest:9246) is nothing but
			// `law:fetch state:factorder` flattened to a list of S2(name, index)
			// rows, and every consumer reaches it through cn:posin (position lookup)
			// or cn:minint (minimum over a group) at arest:9304 and :9310. Position,
			// never adjacency. Non-consecutive members of one group therefore change
			// no name canon derives: laying groups in sorted order keeps min(A) <
			// min(B) whenever A sorts before B, which is all cn:minint reads.
			var foSlots = new List<int>();
			for (int i = 0; i < foFacts.Count; i++)
			{
				if (groupKey(foFacts[i]) != null) foSlots.Add(i);
			}
			var foOccupants = foSlots.Select(s => foFacts[s])
				.OrderBy(groupKey, StringComparer.Ordinal)
				.ThenBy(memberIndex).ToList();
			for (int k = 0; k < foSlots.Count; k++) foFacts[foSlots[k]] = foOccupants[k];
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
			sb.Append("DEF(\"state:deontics\", ").Append(deoRows.Count == 0 ? "S1(PHI())" : IChunked(deoRows)).Append("),\n\n");
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
				bool auto = EntityIsAutoIdentified(ot);
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
