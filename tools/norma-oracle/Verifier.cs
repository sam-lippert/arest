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
			Match mkDerived = System.Text.RegularExpressions.Regex.Match(s, @"^([*+]+)\s+");
			if (mkDerived.Success)
			{
				s = s.Substring(mkDerived.Length);
				if (mkDerived.Groups[1].Value[0] == '*' && myLastFact != null &&
					!System.Text.RegularExpressions.Regex.IsMatch(s, @"\biff?\b"))
				{
					myFullyDerived.Add(myLastFact);
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
				// invert its meaning (deontic UC/MC assert the pattern holds)
				if (s.StartsWith("It is obligatory that "))
				{
					string body = s.Substring(s.IndexOf("that ") + 5);
					if (body.StartsWith("each ") || body.StartsWith("Each "))
					{
						if (MapConstraint("Each " + body.Substring(5), ConstraintModality.Deontic)) return;
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
			ObjectType super = EnsureType(superName, false);
			foreach (ObjectType existing in sub.SupertypeCollection)
			{
				if (existing == super) { Count("subtype declaration"); return; }
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
			// fact type — reuse it (a second build would mint a
			// DuplicateReadingSignatureError twin)
			foreach (FactIndexEntry prior in myFactIndex)
			{
				if (string.Equals(prior.ReadingText, text, StringComparison.Ordinal) &&
					prior.Players.SequenceEqual(players, StringComparer.Ordinal))
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
			Count("fact-type reading (arity " + players.Count + ")");
			return true;
		}

		private readonly List<KeyValuePair<string, string>> myTextual = new List<KeyValuePair<string, string>>();

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
			// carrying its join path
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
						if (BuildPathForSequence(uc, side, listNames))
						{
							Count("external uniqueness constraint (join path)");
							myMapLog.Add("external UC built: " + Shorten(s));
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

			// impossibility as exclusion: It is impossible that <c1> and <c2>
			m = Regex.Match(body, @"^It is impossible that (.+?) and (.+)$");
			if (m.Success)
			{
				List<string> p1, p2;
				FactIndexEntry c1 = ResolveClause(m.Groups[1].Value, out p1);
				FactIndexEntry c2 = ResolveClause(m.Groups[2].Value, out p2);
				if (c1 != null && c2 != null && c1 != c2)
				{
					var shared = p1.Intersect(p2).Distinct().ToList();
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

			AddNote(kind, s, kind == "deontic" ? "qualified deontic prose" : "no direct construction");
			return true;
		}

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
				string probe = body.StartsWith("For each ") ? body.Substring(9) : body.StartsWith("Each ") ? body.Substring(5) : body;
				if (popm.Success && target != null)
				{
					probe = players != null && players.Count > 0 ? players[0] + " " : probe;
				}
				// fit = reading-word overlap + how many of the fact's players the
				// sentence mentions. Words alone misfire ("has" matches half the
				// model); an inverse-reading constraint ("Each Resource has at
				// most one State Machine." under "State Machine is for
				// Resource.") is anchored by naming both players.
				Func<List<string>, string, int> fit = delegate(List<string> ps, string words)
				{
					int sc = 0;
					foreach (string w in words.Split(' '))
					{
						if (w.Length > 2 && body.Contains(w)) sc++;
					}
					foreach (string p in ps)
					{
						if (body.Contains(p)) sc++;
					}
					return sc;
				};
				int contextScore = -1;
				if (players != null && FindPlayerPrefix(probe, players) >= 0)
				{
					FactIndexEntry ctx = myFactIndex.Find(e => e.Fact == target);
					contextScore = ctx != null ? fit(ctx.Players, ctx.ReadingWords) : 0;
				}
				FactIndexEntry bestEntry = null;
				int bestScore = -1;
				foreach (FactIndexEntry entry in myFactIndex)
				{
					if (resolved) break;
					if (entry.Fact == target) continue;
					if (FindPlayerPrefix(probe, entry.Players) < 0) continue;
					int score = fit(entry.Players, entry.ReadingWords);
					if (score > bestScore)
					{
						bestScore = score;
						bestEntry = entry;
					}
				}
				// strictly better than the running context wins; ties keep context
				if (bestEntry != null && bestScore >= 1 && bestScore > contextScore)
				{
					players = bestEntry.Players;
					roles = bestEntry.Roles;
					target = bestEntry.Fact;
					Count("constraint retargeted by fact index");
					// every retarget is a judgment call — log it so the report
					// shows exactly which fact each cross-context sentence hit
					myMapLog.Add("retarget: '" + Shorten(s) + "' -> [" + string.Join(", ", players) + "] '" + bestEntry.ReadingWords + "'");
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
			return ISeq(chunks);
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
		public void WriteDesignState(string path)
		{
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
				var rows = new List<string>();
				for (int r = 0; r < entry.Rows.Count; r++)
				{
					rows.Add(ISeq(entry.Rows[r].Select(IAtom).ToList()));
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
			sb.Append("\"THE DESIGN STATE in INTERSECTION SOURCE (generated by norma-oracle; regenerate, never edit). state:fts — one S5 descriptor per parsed fact type: name, players (top-collapsed), ucs (1-based positions), mands (phi), pop (attributed instance rows). state:declared pairs each name with its declared players; state:nestings pairs objectified fact names with their nesting types; state:otpops the per-kind entity populations, inclusion materialized up the subtype chain. Chunk convention: state:fts, each pop, each otpop, and state:declared/state:nestings are chunked — consumers flatten exactly one level; descriptors, rows, and uc spans are direct.\",\n\n");
			sb.Append("DEF(\"state:fts\", ").Append(IChunked(fts)).Append("),\n\n");
			sb.Append("DEF(\"state:declared\", ").Append(IChunked(declared)).Append("),\n\n");
			sb.Append("DEF(\"state:nestings\", ").Append(IChunked(nestings)).Append("),\n\n");
			sb.Append("DEF(\"state:otpops\", ").Append(IChunked(pops)).Append(")\n");
			sb.Append(")\n");
			System.IO.File.WriteAllText(path, sb.ToString());
		}

		public static void WriteNormaAnswer(Store store, System.Reflection.Assembly relationalAssembly, string path, HashSet<string> excludeFullyDerived)
		{
			Type tableType = relationalAssembly.GetTypes().First(x => x.Name == "Table" && typeof(ModelElement).IsAssignableFrom(x));
			var tables = store.ElementDirectory.FindElements(store.DomainDataDirectory.GetDomainClass(tableType), true)
				.Cast<ModelElement>()
				.OrderBy(t => (string)tableType.GetProperty("Name").GetValue(t, null), StringComparer.Ordinal)
				.ToList();
			var entries = new List<string>();
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
					colNames.Add(IAtom((string)col.GetType().GetProperty("Name").GetValue(col, null)));
				}
				entries.Add("S2(" + IAtom(tableName) + ", " + IChunked(colNames) + ")");
			}
			var sb = new System.Text.StringBuilder();
			sb.Append("(\n");
			sb.Append("\"NORMA'S RMAP ANSWER in INTERSECTION SOURCE (generated by norma-oracle; regenerate, never edit). norma:tables — one S2 per relational table: name, columns. norma:tables and each column list are chunked; consumers flatten one level.\",\n\n");
			sb.Append("DEF(\"norma:tables\", ").Append(IChunked(entries)).Append(")\n");
			sb.Append(")\n");
			System.IO.File.WriteAllText(path, sb.ToString());
		}
		#endregion

		#region reporting
		public static void DumpErrors(Store store, TextWriter w)
		{
			var groups = new Dictionary<string, List<string>>();
			var expected = new List<string>();
			foreach (ModelError err in store.ElementDirectory.FindElements<ModelError>(true))
			{
				string kind = err.GetDomainClass().Name;
				string text = err.ErrorText;
				// NORMA creates an implied objectification for every m:n fact
				// type and gives each role a link fact type reading "{0} is
				// involved in {1}" / "{1} involves {0}". On a RING fact both
				// roles have the same player, so the two link readings are
				// textually identical by construction — NORMA registers the
				// collision as a duplicate signature. Inherent to ring m:n
				// facts, not a metamodel defect (see README, ring-probe).
				if (kind == "DuplicateReadingSignatureError" &&
					(text.Contains(" is involved in ") || text.Contains(" involves ")))
				{
					expected.Add(text);
					continue;
				}
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
			if (expected.Count > 0)
			{
				w.WriteLine("  expected (implied link-reading twins on ring m:n fact types): " + expected.Count);
				foreach (string text in expected)
				{
					w.WriteLine("      ~ " + text);
				}
			}
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
