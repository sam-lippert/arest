using System;
using System.Collections.Generic;
using System.Linq;

// The mu: atoms resolve through DEFS then the primitives, numbers are
// selectors, sequences are the functional forms (COMP right-to-left, CONS,
// CONST, COND, ALPHA, INSERT as a right fold, WHILE). The primitives are
// Backus 11.2.3 plus the registered boundary rows of resolution.md (lex,
// implode, slug, escape_html, strip_prefix, 1r, tlr). Booleans are the
// atoms "T" and "F". No law semantics live here.
public static partial class Arest
{
    public static bool DeepEq(object a, object b)
    {
        if (ReferenceEquals(a, b)) return true;
        if (a is string sa && b is string sb) return string.Equals(sa, sb, StringComparison.Ordinal);
        if (a is int ia && b is int ib) return ia == ib;
        if (a is object[] xa && b is object[] xb)
        {
            if (xa.Length != xb.Length) return false;
            for (int i = 0; i < xa.Length; i++) if (!DeepEq(xa[i], xb[i])) return false;
            return true;
        }
        return false;
    }

    static string Bool(bool b) { return b ? "T" : "F"; }
    static object[] Seq(object x) { return (object[])x; }

    // Python str.strip(chars) / str.rstrip(chars), which lex needs verbatim.
    static string PyStrip(string s, string cs)
    {
        int a = 0, b = s.Length;
        while (a < b && cs.IndexOf(s[a]) >= 0) a++;
        while (b > a && cs.IndexOf(s[b - 1]) >= 0) b--;
        return s.Substring(a, b - a);
    }
    static string PyRstrip(string s, string cs)
    {
        int b = s.Length;
        while (b > 0 && cs.IndexOf(s[b - 1]) >= 0) b--;
        return s.Substring(0, b);
    }

    // Does NOT coerce a numeric-looking string: canon's eq does not coerce
    // (eq<1,"1"> = F), and a coercing <= would give le<1,"1"> = le<"1",1> = T
    // with eq<1,"1"> = F — antisymmetry violated. Mixed int/lexical atoms are
    // a READING-BOUNDARY defect (#31), not a licence to break the order.
    static int CompareAtoms(object a, object b)
    {
        if (a is int ia && b is int ib) return ia.CompareTo(ib);
        return string.CompareOrdinal((string)a, (string)b);
    }

    // Registration is INTO DEFS (the platform binding): a registered
    // function joins the same surface the boundary primitives live in and
    // resolves through the one mu by name. A compiled cell wins first; a
    // duplicate registration dies loud.
    public static void Register(string name, Func<object, object> impl)
    {
        if (PRIMS.ContainsKey(name)) throw new Exception("duplicate registration: " + name);
        PRIMS[name] = impl;
    }

