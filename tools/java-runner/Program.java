// Apply the canon's own report to the composed store and print the
// verdicts — effects only, the Platform seam. Output lines are
// byte-identical to the C# and js stations so a diff of any two captures
// is the parity check itself. No fallback lists, no guards, no comparison
// logic: localizing a failure is a probe you write when you need it and
// delete when you're done.
public class Program {
    public static void main(String[] args) {
        Composed.load();
        Composed.loadCarriers();
        if (args.length > 0 && args[0].equals("solve")) {
            // the solve mode: one canon-rendered text atom, printed
            // verbatim — cross-station byte-identity is the certification
            System.out.println(Arest.Ev("solve:report", Arest.CELLS.toArray()));
            System.exit(0);
        }
        String reportName = args.length > 0 && args[0].equals("app") ? "law:app_report" : "law:report";
        Object[] report = (Object[]) Arest.Ev(reportName, Arest.CELLS.toArray());
        boolean ok = true;
        for (Object row : report) {
            Object[] pair = (Object[]) row;
            boolean pass = "T".equals(pair[1]);
            ok = ok && pass;
            System.out.println((pass ? "  law OK: " : "  LAW FAILED: ") + pair[0] + (pass ? "" : " -> F"));
        }
        System.out.println(ok
            ? "ALL LAWS HOLD (canon-evaluated: " + reportName + " over the composed store)"
            : "LAW FAILURE");
        System.exit(ok ? 0 : 1);
    }
}
