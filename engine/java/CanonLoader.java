// Same-bytes native execution for the Java host. The spec: the compiler must
// tokenize the SAME raw shared/*.canon bytes CPython execs and rustc includes
// -- no bespoke reader, no generation artifact on disk. So the raw canon bytes
// are wrapped IN MEMORY in a Vocab-referencing class body and compiled by
// javax.tools; DEF's registration side effect populates Vocab.DEFS. No JSON,
// no Canon.g/Canon.java. Performance stays via registered overrides, never a
// JSON intermediate.
//
// The wrap is chunked: Java caps a single method at 64KB of BYTECODE, and a
// lone ~353-def loadArest() overflows (the old per-host gen_canon.py hit the
// same wall). arest.canon's top-level elements are sliced into CHUNK-sized
// T(...) calls; DEF's side effect makes the split invisible, exactly as the
// C# WrapCanon and Rust include! keep the element bytes verbatim.
package arest;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.FileObject;
import javax.tools.ForwardingJavaFileManager;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileManager;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;

public final class CanonLoader {

    // slice size; the heaviest pre-merge method (system, 223 defs) compiled,
    // so CHUNK carries ample margin under the 64KB bytecode ceiling
    static final int CHUNK = 40;

    static String sharedPath(String name) {
        String dir = System.getProperty("arest.shared", "../shared");
        // The canonical name "arest.canon" resolves to the REPO-ROOT canon,
        // matching python/canon.py's rule. engine/shared/arest.canon was the
        // predecessor: 360 defs in four namespaces, a strict subset of the
        // root canon's 1155 across twenty-four, abandoned 2026-07-14 when
        // development moved to the root file. Loading the fragment meant this
        // host and pyarest ran different canons under one name.
        if ("arest.canon".equals(name)) {
            return dir + "/../../arest";
        }
        return dir + "/" + name;
    }

