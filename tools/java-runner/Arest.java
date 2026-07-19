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
    public static final Map<String, Object> DEFS = new HashMap<String, Object>();
    public static final List<Object> CELLS = new ArrayList<Object>();

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
        PRIMS.put("le", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) <= 0); });
        PRIMS.put("ge", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) >= 0); });
        PRIMS.put("gt", x -> { Object[] p = seq(x); return bool(cmpAtoms(p[0], p[1]) > 0); });
        PRIMS.put("+", x -> { Object[] p = seq(x); return Integer.valueOf((Integer) p[0] + (Integer) p[1]); });
        PRIMS.put("apply", x -> { Object[] p = seq(x); return Ev(p[0], p[1]); });
        PRIMS.put("lex", x -> { String s = ((String) x).trim();
            if (s.isEmpty()) return new Object[0];
            return (Object[]) s.split("\\s+"); });
        PRIMS.put("implode", x -> { Object[] p = seq(x); String sep = (String) p[0]; Object[] parts = seq(p[1]);
            // atoms stringify (numbers included) — js Array.join semantics;
            // a (String) cast here would diverge from the certified js head
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < parts.length; i++) { if (i > 0) sb.append(sep); sb.append(String.valueOf(parts[i])); }
            return sb.toString(); });
        PRIMS.put("slug", x -> { String s = ((String) x).toLowerCase(java.util.Locale.ROOT);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); i++) { char c = s.charAt(i); if (Character.isLetterOrDigit(c)) sb.append(c); }
            return sb.toString(); });
        PRIMS.put("escape_html", x -> ((String) x).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"));
        PRIMS.put("strip_prefix", x -> { Object[] p = seq(x); String pre = (String) p[0]; String t = (String) p[1];
            return (t.length() > pre.length() && t.startsWith(pre)) ? t.substring(pre.length()) : t; });
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
            Object body = DEFS.get(f);
            if (body != null) return Ev(body, x);
            Function<Object, Object> prim = PRIMS.get(f);
            if (prim != null) return prim.apply(x);
            throw new RuntimeException("unresolved atom: " + f);
        }
        Object[] form = seq(f);
        String head = form[0] instanceof String ? (String) form[0] : null;
        if ("COMP".equals(head)) {
            Object v = x;
            for (int i = form.length - 1; i >= 1; i--) v = Ev(form[i], v);
            return v;
        }
        if ("CONS".equals(head)) {
            Object[] out = new Object[form.length - 1];
            for (int i = 1; i < form.length; i++) out[i - 1] = Ev(form[i], x);
            return out;
        }
        if ("CONST".equals(head)) return form[1];
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
