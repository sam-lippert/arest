using System;

// Apply the canon's own report to the composed store and print the
// verdicts — effects only, the Platform seam. No fallback lists, no
// guards, no comparison logic: localizing a failure is a probe you write
// when you need it, never a standing feature (standing features are how
// the last two runners died).
public static class Program
{
    public static int Main(string[] args)
    {
        Arest.Load();
        Arest.LoadCarriers();
        string reportName = args.Length > 0 && args[0] == "app" ? "law:app_report" : "law:report";
        var report = (object[])Arest.Ev(reportName, Arest.CELLS.ToArray());
        bool ok = true;
        foreach (object[] pair in report)
        {
            bool pass = (pair[1] as string) == "T";
            ok = ok && pass;
            Console.WriteLine((pass ? "  law OK: " : "  LAW FAILED: ") + pair[0] + (pass ? "" : " -> F"));
        }
        Console.WriteLine(ok
            ? "ALL LAWS HOLD (canon-evaluated: " + reportName + " over the composed store)"
            : "LAW FAILURE");
        return ok ? 0 : 1;
    }
}
