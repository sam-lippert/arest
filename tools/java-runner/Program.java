// THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
// All dispatch and all text live in lambda `main`; a new operation is a
// lambda edit, never a host edit. Adding a branch here is how runners die.
//
// The files are READ now, not compiled in. compose.py's Composed.g.java
// was 2.16 MB of generated source that javac chewed on every lambda edit,
// because the JVM caps a method at 64 KB and the lambda is one 1.1 MB tuple.
// A parser has no such cap. Order is unchanged: lambda, the case table, then
// the carriers, matching the js concatenation exactly; the carriers are a
// directory, AREST_CARRIERS as build.js names it (tools/carriers/base unless
// set), read as build.js splices it (Reader.loadCarriers).
public class Program {
    public static void main(String[] args) {
        Reader.load(Reader.path("AREST_LAMBDA", "../../arest"));
        Reader.load(Reader.path("AREST_TESTS", "../../arest.tests"));
        Reader.load(Reader.path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        Reader.loadCarriers(Reader.path("AREST_CARRIERS", "../carriers/base"));
        Object[] out = (Object[]) Arest.Ev("main", new Object[] { Arest.CELLS.toArray(), args });
        System.out.print(out[0] + "\n");
        System.exit("T".equals(out[1]) ? 0 : 1);
    }
}
