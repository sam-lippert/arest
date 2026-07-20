// THE HOST CONTRACT, FINAL — six lines, no modes, no rendering, forever.
// All dispatch and all text live in canon `main`; a new operation is a
// canon edit, never a host edit. Adding a branch here is how runners die.
public class Program {
    public static void main(String[] args) {
        Composed.load();
        Composed.loadCarriers();
        Object[] out = (Object[]) Arest.Ev("main", new Object[] { Arest.CELLS.toArray(), args });
        System.out.print(out[0] + "\n");
        System.exit("T".equals(out[1]) ? 0 : 1);
    }
}
