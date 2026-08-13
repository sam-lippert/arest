// The FFP reducer, mirroring python/delta.py (the semantics of record; every
// host held equal by the cross-host differential). Values: String/Long/Double/
// Boolean atoms, Object[] sequences, BOT the bottom sentinel, APP heading an
// application node. Metacomposition is the only mechanism; comparators and
// arithmetic coerce int-first then float; equality stays NATEQ (same type and
// equal, so 1 never equals 1.0). Java 8 idiom throughout.
package arest;

import java.util.HashMap;
import java.util.Map;

public class Reducer {
    public static final Object BOT = new Object() {
        @Override public String toString() { return "⊥"; }
    };
    static final Object APP = new Object();
    static final Object T = "T";
    static final Object F = "F";

    public static final Map<String, Object> STORE = new HashMap<String, Object>();

    public static void loadCanon() {
        // same-bytes native execution: CanonLoader compiles the raw
        // shared/arest.canon bytes in memory via javax.tools, no JSON store
        STORE.clear();
        for (Object[] kv : CanonLoader.loadAll())
            STORE.put((String) kv[0], kv[1]);
    }

    public static Object app(Object f, Object x) {
        return new Object[] { APP, f, x };
    }

    static boolean isSeq(Object o) { return o instanceof Object[]; }

    static Object mkSeq(Object[] items) {
        for (Object i : items) if (i == BOT) return BOT;
        return items;
    }

    // stage-1 field extraction (spec D5, the 2026-07-07 ruling — a
    // performant implementation proven to the interface; a canonical
    // composition is not owed at the boundary). Mirrors the
    // Python/Rust/C# twins: quoted spans blank length-preserving,
    // vocabulary hits case-insensitive with no letter adjacent
    // (longest literal first, stable), a Trailing Marker must trail,
    // nouns case-sensitive, the FIRST quoted content is the Literal
    // Role, the first structural mark is the prose tell.
    static String s1BlankQuotes(String s) {
        char[] out = s.toCharArray();
        int open = -1;
        for (int i = 0; i < out.length; i++) {
            if (out[i] == '\'') {
                if (open < 0) { open = i; }
                else { for (int j = open; j <= i; j++) out[j] = ' '; open = -1; }
            }
        }
        return new String(out);
    }

    static boolean s1Letter(char c) {
        return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
    }

    static boolean s1WordHit(String hay, String needle, boolean ci) {
        int n = needle.length();
        if (n == 0 || hay.length() < n) return false;
        for (int s = 0; s + n <= hay.length(); s++) {
            boolean hit = true;
            for (int k = 0; k < n; k++) {
                char a = hay.charAt(s + k), b = needle.charAt(k);
                if (ci) { a = Character.toLowerCase(a); b = Character.toLowerCase(b); }
                if (a != b) { hit = false; break; }
            }
            if (!hit) continue;
            boolean beforeOk = s == 0 || !s1Letter(hay.charAt(s - 1));
            int e = s + n;
            boolean afterOk = e >= hay.length() || !s1Letter(hay.charAt(e));
            if (beforeOk && afterOk) return true;
        }
        return false;
    }

    static java.util.List<String[]> stage1Rows(String text, java.util.List<String[]> vocab,
                                               java.util.List<String> nouns, String sid) {
        String trimmed = text.trim();
        int end = trimmed.length();
        while (end > 0 && trimmed.charAt(end - 1) == '.') end--;
        trimmed = trimmed.substring(0, end);
        String bare = s1BlankQuotes(trimmed);
        java.util.List<String[]> out = new java.util.ArrayList<>();
        java.util.List<String[]> order = new java.util.ArrayList<>(vocab);
        order.sort((a, b) -> b[1].length() - a[1].length());  // stable
        for (String[] p : order) {
            if (!s1WordHit(bare, p[1], true)) continue;
            if (p[0].equals("Statement_has_Trailing_Marker")
                    && !bare.replaceAll("\\s+$", "").toLowerCase()
                            .endsWith(p[1].toLowerCase())) continue;
            out.add(new String[]{p[0], sid, p[1]});
        }
        for (String nn : nouns) {
            if (s1WordHit(bare, nn, false))
                out.add(new String[]{"Statement_has_Role_Reference", sid, nn});
        }
        int open = -1;
        for (int i = 0; i < trimmed.length(); i++) {
            if (trimmed.charAt(i) == '\'') {
                if (open < 0) { open = i; }
                else {
                    out.add(new String[]{"Statement_has_Literal_Role", sid,
                                         trimmed.substring(open + 1, i)});
                    break;
                }
            }
        }
        for (String mark : new String[]{",", "(", ")", ": "}) {
            if (bare.contains(mark)) {
                out.add(new String[]{"Statement_has_Prose_Punctuation", sid, mark});
                break;
            }
        }
        return out;
    }

