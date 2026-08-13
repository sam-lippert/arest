import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

// java-runner — the composed checker, Java PARITY station.
//
// The registration vocabulary and the STRICT mu, mirroring
// tools/cs-runner/{Vocabulary,Mu}.cs point for point (and the js-runner's
// head.part.js, which mirrors the same source). A selector on an atom
// throws, a duplicate DEF throws, a comparison across atom kinds throws, an
// out-of-range selection throws. Booleans are the atoms "T" and "F". No law
// semantics live here — the laws are canon DEFs, and if a guard or a name
// list ever appears in this file, delete it: accretion is how the first two
// js runners died.
//
// The canon and the carriers appear AS SOURCE in the generated
// Composed.g.java (class Composed extends Arest, so the canon's unqualified
// DEF/A/N/K/PHI/S1..S9 resolve by inheritance — Java's version of the "one
// extra name" join), are COMPILED by javac, and the class files are then
// just exec'd. Nothing is read, eval'd, or interpreted at runtime.
public class Arest {
    // Registration is INTO DEFS (the paper's platform binding: "a runtime
    // registers its own functions into DEFS"): a registered function joins
    // the same surface the boundary primitives live in and resolves through
    // the one mu by name - rho-application, no side table, no bypass. A
    // compiled cell of the same name wins (Backus 13.3.5: fetch the store
    // first); a duplicate registration dies loud.
    public static void register(String name, java.util.function.Function<Object, Object> impl) {
        if (PRIMS.containsKey(name)) throw new RuntimeException("duplicate registration: " + name);
        PRIMS.put(name, impl);
    }

    public static final Map<String, Object> DEFS = new HashMap<String, Object>();
    public static final List<Object> CELLS = new ArrayList<Object>();

    // ---- pure-application memo, mirroring head.part.js point for point.
    // Evaluation is pure and D is frozen during a step (Backus 14.6), so a
    // named cell applied to the same input is the same value; remembering it
    // is EVALUATOR QUALITY, not semantics — it cannot change an answer, only
    // how long the answer takes, and the wall certifies that by holding this
    // station's printed atoms byte-identical to the js station's.
    //
    // This is not the "name list" the header forbids. That prohibition is
    // about MEANING living in the host — guards, mode names, fallback lists.
    // MEMOCN decides only what is worth remembering; delete it and every law
    // still answers the same, just slower. Measured on the base carriers:
    // with the memo the js station prints all 53 laws in ~50s; with only
    // `memoable` stubbed to false, the SAME bytes print ZERO laws in 120s.
    // This station had no memo at all, which is why it ran past 20 minutes
    // without printing a law.
    //
    // Keys mirror JS Map semantics exactly: atoms by value, sequences by
    // REFERENCE. Java gives both for free — String/Integer implement
    // equals/hashCode by value, and Object[] inherits Object's identity
    // versions. Frames of 4 or fewer key by element (so ctx-threaded
    // references hit); anything else keys by the operand itself under -1.
    static final Map<String, Map<Object, Object>> EVMEMO =
        new HashMap<String, Map<Object, Object>>();
    static int EVMEMON = 0;
    static final java.util.Set<String> MEMOCN = new java.util.HashSet<String>(
        java.util.Arrays.asList("ast:fetch", "cn:otparts", "cn:mandfor", "cn:vtfor",
            "cn:sfx", "cn:pred", "cn:hyph", "cn:rmkind", "cn:gmpl", "lex:parts",
            "cn:chrank", "lex:lw", "induce:sig_of"));
    static boolean memoable(String f) {
        return MEMOCN.contains(f) || f.startsWith("rmap:") || f.startsWith("state:");
    }
    // Any harness that mutates CELLS between evaluations MUST call this at
    // the mutation point. Also the bound: a full clear past the cap.
    public static void memoClear() {
        EVMEMO.clear(); EVMEMON = 0;
        DESCIDX = new java.util.WeakHashMap<Object, Map<String, Object>>();
        ENTIDX = new java.util.WeakHashMap<Object, Map<String, List<Object>>>();
    }

