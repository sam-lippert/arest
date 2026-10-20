import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

// ============================ the lambda READER ================================
// The lambda, the case table and the carriers READ AT RUNTIME, replacing
// compose.py's generated Composed.g.java.
//
// That generator exists because the JVM caps a method at 64 KB and the lambda is
// one 1.1 MB tuple literal, so it split the tuple at top-level commas into
// slice methods and hoisted oversized subexpressions into helpers. It is
// syntax-only and every lambda byte appears verbatim -- an honest program, and
// 2.16 MB of generated source that javac had to compile on every lambda edit.
//
// A parser has no method-size problem. This is the same reader engine/rust and
// rust-station now carry, in this platform's terms: A is a String, N an
// Long, PHI an empty Object[], K an Object[]{"CONST", x}, and SN an
// Object[]. Same grammar, same four names, same order.
//
//     file := '(' item* ')'
//     item := note | def
//     def  := 'DEF' '(' STRING ',' expr ')' ','?
//     expr := A(STRING) | N(INT) | K(expr) | PHI() | S(expr,..) | S1..S9(..)
//
// S is VARIADIC in the carriers, which compose.py rewrote per host; arest and
// the case table use only S1..S9. Both are accepted here.
public final class Reader {
    private final byte[] b;
    private int i;
    private String def = "";
    private final List<String> arity = new ArrayList<>();

    private Reader(byte[] src) {
        this.b = src;
        this.i = 0;
    }

    private void ws() {
        while (i < b.length && Character.isWhitespace((char) b[i])) i++;
    }

    private boolean eat(String s) {
        ws();
        byte[] t = s.getBytes(StandardCharsets.UTF_8);
        if (i + t.length > b.length) return false;
        for (int k = 0; k < t.length; k++) if (b[i + k] != t[k]) return false;
        i += t.length;
        return true;
    }

    private String string() {
        ws();
        if (i >= b.length || b[i] != '"') return null;
        i++;
        StringBuilder out = new StringBuilder();
        while (i < b.length) {
            byte c = b[i];
            if (c == '\\' && i + 1 < b.length) {
                // the escapes the base uses: quotes, newlines, backslashes, CRs
                // and one \x1f (derive:txn_surrogate's unit separator)
                byte e = b[i + 1];
                i += 2;
                switch (e) {
                    case 'n': out.append('\n'); break;
                    case 'r': out.append('\r'); break;
                    case 't': out.append('\t'); break;
                    case '0': out.append('\0'); break;
                    // a UTF-16 unit in four hex digits, as every host's string literal reads it
                    // (quote_str:ctls names the control characters so)
                    case 'u':
                        if (i + 3 < b.length) {
                            try {
                                out.append((char) Integer.parseInt(new String(b, i, 4, StandardCharsets.UTF_8), 16));
                                i += 4;
                                break;
                            } catch (NumberFormatException ignored) { }
                        }
                        out.append('u');
                        break;
                    case 'x':
                        if (i + 1 < b.length) {
                            String h = new String(b, i, 2, StandardCharsets.UTF_8);
                            try {
                                out.append((char) Integer.parseInt(h, 16));
                                i += 2;
                            } catch (NumberFormatException ignored) { }
                        }
                        break;
                    default: out.append((char) e);
                }
                continue;
            }
            if (c == '"') {
                i++;
                return out.toString();
            }
            int len = 1;
            if ((c & 0x80) != 0) {
                if ((c & 0xE0) == 0xC0) len = 2;
                else if ((c & 0xF0) == 0xE0) len = 3;
                else if ((c & 0xF8) == 0xF0) len = 4;
            }
            out.append(new String(b, i, Math.min(len, b.length - i), StandardCharsets.UTF_8));
            i += len;
        }
        return null;
    }

    // what the grammar wanted where the text does not give it: fatal, since a form read as null is a
    // different program in this host from the one every other host reads
    private RuntimeException malformed(String wanted) {
        return new RuntimeException("lambda reader: " + wanted + " in " + def + " at byte " + i + ": "
            + new String(b, i, Math.min(60, b.length - i), StandardCharsets.UTF_8));
    }

    private void close() { if (!eat(")")) throw malformed("a closing paren"); }

    private Object expr() {
        ws();
        if (eat("PHI(")) { close(); return Arest.PHI(); }
        if (eat("A(")) { String s = string(); if (s == null) throw malformed("a string"); close(); return Arest.A(s); }
        if (eat("N(")) {
            ws();
            int st = i;
            if (i < b.length && b[i] == '-') i++;
            while (i < b.length && b[i] >= '0' && b[i] <= '9') i++;
            long n = Long.parseLong(new String(b, st, i - st, StandardCharsets.UTF_8));
            close();
            return Arest.N(n);
        }
        if (eat("K(")) {
            int at = i - 2;
            Object x = expr();
            if (!eat(")")) {
                int n = 1;
                while (eat(",")) { expr(); n++; }
                eat(")");
                arity.add("K with " + n + " elements in " + def + " at byte " + at);
            }
            return Arest.K(x);
        }
        ws();
        if (i + 1 < b.length && b[i] == 'S') {
            int argc = -1, skip = 0;
            if (b[i + 1] == '(') { argc = -2; skip = 2; }                 // variadic
            else if (i + 2 < b.length && b[i + 1] >= '1' && b[i + 1] <= '9'
                     && b[i + 2] == '(') { argc = b[i + 1] - '0'; skip = 3; }
            if (argc != -1) {
                i += skip;
                int at = i - skip;
                List<Object> parts = new ArrayList<>();
                while (true) {
                    ws();
                    if (i < b.length && b[i] == ')') { i++; break; }
                    if (!parts.isEmpty() && !eat(",")) throw malformed("a comma or a closing paren");
                    parts.add(expr());
                }
                // Sn names a sequence of n elements; one written with another
                // count is a different object in every host that does not refuse it
                if (argc > 0 && parts.size() != argc)
                    arity.add("S" + argc + " with " + parts.size() + " elements in " + def + " at byte " + at);
                return parts.toArray();
            }
        }
        throw malformed("A, N, K, PHI or S");
    }

