// Classify a difference between two intersection-source carriers as
// "identical", "order only" or "content". A carrier is a list of
// DEF("cell", S(...)) lines. Every set-like collection in it, the cell's own
// list and every population nested inside a descriptor, is CHUNKED into
// S9(...) groups (a last partial chunk is shorter, an empty one is S1(PHI())),
// and consumers flatten exactly one level; every position-carrying
// collection, a role list, a row, a uc span, is direct. Chunking is visible
// in the syntax, so each cell is parsed and canonicalised: a chunked
// collection becomes the sorted multiset of its elements, a direct one keeps
// its order. Two carriers with the same canonical form differ by order only;
// anything else, a cell on one side only, or an element whose own contents
// changed (a factorder ordinal moving from one fact type to another counts,
// the ordinal is the datum), is content.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Arest.NormaOracle.Tests
{
    public static class CarrierKind
    {
        static readonly Regex Token = new Regex(@"\G\s*(?:(""(?:[^""\\]|\\.)*"")|([A-Z]+\d*)|(-?\d+(?:\.\d+)?)|([(),]))");
        static readonly Regex SName = new Regex(@"^S\d*$");

        sealed class Node
        {
            public string Head;          // an atom's text, or a constructor name
            public List<Node> Kids;      // null for an atom
        }

        sealed class Parser
        {
            readonly List<KeyValuePair<string, string>> toks = new List<KeyValuePair<string, string>>();
            int i;

            public Parser(string text)
            {
                int pos = 0;
                while (pos < text.Length)
                {
                    Match m = Token.Match(text, pos);
                    if (!m.Success || m.Length == 0)
                    {
                        if (text.Substring(pos).Trim().Length == 0) break;
                        throw new FormatException("cannot tokenise at " + pos + ": " + text.Substring(pos, Math.Min(40, text.Length - pos)));
                    }
                    pos = m.Index + m.Length;
                    if (m.Groups[1].Success) toks.Add(new KeyValuePair<string, string>("str", m.Groups[1].Value));
                    else if (m.Groups[2].Success) toks.Add(new KeyValuePair<string, string>("id", m.Groups[2].Value));
                    else if (m.Groups[3].Success) toks.Add(new KeyValuePair<string, string>("num", m.Groups[3].Value));
                    else toks.Add(new KeyValuePair<string, string>("p", m.Groups[4].Value));
                }
            }

            bool PeekIs(string kind, string val)
            {
                return i < toks.Count && toks[i].Key == kind && toks[i].Value == val;
            }

            KeyValuePair<string, string> Take()
            {
                return toks[i++];
            }

            public Node NodeOf()
            {
                var t = Take();
                if (t.Key == "str" || t.Key == "num") return new Node { Head = t.Value };
                if (t.Key != "id") throw new FormatException("unexpected " + t.Value);
                if (!PeekIs("p", "(")) return new Node { Head = t.Value };
                Take();
                var kids = new List<Node>();
                if (!PeekIs("p", ")"))
                {
                    kids.Add(NodeOf());
                    while (PeekIs("p", ","))
                    {
                        Take();
                        kids.Add(NodeOf());
                    }
                }
                var close = Take();
                if (close.Key != "p" || close.Value != ")") throw new FormatException("expected )");
                return new Node { Head = t.Value, Kids = kids };
            }
        }

        // all children are S-nodes, every chunk but the last has exactly nine
        // elements and the last has one to nine: the shape IChunked emits
        static bool IsChunked(Node n)
        {
            if (n.Kids == null || n.Kids.Count == 0) return false;
            foreach (Node k in n.Kids)
            {
                if (k.Kids == null || !SName.IsMatch(k.Head)) return false;
            }
            for (int j = 0; j < n.Kids.Count - 1; j++)
            {
                if (n.Kids[j].Kids.Count != 9) return false;
            }
            int last = n.Kids[n.Kids.Count - 1].Kids.Count;
            return last >= 1 && last <= 9;
        }

        static string Canonical(Node n)
        {
            if (n.Kids == null) return n.Head;
            if (IsChunked(n))
            {
                var elems = new List<string>();
                foreach (Node chunk in n.Kids)
                {
                    foreach (Node k in chunk.Kids) elems.Add(Canonical(k));
                }
                elems.Sort(StringComparer.Ordinal);
                return "{" + string.Join(", ", elems) + "}";
            }
            var sb = new StringBuilder(n.Head).Append('(');
            for (int j = 0; j < n.Kids.Count; j++)
            {
                if (j > 0) sb.Append(", ");
                sb.Append(Canonical(n.Kids[j]));
            }
            return sb.Append(')').ToString();
        }

        // cell name -> canonical form, one entry per DEF line
        public static Dictionary<string, string> Cells(string text)
        {
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (string raw in text.Split('\n'))
            {
                string line = raw.Trim().TrimEnd(',');
                if (!line.StartsWith("DEF(", StringComparison.Ordinal)) continue;
                Node d = new Parser(line).NodeOf();
                if (d.Kids == null || d.Head != "DEF" || d.Kids.Count != 2) continue;
                result[d.Kids[0].Head.Trim('"')] = Canonical(d.Kids[1]);
            }
            return result;
        }

        public static string Classify(string a, string b)
        {
            if (a == b) return "identical";
            var ca = Cells(a);
            var cb = Cells(b);
            if (ca.Count == cb.Count && ca.All(kv => cb.TryGetValue(kv.Key, out string other) && other == kv.Value)) return "order only";
            return "content";
        }

        public static List<string> DifferingCells(string a, string b)
        {
            var ca = Cells(a);
            var cb = Cells(b);
            var names = new SortedSet<string>(ca.Keys.Concat(cb.Keys), StringComparer.Ordinal);
            var result = new List<string>();
            foreach (string n in names)
            {
                ca.TryGetValue(n, out string x);
                cb.TryGetValue(n, out string y);
                if (x != y) result.Add(n);
            }
            return result;
        }
    }
}