    // ---- FASTPRIMS: compiled forms of hot canon list cells, mirroring
    // head.part.js. The DEF stays the meaning; the head evaluates its
    // EXTENSIONAL EQUAL, and the wall certifies identity. Only consulted
    // when the DEF exists, and each mirrors its DEF's edges exactly —
    // negative counts drain, `last` on empty is "?", `nth` out of range
    // throws the selector error, `dedup` keeps LAST occurrences (it is a
    // right fold), `setminus` is a multiset filter of the first argument,
    // `iota` on a non-number throws, and flatten's per-element seq() keeps
    // cat's "a non-sequence element is an error".
    //
    // Measured necessity (js station, same canon bytes): with the memo but
    // FASTPRIMS stubbed out, the base report printed ZERO laws in 300s; with
    // both, 53 laws in 49.7s. The memo alone is NOT sufficient.
    // Python str.strip(chars) / str.rstrip(chars), which lex needs verbatim.
    static String pyStrip(String s, String cs) {
        int a = 0, b = s.length();
        while (a < b && cs.indexOf(s.charAt(a)) >= 0) a++;
        while (b > a && cs.indexOf(s.charAt(b - 1)) >= 0) b--;
        return s.substring(a, b);
    }
    static String pyRstrip(String s, String cs) {
        int b = s.length();
        while (b > 0 && cs.indexOf(s.charAt(b - 1)) >= 0) b--;
        return s.substring(0, b);
    }
    static Object at(Object x, int i) {
        Object[] a = seq(x);
        if (i < 0 || i >= a.length) throw new RuntimeException("index " + i + " out of " + a.length);
        return a[i];
    }
    // Canonical key, standing in for JSON.stringify's use as a Map/Set key.
    // Only the EQUIVALENCE CLASSES matter, and both encodings are injective
    // over {String, Integer, Object[]}; length-prefixing the text makes this
    // one unambiguous without imitating JSON's escaping.
    static String key(Object o) {
        StringBuilder b = new StringBuilder();
        key(o, b);
        return b.toString();
    }
    private static void key(Object o, StringBuilder b) {
        if (o instanceof String) {
            String s = (String) o;
            b.append('S').append(s.length()).append(':').append(s);
        } else if (o instanceof Integer) {
            b.append('N').append(o);
        } else if (o instanceof Object[]) {
            Object[] a = (Object[]) o;
            b.append('[');
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); key(a[i], b); }
            b.append(']');
        } else {
            b.append('?').append(o);
        }
    }
    // Backus 13.3.4 defines fetch as a linear walk and law:find_desc IS that
    // walk; the MEANING is "the first descriptor named n" — a lookup — so the
    // walk is the evaluator's business. Indexed once per list OBJECT, keyed by
    // reference (Object[] inherits identity equals/hashCode, so WeakHashMap
    // behaves as JS's WeakMap) and dropped when the list is.
    static java.util.WeakHashMap<Object, Map<String, Object>> DESCIDX =
        new java.util.WeakHashMap<Object, Map<String, Object>>();
    static java.util.WeakHashMap<Object, Map<String, List<Object>>> ENTIDX =
        new java.util.WeakHashMap<Object, Map<String, List<Object>>>();

    static int drainCount(Object[] l, Object nO) {
        int n = ((Integer) nO).intValue();
        return n == 0 ? 0 : (n < 0 ? l.length : Math.min(l.length, n));
    }
    static Object[] slice(Object[] a, int from, int to) {
        Object[] r = new Object[Math.max(0, to - from)];
        System.arraycopy(a, from, r, 0, r.length);
        return r;
    }

    static final Map<String, Function<Object, Object>> FASTPRIMS =
        new HashMap<String, Function<Object, Object>>();
    static {
        FASTPRIMS.put("theta:member", x -> {
            Object needle = at(x, 0);
            for (Object e : seq(at(x, 1))) if (deepEq(needle, e)) return "T";
            return "F"; });
        FASTPRIMS.put("theta:filter_eq", x -> {
            List<Object> out = new ArrayList<Object>();
            for (Object p : seq(x)) if (deepEq(at(p, 0), at(p, 1))) out.add(p);
            return out.toArray(); });
        FASTPRIMS.put("theta:drop", x -> {
            Object[] l = seq(at(x, 0));
            return slice(l, drainCount(l, at(x, 1)), l.length); });
        FASTPRIMS.put("theta:take", x -> {
            Object[] l = seq(at(x, 0));
            return slice(l, 0, drainCount(l, at(x, 1))); });
        FASTPRIMS.put("theta:nth", x -> {
            Object[] l = seq(at(x, 0));
            int k = drainCount(l, at(x, 1));
            if (k >= l.length) throw new RuntimeException("selector 1 out of range 0");
            return l[k]; });
        FASTPRIMS.put("theta:last", x -> {
            Object[] l = seq(x);
            return l.length > 0 ? l[l.length - 1] : "?"; });
        FASTPRIMS.put("theta:butlast", x -> {
            Object[] l = seq(x);
            return slice(l, 0, Math.max(0, l.length - 1)); });
        FASTPRIMS.put("theta:iota", x -> {
            if (!(x instanceof Integer)) throw new RuntimeException("iota on non-number");
            int n = (Integer) x;
            Object[] out = new Object[Math.max(0, n)];
            for (int i = 1; i <= n; i++) out[i - 1] = Integer.valueOf(i);
            return out; });
        FASTPRIMS.put("theta:zip", x -> {
            Object[] a = seq(at(x, 0)), b = seq(at(x, 1));
            int n = Math.min(a.length, b.length);
            Object[] out = new Object[n];
            for (int i = 0; i < n; i++) out[i] = new Object[] { a[i], b[i] };
            return out; });
        FASTPRIMS.put("theta:dedup", x -> {
            Object[] l = seq(x);
            java.util.Set<String> seen = new java.util.HashSet<String>();
            List<Object> out = new ArrayList<Object>();
            for (int i = l.length - 1; i >= 0; i--) if (seen.add(key(l[i]))) out.add(l[i]);
            java.util.Collections.reverse(out);
            return out.toArray(); });
        FASTPRIMS.put("theta:setminus", x -> {
            Object[] a = seq(at(x, 0)), b = seq(at(x, 1));
            java.util.Set<String> drop = new java.util.HashSet<String>();
            for (Object e : b) drop.add(key(e));
            List<Object> out = new ArrayList<Object>();
            for (Object e : a) if (!drop.contains(key(e))) out.add(e);
            return out.toArray(); });
        FASTPRIMS.put("theta:flatten", x -> {
            List<Object> out = new ArrayList<Object>();
            for (Object s : seq(x)) for (Object e : seq(s)) out.add(e);
            return out.toArray(); });
        FASTPRIMS.put("cn:entsat", x -> {
            Object[] l = seq(at(x, 0));
            Object k = at(x, 1);
            Map<String, List<Object>> idx = ENTIDX.get(l);
            if (idx == null) {
                idx = new HashMap<String, List<Object>>();
                for (Object e : l) {
                    if (!(e instanceof Object[]) || ((Object[]) e).length < 2) continue;
                    Object[] ea = (Object[]) e;
                    String kk = key(ea[0]);
                    List<Object> a = idx.get(kk);
                    if (a == null) { a = new ArrayList<Object>(); idx.put(kk, a); }
                    a.add(ea[1]);
                }
                ENTIDX.put(l, idx);
            }
            List<Object> hit = idx.get(key(k));
            if (hit == null) return new Object[0];
            List<Object> out = new ArrayList<Object>();
            for (Object v : hit) for (Object e : seq(v)) out.add(e);
            return out.toArray(); });
        FASTPRIMS.put("theta:find_desc", x -> {
            Object name = at(x, 0);
            Object[] descs = seq(at(x, 1));
            Map<String, Object> idx = DESCIDX.get(descs);
            if (idx == null) {
                idx = new HashMap<String, Object>();
                for (Object dd : descs) {
                    if (!(dd instanceof Object[]) || ((Object[]) dd).length == 0) continue;
                    String k = key(((Object[]) dd)[0]);
                    if (!idx.containsKey(k)) idx.put(k, dd);   // first-named-wins
                }
                DESCIDX.put(descs, idx);
            }
            Object hit = idx.get(key(name));
            return hit == null ? new Object[0] : hit; });
    }

    public static Object DEF(String name, Object body) {
        // a duplicate throws by collection semantics; law:one_name is the law
        if (DEFS.containsKey(name)) throw new RuntimeException("duplicate DEF: " + name);
        DEFS.put(name, body);
        CELLS.add(new Object[] { "CELL", name, body });
        return name;
    }

    public static Object A(String s) { return s; }
    public static Object N(int n) { return Integer.valueOf(n); }
    public static Object K(Object x) { return new Object[] { "CONST", x }; }
    public static Object PHI() { return new Object[0]; }

    // Backus 13.2 rule 4: a sequence has arbitrary length n. S1..S9 is notation;
    // a carrier longer than 9 must not encode its length as depth, because depth
    // already means tenancy here (backus78 14.7, AREST.tex prop:tenant).
    public static Object S(Object... a) { return a; }

    public static Object S1(Object a) { return new Object[] { a }; }
    public static Object S2(Object a, Object b) { return new Object[] { a, b }; }
    public static Object S3(Object a, Object b, Object c) { return new Object[] { a, b, c }; }
    public static Object S4(Object a, Object b, Object c, Object d) { return new Object[] { a, b, c, d }; }
    public static Object S5(Object a, Object b, Object c, Object d, Object e) { return new Object[] { a, b, c, d, e }; }
    public static Object S6(Object a, Object b, Object c, Object d, Object e, Object f) { return new Object[] { a, b, c, d, e, f }; }
    public static Object S7(Object a, Object b, Object c, Object d, Object e, Object f, Object g) { return new Object[] { a, b, c, d, e, f, g }; }
    public static Object S8(Object a, Object b, Object c, Object d, Object e, Object f, Object g, Object h) { return new Object[] { a, b, c, d, e, f, g, h }; }
    public static Object S9(Object a, Object b, Object c, Object d, Object e, Object f, Object g, Object h, Object i) { return new Object[] { a, b, c, d, e, f, g, h, i }; }

    public static Object[] CANON(Object... xs) { return xs; }

    // ---- the mu ------------------------------------------------------------

    public static boolean deepEq(Object a, Object b) {
        if (a == b) return true;
        if (a instanceof String && b instanceof String) return a.equals(b);
        if (a instanceof Integer && b instanceof Integer) return a.equals(b);
        if (a instanceof Object[] && b instanceof Object[]) {
            Object[] xa = (Object[]) a, xb = (Object[]) b;
            if (xa.length != xb.length) return false;
            for (int i = 0; i < xa.length; i++) if (!deepEq(xa[i], xb[i])) return false;
            return true;
        }
        return false;
    }

    static String bool(boolean b) { return b ? "T" : "F"; }

    static Object[] seq(Object x) {
        if (!(x instanceof Object[])) throw new RuntimeException("expected sequence, got atom: " + x);
        return (Object[]) x;
    }

    // both numbers -> numeric; both strings -> UTF-16 code-unit lexicographic
    // (String.compareTo == C# CompareOrdinal == js <); anything else THROWS
    // Does NOT coerce a numeric-looking string: canon's eq does not coerce
    // (eq<1,"1"> = F), and a coercing <= would give le<1,"1"> = le<"1",1> = T
    // with eq<1,"1"> = F — antisymmetry violated, so <= would not be an order.
    // The engine kernels coerce and are the ones carrying the drift; mixed
    // int/lexical atoms are a READING-BOUNDARY defect (#31).
    static int cmpAtoms(Object a, Object b) {
        if (a instanceof Integer && b instanceof Integer) return ((Integer) a).compareTo((Integer) b);
        if (a instanceof String && b instanceof String) return ((String) a).compareTo((String) b);
        throw new RuntimeException("compare across atom kinds: " + a + " vs " + b);
    }

    static final Map<String, Function<Object, Object>> PRIMS = new HashMap<String, Function<Object, Object>>();
    static {
        PRIMS.put("id", x -> x);
        PRIMS.put("tl", x -> { Object[] a = seq(x); Object[] r = new Object[a.length - 1];
            System.arraycopy(a, 1, r, 0, r.length); return r; });
        PRIMS.put("atom", x -> bool(!(x instanceof Object[])));
        PRIMS.put("apndl", x -> { Object[] p = seq(x); Object[] t = seq(p[1]);
            Object[] r = new Object[t.length + 1]; r[0] = p[0]; System.arraycopy(t, 0, r, 1, t.length); return r; });
        PRIMS.put("apndr", x -> { Object[] p = seq(x); Object[] h = seq(p[0]);
            Object[] r = new Object[h.length + 1]; System.arraycopy(h, 0, r, 0, h.length); r[h.length] = p[1]; return r; });
        PRIMS.put("distl", x -> { Object[] p = seq(x); Object[] t = seq(p[1]);
            Object[] r = new Object[t.length];
            for (int i = 0; i < t.length; i++) r[i] = new Object[] { p[0], t[i] }; return r; });
        PRIMS.put("distr", x -> { Object[] p = seq(x); Object[] h = seq(p[0]);
            Object[] r = new Object[h.length];
            for (int i = 0; i < h.length; i++) r[i] = new Object[] { h[i], p[1] }; return r; });
        PRIMS.put("cat", x -> { Object[] p = seq(x); Object[] a = seq(p[0]); Object[] b = seq(p[1]);
            Object[] r = new Object[a.length + b.length];
            System.arraycopy(a, 0, r, 0, a.length); System.arraycopy(b, 0, r, a.length, b.length); return r; });
        PRIMS.put("null", x -> bool(x instanceof Object[] && ((Object[]) x).length == 0));
        PRIMS.put("eq", x -> { Object[] p = seq(x); return bool(deepEq(p[0], p[1])); });
        PRIMS.put("not", x -> bool(!(x instanceof String && x.equals("T"))));
        PRIMS.put("and", x -> { Object[] p = seq(x); return bool("T".equals(p[0]) && "T".equals(p[1])); });
        PRIMS.put("length", x -> Integer.valueOf(seq(x).length));
        // lt completes the comparison quartet; reverse and trans are Backus
        // 11.2.3 base functions. All three were registered by the python host
        // and referenced by canon (lt <- constraints:vr_lo, constraints:fq_lo,
        // system:rp_match, law:setalgebra; reverse <- system:keep_first,
        // system:partition; trans <- system:ftid, system:ft_rows) but absent
        // here, so those DEFs answered bottom on every station.
        PRIMS.put("lt", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) < 0); });
        PRIMS.put("reverse", x -> { Object[] a = seq(x); Object[] r = new Object[a.length];
            for (int i = 0; i < a.length; i++) r[i] = a[a.length - 1 - i]; return r; });
        // trans: transpose a sequence of equal-length sequences (Backus 11.2.3)
        PRIMS.put("trans", x -> { Object[] rows = seq(x);
            if (rows.length == 0) return new Object[0];
            int w = seq(rows[0]).length;
            Object[] out = new Object[w];
            for (int c = 0; c < w; c++) {
                Object[] col = new Object[rows.length];
                for (int r = 0; r < rows.length; r++) col[r] = seq(rows[r])[c];
                out[c] = col;
            }
            return out; });
        PRIMS.put("le", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) <= 0); });
        PRIMS.put("ge", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) >= 0); });
        PRIMS.put("gt", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) > 0); });
        PRIMS.put("+", x -> { Object[] p = seq(x); return Integer.valueOf((Integer) p[0] + (Integer) p[1]); });
        PRIMS.put("-", x -> { Object[] p = seq(x); return Integer.valueOf((Integer) p[0] - (Integer) p[1]); });
        PRIMS.put("*", x -> { Object[] p = seq(x); return Integer.valueOf((Integer) p[0] * (Integer) p[1]); });
        PRIMS.put("/", x -> { Object[] p = seq(x); return Integer.valueOf((Integer) p[0] / (Integer) p[1]); });
        PRIMS.put("apply", x -> { Object[] p = seq(x); return Ev(p[0], p[1]); });
        // lex yields TOKEN-RECORDS, ten fields per token, as
        // metamodel/resolution.md types it. This station answered a flat word
        // list, so canon's system: family — sqlname reads field 5 of token 1,
        // rp_step field 8, cf_dropw field 1 — read CHARACTERS here and FIELDS
        // in the engine kernels: one name, two functions, split by lineage.
        // Fields: tok, nopunct, base, ordinal-suffix, lower, quoted-text,
        // initial-cap, hyphen-template, is-quoted, quote-index. Locale.ROOT
        // because the station contract is ASCII, never the host's culture.
        PRIMS.put("lex", x -> {
            String text = (String) x;
            List<int[]> spans = new ArrayList<int[]>();
            java.util.regex.Matcher qm =
                java.util.regex.Pattern.compile("'[^']*'").matcher(text);
            while (qm.find()) spans.add(new int[] { qm.start(), qm.end() });
            List<Object> rows = new ArrayList<Object>();
            java.util.regex.Matcher wm =
                java.util.regex.Pattern.compile("\\S+").matcher(text);
            while (wm.find()) {
                String tok = wm.group();
                int s = wm.start(), e = wm.end(), k = 0;
                for (int i = 0; i < spans.size(); i++)
                    if (s < spans.get(i)[1] && spans.get(i)[0] < e) { k = i + 1; break; }
                String qtext = "";
                if (k > 0) qtext = text.substring(Math.max(s, spans.get(k - 1)[0] + 1),
                                                  Math.min(e, spans.get(k - 1)[1] - 1));
                String nopunct = pyStrip(tok, ".;:,");
                String base = pyRstrip(nopunct, "0123456789");
                // field 8 is the NORMA hyphen template (#24): a one-sided
                // touching hyphen is the bind marker and is consumed, a
                // doubled one escapes to a single literal hyphen.
                String tpl = tok;
                if (tpl.length() > 2 && tpl.endsWith("--")) tpl = tpl.substring(0, tpl.length() - 1);
                else if (tpl.length() > 2 && tpl.startsWith("--")) tpl = tpl.substring(1);
                else if (tpl.length() > 1 && tpl.endsWith("-")) tpl = tpl.substring(0, tpl.length() - 1);
                else if (tpl.length() > 1 && tpl.startsWith("-")) tpl = tpl.substring(1);
                String up = (base.length() > 0 && base.charAt(0) >= 'A'
                             && base.charAt(0) <= 'Z') ? "T" : "F";
                rows.add(new Object[] { tok, nopunct, base,
                    nopunct.substring(base.length()),
                    tok.toLowerCase(java.util.Locale.ROOT),
                    qtext, up, tpl, k > 0 ? "T" : "F", Integer.valueOf(k) });
            }
            return rows.toArray(); });
        PRIMS.put("implode", x -> { Object[] p = seq(x); String sep = (String) p[0]; Object[] parts = seq(p[1]);
            // atoms stringify (numbers included) — js Array.join semantics;
            // a (String) cast here would diverge from the certified js head
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < parts.length; i++) { if (i > 0) sb.append(sep); sb.append(String.valueOf(parts[i])); }
            return sb.toString(); });
        // slug yields an IDENTIFIER (resolution.md). Canon defines the same
        // function as sl:slug; this stays until both carriers regenerate.
        // slug is CANON -- DEF("slug"). Deleted here.
        // char-level lex boundary (invariant ASCII on every station)
        PRIMS.put("chars", x -> { String s = (String) x; Object[] out = new Object[s.length()];
            for (int i = 0; i < s.length(); i++) out[i] = String.valueOf(s.charAt(i)); return out; });
        // the EMPTY atom passes through and answers "F" — js, python and all
        // three engine kernels do that; charAt(0) alone refused it here.
        // charup is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // chardown is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // charisup is CANON -- range test over 1 . chars. Deleted here.
        // charislow is CANON -- range test over 1 . chars. Deleted here.
        // charisdigit is CANON -- range test over 1 . chars. Deleted here.
        // escape_html is CANON -- char fold over chars/implode. Deleted here.
        // policy-free: <prefix, s> -> tail-or-s (parity-ledger 2026-07-08). At
        // pre.equals(t) the answer is "", not t — no strictly-longer guard.
        // strip_prefix is CANON -- DEF("strip_prefix"). Deleted here.
        // ntoa is CANON -- DEF("ntoa"). Deleted here.
        // quote_str is CANON -- DEF("quote_str"). Deleted here.
        PRIMS.put("1r", x -> { Object[] a = seq(x); return a[a.length - 1]; });
        PRIMS.put("tlr", x -> { Object[] a = seq(x); Object[] r = new Object[a.length - 1];
            System.arraycopy(a, 0, r, 0, r.length); return r; });
    }

    public static Object Ev(Object f, Object x) {
        if (f instanceof Integer) {
            int n = (Integer) f;
            if (!(x instanceof Object[])) throw new RuntimeException("selector " + n + " on atom: " + x);
            return ((Object[]) x)[n - 1]; // out of range throws natively, as in C#
        }
        if (f instanceof String) {
            String fn = (String) f;
            Object body = DEFS.get(fn);
            if (body != null) {
                Function<Object, Object> fp = FASTPRIMS.get(fn);
                if (fp != null) return fp.apply(x);
                if (!memoable(fn)) return Ev(body, x);
                Map<Object, Object> node = EVMEMO.get(fn);
                if (node == null) { node = new HashMap<Object, Object>(); EVMEMO.put(fn, node); }
                Object[] chain;
                if (x instanceof Object[] && ((Object[]) x).length <= 4) {
                    Object[] xs = (Object[]) x;
                    chain = new Object[xs.length + 1];
                    chain[0] = Integer.valueOf(xs.length);
                    System.arraycopy(xs, 0, chain, 1, xs.length);
                } else {
                    chain = new Object[] { Integer.valueOf(-1), x };
                }
                for (int i = 0; i < chain.length - 1; i++) {
                    Object nn = node.get(chain[i]);
                    if (nn == null) { nn = new HashMap<Object, Object>(); node.put(chain[i], nn); }
                    @SuppressWarnings("unchecked")
                    Map<Object, Object> step = (Map<Object, Object>) nn;
                    node = step;
                }
                Object last = chain[chain.length - 1];
                if (node.containsKey(last)) return node.get(last);
                Object v = Ev(body, x);
                node.put(last, v);
                if (++EVMEMON > 400000) memoClear();
                return v;
            }
            Function<Object, Object> prim = PRIMS.get(f);
            if (prim != null) return prim.apply(x);
            throw new RuntimeException("unresolved atom: " + f);
        }
        Object[] form = seq(f);
        String head = form[0] instanceof String ? (String) form[0] : null;
        // tau clause (c): METACOMPOSITION (Backus 13.3.2, 13.4).
        //     (rho <x1..xn>):y = (rho x1):<<x1..xn>, y>
        // FETCH the head, do not MATCH it. Matching is what made the combining
        // forms host code by construction: DEF("CONS", ...) was unreachable
        // because the chain below intercepted before any lookup. That is an FP
        // system with a fixed form set (13.1), not FFP, where metacomposition
        // "permits the definition of new functional forms, in effect, merely by
        // defining new functions" (13.3.2) -- the mechanism the paper calls
        // "the only mechanism in the paper". The chain below is now the
        // PRIMITIVE ARM of this rule, reached only when canon does not define
        // the form, exactly as an atom in operator position already resolves
        // DEFS-then-prim a few lines above. A non-string head (a computed form)
        // takes the general path, which the chain could never express at all.
        if (head == null || DEFS.containsKey(head)) return Ev(form[0], new Object[]{ f, x });
        if ("COMP".equals(head)) {
            Object v = x;
            for (int i = form.length - 1; i >= 1; i--) v = Ev(form[i], v);
            return v;
        }
        // CONS and CONST are CANON now (Backus 13.3.2 verbatim) and reach this
        // host through tau clause (c) above. See the note in head.part.js.
        if ("COND".equals(head)) return "T".equals(Ev(form[1], x)) ? Ev(form[2], x) : Ev(form[3], x);
        if ("ALPHA".equals(head)) {
            Object[] xs = seq(x);
            Object[] out = new Object[xs.length];
            for (int i = 0; i < xs.length; i++) out[i] = Ev(form[1], xs[i]);
            return out;
        }
        if ("INSERT".equals(head)) {
            Object[] xs = seq(x);
            Object acc = xs[xs.length - 1];
            for (int i = xs.length - 2; i >= 0; i--) acc = Ev(form[1], new Object[] { xs[i], acc });
            return acc;
        }
        if ("WHILE".equals(head)) {
            Object v = x;
            while ("T".equals(Ev(form[1], v))) v = Ev(form[2], v);
            return v;
        }
        throw new RuntimeException("unknown form: " + head);
    }
}
