// The Java host's own unit tests. JUnit 5 via the standalone console launcher
// -- no python, no second host, no build tool.
//
// Every host runs the same canon over the same carriers, so "the hosts agree"
// does not need one host to drive the others: each asserts its own answers
// against engine/shared/expected-cases.tsv and agreement follows because they
// all match the same file.
//
//   javac -cp ../lib/junit-platform-console-standalone.jar;. CasesTest.java
//   java -jar ../lib/junit-platform-console-standalone.jar -cp . -c CasesTest
//
// Java 8 source: this runner is built with 1.8, so no var and no text blocks.
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class CasesTest {

    private static boolean loaded = false;

    static File root() {
        File d = new File(System.getProperty("user.dir")).getAbsoluteFile();
        while (d != null && !new File(d, "arest").isFile()) d = d.getParentFile();
        if (d == null) throw new IllegalStateException("repo root not found");
        return d;
    }

    static String shared(String name) throws IOException {
        return new String(Files.readAllBytes(
            Paths.get(root().getPath(), "engine", "shared", name)), StandardCharsets.UTF_8);
    }

    // The canon is loaded ONCE for the class: Reader.load mutates Arest.CELLS,
    // so loading per case would stack the canon on itself 566 times.
    static synchronized void load() {
        if (loaded) return;
        String r = root().getPath();
        // the same four reads Program.java does, in the same order, with
        // absolute paths because the launcher's working directory is not the
        // runner's
        Reader.load(Paths.get(r, "arest").toString());
        Reader.load(Paths.get(r, "engine", "shared", "scenarios.canon").toString());
        Reader.load(Paths.get(r, "tools", "norma-oracle", "design-state").toString());
        Reader.load(Paths.get(r, "tools", "norma-oracle", "norma-answer").toString());
        loaded = true;
    }

    // THE BOTTOM ROWS ARE THE POINT. canon's note above main:case_text says one
    // case per invocation is deliberate: the table holds rows that BOTTOM, no
    // canon def can branch on bottom, and a fold would die at the first one.
    // The CLI makes a bottom visible by dying and the driver recorded
    // <refused>. In-process the boundary is a catch, and it has to be here or
    // the deliberate refusals read as broken tests.
    static String answer(String name) {
        try {
            Object[] out = (Object[]) Arest.Ev("main",
                new Object[] { Arest.CELLS.toArray(), new Object[] { "case", name } });
            Object text = out[0];
            String s = text == null ? "" : text.toString().trim();
            return s.isEmpty() ? "<refused>" : s;
        } catch (Throwable t) {
            return "<refused>";
        }
    }

    // A JSON string literal back to its text. The golden encodes answers that
    // way because two of them are SQL DDL carrying real newlines.
    static String unescape(String lit) {
        String s = lit.trim();
        int i = s.startsWith("\"") ? 1 : 0;
        int end = s.endsWith("\"") ? s.length() - 1 : s.length();
        StringBuilder out = new StringBuilder();
        while (i < end) {
            char c = s.charAt(i);
            if (c != '\\') { out.append(c); i++; continue; }
            i++;
            char e = s.charAt(i);
            if (e == 'n') out.append('\n');
            else if (e == 't') out.append('\t');
            else if (e == 'r') out.append('\r');
            else if (e == 'b') out.append('\b');
            else if (e == 'f') out.append('\f');
            else if (e == 'u') {
                out.append((char) Integer.parseInt(s.substring(i + 1, i + 5), 16));
                i += 4;
            } else out.append(e);
            i++;
        }
        return out.toString();
    }

    static List<String[]> golden() throws IOException {
        List<String[]> rows = new ArrayList<String[]>();
        for (String line : shared("expected-cases.tsv").split("\n")) {
            if (line.isEmpty()) continue;
            int t = line.indexOf('\t');
            rows.add(new String[] { line.substring(0, t), unescape(line.substring(t + 1)) });
        }
        return rows;
    }

    static Stream<Arguments> cases() throws IOException {
        List<Arguments> out = new ArrayList<Arguments>();
        for (String[] r : golden()) out.add(Arguments.of(r[0], r[1]));
        return out.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void everyCaseAnswersWhatTheCanonSays(String name, String want) {
        load();
        assertEquals(want, answer(name));
    }

    // A def NO host can evaluate answers <refused> everywhere and agrees
    // perfectly, so the refusal COUNT is the signal, not the pass line.
    @Test
    void theGoldenStillExpectsExactlySeventeenRefusals() throws IOException {
        int n = 0;
        for (String[] r : golden()) if ("<refused>".equals(r[1])) n++;
        assertEquals(17, n);
    }

    @Test
    void lawReportHoldsByteForByte() throws IOException {
        load();
        String want = shared("expected-laws.txt").trim();
        Object[] out = (Object[]) Arest.Ev("main",
            new Object[] { Arest.CELLS.toArray(), new Object[] {} });
        assertTrue(out[0] != null);
        assertEquals(want, out[0].toString().trim());
    }
}