    /** The Register/Resolve slot for apply-to-all: a target registers
     *  a strategy (GPU, distributed) and the ALPHA branch resolves it
     *  before the built-in parallel default. */
    public interface AlphaStrategy { Object map(Object[] o); }
    static volatile AlphaStrategy ALPHA_OVERRIDE = null;
    public static void registerAlpha(AlphaStrategy s) { ALPHA_OVERRIDE = s; }

    static boolean eqObj(Object a, Object b) {
        if (isSeq(a) && isSeq(b)) {
            Object[] sa = (Object[]) a, sb = (Object[]) b;
            if (sa.length != sb.length) return false;
            for (int i = 0; i < sa.length; i++)
                if (!eqObj(sa[i], sb[i])) return false;
            return true;
        }
        if (isSeq(a) || isSeq(b)) return false;
        return a.getClass() == b.getClass() && a.equals(b);
    }

    static Long toInt(Object x) {
        if (x instanceof Long) return (Long) x;
        if (x instanceof String) {
            try { return Long.parseLong(((String) x).trim()); }
            catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    static Double toNum(Object x) {
        if (x instanceof Boolean) return null;
        if (x instanceof Long) return ((Long) x).doubleValue();
        if (x instanceof Double) return (Double) x;
        if (x instanceof String) {
            try { return Double.parseDouble(((String) x).trim()); }
            catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    interface LongOp { long f(long a, long b); }
    interface DblOp { double f(double a, double b); }

    static Object arith(Object a, Object b, LongOp fi, DblOp fd) {
        Long ia = toInt(a), ib = toInt(b);
        if (ia != null && ib != null) return fi.f(ia, ib);
        Double na = toNum(a), nb = toNum(b);
        if (na != null && nb != null) return fd.f(na, nb);
        return BOT;
    }

    interface DblRel { boolean f(double a, double b); }
    interface StrRel { boolean f(String a, String b); }

    static Object cmp(Object a, Object b, DblRel rel, StrRel rels) {
        if (isSeq(a) || isSeq(b)) return BOT;
        // COERCE FIRST. The store carries LEXICAL atoms — test_polyglot pins
        // (4997, "11000") as "mixed int/lexical (claude's totals)" and
        // ("9","10") as "comparators COERCE" — so a numeric-looking string is
        // a number here, as it is to + and kin. #31 normalises value-typed
        // fillers at the READING boundary only; it does not govern every path
        // into the store, which is why the base still coerces.
        Double na = toNum(a), nb = toNum(b);
        if (na != null && nb != null) return rel.f(na, nb) ? T : F;
        if (a instanceof String && b instanceof String)
            return rels.f((String) a, (String) b) ? T : F;
        return BOT;
    }

    public static Object mu(Object e) {
        while (true) {
            if (e instanceof Object[]) {
                Object[] node = (Object[]) e;
                if (node.length == 3 && node[0] == APP) {
                    Object f = mu(node[1]);
                    Object x = mu(node[2]);
                    if (f == BOT || x == BOT) return BOT;
                    if (f instanceof Object[]) {
                        Object[] seq = (Object[]) f;
                        if (seq.length == 0) return BOT;
                        e = app(seq[0], new Object[] { seq, x });
                        continue;
                    }
                    if (f instanceof Long) {
                        long sel = (Long) f;
                        if (x instanceof Object[] && sel >= 1
                                && ((Object[]) x).length >= sel)
                            return ((Object[]) x)[(int) sel - 1];
                        return BOT;
                    }
                    if (f instanceof String) {
                        Object[] r = prim((String) f, x);
                        if (r != null) {
                            if (r[0] == Boolean.TRUE) { e = r[1]; continue; }
                            return r[1];
                        }
                        Object impl = STORE.get(f);
                        if (impl != null) { e = app(impl, x); continue; }
                        return BOT;
                    }
                    return BOT;
                }
            }
            return e;
        }
    }

    // Answer null = not a prim (fall to defs); else {isExpr, value}.
    static Object[] val(Object v) { return new Object[] { Boolean.FALSE, v }; }
    static Object[] expr(Object v) { return new Object[] { Boolean.TRUE, v }; }

    static Object[] prim(String name, Object x) {
        Object[] o = (x instanceof Object[]) ? (Object[]) x : null;
        if (name.equals("COMP")) {
            Object[] whole = (Object[]) o[0];
            Object acc = o[1];
            for (int i = whole.length - 1; i >= 1; i--) acc = app(whole[i], acc);
            return expr(acc);
        }
        // CONS is CANON -- Backus 13.3.2. Deleted here.
        // CONST is CANON -- Backus 13.3.2. Deleted here.
        if (name.equals("COND")) {
            Object[] whole = (Object[]) o[0];
            if (whole.length < 4) return val(BOT);
            Object pv = mu(app(whole[1], o[1]));
            if (T.equals(pv)) return expr(app(whole[2], o[1]));
            if (F.equals(pv)) return expr(app(whole[3], o[1]));
            return val(BOT);
        }
        if (name.equals("ALPHA")) {
            // Backus's apply-to-all through Register/Resolve (the
            // MonoCross MXContainer pattern): the registered instance
            // resolves first, the built-in data-parallel map is the
            // default (independent pure reductions over immutable terms
            // and a read-only STORE, common pool past a threshold,
            // order preserved by indexing), the sequential loop is the
            // structural fallback. Mirrors the python/C# registries.
            if (ALPHA_OVERRIDE != null) return val(ALPHA_OVERRIDE.map(o));
            Object[] whole = (Object[]) o[0];
            if (whole.length < 2 || !isSeq(o[1])) return val(BOT);
            Object[] xs = (Object[]) o[1];
            Object[] out = new Object[xs.length];
            if (xs.length >= 8) {
                final Object f = whole[1];
                java.util.stream.IntStream.range(0, xs.length).parallel()
                    .forEach(i -> out[i] = mu(app(f, xs[i])));
            } else {
                for (int i = 0; i < xs.length; i++)
                    out[i] = mu(app(whole[1], xs[i]));
            }
            return val(mkSeq(out));
        }
        if (name.equals("INSERT")) {
            Object[] whole = (Object[]) o[0];
            if (whole.length < 2 || !isSeq(o[1])) return val(BOT);
            Object[] xs = (Object[]) o[1];
            if (xs.length == 0) return val(BOT);
            Object acc = xs[xs.length - 1];
            for (int i = xs.length - 2; i >= 0; i--)
                acc = mu(app(whole[1], mkSeq(new Object[] { xs[i], acc })));
            return val(acc);
        }
        if (name.equals("WHILE")) {
            Object[] whole = (Object[]) o[0];
            if (whole.length < 3) return val(BOT);
            Object arg = o[1];
            while (true) {
                Object pv = mu(app(whole[1], arg));
                if (F.equals(pv)) return val(arg);
                if (!T.equals(pv)) return val(BOT);
                arg = mu(app(whole[2], arg));
            }
        }
        if (name.equals("BU")) {
            Object[] whole = (Object[]) o[0];
            if (whole.length < 3) return val(BOT);
            return expr(app(whole[1], new Object[] { whole[2], o[1] }));
        }
        if (name.equals("id")) return val(x);
        if (name.equals("tl")) {
            if (!isSeq(x) || ((Object[]) x).length < 1) return val(BOT);
            Object[] s = (Object[]) x;
            Object[] out = new Object[s.length - 1];
            System.arraycopy(s, 1, out, 0, out.length);
            return val(out);
        }
        if (name.equals("atom")) {
            if (x == BOT) return val(BOT);
            return val(isSeq(x) && ((Object[]) x).length > 0 ? F : T);
        }
        if (name.equals("null")) {
            if (x == BOT) return val(BOT);
            return val(isSeq(x) && ((Object[]) x).length == 0 ? T : F);
        }
        if (name.equals("eq"))
            return val(o != null && o.length == 2 ? (eqObj(o[0], o[1]) ? T : F) : BOT);
        // cellkey is CANON -- DEF("cellkey"). Deleted here.
        // ---- the char/format base. Absent from this host, engine/csharp and
        // engine/rust while python and all four stations had them, so every
        // canon def that spells a word — lex:lw, lex:adjup, lex:tokens,
        // lex:camel, cn:pascalw, cn:otparts, ui:jname, ui:st, cn:hyph,
        // cn:number, rmap:fkrows:derive — answered BOTTOM here: canon held
        // defs this host could not reduce, the "/" finding over again.
        // FIRST CHARACTER, not whole-string — python and the java/cs/rust
        // stations all take charAt(0); only head.part.js compares the whole
        // string, so it is the outlier. ASCII by contract, so literal ranges.
        // The empty atom passes through and answers "F", matching python.
        if (name.equals("chars")) {
            if (!(x instanceof String)) return val(BOT);
            String cx = (String) x;
            Object[] cs = new Object[cx.length()];
            for (int i = 0; i < cx.length(); i++) cs[i] = String.valueOf(cx.charAt(i));
            return val(cs);
        }
        // charup is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // chardown is CANON -- literal alphabet relation (Codd 2.3.5). Deleted here.
        // charisup is CANON -- range test over 1 . chars. Deleted here.
        // charislow is CANON -- range test over 1 . chars. Deleted here.
        // charisdigit is CANON -- range test over 1 . chars. Deleted here.
        // ntoa is CANON -- DEF("ntoa"). Deleted here.
        // quote_str is CANON -- DEF("quote_str"). Deleted here.
        // escape_html is CANON -- char fold over chars/implode. Deleted here.
        if (name.equals("stage1_fields")) {
            // stage-1 at the lex boundary (spec D5); text and sid must be
            // strings exactly as the python twin checks.
            if (o == null || o.length != 4) return val(BOT);
            if (!(o[0] instanceof String) || !(o[3] instanceof String))
                return val(BOT);
            String text = (String) o[0], sid = (String) o[3];
            java.util.List<String[]> vocab = new java.util.ArrayList<>();
            if (o[1] instanceof Object[]) {
                for (Object p : (Object[]) o[1]) {
                    if (p instanceof Object[]) {
                        Object[] pi = (Object[]) p;
                        if (pi.length >= 2) {
                            String a = pi[0] instanceof String ? (String) pi[0]
                                     : pi[0] instanceof Long ? pi[0].toString() : null;
                            String b = pi[1] instanceof String ? (String) pi[1]
                                     : pi[1] instanceof Long ? pi[1].toString() : null;
                            if (a != null && b != null) vocab.add(new String[]{a, b});
                        }
                    }
                }
            }
            java.util.List<String> nouns = new java.util.ArrayList<>();
            if (o[2] instanceof Object[]) {
                for (Object nx : (Object[]) o[2]) {
                    String s = nx instanceof String ? (String) nx
                             : nx instanceof Long ? nx.toString() : null;
                    if (s == null) return val(BOT);
                    nouns.add(s);
                }
            }
            java.util.List<String[]> rows = stage1Rows(text, vocab, nouns, sid);
            Object[] outRows = new Object[rows.size()];
            for (int i = 0; i < rows.size(); i++) {
                String[] r = rows.get(i);
                outRows[i] = new Object[]{r[0], new Object[]{r[1], r[2]}};
            }
            return val(outRows);
        }
        // (render:json is CANON — DEF("render:json") with render:json_atom /
        // render:json_seq, beside system:show. The jsonValue helper above goes
        // with it; see the note in engine/python/engine.py.)
        // strip_prefix is CANON -- DEF("strip_prefix"). Deleted here.
        if (name.equals("skolem")) {
            // The skolem boundary op (task-970, spec D5 beside cellkey): an
            // existential head's fresh id as a PURE function of its frontier —
            // "ve_" + fnv1a64 hex of the values joined by '|'. str/int atoms
            // only; empty or non-sequence input bottoms. Mirrors the
            // Python/Rust/C# twins; determinism is the idempotence crux.
            if (o == null || o.length == 0) return val(BOT);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < o.length; i++) {
                String v = o[i] instanceof String ? (String) o[i]
                         : o[i] instanceof Long ? o[i].toString() : null;
                if (v == null) return val(BOT);
                if (i > 0) sb.append('|');
                sb.append(v);
            }
            long h = -3750763034362895579L;              // fnv1a64 offset basis
            for (byte b : sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
                h ^= (b & 0xffL);
                h *= 1099511628211L;                     // fnv1a64 prime, wrapping
            }
            return val("ve_" + String.format("%016x", h));
        }
        if (name.equals("lex")) {
            // The tokenizer boundary (spec D5, beside cellkey): text to per-word
            // lexical records; the vocabulary matching above it is canonical
            // sequence algebra. Mirrors the Python/Rust/C# twins.
            String t = x instanceof String ? (String) x
                     : x instanceof Long ? x.toString() : null;
            return val(t == null ? BOT : lex(t));
        }
        if (name.equals("implode")) {
            if (o == null || o.length != 2 || !isSeq(o[1])) return val(BOT);
            String sep = o[0] instanceof String ? (String) o[0]
                       : o[0] instanceof Long ? o[0].toString() : null;
            if (sep == null) return val(BOT);
            Object[] ws = (Object[]) o[1];
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < ws.length; i++) {
                String v = ws[i] instanceof String ? (String) ws[i]
                         : ws[i] instanceof Long ? ws[i].toString() : null;
                if (v == null) return val(BOT);
                if (i > 0) sb.append(sep);
                sb.append(v);
            }
            return val(sb.toString());
        }
        // slug is CANON -- DEF("slug"). Deleted here.
        if (name.equals("apndl")) {
            if (o == null || o.length != 2 || !isSeq(o[1])) return val(BOT);
            Object[] ys = (Object[]) o[1];
            Object[] out = new Object[ys.length + 1];
            out[0] = o[0];
            System.arraycopy(ys, 0, out, 1, ys.length);
            return val(out);
        }
        if (name.equals("apndr")) {
            if (o == null || o.length != 2 || !isSeq(o[0])) return val(BOT);
            Object[] ys = (Object[]) o[0];
            Object[] out = new Object[ys.length + 1];
            System.arraycopy(ys, 0, out, 0, ys.length);
            out[ys.length] = o[1];
            return val(out);
        }
        if (name.equals("distl")) {
            if (o == null || o.length != 2 || !isSeq(o[1])) return val(BOT);
            Object[] ys = (Object[]) o[1];
            Object[] out = new Object[ys.length];
            for (int i = 0; i < ys.length; i++)
                out[i] = new Object[] { o[0], ys[i] };
            return val(out);
        }
        if (name.equals("distr")) {
            if (o == null || o.length != 2 || !isSeq(o[0])) return val(BOT);
            Object[] xs = (Object[]) o[0];
            Object[] out = new Object[xs.length];
            for (int i = 0; i < xs.length; i++)
                out[i] = new Object[] { xs[i], o[1] };
            return val(out);
        }
        if (name.equals("length"))
            return val(isSeq(x) ? Long.valueOf(((Object[]) x).length) : BOT);
        if (name.equals("reverse")) {
            if (!isSeq(x)) return val(BOT);
            Object[] s = (Object[]) x;
            Object[] out = new Object[s.length];
            for (int i = 0; i < s.length; i++) out[i] = s[s.length - 1 - i];
            return val(out);
        }
        if (name.equals("cat")) {
            if (o == null || o.length != 2 || !isSeq(o[0]) || !isSeq(o[1]))
                return val(BOT);
            Object[] a = (Object[]) o[0], b = (Object[]) o[1];
            Object[] out = new Object[a.length + b.length];
            System.arraycopy(a, 0, out, 0, a.length);
            System.arraycopy(b, 0, out, a.length, b.length);
            return val(out);
        }
        if (name.equals("not"))
            return val(T.equals(x) ? F : (F.equals(x) ? T : BOT));
        // or is CANON -- DEF("or"), strict per Backus 11.2.3. Deleted here.
        if (name.equals("and")) {
            if (o == null || o.length != 2) return val(BOT);
            boolean ta = T.equals(o[0]), fa = F.equals(o[0]);
            boolean tb = T.equals(o[1]), fb = F.equals(o[1]);
            if (!(ta || fa) || !(tb || fb)) return val(BOT);
            boolean r = name.equals("and") ? (ta && tb) : (ta || tb);
            return val(r ? T : F);
        }
        if (name.equals("1r")) {
            if (!isSeq(x) || ((Object[]) x).length < 1) return val(BOT);
            Object[] s = (Object[]) x;
            return val(s[s.length - 1]);
        }
        if (name.equals("tlr")) {
            if (!isSeq(x) || ((Object[]) x).length < 1) return val(BOT);
            Object[] s = (Object[]) x;
            Object[] out = new Object[s.length - 1];
            System.arraycopy(s, 0, out, 0, out.length);
            return val(out);
        }
        // rotl/rotr are CANON -- DEF("rotl"), DEF("rotr"). Deleted here.
        if (name.equals("trans")) {
            if (!isSeq(x)) return val(BOT);
            Object[] rows = (Object[]) x;
            for (Object r : rows) if (!isSeq(r)) return val(BOT);
            if (rows.length == 0) return val(new Object[0]);
            int w = ((Object[]) rows[0]).length;
            for (Object r : rows) if (((Object[]) r).length != w) return val(BOT);
            Object[] out = new Object[w];
            for (int i = 0; i < w; i++) {
                Object[] col = new Object[rows.length];
                for (int j = 0; j < rows.length; j++)
                    col[j] = ((Object[]) rows[j])[i];
                out[i] = col;
            }
            return val(out);
        }
        if (name.equals("+")) return val(o != null && o.length == 2
            ? arith(o[0], o[1], new LongOp() { public long f(long a, long b) { return a + b; } },
                    new DblOp() { public double f(double a, double b) { return a + b; } }) : BOT);
        if (name.equals("-")) return val(o != null && o.length == 2
            ? arith(o[0], o[1], new LongOp() { public long f(long a, long b) { return a - b; } },
                    new DblOp() { public double f(double a, double b) { return a - b; } }) : BOT);
        if (name.equals("*")) return val(o != null && o.length == 2
            ? arith(o[0], o[1], new LongOp() { public long f(long a, long b) { return a * b; } },
                    new DblOp() { public double f(double a, double b) { return a * b; } }) : BOT);
        // "/" not "div", and INTEGER division truncating toward zero. Two
        // lineages had drifted apart: the engine hosts mirrored python's true
        // division (engine/rust even says "// Python / is float") while the
        // stations mirrored Arest.java's Integer arithmetic — and because
        // canon spelled it "div" here and "/" there, the two were never
        // compared. The atom domain has no float: canon, design-state and
        // norma-answer hold zero float literals.
        if (name.equals("/")) {
            if (o == null || o.length != 2) return val(BOT);
            if (o[0] instanceof String || o[1] instanceof String) return val(BOT);
            Double na = toNum(o[0]), nb = toNum(o[1]);
            if (na != null && nb != null && nb != 0) return val((long) (na / nb));
            return val(BOT);
        }
        if (name.equals("ge")) return val(o != null && o.length == 2
            ? cmp(o[0], o[1], new DblRel() { public boolean f(double a, double b) { return a >= b; } },
                  new StrRel() { public boolean f(String a, String b) { return a.compareTo(b) >= 0; } }) : BOT);
        if (name.equals("gt")) return val(o != null && o.length == 2
            ? cmp(o[0], o[1], new DblRel() { public boolean f(double a, double b) { return a > b; } },
                  new StrRel() { public boolean f(String a, String b) { return a.compareTo(b) > 0; } }) : BOT);
        if (name.equals("le")) return val(o != null && o.length == 2
            ? cmp(o[0], o[1], new DblRel() { public boolean f(double a, double b) { return a <= b; } },
                  new StrRel() { public boolean f(String a, String b) { return a.compareTo(b) <= 0; } }) : BOT);
        if (name.equals("lt")) return val(o != null && o.length == 2
            ? cmp(o[0], o[1], new DblRel() { public boolean f(double a, double b) { return a < b; } },
                  new StrRel() { public boolean f(String a, String b) { return a.compareTo(b) < 0; } }) : BOT);
        if (name.equals("apply")) {
            if (o == null || o.length != 2) return val(BOT);
            return expr(app(o[0], o[1]));
        }
        return null;
    }

    // the tokenizer boundary's lexer, mirroring python/engine.py _lex_impl and
    // the rust lex_rows exactly: per-word lexical attributes, quote spans
    // character-wise, no grammar knowledge
    static Object[] lex(String text) {
        java.util.List<int[]> spans = new java.util.ArrayList<int[]>();
        int open = -1;
        for (int i = 0; i < text.length(); i++)
            if (text.charAt(i) == '\'') {
                if (open < 0) open = i;
                else { spans.add(new int[]{open, i + 1}); open = -1; }
            }
        java.util.List<Object> rows = new java.util.ArrayList<Object>();
        int p = 0;
        while (p < text.length()) {
            if (Character.isWhitespace(text.charAt(p))) { p++; continue; }
            int s = p;
            while (p < text.length() && !Character.isWhitespace(text.charAt(p))) p++;
            int e = p;
            String tok = text.substring(s, e);
            int k = 0;
            for (int i = 0; i < spans.size(); i++)
                if (s < spans.get(i)[1] && spans.get(i)[0] < e) { k = i + 1; break; }
            String qtext = "";
            if (k > 0) {
                int a = spans.get(k - 1)[0], b = spans.get(k - 1)[1];
                int lo = Math.max(s, a + 1), hi = Math.min(e, b - 1);
                if (lo < hi) qtext = text.substring(lo, hi);
            }
            int st = 0, en = tok.length();
            while (st < en && ".;:,".indexOf(tok.charAt(st)) >= 0) st++;
            while (en > st && ".;:,".indexOf(tok.charAt(en - 1)) >= 0) en--;
            String nopunct = tok.substring(st, en);
            int bl = nopunct.length();
            while (bl > 0 && nopunct.charAt(bl - 1) >= '0' && nopunct.charAt(bl - 1) <= '9') bl--;
            String base = nopunct.substring(0, bl);
            String title = base.length() > 0 && Character.isUpperCase(base.charAt(0)) ? "T" : "F";
            rows.add(new Object[]{
                tok, nopunct, base, nopunct.substring(bl),
                tok.toLowerCase(java.util.Locale.ROOT), qtext, title,
                hyphenTpl(tok),
                k > 0 ? "T" : "F", Long.valueOf(k),
            });
        }
        return rows.toArray();
    }

    // a token's TEMPLATE form under NORMA hyphen binding (#24, lex field 8 —
    // mirrors python engine.py _lex_impl / rust hyphen_tpl): a one-sided
    // touching hyphen is the bind marker and is consumed ('adj-'/'-adj' ->
    // the word), the doubled hyphen escapes to one literal hyphen
    // ('FORE--'->'FORE-', '--W'->'-W'), anything else (incl. the retired
    // touching bind 'from-Status') is as written.
    static String hyphenTpl(String tok) {
        int n = tok.length();
        if (n > 2 && tok.endsWith("--")) return tok.substring(0, n - 1);
        if (n > 2 && tok.startsWith("--")) return tok.substring(1);
        if (n > 1 && tok.endsWith("-") && !tok.endsWith("--")) return tok.substring(0, n - 1);
        if (n > 1 && tok.startsWith("-") && !tok.startsWith("--")) return tok.substring(1);
        return tok;
    }

    // slug helper deleted: slug is CANON, this had no callers.
}
