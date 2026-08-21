// THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
// All dispatch and all text live in canon `main`; a new operation is a
// canon edit, never a host edit. Adding a branch here is how runners die.
//
// The four files are READ now, not compiled in. compose.py's Composed.g.java
// was 2.16 MB of generated source that javac chewed on every canon edit,
// because the JVM caps a method at 64 KB and the canon is one 1.1 MB tuple.
// A parser has no such cap. Order is unchanged: canon, the case table, then
// the carriers, matching the js concatenation exactly.
public class Program {
    public static void main(String[] args) {
        Reader.load(Reader.path("AREST_CANON", "../../arest"));
        Reader.load(Reader.path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        Reader.load(Reader.path("AREST_DESIGN_STATE", "../norma-oracle/design-state"));
        Reader.load(Reader.path("AREST_NORMA_ANSWER", "../norma-oracle/norma-answer"));
        Object[] out = (Object[]) Arest.Ev("main", new Object[] { Arest.CELLS.toArray(), args });
        System.out.print(out[0] + "\n");
        System.exit("T".equals(out[1]) ? 0 : 1);
    }
}