    static String read(String name) {
        try {
            return new String(Files.readAllBytes(Paths.get(sharedPath(name))),
                              StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("cannot read " + sharedPath(name), e);
        }
    }

    /** Top-level element substrings of ONE canon tuple literal, split only at
     *  depth-0 commas outside double-quoted strings (\-escapes honoured). No
     *  element's bytes are altered; the outer parens become the T(...) call's.
     *  Mirrors gen_canon.py.top_level_elements and the C#/Rust wrap. */
    static List<String> topLevelElements(String text) {
        String s = text.trim();
        if (s.length() < 2 || s.charAt(0) != '(' || s.charAt(s.length() - 1) != ')') {
            throw new RuntimeException("not a tuple literal");
        }
        String inner = s.substring(1, s.length() - 1);
        List<String> elems = new ArrayList<String>();
        int depth = 0, start = 0;
        boolean instr = false, esc = false;
        for (int i = 0; i < inner.length(); i++) {
            char ch = inner.charAt(i);
            if (instr) {
                if (esc) esc = false;
                else if (ch == '\\') esc = true;
                else if (ch == '"') instr = false;
                continue;
            }
            if (ch == '"') instr = true;
            else if (ch == '(') depth++;
            else if (ch == ')') depth--;
            else if (ch == ',' && depth == 0) {
                elems.add(inner.substring(start, i));
                start = i + 1;
            }
        }
        elems.add(inner.substring(start));
        return elems;
    }

    /** The in-memory source: a CanonGen class whose loadArest()/loadScenarios()
     *  are chunked varargs calls over the raw canon element bytes. */
    static String genSource() {
        StringBuilder b = new StringBuilder();
        b.append("package arest;\n");
        b.append("import static arest.Vocab.*;\n");
        b.append("public final class CanonGen {\n");
        emitChunked(b, "loadArest", topLevelElements(read("arest.canon")));
        emitChunked(b, "loadScenarios", topLevelElements(read("scenarios.canon")));
        b.append("}\n");
        return b.toString();
    }

    static void emitChunked(StringBuilder b, String name, List<String> elems) {
        int n = elems.size();
        int chunks = (n + CHUNK - 1) / CHUNK;
        b.append("  public static void ").append(name).append("() {\n");
        for (int k = 0; k < chunks; k++) {
            b.append("    ").append(name).append("_").append(k).append("();\n");
        }
        b.append("  }\n");
        for (int k = 0; k < chunks; k++) {
            b.append("  static void ").append(name).append("_").append(k).append("() { T(");
            int lo = k * CHUNK, hi = Math.min(n, lo + CHUNK);
            for (int i = lo; i < hi; i++) {
                if (i > lo) b.append(",");
                b.append(elems.get(i));
            }
            b.append("); }\n");
        }
    }

    private static Class<?> gen;

    static Class<?> gen() {
        if (gen == null) {
            gen = compileGen(genSource());
        }
        return gen;
    }

    static Class<?> compileGen(String src) {
        JavaCompiler jc = ToolProvider.getSystemJavaCompiler();
        if (jc == null) {
            throw new RuntimeException(
                "no system Java compiler; the canon compiles in-memory and "
                + "needs a JDK (run java from the JDK, not a JRE)");
        }
        MemFileManager fm = new MemFileManager(
            jc.getStandardFileManager(null, null, StandardCharsets.UTF_8));
        List<String> opts = Arrays.asList(
            "-classpath", System.getProperty("java.class.path"));
        JavaFileObject unit = new StringSource("arest.CanonGen", src);
        DiagnosticCollector<JavaFileObject> diags =
            new DiagnosticCollector<JavaFileObject>();
        boolean ok = jc.getTask(null, fm, diags, opts, null,
                                Collections.singletonList(unit)).call();
        if (!ok) {
            StringBuilder e = new StringBuilder("canon in-memory compile failed:\n");
            for (Diagnostic<? extends JavaFileObject> d : diags.getDiagnostics()) {
                e.append(d).append("\n");
            }
            throw new RuntimeException(e.toString());
        }
        try {
            return fm.loader.loadClass("arest.CanonGen");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    static List<Object[]> loadVia(String method) {
        Vocab.DEFS.clear();
        try {
            gen().getMethod(method).invoke(null);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return new ArrayList<Object[]>(Vocab.DEFS);
    }

    /** The canon DEFs, in file order: pairs of name and term. */
    public static List<Object[]> loadAll() {
        return loadVia("loadArest");
    }

    /** The cross-host scenario cases, same shape. */
    public static List<Object[]> loadScenarioDefs() {
        return loadVia("loadScenarios");
    }

    // ---- javax.tools in-memory plumbing: a String source unit, a byte-buffer
    // class output, a loader over those buffers, and a file manager that wires
    // compiler output into the loader ----

    static final class StringSource extends SimpleJavaFileObject {
        private final String code;
        StringSource(String className, String code) {
            super(URI.create("string:///" + className.replace('.', '/')
                             + Kind.SOURCE.extension), Kind.SOURCE);
            this.code = code;
        }
        @Override public CharSequence getCharContent(boolean ignoreEncodingErrors) {
            return code;
        }
    }

    static final class MemClass extends SimpleJavaFileObject {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        MemClass(String className) {
            super(URI.create("mem:///" + className.replace('.', '/')
                             + Kind.CLASS.extension), Kind.CLASS);
        }
        @Override public OutputStream openOutputStream() { return bytes; }
    }

    static final class MemLoader extends ClassLoader {
        final Map<String, MemClass> classes = new HashMap<String, MemClass>();
        MemLoader(ClassLoader parent) { super(parent); }
        @Override protected Class<?> findClass(String name)
                throws ClassNotFoundException {
            MemClass mc = classes.get(name);
            if (mc == null) throw new ClassNotFoundException(name);
            byte[] b = mc.bytes.toByteArray();
            return defineClass(name, b, 0, b.length);
        }
    }

    static final class MemFileManager
            extends ForwardingJavaFileManager<JavaFileManager> {
        final MemLoader loader =
            new MemLoader(CanonLoader.class.getClassLoader());
        MemFileManager(JavaFileManager delegate) { super(delegate); }
        @Override public JavaFileObject getJavaFileForOutput(
                Location location, String className,
                JavaFileObject.Kind kind, FileObject sibling) {
            MemClass mc = new MemClass(className);
            loader.classes.put(className, mc);
            return mc;
        }
    }
}