    // Read one file and register it, in file order. A file that is missing or
    // does not parse is FATAL, never skipped: a station that quietly registers
    // nothing answers <refused> to every case, which reads as silence rather
    // than as an error.
    public static void load(String path) {
        byte[] src;
        try {
            src = Files.readAllBytes(Paths.get(path));
        } catch (Exception e) {
            throw new RuntimeException("lambda reader: cannot read " + path + ": " + e);
        }
        each(src, path, Arest::DEF);
    }

    // A carrier's text to the <CELL, name, body> list DEF would have made of it,
    // registering nothing (carrier:cells).
    public static Object[] cells(String text) {
        List<Object> out = new ArrayList<>();
        each(text.getBytes(StandardCharsets.UTF_8), "carrier text",
             (name, body) -> out.add(new Object[] { "CELL", name, body }));
        return out.toArray();
    }

    private static void each(byte[] src, String what, java.util.function.BiConsumer<String, Object> def) {
        Reader p = new Reader(src);
        if (!p.eat("(")) throw new RuntimeException("lambda reader: " + what + " does not open with a paren");
        while (true) {
            p.ws();
            if (p.i >= p.b.length) throw new RuntimeException("lambda reader: " + what + " never closes its opening paren");
            // the file's one tuple closes once, at its end
            if (p.b[p.i] == ')') {
                p.i++;
                p.ws();
                if (p.i < p.b.length) throw new RuntimeException("lambda reader: " + what + " has text after its closing paren, at byte " + p.i);
                break;
            }
            if (p.b[p.i] == '"') { p.string(); p.eat(","); continue; }
            if (p.eat("DEF(")) {
                String name = p.string();
                if (!p.eat(",")) throw new RuntimeException("lambda reader: " + what + " bad DEF");
                p.def = name;
                Object body = p.expr();
                p.close();
                p.eat(",");
                def.accept(name, body);
                continue;
            }
            throw new RuntimeException("lambda reader: " + what + " is not the DEF grammar at byte " + p.i + ": "
                + new String(p.b, p.i, Math.min(80, p.b.length - p.i), StandardCharsets.UTF_8));
        }
        if (!p.arity.isEmpty())
            throw new RuntimeException("lambda reader: " + what + ": " + p.arity.size() + " constructors whose name is not their length:\n  "
                + String.join("\n  ", p.arity));
    }

    public static String path(String var, String dflt) {
        String v = System.getenv(var);
        return (v == null || v.isEmpty()) ? dflt : v;
    }

    // A CARRIERS DIRECTORY IS READ AS THE JS BUILD SPLICES IT (tools/js-runner/build.js), so a
    // station composes what the js host composes. design-state first; norma-answer where the
    // directory has one, which a directory lambda wrote (tools/carriers/base) does not; the
    // compiled relational map only when the stamp it carries is the hash of this design-state,
    // since a map built from an older schema describes tables that no longer exist and lambda
    // derives the map instead; and a run's record, outcome and expected, where there is one.
    // tools/norma-oracle, which Program and CasesTest read, was deleted on 2026-09-20 (#109).
    public static void loadCarriers(String dir) {
        java.nio.file.Path ds = Paths.get(dir, "design-state");
        load(ds.toString());
        if (Files.exists(Paths.get(dir, "norma-answer"))) load(Paths.get(dir, "norma-answer").toString());
        java.nio.file.Path compiled = Paths.get(dir, "compiled");
        if (Files.exists(compiled)) {
            try {
                String text = new String(Files.readAllBytes(compiled), StandardCharsets.UTF_8);
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("AREST_COMPILED_FROM=([0-9a-f]+)").matcher(text);
                String stamped = m.find() ? m.group(1) : "?";
                String now = sha256hex(Files.readAllBytes(ds)).substring(0, 16);
                if (stamped.equals(now)) load(compiled.toString());
                else System.err.println("compiled carrier is stale (built from " + stamped + ", design-state is now " + now + "); deriving instead");
            } catch (java.io.IOException e) {
                throw new RuntimeException("lambda reader: cannot read " + compiled + ": " + e);
            }
        }
        for (String record : new String[] { "outcome", "expected" })
            if (Files.exists(Paths.get(dir, record))) load(Paths.get(dir, record).toString());
    }

    static String sha256hex(byte[] bytes) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder s = new StringBuilder();
            for (byte x : d) s.append(String.format("%02x", x));
            return s.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