    static readonly Dictionary<string, Func<object, object>> PRIMS =
        new Dictionary<string, Func<object, object>>(StringComparer.Ordinal)
    {
        { "id", x => x },
        { "tl", x => { var a = Seq(x); if (a.Length == 0) throw new InvalidOperationException("tl on empty"); return a.Skip(1).ToArray(); } },
        { "atom", x => Bool(!(x is object[])) },
        { "apndl", x => { var p = Seq(x); return new[] { p[0] }.Concat(Seq(p[1])).ToArray(); } },
        { "apndr", x => { var p = Seq(x); return Seq(p[0]).Concat(new[] { p[1] }).ToArray(); } },
        { "distl", x => { var p = Seq(x); return Seq(p[1]).Select(e => (object)new[] { p[0], e }).ToArray(); } },
        { "distr", x => { var p = Seq(x); return Seq(p[0]).Select(e => (object)new[] { e, p[1] }).ToArray(); } },
        { "cat", x => { var p = Seq(x); return Seq(p[0]).Concat(Seq(p[1])).ToArray(); } },
        { "null", x => Bool(x is object[] s && s.Length == 0) },
        { "eq", x => { var p = Seq(x); return Bool(DeepEq(p[0], p[1])); } },
        { "not", x => Bool(!(x is string s && s == "T")) },
        { "and", x => { var p = Seq(x); return Bool((p[0] as string) == "T" && (p[1] as string) == "T"); } },
        { "length", x => Seq(x).Length },
        // lt completes the comparison quartet; reverse and trans are Backus
        // 11.2.3 base functions. Referenced by canon, registered only by the
        // python host, so constraints:vr_lo / system:keep_first / system:ftid
        // and friends answered bottom on every station.
        { "lt", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) < 0); } },
        { "reverse", x => { var a = Seq(x); var r = new object[a.Length];
            for (int i = 0; i < a.Length; i++) r[i] = a[a.Length - 1 - i]; return r; } },
        { "trans", x => { var rows = Seq(x);
            if (rows.Length == 0) return new object[0];
            int w = Seq(rows[0]).Length;
            var outp = new object[w];
            for (int c = 0; c < w; c++) {
                var col = new object[rows.Length];
                for (int r = 0; r < rows.Length; r++) col[r] = Seq(rows[r])[c];
                outp[c] = col;
            }
            return outp; } },
        { "le", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) <= 0); } },
        { "ge", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) >= 0); } },
        { "gt", x => { var p = Seq(x); return Bool(CompareAtoms(p[0], p[1]) > 0); } },
        { "+", x => { var p = Seq(x); return (int)p[0] + (int)p[1]; } },
        { "-", x => { var p = Seq(x); return (int)p[0] - (int)p[1]; } },
        { "*", x => { var p = Seq(x); return (int)p[0] * (int)p[1]; } },
        { "/", x => { var p = Seq(x); return (int)p[0] / (int)p[1]; } },
        { "apply", x => { var p = Seq(x); return Ev(p[0], p[1]); } },
        // lex yields TOKEN-RECORDS, ten fields per token, as
        // metamodel/resolution.md types it. This station answered a flat word
        // list, so canon's system: family — sqlname reads field 5 of token 1,
        // rp_step field 8, cf_dropw field 1 — read CHARACTERS here and FIELDS
        // in the engine kernels. Fields: tok, nopunct, base, ordinal-suffix,
        // lower, quoted-text, initial-cap, hyphen-template, is-quoted,
        // quote-index. Invariant culture: the station contract is ASCII.
        { "lex", x => {
            var text = (string)x;
            var spans = new List<int[]>();
            foreach (System.Text.RegularExpressions.Match qm in
                     System.Text.RegularExpressions.Regex.Matches(text, "'[^']*'"))
                spans.Add(new[] { qm.Index, qm.Index + qm.Length });
            var rows = new List<object>();
            foreach (System.Text.RegularExpressions.Match wm in
                     System.Text.RegularExpressions.Regex.Matches(text, @"\S+"))
            {
                string tok = wm.Value;
                int s = wm.Index, e = wm.Index + wm.Length, k = 0;
                for (int i = 0; i < spans.Count; i++)
                    if (s < spans[i][1] && spans[i][0] < e) { k = i + 1; break; }
                string qtext = "";
                if (k > 0) {
                    int a = Math.Max(s, spans[k - 1][0] + 1);
                    int b = Math.Min(e, spans[k - 1][1] - 1);
                    qtext = b > a ? text.Substring(a, b - a) : "";
                }
                string nopunct = PyStrip(tok, ".;:,");
                string bas = PyRstrip(nopunct, "0123456789");
                // field 8 is the NORMA hyphen template (#24)
                string tpl = tok;
                if (tpl.Length > 2 && tpl.EndsWith("--", StringComparison.Ordinal)) tpl = tpl.Substring(0, tpl.Length - 1);
                else if (tpl.Length > 2 && tpl.StartsWith("--", StringComparison.Ordinal)) tpl = tpl.Substring(1);
                else if (tpl.Length > 1 && tpl.EndsWith("-", StringComparison.Ordinal)) tpl = tpl.Substring(0, tpl.Length - 1);
                else if (tpl.Length > 1 && tpl.StartsWith("-", StringComparison.Ordinal)) tpl = tpl.Substring(1);
                string up = (bas.Length > 0 && bas[0] >= 'A' && bas[0] <= 'Z') ? "T" : "F";
                rows.Add(new object[] { tok, nopunct, bas,
                    nopunct.Substring(bas.Length), tok.ToLowerInvariant(),
                    qtext, up, tpl, k > 0 ? "T" : "F", k });
            }
            return rows.ToArray(); } },
        // ATOMS stringify, numbers included — matching Arest.java, the rust
        // station and all three engine kernels. A Cast<string> here refused
        // numbers, and canon's renderer needs one operation total over the
        // atom domain (system:isnum is not eq<x, implode<empty,<x>>>).
        { "implode", x => { var p = Seq(x); var ws = Seq(p[1]);
            var ss = new string[ws.Length];
            for (int i = 0; i < ws.Length; i++) {
                if (ws[i] is object[]) throw new InvalidOperationException("implode on sequence");
                ss[i] = ws[i].ToString(); }
            return string.Join((string)p[0], ss); } },
        // slug yields an IDENTIFIER (resolution.md). Canon defines the same
        // function as sl:slug; this stays until both carriers regenerate.
        // slug is CANON -- DEF("slug"). Deleted here.
        // char-level lex boundary (invariant ASCII on every station)
        { "chars", x => ((string)x).Select(c => (object)c.ToString()).ToArray() },
        // the EMPTY atom passes through and answers "F" — js, python and all
        // three engine kernels do that; indexing [0] alone refused it here.
        // charup is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // chardown is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // charisup is CANON -- range test over 1 . chars. Deleted here.
        // charislow is CANON -- range test over 1 . chars. Deleted here.
        // charisdigit is CANON -- range test over 1 . chars. Deleted here.
        // escape_html is CANON -- char fold over chars/implode. Deleted here.
        // policy-free: <prefix, s> -> tail-or-s (parity-ledger 2026-07-08). At
        // pre == t the answer is "", not t — no strictly-longer guard.
        // strip_prefix is CANON -- DEF("strip_prefix"). Deleted here.
        // ntoa is CANON -- DEF("ntoa"). Deleted here.
        // quote_str is CANON -- DEF("quote_str"). Deleted here.
        { "1r", x => Seq(x)[Seq(x).Length - 1] },
        { "tlr", x => { var a = Seq(x); if (a.Length == 0) throw new InvalidOperationException("tlr on empty"); return a.Take(a.Length - 1).ToArray(); } },
    };

    // ---- pure-application memo, mirroring head.part.js point for point.
    // Evaluation is pure and D is frozen during a step (Backus 14.6), so a
    // named cell applied to the same input is the same value; remembering it
    // is EVALUATOR QUALITY, not semantics — it cannot change an answer, only
    // how long the answer takes, and the wall certifies that by holding this
    // station's printed atoms byte-identical to the js station's.
    //
    // Not the "guard or name list" the README forbids: that is about MEANING
    // living in the host. MEMOCN decides only what is worth remembering —
    // delete it and every law still answers the same, just slower. Measured
    // on the base carriers: the js station prints all 53 laws in ~50s, and
    // the SAME bytes with `memoable` stubbed to false print ZERO laws in
    // 120s. This station had no memo, which is why `dotnet run` ran past 20
    // minutes without printing a law.
    //
    // Keys mirror JS Map semantics: atoms by value, sequences by REFERENCE.
    // The default comparer gives both — string/int compare by value, object[]
    // inherits object's reference Equals/GetHashCode. Frames of 4 or fewer key
    // by element; anything else keys by the operand itself under -1.
    static readonly Dictionary<string, Dictionary<object, object>> EVMEMO =
        new Dictionary<string, Dictionary<object, object>>(StringComparer.Ordinal);
    static int EVMEMON = 0;
    static readonly HashSet<string> MEMOCN = new HashSet<string>(StringComparer.Ordinal)
    {
        "ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor", "cn:sfx", "cn:pred",
        "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts", "cn:chrank", "lex:lw",
        "induce:sig_of"
    };
    static bool Memoable(string f) =>
        MEMOCN.Contains(f) || f.StartsWith("rmap:", StringComparison.Ordinal)
                           || f.StartsWith("state:", StringComparison.Ordinal);
    // Any harness that mutates CELLS between evaluations MUST call this at the
    // mutation point. Also the bound: a full clear past the cap.
    public static void MemoClear()
    {
        EVMEMO.Clear(); EVMEMON = 0;
        DESCIDX = new System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, object>>();
        ENTIDX = new System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, List<object>>>();
    }

    // ---- FASTPRIMS: compiled forms of hot canon list cells, mirroring
    // head.part.js. The DEF stays the meaning; the head evaluates its
    // EXTENSIONAL EQUAL, and the wall certifies identity. Only consulted when
    // the DEF exists, and each mirrors its DEF's edges exactly — negative
    // counts drain, `last` on empty is "?", `nth` out of range throws the
    // selector error, `dedup` keeps LAST occurrences (a right fold),
    // `setminus` is a multiset filter of the first argument, `iota` on a
    // non-number throws, and flatten's per-element Seq keeps cat's "a
    // non-sequence element is an error".
    //
    // Measured necessity (js station, same canon bytes): with the memo but
    // FASTPRIMS stubbed out the base report printed ZERO laws in 300s; with
    // both, 53 laws in 49.7s. The memo alone is NOT sufficient — the Java
    // station went from >20min (never finishing) to 29.7s once both landed.
    static object At(object x, int i)
    {
        var a = Seq(x);
        if (i < 0 || i >= a.Length) throw new Exception("index " + i + " out of " + a.Length);
        return a[i];
    }
    // Canonical key, standing in for JSON.stringify's use as a Map/Set key.
    // Only the EQUIVALENCE CLASSES matter, and both encodings are injective
    // over {string, int, object[]}; length-prefixing the text makes this one
    // unambiguous without imitating JSON's escaping.
    static string Key(object o)
    {
        var b = new System.Text.StringBuilder();
        Key(o, b);
        return b.ToString();
    }
    static void Key(object o, System.Text.StringBuilder b)
    {
        if (o is string s) b.Append('S').Append(s.Length).Append(':').Append(s);
        else if (o is int n) b.Append('N').Append(n);
        else if (o is object[] a)
        {
            b.Append('[');
            for (int i = 0; i < a.Length; i++) { if (i > 0) b.Append(','); Key(a[i], b); }
            b.Append(']');
        }
        else b.Append('?').Append(o);
    }
    // Indexed once per list OBJECT, keyed by reference — ConditionalWeakTable
    // is the direct analogue of JS's WeakMap, so a dropped list collects.
    static System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, object>> DESCIDX =
        new System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, object>>();
    static System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, List<object>>> ENTIDX =
        new System.Runtime.CompilerServices.ConditionalWeakTable<object, Dictionary<string, List<object>>>();

    static int DrainCount(object[] l, object nO)
    {
        int n = (int) nO;
        return n == 0 ? 0 : (n < 0 ? l.Length : Math.Min(l.Length, n));
    }
    static object[] Slice(object[] a, int from, int to)
    {
        var r = new object[Math.Max(0, to - from)];
        Array.Copy(a, from, r, 0, r.Length);
        return r;
    }

    static readonly Dictionary<string, Func<object, object>> FASTPRIMS =
        new Dictionary<string, Func<object, object>>(StringComparer.Ordinal)
    {
        { "theta:member", x => {
            var needle = At(x, 0);
            foreach (var e in Seq(At(x, 1))) if (DeepEq(needle, e)) return "T";
            return "F"; } },
        { "theta:filter_eq", x => {
            var outp = new List<object>();
            foreach (var p in Seq(x)) if (DeepEq(At(p, 0), At(p, 1))) outp.Add(p);
            return outp.ToArray(); } },
        { "theta:drop", x => {
            var l = Seq(At(x, 0));
            return Slice(l, DrainCount(l, At(x, 1)), l.Length); } },
        { "theta:take", x => {
            var l = Seq(At(x, 0));
            return Slice(l, 0, DrainCount(l, At(x, 1))); } },
        { "theta:nth", x => {
            var l = Seq(At(x, 0));
            int k = DrainCount(l, At(x, 1));
            if (k >= l.Length) throw new Exception("selector 1 out of range 0");
            return l[k]; } },
        { "theta:last", x => {
            var l = Seq(x);
            return l.Length > 0 ? l[l.Length - 1] : "?"; } },
        { "theta:butlast", x => {
            var l = Seq(x);
            return Slice(l, 0, Math.Max(0, l.Length - 1)); } },
        { "theta:iota", x => {
            if (!(x is int)) throw new Exception("iota on non-number");
            int n = (int) x;
            var outp = new object[Math.Max(0, n)];
            for (int i = 1; i <= n; i++) outp[i - 1] = i;
            return outp; } },
        { "theta:zip", x => {
            object[] a = Seq(At(x, 0)), b = Seq(At(x, 1));
            int n = Math.Min(a.Length, b.Length);
            var outp = new object[n];
            for (int i = 0; i < n; i++) outp[i] = new object[] { a[i], b[i] };
            return outp; } },
        { "theta:dedup", x => {
            var l = Seq(x);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var outp = new List<object>();
            for (int i = l.Length - 1; i >= 0; i--) if (seen.Add(Key(l[i]))) outp.Add(l[i]);
            outp.Reverse();
            return outp.ToArray(); } },
        { "theta:setminus", x => {
            object[] a = Seq(At(x, 0)), b = Seq(At(x, 1));
            var drop = new HashSet<string>(StringComparer.Ordinal);
            foreach (var e in b) drop.Add(Key(e));
            var outp = new List<object>();
            foreach (var e in a) if (!drop.Contains(Key(e))) outp.Add(e);
            return outp.ToArray(); } },
        { "theta:flatten", x => {
            var outp = new List<object>();
            foreach (var s in Seq(x)) foreach (var e in Seq(s)) outp.Add(e);
            return outp.ToArray(); } },
        { "cn:entsat", x => {
            var l = Seq(At(x, 0));
            var k = At(x, 1);
            Dictionary<string, List<object>> idx;
            if (!ENTIDX.TryGetValue(l, out idx))
            {
                idx = new Dictionary<string, List<object>>(StringComparer.Ordinal);
                foreach (var e in l)
                {
                    var ea = e as object[];
                    if (ea == null || ea.Length < 2) continue;
                    var kk = Key(ea[0]);
                    List<object> a;
                    if (!idx.TryGetValue(kk, out a)) { a = new List<object>(); idx[kk] = a; }
                    a.Add(ea[1]);
                }
                ENTIDX.Add(l, idx);
            }
            List<object> hit;
            if (!idx.TryGetValue(Key(k), out hit)) return new object[0];
            var outp = new List<object>();
            foreach (var v in hit) foreach (var e in Seq(v)) outp.Add(e);
            return outp.ToArray(); } },
        { "theta:find_desc", x => {
            var name = At(x, 0);
            var descs = Seq(At(x, 1));
            Dictionary<string, object> idx;
            if (!DESCIDX.TryGetValue(descs, out idx))
            {
                idx = new Dictionary<string, object>(StringComparer.Ordinal);
                foreach (var dd in descs)
                {
                    var da = dd as object[];
                    if (da == null || da.Length == 0) continue;
                    var k = Key(da[0]);
                    if (!idx.ContainsKey(k)) idx[k] = dd;   // first-named-wins
                }
                DESCIDX.Add(descs, idx);
            }
            object hit;
            return idx.TryGetValue(Key(name), out hit) ? hit : (object) new object[0]; } },
    };

    public static object Ev(object f, object x)
    {
        if (f is int n)
        {
            if (!(x is object[])) throw new Exception("selector " + n + " on atom: " + x);
            return Seq(x)[n - 1];
        }
        if (f is string s)
        {
            object body;
            if (DEFS.TryGetValue(s, out body))
            {
                Func<object, object> fp;
                if (FASTPRIMS.TryGetValue(s, out fp)) return fp(x);
                if (!Memoable(s)) return Ev(body, x);
                Dictionary<object, object> node;
                if (!EVMEMO.TryGetValue(s, out node))
                {
                    node = new Dictionary<object, object>();
                    EVMEMO[s] = node;
                }
                object[] chain;
                if (x is object[] xs && xs.Length <= 4)
                {
                    chain = new object[xs.Length + 1];
                    chain[0] = xs.Length;
                    Array.Copy(xs, 0, chain, 1, xs.Length);
                }
                else
                {
                    chain = new object[] { -1, x };
                }
                for (int i = 0; i < chain.Length - 1; i++)
                {
                    object nn;
                    if (!node.TryGetValue(chain[i], out nn))
                    {
                        nn = new Dictionary<object, object>();
                        node[chain[i]] = nn;
                    }
                    node = (Dictionary<object, object>) nn;
                }
                var last = chain[chain.Length - 1];
                object hit;
                if (node.TryGetValue(last, out hit)) return hit;
                var v = Ev(body, x);
                node[last] = v;
                if (++EVMEMON > 400000) MemoClear();
                return v;
            }
            Func<object, object> prim;
            if (PRIMS.TryGetValue(s, out prim)) return prim(x);
            throw new Exception("unresolved atom: " + s);
        }
        var form = Seq(f);
        var head = form[0] as string;
        // tau clause (c): METACOMPOSITION (Backus 13.3.2, 13.4).
        //     (rho <x1..xn>):y = (rho x1):<<x1..xn>, y>
        // FETCH the head, do not MATCH it -- see the note in Arest.java. The
        // switch below is the PRIMITIVE ARM of this rule, taken only when canon
        // does not define the form.
        if (head == null || DEFS.ContainsKey(head)) return Ev(form[0], new object[] { f, x });
        switch (head)
        {
            case "COMP":
            {
                object v = x;
                for (int i = form.Length - 1; i >= 1; i--) v = Ev(form[i], v);
                return v;
            }
            // CONS and CONST are CANON now (Backus 13.3.2 verbatim) and reach
            // this host through tau clause (c) above. See head.part.js.
            case "COND": return (Ev(form[1], x) as string) == "T" ? Ev(form[2], x) : Ev(form[3], x);
            case "ALPHA": return Seq(x).Select(e => Ev(form[1], e)).ToArray();
            case "INSERT":
            {
                var xs = Seq(x);
                object acc = xs[xs.Length - 1];
                for (int i = xs.Length - 2; i >= 0; i--) acc = Ev(form[1], new[] { xs[i], acc });
                return acc;
            }
            case "WHILE":
            {
                object v = x;
                while ((Ev(form[1], v) as string) == "T") v = Ev(form[2], v);
                return v;
            }
        }
        throw new Exception("unknown form: " + head);
    }
}
