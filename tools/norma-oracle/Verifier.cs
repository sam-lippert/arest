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
		private sealed class FactIndexEntry
		{
			public FactType Fact;
			public List<Role> Roles;
			public List<string> Players;
			public string ReadingWords;
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
				if (c == '\'') { inQuote = !inQuote; }
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
		private static readonly Regex EntityDeclBare = new Regex(@"^([\w :]+?)\s+is an entity type\.$");
		private static readonly Regex ValueDecl = new Regex(@"^([\w :]+?)\s+is a value type\.$");

		public void SeedObjectifications()
		{
			// objectifications are declared only in section headers; the
			// readings that follow use them as ordinary players
			EnsureType("API", false);
			EnsureType("Constraint Span", false);
		}

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
				if ((m = EntityDecl.Match(s)).Success)
				{
					ObjectType t = EnsureType(m.Groups[1].Value.Trim(), false);
					if (t.ReferenceModeString.Length == 0)
					{
						t.ReferenceModeString = m.Groups[2].Value.Trim();
					}
					Count("entity-type declaration");
				}
				else if ((m = EntityDeclBare.Match(s)).Success)
				{
					EnsureType(m.Groups[1].Value.Trim(), false);
					Count("entity-type declaration");
				}
				else if ((m = ValueDecl.Match(s)).Success)
				{
					string vName = m.Groups[1].Value.Trim();
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
							vt.IsValueType = true;
						}
					}
					EnsureDataType(vt, "text");
					Count("value-type declaration");
				}
			}
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
				}
				myTypes[name] = t;
			}
			return t;
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
			if (s.Contains(" iff "))
			{
				Count("derivation rule (deferred: no textual rule input in NORMA)");
				return;
			}
			// derivation-mode markers (* / ** / +) trailing a reading start the
			// next split sentence; strip them before dispatch
			s = System.Text.RegularExpressions.Regex.Replace(s, @"^[*+]+\s+", "");
			if (s.Contains(" or some ") || s.Contains(" or that ") || s.Contains(" or is "))
			{
				Count("disjunctive constraint (deferred)");
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
				Count("subtype exclusivity (subtypes mapped; exclusion constraint deferred)");
				return;
			}
			if ((m = PossibleValues.Match(s)).Success)
			{
				MapValueEnum(m.Groups[1].Value.Trim(), m.Groups[2].Value);
				return;
			}
			if ((m = DataTypeDecl.Match(s)).Success)
			{
				Count("data-type opt-in (default text kept)");
				return;
			}
			if (s.StartsWith("* "))
			{
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
				string body = s.Substring(s.IndexOf("that ") + 5);
				if (body.StartsWith("each ") || body.StartsWith("Each "))
				{
					if (MapConstraint("Each " + body.Substring(5), ConstraintModality.Deontic)) return;
				}
				Count("deontic constraint (deferred)");
				return;
			}
			if (s.StartsWith("It is possible that ") || s.StartsWith("It is impossible that "))
			{
				Count(s.StartsWith("It is possible") ? "default-form reading (no constraint)" : "alethic impossibility (deferred)");
				return;
			}
			if (s.StartsWith("If ") || s.StartsWith("No "))
			{
				Count("subset/ring textual constraint (deferred)");
				return;
			}
			if (s.StartsWith("This association with "))
			{
				Count("objectification / external preferred id (deferred)");
				return;
			}
			if (Regex.IsMatch(s, @"'[^']*'"))
			{
				Count("instance fact (population; out of schema scope)");
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

		private void MapSubtype(string subName, string superName)
		{
			ObjectType sub = EnsureType(subName, false);
			ObjectType super = EnsureType(superName, false);
			foreach (ObjectType existing in sub.SupertypeCollection)
			{
				if (existing == super) { Count("subtype declaration"); return; }
			}
			SubtypeFact.Create(sub, super);
			Count("subtype declaration");
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
				ValueRange range = new ValueRange(myStore);
				range.MinValue = vm.Groups[1].Value;
				range.MaxValue = vm.Groups[1].Value;
				range.ValueConstraint = constraint;
			}
			Count("value enumeration");
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
			myFactIndex.Add(new FactIndexEntry
			{
				Fact = fact,
				Roles = roles,
				Players = players,
				ReadingWords = Regex.Replace(text, @"\{\d\}", " ").Trim(),
			});
			Count("fact-type reading (arity " + players.Count + ")");
			return true;
		}

		private bool MapConstraint(string s, ConstraintModality modality)
		{
			string body = s.TrimEnd('.');
			List<string> players = myLastPlayers;
			List<Role> roles = myLastRoles;
			FactType target = myLastFact;
			// cross-context constraint: if the sentence's leading player is not
			// on the last fact type, retarget to the best fact in the index
			// (leading player present + most reading words shared)
			{
				string probe = body.StartsWith("For each ") ? body.Substring(9) : body.StartsWith("Each ") ? body.Substring(5) : body;
				if (players == null || FindPlayerPrefix(probe, players) < 0)
				{
					FactIndexEntry bestEntry = null;
					int bestScore = -1;
					foreach (FactIndexEntry entry in myFactIndex)
					{
						if (FindPlayerPrefix(probe, entry.Players) < 0) continue;
						int score = 0;
						foreach (string w in entry.ReadingWords.Split(' '))
						{
							if (w.Length > 2 && body.Contains(w)) score++;
						}
						if (score > bestScore)
						{
							bestScore = score;
							bestEntry = entry;
						}
					}
					if (bestEntry != null && bestScore >= 1)
					{
						players = bestEntry.Players;
						roles = bestEntry.Roles;
						target = bestEntry.Fact;
						Count("constraint retargeted by fact index");
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
				UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
				foreach (Role r in span) uc.RoleCollection.Add(r);
				uc.Modality = modality;
				Count("spanning uniqueness");
				return true;
			}

			// "For each pair/combination of A and B, ... at most once" : spanning UC
			m = Regex.Match(body, @"^For each (?:pair|combination) of (.+?),");
			if (m.Success && (body.Contains("at most once") || body.Contains("at most one")))
			{
				var listNames = Regex.Split(m.Groups[1].Value, @"\s+and\s+|,").Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
				var span = RolesFor(listNames, players, roles);
				if (span == null) return false;
				UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
				foreach (Role r in span) uc.RoleCollection.Add(r);
				uc.Modality = modality;
				Count("spanning uniqueness (pair form)");
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
				if (span == null) return false;
				if (span.Count == roles.Count)
				{
					// "For each A and B, that A ... that B at most once" over the whole fact
					UniquenessConstraint ucAll = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
					foreach (Role r in span) ucAll.RoleCollection.Add(r);
					ucAll.Modality = modality;
					Count("spanning uniqueness (for-each all-roles)");
					return true;
				}
				if (quantF == "exactly one" || quantF == "at most one")
				{
					UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
					foreach (Role r in span) uc.RoleCollection.Add(r);
					uc.Modality = modality;
					Count("uniqueness (for-each form)");
				}
				if (quantF == "exactly one" || quantF == "some")
				{
					MandatoryConstraint mc = MandatoryConstraint.CreateSimpleMandatoryConstraint(span[0]);
					mc.Modality = modality;
					Count("mandatory (for-each form)");
				}
				return true;
			}

			// simple forms, player-driven: "Each <player> ... <quantifier> ..."
			if (body.StartsWith("Each "))
			{
				string rest = body.Substring(5);
				int keyIdx = FindPlayerPrefix(rest, players);
				if (Environment.GetEnvironmentVariable("ORACLE_TRACE") == "1" && body.Contains("is used in some"))
				{
					Console.Error.WriteLine("TRACE body='" + body + "' rest='" + rest + "' keyIdx=" + keyIdx + " players=" + string.Join("|", players));
				}
				if (keyIdx >= 0)
				{
					string remainder = rest;
					string quant =
						remainder.Contains("exactly one") ? "exactly one" :
						remainder.Contains("at most one") ? "at most one" :
						remainder.Contains("at most once") ? "at most once" :
						System.Text.RegularExpressions.Regex.IsMatch(remainder, @"\bsome\b") ? "some" :
						remainder.Contains(" each ") ? "each" : null;
					if (Environment.GetEnvironmentVariable("ORACLE_TRACE") == "1" && body.Contains("is used in some"))
						Console.Error.WriteLine("TRACE quant=" + (quant ?? "NULL"));
					if (quant == null) return false;
					var span = new List<Role> { roles[keyIdx] };
					// "at most one Y per Z" widens the key to include Z
					var perMatch = System.Text.RegularExpressions.Regex.Match(remainder, @" per ([-\w :]+)$");
					if (perMatch.Success)
					{
						for (int i = 0; i < players.Count; i++)
						{
							if (i != keyIdx && string.Equals(players[i], perMatch.Groups[1].Value.Trim(), StringComparison.Ordinal))
							{
								span.Add(roles[i]);
							}
						}
					}
					if (quant == "at most once" || quant == "each")
					{
						UniquenessConstraint ucAll = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
						foreach (Role r in roles) ucAll.RoleCollection.Add(r);
						ucAll.Modality = modality;
						Count("spanning uniqueness (set restriction)");
						return true;
					}
					if (quant == "exactly one" || quant == "at most one")
					{
						UniquenessConstraint uc = UniquenessConstraint.CreateInternalUniquenessConstraint(target);
						foreach (Role r in span) uc.RoleCollection.Add(r);
						uc.Modality = modality;
						Count("uniqueness (each-form)");
					}
					if (quant == "exactly one" || quant == "some")
					{
						MandatoryConstraint mc = MandatoryConstraint.CreateSimpleMandatoryConstraint(span[0]);
						mc.Modality = modality;
						Count("mandatory");
					}
					if (Environment.GetEnvironmentVariable("ORACLE_TRACE") == "1" && body.Contains("is used in some"))
						Console.Error.WriteLine("TRACE mapped quant=" + quant);
					return true;
				}
				if (Environment.GetEnvironmentVariable("ORACLE_TRACE") == "1" && body.Contains("is used in some"))
					Console.Error.WriteLine("TRACE fell out: keyIdx<0");
				return false;
			}
			return false;
		}

		// longest player whose name (optionally preceded by a hyphen-bound
		// adjective like "value-type- ") prefixes the text
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

		#region reporting
		public static void DumpErrors(Store store, TextWriter w)
		{
			var groups = new Dictionary<string, List<string>>();
			foreach (ModelError err in store.ElementDirectory.FindElements<ModelError>(true))
			{
				string kind = err.GetDomainClass().Name;
				List<string> list;
				if (!groups.TryGetValue(kind, out list)) groups[kind] = list = new List<string>();
				list.Add(err.ErrorText);
			}
			int total = 0;
			foreach (var kv in groups.OrderByDescending(g => g.Value.Count))
			{
				total += kv.Value.Count;
				w.WriteLine("  {0} x{1}", kv.Key, kv.Value.Count);
				foreach (string text in kv.Value.Take(4))
				{
					w.WriteLine("      - " + text);
				}
				if (kv.Value.Count > 4) w.WriteLine("      ... and " + (kv.Value.Count - 4) + " more");
			}
			w.WriteLine(total == 0 ? "  (none)" : "  TOTAL ERRORS: " + total);
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
